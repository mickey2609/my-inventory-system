<template>
  <div class="replenish-fish-page dark-bg">
    <!-- 隱藏的 CSV 檔案選擇器 -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv"
      @change="handleCsvFileSelected"
    />

    <!-- 1. 頂部操作與篩選列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 倉庫 立即補貨單魚群出沒分析</span>
        
        <!-- 日期選擇器 -->
        <el-date-picker
          v-if="analysisMode === 'daily'"
          v-model="targetDate"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="選擇日期"
          style="width: 135px;"
          @change="fetchFishData"
        />

        <el-date-picker
          v-else
          v-model="targetMonth"
          type="month"
          size="small"
          value-format="YYYY-MM"
          placeholder="選擇月份"
          style="width: 135px;"
          @change="fetchMonthlySummary"
        />

        <!-- 分析模式切換（單日 vs 每月） -->
        <el-radio-group v-model="analysisMode" size="small" @change="handleAnalysisModeChange">
          <el-radio-button label="daily">📅 單日時段分析</el-radio-button>
          <el-radio-button label="monthly">🗓️ 每月每日總表</el-radio-button>
        </el-radio-group>

        <!-- 庫別選擇 -->
        <el-radio-group v-model="warehouse" size="small" @change="handleFilterChange">
          <el-radio-button label="all">🌐 雙庫合計</el-radio-button>
          <el-radio-button label="80">📦 80 庫 (人工)</el-radio-button>
          <el-radio-button label="15">🔍 15 庫 (自動)</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="refreshAllData">
          🔄 重新整理
        </el-button>

        <el-button
          v-if="checkSysAdmin"
          type="success"
          size="small"
          icon="el-icon-upload2"
          :loading="isUploading"
          @click="triggerSelectCsv"
        >
          📥 匯入立即補貨單 CSV
        </el-button>
      </div>
    </div>

    <!-- 2.1 單日時段分析表格 -->
    <div class="table-container" v-loading="loading" v-if="analysisMode === 'daily'">
      <div class="sheet-title">
        倉庫 魚群出沒時間分析 - {{ formatDateTitle(targetDate) }} ({{ getWarehouseLabel(warehouse) }})
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <th colspan="4" class="group-blue-header">產生補貨單統計 (M欄/K欄)</th>
              <th colspan="4" class="group-green-header">完成補貨單統計 (U欄/AK欄)</th>
              <th class="col-ratio-header" rowspan="2" style="width: 90px;">已刪單筆數</th>
            </tr>

            <tr class="header-sub">
              <th class="col-bar-title">產生圖形</th>
              <th style="width: 80px;">產生占比</th>
              <th style="width: 80px;">產生筆數</th>
              <th style="width: 90px;">產生PCS</th>
              <th class="col-bar-title">完成圖形</th>
              <th style="width: 80px;">完成占比</th>
              <th style="width: 80px;">完成筆數</th>
              <th style="width: 90px;">完成PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(h, idx) in hourlyStats" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="col-time font-bold">{{ h.hourStr }}</td>
              
              <!-- 產生補貨單 -->
              <td class="col-bar-cell"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.genPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.genPct) }}</td>
              <td class="text-right">{{ formatNumber(h.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(h.genPcs) }}</td>

              <!-- 完成補貨單 -->
              <td class="col-bar-cell"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.finPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.finPct) }}</td>
              <td class="text-right">{{ formatNumber(h.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(h.finPcs) }}</td>

              <!-- 異常/已刪單 -->
              <td class="text-right font-bold text-orange">{{ formatNumber(h.delOrderCount) }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="col-time font-bold">總計</td>
              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(summaryTotal.genPcs) }}</td>
              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(summaryTotal.finPcs) }}</td>
              <td class="text-right font-bold text-orange">{{ formatNumber(summaryTotal.delOrderCount) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 2.2 每月每日總表區塊 -->
    <div class="table-container" v-loading="loadingMonthly" v-else>
      <div class="sheet-title">
        🗓️ 倉庫 立即補貨單 - {{ targetMonth }} 月份每日總表 ({{ getWarehouseLabel(warehouse) }})
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">日期</th>
              <th colspan="2" class="group-blue-header">產生補貨單匯總</th>
              <th colspan="2" class="group-green-header">完成補貨單匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 100px;">已刪單筆數</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">完成率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 120px;">產生單數</th>
              <th style="width: 130px;">產生 PCS</th>
              <th style="width: 120px;">完成單數</th>
              <th style="width: 130px;">完成 PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(day, idx) in monthlyDailyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ day.date }}</td>
              <td class="text-right">{{ formatNumber(day.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(day.genPcs) }}</td>
              
              <td class="text-right">{{ formatNumber(day.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(day.finPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ formatNumber(day.delOrderCount) }}</td>
              <td class="text-right font-bold text-orange">{{ day.finishRate }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全月總計</td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(monthlySummaryTotal.genPcs) }}</td>
              
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(monthlySummaryTotal.finPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ formatNumber(monthlySummaryTotal.delOrderCount) }}</td>
              <td class="text-right font-bold text-orange">{{ monthlySummaryTotal.finishRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- CSV 上傳進度 Modal -->
    <el-dialog
      v-model="showUploadProgressModal"
      title="⚡ 正在寫入與覆蓋更新立即補貨單資料..."
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="progress-box">
        <p class="file-name-info">📁 匯入檔案：<strong>{{ uploadingFileName }}</strong></p>
        <p class="status-info">已處理：{{ formatNumber(uploadedRows) }} / {{ formatNumber(totalRowsToUpload) }} 筆 ({{ uploadPercent }}%)</p>
        <el-progress :percentage="uploadPercent" :stroke-width="18" :text-inside="true" status="success" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

export default {
  name: 'ReplenishFishList',
  props: {
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      analysisMode: 'daily',
      loading: false,
      loadingMonthly: false,
      targetDate: new Date().toISOString().split('T')[0],
      targetMonth: new Date().toISOString().slice(0, 7),
      warehouse: 'all',
      hourlyStats: [],
      monthlyDailyList: [],

      isUploading: false,
      showUploadProgressModal: false,
      uploadingFileName: '',
      uploadPercent: 0,
      uploadedRows: 0,
      totalRowsToUpload: 0
    }
  },
  computed: {
    checkSysAdmin() {
      if (this.isSysAdmin) return true;
      try {
        const authSessionStr = localStorage.getItem('auth_session');
        if (authSessionStr) {
          const session = JSON.parse(authSessionStr);
          if (session.username === 'admin' || session.role === 'sys_admin') return true;
        }
      } catch (e) {}
      const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '';
      return username === 'admin' || username === '系統管理員';
    },
    summaryTotal() {
      const tot = { genOrderCount: 0, genPcs: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.hourlyStats.forEach(h => {
        tot.genOrderCount += h.genOrderCount || 0;
        tot.genPcs += h.genPcs || 0;
        tot.finOrderCount += h.finOrderCount || 0;
        tot.finPcs += h.finPcs || 0;
        tot.delOrderCount += h.delOrderCount || 0;
      });
      return tot;
    },
    monthlySummaryTotal() {
      const tot = { genOrderCount: 0, genPcs: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.monthlyDailyList.forEach(d => {
        tot.genOrderCount += d.genOrderCount || 0;
        tot.genPcs += d.genPcs || 0;
        tot.finOrderCount += d.finOrderCount || 0;
        tot.finPcs += d.finPcs || 0;
        tot.delOrderCount += d.delOrderCount || 0;
      });
      const finishRate = tot.genPcs > 0 ? ((tot.finPcs / tot.genPcs) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, finishRate };
    }
  },
  mounted() {
    this.fetchFishData();
  },
  methods: {
    formatNumber(val) {
      if (!val) return '0';
      return Number(val).toLocaleString();
    },
    formatPercent(val) {
      if (!val) return '0.00%';
      return (val * 100).toFixed(2) + '%';
    },
    getBarWidth(pct) {
      if (!pct) return '0%';
      return Math.min(100, pct * 100 * 3) + '%';
    },
    formatDateTitle(dStr) {
      if (!dStr) return '';
      const parts = dStr.split('-');
      return parts.length >= 3 ? `${parts[2]}日` : dStr;
    },
    getWarehouseLabel(wh) {
      if (wh === '80') return '80 庫';
      if (wh === '15') return '15 庫';
      return '雙庫合計';
    },

    handleAnalysisModeChange(mode) {
      if (mode === 'daily') this.fetchFishData();
      else this.fetchMonthlySummary();
    },

    handleFilterChange() {
      if (this.analysisMode === 'daily') this.fetchFishData();
      else this.fetchMonthlySummary();
    },

    async refreshAllData() {
      if (this.analysisMode === 'daily') await this.fetchFishData();
      else await this.fetchMonthlySummary();
      ElMessage.success('🎉 資料已成功重新整理！');
    },

    triggerSelectCsv() {
      if (this.$refs.csvFileInput) this.$refs.csvFileInput.click();
    },

    async handleCsvFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        ElMessage.error('請選擇 .csv 格式的補貨單檔案！');
        event.target.value = '';
        return;
      }

      this.isUploading = true;
      this.showUploadProgressModal = true;
      this.uploadingFileName = file.name;
      this.uploadPercent = 0;
      this.uploadedRows = 0;
      this.totalRowsToUpload = 0;

      try {
        const Papa = (await import('papaparse')).default;

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rawData = results.data || [];
            if (rawData.length === 0) {
              this.resetUploadState(event);
              return ElMessage.error('CSV 檔案內無有效資料！');
            }

            this.totalRowsToUpload = rawData.length;
            const BATCH_SIZE = 10000;
            let processed = 0;

            for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
              const chunk = rawData.slice(i, i + BATCH_SIZE);
              const isFirstChunk = (i === 0);

              await axios.post('/api/replenish/import-json', {
                items: chunk,
                fileName: file.name,
                isFirstChunk
              });

              processed += chunk.length;
              this.uploadedRows = processed;
              this.uploadPercent = Math.min(100, Math.round((processed / this.totalRowsToUpload) * 100));
            }

            ElMessage.success(`🎉 成功寫入並更新 ${this.totalRowsToUpload.toLocaleString()} 筆立即補貨單資料！`);
            this.refreshAllData();
            this.resetUploadState(event);
          },
          error: (err) => {
            ElMessage.error('解析 CSV 失敗：' + err.message);
            this.resetUploadState(event);
          }
        });
      } catch (e) {
        ElMessage.error('上傳處理失敗：' + e.message);
        this.resetUploadState(event);
      }
    },

    resetUploadState(event) {
      this.isUploading = false;
      this.showUploadProgressModal = false;
      if (event && event.target) event.target.value = '';
    },

    async fetchFishData() {
      this.loading = true;
      try {
        const res = await axios.get('/api/replenish/fish-analysis', {
          params: { targetDate: this.targetDate, warehouse: this.warehouse }
        });
        if (res.data?.success) {
          const rawHourly = res.data.hourlyStats || [];
          let totGenOrder = 0, totFinOrder = 0;
          rawHourly.forEach(r => {
            totGenOrder += r.genOrderCount || 0;
            totFinOrder += r.finOrderCount || 0;
          });

          this.hourlyStats = rawHourly.map((r, i) => {
            const hStr = `${String(i).padStart(2, '0')} ~ ${String(i + 1).padStart(2, '0')}`;
            return {
              ...r,
              hourStr: hStr,
              genPct: totGenOrder > 0 ? (r.genOrderCount / totGenOrder) : 0,
              finPct: totFinOrder > 0 ? (r.finOrderCount / totFinOrder) : 0
            };
          });
        }
      } catch (e) {
        ElMessage.error('載入補貨魚群失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async fetchMonthlySummary() {
      this.loadingMonthly = true;
      try {
        const res = await axios.get('/api/replenish/monthly-summary', {
          params: { month: this.targetMonth, warehouse: this.warehouse }
        });
        if (res.data?.success) {
          this.monthlyDailyList = res.data.dailyList || [];
        }
      } catch (e) {
        ElMessage.error('載入每月總表失敗：' + e.message);
      } finally {
        this.loadingMonthly = false;
      }
    }
  }
}
</script>

