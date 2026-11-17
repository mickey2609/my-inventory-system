<!-- frontend/src/views/DeliveryUndeliveredAnalysis.vue -->
<template>
  <div class="undelivered-page">
    <!-- 1. 頂部篩選控制面板 -->
    <div class="control-header-panel">
      <div class="filter-row">
        <div class="filter-item">
          <span class="label">📅 出貨區間：</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            size="mini"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="開始日期"
            end-placeholder="結束日期"
            style="width: 240px;"
            :clearable="false"
            @change="fetchUndelivered"
          />
          <el-button size="mini" type="info" plain @click="setLatestDay">最新單日</el-button>
          <el-button size="mini" type="info" plain @click="setRecent7Days">近 7 日</el-button>
          <el-button size="mini" type="info" plain @click="setCurrentMonth">本月全部</el-button>
        </div>

        <div class="filter-item">
          <span class="label">🏢 庫別：</span>
          <el-select v-model="selectedWarehouse" size="mini" style="width: 110px;" @change="fetchUndelivered">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in warehouseOptions" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🚚 宅配商：</span>
          <el-select v-model="selectedCarrier" size="mini" style="width: 145px;" @change="fetchUndelivered">
            <el-option label="全部宅配商" value="all" />
            <el-option v-for="c in carrierOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">📍 區域：</span>
          <el-select v-model="selectedRegion" size="mini" style="width: 115px;" @change="fetchUndelivered">
            <el-option label="全部區域" value="all" />
            <el-option label="北北基桃" value="北北基桃" />
            <el-option label="中南部" value="中南部" />
            <el-option label="宜花東" value="宜花東" />
            <el-option label="外島" value="外島" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🔍 單號/收件人：</span>
          <el-input
            v-model="keyword"
            size="mini"
            placeholder="宅配單號 / 訂單號 / 姓名"
            style="width: 185px;"
            clearable
            @keyup.enter="fetchUndelivered"
          />
        </div>

        <div class="btn-group">
          <el-button type="primary" size="mini" icon="el-icon-refresh" :loading="loading" @click="fetchUndelivered">查詢</el-button>
          <el-button type="success" size="mini" icon="el-icon-download" :disabled="undeliveredList.length === 0" @click="exportUndeliveredExcel">
            📊 匯出未達清單
          </el-button>
        </div>
      </div>

      <!-- 子頁籤切換 -->
      <div class="sub-tabs-bar">
        <button class="sub-tab-btn alert-tab" :class="{ active: activeTab === 'tracking_list' }" @click="switchTab('tracking_list')">
          🚨 尚未配達追蹤清單 ({{ formatNumber(kpi.undeliveredCount) }} 件)
        </button>
        <button class="sub-tab-btn" :class="{ active: activeTab === 'carrier_trend' }" @click="switchTab('carrier_trend')">
          📊 各宅配商完妥率與每日趨勢分析
        </button>
      </div>
    </div>

    <!-- 2. 主內容區 -->
    <div class="main-content-scroll" v-loading="loading">
      <!-- 四大核心異常追蹤 KPI 卡片（點擊可直接篩選下方明細） -->
      <div class="kpi-cards-row">
        <div class="kpi-card border-blue" :class="{ 'card-selected': statusCategory === 'all' }" @click="selectCategory('all')">
          <div class="kpi-head">
            <span class="kpi-title">🚚 純宅配出貨總件數 (排除超取)</span>
            <span class="kpi-badge text-green">完妥率 {{ kpi.deliveredRate }}%</span>
          </div>
          <div class="kpi-val text-blue">
            {{ formatNumber(kpi.deliveredCount) }} <span class="unit">已達</span>
            / <span class="text-red">{{ formatNumber(kpi.undeliveredCount) }}</span> <span class="unit text-red">未達</span>
          </div>
          <div class="kpi-sub">
            區間總資料 {{ formatNumber(kpi.totalRawCount) }} 筆（已自動排除超取 {{ formatNumber(kpi.excludedCvsCount) }} 筆）
          </div>
        </div>

        <div class="kpi-card border-red" :class="{ 'card-selected': statusCategory === 'reject_return' }" @click="selectCategory('reject_return')">
          <div class="kpi-head">
            <span class="kpi-title">🚨 拒收／退回異常件</span>
            <span class="kpi-badge text-red">最高優先處理</span>
          </div>
          <div class="kpi-val text-red">{{ formatNumber(kpi.rejectReturnCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">狀態含「拒收、退回、退貨、異常」之未配達包裹（點擊篩選）</div>
        </div>

        <div class="kpi-card border-orange" :class="{ 'card-selected': statusCategory === 'overdue_transit' }" @click="selectCategory('overdue_transit')">
          <div class="kpi-head">
            <span class="kpi-title">⚠️ 超時滯留未達 (&gt;48 小時)</span>
            <span class="kpi-badge text-orange">需向物流催件</span>
          </div>
          <div class="kpi-val text-orange">{{ formatNumber(kpi.overdueTransitCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">非拒收退回，但已超過 2 天仍無配達日期（點擊篩選）</div>
        </div>

        <div class="kpi-card border-gold" :class="{ 'card-selected': statusCategory === 'normal_transit' }" @click="selectCategory('normal_transit')">
          <div class="kpi-head">
            <span class="kpi-title">⏳ 正常配送在途 (≤48 小時)</span>
            <span class="kpi-badge">觀察中</span>
          </div>
          <div class="kpi-val text-yellow">{{ formatNumber(kpi.normalTransitCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">剛出貨 2 天內尚在正常轉運配送中之貨件（點擊篩選）</div>
        </div>
      </div>

      <!-- 頁籤 1：尚未配達追蹤明細清單 -->
      <div v-show="activeTab === 'tracking_list'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span class="table-title">🚨 尚未配達貨件追蹤明細（依據「配達日期為空白」判定，已排除超商取貨）</span>
              <el-radio-group v-model="statusCategory" size="mini" @change="fetchUndelivered">
                <el-radio-button label="all">全部未達 ({{ formatNumber(kpi.undeliveredCount) }})</el-radio-button>
                <el-radio-button label="reject_return">🚨 拒收退回 ({{ formatNumber(kpi.rejectReturnCount) }})</el-radio-button>
                <el-radio-button label="overdue_transit">⚠️ 超時滯留 ({{ formatNumber(kpi.overdueTransitCount) }})</el-radio-button>
                <el-radio-button label="normal_transit">⏳ 正常在途 ({{ formatNumber(kpi.normalTransitCount) }})</el-radio-button>
              </el-radio-group>
            </div>
            <span class="tip-text">顯示 {{ formatNumber(undeliveredList.length) }} / {{ formatNumber(filteredTotal) }} 筆（點擊單號可直接複製）</span>
          </div>

          <!-- 貨態分佈膠囊列 -->
          <div class="status-chips-row" v-if="statusBreakdown.length > 0">
            <span class="chip-lbl">目前未達貨態分佈：</span>
            <span v-for="st in statusBreakdown" :key="st.status" class="status-summary-chip">
              {{ st.status }}：<strong>{{ formatNumber(st.count) }}</strong> 件
            </span>
          </div>

          <div class="table-scroll" style="max-height: calc(100vh - 320px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>異常分類</th>
                  <th>目前配送狀態</th>
                  <th>宅配單號</th>
                  <th>訂單編號</th>
                  <th>庫別</th>
                  <th>區域</th>
                  <th>宅配商</th>
                  <th>宅配類別</th>
                  <th>出貨日期</th>
                  <th>出貨時間</th>
                  <th>經過天數</th>
                  <th>收件人</th>
                  <th>郵遞區號</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="undeliveredList.length === 0">
                  <td colspan="14" class="text-center text-green font-bold" style="padding: 32px;">
                    🎉 查詢條件內所有純宅配貨件皆已填寫配達日期（100% 配達完畢）！
                  </td>
                </tr>
                <tr
                  v-for="u in undeliveredList"
                  :key="u.tracking_no"
                  :class="u.anomalyType === 'reject_return' ? 'row-reject' : (u.anomalyType === 'overdue_transit' ? 'row-overdue' : '')"
                >
                  <td class="text-center">
                    <span class="anom-badge" :class="`anom-${u.anomalyType}`">{{ u.anomalyLabel }}</span>
                  </td>
                  <td class="text-center">
                    <span class="status-pill">{{ u.rawStatus }}</span>
                  </td>
                  <td class="font-bold text-blue copyable" @click="copyText(u.tracking_no)">{{ u.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(u.order_no)">{{ u.order_no }}</td>
                  <td class="text-center font-bold text-yellow">{{ u.wh_code ? `${u.wh_code}庫` : '-' }}</td>
                  <td class="text-center">{{ u.region }}</td>
                  <td class="font-bold">{{ u.carrier_name }}</td>
                  <td class="text-center">{{ u.delivery_type }}</td>
                  <td class="text-center">{{ u.ship_date }}</td>
                  <td class="text-center">{{ u.ship_time }}</td>
                  <td class="text-right font-bold" :class="u.elapsedDays >= 2 ? 'text-red' : 'text-yellow'">
                    {{ u.elapsedDays }} 天 ({{ u.elapsedHours }}H)
                  </td>
                  <td class="text-center">{{ u.receiver_name || '-' }}</td>
                  <td class="text-center">{{ u.zip_code }}</td>
                  <td class="text-dim">{{ u.address }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 2：各宅配商完妥率與每日趨勢分析 -->
      <div v-show="activeTab === 'carrier_trend'" class="tab-pane-box">
        <div class="charts-grid-2">
          <div class="chart-card">
            <div class="chart-title">📈 每日「已配達 vs 尚未配達」趨勢對比</div>
            <div ref="dailyTrendChart" class="echart-box"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">🚚 各宅配商未配達件數分佈（拒收退回 vs 超時滯留 vs 在途）</div>
            <div ref="carrierAnomalyChart" class="echart-box"></div>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">📊 各純宅配商配達完妥率、平均配送耗時與異常明細統計表</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配商</th>
                  <th>宅配總件數</th>
                  <th>已配達 (有配達日)</th>
                  <th>尚未配達 (配達日空白)</th>
                  <th>配達完妥率</th>
                  <th>🚨 拒收/退回</th>
                  <th>⚠️ 超時滯留(&gt;48H)</th>
                  <th>⏳ 正常在途(≤48H)</th>
                  <th>平均配送耗時 (出貨➔配達)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, idx) in carrierList" :key="c.carrier" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="font-bold text-blue">{{ c.carrier }}</td>
                  <td class="text-right font-bold">{{ formatNumber(c.totalCount) }}</td>
                  <td class="text-right text-green font-bold">{{ formatNumber(c.deliveredCount) }}</td>
                  <td class="text-right text-red font-bold">{{ formatNumber(c.undeliveredCount) }}</td>
                  <td class="text-center">
                    <span class="rate-badge" :class="c.deliveredRate >= 98 ? 'rate-ok' : (c.deliveredRate >= 90 ? 'rate-mid' : 'rate-high')">
                      {{ c.deliveredRate }}%
                    </span>
                  </td>
                  <td class="text-right text-red font-bold">{{ formatNumber(c.rejectReturnCount) }}</td>
                  <td class="text-right text-orange font-bold">{{ formatNumber(c.overdueCount) }}</td>
                  <td class="text-right text-yellow">{{ formatNumber(c.normalTransitCount) }}</td>
                  <td class="text-center text-yellow">{{ c.avgTransitHours ? `${c.avgTransitHours} 小時` : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import * as XLSX from 'xlsx'

export default {
  name: 'DeliveryUndeliveredAnalysis',
  data() {
    return {
      loading: false,
      activeTab: 'tracking_list',
      dateRange: [],
      latestAvailableDate: '',

      selectedWarehouse: 'all',
      selectedCarrier: 'all',
      selectedRegion: 'all',
      statusCategory: 'all',
      keyword: '',

      warehouseOptions: [],
      carrierOptions: [],

      kpi: {
        totalRawCount: 0,
        excludedCvsCount: 0,
        homeTotalCount: 0,
        deliveredCount: 0,
        undeliveredCount: 0,
        deliveredRate: 0,
        rejectReturnCount: 0,
        overdueTransitCount: 0,
        normalTransitCount: 0
      },
      carrierList: [],
      dailyTrendList: [],
      statusBreakdown: [],
      undeliveredList: [],
      filteredTotal: 0,

      dailyChartInstance: null,
      carrierChartInstance: null
    }
  },
  mounted() {
    this.initOptions().then(() => {
      this.fetchUndelivered();
    });
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.dailyChartInstance) this.dailyChartInstance.dispose();
    if (this.carrierChartInstance) this.carrierChartInstance.dispose();
  },
  methods: {
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    handleResize() {
      if (this.dailyChartInstance) this.dailyChartInstance.resize();
      if (this.carrierChartInstance) this.carrierChartInstance.resize();
    },
    selectCategory(cat) {
      this.statusCategory = this.statusCategory === cat ? 'all' : cat;
      this.activeTab = 'tracking_list';
      this.fetchUndelivered();
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'carrier_trend') {
        this.$nextTick(() => this.renderCharts());
      }
    },
    setLatestDay() {
      if (this.latestAvailableDate) {
        this.dateRange = [this.latestAvailableDate, this.latestAvailableDate];
        this.fetchUndelivered();
      }
    },
    setRecent7Days() {
      const end = this.latestAvailableDate || new Date().toISOString().split('T')[0];
      const dt = new Date(`${end}T00:00:00`);
      dt.setDate(dt.getDate() - 6);
      const start = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      this.dateRange = [start, end];
      this.fetchUndelivered();
    },
    setCurrentMonth() {
      const base = this.latestAvailableDate || new Date().toISOString().split('T')[0];
      const ym = base.slice(0, 7);
      this.dateRange = [`${ym}-01`, `${ym}-31`];
      this.fetchUndelivered();
    },
    async initOptions() {
      try {
        const res = await axios.get('/api/delivery/dates', { params: { dayMode: 'calendar' } });
        if (res.data?.success) {
          this.warehouseOptions = res.data.warehouses || [];
          // 排除超取物流商，下拉選單只顯示純宅配商
          this.carrierOptions = (res.data.carriers || []).filter(c => !/超取|7-11|全家|萊爾富|OK|大智通|日翊/i.test(c));
          const list = res.data.list || [];
          if (list.length > 0) {
            this.latestAvailableDate = list[0].ship_date;
            this.dateRange = [this.latestAvailableDate, this.latestAvailableDate];
          }
        }
      } catch (e) {}
    },
    async fetchUndelivered() {
      this.loading = true;
      try {
        const [startDate, endDate] = this.dateRange || [];
        const res = await axios.get('/api/delivery/undelivered-analysis', {
          params: {
            startDate,
            endDate,
            whCode: this.selectedWarehouse,
            carrier: this.selectedCarrier,
            region: this.selectedRegion,
            statusCategory: this.statusCategory,
            keyword: this.keyword
          }
        });
        if (res.data?.success) {
          if (!this.dateRange || this.dateRange.length === 0) {
            this.dateRange = [res.data.startDate, res.data.endDate];
          }
          this.kpi = res.data.kpi || this.kpi;
          this.carrierList = res.data.carrierList || [];
          this.dailyTrendList = res.data.dailyTrendList || [];
          this.statusBreakdown = res.data.statusBreakdown || [];
          this.undeliveredList = res.data.undeliveredList || [];
          this.filteredTotal = res.data.filteredTotal || this.undeliveredList.length;
          this.$nextTick(() => this.renderCharts());
        }
      } catch (e) {
        ElMessage.error('取得未配達分析失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },
    exportUndeliveredExcel() {
      const rows = this.undeliveredList.map(u => ({
        '異常分類': u.anomalyLabel,
        '目前配送狀態': u.rawStatus,
        '宅配單號': u.tracking_no,
        '訂單編號': u.order_no,
        '庫別': u.wh_code,
        '區域': u.region,
        '宅配商': u.carrier_name,
        '宅配類別': u.delivery_type,
        '出貨日期': u.ship_date,
        '出貨時間': u.ship_time,
        '已出貨天數': u.elapsedDays,
        '收件人': u.receiver_name,
        '郵遞區號': u.zip_code,
        '收件地址': u.address
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '尚未配達追蹤清單');
      const [s, e] = this.dateRange || ['', ''];
      XLSX.writeFile(wb, `尚未配達貨件追蹤_${s}_${e}.xlsx`);
      ElMessage.success(`🎉 已成功匯出 ${rows.length} 筆未配達追蹤清單！`);
    },
    renderCharts() {
      if (this.activeTab !== 'carrier_trend') return;

      if (this.$refs.dailyTrendChart) {
        if (!this.dailyChartInstance) {
          this.dailyChartInstance = echarts.init(this.$refs.dailyTrendChart);
        }
        this.dailyChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          legend: { data: ['已配達件數', '尚未配達件數'], textStyle: { color: '#cbd5e1' } },
          grid: { top: '14%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
          xAxis: { type: 'category', data: this.dailyTrendList.map(d => d.date.slice(5)), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#94a3b8' } },
          series: [
            { name: '已配達件數', type: 'bar', stack: 'deliv', itemStyle: { color: '#4ade80' }, data: this.dailyTrendList.map(d => d.deliveredCount) },
            { name: '尚未配達件數', type: 'bar', stack: 'deliv', itemStyle: { color: '#f87171', borderRadius: [4, 4, 0, 0] }, data: this.dailyTrendList.map(d => d.undeliveredCount) }
          ]
        }, true);
        this.dailyChartInstance.resize();
      }

      if (this.$refs.carrierAnomalyChart) {
        if (!this.carrierChartInstance) {
          this.carrierChartInstance = echarts.init(this.$refs.carrierAnomalyChart);
        }
        this.carrierChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { data: ['拒收/退回', '超時滯留(>48H)', '正常在途(≤48H)'], textStyle: { color: '#cbd5e1' } },
          grid: { top: '14%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
          xAxis: { type: 'category', data: this.carrierList.map(c => c.carrier), axisLabel: { color: '#cbd5e1', fontSize: 11 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#94a3b8' } },
          series: [
            { name: '拒收/退回', type: 'bar', stack: 'anom', barWidth: '42%', itemStyle: { color: '#f87171' }, data: this.carrierList.map(c => c.rejectReturnCount) },
            { name: '超時滯留(>48H)', type: 'bar', stack: 'anom', barWidth: '42%', itemStyle: { color: '#fb923c' }, data: this.carrierList.map(c => c.overdueCount) },
            { name: '正常在途(≤48H)', type: 'bar', stack: 'anom', barWidth: '42%', itemStyle: { color: '#facc15', borderRadius: [4, 4, 0, 0] }, data: this.carrierList.map(c => c.normalTransitCount) }
          ]
        }, true);
        this.carrierChartInstance.resize();
      }
    }
  }
}
</script>

<style scoped>
.undelivered-page {
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
  padding: 10px 14px 8px 14px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
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
.btn-group { margin-left: auto; display: flex; gap: 8px; }

.sub-tabs-bar {
  display: flex;
  gap: 8px;
  border-top: 1px solid #334155;
  padding-top: 6px;
}
.sub-tab-btn {
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: #94a3b8;
  font-size: 13px;
  font-weight: bold;
  padding: 6px 14px;
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
.alert-tab.active {
  color: #f87171;
  border-bottom-color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.main-content-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.tab-pane-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.kpi-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.kpi-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
.card-selected { outline: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.06); }

.border-blue { border-top: 4px solid #38bdf8; }
.border-red { border-top: 4px solid #f87171; }
.border-orange { border-top: 4px solid #fb923c; }
.border-gold { border-top: 4px solid #facc15; }

.kpi-head { display: flex; justify-content: space-between; align-items: center; }
.kpi-title { font-size: 13px; font-weight: bold; color: #cbd5e1; }
.kpi-badge { font-size: 11px; color: #94a3b8; background: #0f172a; padding: 2px 6px; border-radius: 4px; }
.kpi-val { font-size: 23px; font-weight: bold; margin: 2px 0; }
.kpi-val .unit { font-size: 12px; font-weight: normal; color: #94a3b8; }
.kpi-sub { font-size: 11px; color: #94a3b8; }

.status-chips-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: #0f172a;
  border-radius: 6px;
  border: 1px solid #334155;
}
.chip-lbl { font-size: 12px; color: #94a3b8; font-weight: bold; }
.status-summary-chip {
  font-size: 12px;
  color: #cbd5e1;
  background: #1e293b;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #334155;
}
.status-summary-chip strong { color: #facc15; }

.charts-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chart-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.chart-title { font-size: 14px; font-weight: bold; color: #f8fafc; margin-bottom: 8px; }
.echart-box { width: 100%; height: 270px; }

.table-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.table-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.tip-text { font-size: 12px; color: #38bdf8; }

.table-scroll { overflow-x: auto; max-height: 460px; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #f8fafc;
  background: #0f172a;
  white-space: nowrap;
}
.data-table th, .data-table td {
  border: 1px solid #334155;
  padding: 6px 10px;
}
.data-table th {
  background: #1e293b;
  color: #94a3b8;
  font-weight: bold;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 5;
}
.row-zebra td { background: rgba(255, 255, 255, 0.02); }
.row-reject td { background: rgba(248, 113, 113, 0.14) !important; }
.row-overdue td { background: rgba(251, 146, 60, 0.08) !important; }

.anom-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.anom-reject_return { background: rgba(248, 113, 113, 0.25); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.5); }
.anom-overdue_transit { background: rgba(251, 146, 60, 0.25); color: #fdba74; }
.anom-normal_transit { background: rgba(250, 204, 21, 0.15); color: #fde047; }

.status-pill {
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.rate-badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.rate-ok { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.rate-mid { background: rgba(250, 204, 21, 0.2); color: #facc15; }
.rate-high { background: rgba(248, 113, 113, 0.2); color: #f87171; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-yellow { color: #facc15; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fb923c; }
.text-red { color: #f87171; }
.text-dim { color: #64748b; }
.font-bold { font-weight: bold; }
.copyable { cursor: pointer; }
.copyable:hover { text-decoration: underline; }
</style>