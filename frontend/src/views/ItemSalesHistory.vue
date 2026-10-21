<template>
  <div class="item-sales-history-page dark-bg">
    <!-- 1. 頂部搜尋與工具列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">📈 全商品歷史銷量與進貨履歷總表</span>
        
        <el-input
          v-model="keyword"
          placeholder="搜尋商品編號 / 商品名稱 / 供應商"
          size="small"
          clearable
          style="width: 280px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />

        <el-input
          v-model="pmFilter"
          placeholder="篩選 PM"
          size="small"
          clearable
          style="width: 140px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />

        <el-checkbox v-model="filterZeroSales" label="🚨 90日零銷量" @change="handleSearch" />
        <el-checkbox v-model="filterOutOfStock" label="📦 庫存售罄 (總庫存=0)" @change="handleSearch" />

        <el-button type="primary" size="small" icon="el-icon-search" @click="handleSearch">
          🔍 檢索
        </el-button>
      </div>

      <div class="action-group">
        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="fetchHistoryData">
          🔄 重新整理
        </el-button>

        <el-button type="success" size="small" icon="el-icon-download" @click="exportExcel">
          📊 匯出全量 Excel
        </el-button>
      </div>
    </div>

    <!-- 2. 明細表格 -->
    <div class="table-container" v-loading="loading">
      <el-table
        :data="tableData"
        border
        stripe
        size="small"
        height="calc(100vh - 180px)"
        class="dark-table"
      >
        <el-table-column prop="item_id" label="商品編號" width="150" align="center" sortable>
          <template #default="scope">
            <span class="font-bold text-blue">{{ scope.row.item_id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="item_name" label="商品名稱" min-width="220" show-overflow-tooltip sortable />
        <el-table-column prop="pm" label="所屬 PM" width="100" align="center" sortable />
        <el-table-column prop="supplier_name" label="供應商名稱" min-width="160" show-overflow-tooltip sortable />

        <!-- 庫存拆分 -->
        <el-table-column prop="stock_qty_80" label="80 庫存" width="100" align="right" sortable>
          <template #default="scope">
            <span>{{ formatNumber(scope.row.stock_qty_80) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="stock_qty_15" label="15 庫存" width="100" align="right" sortable>
          <template #default="scope">
            <span>{{ formatNumber(scope.row.stock_qty_15) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="total_stock_qty" label="總庫存數" width="110" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.total_stock_qty === 0 ? 'text-gray font-bold' : 'text-green font-bold'">
              {{ formatNumber(scope.row.total_stock_qty) }}
              <span v-if="scope.row.total_stock_qty === 0" style="font-size: 11px;">(售罄)</span>
            </span>
          </template>
        </el-table-column>

        <!-- 銷量指標 -->
        <el-table-column prop="monthly_sales" label="(近)月銷量" width="110" align="right" sortable>
          <template #default="scope">
            <span class="font-bold">{{ formatNumber(scope.row.monthly_sales) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sales_90d" label="(近)90日銷量" width="120" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.sales_90d === 0 ? 'text-red font-bold' : 'text-yellow font-bold'">
              {{ formatNumber(scope.row.sales_90d) }}
            </span>
          </template>
        </el-table-column>

        <!-- 時間紀錄 -->
        <el-table-column prop="last_record_date" label="最後庫存檔日期" width="140" align="center" sortable>
          <template #default="scope">
            <span class="text-purple">{{ scope.row.last_record_date || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="last_inbound_date" label="最後進貨驗收日期" width="150" align="center" sortable>
          <template #default="scope">
            <span class="text-orange font-bold">{{ scope.row.last_inbound_date || '無驗收紀錄' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 底部分頁列 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[100, 200, 500, 1000]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalRows"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

export default {
  name: 'ItemSalesHistory',
  data() {
    return {
      loading: false,
      keyword: '',
      pmFilter: '',
      filterZeroSales: false,
      filterOutOfStock: false,
      tableData: [],
      currentPage: 1,
      pageSize: 500,
      totalRows: 0
    }
  },
  mounted() {
    this.fetchHistoryData();
  },
  methods: {
    formatNumber(val) {
      if (!val && val !== 0) return '0';
      return Number(val).toLocaleString();
    },

    handleSearch() {
      this.currentPage = 1;
      this.fetchHistoryData();
    },

    handleSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.fetchHistoryData();
    },

    handleCurrentChange(val) {
      this.currentPage = val;
      this.fetchHistoryData();
    },

    async fetchHistoryData() {
      this.loading = true;
      try {
        const params = {
          page: this.currentPage,
          pageSize: this.pageSize,
          keyword: this.keyword,
          pm: this.pmFilter,
          filterZeroSales: this.filterZeroSales,
          filterOutOfStock: this.filterOutOfStock
        };

        const res = await axios.get('/api/item-sales-history/list', { params, timeout: 20000 });
        if (res.data?.success) {
          this.tableData = res.data.data || [];
          this.totalRows = res.data.total || 0;
        } else {
          ElMessage.error(res.data?.message || '讀取歷史銷量失敗');
        }
      } catch (e) {
        ElMessage.error('載入失敗：' + (e.response?.data?.message || e.message));
      } finally {
        this.loading = false;
      }
    },

    async exportExcel() {
      if (!this.totalRows) return ElMessage.warning('無可匯出的資料！');

      const loadingMsg = ElMessage.info({ message: '⚡ 正在打包歷史銷量總表資料...', duration: 0 });
      try {
        // 拉取當前查詢條件下的全量資料 (最多 30 萬筆)
        const params = {
          page: 1,
          pageSize: 300000,
          keyword: this.keyword,
          pm: this.pmFilter,
          filterZeroSales: this.filterZeroSales,
          filterOutOfStock: this.filterOutOfStock
        };

        const res = await axios.get('/api/item-sales-history/list', { params, timeout: 60000 });
        loadingMsg.close();

        if (res.data?.success && res.data.data) {
          const exportRows = res.data.data.map(r => ({
            '商品編號': r.item_id,
            '商品名稱': r.item_name,
            '所屬PM': r.pm,
            '供應商名稱': r.supplier_name,
            '80庫存': r.stock_qty_80,
            '15庫存': r.stock_qty_15,
            '總庫存數': r.total_stock_qty,
            '(近)月銷量': r.monthly_sales,
            '(近)90日銷量': r.sales_90d,
            '最後庫存檔日期': r.last_record_date,
            '最後進貨驗收日期': r.last_inbound_date
          }));

          const worksheet = XLSX.utils.json_to_sheet(exportRows);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "商品歷史銷量與驗收總表");
          XLSX.writeFile(workbook, `商品歷史銷量與驗收總表_${new Date().getTime()}.xlsx`);
          ElMessage.success(`🎉 已成功匯出 ${exportRows.length.toLocaleString()} 筆全量歷史資料！`);
        }
      } catch (e) {
        loadingMsg.close();
        ElMessage.error('匯出失敗：' + e.message);
      }
    }
  }
}
</script>

<style scoped>
.item-sales-history-page { padding: 16px; height: calc(100vh - 52px); box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px 16px; border-radius: 8px; border: 1px solid #334155; }
.title-group, .action-group { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 16px; font-weight: bold; color: #38bdf8; }
.table-container { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; flex: 1; display: flex; flex-direction: column; }
.pagination-bar { display: flex; justify-content: flex-end; padding-top: 10px; background: #1e293b; }
:deep(.dark-table) { background-color: #1e293b !important; color: #f8fafc !important; }
:deep(.dark-table th.el-table__cell) { background-color: #0f172a !important; color: #38bdf8 !important; border-bottom: 1px solid #334155 !important; }
:deep(.dark-table td.el-table__cell) { background-color: #1e293b !important; color: #f8fafc !important; border-bottom: 1px solid #334155 !important; }
.text-red { color: #f87171 !important; }
.text-blue { color: #38bdf8 !important; }
.text-green { color: #4ade80 !important; }
.text-yellow { color: #fef08a !important; }
.text-orange { color: #fbbf24 !important; }
.text-purple { color: #c084fc !important; }
.text-gray { color: #94a3b8 !important; }
.font-bold { font-weight: bold; }
</style>