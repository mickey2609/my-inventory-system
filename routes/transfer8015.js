// C:\my-inventory-server\routes\transfer8015.js
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
      CREATE TABLE IF NOT EXISTS transfer_8015_details (
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
        overseas_order_no TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse, order_no, item_id)
      )
    `);

    // 自動相容既有資料表升級 overseas_order_no 欄位
    db.run(`ALTER TABLE transfer_8015_details ADD COLUMN overseas_order_no TEXT`, (err) => {});
  });

  function applyFilters(sql, params, docTypes, reasons) {
    let docList = [];
    if (Array.isArray(docTypes)) docList = docTypes;
    else if (typeof docTypes === 'string' && docTypes.trim() !== '') {
      docList = docTypes.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (docList.length > 0 && !docList.includes('all')) {
      const subConds = docList.map(() => `doc_type LIKE ?`);
      sql += ` AND (${subConds.join(' OR ')})`;
      docList.forEach(d => params.push(`%${d}%`));
    }

    let reasonList = [];
    if (Array.isArray(reasons)) reasonList = reasons;
    else if (typeof reasons === 'string' && reasons.trim() !== '') {
      reasonList = reasons.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (reasonList.length > 0 && !reasonList.includes('all')) {
      const subConds = reasonList.map(() => `remark LIKE ?`);
      sql += ` AND (${subConds.join(' OR ')})`;
      reasonList.forEach(r => params.push(`%${r}%`));
    }

    return sql;
  }

  // 1. 匯入 API
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'transfer_8015.csv';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的調撥單資料' });
    }

    if (isFirstChunk) {
      const invalidRow = items.find(item => {
        const itemId = String(item['商品編號'] || item['item_id'] || '').trim();
        if (!itemId) return false;

        const orderNo = String(item['補貨/調撥單號'] || item['調撥單號'] || item['order_no'] || '').trim().toUpperCase();
        const destWh = String(item['目的庫'] || item['dest_warehouse'] || '').trim();

        if (!orderNo || /^\d+$/.test(orderNo) || orderNo.includes('筆數') || orderNo.includes('總計') || orderNo.includes('合計') || orderNo.includes('TOTAL')) {
          return false;
        }

        const isNotTRorGD = !orderNo.startsWith('TR') && !orderNo.startsWith('GD');
        const isDest80 = destWh === '80';

        return isNotTRorGD || isDest80;
      });

      if (invalidRow) {
        const errNo = String(invalidRow['補貨/調撥單號'] || invalidRow['調撥單號'] || invalidRow['order_no'] || '').trim();
        const errDest = String(invalidRow['目的庫'] || invalidRow['dest_warehouse'] || '未指定').trim();
        return res.status(400).json({
          success: false,
          message: `⚠️ 匯入失敗：偵測到非 80➔15 跨庫調撥單據（單號：${errNo}，目的庫：${errDest}）。跨庫調撥單單號必須為 TR 或 GD 開頭且目的庫不可為 80！`
        });
      }
    }

    db.serialize(() => {
      db.run('PRAGMA synchronous = OFF');
      db.run('PRAGMA journal_mode = MEMORY');
      db.run('BEGIN TRANSACTION');

      if (isFirstChunk) {
        db.run(
          `INSERT INTO import_logs (module_type, file_name, row_count, imported_at) VALUES ('transfer_8015', ?, ?, DATETIME('now'))`,
          [fileName, items.length]
        );
      }

      const stmt = db.prepare(`
        INSERT INTO transfer_8015_details (
          warehouse, order_no, doc_type, dest_warehouse, doc_status,
          item_id, item_name, item_spec, supplier_item_no, suggest_qty,
          gen_date, gen_time, apply_user, finish_date, finish_time,
          finish_user, finish_remark, remark, actual_pcs, overseas_order_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, order_no, item_id) DO UPDATE SET
          doc_type = EXCLUDED.doc_type,
          dest_warehouse = EXCLUDED.dest_warehouse,
          doc_status = EXCLUDED.doc_status,
          suggest_qty = EXCLUDED.suggest_qty,
          gen_date = EXCLUDED.gen_date,
          gen_time = EXCLUDED.gen_time,
          apply_user = EXCLUDED.apply_user,
          finish_date = EXCLUDED.finish_date,
          finish_time = EXCLUDED.finish_time,
          finish_user = EXCLUDED.finish_user,
          finish_remark = EXCLUDED.finish_remark,
          remark = EXCLUDED.remark,
          actual_pcs = EXCLUDED.actual_pcs,
          overseas_order_no = EXCLUDED.overseas_order_no,
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

        const order_no = getVal('補貨/調撥單號', '調撥單號', 'order_no');
        const item_id = getVal('商品編號', 'item_id');

        if (!item_id || !order_no || /^\d+$/.test(order_no) || order_no.includes('筆數') || order_no.includes('總計') || order_no.includes('合計') || order_no.includes('TOTAL')) {
          continue;
        }

        const warehouse = getVal('庫別', 'warehouse') || '80';
        const doc_type = getVal('單據類別', 'doc_type');
        const dest_warehouse = getVal('目的庫', 'dest_warehouse') || '15';
        const doc_status = getVal('單據狀態', 'doc_status');
        const item_name = getVal('商品名稱', 'item_name');
        const item_spec = getVal('商品規格', 'item_spec');
        const supplier_item_no = getVal('廠商料號', 'supplier_item_no');
        const suggest_qty = getNum('建議撿貨數量', '調撥數量', 'suggest_qty');
        const gen_date = standardizeDate(getVal('產生日期', 'gen_date'));
        const gen_time = standardizeTime(getVal('產生時間', 'gen_time'));
        const apply_user = getVal('申請人員', 'apply_user');
        const finish_date = standardizeDate(getVal('完成日期', 'finish_date'));
        const finish_time = standardizeTime(getVal('完成時間', 'finish_time'));
        const finish_user = getVal('完成人員', 'finish_user');
        const finish_remark = getVal('完成備註', 'finish_remark');
        const remark = getVal('備註說明', 'remark', '備註');
        const actual_pcs = getNum('實際上架PCS', 'actual_pcs');
        // AD 欄位：海外訂單編號
        // 嚴格支援多種 AD 欄位命名與去除隱藏空格
        const overseas_order_no = getVal(
          '海外訂單編號',
          '海外訂單編號 ',
          ' 海外訂單編號',
          '海外訂單',
          '海外單號',
          '進貨單號',
          '訂單單號',
          '__EMPTY_29', // Excel 無標題時的第 30 欄 (AD欄)
          'overseas_order_no'
        );

        stmt.run(
          warehouse, order_no, doc_type, dest_warehouse, doc_status,
          item_id, item_name, item_spec, supplier_item_no, suggest_qty,
          gen_date, gen_time, apply_user, finish_date, finish_time,
          finish_user, finish_remark, remark, actual_pcs, overseas_order_no
        );
        processedCount++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '跨庫調撥單寫入失敗：' + err.message });
        res.json({ success: true, count: processedCount, message: `成功同步 ${processedCount} 筆跨庫調撥單資料！` });
      });
    });
  });

  // 2. 時段魚群分析 API
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, docTypes, reasons } = req.query;

    let sql = `SELECT * FROM transfer_8015_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (gen_date = ? OR finish_date = ?)`;
      params.push(targetDate, targetDate);
    }

    sql = applyFilters(sql, params, docTypes, reasons);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        genOrderSet: new Set(), genPcs: 0,
        pendingOrderSet: new Set(), pendingPcs: 0,
        finOrderSet: new Set(), finPcs: 0,
        delOrderSet: new Set()
      }));

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const status = (r.doc_status || '').trim();
        const hasFinishDate = !!(r.finish_date && String(r.finish_date).trim() !== '');

        if (r.gen_date === targetDate && r.gen_time) {
          const h = parseInt(r.gen_time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (orderNo) hourlyData[h].genOrderSet.add(orderNo);
            hourlyData[h].genPcs += (r.suggest_qty || 0);

            if (!hasFinishDate && status !== '已刪單' && status !== '已銷案') {
              if (orderNo) hourlyData[h].pendingOrderSet.add(orderNo);
              hourlyData[h].pendingPcs += (r.suggest_qty || 0);
            }
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
        pendingOrderCount: d.pendingOrderSet.size, pendingPcs: d.pendingPcs,
        finOrderCount: d.finOrderSet.size, finPcs: d.finPcs,
        delOrderCount: d.delOrderSet.size
      }));

      res.json({ success: true, totalFiltered: rows.length, hourlyStats });
    });
  });

  // 3. 每月總表 API（🌟 聚合未完成筆數）
  router.get('/monthly-summary', (req, res) => {
    const { month, docTypes, reasons } = req.query;
    if (!month) return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });

    const monthPattern = `${month}%`;

    let pendingSql = `
      SELECT gen_date, COUNT(DISTINCT order_no) AS pending_count
      FROM transfer_8015_details
      WHERE gen_date LIKE ?
        AND (finish_date IS NULL OR TRIM(finish_date) = '')
        AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))
    `;
    const pendingParams = [monthPattern];
    pendingSql = applyFilters(pendingSql, pendingParams, docTypes, reasons);
    pendingSql += ` GROUP BY gen_date`;

    db.all(pendingSql, pendingParams, (errPending, pendingRows) => {
      if (errPending) return res.status(500).json({ success: false, message: errPending.message });

      const pendingMap = {};
      (pendingRows || []).forEach(p => {
        if (p.gen_date) pendingMap[p.gen_date] = p.pending_count || 0;
      });

      let sql = `SELECT * FROM transfer_8015_details WHERE (gen_date LIKE ? OR finish_date LIKE ?)`;
      const params = [monthPattern, monthPattern];
      sql = applyFilters(sql, params, docTypes, reasons);

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        rows = rows || [];
        const daysMap = {};

        const getDayObj = (d) => {
          if (!daysMap[d]) {
            daysMap[d] = {
              date: d,
              genOrderSet: new Set(),
              genPcs: 0,
              cohortFinOrderSet: new Set(),
              finOrderSet: new Set(),
              finPcs: 0,
              delOrderSet: new Set()
            };
          }
          return daysMap[d];
        };

        rows.forEach(r => {
          const orderNo = (r.order_no || '').trim();
          const status = (r.doc_status || '').trim();
          const gDate = (r.gen_date || '').trim();
          const fDate = (r.finish_date || '').trim();
          const hasFinish = !!(fDate && fDate !== '');

          if (gDate && gDate.startsWith(month)) {
            const day = getDayObj(gDate);
            if (orderNo) day.genOrderSet.add(orderNo);
            day.genPcs += (r.suggest_qty || 0);

            if (hasFinish && status !== '已刪單') {
              if (orderNo) day.cohortFinOrderSet.add(orderNo);
            }
          }

          if (fDate && fDate.startsWith(month)) {
            const day = getDayObj(fDate);
            if (status !== '已刪單') {
              if (orderNo) day.finOrderSet.add(orderNo);
              day.finPcs += (r.actual_pcs || 0);
            } else {
              if (orderNo) day.delOrderSet.add(orderNo);
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
            genOrderCount: genCount,
            genPcs: item.genPcs,
            pendingOrderCount: pendingMap[item.date] || 0,
            finOrderCount: item.finOrderSet.size,
            finPcs: item.finPcs,
            delOrderCount: item.delOrderSet.size,
            cohortFinOrderCount: cohortFinCount,
            finishRate: Math.min(100, rateVal).toFixed(2) + '%'
          };
        });

        res.json({ success: true, month, dailyList });
      });
    });
  });

  // 4. 年度總表 API
  router.get('/yearly-summary', (req, res) => {
    const { year, docTypes, reasons } = req.query;
    if (!year) return res.status(400).json({ success: false, message: '請提供查詢年份 (YYYY)' });

    let sql = `SELECT * FROM transfer_8015_details WHERE (gen_date LIKE ? OR finish_date LIKE ?)`;
    const yearPattern = `${year}%`;
    const params = [yearPattern, yearPattern];

    sql = applyFilters(sql, params, docTypes, reasons);

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
        const orderNo = (r.order_no || '').trim();
        const status = (r.doc_status || '').trim();
        const gDate = (r.gen_date || '').trim();
        const fDate = (r.finish_date || '').trim();
        const isFinished = !!(fDate && fDate !== '') && status !== '已刪單';

        if (gDate && gDate.startsWith(year)) {
          const mKey = gDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (orderNo) monthMap[mKey].genOrderSet.add(orderNo);
            monthMap[mKey].genPcs += (r.suggest_qty || 0);

            if (isFinished && orderNo) {
              monthMap[mKey].cohortFinOrderSet.add(orderNo);
            }
          }
        }

        if (fDate && fDate.startsWith(year)) {
          const mKey = fDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (status !== '已刪單') {
              if (orderNo) monthMap[mKey].finOrderSet.add(orderNo);
              monthMap[mKey].finPcs += (r.actual_pcs || 0);
            } else {
              if (orderNo) monthMap[mKey].delOrderSet.add(orderNo);
            }
          }
        }
      });

      const monthlyList = Object.keys(monthMap).sort().map(m => {
        const item = monthMap[m];
        const genCount = item.genOrderSet.size;
        const cohortFinCount = item.cohortFinOrderSet.size;
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

  // 5. 未完成明細日期選單
  router.get('/pending-dates', (req, res) => {
    const sql = `
      SELECT gen_date, COUNT(*) as count 
      FROM transfer_8015_details 
      WHERE (finish_date IS NULL OR finish_date = '') 
        AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))
        AND gen_date != ''
      GROUP BY gen_date
      ORDER BY gen_date DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 6. 未完成明細 API（🌟 回傳 overseas_order_no）
  router.get('/pending-details', (req, res) => {
    const { targetDate, docTypes, reasons } = req.query;

    let sql = `SELECT * FROM transfer_8015_details WHERE (finish_date IS NULL OR finish_date = '') AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))`;
    const params = [];

    if (targetDate) {
      sql += ` AND gen_date = ?`;
      params.push(targetDate);
    }

    sql = applyFilters(sql, params, docTypes, reasons);
    sql += ` ORDER BY gen_date DESC, gen_time DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];
      const pendingList = rows.map(r => ({
        warehouse: r.warehouse || '80',
        order_no: r.order_no || '-',
        doc_type: r.doc_type || '-',
        item_id: r.item_id || '-',
        item_name: r.item_name || '-',
        item_spec: r.item_spec || '-',
        suggest_qty: r.suggest_qty || 0,
        gen_date: r.gen_date || '-',
        gen_time: r.gen_time || '-',
        apply_user: r.apply_user || '-',
        remark: r.remark || '-',
        overseas_order_no: r.overseas_order_no || '-'
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
        UPDATE transfer_8015_details
        SET finish_date = ?, finish_time = ?, finish_user = ?, finish_remark = ?, doc_status = '已銷案'
        WHERE (finish_date IS NULL OR finish_date = '')
          AND (doc_status IS NULL OR (doc_status != '已刪單' AND doc_status != '已銷案'))
          AND gen_date BETWEEN ? AND ?
      `;
      db.run(sql, [todayStr, timeStr, closeUser || '主管銷案', closeRemark || '依日期區間一鍵銷案', startDate, endDate], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: `🎉 成功結案銷案 ${this.changes} 筆於 ${startDate} ~ ${endDate} 區間之未完成跨庫調撥單！`, count: this.changes });
      });
      return;
    }

    if (Array.isArray(keys) && keys.length > 0) {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`
          UPDATE transfer_8015_details
          SET finish_date = ?, finish_time = ?, finish_user = ?, finish_remark = ?, doc_status = '已銷案'
          WHERE order_no = ? AND item_id = ?
        `);
        let count = 0;
        for (const k of keys) {
          stmt.run(todayStr, timeStr, closeUser || '主管銷案', closeRemark || '批次勾選銷案', k.orderNo, k.itemId);
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

  // 8. 取得所有非 TR 及 GD 開頭且有商品編號的異常單據列表 API
  router.get('/invalid-orders', (req, res) => {
    const sql = `
      SELECT * FROM transfer_8015_details 
      WHERE ((order_no NOT LIKE 'TR%' AND order_no NOT LIKE 'GD%' AND order_no != '') OR dest_warehouse = '80')
        AND item_id != '' 
        AND item_id IS NOT NULL
        AND order_no NOT LIKE '%筆數%' 
        AND order_no NOT LIKE '%總計%' 
        AND order_no NOT LIKE '%合計%'
      ORDER BY gen_date DESC, gen_time DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 9. 批次刪除 API
  router.post('/delete-batch-invalid', (req, res) => {
    const { keys } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: '請勾選要刪除的異常單據！' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`DELETE FROM transfer_8015_details WHERE order_no = ? AND item_id = ?`);
      let count = 0;

      for (const k of keys) {
        stmt.run(k.orderNo, k.itemId);
        count++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: '刪除失敗：' + err.message });
        res.json({
          success: true,
          message: `🎉 成功剔除 ${count} 筆勾選的異常跨庫調撥單據！`,
          deletedCount: count
        });
      });
    });
  });

  return router;
};