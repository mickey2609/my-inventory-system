<template>
  <div class="dashboard-home">
    <div class="welcome-banner">
      <h2>👋 歡迎回來，{{ currentUser || '系統管理員' }}</h2>
      <p>當前地端 SQLite 資料庫即時運作狀態與數據概覽</p>
    </div>

    <!-- 數據指標卡片 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="card-icon">📦</div>
        <div class="card-info">
          <span class="card-title">總庫存明細筆數</span>
          <span class="card-value">{{ isServerOnline ? safeTotalRows.toLocaleString() : 0 }} <small>筆</small></span>
        </div>
      </div>

      <div class="metric-card">
        <div class="card-icon">🏢</div>
        <div class="card-info">
          <span class="card-title">涵蓋大區數量</span>
          <span class="card-value">{{ isServerOnline ? safeTotalCategories : 0 }} <small>個區域</small></span>
        </div>
      </div>

      <!-- 地端連線狀態與連線時數 -->
      <div class="metric-card">
        <div class="card-icon">⚡</div>
        <div class="card-info">
          <span class="card-title">地端 SQLite 引擎狀態</span>
          <span class="card-value" :class="isServerOnline ? 'status-online' : 'status-offline'">
            {{ isServerOnline ? '🟢 正常連線中' : '🔴 伺服器斷線' }}
          </span>
          <div v-if="isServerOnline" class="uptime-text">
            ⏱️ 伺服器已連續運作：{{ uptimeString }}
          </div>
        </div>
      </div>
    </div>

    <!-- 🚀 快捷功能選單 (無權限直接完全拔除，不留卡片) -->
    <div class="quick-actions-section" v-if="visibleModules.length > 0">
      <h3>🚀 快捷功能選單</h3>
      <div class="actions-grid">
        <div 
          v-for="mod in visibleModules" 
          :key="mod.key" 
          class="action-card" 
          @click="$emit('open-tab', mod.key)"
        >
          <div class="action-icon">{{ mod.icon }}</div>
          <div class="action-text">
            <h4>{{ mod.name }}</h4>
            <p>{{ mod.desc }}</p>
          </div>
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
    currentUser: String,
    currentUserPermissions: {
      type: [Array, String],
      default: () => []
    },
    isSysAdmin: {
      type: Boolean,
      default: false
    },
    dbMetrics: {
      type: Object,
      default: () => ({ totalRows: 0, totalCategories: 0 })
    }
  },
  emits: ['open-tab', 'logout-offline'],
  data() {
    return {
      isServerOnline: true,
      checkTimer: null,
      serverUptimeSec: 0,
      
      allModulesMaster: [
        { key: 'inv80', name: '庫存查詢 80', matchKeys: ['inv80', '庫存查詢80', '庫存查詢 80'], icon: '🔍', desc: '多條件搜尋商品 ID、儲位、大區小區與庫齡明細' },
        { key: 'loc_summary', name: '儲位數才數統整', matchKeys: ['loc_summary', '儲位數才數統整'], icon: '📊', desc: '自動計算各區域規劃才數、使用率與儲位健康度' },
        { key: 'inv15', name: '庫存查詢 15', matchKeys: ['inv15', '庫存查詢15', '庫存查詢 15'], icon: '⚡', desc: '極速檢索核心欄位與熱門品項即時庫存' },
        { key: 'turnover', name: '迴轉率清單', matchKeys: ['turnover', '迴轉率清單'], icon: '📈', desc: '分析高低迴轉品項與庫齡動態趨勢' },
        { key: 'abnormal_purchase', name: '不合理進貨清單', matchKeys: ['abnormal_purchase', '不合理進貨清單'], icon: '⚠️', desc: '自動稽核進貨異常、庫存過剩與超額預警' }
      ]
    }
  },
  computed: {
    safeTotalRows() {
      if (!this.dbMetrics) return 0;
      return this.dbMetrics.totalRows || this.dbMetrics.total_rows || 0;
    },
    safeTotalCategories() {
      if (!this.dbMetrics) return 0;
      return this.dbMetrics.totalCategories || this.dbMetrics.total_categories || 0;
    },
    // 🌟 核心剔除邏輯：只保留確定授權的模組，沒有權限的一律完全不渲染
    visibleModules() {
      // 只有最高管理員 sysAdmin 才放行全開
      if (this.isSysAdmin) {
        return this.allModulesMaster;
      }

      const rawPerms = this.currentUserPermissions;
      if (!rawPerms) return [];

      let userPermList = [];
      if (Array.isArray(rawPerms)) {
        userPermList = rawPerms.map(p => String(p).trim());
      } else if (typeof rawPerms === 'string') {
        if (rawPerms === 'all' || rawPerms === 'all,') return this.allModulesMaster;
        userPermList = rawPerms.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (userPermList.length === 0) return [];

      // 嚴格比對：模組的 matchKeys 必須有任何一個存在於使用者的權限清單中
      return this.allModulesMaster.filter(mod => {
        return mod.matchKeys.some(k => userPermList.includes(k));
      });
    },
    uptimeString() {
      const hrs = Math.floor(this.serverUptimeSec / 3600);
      const mins = Math.floor((this.serverUptimeSec % 3600) / 60);
      const secs = this.serverUptimeSec % 60;
      if (hrs > 0) return `${hrs} 小時 ${mins} 分 ${secs} 秒`;
      if (mins > 0) return `${mins} 分 ${secs} 秒`;
      return `${secs} 秒`;
    }
  },
  mounted() {
    this.checkServerStatus();
    this.checkTimer = setInterval(this.checkServerStatus, 3000);
  },
  beforeUnmount() {
    if (this.checkTimer) clearInterval(this.checkTimer);
  },
  methods: {
    async checkServerStatus() {
      try {
        const res = await axios.get('/api/get-global-config', { timeout: 3000 });
        if (res && res.status === 200 && res.data) {
          this.isServerOnline = true;
          const cfg = res.data.data || res.data.config || {};
          if (cfg.server_uptime_seconds !== undefined) {
            this.serverUptimeSec = cfg.server_uptime_seconds;
          }
        } else {
          this.handleOffline();
        }
      } catch (e) {
        this.handleOffline();
      }
    },
    handleOffline() {
      this.isServerOnline = false;
      this.serverUptimeSec = 0;
      this.$emit('logout-offline');
    }
  }
}
</script>

