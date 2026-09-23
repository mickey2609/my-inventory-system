// C:\my-inventory-server\server.js
// 業務主程式 API 伺服器 (整合 48 欄位處理 + VBA 儲位才數統整 + LocSummary.vue 視圖對接)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 紀錄地端伺服器 (Node.js) 真正的啟動時間點
const SERVER_START_TIME = Date.now();

// 48 欄位中文顯示名稱 ➔ SQLite 資料庫實體欄位映射表
const COLUMN_MAP = {
  '商品ID': 'item_id',
  '商品名稱': 'item_name',
  '借/採': 'borrow_proc',
  '儲位': 'location',
  '儲位庫存數': 'qty',
  '庫齡': 'age',
  '區編': 'zone_id',
  '區名': 'zone_name',
  '館編': 'hall_id',
  '館名': 'hall_name',
  '長(cm)': 'length',
  '寬(cm)': 'width',
  '高(cm)': 'height',
  '重量(kg)': 'weight',
  '(近)月銷量': 'monthly_sales',
  '(近)月-有揀貨單天數': 'pick_days_m',
  '(近)90日銷量': 'sales_90d',
  '(近)90日-有揀貨單天數': 'pick_days_90d',
  '供應商ID': 'supplier_id',
  '供應商名稱': 'supplier_name',
  '所屬PM': 'pm',
  '總庫存數': 'total_qty',
  '總庫存_迴轉天數': 'turn_days_total',
  '才數': 'cubic_feet',
  '材積別': 'vol_type',
  '儲位編碼-3': 'loc_code_3',
  '儲位編碼': 'loc_code_full',
  '儲位編碼5': 'loc_code_5',
  '樓層': 'floor',
  '樓層區域': 'floor_zone',
  '儲位型態': 'loc_type',
  '大區編': 'big_zone_id',
  '大區名': 'big_zone',
  '三邊長': 'dim_sum',
  '最長邊': 'max_dim',
  '最短邊': 'min_dim',
  '儲位才數': 'loc_cubic_feet',
  '儲位健康度': 'loc_health',
  '不符合': 'non_compliant',
  '材積判斷': 'vol_check',
  '總才數': 'total_cubic_feet',
  '人工/自動': 'auto_type',
  '儲位層標示': 'shelf_level',
  '庫齡級距': 'age_bracket',
  '樓層設定': 'floor_config',
  '重型架判斷': 'heavy_rack_check',
  'ID指定樓層': 'assigned_floor',
  '備註': 'remark'
};

// 1. 初始化 SQLite 資料庫檔案
const db = new sqlite3.Database('inventory_local.sqlite', (err) => {
  if (err) {
    console.error('❌ 資料庫連線失敗:', err.message);
  } else {
    console.log('✅ SQLite 資料庫檔案已成功連結！');
  }
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// [POST] 接收筆電更新代碼並轉發給 Port 3001 (system-manager)
app.post('/api/system/update-server-code', (req, res) => {
  const http = require('http');
  const payload = JSON.stringify(req.body);

  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/system/update-server-code',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).send(body);
    });
  });

  proxyReq.on('error', (err) => {
    res.status(500).json({ success: false, message: '無法連線至系統管理服務 (Port 3001): ' + err.message });
  });

  proxyReq.write(payload);
  proxyReq.end();
  // ⚠️ 絕對不呼叫 process.exit()，由 system-manager 統一管理進程生命週期
});

