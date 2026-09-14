// deploy_server.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 桌機地端伺服器網址 (可以填 Cloudflare Tunnel 網址或地端 IP)
const SERVER_URL = 'http://localhost:3000'; // 或你的網頁 API 網址

async function deployBackend() {
  try {
    console.log('📦 正在讀取筆電本地最新的 server.js...');
    const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    console.log('🚀 正在推送至桌機地端伺服器...');
    const res = await axios.post(`${SERVER_URL}/api/system/update-server-code`, {
      code: serverCode
    });

    if (res.data?.success) {
      console.log('✨ Success:', res.data.message);
    } else {
      console.error('❌ Failed:', res.data?.message);
    }
  } catch (err) {
    console.error('⚠️ 連線或推送失敗:', err.response?.data?.error || err.message);
  }
}

deployBackend();