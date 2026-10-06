// C:\my-inventory-server\routes\turnover15.js
// 15庫 (自動化倉) 迴轉率分析專屬 API 路由模組
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // [GET] /api/turnover15/search
  router.get('/search', (req, res) => {
    try {
      const minTurnover = parseFloat(req.query.minTurnover || '90');
      const sortOrder = (req.query.sortOrder || 'desc').toLowerCase();

      // SQL：排除儲位前 3 碼為 80U 或 80Z 的紀錄
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
        FROM inventory_15
        WHERE item_id IS NOT NULL AND item_id != ''
          AND UPPER(SUBSTR(TRIM(location), 1, 3)) NOT IN ('80U', '80Z')
        GROUP BY item_id
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, message: '查詢 15 庫資料失敗：' + err.message });
        }

        rows = rows || [];

        let totalItems = 0;
        let totalPcs = 0;
        let totalVolume = 0;
        let totalPallets = 0;

        const tiers = {
          t91_180: { label: '91 ~ 180', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t181_270: { label: '181 ~ 270', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t271_365: { label: '271 ~ 365', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t365_plus: { label: '365 以上 (不含99999)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t99999: { label: '滯銷 99999', items: 0, pcs: 0, vol: 0, pallets: 0 }
        };

        const resultList = [];

        rows.forEach(r => {
          const qty = parseFloat(r.total_qty || 0);
          const sales = parseFloat(r.monthly_sales || 0);
          const unitVol = parseFloat(r.unit_cubic_feet || 0);

          let turnover = 99999;
          if (sales >= 0.0001) {
            turnover = parseFloat((qty / sales).toFixed(1));
          }

          if (turnover > minTurnover) {
            const totalVol = parseFloat((qty * unitVol).toFixed(6));
            const pallets = parseFloat((totalVol / 35).toFixed(6));

            const itemData = {
              item_id: r.item_id,
              item_name: r.item_name || '-',
              borrow_proc: r.borrow_proc || '-',
              total_qty: Math.round(qty),
              max_age: parseInt(r.max_age || 0, 10),
              zone_id: r.zone_id || '-',
              zone_name: r.zone_name || '-',
              total_cubic_feet: totalVol,
              turnover_month: turnover,
              monthly_sales: Math.round(sales),
              pallets: pallets
            };

            resultList.push(itemData);

            totalItems += 1;
            totalPcs += qty;
            totalVolume += totalVol;
            totalPallets += pallets;

            if (turnover === 99999) {
              tiers.t99999.items += 1;
              tiers.t99999.pcs += qty;
              tiers.t99999.vol += totalVol;
              tiers.t99999.pallets += pallets;
            } else if (turnover > 365) {
              tiers.t365_plus.items += 1;
              tiers.t365_plus.pcs += qty;
              tiers.t365_plus.vol += totalVol;
              tiers.t365_plus.pallets += pallets;
            } else if (turnover > 270) {
              tiers.t271_365.items += 1;
              tiers.t271_365.pcs += qty;
              tiers.t271_365.vol += totalVol;
              tiers.t271_365.pallets += pallets;
            } else if (turnover > 180) {
              tiers.t181_270.items += 1;
              tiers.t181_270.pcs += qty;
              tiers.t181_270.vol += totalVol;
              tiers.t181_270.pallets += pallets;
            } else if (turnover >= 91) {
              tiers.t91_180.items += 1;
              tiers.t91_180.pcs += qty;
              tiers.t91_180.vol += totalVol;
              tiers.t91_180.pallets += pallets;
            }
          }
        });

        resultList.sort((a, b) => {
          return sortOrder === 'asc' ? a.pallets - b.pallets : b.pallets - a.pallets;
        });

        const formattedTiers = Object.keys(tiers).map(k => ({
          key: k,
          label: tiers[k].label,
          items: tiers[k].items,
          pcs: Math.round(tiers[k].pcs),
          vol: parseFloat(tiers[k].vol.toFixed(6)),
          pallets: parseFloat(tiers[k].pallets.toFixed(6))
        }));

        res.json({
          success: true,
          summary: {
            minTurnover,
            totalItems,
            totalPcs: Math.round(totalPcs),
            totalVolume: parseFloat(totalVolume.toFixed(6)),
            totalPallets: parseFloat(totalPallets.toFixed(6))
          },
          tiers: formattedTiers,
          data: resultList
        });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: '伺服器內部錯誤：' + err.message });
    }
  });

  return router;
};