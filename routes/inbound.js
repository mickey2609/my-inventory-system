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
        receipt_no TEXT,
        batch_no TEXT,
        recv_date TEXT,
        recv_time TEXT,
        putaway_date TEXT,
        putaway_time TEXT,
        item_id TEXT,
        item_name TEXT,
        recv_qty REAL,
        recv_remark TEXT,
        doc_status TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse, receipt_no, batch_no, item_id)
      )
    `);
  });

  function applyFilters(sql, params, docTypes) {
    let docList = [];
    if (Array.isArray(docTypes)) docList = docTypes;
    else if (typeof docTypes === 'string' && docTypes.trim() !== '') {
      docList = docTypes.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (docList.length > 0 && !docList.includes('all')) {
      const subConds = docList.map(() => `(batch_no LIKE ? OR receipt_no LIKE ?)`);
      sql += ` AND (${subConds.join(' OR ')})`;
      docList.forEach(d => {
        params.push(`%${d}%`, `%${d}%`);
      });
    }
    return sql;
  }

  // 1. 匯入 API (智慧支援 XLS / CSV 多重格式)
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'inbound.csv';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的進貨單資料' });
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
          warehouse, receipt_no, batch_no, recv_date, recv_time,
          putaway_date, putaway_time, item_id, item_name, recv_qty,
          recv_remark, doc_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, receipt_no, batch_no, item_id) DO UPDATE SET
          recv_date = EXCLUDED.recv_date,
          recv_time = EXCLUDED.recv_time,
          putaway_date = EXCLUDED.putaway_date,
          putaway_time = EXCLUDED.putaway_time,
          item_name = EXCLUDED.item_name,
          recv_qty = EXCLUDED.recv_qty,
          recv_remark = EXCLUDED.recv_remark,
          doc_status = EXCLUDED.doc_status,
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

        const item_id = getVal('商品編號', 'item_id');
        const receipt_no = getVal('進貨單號', 'receipt_no', '進貨單據');
        const recv_qty_str = getVal('驗收數量', '驗收數量(PCS)', 'recv_qty');

        if (
          !item_id ||
          item_id.includes('筆數') ||
          item_id.includes('總數') ||
          receipt_no.includes('筆數') ||
          receipt_no.includes('狀態') ||
          recv_qty_str.includes('總數') ||
          recv_qty_str.includes('筆數')
        ) {
          continue;
        }

        let warehouse = getVal('庫別', 'Unnamed: 1', 'warehouse') || '15';
        if (warehouse === '-') warehouse = '15';

        const batch_no = getVal('驗收批號', 'batch_no') || '-';
        const recv_date = standardizeDate(getVal('驗收日期', 'recv_date'));
        const recv_time = standardizeTime(getVal('驗收時間', 'recv_time'));
        const putaway_date = standardizeDate(getVal('上架日期', 'putaway_date'));
        const putaway_time = standardizeTime(getVal('上架時間', 'putaway_time'));
        const item_name = getVal('商品名稱', 'item_name');
        const recv_qty = getNum('驗收數量', '驗收數量(PCS)', 'recv_qty');
        const recv_remark = getVal('收貨備註', '備註', 'recv_remark');
        const doc_status = getVal('單據狀態', 'doc_status') || (putaway_date ? '已上架' : '未上架');

        stmt.run(
          warehouse, receipt_no, batch_no, recv_date, recv_time,
          putaway_date, putaway_time, item_id, item_name, recv_qty,
          recv_remark, doc_status
        );
        processedCount++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '進貨單寫入失敗：' + err.message });
        res.json({ success: true, count: processedCount, message: `成功寫入與同步 ${processedCount} 筆進貨單資料！` });
      });
    });
  });

  // 2. 時段魚群分析 API
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, docTypes } = req.query;

    let sql = `SELECT * FROM inbound_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (recv_date = ? OR putaway_date = ?)`;
      params.push(targetDate, targetDate);
    }

    sql = applyFilters(sql, params, docTypes);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        recvOrderSet: new Set(), recvPcs: 0,
        pendingOrderSet: new Set(), pendingPcs: 0,
        finOrderSet: new Set(), finPcs: 0,
        delOrderSet: new Set()
      }));

      rows.forEach(r => {
        const orderNo = (r.receipt_no || '').trim();
        const status = (r.doc_status || '').trim();
        const hasPutawayDate = !!(r.putaway_date && r.putaway_date.trim() !== '');

        if (r.recv_date === targetDate && r.recv_time) {
          const h = parseInt(r.recv_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (orderNo) hourlyData[h].recvOrderSet.add(orderNo);
            hourlyData[h].recvPcs += (r.recv_qty || 0);

            if (!hasPutawayDate && status !== '已刪單' && status !== '已銷案') {
              if (orderNo) hourlyData[h].pendingOrderSet.add(orderNo);
              hourlyData[h].pendingPcs += (r.recv_qty || 0);
            }
          }
        }

        if (r.putaway_date === targetDate && r.putaway_time) {
          const h = parseInt(r.putaway_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (status !== '已刪單') {
              if (orderNo) hourlyData[h].finOrderSet.add(orderNo);
              hourlyData[h].finPcs += (r.recv_qty || 0);
            } else {
              if (orderNo) hourlyData[h].delOrderSet.add(orderNo);
            }
          }
        }
      });

      const hourlyStats = hourlyData.map(d => ({
        hourStr: d.hourStr,
        genOrderCount: d.recvOrderSet.size, genPcs: d.recvPcs,
        pendingOrderCount: d.pendingOrderSet.size, pendingPcs: d.pendingPcs,
        finOrderCount: d.finOrderSet.size, finPcs: d.finPcs,
        delOrderCount: d.delOrderSet.size
      }));

      res.json({ success: true, totalFiltered: rows.length, hourlyStats });
    });
  });

  // 3. 每月總表 API
  router.get('/monthly-summary', (req, res) => {
    const { month, docTypes } = req.query;
    if (!month) return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });

    let sql = `SELECT * FROM inbound_details WHERE (recv_date LIKE ? OR putaway_date LIKE ?)`;
    const monthPattern = `${month}%`;
    const params = [monthPattern, monthPattern];

    sql = applyFilters(sql, params, docTypes);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const daysMap = {};

      rows.forEach(r => {
        const orderNo = (r.receipt_no || '').trim();
        const status = (r.doc_status || '').trim();
        const rDate = r.recv_date;
        const pDate = r.putaway_date;
        const isPutaway = !!(pDate || r.putaway_time) && status !== '已刪單';

        if (rDate && rDate.startsWith(month)) {
          if (!daysMap[rDate]) {
            daysMap[rDate] = {
              date: rDate,
              genOrderSet: new Set(), genPcs: 0,
              cohortFinOrderSet: new Set(),
              finOrderSet: new Set(), finPcs: 0,
              delOrderSet: new Set()
            };
          }
          if (orderNo) daysMap[rDate].genOrderSet.add(orderNo);
          daysMap[rDate].genPcs += (r.recv_qty || 0);

          if (isPutaway && orderNo) {
            daysMap[rDate].cohortFinOrderSet.add(orderNo);
          }
        }

        if (pDate && pDate.startsWith(month)) {
          if (!daysMap[pDate]) {
            daysMap[pDate] = {
              date: pDate,
              genOrderSet: new Set(), genPcs: 0,
              cohortFinOrderSet: new Set(),
              finOrderSet: new Set(), finPcs: 0,
              delOrderSet: new Set()
            };
          }
          if (status !== '已刪單') {
            if (orderNo) daysMap[pDate].finOrderSet.add(orderNo);
            daysMap[pDate].finPcs += (r.recv_qty || 0);
          } else {
            if (orderNo) daysMap[pDate].delOrderSet.add(orderNo);
          }
        }
      });

      const dailyList = Object.keys(daysMap).sort().map(d => {
        const item = daysMap[d];
        const genCount = item.genOrderSet.size;
        const cohortFinCount = item.cohortFinOrderSet.size;
        const rateVal = genCount > 0 ? (cohortFinCount / genCount) * 100 : 0;

        return {
          date: item.date,
          genOrderCount: genCount, genPcs: item.genPcs,
          finOrderCount: item.finOrderSet.size, finPcs: item.finPcs,
          delOrderCount: item.delOrderSet.size,
          cohortFinOrderCount: cohortFinCount,
          finishRate: Math.min(100, rateVal).toFixed(2) + '%'
        };
      });

      res.json({ success: true, month, dailyList });
    });
  });

  // 4. 年度總表 API
  router.get('/yearly-summary', (req, res) => {
    const { year, docTypes } = req.query;
    if (!year) return res.status(400).json({ success: false, message: '請提供查詢年份 (YYYY)' });

    let sql = `SELECT * FROM inbound_details WHERE (recv_date LIKE ? OR putaway_date LIKE ?)`;
    const yearPattern = `${year}%`;
    const params = [yearPattern, yearPattern];

    sql = applyFilters(sql, params, docTypes);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const monthMap = {};

      for (let m = 1; m <= 12; m++) {
        const mKey = `${year}-${String(m).padStart(2, '0')}`;
        monthMap[mKey] = {
          month: mKey,
          monthLabel: `${String(m).padStart(2, '0')}月`,
          genOrderSet: new Set(), genPcs: 0,
          cohortFinOrderSet: new Set(),
          finOrderSet: new Set(), finPcs: 0,
          delOrderSet: new Set()
        };
      }

      rows.forEach(r => {
        const orderNo = (r.receipt_no || '').trim();
        const status = (r.doc_status || '').trim();
        const rDate = r.recv_date;
        const pDate = r.putaway_date;
        const isPutaway = !!(pDate || r.putaway_time) && status !== '已刪單';

        if (rDate && rDate.startsWith(year)) {
          const mKey = rDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (orderNo) monthMap[mKey].genOrderSet.add(orderNo);
            monthMap[mKey].genPcs += (r.recv_qty || 0);

            if (isPutaway && orderNo) {
              monthMap[mKey].cohortFinOrderSet.add(orderNo);
            }
          }
        }

        if (pDate && pDate.startsWith(year)) {
          const mKey = pDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (status !== '已刪單') {
              if (orderNo) monthMap[mKey].finOrderSet.add(orderNo);
              monthMap[mKey].finPcs += (r.recv_qty || 0);
            } else {
              if (orderNo) monthMap[mKey].delOrderSet.add(orderNo);
            }
          }
        }
      });

      const monthlyList = Object.keys(monthMap).sort().map(m => {
        const item = monthMap[m];
        const genCount = item.genOrderSet.size;
        const cohortFinCount = item.cohortFinOrderCount.size;
        const rateVal = genCount > 0 ? (cohortFinCount / genCount) * 100 : 0;

        return {
          month: item.month,
          monthLabel: item.monthLabel,
          genOrderCount: genCount, genPcs: item.genPcs,
          finOrderCount: item.finOrderSet.size, finPcs: item.finPcs,
          delOrderCount: item.delOrderSet.size,
          cohortFinOrderCount: cohortFinCount,
          finishRate: Math.min(100, rateVal).toFixed(2) + '%'
        };
      });

      res.json({ success: true, year, monthlyList });
    });
  });

  // 5. 未上架明細日期選單
  router.get('/pending-dates', (req, res) => {
    const sql = `
      SELECT recv_date as gen_date, COUNT(*) as count 
      FROM inbound_details 
      WHERE (putaway_date IS NULL OR putaway_date = '') 
        AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))
        AND recv_date != ''
      GROUP BY recv_date
      ORDER BY recv_date DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 6. 未上架明細列表 API
  router.get('/pending-details', (req, res) => {
    const { targetDate, docTypes } = req.query;

    let sql = `SELECT * FROM inbound_details WHERE (putaway_date IS NULL OR putaway_date = '') AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))`;
    const params = [];

    if (targetDate) {
      sql += ` AND recv_date = ?`;
      params.push(targetDate);
    }

    sql = applyFilters(sql, params, docTypes);
    sql += ` ORDER BY recv_date DESC, recv_time DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const pendingList = rows.map(r => ({
        warehouse: r.warehouse || '15',
        order_no: r.receipt_no || '-',
        batch_no: r.batch_no || '-',
        gen_date: r.recv_date || '-',
        gen_time: r.recv_time || '-',
        item_id: r.item_id || '-',
        item_name: r.item_name || '-',
        suggest_qty: r.recv_qty || 0,
        remark: r.recv_remark || '-'
      }));

      res.json({ success: true, totalPending: pendingList.length, pendingList });
    });
  });

  // 7. 手動銷案 API
  router.post('/close-order', (req, res) => {
    const { keys, startDate, endDate, closeUser, closeRemark } = req.body;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    if (startDate && endDate) {
      const sql = `
        UPDATE inbound_details
        SET putaway_date = ?, putaway_time = ?, doc_status = '已銷案'
        WHERE (putaway_date IS NULL OR putaway_date = '')
          AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))
          AND recv_date BETWEEN ? AND ?
      `;
      db.run(sql, [todayStr, timeStr, startDate, endDate], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: `🎉 成功完成 ${this.changes} 筆於 ${startDate} ~ ${endDate} 區間之未上架單據銷案！`, count: this.changes });
      });
      return;
    }

    if (Array.isArray(keys) && keys.length > 0) {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`
          UPDATE inbound_details
          SET putaway_date = ?, putaway_time = ?, doc_status = '已銷案'
          WHERE receipt_no = ? AND item_id = ?
        `);
        let count = 0;
        for (const k of keys) {
          stmt.run(todayStr, timeStr, k.orderNo, k.itemId);
          count++;
        }
        stmt.finalize();
        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          res.json({ success: true, message: `🎉 成功完成 ${count} 筆勾選單據之銷案！`, count });
        });
      });
      return;
    }

    res.status(400).json({ success: false, message: '請提供要銷案的單據或日期區間！' });
  });

  return router;
};