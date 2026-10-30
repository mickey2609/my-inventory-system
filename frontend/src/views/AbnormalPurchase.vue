<template>
  <div class="abnormal-purchase-page dark-bg">
    <!-- 1. 頂部工具列 -->
    <div class="top-bar">
      <div class="title-group">
        <span class="page-title">⚠️ 倉庫 不合理進貨追蹤與分析</span>

        <!-- 模式切換：即時分析 vs 每日快照歷史 -->
        <el-radio-group v-model="viewMode" size="small" @change="fetchAbnormalData">
          <el-radio-button label="live">⚡ 即時動態分析</el-radio-button>
          <el-radio-button label="snapshot">📸 每日歷史快照庫</el-radio-button>
        </el-radio-group>
        
        <!-- 單一日期選擇器 + 前後天快速切換 -->
        <div class="date-switch-group">
          <el-button size="mini" type="info" plain icon="el-icon-arrow-left" @click="changeDate(-1)">前一天</el-button>
          <el-date-picker
            v-model="targetDate"
            type="date"
            size="small"
            placeholder="選擇檢視日期"
            value-format="YYYY-MM-DD"
            :clearable="false"
            style="width: 140px;"
            @change="fetchAbnormalData"
          />
          <el-button size="mini" type="info" plain @click="changeDate(1)">後一天<i class="el-icon-arrow-right el-icon--right"></i></el-button>
          <el-button size="mini" type="primary" plain @click="setToday">今天</el-button>
        </div>

        <el-radio-group v-model="warehouse" size="small" @change="fetchAbnormalData">
          <el-radio-button label="all">🌐 雙庫合計</el-radio-button>
          <el-radio-button label="80">📦 80 庫</el-radio-button>
          <el-radio-button label="15">🔍 15 庫</el-radio-button>
        </el-radio-group>
      </div>

      <div class="action-group">
        <!-- 快照庫模式下一鍵補算當日快照 -->
        <el-button 
          v-if="viewMode === 'snapshot'" 
          type="danger" 
          size="small" 
          icon="el-icon-camera" 
          :loading="snapshotLoading"
          @click="triggerManualSnapshot"
        >
          📸 補結算當日快照
        </el-button>

        <!-- 每週一週報分析按鈕 -->
        <el-button type="warning" size="small" icon="el-icon-date" @click="openWeeklyReport">
          📅 每週一週報分析
        </el-button>

        <el-button type="info" size="small" icon="el-icon-refresh" :loading="loading" @click="fetchAbnormalData">
          🔄 重新整理
        </el-button>

        <el-button type="primary" size="small" icon="el-icon-setting" @click="showConfigDialog = true">
          ⚙️ 參數設定
        </el-button>

        <el-button type="success" size="small" icon="el-icon-download" @click="exportExcel">
          📊 匯出報表
        </el-button>
      </div>
    </div>

    <!-- 2. 統計 KPI 卡片區塊 -->
    <div class="metrics-grid">
      <div class="metric-card border-red">
        <div class="m-label">{{ viewMode === 'snapshot' ? '當日存檔快照總筆數' : '當日不合理進貨總筆數' }}</div>
        <div class="m-value text-red">{{ formatNumber(summary.totalCount) }} <span class="m-unit">筆</span></div>
      </div>

      <div class="metric-card border-blue">
        <div class="m-label">當日不合理驗收總 PCS</div>
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

    <!-- 3. 頂部雙層快速條件卡片 (即時模式時顯示完整篩選) -->
    <div class="filter-card-group" v-if="viewMode === 'live'">
      <!-- 🌟 1. 不合理類型：勾選方塊 -->
      <div class="filter-card">
        <span class="filter-label">📌 不合理類型：</span>
        <el-checkbox
          v-model="checkAllRules"
          :indeterminate="isRuleIndeterminate"
          class="mr-12"
          @change="handleCheckAllRulesChange"
        >
          🌐 全選 (所有不合理)
        </el-checkbox>

        <el-checkbox-group v-model="selectedRules" size="small" @change="handleRuleChange">
          <el-checkbox label="zero_sales">🚨 零銷量/高庫齡進貨</el-checkbox>
          <el-checkbox label="high_turnover">⚠️ 迴轉月數過高 (>6個月)</el-checkbox>
          <el-checkbox label="over_import">⚠️ 爆量驗收 (進貨>90日銷量2倍)</el-checkbox>
          <el-checkbox label="gift">🎁 贈品採購</el-checkbox>
        </el-checkbox-group>
      </div>

      <!-- 🌟 2. 迴轉級距篩選：勾選方塊 -->
      <div class="filter-card">
        <span class="filter-label">📊 迴轉級距篩選：</span>
        <el-checkbox
          v-model="checkAllLevels"
          :indeterminate="isLevelIndeterminate"
          class="mr-12"
          @change="handleCheckAllLevelsChange"
        >
          🌐 全部級距
        </el-checkbox>

        <el-checkbox-group v-model="selectedLevels" size="small" @change="handleLevelChange">
          <el-checkbox label="le3">🟢 &lt;=3個月</el-checkbox>
          <el-checkbox label="m3_6">🟢 3~6個月</el-checkbox>
          <el-checkbox label="m6_9">🟢 6~9個月</el-checkbox>
          <el-checkbox label="m9_12">🟢 9~12個月</el-checkbox>
          <el-checkbox label="m13_60">🟡 1年~5年 (13~60個月)</el-checkbox>
          <el-checkbox label="m61_120">🟠 5年~10年 (61~120個月)</el-checkbox>
          <el-checkbox label="gt120">🔴 10年以上 (>120個月)</el-checkbox>
          <el-checkbox label="m99999">🚨 99999 滯銷品</el-checkbox>
        </el-checkbox-group>
      </div>
    </div>

    <!-- 4. 明細表格 -->
    <div class="table-container" v-loading="loading">
      <el-table
        :data="paginatedTableData"
        border
        stripe
        size="small"
        :height="viewMode === 'live' ? 'calc(100vh - 360px)' : 'calc(100vh - 280px)'"
        class="dark-table"
        :default-sort="defaultSortConfig"
      >
        <el-table-column v-if="viewMode === 'snapshot'" prop="snapshot_date" label="快照結算日" width="105" align="center" sortable />
        <el-table-column prop="rec_date" label="驗收日期" width="105" align="center" sortable />
        <el-table-column prop="po_no" label="進貨單號 (PO)" width="150" align="center" sortable>
          <template #default="scope">
            <span class="font-bold text-orange">{{ scope.row.po_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="item_id" label="商品編號" width="160" align="center" sortable>
          <template #default="scope">
            <div class="item-link" @click="openNoteDialog(scope.row)">
              <span class="font-bold text-blue">{{ scope.row.item_id }}</span>
              <el-tag v-if="scope.row.is_gift" type="success" size="mini" effect="dark" class="ml-4">🎁 贈品</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="item_name" label="商品名稱" min-width="180" show-overflow-tooltip sortable />
        
        <el-table-column prop="import_qty" label="驗收PCS" width="95" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-blue">{{ formatNumber(scope.row.import_qty) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="current_stock_qty" label="總庫存" width="95" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-green">{{ formatNumber(scope.row.current_stock_qty) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="import_cubic_feet" label="進貨才數" width="95" align="right" sortable>
          <template #default="scope">
            <span class="font-bold text-yellow">{{ formatNumber(scope.row.import_cubic_feet) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="age" label="庫齡" width="90" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.age >= 180 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.age) }}天</span>
          </template>
        </el-table-column>

        <el-table-column prop="monthly_sales" label="月銷量" width="90" align="right" sortable>
          <template #default="scope">
            <span>{{ formatNumber(scope.row.monthly_sales) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sales_90d" label="90日銷量" width="100" align="right" sortable>
          <template #default="scope">
            <span :class="scope.row.sales_90d === 0 ? 'text-red font-bold' : ''">{{ formatNumber(scope.row.sales_90d) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="turn_days_total" label="迴轉月數" width="110" align="right" sortable>
          <template #default="scope">
            <span :class="(scope.row.turn_days_total || scope.row.turn_months) > 6 ? 'text-red font-bold' : ''">
              {{ (scope.row.turn_days_total || scope.row.turn_months) >= 99999 ? '99,999 個月' : formatNumber(scope.row.turn_days_total || scope.row.turn_months) + ' 個月' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="turnover_level" label="迴轉級距" width="170" align="center" sortable>
          <template #default="scope">
            <span :class="(scope.row.turnover_level || '').includes('99999') ? 'text-red font-bold' : 'text-purple'">
              {{ scope.row.turnover_level }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="pm" label="所屬 PM" width="95" align="center" sortable />
        <el-table-column label="不合理判定原因" min-width="190">
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

        <!-- 自訂備註欄 -->
        <el-table-column label="自訂備註" width="130" align="center">
          <template #default="scope">
            <div class="note-col">
              <span v-if="scope.row.custom_remark" class="note-text" :title="scope.row.custom_remark">{{ scope.row.custom_remark }}</span>
              <el-button size="mini" type="text" icon="el-icon-edit" @click="openNoteDialog(scope.row)">
                {{ scope.row.custom_remark || scope.row.is_gift ? '編輯' : '新增備註' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 底部分頁列 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="rawTableData.length"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 5. 點擊商品備註／贈品設定彈窗 (Modal) -->
    <el-dialog
      v-model="showNoteDialog"
      title="🎁 商品自訂備註與屬性維護"
      width="460px"
      class="custom-dark-dialog"
    >
      <div class="dialog-form-body">
        <div class="dialog-row">
          <span class="d-label">商品編號：</span>
          <span class="d-val text-blue font-bold">{{ currentNoteItem.item_id }}</span>
        </div>
        <div class="dialog-row">
          <span class="d-label">商品名稱：</span>
          <span class="d-val">{{ currentNoteItem.item_name }}</span>
        </div>
        <div class="dialog-row">
          <span class="d-label">贈品屬性：</span>
          <el-checkbox v-model="currentNoteItem.is_gift" class="gift-switch">
            標註為「🎁 贈品／行銷搭贈品」（系統自動免除零銷量與高迴轉警示）
          </el-checkbox>
        </div>
        <div class="dialog-row-col">
          <span class="d-label">人工自訂備註：</span>
          <el-input
            v-model="currentNoteItem.remark"
            type="textarea"
            :rows="3"
            placeholder="請輸入特殊備註（例如：廠商公關品、買一送一搭贈、90天促銷檔期...）"
          />
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" class="dialog-cancel-btn" @click="showNoteDialog = false">取消</el-button>
          <el-button size="small" type="primary" :loading="savingNote" @click="saveItemNote">💾 儲存並套用</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 6. 每週一週報分析視角彈窗 (Modal) -->
    <el-dialog
      v-model="showWeeklyDialog"
      title="📅 每週一 不合理進貨週報分析"
      width="820px"
      class="custom-dark-dialog"
    >
      <div v-loading="weeklyLoading" class="weekly-modal-content">
        <div class="weekly-header-bar">
          <span class="weekly-range">分析週期：{{ weeklyData.range?.startDate }} ~ {{ weeklyData.range?.endDate }} (上週全量快照)</span>
          <el-button size="mini" type="success" icon="el-icon-download" @click="exportWeeklyExcel">匯出週報 Excel</el-button>
        </div>

        <div class="weekly-summary-grid">
          <div class="w-card"><span class="w-lbl">上週不合理總單</span><span class="w-val text-red">{{ formatNumber(weeklyData.summary?.totalCount) }} 筆</span></div>
          <div class="w-card"><span class="w-lbl">上週驗收 PCS</span><span class="w-val text-blue">{{ formatNumber(weeklyData.summary?.totalPcs) }} PCS</span></div>
          <div class="w-card"><span class="w-lbl">佔用總才數</span><span class="w-val text-yellow">{{ formatNumber(weeklyData.summary?.totalCubicFeet) }} 才</span></div>
          <div class="w-card"><span class="w-lbl">涉及 PM 人數</span><span class="w-val text-purple">{{ formatNumber(weeklyData.summary?.pmCount) }} 人</span></div>
        </div>

        <div class="weekly-sub-title">📌 各 PM 採購異常分佈排行</div>
        <el-table :data="weeklyPmList" border stripe size="mini" class="dark-table" max-height="260px">
          <el-table-column prop="pm" label="所屬 PM" width="130" align="center" />
          <el-table-column prop="count" label="異常單數" width="100" align="right" sortable />
          <el-table-column prop="pcs" label="驗收總 PCS" width="130" align="right" sortable>
            <template #default="scope">{{ formatNumber(scope.row.pcs) }}</template>
          </el-table-column>
          <el-table-column prop="cubicFeet" label="進貨才數" min-width="120" align="right" sortable>
            <template #default="scope">{{ formatNumber(scope.row.cubicFeet) }} 才</template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" class="dialog-cancel-btn" @click="showWeeklyDialog = false">關閉</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 7. 參數設定 Modal 彈窗 -->
    <el-dialog
      v-model="showConfigDialog"
      title="⚙️ 不合理進貨分析 - 參數設定"
      width="480px"
      class="custom-dark-dialog"
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
          <el-button size="small" class="dialog-cancel-btn" @click="showConfigDialog = false">取消</el-button>
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

    const allRuleOptions = ['zero_sales', 'high_turnover', 'over_import', 'gift'];
    const allLevelOptions = ['le3', 'm3_6', 'm6_9', 'm9_12', 'm13_60', 'm61_120', 'gt120', 'm99999'];

    return {
      loading: false,
      snapshotLoading: false,
      debounceTimer: null,
      viewMode: 'live',
      targetDate: today,
      warehouse: 'all',

      // 不合理類型複選
      checkAllRules: true,
      isRuleIndeterminate: false,
      allRuleOptions,
      selectedRules: [...allRuleOptions],

      // 迴轉級距複選
      checkAllLevels: true,
      isLevelIndeterminate: false,
      allLevelOptions,
      selectedLevels: [...allLevelOptions],

      summary: { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 },
      rawTableData: [],
      currentPage: 1,
      pageSize: 200,

      showConfigDialog: false,
      configLimit: 10000,
      configSortProp: 'rec_date',
      configSortOrder: 'descending',

      showNoteDialog: false,
      savingNote: false,
      currentNoteItem: { item_id: '', item_name: '', is_gift: false, remark: '' },

      showWeeklyDialog: false,
      weeklyLoading: false,
      weeklyData: { range: {}, summary: {}, pmStats: {}, data: [] }
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
    },
    weeklyPmList() {
      const stats = this.weeklyData.pmStats || {};
      return Object.keys(stats).map(pm => ({
        pm,
        count: stats[pm].count,
        pcs: stats[pm].pcs,
        cubicFeet: parseFloat((stats[pm].cubicFeet || 0).toFixed(2))
      })).sort((a, b) => b.count - a.count);
    }
  },
  mounted() {
    const savedLimit = localStorage.getItem('abnormal_limit');
    if (savedLimit) this.configLimit = Number(savedLimit);

    const savedSortProp = localStorage.getItem('abnormal_sort_prop');
    if (savedSortProp) this.configSortProp = savedSortProp;

    const savedSortOrder = localStorage.getItem('abnormal_sort_order');
    if (savedSortOrder) this.configSortOrder = savedSortOrder;

    this.fetchAbnormalData();
  },
  methods: {
    formatNumber(val) {
      if (!val && val !== 0) return '0';
      return Number(val).toLocaleString();
    },

    handleSizeChange(val) { this.pageSize = val; this.currentPage = 1; },
    handleCurrentChange(val) { this.currentPage = val; },

    handleCheckAllRulesChange(val) {
      this.selectedRules = val ? [...this.allRuleOptions] : [];
      this.isRuleIndeterminate = false;
      this.fetchAbnormalData();
    },

    handleRuleChange(value) {
      const checkedCount = value.length;
      this.checkAllRules = checkedCount === this.allRuleOptions.length;
      this.isRuleIndeterminate = checkedCount > 0 && checkedCount < this.allRuleOptions.length;
      this.fetchAbnormalData();
    },

    handleCheckAllLevelsChange(val) {
      this.selectedLevels = val ? [...this.allLevelOptions] : [];
      this.isLevelIndeterminate = false;
      this.fetchAbnormalData();
    },

    handleLevelChange(value) {
      const checkedCount = value.length;
      this.checkAllLevels = checkedCount === this.allLevelOptions.length;
      this.isLevelIndeterminate = checkedCount > 0 && checkedCount < this.allLevelOptions.length;
      this.fetchAbnormalData();
    },

    changeDate(offsetDays) {
      const cur = new Date(this.targetDate || new Date());
      cur.setDate(cur.getDate() + offsetDays);
      this.targetDate = cur.toISOString().split('T')[0];
      this.fetchAbnormalData();
    },

    setToday() {
      this.targetDate = new Date().toISOString().split('T')[0];
      this.fetchAbnormalData();
    },

    saveAndApplyConfig() {
      localStorage.setItem('abnormal_limit', this.configLimit);
      localStorage.setItem('abnormal_sort_prop', this.configSortProp);
      localStorage.setItem('abnormal_sort_order', this.configSortOrder);
      this.showConfigDialog = false;
      ElMessage.success('🎉 參數設定已儲存！');
      this.fetchAbnormalData();
    },

    openNoteDialog(row) {
      this.currentNoteItem = {
        item_id: row.item_id,
        item_name: row.item_name,
        is_gift: !!row.is_gift,
        remark: row.custom_remark || ''
      };
      this.showNoteDialog = true;
    },

    async saveItemNote() {
      if (!this.currentNoteItem.item_id) return;
      this.savingNote = true;
      try {
        const res = await axios.post('/api/abnormal/save-note', {
          itemId: this.currentNoteItem.item_id,
          isGift: this.currentNoteItem.is_gift,
          remark: this.currentNoteItem.remark,
          updatedBy: '系統管理員'
        });
        if (res.data?.success) {
          ElMessage.success('🎉 商品備註與贈品屬性已成功儲存！');
          this.showNoteDialog = false;
          this.fetchAbnormalData();
        } else {
          ElMessage.error(res.data?.message || '儲存失敗');
        }
      } catch (e) {
        ElMessage.error('儲存失敗：' + e.message);
      } finally {
        this.savingNote = false;
      }
    },

    async triggerManualSnapshot() {
      if (!this.targetDate) return ElMessage.warning('請先選擇檢視日期');
      this.snapshotLoading = true;
      try {
        const res = await axios.post('/api/abnormal/generate-history-snapshot', {
          startDate: this.targetDate,
          endDate: this.targetDate
        });
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          this.fetchAbnormalData();
        } else {
          ElMessage.error(res.data?.message || '快照補結算失敗');
        }
      } catch (e) {
        ElMessage.error('連線異常: ' + e.message);
      } finally {
        this.snapshotLoading = false;
      }
    },

    async openWeeklyReport() {
      this.showWeeklyDialog = true;
      this.weeklyLoading = true;
      try {
        const res = await axios.get('/api/abnormal/weekly-summary');
        if (res.data?.success) {
          this.weeklyData = res.data;
        } else {
          ElMessage.error(res.data?.message || '週報取得失敗');
        }
      } catch (e) {
        ElMessage.error('讀取週報失敗：' + e.message);
      } finally {
        this.weeklyLoading = false;
      }
    },

    exportWeeklyExcel() {
      const list = this.weeklyData.data || [];
      if (!list.length) return ElMessage.warning('上週無不合理進貨資料可匯出');

      const rows = list.map(r => ({
        '快照結算日': r.snapshot_date,
        '驗收日期': r.rec_date,
        '進貨單號(PO)': r.po_no,
        '商品編號': r.item_id,
        '商品名稱': r.item_name,
        '驗收數量': r.import_qty,
        '進貨才數': r.import_cubic_feet,
        '快照庫存': r.stock_qty,
        '月銷量': r.monthly_sales,
        '90日銷量': r.sales_90d,
        '迴轉月數': r.turn_months,
        '迴轉級距': r.turnover_level,
        '所屬PM': r.pm,
        '供應商': r.supplier_name
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "上週不合理進貨週報");
      XLSX.writeFile(wb, `不合理進貨週報_${this.weeklyData.range?.startDate}_${this.weeklyData.range?.endDate}.xlsx`);
      ElMessage.success('🎉 成功匯出週報 Excel！');
    },

    // 🌟 加入防手抖（Debounce）機制，避免多個條件連鎖觸發連跳超時
    fetchAbnormalData() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.executeFetch();
      }, 250);
    },

    async executeFetch() {
      this.loading = true;
      try {
        const params = {
          startDate: this.targetDate,
          endDate: this.targetDate,
          warehouse: this.warehouse,
          ruleTypes: this.selectedRules.join(','),
          turnoverLevels: this.selectedLevels.join(','),
          limit: this.configLimit
        };

        const endpoint = this.viewMode === 'snapshot' ? '/api/abnormal/snapshot-list' : '/api/abnormal/list';

        const res = await axios.get(endpoint, { params, timeout: 30000 });
        if (res.data?.success) {
          this.summary = res.data.summary || { totalCount: 0, totalPcs: 0, totalCubicFeet: 0, pmCount: 0 };
          let list = res.data.data || [];

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
          ElMessage.error(res.data?.message || '讀取資料失敗');
        }
      } catch (e) {
        ElMessage.error('載入失敗：' + (e.response?.data?.message || e.message));
      } finally {
        this.loading = false;
      }
    },

    exportExcel() {
      if (!this.rawTableData.length) {
        return ElMessage.warning('無可匯出資料！');
      }

      const isSnap = this.viewMode === 'snapshot';
      const exportRows = this.rawTableData.map(r => ({
        ...(isSnap ? { '快照結算日': r.snapshot_date } : {}),
        '驗收日期': r.rec_date,
        '進貨單號(PO)': r.po_no,
        '驗收批號': r.batch_no,
        '商品編號': r.item_id,
        '商品名稱': r.item_name,
        '驗收數量(PCS)': r.import_qty,
        '快照總庫存': r.current_stock_qty,
        '進貨才數': r.import_cubic_feet,
        '最長庫齡': r.age,
        '近月銷量': r.monthly_sales,
        '近90日銷量': r.sales_90d,
        '預估迴轉月數': r.turn_days_total || r.turn_months,
        '迴轉級距': r.turnover_level,
        '所屬PM': r.pm,
        '供應商': r.supplier_name,
        '是否為贈品': r.is_gift ? '是' : '否',
        '自訂備註': r.custom_remark || '',
        '不合理判定原因': (r.tags || []).map(t => t.text).join(' | ')
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      const title = isSnap ? `不合理進貨快照_${this.targetDate}` : `不合理進貨_${this.targetDate}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, title);
      XLSX.writeFile(workbook, `${title}.xlsx`);
      ElMessage.success(`🎉 已成功匯出 ${title} Excel 報表！`);
    }
  }
}
</script>

<style scoped>
.abnormal-purchase-page { padding: 16px; height: calc(100vh - 52px); box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 8px 16px; border-radius: 8px; border: 1px solid #334155; }
.filter-card-group { display: flex; flex-direction: column; gap: 8px; }
.filter-card { display: flex; align-items: center; background: #1e293b; padding: 6px 16px; border-radius: 8px; border: 1px solid #334155; gap: 12px; flex-wrap: wrap; }
.title-group, .action-group { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 16px; font-weight: bold; color: #f87171; }
.date-switch-group { display: flex; align-items: center; gap: 6px; }
.filter-label { font-size: 13px; color: #f8fafc; font-weight: bold; }
.mr-12 { margin-right: 12px; }
:deep(.el-checkbox) { color: #f8fafc !important; font-weight: bold; }
:deep(.el-checkbox__input.is-checked + .el-checkbox__label) { color: #38bdf8 !important; }
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
.item-link { cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; }
.item-link:hover span { text-decoration: underline; color: #60a5fa; }
.note-col { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.note-text { font-size: 11px; color: #fbbf24; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-4 { margin-left: 4px; }
.text-red { color: #f87171 !important; }
.text-blue { color: #38bdf8 !important; }
.text-green { color: #4ade80 !important; }
.text-yellow { color: #fef08a !important; }
.text-orange { color: #fbbf24 !important; }
.text-purple { color: #c084fc !important; }
.font-bold { font-weight: bold; }

/* 彈窗樣式 */
.dialog-form-body { display: flex; flex-direction: column; gap: 14px; padding: 10px 0; color: #f8fafc; }
.dialog-row { display: flex; align-items: center; gap: 10px; }
.dialog-row-col { display: flex; flex-direction: column; gap: 8px; }
.d-label { width: 110px; font-weight: bold; color: #94a3b8; font-size: 13px; }
.d-val { font-size: 13px; }
.gift-switch { color: #4ade80 !important; font-weight: bold; }
.weekly-modal-content { display: flex; flex-direction: column; gap: 14px; }
.weekly-header-bar { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; }
.weekly-range { color: #38bdf8; font-weight: bold; font-size: 13px; }
.weekly-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.w-card { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
.w-lbl { font-size: 11px; color: #94a3b8; }
.w-val { font-size: 16px; font-weight: bold; }
.weekly-sub-title { font-size: 13px; font-weight: bold; color: #f8fafc; margin-top: 6px; }
</style>

<!-- 全域注入彈窗樣式：黑底白字主題，格子維持白底黑字 -->
<style>
.custom-dark-dialog {
  background-color: #1e293b !important;
  border: 1px solid #334155 !important;
  border-radius: 10px !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7) !important;
}

.custom-dark-dialog .el-dialog__header {
  background-color: #0f172a !important;
  border-bottom: 1px solid #334155 !important;
  padding: 16px 20px !important;
}

.custom-dark-dialog .el-dialog__title {
  color: #38bdf8 !important;
  font-weight: bold !important;
  font-size: 16px !important;
}

.custom-dark-dialog .el-dialog__body {
  background-color: #1e293b !important;
  color: #ffffff !important;
  padding: 20px 24px !important;
}

.custom-dark-dialog .el-dialog__footer {
  background-color: #0f172a !important;
  border-top: 1px solid #334155 !important;
  padding: 12px 20px !important;
}

.custom-dark-dialog .el-form-item__label {
  color: #ffffff !important;
  font-weight: bold !important;
}

.custom-dark-dialog .el-input__inner,
.custom-dark-dialog .el-textarea__inner,
.custom-dark-dialog .el-select .el-input__inner {
  background-color: #ffffff !important;
  color: #000000 !important;
  font-weight: bold !important;
  border: 1px solid #cbd5e1 !important;
}

.dialog-cancel-btn {
  background-color: #334155 !important;
  border-color: #475569 !important;
  color: #f1f5f9 !important;
}
.dialog-cancel-btn:hover {
  background-color: #475569 !important;
  color: #ffffff !important;
}
</style>