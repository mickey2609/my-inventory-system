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
            @click="activeTab = 'simulation'; fetchSimulation()"
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
            type="button"
            class="sub-tab-btn"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            ⚙️ 儲位規則總表 ({{ rules.length }} 條)
          </button>
        </div>
      </div>

      <div class="header-right">
        <el-select
          v-model="modeSettings.mode"
          size="mini"
          style="width: 185px;"
          @change="saveModeSettings"
        >
          <el-option label="模式1：大區 + 借採" value="CAT_TRADE" />
          <el-option label="模式2：月銷 + 借採" value="SALES_TRADE" />
          <el-option label="模式3：大區 + 月銷 + 借採" value="CAT_SALES_TRADE" />
        </el-select>

        <span v-if="uploadProgressText" class="upload-status-pill">{{ uploadProgressText }}</span>
        <el-button size="mini" type="success" icon="el-icon-upload2" :loading="uploading" @click="triggerCsvInput">
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
          <div class="kpi-lbl">🎯 當前模式擺放準確率</div>
          <div class="kpi-num" :class="report.summary.accuracyPct >= 95 ? 'text-green' : 'text-yellow'">
            {{ report.summary.accuracyPct }}%
          </div>
        </div>
      </div>

      <div v-if="!report.hasData" class="empty-guide-card">
        <h4>尚未匯入 80 庫庫存快照資料</h4>
        <p>您可先切換至 <strong>「🗺️ 樓層儲位平面配置圖」</strong> 點選或框選貨架設定用途（庫區 / 撿貨區 / 庫區+撿貨區 / 關閉中），再上傳 80 庫 CSV 即可自動分析！</p>
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
            <span>🚨 放錯儲位異常移庫清單（共 {{ filteredExceptions.length }} 筆異常｜當前模式：{{ modeLabelMap[modeSettings.mode] }}）</span>
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
                  <th>商品大區</th>
                  <th>月銷量</th>
                  <th>月銷級距</th>
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
                  <td>{{ item.cat_name }}</td>
                  <td class="font-bold text-yellow">{{ item.monthly_sales }}</td>
                  <td>
                    <span class="tier-pill" :class="`tier-${item.sales_tier}`">{{ item.sales_tier_label }}</span>
                  </td>
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
    <div v-if="activeTab === 'simulation'" class="tab-content" v-loading="simLoading">
      <div v-if="!simData.hasData" class="empty-guide-card">
        <h4>尚無 80 庫庫存數據可供動線模擬</h4>
        <p>請先上傳 80 庫 CSV（或從首頁匯入 80 庫），系統即可自動依區域用途與層架公尺數算出揀貨距離！</p>
      </div>

      <template v-else>
        <div class="sim-modes-grid">
          <div
            v-for="m in simData.modesComparison"
            :key="m.mode"
            class="sim-mode-card"
            :class="{ 'sim-recommended': m.recommended, 'sim-active': modeSettings.mode === m.mode }"
          >
            <div class="sim-card-top">
              <div class="sim-mode-title">{{ m.name }}</div>
              <div class="sim-badges">
                <span v-if="m.recommended" class="rec-badge">🏆 系統推薦最佳平衡</span>
                <span v-if="modeSettings.mode === m.mode" class="cur-badge">目前啟用中</span>
              </div>
            </div>

            <div class="sim-metrics-row">
              <div class="sim-metric">
                <span class="sm-lbl">🚶 撿貨區月步行總里程</span>
                <span class="sm-val text-blue">{{ m.walkDistanceIndex }} <small style="font-size: 11px;">km</small></span>
                <span v-if="m.walkSavingPct > 0" class="sm-sub text-green">
                  ▼ 省 {{ m.savedKm }} km ({{ m.walkSavingPct }}% / 約 {{ m.savedHours }} 小時)
                </span>
                <span v-else class="sm-sub text-dim">7F A區出發往返基準</span>
              </div>
              <div class="sim-metric">
                <span class="sm-lbl">🔥 黃金區位爆品率</span>
                <span class="sm-val text-yellow">{{ m.goldenHotPct }}%</span>
                <span class="sm-sub text-dim">7F/6F撿貨區佔比</span>
              </div>
              <div class="sim-metric">
                <span class="sm-lbl">🧭 找貨直覺度評分</span>
                <span class="sm-val text-purple">{{ m.findEaseScore }} 分</span>
                <span class="sm-sub text-dim">品類聚合度指標</span>
              </div>
            </div>

            <div class="sim-desc-box">
              <div><strong>📦 搬遷調整成本：</strong><span class="text-yellow">{{ m.moveEffortLevel }}</span></div>
              <div style="margin-top: 4px;"><strong class="text-green">✅ 優勢：</strong>{{ m.pros }}</div>
              <div style="margin-top: 2px;"><strong class="text-red">⚠️ 限制：</strong>{{ m.cons }}</div>
            </div>

            <div style="margin-top: auto; padding-top: 8px;">
              <el-button
                size="mini"
                :type="m.recommended ? 'success' : 'primary'"
                :plain="modeSettings.mode === m.mode"
                style="width: 100%;"
                @click="applyModeFromSim(m.mode)"
              >
                {{ modeSettings.mode === m.mode ? '✓ 已套用此擺放模式' : '⚡ 一鍵切換套用此模式' }}
              </el-button>
            </div>
          </div>
        </div>

        <div class="sim-bottom-grid">
          <div class="panel-card">
            <div class="panel-head">📊 現況 80 庫月銷量級距與黃金區位佔比分析</div>
            <div class="table-scroll">
              <table class="dark-table">
                <thead>
                  <tr>
                    <th>月銷級距</th>
                    <th>品項數</th>
                    <th>儲位筆數</th>
                    <th>月總銷量</th>
                    <th>月揀貨單天數</th>
                    <th>已放黃金區位</th>
                    <th>黃金區位佔比</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in simData.tierDistribution" :key="t.tier">
                    <td><span class="tier-pill" :class="`tier-${t.tier}`">{{ t.label }}</span></td>
                    <td class="font-bold">{{ t.skuCount.toLocaleString() }}</td>
                    <td>{{ t.binCount.toLocaleString() }}</td>
                    <td class="text-yellow font-bold">{{ Math.round(t.totalSales).toLocaleString() }}</td>
                    <td class="text-blue font-bold">{{ Math.round(t.pickFreq).toLocaleString() }}</td>
                    <td class="text-green font-bold">{{ t.goldenBins.toLocaleString() }}</td>
                    <td class="font-bold">
                      {{ t.binCount > 0 ? ((t.goldenBins / t.binCount) * 100).toFixed(1) : 0 }}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-head">🚀 優先移庫建議：關閉中殘留庫存 / 庫區爆品 / 遠端爆品（Top 15）</div>
            <div class="table-scroll">
              <table class="dark-table">
                <thead>
                  <tr>
                    <th>商品ID</th>
                    <th>商品名稱</th>
                    <th>月銷量</th>
                    <th>目前樓層/儲位</th>
                    <th>目前用途</th>
                    <th>往返距離</th>
                    <th>優先處置建議</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="simData.topMoveCandidates.length === 0">
                    <td colspan="7" class="empty-td">🎉 目前無關閉中殘留庫存或急需前移的爆品！</td>
                  </tr>
                  <tr v-for="(c, i) in simData.topMoveCandidates" :key="i">
                    <td class="text-blue font-bold">{{ c.sku_id }}</td>
                    <td class="text-left">{{ c.sku_name }}</td>
                    <td class="text-yellow font-bold">{{ c.monthly_sales }}</td>
                    <td class="text-red font-bold">{{ c.floor }} / {{ c.bin_code }}</td>
                    <td><span class="role-pill" :class="`role-${c.zoneRole}`">{{ c.zone_role_label }}</span></td>
                    <td class="text-yellow font-bold">{{ c.roundTripM }} m</td>
                    <td class="text-left text-green">{{ c.moveReason }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ==================== TAB 3: 樓層儲位平面配置圖（主力規則編輯器＋多選批次） ==================== -->
    <div v-if="activeTab === 'floorplan'" class="tab-content" v-loading="loading">
      <div class="panel-card fp-toolbar">
        <!-- 第一排：樓層切換 ＋ 著色視角切換 ＋ 縮放 -->
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
              <el-option label="🗂️ 依商品大區設定" value="CATEGORY" />
              <el-option label="🔥 依月銷級距設定" value="SALES_TIER" />
            </el-select>

            <el-checkbox v-model="mapMultiSelectMode" size="mini" border>
              多選模式 (或按 Ctrl 點選)
            </el-checkbox>
            <el-button size="mini" type="info" plain @click="selectAllRacksInZone">
              全選本區
            </el-button>
            <el-button v-if="selectedMapRacks.length > 0" size="mini" plain @click="clearMapSelection">
              清除選取 ({{ selectedMapRacks.length }})
            </el-button>
          </div>

          <div class="fp-zoom-controls">
            <span class="text-dim" style="font-size: 12px;">縮放：</span>
            <el-button size="mini" @click="mapZoom = Math.max(0.5, Number((mapZoom - 0.15).toFixed(2)))">－</el-button>
            <span class="font-bold" style="font-size: 12px; min-width: 42px; text-align: center;">{{ Math.round(mapZoom * 100) }}%</span>
            <el-button size="mini" @click="mapZoom = Math.min(2.2, Number((mapZoom + 0.15).toFixed(2)))">＋</el-button>
          </div>
        </div>

        <!-- 第二排：該樓層獨立分區按鈕 ＋ 動態圖例 -->
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

          <!-- 依著色視角動態切換圖例 -->
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
            <span class="leg-item"><i class="leg-dot dot-cat"></i> 已設大區/月銷</span>
            <span class="leg-item"><i class="leg-dot dot-closed"></i> 🚫 關閉中</span>
            <span class="leg-item"><i class="leg-dot dot-err"></i> 含異常庫存</span>
          </div>
        </div>
      </div>

      <div class="fp-workspace">
        <div class="fp-canvas-wrapper">
          <!-- 方位羅盤圖標 -->
          <div class="compass-widget" :title="isEastRightOrientation ? '目前視角：東側碼頭朝右、北側(A區)朝上' : '目前視角：東側碼頭朝上、北側(A區)朝左'">
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

                <!-- 建築結構外圍框 -->
                <div
                  v-if="currentFloorCanvas.outerFrame"
                  class="fp-zone-outline"
                  :style="{
                    left: `${currentFloorCanvas.outerFrame.left}px`,
                    top: `${currentFloorCanvas.outerFrame.top}px`,
                    width: `${currentFloorCanvas.outerFrame.width}px`,
                    height: `${currentFloorCanvas.outerFrame.height}px`
                  }"
                ></div>

                <!-- 12m 標準建築柱位黑方塊 -->
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

        <!-- 右側屬性與規則編輯面板（支援單排 & 多排批次套用） -->
        <div class="panel-card fp-inspector">
          <div class="panel-head">
            {{ selectedMapRacks.length > 1 ? `⚡ 批次設定已選取 (${selectedMapRacks.length} 排)` : '🔎 儲位屬性與規則設定' }}
          </div>

          <!-- 狀態 0：未選取 -->
          <div v-if="selectedMapRacks.length === 0" class="fp-inspector-empty">
            <div style="font-size: 28px; margin-bottom: 8px;">👆</div>
            <div>目前檢視：<strong>{{ selectedMapFloor }} {{ currentZoneObj?.label }}</strong></div>
            <div class="text-dim" style="font-size: 12px; margin-top: 8px; line-height: 1.6;">
              • <strong>單排設定</strong>：直接點擊任一排貨架<br />
              • <strong>多排批次設定</strong>：按住 <kbd>Ctrl</kbd> 連續點選多排（或點上方「全選本區」），即可一次套用規則！
            </div>
          </div>

          <!-- 狀態 1：單排精準編輯 -->
          <div v-else-if="selectedMapRacks.length === 1" class="fp-inspector-body">
            <div class="insp-title-box">
              <div class="text-blue font-bold" style="font-size: 15px;">{{ currentRuleFloorKey }} - {{ selectedMapRacks[0].xCode }} 排</div>
              <div class="text-dim" style="font-size: 11px;">完整標示：{{ selectedMapRacks[0].label }}</div>
            </div>

            <div class="insp-stat-card">
              <div class="insp-sub-title">📦 目前該排庫存統計</div>
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

            <div class="insp-rule-form">
              <div class="insp-sub-title">⚙️ 設定【{{ selectedMapRacks[0].xCode }} 排】屬性與規則</div>

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

              <label class="m-lbl">允許借 / 採：</label>
              <el-select v-model="mapEditRule.allowed_trade" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="借採皆可" value="ALL" />
                <el-option label="僅限「借」" value="借" />
                <el-option label="僅限「採」" value="採" />
              </el-select>

              <label class="m-lbl">允許月銷量級距（可多選）：</label>
              <el-select
                v-model="mapEditRule.allowed_sales_tiers"
                multiple
                size="mini"
                placeholder="不限月銷級距"
                style="width: 100%; margin-bottom: 8px;"
              >
                <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
                <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
                <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
                <el-option label="D級滯銷 (0)" value="D" />
              </el-select>

              <label class="m-lbl">允許商品大區（可多選）：</label>
              <el-select
                v-model="mapEditRule.allowed_categories"
                multiple
                filterable
                size="mini"
                placeholder="不限大區"
                style="width: 100%; margin-bottom: 8px;"
              >
                <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
              </el-select>

              <label class="m-lbl">允許材積：</label>
              <el-select
                v-model="mapEditRule.allowed_volumes"
                multiple
                size="mini"
                placeholder="不限材積"
                style="width: 100%; margin-bottom: 10px;"
              >
                <el-option label="小材積" value="小材積" />
                <el-option label="大材積" value="大材積" />
                <el-option label="超大材" value="超大材" />
              </el-select>

              <el-button type="primary" size="mini" style="width: 100%;" :loading="batchSaving" @click="saveMapRackRule">
                💾 儲存【{{ selectedMapRacks[0].xCode }}】設定並重算
              </el-button>
            </div>
          </div>

          <!-- 狀態 2：多排批次設定模式 -->
          <div v-else class="fp-inspector-body">
            <div class="insp-title-box">
              <div class="text-yellow font-bold" style="font-size: 14px;">
                已選取 {{ selectedMapRacks.length }} 排貨架
              </div>
              <div class="selected-tags-box">
                <span v-for="rk in selectedMapRacks" :key="rk.xCode" class="mini-rack-tag">
                  {{ rk.xCode }}
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

              <label class="m-lbl">允許借 / 採：</label>
              <el-select v-model="mapBatchForm.allowed_trade" size="mini" style="width: 100%; margin-bottom: 8px;">
                <el-option label="（維持各排原設定）" value="KEEP" />
                <el-option label="借採皆可" value="ALL" />
                <el-option label="僅限「借」" value="借" />
                <el-option label="僅限「採」" value="採" />
              </el-select>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <label class="m-lbl" style="margin: 0;">允許月銷量級距：</label>
                <el-checkbox v-model="mapBatchForm.applyTiers" size="mini">覆蓋月銷</el-checkbox>
              </div>
              <el-select
                v-model="mapBatchForm.allowed_sales_tiers"
                :disabled="!mapBatchForm.applyTiers"
                multiple
                size="mini"
                placeholder="勾選右側後選擇級距（留空=不限）"
                style="width: 100%; margin-bottom: 8px;"
              >
                <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
                <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
                <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
                <el-option label="D級滯銷 (0)" value="D" />
              </el-select>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <label class="m-lbl" style="margin: 0;">允許商品大區：</label>
                <el-checkbox v-model="mapBatchForm.applyCats" size="mini">覆蓋大區</el-checkbox>
              </div>
              <el-select
                v-model="mapBatchForm.allowed_categories"
                :disabled="!mapBatchForm.applyCats"
                multiple
                filterable
                size="mini"
                placeholder="勾選右側後選擇大區（留空=不限）"
                style="width: 100%; margin-bottom: 10px;"
              >
                <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
              </el-select>

              <el-button type="success" size="mini" style="width: 100%;" :loading="batchSaving" @click="saveMapBatchRules">
                ⚡ 批次套用至這 {{ selectedMapRacks.length }} 排並重算
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== TAB 4: 儲位規則總表（純標籤＋分頁秒開＋Excel匯出入） ==================== -->
    <div v-if="activeTab === 'rules'" class="tab-content" v-loading="loading || batchSaving">
      <div class="panel-card rules-toolbar-card">
        <div class="row-between">
          <div class="rule-filters">
            <el-select v-model="ruleFloorFilter" size="mini" style="width: 110px;" @change="rulePage = 1">
              <el-option label="全部樓層" value="ALL" />
              <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
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
              placeholder="搜尋區域名稱、X軸或大區..."
              style="width: 205px;"
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
            <el-button size="mini" type="warning" plain @click="showTierModal = true">
              🔥 月銷門檻設定
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
                <th style="width: 135px;">區域名稱</th>
                <th style="width: 110px;">X軸 (排號)</th>
                <th style="width: 90px;">Y軸 / 層</th>
                <th style="width: 110px;">🏷️ 區域用途</th>
                <th style="width: 80px;">📏 層架(m)</th>
                <th style="width: 85px;">借 / 採</th>
                <th style="width: 145px;">允許月銷級距</th>
                <th>允許商品大區</th>
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
                <td class="font-bold">{{ r.rack_length_m || 20 }} m</td>
                <td>
                  <span v-if="r.allowed_trade === '借'" class="trade-pill pill-borrow">僅限借</span>
                  <span v-else-if="r.allowed_trade === '採'" class="trade-pill pill-buy">僅限採</span>
                  <span v-else class="text-dim">皆可</span>
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
                <td class="text-left">
                  <template v-if="r.allowed_categories && r.allowed_categories.length">
                    <span v-for="c in r.allowed_categories" :key="c" class="cat-chip">{{ c }}</span>
                  </template>
                  <span v-else class="text-dim">不限大區</span>
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

        <!-- 分頁控制列 -->
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

    <!-- Modal 1: 新增 / 編輯單條規則 -->
    <el-dialog
      v-model="showRuleModal"
      :title="ruleForm.id ? `✏️ 編輯儲位規則（${ruleForm.floor} - ${ruleForm.x_start}）` : '➕ 新增儲位擺放規則'"
      width="640px"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="modal-grid-2">
        <div>
          <label class="m-lbl">區域名稱 *</label>
          <el-input v-model="ruleForm.zone_name" size="mini" placeholder="例如: 80C2A03 排" />
        </div>
        <div>
          <label class="m-lbl">樓層 *</label>
          <el-select v-model="ruleForm.floor" size="mini" style="width: 100%;">
            <el-option v-for="fl in floorOptions" :key="fl" :label="fl" :value="fl" />
          </el-select>
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
          <label class="m-lbl">📏 層架總長度 (公尺)</label>
          <el-input-number v-model="ruleForm.rack_length_m" :min="0.5" :max="200" :step="0.5" size="mini" style="width: 100%;" />
        </div>
        <div>
          <label class="m-lbl">允許借 / 採</label>
          <el-select v-model="ruleForm.allowed_trade" size="mini" style="width: 100%;">
            <el-option label="借採皆可" value="ALL" />
            <el-option label="僅限「借」" value="借" />
            <el-option label="僅限「採」" value="採" />
          </el-select>
        </div>
        <div>
          <label class="m-lbl">啟用狀態</label>
          <el-switch v-model="ruleForm.enabled" active-text="啟用中" inactive-text="已停用" />
        </div>
        <div style="grid-column: span 2;">
          <label class="m-lbl">允許月銷量級距（可多選，留空代表不限）</label>
          <el-select v-model="ruleForm.allowed_sales_tiers" multiple size="mini" style="width: 100%;">
            <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
            <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
            <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
            <el-option label="D級滯銷 (0)" value="D" />
          </el-select>
        </div>
        <div style="grid-column: span 2;">
          <label class="m-lbl">允許商品大區（可多選，留空代表不限）</label>
          <el-select v-model="ruleForm.allowed_categories" multiple filterable size="mini" style="width: 100%;">
            <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
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
      custom-class="dark-dialog"
    >
      <div style="display: flex; flex-direction: column; gap: 10px;">
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
          <div style="display: flex; justify-content: space-between;">
            <label class="m-lbl">📏 層架長度（公尺）：</label>
            <el-checkbox v-model="tableBatchForm.applyLength" size="mini">套用新長度</el-checkbox>
          </div>
          <el-input-number v-model="tableBatchForm.rack_length_m" :disabled="!tableBatchForm.applyLength" :min="0.5" :max="200" :step="0.5" size="mini" style="width: 100%;" />
        </div>
        <div>
          <label class="m-lbl">允許借 / 採：</label>
          <el-select v-model="tableBatchForm.allowed_trade" size="mini" style="width: 100%;">
            <el-option label="（維持原設定）" value="KEEP" />
            <el-option label="借採皆可" value="ALL" />
            <el-option label="僅限「借」" value="借" />
            <el-option label="僅限「採」" value="採" />
          </el-select>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between;">
            <label class="m-lbl">允許月銷量級距：</label>
            <el-checkbox v-model="tableBatchForm.applyTiers" size="mini">覆蓋月銷設定</el-checkbox>
          </div>
          <el-select v-model="tableBatchForm.allowed_sales_tiers" :disabled="!tableBatchForm.applyTiers" multiple size="mini" style="width: 100%;">
            <el-option :label="`A級爆品 (≥${modeSettings.tierA_min})`" value="A" />
            <el-option :label="`B級常銷 (${modeSettings.tierB_min}~${modeSettings.tierA_min - 1})`" value="B" />
            <el-option :label="`C級慢銷 (${modeSettings.tierC_min}~${modeSettings.tierB_min - 1})`" value="C" />
            <el-option label="D級滯銷 (0)" value="D" />
          </el-select>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between;">
            <label class="m-lbl">允許商品大區：</label>
            <el-checkbox v-model="tableBatchForm.applyCats" size="mini">覆蓋商品大區</el-checkbox>
          </div>
          <el-select v-model="tableBatchForm.allowed_categories" :disabled="!tableBatchForm.applyCats" multiple filterable size="mini" style="width: 100%;">
            <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
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

    <!-- Modal 3: 月銷量級距門檻設定 -->
    <el-dialog v-model="showTierModal" title="🔥 月銷量級距門檻設定" width="460px" append-to-body custom-class="dark-dialog">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="tier-cfg-item">
          <span style="width: 110px;">A級爆品 ≥</span>
          <el-input-number v-model="modeSettings.tierA_min" :min="2" size="mini" style="width: 130px;" />
          <span class="text-dim">件 / 月</span>
        </div>
        <div class="tier-cfg-item">
          <span style="width: 110px;">B級常銷 ≥</span>
          <el-input-number v-model="modeSettings.tierB_min" :min="1" size="mini" style="width: 130px;" />
          <span class="text-dim">件 / 月</span>
        </div>
        <div class="tier-cfg-item">
          <span style="width: 110px;">C級慢銷 ≥</span>
          <el-input-number v-model="modeSettings.tierC_min" :min="1" size="mini" style="width: 130px;" />
          <span class="text-dim">件 / 月</span>
        </div>
        <div class="text-dim" style="font-size: 12px;">※ 近月銷量 = 0 自動歸類為「D級滯銷」。</div>
      </div>
      <template #footer>
        <el-button size="mini" @click="showTierModal = false">取消</el-button>
        <el-button size="mini" type="success" @click="saveModeSettings(); showTierModal = false">儲存門檻並重算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { FLOOR_MODULES } from '../utils/floorLayoutData.js'

