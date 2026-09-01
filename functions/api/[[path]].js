export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

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
        // 1. 登入 API (提供 admin/admin 與 6 碼員編通行權限)
        if (path === '/api/login' && request.method === 'POST') {
            const { username, password } = await request.json();

            // 預設只要帳號為 admin 且密碼為 admin，或密碼與帳號一致即允許登入
            if ((username === 'admin' && password === 'admin') || (username && password === username)) {
                return new Response(JSON.stringify({
                    status: 'success',
                    username: username,
                    name: username === 'admin' ? '系統管理員' : username,
                    role: username === 'admin' ? 'admin' : 'user',
                    must_change_pwd: false
                }), { headers: corsHeaders });
            }

            return new Response(JSON.stringify({ status: 'error', detail: '帳號或密碼錯誤！' }), { status: 400, headers: corsHeaders });
        }

        // 2. 紀錄日誌 API
        if (path === '/api/record-log' && request.method === 'POST') {
            return new Response(JSON.stringify({ status: 'success' }), { headers: corsHeaders });
        }

        // 3. 取得欄位設定 API
        if (path === '/api/get-column-config') {
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // 4. 清空舊庫存資料 API
        if (path === '/api/clear' && request.method === 'POST') {
            await env.DB.prepare('DELETE FROM inventory').run();
            return new Response(JSON.stringify({ success: true, message: '舊資料已清空' }), { headers: corsHeaders });
        }

        // 5. 批次寫入庫存 API
        if (path === '/api/batch-insert' && request.method === 'POST') {
            const { items } = await request.json();
            if (!items || !Array.isArray(items) || items.length === 0) {
                return new Response(JSON.stringify({ error: '無效的資料格式' }), { status: 400, headers: corsHeaders });
            }

            const statements = items.map(item => {
                const categoryLarge = item['大區名'] || item['大區'] || '';
                const categorySmall = item['區名'] || item['區'] || '';
                const productCode = item['商品ID'] || '';
                const productName = item['商品名稱'] || '';
                const rawData = JSON.stringify(item);

                return env.DB.prepare(
                    `INSERT INTO inventory (category_large, category_small, product_code, product_name, raw_data) VALUES (?, ?, ?, ?, ?)`
                ).bind(categoryLarge, categorySmall, productCode, productName, rawData);
            });

            await env.DB.batch(statements);
            return new Response(JSON.stringify({ success: true, count: items.length }), { headers: corsHeaders });
        }

        // 6. 取得動態大區清單 API
        if (path === '/api/categories/large' && request.method === 'GET') {
            const { results } = await env.DB.prepare(
                `SELECT DISTINCT category_large FROM inventory WHERE category_large IS NOT NULL AND category_large != '' ORDER BY category_large`
            ).all();
            const categories = results.map(r => r.category_large);
            return new Response(JSON.stringify({ success: true, data: categories }), { headers: corsHeaders });
        }

        // 7. 取得動態小區連動清單 API
        if (path === '/api/categories/small' && request.method === 'GET') {
            const large = url.searchParams.get('large') || '';
            const { results } = await env.DB.prepare(
                `SELECT DISTINCT category_small FROM inventory WHERE category_large = ? AND category_small IS NOT NULL AND category_small != '' ORDER BY category_small`
            ).bind(large).all();
            const categories = results.map(r => r.category_small);
            return new Response(JSON.stringify({ success: true, data: categories }), { headers: corsHeaders });
        }

        // 8. 伺服器端分頁查詢 API
        if (path === '/api/search' && request.method === 'GET') {
            const page = parseInt(url.searchParams.get('page') || '1');
            const pageSize = parseInt(url.searchParams.get('pageSize') || '1000');
            const offset = (page - 1) * pageSize;

            const categoryLarge = url.searchParams.get('categoryLarge') || '';
            const categorySmall = url.searchParams.get('categorySmall') || '';
            const keyword = url.searchParams.get('keyword') || '';

            let whereClauses = [];
            let params = [];

            if (categoryLarge) {
                whereClauses.push('category_large = ?');
                params.push(categoryLarge);
            }
            if (categorySmall) {
                whereClauses.push('category_small = ?');
                params.push(categorySmall);
            }
            if (keyword) {
                whereClauses.push('(product_code LIKE ? OR product_name LIKE ?)');
                params.push(`%${keyword}%`, `%${keyword}%`);
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM inventory ${whereSql}`).bind(...params).first();
            const total = countResult ? countResult.total : 0;

            const querySql = `SELECT raw_data FROM inventory ${whereSql} LIMIT ? OFFSET ?`;
            const { results } = await env.DB.prepare(querySql).bind(...params, pageSize, offset).all();

            const items = results.map(r => JSON.parse(r.raw_data));

            return new Response(JSON.stringify({
                success: true,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                data: items
            }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}