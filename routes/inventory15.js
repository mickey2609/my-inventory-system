// routes/inventory15.js
const express = require('express');
const router = express.Router();

function initInventory15Table(db) {
  db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL;`);
    db.run(`PRAGMA synchronous = OFF;`);
    db.run(`PRAGMA cache_size = -64000;`);

    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_15 (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, item_name TEXT, borrow_proc TEXT, location TEXT, qty REAL, age INTEGER,
        zone_id TEXT, zone_name TEXT, hall_id TEXT, hall_name TEXT, length REAL, width REAL, height REAL, weight REAL,
        monthly_sales REAL, pick_days_m REAL, sales_90d REAL, pick_days_90d REAL, supplier_id TEXT, supplier_name TEXT, pm TEXT,
        total_qty REAL, turn_days_total REAL, cubic_feet REAL, vol_type TEXT, loc_code_3 TEXT, loc_code_full TEXT, loc_code_5 TEXT,
        floor TEXT, floor_zone TEXT, loc_type TEXT, big_zone_id TEXT, big_zone TEXT, dim_sum REAL, max_dim REAL, min_dim REAL,
        loc_cubic_feet REAL, loc_health TEXT, non_compliant TEXT, vol_check TEXT, total_cubic_feet REAL, auto_type TEXT,
        shelf_level TEXT, age_bracket TEXT, floor_config TEXT, heavy_rack_check TEXT, assigned_floor TEXT, remark TEXT
      );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_inv15_item_id ON inventory_15(item_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inv15_location ON inventory_15(location);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inv15_big_zone ON inventory_15(big_zone);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inv15_zone_name ON inventory_15(zone_name);`);
  });
}

