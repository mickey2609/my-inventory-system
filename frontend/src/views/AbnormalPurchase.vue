<template>
  <div class="abnormal-purchase-page dark-bg">
    <!-- 1. 頂部工具列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">⚠️ 倉庫 不合理進貨追蹤與分析</span>
        
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          size="small"
          range-separator="至"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px;"
          @change="fetchAbnormalData"
        />

        <el-radio-group v-model="warehouse" size="small" @change="fetchAbnormalData">
          <el-radio-button label="all">🌐 雙庫合計</el-radio-button>
          <el-radio-button label="80">📦 80 庫</el-radio-button>
          <el-radio-button label="15">🔍 15 庫</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="fetchAbnormalData">
          🔄 重新整理
        </el-button>

        <el-button type="success" size="small" icon="el-icon-download" @click="exportExcel">
          📊 匯出不合理報表
        </el-button>
      </div>
    </div>

    <!-- 2. 統計 KPI 卡片區塊 -->
    <div class="metrics-grid">
      <div class="metric-card border-red">
        <div class="m-label">不合理進貨總筆數</div>
        <div class="m-value text-red">{{ formatNumber(summary.totalCount) }} <span class="m-unit">筆</span></div>
      </div>

      <div class="metric-card border-blue">
        <div class="m-label">不合理驗收總 PCS</div>
        <div class="m-value text-blue">{{ formatNumber(summary.totalPcs) }} <span class="m-unit">PCS</span></div>
      </div>

      <div class="metric-card border-yellow">
        <div class="m-label">佔用倉庫才數</div>
        <div class="m-value text-yellow">{{ formatNumber(summary.totalCubicFeet) }} <span class="m-unit">才</span></div>
      </div>

      <div class="metric-card border-purple">
        <div class="m-label">涉及 PM 採購人數</div>
        <div class="m-value text-purple">{{ formatNumber(summary.pmCount) }} <span class="m-unit">人</span></div>
      </div>
    </div>

    <!-- 3. 不合理類型過濾卡片 -->
    <div class="filter-card">
      <span class="filter-label">📌 不合理判定類型過濾：</span>
      <el-radio-group v-model="ruleType" size="small" @change="fetchAbnormalData">
        <el-radio-button label="all">🌐 全選 (所有不合理)</el-radio-button>
        <el-radio-button label="zero_sales">🚨 零銷量/高庫齡進貨</el-radio-button>
        <el-radio-button label="high_turnover">⚠️ 迴轉天數過高 (>180天)</el-radio-button>
        <el-radio-button label="over_import">⚠️ 爆量驗收 (進貨>90日銷量2倍)</el-radio-button>
        <el-radio-button label="no_dim">ℹ️ 材積長寬高未填</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 4. 不合理資料明細表格 -->
    <div class="table-container" v-loading="loading">
      <el-table
        :data="tableData"
        border
        stripe
        size="small"
        height="calc(100vh - 250px)"
        class="dark-table"
      >
        <el-table-column prop="rec_date" label="驗收日期" width="105" align="center" />
        <el-table-column prop="po_no" label="進貨單號 (PO)" width="150" align="center">
          <template #default="scope">
            <span class="font-bold text-orange">{{ scope.row.po_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_id" label="商品編號" width="150" align="center">
          <template #default="scope">
            <span class="font-bold text-blue">{{ scope.row.item_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_name" label="商品名稱" min-width="220" show-overflow-tooltip />
        <el-table-column prop="import_qty" label="驗收PCS" width="85" align="right">
          <template #default="scope">
            <span class="font-bold text-blue">{{ formatNumber(scope.row.import_qty) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="import_cubic_feet" label="進貨才數" width="90" align="right">
          <template #default="scope">
            <span class="font-bold text-yellow">{{ formatNumber(scope.row.import_cubic_feet) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sales_90d" label="近90日銷量" width="95" align="right">
          <template #default="scope">
            <span :class="scope.row.sales_90d === 0 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.sales_90d) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="turn_days_total" label="迴轉天數" width="85" align="right">
          <template #default="scope">
            <span :class="scope.row.turn_days_total > 180 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.turn_days_total) }}天</span>
          </template>
        </el-table-column>
        <el-table-column prop="pm" label="所屬 PM" width="90" align="center" />
        <el-table-column label="不合理判定原因" min-width="220">
          <template #default="scope">
            <div class="tag-group">
              <el-tag
                v-for="(t, i) in scope.row.tags"
                :key="i"
                :type="t.type"
                size="mini"
                effect="dark"
              >
                {{ t.text }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="收貨備註" min-width="140" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

export default {
  name: 'AbnormalPurchase',
  data() {
    const today = new Date().toISOString().split('T')[0];
    const past30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    return {
      loading: false,
      dateRange: [past30, today],
      warehouse: 'all',
      ruleType: 'all',
      summary: {
        totalCount: 0,
        totalPcs: 0,
        totalCubicFeet: 0,
        pmCount: 0
      },
      tableData: []
    }
  },
  mounted() {
    this.fetchAbnormalData();
  },
  methods: {
    formatNumber(val) {
      if (!val) return '0';
      return Number(val).toLocaleString();
    },

    async fetchAbnormalData() {
      this.loading = true;
      try {
        const params = {
          startDate: this.dateRange && this.dateRange[0] ? this.dateRange[0] : '',
          endDate: this.dateRange && this.dateRange[1] ? this.dateRange[1] : '',
          warehouse: this.warehouse,
          ruleType: this.ruleType
        };

        const res = await axios.get('/api/abnormal/list', { params });
        if (res.data?.success) {
          this.summary = res.data.summary || {};
          this.tableData = res.data.data || [];
        }
      } catch (e) {
        ElMessage.error('載入不合理進貨資料失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    exportExcel() {
      if (!this.tableData.length) {
        return ElMessage.warning('無可匯出的不合理資料！');
      }

      const exportRows = this.tableData.map(r => ({
        '驗收日期': r.rec_date,
        '進貨單號(PO)': r.po_no,
        '驗收批號': r.batch_no,
        '商品編號': r.item_id,
        '商品名稱': r.item_name,
        '驗收數量(PCS)': r.import_qty,
        '進貨才數': r.import_cubic_feet,
        '現有庫存量': r.current_stock_qty,
        '近90日銷量': r.sales_90d,
        '預估迴轉天數': r.turn_days_total,
        '庫齡': r.age,
        '所屬PM': r.pm,
        '供應商': r.supplier_name,
        '不合理判定原因': r.tags.map(t => t.text).join(' | '),
        '收貨備註': r.remark
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "不合理進貨清單");
      XLSX.writeFile(workbook, `不合理進貨分析_${new Date().getTime()}.xlsx`);
      ElMessage.success('🎉 已成功匯出不合理進貨分析 Excel 報表！');
    }
  }
}
</script>

<style scoped>
.abnormal-purchase-page {
  padding: 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.top-bar, .filter-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
}

.filter-card {
  justify-content: flex-start;
  gap: 12px;
}

.title-group, .action-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: bold;
  color: #f87171;
}

.filter-label {
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
}

/* KPI 統計卡片風格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.metric-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.border-red { border-left: 4px solid #ef4444 !important; }
.border-blue { border-left: 4px solid #38bdf8 !important; }
.border-yellow { border-left: 4px solid #fef08a !important; }
.border-purple { border-left: 4px solid #c084fc !important; }

.m-label {
  font-size: 12px;
  color: #94a3b8;
}

.m-value {
  font-size: 20px;
  font-weight: bold;
}

.m-unit {
  font-size: 12px;
  font-weight: normal;
  color: #cbd5e1;
}

.table-container {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  flex: 1;
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

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.text-red { color: #f87171 !important; }
.text-blue { color: #38bdf8 !important; }
.text-yellow { color: #fef08a !important; }
.text-orange { color: #fbbf24 !important; }
.text-purple { color: #c084fc !important; }
.font-bold { font-weight: bold; }
</style>