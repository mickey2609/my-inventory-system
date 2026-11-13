// routes/wmsFishScreenshot.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

module.exports = function(db) {
  const router = express.Router();

  // 預熱地端 Tesseract Worker（常駐記憶體）
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

  function cleanDigitStr(str) {
    return String(str || '')
      .replace(/[OoQq]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
  }

  // 解析左側條件區 + 右側純數字三欄（利用 Y 軸座標精準分出 24 列，不再受時段波浪號誤判影響）
  function parseWmsOcrResult(leftText, rightData) {
    const compactLeft = String(leftText || '').replace(/[ \t]+/g, '');
    const rightText = String(rightData?.text || '');
    const compactAll = `${compactLeft}\n${rightText.replace(/[ \t]+/g, '')}`;

    // 1. 解析左側條件參數
    let date = '';
    const cleanedDateSource = cleanDigitStr(compactLeft);
    const dateMatch = cleanedDateSource.match(/(20\d{2})[\/\-．.](\d{1,2})[\/\-．.](\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }

    let category = '轉單時間';
    if (/完成出貨|出貨/.test(compactAll)) category = '完成出貨';
    else if (/完成[撿揀]貨|[撿揀]貨/.test(compactAll)) category = '完成撿貨';
    else if (/轉單時間|轉單/.test(compactAll)) category = '轉單時間';

    let wh_code = '15';
    const whMatch = cleanDigitStr(compactLeft).match(/庫別[^\d\n]{0,4}(\d{1,3})/);
    if (whMatch) wh_code = whMatch[1];

    let region = '全部';
    const regMatch = compactLeft.match(/配送區域[^\u4e00-\u9fa5\n]{0,4}([\u4e00-\u9fa5]+)/);
    if (regMatch && regMatch[1]) region = regMatch[1];

    let is_24h = '全部';
    const h24Match = compactLeft.match(/24H到貨[^\u4e00-\u9fa5\n]{0,4}(全部|是|否)/);
    if (h24Match) is_24h = h24Match[1];

    // 2. 利用 Tesseract 行級/單字級結果解析右半邊（百分比、筆數、PCS數）
    const rawLines = rightText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    const extractedRows = [];

    for (const line of rawLines) {
      // 跳過表頭與非數據列
      if (/倉庫|魚群|時間|圖形|百分比|筆數|PCS|合計|總計/.test(line)) continue;

      // 去除帶有 % 的百分比欄位（例如 4.50%、1.79%、4.87%）
      const withoutPct = line.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');
      // 抓出所有數字區塊（例如 1,356  3,138 或 539  1,299）
      const numTokens = withoutPct.match(/\d[\d,.]*/g) || [];
      const ints = numTokens
        .map(tok => parseInt(tok.replace(/[,.]/g, ''), 10))
        .filter(n => !isNaN(n));

      if (ints.length >= 2) {
        extractedRows.push({
          order_count: ints[ints.length - 2],
          pcs_count: ints[ints.length - 1]
        });
      }
    }

    // 從上到下依序對應 00~01 到 23~24（若超過 24 列則取最後 24 列數據列）
    const final24 = extractedRows.length > 24
      ? extractedRows.slice(extractedRows.length - 24)
      : extractedRows;

    const normalizedHourly = Array.from({ length: 24 }, (_, idx) => {
      const slot = `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`;
      const row = final24[idx];
      return {
        hour_index: idx,
        hour_slot: slot,
        order_count: row ? row.order_count : 0,
        pcs_count: row ? row.pcs_count : 0
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

  // 3. 截圖辨識 API（左側條件區 + 右側純數字三欄裁切 + 黃底自動漂白）
  router.post('/recognize', async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '未接收到圖片資料' });
    }

    try {
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      const fullImg = await Jimp.read(imgBuffer);
      const W = fullImg.bitmap.width;
      const H = fullImg.bitmap.height;

      // 1) 左側條件區（最左側 18% 寬度）放大 3 倍
      const leftCrop = fullImg.clone()
        .crop(0, 0, Math.round(W * 0.18), H)
        .scale(3)
        .greyscale()
        .contrast(0.2);

      // 2) 右側純數字三欄（從 62% 寬度到最右邊：只切「百分比 / 筆數 / PCS數」，完全避開時段波浪號與藍色長條圖）
      const rightStartX = Math.round(W * 0.62);
      const rightCrop = fullImg.clone()
        .crop(rightStartX, 0, W - rightStartX, H);

      // 將 23~24 列的亮黃底色漂白為純白底黑字，同時消除淺灰色表格格線干擾
      rightCrop.scan(0, 0, rightCrop.bitmap.width, rightCrop.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        // 亮黃色底色 (R>170, G>170, B<150) 漂白成純白
        if (r > 170 && g > 170 && b < 150) {
          this.bitmap.data[idx] = 255;
          this.bitmap.data[idx + 1] = 255;
          this.bitmap.data[idx + 2] = 255;
        }
      });

      rightCrop.scale(3).greyscale().contrast(0.25);

      const [leftBuf, rightBuf] = await Promise.all([
        leftCrop.getBufferAsync(Jimp.MIME_PNG),
        rightCrop.getBufferAsync(Jimp.MIME_PNG)
      ]);

      const worker = await getOcrWorker();
      const leftRes = await worker.recognize(leftBuf);
      const rightRes = await worker.recognize(rightBuf);

      const parsed = parseWmsOcrResult(leftRes.data.text, rightRes.data);

      return res.json({
        success: true,
        engineUsed: 'local_ocr_columns',
        parsed
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