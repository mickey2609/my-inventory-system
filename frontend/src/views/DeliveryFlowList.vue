<!-- frontend/src/views/DeliveryFlowList.vue -->
<template>
  <div class="delivery-flow-page dark-bg">
    <!-- 隱藏的檔案選擇器 -->
    <input
      type="file"
      ref="fileInput"
      style="display: none;"
      accept=".xls, .xlsx, .csv"
      @change="handleFileSelected"
    />

    <!-- 1. 頂部條件與導覽工具列 -->
    <div class="control-header-panel">
      <div class="filter-row">
        <!-- 出貨日期 -->
        <div class="filter-item">
          <span class="label">📅 出貨日期：</span>
          <el-select
            v-if="availableDates.length > 0"
            v-model="targetDate"
            size="small"
            style="width: 170px;"
            @change="fetchData"
          >
            <el-option
              v-for="d in availableDates"
              :key="d.ship_date"
              :label="`${d.ship_date} (${formatNumber(countMode === 'order' ? d.order_count : d.tracking_count)} ${countMode === 'order' ? '單' : '箱'})`"
              :value="d.ship_date"
            />
          </el-select>
          <el-date-picker
            v-else
            v-model="targetDate"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            placeholder="選擇出貨日期"
            style="width: 140px;"
            :clearable="false"
            @change="fetchData"
          />
        </div>

        <!-- 🌟 統計維度：訂單 vs 宅單切換 -->
        <div class="filter-item highlight-box">
          <span class="label text-yellow">📊 觀察維度：</span>
          <el-radio-group v-model="countMode" size="small" @change="fetchData">
            <el-radio-button label="tracking">📦 宅配單 ({{ formatNumber(totalTrackingCount) }} 箱)</el-radio-button>
            <el-radio-button label="order">📋 訂單 ({{ formatNumber(totalOrderCount) }} 單)</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 區域篩選器 -->
        <div class="filter-item">
          <span class="label">📍 區域：</span>
          <el-radio-group v-model="selectedRegion" size="small" @change="fetchData">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="北北基桃">北北基桃</el-radio-button>
            <el-radio-button label="中南部">中南部</el-radio-button>
            <el-radio-button label="宜花東">宜花東</el-radio-button>
            <el-radio-button label="外島">外島</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 班別篩選器 -->
        <div class="filter-item">
          <span class="label">⏰ 班別：</span>
          <el-radio-group v-model="selectedShift" size="small" @change="fetchData">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="日班">☀️ 日班</el-radio-button>
            <el-radio-button label="夜班">🌆 夜班</el-radio-button>
            <el-radio-button label="大夜班">🌙 大夜班</el-radio-button>
          </el-radio-group>
        </div>

        <div class="btn-group">
          <span class="total-badge">
            當前視角：<strong>{{ formatNumber(totalCount) }}</strong> {{ countMode === 'order' ? '單' : '箱' }}
          </span>
          <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="fetchData">重新整理</el-button>
          <el-button type="success" size="small" icon="el-icon-upload2" :loading="isUploading" @click="showUploadCard = true">📥 匯入 3BC1 / 出貨表</el-button>
        </div>
      </div>

      <!-- 2. 分頁切換頁籤 (Tab 切換模式) -->
      <div class="sub-tabs-bar">
        <button
          class="sub-tab-btn"
          :class="{ active: activeTab === 'river_flow' }"
          @click="activeTab = 'river_flow'"
        >
          🌊 出貨區域流線圖與魚群矩陣
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeTab === 'lead_time' }"
          @click="activeTab = 'lead_time'"
        >
          ⏱️ 班別出貨時段 × 接單時效觀察表
        </button>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 分頁 1：波浪流線圖 + 魚群矩陣表                          -->
    <!-- ======================================================== -->
    <div v-show="activeTab === 'river_flow'" class="tab-pane-content">
      <!-- 三班數據總覽指標卡 -->
      <div class="shift-cards-row">
        <div
          v-for="(info, shiftKey) in shiftSummary"
          :key="shiftKey"
          class="shift-card"
          :class="getShiftClass(shiftKey)"
          @click="openDetailModal({ shift: shiftKey, title: `${targetDate}【${shiftKey} (${info.timeSpan})】明細` })"
        >
          <div class="card-head">
            <span class="shift-name">{{ getShiftIcon(shiftKey) }} {{ shiftKey }}</span>
            <span class="shift-time">{{ info.timeSpan }}</span>
          </div>
          <div class="card-count">
            {{ formatNumber(info.count) }} 
            <span class="unit">{{ countMode === 'order' ? '單' : '箱' }}</span>
          </div>
          <div class="card-sub-bars">
            <div class="reg-chip chip-north">北北基桃: {{ formatNumber(info.regions['北北基桃'] || 0) }}</div>
            <div class="reg-chip chip-south">中南部: {{ formatNumber(info.regions['中南部'] || 0) }}</div>
            <div class="reg-chip chip-east">宜花東: {{ formatNumber(info.regions['宜花東'] || 0) }}</div>
            <div class="reg-chip chip-island">外島: {{ formatNumber(info.regions['外島'] || 0) }}</div>
          </div>
        </div>
      </div>

      <!-- 波浪流線圖 -->
      <div class="chart-container" v-loading="loading">
        <div class="chart-header">
          <span class="chart-title">📈 24 小時出貨四大區域魚群流線 (可點擊波浪點位穿透查看單據)</span>
          <div class="legend-tags">
            <span class="lg-dot dot-north">● 北北基桃</span>
            <span class="lg-dot dot-south">● 中南部</span>
            <span class="lg-dot dot-east">● 宜花東</span>
            <span class="lg-dot dot-island">● 外島</span>
          </div>
        </div>
        <div ref="flowChart" class="flow-echart"></div>
      </div>

      <!-- 魚群矩陣表 -->
      <div class="table-container" v-loading="loading">
        <div class="table-title">🐟 24 小時出貨魚群密度分佈 (依{{ countMode === 'order' ? '訂單數' : '宅配單/箱數' }}統計)</div>
        <div class="table-scroll-wrapper">
          <table class="flow-matrix-table">
            <thead>
              <tr>
                <th style="width: 85px;">出貨時段</th>
                <th style="width: 85px;">班別</th>
                <th>出貨密度圖形 (藍:北基桃 / 橘:中南 / 綠:花東 / 紫:外島)</th>
                <th style="width: 90px;">出貨數量</th>
                <th style="width: 95px;">北北基桃</th>
                <th style="width: 95px;">中南部</th>
                <th style="width: 80px;">宜花東</th>
                <th style="width: 70px;">外島</th>
                <th style="width: 75px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in filteredHourlyFlow" :key="h.hour" :class="{ 'row-zebra': h.hour % 2 === 1 }">
                <td class="text-center font-bold">{{ h.slot }}</td>
                <td class="text-center">
                  <span class="shift-badge" :class="getShiftClass(getHourShift(h.hour))">{{ getHourShift(h.hour) }}</span>
                </td>
                <td>
                  <div class="multi-bar-wrapper">
                    <div class="bar-seg seg-north" :style="{ width: getPctWidth(h['北北基桃'], h.total) }"></div>
                    <div class="bar-seg seg-south" :style="{ width: getPctWidth(h['中南部'], h.total) }"></div>
                    <div class="bar-seg seg-east" :style="{ width: getPctWidth(h['宜花東'], h.total) }"></div>
                    <div class="bar-seg seg-island" :style="{ width: getPctWidth(h['外島'], h.total) }"></div>
                  </div>
                </td>
                <td class="text-right font-bold text-yellow">{{ formatNumber(h.total) }}</td>
                <td class="text-right text-blue">{{ formatNumber(h['北北基桃']) }}</td>
                <td class="text-right text-orange">{{ formatNumber(h['中南部']) }}</td>
                <td class="text-right text-green">{{ formatNumber(h['宜花東']) }}</td>
                <td class="text-right text-purple">{{ formatNumber(h['外島']) }}</td>
                <td class="text-center">
                  <el-button size="mini" type="primary" plain @click="openDetailModal({ hour: h.hour, title: `${targetDate} ${h.slot} 時段明細` })">
                    穿透
                  </el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 分頁 2：各班別出貨時段 × 接單區間時效交叉表                -->
    <!-- ======================================================== -->
    <div v-show="activeTab === 'lead_time'" class="tab-pane-content" v-loading="loading">
      <div class="table-container">
        <div class="lead-time-header">
          <span class="table-title">⏱️ 出貨時段 vs 接單成立區間分析（縱向：出貨時間點 ➔ 橫向：當初幾點接的單）</span>
          <span class="tip-text">💡 點擊任何單元格數字，可立即穿透調閱該批單據明細</span>
        </div>

        <div class="table-scroll-wrapper">
          <table class="lead-time-table">
            <thead>
              <tr>
                <th class="sticky-col col-slot">出貨時段</th>
                <th class="sticky-col col-shift">班別</th>
                <th class="sticky-col col-total">總計({{ countMode === 'order' ? '單' : '箱' }})</th>
                <!-- 24 小時接單區間欄位 -->
                <th v-for="slot in allHourSlots" :key="slot" class="col-order-slot">
                  {{ slot }}<br><span class="sub-th">接單</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in leadTimeRows" :key="row.shipSlot">
                <td class="sticky-col col-slot font-bold text-center">{{ row.shipSlot }}</td>
                <td class="sticky-col col-shift text-center">
                  <span class="shift-badge" :class="getShiftClass(row.shift)">{{ row.shift }}</span>
                </td>
                <td class="sticky-col col-total text-right font-bold text-yellow copyable" @click="openDetailModal({ shipSlot: row.shipSlot, title: `${targetDate} 出貨時段 ${row.shipSlot} 全量明細` })">
                  {{ formatNumber(row.total) }}
                </td>
                <!-- 接單區間各格子 -->
                <td
                  v-for="slot in allHourSlots"
                  :key="slot"
                  class="text-right cell-number"
                  :class="{ 'cell-has-val': (row.orderSlots[slot] || 0) > 0 }"
                  @click="(row.orderSlots[slot] || 0) > 0 && openDetailModal({ shipSlot: row.shipSlot, orderSlot: slot, title: `${targetDate} 出貨[${row.shipSlot}] × 接單[${slot}] 明細` })"
                >
                  <span v-if="(row.orderSlots[slot] || 0) > 0">{{ formatNumber(row.orderSlots[slot]) }}</span>
                  <span v-else class="text-dim">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. 穿透單據明細 Dialog -->
    <el-dialog
      v-model="showDetailModal"
      :title="modalTitle"
      width="90%"
      top="4vh"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="dialog-body" v-loading="loadingDetails">
        <div class="dialog-summary-bar">
          <span>共調閱 <strong>{{ modalList.length }}</strong> 筆記錄 (最多展示前 3000 筆)</span>
          <el-input
            v-model="filterKeyword"
            size="mini"
            placeholder="搜尋單號 / 宅配商 / 收件人"
            style="width: 240px;"
            clearable
          />
        </div>

        <el-table :data="filteredModalList" height="520px" border size="mini" style="width: 100%;">
          <el-table-column prop="tracking_no" label="宅配單號" width="180" sortable>
            <template #default="scope">
              <span class="font-bold text-blue copyable" @click="copyText(scope.row.tracking_no)">{{ scope.row.tracking_no }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="order_no" label="訂單編號" width="160" sortable>
            <template #default="scope">
              <span class="font-bold text-orange copyable" @click="copyText(scope.row.order_no)">{{ scope.row.order_no }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="region" label="區域" width="95" align="center" sortable>
            <template #default="scope">
              <span class="reg-tag" :class="getRegTagClass(scope.row.region)">{{ scope.row.region }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="shift_type" label="班別" width="85" align="center" sortable />
          <el-table-column prop="ship_time" label="出貨時間" width="95" align="center" sortable />
          <el-table-column prop="order_time" label="接單時間" width="95" align="center" sortable />
          <el-table-column prop="order_interval" label="接單區間" width="95" align="center" sortable />
          <el-table-column prop="pick_time" label="開始揀貨" width="95" align="center" sortable />
          <el-table-column prop="print_time" label="印宅配單" width="95" align="center" sortable />
          <el-table-column prop="carrier_name" label="宅配商" width="120" sortable />
          <el-table-column prop="receiver_name" label="收件人" width="95" />
          <el-table-column prop="address" label="收件地址" min-width="220" show-overflow-tooltip />
        </el-table>
      </div>
    </el-dialog>

    <!-- 4. 拖曳上傳 Modal -->
    <el-dialog
      v-model="showUploadCard"
      title="📥 匯入宅配報表 (3BC1 / 出貨資訊80)"
      width="500px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div
        class="drop-card"
        :class="{ 'drop-card-active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <i class="el-icon-upload drop-icon"></i>
        <div class="drop-text-main">將 Excel 報表拖曳至此處</div>
        <div class="drop-text-sub">或點擊此處選取檔案</div>
        <div class="drop-tip">🛡️ 自動解析宅配單號與訂單編號，精準統計箱數與單數</div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import * as echarts from 'echarts'

export default {
  name: 'DeliveryFlowList',
  data() {
    return {
      activeTab: 'river_flow',
      countMode: 'tracking', // tracking(宅配單/箱數) 或 order(訂單數)
      loading: false,
      isUploading: false,
      targetDate: '',
      selectedRegion: 'all',
      selectedShift: 'all',
      availableDates: [],
      totalCount: 0,
      totalTrackingCount: 0,
      totalOrderCount: 0,

      shiftSummary: {
        '日班': { count: 0, timeSpan: '09:00 ~ 17:00', regions: {} },
        '夜班': { count: 0, timeSpan: '17:00 ~ 01:00', regions: {} },
        '大夜班': { count: 0, timeSpan: '01:00 ~ 09:00', regions: {} }
      },
      hourlyFlow: [],
      leadTimeMatrix: {},
      chartInstance: null,

      showDetailModal: false,
      modalTitle: '',
      modalList: [],
      filterKeyword: '',
      loadingDetails: false,

      showUploadCard: false,
      isDragging: false
    }
  },
  computed: {
    allHourSlots() {
      return Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}~${String((h + 1) % 24).padStart(2, '0')}`);
    },
    filteredHourlyFlow() {
      if (this.selectedShift === 'all') return this.hourlyFlow;
      return this.hourlyFlow.filter(h => this.getHourShift(h.hour) === this.selectedShift);
    },
    leadTimeRows() {
      const list = Object.values(this.leadTimeMatrix);
      list.sort((a, b) => a.shipSlot.localeCompare(b.shipSlot));
      if (this.selectedShift === 'all') return list;
      return list.filter(r => r.shift === this.selectedShift);
    },
    filteredModalList() {
      if (!this.filterKeyword.trim()) return this.modalList;
      const kw = this.filterKeyword.trim().toLowerCase();
      return this.modalList.filter(r => 
        (r.tracking_no && r.tracking_no.toLowerCase().includes(kw)) ||
        (r.order_no && r.order_no.toLowerCase().includes(kw)) ||
        (r.carrier_name && r.carrier_name.toLowerCase().includes(kw)) ||
        (r.receiver_name && r.receiver_name.toLowerCase().includes(kw))
      );
    }
  },
  watch: {
    activeTab(newTab) {
      if (newTab === 'river_flow') {
        this.$nextTick(() => {
          if (this.chartInstance) this.chartInstance.resize();
          else this.renderFlowChart();
        });
      }
    }
  },
  mounted() {
    this.fetchDates().then(() => {
      this.fetchData();
    });
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.chartInstance) this.chartInstance.dispose();
  },
  methods: {
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    getShiftClass(s) {
      if (s === '日班') return 'shift-day';
      if (s === '夜班') return 'shift-night';
      if (s === '大夜班') return 'shift-graveyard';
      return '';
    },
    getShiftIcon(s) {
      if (s === '日班') return '☀️';
      if (s === '夜班') return '🌆';
      return '🌙';
    },
    getHourShift(h) {
      if (h >= 9 && h < 17) return '日班';
      if (h >= 17 || h === 0) return '夜班';
      return '大夜班';
    },
    getPctWidth(val, tot) {
      if (!tot || !val) return '0%';
      return ((val / tot) * 100).toFixed(1) + '%';
    },
    getRegTagClass(r) {
      if (r === '北北基桃') return 'tag-north';
      if (r === '中南部') return 'tag-south';
      if (r === '宜花東') return 'tag-east';
      if (r === '外島') return 'tag-island';
      return '';
    },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    handleResize() {
      if (this.chartInstance) this.chartInstance.resize();
    },

    async fetchDates() {
      try {
        const res = await axios.get('/api/delivery/dates');
        if (res.data?.success && res.data.list?.length > 0) {
          this.availableDates = res.data.list;
          if (!this.targetDate) {
            this.targetDate = this.availableDates[0].ship_date;
          }
        }
      } catch (e) {}
    },

    async fetchData() {
      this.loading = true;
      try {
        const res = await axios.get('/api/delivery/flow-analysis', {
          params: {
            targetDate: this.targetDate,
            region: this.selectedRegion,
            shift: this.selectedShift,
            countMode: this.countMode
          }
        });
        if (res.data?.success) {
          this.targetDate = res.data.targetDate || this.targetDate;
          this.totalCount = res.data.totalCount;
          this.totalTrackingCount = res.data.totalTrackingCount;
          this.totalOrderCount = res.data.totalOrderCount;
          this.shiftSummary = res.data.shiftSummary;
          this.hourlyFlow = res.data.hourlyFlow;
          this.leadTimeMatrix = res.data.leadTimeMatrix || {};
          this.$nextTick(() => { this.renderFlowChart(); });
        }
      } catch (e) {
        ElMessage.error('取得宅配出貨分析失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    renderFlowChart() {
      if (!this.$refs.flowChart) return;
      if (!this.chartInstance) {
        this.chartInstance = echarts.init(this.$refs.flowChart);
        this.chartInstance.on('click', (params) => {
          const hour = params.dataIndex;
          this.openDetailModal({
            hour,
            region: this.selectedRegion !== 'all' ? this.selectedRegion : undefined,
            title: `${this.targetDate} ${String(hour).padStart(2, '0')}:00 時段明細`
          });
        });
      }

      const xHours = this.hourlyFlow.map(h => h.slot);
      const northData = this.hourlyFlow.map(h => h['北北基桃']);
      const southData = this.hourlyFlow.map(h => h['中南部']);
      const eastData = this.hourlyFlow.map(h => h['宜花東']);
      const islandData = this.hourlyFlow.map(h => h['外島']);

      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', label: { backgroundColor: '#334155' } }
        },
        grid: { top: '8%', left: '3%', right: '3%', bottom: '8%', containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xHours,
          axisLine: { lineStyle: { color: '#64748b' } },
          axisLabel: { color: '#cbd5e1', fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
          axisLabel: { color: '#94a3b8' }
        },
        series: [
          {
            name: '北北基桃',
            type: 'line',
            smooth: true,
            stack: 'Total',
            lineStyle: { width: 2, color: '#38bdf8' },
            showSymbol: false,
            areaStyle: {
              opacity: 0.8,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(56, 189, 248, 0.85)' },
                { offset: 1, color: 'rgba(56, 189, 248, 0.1)' }
              ])
            },
            emphasis: { focus: 'series' },
            data: northData
          },
          {
            name: '中南部',
            type: 'line',
            smooth: true,
            stack: 'Total',
            lineStyle: { width: 2, color: '#fb923c' },
            showSymbol: false,
            areaStyle: {
              opacity: 0.8,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(251, 146, 60, 0.85)' },
                { offset: 1, color: 'rgba(251, 146, 60, 0.1)' }
              ])
            },
            emphasis: { focus: 'series' },
            data: southData
          },
          {
            name: '宜花東',
            type: 'line',
            smooth: true,
            stack: 'Total',
            lineStyle: { width: 2, color: '#4ade80' },
            showSymbol: false,
            areaStyle: {
              opacity: 0.8,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(74, 222, 128, 0.85)' },
                { offset: 1, color: 'rgba(74, 222, 128, 0.1)' }
              ])
            },
            emphasis: { focus: 'series' },
            data: eastData
          },
          {
            name: '外島',
            type: 'line',
            smooth: true,
            stack: 'Total',
            lineStyle: { width: 2, color: '#c084fc' },
            showSymbol: false,
            areaStyle: {
              opacity: 0.8,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(192, 132, 252, 0.85)' },
                { offset: 1, color: 'rgba(192, 132, 252, 0.1)' }
              ])
            },
            emphasis: { focus: 'series' },
            data: islandData
          }
        ]
      };

      this.chartInstance.setOption(option);
    },

    async openDetailModal(options) {
      this.modalTitle = options.title || '出貨明細穿透調閱';
      this.modalList = [];
      this.filterKeyword = '';
      this.showDetailModal = true;
      this.loadingDetails = true;

      try {
        const params = {
          targetDate: this.targetDate,
          region: options.region || (this.selectedRegion !== 'all' ? this.selectedRegion : undefined),
          shift: options.shift || (this.selectedShift !== 'all' ? this.selectedShift : undefined),
          hour: options.hour,
          shipSlot: options.shipSlot,
          orderSlot: options.orderSlot
        };

        const res = await axios.get('/api/delivery/orders-detail', { params });
        if (res.data?.success) {
          this.modalList = res.data.list || [];
        }
      } finally {
        this.loadingDetails = false;
      }
    },

    handleDrop(e) {
      this.isDragging = false;
      const file = e.dataTransfer.files[0];
      if (file) this.processUpload(file);
    },
    handleFileSelected(e) {
      const file = e.target.files[0];
      if (file) this.processUpload(file);
    },
    async processUpload(file) {
      this.showUploadCard = false;
      this.isUploading = true;
      ElMessage.info('⚡ 正在讀取並解析宅配報表...');
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

        if (data.length === 0) {
          ElMessage.error('檔案內無資料！');
          return;
        }

        // 自動提取出貨日期
        for (const row of data) {
          const rawD = String(row['出貨日期'] || '').trim();
          if (rawD && rawD.includes('/')) {
            this.targetDate = rawD.replace(/\//g, '-').split(' ')[0];
            break;
          }
        }

        ElMessage.info(`正在寫入 ${data.length.toLocaleString()} 筆宅配記錄...`);
        const BATCH = 3000;
        for (let i = 0; i < data.length; i += BATCH) {
          const chunk = data.slice(i, i + BATCH);
          await axios.post('/api/delivery/import-json', { items: chunk });
        }

        ElMessage.success(`🎉 宅配報表全量匯入成功！已切換至 ${this.targetDate}`);
        await this.fetchDates();
        await this.fetchData();
      } catch (e) {
        ElMessage.error('匯入出錯：' + e.message);
      } finally {
        this.isUploading = false;
        if (this.$refs.fileInput) this.$refs.fileInput.value = '';
      }
    }
  }
}
</script>

<style scoped>
.delivery-flow-page {
  padding: 14px 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #0b1120;
  overflow: hidden;
}

.control-header-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px 0 14px;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-item .label {
  font-size: 13px;
  font-weight: bold;
  color: #cbd5e1;
}
.highlight-box {
  background: rgba(250, 204, 21, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px dashed rgba(250, 204, 21, 0.4);
}
.btn-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.total-badge {
  font-size: 13px;
  color: #cbd5e1;
  background: #0f172a;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #334155;
}
.total-badge strong {
  color: #facc15;
  font-size: 15px;
}

.sub-tabs-bar {
  display: flex;
  gap: 8px;
  border-top: 1px solid #334155;
  padding-top: 8px;
}
.sub-tab-btn {
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: #94a3b8;
  font-size: 13px;
  font-weight: bold;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.sub-tab-btn:hover { color: #f8fafc; }
.sub-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  border-radius: 4px 4px 0 0;
}

.tab-pane-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.shift-cards-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.shift-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid #334155;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
}
.shift-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
.shift-day { border-top: 4px solid #38bdf8; }
.shift-night { border-top: 4px solid #fb923c; }
.shift-graveyard { border-top: 4px solid #a855f7; }

.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.shift-name { font-size: 14px; font-weight: bold; color: #f8fafc; }
.shift-time { font-size: 11px; color: #94a3b8; }
.card-count { font-size: 22px; font-weight: bold; color: #f8fafc; margin-bottom: 8px; }
.card-count .unit { font-size: 12px; color: #94a3b8; font-weight: normal; }

.card-sub-bars { display: flex; gap: 6px; flex-wrap: wrap; }
.reg-chip { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
.chip-north { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
.chip-south { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
.chip-east { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.chip-island { background: rgba(192, 132, 252, 0.2); color: #c084fc; }

.chart-container {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chart-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.legend-tags { display: flex; gap: 12px; font-size: 11px; }
.dot-north { color: #38bdf8; font-weight: bold; }
.dot-south { color: #fb923c; font-weight: bold; }
.dot-east { color: #4ade80; font-weight: bold; }
.dot-island { color: #c084fc; font-weight: bold; }
.flow-echart { width: 100%; height: 350px; }

.table-container {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.table-title { font-size: 14px; font-weight: bold; color: #f8fafc; margin-bottom: 10px; }
.table-scroll-wrapper { overflow-x: auto; max-height: calc(100vh - 250px); }
.flow-matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #f8fafc;
  background: #0f172a;
  white-space: nowrap;
}
.flow-matrix-table th, .flow-matrix-table td {
  border: 1px solid #334155;
  padding: 6px 8px;
}
.flow-matrix-table th { background: #1e293b; color: #94a3b8; font-weight: bold; text-align: center; }
.row-zebra td { background: rgba(255, 255, 255, 0.02); }

.multi-bar-wrapper {
  display: flex;
  height: 14px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
  width: 100%;
  min-width: 180px;
}
.bar-seg { height: 100%; }
.seg-north { background: #38bdf8; }
.seg-south { background: #fb923c; }
.seg-east { background: #4ade80; }
.seg-island { background: #c084fc; }

.shift-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-yellow { color: #facc15; }
.text-blue { color: #38bdf8; }
.text-orange { color: #fb923c; }
.text-green { color: #4ade80; }
.text-purple { color: #c084fc; }
.font-bold { font-weight: bold; }

.lead-time-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tip-text { font-size: 12px; color: #38bdf8; }

.lead-time-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  color: #f8fafc;
  background: #0f172a;
  white-space: nowrap;
}
.lead-time-table th, .lead-time-table td {
  border: 1px solid #334155;
  padding: 5px 6px;
}
.lead-time-table th {
  background: #1e293b;
  color: #94a3b8;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
}
.sub-th { font-size: 9px; color: #64748b; font-weight: normal; }

.sticky-col { position: sticky; z-index: 5; background: #0f172a; }
.col-slot { left: 0; width: 80px; }
.col-shift { left: 80px; width: 75px; }
.col-total { left: 155px; width: 85px; border-right: 2px solid #38bdf8 !important; }
.lead-time-table th.sticky-col { background: #1e293b; z-index: 15; }

.col-order-slot { width: 52px; min-width: 52px; }
.cell-number { font-family: monospace; font-size: 11px; transition: background 0.15s; }
.cell-has-val { background: rgba(56, 189, 248, 0.08); color: #38bdf8; font-weight: bold; cursor: pointer; }
.cell-has-val:hover { background: rgba(250, 204, 21, 0.25) !important; color: #fef08a !important; text-decoration: underline; }
.text-dim { color: #334155; }

.dialog-summary-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; color: #94a3b8; font-size: 12px; }
.copyable { cursor: pointer; }
.copyable:hover { text-decoration: underline; }
.reg-tag { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.tag-north { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
.tag-south { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
.tag-east { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.tag-island { background: rgba(192, 132, 252, 0.2); color: #c084fc; }

.drop-card {
  background: #0f172a;
  border: 2px dashed #38bdf8;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
}
.drop-card-active { border-color: #facc15; background: rgba(250, 204, 21, 0.05); }
.drop-icon { font-size: 48px; color: #38bdf8; }
.drop-text-main { font-size: 15px; font-weight: bold; color: #f8fafc; margin-top: 10px; }
.drop-text-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.drop-tip { margin-top: 12px; font-size: 11px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 4px 8px; border-radius: 4px; display: inline-block; }
</style>