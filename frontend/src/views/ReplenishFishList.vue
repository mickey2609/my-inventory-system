<template>
  <div 
    class="replenish-fish-page dark-bg"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="handleFileDrop"
  >
    <!-- 隱藏的檔案選擇器 (支援 .csv, .xls, .xlsx) -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv, .xls, .xlsx"
      @change="handleCsvFileSelected"
    />

    <!-- 拖曳浮層提示 -->
    <div v-if="isDraggingOver" class="drag-overlay">
      <div class="drag-tip-box">
        <i class="el-icon-upload" style="font-size: 48px; color: #38bdf8;"></i>
        <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">放開滑鼠即可直接匯入 .xls / .xlsx / .csv 補貨單檔案！</p>
      </div>
    </div>

    <!-- 1. 第一排：核心標題、日期選擇器、維度切換與操作按鈕 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 倉庫 實時補貨單魚群出沒分析 (80 人工倉)</span>
        
        <!-- 單日時段選擇器 -->
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

        <!-- 每月總表選擇器 -->
        <el-date-picker
          v-else-if="analysisMode === 'monthly'"
          v-model="targetMonth"
          type="month"
          size="small"
          value-format="YYYY-MM"
          placeholder="選擇月份"
          style="width: 135px;"
          @change="fetchMonthlySummary"
        />

        <!-- 年度總表選擇器 -->
        <el-date-picker
          v-else-if="analysisMode === 'yearly'"
          v-model="targetYear"
          type="year"
          size="small"
          value-format="YYYY"
          placeholder="選擇年份"
          style="width: 110px;"
          @change="fetchYearlySummary"
        />

        <!-- 未完成追蹤日期區間選擇器 -->
        <el-date-picker
          v-else-if="analysisMode === 'pending'"
          v-model="pendingDateRange"
          type="daterange"
          size="small"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          style="width: 230px;"
          @change="fetchPendingDetails"
        />

        <!-- 4 維度分析模式切換 -->
        <el-radio-group v-model="analysisMode" size="small" @change="handleAnalysisModeChange">
          <el-radio-button label="daily">📅 單日時段分析</el-radio-button>
          <el-radio-button label="monthly">🗓️ 每月每日總表</el-radio-button>
          <el-radio-button label="yearly">📅 年度每月總表</el-radio-button>
          <el-radio-button label="pending">🚨 補貨未完成追蹤</el-radio-button>
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
          📥 匯入補貨單 (支援 .xls / .xlsx / .csv)
        </el-button>
      </div>
    </div>

    <!-- 2. 第二排獨立工具列：單據類別 (D欄) + 申請原因類別 雙對應篩選選單 -->
    <div class="filter-bar">
      <!-- 單據類別 (D欄) 下拉選單 -->
      <div class="filter-item-box">
        <span class="select-label">📄 單據類別 (D欄)：</span>
        <el-select
          v-model="selectedDocTypes"
          multiple
          collapse-tags
          size="small"
          placeholder="請選擇單據類別"
          style="width: 230px;"
          @change="handleDocTypeChange"
        >
          <el-option label="🌐 全選 (所有單據)" value="all" />
          <el-option
            v-for="item in docTypeOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </div>

      <!-- 申請原因類別 下拉選單 -->
      <div class="filter-item-box">
        <span class="select-label">📋 申請原因類別：</span>
        <el-select
          v-model="selectedReasons"
          multiple
          collapse-tags
          size="small"
          placeholder="請選擇申請原因"
          style="width: 230px;"
          @change="handleReasonChange"
        >
          <el-option label="🌐 全選 (所有原因)" value="all" />
          <el-option
            v-for="item in reasonOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </div>
    </div>

    <!-- 3.1 單日時段分析表格 -->
    <div class="table-container" v-loading="loading" v-if="analysisMode === 'daily'">
      <div class="sheet-title">
        倉庫 魚群出沒時間分析 - {{ formatDateTitle(targetDate) }} (80 人工倉)
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <th colspan="5" class="group-blue-header">產生補貨單統計 (M欄/K欄)</th>
              <th colspan="4" class="group-green-header">完成補貨單統計 (U欄/AK欄)</th>
              <th class="col-ratio-header" rowspan="2" style="width: 90px;">已刪單筆數</th>
            </tr>

            <tr class="header-sub">
              <th class="col-bar-title">產生圖形</th>
              <th style="width: 80px;">產生占比</th>
              <th style="width: 80px;">產生筆數</th>
              <th style="width: 90px;">產生PCS</th>
              <th class="col-pending-header" style="width: 90px;">未完成筆數</th>
              <th class="col-bar-title">完成圖形</th>
              <th style="width: 80px;">完成占比</th>
              <th style="width: 80px;">完成筆數</th>
              <th style="width: 90px;">完成PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(h, idx) in hourlyStats" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="col-time font-bold">{{ h.hourStr }}</td>
              
              <td class="col-bar-cell"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.genPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.genPct) }}</td>
              <td class="text-right">{{ formatNumber(h.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(h.genPcs) }}</td>

              <td class="text-right font-bold text-red">{{ formatNumber(h.pendingOrderCount) }}</td>

              <td class="col-bar-cell"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.finPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.finPct) }}</td>
              <td class="text-right">{{ formatNumber(h.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(h.finPcs) }}</td>

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
              <td class="text-right font-bold text-red">{{ formatNumber(summaryTotal.pendingOrderCount) }}</td>
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

    <!-- 3.2 每月每日總表區塊 -->
    <div class="table-container" v-loading="loadingMonthly" v-else-if="analysisMode === 'monthly'">
      <div class="sheet-title">
        🗓️ 倉庫 實時補貨單 - {{ targetMonth }} 月份每日總表 (80 人工倉)
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

    <!-- 3.3 年度每月總表區塊 -->
    <div class="table-container" v-loading="loadingYearly" v-else-if="analysisMode === 'yearly'">
      <div class="sheet-title">
        📅 倉庫 立即補貨單 - {{ targetYear }} 年度每月總表 (80 人工倉)
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">月份</th>
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
            <tr v-for="(m, idx) in yearlyMonthlyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ m.monthLabel }} ({{ m.month }})</td>
              <td class="text-right">{{ formatNumber(m.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(m.genPcs) }}</td>
              
              <td class="text-right">{{ formatNumber(m.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(m.finPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ formatNumber(m.delOrderCount) }}</td>
              <td class="text-right font-bold text-orange">{{ m.finishRate }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全年總計</td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(yearlySummaryTotal.genPcs) }}</td>
              
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(yearlySummaryTotal.finPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ formatNumber(yearlySummaryTotal.delOrderCount) }}</td>
              <td class="text-right font-bold text-orange">{{ yearlySummaryTotal.finishRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.4 補貨未完成明細追蹤 -->
    <div class="table-container" v-loading="loadingPending" v-else-if="analysisMode === 'pending'">
      <div class="sheet-title alert-sheet-title">
        🚨 倉庫 立即補貨單 - 未完成單據明細追蹤 (共 {{ formatNumber(pendingList.length) }} 筆未完成)
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main group-red-header">
              <th style="width: 140px;">補貨/調撥單號</th>
              <th style="width: 110px;">產生日期</th>
              <th style="width: 90px;">產生時間</th>
              <th style="width: 100px;">申請人員</th>
              <th style="width: 160px;">商品編號</th>
              <th>商品名稱</th>
              <th style="width: 100px;">建議數量</th>
              <th style="width: 130px;">備註說明</th>
              <th style="width: 110px;">銷案工具</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(p, idx) in pendingList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold text-orange">{{ p.order_no }}</td>
              <td class="text-center">{{ p.gen_date }}</td>
              <td class="text-center">{{ p.gen_time }}</td>
              <td class="text-center">{{ p.apply_user }}</td>
              <td class="text-center font-bold text-blue">{{ p.item_id }}</td>
              <td>{{ p.item_name }}</td>
              <td class="text-right font-bold text-red">{{ formatNumber(p.suggest_qty) }}</td>
              <td class="text-center">{{ p.remark }}</td>
              
              <td class="text-center">
                <el-button
                  type="danger"
                  size="mini"
                  icon="el-icon-check"
                  @click="openCloseDialog(p)"
                >
                  即刻銷案
                </el-button>
              </td>
            </tr>
            <tr v-if="pendingList.length === 0">
              <td colspan="9" class="text-center text-green font-bold" style="padding: 20px;">
                🎉 太棒了！當前條件下沒有任何滯留未完成的補貨單據！
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 手動銷案 Modal 對話框 -->
    <el-dialog
      v-model="showCloseModal"
      title="🚨 補貨單據手動銷案確認"
      width="420px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="close-form-box" v-if="selectedCloseRow">
        <p><strong>補貨單號：</strong> <span class="text-orange">{{ selectedCloseRow.order_no }}</span></p>
        <p><strong>商品編號：</strong> <span class="text-blue">{{ selectedCloseRow.item_id }}</span></p>
        <p><strong>商品名稱：</strong> {{ selectedCloseRow.item_name }}</p>
        
        <div style="margin-top: 12px;">
          <label style="font-size: 13px; font-weight: bold; color: #cbd5e1;">銷案原因/備註說明：</label>
          <el-input
            type="textarea"
            v-model="closeRemark"
            placeholder="請輸入手動銷案原因（例：現場手動補完 / 系統重複開單）"
            rows="3"
            style="margin-top: 6px;"
          />
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showCloseModal = false">取消</el-button>
          <el-button type="danger" size="small" :loading="isClosing" @click="confirmCloseOrder">
            確認完成銷案
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 檔案上傳進度 Modal -->
    <el-dialog
      v-model="showUploadProgressModal"
      title="⚡ 正在寫入與覆蓋更新體補貨單資料..."
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
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

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
      loadingYearly: false,
      loadingPending: false,
      
      targetDate: new Date().toISOString().split('T')[0],
      targetMonth: new Date().toISOString().slice(0, 7),
      targetYear: new Date().getFullYear().toString(),
      pendingDateRange: [new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0]],
      
      docTypeOptions: ['已售出立即補貨單', '緊急調撥單', '定期補貨單'],
      selectedDocTypes: ['all'],

      reasonOptions: ['系統補開', '高棧板商品備貨', '彙整列印新單', '預購回填'],
      selectedReasons: ['all'],

      hourlyStats: [],
      monthlyDailyList: [],
      yearlyMonthlyList: [],
      pendingList: [],

      showCloseModal: false,
      selectedCloseRow: null,
      closeRemark: '現場已手動補完銷案',
      isClosing: false,

      isDraggingOver: false,
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
      const tot = { genOrderCount: 0, genPcs: 0, pendingOrderCount: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.hourlyStats.forEach(h => {
        tot.genOrderCount += h.genOrderCount || 0;
        tot.genPcs += h.genPcs || 0;
        tot.pendingOrderCount += h.pendingOrderCount || 0;
        tot.finOrderCount += h.finOrderCount || 0;
        tot.finPcs += h.finPcs || 0;
        tot.delOrderCount += h.delOrderCount || 0;
      });
      return tot;
    },
    monthlySummaryTotal() {
      const tot = { genOrderCount: 0, genPcs: 0, cohortFinOrderCount: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.monthlyDailyList.forEach(d => {
        tot.genOrderCount += d.genOrderCount || 0;
        tot.genPcs += d.genPcs || 0;
        tot.cohortFinOrderCount += d.cohortFinOrderCount || 0;
        tot.finOrderCount += d.finOrderCount || 0;
        tot.finPcs += d.finPcs || 0;
        tot.delOrderCount += d.delOrderCount || 0;
      });
      const finishRate = tot.genOrderCount > 0 ? ((tot.cohortFinOrderCount / tot.genOrderCount) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, finishRate };
    },
    yearlySummaryTotal() {
      const tot = { genOrderCount: 0, genPcs: 0, cohortFinOrderCount: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.yearlyMonthlyList.forEach(m => {
        tot.genOrderCount += m.genOrderCount || 0;
        tot.genPcs += m.genPcs || 0;
        tot.cohortFinOrderCount += m.cohortFinOrderCount || 0;
        tot.finOrderCount += m.finOrderCount || 0;
        tot.finPcs += m.finPcs || 0;
        tot.delOrderCount += m.delOrderCount || 0;
      });
      const finishRate = tot.genOrderCount > 0 ? ((tot.cohortFinOrderCount / tot.genOrderCount) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, finishRate };
    }
  },
  mounted() {
    this.fetchFishData();

    // 🌟 1. 全域攔截：避免拖曳釋放點落在元件之外引發瀏覽器預設開啟/下載行為
    window.addEventListener('dragover', this.preventGlobalDrop);
    window.addEventListener('drop', this.preventGlobalDrop);
  },
  beforeUnmount() {
    window.removeEventListener('dragover', this.preventGlobalDrop);
    window.removeEventListener('drop', this.preventGlobalDrop);
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

    // 🌟 全域防護方法
    preventGlobalDrop(e) {
      e.preventDefault();
    },

    onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingOver = true;
    },
    onDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingOver = false;
    },
    handleFileDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingOver = false;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.processImportFile(files[0]);
      }
    },

    handleDocTypeChange(vals) {
      if (vals.includes('all')) {
        if (vals[vals.length - 1] === 'all') {
          this.selectedDocTypes = ['all'];
        } else {
          this.selectedDocTypes = vals.filter(v => v !== 'all');
        }
      } else if (vals.length === 0) {
        this.selectedDocTypes = ['all'];
      }

      this.refreshCurrentMode();
    },

    handleReasonChange(vals) {
      if (vals.includes('all')) {
        if (vals[vals.length - 1] === 'all') {
          this.selectedReasons = ['all'];
        } else {
          this.selectedReasons = vals.filter(v => v !== 'all');
        }
      } else if (vals.length === 0) {
        this.selectedReasons = ['all'];
      }

      this.refreshCurrentMode();
    },

    handleAnalysisModeChange(mode) {
      this.refreshCurrentMode();
    },

    async refreshCurrentMode() {
      if (this.analysisMode === 'daily') await this.fetchFishData();
      else if (this.analysisMode === 'monthly') await this.fetchMonthlySummary();
      else if (this.analysisMode === 'yearly') await this.fetchYearlySummary();
      else if (this.analysisMode === 'pending') await this.fetchPendingDetails();
    },

    async refreshAllData() {
      await this.refreshCurrentMode();
      ElMessage.success('🎉 資料已成功重新整理！');
    },

    triggerSelectCsv() {
      if (this.$refs.csvFileInput) this.$refs.csvFileInput.click();
    },

    handleCsvFileSelected(event) {
      const file = event.target.files[0];
      if (file) {
        this.processImportFile(file);
      }
    },

    async processImportFile(file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
        return ElMessage.error('請上傳 .xls, .xlsx 或 .csv 格式的補貨單檔案！');
      }

      this.isUploading = true;
      this.showUploadProgressModal = true;
      this.uploadingFileName = file.name;
      this.uploadPercent = 0;
      this.uploadedRows = 0;
      this.totalRowsToUpload = 0;

      try {
        let rawData = [];

        if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        } else {
          const text = await file.text();
          const results = Papa.parse(text, { header: true, skipEmptyLines: true });
          rawData = results.data || [];
        }

        if (!rawData || rawData.length === 0) {
          this.resetUploadState();
          return ElMessage.error('檔案內無有效資料！');
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

        ElMessage.success(`🎉 成功直接寫入與更新 ${this.totalRowsToUpload.toLocaleString()} 筆立即補貨單資料！`);
        this.refreshAllData();
        this.resetUploadState();
      } catch (e) {
        ElMessage.error('解析或處理失敗：' + e.message);
        this.resetUploadState();
      }
    },

    resetUploadState() {
      this.isUploading = false;
      this.showUploadProgressModal = false;
      if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
    },

    openCloseDialog(row) {
      this.selectedCloseRow = row;
      this.closeRemark = '現場已手動補完銷案';
      this.showCloseModal = true;
    },

    async confirmCloseOrder() {
      if (!this.selectedCloseRow) return;

      this.isClosing = true;
      try {
        const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '主管銷案';

        const res = await axios.post('/api/replenish/close-order', {
          orderNo: this.selectedCloseRow.order_no,
          itemId: this.selectedCloseRow.item_id,
          closeUser: username,
          closeRemark: this.closeRemark
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message || '補貨單成功銷案！');
          this.showCloseModal = false;
          this.fetchPendingDetails();
        } else {
          ElMessage.error('銷案失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (e) {
        ElMessage.error('銷案處理失敗：' + e.message);
      } finally {
        this.isClosing = false;
      }
    },

    async fetchFishData() {
      this.loading = true;
      try {
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');

        const res = await axios.get('/api/replenish/fish-analysis', {
          params: {
            targetDate: this.targetDate,
            docTypes: activeDocTypes,
            reasons: activeReasons
          }
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
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');

        const res = await axios.get('/api/replenish/monthly-summary', {
          params: {
            month: this.targetMonth,
            docTypes: activeDocTypes,
            reasons: activeReasons
          }
        });
        if (res.data?.success) {
          this.monthlyDailyList = res.data.dailyList || [];
        }
      } catch (e) {
        ElMessage.error('載入每月總表失敗：' + e.message);
      } finally {
        this.loadingMonthly = false;
      }
    },

    async fetchYearlySummary() {
      this.loadingYearly = true;
      try {
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');

        const res = await axios.get('/api/replenish/yearly-summary', {
          params: {
            year: this.targetYear,
            docTypes: activeDocTypes,
            reasons: activeReasons
          }
        });
        if (res.data?.success) {
          this.yearlyMonthlyList = res.data.monthlyList || [];
        }
      } catch (e) {
        ElMessage.error('載入年度總表失敗：' + e.message);
      } finally {
        this.loadingYearly = false;
      }
    },

    async fetchPendingDetails() {
      this.loadingPending = true;
      try {
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');
        const start = this.pendingDateRange ? this.pendingDateRange[0] : '';
        const end = this.pendingDateRange ? this.pendingDateRange[1] : '';

        const res = await axios.get('/api/replenish/pending-details', {
          params: {
            startDate: start,
            endDate: end,
            docTypes: activeDocTypes,
            reasons: activeReasons
          }
        });
        if (res.data?.success) {
          this.pendingList = res.data.pendingList || [];
        }
      } catch (e) {
        ElMessage.error('載入未完成明細失敗：' + e.message);
      } finally {
        this.loadingPending = false;
      }
    }
  }
}
</script>

<style scoped>
.replenish-fish-page {
  position: relative;
  padding: 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.drag-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.85);
  border: 3px dashed #38bdf8;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
}

.drag-tip-box {
  text-align: center;
  color: #38bdf8;
  background: #1e293b;
  padding: 30px 50px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #1e293b;
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
}

.filter-item-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-group, .action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title {
  font-size: 16px;
  font-weight: bold;
  color: #38bdf8;
  white-space: nowrap;
}

.select-label {
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
  white-space: nowrap;
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

.alert-sheet-title {
  background: #f87171 !important;
  color: #ffffff !important;
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
.group-red-header th { background: #991b1b; color: #fecaca; }
.col-ratio-header { background: #854d0e; color: #fef08a; }
.col-pending-header { background: #991b1b; color: #fecaca; }

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
.text-red { color: #f87171; }
.font-bold { font-weight: bold; }

.close-form-box p {
  margin: 6px 0;
  font-size: 13px;
  color: #f8fafc;
}
</style>