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
        :show-export-btn="currentTab === 'loc_summary' && (summaryGridData.length > 0 || areaGridTable.length > 0)"
        @switch-tab="switchTab"
        @close-tab="closeTab"
        @open-drawer="showUnifiedDrawer = true"
        @export-excel="exportData('excel')"
      />

      <div class="views-wrapper">
        <keep-alive>
          <HomeDashboard 
            v-if="currentTab === 'home'" 
            key="home"
            :current-user="currentUser" 
            :db-metrics="dbMetrics" 
            @open-tab="openNewTab" 
            @open-import-inventory="showInventoryImportTipDialog = true" 
          />

          <LocSummary 
            v-else-if="currentTab === 'loc_summary'" 
            key="loc_summary"
            :loading="loading"
            :calc-progress="calcProgress"
            :progress-colors="progressColors"
            :summary-stats="summaryStats"
            :area-grid-table="areaGridTable"
            :summary-grid-data="summaryGridData"
            :area-vol-table="areaVolTable"
            :summary-vol-data="summaryVolData"
            @refresh-summary="handleSummaryCalc"
          />

          <InvQuery80 
            v-else-if="currentTab === 'inv80'"
            key="inv80"
            :has-searched="hasSearched"
            :summary="summary"
            :search-time="searchTime"
            :loading="loading"
            :table-data="tableData"
            :columns="columns"
            :current-page="currentPage"
            :page-size="pageSize"
            :total-rows-count="totalRowsCount"
            :custom-widths="customColWidths"
            :form="form"
            @open-search="openSearchModal"
            @export-data="exportData"
            @page-change="handlePageChange"
          />

          <SettingsLog 
            v-else-if="currentTab === 'settings_log'"
            key="settings_log"
            v-model:log-tab="logTab"
            :filtered-logs-list="logsList"
            @refresh-logs="fetchLogs"
          />

          <SettingsPerm 
            v-else-if="currentTab === 'settings_perm'"
            key="settings_perm"
            :users-list="usersList"
            :current-user="currentUser"
            @open-import-tip="showImportTipDialog = true"
            @export-users="exportUsersExcel"
            @refresh-users="fetchUsers"
            @open-add-dialog="showAddUserDialog = true"
            @open-role="openRoleDialog"
            @open-pwd="openPwdDialog"
            @open-perm="openPermDialog"
            @delete-user="onDeleteUser"
            @batch-upload="handleBatchUsersUpload"
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
      @logout="handleLogout"
      @switch-tab="openNewTab"
      @open-import-inventory="showInventoryImportTipDialog = true"
    />

    <ColConfigModal 
      v-model="showColSettingDialog"
      :is-admin="isAdmin"
      :all-available-columns="allAvailableColumns"
      :selected-columns="form.selected_columns"
      :dragged-index="draggedIndex"
      :saving-config="savingConfig"
      :raw-columns-master="rawColumnsMaster"
      @select-all="selectAllCols"
      @unselect-all="unselectAllCols"
      @drag-start="onDragStart"
      @drag-over="onDragOver"
      @drag-drop="onDrop"
      @drag-end="onDragEnd"
      @toggle-col="toggleColumnSelection"
      @save-config="saveColumnConfig"
    />

    <ParamMenuModal 
      v-model="showParamMenuDialog"
      @open-col-setting="showParamMenuDialog = false; showColSettingDialog = true;"
      @open-width-config="showParamMenuDialog = false; showWidthConfigDialog = true;"
      @open-export-width-config="showParamMenuDialog = false; showExportWidthConfigDialog = true;"
    />

    <WidthConfigModal 
      v-model:show-width-config="showWidthConfigDialog"
      v-model:show-export-width-config="showExportWidthConfigDialog"
      :selected-columns="form.selected_columns"
      :custom-col-widths="customColWidths"
      :custom-export-col-widths="customExportColWidths"
    />

    <ImportTipModal 
      v-model:show-inventory-import-tip="showInventoryImportTipDialog"
      v-model:show-import-tip="showImportTipDialog"
      :is-uploading="isUploading"
      :upload-percent="uploadPercent"
      @confirm-inventory-import="triggerSelectInventoryFile"
      @confirm-batch-import="triggerSelectBatchFile"
    />

    <UserManagementModals 
      v-model:show-edit-role="showEditRoleDialog"
      v-model:show-edit-pwd="showEditPwdDialog"
      v-model:show-edit-perm="showEditPermDialog"
      v-model:show-add-user="showAddUserDialog"
      :target-user="targetUser"
      :edit-role-form="editRoleForm"
      :edit-password-form="editPasswordForm"
      :edit-perm-form="editPermForm"
      :new-user-form="newUserForm"
      :available-modules="availableModules"
      @save-role="onSaveRole"
      @save-pwd="onSavePwd"
      @save-perm="onSavePerm"
      @save-add-user="onSaveAddUser"
    />

    <InventorySearchModal 
      v-model="showSearchModal"
      :form="form"
      :options="options"
      :loading="loading"
      :search-elapsed-sec="searchElapsedSec"
      @open-param-menu="showParamMenuDialog = true"
      @big-zone-change="onBigZoneChange"
      @submit-search="handleSearch"
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
import { processCsvUpload, processExportData } from './utils/exportImportHelpers.js'

