<template>
  <div class="main-layout dark-bg loc-summary-page">
    <div class="summary-container">
      <!-- 頂部操作列與設定按鈕 -->
      <div class="top-bar-actions">
        <div class="left-title-group">
          <span class="page-title-text">📊 儲位數與才數統計概覽 (跨區交叉矩陣)</span>
          
          <el-select 
            v-model="selectedDate" 
            placeholder="選擇紀錄日期" 
            size="mini" 
            style="width: 210px; margin-left: 15px;"
            @change="onDateChange"
          >
            <el-option label="⚡ 當前即時試算數據" value="realtime" />
            <el-option 
              v-for="item in historyList" 
              :key="item.record_date" 
              :label="`${item.record_date} (${item.file_name || '歷史快照'})`" 
              :value="item.record_date" 
            />
          </el-select>
          <span v-if="selectedDate !== 'realtime'" class="history-tag">
            📌 歷史快照模式
          </span>
        </div>

        <div class="btn-group">
          <el-button 
            type="primary" 
            size="small" 
            icon="el-icon-refresh" 
            :loading="loading" 
            @click="fetchRealtimeAndHistory"
          >
            重新整理數據
          </el-button>

          <el-button 
            type="warning" 
            size="small" 
            icon="el-icon-setting" 
            @click="openConfigModal"
          >
            ⚙️ 儲位定義設定
          </el-button>

          <el-button 
            v-if="exportPerms.xlsx"
            type="success" 
            size="small" 
            icon="el-icon-document" 
            :loading="exportingXlsx"
            @click="exportFullXlsx"
            class="export-top-btn btn-xlsx"
          >
            📊 匯出 xlsx (3工作表)
          </el-button>
        </div>
      </div>

      <!-- 7 大數據指標卡片 -->
      <div class="stats-overview-grid">
        <div class="stat-card">
          <span class="stat-lbl">規劃總儲格數</span>
          <span class="stat-val text-blue">{{ formatNumber(activeStats.total_plan_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中儲格數</span>
          <span class="stat-val text-green">{{ formatNumber(activeStats.total_used_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">剩餘空儲格數</span>
          <span class="stat-val text-orange">{{ formatNumber(activeStats.total_rem_grid) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">規劃總才數</span>
          <span class="stat-val text-blue">{{ formatNumber(activeStats.total_plan_vol) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">使用中才數</span>
          <span class="stat-val text-green">{{ formatNumber(activeStats.total_used_vol) }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-lbl">剩餘空才數</span>
          <span class="stat-val text-orange">{{ formatNumber(activeStats.total_rem_vol) }}</span>
        </div>
        <div class="stat-card highlight-health">
          <span class="stat-lbl">儲位整體健康度 (使用率)</span>
          <span class="stat-val text-cyan">{{ activeStats.total_health || '0.0%' }}</span>
        </div>
      </div>

      <!-- 進度條面板 -->
      <div v-if="loading" class="progress-box dark-panel">
        <div class="progress-lbl">⚡ 正在進行 A/B/C/D 區與樓層型態交叉矩陣計算中...</div>
        <el-progress :percentage="calcProgress" :color="progressColors" :stroke-width="18" striped stripe-processing></el-progress>
      </div>

      <!-- 數據表格與圖表頁籤區 -->
      <div v-else class="tables-main-wrapper">
        <el-tabs type="border-card" class="dark-tabs" v-model="activeTab">
          <el-tab-pane label="📊 儲格數交叉統計表" name="grid">
            <el-table 
              :data="filteredGridData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <el-table-column label="規劃" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="已使用" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="未使用率 (%)" align="center" class-name="section-border-right">
                <el-table-column prop="unrate_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="unrate_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="剩餘" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="85" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="85" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid') }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘儲位數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getRemVolForGridTable(scope.row)) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="📦 才數交叉統計表" name="vol">
            <el-table 
              :data="filteredVolData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="floor" label="樓層" width="75" align="center" fixed="left"></el-table-column>
              <el-table-column prop="loc_type" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <el-table-column label="規劃總才數" align="center" class-name="section-border-right">
                <el-table-column prop="plan_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="plan_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="使用中才數" align="center" class-name="section-border-right">
                <el-table-column prop="used_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="used_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="剩餘才數" align="center" class-name="section-border-right">
                <el-table-column prop="rem_A區" label="A區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_B區" label="B區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_C區" label="C區" width="80" align="right"></el-table-column>
                <el-table-column prop="rem_D區" label="D區" width="80" align="right" class-name="section-border-right"></el-table-column>
              </el-table-column>

              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group">
                <el-table-column label="規劃數" width="90" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(getSumVal(scope.row, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區'])) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="90" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(getSumVal(scope.row, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="未使用率(%)" width="95" align="right">
                  <template #default="scope">
                    {{ getUnrateVal(scope.row, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true) }}
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="95" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(getSumVal(scope.row, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區'])) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="儲位健康度" width="95" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ getRowHealthVol(scope.row) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="📋 儲位與才數綜合總覽表" name="combined">
            <el-table 
              :data="combinedTableData" 
              border 
              height="100%" 
              size="mini" 
              class="dark-table pivot-table"
              :row-class-name="tableRowClassName"
              :span-method="combinedSpanMethod"
            >
              <el-table-column prop="displayFloor" label="樓層" width="100" align="center" fixed="left"></el-table-column>
              <el-table-column prop="displayType" label="儲位類型" width="130" fixed="left" class-name="section-border-right"></el-table-column>

              <el-table-column label="【儲位格數彙總】" align="center" class-name="summary-header-group section-border-right">
                <el-table-column label="規劃數" width="100" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_grid) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="100" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_grid" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘儲位數" width="100" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_grid) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="剩餘才數" width="105" align="right" class-name="section-border-right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column label="【才數彙總】" align="center" class-name="summary-header-group-vol">
                <el-table-column label="規劃數" width="110" align="right">
                  <template #default="scope">
                    <strong>{{ formatNumber(scope.row.sum_plan_vol) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column label="已使用" width="110" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.sum_used_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_unrate_vol" label="未使用率(%)" width="100" align="right"></el-table-column>
                <el-table-column label="剩餘才數" width="110" align="right">
                  <template #default="scope">
                    <span class="text-orange">{{ formatNumber(scope.row.sum_rem_vol) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sum_health_vol" label="儲位健康度" width="100" align="right">
                  <template #default="scope">
                    <span class="text-cyan">{{ scope.row.sum_health_vol || '0.0%' }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 🌟 頁籤 4：📈 空間與健康度歷史趨勢圖 (雙 Y 軸獨立 + 數字上下拉開不重疊) 🌟 -->
          <el-tab-pane label="📈 空間與健康度歷史趨勢圖" name="trend">
            <div v-if="sortedHistoryList.length === 0" class="no-trend-box">
              ⚠️ 尚無歷史快照紀錄，上傳庫存 CSV 檔案後將自動產生趨勢分析！
            </div>
            <div v-else class="svg-charts-container">
              
              <!-- 🌟 圖表一：使用中 (雙 Y 軸：左邊儲格數 / 右邊才數) 🌟 -->
              <div class="svg-chart-card">
                <div class="chart-title">
                  <span>📊 一、80 庫「使用中儲格數」與「使用中才數」歷史推移曲線 (雙 Y 軸)</span>
                  <div class="chart-legend">
                    <span class="legend-item"><i class="dot blue"></i> 使用中儲格數 (左 Y 軸)</span>
                    <span class="legend-item"><i class="dot green"></i> 使用中才數 (右 Y 軸)</span>
                  </div>
                </div>
                <div class="svg-stage">
                  <svg viewBox="0 0 800 210" class="svg-graph">
                    <!-- 虛線背景網格 -->
                    <line x1="60" y1="30" x2="740" y2="30" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="90" x2="740" y2="90" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="150" x2="740" y2="150" stroke="#1e293b" stroke-dasharray="4" />

                    <!-- 曲線與漸層區塊 -->
                    <polygon :d="gridSvgArea" fill="url(#blueGradient)" opacity="0.15" />
                    <path :d="gridSvgPath" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
                    <path :d="volSvgPath" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" />

                    <!-- 數據節點 (儲格數在上方，才數在下方，徹底防重疊) -->
                    <g v-for="(p, idx) in chartPoints" :key="'p1-'+idx">
                      <!-- 儲格數 node (藍色) -->
                      <circle :cx="p.x" :cy="p.yGrid" r="5" fill="#38bdf8" stroke="#0f172a" stroke-width="2" />
                      <text :x="p.x" :y="p.yGrid - 12" fill="#38bdf8" font-size="12" text-anchor="middle" font-weight="bold">{{ formatNumber(p.item.used_grid) }} 格</text>

                      <!-- 才數 node (綠色) -->
                      <circle :cx="p.x" :cy="p.yVol" r="5" fill="#4ade80" stroke="#0f172a" stroke-width="2" />
                      <text :x="p.x" :y="p.yVol + 20" fill="#4ade80" font-size="12" text-anchor="middle" font-weight="bold">{{ formatNumber(p.item.used_vol) }} 才</text>

                      <!-- 日期 -->
                      <text :x="p.x" y="192" fill="#94a3b8" font-size="12" text-anchor="middle">{{ p.item.record_date }}</text>
                    </g>

                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#38bdf8" />
                        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              <!-- 🌟 圖表二：剩餘中 (雙 Y 軸：左邊空儲格數 / 右邊空才數) 🌟 -->
              <div class="svg-chart-card">
                <div class="chart-title">
                  <span>📦 二、80 庫「剩餘空儲格數」與「剩餘空才數」歷史推移曲線 (雙 Y 軸)</span>
                  <div class="chart-legend">
                    <span class="legend-item"><i class="dot orange"></i> 剩餘空儲格數 (左 Y 軸)</span>
                    <span class="legend-item"><i class="dot yellow"></i> 剩餘空才數 (右 Y 軸)</span>
                  </div>
                </div>
                <div class="svg-stage">
                  <svg viewBox="0 0 800 210" class="svg-graph">
                    <line x1="60" y1="30" x2="740" y2="30" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="90" x2="740" y2="90" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="150" x2="740" y2="150" stroke="#1e293b" stroke-dasharray="4" />

                    <path :d="remGridSvgPath" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" />
                    <path :d="remVolSvgPath" fill="none" stroke="#eab308" stroke-width="3" stroke-linecap="round" />

                    <g v-for="(p, idx) in chartPoints" :key="'p3-'+idx">
                      <!-- 剩餘儲格 node (橘色) -->
                      <circle :cx="p.x" :cy="p.yRemGrid" r="5" fill="#f97316" stroke="#0f172a" stroke-width="2" />
                      <text :x="p.x" :y="p.yRemGrid - 12" fill="#f97316" font-size="12" text-anchor="middle" font-weight="bold">{{ formatNumber(p.item.rem_grid) }} 格</text>

                      <!-- 剩餘才數 node (黃色) -->
                      <circle :cx="p.x" :cy="p.yRemVol" r="5" fill="#eab308" stroke="#0f172a" stroke-width="2" />
                      <text :x="p.x" :y="p.yRemVol + 20" fill="#eab308" font-size="12" text-anchor="middle" font-weight="bold">{{ formatNumber(p.item.rem_vol) }} 才</text>

                      <text :x="p.x" y="192" fill="#94a3b8" font-size="12" text-anchor="middle">{{ p.item.record_date }}</text>
                    </g>
                  </svg>
                </div>
              </div>

              <!-- 🌟 圖表三：整體健康度 (單 Y 軸：百分比 0% ~ 100%) 🌟 -->
              <div class="svg-chart-card">
                <div class="chart-title">
                  <span>🩺 三、80 庫「儲位整體健康度 (儲位使用率 %)」歷史走勢曲線 (單 Y 軸: 百分比 %)</span>
                  <span class="tip-text">💡 儲位使用率越高，代表倉庫空間利用越充分、健康度佳</span>
                </div>
                <div class="svg-stage">
                  <svg viewBox="0 0 800 180" class="svg-graph">
                    <line x1="60" y1="30" x2="740" y2="30" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="85" x2="740" y2="85" stroke="#1e293b" stroke-dasharray="4" />
                    <line x1="60" y1="140" x2="740" y2="140" stroke="#1e293b" stroke-dasharray="4" />

                    <polygon :d="healthSvgArea" fill="url(#cyanGradient)" opacity="0.2" />
                    <path :d="healthSvgPath" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" />

                    <g v-for="(p, idx) in chartPoints" :key="'p2-'+idx">
                      <circle :cx="p.x" :cy="p.yHealth" r="5" fill="#22d3ee" stroke="#0f172a" stroke-width="2" />
                      <text :x="p.x" :y="p.yHealth - 12" fill="#22d3ee" font-size="13" text-anchor="middle" font-weight="bold">{{ p.item.health_rate }}%</text>
                      <text :x="p.x" y="165" fill="#94a3b8" font-size="12" text-anchor="middle">{{ p.item.record_date }}</text>
                    </g>

                    <defs>
                      <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#22d3ee" />
                        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

            </div>
          </el-tab-pane>

          <el-tab-pane label="🗓️ 儲位 7 大 KPI 歷史快照管理清單" name="history_manager">
            <div class="history-page-wrapper">
              <div class="history-page-header">
                <span class="history-page-title">🗓️ 80 庫歷史快照點詳細紀錄列表</span>
                <span class="history-page-subtitle">共 {{ historyList.length }} 筆歷史資料（點擊左側 ➕ 可展開檢視各儲位類型小計指標）</span>
              </div>
              
              <el-table 
                :data="historyList" 
                border 
                stripe 
                size="small" 
                class="dark-table" 
                height="calc(100vh - 280px)"
              >
                <el-table-column type="expand">
                  <template #default="props">
                    <div class="type-details-nested-box">
                      <div class="nested-title">📋 {{ props.row.record_date }} 各儲位類型 (loc_type) 快照小計細節：</div>
                      
                      <el-table 
                        :data="props.row.type_details || []" 
                        border 
                        size="mini" 
                        class="dark-nested-table"
                      >
                        <el-table-column prop="loc_type" label="儲位類型 (小計)" width="180" />
                        <el-table-column label="規劃儲格" width="110" align="right">
                          <template #default="sub">{{ formatNumber(sub.row.plan_grid) }}</template>
                        </el-table-column>
                        <el-table-column label="使用儲格" width="110" align="right">
                          <template #default="sub"><span class="text-green">{{ formatNumber(sub.row.used_grid) }}</span></template>
                        </el-table-column>
                        <el-table-column label="剩餘儲格" width="110" align="right">
                          <template #default="sub"><span class="text-orange">{{ formatNumber(sub.row.rem_grid) }}</span></template>
                        </el-table-column>
                        <el-table-column label="規劃才數" width="130" align="right">
                          <template #default="sub">{{ formatNumber(sub.row.plan_vol) }}</template>
                        </el-table-column>
                        <el-table-column label="使用才數" width="130" align="right">
                          <template #default="sub"><span class="text-green">{{ formatNumber(sub.row.used_vol) }}</span></template>
                        </el-table-column>
                        <el-table-column label="剩餘才數" width="130" align="right">
                          <template #default="sub"><span class="text-orange">{{ formatNumber(sub.row.rem_vol) }}</span></template>
                        </el-table-column>
                        <el-table-column prop="health_rate" label="類型健康度" width="110" align="right">
                          <template #default="sub"><span class="text-cyan font-bold">{{ sub.row.health_rate }}%</span></template>
                        </el-table-column>
                      </el-table>
                    </div>
                  </template>
                </el-table-column>

                <el-table-column prop="record_date" label="紀錄日期" width="120" align="center" />
                <el-table-column prop="file_name" label="原始來源檔名" min-width="220" show-overflow-tooltip />
                <el-table-column label="已用儲格 / 規劃總格" width="180" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.used_grid) }}</span> / {{ formatNumber(scope.row.plan_grid) }}
                  </template>
                </el-table-column>
                <el-table-column label="已用才數 / 規劃總才數" width="200" align="right">
                  <template #default="scope">
                    <span class="text-green">{{ formatNumber(scope.row.used_vol) }}</span> / {{ formatNumber(scope.row.plan_vol) }}
                  </template>
                </el-table-column>
                <el-table-column prop="health_rate" label="健康度 (使用率)" width="130" align="right">
                  <template #default="scope">
                    <span class="text-cyan font-bold">{{ scope.row.health_rate }}%</span>
                  </template>
                </el-table-column>
                <el-table-column prop="created_at" label="寫入系統時間" width="170" align="center" />
                <el-table-column label="操作" width="110" align="center" fixed="right">
                  <template #default="scope">
                    <el-button 
                      type="danger" 
                      size="mini" 
                      icon="el-icon-delete"
                      @click="deleteSnapshot(scope.row.record_date)"
                    >
                      刪除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- ⚙ 儲位定義 Modal -->
    <el-dialog
      title="⚙️ 儲位定義參數與權限設定"
      v-model="showConfigDialog"
      width="750px"
      append-to-body
      class="custom-dark-dialog"
    >
      <div class="config-modal-content">
        <div class="upload-top-bar">
          <div>
            <div class="section-title">📥 匯入最新 `locations_master.csv` 檔案</div>
            <p class="section-desc">
              將包含 <code>樓層, 區域, 儲位類型, 才數, 儲格數, 儲位才數</code> 的結構定義寫入地端 SQLite。
            </p>
          </div>
          <div class="upload-area">
            <input 
              type="file" 
              ref="locMasterFileInput" 
              accept=".csv" 
              style="display: none;" 
              @change="handleMasterCsvUpload" 
            />
            <el-button 
              type="success" 
              icon="el-icon-upload2" 
              size="small"
              :loading="isUploading"
              @click="$refs.locMasterFileInput.click()"
            >
              📁 選擇 CSV 檔案並匯入
            </el-button>
          </div>
        </div>

        <el-divider content-position="left">📋 當前地端 SQLite 儲位結構定義清單</el-divider>

        <el-table 
          :data="masterTableData" 
          border 
          stripe 
          size="mini" 
          height="220px" 
          v-loading="masterLoading"
          class="dark-table master-preview-table"
        >
          <el-table-column prop="樓層" label="樓層" width="80" align="center"></el-table-column>
          <el-table-column prop="區域" label="區域" width="80" align="center"></el-table-column>
          <el-table-column prop="儲位類型" label="儲位類型" min-width="130"></el-table-column>
          <el-table-column prop="才數" label="才數" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.才數) }}</template>
          </el-table-column>
          <el-table-column prop="儲格數" label="儲格數(板、層)" width="120" align="right">
            <template #default="scope">{{ formatNumber(scope.row.儲格數) }}</template>
          </el-table-column>
          <el-table-column prop="儲位才數" label="儲位才數" width="110" align="right">
            <template #default="scope">{{ scope.row.儲位才數 }}</template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">🔒 開放儲位統計匯出功能權限</el-divider>

        <div class="perm-config-card">
          <div class="perm-title-desc">
            <span class="perm-icon">🔒</span>
            <span>開放儲位統計概覽 匯出功能權限</span>
          </div>
          <p class="perm-sub-text">未勾選之項目，一般管理員與一般人員將無法看見該匯出按鈕</p>

          <div class="perm-checkbox-group">
            <el-checkbox v-model="exportPerms.xlsx" class="dark-checkbox">
              <span class="chk-label">📊 開放 <strong>匯出 xlsx</strong> 按鈕</span>
            </el-checkbox>
            <br />
            <el-checkbox v-model="exportPerms.pdf" class="dark-checkbox">
              <span class="chk-label">🖨️ 開放 <strong>匯出 PDF</strong> 按鈕 (暫不開放)</span>
            </el-checkbox>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="showConfigDialog = false">取消關閉</el-button>
          <el-button size="small" type="primary" icon="el-icon-check" @click="saveExportPerms">💾 儲存權限設定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default {
  name: 'LocSummary',
  props: [
    'loading', 'calcProgress', 'progressColors', 'summaryStats', 
    'summaryGridData', 'summaryVolData', 'typeMergedData', 'areaGridTable', 'areaVolTable'
  ],
  data() {
    return {
      activeTab: 'grid',
      showConfigDialog: false,
      isUploading: false,
      masterLoading: false,
      masterTableData: [],
      exportingXlsx: false,
      exportingPdf: false,

      selectedDate: 'realtime',
      historyList: [],
      snapshotStats: null,

      exportPerms: {
        xlsx: true,
        pdf: false
      }
    }
  },
  computed: {
    sortedHistoryList() {
      return [...this.historyList].reverse();
    },

    // 🌟 核心雙 Y 軸獨立映射與動態防重疊計算 🌟
    chartPoints() {
      const list = this.sortedHistoryList;
      if (list.length === 0) return [];

      const startX = 80;
      const endX = 720;
      const stepX = list.length > 1 ? (endX - startX) / (list.length - 1) : 0;

      // 1. 各指標最大最小值算式
      const minGrid = Math.min(...list.map(i => i.used_grid || 0));
      const maxGrid = Math.max(...list.map(i => i.used_grid || 0)) || 1;

      const minVol = Math.min(...list.map(i => i.used_vol || 0));
      const maxVol = Math.max(...list.map(i => i.used_vol || 0)) || 1;

      const minRemGrid = Math.min(...list.map(i => i.rem_grid || 0));
      const maxRemGrid = Math.max(...list.map(i => i.rem_grid || 0)) || 1;

      const minRemVol = Math.min(...list.map(i => i.rem_vol || 0));
      const maxRemVol = Math.max(...list.map(i => i.rem_vol || 0)) || 1;

      const minHealth = Math.min(...list.map(i => i.health_rate || 0));
      const maxHealth = Math.max(...list.map(i => i.health_rate || 0)) || 100;

      return list.map((item, idx) => {
        const x = list.length === 1 ? 400 : startX + idx * stepX;

        // 🌟 雙 Y 軸 1：使用儲格 (左 Y 軸 40~140) 與 使用才數 (右 Y 軸 50~150)，上下開展
        const gRatio = maxGrid === minGrid ? 0.5 : (item.used_grid - minGrid) / (maxGrid - minGrid);
        const yGrid = 120 - gRatio * 75; // 上移儲格數

        const vRatio = maxVol === minVol ? 0.5 : (item.used_vol - minVol) / (maxVol - minVol);
        const yVol = 160 - vRatio * 75; // 下移才數

        // 🌟 雙 Y 軸 2：剩餘儲格 (左 Y 軸) 與 剩餘才數 (右 Y 軸)
        const rgRatio = maxRemGrid === minRemGrid ? 0.5 : (item.rem_grid - minRemGrid) / (maxRemGrid - minRemGrid);
        const yRemGrid = 115 - rgRatio * 75; // 上移剩餘格

        const rvRatio = maxRemVol === minRemVol ? 0.5 : (item.rem_vol - minRemVol) / (maxRemVol - minRemVol);
        const yRemVol = 165 - rvRatio * 75; // 下移剩餘才

        // 🌟 單 Y 軸：健康度百分比 (0% ~ 100%)
        const hRatio = maxHealth === minHealth ? 0.5 : (item.health_rate - minHealth) / (maxHealth - minHealth);
        const yHealth = 135 - hRatio * 85;

        return { x, yGrid, yVol, yHealth, yRemGrid, yRemVol, item };
      });
    },

    gridSvgPath() { return this.generateSmoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.yGrid }))); },
    gridSvgArea() {
      const pts = this.chartPoints.map(p => ({ x: p.x, y: p.yGrid }));
      if (pts.length === 0) return '';
      const path = this.generateSmoothPath(pts);
      return `${path} L ${pts[pts.length - 1].x} 180 L ${pts[0].x} 180 Z`;
    },
    volSvgPath() { return this.generateSmoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.yVol }))); },

    healthSvgPath() { return this.generateSmoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.yHealth }))); },
    healthSvgArea() {
      const pts = this.chartPoints.map(p => ({ x: p.x, y: p.yHealth }));
      if (pts.length === 0) return '';
      const path = this.generateSmoothPath(pts);
      return `${path} L ${pts[pts.length - 1].x} 150 L ${pts[0].x} 150 Z`;
    },

    remGridSvgPath() { return this.generateSmoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.yRemGrid }))); },
    remVolSvgPath() { return this.generateSmoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.yRemVol }))); },

    activeStats() {
      if (this.selectedDate !== 'realtime' && this.snapshotStats) {
        return this.snapshotStats;
      }
      return this.summaryStats || {
        total_plan_grid: 0, total_used_grid: 0, total_rem_grid: 0,
        total_plan_vol: 0, total_used_vol: 0, total_rem_vol: 0,
        total_health: '0.0%'
      };
    },

    isAdmin() {
      return true;
    },
    filteredGridData() {
      if (!this.summaryGridData) return [];
      return this.summaryGridData.filter(r => !r.is_subtotal && !r.is_total);
    },
    filteredVolData() {
      if (!this.summaryVolData) return [];
      return this.summaryVolData.filter(r => !r.is_subtotal && !r.is_total);
    },
    
    combinedTableData() {
      if (!this.summaryGridData || this.summaryGridData.length === 0) return [];
      
      return this.summaryGridData.map((gridRow, idx) => {
        const volRow = (this.summaryVolData && this.summaryVolData[idx]) ? this.summaryVolData[idx] : {};

        const sumPlanG = Number(this.getSumVal(gridRow, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        const sumUsedG = Number(this.getSumVal(gridRow, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']));
        const sumRemG = Number(this.getSumVal(gridRow, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        const sumUnrateG = gridRow.sum_unrate_grid || this.getUnrateVal(gridRow, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid');

        let sumPlanV = Number(this.getSumVal(volRow, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
        let sumUsedV = Number(this.getSumVal(volRow, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
        
        let sumRemV = 0;
        if (gridRow.is_subtotal) {
          const targetType = gridRow.loc_type;
          this.summaryVolData.forEach((vr) => {
            if (!vr.is_subtotal && !vr.is_total && vr.loc_type === targetType) {
              sumRemV += Number(this.getSumVal(vr, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
            }
          });
          if (sumRemV === 0) {
            sumRemV = Number(this.getSumVal(volRow, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
          }
        } else {
          sumRemV = Number(this.getSumVal(volRow, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        }

        const sumUnrateV = sumPlanV > 0 ? ((sumRemV / sumPlanV) * 100).toFixed(1) + '%' : '0.0%';
        let sumHealthV = '0.0%';
        if (sumPlanV > 0) {
          const unrate = sumRemV / sumPlanV;
          const denom = 1 - unrate;
          if (denom > 0) {
            sumHealthV = (((sumUsedV / denom) / sumPlanV) * 100).toFixed(1) + '%';
          }
        }

        let dispFloor = gridRow.floor || '';
        let dispType = gridRow.loc_type || '';

        if (gridRow.is_subtotal) {
          dispFloor = gridRow.loc_type ? `${gridRow.loc_type} 小計` : '小計';
          dispType = '';
        } else if (gridRow.is_total) {
          dispFloor = '全區總計';
          dispType = '';
        }

        return {
          ...gridRow,
          displayFloor: dispFloor,
          displayType: dispType,
          sum_plan_grid: sumPlanG,
          sum_used_grid: sumUsedG,
          sum_unrate_grid: sumUnrateG,
          sum_rem_grid: sumRemG,
          sum_plan_vol: parseFloat(sumPlanV.toFixed(1)),
          sum_used_vol: parseFloat(sumUsedV.toFixed(1)),
          sum_unrate_vol: sumUnrateV,
          sum_rem_vol: parseFloat(sumRemV.toFixed(1)),
          sum_health_vol: sumHealthV
        };
      });
    }
  },
  mounted() {
    this.loadExportPerms();
    this.fetchHistoryList();
    if (!this.summaryGridData || this.summaryGridData.length === 0) {
      this.$emit('refresh-summary');
    }
  },
  methods: {
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },

    generateSmoothPath(points) {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      return d;
    },

    async fetchHistoryList() {
      try {
        const res = await axios.get('/api/location-stats/history');
        if (res.data && res.data.success) {
          this.historyList = res.data.data || [];
        }
      } catch (e) {
        console.error('抓取歷史快照失敗:', e.message);
      }
    },

    onDateChange(val) {
      if (val === 'realtime') {
        this.snapshotStats = null;
      } else {
        const target = this.historyList.find(item => item.record_date === val);
        if (target) {
          this.snapshotStats = {
            total_plan_grid: target.plan_grid,
            total_used_grid: target.used_grid,
            total_rem_grid: target.rem_grid,
            total_plan_vol: target.plan_vol,
            total_used_vol: target.used_vol,
            total_rem_vol: target.rem_vol,
            total_health: `${target.health_rate}%`
          };
        }
      }
    },

    async fetchRealtimeAndHistory() {
      this.$emit('refresh-summary');
      await this.fetchHistoryList();
    },

    async deleteSnapshot(recordDate) {
      try {
        await this.$confirm(`確定要刪除 ${recordDate} 的歷史快照紀錄嗎？`, '警告', {
          confirmButtonText: '確定刪除',
          cancelButtonText: '取消',
          type: 'warning'
        });

        const res = await axios.delete('/api/location-stats/delete', { data: { record_date: recordDate } });
        if (res.data?.success) {
          this.$message.success(res.data.message);
          if (this.selectedDate === recordDate) this.selectedDate = 'realtime';
          await this.fetchHistoryList();
        }
      } catch (e) {
        if (e !== 'cancel') this.$message.error('刪除失敗: ' + e.message);
      }
    },

    loadExportPerms() {
      const saved = localStorage.getItem('loc_summary_export_perms');
      if (saved) {
        try {
          this.exportPerms = JSON.parse(saved);
        } catch (e) {
          this.exportPerms = { xlsx: true, pdf: false };
        }
      } else {
        this.exportPerms = { xlsx: true, pdf: false };
      }
    },
    saveExportPerms() {
      localStorage.setItem('loc_summary_export_perms', JSON.stringify(this.exportPerms));
      this.$message.success('💾 匯出權限設定已成功儲存！');
      this.showConfigDialog = false;
    },
    combinedSpanMethod({ row, columnIndex }) {
      if (row.is_subtotal || row.is_total) {
        if (columnIndex === 0) return { rowspan: 1, colspan: 2 };
        else if (columnIndex === 1) return { rowspan: 0, colspan: 0 };
      }
      return { rowspan: 1, colspan: 1 };
    },
    getSumVal(row, primaryKey, subKeys) {
      if (!row) return 0;
      if (row[primaryKey] !== undefined && row[primaryKey] !== null && row[primaryKey] !== '') {
        return row[primaryKey];
      }
      const camelKey = primaryKey.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (row[camelKey] !== undefined && row[camelKey] !== null && row[camelKey] !== '') {
        return row[camelKey];
      }
      let sum = 0;
      if (Array.isArray(subKeys)) {
        subKeys.forEach(k => {
          const val = Number(String(row[k] || 0).replace(/,/g, ''));
          if (!isNaN(val)) sum += val;
        });
      }
      return sum;
    },

    getRemVolForGridTable(row) {
      if (!row) return 0;
      let remV = 0;
      if (row.is_subtotal && this.summaryVolData) {
        const targetType = row.loc_type;
        this.summaryVolData.forEach((vr) => {
          if (!vr.is_subtotal && !vr.is_total && vr.loc_type === targetType) {
            remV += Number(this.getSumVal(vr, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
          }
        });
      } else {
        const idx = this.summaryGridData.indexOf(row);
        if (idx >= 0 && this.summaryVolData && this.summaryVolData[idx]) {
          remV = Number(this.getSumVal(this.summaryVolData[idx], 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
        }
      }
      return parseFloat(remV.toFixed(1));
    },

    getRowHealthVol(row) {
      if (!row) return '0.0%';
      const idx = this.summaryGridData.indexOf(row);
      const vRow = (idx >= 0 && this.summaryVolData) ? this.summaryVolData[idx] : row;

      const planV = Number(this.getSumVal(vRow, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const usedV = Number(this.getSumVal(vRow, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']));
      
      let remV = 0;
      if (row.is_subtotal && this.summaryVolData) {
        const targetType = row.loc_type;
        this.summaryVolData.forEach((vr) => {
          if (!vr.is_subtotal && !vr.is_total && vr.loc_type === targetType) {
            remV += Number(this.getSumVal(vr, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
          }
        });
      } else {
        remV = Number(this.getSumVal(vRow, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']));
      }

      if (planV <= 0) return '0.0%';

      const unrate = remV / planV;
      const denom = 1 - unrate;
      if (denom <= 0) return '0.0%';

      const adjustedUsed = usedV / denom;
      return ((adjustedUsed / planV) * 100).toFixed(1) + '%';
    },

    getUnrateVal(row, unrateKey, planKey, usedKey, isVol = false) {
      if (!row) return '0.0%';
      if (row[unrateKey]) return row[unrateKey];
      const plan = Number(this.getSumVal(row, planKey, isVol ? ['plan_A區','plan_B區','plan_C區','plan_D區'] : ['plan_A區','plan_B區','plan_C區','plan_D區']));
      const used = Number(this.getSumVal(row, usedKey, isVol ? ['used_A區','used_B區','used_C區','used_D區'] : ['used_A區','used_B區','used_C區','used_D區']));
      if (plan <= 0) return '0.0%';
      const rem = Math.max(0, plan - used);
      return ((rem / plan) * 100).toFixed(1) + '%';
    },
    tableRowClassName({ row }) {
      if (row.is_total) return 'total-row';
      if (row.is_subtotal) return 'subtotal-row';
      return '';
    },
    openConfigModal() {
      this.loadExportPerms();
      this.showConfigDialog = true;
      this.fetchLocationsMaster();
    },
    async fetchLocationsMaster() {
      this.masterLoading = true;
      try {
        const res = await axios.get('/api/get-locations-master');
        if (res.data?.success) {
          this.masterTableData = res.data.data || [];
        }
      } catch (err) {
        this.$message.error('讀取儲位結構清單失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.masterLoading = false;
      }
    },
    async handleMasterCsvUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.isUploading = true;
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post('/api/import-locations-master', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          this.$message.success(`🎉 成功匯入 ${res.data.count.toLocaleString()} 筆儲位定義結構！`);
          await this.fetchLocationsMaster();
          this.$emit('refresh-summary');
        } else {
          this.$message.error('匯入失敗：' + (res.data?.message || '未知錯誤'));
        }
      } catch (err) {
        this.$message.error('連線或寫入失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.isUploading = false;
        event.target.value = '';
      }
    },

    // 匯出 XLSX
    async exportFullXlsx() {
      if (!this.exportPerms.xlsx) {
        return this.$message.warning('權限受限：管理者尚未開放匯出 xlsx 功能');
      }
      this.exportingXlsx = true;
      try {
        const wb = XLSX.utils.book_new();

        const gridAOA = [
          ['樓層', '儲位類型', '規劃', '', '', '', '已使用', '', '', '', '未使用率 (%)', '', '', '', '剩餘', '', '', '', '【儲位格數彙總】', '', '', '', ''],
          ['', '', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '未使用率(%)', '剩餘儲位數', '剩餘才數']
        ];
        this.filteredGridData.forEach(r => {
          gridAOA.push([
            r.floor || '', r.loc_type || '',
            r.plan_A區 || 0, r.plan_B區 || 0, r.plan_C區 || 0, r.plan_D區 || 0,
            r.used_A區 || 0, r.used_B區 || 0, r.used_C區 || 0, r.used_D區 || 0,
            r.unrate_A區 || '', r.unrate_B區 || '', r.unrate_C區 || '', r.unrate_D區 || '',
            r.rem_A區 || 0, r.rem_B區 || 0, r.rem_C區 || 0, r.rem_D區 || 0,
            this.getSumVal(r, 'sum_plan_grid', ['plan_A區','plan_B區','plan_C區','plan_D區']),
            this.getSumVal(r, 'sum_used_grid', ['used_A區','used_B區','used_C區','used_D區']),
            this.getUnrateVal(r, 'sum_unrate_grid', 'sum_plan_grid', 'sum_used_grid'),
            this.getSumVal(r, 'sum_rem_grid', ['rem_A區','rem_B區','rem_C區','rem_D區']),
            this.getRemVolForGridTable(r)
          ]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(gridAOA);
        ws1['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } }, { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
          { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } }, { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
          { s: { r: 0, c: 18 }, e: { r: 0, c: 22 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, "儲格數交叉統計表");

        const volAOA = [
          ['樓層', '儲位類型', '規劃總才數', '', '', '', '使用中才數', '', '', '', '剩餘才數', '', '', '', '【才數彙總】', '', '', '', ''],
          ['', '', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', 'A區', 'B區', 'C區', 'D區', '規劃數', '已使用', '未使用率(%)', '剩餘才數', '儲位健康度']
        ];
        this.filteredVolData.forEach(r => {
          volAOA.push([
            r.floor || '', r.loc_type || '',
            r.plan_A區 || 0, r.plan_B區 || 0, r.plan_C區 || 0, r.plan_D區 || 0,
            r.used_A區 || 0, r.used_B區 || 0, r.used_C區 || 0, r.used_D區 || 0,
            r.rem_A區 || 0, r.rem_B區 || 0, r.rem_C區 || 0, r.rem_D區 || 0,
            this.getSumVal(r, 'sum_plan_vol', ['plan_A區','plan_B區','plan_C區','plan_D區']),
            this.getSumVal(r, 'sum_used_vol', ['used_A區','used_B區','used_C區','used_D區']),
            this.getUnrateVal(r, 'sum_unrate_vol', 'sum_plan_vol', 'sum_used_vol', true),
            this.getSumVal(r, 'sum_rem_vol', ['rem_A區','rem_B區','rem_C區','rem_D區']),
            this.getRowHealthVol(r)
          ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(volAOA);
        ws2['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } }, { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
          { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } }, { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } },
          { s: { r: 0, c: 18 }, e: { r: 0, c: 22 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws2, "才數交叉統計表");

        const combAOA = [
          ['樓層', '儲位類型', '【儲位格數彙總】', '', '', '', '', '【才數彙總】', '', '', '', ''],
          ['', '', '規劃數', '已使用', '未使用率(%)', '剩餘儲位數', '剩餘才數', '規劃數', '已使用', '未使用率(%)', '剩餘才數', '儲位健康度']
        ];
        this.combinedTableData.forEach(r => {
          combAOA.push([
            r.displayFloor || r.floor || '',
            r.displayType || r.loc_type || '',
            r.sum_plan_grid, r.sum_used_grid, r.sum_unrate_grid, r.sum_rem_grid, r.sum_rem_vol,
            r.sum_plan_vol, r.sum_used_vol, r.sum_unrate_vol, r.sum_rem_vol, r.sum_health_vol
          ]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(combAOA);
        ws3['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } }, { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } }
        ];
        XLSX.utils.book_append_sheet(wb, ws3, "儲位與才數綜合總覽表");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `儲位管理系統_跨區交叉矩陣統計總表_${dateStr}.xlsx`);
        this.$message.success('🎉 成功匯出 Excel 檔案！');
      } catch (err) {
        this.$message.error('匯出 XLSX 失敗：' + err.message);
      } finally {
        this.exportingXlsx = false;
      }
    }
  }
}
</script>

<style scoped>
.loc-summary-page {
  padding: 12px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.summary-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-bar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.left-title-group {
  display: flex;
  align-items: center;
}

.page-title-text {
  font-size: 15px;
  font-weight: bold;
  color: #38bdf8;
}

.history-tag {
  margin-left: 10px;
  background-color: #f59e0b;
  color: #000;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.export-top-btn {
  font-weight: bold;
  border-radius: 4px;
}

.btn-xlsx {
  background-color: #65a30d !important;
  border-color: #4d7c0f !important;
  color: #ffffff !important;
}

.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.stat-lbl { font-size: 12px; color: #94a3b8; }
.stat-val { font-size: 18px; font-weight: bold; margin-top: 2px; }

.text-blue { color: #38bdf8; }
.text-green { color: #4ade80; }
.text-orange { color: #fbbf24; }
.text-cyan { color: #22d3ee; }
.font-bold { font-weight: bold; }

.stat-card.highlight-health {
  background: rgba(34, 211, 238, 0.1);
  border-color: #0891b2;
}

.progress-box {
  background: #1e293b;
  padding: 25px;
  border-radius: 10px;
  border: 1px solid #334155;
  margin-top: 20px;
}

.progress-lbl {
  color: #38bdf8;
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 14px;
}

.tables-main-wrapper {
  margin-top: 5px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.dark-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e293b !important;
  border-color: #334155 !important;
}

:deep(.dark-tabs .el-tabs__content) {
  flex: 1;
  padding: 8px;
  height: calc(100% - 40px);
  min-height: 0;
}

:deep(.dark-tabs .el-tab-pane) {
  height: 100%;
}

:deep(.pivot-table tr.subtotal-row td) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  font-weight: bold;
  border-top: 2px solid #38bdf8 !important;
}

:deep(.pivot-table tr.total-row td) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  border-top: 3px solid #38bdf8 !important;
}

:deep(.pivot-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  font-weight: bold;
  text-align: center;
  border-right: 1px solid #334155 !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.pivot-table .section-border-right) {
  border-right: 3px solid #38bdf8 !important;
}

:deep(.pivot-table th.summary-header-group) {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
}

:deep(.pivot-table th.summary-header-group-vol) {
  background-color: #4338ca !important;
  color: #ffffff !important;
  border-left: 3px solid #38bdf8 !important;
}

.no-trend-box {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.svg-charts-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
  overflow-y: auto;
  padding: 5px;
}

.svg-chart-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 16px;
}

.chart-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 10px;
}

.chart-legend {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #94a3b8;
}

.tip-text {
  font-size: 11px;
  color: #4ade80;
  font-weight: normal;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.dot.blue { background-color: #38bdf8; }
.dot.green { background-color: #4ade80; }
.dot.orange { background-color: #f97316; }
.dot.yellow { background-color: #eab308; }

.svg-stage {
  width: 100%;
  background: #1e293b;
  border-radius: 6px;
  padding: 10px 0;
}

.svg-graph {
  width: 100%;
  height: auto;
  overflow: visible;
}

.history-page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 5px;
}

.history-page-header {
  display: flex;
  align-items: baseline;
  gap: 15px;
  background: #0f172a;
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid #334155;
}

.history-page-title {
  font-size: 15px;
  font-weight: bold;
  color: #38bdf8;
}

.history-page-subtitle {
  font-size: 12px;
  color: #94a3b8;
}

.type-details-nested-box {
  padding: 10px 20px;
  background-color: #0f172a;
  border-radius: 6px;
}

.nested-title {
  font-size: 12px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 8px;
}

:deep(.dark-nested-table) {
  background-color: #1e293b !important;
}

:deep(.dark-nested-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
}

.config-modal-content { color: #f8fafc; }
.upload-top-bar { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 4px; }
.section-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; }
.section-desc code { background: #0f172a; color: #f43f5e; padding: 2px 6px; border-radius: 4px; }
.master-preview-table { margin-top: 10px; }

.perm-config-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px 16px;
  margin-top: 10px;
}

.perm-title-desc {
  font-size: 14px;
  font-weight: bold;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 6px;
}

.perm-icon { font-size: 16px; }
.perm-sub-text { font-size: 12px; color: #94a3b8; margin: 4px 0 12px 0; }
.perm-checkbox-group { display: flex; flex-direction: column; gap: 8px; }

:deep(.dark-checkbox .el-checkbox__label) { color: #e2e8f0 !important; font-size: 13px; }
:deep(.dark-checkbox .el-checkbox__inner) { background-color: #1e293b; border-color: #475569; }
:deep(.dark-checkbox.is-checked .el-checkbox__inner) { background-color: #38bdf8; border-color: #38bdf8; }

@media (max-width: 1400px) {
  .stats-overview-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>