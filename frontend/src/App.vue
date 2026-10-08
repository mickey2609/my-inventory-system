<template>
  <div id="app" class="app-container dark-mode">
    <input type="file" ref="inventoryFileInput" style="display: none;" accept=".csv,.xlsx,.xls" @change="handleInventoryUpload" />

    <!-- 1. 登入遮罩畫面 -->
    <LoginOverlay 
      v-if="!isLoggedIn" 
      :login-form="loginForm" 
      :loading="loginLoading" 
      :timeout-message="timeoutMessage" 
      :app-version="appVersion"
      @login="handleLogin" 
    />

    <!-- 2. 登入後主頁面 -->
    <div v-else class="app-main-content">
      <TopNavbar 
        :current-tab="currentTab"
        :opened-tabs="openedTabs"
        :app-version="appVersion"
        :current-user="currentUser"
        :show-export-btn="currentTab === 'loc_summary' && (summaryGridData.length > 0 || areaGridTable.length > 0)"
        @switch-tab="switchTab"
        @close-tab="closeTab"
        @open-drawer="showUnifiedDrawer = true"
        @export-excel="exportData('excel')"
      />

      <div class="views-wrapper">
        <keep-alive>
          <HomeDashboard 
            v-if="currentTab === 'home'" key="home"
            :current-user="currentUser" 
            :current-user-permissions="currentUserPermissions"
            :is-sys-admin="isSysAdmin"
            :db-metrics="dbMetrics" 
            @open-tab="openNewTab"
            @logout-offline="handleLogout"
          />

          <LocSummary 
            v-else-if="currentTab === 'loc_summary'" key="loc_summary"
            :loading="locLoading" :calc-progress="calcProgress" :progress-colors="progressColors"
            :summaryStats="summaryStats" :area-grid-table="areaGridTable" :summary-grid-data="summaryGridData"
            :area-vol-table="areaVolTable" :summary-vol-data="summaryVolData"
            @refresh-summary="handleSummaryCalc"
          />

          <!-- 🌟 80 庫專屬隔離數據 🌟 -->
          <InvQuery80 
            v-else-if="currentTab === 'inv80'" key="inv80"
            :has-searched="hasSearched80" :summary="summary80" :search-time="searchTime80"
            :loading="loading" :table-data="tableData80" :columns="columns80"
            :current-page="currentPage80" :page-size="pageSize80" :total-rows-count="totalRowsCount80"
            :custom-widths="customColWidths80" :form="form80"
            :export-config="exportConfig80"
            :is-sys-admin="isSysAdmin"
            :current-username="currentUsername"
            @open-search="openSearchModal" @export-data="exportData" @page-change="p => handlePageChange(p, 'inv80')"
            @size-change="s => handlePageSizeChange(s, 'inv80')"
          />

          <!-- 🌟 15 庫專屬隔離數據 🌟 -->
          <InvSearch15 
            v-else-if="currentTab === 'inv15'" key="inv15"
            :has-searched="hasSearched15" :summary="summary15" :search-time="searchTime15"
            :loading="loading" :table-data="tableData15" :columns="columns15"
            :current-page="currentPage15" :page-size="pageSize15" :total-rows-count="totalRowsCount15"
            :custom-widths="customColWidths15" :form="form15"
            :export-config="exportConfig15"
            :is-sys-admin="isSysAdmin"
            :current-username="currentUsername"
            @open-search="openSearchModal" @export-data="exportData" @page-change="p => handlePageChange(p, 'inv15')"
            @size-change="s => handlePageSizeChange(s, 'inv15')"
            @refresh-metrics="fetchDashboardMetrics"
          />

          <!-- 🌟 迴轉率清單專屬視圖 🌟 -->
          <TurnoverList 
            v-else-if="currentTab === 'turnover'" key="turnover" 
            :is-sys-admin="isSysAdmin"
          />

          <!-- 🌟 4 個全新魚群與調撥模組頁面 🌟 -->
          <InboundFishList 
            v-else-if="currentTab === 'inbound_fish'" key="inbound_fish"
          />

          <SettingsLog 
            v-else-if="currentTab === 'settings_log'" key="settings_log"
            v-model:log-tab="logTab" :filtered-logs-list="logsList" @refresh-logs="fetchLogs"
          />

          <SettingsPerm 
            v-else-if="currentTab === 'settings_perm'" key="settings_perm"
            :users-list="usersList" :current-user="currentUser" :current-username="currentUsername"
            @open-import-tip="showImportTipDialog = true" @export-users="exportUsersExcel"
            @refresh-users="fetchUsers" @open-add-dialog="showAddUserDialog = true"
            @open-role="openRoleDialog" @open-pwd="openPwdDialog" @open-perm="openPermDialog"
            @delete-user="onDeleteUser" @batch-upload="handleBatchUsersUpload"
          />

          <div class="coming-soon-container dark-bg" v-else key="coming_soon">
            <div class="coming-soon-card dark-card">
              <div class="icon">🚧</div>
              <h2 class="text-white">【{{ getTabName(currentTab) }}】 功能尚未上線</h2>
              <p class="text-gray">此模組正在全力開發中，敬請期待後續功能更新！</p>
              <button class="back-btn" @click="switchTab('home')">返回 系統首頁</button>
            </div>
          </div>
        </keep-alive>
      </div>
    </div>

    <!-- 3. 全局彈窗與抽屜組件 -->
    <SystemDrawer 
      v-model="showUnifiedDrawer" 
      :current-user="currentUser" 
      :current-tab="currentTab"
      :login-time-str="loginTimeStr" 
      :session-duration-str="sessionDurationStr" 
      :idle-countdown-str="idleCountdownStr"
      :is-admin="isAdmin"
      :is-sys-admin="isSysAdmin"
      :user-permissions="currentUserPermissions"
      @logout="handleLogout" 
      @switch-tab="openNewTab" 
      @open-import-inventory="showInventoryImportTipDialog = true"
    />

    <ColConfigModal 
      v-model="showColSettingDialog" :is-admin="isSysAdmin" :all-available-columns="allAvailableColumns"
      :selected-columns="currentForm.selected_columns" :dragged-index="draggedIndex" :saving-config="savingConfig"
      :raw-columns-master="rawColumnsMaster" @select-all="selectAllCols" @unselect-all="unselectAllCols"
      @drag-start="onDragStart" @drag-over="onDragOver" @drag-drop="onDrop" @drag-end="onDragEnd"
      @toggle-col="toggleColumnSelection" @save-config="saveColumnConfig"
    />

    <ParamMenuModal 
      v-model="showParamMenuDialog"
      :form="currentForm"
      :current-tab="currentTab"
      :export-config="currentExportConfig"
      :saving="savingExportConfig"
      @update-export-config="updateCurrentExportConfig"
      @save-export-config="saveExportConfig"
      @open-import-inventory="showParamMenuDialog = false; showInventoryImportTipDialog = true;"
      @open-col-setting="showParamMenuDialog = false; showColSettingDialog = true;"
      @open-width-config="showParamMenuDialog = false; showWidthConfigDialog = true;"
      @open-export-width-config="showParamMenuDialog = false; showExportWidthConfigDialog = true;"
    />

    <WidthConfigModal 
      v-model:show-width-config="showWidthConfigDialog" v-model:show-export-width-config="showExportWidthConfigDialog"
      :selected-columns="currentForm.selected_columns" :custom-col-widths="currentCustomColWidths" :custom-export-col-widths="currentCustomExportWidths"
    />

    <ImportTipModal 
      v-model:show-inventory-import-tip="showInventoryImportTipDialog" v-model:show-import-tip="showImportTipDialog"
      :is-uploading="isUploading" :upload-percent="uploadPercent"
      @confirm-inventory-import="triggerSelectInventoryFile" @confirm-batch-import="triggerSelectBatchFile"
    />

    <UserManagementModals 
      v-model:show-edit-role="showEditRoleDialog" v-model:show-edit-pwd="showEditPwdDialog"
      v-model:show-edit-perm="showEditPermDialog" v-model:show-add-user="showAddUserDialog"
      :target-user="targetUser" :edit-role-form="editRoleForm" :edit-password-form="editPasswordForm"
      :edit-perm-form="editPermForm" :new-user-form="newUserForm" :available-modules="availableModules"
      :is-sys-admin="isSysAdmin"
      @save-role="onSaveRole" @save-pwd="onSavePwd" @save-perm="onSavePerm" @save-add-user="onSaveAddUser"
    />

    <InventorySearchModal 
      v-model="showSearchModal" :form="currentForm" :options="options" :loading="loading" :search-elapsed-sec="searchElapsedSec"
      :is-sys-admin="isSysAdmin" :enable-sort-config="false"
      @open-param-menu="showParamMenuDialog = true" @big-zone-change="onBigZoneChange" @submit-search="handleSearch"
    />
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage } from 'element-plus'

