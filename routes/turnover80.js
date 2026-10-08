// C:\my-inventory-server\routes\turnover80.js
// 80庫 (人工倉) 迴轉率/年限分析專屬 API 路由模組
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.get('/search', (req, res) => {
    try {
      const minTurnover = parseFloat(req.query.minTurnover || '0');
      const minAge = parseInt(req.query.minAge || '0', 10); // 🌟 追加庫齡門檻
      const sortOrder = (req.query.sortOrder || 'desc').toLowerCase();
      const limitCount = Math.min(Math.max(parseInt(req.query.limit || '500', 10), 1), 10000);
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = parseInt(req.query.pageSize || '500', 10);
      const selectedTier = req.query.tier || 'all'; 

      const sql = `
        SELECT 
          item_id,
          MAX(item_name) as item_name,
          MAX(borrow_proc) as borrow_proc,
          SUM(qty) as total_qty,
          MAX(age) as max_age,
          MAX(zone_id) as zone_id,
          MAX(zone_name) as zone_name,
          MAX(cubic_feet) as unit_cubic_feet,
          MAX(monthly_sales) as monthly_sales
        FROM inventory
        WHERE item_id IS NOT NULL AND item_id != ''
        GROUP BY item_id
      `;

      db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: '查詢 80 庫資料失敗：' + err.message });

        rows = rows || [];

        const tiers = {
          y_under_1: { key: 'y_under_1', label: '1 年以下 (<=12個月)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          y_1_5: { key: 'y_1_5', label: '1 年 ~ 5 年 (13~60個月)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          y_5_10: { key: 'y_5_10', label: '5 年 ~ 10 年 (61~120個月)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          y_over_10: { key: 'y_over_10', label: '10 年以上 (>120個月)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          y99999: { key: 'y99999', label: '🚨 99999 滯銷品', items: 0, pcs: 0, vol: 0, pallets: 0 }
        };

        const allMatchedList = [];

        rows.forEach(r => {
          const qty = parseFloat(r.total_qty || 0);
          const sales = parseFloat(r.monthly_sales || 0);
          const unitVol = parseFloat(r.unit_cubic_feet || 0);
          const maxAge = parseInt(r.max_age || 0, 10);

          let turnover = 99999;
          if (sales >= 0.0001) {
            turnover = parseFloat((qty / sales).toFixed(1));
          }

          // 🌟 同時過濾 迴轉(月)門檻 與 庫齡門檻
          if (turnover >= minTurnover && maxAge >= minAge) {
            const totalVol = parseFloat((qty * unitVol).toFixed(2));
            const pallets = parseFloat((totalVol / 35).toFixed(2));

            let tierKey = '';
            if (turnover === 99999) {
              tierKey = 'y99999';
            } else if (turnover > 120) {     // > 120個月
              tierKey = 'y_over_10';
            } else if (turnover > 60) {      // 61~120個月
              tierKey = 'y_5_10';
            } else if (turnover > 12) {      // 13~60個月
              tierKey = 'y_1_5';
            } else {                         // <= 12個月
              tierKey = 'y_under_1';
            }

            if (tierKey && tiers[tierKey]) {
              tiers[tierKey].items += 1;
              tiers[tierKey].pcs += qty;
              tiers[tierKey].vol += totalVol;
              tiers[tierKey].pallets += pallets;
            }

            if (selectedTier === 'all' || selectedTier === tierKey) {
              allMatchedList.push({
                item_id: r.item_id,
                item_name: r.item_name || '-',
                borrow_proc: r.borrow_proc || '-',
                total_qty: Math.round(qty),
                max_age: maxAge,
                zone_id: r.zone_id || '-',
                zone_name: r.zone_name || '-',
                total_cubic_feet: totalVol,
                turnover_month: turnover,
                monthly_sales: Math.round(sales),
                pallets: pallets,
                tier_key: tierKey
              });
            }
          }
        });

        allMatchedList.sort((a, b) => sortOrder === 'asc' ? a.pallets - b.pallets : b.pallets - a.pallets);

        const cappedList = allMatchedList.slice(0, limitCount);

        let totalItems = cappedList.length;
        let totalPcs = 0, totalVolume = 0, totalPallets = 0;
        cappedList.forEach(item => {
          totalPcs += item.total_qty;
          totalVolume += item.total_cubic_feet;
          totalPallets += item.pallets;
        });

        const totalRows = cappedList.length;
        const offset = (page - 1) * pageSize;
        const pagedData = cappedList.slice(offset, offset + pageSize);

        const filteredTiers = Object.keys(tiers)
          .filter(k => selectedTier === 'all' || selectedTier === k)
          .map(k => ({
            key: k,
            label: tiers[k].label,
            items: tiers[k].items,
            pcs: Math.round(tiers[k].pcs),
            vol: parseFloat(tiers[k].vol.toFixed(2)),
            pallets: parseFloat(tiers[k].pallets.toFixed(2))
          }));

        res.json({
          success: true,
          summary: {
            minTurnover,
            minAge,
            limitCount,
            totalItems,
            totalPcs: Math.round(totalPcs),
            totalVolume: parseFloat(totalVolume.toFixed(2)),
            totalPallets: parseFloat(totalPallets.toFixed(2))
          },
          tiers: filteredTiers,
          pagination: { page, pageSize, totalRows },
          data: pagedData,
          exportData: cappedList
        });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: '伺服器內部錯誤：' + err.message });
    }
  });

  return router;
};