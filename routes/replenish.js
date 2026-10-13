// C:\my-inventory-server\routes\replenish.js
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
      CREATE TABLE IF NOT EXISTS replenish_details (
        warehouse TEXT,
        order_no TEXT,
        doc_type TEXT,
        dest_warehouse TEXT,
        doc_status TEXT,
        item_id TEXT,
        item_name TEXT,
        item_spec TEXT,
        supplier_item_no TEXT,
        suggest_qty REAL,
        gen_date TEXT,
        gen_time TEXT,
        apply_user TEXT,
        finish_date TEXT,
        finish_time TEXT,
        finish_user TEXT,
        finish_remark TEXT,
        remark TEXT,
        actual_pcs REAL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse, order_no, item_id)
      )
    `);
    db.run(`ALTER TABLE replenish_details ADD COLUMN remark TEXT`, () => {});
  });

  // 1. 匯入 API
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'latest_replenish.csv';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的補貨單資料' });
    }

    db.serialize(() => {
      db.run('PRAGMA synchronous = OFF');
      db.run('PRAGMA journal_mode = MEMORY');
      db.run('BEGIN TRANSACTION');

      if (isFirstChunk) {
        db.run(
          `INSERT INTO import_logs (module_type, file_name, row_count, imported_at) VALUES ('replenish', ?, ?, DATETIME('now'))`,
          [fileName, items.length]
        );
      }

      const stmt = db.prepare(`
        INSERT INTO replenish_details (
          warehouse, order_no, doc_type, dest_warehouse, doc_status,
          item_id, item_name, item_spec, supplier_item_no, suggest_qty,
          gen_date, gen_time, apply_user, finish_date, finish_time,
          finish_user, finish_remark, remark, actual_pcs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, order_no, item_id) DO UPDATE SET
          doc_type = EXCLUDED.doc_type,
          doc_status = EXCLUDED.doc_status,
          suggest_qty = EXCLUDED.suggest_qty,
          gen_date = EXCLUDED.gen_date,
          gen_time = EXCLUDED.gen_time,
          finish_date = EXCLUDED.finish_date,
          finish_time = EXCLUDED.finish_time,
          finish_user = EXCLUDED.finish_user,
          finish_remark = EXCLUDED.finish_remark,
          remark = EXCLUDED.remark,
          actual_pcs = EXCLUDED.actual_pcs,
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

        const warehouse = getVal('庫別', 'warehouse') || '80';
        const order_no = getVal('補貨/調撥單號', 'order_no');
        const doc_type = getVal('單據類別', 'doc_type');
        const dest_warehouse = getVal('目的庫', 'dest_warehouse');
        const doc_status = getVal('單據狀態', 'doc_status');
        const item_id = getVal('商品編號', 'item_id');
        const item_name = getVal('商品名稱', 'item_name');
        const item_spec = getVal('商品規格', 'item_spec');
        const supplier_item_no = getVal('廠商料號', 'supplier_item_no');
        const suggest_qty = getNum('建議撿貨數量', 'suggest_qty');
        const gen_date = standardizeDate(getVal('產生日期', 'gen_date'));
        const gen_time = standardizeTime(getVal('產生時間', 'gen_time'));
        const apply_user = getVal('申請人員', 'apply_user');
        const finish_date = standardizeDate(getVal('完成日期', 'finish_date'));
        const finish_time = standardizeTime(getVal('完成時間', 'finish_time'));
        const finish_user = getVal('完成人員', 'finish_user');
        const finish_remark = getVal('完成備註', 'finish_remark');
        
        // 🌟 專用對齊：S欄 備註說明
        const remark = getVal('備註說明', 'remark', '備註');
        const actual_pcs = getNum('實際上架PCS', 'actual_pcs');

        if (order_no || item_id) {
          stmt.run(
            warehouse, order_no, doc_type, dest_warehouse, doc_status,
            item_id, item_name, item_spec, supplier_item_no, suggest_qty,
            gen_date, gen_time, apply_user, finish_date, finish_time,
            finish_user, finish_remark, remark, actual_pcs
          );
          processedCount++;
        }
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '補貨單寫入失敗：' + err.message });
        res.json({ success: true, count: processedCount, message: `成功更新與處理 ${processedCount} 筆補貨單資料！` });
      });
    });
  });

  // 2. 魚群分析 API (原生 SQL 精準比對 S 欄)
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, reasons } = req.query;

    let sql = `SELECT * FROM replenish_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (gen_date = ? OR finish_date = ?)`;
      params.push(targetDate, targetDate);
    }

    // 解析 reasons
    let reasonList = [];
    if (Array.isArray(reasons)) {
      reasonList = reasons;
    } else if (typeof reasons === 'string' && reasons.trim() !== '') {
      reasonList = reasons.split(',').map(s => s.trim()).filter(Boolean);
    }

    // 🌟 原生 SQL 條件拼接
    if (reasonList.length > 0 && !reasonList.includes('all')) {
      const subConds = reasonList.map(() => `remark LIKE ?`);
      sql += ` AND (${subConds.join(' OR ')})`;
      reasonList.forEach(r => params.push(`%${r}%`));
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        genOrderSet: new Set(), genPcs: 0,
        finOrderSet: new Set(), finPcs: 0,
        delOrderSet: new Set()
      }));

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const status = (r.doc_status || '').trim();

        if (r.gen_date === targetDate && r.gen_time) {
          const h = parseInt(r.gen_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (orderNo) hourlyData[h].genOrderSet.add(orderNo);
            hourlyData[h].genPcs += (r.suggest_qty || 0);
          }
        }

        if (r.finish_date === targetDate && r.finish_time) {
          const h = parseInt(r.finish_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (status !== '已刪單') {
              if (orderNo) hourlyData[h].finOrderSet.add(orderNo);
              hourlyData[h].finPcs += (r.actual_pcs || 0);
            } else {
              if (orderNo) hourlyData[h].delOrderSet.add(orderNo);
            }
          }
        }
      });

      const hourlyStats = hourlyData.map(d => ({
        hourStr: d.hourStr,
        genOrderCount: d.genOrderSet.size, genPcs: d.genPcs,
        finOrderCount: d.finOrderSet.size, finPcs: d.finPcs,
        delOrderCount: d.delOrderSet.size
      }));

      res.json({ success: true, totalFiltered: rows.length, hourlyStats });
    });
  });

  // 3. 每月總表 API (原生 SQL 精準比對 S 欄)
  router.get('/monthly-summary', (req, res) => {
    const { month, reasons } = req.query;

    if (!month) {
      return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });
    }

    let sql = `SELECT * FROM replenish_details WHERE (gen_date LIKE ? OR finish_date LIKE ?)`;
    const monthPattern = `${month}%`;
    const params = [monthPattern, monthPattern];

    let reasonList = [];
    if (Array.isArray(reasons)) {
      reasonList = reasons;
    } else if (typeof reasons === 'string' && reasons.trim() !== '') {
      reasonList = reasons.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (reasonList.length > 0 && !reasonList.includes('all')) {
      const subConds = reasonList.map(() => `remark LIKE ?`);
      sql += ` AND (${subConds.join(' OR ')})`;
      reasonList.forEach(r => params.push(`%${r}%`));
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const daysMap = {};

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const status = (r.doc_status || '').trim();

        if (r.gen_date && r.gen_date.startsWith(month)) {
          const d = r.gen_date;
          if (!daysMap[d]) {
            daysMap[d] = {
              date: d,
              genOrderSet: new Set(), genPcs: 0,
              finOrderSet: new Set(), finPcs: 0,
              delOrderSet: new Set()
            };
          }
          if (orderNo) daysMap[d].genOrderSet.add(orderNo);
          daysMap[d].genPcs += (r.suggest_qty || 0);
        }

        if (r.finish_date && r.finish_date.startsWith(month)) {
          const d = r.finish_date;
          if (!daysMap[d]) {
            daysMap[d] = {
              date: d,
              genOrderSet: new Set(), genPcs: 0,
              finOrderSet: new Set(), finPcs: 0,
              delOrderSet: new Set()
            };
          }
          if (status !== '已刪單') {
            if (orderNo) daysMap[d].finOrderSet.add(orderNo);
            daysMap[d].finPcs += (r.actual_pcs || 0);
          } else {
            if (orderNo) daysMap[d].delOrderSet.add(orderNo);
          }
        }
      });

      const dailyList = Object.keys(daysMap).sort().map(d => {
        const item = daysMap[d];
        const rateVal = item.genPcs > 0 ? (item.finPcs / item.genPcs) * 100 : 0;

        return {
          date: item.date,
          genOrderCount: item.genOrderSet.size, genPcs: item.genPcs,
          finOrderCount: item.finOrderSet.size, finPcs: item.finPcs,
          delOrderCount: item.delOrderSet.size,
          finishRate: Math.min(100, rateVal).toFixed(2) + '%'
        };
      });

      res.json({ success: true, month, dailyList });
    });
  });

  return router;
};