import TopNavbar from './components/TopNavbar.vue'
import SystemDrawer from './components/SystemDrawer.vue'
import ColConfigModal from './components/ColConfigModal.vue'
import ParamMenuModal from './components/ParamMenuModal.vue'
import WidthConfigModal from './components/WidthConfigModal.vue'
import ImportTipModal from './components/ImportTipModal.vue'
import UserManagementModals from './components/UserManagementModals.vue'
import InventorySearchModal from './components/InventorySearchModal.vue'

import HomeDashboard from './views/HomeDashboard.vue'
import LoginOverlay from './views/LoginOverlay.vue'
import InvQuery80 from './views/InvQuery80.vue'
import InvSearch15 from './views/InvSearch15.vue'
import LocSummary from './views/LocSummary.vue'
import TurnoverList from './views/TurnoverList.vue'
import InboundFishList from './views/InboundFishList.vue'
import SettingsPerm from './views/SettingsPerm.vue'
import SettingsLog from './views/SettingsLog.vue'

import { useAuthSession } from './composables/useAuthSession.js'
import { useSystemLogs } from './composables/useSystemLogs.js'
import { useUserManagement } from './composables/useUserManagement.js'
import { useLocSummary } from './composables/useLocSummary.js'
import { processCsvUpload, processExportData, triggerSaveLocationHistory } from './utils/exportImportHelpers.js'

