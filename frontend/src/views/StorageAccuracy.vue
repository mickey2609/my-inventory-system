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
    <input
      type="file"
      ref="ruleExcelInput"
      style="display: none;"
      accept=".xlsx,.xls"
      @change="handleRuleExcelImport"
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
            :class="{ active: activeTab === 'simulation' }"
            @click="activeTab = 'simulation'"
          >
            🧠 三模式揀貨動線與找貨分析
          </button>
          <button
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'floorplan' }"
            @click="activeTab = 'floorplan'"
          >
            🗺️ 樓層儲位平面配置圖
          </button>
          <button
            v-if="isSysAdmin"
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            ⚙️ 儲位規則總表 ({{ rules.length }} 條)
          </button>
          <button
            v-if="isSysAdmin"
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'settings' }"
            @click="activeTab = 'settings'"
          >
            🛠️ 參數設定
          </button>
        </div>
      </div>

      <div class="header-right">
        <span v-if="uploadProgressText" class="upload-status-pill">{{ uploadProgressText }}</span>
        <el-button
          v-if="isSysAdmin"
          size="mini"
          type="success"
          icon="el-icon-upload2"
          :loading="uploading"
          @click="triggerCsvInput"
        >
          上傳 80庫 CSV
        </el-button>
        <el-button size="mini" type="primary" icon="el-icon-refresh" @click="refreshAll">
          重新計算
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
        <p>請由系統管理員匯入 80 庫庫存資料後，系統即可自動產生準確率與異常移庫清單。</p>
      </div>

      <template v-else>
        <div class="breakdown-grid-4">
          <div class="panel-card">
            <div class="panel-head">🏷️ 區域用途 / 借採準確率</div>
            <div class="stat-list">
              <div v-for="zr in report.byZoneRole" :key="zr.role" class="stat-row">
                <span class="st-name font-bold">{{ zr.label }}</span>
                <span class="st-cnt">{{ zr.passed.toLocaleString() }} / {{ zr.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${zr.accuracyPct}%` }" :class="zr.role === 'CLOSED' && zr.failed > 0 ? 'bg-red' : 'bg-green'"></div>
                </div>
                <span class="st-pct">{{ zr.accuracyPct }}%</span>
              </div>
              <div v-for="t in report.byTrade" :key="t.label" class="stat-row">
                <span class="st-name font-bold text-blue">借/採：{{ t.label }}</span>
                <span class="st-cnt">{{ t.passed.toLocaleString() }} / {{ t.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${t.accuracyPct}%` }" :class="t.accuracyPct >= 95 ? 'bg-green' : 'bg-amber'"></div>
                </div>
                <span class="st-pct">{{ t.accuracyPct }}%</span>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-head">🔥 月銷量級距準確率</div>
            <div class="stat-list">
              <div v-for="s in report.bySalesTier" :key="s.tier" class="stat-row">
                <span class="st-name font-bold">{{ s.label }}</span>
                <span class="st-cnt">{{ s.passed.toLocaleString() }} / {{ s.total.toLocaleString() }}</span>
                <div class="st-bar-wrap">
                  <div class="st-bar" :style="{ width: `${s.accuracyPct}%` }" :class="s.accuracyPct >= 95 ? 'bg-green' : 'bg-purple'"></div>
                </div>
                <span class="st-pct">{{ s.accuracyPct }}%</span>
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
            <span>🚨 放錯儲位異常移庫清單（共 {{ filteredExceptions.length }} 筆異常｜判斷順位：借/採 ＞ 商品ID專區/區名/大區 ＞ 月銷量級距）</span>
            <div class="exc-filters">
              <el-input v-model="excKeyword" size="mini" placeholder="搜尋商品ID/名稱/儲位..." style="width: 165px;" clearable />
              <el-select v-model="excRoleFilter" size="mini" style="width: 120px;">
                <el-option label="全部區域用途" value="ALL" />
                <el-option label="🚫 關閉中" value="CLOSED" />
                <el-option label="🛒 撿貨區" value="PICK" />
                <el-option label="🔄 庫區+撿貨區" value="BOTH" />
                <el-option label="📦 庫區" value="STORAGE" />
              </el-select>
              <el-select v-model="excTradeFilter" size="mini" style="width: 95px;">
                <el-option label="全部借/採" value="ALL" />
                <el-option label="僅看「借」" value="借" />
                <el-option label="僅看「採」" value="採" />
              </el-select>
              <el-select v-model="excTierFilter" size="mini" style="width: 110px;">
                <el-option label="全部月銷" value="ALL" />
                <el-option label="A級爆品" value="A" />
                <el-option label="B級常銷" value="B" />
                <el-option label="C級慢銷" value="C" />
                <el-option label="D級滯銷" value="D" />
              </el-select>
              <el-select v-model="excFloorFilter" size="mini" style="width: 100px;">
                <el-option label="全部樓層" value="ALL" />
                <el-option v-for="f in report.byFloor" :key="f.label" :label="f.label" :value="f.label" />
              </el-select>
              <el-button size="mini" type="warning" icon="el-icon-download" @click="exportExceptionsExcel">
                匯出移庫單
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
                  <th>大區編 / 大區名</th>
                  <th>區編 / 區名</th>
                  <th>月銷量</th>
                  <th>樓層</th>
                  <th>目前儲位</th>
                  <th>區域用途</th>
                  <th>庫存數</th>
                  <th>異常原因</th>
                  <th>建議移往區段</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredExceptions.length === 0">
                  <td colspan="12" class="empty-td">🎉 目前篩選條件下無放錯儲位的異常商品！</td>
                </tr>
                <tr v-for="(item, idx) in filteredExceptions.slice(0, 300)" :key="idx">
                  <td class="text-blue font-bold">{{ item.sku_id }}</td>
                  <td class="text-left">{{ item.sku_name }}</td>
                  <td>
                    <span class="trade-pill" :class="item.trade_type === '借' ? 'pill-borrow' : 'pill-buy'">
                      {{ item.trade_type }}
                    </span>
                  </td>
                  <td>{{ item.cat_code ? `${item.cat_code} - ${item.cat_name}` : item.cat_name }}</td>
                  <td>{{ item.zone_id ? `${item.zone_id} - ${item.zone_name}` : item.zone_name }}</td>
                  <td class="font-bold text-yellow">{{ item.monthly_sales }}</td>
                  <td class="font-bold">{{ item.floor }}</td>
                  <td class="text-yellow font-bold">{{ item.bin_code }}</td>
                  <td>
                    <span class="role-pill" :class="`role-${item.zone_role}`">{{ item.zone_role_label }}</span>
                  </td>
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

    <!-- ==================== TAB 2: 三模式揀貨動線與找貨效益模擬分析 ==================== -->
    <StorageSimulationTab
      v-if="activeTab === 'simulation'"
      ref="simTab"
      :active-mode="modeSettings.mode"
      :is-sys-admin="isSysAdmin"
      @apply-mode="applyModeFromSim"
    />

    <!-- ==================== TAB 3: 樓層儲位平面配置圖 ==================== -->
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
              @click="selectMapFloor(fl)"
            >
              🏢 {{ fl }}
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="text-dim" style="font-size: 12px;">🎨 著色視角：</span>
            <el-select v-model="mapColorMode" size="mini" style="width: 165px;">
              <el-option label="預設（異常＋借採/規則）" value="DEFAULT" />
              <el-option label="🏷️ 依區域用途（撿/庫/關）" value="ZONE_ROLE" />
              <el-option label="🗂️ 依專區/區名/大區設定" value="CATEGORY" />
              <el-option label="🔥 依月銷級距設定" value="SALES_TIER" />
            </el-select>

            <template v-if="isSysAdmin">
              <el-checkbox v-model="mapMultiSelectMode" size="mini" border>
                多選模式 (或按 Ctrl 點選)
              </el-checkbox>
              <el-button size="mini" type="info" plain @click="selectAllRacksInZone">
                全選本區
              </el-button>
              <el-button v-if="selectedMapRacks.length > 0" size="mini" plain @click="clearMapSelection">
                清除選取 ({{ selectedMapRacks.length }})
              </el-button>
            </template>
          </div>

          <div class="fp-zoom-controls">
            <span class="text-dim" style="font-size: 12px;">縮放：</span>
            <el-button size="mini" @click="mapZoom = Math.max(0.5, Number((mapZoom - 0.15).toFixed(2)))">－</el-button>
            <span class="font-bold" style="font-size: 12px; min-width: 42px; text-align: center;">{{ Math.round(mapZoom * 100) }}%</span>
            <el-button size="mini" @click="mapZoom = Math.min(2.2, Number((mapZoom + 0.15).toFixed(2)))">＋</el-button>
          </div>
        </div>

        <div class="fp-zone-bar">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="zone-bar-title">📍 {{ currentFloorModule?.title || selectedMapFloor }}：</span>
            <div class="fp-zone-tabs">
              <button
                type="button"
                v-for="z in currentFloorZones"
                :key="z.id"
                class="fp-zone-btn"
                :class="{ active: selectedZoneId === z.id }"
                @click="selectMapZone(z.id)"
              >
                {{ selectedMapFloor }} {{ z.label }}
              </button>
            </div>
          </div>

          <div v-if="mapColorMode === 'ZONE_ROLE'" class="fp-legend">
            <span class="leg-item"><i class="leg-dot dot-cat"></i> 🛒 撿貨區</span>
            <span class="leg-item"><i class="leg-dot dot-buy"></i> 📦 庫區</span>
            <span class="leg-item"><i class="leg-dot dot-borrow"></i> 🔄 庫區+撿貨區</span>
            <span class="leg-item"><i class="leg-dot dot-closed"></i> 🚫 關閉中</span>
          </div>
          <div v-else-if="mapColorMode === 'SALES_TIER'" class="fp-legend">
            <span class="leg-item"><i class="leg-dot dot-err"></i> A級爆品</span>
            <span class="leg-item"><i class="leg-dot dot-borrow"></i> B級常銷</span>
            <span class="leg-item"><i class="leg-dot dot-buy"></i> C級慢銷</span>
            <span class="leg-item"><i class="leg-dot dot-closed"></i> D級滯銷 / 未設</span>
          </div>
          <div v-else class="fp-legend">
            <span class="leg-item"><i class="leg-dot dot-buy"></i> 僅限「採」</span>
            <span class="leg-item"><i class="leg-dot dot-borrow"></i> 僅限「借」</span>
            <span class="leg-item"><i class="leg-dot dot-cat"></i> 已設專區/區名/大區</span>
            <span class="leg-item"><i class="leg-dot dot-closed"></i> 🚫 關閉中</span>
            <span class="leg-item"><i class="leg-dot dot-err"></i> 含異常庫存（點擊看明細）</span>
          </div>
        </div>
      </div>

      <div class="fp-workspace" :class="{ 'inspector-hidden': !showInspector }">
        <div class="fp-canvas-wrapper">
          <button
            v-if="!showInspector"
            type="button"
            class="reopen-inspector-btn"
            @click="showInspector = true"
          >
            ◀ 展開右側面板
          </button>

          <div
            class="compass-widget"
            :style="{ right: !showInspector ? '145px' : '16px' }"
            :title="isEastRightOrientation ? '目前視角：東側碼頭朝右、北側(A區)朝上' : '目前視角：東側碼頭朝上、北側(A區)朝左'"
          >
            <div class="compass-ring">
              <span class="cmp-dir cmp-top" :class="{ 'cmp-east': !isEastRightOrientation }">
                {{ isEastRightOrientation ? '北 (A)' : '東 (碼頭)' }}
              </span>
              <span class="cmp-dir cmp-bottom">
                {{ isEastRightOrientation ? '南 (D)' : '西' }}
              </span>
              <span class="cmp-dir cmp-left">
                {{ isEastRightOrientation ? '西' : '北 (A)' }}
              </span>
              <span class="cmp-dir cmp-right" :class="{ 'cmp-east': isEastRightOrientation }">
                {{ isEastRightOrientation ? '東 (碼頭)' : '南 (D)' }}
              </span>
              <div class="compass-needle" :class="isEastRightOrientation ? 'needle-right' : 'needle-up'">
                ▲
              </div>
            </div>
            <div class="compass-caption">
              {{ isEastRightOrientation ? '東側朝右（橫向）' : '東側朝上（夾層）' }}
            </div>
          </div>

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
                  class="edge-east-banner"
                  :class="isEastRightOrientation ? 'edge-right' : 'edge-top'"
                >
                  ▶ 東側碼頭方向（{{ currentZoneObj?.label || '' }}｜柱心距 12m）
                </div>

                <svg
                  v-if="currentFloorCanvas.outerFrame"
                  class="fp-zone-svg-outline"
                  :style="{
                    left: `${currentFloorCanvas.outerFrame.left}px`,
                    top: `${currentFloorCanvas.outerFrame.top}px`,
                    width: `${currentFloorCanvas.outerFrame.width}px`,
                    height: `${currentFloorCanvas.outerFrame.height}px`
                  }"
                  :viewBox="`0 0 ${currentFloorCanvas.outerFrame.width} ${currentFloorCanvas.outerFrame.height}`"
                >
                  <polygon
                    :points="currentFloorCanvas.outerFrame.points"
                    fill="rgba(15, 23, 42, 0.35)"
                    stroke="#64748b"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />
                  <g v-for="(dv, dIdx) in currentFloorCanvas.dividers" :key="`dv-${dIdx}`">
                    <line
                      :x1="dv.x1"
                      :y1="dv.y1"
                      :x2="dv.x2"
                      :y2="dv.y2"
                      stroke="#38bdf8"
                      stroke-width="2"
                      stroke-dasharray="6,4"
                    />
                    <text
                      :x="dv.x1"
                      :y="14"
                      fill="#38bdf8"
                      font-size="11"
                      font-weight="bold"
                      text-anchor="middle"
                    >
                      {{ dv.label }}
                    </text>
                  </g>
                </svg>

                <div
                  v-for="(col, cIdx) in currentFloorCanvas.columns"
                  :key="`col-${cIdx}`"
                  class="fp-struct-col"
                  :style="{
                    left: `${col.left}px`,
                    top: `${col.top}px`
                  }"
                  :title="col.title"
                ></div>

                <div
                  v-for="(node, idx) in currentFloorCanvas.nodes"
                  :key="idx"
                  class="fp-node"
                  :class="[
                    node.isRack ? 'fp-rack-node' : 'fp-landmark-node',
                    node.statusClass,
                    node.isRack && isNodeSelected(node) ? 'fp-selected' : ''
                  ]"
                  :style="{
                    left: `${node.left}px`,
                    top: `${node.top}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`
                  }"
                  :title="node.tooltip"
                  @click="node.isRack && handleRackClick(node, $event)"
                >
                  <span class="fp-node-txt" :class="{ 'fp-vertical-txt': node.isVertical }">
                    {{ node.shortLabel }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右側屬性與規則編輯面板 -->
        <div v-if="showInspector" class="panel-card fp-inspector">
          <div class="panel-head row-between">
            <span>{{ selectedMapRacks.length > 1 ? `⚡ 批次設定已選取 (${selectedMapRacks.length} 段)` : (isSysAdmin ? '🔎 儲位屬性與規則設定' : '🔎 儲位屬性與規則檢視') }}</span>
            <button
              type="button"
              class="hide-inspector-btn"
              title="隱藏右側面板以放大平面圖"
              @click="showInspector = false"
            >
              收合 ▶
            </button>
          </div>

          <div v-if="selectedMapRacks.length === 0" class="fp-inspector-empty">
            <div style="font-size: 28px; margin-bottom: 8px;">👆</div>
            <div>目前檢視：<strong>{{ selectedMapFloor }} {{ currentZoneObj?.label }}</strong></div>
            <div class="text-dim" style="font-size: 12px; margin-top: 8px; line-height: 1.6;">
              • <strong>紅色異常貨架</strong>：點擊可直接彈出該段異常商品明細視窗<br />
              <template v-if="isSysAdmin">
                • <strong>多排批次設定</strong>：按住 <kbd>Ctrl</kbd> 連續點選多段（或點上方「全選本區」），即可一次套用規則！
              </template>
              <template v-else>
                • <strong>單段查詢</strong>：點擊任一貨架可檢視該段庫存統計與擺放規則
              </template>
            </div>
          </div>

          <!-- 單段檢視 / 設定 -->
          <div v-else-if="selectedMapRacks.length === 1" class="fp-inspector-body">
            <div class="insp-title-box">
              <div class="text-blue font-bold" style="font-size: 15px;">
                {{ currentRuleFloorKey }}<span v-if="currentZoneAreaCode"> ({{ currentZoneAreaCode }}區)</span> - {{ selectedMapRacks[0].xCode }} 排
              </div>
              <div class="text-dim" style="font-size: 11px;">完整標示：{{ selectedMapRacks[0].label }}</div>
            </div>

            <div class="insp-stat-card">
              <div class="row-between" style="margin-bottom: 6px;">
                <div class="insp-sub-title" style="margin: 0;">📦 目前該段庫存統計</div>
                <el-button
                  v-if="selectedRackStats.failed > 0"
                  size="mini"
                  type="danger"
                  @click="openRackExceptionDialog(selectedMapRacks[0])"
                >
                  🚨 檢視異常 ({{ selectedRackStats.failed }})
                </el-button>
              </div>
              <div v-if="selectedRackStats.total === 0" class="text-dim" style="font-size: 12px;">
                尚無庫存資料
              </div>
              <div v-else class="insp-stat-grid">
                <div>總儲位數：<strong>{{ selectedRackStats.total }}</strong></div>
                <div>準確率：<strong :class="selectedRackStats.failed > 0 ? 'text-red' : 'text-green'">{{ selectedRackStats.accuracyPct }}%</strong></div>
                <div>「借」筆數：<strong class="text-yellow">{{ selectedRackStats.borrowCnt }}</strong></div>
                <div>「採」筆數：<strong class="text-blue">{{ selectedRackStats.buyCnt }}</strong></div>
                <div style="grid-column: span 2; font-size: 11px; color: #cbd5e1;">
                  主要大區：{{ selectedRackStats.topCatsText }}
                </div>
                <div style="grid-column: span 2; font-size: 11px; color: #fde047;">
                  月銷分佈：A級({{ selectedRackStats.tiers?.A || 0 }}) / B級({{ selectedRackStats.tiers?.B || 0 }}) / C級({{ selectedRackStats.tiers?.C || 0 }}) / D級({{ selectedRackStats.tiers?.D || 0 }})
                </div>
              </div>
            </div>

            <!-- 系統管理員專屬：可編輯規則表單 -->
            <div v-if="isSysAdmin" class="insp-rule-form">
              <div class="insp-sub-title">⚙️ 設定【{{ selectedMapRacks[0].label }}】屬性與規則</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                <div>
                  <label class="m-lbl">層別起點：</label>
                  <el-input v-model="mapEditRule.layer_start" size="mini" placeholder="A" />
                </div>
                <div>
                  <label class="m-lbl">層別終點：</label>
                  <el-input v-model="mapEditRule.layer_end" size="mini" placeholder="Z" />
                </div>
              </div>

              <label class="m-lbl">🏷️ 區域用途屬性：</label>
              <el-select v-model="mapEditRule.zone_role" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="🛒 撿貨區" value="PICK" />
                <el-option label="📦 庫區" value="STORAGE" />
                <el-option label="🔄 庫區+撿貨區" value="BOTH" />
                <el-option label="🚫 關閉中" value="CLOSED" />
              </el-select>

              <label class="m-lbl">📏 該條層架長度（公尺）：</label>
              <el-input-number
                v-model="mapEditRule.rack_length_m"
                :min="0.5"
                :max="200"
                :step="0.5"
                size="mini"
                style="width: 100%; margin-bottom: 8px;"
              />

              <label class="m-lbl">① 第一順位｜允許借 / 採：</label>
              <el-select v-model="mapEditRule.allowed_trade" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="借採皆可" value="ALL" />
                <el-option label="僅限「借」" value="借" />
                <el-option label="僅限「採」" value="採" />
              </el-select>

              <label class="m-lbl">② 第二順位｜主條件類別：</label>
              <el-select
                v-model="mapEditRule.target_type"
                size="mini"
                style="width: 100%; margin-bottom: 6px;"
                @change="mapEditRule.allowed_targets = []"
              >
                <el-option label="不限（跳過第二順位）" value="NONE" />
                <el-option label="① 商品ID**區（專區優先）" value="GROUP" />
                <el-option label="② 區名（帶區編）" value="ZONE" />
                <el-option label="③ 大區名（帶大區編）" value="CAT" />
              </el-select>

              <template v-if="mapEditRule.target_type !== 'NONE'">
                <label class="m-lbl">② 第二順位｜子條件明細（可多選）：</label>
                <el-select
                  v-model="mapEditRule.allowed_targets"
                  multiple
                  filterable
                  size="mini"
                  :placeholder="`請搜尋並多選${targetTypeLabelMap[mapEditRule.target_type]}...`"
                  style="width: 100%; margin-bottom: 8px;"
                >
                  <el-option
                    v-for="opt in getSubOptionsByType(mapEditRule.target_type)"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </template>

              <label class="m-lbl">③ 第三順位｜允許月銷量級距（可多選）：</label>
              <el-select
                v-model="mapEditRule.allowed_sales_tiers"
                multiple
                size="mini"
                placeholder="暫不設定（不限月銷級距）"
                style="width: 100%; margin-bottom: 10px;"
              >
                <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
                <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
                <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
                <el-option label="D級滯銷 (0)" value="D" />
              </el-select>

              <el-button type="primary" size="mini" style="width: 100%;" :loading="batchSaving" @click="saveMapRackRule">
                💾 儲存【{{ selectedMapRacks[0].xCode }}】設定並重算
              </el-button>
            </div>

            <!-- 非系統管理員：唯讀規則檢視 -->
            <div v-else class="insp-rule-form">
              <div class="insp-sub-title">🔒 目前排號規則（唯讀檢視）</div>
              <div style="font-size: 12px; color: #cbd5e1; line-height: 1.8;">
                <div>• 層別範圍：<strong>{{ mapEditRule.layer_start }} ~ {{ mapEditRule.layer_end }}</strong></div>
                <div>• 區域用途：<strong>{{ zoneRoleLabelMap[mapEditRule.zone_role] || '撿貨區' }}</strong></div>
                <div>• 允許借/採：<strong>{{ mapEditRule.allowed_trade === 'ALL' ? '借採皆可' : '僅限「' + mapEditRule.allowed_trade + '」' }}</strong></div>
                <div>
                  • 專區/區名/大區：
                  <strong>{{ mapEditRule.allowed_targets?.length ? mapEditRule.allowed_targets.map(formatTargetToken).join('、') : '不限' }}</strong>
                </div>
                <div>
                  • 月銷級距：
                  <strong>{{ mapEditRule.allowed_sales_tiers?.length ? mapEditRule.allowed_sales_tiers.join('、') + '級' : '不限' }}</strong>
                </div>
              </div>
              <div class="text-dim" style="font-size: 11px; margin-top: 8px;">
                ※ 僅限系統管理員 (sys_admin) 可修改儲位規則。
              </div>
            </div>
          </div>

          <!-- 多段批次設定（僅 sys_admin 可達） -->
          <div v-else-if="isSysAdmin" class="fp-inspector-body">
            <div class="insp-title-box">
              <div class="text-yellow font-bold" style="font-size: 14px;">
                已選取 {{ selectedMapRacks.length }} 段貨架
              </div>
              <div class="selected-tags-box">
                <span v-for="(rk, idx) in selectedMapRacks" :key="`${rk.xCode}-${idx}`" class="mini-rack-tag">
                  {{ rk.shortLabel || rk.xCode }}
                </span>
              </div>
            </div>

            <div class="insp-rule-form">
              <div class="insp-sub-title">⚡ 批次套用設定（僅更新有調整的欄位）</div>

              <label class="m-lbl">🏷️ 區域用途屬性：</label>
              <el-select v-model="mapBatchForm.zone_role" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="（維持各排原設定）" value="KEEP" />
                <el-option label="🛒 撿貨區" value="PICK" />
                <el-option label="📦 庫區" value="STORAGE" />
                <el-option label="🔄 庫區+撿貨區" value="BOTH" />
                <el-option label="🚫 關閉中" value="CLOSED" />
              </el-select>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <label class="m-lbl" style="margin: 0;">📏 層架長度（公尺）：</label>
                <el-checkbox v-model="mapBatchForm.applyLength" size="mini">套用此長度</el-checkbox>
              </div>
              <el-input-number
                v-model="mapBatchForm.rack_length_m"
                :disabled="!mapBatchForm.applyLength"
                :min="0.5"
                :max="200"
                :step="0.5"
                size="mini"
                style="width: 100%; margin-bottom: 8px;"
              />

              <label class="m-lbl">① 第一順位｜允許借 / 採：</label>
              <el-select v-model="mapBatchForm.allowed_trade" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="（維持各排原設定）" value="KEEP" />
                <el-option label="借採皆可" value="ALL" />
                <el-option label="僅限「借」" value="借" />
                <el-option label="僅限「採」" value="採" />
              </el-select>

              <label class="m-lbl">② 第二順位｜主條件類別：</label>
              <el-select
                v-model="mapBatchForm.target_type"
                size="mini"
                style="width: 100%; margin-bottom: 6px;"
                @change="mapBatchForm.allowed_targets = []"
              >
                <el-option label="（維持各排原設定）" value="KEEP" />
                <el-option label="清除為不限" value="NONE" />
                <el-option label="① 商品ID**區（專區優先）" value="GROUP" />
                <el-option label="② 區名（帶區編）" value="ZONE" />
                <el-option label="③ 大區名（帶大區編）" value="CAT" />
              </el-select>

              <template v-if="['GROUP', 'ZONE', 'CAT'].includes(mapBatchForm.target_type)">
                <label class="m-lbl">② 第二順位｜子條件明細（可多選）：</label>
                <el-select
                  v-model="mapBatchForm.allowed_targets"
                  multiple
                  filterable
                  size="mini"
                  :placeholder="`請搜尋並多選${targetTypeLabelMap[mapBatchForm.target_type]}...`"
                  style="width: 100%; margin-bottom: 8px;"
                >
                  <el-option
                    v-for="opt in getSubOptionsByType(mapBatchForm.target_type)"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </template>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <label class="m-lbl" style="margin: 0;">③ 允許月銷量級距：</label>
                <el-checkbox v-model="mapBatchForm.applyTiers" size="mini">覆蓋月銷</el-checkbox>
              </div>
              <el-select
                v-model="mapBatchForm.allowed_sales_tiers"
                :disabled="!mapBatchForm.applyTiers"
                multiple
                size="mini"
                placeholder="勾選右側後選擇級距（留空=不限）"
                style="width: 100%; margin-bottom: 10px;"
              >
                <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
                <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
                <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
                <el-option label="D級滯銷 (0)" value="D" />
              </el-select>

              <el-button type="success" size="mini" style="width: 100%;" :loading="batchSaving" @click="saveMapBatchRules">
                ⚡ 批次套用至這 {{ selectedMapRacks.length }} 段並重算
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== TAB 4: 儲位規則總表（僅 sys_admin 可見） ==================== -->
    <div v-if="activeTab === 'rules' && isSysAdmin" class="tab-content" v-loading="loading || batchSaving">
      <div class="panel-card rules-toolbar-card">
        <div class="row-between">
          <div class="rule-filters">
            <el-select v-model="ruleFloorFilter" size="mini" style="width: 110px;" @change="rulePage = 1">
              <el-option label="全部樓層" value="ALL" />
              <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
            </el-select>
            <el-select v-model="ruleAreaFilter" size="mini" style="width: 95px;" @change="rulePage = 1">
              <el-option label="全部區" value="ALL" />
              <el-option label="A區" value="A" />
              <el-option label="B區" value="B" />
              <el-option label="C區" value="C" />
              <el-option label="D區" value="D" />
            </el-select>
            <el-select v-model="ruleRoleFilter" size="mini" style="width: 125px;" @change="rulePage = 1">
              <el-option label="全部區域用途" value="ALL" />
              <el-option label="📦 庫區" value="STORAGE" />
              <el-option label="🛒 撿貨區" value="PICK" />
              <el-option label="🔄 庫區+撿貨區" value="BOTH" />
              <el-option label="🚫 關閉中" value="CLOSED" />
            </el-select>
            <el-input
              v-model="ruleKeyword"
              size="mini"
              placeholder="搜尋區域名稱、X軸、專區或大區..."
              style="width: 225px;"
              clearable
              @input="rulePage = 1"
            />
            <el-button
              v-if="selectedRuleIds.length > 0"
              size="mini"
              type="warning"
              @click="openTableBatchModal"
            >
              ⚡ 批次編輯已選 ({{ selectedRuleIds.length }} 條)
            </el-button>
          </div>

          <div class="rule-actions">
            <el-button size="mini" type="warning" plain @click="activeTab = 'settings'">
              🛠️ 參數設定（月銷 / 商品ID專區）
            </el-button>
            <el-button size="mini" type="success" plain icon="el-icon-download" @click="exportRulesExcel">
              匯出規則 Excel
            </el-button>
            <el-button size="mini" type="info" plain icon="el-icon-upload2" @click="triggerRuleExcelInput">
              匯入規則 Excel
            </el-button>
            <el-button size="mini" type="primary" icon="el-icon-plus" @click="openNewRuleModal">
              新增規則
            </el-button>
          </div>
        </div>
      </div>

      <div class="panel-card rules-table-card">
        <div class="table-scroll">
          <table class="dark-table">
            <thead>
              <tr>
                <th style="width: 38px;">
                  <input type="checkbox" :checked="isAllPageRulesSelected" @change="toggleSelectAllPageRules" />
                </th>
                <th style="width: 55px;">狀態</th>
                <th style="width: 65px;">樓層</th>
                <th style="width: 62px;">區</th>
                <th style="width: 135px;">區域名稱</th>
                <th style="width: 110px;">X軸 (排號)</th>
                <th style="width: 90px;">Y軸 / 層</th>
                <th style="width: 110px;">🏷️ 區域用途</th>
                <th style="width: 85px;">① 借/採</th>
                <th>② 商品ID專區 / 區名 / 大區名</th>
                <th style="width: 135px;">③ 允許月銷級距</th>
                <th style="width: 135px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedRules.length === 0">
                <td colspan="12" class="empty-td">查無符合篩選條件的儲位規則</td>
              </tr>
              <tr
                v-for="r in paginatedRules"
                :key="r.id"
                :class="{ 'closed-rule-row': r.zone_role === 'CLOSED', 'selected-rule-row': selectedRuleIds.includes(r.id) }"
              >
                <td>
                  <input type="checkbox" :value="r.id" v-model="selectedRuleIds" />
                </td>
                <td>
                  <span class="status-dot-txt" :class="r.enabled ? 'text-green' : 'text-dim'">
                    {{ r.enabled ? '● 啟用' : '○ 停用' }}
                  </span>
                </td>
                <td class="font-bold text-blue">{{ r.floor }}</td>
                <td>
                  <span v-if="resolveRuleArea(r)" class="area-badge">{{ resolveRuleArea(r) }}區</span>
                  <span v-else class="text-dim">-</span>
                </td>
                <td class="font-bold text-left">{{ r.zone_name }}</td>
                <td class="font-bold text-yellow">
                  <span v-if="r.x_start === r.x_end">{{ r.x_start }}</span>
                  <span v-else>{{ r.x_start }} ~ {{ r.x_end }}</span>
                </td>
                <td style="font-size: 11px;">{{ r.y_start }}~{{ r.y_end }} ({{ r.layer_start }}~{{ r.layer_end }})</td>
                <td>
                  <span class="role-pill" :class="`role-${r.zone_role || 'PICK'}`">
                    {{ zoneRoleLabelMap[r.zone_role || 'PICK'] }}
                  </span>
                </td>
                <td>
                  <span v-if="r.allowed_trade === '借'" class="trade-pill pill-borrow">僅限借</span>
                  <span v-else-if="r.allowed_trade === '採'" class="trade-pill pill-buy">僅限採</span>
                  <span v-else class="text-dim">皆可</span>
                </td>
                <td class="text-left">
                  <template v-if="r.allowed_targets && r.allowed_targets.length">
                    <span
                      v-for="tok in r.allowed_targets"
                      :key="tok"
                      class="cat-chip"
                      :class="getTargetChipClass(tok)"
                    >
                      {{ formatTargetToken(tok) }}
                    </span>
                  </template>
                  <span v-else class="text-dim">不限</span>
                </td>
                <td>
                  <template v-if="r.allowed_sales_tiers && r.allowed_sales_tiers.length">
                    <span
                      v-for="tr in r.allowed_sales_tiers"
                      :key="tr"
                      class="tier-pill"
                      :class="`tier-${tr}`"
                      style="margin-right: 3px;"
                    >
                      {{ tr }}級
                    </span>
                  </template>
                  <span v-else class="text-dim">不限</span>
                </td>
                <td style="white-space: nowrap;">
                  <button type="button" class="expand-rule-btn" @click="openEditRuleModal(r)">編輯</button>
                  <button
                    v-if="r.x_start !== r.x_end"
                    type="button"
                    class="expand-rule-btn"
                    @click="expandSingleRangeRule(r)"
                  >
                    展開
                  </button>
                  <button type="button" class="del-rule-btn" @click="deleteRule(r)">刪除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <span class="text-dim" style="font-size: 12px;">
            共 <strong>{{ filteredRules.length }}</strong> 條規則（目前已勾選 {{ selectedRuleIds.length }} 條）
          </span>
          <el-pagination
            background
            layout="sizes, prev, pager, next"
            :total="filteredRules.length"
            :current-page="rulePage"
            :page-size="rulePageSize"
            :page-sizes="[30, 50, 100]"
            @current-change="val => rulePage = val"
            @size-change="val => { rulePageSize = val; rulePage = 1; }"
          />
        </div>
      </div>
    </div>

    <!-- ==================== TAB 5: 參數設定（僅 sys_admin 可見） ==================== -->
    <StorageSettingsTab
      v-if="activeTab === 'settings' && isSysAdmin"
      :mode-settings="modeSettings"
      :skus="lookupOptions.skus"
      @save="saveModeSettings"
    />

    <!-- Modal 1: 新增 / 編輯單條規則 -->
    <el-dialog
      v-model="showRuleModal"
      :title="ruleForm.id ? `✏️ 編輯儲位規則（${ruleForm.floor} - ${ruleForm.x_start}）` : '➕ 新增儲位擺放規則'"
      width="640px"
      append-to-body
      class="dark-dialog"
    >
      <div class="modal-grid-2">
        <div>
          <label class="m-lbl">樓層 *</label>
          <el-select v-model="ruleForm.floor" size="mini" style="width: 100%;">
            <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">所屬分區 (A~D)</label>
          <el-select v-model="ruleForm.area" size="mini" clearable placeholder="選擇 A~D 區" style="width: 100%;">
            <el-option label="A區" value="A" />
            <el-option label="B區" value="B" />
            <el-option label="C區" value="C" />
            <el-option label="D區" value="D" />
          </el-select>
        </div>
        <div style="grid-column: span 2;">
          <label class="m-lbl">區域名稱 *</label>
          <el-input v-model="ruleForm.zone_name" size="mini" placeholder="例如: 80C2A03 排" />
        </div>
        <div>
          <label class="m-lbl">X軸起點 (排號) *</label>
          <el-input v-model="ruleForm.x_start" size="mini" placeholder="例如: C2A03" />
        </div>
        <div>
          <label class="m-lbl">X軸終點 (單條請填同上)</label>
          <el-input v-model="ruleForm.x_end" size="mini" placeholder="留空即代表單條" />
        </div>
        <div>
          <label class="m-lbl">Y軸起點 (格)</label>
          <el-input v-model="ruleForm.y_start" size="mini" placeholder="01" />
        </div>
        <div>
          <label class="m-lbl">Y軸終點 (格)</label>
          <el-input v-model="ruleForm.y_end" size="mini" placeholder="99" />
        </div>
        <div>
          <label class="m-lbl">層別起點</label>
          <el-input v-model="ruleForm.layer_start" size="mini" placeholder="A" />
        </div>
        <div>
          <label class="m-lbl">層別終點</label>
          <el-input v-model="ruleForm.layer_end" size="mini" placeholder="Z" />
        </div>
        <div>
          <label class="m-lbl">🏷️ 區域用途屬性</label>
          <el-select v-model="ruleForm.zone_role" size="mini" style="width: 100%;">
            <el-option label="📦 庫區" value="STORAGE" />
            <el-option label="🛒 撿貨區" value="PICK" />
            <el-option label="🔄 庫區+撿貨區" value="BOTH" />
            <el-option label="🚫 關閉中" value="CLOSED" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">① 第一順位｜允許借 / 採</label>
          <el-select v-model="ruleForm.allowed_trade" size="mini" style="width: 100%;">
            <el-option label="借採皆可" value="ALL" />
            <el-option label="僅限「借」" value="借" />
            <el-option label="僅限「採」" value="採" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">② 第二順位｜主條件類別</label>
          <el-select
            v-model="ruleForm.target_type"
            size="mini"
            style="width: 100%;"
            @change="ruleForm.allowed_targets = []"
          >
            <el-option label="不限（跳過第二順位）" value="NONE" />
            <el-option label="① 商品ID**區（專區優先）" value="GROUP" />
            <el-option label="② 區名（帶區編）" value="ZONE" />
            <el-option label="③ 大區名（帶大區編）" value="CAT" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">② 第二順位｜子條件明細（可多選）</label>
          <el-select
            v-model="ruleForm.allowed_targets"
            :disabled="ruleForm.target_type === 'NONE'"
            multiple
            filterable
            size="mini"
            :placeholder="ruleForm.target_type === 'NONE' ? '請先於左側選擇主條件' : '請搜尋並多選子條件...'"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in getSubOptionsByType(ruleForm.target_type)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
        <div style="grid-column: span 2;">
          <label class="m-lbl">③ 第三順位｜允許月銷量級距（可多選，暫不設定請留空）</label>
          <el-select v-model="ruleForm.allowed_sales_tiers" multiple size="mini" style="width: 100%;">
            <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
            <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
            <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
            <el-option label="D級滯銷 (0)" value="D" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button size="mini" @click="showRuleModal = false">取消</el-button>
        <el-button size="mini" type="primary" @click="submitRuleForm">儲存並套用</el-button>
      </template>
    </el-dialog>

    <!-- Modal 2: 規則總表勾選批次編輯 -->
    <el-dialog
      v-model="showTableBatchModal"
      :title="`⚡ 批次修改已勾選的 ${selectedRuleIds.length} 條規則`"
      width="540px"
      append-to-body
      class="dark-dialog"
    >
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>
          <label class="m-lbl">📍 所屬分區 (A~D)：</label>
          <el-select v-model="tableBatchForm.area" size="mini" style="width: 100%;">
            <el-option label="（維持原分區）" value="KEEP" />
            <el-option label="A區" value="A" />
            <el-option label="B區" value="B" />
            <el-option label="C區" value="C" />
            <el-option label="D區" value="D" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">🏷️ 區域用途屬性：</label>
          <el-select v-model="tableBatchForm.zone_role" size="mini" style="width: 100%;">
            <el-option label="（維持原設定）" value="KEEP" />
            <el-option label="🛒 撿貨區" value="PICK" />
            <el-option label="📦 庫區" value="STORAGE" />
            <el-option label="🔄 庫區+撿貨區" value="BOTH" />
            <el-option label="🚫 關閉中" value="CLOSED" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">① 第一順位｜允許借 / 採：</label>
          <el-select v-model="tableBatchForm.allowed_trade" size="mini" style="width: 100%;">
            <el-option label="（維持原設定）" value="KEEP" />
            <el-option label="借採皆可" value="ALL" />
            <el-option label="僅限「借」" value="借" />
            <el-option label="僅限「採」" value="採" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">② 第二順位｜主條件類別：</label>
          <el-select
            v-model="tableBatchForm.target_type"
            size="mini"
            style="width: 100%;"
            @change="tableBatchForm.allowed_targets = []"
          >
            <el-option label="（維持原設定）" value="KEEP" />
            <el-option label="清除為不限" value="NONE" />
            <el-option label="① 商品ID**區（專區優先）" value="GROUP" />
            <el-option label="② 區名（帶區編）" value="ZONE" />
            <el-option label="③ 大區名（帶大區編）" value="CAT" />
          </el-select>
        </div>
        <div v-if="['GROUP', 'ZONE', 'CAT'].includes(tableBatchForm.target_type)">
          <label class="m-lbl">② 第二順位｜子條件明細（可多選）：</label>
          <el-select
            v-model="tableBatchForm.allowed_targets"
            multiple
            filterable
            size="mini"
            :placeholder="`請搜尋並多選${targetTypeLabelMap[tableBatchForm.target_type]}...`"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in getSubOptionsByType(tableBatchForm.target_type)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between;">
            <label class="m-lbl">③ 第三順位｜允許月銷量級距：</label>
            <el-checkbox v-model="tableBatchForm.applyTiers" size="mini">覆蓋月銷設定</el-checkbox>
          </div>
          <el-select v-model="tableBatchForm.allowed_sales_tiers" :disabled="!tableBatchForm.applyTiers" multiple size="mini" style="width: 100%;">
            <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
            <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
            <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
            <el-option label="D級滯銷 (0)" value="D" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button size="mini" @click="showTableBatchModal = false">取消</el-button>
        <el-button size="mini" type="primary" :loading="batchSaving" @click="submitTableBatchEdit">
          確定批次套用
        </el-button>
      </template>
    </el-dialog>

    <!-- Modal 4: 點擊平面圖紅色異常貨架彈出的「異常儲位與層架類型建議視窗」 -->
    <el-dialog
      v-model="showRackExceptionModal"
      :title="`🚨 儲位異常明細與層架配置建議（${rackExceptionTitle}｜共 ${rackExceptionList.length} 筆）`"
      width="94%"
      top="5vh"
      append-to-body
      class="dark-dialog"
    >
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <span class="text-dim" style="font-size: 12px;">
          ※ 層架類型係依據「儲位材積設定表」之單格才數上限，按該儲位商品<strong>總才數</strong>自動判定最適合規格，並同步核對建議樓層是否具備該層架。
        </span>
        <el-button size="mini" type="warning" icon="el-icon-download" @click="exportRackExceptionsExcel">
          匯出本排異常清單 Excel
        </el-button>
      </div>

      <div style="max-height: 64vh; overflow: auto; border: 1px solid #334155; border-radius: 6px;">
        <table class="dark-table">
          <thead>
            <tr>
              <th>商品ID</th>
              <th>商品名稱</th>
              <th>儲位</th>
              <th>PCS數</th>
              <th>大區編</th>
              <th>大區名</th>
              <th>區編</th>
              <th>區名</th>
              <th>材積別</th>
              <th>總才數</th>
              <th>月銷量</th>
              <th>建議擺放樓層</th>
              <th>區域</th>
              <th>層架類型(依總才數判斷)</th>
              <th>異常原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rackExceptionList.length === 0">
              <td colspan="15" class="empty-td">此段目前無異常明細資料</td>
            </tr>
            <tr v-for="(item, idx) in rackExceptionList" :key="idx">
              <td class="text-blue font-bold">{{ item.sku_id }}</td>
              <td class="text-left" style="min-width: 170px;">{{ item.sku_name }}</td>
              <td class="text-yellow font-bold">{{ item.bin_code }}</td>
              <td class="font-bold">{{ item.qty }}</td>
              <td>{{ item.cat_code || '-' }}</td>
              <td>{{ item.cat_name || '-' }}</td>
              <td>{{ item.zone_id || '-' }}</td>
              <td>{{ item.zone_name || '-' }}</td>
              <td>{{ item.vol_type || '-' }}</td>
              <td class="text-yellow font-bold">{{ item.total_cubic_feet ?? 0 }}</td>
              <td class="font-bold">{{ item.monthly_sales }}</td>
              <td class="text-green font-bold">{{ item.suggested_floor || '-' }}</td>
              <td class="text-green font-bold">{{ item.suggested_area || '-' }}</td>
              <td class="text-blue font-bold" style="white-space: nowrap;">{{ item.suggested_rack_type || '-' }}</td>
              <td class="text-left text-red" style="min-width: 180px;">{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <el-button size="mini" type="primary" @click="showRackExceptionModal = false">關閉視窗</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { FLOOR_MODULES } from '../utils/floorLayoutData.js'
import StorageSimulationTab from '../components/StorageSimulationTab.vue'
import StorageSettingsTab from '../components/StorageSettingsTab.vue'

export default {
  name: 'StorageAccuracy',
  components: {
    StorageSimulationTab,
    StorageSettingsTab
  },
  data() {
    return {
      activeTab: 'dashboard',
      loading: false,
      uploading: false,
      batchSaving: false,
      uploadProgressText: '',
      detectedAuth: {
        username: '',
        role: ''
      },

      modeSettings: {
        mode: 'CAT_TRADE',
        tierA_min: 50,
        tierB_min: 10,
        tierC_min: 1,
        sku_groups: [
          { name: '商品ID溫度區', skus: [] },
          { name: '商品ID貴重區', skus: [] },
          { name: '商品ID票卷區', skus: [] },
          { name: '商品ID清倉區', skus: [] }
        ]
      },

      lookupOptions: {
        skus: [],
        zones: [],
        categories: []
      },

      targetTypeLabelMap: {
        GROUP: '商品ID**區',
        ZONE: '區編 - 區名',
        CAT: '大區編 - 大區名'
      },

      zoneRoleLabelMap: {
        STORAGE: '庫區',
        PICK: '撿貨區',
        BOTH: '庫區+撿貨區',
        CLOSED: '關閉中'
      },

      floorOptions: ['1F', '2F東', '2F西', '3F', '4F', '6F', '7F', '8F'],

      rules: [],
      ruleFloorFilter: 'ALL',
      ruleAreaFilter: 'ALL',
      ruleRoleFilter: 'ALL',
      ruleKeyword: '',
      rulePage: 1,
      rulePageSize: 30,
      selectedRuleIds: [],

      selectedMapFloor: '2F',
      selectedZoneId: '2F-E-A',
      mapZoom: 1.15,
      mapColorMode: 'DEFAULT',
      mapMultiSelectMode: false,
      selectedMapRacks: [],
      showInspector: true,

      showRackExceptionModal: false,
      rackExceptionTitle: '',
      rackExceptionList: [],

      mapEditRule: {
        id: null,
        zone_name: '',
        floor: '2F東',
        area: 'A',
        x_start: '',
        x_end: '',
        layer_start: 'A',
        layer_end: 'Z',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        target_type: 'NONE',
        allowed_targets: [],
        allowed_volumes: [],
        allowed_sales_tiers: []
      },

      mapBatchForm: {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        target_type: 'KEEP',
        allowed_targets: [],
        applyTiers: false,
        allowed_sales_tiers: []
      },

      report: {
        hasData: false,
        summary: { total: 0, audited: 0, passed: 0, failed: 0, accuracyPct: 0 },
        byTrade: [],
        byFloor: [],
        byCategory: [],
        bySalesTier: [],
        byZoneRole: [],
        byXRow: {},
        bySlot: {},
        exceptions: []
      },

      excKeyword: '',
      excRoleFilter: 'ALL',
      excTradeFilter: 'ALL',
      excTierFilter: 'ALL',
      excFloorFilter: 'ALL',

      showRuleModal: false,
      showTableBatchModal: false,

      ruleForm: {
        id: null,
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: '',
        x_start: '',
        x_end: '',
        y_start: '01',
        y_end: '99',
        layer_start: 'A',
        layer_end: 'Z',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        target_type: 'NONE',
        allowed_targets: [],
        allowed_volumes: [],
        allowed_sales_tiers: [],
        enabled: true
      },

      tableBatchForm: {
        area: 'KEEP',
        zone_role: 'KEEP',
        allowed_trade: 'KEEP',
        target_type: 'KEEP',
        allowed_targets: [],
        applyTiers: false,
        allowed_sales_tiers: []
      }
    }
  },
  computed: {
    currentUserInfo() {
      let username = this.detectedAuth.username || ''
      let role = this.detectedAuth.role || ''

      // 掃描 localStorage 與 sessionStorage 所有鍵值，相容各種主系統儲存名稱
      const storages = [window.localStorage, window.sessionStorage]
      for (const st of storages) {
        if (!st) continue
        for (let i = 0; i < st.length; i++) {
          const key = st.key(i)
          const raw = st.getItem(key)
          if (!raw) continue
          if (raw === 'sys_admin') {
            role = 'sys_admin'
            continue
          }
          if (raw.startsWith('{') && raw.endsWith('}')) {
            try {
              const obj = JSON.parse(raw)
              if (obj && typeof obj === 'object') {
                if (obj.role === 'sys_admin' || obj.user_role === 'sys_admin' || obj.is_sys_admin) {
                  role = 'sys_admin'
                } else if (!role && (obj.role || obj.user_role)) {
                  role = obj.role || obj.user_role
                }
                if (!username && (obj.username || obj.account || obj.user_id)) {
                  username = String(obj.username || obj.account || obj.user_id)
                }
              }
            } catch (e) {}
          }
        }
      }

      if (!username) {
        username = localStorage.getItem('username') || sessionStorage.getItem('username') || ''
      }
      if (!role && username === 'admin') {
        role = 'sys_admin'
      }

      return { username, role }
    },
    isSysAdmin() {
      const u = this.currentUserInfo
      const uname = String(u.username || '').trim().toLowerCase()
      return uname === 'admin' || u.role === 'sys_admin'
    },
    filteredRules() {
      const kw = this.ruleKeyword.trim().toLowerCase()
      return this.rules.filter(r => {
        const okFloor = this.ruleFloorFilter === 'ALL' || r.floor === this.ruleFloorFilter
        const okArea = this.ruleAreaFilter === 'ALL' || this.resolveRuleArea(r) === this.ruleAreaFilter
        const okRole = this.ruleRoleFilter === 'ALL' || (r.zone_role || 'PICK') === this.ruleRoleFilter
        const okKw = !kw ||
          r.zone_name.toLowerCase().includes(kw) ||
          r.x_start.toLowerCase().includes(kw) ||
          r.x_end.toLowerCase().includes(kw) ||
          (r.allowed_targets || []).some(t => this.formatTargetToken(t).toLowerCase().includes(kw))
        return okFloor && okArea && okRole && okKw
      })
    },
    paginatedRules() {
      const start = (this.rulePage - 1) * this.rulePageSize
      return this.filteredRules.slice(start, start + this.rulePageSize)
    },
    isAllPageRulesSelected() {
      return this.paginatedRules.length > 0 &&
        this.paginatedRules.every(r => this.selectedRuleIds.includes(r.id))
    },
    filteredExceptions() {
      const kw = this.excKeyword.trim().toLowerCase()
      return (this.report.exceptions || []).filter(item => {
        const okRole = this.excRoleFilter === 'ALL' || item.zone_role === this.excRoleFilter
        const okTrade = this.excTradeFilter === 'ALL' || item.trade_type === this.excTradeFilter
        const okTier = this.excTierFilter === 'ALL' || item.sales_tier === this.excTierFilter
        const okFloor = this.excFloorFilter === 'ALL' || item.floor === this.excFloorFilter
        const okKw = !kw ||
          item.sku_id.toLowerCase().includes(kw) ||
          item.sku_name.toLowerCase().includes(kw) ||
          item.bin_code.toLowerCase().includes(kw)
        return okRole && okTrade && okTier && okFloor && okKw
      })
    },
    currentFloorModule() {
      return FLOOR_MODULES[this.selectedMapFloor] || null
    },
    currentFloorZones() {
      return this.currentFloorModule?.zones || []
    },
    currentZoneObj() {
      return this.currentFloorZones.find(z => z.id === this.selectedZoneId) || this.currentFloorZones[0] || null
    },
    currentRuleFloorKey() {
      return this.currentZoneObj?.ruleFloor || this.selectedMapFloor
    },
    currentZoneAreaCode() {
      const parts = String(this.currentZoneObj?.id || '').split('-')
      return parts.find(p => ['A', 'B', 'C', 'D'].includes(p)) || ''
    },
    isEastRightOrientation() {
      return this.currentFloorModule?.orientation === 'east-right'
    },
    currentFloorCanvas() {
      const floorData = this.currentFloorModule
      const zoneObj = this.currentZoneObj
      if (!floorData || !zoneObj) return { width: 900, height: 550, nodes: [], outerFrame: null, dividers: [], columns: [] }

      const isEastRight = floorData.orientation === 'east-right'
      const ruleFl = zoneObj.ruleFloor || this.selectedMapFloor
      const floorRules = this.rules
        .filter(r => r.enabled && (r.floor === ruleFl || r.floor === this.selectedMapFloor))
        .sort((a, b) => (a.x_start === a.x_end ? -1 : 1))

      const targetRole = zoneObj.defaultRole
      const isRoleSplitView = targetRole === 'PICK' || targetRole === 'STORAGE'

      const findRuleForSegment = (xCode, label) => {
        if (!xCode) return null
        const range = this.parseRackYRange(label, xCode)
        const matchX = (r) => (r.x_start === r.x_end)
          ? (r.x_start === xCode || xCode.startsWith(r.x_start))
          : (xCode >= r.x_start && xCode <= r.x_end)

        const matchY = (r) => {
          if (!range.hasYRange) return true
          const rY1 = parseInt(r.y_start || '0', 10)
          const rY2 = parseInt(r.y_end || '999', 10)
          return range.yStart <= rY2 && range.yEnd >= rY1
        }

        if (isRoleSplitView) {
          return floorRules.find(r => matchX(r) && matchY(r) && r.zone_role === targetRole) || null
        }
        return floorRules.find(r => matchX(r) && matchY(r)) || null
      }

      const decorateRack = (xCode, label, widthPx = 0) => {
        const rule = findRuleForSegment(xCode, label)
        const xStat = this.computeSegmentStats(xCode, label)
        const zRole = rule?.zone_role || zoneObj.defaultRole || 'PICK'
        const targets = rule?.allowed_targets || []

        let statusClass = 'fp-status-unset'
        if (this.mapColorMode === 'ZONE_ROLE') {
          if (zRole === 'CLOSED') statusClass = 'fp-status-closed'
          else if (zRole === 'STORAGE') statusClass = 'fp-status-buy'
          else if (zRole === 'BOTH') statusClass = 'fp-status-borrow'
          else statusClass = 'fp-status-cat'
        } else if (this.mapColorMode === 'CATEGORY') {
          if (zRole === 'CLOSED') statusClass = 'fp-status-closed'
          else if (targets.length > 0) statusClass = 'fp-status-cat'
        } else if (this.mapColorMode === 'SALES_TIER') {
          const tiers = rule?.allowed_sales_tiers || []
          if (tiers.includes('A')) statusClass = 'fp-status-err'
          else if (tiers.includes('B')) statusClass = 'fp-status-borrow'
          else if (tiers.includes('C')) statusClass = 'fp-status-buy'
        } else {
          if (xStat && xStat.failed > 0) statusClass = 'fp-status-err'
          else if (zRole === 'CLOSED') statusClass = 'fp-status-closed'
          else if (rule && rule.allowed_trade === '借') statusClass = 'fp-status-borrow'
          else if (rule && rule.allowed_trade === '採') statusClass = 'fp-status-buy'
          else if (rule && (targets.length > 0 || (rule.allowed_sales_tiers?.length > 0))) statusClass = 'fp-status-cat'
        }

        const roleLabel = this.zoneRoleLabelMap[zRole] || '撿貨區'
        const layerText = rule ? `（${rule.layer_start || 'A'}~${rule.layer_end || 'Z'}層）` : ''
        const targetText = targets.length ? `｜限定：${targets.map(this.formatTargetToken).join('、')}` : ''
        const ruleText = rule
          ? `用途：【${roleLabel}】${layerText}｜借採：${rule.allowed_trade === 'ALL' ? '皆可' : '僅限' + rule.allowed_trade}${targetText}${rule.allowed_sales_tiers?.length ? '｜月銷：' + rule.allowed_sales_tiers.join('/') + '級' : ''}`
          : `預設用途：【${roleLabel}】（尚未建立獨立規則）`
        const statText = xStat ? `\n現況：共 ${xStat.total} 筆（合格 ${xStat.passed} / 異常 ${xStat.failed}）` : ''
        const m = String(label).match(/80([A-Z0-9]{2,4}\d{2,3})/)
        return {
          statusClass,
          hasError: Boolean(xStat && xStat.failed > 0),
          tooltip: `${label}（排號 ${xCode}）\n${ruleText}${statText}`,
          shortLabel: widthPx >= 110 ? label : (m ? m[1] : xCode)
        }
      }

      if (zoneObj.meterMode && zoneObj.shell) {
        const px = zoneObj.pxPerM || 20
        const padLeft = 36
        const padTop = 36
        const { widthM, depthM, rooms = [], columns = [], cutouts = [], dividers = [] } = zoneObj.shell
        const racks = floorData.zoneRacks?.[zoneObj.id] || []

        const nodes = []
        rooms.forEach(rm => {
          nodes.push({
            left: padLeft + rm.x * px,
            top: padTop + rm.y * px,
            width: rm.w * px,
            height: rm.h * px,
            label: rm.label,
            shortLabel: rm.label,
            xCode: '',
            isRack: false,
            isVertical: false,
            statusClass: '',
            hasError: false,
            tooltip: `${rm.label} (${rm.w}m × ${rm.h}m)`
          })
        })

        racks.forEach(rk => {
          const w = rk.w * px - 1
          const h = rk.h * px - 1
          const dec = decorateRack(rk.xCode, rk.label, w)
          nodes.push({
            left: padLeft + rk.x * px,
            top: padTop + rk.y * px,
            width: w,
            height: h,
            label: rk.label,
            shortLabel: dec.shortLabel,
            xCode: rk.xCode,
            isRack: true,
            isVertical: h > w * 1.4,
            statusClass: dec.statusClass,
            hasError: dec.hasError,
            tooltip: dec.tooltip
          })
        })

        const colMarkers = columns.map(c => ({
          left: padLeft + c.x * px - 5,
          top: padTop + c.y * px - 5,
          title: `結構柱位 (${c.x}m, ${c.y}m)`
        }))

        const nwCut = cutouts.find(ct => ct.x === 0 && ct.y === 0)
        const swCut = cutouts.find(ct => ct.x === 0 && ct.y > 0)
        const pts = []
        pts.push(nwCut ? `${nwCut.w * px},0` : '0,0')
        pts.push(`${widthM * px},0`)
        pts.push(`${widthM * px},${depthM * px}`)
        if (swCut) {
          pts.push(`${swCut.w * px},${depthM * px}`)
          pts.push(`${swCut.w * px},${swCut.y * px}`)
          pts.push(`0,${swCut.y * px}`)
        } else {
          pts.push(`0,${depthM * px}`)
        }
        if (nwCut) {
          pts.push(`0,${nwCut.h * px}`)
          pts.push(`${nwCut.w * px},${nwCut.h * px}`)
        }
        const outlinePoints = pts.join(' ')

        const dividerLines = dividers.map(dv => ({
          x1: dv.x1 * px,
          y1: dv.y1 * px,
          x2: dv.x2 * px,
          y2: dv.y2 * px,
          label: dv.label || ''
        }))

        return {
          width: padLeft * 2 + widthM * px,
          height: padTop + depthM * px + 24,
          outerFrame: {
            left: padLeft,
            top: padTop,
            width: widthM * px,
            height: depthM * px,
            points: outlinePoints
          },
          dividers: dividerLines,
          columns: colMarkers,
          nodes
        }
      }

      const [rMin, rMax, cMin, cMax] = zoneObj.crop
      const cellW = zoneObj.cellW || (isEastRight ? 9 : 14)
      const cellH = zoneObj.cellH || (isEastRight ? 11 : 14)
      const pad = 36

      const croppedItems = floorData.i.filter(([r, c, sr, sc]) => {
        const rEnd = r + sr
        const cEnd = c + sc
        return rEnd >= rMin && r <= rMax && cEnd >= cMin && c <= cMax
      })

      const nodes = croppedItems.map(([r, c, sr, sc, label, xCode]) => {
        const isRack = Boolean(xCode)
        let left, top, w, h
        if (isEastRight) {
          left = (rMax - (r + sr)) * cellW + pad
          top = (c - cMin) * cellH + pad
          w = Math.max(14, sr * cellW - (isRack ? 1 : 0))
          h = Math.max(14, sc * cellH - (isRack ? 1 : 0))
        } else {
          left = (c - cMin) * cellW + pad
          top = (r - rMin) * cellH + pad
          w = Math.max(16, sc * cellW - (isRack ? 1 : 0))
          h = Math.max(18, sr * cellH - (isRack ? 1 : 0))
        }

        const dec = isRack ? decorateRack(xCode, label, w) : { statusClass: '', hasError: false, tooltip: label, shortLabel: label }
        return {
          left,
          top,
          width: w,
          height: h,
          label,
          shortLabel: dec.shortLabel,
          xCode,
          isRack,
          isVertical: h > w * 1.4 && isRack,
          statusClass: dec.statusClass,
          hasError: dec.hasError,
          tooltip: dec.tooltip
        }
      })

      const canvasWidth = isEastRight
        ? (rMax - rMin + 4) * cellW + pad * 2
        : (cMax - cMin + 4) * cellW + pad * 2
      const canvasHeight = isEastRight
        ? (cMax - cMin + 4) * cellH + pad * 2
        : (rMax - rMin + 4) * cellH + pad * 2

      return {
        width: Math.max(640, canvasWidth),
        height: Math.max(460, canvasHeight),
        outerFrame: null,
        dividers: [],
        columns: [],
        nodes
      }
    },
    selectedRackStats() {
      if (this.selectedMapRacks.length !== 1) {
        return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-', tiers: {} }
      }
      const rk = this.selectedMapRacks[0]
      const st = this.computeSegmentStats(rk.xCode, rk.label)
      if (!st || st.total === 0) return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-', tiers: {} }
      const topCats = Object.entries(st.cats || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`)
        .join('、') || '-'
      return {
        ...st,
        accuracyPct: st.total > 0 ? Number(((st.passed / st.total) * 100).toFixed(1)) : 100,
        topCatsText: topCats
      }
    }
  },
  mounted() {
    this.syncAuthFromDomAndStorage()
    this.refreshAll()
  },
  methods: {
    ssyncAuthFromDomAndStorage() {
      // 僅限左上角顯示「系統管理員，歡迎登入」或帳號為 admin 時才賦予最高設定權限
      const headerText = document.body ? document.body.innerText || '' : ''
      if (headerText.includes('系統管理員，歡迎登入')) {
        this.detectedAuth.username = 'admin'
        this.detectedAuth.role = 'sys_admin'
      }
    },
    getAdminHeaders() {
      const u = this.currentUserInfo
      return {
        headers: {
          'x-username': u.username || (this.isSysAdmin ? 'admin' : ''),
          'x-user-role': u.role || (this.isSysAdmin ? 'sys_admin' : '')
        }
      }
    },
    // 從貨架標示（如 80D01081A~110C、80D02059A~072B、D07069）解析該段專屬的 Y 格號起訖範圍
    parseRackYRange(label, xCode) {
      const str = String(label || '').trim().toUpperCase()
      const mRange = str.match(/^80([A-Z0-9]{3})(\d{2,3})[A-Z]?~(\d{2,3})[A-Z]?$/)
      if (mRange) {
        return {
          hasYRange: true,
          yStart: parseInt(mRange[2], 10),
          yEnd: parseInt(mRange[3], 10)
        }
      }
      if (String(xCode || '').length <= 3) {
        const mSingle = str.match(/^(?:80)?([A-Z0-9]{3})(\d{2,3})[A-Z]?$/)
        if (mSingle) {
          const yVal = parseInt(mSingle[2], 10)
          return { hasYRange: true, yStart: yVal, yEnd: yVal }
        }
      }
      return { hasYRange: false, yStart: 0, yEnd: 999 }
    },
    // 依據排號與格號範圍計算該段貨架的專屬統計（避免 2F西 A區 081~110 混入 B區 043~072）
    computeSegmentStats(xCode, label) {
      const fl = this.selectedMapFloor
      const ruleFl = this.currentRuleFloorKey
      const range = this.parseRackYRange(label, xCode)
      const bySlot = this.report.bySlot || {}

      if (range.hasYRange && Object.keys(bySlot).length > 0) {
        const agg = { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, cats: {}, tiers: { A: 0, B: 0, C: 0, D: 0 } }
        for (let y = range.yStart; y <= range.yEnd; y++) {
          const st = bySlot[`${fl}|${xCode}|${y}`] || bySlot[`${ruleFl}|${xCode}|${y}`]
          if (!st) continue
          agg.total += st.total
          agg.passed += st.passed
          agg.failed += st.failed
          agg.borrowCnt += st.borrowCnt
          agg.buyCnt += st.buyCnt
          Object.entries(st.cats || {}).forEach(([k, v]) => {
            agg.cats[k] = (agg.cats[k] || 0) + v
          })
          ;['A', 'B', 'C', 'D'].forEach(t => {
            agg.tiers[t] += st.tiers?.[t] || 0
          })
        }
        return agg
      }

      return this.report.byXRow?.[`${fl}|${xCode}`] || this.report.byXRow?.[`${ruleFl}|${xCode}`] || null
    },
    getSubOptionsByType(targetType) {
      if (targetType === 'GROUP') {
        return (this.modeSettings.sku_groups || [])
          .filter(g => g && g.name)
          .map(g => ({
            value: `GROUP:${g.name}`,
            label: `${g.name} (${(g.skus || []).length}品)`
          }))
      }
      if (targetType === 'ZONE') {
        return (this.lookupOptions.zones || []).map(z => ({
          value: z.token,
          label: z.label
        }))
      }
      if (targetType === 'CAT') {
        return (this.lookupOptions.categories || []).map(c => ({
          value: c.token,
          label: c.label
        }))
      }
      return []
    },
    detectTargetType(targets) {
      if (!Array.isArray(targets) || targets.length === 0) return 'NONE'
      const first = String(targets[0] || '')
      if (first.startsWith('GROUP:')) return 'GROUP'
      if (first.startsWith('ZONE:')) return 'ZONE'
      if (first.startsWith('CAT:')) return 'CAT'
      return 'NONE'
    },
    formatTargetToken(token) {
      const str = String(token || '')
      if (str.startsWith('GROUP:')) return `🏷️ ${str.slice(6)}`
      if (str.startsWith('ZONE:')) {
        const [code, name] = str.slice(5).split('|')
        return code && name ? `區:${code}-${name}` : `區:${code || name}`
      }
      if (str.startsWith('CAT:')) {
        const [code, name] = str.slice(4).split('|')
        return code && name ? `大區:${code}-${name}` : `大區:${code || name}`
      }
      return str
    },
    getTargetChipClass(token) {
      const str = String(token || '')
      if (str.startsWith('GROUP:')) return 'chip-group'
      if (str.startsWith('ZONE:')) return 'chip-zone'
      return ''
    },

    resolveRuleArea(r) {
      if (r.area && ['A', 'B', 'C', 'D'].includes(String(r.area).trim().toUpperCase())) {
        return String(r.area).trim().toUpperCase()
      }
      const zn = String(r.zone_name || '')
      const m1 = zn.match(/([A-D])區/)
      if (m1) return m1[1]
      const m2 = zn.match(/80(?:C2|F3|H4)([A-D])/)
      if (m2) return m2[1]
      const xs = String(r.x_start || '')
      const m3 = xs.match(/^(?:C2|F3|H4)([A-D])/)
      if (m3) return m3[1]
      return ''
    },
    selectMapFloor(fl) {
      this.selectedMapFloor = fl
      this.selectedMapRacks = []
      const zones = FLOOR_MODULES[fl]?.zones || []
      this.selectedZoneId = zones[0]?.id || ''
      this.mapZoom = 1.15
    },
    selectMapZone(zoneId) {
      this.selectedZoneId = zoneId
      this.selectedMapRacks = []
    },
    isNodeSelected(node) {
      return this.selectedMapRacks.some(r => r.xCode === node.xCode && r.label === node.label)
    },
    clearMapSelection() {
      this.selectedMapRacks = []
    },
    selectAllRacksInZone() {
      if (!this.isSysAdmin) return
      const racks = (this.currentFloorCanvas.nodes || []).filter(n => n.isRack)
      const uniqueMap = new Map()
      racks.forEach(r => {
        const uid = `${r.xCode}|${r.label}`
        if (!uniqueMap.has(uid)) uniqueMap.set(uid, r)
      })
      this.selectedMapRacks = Array.from(uniqueMap.values())
      if (this.selectedMapRacks.length > 0) {
        this.showInspector = true
      }
      if (this.selectedMapRacks.length === 1) {
        this.loadSingleRackRule(this.selectedMapRacks[0])
      } else if (this.selectedMapRacks.length > 1) {
        this.resetMapBatchForm()
      }
    },
    openRackExceptionDialog(target) {
      const rackObj = typeof target === 'object' ? target : { xCode: target, label: target }
      const xCode = rackObj.xCode
      const range = this.parseRackYRange(rackObj.label, xCode)
      const fl = this.selectedMapFloor
      const ruleFl = this.currentRuleFloorKey

      const matches = (this.report.exceptions || []).filter(item => {
        const itemFl = String(item.floor || '').trim()
        const floorMatch = itemFl === fl || itemFl === ruleFl || (fl === '2F' && itemFl.startsWith('2F'))
        const m = String(item.bin_code || '').trim().toUpperCase().match(/^80([A-Z0-9]{3})(\d{2,3})/)
        const itemX = item.x_code || (m ? m[1] : '')
        const itemSubX = item.sub_x_code || (m ? `${m[1]}${String(parseInt(m[2], 10)).padStart(2, '0')}` : '')
        const itemY = Number(item.y_code || (m ? parseInt(m[2], 10) : 0))

        if (!floorMatch || (itemX !== xCode && itemSubX !== xCode)) return false
        if (range.hasYRange && itemY > 0) {
          return itemY >= range.yStart && itemY <= range.yEnd
        }
        return true
      })
      this.rackExceptionTitle = `${ruleFl} - ${rackObj.label || xCode}`
      this.rackExceptionList = matches
      this.showRackExceptionModal = true
    },
    exportRackExceptionsExcel() {
      const rows = [
        ['商品ID', '商品名稱', '儲位', 'PCS數', '大區編', '大區名', '區編', '區名', '材積別', '總才數', '月銷量', '建議擺放樓層', '區域', '層架類型(依總才數判斷)', '異常原因']
      ]
      this.rackExceptionList.forEach(item => {
        rows.push([
          item.sku_id,
          item.sku_name,
          item.bin_code,
          item.qty,
          item.cat_code || '',
          item.cat_name || '',
          item.zone_id || '',
          item.zone_name || '',
          item.vol_type || '',
          item.total_cubic_feet ?? 0,
          item.monthly_sales,
          item.suggested_floor || '',
          item.suggested_area || '',
          item.suggested_rack_type || '',
          item.reason
        ])
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '排號異常明細')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `異常儲位明細_${this.rackExceptionTitle}_${today}.xlsx`)
      ElMessage.success('🎉 已匯出本排異常清單 Excel！')
    },
    handleRackClick(node, event) {
      this.showInspector = true
      const isMulti = this.isSysAdmin && (this.mapMultiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey)
      if (isMulti) {
        const existsIdx = this.selectedMapRacks.findIndex(r => r.xCode === node.xCode && r.label === node.label)
        if (existsIdx !== -1) {
          this.selectedMapRacks.splice(existsIdx, 1)
        } else {
          this.selectedMapRacks.push(node)
        }
      } else {
        this.selectedMapRacks = [node]
      }

      if (this.selectedMapRacks.length === 1) {
        this.loadSingleRackRule(this.selectedMapRacks[0])
        if (!isMulti && (node.hasError || node.statusClass === 'fp-status-err')) {
          this.openRackExceptionDialog(node)
        }
      } else if (this.selectedMapRacks.length > 1) {
        this.resetMapBatchForm()
      }
    },
    resetMapBatchForm() {
      this.mapBatchForm = {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        target_type: 'KEEP',
        allowed_targets: [],
        applyTiers: false,
        allowed_sales_tiers: []
      }
    },
    buildRulePayloadForX(rackNode) {
      const node = typeof rackNode === 'object' ? rackNode : { xCode: rackNode, label: rackNode }
      const xCode = node.xCode
      const range = this.parseRackYRange(node.label, xCode)
      const segYStart = range.hasYRange ? String(range.yStart).padStart(3, '0') : '001'
      const segYEnd = range.hasYRange ? String(range.yEnd).padStart(3, '0') : '999'

      const ruleFl = this.currentRuleFloorKey
      const zoneArea = this.currentZoneAreaCode
      const targetRole = this.currentZoneObj?.defaultRole
      const isRoleSplitView = targetRole === 'PICK' || targetRole === 'STORAGE'
      const defaultRole = targetRole || 'PICK'

      const exactRule = this.rules.find(r => {
        if (!(r.floor === ruleFl || r.floor === this.selectedMapFloor)) return false
        if (r.x_start !== xCode || r.x_end !== xCode) return false
        if (isRoleSplitView && r.zone_role !== targetRole) return false
        if (range.hasYRange) {
          const rY1 = parseInt(r.y_start || '0', 10)
          const rY2 = parseInt(r.y_end || '999', 10)
          return rY1 === range.yStart && rY2 === range.yEnd
        }
        return true
      })

      if (exactRule) {
        const targets = [...(exactRule.allowed_targets || [])]
        return {
          ...exactRule,
          area: exactRule.area || zoneArea,
          zone_role: exactRule.zone_role || defaultRole,
          rack_length_m: Number(exactRule.rack_length_m || 20),
          target_type: this.detectTargetType(targets),
          allowed_targets: targets,
          allowed_volumes: [...(exactRule.allowed_volumes || [])],
          allowed_sales_tiers: [...(exactRule.allowed_sales_tiers || [])]
        }
      }

      const rangeRule = this.rules.find(r => {
        if (!(r.floor === ruleFl || r.floor === this.selectedMapFloor)) return false
        if (isRoleSplitView && r.zone_role !== targetRole) return false
        const matchX = (r.x_start === r.x_end && xCode.startsWith(r.x_start)) || (xCode >= r.x_start && xCode <= r.x_end)
        if (!matchX) return false
        if (range.hasYRange) {
          const rY1 = parseInt(r.y_start || '0', 10)
          const rY2 = parseInt(r.y_end || '999', 10)
          return range.yStart >= rY1 && range.yEnd <= rY2
        }
        return true
      })

      const defaultLayerStart = isRoleSplitView ? (targetRole === 'PICK' ? 'A' : 'C') : (rangeRule ? rangeRule.layer_start : 'A')
      const defaultLayerEnd = isRoleSplitView
        ? (targetRole === 'PICK' ? 'B' : (ruleFl === '6F' ? 'C' : 'E'))
        : (rangeRule ? rangeRule.layer_end : 'Z')
      const roleSuffix = isRoleSplitView ? (targetRole === 'PICK' ? ' (撿貨區)' : ' (庫區)') : ''
      const rangeTargets = rangeRule ? [...(rangeRule.allowed_targets || [])] : []

      return {
        id: null,
        zone_name: `${node.label || xCode + ' 排'}${roleSuffix}`,
        floor: ruleFl,
        storage_type: rangeRule ? rangeRule.storage_type : '重型層架',
        area: zoneArea || (rangeRule ? rangeRule.area : ''),
        x_start: xCode,
        x_end: xCode,
        y_start: range.hasYRange ? segYStart : (rangeRule ? rangeRule.y_start : '001'),
        y_end: range.hasYRange ? segYEnd : (rangeRule ? rangeRule.y_end : '999'),
        layer_start: defaultLayerStart,
        layer_end: defaultLayerEnd,
        zone_role: defaultRole,
        rack_length_m: rangeRule ? Number(rangeRule.rack_length_m || 20) : 20,
        allowed_trade: rangeRule ? rangeRule.allowed_trade : 'ALL',
        target_type: this.detectTargetType(rangeTargets),
        allowed_targets: rangeTargets,
        allowed_volumes: rangeRule ? [...(rangeRule.allowed_volumes || [])] : [],
        allowed_sales_tiers: rangeRule ? [...(rangeRule.allowed_sales_tiers || [])] : [],
        enabled: true
      }
    },
    loadSingleRackRule(node) {
      this.mapEditRule = this.buildRulePayloadForX(node)
    },
    async saveMapRackRule() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可修改儲位規則')
      this.batchSaving = true
      try {
        const payload = {
          ...this.mapEditRule,
          allowed_targets: this.mapEditRule.target_type === 'NONE' ? [] : [...(this.mapEditRule.allowed_targets || [])]
        }
        await axios.post('/api/storage-accuracy/rules/save', { rule: payload }, this.getAdminHeaders())
        ElMessage.success(`🎉 已儲存【${payload.floor} - ${payload.x_start} 排】設定！`)
        await this.refreshAll()
        if (this.selectedMapRacks.length === 1) {
          this.loadSingleRackRule(this.selectedMapRacks[0])
        }
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + (e.response?.data?.message || e.message))
      } finally {
        this.batchSaving = false
      }
    },
    async saveMapBatchRules() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可修改儲位規則')
      const f = this.mapBatchForm
      if (f.zone_role === 'KEEP' && !f.applyLength && f.allowed_trade === 'KEEP' && f.target_type === 'KEEP' && !f.applyTiers) {
        return ElMessage.warning('請至少選擇一項要批次套用的屬性！')
      }
      this.batchSaving = true
      try {
        const payloads = this.selectedMapRacks.map(rk => {
          const base = this.buildRulePayloadForX(rk)
          if (f.zone_role !== 'KEEP') base.zone_role = f.zone_role
          if (f.applyLength) base.rack_length_m = f.rack_length_m
          if (f.allowed_trade !== 'KEEP') base.allowed_trade = f.allowed_trade
          if (f.target_type === 'NONE') {
            base.allowed_targets = []
          } else if (['GROUP', 'ZONE', 'CAT'].includes(f.target_type)) {
            base.allowed_targets = [...f.allowed_targets]
          }
          if (f.applyTiers) base.allowed_sales_tiers = [...f.allowed_sales_tiers]
          return base
        })

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10)
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule }, this.getAdminHeaders())))
        }

        ElMessage.success(`🎉 已成功批次套用至 ${payloads.length} 段貨架！`)
        await this.refreshAll()
      } catch (e) {
        ElMessage.error('批次套用失敗：' + (e.response?.data?.message || e.message))
      } finally {
        this.batchSaving = false
      }
    },

    async refreshAll() {
      this.loading = true
      try {
        const [modeRes, ruleRes, lookupRes] = await Promise.all([
          axios.get('/api/storage-accuracy/mode-settings'),
          axios.get('/api/storage-accuracy/rules'),
          axios.get('/api/storage-accuracy/lookup-options')
        ])
        if (modeRes.data?.success && modeRes.data?.settings) {
          this.modeSettings = {
            ...this.modeSettings,
            ...modeRes.data.settings
          }
        }
        if (ruleRes.data?.success) this.rules = ruleRes.data.rules || []
        if (lookupRes.data?.success) {
          this.lookupOptions = {
            skus: lookupRes.data.skus || [],
            zones: lookupRes.data.zones || [],
            categories: lookupRes.data.categories || []
          }
        }

        const repRes = await axios.get(`/api/storage-accuracy/audit/report?mode=${this.modeSettings.mode}`)
        if (repRes.data?.success) this.report = repRes.data

        if (this.activeTab === 'simulation' && this.$refs.simTab) {
          await this.$refs.simTab.fetchSimulation()
        }
      } catch (e) {
        ElMessage.error('載入儲位準確率資料失敗：' + e.message)
      } finally {
        this.loading = false
      }
    },

    async saveModeSettings() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可儲存參數設定')
      try {
        const res = await axios.post('/api/storage-accuracy/mode-settings/save', { settings: this.modeSettings }, this.getAdminHeaders())
        if (res.data?.success) {
          this.modeSettings = res.data.settings
          ElMessage.success(res.data.message)
          await this.refreshAll()
        }
      } catch (e) {
        ElMessage.error('儲存參數設定失敗：' + (e.response?.data?.message || e.message))
      }
    },

    async applyModeFromSim(mode) {
      if (!this.isSysAdmin) return
      this.modeSettings.mode = mode
      await this.saveModeSettings()
    },

    toggleSelectAllPageRules(e) {
      const checked = e.target.checked
      const pageIds = this.paginatedRules.map(r => r.id)
      if (checked) {
        const set = new Set([...this.selectedRuleIds, ...pageIds])
        this.selectedRuleIds = Array.from(set)
      } else {
        this.selectedRuleIds = this.selectedRuleIds.filter(id => !pageIds.includes(id))
      }
    },
    openNewRuleModal() {
      this.ruleForm = {
        id: null,
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: '',
        x_start: '',
        x_end: '',
        y_start: '01',
        y_end: '99',
        layer_start: 'A',
        layer_end: 'Z',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        target_type: 'NONE',
        allowed_targets: [],
        allowed_volumes: [],
        allowed_sales_tiers: [],
        enabled: true
      }
      this.showRuleModal = true
    },
    openEditRuleModal(r) {
      const targets = [...(r.allowed_targets || [])]
      this.ruleForm = {
        ...r,
        area: this.resolveRuleArea(r),
        zone_role: r.zone_role || 'PICK',
        rack_length_m: Number(r.rack_length_m || 20),
        target_type: this.detectTargetType(targets),
        allowed_targets: targets,
        allowed_volumes: [...(r.allowed_volumes || [])],
        allowed_sales_tiers: [...(r.allowed_sales_tiers || [])]
      }
      this.showRuleModal = true
    },
    async submitRuleForm() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可修改儲位規則')
      if (!this.ruleForm.zone_name || !this.ruleForm.x_start) {
        return ElMessage.warning('請填寫區域名稱與 X 軸排號！')
      }
      const payload = {
        ...this.ruleForm,
        x_end: this.ruleForm.x_end || this.ruleForm.x_start,
        allowed_targets: this.ruleForm.target_type === 'NONE' ? [] : [...(this.ruleForm.allowed_targets || [])]
      }
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: payload }, this.getAdminHeaders())
        this.showRuleModal = false
        await this.refreshAll()
        ElMessage.success('🎉 已儲存儲位規則！')
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + (e.response?.data?.message || e.message))
      }
    },
    openTableBatchModal() {
      this.tableBatchForm = {
        area: 'KEEP',
        zone_role: 'KEEP',
        allowed_trade: 'KEEP',
        target_type: 'KEEP',
        allowed_targets: [],
        applyTiers: false,
        allowed_sales_tiers: []
      }
      this.showTableBatchModal = true
    },
    async submitTableBatchEdit() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可修改儲位規則')
      const f = this.tableBatchForm
      if (f.area === 'KEEP' && f.zone_role === 'KEEP' && f.allowed_trade === 'KEEP' && f.target_type === 'KEEP' && !f.applyTiers) {
        return ElMessage.warning('請至少選擇一項要修改的屬性！')
      }
      this.batchSaving = true
      try {
        const targets = this.rules.filter(r => this.selectedRuleIds.includes(r.id))
        const payloads = targets.map(r => {
          const copy = { ...r }
          if (f.area !== 'KEEP') copy.area = f.area
          if (f.zone_role !== 'KEEP') copy.zone_role = f.zone_role
          if (f.allowed_trade !== 'KEEP') copy.allowed_trade = f.allowed_trade
          if (f.target_type === 'NONE') {
            copy.allowed_targets = []
          } else if (['GROUP', 'ZONE', 'CAT'].includes(f.target_type)) {
            copy.allowed_targets = [...f.allowed_targets]
          }
          if (f.applyTiers) copy.allowed_sales_tiers = [...f.allowed_sales_tiers]
          return copy
        })

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10)
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule }, this.getAdminHeaders())))
        }

        this.showTableBatchModal = false
        this.selectedRuleIds = []
        await this.refreshAll()
        ElMessage.success(`🎉 已批次更新 ${payloads.length} 條規則！`)
      } catch (e) {
        ElMessage.error('批次更新失敗：' + (e.response?.data?.message || e.message))
      } finally {
        this.batchSaving = false
      }
    },
    async expandSingleRangeRule(rule) {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可操作')
      try {
        const res = await axios.post('/api/storage-accuracy/rules/expand', { ruleId: rule.id }, this.getAdminHeaders())
        if (res.data?.success) {
          ElMessage.success(res.data.message)
          await this.refreshAll()
        }
      } catch (e) {
        ElMessage.error('展開失敗：' + (e.response?.data?.message || e.message))
      }
    },
    deleteRule(rule) {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可刪除規則')
      ElMessageBox.confirm(`確定要刪除「${rule.floor} - ${rule.zone_name} (${rule.x_start})」嗎？`, '刪除規則確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await axios.post('/api/storage-accuracy/rules/delete', { id: rule.id }, this.getAdminHeaders())
        this.selectedRuleIds = this.selectedRuleIds.filter(id => id !== rule.id)
        await this.refreshAll()
        ElMessage.success('已刪除該條規則')
      }).catch(() => {})
    },

    exportRulesExcel() {
      const rows = [
        ['規則ID(勿改)', '啟用(1/0)', '樓層', '區(A~D)', '區域名稱', 'X軸起點', 'X軸終點', 'Y軸起點', 'Y軸終點', '層別起點', '層別終點', '區域用途(PICK/STORAGE/BOTH/CLOSED)', '層架長度(m)', '允許借採(ALL/借/採)', '第二順位專區/區名/大區代碼', '允許月銷級距(逗號分隔)']
      ]
      this.filteredRules.forEach(r => {
        rows.push([
          r.id || '',
          r.enabled ? 1 : 0,
          r.floor,
          this.resolveRuleArea(r),
          r.zone_name,
          r.x_start,
          r.x_end,
          r.y_start || '01',
          r.y_end || '99',
          r.layer_start || 'A',
          r.layer_end || 'Z',
          r.zone_role || 'PICK',
          r.rack_length_m || 20,
          r.allowed_trade || 'ALL',
          (r.allowed_targets || []).join(','),
          (r.allowed_sales_tiers || []).join(',')
        ])
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '80庫儲位規則')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `80庫儲位規則設定_${today}.xlsx`)
      ElMessage.success('🎉 已匯出儲位規則 Excel！')
    },
    triggerRuleExcelInput() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可匯入規則')
      if (this.$refs.ruleExcelInput) {
        this.$refs.ruleExcelInput.value = ''
        this.$refs.ruleExcelInput.click()
      }
    },
    async handleRuleExcelImport(e) {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可匯入規則')
      const file = e.target.files?.[0]
      if (!file) return
      this.batchSaving = true
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) throw new Error('Excel 檔案內容為空')

        const payloads = rows
          .filter(row => row['樓層'] && row['X軸起點'])
          .map(row => {
            const tiersRaw = String(row['允許月銷級距(逗號分隔)'] || '').trim()
            const targetsRaw = String(row['第二順位專區/區名/大區代碼'] || '').trim()
            return {
              id: row['規則ID(勿改)'] || null,
              enabled: String(row['啟用(1/0)']).trim() !== '0',
              floor: String(row['樓層']).trim(),
              area: String(row['區(A~D)'] || '').trim().toUpperCase(),
              zone_name: String(row['區域名稱'] || `${row['X軸起點']} 排`).trim(),
              x_start: String(row['X軸起點']).trim(),
              x_end: String(row['X軸終點'] || row['X軸起點']).trim(),
              y_start: String(row['Y軸起點'] || '01').trim(),
              y_end: String(row['Y軸終點'] || '99').trim(),
              layer_start: String(row['層別起點'] || 'A').trim(),
              layer_end: String(row['層別終點'] || 'Z').trim(),
              zone_role: String(row['區域用途(PICK/STORAGE/BOTH/CLOSED)'] || 'PICK').trim(),
              rack_length_m: Number(row['層架長度(m)'] || 20),
              allowed_trade: String(row['允許借採(ALL/借/採)'] || 'ALL').trim(),
              allowed_targets: targetsRaw ? targetsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
              allowed_sales_tiers: tiersRaw ? tiersRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
            }
          })

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10)
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule }, this.getAdminHeaders())))
        }

        await this.refreshAll()
        ElMessage.success(`🎉 成功匯入並更新 ${payloads.length} 條儲位規則！`)
      } catch (err) {
        ElMessage.error('匯入規則 Excel 失敗：' + (err.response?.data?.message || err.message))
      } finally {
        this.batchSaving = false
      }
    },

    triggerCsvInput() {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可上傳 80 庫 CSV')
      if (this.$refs.csvInput) {
        this.$refs.csvInput.value = ''
        this.$refs.csvInput.click()
      }
    },
    parseCsvLine(line) {
      const result = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          result.push(cur.trim())
          cur = ''
        } else {
          cur += ch
        }
      }
      result.push(cur.trim())
      return result
    },
    async handleCsvUpload(e) {
      if (!this.isSysAdmin) return ElMessage.warning('僅限系統管理員可上傳 80 庫 CSV')
      const file = e.target.files?.[0]
      if (!file) return
      this.uploading = true
      this.uploadProgressText = '讀取 CSV 檔案中...'

      try {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
        if (lines.length < 2) throw new Error('CSV 內容為空')

        const headers = this.parseCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/, ''))
        const idxSku = headers.indexOf('商品ID')
        const idxName = headers.indexOf('商品名稱')
        const idxTrade = headers.indexOf('借/採')
        const idxBin = headers.indexOf('儲位')
        const idxQty = headers.indexOf('儲位庫存數')
        const idxFloor = headers.indexOf('樓層')
        const idxArea = headers.indexOf('樓層區域')
        const idxType = headers.indexOf('儲位型態')
        const idxCatCode = headers.indexOf('大區編')
        const idxCatName = headers.indexOf('大區名')
        const idxZoneId = headers.indexOf('區編')
        const idxZoneName = headers.indexOf('區名')
        const idxVolType = headers.indexOf('材積別')
        const idxVol = headers.indexOf('材積判斷')
        const idxCubicFeet = headers.indexOf('才數')
        const idxTotalCubicFeet = headers.indexOf('總才數')
        const idxMonthlySales = headers.indexOf('(近)月銷量')
        const idxPickDaysM = headers.indexOf('(近)月-有揀貨單天數')
        const idxNote = headers.indexOf('備註')

        if (idxSku === -1 || idxBin === -1) {
          throw new Error('CSV 缺少「商品ID」或「儲位」欄位，請確認為 80 庫匯出檔')
        }

        const parsedRows = []
        for (let i = 1; i < lines.length; i++) {
          const cols = this.parseCsvLine(lines[i])
          const sku = cols[idxSku]
          const bin = cols[idxBin]
          if (!sku || !bin) continue

          const qtyVal = idxQty !== -1 ? Number(cols[idxQty] || 0) : 0
          const unitCf = idxCubicFeet !== -1 ? Number(String(cols[idxCubicFeet] || 0).replace(/,/g, '')) : 0
          const rawTotalCf = idxTotalCubicFeet !== -1 ? Number(String(cols[idxTotalCubicFeet] || 0).replace(/,/g, '')) : 0
          const totalCf = rawTotalCf > 0 ? rawTotalCf : Number((unitCf * qtyVal).toFixed(2))

          parsedRows.push({
            sku_id: sku,
            sku_name: idxName !== -1 ? cols[idxName] : '',
            trade_type: idxTrade !== -1 ? cols[idxTrade] : '',
            bin_code: bin,
            qty: qtyVal,
            floor: idxFloor !== -1 ? cols[idxFloor] : '',
            area: idxArea !== -1 ? cols[idxArea] : '',
            storage_type: idxType !== -1 ? cols[idxType] : '',
            cat_code: idxCatCode !== -1 ? cols[idxCatCode] : '',
            cat_name: idxCatName !== -1 ? cols[idxCatName] : '',
            zone_id: idxZoneId !== -1 ? cols[idxZoneId] : '',
            zone_name: idxZoneName !== -1 ? cols[idxZoneName] : '',
            vol_type: idxVolType !== -1 ? cols[idxVolType] : '',
            volume_type: idxVol !== -1 ? cols[idxVol] : '',
            total_cubic_feet: totalCf,
            monthly_sales: idxMonthlySales !== -1 ? Number(String(cols[idxMonthlySales] || 0).replace(/,/g, '')) : 0,
            pick_days_m: idxPickDaysM !== -1 ? Number(String(cols[idxPickDaysM] || 0).replace(/,/g, '')) : 0,
            note: idxNote !== -1 ? cols[idxNote] : ''
          })
        }

        const batchId = `batch_${Date.now()}`
        const chunkSize = 5000
        for (let offset = 0; offset < parsedRows.length; offset += chunkSize) {
          const chunk = parsedRows.slice(offset, offset + chunkSize)
          this.uploadProgressText = `寫入資料庫中 (${Math.min(offset + chunkSize, parsedRows.length).toLocaleString()} / ${parsedRows.length.toLocaleString()})...`
          await axios.post('/api/storage-accuracy/audit/upload-chunk', {
            batchId,
            isFirstChunk: offset === 0,
            rows: chunk
          }, this.getAdminHeaders())
        }

        this.uploadProgressText = '計算擺放準確率與動線分析中...'
        await this.refreshAll()
        ElMessage.success(`🎉 成功匯入 ${parsedRows.length.toLocaleString()} 筆 80 庫儲位明細並完成準確率稽核！`)
      } catch (err) {
        ElMessage.error('上傳 80 庫 CSV 失敗：' + (err.response?.data?.message || err.message))
      } finally {
        this.uploading = false
        this.uploadProgressText = ''
      }
    },
    exportExceptionsExcel() {
      const rows = [
        ['商品ID', '商品名稱', '借/採', '大區編', '商品大區', '區編', '區名', '材積別', '總才數', '月銷量', '月銷級距', '樓層', '目前儲位', '區域用途', '庫存數', '建議擺放樓層', '建議區域', '層架類型(依總才數判斷)', '異常原因']
      ]
      this.filteredExceptions.forEach(item => {
        rows.push([
          item.sku_id,
          item.sku_name,
          item.trade_type,
          item.cat_code || '',
          item.cat_name,
          item.zone_id || '',
          item.zone_name || '',
          item.vol_type || '',
          item.total_cubic_feet ?? 0,
          item.monthly_sales,
          item.sales_tier_label,
          item.floor,
          item.bin_code,
          item.zone_role_label,
          item.qty,
          item.suggested_floor || '',
          item.suggested_area || '',
          item.suggested_rack_type || '',
          item.reason
        ])
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '儲位異常移庫清單')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `80庫儲位異常移庫單_${today}.xlsx`)
      ElMessage.success('🎉 已成功匯出儲位異常移庫單！')
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
.header-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
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
  padding: 5px 11px;
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

.breakdown-grid-4 { display: grid; grid-template-columns: 1.15fr 1fr 1fr 1.3fr; gap: 10px; height: 215px; flex-shrink: 0; }
.panel-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.panel-head { background: #0f172a; padding: 7px 12px; font-size: 13px; font-weight: bold; border-bottom: 1px solid #334155; flex-shrink: 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.stat-list { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.stat-row { display: grid; grid-template-columns: 95px 84px 1fr 46px; align-items: center; gap: 6px; font-size: 12px; }
.st-cnt { color: #94a3b8; font-size: 11px; text-align: right; }
.st-bar-wrap { height: 7px; background: #334155; border-radius: 4px; overflow: hidden; }
.st-bar { height: 100%; }
.st-pct { font-weight: bold; text-align: right; }

.role-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; }
.role-PICK { background: rgba(74, 222, 128, 0.16); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.35); }
.role-STORAGE { background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
.role-BOTH { background: rgba(250, 204, 21, 0.16); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.35); }
.role-CLOSED { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); }

.area-badge {
  display: inline-block;
  background: rgba(168, 85, 247, 0.18);
  border: 1px solid rgba(168, 85, 247, 0.45);
  color: #d8b4fe;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.closed-rule-row td { background: rgba(239, 68, 68, 0.06) !important; }
.selected-rule-row td { background: rgba(56, 189, 248, 0.12) !important; }
.status-dot-txt { font-size: 11px; font-weight: bold; }
.cat-chip {
  display: inline-block;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #7dd3fc;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  margin: 1px 3px 1px 0;
}
.cat-chip.chip-group {
  background: rgba(250, 204, 21, 0.18);
  border-color: rgba(250, 204, 21, 0.45);
  color: #fde047;
  font-weight: bold;
}
.cat-chip.chip-zone {
  background: rgba(168, 85, 247, 0.18);
  border-color: rgba(168, 85, 247, 0.45);
  color: #d8b4fe;
}

.tier-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.tier-A { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
.tier-B { background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); }
.tier-C { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.tier-D { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }

.fp-toolbar { padding: 8px 12px; flex-shrink: 0; gap: 8px; }
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
.fp-fl-btn.active { background: #2563eb; border-color: #60a5fa; color: #ffffff; }

.fp-zone-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  background: #0f172a;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
}
.zone-bar-title { font-size: 12px; font-weight: bold; color: #38bdf8; white-space: nowrap; }
.fp-zone-tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fp-zone-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #e2e8f0;
  padding: 4px 11px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.12s;
}
.fp-zone-btn:hover { border-color: #38bdf8; color: #ffffff; }
.fp-zone-btn.active {
  background: linear-gradient(90deg, #0284c7, #0d9488);
  border-color: #38bdf8;
  color: #ffffff;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
}

.fp-legend { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #cbd5e1; flex-wrap: wrap; }
.leg-item { display: inline-flex; align-items: center; gap: 5px; }
.leg-dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.dot-buy { background: #2563eb; border: 1px solid #60a5fa; }
.dot-borrow { background: #d97706; border: 1px solid #fbbf24; }
.dot-cat { background: #059669; border: 1px solid #34d399; }
.dot-closed { background: #334155; border: 1px dashed #94a3b8; }
.dot-err { background: #dc2626; border: 1px solid #f87171; }
.fp-zoom-controls { display: flex; align-items: center; gap: 6px; }

.fp-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 330px; gap: 10px; }
.fp-workspace.inspector-hidden { grid-template-columns: 1fr; }

.hide-inspector-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #cbd5e1;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.hide-inspector-btn:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.reopen-inspector-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 45;
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid #38bdf8;
  color: #38bdf8;
  font-size: 12px;
  font-weight: bold;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.reopen-inspector-btn:hover {
  background: #0284c7;
  color: #ffffff;
}

.fp-canvas-wrapper { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.fp-canvas-scroll { flex: 1; background: #090e1a; border: 1px solid #334155; border-radius: 8px; overflow: auto; position: relative; }
.fp-canvas { position: relative; }
.fp-scale-inner { position: relative; }

.compass-widget {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 40;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #38bdf8;
  border-radius: 10px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55);
}
.compass-ring { position: relative; width: 82px; height: 64px; display: flex; align-items: center; justify-content: center; }
.cmp-dir { position: absolute; font-size: 10px; font-weight: bold; color: #94a3b8; white-space: nowrap; }
.cmp-east { color: #facc15; text-shadow: 0 0 6px rgba(250, 204, 21, 0.45); }
.cmp-top { top: 0; left: 50%; transform: translateX(-50%); }
.cmp-bottom { bottom: 0; left: 50%; transform: translateX(-50%); }
.cmp-left { left: 0; top: 50%; transform: translateY(-50%); }
.cmp-right { right: 0; top: 50%; transform: translateY(-50%); }
.compass-needle { font-size: 16px; color: #facc15; font-weight: bold; line-height: 1; transition: transform 0.25s ease; }
.needle-up { transform: rotate(0deg); }
.needle-right { transform: rotate(90deg); }
.compass-caption { font-size: 10px; color: #38bdf8; font-weight: bold; }

.edge-east-banner {
  position: absolute;
  background: rgba(250, 204, 21, 0.14);
  border: 1px dashed rgba(250, 204, 21, 0.6);
  color: #fde047;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  pointer-events: none;
}
.edge-top { top: 4px; left: 34px; right: 34px; height: 22px; }
.edge-right { top: 34px; bottom: 34px; right: 4px; width: 24px; writing-mode: vertical-rl; }

.fp-zone-svg-outline {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}

.fp-struct-col {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #020617;
  border: 1.5px solid #94a3b8;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.85);
  z-index: 6;
  pointer-events: none;
}

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
  z-index: 2;
}
.fp-landmark-node {
  background: rgba(51, 65, 85, 0.35);
  border: 1px dashed #475569;
  color: #94a3b8;
  font-size: 11px;
  font-weight: bold;
  pointer-events: none;
}
.fp-rack-node { cursor: pointer; font-size: 10px; font-weight: bold; color: #ffffff; }
.fp-rack-node:hover { z-index: 20; transform: scale(1.12); box-shadow: 0 0 10px rgba(56, 189, 248, 0.85); }
.fp-selected { outline: 2px solid #facc15 !important; box-shadow: 0 0 10px rgba(250, 204, 21, 0.8); z-index: 25; }

.fp-status-unset { background: #1e293b; border: 1px solid #64748b; color: #cbd5e1; }
.fp-status-buy { background: #1d4ed8; border: 1px solid #60a5fa; }
.fp-status-borrow { background: #b45309; border: 1px solid #fbbf24; }
.fp-status-cat { background: #047857; border: 1px solid #34d399; }
.fp-status-closed {
  background: repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #334155 4px, #334155 8px);
  border: 1px dashed #94a3b8;
  color: #94a3b8;
}
.fp-status-err { background: #b91c1c; border: 1px solid #f87171; }

.fp-node-txt { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; padding: 0 2px; }
.fp-vertical-txt { writing-mode: vertical-rl; text-orientation: mixed; }

.fp-inspector { overflow-y: auto; }
.fp-inspector-empty { padding: 36px 16px; text-align: center; color: #cbd5e1; font-size: 13px; }
.fp-inspector-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.insp-title-box { border-bottom: 1px solid #334155; padding-bottom: 6px; }
.selected-tags-box { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; max-height: 78px; overflow-y: auto; }
.mini-rack-tag { background: rgba(250, 204, 21, 0.18); border: 1px solid rgba(250, 204, 21, 0.45); color: #fde047; font-size: 11px; font-weight: bold; padding: 1px 6px; border-radius: 4px; }
.insp-stat-card, .insp-rule-form { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px; }
.insp-sub-title { font-size: 12px; font-weight: bold; color: #38bdf8; margin-bottom: 6px; }
.insp-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px; }

.exception-table-card, .rules-table-card { flex: 1; min-height: 0; }
.exc-filters, .rule-filters, .rule-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rules-toolbar-card { padding: 8px 12px; flex-shrink: 0; }

.pagination-bar {
  background: #0f172a;
  border-top: 1px solid #334155;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

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
.bg-purple { background: #c084fc; }
.bg-red { background: #f87171; }
.text-blue { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-green { color: #4ade80; }
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.text-dim { color: #94a3b8; }
.font-bold { font-weight: bold; }
</style>

<style>
.el-dialog.dark-dialog {
  background: #0f172a !important;
  border: 1px solid #475569 !important;
  border-radius: 8px !important;
}
.el-dialog.dark-dialog .el-dialog__header {
  background: #1e293b !important;
  border-bottom: 1px solid #334155 !important;
  padding: 12px 16px !important;
  margin-right: 0 !important;
  border-radius: 8px 8px 0 0 !important;
}
.el-dialog.dark-dialog .el-dialog__title {
  color: #38bdf8 !important;
  font-weight: bold !important;
  font-size: 15px !important;
}
.el-dialog.dark-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #e2e8f0 !important;
}
.el-dialog.dark-dialog .el-dialog__body {
  background: #0f172a !important;
  color: #f8fafc !important;
  padding: 16px !important;
}
.el-dialog.dark-dialog .el-dialog__footer {
  background: #1e293b !important;
  border-top: 1px solid #334155 !important;
  padding: 10px 16px !important;
  border-radius: 0 0 8px 8px !important;
}
.el-dialog.dark-dialog .m-lbl {
  color: #f1f5f9 !important;
  font-weight: bold !important;
}
.el-dialog.dark-dialog .el-switch__label {
  color: #cbd5e1 !important;
}
.el-dialog.dark-dialog .el-switch__label.is-active {
  color: #38bdf8 !important;
}
.el-dialog.dark-dialog .el-checkbox__label {
  color: #f1f5f9 !important;
}
</style>