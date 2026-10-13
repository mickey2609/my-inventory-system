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

  // 1. 匯入 API (專精解析 S 欄：備註說明)
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

        const warehouse = getVal('warehouse', '庫別') || '80';
        const order_no = getVal('order_no', '補貨/調撥單號');
        const doc_type = getVal('doc_type', '單據類別');
        const dest_warehouse = getVal('dest_warehouse', '目的庫');
        const doc_status = getVal('doc_status', '單據狀態');
        const item_id = getVal('item_id', '商品編號');
        const item_name = getVal('item_name', '商品名稱');
        const item_spec = getVal('item_spec', '商品規格');
        const supplier_item_no = getVal('supplier_item_no', '廠商料號');
        const suggest_qty = getNum('suggest_qty', '建議撿貨數量');
        const gen_date = standardizeDate(getVal('gen_date', '產生日期'));
        const gen_time = standardizeTime(getVal('gen_time', '產生時間'));
        const apply_user = getVal('apply_user', '申請人員');
        const finish_date = standardizeDate(getVal('finish_date', '完成日期'));
        const finish_time = standardizeTime(getVal('finish_time', '完成時間'));
        const finish_user = getVal('finish_user', '完成人員');
        const finish_remark = getVal('finish_remark', '完成備註');
        
        // 🌟 專用唯一鎖定：S 欄: 備註說明
        const remark = getVal('remark', '備註說明', '備註');
        const actual_pcs = getNum('actual_pcs', '實際上架PCS');

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

  // 2. 補貨單魚群時段分析 API (只比對 S 欄：備註說明)
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, reasons } = req.query;

    let sql = `SELECT * FROM replenish_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (gen_date = ? OR finish_date = ?)`;
      params.push(targetDate, targetDate);
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const reasonList = Array.isArray(reasons) ? reasons : (reasons || '').split(',').map(s => s.trim()).filter(Boolean);

      // 🌟 純粹比對 S 欄 (remark)
      const filteredRows = rows.filter(r => {
        if (!reasonList.length || reasonList.includes('all')) return true;
        const remarkTxt = (r.remark || '').trim();
        return reasonList.some(opt => remarkTxt.includes(opt));
      });

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        genOrderSet: new Set(), genPcs: 0,
        finOrderSet: new Set(), finPcs: 0,
        delOrderSet: new Set()
      }));

      filteredRows.forEach(r => {
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

      res.json({ success: true, totalFiltered: filteredRows.length, hourlyStats });
    });
  });

  // 3. 每月每日總表 API (只比對 S 欄：備註說明)
  router.get('/monthly-summary', (req, res) => {
    const { month, reasons } = req.query;

    if (!month) {
      return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });
    }

    let sql = `SELECT * FROM replenish_details WHERE (gen_date LIKE ? OR finish_date LIKE ?)`;
    const monthPattern = `${month}%`;
    const params = [monthPattern, monthPattern];

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const reasonList = Array.isArray(reasons) ? reasons : (reasons || '').split(',').map(s => s.trim()).filter(Boolean);

      const filteredRows = rows.filter(r => {
        if (!reasonList.length || reasonList.includes('all')) return true;
        const remarkTxt = (r.remark || '').trim();
        return reasonList.some(opt => remarkTxt.includes(opt));
      });

      const daysMap = {};

      filteredRows.forEach(r => {
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