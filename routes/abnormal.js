// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const getTurnoverLevelInfo = (monthsVal) => {
    const months = Number(monthsVal) || 0;
    if (months >= 99999) return { code: 'm99999', label: '🚨 99999 滯銷品' };
    if (months > 120) return { code: 'gt120', label: '10 年以上 (>120個月)' };
    if (months >= 61) return { code: 'm61_120', label: '5 年～10 年 (61~120個月)' };
    if (months >= 13) return { code: 'm13_60', label: '1 年～5 年 (13~60個月)' };
    if (months >= 9) return { code: 'm9_12', label: '9~12個月' };
    if (months >= 6) return { code: 'm6_9', label: '6~9個月' };
    if (months >= 3) return { code: 'm3_6', label: '3~6個月' };
    return { code: 'le3', label: '<=3個月' };
  };

  // 1. 取得不合理進貨即時動態清單 (以單一高效 LEFT JOIN 查詢，絕不阻塞崩潰)
  router.get('/list', (req, res) => {
    try {
      const { startDate, endDate, warehouse, ruleTypes, ruleType, turnoverLevels, turnoverLevel, limit } = req.query;
      const maxLimit = Number(limit) || 10000;

      const ruleList = (ruleTypes || ruleType || 'all').split(',').map(s => s.trim()).filter(Boolean);
      const levelList = (turnoverLevels || turnoverLevel || 'all').split(',').map(s => s.trim()).filter(Boolean);

      let sql = `
        SELECT 
          d.warehouse, d.rec_date, d.rec_time, d.po_no, d.batch_no, d.item_id, d.item_name,
          IFNULL(d.qty, 0) AS import_qty,
          IFNULL(d.length, 0) AS length,
          IFNULL(d.width, 0) AS width,
          IFNULL(d.height, 0) AS height,
          IFNULL(n.is_gift, 0) AS is_gift,
          IFNULL(n.remark, '') AS custom_remark,
          h.item_id AS hist_item_id,
          IFNULL(h.total_stock_qty, 0) AS hist_stock_qty,
          IFNULL(h.sales_90d, 0) AS hist_sales_90d,
          IFNULL(h.monthly_sales, 0) AS hist_monthly_sales,
          IFNULL(h.pm, '未指定PM') AS hist_pm,
          IFNULL(h.supplier_name, '未知供應商') AS hist_supplier_name,
          IFNULL(i.qty, 0) AS inv80_qty,
          IFNULL(i.age, 0) AS inv80_age,
          IFNULL(i.monthly_sales, 0) AS inv80_msales,
          IFNULL(i.sales_90d, 0) AS inv80_s90,
          IFNULL(i.turn_days_total, 0) AS inv80_turn,
          IFNULL(i.pm, '') AS inv80_pm,
          IFNULL(i.supplier_name, '') AS inv80_supplier
        FROM inbound_details d
        LEFT JOIN item_custom_notes n ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(n.item_id))
        LEFT JOIN item_sales_history h ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(h.item_id))
        LEFT JOIN inventory i ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(i.item_id))
        WHERE 1=1
      `;

      const params = [];

      if (startDate && endDate) {
        sql += ` AND d.rec_date >= ? AND d.rec_date <= ?`;
        params.push(startDate, endDate);
      } else if (startDate) {
        sql += ` AND d.rec_date = ?`;
        params.push(startDate);
      }

      if (warehouse && warehouse !== 'all') {
        sql += ` AND d.warehouse = ?`;
        params.push(warehouse);
      }

      sql += ` ORDER BY d.rec_date DESC, d.rec_time DESC LIMIT ?`;
      params.push(maxLimit);

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('查詢不合理進貨失敗:', err.message);
          return res.status(500).json({ success: false, message: '資料庫查詢失敗：' + err.message });
        }

        const abnormalRows = [];
        let totalPcs = 0;
        let totalCubicFeet = 0;
        const pmSet = new Set();

        (rows || []).forEach(r => {
          const importQty = Number(r.import_qty) || 0;
          const isGift = Number(r.is_gift) === 1;
          const customRemark = r.custom_remark || '';

          const stockQty = Math.max(Number(r.hist_stock_qty) || 0, Number(r.inv80_qty) || 0);
          const sales90 = Math.max(Number(r.hist_sales_90d) || 0, Number(r.inv80_s90) || 0);
          const monthlySales = Math.max(Number(r.hist_monthly_sales) || 0, Number(r.inv80_msales) || 0);
          const age = Number(r.inv80_age) || 0;
          const pm = r.inv80_pm || r.hist_pm || '未指定PM';
          const supplier = r.inv80_supplier || r.hist_supplier_name || '未知供應商';
          const isHistoryRecorded = !!r.hist_item_id;

          const len = Number(r.length) || 0;
          const w = Number(r.width) || 0;
          const h = Number(r.height) || 0;
          const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
          const importCubicFeet = parseFloat((singleCf * importQty).toFixed(2));

          let turnMonths = Number(r.inv80_turn) || 0;
          if (turnMonths === 0 || turnMonths >= 99999) {
            turnMonths = monthlySales > 0 ? parseFloat(((stockQty + importQty) / monthlySales).toFixed(1)) : 99999;
          }
          const levelInfo = getTurnoverLevelInfo(turnMonths);

          const tags = [];
          if (isGift) tags.push({ text: '🎁 贈品採購', type: 'info' });
          if (!isHistoryRecorded && sales90 === 0 && age === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
          else if (isHistoryRecorded && stockQty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

          if (sales90 === 0 && importQty > 0 && !isGift && isHistoryRecorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
          else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

          if (turnMonths > 6 && !isGift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
          if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

          // 1. 不合理類型比對 (支援多選)
          let isMatchRule = false;
          if (ruleList.includes('all') || ruleList.length === 0 || ruleList.length === 4) {
            isMatchRule = tags.length > 0;
          } else {
            if (ruleList.includes('zero_sales') && tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'))) isMatchRule = true;
            if (ruleList.includes('high_turnover') && tags.some(t => t.text.includes('迴轉月數過高'))) isMatchRule = true;
            if (ruleList.includes('over_import') && tags.some(t => t.text.includes('爆量驗收') || t.text.includes('超量驗收'))) isMatchRule = true;
            if (ruleList.includes('gift') && isGift) isMatchRule = true;
          }

          // 2. 迴轉級距比對 (支援多選)
          let isMatchLevel = false;
          if (levelList.includes('all') || levelList.length === 0 || levelList.length === 8) {
            isMatchLevel = true;
          } else {
            isMatchLevel = levelList.includes(levelInfo.code);
          }

          if (isMatchRule && isMatchLevel) {
            abnormalRows.push({
              warehouse: r.warehouse,
              rec_date: r.rec_date,
              rec_time: r.rec_time,
              po_no: r.po_no,
              batch_no: r.batch_no,
              item_id: r.item_id,
              item_name: r.item_name || '-',
              import_qty: importQty,
              current_stock_qty: stockQty,
              import_cubic_feet: importCubicFeet,
              age,
              monthly_sales: monthlySales,
              sales_90d: sales90,
              turn_days_total: turnMonths,
              turnover_level: levelInfo.label,
              pm,
              supplier_name: supplier,
              is_gift: isGift,
              custom_remark: customRemark,
              tags
            });

            totalPcs += importQty;
            totalCubicFeet += importCubicFeet;
            if (pm && pm !== '未指定PM') pmSet.add(pm);
          }
        });

        res.json({
          success: true,
          summary: {
            totalCount: abnormalRows.length,
            totalPcs,
            totalCubicFeet: parseFloat(totalCubicFeet.toFixed(2)),
            pmCount: pmSet.size
          },
          data: abnormalRows
        });
      });
    } catch (err) {
      console.error('API 異常:', err);
      res.status(500).json({ success: false, message: '伺服器執行錯誤: ' + err.message });
    }
  });

  // 2. 取得每日不合理進貨快照歷史清單
  router.get('/snapshot-list', (req, res) => {
    const { startDate, endDate, warehouse, limit } = req.query;
    const maxLimit = Number(limit) || 10000;

    let sql = `SELECT * FROM abnormal_purchase_history WHERE 1=1`;
    const params = [];

    if (startDate && endDate) {
      sql += ` AND rec_date >= ? AND rec_date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND rec_date = ?`;
      params.push(startDate);
    }

    if (warehouse && warehouse !== 'all') {
      sql += ` AND warehouse = ?`;
      params.push(warehouse);
    }

    sql += ` ORDER BY snapshot_date DESC, rec_date DESC, rec_time DESC LIMIT ?`;
    params.push(maxLimit);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: '快照資料讀取失敗：' + err.message });

      rows = rows || [];
      let totalPcs = 0;
      let totalCubicFeet = 0;
      const pmSet = new Set();

      const formattedRows = rows.map(r => {
        let tags = [];
        try { tags = JSON.parse(r.abnormal_tags || '[]'); } catch (e) { tags = []; }

        totalPcs += (r.import_qty || 0);
        totalCubicFeet += (r.import_cubic_feet || 0);
        if (r.pm && r.pm !== '未指定PM') pmSet.add(r.pm);

        return { ...r, current_stock_qty: r.stock_qty, tags };
      });

      res.json({
        success: true,
        summary: {
          totalCount: formattedRows.length,
          totalPcs,
          totalCubicFeet: parseFloat(totalCubicFeet.toFixed(2)),
          pmCount: pmSet.size
        },
        data: formattedRows
      });
    });
  });

  // 3. 儲存/更新商品自訂備註與贈品狀態 API
  router.post('/save-note', (req, res) => {
    const { itemId, isGift, remark, updatedBy } = req.body;
    if (!itemId) return res.status(400).json({ success: false, message: '請提供商品編號' });

    const key = String(itemId).trim().toUpperCase();
    const sql = `
      INSERT INTO item_custom_notes (item_id, is_gift, remark, updated_by, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_id) DO UPDATE SET
        is_gift = EXCLUDED.is_gift,
        remark = EXCLUDED.remark,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `;

    db.run(sql, [key, isGift ? 1 : 0, remark || '', updatedBy || '系統管理員'], function(err) {
      if (err) return res.status(500).json({ success: false, message: '儲存備註失敗：' + err.message });
      res.json({ success: true, message: `🎉 商品 ${key} 備註與贈品狀態已成功儲存！` });
    });
  });

  // 4. 每週一週報分析 API
  router.get('/weekly-summary', (req, res) => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6);
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek);

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const startStr = req.query.startDate || fmt(lastMonday);
    const endStr = req.query.endDate || fmt(lastSunday);

    const sql = `SELECT * FROM abnormal_purchase_history WHERE rec_date >= ? AND rec_date <= ? ORDER BY rec_date DESC`;

    db.all(sql, [startStr, endStr], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: '週報讀取失敗：' + err.message });
      rows = rows || [];
      let totalPcs = 0;
      let totalCubicFeet = 0;
      const pmStats = {};

      rows.forEach(r => {
        totalPcs += (r.import_qty || 0);
        totalCubicFeet += (r.import_cubic_feet || 0);
        const pm = r.pm || '未指定PM';
        if (!pmStats[pm]) pmStats[pm] = { count: 0, pcs: 0, cubicFeet: 0 };
        pmStats[pm].count += 1;
        pmStats[pm].pcs += (r.import_qty || 0);
        pmStats[pm].cubicFeet += (r.import_cubic_feet || 0);
      });

      res.json({
        success: true,
        range: { startDate: startStr, endDate: endStr },
        summary: { totalCount: rows.length, totalPcs, totalCubicFeet: parseFloat(totalCubicFeet.toFixed(2)), pmCount: Object.keys(pmStats).length },
        pmStats,
        data: rows
      });
    });
  });

  // 5. 一鍵補算歷史進貨快照結算 API (單次關聯 SQL 寫入，安全穩定)
  router.post('/generate-history-snapshot', (req, res) => {
    const { startDate, endDate } = req.body;
    let sql = `
      SELECT 
        d.warehouse, d.rec_date, d.rec_time, d.po_no, d.batch_no, d.item_id, d.item_name,
        IFNULL(d.qty, 0) AS import_qty,
        IFNULL(d.length, 0) AS length,
        IFNULL(d.width, 0) AS width,
        IFNULL(d.height, 0) AS height,
        IFNULL(n.is_gift, 0) AS is_gift,
        h.item_id AS hist_item_id,
        IFNULL(h.total_stock_qty, 0) AS hist_stock_qty,
        IFNULL(h.sales_90d, 0) AS hist_sales_90d,
        IFNULL(h.monthly_sales, 0) AS hist_monthly_sales,
        IFNULL(h.pm, '未指定PM') AS hist_pm,
        IFNULL(h.supplier_name, '未知供應商') AS hist_supplier_name,
        IFNULL(i.qty, 0) AS inv80_qty,
        IFNULL(i.age, 0) AS inv80_age,
        IFNULL(i.monthly_sales, 0) AS inv80_msales,
        IFNULL(i.sales_90d, 0) AS inv80_s90,
        IFNULL(i.turn_days_total, 0) AS inv80_turn,
        IFNULL(i.pm, '') AS inv80_pm,
        IFNULL(i.supplier_name, '') AS inv80_supplier
      FROM inbound_details d
      LEFT JOIN item_custom_notes n ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(n.item_id))
      LEFT JOIN item_sales_history h ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(h.item_id))
      LEFT JOIN inventory i ON UPPER(TRIM(d.item_id)) = UPPER(TRIM(i.item_id))
      WHERE d.rec_date IS NOT NULL AND d.rec_date != ''
    `;
    const params = [];
    if (startDate && endDate) {
      sql += ` AND d.rec_date >= ? AND d.rec_date <= ?`;
      params.push(startDate, endDate);
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: '讀取待快照資料失敗: ' + err.message });
      if (!rows || rows.length === 0) {
        return res.json({ success: true, count: 0, message: '查無符合日期的進貨明細可供結算！' });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const snapshotStmt = db.prepare(`
          INSERT INTO abnormal_purchase_history (
            snapshot_date, warehouse, rec_date, rec_time, po_no, batch_no,
            item_id, item_name, import_qty, length, width, height,
            import_cubic_feet, stock_qty, monthly_sales, sales_90d,
            turn_months, turnover_level, age, supplier_name, pm, abnormal_tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(warehouse, po_no, batch_no, item_id, rec_date) DO UPDATE SET
            snapshot_date = EXCLUDED.snapshot_date,
            import_qty = EXCLUDED.import_qty,
            stock_qty = EXCLUDED.stock_qty,
            monthly_sales = EXCLUDED.monthly_sales,
            sales_90d = EXCLUDED.sales_90d,
            turn_months = EXCLUDED.turn_months,
            turnover_level = EXCLUDED.turnover_level,
            abnormal_tags = EXCLUDED.abnormal_tags
        `);

        let snapCount = 0;
        rows.forEach(r => {
          const importQty = Number(r.import_qty) || 0;
          const isGift = Number(r.is_gift) === 1;
          const stockQty = Math.max(Number(r.hist_stock_qty) || 0, Number(r.inv80_qty) || 0);
          const sales90 = Math.max(Number(r.hist_sales_90d) || 0, Number(r.inv80_s90) || 0);
          const monthlySales = Math.max(Number(r.hist_monthly_sales) || 0, Number(r.inv80_msales) || 0);
          const age = Number(r.inv80_age) || 0;
          const pm = r.inv80_pm || r.hist_pm || '未指定PM';
          const supplier = r.inv80_supplier || r.hist_supplier_name || '未知供應商';
          const isHistoryRecorded = !!r.hist_item_id;

          const len = Number(r.length) || 0;
          const w = Number(r.width) || 0;
          const h = Number(r.height) || 0;
          const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
          const importCubicFeet = parseFloat((singleCf * importQty).toFixed(2));

          let turnMonths = Number(r.inv80_turn) || 0;
          if (turnMonths === 0 || turnMonths >= 99999) {
            turnMonths = monthlySales > 0 ? parseFloat(((stockQty + importQty) / monthlySales).toFixed(1)) : 99999;
          }
          const levelInfo = getTurnoverLevelInfo(turnMonths);

          const tags = [];
          if (isGift) tags.push({ text: '🎁 贈品採購', type: 'info' });
          if (!isHistoryRecorded && sales90 === 0 && age === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
          else if (isHistoryRecorded && stockQty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

          if (sales90 === 0 && importQty > 0 && !isGift && isHistoryRecorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
          else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

          if (turnMonths > 6 && !isGift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
          if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

          if (tags.length > 0) {
            snapshotStmt.run(
              r.rec_date, r.warehouse, r.rec_date, r.rec_time, r.po_no, r.batch_no,
              r.item_id, r.item_name, importQty, len, w, h,
              importCubicFeet, stockQty, monthlySales, sales90,
              turnMonths, levelInfo.label, age, supplier, pm,
              JSON.stringify(tags)
            );
            snapCount++;
          }
        });

        snapshotStmt.finalize();
        db.run('COMMIT', (commitErr) => {
          if (commitErr) return res.status(500).json({ success: false, message: '快照寫入失敗: ' + commitErr.message });
          res.json({ success: true, count: snapCount, message: `🎉 成功完成歷史進貨快照結算，共歸檔 ${snapCount} 筆異常紀錄！` });
        });
      });
    });
  });

  return router;
};