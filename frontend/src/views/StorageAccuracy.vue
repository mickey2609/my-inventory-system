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
            :class="{ active: activeTab === 'floorplan' }"
            @click="activeTab = 'floorplan'"
          >
            🗺️ 樓層儲位平面配置圖 (2F~8F)
          </button>
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            ⚙️ 儲位規則線上設定 ({{ rules.length }} 條)
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

      <div v-if="!report.hasData" class="empty-guide-card">
        <h4>尚未匯入 80 庫庫存快照資料</h4>
        <p>您可先切換至 <strong>「🗺️ 樓層儲位平面配置圖」</strong> 或 <strong>「⚙️ 儲位規則線上設定」</strong> 針對每一條排號設定 <strong>借/採</strong> 與 <strong>允許大區</strong>，再上傳 80 庫 CSV 即可秒算準確率！</p>
      </div>

      <template v-else>
        <div class="breakdown-grid">
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

    <!-- ==================== TAB 2: 樓層儲位平面配置圖 (2F ~ 8F) ==================== -->
    <div v-if="activeTab === 'floorplan'" class="tab-content" v-loading="loading">
      <div class="panel-card fp-toolbar">
        <div class="row-between">
          <div class="fp-floor-tabs">
            <button
              type="button"
              v-for="fl in ['2F', '3F', '4F', '6F', '7F', '8F']"
              :key="fl"
              class="fp-fl-btn"
              :class="{ active: selectedMapFloor === fl }"
              @click="selectedMapFloor = fl; selectedMapRack = null"
            >
              🏢 {{ fl }} 平面圖
            </button>
          </div>

          <div class="fp-legend">
            <span class="leg-item"><i class="leg-dot dot-buy"></i> 僅限「採」</span>
            <span class="leg-item"><i class="leg-dot dot-borrow"></i> 僅限「借」</span>
            <span class="leg-item"><i class="leg-dot dot-cat"></i> 已設大區規則</span>
            <span class="leg-item"><i class="leg-dot dot-err"></i> 含異常放錯商品</span>
            <span class="leg-item"><i class="leg-dot dot-unset"></i> 未設限制</span>
          </div>

          <div class="fp-zoom-controls">
            <span class="text-dim" style="font-size: 12px;">縮放：</span>
            <el-button size="mini" @click="mapZoom = Math.max(0.5, Number((mapZoom - 0.15).toFixed(2)))">－</el-button>
            <span class="font-bold" style="font-size: 12px; min-width: 42px; text-align: center;">{{ Math.round(mapZoom * 100) }}%</span>
            <el-button size="mini" @click="mapZoom = Math.min(1.8, Number((mapZoom + 0.15).toFixed(2)))">＋</el-button>
          </div>
        </div>
      </div>

      <div class="fp-workspace">
        <!-- 左側可滾動/縮放平面圖畫布 -->
        <div class="fp-canvas-scroll">
          <div
            class="fp-canvas"
            :style="{
              width: `${currentFloorCanvas.width * mapZoom}px`,
              height: `${currentFloorCanvas.height * mapZoom}px`
            }"
          >
            <div
              class="fp-scale-inner"
              :style="{
                width: `${currentFloorCanvas.width}px`,
                height: `${currentFloorCanvas.height}px`,
                transform: `scale(${mapZoom})`,
                transformOrigin: 'top left'
              }"
            >
              <div
                v-for="(node, idx) in currentFloorCanvas.nodes"
                :key="idx"
                class="fp-node"
                :class="[
                  node.isRack ? 'fp-rack-node' : 'fp-landmark-node',
                  node.statusClass,
                  selectedMapRack && selectedMapRack.xCode === node.xCode && node.isRack ? 'fp-selected' : ''
                ]"
                :style="{
                  left: `${node.left}px`,
                  top: `${node.top}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`
                }"
                :title="node.tooltip"
                @click="node.isRack && selectRackOnMap(node)"
              >
                <span class="fp-node-txt" :class="{ 'fp-vertical-txt': node.isVertical }">
                  {{ node.shortLabel }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右側點擊儲位排號即時設定面板 -->
        <div class="panel-card fp-inspector">
          <div class="panel-head">🔎 點選平面圖儲位查看與設定</div>
          <div v-if="!selectedMapRack" class="fp-inspector-empty">
            <div style="font-size: 28px; margin-bottom: 8px;">👆</div>
            <div>請在左側平面圖點擊任一排貨架</div>
            <div class="text-dim" style="font-size: 11px; margin-top: 6px;">可直接查看該排目前的「借/採」與大區分布，並立即修改該條規則！</div>
          </div>
          <div v-else class="fp-inspector-body">
            <div class="insp-title-box">
              <div class="text-blue font-bold" style="font-size: 15px;">{{ selectedMapFloor }} - {{ selectedMapRack.xCode }} 排</div>
              <div class="text-dim" style="font-size: 11px;">完整標示：{{ selectedMapRack.label }}</div>
            </div>

            <!-- 該排現有庫存統計 -->
            <div class="insp-stat-card">
              <div class="insp-sub-title">📦 目前該排庫存統計</div>
              <div v-if="selectedRackStats.total === 0" class="text-dim" style="font-size: 12px;">
                尚無庫存資料（或尚未上傳 CSV）
              </div>
              <div v-else class="insp-stat-grid">
                <div>總儲位數：<strong>{{ selectedRackStats.total }}</strong></div>
                <div>準確率：<strong :class="selectedRackStats.failed > 0 ? 'text-red' : 'text-green'">{{ selectedRackStats.accuracyPct }}%</strong></div>
                <div>「借」筆數：<strong class="text-yellow">{{ selectedRackStats.borrowCnt }}</strong></div>
                <div>「採」筆數：<strong class="text-blue">{{ selectedRackStats.buyCnt }}</strong></div>
                <div style="grid-column: span 2; font-size: 11px; color: #cbd5e1;">
                  主要大區：{{ selectedRackStats.topCatsText }}
                </div>
              </div>
            </div>

            <!-- 直接線上設定該條規則 -->
            <div class="insp-rule-form">
              <div class="insp-sub-title">⚙️ 設定【{{ selectedMapRack.xCode }} 排】擺放規則</div>

              <label class="m-lbl">允許借 / 採：</label>
              <el-select v-model="mapEditRule.allowed_trade" size="mini" style="width: 100%; margin-bottom: 10px;">
                <el-option label="借採皆可" value="ALL" />
                <el-option label="僅限「借」" value="借" />
                <el-option label="僅限「採」" value="採" />
              </el-select>

              <label class="m-lbl">允許商品大區（可多選）：</label>
              <el-select
                v-model="mapEditRule.allowed_categories"
                multiple
                filterable
                size="mini"
                placeholder="不限大區"
                style="width: 100%; margin-bottom: 10px;"
              >
                <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
              </el-select>

              <label class="m-lbl">允許材積：</label>
              <el-select
                v-model="mapEditRule.allowed_volumes"
                multiple
                size="mini"
                placeholder="不限材積"
                style="width: 100%; margin-bottom: 12px;"
              >
                <el-option label="小材積" value="小材積" />
                <el-option label="大材積" value="大材積" />
                <el-option label="超大材" value="超大材" />
              </el-select>

              <el-button type="primary" size="mini" style="width: 100%;" @click="saveMapRackRule">
                💾 儲存【{{ selectedMapRack.xCode }}】規則並重算
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== TAB 3: 儲位規則線上設定（支援每條 X 軸獨立設定） ==================== -->
    <div v-if="activeTab === 'rules'" class="tab-content" v-loading="loading">
      <div class="panel-card rules-toolbar-card">
        <div class="row-between">
          <div class="rule-filters">
            <el-select v-model="ruleFloorFilter" size="mini" style="width: 120px;">
              <el-option label="全部樓層" value="ALL" />
              <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
            </el-select>
            <el-input v-model="ruleKeyword" size="mini" placeholder="搜尋區域名稱或 X 軸(如 M01)..." style="width: 210px;" clearable />
          </div>

          <div class="rule-actions">
            <el-button size="mini" type="info" plain @click="expandAllRangeRules">
              ⚡ 全部展開為逐條 X 軸設定
            </el-button>
            <el-button size="mini" type="warning" plain @click="autoSuggestRules">
              ✨ 依現有庫存自動分析大區
            </el-button>
            <el-button size="mini" type="primary" icon="el-icon-plus" @click="openNewRuleModal">
              新增單條 X 軸規則
            </el-button>
          </div>
        </div>
        <div class="rule-hint">
          💡 提示：若某一列目前是區間（例如 <code>L01 ~ L26</code>），點擊該列右側的 <strong>「⚡ 展開成單條」</strong>，系統會立刻拆成 <code>L01</code>、<code>L02</code> ... <code>L26</code> 共 26 列，讓您每一條單獨設定「借 / 採」與「大區」！
        </div>
      </div>

      <div class="panel-card rules-table-card">
        <div class="table-scroll">
          <table class="dark-table rules-edit-table">
            <thead>
              <tr>
                <th style="width: 55px;">啟用</th>
                <th style="width: 70px;">樓層</th>
                <th style="width: 150px;">區域名稱</th>
                <th style="width: 105px;">儲位型態</th>
                <th style="width: 135px;">X軸 (排號)</th>
                <th style="width: 105px;">Y軸 (格)</th>
                <th style="width: 75px;">層別</th>
                <th style="width: 125px;">允許借 / 採</th>
                <th style="min-width: 240px;">允許商品大區（可多選）</th>
                <th style="width: 135px;">允許材積</th>
                <th style="width: 135px;">操作</th>
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
                <td class="font-bold text-yellow">
                  <span v-if="r.x_start === r.x_end">{{ r.x_start }}（單條）</span>
                  <span v-else>{{ r.x_start }} ~ {{ r.x_end }}</span>
                </td>
                <td>{{ r.y_start }} ~ {{ r.y_end }}</td>
                <td>{{ r.layer_start }} ~ {{ r.layer_end }}</td>
                <td>
                  <el-select
                    v-model="r.allowed_trade"
                    size="mini"
                    style="width: 112px;"
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
                <td style="white-space: nowrap;">
                  <button
                    v-if="r.x_start !== r.x_end"
                    type="button"
                    class="expand-rule-btn"
                    title="將此區間拆分為每一條 X 軸獨立設定列"
                    @click="expandSingleRangeRule(r)"
                  >
                    ⚡ 展開成單條
                  </button>
                  <button type="button" class="del-rule-btn" @click="deleteRule(r)">刪除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 新增單條 X 軸規則 Modal -->
    <el-dialog v-model="showRuleModal" title="➕ 新增儲位擺放規則（支援單條 X 軸）" width="620px" append-to-body custom-class="dark-dialog">
      <div class="modal-grid-2">
        <div>
          <label class="m-lbl">區域名稱 *</label>
          <el-input v-model="newRule.zone_name" size="mini" placeholder="例如: 80M22 排" />
        </div>
        <div>
          <label class="m-lbl">樓層 *</label>
          <el-select v-model="newRule.floor" size="mini" style="width: 100%;">
            <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">X軸起點 (排號) *</label>
          <el-input v-model="newRule.x_start" size="mini" placeholder="例如: M22" />
        </div>
        <div>
          <label class="m-lbl">X軸終點 (單條請填同上)</label>
          <el-input v-model="newRule.x_end" size="mini" placeholder="留空即代表單條 M22" />
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
import { FLOOR_LAYOUT_DATA } from '../utils/floorLayoutData.js'

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

      // 平面圖互動狀態
      selectedMapFloor: '7F',
      mapZoom: 0.9,
      selectedMapRack: null,
      mapEditRule: {
        id: null,
        zone_name: '',
        floor: '7F',
        x_start: '',
        x_end: '',
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: []
      },

      report: {
        hasData: false,
        summary: { total: 0, audited: 0, passed: 0, failed: 0, accuracyPct: 0 },
        byTrade: [],
        byFloor: [],
        byCategory: [],
        byXRow: {},
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
    },
    // 依據選取樓層與規則/稽核結果，即時計算平面圖座標節點與顏色
    currentFloorCanvas() {
      const floorData = FLOOR_LAYOUT_DATA[this.selectedMapFloor];
      if (!floorData) return { width: 1000, height: 600, nodes: [] };

      const [minR, maxR, minC, maxC] = floorData.b;
      const cellW = 11;
      const cellH = 12;
      const pad = 20;

      // 建立該樓層每個 X 軸排號的規則查找表（單條規則優先）
      const floorRules = this.rules
        .filter(r => r.enabled && (r.floor === this.selectedMapFloor || r.floor.startsWith(this.selectedMapFloor)))
        .sort((a, b) => (a.x_start === a.x_end ? -1 : 1));

      const findRuleForX = (xCode) => {
        if (!xCode) return null;
        return floorRules.find(r => {
          if (r.x_start === r.x_end) return r.x_start === xCode;
          return xCode >= r.x_start && xCode <= r.x_end;
        }) || null;
      };

      const nodes = floorData.i.map(([r, c, sr, sc, label, xCode]) => {
        const isRack = Boolean(xCode);
        const w = Math.max(isRack ? 26 : 32, sc * cellW);
        const h = Math.max(isRack ? 24 : 20, sr * cellH);
        const left = (c - minC) * cellW + pad;
        const top = (r - minR) * cellH + pad;
        const isVertical = h > w * 1.4 && isRack;

        let statusClass = '';
        let tooltip = label;

        if (isRack) {
          const rule = findRuleForX(xCode);
          const xStat = this.report.byXRow?.[`${this.selectedMapFloor}|${xCode}`];

          if (xStat && xStat.failed > 0) {
            statusClass = 'fp-status-err';
          } else if (rule && rule.allowed_trade === '借') {
            statusClass = 'fp-status-borrow';
          } else if (rule && rule.allowed_trade === '採') {
            statusClass = 'fp-status-buy';
          } else if (rule && rule.allowed_categories && rule.allowed_categories.length > 0) {
            statusClass = 'fp-status-cat';
          } else {
            statusClass = 'fp-status-unset';
          }

          const ruleText = rule
            ? `規則：${rule.allowed_trade === 'ALL' ? '借採皆可' : '僅限' + rule.allowed_trade}${rule.allowed_categories?.length ? '｜大區：' + rule.allowed_categories.join('、') : ''}`
            : '尚未設定規則';
          const statText = xStat ? `\n現況：共 ${xStat.total} 筆（合格 ${xStat.passed} / 異常 ${xStat.failed}）` : '';
          tooltip = `${label}（排號 ${xCode}）\n${ruleText}${statText}`;
        }

        // 簡化顯示標籤（例如 "80M22001A~049E" -> "M22"）
        const shortLabel = isRack ? xCode : label;

        return {
          left,
          top,
          width: w,
          height: h,
          label,
          shortLabel,
          xCode,
          isRack,
          isVertical,
          statusClass,
          tooltip
        };
      });

      return {
        width: (maxC - minC + 3) * cellW + pad * 2,
        height: (maxR - minR + 3) * cellH + pad * 2,
        nodes
      };
    },
    selectedRackStats() {
      if (!this.selectedMapRack) return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-' };
      const st = this.report.byXRow?.[`${this.selectedMapFloor}|${this.selectedMapRack.xCode}`];
      if (!st) return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-' };
      const topCats = Object.entries(st.cats || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`)
        .join('、') || '-';
      return {
        ...st,
        accuracyPct: st.total > 0 ? Number(((st.passed / st.total) * 100).toFixed(1)) : 100,
        topCatsText: topCats
      };
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

    // 在平面圖上點選某一排貨架時，載入該單條規則（若無單條則自動建立單條草稿）
    selectRackOnMap(node) {
      this.selectedMapRack = node;
      const exactRule = this.rules.find(
        r => (r.floor === this.selectedMapFloor || r.floor.startsWith(this.selectedMapFloor)) &&
          r.x_start === node.xCode && r.x_end === node.xCode
      );
      if (exactRule) {
        this.mapEditRule = {
          ...exactRule,
          allowed_categories: [...(exactRule.allowed_categories || [])],
          allowed_volumes: [...(exactRule.allowed_volumes || [])]
        };
      } else {
        const defaultFloor = this.selectedMapFloor === '2F'
          ? (node.xCode.startsWith('C2') ? '2F東' : '2F西')
          : this.selectedMapFloor;
        this.mapEditRule = {
          id: null,
          zone_name: `${node.xCode} 排`,
          floor: defaultFloor,
          storage_type: '',
          area: '',
          x_start: node.xCode,
          x_end: node.xCode,
          y_start: '001',
          y_end: '999',
          layer_start: 'A',
          layer_end: 'Z',
          allowed_trade: 'ALL',
          allowed_categories: [],
          allowed_volumes: [],
          enabled: true
        };
      }
    },

    async saveMapRackRule() {
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: this.mapEditRule });
        ElMessage.success(`🎉 已儲存【${this.mapEditRule.floor} - ${this.mapEditRule.x_start} 排】規則！`);
        await this.refreshAll();
        if (this.selectedMapRack) this.selectRackOnMap(this.selectedMapRack);
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + e.message);
      }
    },

    async saveSingleRule(rule) {
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule });
        ElMessage.success(`已儲存規則：${rule.floor} ${rule.x_start}${rule.x_start !== rule.x_end ? '~' + rule.x_end : ''}`);
        const repRes = await axios.get('/api/storage-accuracy/audit/report');
        if (repRes.data?.success) this.report = repRes.data;
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + e.message);
      }
    },

    async expandSingleRangeRule(rule) {
      try {
        const res = await axios.post('/api/storage-accuracy/rules/expand', { ruleId: rule.id });
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          await this.refreshAll();
        }
      } catch (e) {
        ElMessage.error('展開失敗：' + e.message);
      }
    },

    expandAllRangeRules() {
      ElMessageBox.confirm(
        '確定要將所有區間規則（如 M01~M53、L01~L26）全部展開成「每一條 X 軸獨立設定列」嗎？',
        '批次展開確認',
        { confirmButtonText: '確定展開', cancelButtonText: '取消', type: 'info' }
      ).then(async () => {
        const res = await axios.post('/api/storage-accuracy/rules/expand', {});
        if (res.data?.success) {
          ElMessage.success(res.data.message);
          await this.refreshAll();
        }
      }).catch(() => {});
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
      if (!this.newRule.zone_name || !this.newRule.x_start) {
        return ElMessage.warning('請填寫區域名稱與 X 軸排號！');
      }
      if (!this.newRule.x_end) this.newRule.x_end = this.newRule.x_start;
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: this.newRule });
        this.showRuleModal = false;
        await this.refreshAll();
        ElMessage.success('🎉 已新增儲位規則！');
      } catch (e) {
        ElMessage.error('新增規則失敗：' + e.message);
      }
    },

    deleteRule(rule) {
      ElMessageBox.confirm(`確定要刪除「${rule.floor} - ${rule.zone_name} (${rule.x_start})」嗎？`, '刪除規則確認', {
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
.header-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.page-title { margin: 0; font-size: 16px; font-weight: bold; color: #38bdf8; }
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
.sub-tab-btn.active { background: #2563eb; color: #ffffff; }
.header-right { display: flex; align-items: center; gap: 8px; }
.upload-status-pill {
  background: rgba(250, 204, 21, 0.15);
  color: #facc15;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
}

.tab-content { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }

.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; flex-shrink: 0; }
.kpi-box { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; }
.highlight-kpi { border-color: #38bdf8; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
.kpi-lbl { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
.kpi-num { font-size: 22px; font-weight: 800; }

.empty-guide-card {
  background: #1e293b;
  border: 1px dashed #475569;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  color: #cbd5e1;
}

.breakdown-grid { display: grid; grid-template-columns: 1fr 1.2fr 1.5fr; gap: 10px; height: 210px; flex-shrink: 0; }
.panel-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.panel-head { background: #0f172a; padding: 7px 12px; font-size: 13px; font-weight: bold; border-bottom: 1px solid #334155; flex-shrink: 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.stat-list { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.stat-row { display: grid; grid-template-columns: 80px 95px 1fr 52px; align-items: center; gap: 8px; font-size: 12px; }
.st-cnt { color: #94a3b8; font-size: 11px; text-align: right; }
.st-bar-wrap { height: 7px; background: #334155; border-radius: 4px; overflow: hidden; }
.st-bar { height: 100%; }
.st-pct { font-weight: bold; text-align: right; }

/* 平面圖視覺化樣式 */
.fp-toolbar { padding: 8px 12px; flex-shrink: 0; }
.fp-floor-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.fp-fl-btn {
  background: #0f172a;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}
.fp-fl-btn.active { background: #0284c7; border-color: #38bdf8; color: #ffffff; }
.fp-legend { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #cbd5e1; flex-wrap: wrap; }
.leg-item { display: inline-flex; align-items: center; gap: 5px; }
.leg-dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.dot-buy { background: #2563eb; border: 1px solid #60a5fa; }
.dot-borrow { background: #d97706; border: 1px solid #fbbf24; }
.dot-cat { background: #059669; border: 1px solid #34d399; }
.dot-err { background: #dc2626; border: 1px solid #f87171; }
.dot-unset { background: #1e293b; border: 1px solid #64748b; }
.fp-zoom-controls { display: flex; align-items: center; gap: 6px; }

.fp-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 310px;
  gap: 10px;
}
.fp-canvas-scroll {
  background: #090e1a;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: auto;
  position: relative;
}
.fp-canvas { position: relative; }
.fp-scale-inner { position: relative; }

.fp-node {
  position: absolute;
  box-sizing: border-box;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
  transition: transform 0.1s, box-shadow 0.1s;
}
.fp-landmark-node {
  background: rgba(51, 65, 85, 0.35);
  border: 1px dashed #475569;
  color: #94a3b8;
  font-size: 11px;
  font-weight: bold;
  pointer-events: none;
}
.fp-rack-node {
  cursor: pointer;
  font-size: 10px;
  font-weight: bold;
  color: #ffffff;
}
.fp-rack-node:hover {
  z-index: 20;
  transform: scale(1.12);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.85);
}
.fp-selected {
  outline: 2px solid #facc15 !important;
  z-index: 25;
}
.fp-status-unset { background: #1e293b; border: 1px solid #64748b; color: #cbd5e1; }
.fp-status-buy { background: #1d4ed8; border: 1px solid #60a5fa; }
.fp-status-borrow { background: #b45309; border: 1px solid #fbbf24; }
.fp-status-cat { background: #047857; border: 1px solid #34d399; }
.fp-status-err { background: #b91c1c; border: 1px solid #f87171; }

.fp-node-txt { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; padding: 0 2px; }
.fp-vertical-txt { writing-mode: vertical-rl; text-orientation: mixed; }

.fp-inspector { overflow-y: auto; }
.fp-inspector-empty { padding: 40px 16px; text-align: center; color: #cbd5e1; font-size: 13px; }
.fp-inspector-body { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.insp-title-box { border-bottom: 1px solid #334155; padding-bottom: 8px; }
.insp-stat-card, .insp-rule-form {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 10px;
}
.insp-sub-title { font-size: 12px; font-weight: bold; color: #38bdf8; margin-bottom: 8px; }
.insp-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; }

.exception-table-card, .rules-table-card { flex: 1; min-height: 0; }
.exc-filters, .rule-filters, .rule-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rules-toolbar-card { padding: 8px 12px; gap: 6px; flex-shrink: 0; }
.rule-hint { font-size: 12px; color: #7dd3fc; }
.rule-hint code { background: #0f172a; padding: 1px 5px; border-radius: 3px; color: #facc15; }

.table-scroll { flex: 1; overflow: auto; }
.dark-table { width: 100%; border-collapse: collapse; font-size: 12px; }
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
.dark-table td { padding: 6px 8px; border-bottom: 1px solid #334155; border-right: 1px solid #334155; text-align: center; }
.dark-table tbody tr:hover td { background: rgba(56, 189, 248, 0.08); }
.text-left { text-align: left !important; }
.empty-td { padding: 30px !important; color: #94a3b8; }

.trade-pill { padding: 2px 7px; border-radius: 4px; font-weight: bold; font-size: 11px; }
.pill-borrow { background: rgba(250, 204, 21, 0.2); color: #facc15; }
.pill-buy { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
.expand-rule-btn {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid #38bdf8;
  color: #38bdf8;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  margin-right: 4px;
}
.expand-rule-btn:hover { background: #0284c7; color: #ffffff; }
.del-rule-btn {
  background: transparent;
  border: 1px solid #475569;
  color: #f87171;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
}
.del-rule-btn:hover { background: rgba(248, 113, 113, 0.15); border-color: #f87171; }

.modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.m-lbl { display: block; font-size: 12px; font-weight: bold; color: #cbd5e1; margin-bottom: 4px; }

.bg-green { background: #4ade80; }
.bg-amber { background: #facc15; }
.bg-red { background: #f87171; }
.text-blue { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-green { color: #4ade80; }
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.text-dim { color: #94a3b8; }
.font-bold { font-weight: bold; }
</style>