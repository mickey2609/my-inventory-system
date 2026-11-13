// routes/wmsFishScreenshot.js
const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function(db) {
  const router = express.Router();

  // 讀取 .env 或資料庫中儲存的 GEMINI_API_KEY（零外部依賴）
  function getGeminiApiKey(callback) {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return callback(process.env.GEMINI_API_KEY.trim());
    }
    try {
      const envPath = path.join(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
        if (match && match[1]) {
          return callback(match[1].trim());
        }
      }
    } catch (e) {}

    db.get(`SELECT config_value FROM system_config WHERE config_key = 'gemini_api_key'`, [], (err, row) => {
      callback(row && row.config_value ? row.config_value.trim() : '');
    });
  }

  function normalizeDate(val) {
    if (!val) return '';
    const s = String(val).trim().replace(/\//g, '-').split(' ')[0];
    const parts = s.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return s;
  }

  // 1. 初始化資料表
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS wms_fish_screenshot_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_date TEXT,
        category TEXT,
        wh_code TEXT,
        order_type TEXT,
        region TEXT,
        ship_types TEXT,
        is_24h TEXT,
        hour_index INTEGER,
        hour_slot TEXT,
        order_count INTEGER DEFAULT 0,
        pcs_count INTEGER DEFAULT 0,
        created_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stat_date, category, wh_code, region, ship_types, is_24h, hour_index)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_wms_fish_date ON wms_fish_screenshot_stats(stat_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_wms_fish_cat ON wms_fish_screenshot_stats(category)`);
  });

  // 2. 檢查/儲存 API Key 狀態（僅管理員可用）
  router.get('/key-status', (req, res) => {
    getGeminiApiKey((key) => {
      res.json({
        success: true,
        hasKey: Boolean(key),
        maskedKey: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : ''
      });
    });
  });

  router.post('/save-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || !String(apiKey).trim()) {
      return res.status(400).json({ success: false, message: '請輸入有效的 GEMINI_API_KEY' });
    }
    const cleanKey = String(apiKey).trim();
    db.run(
      `INSERT INTO system_config (config_key, config_value) VALUES ('gemini_api_key', ?)
       ON CONFLICT(config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
      [cleanKey],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: '🎉 Gemini API Key 已安全儲存至伺服器設定！' });
      }
    );
  });

  // 3. 呼叫 Gemini Vision API 辨識 WMS 魚群截圖（使用 gemini-3.8-flash 並支援備援）
  router.post('/recognize', (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '未接收到圖片資料' });
    }

    getGeminiApiKey(async (apiKey) => {
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          needKey: true,
          message: '尚未設定 GEMINI_API_KEY，請先點擊右上角「🔑 設定 API Key」或在根目錄 .env 加入金鑰！'
        });
      }

      try {
        let mimeType = 'image/png';
        let base64Data = imageBase64;
        const dataUrlMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1];
          base64Data = dataUrlMatch[2];
        }

        const promptText = `你是一個精準的台灣倉庫 WMS 系統「倉庫 魚群出沒時間」截圖資料擷取器。
請仔細辨識圖片中的左側查詢條件與右側 24 小時（00 ~ 01 到 23 ~ 24）表格數據，並嚴格回傳 JSON 格式（不要包含 markdown 標記或其他多餘文字）：
1. date: 左側「日期」欄位的值，轉換為 YYYY-MM-DD 格式（例如 2026/11/12 -> 2026-11-12）。
2. category: 左側「類別」下拉選單的值（例如：轉單時間、完成出貨、完成撿貨）。
3. wh_code: 左側「庫別」的值（例如：15 或 80）。
4. order_type: 左側「單別」的值（例如：揀貨單號）。
5. region: 左側「配送區域」的值（例如：全部、北北基桃 等）。
6. ship_types: 陣列，列出左側「出貨類別（可複選）」中有打勾（☑）的項目名稱（例如：["當日配、貨到付款、郵箱", "大材積、大材積 (貨到付款)", "安裝", "海外", "超商(7-11)", "超商(全家)", "超大", "OK超取", "萊爾富超取", "超速配"]）。請務必只包含有打勾的項目。
7. is_24h: 左側「需24H到貨」下拉選單的值（例如：全部、是、否）。
8. hourly: 固定 24 筆陣列（hour_index 從 0 到 23），對應右側表格從 "00 ~ 01" 到 "23 ~ 24" 的每一列：
   - hour_index: 整數 0~23
   - hour_slot: 字串 "00~01" 到 "23~24"
   - order_count: 「筆數」欄位的純整數（去除逗號，空白或無數字填 0）
   - pcs_count: 「PCS數」欄位的純整數（去除逗號，空白或無數字填 0）`;

        const payload = {
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        };

        const candidateModels = [
          'gemini-3.8-flash',
          'gemini-3.8-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.0-flash'
        ];
        let result = null;
        let lastErrMsg = '';

        for (const modelName of candidateModels) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
              result = data;
              break;
            }
            lastErrMsg = data?.error?.message || `HTTP ${response.status}`;
            const isTransient = /high demand|overloaded|unavailable|try again|rate limit/i.test(lastErrMsg) || response.status === 503 || response.status === 429;
            if (isTransient && attempt < 2) {
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }
            break;
          }
          if (result) break;
        }

        if (!result) {
          return res.status(500).json({ success: false, message: `Gemini API 辨識失敗：${lastErrMsg}` });
        }

        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanedJson = rawText.replace(/```json\s*|```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        // 標準化 24 小時陣列防呆補齊
        const hourlyMap = new Map();
        (parsed.hourly || []).forEach(h => {
          const idx = parseInt(h.hour_index, 10);
          if (!isNaN(idx) && idx >= 0 && idx < 24) {
            hourlyMap.set(idx, {
              hour_index: idx,
              hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
              order_count: parseInt(String(h.order_count || 0).replace(/,/g, ''), 10) || 0,
              pcs_count: parseInt(String(h.pcs_count || 0).replace(/,/g, ''), 10) || 0
            });
          }
        });

        const normalizedHourly = Array.from({ length: 24 }, (_, idx) => {
          return hourlyMap.get(idx) || {
            hour_index: idx,
            hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
            order_count: 0,
            pcs_count: 0
          };
        });

        const allShipTypes = [
          '當日配、貨到付款、郵箱', '大材積、大材積 (貨到付款)', '安裝', '海外',
          '超商(7-11)', '超商(全家)', '超大', 'OK超取', '萊爾富超取', '超速配'
        ];
        const detectedTypes = Array.isArray(parsed.ship_types) ? parsed.ship_types : allShipTypes;

        res.json({
          success: true,
          parsed: {
            date: normalizeDate(parsed.date) || new Date().toISOString().split('T')[0],
            category: String(parsed.category || '轉單時間').trim(),
            wh_code: String(parsed.wh_code || '15').trim(),
            order_type: String(parsed.order_type || '揀貨單號').trim(),
            region: String(parsed.region || '全部').trim(),
            ship_types: detectedTypes,
            is_24h: String(parsed.is_24h || '全部').trim(),
            hourly: normalizedHourly
          }
        });
      } catch (err) {
        res.status(500).json({ success: false, message: '影像辨識解析異常：' + err.message });
      }
    });
  });

  // 4. 確認核對後寫入 SQLite 資料庫
  router.post('/save', (req, res) => {
    const { date, category, wh_code, order_type, region, ship_types, is_24h, hourly, created_by } = req.body;
    const cleanDate = normalizeDate(date);
    if (!cleanDate || !category || !Array.isArray(hourly) || hourly.length === 0) {
      return res.status(400).json({ success: false, message: '缺少必要日期、類別或時段數據' });
    }

    const shipTypesStr = Array.isArray(ship_types)
      ? (ship_types.length >= 10 ? '全部出貨類別 (10項全選)' : ship_types.join('、'))
      : String(ship_types || '全部出貨類別');

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO wms_fish_screenshot_stats (
          stat_date, category, wh_code, order_type, region, ship_types, is_24h,
          hour_index, hour_slot, order_count, pcs_count, created_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
        ON CONFLICT(stat_date, category, wh_code, region, ship_types, is_24h, hour_index) DO UPDATE SET
          order_type = EXCLUDED.order_type,
          order_count = EXCLUDED.order_count,
          pcs_count = EXCLUDED.pcs_count,
          created_by = EXCLUDED.created_by,
          updated_at = DATETIME('now')
      `);

      hourly.forEach(h => {
        const idx = parseInt(h.hour_index, 10);
        const slot = `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`;
        const cnt = parseInt(h.order_count, 10) || 0;
        const pcs = parseInt(h.pcs_count, 10) || 0;
        stmt.run(
          cleanDate, category, wh_code || '15', order_type || '揀貨單號',
          region || '全部', shipTypesStr, is_24h || '全部',
          idx, slot, cnt, pcs, created_by || 'admin'
        );
      });

      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: '寫入資料庫失敗：' + err.message });
        res.json({ success: true, message: `🎉 成功寫入【${cleanDate} / ${wh_code}庫 / ${category}】24小時魚群數據！` });
      });
    });
  });

  // 5. 查詢已儲存的日期與條件批次清單
  router.get('/batches', (req, res) => {
    const sql = `
      SELECT 
        stat_date, category, wh_code, region, ship_types, is_24h,
        SUM(order_count) as total_orders,
        SUM(pcs_count) as total_pcs,
        MAX(updated_at) as updated_at
      FROM wms_fish_screenshot_stats
      GROUP BY stat_date, category, wh_code, region, ship_types, is_24h
      ORDER BY stat_date DESC, wh_code ASC, category ASC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, list: rows || [] });
    });
  });

  // 6. 取得指定條件的 24 小時數據（支援同日多類別「轉單 / 撿貨 / 出貨」並排對比）
  router.get('/analysis', (req, res) => {
    const { statDate, whCode, region, is24h } = req.query;
    if (!statDate) return res.json({ success: true, rows: [] });

    let sql = `SELECT * FROM wms_fish_screenshot_stats WHERE stat_date = ?`;
    const params = [statDate];
    if (whCode && whCode !== 'all') { sql += ` AND wh_code = ?`; params.push(whCode); }
    if (region && region !== 'all') { sql += ` AND region = ?`; params.push(region); }
    if (is24h && is24h !== 'all') { sql += ` AND is_24h = ?`; params.push(is24h); }
    sql += ` ORDER BY category ASC, hour_index ASC`;

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, rows: rows || [] });
    });
  });

  // 7. 刪除指定批次紀錄
  router.post('/delete-batch', (req, res) => {
    const { stat_date, category, wh_code, region, ship_types, is_24h } = req.body;
    db.run(
      `DELETE FROM wms_fish_screenshot_stats 
       WHERE stat_date = ? AND category = ? AND wh_code = ? AND region = ? AND ship_types = ? AND is_24h = ?`,
      [stat_date, category, wh_code, region, ship_types, is_24h],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: '🗑️ 已刪除該筆截圖統計紀錄！' });
      }
    );
  });

  return router;
};