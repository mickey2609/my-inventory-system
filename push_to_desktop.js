// push_to_desktop.js
// 自動掃描 server.js 與 routes 資料夾下所有檔案，同步推送至地端桌機
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const JSONBIN_BIN_ID = '66ee3b1be41015cd7f511c53';
const JSONBIN_API_KEY = '$2a$10$wT8KjTz6S6JjN0U6sR/c3.l3/7gRk6J2Y8zJk7g.hN7sN7N7N7N7N'; // 請維持您原本的 Key

function getDesktopUrl() {
  return new Promise((resolve, reject) => {
    console.log('🔍 正在從 JSONBin 讀取桌機最新網址...');
    const req = https.get(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.record && json.record.desktop_tunnel) {
            console.log('🔗 成功取得桌機網址 :', json.record.desktop_tunnel);
            resolve(json.record.desktop_tunnel);
          } else {
            reject(new Error('JSONBin 中未找到 desktop_tunnel 欄位'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function pushSingleFile(desktopUrl, relativePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, relativePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ 檔案不存在，跳過推播: ${relativePath}`);
      return resolve();
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const payload = JSON.stringify({ filePath: relativePath, code: fileContent });
    
    const targetUrl = new URL('/api/system/update-server-code', desktopUrl);
    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`🎉 成功更新 ${relativePath} 至地端桌機！`);
          resolve();
        } else {
          reject(new Error(`更新 ${relativePath} 失敗 (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    const desktopUrl = await getDesktopUrl();
    console.log('🚀 開始推送程式碼至桌機...');

    // 1. 自動蒐集待推送檔案清單
    const filesToPush = ['server.js'];

    // 2. 自動掃描 routes 資料夾下的所有 .js 檔案
    const routesDir = path.join(__dirname, 'routes');
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs.readdirSync(routesDir);
      routeFiles.forEach(file => {
        if (file.endsWith('.js')) {
          filesToPush.push(path.join('routes', file));
        }
      });
    }

    // 3. 逐一推播
    for (const file of filesToPush) {
      await pushSingleFile(desktopUrl, file);
    }

    console.log('✨ 所有檔案（含 routes 資料夾全模組）已全部推播至地端桌機！');
  } catch (err) {
    console.error('❌ 執行失敗:', err.message);
  }
}

main();