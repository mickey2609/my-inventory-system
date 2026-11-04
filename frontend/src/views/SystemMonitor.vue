<template>
  <div class="system-monitor-wrapper">
    <!-- 頂部常駐微型膠囊 -->
    <div class="sys-chip-container" @click="openModal" title="點擊檢視地端伺服器詳細效能儀表板">
      <span class="sys-chip" :class="getChipClass(metrics.cpu)">
        <span class="dot">●</span> CPU: {{ metrics.cpu }}%
      </span>
      <span class="sys-chip" :class="getChipClass(metrics.mem)">
        <span class="dot">●</span> RAM: {{ metrics.mem }}%
      </span>
    </div>

    <!-- 效能監控彈窗 -->
    <el-dialog
      v-model="showModal"
      title="🖥️ 地端伺服器硬體效能監控儀表板"
      width="820px"
      append-to-body
      custom-class="dark-dialog sys-monitor-dialog"
    >
      <div class="sys-dialog-content" v-loading="loading">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="card-title">⚡ CPU 即時負載</div>
            <div class="gauge-box">
              <el-progress
                type="dashboard"
                :percentage="metrics.cpu"
                :color="progressColors"
                :width="125"
                :stroke-width="10"
              />
            </div>
            <div class="card-detail">
              <span class="highlight">{{ metrics.cpuCores }} 核心</span>
              <span class="sub-text">{{ metrics.cpuModel }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-title">🧠 記憶體 (RAM) 使用率</div>
            <div class="gauge-box">
              <el-progress
                type="dashboard"
                :percentage="metrics.mem"
                :color="progressColors"
                :width="125"
                :stroke-width="10"
              />
            </div>
            <div class="card-detail">
              <span class="highlight">{{ metrics.memUsedGB }} GB / {{ metrics.memTotalGB }} GB</span>
              <span class="sub-text">可用餘裕: {{ (metrics.memTotalGB - metrics.memUsedGB).toFixed(1) }} GB</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-title">💾 系統磁碟 (C:) 空間</div>
            <div class="gauge-box">
              <el-progress
                type="dashboard"
                :percentage="metrics.diskUsePercent"
                :color="progressColors"
                :width="125"
                :stroke-width="10"
              />
            </div>
            <div class="card-detail">
              <span class="highlight">{{ metrics.diskUsedGB }} GB / {{ metrics.diskTotalGB }} GB</span>
              <span class="sub-text">剩餘空間: {{ (metrics.diskTotalGB - metrics.diskUsedGB).toFixed(1) }} GB</span>
            </div>
          </div>
        </div>

        <div class="history-chart-card">
          <div class="chart-header">
            <span class="chart-title">📈 歷史效能趨勢 (最近 15 分鐘，每 10 秒取樣)</span>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-color legend-cpu"></span> CPU 使用率</span>
              <span class="legend-item"><span class="legend-color legend-mem"></span> RAM 記憶體</span>
            </div>
          </div>

          <div class="svg-container">
            <svg viewBox="0 0 740 140" class="trend-svg" preserveAspectRatio="none">
              <line x1="0" y1="35" x2="740" y2="35" stroke="#334155" stroke-dasharray="4" />
              <line x1="0" y1="70" x2="740" y2="70" stroke="#334155" stroke-dasharray="4" />
              <line x1="0" y1="105" x2="740" y2="105" stroke="#334155" stroke-dasharray="4" />

              <polyline :points="ramPoints" fill="none" stroke="#f59e0b" stroke-width="2" />
              <polyline :points="cpuPoints" fill="none" stroke="#38bdf8" stroke-width="2" />
            </svg>
            <div class="chart-y-axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
        </div>

        <div class="sys-footer-bar">
          <div class="uptime-info">
            ⏱️ 伺服器連續運行：<strong>{{ formatUptime(metrics.uptimeSeconds) }}</strong>
          </div>
          <div class="status-tip">
            ⚡ 自動監測中 (每 10 秒輪詢)
            <el-button size="mini" type="primary" plain @click="fetchMetrics" style="margin-left: 10px;">
              🔄 即時更新
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'SystemMonitor',
  data() {
    return {
      showModal: false,
      loading: false,
      pollTimer: null,
      metrics: {
        cpu: 0,
        mem: 0,
        memUsedGB: '0',
        memTotalGB: '0',
        diskUsedGB: '0',
        diskTotalGB: '0',
        diskUsePercent: 0,
        cpuModel: 'Intel/AMD Processor',
        cpuCores: 4,
        uptimeSeconds: 0
      },
      historyList: [],
      progressColors: [
        { color: '#22c55e', percentage: 60 },
        { color: '#eab308', percentage: 80 },
        { color: '#ef4444', percentage: 100 }
      ]
    };
  },
  computed: {
    cpuPoints() {
      if (!this.historyList.length) return '';
      const w = 740;
      const h = 130;
      const count = this.historyList.length;
      return this.historyList.map((item, idx) => {
        const x = count > 1 ? (idx / (count - 1)) * w : 0;
        const y = h - (Math.min(100, item.cpu) / 100) * (h - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    },
    ramPoints() {
      if (!this.historyList.length) return '';
      const w = 740;
      const h = 130;
      const count = this.historyList.length;
      return this.historyList.map((item, idx) => {
        const x = count > 1 ? (idx / (count - 1)) * w : 0;
        const y = h - (Math.min(100, item.mem) / 100) * (h - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    }
  },
  mounted() {
    this.fetchMetrics();
    this.pollTimer = setInterval(this.fetchMetrics, 10000);
  },
  beforeUnmount() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  },
  methods: {
    async fetchMetrics() {
      try {
        const res = await axios.get('/api/system/metrics');
        if (res.data?.success) {
          if (res.data.current) this.metrics = res.data.current;
          if (Array.isArray(res.data.history)) this.historyList = res.data.history;
        }
      } catch (e) {}
    },
    openModal() {
      this.fetchMetrics();
      this.showModal = true;
    },
    getChipClass(val) {
      if (val >= 85) return 'chip-danger';
      if (val >= 70) return 'chip-warning';
      return 'chip-normal';
    },
    formatUptime(sec) {
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
};
</script>

<style scoped>
.system-monitor-wrapper {
  display: inline-flex;
  align-items: center;
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
  padding: 3px 8px;
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

.sys-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.metric-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.card-title {
  font-size: 13px;
  font-weight: bold;
  color: #cbd5e1;
  margin-bottom: 8px;
}
.gauge-box { margin: 6px 0; }
.card-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.card-detail .highlight {
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
}
.card-detail .sub-text {
  font-size: 11px;
  color: #94a3b8;
  max-width: 210px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-chart-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.chart-title {
  font-size: 12px;
  font-weight: bold;
  color: #cbd5e1;
}
.chart-legend {
  display: flex;
  gap: 14px;
  font-size: 11px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #cbd5e1;
}
.legend-color {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.legend-cpu { background: #38bdf8; }
.legend-mem { background: #f59e0b; }
.svg-container {
  position: relative;
  width: 100%;
  height: 130px;
}
.trend-svg { width: 100%; height: 100%; }
.chart-y-axis {
  position: absolute;
  top: 0;
  left: 4px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 9px;
  color: #64748b;
  pointer-events: none;
}
.sys-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid #334155;
  font-size: 12px;
  color: #94a3b8;
}
.sys-footer-bar strong { color: #4ade80; }
</style>