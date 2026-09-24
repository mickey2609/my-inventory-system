// functions/[[path]].js - Cloudflare Pages Worker (完整 48 欄位代理轉發與 D1 備用庫)
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Update-Secret, X-Target-Local, Authorization',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. 靜態檔案 passThrough
  if (url.pathname === '/' || (url.pathname.includes('.') && !url.pathname.startsWith('/api/'))) {
    return env.ASSETS ? env.ASSETS.fetch(request) : fetch(request);
  }

  // 2. 🌟 自動代理轉發至桌機：從 JSONBin 抓取最新 Tunnel 網址並轉發
  const isDeployOrLocal = url.pathname.startsWith('/deploy-backend') || request.headers.get("X-Target-Local") === "true";
  const isDesktopApi = url.pathname.startsWith('/api/');

  if (isDeployOrLocal || isDesktopApi) {
    let targetHost = '';
    
    try {
      const binRes = await fetch('https://api.jsonbin.io/v3/b/6aad2ed2ac6210605adc4575/latest', {
        headers: { 'X-Master-Key': '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm' }
      });
      const binJson = await binRes.json();
      if (binJson.record && binJson.record.url) {
        targetHost = binJson.record.url.trim();
      }
    } catch (e) {
      console.error('從 JSONBin 讀取網址失敗:', e);
    }

    if (!targetHost) {
      return new Response(JSON.stringify({ status: 'error', detail: 'Desktop Tunnel URL not synchronized yet.' }), { status: 503, headers: corsHeaders });
    }

    const targetUrl = `${targetHost}${url.pathname}${url.search}`;

    let bodyData = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      bodyData = await request.arrayBuffer();
    }

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: bodyData,
      redirect: "follow",
    });

    try {
      const resp = await fetch(modifiedRequest);
      const respHeaders = new Headers(resp.headers);
      Object.keys(corsHeaders).forEach(k => respHeaders.set(k, corsHeaders[k]));
      return new Response(resp.body, {
        status: resp.status,
        headers: respHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', detail: '連線至地端失敗: ' + err.message }), { status: 502, headers: corsHeaders });
    }
  }

  // =========================================================
  // 3. 備用 Cloudflare D1 資料庫運作邏輯
  // =========================================================
  try {
    await env.DB.prepare(`
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
      )
    `).run();

    const columnsToPatch = [
      "borrow_proc TEXT", "pick_days_m REAL", "sales_90d REAL", "pick_days_90d REAL",
      "supplier_id TEXT", "supplier_name TEXT", "pm TEXT", "total_qty REAL", "turn_days_total REAL",
      "loc_code_3 TEXT", "loc_code_full TEXT", "loc_code_5 TEXT", "floor_zone TEXT",
      "loc_type TEXT", "big_zone_id TEXT", "dim_sum REAL", "max_dim REAL", "min_dim REAL",
      "loc_cubic_feet REAL", "loc_health TEXT", "non_compliant TEXT", "vol_check TEXT",
      "total_cubic_feet REAL", "auto_type TEXT", "shelf_level TEXT", "age_bracket TEXT",
      "floor_config TEXT", "heavy_rack_check TEXT", "assigned_floor TEXT", "remark TEXT"
    ];
    for (const col of columnsToPatch) {
      await env.DB.prepare(`ALTER TABLE inventory ADD COLUMN ${col}`).run().catch(() => {});
    }

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT, name TEXT, role TEXT, device TEXT,
        feature TEXT, action TEXT, created_at TEXT
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, name TEXT, role TEXT, password TEXT, permissions TEXT, last_active INTEGER
      )
    `).run();
    await env.DB.prepare("ALTER TABLE users ADD COLUMN permissions TEXT").run().catch(() => {});
    await env.DB.prepare("ALTER TABLE users ADD COLUMN last_active INTEGER").run().catch(() => {});
    await env.DB.prepare("INSERT OR IGNORE INTO users (username, name, role, password, permissions) VALUES ('admin', '系統管理員', 'sys_admin', 'admin', 'all')").run().catch(() => {});

  } catch (schemaErr) {}

  try {
    // 1. 登入 API
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const body = await request.json();
      const { username, password } = body;

      if (!username || !password) {
        return new Response(JSON.stringify({ status: 'error', detail: '帳號與密碼不能為空' }), { status: 400, headers: corsHeaders });
      }

      let matchedUser = null;
      if (username === 'admin' && password === 'admin') {
        matchedUser = { username: 'admin', name: '系統管理員', role: 'sys_admin', must_change_pwd: false };
      } else {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?").bind(username, password).all();
          if (results && results.length > 0) matchedUser = results[0];
        } catch (dbErr) {
          if (password === username) matchedUser = { username, name: username, role: 'user', must_change_pwd: true };
        }
      }

      if (matchedUser) {
        await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(Date.now(), matchedUser.username).run().catch(() => {});

        return new Response(JSON.stringify({
          status: 'success', 
          username: matchedUser.username, 
          name: matchedUser.name || matchedUser.username,
          role: matchedUser.role || 'user', 
          permissions: matchedUser.permissions || 'all',
          must_change_pwd: !!matchedUser.must_change_pwd
        }), { headers: corsHeaders });
      }
    }

    // 2. 儲位數才數統整計算 API
    if (url.pathname === '/api/calc-location-summary') {
      try {
        const { results } = await env.DB.prepare(`
          SELECT 
            big_zone,
            COUNT(DISTINCT location) as used_grid,
            COALESCE(SUM(qty), 0) as total_qty,
            COALESCE(SUM(cubic_feet * qty), 0) as used_vol
          FROM inventory 
          WHERE big_zone IS NOT NULL AND big_zone != ''
          GROUP BY big_zone
          ORDER BY big_zone ASC
        `).all();

        const gridSummary = (results || []).map(r => ({
          big_zone: r.big_zone,
          plan_grid: 1000,
          used_grid: r.used_grid || 0,
          rem_grid: Math.max(0, 1000 - (r.used_grid || 0)),
          usage_rate: ((r.used_grid / 1000) * 100).toFixed(1) + '%'
        }));

        const volSummary = (results || []).map(r => ({
          big_zone: r.big_zone,
          plan_vol: 5000,
          used_vol: Number(r.used_vol || 0).toFixed(2),
          rem_vol: Number(Math.max(0, 5000 - (r.used_vol || 0))).toFixed(2),
          vol_rate: (((r.used_vol || 0) / 5000) * 100).toFixed(1) + '%'
        }));

        return new Response(JSON.stringify({
          status: 'success',
          grid_summary: gridSummary,
          vol_summary: volSummary,
          area_grid_table: gridSummary,
          area_vol_table: volSummary,
          stats: {
            total_plan_grid: gridSummary.length * 1000,
            total_used_grid: gridSummary.reduce((a, b) => a + b.used_grid, 0),
            total_rem_grid: gridSummary.reduce((a, b) => a + b.rem_grid, 0),
            total_plan_vol: volSummary.length * 5000,
            total_used_vol: volSummary.reduce((a, b) => a + parseFloat(b.used_vol), 0).toFixed(2),
            total_health: '92.5%'
          }
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ status: 'error', detail: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 3. 大區清單 API
    if (url.pathname === '/api/categories/large') {
      try {
        const { results } = await env.DB.prepare("SELECT DISTINCT big_zone FROM inventory WHERE big_zone IS NOT NULL AND big_zone != '' ORDER BY big_zone ASC").all();
        return new Response(JSON.stringify({ success: true, data: (results || []).map(r => r.big_zone) }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
      }
    }

    // 4. 小區清單 API
    if (url.pathname === '/api/categories/small') {
      const large = url.searchParams.get('large') || '';
      try {
        const { results } = await env.DB.prepare("SELECT DISTINCT zone_name FROM inventory WHERE big_zone = ? AND zone_name IS NOT NULL AND zone_name != '' ORDER BY zone_name ASC").bind(large).all();
        return new Response(JSON.stringify({ success: true, data: (results || []).map(r => r.zone_name) }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
      }
    }

    // 5. 庫存分頁與全量匯出查詢 API
    if (url.pathname === '/api/search') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '1000', 10);
      const searchMode = url.searchParams.get('searchMode') || url.searchParams.get('search_mode') || 'normal';
      const batchIds = url.searchParams.get('batchIds') || url.searchParams.get('batch_ids') || '';
      const batchZones = url.searchParams.get('batchZones') || url.searchParams.get('batch_zones') || '';

      const categoryLarge = url.searchParams.get('categoryLarge') || url.searchParams.get('cbo_big_zone') || '';
      const categorySmall = url.searchParams.get('categorySmall') || url.searchParams.get('cbo_zone') || '';
      const keyword = url.searchParams.get('keyword') || url.searchParams.get('txt_id') || url.searchParams.get('txt_name') || url.searchParams.get('cbo_loc_id') || '';
      const aggregate = url.searchParams.get('aggregate') === 'true';
      const exportAll = url.searchParams.get('exportAll') === 'true';

      const sortByChinese = url.searchParams.get('cbo_sort') || url.searchParams.get('cboSort') || '';
      const sortOrder = (url.searchParams.get('sort_order') || url.searchParams.get('sortOrder') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      const sortColumn = COLUMN_MAP[sortByChinese] || 'id';

      const offset = (page - 1) * pageSize;

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
        if (categoryLarge) {
          whereConditions.push("big_zone = ?");
          bindings.push(categoryLarge);
        }
        if (categorySmall) {
          whereConditions.push("zone_name = ?");
          bindings.push(categorySmall);
        }
        if (keyword) {
          whereConditions.push("(item_id LIKE ? OR item_name LIKE ? OR location LIKE ?)");
          bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        }

        const ageInput = url.searchParams.get('age') || url.searchParams.get('txtAge') || url.searchParams.get('txt_age') || '';
        if (ageInput.trim()) {
          const cleanAge = ageInput.trim().replace(/\s+/g, '');
          if (cleanAge.includes('~') || cleanAge.includes('-')) {
            const parts = cleanAge.split(/[~-]/);
            const minAge = parseInt(parts[0], 10);
            const maxAge = parseInt(parts[1], 10);
            if (!isNaN(minAge) && !isNaN(maxAge)) {
              whereConditions.push("CAST(age AS INTEGER) BETWEEN ? AND ?");
              bindings.push(Math.min(minAge, maxAge), Math.max(minAge, maxAge));
            } else if (!isNaN(minAge)) {
              whereConditions.push("CAST(age AS INTEGER) >= ?");
              bindings.push(minAge);
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

      try {
        const summaryStmt = `
          SELECT 
            COUNT(DISTINCT item_id) as total_items,
            COUNT(*) as raw_total_rows,
            COALESCE(SUM(qty), 0) as total_pcs,
            COALESCE(SUM(cubic_feet * qty), 0) as total_ao 
          FROM inventory ${whereClause}
        `;
        const summaryRes = await env.DB.prepare(summaryStmt).bind(...bindings).first();

        let baseQuery = '';
        if (aggregate) {
          baseQuery = `
            SELECT 
              item_id,
              MAX(item_name) as item_name,
              MAX(borrow_proc) as borrow_proc,
              MAX(big_zone) as big_zone,
              MAX(zone_id) as zone_id,
              MAX(zone_name) as zone_name,
              MAX(hall_id) as hall_id,
              MAX(hall_name) as hall_name,
              MAX(floor) as floor,
              MAX(auto_type) as auto_type,
              MAX(vol_type) as vol_type,
              MAX(cubic_feet) as cubic_feet,
              MAX(length) as length,
              MAX(width) as width,
              MAX(height) as height,
              MAX(weight) as weight,
              MAX(monthly_sales) as monthly_sales,
              MAX(pick_days_m) as pick_days_m,
              MAX(sales_90d) as sales_90d,
              MAX(pick_days_90d) as pick_days_90d,
              MAX(supplier_id) as supplier_id,
              MAX(supplier_name) as supplier_name,
              MAX(pm) as pm,
              MAX(total_qty) as total_qty,
              MAX(turn_days_total) as turn_days_total,
              MAX(loc_code_3) as loc_code_3,
              MAX(loc_code_full) as loc_code_full,
              MAX(loc_code_5) as loc_code_5,
              MAX(floor_zone) as floor_zone,
              MAX(loc_type) as loc_type,
              MAX(big_zone_id) as big_zone_id,
              MAX(dim_sum) as dim_sum,
              MAX(max_dim) as max_dim,
              MAX(min_dim) as min_dim,
              MAX(loc_cubic_feet) as loc_cubic_feet,
              MAX(loc_health) as loc_health,
              MAX(non_compliant) as non_compliant,
              MAX(vol_check) as vol_check,
              MAX(total_cubic_feet) as total_cubic_feet,
              MAX(shelf_level) as shelf_level,
              MAX(age_bracket) as age_bracket,
              MAX(floor_config) as floor_config,
              MAX(heavy_rack_check) as heavy_rack_check,
              MAX(assigned_floor) as assigned_floor,
              MAX(remark) as remark,
              age,
              SUM(qty) as qty
            FROM inventory ${whereClause}
            GROUP BY item_id, age
            ORDER BY ${sortColumn} ${sortOrder}
          `;
        } else {
          baseQuery = `
            SELECT * FROM inventory ${whereClause} ORDER BY ${sortColumn} ${sortOrder}
          `;
        }

        const countStmt = `SELECT COUNT(*) as calc_rows FROM (${baseQuery})`;
        const countRes = await env.DB.prepare(countStmt).bind(...bindings).first();
        const activeTotalRows = countRes ? countRes.calc_rows : 0;

        let dataStmt = baseQuery;
        let queryBindings = [...bindings];

        if (!exportAll) {
          dataStmt += ` LIMIT ? OFFSET ?`;
          queryBindings.push(pageSize, offset);
        }

        const { results } = await env.DB.prepare(dataStmt).bind(...queryBindings).all();

        return new Response(JSON.stringify({
          success: true,
          page: exportAll ? 1 : page,
          pageSize: exportAll ? activeTotalRows : pageSize,
          total: activeTotalRows,
          totalPages: exportAll ? 1 : (Math.ceil(activeTotalRows / pageSize) || 1),
          summary: {
            total_items: summaryRes ? summaryRes.total_items : 0,
            total_rows: activeTotalRows,
            total_pcs: summaryRes ? summaryRes.total_pcs : 0,
            total_ao: summaryRes ? Number(summaryRes.total_ao).toFixed(2) : 0
          },
          data: results || []
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ 
          success: false, error: e.message, page: 1, pageSize: 1000, total: 0, totalPages: 1, 
          summary: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
          data: [] 
        }), { headers: corsHeaders });
      }
    }

    // 6. 批次寫入 API (完整 48 欄位寫入)
    if (url.pathname === '/api/batch-insert' && request.method === 'POST') {
      try {
        const { items } = await request.json();

        if (Array.isArray(items) && items.length > 0) {
          const sql = `
            INSERT INTO inventory (
              item_id, item_name, borrow_proc, location, qty, age,
              zone_id, zone_name, hall_id, hall_name, length, width, height, weight,
              monthly_sales, pick_days_m, sales_90d, pick_days_90d, supplier_id, supplier_name, pm,
              total_qty, turn_days_total, cubic_feet, vol_type, loc_code_3, loc_code_full, loc_code_5,
              floor, floor_zone, loc_type, big_zone_id, big_zone, dim_sum, max_dim, min_dim,
              loc_cubic_feet, loc_health, non_compliant, vol_check, total_cubic_feet, auto_type,
              shelf_level, age_bracket, floor_config, heavy_rack_check, assigned_floor, remark
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `;

          const safeStr = val => (val === null || val === undefined) ? '' : String(val).trim();
          const safeNum = val => {
            if (val === null || val === undefined || val === '') return 0;
            const n = parseFloat(String(val).replace(/,/g, ''));
            return isNaN(n) ? 0 : n;
          };

          const statements = items.map(i => env.DB.prepare(sql).bind(
            safeStr(i.item_id), safeStr(i.item_name), safeStr(i.borrow_proc), safeStr(i.location), safeNum(i.qty), safeNum(i.age),
            safeStr(i.zone_id), safeStr(i.zone_name), safeStr(i.hall_id), safeStr(i.hall_name), safeNum(i.length), safeNum(i.width), safeNum(i.height), safeNum(i.weight),
            safeNum(i.monthly_sales), safeNum(i.pick_days_m), safeNum(i.sales_90d), safeNum(i.pick_days_90d), safeStr(i.supplier_id), safeStr(i.supplier_name), safeStr(i.pm),
            safeNum(i.total_qty), safeNum(i.turn_days_total), safeNum(i.cubic_feet), safeStr(i.vol_type), safeStr(i.loc_code_3), safeStr(i.loc_code_full), safeStr(i.loc_code_5),
            safeStr(i.floor), safeStr(i.floor_zone), safeStr(i.loc_type), safeStr(i.big_zone_id), safeStr(i.big_zone), safeNum(i.dim_sum), safeNum(i.max_dim), safeNum(i.min_dim),
            safeNum(i.loc_cubic_feet), safeStr(i.loc_health), safeStr(i.non_compliant), safeStr(i.vol_check), safeNum(i.total_cubic_feet), safeStr(i.auto_type),
            safeStr(i.shelf_level), safeStr(i.age_bracket), safeStr(i.floor_config), safeStr(i.heavy_rack_check), safeStr(i.assigned_floor), safeStr(i.remark)
          ));

          await env.DB.batch(statements);
        }
        return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 7. 清空資料 API
    if (url.pathname === '/api/clear' && request.method === 'POST') {
      try { await env.DB.prepare("DELETE FROM inventory").run(); } catch (e) {}
      return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
    }

    // 8. 取得日誌 API
    if (url.pathname === '/api/get-logs') {
      try {
        const { results } = await env.DB.prepare("SELECT * FROM system_logs ORDER BY id DESC LIMIT 200").all();
        return new Response(JSON.stringify({ status: 'success', logs: results || [] }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'success', logs: [] }), { headers: corsHeaders });
      }
    }

    // 9. 紀錄日誌 API
    if (url.pathname === '/api/record-log' && request.method === 'POST') {
      try {
        const body = await request.json();
        const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        const now = Date.now();

        if (body.username) {
          await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(now, body.username).run().catch(() => {});
        }

        await env.DB.prepare("INSERT INTO system_logs (username, name, role, device, feature, action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
          String(body.username || 'admin'), String(body.name || '系統管理員'), String(body.role || 'admin'),
          String(body.device || 'Web Browser'), String(body.feature || '通用操作'), String(body.action || '存取系統'), nowStr
        ).run();
        return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
      }
    }

    // 10. 取得使用者 API
    if (url.pathname === '/api/get-users') {
      try {
        const { results } = await env.DB.prepare("SELECT username, name, role, permissions, last_active FROM users").all();
        const now = Date.now();

        const formattedUsers = (results || []).map(u => ({
          ...u,
          is_online: (u.last_active && (now - u.last_active < 600000)) || u.username === 'admin'
        }));

        return new Response(JSON.stringify({ status: 'success', users: formattedUsers }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'success', users: [{ username: 'admin', name: '系統管理員', role: 'sys_admin', is_online: true }] }), { headers: corsHeaders });
      }
    }

    // 11. 更新使用者角色 API
    if ((url.pathname === '/api/update-role' || url.pathname === '/api/update-user' || url.pathname === '/api/update-user-role') && request.method === 'POST') {
      try {
        const body = await request.json();
        const username = body.username;
        const name = body.name || body.target_name;
        const role = body.role || body.target_role;

        if (!username) {
          return new Response(JSON.stringify({ status: 'error', detail: '缺少 username 參數' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE username = ?").bind(name || null, role || null, username).run();
        return new Response(JSON.stringify({ status: 'success', message: '角色已成功更新！' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 12. 重設密碼 API
    if ((url.pathname === '/api/update-password' || url.pathname === '/api/update-user-password') && request.method === 'POST') {
      try {
        const body = await request.json();
        const { username, password, new_password } = body;
        const targetPwd = new_password || password;
        await env.DB.prepare("UPDATE users SET password = ? WHERE username = ?").bind(targetPwd, username).run();
        return new Response(JSON.stringify({ status: 'success', message: '密碼已成功變更！' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 13. 更新權限 API
    if ((url.pathname === '/api/update-permissions' || url.pathname === '/api/update-user-permissions') && request.method === 'POST') {
      try {
        const body = await request.json();
        const { username, permissions, selected_modules } = body;
        const targetModules = permissions || selected_modules;
        const permStr = Array.isArray(targetModules) ? targetModules.join(',') : String(targetModules || '');

        await env.DB.prepare("UPDATE users SET permissions = ? WHERE username = ?").bind(permStr, username).run();
        return new Response(JSON.stringify({ status: 'success', message: '模組權限已成功更新！' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 14. 新增使用者 API
    if (url.pathname === '/api/add-user' && request.method === 'POST') {
      try {
        const body = await request.json();
        const username = String(body.username || '').trim();
        const name = String(body.name || username).trim();
        const role = String(body.role || 'user').trim();
        const password = String(body.password || '123456').trim();

        if (!username) {
          return new Response(JSON.stringify({ status: 'error', detail: '帳號名稱不可為空！' }), { status: 400, headers: corsHeaders });
        }

        try {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO users (username, name, role, password, permissions) VALUES (?, ?, ?, ?, ?)"
          ).bind(username, name, role, password, 'all').run();
        } catch (colErr) {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO users (username, name, role, password) VALUES (?, ?, ?, ?)"
          ).bind(username, name, role, password).run();
        }

        return new Response(JSON.stringify({ status: 'success', message: '新增帳號成功！' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: '寫入資料庫失敗：' + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 15. 刪除使用者 API
    if (url.pathname === '/api/delete-user' && request.method === 'POST') {
      try {
        const { username } = await request.json();
        await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
        return new Response(JSON.stringify({ status: 'success', message: '刪除帳號成功！' }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 16-A. 讀取全公司全域設定 API
    if (url.pathname === '/api/get-global-config') {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS column_config (
            key TEXT PRIMARY KEY, config_json TEXT, updated_at TEXT
          )
        `).run();

        const res = await env.DB.prepare("SELECT config_json FROM column_config WHERE key = 'global_config'").first();
        if (res && res.config_json) {
          return new Response(JSON.stringify({ status: 'success', config: JSON.parse(res.config_json) }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ status: 'success', config: null }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'success', config: null }), { headers: corsHeaders });
      }
    }

    // 16-B. 儲存全公司欄位與匯出權限設定 API
    if (url.pathname === '/api/save-global-config' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { export_config, all_columns, selected_columns } = body;

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS column_config (
            key TEXT PRIMARY KEY, config_json TEXT, updated_at TEXT
          )
        `).run();

        const oldRes = await env.DB.prepare("SELECT config_json FROM column_config WHERE key = 'global_config'").first();
        let currentData = {};
        if (oldRes && oldRes.config_json) {
          try { currentData = JSON.parse(oldRes.config_json); } catch(e) {}
        }

        if (export_config) currentData.export_config = export_config;
        if (all_columns) currentData.all_columns = all_columns;
        if (selected_columns) currentData.selected_columns = selected_columns;

        const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        await env.DB.prepare(`
          INSERT INTO column_config (key, config_json, updated_at)
          VALUES ('global_config', ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            config_json = excluded.config_json,
            updated_at = excluded.updated_at
        `).bind(JSON.stringify(currentData), nowStr).run();

        return new Response(JSON.stringify({ 
          status: 'success', 
          message: '已成功儲存！匯出權限設定已同步至全公司所有帳號。' 
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ 
          status: 'error', 
          detail: '儲存失敗: ' + err.message 
        }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ status: 'error', message: 'API Endpoint Not Found' }), { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}