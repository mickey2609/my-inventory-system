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

    <!-- 數據指標卡片區 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="card-icon blue-bg">📦</div>
        <div class="card-info">
          <span class="card-title">80庫 庫存明細筆數</span>
          <div class="card-value-group">
            <span class="card-value text-blue">{{ formatNumber(dbMetrics.totalRows80) }}</span>
            <span class="card-unit">筆</span>
          </div>
          <span v-if="stats80.file_name" class="file-name-tag">
            📁 匯入檔名：{{ stats80.file_name }}
          </span>
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
          <span v-if="stats15.file_name" class="file-name-tag">
            📁 匯入檔名：{{ stats15.file_name }}
          </span>
        </div>
      </div>

      <div class="metric-card">
        <div class="card-icon orange-bg">⏱️</div>
        <div class="card-info">
          <span class="card-title">伺服器連續運作時間</span>
          <div class="card-value-group">
            <span class="card-value text-orange">{{ serverUptimeStr }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷功能入口區 (權限過濾 v-if) -->
    <div class="quick-actions-panel">
      <h3 class="panel-title">⚡ 系統功能快捷入口</h3>
      <div class="actions-grid">
        <div v-if="hasPermission('inv80')" class="action-card" @click="openTab('inv80')">
          <div class="action-icon">🔍</div>
          <div class="action-title">庫存查詢 80</div>
          <div class="action-desc">人工倉</div>
        </div>

        <div v-if="hasPermission('inv15')" class="action-card" @click="openTab('inv15')">
          <div class="action-icon">📦</div>
          <div class="action-title">庫存查詢 15</div>
          <div class="action-desc">自動化倉</div>
        </div>

        <div v-if="hasPermission('loc_summary')" class="action-card" @click="openTab('loc_summary')">
          <div class="action-icon">📊</div>
          <div class="action-title">儲位數才數統整 80</div>
          <div class="action-desc">各樓層儲位類型統計</div>
        </div>

        <div v-if="hasPermission('turnover')" class="action-card" @click="openTab('turnover')">
          <div class="action-icon">📈</div>
          <div class="action-title">迴轉率清單</div>
          <div class="action-desc">品項動態迴轉天數與庫存週轉率分析</div>
        </div>

        <div v-if="hasPermission('abnormal_purchase')" class="action-card" @click="openTab('abnormal_purchase')">
          <div class="action-icon">⚠️</div>
          <div class="action-title">不合理進貨清單</div>
          <div class="action-desc">進貨材積、滯銷評估與庫齡預警分析</div>
        </div>

        <!-- 🌟 4 個全新魚群與調撥模組小卡片 (使用漂亮箭頭 ➔) -->
        <div v-if="hasPermission('inbound_fish')" class="action-card" @click="openTab('inbound_fish')">
          <div class="action-icon">🐟</div>
          <div class="action-title">進貨上架魚群</div>
          <div class="action-desc">驗收與新品上架時段魚群及未上架追蹤</div>
        </div>

        <div v-if="hasPermission('replenish_fish')" class="action-card" @click="openTab('replenish_fish')">
          <div class="action-icon">🐟</div>
          <div class="action-title">立即補貨單魚群</div>
          <div class="action-desc">動態儲位補貨水位建議與補貨單產生</div>
        </div>

        <div v-if="hasPermission('transfer_80_15')" class="action-card" @click="openTab('transfer_80_15')">
          <div class="action-icon">🔄</div>
          <div class="action-title">跨庫調撥 80 ➔ 15</div>
          <div class="action-desc">人工倉調撥至自動化倉高周轉品建議</div>
        </div>

        <div v-if="hasPermission('transfer_15_80')" class="action-card" @click="openTab('transfer_15_80')">
          <div class="action-icon">🔄</div>
          <div class="action-title">跨庫調撥 15 ➔ 80</div>
          <div class="action-desc">自動倉調撥至人工倉慢周轉與大批品建議</div>
        </div>

        <div v-if="isSysAdmin" class="action-card" @click="openTab('settings_perm')">
          <div class="action-icon">⚙️</div>
          <div class="action-title">權限管理</div>
          <div class="action-desc">帳號新增、密碼重設與模組開放權限設定</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'HomeDashboard',
  props: {
    currentUser: { type: String, default: '' },
    currentUserPermissions: { type: [Array, String], default: 'all' },
    isSysAdmin: { type: Boolean, default: false },
    dbMetrics: {
      type: Object,
      default: () => ({ totalRows80: 0, totalRows15: 0, serverUptimeSec: 0 })
    }
  },
  data() {
    return {
      localUptimeSec: 0,
      uptimeTimer: null,
      stats80: { total_rows: 0, file_name: '' },
      stats15: { total_rows: 0, file_name: '' }
    }
  },
  computed: {
    serverUptimeStr() {
      const totalSec = this.localUptimeSec || this.dbMetrics.serverUptimeSec || 0;
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      let result = '';
      if (days > 0) result += `${days}天 `;
      result += `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return result;
    }
  },
  watch: {
    'dbMetrics.serverUptimeSec': {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.localUptimeSec = newVal;
          this.startUptimeTimer();
        }
      }
    },
    'dbMetrics.totalRows80'() {
      this.fetchStats();
    }
  },
  mounted() {
    this.localUptimeSec = this.dbMetrics.serverUptimeSec || 0;
    this.startUptimeTimer();
    this.fetchStats();
  },
  beforeUnmount() {
    if (this.uptimeTimer) clearInterval(this.uptimeTimer);
  },
  methods: {
    openTab(tabKey) {
      this.$emit('open-tab', tabKey);
    },
    formatNumber(val) {
      if (!val) return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    hasPermission(tabKey) {
      if (this.isSysAdmin) return true;
      const perms = this.currentUserPermissions;
      if (!perms || perms === 'all' || perms === 'all,') return true;
      if (Array.isArray(perms)) return perms.includes(tabKey);
      if (typeof perms === 'string') return perms.split(',').map(s => s.trim()).includes(tabKey);
      return false;
    },
    startUptimeTimer() {
      if (this.uptimeTimer) clearInterval(this.uptimeTimer);
      this.uptimeTimer = setInterval(() => {
        this.localUptimeSec += 1;
      }, 1000);
    },
    async fetchStats() {
      try {
        const res = await axios.get('/api/dashboard/stats');
        if (res.data?.success) {
          this.stats80 = res.data.stats80 || { total_rows: 0, file_name: '' };
          this.stats15 = res.data.stats15 || { total_rows: 0, file_name: '' };
        }
      } catch (e) {
        console.error('抓取首頁統計失敗:', e.message);
      }
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
  grid-template-columns: repeat(3, 1fr);
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
.orange-bg { background: rgba(251, 191, 36, 0.15); }

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
  font-size: 22px;
  font-weight: bold;
}

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }

.card-unit {
  font-size: 12px;
  color: #64748b;
}

.file-name-tag {
  font-size: 11px;
  color: #f59e0b;
  margin-top: 4px;
  font-weight: 500;
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

@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: repeat(1, 1fr);
  }
}
</style>