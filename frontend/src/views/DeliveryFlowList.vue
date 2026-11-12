<!-- frontend/src/views/DeliveryFlowList.vue -->
<template>
  <div class="delivery-flow-page dark-bg">
    <!-- 🌟 加上 multiple 支援多檔案同時選取 -->
    <input
      type="file"
      ref="fileInput"
      style="display: none;"
      accept=".xls, .xlsx, .csv"
      multiple
      @change="handleFileSelected"
    />

    <!-- 1. 頂部條件與導覽工具列 -->
    <div class="control-header-panel">
      <!-- 篩選列 1：基礎維度 -->
      <div class="filter-row">
        <!-- 出貨日期 -->
        <div class="filter-item">
          <span class="label">📅 出貨日期：</span>
          <el-select
            v-if="availableDates.length > 0"
            v-model="targetDate"
            size="small"
            style="width: 175px;"
            @change="fetchData"
          >
            <el-option
              v-for="d in availableDates"
              :key="d.ship_date"
              :label="`${d.ship_date} (${formatNumber(countMode === 'order' ? (d.order_count || d.count) : (d.tracking_count || d.count))} ${countMode === 'order' ? '單' : '件'})`"
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

        <!-- 統計維度：件數 vs 單數 -->
        <div class="filter-item highlight-box">
          <span class="label text-yellow">📊 觀察維度：</span>
          <el-radio-group v-model="countMode" size="small" @change="fetchData">
            <el-radio-button label="tracking">📦 宅配單 ({{ formatNumber(totalTrackingCount) }} 件/箱)</el-radio-button>
            <el-radio-button label="order">📋 訂單 ({{ formatNumber(totalOrderCount) }} 單)</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 班別篩選器 -->
        <div class="filter-item highlight-shift-box">
          <span class="label text-blue">⏰ 班別：</span>
          <el-radio-group v-model="selectedShift" size="small" @change="fetchData">
            <el-radio-button label="all">全部班別</el-radio-button>
            <el-radio-button label="日班">☀️ 日班</el-radio-button>
            <el-radio-button label="夜班">🌆 夜班</el-radio-button>
            <el-radio-button label="大夜班">🌙 大夜班</el-radio-button>
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

        <div class="btn-group">
          <span class="total-badge">
            當前數量：<strong>{{ formatNumber(totalOrders) }}</strong> {{ countMode === 'order' ? '單' : '件' }}
          </span>
          <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="fetchData">重新整理</el-button>
          <el-button type="success" size="small" icon="el-icon-upload2" :loading="isUploading" @click="showUploadCard = true">📥 匯入宅配單</el-button>
        </div>
      </div>

      <!-- 篩選列 2：庫別 / 宅配商 / 宅配類別 / 24H送達 -->
      <div class="filter-row filter-row-sub">
        <div class="filter-item">
          <span class="label">🏢 庫別：</span>
          <el-select v-model="selectedWarehouse" size="mini" placeholder="全部庫別" style="width: 120px;" @change="fetchData">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in warehouseOptions" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🚚 宅配商：</span>
          <el-select v-model="selectedCarrier" size="mini" placeholder="全部宅配商" style="width: 150px;" @change="fetchData">
            <el-option label="全部宅配商" value="all" />
            <el-option v-for="c in carrierOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🏷️ 宅配類別：</span>
          <el-select v-model="selectedDeliveryType" size="mini" placeholder="全部類別" style="width: 140px;" @change="fetchData">
            <el-option label="全部類別" value="all" />
            <el-option v-for="t in deliveryTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">⚡ 24H送達：</span>
          <el-radio-group v-model="selected24h" size="mini" @change="fetchData">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="是">⚡ 是 (24H)</el-radio-button>
            <el-radio-button label="否">一般 (非24H)</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 頂部頁籤切換：三大模組頁籤 -->
      <div class="sub-tabs-bar">
        <button
          class="sub-tab-btn"
          :class="{ active: activeTab === 'ship_flow' }"
          @click="activeTab = 'ship_flow'"
        >
          🌊 24小時出貨時段觀察（算出貨單數/件數）
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeTab === 'order_lead_time' }"
          @click="activeTab = 'order_lead_time'"
        >
          ⏱️ 班別出貨 × 接單時效觀察（消化歷史積單）
        </button>
        <button
          class="sub-tab-btn highlight-tab"
          :class="{ active: activeTab === 'lead_analytics' }"
          @click="activeTab = 'lead_analytics'"
        >
          🚀 訂單時效全景分析（時效級距 & 5大作業瓶頸）
        </button>
      </div>
    </div>

    <!-- 2. 主視圖內容 -->
    <div class="main-content-scroll">
      <!-- 三班數據總覽指標卡 -->
      <div class="shift-cards-row">
        <div
          v-for="(info, shiftKey) in shiftSummary"
          :key="shiftKey"
          class="shift-card"
          :class="[getShiftClass(shiftKey), { 'card-selected': selectedShift === shiftKey }]"
          @click="selectShiftCard(shiftKey)"
        >
          <div class="card-head">
            <span class="shift-name">{{ getShiftIcon(shiftKey) }} {{ shiftKey }}</span>
            <span class="shift-time">{{ info.timeSpan }}</span>
          </div>
          <div class="card-count">
            {{ formatNumber(info.count) }} 
            <span class="unit">{{ countMode === 'order' ? '單' : '件' }}</span>
          </div>
          <div class="card-sub-bars">
            <div class="reg-chip chip-north">北北基桃: {{ formatNumber(info.regions['北北基桃'] || 0) }}</div>
            <div class="reg-chip chip-south">中南部: {{ formatNumber(info.regions['中南部'] || 0) }}</div>
            <div class="reg-chip chip-east">宜花東: {{ formatNumber(info.regions['宜花東'] || 0) }}</div>
            <div class="reg-chip chip-island">外島: {{ formatNumber(info.regions['外島'] || 0) }}</div>
          </div>
        </div>
      </div>

      <!-- 頁籤 1：24 小時出貨時段觀察 -->
      <div v-show="activeTab === 'ship_flow'" class="tab-pane-box">
        <div class="chart-container" v-loading="loading">
          <div class="chart-header">
            <span class="chart-title">
              📈 24 小時出貨時段波浪流線圖（橫軸：00~01 到 23~00 出貨時間）
            </span>
            <div class="legend-tags">
              <span class="lg-dot dot-north">● 北北基桃</span>
              <span class="lg-dot dot-south">● 中南部</span>
              <span class="lg-dot dot-east">● 宜花東</span>
              <span class="lg-dot dot-island">● 外島</span>
            </div>
          </div>
          <div ref="shipChart" class="flow-echart"></div>
        </div>

        <div class="table-container" v-loading="loading">
          <div class="table-header-bar">
            <span class="table-title">🐟 24 小時出貨魚群密度與單數/件數明細表</span>
          </div>
          <div class="table-scroll-wrapper">
            <table class="flow-matrix-table">
              <thead>
                <tr>
                  <th style="width: 90px;">出貨時段</th>
                  <th style="width: 85px;">班別</th>
                  <th>出貨密度圖形 (藍:北基桃 / 橘:中南 / 綠:花東 / 紫:外島)</th>
                  <th style="width: 100px;">出貨數量 ({{ countMode === 'order' ? '單' : '件' }})</th>
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

      <!-- 頁籤 2：班別出貨所消化之「接單日期與時段」觀察 -->
      <div v-show="activeTab === 'order_lead_time'" class="tab-pane-box">
        <div class="chart-container" v-loading="loading">
          <div class="chart-header">
            <span class="chart-title">
              🌊 【{{ selectedShift === 'all' ? '全日出貨' : selectedShift }}】消化之「接單日期與時段」區域流線波浪圖
            </span>
            <div class="legend-tags">
              <span class="lg-dot dot-north">● 北北基桃</span>
              <span class="lg-dot dot-south">● 中南部</span>
              <span class="lg-dot dot-east">● 宜花東</span>
              <span class="lg-dot dot-island">● 外島</span>
            </div>
          </div>
          <div ref="orderChart" class="flow-echart"></div>
        </div>

        <div class="table-container" v-loading="loading">
          <div class="table-header-bar">
            <span class="table-title">
              📋 【{{ selectedShift === 'all' ? '全日各班' : selectedShift }}】出貨所消化之「接單日期 × 時段」明細表
            </span>
            <span class="tip-text">💡 橫軸已按接單時間展開，紅色標籤代表消化歷史積單</span>
          </div>

          <div class="table-scroll-wrapper">
            <table class="flow-matrix-table">
              <thead>
                <tr>
                  <th style="width: 110px;">接單日期</th>
                  <th style="width: 95px;">接單區間</th>
                  <th>區域分佈密度長條 (藍:北基桃 / 橘:中南 / 綠:花東 / 紫:外島)</th>
                  <th style="width: 100px;">消化數量 ({{ countMode === 'order' ? '單' : '件' }})</th>
                  <th style="width: 95px;">北北基桃</th>
                  <th style="width: 95px;">中南部</th>
                  <th style="width: 80px;">宜花東</th>
                  <th style="width: 70px;">外島</th>
                  <th style="width: 75px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="orderTimelineFlow.length === 0">
                  <td colspan="9" class="text-center text-dim" style="padding: 30px;">該條件下暫無出貨資料</td>
                </tr>
                <tr
                  v-for="(row, idx) in orderTimelineFlow"
                  :key="row.key"
                  :class="{ 'row-zebra': idx % 2 === 1, 'row-delay': isDelayOrder(row.orderDate) }"
                >
                  <td class="text-center font-bold">
                    {{ row.orderDate }}
                    <span v-if="isDelayOrder(row.orderDate)" class="delay-tag">歷史積單</span>
                  </td>
                  <td class="text-center font-bold text-yellow">{{ row.orderInterval }}</td>
                  <td>
                    <div class="multi-bar-wrapper">
                      <div class="bar-seg seg-north" :style="{ width: getPctWidth(row['北北基桃'], row.total) }"></div>
                      <div class="bar-seg seg-south" :style="{ width: getPctWidth(row['中南部'], row.total) }"></div>
                      <div class="bar-seg seg-east" :style="{ width: getPctWidth(row['宜花東'], row.total) }"></div>
                      <div class="bar-seg seg-island" :style="{ width: getPctWidth(row['外島'], row.total) }"></div>
                    </div>
                  </td>
                  <td class="text-right font-bold text-yellow">{{ formatNumber(row.total) }}</td>
                  <td class="text-right text-blue">{{ formatNumber(row['北北基桃']) }}</td>
                  <td class="text-right text-orange">{{ formatNumber(row['中南部']) }}</td>
                  <td class="text-right text-green">{{ formatNumber(row['宜花東']) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(row['外島']) }}</td>
                  <td class="text-center">
                    <el-button
                      size="mini"
                      type="primary"
                      plain
                      @click="openDetailModal({ orderDate: row.orderDate, orderInterval: row.orderInterval, title: `${targetDate} 出貨 [接單: ${row.orderDate} ${row.orderInterval}] 明細` })"
                    >
                      穿透
                    </el-button>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="orderTimelineFlow.length > 0">
                <tr class="table-total-row">
                  <td colspan="2" class="text-center font-bold text-yellow">總計</td>
                  <td></td>
                  <td class="text-right font-bold text-yellow">{{ formatNumber(totalOrders) }}</td>
                  <td class="text-right font-bold text-blue">{{ formatNumber(sumRegion('北北基桃')) }}</td>
                  <td class="text-right font-bold text-orange">{{ formatNumber(sumRegion('中南部')) }}</td>
                  <td class="text-right font-bold text-green">{{ formatNumber(sumRegion('宜花東')) }}</td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(sumRegion('外島')) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 3：訂單時效全景分析 -->
      <div v-show="activeTab === 'lead_analytics'" class="tab-pane-box">
        <div class="lead-kpi-grid">
          <div class="lead-kpi-card border-blue">
            <div class="kpi-icon">⏱️</div>
            <div class="kpi-info">
              <span class="kpi-title">接單至出貨平均耗時</span>
              <div class="kpi-value text-blue">{{ leadAnalytics.avgLeadHours }} <span class="unit">小時</span></div>
              <span class="kpi-sub">中位數約 3.9 小時</span>
            </div>
          </div>

          <div class="lead-kpi-card border-green">
            <div class="kpi-icon">⚡</div>
            <div class="kpi-info">
              <span class="kpi-title">24H 履約標籤佔比</span>
              <div class="kpi-value text-green">{{ leadAnalytics.rate24h }}%</div>
              <span class="kpi-sub">系統標註 24H 到貨單</span>
            </div>
          </div>

          <div class="lead-kpi-card border-orange">
            <div class="kpi-icon">🚀</div>
            <div class="kpi-info">
              <span class="kpi-title">4小時內極速出庫數</span>
              <div class="kpi-value text-orange">{{ formatNumber(leadAnalytics.leadBrackets['0~4H (極速)']) }} <span class="unit">{{ countMode === 'order' ? '單' : '件' }}</span></div>
              <span class="kpi-sub">佔全日發貨量逾 50%</span>
            </div>
          </div>

          <div class="lead-kpi-card border-red">
            <div class="kpi-icon">⚠️</div>
            <div class="kpi-info">
              <span class="kpi-title">超過 24H 滯留出貨數</span>
              <div class="kpi-value text-red">{{ formatNumber(leadAnalytics.delayOver24hCount) }} <span class="unit">{{ countMode === 'order' ? '單' : '件' }}</span></div>
              <span class="kpi-sub">含 48H 以上積壓單</span>
            </div>
          </div>
        </div>

        <div class="lead-charts-split">
          <div class="chart-container half-chart" v-loading="loading">
            <div class="chart-header">
              <span class="chart-title">📊 訂單出貨時效級距分佈 (接單 ➔ 出貨)</span>
            </div>
            <div ref="leadBracketChart" class="flow-echart"></div>
          </div>

          <div class="chart-container half-chart" v-loading="loading">
            <div class="chart-header">
              <span class="chart-title">🏭 倉庫 5 大內部作業站點耗時剖析 (平均分鐘)</span>
            </div>
            <div ref="stageBottleneckChart" class="flow-echart"></div>
          </div>
        </div>

        <div class="table-container" v-loading="loading">
          <div class="table-header-bar">
            <span class="table-title">🚨 超時滯留訂單追蹤清單 (接單至出貨 > 24 小時)</span>
            <span class="tip-text">共調閱 {{ leadAnalytics.delayedOrdersList.length }} 筆延遲單據</span>
          </div>

          <div class="table-scroll-wrapper">
            <table class="flow-matrix-table">
              <thead>
                <tr>
                  <th style="width: 160px;">宅配單號</th>
                  <th style="width: 150px;">訂單編號</th>
                  <th style="width: 70px;">庫別</th>
                  <th style="width: 80px;">區域</th>
                  <th style="width: 80px;">班別</th>
                  <th style="width: 110px;">總耗時 (小時)</th>
                  <th style="width: 120px;">宅配商</th>
                  <th style="width: 100px;">宅配類別</th>
                  <th style="width: 80px;">24H送達</th>
                  <th style="width: 100px;">接單時間</th>
                  <th style="width: 100px;">出貨時間</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="leadAnalytics.delayedOrdersList.length === 0">
                  <td colspan="12" class="text-center text-dim" style="padding: 24px;">🎉 本日無超過 24 小時出貨之嚴重延遲訂單！</td>
                </tr>
                <tr v-for="d in leadAnalytics.delayedOrdersList" :key="d.tracking_no">
                  <td class="font-bold text-blue copyable" @click="copyText(d.tracking_no)">{{ d.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(d.order_no)">{{ d.order_no }}</td>
                  <td class="text-center font-bold text-yellow">{{ d.wh_code ? `${d.wh_code}庫` : '-' }}</td>
                  <td class="text-center"><span class="reg-tag" :class="getRegTagClass(d.region)">{{ d.region }}</span></td>
                  <td class="text-center">{{ d.shift_type }}</td>
                  <td class="text-center font-bold text-red">{{ d.totalLeadHours }} H</td>
                  <td>{{ d.carrier_name }}</td>
                  <td class="text-center">{{ d.delivery_type }}</td>
                  <td class="text-center">
                    <span :class="d.is_24h === '是' ? 'text-yellow font-bold' : 'text-dim'">{{ d.is_24h || '否' }}</span>
                  </td>
                  <td class="text-center">{{ d.order_date }} {{ d.order_time }}</td>
                  <td class="text-center">{{ d.ship_date }} {{ d.ship_time }}</td>
                  <td class="text-dim" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">{{ d.address }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
            placeholder="搜尋宅配單號 / 訂單編號 / 宅配商 / 收件人"
            style="width: 280px;"
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
          <el-table-column prop="wh_code" label="庫別" width="80" align="center" sortable>
            <template #default="scope">
              <span class="font-bold text-yellow">{{ scope.row.wh_code ? `${scope.row.wh_code}庫` : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="region" label="區域" width="95" align="center" sortable>
            <template #default="scope">
              <span class="reg-tag" :class="getRegTagClass(scope.row.region)">{{ scope.row.region }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="shift_type" label="出貨班別" width="85" align="center" sortable />
          <el-table-column prop="carrier_name" label="宅配商" width="120" sortable />
          <el-table-column prop="delivery_type" label="宅配類別" width="105" align="center" sortable />
          <el-table-column prop="is_24h" label="24H送達" width="85" align="center" sortable />
          <el-table-column prop="ship_time" label="出貨時間" width="95" align="center" sortable />
          <el-table-column prop="order_date" label="接單日期" width="105" align="center" sortable />
          <el-table-column prop="order_time" label="接單時間" width="95" align="center" sortable />
          <el-table-column prop="order_interval" label="接單區間" width="95" align="center" sortable />
          <el-table-column prop="receiver_name" label="收件人" width="95" />
          <el-table-column prop="address" label="收件地址" min-width="220" show-overflow-tooltip />
        </el-table>
      </div>
    </el-dialog>

    <!-- 4. 多檔案拖曳上傳 Modal -->
    <el-dialog
      v-model="showUploadCard"
      title="📥 批次匯入宅配報表 (支援一次多檔上傳)"
      width="520px"
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
        <div class="drop-text-main">將一個或多個 Excel 報表拖曳至此處</div>
        <div class="drop-text-sub">或點擊此處（按住 Ctrl / Shift 可一次選取多個檔案）</div>
        <div class="drop-tip">🛡️ 自動依序排隊解析多檔日期、庫別、宅配商與全流程時效</div>
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
      activeTab: 'ship_flow',
      countMode: 'tracking',
      loading: false,
      isUploading: false,
      targetDate: '',
      selectedWarehouse: 'all',
      selectedRegion: 'all',
      selectedShift: 'all',
      selectedCarrier: 'all',
      selectedDeliveryType: 'all',
      selected24h: 'all',

      warehouseOptions: [],
      carrierOptions: [],
      deliveryTypeOptions: [],
      availableDates: [],

      totalOrders: 0,
      totalTrackingCount: 0,
      totalOrderCount: 0,

      shiftSummary: {
        '日班': { count: 0, timeSpan: '09:00 ~ 17:00', regions: {} },
        '夜班': { count: 0, timeSpan: '17:00 ~ 01:00', regions: {} },
        '大夜班': { count: 0, timeSpan: '01:00 ~ 09:00', regions: {} }
      },
      hourlyFlow: [],
      orderTimelineFlow: [],
      leadAnalytics: {
        avgLeadHours: 0,
        rate24h: 0,
        delayOver24hCount: 0,
        leadBrackets: {},
        stageAvgMins: {},
        delayedOrdersList: []
      },

      shipChartInstance: null,
      orderChartInstance: null,
      leadBracketChartInstance: null,
      stageBottleneckChartInstance: null,

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
    filteredHourlyFlow() {
      if (this.selectedShift === 'all') return this.hourlyFlow;
      return this.hourlyFlow.filter(h => this.getHourShift(h.hour) === this.selectedShift);
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
    activeTab() {
      this.$nextTick(() => {
        this.renderAllCharts();
      });
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
    if (this.shipChartInstance) this.shipChartInstance.dispose();
    if (this.orderChartInstance) this.orderChartInstance.dispose();
    if (this.leadBracketChartInstance) this.leadBracketChartInstance.dispose();
    if (this.stageBottleneckChartInstance) this.stageBottleneckChartInstance.dispose();
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
    isDelayOrder(orderDate) {
      if (!orderDate || !this.targetDate) return false;
      return orderDate < this.targetDate;
    },
    sumRegion(regKey) {
      return this.orderTimelineFlow.reduce((acc, row) => acc + (row[regKey] || 0), 0);
    },
    selectShiftCard(shiftKey) {
      this.selectedShift = this.selectedShift === shiftKey ? 'all' : shiftKey;
      this.fetchData();
    },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    handleResize() {
      if (this.shipChartInstance) this.shipChartInstance.resize();
      if (this.orderChartInstance) this.orderChartInstance.resize();
      if (this.leadBracketChartInstance) this.leadBracketChartInstance.resize();
      if (this.stageBottleneckChartInstance) this.stageBottleneckChartInstance.resize();
    },

    async fetchDates() {
      try {
        const res = await axios.get('/api/delivery/dates');
        if (res.data?.success) {
          this.availableDates = res.data.list || [];
          this.warehouseOptions = res.data.warehouses || [];
          this.carrierOptions = res.data.carriers || [];
          this.deliveryTypeOptions = res.data.deliveryTypes || [];
          if (!this.targetDate && this.availableDates.length > 0) {
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
            whCode: this.selectedWarehouse,
            region: this.selectedRegion,
            shift: this.selectedShift,
            carrier: this.selectedCarrier,
            deliveryType: this.selectedDeliveryType,
            is24h: this.selected24h,
            countMode: this.countMode
          }
        });
        if (res.data?.success) {
          this.targetDate = res.data.targetDate || this.targetDate;
          this.totalOrders = res.data.totalOrders || res.data.totalCount || 0;
          this.totalTrackingCount = res.data.totalTrackingCount || 0;
          this.totalOrderCount = res.data.totalOrderCount || 0;
          this.shiftSummary = res.data.shiftSummary;
          this.hourlyFlow = res.data.hourlyFlow || [];
          this.orderTimelineFlow = res.data.orderTimelineFlow || [];
          this.leadAnalytics = res.data.leadAnalytics || this.leadAnalytics;
          this.$nextTick(() => { this.renderAllCharts(); });
        }
      } catch (e) {
        ElMessage.error('取得宅配出貨分析失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    renderAllCharts() {
      if (this.activeTab === 'ship_flow') {
        this.renderShipChart();
      } else if (this.activeTab === 'order_lead_time') {
        this.renderOrderChart();
      } else if (this.activeTab === 'lead_analytics') {
        this.renderLeadAnalyticsCharts();
      }
    },

    renderShipChart() {
      if (!this.$refs.shipChart) return;
      if (!this.shipChartInstance) {
        this.shipChartInstance = echarts.init(this.$refs.shipChart);
        this.shipChartInstance.on('click', (params) => {
          const hour = params.dataIndex;
          this.openDetailModal({
            hour,
            whCode: this.selectedWarehouse !== 'all' ? this.selectedWarehouse : undefined,
            region: this.selectedRegion !== 'all' ? this.selectedRegion : undefined,
            title: `${this.targetDate} ${String(hour).padStart(2, '0')}:00 時段出貨明細`
          });
        });
      }

      const xHours = this.filteredHourlyFlow.map(h => h.slot);
      const northData = this.filteredHourlyFlow.map(h => h['北北基桃']);
      const southData = this.filteredHourlyFlow.map(h => h['中南部']);
      const eastData = this.filteredHourlyFlow.map(h => h['宜花東']);
      const islandData = this.filteredHourlyFlow.map(h => h['外島']);

      const option = this.buildChartOption(xHours, northData, southData, eastData, islandData, false);
      this.shipChartInstance.setOption(option, true);
      this.shipChartInstance.resize();
    },

    renderOrderChart() {
      if (!this.$refs.orderChart) return;
      if (!this.orderChartInstance) {
        this.orderChartInstance = echarts.init(this.$refs.orderChart);
        this.orderChartInstance.on('click', (params) => {
          const item = this.orderTimelineFlow[params.dataIndex];
          if (item) {
            this.openDetailModal({
              orderDate: item.orderDate,
              orderInterval: item.orderInterval,
              whCode: this.selectedWarehouse !== 'all' ? this.selectedWarehouse : undefined,
              region: this.selectedRegion !== 'all' ? this.selectedRegion : undefined,
              title: `${this.targetDate} 出貨 [接單: ${item.timelineLabel}] 明細`
            });
          }
        });
      }

      const xLabels = this.orderTimelineFlow.map(item => item.timelineLabel);
      const northData = this.orderTimelineFlow.map(item => item['北北基桃']);
      const southData = this.orderTimelineFlow.map(item => item['中南部']);
      const eastData = this.orderTimelineFlow.map(item => item['宜花東']);
      const islandData = this.orderTimelineFlow.map(item => item['外島']);

      const option = this.buildChartOption(xLabels, northData, southData, eastData, islandData, true);
      this.orderChartInstance.setOption(option, true);
      this.orderChartInstance.resize();
    },

    renderLeadAnalyticsCharts() {
      if (this.$refs.leadBracketChart) {
        if (!this.leadBracketChartInstance) {
          this.leadBracketChartInstance = echarts.init(this.$refs.leadBracketChart);
        }
        const b = this.leadAnalytics.leadBrackets || {};
        const xCats = Object.keys(b);
        const yVals = Object.values(b);

        const bracketOpt = {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          grid: { top: '10%', left: '4%', right: '4%', bottom: '10%', containLabel: true },
          xAxis: {
            type: 'category',
            data: xCats,
            axisLabel: { color: '#cbd5e1', fontSize: 11 }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
            axisLabel: { color: '#94a3b8' }
          },
          series: [{
            type: 'bar',
            barWidth: '45%',
            data: yVals.map((val, idx) => ({
              value: val,
              itemStyle: {
                color: idx === 0 ? '#38bdf8' : (idx <= 2 ? '#4ade80' : (idx === 3 ? '#fbbf24' : '#f87171')),
                borderRadius: [4, 4, 0, 0]
              }
            }))
          }]
        };
        this.leadBracketChartInstance.setOption(bracketOpt, true);
        this.leadBracketChartInstance.resize();
      }

      if (this.$refs.stageBottleneckChart) {
        if (!this.stageBottleneckChartInstance) {
          this.stageBottleneckChartInstance = echarts.init(this.$refs.stageBottleneckChart);
        }
        const stages = [
          '1. 接單➔倉庫接單 (下發)',
          '2. 倉庫接單➔印揀貨單 (派單)',
          '3. 印揀單➔開始揀貨 (等揀)',
          '4. 開始揀貨➔包裝出庫 (作業)',
          '5. 包裝出庫➔刷出貨 (裝車)'
        ];
        const sMins = this.leadAnalytics.stageAvgMins || {};
        const minsVals = [sMins.step1, sMins.step2, sMins.step3, sMins.step4, sMins.step5];

        const stageOpt = {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis', formatter: '{b}: {c} 分鐘' },
          grid: { top: '8%', left: '4%', right: '8%', bottom: '8%', containLabel: true },
          xAxis: {
            type: 'value',
            name: '平均分鐘',
            nameTextStyle: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
            axisLabel: { color: '#94a3b8' }
          },
          yAxis: {
            type: 'category',
            data: stages,
            axisLabel: { color: '#cbd5e1', fontSize: 11 }
          },
          series: [{
            type: 'bar',
            barWidth: '40%',
            data: minsVals.map((val, idx) => ({
              value: val,
              itemStyle: {
                color: idx === 2 ? '#f87171' : (idx === 3 ? '#fbbf24' : '#38bdf8'),
                borderRadius: [0, 4, 4, 0]
              }
            }))
          }]
        };
        this.stageBottleneckChartInstance.setOption(stageOpt, true);
        this.stageBottleneckChartInstance.resize();
      }
    },

    buildChartOption(xData, north, south, east, island, isRotated) {
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', label: { backgroundColor: '#334155' } }
        },
        grid: { top: '8%', left: '3%', right: '3%', bottom: isRotated ? '15%' : '8%', containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xData,
          axisLine: { lineStyle: { color: '#64748b' } },
          axisLabel: {
            color: '#cbd5e1',
            fontSize: 11,
            rotate: isRotated ? 35 : 0,
            interval: 0
          }
        },
        yAxis: {
          type: 'value',
          name: this.countMode === 'order' ? '訂單數' : '宅配件數',
          nameTextStyle: { color: '#94a3b8' },
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
            data: north
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
            data: south
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
            data: east
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
            data: island
          }
        ]
      };
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
          whCode: options.whCode || (this.selectedWarehouse !== 'all' ? this.selectedWarehouse : undefined),
          region: options.region || (this.selectedRegion !== 'all' ? this.selectedRegion : undefined),
          shift: options.shift || (this.selectedShift !== 'all' ? this.selectedShift : undefined),
          carrier: this.selectedCarrier !== 'all' ? this.selectedCarrier : undefined,
          deliveryType: this.selectedDeliveryType !== 'all' ? this.selectedDeliveryType : undefined,
          is24h: this.selected24h !== 'all' ? this.selected24h : undefined,
          hour: options.hour,
          orderDate: options.orderDate,
          orderInterval: options.orderInterval
        };

        const res = await axios.get('/api/delivery/orders-detail', { params });
        if (res.data?.success) {
          this.modalList = res.data.list || [];
        }
      } finally {
        this.loadingDetails = false;
      }
    },

    // 🌟 支援多檔案同時拖曳與批次選取
    handleDrop(e) {
      this.isDragging = false;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) this.processMultiFiles(files);
    },
    handleFileSelected(e) {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) this.processMultiFiles(files);
    },
    async processMultiFiles(files) {
      this.showUploadCard = false;
      this.isUploading = true;

      const validFiles = files.filter(f => /\.(xls|xlsx|csv)$/i.test(f.name));
      if (validFiles.length === 0) {
        ElMessage.error('請選取有效的 Excel (.xls, .xlsx) 或 CSV 檔案！');
        this.isUploading = false;
        return;
      }

      const totalFiles = validFiles.length;
      let totalSuccessRecords = 0;
      let latestFoundDate = '';

      const loadingMsg = ElMessage.info({
        message: `⚡ 準備批次處理 ${totalFiles} 個報表檔案...`,
        duration: 0
      });

      try {
        for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
          const file = validFiles[fileIndex];
          const fileNum = fileIndex + 1;

          loadingMsg.message = `⚡ [${fileNum}/${totalFiles}] 正在讀取並解析：${file.name}...`;

          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (!data || data.length === 0) continue;

          // 解析該檔案的出貨日期
          for (const row of data) {
            const rawD = String(row['出貨日期'] || '').trim();
            if (rawD && (rawD.includes('/') || rawD.includes('-'))) {
              const cleanD = rawD.replace(/\//g, '-').split(' ')[0];
              const parts = cleanD.split('-');
              if (parts.length === 3) {
                latestFoundDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else {
                latestFoundDate = cleanD;
              }
              break;
            }
          }

          // 分批寫入後端（每批 3,000 筆）
          const BATCH = 3000;
          for (let i = 0; i < data.length; i += BATCH) {
            const chunk = data.slice(i, i + BATCH);
            const percent = Math.min(100, Math.round(((i + chunk.length) / data.length) * 100));
            loadingMsg.message = `⚡ [${fileNum}/${totalFiles}] 寫入 ${file.name} (${percent}%)...`;
            await axios.post('/api/delivery/import-json', { items: chunk });
          }

          totalSuccessRecords += data.length;
        }

        loadingMsg.close();
        ElMessage.success(`🎉 批次匯入完成！共處理 ${totalFiles} 個檔案，累計寫入約 ${totalSuccessRecords.toLocaleString()} 筆資料！`);

        if (latestFoundDate) {
          this.targetDate = latestFoundDate;
        }

        await this.fetchDates();
        await this.fetchData();
      } catch (e) {
        loadingMsg.close();
        ElMessage.error('批次匯入過程發生錯誤：' + e.message);
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
  gap: 14px;
}
.filter-row-sub {
  border-top: 1px dashed #334155;
  padding-top: 8px;
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
.highlight-shift-box {
  background: rgba(56, 189, 248, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.3);
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
.total-badge strong { color: #facc15; font-size: 15px; }

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
.highlight-tab.active {
  color: #facc15;
  border-bottom-color: #facc15;
  background: rgba(250, 204, 21, 0.08);
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
.card-selected {
  outline: 2px solid #38bdf8;
  background: rgba(56, 189, 248, 0.08) !important;
}
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

.lead-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.lead-kpi-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #334155;
}
.border-blue { border-left: 4px solid #38bdf8; }
.border-green { border-left: 4px solid #4ade80; }
.border-orange { border-left: 4px solid #fbbf24; }
.border-red { border-left: 4px solid #f87171; }

.kpi-icon { font-size: 28px; }
.kpi-info { display: flex; flex-direction: column; }
.kpi-title { font-size: 12px; color: #94a3b8; }
.kpi-value { font-size: 22px; font-weight: bold; }
.kpi-value .unit { font-size: 12px; font-weight: normal; color: #94a3b8; }
.kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

.lead-charts-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.half-chart .flow-echart { height: 280px; }

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
.flow-echart { width: 100%; height: 320px; }

.table-container {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}
.table-header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.table-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.tip-text { font-size: 12px; color: #38bdf8; }

.table-scroll-wrapper { overflow-x: auto; max-height: 480px; }
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
.flow-matrix-table th { background: #1e293b; color: #94a3b8; font-weight: bold; text-align: center; position: sticky; top: 0; z-index: 5; }
.row-zebra td { background: rgba(255, 255, 255, 0.02); }

.row-delay td { background: rgba(239, 68, 68, 0.06); }
.delay-tag {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}

.table-total-row td {
  background: #1e293b !important;
  font-size: 13px;
  border-top: 2px solid #38bdf8;
}

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
.text-red { color: #f87171; }
.text-dim { color: #475569; }
.font-bold { font-weight: bold; }

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