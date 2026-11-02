<template>
  <div class="turnover-page dark-bg">
    <!-- 頂部操作與篩選列 -->
    <div class="top-filter-bar">
      <div class="title-group">
        <span class="page-title">📈 迴轉率分析清單</span>
        
        <!-- 雙庫切換 -->
        <el-radio-group v-model="warehouseType" size="small" @change="handleFilterChange">
          <el-radio-button label="15">📦 15庫 (自動化倉)</el-radio-button>
          <el-radio-button label="80">🔍 80庫 (人工倉)</el-radio-button>
          <el-radio-button label="all">🔄 雙庫合併 (15+80)</el-radio-button>
        </el-radio-group>

        <span class="report-time">報表產出時間：{{ reportTime }}</span>
      </div>

      <div class="controls-group">
        <el-button 
          v-if="isSysAdmin"
          type="warning" 
          size="small" 
          icon="el-icon-setting" 
          @click="showParamDialog = true"
        >
          ⚙️ 進階參數 (Top {{ limitCount }})
        </el-button>

        <el-button 
          type="primary" 
          size="small" 
          icon="el-icon-search" 
          :loading="loading"
          @click="handleFilterChange"
        >
          查詢
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

    <!-- 級距勾選與快篩列 -->
    <div class="quick-filter-bar">
      <div class="tier-checkbox-group">
        <span class="filter-lbl">級距篩選：</span>
        <el-checkbox 
          v-model="checkAllTiers" 
          :indeterminate="isIndeterminate" 
          @change="handleCheckAllChange"
          class="dark-chk"
        >
          🌐 全部級距
        </el-checkbox>
        <el-checkbox-group v-model="selectedTiers" @change="handleTierGroupChange" class="tier-chk-inner">
          <el-checkbox label="y_under_1" class="dark-chk">1 年以下</el-checkbox>
          <el-checkbox label="y_1_5" class="dark-chk">1 年 ~ 5 年</el-checkbox>
          <el-checkbox label="y_5_10" class="dark-chk">5 年 ~ 10 年</el-checkbox>
          <el-checkbox label="y_over_10" class="dark-chk">10 年以上</el-checkbox>
          <el-checkbox label="y99999" class="dark-chk text-red">🚨 滯銷 99999</el-checkbox>
        </el-checkbox-group>
      </div>

      <!-- 右側門檻與過濾控制項 -->
      <div class="inputs-inline-group">
        <el-checkbox v-model="excludeGifts" class="dark-chk text-yellow" @change="handleFilterChange">
          🚫 排除贈品
        </el-checkbox>

        <div class="inline-item">
          <span class="inline-lbl">庫齡 ≥</span>
          <el-input-number v-model="minAge" :min="0" :max="99999" size="mini" controls-position="right" style="width: 85px;" @change="handleFilterChange" />
          <span class="unit-lbl">天</span>
        </div>

        <div class="inline-item">
          <span class="inline-lbl">迴轉 ≥</span>
          <el-input-number v-model="minTurnover" :min="0" :max="99999" size="mini" controls-position="right" style="width: 85px;" @change="handleFilterChange" />
          <span class="unit-lbl">月</span>
        </div>

        <div class="inline-item">
          <span class="inline-lbl">月銷</span>
          <el-input-number v-model="minMonthlySales" :min="0" placeholder="下限" size="mini" controls-position="right" style="width: 75px;" @change="handleFilterChange" />
          <span class="split-lbl">~</span>
          <el-input-number v-model="maxMonthlySales" :min="0" placeholder="上限" size="mini" controls-position="right" style="width: 75px;" @change="handleFilterChange" />
        </div>

        <div class="inline-item">
          <span class="inline-lbl">板數 ≥</span>
          <el-input-number v-model="minPallets" :min="0" size="mini" controls-position="right" style="width: 80px;" @change="handleFilterChange" />
        </div>
      </div>
    </div>

    <!-- 總計摘要面板 -->
    <div class="summary-overview-card" v-loading="loading">
      <div class="summary-header">
        【摘要】{{ warehouseLabel }} 門檻：迴轉(月) ≥ {{ minTurnover }} | 庫齡 ≥ {{ minAge }} 天 | 
        <span v-if="minMonthlySales !== null || maxMonthlySales !== null">
          月銷量：{{ minMonthlySales !== null ? '≥ ' + minMonthlySales : '' }} {{ (minMonthlySales !== null && maxMonthlySales !== null) ? '且' : '' }} {{ maxMonthlySales !== null ? '≤ ' + maxMonthlySales : '' }} | 
        </span>
        <span v-if="minPallets > 0">板數 ≥ {{ minPallets }} | </span>
        <span v-if="excludeGifts" class="text-orange">[已排除贈品] | </span>
        筆數 Top {{ summary.limitCount || limitCount }}
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

    <!-- 數據表格 -->
    <div class="data-table-card" v-loading="loading">
      <el-table 
        :data="tableData" 
        border 
        stripe 
        size="mini" 
        class="dark-table"
        height="calc(100vh - 430px)"
      >
        <!-- 商品ID (點選可開啟標記) -->
        <el-table-column prop="item_id" label="商品ID" width="180" fixed="left" sortable>
          <template #default="scope">
            <span class="font-bold text-blue clickable-link" @click="openQuickTagModal(scope.row)">
              {{ scope.row.item_id }} 🏷️
            </span>
          </template>
        </el-table-column>

        <!-- 商品屬性 -->
        <el-table-column prop="item_tag" label="商品屬性" width="115" align="center" sortable>
          <template #default="scope">
            <el-select 
              v-model="scope.row.item_tag" 
              size="mini" 
              class="tag-select"
              :class="getTagClass(scope.row.item_tag)"
              @change="saveItemAttr(scope.row)"
            >
              <el-option label="📦 主商品" value="主商品" />
              <el-option label="🎁 贈品" value="贈品" />
              <el-option label="🏷️ 樣品" value="樣品" />
              <el-option label="📦 耗材" value="耗材" />
            </el-select>
          </template>
        </el-table-column>

        <!-- 自訂備註 -->
        <el-table-column prop="remark" label="自訂備註" min-width="150" show-overflow-tooltip>
          <template #default="scope">
            <el-input 
              v-model="scope.row.remark" 
              size="mini" 
              placeholder="備註..." 
              @blur="saveItemAttr(scope.row)"
              @keyup.enter.native="$event.target.blur()"
            />
          </template>
        </el-table-column>

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

      <!-- 分頁列 -->
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

    <!-- 點選商品 ID 快速標記 Modal -->
    <el-dialog 
      v-model="showQuickTagModal" 
      title="🏷️ 商品屬性與備註標記" 
      width="460px"
      append-to-body
      class="custom-turnover-dialog"
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
          <el-button size="small" class="dialog-cancel-btn" @click="showQuickTagModal = false">取消</el-button>
          <el-button type="primary" size="small" @click="saveModalTag">💾 儲存標記</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 進階參數 Dialog -->
    <el-dialog 
      v-model="showParamDialog" 
      title="⚙️ 迴轉率進階參數設定" 
      width="460px"
      class="custom-turnover-dialog"
    >
      <div class="dialog-body">
        <div class="param-row">
          <span class="param-label">上限筆數：</span>
          <el-input-number v-model="limitCount" :min="1" :max="10000" size="small" style="width: 180px;" />
          <span class="param-tip">(1 ~ 10,000 筆)</span>
        </div>

        <div class="param-row">
          <span class="param-label">資料排序欄位：</span>
          <el-select v-model="sortBy" size="small" style="width: 120px;">
            <el-option label="依板數" value="pallets" />
            <el-option label="依月銷量" value="monthly_sales" />
            <el-option label="依庫齡" value="max_age" />
            <el-option label="依總才數" value="total_cubic_feet" />
            <el-option label="依加總庫存" value="total_qty" />
          </el-select>
          <el-select v-model="sortOrder" size="small" style="width: 100px;">
            <el-option label="降冪 (大到小)" value="desc" />
            <el-option label="升冪 (小到大)" value="asc" />
          </el-select>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" class="dialog-cancel-btn" @click="showParamDialog = false">取消</el-button>
          <el-button type="primary" size="small" @click="applyParamSettings">套用並重新計算</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import * as XLSX from 'xlsx'
