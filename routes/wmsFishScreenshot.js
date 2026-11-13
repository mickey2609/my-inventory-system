// routes/wmsFishScreenshot.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

module.exports = function(db) {
  const router = express.Router();

  // 預熱地端 Tesseract Worker（常駐記憶體，後續每次截圖 1~2 秒內完成）
  let ocrWorkerPromise = null;
  function getOcrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = (async () => {
        const worker = await Tesseract.createWorker('chi_tra+eng', 1, {
          cachePath: path.join(__dirname, '..', '.ocr_cache')
        });
        return worker;
      })().catch(err => {
        ocrWorkerPromise = null;
        throw err;
      });
    }
    return ocrWorkerPromise;
  }

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

  // 解析地端 OCR 辨識出的整張畫面文字
  function parseWmsOcrText(rawText) {
    const cleanText = String(rawText || '').replace(/\r/g, '');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. 解析左側條件參數
    let date = '';
    const dateMatch = cleanText.match(/(20\d{2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }

    let category = '轉單時間';
    if (/完成出貨/.test(cleanText)) category = '完成出貨';
    else if (/完成[撿揀]貨/.test(cleanText)) category = '完成撿貨';
    else if (/轉單時間/.test(cleanText)) category = '轉單時間';

    let wh_code = '15';
    const whMatch = cleanText.match(/庫別[^\d\n]{0,6}(\d{1,3})/);
    if (whMatch) wh_code = whMatch[1];

    let region = '全部';
    const regMatch = cleanText.match(/配送區域[^\u4e00-\u9fa5\n]{0,6}([\u4e00-\u9fa5]+)/);
    if (regMatch && regMatch[1]) region = regMatch[1];

    let is_24h = '全部';
    const h24Match = cleanText.match(/24H到貨[^\u4e00-\u9fa5\n]{0,6}(全部|是|否)/);
    if (h24Match) is_24h = h24Match[1];

    // 2. 解析右側 24 小時（00 ~ 01 到 23 ~ 24）每一列的「百分比 / 筆數 / PCS數」
    const hourlyMap = new Map();

    for (const line of lines) {
      // 匹配開頭為 "00 ~ 01" 或 "00~01" 或 "00 - 01" 的資料列
      const slotMatch = line.match(/(?:^|\s)([012]?\d)\s*[~\-～—]\s*([012]?\d)(?:\s|$)/);
      if (!slotMatch) continue;

      const startH = parseInt(slotMatch[1], 10);
      const endH = parseInt(slotMatch[2], 10);
      if (isNaN(startH) || startH < 0 || startH > 23 || endH !== startH + 1) continue;

      // 取出時段後面的所有數字片段（例如：12.58%  2,357  5,135）
      const afterSlot = line.slice(line.indexOf(slotMatch[0]) + slotMatch[0].length);
      // 排除帶有 % 的百分比數字，抓後面的整數（允許千分位逗號或空格誤判）
      const withoutPct = afterSlot.replace(/\d+(?:\.\d+)?\s*%/g, ' ');
      const numTokens = withoutPct.match(/\d[\d,.]*/g) || [];

      const ints = numTokens
        .map(tok => parseInt(tok.replace(/[,.]/g, ''), 10))
        .filter(n => !isNaN(n));

      let order_count = 0;
      let pcs_count = 0;
      if (ints.length >= 2) {
        // 表格最後兩欄固定為：倒數第二欄=筆數、最後一欄=PCS數
        order_count = ints[ints.length - 2];
        pcs_count = ints[ints.length - 1];
      } else if (ints.length === 1) {
        order_count = ints[0];
        pcs_count = ints[0];
      }

      hourlyMap.set(startH, {
        hour_index: startH,
        hour_slot: `${String(startH).padStart(2, '0')}~${String(startH + 1).padStart(2, '0')}`,
        order_count,
        pcs_count
      });
    }

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

    return {
      date: date || new Date().toISOString().split('T')[0],
      category,
      wh_code,
      order_type: '揀貨單號',
      region,
      ship_types: allShipTypes,
      is_24h,
      hourly: normalizedHourly
    };
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

  // 2. 檢查/儲存 API Key 狀態
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

  // 3. 截圖辨識 API（預設使用地端高速離線 OCR，1~3秒完成、免連外網）
  router.post('/recognize', async (req, res) => {
    const { imageBase64, engine } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '未接收到圖片資料' });
    }

    try {
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');

      // 預設使用地端 Tesseract.js 離線高速辨識
      if (engine !== 'gemini') {
        const image = await Jimp.read(imgBuffer);
        // 放大 2 倍 + 灰階 + 高對比強化，讓表格數字辨識極度清晰
        if (image.bitmap.width < 2200) {
          image.scale(2);
        }
        image.greyscale().contrast(0.35);
        const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

        const worker = await getOcrWorker();
        const { data } = await worker.recognize(processedBuffer);
        const parsed = parseWmsOcrText(data.text);

        return res.json({
          success: true,
          engineUsed: 'local_ocr',
          parsed
        });
      }

      // 若手動指定切換為 Gemini 雲端 AI 辨識
      getGeminiApiKey(async (apiKey) => {
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            needKey: true,
            message: '尚未設定 GEMINI_API_KEY'
          });
        }

        const promptText = `擷取台灣倉庫 WMS「倉庫 魚群出沒時間」截圖數據，嚴格回傳 JSON（無 markdown）：
{
  "date": "左側日期 YYYY-MM-DD",
  "category": "左側類別(轉單時間/完成出貨/完成撿貨)",
  "wh_code": "左側庫別純字串(如15或80)",
  "order_type": "左側單別(如揀貨單號)",
  "region": "左側配送區域(如全部)",
  "ship_types": ["左側出貨類別有打勾(☑)的項目名稱陣列"],
  "is_24h": "左側需24H到貨(如全部)",
  "rows": [[00~01筆數, 00~01PCS數], ... 共24組整數陣列，依序對應 00~01 到 23~24，無逗號，空白填0]
}`;

        const payload = {
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
          return res.status(500).json({ success: false, message: data?.error?.message || `HTTP ${response.status}` });
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(rawText.replace(/```json\s*|```/g, '').trim());
        const rawRows = Array.isArray(parsed.rows) ? parsed.rows : [];
        const normalizedHourly = Array.from({ length: 24 }, (_, idx) => {
          const slot = `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`;
          const item = rawRows[idx];
          return Array.isArray(item)
            ? { hour_index: idx, hour_slot: slot, order_count: parseInt(item[0], 10) || 0, pcs_count: parseInt(item[1], 10) || 0 }
            : { hour_index: idx, hour_slot: slot, order_count: 0, pcs_count: 0 };
        });

        res.json({
          success: true,
          engineUsed: 'gemini',
          parsed: {
            date: normalizeDate(parsed.date) || new Date().toISOString().split('T')[0],
            category: String(parsed.category || '轉單時間').trim(),
            wh_code: String(parsed.wh_code || '15').trim(),
            order_type: String(parsed.order_type || '揀貨單號').trim(),
            region: String(parsed.region || '全部').trim(),
            ship_types: Array.isArray(parsed.ship_types) ? parsed.ship_types : [],
            is_24h: String(parsed.is_24h || '全部').trim(),
            hourly: normalizedHourly
          }
        });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: '地端 OCR 辨識異常：' + err.message });
    }
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

  // 6. 取得指定條件的 24 小時數據
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