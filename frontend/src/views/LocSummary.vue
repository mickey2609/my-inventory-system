<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <!-- 頂部操作列與設定按鈕 -->
      <div class="top-bar-actions">
        <span class="page-title-text">📊 儲位數與才數統計概覽 (跨區交叉矩陣)</span>
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

      <!-- 7 大數據指標卡片 (包含剩餘空才數) -->
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
        <div class="stat-card">
          <span class="stat-lbl">剩餘空才數</span>
          <span class="stat-val text-orange">{{ formatNumber(summaryStats.total_rem_vol) }}</span>
        </div>
        <div class="stat-card highlight-health">
          <span class="stat-lbl">儲位整體健康度</span>
          <span class="stat-val text-cyan">{{ summaryStats.total_health || '0.0%' }}</span>
        </div>
      </div>

      <!-- 進度條面板 -->
      <div v-if="loading" class="progress-box dark-panel">
        <div class="progress-lbl">⚡ 正在進行 A/B/C/D 區與樓層型態交叉矩陣計算中...</div>
        <el-progress :percentage="calcProgress" :color="progressColors" :stroke-width="18" striped stripe-processing></el-progress>
      </div>

      <!-- 數據表格雙頁籤區 -->
      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs">
          <!-- 1. 儲格數交叉統計表 -->
          <el-tab-pane label="📊 儲格數交叉統計表 (對齊 Excel 圖2)">
            <el-table 
              :data="summaryGridData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left"></el-table-column>

              <!-- 規劃 -->
              <el-table-column label="規劃" align="center">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 已使用 -->
              <el-table-column label="已使用" align="center">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 未使用率 (%) -->
              <el-table-column label="未使用率 (%)" align="center">
                <el-table-column prop="unrate_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 剩餘 -->
              <el-table-column label="剩餘" align="center">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 🌟 右側新增【儲位格數彙總】(對齊 Excel 圖2) 🌟 -->
              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group">
                <el-table-column prop="sum_plan_grid" label="規劃數" width="85" align="right">
                  <template #default="scope"><strong>{{ formatNumber(scope.row.sum_plan_grid) }}</strong></template>
                </el-table-column>
                <el-table-column prop="sum_used_grid" label="已使用" width="85" align="right">
                  <template #default="scope"><span class="text-green">{{ formatNumber(scope.row.sum_used_grid) }}</span></template>
                </el-table-column>
                <el-table-column prop="sum_unrate_grid" label="未使用率(%)" width="95" align="right"></el-table-column>
                <el-table-column prop="sum_rem_grid" label="剩餘儲位數" width="95" align="right">
                  <template #default="scope"><span class="text-orange">{{ formatNumber(scope.row.sum_rem_grid) }}</span></template>
                </el-table-column>
                <el-table-column prop="sum_rem_vol" label="剩餘才數" width="95" align="right">
                  <template #default="scope"><span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span></template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 2. 才數交叉統計表 -->
          <el-tab-pane label="📦 才數交叉統計表 (對齊 Excel 圖3)">
            <el-table 
              :data="summaryVolData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left"></el-table-column>

              <!-- 規劃總才數 -->
              <el-table-column label="規劃總才數" align="center">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 使用中才數 -->
              <el-table-column label="使用中才數" align="center">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 剩餘才數 -->
              <el-table-column label="剩餘才數" align="center">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right"></el-table-column>
              </el-table-column>

              <!-- 🌟 右側新增【才數彙總】(對齊 Excel 圖3) 🌟 -->
              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group">
                <el-table-column prop="sum_plan_vol" label="規劃數" width="90" align="right">
                  <template #default="scope"><strong>{{ formatNumber(scope.row.sum_plan_vol) }}</strong></template>
                </el-table-column>
                <el-table-column prop="sum_used_vol" label="已使用" width="90" align="right">
                  <template #default="scope"><span class="text-green">{{ formatNumber(scope.row.sum_used_vol) }}</span></template>
                </el-table-column>
                <el-table-column prop="sum_unrate_vol" label="未使用率(%)" width="95" align="right"></el-table-column>
                <el-table-column prop="sum_rem_vol" label="剩餘才數" width="95" align="right">
                  <template #default="scope"><span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span></template>
                </el-table-column>
                <el-table-column prop="sum_health_vol" label="儲位健康度" width="95" align="right">
                  <template #default="scope"><span class="text-cyan">{{ scope.row.sum_health_vol }}</span></template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- 儲位定義 Modal -->
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
    tableRowClassName({ row }) {
      if (row.is_total) return 'total-row';
      if (row.is_subtotal) return 'subtotal-row';
      return '';
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
  padding: 12px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.summary-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-bar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
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

/* 7 張卡片 */
.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.stat-lbl { font-size: 12px; color: #94a3b8; }
.stat-val { font-size: 18px; font-weight: bold; margin-top: 2px; }

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
  margin-top: 5px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.dark-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e293b !important;
  border-color: #334155 !important;
}

:deep(.dark-tabs .el-tabs__content) {
  flex: 1;
  padding: 8px;
  height: calc(100% - 40px);
  min-height: 0;
}

:deep(.dark-tabs .el-tab-pane) {
  height: 100%;
}

:deep(.pivot-table .subtotal-row) {
  background-color: #fef08a !important;
  color: #0f172a !important;
  font-weight: bold;
}

:deep(.pivot-table .subtotal-row td) {
  background-color: #fef08a !important;
  color: #0f172a !important;
  font-weight: bold;
}

:deep(.pivot-table .total-row) {
  background-color: #86efac !important;
  color: #0f172a !important;
  font-weight: bold;
}

:deep(.pivot-table .total-row td) {
  background-color: #86efac !important;
  color: #0f172a !important;
  font-weight: bold;
}

:deep(.pivot-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  text-align: center;
  border-right: 1px solid #334155 !important;
  border-bottom: 1px solid #334155 !important;
}

/* 總覽欄位區塊頭部專屬醒目背景色 */
:deep(.pivot-table th.summary-header-group) {
  background-color: #0284c7 !important;
  color: #ffffff !important;
}

.config-modal-content { color: #f8fafc; }
.upload-top-bar { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 4px; }
.section-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; }
.section-desc code { background: #0f172a; color: #f43f5e; padding: 2px 6px; border-radius: 4px; }
.master-preview-table { margin-top: 10px; }

@media (max-width: 1400px) {
  .stats-overview-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>