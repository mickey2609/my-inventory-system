// C:\my-inventory-server\routes\inbound.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  function standardizeDate(val) {
    if (!val) return '';
    let str = String(val).trim();
    if (str.includes(' ')) str = str.split(' ')[0];
    str = str.replace(/\//g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    return str;
  }

  function standardizeTime(val) {
    if (!val) return '';
    let str = String(val).trim();
    if (str.includes(' ')) {
      const parts = str.split(' ');
      str = parts[parts.length - 1];
    }
    return str;
  }

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
        is_resolved INTEGER DEFAULT 0,
        resolve_reason TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse, po_no, batch_no, item_id)
      )
    `);
  });

  // 1. 匯入 API (Upsert 強制覆蓋 put_date)
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
          put_date = EXCLUDED.put_date,
          put_time = EXCLUDED.put_time,
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
        const rec_date = standardizeDate(getVal('rec_date', '驗收日期'));
        const rec_time = standardizeTime(getVal('rec_time', '驗收時間'));
        const put_date = standardizeDate(getVal('put_date', '上架日期'));
        const put_time = standardizeTime(getVal('put_time', '上架時間'));
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

  // 2. 未上架日期摘要統計
  router.get('/pending-putaway', (req, res) => {
    const sql = `
      SELECT 
        rec_date,
        COUNT(*) as pending_count,
        IFNULL(SUM(qty), 0) as total_qty
      FROM inbound_details
      WHERE (po_no != '' OR batch_no != '')
        AND LENGTH(TRIM(IFNULL(put_date, ''))) = 0
        AND IFNULL(is_resolved, 0) = 0
        AND rec_date IS NOT NULL AND rec_date != ''
      GROUP BY rec_date
      ORDER BY rec_date DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, pendingSummary: rows || [] });
    });
  });

  // 3. 未上架明細清單 (若 recDate 未傳則自動備援抓最新一天)
  router.get('/pending-details', (req, res) => {
    let { recDate } = req.query;

    const fetchDetails = (targetDate) => {
      let sql = `
        SELECT warehouse, rec_date, rec_time, batch_no, po_no, remark, item_id, item_name, qty
        FROM inbound_details
        WHERE (po_no != '' OR batch_no != '')
          AND LENGTH(TRIM(IFNULL(put_date, ''))) = 0
          AND IFNULL(is_resolved, 0) = 0
      `;
      const params = [];

      if (targetDate) {
        sql += ` AND rec_date = ?`;
        params.push(targetDate);
      }

      sql += ` ORDER BY rec_time ASC`;

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, selectedDate: targetDate, pendingDetails: rows || [] });
      });
    };

    if (!recDate || recDate.trim() === '') {
      db.get(`
        SELECT rec_date 
        FROM inbound_details 
        WHERE (po_no != '' OR batch_no != '')
          AND LENGTH(TRIM(IFNULL(put_date, ''))) = 0
          AND IFNULL(is_resolved, 0) = 0
        ORDER BY rec_date DESC 
        LIMIT 1
      `, [], (err, row) => {
        const latestDate = row ? row.rec_date : '';
        fetchDetails(latestDate);
      });
    } else {
      fetchDetails(recDate);
    }
  });

  // 4. 更正銷案 API
  router.post('/update-pending-status', (req, res) => {
    const { keys, reason, customPutDate } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: '請選擇至少一筆未上架項目' });
    }

    const resolveReason = reason || '誤驗收/多驗已更正';

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        UPDATE inbound_details
        SET is_resolved = 1,
            resolve_reason = ?,
            remark = remark || ' [更正註記: ' || ? || ']',
            put_date = CASE WHEN ? != '' THEN ? ELSE put_date END
        WHERE warehouse = ? AND po_no = ? AND batch_no = ? AND item_id = ?
      `);

      for (const k of keys) {
        stmt.run(resolveReason, resolveReason, customPutDate || '', customPutDate || '', k.warehouse, k.po_no, k.batch_no, k.item_id);
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: '銷案更正失敗：' + err.message });
        res.json({ success: true, message: `🎉 成功銷案並更正 ${keys.length} 筆未上架資料！` });
      });
    });
  });

  // 5. 魚群分析 API
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