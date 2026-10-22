// C:\my-inventory-server\routes\itemSalesHistory.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 初始化建立 item_sales_history 資料表與索引
  db.serialize(() => {
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
  });

  // [ALL] /api/item-sales-history/fix-totals - 修正資料庫中現有總庫存數工具
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

  // [ALL] /api/item-sales-history/sync-15-stock - 一鍵將現有 15 庫存同步回歷史總表
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

  // [GET] /api/item-sales-history/list - 後端分頁查詢 API
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

  // [POST] /api/item-sales-history/sync-inbound - 進貨驗收時更新最後驗收日期
  router.post('/sync-inbound', (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未傳入有效的驗收資料' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO item_sales_history (item_id, last_inbound_date, updated_at)
        VALUES (?, ?, DATETIME('now'))
        ON CONFLICT(item_id) DO UPDATE SET
          last_inbound_date = CASE 
            WHEN EXCLUDED.last_inbound_date > IFNULL(item_sales_history.last_inbound_date, '') 
            THEN EXCLUDED.last_inbound_date 
            ELSE item_sales_history.last_inbound_date 
          END,
          updated_at = DATETIME('now')
      `);

      for (const item of items) {
        if (item.item_id && item.rec_date) {
          stmt.run(String(item.item_id).trim().toUpperCase(), String(item.rec_date).trim());
        }
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: '同步最後進貨日期失敗：' + err.message });
        res.json({ success: true, message: '最後驗收日期已成功同步至歷史總表！' });
      });
    });
  });

  // 🌟【精準解析包含 imported_at 欄位】/api/item-sales-history/sync-inbound-history
  router.all('/sync-inbound-history', (req, res) => {
    const syncSql = `
      UPDATE item_sales_history
      SET last_inbound_date = (
        SELECT MAX(d) FROM (
          SELECT COALESCE(
            NULLIF(rec_date,''), 
            NULLIF(recv_date,''), 
            NULLIF(put_date,''), 
            NULLIF(putaway_date,''), 
            NULLIF(SUBSTR(imported_at, 1, 10),''), 
            ''
          ) as d
          FROM inbound_details
          WHERE item_id IS NOT NULL AND item_id != ''
            AND (
              UPPER(TRIM(item_id)) = UPPER(TRIM(item_sales_history.item_id))
              OR REPLACE(UPPER(TRIM(item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
              OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(item_id)) || '%')
              OR UPPER(TRIM(item_id)) LIKE (UPPER(TRIM(item_sales_history.item_id)) || '%')
            )
        )
      ),
      updated_at = DATETIME('now')
      WHERE EXISTS (
        SELECT 1 FROM inbound_details
        WHERE item_id IS NOT NULL AND item_id != ''
          AND (
            UPPER(TRIM(item_id)) = UPPER(TRIM(item_sales_history.item_id))
            OR REPLACE(UPPER(TRIM(item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
            OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(item_id)) || '%')
            OR UPPER(TRIM(item_id)) LIKE (UPPER(TRIM(item_sales_history.item_id)) || '%')
          )
      )
    `;

    db.run(syncSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '進貨驗收日期對齊失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功完成進貨驗收日期對齊！共更新 ${this.changes} 筆商品。`
      });
    });
  });

  // 🔍 [GET] /api/item-sales-history/debug-inbound
  router.get('/debug-inbound', (req, res) => {
    const rawItemId = (req.query.item_id || 'DMAGV0-A900GHNYH-000').trim();
    const cleanItemId = rawItemId.split('-')[0];

    const checkSql = `
      SELECT * FROM inbound_details 
      WHERE item_id LIKE ? OR item_id LIKE ? OR item_id = ?
      LIMIT 20
    `;

    db.all(checkSql, [`%${cleanItemId}%`, `%${rawItemId}%`, rawItemId], (err, rows) => {
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