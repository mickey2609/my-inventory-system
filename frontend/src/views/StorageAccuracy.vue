<!-- frontend/src/views/StorageAccuracy.vue -->
<template>
  <div class="storage-accuracy-page">
    <input
      type="file"
      ref="csvInput"
      style="display: none;"
      accept=".csv"
      @change="handleCsvUpload"
    />

    <!-- 頂部控制列 -->
    <div class="header-card">
      <div class="header-left">
        <h3 class="page-title">📍 80庫儲位擺放準確率稽核系統</h3>
        <div class="sub-tabs">
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'dashboard' }"
            @click="activeTab = 'dashboard'"
          >
            📊 準確率儀表板與異常清單
          </button>
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            ⚙️ 儲位規則線上設定 ({{ rules.length }} 區段)
          </button>
        </div>
      </div>

      <div class="header-right">
        <span v-if="uploadProgressText" class="upload-status-pill">{{ uploadProgressText }}</span>
        <el-button size="mini" type="success" icon="el-icon-upload2" :loading="uploading" @click="triggerCsvInput">
          上傳 80庫 CSV 快照
        </el-button>
        <el-button size="mini" type="primary" icon="el-icon-refresh" @click="refreshAll">
          重新計算準確率
        </el-button>
      </div>
    </div>

    <!-- ==================== TAB 1: 準確率儀表板與異常清單 ==================== -->
    <div v-if="activeTab === 'dashboard'" class="tab-content" v-loading="loading">
      <!-- 頂部 5 大 KPI 卡片 -->
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="kpi-lbl">📦 總庫存儲位筆數</div>
          <div class="kpi-num text-blue">{{ report.summary.total.toLocaleString() }}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-lbl">🔍 納入規則稽核筆數</div>
          <div class="kpi-num text-purple">{{ report.summary.audited.toLocaleString() }}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-lbl">✅ 擺放合格筆數</div>
          <div class="kpi-num text-green">{{ report.summary.passed.toLocaleString() }}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-lbl">⚠️ 擺放異常筆數</div>
          <div class="kpi-num text-red">{{ report.summary.failed.toLocaleString() }}</div>
        </div>
        <div class="kpi-box highlight-kpi">
          <div class="kpi-lbl">🎯 全庫擺放準確率</div>
          <div class="kpi-num" :class="report.summary.accuracyPct >= 95 ? 'text-green' : 'text-yellow'">
            {{ report.summary.accuracyPct }}%
          </div>
        </div>
      </div>

      <!-- 尚未上傳資料時的引導提示 -->
      <div v-if="!report.hasData" class="empty-guide-card">
        <h4>尚未匯入 80 庫庫存快照資料</h4>
        <p>請先到「⚙️ 儲位規則線上設定」設定各區的 <strong>借/採</strong> 與 <strong>允許大區</strong>，再點擊右上角 <strong>「上傳 80庫 CSV 快照」</strong> 即可秒算擺放準確率！</p>
      </div>

      <template v-else>
        <!-- 三欄維度分析：借 vs 採 / 各樓層 / 各大區 -->
        <div class="breakdown-grid">
          <!-- 1. 借 / 採準確率 -->
          <div class="panel-card">
            <div class="panel-head">🏷️ 借 / 採 擺放準確率</div>
            <div class="stat-list">
              <div v-for="t in report.byTrade" :key="t.label" class="stat-row">
                <span class="st-name font-bold">{{ t.label }}</span>
                <span class="st-cnt">{{ t.passed.toLocaleString() }} / {{ t.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${t.accuracyPct}%` }" :class="t.accuracyPct >= 95 ? 'bg-green' : 'bg-amber'"></div>
                </div>
                <span class="st-pct">{{ t.accuracyPct }}%</span>
              </div>
            </div>
          </div>

          <!-- 2. 各樓層準確率 -->
          <div class="panel-card">
            <div class="panel-head">🏢 各樓層擺放準確率</div>
            <div class="stat-list">
              <div v-for="f in report.byFloor" :key="f.label" class="stat-row">
                <span class="st-name font-bold">{{ f.label }}</span>
                <span class="st-cnt">{{ f.passed.toLocaleString() }} / {{ f.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${f.accuracyPct}%` }" :class="f.accuracyPct >= 95 ? 'bg-green' : 'bg-amber'"></div>
                </div>
                <span class="st-pct">{{ f.accuracyPct }}%</span>
              </div>
            </div>
          </div>

          <!-- 3. 各商品大區準確率 -->
          <div class="panel-card">
            <div class="panel-head">🗂️ 各商品大區準確率</div>
            <div class="stat-list">
              <div v-for="c in report.byCategory" :key="c.label" class="stat-row">
                <span class="st-name font-bold">{{ c.label }}</span>
                <span class="st-cnt">{{ c.passed.toLocaleString() }} / {{ c.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${c.accuracyPct}%` }" :class="c.accuracyPct >= 95 ? 'bg-green' : 'bg-red'"></div>
                </div>
                <span class="st-pct">{{ c.accuracyPct }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 異常移庫明細表 -->
        <div class="panel-card exception-table-card">
          <div class="panel-head row-between">
            <span>🚨 放錯儲位異常移庫清單（共 {{ filteredExceptions.length }} 筆異常）</span>
            <div class="exc-filters">
              <el-input v-model="excKeyword" size="mini" placeholder="搜尋商品ID/名稱/儲位..." style="width: 180px;" clearable />
              <el-select v-model="excTradeFilter" size="mini" style="width: 105px;">
                <el-option label="全部借/採" value="ALL" />
                <el-option label="僅看「借」" value="借" />
                <el-option label="僅看「採」" value="採" />
              </el-select>
              <el-select v-model="excFloorFilter" size="mini" style="width: 110px;">
                <el-option label="全部樓層" value="ALL" />
                <el-option v-for="f in report.byFloor" :key="f.label" :label="f.label" :value="f.label" />
              </el-select>
              <el-button size="mini" type="warning" icon="el-icon-download" @click="exportExceptionsExcel">
                匯出移庫單 Excel
              </el-button>
            </div>
          </div>

          <div class="table-scroll">
            <table class="dark-table">
              <thead>
                <tr>
                  <th>商品ID</th>
                  <th>商品名稱</th>
                  <th>借/採</th>
                  <th>商品大區</th>
                  <th>材積</th>
                  <th>樓層</th>
                  <th>目前儲位</th>
                  <th>所屬區段</th>
                  <th>庫存數</th>
                  <th>異常原因</th>
                  <th>建議移往區段</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredExceptions.length === 0">
                  <td colspan="11" class="empty-td">🎉 目前篩選條件下無放錯儲位的異常商品！</td>
                </tr>
                <tr v-for="(item, idx) in filteredExceptions.slice(0, 300)" :key="idx">
                  <td class="text-blue font-bold">{{ item.sku_id }}</td>
                  <td class="text-left">{{ item.sku_name }}</td>
                  <td>
                    <span class="trade-pill" :class="item.trade_type === '借' ? 'pill-borrow' : 'pill-buy'">
                      {{ item.trade_type }}
                    </span>
                  </td>
                  <td>{{ item.cat_name }}</td>
                  <td>{{ item.volume_type }}</td>
                  <td class="font-bold">{{ item.floor }}</td>
                  <td class="text-yellow font-bold">{{ item.bin_code }}</td>
                  <td>{{ item.zone_name }}</td>
                  <td class="font-bold">{{ item.qty }}</td>
                  <td class="text-left text-red">{{ item.reason }}</td>
                  <td class="text-left text-green">{{ item.suggested_zone }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <!-- ==================== TAB 2: 儲位規則線上設定 ==================== -->
    <div v-if="activeTab === 'rules'" class="tab-content" v-loading="loading">
      <div class="panel-card rules-toolbar-card">
        <div class="row-between">
          <div class="rule-filters">
            <el-select v-model="ruleFloorFilter" size="mini" style="width: 120px;">
              <el-option label="全部樓層" value="ALL" />
              <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
            </el-select>
            <el-input v-model="ruleKeyword" size="mini" placeholder="搜尋區域名稱或 X 軸(如 M01)..." style="width: 200px;" clearable />
          </div>

          <div class="rule-actions">
            <el-button size="mini" type="warning" plain @click="autoSuggestRules">
              ✨ 依現有庫存自動分析大區
            </el-button>
            <el-button size="mini" type="primary" icon="el-icon-plus" @click="openNewRuleModal">
              新增儲位區段規則
            </el-button>
          </div>
        </div>
        <div class="rule-hint">
          💡 提示：直接修改下方每一列的 <strong>「允許借/採」</strong> 或 <strong>「允許商品大區」</strong> 後會自動儲存；若該區段皆設為「借採皆可」且大區留空，則代表該區暫不限制。
        </div>
      </div>

      <div class="panel-card rules-table-card">
        <div class="table-scroll">
          <table class="dark-table rules-edit-table">
            <thead>
              <tr>
                <th style="width: 60px;">啟用</th>
                <th style="width: 75px;">樓層</th>
                <th style="width: 140px;">區域名稱</th>
                <th style="width: 110px;">儲位型態</th>
                <th style="width: 135px;">X軸區間 (排)</th>
                <th style="width: 115px;">Y軸區間 (格)</th>
                <th style="width: 85px;">層別</th>
                <th style="width: 130px;">允許借 / 採</th>
                <th style="min-width: 260px;">允許商品大區（可多選）</th>
                <th style="width: 140px;">允許材積</th>
                <th style="width: 70px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in filteredRules" :key="r.id">
                <td>
                  <el-switch v-model="r.enabled" @change="saveSingleRule(r)" />
                </td>
                <td class="font-bold text-blue">{{ r.floor }}</td>
                <td class="font-bold text-left">{{ r.zone_name }}</td>
                <td>{{ r.storage_type }}</td>
                <td class="font-bold text-yellow">{{ r.x_start }} ~ {{ r.x_end }}</td>
                <td>{{ r.y_start }} ~ {{ r.y_end }}</td>
                <td>{{ r.layer_start }} ~ {{ r.layer_end }}</td>
                <td>
                  <el-select
                    v-model="r.allowed_trade"
                    size="mini"
                    style="width: 115px;"
                    @change="saveSingleRule(r)"
                  >
                    <el-option label="借採皆可" value="ALL" />
                    <el-option label="僅限「借」" value="借" />
                    <el-option label="僅限「採」" value="採" />
                  </el-select>
                </td>
                <td>
                  <el-select
                    v-model="r.allowed_categories"
                    multiple
                    collapse-tags
                    filterable
                    size="mini"
                    placeholder="不限大區（點擊多選）"
                    style="width: 100%;"
                    @change="saveSingleRule(r)"
                  >
                    <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
                  </el-select>
                </td>
                <td>
                  <el-select
                    v-model="r.allowed_volumes"
                    multiple
                    collapse-tags
                    size="mini"
                    placeholder="不限材積"
                    style="width: 100%;"
                    @change="saveSingleRule(r)"
                  >
                    <el-option label="小材積" value="小材積" />
                    <el-option label="大材積" value="大材積" />
                    <el-option label="超大材" value="超大材" />
                  </el-select>
                </td>
                <td>
                  <button type="button" class="del-rule-btn" @click="deleteRule(r)">刪除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 新增自訂儲位區段規則 Modal（可用於把同一排拆成前半採、後半借） -->
    <el-dialog v-model="showRuleModal" title="➕ 新增儲位擺放規則區段" width="620px" append-to-body custom-class="dark-dialog">
      <div class="modal-grid-2">
        <div>
          <label class="m-lbl">區域名稱 *</label>
          <el-input v-model="newRule.zone_name" size="mini" placeholder="例如: 80M01-25(採購區)" />
        </div>
        <div>
          <label class="m-lbl">樓層 *</label>
          <el-select v-model="newRule.floor" size="mini" style="width: 100%;">
            <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">X軸起點 (排) *</label>
          <el-input v-model="newRule.x_start" size="mini" placeholder="例如: M01" />
        </div>
        <div>
          <label class="m-lbl">X軸終點 (排) *</label>
          <el-input v-model="newRule.x_end" size="mini" placeholder="例如: M25" />
        </div>
        <div>
          <label class="m-lbl">Y軸起點 (格)</label>
          <el-input v-model="newRule.y_start" size="mini" placeholder="001" />
        </div>
        <div>
          <label class="m-lbl">Y軸終點 (格)</label>
          <el-input v-model="newRule.y_end" size="mini" placeholder="099" />
        </div>
        <div>
          <label class="m-lbl">層別起點</label>
          <el-input v-model="newRule.layer_start" size="mini" placeholder="A" />
        </div>
        <div>
          <label class="m-lbl">層別終點</label>
          <el-input v-model="newRule.layer_end" size="mini" placeholder="Z" />
        </div>
        <div>
          <label class="m-lbl">允許借 / 採</label>
          <el-select v-model="newRule.allowed_trade" size="mini" style="width: 100%;">
            <el-option label="借採皆可" value="ALL" />
            <el-option label="僅限「借」" value="借" />
            <el-option label="僅限「採」" value="採" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">儲位型態</label>
          <el-input v-model="newRule.storage_type" size="mini" placeholder="例如: AGV層架 / 重型層架" />
        </div>
        <div style="grid-column: span 2;">
          <label class="m-lbl">允許商品大區（可多選）</label>
          <el-select v-model="newRule.allowed_categories" multiple filterable size="mini" style="width: 100%;">
            <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button size="mini" @click="showRuleModal = false">取消</el-button>
        <el-button size="mini" type="primary" @click="createNewRule">新增並儲存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'

export default {
  name: 'StorageAccuracy',
  data() {
    return {
      activeTab: 'dashboard',
      loading: false,
      uploading: false,
      uploadProgressText: '',

      floorOptions: ['1F', '2F東', '2F西', '3F', '4F', '6F', '7F', '8F'],
      categoryOptions: [
        '書店24H', '食品飲料', '日用品', '生活育樂', '家電', '保養',
        '新3C', '書店DVD', '流行', '數位', '居家', '周邊耗材',
        '休閒', '零組件', '母嬰', '保健', '大家電3', '超商', '筆記電腦', '通訊'
      ],

      rules: [],
      ruleFloorFilter: 'ALL',
      ruleKeyword: '',

      report: {
        hasData: false,
        summary: { total: 0, audited: 0, passed: 0, failed: 0, accuracyPct: 0 },
        byTrade: [],
        byFloor: [],
        byCategory: [],
        exceptions: []
      },

      excKeyword: '',
      excTradeFilter: 'ALL',
      excFloorFilter: 'ALL',

      showRuleModal: false,
      newRule: {
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: 'A',
        x_start: '',
        x_end: '',
        y_start: '001',
        y_end: '099',
        layer_start: 'A',
        layer_end: 'Z',
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: [],
        enabled: true
      }
    }
  },
  computed: {
    filteredRules() {
      const kw = this.ruleKeyword.trim().toLowerCase();
      return this.rules.filter(r => {
        const okFloor = this.ruleFloorFilter === 'ALL' || r.floor === this.ruleFloorFilter;
        const okKw = !kw ||
          r.zone_name.toLowerCase().includes(kw) ||
          r.x_start.toLowerCase().includes(kw) ||
          r.x_end.toLowerCase().includes(kw);
        return okFloor && okKw;
      });
    },
    filteredExceptions() {
      const kw = this.excKeyword.trim().toLowerCase();
      return (this.report.exceptions || []).filter(item => {
        const okTrade = this.excTradeFilter === 'ALL' || item.trade_type === this.excTradeFilter;
        const okFloor = this.excFloorFilter === 'ALL' || item.floor === this.excFloorFilter;
        const okKw = !kw ||
          item.sku_id.toLowerCase().includes(kw) ||
          item.sku_name.toLowerCase().includes(kw) ||
          item.bin_code.toLowerCase().includes(kw);
        return okTrade && okFloor && okKw;
      });
    }
  },
  mounted() {
    this.refreshAll();
  },
  methods: {
    async refreshAll() {
      this.loading = true;
      try {
        const [ruleRes, repRes] = await Promise.all([
          axios.get('/api/storage-accuracy/rules'),
          axios.get('/api/storage-accuracy/audit/report')
        ]);
        if (ruleRes.data?.success) this.rules = ruleRes.data.rules || [];
        if (repRes.data?.success) this.report = repRes.data;
      } catch (e) {
        ElMessage.error('載入儲位準確率資料失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async saveSingleRule(rule) {
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule });
        ElMessage.success(`已儲存規則：${rule.floor} ${rule.zone_name}`);
        const repRes = await axios.get('/api/storage-accuracy/audit/report');
        if (repRes.data?.success) this.report = repRes.data;
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + e.message);
      }
    },

    openNewRuleModal() {
      this.newRule = {
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: 'A',
        x_start: '',
        x_end: '',
        y_start: '001',
        y_end: '099',
        layer_start: 'A',
        layer_end: 'Z',
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: [],
        enabled: true
      };
      this.showRuleModal = true;
    },

    async createNewRule() {
      if (!this.newRule.zone_name || !this.newRule.x_start || !this.newRule.x_end) {
        return ElMessage.warning('請填寫區域名稱與 X 軸起訖！');
      }
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: this.newRule });
        this.showRuleModal = false;
        await this.refreshAll();
        ElMessage.success('🎉 已新增儲位區段規則！');
      } catch (e) {
        ElMessage.error('新增規則失敗：' + e.message);
      }
    },

    deleteRule(rule) {
      ElMessageBox.confirm(`確定要刪除「${rule.floor} - ${rule.zone_name} (${rule.x_start}~${rule.x_end})」嗎？`, '刪除規則確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await axios.post('/api/storage-accuracy/rules/delete', { id: rule.id });
        await this.refreshAll();
        ElMessage.success('已刪除該條規則');
      }).catch(() => {});
    },

    async autoSuggestRules() {
      try {
        const res = await axios.post('/api/storage-accuracy/rules/auto-suggest');
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          await this.refreshAll();
        }
      } catch (e) {
        ElMessage.warning(e.response?.data?.message || e.message);
      }
    },

    triggerCsvInput() {
      if (this.$refs.csvInput) {
        this.$refs.csvInput.value = '';
        this.$refs.csvInput.click();
      }
    },

    parseCsvLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    },

    async handleCsvUpload(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      this.uploading = true;
      this.uploadProgressText = '讀取 CSV 檔案中...';

      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV 內容為空');

        const headers = this.parseCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/, ''));
        const idxSku = headers.indexOf('商品ID');
        const idxName = headers.indexOf('商品名稱');
        const idxTrade = headers.indexOf('借/採');
        const idxBin = headers.indexOf('儲位');
        const idxQty = headers.indexOf('儲位庫存數');
        const idxFloor = headers.indexOf('樓層');
        const idxArea = headers.indexOf('樓層區域');
        const idxType = headers.indexOf('儲位型態');
        const idxCatCode = headers.indexOf('大區編');
        const idxCatName = headers.indexOf('大區名');
        const idxVol = headers.indexOf('材積判斷');
        const idxNote = headers.indexOf('備註');

        if (idxSku === -1 || idxBin === -1) {
          throw new Error('CSV 缺少「商品ID」或「儲位」欄位，請確認為 80 庫匯出檔');
        }

        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = this.parseCsvLine(lines[i]);
          const sku = cols[idxSku];
          const bin = cols[idxBin];
          if (!sku || !bin) continue;

          parsedRows.push({
            sku_id: sku,
            sku_name: idxName !== -1 ? cols[idxName] : '',
            trade_type: idxTrade !== -1 ? cols[idxTrade] : '',
            bin_code: bin,
            qty: idxQty !== -1 ? Number(cols[idxQty] || 0) : 0,
            floor: idxFloor !== -1 ? cols[idxFloor] : '',
            area: idxArea !== -1 ? cols[idxArea] : '',
            storage_type: idxType !== -1 ? cols[idxType] : '',
            cat_code: idxCatCode !== -1 ? cols[idxCatCode] : '',
            cat_name: idxCatName !== -1 ? cols[idxCatName] : '',
            volume_type: idxVol !== -1 ? cols[idxVol] : '',
            note: idxNote !== -1 ? cols[idxNote] : ''
          });
        }

        const batchId = `batch_${Date.now()}`;
        const chunkSize = 5000;
        for (let offset = 0; offset < parsedRows.length; offset += chunkSize) {
          const chunk = parsedRows.slice(offset, offset + chunkSize);
          this.uploadProgressText = `寫入資料庫中 (${Math.min(offset + chunkSize, parsedRows.length).toLocaleString()} / ${parsedRows.length.toLocaleString()})...`;
          await axios.post('/api/storage-accuracy/audit/upload-chunk', {
            batchId,
            isFirstChunk: offset === 0,
            rows: chunk
          });
        }

        this.uploadProgressText = '計算擺放準確率中...';
        await this.refreshAll();
        this.activeTab = 'dashboard';
        ElMessage.success(`🎉 成功匯入 ${parsedRows.length.toLocaleString()} 筆 80 庫儲位明細並完成準確率稽核！`);
      } catch (err) {
        ElMessage.error('上傳 80 庫 CSV 失敗：' + err.message);
      } finally {
        this.uploading = false;
        this.uploadProgressText = '';
      }
    },

    exportExceptionsExcel() {
      const rows = [
        ['商品ID', '商品名稱', '借/採', '商品大區', '材積', '樓層', '目前儲位', '所屬區段', '庫存數', '異常原因', '建議移往區段']
      ];
      this.filteredExceptions.forEach(item => {
        rows.push([
          item.sku_id,
          item.sku_name,
          item.trade_type,
          item.cat_name,
          item.volume_type,
          item.floor,
          item.bin_code,
          item.zone_name,
          item.qty,
          item.reason,
          item.suggested_zone
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '儲位異常移庫清單');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `80庫儲位異常移庫單_${today}.xlsx`);
      ElMessage.success('🎉 已成功匯出儲位異常移庫單！');
    }
  }
}
</script>

<style scoped>
.storage-accuracy-page {
  padding: 12px 14px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #0b1120;
  color: #f8fafc;
  overflow: hidden;
}

.header-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #38bdf8;
}
.sub-tabs {
  display: inline-flex;
  background: #0f172a;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid #334155;
  gap: 4px;
}
.sub-tab-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: bold;
  padding: 5px 12px;
  border-radius: 5px;
  cursor: pointer;
}
.sub-tab-btn.active {
  background: #2563eb;
  color: #ffffff;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.upload-status-pill {
  background: rgba(250, 204, 21, 0.15);
  color: #facc15;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
}

.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  flex-shrink: 0;
}
.kpi-box {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
}
.highlight-kpi {
  border-color: #38bdf8;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}
.kpi-lbl {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}
.kpi-num {
  font-size: 22px;
  font-weight: 800;
}

.empty-guide-card {
  background: #1e293b;
  border: 1px dashed #475569;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  color: #cbd5e1;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.5fr;
  gap: 10px;
  height: 210px;
  flex-shrink: 0;
}
.panel-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-head {
  background: #0f172a;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: bold;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.stat-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-row {
  display: grid;
  grid-template-columns: 80px 95px 1fr 52px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.st-cnt {
  color: #94a3b8;
  font-size: 11px;
  text-align: right;
}
.st-bar-wrap {
  height: 7px;
  background: #334155;
  border-radius: 4px;
  overflow: hidden;
}
.st-bar {
  height: 100%;
}
.st-pct {
  font-weight: bold;
  text-align: right;
}

.exception-table-card, .rules-table-card {
  flex: 1;
  min-height: 0;
}
.exc-filters, .rule-filters, .rule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rules-toolbar-card {
  padding: 8px 12px;
  gap: 6px;
  flex-shrink: 0;
}
.rule-hint {
  font-size: 12px;
  color: #7dd3fc;
}

.table-scroll {
  flex: 1;
  overflow: auto;
}
.dark-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.dark-table th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #0f172a;
  color: #cbd5e1;
  padding: 8px 6px;
  border-bottom: 1px solid #475569;
  border-right: 1px solid #334155;
  white-space: nowrap;
}
.dark-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #334155;
  border-right: 1px solid #334155;
  text-align: center;
}
.dark-table tbody tr:hover td {
  background: rgba(56, 189, 248, 0.08);
}
.text-left {
  text-align: left !important;
}
.empty-td {
  padding: 30px !important;
  color: #94a3b8;
}

.trade-pill {
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 11px;
}
.pill-borrow {
  background: rgba(250, 204, 21, 0.2);
  color: #facc15;
}
.pill-buy {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}
.del-rule-btn {
  background: transparent;
  border: 1px solid #475569;
  color: #f87171;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}
.del-rule-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: #f87171;
}

.modal-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.m-lbl {
  display: block;
  font-size: 12px;
  font-weight: bold;
  color: #cbd5e1;
  margin-bottom: 4px;
}

.bg-green { background: #4ade80; }
.bg-amber { background: #facc15; }
.bg-red { background: #f87171; }
.text-blue { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-green { color: #4ade80; }
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.font-bold { font-weight: bold; }
</style>