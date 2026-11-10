// routes/deliveryFlow.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  function categorizeRegion(addr, zipCode) {
    const address = String(addr || '').trim();
    const zip = String(zipCode || '').trim();

    if (!address || address === 'nan' || address === 'null') return '未知/空白';

    const islands = ['澎湖', '金門', '連江', '馬祖', '琉球', '綠島', '蘭嶼'];
    if (islands.some(k => address.includes(k))) return '外島';

    const islandZips = [
      '880', '881', '882', '883', '884', '885', '890', '891', '892', '893', '894', '896',
      '929', '951', '952', '209', '210', '211', '212'
    ];
    const z3 = zip.split('.')[0].padStart(3, '0').slice(0, 3);
    if (islandZips.includes(z3)) return '外島';

    const cleanAddr = address.replace(/^\d+/, '');
    if (/^(臺北|台北|新北|基隆|桃園)/.test(cleanAddr)) return '北北基桃';
    if (/^(宜蘭|花蓮|臺東|台東)/.test(cleanAddr)) return '宜花東';
    if (/^(新竹|苗栗|臺中|台中|彰化|南投|雲林|嘉義|臺南|台南|高雄|屏東)/.test(cleanAddr)) return '中南部';

    return '其他/未識別';
  }

  function getShiftType(timeStr) {
    if (!timeStr) return '未知';
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 1) return '未知';
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return '未知';

    if (hour >= 9 && hour < 17) {
      return '日班';
    } else if (hour >= 17 || hour === 0) {
      return '夜班';
    } else if (hour >= 1 && hour < 9) {
      return '大夜班';
    }
    return '未知';
  }

  function getHourInterval(timeStr) {
    if (!timeStr) return '';
    const parts = String(timeStr).trim().split(':');
    if (parts.length >= 1) {
      const hh = parseInt(parts[0], 10);
      if (!isNaN(hh) && hh >= 0 && hh < 24) {
        return `${String(hh).padStart(2, '0')}~${String((hh + 1) % 24).padStart(2, '0')}`;
      }
    }
    return '';
  }

  // 初始化資料表：以 tracking_no 為唯一約束
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS delivery_order_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_no TEXT,
        order_no TEXT,
        region TEXT,
        shift_type TEXT,
        ship_date TEXT,
        ship_time TEXT,
        ship_interval TEXT,
        order_date TEXT,
        order_time TEXT,
        order_interval TEXT,
        pick_time TEXT,
        pick_interval TEXT,
        print_time TEXT,
        print_interval TEXT,
        carrier_name TEXT,
        receiver_name TEXT,
        zip_code TEXT,
        address TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tracking_no)
      )
    `);

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_deliv_tracking ON delivery_order_tracking(tracking_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_order_no ON delivery_order_tracking (order_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_ship_date ON delivery_order_tracking (ship_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_shift ON delivery_order_tracking (shift_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_region ON delivery_order_tracking (region)`);
  });

  // 匯入 API
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的宅配資料' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO delivery_order_tracking (
          tracking_no, order_no, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, receiver_name, zip_code, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tracking_no) DO UPDATE SET
          order_no = EXCLUDED.order_no,
          region = EXCLUDED.region,
          shift_type = EXCLUDED.shift_type,
          ship_date = EXCLUDED.ship_date,
          ship_time = EXCLUDED.ship_time,
          ship_interval = EXCLUDED.ship_interval,
          carrier_name = EXCLUDED.carrier_name,
          imported_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      for (const item of items) {
        const getV = (...keys) => {
          for (const k of keys) {
            if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
              return String(item[k]).trim();
            }
          }
          return '';
        };

        const tracking_no = getV('宅配單號', 'tracking_no');
        const order_no = getV('訂單編號', '訂單編號 ', 'order_no');
        let ship_date = getV('出貨日期', 'ship_date').replace(/\//g, '-');
        if (ship_date.includes(' ')) ship_date = ship_date.split(' ')[0];
        const ship_time = getV('出貨時間', 'ship_time');

        if (!tracking_no || tracking_no.includes('總計') || !ship_date) continue;

        const addr = getV('收件地址', 'address');
        const zip = getV('郵遞區號', 'zip_code');
        const region = categorizeRegion(addr, zip);
        const shift_type = getShiftType(ship_time);

        const ship_interval = getHourInterval(ship_time);
        let order_date = getV('接單日期', 'order_date').replace(/\//g, '-');
        if (order_date.includes(' ')) order_date = order_date.split(' ')[0];
        const order_time = getV('接單時間', 'order_time');
        const order_interval = getHourInterval(order_time);

        const pick_time = getV('開始揀貨時間', 'pick_time');
        const pick_interval = getHourInterval(pick_time);

        const print_time = getV('印宅配單時間', 'print_time');
        const print_interval = getHourInterval(print_time);

        const carrier_name = getV('宅配商', 'carrier_name');
        const receiver_name = getV('收件人', 'receiver_name');

        stmt.run(
          tracking_no, order_no, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, receiver_name, zip, addr
        );
        count++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: '匯入失敗：' + err.message });
        res.json({ success: true, count, message: `成功處理 ${count} 筆宅配記錄` });
      });
    });
  });

  // 日期選單 API
  router.get('/dates', (req, res) => {
    db.all(`
      SELECT 
        ship_date, 
        COUNT(*) as count,
        COUNT(*) as tracking_count, 
        COUNT(DISTINCT order_no) as order_count 
      FROM delivery_order_tracking 
      WHERE ship_date IS NOT NULL AND ship_date != '' 
      GROUP BY ship_date 
      ORDER BY ship_date DESC
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 🌟 分析 API：支援橫向為「接單日期 + 區間」
  router.get('/flow-analysis', (req, res) => {
    let { targetDate, region, shift, countMode } = req.query;
    countMode = countMode || 'tracking';

    const runAnalysis = (effectiveDate) => {
      let sql = `SELECT * FROM delivery_order_tracking WHERE ship_date = ?`;
      const params = [effectiveDate];

      if (region && region !== 'all') {
        sql += ` AND region = ?`;
        params.push(region);
      }
      if (shift && shift !== 'all') {
        sql += ` AND shift_type = ?`;
        params.push(shift);
      }

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        rows = rows || [];

        let processRows = rows;
        if (countMode === 'order') {
          const orderMap = new Map();
          rows.forEach(r => {
            if (!orderMap.has(r.order_no)) {
              orderMap.set(r.order_no, r);
            }
          });
          processRows = Array.from(orderMap.values());
        }

        const regions = ['北北基桃', '中南部', '宜花東', '外島', '其他/未識別'];

        // 1. 三班總計卡
        const shiftSummary = {
          '日班': { count: 0, timeSpan: '09:00 ~ 17:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } },
          '夜班': { count: 0, timeSpan: '17:00 ~ 01:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } },
          '大夜班': { count: 0, timeSpan: '01:00 ~ 09:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } }
        };

        // 2. 🌟 核心：橫軸為「接單日期 + 接單區間」的時序分佈
        // 結構：{ "2026-11-05 16~17": { date: "2026-11-05", interval: "16~17", label: "11/05 16~17", total: 0, "北北基桃": 0, ... } }
        const orderTimelineMap = {};

        processRows.forEach(r => {
          const reg = regions.includes(r.region) ? r.region : '其他/未識別';
          const sType = shiftSummary[r.shift_type] ? r.shift_type : '日班';

          shiftSummary[sType].count++;
          shiftSummary[sType].regions[reg] = (shiftSummary[sType].regions[reg] || 0) + 1;

          // 處理接單日期與區間
          const oDate = r.order_date || '未記錄日期';
          const oSlot = r.order_interval || '未記錄時段';
          const key = `${oDate} ${oSlot}`;

          if (!orderTimelineMap[key]) {
            const shortDate = oDate.length >= 10 ? oDate.slice(5) : oDate;
            orderTimelineMap[key] = {
              key,
              orderDate: oDate,
              orderInterval: oSlot,
              timelineLabel: `${shortDate} ${oSlot}`,
              total: 0,
              '北北基桃': 0,
              '中南部': 0,
              '宜花東': 0,
              '外島': 0,
              '其他/未識別': 0
            };
          }
          orderTimelineMap[key].total++;
          orderTimelineMap[key][reg]++;
        });

        // 依接單日期與時段排序（由遠到近：舊單 ➔ 新單）
        const orderTimelineFlow = Object.values(orderTimelineMap).sort((a, b) => a.key.localeCompare(b.key));

        const totalTrackingCount = rows.length;
        const totalOrderCount = new Set(rows.map(r => r.order_no)).size;

        res.json({
          success: true,
          targetDate: effectiveDate,
          countMode,
          totalCount: processRows.length,
          totalOrders: processRows.length,
          totalTrackingCount,
          totalOrderCount,
          shiftSummary,
          orderTimelineFlow // 🌟 X 軸為接單日期+區間的流線數據
        });
      });
    };

    if (!targetDate) {
      db.get(`SELECT ship_date FROM delivery_order_tracking ORDER BY ship_date DESC LIMIT 1`, [], (dErr, dRow) => {
        const d = (dRow && dRow.ship_date) ? dRow.ship_date : new Date().toISOString().split('T')[0];
        runAnalysis(d);
      });
    } else {
      runAnalysis(targetDate);
    }
  });

  // 穿透明細 API
  router.get('/orders-detail', (req, res) => {
    const { targetDate, shift, orderDate, orderInterval, region } = req.query;
    let sql = `SELECT * FROM delivery_order_tracking WHERE ship_date = ?`;
    const params = [targetDate];

    if (shift && shift !== 'all') { sql += ` AND shift_type = ?`; params.push(shift); }
    if (orderDate) { sql += ` AND order_date = ?`; params.push(orderDate); }
    if (orderInterval) { sql += ` AND order_interval = ?`; params.push(orderInterval); }
    if (region && region !== 'all') { sql += ` AND region = ?`; params.push(region); }

    sql += ` ORDER BY order_date ASC, order_time ASC LIMIT 3000`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  return router;
};