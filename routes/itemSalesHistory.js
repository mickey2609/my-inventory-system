// C:\my-inventory-server\routes\itemSalesHistory.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 自動執行最後進貨驗收日期同步函式
  function autoSyncInbound() {
    const updateSql = `
      UPDATE item_sales_history
      SET last_inbound_date = (
        SELECT MAX(COALESCE(
          NULLIF(rec_date, ''),
          NULLIF(recv_date, ''),
          NULLIF(put_date, ''),
          NULLIF(putaway_date, ''),
          NULLIF(SUBSTR(imported_at, 1, 10), '')
        ))
        FROM inbound_details
        WHERE UPPER(TRIM(inbound_details.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      ),
      updated_at = DATETIME('now')
      WHERE EXISTS (
        SELECT 1 FROM inbound_details
        WHERE UPPER(TRIM(inbound_details.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      );
    `;

    db.run(updateSql, [], function(err) {
      if (err) {
        console.error('⚠️ [自動同步進貨日期失敗]:', err.message);
      } else {
        console.log(`✅ [自動同步進貨日期成功]: 共更新 ${this.changes} 筆商品驗收日期！`);
      }
    });
  }

  // 初始化建立 item_sales_history 資料表、索引與觸發自動同步
  db.serialize(() => {
    db.run(`PRAGMA busy_timeout = 15000;`);

    db.run(`
      CREATE TABLE IF NOT EXISTS item_sales_history (
        item_id TEXT PRIMARY KEY,
        item_name TEXT,
        pm TEXT,
        supplier_name TEXT,
        stock_qty_80 REAL DEFAULT 0,
        stock_qty_15 REAL DEFAULT 0,
        total_stock_qty REAL DEFAULT 0,
        monthly_sales REAL DEFAULT 0,
        sales_90d REAL DEFAULT 0,
        last_record_date TEXT,
        last_inbound_date TEXT,
        updated_at TEXT
      );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_sales_90d ON item_sales_history(sales_90d);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_pm ON item_sales_history(pm);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_last_date ON item_sales_history(last_record_date);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inbound_details_item_id ON inbound_details(item_id);`);

    // 啟動完成後自動於背景執行一次對齊更新
    autoSyncInbound();
  });

  // [ALL] /api/item-sales-history/fix-totals
  router.all('/fix-totals', (req, res) => {
    const fixSql = `
      UPDATE item_sales_history
      SET total_stock_qty = IFNULL(stock_qty_80, 0) + IFNULL(stock_qty_15, 0),
          updated_at = DATETIME('now')
    `;
    db.run(fixSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '修復總庫存失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功重新校正全量總庫存數！共修復 ${this.changes} 筆商品。`
      });
    });
  });

  // [ALL] /api/item-sales-history/sync-15-stock
  router.all('/sync-15-stock', (req, res) => {
    const syncSql = `
      UPDATE item_sales_history
      SET stock_qty_15 = IFNULL((
        SELECT SUM(qty) 
        FROM inventory_15 
        WHERE UPPER(TRIM(inventory_15.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      ), 0),
      total_stock_qty = IFNULL(stock_qty_80, 0) + IFNULL((
        SELECT SUM(qty) 
        FROM inventory_15 
        WHERE UPPER(TRIM(inventory_15.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      ), 0),
      updated_at = DATETIME('now')
    `;

    db.run(syncSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '同步 15 庫存失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功完成 15 庫存數據同步！共更新 ${this.changes} 筆商品的 15 庫存數。`
      });
    });
  });

  // ⚡【極速查詢】/api/item-sales-history/list
  router.get('/list', (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '500', 10);
    const keyword = (req.query.keyword || '').trim();
    const pm = (req.query.pm || '').trim();
    const filterZeroSales = req.query.filterZeroSales === 'true';
    const filterOutOfStock = req.query.filterOutOfStock === 'true';

    let whereConditions = [];
    let bindings = [];

    if (keyword) {
      whereConditions.push(`(item_id LIKE ? OR item_name LIKE ? OR supplier_name LIKE ?)`);
      bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (pm) {
      whereConditions.push(`pm = ?`);
      bindings.push(pm);
    }

    if (filterZeroSales) {
      whereConditions.push(`sales_90d = 0`);
    }

    if (filterOutOfStock) {
      whereConditions.push(`(IFNULL(stock_qty_80, 0) + IFNULL(stock_qty_15, 0)) = 0`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) as total FROM item_sales_history ${whereClause}`;
    db.get(countSql, bindings, (err, countRow) => {
      if (err) return res.status(500).json({ success: false, message: '讀取歷史資料筆數失敗：' + err.message });

      const totalCount = countRow ? countRow.total : 0;

      const listSql = `
        SELECT 
          item_id, item_name, pm, supplier_name,
          IFNULL(stock_qty_80, 0) as stock_qty_80,
          IFNULL(stock_qty_15, 0) as stock_qty_15,
          (IFNULL(stock_qty_80, 0) + IFNULL(stock_qty_15, 0)) as total_stock_qty,
          monthly_sales, sales_90d, last_record_date, last_inbound_date, updated_at
        FROM item_sales_history 
        ${whereClause} 
        ORDER BY last_record_date DESC, item_id ASC 
        LIMIT ? OFFSET ?
      `;

      db.all(listSql, [...bindings, pageSize, offset], (errList, rows) => {
        if (errList) return res.status(500).json({ success: false, message: '讀取歷史資料清單失敗：' + errList.message });

        res.json({
          success: true,
          total: totalCount,
          page,
          pageSize,
          data: rows || []
        });
      });
    });
  });

  // [ALL] 手動同步 API 端點
  router.all('/sync-inbound-history', (req, res) => {
    const updateSql = `
      UPDATE item_sales_history
      SET last_inbound_date = (
        SELECT MAX(COALESCE(
          NULLIF(rec_date, ''),
          NULLIF(recv_date, ''),
          NULLIF(put_date, ''),
          NULLIF(putaway_date, ''),
          NULLIF(SUBSTR(imported_at, 1, 10), '')
        ))
        FROM inbound_details
        WHERE UPPER(TRIM(inbound_details.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      ),
      updated_at = DATETIME('now')
      WHERE EXISTS (
        SELECT 1 FROM inbound_details
        WHERE UPPER(TRIM(inbound_details.item_id)) = UPPER(TRIM(item_sales_history.item_id))
      );
    `;

    db.run(updateSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '同步失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功完成進貨驗收日期同步！共更新 ${this.changes} 筆商品。`
      });
    });
  });

  // 🔍 [GET] /api/item-sales-history/peek-inbound
  router.get('/peek-inbound', (req, res) => {
    db.all("SELECT * FROM inbound_details ORDER BY rowid DESC LIMIT 5", [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({
        success: true,
        count: rows ? rows.length : 0,
        sample_rows: rows || []
      });
    });
  });

  // 🔍 [GET] /api/item-sales-history/debug-inbound
  router.get('/debug-inbound', (req, res) => {
    const rawItemId = (req.query.item_id || 'DFAT48-A900KHS7S-001').trim();
    const checkSql = `
      SELECT * FROM inbound_details 
      WHERE item_id LIKE ? OR item_id = ?
      LIMIT 20
    `;

    db.all(checkSql, [`%${rawItemId}%`, rawItemId], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({
        success: true,
        queried_item_id: rawItemId,
        match_count: rows ? rows.length : 0,
        matched_records: rows || []
      });
    });
  });

  return router;
};