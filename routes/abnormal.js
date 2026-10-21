// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const normalizeKey = (str) => {
    if (!str) return '';
    return String(str).trim().toUpperCase().replace(/\s+/g, '');
  };

  // 🌟 核心：細分 3個月、3~6個月、6~9個月、9~12個月
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

  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleType, turnoverLevel, limit } = req.query;
    const maxLimit = Number(limit) || 10000; // 預設 10,000 筆

    try {
      const inv80Sql = `SELECT * FROM inventory`;
      const inv15Sql = `SELECT * FROM inventory_15`;
      const inv15AltSql = `SELECT * FROM inventory15`;

      db.all(inv80Sql, [], (err80, rows80) => {
        if (err80) console.error('80庫主檔查詢警告：', err80.message);

        db.all(inv15Sql, [], (err15, rows15) => {
          if (err15) {
            db.all(inv15AltSql, [], (err15Alt, rows15Alt) => {
              const valid15Rows = err15Alt ? [] : (rows15Alt || []);
              processAllInventory(rows80 || [], valid15Rows);
            });
          } else {
            processAllInventory(rows80 || [], rows15 || []);
          }
        });
      });

      function processAllInventory(validRows80, validRows15) {
        const invMap = new Map();

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
            existing.calc_loc_sum += locQty;
            existing.total_qty = Math.max(existing.total_qty, rawTotalQty, existing.calc_loc_sum);

            existing.sales_90d = Math.max(existing.sales_90d, sales90);
            existing.monthly_sales = Math.max(existing.monthly_sales, salesMonth);
            existing.age = Math.max(existing.age, ageVal);
            existing.turn_days_total = Math.max(existing.turn_days_total, turnMonths);
            if ((!existing.pm || existing.pm === '未指定PM') && pmVal) existing.pm = pmVal;
            if ((!existing.supplier_name || existing.supplier_name === '未知供應商') && suppVal) existing.supplier_name = suppVal;
          } else {
            invMap.set(key, {
              item_id: key,
              calc_loc_sum: locQty,
              total_qty: Math.max(rawTotalQty, locQty),
              sales_90d: sales90,
              monthly_sales: salesMonth,
              turn_days_total: turnMonths,
              age: ageVal,
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
            if (!invMap.has(key)) return;

            const inv = invMap.get(key);
            const importQty = Number(r.import_qty) || 0;
            const sales90 = Number(inv.sales_90d) || 0;
            const turnMonths = Number(inv.turn_days_total) || 0;
            const age = Number(inv.age) || 0;
            const len = Number(r.length) || 0;
            const w = Number(r.width) || 0;
            const h = Number(r.height) || 0;

            const singleCubicFeet = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
            const importCubicFeet = parseFloat((singleCubicFeet * importQty).toFixed(2));

            const levelInfo = getTurnoverLevelInfo(turnMonths);

            const tags = [];
            if (sales90 === 0 && importQty > 0) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
            else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

            if (turnMonths > 6) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths}個月)`, type: 'warning' });
            if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 超量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

            let isMatchRule = false;
            if (!ruleType || ruleType === 'all') isMatchRule = tags.length > 0;
            else if (ruleType === 'zero_sales') isMatchRule = tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'));
            else if (ruleType === 'high_turnover') isMatchRule = tags.some(t => t.text.includes('迴轉月數過高'));
            else if (ruleType === 'over_import') isMatchRule = tags.some(t => t.text.includes('超量驗收'));

            let isMatchLevel = false;
            if (!turnoverLevel || turnoverLevel === 'all') {
              isMatchLevel = true;
            } else {
              isMatchLevel = (levelInfo.code === turnoverLevel);
            }

            if (isMatchRule && isMatchLevel) {
              abnormalRows.push({
                ...r,
                current_stock_qty: inv.total_qty,
                sales_90d: inv.sales_90d,
                monthly_sales: inv.monthly_sales,
                turn_days_total: inv.turn_days_total,
                turnover_level: levelInfo.label,
                age: inv.age,
                supplier_name: inv.supplier_name,
                pm: inv.pm,
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
      };
    } catch (e) {
      res.status(500).json({ success: false, message: '伺服器內部異常：' + e.message });
    }
  });

  return router;
};