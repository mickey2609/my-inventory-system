// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const normalizeKey = (str) => {
    if (!str) return '';
    return String(str).trim().toUpperCase().replace(/\s+/g, '');
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

  // 1. 取得不合理進貨即時動態清單 (支援多選 ruleTypes & turnoverLevels，精準載入)
  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleType, ruleTypes, turnoverLevel, turnoverLevels, limit } = req.query;
    const maxLimit = Number(limit) || 10000;

    // 解析複選條件
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
    const params = [];

    if (startDate && endDate) {
      inSql += ` AND rec_date >= ? AND rec_date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      inSql += ` AND rec_date = ?`;
      params.push(startDate);
    }

    if (warehouse && warehouse !== 'all') {
      inSql += ` AND warehouse = ?`;
      params.push(warehouse);
    }

    inSql += ` ORDER BY rec_date DESC, rec_time DESC LIMIT ?`;
    params.push(maxLimit);

    // 🌟 先精準抓取當天進貨明細
    db.all(inSql, params, (errIn, inboundRows) => {
      if (errIn) return res.status(500).json({ success: false, message: '進貨明細讀取失敗：' + errIn.message });
      if (!inboundRows || inboundRows.length === 0) {
        return res.json({ success: true, summary: { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 }, data: [] });
      }

      const targetItemIds = Array.from(new Set(inboundRows.map(r => normalizeKey(r.item_id)).filter(Boolean)));
      if (targetItemIds.length === 0) {
        return res.json({ success: true, summary: { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 }, data: [] });
      }

      const placeholders = targetItemIds.map(() => '?').join(',');

      const historySql = `SELECT * FROM item_sales_history WHERE item_id IN (${placeholders})`;
      const inv80Sql = `SELECT * FROM inventory WHERE item_id IN (${placeholders})`;
      const inv15Sql = `SELECT * FROM inventory_15 WHERE item_id IN (${placeholders})`;
      const notesSql = `SELECT * FROM item_custom_notes WHERE item_id IN (${placeholders})`;

      db.all(historySql, targetItemIds, (errHist, rowsHist) => {
        db.all(notesSql, targetItemIds, (errNotes, rowsNotes) => {
          db.all(inv80Sql, targetItemIds, (err80, rows80) => {
            db.all(inv15Sql, targetItemIds, (err15, rows15) => {
              const valid15 = rows15 || [];

              const notesMap = new Map();
              (rowsNotes || []).forEach(n => {
                const k = normalizeKey(n.item_id);
                if (k) notesMap.set(k, { is_gift: Number(n.is_gift) === 1, remark: n.remark || '' });
              });

              const invMap = new Map();
              (rowsHist || []).forEach(row => {
                const key = normalizeKey(row.item_id);
                if (!key) return;
                invMap.set(key, {
                  item_id: key,
                  item_name: row.item_name || '',
                  total_qty: Number(row.total_stock_qty || row.stock_qty_80 || 0),
                  sales_90d: Number(row.sales_90d || 0),
                  monthly_sales: Number(row.monthly_sales || 0),
                  turn_days_total: 0,
                  age: 0,
                  last_record_date: row.last_record_date || '',
                  is_history_recorded: true,
                  supplier_name: String(row.supplier_name || '').trim() || '未知供應商',
                  pm: String(row.pm || '').trim() || '未指定PM'
                });
              });

              const processInvRow = (row) => {
                const key = normalizeKey(row.item_id || row['商品ID']);
                if (!key) return;
                const locQty = Number(row.qty || row['儲位庫存數']) || 0;
                const rawTotalQty = Number(row.total_qty || row['總庫存數']) || 0;
                const sales90 = Number(row.sales_90d || row['(近)90日銷量']) || 0;
                const salesMonth = Number(row.monthly_sales || row['(近)月銷量']) || 0;
                const turnMonths = Number(row.turn_days_total || row['總庫存_迴轉天數'] || row['迴轉天數']) || 0;
                const ageVal = Number(row.age || row['庫齡']) || 0;
                const pmVal = String(row.pm || row['所屬PM'] || '').trim();
                const suppVal = String(row.supplier_name || row['供應商名稱'] || '').trim();

                if (invMap.has(key)) {
                  const existing = invMap.get(key);
                  existing.total_qty = Math.max(existing.total_qty, rawTotalQty, locQty);
                  existing.sales_90d = Math.max(existing.sales_90d, sales90);
                  existing.monthly_sales = Math.max(existing.monthly_sales, salesMonth);
                  existing.age = Math.max(existing.age, ageVal);
                  existing.turn_days_total = Math.max(existing.turn_days_total, turnMonths);
                  if ((!existing.pm || existing.pm === '未指定PM') && pmVal) existing.pm = pmVal;
                  if ((!existing.supplier_name || existing.supplier_name === '未知供應商') && suppVal) existing.supplier_name = suppVal;
                } else {
                  invMap.set(key, {
                    item_id: key,
                    item_name: row.item_name || row['商品名稱'] || '',
                    total_qty: Math.max(rawTotalQty, locQty),
                    sales_90d: sales90,
                    monthly_sales: salesMonth,
                    turn_days_total: turnMonths,
                    age: ageVal,
                    is_history_recorded: false,
                    supplier_name: suppVal || '未知供應商',
                    pm: pmVal || '未指定PM'
                  });
                }
              };

              (rows80 || []).forEach(processInvRow);
              valid15.forEach(processInvRow);

              const abnormalRows = [];
              let totalAbnormalPcs = 0;
              let totalAbnormalCubicFeet = 0;
              const pmSet = new Set();

              inboundRows.forEach(r => {
                const key = normalizeKey(r.item_id);
                const noteInfo = notesMap.get(key) || { is_gift: false, remark: '' };

                const inv = invMap.get(key) || {
                  item_id: key,
                  item_name: r.item_name || '',
                  total_qty: 0,
                  sales_90d: 0,
                  monthly_sales: 0,
                  turn_days_total: 99999,
                  age: 0,
                  is_history_recorded: false,
                  supplier_name: '未知供應商',
                  pm: '未指定PM'
                };

                const importQty = Number(r.import_qty) || 0;
                const sales90 = Number(inv.sales_90d) || 0;
                const mSales = Number(inv.monthly_sales) || 0;
                const age = Number(inv.age) || 0;
                const len = Number(r.length) || 0;
                const w = Number(r.width) || 0;
                const h = Number(r.height) || 0;

                let turnMonths = inv.turn_days_total || 0;
                if (turnMonths === 0 || turnMonths >= 99999) {
                  turnMonths = mSales > 0 ? parseFloat(((inv.total_qty + importQty) / mSales).toFixed(1)) : 99999;
                }

                const singleCubicFeet = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
                const importCubicFeet = parseFloat((singleCubicFeet * importQty).toFixed(2));
                const levelInfo = getTurnoverLevelInfo(turnMonths);

                const tags = [];
                if (noteInfo.is_gift) tags.push({ text: '🎁 贈品採購', type: 'info' });
                if (!inv.is_history_recorded && sales90 === 0 && age === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
                else if (inv.is_history_recorded && inv.total_qty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

                if (sales90 === 0 && importQty > 0 && !noteInfo.is_gift && inv.is_history_recorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
                else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

                if (turnMonths > 6 && !noteInfo.is_gift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
                if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

                // 🌟 1. 不合理類型複選比對
                let isMatchRule = false;
                if (ruleList.includes('all') || ruleList.length === 0 || ruleList.length === 4) {
                  isMatchRule = tags.length > 0;
                } else {
                  if (ruleList.includes('zero_sales') && tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'))) isMatchRule = true;
                  if (ruleList.includes('high_turnover') && tags.some(t => t.text.includes('迴轉月數過高'))) isMatchRule = true;
                  if (ruleList.includes('over_import') && tags.some(t => t.text.includes('爆量驗收') || t.text.includes('超量驗收'))) isMatchRule = true;
                  if (ruleList.includes('gift') && noteInfo.is_gift) isMatchRule = true;
                }

                // 🌟 2. 迴轉級距複選比對
                let isMatchLevel = false;
                if (levelList.includes('all') || levelList.length === 0 || levelList.length === 8) {
                  isMatchLevel = true;
                } else {
                  isMatchLevel = levelList.includes(levelInfo.code);
                }

                if (isMatchRule && isMatchLevel) {
                  abnormalRows.push({
                    ...r,
                    item_name: r.item_name || inv.item_name || '-',
                    current_stock_qty: inv.total_qty,
                    sales_90d: inv.sales_90d,
                    monthly_sales: inv.monthly_sales,
                    turn_days_total: turnMonths,
                    turnover_level: levelInfo.label,
                    age: inv.age,
                    supplier_name: inv.supplier_name,
                    pm: inv.pm,
                    is_gift: noteInfo.is_gift,
                    custom_remark: noteInfo.remark,
                    tags,
                    import_cubic_feet: importCubicFeet
                  });

                  totalAbnormalPcs += importQty;
                  totalAbnormalCubicFeet += importCubicFeet;
                  if (inv.pm && inv.pm !== '未指定PM') pmSet.add(inv.pm);
                }
              });

              res.json({
                success: true,
                summary: {
                  totalCount: abnormalRows.length,
                  totalPcs: totalAbnormalPcs,
                  totalCubicFeet: parseFloat(totalAbnormalCubicFeet.toFixed(2)),
                  pmCount: pmSet.size
                },
                data: abnormalRows
              });
            });
          });
        });
      });
    });
  });

  // 2. 快照清單查詢
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

  // 3. 儲存備註
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

  // 4. 週報分析
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

  // 5. 補結算快照
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

      const targetItemIds = Array.from(new Set(inboundRows.map(r => normalizeKey(r.item_id)).filter(Boolean)));
      const placeholders = targetItemIds.map(() => '?').join(',');

      db.all(`SELECT * FROM item_sales_history WHERE item_id IN (${placeholders})`, targetItemIds, (errH, rowsH) => {
        db.all(`SELECT * FROM item_custom_notes WHERE item_id IN (${placeholders})`, targetItemIds, (errN, rowsN) => {
          db.all(`SELECT * FROM inventory WHERE item_id IN (${placeholders})`, targetItemIds, (err80, rows80) => {
            db.all(`SELECT * FROM inventory_15 WHERE item_id IN (${placeholders})`, targetItemIds, (err15, rows15) => {
              const notesMap = new Map();
              (rowsN || []).forEach(n => {
                const k = normalizeKey(n.item_id);
                if (k) notesMap.set(k, { is_gift: Number(n.is_gift) === 1, remark: n.remark || '' });
              });

              const invMap = new Map();
              (rowsH || []).forEach(row => {
                const k = normalizeKey(row.item_id);
                if (!k) return;
                invMap.set(k, {
                  total_qty: Number(row.total_stock_qty || row.stock_qty_80 || 0),
                  sales_90d: Number(row.sales_90d || 0),
                  monthly_sales: Number(row.monthly_sales || 0),
                  turn_days_total: 0, age: 0, is_history_recorded: true,
                  supplier_name: String(row.supplier_name || '').trim() || '未知供應商',
                  pm: String(row.pm || '').trim() || '未指定PM'
                });
              });

              const mergeInv = (row) => {
                const k = normalizeKey(row.item_id || row['商品ID']);
                if (!k) return;
                const locQty = Number(row.qty || row['儲位庫存數']) || 0;
                const rawTotal = Number(row.total_qty || row['總庫存數']) || 0;
                const s90 = Number(row.sales_90d || row['(近)90日銷量']) || 0;
                const mSales = Number(row.monthly_sales || row['(近)月銷量']) || 0;
                const turnM = Number(row.turn_days_total || row['總庫存_迴轉天數']) || 0;
                const ageVal = Number(row.age || row['庫齡']) || 0;
                const pmVal = String(row.pm || row['所屬PM'] || '').trim();
                const suppVal = String(row.supplier_name || row['供應商名稱'] || '').trim();

                if (invMap.has(k)) {
                  const exist = invMap.get(k);
                  exist.total_qty = Math.max(exist.total_qty, rawTotal, locQty);
                  exist.sales_90d = Math.max(exist.sales_90d, s90);
                  exist.monthly_sales = Math.max(exist.monthly_sales, mSales);
                  exist.age = Math.max(exist.age, ageVal);
                  exist.turn_days_total = Math.max(exist.turn_days_total, turnM);
                  if ((!exist.pm || exist.pm === '未指定PM') && pmVal) exist.pm = pmVal;
                  if ((!exist.supplier_name || exist.supplier_name === '未知供應商') && suppVal) exist.supplier_name = suppVal;
                } else {
                  invMap.set(k, {
                    total_qty: Math.max(rawTotal, locQty), sales_90d: s90, monthly_sales: mSales,
                    turn_days_total: turnM, age: ageVal, is_history_recorded: false,
                    supplier_name: suppVal || '未知供應商', pm: pmVal || '未指定PM'
                  });
                }
              };

              (rows80 || []).forEach(mergeInv);
              (rows15 || []).forEach(mergeInv);

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
                    abnormal_tags = EXCLUDED.abnormal_tags
                `);

                let snapCount = 0;
                inboundRows.forEach(r => {
                  const k = normalizeKey(r.item_id);
                  const noteInfo = notesMap.get(k) || { is_gift: false };
                  const inv = invMap.get(k) || {
                    total_qty: 0, sales_90d: 0, monthly_sales: 0, turn_days_total: 99999,
                    age: 0, is_history_recorded: false, supplier_name: '未知供應商', pm: '未指定PM'
                  };

                  const importQty = Number(r.import_qty) || 0;
                  const sales90 = Number(inv.sales_90d) || 0;
                  const mSales = Number(inv.monthly_sales) || 0;
                  const age = Number(inv.age) || 0;
                  const len = Number(r.length) || 0;
                  const w = Number(r.width) || 0;
                  const h = Number(r.height) || 0;

                  let turnMonths = inv.turn_days_total || 0;
                  if (turnMonths === 0 || turnMonths >= 99999) {
                    turnMonths = mSales > 0 ? parseFloat(((inv.total_qty + importQty) / mSales).toFixed(1)) : 99999;
                  }

                  const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
                  const importCf = parseFloat((singleCf * importQty).toFixed(2));
                  const levelInfo = getTurnoverLevelInfo(turnMonths);

                  const tags = [];
                  if (noteInfo.is_gift) tags.push({ text: '🎁 贈品採購', type: 'info' });
                  if (!inv.is_history_recorded && sales90 === 0 && age === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
                  else if (inv.is_history_recorded && inv.total_qty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

                  if (sales90 === 0 && importQty > 0 && !noteInfo.is_gift && inv.is_history_recorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
                  else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

                  if (turnMonths > 6 && !noteInfo.is_gift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
                  if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 爆量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

                  if (tags.length > 0) {
                    snapshotStmt.run(
                      r.rec_date, r.warehouse, r.rec_date, r.rec_time, r.po_no, r.batch_no,
                      r.item_id, r.item_name, importQty, len, w, h,
                      importCf, inv.total_qty, mSales, sales90,
                      turnMonths, levelInfo.label, age, inv.supplier_name, inv.pm,
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
  });

  return router;
};