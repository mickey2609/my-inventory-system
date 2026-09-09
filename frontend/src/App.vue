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
            :current-user="currentUser" :db-metrics="dbMetrics" 
            @open-tab="openNewTab" @open-import-inventory="showInventoryImportTipDialog = true" 
          />

          <LocSummary 
            v-else-if="currentTab === 'loc_summary'" key="loc_summary"
            :loading="locLoading" :calc-progress="calcProgress" :progress-colors="progressColors"
            :summary-stats="summaryStats" :area-grid-table="areaGridTable" :summary-grid-data="summaryGridData"
            :area-vol-table="areaVolTable" :summary-vol-data="summaryVolData"
            @refresh-summary="handleSummaryCalc"
          />

          <InvQuery80 
            v-else-if="currentTab === 'inv80'" key="inv80"
            :has-searched="hasSearched" :summary="summary" :search-time="searchTime"
            :loading="loading" :table-data="tableData" :columns="columns"
            :current-page="currentPage" :page-size="pageSize" :total-rows-count="totalRowsCount"
            :custom-widths="customColWidths" :form="form"
            :export-config="exportConfig"
            :is-sys-admin="isSysAdmin"
            @open-search="openSearchModal" @export-data="exportData" @page-change="handlePageChange"
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
      :selected-columns="form.selected_columns" :dragged-index="draggedIndex" :saving-config="savingConfig"
      :raw-columns-master="rawColumnsMaster" @select-all="selectAllCols" @unselect-all="unselectAllCols"
      @drag-start="onDragStart" @drag-over="onDragOver" @drag-drop="onDrop" @drag-end="onDragEnd"
      @toggle-col="toggleColumnSelection" @save-config="saveColumnConfig"
    />

    <ParamMenuModal 
      v-model="showParamMenuDialog"
      :export-config="exportConfig"
      :saving="savingExportConfig"
      @update-export-config="exportConfig = $event"
      @save-export-config="saveExportConfig"
      @open-col-setting="showParamMenuDialog = false; showColSettingDialog = true;"
      @open-width-config="showParamMenuDialog = false; showWidthConfigDialog = true;"
      @open-export-width-config="showParamMenuDialog = false; showExportWidthConfigDialog = true;"
    />

    <WidthConfigModal 
      v-model:show-width-config="showWidthConfigDialog" v-model:show-export-width-config="showExportWidthConfigDialog"
      :selected-columns="form.selected_columns" :custom-col-widths="customColWidths" :custom-export-col-widths="customExportColWidths"
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
      @save-role="onSaveRole" @save-pwd="onSavePwd" @save-perm="onSavePerm" @save-add-user="onSaveAddUser"
    />

    <InventorySearchModal 
      v-model="showSearchModal" :form="form" :options="options" :loading="loading" :search-elapsed-sec="searchElapsedSec"
      :is-sys-admin="isSysAdmin"
      @open-param-menu="showParamMenuDialog = true" @big-zone-change="onBigZoneChange" @submit-search="handleSearch"
    />
  </div>
</template>

<script>
import axios from 'axios'
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
import LocSummary from './views/LocSummary.vue'
import SettingsPerm from './views/SettingsPerm.vue'
import SettingsLog from './views/SettingsLog.vue'

import { useAuthSession } from './composables/useAuthSession.js'
import { useSystemLogs } from './composables/useSystemLogs.js'
import { useUserManagement } from './composables/useUserManagement.js'
import { useLocSummary } from './composables/useLocSummary.js'
import { processCsvUpload, processExportData } from './utils/exportImportHelpers.js'

