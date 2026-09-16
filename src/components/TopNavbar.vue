<template>
  <div class="top-navbar">
    <div class="nav-left">
      <div class="app-logo">📦</div>
      <h1 class="app-title">庫存儲位管理系統</h1>
      <span class="version-tag">{{ appVersion }}</span>

      <!-- 🌟【新增】歡迎登入使用者標示區塊 -->
      <div v-if="currentUser" class="user-welcome-tag">
        👋 <span class="user-name">{{ currentUser }}</span>，歡迎登入
      </div>
    </div>

    <!-- 中間頁籤列 -->
    <div class="nav-center">
      <div 
        v-for="tab in openedTabs" 
        :key="tab"
        class="tab-item"
        :class="{ 'is-active': currentTab === tab }"
        @click="$emit('switch-tab', tab)"
      >
        <span class="tab-name">{{ getTabName(tab) }}</span>
        <span v-if="tab !== 'home'" class="close-btn" @click.stop="$emit('close-tab', tab)">×</span>
      </div>
    </div>

    <!-- 右側功能按鈕列 -->
    <div class="nav-right">
      <el-button 
        v-if="showExportBtn"
        type="success" 
        size="mini" 
        class="export-btn"
        @click="$emit('export-excel')"
      >
        📊 匯出總表 Excel
      </el-button>

      <el-button 
        type="primary" 
        size="mini" 
        class="drawer-btn"
        @click="$emit('open-drawer')"
      >
        ☰ 系統控制選單
      </el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TopNavbar',
  props: {
    currentTab: String,
    openedTabs: {
      type: Array,
      default: () => []
    },
    appVersion: String,
    showExportBtn: Boolean,
    currentUser: String // 🌟 接收當前登入使用者名稱
  },
  methods: {
    getTabName(k) {
      const names = {
        'home': '🏠 系統首頁',
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'loc_summary': '儲位數才數統整',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單',
        'settings_perm': '權限管理',
        'settings_log': '日誌歷程查詢'
      };
      return names[k] || '系統模組';
    }
  }
}
</script>

<style scoped>
.top-navbar {
  height: 52px;
  background-color: #0f172a;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-sizing: border-box;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-logo {
  font-size: 20px;
}

.app-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
}

.version-tag {
  background-color: #0284c7;
  color: #ffffff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

/* 🌟 歡迎標籤樣式 */
.user-welcome-tag {
  margin-left: 8px;
  padding: 3px 10px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid #334155;
  border-radius: 20px;
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-welcome-tag .user-name {
  color: #38bdf8;
  font-weight: bold;
}

.nav-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 20px;
  overflow-x: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-item:hover {
  border-color: #38bdf8;
  color: #ffffff;
}

.tab-item.is-active {
  background-color: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  font-weight: bold;
}

.close-btn {
  font-size: 14px;
  color: #94a3b8;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-btn {
  background-color: #2563eb !important;
  border-color: #1d4ed8 !important;
  font-weight: bold;
}

.export-btn {
  background-color: #059669 !important;
  border-color: #047857 !important;
  font-weight: bold;
}
</style>