import { ElMessage } from 'element-plus'

const ALL_TIER_KEYS = ['y_under_1', 'y_1_5', 'y_5_10', 'y_over_10', 'y99999'];

export default {
  name: 'TurnoverList',
  props: {
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      exporting: false,
      showParamDialog: false,
      warehouseType: '15',
      minTurnover: 0,
      minAge: 0,
      minMonthlySales: null,
      maxMonthlySales: null,
      minPallets: 0,
      limitCount: 500,
      sortBy: 'pallets',
      sortOrder: 'desc',
      excludeGifts: false,

      checkAllTiers: true,
      isIndeterminate: false,
      selectedTiers: [...ALL_TIER_KEYS],

      currentPage: 1,
      pageSize: 500,
      totalRows: 0,
      reportTime: '',
      summary: { minTurnover: 0, minAge: 0, limitCount: 500, totalItems: 0, totalPcs: 0, totalVolume: 0, totalPallets: 0 },
      tiers: [],
      tableData: [],
      exportFullData: [],

      showQuickTagModal: false,
      activeItem: null,
      modalTag: '主商品',
      modalRemark: '',
      attrMap: {}
    }
  },
  computed: {
    warehouseLabel() {
      if (this.warehouseType === '15') return '15庫 (自動化倉)';
      if (this.warehouseType === '80') return '80庫 (人工倉)';
      return '雙庫合併 (15+80)';
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
    getTagClass(tag) {
      if (tag === '贈品') return 'tag-gift';
      if (tag === '樣品') return 'tag-sample';
      if (tag === '耗材') return 'tag-consumable';
      return '';
    },
    handleCheckAllChange(val) {
      this.selectedTiers = val ? [...ALL_TIER_KEYS] : [];
      this.isIndeterminate = false;
      this.handleFilterChange();
    },
    handleTierGroupChange(value) {
      const checkedCount = value.length;
      this.checkAllTiers = checkedCount === ALL_TIER_KEYS.length;
      this.isIndeterminate = checkedCount > 0 && checkedCount < ALL_TIER_KEYS.length;
      this.handleFilterChange();
    },
    handleFilterChange() {
      this.currentPage = 1;
      this.$nextTick(() => {
        this.fetchTurnoverData();
      });
    },
    applyParamSettings() {
      this.showParamDialog = false;
      this.handleFilterChange();
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.fetchTurnoverData();
    },
    getItemTierKey(item) {
      const t = Number(item.turnover_month);
      if (t === 99999) return 'y99999';
      if (t <= 12) return 'y_under_1';
      if (t > 12 && t <= 60) return 'y_1_5';
      if (t > 60 && t <= 120) return 'y_5_10';
      if (t > 120) return 'y_over_10';
      return 'y_under_1';
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
          this.attrMap[this.activeItem.item_id] = { item_tag: this.modalTag, remark: this.modalRemark };
          ElMessage.success(res.data.message);
          this.showQuickTagModal = false;
        }
      } catch (e) {
        ElMessage.error('儲存失敗：' + (e.response?.data?.message || e.message));
      }
    },

    async saveItemAttr(row) {
      try {
        const res = await axios.post('/api/item-sales-history/update-tag-remark', {
          item_id: row.item_id,
          item_tag: row.item_tag,
          remark: row.remark
        });
        if (res.data?.success) {
          this.attrMap[row.item_id] = { item_tag: row.item_tag, remark: row.remark };
          ElMessage.success(res.data.message);
        }
      } catch (e) {
        ElMessage.error('儲存失敗：' + (e.response?.data?.message || e.message));
      }
    },

    async fetchTurnoverData() {
      this.loading = true;
      this.updateReportTime();

      try {
        // 先拉取最新的標籤與備註對照表
        const attrRes = await axios.get('/api/item-sales-history/list?pageSize=50000').catch(() => null);
        if (attrRes?.data?.success && attrRes.data.data) {
          const m = {};
          attrRes.data.data.forEach(r => {
            m[r.item_id] = { item_tag: r.item_tag || '主商品', remark: r.remark || '' };
          });
          this.attrMap = m;
        }

        let rawList = [];
        let exportList = [];

        if (this.warehouseType === 'all') {
          const p15 = new URLSearchParams({ minTurnover: this.minTurnover, minAge: this.minAge, limit: this.limitCount, sortOrder: this.sortOrder });
          const p80 = new URLSearchParams({ minTurnover: this.minTurnover, minAge: this.minAge, limit: this.limitCount, sortOrder: this.sortOrder });

          const [res15, res80] = await Promise.all([
            axios.get(`/api/turnover15/search?${p15.toString()}`).catch(() => ({ data: { success: false } })),
            axios.get(`/api/turnover80/search?${p80.toString()}`).catch(() => ({ data: { success: false } }))
          ]);

          const list15 = (res15.data?.success && res15.data.data) ? res15.data.data : [];
          const list80 = (res80.data?.success && res80.data.data) ? res80.data.data : [];

          const mergedMap = new Map();
          [...list15, ...list80].forEach(item => {
            if (!mergedMap.has(item.item_id)) {
              mergedMap.set(item.item_id, { ...item });
            } else {
              const cur = mergedMap.get(item.item_id);
              cur.total_qty = (Number(cur.total_qty) || 0) + (Number(item.total_qty) || 0);
              cur.total_cubic_feet = parseFloat(((Number(cur.total_cubic_feet) || 0) + (Number(item.total_cubic_feet) || 0)).toFixed(2));
              cur.pallets = parseFloat(((Number(cur.pallets) || 0) + (Number(item.pallets) || 0)).toFixed(2));
              cur.max_age = Math.max(Number(cur.max_age) || 0, Number(item.max_age) || 0);
              cur.monthly_sales = Math.max(Number(cur.monthly_sales) || 0, Number(item.monthly_sales) || 0);
            }
          });

          rawList = Array.from(mergedMap.values());
          exportList = rawList;
        } else {
          const apiEndpoint = this.warehouseType === '80' ? '/api/turnover80/search' : '/api/turnover15/search';
          const params = new URLSearchParams({
            minTurnover: this.minTurnover,
            minAge: this.minAge,
            limit: this.limitCount,
            sortOrder: this.sortOrder,
            tier: 'all',
            page: 1,
            pageSize: 10000
          });

          const res = await axios.get(`${apiEndpoint}?${params.toString()}`);
          if (res.data?.success) {
            rawList = res.data.data || [];
            exportList = res.data.exportData || rawList;
          }
        }

        // 綁定最新屬性與備註
        rawList.forEach(item => {
          const meta = this.attrMap[item.item_id];
          item.item_tag = meta ? meta.item_tag : '主商品';
          item.remark = meta ? meta.remark : '';
        });

        // 條件篩選
        const filterFn = (item) => {
          const age = Number(item.max_age) || 0;
          const sales = Number(item.monthly_sales) || 0;
          const pallets = Number(item.pallets) || 0;

          if (this.excludeGifts && item.item_tag === '贈品') return false;
          if (this.minAge > 0 && age < this.minAge) return false;
          if (this.minTurnover > 0 && Number(item.turnover_month) < this.minTurnover) return false;
          if (this.minMonthlySales !== null && sales < this.minMonthlySales) return false;
          if (this.maxMonthlySales !== null && sales > this.maxMonthlySales) return false;
          if (this.minPallets > 0 && pallets < this.minPallets) return false;

          const tKey = this.getItemTierKey(item);
          if (!this.selectedTiers.includes(tKey)) return false;

          return true;
        };

        const filtered = rawList.filter(filterFn);

        filtered.sort((a, b) => {
          const valA = Number(a[this.sortBy]) || 0;
          const valB = Number(b[this.sortBy]) || 0;
          return this.sortOrder === 'asc' ? valA - valB : valB - valA;
        });

        const limitedRows = filtered.slice(0, this.limitCount);
        this.tableData = limitedRows;
        this.exportFullData = exportList.filter(filterFn).slice(0, this.limitCount);
        this.totalRows = limitedRows.length;

        this.recalculateSummaryAndTiers(limitedRows);

      } catch (e) {
        ElMessage.error('資料載入失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    recalculateSummaryAndTiers(rows) {
      let totalPcs = 0;
      let totalVol = 0;
      let totalPallets = 0;

      const tierMap = {
        y_under_1: { label: '1 年以下 (<=12個月)', items: 0, pcs: 0, vol: 0, pallets: 0, key: 'y_under_1' },
        y_1_5: { label: '1 年 ~ 5 年 (13~60個月)', items: 0, pcs: 0, vol: 0, pallets: 0, key: 'y_1_5' },
        y_5_10: { label: '5 年 ~ 10 年 (61~120個月)', items: 0, pcs: 0, vol: 0, pallets: 0, key: 'y_5_10' },
        y_over_10: { label: '10 年以上 (>120個月)', items: 0, pcs: 0, vol: 0, pallets: 0, key: 'y_over_10' },
        y99999: { label: '🚨 99999 滯銷品', items: 0, pcs: 0, vol: 0, pallets: 0, key: 'y99999' }
      };

      rows.forEach(r => {
        const pcs = Number(r.total_qty) || 0;
        const vol = Number(r.total_cubic_feet) || 0;
        const pal = Number(r.pallets) || 0;

        totalPcs += pcs;
        totalVol += vol;
        totalPallets += pal;

        const k = this.getItemTierKey(r);
        if (tierMap[k]) {
          tierMap[k].items += 1;
          tierMap[k].pcs += pcs;
          tierMap[k].vol += vol;
          tierMap[k].pallets += pal;
        }
      });

      this.summary = {
        minTurnover: this.minTurnover,
        minAge: this.minAge,
        limitCount: this.limitCount,
        totalItems: rows.length,
        totalPcs,
        totalVolume: parseFloat(totalVol.toFixed(2)),
        totalPallets: parseFloat(totalPallets.toFixed(2))
      };

      this.tiers = Object.values(tierMap);
    },

    async exportExcel() {
      const exportList = this.exportFullData.length > 0 ? this.exportFullData : this.tableData;
      if (exportList.length === 0) return ElMessage.warning('查無資料可供匯出');
      
      this.exporting = true;
      const whName = this.warehouseLabel.replace(/\s+/g, '_');
      try {
        const wb = XLSX.utils.book_new();
        const aoa = [
          [`【摘要】${whName} 門檻設定：迴轉(月) ≥ ${this.minTurnover} | 庫齡 ≥ ${this.minAge}天 | 月銷量：${this.minMonthlySales ?? '無'} ~ ${this.maxMonthlySales ?? '無'} | 板數 ≥ ${this.minPallets} | 筆數上限 Top ${this.limitCount}`],
          [`品項數總計：`, this.summary.totalItems, `PCS數總計：`, this.summary.totalPcs, `總才數總計：`, this.summary.totalVolume, `總板數總計：`, this.summary.totalPallets],
          [],
          ['級距門檻', '品項數', 'PCS 數', '才數', '板數']
        ];

        this.tiers.forEach(t => {
          aoa.push([t.label, t.items, t.pcs, t.vol, t.pallets]);
        });

        aoa.push([]);
        aoa.push(['商品ID', '商品屬性', '自訂備註', '商品名稱', '借/採', '加總庫存數', '最長庫齡', '區編', '區名', '總才數', '迴轉(月)', '月銷量', '板數']);

        exportList.forEach(r => {
          aoa.push([
            r.item_id, r.item_tag || '主商品', r.remark || '', r.item_name, r.borrow_proc, r.total_qty, r.max_age,
            r.zone_id, r.zone_name, r.total_cubic_feet, r.turnover_month, r.monthly_sales, r.pallets
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, `${whName}_迴轉率年限清單`);
        XLSX.writeFile(wb, `${whName}_迴轉率年限清單_${new Date().toISOString().split('T')[0]}.xlsx`);
        ElMessage.success('🎉 成功匯出迴轉率 Excel 報表！');
      } catch (e) {
        ElMessage.error('匯出 Excel 失敗：' + e.message);
      } finally {
        this.exporting = false;
      }
    }
  }
}
</script>

<style scoped>
.turnover-page { padding: 12px 16px; height: calc(100vh - 52px); box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.top-filter-bar { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 16px; flex-shrink: 0; }
.title-group { display: flex; align-items: center; gap: 14px; }
.page-title { font-size: 15px; font-weight: bold; color: #38bdf8; }
.report-time { font-size: 12px; color: #94a3b8; }
.controls-group { display: flex; align-items: center; gap: 10px; }

.quick-filter-bar { display: flex; justify-content: space-between; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 6px 14px; flex-shrink: 0; gap: 12px; flex-wrap: wrap; }
.tier-checkbox-group { display: flex; align-items: center; gap: 10px; }
.filter-lbl { font-size: 12px; font-weight: bold; color: #38bdf8; }
.tier-chk-inner { display: flex; align-items: center; gap: 12px; }

:deep(.dark-chk .el-checkbox__label) { color: #cbd5e1 !important; font-size: 12px; }
:deep(.dark-chk.is-checked .el-checkbox__label) { color: #38bdf8 !important; font-weight: bold; }
:deep(.dark-chk.text-red.is-checked .el-checkbox__label) { color: #f43f5e !important; }
:deep(.dark-chk.text-yellow.is-checked .el-checkbox__label) { color: #fbbf24 !important; }

.inputs-inline-group { display: flex; align-items: center; gap: 12px; }
.inline-item { display: flex; align-items: center; gap: 4px; background: #1e293b; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155; }
.inline-lbl { font-size: 12px; color: #94a3b8; font-weight: bold; white-space: nowrap; }
.unit-lbl, .split-lbl { font-size: 11px; color: #64748b; }

.summary-overview-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 14px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.summary-header { background: #312e81; color: #c7d2fe; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.summary-totals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.total-box { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 4px 10px; display: flex; flex-direction: column; }
.total-box .lbl { font-size: 11px; color: #94a3b8; }
.total-box .val { font-size: 15px; font-weight: bold; margin-top: 1px; }

.tier-table-wrapper { overflow-x: auto; }
.tier-table { width: 100%; border-collapse: collapse; font-size: 12px; background: #0f172a; }
.tier-table th, .tier-table td { border: 1px solid #334155; padding: 4px 8px; }
.tier-table th { background: #1e293b; color: #38bdf8; font-weight: bold; text-align: center; }
.tier-table tr.highlight-滞銷 td { background: rgba(244, 63, 94, 0.1); color: #f43f5e; }

.text-right { text-align: right; }
.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.text-cyan { color: #22d3ee; }
.text-red { color: #f43f5e !important; }
.font-bold { font-weight: bold; }

.clickable-link { cursor: pointer; text-decoration: underline; transition: all 0.2s; }
.clickable-link:hover { color: #38bdf8 !important; text-shadow: 0 0 4px rgba(56, 189, 248, 0.5); }

:deep(.tag-gift .el-input__inner) { background-color: rgba(244, 63, 94, 0.2) !important; color: #f43f5e !important; font-weight: bold; border-color: #f43f5e !important; }
:deep(.tag-sample .el-input__inner) { background-color: rgba(234, 179, 8, 0.2) !important; color: #eab308 !important; font-weight: bold; }
:deep(.tag-consumable .el-input__inner) { background-color: rgba(148, 163, 184, 0.2) !important; color: #94a3b8 !important; }

.tag-stagnant { background: #f43f5e; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.data-