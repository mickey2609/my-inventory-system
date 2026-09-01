<template>
  <header class="top-navbar">
    <div class="brand-section">
      <span class="logo">📦</span>
      <span class="title">庫存儲位系統</span>
      <!-- 動態帶入當前編譯時間版號 -->
      <span class="version-tag">{{ appVersion }}</span>
    </div>

    <!-- 中間頁籤切換區 -->
    <div class="tabs-container">
      <div 
        v-for="tab in openedTabs" 
        :key="tab"
        class="tab-item"
        :class="{ active: currentTab === tab }"
        @click="$emit('switch-tab', tab)"
      >
        <span class="tab-name">{{ getTabName(tab) }}</span>
        <span 
          v-if="openedTabs.length > 1" 
          class="close-tab-btn" 
          @click.stop="$emit('close-tab', tab)"
        >✕</span>
      </div>
    </div>

    <!-- 右側選單與功能按鈕 -->
    <div class="actions-section">
      <button class="nav-btn menu-btn" @click="$emit('open-drawer')">
        <span>☰</span> 系統控制選單
      </button>

      <button 
        v-if="showExportBtn" 
        class="nav-btn export-btn" 
        @click="$emit('export-excel')"
      >
        📊 匯出美化 Excel
      </button>
    </div>
  </header>
</template>

<script>
export default {
  name: 'TopNavbar',
  props: {
    // 接收來自 App.vue 的動態編譯版號
    appVersion: {
      type: String,
      default: 'v2026.09.01'
    },
    currentTab: {
      type: String,
      default: 'inv80'
    },
    openedTabs: {
      type: Array,
      default: () => ['inv80']
    },
    showExportBtn: {
      type: Boolean,
      default: false
    }
  },
  emits: ['switch-tab', 'close-tab', 'open-drawer', 'export-excel'],
  methods: {
    getTabName(tabKey) {
      const names = {
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'loc_summary': '儲位數才數統整',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單',
        'settings_perm': '權限管理',
        'settings_log': '日誌歷程查詢'
      };
      return names[tabKey] || '系統模組';
    }
  }
}
</script>

<style scoped>
.top-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  user-select: none;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  font-size: 1.2rem;
}

.title {
  font-weight: 700;
  font-size: 1rem;
  color: #f8fafc;
}

.version-tag {
  background-color: #0284c7;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid #38bdf8;
  margin-left: 4px;
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  max-width: 50vw;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: #0f172a;
  color: #94a3b8;
  border-radius: 6px 6px 0 0;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.tab-item:hover {
  color: #f8fafc;
  background-color: #334155;
}

.tab-item.active {
  color: #38bdf8;
  background-color: #1e293b;
  border-color: #334155;
  border-bottom-color: #1e293b;
  font-weight: bold;
}

.close-tab-btn {
  font-size: 0.75rem;
  border-radius: 50%;
  padding: 0 4px;
}

.close-tab-btn:hover {
  background-color: #ef4444;
  color: #ffffff;
}

.actions-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.nav-btn:hover {
  opacity: 0.9;
}

.menu-btn {
  background-color: #2563eb;
  color: #ffffff;
}

.export-btn {
  background-color: #059669;
  color: #ffffff;
}
</style>