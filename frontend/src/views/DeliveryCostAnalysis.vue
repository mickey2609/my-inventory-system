<!-- frontend/src/views/DeliveryCostAnalysis.vue -->
<template>
  <div class="cost-analysis-page">
    <!-- 1. 頂部篩選控制面板 -->
    <div class="control-header-panel">
      <div class="filter-row">
        <!-- 智慧日期步進器 -->
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
              @change="fetchCostAnalysis"
            />
          </template>

          <el-radio-group v-model="querySpanMode" size="mini" @change="handleSpanModeChange">
            <el-radio-button label="day">單日</el-radio-button>
            <el-radio-button label="month">本月累計</el-radio-button>
            <el-radio-button label="range">區間</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 每月每日成本總表模式：月份選擇器 -->
        <div class="filter-item" v-else-if="activeTab === 'monthly_cost'">
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
              @change="fetchMonthlyCost"
            />
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftMonth(1)">▶</el-button>
          </div>
        </div>

        <!-- 年度每月成本總表模式：年份選擇器 -->
        <div class="filter-item" v-else-if="activeTab === 'yearly_cost'">
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
              @change="fetchYearlyCost"
            />
            <el-button size="mini" type="primary" plain class="step-btn" @click="shiftYear(1)">▶</el-button>
          </div>
        </div>

        <div class="filter-item">
          <span class="label">🏢 庫別：</span>
          <el-select v-model="selectedWarehouse" size="mini" style="width: 110px;" @change="refreshActiveTab">
            <el-option label="全部庫別" value="all" />
            <el-option v-for="w in warehouseOptions" :key="w" :label="`${w} 庫`" :value="w" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🚚 物流商：</span>
          <el-select v-model="selectedCarrier" size="mini" style="width: 145px;" @change="refreshActiveTab">
            <el-option label="全部物流商" value="all" />
            <el-option v-for="c in carrierOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">📦 箱號：</span>
          <el-select v-model="selectedBoxNo" size="mini" filterable style="width: 130px;" @change="refreshActiveTab">
            <el-option label="全部箱號" value="all" />
            <el-option v-for="b in boxNoOptions" :key="b" :label="b" :value="b" />
          </el-select>
        </div>

        <div class="filter-item">
          <span class="label">🏷️ 類別：</span>
          <el-select v-model="selectedDeliveryType" size="mini" style="width: 125px;" @change="refreshActiveTab">
            <el-option label="全部類別" value="all" />
            <el-option v-for="t in deliveryTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </div>

        <div class="filter-item" v-if="isRangeTab">
          <el-checkbox v-model="onlySplitBox" @change="fetchCostAnalysis">
            <span class="text-purple font-bold">僅看拆箱</span>
          </el-checkbox>
          <el-checkbox v-model="onlyLate" @change="fetchCostAnalysis">
            <span class="text-red font-bold">僅看遲到</span>
          </el-checkbox>
        </div>

        <div class="btn-group">
          <el-button type="primary" size="mini" icon="el-icon-refresh" :loading="loading" @click="refreshActiveTab">重新計算</el-button>
        </div>
      </div>

      <!-- 子頁籤切換 -->
      <div class="sub-tabs-bar">
        <button class="sub-tab-btn" :class="{ active: activeTab === 'carrier_box' }" @click="switchTab('carrier_box')">
          💰 物流商與包材成本總覽
        </button>
        <button class="sub-tab-btn box-tab" :class="{ active: activeTab === 'box_analysis' }" @click="switchTab('box_analysis')">
          📦 箱號耗用與材積異常分析 ({{ boxList.length }} 種)
        </button>
        <button class="sub-tab-btn" :class="{ active: activeTab === 'district_type' }" @click="switchTab('district_type')">
          📮 行政區熱點與宅配類別
        </button>
        <button class="sub-tab-btn warn-tab" :class="{ active: activeTab === 'split_audit' }" @click="switchTab('split_audit')">
          🔀 一單多箱拆箱稽核 ({{ formatNumber(kpi.splitOrderCount || 0) }} 單 / {{ formatNumber(kpi.splitBoxCount) }} 箱)
        </button>
        <button class="sub-tab-btn high-fee-tab" :class="{ active: activeTab === 'high_shipping' }" @click="switchTab('high_shipping')">
          🔥 高單價運費 (≥${{ highFeeThreshold }} / {{ formatNumber(kpi.highShippingTotalCount || highShippingList.length) }} 筆)
        </button>
        <button class="sub-tab-btn extra-fee-tab" :class="{ active: activeTab === 'extra_fee' }" @click="switchTab('extra_fee')">
          ➕ 額外加價明細 ({{ formatNumber(kpi.extraFeeTotalCount || extraFeeList.length) }} 筆)
        </button>
        <button class="sub-tab-btn summary-tab" :class="{ active: activeTab === 'monthly_cost' }" @click="switchTab('monthly_cost')">
          🗓️ 每月每日成本總表
        </button>
        <button class="sub-tab-btn summary-tab" :class="{ active: activeTab === 'yearly_cost' }" @click="switchTab('yearly_cost')">
          📅 年度每月成本總表
        </button>
      </div>
    </div>

    <!-- 2. 主內容區 -->
    <div class="main-content-scroll" v-loading="loading">
      <!-- 四大核心財務 KPI 卡片 -->
      <div class="kpi-cards-row" v-if="isRangeTab">
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
            （共 {{ boxList.length }} 種箱型）
          </div>
        </div>

        <div class="kpi-card border-purple">
          <div class="kpi-head">
            <span class="kpi-title">🔀 拆箱額外流失 (是否為第一箱=N)</span>
            <span class="kpi-badge text-red">遲到 {{ formatNumber(kpi.lateCount) }} 件 ({{ kpi.lateRate }}%)</span>
          </div>
          <div class="kpi-val text-purple">${{ formatMoney(kpi.splitBoxTotalLoss) }}</div>
          <div class="kpi-sub">
            涉及 <strong>{{ formatNumber(kpi.splitOrderCount || 0) }}</strong> 單 / 多拆 <strong>{{ formatNumber(kpi.splitBoxCount) }}</strong> 箱（運費 ${{ formatMoney(kpi.splitBoxShippingLoss) }} ＋ 包材 ${{ formatMoney(kpi.splitBoxMaterialLoss) }}）
          </div>
        </div>
      </div>

      <!-- 頁籤 1：物流商與包材成本總覽 -->
      <div v-show="activeTab === 'carrier_box'" class="tab-pane-box">
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
      </div>

      <!-- 頁籤 2：箱號耗用與材積異常深度分析 -->
      <div v-show="activeTab === 'box_analysis'" class="tab-pane-box">
        <div class="charts-grid-2">
          <div class="chart-card">
            <div class="chart-title">🥧 各箱號包材總支出佔比 (Top 10)</div>
            <div ref="boxSharePieChart" class="echart-box"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">📈 各箱號「箱子單價 vs 平均物流運費」對照</div>
            <div ref="boxFeeCompareChart" class="echart-box"></div>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">📦 全箱號耗用、包材費佔比與運費結構總表（依總履約成本排序）</span>
            <span class="tip-text">💡 點擊箱號可快速篩選該箱型，檢查包材耗用與主力配合物流商</span>
          </div>
          <div class="table-scroll" style="max-height: 440px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>箱號規格</th>
                  <th>使用箱數</th>
                  <th>箱數佔比</th>
                  <th>箱子單價</th>
                  <th>平均材積和</th>
                  <th>平均實重(kg)</th>
                  <th>包材費總計</th>
                  <th>包材費佔比</th>
                  <th>物流費總計</th>
                  <th>計費均運費</th>
                  <th>單件總成本</th>
                  <th>該箱總履約成本</th>
                  <th>總成本佔比</th>
                  <th>主力物流商</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(b, idx) in boxList" :key="b.boxNo" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center text-dim font-bold">#{{ idx + 1 }}</td>
                  <td class="text-center font-bold text-green copyable" @click="filterByBox(b.boxNo)">{{ b.boxNo }}</td>
                  <td class="text-right font-bold">{{ formatNumber(b.count) }}</td>
                  <td class="text-right text-dim">{{ b.countShare }}%</td>
                  <td class="text-right text-green">${{ b.unitBoxPrice.toFixed(2) }}</td>
                  <td class="text-right text-dim">{{ b.avgVolume }}</td>
                  <td class="text-right text-dim">{{ b.avgWeight || '-' }}</td>
                  <td class="text-right text-green font-bold">${{ formatMoney(b.boxCostSum) }}</td>
                  <td class="text-right text-green">{{ b.boxCostShare }}%</td>
                  <td class="text-right text-blue">${{ formatMoney(b.shippingFeeSum) }}</td>
                  <td class="text-right text-blue font-bold">${{ b.avgShippingFee.toFixed(2) }}</td>
                  <td class="text-right text-yellow">${{ b.avgTotalCost.toFixed(2) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(b.totalCostSum) }}</td>
                  <td class="text-right text-yellow font-bold">{{ b.totalCostShare }}%</td>
                  <td class="text-center text-dim">{{ b.topCarrier }}</td>
                </tr>
              </tbody>
              <tfoot v-if="boxList.length > 0">
                <tr class="table-total-row">
                  <td colspan="2" class="text-center font-bold text-yellow">全箱型合計</td>
                  <td class="text-right font-bold">{{ formatNumber(kpi.totalPackages) }}</td>
                  <td class="text-right">100%</td>
                  <td></td>
                  <td colspan="2"></td>
                  <td class="text-right font-bold text-green">${{ formatMoney(kpi.totalBoxCost) }}</td>
                  <td class="text-right text-green">100%</td>
                  <td class="text-right font-bold text-blue">${{ formatMoney(kpi.totalShippingFee) }}</td>
                  <td colspan="2"></td>
                  <td class="text-right font-bold text-yellow">${{ formatMoney(kpi.totalFulfillmentCost) }}</td>
                  <td class="text-right text-yellow">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <span class="table-title">⚠️ 「高單價大箱 (≥$8.5) 裝極輕物品 (實重 ≤0.35kg)」疑似包材浪費明細</span>
            <span class="tip-text">共檢出 {{ formatNumber(kpi.wastefulBoxTotalCount || wastefulBoxList.length) }} 筆（展示前 500 筆）</span>
          </div>
          <div class="table-scroll" style="max-height: 360px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配單號</th>
                  <th>訂單編號</th>
                  <th>出貨日期</th>
                  <th>物流商</th>
                  <th>使用箱號</th>
                  <th>箱號材積和</th>
                  <th>實際重量(kg)</th>
                  <th>箱子單價</th>
                  <th>物流費總計</th>
                  <th>單件總成本</th>
                  <th>預估可省差額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="wastefulBoxList.length === 0">
                  <td colspan="11" class="text-center text-dim" style="padding: 24px;">🎉 查詢區間內無「高單價大箱裝極輕物品」之異常紀錄！</td>
                </tr>
                <tr v-for="w in wastefulBoxList" :key="w.tracking_no">
                  <td class="font-bold text-blue copyable" @click="copyText(w.tracking_no)">{{ w.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(w.order_no)">{{ w.order_no }}</td>
                  <td class="text-center">{{ w.ship_date }}</td>
                  <td>{{ w.carrier_name }}</td>
                  <td class="text-center font-bold text-red">{{ w.box_no }}</td>
                  <td class="text-right">{{ w.box_volume }}</td>
                  <td class="text-right text-yellow font-bold">{{ w.actual_weight }} kg</td>
                  <td class="text-right text-red font-bold">${{ Number(w.box_price || 0).toFixed(2) }}</td>
                  <td class="text-right text-blue">${{ formatMoney(w.shipping_fee) }}</td>
                  <td class="text-right text-yellow font-bold">${{ Number(w.totalCost || 0).toFixed(2) }}</td>
                  <td class="text-right text-green font-bold">~${{ Number(w.estSave || 0).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 3：行政區熱點與宅配類別 -->
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

      <!-- 頁籤 4：一單多箱拆箱成本稽核 -->
      <div v-show="activeTab === 'split_audit'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">📊 拆箱類型合併統計表（同倉同日拆箱 vs 跨庫／分批拆箱）</span>
            <span class="tip-text">💡 區分「現場包裝一箱裝不下拆箱」與「跨庫/不同天分批出貨」，精準鎖定可合併省運費空間</span>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>拆箱類型分類</th>
                  <th>涉及訂單數</th>
                  <th>額外拆箱數 (N)</th>
                  <th>額外運費總計</th>
                  <th>額外包材費總計</th>
                  <th>額外總流失金額</th>
                  <th>佔總拆箱流失</th>
                  <th>平均每多拆1箱成本</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(st, idx) in splitSummaryList" :key="st.typeKey" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="font-bold" :class="st.typeKey === 'same_wh_same_day' ? 'text-purple' : 'text-blue'">{{ st.typeLabel }}</td>
                  <td class="text-right font-bold">{{ formatNumber(st.affectedOrders) }} 單</td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(st.extraBoxCount) }} 箱</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(st.shippingLoss) }}</td>
                  <td class="text-right text-green">${{ formatMoney(st.materialLoss) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(st.totalLoss) }}</td>
                  <td class="text-right font-bold">{{ st.lossShare }}%</td>
                  <td class="text-right text-orange font-bold">${{ st.avgLossPerExtraBox.toFixed(2) }}</td>
                </tr>
              </tbody>
              <tfoot v-if="splitSummaryList.length > 0">
                <tr class="table-total-row">
                  <td class="text-center font-bold text-yellow">合併總計</td>
                  <td class="text-right font-bold">{{ formatNumber(kpi.splitOrderCount || 0) }} 單</td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(kpi.splitBoxCount) }} 箱</td>
                  <td class="text-right font-bold text-blue">${{ formatMoney(kpi.splitBoxShippingLoss) }}</td>
                  <td class="text-right font-bold text-green">${{ formatMoney(kpi.splitBoxMaterialLoss) }}</td>
                  <td class="text-right font-bold text-yellow">${{ formatMoney(kpi.splitBoxTotalLoss) }}</td>
                  <td class="text-right">100%</td>
                  <td class="text-right text-orange font-bold">
                    ${{ kpi.splitBoxCount > 0 ? (kpi.splitBoxTotalLoss / kpi.splitBoxCount).toFixed(2) : '0.00' }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="table-card">
          <div class="table-header">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span class="table-title">🔀 一單多箱（拆箱）訂單分開明細對照</span>
              <el-radio-group v-model="splitFilterType" size="mini">
                <el-radio-button label="all">全部拆箱 ({{ filteredSplitOrdersDetail.length }})</el-radio-button>
                <el-radio-button label="same_wh_same_day">📦 同倉同日拆箱</el-radio-button>
                <el-radio-button label="cross_wh_or_batch">🏭 跨庫/分批拆箱</el-radio-button>
              </el-radio-group>
            </div>
            <span class="tip-text">Purple 標示列為額外拆箱 (is_first_box = N)，白色列為該訂單主箱 (Y)</span>
          </div>
          <div class="table-scroll" style="max-height: 480px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>訂單編號</th>
                  <th>拆箱分類</th>
                  <th>是否為第一箱</th>
                  <th>庫別</th>
                  <th>宅配單號</th>
                  <th>物流商</th>
                  <th>箱號</th>
                  <th>箱號材積和</th>
                  <th>箱子單價</th>
                  <th>物流費總計</th>
                  <th>單箱總成本</th>
                  <th>出貨時間</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredSplitOrdersDetail.length === 0">
                  <td colspan="13" class="text-center text-dim" style="padding: 28px;">該分類條件下無一單多箱拆箱紀錄</td>
                </tr>
                <tr
                  v-for="s in filteredSplitOrdersDetail"
                  :key="s.tracking_no"
                  :class="{ 'row-split-extra': s.is_first_box === 'N' }"
                >
                  <td class="font-bold text-orange copyable" @click="copyText(s.order_no)">{{ s.order_no }}</td>
                  <td class="text-center">
                    <span class="cat-badge" :class="s.splitCategory === 'same_wh_same_day' ? 'cat-same' : 'cat-cross'">
                      {{ s.splitCategory === 'same_wh_same_day' ? '同倉同日' : '跨庫/分批' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="box-flag" :class="s.is_first_box === 'N' ? 'flag-extra' : 'flag-first'">
                      {{ s.is_first_box === 'N' ? 'N (額外拆箱)' : 'Y (主箱)' }}
                    </span>
                  </td>
                  <td class="text-center font-bold text-yellow">{{ s.wh_code ? `${s.wh_code}庫` : '-' }}</td>
                  <td class="font-bold text-blue copyable" @click="copyText(s.tracking_no)">{{ s.tracking_no }}</td>
                  <td>{{ s.carrier_name }}</td>
                  <td class="text-center font-bold text-green">{{ s.box_no }}</td>
                  <td class="text-right">{{ s.box_volume }}</td>
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

      <!-- 頁籤 5：高單價運費明細 -->
      <div v-show="activeTab === 'high_shipping'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="table-title">🔥 高單價運費明細（單件物流費 ≥ ${{ highFeeThreshold }}，依金額由高至低排序）</span>
              <el-select v-model="highFeeThreshold" size="mini" style="width: 115px;" @change="fetchCostAnalysis">
                <el-option label="門檻 ≥ $100" :value="100" />
                <el-option label="門檻 ≥ $120" :value="120" />
                <el-option label="門檻 ≥ $150" :value="150" />
                <el-option label="門檻 ≥ $200" :value="200" />
              </el-select>
            </div>
            <span class="tip-text">共 {{ formatNumber(kpi.highShippingTotalCount || highShippingList.length) }} 筆高運費件</span>
          </div>
          <div class="table-scroll" style="max-height: 560px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配單號</th>
                  <th>訂單編號</th>
                  <th>物流商</th>
                  <th>宅配類別</th>
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
                <tr v-if="highShippingList.length === 0">
                  <td colspan="13" class="text-center text-dim" style="padding: 28px;">查詢區間內無單件運費 ≥ ${{ highFeeThreshold }} 之高運費紀錄</td>
                </tr>
                <tr v-for="h in highShippingList" :key="h.tracking_no">
                  <td class="font-bold text-blue copyable" @click="copyText(h.tracking_no)">{{ h.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(h.order_no)">{{ h.order_no }}</td>
                  <td>{{ h.carrier_name }}</td>
                  <td class="text-center">{{ h.delivery_type }}</td>
                  <td class="text-center font-bold text-green">{{ h.box_no }}</td>
                  <td class="text-right">{{ h.box_volume }}</td>
                  <td class="text-right">${{ formatMoney(h.base_fee) }}</td>
                  <td class="text-right text-orange">${{ formatMoney(h.extra_fee) }}</td>
                  <td class="text-right text-red font-bold">${{ formatMoney(h.shipping_fee) }}</td>
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

      <!-- 頁籤 6：額外加價明細 -->
      <div v-show="activeTab === 'extra_fee'" class="tab-pane-box">
        <div class="table-card">
          <div class="table-header">
            <span class="table-title">➕ 額外加價明細（假日加價 / 重量加價 / 超材加價 / 地區加價 &gt; 0）</span>
            <span class="tip-text">
              共 {{ formatNumber(kpi.extraFeeTotalCount || extraFeeList.length) }} 筆，額外加價總計 ${{ formatMoney(kpi.totalExtraFee) }} 元
            </span>
          </div>
          <div class="table-scroll" style="max-height: 560px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>宅配單號</th>
                  <th>訂單編號</th>
                  <th>出貨日期</th>
                  <th>物流商</th>
                  <th>箱號</th>
                  <th>基本運費</th>
                  <th>假日加價</th>
                  <th>重量加價</th>
                  <th>超材加價</th>
                  <th>地區加價</th>
                  <th>加價合計</th>
                  <th>物流費總計</th>
                  <th>郵遞區號</th>
                  <th>收件地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="extraFeeList.length === 0">
                  <td colspan="14" class="text-center text-dim" style="padding: 28px;">查詢區間內無任何額外加價紀錄</td>
                </tr>
                <tr v-for="e in extraFeeList" :key="e.tracking_no">
                  <td class="font-bold text-blue copyable" @click="copyText(e.tracking_no)">{{ e.tracking_no }}</td>
                  <td class="font-bold text-orange copyable" @click="copyText(e.order_no)">{{ e.order_no }}</td>
                  <td class="text-center">{{ e.ship_date }}</td>
                  <td>{{ e.carrier_name }}</td>
                  <td class="text-center font-bold text-green">{{ e.box_no }}</td>
                  <td class="text-right">${{ formatMoney(e.base_fee) }}</td>
                  <td class="text-right" :class="Number(e.holiday_fee) > 0 ? 'text-yellow font-bold' : 'text-dim'">${{ formatMoney(e.holiday_fee) }}</td>
                  <td class="text-right" :class="Number(e.weight_fee) > 0 ? 'text-orange font-bold' : 'text-dim'">${{ formatMoney(e.weight_fee) }}</td>
                  <td class="text-right" :class="Number(e.oversize_fee) > 0 ? 'text-purple font-bold' : 'text-dim'">${{ formatMoney(e.oversize_fee) }}</td>
                  <td class="text-right" :class="Number(e.remote_fee) > 0 ? 'text-red font-bold' : 'text-dim'">${{ formatMoney(e.remote_fee) }}</td>
                  <td class="text-right text-red font-bold">${{ formatMoney(e.extra_fee) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(e.shipping_fee) }}</td>
                  <td class="text-center">{{ e.zip_code }}</td>
                  <td class="text-dim">{{ e.address }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 7：每月每日成本總表 -->
      <div v-show="activeTab === 'monthly_cost'" class="tab-pane-box">
        <div class="table-card" v-loading="loadingMonthly">
          <div class="table-header">
            <span class="table-title">🗓️ {{ targetMonth }} 月份每日物流與包材成本總表</span>
            <span class="tip-text">
              全月共 {{ monthlyDailyList.length }} 個出貨日，累計總履約成本 ${{ formatMoney(monthlyTotalSummary.totalCost) }} 元
            </span>
          </div>
          <div class="table-scroll" style="max-height: calc(100vh - 210px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>出貨日期</th>
                  <th>總件數</th>
                  <th>總訂單數</th>
                  <th>物流運費總計</th>
                  <th>額外加價合計</th>
                  <th>紙箱包材總計</th>
                  <th>總履約成本</th>
                  <th>計費件均運費</th>
                  <th>單件總成本</th>
                  <th>拆箱訂單數</th>
                  <th>拆箱箱數</th>
                  <th>拆箱流失金額</th>
                  <th>遲到率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="monthlyDailyList.length === 0">
                  <td colspan="14" class="text-center text-dim" style="padding: 30px;">{{ targetMonth }} 月份尚無匯入出貨資料</td>
                </tr>
                <tr v-for="(d, idx) in monthlyDailyList" :key="d.date" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold">{{ d.date }}</td>
                  <td class="text-right font-bold">{{ formatNumber(d.totalPackages) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(d.totalOrders) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(d.shippingFee) }}</td>
                  <td class="text-right text-orange">${{ formatMoney(d.extraFee) }}</td>
                  <td class="text-right text-green">${{ formatMoney(d.boxCost) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(d.totalCost) }}</td>
                  <td class="text-right">${{ Number(d.avgBilledShippingFee || 0).toFixed(2) }}</td>
                  <td class="text-right">${{ Number(d.avgTotalCost || 0).toFixed(2) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(d.splitOrderCount || 0) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(d.splitBoxCount) }}</td>
                  <td class="text-right text-purple font-bold">${{ formatMoney(d.splitBoxLoss) }}</td>
                  <td class="text-center">
                    <span class="rate-badge" :class="d.lateRate >= 10 ? 'rate-high' : (d.lateRate >= 3 ? 'rate-mid' : 'rate-ok')">
                      {{ d.lateRate }}%
                    </span>
                  </td>
                  <td class="text-center">
                    <el-button size="mini" type="primary" plain @click="jumpToDailyCost(d.date)">看當日明細</el-button>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="monthlyDailyList.length > 0">
                <tr class="table-total-row">
                  <td class="text-center font-bold text-yellow">全月總計</td>
                  <td class="text-right font-bold">{{ formatNumber(monthlyTotalSummary.totalPackages) }}</td>
                  <td class="text-right font-bold">{{ formatNumber(monthlyTotalSummary.totalOrders) }}</td>
                  <td class="text-right font-bold text-blue">${{ formatMoney(monthlyTotalSummary.shippingFee) }}</td>
                  <td class="text-right font-bold text-orange">${{ formatMoney(monthlyTotalSummary.extraFee) }}</td>
                  <td class="text-right font-bold text-green">${{ formatMoney(monthlyTotalSummary.boxCost) }}</td>
                  <td class="text-right font-bold text-yellow">${{ formatMoney(monthlyTotalSummary.totalCost) }}</td>
                  <td colspan="2"></td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(monthlyTotalSummary.splitOrderCount) }}</td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(monthlyTotalSummary.splitBoxCount) }}</td>
                  <td class="text-right font-bold text-purple">${{ formatMoney(monthlyTotalSummary.splitBoxLoss) }}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- 頁籤 8：年度每月成本總表 -->
      <div v-show="activeTab === 'yearly_cost'" class="tab-pane-box">
        <div class="table-card" v-loading="loadingYearly">
          <div class="table-header">
            <span class="table-title">📅 {{ targetYear }} 年度每月物流與包材成本總表</span>
            <span class="tip-text">
              全年累計 {{ formatNumber(yearlyTotalSummary.totalPackages) }} 件，總履約成本 ${{ formatMoney(yearlyTotalSummary.totalCost) }} 元
            </span>
          </div>
          <div class="table-scroll" style="max-height: calc(100vh - 210px);">
            <table class="data-table">
              <thead>
                <tr>
                  <th>統計月份</th>
                  <th>總件數</th>
                  <th>總訂單數</th>
                  <th>物流運費總計</th>
                  <th>額外加價合計</th>
                  <th>紙箱包材總計</th>
                  <th>總履約成本</th>
                  <th>計費件均運費</th>
                  <th>單件總成本</th>
                  <th>拆箱訂單數</th>
                  <th>拆箱箱數</th>
                  <th>拆箱流失金額</th>
                  <th>遲到率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, idx) in yearlyMonthlyList" :key="m.month" :class="{ 'row-zebra': idx % 2 === 1 }">
                  <td class="text-center font-bold">{{ m.monthLabel }} ({{ m.month }})</td>
                  <td class="text-right font-bold">{{ formatNumber(m.totalPackages) }}</td>
                  <td class="text-right text-dim">{{ formatNumber(m.totalOrders) }}</td>
                  <td class="text-right text-blue font-bold">${{ formatMoney(m.shippingFee) }}</td>
                  <td class="text-right text-orange">${{ formatMoney(m.extraFee) }}</td>
                  <td class="text-right text-green">${{ formatMoney(m.boxCost) }}</td>
                  <td class="text-right text-yellow font-bold">${{ formatMoney(m.totalCost) }}</td>
                  <td class="text-right">${{ Number(m.avgBilledShippingFee || 0).toFixed(2) }}</td>
                  <td class="text-right">${{ Number(m.avgTotalCost || 0).toFixed(2) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(m.splitOrderCount || 0) }}</td>
                  <td class="text-right text-purple">{{ formatNumber(m.splitBoxCount) }}</td>
                  <td class="text-right text-purple font-bold">${{ formatMoney(m.splitBoxLoss) }}</td>
                  <td class="text-center">{{ m.lateRate }}%</td>
                  <td class="text-center">
                    <el-button size="mini" type="primary" plain :disabled="m.totalPackages === 0" @click="jumpToMonthlyCost(m.month)">看該月明細</el-button>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="yearlyMonthlyList.length > 0">
                <tr class="table-total-row">
                  <td class="text-center font-bold text-yellow">全年總計</td>
                  <td class="text-right font-bold">{{ formatNumber(yearlyTotalSummary.totalPackages) }}</td>
                  <td class="text-right font-bold">{{ formatNumber(yearlyTotalSummary.totalOrders) }}</td>
                  <td class="text-right font-bold text-blue">${{ formatMoney(yearlyTotalSummary.shippingFee) }}</td>
                  <td class="text-right font-bold text-orange">${{ formatMoney(yearlyTotalSummary.extraFee) }}</td>
                  <td class="text-right font-bold text-green">${{ formatMoney(yearlyTotalSummary.boxCost) }}</td>
                  <td class="text-right font-bold text-yellow">${{ formatMoney(yearlyTotalSummary.totalCost) }}</td>
                  <td colspan="2"></td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(yearlyTotalSummary.splitOrderCount) }}</td>
                  <td class="text-right font-bold text-purple">{{ formatNumber(yearlyTotalSummary.splitBoxCount) }}</td>
                  <td class="text-right font-bold text-purple">${{ formatMoney(yearlyTotalSummary.splitBoxLoss) }}</td>
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

