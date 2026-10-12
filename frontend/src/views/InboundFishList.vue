<template>
  <div class="inbound-fish-page dark-bg">
    <!-- 隱藏的 CSV 檔案選擇器 -->
    <input
      type="file"
      ref="csvFileInput"
      style="display: none;"
      accept=".csv"
      @change="handleCsvFileSelected"
    />

    <!-- 1. 頂部操作與篩選列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 倉庫 進貨驗收與新品上架分析</span>
        
        <el-date-picker
          v-model="targetDate"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="選擇日期"
          style="width: 140px;"
          @change="fetchFishData"
        />

        <el-radio-group v-model="warehouse" size="small" @change="fetchFishData">
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
          type="success"
          size="small"
          icon="el-icon-upload2"
          :loading="isUploading"
          @click="triggerSelectCsv"
        >
          📥 匯入進貨明細 CSV
        </el-button>
      </div>
    </div>

    <!-- 2. 控制卡片 -->
    <div class="filter-card">
      <div class="filter-item">
        <span class="filter-label">🏷️ 收貨備註魚群條件：</span>
        <el-checkbox-group v-model="selectedRemarks" size="small" @change="fetchFishData">
          <el-checkbox label="empty">⚪ 空白 (正常件)</el-checkbox>
          <el-checkbox label="15">📦 (原15庫)</el-checkbox>
          <el-checkbox label="abnormal">⚠️ 異常件 (其他文字說明)</el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="filter-item view-switcher">
        <span class="filter-label">📌 統計檢視維度：</span>
        <el-radio-group v-model="activeViewTab" size="small">
          <el-radio-button label="po">📋 依進貨單號分析</el-radio-button>
          <el-radio-button label="batch">🏷️ 依驗收批號分析</el-radio-button>
          <el-radio-button label="both">📊 雙檢視對照 (完整)</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 3. 表格區塊 -->
    <div class="table-container" v-loading="loading">
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
                <th colspan="4" class="group-blue-header">進貨單號驗收統計</th>
                <th colspan="4" class="group-green-header">新品單號上架統計</th>
              </template>
              <th v-if="activeViewTab === 'both'" class="col-sep"></th>
              <template v-if="activeViewTab === 'batch' || activeViewTab === 'both'">
                <th colspan="4" class="group-blue-header">驗收批號驗收統計</th>
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

    <!-- 4. CSV 上傳進度條 Modal -->
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

    <!-- 🌟 5. 高對比顯色未上架彈窗 -->
    <el-dialog v-model="showPendingDialog" title="⚠️ 尚未上架明細監控與更正處置" width="1020px" append-to-body custom-class="dark-dialog">
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
            <el-button
              type="danger"
              size="small"
              :disabled="selectedDetailRows.length === 0"
              @click="openResolveDialog(selectedDetailRows)"
            >
              ☑️ 批次銷案/更正 (已選 {{ selectedDetailRows.length }} 筆)
            </el-button>
          </div>

          <el-table
            :data="currentDetailsList"
            border
            stripe
            size="small"
            height="380px"
            class="dark-table"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="rec_time" label="驗收時間" width="85" align="center" />
            <el-table-column prop="po_no" label="進貨單號" width="140" align="center" />
            <el-table-column prop="batch_no" label="驗收批號" width="140" align="center" />
            <el-table-column prop="item_name" label="商品名稱" min-width="180" show-overflow-tooltip />
            <el-table-column prop="qty" label="數量" width="65" align="right">
              <template #default="scope">
                <span class="font-bold text-blue">{{ scope.row.qty }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="收貨備註" width="120" show-overflow-tooltip />
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

    <!-- 6. 更正銷案 Modal -->
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
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

export default {
  name: 'InboundFishList',
  props: {
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      targetDate: new Date().toISOString().split('T')[0],
      warehouse: 'all',
      selectedRemarks: ['empty', '15', 'abnormal'],
      activeViewTab: 'po',
      hourlyStats: [],
      showPendingDialog: false,
      pendingSummary: [],
      totalPendingCount: 0,

      selectedPendingDate: '',
      currentDetailsList: [],
      selectedDetailRows: [],
      loadingDetails: false,
      showResolveModal: false,
      targetResolveItems: [],
      resolveReason: '同仁多驗/誤驗收 (無法上架)',
      customPutDate: '',
      resolving: false,

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
        recPoCount: 0, recPoPcs: 0,
        putPoCount: 0, putPoPcs: 0,
        recBatCount: 0, recBatPcs: 0,
        putBatCount: 0, putBatPcs: 0
      };
      this.hourlyStats.forEach(h => {
        tot.recPoCount += h.recPoCount || 0;
        tot.recPoPcs += h.recPoPcs || 0;
        tot.putPoCount += h.putPoCount || 0;
        tot.putPoPcs += h.putPoPcs || 0;
        tot.recBatCount += h.recBatCount || 0;
        tot.recBatPcs += h.recBatPcs || 0;
        tot.putBatCount += h.putBatCount || 0;
        tot.putBatPcs += h.putBatPcs || 0;
      });
      return tot;
    }
  },
  mounted() {
    this.fetchFishData();
    this.fetchPendingSummary();
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

    async refreshAllData() {
      await Promise.all([this.fetchFishData(), this.fetchPendingSummary()]);
      ElMessage.success('🎉 資料已成功重新整理！');
    },

    triggerSelectCsv() {
      if (this['$refs'] && this['$refs'].csvFileInput) {
        this['\$refs'].csvFileInput.click();
      }
    },

    async handleCsvFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        ElMessage.error('請選擇 .csv 格式的進貨明細檔案！');
        event.target.value = '';
        return;
      }

      this.isUploading = true;
      this.showUploadProgressModal = true;
      this.uploadingFileName = file.name;
      this.uploadPercent = 0;
      this.uploadedRows = 0;
      this.totalRowsToUpload = 0;

      try {
        const Papa = (await import('papaparse')).default;

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rawData = results.data || [];
            if (rawData.length === 0) {
              this.resetUploadState(event);
              return ElMessage.error('CSV 檔案內無有效資料！');
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
            await Promise.all([this.fetchFishData(), this.fetchPendingSummary()]);
            this.resetUploadState(event);
          },
          error: (err) => {
            ElMessage.error('解析 CSV 失敗：' + err.message);
            this.resetUploadState(event);
          }
        });
      } catch (e) {
        ElMessage.error('上傳處理失敗：' + e.message);
        this.resetUploadState(event);
      }
    },

    resetUploadState(event) {
      this.isUploading = false;
      this.showUploadProgressModal = false;
      if (event && event.target) event.target.value = '';
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
          this.fetchFishData();
        }
      } catch (e) {
        ElMessage.error('銷案失敗：' + e.message);
      } finally {
        this.resolving = false;
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

.title-group, .action-group {
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
  padding: 4px 4px;
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

/* 🌟 強制彈窗背景與文字對比高顯度 */
:deep(.el-dialog.dark-dialog) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border: 1px solid #334155 !important;
  border-radius: 8px !important;
}

:deep(.dark-dialog .el-dialog__header) {
  background-color: #0f172a !important;
  border-bottom: 1px solid #334155 !important;
  padding: 12px 20px !important;
}

:deep(.dark-dialog .el-dialog__title) {
  color: #38bdf8 !important;
  font-weight: bold;
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
  padding: 12px;
  border-radius: 6px;
}

.pending-summary-sidebar {
  width: 240px;
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
  max-height: 380px;
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

.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.font-bold { font-weight: bold; }
</style>