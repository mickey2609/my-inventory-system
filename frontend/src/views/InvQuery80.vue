<template>
  <div class="inv-query-container">
    <!-- 1. 上方操作按鈕列 -->
    <div class="top-action-bar">
      <div class="left-btn-group">
        <el-button type="primary" icon="el-icon-search" size="small" @click="$emit('open-search')">
          🔍 設定搜尋條件與檢索
        </el-button>

        <!-- 個別權限判斷匯出按鈕 -->
        <el-button 
          v-if="canExport('xlsx')" 
          type="success" 
          icon="el-icon-download" 
          size="small" 
          @click="$emit('export-data', 'xlsx')"
        >
          📊 匯出 xlsx
        </el-button>

        <el-button 
          v-if="canExport('csv')" 
          type="info" 
          icon="el-icon-document" 
          size="small" 
          @click="$emit('export-data', 'csv')"
        >
          📄 匯出 CSV
        </el-button>

        <el-button 
          v-if="canExport('pdf')" 
          type="danger" 
          icon="el-icon-printer" 
          size="small" 
          @click="$emit('export-data', 'pdf')"
        >
          🖨️ 匯出 PDF
        </el-button>
      </div>
    </div>

    <!-- 2. 統計卡片列 -->
    <div class="summary-cards-wrapper" v-if="hasSearched">
      <div class="summary-card">
        <div class="card-title">總品項</div>
        <div class="card-value">{{ formatNumber(computedSummary.total_items) }}</div>
      </div>
      <div class="summary-card">
        <div class="card-title">總列數</div>
        <div class="card-value">{{ formatNumber(computedSummary.total_rows) }}</div>
      </div>
      <div class="summary-card">
        <div class="card-title">總庫存</div>
        <div class="card-value">{{ formatNumber(computedSummary.total_pcs) }}</div>
      </div>
      <div class="summary-card">
        <div class="card-title">總才數</div>
        <div class="card-value">{{ formatNumber(computedSummary.total_ao) }}</div>
      </div>
      <div class="summary-card time-card">
        <div class="card-title">查詢時間</div>
        <div class="card-value time-value">{{ searchTime || '-' }}</div>
      </div>
    </div>

    <!-- 3. 下方表格數據明細區 -->
    <div class="table-section" v-loading="loading">
      <div class="table-header-info" v-if="hasSearched">
        <div class="table-header-title">
          <span>📊 庫存明細</span>
          <span v-if="searchConditionText" class="search-condition-tag">
            (查詢條件：{{ searchConditionText }})
          </span>
        </div>
        <span class="page-tip">每頁顯示 {{ formatNumber(pageSize) }} 筆資料</span>
      </div>

      <el-table
        :data="tableData"
        border
        stripe
        height="calc(100vh - 280px)"
        style="width: 100%"
        class="custom-dark-table"
      >
        <el-table-column
          label="序號"
          type="index"
          :index="indexMethod"
          width="70"
          align="center"
          fixed="left"
        />

        <el-table-column
          v-for="col in displayColumns"
          :key="col"
          :label="col"
          :min-width="getColumnWidth(col)"
          :align="getColumnAlign(col)"
          show-overflow-tooltip
        >
          <template #default="scope">
            <span>{{ getValueByColName(scope.row, col) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="hasSearched && totalRowsCount > 0">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[100, 200, 500, 1000]"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="totalRowsCount"
          @size-change="onSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InvQuery80',
  props: {
    hasSearched: { type: Boolean, default: false },
    summary: { type: Object, default: () => ({ total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 }) },
    searchTime: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    tableData: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    currentPage: { type: Number, default: 1 },
    pageSize: { type: Number, default: 500 }, // 🌟 預設 500 筆，兼具資料量與順暢度
    totalRowsCount: { type: Number, default: 0 },
    customWidths: { type: Object, default: () => ({}) },
    form: { type: Object, default: () => ({}) },
    exportConfig: { type: Object, default: () => ({ xlsx: true, csv: true, pdf: true }) },
    isSysAdmin: Boolean
  },
  computed: {
    computedSummary() {
      return this.summary || { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 };
    },
    displayColumns() {
      if (this.columns && this.columns.length > 0) return this.columns;
      return ['商品ID', '商品名稱', '借/採', '人工/自動', '儲位庫存數', '庫齡', '區編', '區名', '館編', '館名', '大區名', '樓層'];
    },
    // 🌟 精準解析動態查詢條件與庫齡範圍顯示
    searchConditionText() {
      if (!this.form) return '全量無條件檢索';

      const mode = this.form.search_mode || 'normal';

      if (mode === 'batch_id') {
        const count = (this.form.batch_ids || '').split('\n').map(s => s.trim()).filter(Boolean).length;
        return `批次商品 ID (${count} 筆)`;
      }

      if (mode === 'batch_zone') {
        const count = (this.form.batch_zones || '').split('\n').map(s => s.trim()).filter(Boolean).length;
        return `批次大區 (${count} 筆)`;
      }

      const conds = [];
      if (this.form.txt_id) conds.push(`商品ID: ${this.form.txt_id}`);
      if (this.form.txt_name) conds.push(`名稱: ${this.form.txt_name}`);
      if (this.form.cbo_big_zone) conds.push(`大區: ${this.form.cbo_big_zone}`);
      if (this.form.cbo_zone) conds.push(`區名: ${this.form.cbo_zone}`);
      if (this.form.cbo_floor) conds.push(`樓層: ${this.form.cbo_floor}`);
      
      // 🌟 精準格式化庫齡顯示
      if (this.form.txt_age) {
        const ageVal = String(this.form.txt_age).trim();
        if (ageVal.includes('~') || ageVal.includes('-')) {
          conds.push(`庫齡: ${ageVal}`);
        } else {
          conds.push(`庫齡 >= ${ageVal}`);
        }
      }

      return conds.length > 0 ? conds.join(' | ') : '全量無條件檢索';
    }
  },
  methods: {
    canExport(type) {
      if (this.isSysAdmin) return true;
      return !!(this.exportConfig && this.exportConfig[type]);
    },
    indexMethod(index) {
      return (this.currentPage - 1) * this.pageSize + index + 1;
    },
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    // 🌟 保留完整的全欄位讀取邏輯
    getValueByColName(row, colName) {
      if (!row) return '-';

      const qty = parseFloat(row.qty !== undefined ? row.qty : (row.stock_qty || row['儲位庫存數'] || 0));
      const singleCubicFeet = parseFloat(row.cubic_feet || row['才數'] || 0);

      const fieldMap = {
        '商品ID': row['商品ID'] || row.item_id,
        '商品名稱': row['商品名稱'] || row.item_name,
        '借/採': row['借/採'] || row.borrow_proc || row.borrow_type,
        '儲位庫存數': qty,
        '庫齡': row['庫齡'] || row.age,
        '區編': row['區編'] || row.zone_id,
        '區名': row['區名'] || row.zone_name,
        '館編': row['館編'] || row.hall_id,
        '館名': row['館名'] || row.hall_name,
        '大區名': row['大區名'] || row.big_zone,
        '樓層': row['樓層'] || row.floor,
        '儲位': row['儲位'] || row.location,
        '長(cm)': row['長(cm)'] || row.length,
        '寬(cm)': row['寬(cm)'] || row.width,
        '高(cm)': row['高(cm)'] || row.height,
        '重量(kg)': row['重量(kg)'] || row.weight,
        '(近)月銷量': row['(近)月銷量'] || row.monthly_sales,
        '(近)月-有揀貨單天數': row['(近)月-有揀貨單天數'] || row.pick_days_m,
        '(近)90日銷量': row['(近)90日銷量'] || row.sales_90d,
        '(近)90日-有揀貨單天數': row['(近)90日-有揀貨單天數'] || row.pick_days_90d,
        '供應商ID': row['供應商ID'] || row.supplier_id,
        '供應商名稱': row['供應商名稱'] || row.supplier_name,
        '所屬PM': row['所屬PM'] || row.pm,
        '總庫存數': row['總庫存數'] || row.total_qty,
        '總庫存_迴轉天數': row['總庫存_迴轉天數'] || row.turn_days_total,
        '才數': singleCubicFeet ? (singleCubicFeet * qty).toFixed(4) : (row['才數'] || '-'),
        '材積別': row['材積別'] || row.vol_type,
        '儲位型態': row['儲位型態'] || row.loc_type,
        '大區編': row['大區編'] || row.big_zone_id,
        '儲位才數': row['儲位才數'] || row.loc_cubic_feet,
        '儲位健康度': row['儲位健康度'] || row.loc_health,
        '材積判斷': row['材積判斷'] || row.vol_check,
        '總才數': row['總才數'] || row.total_cubic_feet,
        '人工/自動': row['人工/自動'] || row.auto_type,
        '庫齡級距': row['庫齡級距'] || row.age_bracket,
        '重型架判斷': row['重型架判斷'] || row.heavy_rack_check
      };

      const val = fieldMap[colName] !== undefined ? fieldMap[colName] : row[colName];
      if (val === undefined || val === null || val === '') return '-';

      return this.formatSpecialValue(colName, val);
    },
    formatSpecialValue(colName, val) {
      if (['儲位庫存數', '庫齡', '總庫存數'].includes(colName)) {
        return this.formatNumber(val);
      }
      return val;
    },
    getColumnAlign(colName) {
      const rightCols = ['儲位庫存數', '才數', '庫齡', '長(cm)', '寬(cm)', '高(cm)', '重量(kg)', '(近)月銷量', '(近)90日銷量', '總庫存數', '總才數'];
      const centerCols = ['借/採', '區編', '區名', '館編', '館名', '大區編', '大區名', '樓層', '材積別', '人工/自動', '儲位型態', '庫齡級距'];
      
      if (rightCols.includes(colName)) return 'right';
      if (centerCols.includes(colName)) return 'center';
      return 'left';
    },
    getColumnWidth(colName) {
      if (this.customWidths && this.customWidths[colName]) {
        return this.customWidths[colName];
      }
      const widthMap = {
        '商品ID': 180,
        '商品名稱': 280,
        '借/採': 90,
        '人工/自動': 100,
        '儲位庫存數': 110,
        '庫齡': 90,
        '區編': 100,
        '區名': 130,
        '館編': 100,
        '館名': 130,
        '大區名': 130,
        '樓層': 90,
        '供應商名稱': 200,
        '(近)月銷量': 120,
        '(近)90日銷量': 120
      };
      return widthMap[colName] || 120;
    },
    onPageChange(page) {
      this.$emit('page-change', page);
    },
    onSizeChange(size) {
      this.$emit('size-change', size);
    }
  }
};
</script>

<style scoped>
.inv-query-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.top-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.left-btn-group {
  display: flex;
  gap: 8px;
}

.summary-cards-wrapper {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-card {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 16px;
  min-width: 140px;
  flex: 1;
}

.card-title {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.card-value {
  font-size: 18px;
  font-weight: bold;
  color: #38bdf8;
}

.time-card {
  min-width: 260px;
  flex: 1.5;
}

.time-value {
  font-size: 13px;
  color: #f8fafc;
  line-height: 24px;
}

.table-section {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #f8fafc;
  font-weight: bold;
  font-size: 14px;
}

.table-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-condition-tag {
  font-size: 13px;
  color: #38bdf8;
  background-color: rgba(56, 189, 248, 0.12);
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: normal;
}

.page-tip {
  font-size: 12px;
  color: #38bdf8;
  font-weight: normal;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

:deep(.custom-dark-table) {
  background-color: #1e293b !important;
}

:deep(.custom-dark-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  border-bottom: 1px solid #334155 !important;
}

:deep(.custom-dark-table td.el-table__cell) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.custom-dark-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: #334155 !important;
}
</style>