export default {
  name: 'DeliveryCostAnalysis',
  data() {
    return {
      loading: false,
      loadingMonthly: false,
      loadingYearly: false,
      activeTab: 'carrier_box',
      querySpanMode: 'day',
      splitFilterType: 'all',
      targetDate: '',
      availableDates: [],
      dateRange: [],
      latestAvailableDate: '',
      targetMonth: new Date().toISOString().slice(0, 7),
      targetYear: new Date().getFullYear().toString(),
      highFeeThreshold: 120,

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
        splitOrderCount: 0,
        splitBoxShippingLoss: 0,
        splitBoxMaterialLoss: 0,
        splitBoxTotalLoss: 0,
        lateCount: 0,
        lateRate: 0,
        codCashCount: 0,
        highShippingTotalCount: 0,
        extraFeeTotalCount: 0,
        boxTypeCount: 0,
        wastefulBoxTotalCount: 0
      },
      splitSummaryList: [],
      carrierList: [],
      boxList: [],
      deliveryTypeList: [],
      districtTopList: [],
      splitOrdersDetail: [],
      highShippingList: [],
      extraFeeList: [],
      wastefulBoxList: [],
      monthlyDailyList: [],
      yearlyMonthlyList: [],

      carrierChartInstance: null,
      boxChartInstance: null,
      boxSharePieInstance: null,
      boxFeeCompareInstance: null
    }
  },
  computed: {
    isRangeTab() {
      return ['carrier_box', 'box_analysis', 'district_type', 'split_audit', 'high_shipping', 'extra_fee'].includes(this.activeTab);
    },
    filteredSplitOrdersDetail() {
      if (this.splitFilterType === 'all') return this.splitOrdersDetail;
      return this.splitOrdersDetail.filter(s => s.splitCategory === this.splitFilterType);
    },
    monthlyTotalSummary() {
      return this.monthlyDailyList.reduce((acc, d) => {
        acc.totalPackages += Number(d.totalPackages || 0);
        acc.totalOrders += Number(d.totalOrders || 0);
        acc.shippingFee += Number(d.shippingFee || 0);
        acc.extraFee += Number(d.extraFee || 0);
        acc.boxCost += Number(d.boxCost || 0);
        acc.totalCost += Number(d.totalCost || 0);
        acc.splitOrderCount += Number(d.splitOrderCount || 0);
        acc.splitBoxCount += Number(d.splitBoxCount || 0);
        acc.splitBoxLoss += Number(d.splitBoxLoss || 0);
        return acc;
      }, { totalPackages: 0, totalOrders: 0, shippingFee: 0, extraFee: 0, boxCost: 0, totalCost: 0, splitOrderCount: 0, splitBoxCount: 0, splitBoxLoss: 0 });
    },
    yearlyTotalSummary() {
      return this.yearlyMonthlyList.reduce((acc, m) => {
        acc.totalPackages += Number(m.totalPackages || 0);
        acc.totalOrders += Number(m.totalOrders || 0);
        acc.shippingFee += Number(m.shippingFee || 0);
        acc.extraFee += Number(m.extraFee || 0);
        acc.boxCost += Number(m.boxCost || 0);
        acc.totalCost += Number(m.totalCost || 0);
        acc.splitOrderCount += Number(m.splitOrderCount || 0);
        acc.splitBoxCount += Number(m.splitBoxCount || 0);
        acc.splitBoxLoss += Number(m.splitBoxLoss || 0);
        return acc;
      }, { totalPackages: 0, totalOrders: 0, shippingFee: 0, extraFee: 0, boxCost: 0, totalCost: 0, splitOrderCount: 0, splitBoxCount: 0, splitBoxLoss: 0 });
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
    if (this.boxSharePieInstance) this.boxSharePieInstance.dispose();
    if (this.boxFeeCompareInstance) this.boxFeeCompareInstance.dispose();
  },
  methods: {
    formatNumber(v) { return Number(v || 0).toLocaleString(); },
    formatMoney(v) {
      return Number(v || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },
    copyText(txt) {
      navigator.clipboard.writeText(txt).then(() => ElMessage.success(`📋 已複製單號：${txt}`));
    },
    filterByBox(boxNo) {
      this.selectedBoxNo = this.selectedBoxNo === boxNo ? 'all' : boxNo;
      this.fetchCostAnalysis();
    },
    handleResize() {
      if (this.carrierChartInstance) this.carrierChartInstance.resize();
      if (this.boxChartInstance) this.boxChartInstance.resize();
      if (this.boxSharePieInstance) this.boxSharePieInstance.resize();
      if (this.boxFeeCompareInstance) this.boxFeeCompareInstance.resize();
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'monthly_cost') {
        if (this.targetDate) this.targetMonth = this.targetDate.slice(0, 7);
        this.fetchMonthlyCost();
      } else if (tab === 'yearly_cost') {
        if (this.targetDate) this.targetYear = this.targetDate.slice(0, 4);
        this.fetchYearlyCost();
      } else if (tab === 'carrier_box' || tab === 'box_analysis') {
        this.$nextTick(() => this.renderCharts());
      }
    },
    refreshActiveTab() {
      if (this.activeTab === 'monthly_cost') this.fetchMonthlyCost();
      else if (this.activeTab === 'yearly_cost') this.fetchYearlyCost();
      else this.fetchCostAnalysis();
    },

    onSingleDateChange() {
      if (this.targetDate) {
        this.dateRange = [this.targetDate, this.targetDate];
        this.fetchCostAnalysis();
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
      if (mode === 'day') {
        const d = this.targetDate || this.latestAvailableDate || new Date().toISOString().split('T')[0];
        this.targetDate = d;
        this.dateRange = [d, d];
        this.fetchCostAnalysis();
      } else if (mode === 'month') {
        const base = this.targetDate || this.latestAvailableDate || new Date().toISOString().split('T')[0];
        const ym = base.slice(0, 7);
        this.dateRange = [`${ym}-01`, `${ym}-31`];
        this.fetchCostAnalysis();
      } else if (mode === 'range') {
        if (!this.dateRange || this.dateRange.length < 2) {
          const d = this.targetDate || this.latestAvailableDate || new Date().toISOString().split('T')[0];
          this.dateRange = [d, d];
        }
        this.fetchCostAnalysis();
      }
    },

    shiftMonth(offset) {
      const parts = (this.targetMonth || '').split('-');
      let y = parseInt(parts[0], 10) || new Date().getFullYear();
      let m = (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) + offset;
      if (m < 1) { m = 12; y--; }
      else if (m > 12) { m = 1; y++; }
      this.targetMonth = `${y}-${String(m).padStart(2, '0')}`;
      this.fetchMonthlyCost();
    },
    shiftYear(offset) {
      const y = (parseInt(this.targetYear, 10) || new Date().getFullYear()) + offset;
      this.targetYear = String(y);
      this.fetchYearlyCost();
    },
    jumpToDailyCost(dateStr) {
      this.querySpanMode = 'day';
      this.targetDate = dateStr;
      this.dateRange = [dateStr, dateStr];
      this.activeTab = 'carrier_box';
      this.fetchCostAnalysis();
    },
    jumpToMonthlyCost(monthStr) {
      this.targetMonth = monthStr;
      this.activeTab = 'monthly_cost';
      this.fetchMonthlyCost();
    },
    getCommonFilterParams() {
      return {
        whCode: this.selectedWarehouse,
        carrier: this.selectedCarrier,
        boxNo: this.selectedBoxNo,
        deliveryType: this.selectedDeliveryType
      };
    },
    async initOptions() {
      try {
        const res = await axios.get('/api/delivery/dates', { params: { dayMode: 'calendar' } });
        if (res.data?.success) {
          this.availableDates = res.data.list || [];
          this.warehouseOptions = res.data.warehouses || [];
          this.carrierOptions = res.data.carriers || [];
          this.deliveryTypeOptions = res.data.deliveryTypes || [];
          this.boxNoOptions = res.data.boxNos || [];
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
    async fetchCostAnalysis() {
      this.loading = true;
      try {
        let [startDate, endDate] = this.dateRange || [];
        if (this.querySpanMode === 'day' && this.targetDate) {
          startDate = this.targetDate;
          endDate = this.targetDate;
        }
        const res = await axios.get('/api/delivery/cost-analysis', {
          params: {
            startDate,
            endDate,
            ...this.getCommonFilterParams(),
            highFeeThreshold: this.highFeeThreshold,
            onlySplitBox: this.onlySplitBox ? 'true' : undefined,
            onlyLate: this.onlyLate ? 'true' : undefined
          }
        });
        if (res.data?.success) {
          if (!this.targetDate && res.data.startDate) {
            this.targetDate = res.data.startDate;
          }
          if (!this.dateRange || this.dateRange.length === 0) {
            this.dateRange = [res.data.startDate, res.data.endDate];
          }
          this.kpi = res.data.kpi || this.kpi;
          this.splitSummaryList = res.data.splitSummaryList || [];
          this.carrierList = res.data.carrierList || [];
          this.boxList = res.data.boxList || [];
          this.deliveryTypeList = res.data.deliveryTypeList || [];
          this.districtTopList = res.data.districtTopList || [];
          this.splitOrdersDetail = res.data.splitOrdersDetail || [];
          this.highShippingList = res.data.highShippingList || [];
          this.extraFeeList = res.data.extraFeeList || [];
          this.wastefulBoxList = res.data.wastefulBoxList || [];
          this.$nextTick(() => this.renderCharts());
        }
      } catch (e) {
        ElMessage.error('取得物流與包材成本分析失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },
    async fetchMonthlyCost() {
      this.loadingMonthly = true;
      try {
        const res = await axios.get('/api/delivery/cost-monthly-summary', {
          params: { month: this.targetMonth, ...this.getCommonFilterParams() }
        });
        if (res.data?.success) {
          this.monthlyDailyList = res.data.dailyList || [];
        }
      } catch (e) {
        ElMessage.error('取得每月每日成本總表失敗：' + e.message);
      } finally {
        this.loadingMonthly = false;
      }
    },
    async fetchYearlyCost() {
      this.loadingYearly = true;
      try {
        const res = await axios.get('/api/delivery/cost-yearly-summary', {
          params: { year: this.targetYear, ...this.getCommonFilterParams() }
        });
        if (res.data?.success) {
          this.yearlyMonthlyList = res.data.monthlyList || [];
        }
      } catch (e) {
        ElMessage.error('取得年度每月成本總表失敗：' + e.message);
      } finally {
        this.loadingYearly = false;
      }
    },
    renderCharts() {
      if (this.activeTab === 'carrier_box') {
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
          const topBoxes = [...this.boxList].sort((a, b) => b.count - a.count).slice(0, 12);
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

      if (this.activeTab === 'box_analysis') {
        if (this.$refs.boxSharePieChart) {
          if (!this.boxSharePieInstance) {
            this.boxSharePieInstance = echarts.init(this.$refs.boxSharePieChart);
          }
          const top10BoxCost = [...this.boxList]
            .sort((a, b) => b.boxCostSum - a.boxCostSum)
            .slice(0, 10)
            .map(b => ({ name: b.boxNo, value: b.boxCostSum }));

          this.boxSharePieInstance.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', formatter: '{b}: ${c} ({d}%)' },
            legend: { orient: 'vertical', right: '4%', top: 'center', textStyle: { color: '#cbd5e1', fontSize: 11 } },
            series: [{
              type: 'pie',
              radius: ['42%', '72%'],
              center: ['36%', '50%'],
              label: { color: '#f8fafc', formatter: '{b}\n{d}%' },
              data: top10BoxCost
            }]
          }, true);
          this.boxSharePieInstance.resize();
        }

        if (this.$refs.boxFeeCompareChart) {
          if (!this.boxFeeCompareInstance) {
            this.boxFeeCompareInstance = echarts.init(this.$refs.boxFeeCompareChart);
          }
          const top12Boxes = [...this.boxList].sort((a, b) => b.count - a.count).slice(0, 12);
          this.boxFeeCompareInstance.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['箱子單價($)', '計費均運費($)'], textStyle: { color: '#cbd5e1' } },
            grid: { top: '14%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
            xAxis: { type: 'category', data: top12Boxes.map(b => b.boxNo), axisLabel: { color: '#cbd5e1', fontSize: 11, rotate: 20 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: '#94a3b8' } },
            series: [
              { name: '箱子單價($)', type: 'bar', stack: 'unit', barWidth: '42%', itemStyle: { color: '#4ade80' }, data: top12Boxes.map(b => b.unitBoxPrice) },
              { name: '計費均運費($)', type: 'bar', stack: 'unit', barWidth: '42%', itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] }, data: top12Boxes.map(b => b.avgShippingFee) }
            ]
          }, true);
          this.boxFeeCompareInstance.resize();
        }
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
.btn-group { margin-left: auto; }

.sub-tabs-bar {
  display: flex;
  gap: 6px;
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
  padding: 6px 12px;
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
.box-tab.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
}
.warn-tab.active {
  color: #c084fc;
  border-bottom-color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
}
.high-fee-tab.active {
  color: #f87171;
  border-bottom-color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
.extra-fee-tab.active {
  color: #fb923c;
  border-bottom-color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
}
.summary-tab.active {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background: rgba(74, 222, 128, 0.08);
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

.table-total-row td {
  background: #1e293b !important;
  font-size: 13px;
  border-top: 2px solid #facc15;
  position: sticky;
  bottom: 0;
  z-index: 5;
}

.rate-badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.rate-ok { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.rate-mid { background: rgba(250, 204, 21, 0.2); color: #facc15; }
.rate-high { background: rgba(248, 113, 113, 0.2); color: #f87171; }

.cat-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.cat-same { background: rgba(192, 132, 252, 0.25); color: #e9d5ff; }
.cat-cross { background: rgba(56, 189, 248, 0.2); color: #7dd3fc; }

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