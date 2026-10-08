// C:\my-inventory-server\routes\inbound.js
// 進貨與新品上架魚群分析專屬 API 模組
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

module.exports = function(db) {
  const router = express.Router();
  const upload = multer({ dest: 'uploads/' });

  // 1. 初始化建立進貨明細資料表 inbound_details
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

  // 2. CSV 上傳與覆蓋更新 (Upsert) API
  router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '未收到上傳檔案' });

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        // 自動對應 A~O 欄位
        const keys = Object.keys(data);
        const getVal = (idx) => (data[keys[idx]] || '').toString().trim();

        const warehouse = getVal(0) || '80';
        const rec_date = getVal(1);
        const rec_time = getVal(2);
        const put_date = getVal(3);
        const put_time = getVal(4);
        const batch_no = getVal(5);
        const po_no = getVal(6);
        const remark = getVal(7);
        const item_id = getVal(8);
        const item_name = getVal(9);
        const qty = parseFloat(getVal(10) || 0);
        const length = parseFloat(getVal(11) || 0);
        const width = parseFloat(getVal(12) || 0);
        const height = parseFloat(getVal(13) || 0);
        const weight = parseFloat(getVal(14) || 0);

        if (po_no || batch_no || item_id) {
          results.push({
            warehouse, rec_date, rec_time, put_date, put_time,
            batch_no, po_no, remark, item_id, item_name,
            qty, length, width, height, weight
          });
        }
      })
      .on('end', () => {
        fs.unlinkSync(req.file.path); // 刪除暫存檔

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
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

          results.forEach(r => {
            stmt.run([
              r.warehouse, r.rec_date, r.rec_time, r.put_date, r.put_time,
              r.batch_no, r.po_no, r.remark, r.item_id, r.item_name,
              r.qty, r.length, r.width, r.height, r.weight
            ]);
          });

          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: '寫入進貨資料失敗：' + err.message });
            }
            db.run('COMMIT');
            res.json({ success: true, message: `成功處理解析 ${results.length} 筆進貨資料！` });
          });
        });
      });
  });

  // 3. 取得「尚未上架」的按日期統計與明細 API
  router.get('/pending-putaway', (req, res) => {
    const summarySql = `
      SELECT 
        rec_date,
        COUNT(*) as pending_count,
        SUM(qty) as total_qty
      FROM inbound_details
      WHERE (put_date IS NULL OR put_date = '')
      GROUP BY rec_date
      ORDER BY rec_date DESC
    `;

    db.all(summarySql, [], (err, summaryRows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, pendingSummary: summaryRows || [] });
    });
  });

  // 4. 魚群分析數據計算 API (含收貨備註多選條件)
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, warehouse, remarks } = req.query; // remarks 可為陣列或逗號分隔字串

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

      // 解析備註過濾條件
      const remarkList = Array.isArray(remarks) ? remarks : (remarks || '').split(',').map(s => s.trim());
      
      const filteredRows = rows.filter(r => {
        if (!remarkList.length || remarkList.includes('all')) return true;

        const rem = (r.remark || '').trim();
        let matched = false;

        if (remarkList.includes('15') && (rem.includes('15庫') || rem.includes('原15庫'))) matched = true;
        if (remarkList.includes('empty') && rem === '') matched = true;
        if (remarkList.includes('abnormal') && rem !== '' && !rem.includes('15庫')) matched = true;

        return matched;
      });

      // 初始化 24 小時時段統計桶
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
        // 1. 驗收時段統計
        if (r.rec_date === targetDate && r.rec_time) {
          const h = parseInt(r.rec_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            hourlyStats[h].recPoCount += 1;
            hourlyStats[h].recPoPcs += (r.qty || 0);
            if (r.batch_no) hourlyStats[h].recBatCount += 1;
          }
        }

        // 2. 上架時段統計
        if (r.put_date === targetDate && r.put_time) {
          const h = parseInt(r.put_time.split(':')[0], 10);
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