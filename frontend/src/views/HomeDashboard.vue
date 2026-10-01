<template>
  <div class="home-dashboard dark-bg">
    <div class="dashboard-header">
      <div class="welcome-text">
        <h2>👋 歡迎回來，{{ currentUser }}</h2>
        <p class="subtitle">庫存儲位管理系統控制台 | 地端高效能資料庫</p>
      </div>
      <div class="user-status-badge">
        <span class="badge-role">{{ isSysAdmin ? '系統管理員' : '一般使用者' }}</span>
      </div>
    </div>

    <!-- 數據指標卡片區 (呈現 80庫 與 15庫 筆數) -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="card-icon blue-bg">📦</div>
        <div class="card-info">
          <span class="card-title">80庫 庫存明細筆數</span>
          <div class="card-value-group">
            <span class="card-value text-blue">{{ formatNumber(dbMetrics.totalRows80) }}</span>
            <span class="card-unit">筆</span>
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="card-icon green-bg">📦</div>
        <div class="card-info">
          <span class="card-title">15庫 庫存明細筆數</span>
          <div class="card-value-group">
            <span class="card-value text-green">{{ formatNumber(dbMetrics.totalRows15) }}</span>
            <span class="card-unit">筆</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷功能區 -->
    <div class="quick-actions-panel">
      <h3 class="panel-title">⚡ 系統功能快捷入口</h3>
      <div class="actions-grid">
        <div class="action-card" @click="$emit('open-tab', 'inv80')">
          <div class="action-icon">🔍</div>
          <div class="action-title">庫存查詢 80</div>
          <div class="action-desc">48 欄位極速搜尋、多區批次查詢與匯出</div>
        </div>

        <div class="action-card" @click="$emit('open-tab', 'inv15')">
          <div class="action-icon">📦</div>
          <div class="action-title">庫存查詢 15</div>
          <div class="action-desc">處理 30~40 萬筆大數據 latest_inventory15.csv</div>
        </div>

        <div class="action-card" @click="$emit('open-tab', 'loc_summary')">
          <div class="action-icon">📊</div>
          <div class="action-title">儲位數才數統整</div>
          <div class="action-desc">A/B/C/D 區與樓層型態跨區交叉矩陣統計</div>
        </div>

        <div class="action-card" v-if="isSysAdmin" @click="$emit('open-tab', 'settings_perm')">
          <div class="action-icon">⚙️</div>
          <div class="action-title">權限管理</div>
          <div class="action-desc">帳號新增、密碼重設與模組開放權限設定</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeDashboard',
  props: {
    currentUser: { type: String, default: '' },
    isSysAdmin: { type: Boolean, default: false },
    dbMetrics: {
      type: Object,
      default: () => ({ totalRows80: 0, totalRows15: 0 })
    }
  },
  methods: {
    formatNumber(val) {
      if (!val) return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    }
  }
}
</script>

<style scoped>
.home-dashboard {
  padding: 20px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.welcome-text h2 {
  margin: 0;
  font-size: 20px;
  color: #f8fafc;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.badge-role {
  background: #334155;
  color: #38bdf8;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.blue-bg { background: rgba(56, 189, 248, 0.15); }
.green-bg { background: rgba(74, 222, 128, 0.15); }

.card-info {
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.card-value-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
}

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }

.card-unit {
  font-size: 12px;
  color: #64748b;
}

.quick-actions-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 18px 20px;
}

.panel-title {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: #38bdf8;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.action-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  border-color: #38bdf8;
  transform: translateY(-2px);
}

.action-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.action-title {
  font-size: 14px;
  font-weight: bold;
  color: #f8fafc;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}
</style>