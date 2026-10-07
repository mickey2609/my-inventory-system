// C:\my-inventory-server\routes\turnover80.js
// 80庫 (人工倉) 迴轉率分析專屬 API 路由模組 (含分頁、級距過濾與筆數上限)
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // [GET] /api/turnover80/search
  router.get('/search', (req, res) => {
    try {
      const minTurnover = parseFloat(req.query.minTurnover || '90');
      const sortOrder = (req.query.sortOrder || 'desc').toLowerCase();
      // 筆數上限 (預設 500，手動可調 1 ~ 10000)
      const limitCount = Math.min(Math.max(parseInt(req.query.limit || '500', 10), 1), 10000);
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = parseInt(req.query.pageSize || '500', 10);
      const selectedTier = req.query.tier || 'all'; // all, t91_180, t181_270, t271_365, t365_plus, t99999

      // SQL：針對 80 庫 (inventory 表) 進行以 item_id 去重與加總
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
        if (err) {
          return res.status(500).json({ success: false, message: '查詢 80 庫資料失敗：' + err.message });
        }

        rows = rows || [];

        const tiers = {
          t91_180: { label: '91 ~ 180', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t181_270: { label: '181 ~ 270', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t271_365: { label: '271 ~ 365', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t365_plus: { label: '365 以上 (不含99999)', items: 0, pcs: 0, vol: 0, pallets: 0 },
          t99999: { label: '滯銷 99999', items: 0, pcs: 0, vol: 0, pallets: 0 }
        };

        const allMatchedList = [];

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

            let tierKey = '';
            if (turnover === 99999) {
              tierKey = 't99999';
              tiers.t99999.items += 1;
              tiers.t99999.pcs += qty;
              tiers.t99999.vol += totalVol;
              tiers.t99999.pallets += pallets;
            } else if (turnover > 365) {
              tierKey = 't365_plus';
              tiers.t365_plus.items += 1;
              tiers.t365_plus.pcs += qty;
              tiers.t365_plus.vol += totalVol;
              tiers.t365_plus.pallets += pallets;
            } else if (turnover > 270) {
              tierKey = 't271_365';
              tiers.t271_365.items += 1;
              tiers.t271_365.pcs += qty;
              tiers.t271_365.vol += totalVol;
              tiers.t271_365.pallets += pallets;
            } else if (turnover > 180) {
              tierKey = 't181_270';
              tiers.t181_270.items += 1;
              tiers.t181_270.pcs += qty;
              tiers.t181_270.vol += totalVol;
              tiers.t181_270.pallets += pallets;
            } else if (turnover >= 91) {
              tierKey = 't91_180';
              tiers.t91_180.items += 1;
              tiers.t91_180.pcs += qty;
              tiers.t91_180.vol += totalVol;
              tiers.t91_180.pallets += pallets;
            }

            // 根據選取的級距進行篩選
            if (selectedTier === 'all' || selectedTier === tierKey) {
              allMatchedList.push({
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
                pallets: pallets,
                tier_key: tierKey
              });
            }
          }
        });

        // 1. 板數排序 (預設降冪 desc: 大到小)
        allMatchedList.sort((a, b) => {
          return sortOrder === 'asc' ? a.pallets - b.pallets : b.pallets - a.pallets;
        });

        // 2. 截取設定的上限制 N 筆 (limitCount)
        const cappedList = allMatchedList.slice(0, limitCount);

        // 3. 計算摘要統計 (基於截取後的 Top N 資料)
        let totalItems = cappedList.length;
        let totalPcs = 0, totalVolume = 0, totalPallets = 0;
        cappedList.forEach(item => {
          totalPcs += item.total_qty;
          totalVolume += item.total_cubic_feet;
          totalPallets += item.pallets;
        });

        // 4. 計算當前頁碼數據切片 (Page & PageSize)
        const totalRows = cappedList.length;
        const offset = (page - 1) * pageSize;
        const pagedData = cappedList.slice(offset, offset + pageSize);

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
            limitCount,
            totalItems,
            totalPcs: Math.round(totalPcs),
            totalVolume: parseFloat(totalVolume.toFixed(6)),
            totalPallets: parseFloat(totalPallets.toFixed(6))
          },
          tiers: formattedTiers,
          pagination: {
            page,
            pageSize,
            totalRows
          },
          data: pagedData,
          exportData: cappedList // 供匯出全量 Excel 使用 (前 N 筆)
        });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: '伺服器內部錯誤：' + err.message });
    }
  });

  return router;
};