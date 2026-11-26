<!-- frontend/src/components/StorageSimulationTab.vue -->
<template>
  <div class="tab-content" v-loading="simLoading">
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
          :class="{ 'sim-recommended': m.recommended, 'sim-active': activeMode === m.mode }"
        >
          <div class="sim-card-top">
            <div class="sim-mode-title">{{ m.name }}</div>
            <div class="sim-badges">
              <span v-if="m.recommended" class="rec-badge">🏆 系統推薦最佳平衡</span>
              <span v-if="activeMode === m.mode" class="cur-badge">目前啟用中</span>
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
              v-if="isSysAdmin"
              size="mini"
              :type="m.recommended ? 'success' : 'primary'"
              :plain="activeMode === m.mode"
              style="width: 100%;"
              @click="$emit('apply-mode', m.mode)"
            >
              {{ activeMode === m.mode ? '✓ 已套用此擺放模式' : '⚡ 一鍵切換套用此模式' }}
            </el-button>
            <div
              v-else-if="activeMode === m.mode"
              style="text-align: center; font-size: 12px; font-weight: bold; color: #38bdf8; padding: 5px; background: rgba(56, 189, 248, 0.12); border-radius: 4px;"
            >
              ✓ 目前系統啟用中之擺放模式
            </div>
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
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

export default {
  name: 'StorageSimulationTab',
  props: {
    activeMode: {
      type: String,
      default: 'CAT_TRADE'
    },
    isSysAdmin: {
      type: Boolean,
      default: false
    }
  },
  emits: ['apply-mode'],
  data() {
    return {
      simLoading: false,
      simData: {
        hasData: false,
        tierDistribution: [],
        modesComparison: [],
        topMoveCandidates: []
      }
    }
  },
  mounted() {
    this.fetchSimulation()
  },
  methods: {
    async fetchSimulation() {
      this.simLoading = true
      try {
        const res = await axios.get('/api/storage-accuracy/audit/simulate-modes')
        if (res.data?.success) {
          this.simData = res.data
        }
      } catch (e) {
        ElMessage.error('載入動線模擬分析失敗：' + e.message)
      } finally {
        this.simLoading = false
      }
    }
  }
}
</script>

<style scoped>
.tab-content { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }

.empty-guide-card {
  background: #1e293b;
  border: 1px dashed #475569;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  color: #cbd5e1;
}

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

.panel-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.panel-head { background: #0f172a; padding: 7px 12px; font-size: 13px; font-weight: bold; border-bottom: 1px solid #334155; flex-shrink: 0; }

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

.role-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; }
.role-PICK { background: rgba(74, 222, 128, 0.16); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.35); }
.role-STORAGE { background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
.role-BOTH { background: rgba(250, 204, 21, 0.16); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.35); }
.role-CLOSED { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); }

.tier-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.tier-A { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
.tier-B { background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); }
.tier-C { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.tier-D { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }

.text-blue { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-green { color: #4ade80; }
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.text-dim { color: #94a3b8; }
.font-bold { font-weight: bold; }
</style>