export default {
  name: 'StorageAccuracy',
  data() {
    return {
      activeTab: 'dashboard',
      loading: false,
      simLoading: false,
      uploading: false,
      batchSaving: false,
      uploadProgressText: '',

      modeSettings: {
        mode: 'CAT_TRADE',
        tierA_min: 50,
        tierB_min: 10,
        tierC_min: 1
      },
      modeLabelMap: {
        CAT_TRADE: '模式1：大區 + 借採',
        SALES_TRADE: '模式2：月銷 + 借採',
        CAT_SALES_TRADE: '模式3：大區 + 月銷 + 借採'
      },
      zoneRoleLabelMap: {
        STORAGE: '庫區',
        PICK: '撿貨區',
        BOTH: '庫區+撿貨區',
        CLOSED: '關閉中'
      },

      floorOptions: ['1F', '2F東', '2F西', '3F', '4F', '6F', '7F', '8F'],
      categoryOptions: [
        '書店24H', '食品飲料', '日用品', '生活育樂', '家電', '保養',
        '新3C', '書店DVD', '流行', '數位', '居家', '周邊耗材',
        '休閒', '零組件', '母嬰', '保健', '大家電3', '超商', '筆記電腦', '通訊'
      ],

      // 規則總表狀態（輕量＋分頁）
      rules: [],
      ruleFloorFilter: 'ALL',
      ruleRoleFilter: 'ALL',
      ruleKeyword: '',
      rulePage: 1,
      rulePageSize: 30,
      selectedRuleIds: [],

      // 平面圖狀態（支援多選＋著色視角）
      selectedMapFloor: '2F',
      selectedZoneId: '2F-E-A',
      mapZoom: 1.15,
      mapColorMode: 'DEFAULT',
      mapMultiSelectMode: false,
      selectedMapRacks: [],

      mapEditRule: {
        id: null,
        zone_name: '',
        floor: '2F東',
        x_start: '',
        x_end: '',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: [],
        allowed_sales_tiers: []
      },

      mapBatchForm: {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        applyTiers: false,
        allowed_sales_tiers: [],
        applyCats: false,
        allowed_categories: []
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
        exceptions: []
      },

      simData: {
        hasData: false,
        tierDistribution: [],
        modesComparison: [],
        topMoveCandidates: []
      },

      excKeyword: '',
      excRoleFilter: 'ALL',
      excTradeFilter: 'ALL',
      excTierFilter: 'ALL',
      excFloorFilter: 'ALL',

      showRuleModal: false,
      showTableBatchModal: false,
      showTierModal: false,

      ruleForm: {
        id: null,
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: 'A',
        x_start: '',
        x_end: '',
        y_start: '01',
        y_end: '99',
        layer_start: 'A',
        layer_end: 'Z',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: [],
        allowed_sales_tiers: [],
        enabled: true
      },

      tableBatchForm: {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        applyTiers: false,
        allowed_sales_tiers: [],
        applyCats: false,
        allowed_categories: []
      }
    }
  },
  computed: {
    filteredRules() {
      const kw = this.ruleKeyword.trim().toLowerCase();
      return this.rules.filter(r => {
        const okFloor = this.ruleFloorFilter === 'ALL' || r.floor === this.ruleFloorFilter;
        const okRole = this.ruleRoleFilter === 'ALL' || (r.zone_role || 'PICK') === this.ruleRoleFilter;
        const okKw = !kw ||
          r.zone_name.toLowerCase().includes(kw) ||
          r.x_start.toLowerCase().includes(kw) ||
          r.x_end.toLowerCase().includes(kw) ||
          (r.allowed_categories || []).some(c => c.toLowerCase().includes(kw));
        return okFloor && okRole && okKw;
      });
    },
    paginatedRules() {
      const start = (this.rulePage - 1) * this.rulePageSize;
      return this.filteredRules.slice(start, start + this.rulePageSize);
    },
    isAllPageRulesSelected() {
      return this.paginatedRules.length > 0 &&
        this.paginatedRules.every(r => this.selectedRuleIds.includes(r.id));
    },
    filteredExceptions() {
      const kw = this.excKeyword.trim().toLowerCase();
      return (this.report.exceptions || []).filter(item => {
        const okRole = this.excRoleFilter === 'ALL' || item.zone_role === this.excRoleFilter;
        const okTrade = this.excTradeFilter === 'ALL' || item.trade_type === this.excTradeFilter;
        const okTier = this.excTierFilter === 'ALL' || item.sales_tier === this.excTierFilter;
        const okFloor = this.excFloorFilter === 'ALL' || item.floor === this.excFloorFilter;
        const okKw = !kw ||
          item.sku_id.toLowerCase().includes(kw) ||
          item.sku_name.toLowerCase().includes(kw) ||
          item.bin_code.toLowerCase().includes(kw);
        return okRole && okTrade && okTier && okFloor && okKw;
      });
    },
    currentFloorModule() {
      return FLOOR_MODULES[this.selectedMapFloor] || null;
    },
    currentFloorZones() {
      return this.currentFloorModule?.zones || [];
    },
    currentZoneObj() {
      return this.currentFloorZones.find(z => z.id === this.selectedZoneId) || this.currentFloorZones[0] || null;
    },
    currentRuleFloorKey() {
      return this.currentZoneObj?.ruleFloor || this.selectedMapFloor;
    },
    isEastRightOrientation() {
      return this.currentFloorModule?.orientation === 'east-right';
    },
    currentFloorCanvas() {
      const floorData = this.currentFloorModule;
      const zoneObj = this.currentZoneObj;
      if (!floorData || !zoneObj) return { width: 900, height: 550, nodes: [], outerFrame: null, columns: [] };

      const isEastRight = floorData.orientation === 'east-right';
      const ruleFl = zoneObj.ruleFloor || this.selectedMapFloor;
      const floorRules = this.rules
        .filter(r => r.enabled && (r.floor === ruleFl || r.floor === this.selectedMapFloor))
        .sort((a, b) => (a.x_start === a.x_end ? -1 : 1));

      const findRuleForX = (xCode) => {
        if (!xCode) return null;
        return floorRules.find(r => {
          if (r.x_start === r.x_end) {
            return r.x_start === xCode || xCode.startsWith(r.x_start);
          }
          return xCode >= r.x_start && xCode <= r.x_end;
        }) || null;
      };

      const decorateRack = (xCode, label) => {
        const rule = findRuleForX(xCode);
        const xStat = this.report.byXRow?.[`${this.selectedMapFloor}|${xCode}`] || this.report.byXRow?.[`${ruleFl}|${xCode}`];
        const zRole = rule?.zone_role || 'PICK';

        let statusClass = 'fp-status-unset';
        if (this.mapColorMode === 'ZONE_ROLE') {
          if (zRole === 'CLOSED') statusClass = 'fp-status-closed';
          else if (zRole === 'STORAGE') statusClass = 'fp-status-buy';
          else if (zRole === 'BOTH') statusClass = 'fp-status-borrow';
          else statusClass = 'fp-status-cat';
        } else if (this.mapColorMode === 'CATEGORY') {
          if (zRole === 'CLOSED') statusClass = 'fp-status-closed';
          else if (rule?.allowed_categories?.length > 0) statusClass = 'fp-status-cat';
        } else if (this.mapColorMode === 'SALES_TIER') {
          const tiers = rule?.allowed_sales_tiers || [];
          if (tiers.includes('A')) statusClass = 'fp-status-err';
          else if (tiers.includes('B')) statusClass = 'fp-status-borrow';
          else if (tiers.includes('C')) statusClass = 'fp-status-buy';
        } else {
          if (xStat && xStat.failed > 0) statusClass = 'fp-status-err';
          else if (zRole === 'CLOSED') statusClass = 'fp-status-closed';
          else if (rule && rule.allowed_trade === '借') statusClass = 'fp-status-borrow';
          else if (rule && rule.allowed_trade === '採') statusClass = 'fp-status-buy';
          else if (rule && ((rule.allowed_categories?.length > 0) || (rule.allowed_sales_tiers?.length > 0))) statusClass = 'fp-status-cat';
        }

        const roleLabel = this.zoneRoleLabelMap[zRole] || '撿貨區';
        const ruleText = rule
          ? `用途：【${roleLabel}】｜長度：${rule.rack_length_m || 20}m｜借採：${rule.allowed_trade === 'ALL' ? '皆可' : '僅限' + rule.allowed_trade}${rule.allowed_sales_tiers?.length ? '｜月銷：' + rule.allowed_sales_tiers.join('/') + '級' : ''}${rule.allowed_categories?.length ? '｜大區：' + rule.allowed_categories.join('、') : ''}`
          : '尚未設定獨立規則（沿用預設撿貨區）';
        const statText = xStat ? `\n現況：共 ${xStat.total} 筆（合格 ${xStat.passed} / 異常 ${xStat.failed}）` : '';
        const m = String(label).match(/80([A-Z0-9]{2,4}\d{2,3})/);
        return {
          statusClass,
          tooltip: `${label}（排號 ${xCode}）\n${ruleText}${statText}`,
          shortLabel: m ? m[1] : xCode
        };
      };

      // ==================== 模式 A：12m 標準建築公尺底圖模式 ====================
      if (zoneObj.meterMode && zoneObj.shell) {
        const px = zoneObj.pxPerM || 20;
        const padLeft = 36;
        const padTop = 36;
        const { widthM, depthM, rooms = [], columns = [] } = zoneObj.shell;
        const racks = floorData.zoneRacks?.[zoneObj.id] || [];

        const nodes = [];
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
            tooltip: `${rm.label} (${rm.w}m × ${rm.h}m)`
          });
        });

        racks.forEach(rk => {
          const w = rk.w * px - 1;
          const h = rk.h * px - 1;
          const dec = decorateRack(rk.xCode, rk.label);
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
            tooltip: dec.tooltip
          });
        });

        const colMarkers = columns.map(c => ({
          left: padLeft + c.x * px - 5,
          top: padTop + c.y * px - 5,
          title: `結構柱位 (${c.x}m, ${c.y}m)`
        }));

        return {
          width: padLeft * 2 + widthM * px,
          height: padTop + depthM * px + 24,
          outerFrame: {
            left: padLeft,
            top: padTop,
            width: widthM * px,
            height: depthM * px
          },
          columns: colMarkers,
          nodes
        };
      }

      // ==================== 模式 B：舊座標相容模式 ====================
      const [rMin, rMax, cMin, cMax] = zoneObj.crop;
      const cellW = zoneObj.cellW || (isEastRight ? 9 : 14);
      const cellH = zoneObj.cellH || (isEastRight ? 11 : 14);
      const pad = 36;

      const croppedItems = floorData.i.filter(([r, c, sr, sc]) => {
        const rEnd = r + sr;
        const cEnd = c + sc;
        return rEnd >= rMin && r <= rMax && cEnd >= cMin && c <= cMax;
      });

      const nodes = croppedItems.map(([r, c, sr, sc, label, xCode]) => {
        const isRack = Boolean(xCode);
        let left, top, w, h;
        if (isEastRight) {
          left = (rMax - (r + sr)) * cellW + pad;
          top = (c - cMin) * cellH + pad;
          w = Math.max(14, sr * cellW - (isRack ? 1 : 0));
          h = Math.max(14, sc * cellH - (isRack ? 1 : 0));
        } else {
          left = (c - cMin) * cellW + pad;
          top = (r - rMin) * cellH + pad;
          w = Math.max(16, sc * cellW - (isRack ? 1 : 0));
          h = Math.max(18, sr * cellH - (isRack ? 1 : 0));
        }

        const dec = isRack ? decorateRack(xCode, label) : { statusClass: '', tooltip: label, shortLabel: label };
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
          tooltip: dec.tooltip
        };
      });

      const canvasWidth = isEastRight
        ? (rMax - rMin + 4) * cellW + pad * 2
        : (cMax - cMin + 4) * cellW + pad * 2;
      const canvasHeight = isEastRight
        ? (cMax - cMin + 4) * cellH + pad * 2
        : (rMax - rMin + 4) * cellH + pad * 2;

      return {
        width: Math.max(640, canvasWidth),
        height: Math.max(460, canvasHeight),
        outerFrame: null,
        columns: [],
        nodes
      };
    },
    selectedRackStats() {
      if (this.selectedMapRacks.length !== 1) {
        return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-', tiers: {} };
      }
      const rk = this.selectedMapRacks[0];
      const st = this.report.byXRow?.[`${this.selectedMapFloor}|${rk.xCode}`] ||
        this.report.byXRow?.[`${this.currentRuleFloorKey}|${rk.xCode}`];
      if (!st) return { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, accuracyPct: 100, topCatsText: '-', tiers: {} };
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
    selectMapFloor(fl) {
      this.selectedMapFloor = fl;
      this.selectedMapRacks = [];
      const zones = FLOOR_MODULES[fl]?.zones || [];
      this.selectedZoneId = zones[0]?.id || '';
      this.mapZoom = FLOOR_MODULES[fl]?.orientation === 'east-right' ? 0.95 : 1.15;
    },
    selectMapZone(zoneId) {
      this.selectedZoneId = zoneId;
      this.selectedMapRacks = [];
    },
    isNodeSelected(node) {
      return this.selectedMapRacks.some(r => r.xCode === node.xCode && r.label === node.label);
    },
    clearMapSelection() {
      this.selectedMapRacks = [];
    },
    selectAllRacksInZone() {
      const racks = (this.currentFloorCanvas.nodes || []).filter(n => n.isRack);
      const uniqueMap = new Map();
      racks.forEach(r => {
        if (!uniqueMap.has(r.xCode)) uniqueMap.set(r.xCode, r);
      });
      this.selectedMapRacks = Array.from(uniqueMap.values());
      if (this.selectedMapRacks.length === 1) {
        this.loadSingleRackRule(this.selectedMapRacks[0]);
      } else if (this.selectedMapRacks.length > 1) {
        this.resetMapBatchForm();
      }
    },
    handleRackClick(node, event) {
      const isMulti = this.mapMultiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey;
      if (isMulti) {
        const existsIdx = this.selectedMapRacks.findIndex(r => r.xCode === node.xCode);
        if (existsIdx !== -1) {
          this.selectedMapRacks.splice(existsIdx, 1);
        } else {
          this.selectedMapRacks.push(node);
        }
      } else {
        this.selectedMapRacks = [node];
      }

      if (this.selectedMapRacks.length === 1) {
        this.loadSingleRackRule(this.selectedMapRacks[0]);
      } else if (this.selectedMapRacks.length > 1) {
        this.resetMapBatchForm();
      }
    },
    resetMapBatchForm() {
      this.mapBatchForm = {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        applyTiers: false,
        allowed_sales_tiers: [],
        applyCats: false,
        allowed_categories: []
      };
    },
    buildRulePayloadForX(xCode) {
      const ruleFl = this.currentRuleFloorKey;
      const exactRule = this.rules.find(
        r => (r.floor === ruleFl || r.floor === this.selectedMapFloor) &&
          r.x_start === xCode && r.x_end === xCode
      );
      if (exactRule) {
        return {
          ...exactRule,
          zone_role: exactRule.zone_role || 'PICK',
          rack_length_m: Number(exactRule.rack_length_m || 20),
          allowed_categories: [...(exactRule.allowed_categories || [])],
          allowed_volumes: [...(exactRule.allowed_volumes || [])],
          allowed_sales_tiers: [...(exactRule.allowed_sales_tiers || [])]
        };
      }
      const rangeRule = this.rules.find(
        r => (r.floor === ruleFl || r.floor === this.selectedMapFloor) &&
          ((r.x_start === r.x_end && xCode.startsWith(r.x_start)) ||
            (xCode >= r.x_start && xCode <= r.x_end))
      );
      return {
        id: null,
        zone_name: `${xCode} 排`,
        floor: ruleFl,
        storage_type: rangeRule ? rangeRule.storage_type : '落地儲位',
        area: rangeRule ? rangeRule.area : '',
        x_start: xCode,
        x_end: xCode,
        y_start: rangeRule ? rangeRule.y_start : '01',
        y_end: rangeRule ? rangeRule.y_end : '99',
        layer_start: rangeRule ? rangeRule.layer_start : 'A',
        layer_end: rangeRule ? rangeRule.layer_end : 'Z',
        zone_role: rangeRule ? (rangeRule.zone_role || 'PICK') : 'PICK',
        rack_length_m: rangeRule ? Number(rangeRule.rack_length_m || 20) : 20,
        allowed_trade: rangeRule ? rangeRule.allowed_trade : 'ALL',
        allowed_categories: rangeRule ? [...(rangeRule.allowed_categories || [])] : [],
        allowed_volumes: rangeRule ? [...(rangeRule.allowed_volumes || [])] : [],
        allowed_sales_tiers: rangeRule ? [...(rangeRule.allowed_sales_tiers || [])] : [],
        enabled: true
      };
    },
    loadSingleRackRule(node) {
      this.mapEditRule = this.buildRulePayloadForX(node.xCode);
    },
    async saveMapRackRule() {
      this.batchSaving = true;
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: this.mapEditRule });
        ElMessage.success(`🎉 已儲存【${this.mapEditRule.floor} - ${this.mapEditRule.x_start} 排】設定！`);
        await this.refreshAll();
        if (this.selectedMapRacks.length === 1) {
          this.loadSingleRackRule(this.selectedMapRacks[0]);
        }
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + e.message);
      } finally {
        this.batchSaving = false;
      }
    },
    async saveMapBatchRules() {
      const f = this.mapBatchForm;
      if (f.zone_role === 'KEEP' && !f.applyLength && f.allowed_trade === 'KEEP' && !f.applyTiers && !f.applyCats) {
        return ElMessage.warning('請至少選擇一項要批次套用的屬性！');
      }
      this.batchSaving = true;
      try {
        const payloads = this.selectedMapRacks.map(rk => {
          const base = this.buildRulePayloadForX(rk.xCode);
          if (f.zone_role !== 'KEEP') base.zone_role = f.zone_role;
          if (f.applyLength) base.rack_length_m = f.rack_length_m;
          if (f.allowed_trade !== 'KEEP') base.allowed_trade = f.allowed_trade;
          if (f.applyTiers) base.allowed_sales_tiers = [...f.allowed_sales_tiers];
          if (f.applyCats) base.allowed_categories = [...f.allowed_categories];
          return base;
        });

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10);
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule })));
        }

        ElMessage.success(`🎉 已成功批次套用至 ${payloads.length} 排貨架！`);
        await this.refreshAll();
      } catch (e) {
        ElMessage.error('批次套用失敗：' + e.message);
      } finally {
        this.batchSaving = false;
      }
    },

    async refreshAll() {
      this.loading = true;
      try {
        const [modeRes, ruleRes] = await Promise.all([
          axios.get('/api/storage-accuracy/mode-settings'),
          axios.get('/api/storage-accuracy/rules')
        ]);
        if (modeRes.data?.success && modeRes.data?.settings) {
          this.modeSettings = modeRes.data.settings;
        }
        if (ruleRes.data?.success) this.rules = ruleRes.data.rules || [];

        const repRes = await axios.get(`/api/storage-accuracy/audit/report?mode=${this.modeSettings.mode}`);
        if (repRes.data?.success) this.report = repRes.data;

        if (this.activeTab === 'simulation') {
          await this.fetchSimulation();
        }
      } catch (e) {
        ElMessage.error('載入儲位準確率資料失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async saveModeSettings() {
      try {
        const res = await axios.post('/api/storage-accuracy/mode-settings/save', { settings: this.modeSettings });
        if (res.data?.success) {
          this.modeSettings = res.data.settings;
          ElMessage.success(res.data.message);
          await this.refreshAll();
        }
      } catch (e) {
        ElMessage.error('儲存擺放模式失敗：' + e.message);
      }
    },

    async applyModeFromSim(mode) {
      this.modeSettings.mode = mode;
      await this.saveModeSettings();
    },

    async fetchSimulation() {
      this.simLoading = true;
      try {
        const res = await axios.get('/api/storage-accuracy/audit/simulate-modes');
        if (res.data?.success) {
          this.simData = res.data;
        }
      } catch (e) {
        ElMessage.error('載入動線模擬分析失敗：' + e.message);
      } finally {
        this.simLoading = false;
      }
    },

    // ==================== 規則總表操作 ====================
    toggleSelectAllPageRules(e) {
      const checked = e.target.checked;
      const pageIds = this.paginatedRules.map(r => r.id);
      if (checked) {
        const set = new Set([...this.selectedRuleIds, ...pageIds]);
        this.selectedRuleIds = Array.from(set);
      } else {
        this.selectedRuleIds = this.selectedRuleIds.filter(id => !pageIds.includes(id));
      }
    },
    openNewRuleModal() {
      this.ruleForm = {
        id: null,
        zone_name: '',
        floor: '7F',
        storage_type: 'AGV層架',
        area: 'A',
        x_start: '',
        x_end: '',
        y_start: '01',
        y_end: '99',
        layer_start: 'A',
        layer_end: 'Z',
        zone_role: 'PICK',
        rack_length_m: 20,
        allowed_trade: 'ALL',
        allowed_categories: [],
        allowed_volumes: [],
        allowed_sales_tiers: [],
        enabled: true
      };
      this.showRuleModal = true;
    },
    openEditRuleModal(r) {
      this.ruleForm = {
        ...r,
        zone_role: r.zone_role || 'PICK',
        rack_length_m: Number(r.rack_length_m || 20),
        allowed_categories: [...(r.allowed_categories || [])],
        allowed_volumes: [...(r.allowed_volumes || [])],
        allowed_sales_tiers: [...(r.allowed_sales_tiers || [])]
      };
      this.showRuleModal = true;
    },
    async submitRuleForm() {
      if (!this.ruleForm.zone_name || !this.ruleForm.x_start) {
        return ElMessage.warning('請填寫區域名稱與 X 軸排號！');
      }
      if (!this.ruleForm.x_end) this.ruleForm.x_end = this.ruleForm.x_start;
      try {
        await axios.post('/api/storage-accuracy/rules/save', { rule: this.ruleForm });
        this.showRuleModal = false;
        await this.refreshAll();
        ElMessage.success('🎉 已儲存儲位規則！');
      } catch (e) {
        ElMessage.error('儲存規則失敗：' + e.message);
      }
    },
    openTableBatchModal() {
      this.tableBatchForm = {
        zone_role: 'KEEP',
        applyLength: false,
        rack_length_m: 20,
        allowed_trade: 'KEEP',
        applyTiers: false,
        allowed_sales_tiers: [],
        applyCats: false,
        allowed_categories: []
      };
      this.showTableBatchModal = true;
    },
    async submitTableBatchEdit() {
      const f = this.tableBatchForm;
      if (f.zone_role === 'KEEP' && !f.applyLength && f.allowed_trade === 'KEEP' && !f.applyTiers && !f.applyCats) {
        return ElMessage.warning('請至少選擇一項要修改的屬性！');
      }
      this.batchSaving = true;
      try {
        const targets = this.rules.filter(r => this.selectedRuleIds.includes(r.id));
        const payloads = targets.map(r => {
          const copy = { ...r };
          if (f.zone_role !== 'KEEP') copy.zone_role = f.zone_role;
          if (f.applyLength) copy.rack_length_m = f.rack_length_m;
          if (f.allowed_trade !== 'KEEP') copy.allowed_trade = f.allowed_trade;
          if (f.applyTiers) copy.allowed_sales_tiers = [...f.allowed_sales_tiers];
          if (f.applyCats) copy.allowed_categories = [...f.allowed_categories];
          return copy;
        });

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10);
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule })));
        }

        this.showTableBatchModal = false;
        this.selectedRuleIds = [];
        await this.refreshAll();
        ElMessage.success(`🎉 已批次更新 ${payloads.length} 條規則！`);
      } catch (e) {
        ElMessage.error('批次更新失敗：' + e.message);
      } finally {
        this.batchSaving = false;
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
    deleteRule(rule) {
      ElMessageBox.confirm(`確定要刪除「${rule.floor} - ${rule.zone_name} (${rule.x_start})」嗎？`, '刪除規則確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await axios.post('/api/storage-accuracy/rules/delete', { id: rule.id });
        this.selectedRuleIds = this.selectedRuleIds.filter(id => id !== rule.id);
        await this.refreshAll();
        ElMessage.success('已刪除該條規則');
      }).catch(() => {});
    },

    // ==================== 規則 Excel 匯出 / 匯入 ====================
    exportRulesExcel() {
      const rows = [
        ['規則ID(勿改)', '啟用(1/0)', '樓層', '區域名稱', 'X軸起點', 'X軸終點', 'Y軸起點', 'Y軸終點', '層別起點', '層別終點', '區域用途(PICK/STORAGE/BOTH/CLOSED)', '層架長度(m)', '允許借採(ALL/借/採)', '允許月銷級距(逗號分隔)', '允許商品大區(逗號分隔)']
      ];
      this.filteredRules.forEach(r => {
        rows.push([
          r.id || '',
          r.enabled ? 1 : 0,
          r.floor,
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
          (r.allowed_sales_tiers || []).join(','),
          (r.allowed_categories || []).join(',')
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '80庫儲位規則');
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `80庫儲位規則設定_${today}.xlsx`);
      ElMessage.success('🎉 已匯出儲位規則 Excel！');
    },
    triggerRuleExcelInput() {
      if (this.$refs.ruleExcelInput) {
        this.$refs.ruleExcelInput.value = '';
        this.$refs.ruleExcelInput.click();
      }
    },
    async handleRuleExcelImport(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      this.batchSaving = true;
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) throw new Error('Excel 檔案內容為空');

        const payloads = rows
          .filter(row => row['樓層'] && row['X軸起點'])
          .map(row => {
            const tiersRaw = String(row['允許月銷級距(逗號分隔)'] || '').trim();
            const catsRaw = String(row['允許商品大區(逗號分隔)'] || '').trim();
            return {
              id: row['規則ID(勿改)'] || null,
              enabled: String(row['啟用(1/0)']).trim() !== '0',
              floor: String(row['樓層']).trim(),
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
              allowed_sales_tiers: tiersRaw ? tiersRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
              allowed_categories: catsRaw ? catsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
            };
          });

        for (let i = 0; i < payloads.length; i += 10) {
          const chunk = payloads.slice(i, i + 10);
          await Promise.all(chunk.map(rule => axios.post('/api/storage-accuracy/rules/save', { rule })));
        }

        await this.refreshAll();
        ElMessage.success(`🎉 成功匯入並更新 ${payloads.length} 條儲位規則！`);
      } catch (err) {
        ElMessage.error('匯入規則 Excel 失敗：' + err.message);
      } finally {
        this.batchSaving = false;
      }
    },

    // ==================== CSV 上傳與異常匯出 ====================
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
        const idxMonthlySales = headers.indexOf('(近)月銷量');
        const idxPickDaysM = headers.indexOf('(近)月-有揀貨單天數');
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
            monthly_sales: idxMonthlySales !== -1 ? Number(String(cols[idxMonthlySales] || 0).replace(/,/g, '')) : 0,
            pick_days_m: idxPickDaysM !== -1 ? Number(String(cols[idxPickDaysM] || 0).replace(/,/g, '')) : 0,
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

        this.uploadProgressText = '計算擺放準確率與動線分析中...';
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
        ['商品ID', '商品名稱', '借/採', '商品大區', '月銷量', '月銷級距', '樓層', '目前儲位', '區域用途', '庫存數', '異常原因', '建議移往區段']
      ];
      this.filteredExceptions.forEach(item => {
        rows.push([
          item.sku_id,
          item.sku_name,
          item.trade_type,
          item.cat_name,
          item.monthly_sales,
          item.sales_tier_label,
          item.floor,
          item.bin_code,
          item.zone_role_label,
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

.sim-modes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; flex-shrink: 0; }
.sim-mode-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.sim-recommended { border-color: #4ade80; background: linear-gradient(180deg, rgba(74, 222, 128, 0.08) 0%, #1e293b 45%); }
.sim-active { box-shadow: 0 0 0 1px #38bdf8; }
.sim-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
.sim-mode-title { font-size: 14px; font-weight: bold; color: #f8fafc; }
.sim-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.rec-badge { background: rgba(74, 222, 128, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.45); font-size: 11px; font-weight: bold; padding: 2px 7px; border-radius: 10px; }
.cur-badge { background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; font-weight: bold; padding: 2px 7px; border-radius: 10px; }
.sim-metrics-row { display: grid; grid-template-columns: 1.25fr 0.9fr 0.85fr; gap: 8px; background: #0f172a; padding: 8px; border-radius: 6px; border: 1px solid #334155; }
.sim-metric { display: flex; flex-direction: column; gap: 2px; }
.sm-lbl { font-size: 11px; color: #94a3b8; }
.sm-val { font-size: 16px; font-weight: 800; }
.sm-sub { font-size: 10px; }
.sim-desc-box { font-size: 12px; color: #cbd5e1; line-height: 1.5; }
.sim-bottom-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1.35fr; gap: 10px; }

.tier-cfg-item { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #f8fafc; }

.role-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; }
.role-PICK { background: rgba(74, 222, 128, 0.16); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.35); }
.role-STORAGE { background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
.role-BOTH { background: rgba(250, 204, 21, 0.16); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.35); }
.role-CLOSED { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); }

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

.tier-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.tier-A { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
.tier-B { background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); }
.tier-C { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.tier-D { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }

/* ==================== 平面圖工具列與獨立分區列 ==================== */
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

.fp-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 320px; gap: 10px; }
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

.fp-zone-outline {
  position: absolute;
  border: 2px solid #64748b;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.35);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
  pointer-events: none;
  z-index: 1;
}

/* 12m 標準結構柱位黑方塊 */
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