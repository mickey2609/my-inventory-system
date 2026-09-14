const fs = require('fs');
const path = require('path');
const https = require('https');

// 🌟 永久固定的入口網址（一勞永逸，這輩子都不需要再更動！）
const TARGET_HOST = 'my-inventory-system.pages.dev';

function deployBackendCode() {
  try {
    console.log('📦 正在讀取筆電端最新的 server.js 內容...');
    const serverFilePath = path.join(__dirname, 'server.js');
    
    if (!fs.existsSync(serverFilePath)) {
      console.error('❌ 錯誤：筆電專案目錄下找不到 server.js 檔案！');
      return;
    }

    const latestCode = fs.readFileSync(serverFilePath, 'utf8');
    const postData = JSON.stringify({ code: latestCode });

    const options = {
      hostname: TARGET_HOST,
      port: 443,
      path: '/deploy-backend', // 自動代理路由
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Target-Local': 'true' // 告訴 Pages Functions 此請求需自動轉發給桌機
      }
    };

    console.log('🚀 正在透過 Cloudflare Pages 轉發推送最新 server.js 至桌機...');

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.success) {
            console.log('✨ 部署成功:', parsed.message);
          } else {
            console.error('❌ 推送失敗:', parsed.message);
          }
        } catch (e) {
          console.log('伺服器回應:', body);
        }
      });
    });

    req.on('error', (e) => {
      console.error('⚠️ 連線失敗 (請確認桌機 start_tunnel.bat 與 server.js 是否啟動):', e.message);
    });

    req.write(postData);
    req.end();
  } catch (err) {
    console.error('⚠️ 執行失敗:', err.message);
  }
}

deployBackendCode();