<template>
  <div class="dashboard-home">
    <div class="welcome-banner">
      <h2>👋 歡迎回來，{{ currentUser }}</h2>
      <p>當前 Cloudflare D1 資料庫即時運作狀態與數據概覽</p>
    </div>

    <!-- 數據指標卡片 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="card-icon">📦</div>
        <div class="card-info">
          <span class="card-title">總庫存明細筆數</span>
          <span class="card-value">{{ dbMetrics.totalRows.toLocaleString() }} <small>筆</small></span>
        </div>
      </div>

      <div class="metric-card">
        <div class="card-icon">🏢</div>
        <div class="card-info">
          <span class="card-title">涵蓋大區數量</span>
          <span class="card-value">{{ dbMetrics.totalCategories }} <small>個區域</small></span>
        </div>
      </div>

      <div class="metric-card">
        <div class="card-icon">⚡</div>
        <div class="card-info">
          <span class="card-title">D1 引擎狀態</span>
          <span class="card-value status-online">🟢 正常運作中</span>
        </div>
      </div>
    </div>

    <!-- 快捷功能入口卡片 -->
    <div class="quick-actions-section">
      <h3>🚀 快捷功能選單</h3>
      <div class="actions-grid">
        <div class="action-card" @click="$emit('open-tab', 'inv80')">
          <div class="action-icon">🔍</div>
          <div class="action-text">
            <h4>庫存查詢80</h4>
            <p>多條件搜尋商品 ID、儲位、大區小區與庫齡明細</p>
          </div>
        </div>

        <div class="action-card" @click="$emit('open-tab', 'loc_summary')">
          <div class="action-icon">📊</div>
          <div class="action-text">
            <h4>儲位數才數統整</h4>
            <p>自動計算各區域規劃才數、使用率與儲位健康度</p>
          </div>
        </div>

        <div class="action-card" @click="$emit('open-import-inventory')">
          <div class="action-icon">📥</div>
          <div class="action-text">
            <h4>匯入庫存 CSV</h4>
            <p>上傳最新商品庫存明細並寫入 Cloudflare D1</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeDashboard',
  props: {
    currentUser: String,
    dbMetrics: {
      type: Object,
      default: () => ({ totalRows: 0, totalCategories: 0 })
    }
  },
  emits: ['open-tab', 'open-import-inventory']
}
</script>

<style scoped>
.dashboard-home {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}
.welcome-banner { margin-bottom: 28px; }
.welcome-banner h2 { font-size: 1.8rem; margin: 0 0 8px 0; color: #38bdf8; }
.welcome-banner p { color: #94a3b8; margin: 0; }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 36px;
}
.metric-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.card-icon { font-size: 2.2rem; background: #0f172a; padding: 12px; border-radius: 10px; }
.card-info { display: flex; flex-direction: column; }
.card-title { font-size: 0.85rem; color: #94a3b8; margin-bottom: 4px; }
.card-value { font-size: 1.5rem; font-weight: bold; color: #f8fafc; }
.card-value small { font-size: 0.85rem; font-weight: normal; color: #64748b; }
.status-online { color: #4ade80; font-size: 1.1rem; }

.quick-actions-section h3 { font-size: 1.2rem; margin-bottom: 16px; color: #f8fafc; }
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}
.action-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-card:hover {
  border-color: #38bdf8;
  transform: translateY(-2px);
  background: #26334d;
}
.action-icon { font-size: 2rem; }
.action-text h4 { margin: 0 0 6px 0; font-size: 1.05rem; color: #f8fafc; }
.action-text p { margin: 0; font-size: 0.85rem; color: #94a3b8; line-height: 1.4; }
</style>