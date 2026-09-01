<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <div class="stats-overview-grid">
        <div class="stat-card">
          <span class="stat-lbl">規劃總儲格數</span>
          <span class="stat-val text-blue">{{ formatNumber(summaryStats.total_plan_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中儲格數</span>
          <span class="stat-val text-green">{{ formatNumber(summaryStats.total_used_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">剩餘空儲格數</span>
          <span class="stat-val text-orange">{{ formatNumber(summaryStats.total_rem_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">規劃總才數</span>
          <span class="stat-val text-blue">{{ formatNumber(summaryStats.total_plan_vol) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中才數</span>
          <span class="stat-val text-green">{{ formatNumber(summaryStats.total_used_vol) }}</span>
        </div>
        <div class="stat-card highlight-health">
          <span class="stat-lbl">儲位整體健康度</span>
          <span class="stat-val text-cyan">{{ summaryStats.total_health || '98.5%' }}</span>
        </div>
      </div>

      <div v-if="loading" class="progress-box dark-panel">
        <div class="progress-lbl">⚡ 正在結合 `loc_detail.csv` 進行全區域儲位才數交叉計算中...</div>
        <el-progress :percentage="calcProgress" :color="progressColors" :stroke-width="18" striped stripe-processing></el-progress>
      </div>

      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs">
          <el-tab-pane label="📊 儲格數統計明細 (依樓層區域)">
            <el-table :data="summaryGridData" border stripe height="520px" size="small" class="dark-table">
              <el-table-column prop="樓層區域" label="樓層區域" min-width="120" fixed="left"></el-table-column>
              <el-table-column prop="規劃儲格數" label="規劃儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="使用儲格數" label="使用儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="剩餘儲格數" label="剩餘儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="使用率" label="儲格使用率" min-width="110" sortable></el-table-column>
              <el-table-column prop="儲位健康度" label="健康度" min-width="110" sortable></el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="📦 才數統計明細 (依樓層區域)">
            <el-table :data="summaryVolData" border stripe height="520px" size="small" class="dark-table">
              <el-table-column prop="樓層區域" label="樓層區域" min-width="120" fixed="left"></el-table-column>
              <el-table-column prop="規劃總才數" label="規劃總才數" min-width="110" sortable></el-table-column>
              <el-table-column prop="使用中才數" label="使用中才數" min-width="110" sortable></el-table-column>
              <el-table-column prop="剩餘才數" label="剩餘才數" min-width="110" sortable></el-table-column>
              <el-table-column prop="才數使用率" label="才數使用率" min-width="110" sortable></el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LocSummary',
  props: [
    'loading', 'calcProgress', 'progressColors', 'summaryStats', 
    'summaryGridData', 'summaryVolData', 'areaGridTable', 'areaVolTable'
  ],
  mounted() {
    // 🔥 初始化自動檢查，無資料時觸發載入
    if (!this.summaryGridData || this.summaryGridData.length === 0) {
      this.$emit('refresh-summary');
    }
  },
  methods: {
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    }
  }
}
</script>

<style scoped>
.loc-summary-page {
  padding: 15px;
  height: calc(100vh - 52px);
  overflow-y: auto;
}

.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 15px;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}

.stat-lbl { font-size: 12px; color: #94a3b8; }
.stat-val { font-size: 18px; font-weight: bold; margin-top: 4px; }

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.text-cyan { color: #22d3ee; }

.stat-card.highlight-health {
  background: rgba(34, 211, 238, 0.1);
  border-color: #0891b2;
}

.progress-box {
  background: #1e293b;
  padding: 25px;
  border-radius: 10px;
  border: 1px solid #334155;
  margin-top: 20px;
}

.progress-lbl {
  color: #38bdf8;
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 14px;
}

.tables-main-wrapper {
  margin-top: 10px;
}

@media (max-width: 1200px) {
  .stats-overview-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>