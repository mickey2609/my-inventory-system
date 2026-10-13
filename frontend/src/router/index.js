// frontend/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomeDashboard from '../views/HomeDashboard.vue'
import InvQuery80 from '../views/InvQuery80.vue'
import InvSearch15 from '../views/InvSearch15.vue'
import LocSummary from '../views/LocSummary.vue'
import InboundFishList from '../views/InboundFishList.vue'
import ReplenishFishList from '../views/ReplenishFishList.vue'
import Transfer8015FishList from '../views/Transfer8015FishList.vue'
import SettingsPerm from '../views/SettingsPerm.vue'
import SettingsLog from '../views/SettingsLog.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeDashboard
  },
  {
    path: '/inv-query-80',
    name: 'InvQuery80',
    component: InvQuery80
  },
  {
    path: '/inv-search-15',
    name: 'InvSearch15',
    component: InvSearch15
  },
  {
    path: '/loc-summary',
    name: 'LocSummary',
    component: LocSummary
  },
  {
    path: '/inbound-fish',
    name: 'InboundFish',
    component: InboundFishList
  },
  {
    path: '/replenish-fish',
    name: 'ReplenishFish',
    component: ReplenishFishList
  },
  {
    path: '/transfer-8015',
    name: 'Transfer8015',
    component: Transfer8015FishList
  },
  {
    path: '/settings-perm',
    name: 'SettingsPerm',
    component: SettingsPerm
  },
  {
    path: '/settings-log',
    name: 'SettingsLog',
    component: SettingsLog
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router