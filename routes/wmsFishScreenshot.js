// routes/wmsFishScreenshot.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

module.exports = function(db) {
  const router = express.Router();

  let ocrWorkerPromise = null;

  function getOcrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = (async () => {
        return await Tesseract.createWorker('chi_tra+eng', 1, {
          cachePath: path.join(__dirname, '..', '.ocr_cache')
        });
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

  // 清除圖片中的長直線格線（避免垂直格線被當成 1）
  function eraseGridLines(jimpImg) {
    const w = jimpImg.bitmap.width;
    const h = jimpImg.bitmap.height;
    const data = jimpImg.bitmap.data;

    const isDark = (x, y) => {
      const idx = (y * w + x) * 4;
      return data[idx] < 160 && data[idx + 1] < 160 && data[idx + 2] < 160;
    };

    for (let y = 0; y < h; y++) {
      let darkCount = 0;
      for (let x = 0; x < w; x++) {
        if (isDark(x, y)) darkCount++;
      }
      if (darkCount > w * 0.50) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
        }
      }
    }

    for (let x = 0; x < w; x++) {
      let darkCount = 0;
      for (let y = 0; y < h; y++) {
        if (isDark(x, y)) darkCount++;
      }
      if (darkCount > h * 0.50) {
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
        }
      }
    }
  }

  // 利用 Tesseract 回傳的單字座標 (words bbox) 進行二維空間還原，完全不靠硬編碼切欄
  function extractStructuredDataFromWords(words, rawText, imgW, imgH) {
    const compactAll = String(rawText || '').replace(/[ \t]+/g, '');

    // 1. 解析左側條件參數（只取 X 座標在圖片左側 25% 內的文字）
    const leftWordsText = words
      .filter(w => w.bbox.x0 < imgW * 0.25)
      .map(w => w.text)
      .join('');
    const compactLeft = leftWordsText.replace(/[ \t]+/g, '');

    let date = '';
    const dateMatch = (compactLeft + '\n' + compactAll).match(/(20\d{2})[\/\-．.](\d{1,2})[\/\-．.](\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }

    let category = '轉單時間';
    if (/完成出貨|出貨/.test(compactLeft)) category = '完成出貨';
    else if (/完成[撿揀]貨|[撿揀]貨/.test(compactLeft)) category = '完成撿貨';
    else if (/轉單時間|轉單/.test(compactLeft)) category = '轉單時間';

    let wh_code = '15';
    const whMatch = compactLeft.match(/庫別[^\d\n]{0,4}(\d{1,2})(?!\d)/);
    if (whMatch) wh_code = whMatch[1];

    let region = '全部';
    const regMatch = compactLeft.match(/配送區域[^\u4e00-\u9fa5\n]{0,4}([\u4e00-\u9fa5]+)/);
    if (regMatch && regMatch[1]) region = regMatch[1];

    // 2. 篩選出主表格區域（X > 圖片寬度 50% 的所有數字單字，包含百分比、筆數、PCS數）
    const tableWords = words
      .filter(w => w.bbox.x0 > imgW * 0.50 && w.bbox.y0 > imgH * 0.06)
      .map(w => ({
        text: String(w.text || '').trim(),
        x0: w.bbox.x0,
        x1: w.bbox.x1,
        yc: (w.bbox.y0 + w.bbox.y1) / 2,
        h: w.bbox.y1 - w.bbox.y0
      }))
      .filter(w => /\d/.test(w.text));

    // 按垂直中心點 yc 由上到下排序，並將同一橫列的單字聚類（容差約為字高的 65%）
    tableWords.sort((a, b) => a.yc - b.yc);
    const rowClusters = [];
    for (const item of tableWords) {
      const tol = Math.max(8, item.h * 0.65);
      const lastCluster = rowClusters[rowClusters.length - 1];
      if (lastCluster && Math.abs(item.yc - lastCluster.avgY) <= tol) {
        lastCluster.items.push(item);
        lastCluster.avgY = lastCluster.items.reduce((s, it) => s + it.yc, 0) / lastCluster.items.length;
      } else {
        rowClusters.push({ avgY: item.yc, items: [item] });
      }
    }

    // 每一橫列依 X 座標由左到右排序，合併相距極近的同一格碎片，再取最後兩欄（筆數、PCS數）
    const parsedRows = [];
    for (const cluster of rowClusters) {
      const sorted = cluster.items.sort((a, b) => a.x0 - b.x0);
      // 過濾掉帶有 % 或小數點的百分比欄位
      const nonPctItems = sorted.filter(it => !it.text.includes('%') && !/\d+\.\d+/.test(it.text));

      // 若同一儲存格的數字被空格拆成兩段（例如 "1," 和 "356"），根據 X 距離合併
      const mergedCells = [];
      for (const it of nonPctItems) {
        const cleanDigits = it.text.replace(/[^0-9]/g, '');
        if (!cleanDigits) continue;
        const prev = mergedCells[mergedCells.length - 1];
        if (prev && (it.x0 - prev.x1) < Math.max(12, it.h * 0.8)) {
          prev.digits += cleanDigits;
          prev.x1 = it.x1;
        } else {
          mergedCells.push({ digits: cleanDigits, x0: it.x0, x1: it.x1 });
        }
      }

      if (mergedCells.length >= 2) {
        const orderVal = parseInt(mergedCells[mergedCells.length - 2].digits, 10);
        const pcsVal = parseInt(mergedCells[mergedCells.length - 1].digits, 10);
        if (!isNaN(orderVal) && !isNaN(pcsVal)) {
          parsedRows.push({ order_count: orderVal, pcs_count: pcsVal });
        }
      }
    }

    const final24 = parsedRows.length > 24 ? parsedRows.slice(parsedRows.length - 24) : parsedRows;

    const hourly = Array.from({ length: 24 }, (_, idx) => ({
      hour_index: idx,
      hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
      order_count: final24[idx] ? final24[idx].order_count : 0,
      pcs_count: final24[idx] ? final24[idx].pcs_count : 0
    }));

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
      is_24h: '全部',
      hourly
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

  // 3. 截圖辨識 API（全圖二維單字座標矩陣還原，完全免疫雙螢幕比例與切欄偏移）
  router.post('/recognize', async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '未接收到圖片資料' });
    }

    try {
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      const fullImg = await Jimp.read(imgBuffer);

      // 僅漂白亮黃色底色列 (R>180, G>180, B<145)，完整保留灰階抗鋸齒數字
      fullImg.scan(0, 0, fullImg.bitmap.width, fullImg.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        if (r > 180 && g > 180 && b < 145) {
          this.bitmap.data[idx] = 255;
          this.bitmap.data[idx + 1] = 255;
          this.bitmap.data[idx + 2] = 255;
        }
      });

      eraseGridLines(fullImg);
      fullImg.scale(2.5, Jimp.RESIZE_BICUBIC).greyscale().contrast(0.25);

      const processedBuf = await fullImg.getBufferAsync(Jimp.MIME_PNG);
      const worker = await getOcrWorker();
      const { data } = await worker.recognize(processedBuf);

      const parsed = extractStructuredDataFromWords(
        data.words || [],
        data.text || '',
        fullImg.bitmap.width,
        fullImg.bitmap.height
      );

      return res.json({
        success: true,
        engineUsed: 'local_ocr_bbox_matrix',
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