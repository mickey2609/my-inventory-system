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
        <!-- ⚙️ 參數設定按鈕 -->
        <el-button 
          type="warning" 
          size="small" 
          icon="el-icon-setting" 
          @click="showParamDialog = true"
        >
          ⚙️ 參數設定
        </el-button>

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

    <!-- 1. 年限級距切換頁籤 (Tabs) -->
    <div class="tier-tabs-bar">
      <el-tabs v-model="selectedTier" type="card" @tab-change="handleFilterChange">
        <el-tab-pane label="🌐 全部級距" name="all" />
        <el-tab-pane label="1 年以下" name="y_under_1" />
        <el-tab-pane label="1 年 ~ 5 年" name="y_1_5" />
        <el-tab-pane label="5 年 ~ 10 年" name="y_5_10" />
        <el-tab-pane label="10 年以上" name="y_over_10" />
        <el-tab-pane label="🚨 滯銷 99999" name="y99999" />
      </el-tabs>
    </div>

    <!-- 2. 總計摘要與級距統計面板 -->
    <div class="summary-overview-card" v-loading="loading">
      <div class="summary-header">
        【摘要】{{ warehouseType === '15' ? '15庫 (自動化倉)' : '80庫 (人工倉)' }} 門檻：迴轉(月) ≥ {{ summary.minTurnover }} | 庫齡 ≥ {{ summary.minAge || 0 }} 天 | 筆數 Top {{ summary.limitCount }}
        <span v-if="warehouseType === '15'">(排除 80U/80Z 儲位，同 ID 去重)</span>
        <span v-else>(全庫存統計，同 ID 去重)</span>
      </div>

      <div class="summary-totals-grid">
        <div class="total-box"><span class="lbl">筆數上限內品項</span><span class="val text-blue">{{ formatNumber(summary.totalItems) }}</span></div>
        <div class="total-box"><span class="lbl">PCS 數總計</span><span class="val text-green">{{ formatNumber(summary.totalPcs) }}</span></div>
        <div class="total-box"><span class="lbl">總才數總計</span><span class="val text-orange">{{ formatNumber(summary.totalVolume, 2) }}</span></div>
        <div class="total-box"><span class="lbl">總板數總計</span><span class="val text-cyan">{{ formatNumber(summary.totalPallets, 2) }}</span></div>
      </div>

      <!-- 動態級距門檻統計表格 -->
      <div class="tier-table-wrapper">
        <table class="tier-table">
          <thead>
            <tr>
              <th>級距門檻 (年限)</th>
              <th>品項數</th>
              <th>PCS 數</th>
              <th>才數</th>
              <th>板數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.key" :class="{ 'highlight-滞銷': t.key === 'y99999' }">
              <td class="tier-label font-bold">{{ t.label }}</td>
              <td class="text-right">{{ formatNumber(t.items) }}</td>
              <td class="text-right">{{ formatNumber(t.pcs) }}</td>
              <td class="text-right">{{ formatNumber(t.vol, 2) }}</td>
              <td class="text-right font-bold text-cyan">{{ formatNumber(t.pallets, 2) }}</td>
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
        <el-table-column prop="item_id" label="商品ID" width="210" fixed="left" sortable />
        <el-table-column prop="item_name" label="商品名稱" min-width="200" show-overflow-tooltip />
        <el-table-column prop="borrow_proc" label="借/採" width="75" align="center" />
        <el-table-column prop="total_qty" label="加總庫存數" width="105" align="right" sortable>
          <template #default="scope">{{ formatNumber(scope.row.total_qty) }}</template>
        </el-table-column>
        <el-table-column prop="max_age" label="最長庫齡" width="95" align="right" sortable />
        <el-table-column prop="zone_id" label="區編" width="80" align="center" />
        <el-table-column prop="zone_name" label="區名" width="100" align="center" />
        
        <el-table-column prop="total_cubic_feet" label="總才數" width="115" align="right" sortable>
          <template #default="scope"><span class="text-orange">{{ formatNumber(scope.row.total_cubic_feet, 2) }}</span></template>
        </el-table-column>

        <el-table-column prop="turnover_month" label="迴轉(月)" width="105" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.turnover_month === 99999 ? 'tag-stagnant' : 'text-blue'">
              {{ scope.row.turnover_month === 99999 ? '滯銷(99999)' : scope.row.turnover_month }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="monthly_sales" label="月銷量" width="95" align="right" sortable>
          <template #default="scope">{{ formatNumber(scope.row.monthly_sales) }}</template>
        </el-table-column>

        <el-table-column prop="pallets" label="板數" width="115" align="right" sortable fixed="right">
          <template #default="scope"><span class="text-cyan font-bold">{{ formatNumber(scope.row.pallets, 2) }}</span></template>
        </el-table-column>
      </el-table>

      <!-- 底部分頁導覽列 -->
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

    <!-- 4. ⚙️ 參數設定對話盒 (Modal) -->
    <el-dialog 
      v-model="showParamDialog" 
      title="⚙️ 迴轉率與庫齡分析參數設定" 
      width="480px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="dialog-body">
        <div class="param-row">
          <span class="param-label">迴轉(月)門檻：</span>
          <el-input-number v-model="minTurnover" :min="0" :max="9999" size="small" style="width: 180px;" />
          <span class="param-tip">(≥ 該月數)</span>
        </div>

        <div class="param-row">
          <span class="param-label">庫齡門檻 (天)：</span>
          <el-input-number v-model="minAge" :min="0" :max="9999" size="small" style="width: 180px;" />
          <span class="param-tip">(≥ 該天數)</span>
        </div>

        <div class="param-row">
          <span class="param-label">上限筆數：</span>
          <el-input-number v-model="limitCount" :min="1" :max="10000" size="small" style="width: 180px;" />
          <span class="param-tip">(1 ~ 10,000 筆)</span>
        </div>

        <div class="param-row">
          <span class="param-label">板數排序：</span>
          <el-select v-model="sortOrder" size="small" style="width: 180px;">
            <el-option label="由大到小 (降冪)" value="desc" />
            <el-option label="由小到大 (升冪)" value="asc" />
          </el-select>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showParamDialog = false">取消</el-button>
          <el-button type="primary" size="small" @click="applyParamSettings">套用並重新計算</el-button>
        </span>
      </template>
    </el-dialog>
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
      showParamDialog: false,
      warehouseType: '15',
      minTurnover: 0,
      minAge: 0,
      limitCount: 500,
      sortOrder: 'desc',
      selectedTier: 'all',
      currentPage: 1,
      pageSize: 500,
      totalRows: 0,
      reportTime: '',
      summary: { minTurnover: 0, minAge: 0, limitCount: 500, totalItems: 0, totalPcs: 0, totalVolume: 0, totalPallets: 0 },
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
      setTimeout(() => {
        this.fetchTurnoverData();
      }, 50);
    },
    applyParamSettings() {
      this.showParamDialog = false;
      this.handleFilterChange();
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
        minAge: this.minAge,
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
          this.\$message.error('計算失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (e) {
        this.\$message.error('連線失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },
    async exportExcel() {
      const exportList = this.exportFullData.length > 0 ? this.exportFullData : this.tableData;
      if (exportList.length === 0) return this.\$message.warning('查無資料可供匯出');
      
      this.exporting = true;
      const whName = this.warehouseType === '15' ? '15庫_自動化倉' : '80庫_人工倉';
      try {
        const wb = XLSX.utils.book_new();
        const aoa = [
          [`【摘要】${whName} 門檻設定：迴轉(月) ≥ ${this.minTurnover} | 庫齡 ≥ ${this.minAge}天 | 筆數上限 Top ${this.summary.limitCount}`],
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
        XLSX.utils.book_append_sheet(wb, ws, `${whName}_迴轉率年限清單`);
        XLSX.writeFile(wb, `${whName}_迴轉率年限清單_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.\$message.success('🎉 成功匯出迴轉率 Excel 報表！');
      } catch (e) {
        this.\$message.error('匯出 Excel 失敗：' + e.message);
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

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 10px 0;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.param-label {
  width: 120px;
  text-align: right;
  font-size: 13px;
  color: #f8fafc;
  font-weight: bold;
}

.param-tip {
  font-size: 12px;
  color: #94a3b8;
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