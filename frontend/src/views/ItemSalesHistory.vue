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
          style="width: 260px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />

        <el-input
          v-model="pmFilter"
          placeholder="篩選 PM"
          size="small"
          clearable
          style="width: 120px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />

        <el-select v-model="tagFilter" placeholder="商品屬性" size="small" clearable style="width: 120px;" @change="handleSearch">
          <el-option label="📦 主商品" value="主商品" />
          <el-option label="🎁 贈品" value="贈品" />
          <el-option label="🏷️ 樣品" value="樣品" />
          <el-option label="📦 耗材" value="耗材" />
        </el-select>

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
        <!-- 商品編號 (點選開啟快速標記) -->
        <el-table-column prop="item_id" label="商品編號" width="165" align="center" sortable fixed="left">
          <template #default="scope">
            <span class="font-bold text-blue clickable-link" @click="openQuickTagModal(scope.row)">
              {{ scope.row.item_id }} 🏷️
            </span>
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

        <!-- 🌟 純文字標籤：商品屬性 -->
        <el-table-column prop="item_tag" label="商品屬性" width="110" align="center" sortable fixed="right">
          <template #default="scope">
            <span class="tag-badge" :class="getTagBadgeClass(scope.row.item_tag)">
              {{ formatTagText(scope.row.item_tag) }}
            </span>
          </template>
        </el-table-column>

        <!-- 🌟 純文字顯示：自訂備註 -->
        <el-table-column prop="remark" label="自訂備註" min-width="160" show-overflow-tooltip fixed="right">
          <template #default="scope">
            <span :class="scope.row.remark ? 'text-light' : 'text-gray'">
              {{ scope.row.remark || '-' }}
            </span>
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

    <!-- 點選商品 ID 彈出的快速標記對話盒 -->
    <el-dialog 
      v-model="showQuickTagModal" 
      title="🏷️ 商品屬性與備註標記" 
      width="460px"
      append-to-body
      class="custom-tag-dialog"
    >
      <div v-if="activeItem" class="modal-body-content">
        <div class="item-info-line">
          <span class="info-lbl">商品編號：</span>
          <span class="info-val text-blue">{{ activeItem.item_id }}</span>
        </div>
        <div class="item-info-line">
          <span class="info-lbl">商品名稱：</span>
          <span class="info-val">{{ activeItem.item_name }}</span>
        </div>
        <div class="item-info-line">
          <span class="info-lbl">商品屬性：</span>
          <el-radio-group v-model="modalTag" size="small">
            <el-radio-button label="主商品">📦 主商品</el-radio-button>
            <el-radio-button label="贈品">🎁 贈品</el-radio-button>
            <el-radio-button label="樣品">🏷️ 樣品</el-radio-button>
            <el-radio-button label="耗材">📦 耗材</el-radio-button>
          </el-radio-group>
        </div>
        <div class="item-info-line column">
          <span class="info-lbl">永久備註說明：</span>
          <el-input 
            v-model="modalRemark" 
            type="textarea" 
            :rows="3" 
            placeholder="請輸入屬性說明，如滿額活動搭配、非賣品等..."
          />
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showQuickTagModal = false">取消</el-button>
          <el-button type="primary" size="small" @click="saveModalTag">💾 儲存標記</el-button>
        </span>
      </template>
    </el-dialog>
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
      tagFilter: '',
      filterZeroSales: false,
      filterOutOfStock: false,
      tableData: [],
      currentPage: 1,
      pageSize: 500,
      totalRows: 0,

      showQuickTagModal: false,
      activeItem: null,
      modalTag: '主商品',
      modalRemark: ''
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

    formatTagText(tag) {
      if (!tag || tag === '主商品') return '📦 主商品';
      if (tag === '贈品') return '🎁 贈品';
      if (tag === '樣品') return '🏷️ 樣品';
      if (tag === '耗材') return '📦 耗材';
      return tag;
    },

    getTagBadgeClass(tag) {
      if (tag === '贈品') return 'badge-gift';
      if (tag === '樣品') return 'badge-sample';
      if (tag === '耗材') return 'badge-consumable';
      return 'badge-main';
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
          tag: this.tagFilter,
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

    openQuickTagModal(row) {
      this.activeItem = row;
      this.modalTag = row.item_tag || '主商品';
      this.modalRemark = row.remark || '';
      this.showQuickTagModal = true;
    },

    async saveModalTag() {
      if (!this.activeItem) return;
      try {
        const res = await axios.post('/api/item-sales-history/update-tag-remark', {
          item_id: this.activeItem.item_id,
          item_tag: this.modalTag,
          remark: this.modalRemark
        });
        if (res.data?.success) {
          this.activeItem.item_tag = this.modalTag;
          this.activeItem.remark = this.modalRemark;
          ElMessage.success(res.data.message);
          this.showQuickTagModal = false;
        }
      } catch (e) {
        ElMessage.error('儲存失敗：' + (e.response?.data?.message || e.message));
      }
    },

    async exportExcel() {
      if (!this.totalRows) return ElMessage.warning('無可匯出的資料！');

      const loadingMsg = ElMessage.info({ message: '⚡ 正在打包歷史銷量總表資料...', duration: 0 });
      try {
        const params = {
          page: 1,
          pageSize: 300000,
          keyword: this.keyword,
          pm: this.pmFilter,
          tag: this.tagFilter,
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
            '最後進貨驗收日期': r.last_inbound_date,
            '商品屬性': r.item_tag || '主商品',
            '自訂備註': r.remark || ''
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

.clickable-link {
  cursor: pointer;
  text-decoration: underline;
  transition: all 0.2s;
}
.clickable-link:hover {
  color: #38bdf8 !important;
  text-shadow: 0 0 4px rgba(56, 189, 248, 0.5);
}

/* 🌟 純文字標籤樣式 */
.tag-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
.badge-main {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}
.badge-gift {
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.3);
}
.badge-sample {
  color: #eab308;
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.3);
}
.badge-consumable {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.text-light { color: #f1f5f9; }

.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.item-info-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-info-line.column {
  flex-direction: column;
  align-items: flex-start;
}
.info-lbl {
  font-size: 13px;
  color: #94a3b8;
  font-weight: bold;
}
.info-val {
  font-size: 14px;
  font-weight: bold;
}

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