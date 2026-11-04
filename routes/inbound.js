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

  // 取得全系統統一每板才數門檻輔助函式
  function getSystemThreshold(queryThreshold, callback) {
    const parsed = parseFloat(queryThreshold);
    if (!isNaN(parsed) && parsed > 0) {
      return callback(parsed);
    }
    db.get("SELECT config_value FROM system_config WHERE config_key = 'inbound_pallet_threshold'", [], (err, row) => {
      if (!err && row && row.config_value) {
        const val = parseFloat(row.config_value);
        if (!isNaN(val) && val > 0) return callback(val);
      }
      callback(30);
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
    db.run(`CREATE INDEX IF NOT EXISTS idx_inbound_rec_date ON inbound_details (rec_date)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_inbound_item_id ON inbound_details (item_id)`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_inbound_batch_no ON inbound_details (batch_no)`, () => {});
  });

  // 🌟 取得全系統統一每板才數門檻 API
  router.get('/config/pallet-threshold', (req, res) => {
    db.get("SELECT config_value FROM system_config WHERE config_key = 'inbound_pallet_threshold'", [], (err, row) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      const threshold = row && row.config_value ? parseFloat(row.config_value) : 30;
      res.json({ success: true, threshold: isNaN(threshold) ? 30 : threshold });
    });
  });

  // 🌟 最高管理者更新全系統統一每板才數門檻 API (持久化至 SQLite)
  router.post('/config/pallet-threshold', (req, res) => {
    const threshold = parseFloat(req.body.threshold) || 30;
    db.run(
      `INSERT INTO system_config (config_key, config_value) VALUES ('inbound_pallet_threshold', ?)
       ON CONFLICT(config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
      [String(threshold)],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: '更新全系統門檻失敗：' + err.message });
        res.json({ success: true, threshold, message: `⚙️ 已成功將全系統統一門檻更新為 ${threshold} 才/板！` });
      }
    );
  });

  // 1. 匯入 API
  router.post('/import-json', async (req, res) => {
    const items = req.body.items || req.body;
    const fileName = req.body.fileName || 'latest_inbound.csv';
    const isFirstChunk = req.body.isFirstChunk === true;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的進貨明細資料' });
    }

    try {
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
          res.json({ success: true, count: processedCount, message: `成功更新與處理 ${processedCount} 筆進貨資料！` });
        });
      });
    } catch (e) {
      console.error('進貨匯入異常:', e);
      res.status(500).json({ success: false, message: '匯入處理異常: ' + e.message });
    }
  });

  // 2. 未上架摘要統計
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

  // 3. 未上架明細 API
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

  // 5. 單日魚群分析 API (增強：精準區分當日件 vs 歷史前幾日件之已上架與未上架)
  router.get('/fish-analysis', (req, res) => {
    const { targetDate, warehouse, remarks } = req.query;

    if (!targetDate) {
      return res.status(400).json({ success: false, message: '請指定 targetDate (YYYY-MM-DD)' });
    }

    getSystemThreshold(req.query.threshold, (threshold) => {
      // 包含當日驗收、當日上架，以及歷史截至當日未上架的資料
      let sql = `
        SELECT * FROM inbound_details 
        WHERE (rec_date = ? OR put_date = ? OR ((put_date IS NULL OR put_date = '' OR put_date = ' ' OR INSTR(put_date, '-') = 0) AND is_resolved = 0))
      `;
      const params = [targetDate, targetDate];

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

        // 🌟 核心拆解指標集合
        const todayRecPoSet = new Set();
        let todayRecPcs = 0;

        const todayPutPoSet = new Set();      // 當天總上架 PO
        let todayPutPcs = 0;
        const sameDayPutPoSet = new Set();    // 當日驗當日上 PO
        let sameDayPutPcs = 0;
        const prevDayPutPoSet = new Set();    // 跨日消化歷史 PO
        let prevDayPutPcs = 0;

        const todayUnputPoSet = new Set();    // 當日到貨未上架 PO
        let todayUnputPcs = 0;
        const historyUnputPoSet = new Set();  // 歷史（前幾日）到貨未上架 PO
        let historyUnputPcs = 0;

        const hourlyData = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          hourStr: `${String(h).padStart(2, '0')}:00 ~ ${String(h + 1).padStart(2, '0')}:00`,
          recPoSet: new Set(),
          recPoPcs: 0,
          unputPoSet: new Set(),
          unputBatSet: new Set(),
          unputCount: 0,
          putPoSet: new Set(),
          putPoPcs: 0,
          recBatSet: new Set(),
          putBatSet: new Set(),
          palletBatchCount: 0,
          palletVolume: 0,
          palletPallets: 0,
          looseBatchCount: 0,
          looseVolume: 0,
          loosePallets: 0,
          totalPallets: 0,
          palletRate: '0.00%'
        }));

        const batchMap = new Map();

        filteredRows.forEach(r => {
          const qty = Number(r.qty) || 0;
          const len = Number(r.length) || 0;
          const w = Number(r.width) || 0;
          const h = Number(r.height) || 0;
          const pieceCubicFeet = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 27000) : 0;
          const lineVolume = pieceCubicFeet * qty;
          const poNo = (r.po_no || '').trim();

          const isPut = (r.put_date && r.put_date.trim() !== '' && r.put_date.includes('-')) || r.is_resolved === 1;

          // 1. 當日到貨驗收
          if (r.rec_date === targetDate) {
            if (poNo) todayRecPoSet.add(poNo);
            todayRecPcs += qty;

            if (r.rec_time) {
              const recHour = parseInt(r.rec_time.split(':')[0], 10);
              if (!isNaN(recHour) && recHour >= 0 && recHour < 24) {
                const hStat = hourlyData[recHour];
                if (poNo) hStat.recPoSet.add(poNo);
                hStat.recPoPcs += qty;

                if (r.batch_no) {
                  const bNo = r.batch_no.trim();
                  hStat.recBatSet.add(bNo);
                  if (!batchMap.has(bNo)) {
                    batchMap.set(bNo, { hour: recHour, volume: 0, qty: 0 });
                  }
                  const b = batchMap.get(bNo);
                  b.volume += lineVolume;
                  b.qty += qty;
                }

                if (!isPut) {
                  if (poNo) hStat.unputPoSet.add(poNo);
                  if (r.batch_no) hStat.unputBatSet.add(r.batch_no.trim());
                  hStat.unputCount += 1;
                }
              }
            }

            // 當日未上架
            if (!isPut) {
              if (poNo) todayUnputPoSet.add(poNo);
              todayUnputPcs += qty;
            }
          }

          // 2. 當日上架統計 (區分當日件 vs 歷史前幾日件)
          if (r.put_date === targetDate) {
            if (poNo) todayPutPoSet.add(poNo);
            todayPutPcs += qty;

            if (r.rec_date === targetDate) {
              if (poNo) sameDayPutPoSet.add(poNo);
              sameDayPutPcs += qty;
            } else {
              if (poNo) prevDayPutPoSet.add(poNo);
              prevDayPutPcs += qty;
            }

            if (r.put_time) {
              const putHour = parseInt(r.put_time.split(':')[0], 10);
              if (!isNaN(putHour) && putHour >= 0 && putHour < 24) {
                const hStat = hourlyData[putHour];
                if (poNo) hStat.putPoSet.add(poNo);
                if (r.batch_no) hStat.putBatSet.add(r.batch_no.trim());
                hStat.putPoPcs += qty;
              }
            }
          }

          // 3. 歷史前幾日驗收，截至目前仍未上架
          if (r.rec_date && r.rec_date < targetDate && !isPut) {
            if (poNo) historyUnputPoSet.add(poNo);
            historyUnputPcs += qty;
          }
        });

        // 板貨 / 散貨時段聚合
        batchMap.forEach((info) => {
          const hStat = hourlyData[info.hour];
          const vol = parseFloat(info.volume.toFixed(2));

          if (vol >= threshold) {
            hStat.palletBatchCount += 1;
            hStat.palletVolume += vol;
            hStat.palletPallets += 1;
          } else {
            hStat.looseBatchCount += 1;
            hStat.looseVolume += vol;
          }
        });

        let dayPalletBat = 0, dayPalletVol = 0, dayPalletPlt = 0;
        let dayLooseBat = 0, dayLooseVol = 0, dayLoosePlt = 0;

        const hourlyStats = hourlyData.map(d => {
          const loosePallets = parseFloat((d.looseVolume / threshold).toFixed(2));
          const totalPallets = parseFloat((d.palletPallets + loosePallets).toFixed(2));
          const palletRate = totalPallets > 0 ? ((d.palletPallets / totalPallets) * 100).toFixed(2) + '%' : '0.00%';

          dayPalletBat += d.palletBatchCount;
          dayPalletVol += d.palletVolume;
          dayPalletPlt += d.palletPallets;

          dayLooseBat += d.looseBatchCount;
          dayLooseVol += d.looseVolume;
          dayLoosePlt += loosePallets;

          return {
            hourStr: d.hourStr,
            hour: d.hour,
            recPoCount: d.recPoSet.size,
            recPoPcs: d.recPoPcs,
            unputPoCount: d.unputPoSet.size,
            unputBatCount: d.unputBatSet.size,
            unputCount: d.unputCount,
            putPoCount: d.putPoSet.size,
            putPoPcs: d.putPoPcs,
            recBatCount: d.recBatSet.size,
            putBatCount: d.putBatSet.size,
            palletBatchCount: d.palletBatchCount,
            palletVolume: parseFloat(d.palletVolume.toFixed(2)),
            palletPallets: d.palletPallets,
            looseBatchCount: d.looseBatchCount,
            looseVolume: parseFloat(d.looseVolume.toFixed(2)),
            loosePallets: loosePallets,
            totalPallets: totalPallets,
            palletRate: palletRate
          };
        });

        const dayTotalPallets = parseFloat((dayPalletPlt + dayLoosePlt).toFixed(2));
        const dayPalletRate = dayTotalPallets > 0 ? ((dayPalletPlt / dayTotalPallets) * 100).toFixed(2) : '0.00';
        const dayLooseRate = dayTotalPallets > 0 ? (100 - parseFloat(dayPalletRate)).toFixed(2) : '0.00';

        res.json({
          success: true,
          threshold,
          totalFiltered: filteredRows.length,
          hourlyStats,
          // 🌟 完整拆解後的進貨單號指標
          poAnalysis: {
            todayRecPoCount: todayRecPoSet.size,
            todayRecPcs,
            todayPutPoCount: todayPutPoSet.size,
            todayPutPcs,
            sameDayPutPoCount: sameDayPutPoSet.size,
            sameDayPutPcs,
            prevDayPutPoCount: prevDayPutPoSet.size,
            prevDayPutPcs,
            todayUnputPoCount: todayUnputPoSet.size,
            todayUnputPcs,
            historyUnputPoCount: historyUnputPoSet.size,
            historyUnputPcs,
            totalUnputPoCount: todayUnputPoSet.size + historyUnputPoSet.size
          },
          cargoSummary: {
            totalVolume: parseFloat((dayPalletVol + dayLooseVol).toFixed(2)),
            totalPallets: dayTotalPallets,
            palletBatchCount: dayPalletBat,
            palletVolume: parseFloat(dayPalletVol.toFixed(2)),
            palletPallets: dayPalletPlt,
            palletRate: dayPalletRate + '%',
            looseBatchCount: dayLooseBat,
            looseVolume: parseFloat(dayLooseVol.toFixed(2)),
            loosePallets: parseFloat(dayLoosePlt.toFixed(2)),
            looseRate: dayLooseRate + '%'
          }
        });
      });
    });
  });

  // 6. 每月每日總表 API (加入板貨 / 散貨統計)
  router.get('/monthly-summary', (req, res) => {
    const { month, warehouse, remarks } = req.query;

    if (!month) {
      return res.status(400).json({ success: false, message: '請提供查詢月份 (YYYY-MM)' });
    }

    getSystemThreshold(req.query.threshold, (threshold) => {
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
        const dayBatchMap = {};

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
                recPutMatchedPcs: 0,
                palletBatchCount: 0,
                palletVolume: 0,
                palletPallets: 0,
                looseBatchCount: 0,
                looseVolume: 0,
                loosePallets: 0,
                totalPallets: 0,
                palletRate: '0.00%'
              };
              dayBatchMap[d] = new Map();
            }

            if (r.po_no) daysInMonthMap[d].recPoSet.add(r.po_no.trim());
            if (r.batch_no) daysInMonthMap[d].recBatSet.add(r.batch_no.trim());
            const qty = r.qty || 0;
            daysInMonthMap[d].recPcs += qty;

            const length = r.length || 0;
            const width = r.width || 0;
            const height = r.height || 0;
            let lineVolume = 0;
            if (length > 0 && width > 0 && height > 0 && qty > 0) {
              const singleCf = (length * width * height) / 27000;
              lineVolume = singleCf * qty;
              daysInMonthMap[d].recCubicFeet += lineVolume;
            }

            if (r.batch_no) {
              const bNo = r.batch_no.trim();
              const curVol = dayBatchMap[d].get(bNo) || 0;
              dayBatchMap[d].set(bNo, curVol + lineVolume);
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
                recPutMatchedPcs: 0,
                palletBatchCount: 0,
                palletVolume: 0,
                palletPallets: 0,
                looseBatchCount: 0,
                looseVolume: 0,
                loosePallets: 0,
                totalPallets: 0,
                palletRate: '0.00%'
              };
              dayBatchMap[d] = new Map();
            }
            if (r.po_no) daysInMonthMap[d].putPoSet.add(r.po_no.trim());
            if (r.batch_no) daysInMonthMap[d].putBatSet.add(r.batch_no.trim());
            daysInMonthMap[d].putPcs += (r.qty || 0);
          }
        });

        Object.keys(dayBatchMap).forEach(d => {
          const map = dayBatchMap[d];
          const dayStat = daysInMonthMap[d];
          map.forEach((vol) => {
            const v = parseFloat(vol.toFixed(2));
            if (v >= threshold) {
              dayStat.palletBatchCount += 1;
              dayStat.palletVolume += v;
              dayStat.palletPallets += 1;
            } else {
              dayStat.looseBatchCount += 1;
              dayStat.looseVolume += v;
            }
          });
          dayStat.loosePallets = parseFloat((dayStat.looseVolume / threshold).toFixed(2));
          dayStat.totalPallets = parseFloat((dayStat.palletPallets + dayStat.loosePallets).toFixed(2));
          dayStat.palletRate = dayStat.totalPallets > 0 ? ((dayStat.palletPallets / dayStat.totalPallets) * 100).toFixed(2) + '%' : '0.00%';
        });

        let mPalletBat = 0, mPalletVol = 0, mPalletPlt = 0;
        let mLooseBat = 0, mLooseVol = 0, mLoosePlt = 0;

        const dailyList = Object.keys(daysInMonthMap).sort().map(d => {
          const item = daysInMonthMap[d];
          const putRateVal = item.recPcs > 0 ? (item.recPutMatchedPcs / item.recPcs) * 100 : 0;

          mPalletBat += item.palletBatchCount;
          mPalletVol += item.palletVolume;
          mPalletPlt += item.palletPallets;

          mLooseBat += item.looseBatchCount;
          mLooseVol += item.looseVolume;
          mLoosePlt += item.loosePallets;

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
            putRate: Math.min(100, putRateVal).toFixed(2) + '%',
            palletBatchCount: item.palletBatchCount,
            palletVolume: parseFloat(item.palletVolume.toFixed(2)),
            palletPallets: item.palletPallets,
            looseBatchCount: item.looseBatchCount,
            looseVolume: parseFloat(item.looseVolume.toFixed(2)),
            loosePallets: item.loosePallets,
            totalPallets: item.totalPallets,
            palletRate: item.palletRate
          };
        });

        const mTotalPallets = parseFloat((mPalletPlt + mLoosePlt).toFixed(2));
        const mPalletRate = mTotalPallets > 0 ? ((mPalletPlt / mTotalPallets) * 100).toFixed(2) : '0.00';
        const mLooseRate = mTotalPallets > 0 ? (100 - parseFloat(mPalletRate)).toFixed(2) : '0.00';

        res.json({
          success: true,
          month,
          threshold,
          dailyList,
          cargoSummary: {
            totalVolume: parseFloat((mPalletVol + mLooseVol).toFixed(2)),
            totalPallets: mTotalPallets,
            palletBatchCount: mPalletBat,
            palletVolume: parseFloat(mPalletVol.toFixed(2)),
            palletPallets: mPalletPlt,
            palletRate: mPalletRate + '%',
            looseBatchCount: mLooseBat,
            looseVolume: parseFloat(mLooseVol.toFixed(2)),
            loosePallets: parseFloat(mLoosePlt.toFixed(2)),
            looseRate: mLooseRate + '%'
          }
        });
      });
    });
  });

  // 7. 年度每月總表 API (加入板貨 / 散貨統計)
  router.get('/yearly-summary', (req, res) => {
    const { year, warehouse, remarks } = req.query;

    if (!year) {
      return res.status(400).json({ success: false, message: '請提供查詢年份 (YYYY)' });
    }

    getSystemThreshold(req.query.threshold, (threshold) => {
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
        const monthBatchMap = {};

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
            recPutMatchedPcs: 0,
            palletBatchCount: 0,
            palletVolume: 0,
            palletPallets: 0,
            looseBatchCount: 0,
            looseVolume: 0,
            loosePallets: 0,
            totalPallets: 0,
            palletRate: '0.00%'
          };
          monthBatchMap[mStr] = new Map();
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
              let lineVolume = 0;
              if (length > 0 && width > 0 && height > 0 && qty > 0) {
                const singleCf = (length * width * height) / 27000;
                lineVolume = singleCf * qty;
                monthsMap[mStr].recCubicFeet += lineVolume;
              }

              if (r.batch_no) {
                const bNo = r.batch_no.trim();
                const curVol = monthBatchMap[mStr].get(bNo) || 0;
                monthBatchMap[mStr].set(bNo, curVol + lineVolume);
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

        Object.keys(monthBatchMap).forEach(mStr => {
          const map = monthBatchMap[mStr];
          const mStat = monthsMap[mStr];
          map.forEach((vol) => {
            const v = parseFloat(vol.toFixed(2));
            if (v >= threshold) {
              mStat.palletBatchCount += 1;
              mStat.palletVolume += v;
              mStat.palletPallets += 1;
            } else {
              mStat.looseBatchCount += 1;
              mStat.looseVolume += v;
            }
          });
          mStat.loosePallets = parseFloat((mStat.looseVolume / threshold).toFixed(2));
          mStat.totalPallets = parseFloat((mStat.palletPallets + mStat.loosePallets).toFixed(2));
          mStat.palletRate = mStat.totalPallets > 0 ? ((mStat.palletPallets / mStat.totalPallets) * 100).toFixed(2) + '%' : '0.00%';
        });

        let yPalletBat = 0, yPalletVol = 0, yPalletPlt = 0;
        let yLooseBat = 0, yLooseVol = 0, yLoosePlt = 0;

        const monthlyList = Object.keys(monthsMap).sort().map(m => {
          const item = monthsMap[m];
          const putRateVal = item.recPcs > 0 ? (item.recPutMatchedPcs / item.recPcs) * 100 : 0;

          yPalletBat += item.palletBatchCount;
          yPalletVol += item.palletVolume;
          yPalletPlt += item.palletPallets;

          yLooseBat += item.looseBatchCount;
          yLooseVol += item.looseVolume;
          yLoosePlt += item.loosePallets;

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
            putRate: Math.min(100, putRateVal).toFixed(2) + '%',
            palletBatchCount: item.palletBatchCount,
            palletVolume: parseFloat(item.palletVolume.toFixed(2)),
            palletPallets: item.palletPallets,
            looseBatchCount: item.looseBatchCount,
            looseVolume: parseFloat(item.looseVolume.toFixed(2)),
            loosePallets: item.loosePallets,
            totalPallets: item.totalPallets,
            palletRate: item.palletRate
          };
        });

        const yTotalPallets = parseFloat((yPalletPlt + yLoosePlt).toFixed(2));
        const yPalletRate = yTotalPallets > 0 ? ((yPalletPlt / yTotalPallets) * 100).toFixed(2) : '0.00';
        const yLooseRate = yTotalPallets > 0 ? (100 - parseFloat(yPalletRate)).toFixed(2) : '0.00';

        res.json({
          success: true,
          year,
          threshold,
          monthlyList,
          cargoSummary: {
            totalVolume: parseFloat((yPalletVol + yLooseVol).toFixed(2)),
            totalPallets: yTotalPallets,
            palletBatchCount: yPalletBat,
            palletVolume: parseFloat(yPalletVol.toFixed(2)),
            palletPallets: yPalletPlt,
            palletRate: yPalletRate + '%',
            looseBatchCount: yLooseBat,
            looseVolume: parseFloat(yLooseVol.toFixed(2)),
            loosePallets: parseFloat(yLoosePlt.toFixed(2)),
            looseRate: yLooseRate + '%'
          }
        });
      });
    });
  });

  // 8. 點選批數穿透：查詢板貨或散貨的商品品項明細 API
  router.get('/cargo-details', (req, res) => {
    const { targetDate, targetMonth, targetYear, hour, type, warehouse, remarks } = req.query;

    getSystemThreshold(req.query.threshold, (threshold) => {
      let sql = `SELECT * FROM inbound_details WHERE 1=1`;
      const params = [];

      if (targetDate) {
        sql += ` AND rec_date = ?`;
        params.push(targetDate);
      } else if (targetMonth) {
        sql += ` AND rec_date LIKE ?`;
        params.push(`${targetMonth}%`);
      } else if (targetYear) {
        sql += ` AND rec_date LIKE ?`;
        params.push(`${targetYear}%`);
      }

      if (warehouse && warehouse !== 'all') {
        sql += ` AND warehouse = ?`;
        params.push(warehouse);
      }

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        rows = rows || [];
        const remarkList = Array.isArray(remarks) ? remarks : (remarks || '').split(',').map(s => s.trim()).filter(Boolean);

        const filtered = rows.filter(r => {
          if (!remarkList.length) return true;
          const rem = (r.remark || '').trim();
          let matched = false;
          if (remarkList.includes('15') && (rem.includes('15庫') || rem.includes('原15庫'))) matched = true;
          if (remarkList.includes('empty') && rem === '') matched = true;
          if (remarkList.includes('abnormal') && rem !== '' && !rem.includes('15庫')) matched = true;
          return matched;
        });

        // 依批號計算總才數
        const batchVolumeMap = new Map();
        filtered.forEach(r => {
          const qty = Number(r.qty) || 0;
          const len = Number(r.length) || 0;
          const w = Number(r.width) || 0;
          const h = Number(r.height) || 0;
          const cf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 27000) * qty : 0;
          const bNo = r.batch_no || 'UNKNOWN';
          batchVolumeMap.set(bNo, (batchVolumeMap.get(bNo) || 0) + cf);
        });

        const resultRows = [];
        filtered.forEach(r => {
          if (hour !== undefined && hour !== null && hour !== '') {
            const rHour = r.rec_time ? parseInt(r.rec_time.split(':')[0], 10) : -1;
            if (rHour !== parseInt(hour, 10)) return;
          }

          const bNo = r.batch_no || 'UNKNOWN';
          const totalBatVol = batchVolumeMap.get(bNo) || 0;

          const isPallet = (totalBatVol >= threshold);
          if (type === 'pallet' && !isPallet) return;
          if (type === 'loose' && isPallet) return;

          const qty = Number(r.qty) || 0;
          const len = Number(r.length) || 0;
          const w = Number(r.width) || 0;
          const h = Number(r.height) || 0;
          const lineCf = (len > 0 && w > 0 && h > 0) ? ((len * w * h) / 27000) * qty : 0;

          resultRows.push({
            rec_date: r.rec_date,
            rec_time: r.rec_time,
            warehouse: r.warehouse,
            po_no: r.po_no,
            batch_no: r.batch_no,
            item_id: r.item_id,
            item_name: r.item_name,
            qty: qty,
            length: len,
            width: w,
            height: h,
            line_volume: parseFloat(lineCf.toFixed(2)),
            batch_total_volume: parseFloat(totalBatVol.toFixed(2)),
            remark: r.remark || '',
            cargo_type: isPallet ? '板貨' : '散貨'
          });
        });

        res.json({
          success: true,
          type,
          threshold,
          count: resultRows.length,
          data: resultRows
        });
      });
    });
  });

  // 9. 依日期區間批次銷案 API
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