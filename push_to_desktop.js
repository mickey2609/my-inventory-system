const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// 替換為你在桌機端看到的 Tunnel 網址
const DESKTOP_API_URL = 'https://vincent-laugh-pan-orange.trycloudflare.com/api/upload';

// 1. 自動尋找筆電本地 .wrangler 模擬器 SQLite 檔案
const wranglerDir = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files = fs.readdirSync(wranglerDir);
const dbFile = files.find(f => f.endsWith('.sqlite') || !f.includes('.'));

if (!dbFile) {
  console.error('❌ 找不到模擬器資料庫檔案！');
  process.exit(1);
}

const dbPath = `${wranglerDir}/${dbFile}`;
console.log(`📁 讀取筆電模擬器資料庫: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// 2. 讀取所有庫存資料並推送到桌機
db.all('SELECT * FROM inventory', [], async (err, rows) => {
  if (err) {
    console.error('❌ 讀取模擬器資料失敗:', err.message);
    return;
  }

  console.log(`🚀 正在將 ${rows.length} 筆資料同步至桌機...`);

  try {
    const res = await axios.post(DESKTOP_API_URL, { items: rows });
    console.log(`🎉 轉移成功！桌機回傳訊息: ${res.data.message}`);
  } catch (uploadErr) {
    console.error('❌ 推送至桌機失敗:', uploadErr.message);
  } finally {
    db.close();
  }
});