module.exports = function(db) {
  initInventory15Table(db);

  // [POST] /api/inventory15/upload
  router.post('/upload', (req, res) => {
    try {
      const { items, isFirstChunk } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: '上傳資料格式無效' });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        if (isFirstChunk) db.run('DELETE FROM inventory_15');

        const stmt = db.prepare(`
          INSERT INTO inventory_15 (
            item_id, item_name, borrow_proc, location, qty, age,
            zone_id, zone_name, hall_id, hall_name, length, width, height, weight,
            monthly_sales, pick_days_m, sales_90d, pick_days_90d, supplier_id, supplier_name, pm,
            total_qty, turn_days_total, cubic_feet, vol_type, loc_code_3, loc_code_full, loc_code_5,
            floor, floor_zone, loc_type, big_zone_id, big_zone, dim_sum, max_dim, min_dim,
            loc_cubic_feet, loc_health, non_compliant, vol_check, total_cubic_feet, auto_type,
            shelf_level, age_bracket, floor_config, heavy_rack_check, assigned_floor, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const getField = (...keys) => {
            if (!item || typeof item !== 'object') return '';
            for (const k of keys) {
              if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') return String(item[k]).trim();
            }
            return '';
          };

          const itemId = getField('item_id', '商品ID', '商品Id', 'itemId', 'ITEM_ID');
          if (!itemId || itemId === '-' || itemId === '0') continue;

          const getNum = (...keys) => {
            const val = getField(...keys);
            return val ? (parseFloat(String(val).replace(/,/g, '')) || 0) : 0;
          };

          const qtyVal = getNum('qty', '儲位庫存數', '儲位庫存', '庫存數');
          const cubicFeetVal = getNum('cubic_feet', '才數', '單才數', '單件才數');
          
          // 🌟 1. 計算該列正確的總才數寫入資料庫
          const correctTotalCubic = cubicFeetVal * qtyVal;

          stmt.run([
            itemId,
            getField('item_name', '商品名稱', '品名'),
            getField('borrow_proc', '借/採', '借採'),
            getField('location', '儲位', '儲位編號'),
            qtyVal,
            parseInt(getField('age', '庫齡') || 0, 10),
            getField('zone_id', '區編', '區編號', '區域編號'),
            getField('zone_name', '區名', '區域名稱'),
            getField('hall_id', '館編', '館編號'),
            getField('hall_name', '館名', '館別'),
            getNum('length', '長(cm)', '長'),
            getNum('width', '寬(cm)', '寬'),
            getNum('height', '高(cm)', '高'),
            getNum('weight', '重量(kg)', '重量'),
            getNum('monthly_sales', '(近)月銷量', '月銷量'),
            getNum('pick_days_m', '(近)月-有揀貨單天數', '月揀貨單天數'),
            getNum('sales_90d', '(近)90日銷量', '90日銷量'),
            getNum('pick_days_90d', '(近)90日-有揀貨單天數', '90日揀貨單天數'),
            getField('supplier_id', '供應商ID', '廠商ID'),
            getField('supplier_name', '供應商名稱', '廠商名稱'),
            getField('pm', '所屬PM', 'PM'),
            getNum('total_qty', '總庫存數', '總庫存'),
            getNum('turn_days_total', '總庫存_迴轉天數', '迴轉天數'),
            cubicFeetVal,
            getField('vol_type', '材積別', '材積'),
            getField('loc_code_3', '儲位編碼-3', '儲位3'),
            getField('loc_code_full', '儲位編碼', '完整儲位編碼'),
            getField('loc_code_5', '儲位編碼5', '儲位5'),
            getField('floor', '樓層'),
            getField('floor_zone', '樓層區域', '樓層區'),
            getField('loc_type', '儲位型態', '儲位類型'),
            getField('big_zone_id', '大區編', '大區ID', '大區編號'),
            getField('big_zone', '大區名', '大區', '大區名稱'),
            getNum('dim_sum', '三邊長', '三邊長(cm)'),
            getNum('max_dim', '最長邊', '最長邊(cm)'),
            getNum('min_dim', '最短邊', '最短邊(cm)'),
            getNum('loc_cubic_feet', '儲位才數'),
            getField('loc_health', '儲位健康度'),
            getField('non_compliant', '不符合'),
            getField('vol_check', '材積判斷'),
            correctTotalCubic,
            getField('auto_type', '人工/自動'),
            getField('shelf_level', '儲位層標示', '層標示'),
            getField('age_bracket', '庫齡級距', '庫齡段'),
            getField('floor_config', '樓層設定'),
            getField('heavy_rack_check', '重型架判斷'),
            getField('assigned_floor', 'ID指定樓層'),
            getField('remark', '備註', '說明')
          ], (err) => {
            if (err) console.error('⚠ 單筆寫入失敗：', err.message);
          });
        }

        stmt.finalize();
        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, count: items.length, message: 'latest_inventory15.csv 批次寫入成功！' });
        });
      });
    } catch (err) {
      db.run('ROLLBACK');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // [GET] /api/inventory15/search
  router.get('/search', (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '500', 10);
    const keyword = req.query.keyword || '';
    const categoryLarge = req.query.categoryLarge || '';
    const categorySmall = req.query.categorySmall || '';

    let whereConditions = [];
    let bindings = [];

    if (categoryLarge) { whereConditions.push("big_zone = ?"); bindings.push(categoryLarge); }
    if (categorySmall) { whereConditions.push("zone_name = ?"); bindings.push(categorySmall); }
    if (keyword) {
      whereConditions.push("(item_id LIKE ? OR item_name LIKE ? OR location LIKE ?)");
      bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    // 🌟 2. 徹底摒除舊髒數據干擾，直接採用 SUM(cubic_feet * qty) 精準算式！
    const summarySql = `
      SELECT 
        COUNT(DISTINCT CASE WHEN item_id IS NOT NULL AND item_id != '' AND item_id != '-' THEN item_id END) as total_items,
        COUNT(*) as total_rows,
        IFNULL(SUM(qty), 0) as total_pcs,
        IFNULL(SUM(CAST(cubic_feet AS REAL) * CAST(qty AS REAL)), 0) as total_ao
      FROM inventory_15 ${whereClause}
    `;

    db.get(summarySql, bindings, (err, summaryRow) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const totalCount = summaryRow ? summaryRow.total_rows : 0;

      const dataSql = `SELECT * FROM inventory_15 ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`;
      db.all(dataSql, [...bindings, pageSize, offset], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({
          success: true,
          total: totalCount,
          summary: { 
            total_items: summaryRow ? summaryRow.total_items : 0, 
            total_rows: totalCount, 
            total_pcs: summaryRow ? Math.round(summaryRow.total_pcs) : 0,
            total_ao: summaryRow ? parseFloat(summaryRow.total_ao.toFixed(2)) : 0
          },
          data: rows || []
        });
      });
    });
  });

  return router;
};