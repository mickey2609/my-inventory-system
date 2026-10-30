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
    if (months >= 99999) {
      return { code: 'm99999', label: '🚨 99999 滯銷品' };
    } else if (months > 120) {
      return { code: 'gt120', label: '10 年以上 (>120個月)' };
    } else if (months >= 61) {
      return { code: 'm61_120', label: '5 年～10 年 (61~120個月)' };
    } else if (months >= 13) {
      return { code: 'm13_60', label: '1 年～5 年 (13~60個月)' };
    } else if (months >= 9) {
      return { code: 'm9_12', label: '9~12個月' };
    } else if (months >= 6) {
      return { code: 'm6_9', label: '6~9個月' };
    } else if (months >= 3) {
      return { code: 'm3_6', label: '3~6個月' };
    } else {
      return { code: 'le3', label: '<=3個月' };
    }
  };

  // 🌟 1. 取得不合理進貨清單 (含贈品註記、歷史快照、精準斷貨/新品判定)
  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleType, turnoverLevel, excludeGifts, limit } = req.query;
    const maxLimit = Number(limit) || 10000;

    try {
      const historySql = `SELECT * FROM item_sales_history`;
      const inv80Sql = `SELECT * FROM inventory`;
      const inv15Sql = `SELECT * FROM inventory_15`;
      const inv15AltSql = `SELECT * FROM inventory15`;
      const notesSql = `SELECT * FROM item_custom_notes`;

      db.all(historySql, [], (errHist, rowsHist) => {
        db.all(notesSql, [], (errNotes, rowsNotes) => {
          db.all(inv80Sql, [], (err80, rows80) => {
            db.all(inv15Sql, [], (err15, rows15) => {
              if (err15) {
                db.all(inv15AltSql, [], (err15Alt, rows15Alt) => {
                  const valid15Rows = err15Alt ? [] : (rows15Alt || []);
                  processAll(rowsHist || [], rowsNotes || [], rows80 || [], valid15Rows);
                });
              } else {
                processAll(rowsHist || [], rowsNotes || [], rows80 || [], rows15 || []);
              }
            });
          });
        });
      });

      function processAll(validHistRows, validNotesRows, validRows80, validRows15) {
        // 建立自訂備註與贈品 Map
        const notesMap = new Map();
        validNotesRows.forEach(n => {
          const k = normalizeKey(n.item_id);
          if (k) notesMap.set(k, { is_gift: Number(n.is_gift) === 1, remark: n.remark || '' });
        });

        // 建立庫存與銷量基準 Map
        const invMap = new Map();

        validHistRows.forEach(row => {
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
          const rawKey = row.item_id || row['商品ID'] || row.itemId;
          const key = normalizeKey(rawKey);
          if (!key) return;

          const locQty = Number(row.qty || row['儲位庫存數'] || row.loc_qty) || 0;
          const rawTotalQty = Number(row.total_qty || row['總庫存數']) || 0;
          const sales90 = Number(row.sales_90d || row['(近)90日銷量'] || row['90日銷量']) || 0;
          const salesMonth = Number(row.monthly_sales || row['(近)月銷量'] || row['月銷量']) || 0;
          const turnMonths = Number(row.turn_days_total || row['總庫存_迴轉天數'] || row['迴轉天數'] || row['迴轉月數']) || 0;
          const ageVal = Number(row.age || row['庫齡']) || 0;
          const pmVal = String(row.pm || row['所屬PM'] || row.PM || row['PM'] || '').trim();
          const suppVal = String(row.supplier_name || row['供應商名稱'] || row.supplierName || '').trim();

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
              last_record_date: '',
              is_history_recorded: false,
              supplier_name: suppVal || '未知供應商',
              pm: pmVal || '未指定PM'
            });
          }
        };

        validRows80.forEach(processInvRow);
        validRows15.forEach(processInvRow);

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

        db.all(inSql, params, (errIn, inboundRows) => {
          if (errIn) return res.status(500).json({ success: false, message: '進貨明細讀取失敗：' + errIn.message });

          const abnormalRows = [];
          let totalAbnormalPcs = 0;
          let totalAbnormalCubicFeet = 0;
          const pmSet = new Set();

          (inboundRows || []).forEach(r => {
            const key = normalizeKey(r.item_id);
            const noteInfo = notesMap.get(key) || { is_gift: false, remark: '' };

            // 若選擇排除贈品，則跳過
            if (excludeGifts === 'true' && noteInfo.is_gift) return;

            const inv = invMap.get(key) || {
              item_id: key,
              item_name: r.item_name || '',
              total_qty: 0,
              sales_90d: 0,
              monthly_sales: 0,
              turn_days_total: 99999,
              age: 0,
              last_record_date: '',
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
              if (mSales > 0) {
                turnMonths = parseFloat(((inv.total_qty + importQty) / mSales).toFixed(1));
              } else {
                turnMonths = 99999;
              }
            }

            const singleCubicFeet = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
            const importCubicFeet = parseFloat((singleCubicFeet * importQty).toFixed(2));
            const levelInfo = getTurnoverLevelInfo(turnMonths);

            const tags = [];

            // 🌟 判定規則細分 (融入贈品、新品、斷貨重進機制)
            if (noteInfo.is_gift) {
              tags.push({ text: '🎁 贈品採購', type: 'info' });
            }

            if (!inv.is_history_recorded && sales90 === 0 && age === 0) {
              tags.push({ text: '✨ 首次建檔新品', type: 'info' });
            } else if (inv.is_history_recorded && inv.total_qty === 0 && sales90 === 0) {
              tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });
            }

            if (sales90 === 0 && importQty > 0 && !noteInfo.is_gift && inv.is_history_recorded) {
              tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
            } else if (age >= 180) {
              tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });
            }

            if (turnMonths > 6 && !noteInfo.is_gift) {
              tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
            }
            if (sales90 > 0 && importQty >= (sales90 * 2)) {
              tags.push({ text: `⚠️ 超量驗收 (進貨>90日銷量2倍)`, type: 'warning' });
            }

            let isMatchRule = false;
            if (!ruleType || ruleType === 'all') isMatchRule = tags.length > 0;
            else if (ruleType === 'zero_sales') isMatchRule = tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'));
            else if (ruleType === 'high_turnover') isMatchRule = tags.some(t => t.text.includes('迴轉月數過高'));
            else if (ruleType === 'over_import') isMatchRule = tags.some(t => t.text.includes('超量驗收'));
            else if (ruleType === 'gift') isMatchRule = noteInfo.is_gift;

            let isMatchLevel = false;
            if (!turnoverLevel || turnoverLevel === 'all') {
              isMatchLevel = true;
            } else {
              isMatchLevel = (levelInfo.code === turnoverLevel);
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
      }
    } catch (e) {
      res.status(500).json({ success: false, message: '伺服器內部異常：' + e.message });
    }
  });

  // 🌟 2. 儲存/更新商品自訂備註與贈品狀態 API
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

  // 🌟 3. 每週一週報分析 API (回溯上週一至上週日的快照與判定數據)
  router.get('/weekly-summary', (req, res) => {
    const now = new Date();
    // 計算上週一與上週日日期
    const dayOfWeek = now.getDay() || 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6);
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek);

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const startStr = req.query.startDate || fmt(lastMonday);
    const endStr = req.query.endDate || fmt(lastSunday);

    const sql = `
      SELECT * FROM abnormal_purchase_history 
      WHERE rec_date >= ? AND rec_date <= ?
      ORDER BY rec_date DESC
    `;

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
        summary: {
          totalCount: rows.length,
          totalPcs,
          totalCubicFeet: parseFloat(totalCubicFeet.toFixed(2)),
          pmCount: Object.keys(pmStats).length
        },
        pmStats,
        data: rows
      });
    });
  });

  return router;
};