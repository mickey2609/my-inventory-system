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

        <!-- 🌟 新增：參數設定按鈕 -->
        <el-button type="primary" size="small" icon="el-icon-setting" @click="showConfigDialog = true">
          ⚙️ 參數設定
        </el-button>

        <el-button type="success" size="small" icon="el-icon-download" @click="exportExcel">
          📊 匯出不合理報表
        </el-button>
      </div>
    </div>

    <!-- 2. 統計 KPI 卡片區塊 -->
    <div class="metrics-grid">
      <div class="metric-card border-red">
        <div class="m-label">不合理進貨總筆數 (最多產出{{ formatNumber(configLimit) }}筆)</div>
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

    <!-- 3. 頂部雙層快速條件卡片 -->
    <div class="filter-card-group">
      <div class="filter-card">
        <span class="filter-label">📌 不合理類型：</span>
        <el-radio-group v-model="ruleType" size="small" @change="fetchAbnormalData">
          <el-radio-button label="all">🌐 全選 (所有不合理)</el-radio-button>
          <el-radio-button label="zero_sales">🚨 零銷量/高庫齡進貨</el-radio-button>
          <el-radio-button label="high_turnover">⚠️ 迴轉月數過高 (>6個月)</el-radio-button>
          <el-radio-button label="over_import">⚠️ 爆量驗收 (進貨>90日銷量2倍)</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 🌟 升級：迴轉級距細分選項 -->
      <div class="filter-card">
        <span class="filter-label">📊 迴轉級距篩選：</span>
        <el-radio-group v-model="turnoverLevelFilter" size="small" @change="fetchAbnormalData">
          <el-radio-button label="all">🌐 全部級距</el-radio-button>
          <el-radio-button label="le3">🟢 <=3個月</el-radio-button>
          <el-radio-button label="m3_6">🟢 3~6個月</el-radio-button>
          <el-radio-button label="m6_9">🟢 6~9個月</el-radio-button>
          <el-radio-button label="m9_12">🟢 9~12個月</el-radio-button>
          <el-radio-button label="m13_60">🟡 1年~5年 (13~60個月)</el-radio-button>
          <el-radio-button label="m61_120">🟠 5年~10年 (61~120個月)</el-radio-button>
          <el-radio-button label="gt120">🔴 10年以上 (>120個月)</el-radio-button>
          <el-radio-button label="m99999">🚨 99999 滯銷品</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 4. 明細表格 -->
    <div class="table-container" v-loading="loading">
      <el-table
        :data="paginatedTableData"
        border
        stripe
        size="small"
        height="calc(100vh - 350px)"
        class="dark-table"
        :default-sort="defaultSortConfig"
      >
        <el-table-column prop="rec_date" label="驗收日期" width="105" align="center" sortable />
        <el-table-column prop="po_no" label="進貨單號 (PO)" width="150" align="center" sortable>
          <template #default="scope">
            <span class="font-bold text-orange">{{ scope.row.po_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_id" label="商品編號" width="150" align="center" sortable>
          <template #default="scope">
            <span class="font-bold text-blue">{{ scope.row.item_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_name" label="商品名稱" min-width="200" show-overflow-tooltip sortable />
        
        <el-table-column prop="import_qty" label="驗收PCS" width="95" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-blue">{{ formatNumber(scope.row.import_qty) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="current_stock_qty" label="總庫存數" width="100" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-green">{{ formatNumber(scope.row.current_stock_qty) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="import_cubic_feet" label="進貨才數" width="95" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-yellow">{{ formatNumber(scope.row.import_cubic_feet) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="age" label="最長庫齡" width="100" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.age >= 180 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.age) }}天</span>
          </template>
        </el-table-column>

        <el-table-column prop="monthly_sales" label="近月銷量" width="95" align="right" sortable>
          <template #default="scope">
            <span>{{ formatNumber(scope.row.monthly_sales) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sales_90d" label="近90日銷量" width="105" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.sales_90d === 0 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.sales_90d) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="turn_days_total" label="迴轉月數" width="110" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.turn_days_total > 6 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.turn_days_total) }} 個月</span>
          </template>
        </el-table-column>

        <el-table-column prop="turnover_level" label="迴轉級距" width="180" align="center" sortable>
          <template #default="scope">
            <span :class="scope.row.turnover_level.includes('99999') ? 'text-red font-bold' : 'text-purple'">
              {{ scope.row.turnover_level }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="pm" label="所屬 PM" width="95" align="center" sortable />
        <el-table-column label="不合理判定原因" min-width="200">
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
      </el-table>

      <!-- 底部分頁列 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[100, 200, 500, 1000]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="rawTableData.length"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 🌟 新增：參數設定 Modal 彈窗 -->
    <el-dialog
      v-model="showConfigDialog"
      title="⚙️ 不合理進貨分析 - 參數設定"
      width="480px"
      custom-class="dark-dialog"
    >
      <el-form label-width="140px" size="small">
        <el-form-item label="📊 抓取資料筆數上限">
          <el-select v-model="configLimit" style="width: 100%;">
            <el-option :value="1000" label="1,000 筆 (極速)" />
            <el-option :value="5000" label="5,000 筆" />
            <el-option :value="10000" label="10,000 筆 (預設)" />
            <el-option :value="30000" label="30,000 筆 (全量分析)" />
          </el-select>
        </el-form-item>

        <el-form-item label="🔀 預設優先排序欄位">
          <el-select v-model="configSortProp" style="width: 100%;">
            <el-option value="rec_date" label="📅 驗收日期" />
            <el-option value="turn_days_total" label="📈 迴轉月數" />
            <el-option value="import_qty" label="📦 驗收 PCS" />
            <el-option value="import_cubic_feet" label="📐 進貨才數" />
            <el-option value="sales_90d" label="📊 近90日銷量" />
            <el-option value="age" label="⏳ 最長庫齡" />
          </el-select>
        </el-form-item>

        <el-form-item label="🔽 排序順序">
          <el-radio-group v-model="configSortOrder">
            <el-radio label="descending">🔻 降序 (大到小 / 最新到最舊)</el-radio>
            <el-radio label="ascending">🔺 升序 (小到大 / 最舊到最新)</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showConfigDialog = false">取消</el-button>
          <el-button size="small" type="primary" @click="saveAndApplyConfig">💾 儲存並重新載入</el-button>
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
  name: 'AbnormalPurchase',
  data() {
    const today = new Date().toISOString().split('T')[0];
    const past30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    return {
      loading: false,
      dateRange: [past30, today],
      warehouse: 'all',
      ruleType: 'all',
      turnoverLevelFilter: 'all',
      summary: { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 },
      rawTableData: [],
      currentPage: 1,
      pageSize: 500,

      // 🌟 參數設定選單變數
      showConfigDialog: false,
      configLimit: 10000,
      configSortProp: 'rec_date',
      configSortOrder: 'descending'
    }
  },
  computed: {
    paginatedTableData() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.rawTableData.slice(start, end);
    },
    defaultSortConfig() {
      return { prop: this.configSortProp, order: this.configSortOrder };
    }
  },
  mounted() {
    const savedLimit = localStorage.getItem('abnormal_limit');
    if (savedLimit) this.configLimit = Number(savedLimit);

    const savedSortProp = localStorage.getItem('abnormal_sort_prop');
    if (savedSortProp) this.configSortProp = savedSortProp;

    const savedSortOrder = localStorage.getItem('abnormal_sort_order');
    if (savedSortOrder) this.configSortOrder = savedSortOrder;

    this.\$nextTick(() => { this.fetchAbnormalData(); });
  },
  methods: {
    formatNumber(val) {
      if (!val && val !== 0) return '0';
      return Number(val).toLocaleString();
    },

    handleSizeChange(val) { this.pageSize = val; this.currentPage = 1; },
    handleCurrentChange(val) { this.currentPage = val; },

    saveAndApplyConfig() {
      localStorage.setItem('abnormal_limit', this.configLimit);
      localStorage.setItem('abnormal_sort_prop', this.configSortProp);
      localStorage.setItem('abnormal_sort_order', this.configSortOrder);
      this.showConfigDialog = false;
      ElMessage.success('🎉 參數設定已儲存！');
      this.fetchAbnormalData();
    },

    async fetchAbnormalData() {
      this.loading = true;
      try {
        let startDate = '';
        let endDate = '';

        if (Array.isArray(this.dateRange) && this.dateRange.length === 2) {
          startDate = this.dateRange[0] || '';
          endDate = this.dateRange[1] || '';
        }

        const params = {
          startDate,
          endDate,
          warehouse: this.warehouse,
          ruleType: this.ruleType,
          turnoverLevel: this.turnoverLevelFilter,
          limit: this.configLimit // 🌟 傳送抓取上限筆數
        };

        const res = await axios.get('/api/abnormal/list', { params, timeout: 25000 });
        if (res.data?.success) {
          this.summary = res.data.summary || { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 };
          let list = res.data.data || [];

          // 🌟 前端依據設定實施預設排序
          const prop = this.configSortProp;
          const isAsc = this.configSortOrder === 'ascending';
          list.sort((a, b) => {
            let valA = a[prop] || 0;
            let valB = b[prop] || 0;
            if (typeof valA === 'string') {
              return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return isAsc ? (valA - valB) : (valB - valA);
          });

          this.rawTableData = list;
          this.currentPage = 1;
        } else {
          ElMessage.error(res.data?.message || '讀取不合理進貨失敗');
        }
      } catch (e) {
        ElMessage.error('載入失敗：' + (e.response?.data?.message || e.message));
      } finally {
        this.loading = false;
      }
    },

    exportExcel() {
      if (!this.rawTableData.length) {
        return ElMessage.warning('無可匯出的不合理資料！');
      }

      const exportRows = this.rawTableData.map(r => ({
        '驗收日期': r.rec_date,
        '進貨單號(PO)': r.po_no,
        '驗收批號': r.batch_no,
        '商品編號': r.item_id,
        '商品名稱': r.item_name,
        '驗收數量(PCS)': r.import_qty,
        '總庫存數': r.current_stock_qty,
        '進貨才數': r.import_cubic_feet,
        '最長庫齡': r.age,
        '近月銷量': r.monthly_sales,
        '近90日銷量': r.sales_90d,
        '預估迴轉月數': r.turn_days_total,
        '迴轉級距': r.turnover_level,
        '所屬PM': r.pm,
        '供應商': r.supplier_name,
        '不合理判定原因': (r.tags || []).map(t => t.text).join(' | ')
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "不合理進貨清單");
      XLSX.writeFile(workbook, `不合理進貨分析_${new Date().getTime()}.xlsx`);
      ElMessage.success('🎉 已成功匯出全量不合理進貨分析 Excel 報表！');
    }
  }
}
</script>

<style scoped>
.abnormal-purchase-page { padding: 16px; height: calc(100vh - 52px); box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 8px 16px; border-radius: 8px; border: 1px solid #334155; }
.filter-card-group { display: flex; flex-direction: column; gap: 8px; }
.filter-card { display: flex; align-items: center; background: #1e293b; padding: 6px 16px; border-radius: 8px; border: 1px solid #334155; gap: 12px; }
.title-group, .action-group { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 16px; font-weight: bold; color: #f87171; }
.filter-label { font-size: 13px; color: #f8fafc; font-weight: bold; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.metric-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
.border-red { border-left: 4px solid #ef4444 !important; }
.border-blue { border-left: 4px solid #38bdf8 !important; }
.border-yellow { border-left: 4px solid #fef08a !important; }
.border-purple { border-left: 4px solid #c084fc !important; }
.m-label { font-size: 12px; color: #94a3b8; }
.m-value { font-size: 20px; font-weight: bold; }
.m-unit { font-size: 12px; font-weight: normal; color: #cbd5e1; }
.table-container { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; flex: 1; display: flex; flex-direction: column; }
.pagination-bar { display: flex; justify-content: flex-end; padding-top: 10px; background: #1e293b; }
:deep(.dark-table) { background-color: #1e293b !important; color: #f8fafc !important; }
:deep(.dark-table th.el-table__cell) { background-color: #0f172a !important; color: #38bdf8 !important; border-bottom: 1px solid #334155 !important; }
:deep(.dark-table td.el-table__cell) { background-color: #1e293b !important; color: #f8fafc !important; border-bottom: 1px solid #334155 !important; }
.tag-group { display: flex; flex-wrap: wrap; gap: 4px; }
.text-red { color: #f87171 !important; }
.text-blue { color: #38bdf8 !important; }
.text-green { color: #4ade80 !important; }
.text-yellow { color: #fef08a !important; }
.text-orange { color: #fbbf24 !important; }
.text-purple { color: #c084fc !important; }
.font-bold { font-weight: bold; }
</style>