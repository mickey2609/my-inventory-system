// routes/wmsFishScreenshot.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

module.exports = function(db) {
  const router = express.Router();

  let textWorkerPromise = null;
  let colWorkerPromise = null;

  function getTextWorker() {
    if (!textWorkerPromise) {
      textWorkerPromise = (async () => {
        return await Tesseract.createWorker('chi_tra+eng', 1, {
          cachePath: path.join(__dirname, '..', '.ocr_cache')
        });
      })().catch(err => {
        textWorkerPromise = null;
        throw err;
      });
    }
    return textWorkerPromise;
  }

  function getColWorker() {
    if (!colWorkerPromise) {
      colWorkerPromise = (async () => {
        const worker = await Tesseract.createWorker('eng', 1, {
          cachePath: path.join(__dirname, '..', '.ocr_cache')
        });
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // 單欄垂直列表逐行辨識
          tessedit_char_whitelist: '0123456789,'
        });
        return worker;
      })().catch(err => {
        colWorkerPromise = null;
        throw err;
      });
    }
    return colWorkerPromise;
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

  // 清除圖片中的水平與垂直長直線（徹底消滅表格黑線被誤認為 1 的問題）
  function eraseGridLines(jimpImg) {
    const w = jimpImg.bitmap.width;
    const h = jimpImg.bitmap.height;
    const data = jimpImg.bitmap.data;

    const isDark = (x, y) => {
      const idx = (y * w + x) * 4;
      return data[idx] < 150 && data[idx + 1] < 150 && data[idx + 2] < 150;
    };

    // 1. 清除水平橫線（連續超過 45% 寬度都是深色像素的整列直接塗白）
    for (let y = 0; y < h; y++) {
      let darkCount = 0;
      for (let x = 0; x < w; x++) {
        if (isDark(x, y)) darkCount++;
      }
      if (darkCount > w * 0.45) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
        }
      }
    }

    // 2. 清除垂直直線（連續超過 45% 高度都是深色像素的整行直接塗白）
    for (let x = 0; x < w; x++) {
      let darkCount = 0;
      for (let y = 0; y < h; y++) {
        if (isDark(x, y)) darkCount++;
      }
      if (darkCount > h * 0.45) {
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
        }
      }
    }
  }

  // 預處理單一數字直欄（放大 4 倍 + 去除格線 + 漂白底色）
  async function prepareNumericColumn(img) {
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      // 所有淺灰/米黃/亮黃底色一律轉純白，只保留深黑色數字
      if (r > 135 && g > 135) {
        this.bitmap.data[idx] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
      }
    });
    eraseGridLines(img);
    img.scale(4, Jimp.RESIZE_BICUBIC).greyscale().contrast(0.35);
    return await img.getBufferAsync(Jimp.MIME_PNG);
  }

  // 解析單欄垂直數字列表（預期 24 個數字）
  function parseColumnNumbers(rawText) {
    const lines = String(rawText || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    const nums = [];
    for (const line of lines) {
      // 移除非數字與逗號，合併同列數字
      const cleaned = line.replace(/[^0-9,]/g, '');
      if (!cleaned) continue;
      const val = parseInt(cleaned.replace(/,/g, ''), 10);
      if (!isNaN(val)) {
        nums.push(val);
      }
    }
    // 若表頭有雜訊多抓到 1 筆，取最後 24 筆
    return nums.length > 24 ? nums.slice(nums.length - 24) : nums;
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

  // 3. 截圖辨識 API（獨立切欄 + 消除格線 + 4倍放大抗鋸齒 OCR）
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

      // 1) 左側條件區（僅取左上角 0~16.5% 寬度、0~32% 高度：包含日期、類別、庫別、配送區域）
      const leftTopCrop = fullImg.clone()
        .crop(0, 0, Math.round(W * 0.165), Math.round(H * 0.32));
      eraseGridLines(leftTopCrop);
      leftTopCrop.scale(4, Jimp.RESIZE_BICUBIC).greyscale().contrast(0.2);

      // 2) 數據表垂直範圍：跳過頂部兩列表頭（約從 7.5% 高度到底部 100%）
      const tableTopY = Math.round(H * 0.075);
      const tableH = H - tableTopY;

      // 獨立切出「筆數欄」（寬度 74.5% ~ 87.2%）與「PCS數欄」（寬度 87.2% ~ 99.8%）
      const ordersColImg = fullImg.clone().crop(
        Math.round(W * 0.745),
        tableTopY,
        Math.round(W * 0.127),
        tableH
      );
      const pcsColImg = fullImg.clone().crop(
        Math.round(W * 0.872),
        tableTopY,
        W - Math.round(W * 0.872) - 2,
        tableH
      );

      const [leftBuf, ordersBuf, pcsBuf] = await Promise.all([
        leftTopCrop.getBufferAsync(Jimp.MIME_PNG),
        prepareNumericColumn(ordersColImg),
        prepareNumericColumn(pcsColImg)
      ]);

      const [textWorker, colWorker] = await Promise.all([
        getTextWorker(),
        getColWorker()
      ]);

      const leftRes = await textWorker.recognize(leftBuf);
      // 依序辨識兩條純數字垂直欄
      const ordersRes = await colWorker.recognize(ordersBuf);
      const pcsRes = await colWorker.recognize(pcsBuf);

      // 解析左側文字
      const compactLeft = String(leftRes.data.text || '').replace(/[ \t]+/g, '');
      let date = '';
      const dateMatch = compactLeft.match(/(20\d{2})[\/\-．.](\d{1,2})[\/\-．.](\d{1,2})/);
      if (dateMatch) {
        date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }

      let category = '轉單時間';
      if (/完成出貨|出貨/.test(compactLeft)) category = '完成出貨';
      else if (/完成[撿揀]貨|[撿揀]貨/.test(compactLeft)) category = '完成撿貨';
      else if (/轉單時間|轉單/.test(compactLeft)) category = '轉單時間';

      let wh_code = '15';
      const whMatch = compactLeft.match(/庫別[^\d\n]{0,3}(\d{1,2})(?!\d)/);
      if (whMatch) wh_code = whMatch[1];

      let region = '全部';
      const regMatch = compactLeft.match(/配送區域[^\u4e00-\u9fa5\n]{0,3}([\u4e00-\u9fa5]+)/);
      if (regMatch && regMatch[1]) region = regMatch[1];

      // 解析兩條純數字直欄
      const ordersList = parseColumnNumbers(ordersRes.data.text);
      const pcsList = parseColumnNumbers(pcsRes.data.text);

      const hourly = Array.from({ length: 24 }, (_, idx) => ({
        hour_index: idx,
        hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
        order_count: ordersList[idx] !== undefined ? ordersList[idx] : 0,
        pcs_count: pcsList[idx] !== undefined ? pcsList[idx] : 0
      }));

      const allShipTypes = [
        '當日配、貨到付款、郵箱', '大材積、大材積 (貨到付款)', '安裝', '海外',
        '超商(7-11)', '超商(全家)', '超大', 'OK超取', '萊爾富超取', '超速配'
      ];

      return res.json({
        success: true,
        engineUsed: 'local_ocr_grid_columns',
        parsed: {
          date: date || new Date().toISOString().split('T')[0],
          category,
          wh_code,
          order_type: '揀貨單號',
          region,
          ship_types: allShipTypes,
          is_24h: '全部',
          hourly
        }
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