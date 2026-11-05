// push_to_desktop.js
const https = require('https');
const http = require('http');
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
    const client = urlObj.protocol === 'https:' ? https : http;
    const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);

    const postData = JSON.stringify({
      filename: relativeFilePath.replace(/\\/g, '/'),
      code: fileContent
    });

    const options = {
      hostname: urlObj.hostname,
      port: port,
      path: '/api/system/update-server-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = client.request(options, (res) => {
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

// 🌟 發送強制重啟伺服器訊號
function triggerServerRestart(desktopUrl) {
  return new Promise((resolve) => {
    console.log('🔄 正在通知地端伺服器 (Port 3001/3000) 重載並重啟服務...');
    const urlObj = new URL(desktopUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);

    const postData = JSON.stringify({
      action: 'restart',
      target: 'server.js'
    });

    const options = {
      hostname: urlObj.hostname,
      port: port,
      path: '/api/system/update-server-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = client.request(options, (res) => {
      console.log(`⚡ 地端重啟命令已回應 (HTTP ${res.statusCode})`);
      resolve();
    });

    req.on('error', (err) => {
      // 重啟時通常伺服器程序會直接退出造成中斷，這屬於正常現象
      console.log(`ℹ️ 重啟訊號已送達（連線已由地端伺服器重啟關閉: ${err.message || '連線重置'}）`);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('ℹ️ 重啟請求超時，服務正在背景重新啟動中...');
      resolve();
    });

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
    
    const filesToPush = [];

    // 1. 收集 routes/ 下的所有檔案
    const routesDir = path.join(__dirname, 'routes');
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs.readdirSync(routesDir);
      routeFiles.forEach(file => {
        if (file.endsWith('.js')) {
          filesToPush.push(path.join('routes', file));
        }
      });
    }

    // 2. 將 server.js 放在檔案推送清單的最後，確保所有路由模組都到位
    filesToPush.push('server.js');

    console.log(`📦 預計推送清單 (${filesToPush.length} 檔案): ${filesToPush.join(', ')}`);

    for (const relativeFilePath of filesToPush) {
      await pushWithRetry(desktopUrl, relativeFilePath);
      await sleep(800);
    }

    console.log('✨ 所有檔案（含 routes 與 server.js）已成功全數推播至地端桌機！');

    // 3. 🌟 主動發送重啟觸發指令
    await sleep(1500);
    await triggerServerRestart(desktopUrl);

    console.log('🎉 全部同步與遠端重啟流程執行完畢！約 3~5 秒後地端服務即完成熱載入。');
  } catch (err) {
    console.error('❌ 執行失敗:', err);
  }
}

main();