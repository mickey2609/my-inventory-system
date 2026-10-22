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

  // 🌟【終極跨表對齊】/api/item-sales-history/sync-inbound-history
  // 同時跨 inbound_records 與 inbound_details 表抓取最新驗收日期
  router.all('/sync-inbound-history', (req, res) => {
    const syncSql = `
      UPDATE item_sales_history
      SET last_inbound_date = (
        SELECT MAX(d) FROM (
          SELECT COALESCE(rec_date, inbound_date, instore_date, record_date, '') as d
          FROM inbound_records
          WHERE UPPER(TRIM(item_id)) = UPPER(TRIM(item_sales_history.item_id))
             OR REPLACE(UPPER(TRIM(item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
             OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(item_id)) || '%')

          UNION ALL

          SELECT COALESCE(rec_date, inbound_date, instore_date, record_date, '') as d
          FROM inbound_details
          WHERE UPPER(TRIM(item_id)) = UPPER(TRIM(item_sales_history.item_id))
             OR REPLACE(UPPER(TRIM(item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
             OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(item_id)) || '%')
        )
      ),
      updated_at = DATETIME('now');
    `;

    db.run(syncSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '歷史進貨日期對齊失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功同步歷史進貨驗收日期！`
      });
    });
  });

  return router;
};