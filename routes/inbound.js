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

  const normalizeKey = (str) => {
    if (!str) return '';
    return String(str).trim().toUpperCase().replace(/\s+/g, '');
  };

  const getTurnoverLevelInfo = (monthsVal) => {
    const months = Number(monthsVal) || 0;
    if (months >= 99999) return { code: 'm99999', label: '🚨 99999 滯銷品' };
    if (months > 120) return { code: 'gt120', label: '10 年以上 (>120個月)' };
    if (months >= 61) return { code: 'm61_120', label: '5 年～10 年 (61~120個月)' };
    if (months >= 13) return { code: 'm13_60', label: '1 年～5 年 (13~60個月)' };
    if (months >= 9) return { code: 'm9_12', label: '9~12個月' };
    if (months >= 6) return { code: 'm6_9', label: '6~9個月' };
    if (months >= 3) return { code: 'm3_6', label: '3~6個月' };
    return { code: 'le3', label: '<=3個月' };
  };

  // 🌟 自動產生不合理進貨快照輔助函式
  function autoSnapshotInbound(targetDate) {
    if (!targetDate) return;

    const historySql = `SELECT * FROM item_sales_history`;
    const notesSql = `SELECT * FROM item_custom_notes`;
    const inv80Sql = `SELECT * FROM inventory`;
    const inv15Sql = `SELECT * FROM inventory_15`;
    const inSql = `
      SELECT warehouse, rec_date, rec_time, po_no, batch_no, item_id, item_name,
             IFNULL(qty, 0) AS import_qty, IFNULL(length, 0) AS length,
             IFNULL(width, 0) AS width, IFNULL(height, 0) AS height
      FROM inbound_details
      WHERE rec_date = ?
    `;

    db.all(historySql, [], (errH, rowsH) => {
      if (errH) return console.error('快照銷量讀取錯誤:', errH.message);
      db.all(notesSql, [], (errN, rowsN) => {
        db.all(inv80Sql, [], (err80, rows80) => {
          db.all(inv15Sql, [], (err15, rows15) => {
            db.all(inSql, [targetDate], (errIn, inboundRows) => {
              if (errIn || !inboundRows || inboundRows.length === 0) return;

              const notesMap = new Map();
              (rowsN || []).forEach(n => {
                const k = normalizeKey(n.item_id);
                if (k) notesMap.set(k, { is_gift: Number(n.is_gift) === 1, remark: n.remark || '' });
              });

              const invMap = new Map();
              (rowsH || []).forEach(row => {
                const k = normalizeKey(row.item_id);
                if (!k) return;
                invMap.set(k, {
                  total_qty: Number(row.total_stock_qty || row.stock_qty_80 || 0),
                  sales_90d: Number(row.sales_90d || 0),
                  monthly_sales: Number(row.monthly_sales || 0),
                  turn_days_total: 0,
                  age: 0,
                  is_history_recorded: true,
                  supplier_name: String(row.supplier_name || '').trim() || '未知供應商',
                  pm: String(row.pm || '').trim() || '未指定PM'
                });
              });

              const mergeInv = (row) => {
                const k = normalizeKey(row.item_id || row['商品ID']);
                if (!k) return;
                const locQty = Number(row.qty || row['儲位庫存數']) || 0;
                const rawTotal = Number(row.total_qty || row['總庫存數']) || 0;
                const s90 = Number(row.sales_90d || row['(近)90日銷量']) || 0;
                const mSales = Number(row.monthly_sales || row['(近)月銷量']) || 0;
                const turnM = Number(row.turn_days_total || row['總庫存_迴轉天數']) || 0;
                const ageVal = Number(row.age || row['庫齡']) || 0;
                const pmVal = String(row.pm || row['所屬PM'] || '').trim();
                const suppVal = String(row.supplier_name || row['供應商名稱'] || '').trim();

                if (invMap.has(k)) {
                  const exist = invMap.get(k);
                  exist.total_qty = Math.max(exist.total_qty, rawTotal, locQty);
                  exist.sales_90d = Math.max(exist.sales_90d, s90);
                  exist.monthly_sales = Math.max(exist.monthly_sales, mSales);
                  exist.age = Math.max(exist.age, ageVal);
                  exist.turn_days_total = Math.max(exist.turn_days_total, turnM);
                  if ((!exist.pm || exist.pm === '未指定PM') && pmVal) exist.pm = pmVal;
                  if ((!exist.supplier_name || exist.supplier_name === '未知供應商') && suppVal) exist.supplier_name = suppVal;
                } else {
                  invMap.set(k, {
                    total_qty: Math.max(rawTotal, locQty),
                    sales_90d: s90,
                    monthly_sales: mSales,
                    turn_days_total: turnM,
                    age: ageVal,
                    is_history_recorded: false,
                    supplier_name: suppVal || '未知供應商',
                    pm: pmVal || '未指定PM'
                  });
                }
              };

              (rows80 || []).forEach(mergeInv);
              (rows15 || []).forEach(mergeInv);

              const snapshotStmt = db.prepare(`
                INSERT INTO abnormal_purchase_history (
                  snapshot_date, warehouse, rec_date, rec_time, po_no, batch_no,
                  item_id, item_name, import_qty, length, width, height,
                  import_cubic_feet, stock_qty, monthly_sales, sales_90d,
                  turn_months, turnover_level, age, supplier_name, pm, abnormal_tags
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(warehouse, po_no, batch_no, item_id, rec_date) DO UPDATE SET
                  snapshot_date = EXCLUDED.snapshot_date,
                  import_qty = EXCLUDED.import_qty,
                  stock_qty = EXCLUDED.stock_qty,
                  monthly_sales = EXCLUDED.monthly_sales,
                  sales_90d = EXCLUDED.sales_90d,
                  turn_months = EXCLUDED.turn_months,
                  turnover_level = EXCLUDED.turnover_level,
                  abnormal_tags = EXCLUDED.abnormal_tags
              `);

              inboundRows.forEach(r => {
                const k = normalizeKey(r.item_id);
                const noteInfo = notesMap.get(k) || { is_gift: false };
                const inv = invMap.get(k) || {
                  total_qty: 0, sales_90d: 0, monthly_sales: 0, turn_days_total: 99999,
                  age: 0, is_history_recorded: false, supplier_name: '未知供應商', pm: '未指定PM'
                };

                const importQty = Number(r.import_qty) || 0;
                const sales90 = Number(inv.sales_90d) || 0;
                const mSales = Number(inv.monthly_sales) || 0;
                const age = Number(inv.age) || 0;
                const len = Number(r.length) || 0;
                const w = Number(r.width) || 0;
                const h = Number(r.height) || 0;

                let turnMonths = inv.turn_days_total || 0;
                if (turnMonths === 0 || turnMonths >= 99999) {
                  turnMonths = mSales > 0 ? parseFloat(((inv.total_qty + importQty) / mSales).toFixed(1)) : 99999;
                }

                const singleCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 28317) : 0;
                const importCf = parseFloat((singleCf * importQty).toFixed(2));
                const levelInfo = getTurnoverLevelInfo(turnMonths);

                const tags = [];
                if (noteInfo.is_gift) tags.push({ text: '🎁 贈品採購', type: 'info' });
                if (!inv.is_history_recorded && sales90 === 0 && age === 0) tags.push({ text: '✨ 首次建檔新品', type: 'info' });
                else if (inv.is_history_recorded && inv.total_qty === 0 && sales90 === 0) tags.push({ text: '📦 斷貨重進舊品', type: 'warning' });

                if (sales90 === 0 && importQty > 0 && !noteInfo.is_gift && inv.is_history_recorded) tags.push({ text: '🚨 90日零銷量進貨', type: 'danger' });
                else if (age >= 180) tags.push({ text: '🚨 高庫齡滯銷進貨', type: 'danger' });

                if (turnMonths > 6 && !noteInfo.is_gift) tags.push({ text: `⚠️ 迴轉月數過高 (${turnMonths >= 99999 ? '99999個月' : turnMonths + '個月'})`, type: 'warning' });
                if (sales90 > 0 && importQty >= (sales90 * 2)) tags.push({ text: `⚠️ 超量驗收 (進貨>90日銷量2倍)`, type: 'warning' });

                if (tags.length > 0) {
                  snapshotStmt.run(
                    targetDate, r.warehouse, r.rec_date, r.rec_time, r.po_no, r.batch_no,
                    r.item_id, r.item_name, importQty, len, w, h,
                    importCf, inv.total_qty, mSales, sales90,
                    turnMonths, levelInfo.label, age, inv.supplier_name, inv.pm,
                    JSON.stringify(tags)
                  );
                }
              });

              snapshotStmt.finalize();
              console.log(`📸 [自動快照] 已成功完成 ${targetDate} 的不合理進貨每日快照結算！`);
            });
          });
        });
      });
    });
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

    db.run(`ALTER TABLE inbound_details ADD COLUMN is_resolved INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE inbound_details ADD COLUMN resolve_reason TEXT`, () => {});
  });

  // 清空地端所有進貨明細 API[cite: 6]
  router.post('/clear-inbound-data', (req, res) => {
    db.run('DELETE FROM inbound_details', (err) => {
      if (err) return res.status(500).json({ success: false, message: '清空失敗：' + err.message });
      res.json({ success: true, message: '🎉 已成功清空地端所有進貨明細資料！' });
    });
  });

  // 依驗收日期刪除 API[cite: 6]
  router.post('/delete-by-date', (req, res) => {
    const { startDate, endDate, warehouse } = req.body;

    if (!startDate) {
      return res.status(400).json({ success: false, message: '請提供欲刪除的日期！' });
    }

    let sql = `DELETE FROM inbound_details WHERE 1=1`;
    const params = [];

    const targetEnd = endDate || startDate;
    sql += ` AND rec_date >= ? AND rec_date <= ?`;
    params.push(startDate, targetEnd);

    if (warehouse && warehouse !== 'all') {
      sql += ` AND warehouse = ?`;
      params.push(warehouse);
    }

    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ success: false, message: '刪除資料失敗：' + err.message });
      const whLabel = warehouse && warehouse !== 'all' ? `${warehouse} 庫` : '雙庫';
      res.json({ 
        success: true, 
        count: this.changes, 
        message: `🗑️ 成功刪除 ${whLabel} 於驗收日期 ${startDate} ${endDate ? '~ ' + endDate : ''} 共 ${this.changes} 筆進貨明細資料！` 
      });
    });
  });

  // 1. 匯入 API (支援歷史累積 + 最新上架覆蓋 + 自動觸發每日快照)[cite: 6]
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

      // 🌟 保留歷史，新檔案有上架日期時精準覆蓋[cite: 6]
      const stmt = db.prepare(`
        INSERT INTO inbound_details (
          warehouse, rec_date, rec_time, put_date, put_time,
          batch_no, po_no, remark, item_id, item_name,
          qty, length, width, height, weight
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, po_no, batch_no, item_id) DO UPDATE SET
          rec_date = CASE WHEN EXCLUDED.rec_date != '' THEN EXCLUDED.rec_date ELSE inbound_details.rec_date END,
          rec_time = CASE WHEN EXCLUDED.rec_time != '' THEN EXCLUDED.rec_time ELSE inbound_details.rec_time END,
          put_date = CASE WHEN EXCLUDED.put_date != '' THEN EXCLUDED.put_date ELSE inbound_details.put_date END,
          put_time = CASE WHEN EXCLUDED.put_time != '' THEN EXCLUDED.put_time ELSE inbound_details.put_time END,
          remark = CASE WHEN EXCLUDED.remark != '' THEN EXCLUDED.remark ELSE inbound_details.remark END,
          qty = EXCLUDED.qty,
          length = CASE WHEN EXCLUDED.length > 0 THEN EXCLUDED.length ELSE inbound_details.length END,
          width = CASE WHEN EXCLUDED.width > 0 THEN EXCLUDED.width ELSE inbound_details.width END,
          height = CASE WHEN EXCLUDED.height > 0 THEN EXCLUDED.height ELSE inbound_details.height END,
          weight = CASE WHEN EXCLUDED.weight > 0 THEN EXCLUDED.weight ELSE inbound_details.weight END,
          imported_at = CURRENT_TIMESTAMP
      `);

      let processedCount = 0;
      const importedDates = new Set();

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

        const item_id = getVal('item_id', '商品編號', '商品ID');
        const po_no = getVal('po_no', '進貨單號', '進貨單據');
        const batch_no = getVal('batch_no', '驗收批號');
        const qty_str = getVal('qty', '驗收數量', '驗收數量(PCS)');

        if (
          !item_id ||
          item_id.includes('筆數') ||
          item_id.includes('總數') ||
          po_no.includes('筆數') ||
          po_no.includes('狀態') ||
          qty_str.includes('總數') ||
          qty_str.includes('筆數')
        ) {
          continue;
        }

        let warehouse = getVal('warehouse', '__EMPTY', '__EMPTY_1', '庫別', 'Unnamed: 1') || '80';
        if (warehouse === '-') warehouse = '80';

        const rec_date = standardizeDate(getVal('rec_date', '驗收日期'));
        const rec_time = standardizeTime(getVal('rec_time', '驗收時間'));
        
        let rawPutDate = getVal('put_date', '上架日期');
        let put_date = standardizeDate(rawPutDate);

        const put_time = standardizeTime(getVal('put_time', '上架時間'));
        const remark = getVal('remark', '收貨備註', '備註');
        const item_name = getVal('item_name', '商品名稱');
        const qty = getNum('qty', '驗收數量', '驗收數量(PCS)');
        const length = getNum('length', '長(cm)');
        const width = getNum('width', '寬(cm)');
        const height = getNum('height', '高(cm)');
        const weight = getNum('weight', '重量(kg)');

        if (rec_date) importedDates.add(rec_date);

        stmt.run(
          warehouse, rec_date, rec_time, put_date, put_time,
          batch_no, po_no, remark, item_id, item_name,
          qty, length, width, height, weight
        );
        processedCount++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '進貨資料寫入失敗：' + err.message });

        // 🌟 非同步觸發當日不合理進貨自動快照結算
        setTimeout(() => {
          importedDates.forEach(d => autoSnapshotInbound(d));
        }, 100);

        res.json({ success: true, count: processedCount, message: `成功更新與處理 ${processedCount} 筆進貨資料！` });
      });
    });
  });

  // 2. 未上架摘要統計[cite: 6]
  router.get('/pending-putaway', (req, res) => {
    const sql = `
      SELECT 
        rec_date,
        COUNT(*) as pending_count,
        IFNULL(SUM(qty), 0) as total_qty
      FROM inbound_details
      WHERE rec_date IS NOT NULL 
        AND rec_date != ''
        AND (put_date IS NULL OR put_date = '' OR put_date = ' ' OR INSTR(put_date, '-') = 0)
        AND (is_resolved IS NULL OR is_resolved = 0)
      GROUP BY rec_date
      ORDER BY rec_date DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, pendingSummary: rows || [] });
    });
  });

  // 3. 未上架明細 API[cite: 6]
  router.get('/pending-details', (req, res) => {
    let { recDate } = req.query;

    const fetchDetails = (targetDate) => {
      let sql = `
        SELECT warehouse, rec_date, rec_time, batch_no, po_no, remark, item_id, item_name, qty
        FROM inbound_details
        WHERE rec_date IS NOT NULL 
          AND rec_date != ''
          AND (put_date IS NULL OR put_date = '' OR put_date = ' ' OR INSTR(put_date, '-') = 0)
          AND (is_resolved IS NULL OR is_resolved = 0)
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
        WHERE rec_date IS NOT NULL 
          AND rec_date != ''
          AND (put_date IS NULL OR put_date = '' OR put_date = ' ' OR INSTR(put_date, '-') = 0)
          AND (is_resolved IS NULL OR is_resolved = 0)
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

  // 4. 更正銷案 API[cite: 6]
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
            put_date = CASE WHEN ? != '' THEN ? ELSE 'RESOLVED' END
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

  // 5. 魚群分析 API[cite: 6]
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

      const hourlyData = Array.from({ length: 24 }, (_, h) => ({
        hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
        recPoSet: new Set(),
        recPoPcs: 0,
        unputPoSet: new Set(),
        unputBatSet: new Set(),
        unputCount: 0,
        putPoSet: new Set(),
        putPoPcs: 0,
        recBatSet: new Set(),
        putBatSet: new Set()
      }));

      filteredRows.forEach(r => {
        if (r.rec_date === targetDate && r.rec_time) {
          const hStr = r.rec_time.split(':')[0];
          const h = parseInt(hStr, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (r.po_no && r.po_no.trim() !== '') {
              hourlyData[h].recPoSet.add(r.po_no.trim());
            }
            if (r.batch_no && r.batch_no.trim() !== '') {
              hourlyData[h].recBatSet.add(r.batch_no.trim());
            }
            hourlyData[h].recPoPcs += (r.qty || 0);

            const isPut = r.put_date && r.put_date.trim() !== '' && r.put_date.includes('-');
            const isResolved = r.is_resolved === 1;
            if (!isPut && !isResolved) {
              if (r.po_no && r.po_no.trim() !== '') {
                hourlyData[h].unputPoSet.add(r.po_no.trim());
              }
              if (r.batch_no && r.batch_no.trim() !== '') {
                hourlyData[h].unputBatSet.add(r.batch_no.trim());
              }
              hourlyData[h].unputCount += 1;
            }
          }
        }

        if (r.put_date === targetDate && r.put_time) {
          const hStr = r.put_time.split(':')[0];
          const h = parseInt(hStr, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            if (r.po_no && r.po_no.trim() !== '') {
              hourlyData[h].putPoSet.add(r.po_no.trim());
            }
            if (r.batch_no && r.batch_no.trim() !== '') {
              hourlyData[h].putBatSet.add(r.batch_no.trim());
            }
            hourlyData[h].putPoPcs += (r.qty || 0);
          }
        }
      });

      const hourlyStats = hourlyData.map(d => ({
        hourStr: d.hourStr,
        recPoCount: d.recPoSet.size,
        recPoPcs: d.recPoPcs,
        unputPoCount: d.unputPoSet.size,
        unputBatCount: d.unputBatSet.size,
        unputCount: d.unputCount,
        putPoCount: d.putPoSet.size,
        putPoPcs: d.putPoPcs,
        recBatCount: d.recBatSet.size,
        putBatCount: d.putBatSet.size
      }));

      res.json({
        success: true,
        totalFiltered: filteredRows.length,
        hourlyStats
      });
    });
  });

  // 6. 每月每日總表 API[cite: 6]
  router.get('/monthly-summary', (req, res) => {
    const { month, warehouse, remarks } = req.query;

    if (!month) {
      return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });
    }

    let sql = `SELECT * FROM inbound_details WHERE (rec_date LIKE ? OR put_date LIKE ?)`;
    const monthPattern = `${month}%`;
    const params = [monthPattern, monthPattern];

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

      const daysInMonthMap = {};

      filteredRows.forEach(r => {
        if (r.rec_date && r.rec_date.startsWith(month)) {
          const d = r.rec_date;
          if (!daysInMonthMap[d]) {
            daysInMonthMap[d] = {
              date: d,
              recPoSet: new Set(),
              recBatSet: new Set(),
              unputPoSet: new Set(),
              unputBatSet: new Set(),
              recPcs: 0,
              recCubicFeet: 0,
              putPoSet: new Set(),
              putBatSet: new Set(),
              putPcs: 0,
              recPutMatchedPcs: 0
            };
          }

          if (r.po_no) daysInMonthMap[d].recPoSet.add(r.po_no.trim());
          if (r.batch_no) daysInMonthMap[d].recBatSet.add(r.batch_no.trim());
          const qty = r.qty || 0;
          daysInMonthMap[d].recPcs += qty;

          const length = r.length || 0;
          const width = r.width || 0;
          const height = r.height || 0;
          if (length > 0 && width > 0 && height > 0 && qty > 0) {
            const singleCf = (length * width * height) / 27000;
            daysInMonthMap[d].recCubicFeet += (singleCf * qty);
          }

          const isPut = (r.put_date && r.put_date.trim() !== '' && r.put_date.includes('-')) || r.is_resolved === 1;
          if (isPut) {
            daysInMonthMap[d].recPutMatchedPcs += qty;
          } else {
            if (r.po_no && r.po_no.trim() !== '') daysInMonthMap[d].unputPoSet.add(r.po_no.trim());
            if (r.batch_no && r.batch_no.trim() !== '') daysInMonthMap[d].unputBatSet.add(r.batch_no.trim());
          }
        }

        if (r.put_date && r.put_date.startsWith(month)) {
          const d = r.put_date;
          if (!daysInMonthMap[d]) {
            daysInMonthMap[d] = {
              date: d,
              recPoSet: new Set(),
              recBatSet: new Set(),
              unputPoSet: new Set(),
              unputBatSet: new Set(),
              recPcs: 0,
              recCubicFeet: 0,
              putPoSet: new Set(),
              putBatSet: new Set(),
              putPcs: 0,
              recPutMatchedPcs: 0
            };
          }
          if (r.po_no) daysInMonthMap[d].putPoSet.add(r.po_no.trim());
          if (r.batch_no) daysInMonthMap[d].putBatSet.add(r.batch_no.trim());
          daysInMonthMap[d].putPcs += (r.qty || 0);
        }
      });

      const dailyList = Object.keys(daysInMonthMap).sort().map(d => {
        const item = daysInMonthMap[d];
        const putRateVal = item.recPcs > 0 ? (item.recPutMatchedPcs / item.recPcs) * 100 : 0;
        
        return {
          date: item.date,
          recPoCount: item.recPoSet.size,
          unputPoCount: item.unputPoSet.size,
          recBatCount: item.recBatSet.size,
          unputBatCount: item.unputBatSet.size,
          recPcs: item.recPcs,
          recCubicFeet: parseFloat(item.recCubicFeet.toFixed(2)),
          putPoCount: item.putPoSet.size,
          putBatCount: item.putBatSet.size,
          putPcs: item.putPcs,
          putRate: Math.min(100, putRateVal).toFixed(2) + '%'
        };
      });

      res.json({
        success: true,
        month,
        dailyList
      });
    });
  });

  // 7. 年度每月總表 API[cite: 6]
  router.get('/yearly-summary', (req, res) => {
    const { year, warehouse, remarks } = req.query;

    if (!year) {
      return res.status(400).json({ success: false, message: '請提供查詢年份 (YYYY)' });
    }

    let sql = `SELECT * FROM inbound_details WHERE (rec_date LIKE ? OR put_date LIKE ?)`;
    const yearPattern = `${year}%`;
    const params = [yearPattern, yearPattern];

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

      const monthsMap = {};
      for (let m = 1; m <= 12; m++) {
        const mStr = `${year}-${String(m).padStart(2, '0')}`;
        monthsMap[mStr] = {
          month: mStr,
          recPoSet: new Set(),
          recBatSet: new Set(),
          unputPoSet: new Set(),
          unputBatSet: new Set(),
          recPcs: 0,
          recCubicFeet: 0,
          putPoSet: new Set(),
          putBatSet: new Set(),
          putPcs: 0,
          recPutMatchedPcs: 0
        };
      }

      filteredRows.forEach(r => {
        if (r.rec_date && r.rec_date.startsWith(year)) {
          const mStr = r.rec_date.substring(0, 7);
          if (monthsMap[mStr]) {
            if (r.po_no) monthsMap[mStr].recPoSet.add(r.po_no.trim());
            if (r.batch_no) monthsMap[mStr].recBatSet.add(r.batch_no.trim());
            const qty = r.qty || 0;
            monthsMap[mStr].recPcs += qty;

            const length = r.length || 0;
            const width = r.width || 0;
            const height = r.height || 0;
            if (length > 0 && width > 0 && height > 0 && qty > 0) {
              const singleCf = (length * width * height) / 27000;
              monthsMap[mStr].recCubicFeet += (singleCf * qty);
            }

            const isPut = (r.put_date && r.put_date.trim() !== '' && r.put_date.includes('-')) || r.is_resolved === 1;
            if (isPut) {
              monthsMap[mStr].recPutMatchedPcs += qty;
            } else {
              if (r.po_no && r.po_no.trim() !== '') monthsMap[mStr].unputPoSet.add(r.po_no.trim());
              if (r.batch_no && r.batch_no.trim() !== '') monthsMap[mStr].unputBatSet.add(r.batch_no.trim());
            }
          }
        }

        if (r.put_date && r.put_date.startsWith(year)) {
          const mStr = r.put_date.substring(0, 7);
          if (monthsMap[mStr]) {
            if (r.po_no) monthsMap[mStr].putPoSet.add(r.po_no.trim());
            if (r.batch_no) monthsMap[mStr].putBatSet.add(r.batch_no.trim());
            monthsMap[mStr].putPcs += (r.qty || 0);
          }
        }
      });

      const monthlyList = Object.keys(monthsMap).sort().map(m => {
        const item = monthsMap[m];
        const putRateVal = item.recPcs > 0 ? (item.recPutMatchedPcs / item.recPcs) * 100 : 0;

        return {
          month: item.month,
          recPoCount: item.recPoSet.size,
          unputPoCount: item.unputPoSet.size,
          recBatCount: item.recBatSet.size,
          unputBatCount: item.unputBatSet.size,
          recPcs: item.recPcs,
          recCubicFeet: parseFloat(item.recCubicFeet.toFixed(2)),
          putPoCount: item.putPoSet.size,
          putBatCount: item.putBatSet.size,
          putPcs: item.putPcs,
          putRate: Math.min(100, putRateVal).toFixed(2) + '%'
        };
      });

      res.json({
        success: true,
        year,
        monthlyList
      });
    });
  });

  // 8. 依日期區間一鍵批次銷案 API[cite: 6]
  router.post('/batch-resolve-range', (req, res) => {
    const { startDate, endDate, reason, customPutDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '請提供開始與結束日期' });
    }

    const resolveReason = reason || '歷史資料整批自動銷案';
    const putDateValue = customPutDate || 'RESOLVED';

    const sql = `
      UPDATE inbound_details
      SET is_resolved = 1,
          resolve_reason = ?,
          remark = remark || ' [批次銷案註記: ' || ? || ']',
          put_date = ?
      WHERE rec_date >= ? AND rec_date <= ?
        AND (put_date IS NULL OR put_date = '' OR put_date = ' ' OR INSTR(put_date, '-') = 0)
        AND (is_resolved IS NULL OR is_resolved = 0)
    `;

    db.run(sql, [resolveReason, resolveReason, putDateValue, startDate, endDate], function(err) {
      if (err) return res.status(500).json({ success: false, message: '批次銷案失敗：' + err.message });
      res.json({ success: true, message: `🎉 成功完成 ${startDate} ~ ${endDate} 區間共 ${this.changes} 筆未上架記錄銷案！` });
    });
  });

  return router;
};