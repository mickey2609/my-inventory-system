<template>
  <div class="home-dashboard dark-bg">
    <div class="dashboard-header">
      <div class="welcome-text">
        <h2>👋 歡迎回來，{{ currentUser }}</h2>
        <p class="subtitle">庫存儲位管理系統控制台 | 地端高效能資料庫</p>
      </div>

      <!-- 跑馬燈公告欄 -->
      <div class="marquee-wrapper">
        <div class="marquee-badge">📢 系統公告</div>
        <div class="marquee-content-box">
          <div class="marquee-text">
            {{ announcementText || '🎉 歡迎使用庫存儲位管理系統！請確實核對進貨驗收與新品上架資料。' }}
          </div>
        </div>
        <button 
          v-if="isSysAdmin" 
          class="edit-announce-btn"
          @click="openAnnounceDialog"
          title="編輯公告"
        >
          ✏️ 編輯
        </button>
      </div>

      <!-- 🌟 右側區域：方案一（頂部狀態膠囊 + 懸浮/點擊卡片）與身分標籤 -->
      <div class="header-right-zone">
        <el-popover
          placement="bottom-end"
          :width="320"
          trigger="hover"
          popper-class="dark-popover"
        >
          <template #reference>
            <div class="sys-chip-container">
              <span class="sys-chip" :class="getChipClass(sysMetrics.cpu)">
                <span class="dot">●</span> CPU: {{ sysMetrics.cpu }}%
              </span>
              <span class="sys-chip" :class="getChipClass(sysMetrics.mem)">
                <span class="dot">●</span> RAM: {{ sysMetrics.mem }}%
              </span>
            </div>
          </template>

          <!-- 方案一懸浮卡片內容 -->
          <div class="popover-content">
            <div class="popover-title">🖥️ 地端伺服器即時負載</div>
            
            <div class="popover-row">
              <span class="label">⚡ CPU 使用率：</span>
              <span class="val" :class="getChipClass(sysMetrics.cpu)">{{ sysMetrics.cpu }}%</span>
            </div>
            <div class="popover-sub">{{ sysMetrics.cpuCores }} 核心 | {{ sysMetrics.cpuModel }}</div>

            <div class="popover-row" style="margin-top: 8px;">
              <span class="label">🧠 記憶體 (RAM)：</span>
              <span class="val" :class="getChipClass(sysMetrics.mem)">{{ sysMetrics.mem }}%</span>
            </div>
            <div class="popover-sub">{{ sysMetrics.memUsedGB }} GB / {{ sysMetrics.memTotalGB }} GB (可用 {{ (sysMetrics.memTotalGB - sysMetrics.memUsedGB).toFixed(1) }} GB)</div>

            <div class="popover-row" style="margin-top: 8px;">
              <span class="label">💾 C: 磁碟空間：</span>
              <span class="val text-blue">{{ sysMetrics.diskUsePercent }}%</span>
            </div>
            <div class="popover-sub">{{ sysMetrics.diskUsedGB }} GB / {{ sysMetrics.diskTotalGB }} GB</div>

            <div class="popover-divider"></div>
            <div class="popover-footer">
              <span>⏱️ 連續運行：<strong>{{ formatSysUptime(sysMetrics.uptimeSeconds) }}</strong></span>
              <el-button size="mini" type="primary" plain @click="fetchSystemMetrics">🔄 刷新</el-button>
            </div>
          </div>
        </el-popover>

        <div class="user-status-badge">
          <span class="badge-role">{{ isSysAdmin ? '系統管理員' : '一般使用者' }}</span>
        </div>
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

        <div v-if="hasPermission('inbound_fish')" class="action-card" @click="openTab('inbound_fish')">
          <div class="action-icon">🐟</div>
          <div class="action-title">進貨上架魚群</div>
          <div class="action-desc">驗收與新品上架時段魚群及未上架追蹤</div>
        </div>

        <div v-if="hasPermission('replenish_fish')" class="action-card" @click="openTab('replenish_fish')">
          <div class="action-icon">🐟</div>
          <div class="action-title">立即補貨單魚群</div>
          <div class="action-desc">立即補貨單未完成追蹤</div>
        </div>

        <div v-if="hasPermission('transfer_80_15')" class="action-card" @click="openTab('transfer_80_15')">
          <div class="action-icon">🔄</div>
          <div class="action-title">跨庫調撥 80 ➔ 15</div>
          <div class="action-desc">橘單新品上架魚群及未上架追蹤</div>
        </div>

        <div v-if="hasPermission('transfer_15_80')" class="action-card" @click="openTab('transfer_15_80')">
          <div class="action-icon">🔄</div>
          <div class="action-title">跨庫調撥 15 ➔ 80</div>
          <div class="action-desc">集貨調撥魚群及未完成追蹤</div>
        </div>

        <div v-if="hasPermission('item_sales_history')" class="action-card" @click="openTab('item_sales_history')">
          <div class="action-icon">📈</div>
          <div class="action-title">全商品歷史銷量履歷</div>
          <div class="action-desc">包含售罄商品、雙庫獨立庫存與最後驗收日期</div>
        </div>

        <div v-if="isSysAdmin" class="action-card" @click="openTab('settings_perm')">
          <div class="action-icon">⚙️</div>
          <div class="action-title">權限管理</div>
          <div class="action-desc">帳號新增、密碼重設與模組開放權限設定</div>
        </div>
      </div>
    </div>

    <!-- 編輯公告彈窗 Modal -->
    <el-dialog v-model="showAnnounceModal" title="✏️ 編輯系統跑馬燈公告" width="480px" append-to-body custom-class="dark-dialog">
      <el-form label-width="90px" size="small">
        <el-form-item label="公告事項：">
          <el-input 
            v-model="tempAnnouncement" 
            type="textarea" 
            :rows="3" 
            placeholder="請輸入跑馬燈公告內容 (例如：今日 17:00 進行庫房設備維護，請留意...)"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAnnounceModal = false">取消</el-button>
        <el-button type="primary" size="small" :loading="savingAnnounce" @click="saveAnnouncement">儲存並同步全體</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

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
      stats15: { total_rows: 0, file_name: '' },
      announcementText: '',
      showAnnounceModal: false,
      tempAnnouncement: '',
      savingAnnounce: false,

      // 方案一：硬體監控資料
      sysTimer: null,
      sysMetrics: {
        cpu: 0,
        mem: 0,
        memUsedGB: '0',
        memTotalGB: '0',
        diskUsedGB: '0',
        diskTotalGB: '0',
        diskUsePercent: 0,
        cpuModel: '系統 CPU',
        cpuCores: 4,
        uptimeSeconds: 0
      }
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
    this.fetchAnnouncement();
    this.fetchSystemMetrics();
    this.sysTimer = setInterval(this.fetchSystemMetrics, 10000);
  },
  beforeUnmount() {
    if (this.uptimeTimer) clearInterval(this.uptimeTimer);
    if (this.sysTimer) clearInterval(this.sysTimer);
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
    },
    async fetchAnnouncement() {
      try {
        const res = await axios.get('/api/announcement');
        if (res.data?.success) {
          this.announcementText = res.data.announcement;
        }
      } catch (e) {
        console.error('抓取公告失敗:', e.message);
      }
    },
    openAnnounceDialog() {
      this.tempAnnouncement = this.announcementText || '🎉 歡迎使用庫存儲位管理系統！請確實核對進貨驗收與新品上架資料。';
      this.showAnnounceModal = true;
    },
    async saveAnnouncement() {
      if (!this.tempAnnouncement.trim()) {
        return ElMessage.warning('公告內容不可為空！');
      }
      this.savingAnnounce = true;
      try {
        const res = await axios.post('/api/announcement', {
          announcement: this.tempAnnouncement.trim()
        });
        if (res.data?.success) {
          this.announcementText = this.tempAnnouncement.trim();
          ElMessage.success('🎉 跑馬燈公告已成功同步至全體使用者！');
          this.showAnnounceModal = false;
        }
      } catch (e) {
        ElMessage.error('儲存公告失敗：' + e.message);
      } finally {
        this.savingAnnounce = false;
      }
    },

    // 方案一：硬體監控 API 調用與格式化
    async fetchSystemMetrics() {
      try {
        const res = await axios.get('/api/system/metrics');
        if (res.data?.success && res.data.current) {
          this.sysMetrics = res.data.current;
        }
      } catch (e) {}
    },
    getChipClass(val) {
      if (val >= 85) return 'chip-danger';
      if (val >= 70) return 'chip-warning';
      return 'chip-normal';
    },
    formatSysUptime(sec) {
      if (!sec) return '0 分鐘';
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      let str = '';
      if (d > 0) str += `${d} 天 `;
      if (h > 0) str += `${h} 小時 `;
      str += `${m} 分鐘`;
      return str;
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
  gap: 16px;
  margin-bottom: 20px;
  background: #1e293b;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid #334155;
}

