// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // [GET] 不合理進貨清單查詢 API (記憶體極速 Map 比對版)
  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleType } = req.query;

    try {
      // 1. 抓取庫存表的關鍵迴轉數據（轉成記憶體 Map 比對，避免資料庫交叉比對卡死）
      const invSql = `
        SELECT 
          item_id, 
          IFNULL(total_qty, 0) AS total_qty, 
          IFNULL(sales_90d, 0) AS sales_90d, 
          IFNULL(monthly_sales, 0) AS monthly_sales, 
          IFNULL(turn_days_total, 0) AS turn_days_total, 
          IFNULL(age, 0) AS age, 
          IFNULL(supplier_name, '未知供應商') AS supplier_name, 
          IFNULL(pm, '未指定PM') AS pm 
        FROM inventory
      `;

      db.all(invSql, [], (err, invRows) => {
        if (err) {
          return res.status(500).json({ success: false, message: '庫存主檔讀取失敗：' + err.message });
        }

        // 建置 item_id 快速雜湊表
        const invMap = new Map();
        (invRows || []).forEach(row => {
          if (row.item_id) {
            invMap.set(String(row.item_id).trim(), row);
          }
        });

        // 2. 抓取進貨明細表
        let inSql = `
          SELECT 
            warehouse, rec_date, rec_time, po_no, batch_no, item_id, item_name, 
            IFNULL(qty, 0) AS import_qty, 
            IFNULL(length, 0) AS length, 
            IFNULL(width, 0) AS width, 
            IFNULL(height, 0) AS height, 
            IFNULL(remark, '') AS remark
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

        inSql += ` ORDER BY rec_date DESC, rec_time DESC`;

        db.all(inSql, params, (err2, inboundRows) => {
          if (err2) {
            return res.status(500).json({ success: false, message: '進貨明細讀取失敗：' + err2.message });
          }

          inboundRows = inboundRows || [];
          const abnormalRows = [];
          let totalAbnormalPcs = 0;
          let totalAbnormalCubicFeet = 0;
          const pmSet = new Set();

          inboundRows.forEach(r => {
            const itemIdStr = String(r.item_id || '').trim();
            const inv = invMap.get(itemIdStr) || {
              total_qty: 0,
              sales_90d: 0,
              monthly_sales: 0,
              turn_days_total: 0,
              age: 0,
              supplier_name: '未知供應商',
              pm: '未指定PM'
            };

            const importQty = Number(r.import_qty) || 0;
            const sales90 = Number(inv.sales_90d) || 0;
            const turnDays = Number(inv.turn_days_total) || 0;
            const age = Number(inv.age) || 0;
            const len = Number(r.length) || 0;
            const w = Number(r.width) || 0;
            const h = Number(r.height) || 0;

            // 計算該筆驗收總才數: (長*寬*高 / 28317) * 數量
            const singleCubicFeet = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
            const importCubicFeet = parseFloat((singleCubicFeet * importQty).toFixed(2));

            const tags = [];

            // 規則 1：滯銷品/零銷量進貨
            if (sales90 === 0 && importQty > 0) {
              tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
            } else if (age >= 180) {
              tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });
            }

            // 規則 2：迴轉天數爆表 (> 180 天)
            if (turnDays > 180) {
              tags.push({ text: `⚠️ 迴轉率天數過高 (${turnDays}天)`, type: 'warning' });
            }

            // 規則 3：單次驗收超過近 90 日銷量 2 倍以上
            if (sales90 > 0 && importQty >= (sales90 * 2)) {
              tags.push({ text: `⚠️ 超量驗收 (進貨>90日銷量2倍)`, type: 'warning' });
            }

            // 規則 4：才數/規格資料缺失
            if (len === 0 || w === 0 || h === 0) {
              tags.push({ text: 'ℹ️ 材積長寬高未填', type: 'info' });
            }

            // 規則過濾判斷
            let isMatchRule = false;
            if (!ruleType || ruleType === 'all') {
              isMatchRule = tags.length > 0;
            } else if (ruleType === 'zero_sales') {
              isMatchRule = tags.some(t => t.text.includes('零銷量') || t.text.includes('滯銷'));
            } else if (ruleType === 'high_turnover') {
              isMatchRule = tags.some(t => t.text.includes('迴轉率天數過高'));
            } else if (ruleType === 'over_import') {
              isMatchRule = tags.some(t => t.text.includes('超量驗收'));
            } else if (ruleType === 'no_dim') {
              isMatchRule = tags.some(t => t.text.includes('材積長寬高未填'));
            }

            if (isMatchRule) {
              abnormalRows.push({
                ...r,
                current_stock_qty: inv.total_qty,
                sales_90d: inv.sales_90d,
                monthly_sales: inv.monthly_sales,
                turn_days_total: inv.turn_days_total,
                age: inv.age,
                supplier_name: inv.supplier_name,
                pm: inv.pm,
                tags,
                import_cubic_feet: importCubicFeet
              });

              totalAbnormalPcs += importQty;
              totalAbnormalCubicFeet += importCubicFeet;
              if (inv.pm) pmSet.add(inv.pm);
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
    } catch (e) {
      res.status(500).json({ success: false, message: '伺服器內部異常：' + e.message });
    }
  });

  return router;
};