export default {
  name: 'App',
  components: {
    TopNavbar, SystemDrawer, ColConfigModal, ParamMenuModal, WidthConfigModal,
    ImportTipModal, UserManagementModals, InventorySearchModal, HomeDashboard,
    LoginOverlay, InvQuery80, InvSearch15, LocSummary, TurnoverList, InboundFishList, SettingsPerm, SettingsLog
  },
  setup() {
    const { sendLog, getDeviceType, setupAxiosInterceptor } = useSystemLogs();
    
    const onAutoLogout = () => {
      authSession.clearSession();
      authSession.stopTimers();
      window.location.reload();
    };

    const authSession = useAuthSession(onAutoLogout);
    const sendCurrentLogFunc = (feat, act) => sendLog('system', feat, act);
    const userManagement = useUserManagement(sendCurrentLogFunc);
    const locSummaryHook = useLocSummary(sendCurrentLogFunc);

    return {
      sendLog, getDeviceType, setupAxiosInterceptor,
      ...authSession, ...userManagement,
      locLoading: locSummaryHook.loading, calcProgress: locSummaryHook.calcProgress,
      progressColors: locSummaryHook.progressColors, summaryGridData: locSummaryHook.summaryGridData,
      summaryVolData: locSummaryHook.summaryVolData, areaGridTable: locSummaryHook.areaGridTable,
      areaVolTable: locSummaryHook.areaVolTable, summaryStats: locSummaryHook.summaryStats,
      handleSummaryCalc: locSummaryHook.handleSummaryCalc
    };
  },
  data() {
    const full48Cols = [
      "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
      "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
      "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "儲位編碼-3", "儲位編碼", "儲位編碼5",
      "樓層", "樓層區域", "儲位型態", "大區編", "大區名", "三邊長", "最長邊", "最短邊", "儲位才數", "儲位健康度",
      "不符合", "材積判斷", "總才數", "人工/自動", "儲位層標示", "庫齡級距", "樓層設定", "重型架判斷", "ID指定樓層", "備註"
    ];

    return {
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2026.10.08',
      isLoggedIn: false, currentUser: '', currentUsername: '', currentUserRole: 'user', loginLoading: false, savingConfig: false,
      savingExportConfig: false, currentUserPermissions: [],
      showUnifiedDrawer: false, showSearchModal: false, showParamMenuDialog: false, showWidthConfigDialog: false,
      showExportWidthConfigDialog: false, showImportTipDialog: false, showInventoryImportTipDialog: false,
      isUploading: false, uploadPercent: 0, timeoutMessage: '', searchTimer: null, searchElapsedSec: 0,
      heartbeatTimer: null,
      loginForm: { username: '', password: '', rememberMe: true },
      currentTab: 'home', openedTabs: ['home'], 
      
      dbMetrics: { totalRows80: 0, totalRows15: 0, serverUptimeSec: 0 },
      logTab: 'normal', loading: false, draggedIndex: null,

      hasSearched80: false, searchTime80: '', currentPage80: 1, pageSize80: 500, totalRowsCount80: 0,
      tableData80: [], columns80: [], summary80: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
      exportConfig80: { xlsx: false, csv: false, pdf: false },
      customColWidths80: { '商品ID': 180, '商品名稱': 300, '儲位': 130 },
      customExportColWidths80: { '商品ID': 25, '商品名稱': 40, '儲位': 15 },
      form80: {
        search_mode: 'normal', batch_ids: '', batch_zones: '', txt_id: '', txt_name: '', cbo_big_zone: '',
        cbo_zone: '', cbo_loc_id: '', cbo_floor: '', cbo_type: '', cbo_vol_type: '', txt_age: '', txt_weight: '',
        txt_monthly_sales: '', selected_columns: [...full48Cols], chk_show_loc: true, chk_show_dim: true, cbo_sort: '商品ID', sort_order: 'desc'
      },

      hasSearched15: false, searchTime15: '', currentPage15: 1, pageSize15: 500, totalRowsCount15: 0,
      tableData15: [], columns15: [], summary15: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
      exportConfig15: { xlsx: false, csv: false, pdf: false },
      customColWidths15: { '商品ID': 180, '商品名稱': 300, '儲位': 130 },
      customExportColWidths15: { '商品ID': 25, '商品名稱': 40, '儲位': 15 },
      form15: {
        search_mode: 'normal', batch_ids: '', batch_zones: '', txt_id: '', txt_name: '', cbo_big_zone: '',
        cbo_zone: '', cbo_loc_id: '', cbo_floor: '', cbo_type: '', cbo_vol_type: '', txt_age: '', txt_weight: '',
        txt_monthly_sales: '', selected_columns: [...full48Cols], chk_show_loc: true, chk_show_dim: true, cbo_sort: '商品ID', sort_order: 'desc'
      },

      // 🌟 可供授權勾選的全量模組清單 (含 4 個全新魚群與調撥模組)
      availableModules: [
        { key: 'loc_summary', name: '📊 儲位數才數統整' },
        { key: 'inv80', name: '🔍 庫存查詢80' },
        { key: 'inv15', name: '📦 庫存查詢15' },
        { key: 'turnover', name: '📈 迴轉率清單' },
        { key: 'abnormal_purchase', name: '⚠️ 不合理進貨清單' },
        { key: 'inbound_fish', name: '🐟 進貨上架魚群' },
        { key: 'replenish_fish', name: '🐟 立即補貨單魚群' },
        { key: 'transfer_80_15', name: '🔄 跨庫調撥 80 ➔ 15' },
        { key: 'transfer_15_80', name: '🔄 跨庫調撥 15 ➔ 80' }
      ],

      rawColumnsMaster: [...full48Cols],
      allAvailableColumns: [...full48Cols],
      options: { big_zones: [], zones_map: {}, zones: [], floors: [], ap_types: [], vol_types: [] },
      logsList: []
    }
  },
  computed: {
    isSysAdmin() { return this.currentUsername === 'admin' || this.currentUserRole === 'sys_admin'; },
    isAdmin() { return this.isSysAdmin || this.currentUserRole === 'admin'; },
    currentForm() { return this.currentTab === 'inv15' ? this.form15 : this.form80; },
    currentExportConfig() { return this.currentTab === 'inv15' ? this.exportConfig15 : this.exportConfig80; },
    currentCustomColWidths() { return this.currentTab === 'inv15' ? this.customColWidths15 : this.customColWidths80; },
    currentCustomExportWidths() { return this.currentTab === 'inv15' ? this.customExportColWidths15 : this.customExportColWidths80; }
  },
  async mounted() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && !document.title.includes('(測)')) document.title = `${document.title} (測)`;
    this.setupAxiosInterceptor(() => this.currentUsername);

    if (typeof this.loadSavedCredentials === 'function') {
      this.loadSavedCredentials(this.loginForm);
    }

    await this.fetchGlobalConfig();

    const savedSessionStr = localStorage.getItem('auth_session');
    if (savedSessionStr) {
      try {
        const session = JSON.parse(savedSessionStr);
        const lastActive = session.lastActiveTimestamp || session.loginTimestamp || 0;
        const now = Date.now();

        if (session && session.isLoggedIn && (now - lastActive < 3600000)) {
          this.isLoggedIn = true;
          this.currentUsername = session.username || 'admin';
          this.currentUser = session.name || localStorage.getItem('currentUser') || this.currentUsername;
          this.currentUserRole = session.role || (this.currentUsername === 'admin' ? 'sys_admin' : 'user');
          this.currentUserPermissions = session.permissions || 'all';
          this.loginTimestamp = session.loginTimestamp || now;
          this.lastActiveTimestamp = now;

          await this.reloadCurrentUserPermissions();

          this.formatLoginTimeStr();
          this.startTimers();
          this.startHeartbeat();
          this.fetchDashboardMetrics();
          this.fetchLogs();
        } else {
          this.clearSession();
          this.timeoutMessage = '系統閒置已超過 1 小時，請重新登入！';
        }
      } catch (e) {
        this.clearSession();
      }
    }

    window.addEventListener('focus', this.reloadCurrentUserPermissions);
    window.addEventListener('inventory-updated', this.fetchDashboardMetrics);
    this.fetchUsers();
  },
  beforeUnmount() {
    this.stopHeartbeat();
    window.removeEventListener('focus', this.reloadCurrentUserPermissions);
    window.removeEventListener('inventory-updated', this.fetchDashboardMetrics);
  },
  methods: {
    updateCurrentExportConfig(newCfg) {
      if (this.currentTab === 'inv15') this.exportConfig15 = newCfg;
      else this.exportConfig80 = newCfg;
    },
    startHeartbeat() {
      this.stopHeartbeat();
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(this.sendHeartbeat, 15000);
    },
    stopHeartbeat() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    },
    async sendHeartbeat() {
      if (this.isLoggedIn && this.currentUsername) {
        try {
          await axios.post('/api/heartbeat', { username: this.currentUsername });
        } catch (e) {}
      }
    },

    async reloadCurrentUserPermissions() {
      if (!this.isLoggedIn || !this.currentUsername || this.isSysAdmin) return;
      try {
        const res = await axios.get('/api/get-users');
        if (res.data?.status === 'success' && res.data?.users) {
          const me = res.data.users.find(u => u.username === this.currentUsername);
          if (me) {
            if (me.name) this.currentUser = me.name;
            if (me.permissions !== undefined) {
              this.currentUserPermissions = me.permissions;

              this.openedTabs = this.openedTabs.filter(tab => this.hasModulePermission(tab));
              if (!this.openedTabs.includes('home')) this.openedTabs.unshift('home');

              if (!this.hasModulePermission(this.currentTab)) {
                this.currentTab = 'home';
                ElMessage.warning('⚠️ 您的帳號權限已異動，系統已自動為您切換至首頁');
              }

              localStorage.setItem('current_tab', this.currentTab);
              localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
            }
          }
        }
      } catch (e) {}
    },

    hasModulePermission(tabKey) {
      if (this.isSysAdmin || tabKey === 'home' || tabKey === 'settings_perm' || tabKey === 'settings_log') return true;
      const perms = this.currentUserPermissions;
      if (!perms || perms === 'all' || perms === 'all,') return true;
      if (Array.isArray(perms)) return perms.includes(tabKey);
      if (typeof perms === 'string') return perms.split(',').map(s => s.trim()).includes(tabKey);
      return false;
    },

    async fetchGlobalConfig() {
      try {
        const key80 = 'global_default_80';
        const key15 = 'global_default_15';

        const res80 = await axios.get(`/api/get-column-config?key=${key80}`);
        if (res80.data?.success && res80.data?.data) {
          const cfg = res80.data.data;
          if (cfg.selected_columns) this.form80.selected_columns = cfg.selected_columns;
        }

        const res15 = await axios.get(`/api/get-column-config?key=${key15}`);
        if (res15.data?.success && res15.data?.data) {
          const cfg = res15.data.data;
          if (cfg.selected_columns) this.form15.selected_columns = cfg.selected_columns;
        }

        const resExp80 = await axios.get(`/api/get-column-config?key=export_config_80`);
        if (resExp80.data?.success && resExp80.data?.data) {
          this.exportConfig80 = resExp80.data.data;
        } else {
          this.exportConfig80 = { xlsx: false, csv: false, pdf: false };
        }

        const resExp15 = await axios.get(`/api/get-column-config?key=export_config_15`);
        if (resExp15.data?.success && resExp15.data?.data) {
          this.exportConfig15 = resExp15.data.data;
        } else {
          this.exportConfig15 = { xlsx: false, csv: false, pdf: false };
        }
      } catch (e) {}
    },

    async saveExportConfig() {
      if (!this.isSysAdmin) return;
      this.savingExportConfig = true;
      try {
        const key = this.currentTab === 'inv15' ? 'export_config_15' : 'export_config_80';
        const res = await axios.post('/api/save-column-config', {
          key: key,
          config: this.currentExportConfig
        });
        if (res.data?.success) {
          ElMessage.success(`🎉 成功！${this.currentTab === 'inv15' ? '庫存15' : '庫存80'} 匯出設定已同步！`);
          this.showParamMenuDialog = false;
        }
      } catch (e) {
        ElMessage.error('儲存失敗：' + e.message);
      } finally {
        this.savingExportConfig = false;
      }
    },

    async sendCurrentLog(feature, action) {
      await this.sendLog(this.currentUsername || 'unknown', feature, action);
    },

    async fetchDashboardMetrics() {
      try {
        const res80 = await axios.get('/api/search?page=1&pageSize=1');
        if (res80.data?.success) this.dbMetrics.totalRows80 = res80.data.total || 0;

        const res15 = await axios.get('/api/inventory15/search?page=1&pageSize=1');
        if (res15.data?.success) this.dbMetrics.totalRows15 = res15.data.total || 0;

        const resConfig = await axios.get('/api/get-global-config');
        if (resConfig.data?.success && resConfig.data?.data) {
          this.dbMetrics.serverUptimeSec = resConfig.data.data.server_uptime_seconds || 0;
        }

        const resCat = await axios.get('/api/categories/large');
        if (resCat.data?.success) this.options.big_zones = resCat.data.data || [];
      } catch (e) {}
    },

    openNewTab(tabKey) {
      if (!this.hasModulePermission(tabKey)) {
        ElMessage.warning('⚠️ 您尚未取得【' + this.getTabName(tabKey) + '】模組的操作權限！');
        return;
      }
      if (!this.openedTabs.includes(tabKey)) this.openedTabs.push(tabKey);
      localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
      this.switchTab(tabKey);
    },
    switchTab(tabKey) {
      if (!this.hasModulePermission(tabKey)) return ElMessage.warning('⚠️ 您無權存取該功能模組！');
      this.currentTab = tabKey;
      localStorage.setItem('current_tab', tabKey);
      localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
      this.sendCurrentLog('選單切換', '切換至頁籤: ' + this.getTabName(tabKey));
      
      this.fetchGlobalConfig();

      if (tabKey === 'home') this.fetchDashboardMetrics();
      else if (tabKey === 'loc_summary' && this.summaryGridData.length === 0) this.handleSummaryCalc();
      else if ((tabKey === 'inv80' || tabKey === 'inv15') && !this.options.big_zones.length) this.fetchInitData();
      else if (tabKey === 'settings_perm') this.fetchUsers();
      else if (tabKey === 'settings_log') this.fetchLogs();
    },
    closeTab(tabKey) {
      const idx = this.openedTabs.indexOf(tabKey);
      if (idx >= 0) {
        this.openedTabs.splice(idx, 1);
        localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
        if (this.currentTab === tabKey && this.openedTabs.length > 0) {
          this.switchTab(this.openedTabs[this.openedTabs.length - 1]);
        }
      }
    },
    handlePageChange(page, targetModule = 'inv80') {
      if (targetModule === 'inv15') this.currentPage15 = page;
      else this.currentPage80 = page;
      this.handleSearch();
    },
    handlePageSizeChange(newSize, targetModule = 'inv80') {
      if (targetModule === 'inv15') { this.pageSize15 = newSize; this.currentPage15 = 1; }
      else { this.pageSize80 = newSize; this.currentPage80 = 1; }
      this.handleSearch();
    },

    triggerSelectInventoryFile() { 
      if (this['$refs'] && this['$refs'].inventoryFileInput) {
        this['\$refs'].inventoryFileInput.click();
      }
    },

    async handleInventoryUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.isUploading = true;
      this.uploadPercent = 5;

      if (this.currentTab === 'inv15') {
        try {
          const Papa = (await import('papaparse')).default;
          
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
              const rawData = results.data || [];
              if (rawData.length === 0) {
                this.isUploading = false;
                this.uploadPercent = 0;
                event.target.value = '';
                return ElMessage.error('CSV 檔案無有效資料！');
              }

              const BATCH_SIZE = 10000;
              const totalRows = rawData.length;
              let processed = 0;

              for (let i = 0; i < totalRows; i += BATCH_SIZE) {
                const chunk = rawData.slice(i, i + BATCH_SIZE);
                const isFirstChunk = (i === 0);

                await axios.post('/api/inventory15/upload', {
                  items: chunk,
                  isFirstChunk: isFirstChunk,
                  fileName: file.name
                });

                processed += chunk.length;
                this.uploadPercent = Math.min(99, Math.round((processed / totalRows) * 100));
              }

              this.uploadPercent = 100;
              ElMessage.success(`🎉 成功寫入 ${totalRows.toLocaleString()} 筆有效資料至 庫存15！`);
              this.showInventoryImportTipDialog = false;
              window.dispatchEvent(new CustomEvent('inventory-updated'));
              this.fetchDashboardMetrics();
              this.isUploading = false;
              this.uploadPercent = 0;
              event.target.value = '';
            },
            error: (err) => {
              this.isUploading = false;
              this.uploadPercent = 0;
              ElMessage.error('解析 CSV 失敗：' + err.message);
              event.target.value = '';
            }
          });
        } catch (e) {
          this.isUploading = false;
          this.uploadPercent = 0;
          ElMessage.error('匯入 15 庫連線失敗：' + e.message);
          event.target.value = '';
        }
      } else {
        try {
          const totalRows = await processCsvUpload(file, p => { this.uploadPercent = p; }, (f, a) => this.sendCurrentLog(f, a));
          await triggerSaveLocationHistory(file.name);

          ElMessage.success(`🎉 成功寫入 ${totalRows.toLocaleString()} 筆資料至 庫存80！`);
          this.showInventoryImportTipDialog = false;
          window.dispatchEvent(new CustomEvent('inventory-updated'));
          this.fetchDashboardMetrics();
        } catch (e) { 
          ElMessage.error('上傳 80 庫失敗：' + e.message); 
        } finally { 
          this.isUploading = false; 
          this.uploadPercent = 0;
          event.target.value = ''; 
        }
      }
    },

    formatNumber(val) {
      if (!val) return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    triggerSelectBatchFile() { 
      this.showImportTipDialog = false; 
      if (this['$refs'] && this['$refs'].batchUserFileInput) {
        this['\$refs'].batchUserFileInput.click();
      }
    },
    async handleBatchUsersUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData(); formData.append('file', file);
      try {
        const res = await axios.post('/api/batch-import-users', formData);
        if (res.data?.status === 'success') { ElMessage.success(res.data.message); this.fetchUsers(); }
      } catch (e) { ElMessage.error('批次匯入失敗：' + (e.response?.data?.detail || e.message)); }
      finally { event.target.value = ''; }
    },
    openRoleDialog(row) {
      this.targetUser = row.username;
      this.editRoleForm.target_name = row.name || row.username;
      this.editRoleForm.target_role = row.role || 'user';
      this.showEditRoleDialog = true;
    },
    onSaveRole() { this.handleUpdateRole(m => ElMessage.success(m)).catch(e => ElMessage.error(e.message)); },
    onSavePwd() { this.handleUpdatePassword(m => ElMessage.success(m)).catch(e => ElMessage.error(e.message)); },
    onSavePerm() { 
      this.handleUpdatePermissions(m => {
        ElMessage.success(m);
        this.reloadCurrentUserPermissions();
      }).catch(e => ElMessage.error(e.message)); 
    },
    onSaveAddUser() { this.handleAddUser(m => ElMessage.success(m)).catch(e => ElMessage.error(e.message)); },
    onDeleteUser(username) { this.deleteUser(username, m => ElMessage.success(m)).catch(e => ElMessage.error(e.message)); },
    async exportUsersExcel() {
      try {
        const res = await axios.get('/api/export-users-excel', { responseType: 'blob' });
        const link = document.createElement('a'); link.href = window.URL.createObjectURL(new Blob([res.data]));
        link.download = `帳號與權限清單_${new Date().getTime()}.xlsx`; link.click();
        ElMessage.success('已成功匯出帳號與權限清單！');
      } catch (e) { ElMessage.error('匯出帳號清單失敗！'); }
    },

    async saveColumnConfig() {
      if (!this.isSysAdmin) return;
      this.savingConfig = true;
      try {
        const key = this.currentTab === 'inv15' ? 'global_default_15' : 'global_default_80';
        const res = await axios.post('/api/save-column-config', {
          key: key,
          config: {
            all_columns: this.allAvailableColumns,
            selected_columns: this.currentForm.selected_columns
          }
        });
        if (res.data?.success) {
          ElMessage.success(`🎉 ${this.currentTab === 'inv15' ? '庫存15' : '庫存80'} 欄位順序已儲存！`); 
          this.showColSettingDialog = false;
        }
      } catch (e) { 
        ElMessage.error('儲存失敗：' + e.message); 
      } finally { 
        this.savingConfig = false; 
      }
    },

    async openSearchModal() { this.showSearchModal = true; await this.fetchInitData(); },
    toggleColumnSelection(colName) {
      const idx = this.currentForm.selected_columns.indexOf(colName);
      if (idx >= 0) this.currentForm.selected_columns.splice(idx, 1);
      else this.currentForm.selected_columns.push(colName);
    },
    onDragStart(e, idx) { this.draggedIndex = idx; },
    onDragOver(e, idx) {
      if (this.draggedIndex === null || this.draggedIndex === idx) return;
      const item = this.allAvailableColumns.splice(this.draggedIndex, 1)[0];
      this.allAvailableColumns.splice(idx, 0, item);
      this.draggedIndex = idx;
    },
    onDrop() { this.draggedIndex = null; },
    onDragEnd() { this.draggedIndex = null; },
    selectAllCols() { this.currentForm.selected_columns = [...this.rawColumnsMaster]; },
    unselectAllCols() { this.currentForm.selected_columns = []; },
    openPwdDialog(row) { this.targetUser = row.username; this.editPasswordForm.new_password = ''; this.showEditPwdDialog = true; },
    openPermDialog(row) {
      this.targetUser = row.username;
      if (Array.isArray(row.permissions)) {
        this.editPermForm.selected_modules = [...row.permissions];
      } else if (typeof row.permissions === 'string' && row.permissions.trim() !== '') {
        if (row.permissions === 'all' || row.permissions === 'all,') {
          this.editPermForm.selected_modules = this.availableModules.map(m => m.key);
        } else {
          this.editPermForm.selected_modules = row.permissions.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else {
        this.editPermForm.selected_modules = this.availableModules.map(m => m.key);
      }
      this.showEditPermDialog = true;
    },
    async fetchLogs() { try { const res = await axios.get('/api/get-logs'); if (res.data?.logs) this.logsList = res.data.logs; } catch (e) {} },
    
    async handleLogin() {
      if (!this.loginForm.username || !this.loginForm.password) return ElMessage.warning('請輸入帳密！');
      this.loginLoading = true;
      try {
        const res = await axios.post('/api/login', { username: this.loginForm.username, password: this.loginForm.password, device: this.getDeviceType() });
        if (res.data?.status === 'success' || res.data?.success) {
          const userData = res.data.user || res.data.data || {};
          this.isLoggedIn = true; 
          this.currentUsername = res.data.username || userData.username || this.loginForm.username; 
          this.currentUser = res.data.name || userData.name || this.currentUsername;
          this.currentUserRole = res.data.role || userData.role || (this.currentUsername === 'admin' ? 'sys_admin' : 'user');
          this.currentUserPermissions = res.data.permissions || userData.permissions || 'all';
          this.loginTimestamp = Date.now();
          this.timeoutMessage = '';

          if (typeof this.saveOrClearCredentials === 'function') this.saveOrClearCredentials(this.loginForm);
          if (typeof this.saveSession === 'function') this.saveSession(this.currentUsername, this.currentUser, this.currentUserRole, this.currentUserPermissions);

          this.currentTab = 'home'; 
          this.openedTabs = ['home'];
          localStorage.setItem('current_tab', 'home');
          localStorage.setItem('opened_tabs', JSON.stringify(['home']));

          this.formatLoginTimeStr();
          this.startTimers();
          this.startHeartbeat();
          this.fetchGlobalConfig();
          this.fetchDashboardMetrics(); 
          this.fetchLogs(); 
          ElMessage.success('歡迎回來，' + this.currentUser + '！');
        } else { 
          ElMessage.error(res.data?.detail || res.data?.message || '登入失敗'); 
        }
      } catch (e) {
        this.isLoggedIn = false;
        ElMessage.error('⚠ 伺服器未連線，請確認地端桌機 start_tunnel.bat 是否已啟動！');
      } finally { 
        this.loginLoading = false; 
      }
    },

    async handleLogout() {
      try { if (this.currentUsername) await axios.post('/api/logout', { username: this.currentUsername }); } catch (e) {}
      this.stopHeartbeat();
      if (typeof this.clearSession === 'function') this.clearSession();
      this.stopTimers();
      this.isLoggedIn = false; 
      this.currentUser = ''; 
      this.currentUsername = ''; 
      this.currentUserRole = 'user';
      this.currentUserPermissions = [];
      this.openedTabs = [];
      ElMessage.info('已成功登出');
    },
    getTabName(k) {
      const names = {
        'home': '🏠 系統首頁',
        'inv80': '🔍 庫存查詢80',
        'inv15': '📦 庫存查詢15',
        'loc_summary': '📊 儲位數才數統整',
        'turnover': '📈 迴轉率清單',
        'abnormal_purchase': '⚠️ 不合理進貨清單',
        'inbound_fish': '🐟 進貨上架魚群',
        'replenish_fish': '🐟 立即補貨單魚群',
        'transfer_80_15': '🔄 跨庫調撥 80 ➔ 15',
        'transfer_15_80': '🔄 跨庫調撥 15 ➔ 80',
        'settings_perm': '⚙️ 權限管理',
        'settings_log': '📜 日誌歷程查詢'
      };
      return names[k] || '系統模組';
    },
    async fetchInitData() { try { const res = await axios.get('/api/categories/large'); if (res.data?.success) this.options.big_zones = res.data.data; } catch (e) {} },
    async onBigZoneChange(val) {
      this.currentForm.cbo_zone = ''; this.options.zones = []; if (!val) return;
      try { const res = await axios.get('/api/categories/small?large=' + encodeURIComponent(val)); if (res.data?.success) this.options.zones = res.data.data; } catch (e) {}
    },

    async handleSearch() {
      this.loading = true;
      this.searchElapsedSec = 0;
      if (this.searchTimer) clearInterval(this.searchTimer);
      this.searchTimer = setInterval(() => {
        this.searchElapsedSec = (parseFloat(this.searchElapsedSec) + 0.1).toFixed(1);
      }, 100);

      try {
        const formObj = this.currentForm;
        let currentCols = Array.isArray(formObj.selected_columns) && formObj.selected_columns.length > 0 
          ? [...formObj.selected_columns] 
          : [...this.rawColumnsMaster];

        const masterSet = new Set(this.rawColumnsMaster);
        const filteredCols = currentCols.filter(c => masterSet.has(c));

        const hasLocationCol = filteredCols.includes('儲位');
        const mode = formObj.search_mode || 'normal';
        let batchTxt = mode === 'batch_id' ? (formObj.batch_ids || '') : (mode === 'batch_zone' ? (formObj.batch_zones || '') : '');

        const curPage = this.currentTab === 'inv15' ? this.currentPage15 : this.currentPage80;
        const curPageSize = this.currentTab === 'inv15' ? this.pageSize15 : this.pageSize80;

        const params = new URLSearchParams({
          page: curPage,
          pageSize: curPageSize,
          searchMode: mode,
          batchIds: batchTxt,
          categoryLarge: formObj.cbo_big_zone || '',
          categorySmall: formObj.cbo_zone || '',
          keyword: formObj.txt_id || formObj.txt_name || '',
          txtAge: formObj.txt_age || '',
          aggregate: hasLocationCol ? 'false' : 'true'
        });

        const searchApiUrl = this.currentTab === 'inv15' ? `/api/inventory15/search?${params.toString()}` : `/api/search?${params.toString()}`;

        const res = await axios.get(searchApiUrl);
        if (res.data?.success) {
          const totalCount = res.data.total || 0;
          const rawData = res.data.data || [];
          const formattedRows = rawData.map(row => {
            const getAnyVal = (...keys) => {
              for (const k of keys) {
                if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') return row[k];
              }
              return '-';
            };

            return {
              ...row,
              '商品ID': getAnyVal('商品ID', 'item_id'),
              '商品名稱': getAnyVal('商品名稱', 'item_name'),
              '借/採': getAnyVal('借/採', 'borrow_proc', 'borrow_type', 'proc_type', 'borrowProc', 'bp'),
              '儲位': getAnyVal('儲位', 'location', 'loc'),
              '儲位庫存數': getAnyVal('儲位庫存數', 'qty', 'loc_qty'),
              '庫齡': getAnyVal('庫齡', 'age'),
              '區編': getAnyVal('區編', 'zone_id'),
              '區名': getAnyVal('區名', 'zone_name'),
              '館編': getAnyVal('館編', 'hall_id'),
              '館名': getAnyVal('館名', 'hall_name'),
              '長(cm)': getAnyVal('長(cm)', 'length'),
              '寬(cm)': getAnyVal('寬(cm)', 'width'),
              '高(cm)': getAnyVal('高(cm)', 'height'),
              '重量(kg)': getAnyVal('重量(kg)', 'weight'),
              '(近)月銷量': getAnyVal('(近)月銷量', 'monthly_sales'),
              '(近)90日銷量': getAnyVal('(近)90日銷量', 'sales_90d'),
              '供應商名稱': getAnyVal('供應商名稱', 'supplier_name'),
              '總庫存數': getAnyVal('總庫存數', 'total_qty'),
              '才數': getAnyVal('才數', 'cubic_feet', '單才數'),
              '材積別': getAnyVal('材積別', 'vol_type'),
              '樓層': getAnyVal('樓層', 'floor'),
              '儲位型態': getAnyVal('儲位型態', 'loc_type'),
              '大區名': getAnyVal('大區名', 'big_zone', '大區'),
              '人工/自動': getAnyVal('人工/自動', 'auto_type')
            };
          });

          const timeStr = new Date().toLocaleString() + ' (耗時 ' + this.searchElapsedSec + ' 秒)';

          if (this.currentTab === 'inv15') {
            this.tableData15 = formattedRows;
            this.columns15 = filteredCols;
            this.totalRowsCount15 = totalCount;
            this.summary15 = res.data.summary || {};
            this.searchTime15 = timeStr;
            this.hasSearched15 = true;
          } else {
            this.tableData80 = formattedRows;
            this.columns80 = filteredCols;
            this.totalRowsCount80 = totalCount;
            this.summary80 = res.data.summary || {};
            this.searchTime80 = timeStr;
            this.hasSearched80 = true;
          }

          this.showSearchModal = false;
        }
      } catch (e) {
        ElMessage.error('搜尋失敗：' + e.message);
      } finally {
        if (this.searchTimer) clearInterval(this.searchTimer);
        this.loading = false;
      }
    },

    async exportData(fmt) {
      const is15 = this.currentTab === 'inv15';
      const hasSearched = is15 ? this.hasSearched15 : this.hasSearched80;
      if (!hasSearched) return ElMessage.warning('請先執行檢索再進行匯出！');

      const loadingMsg = ElMessage.info({ message: `⚡ 打包全量庫存資料中...`, duration: 0 });
      try {
        const formObj = this.currentForm;
        const curCols = is15 ? this.columns15 : this.columns80;
        const mode = formObj.search_mode || 'normal';
        let batchTxt = mode === 'batch_id' ? (formObj.batch_ids || '') : (mode === 'batch_zone' ? (formObj.batch_zones || '') : '');

        const params = new URLSearchParams({
          searchMode: mode, batchIds: batchTxt, categoryLarge: formObj.cbo_big_zone || '',
          categorySmall: formObj.cbo_zone || '', keyword: formObj.txt_id || formObj.txt_name || '',
          txtAge: formObj.txt_age || '', aggregate: curCols.includes('儲位') ? 'false' : 'true', exportAll: 'true'
        });

        const searchApiUrl = is15 ? `/api/inventory15/search?${params.toString()}` : `/api/search?${params.toString()}`;
        const res = await axios.get(searchApiUrl);
        loadingMsg.close();

        if (res.data?.success && res.data.data) {
          const rawList = res.data.data;
          processExportData({
            fmt, tableData: rawList, exportCols: curCols, moduleName: this.getTabName(this.currentTab),
            summary: is15 ? this.summary15 : this.summary80, searchTime: is15 ? this.searchTime15 : this.searchTime80, sendLogCallback: (f, a) => this.sendCurrentLog(f, a), formatNumber: this.formatNumber
          });
          ElMessage.success(`🎉 成功匯出 ${rawList.length.toLocaleString()} 筆資料！`);
        }
      } catch (e) { loadingMsg.close(); ElMessage.error('匯出失敗：' + e.message); }
    }
  }
}
</script>