.welcome-text {
  flex-shrink: 0;
}

.welcome-text h2 {
  margin: 0;
  font-size: 18px;
  color: #f8fafc;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.marquee-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 20px;
  padding: 4px 12px;
  overflow: hidden;
  height: 36px;
  box-sizing: border-box;
  max-width: 50%;
}

.marquee-badge {
  background: #0284c7;
  color: #ffffff;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 10px;
  border-radius: 12px;
  white-space: nowrap;
  margin-right: 12px;
  flex-shrink: 0;
}

.marquee-content-box {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.marquee-text {
  display: inline-block;
  white-space: nowrap;
  font-size: 13px;
  color: #fef08a;
  font-weight: bold;
  padding-left: 100%;
  animation: marqueeAnimation 18s linear infinite;
}

.marquee-wrapper:hover .marquee-text {
  animation-play-state: paused;
}

@keyframes marqueeAnimation {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-100%, 0, 0); }
}

.edit-announce-btn {
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 12px;
  cursor: pointer;
  margin-left: 8px;
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
}

.edit-announce-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
}

/* 方案一：右側膠囊與身分標籤排列 */
.header-right-zone {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.sys-chip-container {
  display: flex;
  gap: 6px;
  cursor: pointer;
  align-items: center;
  user-select: none;
}
.sys-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.sys-chip:hover {
  transform: translateY(-1px);
  filter: brightness(1.2);
}
.dot { font-size: 9px; }
.chip-normal {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.35);
}
.chip-warning {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.4);
}
.chip-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
}

.user-status-badge { flex-shrink: 0; }
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

<!-- 方案一：Popover 懸浮卡樣式 -->
<style>
.dark-popover.el-popper {
  background: #1e293b !important;
  border: 1px solid #334155 !important;
  color: #f8fafc !important;
  border-radius: 8px !important;
  padding: 14px 16px !important;
}
.dark-popover .el-popper__arrow::before {
  background: #1e293b !important;
  border-color: #334155 !important;
}
.popover-title {
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 10px;
}
.popover-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.popover-row .label {
  color: #cbd5e1;
}
.popover-row .val {
  font-weight: bold;
}
.popover-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.popover-divider {
  height: 1px;
  background: #334155;
  margin: 10px 0;
}
.popover-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
}
</style>