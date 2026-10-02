<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <!-- 頂部操作列與設定按鈕 -->
      <div class="top-bar-actions">
        <div class="left-title-group">
          <span class="page-title-text">📊 儲位數與才數統計概覽 (跨區交叉矩陣)</span>
          
          <!-- 🌟 歷史快照選擇下拉選單 🌟 -->
          <el-select 
            v-model="selectedDate" 
            placeholder="選擇紀錄日期" 
            size="mini" 
            style="width: 210px; margin-left: 15px;"
            @change="onDateChange"
          >
            <el-option label="⚡ 當前即時試算數據" value="realtime" />
            <el-option 
              v-for="item in historyList" 
              :key="item.record_date" 
              :label="`${item.record_date} (${item.file_name || '歷史快照'})`" 
              :value="item.record_date" 
            />
          </el-select>
          <span v-if="selectedDate !== 'realtime'" class="history-tag">
            📌 歷史快照模式
          </span>
        </div>

        <div class="btn-group">
          <!-- 重新整理按鈕 -->
          <el-button 
            type="primary" 
            size="small" 
            icon="el-icon-refresh" 
            :loading="loading" 
            @click="fetchRealtimeAndHistory"
          >
            重新整理數據
          </el-button>

          <!-- 🌟 歷史快照管理按鈕 🌟 -->
          <el-button 
            type="info" 
            size="small" 
            icon="el-icon-date" 
            @click="showHistoryManagerModal = true"
          >
            🗓️ 歷史快照管理
          </el-button>

          <!-- 🌟 匯出 XLSX 按鈕 (依權限控制顯示) 🌟 -->
          <el-button 
            v-if="exportPerms.xlsx"
            type="success" 
            size="small" 
            icon="el-icon-document" 
            :loading="exportingXlsx"
            @click="exportFullXlsx"
            class="export-top-btn btn-xlsx"
          >
            📊 匯出 xlsx (3工作表)
          </el-button>

          <!-- 🌟 匯出 PDF 按鈕 (依權限控制顯示，預設關閉) 🌟 -->
          <el-button 
            v-if="exportPerms.pdf"
            type="danger" 
            size="small" 
            icon="el-icon-printer" 
            :loading="exportingPdf"
            @click="exportFullPdf"
            class="export-top-btn btn-pdf"
          >
            🖨️ 匯出 PDF (3頁)
          </el-button>

          <!-- 🌟 儲位定義設定按鈕 (只有系統管理員 sys_admin 看的到) 🌟 -->
          <el-button 
            v-if="isAdmin"
            type="warning" 
            size="small" 
            icon="el-icon-setting" 
            @click="openConfigModal"
          >
            ⚙️ 儲位定義設定 (匯入/檢視 CSV)
          </el-button>
        </div>
      </div>

      <!-- 7 大數據指標卡片 (自動響應即時 / 歷史快照數據) -->
      <div class="stats-overview-grid">
        <div class="stat-card">
          <span class="stat-lbl">規劃總儲格數</span>
          <span class="stat-val text-blue">{{ formatNumber(activeStats.total_plan_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中儲格數</span>
          <span class="stat-val text-green">{{ formatNumber(activeStats.total_used_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">剩餘空儲格數</span>
          <span class="stat-val text-orange">{{ formatNumber(activeStats.total_rem_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">規劃總才數</span>
          <span class="stat-val text-blue">{{ formatNumber(activeStats.total_plan_vol) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中才數</span>
          <span class="stat-val text-green">{{ formatNumber(activeStats.total_used_vol) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">剩餘空才數</span>
          <span class="stat-val text-orange">{{ formatNumber(activeStats.total_rem_vol) }}</span>
        </div>
        <div class="stat-card highlight-health">
          <span class="stat-lbl">儲位整體健康度</span>
          <span class="stat-val text-cyan">{{ activeStats.total_health || '0.0%' }}</span>
        </div>
      </div>

      <!-- 進度條面板 -->
      <div v-if="loading" class="progress-box dark-panel">
        <div class="progress-lbl">⚡ 正在進行 A/B/C/D 區與樓層型態交叉矩陣計算中...</div>
        <el-progress :percentage="calcProgress" :color="progressColors" :stroke-width="18" striped stripe-processing></el-progress>
      </div>

      <!-- 數據表格與圖表頁籤區 -->
      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs" v-model="activeTab">
          <!-- 頁籤 1：儲格數交叉統計表 -->
          <el-tab-pane label="📊 儲格數交叉統計表" name="grid">
            <el-table 
              :data="filteredGridData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!-- 規劃 -->
              <el-table-column label="規劃" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 已使用 -->
              <el-table-column label="已使用" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 未使用率 (%) -->
              <el-table-column label="未使用率 (%)" align="center" class-name="section-border-right">
                <el-table-column prop="unrate_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 剩餘 -->
              <el-table-column label="剩餘" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!--【儲位格數彙總】-->
              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="85" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="85" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid') }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘儲位數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getRemVolForGridTable(scope.row)) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 頁籤 2：才數交叉統計表 -->
          <el-tab-pane label="📦 才數交叉統計表" name="vol">
            <el-table 
              :data="filteredVolData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!-- 規劃總才數 -->
              <el-table-column label="規劃總才數" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 使用中才數 -->
              <el-table-column label="使用中才數" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!-- 剩餘才數 -->
              <el-table-column label="剩餘才數" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <!--【才數彙總】-->
              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="90" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="90" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true) }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="儲位健康度" width="95" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ getRowHealthVol(scope.row) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 頁籤 3：📋 儲位與才數綜合總覽表 -->
          <el-tab-pane label="📋 儲位與才數綜合總覽表" name="combined">
            <el-table 
              :data="combinedTableData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
              :span-method="combinedSpanMethod"
            >
              <el-table-column prop="displayFloor" label="樓層" width="100" align="center" fixed="left"></el-table-column>
              <el-table-column prop="displayType" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <!--【儲位格數彙總】-->
              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group section-border-right">
                <el-table-column label="規劃數" width="100" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_grid) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="100" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_grid" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘儲位數" width="100" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="105" align="right" class-name="section-border-right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <!--【才數彙總】-->
              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group-vol">
                <el-table-column label="規劃數" width="110" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_vol) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="110" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_vol" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘才數" width="110" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_health_vol" label="儲位健康度" width="100" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ scope.row.sum_health_vol || '0.0%' }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 🌟 頁籤 4：📈 空間與健康度歷史趨勢圖 🌟 -->
          <el-tab-pane label="📈 空間與健康度歷史趨勢圖" name="trend">
            <div v-if="historyList.length === 0" class="no-trend-box">
              ⚠️ 尚無歷史快照紀錄，上傳庫存 CSV 檔案後將自動產生趨勢分析！
            </div>
            <div v-else class="trend-container">
              <div class="trend-card">
                <div class="trend-title">📊 使用中儲位數 vs 剩餘空儲位數 歷史變遷</div>
                <div class="trend-bars">
                  <div v-for="item in sortedHistoryList" :key="item.record_date" class="bar-col">
                    <div class="bar-val-text">{{ formatNumber(item.used_grid) }}</div>
                    <div class="bar-track">
                      <div class="bar-fill used" :style="{ height: getGridHeightPercent(item.used_grid, item.plan_grid) }"></div>
                    </div>
                    <div class="bar-date-label">{{ item.record_date.substring(5) }}</div>
                  </div>
                </div>
              </div>

              <div class="trend-card">
                <div class="trend-title">🩺 儲位整體健康度 % 歷史走勢</div>
                <div class="health-list">
                  <div v-for="item in sortedHistoryList" :key="item.record_date" class="health-row">
                    <span class="h-date">{{ item.record_date }}</span>
                    <el-progress 
                      :percentage="Math.min(100, item.health_rate || 0)" 
                      :color="item.health_rate > 85 ? '#f43f5e' : (item.health_rate > 60 ? '#f59e0b' : '#38bdf8')" 
                      :stroke-width="14"
                      style="flex: 1; margin: 0 15px;"
                    />
                    <span class="h-val">{{ item.health_rate }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- 🗓️ 1. 歷史快照管理 Modal -->
    <el-dialog
      title="🗓️ 儲位 7 大 KPI 歷史快照管理清單"
      v-model="showHistoryManagerModal"
      width="850px"
      append-to-body
      class="custom-dark-dialog"
    >
      <div class="history-modal-body">
        <el-table :data="historyList" border stripe size="mini" class="dark-table" max-height="380px">
          <el-table-column prop="record_date" label="紀錄日期" width="110" align="center" fixed />
          <el-table-column prop="file_name" label="原始來源檔名" min-width="180" show-overflow-tooltip />
          <el-table-column label="已用 / 規劃儲格" width="130" align="right">
            <template #default="scope">
              {{ formatNumber(scope.row.used_grid) }} / {{ formatNumber(scope.row.plan_grid) }}
            </template>
          </el-table-column>
          <el-table-column label="已用才數" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.used_vol) }}</template>
          </el-table-column>
          <el-table-column prop="health_rate" label="健康度" width="85" align="right">
            <template #default="scope">
              <span class="text-cyan">{{ scope.row.health_rate }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="寫入時間" width="140" align="center" />
          <el-table-column label="操作" width="90" align="center" fixed="right">
            <template #default="scope">
              <el-button 
                type="danger" 
                size="mini" 
                icon="el-icon-delete"
                @click="deleteSnapshot(scope.row.record_date)"
              >
                刪除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showHistoryManagerModal = false">關閉</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- ⚙️ 2. 儲位定義 Modal -->
    <el-dialog
      title="⚙️ 儲位定義參數與權限設定"
      v-model="showConfigDialog"
      width="750px"
      append-to-body
      class="custom-dark-dialog"
    >
      <div class="config-modal-content">
        <div class="upload-top-bar">
          <div>
            <div class="section-title">📥 匯入最新 `locations_master.csv` 檔案</div>
            <p class="section-desc">
              將包含 <code>樓層, 區域, 儲位類型, 才數, 儲格數, 儲位才數</code> 的結構定義寫入地端 SQLite。
            </p>
          </div>
          <div class="upload-area">
            <input 
              type="file" 
              ref="locMasterFileInput" 
              accept=".csv" 
              style="display: none;" 
              @change="handleMasterCsvUpload" 
            />
            <el-button 
              type="success" 
              icon="el-icon-upload2" 
              size="small"
              :loading="isUploading"
              @click="$refs.locMasterFileInput.click()"
            >
              📁 選擇 CSV 檔案並匯入
            </el-button>
          </div>
        </div>

        <el-divider content-position="left">📋 當前地端 SQLite 儲位結構定義清單</el-divider>

        <el-table 
          :data="masterTableData" 
          border 
          stripe 
          size="mini" 
          height="220px" 
          v-loading="masterLoading"
          class="dark-table master-preview-table"
        >
          <el-table-column prop="樓層" label="樓層" width="80" align="center"></el-table-column>
          <el-table-column prop="區域" label="區域" width="80" align="center"></el-table-column>
          <el-table-column prop="儲位類型" label="儲位類型" min-width="130"></el-table-column>
          <el-table-column prop="才數" label="才數" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.才數) }}</template>
          </el-table-column>
          <el-table-column prop="儲格數" label="儲格數(板、層)" width="120" align="right">
            <template #default="scope">{{ formatNumber(scope.row.儲格數) }}</template>
          </el-table-column>
          <el-table-column prop="儲位才數" label="儲位才數" width="110" align="right">
            <template #default="scope">{{ scope.row.儲位才數 }}</template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">🔒 開放儲位統計匯出功能權限</el-divider>

        <div class="perm-config-card">
          <div class="perm-title-desc">
            <span class="perm-icon">🔒</span>
            <span>開放儲位統計概覽 匯出功能權限</span>
          </div>
          <p class="perm-sub-text">未勾選之項目，一般管理員與一般人員將無法看見該匯出按鈕</p>

          <div class="perm-checkbox-group">
            <el-checkbox v-model="exportPerms.xlsx" class="dark-checkbox">
              <span class="chk-label">📊 開放 <strong>匯出 xlsx</strong> 按鈕</span>
            </el-checkbox>
            <br />
            <el-checkbox v-model="exportPerms.pdf" class="dark-checkbox">
              <span class="chk-label">🖨️ 開放 <strong>匯出 PDF</strong> 按鈕 (暫不開放)</span>
            </el-checkbox>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showConfigDialog = false">取消關閉</el-button>
          <el-button size="small" type="primary" icon="el-icon-check" @click="saveExportPerms">💾 儲存權限設定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default {
  name: 'LocSummary',
  props: [
    'loading', 'calcProgress', 'progressColors', 'summaryStats', 
    'summaryGridData', 'summaryVolData', 'typeMergedData', 'areaGridTable', 'areaVolTable'
  ],
  data() {
    return {
      activeTab: 'grid',
      showConfigDialog: false,
      showHistoryManagerModal: false,
      isUploading: false,
      masterLoading: false,
      masterTableData: [],
      exportingXlsx: false,
      exportingPdf: false,

      // 🌟 歷史快照選擇與備份狀態 🌟
      selectedDate: 'realtime',
      historyList: [],
      snapshotStats: null,

      // 🌟 匯出功能權限控制
      exportPerms: {
        xlsx: true,
        pdf: false
      }
    }
  },
  computed: {
    // 🌟 按日期正序排列（供趨勢圖渲染） 🌟
    sortedHistoryList() {
      return [...this.historyList].reverse();
    },

    // 🌟 判斷當前指標卡片要顯示即時試算還是歷史快照 🌟
    activeStats() {
      if (this.selectedDate !== 'realtime' && this.snapshotStats) {
        return this.snapshotStats;
      }
      return this.summaryStats || {
        total_plan_grid: 0, total_used_grid: 0, total_rem_grid: 0,
        total_plan_vol: 0, total_used_vol: 0, total_rem_vol: 0,
        total_health: '0.0%'
      };
    },

    isAdmin() {
      try {
        const userStr = localStorage.getItem('user') || localStorage.getItem('loginUser');
        if (userStr) {
          const u = JSON.parse(userStr);
          return u.role === 'sys_admin' || u.role === 'admin' || u.username === 'admin';
        }
      } catch (e) {}
      return false;
    },
    filteredGridData() {
      if (!this.summaryGridData) return [];
      return this.summaryGridData.filter(r => !r.is_subtotal && !r.is_total);
    },
    filteredVolData() {
      if (!this.summaryVolData) return [];
      return this.summaryVolData.filter(r => !r.is_subtotal && !r.is_total);
    },
    combinedTableData() {
      if (!this.summaryGridData || this.summaryGridData.length === 0) return [];
      
      return this.summaryGridData.map((gridRow, idx) => {
        const volRow = (this.summaryVolData && this.summaryVolData[idx]) ? this.summaryVolData[idx] : {};

        const sumPlanG = Number(this.getSumVal(gridRow, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        const sumUsedG = Number(this.getSumVal(gridRow, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']));
        const sumRemG = Number(this.getSumVal(gridRow, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        const sumUnrateG = gridRow.sum_unrate_grid || this.getUnrateVal(gridRow, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid');

        let sumPlanV = Number(this.getSumVal(volRow, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        let sumUsedV = Number(this.getSumVal(volRow, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
        let sumRemV = Number(this.getSumVal(volRow, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));

        if (gridRow.is_subtotal && sumPlanV === 0) {
          const targetType = gridRow.loc_type;
          this.summaryVolData.forEach((vr) => {
            if (!vr.is_subtotal && !vr.is_total && vr.loc_type === targetType) {
              sumPlanV += Number(this.getSumVal(vr, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
              sumUsedV += Number(this.getSumVal(vr, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
              sumRemV += Number(this.getSumVal(vr, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
            }
          });
        } else if (gridRow.is_total && sumPlanV === 0) {
          this.summaryVolData.forEach(vr => {
            if (!vr.is_subtotal && !vr.is_total) {
              sumPlanV += Number(this.getSumVal(vr, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
              sumUsedV += Number(this.getSumVal(vr, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
              sumRemV += Number(this.getSumVal(vr, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
            }
          });
        }

        const sumUnrateV = sumPlanV > 0 ? ((sumRemV / sumPlanV) * 100).toFixed(1) + '%' : '0.0%';
        let sumHealthV = '0.0%';
        if (sumPlanV > 0 && (1 - sumRemV / sumPlanV) > 0) {
          sumHealthV = (((sumUsedV / (1 - sumRemV / sumPlanV)) / sumPlanV) * 100).toFixed(1) + '%';
        }

        let dispFloor = gridRow.floor || '';
        let dispType = gridRow.loc_type || '';

        if (gridRow.is_subtotal) {
          dispFloor = gridRow.loc_type ? `${gridRow.loc_type} 小計` : '小計';
          dispType = '';
        } else if (gridRow.is_total) {
          dispFloor = '全區總計';
          dispType = '';
        }

        return {
          ...gridRow,
          displayFloor: dispFloor,
          displayType: dispType,
          sum_plan_grid: sumPlanG,
          sum_used_grid: sumUsedG,
          sum_unrate_grid: sumUnrateG,
          sum_rem_grid: sumRemG,
          sum_plan_vol: parseFloat(sumPlanV.toFixed(1)),
          sum_used_vol: parseFloat(sumUsedV.toFixed(1)),
          sum_unrate_vol: sumUnrateV,
          sum_rem_vol: parseFloat(sumRemV.toFixed(1)),
          sum_health_vol: sumHealthV
        };
      });
    }
  },
  mounted() {
    this.loadExportPerms();
    this.fetchHistoryList();
    if (!this.summaryGridData || this.summaryGridData.length === 0) {
      this.$emit('refresh-summary');
    }
  },
  methods: {
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },

    getGridHeightPercent(used, plan) {
      if (!plan || plan <= 0) return '0%';
      const p = Math.min(100, Math.round((used / plan) * 100));
      return `${p}%`;
    },

    async fetchHistoryList() {
      try {
        const res = await axios.get('/api/location-stats/history');
        if (res.data && res.data.success) {
          this.historyList = res.data.data || [];
        }
      } catch (e) {
        console.error('抓取歷史快照失敗:', e.message);
      }
    },

    onDateChange(val) {
      if (val === 'realtime') {
        this.snapshotStats = null;
      } else {
        const target = this.historyList.find(item => item.record_date === val);
        if (target) {
          this.snapshotStats = {
            total_plan_grid: target.plan_grid,
            total_used_grid: target.used_grid,
            total_rem_grid: target.rem_grid,
            total_plan_vol: target.plan_vol,
            total_used_vol: target.used_vol,
            total_rem_vol: target.rem_vol,
            total_health: `${target.health_rate}%`
          };
        }
      }
    },

    async fetchRealtimeAndHistory() {
      this.$emit('refresh-summary');
      await this.fetchHistoryList();
    },

    async deleteSnapshot(recordDate) {
      try {
        await this.$confirm(`確定要刪除 ${recordDate} 的歷史快照紀錄嗎？`, '警告', {
          confirmButtonText: '確定刪除',
          cancelButtonText: '取消',
          type: 'warning'
        });

        const res = await axios.delete('/api/location-stats/delete', { data: { record_date: recordDate } });
        if (res.data?.success) {
          this.$message.success(res.data.message);
          if (this.selectedDate === recordDate) this.selectedDate = 'realtime';
          await this.fetchHistoryList();
        }
      } catch (e) {
        if (e !== 'cancel') this.$message.error('刪除失敗: ' + e.message);
      }
    },

    loadExportPerms() {
      const saved = localStorage.getItem('loc_summary_export_perms');
      if (saved) {
        try {
          this.exportPerms = JSON.parse(saved);
        } catch (e) {
          this.exportPerms = { xlsx: true, pdf: false };
        }
      } else {
        this.exportPerms = { xlsx: true, pdf: false };
      }
    },
    saveExportPerms() {
      localStorage.setItem('loc_summary_export_perms', JSON.stringify(this.exportPerms));
      this.$message.success('💾 匯出權限設定已成功儲存！');
      this.showConfigDialog = false;
    },
    combinedSpanMethod({ row, columnIndex }) {
      if (row.is_subtotal || row.is_total) {
        if (columnIndex === 0) return { rowspan: 1, colspan: 2 };
        else if (columnIndex === 1) return { rowspan: 0, colspan: 0 };
      }
      return { rowspan: 1, colspan: 1 };
    },
    getSumVal(row, primaryKey, subKeys) {
      if (!row) return 0;
      if (row[primaryKey] !== undefined && row[primaryKey] !== null && row[primaryKey] !== '') {
        return row[primaryKey];
      }
      const camelKey = primaryKey.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (row[camelKey] !== undefined && row[camelKey] !== null && row[camelKey] !== '') {
        return row[camelKey];
      }
      let sum = 0;
      if (Array.isArray(subKeys)) {
        subKeys.forEach(k => {
          const val = Number(String(row[k] || 0).replace(/,/g, ''));
          if (!isNaN(val)) sum += val;
        });
      }
      return sum;
    },
    getRemVolForGridTable(row) {
      if (!row) return 0;
      if (row.sum_rem_vol) return row.sum_rem_vol;
      if (row.sumRemVol) return row.sumRemVol;
      
      const idx = this.summaryGridData.indexOf(row);
      if (idx >= 0 && this.summaryVolData && this.summaryVolData[idx]) {
        return this.getSumVal(this.summaryVolData[idx], 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']);
      }
      return 0;
    },
    getRowHealthVol(row) {
      if (!row) return '0.0%';
      if (row.sum_health_vol && row.sum_health_vol !== '0.0%') return row.sum_health_vol;
      if (row.sumHealthVol && row.sumHealthVol !== '0.0%') return row.sumHealthVol;

      const plan = Number(this.getSumVal(row, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const used = Number(this.getSumVal(row, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
      const rem = Number(this.getSumVal(row, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));

      if (plan <= 0) return '0.0%';
      const unrate = rem / plan;
      const denom = 1 - unrate;
      if (denom <= 0) return '0.0%';

      const adjustedUsed = used / denom;
      return ((adjustedUsed / plan) * 100).toFixed(1) + '%';
    },
    getUnrateVal(row, unrateKey, planKey, usedKey, isVol = false) {
      if (!row) return '0.0%';
      if (row[unrateKey]) return row[unrateKey];
      const plan = Number(this.getSumVal(row, planKey, isVol ? ['plan_A區','plan_B區','plan_C區','plan_D區'] : ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const used = Number(this.getSumVal(row, usedKey, isVol ? ['used_A區','used_B區','used_C區','used_D區'] : ['used_A區','used_B區','used_C區','used_D區']));
      if (plan <= 0) return '0.0%';
      const rem = Math.max(0, plan - used);
      return ((rem / plan) * 100).toFixed(1) + '%';
    },
    tableRowClassName({ row }) {
      if (row.is_total) return 'total-row';
      if (row.is_subtotal) return 'subtotal-row';
      return '';
    },
    openConfigModal() {
      this.loadExportPerms();
      this.showConfigDialog = true;
      this.fetchLocationsMaster();
    },
    async fetchLocationsMaster() {
      this.masterLoading = true;
      try {
        const res = await axios.get('/api/get-locations-master');
        if (res.data?.success) {
          this.masterTableData = res.data.data || [];
        }
      } catch (err) {
        this.$message.error('讀取儲位結構清單失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.masterLoading = false;
      }
    },
    async handleMasterCsvUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.isUploading = true;
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post('/api/import-locations-master', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          this.$message.success(`🎉 成功匯入 ${res.data.count.toLocaleString()} 筆儲位定義結構！`);
          await this.fetchLocationsMaster();
          this.$emit('refresh-summary');
        } else {
          this.$message.error('匯入失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (err) {
        this.$message.error('連線或寫入失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.isUploading = false;
        event.target.value = '';
      }
    },

    // 匯出 XLSX
    async exportFullXlsx() {
      if (!this.exportPerms.xlsx) {
        return this.$message.warning('權限受限：管理者尚未開放匯出 xlsx 功能');
      }
      this.exportingXlsx = true;
      try {
        const wb = XLSX.utils.book_new();

        const gridAOA = [
          ['樓層', '儲位類型', '規劃', '', '', '', '已使用', '', '', '', '未使用率 (%)', '', '', '', '剩餘', '', '', '', '【儲位格數彙總】', '', '', '', ''],
          ['', '', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '未使用率(%)', '剩餘儲位數', '剩餘才數']
        ];
        this.filteredGridData.forEach(r => {
          gridAOA.push([
            r.floor || '', r.loc_type || '',
            r.plan_A區 || 0, r.plan_B區 || 0, r.plan_C區 || 0, r.plan_D區 || 0,
            r.used_A區 || 0, r.used_B區 || 0, r.used_C區 || 0, r.used_D區 || 0,
            r.unrate_A區 || '', r.unrate_B區 || '', r.unrate_C區 || '', r.unrate_D區 || '',
            r.rem_A區 || 0, r.rem_B區 || 0, r.rem_C區 || 0, r.rem_D區 || 0,
            this.getSumVal(r, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']),
            this.getSumVal(r, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']),
            this.getUnrateVal(r, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid'),
            this.getSumVal(r, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']),
            this.getRemVolForGridTable(r)
          ]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(gridAOA);
        ws1['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } }, { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
          { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } }, { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
          { s: { r: 0, c: 18 }, e: { r: 0, c: 22 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, "儲格數交叉統計表");

        const volAOA = [
          ['樓層', '儲位類型', '規劃總才數', '', '', '', '使用中才數', '', '', '', '剩餘才數', '', '', '', '【才數彙總】', '', '', '', ''],
          ['', '', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '未使用率(%)', '剩餘才數', '儲位健康度']
        ];
        this.filteredVolData.forEach(r => {
          volAOA.push([
            r.floor || '', r.loc_type || '',
            r.plan_A區 || 0, r.plan_B區 || 0, r.plan_C區 || 0, r.plan_D區 || 0,
            r.used_A區 || 0, r.used_B區 || 0, r.used_C區 || 0, r.used_D區 || 0,
            r.rem_A區 || 0, r.rem_B區 || 0, r.rem_C區 || 0, r.rem_D區 || 0,
            this.getSumVal(r, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']),
            this.getSumVal(r, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']),
            this.getUnrateVal(r, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true),
            this.getSumVal(r, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']),
            this.getRowHealthVol(r)
          ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(volAOA);
        ws2['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } }, { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
          { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } }, { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
          { s: { r: 0, c: 18 }, e: { r: 0, c: 22 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws2, "才數交叉統計表");

        const combAOA = [
          ['樓層', '儲位類型', '【儲位格數彙總】', '', '', '', '', '【才數彙總】', '', '', '', ''],
          ['', '', '規劃數', '已使用', '未使用率(%)', '剩餘儲位數', '剩餘才數', '規劃數', '已使用', '未使用率(%)', '剩餘才數', '儲位健康度']
        ];
        this.combinedTableData.forEach(r => {
          combAOA.push([
            r.displayFloor || r.floor || '',
            r.displayType || r.loc_type || '',
            r.sum_plan_grid, r.sum_used_grid, r.sum_unrate_grid, r.sum_rem_grid, r.sum_rem_vol,
            r.sum_plan_vol, r.sum_used_vol, r.sum_unrate_vol, r.sum_rem_vol, r.sum_health_vol
          ]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(combAOA);
        ws3['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } }, { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws3, "儲位與才數綜合總覽表");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `儲位管理系統_跨區交叉矩陣統計總表_${dateStr}.xlsx`);
        this.$message.success('🎉 成功匯出 Excel 檔案！');
      } catch (err) {
        this.$message.error('匯出 XLSX 失敗：' + err.message);
      } finally {
        this.exportingXlsx = false;
      }
    },

    // 匯出 PDF
    async exportFullPdf() {
      if (!this.exportPerms.pdf) {
        return this.$message.warning('權限受限：管理者尚未開放匯出 PDF 功能');
      }
      this.exportingPdf = true;
      this.$message.info('⚡ 正在生成純向量 PDF 3 頁報表中...');

      try {
        const doc = new jsPDF('landscape', 'pt', 'a4');

        try {
          const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf';
          const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
          const fontBase64 = btoa(
            new Uint8Array(fontBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          doc.addFileToVFS('NotoSansTC.otf', fontBase64);
          doc.addFont('NotoSansTC.otf', 'NotoSansTC', 'normal');
          doc.setFont('NotoSansTC');
        } catch (fontErr) {
          console.warn('⚠️️ 中文字型載入失敗，採用系統預設', fontErr);
        }

        doc.setFontSize(13);
        doc.setTextColor(56, 189, 248);
        doc.text('儲位管理系統 - 儲格數交叉統計表', 20, 25);

        const gridHead = [
          ['樓層', '儲位類型', '規劃 A區', 'B區', 'C區', 'D區', '已使用 A區', 'B區', 'C區', 'D區', '剩餘 A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '剩餘儲位', '剩餘才數']
        ];
        const gridBody = this.filteredGridData.map(r => [
          r.floor || '', r.loc_type || '',
          r.plan_A區 || '', r.plan_B區 || '', r.plan_C區 || '', r.plan_D區 || '',
          r.used_A區 || '', r.used_B區 || '', r.used_C區 || '', r.used_D區 || '',
          r.rem_A區 || '', r.rem_B區 || '', r.rem_C區 || '', r.rem_D區 || '',
          this.getSumVal(r, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']),
          this.getSumVal(r, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']),
          this.getSumVal(r, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']),
          this.getRemVolForGridTable(r)
        ]);

        autoTable(doc, {
          head: gridHead,
          body: gridBody,
          startY: 35,
          styles: { font: 'NotoSansTC', fontSize: 7, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [15, 23, 42], textColor: [56, 189, 248] },
          theme: 'grid'
        });

        doc.addPage();
        doc.setFontSize(13);
        doc.setTextColor(56, 189, 248);
        doc.text('儲位管理系統 - 才數交叉統計表', 20, 25);

        const volHead = [
          ['樓層', '儲位類型', '規劃才數 A區', 'B區', 'C區', 'D區', '使用才數 A區', 'B區', 'C區', 'D區', '剩餘才數 A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '剩餘才數', '健康度']
        ];
        const volBody = this.filteredVolData.map(r => [
          r.floor || '', r.loc_type || '',
          r.plan_A區 || '', r.plan_B區 || '', r.plan_C區 || '', r.plan_D區 || '',
          r.used_A區 || '', r.used_B區 || '', r.used_C區 || '', r.used_D區 || '',
          r.rem_A區 || '', r.rem_B區 || '', r.rem_C區 || '', r.rem_D區 || '',
          this.getSumVal(r, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']),
          this.getSumVal(r, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']),
          this.getSumVal(r, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']),
          this.getRowHealthVol(r)
        ]);

        autoTable(doc, {
          head: volHead,
          body: volBody,
          startY: 35,
          styles: { font: 'NotoSansTC', fontSize: 7, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [15, 23, 42], textColor: [56, 189, 248] },
          theme: 'grid'
        });

        doc.addPage();
        doc.setFontSize(13);
        doc.setTextColor(56, 189, 248);
        doc.text('儲位管理系統 - 儲位與才數綜合總覽表', 20, 25);

        const combHead = [
          ['樓層', '儲位類型', '格數-規劃數', '格數-已使用', '格數-未使用率', '剩餘儲位數', '剩餘才數', '才數-規劃數', '才數-已使用', '才數-未使用率', '才數-剩餘才數', '儲位健康度']
        ];
        const combBody = this.combinedTableData.map(r => [
          r.displayFloor || r.floor || '', r.displayType || r.loc_type || '',
          r.sum_plan_grid, r.sum_used_grid, r.sum_unrate_grid, r.sum_rem_grid, r.sum_rem_vol,
          r.sum_plan_vol, r.sum_used_vol, r.sum_unrate_vol, r.sum_rem_vol, r.sum_health_vol
        ]);

        autoTable(doc, {
          head: combHead,
          body: combBody,
          startY: 35,
          styles: { font: 'NotoSansTC', fontSize: 8, cellPadding: 4, halign: 'center' },
          headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255] },
          theme: 'grid'
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`儲位管理系統_跨區交叉矩陣報表_${dateStr}.pdf`);
        this.$message.success('🎉 成功匯出 3 頁純向量中文 PDF 報表！');
      } catch (err) {
        this.$message.error('匯出 PDF 失敗：' + err.message);
      } finally {
        this.exportingPdf = false;
      }
    }
  }
}
</script>

<style scoped>
.loc-summary-page {
  padding: 12px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.summary-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-bar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.left-title-group {
  display: flex;
  align-items: center;
}

.page-title-text {
  font-size: 15px;
  font-weight: bold;
  color: #38bdf8;
}

.history-tag {
  margin-left: 10px;
  background-color: #f59e0b;
  color: #000;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.export-top-btn {
  font-weight: bold;
  border-radius: 4px;
}

.btn-xlsx {
  background-color: #65a30d !important;
  border-color: #4d7c0f !important;
  color: #ffffff !important;
}

.btn-pdf {
  background-color: #f43f5e !important;
  border-color: #e11d48 !important;
  color: #ffffff !important;
}

.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.stat-lbl { font-size: 12px; color: #94a3b8; }
.stat-val { font-size: 18px; font-weight: bold; margin-top: 2px; }

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.text-cyan { color: #22d3ee; }

.stat-card.highlight-health {
  background: rgba(34, 211, 238, 0.1);
  border-color: #0891b2;
}

.progress-box {
  background: #1e293b;
  padding: 25px;
  border-radius: 10px;
  border: 1px solid #334155;
  margin-top: 20px;
}

.progress-lbl {
  color: #38bdf8;
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 14px;
}

.tables-main-wrapper {
  margin-top: 5px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.dark-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e293b !important;
  border-color: #334155 !important;
}

:deep(.dark-tabs .el-tabs__content) {
  flex: 1;
  padding: 8px;
  height: calc(100% - 40px);
  min-height: 0;
}

:deep(.dark-tabs .el-tab-pane) {
  height: 100%;
}

:deep(.pivot-table tr.subtotal-row td) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  font-weight: bold;
  border-top: 2px solid #38bdf8 !important;
}

:deep(.pivot-table tr.total-row td) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  border-top: 3px solid #38bdf8 !important;
}

:deep(.pivot-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  text-align: center;
  border-right: 1px solid #334155 !important;
  border-bottom: 1px solid #334155 !important;
}

/* 五大區塊藍色粗框分隔線 */
:deep(.pivot-table .section-border-right) {
  border-right: 3px solid #38bdf8 !important;
}

/* 儲位格數總覽頭部醒目藍色 */
:deep(.pivot-table th.summary-header-group) {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
}

/* 才數總覽頭部醒目紫深藍色 */
:deep(.pivot-table th.summary-header-group-vol) {
  background-color: #4338ca !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
}

/* 📈 趨勢圖專屬樣式 */
.no-trend-box {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.trend-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
  overflow-y: auto;
}

.trend-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 15px;
}

.trend-title {
  font-size: 14px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 15px;
}

.trend-bars {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  height: 160px;
  padding-bottom: 10px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 45px;
}

.bar-val-text {
  font-size: 10px;
  color: #38bdf8;
  margin-bottom: 4px;
}

.bar-track {
  flex: 1;
  width: 16px;
  background: #1e293b;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill.used {
  width: 100%;
  background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
  border-radius: 8px;
}

.bar-date-label {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
}

.health-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.health-row {
  display: flex;
  align-items: center;
}

.h-date {
  width: 90px;
  font-size: 12px;
  color: #e2e8f0;
}

.h-val {
  width: 60px;
  font-size: 13px;
  font-weight: bold;
  color: #22d3ee;
  text-align: right;
}

.history-modal-body {
  padding: 5px 0;
}

.config-modal-content { color: #f8fafc; }
.upload-top-bar { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 4px; }
.section-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; }
.section-desc code { background: #0f172a; color: #f43f5e; padding: 2px 6px; border-radius: 4px; }
.master-preview-table { margin-top: 10px; }

.perm-config-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px 16px;
  margin-top: 10px;
}

.perm-title-desc {
  font-size: 14px;
  font-weight: bold;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 6px;
}

.perm-icon { font-size: 16px; }
.perm-sub-text { font-size: 12px; color: #94a3b8; margin: 4px 0 12px 0; }
.perm-checkbox-group { display: flex; flex-direction: column; gap: 8px; }

:deep(.dark-checkbox .el-checkbox__label) { color: #e2e8f0 !important; font-size: 13px; }
:deep(.dark-checkbox .el-checkbox__inner) { background-color: #1e293b; border-color: #475569; }
:deep(.dark-checkbox.is-checked .el-checkbox__inner) { background-color: #38bdf8; border-color: #38bdf8; }

@media (max-width: 1400px) {
  .stats-overview-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>