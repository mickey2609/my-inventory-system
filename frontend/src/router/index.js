// frontend/src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Home', meta: { tab: 'home' } },
  { path: '/inv-query-80', name: 'InvQuery80', meta: { tab: 'inv80' } },
  { path: '/inv-search-15', name: 'InvSearch15', meta: { tab: 'inv15' } },
  { path: '/loc-summary', name: 'LocSummary', meta: { tab: 'loc_summary' } },
  { path: '/item-sales-history', name: 'ItemSalesHistory', meta: { tab: 'item_sales_history' } },
  { path: '/turnover', name: 'Turnover', meta: { tab: 'turnover' } },
  { path: '/abnormal-purchase', name: 'AbnormalPurchase', meta: { tab: 'abnormal_purchase' } },
  { path: '/inbound-fish', name: 'InboundFish', meta: { tab: 'inbound_fish' } },
  { path: '/replenish-fish', name: 'ReplenishFish', meta: { tab: 'replenish_fish' } },
  { path: '/transfer-8015', name: 'Transfer8015', meta: { tab: 'transfer_80_15' } },
  { path: '/transfer-1580', name: 'Transfer1580', meta: { tab: 'transfer_15_80' } },
  { path: '/settings-perm', name: 'SettingsPerm', meta: { tab: 'settings_perm' } },
  { path: '/settings-log', name: 'SettingsLog', meta: { tab: 'settings_log' } }
]

const router = createRouter({
  // 🌟 使用 Hash 模式，在 Cloudflare Pages 上重新整理絕不 404
  history: createWebHashHistory(),
  routes
})

export default router