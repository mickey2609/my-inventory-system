// routes/dispatchFish.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 🌟 日期標準化：相容 Excel 天數序號 (如 46329) 與一般字串日期
  function standardizeDate(val) {
    if (val === undefined || val === null || val === '') return '';
    let str = String(val).trim();
    if (!str || str === 'NaN' || str === 'null' || str === 'NaT') return '';

    // 1. 若為 Excel 天數序號 (純 5 位數字)
    if (/^\d{5}$/.test(str)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const targetTime = new Date(excelEpoch.getTime() + parseInt(str, 10) * 86400000);
      const y = targetTime.getUTCFullYear();
      const m = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetTime.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    if (str.includes(' ')) str = str.split(' ')[0];
    if (str.includes('T')) str = str.split('T')[0];

    str = str.replace(/\//g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = String(parts[1]).padStart(2, '0');
      const d = String(parts[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return str;
  }

  // 🌟 時間標準化：確保格式為 HH:mm:ss
  function standardizeTime(val) {
    if (val === undefined || val === null || val === '') return '';
    let str = String(val).trim();
    if (!str || str === 'NaN' || str === 'null' || str === 'NaT') return '';

    if (str.includes(' ')) {
      const parts = str.split(' ');
      str = parts[parts.length - 1];
    }
    const tParts = str.split(':');
    if (tParts.length >= 2) {
      const h = String(tParts[0]).padStart(2, '0');
      const m = String(tParts[1]).padStart(2, '0');
      const s = tParts[2] ? String(tParts[2]).padStart(2, '0') : '00';
      return `${h}:${m}:${s}`;
    }
    return str;
  }

  // 判斷是否為異常件
  function checkIsAbnormal(remark) {
    if (!remark) return false;
    const cleanRmk = String(remark).replace(/\(原15庫\)|\(原82庫\)|\s+/g, '').trim();
    if (!cleanRmk) return false;
    const keywords = ['問題', '不符', '凹損', '破損', '少', '溢', '退', '效期', '中文標', '處理中', '短少'];
    return keywords.some(k => cleanRmk.includes(k)) || cleanRmk.length > 5;
  }

  // 1. 初始化資料庫資料表
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS dispatch_fish_details (
        fast_pass_info TEXT,
        item_type TEXT,
        order_no TEXT,
        source_category TEXT,
        pcs REAL,
        cost_total REAL,
        item_id TEXT,
        item_name TEXT,
        pm_user TEXT,
        release_date TEXT,
        release_time TEXT,
        appoint_date TEXT,
        rec_date TEXT,
        rec_time TEXT,
        remark TEXT,
        check_date TEXT,
        check_time TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        doc_status TEXT DEFAULT '處理中',
        finish_user TEXT,
        finish_remark TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (order_no, item_id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_rec_date ON dispatch_fish_details (rec_date)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_check_date ON dispatch_fish_details (check_date)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_order_no ON dispatch_fish_details (order_no)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_dispatch_item_id ON dispatch_fish_details (item_id)`, () => {});
  });

  // 🌟 動態條件過濾器：支援 來源類別、準時到貨、異常件、快速通關、未驗收
  function applyFilters(sql, params, query) {
    const { sourceFilter, onTimeFilter, abnormalFilter, fastPassFilter, uncheckFilter } = query;

    // 1. 單據來源類別 (BR / BY)
    if (sourceFilter && sourceFilter !== 'all') {
      if (sourceFilter === 'BR') sql += ` AND order_no LIKE 'BR%'`;
      else if (sourceFilter === 'BY') sql += ` AND order_no LIKE 'BY%'`;
    }

    // 2. 準時到貨篩選 (K欄 == L欄)
    if (onTimeFilter === 'yes') {
      sql += ` AND appoint_date IS NOT NULL AND appoint_date != '' AND appoint_date = rec_date`;
    } else if (onTimeFilter === 'no') {
      sql += ` AND appoint_date IS NOT NULL AND appoint_date != '' AND appoint_date != rec_date`;
    }

    // 3. 快速通關 (A欄)
    if (fastPassFilter === 'yes') {
      sql += ` AND fast_pass_info IS NOT NULL AND TRIM(fast_pass_info) != ''`;
    } else if (fastPassFilter === 'no') {
      sql += ` AND (fast_pass_info IS NULL OR TRIM(fast_pass_info) = '')`;
    }

    // 4. 是否已收發未驗收 (有 rec_date 但 check_date 為空)
    if (uncheckFilter === 'yes') {
      sql += ` AND (check_date IS NULL OR TRIM(check_date) = '' OR TRIM(check_date) = 'NaT') AND (doc_status IS NULL OR doc_status != '已銷案')`;
    } else if (uncheckFilter === 'no') {
      sql += ` AND (check_date IS NOT NULL AND TRIM(check_date) != '' AND TRIM(check_date) != 'NaT')`;
    }

    return sql;
  }

  // 2. 匯入 API
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'dispatch_fish.xlsx';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的收發魚群資料' });
    }

    db.serialize(() => {
      db.run('PRAGMA synchronous = OFF');
      db.run('PRAGMA journal_mode = MEMORY');
      db.run('BEGIN TRANSACTION');

      if (isFirstChunk) {
        db.run(
          `INSERT INTO import_logs (module_type, file_name, row_count, imported_at) VALUES ('dispatch_fish', ?, ?, DATETIME('now'))`,
          [fileName, items.length]
        );
      }

      const stmt = db.prepare(`
        INSERT INTO dispatch_fish_details (
          fast_pass_info, item_type, order_no, source_category, pcs, cost_total,
          item_id, item_name, pm_user, release_date, release_time,
          appoint_date, rec_date, rec_time, remark, check_date, check_time,
          supplier_id, supplier_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_no, item_id) DO UPDATE SET
          fast_pass_info = EXCLUDED.fast_pass_info,
          item_type = EXCLUDED.item_type,
          source_category = EXCLUDED.source_category,
          pcs = EXCLUDED.pcs,
          cost_total = EXCLUDED.cost_total,
          item_name = EXCLUDED.item_name,
          pm_user = EXCLUDED.pm_user,
          release_date = EXCLUDED.release_date,
          release_time = EXCLUDED.release_time,
          appoint_date = EXCLUDED.appoint_date,
          rec_date = EXCLUDED.rec_date,
          rec_time = EXCLUDED.rec_time,
          remark = EXCLUDED.remark,
          check_date = EXCLUDED.check_date,
          check_time = EXCLUDED.check_time,
          supplier_id = EXCLUDED.supplier_id,
          supplier_name = EXCLUDED.supplier_name,
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

        const order_no = getVal('來源單號', 'order_no');
        const item_id = getVal('商品ID', '商品編號', 'item_id');

        if (!order_no || !item_id || !/^(BR|BY)/i.test(order_no)) {
          continue;
        }

        const source_category = order_no.toUpperCase().startsWith('BR') ? '借貨商品' : '採購商品';
        const fast_pass_info = getVal('快速通關資訊', 'fast_pass_info');
        const item_type = getVal('類型', 'item_type');
        const pcs = getNum('PCS數', 'pcs');
        const cost_total = getNum('成本總計', 'cost_total');
        const item_name = getVal('商品名稱', 'item_name');
        const pm_user = getVal('PM', 'pm_user');
        const release_date = standardizeDate(getVal('放行日期', 'release_date'));
        const release_time = standardizeTime(getVal('放行時間', 'release_time'));
        const appoint_date = standardizeDate(getVal('預約入庫日', 'appoint_date'));
        const rec_date = standardizeDate(getVal('收貨日期', 'rec_date'));
        const rec_time = standardizeTime(getVal('收貨時間', 'rec_time'));
        const remark = getVal('備註', 'remark');
        const check_date = standardizeDate(getVal('驗收日期', 'check_date'));
        const check_time = standardizeTime(getVal('驗收時間', 'check_time'));
        const supplier_id = getVal('供應商編號', 'supplier_id');
        const supplier_name = getVal('供應商名稱', 'supplier_name');

        stmt.run(
          fast_pass_info, item_type, order_no, source_category, pcs, cost_total,
          item_id, item_name, pm_user, release_date, release_time,
          appoint_date, rec_date, rec_time, remark, check_date, check_time,
          supplier_id, supplier_name
        );
        processedCount++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '收發魚群資料寫入失敗：' + err.message });
        res.json({ success: true, count: processedCount, message: `成功同步 ${processedCount} 筆收發魚群資料！` });
      });
    });
  });

  // 3. 單日時段魚群分析 API
  router.get('/fish-analysis', (req, res) => {
    const { targetDate } = req.query;

    let sql = `SELECT * FROM dispatch_fish_details WHERE 1=1`;
    const params = [];

    if (targetDate) {
      sql += ` AND (rec_date = ? OR check_date = ?)`;
      params.push(targetDate, targetDate);
    }

    sql = applyFilters(sql, params, req.query);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      rows = rows || [];

      // 若有異常件篩選 (備註需經 JS 自然語言過濾)
      if (req.query.abnormalFilter === 'yes') {
        rows = rows.filter(r => checkIsAbnormal(r.remark));
      } else if (req.query.abnormalFilter === 'no') {
        rows = rows.filter(r => !checkIsAbnormal(r.remark));
      }

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        recOrderSet: new Set(), recPcs: 0,
        pendingOrderSet: new Set(), pendingPcs: 0,
        finOrderSet: new Set(), finPcs: 0
      }));

      // 四大維度彙整統計計數
      let onTimeCount = 0;
      let abnormalCount = 0;
      let fastPassCount = 0;
      let uncheckCount = 0;

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const hasCheck = !!(r.check_date && String(r.check_date).trim() !== '' && String(r.check_date).trim() !== 'NaT');
        const isOnTime = (r.appoint_date && r.rec_date && r.appoint_date === r.rec_date);
        const isAbnormal = checkIsAbnormal(r.remark);
        const isFastPass = !!(r.fast_pass_info && String(r.fast_pass_info).trim() !== '');
        const isUncheck = (!hasCheck && r.doc_status !== '已銷案');

        if (isOnTime) onTimeCount++;
        if (isAbnormal) abnormalCount++;
        if (isFastPass) fastPassCount++;
        if (isUncheck) uncheckCount++;

        // 依收貨時間統計收貨量
        if (r.rec_date === targetDate && r.rec_time) {
          const timeClean = String(r.rec_time).trim();
          const hourPart = timeClean.split(':')[0];
          const h = parseInt(hourPart, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (orderNo) hourlyData[h].recOrderSet.add(orderNo);
            hourlyData[h].recPcs += (r.pcs || 0);

            if (isUncheck) {
              if (orderNo) hourlyData[h].pendingOrderSet.add(orderNo);
              hourlyData[h].pendingPcs += (r.pcs || 0);
            }
          }
        }

        // 依驗收時間統計完成量
        if (r.check_date === targetDate && r.check_time) {
          const timeClean = String(r.check_time).trim();
          const hourPart = timeClean.split(':')[0];
          const h = parseInt(hourPart, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (orderNo) hourlyData[h].finOrderSet.add(orderNo);
            hourlyData[h].finPcs += (r.pcs || 0);
          }
        }
      });

      const hourlyStats = hourlyData.map(d => ({
        hour: d.hour,
        hourStr: d.hourStr,
        recOrderCount: d.recOrderSet.size, recPcs: d.recPcs,
        pendingOrderCount: d.pendingOrderSet.size, pendingPcs: d.pendingPcs,
        finOrderCount: d.finOrderSet.size, finPcs: d.finPcs
      }));

      res.json({
        success: true,
        totalFiltered: rows.length,
        metrics: { onTimeCount, abnormalCount, fastPassCount, uncheckCount },
        hourlyStats
      });
    });
  });

  // 4. 每月每日總表 API
  router.get('/monthly-summary', (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: '請提供月份 (YYYY-MM)' });

    const monthPattern = `${month}%`;
    let sql = `SELECT * FROM dispatch_fish_details WHERE (rec_date LIKE ? OR check_date LIKE ?)`;
    const params = [monthPattern, monthPattern];
    sql = applyFilters(sql, params, req.query);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      rows = rows || [];

      if (req.query.abnormalFilter === 'yes') rows = rows.filter(r => checkIsAbnormal(r.remark));
      else if (req.query.abnormalFilter === 'no') rows = rows.filter(r => !checkIsAbnormal(r.remark));

      const daysMap = {};
      const getDayObj = (d) => {
        if (!daysMap[d]) {
          daysMap[d] = {
            date: d,
            recOrderSet: new Set(), recPcs: 0,
            pendingOrderSet: new Set(),
            cohortFinOrderSet: new Set(),
            finOrderSet: new Set(), finPcs: 0
          };
        }
        return daysMap[d];
      };

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const rDate = (r.rec_date || '').trim();
        const cDate = (r.check_date || '').trim();
        const hasCheck = !!(cDate && cDate !== '' && cDate !== 'NaT');

        if (rDate && rDate.startsWith(month)) {
          const day = getDayObj(rDate);
          if (orderNo) day.recOrderSet.add(orderNo);
          day.recPcs += (r.pcs || 0);

          if (!hasCheck && r.doc_status !== '已銷案') {
            if (orderNo) day.pendingOrderSet.add(orderNo);
          } else if (hasCheck && orderNo) {
            day.cohortFinOrderSet.add(orderNo);
          }
        }

        if (cDate && cDate.startsWith(month)) {
          const day = getDayObj(cDate);
          if (orderNo) day.finOrderSet.add(orderNo);
          day.finPcs += (r.pcs || 0);
        }
      });

      const dailyList = Object.keys(daysMap).sort().map(d => {
        const item = daysMap[d];
        const recCount = item.recOrderSet.size;
        const cohortFinCount = item.cohortFinOrderSet.size;
        const rateVal = recCount > 0 ? (cohortFinCount / recCount) * 100 : 0;

        return {
          date: item.date,
          recOrderCount: recCount,
          recPcs: item.recPcs,
          pendingOrderCount: item.pendingOrderSet.size,
          finOrderCount: item.finOrderSet.size,
          finPcs: item.finPcs,
          finishRate: Math.min(100, rateVal).toFixed(2) + '%'
        };
      });

      res.json({ success: true, month, dailyList });
    });
  });

  // 5. 年度每月總表 API
  router.get('/yearly-summary', (req, res) => {
    const { year } = req.query;
    if (!year) return res.status(400).json({ success: false, message: '請提供年份 (YYYY)' });

    const yearPattern = `${year}%`;
    let sql = `SELECT * FROM dispatch_fish_details WHERE (rec_date LIKE ? OR check_date LIKE ?)`;
    const params = [yearPattern, yearPattern];
    sql = applyFilters(sql, params, req.query);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      rows = rows || [];

      if (req.query.abnormalFilter === 'yes') rows = rows.filter(r => checkIsAbnormal(r.remark));
      else if (req.query.abnormalFilter === 'no') rows = rows.filter(r => !checkIsAbnormal(r.remark));

      const monthMap = {};
      for (let m = 1; m <= 12; m++) {
        const mKey = `${year}-${String(m).padStart(2, '0')}`;
        monthMap[mKey] = {
          month: mKey,
          monthLabel: `${String(m).padStart(2, '0')}月`,
          recOrderSet: new Set(), recPcs: 0,
          pendingOrderSet: new Set(),
          cohortFinOrderSet: new Set(),
          finOrderSet: new Set(), finPcs: 0
        };
      }

      rows.forEach(r => {
        const orderNo = (r.order_no || '').trim();
        const rDate = (r.rec_date || '').trim();
        const cDate = (r.check_date || '').trim();
        const hasCheck = !!(cDate && cDate !== '' && cDate !== 'NaT');

        if (rDate && rDate.startsWith(year)) {
          const mKey = rDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (orderNo) monthMap[mKey].recOrderSet.add(orderNo);
            monthMap[mKey].recPcs += (r.pcs || 0);

            if (!hasCheck && r.doc_status !== '已銷案') {
              if (orderNo) monthMap[mKey].pendingOrderSet.add(orderNo);
            } else if (hasCheck && orderNo) {
              monthMap[mKey].cohortFinOrderSet.add(orderNo);
            }
          }
        }

        if (cDate && cDate.startsWith(year)) {
          const mKey = cDate.substring(0, 7);
          if (monthMap[mKey]) {
            if (orderNo) monthMap[mKey].finOrderSet.add(orderNo);
            monthMap[mKey].finPcs += (r.pcs || 0);
          }
        }
      });

      const monthlyList = Object.keys(monthMap).sort().map(m => {
        const item = monthMap[m];
        const recCount = item.recOrderSet.size;
        const cohortFinCount = item.cohortFinOrderSet.size;
        const rateVal = recCount > 0 ? (cohortFinCount / recCount) * 100 : 0;

        return {
          month: item.month,
          monthLabel: item.monthLabel,
          recOrderCount: recCount, recPcs: item.recPcs,
          pendingOrderCount: item.pendingOrderSet.size,
          finOrderCount: item.finOrderSet.size, finPcs: item.finPcs,
          finishRate: Math.min(100, rateVal).toFixed(2) + '%'
        };
      });

      res.json({ success: true, year, monthlyList });
    });
  });

  // 6. 未驗收日期選單 API
  router.get('/pending-dates', (req, res) => {
    const sql = `
      SELECT rec_date, COUNT(*) as count 
      FROM dispatch_fish_details 
      WHERE (check_date IS NULL OR check_date = '' OR check_date = 'NaT') 
        AND (doc_status IS NULL OR doc_status != '已銷案')
        AND rec_date != ''
      GROUP BY rec_date
      ORDER BY rec_date DESC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 7. 未驗收明細 API
  router.get('/pending-details', (req, res) => {
    let { targetDate, date, hour, month, year } = req.query;

    let sql = `
      SELECT * FROM dispatch_fish_details
      WHERE (check_date IS NULL OR check_date = '' OR check_date = ' ' OR check_date = 'NaT' OR INSTR(check_date, '-') = 0)
        AND (doc_status IS NULL OR doc_status != '已銷案')
    `;
    const params = [];

    const effectiveDate = date || targetDate;
    if (effectiveDate) {
      sql += ` AND rec_date = ?`;
      params.push(effectiveDate);
    } else if (month) {
      sql += ` AND rec_date LIKE ?`;
      params.push(`${month}%`);
    } else if (year) {
      sql += ` AND rec_date LIKE ?`;
      params.push(`${year}%`);
    }

    if (hour !== undefined && hour !== null && hour !== '') {
      const hStr = String(hour).padStart(2, '0');
      sql += ` AND (rec_time LIKE ? OR rec_time LIKE ?)`;
      params.push(`${hStr}:%`, `${parseInt(hour, 10)}:%`);
    }

    sql = applyFilters(sql, params, req.query);
    sql += ` ORDER BY rec_date DESC, rec_time DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: '查詢未驗收明細失敗：' + err.message });
      rows = rows || [];

      if (req.query.abnormalFilter === 'yes') rows = rows.filter(r => checkIsAbnormal(r.remark));
      else if (req.query.abnormalFilter === 'no') rows = rows.filter(r => !checkIsAbnormal(r.remark));

      res.json({ success: true, totalPending: rows.length, pendingList: rows });
    });
  });

  // 8. 手動銷案 API
  router.post('/close-order', (req, res) => {
    const { keys, startDate, endDate, closeUser, closeRemark } = req.body;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    if (startDate && endDate) {
      const sql = `
        UPDATE dispatch_fish_details
        SET check_date = ?, check_time = ?, finish_user = ?, finish_remark = ?, doc_status = '已銷案'
        WHERE (check_date IS NULL OR check_date = '' OR check_date = 'NaT')
          AND (doc_status IS NULL OR doc_status != '已銷案')
          AND rec_date BETWEEN ? AND ?
      `;
      db.run(sql, [todayStr, timeStr, closeUser || '主管銷案', closeRemark || '依區間銷案', startDate, endDate], function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: `🎉 成功結案 ${this.changes} 筆於 ${startDate} ~ ${endDate} 之未完成單據！`, count: this.changes });
      });
      return;
    }

    if (Array.isArray(keys) && keys.length > 0) {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`
          UPDATE dispatch_fish_details
          SET check_date = ?, check_time = ?, finish_user = ?, finish_remark = ?, doc_status = '已銷案'
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
          res.json({ success: true, message: `🎉 成功完成 ${count} 筆單據銷案！`, count });
        });
      });
      return;
    }

    res.status(400).json({ success: false, message: '請提供銷案對象！' });
  });

  return router;
};