// C:\my-inventory-server\routes\itemSalesHistory.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 初始化建立 item_sales_history 資料表與索引
  db.serialize(() => {
    db.run(`PRAGMA busy_timeout = 10000;`);

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
        item_tag TEXT DEFAULT '主商品',
        remark TEXT DEFAULT '',
        is_confirmed INTEGER DEFAULT 0,
        confirmed_at TEXT,
        updated_at TEXT
      );
    `);

    // 自動擴充欄位（相容舊表）
    db.run(`ALTER TABLE item_sales_history ADD COLUMN item_tag TEXT DEFAULT '主商品'`, () => {});
    db.run(`ALTER TABLE item_sales_history ADD COLUMN remark TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE item_sales_history ADD COLUMN is_confirmed INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE item_sales_history ADD COLUMN confirmed_at TEXT`, () => {});

    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_sales_90d ON item_sales_history(sales_90d);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_pm ON item_sales_history(pm);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_last_date ON item_sales_history(last_record_date);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_item_tag ON item_sales_history(item_tag);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ish_confirmed ON item_sales_history(is_confirmed);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inbound_details_item_id ON inbound_details(item_id);`);
  });

  // [POST] 🌟 單筆更新商品屬性與自訂備註 (自動標記為已確認)
  router.post('/update-tag-remark', (req, res) => {
    const { item_id, item_tag, remark } = req.body;
    if (!item_id) {
      return res.status(400).json({ success: false, message: '缺少商品編號 (item_id)' });
    }

    const cleanTag = item_tag || '主商品';
    const cleanRemark = remark || '';

    const sql = `
      INSERT INTO item_sales_history (item_id, item_tag, remark, is_confirmed, confirmed_at, updated_at)
      VALUES (?, ?, ?, 1, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
      ON CONFLICT(item_id) DO UPDATE SET
        item_tag = excluded.item_tag,
        remark = excluded.remark,
        is_confirmed = 1,
        confirmed_at = DATETIME('now', 'localtime'),
        updated_at = DATETIME('now', 'localtime')
    `;

    db.run(sql, [item_id, cleanTag, cleanRemark], function(err) {
      if (err) return res.status(500).json({ success: false, message: '更新商品屬性失敗: ' + err.message });
      res.json({
        success: true,
        message: `🎉 商品 ${item_id} 已成功審核並標記為 [${cleanTag}]！`
      });
    });
  });

  // [POST] 🌟 批次更新商品屬性與自訂備註 (自動標記為已確認)
  router.post('/batch-update-tag-remark', (req, res) => {
    const { item_ids, item_tag, remark } = req.body;
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ success: false, message: '請至少選擇一筆商品' });
    }

    const cleanTag = item_tag || '主商品';
    const cleanRemark = remark !== undefined ? remark : '';

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO item_sales_history (item_id, item_tag, remark, is_confirmed, confirmed_at, updated_at)
        VALUES (?, ?, ?, 1, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
        ON CONFLICT(item_id) DO UPDATE SET
          item_tag = excluded.item_tag,
          remark = CASE WHEN ? != '' THEN excluded.remark ELSE item_sales_history.remark END,
          is_confirmed = 1,
          confirmed_at = DATETIME('now', 'localtime'),
          updated_at = DATETIME('now', 'localtime')
      `);

      for (const id of item_ids) {
        stmt.run(id, cleanTag, cleanRemark, cleanRemark);
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: '批次更新失敗: ' + err.message });
        }
        res.json({
          success: true,
          message: `🎉 成功完成 ${item_ids.length} 筆商品屬性審核並更新為 [${cleanTag}]！`
        });
      });
    });
  });

  // [POST] 🌟 批次一鍵確認為「主商品」
  router.post('/batch-confirm-main', (req, res) => {
    const { item_ids } = req.body;
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ success: false, message: '請至少選擇一筆商品' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO item_sales_history (item_id, item_tag, is_confirmed, confirmed_at, updated_at)
        VALUES (?, '主商品', 1, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
        ON CONFLICT(item_id) DO UPDATE SET
          item_tag = '主商品',
          is_confirmed = 1,
          confirmed_at = DATETIME('now', 'localtime'),
          updated_at = DATETIME('now', 'localtime')
      `);

      for (const id of item_ids) {
        stmt.run(id);
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: '確認失敗: ' + err.message });
        }
        res.json({
          success: true,
          message: `🎉 成功將 ${item_ids.length} 筆商品確認為 [主商品]！`
        });
      });
    });
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
    const tag = (req.query.tag || '').trim();
    const confirmStatus = (req.query.confirmStatus || '').trim(); // '0':未確認, '1':已確認, '':全部
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

    if (tag) {
      whereConditions.push(`item_tag = ?`);
      bindings.push(tag);
    }

    // 🌟 審核確認狀態過濾
    if (confirmStatus === '0') {
      whereConditions.push(`IFNULL(is_confirmed, 0) = 0`);
    } else if (confirmStatus === '1') {
      whereConditions.push(`IFNULL(is_confirmed, 0) = 1`);
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
          monthly_sales, sales_90d, last_record_date, last_inbound_date,
          IFNULL(item_tag, '主商品') as item_tag,
          IFNULL(remark, '') as remark,
          IFNULL(is_confirmed, 0) as is_confirmed,
          confirmed_at,
          updated_at
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

  // 🌟【高效率索引批次同步】/api/item-sales-history/sync-inbound-history
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
           OR REPLACE(UPPER(TRIM(inbound_details.item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
           OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(inbound_details.item_id)) || '%')
           OR UPPER(TRIM(inbound_details.item_id)) LIKE (UPPER(TRIM(item_sales_history.item_id)) || '%')
      ),
      updated_at = DATETIME('now')
      WHERE EXISTS (
        SELECT 1 FROM inbound_details
        WHERE UPPER(TRIM(inbound_details.item_id)) = UPPER(TRIM(item_sales_history.item_id))
           OR REPLACE(UPPER(TRIM(inbound_details.item_id)), '-', '') = REPLACE(UPPER(TRIM(item_sales_history.item_id)), '-', '')
           OR UPPER(TRIM(item_sales_history.item_id)) LIKE (UPPER(TRIM(inbound_details.item_id)) || '%')
           OR UPPER(TRIM(inbound_details.item_id)) LIKE (UPPER(TRIM(item_sales_history.item_id)) || '%')
      )
    `;

    db.run(updateSql, [], function(err) {
      if (err) return res.status(500).json({ success: false, message: '同步失敗：' + err.message });
      res.json({
        success: true,
        message: `🎉 成功完成進貨驗收日期同步！共更新 ${this.changes} 筆商品。`
      });
    });
  });

  return router;
};