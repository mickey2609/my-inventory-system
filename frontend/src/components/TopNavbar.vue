<template>
  <header class="top-navbar">
    <div class="navbar-left">
      <div class="navbar-brand">
        <span class="brand-title">📦 庫存儲位系統</span>
        <span class="brand-version">{{ version }}</span>
      </div>

      <el-button type="primary" size="medium" icon="Menu" class="unified-menu-btn" @click="$emit('open-drawer')">
        ☰ 系統控制選單
      </el-button>

      <!-- 🔥 靠選單右側的動態頁籤按鈕列 -->
      <div class="active-tabs-bar" v-if="openedTabs && openedTabs.length > 0">
        <div 
          v-for="tabKey in openedTabs" 
          :key="tabKey"
          :class="['tab-btn-item', { active: currentTab === tabKey }]"
          @click="$emit('switch-tab', tabKey)"
        >
          <span class="tab-btn-text">{{ getTabName(tabKey) }}</span>
          <span 
            v-if="openedTabs.length > 1" 
            class="close-tab-icon" 
            @click.stop="$emit('close-tab', tabKey)"
            title="關閉頁籤"
          >✕</span>
        </div>
      </div>
    </div>

    <div class="top-right-actions">
      <el-button 
        type="success" 
        size="medium" 
        icon="Download"
        class="header-export-btn"
        v-if="showExportBtn"
        @click="$emit('export-excel')"
      >
        ↓ 匯出 Excel
      </el-button>
    </div>
  </header>
</template>

<script>
export default {
  name: 'TopNavbar',
  props: ['currentTab', 'openedTabs', 'showExportBtn'],
  emits: ['switch-tab', 'close-tab', 'export-excel', 'open-drawer'],
  data() {
    return {
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2026.08'
    }
  },
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
  height: 52px;
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
  position: relative;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  overflow-x: auto;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

.brand-version {
  font-size: 11px;
  color: #38bdf8;
  background: #0f172a;
  border: 1px solid #0284c7;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
  white-space: nowrap;
}

.unified-menu-btn {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  border: none !important;
  font-weight: bold !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  flex-shrink: 0;
}

/* 動態動態頁籤列 */
.active-tabs-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 10px;
}

.tab-btn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0f172a;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn-item:hover {
  background: #1e293b;
  color: #ffffff;
  border-color: #38bdf8;
}

.tab-btn-item.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #60a5fa;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

.close-tab-icon {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  padding: 1px 4px;
}

.close-tab-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.top-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.header-export-btn {
  font-weight: bold !important;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25);
}
</style>