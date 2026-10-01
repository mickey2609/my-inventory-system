<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <!-- 頂部操作列與設定按鈕 (匯出按鈕已搬移至重新計算即時統計左側) -->
      <div class="top-bar-actions">
        <span class="page-title-text">📊 儲位數與才數統計概覽 (跨區交叉矩陣)</span>
        <div class="btn-group">
          <!-- 🌟 匯出 XLSX 按鈕 🌟 -->
          <el-button 
            type="success" 
            size="small" 
            icon="el-icon-document" 
            :loading="exportingXlsx"
            @click="exportFullXlsx"
            class="export-top-btn btn-xlsx"
          >
            📊 匯出 xlsx (3工作表)
          </el-button>

          <!-- 🌟 匯出 PDF 按鈕 🌟 -->
          <el-button 
            type="danger" 
            size="small" 
            icon="el-icon-printer" 
            :loading="exportingPdf"
            @click="exportFullPdf"
            class="export-top-btn btn-pdf"
          >
            🖨️ 匯出 PDF (3頁)
          </el-button>

          <!-- 重新計算即時統計按鈕 -->
          <el-button 
            type="primary" 
            icon="el-icon-refresh" 
            size="small" 
            :loading="loading" 
            @click="$emit('refresh-summary')"
          >
            🔄 重新計算即時統計
          </el-button>

          <!-- 儲位定義設定按鈕 -->
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

      <!-- 7 大數據指標卡片 -->
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

      <!-- 數據表格三頁籤區 -->
      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs">
          <!-- 頁籤 1：儲格數交叉統計表 -->
          <el-tab-pane label="📊 儲格數交叉統計表">
            <el-table 
              ref="gridTable"
              :data="summaryGridData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table print-target-1"
              :row-class-name="tableRowClassName"
              :span-method="arraySpanMethod"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!-- 規劃 -->
              <el-table-column label="規劃" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 已使用 -->
              <el-table-column label="已使用" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 未使用率 (%) -->
              <el-table-column label="未使用率 (%)" align="center" class-name="section-border-right">
                <el-table-column prop="unrate_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 剩餘 -->
              <el-table-column label="剩餘" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!--【儲位格數彙總】-->
              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="85" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="85" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid') }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘儲位數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getRemVolForGridTable(scope.row)) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 頁籤 2：才數交叉統計表 -->
          <el-tab-pane label="📦 才數交叉統計表">
            <el-table 
              ref="volTable"
              :data="summaryVolData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table print-target-2"
              :row-class-name="tableRowClassName"
              :span-method="arraySpanMethod"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!-- 規劃總才數 -->
              <el-table-column label="規劃總才數" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 使用中才數 -->
              <el-table-column label="使用中才數" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 剩餘才數 -->
              <el-table-column label="剩餘才數" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!--【才數彙總】-->
              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="90" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="90" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true) }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="儲位健康度" width="95" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ getRowHealthVol(scope.row) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 頁籤 3：📋 儲位與才數綜合總覽表 -->
          <el-tab-pane label="📋 儲位與才數綜合總覽表">
            <el-table 
              ref="combinedTable"
              :data="combinedTableData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table print-target-3"
              :row-class-name="tableRowClassName"
              :span-method="arraySpanMethod"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!--【儲位格數彙總】-->
              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group section-border-right">
                <el-table-column label="規劃數" width="100" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_grid) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="100" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_grid" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘儲位數" width="100" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="105" align="right" class-name="section-border-right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <!--【才數彙總】-->
              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group-vol">
                <el-table-column label="規劃數" width="110" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_vol) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="110" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_vol" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘才數" width="110" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_health_vol" label="儲位健康度" width="100" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ scope.row.sum_health_vol || '0.0%' }}</span>
                  </template>
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
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default {
  name: 'LocSummary',
  props: [
    'loading', 'calcProgress', 'progressColors', 'summaryStats', 
    'summaryGridData', 'summaryVolData', 'typeMergedData', 'areaGridTable', 'areaVolTable'
  ],
  data() {
    return {
      showConfigDialog: false,
      isUploading: false,
      masterLoading: false,
      masterTableData: [],
      exportingXlsx: false,
      exportingPdf: false
    }
  },
  computed: {
    combinedTableData() {
      if (!this.summaryGridData || this.summaryGridData.length === 0) return [];
      
      return this.summaryGridData.map((gridRow, idx) => {
        const volRow = (this.summaryVolData && this.summaryVolData[idx]) ? this.summaryVolData[idx] : {};

        const sumPlanG = Number(this.getSumVal(gridRow, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        const sumUsedG = Number(this.getSumVal(gridRow, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']));
        const sumRemG = Number(this.getSumVal(gridRow, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        const sumUnrateG = gridRow.sum_unrate_grid || this.getUnrateVal(gridRow, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid');

        const sumPlanV = Number(this.getSumVal(volRow, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        const sumUsedV = Number(this.getSumVal(volRow, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
        const sumRemV = Number(this.getSumVal(volRow, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        const sumUnrateV = volRow.sum_unrate_vol || this.getUnrateVal(volRow, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true);
        const sumHealthV = this.getRowHealthVol(volRow);

        return {
          ...gridRow,
          sum_plan_grid: sumPlanG,
          sum_used_grid: sumUsedG,
          sum_unrate_grid: sumUnrateG,
          sum_rem_grid: sumRemG,
          sum_plan_vol: parseFloat(sumPlanV.toFixed(1)),
          sum_used_vol: parseFloat(sumUsedV.toFixed(1)),
          sum_unrate_vol: sumUnrateV,
          sum_rem_vol: parseFloat(sumRemV.toFixed(1)),
          sum_health_vol: sumHealthV
        };
      });
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
    arraySpanMethod({ row, columnIndex }) {
      if (row.is_subtotal || row.is_total) {
        if (columnIndex === 0) return { rowspan: 1, colspan: 2 };
        else if (columnIndex === 1) return { rowspan: 0, colspan: 0 };
      }
      return { rowspan: 1, colspan: 1 };
    },
    getSumVal(row, primaryKey, subKeys) {
      if (!row) return 0;
      if (row[primaryKey] !== undefined && row[primaryKey] !== null && row[primaryKey] !== '') {
        return row[primaryKey];
      }
      const camelKey = primaryKey.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (row[camelKey] !== undefined && row[camelKey] !== null && row[camelKey] !== '') {
        return row[camelKey];
      }
      let sum = 0;
      if (Array.isArray(subKeys)) {
        subKeys.forEach(k => {
          const val = Number(String(row[k] || 0).replace(/,/g, ''));
          if (!isNaN(val)) sum += val;
        });
      }
      return sum;
    },
    getRemVolForGridTable(row) {
      if (!row) return 0;
      if (row.sum_rem_vol) return row.sum_rem_vol;
      if (row.sumRemVol) return row.sumRemVol;
      
      const idx = this.summaryGridData.indexOf(row);
      if (idx >= 0 && this.summaryVolData && this.summaryVolData[idx]) {
        return this.getSumVal(this.summaryVolData[idx], 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']);
      }
      return 0;
    },
    getRowHealthVol(row) {
      if (!row) return '0.0%';
      if (row.sum_health_vol && row.sum_health_vol !== '0.0%') return row.sum_health_vol;
      if (row.sumHealthVol && row.sumHealthVol !== '0.0%') return row.sumHealthVol;

      const plan = Number(this.getSumVal(row, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const used = Number(this.getSumVal(row, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
      const rem = Number(this.getSumVal(row, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));

      if (plan <= 0) return '0.0%';
      const unrate = rem / plan;
      const denom = 1 - unrate;
      if (denom <= 0) return '0.0%';

      const adjustedUsed = used / denom;
      return ((adjustedUsed / plan) * 100).toFixed(1) + '%';
    },
    getUnrateVal(row, unrateKey, planKey, usedKey, isVol = false) {
      if (!row) return '0.0%';
      if (row[unrateKey]) return row[unrateKey];
      const plan = Number(this.getSumVal(row, planKey, isVol ? ['plan_A區','plan_B區','plan_C區','plan_D區'] : ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const used = Number(this.getSumVal(row, usedKey, isVol ? ['used_A區','used_B區','used_C區','used_D區'] : ['used_A區','used_B區','used_C區','used_D區']));
      if (plan <= 0) return '0.0%';
      const rem = Math.max(0, plan - used);
      return ((rem / plan) * 100).toFixed(1) + '%';
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
    },

    // 匯入 XLSX (1個檔案，3個工作表)
    async exportFullXlsx() {
      this.exportingXlsx = true;
      try {
        const wb = XLSX.utils.book_new();

        const formatDataset = (data, isVol = false) => {
          return data.map(r => {
            const item = {
              '樓層': r.floor || (r.is_total ? '全區總計' : (r.is_subtotal ? r.loc_type : '')),
              '儲位類型': r.loc_type || ''
            };

            if (!isVol) {
              item['規劃_A區'] = r.plan_A區 || '';
              item['規劃_B區'] = r.plan_B區 || '';
              item['規劃_C區'] = r.plan_C區 || '';
              item['規劃_D區'] = r.plan_D區 || '';
              item['已使用_A區'] = r.used_A區 || '';
              item['已使用_B區'] = r.used_B區 || '';
              item['已使用_C區'] = r.used_C區 || '';
              item['已使用_D區'] = r.used_D區 || '';
              item['未使用率_A區'] = r.unrate_A區 || '';
              item['未使用率_B區'] = r.unrate_B區 || '';
              item['未使用率_C區'] = r.unrate_C區 || '';
              item['未使用率_D區'] = r.unrate_D區 || '';
              item['剩餘_A區'] = r.rem_A區 || '';
              item['剩餘_B區'] = r.rem_B區 || '';
              item['剩餘_C區'] = r.rem_C區 || '';
              item['剩餘_D區'] = r.rem_D區 || '';
              item['【格數彙總】規劃數'] = this.getSumVal(r, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']);
              item['【格數彙總】已使用'] = this.getSumVal(r, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']);
              item['【格數彙總】未使用率(%)'] = this.getUnrateVal(r, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid');
              item['【格數彙總】剩餘儲位數'] = this.getSumVal(r, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']);
              item['【格數彙總】剩餘才數'] = this.getRemVolForGridTable(r);
            } else {
              item['規劃總才數_A區'] = r.plan_A區 || '';
              item['規劃總才數_B區'] = r.plan_B區 || '';
              item['規劃總才數_C區'] = r.plan_C區 || '';
              item['規劃總才數_D區'] = r.plan_D區 || '';
              item['使用中才數_A區'] = r.used_A區 || '';
              item['使用中才數_B區'] = r.used_B區 || '';
              item['使用中才數_C區'] = r.used_C區 || '';
              item['使用中才數_D區'] = r.used_D區 || '';
              item['剩餘才數_A區'] = r.rem_A區 || '';
              item['剩餘才數_B區'] = r.rem_B區 || '';
              item['剩餘才數_C區'] = r.rem_C區 || '';
              item['剩餘才數_D區'] = r.rem_D區 || '';
              item['【才數彙總】規劃數'] = this.getSumVal(r, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']);
              item['【才數彙總】已使用'] = this.getSumVal(r, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']);
              item['【才數彙總】未使用率(%)'] = this.getUnrateVal(r, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true);
              item['【才數彙總】剩餘才數'] = this.getSumVal(r, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']);
              item['【才數彙總】儲位健康度'] = this.getRowHealthVol(r);
            }
            return item;
          });
        };

        const ws1Data = formatDataset(this.summaryGridData, false);
        const ws1 = XLSX.utils.json_to_sheet(ws1Data);
        XLSX.utils.book_append_sheet(wb, ws1, "儲格數交叉統計表");

        const ws2Data = formatDataset(this.summaryVolData, true);
        const ws2 = XLSX.utils.json_to_sheet(ws2Data);
        XLSX.utils.book_append_sheet(wb, ws2, "才數交叉統計表");

        const ws3Data = this.combinedTableData.map(r => ({
          '樓層': r.floor || (r.is_total ? '全區總計' : (r.is_subtotal ? r.loc_type : '')),
          '儲位類型': r.loc_type || '',
          '【儲位格數彙總】規劃數': r.sum_plan_grid,
          '【儲位格數彙總】已使用': r.sum_used_grid,
          '【儲位格數彙總】未使用率(%)': r.sum_unrate_grid,
          '【儲位格數彙總】剩餘儲位數': r.sum_rem_grid,
          '【儲位格數彙總】剩餘才數': r.sum_rem_vol,
          '【才數彙總】規劃數': r.sum_plan_vol,
          '【才數彙總】已使用': r.sum_used_vol,
          '【才數彙總】未使用率(%)': r.sum_unrate_vol,
          '【才數彙總】剩餘才數': r.sum_rem_vol,
          '【才數彙總】儲位健康度': r.sum_health_vol
        }));
        const ws3 = XLSX.utils.json_to_sheet(ws3Data);
        XLSX.utils.book_append_sheet(wb, ws3, "儲位與才數綜合總覽表");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `儲位管理系統_跨區交叉矩陣統計總表_${dateStr}.xlsx`);
        this.$message.success('🎉 成功匯出包含 3 個工作表的 Excel 檔案！');
      } catch (err) {
        this.$message.error('匯出 XLSX 失敗：' + err.message);
      } finally {
        this.exportingXlsx = false;
      }
    },

    // 匯出 PDF (精準 3 頁 A4 橫向)
    async exportFullPdf() {
      this.exportingPdf = true;
      this.$message.info('⚡ 正在渲染高畫質 PDF 3 頁報表中，請稍候...');

      try {
        const pdf = new jsPDF('landscape', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const targets = [
          { selector: '.print-target-1', title: '📊 儲格數交叉統計表' },
          { selector: '.print-target-2', title: '📦 才數交叉統計表' },
          { selector: '.print-target-3', title: '📋 儲位與才數綜合總覽表' }
        ];

        for (let i = 0; i < targets.length; i++) {
          if (i > 0) pdf.addPage();

          const el = document.querySelector(targets[i].selector);
          if (el) {
            const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#0f172a'
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pdfWidth - 40;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.setFillColor(15, 23, 42);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

            pdf.setFontSize(14);
            pdf.setTextColor(56, 189, 248);
            pdf.text(targets[i].title, 20, 30);

            const yPos = 45;
            const finalImgHeight = Math.min(imgHeight, pdfHeight - 60);
            pdf.addImage(imgData, 'PNG', 20, yPos, imgWidth, finalImgHeight);
          }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        pdf.save(`儲位管理系統_統計概覽報表_3頁列印_${dateStr}.pdf`);
        this.$message.success('🎉 成功匯出 3 頁滿版 PDF 報表！');
      } catch (err) {
        this.$message.error('匯出 PDF 失敗：' + err.message);
      } finally {
        this.exportingPdf = false;
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
  align-items: center;
}

.export-top-btn {
  font-weight: bold;
  border-radius: 4px;
}

.btn-xlsx {
  background-color: #65a30d !important;
  border-color: #4d7c0f !important;
  color: #ffffff !important;
}

.btn-pdf {
  background-color: #f43f5e !important;
  border-color: #e11d48 !important;
  color: #ffffff !important;
}

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

/* 五大區塊粗框分隔線 */
:deep(.pivot-table .section-border-right) {
  border-right: 3px solid #38bdf8 !important;
}

/* 儲位格數總覽頭部醒目藍色 */
:deep(.pivot-table th.summary-header-group) {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
}

/* 才數總覽頭部醒目紫深藍色 */
:deep(.pivot-table th.summary-header-group-vol) {
  background-color: #4338ca !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
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