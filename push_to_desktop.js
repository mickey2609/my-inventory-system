// push_to_desktop.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const BIN_ID = '6aad2ed2ac6210605adc4575'; 
const JSONBIN_KEY = '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm'; 

function getTunnelUrlFromBin() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.jsonbin.io',
      port: 443,
      path: `/v3/b/${BIN_ID}/latest?t=${Date.now()}`,
      method: 'GET',
      headers: { 'X-Master-Key': JSONBIN_KEY }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          if (json.record && json.record.url) resolve(json.record.url.trim());
          else reject('Bin 內容無網址');
        } else reject(`抓取網址失敗 (Status: ${res.statusCode})`);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function sendFile(desktopUrl, relativeFilePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, relativeFilePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ 檔案不存在，跳過推送：${relativeFilePath}`);
      return resolve();
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const urlObj = new URL(desktopUrl);

    const postData = JSON.stringify({
      filename: relativeFilePath.replace(/\\/g, '/'),
      code: fileContent
    });

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: '/api/system/update-server-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`🎉 成功更新 ${relativeFilePath} 至地端桌機！`);
          resolve(body);
        } else {
          reject(`桌機回應錯誤 (${res.statusCode}): ${body}`);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pushWithRetry(desktopUrl, relativeFilePath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendFile(desktopUrl, relativeFilePath);
      return;
    } catch (err) {
      console.log(`⏳ [${relativeFilePath}] 推送遭遇中斷 (${err})，等待 3 秒後重試 (${attempt}/${maxRetries})...`);
      await sleep(3000);
      if (attempt === maxRetries) throw err;
    }
  }
}

async function main() {
  try {
    console.log('🔍 正在從 JSONBin 讀取桌機最新網址...');
    const desktopUrl = await getTunnelUrlFromBin();
    console.log(`🔗 成功取得桌機網址：${desktopUrl}`);

    console.log('🚀 開始收集需推送的模組檔案...');
    
    // 🌟 先傳送所有 routes 子模組，最後再傳送 server.js 觸發重啟！
    const filesToPush = [];

    const routesDir = path.join(__dirname, 'routes');
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs.readdirSync(routesDir);
      routeFiles.forEach(file => {
        if (file.endsWith('.js')) {
          filesToPush.push(path.join('routes', file));
        }
      });
    }

    // 將 server.js 放在最後一個傳送，避免中途重啟導致 502
    filesToPush.push('server.js');

    console.log(`📦 預計推送清單: ${filesToPush.join(', ')}`);

    for (const relativeFilePath of filesToPush) {
      await pushWithRetry(desktopUrl, relativeFilePath);
      // 每個檔案間隔 1 秒，保持通道穩定
      await sleep(1000);
    }

    console.log('✨ 所有檔案（含 routes 與 server.js）已成功全數推播至地端桌機！');
  } catch (err) {
    console.error('❌ 執行失敗:', err);
  }
}

main();