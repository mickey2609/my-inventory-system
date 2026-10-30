// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const normalizeKey = (str) => {
    if (!str) return '';
    return String(str).trim().toUpperCase();
  };

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

  // 1. 取得不合理進貨即時動態清單 (精確納入 inventory 表庫齡 age)
  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleTypes, ruleType, turnoverLevels, turnoverLevel, limit } = req.query;
    const maxLimit = Number(limit) || 10000;

    const ruleList = (ruleTypes || ruleType || 'all').split(',').map(s => s.trim()).filter(Boolean);
    const levelList = (turnoverLevels || turnoverLevel || 'all').split(',').map(s => s.trim()).filter(Boolean);

    let inSql = `
      SELECT 
        warehouse, rec_date, rec_time, po_no, batch_no, item_id, item_name,
        IFNULL(qty, 0) AS import_qty,
        IFNULL(length, 0) AS length,
        IFNULL(width, 0) AS width,
        IFNULL(height, 0) AS height
      FROM inbound_details
      WHERE 1=1
    `;
    const inParams = [];

    if (startDate && endDate) {
      inSql += ` AND rec_date >= ? AND rec_date <= ?`;
      inParams.push(startDate, endDate);
    } else if (startDate) {
      inSql += ` AND rec_date = ?`;
      params = [startDate];
      inParams.push(startDate);
    }

    if (warehouse && warehouse !== 'all') {
      inSql += ` AND warehouse = ?`;
      inParams.push(warehouse);
    }

    inSql += ` ORDER BY rec_date DESC, rec_time DESC LIMIT ?`;
    inParams.push(maxLimit);

    // 第一步：精準抓取當天進貨明細
    db.all(inSql, inParams, (errIn, inboundRows) => {
      if (errIn) {
        return res.status(500).json({ success: false, message: '進貨明細讀取失敗：' + errIn.message });
      }

      if (!inboundRows || inboundRows.length === 0) {
        return res.json({
          success: true,
          summary: { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 },
          data: []
        });
      }

      // 第二步：平行載入備註表、銷量總表、庫存主檔(取最高庫齡與庫存)
      db.all(`SELECT item_id, is_gift, remark FROM item_custom_notes`, [], (errNotes, notesRows) => {
        db.all(`SELECT item_id, total_stock_qty, stock_qty_80, sales_90d, monthly_sales, pm, supplier_name FROM item_sales_history`, [], (errHist, histRows) => {
          db.all(`SELECT item_id, MAX(age) AS max_age, SUM(qty) AS inv_qty, MAX(turn_days_total) AS turn_days, MAX(pm) AS inv_pm, MAX(supplier_name) AS inv_supplier FROM inventory GROUP BY item_id`, [], (errInv, invRows) => {
            
            // 建立自訂備註 Map
            const notesMap = new Map();
            (notesRows || []).forEach(n => {
              const k = normalizeKey(n.item_id);
              if (k) notesMap.set(k, { is_gift: Number(n.is_gift) === 1, remark: n.remark || '' });
            });

            // 建立庫存主檔庫齡 Map (🌟 修正重點：取實際庫齡)
            const invAgeMap = new Map();
            (invRows || []).forEach(i => {
              const k = normalizeKey(i.item_id);
              if (k) {
                invAgeMap.set(k, {
                  age: Number(i.max_age) || 0,
                  inv_qty: Number(i.inv_qty) || 0,
                  turn_days: Number(i.turn_days) || 0,
                  pm: i.inv_pm || '',
                  supplier: i.inv_supplier || ''
                });
              }
            });

            // 建立歷史基準 Map
            const histMap = new Map();
            (histRows || []).forEach(h => {
              const k = normalizeKey(h.item_id);
              if (k) {
                histMap.set(k, {
                  stock_qty: Number(h.total_stock_qty || h.stock_qty_80 || 0),
                  sales_90d: Number(h.sales_90d || 0),
                  monthly_sales: Number(h.monthly_sales || 0),
                  pm: h.pm || '未指定PM',
                  supplier_name: h.supplier_name || '未知供應商'
                });
              }
            });

            const abnormalRows = [];
            let totalPcs = 0;
            let totalCubicFeet = 0;
            const pmSet = new Set();

            // 第三步：比對並計算各項不合理指標
            inboundRows.forEach(r => {
              const key = normalizeKey(r.item_id);
              const noteInfo = notesMap.get(key) || { is_gift: false, remark: '' };
              const hist = histMap.get(key);
              const invInfo = invAgeMap.get(key) || { age: 0, inv_qty: 0, turn_days: 0, pm: '', supplier: '' };

              const isHistoryRecorded = !!hist;
              const stockQty = Math.max(hist ? hist.stock_qty : 0, invInfo.inv_qty);
              const sales90 = hist ? hist.sales_90d : 0;
              const monthlySales = hist ? hist.monthly_sales : 0;
              const actualAge = invInfo.age; // 🌟 讀取實際庫齡天數
              const pm = invInfo.pm || (hist ? hist.pm : '未指定PM') || '未指定PM';
              const supplier = invInfo.supplier || (hist ? hist.supplier_name : '未知供應商') || '未知供應商';

              const importQty = Number(r.import_qty) || 0;
              const len = Number(r.length) || 0;
              const w = Number(r.width) || 0;
              const h = Number(r.height) || 0;

              const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
              const importCubicFeet = parseFloat((singleCf * importQty).toFixed(2));

              let turnMonths = Number(invInfo.turn_days) || 0;
              if (turnMonths === 0 || turnMonths >= 99999) {
                turnMonths = monthlySales > 0 ? parseFloat(((stockQty + importQty) / monthlySales).toFixed(1)) : 99999;
              }
              const levelInfo = getTurnoverLevelInfo(turnMonths);

              const tags = [];
              if (noteInfo.is_gift) tags.push({ text: '🎁 贈品採購', type: 'info' });
              if (!isHistoryRecorded && sales90 === 0 && actualAge === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
              else if (isHistoryRecorded && stockQty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

              if (sales90 === 0 && importQty > 0 && !noteInfo.is_gift && isHistoryRecorded) {
                tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
              } else if (actualAge >= 180) {
                tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });
              }

              if (turnMonths > 6 && !noteInfo.is_gift) {
                tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
              }
              if (sales90 > 0 && importQty >= (sales90 * 2)) {
                tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });
              }

              // 1. 不合理類型比對 (多選)
              let isMatchRule = false;
              if (ruleList.includes('all') || ruleList.length === 0 || ruleList.length === 4) {
                isMatchRule = tags.length > 0;
              } else {
                if (ruleList.includes('zero_sales') && tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'))) isMatchRule = true;
                if (ruleList.includes('high_turnover') && tags.some(t => t.text.includes('迴轉月數過高'))) isMatchRule = true;
                if (ruleList.includes('over_import') && tags.some(t => t.text.includes('爆量驗收') || t.text.includes('超量驗收'))) isMatchRule = true;
                if (ruleList.includes('gift') && noteInfo.is_gift) isMatchRule = true;
              }

              // 2. 迴轉級距比對 (多選)
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
                  age: actualAge, // 🌟 正確填入實際庫齡天數
                  monthly_sales: monthlySales,
                  sales_90d: sales90,
                  turn_days_total: turnMonths,
                  turnover_level: levelInfo.label,
                  pm,
                  supplier_name: supplier,
                  is_gift: noteInfo.is_gift,
                  custom_remark: noteInfo.remark,
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
        });
      });
    });
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

    const key = normalizeKey(itemId);
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

  // 5. 補結算快照 API (含真實庫齡)
  router.post('/generate-history-snapshot', (req, res) => {
    const { startDate, endDate } = req.body;
    let inSql = `
      SELECT warehouse, rec_date, rec_time, po_no, batch_no, item_id, item_name,
             IFNULL(qty, 0) AS import_qty, IFNULL(length, 0) AS length,
             IFNULL(width, 0) AS width, IFNULL(height, 0) AS height
      FROM inbound_details
      WHERE rec_date IS NOT NULL AND rec_date != ''
    `;
    const inParams = [];
    if (startDate && endDate) { inSql += ` AND rec_date >= ? AND rec_date <= ?`; inParams.push(startDate, endDate); }

    db.all(inSql, inParams, (errIn, inboundRows) => {
      if (errIn || !inboundRows || inboundRows.length === 0) {
        return res.json({ success: true, count: 0, message: '查無符合日期的進貨明細可供結算！' });
      }

      db.all(`SELECT item_id, is_gift FROM item_custom_notes`, [], (errN, notesRows) => {
        db.all(`SELECT item_id, total_stock_qty, stock_qty_80, sales_90d, monthly_sales, pm, supplier_name FROM item_sales_history`, [], (errH, histRows) => {
          db.all(`SELECT item_id, MAX(age) AS max_age, SUM(qty) AS inv_qty, MAX(turn_days_total) AS turn_days, MAX(pm) AS inv_pm, MAX(supplier_name) AS inv_supplier FROM inventory GROUP BY item_id`, [], (errInv, invRows) => {
            const notesMap = new Map();
            (notesRows || []).forEach(n => notesMap.set(normalizeKey(n.item_id), Number(n.is_gift) === 1));

            const invAgeMap = new Map();
            (invRows || []).forEach(i => {
              const k = normalizeKey(i.item_id);
              if (k) {
                invAgeMap.set(k, {
                  age: Number(i.max_age) || 0,
                  inv_qty: Number(i.inv_qty) || 0,
                  turn_days: Number(i.turn_days) || 0,
                  pm: i.inv_pm || '',
                  supplier: i.inv_supplier || ''
                });
              }
            });

            const histMap = new Map();
            (histRows || []).forEach(h => {
              histMap.set(normalizeKey(h.item_id), {
                stock_qty: Number(h.total_stock_qty || h.stock_qty_80 || 0),
                sales_90d: Number(h.sales_90d || 0),
                monthly_sales: Number(h.monthly_sales || 0),
                pm: h.pm || '未指定PM',
                supplier_name: h.supplier_name || '未知供應商'
              });
            });

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
                  import_qty = EXCLUDED.import_qty, stock_qty = EXCLUDED.stock_qty,
                  monthly_sales = EXCLUDED.monthly_sales, sales_90d = EXCLUDED.sales_90d,
                  turn_months = EXCLUDED.turn_months, turnover_level = EXCLUDED.turnover_level,
                  age = EXCLUDED.age, abnormal_tags = EXCLUDED.abnormal_tags
              `);

              let snapCount = 0;
              inboundRows.forEach(r => {
                const key = normalizeKey(r.item_id);
                const isGift = notesMap.get(key) || false;
                const hist = histMap.get(key);
                const invInfo = invAgeMap.get(key) || { age: 0, inv_qty: 0, turn_days: 0, pm: '', supplier: '' };

                const isHistoryRecorded = !!hist;
                const stockQty = Math.max(hist ? hist.stock_qty : 0, invInfo.inv_qty);
                const sales90 = hist ? hist.sales_90d : 0;
                const monthlySales = hist ? hist.monthly_sales : 0;
                const actualAge = invInfo.age;
                const pm = invInfo.pm || (hist ? hist.pm : '未指定PM') || '未指定PM';
                const supplier = invInfo.supplier || (hist ? hist.supplier_name : '未知供應商') || '未知供應商';

                const importQty = Number(r.import_qty) || 0;
                const len = Number(r.length) || 0;
                const w = Number(r.width) || 0;
                const h = Number(r.height) || 0;

                const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
                const importCubicFeet = parseFloat((singleCf * importQty).toFixed(2));

                let turnMonths = Number(invInfo.turn_days) || 0;
                if (turnMonths === 0 || turnMonths >= 99999) {
                  turnMonths = monthlySales > 0 ? parseFloat(((stockQty + importQty) / monthlySales).toFixed(1)) : 99999;
                }
                const levelInfo = getTurnoverLevelInfo(turnMonths);

                const tags = [];
                if (isGift) tags.push({ text: '🎁 贈品採購', type: 'info' });
                if (!isHistoryRecorded && sales90 === 0 && actualAge === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
                else if (isHistoryRecorded && stockQty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

                if (sales90 === 0 && importQty > 0 && !isGift && isHistoryRecorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
                else if (actualAge >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

                if (turnMonths > 6 && !isGift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
                if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

                if (tags.length > 0) {
                  snapshotStmt.run(
                    r.rec_date, r.warehouse, r.rec_date, r.rec_time, r.po_no, r.batch_no,
                    r.item_id, r.item_name, importQty, len, w, h,
                    importCubicFeet, stockQty, monthlySales, sales90,
                    turnMonths, levelInfo.label, actualAge, supplier, pm,
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
      });
    });
  });

  return router;
};