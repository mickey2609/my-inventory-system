// C:\my-inventory-server\routes\inbound.js
// 進貨與新品上架魚群分析專屬 API 模組
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 1. 初始化建立進貨明細資料表 inbound_details
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS inbound_details (
        warehouse TEXT,
        rec_date TEXT,
        rec_time TEXT,
        put_date TEXT,
        put_time TEXT,
        batch_no TEXT,
        po_no TEXT,
        remark TEXT,
        item_id TEXT,
        item_name TEXT,
        qty REAL,
        length REAL,
        width REAL,
        height REAL,
        weight REAL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse, po_no, batch_no, item_id)
      )
    `);
  });

  // 2. 分批極速寫入與覆蓋更新 (Upsert) API
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'latest_inbound.csv';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的進貨明細資料' });
    }

    db.serialize(() => {
      db.run('PRAGMA synchronous = OFF');
      db.run('PRAGMA journal_mode = MEMORY');
      db.run('BEGIN TRANSACTION');

      // 若為第一批次，記錄匯入日誌
      if (isFirstChunk) {
        db.run(
          `INSERT INTO import_logs (module_type, file_name, row_count, imported_at) VALUES ('inbound', ?, ?, DATETIME('now'))`,
          [fileName, items.length]
        );
      }

      const stmt = db.prepare(`
        INSERT INTO inbound_details (
          warehouse, rec_date, rec_time, put_date, put_time,
          batch_no, po_no, remark, item_id, item_name,
          qty, length, width, height, weight
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, po_no, batch_no, item_id) DO UPDATE SET
          rec_date = EXCLUDED.rec_date,
          rec_time = EXCLUDED.rec_time,
          put_date = CASE WHEN EXCLUDED.put_date != '' THEN EXCLUDED.put_date ELSE inbound_details.put_date END,
          put_time = CASE WHEN EXCLUDED.put_time != '' THEN EXCLUDED.put_time ELSE inbound_details.put_time END,
          remark = EXCLUDED.remark,
          qty = EXCLUDED.qty,
          length = EXCLUDED.length,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          weight = EXCLUDED.weight,
          imported_at = CURRENT_TIMESTAMP
      `);

      let processedCount = 0;
      for (const item of items) {
        const getVal = (...keys) => {
          if (!item || typeof item !== 'object') return '';
          for (const k of keys) {
            if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
              return String(item[k]).trim();
            }
          }
          return '';
        };

        const getNum = (...keys) => {
          const v = getVal(...keys);
          return v ? (parseFloat(v.replace(/,/g, '')) || 0) : 0;
        };

        const warehouse = getVal('warehouse', '庫別') || '80';
        const rec_date = getVal('rec_date', '驗收日期');
        const rec_time = getVal('rec_time', '驗收時間');
        const put_date = getVal('put_date', '上架日期');
        const put_time = getVal('put_time', '上架時間');
        const batch_no = getVal('batch_no', '驗收批號');
        const po_no = getVal('po_no', '進貨單號');
        const remark = getVal('remark', '收貨備註');
        const item_id = getVal('item_id', '商品編號', '商品ID');
        const item_name = getVal('item_name', '商品名稱');
        const qty = getNum('qty', '驗收數量');
        const length = getNum('length', '長(cm)');
        const width = getNum('width', '寬(cm)');
        const height = getNum('height', '高(cm)');
        const weight = getNum('weight', '重量(kg)');

        if (po_no || batch_no || item_id) {
          stmt.run(
            warehouse, rec_date, rec_time, put_date, put_time,
            batch_no, po_no, remark, item_id, item_name,
            qty, length, width, height, weight
          );
          processedCount++;
        }
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '進貨資料寫入失敗：' + err.message });
        res.json({ success: true, count: processedCount, message: `成功更新與處理 ${processedCount} 筆進貨資料！` });
      });
    });
  });

  // 3. 取得「尚未上架」按驗收日期統計的摘要清單
  router.get('/pending-putaway', (req, res) => {
    const sql = `
      SELECT 
        rec_date,
        COUNT(*) as pending_count,
        IFNULL(SUM(qty), 0) as total_qty
      FROM inbound_details
      WHERE (put_date IS NULL OR put_date = '')
        AND rec_date IS NOT NULL AND rec_date != ''
      GROUP BY rec_date
      ORDER BY rec_date DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, pendingSummary: rows || [] });
    });
  });

  // 4. 魚群分析數據計算 API
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, warehouse, remarks } = req.query;

    let sql = `SELECT * FROM inbound_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (rec_date = ? OR put_date = ?)`;
      params.push(targetDate, targetDate);
    }

    if (warehouse && warehouse !== 'all') {
      sql += ` AND warehouse = ?`;
      params.push(warehouse);
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];

      const remarkList = Array.isArray(remarks) ? remarks : (remarks || '').split(',').map(s => s.trim()).filter(Boolean);

      const filteredRows = rows.filter(r => {
        if (!remarkList.length) return true;

        const rem = (r.remark || '').trim();
        let matched = false;

        if (remarkList.includes('15') && (rem.includes('15庫') || rem.includes('原15庫'))) matched = true;
        if (remarkList.includes('empty') && rem === '') matched = true;
        if (remarkList.includes('abnormal') && rem !== '' && !rem.includes('15庫')) matched = true;

        return matched;
      });

      const hourlyStats = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        recPoCount: 0,
        recPoPcs: 0,
        putPoCount: 0,
        putPoPcs: 0,
        recBatCount: 0,
        putBatCount: 0
      }));

      filteredRows.forEach(r => {
        if (r.rec_date === targetDate && r.rec_time) {
          const hStr = r.rec_time.split(':')[0];
          const h = parseInt(hStr, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            hourlyStats[h].recPoCount += 1;
            hourlyStats[h].recPoPcs += (r.qty || 0);
            if (r.batch_no) hourlyStats[h].recBatCount += 1;
          }
        }

        if (r.put_date === targetDate && r.put_time) {
          const hStr = r.put_time.split(':')[0];
          const h = parseInt(hStr, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            hourlyStats[h].putPoCount += 1;
            hourlyStats[h].putPoPcs += (r.qty || 0);
            if (r.batch_no) hourlyStats[h].putBatCount += 1;
          }
        }
      });

      res.json({
        success: true,
        totalFiltered: filteredRows.length,
        hourlyStats
      });
    });
  });

  return router;
};