const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 紀錄地端伺服器 (Node.js) 真正的啟動時間點
const SERVER_START_TIME = Date.now();

// 中文顯示欄位 ➔ SQLite 資料庫實體欄位映射表
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
  '樓層': 'floor',
  '儲位型態': 'loc_type',
  '大區編': 'big_zone_id',
  '大區名': 'big_zone',
  '儲位才數': 'loc_cubic_feet',
  '儲位健康度': 'loc_health',
  '材積判斷': 'vol_check',
  '總才數': 'total_cubic_feet',
  '人工/自動': 'auto_type',
  '庫齡級距': 'age_bracket',
  '重型架判斷': 'heavy_rack_check'
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. 自動初始化資料庫 Schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT, item_name TEXT, borrow_proc TEXT, location TEXT, qty REAL, age INTEGER,
      zone_id TEXT, zone_name TEXT, hall_id TEXT, hall_name TEXT,
      length REAL, width REAL, height REAL, weight REAL,
      monthly_sales REAL, pick_days_m REAL, sales_90d REAL, pick_days_90d REAL,
      supplier_id TEXT, supplier_name TEXT, pm TEXT, total_qty REAL, turn_days_total REAL,
      cubic_feet REAL, vol_type TEXT, floor TEXT, loc_type TEXT,
      big_zone_id TEXT, big_zone TEXT, loc_cubic_feet REAL, loc_health TEXT,
      vol_check TEXT, total_cubic_feet REAL, auto_type TEXT, age_bracket TEXT, heavy_rack_check TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY, name TEXT, role TEXT, password TEXT, permissions TEXT, last_active INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT, name TEXT, role TEXT, device TEXT, feature TEXT, action TEXT, created_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS column_config (
      key TEXT PRIMARY KEY, config_json TEXT, updated_at TEXT
    );
  `);

  db.run(`
    INSERT OR IGNORE INTO users (username, name, role, password, permissions) 
    VALUES ('admin', '系統管理員', 'sys_admin', 'admin', 'all');
  `);
  
  db.run(`
    INSERT OR IGNORE INTO users (username, name, role, password, permissions) 
    VALUES ('801854', '黃勝鴻', 'sys_admin', '801854', 'all');
  `);
});

// ------------------------------------------------------------------
// 3. API 路由設定
// ------------------------------------------------------------------

// [POST] 筆電遠端推送最新 server.js 程式碼並自動覆蓋重啟
app.post('/api/system/update-server-code', (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: '無效的程式碼內容' });
    }

    fs.writeFileSync(path.join(__dirname, 'server.js'), code, 'utf8');
    console.log('✅ 已成功接收筆電傳來的最新 server.js，準備自動重啟...');

    res.json({ success: true, message: '🎉 最新 server.js 已成功覆蓋地端檔案，伺服器重啟中...' });

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error('❌ 覆蓋程式碼失敗:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// [POST] 遠端觸發重啟服務 API
app.post('/api/system/restart', (req, res) => {
  res.json({ success: true, message: '🔄 遠端指令已接收，地端伺服器正在重新啟動中...' });
  console.log('⚠️ 收到遠端重啟請求，準備重新拉起服務進程...');

  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// [GET] 全域系統設定 API (包含伺服器真實運作秒數)
app.get('/api/get-global-config', (req, res) => {
  const currentUptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

  res.json({
    success: true,
    data: {
      system_name: "庫存儲位管理系統",
      version: "v2026.09.09.1028",
      server_uptime_seconds: currentUptimeSec
    }
  });
});

// [GET] 取得大區分類清單
app.get('/api/categories/large', (req, res) => {
  db.all('SELECT DISTINCT big_zone FROM inventory WHERE big_zone IS NOT NULL AND big_zone != ""', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const list = rows.map(r => r.big_zone);
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
    const list = rows.map(r => r.zone_name);
    res.json({ success: true, data: list });
  });
});

// 🌟 [GET] 取得使用者列表 API (加入 is_online 動態即時計算)
app.get('/api/get-users', (req, res) => {
  db.all('SELECT username, name, role, permissions, last_active FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const now = Math.floor(Date.now() / 1000);
    // 🌟 計算：若最後活動時間在 10 分鐘 (600 秒) 內，判定為在線 (is_online: true)
    const formattedUsers = (rows || []).map(u => ({
      ...u,
      is_online: !!(u.last_active && (now - u.last_active < 600))
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

// [GET] 庫存查詢 API (支援動態 ORDER BY 排序)
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
          '樓層': getVal('floor'),
          '儲位型態': getVal('loc_type'),
          '大區編': getVal('big_zone_id'),
          '大區名': getVal('big_zone'),
          '儲位才數': getVal('loc_cubic_feet'),
          '儲位健康度': getVal('loc_health'),
          '材積判斷': getVal('vol_check'),
          '總才數': getVal('total_cubic_feet'),
          '人工/自動': getVal('auto_type'),
          '庫齡級距': getVal('age_bracket'),
          '重型架判斷': getVal('heavy_rack_check')
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

// 🌟 [POST] 使用者登入驗證 (記錄登入者最後活動時間戳)
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

// 🌟 [POST] 寫入操作日誌 (同步刷新操作者的 last_active 時間)
app.post('/api/record-log', (req, res) => {
  const { username, name, role, device, feature, action } = req.body;
  const isoTimeStr = new Date().toISOString();
  const now = Math.floor(Date.now() / 1000);

  if (username) {
    db.run('UPDATE users SET last_active = ? WHERE username = ?', [now, username]);
  }

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

// [POST] 批次上傳庫存資料
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
          monthly_sales, pick_days_m, sales_90d, pick_days_90d,
          supplier_id, supplier_name, pm, total_qty, turn_days_total,
          cubic_feet, vol_type, floor, loc_type, big_zone_id, big_zone,
          loc_cubic_feet, loc_health, vol_check, total_cubic_feet, auto_type, age_bracket, heavy_rack_check
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          getField('floor', '樓層'),
          getField('loc_type', '儲位型態'),
          getField('big_zone_id', '大區編'),
          getField('big_zone', '大區名'),
          getNum('loc_cubic_feet', '儲位才數'),
          getField('loc_health', '儲位健康度'),
          getField('vol_check', '材積判斷'),
          getNum('total_cubic_feet', '總才數'),
          getField('auto_type', '人工/自動'),
          getField('age_bracket', '庫齡級距'),
          getField('heavy_rack_check', '重型架判斷')
        );
      }
      stmt.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Transaction Commit 失敗:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, count: items.length, message: '36 欄位極速寫入成功！' });
      });
    });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 地端伺服器已成功啟動！(Port: ${PORT})`);
});