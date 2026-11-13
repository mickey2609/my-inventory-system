<!-- frontend/src/views/WmsFishScreenshot.vue -->
<template>
  <div class="wms-fish-page dark-bg" @paste="handleGlobalPaste">
    <!-- 隱藏圖片選擇器 -->
    <input
      type="file"
      ref="imgInput"
      style="display: none;"
      accept="image/png, image/jpeg, image/webp"
      @change="handleFileSelect"
    />

    <!-- 1. 頂部工具列 -->
    <div class="top-toolbar">
      <div class="left-group">
        <span class="page-title">📸 WMS 魚群出沒時間截圖分析</span>

        <div class="filter-box">
          <span class="lbl">📅 查詢日期：</span>
          <el-select v-model="selectedDate" size="mini" style="width: 145px;" @change="fetchAnalysisData" placeholder="選擇日期">
            <el-option v-for="d in uniqueDates" :key="d" :label="d" :value="d" />
          </el-select>
        </div>

        <div class="filter-box">
          <span class="lbl">🏢 庫別：</span>
          <el-select v-model="selectedWh" size="mini" style="width: 105px;" @change="fetchAnalysisData">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in uniqueWhs" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-box">
          <span class="lbl">📊 觀察指標：</span>
          <el-radio-group v-model="metricMode" size="mini" @change="renderCompareChart">
            <el-radio-button label="order_count">📋 筆數</el-radio-button>
            <el-radio-button label="pcs_count">📦 PCS數</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div class="right-group">
        <el-button size="mini" type="info" icon="el-icon-refresh" @click="initLoad">重新整理</el-button>

        <template v-if="checkAdmin">
          <el-button size="mini" :type="hasApiKey ? 'info' : 'warning'" plain @click="showKeyModal = true">
            🔑 {{ hasApiKey ? `API Key (${maskedKey})` : '設定 Gemini API Key' }}
          </el-button>

          <el-button size="mini" type="success" icon="el-icon-camera" @click="openPasteModal">
            📋 貼上截圖辨識 (Ctrl+V)
          </el-button>
        </template>
      </div>
    </div>

    <!-- 2. 主內容滾動區 -->
    <div class="main-scroll">
      <!-- 類別彙總卡片（轉單時間 / 完成撿貨 / 完成出貨） -->
      <div class="summary-cards-row">
        <div
          v-for="cat in ['轉單時間', '完成撿貨', '完成出貨']"
          :key="cat"
          class="cat-card"
          :class="getCatCardClass(cat)"
        >
          <div class="cat-head">
            <span class="cat-name">{{ getCatIcon(cat) }} {{ cat }}</span>
            <span class="cat-tag">{{ getCategoryRecordInfo(cat) }}</span>
          </div>
          <div class="cat-metrics">
            <div class="m-item">
              <span class="m-lbl">總筆數</span>
              <span class="m-val text-yellow">{{ formatNumber(getCategoryTotals(cat).orders) }}</span>
            </div>
            <div class="m-item">
              <span class="m-lbl">總 PCS 數</span>
              <span class="m-val text-blue">{{ formatNumber(getCategoryTotals(cat).pcs) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 多類別 24 小時波浪對比圖 -->
      <div class="chart-panel" v-loading="loadingChart">
        <div class="panel-header">
          <span class="panel-title">🌊 {{ selectedDate || '尚未選取日期' }} — 24 小時魚群出沒波浪對比（轉單 ➔ 撿貨 ➔ 出貨）</span>
          <span class="panel-tip" v-if="checkAdmin">💡 提示：直接按 <strong>Ctrl + V</strong> 貼上 WMS 截圖即可自動辨識新增</span>
        </div>
        <div ref="compareChart" class="echart-box"></div>
      </div>

      <!-- 24 小時明細對照表 -->
      <div class="table-panel" v-loading="loadingChart">
        <div class="panel-header">
          <span class="panel-title">📊 24 小時各時段（00~01 至 23~24）筆數與 PCS 明細對照表</span>
        </div>
        <div class="table-wrapper">
          <table class="wms-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 95px;">時間區間</th>
                <th colspan="2" class="th-blue">🔵 轉單時間</th>
                <th colspan="2" class="th-orange">🟠 完成撿貨</th>
                <th colspan="2" class="th-green">🟢 完成出貨</th>
              </tr>
              <tr>
                <th>筆數</th>
                <th>PCS數</th>
                <th>筆數</th>
                <th>PCS數</th>
                <th>筆數</th>
                <th>PCS數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in hourlyCompareTable" :key="h.hour_index" :class="{ 'zebra': h.hour_index % 2 === 1 }">
                <td class="text-center font-bold">{{ h.hour_slot }}</td>
                <td class="text-right">{{ formatNumber(h.order_orders) }}</td>
                <td class="text-right text-blue">{{ formatNumber(h.order_pcs) }}</td>
                <td class="text-right">{{ formatNumber(h.pick_orders) }}</td>
                <td class="text-right text-orange">{{ formatNumber(h.pick_pcs) }}</td>
                <td class="text-right">{{ formatNumber(h.ship_orders) }}</td>
                <td class="text-right text-green">{{ formatNumber(h.ship_pcs) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="sum-row">
                <td class="text-center font-bold text-yellow">全天總計</td>
                <td class="text-right font-bold">{{ formatNumber(getCategoryTotals('轉單時間').orders) }}</td>
                <td class="text-right font-bold text-blue">{{ formatNumber(getCategoryTotals('轉單時間').pcs) }}</td>
                <td class="text-right font-bold">{{ formatNumber(getCategoryTotals('完成撿貨').orders) }}</td>
                <td class="text-right font-bold text-orange">{{ formatNumber(getCategoryTotals('完成撿貨').pcs) }}</td>
                <td class="text-right font-bold">{{ formatNumber(getCategoryTotals('完成出貨').orders) }}</td>
                <td class="text-right font-bold text-green">{{ formatNumber(getCategoryTotals('完成出貨').pcs) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- 已匯入的截圖歷史紀錄清單 -->
      <div class="table-panel">
        <div class="panel-header">
          <span class="panel-title">🗂️ 已辨識入庫之截圖批次紀錄（共 {{ batchList.length }} 筆）</span>
        </div>
        <div class="table-wrapper" style="max-height: 280px;">
          <table class="wms-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>庫別</th>
                <th>類別</th>
                <th>配送區域</th>
                <th>需24H到貨</th>
                <th>勾選之出貨類別</th>
                <th>總筆數</th>
                <th>總PCS數</th>
                <th>更新時間</th>
                <th v-if="checkAdmin">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="batchList.length === 0">
                <td :colspan="checkAdmin ? 10 : 9" class="text-center text-dim" style="padding: 20px;">尚無已辨識之截圖紀錄</td>
              </tr>
              <tr v-for="(b, i) in batchList" :key="i" @click="selectBatchRow(b)" style="cursor: pointer;">
                <td class="text-center font-bold">{{ b.stat_date }}</td>
                <td class="text-center text-yellow font-bold">{{ b.wh_code }} 庫</td>
                <td class="text-center font-bold">{{ b.category }}</td>
                <td class="text-center">{{ b.region }}</td>
                <td class="text-center">{{ b.is_24h }}</td>
                <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis;" :title="b.ship_types">{{ b.ship_types }}</td>
                <td class="text-right font-bold">{{ formatNumber(b.total_orders) }}</td>
                <td class="text-right text-blue font-bold">{{ formatNumber(b.total_pcs) }}</td>
                <td class="text-center text-dim">{{ b.updated_at }}</td>
                <td v-if="checkAdmin" class="text-center" @click.stop>
                  <el-button size="mini" type="danger" plain @click="deleteBatch(b)">刪除</el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. 貼上截圖 & AI 辨識預覽確認彈窗 -->
    <el-dialog
      v-model="showPreviewModal"
      title="🤖 WMS 魚群截圖 AI 視覺辨識與核對確認"
      width="92%"
      top="3vh"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="preview-split-layout" v-loading="recognizing" element-loading-text="🧠 Gemini 視覺 AI 正在高速解析截圖條件與 24 小時數據...">
        <!-- 左側：截圖貼上區 / 原圖預覽 -->
        <div class="preview-left-img">
          <div
            class="paste-drop-zone"
            @dragover.prevent
            @drop.prevent="handleImageDrop"
            @click="$refs.imgInput.click()"
          >
            <img v-if="previewImageUrl" :src="previewImageUrl" class="uploaded-preview-img" />
            <div v-else class="paste-placeholder">
              <div style="font-size: 46px;">📋</div>
              <div class="p-main">請直接按 <strong>Ctrl + V</strong> 貼上 WMS 截圖</div>
              <div class="p-sub">或點擊此處選擇圖片 / 將截圖拖曳至此</div>
            </div>
          </div>
          <div class="img-actions" v-if="previewImageUrl">
            <el-button size="mini" type="primary" plain @click="$refs.imgInput.click()">重新選圖</el-button>
            <el-button size="mini" type="warning" plain @click="runAiRecognition">🔄 重新 AI 辨識</el-button>
          </div>
        </div>

        <!-- 右側：辨識出的條件與 24 小時可編輯核對表 -->
        <div class="preview-right-form">
          <div class="meta-form-card">
            <div class="meta-title">1️⃣ 條件參數核對（可手動微調修正）</div>
            <div class="meta-grid">
              <div class="m-field">
                <label>日期：</label>
                <el-date-picker v-model="formParsed.date" type="date" size="mini" value-format="YYYY-MM-DD" style="width: 135px;" />
              </div>
              <div class="m-field">
                <label>類別：</label>
                <el-select v-model="formParsed.category" size="mini" allow-create filterable style="width: 130px;">
                  <el-option label="轉單時間" value="轉單時間" />
                  <el-option label="完成撿貨" value="完成撿貨" />
                  <el-option label="完成出貨" value="完成出貨" />
                </el-select>
              </div>
              <div class="m-field">
                <label>庫別：</label>
                <el-input v-model="formParsed.wh_code" size="mini" style="width: 80px;" />
              </div>
              <div class="m-field">
                <label>配送區域：</label>
                <el-input v-model="formParsed.region" size="mini" style="width: 100px;" />
              </div>
              <div class="m-field">
                <label>需24H到貨：</label>
                <el-input v-model="formParsed.is_24h" size="mini" style="width: 85px;" />
              </div>
            </div>

            <div class="ship-types-box">
              <div class="st-header">
                <span>☑️ 已勾選之出貨類別（{{ formParsed.ship_types.length }} / {{ allShipTypesOptions.length }} 項）：</span>
                <el-button size="mini" type="text" @click="toggleAllShipTypes">
                  {{ formParsed.ship_types.length === allShipTypesOptions.length ? '全部取消' : '全選全部' }}
                </el-button>
              </div>
              <el-checkbox-group v-model="formParsed.ship_types" size="mini" class="st-checkbox-grid">
                <el-checkbox v-for="st in allShipTypesOptions" :key="st" :label="st">{{ st }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </div>

          <div class="hourly-edit-card">
            <div class="meta-title" style="display: flex; justify-content: space-between;">
              <span>2️⃣ 24 小時時段數據核對（點擊數字可直接修改）</span>
              <span class="text-yellow">
                合計：<strong>{{ formatNumber(parsedTotalOrders) }}</strong> 筆 / <strong>{{ formatNumber(parsedTotalPcs) }}</strong> PCS
              </span>
            </div>
            <div class="edit-table-scroll">
              <table class="wms-table compact-table">
                <thead>
                  <tr>
                    <th style="width: 90px;">時間區間</th>
                    <th>筆數</th>
                    <th>PCS數</th>
                    <th style="width: 90px;">時間區間</th>
                    <th>筆數</th>
                    <th>PCS數</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in 12" :key="r">
                    <!-- 左半邊 00~11 -->
                    <td class="text-center font-bold">{{ formParsed.hourly[r - 1].hour_slot }}</td>
                    <td><input type="number" v-model.number="formParsed.hourly[r - 1].order_count" class="num-input" /></td>
                    <td><input type="number" v-model.number="formParsed.hourly[r - 1].pcs_count" class="num-input text-blue" /></td>
                    <!-- 右半邊 12~23 -->
                    <td class="text-center font-bold">{{ formParsed.hourly[r + 11].hour_slot }}</td>
                    <td><input type="number" v-model.number="formParsed.hourly[r + 11].order_count" class="num-input" /></td>
                    <td><input type="number" v-model.number="formParsed.hourly[r + 11].pcs_count" class="num-input text-blue" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="showPreviewModal = false">取消</el-button>
        <el-button type="success" size="small" :loading="savingData" :disabled="!previewImageUrl" @click="saveParsedData">
          ✅ 確認數據無誤，寫入資料庫
        </el-button>
      </template>
    </el-dialog>

    <!-- 4. 設定 Gemini API Key 彈窗 -->
    <el-dialog v-model="showKeyModal" title="🔑 設定 Google Gemini Vision API Key" width="460px" append-to-body custom-class="dark-dialog">
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #cbd5e1;">
        <p style="margin: 0;">地端伺服器將直接透過 HTTPS 呼叫 Gemini 2.5 Flash 視覺模型辨識截圖（資料僅存於您地端 SQLite）。</p>
        <el-input v-model="inputApiKey" placeholder="請貼上 AIzaSy 開頭的 Gemini API Key" show-password />
      </div>
      <template #footer>
        <el-button size="small" @click="showKeyModal = false">取消</el-button>
        <el-button type="primary" size="small" @click="saveGeminiKey">儲存金鑰</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'

const ALL_SHIP_TYPES = [
  '當日配、貨到付款、郵箱',
  '大材積、大材積 (貨到付款)',
  '安裝',
  '海外',
  '超商(7-11)',
  '超商(全家)',
  '超大',
  'OK超取',
  '萊爾富超取',
  '超速配'
];

function createEmptyHourly() {
  return Array.from({ length: 24 }, (_, idx) => ({
    hour_index: idx,
    hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
    order_count: 0,
    pcs_count: 0
  }));
}

export default {
  name: 'WmsFishScreenshot',
  props: {
    isSysAdmin: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loadingChart: false,
      batchList: [],
      analysisRows: [],
      selectedDate: '',
      selectedWh: 'all',
      metricMode: 'order_count',
      chartInstance: null,

      hasApiKey: false,
      maskedKey: '',
      showKeyModal: false,
      inputApiKey: '',

      showPreviewModal: false,
      previewImageUrl: '',
      recognizing: false,
      savingData: false,
      allShipTypesOptions: [...ALL_SHIP_TYPES],
      formParsed: {
        date: new Date().toISOString().split('T')[0],
        category: '轉單時間',
        wh_code: '15',
        order_type: '揀貨單號',
        region: '全部',
        ship_types: [...ALL_SHIP_TYPES],
        is_24h: '全部',
        hourly: createEmptyHourly()
      }
    }
  },
  computed: {
    checkAdmin() {
      if (this.isSysAdmin || this.isAdmin) return true;
      try {
        const s = JSON.parse(localStorage.getItem('auth_session') || '{}');
        if (s.role === 'guest' || s.username === 'guest') return false;
        if (s.username === 'admin' || s.role === 'sys_admin' || s.role === 'admin') return true;
      } catch (e) {}
      const u = localStorage.getItem('currentUser') || localStorage.getItem('username') || '';
      return u === 'admin' || u === '系統管理員';
    },
    uniqueDates() {
      return [...new Set(this.batchList.map(b => b.stat_date))];
    },
    uniqueWhs() {
      return [...new Set(this.batchList.map(b => b.wh_code))].filter(Boolean);
    },
    hourlyCompareTable() {
      const table = Array.from({ length: 24 }, (_, idx) => ({
        hour_index: idx,
        hour_slot: `${String(idx).padStart(2, '0')}~${String(idx + 1).padStart(2, '0')}`,
        order_orders: 0, order_pcs: 0,
        pick_orders: 0, pick_pcs: 0,
        ship_orders: 0, ship_pcs: 0
      }));

      this.analysisRows.forEach(r => {
        const idx = r.hour_index;
        if (idx < 0 || idx >= 24) return;
        if (r.category === '轉單時間') {
          table[idx].order_orders += r.order_count || 0;
          table[idx].order_pcs += r.pcs_count || 0;
        } else if (r.category === '完成撿貨') {
          table[idx].pick_orders += r.order_count || 0;
          table[idx].pick_pcs += r.pcs_count || 0;
        } else if (r.category === '完成出貨') {
          table[idx].ship_orders += r.order_count || 0;
          table[idx].ship_pcs += r.pcs_count || 0;
        }
      });
      return table;
    },
    parsedTotalOrders() {
      return this.formParsed.hourly.reduce((acc, h) => acc + (Number(h.order_count) || 0), 0);
    },
    parsedTotalPcs() {
      return this.formParsed.hourly.reduce((acc, h) => acc + (Number(h.pcs_count) || 0), 0);
    }
  },
  mounted() {
    this.initLoad();
    window.addEventListener('paste', this.handleGlobalPaste);
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('paste', this.handleGlobalPaste);
    window.removeEventListener('resize', this.handleResize);
    if (this.chartInstance) this.chartInstance.dispose();
  },
  methods: {
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    handleResize() { if (this.chartInstance) this.chartInstance.resize(); },
    getCatIcon(cat) {
      if (cat === '轉單時間') return '🔵';
      if (cat === '完成撿貨') return '🟠';
      return '🟢';
    },
    getCatCardClass(cat) {
      if (cat === '轉單時間') return 'border-blue';
      if (cat === '完成撿貨') return 'border-orange';
      return 'border-green';
    },
    getCategoryTotals(cat) {
      const rows = this.analysisRows.filter(r => r.category === cat);
      return rows.reduce((acc, r) => {
        acc.orders += r.order_count || 0;
        acc.pcs += r.pcs_count || 0;
        return acc;
      }, { orders: 0, pcs: 0 });
    },
    getCategoryRecordInfo(cat) {
      const match = this.batchList.find(b => b.stat_date === this.selectedDate && b.category === cat && (this.selectedWh === 'all' || b.wh_code === this.selectedWh));
      return match ? `${match.wh_code}庫 | ${match.region}` : '尚未匯入';
    },

    async initLoad() {
      if (this.checkAdmin) this.checkApiKeyStatus();
      await this.fetchBatches();
      if (!this.selectedDate && this.uniqueDates.length > 0) {
        this.selectedDate = this.uniqueDates[0];
      }
      await this.fetchAnalysisData();
    },

    async checkApiKeyStatus() {
      try {
        const res = await axios.get('/api/wms-fish-screenshot/key-status');
        if (res.data?.success) {
          this.hasApiKey = res.data.hasKey;
          this.maskedKey = res.data.maskedKey;
        }
      } catch (e) {}
    },
    async saveGeminiKey() {
      if (!this.inputApiKey.trim()) return ElMessage.warning('請輸入 API Key');
      try {
        const res = await axios.post('/api/wms-fish-screenshot/save-key', { apiKey: this.inputApiKey.trim() });
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.showKeyModal = false;
          this.inputApiKey = '';
          this.checkApiKeyStatus();
        }
      } catch (e) {
        ElMessage.error(e.response?.data?.message || e.message);
      }
    },

    async fetchBatches() {
      try {
        const res = await axios.get('/api/wms-fish-screenshot/batches');
        if (res.data?.success) this.batchList = res.data.list || [];
      } catch (e) {}
    },
    async fetchAnalysisData() {
      if (!this.selectedDate) {
        this.analysisRows = [];
        this.renderCompareChart();
        return;
      }
      this.loadingChart = true;
      try {
        const res = await axios.get('/api/wms-fish-screenshot/analysis', {
          params: { statDate: this.selectedDate, whCode: this.selectedWh }
        });
        if (res.data?.success) {
          this.analysisRows = res.data.rows || [];
          this.$nextTick(() => this.renderCompareChart());
        }
      } finally {
        this.loadingChart = false;
      }
    },
    selectBatchRow(b) {
      this.selectedDate = b.stat_date;
      this.selectedWh = b.wh_code;
      this.fetchAnalysisData();
    },
    async deleteBatch(b) {
      try {
        await ElMessageBox.confirm(`確定刪除【${b.stat_date} / ${b.wh_code}庫 / ${b.category}】的紀錄？`, '刪除確認', { type: 'warning' });
        const res = await axios.post('/api/wms-fish-screenshot/delete-batch', b);
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          await this.initLoad();
        }
      } catch (e) {}
    },

    renderCompareChart() {
      if (!this.$refs.compareChart) return;
      if (!this.chartInstance) {
        this.chartInstance = echarts.init(this.$refs.compareChart);
      }
      const xLabels = this.hourlyCompareTable.map(h => h.hour_slot);
      const isPcs = this.metricMode === 'pcs_count';

      const orderSeries = this.hourlyCompareTable.map(h => isPcs ? h.order_pcs : h.order_orders);
      const pickSeries = this.hourlyCompareTable.map(h => isPcs ? h.pick_pcs : h.pick_orders);
      const shipSeries = this.hourlyCompareTable.map(h => isPcs ? h.ship_pcs : h.ship_orders);

      const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { data: ['轉單時間', '完成撿貨', '完成出貨'], textStyle: { color: '#cbd5e1' }, top: 0 },
        grid: { top: '12%', left: '3%', right: '3%', bottom: '8%', containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xLabels,
          axisLabel: { color: '#cbd5e1', fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          name: isPcs ? 'PCS 數' : '單據筆數',
          nameTextStyle: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
          axisLabel: { color: '#94a3b8' }
        },
        series: [
          {
            name: '轉單時間', type: 'line', smooth: true,
            lineStyle: { width: 3, color: '#38bdf8' }, itemStyle: { color: '#38bdf8' },
            areaStyle: { color: 'rgba(56, 189, 248, 0.15)' },
            data: orderSeries
          },
          {
            name: '完成撿貨', type: 'line', smooth: true,
            lineStyle: { width: 3, color: '#fb923c' }, itemStyle: { color: '#fb923c' },
            areaStyle: { color: 'rgba(251, 146, 60, 0.15)' },
            data: pickSeries
          },
          {
            name: '完成出貨', type: 'line', smooth: true,
            lineStyle: { width: 3, color: '#4ade80' }, itemStyle: { color: '#4ade80' },
            areaStyle: { color: 'rgba(74, 222, 128, 0.15)' },
            data: shipSeries
          }
        ]
      };
      this.chartInstance.setOption(option, true);
      this.chartInstance.resize();
    },

    // 貼上截圖處理邏輯
    openPasteModal() {
      this.previewImageUrl = '';
      this.formParsed.hourly = createEmptyHourly();
      this.showPreviewModal = true;
    },
    handleGlobalPaste(e) {
      if (!this.checkAdmin) return;
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            this.loadImageFile(file);
            break;
          }
        }
      }
    },
    handleFileSelect(e) {
      const file = e.target.files?.[0];
      if (file) this.loadImageFile(file);
      if (this.$refs.imgInput) this.$refs.imgInput.value = '';
    },
    handleImageDrop(e) {
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.loadImageFile(file);
      }
    },
    loadImageFile(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.previewImageUrl = ev.target.result;
        this.showPreviewModal = true;
        this.runAiRecognition();
      };
      reader.readAsDataURL(file);
    },
    toggleAllShipTypes() {
      if (this.formParsed.ship_types.length === this.allShipTypesOptions.length) {
        this.formParsed.ship_types = [];
      } else {
        this.formParsed.ship_types = [...this.allShipTypesOptions];
      }
    },

    async runAiRecognition() {
      if (!this.previewImageUrl) return;
      this.recognizing = true;
      try {
        const res = await axios.post('/api/wms-fish-screenshot/recognize', {
          imageBase64: this.previewImageUrl
        });
        if (res.data?.success && res.data.parsed) {
          this.formParsed = res.data.parsed;
          ElMessage.success('🎉 截圖 AI 辨識完成！請核對右側數據後點擊「確認寫入資料庫」');
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message;
        ElMessage.error(msg);
        if (e.response?.data?.needKey) {
          this.showKeyModal = true;
        }
      } finally {
        this.recognizing = false;
      }
    },

    async saveParsedData() {
      this.savingData = true;
      try {
        const username = localStorage.getItem('currentUser') || 'admin';
        const res = await axios.post('/api/wms-fish-screenshot/save', {
          ...this.formParsed,
          created_by: username
        });
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.showPreviewModal = false;
          this.selectedDate = this.formParsed.date;
          this.selectedWh = this.formParsed.wh_code;
          await this.fetchBatches();
          await this.fetchAnalysisData();
        }
      } catch (e) {
        ElMessage.error('寫入失敗：' + (e.response?.data?.message || e.message));
      } finally {
        this.savingData = false;
      }
    }
  }
}
</script>