// 2. 自動初始化資料庫 Schema (含自動擴充舊資料表至 48 欄位之 Migration)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT, item_name TEXT, borrow_proc TEXT, location TEXT, qty REAL, age INTEGER,
      zone_id TEXT, zone_name TEXT, hall_id TEXT, hall_name TEXT,
      length REAL, width REAL, height REAL, weight REAL,
      monthly_sales REAL, pick_days_m REAL, sales_90d REAL, pick_days_90d REAL,
      supplier_id TEXT, supplier_name TEXT, pm TEXT, total_qty REAL, turn_days_total REAL,
      cubic_feet REAL, vol_type TEXT, loc_code_3 TEXT, loc_code_full TEXT, loc_code_5 TEXT,
      floor TEXT, floor_zone TEXT, loc_type TEXT, big_zone_id TEXT, big_zone TEXT,
      dim_sum REAL, max_dim REAL, min_dim REAL, loc_cubic_feet REAL, loc_health TEXT,
      non_compliant TEXT, vol_check TEXT, total_cubic_feet REAL, auto_type TEXT,
      shelf_level TEXT, age_bracket TEXT, floor_config TEXT, heavy_rack_check TEXT,
      assigned_floor TEXT, remark TEXT
    );
  `);

  // 防呆自動為舊表動態補齊新增的 12 個欄位 (防止舊 Table 報錯 SQLITE_ERROR)
  const newCols = [
    'loc_code_3 TEXT', 'loc_code_full TEXT', 'loc_code_5 TEXT', 'floor_zone TEXT',
    'dim_sum REAL', 'max_dim REAL', 'min_dim REAL', 'non_compliant TEXT',
    'shelf_level TEXT', 'floor_config TEXT', 'assigned_floor TEXT', 'remark TEXT'
  ];

  newCols.forEach(colDef => {
    const colName = colDef.split(' ')[0];
    db.run(`ALTER TABLE inventory ADD COLUMN ${colDef}`, (err) => {
      // 若欄位已存在則忽略錯誤
    });
  });

  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, role TEXT, password TEXT, permissions TEXT, last_active INTEGER);`);
  db.run(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, name TEXT, role TEXT, device TEXT, feature TEXT, action TEXT, created_at TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS column_config (key TEXT PRIMARY KEY, config_json TEXT, updated_at TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS locations_master (id INTEGER PRIMARY KEY AUTOINCREMENT, floor TEXT, zone TEXT, loc_type TEXT, cubic_feet REAL, grid_count INTEGER, single_cubic_feet REAL);`);
  
  db.run(`INSERT OR IGNORE INTO users (username, name, role, password, permissions) VALUES ('admin', '系統管理員', 'sys_admin', 'admin', 'all');`);
  db.run(`INSERT OR IGNORE INTO users (username, name, role, password, permissions) VALUES ('801854', '黃勝鴻', 'sys_admin', '801854', 'all');`);
});

// --- VBA 特殊紙抽判斷邏輯 ( GetAdjustedType ) ---
function getAdjustedType(floor, rType, storageCode, shelfLevel) {
  floor = String(floor || '').toUpperCase().trim();
  rType = String(rType || '').trim();
  storageCode = String(storageCode || '').toUpperCase().trim();
  shelfLevel = String(shelfLevel || '').toUpperCase().trim();

  const rowTag = storageCode.substring(0, 3);
  const seatTag = parseInt(storageCode.substring(3, 6), 10) || 0;

  if (floor === '7F') {
    if (rowTag >= 'M01' && rowTag <= 'M53' && seatTag <= 56) {
      if (shelfLevel === 'B' || shelfLevel === 'C') return 'AGV層架-紙抽';
    }
  } else if (floor === '6F') {
    if (rowTag >= 'L01' && rowTag <= 'L26' && seatTag <= 60) {
      if (['A', 'B', 'C'].includes(shelfLevel)) return 'AGV層架-紙抽';
    } else if (rowTag >= 'L27' && rowTag <= 'L30' && seatTag <= 60) {
      if (['A', 'B', 'C', 'D', 'E', 'F'].includes(shelfLevel)) return 'AGV層架-紙抽';
    }
  }

  if (rowTag >= 'R13' && rowTag <= 'R42') {
    if (shelfLevel === 'A' || shelfLevel === 'B') return 'AGV層架-紙抽';
  } else if ((rowTag === 'R11' || rowTag === 'R12') && seatTag >= 1 && seatTag <= 20) {
    if (shelfLevel === 'A' || shelfLevel === 'B') return 'AGV層架-紙抽';
  }

  return rType;
}

// ------------------------------------------------------------------
// 3. API 路由設定
// ------------------------------------------------------------------

// 解析 CSV 字串之輔助函式
function parseCsvTextToObjects(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const list = [];
  for (let i = 1; i < lines.length; i++) {
    const rowVals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (rowVals.length < headers.length) continue;
    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = rowVals[idx]);
    list.push(rowObj);
  }
  return list;
}

// [GET] 讀取 locations_master 儲位結構定義清單 (提供給 LocSummary.vue 彈窗表格顯示)
app.get('/api/get-locations-master', (req, res) => {
  const sql = `
    SELECT 
      COALESCE(floor, '') as 樓層,
      COALESCE(zone, '') as 區域,
      COALESCE(loc_type, '') as 儲位類型,
      COALESCE(cubic_feet, 0) as 才數,
      COALESCE(grid_count, 0) as 儲格數,
      COALESCE(single_cubic_feet, 0) as 儲位才數
    FROM locations_master
    ORDER BY id ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '讀取儲位定義失敗: ' + err.message });
    }
    res.json({ success: true, data: rows || [] });
  });
});

