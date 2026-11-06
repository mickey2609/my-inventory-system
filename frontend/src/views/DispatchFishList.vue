<!-- frontend/src/views/DispatchFishList.vue -->
<template>
  <div class="dispatch-fish-page dark-bg">
    <!-- 隱藏的檔案選擇器 -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv, .xls, .xlsx"
      @change="handleCsvFileSelected"
    />

    <!-- 1. 第一排：核心標題、日期步進器、維度切換與操作按鈕 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">📦 倉庫 收發魚群出沒分析 (BR 借貨 / BY 採購)</span>
        
        <!-- 智慧日期步進切換器 -->
        <div class="date-stepper-group">
          <el-button size="small" type="primary" plain class="stepper-btn" @click="shiftPeriod(-1)" :title="getShiftTitle(-1)">◀</el-button>

          <el-date-picker
            v-if="analysisMode === 'daily'"
            v-model="targetDate"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            placeholder="選擇日期"
            style="width: 135px;"
            :clearable="false"
            @change="fetchFishData"
          />

          <el-date-picker
            v-else-if="analysisMode === 'monthly'"
            v-model="targetMonth"
            type="month"
            size="small"
            value-format="YYYY-MM"
            placeholder="選擇月份"
            style="width: 130px;"
            :clearable="false"
            @change="fetchMonthlySummary"
          />

          <el-date-picker
            v-else
            v-model="targetYear"
            type="year"
            size="small"
            value-format="YYYY"
            placeholder="選擇年份"
            style="width: 110px;"
            :clearable="false"
            @change="fetchYearlySummary"
          />

          <el-button size="small" type="primary" plain class="stepper-btn" @click="shiftPeriod(1)" :title="getShiftTitle(1)">▶</el-button>
          <el-button size="small" type="info" plain class="stepper-today-btn" @click="resetToCurrentPeriod" :title="getResetTitle">{{ getResetLabel }}</el-button>
        </div>

        <el-radio-group v-model="analysisMode" size="small" @change="handleAnalysisModeChange">
          <el-radio-button label="daily">📅 單日時段分析</el-radio-button>
          <el-radio-button label="monthly">🗓️ 每月每日總表</el-radio-button>
          <el-radio-button label="yearly">📅 年度每月總表</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <el-button type="danger" size="small" icon="el-icon-bell" @click="openPendingDialog">
          🚨 未驗收追蹤
        </el-button>

        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="refreshAllData">
          🔄 重新整理
        </el-button>

        <el-button
          v-if="checkAdmin"
          type="success"
          size="small"
          icon="el-icon-upload2"
          :loading="isUploading"
          @click="showUploadCardModal = true"
        >
          📥 匯入收發單據 (小卡自動清洗)
        </el-button>
      </div>
    </div>

    <!-- 2. 第二排獨立工具列：主畫面四大智慧維度快篩 -->
    <div class="filter-bar">
      <div class="filter-item-box">
        <span class="select-label">🏷️ 單據類別：</span>
        <el-radio-group v-model="sourceCategoryFilter" size="small" @change="refreshCurrentMode">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="BR">🔄 BR 借貨</el-radio-button>
          <el-radio-button label="BY">🛒 BY 採購</el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-item-box">
        <span class="select-label">🚚 準時到貨：</span>
        <el-radio-group v-model="onTimeFilter" size="small" @change="refreshCurrentMode">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="yes">✅ 準時到貨</el-radio-button>
          <el-radio-button label="no">⏳ 非當日/延遲</el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-item-box">
        <span class="select-label">⚠️ 異常狀態：</span>
        <el-radio-group v-model="abnormalFilter" size="small" @change="refreshCurrentMode">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="yes">🚨 異常件</el-radio-button>
          <el-radio-button label="no">🟢 正常件</el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-item-box">
        <span class="select-label">⚡ 快速通關：</span>
        <el-radio-group v-model="fastPassFilter" size="small" @change="refreshCurrentMode">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="yes">🚀 快速通關</el-radio-button>
          <el-radio-button label="no">一般件</el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-item-box">
        <span class="select-label">⏳ 收發進度：</span>
        <el-radio-group v-model="uncheckFilter" size="small" @change="refreshCurrentMode">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="yes">🔴 已收發未驗收</el-radio-button>
          <el-radio-button label="no">🟢 已驗收完成</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 3.1 單日時段分析表格 -->
    <div class="table-container" v-loading="loading" v-if="analysisMode === 'daily'">
      <div class="sheet-title">
        倉庫 收發魚群出沒時間分析 - {{ formatDateTitle(targetDate) }}
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <th colspan="5" class="group-blue-header">收貨單統計 (L欄/M欄)</th>
              <th colspan="4" class="group-green-header">驗收單統計 (O欄/P欄)</th>
            </tr>
            <tr class="header-sub">
              <th class="col-bar-title">收貨圖形</th>
              <th style="width: 85px;">收貨占比</th>
              <th style="width: 85px;">收貨筆數</th>
              <th style="width: 95px;">收貨PCS</th>
              <th class="col-pending-header" style="width: 105px;">未驗收筆數 🔍</th>
              <th class="col-bar-title">驗收圖形</th>
              <th style="width: 85px;">驗收占比</th>
              <th style="width: 85px;">驗收筆數</th>
              <th style="width: 95px;">驗收PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(h, idx) in hourlyStats" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="col-time font-bold">{{ h.hourStr }}</td>
              
              <td class="col-bar-cell"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.recPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.recPct) }}</td>
              <td class="text-right">{{ formatNumber(h.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(h.recPcs) }}</td>

              <td 
                class="text-right font-bold" 
                :class="{ 'text-red clickable-cell': h.pendingOrderCount > 0 }"
                @click="h.pendingOrderCount > 0 ? drillPending({ type: 'hour', date: targetDate, hour: h.hour, label: `${targetDate} ${h.hourStr} 時段` }) : null"
                :title="h.pendingOrderCount > 0 ? `點擊穿透查看 ${h.hourStr} 時段 ${h.pendingOrderCount} 筆未完成明細` : ''"
              >
                {{ formatNumber(h.pendingOrderCount) }}
              </td>

              <td class="col-bar-cell"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.finPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.finPct) }}</td>
              <td class="text-right">{{ formatNumber(h.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(h.finPcs) }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="col-time font-bold">總計</td>
              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(summaryTotal.recPcs) }}</td>
              <td 
                class="text-right font-bold"
                :class="{ 'text-red clickable-cell': summaryTotal.pendingOrderCount > 0 }"
                @click="summaryTotal.pendingOrderCount > 0 ? drillPending({ type: 'date', date: targetDate, label: `${targetDate} 全日` }) : null"
                :title="summaryTotal.pendingOrderCount > 0 ? `點擊穿透查看全日 ${summaryTotal.pendingOrderCount} 筆未完成明細` : ''"
              >
                {{ formatNumber(summaryTotal.pendingOrderCount) }}
              </td>
              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(summaryTotal.finPcs) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.2 每月每日總表 -->
    <div class="table-container" v-loading="loadingMonthly" v-else-if="analysisMode === 'monthly'">
      <div class="sheet-title">🗓️ 倉庫 收發魚群 - {{ targetMonth }} 月份每日總表</div>
      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">收貨日期</th>
              <th colspan="3" class="group-blue-header">收貨單匯總</th>
              <th colspan="2" class="group-green-header">驗收單匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">驗收達成率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 100px;">收貨單數</th>
              <th style="width: 110px;">收貨 PCS</th>
              <th class="col-pending-header" style="width: 110px;">未驗收筆數 🔍</th>
              <th style="width: 100px;">驗收單數</th>
              <th style="width: 110px;">驗收 PCS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(day, idx) in monthlyDailyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ day.date }}</td>
              <td class="text-right">{{ formatNumber(day.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(day.recPcs) }}</td>
              <td 
                class="text-right font-bold" 
                :class="{ 'text-red clickable-cell': day.pendingOrderCount > 0 }"
                @click="day.pendingOrderCount > 0 ? drillPending({ type: 'date', date: day.date, label: `${day.date} 當日` }) : null"
              >
                {{ formatNumber(day.pendingOrderCount) }}
              </td>
              <td class="text-right">{{ formatNumber(day.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(day.finPcs) }}</td>
              <td class="text-right font-bold text-orange">{{ day.finishRate }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全月總計</td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(monthlySummaryTotal.recPcs) }}</td>
              <td 
                class="text-right font-bold"
                :class="{ 'text-red clickable-cell': monthlySummaryTotal.pendingOrderCount > 0 }"
                @click="monthlySummaryTotal.pendingOrderCount > 0 ? drillPending({ type: 'month', month: targetMonth, label: `${targetMonth} 全月` }) : null"
              >
                {{ formatNumber(monthlySummaryTotal.pendingOrderCount) }}
              </td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(monthlySummaryTotal.finPcs) }}</td>
              <td class="text-right font-bold text-orange">{{ monthlySummaryTotal.finishRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.3 年度每月總表 -->
    <div class="table-container" v-loading="loadingYearly" v-else-if="analysisMode === 'yearly'">
      <div class="sheet-title">📅 倉庫 收發魚群 - {{ targetYear }} 年度每月總表</div>
      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">月份</th>
              <th colspan="3" class="group-blue-header">收貨單匯總</th>
              <th colspan="2" class="group-green-header">驗收單匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">驗收達成率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 100px;">收貨單數</th>
              <th style="width: 110px;">收貨 PCS</th>
              <th class="col-pending-header" style="width: 110px;">未驗收筆數 🔍</th>
              <th style="width: 100px;">驗收單數</th>
              <th style="width: 110px;">驗收 PCS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, idx) in yearlyMonthlyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ m.monthLabel }} ({{ m.month }})</td>
              <td class="text-right">{{ formatNumber(m.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(m.recPcs) }}</td>
              <td 
                class="text-right font-bold" 
                :class="{ 'text-red clickable-cell': m.pendingOrderCount > 0 }"
                @click="m.pendingOrderCount > 0 ? drillPending({ type: 'month', month: m.month, label: `${m.month} 月度` }) : null"
              >
                {{ formatNumber(m.pendingOrderCount) }}
              </td>
              <td class="text-right">{{ formatNumber(m.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(m.finPcs) }}</td>
              <td class="text-right font-bold text-orange">{{ m.finishRate }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全年總計</td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.recOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(yearlySummaryTotal.recPcs) }}</td>
              <td 
                class="text-right font-bold"
                :class="{ 'text-red clickable-cell': yearlySummaryTotal.pendingOrderCount > 0 }"
                @click="yearlySummaryTotal.pendingOrderCount > 0 ? drillPending({ type: 'year', year: targetYear, label: `${targetYear} 全年` }) : null"
              >
                {{ formatNumber(yearlySummaryTotal.pendingOrderCount) }}
              </td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(yearlySummaryTotal.finPcs) }}</td>
              <td class="text-right font-bold text-orange">{{ yearlySummaryTotal.finishRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 4. 🌟 未驗收追蹤對話框 (解決畫面超過、分層響應、精準鎖定) -->
    <el-dialog
      v-model="showPendingDialog"
      title="⚠️ 尚未驗收完成單據明細監控與更正處置"
      width="95%"
      top="2.5vh"
      append-to-body
      custom-class="dark-dialog full-monitor-dialog"
    >
      <div class="monitor-container" v-loading="loadingPending">
        <!-- 左側收貨日期選單 -->
        <div class="side-date-nav">
          <div class="nav-title">📅 選擇收貨日期：</div>
          <div class="nav-scroll-list">
            <div
              class="nav-date-item"
              :class="{ 'active-date': activePendingDate === '' && !drillFilterLabel }"
              @click="selectPendingDate('')"
            >
              <span class="date-str font-bold">🌐 全部未驗收日期</span>
              <span class="count-badge badge-all">{{ formatNumber(totalPendingAllDates) }} 筆</span>
            </div>

            <div
              v-for="d in pendingDateList"
              :key="d.rec_date"
              class="nav-date-item"
              :class="{ 'active-date': activePendingDate === d.rec_date && !drillFilterLabel }"
              @click="selectPendingDate(d.rec_date)"
            >
              <span class="date-str">{{ d.rec_date }}</span>
              <span class="count-badge">{{ formatNumber(d.count) }} 筆</span>
            </div>
            <div v-if="pendingDateList.length === 0" class="empty-date-tip">目前無滯留單據</div>
          </div>
        </div>

        <!-- 右側主要清單 (版面重構：雙層工具列防破版) -->
        <div class="main-monitor-content">
          <div class="monitor-top-toolbar-clean">
            <!-- 上排：狀態、搜尋框 -->
            <div class="toolbar-row-top">
              <div class="left-tag-group">
                <span v-if="drillFilterLabel" class="drill-tag">🎯 穿透鎖定：<strong>[{{ drillFilterLabel }}]</strong></span>
                <span class="current-date-header">
                  🔍 <strong>{{ drillFilterLabel ? '' : (activePendingDate || '全部未驗收日期') }}</strong> 
                  未完成明細 (共 {{ formatNumber(filteredPendingList.length) }} 筆<span v-if="searchKeyword.trim() || dialogAbnormalFilter !== 'all'"> / 原始 {{ pendingList.length }} 筆</span>)
                </span>
              </div>

              <div class="search-and-filter-box">
                <div class="dialog-filter-box">
                  <span class="dialog-filter-label">異常狀態：</span>
                  <el-radio-group v-model="dialogAbnormalFilter" size="mini">
                    <el-radio-button label="all">全部</el-radio-button>
                    <el-radio-button label="yes">🚨 異常件</el-radio-button>
                    <el-radio-button label="no">🟢 正常件</el-radio-button>
                  </el-radio-group>
                </div>

                <el-input
                  v-model="searchKeyword"
                  size="mini"
                  placeholder="貼上商品ID / 單號 (空格/逗號/換行隔開)"
                  clearable
                  prefix-icon="el-icon-search"
                  style="width: 280px;"
                >
                  <template #append v-if="searchKeyword.trim()">
                    <span class="id-count-badge">{{ filteredPendingList.length }} 筆</span>
                  </template>
                </el-input>
              </div>
            </div>

            <!-- 下排：操作按鈕區 (右對齊) -->
            <div class="toolbar-row-bottom">
              <el-button v-if="drillFilterLabel" size="mini" type="info" plain @click="clearDrillFilter">
                解除鎖定 (看全部未驗收)
              </el-button>
              <div class="btn-group-right">
                <el-button size="mini" type="info" @click="toggleSelectAll">
                  {{ isAllSelected ? '取消全選' : '全選當前清單 (' + filteredPendingList.length + ' 筆)' }}
                </el-button>
                <el-button size="mini" type="danger" icon="el-icon-delete" :disabled="selectedPendingRows.length === 0" @click="batchCloseOrders">
                  🛠️ 勾選批次銷案 (已選 {{ selectedPendingRows.length }} 筆)
                </el-button>
              </div>
            </div>
          </div>

          <!-- 表格主體 (限制水平滾動，銷案列右側釘選) -->
          <div class="dialog-table-wrapper">
            <el-table
              ref="pendingTable"
              :data="filteredPendingList"
              style="width: 100%; font-size: 12px;"
              height="calc(80vh - 130px)"
              border
              @selection-change="handlePendingSelectionChange"
            >
              <el-table-column type="selection" width="45" align="center" />
              <el-table-column prop="source_category" label="類別" width="85" align="center" sortable>
                <template #default="scope">
                  <span class="badge" :class="scope.row.order_no.startsWith('BR') ? 'badge-br' : 'badge-by'">
                    {{ scope.row.source_category }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column label="狀態特徵" width="145" align="center">
                <template #default="scope">
                  <div class="tag-cell-group">
                    <span v-if="scope.row.appoint_date && scope.row.rec_date && scope.row.appoint_date === scope.row.rec_date" class="status-tag tag-ontime">準時到貨</span>
                    <span v-else-if="scope.row.appoint_date && scope.row.rec_date" class="status-tag tag-delay">非當日</span>
                    <span v-if="isRowAbnormal(scope.row.remark)" class="status-tag tag-abnormal">異常件</span>
                    <span v-if="scope.row.fast_pass_info" class="status-tag tag-fast">快速通關</span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="rec_date" label="收貨日期" width="95" align="center" sortable />
              <el-table-column prop="rec_time" label="收貨時間" width="85" align="center" sortable />
              <el-table-column prop="appoint_date" label="預約入庫日" width="95" align="center" sortable />
              
              <el-table-column prop="order_no" label="來源單號" width="155" align="center" sortable>
                <template #default="scope">
                  <span class="text-orange font-bold clickable-id" @click="copyText(scope.row.order_no, '來源單號')" title="點擊可複製單號">
                    {{ scope.row.order_no }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column prop="item_id" label="商品ID" width="145" align="center" sortable>
                <template #default="scope">
                  <span class="text-blue font-bold clickable-id" @click="copyText(scope.row.item_id, '商品ID')" title="點擊可複製商品ID">
                    {{ scope.row.item_id }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column prop="item_name" label="商品名稱" min-width="180" show-overflow-tooltip sortable />
              <el-table-column prop="pcs" label="PCS數" width="75" align="right" sortable>
                <template #default="scope">
                  <span class="text-red font-bold">{{ formatNumber(scope.row.pcs) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="pm_user" label="PM" width="80" align="center" sortable />
              <el-table-column prop="supplier_name" label="供應商名稱" min-width="140" show-overflow-tooltip sortable />
              <el-table-column prop="remark" label="備註 (已完整清洗合併)" min-width="200" show-overflow-tooltip />

              <el-table-column label="處置" width="80" align="center" fixed="right">
                <template #default="scope">
                  <el-button size="mini" type="danger" plain icon="el-icon-wrench" @click="batchCloseSingle(scope.row)">銷案</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 5. 檔案拖曳小卡 Modal -->
    <el-dialog
      v-model="showUploadCardModal"
      title="📥 匯入 收發魚群單據 (支援 .xls / .xlsx / .csv)"
      width="540px"
      append-to-body
      custom-class="dark-dialog upload-card-dialog"
    >
      <div
        class="drop-card-box"
        :class="{ 'drop-card-active': isCardHover }"
        @dragenter.prevent="isCardHover = true"
        @dragover.prevent="isCardHover = true"
        @dragleave.prevent="isCardHover = false"
        @drop.prevent="handleCardDrop"
        @click="triggerSelectCsv"
      >
        <div class="drop-icon-wrapper">
          <i class="el-icon-upload drop-cloud-icon"></i>
        </div>
        <div class="drop-text-primary">將收發魚群報表拖曳至此小卡</div>
        <div class="drop-text-secondary">或點擊此區域選取檔案</div>
        <div class="security-badge">🛡️ 系統已內建自動清理備註換行拆列與右移平移校正演算法</div>
      </div>
    </el-dialog>

    <!-- 6. 上傳進度 Modal -->
    <el-dialog
      v-model="showUploadProgressModal"
      title="⚡ 正在清洗並寫入收發魚群資料..."
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="progress-box">
        <p class="file-name-info">📁 處理檔案：<strong>{{ uploadingFileName }}</strong></p>
        <p class="status-info">已寫入：{{ formatNumber(uploadedRows) }} / {{ formatNumber(totalRowsToUpload) }} 筆 ({{ uploadPercent }}%)</p>
        <el-progress :percentage="uploadPercent" :stroke-width="18" :text-inside="true" status="success" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export default {
  name: 'DispatchFishList',
  props: {
    isSysAdmin: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false }
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
      
      // 主畫面篩選狀態
      sourceCategoryFilter: 'all',
      onTimeFilter: 'all',
      abnormalFilter: 'all',
      fastPassFilter: 'all',
      uncheckFilter: 'all',

      hourlyStats: [],
      monthlyDailyList: [],
      yearlyMonthlyList: [],

      // 未驗收彈窗內部狀態
      showPendingDialog: false,
      pendingDateList: [],
      activePendingDate: '',
      pendingList: [],
      selectedPendingRows: [],
      isAllSelected: false,
      drillFilterLabel: '',
      drillFilterParams: null,
      dialogAbnormalFilter: 'all',

      searchKeyword: '',

      showUploadCardModal: false,
      isCardHover: false,
      isUploading: false,
      showUploadProgressModal: false,
      uploadingFileName: '',
      uploadPercent: 0,
      uploadedRows: 0,
      totalRowsToUpload: 0
    }
  },
  computed: {
    checkAdmin() {
      if (this.isSysAdmin || this.isAdmin) return true;
      try {
        const authSessionStr = localStorage.getItem('auth_session');
        if (authSessionStr) {
          const session = JSON.parse(authSessionStr);
          if (session.username === 'admin' || session.role === 'sys_admin' || session.role === 'admin') return true;
        }
      } catch (e) {}
      const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '';
      return username === 'admin' || username === '系統管理員';
    },
    getResetLabel() {
      if (this.analysisMode === 'daily') return '今天';
      if (this.analysisMode === 'monthly') return '本月';
      return '今年';
    },
    getResetTitle() {
      if (this.analysisMode === 'daily') return '回到今天日期';
      if (this.analysisMode === 'monthly') return '回到當前月份';
      return '回到當前年份';
    },
    totalPendingAllDates() {
      return this.pendingDateList.reduce((acc, d) => acc + (d.count || 0), 0);
    },
    filteredPendingList() {
      let list = this.pendingList;

      if (this.dialogAbnormalFilter === 'yes') {
        list = list.filter(r => this.isRowAbnormal(r.remark));
      } else if (this.dialogAbnormalFilter === 'no') {
        list = list.filter(r => !this.isRowAbnormal(r.remark));
      }

      if (!this.searchKeyword || !this.searchKeyword.trim()) return list;
      const rawKeywords = this.searchKeyword.split(/[\s,，\n\r]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (rawKeywords.length === 0) return list;

      return list.filter(row => {
        const rowId = String(row.item_id || '').trim().toUpperCase();
        const rowOrder = String(row.order_no || '').trim().toUpperCase();
        return rawKeywords.some(kw => rowId === kw || rowId.includes(kw) || rowOrder === kw || rowOrder.includes(kw));
      });
    },
    summaryTotal() {
      const tot = { recOrderCount: 0, recPcs: 0, pendingOrderCount: 0, finOrderCount: 0, finPcs: 0 };
      this.hourlyStats.forEach(h => {
        tot.recOrderCount += h.recOrderCount || 0;
        tot.recPcs += h.recPcs || 0;
        tot.pendingOrderCount += h.pendingOrderCount || 0;
        tot.finOrderCount += h.finOrderCount || 0;
        tot.finPcs += h.finPcs || 0;
      });
      return tot;
    },
    monthlySummaryTotal() {
      const tot = { recOrderCount: 0, recPcs: 0, pendingOrderCount: 0, finOrderCount: 0, finPcs: 0 };
      this.monthlyDailyList.forEach(d => {
        tot.recOrderCount += d.recOrderCount || 0;
        tot.recPcs += d.recPcs || 0;
        tot.pendingOrderCount += d.pendingOrderCount || 0;
        tot.finOrderCount += d.finOrderCount || 0;
        tot.finPcs += d.finPcs || 0;
      });
      const finishRate = tot.recOrderCount > 0 ? ((tot.finOrderCount / tot.recOrderCount) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, finishRate };
    },
    yearlySummaryTotal() {
      const tot = { recOrderCount: 0, recPcs: 0, pendingOrderCount: 0, finOrderCount: 0, finPcs: 0 };
      this.yearlyMonthlyList.forEach(m => {
        tot.recOrderCount += m.recOrderCount || 0;
        tot.recPcs += m.recPcs || 0;
        tot.pendingOrderCount += m.pendingOrderCount || 0;
        tot.finOrderCount += m.finOrderCount || 0;
        tot.finPcs += m.finPcs || 0;
      });
      const finishRate = tot.recOrderCount > 0 ? ((tot.finOrderCount / tot.recOrderCount) * 100).toFixed(2) + '%' : '0.00%';
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
    getShiftTitle(offset) {
      const direction = offset < 0 ? '前' : '後';
      if (this.analysisMode === 'daily') return `切換至${direction}一天`;
      if (this.analysisMode === 'monthly') return `切換至${direction}一個月`;
      return `切換至${direction}一年`;
    },
    shiftPeriod(offset) {
      if (this.analysisMode === 'daily') {
        const curDate = new Date(this.targetDate || new Date());
        curDate.setDate(curDate.getDate() + offset);
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const d = String(curDate.getDate()).padStart(2, '0');
        this.targetDate = `${y}-${m}-${d}`;
        this.fetchFishData();
      } else if (this.analysisMode === 'monthly') {
        const parts = (this.targetMonth || '').split('-');
        let year = parseInt(parts[0], 10) || new Date().getFullYear();
        let month = (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) + offset;
        if (month < 1) { month = 12; year -= 1; }
        else if (month > 12) { month = 1; year += 1; }
        this.targetMonth = `${year}-${String(month).padStart(2, '0')}`;
        this.fetchMonthlySummary();
      } else {
        const curYear = parseInt(this.targetYear, 10) || new Date().getFullYear();
        this.targetYear = String(curYear + offset);
        this.fetchYearlySummary();
      }
    },
    resetToCurrentPeriod() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      if (this.analysisMode === 'daily') { this.targetDate = `${y}-${m}-${d}`; this.fetchFishData(); }
      else if (this.analysisMode === 'monthly') { this.targetMonth = `${y}-${m}`; this.fetchMonthlySummary(); }
      else { this.targetYear = String(y); this.fetchYearlySummary(); }
    },
    copyText(text, label = '內容') {
      if (!text || text === '-') return;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => ElMessage.success(`📋 已複製${label}：${text}`));
      } else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        ElMessage.success(`📋 已複製${label}：${text}`);
      }
    },
    isRowAbnormal(remark) {
      if (!remark) return false;
      const cleanRmk = String(remark).replace(/\(原15庫\)|\(原82庫\)|\s+/g, '').trim();
      if (!cleanRmk) return false;
      const keywords = ['問題', '不符', '凹損', '破損', '少', '溢', '退', '效期', '中文標', '處理中', '短少'];
      return keywords.some(k => cleanRmk.includes(k)) || cleanRmk.length > 5;
    },

    cleanImportRows(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const repairedRows = [];
      let currentMainRow = null;
      const orderPattern = /^(BR|BY)\d+/i;
      const companyKeywords = ['公司', '企業', '行', '社', '廠'];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;

        const getRowVal = (key) => row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : '';
        const valOrder = getRowVal('來源單號');
        const firstCol = getRowVal('快速通關資訊');

        if (orderPattern.test(valOrder)) {
          if (currentMainRow !== null) repairedRows.push(currentMainRow);
          currentMainRow = { ...row };

          if (row['Unnamed: 18'] !== undefined && row['Unnamed: 18'] !== null && String(row['Unnamed: 18']).trim() !== '') {
            const origRmk = getRowVal('備註');
            const shiftRmk = getRowVal('驗收日期');
            currentMainRow['備註'] = `${origRmk} ${shiftRmk}`.trim();
            currentMainRow['驗收日期'] = row['驗收時間'];
            currentMainRow['驗收時間'] = row['供應商編號'];
            currentMainRow['供應商編號'] = row['供應商名稱'];
            currentMainRow['供應商名稱'] = row['Unnamed: 18'];
          }
        } else {
          if (currentMainRow !== null) {
            const costVal = getRowVal('成本總計');
            const isTailRow = companyKeywords.some(kw => costVal.includes(kw));

            if (isTailRow) {
              currentMainRow['驗收日期'] = row['類型'];
              currentMainRow['驗收時間'] = row['來源單號'];
              currentMainRow['供應商編號'] = row['PCS數'];
              currentMainRow['供應商名稱'] = row['成本總計'];
              if (firstCol) {
                const origRmk = String(currentMainRow['備註'] || '').trim();
                currentMainRow['備註'] = `${origRmk} ${firstCol}`.trim();
              }
            } else {
              const extraParts = [];
              for (const key of Object.keys(row)) {
                const v = getRowVal(key);
                if (v && !key.startsWith('__EMPTY_') && key !== 'Unnamed: 0') {
                  extraParts.push(v);
                }
              }
              const extraText = extraParts.join(' ').trim();
              if (extraText) {
                const origRmk = String(currentMainRow['備註'] || '').trim();
                currentMainRow['備註'] = origRmk ? `${origRmk} ; ${extraText}` : extraText;
              }
            }
          }
        }
      }

      if (currentMainRow !== null) repairedRows.push(currentMainRow);
      return repairedRows;
    },

    triggerSelectCsv() { if (this.$refs.csvFileInput) this.$refs.csvFileInput.click(); },
    handleCsvFileSelected(event) {
      const file = event.target.files[0];
      if (file) { this.showUploadCardModal = false; this.processImportFile(file); }
    },
    handleCardDrop(e) {
      this.isCardHover = false;
      const files = e.dataTransfer ? e.dataTransfer.files : [];
      if (files && files.length > 0) { this.showUploadCardModal = false; this.processImportFile(files[0]); }
    },

    async processImportFile(file) {
      this.isUploading = true;
      this.showUploadProgressModal = true;
      this.uploadingFileName = file.name;
      this.uploadPercent = 0;
      this.uploadedRows = 0;

      try {
        let rawData = [];
        if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { 
            type: 'array',
            cellDates: true,
            dateNF: 'yyyy-mm-dd'
          });
          rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { 
            defval: '',
            raw: false
          });
        } else {
          const text = await file.text();
          rawData = Papa.parse(text, { header: true, skipEmptyLines: true }).data || [];
        }

        rawData = this.cleanImportRows(rawData);
        this.totalRowsToUpload = rawData.length;
        const BATCH_SIZE = 10000;
        let processed = 0;

        for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
          const chunk = rawData.slice(i, i + BATCH_SIZE);
          const isFirstChunk = (i === 0);
          const isLastChunk = (i + BATCH_SIZE >= rawData.length);

          const res = await axios.post('/api/dispatch/import-json', {
            items: chunk,
            fileName: file.name,
            isFirstChunk: isFirstChunk,
            isLastChunk: isLastChunk
          });
          
          processed += chunk.length;
          this.uploadedRows = processed;
          this.uploadPercent = Math.min(100, Math.round((processed / this.totalRowsToUpload) * 100));

          if (isLastChunk && res.data?.autoClosedCount > 0) {
            ElMessage.info(`💡 系統已自動將 ${res.data.autoClosedCount} 筆未在本次名單中的單據判為「已驗收銷案」！`);
          }
        }

        ElMessage.success(`🎉 成功清洗並同步 ${this.totalRowsToUpload.toLocaleString()} 筆收發單據！`);

        for (let j = rawData.length - 1; j >= 0; j--) {
          const rDate = String(rawData[j]['收貨日期'] || '').trim();
          if (rDate && rDate.includes('-')) {
            this.targetDate = rDate.split(' ')[0];
            break;
          }
        }

        this.refreshAllData();
      } catch (e) {
        ElMessage.error('匯入處理失敗：' + e.message);
      } finally {
        this.isUploading = false;
        this.showUploadProgressModal = false;
        if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
      }
    },

    getQueryParams() {
      return {
        sourceFilter: this.sourceCategoryFilter,
        onTimeFilter: this.onTimeFilter,
        abnormalFilter: this.abnormalFilter,
        fastPassFilter: this.fastPassFilter,
        uncheckFilter: this.uncheckFilter
      };
    },

    async fetchFishData() {
      this.loading = true;
      try {
        const res = await axios.get('/api/dispatch/fish-analysis', {
          params: { targetDate: this.targetDate, ...this.getQueryParams() }
        });
        if (res.data?.success) {
          const raw = res.data.hourlyStats || [];
          let totRec = 0, totFin = 0;
          raw.forEach(r => { totRec += r.recOrderCount || 0; totFin += r.finOrderCount || 0; });
          this.hourlyStats = raw.map(r => ({
            ...r,
            recPct: totRec > 0 ? (r.recOrderCount / totRec) : 0,
            finPct: totFin > 0 ? (r.finOrderCount / totFin) : 0
          }));
        }
      } finally { this.loading = false; }
    },

    async fetchMonthlySummary() {
      this.loadingMonthly = true;
      try {
        const res = await axios.get('/api/dispatch/monthly-summary', {
          params: { month: this.targetMonth, ...this.getQueryParams() }
        });
        if (res.data?.success) this.monthlyDailyList = res.data.dailyList || [];
      } finally { this.loadingMonthly = false; }
    },

    async fetchYearlySummary() {
      this.loadingYearly = true;
      try {
        const res = await axios.get('/api/dispatch/yearly-summary', {
          params: { year: this.targetYear, ...this.getQueryParams() }
        });
        if (res.data?.success) this.yearlyMonthlyList = res.data.monthlyList || [];
      } finally { this.loadingYearly = false; }
    },

    refreshCurrentMode() {
      if (this.analysisMode === 'daily') this.fetchFishData();
      else if (this.analysisMode === 'monthly') this.fetchMonthlySummary();
      else this.fetchYearlySummary();
    },
    refreshAllData() {
      this.refreshCurrentMode();
      if (this.showPendingDialog) this.fetchPendingDateList();
      ElMessage.success('🎉 資料已重新整理！');
    },

    openPendingDialog() {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      this.dialogAbnormalFilter = 'all';
      this.showPendingDialog = true;
      this.fetchPendingDateList();
    },

    drillPending(options) {
      this.drillFilterLabel = options.label || '';
      this.drillFilterParams = options;
      this.searchKeyword = '';
      this.dialogAbnormalFilter = this.abnormalFilter;
      this.showPendingDialog = true;
      this.fetchPendingDateListOnly();
      this.loadDrillPendingDetails(options);
    },

    clearDrillFilter() {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      this.dialogAbnormalFilter = 'all';
      this.activePendingDate = '';
      this.fetchPendingDetails();
    },

    async loadDrillPendingDetails(options) {
      this.loadingPending = true;
      try {
        const params = {
          ...this.getQueryParams(),
          abnormalFilter: this.dialogAbnormalFilter
        };
        if (options.date) params.date = options.date;
        if (options.month) params.month = options.month;
        if (options.year) params.year = options.year;
        if (options.hour !== undefined && options.hour !== null) {
          params.hour = options.hour;
        }

        const res = await axios.get('/api/dispatch/pending-details', { params });
        if (res.data?.success) {
          this.pendingList = res.data.pendingList || [];
        }
      } finally {
        this.loadingPending = false;
      }
    },

    async fetchPendingDateListOnly() {
      try {
        const res = await axios.get('/api/dispatch/pending-dates');
        if (res.data?.success) {
          this.pendingDateList = res.data.list || [];
        }
      } catch (e) {}
    },

    async fetchPendingDateList() {
      try {
        const res = await axios.get('/api/dispatch/pending-dates');
        if (res.data?.success) {
          this.pendingDateList = res.data.list || [];
          if (!this.drillFilterLabel) {
            if (!this.activePendingDate && this.pendingDateList.length > 0) {
              this.activePendingDate = this.pendingDateList[0].rec_date;
            }
            this.fetchPendingDetails();
          }
        }
      } catch (e) {}
    },

    selectPendingDate(d) {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      this.activePendingDate = d;
      this.fetchPendingDetails();
    },

    async fetchPendingDetails() {
      this.loadingPending = true;
      try {
        const params = {
          ...this.getQueryParams(),
          abnormalFilter: this.dialogAbnormalFilter
        };
        if (this.activePendingDate) {
          params.targetDate = this.activePendingDate;
        } else {
          delete params.targetDate;
          delete params.date;
        }
        const res = await axios.get('/api/dispatch/pending-details', { params });
        if (res.data?.success) this.pendingList = res.data.pendingList || [];
      } finally { this.loadingPending = false; }
    },

    handlePendingSelectionChange(val) {
      this.selectedPendingRows = val;
      this.isAllSelected = (val.length === this.filteredPendingList.length && this.filteredPendingList.length > 0);
    },
    toggleSelectAll() {
      if (this.$refs.pendingTable) {
        if (this.isAllSelected) this.$refs.pendingTable.clearSelection();
        else this.filteredPendingList.forEach(row => this.$refs.pendingTable.toggleRowSelection(row, true));
      }
    },
    async batchCloseSingle(row) {
      try {
        await ElMessageBox.confirm(`確定銷案單號【${row.order_no}】品項【${row.item_id}】？`, '銷案確認', { type: 'warning' });
        // 優先傳遞唯一流水號 id
        const payload = row.id ? { ids: [row.id] } : { keys: [{ orderNo: row.order_no, itemId: row.item_id }] };
        const res = await axios.post('/api/dispatch/close-order', payload);
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          if (this.drillFilterParams) {
            this.loadDrillPendingDetails(this.drillFilterParams);
          } else {
            this.fetchPendingDetails();
          }
          this.fetchPendingDateListOnly();
        }
      } catch (e) {}
    },
    async batchCloseOrders() {
      if (this.selectedPendingRows.length === 0) return;
      try {
        await ElMessageBox.confirm(`確定銷案 ${this.selectedPendingRows.length} 筆單據？`, '警告', { type: 'warning' });
        const ids = this.selectedPendingRows.map(r => r.id).filter(Boolean);
        const keys = this.selectedPendingRows.map(r => ({ orderNo: r.order_no, itemId: r.item_id }));
        const payload = ids.length > 0 ? { ids } : { keys };
        const res = await axios.post('/api/dispatch/close-order', payload);
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          if (this.drillFilterParams) {
            this.loadDrillPendingDetails(this.drillFilterParams);
          } else {
            this.fetchPendingDetails();
          }
          this.fetchPendingDateListOnly();
        }
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.dispatch-fish-page {
  padding: 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.top-bar, .filter-bar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  background: #1e293b;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
  flex-wrap: wrap;
  gap: 12px;
}
.title-group, .action-group { display: flex; align-items: center; gap: 10px; }
.action-group { margin-left: auto; }
.page-title { font-size: 16px; font-weight: bold; color: #38bdf8; white-space: nowrap; }

.filter-item-box {
  display: flex;
  align-items: center;
  gap: 4px;
}
.select-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: bold;
  white-space: nowrap;
}

.date-stepper-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid #334155;
}
.stepper-btn { padding: 6px 10px !important; font-weight: bold; }
.stepper-today-btn { padding: 6px 10px !important; font-weight: bold; margin-left: 2px; }

