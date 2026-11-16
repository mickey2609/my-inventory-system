<!-- frontend/src/views/DeliveryCostAnalysis.vue -->
<template>
  <div class="cost-analysis-page">
    <!-- 1. 頂部篩選控制面板 -->
    <div class="control-header-panel">
      <div class="filter-row">
        <div class="filter-item">
          <span class="label">📅 查詢區間：</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            size="mini"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="開始日期"
            end-placeholder="結束日期"
            style="width: 245px;"
            :clearable="false"
            @change="fetchCostAnalysis"
          />
          <el-button size="mini" type="info" plain @click="setLatestDay">最新單日</el-button>
          <el-button size="mini" type="info" plain @click="setCurrentMonth">本月累計</el-button>
        </div>

        <div class="filter-item">
          <span class="label">🏢 庫別：</span>
          <el-select v-model="selectedWarehouse" size="mini" style="width: 110px;" @change="fetchCostAnalysis">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in warehouseOptions" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🚚 物流商：</span>
          <el-select v-model="selectedCarrier" size="mini" style="width: 145px;" @change="fetchCostAnalysis">
            <el-option label="全部物流商" value="all" />
            <el-option v-for="c in carrierOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">📦 箱號：</span>
          <el-select v-model="selectedBoxNo" size="mini" filterable style="width: 130px;" @change="fetchCostAnalysis">
            <el-option label="全部箱號" value="all" />
            <el-option v-for="b in boxNoOptions" :key="b" :label="b" :value="b" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🏷️ 類別：</span>
          <el-select v-model="selectedDeliveryType" size="mini" style="width: 125px;" @change="fetchCostAnalysis">
            <el-option label="全部類別" value="all" />
            <el-option v-for="t in deliveryTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </div>

        <div class="filter-item">
          <el-checkbox v-model="onlySplitBox" @change="fetchCostAnalysis">
            <span class="text-purple font-bold">僅看拆箱 (非第一箱)</span>
          </el-checkbox>
          <el-checkbox v-model="onlyLate" @change="fetchCostAnalysis">
            <span class="text-red font-bold">僅看遲到件</span>
          </el-checkbox>
        </div>

        <div class="btn-group">
          <el-button type="primary" size="mini" icon="el-icon-refresh" :loading="loading" @click="fetchCostAnalysis">重新計算</el-button>
        </div>
      </div>

      <!-- 子頁籤切換 -->
      <div class="sub-tabs-bar">
        <button class="sub-tab-btn" :class="{ active: activeTab === 'carrier_box' }" @click="switchTab('carrier_box')">
          💰 物流商與包材成本總覽
        </button>
        <button class="sub-tab-btn" :class="{ active: activeTab === 'district_type' }" @click="switchTab('district_type')">
          📮 行政區熱點與宅配類別
        </button>
        <button class="sub-tab-btn warn-tab" :class="{ active: activeTab === 'split_audit' }" @click="switchTab('split_audit')">
          🔀 一單多箱拆箱成本稽核 ({{ kpi.splitBoxCount }} 箱)
        </button>
        <button class="sub-tab-btn alert-tab" :class="{ active: activeTab === 'high_cost' }" @click="switchTab('high_cost')">
          🚨 高運費／額外加價預警 ({{ highCostAlerts.length }} 筆)
        </button>
      </div>
    </div>

    <!-- 2. 主內容區 -->
    <div class="main-content-scroll" v-loading="loading">
      <!-- 四大核心財務 KPI 卡片 -->
      <div class="kpi-cards-row">
        <div class="kpi-card border-gold">
          <div class="kpi-head">
            <span class="kpi-title">💵 總履約成本 (物流＋包材)</span>
            <span class="kpi-badge">共 {{ formatNumber(kpi.totalPackages) }} 件 / {{ formatNumber(kpi.totalOrders) }} 單</span>
          </div>
          <div class="kpi-val text-yellow">${{ formatMoney(kpi.totalFulfillmentCost) }}</div>
          <div class="kpi-sub">
            平均每件總成本：<strong>${{ kpi.totalPackages > 0 ? (kpi.totalFulfillmentCost / kpi.totalPackages).toFixed(2) : '0.00' }}</strong>
            （含額外加價 ${{ formatMoney(kpi.totalExtraFee) }}）
          </div>
        </div>

        <div class="kpi-card border-blue">
          <div class="kpi-head">
            <span class="kpi-title">🚚 物流運費總計</span>
            <span class="kpi-badge">計費 {{ formatNumber(kpi.billedPackages) }} 件</span>
          </div>
          <div class="kpi-val text-blue">${{ formatMoney(kpi.totalShippingFee) }}</div>
          <div class="kpi-sub">
            宅配計費件均價：<strong>${{ kpi.avgBilledShippingFee }} / 件</strong>（超取月結件不計入均價）
          </div>
        </div>

        <div class="kpi-card border-green">
          <div class="kpi-head">
            <span class="kpi-title">📦 紙箱包材總成本</span>
            <span class="kpi-badge">均價 ${{ kpi.avgBoxCost }} / 箱</span>
          </div>
          <div class="kpi-val text-green">${{ formatMoney(kpi.totalBoxCost) }}</div>
          <div class="kpi-sub">
            佔總履約成本 <strong>{{ kpi.totalFulfillmentCost > 0 ? ((kpi.totalBoxCost / kpi.totalFulfillmentCost) * 100).toFixed(1) : '0.0' }}%</strong>
          </div>
        </div>

        <div class="kpi-card border-purple">
          <div class="kpi-head">
            <span class="kpi-title">🔀 拆箱額外流失 (是否為第一箱=N)</span>
            <span class="kpi-badge text-red">遲到 {{ formatNumber(kpi.lateCount) }} 件 ({{ kpi.lateRate }}%)</span>
          </div>
          <div class="kpi-val text-purple">${{ formatMoney(kpi.splitBoxTotalLoss) }}</div>
          <div class="kpi-sub">
            多拆 <strong>{{ formatNumber(kpi.splitBoxCount) }}</strong> 箱（額外運費 ${{ formatMoney(kpi.splitBoxShippingLoss) }} ＋ 包材 ${{ formatMoney(kpi.splitBoxMaterialLoss) }}）
          </div>
        </div>
      </div>

      <!-- 頁籤 1：物流商與包材成本總覽 -->
      <div v-show="activeTab === 'carrier_box'" class="tab-pane-box">
        <!-- 圖表雙欄 -->
        <div class="charts-grid-2">
          <div class="chart-card">
            <div class="chart-title">📊 各物流商「物流費 vs 包材費」堆疊對比</div>
            <div ref="carrierCostChart" class="echart-box"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">📦 熱門箱號「使用箱數 vs 單件總成本」分析</div>
            <div ref="boxCostChart" class="echart-box"></div>
          </div>
        </div>

        <!-- 物流商成本與準點率明細表 -->
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">🚚 物流商成本結構與遲到率對比表</span>
            <span class="tip-text">💡 超取月結件（運費為 0）已自動獨立計算計費均價，避免拉低宅配真實均價</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>物流商</th>
                  <th>總件數</th>
                  <th>計費件數</th>
                  <th>物流費總計</th>
                  <th>計費件均運費</th>
                  <th>額外加價合計</th>
                  <th>包材費總計</th>
                  <th>總履約成本</th>
                  <th>拆箱件數</th>
                  <th>遲到件數</th>
                  <th>遲到率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, idx) in carrierList" :key="c.carrier" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="font-bold text-blue">{{ c.carrier }}</td>
                  <td class="text-right font-bold">{{ formatNumber(c.count) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(c.billedCount) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(c.shippingFee) }}</td>
                  <td class="text-right text-yellow font-bold">${{ c.avgShippingFee.toFixed(2) }}</td>
                  <td class="text-right text-orange">${{ formatMoney(c.extraFee) }}</td>
                  <td class="text-right text-green">${{ formatMoney(c.boxCost) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(c.totalCost) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(c.splitCount) }}</td>
                  <td class="text-right text-red font-bold">{{ formatNumber(c.lateCount) }}</td>
                  <td class="text-center">
                    <span class="rate-badge" :class="c.lateRate >= 10 ? 'rate-high' : (c.lateRate >= 3 ? 'rate-mid' : 'rate-ok')">
                      {{ c.lateRate }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 箱號耗用與單件總成本排行表 -->
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">📦 箱號規格耗用、包材費與平均物流費排行表</span>
            <span class="tip-text">💡 可用於包材備料與檢查「高單價大箱裝輕物」之浪費情形</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>箱號規格</th>
                  <th>使用箱數</th>
                  <th>箱子單價</th>
                  <th>平均材積和</th>
                  <th>包材總成本</th>
                  <th>平均物流費</th>
                  <th>單件總成本 (箱+運)</th>
                  <th>該箱型總支出</th>
                  <th>拆箱次數</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(b, idx) in boxList" :key="b.boxNo" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold text-green">{{ b.boxNo }}</td>
                  <td class="text-right font-bold">{{ formatNumber(b.count) }}</td>
                  <td class="text-right text-green">${{ b.unitBoxPrice.toFixed(2) }}</td>
                  <td class="text-right text-dim">{{ b.avgVolume }}</td>
                  <td class="text-right text-green font-bold">${{ formatMoney(b.boxCostSum) }}</td>
                  <td class="text-right text-blue">${{ b.avgShippingFee.toFixed(2) }}</td>
                  <td class="text-right text-yellow font-bold">${{ b.avgTotalCost.toFixed(2) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(b.totalCostSum) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(b.splitCount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 2：行政區熱點與宅配類別 -->
      <div v-show="activeTab === 'district_type'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">🏷️ 宅配類別成本與時效結構表</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配類別</th>
                  <th>總件數</th>
                  <th>計費件數</th>
                  <th>物流費總計</th>
                  <th>計費件均運費</th>
                  <th>包材費總計</th>
                  <th>總履約成本</th>
                  <th>遲到件數</th>
                  <th>遲到率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(t, idx) in deliveryTypeList" :key="t.deliveryType" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="font-bold text-yellow">{{ t.deliveryType }}</td>
                  <td class="text-right font-bold">{{ formatNumber(t.count) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(t.billedCount) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(t.shippingFee) }}</td>
                  <td class="text-right text-yellow">${{ t.avgShippingFee.toFixed(2) }}</td>
                  <td class="text-right text-green">${{ formatMoney(t.boxCost) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(t.totalCost) }}</td>
                  <td class="text-right text-red">{{ formatNumber(t.lateCount) }}</td>
                  <td class="text-center">{{ t.lateRate }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">📮 縣市／行政區與郵遞區號 Top 30 配送熱點與均價表</span>
            <span class="tip-text">💡 可一眼看出高單量熱區與偏遠加價區碼</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>大區</th>
                  <th>縣市行政區</th>
                  <th>郵遞區號(前3碼)</th>
                  <th>包裹件數</th>
                  <th>物流費總計</th>
                  <th>包材費總計</th>
                  <th>總履約成本</th>
                  <th>計費件均運費</th>
                  <th>單件總成本</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, idx) in districtTopList" :key="`${d.district}_${d.zip3}`" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold text-yellow">#{{ idx + 1 }}</td>
                  <td class="text-center">{{ d.region }}</td>
                  <td class="font-bold text-blue">{{ d.district }}</td>
                  <td class="text-center font-bold">{{ d.zip3 }}</td>
                  <td class="text-right font-bold">{{ formatNumber(d.count) }}</td>
                  <td class="text-right text-blue">${{ formatMoney(d.shippingFee) }}</td>
                  <td class="text-right text-green">${{ formatMoney(d.boxCost) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(d.totalCost) }}</td>
                  <td class="text-right text-orange font-bold">${{ d.avgShippingFee.toFixed(2) }}</td>
                  <td class="text-right">${{ d.avgTotalCost.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 3：一單多箱拆箱成本稽核 -->
      <div v-show="activeTab === 'split_audit'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">🔀 一單多箱（拆箱）完整對照明細（含同訂單第一箱與後續拆箱）</span>
            <span class="tip-text">額外多拆 {{ kpi.splitBoxCount }} 箱，累計多支出 ${{ formatMoney(kpi.splitBoxTotalLoss) }} 元</span>
          </div>
          <div class="table-scroll" style="max-height: 560px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>訂單編號</th>
                  <th>是否為第一箱</th>
                  <th>宅配單號</th>
                  <th>物流商</th>
                  <th>箱號</th>
                  <th>實際重量</th>
                  <th>箱子單價</th>
                  <th>物流費總計</th>
                  <th>單箱總成本</th>
                  <th>出貨時間</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="splitOrdersDetail.length === 0">
                  <td colspan="11" class="text-center text-dim" style="padding: 28px;">查詢區間內無一單多箱拆箱紀錄</td>
                </tr>
                <tr
                  v-for="s in splitOrdersDetail"
                  :key="s.tracking_no"
                  :class="{ 'row-split-extra': s.is_first_box === 'N' }"
                >
                  <td class="font-bold text-orange copyable" @click="copyText(s.order_no)">{{ s.order_no }}</td>
                  <td class="text-center">
                    <span class="box-flag" :class="s.is_first_box === 'N' ? 'flag-extra' : 'flag-first'">
                      {{ s.is_first_box === 'N' ? 'N (額外拆箱)' : 'Y (主箱)' }}
                    </span>
                  </td>
                  <td class="font-bold text-blue copyable" @click="copyText(s.tracking_no)">{{ s.tracking_no }}</td>
                  <td>{{ s.carrier_name }}</td>
                  <td class="text-center font-bold text-green">{{ s.box_no }}</td>
                  <td class="text-right">{{ s.actual_weight || '-' }}</td>
                  <td class="text-right text-green">${{ Number(s.box_price || 0).toFixed(2) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(s.shipping_fee) }}</td>
                  <td class="text-right text-yellow font-bold">${{ Number(s.totalCost || 0).toFixed(2) }}</td>
                  <td class="text-center">{{ s.ship_date }} {{ s.ship_time }}</td>
                  <td class="text-dim">{{ s.address }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 4：高運費／額外加價預警 -->
      <div v-show="activeTab === 'high_cost'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">🚨 高單價運費 (≥$120) 或 含額外加價（假日／超材／地區加價）明細</span>
          </div>
          <div class="table-scroll" style="max-height: 560px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配單號</th>
                  <th>訂單編號</th>
                  <th>物流商</th>
                  <th>箱號</th>
                  <th>箱號材積和</th>
                  <th>基本運費</th>
                  <th>額外加價</th>
                  <th>物流費總計</th>
                  <th>箱子單價</th>
                  <th>單件總成本</th>
                  <th>郵遞區號</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="highCostAlerts.length === 0">
                  <td colspan="12" class="text-center text-dim" style="padding: 28px;">查詢區間內無高運費或額外加價紀錄</td>
                </tr>
                <tr v-for="h in highCostAlerts" :key="h.tracking_no">
                  <td class="font-bold text-blue copyable" @click="copyText(h.tracking_no)">{{ h.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(h.order_no)">{{ h.order_no }}</td>
                  <td>{{ h.carrier_name }}</td>
                  <td class="text-center font-bold text-green">{{ h.box_no }}</td>
                  <td class="text-right">{{ h.box_volume }}</td>
                  <td class="text-right">${{ formatMoney(h.base_fee) }}</td>
                  <td class="text-right text-red font-bold">${{ formatMoney(h.extra_fee) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(h.shipping_fee) }}</td>
                  <td class="text-right text-green">${{ Number(h.box_price || 0).toFixed(2) }}</td>
                  <td class="text-right text-yellow font-bold">${{ Number(h.totalCost || 0).toFixed(2) }}</td>
                  <td class="text-center">{{ h.zip_code }}</td>
                  <td class="text-dim">{{ h.address }}</td>
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

export default {
  name: 'DeliveryCostAnalysis',
  data() {
    return {
      loading: false,
      activeTab: 'carrier_box',
      dateRange: [],
      latestAvailableDate: '',

      selectedWarehouse: 'all',
      selectedCarrier: 'all',
      selectedBoxNo: 'all',
      selectedDeliveryType: 'all',
      onlySplitBox: false,
      onlyLate: false,

      warehouseOptions: [],
      carrierOptions: [],
      boxNoOptions: [],
      deliveryTypeOptions: [],

      kpi: {
        totalPackages: 0,
        totalOrders: 0,
        totalShippingFee: 0,
        totalBoxCost: 0,
        totalFulfillmentCost: 0,
        totalExtraFee: 0,
        billedPackages: 0,
        avgBilledShippingFee: 0,
        avgBoxCost: 0,
        splitBoxCount: 0,
        splitBoxShippingLoss: 0,
        splitBoxMaterialLoss: 0,
        splitBoxTotalLoss: 0,
        lateCount: 0,
        lateRate: 0,
        codCashCount: 0
      },
      carrierList: [],
      boxList: [],
      deliveryTypeList: [],
      districtTopList: [],
      splitOrdersDetail: [],
      highCostAlerts: [],

      carrierChartInstance: null,
      boxChartInstance: null
    }
  },
  mounted() {
    this.initOptions().then(() => {
      this.fetchCostAnalysis();
    });
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.carrierChartInstance) this.carrierChartInstance.dispose();
    if (this.boxChartInstance) this.boxChartInstance.dispose();
  },
  methods: {
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    formatMoney(v) {
      return Number(v || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    handleResize() {
      if (this.carrierChartInstance) this.carrierChartInstance.resize();
      if (this.boxChartInstance) this.boxChartInstance.resize();
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'carrier_box') {
        this.$nextTick(() => this.renderCharts());
      }
    },
    setLatestDay() {
      if (this.latestAvailableDate) {
        this.dateRange = [this.latestAvailableDate, this.latestAvailableDate];
        this.fetchCostAnalysis();
      }
    },
    setCurrentMonth() {
      const base = this.latestAvailableDate || new Date().toISOString().split('T')[0];
      const ym = base.slice(0, 7);
      this.dateRange = [`${ym}-01`, `${ym}-31`];
      this.fetchCostAnalysis();
    },
    async initOptions() {
      try {
        const res = await axios.get('/api/delivery/dates', { params: { dayMode: 'calendar' } });
        if (res.data?.success) {
          this.warehouseOptions = res.data.warehouses || [];
          this.carrierOptions = res.data.carriers || [];
          this.deliveryTypeOptions = res.data.deliveryTypes || [];
          this.boxNoOptions = res.data.boxNos || [];
          const list = res.data.list || [];
          if (list.length > 0) {
            this.latestAvailableDate = list[0].ship_date;
            this.dateRange = [this.latestAvailableDate, this.latestAvailableDate];
          }
        }
      } catch (e) {}
    },
    async fetchCostAnalysis() {
      this.loading = true;
      try {
        const [startDate, endDate] = this.dateRange || [];
        const res = await axios.get('/api/delivery/cost-analysis', {
          params: {
            startDate,
            endDate,
            whCode: this.selectedWarehouse,
            carrier: this.selectedCarrier,
            boxNo: this.selectedBoxNo,
            deliveryType: this.selectedDeliveryType,
            onlySplitBox: this.onlySplitBox ? 'true' : undefined,
            onlyLate: this.onlyLate ? 'true' : undefined
          }
        });
        if (res.data?.success) {
          if (!this.dateRange || this.dateRange.length === 0) {
            this.dateRange = [res.data.startDate, res.data.endDate];
          }
          this.kpi = res.data.kpi || this.kpi;
          this.carrierList = res.data.carrierList || [];
          this.boxList = res.data.boxList || [];
          this.deliveryTypeList = res.data.deliveryTypeList || [];
          this.districtTopList = res.data.districtTopList || [];
          this.splitOrdersDetail = res.data.splitOrdersDetail || [];
          this.highCostAlerts = res.data.highCostAlerts || [];
          this.$nextTick(() => this.renderCharts());
        }
      } catch (e) {
        ElMessage.error('取得物流與包材成本分析失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },
    renderCharts() {
      if (this.activeTab !== 'carrier_box') return;

      if (this.$refs.carrierCostChart) {
        if (!this.carrierChartInstance) {
          this.carrierChartInstance = echarts.init(this.$refs.carrierCostChart);
        }
        const names = this.carrierList.map(c => c.carrier);
        const shipFees = this.carrierList.map(c => c.shippingFee);
        const boxCosts = this.carrierList.map(c => c.boxCost);

        this.carrierChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { data: ['物流運費', '紙箱包材費'], textStyle: { color: '#cbd5e1' } },
          grid: { top: '14%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
          xAxis: { type: 'category', data: names, axisLabel: { color: '#cbd5e1', fontSize: 11, rotate: 18 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#94a3b8' } },
          series: [
            { name: '物流運費', type: 'bar', stack: 'cost', barWidth: '45%', itemStyle: { color: '#38bdf8' }, data: shipFees },
            { name: '紙箱包材費', type: 'bar', stack: 'cost', barWidth: '45%', itemStyle: { color: '#4ade80', borderRadius: [4, 4, 0, 0] }, data: boxCosts }
          ]
        }, true);
        this.carrierChartInstance.resize();
      }

      if (this.$refs.boxCostChart) {
        if (!this.boxChartInstance) {
          this.boxChartInstance = echarts.init(this.$refs.boxCostChart);
        }
        const topBoxes = this.boxList.slice(0, 12);
        const bNames = topBoxes.map(b => b.boxNo);
        const bCounts = topBoxes.map(b => b.count);
        const bAvgCosts = topBoxes.map(b => b.avgTotalCost);

        this.boxChartInstance.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          legend: { data: ['使用箱數', '單件總成本(元)'], textStyle: { color: '#cbd5e1' } },
          grid: { top: '14%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
          xAxis: { type: 'category', data: bNames, axisLabel: { color: '#cbd5e1', fontSize: 11, rotate: 20 } },
          yAxis: [
            { type: 'value', name: '箱數', nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#94a3b8' } },
            { type: 'value', name: '單件成本($)', nameTextStyle: { color: '#facc15' }, splitLine: { show: false }, axisLabel: { color: '#facc15' } }
          ],
          series: [
            { name: '使用箱數', type: 'bar', barWidth: '42%', itemStyle: { color: '#818cf8', borderRadius: [4, 4, 0, 0] }, data: bCounts },
            { name: '單件總成本(元)', type: 'line', yAxisIndex: 1, smooth: true, itemStyle: { color: '#facc15' }, lineStyle: { width: 2.5 }, data: bAvgCosts }
          ]
        }, true);
        this.boxChartInstance.resize();
      }
    }
  }
}
</script>

<style scoped>
.cost-analysis-page {
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
.btn-group { margin-left: auto; }

.sub-tabs-bar {
  display: flex;
  gap: 8px;
  border-top: 1px solid #334155;
  padding-top: 6px;
  flex-wrap: wrap;
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
  color: #facc15;
  border-bottom-color: #facc15;
  background: rgba(250, 204, 21, 0.08);
  border-radius: 4px 4px 0 0;
}
.warn-tab.active {
  color: #c084fc;
  border-bottom-color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
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
}
.border-gold { border-top: 4px solid #facc15; }
.border-blue { border-top: 4px solid #38bdf8; }
.border-green { border-top: 4px solid #4ade80; }
.border-purple { border-top: 4px solid #c084fc; }

.kpi-head { display: flex; justify-content: space-between; align-items: center; }
.kpi-title { font-size: 13px; font-weight: bold; color: #cbd5e1; }
.kpi-badge { font-size: 11px; color: #94a3b8; background: #0f172a; padding: 2px 6px; border-radius: 4px; }
.kpi-val { font-size: 24px; font-weight: bold; margin: 2px 0; }
.kpi-sub { font-size: 11px; color: #94a3b8; }

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

.table-scroll { overflow-x: auto; max-height: 440px; }
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
.row-split-extra td { background: rgba(192, 132, 252, 0.12) !important; }

.rate-badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.rate-ok { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.rate-mid { background: rgba(250, 204, 21, 0.2); color: #facc15; }
.rate-high { background: rgba(248, 113, 113, 0.2); color: #f87171; }

.box-flag { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.flag-first { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.flag-extra { background: rgba(192, 132, 252, 0.25); color: #e9d5ff; border: 1px solid rgba(192, 132, 252, 0.5); }

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-yellow { color: #facc15; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fb923c; }
.text-purple { color: #c084fc; }
.text-red { color: #f87171; }
.text-dim { color: #64748b; }
.font-bold { font-weight: bold; }
.copyable { cursor: pointer; }
.copyable:hover { text-decoration: underline; }
</style>