// [POST] 匯入 locations_master 資料 (全相容 FormData / CSV 原生文字 / JSON 陣列)
app.post(['/api/import-locations-master', '/api/import-locations-master-json'], (req, res) => {
  let chunks = [];

  req.on('data', chunk => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const rawText = buffer.toString('utf8');
      let items = [];

      // A. 若傳送 FormData multipart，從 Stream 內容提取 CSV 區塊
      if (rawText.includes('name="file"') || rawText.includes('Content-Type:')) {
        const matches = rawText.match(/\r\n\r\n([\s\S]*?)\r\n--/);
        if (matches && matches[1]) {
          items = parseCsvTextToObjects(matches[1].trim());
        }
      }
      // B. 若直接傳送 CSV 純文字
      else if (rawText.includes(',') && !rawText.trim().startsWith('{') && !rawText.trim().startsWith('[')) {
        items = parseCsvTextToObjects(rawText.trim());
      }
      // C. 若傳送 JSON 格式 (JSON.parse)
      else if (req.body) {
        items = req.body;
        if (items && Array.isArray(items.items)) items = items.items;
        else if (items && Array.isArray(items.data)) items = items.data;
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: '未接收到有效 CSV 內容或資料為空' });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM locations_master');

        const stmt = db.prepare(`
          INSERT INTO locations_master (floor, zone, loc_type, cubic_feet, grid_count, single_cubic_feet)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const parseNum = (val) => {
          if (val === null || val === undefined) return 0;
          const num = parseFloat(String(val).replace(/,/g, '').trim());
          return isNaN(num) ? 0 : num;
        };

        const parseIntNum = (val) => {
          if (val === null || val === undefined) return 0;
          const num = parseInt(String(val).replace(/,/g, '').trim(), 10);
          return isNaN(num) ? 0 : num;
        };

        for (const r of items) {
          if (!r || typeof r !== 'object') continue;

          const floor = String(r['樓層'] || r.floor || r.Floor || '').trim();
          const zone = String(r['區域'] || r.zone || r.Zone || '').trim();
          const locType = String(r['儲位類型'] || r['儲位型態'] || r.loc_type || r.LocType || '').trim();
          const cubicFeet = parseNum(r['才數'] || r.cubic_feet || r.CubicFeet);
          const gridCount = parseIntNum(r['儲格數(板、層)'] || r['儲格數'] || r.grid_count || r.GridCount);
          const singleCubicFeet = parseNum(r['儲位才數'] || r.single_cubic_feet || r.SingleCubicFeet);

          stmt.run(floor, zone, locType, cubicFeet, gridCount, singleCubicFeet);
        }

        stmt.finalize();

        db.run('COMMIT', (err) => {
          if (err) {
            console.error('❌ Commit 寫入失敗:', err.message);
            return res.status(500).json({ success: false, message: '寫入資料庫失敗: ' + err.message });
          }
          console.log(`✅ 成功寫入 ${items.length} 筆 locations_master 儲位結構！`);
          res.json({ success: true, count: items.length, message: '儲位結構定義更新成功！' });
        });
      });
    } catch (err) {
      console.error('❌ 解析匯入失敗:', err.message);
      db.run('ROLLBACK');
      res.status(500).json({ success: false, message: '伺服器處理失敗: ' + err.message });
    }
  });
});

// [GET] 📊 儲位才數統整 API (同時支援 /api/calc-location-summary 與 /api/stats/location-capacity)
app.get(['/api/calc-location-summary', '/api/stats/location-capacity'], (req, res) => {
  const masterSql = `
    SELECT 
      COALESCE(floor, '') as floor,
      COALESCE(zone, '') as zone,
      COALESCE(loc_type, '') as loc_type,
      COALESCE(cubic_feet, 0) as cubic_feet,
      COALESCE(grid_count, 0) as grid_count,
      COALESCE(single_cubic_feet, 0) as single_cubic_feet
    FROM locations_master
  `;

  const inventorySql = `
    SELECT 
      COALESCE(floor, '') as floor,
      COALESCE(big_zone, '') as big_zone,
      COALESCE(loc_type, '') as loc_type,
      COALESCE(location, '') as location,
      COALESCE(loc_code_3, '') as loc_code_3,
      COALESCE(shelf_level, '') as shelf_level,
      COALESCE(total_cubic_feet, 0) as total_cubic_feet,
      COALESCE(cubic_feet, 0) as cubic_feet,
      COALESCE(qty, 0) as qty
    FROM inventory
  `;

  db.all(masterSql, [], (err, masterRows) => {
    if (err) masterRows = [];

    db.all(inventorySql, [], (err, invRows) => {
      if (err) invRows = [];

      const statsMap = {};

      // A. 彙總 locations_master 規劃數據
      (masterRows || []).forEach(r => {
        let rawFloor = String(r.floor || '').trim();
        let rType = String(r.loc_type || '').trim();
        if (!rawFloor || rawFloor === '樓層' || !rType) return;
        if (rawFloor === '1F' && rType === '自動化板式') return;

        const uKey = `${rawFloor}_${rType.replace(/\s+/g, '')}`;

        if (!statsMap[uKey]) {
          statsMap[uKey] = {
            key: uKey,
            floorRegion: `${rawFloor} ${rType}`,
            rawFloor: rawFloor,
            loc_type: rType,
            grid_plan: 0,
            grid_used: 0,
            vol_plan: 0,
            vol_used: 0,
            single_cubic_feet: parseFloat(r.single_cubic_feet || 0)
          };
        }

        const gCount = parseInt(r.grid_count || 0, 10);
        const vCount = parseFloat(r.cubic_feet || 0);

        statsMap[uKey].grid_plan += isNaN(gCount) ? 0 : gCount;
        statsMap[uKey].vol_plan += isNaN(vCount) ? 0 : vCount;
      });

      // B. 彙總 inventory 使用中數據
      const usedStorageCheck = new Set();

      (invRows || []).forEach(r => {
        let invFloor = String(r.floor || '').trim();
        const storageCode = String(r.location || '').toUpperCase().trim();
        const originalType = String(r.loc_type || '').trim();
        const shelfLevel = String(r.shelf_level || (storageCode.length >= 7 ? storageCode.substring(6, 7) : '')).trim();

        if (!invFloor && storageCode.length >= 2) {
          const matchFloor = storageCode.match(/^([0-9]F[東西南北]?)/i);
          if (matchFloor) invFloor = matchFloor[1].toUpperCase();
          else {
            const matchSimple = storageCode.match(/^([0-9]F)/i);
            if (matchSimple) invFloor = matchSimple[1].toUpperCase();
          }
        }

        const adjustedType = getAdjustedType(invFloor, originalType, storageCode, shelfLevel);
        const cleanType = (adjustedType || originalType || '').replace(/\s+/g, '');

        let targetItem = null;
        const allKeys = Object.keys(statsMap);
        const exactKey = `${invFloor}_${cleanType}`;

        if (statsMap[exactKey]) {
          targetItem = statsMap[exactKey];
        } else {
          const pureFloor = invFloor.replace(/[^0-9F]/gi, '');
          const foundKey = allKeys.find(k => {
            const [mFloor, mType] = k.split('_');
            const mPureFloor = mFloor.replace(/[^0-9F]/gi, '');
            return mPureFloor === pureFloor && (mType.includes(cleanType) || cleanType.includes(mType));
          });
          if (foundKey) targetItem = statsMap[foundKey];
        }

        if (targetItem) {
          const curVol = parseFloat(r.total_cubic_feet) > 0 
            ? parseFloat(r.total_cubic_feet) 
            : (parseFloat(r.cubic_feet || 0) * parseFloat(r.qty || 0));

          targetItem.vol_used += isNaN(curVol) ? 0 : curVol;

          if (storageCode && !usedStorageCheck.has(storageCode)) {
            usedStorageCheck.add(storageCode);
            targetItem.grid_used += 1;
          }
        }
      });

      // C. 格式化為前端 Vue 要求之數據物件 (對齊 VBA 剩餘才數計算公式)
      const gridTableData = [];
      const volTableData = [];

      let totalPlanGrid = 0, totalUsedGrid = 0, totalRemGrid = 0;
      let totalPlanVol = 0, totalUsedVol = 0;

      Object.values(statsMap).forEach(item => {
        const remGrid = Math.max(0, item.grid_plan - item.grid_used);
        const gridRate = item.grid_plan > 0 ? ((item.grid_used / item.grid_plan) * 100).toFixed(1) + '%' : '0.0%';

        // VBA 公式：剩餘才數 = 單格才數 * 剩餘儲格數
        const remVol = item.single_cubic_feet > 0 
          ? (item.single_cubic_feet * remGrid) 
          : Math.max(0, item.vol_plan - item.vol_used);

        const volRate = item.vol_plan > 0 ? ((item.vol_used / item.vol_plan) * 100).toFixed(1) + '%' : '0.0%';

        // VBA 儲位健康度演算法
        const unusedVolRate = item.vol_plan > 0 ? (remVol / item.vol_plan) : 0;
        const usedVolRate = 1 - unusedVolRate;
        const healthVal = (item.vol_plan > 0 && usedVolRate !== 0) ? ((item.vol_used / usedVolRate) / item.vol_plan * 100).toFixed(1) + '%' : '0.0%';

        gridTableData.push({
          '樓層區域': item.floorRegion,
          '規劃儲格數': item.grid_plan,
          '使用儲格數': item.grid_used,
          '剩餘儲格數': remGrid,
          '使用率': gridRate,
          '儲位健康度': healthVal
        });

        volTableData.push({
          '樓層區域': item.floorRegion,
          '規劃總才數': parseFloat(item.vol_plan.toFixed(1)),
          '使用中才數': parseFloat(item.vol_used.toFixed(1)),
          '剩餘才數': parseFloat(remVol.toFixed(1)),
          '才數使用率': volRate
        });

        totalPlanGrid += item.grid_plan;
        totalUsedGrid += item.grid_used;
        totalRemGrid += remGrid;

        totalPlanVol += item.vol_plan;
        totalUsedVol += item.vol_used;
      });

      const overallRemVol = Math.max(0, totalPlanVol - totalUsedVol);
      const overallUnusedRate = totalPlanVol > 0 ? (overallRemVol / totalPlanVol) : 0;
      const overallUsedRate = 1 - overallUnusedRate;
      const overallHealth = (totalPlanVol > 0 && overallUsedRate !== 0) ? ((totalUsedVol / overallUsedRate) / totalPlanVol * 100).toFixed(1) + '%' : '0.0%';

      res.json({
        success: true,
        summaryStats: {
          total_plan_grid: totalPlanGrid,
          total_used_grid: totalUsedGrid,
          total_rem_grid: totalRemGrid,
          total_plan_vol: parseFloat(totalPlanVol.toFixed(1)),
          total_used_vol: parseFloat(totalUsedVol.toFixed(1)),
          total_health: overallHealth
        },
        summaryGridData: gridTableData,
        summaryVolData: volTableData
      });
    });
  });
});

// [GET] 全域系統設定 API
app.get('/api/get-global-config', (req, res) => {
  const currentUptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

  res.json({
    success: true,
    data: {
      system_name: "庫存儲位管理系統",
      version: "v2026.09.23-48COL-MATCH",
      server_uptime_seconds: currentUptimeSec
    }
  });
});

// [GET] 取得大區分類清單
app.get('/api/categories/large', (req, res) => {
  db.all('SELECT DISTINCT big_zone FROM inventory WHERE big_zone IS NOT NULL AND big_zone != ""', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const list = (rows || []).map(r => r.big_zone);
    res.json({ success: true, data: list });
  });
});

// [GET] 取得小區分類清單
app.get('/api/categories/small', (req, res) => {
  const large = req.query.large || '';
  let sql = 'SELECT DISTINCT zone_name FROM inventory WHERE zone_name IS NOT NULL AND zone_name != ""';
  let params = [];
  if (large) {
    sql += ' AND big_zone = ?';
    params.push(large);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const list = (rows || []).map(r => r.zone_name);
    res.json({ success: true, data: list });
  });
});

// [POST] 心跳保活 API
app.post('/api/heartbeat', (req, res) => {
  const { username } = req.body;
  if (username) {
    const now = Math.floor(Date.now() / 1000);
    db.run('UPDATE users SET last_active = ? WHERE username = ?', [now, username]);
  }
  res.json({ success: true });
});

// [POST] 使用者登出 API
app.post('/api/logout', (req, res) => {
  const { username } = req.body;
  if (username) {
    db.run('UPDATE users SET last_active = 0 WHERE username = ?', [username]);
  }
  res.json({ success: true, message: '已成功登出' });
});

// [GET] 取得使用者列表 API
app.get('/api/get-users', (req, res) => {
  db.all('SELECT username, name, role, permissions, last_active FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const now = Math.floor(Date.now() / 1000);
    const formattedUsers = (rows || []).map(u => ({
      ...u,
      is_online: !!(u.last_active && (now - u.last_active < 60))
    }));

    res.json({ success: true, users: formattedUsers });
  });
});

// [POST] 新增使用者 API
app.post('/api/add-user', (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username) return res.status(400).json({ success: false, message: '帳號名稱不可為空！' });

  const stmt = db.prepare(`
    INSERT INTO users (username, name, role, password, permissions, last_active) 
    VALUES (?, ?, ?, ?, 'all', ?)
    ON CONFLICT(username) DO UPDATE SET 
      name = excluded.name, 
      role = excluded.role, 
      password = excluded.password
  `);

  const now = Math.floor(Date.now() / 1000);
  stmt.run(username, name || username, role || 'user', password || '123456', now, (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '新增帳號成功！' });
  });
});

// [POST] 更新使用者角色 API
app.post(['/api/update-role', '/api/update-user-role', '/api/update-user'], (req, res) => {
  const { username, target_role, role, target_name, name } = req.body;
  const newRole = role || target_role;
  const newName = name || target_name;

  db.run('UPDATE users SET role = COALESCE(?, role), name = COALESCE(?, name) WHERE username = ?', [newRole, newName, username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '角色已成功更新！' });
  });
});

// [POST] 更新使用者密碼 API
app.post(['/api/update-password', '/api/update-user-password'], (req, res) => {
  const { username, new_password, password } = req.body;
  const pwd = new_password || password;

  db.run('UPDATE users SET password = ? WHERE username = ?', [pwd, username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '密碼已成功變更！' });
  });
});

// [POST] 更新使用者權限 API
app.post(['/api/update-permissions', '/api/update-user-permissions'], (req, res) => {
  const { username, permissions, selected_modules } = req.body;
  const targetMods = permissions || selected_modules;
  const permStr = Array.isArray(targetMods) ? targetMods.join(',') : String(targetMods || '');

  db.run('UPDATE users SET permissions = ? WHERE username = ?', [permStr, username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '模組權限已成功更新！' });
  });
});

// [POST] 刪除使用者 API
app.post('/api/delete-user', (req, res) => {
  const { username } = req.body;
  db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '刪除帳號成功！' });
  });
});

// [GET] 庫存查詢 API
app.get('/api/search', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '500', 10);
  const searchMode = req.query.searchMode || req.query.search_mode || 'normal';
  const batchIds = req.query.batchIds || req.query.batch_ids || '';
  const batchZones = req.query.batchZones || req.query.batch_zones || '';

  const categoryLarge = req.query.categoryLarge || req.query.cbo_big_zone || '';
  const categorySmall = req.query.categorySmall || req.query.cbo_zone || '';
  const keyword = req.query.keyword || req.query.txt_id || req.query.txt_name || req.query.cbo_loc_id || '';
  const ageInput = req.query.txtAge || req.query.txt_age || req.query.age || '';

  const sortByChinese = req.query.cbo_sort || req.query.cboSort || '';
  const sortOrder = (req.query.sort_order || req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortColumn = COLUMN_MAP[sortByChinese] || 'id';

  let whereConditions = [];
  let bindings = [];

  if (searchMode === 'batch_id' && batchIds.trim()) {
    const idList = batchIds.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (idList.length > 0) {
      const placeholders = idList.map(() => '?').join(',');
      whereConditions.push(`item_id IN (${placeholders})`);
      bindings.push(...idList);
    }
  } 
  else if (searchMode === 'batch_zone' && (batchZones.trim() || batchIds.trim())) {
    const zoneStr = batchZones.trim() || batchIds.trim();
    const zoneList = zoneStr.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (zoneList.length > 0) {
      const zoneConditions = [
        `big_zone IN (${zoneList.map(() => '?').join(',')})`,
        `zone_name IN (${zoneList.map(() => '?').join(',')})`,
        `zone_id IN (${zoneList.map(() => '?').join(',')})`,
        ...zoneList.map(() => `location LIKE ?`)
      ];
      whereConditions.push(`(${zoneConditions.join(' OR ')})`);
      bindings.push(...zoneList, ...zoneList, ...zoneList);
      zoneList.forEach(z => bindings.push(`${z}%`));
    }
  } 
  else {
    if (categoryLarge) { whereConditions.push("big_zone = ?"); bindings.push(categoryLarge); }
    if (categorySmall) { whereConditions.push("zone_name = ?"); bindings.push(categorySmall); }
    if (keyword) {
      whereConditions.push("(item_id LIKE ? OR item_name LIKE ? OR location LIKE ?)");
      bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (ageInput.trim()) {
      const cleanAge = ageInput.trim().replace(/\s+/g, '');
      if (cleanAge.includes('~') || cleanAge.includes('-')) {
        const parts = cleanAge.split(/[~-]/);
        const minAge = parseInt(parts[0], 10);
        const maxAge = parseInt(parts[1], 10);
        if (!isNaN(minAge) && !isNaN(maxAge)) {
          whereConditions.push("CAST(age AS INTEGER) BETWEEN ? AND ?");
          bindings.push(Math.min(minAge, maxAge), Math.max(minAge, maxAge));
        }
      } else {
        const numAge = parseInt(cleanAge, 10);
        if (!isNaN(numAge)) {
          whereConditions.push("CAST(age AS INTEGER) >= ?");
          bindings.push(numAge);
        }
      }
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const summarySql = `
    SELECT 
      COUNT(DISTINCT item_id) as total_items,
      COUNT(*) as total_rows,
      IFNULL(SUM(qty), 0) as total_pcs,
      IFNULL(SUM(CASE WHEN total_cubic_feet > 0 THEN total_cubic_feet ELSE (cubic_feet * qty) END), 0) as total_ao
    FROM inventory ${whereClause}
  `;

  db.get(summarySql, bindings, (err, summaryRow) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const totalCount = summaryRow ? summaryRow.total_rows : 0;
    const querySql = `SELECT * FROM inventory ${whereClause} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;

    db.all(querySql, [...bindings, pageSize, offset], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });

      const formattedRows = rows.map(row => {
        const getVal = (field) => {
          const val = row[field];
          if (val !== null && val !== undefined && String(val).trim() !== '') return val;
          return '-';
        };

        return {
          ...row,
          '商品ID': getVal('item_id'),
          '商品名稱': getVal('item_name'),
          '借/採': getVal('borrow_proc'),
          '儲位': getVal('location'),
          '儲位庫存數': getVal('qty'),
          '庫齡': getVal('age'),
          '區編': getVal('zone_id'),
          '區名': getVal('zone_name'),
          '館編': getVal('hall_id'),
          '館名': getVal('hall_name'),
          '長(cm)': getVal('length'),
          '寬(cm)': getVal('width'),
          '高(cm)': getVal('height'),
          '重量(kg)': getVal('weight'),
          '(近)月銷量': getVal('monthly_sales'),
          '(近)月-有揀貨單天數': getVal('pick_days_m'),
          '(近)90日銷量': getVal('sales_90d'),
          '(近)90日-有揀貨單天數': getVal('pick_days_90d'),
          '供應商ID': getVal('supplier_id'),
          '供應商名稱': getVal('supplier_name'),
          '所屬PM': getVal('pm'),
          '總庫存數': getVal('total_qty'),
          '總庫存_迴轉天數': getVal('turn_days_total'),
          '才數': getVal('cubic_feet'),
          '材積別': getVal('vol_type'),
          '儲位編碼-3': getVal('loc_code_3'),
          '儲位編碼': getVal('loc_code_full'),
          '儲位編碼5': getVal('loc_code_5'),
          '樓層': getVal('floor'),
          '樓層區域': getVal('floor_zone'),
          '儲位型態': getVal('loc_type'),
          '大區編': getVal('big_zone_id'),
          '大區名': getVal('big_zone'),
          '三邊長': getVal('dim_sum'),
          '最長邊': getVal('max_dim'),
          '最短邊': getVal('min_dim'),
          '儲位才數': getVal('loc_cubic_feet'),
          '儲位健康度': getVal('loc_health'),
          '不符合': getVal('non_compliant'),
          '材積判斷': getVal('vol_check'),
          '總才數': getVal('total_cubic_feet'),
          '人工/自動': getVal('auto_type'),
          '儲位層標示': getVal('shelf_level'),
          '庫齡級距': getVal('age_bracket'),
          '樓層設定': getVal('floor_config'),
          '重型架判斷': getVal('heavy_rack_check'),
          'ID指定樓層': getVal('assigned_floor'),
          '備註': getVal('remark')
        };
      });

      res.json({
        success: true,
        total: totalCount,
        summary: {
          total_items: summaryRow ? summaryRow.total_items : 0,
          total_rows: totalCount,
          total_pcs: summaryRow ? Math.round(summaryRow.total_pcs) : 0,
          total_ao: summaryRow ? parseFloat(summaryRow.total_ao.toFixed(2)) : 0
        },
        data: formattedRows
      });
    });
  });
});

