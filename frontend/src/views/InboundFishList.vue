<template>
  <div class="inbound-fish-page dark-bg">
    <!-- 1. 頂部操作與篩選面板 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">🐟 進貨與新品上架魚群分析</span>
        
        <!-- 驗收/上架日期選擇 -->
        <el-date-picker
          v-model="targetDate"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="選擇分析日期"
          @change="fetchFishData"
        />

        <!-- 庫別切換 -->
        <el-radio-group v-model="warehouse" size="small" @change="fetchFishData">
          <el-radio-button label="all">🌐 全庫別</el-radio-button>
          <el-radio-button label="80">📦 80庫 (人工)</el-radio-button>
          <el-radio-button label="15">🔍 15庫 (自動)</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <!-- 開啟未上架監控 Modal -->
        <el-button type="warning" size="small" icon="el-icon-warning" @click="openPendingDialog">
          未上架追蹤 ({{ totalPendingCount }} 筆)
        </el-button>

        <!-- 匯入進貨 CSV 資料 -->
        <el-upload
          action="/api/inbound/upload"
          :show-file-list="false"
          :on-success="handleUploadSuccess"
          :before-upload="beforeUpload"
        >
          <el-button type="success" size="small" icon="el-icon-upload2">📥 匯入進貨明細 CSV</el-button>
        </el-upload>
      </div>
    </div>

    <!-- 2. 收貨備註魚群勾選條件 -->
    <div class="filter-card">
      <span class="filter-label">🏷️ 收貨備註魚群條件：</span>
      <el-checkbox-group v-model="selectedRemarks" size="small" @change="fetchFishData">
        <el-checkbox label="empty">⚪ 空白 (正常件)</el-checkbox>
        <el-checkbox label="15">📦 (原15庫)</el-checkbox>
        <el-checkbox label="abnormal">⚠️ 異常件 (其他文字說明)</el-checkbox>
      </el-checkbox-group>
    </div>

    <!-- 3. 24 小時時段魚群分析數據表格 -->
    <div class="data-card" v-loading="loading">
      <el-table :data="hourlyStats" border stripe size="mini" class="dark-table" height="calc(100vh - 280px)">
        <el-table-column prop="hourStr" label="時段" width="130" align="center" fixed="left" />
        
        <!-- 驗收魚群 -->
        <el-table-column label="進貨單號驗收魚群" align="center">
          <el-table-column prop="recPoCount" label="驗收筆數" width="100" align="right" />
          <el-table-column prop="recPoPcs" label="驗收 PCS" width="110" align="right">
            <template #default="scope">
              <span class="text-blue font-bold">{{ formatNumber(scope.row.recPoPcs) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        <!-- 上架魚群 -->
        <el-table-column label="新品單號上架魚群" align="center">
          <el-table-column prop="putPoCount" label="上架筆數" width="100" align="right" />
          <el-table-column prop="putPoPcs" label="上架 PCS" width="110" align="right">
            <template #default="scope">
              <span class="text-green font-bold">{{ formatNumber(scope.row.putPoPcs) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        <!-- 批號驗收/上架比 -->
        <el-table-column label="批號驗收與上架比" align="center">
          <el-table-column prop="recBatCount" label="驗收批數" width="100" align="right" />
          <el-table-column prop="putBatCount" label="上架批數" width="100" align="right" />
        </el-table-column>
      </el-table>
    </div>

    <!-- 4. 🚨 未上架日期監控對話盒 (Modal) -->
    <el-dialog v-model="showPendingDialog" title="⚠️ 尚未上架明細監控表 (抓驗收日期)" width="520px" append-to-body>
      <el-table :data="pendingSummary" border stripe size="small">
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
  mounted() {
    this.fetchFishData();
    this.fetchPendingSummary();
  },
  methods: {
    formatNumber(val) {
      if (!val) return '0';
      return Number(val).toLocaleString();
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
          this.hourlyStats = res.data.hourlyStats || [];
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
  gap: 12px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 10px 16px;
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
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
}

.data-card {
  flex: 1;
  min-height: 0;
}

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.font-bold { font-weight: bold; }
</style>