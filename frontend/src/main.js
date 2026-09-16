import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import axios from 'axios'; // 引入 axios 用於設定全域 API 基礎網址
import App from './App.vue';

// -------------------------------------------------------------
// 1. 設定全域 Axios API 基礎網址 (連接桌機 Cloudflare Tunnel)
// -------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
if (API_BASE) {
  axios.defaults.baseURL = API_BASE;
}

const app = createApp(App);

// 2. 自動註冊所有 Element Plus 圖示
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.mount('#app');

// -------------------------------------------------------------
// 3. 本機環境自動標記 (測) 腳本（強效定時與監聽版）
// -------------------------------------------------------------
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (isLocal) {
  const applyTestTitle = () => {
    if (!document.title.includes('(測)')) {
      document.title = document.title ? `${document.title} (測)` : '庫存儲位管理系統 (測)';
    }
  };

  // 每 0.5 秒定期檢查並補上 (測)
  setInterval(applyTestTitle, 500);

  // 監聽整個 HTML <head> 確保任何改變都能抓到
  const observer = new MutationObserver(applyTestTitle);
  observer.observe(document.head, { subtree: true, characterData: true, childList: true });
}