// [POST] 儲存欄位設定
app.post('/api/save-column-config', (req, res) => {
  const { key, config } = req.body;
  const configKey = key || 'global_default';

  const stmt = db.prepare(`
    INSERT INTO column_config (key, config_json, updated_at)
    VALUES (?, ?, DATETIME('now'))
    ON CONFLICT(key) DO UPDATE SET config_json = excluded.config_json, updated_at = DATETIME('now')
  `);

  stmt.run(configKey, JSON.stringify(config || {}), (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '欄位設定儲存成功' });
  });
});

// [GET] 讀取欄位設定
app.get('/api/get-column-config', (req, res) => {
  const key = req.query.key || 'global_default';
  db.get('SELECT config_json FROM column_config WHERE key = ?', [key], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: row ? JSON.parse(row.config_json) : null });
  });
});

// [POST] 使用者登入驗證
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ success: false, message: '請輸入帳號' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    let realName = row ? row.name : '';
    if (username === '801854') {
      realName = '黃勝鴻';
      db.run('UPDATE users SET name = ? WHERE username = ?', ['黃勝鴻', '801854']);
    } else if (!realName) {
      realName = (username === 'admin' ? '系統管理員' : username);
    }

    const userRole = row ? (row.role || 'user') : (username === 'admin' ? 'sys_admin' : 'user');
    const userPerms = row ? (row.permissions || 'all') : 'all';

    const userPayload = {
      username: username,
      name: realName,
      role: userRole,
      permissions: userPerms,
      token: 'fake-jwt-token-for-local-sqlite'
    };

    const now = Math.floor(Date.now() / 1000);
    db.run('UPDATE users SET last_active = ? WHERE username = ?', [now, username]);

    res.json({
      success: true,
      code: 200,
      status: 'success',
      message: '登入成功',
      username: username,
      name: realName,
      role: userRole,
      permissions: userPerms,
      user: userPayload,
      data: userPayload,
      token: userPayload.token
    });
  });
});

