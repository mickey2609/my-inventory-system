<template>
  <div class="inbound-fish-page dark-bg">
    <!-- 1. 頂部操作與篩選列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 倉庫 進貨驗收與新品上架分析</span>
        
        <!-- 分析日期選擇 -->
        <el-date-picker
          v-model="targetDate"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="選擇日期"
          style="width: 140px;"
          @change="fetchFishData"
        />

        <!-- 倉庫切換 -->
        <el-radio-group v-model="warehouse" size="small" @change="fetchFishData">
          <el-radio-button label="all">🌐 雙庫合計</el-radio-button>
          <el-radio-button label="80">📦 80 庫 (人工)</el-radio-button>
          <el-radio-button label="15">🔍 15 庫 (自動)</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <!-- 開啟未上架監控 Modal -->
        <el-button type="warning" size="small" icon="el-icon-warning" @click="openPendingDialog">
          未上架追蹤 ({{ totalPendingCount }} 筆)
        </el-button>

        <!-- 🌟 系統管理員專屬上傳按鈕 (多重容錯相容判定) -->
        <el-upload
          v-if="checkSysAdmin"
          action="/api/inbound/upload"
          :show-file-list="false"
          :on-success="handleUploadSuccess"
          :before-upload="beforeUpload"
        >
          <el-button type="success" size="small" icon="el-icon-upload2">📥 匯入進貨明細 CSV</el-button>
        </el-upload>
      </div>
    </div>

    <!-- 2. 收貨備註魚群動態勾選 -->
    <div class="filter-card">
      <span class="filter-label">🏷️ 收貨備註魚群條件：</span>
      <el-checkbox-group v-model="selectedRemarks" size="small" @change="fetchFishData">
        <el-checkbox label="empty">⚪ 空白 (正常件)</el-checkbox>
        <el-checkbox label="15">📦 (原15庫)</el-checkbox>
        <el-checkbox label="abnormal">⚠️ 異常件 (其他文字說明)</el-checkbox>
      </el-checkbox-group>
    </div>

    <!-- 3. VBA 1:1 對照對齊格式表 -->
    <div class="table-container" v-loading="loading">
      <div class="sheet-title">
        倉庫 進貨驗收與新品上架分析 - {{ formatDateTitle(targetDate) }} ({{ getWarehouseLabel(warehouse) }})
      </div>

      <div class="table-scroll-wrapper">
        <table class="vba-style-table">
          <thead>
            <!-- 第一層大標題 -->
            <tr class="header-main">
              <th class="col-time" rowspan="2">時間<br>時段</th>
              <th colspan="4" class="group-blue-header">進貨單號驗收統計</th>
              <th colspan="4" class="group-green-header">新品單號上架統計</th>
              <th class="col-sep"></th>
              <th colspan="4" class="group-blue-header">驗收批號驗收統計</th>
              <th class="col-ratio-header">比例</th>
              <th colspan="4" class="group-green-header">驗收批號上架統計</th>
              <th class="col-ratio-header">比例</th>
            </tr>
            <!-- 第二層細項標題 -->
            <tr class="header-sub">
              <!-- 單號驗收 -->
              <th>單號圖形</th>
              <th>單號占比</th>
              <th>單號筆數</th>
              <th>驗收PCS</th>
              <!-- 單號上架 -->
              <th>上架圖形</th>
              <th>上架占比</th>
              <th>上架筆數</th>
              <th>上架PCS</th>
              
              <th class="col-sep"></th>
              
              <!-- 批號驗收 -->
              <th>批號圖形</th>
              <th>批號占比</th>
              <th>批號筆數</th>
              <th>批號PCS</th>
              <th>驗收單/批比</th>
              <!-- 批號上架 -->
              <th>批上圖形</th>
              <th>批上占比</th>
              <th>批號筆數</th>
              <th>批號PCS</th>
              <th>上架單/批比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(h, idx) in hourlyStats" :key="idx" :class="{ 'row-zebra': idx % 2 === 1 }">
              <!-- 時段 -->
              <td class="col-time font-bold">{{ h.hourStr }}</td>

              <!-- 1. 單號驗收 -->
              <td class="col-bar"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.recPoPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.recPoPct) }}</td>
              <td class="text-right">{{ formatNumber(h.recPoCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(h.recPoPcs) }}</td>

              <!-- 2. 單號上架 -->
              <td class="col-bar"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.putPoPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.putPoPct) }}</td>
              <td class="text-right">{{ formatNumber(h.putPoCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(h.putPoPcs) }}</td>

              <td class="col-sep"></td>

              <!-- 3. 批號驗收 -->
              <td class="col-bar"><div class="bar-fill blue-bar" :style="{ width: getBarWidth(h.recBatPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.recBatPct) }}</td>
              <td class="text-right">{{ formatNumber(h.recBatCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(h.recBatPcs) }}</td>
              <td class="text-right font-bold">{{ formatRatio(h.recBatCount, h.recPoCount) }}</td>

              <!-- 4. 批號上架 -->
              <td class="col-bar"><div class="bar-fill green-bar" :style="{ width: getBarWidth(h.putBatPct) }"></div></td>
              <td class="text-right">{{ formatPercent(h.putBatPct) }}</td>
              <td class="text-right">{{ formatNumber(h.putBatCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(h.putBatPcs) }}</td>
              <td class="text-right font-bold">{{ formatRatio(h.putBatCount, h.putPoCount) }}</td>
            </tr>
          </tbody>
          <!-- 總計列 -->
          <tfoot>
            <tr class="row-summary">
              <td class="col-time font-bold">總計</td>
              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.recPoCount) }}</td>
              <td class="text-right font-bold text-blue">{{ formatNumber(summaryTotal.recPoPcs) }}</td>

              <td></td>
              <td class="text-right font-bold">100.00%</td>
              <td class="text-right font-bold">{{ formatNumber(summaryTotal.putPoCount) }}</td>
              <td class="text-right font-bold text-green">{{ formatNumber(summaryTotal.putPoPcs) }}</td>

              <td class="col-sep"></td>

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
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- 4. 未上架日期監控 Modal -->
    <el-dialog v-model="showPendingDialog" title="⚠️ 尚未上架明細監控表 (抓驗收日期)" width="520px" append-to-body custom-class="dark-dialog">
      <el-table :data="pendingSummary" border stripe size="small" class="dark-table">
        <el-table-column prop="rec_date" label="驗收日期" align="center" sortable />
        <el-table-column prop="pending_count" label="未上架筆數" align="right" sortable>
          <template #default="scope">
            <span class="text-orange font-bold">{{ scope.row.pending_count }} 筆</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_qty" label="未上架總 PCS" align="right">
          <template #default="scope">{{ formatNumber(scope.row.total_qty) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

