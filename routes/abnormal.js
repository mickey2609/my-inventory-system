// C:\my-inventory-server\routes\abnormal.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // [GET] 不合理進貨清單查詢 API
  router.get('/list', (req, res) => {
    const { startDate, endDate, warehouse, ruleType } = req.query;

    let sql = `
      SELECT 
        i.warehouse,
        i.rec_date,
        i.rec_time,
        i.po_no,
        i.batch_no,
        i.item_id,
        i.item_name,
        i.qty AS import_qty,
        i.length,
        i.width,
        i.height,
        i.remark,
        inv.total_qty AS current_stock_qty,
        IFNULL(inv.sales_90d, 0) AS sales_90d,
        IFNULL(inv.monthly_sales, 0) AS monthly_sales,
        IFNULL(inv.turn_days_total, 0) AS turn_days_total,
        IFNULL(inv.age, 0) AS age,
        IFNULL(inv.supplier_name, '未知供應商') AS supplier_name,
        IFNULL(inv.pm, '未指定PM') AS pm
      FROM inbound_details i
      LEFT JOIN inventory inv ON i.item_id = inv.item_id
      WHERE 1=1
    `;

    const params = [];

    if (startDate && endDate) {
      sql += ` AND i.rec_date >= ? AND i.rec_date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND i.rec_date = ?`;
      params.push(startDate);
    }

    if (warehouse && warehouse !== 'all') {
      sql += ` AND i.warehouse = ?`;
      params.push(warehouse);
    }

    sql += ` ORDER BY i.rec_date DESC, i.rec_time DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: '查詢不合理進貨失敗：' + err.message });

      rows = rows || [];

      // 進行不合理規則判定
      const abnormalRows = [];
      let totalAbnormalPcs = 0;
      let totalAbnormalCubicFeet = 0;
      const pmSet = new Set();

      rows.forEach(r => {
        const importQty = r.import_qty || 0;
        const sales90 = r.sales_90d || 0;
        const turnDays = r.turn_days_total || 0;
        const age = r.age || 0;
        const len = r.length || 0;
        const w = r.width || 0;
        const h = r.height || 0;

        // 計算該筆驗收總才數
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

        // 規則 3：單次驗收超過近90日銷量 2 倍以上
        if (sales90 > 0 && importQty >= (sales90 * 2)) {
          tags.push({ text: `⚠️ 超量驗收 (進貨>90日銷量2倍)`, type: 'warning' });
        }

        // 規則 4：才數/規格資料缺失
        if (len === 0 || w === 0 || h === 0) {
          tags.push({ text: 'ℹ️ 材積長寬高未填', type: 'info' });
        }

        // 依據篩選條件 (ruleType) 進行過濾
        let isMatchRule = false;
        if (!ruleType || ruleType === 'all') {
          isMatchRule = tags.length > 0; // 只要有任意不合理標籤即符合
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
          r.tags = tags;
          r.import_cubic_feet = importCubicFeet;
          abnormalRows.push(r);

          totalAbnormalPcs += importQty;
          totalAbnormalCubicFeet += importCubicFeet;
          if (r.pm) pmSet.add(r.pm);
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

  return router;
};