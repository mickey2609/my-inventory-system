// frontend/src/main.js
import { createApp } from 'vue';
import ElementPlus, { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import axios from 'axios';
import App from './App.vue';

const BIN_ID = '6b06da24ac6210605aa35103';
const JSONBIN_KEY = '$2a$10$0nr9sKdkJWcR9BBU1l7dLO8DN1ET8JzYNWyAGYEH4VAI6e1Ov23Tm';

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

// 全站共用：點擊商品ID一鍵複製
app.config.globalProperties.$copySkuId = async function(skuId) {
  const cleanId = String(skuId || '').trim();
  if (!cleanId) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(cleanId);
    } else {
      const ta = document.createElement('textarea');
      ta.value = cleanId;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    ElMessage.success(`📋 已複製商品ID：${cleanId}`);
  } catch (e) {
    ElMessage.error('複製失敗，請手動選取複製');
  }
};

// 全站共用：點擊商品名稱開啟公司商品網頁（自動去除尾端 -000 規格碼）
app.config.globalProperties.$openProductWeb = function(skuId) {
  const cleanId = String(skuId || '').trim();
  if (!cleanId) return;
  const parts = cleanId.split('-');
  const prodId = parts.length >= 3 ? `${parts[0]}-${parts[1]}` : cleanId;
  const url = `https://24h.pchome.com.tw/prod/${encodeURIComponent(prodId)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

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