export default {
  name: 'InboundFishList',
  props: {
    // 接收系統管理員權限識別
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      targetDate: new Date().toISOString().split('T')[0],
      warehouse: 'all',
      selectedRemarks: ['empty', '15', 'abnormal'],
      hourlyStats: [],
      showPendingDialog: false,
      pendingSummary: [],
      totalPendingCount: 0
    }
  },
  computed: {
    // 🌟 多重容錯相容性權限判定
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
        }
      } catch (e) {
        console.error('抓取未上架統計失敗:', e.message);
      }
    },
    openPendingDialog() {
      this.fetchPendingSummary();
      this.showPendingDialog = true;
    },
    beforeUpload(file) {
      const isCSV = file.name.endsWith('.csv');
      if (!isCSV) ElMessage.error('請選擇 .csv 格式的進貨明細檔案！');
      return isCSV;
    },
    handleUploadSuccess(res) {
      if (res?.success) {
        ElMessage.success(res.message);
        this.fetchFishData();
        this.fetchPendingSummary();
      } else {
        ElMessage.error('匯入失敗：' + (res?.message || '未知錯誤'));
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
  overflow: hidden;
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
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid #334155;
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
}

.table-container {
  flex: 1;
  min-height: 0;
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

.table-scroll-wrapper {
  flex: 1;
  overflow: auto;
}

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
  padding: 4px 8px;
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

.col-time {
  width: 70px;
  text-align: center;
  background: #1e293b;
}

.col-sep {
  width: 6px;
  background: #334155;
  padding: 0 !important;
}

.col-bar {
  width: 60px;
  padding: 2px 4px !important;
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

.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.font-bold { font-weight: bold; }
</style>