<style scoped>
.replenish-fish-page {
  padding: 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
}

.title-group, .action-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: bold;
  color: #38bdf8;
}

.table-container {
  height: fit-content;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.sheet-title {
  background: #fef08a;
  color: #0f172a;
  font-weight: bold;
  font-size: 14px;
  text-align: center;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.table-scroll-wrapper {
  overflow-x: auto;
}

.vba-style-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #f8fafc;
  background: #0f172a;
  white-space: nowrap;
  table-layout: fixed;
}

.vba-style-table th, .vba-style-table td {
  border: 1px solid #334155;
  padding: 5px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-time {
  text-align: center;
  background: #1e293b;
  width: 70px;
}

.col-bar-title, .col-bar-cell {
  width: auto !important;
  padding: 2px 6px !important;
}

.header-main th {
  font-weight: bold;
  text-align: center;
}

.group-blue-header { background: #1e3a8a; color: #bfdbfe; }
.group-green-header { background: #14532d; color: #bbf7d0; }
.col-ratio-header { background: #854d0e; color: #fef08a; }

.header-sub th {
  background: #334155;
  color: #cbd5e1;
  text-align: center;
}

.bar-fill {
  height: 12px;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.blue-bar { background: #38bdf8; }
.green-bar { background: #22c55e; }

.row-zebra td { background: rgba(255, 255, 255, 0.03); }
.row-summary td { background: #334155; font-weight: bold; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.font-bold { font-weight: bold; }
</style>