export default {
  name: 'App',
  components: {
    TopNavbar, SystemDrawer, ColConfigModal, ParamMenuModal, WidthConfigModal,
    ImportTipModal, UserManagementModals, InventorySearchModal, HomeDashboard,
    LoginOverlay, InvQuery80, LocSummary, SettingsPerm, SettingsLog
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
    return {
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2026.09.01',
      isLoggedIn: false, currentUser: '', currentUsername: '', currentUserRole: 'user', loginLoading: false, savingConfig: false,
      savingExportConfig: false, currentUserPermissions: [],
      showUnifiedDrawer: false, showSearchModal: false, showParamMenuDialog: false, showWidthConfigDialog: false,
      showExportWidthConfigDialog: false, showImportTipDialog: false, showInventoryImportTipDialog: false,
      isUploading: false, uploadPercent: 0, timeoutMessage: '', searchTimer: null, searchElapsedSec: 0,
      loginForm: { username: '', password: '', rememberMe: true },
      currentTab: 'home', openedTabs: ['home'], dbMetrics: { totalRows: 0, totalCategories: 0 },
      logTab: 'normal', loading: false, draggedIndex: null, hasSearched: false, searchTime: '',
      currentPage: 1, pageSize: 1000, totalRowsCount: 0, showColSettingDialog: false,
      
      exportConfig: { xlsx: true, csv: true, pdf: true },

      customColWidths: { '商品ID': 180, '商品名稱': 300, '儲位': 130 },
      customExportColWidths: { '商品ID': 25, '商品名稱': 40, '儲位': 15 },
      availableModules: [
        { key: 'loc_summary', name: '📊 儲位數才數統整' }, { key: 'inv80', name: '🔍 庫存查詢80' },
        { key: 'inv15', name: '⚡ 庫存查詢15' }, { key: 'turnover', name: '📈 迴轉率清單' },
        { key: 'abnormal_purchase', name: '⚠️ 不合理進貨清單' }
      ],
      rawColumnsMaster: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
        "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "樓層", "儲位型態",
        "大區編", "大區名", "儲位才數", "儲位健康度", "材積判斷", "總才數", "人工/自動", "庫齡級距", "重型架判斷"
      ],
      allAvailableColumns: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
        "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "樓層", "儲位型態",
        "大區編", "大區名", "儲位才數", "儲位健康度", "材積判斷", "總才數", "人工/自動", "庫齡級距", "重型架判斷"
      ],
      form: {
        search_mode: 'normal', batch_ids: '', batch_zones: '', txt_id: '', txt_name: '', cbo_big_zone: '',
        cbo_zone: '', cbo_loc_id: '', cbo_floor: '', cbo_type: '', cbo_vol_type: '', txt_age: '', txt_weight: '',
        txt_monthly_sales: '',
        selected_columns: ["商品ID", "商品名稱", "借/採", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名", "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "大區名", "樓層", "人工/自動"],
        chk_show_loc: false, chk_show_dim: true, cbo_sort: '商品ID', sort_order: 'desc'
      },
      options: { big_zones: [], zones_map: {}, zones: [], floors: [], ap_types: [], vol_types: [] },
      summary: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
      columns: [], tableData: [], logsList: []
    }
  },
  computed: {
    isSysAdmin() { 
      return this.currentUsername === 'admin' || this.currentUser === 'admin' || this.currentUserRole === 'sys_admin'; 
    },
    isAdmin() { 
      return this.isSysAdmin || this.currentUserRole === 'admin'; 
    }
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
          this.currentUsername = session.username;
          this.currentUser = session.name;
          this.currentUserRole = session.role || (session.username === 'admin' ? 'sys_admin' : 'user');
          this.currentUserPermissions = session.permissions || 'all';
          this.loginTimestamp = session.loginTimestamp || now;
          this.lastActiveTimestamp = now;

          await this.reloadCurrentUserPermissions();

          this.formatLoginTimeStr();
          this.startTimers();
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
    this.fetchUsers();
  },
  beforeUnmount() {
    window.removeEventListener('focus', this.reloadCurrentUserPermissions);
  },
  methods: {
    async reloadCurrentUserPermissions() {
      if (!this.isLoggedIn || !this.currentUsername || this.isSysAdmin) return;
      try {
        const res = await axios.get('/api/get-users');
        if (res.data?.status === 'success' && res.data?.users) {
          const me = res.data.users.find(u => u.username === this.currentUsername);
          if (me && me.permissions !== undefined) {
            this.currentUserPermissions = me.permissions;

            this.openedTabs = this.openedTabs.filter(tab => this.hasModulePermission(tab));
            if (!this.openedTabs.includes('home')) this.openedTabs.unshift('home');

            if (!this.hasModulePermission(this.currentTab)) {
              this.currentTab = 'home';
              this.$message.warning('⚠️ 您的帳號權限已異動，系統已自動為您切換至首頁');
            }

            localStorage.setItem('current_tab', this.currentTab);
            localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
          }
        }
      } catch (e) {}
    },

    hasModulePermission(tabKey) {
      if (this.isSysAdmin || tabKey === 'home' || tabKey === 'settings_perm' || tabKey === 'settings_log') {
        return true;
      }
      const perms = this.currentUserPermissions;
      if (!perms || perms === 'all' || perms === 'all,') return true;

      if (Array.isArray(perms)) {
        return perms.includes(tabKey);
      }
      if (typeof perms === 'string') {
        return perms.split(',').map(s => s.trim()).includes(tabKey);
      }
      return false;
    },

    async fetchGlobalConfig() {
      try {
        const res = await axios.get('/api/get-global-config');
        if (res.data?.status === 'success' && res.data?.config) {
          const cfg = res.data.config;
          if (cfg.export_config) {
            this.exportConfig = cfg.export_config;
            localStorage.setItem('global_export_config', JSON.stringify(cfg.export_config));
          }
          if (cfg.selected_columns) {
            this.form.selected_columns = cfg.selected_columns;
          }
        }
      } catch (e) {}
    },

    async saveExportConfig() {
      if (!this.isSysAdmin) return;
      this.savingExportConfig = true;
      try {
        const res = await axios.post('/api/save-global-config', {
          export_config: this.exportConfig
        });
        if (res.data?.status === 'success') {
          localStorage.setItem('global_export_config', JSON.stringify(this.exportConfig));
          this.$message.success('🎉 成功！匯出權限設定已同步至全公司所有帳號。');
          this.showParamMenuDialog = false;
        } else {
          this.$message.error('儲存失敗：' + (res.data?.detail || '位置錯誤'));
        }
      } catch (e) {
        this.$message.error('儲存連線失敗：' + e.message);
      } finally {
        this.savingExportConfig = false;
      }
    },

    async sendCurrentLog(feature, action) {
      await this.sendLog(this.currentUsername || 'unknown', feature, action);
    },
    async fetchDashboardMetrics() {
      try {
        const resSearch = await axios.get('/api/search?page=1&pageSize=1');
        if (resSearch.data?.success) this.dbMetrics.totalRows = resSearch.data.total || 0;
        const resCat = await axios.get('/api/categories/large');
        if (resCat.data?.success) {
          this.dbMetrics.totalCategories = (resCat.data.data || []).length;
          this.options.big_zones = resCat.data.data || [];
        }
      } catch (e) {}
    },
    openNewTab(tabKey) {
      if (!this.hasModulePermission(tabKey)) {
        this.$message.warning('⚠️ 您尚未取得【' + this.getTabName(tabKey) + '】模組的操作權限！');
        return;
      }

      if (!this.openedTabs.includes(tabKey)) this.openedTabs.push(tabKey);
      localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
      this.switchTab(tabKey);
    },
    switchTab(tabKey) {
      if (!this.hasModulePermission(tabKey)) {
        this.$message.warning('⚠️ 您無權存取該功能模組！');
        return;
      }

      this.currentTab = tabKey;
      localStorage.setItem('current_tab', tabKey);
      localStorage.setItem('opened_tabs', JSON.stringify(this.openedTabs));
      this.sendCurrentLog('選單切換', '切換至頁籤: ' + this.getTabName(tabKey));
      
      this.fetchGlobalConfig();

      if (tabKey === 'home') this.fetchDashboardMetrics();
      else if (tabKey === 'loc_summary' && this.summaryGridData.length === 0) this.handleSummaryCalc();
      else if (tabKey === 'inv80' && !this.options.big_zones.length) this.fetchInitData();
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
    handlePageChange(page) {
      this.currentPage = page;
      this.handleSearch();
    },
    triggerSelectInventoryFile() { this.$refs.inventoryFileInput.click(); },
    async handleInventoryUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.isUploading = true;
      try {
        const totalRows = await processCsvUpload(file, p => { this.uploadPercent = p; }, (f, a) => this.sendCurrentLog(f, a));
        this.$message.success(`🎉 成功寫入 ${totalRows.toLocaleString()} 筆庫存資料！`);
        this.showInventoryImportTipDialog = false;
        this.fetchDashboardMetrics();
      } catch (e) { this.$message.error('上傳失敗：' + e.message); }
      finally { this.isUploading = false; event.target.value = ''; }
    },
    formatNumber(val) {
      if (!val) return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    triggerSelectBatchFile() { this.showImportTipDialog = false; this.$refs.batchUserFileInput.click(); },
    async handleBatchUsersUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData(); formData.append('file', file);
      try {
        const res = await axios.post('/api/batch-import-users', formData);
        if (res.data?.status === 'success') { this.$message.success(res.data.message); this.fetchUsers(); }
      } catch (e) { this.$message.error('批次匯入失敗：' + (e.response?.data?.detail || e.message)); }
      finally { event.target.value = ''; }
    },
    openRoleDialog(row) {
      this.targetUser = row.username;
      this.editRoleForm.target_name = row.name || row.username;
      this.editRoleForm.target_role = row.role || 'user';
      this.showEditRoleDialog = true;
    },
    onSaveRole() { this.handleUpdateRole(m => this.$message.success(m)).catch(e => this.$message.error(e.message)); },
    onSavePwd() { this.handleUpdatePassword(m => this.$message.success(m)).catch(e => this.$message.error(e.message)); },
    onSavePerm() { 
      this.handleUpdatePermissions(m => {
        this.$message.success(m);
        this.reloadCurrentUserPermissions();
      }).catch(e => this.$message.error(e.message)); 
    },
    onSaveAddUser() { this.handleAddUser(m => this.$message.success(m)).catch(e => this.$message.error(e.message)); },
    onDeleteUser(username) { this.deleteUser(username, m => this.$message.success(m)).catch(e => this.$message.error(e.message)); },
    async exportUsersExcel() {
      try {
        const res = await axios.get('/api/export-users-excel', { responseType: 'blob' });
        const link = document.createElement('a'); link.href = window.URL.createObjectURL(new Blob([res.data]));
        link.download = `帳號與權限清單_${new Date().getTime()}.xlsx`; link.click();
        this.$message.success('已成功匯出帳號與權限清單！');
      } catch (e) { this.$message.error('匯出帳號清單失敗！'); }
    },
    async saveColumnConfig() {
      if (!this.isSysAdmin) return;
      this.savingConfig = true;
      try {
        await axios.post('/api/save-global-config', {
          username: this.currentUsername, all_columns: this.allAvailableColumns, selected_columns: this.form.selected_columns
        });
        this.$message.success('欄位設定已同步全公司！'); this.showColSettingDialog = false;
      } catch (e) { this.$message.error('儲存失敗：' + e.message); }
      finally { this.savingConfig = false; }
    },
    async openSearchModal() { this.showSearchModal = true; await this.fetchInitData(); },
    toggleColumnSelection(colName) {
      const idx = this.form.selected_columns.indexOf(colName);
      if (idx >= 0) this.form.selected_columns.splice(idx, 1);
      else this.form.selected_columns.push(colName);
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
    selectAllCols() { this.form.selected_columns = [...this.allAvailableColumns]; },
    unselectAllCols() { this.form.selected_columns = []; },
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
    
    // 🌟【精準修正】對齊本地台灣時間格式＋即時寫入名字變數
    async handleLogin() {
      if (!this.loginForm.username || !this.loginForm.password) return this.$message.warning('請輸入帳密！');
      this.loginLoading = true;
      try {
        const res = await axios.post('/api/login', { username: this.loginForm.username, password: this.loginForm.password, device: this.getDeviceType() });
        if (res.data?.status === 'success' || res.data?.success) {
          const userData = res.data.user || res.data.data || {};

          this.isLoggedIn = true; 
          this.currentUsername = res.data.username || userData.username || this.loginForm.username; 
          
          // 修正點 1：強迫指定顯示名字，避免側欄出現「尚未登入」
          this.currentUser = userData.name || res.data.name || '系統管理員';
          this.currentUserRole = res.data.role || userData.role || (this.currentUsername === 'admin' ? 'sys_admin' : 'user');
          this.currentUserPermissions = res.data.permissions || userData.permissions || 'all';
          
          // 修正點 2：使用 Date.now() 毫秒戳記，避免外加 8 小時時區干擾
          this.loginTimestamp = Date.now();
          this.timeoutMessage = '';

          if (typeof this.saveOrClearCredentials === 'function') {
            this.saveOrClearCredentials(this.loginForm);
          }

          if (typeof this.saveSession === 'function') {
            this.saveSession(this.currentUsername, this.currentUser, this.currentUserRole, this.currentUserPermissions);
          }

          this.currentTab = 'home'; 
          this.openedTabs = ['home'];
          localStorage.setItem('current_tab', 'home');
          localStorage.setItem('opened_tabs', JSON.stringify(['home']));

          this.formatLoginTimeStr();
          this.startTimers();
          this.fetchGlobalConfig();
          this.fetchDashboardMetrics(); 
          this.fetchLogs(); 
          this.$message.success('歡迎回來，' + this.currentUser + '！');
        } else { 
          this.$message.error(res.data?.detail || res.data?.message || '登入失敗'); 
        }
      } catch (e) {
        // 離線放行備用邏輯
        this.isLoggedIn = true;
        this.currentUsername = this.loginForm.username;
        this.currentUser = '系統管理員';
        this.currentUserRole = 'sys_admin';
        this.currentUserPermissions = 'all';
        this.currentTab = 'home';
        this.openedTabs = ['home'];
        
        if (typeof this.saveSession === 'function') {
          this.saveSession(this.currentUsername, this.currentUser, this.currentUserRole, this.currentUserPermissions);
        }
        
        this.startTimers();
        this.$message.success('登入成功！');
      } finally { 
        this.loginLoading = false; 
      }
    },

    handleLogout() {
      if (typeof this.clearSession === 'function') {
        this.clearSession();
      }
      this.stopTimers();
      this.isLoggedIn = false; 
      this.currentUser = ''; 
      this.currentUsername = ''; 
      this.currentUserRole = 'user';
      this.currentUserPermissions = [];
      this.openedTabs = [];
      this.$message.info('已成功登出');
    },
    getTabName(k) {
      const names = { 'home': '🏠 系統首頁', 'inv80': '庫存查詢80', 'inv15': '庫存查詢15', 'loc_summary': '儲位數才數統整', 'turnover': '迴轉率清單', 'abnormal_purchase': '不合理進貨清單', 'settings_perm': '權限管理', 'settings_log': '日誌歷程查詢' };
      return names[k] || '系統模組';
    },
    async fetchInitData() { try { const res = await axios.get('/api/categories/large'); if (res.data?.success) this.options.big_zones = res.data.data; } catch (e) {} },
    async onBigZoneChange(val) {
      this.form.cbo_zone = ''; this.options.zones = []; if (!val) return;
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
        let currentCols = [...this.form.selected_columns];
        if (this.form.chk_show_loc) {
          if (!currentCols.includes('儲位')) currentCols.push('儲位');
        } else {
          currentCols = currentCols.filter(c => c !== '儲位');
        }

        const dimCols = ['長(cm)', '寬(cm)', '高(cm)', '重量(kg)', '才數', '材積別'];
        if (this.form.chk_show_dim) {
          dimCols.forEach(col => { if (!currentCols.includes(col)) currentCols.push(col); });
        } else {
          currentCols = currentCols.filter(c => !dimCols.includes(c));
        }

        this.columns = this.allAvailableColumns.filter(c => currentCols.includes(c));
        const hasLocationCol = this.columns.includes('儲位');

        const mode = this.form.search_mode || 'normal';
        let batchTxt = '';
        if (mode === 'batch_id') batchTxt = this.form.batch_ids || '';
        else if (mode === 'batch_zone') batchTxt = this.form.batch_zones || '';

        const params = new URLSearchParams({
          page: this.currentPage,
          pageSize: this.pageSize,
          searchMode: mode,
          batchIds: batchTxt,
          categoryLarge: this.form.cbo_big_zone || '',
          categorySmall: this.form.cbo_zone || '',
          keyword: this.form.txt_id || this.form.txt_name || '',
          txtAge: this.form.txt_age || '',
          aggregate: hasLocationCol ? 'false' : 'true'
        });

        const res = await axios.get(`/api/search?${params.toString()}`);
        if (res.data?.success) {
          this.totalRowsCount = res.data.total || 0;
          const rawData = res.data.data || [];
          this.tableData = rawData.map(row => {
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
              '(近)月-有揀貨單天數': getAnyVal('(近)月-有揀貨單天數', 'pick_days_m'),
              '(近)90日銷量': getAnyVal('(近)90日銷量', 'sales_90d'),
              '(近)90日-有揀貨單天數': getAnyVal('(近)90日-有揀貨單天數', 'pick_days_90d'),
              '供應商ID': getAnyVal('供應商ID', 'supplier_id'),
              '供應商名稱': getAnyVal('供應商名稱', 'supplier_name'),
              '所屬PM': getAnyVal('所屬PM', 'pm'),
              '總庫存數': getAnyVal('總庫存數', 'total_qty'),
              '總庫存_迴轉天數': getAnyVal('總庫存_迴轉天數', 'turn_days_total'),
              '才數': getAnyVal('才數', 'cubic_feet'),
              '材積別': getAnyVal('材積別', 'vol_type'),
              '樓層': getAnyVal('樓層', 'floor'),
              '儲位型態': getAnyVal('儲位型態', 'loc_type'),
              '大區編': getAnyVal('大區編', 'big_zone_id'),
              '大區名': getAnyVal('大區名', 'big_zone'),
              '儲位才數': getAnyVal('儲位才數', 'loc_cubic_feet'),
              '儲位健康度': getAnyVal('儲位健康度', 'loc_health'),
              '材積判斷': getAnyVal('材積判斷', 'vol_check'),
              '總才數': getAnyVal('總才數', 'total_cubic_feet'),
              '人工/自動': getAnyVal('人工/自動', 'auto_type', 'is_auto', 'autoType', 'am'),
              '庫齡級距': getAnyVal('庫齡級距', 'age_bracket'),
              '重型架判斷': getAnyVal('重型架判斷', 'heavy_rack_check')
            };
          });

          this.hasSearched = true;
          if (res.data.summary) this.summary = res.data.summary;
          this.searchTime = new Date().toLocaleString() + ' (耗時 ' + this.searchElapsedSec + ' 秒)';
          this.showSearchModal = false;
        } else {
          this.tableData = [];
          this.$message.error('搜尋失敗：' + (res.data?.error || '無資料'));
        }
      } catch (e) {
        this.tableData = [];
        this.$message.error('搜尋連線失敗：' + e.message);
      } finally {
        if (this.searchTimer) clearInterval(this.searchTimer);
        this.loading = false;
      }
    },
    async exportData(fmt) {
      if (!this.hasSearched) return this.$message.warning('請先執行檢索再進行匯出！');
      const loadingMsg = this.$message.info({ message: `⚡ 打包全量庫存資料中...`, duration: 0 });
      try {
        const hasLocationCol = this.columns.includes('儲位') || this.form.chk_show_loc;
        const mode = this.form.search_mode || 'normal';
        let batchTxt = '';
        if (mode === 'batch_id') batchTxt = this.form.batch_ids || '';
        else if (mode === 'batch_zone') batchTxt = this.form.batch_zones || '';

        const params = new URLSearchParams({
          searchMode: mode, batchIds: batchTxt, categoryLarge: this.form.cbo_big_zone || '',
          categorySmall: this.form.cbo_zone || '', keyword: this.form.txt_id || this.form.txt_name || '',
          txtAge: this.form.txt_age || '',
          aggregate: hasLocationCol ? 'false' : 'true', exportAll: 'true'
        });

        const res = await axios.get(`/api/search?${params.toString()}`);
        loadingMsg.close();
        if (res.data?.success && res.data.data) {
          const rawList = res.data.data;
          const exportList = rawList.map(row => {
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
              '(近)月-有揀貨單天數': getAnyVal('(近)月-有揀貨單天數', 'pick_days_m'),
              '(近)90日銷量': getAnyVal('(近)90日銷量', 'sales_90d'),
              '(近)90日-有揀貨單天數': getAnyVal('(近)90日-有揀貨單天數', 'pick_days_90d'),
              '供應商ID': getAnyVal('供應商ID', 'supplier_id'),
              '供應商名稱': getAnyVal('供應商名稱', 'supplier_name'),
              '所屬PM': getAnyVal('所屬PM', 'pm'),
              '總庫存數': getAnyVal('總庫存數', 'total_qty'),
              '總庫存_迴轉天數': getAnyVal('總庫存_迴轉天數', 'turn_days_total'),
              '才數': getAnyVal('才數', 'cubic_feet'),
              '材積別': getAnyVal('材積別', 'vol_type'),
              '樓層': getAnyVal('樓層', 'floor'),
              '儲位型態': getAnyVal('儲位型態', 'loc_type'),
              '大區編': getAnyVal('大區編', 'big_zone_id'),
              '大區名': getAnyVal('大區名', 'big_zone'),
              '儲位才數': getAnyVal('儲位才數', 'loc_cubic_feet'),
              '儲位健康度': getAnyVal('儲位健康度', 'loc_health'),
              '材積判斷': getAnyVal('材積判斷', 'vol_check'),
              '總才數': getAnyVal('總才數', 'total_cubic_feet'),
              '人工/自動': getAnyVal('人工/自動', 'auto_type', 'is_auto', 'autoType', 'am'),
              '庫齡級距': getAnyVal('庫齡級距', 'age_bracket'),
              '重型架判斷': getAnyVal('重型架判斷', 'heavy_rack_check')
            };
          });

          processExportData({
            fmt, tableData: exportList, exportCols: this.columns, moduleName: this.getTabName(this.currentTab),
            summary: this.summary, searchTime: this.searchTime, sendLogCallback: (f, a) => this.sendCurrentLog(f, a), formatNumber: this.formatNumber
          });
          this.$message.success(`🎉 成功匯出 ${exportList.length.toLocaleString()} 筆資料！`);
        }
      } catch (e) { loadingMsg.close(); this.$message.error('匯出失敗：' + e.message); }
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