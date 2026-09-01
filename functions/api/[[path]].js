export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // CORS 跨域設定標頭
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. 登入驗證 API
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const body = await request.json();
      const { username, password } = body;

      if (!username || !password) {
        return new Response(JSON.stringify({ status: 'error', detail: '帳號與密碼不能為空' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // 檢查使用者 (支援 admin/admin 或從 D1 users 數據表比對)
      let matchedUser = null;

      if (username === 'admin' && password === 'admin') {
        matchedUser = { username: 'admin', name: '系統管理員', role: 'admin', must_change_pwd: false };
      } else {
        try {
          const { results } = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND password = ?"
          ).bind(username, password).all();

          if (results && results.length > 0) {
            matchedUser = results[0];
          }
        } catch (dbErr) {
          // 若 users 表尚未建立，防呆比對預設同員編密碼
          if (password === username) {
            matchedUser = { username, name: username, role: 'user', must_change_pwd: true };
          }
        }
      }

      if (matchedUser) {
        return new Response(JSON.stringify({
          status: 'success',
          username: matchedUser.username,
          name: matchedUser.name || matchedUser.username,
          role: matchedUser.role || 'user',
          must_change_pwd: !!matchedUser.must_change_pwd
        }), { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ status: 'error', detail: '帳號或密碼錯誤！' }), {
          status: 401,
          headers: corsHeaders
        });
      }
    }

    // 2. 取得大區清單 API
    if (url.pathname === '/api/categories/large') {
      try {
        const { results } = await env.DB.prepare(
          "SELECT DISTINCT category_large FROM inventory WHERE category_large IS NOT NULL AND category_large != '' ORDER BY category_large ASC"
        ).all();
        
        const data = (results || []).map(r => r.category_large);
        return new Response(JSON.stringify({ success: true, data }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, data: ["2F區域", "3F區域", "自動倉區"] }), { headers: corsHeaders });
      }
    }

    // 3. 根據大區取得小區清單 API
    if (url.pathname === '/api/categories/small') {
      const large = url.searchParams.get('large') || '';
      try {
        const { results } = await env.DB.prepare(
          "SELECT DISTINCT category_small FROM inventory WHERE category_large = ? AND category_small IS NOT NULL AND category_small != '' ORDER BY category_small ASC"
        ).bind(large).all();
        
        const data = (results || []).map(r => r.category_small);
        return new Response(JSON.stringify({ success: true, data }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, data: ["A區", "B區", "C區"] }), { headers: corsHeaders });
      }
    }

    // 4. 庫存分頁查詢 API
    if (url.pathname === '/api/search') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '1000', 10);
      const categoryLarge = url.searchParams.get('categoryLarge') || '';
      const categorySmall = url.searchParams.get('categorySmall') || '';
      const keyword = url.searchParams.get('keyword') || '';

      const offset = (page - 1) * pageSize;

      let whereConditions = [];
      let bindings = [];

      if (categoryLarge) {
        whereConditions.push("category_large = ?");
        bindings.push(categoryLarge);
      }
      if (categorySmall) {
        whereConditions.push("category_small = ?");
        bindings.push(categorySmall);
      }
      if (keyword) {
        whereConditions.push("(item_id LIKE ? OR item_name LIKE ?)");
        bindings.push(`%${keyword}%`, `%${keyword}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      try {
        const countStmt = `SELECT COUNT(*) as total FROM inventory ${whereClause}`;
        const countRes = await env.DB.prepare(countStmt).bind(...bindings).first();
        const total = countRes ? countRes.total : 0;

        const dataStmt = `SELECT * FROM inventory ${whereClause} LIMIT ? OFFSET ?`;
        const { results } = await env.DB.prepare(dataStmt).bind(...bindings, pageSize, offset).all();

        return new Response(JSON.stringify({
          success: true,
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
          data: results || []
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, page: 1, pageSize: 1000, total: 0, totalPages: 1, data: [] }), { headers: corsHeaders });
      }
    }

    // 5. 批次寫入資料庫 API
    if (url.pathname === '/api/batch-insert' && request.method === 'POST') {
      const { items } = await request.json();
      
      if (Array.isArray(items) && items.length > 0) {
        const stmt = env.DB.prepare(
          `INSERT INTO inventory (item_id, item_name, category_large, category_small, location, qty, cubic_feet)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        const batch = items.map(item => stmt.bind(
          item['商品ID'] || item['商品代碼'] || item.item_id || '',
          item['商品名稱'] || item.item_name || '',
          item['大區名'] || item['大區'] || item.category_large || '',
          item['區名'] || item['區'] || item.category_small || '',
          item['儲位'] || item.location || '',
          parseFloat(item['儲位庫存數'] || item['總庫存數'] || item.qty || 0),
          parseFloat(item['才數'] || item.cubic_feet || 0)
        ));

        await env.DB.batch(batch);
      }

      return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
    }

    // 6. 清空庫存資料庫 API
    if (url.pathname === '/api/clear' && request.method === 'POST') {
      try {
        await env.DB.prepare("DELETE FROM inventory").run();
      } catch (e) {}
      return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
    }

    // 7. 取得登入與操作歷程 API
    if (url.pathname === '/api/get-logs') {
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100"
        ).all();
        return new Response(JSON.stringify({ status: 'success', logs: results || [] }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'success', logs: [] }), { headers: corsHeaders });
      }
    }

    // 8. 紀錄日誌 API
    if (url.pathname === '/api/record-log' && request.method === 'POST') {
      try {
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO system_logs (username, feature, action, device, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))"
        ).bind(body.username || 'unknown', body.feature || '', body.action || '', body.device || '').run();
      } catch (err) {}
      
      return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
    }

    // 9. 取得使用者列表 API
    if (url.pathname === '/api/get-users') {
      try {
        const { results } = await env.DB.prepare("SELECT username, name, role FROM users").all();
        return new Response(JSON.stringify({ status: 'success', users: results || [] }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ 
          status: 'success', 
          users: [{ username: 'admin', name: '系統管理員', role: 'admin' }] 
        }), { headers: corsHeaders });
      }
    }

    // 404 預設回應
    return new Response(JSON.stringify({ status: 'error', message: 'API Endpoint Not Found' }), {
      status: 404,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', detail: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}