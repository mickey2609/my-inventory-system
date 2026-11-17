<!-- frontend/src/views/DeliveryUndeliveredAnalysis.vue -->
<template>
  <div class="undelivered-page">
    <!-- 1. 頂部篩選控制面板 -->
    <div class="control-header-panel">
      <div class="filter-row">
        <!-- 區間 / 單日查詢模式（前 2 個頁籤顯示） -->
        <div class="filter-item" v-if="isRangeTab">
          <span class="label">📅 出貨日期：</span>

          <div class="date-stepper-group" v-if="querySpanMode === 'day'">
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftDay(-1)" title="切換至前一天">◀</el-button>
            <el-select
              v-if="availableDates.length > 0"
              v-model="targetDate"
              size="mini"
              style="width: 175px;"
              @change="onSingleDateChange"
            >
              <el-option
                v-for="d in availableDates"
                :key="d.ship_date"
                :label="`${d.ship_date} (${formatNumber(d.tracking_count || d.count)} 件)`"
                :value="d.ship_date"
              />
            </el-select>
            <el-date-picker
              v-else
              v-model="targetDate"
              type="date"
              size="mini"
              value-format="YYYY-MM-DD"
              placeholder="選擇出貨日期"
              style="width: 130px;"
              :clearable="false"
              @change="onSingleDateChange"
            />
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftDay(1)" title="切換至後一天">▶</el-button>
            <el-button size="mini" type="info" plain class="step-latest-btn" @click="jumpToLatestDate" title="跳至最新有資料的日期">最新</el-button>
          </div>

          <template v-else-if="querySpanMode === 'range'">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              size="mini"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="開始日期"
              end-placeholder="結束日期"
              style="width: 235px;"
              :clearable="false"
              @change="fetchUndelivered"
            />
          </template>

          <el-radio-group v-model="querySpanMode" size="mini" @change="handleSpanModeChange">
            <el-radio-button label="day">單日</el-radio-button>
            <el-radio-button label="7days">近7日</el-radio-button>
            <el-radio-button label="month">本月</el-radio-button>
            <el-radio-button label="range">區間</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 每月每日統計模式：月份步進器 -->
        <div class="filter-item" v-else-if="activeTab === 'monthly_stats'">
          <span class="label">🗓️ 統計月份：</span>
          <div class="date-stepper-group">
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftMonth(-1)">◀</el-button>
            <el-date-picker
              v-model="targetMonth"
              type="month"
              size="mini"
              value-format="YYYY-MM"
              placeholder="選擇月份"
              style="width: 125px;"
              :clearable="false"
              @change="fetchMonthlyStats"
            />
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftMonth(1)">▶</el-button>
          </div>
        </div>

        <!-- 年度每月統計模式：年份步進器 -->
        <div class="filter-item" v-else-if="activeTab === 'yearly_stats'">
          <span class="label">📅 統計年份：</span>
          <div class="date-stepper-group">
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftYear(-1)">◀</el-button>
            <el-date-picker
              v-model="targetYear"
              type="year"
              size="mini"
              value-format="YYYY"
              placeholder="選擇年份"
              style="width: 105px;"
              :clearable="false"
              @change="fetchYearlyStats"
            />
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftYear(1)">▶</el-button>
          </div>
        </div>

        <div class="filter-item">
          <span class="label">🏢 庫別：</span>
          <el-select v-model="selectedWarehouse" size="mini" style="width: 105px;" @change="refreshActiveTab">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in warehouseOptions" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🚚 宅配商：</span>
          <el-select v-model="selectedCarrier" size="mini" style="width: 140px;" @change="refreshActiveTab">
            <el-option label="全部宅配商" value="all" />
            <el-option v-for="c in carrierOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">📍 區域：</span>
          <el-select v-model="selectedRegion" size="mini" style="width: 110px;" @change="refreshActiveTab">
            <el-option label="全部區域" value="all" />
            <el-option label="北北基桃" value="北北基桃" />
            <el-option label="中南部" value="中南部" />
            <el-option label="宜花東" value="宜花東" />
            <el-option label="外島" value="外島" />
          </el-select>
        </div>

        <div class="filter-item" v-if="isRangeTab">
          <el-input
            v-model="keyword"
            size="mini"
            placeholder="🔍 宅配單號 / 訂單號 / 姓名"
            style="width: 185px;"
            clearable
            @keyup.enter="fetchUndelivered"
          />
        </div>

        <div class="btn-group">
          <el-button type="primary" size="mini" icon="el-icon-refresh" :loading="loading" @click="refreshActiveTab">查詢</el-button>
          <el-button v-if="isRangeTab" type="success" size="mini" icon="el-icon-download" :disabled="displayUndeliveredList.length === 0" @click="exportUndeliveredExcel">
            📊 匯出清單 ({{ displayUndeliveredList.length }})
          </el-button>
        </div>
      </div>

      <!-- 子頁籤切換 -->
      <div class="sub-tabs-bar">
        <button class="sub-tab-btn alert-tab" :class="{ active: activeTab === 'tracking_list' }" @click="switchTab('tracking_list')">
          🚨 尚未配達分類追蹤 ({{ formatNumber(kpi.undeliveredCount) }} 件)
        </button>
        <button class="sub-tab-btn" :class="{ active: activeTab === 'carrier_trend' }" @click="switchTab('carrier_trend')">
          📊 各宅配商完妥率與每日趨勢
        </button>
        <button class="sub-tab-btn summary-tab" :class="{ active: activeTab === 'monthly_stats' }" @click="switchTab('monthly_stats')">
          🗓️ 每月每日配達統計
        </button>
        <button class="sub-tab-btn summary-tab" :class="{ active: activeTab === 'yearly_stats' }" @click="switchTab('yearly_stats')">
          📅 年度每月配達統計
        </button>
      </div>
    </div>

    <!-- 2. 主內容區 -->
    <div class="main-content-scroll" v-loading="loading">
      <!-- 四大核心異常追蹤 KPI 卡片（區間/單日頁籤顯示） -->
      <div class="kpi-cards-row" v-if="isRangeTab">
        <div class="kpi-card border-blue" :class="{ 'card-selected': statusCategory === 'all' && selectedGroupKey === 'all' }" @click="resetAllFilters">
          <div class="kpi-head">
            <span class="kpi-title">🚚 純宅配出貨總件數 (排除超取)</span>
            <span class="kpi-badge text-green">完妥率 {{ kpi.deliveredRate }}%</span>
          </div>
          <div class="kpi-val text-blue">
            {{ formatNumber(kpi.deliveredCount) }} <span class="unit">已達</span>
            / <span class="text-red">{{ formatNumber(kpi.undeliveredCount) }}</span> <span class="unit text-red">未達</span>
          </div>
          <div class="kpi-sub">
            區間總資料 {{ formatNumber(kpi.totalRawCount) }} 筆（已排除純超取 {{ formatNumber(kpi.excludedCvsCount) }} 筆）
          </div>
        </div>

        <div class="kpi-card border-red" :class="{ 'card-selected': statusCategory === 'reject_return' }" @click="selectCategory('reject_return')">
          <div class="kpi-head">
            <span class="kpi-title">🚨 拒收／退回異常件</span>
            <span class="kpi-badge text-red">最高優先處理</span>
          </div>
          <div class="kpi-val text-red">{{ formatNumber(kpi.rejectReturnCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">狀態含「拒收、退回、退貨、異常」之未配達包裹</div>
        </div>

        <div class="kpi-card border-orange" :class="{ 'card-selected': statusCategory === 'overdue_transit' }" @click="selectCategory('overdue_transit')">
          <div class="kpi-head">
            <span class="kpi-title">⚠️ 超時滯留未達 (&gt;48 小時)</span>
            <span class="kpi-badge text-orange">需向物流催件</span>
          </div>
          <div class="kpi-val text-orange">{{ formatNumber(kpi.overdueTransitCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">非拒收退回，但已超過 2 天仍無配達日期</div>
        </div>

        <div class="kpi-card border-gold" :class="{ 'card-selected': statusCategory === 'normal_transit' }" @click="selectCategory('normal_transit')">
          <div class="kpi-head">
            <span class="kpi-title">⏳ 正常配送在途 (≤48 小時)</span>
            <span class="kpi-badge">觀察中</span>
          </div>
          <div class="kpi-val text-yellow">{{ formatNumber(kpi.normalTransitCount) }} <span class="unit">件</span></div>
          <div class="kpi-sub">剛出貨 2 天內尚在正常轉運或到店待取中之貨件</div>
        </div>
      </div>

      <!-- 頁籤 1：雙欄「左側：智慧貨態分組摘要 ＋ 右側：追蹤單據明細表」 -->
      <div v-show="activeTab === 'tracking_list'" class="split-workspace">
        <div class="left-group-panel">
          <div class="panel-head">
            <span>📋 貨態智慧歸納總覽</span>
            <span v-if="selectedGroupKey !== 'all' || selectedRawStatus !== ''" class="clear-link" @click="clearLeftFilter">顯示全部</span>
          </div>

          <div class="group-list-scroll">
            <div
              class="group-item-card"
              :class="{ active: selectedGroupKey === 'all' && selectedRawStatus === '' }"
              @click="clearLeftFilter"
            >
              <div class="gi-top">
                <span class="gi-title">📦 全部未配達貨件</span>
                <span class="gi-count text-yellow">{{ formatNumber(undeliveredList.length) }}</span>
              </div>
              <div class="gi-desc">點擊下方任一貨態群組可快速過濾右側明細</div>
            </div>

            <div
              v-for="grp in groupedStatusSummary"
              :key="grp.key"
              class="group-item-card"
              :class="[{ active: selectedGroupKey === grp.key && selectedRawStatus === '' }, `grp-border-${grp.level}`]"
              @click="selectGroup(grp.key)"
            >
              <div class="gi-top">
                <span class="gi-title">{{ grp.label }}</span>
                <span class="gi-count" :class="`text-${grp.color}`">{{ formatNumber(grp.count) }}</span>
              </div>
              <div class="gi-desc">{{ grp.actionHint }}</div>

              <div class="gi-sub-list" v-if="grp.subStatuses.length > 0">
                <div
                  v-for="sub in grp.subStatuses"
                  :key="sub.status"
                  class="gi-sub-row"
                  :class="{ 'sub-active': selectedRawStatus === sub.status }"
                  @click.stop="selectSubStatus(grp.key, sub.status)"
                >
                  <span class="sub-name" :title="sub.status">{{ sub.status }}</span>
                  <span class="sub-cnt">{{ formatNumber(sub.count) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="right-table-panel">
          <div class="table-header">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span class="table-title">
                🚨 {{ currentFilterTitle }}（共 {{ formatNumber(displayUndeliveredList.length) }} 件）
              </span>
            </div>
            <span class="tip-text">💡 點擊宅配單號或訂單編號可直接複製</span>
          </div>

          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 120px;">處理優先級</th>
                  <th style="width: 165px;">目前配送狀態</th>
                  <th style="width: 130px;">宅配單號</th>
                  <th style="width: 135px;">訂單編號</th>
                  <th style="width: 65px;">庫別</th>
                  <th style="width: 110px;">宅配商</th>
                  <th style="width: 125px;">出貨時間</th>
                  <th style="width: 85px;">經過天數</th>
                  <th style="width: 85px;">收件人</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="displayUndeliveredList.length === 0">
                  <td colspan="10" class="text-center text-green font-bold" style="padding: 36px;">
                    🎉 該篩選條件下無尚未配達貨件！
                  </td>
                </tr>
                <tr
                  v-for="u in displayUndeliveredList"
                  :key="u.tracking_no"
                  :class="u.anomalyType === 'reject_return' ? 'row-reject' : (u.anomalyType === 'overdue_transit' ? 'row-overdue' : '')"
                >
                  <td class="text-center">
                    <span class="anom-badge" :class="`anom-${u.anomalyType}`">{{ u.anomalyLabel }}</span>
                  </td>
                  <td>
                    <span class="status-pill" :title="u.rawStatus">{{ u.rawStatus }}</span>
                  </td>
                  <td class="font-bold text-blue copyable" @click="copyText(u.tracking_no)">{{ u.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(u.order_no)">{{ u.order_no }}</td>
                  <td class="text-center font-bold text-yellow">{{ u.wh_code ? `${u.wh_code}庫` : '-' }}</td>
                  <td class="font-bold">{{ u.carrier_name }}</td>
                  <td class="text-center text-dim">{{ u.ship_date }} {{ u.ship_time }}</td>
                  <td class="text-right font-bold" :class="u.elapsedDays >= 2 ? 'text-red' : 'text-yellow'">
                    {{ u.elapsedDays }} 天
                  </td>
                  <td class="text-center">{{ u.receiver_name || '-' }}</td>
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

      <!-- 頁籤 3：每月每日配達統計 -->
      <div v-show="activeTab === 'monthly_stats'" class="tab-pane-box">
        <div class="table-card" v-loading="loadingMonthly">
          <div class="table-header">
            <span class="table-title">🗓️ {{ targetMonth }} 月份每日純宅配配達與未達統計總表（已排除超取）</span>
            <span class="tip-text">
              全月純宅配 {{ formatNumber(monthlyTotalSummary.homeTotal) }} 件，已配達 {{ formatNumber(monthlyTotalSummary.deliveredCount) }} 件，未配達 {{ formatNumber(monthlyTotalSummary.undeliveredCount) }} 件
            </span>
          </div>
          <div class="table-scroll" style="max-height: calc(100vh - 210px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>出貨日期</th>
                  <th>純宅配總件數</th>
                  <th>已排除超取</th>
                  <th>已配達 (有配達日)</th>
                  <th>尚未配達 (空白)</th>
                  <th>配達完妥率</th>
                  <th>🚨 拒收/退回</th>
                  <th>⚠️ 超時滯留(&gt;48H)</th>
                  <th>⏳ 正常在途(≤48H)</th>
                  <th>遲到率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="monthlyDailyList.length === 0">
                  <td colspan="11" class="text-center text-dim" style="padding: 30px;">{{ targetMonth }} 月份尚無匯入出貨資料</td>
                </tr>
                <tr v-for="(d, idx) in monthlyDailyList" :key="d.date" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold">{{ d.date }}</td>
                  <td class="text-right font-bold text-blue">{{ formatNumber(d.homeTotal) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(d.excludedCvs) }}</td>
                  <td class="text-right text-green font-bold">{{ formatNumber(d.deliveredCount) }}</td>
                  <td class="text-right text-red font-bold">{{ formatNumber(d.undeliveredCount) }}</td>
                  <td class="text-center">
                    <span class="rate-badge" :class="d.deliveredRate >= 98 ? 'rate-ok' : (d.deliveredRate >= 90 ? 'rate-mid' : 'rate-high')">
                      {{ d.deliveredRate }}%
                    </span>
                  </td>
                  <td class="text-right text-red font-bold">{{ formatNumber(d.rejectReturnCount) }}</td>
                  <td class="text-right text-orange font-bold">{{ formatNumber(d.overdueCount) }}</td>
                  <td class="text-right text-yellow">{{ formatNumber(d.normalTransitCount) }}</td>
                  <td class="text-center">{{ d.lateRate }}%</td>
                  <td class="text-center">
                    <el-button size="mini" type="primary" plain @click="jumpToDailyTracking(d.date)">看當日明細</el-button>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="monthlyDailyList.length > 0">
                <tr class="table-total-row">
                  <td class="text-center font-bold text-yellow">全月總計</td>
                  <td class="text-right font-bold text-blue">{{ formatNumber(monthlyTotalSummary.homeTotal) }}</td>
                  <td class="text-right font-bold text-dim">{{ formatNumber(monthlyTotalSummary.excludedCvs) }}</td>
                  <td class="text-right font-bold text-green">{{ formatNumber(monthlyTotalSummary.deliveredCount) }}</td>
                  <td class="text-right font-bold text-red">{{ formatNumber(monthlyTotalSummary.undeliveredCount) }}</td>
                  <td class="text-center font-bold text-green">
                    {{ monthlyTotalSummary.homeTotal > 0 ? ((monthlyTotalSummary.deliveredCount / monthlyTotalSummary.homeTotal) * 100).toFixed(1) : '0.0' }}%
                  </td>
                  <td class="text-right font-bold text-red">{{ formatNumber(monthlyTotalSummary.rejectReturnCount) }}</td>
                  <td class="text-right font-bold text-orange">{{ formatNumber(monthlyTotalSummary.overdueCount) }}</td>
                  <td class="text-right font-bold text-yellow">{{ formatNumber(monthlyTotalSummary.normalTransitCount) }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 4：年度每月配達統計 -->
      <div v-show="activeTab === 'yearly_stats'" class="tab-pane-box">
        <div class="table-card" v-loading="loadingYearly">
          <div class="table-header">
            <span class="table-title">📅 {{ targetYear }} 年度每月純宅配配達與未達統計總表（已排除超取）</span>
            <span class="tip-text">
              全年純宅配 {{ formatNumber(yearlyTotalSummary.homeTotal) }} 件，已配達 {{ formatNumber(yearlyTotalSummary.deliveredCount) }} 件，未配達 {{ formatNumber(yearlyTotalSummary.undeliveredCount) }} 件
            </span>
          </div>
          <div class="table-scroll" style="max-height: calc(100vh - 210px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>統計月份</th>
                  <th>純宅配總件數</th>
                  <th>已排除超取</th>
                  <th>已配達 (有配達日)</th>
                  <th>尚未配達 (空白)</th>
                  <th>配達完妥率</th>
                  <th>🚨 拒收/退回</th>
                  <th>⚠️ 超時滯留(&gt;48H)</th>
                  <th>⏳ 正常在途(≤48H)</th>
                  <th>遲到率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, idx) in yearlyMonthlyList" :key="m.month" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold">{{ m.monthLabel }} ({{ m.month }})</td>
                  <td class="text-right font-bold text-blue">{{ formatNumber(m.homeTotal) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(m.excludedCvs) }}</td>
                  <td class="text-right text-green font-bold">{{ formatNumber(m.deliveredCount) }}</td>
                  <td class="text-right text-red font-bold">{{ formatNumber(m.undeliveredCount) }}</td>
                  <td class="text-center">
                    <span class="rate-badge" :class="m.deliveredRate >= 98 ? 'rate-ok' : (m.deliveredRate >= 90 ? 'rate-mid' : 'rate-high')">
                      {{ m.deliveredRate }}%
                    </span>
                  </td>
                  <td class="text-right text-red font-bold">{{ formatNumber(m.rejectReturnCount) }}</td>
                  <td class="text-right text-orange font-bold">{{ formatNumber(m.overdueCount) }}</td>
                  <td class="text-right text-yellow">{{ formatNumber(m.normalTransitCount) }}</td>
                  <td class="text-center">{{ m.lateRate }}%</td>
                  <td class="text-center">
                    <el-button size="mini" type="primary" plain :disabled="m.homeTotal === 0" @click="jumpToMonthlyStats(m.month)">看該月明細</el-button>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="yearlyMonthlyList.length > 0">
                <tr class="table-total-row">
                  <td class="text-center font-bold text-yellow">全年總計</td>
                  <td class="text-right font-bold text-blue">{{ formatNumber(yearlyTotalSummary.homeTotal) }}</td>
                  <td class="text-right font-bold text-dim">{{ formatNumber(yearlyTotalSummary.excludedCvs) }}</td>
                  <td class="text-right font-bold text-green">{{ formatNumber(yearlyTotalSummary.deliveredCount) }}</td>
                  <td class="text-right font-bold text-red">{{ formatNumber(yearlyTotalSummary.undeliveredCount) }}</td>
                  <td class="text-center font-bold text-green">
                    {{ yearlyTotalSummary.homeTotal > 0 ? ((yearlyTotalSummary.deliveredCount / yearlyTotalSummary.homeTotal) * 100).toFixed(1) : '0.0' }}%
                  </td>
                  <td class="text-right font-bold text-red">{{ formatNumber(yearlyTotalSummary.rejectReturnCount) }}</td>
                  <td class="text-right font-bold text-orange">{{ formatNumber(yearlyTotalSummary.overdueCount) }}</td>
                  <td class="text-right font-bold text-yellow">{{ formatNumber(yearlyTotalSummary.normalTransitCount) }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
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
      loadingMonthly: false,
      loadingYearly: false,
      activeTab: 'tracking_list',
      querySpanMode: 'day',
      targetDate: '',
      availableDates: [],
      dateRange: [],
      latestAvailableDate: '',
      targetMonth: new Date().toISOString().slice(0, 7),
      targetYear: new Date().getFullYear().toString(),

      selectedWarehouse: 'all',
      selectedCarrier: 'all',
      selectedRegion: 'all',
      statusCategory: 'all',
      selectedGroupKey: 'all',
      selectedRawStatus: '',
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
      monthlyDailyList: [],
      yearlyMonthlyList: [],

      dailyChartInstance: null,
      carrierChartInstance: null
    }
  },
  computed: {
    isRangeTab() {
      return ['tracking_list', 'carrier_trend'].includes(this.activeTab);
    },
    groupedStatusSummary() {
      const defs = [
        { key: 'reject_return', label: '🚨 拒收 / 退回異常', level: 'red', color: 'red', actionHint: '客戶拒收或已進入退貨流程，需通知客服' },
        { key: 'failed_contact', label: '📞 投遞失敗（不在 / 未接 / 再投）', level: 'orange', color: 'orange', actionHint: '司機電聯未接或不在家，已安排再投' },
        { key: 'addr_issue', label: '🏠 地址異常 / 客改址 / 轉寄', level: 'orange', color: 'orange', actionHint: '地址欠詳、送錯站所或申請改址轉寄' },
        { key: 'cvs_arrived', label: '🏪 已到超商門市 / i郵箱 / 招領', level: 'blue', color: 'blue', actionHint: '超速配/i郵箱/郵局招領已到點，待客戶取件' },
        { key: 'in_transit', label: '🚚 轉運 / 配送中', level: 'gold', color: 'yellow', actionHint: '正常物流幹線轉運與營業所配送中' },
        { key: 'station_hold', label: '📦 站所暫置 / 分貨 / 已上傳', level: 'gray', color: 'dim', actionHint: '剛交寄、分貨中或預約日期暫置營業所' }
      ];

      const buckets = {};
      defs.forEach(d => {
        buckets[d.key] = { ...d, count: 0, subMap: {} };
      });

      this.undeliveredList.forEach(item => {
        const gKey = this.classifyStatusGroup(item.rawStatus);
        const b = buckets[gKey] || buckets.station_hold;
        b.count++;
        const st = item.rawStatus || '未分類';
        b.subMap[st] = (b.subMap[st] || 0) + 1;
      });

      return defs
        .map(d => {
          const b = buckets[d.key];
          const subStatuses = Object.entries(b.subMap)
            .map(([status, count]) => ({ status, count }))
            .sort((a, c) => c.count - a.count);
          return {
            ...b,
            subStatuses
          };
        })
        .filter(g => g.count > 0);
    },
    displayUndeliveredList() {
      let list = this.undeliveredList;
      if (this.selectedRawStatus) {
        return list.filter(i => i.rawStatus === this.selectedRawStatus);
      }
      if (this.selectedGroupKey !== 'all') {
        return list.filter(i => this.classifyStatusGroup(i.rawStatus) === this.selectedGroupKey);
      }
      return list;
    },
    currentFilterTitle() {
      if (this.selectedRawStatus) return `狀態：【${this.selectedRawStatus}】`;
      if (this.selectedGroupKey !== 'all') {
        const g = this.groupedStatusSummary.find(x => x.key === this.selectedGroupKey);
        return g ? g.label : '篩選明細';
      }
      if (this.statusCategory === 'reject_return') return '🚨 拒收／退回異常件明細';
      if (this.statusCategory === 'overdue_transit') return '⚠️ 超時滯留未達 (>48H) 明細';
      if (this.statusCategory === 'normal_transit') return '⏳ 正常配送在途 (≤48H) 明細';
      return '全部尚未配達貨件追蹤明細';
    },
    monthlyTotalSummary() {
      return this.monthlyDailyList.reduce((acc, d) => {
        acc.homeTotal += Number(d.homeTotal || 0);
        acc.excludedCvs += Number(d.excludedCvs || 0);
        acc.deliveredCount += Number(d.deliveredCount || 0);
        acc.undeliveredCount += Number(d.undeliveredCount || 0);
        acc.rejectReturnCount += Number(d.rejectReturnCount || 0);
        acc.overdueCount += Number(d.overdueCount || 0);
        acc.normalTransitCount += Number(d.normalTransitCount || 0);
        return acc;
      }, { homeTotal: 0, excludedCvs: 0, deliveredCount: 0, undeliveredCount: 0, rejectReturnCount: 0, overdueCount: 0, normalTransitCount: 0 });
    },
    yearlyTotalSummary() {
      return this.yearlyMonthlyList.reduce((acc, m) => {
        acc.homeTotal += Number(m.homeTotal || 0);
        acc.excludedCvs += Number(m.excludedCvs || 0);
        acc.deliveredCount += Number(m.deliveredCount || 0);
        acc.undeliveredCount += Number(m.undeliveredCount || 0);
        acc.rejectReturnCount += Number(m.rejectReturnCount || 0);
        acc.overdueCount += Number(m.overdueCount || 0);
        acc.normalTransitCount += Number(m.normalTransitCount || 0);
        return acc;
      }, { homeTotal: 0, excludedCvs: 0, deliveredCount: 0, undeliveredCount: 0, rejectReturnCount: 0, overdueCount: 0, normalTransitCount: 0 });
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
    classifyStatusGroup(rawStatus) {
      const s = String(rawStatus || '');
      if (/拒收|退回|退貨|退件|異常|遺失/.test(s)) return 'reject_return';
      if (/投遞不成功|不在|無人|未接|再投|約定再配/.test(s)) return 'failed_contact';
      if (/地址|客改址|轉寄|送錯/.test(s)) return 'addr_issue';
      if (/送達超商|到達i郵箱|到達支局|招領|到站自領/.test(s)) return 'cvs_arrived';
      if (/轉運|配送中|投遞中|運輸途中|配送/.test(s)) return 'in_transit';
      return 'station_hold';
    },
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    handleResize() {
      if (this.dailyChartInstance) this.dailyChartInstance.resize();
      if (this.carrierChartInstance) this.carrierChartInstance.resize();
    },
    clearLeftFilter() {
      this.selectedGroupKey = 'all';
      this.selectedRawStatus = '';
    },
    resetAllFilters() {
      this.statusCategory = 'all';
      this.selectedGroupKey = 'all';
      this.selectedRawStatus = '';
      this.activeTab = 'tracking_list';
      this.fetchUndelivered();
    },
    selectCategory(cat) {
      this.statusCategory = this.statusCategory === cat ? 'all' : cat;
      this.selectedGroupKey = 'all';
      this.selectedRawStatus = '';
      this.activeTab = 'tracking_list';
      this.fetchUndelivered();
    },
    selectGroup(gKey) {
      this.selectedRawStatus = '';
      this.selectedGroupKey = this.selectedGroupKey === gKey ? 'all' : gKey;
    },
    selectSubStatus(gKey, rawStatus) {
      this.selectedGroupKey = gKey;
      this.selectedRawStatus = this.selectedRawStatus === rawStatus ? '' : rawStatus;
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'monthly_stats') {
        if (this.targetDate) this.targetMonth = this.targetDate.slice(0, 7);
        this.fetchMonthlyStats();
      } else if (tab === 'yearly_stats') {
        if (this.targetDate) this.targetYear = this.targetDate.slice(0, 4);
        this.fetchYearlyStats();
      } else if (tab === 'carrier_trend') {
        this.$nextTick(() => this.renderCharts());
      }
    },
    refreshActiveTab() {
      if (this.activeTab === 'monthly_stats') this.fetchMonthlyStats();
      else if (this.activeTab === 'yearly_stats') this.fetchYearlyStats();
      else this.fetchUndelivered();
    },

    onSingleDateChange() {
      if (this.targetDate) {
        this.dateRange = [this.targetDate, this.targetDate];
        this.fetchUndelivered();
      }
    },
    shiftDay(offset) {
      if (this.availableDates.length > 0) {
        const idx = this.availableDates.findIndex(d => d.ship_date === this.targetDate);
        if (idx !== -1) {
          const targetIdx = idx - offset;
          if (targetIdx >= 0 && targetIdx < this.availableDates.length) {
            this.targetDate = this.availableDates[targetIdx].ship_date;
            this.onSingleDateChange();
          } else {
            ElMessage.info(offset < 0 ? '已是最早一筆匯入日期' : '已是最新一筆匯入日期');
          }
          return;
        }
      }
      const d = new Date(this.targetDate || new Date());
      d.setDate(d.getDate() + offset);
      this.targetDate = d.toISOString().split('T')[0];
      this.onSingleDateChange();
    },
    jumpToLatestDate() {
      if (this.availableDates.length > 0) {
        this.targetDate = this.availableDates[0].ship_date;
      } else {
        this.targetDate = new Date().toISOString().split('T')[0];
      }
      this.onSingleDateChange();
    },
    handleSpanModeChange(mode) {
      const base = this.targetDate || this.latestAvailableDate || new Date().toISOString().split('T')[0];
      if (mode === 'day') {
        this.targetDate = base;
        this.dateRange = [base, base];
      } else if (mode === '7days') {
        const dt = new Date(`${base}T00:00:00`);
        dt.setDate(dt.getDate() - 6);
        const start = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        this.dateRange = [start, base];
      } else if (mode === 'month') {
        const ym = base.slice(0, 7);
        this.dateRange = [`${ym}-01`, `${ym}-31`];
      }
      this.fetchUndelivered();
    },

    shiftMonth(offset) {
      const parts = (this.targetMonth || '').split('-');
      let y = parseInt(parts[0], 10) || new Date().getFullYear();
      let m = (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) + offset;
      if (m < 1) { m = 12; y--; }
      else if (m > 12) { m = 1; y++; }
      this.targetMonth = `${y}-${String(m).padStart(2, '0')}`;
      this.fetchMonthlyStats();
    },
    shiftYear(offset) {
      const y = (parseInt(this.targetYear, 10) || new Date().getFullYear()) + offset;
      this.targetYear = String(y);
      this.fetchYearlyStats();
    },
    jumpToDailyTracking(dateStr) {
      this.querySpanMode = 'day';
      this.targetDate = dateStr;
      this.dateRange = [dateStr, dateStr];
      this.activeTab = 'tracking_list';
      this.fetchUndelivered();
    },
    jumpToMonthlyStats(monthStr) {
      this.targetMonth = monthStr;
      this.activeTab = 'monthly_stats';
      this.fetchMonthlyStats();
    },
    getCommonFilterParams() {
      return {
        whCode: this.selectedWarehouse,
        carrier: this.selectedCarrier,
        region: this.selectedRegion
      };
    },

    async initOptions() {
      try {
        const res = await axios.get('/api/delivery/dates', { params: { dayMode: 'calendar' } });
        if (res.data?.success) {
          this.availableDates = res.data.list || [];
          this.warehouseOptions = res.data.warehouses || [];
          this.carrierOptions = (res.data.carriers || []).filter(c => !/超取|7-11|全家|萊爾富|OK|大智通|日翊/i.test(c));
          if (this.availableDates.length > 0) {
            this.latestAvailableDate = this.availableDates[0].ship_date;
            this.targetDate = this.latestAvailableDate;
            this.dateRange = [this.latestAvailableDate, this.latestAvailableDate];
            this.targetMonth = this.latestAvailableDate.slice(0, 7);
            this.targetYear = this.latestAvailableDate.slice(0, 4);
          }
        }
      } catch (e) {}
    },
    async fetchUndelivered() {
      this.loading = true;
      try {
        let [startDate, endDate] = this.dateRange || [];
        if (this.querySpanMode === 'day' && this.targetDate) {
          startDate = this.targetDate;
          endDate = this.targetDate;
        }
        const res = await axios.get('/api/delivery/undelivered-analysis', {
          params: {
            startDate,
            endDate,
            ...this.getCommonFilterParams(),
            statusCategory: this.statusCategory,
            keyword: this.keyword
          }
        });
        if (res.data?.success) {
          if (!this.targetDate && res.data.startDate) this.targetDate = res.data.startDate;
          if (!this.dateRange || this.dateRange.length === 0) this.dateRange = [res.data.startDate, res.data.endDate];
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
    async fetchMonthlyStats() {
      this.loadingMonthly = true;
      try {
        const res = await axios.get('/api/delivery/undelivered-monthly-summary', {
          params: { month: this.targetMonth, ...this.getCommonFilterParams() }
        });
        if (res.data?.success) {
          this.monthlyDailyList = res.data.dailyList || [];
        }
      } catch (e) {
        ElMessage.error('取得每月每日配達統計失敗：' + e.message);
      } finally {
        this.loadingMonthly = false;
      }
    },
    async fetchYearlyStats() {
      this.loadingYearly = true;
      try {
        const res = await axios.get('/api/delivery/undelivered-yearly-summary', {
          params: { year: this.targetYear, ...this.getCommonFilterParams() }
        });
        if (res.data?.success) {
          this.yearlyMonthlyList = res.data.monthlyList || [];
        }
      } catch (e) {
        ElMessage.error('取得年度每月配達統計失敗：' + e.message);
      } finally {
        this.loadingYearly = false;
      }
    },
    exportUndeliveredExcel() {
      const rows = this.displayUndeliveredList.map(u => ({
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
  gap: 10px;
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
.date-stepper-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  padding: 2px 5px;
  border-radius: 6px;
  border: 1px solid #334155;
}
.step-btn { padding: 5px 8px !important; font-weight: bold; }
.step-latest-btn { padding: 5px 8px !important; font-weight: bold; }
.btn-group { margin-left: auto; display: flex; gap: 8px; }

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
.summary-tab.active {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background: rgba(74, 222, 128, 0.08);
}

.main-content-scroll {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex-shrink: 0;
}
.kpi-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
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
.kpi-val { font-size: 22px; font-weight: bold; margin: 2px 0; }
.kpi-val .unit { font-size: 12px; font-weight: normal; color: #94a3b8; }
.kpi-sub { font-size: 11px; color: #94a3b8; }

.split-workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 12px;
  overflow: hidden;
  min-height: 0;
}

.left-group-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: bold;
  color: #f8fafc;
  padding-bottom: 8px;
  border-bottom: 1px solid #334155;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.clear-link {
  font-size: 11px;
  color: #38bdf8;
  cursor: pointer;
}
.clear-link:hover { text-decoration: underline; }

.group-list-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.group-item-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.group-item-card:hover { border-color: #38bdf8; }
.group-item-card.active {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
}
.grp-border-red { border-left: 3px solid #f87171; }
.grp-border-orange { border-left: 3px solid #fb923c; }
.grp-border-blue { border-left: 3px solid #38bdf8; }
.grp-border-gold { border-left: 3px solid #facc15; }
.grp-border-gray { border-left: 3px solid #64748b; }

.gi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gi-title { font-size: 13px; font-weight: bold; color: #f8fafc; }
.gi-count { font-size: 15px; font-weight: bold; }
.gi-desc { font-size: 11px; color: #64748b; margin-top: 2px; }

.gi-sub-list {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #334155;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gi-sub-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #cbd5e1;
  padding: 3px 6px;
  border-radius: 4px;
}
.gi-sub-row:hover { background: rgba(255, 255, 255, 0.06); }
.gi-sub-row.sub-active {
  background: #0284c7;
  color: #ffffff;
  font-weight: bold;
}
.sub-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 205px;
}
.sub-cnt { font-weight: bold; }

.right-table-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-pane-box {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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
.echart-box { width: 100%; height: 260px; }

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
  margin-bottom: 8px;
  flex-shrink: 0;
}
.table-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.tip-text { font-size: 12px; color: #38bdf8; }

.table-scroll {
  flex: 1;
  overflow: auto;
}
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
  padding: 6px 8px;
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

.table-total-row td {
  background: #1e293b !important;
  font-size: 13px;
  border-top: 2px solid #4ade80;
  position: sticky;
  bottom: 0;
  z-index: 5;
}

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