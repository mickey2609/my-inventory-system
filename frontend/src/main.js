// frontend/src/main.js
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import axios from 'axios';
import App from './App.vue';

const BIN_ID = '6aad2ed2ac6210605adc4575';
const JSONBIN_KEY = '$2a$10$GBayhoY0k2Exom4NkRzydu3CEcLJj1vior2Yld0PPsPDHsjDJG0wm';

async function initDesktopApiBase() {
  try {
    const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    if (res.data && res.data.record && res.data.record.url) {
      const desktopUrl = res.data.record.url.trim();
      axios.defaults.baseURL = desktopUrl;
      console.log('✅ 前端已成功直連桌機 API：', desktopUrl);
    }
  } catch (err) {
    console.error('❌ 讀取桌機網址失敗，採用預設環境變數:', err);
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    if (API_BASE) axios.defaults.baseURL = API_BASE;
  }
}

initDesktopApiBase();

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.mount('#app');

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (isLocal) {
  const applyTestTitle = () => {
    if (!document.title.includes('(測)')) {
      document.title = document.title ? `${document.title} (測)` : '庫存儲位管理系統 (測)';
    }
  };

  setInterval(applyTestTitle, 500);
  const observer = new MutationObserver(applyTestTitle);
  observer.observe(document.head, { subtree: true, characterData: true, childList: true });
}