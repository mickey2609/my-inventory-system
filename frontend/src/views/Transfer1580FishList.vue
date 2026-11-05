<template>
  <div class="transfer-fish-page dark-bg">
    <!-- 隱藏的檔案選擇器 -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv, .xls, .xlsx"
      @change="handleCsvFileSelected"
    />

    <!-- 1. 第一排：核心標題、日期選擇器、維度切換與操作按鈕 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🔄 倉庫 跨庫調撥 (15 ➔ 80) 魚群分析</span>
        
        <!-- 🌟 智慧日期/月份/年份 步進切換器 (支援前一天、後一天、今天) -->
        <div class="date-stepper-group">
          <el-button 
            size="small" 
            type="primary" 
            plain 
            class="stepper-btn"
            @click="shiftPeriod(-1)"
            :title="getShiftTitle(-1)"
          >
            ◀
          </el-button>

          <!-- 單日選擇器 -->
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

          <!-- 每月選擇器 -->
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

          <!-- 年度選擇器 -->
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

          <el-button 
            size="small" 
            type="primary" 
            plain 
            class="stepper-btn"
            @click="shiftPeriod(1)"
            :title="getShiftTitle(1)"
          >
            ▶
          </el-button>

          <el-button 
            size="small" 
            type="info" 
            plain 
            class="stepper-today-btn"
            @click="resetToCurrentPeriod"
            :title="getResetTitle"
          >
            {{ getResetLabel }}
          </el-button>
        </div>

        <!-- 3 維度分析模式切換 -->
        <el-radio-group v-model="analysisMode" size="small" @change="handleAnalysisModeChange">
          <el-radio-button label="daily">📅 單日時段分析</el-radio-button>
          <el-radio-button label="monthly">🗓️ 每月每日總表</el-radio-button>
          <el-radio-button label="yearly">📅 年度每月總表</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 右側操作按鈕區 -->
      <div class="action-group">
        <el-button
          type="danger"
          size="small"
          icon="el-icon-bell"
          @click="openPendingDialog"
        >
          🚨 調撥未完成追蹤
        </el-button>

        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="refreshAllData">
          🔄 重新整理
        </el-button>

        <!-- 🔒 僅限 SysAdmin 可查看與清除誤匯單據 -->
        <el-button
          v-if="checkSysAdmin"
          type="warning"
          size="small"
          icon="el-icon-warning-outline"
          @click="openInvalidModal"
        >
          🔍 查看與清除誤匯單據
        </el-button>

        <!-- 🔓 開放 Admin & SysAdmin 均可進行小卡投放匯入 -->
        <el-button
          v-if="checkAdmin"
          type="success"
          size="small"
          icon="el-icon-upload2"
          :loading="isUploading"
          @click="showUploadCardModal = true"
        >
          📥 匯入 15➔80 調撥 (小卡投放)
        </el-button>
      </div>
    </div>

    <!-- 2. 第二排獨立工具列 -->
    <div class="filter-bar">
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
        倉庫 15 ➔ 80 跨庫調撥出沒時間分析 - {{ formatDateTitle(targetDate) }}
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <th colspan="5" class="group-blue-header">產生調撥單統計 (15倉發單)</th>
              <th colspan="4" class="group-green-header">完成調撥單統計 (80倉上架)</th>
              <th class="col-ratio-header" rowspan="2" style="width: 90px;">已刪單筆數</th>
            </tr>

            <tr class="header-sub">
              <th class="col-bar-title">產生圖形</th>
              <th style="width: 80px;">產生占比</th>
              <th style="width: 80px;">產生筆數</th>
              <th style="width: 90px;">調撥PCS</th>
              <th class="col-pending-header" style="width: 100px;">未完成筆數 🔍</th>
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
              <td class="text-right font-bold text-orange">{{ formatNumber(summaryTotal.delOrderCount) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.2 每月每日總表區塊 -->
    <div class="table-container" v-loading="loadingMonthly" v-else-if="analysisMode === 'monthly'">
      <div class="sheet-title">
        🗓️ 倉庫 跨庫調撥 (15➔80) - {{ targetMonth }} 月份每日總表
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">日期</th>
              <th colspan="3" class="group-blue-header">產生調撥單匯總</th>
              <th colspan="2" class="group-green-header">完成調撥單匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 100px;">已刪單筆數</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">完成率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 100px;">產生單數</th>
              <th style="width: 110px;">產生 PCS</th>
              <th class="col-pending-header" style="width: 100px;">未完成筆數 🔍</th>
              <th style="width: 100px;">完成單數</th>
              <th style="width: 110px;">完成 PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(day, idx) in monthlyDailyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ day.date }}</td>
              <td class="text-right">{{ formatNumber(day.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(day.genPcs) }}</td>
              <td 
                class="text-right font-bold" 
                :class="{ 'text-red clickable-cell': day.pendingOrderCount > 0 }"
                @click="day.pendingOrderCount > 0 ? drillPending({ type: 'date', date: day.date, label: `${day.date} 當日` }) : null"
                :title="day.pendingOrderCount > 0 ? `點擊穿透查看 ${day.date} 當日 ${day.pendingOrderCount} 筆未完成明細` : ''"
              >
                {{ formatNumber(day.pendingOrderCount) }}
              </td>
              
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
              <td 
                class="text-right font-bold"
                :class="{ 'text-red clickable-cell': monthlySummaryTotal.pendingOrderCount > 0 }"
                @click="monthlySummaryTotal.pendingOrderCount > 0 ? drillPending({ type: 'month', month: targetMonth, label: `${targetMonth} 全月` }) : null"
                :title="monthlySummaryTotal.pendingOrderCount > 0 ? `點擊穿透查看 ${targetMonth} 全月未完成明細` : ''"
              >
                {{ formatNumber(monthlySummaryTotal.pendingOrderCount) }}
              </td>
              
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
        📅 倉庫 跨庫調撥 (15➔80) - {{ targetYear }} 年度每月總表
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">月份</th>
              <th colspan="3" class="group-blue-header">產生調撥單匯總</th>
              <th colspan="2" class="group-green-header">完成調撥單匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 100px;">已刪單筆數</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">完成率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 100px;">產生單數</th>
              <th style="width: 110px;">產生 PCS</th>
              <th class="col-pending-header" style="width: 100px;">未完成筆數 🔍</th>
              <th style="width: 100px;">完成單數</th>
              <th style="width: 110px;">完成 PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(m, idx) in yearlyMonthlyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ m.monthLabel }} ({{ m.month }})</td>
              <td class="text-right">{{ formatNumber(m.genOrderCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(m.genPcs) }}</td>
              <td 
                class="text-right font-bold" 
                :class="{ 'text-red clickable-cell': m.pendingOrderCount > 0 }"
                @click="m.pendingOrderCount > 0 ? drillPending({ type: 'month', month: m.month, label: `${m.month} 月度` }) : null"
                :title="m.pendingOrderCount > 0 ? `點擊穿透查看 ${m.month} 月度 ${m.pendingOrderCount} 筆未完成明細` : ''"
              >
                {{ formatNumber(m.pendingOrderCount) }}
              </td>
              
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
              <td 
                class="text-right font-bold"
                :class="{ 'text-red clickable-cell': yearlySummaryTotal.pendingOrderCount > 0 }"
                @click="yearlySummaryTotal.pendingOrderCount > 0 ? drillPending({ type: 'year', year: targetYear, label: `${targetYear} 全年` }) : null"
                :title="yearlySummaryTotal.pendingOrderCount > 0 ? `點擊穿透查看 ${targetYear} 全年未完成明細` : ''"
              >
                {{ formatNumber(yearlySummaryTotal.pendingOrderCount) }}
              </td>
              
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.finOrderCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(yearlySummaryTotal.finPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ formatNumber(yearlySummaryTotal.delOrderCount) }}</td>
              <td class="text-right font-bold text-orange">{{ yearlySummaryTotal.finishRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 4. 未完成追蹤對話框彈窗（🌟 支援貼 ID/調撥單/訂單單號 批量搜尋與複製） -->
    <el-dialog
      v-model="showPendingDialog"
      title="⚠️ 尚未調撥完成單據明細監控與更正處置"
      width="95%"
      top="3vh"
      append-to-body
      custom-class="dark-dialog full-monitor-dialog"
    >
      <div class="monitor-container" v-loading="loadingPending">
        <div class="side-date-nav">
          <div class="nav-title">📅 選擇產生日期：</div>
          <div class="nav-scroll-list">
            <div
              v-for="d in pendingDateList"
              :key="d.gen_date"
              class="nav-date-item"
              :class="{ 'active-date': activePendingDate === d.gen_date && !drillFilterLabel }"
              @click="selectPendingDate(d.gen_date)"
            >
              <span class="date-str">{{ d.gen_date }}</span>
              <span class="count-badge">{{ formatNumber(d.count) }} 筆</span>
            </div>
            <div v-if="pendingDateList.length === 0" class="empty-date-tip">
              目前無滯留單據
            </div>
          </div>
        </div>

        <div class="main-monitor-content">
          <div class="monitor-top-toolbar">
            <div class="toolbar-left-info">
              <span v-if="drillFilterLabel" class="drill-tag">
                🎯 穿透篩選：<strong>[{{ drillFilterLabel }}]</strong>
              </span>

              <span class="current-date-header">
                🔍 <strong>{{ drillFilterLabel ? '' : (activePendingDate || '全部日期') }}</strong> 
                未完成明細 (共 {{ formatNumber(filteredPendingList.length) }} 筆<span v-if="searchKeyword.trim()"> / 原 {{ pendingList.length }} 筆</span>)
              </span>

              <!-- 🌟 貼 ID / 調撥單號 / 訂單單號 批量搜尋框 -->
              <div class="id-search-box">
                <el-input
                  v-model="searchKeyword"
                  size="small"
                  placeholder="貼上商品ID / 調撥單號 / 訂單單號 (多筆以空格/逗號/換行隔開)"
                  clearable
                  prefix-icon="el-icon-search"
                  style="width: 380px;"
                >
                  <template #append v-if="searchKeyword.trim()">
                    <span class="id-count-badge">已比對 {{ filteredPendingList.length }} 筆</span>
                  </template>
                </el-input>
              </div>

              <el-button
                v-if="drillFilterLabel"
                size="mini"
                type="info"
                plain
                @click="clearDrillFilter"
              >
                顯示全部未完成
              </el-button>
            </div>

            <div class="toolbar-btns">
              <el-button size="mini" type="info" @click="toggleSelectAll">
                {{ isAllSelected ? '取消全選' : '全選當前清單 (' + filteredPendingList.length + ' 筆)' }}
              </el-button>

              <el-button
                size="mini"
                type="danger"
                icon="el-icon-delete"
                :disabled="selectedPendingRows.length === 0"
                @click="batchCloseOrders"
              >
                🛠️ 勾選批次銷案 (已選 {{ selectedPendingRows.length }} 筆)
              </el-button>

              <el-button size="mini" type="warning" icon="el-icon-date" @click="openDateRangeCloseDialog">
                📅 依日期區間一鍵銷案 (專處理歷史舊單)
              </el-button>
            </div>
          </div>

          <el-table
            ref="pendingTable"
            :data="filteredPendingList"
            style="width: 100%; font-size: 12px;"
            height="calc(80vh - 120px)"
            border
            @selection-change="handlePendingSelectionChange"
          >
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="gen_date" label="產生日期" width="100" align="center" sortable />
            <el-table-column prop="gen_time" label="產生時間" width="85" align="center" sortable />
            
            <!-- 調撥單號點擊複製 -->
            <el-table-column prop="order_no" label="調撥單號" width="150" align="center" sortable>
              <template #default="scope">
                <span class="text-orange font-bold clickable-id" @click="copyText(scope.row.order_no, '調撥單號')" title="點擊可複製調撥單號">
                  {{ scope.row.order_no }}
                </span>
              </template>
            </el-table-column>
            
            <!-- 🌟 15➔80 正確對應：訂單單號點擊複製 -->
            <el-table-column prop="overseas_order_no" label="訂單單號" width="155" align="center" sortable>
              <template #default="scope">
                <span class="text-yellow font-bold clickable-id" @click="copyText(scope.row.overseas_order_no, '訂單單號')" title="點擊可複製訂單單號">
                  {{ scope.row.overseas_order_no }}
                </span>
              </template>
            </el-table-column>

            <!-- 商品編號點擊複製 -->
            <el-table-column prop="item_id" label="商品編號" width="140" align="center" sortable>
              <template #default="scope">
                <span class="text-blue font-bold clickable-id" @click="copyText(scope.row.item_id, '商品編號')" title="點擊可複製商品ID">
                  {{ scope.row.item_id }}
                </span>
              </template>
            </el-table-column>
            
            <el-table-column prop="item_name" label="商品名稱" min-width="180" show-overflow-tooltip sortable />
            <el-table-column prop="suggest_qty" label="調撥數量" width="85" align="right" sortable>
              <template #default="scope">
                <span class="text-red font-bold">{{ formatNumber(scope.row.suggest_qty) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="apply_user" label="申請人員" width="90" align="center" sortable />
            <el-table-column prop="remark" label="備註說明" min-width="200" show-overflow-tooltip />

            <el-table-column label="處置" width="90" align="center" fixed="right">
              <template #default="scope">
                <el-button size="mini" type="danger" plain icon="el-icon-wrench" @click="openCloseDialog(scope.row)">
                  銷案
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 5. 專屬互動式檔案拖曳投放小卡 Modal -->
    <el-dialog
      v-model="showUploadCardModal"
      title="📥 匯入 15➔80 跨庫調撥單據"
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
        <div class="drop-text-primary">
          將 <span class="highlight-text">.xls / .xlsx / .csv</span> 調撥單檔案拖曳至此小卡
        </div>
        <div class="drop-text-secondary">
          或點擊此區域從電腦選取檔案
        </div>

        <div class="security-badge">
          🛡️ 系統自動判定 TR / GD 開頭且目的庫為 80，自動跳過末列筆數列
        </div>
      </div>
    </el-dialog>

    <!-- 6. 誤匯單據對照彈窗 -->
    <el-dialog
      v-model="showInvalidModal"
      title="⚠️ 誤匯入跨庫調撥單之異常單據對照清單"
      width="900px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="invalid-modal-content" v-loading="loadingInvalid">
        <p style="margin-bottom: 12px; font-size: 13px; color: #94a3b8;">
          以下為非 <strong class="text-orange">TR / GD 開頭</strong> 或 <strong class="text-orange">目的庫不為 80</strong> 之誤匯筆數。請勾選欲剔除的資料，未勾選者將完整保留。
        </p>

        <el-table
          :data="invalidList"
          style="width: 100%; font-size: 12px;"
          height="380"
          border
          @selection-change="handleInvalidSelectionChange"
        >
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="order_no" label="誤匯單號" width="150" align="center">
            <template #default="scope">
              <span class="text-red font-bold">{{ scope.row.order_no }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="item_id" label="商品編號" width="130" align="center">
            <template #default="scope">
              <span class="text-blue font-bold">{{ scope.row.item_id }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="item_name" label="商品名稱" show-overflow-tooltip />
          <el-table-column prop="dest_warehouse" label="目的庫" width="80" align="center">
            <template #default="scope">
              <span :class="scope.row.dest_warehouse !== '80' ? 'text-red font-bold' : ''">{{ scope.row.dest_warehouse }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="suggest_qty" label="調撥數量" width="90" align="right">
            <template #default="scope">
              {{ formatNumber(scope.row.suggest_qty) }}
            </template>
          </el-table-column>
          <el-table-column prop="gen_date" label="產生日期" width="100" align="center" />
          <el-table-column prop="remark" label="備註說明" width="120" show-overflow-tooltip />
        </el-table>

        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; color: #f8fafc;">
            已選取 <strong class="text-red">{{ selectedInvalidRows.length }}</strong> / {{ invalidList.length }} 筆異常資料
          </span>
          <div>
            <el-button size="small" @click="showInvalidModal = false">關閉</el-button>
            <el-button
              type="danger"
              size="small"
              icon="el-icon-delete"
              :disabled="selectedInvalidRows.length === 0"
              :loading="isDeletingInvalid"
              @click="confirmDeleteSelectedInvalid"
            >
              批次刪除選取筆數 ({{ selectedInvalidRows.length }})
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 7. 手動銷案 Modal 對話框 -->
    <el-dialog
      v-model="showCloseModal"
      title="🚨 跨庫調撥單據手動銷案確認"
      width="420px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="close-form-box" v-if="selectedCloseRow">
        <p><strong>調撥單號：</strong> <span class="text-orange">{{ selectedCloseRow.order_no }}</span></p>
        <p><strong>商品編號：</strong> <span class="text-blue">{{ selectedCloseRow.item_id }}</span></p>
        <p><strong>商品名稱：</strong> {{ selectedCloseRow.item_name }}</p>
        
        <div style="margin-top: 12px;">
          <label style="font-size: 13px; font-weight: bold; color: #cbd5e1;">銷案原因/備註說明：</label>
          <el-input
            type="textarea"
            v-model="closeRemark"
            placeholder="請輸入手動銷案原因（例：現場實體已搬移 / 系統重複開單）"
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

    <!-- 8. CSV / Excel 上傳進度 Modal -->
    <el-dialog
      v-model="showUploadProgressModal"
      title="⚡ 正在寫入與同步 15➔80 跨庫調撥單資料..."
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
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export default {
  name: 'Transfer1580FishList',
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
      
      docTypeOptions: ['集貨跨庫調撥單', '緊急調撥單', '人工倉補貨單'],
      selectedDocTypes: ['all'],

      reasonOptions: ['系統補開', '高周轉跨庫調撥', '彙整列印新單', '預購回填'],
      selectedReasons: ['all'],

      hourlyStats: [],
      monthlyDailyList: [],
      yearlyMonthlyList: [],

      showPendingDialog: false,
      pendingDateList: [],
      activePendingDate: '',
      pendingList: [],
      selectedPendingRows: [],
      isAllSelected: false,
      drillFilterLabel: '',
      drillFilterParams: null,

      // 貼 ID / 調撥單號 / 訂單單號 查詢輸入綁定
      searchKeyword: '',

      showUploadCardModal: false,
      isCardHover: false,

      showInvalidModal: false,
      loadingInvalid: false,
      invalidList: [],
      selectedInvalidRows: [],
      isDeletingInvalid: false,

      showCloseModal: false,
      selectedCloseRow: null,
      closeRemark: '現場實體已完成搬移銷案',
      isClosing: false,

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

    // 🌟 同時過濾 商品ID、調撥單號、訂單單號
    filteredPendingList() {
      if (!this.searchKeyword || !this.searchKeyword.trim()) {
        return this.pendingList;
      }

      const rawKeywords = this.searchKeyword
        .split(/[\s,，\n\r]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (rawKeywords.length === 0) {
        return this.pendingList;
      }

      return this.pendingList.filter(row => {
        const rowId = String(row.item_id || '').trim().toUpperCase();
        const rowOrderNo = String(row.order_no || '').trim().toUpperCase();
        const rowOverseas = String(row.overseas_order_no || '').trim().toUpperCase();

        return rawKeywords.some(kw => {
          return rowId === kw || rowId.includes(kw) ||
                 rowOrderNo === kw || rowOrderNo.includes(kw) ||
                 rowOverseas === kw || rowOverseas.includes(kw);
        });
      });
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
      const tot = { genOrderCount: 0, genPcs: 0, pendingOrderCount: 0, cohortFinOrderCount: 0, finOrderCount: 0, finPcs: 0, delOrderCount: 0 };
      this.monthlyDailyList.forEach(d => {
        tot.genOrderCount += d.genOrderCount || 0;
        tot.genPcs += d.genPcs || 0;
        tot.pendingOrderCount += d.pendingOrderCount || 0;
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

    window.addEventListener('dragover', this.globalBlockDrop, false);
    window.addEventListener('drop', this.globalBlockDrop, false);
  },
  beforeUnmount() {
    window.removeEventListener('dragover', this.globalBlockDrop, false);
    window.removeEventListener('drop', this.globalBlockDrop, false);
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
        if (month < 1) {
          month = 12;
          year -= 1;
        } else if (month > 12) {
          month = 1;
          year += 1;
        }
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

      if (this.analysisMode === 'daily') {
        this.targetDate = `${y}-${m}-${d}`;
        this.fetchFishData();
      } else if (this.analysisMode === 'monthly') {
        this.targetMonth = `${y}-${m}`;
        this.fetchMonthlySummary();
      } else {
        this.targetYear = String(y);
        this.fetchYearlySummary();
      }
    },

    copyText(text, label = '內容') {
      if (!text || text === '-') return;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          ElMessage.success(`📋 已複製${label}：${text}`);
        }).catch(() => {
          this.fallbackCopy(text, label);
        });
      } else {
        this.fallbackCopy(text, label);
      }
    },
    fallbackCopy(text, label = '內容') {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        ElMessage.success(`📋 已複製${label}：${text}`);
      } catch (err) {
        ElMessage.error('複製失敗');
      }
      document.body.removeChild(input);
    },

    globalBlockDrop(e) {
      e.preventDefault();
    },

    handleCardDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      this.isCardHover = false;

      const dt = e.dataTransfer;
      const files = dt ? dt.files : [];
      if (files && files.length > 0) {
        this.showUploadCardModal = false;
        this.processImportFile(files[0]);
      }
    },

    async openPendingDialog() {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      this.showPendingDialog = true;
      await this.fetchPendingDateList();
    },

    drillPending(options) {
      this.drillFilterLabel = options.label || '';
      this.drillFilterParams = options;
      this.searchKeyword = '';
      this.showPendingDialog = true;
      this.fetchPendingDateList();
      this.loadDrillPendingDetails(options);
    },

    clearDrillFilter() {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      if (this.pendingDateList.length > 0) {
        this.activePendingDate = this.pendingDateList[0].gen_date;
        this.fetchPendingDetails();
      } else {
        this.pendingList = [];
      }
    },

    async loadDrillPendingDetails(options) {
      this.loadingPending = true;
      try {
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');

        const params = {
          docTypes: activeDocTypes,
          reasons: activeReasons
        };

        if (options.date) params.date = options.date;
        if (options.month) params.month = options.month;
        if (options.year) params.year = options.year;
        if (options.hour !== undefined) params.hour = options.hour;

        const res = await axios.get('/api/transfer1580/pending-details', { params });
        if (res.data?.success) {
          this.pendingList = res.data.pendingList || [];
          if (options.date) {
            this.activePendingDate = options.date;
          }
        } else {
          ElMessage.error(res.data?.message || '讀取未完成明細失敗');
        }
      } catch (e) {
        ElMessage.error('載入穿透明細失敗：' + e.message);
      } finally {
        this.loadingPending = false;
      }
    },

    async fetchPendingDateList() {
      try {
        const res = await axios.get('/api/transfer1580/pending-dates');
        if (res.data?.success) {
          this.pendingDateList = res.data.list || [];
          if (!this.drillFilterLabel && this.pendingDateList.length > 0) {
            if (!this.activePendingDate) {
              this.activePendingDate = this.pendingDateList[0].gen_date;
              this.fetchPendingDetails();
            }
          }
        }
      } catch (e) {
        ElMessage.error('載入未完成日期選單失敗：' + e.message);
      }
    },

    selectPendingDate(dStr) {
      this.drillFilterLabel = '';
      this.drillFilterParams = null;
      this.searchKeyword = '';
      this.activePendingDate = dStr;
      this.fetchPendingDetails();
    },

    handlePendingSelectionChange(val) {
      this.selectedPendingRows = val;
      this.isAllSelected = (val.length === this.filteredPendingList.length && this.filteredPendingList.length > 0);
    },

    toggleSelectAll() {
      if (this.$refs.pendingTable) {
        if (this.isAllSelected) {
          this.$refs.pendingTable.clearSelection();
        } else {
          this.filteredPendingList.forEach(row => {
            this.$refs.pendingTable.toggleRowSelection(row, true);
          });
        }
      }
    },

    async batchCloseOrders() {
      if (this.selectedPendingRows.length === 0) return;

      try {
        await ElMessageBox.confirm(`確定要將已勾選的 ${this.selectedPendingRows.length} 筆調撥單據進行批次結案銷案嗎？`, '警告', {
          confirmButtonText: '確定銷案',
          cancelButtonText: '取消',
          type: 'warning'
        });

        const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '主管銷案';
        const keys = this.selectedPendingRows.map(r => ({ orderNo: r.order_no, itemId: r.item_id }));

        const res = await axios.post('/api/transfer1580/close-order', {
          keys,
          closeUser: username,
          closeRemark: '主管批次勾選銷案'
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message);
          if (this.drillFilterParams) {
            this.loadDrillPendingDetails(this.drillFilterParams);
          } else {
            this.fetchPendingDateList();
          }
          this.refreshAllData();
        }
      } catch (e) {
        if (e !== 'cancel') ElMessage.error('批次銷案失敗：' + e.message);
      }
    },

    async openDateRangeCloseDialog() {
      try {
        const { value: formValues } = await ElMessageBox.prompt('請輸入要批次銷案的日期區間 (格式：YYYY-MM-DD, YYYY-MM-DD)', '依日期區間一鍵銷案 (歷史舊單處置)', {
          confirmButtonText: '執行銷案',
          cancelButtonText: '取消',
          inputValue: '2026-01-01, 2026-08-31',
          inputPattern: /^\d{4}-\d{2}-\d{2}\s*,\s*\d{4}-\d{2}-\d{2}$/,
          inputErrorMessage: '格式不正確，例：2026-01-01, 2026-08-31'
        });

        if (formValues) {
          const [start, end] = formValues.split(',').map(s => s.trim());
          const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '主管銷案';

          const res = await axios.post('/api/transfer1580/close-order', {
            startDate: start,
            endDate: end,
            closeUser: username,
            closeRemark: `依日期區間 ${start} ~ ${end} 一鍵銷案`
          });

          if (res.data?.success) {
            ElMessage.success(res.data.message);
            if (this.drillFilterParams) {
              this.loadDrillPendingDetails(this.drillFilterParams);
            } else {
              this.fetchPendingDateList();
            }
            this.refreshAllData();
          }
        }
      } catch (e) {}
    },

    async openInvalidModal() {
      this.showInvalidModal = true;
      this.loadingInvalid = true;
      try {
        const res = await axios.get('/api/transfer1580/invalid-orders');
        if (res.data?.success) {
          this.invalidList = res.data.list || [];
          if (this.invalidList.length === 0) {
            ElMessage.info('🎉 目前沒有發現任何誤匯入的異常跨庫調撥單據！');
          }
        }
      } catch (e) {
        ElMessage.error('取得異常單據失敗：' + e.message);
      } finally {
        this.loadingInvalid = false;
      }
    },

    handleInvalidSelectionChange(selection) {
      this.selectedInvalidRows = selection;
    },

    async confirmDeleteSelectedInvalid() {
      if (this.selectedInvalidRows.length === 0) return;

      try {
        await ElMessageBox.confirm(`確定要剔除勾選的 ${this.selectedInvalidRows.length} 筆異常單據嗎？未勾選的資料將完整保留。`, '警告', {
          confirmButtonText: '確定刪除',
          cancelButtonText: '取消',
          type: 'danger'
        });

        this.isDeletingInvalid = true;
        const keys = this.selectedInvalidRows.map(r => ({ orderNo: r.order_no, itemId: r.item_id }));

        const res = await axios.post('/api/transfer1580/delete-batch-invalid', { keys });
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          await this.openInvalidModal();
          this.refreshAllData();
        }
      } catch (e) {
        if (e !== 'cancel') ElMessage.error('刪除處理失敗：' + e.message);
      } finally {
        this.isDeletingInvalid = false;
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
    },

    async refreshAllData() {
      await this.refreshCurrentMode();
      if (this.showPendingDialog) {
        if (this.drillFilterParams) {
          await this.loadDrillPendingDetails(this.drillFilterParams);
        } else {
          await this.fetchPendingDateList();
        }
      }
      ElMessage.success('🎉 資料已成功重新整理！');
    },

    triggerSelectCsv() {
      if (this.$refs.csvFileInput) this.$refs.csvFileInput.click();
    },

    handleCsvFileSelected(event) {
      const file = event.target.files[0];
      if (file) {
        this.showUploadCardModal = false;
        this.processImportFile(file);
      }
    },

    async processImportFile(file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
        return ElMessage.error('請上傳 .xls, .xlsx 或 .csv 格式的調撥單檔案！');
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
          const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
        } else {
          const text = await file.text();
          const results = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
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

          await axios.post('/api/transfer1580/import-json', {
            items: chunk,
            fileName: file.name,
            isFirstChunk
          });

          processed += chunk.length;
          this.uploadedRows = processed;
          this.uploadPercent = Math.min(100, Math.round((processed / this.totalRowsToUpload) * 100));
        }

        ElMessage.success(`🎉 成功同步 ${this.totalRowsToUpload.toLocaleString()} 筆跨庫調撥單資料！`);
        this.refreshAllData();
        this.resetUploadState();
      } catch (e) {
        ElMessage.error(e.response?.data?.message || '解析或處理失敗：' + e.message);
        this.resetUploadState();
      }
    },

    resetUploadState() {
      this.isUploading = false;
      this.showUploadProgressModal = false;
      if (this.$refs && this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
    },

    openCloseDialog(row) {
      this.selectedCloseRow = row;
      this.closeRemark = '現場實體已完成搬移銷案';
      this.showCloseModal = true;
    },

    async confirmCloseOrder() {
      if (!this.selectedCloseRow) return;

      this.isClosing = true;
      try {
        const username = localStorage.getItem('currentUser') || localStorage.getItem('username') || '主管銷案';

        const res = await axios.post('/api/transfer1580/close-order', {
          keys: [{ orderNo: this.selectedCloseRow.order_no, itemId: this.selectedCloseRow.item_id }],
          closeUser: username,
          closeRemark: this.closeRemark
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message || '跨庫調撥單成功銷案！');
          this.showCloseModal = false;
          if (this.drillFilterParams) {
            this.loadDrillPendingDetails(this.drillFilterParams);
          } else {
            this.fetchPendingDateList();
          }
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

        const res = await axios.get('/api/transfer1580/fish-analysis', {
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
        ElMessage.error('載入調撥魚群失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async fetchMonthlySummary() {
      this.loadingMonthly = true;
      try {
        const activeDocTypes = this.selectedDocTypes.includes('all') ? 'all' : this.selectedDocTypes.join(',');
        const activeReasons = this.selectedReasons.includes('all') ? 'all' : this.selectedReasons.join(',');

        const res = await axios.get('/api/transfer1580/monthly-summary', {
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

        const res = await axios.get('/api/transfer1580/yearly-summary', {
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

        const res = await axios.get('/api/transfer1580/pending-details', {
          params: {
            targetDate: this.activePendingDate,
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
.transfer-fish-page {
  position: relative;
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

/* 日期步進器樣式 */
.date-stepper-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid #334155;
}

.stepper-btn {
  padding: 6px 10px !important;
  font-weight: bold;
}

.stepper-today-btn {
  padding: 6px 10px !important;
  font-weight: bold;
  margin-left: 2px;
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
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.font-bold { font-weight: bold; }

.clickable-cell {
  cursor: pointer;
  text-decoration: underline;
  transition: all 0.2s ease;
}
.clickable-cell:hover {
  color: #f87171 !important;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.7);
  transform: scale(1.08);
}

.clickable-id {
  cursor: pointer;
  transition: all 0.2s ease;
}
.clickable-id:hover {
  text-decoration: underline;
  color: #60a5fa !important;
  text-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
}

.monitor-container {
  display: flex;
  gap: 15px;
  height: calc(85vh - 80px);
}

.side-date-nav {
  width: 220px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.nav-title {
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 10px;
  border-bottom: 1px solid #334155;
  padding-bottom: 6px;
}

.nav-scroll-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-date-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1e293b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  border: 1px solid transparent;
}

.nav-date-item:hover {
  background: #334155;
}

.active-date {
  background: #0284c7 !important;
  border-color: #38bdf8 !important;
  font-weight: bold;
}

.count-badge {
  background: #ef4444;
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.main-monitor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
}

.monitor-top-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-left-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.drill-tag {
  background: #b91c1c;
  color: #fef2f2;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.current-date-header {
  font-size: 14px;
  color: #f8fafc;
}

.id-search-box {
  display: flex;
  align-items: center;
}
.id-count-badge {
  color: #38bdf8;
  font-weight: bold;
  font-size: 11px;
  padding-right: 4px;
}

.toolbar-btns {
  display: flex;
  gap: 8px;
}

.empty-date-tip {
  text-align: center;
  color: #22c55e;
  padding: 20px 0;
  font-weight: bold;
}

.drop-card-box {
  background: #0f172a;
  border: 2px dashed #38bdf8;
  border-radius: 12px;
  padding: 35px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.drop-card-box:hover, .drop-card-active {
  background: #1e293b;
  border-color: #22c55e;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
  transform: translateY(-2px);
}

.drop-icon-wrapper {
  margin-bottom: 12px;
}

.drop-cloud-icon {
  font-size: 56px;
  color: #38bdf8;
  pointer-events: none;
}

.drop-card-box:hover .drop-cloud-icon {
  color: #22c55e;
  transform: scale(1.08);
}

.drop-text-primary {
  font-size: 15px;
  font-weight: bold;
  color: #f8fafc;
  pointer-events: none;
}

.highlight-text {
  color: #38bdf8;
}

.drop-text-secondary {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 6px;
  pointer-events: none;
}

.security-badge {
  display: inline-block;
  margin-top: 18px;
  padding: 4px 12px;
  background: #1e3a8a;
  color: #bfdbfe;
  font-size: 11px;
  border-radius: 20px;
  pointer-events: none;
}
</style>