export default {
  name: 'App',
  components: {
    TopNavbar,
    SystemDrawer,
    ColConfigModal,
    ParamMenuModal,
    WidthConfigModal,
    ImportTipModal,
    UserManagementModals,
    InventorySearchModal,
    HomeDashboard,
    LoginOverlay,
    InvQuery80,
    LocSummary,
    SettingsPerm,
    SettingsLog
  },
  setup() {
    const { sendLog, getDeviceType, setupAxiosInterceptor } = useSystemLogs();
    const authSession = useAuthSession();
    
    const sendCurrentLogFunc = (feat, act) => {
      sendLog('system', feat, act);
    };

    const userManagement = useUserManagement(sendCurrentLogFunc);

    return {
      sendLog,
      getDeviceType,
      setupAxiosInterceptor,
      ...authSession,
      ...userManagement
    };
  },
  data() {
    return {
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2026.09.01',

      isLoggedIn: false,
      currentUser: '',
      currentUsername: '',
      loginLoading: false,
      savingConfig: false,
      showUnifiedDrawer: false,
      showSearchModal: false,
      showParamMenuDialog: false,
      showWidthConfigDialog: false,
      showExportWidthConfigDialog: false,
      showImportTipDialog: false,
      showInventoryImportTipDialog: false,
      
      // 進度條控制變數
      isUploading: false,
      uploadPercent: 0,

      timeoutMessage: '',
      searchTimer: null,
      searchElapsedSec: 0,
      loginForm: { username: '', password: '', rememberMe: true },
      
      currentTab: 'home',
      openedTabs: ['home'],

      dbMetrics: { totalRows: 0, totalCategories: 0 },
      logTab: 'normal',
      loading: false,
      calcProgress: 0,
      progressTimer: null,
      progressColors: [
        { color: '#f56c6c', percentage: 20 },
        { color: '#e6a23c', percentage: 40 },
        { color: '#5cb85c', percentage: 60 },
        { color: '#1989fa', percentage: 80 },
        { color: '#6f7ad3', percentage: 100 }
      ],
      draggedIndex: null,
      hasSearched: false,
      searchTime: '',
      currentPage: 1,
      pageSize: 1000,
      totalRowsCount: 0,
      summaryGridData: [],
      summaryVolData: [],
      areaGridTable: [],
      areaVolTable: [],
      summaryStats: { total_plan_grid: 0, total_used_grid: 0, total_rem_grid: 0, total_plan_vol: 0, total_used_vol: 0, total_health: '0.0%' },
      showColSettingDialog: false,
      customColWidths: { '商品ID': 180, '商品名稱': 300, '儲位': 130 },
      customExportColWidths: { '商品ID': 25, '商品名稱': 40, '儲位': 15 },
      availableModules: [
        { key: 'loc_summary', name: '📊 儲位數才數統整' },
        { key: 'inv80', name: '🔍 庫存查詢80' },
        { key: 'inv15', name: '⚡ 庫存查詢15' },
        { key: 'turnover', name: '📈 迴轉率清單' },
        { key: 'abnormal_purchase', name: '⚠️ 不合理進貨清單' }
      ],
      rawColumnsMaster: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", 
        "區編", "區名", "館編", "館名", "長(cm)", "寬(cm)", 
        "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數", 
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", 
        "材積別", "樓層", "儲位型態", "大區編", "大區名", "儲位才數", 
        "儲位健康度", "材積判斷", "總才數", "人工/自動", "庫齡級距", "重型架判斷"
      ],
      allAvailableColumns: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", 
        "區編", "區名", "館編", "館名", "長(cm)", "寬(cm)", 
        "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數", 
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", 
        "材積別", "樓層", "儲位型態", "大區編", "大區名", "儲位才數", 
        "儲位健康度", "材積判斷", "總才數", "人工/自動", "庫齡級距", "重型架判斷"
      ],
      form: {
        search_mode: 'normal',
        batch_ids: '',
        batch_zones: '',
        txt_id: '',
        txt_name: '',
        cbo_big_zone: '',
        cbo_zone: '',
        cbo_loc_id: '',
        cbo_floor: '',
        cbo_type: '',
        cbo_vol_type: '',
        txt_age: '',
        txt_weight: '',
        txt_monthly_sales: '',
        selected_columns: ["商品ID", "商品名稱", "借/採", "人工/自動", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名", "大區名", "樓層"],
        chk_show_loc: false,
        chk_show_dim: true,
        cbo_sort: '商品ID',
        sort_order: 'desc'
      },
      options: { big_zones: [], zones_map: {}, zones: [], floors: [], ap_types: [], vol_types: [] },
      summary: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
      columns: [],
      tableData: [],
      logsList: []
    }
  },
  computed: {
    isAdmin() { return this.currentUsername === 'admin' || this.currentUser === 'admin'; }
  },
  async mounted() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && !document.title.includes('(測)')) {
      document.title = `${document.title} (測)`;
    }

    this.isLoggedIn = false;
    this.currentUser = '';
    this.currentUsername = '';
    this.openedTabs = [];

    const savedUser = localStorage.getItem('remember_username');
    const savedPwd = localStorage.getItem('remember_password');
    if (savedUser && savedPwd) {
      try {
        this.loginForm.username = atob(savedUser);
        this.loginForm.password = atob(savedPwd);
        this.loginForm.rememberMe = true;
      } catch (e) {}
    }

    this.setupAxiosInterceptor(() => this.currentUsername);
    this.fetchUsers();

    try {
      await axios.post('/api/record-log', {
        username: this.currentUser?.username || 'admin',
        name: this.currentUser?.name || '系統管理員',
        role: this.currentUser?.role || 'admin',
        device: 'Web Browser (Local Simulator)',
        feature: '系統進入',
        action: '載入庫存管理系統主頁'
      });
      this.fetchLogs();
    } catch (e) {}
  },
  methods: {
    async sendCurrentLog(feature, action) {
      const user = this.currentUsername || this.loginForm.username || 'unknown';
      await this.sendLog(user, feature, action);
    },
    async fetchDashboardMetrics() {
      try {
        const resSearch = await axios.get('/api/search?page=1&pageSize=1');
        if (resSearch.data && resSearch.data.success) {
          this.dbMetrics.totalRows = resSearch.data.total || 0;
        }

        const resCat = await axios.get('/api/categories/large');
        if (resCat.data && resCat.data.success) {
          this.dbMetrics.totalCategories = (resCat.data.data || []).length;
          this.options.big_zones = resCat.data.data || [];
        }
      } catch (e) {}
    },
    openNewTab(tabKey) {
      if (!this.openedTabs.includes(tabKey)) this.openedTabs.push(tabKey);
      this.switchTab(tabKey);
    },
    switchTab(tabKey) {
      this.currentTab = tabKey;
      localStorage.setItem('current_tab', tabKey);
      this.sendCurrentLog('選單切換', '切換至頁籤: ' + this.getTabName(tabKey));
      
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
        if (this.currentTab === tabKey && this.openedTabs.length > 0) {
          this.switchTab(this.openedTabs[this.openedTabs.length - 1]);
        }
      }
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.handleSearch();
    },
    triggerSelectInventoryFile() {
      this.$refs.inventoryFileInput.click();
    },
    async handleInventoryUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.isUploading = true;
      this.uploadPercent = 0;

      try {
        const totalRows = await processCsvUpload(
          file, 
          percent => { 
            this.uploadPercent = percent;
          },
          (feat, act) => this.sendCurrentLog(feat, act)
        );

        this.$message.success(`🎉 成功寫入 ${totalRows.toLocaleString()} 筆庫存資料至 D1 資料庫！`);
        this.showInventoryImportTipDialog = false;
        this.fetchDashboardMetrics();
        this.fetchInitData();
      } catch (e) {
        this.$message.error('上傳失敗：' + e.message);
      } finally {
        this.isUploading = false;
        event.target.value = '';
      }
    },
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    triggerSelectBatchFile() {
      this.showImportTipDialog = false;
      this.$refs.batchUserFileInput.click();
    },
    async handleBatchUsersUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post('/api/batch-import-users', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.status === 'success') {
          this.$message.success(res.data.message);
          this.fetchUsers();
          this.sendCurrentLog('帳號管理', '批次匯入帳號成功');
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('批次匯入失敗：' + detailMsg);
        this.sendCurrentLog('帳號管理', '⚠️ 批次匯入失敗: ' + detailMsg);
      } finally {
        event.target.value = '';
      }
    },
    openRoleDialog(row) {
      this.targetUser = row.username;
      this.editRoleForm.target_name = row.name || row.username;
      this.editRoleForm.target_role = row.role || (row.username === 'admin' ? 'admin' : 'user');
      this.showEditRoleDialog = true;
    },
    onSaveRole() {
      this.handleUpdateRole(msg => this.$message.success(msg)).catch(e => {
        this.$message.error('更新失敗：' + (e.response?.data?.detail || e.message));
      });
    },
    onSavePwd() {
      this.handleUpdatePassword(msg => this.$message.success(msg)).catch(e => {
        this.$message.error('修改密碼失敗：' + (e.response?.data?.detail || e.message));
      });
    },
    onSavePerm() {
      this.handleUpdatePermissions(msg => this.$message.success(msg)).catch(e => {
        this.$message.error('更新權限失敗：' + (e.response?.data?.detail || e.message));
      });
    },
    onSaveAddUser() {
      this.handleAddUser(msg => this.$message.success(msg)).catch(e => {
        this.$message.error(e.response?.data?.detail || e.message);
      });
    },
    onDeleteUser(username) {
      this.deleteUser(username, msg => this.$message.success(msg)).catch(e => {
        this.$message.error(e.response?.data?.detail || e.message);
      });
    },
    async exportUsersExcel() {
      try {
        const res = await axios.get('/api/export-users-excel', { responseType: 'blob' });
        const blob = new Blob([res.data]);
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
        
        link.download = '帳號與權限清單_' + dateStr + '_' + timeStr + '.xlsx';
        link.click();
        this.$message.success('已成功匯出帳號與權限清單！');
        this.sendCurrentLog('帳號管理', '匯出帳號與權限 Excel 清單');
      } catch (e) {
        this.$message.error('匯出帳號清單失敗！');
      }
    },
    async saveColumnConfig() {
      if (!this.isAdmin) {
        this.showColSettingDialog = false;
        return;
      }
      this.savingConfig = true;
      try {
        const res = await axios.post('/api/save-column-config', {
          username: this.currentUsername,
          all_columns: this.allAvailableColumns,
          selected_columns: this.form.selected_columns
        });
        if (res.data && res.data.status === 'success') {
          this.$message.success('已成功儲存！新欄位順序與顯示已同步至全公司所有帳號。');
          this.showColSettingDialog = false;
          this.sendCurrentLog('欄位設定', '更新全公司統一預設欄位與顯示順序');
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('儲存失敗：' + detailMsg);
        this.sendCurrentLog('欄位設定', '⚠️ 儲存失敗: ' + detailMsg);
      } finally {
        this.savingConfig = false;
      }
    },
    async openSearchModal() {
      this.showSearchModal = true;
      await this.fetchInitData();
    },
    toggleColumnSelection(colName) {
      if (!Array.isArray(this.form.selected_columns)) this.form.selected_columns = [];
      const idx = this.form.selected_columns.indexOf(colName);
      if (idx >= 0) this.form.selected_columns.splice(idx, 1);
      else this.form.selected_columns.push(colName);
    },
    onDragStart(event, idx) { this.draggedIndex = idx; },
    onDragOver(event, idx) {
      if (this.draggedIndex === null || this.draggedIndex === idx) return;
      const itemToMove = this.allAvailableColumns.splice(this.draggedIndex, 1)[0];
      this.allAvailableColumns.splice(idx, 0, itemToMove);
      this.draggedIndex = idx;
    },
    onDrop() { this.draggedIndex = null; },
    onDragEnd() { this.draggedIndex = null; },
    selectAllCols() { this.form.selected_columns = [...this.allAvailableColumns]; },
    unselectAllCols() { this.form.selected_columns = []; },
    openPwdDialog(row) {
      this.targetUser = row.username;
      this.editPasswordForm.new_password = '';
      this.showEditPwdDialog = true;
    },
    openPermDialog(row) {
      this.targetUser = row.username;
      this.editPermForm.selected_modules = row.permissions || ['loc_summary', 'inv80', 'inv15', 'turnover', 'abnormal_purchase'];
      this.showEditPermDialog = true;
    },
    startProgressSimulation() {
      this.calcProgress = 0;
      if (this.progressTimer) clearInterval(this.progressTimer);
      this.progressTimer = setInterval(() => {
        if (this.calcProgress < 92) {
          this.calcProgress += Math.floor(Math.random() * 8) + 3;
        }
      }, 200);
    },
    finishProgressSimulation() {
      if (this.progressTimer) clearInterval(this.progressTimer);
      this.calcProgress = 100;
    },
    async handleSummaryCalc() {
      this.loading = true;
      this.startProgressSimulation();

      try {
        const res = await axios.get('/api/calc-location-summary');
        if (res.data && res.data.status === 'success') {
          this.finishProgressSimulation();
          setTimeout(() => {
            this.summaryGridData = [...(res.data.grid_summary || [])];
            this.summaryVolData = [...(res.data.vol_summary || [])];
            this.areaGridTable = [...(res.data.area_grid_table || [])];
            this.areaVolTable = [...(res.data.area_vol_table || [])];
            this.summaryStats = res.data.stats || {};
            this.sendCurrentLog('儲位數才數統整', '執行全流程統整計算成功');
          }, 300);
        }
      } catch (e) {
        this.finishProgressSimulation();
        this.sendCurrentLog('儲位數才數統整', '⚠️ 計算連線失敗: ' + e.message);
      } finally {
        setTimeout(() => { this.loading = false; }, 300);
      }
    },
    async fetchLogs() {
      try {
        const res = await axios.get('/api/get-logs');
        if (res.data && res.data.logs) this.logsList = res.data.logs;
      } catch (e) {}
    },
    async handleLogin() {
      if (!this.loginForm.username || !this.loginForm.password) {
        this.$message.warning('請輸入帳號與密碼！');
        return;
      }

      this.loginLoading = true;
      try {
        const res = await axios.post('/api/login', {
          username: this.loginForm.username,
          password: this.loginForm.password,
          device: this.getDeviceType()
        });

        if (res.data && res.data.status === 'success') {
          this.isLoggedIn = true;
          this.currentUsername = res.data.username;
          this.currentUser = res.data.name || res.data.username;
          this.loginTimestamp = Date.now();
          this.timeoutMessage = '';
          
          this.currentTab = 'home';
          this.openedTabs = ['home'];

          this.formatLoginTimeStr();
          this.startTimers();
          this.fetchDashboardMetrics();
          this.fetchLogs();
          this.sendCurrentLog('系統安全', '登入系統成功');

          this.$message.success('歡迎回來，' + this.currentUser + '！');
        } else {
          const detailMsg = res.data?.detail || '帳號或密碼錯誤！';
          this.$message.error(detailMsg);
          this.sendCurrentLog('系統安全', '⚠️ 登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || '登入連線失敗！';
        this.$message.error(detailMsg);
        this.sendCurrentLog('系統安全', '⚠️ 登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
      } finally {
        this.loginLoading = false;
      }
    },
    handleLogout() {
      this.sendCurrentLog('系統安全', '使用者手動登出系統');
      this.stopTimers();
      this.isLoggedIn = false;
      this.currentUser = '';
      this.currentUsername = '';
      this.openedTabs = [];
      this.loginTimestamp = null;
      this.$message.info('已成功登出系統');
    },
    getTabName(tabKey) {
      const names = {
        'home': '🏠 系統首頁',
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'loc_summary': '儲位數才數統整',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單',
        'settings_perm': '權限管理',
        'settings_log': '日誌歷程查詢'
      };
      return names[tabKey] || '系統模組';
    },
    async fetchInitData() {
      try {
        const res = await axios.get('/api/categories/large');
        if (res.data && res.data.success) {
          this.options.big_zones = res.data.data;
        }
      } catch (e) {}
    },
    async onBigZoneChange(val) {
      this.form.cbo_zone = '';
      this.options.zones = [];
      if (!val) return;

      try {
        const res = await axios.get('/api/categories/small?large=' + encodeURIComponent(val));
        if (res.data && res.data.success) {
          this.options.zones = res.data.data;
        }
      } catch (e) {}
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
          if (!currentCols.includes('儲位')) {
            const insertIdx = currentCols.indexOf('儲位庫存數');
            if (insertIdx >= 0) currentCols.splice(insertIdx, 0, '儲位');
            else currentCols.push('儲位');
          }
        } else {
          currentCols = currentCols.filter(c => c !== '儲位');
        }

        const dimCols = ['長(cm)', '寬(cm)', '高(cm)', '重量(kg)', '才數', '材積別'];
        if (this.form.chk_show_dim) {
          dimCols.forEach(col => {
            if (!currentCols.includes(col)) currentCols.push(col);
          });
        } else {
          currentCols = currentCols.filter(c => !dimCols.includes(c));
        }

        this.columns = currentCols;
        const hasLocationCol = this.columns.includes('儲位');

        // 🌟【關鍵修復】根據 search_mode 正確取得 batch_ids 或 batch_zones 內容
        const mode = this.form.search_mode || 'normal';
        let batchTxt = '';

        if (mode === 'batch_id') {
          batchTxt = this.form.batch_ids || '';
        } else if (mode === 'batch_zone') {
          batchTxt = this.form.batch_zones || '';
        }

        const params = new URLSearchParams({
          page: this.currentPage,
          pageSize: this.pageSize,
          searchMode: mode,
          batchIds: batchTxt,
          categoryLarge: this.form.cbo_big_zone || '',
          categorySmall: this.form.cbo_zone || '',
          keyword: this.form.txt_id || this.form.txt_name || '',
          aggregate: hasLocationCol ? 'false' : 'true'
        });

        const res = await axios.get(`/api/search?${params.toString()}`);

        if (res.data && res.data.success) {
          this.totalRowsCount = res.data.total || 0;
          
          const rawData = res.data.data || [];
          this.tableData = rawData.map(row => {
            const getAnyVal = (...keys) => {
              for (const k of keys) {
                if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
                  return row[k];
                }
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
      if (!this.hasSearched) {
        this.$message.warning('請先執行檢索再進行匯出！');
        return;
      }

      const loadingMsg = this.$message.info({
        message: `⚡ 正在打包全量庫存資料 (${this.totalRowsCount.toLocaleString()} 筆)，請稍候...`,
        duration: 0
      });

      try {
        const hasLocationCol = this.columns.includes('儲位') || this.form.chk_show_loc;
        const mode = this.form.search_mode || 'normal';
        let batchTxt = '';

        if (mode === 'batch_id') {
          batchTxt = this.form.batch_ids || '';
        } else if (mode === 'batch_zone') {
          batchTxt = this.form.batch_zones || '';
        }

        const params = new URLSearchParams({
          searchMode: mode,
          batchIds: batchTxt,
          categoryLarge: this.form.cbo_big_zone || '',
          categorySmall: this.form.cbo_zone || '',
          keyword: this.form.txt_id || this.form.txt_name || '',
          aggregate: hasLocationCol ? 'false' : 'true',
          exportAll: 'true'
        });

        const res = await axios.get(`/api/search?${params.toString()}`);

        loadingMsg.close();

        if (res.data && res.data.success && res.data.data) {
          const rawList = res.data.data;
          
          const exportList = rawList.map(row => {
            const getAnyVal = (...keys) => {
              for (const k of keys) {
                if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
                  return row[k];
                }
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
            fmt,
            tableData: exportList,
            exportCols: this.columns,
            moduleName: this.getTabName(this.currentTab),
            summary: this.summary,
            searchTime: this.searchTime,
            sendLogCallback: (feat, act) => this.sendCurrentLog(feat, act),
            formatNumber: this.formatNumber
          });

          this.$message.success(`🎉 成功匯出 ${exportList.length.toLocaleString()} 筆庫存資料！`);
        } else {
          this.$message.error('全量資料拉取失敗，請重試！');
        }
      } catch (e) {
        loadingMsg.close();
        this.$message.error('匯出過程發生錯誤：' + e.message);
      }
    }
  }
}
</script>

<style>
/* 1. 視窗全滿鎖定 */
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  background-color: #0f172a !important;
}

/* 2. 🎨 Element Plus 表格橫向與垂直滾動條：淡藍色 + 細長質感樣式 */
.el-table .el-scrollbar__bar {
  display: block !important;
  opacity: 0.85 !important;
  z-index: 99 !important;
}

.el-table .el-scrollbar__bar.is-horizontal {
  height: 8px !important;
  bottom: 2px !important;
  left: 0 !important;
  right: 0 !important;
  background-color: rgba(15, 23, 42, 0.6) !important;
  border-radius: 4px !important;
}

.el-table .el-scrollbar__bar.is-horizontal .el-scrollbar__thumb {
  height: 100% !important;
  background-color: #38bdf8 !important;
  border-radius: 4px !important;
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.6) !important;
  opacity: 1 !important;
}

.el-table .el-scrollbar__bar.is-vertical {
  width: 8px !important;
  top: 0 !important;
  bottom: 0 !important;
  right: 2px !important;
  background-color: rgba(15, 23, 42, 0.6) !important;
  border-radius: 4px !important;
}

.el-table .el-scrollbar__bar.is-vertical .el-scrollbar__thumb {
  width: 100% !important;
  background-color: #38bdf8 !important;
  border-radius: 4px !important;
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.6) !important;
  opacity: 1 !important;
}

.el-table .el-scrollbar__thumb:hover,
.el-table .el-scrollbar__thumb:active {
  background-color: #7dd3fc !important;
  box-shadow: 0 0 10px rgba(125, 211, 252, 0.9) !important;
}
</style>

<style scoped>
.app-container.dark-mode {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden !important;
  background-color: #0f172a;
  color: #f8fafc;
}

.text-white { color: #ffffff !important; }
.text-gray { color: #94a3b8 !important; }

.views-wrapper {
  flex: 1;
  height: calc(100vh - 52px);
  overflow: hidden;
}

:deep(.el-table) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  width: 100% !important;
  max-width: 100% !important;
}

:deep(.el-table__body-wrapper) {
  overflow-x: auto !important;
  overflow-y: auto !important;
}

:deep(.el-drawer) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border-left: 1px solid #334155 !important;
}

:deep(.el-drawer__header) {
  background-color: #0f172a !important;
  color: #ffffff !important;
  margin-bottom: 0 !important;
  padding: 15px 20px !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.el-drawer__title) {
  color: #38bdf8 !important;
  font-weight: bold;
}

:deep(.el-drawer__close-btn) {
  color: #ffffff !important;
}

:deep(.el-dialog) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
  border: 1px solid #334155 !important;
}

:deep(.el-dialog__header) {
  background-color: #0f172a !important;
  color: #ffffff !important;
  margin-bottom: 0 !important;
  padding: 15px 20px !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.el-dialog__title) {
  color: #38bdf8 !important;
  font-weight: bold;
}

:deep(.el-dialog__close) {
  color: #ffffff !important;
}

:deep(.el-table tr),
:deep(.el-table th.el-table__cell) {
  background-color: #1e293b !important;
  color: #38bdf8 !important;
}

:deep(.el-table td.el-table__cell) {
  background-color: #0f172a !important;
  color: #f8fafc !important;
  border-bottom: 1px solid #334155 !important;
}

:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: #1e293b !important;
}
</style>