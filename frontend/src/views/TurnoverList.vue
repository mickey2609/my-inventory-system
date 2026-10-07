<template>
  <div class="turnover-page dark-bg">
    <!-- 頂部操作與篩選列 -->
    <div class="top-filter-bar">
      <div class="title-group">
        <span class="page-title">📈 迴轉率分析清單</span>
        
        <!-- 倉庫切換頁籤 -->
        <el-radio-group v-model="warehouseType" size="small" @change="handleFilterChange">
          <el-radio-button label="15">📦 15庫 (自動化倉)</el-radio-button>
          <el-radio-button label="80">🔍 80庫 (人工倉)</el-radio-button>
        </el-radio-group>

        <span class="report-time">報表產出時間：{{ reportTime }}</span>
      </div>

      <div class="controls-group">
        <div class="input-item">
          <span class="label">迴轉(月)門檻：</span>
          <el-input-number 
            v-model="minTurnover" 
            :min="0" 
            :max="9999" 
            size="small" 
            style="width: 100px;"
            @change="handleFilterChange"
          />
        </div>

        <div class="input-item">
          <span class="label">上限筆數：</span>
          <el-input-number 
            v-model="limitCount" 
            :min="1" 
            :max="10000" 
            size="small" 
            style="width: 120px;"
            @change="handleFilterChange"
          />
        </div>

        <div class="input-item">
          <span class="label">板數排序：</span>
          <el-select v-model="sortOrder" size="small" style="width: 130px;" @change="handleFilterChange">
            <el-option label="由大到小 (降冪)" value="desc" />
            <el-option label="由小到大 (升冪)" value="asc" />
          </el-select>
        </div>

        <el-button 
          type="primary" 
          size="small" 
          icon="el-icon-refresh" 
          :loading="loading"
          @click="fetchTurnoverData"
        >
          重新計算
        </el-button>

        <el-button 
          type="success" 
          size="small" 
          icon="el-icon-document" 
          :loading="exporting"
          @click="exportExcel"
        >
          📊 匯出 Excel
        </el-button>
      </div>
    </div>

    <!-- 1. 級距分頁切換卡片 -->
    <div class="tier-tabs-bar">
      <el-tabs v-model="selectedTier" type="card" @tab-click="handleFilterChange">
        <el-tab-pane label="🌐 全部級距" name="all" />
        <el-tab-pane label="91 ~ 180" name="t91_180" />
        <el-tab-pane label="181 ~ 270" name="t181_270" />
        <el-tab-pane label="271 ~ 365" name="t271_365" />
        <el-tab-pane label="365 以上" name="t365_plus" />
        <el-tab-pane label="🚨 滯銷 99999" name="t99999" />
      </el-tabs>
    </div>

    <!-- 2. 總計摘要與 5 大級距統計面板 -->
    <div class="summary-overview-card" v-loading="loading">
      <div class="summary-header">
        【摘要】{{ warehouseType === '15' ? '15庫 (自動化倉)' : '80庫 (人工倉)' }} 門檻設定：迴轉(月) > {{ summary.minTurnover }} | 截取板數 Top {{ summary.limitCount }} 筆
        <span v-if="warehouseType === '15'">(排除 80U/80Z 儲位，同 ID 去重)</span>
        <span v-else>(全庫存統計，同 ID 去重)</span>
      </div>

      <div class="summary-totals-grid">
        <div class="total-box"><span class="lbl">筆數上限內品項</span><span class="val text-blue">{{ formatNumber(summary.totalItems) }}</span></div>
        <div class="total-box"><span class="lbl">PCS 數總計</span><span class="val text-green">{{ formatNumber(summary.totalPcs) }}</span></div>
        <div class="total-box"><span class="lbl">總才數總計</span><span class="val text-orange">{{ formatNumber(summary.totalVolume, 6) }}</span></div>
        <div class="total-box"><span class="lbl">總板數總計</span><span class="val text-cyan">{{ formatNumber(summary.totalPallets, 6) }}</span></div>
      </div>

      <!-- 5 大級距門檻統計表格 -->
      <div class="tier-table-wrapper">
        <table class="tier-table">
          <thead>
            <tr>
              <th>級距門檻</th>
              <th>品項數</th>
              <th>PCS 數</th>
              <th>才數</th>
              <th>板數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.key" :class="{ 'highlight-滞銷': t.key === 't99999', 'selected-row': selectedTier === t.key }">
              <td class="tier-label">{{ t.label }}</td>
              <td class="text-right">{{ formatNumber(t.items) }}</td>
              <td class="text-right">{{ formatNumber(t.pcs) }}</td>
              <td class="text-right">{{ formatNumber(t.vol, 6) }}</td>
              <td class="text-right font-bold">{{ formatNumber(t.pallets, 6) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. 迴轉率數據表格與分頁 -->
    <div class="data-table-card" v-loading="loading">
      <el-table 
        :data="tableData" 
        border 
        stripe 
        size="mini" 
        class="dark-table"
        height="calc(100vh - 430px)"
      >
        <el-table-column prop="item_id" label="商品ID" width="140" fixed="left" sortable />
        <el-table-column prop="item_name" label="商品名稱" min-width="260" show-overflow-tooltip />
        <el-table-column prop="borrow_proc" label="借/採" width="80" align="center" />
        <el-table-column prop="total_qty" label="加總庫存數" width="110" align="right" sortable>
          <template #default="scope">{{ formatNumber(scope.row.total_qty) }}</template>
        </el-table-column>
        <el-table-column prop="max_age" label="最長庫齡" width="100" align="right" sortable />
        <el-table-column prop="zone_id" label="區編" width="90" align="center" />
        <el-table-column prop="zone_name" label="區名" width="110" align="center" />
        <el-table-column prop="total_cubic_feet" label="總才數" width="130" align="right" sortable>
          <template #default="scope"><span class="text-orange">{{ formatNumber(scope.row.total_cubic_feet, 6) }}</span></template>
        </el-table-column>
        <el-table-column prop="turnover_month" label="迴轉(月)" width="110" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.turnover_month === 99999 ? 'tag-stagnant' : 'text-blue'">
              {{ scope.row.turnover_month === 99999 ? '滯銷(99999)' : scope.row.turnover_month }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="monthly_sales" label="月銷量" width="100" align="right" sortable>
          <template #default="scope">{{ formatNumber(scope.row.monthly_sales) }}</template>
        </el-table-column>
        <el-table-column prop="pallets" label="板數" width="130" align="right" sortable fixed="right">
          <template #default="scope"><span class="text-cyan font-bold">{{ formatNumber(scope.row.pallets, 6) }}</span></template>
        </el-table-column>
      </el-table>

      <!-- 底部分頁導覽列 (固定每頁 500 筆) -->
      <div class="pagination-footer">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="totalRows"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import * as XLSX from 'xlsx'

export default {
  name: 'TurnoverList',
  data() {
    return {
      loading: false,
      exporting: false,
      warehouseType: '15',
      minTurnover: 90,
      limitCount: 500, // 預設前 500 筆
      sortOrder: 'desc', // 板數預設大至小
      selectedTier: 'all', // 預設全部級距
      currentPage: 1,
      pageSize: 500, // 每頁 500 筆
      totalRows: 0,
      reportTime: '',
      summary: { minTurnover: 90, limitCount: 500, totalItems: 0, totalPcs: 0, totalVolume: 0, totalPallets: 0 },
      tiers: [],
      tableData: [],
      exportFullData: []
    }
  },
  mounted() {
    this.updateReportTime();
    this.fetchTurnoverData();
  },
  methods: {
    updateReportTime() {
      const now = new Date();
      this.reportTime = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    },
    formatNumber(val, decimals = 0) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(val);
      if (isNaN(num)) return val;
      return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    handleFilterChange() {
      this.currentPage = 1;
      this.fetchTurnoverData();
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.fetchTurnoverData();
    },
    async fetchTurnoverData() {
      this.loading = true;
      this.updateReportTime();
      const apiEndpoint = this.warehouseType === '80' ? '/api/turnover80/search' : '/api/turnover15/search';
      
      const params = new URLSearchParams({
        minTurnover: this.minTurnover,
        limit: this.limitCount,
        sortOrder: this.sortOrder,
        tier: this.selectedTier,
        page: this.currentPage,
        pageSize: this.pageSize
      });

      try {
        const res = await axios.get(`${apiEndpoint}?${params.toString()}`);
        if (res.data?.success) {
          this.summary = res.data.summary || {};
          this.tiers = res.data.tiers || [];
          this.tableData = res.data.data || [];
          this.exportFullData = res.data.exportData || [];
          this.totalRows = res.data.pagination?.totalRows || 0;
        } else {
          this.$message.error('計算失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (e) {
        this.$message.error('連線失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },
    async exportExcel() {
      const exportList = this.exportFullData.length > 0 ? this.exportFullData : this.tableData;
      if (exportList.length === 0) return this.$message.warning('查無資料可供匯出');
      
      this.exporting = true;
      const whName = this.warehouseType === '15' ? '15庫_自動化倉' : '80庫_人工倉';
      try {
        const wb = XLSX.utils.book_new();
        const aoa = [
          [`【摘要】${whName} 門檻設定：迴轉(月) > ${this.minTurnover} | 筆數上限 Top ${this.summary.limitCount}`],
          [`品項數總計：`, this.summary.totalItems, `PCS數總計：`, this.summary.totalPcs, `總才數總計：`, this.summary.totalVolume, `總板數總計：`, this.summary.totalPallets],
          [],
          ['級距門檻', '品項數', 'PCS 數', '才數', '板數']
        ];

        this.tiers.forEach(t => {
          aoa.push([t.label, t.items, t.pcs, t.vol, t.pallets]);
        });

        aoa.push([]);
        aoa.push(['商品ID', '商品名稱', '借/採', '加總庫存數', '最長庫齡', '區編', '區名', '總才數', '迴轉(月)', '月銷量', '板數']);

        exportList.forEach(r => {
          aoa.push([
            r.item_id, r.item_name, r.borrow_proc, r.total_qty, r.max_age,
            r.zone_id, r.zone_name, r.total_cubic_feet, r.turnover_month, r.monthly_sales, r.pallets
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, `${whName}_迴轉率清單`);
        XLSX.writeFile(wb, `${whName}_迴轉率清單_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.$message.success('🎉 成功匯出迴轉率 Excel 報表！');
      } catch (e) {
        this.$message.error('匯出 Excel 失敗：' + e.message);
      } finally {
        this.exporting = false;
      }
    }
  }
}
</script>

<style scoped>
.turnover-page {
  padding: 16px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.top-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 16px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 16px;
  font-weight: bold;
  color: #38bdf8;
}

.report-time {
  font-size: 12px;
  color: #94a3b8;
}

.controls-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #f8fafc;
}

.tier-tabs-bar {
  background: #1e293b;
  border-radius: 6px;
  padding: 4px 8px 0 8px;
}

:deep(.el-tabs__header) {
  margin: 0 !important;
  border-bottom: none !important;
}

:deep(.el-tabs__item) {
  color: #94a3b8 !important;
  border-radius: 6px 6px 0 0 !important;
  border: 1px solid transparent !important;
}

:deep(.el-tabs__item.is-active) {
  color: #38bdf8 !important;
  background: #0f172a !important;
  border-color: #334155 #334155 #0f172a #334155 !important;
  font-weight: bold;
}

.summary-overview-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-header {
  background: #312e81;
  color: #c7d2fe;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.summary-totals-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.total-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
}

.total-box .lbl { font-size: 11px; color: #94a3b8; }
.total-box .val { font-size: 16px; font-weight: bold; margin-top: 2px; }

.tier-table-wrapper {
  overflow-x: auto;
}

.tier-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: #0f172a;
}

.tier-table th, .tier-table td {
  border: 1px solid #334155;
  padding: 5px 8px;
}

.tier-table th {
  background: #1e293b;
  color: #38bdf8;
  font-weight: bold;
  text-align: center;
}

.tier-table tr.selected-row td {
  border-top: 2px solid #38bdf8 !important;
  border-bottom: 2px solid #38bdf8 !important;
}

.tier-table tr.highlight-滞銷 td {
  background: rgba(244, 63, 94, 0.1);
  color: #f43f5e;
}

.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.text-cyan { color: #22d3ee; }
.font-bold { font-weight: bold; }

.tag-stagnant {
  background: #f43f5e;
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 11px;
}

.data-table-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pagination-footer {
  display: flex;
  justify-content: flex-end;
  background: #1e293b;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
}
</style>