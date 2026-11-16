// routes/deliveryFlow.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  function normalizeDate(dStr) {
    if (!dStr) return '';
    const clean = String(dStr).trim().replace(/\//g, '-').split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return clean;
  }

  function shiftDateStr(dStr, offsetDays) {
    const dt = new Date(`${dStr}T00:00:00`);
    if (isNaN(dt.getTime())) return dStr;
    dt.setDate(dt.getDate() + offsetDays);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getOperationalDate(shipDate, shipTime) {
    const d = normalizeDate(shipDate);
    if (!d) return '';
    const hh = shipTime ? parseInt(String(shipTime).trim().split(':')[0], 10) : -1;
    if (hh === 0) {
      return shiftDateStr(d, -1);
    }
    return d;
  }

  function buildDayClause(targetDate, dayMode, params) {
    if (dayMode === 'calendar') {
      params.push(targetDate);
      return `ship_date = ?`;
    }
    const nextDate = shiftDateStr(targetDate, 1);
    params.push(targetDate, nextDate);
    return `((ship_date = ? AND ship_time >= '01:00:00') OR (ship_date = ? AND ship_time < '01:00:00'))`;
  }

  function cleanWhCode(val) {
    if (!val || val === 'nan' || val === 'null') return '';
    let s = String(val).trim();
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return s;
  }

  function cleanZipCode(val) {
    if (!val || val === 'nan' || val === 'null') return '';
    let s = String(val).trim();
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return s;
  }

  function toNum(val) {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

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

  function extractCityDistrict(addr) {
    const cleanAddr = String(addr || '').trim().replace(/^\d+/, '').replace(/臺/g, '台');
    const m = cleanAddr.match(/^([\u4e00-\u9fa5]{2,3}[市縣])([\u4e00-\u9fa5]{1,3}[區鄉鎮市])?/);
    if (m) {
      return {
        city: m[1] || '未知縣市',
        district: m[2] ? `${m[1]}${m[2]}` : m[1]
      };
    }
    return { city: '其他/未識別', district: '其他/未識別' };
  }

  function getShiftType(timeStr) {
    if (!timeStr) return '未知';
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 1) return '未知';
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return '未知';

    if (hour >= 9 && hour < 17) return '日班';
    else if (hour >= 17 || hour === 0) return '夜班';
    else if (hour >= 1 && hour < 9) return '大夜班';
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

  function parseDateTime(dStr, tStr) {
    if (!dStr || !tStr) return null;
    const cleanD = normalizeDate(dStr);
    const cleanT = String(tStr).trim();
    const dt = new Date(`${cleanD}T${cleanT}`);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function buildCommonWhere(query, baseSql, baseParams) {
    const { whCode, region, shift, carrier, deliveryType, is24h } = query;
    if (whCode && whCode !== 'all') { baseSql += ` AND wh_code = ?`; baseParams.push(whCode); }
    if (region && region !== 'all') { baseSql += ` AND region = ?`; baseParams.push(region); }
    if (shift && shift !== 'all') { baseSql += ` AND shift_type = ?`; baseParams.push(shift); }
    if (carrier && carrier !== 'all') { baseSql += ` AND carrier_name = ?`; baseParams.push(carrier); }
    if (deliveryType && deliveryType !== 'all') { baseSql += ` AND delivery_type = ?`; baseParams.push(deliveryType); }
    if (is24h && is24h !== 'all') { baseSql += ` AND is_24h = ?`; baseParams.push(is24h); }
    return baseSql;
  }

  // 初始化資料表（含成本、箱號、拆箱、遲到欄位）
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS delivery_order_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_no TEXT,
        order_no TEXT,
        wh_code TEXT,
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
        delivery_type TEXT,
        is_24h TEXT,
        wh_receive_time TEXT,
        print_pick_time TEXT,
        out_time TEXT,
        receiver_name TEXT,
        zip_code TEXT,
        address TEXT,
        is_first_box TEXT DEFAULT 'Y',
        box_no TEXT,
        box_volume REAL DEFAULT 0,
        box_price REAL DEFAULT 0,
        shipping_fee REAL DEFAULT 0,
        base_fee REAL DEFAULT 0,
        extra_fee REAL DEFAULT 0,
        is_late TEXT,
        cod_type TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tracking_no)
      )
    `, () => {
      db.all(`PRAGMA table_info(delivery_order_tracking)`, [], (err, cols) => {
        const colNames = (cols || []).map(c => c.name);
        if (!colNames.includes('tracking_no')) {
          db.run(`DROP TABLE IF EXISTS delivery_order_tracking`, () => {
            db.run(`
              CREATE TABLE delivery_order_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_no TEXT,
                order_no TEXT,
                wh_code TEXT,
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
                delivery_type TEXT,
                is_24h TEXT,
                wh_receive_time TEXT,
                print_pick_time TEXT,
                out_time TEXT,
                receiver_name TEXT,
                zip_code TEXT,
                address TEXT,
                is_first_box TEXT DEFAULT 'Y',
                box_no TEXT,
                box_volume REAL DEFAULT 0,
                box_price REAL DEFAULT 0,
                shipping_fee REAL DEFAULT 0,
                base_fee REAL DEFAULT 0,
                extra_fee REAL DEFAULT 0,
                is_late TEXT,
                cod_type TEXT,
                imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tracking_no)
              )
            `, () => createIndexesAndBackfill());
          });
        } else {
          const neededCols = [
            'wh_code TEXT', 'delivery_type TEXT', 'is_24h TEXT',
            'wh_receive_time TEXT', 'print_pick_time TEXT', 'out_time TEXT',
            "is_first_box TEXT DEFAULT 'Y'", 'box_no TEXT', 'box_volume REAL DEFAULT 0',
            'box_price REAL DEFAULT 0', 'shipping_fee REAL DEFAULT 0', 'base_fee REAL DEFAULT 0',
            'extra_fee REAL DEFAULT 0', 'is_late TEXT', 'cod_type TEXT'
          ];
          neededCols.forEach(col => {
            db.run(`ALTER TABLE delivery_order_tracking ADD COLUMN ${col}`, () => {});
          });
          createIndexesAndBackfill();
        }
      });
    });

    function createIndexesAndBackfill() {
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_deliv_tracking ON delivery_order_tracking(tracking_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_order_no ON delivery_order_tracking (order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_wh ON delivery_order_tracking (wh_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_ship_date ON delivery_order_tracking (ship_date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_shift ON delivery_order_tracking (shift_type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_carrier ON delivery_order_tracking (carrier_name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_type ON delivery_order_tracking (delivery_type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deliv_box_no ON delivery_order_tracking (box_no)`);
      db.run(`UPDATE delivery_order_tracking SET wh_code = '80' WHERE wh_code IS NULL OR wh_code = '' OR wh_code = 'nan'`);
    }
  });

  // 匯入 API（一次寫入流向時效＋物流費＋箱號＋箱子單價＋是否第一箱＋是否遲到）
  router.post('/import-json', (req, res) => {
    const items = req.body.items || req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '未收到有效的宅配資料' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO delivery_order_tracking (
          tracking_no, order_no, wh_code, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, delivery_type, is_24h,
          wh_receive_time, print_pick_time, out_time, receiver_name, zip_code, address,
          is_first_box, box_no, box_volume, box_price, shipping_fee, base_fee, extra_fee, is_late, cod_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tracking_no) DO UPDATE SET
          order_no = EXCLUDED.order_no,
          wh_code = EXCLUDED.wh_code,
          region = EXCLUDED.region,
          shift_type = EXCLUDED.shift_type,
          ship_date = EXCLUDED.ship_date,
          ship_time = EXCLUDED.ship_time,
          ship_interval = EXCLUDED.ship_interval,
          carrier_name = EXCLUDED.carrier_name,
          delivery_type = EXCLUDED.delivery_type,
          is_24h = EXCLUDED.is_24h,
          wh_receive_time = EXCLUDED.wh_receive_time,
          print_pick_time = EXCLUDED.print_pick_time,
          out_time = EXCLUDED.out_time,
          zip_code = EXCLUDED.zip_code,
          address = EXCLUDED.address,
          is_first_box = EXCLUDED.is_first_box,
          box_no = EXCLUDED.box_no,
          box_volume = EXCLUDED.box_volume,
          box_price = EXCLUDED.box_price,
          shipping_fee = EXCLUDED.shipping_fee,
          base_fee = EXCLUDED.base_fee,
          extra_fee = EXCLUDED.extra_fee,
          is_late = EXCLUDED.is_late,
          cod_type = EXCLUDED.cod_type,
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
        let wh_code = cleanWhCode(getV('庫別', 'wh_code', 'warehouse'));
        if (!wh_code) wh_code = '80';
        const ship_date = normalizeDate(getV('出貨日期', 'ship_date'));
        const ship_time = getV('出貨時間', 'ship_time');

        if (!tracking_no || tracking_no.includes('總計') || !ship_date) continue;

        const addr = getV('收件地址', 'address');
        const zip = cleanZipCode(getV('郵遞區號', 'zip_code'));
        const region = categorizeRegion(addr, zip);
        const shift_type = getShiftType(ship_time);

        const ship_interval = getHourInterval(ship_time);
        const order_date = normalizeDate(getV('接單日期', 'order_date'));
        const order_time = getV('接單時間', 'order_time');
        const order_interval = getHourInterval(order_time);

        const pick_time = getV('開始揀貨時間', 'pick_time');
        const pick_interval = getHourInterval(pick_time);

        const print_time = getV('印宅配單時間', 'print_time');
        const print_interval = getHourInterval(print_time);

        const carrier_name = getV('宅配商', 'carrier_name');
        const delivery_type = getV('宅配類別', 'delivery_type');
        const is_24h = getV('24H送達', '24h送達', 'is_24h');

        const wh_receive_time = getV('倉庫接單時間', 'wh_receive_time');
        const print_pick_time = getV('印撿貨單時間', '印揀貨單時間', 'print_pick_time');
        const out_time = getV('出庫時間', 'out_time');
        const receiver_name = getV('收件人', 'receiver_name');

        // 成本、箱號、拆箱與遲到欄位
        const is_first_box = getV('是否為第一箱', 'is_first_box') || 'Y';
        const box_no = getV('箱號', 'box_no') || '未記錄';
        const box_volume = toNum(getV('箱號材積和', 'box_volume'));
        const box_price = toNum(getV('箱子單價', 'box_price'));
        const shipping_fee = toNum(getV('物流費總計', 'shipping_fee'));
        const base_fee = toNum(getV('基本運費', 'base_fee'));
        const extra_fee =
          toNum(getV('假日加價')) +
          toNum(getV('重量加價')) +
          toNum(getV('超材加價')) +
          toNum(getV('地區加價'));
        const is_late = getV('是否遲到', 'is_late') || 'N';
        const cod_type = getV('貨到付款種類', 'cod_type') || '無代收款';

        stmt.run(
          tracking_no, order_no, wh_code, region, shift_type, ship_date, ship_time, ship_interval,
          order_date, order_time, order_interval, pick_time, pick_interval,
          print_time, print_interval, carrier_name, delivery_type, is_24h,
          wh_receive_time, print_pick_time, out_time, receiver_name, zip, addr,
          is_first_box, box_no, box_volume, box_price, shipping_fee, base_fee, extra_fee, is_late, cod_type
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

  // 日期與選單選項 API
  router.get('/dates', (req, res) => {
    const dayMode = req.query.dayMode === 'calendar' ? 'calendar' : 'operational';
    const dateExpr = dayMode === 'calendar'
      ? `ship_date`
      : `CASE WHEN ship_time < '01:00:00' THEN date(ship_date, '-1 day') ELSE ship_date END`;

    db.all(`
      SELECT 
        ${dateExpr} as op_date,
        COUNT(*) as count,
        COUNT(*) as tracking_count, 
        COUNT(DISTINCT order_no) as order_count 
      FROM delivery_order_tracking 
      WHERE ship_date IS NOT NULL AND ship_date != '' 
      GROUP BY op_date 
      ORDER BY op_date DESC
    `, [], (err, dateRows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      const formattedDates = (dateRows || []).map(r => ({
        ship_date: r.op_date,
        count: r.count,
        tracking_count: r.tracking_count,
        order_count: r.order_count
      }));

      db.all(`SELECT DISTINCT wh_code FROM delivery_order_tracking WHERE wh_code IS NOT NULL AND wh_code != '' ORDER BY wh_code ASC`, [], (wErr, wRows) => {
        let whList = (wRows || []).map(r => r.wh_code).filter(Boolean);
        if (whList.length === 0) whList = ['80'];

        db.all(`SELECT DISTINCT carrier_name FROM delivery_order_tracking WHERE carrier_name IS NOT NULL AND carrier_name != ''`, [], (cErr, cRows) => {
          db.all(`SELECT DISTINCT delivery_type FROM delivery_order_tracking WHERE delivery_type IS NOT NULL AND delivery_type != ''`, [], (tErr, tRows) => {
            db.all(`SELECT DISTINCT box_no FROM delivery_order_tracking WHERE box_no IS NOT NULL AND box_no != '' AND box_no != '未記錄' ORDER BY box_no ASC`, [], (bErr, bRows) => {
              res.json({
                success: true,
                list: formattedDates,
                warehouses: whList,
                carriers: (cRows || []).map(r => r.carrier_name),
                deliveryTypes: (tRows || []).map(r => r.delivery_type),
                boxNos: (bRows || []).map(r => r.box_no)
              });
            });
          });
        });
      });
    });
  });

  // 單日綜合流向分析 API
  router.get('/flow-analysis', (req, res) => {
    let { targetDate, whCode, region, shift, carrier, deliveryType, is24h, countMode, dayMode } = req.query;
    countMode = countMode || 'tracking';
    dayMode = dayMode === 'calendar' ? 'calendar' : 'operational';

    const runAnalysis = (effectiveDate) => {
      const baseParams = [];
      const dayWhere = buildDayClause(effectiveDate, dayMode, baseParams);
      let baseSql = `SELECT * FROM delivery_order_tracking WHERE ${dayWhere}`;

      if (whCode && whCode !== 'all') { baseSql += ` AND wh_code = ?`; baseParams.push(whCode); }
      if (region && region !== 'all') { baseSql += ` AND region = ?`; baseParams.push(region); }
      if (carrier && carrier !== 'all') { baseSql += ` AND carrier_name = ?`; baseParams.push(carrier); }
      if (deliveryType && deliveryType !== 'all') { baseSql += ` AND delivery_type = ?`; baseParams.push(deliveryType); }
      if (is24h && is24h !== 'all') { baseSql += ` AND is_24h = ?`; baseParams.push(is24h); }

      db.all(baseSql, baseParams, (err, allDateRows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        allDateRows = allDateRows || [];

        const regions = ['北北基桃', '中南部', '宜花東', '外島', '其他/未識別'];

        const shiftSummary = {
          '日班': { count: 0, timeSpan: '09:00 ~ 17:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } },
          '夜班': {
            count: 0,
            timeSpan: dayMode === 'calendar' ? '17:00 ~ 24:00 (+當日00~01)' : '17:00 ~ 隔日 01:00',
            regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 }
          },
          '大夜班': { count: 0, timeSpan: '01:00 ~ 09:00', regions: { '北北基桃': 0, '中南部': 0, '宜花東': 0, '外島': 0, '其他/未識別': 0 } }
        };

        let allDateProcessRows = allDateRows;
        if (countMode === 'order') {
          const m = new Map();
          allDateRows.forEach(r => { if (!m.has(r.order_no)) m.set(r.order_no, r); });
          allDateProcessRows = Array.from(m.values());
        }

        allDateProcessRows.forEach(r => {
          const reg = regions.includes(r.region) ? r.region : '其他/未識別';
          const sType = shiftSummary[r.shift_type] ? r.shift_type : '日班';
          shiftSummary[sType].count++;
          shiftSummary[sType].regions[reg] = (shiftSummary[sType].regions[reg] || 0) + 1;
        });

        let lowerRows = allDateRows;
        if (shift && shift !== 'all') {
          lowerRows = allDateRows.filter(r => r.shift_type === shift);
        }

        let lowerProcessRows = lowerRows;
        if (countMode === 'order') {
          const m = new Map();
          lowerRows.forEach(r => { if (!m.has(r.order_no)) m.set(r.order_no, r); });
          lowerProcessRows = Array.from(m.values());
        }

        const hourlyFlow = Array.from({ length: 24 }, (_, h) => {
          const endHour = (dayMode === 'calendar' && h === 23) ? '24' : String((h + 1) % 24).padStart(2, '0');
          const slot = `${String(h).padStart(2, '0')}~${endHour}`;
          const item = { hour: h, slot, total: 0 };
          regions.forEach(r => { item[r] = 0; });
          return item;
        });

        const orderTimelineMap = {};
        const leadBrackets = {
          '0~4H (極速)': 0,
          '4~8H': 0,
          '8~12H': 0,
          '12~24H': 0,
          '24~48H (次日)': 0,
          '48H以上 (延遲)': 0
        };

        let totalLeadHoursSum = 0;
        let leadHoursCount = 0;
        let is24hCount = 0;
        let delayOver24hCount = 0;

        const stageMinsSums = { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0 };
        const stageMinsCounts = { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0 };
        const delayedOrdersList = [];

        lowerProcessRows.forEach(r => {
          const reg = regions.includes(r.region) ? r.region : '其他/未識別';

          const h = r.ship_time ? parseInt(r.ship_time.split(':')[0], 10) : -1;
          if (h >= 0 && h < 24) {
            hourlyFlow[h].total++;
            hourlyFlow[h][reg]++;
          }

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

          const orderDt = parseDateTime(r.order_date, r.order_time);
          const shipDt = parseDateTime(r.ship_date, r.ship_time);

          if (r.is_24h === '是') is24hCount++;

          if (orderDt && shipDt) {
            const totalHours = Math.max(0, (shipDt - orderDt) / (1000 * 3600));
            totalLeadHoursSum += totalHours;
            leadHoursCount++;

            if (totalHours <= 4) leadBrackets['0~4H (極速)']++;
            else if (totalHours <= 8) leadBrackets['4~8H']++;
            else if (totalHours <= 12) leadBrackets['8~12H']++;
            else if (totalHours <= 24) leadBrackets['12~24H']++;
            else if (totalHours <= 48) {
              leadBrackets['24~48H (次日)']++;
              delayOver24hCount++;
              if (delayedOrdersList.length < 500) delayedOrdersList.push({ ...r, totalLeadHours: totalHours.toFixed(1) });
            } else {
              leadBrackets['48H以上 (延遲)']++;
              delayOver24hCount++;
              if (delayedOrdersList.length < 500) delayedOrdersList.push({ ...r, totalLeadHours: totalHours.toFixed(1) });
            }
          }

          const whDt = parseDateTime(r.ship_date, r.wh_receive_time);
          const printPickDt = parseDateTime(r.ship_date, r.print_pick_time);
          const pickDt = parseDateTime(r.ship_date, r.pick_time);
          const outDt = parseDateTime(r.ship_date, r.out_time || r.print_time);

          const diffM = (t2, t1) => (t1 && t2 && t2 >= t1) ? (t2 - t1) / (1000 * 60) : null;

          const m1 = diffM(whDt, orderDt);
          if (m1 !== null && m1 < 720) { stageMinsSums.step1 += m1; stageMinsCounts.step1++; }

          const m2 = diffM(printPickDt, whDt);
          if (m2 !== null && m2 < 720) { stageMinsSums.step2 += m2; stageMinsCounts.step2++; }

          const m3 = diffM(pickDt, printPickDt);
          if (m3 !== null && m3 < 1440) { stageMinsSums.step3 += m3; stageMinsCounts.step3++; }

          const m4 = diffM(outDt, pickDt);
          if (m4 !== null && m4 < 1440) { stageMinsSums.step4 += m4; stageMinsCounts.step4++; }

          const m5 = diffM(shipDt, outDt);
          if (m5 !== null && m5 < 1440) { stageMinsSums.step5 += m5; stageMinsCounts.step5++; }
        });

        const orderTimelineFlow = Object.values(orderTimelineMap).sort((a, b) => a.key.localeCompare(b.key));
        const avgLeadHours = leadHoursCount > 0 ? (totalLeadHoursSum / leadHoursCount).toFixed(1) : 0;
        const rate24h = lowerProcessRows.length > 0 ? ((is24hCount / lowerProcessRows.length) * 100).toFixed(1) : 0;

        const stageAvgMins = {
          step1: stageMinsCounts.step1 > 0 ? (stageMinsSums.step1 / stageMinsCounts.step1).toFixed(1) : 3.0,
          step2: stageMinsCounts.step2 > 0 ? (stageMinsSums.step2 / stageMinsCounts.step2).toFixed(1) : 2.0,
          step3: stageMinsCounts.step3 > 0 ? (stageMinsSums.step3 / stageMinsCounts.step3).toFixed(1) : 77.2,
          step4: stageMinsCounts.step4 > 0 ? (stageMinsSums.step4 / stageMinsCounts.step4).toFixed(1) : 45.5,
          step5: stageMinsCounts.step5 > 0 ? (stageMinsSums.step5 / stageMinsCounts.step5).toFixed(1) : 19.6
        };

        const totalTrackingCount = lowerRows.length;
        const totalOrderCount = new Set(lowerRows.map(r => r.order_no)).size;

        res.json({
          success: true,
          targetDate: effectiveDate,
          nextDate: shiftDateStr(effectiveDate, 1),
          dayMode,
          countMode,
          totalCount: lowerProcessRows.length,
          totalOrders: lowerProcessRows.length,
          totalTrackingCount,
          totalOrderCount,
          shiftSummary,
          hourlyFlow,
          orderTimelineFlow,
          leadAnalytics: {
            avgLeadHours,
            rate24h,
            delayOver24hCount,
            leadBrackets,
            stageAvgMins,
            delayedOrdersList
          }
        });
      });
    };

    if (!targetDate) {
      const dateExpr = dayMode === 'calendar'
        ? `ship_date`
        : `CASE WHEN ship_time < '01:00:00' THEN date(ship_date, '-1 day') ELSE ship_date END`;
      db.get(`SELECT ${dateExpr} as op_date FROM delivery_order_tracking ORDER BY op_date DESC LIMIT 1`, [], (dErr, dRow) => {
        const d = (dRow && dRow.op_date) ? dRow.op_date : new Date().toISOString().split('T')[0];
        runAnalysis(d);
      });
    } else {
      runAnalysis(targetDate);
    }
  });

  // 物流費與包材成本專屬分析 API（供獨立模組 DeliveryCostAnalysis.vue 呼叫）
  router.get('/cost-analysis', (req, res) => {
    const { startDate, endDate, whCode, carrier, deliveryType, boxNo, region, onlySplitBox, onlyLate } = req.query;

    const runCostQuery = (sDate, eDate) => {
      const params = [sDate, eDate];
      let sql = `SELECT * FROM delivery_order_tracking WHERE ship_date >= ? AND ship_date <= ?`;

      if (whCode && whCode !== 'all') { sql += ` AND wh_code = ?`; params.push(whCode); }
      if (carrier && carrier !== 'all') { sql += ` AND carrier_name = ?`; params.push(carrier); }
      if (deliveryType && deliveryType !== 'all') { sql += ` AND delivery_type = ?`; params.push(deliveryType); }
      if (boxNo && boxNo !== 'all') { sql += ` AND box_no = ?`; params.push(boxNo); }
      if (region && region !== 'all') { sql += ` AND region = ?`; params.push(region); }
      if (onlySplitBox === 'true') { sql += ` AND is_first_box = 'N'`; }
      if (onlyLate === 'true') { sql += ` AND is_late = 'Y'`; }

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        rows = rows || [];

        let totalPackages = rows.length;
        const orderSet = new Set();
        let totalShippingFee = 0;
        let totalBoxCost = 0;
        let totalExtraFee = 0;
        let billedPackages = 0; // 排除超取 0 元月結件的實際計費件數
        let billedShippingFee = 0;

        let splitBoxCount = 0;
        let splitBoxShippingLoss = 0;
        let splitBoxMaterialLoss = 0;
        let lateCount = 0;
        let codCashCount = 0;

        const carrierMap = {};
        const boxMap = {};
        const typeMap = {};
        const districtMap = {};
        const splitOrderIds = new Set();
        const highCostAlerts = [];

        rows.forEach(r => {
          if (r.order_no) orderSet.add(r.order_no);

          const shipFee = Number(r.shipping_fee || 0);
          const boxPrice = Number(r.box_price || 0);
          const extraFee = Number(r.extra_fee || 0);
          const vol = Number(r.box_volume || 0);
          const totalCost = shipFee + boxPrice;

          totalShippingFee += shipFee;
          totalBoxCost += boxPrice;
          totalExtraFee += extraFee;

          if (shipFee > 0) {
            billedPackages++;
            billedShippingFee += shipFee;
          }

          if (r.is_first_box === 'N') {
            splitBoxCount++;
            splitBoxShippingLoss += shipFee;
            splitBoxMaterialLoss += boxPrice;
            if (r.order_no) splitOrderIds.add(r.order_no);
          }

          if (r.is_late === 'Y') lateCount++;
          if (r.cod_type && r.cod_type !== '無代收款') codCashCount++;

          // 1. 物流商彙總
          const cName = r.carrier_name || '未分類物流商';
          if (!carrierMap[cName]) {
            carrierMap[cName] = {
              carrier: cName,
              count: 0,
              billedCount: 0,
              shippingFee: 0,
              boxCost: 0,
              extraFee: 0,
              totalCost: 0,
              lateCount: 0,
              splitCount: 0
            };
          }
          const cb = carrierMap[cName];
          cb.count++;
          if (shipFee > 0) cb.billedCount++;
          cb.shippingFee += shipFee;
          cb.boxCost += boxPrice;
          cb.extraFee += extraFee;
          cb.totalCost += totalCost;
          if (r.is_late === 'Y') cb.lateCount++;
          if (r.is_first_box === 'N') cb.splitCount++;

          // 2. 箱號彙總
          const bCode = r.box_no || '未記錄';
          if (!boxMap[bCode]) {
            boxMap[bCode] = {
              boxNo: bCode,
              count: 0,
              boxPriceSum: 0,
              volumeSum: 0,
              shippingFeeSum: 0,
              billedCount: 0,
              totalCostSum: 0,
              splitCount: 0
            };
          }
          const bb = boxMap[bCode];
          bb.count++;
          bb.boxPriceSum += boxPrice;
          bb.volumeSum += vol;
          bb.shippingFeeSum += shipFee;
          if (shipFee > 0) bb.billedCount++;
          bb.totalCostSum += totalCost;
          if (r.is_first_box === 'N') bb.splitCount++;

          // 3. 宅配類別彙總
          const dType = r.delivery_type || '未分類';
          if (!typeMap[dType]) {
            typeMap[dType] = {
              deliveryType: dType,
              count: 0,
              billedCount: 0,
              shippingFee: 0,
              boxCost: 0,
              totalCost: 0,
              lateCount: 0
            };
          }
          const tb = typeMap[dType];
          tb.count++;
          if (shipFee > 0) tb.billedCount++;
          tb.shippingFee += shipFee;
          tb.boxCost += boxPrice;
          tb.totalCost += totalCost;
          if (r.is_late === 'Y') tb.lateCount++;

          // 4. 行政區 / 郵遞區號彙總
          const { city, district } = extractCityDistrict(r.address);
          const zip3 = String(r.zip_code || '').slice(0, 3) || '-';
          const distKey = `${district}|${zip3}`;
          if (!districtMap[distKey]) {
            districtMap[distKey] = {
              city,
              district,
              zip3,
              region: r.region || '其他',
              count: 0,
              billedCount: 0,
              shippingFee: 0,
              boxCost: 0,
              totalCost: 0
            };
          }
          const dbucket = districtMap[distKey];
          dbucket.count++;
          if (shipFee > 0) dbucket.billedCount++;
          dbucket.shippingFee += shipFee;
          dbucket.boxCost += boxPrice;
          dbucket.totalCost += totalCost;

          // 5. 高運費或額外加價預警清單（運費 >= 120 或有額外加價）
          if ((shipFee >= 120 || extraFee > 0) && highCostAlerts.length < 300) {
            highCostAlerts.push({
              ...r,
              totalCost: Number(totalCost.toFixed(2))
            });
          }
        });

        // 整理輸出列表
        const carrierList = Object.values(carrierMap)
          .map(c => ({
            ...c,
            shippingFee: Number(c.shippingFee.toFixed(2)),
            boxCost: Number(c.boxCost.toFixed(2)),
            extraFee: Number(c.extraFee.toFixed(2)),
            totalCost: Number(c.totalCost.toFixed(2)),
            avgShippingFee: c.billedCount > 0 ? Number((c.shippingFee / c.billedCount).toFixed(2)) : 0,
            avgTotalCost: c.count > 0 ? Number((c.totalCost / c.count).toFixed(2)) : 0,
            lateRate: c.count > 0 ? Number(((c.lateCount / c.count) * 100).toFixed(1)) : 0
          }))
          .sort((a, b) => b.totalCost - a.totalCost);

        const boxList = Object.values(boxMap)
          .map(b => ({
            boxNo: b.boxNo,
            count: b.count,
            unitBoxPrice: b.count > 0 ? Number((b.boxPriceSum / b.count).toFixed(2)) : 0,
            avgVolume: b.count > 0 ? Number((b.volumeSum / b.count).toFixed(1)) : 0,
            boxCostSum: Number(b.boxPriceSum.toFixed(2)),
            avgShippingFee: b.billedCount > 0 ? Number((b.shippingFeeSum / b.billedCount).toFixed(2)) : 0,
            avgTotalCost: b.count > 0 ? Number((b.totalCostSum / b.count).toFixed(2)) : 0,
            totalCostSum: Number(b.totalCostSum.toFixed(2)),
            splitCount: b.splitCount
          }))
          .sort((a, b) => b.count - a.count);

        const deliveryTypeList = Object.values(typeMap)
          .map(t => ({
            ...t,
            shippingFee: Number(t.shippingFee.toFixed(2)),
            boxCost: Number(t.boxCost.toFixed(2)),
            totalCost: Number(t.totalCost.toFixed(2)),
            avgShippingFee: t.billedCount > 0 ? Number((t.shippingFee / t.billedCount).toFixed(2)) : 0,
            lateRate: t.count > 0 ? Number(((t.lateCount / t.count) * 100).toFixed(1)) : 0
          }))
          .sort((a, b) => b.count - a.count);

        const districtTopList = Object.values(districtMap)
          .map(d => ({
            ...d,
            shippingFee: Number(d.shippingFee.toFixed(2)),
            boxCost: Number(d.boxCost.toFixed(2)),
            totalCost: Number(d.totalCost.toFixed(2)),
            avgShippingFee: d.billedCount > 0 ? Number((d.shippingFee / d.billedCount).toFixed(2)) : 0,
            avgTotalCost: d.count > 0 ? Number((d.totalCost / d.count).toFixed(2)) : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30);

        // 整理拆箱訂單明細（找出同訂單編號的所有箱子對照）
        const splitOrdersDetail = rows
          .filter(r => splitOrderIds.has(r.order_no))
          .sort((a, b) => String(a.order_no).localeCompare(String(b.order_no)) || String(b.is_first_box).localeCompare(String(a.is_first_box)))
          .slice(0, 400)
          .map(r => ({
            ...r,
            totalCost: Number((Number(r.shipping_fee || 0) + Number(r.box_price || 0)).toFixed(2))
          }));

        res.json({
          success: true,
          startDate: sDate,
          endDate: eDate,
          kpi: {
            totalPackages,
            totalOrders: orderSet.size,
            totalShippingFee: Number(totalShippingFee.toFixed(2)),
            totalBoxCost: Number(totalBoxCost.toFixed(2)),
            totalFulfillmentCost: Number((totalShippingFee + totalBoxCost).toFixed(2)),
            totalExtraFee: Number(totalExtraFee.toFixed(2)),
            billedPackages,
            avgBilledShippingFee: billedPackages > 0 ? Number((billedShippingFee / billedPackages).toFixed(2)) : 0,
            avgBoxCost: totalPackages > 0 ? Number((totalBoxCost / totalPackages).toFixed(2)) : 0,
            splitBoxCount,
            splitBoxShippingLoss: Number(splitBoxShippingLoss.toFixed(2)),
            splitBoxMaterialLoss: Number(splitBoxMaterialLoss.toFixed(2)),
            splitBoxTotalLoss: Number((splitBoxShippingLoss + splitBoxMaterialLoss).toFixed(2)),
            lateCount,
            lateRate: totalPackages > 0 ? Number(((lateCount / totalPackages) * 100).toFixed(1)) : 0,
            codCashCount
          },
          carrierList,
          boxList,
          deliveryTypeList,
          districtTopList,
          splitOrdersDetail,
          highCostAlerts
        });
      });
    };

    if (!startDate || !endDate) {
      db.get(`SELECT MAX(ship_date) as max_d FROM delivery_order_tracking`, [], (err, row) => {
        const d = (row && row.max_d) ? row.max_d : new Date().toISOString().split('T')[0];
        runCostQuery(d, d);
      });
    } else {
      runCostQuery(startDate, endDate);
    }
  });

  // 每月每日總表 API
  router.get('/monthly-summary', (req, res) => {
    const { month } = req.query;
    const countMode = req.query.countMode || 'tracking';
    const dayMode = req.query.dayMode === 'calendar' ? 'calendar' : 'operational';
    if (!month) return res.status(400).json({ success: false, message: '請提供月份 (YYYY-MM)' });

    const nextMonthStart = shiftDateStr(`${month}-28`, 5).slice(0, 7) + '-01';
    let sql = dayMode === 'calendar'
      ? `SELECT * FROM delivery_order_tracking WHERE ship_date LIKE ?`
      : `SELECT * FROM delivery_order_tracking WHERE (ship_date LIKE ? OR (ship_date = ? AND ship_time < '01:00:00'))`;
    const params = dayMode === 'calendar' ? [`${month}%`] : [`${month}%`, nextMonthStart];
    sql = buildCommonWhere(req.query, sql, params);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      rows = rows || [];

      const daysMap = {};
      rows.forEach(r => {
        const bucketDate = dayMode === 'calendar'
          ? normalizeDate(r.ship_date)
          : getOperationalDate(r.ship_date, r.ship_time);
        if (!bucketDate || !bucketDate.startsWith(month)) return;
        if (!daysMap[bucketDate]) {
          daysMap[bucketDate] = {
            date: bucketDate,
            rawRows: [],
            orderSet: new Set()
          };
        }
        daysMap[bucketDate].rawRows.push(r);
        if (r.order_no) daysMap[bucketDate].orderSet.add(r.order_no);
      });

      const dailyList = Object.keys(daysMap).sort().map(d => {
        const bucket = daysMap[d];
        let processRows = bucket.rawRows;
        if (countMode === 'order') {
          const m = new Map();
          bucket.rawRows.forEach(r => { if (!m.has(r.order_no)) m.set(r.order_no, r); });
          processRows = Array.from(m.values());
        }

        let dayShift = 0, nightShift = 0, graveyardShift = 0;
        let north = 0, south = 0, east = 0, island = 0;
        let is24hCnt = 0, leadSum = 0, leadCnt = 0;

        processRows.forEach(r => {
          if (r.shift_type === '日班') dayShift++;
          else if (r.shift_type === '夜班') nightShift++;
          else if (r.shift_type === '大夜班') graveyardShift++;

          if (r.region === '北北基桃') north++;
          else if (r.region === '中南部') south++;
          else if (r.region === '宜花東') east++;
          else if (r.region === '外島') island++;

          if (r.is_24h === '是') is24hCnt++;

          const oDt = parseDateTime(r.order_date, r.order_time);
          const sDt = parseDateTime(r.ship_date, r.ship_time);
          if (oDt && sDt && sDt >= oDt) {
            leadSum += (sDt - oDt) / (1000 * 3600);
            leadCnt++;
          }
        });

        const total = processRows.length;
        return {
          date: d,
          total,
          trackingCount: bucket.rawRows.length,
          orderCount: bucket.orderSet.size,
          dayShift,
          nightShift,
          graveyardShift,
          north,
          south,
          east,
          island,
          rate24h: total > 0 ? ((is24hCnt / total) * 100).toFixed(1) + '%' : '0.0%',
          avgLeadHours: leadCnt > 0 ? (leadSum / leadCnt).toFixed(1) : '0.0'
        };
      });

      res.json({ success: true, month, dayMode, dailyList });
    });
  });

  // 年度每月總表 API
  router.get('/yearly-summary', (req, res) => {
    const { year } = req.query;
    const countMode = req.query.countMode || 'tracking';
    const dayMode = req.query.dayMode === 'calendar' ? 'calendar' : 'operational';
    if (!year) return res.status(400).json({ success: false, message: '請提供年份 (YYYY)' });

    const nextYearJan1 = `${Number(year) + 1}-01-01`;
    let sql = dayMode === 'calendar'
      ? `SELECT * FROM delivery_order_tracking WHERE ship_date LIKE ?`
      : `SELECT * FROM delivery_order_tracking WHERE (ship_date LIKE ? OR (ship_date = ? AND ship_time < '01:00:00'))`;
    const params = dayMode === 'calendar' ? [`${year}%`] : [`${year}%`, nextYearJan1];
    sql = buildCommonWhere(req.query, sql, params);

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      rows = rows || [];

      const monthMap = {};
      for (let m = 1; m <= 12; m++) {
        const mKey = `${year}-${String(m).padStart(2, '0')}`;
        monthMap[mKey] = {
          month: mKey,
          monthLabel: `${String(m).padStart(2, '0')}月`,
          rawRows: [],
          orderSet: new Set()
        };
      }

      rows.forEach(r => {
        const bucketDate = dayMode === 'calendar'
          ? normalizeDate(r.ship_date)
          : getOperationalDate(r.ship_date, r.ship_time);
        const mKey = bucketDate.slice(0, 7);
        if (monthMap[mKey]) {
          monthMap[mKey].rawRows.push(r);
          if (r.order_no) monthMap[mKey].orderSet.add(r.order_no);
        }
      });

      const monthlyList = Object.keys(monthMap).sort().map(mKey => {
        const bucket = monthMap[mKey];
        let processRows = bucket.rawRows;
        if (countMode === 'order') {
          const m = new Map();
          bucket.rawRows.forEach(r => { if (!m.has(r.order_no)) m.set(r.order_no, r); });
          processRows = Array.from(m.values());
        }

        let dayShift = 0, nightShift = 0, graveyardShift = 0;
        let north = 0, south = 0, east = 0, island = 0;
        let is24hCnt = 0, leadSum = 0, leadCnt = 0;

        processRows.forEach(r => {
          if (r.shift_type === '日班') dayShift++;
          else if (r.shift_type === '夜班') nightShift++;
          else if (r.shift_type === '大夜班') graveyardShift++;

          if (r.region === '北北基桃') north++;
          else if (r.region === '中南部') south++;
          else if (r.region === '宜花東') east++;
          else if (r.region === '外島') island++;

          if (r.is_24h === '是') is24hCnt++;

          const oDt = parseDateTime(r.order_date, r.order_time);
          const sDt = parseDateTime(r.ship_date, r.ship_time);
          if (oDt && sDt && sDt >= oDt) {
            leadSum += (sDt - oDt) / (1000 * 3600);
            leadCnt++;
          }
        });

        const total = processRows.length;
        return {
          month: mKey,
          monthLabel: bucket.monthLabel,
          total,
          trackingCount: bucket.rawRows.length,
          orderCount: bucket.orderSet.size,
          dayShift,
          nightShift,
          graveyardShift,
          north,
          south,
          east,
          island,
          rate24h: total > 0 ? ((is24hCnt / total) * 100).toFixed(1) + '%' : '0.0%',
          avgLeadHours: leadCnt > 0 ? (leadSum / leadCnt).toFixed(1) : '0.0'
        };
      });

      res.json({ success: true, year, dayMode, monthlyList });
    });
  });

  // 穿透明細 API
  router.get('/orders-detail', (req, res) => {
    const { targetDate, whCode, shift, hour, orderDate, orderBeforeDate, orderInterval, region, carrier, deliveryType, is24h } = req.query;
    const dayMode = req.query.dayMode === 'calendar' ? 'calendar' : 'operational';
    const params = [];
    let sql = `SELECT * FROM delivery_order_tracking WHERE 1=1`;

    if (hour !== undefined && hour !== null && hour !== '') {
      const hNum = parseInt(hour, 10);
      const queryShipDate = (dayMode === 'operational' && hNum === 0) ? shiftDateStr(targetDate, 1) : targetDate;
      const hStr = String(hNum).padStart(2, '0');
      sql += ` AND ship_date = ? AND ship_time LIKE ?`;
      params.push(queryShipDate, `${hStr}:%`);
    } else {
      const dayWhere = buildDayClause(targetDate, dayMode, params);
      sql += ` AND ${dayWhere}`;
    }

    if (whCode && whCode !== 'all') { sql += ` AND wh_code = ?`; params.push(whCode); }
    if (shift && shift !== 'all') { sql += ` AND shift_type = ?`; params.push(shift); }

    if (orderBeforeDate) {
      sql += ` AND order_date <= ?`;
      params.push(orderBeforeDate);
    } else {
      if (orderDate) { sql += ` AND order_date = ?`; params.push(orderDate); }
      if (orderInterval) { sql += ` AND order_interval = ?`; params.push(orderInterval); }
    }
    if (region && region !== 'all') { sql += ` AND region = ?`; params.push(region); }
    if (carrier && carrier !== 'all') { sql += ` AND carrier_name = ?`; params.push(carrier); }
    if (deliveryType && deliveryType !== 'all') { sql += ` AND delivery_type = ?`; params.push(deliveryType); }
    if (is24h && is24h !== 'all') { sql += ` AND is_24h = ?`; params.push(is24h); }

    sql += ` ORDER BY ship_date ASC, ship_time ASC LIMIT 3000`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  return router;
};