<style scoped>
.dashboard-home {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}
.welcome-banner { margin-bottom: 28px; }
.welcome-banner h2 { font-size: 1.8rem; margin: 0 0 8px 0; color: #38bdf8; }
.welcome-banner p { color: #94a3b8; margin: 0; }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 36px;
}
.metric-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.card-icon { font-size: 2.2rem; background: #0f172a; padding: 12px; border-radius: 10px; }
.card-info { display: flex; flex-direction: column; }
.card-title { font-size: 0.85rem; color: #94a3b8; margin-bottom: 4px; }
.card-value { font-size: 1.5rem; font-weight: bold; color: #f8fafc; }
.card-value small { font-size: 0.85rem; font-weight: normal; color: #64748b; }
.status-online { color: #4ade80; font-size: 1.1rem; }
.status-offline { color: #f87171; font-size: 1.1rem; }

.uptime-text {
  font-size: 0.8rem;
  color: #cbd5e1;
  margin-top: 6px;
  font-weight: bold;
}

.quick-actions-section h3 { font-size: 1.2rem; margin-bottom: 16px; color: #f8fafc; }
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.action-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-card:hover {
  border-color: #38bdf8;
  transform: translateY(-2px);
  background: #26334d;
  box-shadow: 0 8px 20px rgba(56, 189, 248, 0.15);
}
.action-icon { font-size: 2rem; background: #0f172a; padding: 10px; border-radius: 10px; }
.action-text h4 { margin: 0 0 6px 0; font-size: 1.05rem; color: #f8fafc; }
.action-text p { margin: 0; font-size: 0.85rem; color: #94a3b8; line-height: 1.4; }
</style>