<style scoped>
.wms-fish-page {
  padding: 14px 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #0b1120;
  overflow: hidden;
}

.top-toolbar {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.left-group, .right-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.page-title { font-size: 16px; font-weight: bold; color: #38bdf8; }
.filter-box { display: flex; align-items: center; gap: 6px; }
.filter-box .lbl { font-size: 12px; color: #cbd5e1; font-weight: bold; }

.main-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.summary-cards-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.cat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 16px;
}
.border-blue { border-top: 4px solid #38bdf8; }
.border-orange { border-top: 4px solid #fb923c; }
.border-green { border-top: 4px solid #4ade80; }

.cat-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cat-name { font-size: 15px; font-weight: bold; color: #f8fafc; }
.cat-tag { font-size: 11px; color: #94a3b8; background: #0f172a; padding: 2px 8px; border-radius: 4px; }
.cat-metrics { display: flex; gap: 24px; }
.m-item { display: flex; flex-direction: column; }
.m-lbl { font-size: 11px; color: #94a3b8; }
.m-val { font-size: 20px; font-weight: bold; }

.chart-panel, .table-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.panel-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.panel-tip { font-size: 12px; color: #38bdf8; }
.echart-box { width: 100%; height: 300px; }

.table-wrapper { overflow-x: auto; }
.wms-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #f8fafc;
  background: #0f172a;
}
.wms-table th, .wms-table td {
  border: 1px solid #334155;
  padding: 6px 8px;
}
.wms-table th { background: #1e293b; color: #cbd5e1; text-align: center; }
.th-blue { background: #1e3a8a !important; color: #bfdbfe !important; }
.th-orange { background: #7c2d12 !important; color: #fed7aa !important; }
.th-green { background: #14532d !important; color: #bbf7d0 !important; }
.zebra td { background: rgba(255, 255, 255, 0.02); }
.sum-row td { background: #1e293b !important; border-top: 2px solid #38bdf8; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-yellow { color: #facc15; }
.text-blue { color: #38bdf8; }
.text-orange { color: #fb923c; }
.text-green { color: #4ade80; }
.text-dim { color: #64748b; }
.font-bold { font-weight: bold; }

/* 預覽對照雙欄排版 */
.preview-split-layout {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 16px;
  min-height: 520px;
}
.preview-left-img {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.paste-drop-zone {
  flex: 1;
  background: #0f172a;
  border: 2px dashed #38bdf8;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  min-height: 460px;
}
.uploaded-preview-img {
  max-width: 100%;
  max-height: 540px;
  object-fit: contain;
}
.paste-placeholder {
  text-align: center;
  padding: 20px;
}
.p-main { font-size: 16px; color: #f8fafc; margin-top: 10px; }
.p-sub { font-size: 12px; color: #94a3b8; margin-top: 6px; }
.img-actions { display: flex; gap: 8px; justify-content: center; }

.preview-right-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.meta-form-card, .hourly-edit-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.meta-title {
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 10px;
}
.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.m-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #cbd5e1;
}
.ship-types-box {
  border-top: 1px dashed #334155;
  padding-top: 8px;
}
.st-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #facc15;
  margin-bottom: 6px;
}
.st-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.edit-table-scroll {
  max-height: 310px;
  overflow-y: auto;
}
.compact-table td, .compact-table th {
  padding: 4px 6px;
}
.num-input {
  width: 100%;
  box-sizing: border-box;
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  border-radius: 4px;
  padding: 2px 6px;
  text-align: right;
  font-size: 12px;
}
.num-input:focus {
  outline: none;
  border-color: #38bdf8;
}
</style>