<style>
html, body { margin: 0 !important; padding: 0 !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important; background-color: #0f172a !important; }
.el-table .el-scrollbar__bar { display: block !important; opacity: 0.85 !important; z-index: 99 !important; }
.el-table .el-scrollbar__bar.is-horizontal { height: 8px !important; bottom: 2px !important; background-color: rgba(15, 23, 42, 0.6) !important; border-radius: 4px !important; }
.el-table .el-scrollbar__bar.is-horizontal .el-scrollbar__thumb { background-color: #38bdf8 !important; border-radius: 4px !important; }
.el-table .el-scrollbar__bar.is-vertical { width: 8px !important; right: 2px !important; background-color: rgba(15, 23, 42, 0.6) !important; border-radius: 4px !important; }
.el-table .el-scrollbar__bar.is-vertical .el-scrollbar__thumb { background-color: #38bdf8 !important; border-radius: 4px !important; }
</style>

<style scoped>
.app-container.dark-mode { display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden !important; background-color: #0f172a; color: #f8fafc; }
.text-white { color: #ffffff !important; }
.text-gray { color: #94a3b8 !important; }
.views-wrapper { flex: 1; height: calc(100vh - 52px); overflow: hidden; }
:deep(.el-table) { background-color: #1e293b !important; color: #f8fafc !important; width: 100% !important; }
:deep(.el-drawer), :deep(.el-dialog) { background-color: #1e293b !important; color: #f8fafc !important; border: 1px solid #334155 !important; }
:deep(.el-drawer__header), :deep(.el-dialog__header) { background-color: #0f172a !important; color: #ffffff !important; padding: 15px 20px !important; border-bottom: 1px solid #334155 !important; }
:deep(.el-drawer__title), :deep(.el-dialog__title) { color: #38bdf8 !important; font-weight: bold; }
:deep(.el-table tr), :deep(.el-table th.el-table__cell) { background-color: #1e293b !important; color: #38bdf8 !important; }
:deep(.el-table td.el-table__cell) { background-color: #0f172a !important; color: #f8fafc !important; border-bottom: 1px solid #334155 !important; }
</style>