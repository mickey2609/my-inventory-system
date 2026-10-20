<template>
  <div class="inbound-fish-page dark-bg">
    <!-- 隱藏的 CSV / Excel 檔案選擇器 -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv, .xls, .xlsx"
      @change="handleCsvFileSelected"
    />

    <!-- 1. 頂部操作與篩選列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 倉庫 進貨驗收與新品上架分析</span>
        
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

        <el-date-picker
          v-else
          v-model="targetYear"
          type="year"
          size="small"
          value-format="YYYY"
          placeholder="選擇年份"
          style="width: 110px;"
          @change="fetchYearlySummary"
        />

        <el-radio-group v-model="analysisMode" size="small" @change="handleAnalysisModeChange">
          <el-radio-button label="daily">📅 單日時段分析</el-radio-button>
          <el-radio-button label="monthly">🗓️ 每月每日總表</el-radio-button>
          <el-radio-button label="yearly">📊 年度每月總表</el-radio-button>
        </el-radio-group>

        <el-radio-group v-model="warehouse" size="small" @change="handleFilterChange">
          <el-radio-button label="all">🌐 雙庫合計</el-radio-button>
          <el-radio-button label="80">📦 80 庫 (人工)</el-radio-button>
          <el-radio-button label="15">🔍 15 庫 (自動)</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <el-button type="warning" size="small" icon="el-icon-warning" @click="openPendingDialog">
          未上架追蹤 ({{ totalPendingCount }} 筆)
        </el-button>

        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="refreshAllData">
          🔄 重新整理
        </el-button>

        <el-button
          v-if="checkSysAdmin"
          type="danger"
          size="small"
          icon="el-icon-delete"
          @click="openDeleteDialog"
        >
          🗑️ 刪除進貨資料
        </el-button>

        <el-button
          v-if="checkSysAdmin"
          type="success"
          size="small"
          icon="el-icon-upload2"
          :loading="isUploading"
          @click="showUploadCardModal = true"
        >
          📥 匯入進貨單據 (小卡投放)
        </el-button>
      </div>
    </div>

    <!-- 2. 控制卡片 -->
    <div class="filter-card">
      <div class="filter-item">
        <span class="filter-label">🏷️ 收貨備註魚群條件：</span>
        <el-checkbox-group v-model="selectedRemarks" size="small" @change="handleFilterChange">
          <el-checkbox label="empty">⚪ 空白 (正常件)</el-checkbox>
          <el-checkbox label="15">📦 (原15庫)</el-checkbox>
          <el-checkbox label="abnormal">⚠️ 異常件 (其他文字說明)</el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="filter-item view-switcher" v-if="analysisMode === 'daily'">
        <span class="filter-label">📌 統計檢視維度：</span>
        <el-radio-group v-model="activeViewTab" size="small">
          <el-radio-button label="po">📋 依進貨單號分析</el-radio-button>
          <el-radio-button label="batch">🏷️ 依驗收批號分析</el-radio-button>
          <el-radio-button label="both">📊 雙檢視對照 (完整)</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 3.1 單日分析表格區塊 -->
    <div class="table-container" v-loading="loading" v-if="analysisMode === 'daily'">
      <div class="sheet-title">
        倉庫 進貨驗收與新品上架分析 - {{ formatDateTitle(targetDate) }} ({{ getWarehouseLabel(warehouse) }})
        <span class="mode-tag">
          [{{ activeViewTab === 'po' ? '進貨單號模式' : (activeViewTab === 'batch' ? '驗收批號模式' : '雙視圖模式') }}]
        </span>
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <colgroup>
            <col style="width: 70px;" />
            <template v-if="activeViewTab === 'po' || activeViewTab === 'both'">
              <col class="col-bar-group" />
              <col style="width: 68px;" />
              <col style="width: 64px;" />
              <col style="width: 72px;" />
              <col style="width: 76px;" /> <!-- 單號未上架欄位 -->
              <col class="col-bar-group" />
              <col style="width: 68px;" />
              <col style="width: 64px;" />
              <col style="width: 72px;" />
            </template>
            <col v-if="activeViewTab === 'both'" style="width: 6px;" />
            <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
              <col class="col-bar-group" />
              <col style="width: 68px;" />
              <col style="width: 64px;" />
              <col style="width: 72px;" />
              <col style="width: 76px;" /> <!-- 🌟 批號未上架欄位 -->
              <col style="width: 76px;" />
              <col class="col-bar-group" />
              <col style="width: 68px;" />
              <col style="width: 64px;" />
              <col style="width: 72px;" />
              <col style="width: 76px;" />
            </template>
          </colgroup>

          <thead>
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <template v-if="activeViewTab === 'po' || activeViewTab === 'both'">
                <th colspan="5" class="group-blue-header">進貨單號驗收統計</th>
                <th colspan="4" class="group-green-header">新品單號上架統計</th>
              </template>
              <th v-if="activeViewTab === 'both'" class="col-sep"></th>
              <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
                <th colspan="5" class="group-blue-header">驗收批號驗收統計</th>
                <th class="col-ratio-header">比例</th>
                <th colspan="4" class="group-green-header">驗收批號上架統計</th>
                <th class="col-ratio-header">比例</th>
              </template>
            </tr>

            <tr class="header-sub">
              <template v-if="activeViewTab === 'po' || activeViewTab === 'both'">
                <th class="col-bar-title">單號圖形</th>
                <th>單號占比</th>
                <th>單號筆數</th>
                <th>驗收PCS</th>
                <th style="color: #fca5a5;">未上架筆數</th>
                <th class="col-bar-title">上架圖形</th>
                <th>上架占比</th>
                <th>上架筆數</th>
                <th>上架PCS</th>
              </template>

              <th v-if="activeViewTab === 'both'" class="col-sep"></th>

              <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
                <th class="col-bar-title">批號圖形</th>
                <th>批號占比</th>
                <th>批號筆數</th>
                <th>批號PCS</th>
                <th style="color: #fca5a5;">未上架筆數</th> <!-- 🌟 新增批號未上架標頭 -->
                <th>驗收單/批比</th>
                <th class="col-bar-title">批上圖形</th>
                <th>批上占比</th>
                <th>批號筆數</th>
                <th>批號PCS</th>
                <th>上架單/批比</th>
              </template>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(h, idx) in hourlyStats" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="col-time font-bold">{{ h.hourStr }}</td>
              <template v-if="activeViewTab === 'po' || activeViewTab === 'both'">
                <td class="col-bar-cell"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.recPoPct) }"></div></td>
                <td class="text-right">{{ formatPercent(h.recPoPct) }}</td>
                <td class="text-right">{{ formatNumber(h.recPoCount) }}</td>
                <td class="text-right font-bold text-blue">{{ formatNumber(h.recPoPcs) }}</td>
                <td class="text-right font-bold" :class="{ 'text-red': h.unputPoCount > 0 }">
                  {{ formatNumber(h.unputPoCount) }}
                </td>

                <td class="col-bar-cell"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.putPoPct) }"></div></td>
                <td class="text-right">{{ formatPercent(h.putPoPct) }}</td>
                <td class="text-right">{{ formatNumber(h.putPoCount) }}</td>
                <td class="text-right font-bold text-green">{{ formatNumber(h.putPoPcs) }}</td>
              </template>

              <td v-if="activeViewTab === 'both'" class="col-sep"></td>

              <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
                <td class="col-bar-cell"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.recBatPct) }"></div></td>
                <td class="text-right">{{ formatPercent(h.recBatPct) }}</td>
                <td class="text-right">{{ formatNumber(h.recBatCount) }}</td>
                <td class="text-right font-bold text-blue">{{ formatNumber(h.recBatPcs) }}</td>
                
                <!-- 🌟 顯示批號未上架數量 (>0 顯紅警示) -->
                <td class="text-right font-bold" :class="{ 'text-red': h.unputBatCount > 0 }">
                  {{ formatNumber(h.unputBatCount) }}
                </td>

                <td class="text-right font-bold">{{ formatRatio(h.recBatCount, h.recPoCount) }}</td>

                <td class="col-bar-cell"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.putBatPct) }"></div></td>
                <td class="text-right">{{ formatPercent(h.putBatPct) }}</td>
                <td class="text-right">{{ formatNumber(h.putBatCount) }}</td>
                <td class="text-right font-bold text-green">{{ formatNumber(h.putBatPcs) }}</td>
                <td class="text-right font-bold">{{ formatRatio(h.putBatCount, h.putPoCount) }}</td>
              </template>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="col-time font-bold">總計</td>
              <template v-if="activeViewTab === 'po' || activeViewTab === 'both'">
                <td></td>
                <td class="text-right font-bold">100.00%</td>
                <td class="text-right font-bold">{{ formatNumber(summaryTotal.recPoCount) }}</td>
                <td class="text-right font-bold text-blue">{{ formatNumber(summaryTotal.recPoPcs) }}</td>
                <td class="text-right font-bold text-red">{{ formatNumber(summaryTotal.unputPoCount) }}</td>

                <td></td>
                <td class="text-right font-bold">100.00%</td>
                <td class="text-right font-bold">{{ formatNumber(summaryTotal.putPoCount) }}</td>
                <td class="text-right font-bold text-green">{{ formatNumber(summaryTotal.putPoPcs) }}</td>
              </template>

              <td v-if="activeViewTab === 'both'" class="col-sep"></td>

              <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
                <td></td>
                <td class="text-right font-bold">100.00%</td>
                <td class="text-right font-bold">{{ formatNumber(summaryTotal.recBatCount) }}</td>
                <td class="text-right font-bold text-blue">{{ formatNumber(summaryTotal.recBatPcs) }}</td>
                <!-- 🌟 批號未上架總計 -->
                <td class="text-right font-bold text-red">{{ formatNumber(summaryTotal.unputBatCount) }}</td>
                <td class="text-right font-bold">{{ formatRatio(summaryTotal.recBatCount, summaryTotal.recPoCount) }}</td>
                <td></td>
                <td class="text-right font-bold">100.00%</td>
                <td class="text-right font-bold">{{ formatNumber(summaryTotal.putBatCount) }}</td>
                <td class="text-right font-bold text-green">{{ formatNumber(summaryTotal.putBatPcs) }}</td>
                <td class="text-right font-bold">{{ formatRatio(summaryTotal.putBatCount, summaryTotal.putPoCount) }}</td>
              </template>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.2 每月每日總表區塊 -->
    <div class="table-container" v-loading="loadingMonthly" v-else-if="analysisMode === 'monthly'">
      <div class="sheet-title">
        🗓️ 倉庫 進貨驗收與新品上架 - {{ targetMonth }} 月份每日總表 ({{ getWarehouseLabel(warehouse) }})
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">驗收/上架日期</th>
              <th colspan="3" class="group-blue-header">進貨驗收每日匯總</th>
              <th colspan="3" class="group-green-header">新品上架每日匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 100px;">當日上架率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 110px;">進貨單數 (PO)</th>
              <th style="width: 110px;">驗收批數</th>
              <th style="width: 120px;">驗收 PCS</th>
              <th style="width: 110px;">上架單數 (PO)</th>
              <th style="width: 110px;">上架批數</th>
              <th style="width: 120px;">上架 PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(day, idx) in monthlyDailyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ day.date }}</td>
              <td class="text-right">{{ formatNumber(day.recPoCount) }}</td>
              <td class="text-right">{{ formatNumber(day.recBatCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(day.recPcs) }}</td>
              
              <td class="text-right">{{ formatNumber(day.putPoCount) }}</td>
              <td class="text-right">{{ formatNumber(day.putBatCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(day.putPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ day.putRate }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全月總計</td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.recPoCount) }}</td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.recBatCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(monthlySummaryTotal.recPcs) }}</td>
              
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.putPoCount) }}</td>
              <td class="text-right font-bold">{{ formatNumber(monthlySummaryTotal.putBatCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(monthlySummaryTotal.putPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ monthlySummaryTotal.putRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 3.3 年度每月總表區塊 -->
    <div class="table-container" v-loading="loadingYearly" v-else>
      <div class="sheet-title">
        📊 倉庫 進貨驗收與新品上架 - {{ targetYear }} 年度每月總表 ({{ getWarehouseLabel(warehouse) }})
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <tr class="header-main">
              <th style="width: 110px;" rowspan="2">驗收/上架月份</th>
              <th colspan="3" class="group-blue-header">進貨驗收每月匯總</th>
              <th colspan="3" class="group-green-header">新品上架每月匯總</th>
              <th class="col-ratio-header" rowspan="2" style="width: 110px;">當月上架率 (%)</th>
            </tr>
            <tr class="header-sub">
              <th style="width: 110px;">進貨單數 (PO)</th>
              <th style="width: 110px;">驗收批數</th>
              <th style="width: 120px;">驗收 PCS</th>
              <th style="width: 110px;">上架單數 (PO)</th>
              <th style="width: 110px;">上架批數</th>
              <th style="width: 120px;">上架 PCS</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(m, idx) in yearlyMonthlyList" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <td class="text-center font-bold">{{ m.month }}</td>
              <td class="text-right">{{ formatNumber(m.recPoCount) }}</td>
              <td class="text-right">{{ formatNumber(m.recBatCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(m.recPcs) }}</td>
              
              <td class="text-right">{{ formatNumber(m.putPoCount) }}</td>
              <td class="text-right">{{ formatNumber(m.putBatCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(m.putPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ m.putRate }}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr class="row-summary">
              <td class="text-center font-bold">全年度總計</td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.recPoCount) }}</td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.recBatCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(yearlySummaryTotal.recPcs) }}</td>
              
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.putPoCount) }}</td>
              <td class="text-right font-bold">{{ formatNumber(yearlySummaryTotal.putBatCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(yearlySummaryTotal.putPcs) }}</td>
              
              <td class="text-right font-bold text-orange">{{ yearlySummaryTotal.putRate }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 4. 專屬互動式檔案拖曳投放小卡 Modal -->
    <el-dialog
      v-model="showUploadCardModal"
      title="📥 匯入 進貨驗收與新品上架單據"
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
          將 <span class="highlight-text">.xls / .xlsx / .csv</span> 進貨檔案拖曳至此小卡
        </div>
        <div class="drop-text-secondary">
          或點擊此區域從電腦選取檔案
        </div>

        <div class="security-badge">
          🛡️ 系統自動相容合併欄位與 A/B 欄偏移，跳過標頭註記與總計筆數
        </div>
      </div>
    </el-dialog>

    <!-- 5. 逐日/區間 批次刪除進貨明細 Modal -->
    <el-dialog
      v-model="showDeleteModal"
      title="🗑️ 逐日 / 批次刪除地端進貨明細"
      width="460px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="resolve-form">
        <p style="color: #f87171; font-weight: bold;">
          ⚠️ 警告：將會徹底刪除地端指定日期與庫別的進貨紀錄！
        </p>

        <el-form label-width="100px" size="small">
          <el-form-item label="刪除庫別：">
            <el-radio-group v-model="deleteWarehouse">
              <el-radio label="all">🌐 雙庫 (所有庫別)</el-radio>
              <el-radio label="80">📦 僅 80 庫</el-radio>
              <el-radio label="15">🔍 僅 15 庫</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="開始日期：">
            <el-date-picker v-model="deleteStartDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>

          <el-form-item label="結束日期：">
            <el-date-picker v-model="deleteEndDate" type="date" value-format="YYYY-MM-DD" placeholder="（留空表示僅刪除單日）" style="width: 100%;" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button size="small" @click="showDeleteModal = false">取消</el-button>
        <el-button type="danger" size="small" :loading="isDeleting" @click="submitDeleteByDate">
          確認執行刪除
        </el-button>
      </template>
    </el-dialog>

    <!-- 6. CSV / Excel 上傳進度條 Modal -->
    <el-dialog
      v-model="showUploadProgressModal"
      title="⚡ 正在寫入與覆蓋更新進貨明細資料..."
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
        <el-progress
          :percentage="uploadPercent"
          :stroke-width="18"
          :text-inside="true"
          status="success"
        />
        <p class="tip-info">💡 系統正使用高效 Transaction 進行資料比對與覆蓋更新，請勿關閉視窗...</p>
      </div>
    </el-dialog>

    <!-- 7. 高對比寬版未上架彈窗 (支援全選當頁與按日期區間一鍵銷案) -->
    <el-dialog 
      v-model="showPendingDialog" 
      title="⚠️ 尚未上架明細監控與更正處置" 
      width="92%" 
      top="4vh"
      append-to-body 
      custom-class="dark-dialog large-pending-dialog"
    >
      <div class="pending-dialog-body">
        <div class="pending-summary-sidebar">
          <p class="sidebar-title">📅 選擇驗收日期：</p>
          <div class="date-list">
            <div
              v-for="item in pendingSummary"
              :key="item.rec_date"
              class="date-item"
              :class="{ active: selectedPendingDate === item.rec_date }"
              @click="loadPendingDetails(item.rec_date)"
            >
              <span class="d-text">{{ item.rec_date }}</span>
              <span class="d-badge">{{ item.pending_count }} 筆</span>
            </div>
          </div>
        </div>

        <div class="pending-details-content" v-loading="loadingDetails">
          <div class="content-header" v-if="selectedPendingDate">
            <span class="detail-title">🔍 <strong>{{ selectedPendingDate }}</strong> 未上架明細 ({{ currentDetailsList.length }} 筆)</span>
            
            <div class="btn-group">
              <el-button
                type="info"
                size="small"
                plain
                @click="toggleSelectAllPage"
              >
                ☑️ 全選當頁 ({{ currentDetailsList.length }} 筆)
              </el-button>

              <el-button
                type="danger"
                size="small"
                :disabled="selectedDetailRows.length === 0"
                @click="openResolveDialog(selectedDetailRows)"
              >
                🛠️ 勾選批次銷案 (已選 {{ selectedDetailRows.length }} 筆)
              </el-button>

              <el-button
                type="warning"
                size="small"
                @click="openRangeResolveDialog"
              >
                🗓️ 依日期區間一鍵銷案 (專處理1~8月)
              </el-button>
            </div>
          </div>

          <el-table
            ref="pendingTable"
            :data="currentDetailsList"
            border
            stripe
            size="small"
            height="460px"
            class="dark-table"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="rec_date" label="驗收日期" width="105" align="center" />
            <el-table-column prop="rec_time" label="驗收時間" width="85" align="center" />
            <el-table-column prop="po_no" label="進貨單號" width="150" align="center" />
            <el-table-column prop="batch_no" label="驗收批號" width="150" align="center" />
            <el-table-column prop="item_name" label="商品名稱" min-width="220" show-overflow-tooltip />
            <el-table-column prop="qty" label="數量" width="70" align="right">
              <template #default="scope">
                <span class="font-bold text-blue">{{ scope.row.qty }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="收貨備註" min-width="160" show-overflow-tooltip />
            <el-table-column label="處置" width="90" align="center" fixed="right">
              <template #default="scope">
                <el-button type="danger" size="mini" plain @click="openResolveDialog([scope.row])">
                  🛠️ 銷案
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 8. 更正銷案 Modal (勾選) -->
    <el-dialog v-model="showResolveModal" title="🛠️ 銷案/更正未上架記錄" width="420px" append-to-body custom-class="dark-dialog">
      <div class="resolve-form">
        <p>準備更正 <strong>{{ targetResolveItems.length }}</strong> 筆未上架項目：</p>
        
        <el-form label-width="90px" size="small">
          <el-form-item label="更正原因：">
            <el-radio-group v-model="resolveReason">
              <el-radio label="同仁多驗/誤驗收 (無法上架)">同仁多驗/誤驗收 (無法上架)</el-radio>
              <el-radio label="廠商退回/異常件處置">廠商退回/異常件處置</el-radio>
              <el-radio label="補填預設上架日期">補填預設上架日期</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="resolveReason === '補填預設上架日期'" label="上架日期：">
            <el-date-picker v-model="customPutDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇上架日期" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button size="small" @click="showResolveModal = false">取消</el-button>
        <el-button type="primary" size="small" :loading="resolving" @click="submitResolve">確認銷案更正</el-button>
      </template>
    </el-dialog>

    <!-- 9. 日期區間一鍵銷案 Modal -->
    <el-dialog v-model="showRangeResolveModal" title="🗓️ 依日期區間一鍵批次銷案" width="460px" append-to-body custom-class="dark-dialog">
      <div class="resolve-form">
        <p style="color: #fbbf24;">⚠️ 將會把指定日期範圍內**所有未上架項目**一次全數銷案！</p>
        
        <el-form label-width="100px" size="small">
          <el-form-item label="開始日期：">
            <el-date-picker v-model="rangeStartDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>

          <el-form-item label="結束日期：">
            <el-date-picker v-model="rangeEndDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>

          <el-form-item label="銷案備註：">
            <el-input v-model="rangeReason" placeholder="例如: 1~8月歷史資料批次銷案" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button size="small" @click="showRangeResolveModal = false">取消</el-button>
        <el-button type="danger" size="small" :loading="resolvingRange" @click="submitRangeResolve">確認一鍵銷案</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'

export default {
  name: 'InboundFishList',
  props: {
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      analysisMode: 'daily',
      loading: false,
      loadingMonthly: false,
      loadingYearly: false,
      targetDate: new Date().toISOString().split('T')[0],
      targetMonth: new Date().toISOString().slice(0, 7),
      targetYear: new Date().getFullYear().toString(),
      warehouse: 'all',
      selectedRemarks: ['empty', '15', 'abnormal'],
      activeViewTab: 'po',
      hourlyStats: [],
      monthlyDailyList: [],
      yearlyMonthlyList: [],

      showPendingDialog: false,
      pendingSummary: [],
      totalPendingCount: 0,

      selectedPendingDate: '',
      currentDetailsList: [],
      selectedDetailRows: [],
      loadingDetails: false,

      showUploadCardModal: false,
      isCardHover: false,

      showDeleteModal: false,
      deleteWarehouse: 'all',
      deleteStartDate: new Date().toISOString().split('T')[0],
      deleteEndDate: '',
      isDeleting: false,

      showResolveModal: false,
      targetResolveItems: [],
      resolveReason: '同仁多驗/誤驗收 (無法上架)',
      customPutDate: '',
      resolving: false,

      showRangeResolveModal: false,
      rangeStartDate: '2026-01-01',
      rangeEndDate: '2026-08-31',
      rangeReason: '1~8月歷史匯入資料批次銷案',
      resolvingRange: false,

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
      const tot = {
        recPoCount: 0, recPoPcs: 0, unputPoCount: 0,
        putPoCount: 0, putPoPcs: 0,
        recBatCount: 0, recBatPcs: 0, unputBatCount: 0,
        putBatCount: 0, putBatPcs: 0
      };
      this.hourlyStats.forEach(h => {
        tot.recPoCount += h.recPoCount || 0;
        tot.recPoPcs += h.recPoPcs || 0;
        tot.unputPoCount += h.unputPoCount || 0;
        tot.putPoCount += h.putPoCount || 0;
        tot.putPoPcs += h.putPoPcs || 0;
        tot.recBatCount += h.recBatCount || 0;
        tot.recBatPcs += h.recBatPcs || 0;
        tot.unputBatCount += h.unputBatCount || 0;
        tot.putBatCount += h.putBatCount || 0;
        tot.putBatPcs += h.putBatPcs || 0;
      });
      return tot;
    },
    monthlySummaryTotal() {
      const tot = {
        recPoCount: 0, recBatCount: 0, recPcs: 0,
        putPoCount: 0, putBatCount: 0, putPcs: 0
      };
      this.monthlyDailyList.forEach(d => {
        tot.recPoCount += d.recPoCount || 0;
        tot.recBatCount += d.recBatCount || 0;
        tot.recPcs += d.recPcs || 0;
        tot.putPoCount += d.putPoCount || 0;
        tot.putBatCount += d.putBatCount || 0;
        tot.putPcs += d.putPcs || 0;
      });
      const putRate = tot.recPcs > 0 ? ((tot.putPcs / tot.recPcs) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, putRate };
    },
    yearlySummaryTotal() {
      const tot = {
        recPoCount: 0, recBatCount: 0, recPcs: 0,
        putPoCount: 0, putBatCount: 0, putPcs: 0
      };
      this.yearlyMonthlyList.forEach(m => {
        tot.recPoCount += m.recPoCount || 0;
        tot.recBatCount += m.recBatCount || 0;
        tot.recPcs += m.recPcs || 0;
        tot.putPoCount += m.putPoCount || 0;
        tot.putBatCount += m.putBatCount || 0;
        tot.putPcs += m.putPcs || 0;
      });
      const putRate = tot.recPcs > 0 ? ((tot.putPcs / tot.recPcs) * 100).toFixed(2) + '%' : '0.00%';
      return { ...tot, putRate };
    }
  },
  mounted() {
    this.fetchFishData();
    this.fetchPendingSummary();

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
    formatRatio(num, den) {
      if (!den || den === 0) return '0.00';
      return (num / den).toFixed(2);
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
    getWarehouseLabel(wh) {
      if (wh === '80') return '80 庫';
      if (wh === '15') return '15 庫';
      return '雙庫合計';
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

    openDeleteDialog() {
      this.deleteWarehouse = this.warehouse || 'all';
      this.deleteStartDate = this.targetDate || new Date().toISOString().split('T')[0];
      this.deleteEndDate = '';
      this.showDeleteModal = true;
    },

    async submitDeleteByDate() {
      if (!this.deleteStartDate) {
        return ElMessage.warning('請選擇要刪除的開始日期！');
      }

      const whLabel = this.deleteWarehouse === 'all' ? '所有庫別 (80與15庫)' : `${this.deleteWarehouse} 庫`;
      const dateLabel = this.deleteEndDate ? `${this.deleteStartDate} ~ ${this.deleteEndDate}` : `${this.deleteStartDate}`;

      try {
        await ElMessageBox.confirm(
          `確定要刪除 ${whLabel} 於 [ ${dateLabel} ] 期間的所有進貨明細嗎？此動作無法復原！`,
          '⚠️ 確定刪除進貨明細？',
          { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'error' }
        );

        this.isDeleting = true;
        const res = await axios.post('/api/inbound/delete-by-date', {
          startDate: this.deleteStartDate,
          endDate: this.deleteEndDate,
          warehouse: this.deleteWarehouse
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.showDeleteModal = false;
          this.refreshAllData();
        }
      } catch (e) {
        if (e !== 'cancel') {
          ElMessage.error('刪除失敗：' + (e.response?.data?.message || e.message));
        }
      } finally {
        this.isDeleting = false;
      }
    },

    handleAnalysisModeChange(mode) {
      if (mode === 'daily') {
        this.fetchFishData();
      } else if (mode === 'monthly') {
        this.fetchMonthlySummary();
      } else {
        this.fetchYearlySummary();
      }
    },

    handleFilterChange() {
      if (this.analysisMode === 'daily') {
        this.fetchFishData();
      } else if (this.analysisMode === 'monthly') {
        this.fetchMonthlySummary();
      } else {
        this.fetchYearlySummary();
      }
    },

    async refreshAllData() {
      if (this.analysisMode === 'daily') {
        await Promise.all([this.fetchFishData(), this.fetchPendingSummary()]);
      } else if (this.analysisMode === 'monthly') {
        await Promise.all([this.fetchMonthlySummary(), this.fetchPendingSummary()]);
      } else {
        await Promise.all([this.fetchYearlySummary(), this.fetchPendingSummary()]);
      }
      ElMessage.success('🎉 資料已成功重新整理！');
    },

    triggerSelectCsv() {
      if (this.$refs && this.$refs.csvFileInput) {
        this.$refs.csvFileInput.click();
      }
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
        return ElMessage.error('請選擇 .csv 或 .xls/.xlsx 格式的進貨明細檔案！');
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
          const Papa = (await import('papaparse')).default;
          const text = await file.text();
          const results = Papa.parse(text, { header: true, skipEmptyLines: true });
          rawData = results.data || [];
        }

        if (rawData.length === 0) {
          this.resetUploadState();
          return ElMessage.error('檔案內無有效資料！');
        }

        this.totalRowsToUpload = rawData.length;
        const BATCH_SIZE = 10000;
        let processed = 0;

        for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
          const chunk = rawData.slice(i, i + BATCH_SIZE);
          const isFirstChunk = (i === 0);

          await axios.post('/api/inbound/import-json', {
            items: chunk,
            fileName: file.name,
            isFirstChunk: isFirstChunk
          });

          processed += chunk.length;
          this.uploadedRows = processed;
          this.uploadPercent = Math.min(100, Math.round((processed / this.totalRowsToUpload) * 100));
        }

        ElMessage.success(`🎉 成功寫入並更新 ${this.totalRowsToUpload.toLocaleString()} 筆進貨明細資料！`);
        this.refreshAllData();
        this.resetUploadState();
      } catch (e) {
        ElMessage.error('上傳處理失敗：' + e.message);
        this.resetUploadState();
      }
    },

    resetUploadState() {
      this.isUploading = false;
      this.showUploadProgressModal = false;
      if (this.$refs && this.$refs.csvFileInput) {
        this.$refs.csvFileInput.value = '';
      }
    },

    async fetchFishData() {
      this.loading = true;
      try {
        const res = await axios.get('/api/inbound/fish-analysis', {
          params: {
            targetDate: this.targetDate,
            warehouse: this.warehouse,
            remarks: this.selectedRemarks.join(',')
          }
        });
        if (res.data?.success) {
          const rawHourly = res.data.hourlyStats || [];
          
          let totRecPo = 0, totPutPo = 0, totRecBat = 0, totPutBat = 0;
          rawHourly.forEach(r => {
            totRecPo += r.recPoCount || 0;
            totPutPo += r.putPoCount || 0;
            totRecBat += r.recBatCount || 0;
            totPutBat += r.putBatCount || 0;
          });

          this.hourlyStats = rawHourly.map((r, i) => {
            const hStr = `${String(i).padStart(2, '0')} ~ ${String(i + 1).padStart(2, '0')}`;
            return {
              ...r,
              hourStr: hStr,
              recBatPcs: r.recPoPcs || 0,
              putBatPcs: r.putPoPcs || 0,
              recPoPct: totRecPo > 0 ? (r.recPoCount / totRecPo) : 0,
              putPoPct: totPutPo > 0 ? (r.putPoCount / totPutPo) : 0,
              recBatPct: totRecBat > 0 ? (r.recBatCount / totRecBat) : 0,
              putBatPct: totPutBat > 0 ? (r.putBatCount / totPutBat) : 0
            };
          });
        }
      } catch (e) {
        ElMessage.error('載入魚群資料失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async fetchMonthlySummary() {
      this.loadingMonthly = true;
      try {
        const res = await axios.get('/api/inbound/monthly-summary', {
          params: {
            month: this.targetMonth,
            warehouse: this.warehouse,
            remarks: this.selectedRemarks.join(',')
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
        const res = await axios.get('/api/inbound/yearly-summary', {
          params: {
            year: this.targetYear,
            warehouse: this.warehouse,
            remarks: this.selectedRemarks.join(',')
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

    async fetchPendingSummary() {
      try {
        const res = await axios.get('/api/inbound/pending-putaway');
        if (res.data?.success) {
          this.pendingSummary = res.data.pendingSummary || [];
          this.totalPendingCount = this.pendingSummary.reduce((sum, item) => sum + item.pending_count, 0);
          if (this.pendingSummary.length > 0) {
            this.selectedPendingDate = this.pendingSummary[0].rec_date;
            this.loadPendingDetails(this.selectedPendingDate);
          }
        }
      } catch (e) {
        console.error('抓取未上架統計失敗:', e.message);
      }
    },

    openPendingDialog() {
      this.fetchPendingSummary();
      this.showPendingDialog = true;
    },

    async loadPendingDetails(recDate) {
      this.selectedPendingDate = recDate;
      this.loadingDetails = true;
      try {
        const res = await axios.get('/api/inbound/pending-details', { params: { recDate } });
        if (res.data?.success) {
          this.currentDetailsList = res.data.pendingDetails || [];
          if (res.data.selectedDate) {
            this.selectedPendingDate = res.data.selectedDate;
          }
        }
      } catch (e) {
        ElMessage.error('載入明細失敗：' + e.message);
      } finally {
        this.loadingDetails = false;
      }
    },

    handleSelectionChange(val) {
      this.selectedDetailRows = val;
    },

    toggleSelectAllPage() {
      if (!this.$refs.pendingTable) return;
      const isAllSelected = this.selectedDetailRows.length === this.currentDetailsList.length;
      if (isAllSelected) {
        this.$refs.pendingTable.clearSelection();
      } else {
        this.currentDetailsList.forEach(row => {
          this.$refs.pendingTable.toggleRowSelection(row, true);
        });
      }
    },

    openResolveDialog(items) {
      this.targetResolveItems = items;
      this.resolveReason = '同仁多驗/誤驗收 (無法上架)';
      this.customPutDate = '';
      this.showResolveModal = true;
    },

    async submitResolve() {
      if (!this.targetResolveItems.length) return;
      this.resolving = true;
      try {
        const keys = this.targetResolveItems.map(row => ({
          warehouse: row.warehouse,
          po_no: row.po_no,
          batch_no: row.batch_no,
          item_id: row.item_id
        }));

        const res = await axios.post('/api/inbound/update-pending-status', {
          keys,
          reason: this.resolveReason,
          customPutDate: this.customPutDate
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.showResolveModal = false;
          await this.fetchPendingSummary();
          if (this.selectedPendingDate) {
            await this.loadPendingDetails(this.selectedPendingDate);
          }
          this.refreshAllData();
        }
      } catch (e) {
        ElMessage.error('銷案失敗：' + e.message);
      } finally {
        this.resolving = false;
      }
    },

    openRangeResolveDialog() {
      this.rangeStartDate = '2026-01-01';
      this.rangeEndDate = '2026-08-31';
      this.rangeReason = '1~8月歷史匯入資料批次銷案';
      this.showRangeResolveModal = true;
    },

    async submitRangeResolve() {
      if (!this.rangeStartDate || !this.rangeEndDate) {
        return ElMessage.warning('請選擇開始與結束日期！');
      }

      try {
        await ElMessageBox.confirm(
          `確定要將 ${this.rangeStartDate} ~ ${this.rangeEndDate} 期間的所有未上架資料全數銷案嗎？`,
          '⚠️ 警告：批次銷案確認',
          { confirmButtonText: '確定銷案', cancelButtonText: '取消', type: 'warning' }
        );

        this.resolvingRange = true;
        const res = await axios.post('/api/inbound/batch-resolve-range', {
          startDate: this.rangeStartDate,
          endDate: this.rangeEndDate,
          reason: this.rangeReason
        });

        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.showRangeResolveModal = false;
          await this.fetchPendingSummary();
          this.refreshAllData();
        }
      } catch (e) {
        if (e !== 'cancel') {
          ElMessage.error('區間銷案失敗：' + e.message);
        }
      } finally {
        this.resolvingRange = false;
      }
    }
  }
}
</script>

<style scoped>
.inbound-fish-page {
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

.title-group, .action-group, .btn-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: bold;
  color: #38bdf8;
}

.filter-card {
  background: #1e293b;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-label {
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
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
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.mode-tag {
  font-size: 12px;
  color: #0369a1;
  font-weight: normal;
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
}

.col-bar-group, .col-bar-title, .col-bar-cell {
  width: auto !important;
  padding: 2px 6px !important;
}

.col-sep {
  background: #334155;
  padding: 0 !important;
}

.header-main th {
  font-weight: bold;
  text-align: center;
}

.group-blue-header {
  background: #1e3a8a;
  color: #bfdbfe;
}

.group-green-header {
  background: #14532d;
  color: #bbf7d0;
}

.col-ratio-header {
  background: #854d0e;
  color: #fef08a;
}

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

.row-zebra td {
  background: rgba(255, 255, 255, 0.03);
}

.row-summary td {
  background: #334155;
  font-weight: bold;
}

.text-red {
  color: #ef4444 !important;
  font-weight: bold;
}

/* 投放小卡風格 */
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

:deep(.el-dialog.dark-dialog.large-pending-dialog) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border: 1px solid #334155 !important;
  border-radius: 8px !important;
  margin-bottom: 20px !important;
}

:deep(.large-pending-dialog .el-dialog__header) {
  background-color: #0f172a !important;
  border-bottom: 1px solid #334155 !important;
  padding: 14px 20px !important;
  margin-right: 0 !important;
}

:deep(.large-pending-dialog .el-dialog__body) {
  background-color: #1e293b !important;
  padding: 16px !important;
  color: #f8fafc !important;
}

:deep(.dark-dialog .el-dialog__title) {
  color: #38bdf8 !important;
  font-weight: bold;
  font-size: 16px;
}

:deep(.dark-table) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
}

:deep(.dark-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.dark-table td.el-table__cell) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border-bottom: 1px solid #334155 !important;
}

.pending-dialog-body {
  display: flex;
  gap: 16px;
  background-color: #1e293b;
  width: 100%;
  box-sizing: border-box;
}

.pending-summary-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #334155;
  padding-right: 12px;
}

.sidebar-title {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: #38bdf8;
  font-weight: bold;
}

.date-list {
  max-height: 460px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #f8fafc !important;
  font-weight: 500;
}

.date-item:hover {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.2);
}

.date-item.active {
  border-color: #38bdf8;
  background: #0284c7 !important;
  color: #ffffff !important;
  font-weight: bold;
}

.d-badge {
  color: #fbbf24;
  font-weight: bold;
}

.date-item.active .d-badge {
  color: #fef08a;
}

.pending-details-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-title {
  font-size: 13px;
  color: #f8fafc;
}

.resolve-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #f8fafc;
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.font-bold { font-weight: bold; }
</style>