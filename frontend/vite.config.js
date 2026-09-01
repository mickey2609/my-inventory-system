import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 取得自動編譯時的時間 (格式如: 2026.09.01.2240)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const date = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const buildVersion = `v${year}.${month}.${date}.${hours}${minutes}`;

export default defineConfig({
  plugins: [vue()],
  define: {
    // 定義全域變數 __APP_VERSION__ 給 Vue 畫面調用
    __APP_VERSION__: JSON.stringify(buildVersion)
  }
})