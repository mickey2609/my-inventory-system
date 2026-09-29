<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <!-- 頂部操作列與設定按鈕 -->
      <div class="top-bar-actions">
        <span class="page-title-text">📊 儲位數與才數統計概覽</span>
        <div class="btn-group">
          <el-button 
            type="primary" 
            icon="el-icon-refresh" 
            size="small" 
            :loading="loading" 
            @click="$emit('refresh-summary')"
          >
            🔄 重新計算即時統計
          </el-button>
          <el-button 
            type="warning" 
            icon="el-icon-setting" 
            size="small" 
            @click="openConfigModal"
          >
            ⚙️ 儲位定義設定 (匯入/檢視 CSV)
          </el-button>
        </div>
      </div>

      <!-- 6 大數據指標卡片 -->
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
          <span class="stat-val text-cyan">{{ summaryStats.total_health || '0.0%' }}</span>
        </div>
      </div>

      <!-- 進度條面板 -->
      <div v-if="loading" class="progress-box dark-panel">
        <div class="progress-lbl">⚡ 正在結合儲位定義進行全區域儲位才數交叉計算中...</div>
        <el-progress :percentage="calcProgress" :color="progressColors" :stroke-width="18" striped stripe-processing></el-progress>
      </div>

      <!-- 數據表格雙頁籤區 -->
      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs">
          <el-tab-pane label="📊 儲格數統計明細 (依樓層區域)">
            <el-table :data="summaryGridData" border stripe height="500px" size="small" class="dark-table">
              <el-table-column prop="樓層區域" label="樓層區域" min-width="120" fixed="left"></el-table-column>
              <el-table-column prop="規劃儲格數" label="規劃儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="使用儲格數" label="使用儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="剩餘儲格數" label="剩餘儲格數" min-width="110" sortable></el-table-column>
              <el-table-column prop="使用率" label="儲格使用率" min-width="110" sortable></el-table-column>
              <el-table-column prop="儲位健康度" label="健康度" min-width="110" sortable></el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="📦 才數統計明細 (依樓層區域)">
            <el-table :data="summaryVolData" border stripe height="500px" size="small" class="dark-table">
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

    <!-- 🌟 儲位定義 CSV 匯入與參數設定 Modal (含圖2同款預覽表格) -->
    <el-dialog
      title="⚙️ 儲位定義參數設定"
      v-model="showConfigDialog"
      width="750px"
      append-to-body
      class="custom-dark-dialog"
    >
      <div class="config-modal-content">
        <div class="upload-top-bar">
          <div>
            <div class="section-title">📥 匯入最新 `locations_master.csv` 檔案</div>
            <p class="section-desc">
              將包含 <code>樓層, 區域, 儲位類型, 才數, 儲格數, 儲位才數</code> 的結構定義寫入地端 SQLite。
            </p>
          </div>
          <div class="upload-area">
            <input 
              type="file" 
              ref="locMasterFileInput" 
              accept=".csv" 
              style="display: none;" 
              @change="handleMasterCsvUpload" 
            />
            <el-button 
              type="success" 
              icon="el-icon-upload2" 
              size="small"
              :loading="isUploading"
              @click="$refs.locMasterFileInput.click()"
            >
              📁 選擇 CSV 檔案並匯入
            </el-button>
          </div>
        </div>

        <el-divider content-position="left">📋 當前地端 SQLite 儲位結構定義清單</el-divider>

        <!-- 圖 2 格式之儲位結構預覽表格 -->
        <el-table 
          :data="masterTableData" 
          border 
          stripe 
          size="mini" 
          height="320px" 
          v-loading="masterLoading"
          class="dark-table master-preview-table"
        >
          <el-table-column prop="樓層" label="樓層" width="80" align="center"></el-table-column>
          <el-table-column prop="區域" label="區域" width="80" align="center"></el-table-column>
          <el-table-column prop="儲位類型" label="儲位類型" min-width="130"></el-table-column>
          <el-table-column prop="才數" label="才數" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.才數) }}</template>
          </el-table-column>
          <el-table-column prop="儲格數" label="儲格數(板、層)" width="120" align="right">
            <template #default="scope">{{ formatNumber(scope.row.儲格數) }}</template>
          </el-table-column>
          <el-table-column prop="儲位才數" label="儲位才數" width="110" align="right">
            <template #default="scope">{{ scope.row.儲位才數 }}</template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showConfigDialog = false">關閉</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'LocSummary',
  props: [
    'loading', 'calcProgress', 'progressColors', 'summaryStats', 
    'summaryGridData', 'summaryVolData', 'areaGridTable', 'areaVolTable'
  ],
  data() {
    return {
      showConfigDialog: false,
      isUploading: false,
      masterLoading: false,
      masterTableData: []
    }
  },
  mounted() {
    if (!this.summaryGridData || this.summaryGridData.length === 0) {
      this.$emit('refresh-summary');
    }
  },
  methods: {
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    openConfigModal() {
      this.showConfigDialog = true;
      this.fetchLocationsMaster();
    },
    async fetchLocationsMaster() {
      this.masterLoading = true;
      try {
        const res = await axios.get('/api/get-locations-master');
        if (res.data?.success) {
          this.masterTableData = res.data.data || [];
        }
      } catch (err) {
        this.$message.error('讀取儲位結構清單失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.masterLoading = false;
      }
    },
    async handleMasterCsvUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.isUploading = true;
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post('/api/import-locations-master', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          this.$message.success(`🎉 成功匯入 ${res.data.count.toLocaleString()} 筆儲位定義結構！`);
          await this.fetchLocationsMaster();
          this.$emit('refresh-summary');
        } else {
          this.$message.error('匯入失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (err) {
        this.$message.error('連線或寫入失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.isUploading = false;
        event.target.value = '';
      }
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

.top-bar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.page-title-text {
  font-size: 15px;
  font-weight: bold;
  color: #38bdf8;
}

.btn-group {
  display: flex;
  gap: 8px;
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

.config-modal-content {
  color: #f8fafc;
}

.upload-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 4px;
}

.section-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.section-desc code {
  background: #0f172a;
  color: #f43f5e;
  padding: 2px 6px;
  border-radius: 4px;
}

.master-preview-table {
  margin-top: 10px;
}

@media (max-width: 1200px) {
  .stats-overview-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>