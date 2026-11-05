// frontend/src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeDashboard.vue')
  },
  {
    path: '/inv-query-80',
    name: 'InvQuery80',
    component: () => import('../views/InvQuery80.vue')
  },
  {
    path: '/inv-search-15',
    name: 'InvSearch15',
    component: () => import('../views/InvSearch15.vue')
  },
  {
    path: '/loc-summary',
    name: 'LocSummary',
    component: () => import('../views/LocSummary.vue')
  },
  {
    path: '/item-sales-history',
    name: 'ItemSalesHistory',
    component: () => import('../views/ItemSalesHistory.vue')
  },
  {
    path: '/turnover',
    name: 'TurnoverList',
    component: () => import('../views/TurnoverList.vue')
  },
  {
    path: '/abnormal-purchase',
    name: 'AbnormalPurchase',
    component: () => import('../views/AbnormalPurchase.vue')
  },
  {
    path: '/inbound-fish',
    name: 'InboundFishList',
    component: () => import('../views/InboundFishList.vue')
  },
  {
    path: '/replenish-fish',
    name: 'ReplenishFishList',
    component: () => import('../views/ReplenishFishList.vue')
  },
  {
    path: '/transfer-8015',
    name: 'Transfer8015FishList',
    component: () => import('../views/Transfer8015FishList.vue')
  },
  {
    path: '/transfer-1580',
    name: 'Transfer1580FishList',
    component: () => import('../views/Transfer1580FishList.vue')
  },
  {
    path: '/dispatch-fish',
    name: 'DispatchFishList',
    component: () => import('../views/DispatchFishList.vue')
  },
  {
    path: '/settings-perm',
    name: 'SettingsPerm',
    component: () => import('../views/SettingsPerm.vue')
  },
  {
    path: '/settings-log',
    name: 'SettingsLog',
    component: () => import('../views/SettingsLog.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router