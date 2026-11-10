// routes/deliveryFlow.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 1. 區域分類函數 (對齊 process_region.py)
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

  // 2. 班別判定函數：日班 (09~17)、夜班 (17~01)、大夜班 (01~09)
  function getShiftType(timeStr) {
    if (!timeStr) return '未知';
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 1) return '未知';
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return '未知';

    if (hour >= 9 && hour < 17) {
      return '日班'; // 09:00:00 ~ 16:59:59
    } else if (hour >= 17 || hour === 0) {
      return '夜班'; // 17:00:00 ~ 00:59:59
    } else if (hour >= 1 && hour < 9) {
      return '大夜班'; // 01:00:00 ~ 08:59:59
    }
    return '未知';
  }

  // 3. 時段區間格式化 (01:22:40 -> 01~02)
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

  // 初始化資料表與索引
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS delivery_order_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        UNIQUE(order_no, ship_date, ship_time)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_ship_date ON delivery_order_tracking (ship_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_shift ON delivery_order_tracking (shift_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_region ON delivery_order_tracking (region)`);
  });

  // 匯入 API (支援分批快速寫入)
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的宅配資料' });
    }

    db.serialize(() => {
      db.run('PRAGMA synchronous = OFF');
      db.run('PRAGMA journal_mode = MEMORY');
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO delivery_order_tracking (
          order_no, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, receiver_name, zip_code, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_no, ship_date, ship_time) DO UPDATE SET
          region = EXCLUDED.region,
          shift_type = EXCLUDED.shift_type,
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

        const order_no = getV('訂單編號', '訂單編號 ', 'order_no');
        const ship_date = getV('出貨日期', 'ship_date').replace(/\//g, '-');
        const ship_time = getV('出貨時間', 'ship_time');

        if (!order_no || !ship_date) continue;

        const addr = getV('收件地址', 'address');
        const zip = getV('郵遞區號', 'zip_code');
        const region = categorizeRegion(addr, zip);
        const shift_type = getShiftType(ship_time);

        const ship_interval = getHourInterval(ship_time);
        const order_date = getV('接單日期', 'order_date').replace(/\//g, '-');
        const order_time = getV('接單時間', 'order_time');
        const order_interval = getHourInterval(order_time);

        const pick_time = getV('開始揀貨時間', 'pick_time');
        const pick_interval = getHourInterval(pick_time);

        const print_time = getV('印宅配單時間', 'print_time');
        const print_interval = getHourInterval(print_time);

        const carrier_name = getV('宅配商', 'carrier_name');
        const receiver_name = getV('收件人', 'receiver_name');

        stmt.run(
          order_no, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, receiver_name, zip, addr
        );
        count++;
      }

      stmt.finalize();
      db.run('COMMIT', (err) => {
        db.run('PRAGMA synchronous = NORMAL');
        if (err) return res.status(500).json({ success: false, message: '匯入失敗：' + err.message });
        res.json({ success: true, count, message: `🎉 成功處理並匯入 ${count} 筆宅配訂單！` });
      });
    });
  });

  // 日期選單 API
  router.get('/dates', (req, res) => {
    db.all(`SELECT ship_date, COUNT(*) as count FROM delivery_order_tracking GROUP BY ship_date ORDER BY ship_date DESC`, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 流線圖與三班分析 API
  router.get('/flow-analysis', (req, res) => {
    const { targetDate } = req.query;
    if (!targetDate) return res.status(400).json({ success: false, message: '請指定出貨日期 (YYYY-MM-DD)' });

    const sql = `SELECT * FROM delivery_order_tracking WHERE ship_date = ?`;
    db.all(sql, [targetDate], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      rows = rows || [];

      const regions = ['北北基桃', '中南部', '宜花東', '外島', '其他/未識別'];
      const hourlyFlow = Array.from({ length: 24 }, (_, h) => {
        const slot = `${String(h).padStart(2, '0')}~${String((h + 1) % 24).padStart(2, '0')}`;
        const item = { hour: h, slot, total: 0 };
        regions.forEach(r => { item[r] = 0; });
        return item;
      });

      // 三班指標結構
      const shiftSummary = {
        '日班': { count: 0, timeSpan: '09:00 ~ 17:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } },
        '夜班': { count: 0, timeSpan: '17:00 ~ 01:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } },
        '大夜班': { count: 0, timeSpan: '01:00 ~ 09:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } }
      };

      // 觀察表矩陣：某班別處理哪時接的訂單 (接單區間分佈)
      const shiftOrderMap = { '日班': {}, '夜班': {}, '大夜班': {} };

      rows.forEach(r => {
        const h = r.ship_time ? parseInt(r.ship_time.split(':')[0], 10) : -1;
        const reg = regions.includes(r.region) ? r.region : '其他/未識別';

        if (h >= 0 && h < 24) {
          hourlyFlow[h].total++;
          hourlyFlow[h][reg]++;
        }

        const sType = shiftSummary[r.shift_type] ? r.shift_type : '日班';
        shiftSummary[sType].count++;
        shiftSummary[sType].regions[reg] = (shiftSummary[sType].regions[reg] || 0) + 1;

        const oSlot = r.order_interval || '未記錄';
        if (!shiftOrderMap[sType][oSlot]) shiftOrderMap[sType][oSlot] = 0;
        shiftOrderMap[sType][oSlot]++;
      });

      res.json({
        success: true,
        targetDate,
        totalOrders: rows.length,
        shiftSummary,
        hourlyFlow,
        shiftOrderMap
      });
    });
  });

  // 穿透訂單明細 API
  router.get('/orders-detail', (req, res) => {
    const { targetDate, shift, hour, region } = req.query;
    let sql = `SELECT * FROM delivery_order_tracking WHERE ship_date = ?`;
    const params = [targetDate];

    if (shift) { sql += ` AND shift_type = ?`; params.push(shift); }
    if (hour !== undefined && hour !== null && hour !== '') {
      const hStr = String(hour).padStart(2, '0');
      sql += ` AND ship_time LIKE ?`;
      params.push(`${hStr}:%`);
    }
    if (region && region !== 'all') { sql += ` AND region = ?`; params.push(region); }

    sql += ` ORDER BY ship_time ASC LIMIT 2000`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  return router;
};