.table-container {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
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
.table-scroll-wrapper { overflow-x: auto; }
.vba-style-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #f8fafc;
  background: #0f172a;
  white-space: nowrap;
}
.vba-style-table th, .vba-style-table td {
  border: 1px solid #334155;
  padding: 5px 6px;
}
.col-time { text-align: center; background: #1e293b; width: 70px; }
.header-main th { font-weight: bold; text-align: center; }
.group-blue-header { background: #1e3a8a; color: #bfdbfe; }
.group-green-header { background: #14532d; color: #bbf7d0; }
.col-ratio-header { background: #854d0e; color: #fef08a; }
.col-pending-header { background: #991b1b; color: #fecaca; }
.header-sub th { background: #334155; color: #cbd5e1; text-align: center; }
.bar-fill { height: 12px; border-radius: 2px; }
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

.clickable-cell { cursor: pointer; text-decoration: underline; }
.clickable-cell:hover { color: #f87171 !important; transform: scale(1.05); }
.clickable-id { cursor: pointer; }
.clickable-id:hover { text-decoration: underline; color: #60a5fa !important; }

.badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.badge-br { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
.badge-by { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }

.tag-cell-group { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.status-tag { padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: bold; }
.tag-ontime { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
.tag-delay { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }
.tag-abnormal { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
.tag-fast { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); }

/* 🌟 彈窗容器與自適應工具列排版 */
.monitor-container {
  display: flex;
  gap: 12px;
  height: calc(85vh - 75px);
  overflow: hidden;
}

.side-date-nav {
  width: 210px;
  flex-shrink: 0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.nav-title { font-size: 13px; font-weight: bold; color: #38bdf8; margin-bottom: 10px; }
.nav-scroll-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.nav-date-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 10px;
  background: #1e293b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-date-item:hover { background: #334155; }
.active-date { background: #0284c7 !important; font-weight: bold; }
.count-badge { background: #ef4444; color: #ffffff; padding: 2px 6px; border-radius: 12px; font-size: 11px; }
.badge-all { background: #3b82f6 !important; }

.main-monitor-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  overflow: hidden;
}

/* 🌟 分層防擠壓工具列 */
.monitor-top-toolbar-clean {
  background: #1e293b;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #334155;
}

.toolbar-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.left-tag-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.drill-tag { background: #b91c1c; color: #fef2f2; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.current-date-header { font-size: 13px; color: #f8fafc; }

.search-and-filter-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.dialog-filter-box { display: flex; align-items: center; gap: 4px; }
.dialog-filter-label { font-size: 12px; color: #cbd5e1; font-weight: bold; }

.toolbar-row-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #334155;
  padding-top: 6px;
}
.btn-group-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.dialog-table-wrapper {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.drop-card-box {
  background: #0f172a;
  border: 2px dashed #38bdf8;
  border-radius: 12px;
  padding: 35px 20px;
  text-align: center;
  cursor: pointer;
}
.drop-cloud-icon { font-size: 56px; color: #38bdf8; }
.drop-text-primary { font-size: 15px; font-weight: bold; color: #f8fafc; margin-top: 10px; }
.drop-text-secondary { font-size: 13px; color: #94a3b8; margin-top: 6px; }
.security-badge { display: inline-block; margin-top: 15px; padding: 4px 12px; background: #1e3a8a; color: #bfdbfe; font-size: 11px; border-radius: 20px; }
</style>