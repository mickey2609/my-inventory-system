// push_to_desktop.js
const https = require('https');
const fs = require('fs');
const path = require('path');

// 🌟 已保留你的 JSONBin 憑證
const BIN_ID = '6aad2ed2ac6210605adc4575'; 
const JSONBIN_KEY = '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm'; 

function getTunnelUrlFromBin() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.jsonbin.io',
      port: 443,
      path: `/v3/b/${BIN_ID}/latest`,
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          if (json.record && json.record.url) {
            resolve(json.record.url.trim());
          } else {
            reject('Bin 內容無網址');
          }
        } else {
          reject(`抓取網址失敗 (Status: ${res.statusCode})`);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function pushSingleFileToDesktop(desktopUrl, relativeFilePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, relativeFilePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ 檔案不存在，跳過推送：${relativeFilePath}`);
      return resolve();
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const urlObj = new URL(desktopUrl);

    // 🌟 打對地端 Port 3001 轉發接收端點，並夾帶檔名與程式碼內容
    const postData = JSON.stringify({
      filename: relativeFilePath,
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

async function main() {
  try {
    console.log('🔍 正在從 JSONBin 讀取桌機最新網址...');
    const desktopUrl = await getTunnelUrlFromBin();
    console.log(`🔗 成功取得桌機網址：${desktopUrl}`);

    console.log('🚀 開始推送程式碼至桌機...');
    
    // 🌟 1. 推送後端關鍵模組：routes/inventory15.js
    await pushSingleFileToDesktop(desktopUrl, path.join('routes', 'inventory15.js'));

    // 🌟 2. 推送主要 API 伺服器：server.js
    await pushSingleFileToDesktop(desktopUrl, 'server.js');

    console.log('✨ 所有檔案已全部推播至地端桌機！');
  } catch (err) {
    console.error('❌ 執行失敗:', err);
  }
}

main();