// [POST] 寫入操作日誌
app.post('/api/record-log', (req, res) => {
  const { username, name, role, device, feature, action } = req.body;
  const isoTimeStr = new Date().toISOString();

  db.run(
    `INSERT INTO system_logs (username, name, role, device, feature, action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username || 'admin', name || '系統管理員', role || 'sys_admin', device || 'Desktop', feature, action, isoTimeStr],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

// [GET] 讀取操作日誌
app.get('/api/get-logs', (req, res) => {
  db.all('SELECT * FROM system_logs ORDER BY id DESC LIMIT 200', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, logs: rows });
  });
});

// [POST] 批次上傳 48 欄位庫存資料
app.post('/api/upload', (req, res) => {
  try {
    const { items, isFirstChunk } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '上傳資料格式無效或為空陣列' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (isFirstChunk) {
        db.run('DELETE FROM inventory');
      }

      const stmt = db.prepare(`
        INSERT INTO inventory (
          item_id, item_name, borrow_proc, location, qty, age,
          zone_id, zone_name, hall_id, hall_name, length, width, height, weight,
          monthly_sales, pick_days_m, sales_90d, pick_days_90d, supplier_id, supplier_name, pm,
          total_qty, turn_days_total, cubic_feet, vol_type, loc_code_3, loc_code_full, loc_code_5,
          floor, floor_zone, loc_type, big_zone_id, big_zone, dim_sum, max_dim, min_dim,
          loc_cubic_feet, loc_health, non_compliant, vol_check, total_cubic_feet, auto_type,
          shelf_level, age_bracket, floor_config, heavy_rack_check, assigned_floor, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const getField = (dbKey, csvKey) => {
          if (item[dbKey] !== undefined && item[dbKey] !== null) return item[dbKey];
          if (item[csvKey] !== undefined && item[csvKey] !== null) return item[csvKey];
          return '';
        };

        const getNum = (dbKey, csvKey) => {
          const val = getField(dbKey, csvKey);
          const num = parseFloat(String(val).replace(/,/g, ''));
          return isNaN(num) ? 0 : num;
        };

        stmt.run(
          getField('item_id', '商品ID'),
          getField('item_name', '商品名稱'),
          getField('borrow_proc', '借/採'),
          getField('location', '儲位'),
          getNum('qty', '儲位庫存數'),
          parseInt(getField('age', '庫齡') || 0, 10),
          getField('zone_id', '區編'),
          getField('zone_name', '區名'),
          getField('hall_id', '館編'),
          getField('hall_name', '館名'),
          getNum('length', '長(cm)'),
          getNum('width', '寬(cm)'),
          getNum('height', '高(cm)'),
          getNum('weight', '重量(kg)'),
          getNum('monthly_sales', '(近)月銷量'),
          getNum('pick_days_m', '(近)月-有揀貨單天數'),
          getNum('sales_90d', '(近)90日銷量'),
          getNum('pick_days_90d', '(近)90日-有揀貨單天數'),
          getField('supplier_id', '供應商ID'),
          getField('supplier_name', '供應商名稱'),
          getField('pm', '所屬PM'),
          getNum('total_qty', '總庫存數'),
          getNum('turn_days_total', '總庫存_迴轉天數'),
          getNum('cubic_feet', '才數'),
          getField('vol_type', '材積別'),
          getField('loc_code_3', '儲位編碼-3'),
          getField('loc_code_full', '儲位編碼'),
          getField('loc_code_5', '儲位編碼5'),
          getField('floor', '樓層'),
          getField('floor_zone', '樓層區域'),
          getField('loc_type', '儲位型態'),
          getField('big_zone_id', '大區編'),
          getField('big_zone', '大區名'),
          getNum('dim_sum', '三邊長'),
          getNum('max_dim', '最長邊'),
          getNum('min_dim', '最短邊'),
          getNum('loc_cubic_feet', '儲位才數'),
          getField('loc_health', '儲位健康度'),
          getField('non_compliant', '不符合'),
          getField('vol_check', '材積判斷'),
          getNum('total_cubic_feet', '總才數'),
          getField('auto_type', '人工/自動'),
          getField('shelf_level', '儲位層標示'),
          getField('age_bracket', '庫齡級距'),
          getField('floor_config', '樓層設定'),
          getField('heavy_rack_check', '重型架判斷'),
          getField('assigned_floor', 'ID指定樓層'),
          getField('remark', '備註')
        );
      }
      stmt.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Transaction Commit 失敗:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, count: items.length, message: '48 欄位極速寫入成功！' });
      });
    });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 業務 API 伺服器已成功啟動！(Port: ${PORT})`);
});