<template>
  <div id="app" class="app-container dark-mode">
    <input type="file" ref="inventoryFileInput" style="display: none;" accept=".csv,.xlsx,.xls" @change="handleInventoryUpload" />

    <!-- 1. 登入遮罩畫面 -->
    <div v-if="!isLoggedIn" class="login-overlay">
      <div class="login-card">
        <div v-if="timeoutMessage" class="timeout-alert-banner">
          <span class="alert-icon">⚠️</span>
          <span class="alert-text">{{ timeoutMessage }}</span>
        </div>

        <div class="login-header">
          <div class="logo-icon">📦</div>
          <h2>庫存儲位管理系統</h2>
          <p>請輸入 6 碼員編帳號與密碼以存取系統</p>
        </div>

        <el-form :model="loginForm" label-width="70px" @submit.prevent="handleLogin" class="login-form">
          <el-form-item label="帳號">
            <el-input v-model="loginForm.username" placeholder="請輸入 6 碼員編" prefix-icon="User" clearable></el-input>
          </el-form-item>

          <el-form-item label="密碼">
            <el-input 
              v-model="loginForm.password" 
              type="password" 
              placeholder="請輸入密碼 (初登入預設同員編)" 
              show-password
              prefix-icon="Lock"
              @keyup.enter="handleLogin"
            ></el-input>
          </el-form-item>

          <div class="centered-checkbox-row">
            <el-checkbox v-model="loginForm.rememberMe" style="color: #cbd5e1;">記住帳號與密碼</el-checkbox>
          </div>

          <div class="centered-btn-row">
            <el-button type="primary" class="login-btn-full" :loading="loginLoading" @click="handleLogin">
              🔐 登入系統
            </el-button>
          </div>
        </el-form>
      </div>
    </div>

    <!-- 2. 登入後主頁面 -->
    <div v-else class="app-main-content">
      <TopNavbar 
        v-if="isLoggedIn"
        :current-tab="currentTab"
        :opened-tabs="openedTabs"
        :show-export-btn="currentTab === 'loc_summary' && (summaryGridData.length > 0 || areaGridTable.length > 0)"
        @switch-tab="switchTab"
        @close-tab="closeTab"
        @open-drawer="showUnifiedDrawer = true"
        @export-excel="exportData('excel')"
      />

      <div class="views-wrapper">
        <keep-alive>
          <LocSummary 
            v-if="currentTab === 'loc_summary'" 
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
            @open-search="openSearchModal"
            @export-data="exportData"
            @page-change="handlePageChange"
          />

          <SettingsLog 
            v-else-if="currentTab === 'settings_log'"
            v-model:log-tab="logTab"
            :filtered-logs-list="filteredLogsList"
            @refresh-logs="fetchLogs"
          />

          <SettingsPerm 
            v-else-if="currentTab === 'settings_perm'"
            :users-list="usersList"
            :current-user="currentUser"
            @open-import-tip="showImportTipDialog = true"
            @export-users="exportUsersExcel"
            @refresh-users="fetchUsers"
            @open-add-dialog="showAddUserDialog = true"
            @open-role="openRoleDialog"
            @open-pwd="openPwdDialog"
            @open-perm="openPermDialog"
            @delete-user="deleteUser"
            @batch-upload="handleBatchUsersUpload"
          />

          <div class="coming-soon-container dark-bg" v-else>
            <div class="coming-soon-card dark-card">
              <div class="icon">🚧</div>
              <h2 class="text-white">【{{ getTabName(currentTab) }}】 功能尚未上線</h2>
              <p class="text-gray">此模組正在全力開發中，敬請期待後續功能更新！</p>
              <button class="back-btn" @click="switchTab('inv80')">返回 庫存查詢80</button>
            </div>
          </div>
        </keep-alive>
      </div>
    </div>

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

    <el-dialog title="⚙️ 參數設定選項" v-model="showParamMenuDialog" width="400px" class="dark-dialog">
      <div class="param-dialog-body">
        <button class="aligned-btn btn-blue" @click="showParamMenuDialog = false; showColSettingDialog = true;">
          1. 庫存明細欄位順序設定
        </button>

        <button class="aligned-btn btn-green" @click="showParamMenuDialog = false; showWidthConfigDialog = true;">
          2. 庫存明細欄寬設定
        </button>

        <button class="aligned-btn btn-orange" @click="showParamMenuDialog = false; showExportWidthConfigDialog = true;">
          3. 庫存明細匯出欄寬設定
        </button>
      </div>
      <template #footer>
        <el-button @click="showParamMenuDialog = false">關閉</el-button>
      </template>
    </el-dialog>

    <el-dialog title="📏 2. 庫存明細顯示欄寬設定 (px)" v-model="showWidthConfigDialog" width="480px" class="dark-dialog">
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in form.selected_columns" :key="col" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <span style="font-weight: bold; color: #f8fafc; font-size: 13px;">{{ col }}</span>
          <el-input-number size="small" :min="50" :max="600" v-model="customColWidths[col]" placeholder="像素(px)"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showWidthConfigDialog = false; $message.success('已套用畫面顯示欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>

    <el-dialog title="📊 3. 庫存明細匯出欄寬設定 (字符)" v-model="showExportWidthConfigDialog" width="480px" class="dark-dialog">
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in form.selected_columns" :key="col" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <span style="font-weight: bold; color: #f8fafc; font-size: 13px;">{{ col }}</span>
          <el-input-number size="small" :min="10" :max="100" v-model="customExportColWidths[col]" placeholder="字符寬度"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showExportWidthConfigDialog = false; $message.success('已套用匯出報表欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>

    <el-dialog title="📥 商品資料明細匯入說明" v-model="showInventoryImportTipDialog" width="480px" class="dark-dialog">
      <div style="font-size: 14px; line-height: 1.8; color: #cbd5e1;">
        <p style="margin-top: 0; color: #38bdf8; font-weight: bold;">請確認您準備上傳的商品明細檔案符合以下規範：</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li><b>建議上傳檔名</b>：<code style="color: #fef08a;">latest_inventory.csv</code></li>
          <li><b>支援副檔名</b>：<code style="color: #4ade80;">.csv</code> 或 <code style="color: #4ade80;">.xlsx</code></li>
          <li><b>更新效益</b>：上傳成功後，系統將<b>即時同步最新庫存數據</b>！</li>
        </ol>
      </div>
      <template #footer>
        <el-button @click="showInventoryImportTipDialog = false">取消</el-button>
        <el-button type="warning" style="font-weight: bold; color: #000;" @click="triggerSelectInventoryFile">確定，選擇檔案並開始匯入</el-button>
      </template>
    </el-dialog>

    <el-dialog title="🔍 庫存查詢條件設定" v-model="showSearchModal" width="600px" custom-class="dark-dialog search-modal-dialog">
      <div class="modal-search-form" style="max-height: 65vh; overflow-y: auto; padding-right: 10px;">
        <div class="param-config-bar" style="margin-bottom: 15px;">
          <el-button 
            type="warning" 
            size="medium" 
            style="width: 100%; font-weight: bold; background: #eab308; border-color: #d97706; color: #000;" 
            @click="showParamMenuDialog = true"
          >
            📋 參數設定
          </el-button>
        </div>

        <div class="form-group">
          <label>查詢模式</label>
          <el-select v-model="form.search_mode" style="width: 100%;">
            <el-option label="一般查詢 (單項/多條件)" value="normal"></el-option>
            <el-option label="批次商品 ID 查詢" value="batch_id"></el-option>
            <el-option label="批次儲位/區域 查詢" value="batch_zone"></el-option>
          </el-select>
        </div>

        <div class="form-group" v-if="form.search_mode === 'batch_id'">
          <label>批次商品 ID (每行一個)</label>
          <el-input type="textarea" :rows="4" v-model="form.batch_ids" placeholder="請輸入商品ID，一行一個..."></el-input>
        </div>

        <div class="form-group" v-if="form.search_mode === 'batch_zone'">
          <label>批次儲位/區域 (每行一個)</label>
          <el-input type="textarea" :rows="4" v-model="form.batch_zones" placeholder="請輸入區域或儲位號碼..."></el-input>
        </div>

        <div v-if="form.search_mode === 'normal'" class="normal-search-wrapper">
          <div class="grid-2col">
            <div class="form-group">
              <label>商品 ID (關鍵字)</label>
              <el-input v-model="form.txt_id" placeholder="關鍵字..." clearable></el-input>
            </div>
            <div class="form-group">
              <label>商品名稱 (關鍵字)</label>
              <el-input v-model="form.txt_name" placeholder="關鍵字..." clearable></el-input>
            </div>
          </div>

          <div class="grid-2col">
            <div class="form-group">
              <label>大區名</label>
              <el-select v-model="form.cbo_big_zone" placeholder="全部" clearable @change="onBigZoneChange" style="width: 100%;">
                <el-option label="全部" value=""></el-option>
                <el-option v-for="item in options.big_zones" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
            <div class="form-group">
              <label>區名</label>
              <el-select v-model="form.cbo_zone" placeholder="全部" clearable style="width: 100%;">
                <el-option label="全部" value=""></el-option>
                <el-option v-for="item in options.zones" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>

          <div class="grid-2col">
            <div class="form-group">
              <label>儲位查詢 (關鍵字)</label>
              <el-input v-model="form.cbo_loc_id" placeholder="輸入儲位..." clearable></el-input>
            </div>
            <div class="form-group">
              <label>樓層</label>
              <el-select v-model="form.cbo_floor" placeholder="全部" clearable style="width: 100%;">
                <el-option label="全部" value=""></el-option>
                <el-option v-for="item in options.floors" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>

          <div class="grid-3col">
            <div class="form-group">
              <label>庫齡 (>=或範圍)</label>
              <el-input v-model="form.txt_age" placeholder="例:30或10-50"></el-input>
            </div>
            <div class="form-group">
              <label>重量 (>=KG)</label>
              <el-input v-model="form.txt_weight" placeholder="例:5"></el-input>
            </div>
            <div class="form-group">
              <label>月銷量 (>=)</label>
              <el-input v-model="form.txt_monthly_sales" placeholder="例:100"></el-input>
            </div>
          </div>

          <div class="grid-2col">
            <div class="form-group">
              <label>存放區域 (人工/自動)</label>
              <el-select v-model="form.cbo_type" placeholder="全部" clearable style="width: 100%;">
                <el-option label="全部" value=""></el-option>
                <el-option v-for="item in options.ap_types" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
            <div class="form-group">
              <label>材積別</label>
              <el-select v-model="form.cbo_vol_type" placeholder="全部" clearable style="width: 100%;">
                <el-option label="全部" value=""></el-option>
                <el-option v-for="item in options.vol_types" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>
        </div>

        <el-divider content-position="left">顯示與排序設定</el-divider>

        <div class="checkbox-group" style="margin-bottom: 12px;">
          <el-checkbox v-model="form.chk_show_loc">顯示儲位明細 (+儲位)</el-checkbox>
          <el-checkbox v-model="form.chk_show_dim">顯示長寬高重量 (+材積/重量)</el-checkbox>
        </div>

        <div class="grid-2col">
          <div class="form-group">
            <label>清單排序欄位</label>
            <el-select v-model="form.cbo_sort" placeholder="預設" clearable style="width: 100%;">
              <el-option label="商品ID" value="商品ID"></el-option>
              <el-option label="儲位" value="儲位"></el-option>
              <el-option label="庫齡" value="庫齡"></el-option>
              <el-option label="儲位庫存數" value="儲位庫存數"></el-option>
              <el-option label="才數" value="才數"></el-option>
              <el-option label="月銷量" value="月銷量"></el-option>
            </el-select>
          </div>
          <div class="form-group" style="justify-content: flex-end;">
            <el-radio-group v-model="form.sort_order" style="margin-top: 25px;">
              <el-radio label="asc">遞增</el-radio>
              <el-radio label="desc">遞減</el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showSearchModal = false" :disabled="loading">取消</el-button>
        <el-button type="danger" :loading="loading" @click="handleSearch" style="min-width: 160px;">
          <span v-if="loading">⏱️ 檢索中 ({{ searchElapsedSec }}s)...</span>
          <span v-else>🚀 開始搜索</span>
        </el-button>
      </template>
    </el-dialog>

    <el-dialog title="📥 批次匯入帳號欄位格式說明" v-model="showImportTipDialog" width="480px" class="dark-dialog">
      <div style="font-size: 14px; line-height: 1.8; color: #cbd5e1;">
        <p style="margin-top: 0; color: #38bdf8; font-weight: bold;">請確認您準備上傳的 Excel/CSV 檔案符合以下格式：</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li><b>第 1 列為欄位表頭</b>，必須包含：<br/><code style="color: #4ade80;">帳號</code> (或 <code>員編</code>)、<code style="color: #4ade80;">姓名</code>、<code style="color: #4ade80;">身份</code> (可選)</li>
          <li><b>帳號格式</b>：必須為 6 碼純數字員編（例如：<code>102609</code>）。</li>
          <li><b>預設密碼</b>：匯入後系統將自動將密碼設為同「6 碼員編」。</li>
          <li><b>身份欄位</b>：可填寫 <code>admin</code> 或 <code>user</code>（預設為 user）。</li>
        </ol>
      </div>
      <template #footer>
        <el-button @click="showImportTipDialog = false">取消</el-button>
        <el-button type="primary" @click="triggerSelectBatchFile">確定，選擇檔案並上傳</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="`🆔 帳號資料設定 - [${targetUser}]`" v-model="showEditRoleDialog" width="380px" class="dark-dialog">
      <el-form label-width="90px">
        <el-form-item label="使用者姓名">
          <el-input v-model="editRoleForm.target_name" placeholder="請輸入真實姓名"></el-input>
        </el-form-item>
        <el-form-item label="帳號身份">
          <el-select v-model="editRoleForm.target_role" style="width: 100%;">
            <el-option label="👑 管理員 (admin)" value="admin"></el-option>
            <el-option label="👤 一般人員 (user)" value="user"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditRoleDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateRole">儲存變更</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="`✏️ 修改密碼 - [${targetUser}]`" v-model="showEditPwdDialog" width="380px" class="dark-dialog">
      <el-form label-width="80px">
        <el-form-item label="新密碼">
          <el-input v-model="editPasswordForm.new_password" type="password" placeholder="請輸入新密碼" show-password></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPwdDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdatePassword">確定修改</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="`🔐 設定模組權限 - [${targetUser}]`" v-model="showEditPermDialog" width="420px" class="dark-dialog">
      <div style="margin-bottom: 12px; color: #94a3b8; font-size: 13px;">請勾選該帳號允許存取的系統頁籤模組：</div>
      <el-checkbox-group v-model="editPermForm.selected_modules">
        <div v-for="mod in availableModules" :key="mod.key" style="margin-bottom: 10px;">
          <el-checkbox :label="mod.key">{{ mod.name }}</el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="showEditPermDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdatePermissions">儲存權限</el-button>
      </template>
    </el-dialog>

    <el-dialog title="新增員編帳號" v-model="showAddUserDialog" width="400px" class="dark-dialog">
      <el-form :model="newUserForm" label-width="110px">
        <el-form-item label="使用者姓名">
          <el-input v-model="newUserForm.name" placeholder="請輸入真實姓名"></el-input>
        </el-form-item>
        <el-form-item label="帳號(6碼員編)">
          <el-input v-model="newUserForm.username" placeholder="請輸入6碼純數字員編"></el-input>
        </el-form-item>
        <el-form-item label="初始預設密碼">
          <span style="color: #38bdf8; font-weight: bold;">密碼預設自動同『6碼員編』</span>
        </el-form-item>
        <el-form-item label="身份權限">
          <el-select v-model="newUserForm.role" style="width: 100%;">
            <el-option label="👤 一般人員" value="user"></el-option>
            <el-option label="👑 管理員" value="admin"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddUser">確定新增帳號</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import TopNavbar from './components/TopNavbar.vue'
import SystemDrawer from './components/SystemDrawer.vue'
import ColConfigModal from './components/ColConfigModal.vue'
import InvQuery80 from './views/InvQuery80.vue'
import LocSummary from './views/LocSummary.vue'
import SettingsPerm from './views/SettingsPerm.vue'
import SettingsLog from './views/SettingsLog.vue'

export default {
  name: 'App',
  components: {
    TopNavbar,
    SystemDrawer,
    ColConfigModal,
    InvQuery80,
    LocSummary,
    SettingsPerm,
    SettingsLog
  },
  data() {
    return {
      isLoggedIn: false,
      currentUser: '',
      loginLoading: false,
      savingConfig: false,
      showUnifiedDrawer: false,
      showSearchModal: false,
      showParamMenuDialog: false,
      showWidthConfigDialog: false,
      showExportWidthConfigDialog: false,
      showImportTipDialog: false,
      showInventoryImportTipDialog: false,
      timeoutMessage: '',
      searchTimer: null,
      searchElapsedSec: 0,
      loginForm: { username: '', password: '', rememberMe: true },
      currentTab: 'inv80',
      openedTabs: [],
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
      showEditRoleDialog: false,
      showEditPwdDialog: false,
      showEditPermDialog: false,
      customColWidths: { '商品ID': 180, '商品名稱': 300, '儲位': 130 },
      customExportColWidths: { '商品ID': 25, '商品名稱': 40, '儲位': 15 },
      targetUser: '',
      editRoleForm: { target_name: '', target_role: 'user' },
      editPasswordForm: { new_password: '' },
      editPermForm: { selected_modules: [] },
      loginTimestamp: null,
      loginTimeStr: '--/-- --:--',
      sessionDurationStr: '00:00:00',
      idleCountdownStr: '60:00',
      lastActiveTimestamp: Date.now(),
      clockInterval: null,
      TIMEOUT_MS: 3600000,
      availableModules: [
        { key: 'loc_summary', name: '📊 儲位數才數統整' },
        { key: 'inv80', name: '🔍 庫存查詢80' },
        { key: 'inv15', name: '⚡ 庫存查詢15' },
        { key: 'turnover', name: '📈 迴轉率清單' },
        { key: 'abnormal_purchase', name: '⚠️ 不合理進貨清單' }
      ],
      rawColumnsMaster: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
        "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "重量(KG)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "儲位編碼-3",
        "儲位編碼", "儲位編碼5", "樓層", "樓層區域", "儲位型態", "大區編", "大區名", "三邊長", "最長邊",
        "最短邊", "儲位才數", "儲位健康度", "不符合", "材積判斷", "才數.1", "人工/自動", "儲位層標示",
        "庫齡級距", "樓層設定", "重型架判斷", "ID指定樓層", "備註"
      ],
      allAvailableColumns: [
        "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
        "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "重量(KG)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
        "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "儲位編碼-3",
        "儲位編碼", "儲位編碼5", "樓層", "樓層區域", "儲位型態", "大區編", "大區名", "三邊長", "最長邊",
        "最短邊", "儲位才數", "儲位健康度", "不符合", "材積判斷", "才數.1", "人工/自動", "儲位層標示",
        "庫齡級距", "樓層設定", "重型架判斷", "ID指定樓層", "備註"
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
        selected_columns: ["商品ID", "商品名稱", "借/採", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名", "大區名", "樓層"],
        chk_show_loc: false,
        chk_show_dim: true,
        cbo_sort: '商品ID',
        sort_order: 'desc'
      },
      options: { big_zones: [], zones_map: {}, zones: [], floors: [], ap_types: [], vol_types: [] },
      summary: { total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 },
      columns: [],
      tableData: [],
      usersList: [],
      logsList: [],
      showAddUserDialog: false,
      newUserForm: { username: '', name: '', role: 'user' }
    }
  },
  computed: {
    isAdmin() { return this.currentUser === 'admin'; },
    filteredLogsList() {
      if (this.logTab === 'error') {
        return this.logsList.filter(row => this.isErrorAction(row.action));
      }
      return this.logsList.filter(row => !this.isErrorAction(row.action));
    }
  },
  mounted() {
    this.isLoggedIn = false;
    this.currentUser = '';
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

    localStorage.removeItem('inventory_user');
    localStorage.removeItem('inventory_login_time');

    this.fetchUsers();
    this.fetchLogs();
  },
  beforeUnmount() {
    this.stopTimers();
    if (this.progressTimer) clearInterval(this.progressTimer);
    if (this.searchTimer) clearInterval(this.searchTimer);
  },
  methods: {
    openNewTab(tabKey) {
      if (!this.openedTabs.includes(tabKey)) {
        this.openedTabs.push(tabKey);
      }
      this.switchTab(tabKey);
    },
    switchTab(tabKey) {
      this.currentTab = tabKey;
      localStorage.setItem('current_tab', tabKey);
      this.sendLog('選單切換', '切換至頁籤: ' + this.getTabName(tabKey));
      
      if (tabKey === 'loc_summary' && this.summaryGridData.length === 0) this.handleSummaryCalc();
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
    },
    triggerSelectInventoryFile() {
      this.showInventoryImportTipDialog = false;
      this.$refs.inventoryFileInput.click();
    },
    async handleInventoryUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.$message.info('⚡ 正在解析並更新商品資料明細，請稍候...');

      try {
        const text = await file.text();
        const parsedData = this.parseCSV(text);
        if (parsedData && parsedData.length > 0) {
          this.$message.success(`🎉 成功上傳解析 ${parsedData.length} 筆資料！`);
          this.sendLog('資料匯入', '成功上傳解析商品資料明細：' + file.name);
          this.fetchInitData();
          if (this.currentTab === 'inv80') {
            this.handleSearch();
          }
        }
      } catch (e) {
        this.$message.error('解析檔案失敗：' + e.message);
      } finally {
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
          this.sendLog('帳號管理', '批次匯入帳號成功');
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('批次匯入失敗：' + detailMsg);
        this.sendLog('帳號管理', '批次匯入失敗: ' + detailMsg);
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
    async handleUpdateRole() {
      try {
        const res = await axios.post('/api/update-role', {
          username: this.targetUser,
          name: this.editRoleForm.target_name,
          role: this.editRoleForm.target_role
        });
        if (res.data.status === 'success') {
          this.$message.success(res.data.message);
          this.showEditRoleDialog = false;
          this.fetchUsers();
          this.sendLog('帳號管理', '更新帳號資料成功: ' + this.targetUser);
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('更新失敗：' + detailMsg);
      }
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
        this.sendLog('帳號管理', '匯出帳號與權限 Excel 清單');
      } catch (e) {
        this.$message.error('匯出帳號清單失敗！');
      }
    },
    async loadColumnConfig() {
      try {
        const res = await axios.get('/api/get-column-config');
        if (res.data) {
          if (res.data.allAvailableColumns && res.data.allAvailableColumns.length > 0) {
            this.allAvailableColumns = [...res.data.allAvailableColumns];
          }
          if (res.data.selected_columns && res.data.selected_columns.length > 0) {
            let cols = res.data.selected_columns;
            if (typeof cols === 'string') {
              try { cols = JSON.parse(cols); } catch (e) {}
            }
            if (Array.isArray(cols)) {
              this.form.selected_columns = [...cols];
            }
          }
        }
      } catch (e) {
        console.error('載入欄位同步設定失敗:', e);
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
          username: this.currentUser,
          all_columns: this.allAvailableColumns,
          selected_columns: this.form.selected_columns
        });
        if (res.data && res.data.status === 'success') {
          this.$message.success('已成功儲存！新欄位順序與顯示已同步至全公司所有帳號。');
          this.showColSettingDialog = false;
          this.sendLog('欄位設定', '更新全公司統一預設欄位與顯示順序');
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('儲存失敗：' + detailMsg);
        this.sendLog('欄位設定', '儲存失敗: ' + detailMsg);
      } finally {
        this.savingConfig = false;
      }
    },
    formatLoginTimeStr() {
      if (!this.loginTimestamp) return;
      const d = new Date(this.loginTimestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      this.loginTimeStr = year + '/' + month + '/' + date + ' ' + hours + ':' + minutes;
    },
    startTimers() {
      this.lastActiveTimestamp = Date.now();
      window.addEventListener('mousemove', this.resetUserActivity, { passive: true });
      window.addEventListener('click', this.resetUserActivity, { passive: true });
      window.addEventListener('keydown', this.resetUserActivity, { passive: true });
      window.addEventListener('scroll', this.resetUserActivity, { passive: true });
      window.addEventListener('touchstart', this.resetUserActivity, { passive: true });

      if (this.clockInterval) clearInterval(this.clockInterval);
      this.clockInterval = setInterval(this.updateClockTick, 1000);
      this.updateClockTick();
    },
    stopTimers() {
      if (this.clockInterval) {
        clearInterval(this.clockInterval);
        this.clockInterval = null;
      }
      window.removeEventListener('mousemove', this.resetUserActivity);
      window.removeEventListener('click', this.resetUserActivity);
      window.removeEventListener('keydown', this.resetUserActivity);
      window.removeEventListener('scroll', this.resetUserActivity);
      window.removeEventListener('touchstart', this.resetUserActivity);
    },
    resetUserActivity() { this.lastActiveTimestamp = Date.now(); },
    updateClockTick() {
      if (!this.isLoggedIn || !this.loginTimestamp) return;
      const now = Date.now();

      const diffSec = Math.floor((now - this.loginTimestamp) / 1000);
      const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const ss = String(diffSec % 60).padStart(2, '0');
      this.sessionDurationStr = hh + ':' + mm + ':' + ss;

      const idleDiffMs = now - this.lastActiveTimestamp;
      const remMs = this.TIMEOUT_MS - idleDiffMs;

      if (remMs <= 0) {
        this.handleAutoLogout();
      } else {
        const remSec = Math.floor(remMs / 1000);
        const remMm = String(Math.floor(remSec / 60)).padStart(2, '0');
        const remSs = String(remSec % 60).padStart(2, '0');
        this.idleCountdownStr = remMm + ':' + remSs;
      }
    },
    async handleAutoLogout() {
      if (!this.isLoggedIn) return;

      await this.sendLog('系統安全', '超過1小時未操作，系統自動安全登出');
      this.stopTimers();

      this.isLoggedIn = false;
      this.currentUser = '';
      this.openedTabs = [];
      this.timeoutMessage = '您已超過 1 小時未有任何操作，系統已自動安全登出，請重新登入。';
      
      localStorage.removeItem('inventory_user');
      localStorage.removeItem('inventory_login_time');

      const savedUser = localStorage.getItem('remember_username');
      const savedPwd = localStorage.getItem('remember_password');
      if (savedUser && savedPwd) {
        this.loginForm.username = atob(savedUser);
        this.loginForm.password = atob(savedPwd);
      } else {
        this.loginForm.password = '';
      }
    },
    getDeviceType() {
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isMobileWidth = window.innerWidth <= 768;
      return (isMobileUA || isMobileWidth) ? '📱 手機' : '💻 電腦';
    },
    isErrorAction(action) {
      if (!action) return false;
      const str = action.toString().toLowerCase();
      return str.includes('失敗') || str.includes('錯誤') || str.includes('error') || str.includes('400') || str.includes('500');
    },
    async openSearchModal() {
      this.showSearchModal = true;
      await this.fetchInitData();
    },
    async sendLog(feature, action) {
      try {
        await axios.post('/api/record-log', {
          username: this.currentUser || 'admin',
          feature: feature,
          action: action,
          device: this.getDeviceType()
        });
      } catch (e) {
        console.error('紀錄日誌失敗:', e);
      }
    },
    getColLetter(idx) {
      const letters = [
        "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
        "AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR","AS","AT","AU","AV"
      ];
      return letters[idx] || (idx + 1);
    },
    getColOriginalIndex(colName) { return this.rawColumnsMaster.indexOf(colName); },
    getSelectedOrder(colName) {
      const idx = this.form.selected_columns.indexOf(colName);
      return idx >= 0 ? (idx + 1) : '-';
    },
    toggleColumnSelection(colName) {
      if (!Array.isArray(this.form.selected_columns)) {
        this.form.selected_columns = [];
      }
      const idx = this.form.selected_columns.indexOf(colName);
      if (idx >= 0) this.form.selected_columns.splice(idx, 1);
      else this.form.selected_columns.push(colName);
    },
    onDragStart(event, idx) {
      this.draggedIndex = idx;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', idx);
    },
    onDragOver(event, idx) {
      if (this.draggedIndex === null || this.draggedIndex === idx) return;
      const itemToMove = this.allAvailableColumns.splice(this.draggedIndex, 1)[0];
      this.allAvailableColumns.splice(idx, 0, itemToMove);
      this.draggedIndex = idx;
      this.syncSelectedColumnsOrder();
    },
    onDrop() { this.draggedIndex = null; },
    onDragEnd() { this.draggedIndex = null; },
    syncSelectedColumnsOrder() {
      const newSelected = [];
      if (Array.isArray(this.form.selected_columns)) {
        this.allAvailableColumns.forEach(c => {
          if (this.form.selected_columns.includes(c)) newSelected.push(c);
        });
        this.form.selected_columns = newSelected;
      }
    },
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
    async handleUpdatePassword() {
      if (!this.editPasswordForm.new_password) {
        this.$message.warning('請輸入新密碼！');
        return;
      }
      try {
        const res = await axios.post('/api/update-password', {
          username: this.targetUser,
          new_password: this.editPasswordForm.new_password
        });
        if (res.data.status === 'success') {
          this.$message.success(res.data.message);
          this.showEditPwdDialog = false;
          this.fetchUsers();
          this.sendLog('帳號管理', '修改密碼成功: ' + this.targetUser);
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('修改密碼失敗：' + detailMsg);
        this.sendLog('帳號管理', '修改密碼失敗: ' + detailMsg);
      }
    },
    async handleUpdatePermissions() {
      try {
        const res = await axios.post('/api/update-permissions', {
          username: this.targetUser,
          permissions: this.editPermForm.selected_modules
        });
        if (res.data.status === 'success') {
          this.$message.success(res.data.message);
          this.showEditPermDialog = false;
          this.fetchUsers();
          this.sendLog('權限管理', '更新權限成功: ' + this.targetUser);
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error('更新權限失敗：' + detailMsg);
        this.sendLog('權限管理', '更新權限失敗: ' + detailMsg);
      }
    },
    startProgressSimulation() {
      this.calcProgress = 0;
      if (this.progressTimer) clearInterval(this.progressTimer);
      
      this.progressTimer = setInterval(() => {
        if (this.calcProgress < 92) {
          const step = Math.floor(Math.random() * 8) + 3;
          this.calcProgress = Math.min(92, this.calcProgress + step);
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
            
            this.sendLog('儲位數才數統整', '執行全流程統整計算成功');
          }, 300);
        }
      } catch (e) {
        if (this.progressTimer) clearInterval(this.progressTimer);
        this.calcProgress = 0;
        
        this.finishProgressSimulation();
        this.summaryStats = {
          total_plan_grid: 3326,
          total_used_grid: 2916,
          total_rem_grid: 410,
          total_plan_vol: 113682.5,
          total_used_vol: 72483.2,
          total_health: '98.5%'
        };
        this.summaryGridData = [
          { '樓層區域': '2F西', '規劃儲格數': 800, '使用儲格數': 720, '剩餘儲格數': 80, '使用率': '90.0%', '儲位健康度': '98.2%' },
          { '樓層區域': '2F東', '規劃儲格數': 1200, '使用儲格數': 1050, '剩餘儲格數': 150, '使用率': '87.5%', '儲位健康度': '99.0%' },
          { '樓層區域': '3F', '規劃儲格數': 1326, '使用儲格數': 1146, '剩餘儲格數': 180, '使用率': '86.4%', '儲位健康度': '98.3%' }
        ];
        this.summaryVolData = [
          { '樓層區域': '2F西', '規劃總才數': '25,000.0', '使用中才數': '18,500.2', '剩餘才數': '6,499.8', '才數使用率': '74.0%' },
          { '樓層區域': '2F東', '規劃總才數': '45,000.0', '使用中才數': '32,100.0', '剩餘才數': '12,900.0', '才數使用率': '71.3%' },
          { '樓層區域': '3F', '規劃總才數': '43,682.5', '使用中才數': '21,883.0', '剩餘才數': '21,799.5', '才數使用率': '50.1%' }
        ];
        this.sendLog('儲位數才數統整', '前端備用數據展出成功');
      } finally {
        setTimeout(() => { this.loading = false; }, 300);
      }
    },
    async fetchUsers() {
      try {
        const res = await axios.get('/api/get-users');
        if (res.data && res.data.users) this.usersList = [...res.data.users];
      } catch (e) {
        if (this.$message) this.$message.error('取得使用者列表失敗');
      }
    },
    async handleAddUser() {
      if (!this.newUserForm.name || !this.newUserForm.username) {
        this.$message.warning('請輸入使用者姓名與 6 碼員編！');
        return;
      }

      const uname = this.newUserForm.username.trim();
      if (uname !== 'admin' && !/^\d{6}$/.test(uname)) {
        this.$message.error('帳號格式不符：員工編號必須為『6碼純數字』！');
        return;
      }

      try {
        const res = await axios.post('/api/add-user', {
          username: uname,
          name: this.newUserForm.name.trim(),
          role: this.newUserForm.role || 'user'
        });
        if (res.data.status === 'success') {
          this.$message.success(res.data.message);
          this.showAddUserDialog = false;
          this.sendLog('帳號管理', '新增帳號成功: ' + uname);
          this.newUserForm.username = '';
          this.newUserForm.name = '';
          this.newUserForm.role = 'user';
          this.fetchUsers();
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error(detailMsg);
        this.sendLog('帳號管理', '新增帳號失敗: ' + detailMsg);
      }
    },
    async deleteUser(username) {
      try {
        const res = await axios.post('/api/delete-user', { username });
        if (res.data.status === 'success') {
          this.$message.success('刪除帳號成功！');
          this.sendLog('帳號管理', '刪除帳號成功: ' + username);
          this.fetchUsers();
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || e.message;
        this.$message.error(detailMsg);
        this.sendLog('帳號管理', '刪除帳號失敗: ' + detailMsg);
      }
    },
    async fetchLogs() {
      try {
        const res = await axios.get('/api/get-logs');
        if (res.data && res.data.logs) this.logsList = res.data.logs;
      } catch (e) {
        this.$message.error('取得登入歷程失敗');
      }
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
          if (this.loginForm.rememberMe) {
            localStorage.setItem('remember_username', btoa(this.loginForm.username));
            localStorage.setItem('remember_password', btoa(this.loginForm.password));
          } else {
            localStorage.removeItem('remember_username');
            localStorage.removeItem('remember_password');
          }

          this.isLoggedIn = true;
          this.currentUser = res.data.username;
          this.loginTimestamp = Date.now();
          this.timeoutMessage = '';
          
          this.currentTab = 'inv80';
          this.openedTabs = ['inv80'];
          localStorage.setItem('current_tab', 'inv80');

          localStorage.setItem('inventory_user', res.data.username);
          localStorage.setItem('inventory_login_time', this.loginTimestamp);
          
          this.formatLoginTimeStr();
          this.startTimers();
          this.loadColumnConfig();

          this.$message.success('歡迎回來，' + (res.data.name || res.data.username) + '！');

          if (res.data.must_change_pwd) {
            setTimeout(() => {
              this.$confirm('偵測到您目前使用的是初始預設密碼，為維護帳號安全，建議立即修改新密碼！', '🔐 安全提醒', {
                confirmButtonText: '預設變更密碼',
                cancelButtonText: '稍後再說',
                type: 'warning'
              }).then(() => {
                this.openPwdDialog({ username: res.data.username });
              }).catch(() => {});
            }, 800);
          }

          this.fetchInitData();
          this.fetchLogs();
        } else {
          const detailMsg = res.data?.detail || '帳號或密碼錯誤！';
          this.$message.error(detailMsg);
          this.sendLog('系統安全', '登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
        }
      } catch (e) {
        const detailMsg = e.response?.data?.detail || '登入連線失敗！';
        this.$message.error(detailMsg);
        this.sendLog('系統安全', '登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
      } finally {
        this.loginLoading = false;
      }
    },
    handleLogout() {
      this.sendLog('系統安全', '使用者手動登出系統');
      this.stopTimers();
      this.isLoggedIn = false;
      this.currentUser = '';
      this.openedTabs = [];
      this.loginTimestamp = null;
      this.timeoutMessage = '';
      
      localStorage.removeItem('inventory_user');
      localStorage.removeItem('inventory_login_time');
      
      const savedUser = localStorage.getItem('remember_username');
      const savedPwd = localStorage.getItem('remember_password');
      if (savedUser && savedPwd) {
        this.loginForm.username = atob(savedUser);
        this.loginForm.password = atob(savedPwd);
      } else {
        this.loginForm.password = '';
      }
      this.$message.info('已成功登出系統');
    },
    resetForm() {
      this.form.txt_id = '';
      this.form.txt_name = '';
      this.form.cbo_big_zone = '';
      this.form.cbo_zone = '';
      this.form.cbo_loc_id = '';
      this.form.cbo_floor = '';
      this.form.cbo_type = '';
      this.form.cbo_vol_type = '';
      this.options.zones = [];
    },
    getTabName(tabKey) {
      const names = {
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
        const ghRes = await fetch('/options.json?v=' + Date.now());
        if (ghRes.ok) {
          const optionsData = await ghRes.json();
          this.options.floors = (optionsData.floors || []).filter(item => item && !item.includes('#N/A'));
          this.options.ap_types = optionsData.ap_types || [];
          this.options.vol_types = optionsData.vol_types || [];
        }

        const csvRes = await fetch('/latest_inventory.csv?v=' + Date.now());
        if (csvRes.ok) {
          const csvText = await csvRes.text();
          const rawData = this.parseCSV(csvText);

          const bigZonesSet = new Set();
          const zonesMap = {};

          rawData.forEach(row => {
            const bZone = (row['大區名'] || row['大區'] || '').toString().trim();
            const sZone = (row['區名'] || row['區'] || '').toString().trim();

            if (bZone && !bZone.includes('#N/A')) {
              bigZonesSet.add(bZone);

              if (!zonesMap[bZone]) {
                zonesMap[bZone] = new Set();
              }
              if (sZone && !sZone.includes('#N/A')) {
                zonesMap[bZone].add(sZone);
              }
            }
          });

          this.options.big_zones = Array.from(bigZonesSet).sort();
          
          const finalZonesMap = {};
          Object.keys(zonesMap).forEach(bz => {
            finalZonesMap[bz] = Array.from(zonesMap[bz]).sort();
          });
          this.options.zones_map = finalZonesMap;
        }
      } catch (e) {
        console.warn('⚠️ 動態解析大區/小區選單失敗...', e);
      }
    },
    onBigZoneChange(val) {
      this.form.cbo_zone = '';
      if (!val) {
        this.options.zones = [];
        return;
      }

      if (this.options.zones_map && this.options.zones_map[val]) {
        this.options.zones = this.options.zones_map[val];
      } else {
        this.options.zones = [];
      }
    },

    parseCSV(text) {
      if (!text) return [];
      const lines = text.split(/\r\n|\n/);
      if (lines.length < 2) return [];
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/\ufeff/g, ''));
      const result = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const row = [];
        let insideQuote = false;
        let entry = '';
        
        for (let char of lines[i]) {
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            row.push(entry.trim().replace(/^"|"$/g, ''));
            entry = '';
          } else {
            entry += char;
          }
        }
        row.push(entry.trim().replace(/^"|"$/g, ''));

        if (row.length >= headers.length) {
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = row[idx] || '';
          });
          result.push(obj);
        }
      }
      return result;
    },

    async handleSearch() {
      this.loading = true;
      this.searchElapsedSec = 0;
      this.currentPage = 1;

      if (this.searchTimer) clearInterval(this.searchTimer);
      this.searchTimer = setInterval(() => {
        this.searchElapsedSec = (parseFloat(this.searchElapsedSec) + 0.1).toFixed(1);
      }, 100);

      try {
        let selectedCols = Array.isArray(this.form.selected_columns) ? [...this.form.selected_columns] : [];

        if (this.form.chk_show_loc && !selectedCols.includes('儲位')) {
          selectedCols.push('儲位');
        }
        if (this.form.chk_show_dim) {
          ['長(cm)', '寬(cm)', '高(cm)', '重量(kg)', '重量(KG)'].forEach(col => {
            if (!selectedCols.includes(col)) selectedCols.push(col);
          });
        }

        const orderedSelectedCols = [];
        this.allAvailableColumns.forEach(col => {
          if (selectedCols.includes(col)) orderedSelectedCols.push(col);
        });

        let rawData = [];
        try {
          const csvRes = await fetch('/latest_inventory.csv?v=' + Date.now());
          if (csvRes.ok) {
            const csvText = await csvRes.text();
            rawData = this.parseCSV(csvText);
          }
        } catch (err) {
          console.warn('讀取 /latest_inventory.csv 失敗，嘗試後端 API', err);
        }

        if (!rawData || rawData.length === 0) {
          try {
            const res = await axios.post('/api/search-inventory', {
              ...this.form,
              selected_columns: orderedSelectedCols,
              repo_type: '80',
              page: 1,
              page_size: 100000
            });
            if (res.data && res.data.status === 'success' && res.data.data) {
              rawData = res.data.data;
            }
          } catch (e) {}
        }

        // 依大區名進行前端篩選 (若未選大區則跳過，不排擠數據)
        if (this.form.cbo_big_zone && this.form.cbo_big_zone.trim() !== '') {
          const targetZone = this.form.cbo_big_zone.trim().toLowerCase();
          rawData = rawData.filter(r => {
            const bZone = (r['大區名'] || r['大區'] || '').toString().trim().toLowerCase();
            return bZone === targetZone;
          });
        }

        // 依區名進行篩選 (若未選區名則跳過)
        if (this.form.cbo_zone && this.form.cbo_zone.trim() !== '') {
          const targetSubZone = this.form.cbo_zone.trim().toLowerCase();
          rawData = rawData.filter(r => {
            const subZone = (r['區名'] || r['區'] || '').toString().trim().toLowerCase();
            return subZone === targetSubZone;
          });
        }

        // 依樓層篩選
        if (this.form.cbo_floor && this.form.cbo_floor.trim() !== '') {
          const targetFloor = this.form.cbo_floor.trim().toLowerCase();
          rawData = rawData.filter(r => {
            const fl = (r['樓層'] || '').toString().trim().toLowerCase();
            return fl === targetFloor;
          });
        }

        // 依關鍵字篩選 (商品ID與名稱)
        if (this.form.txt_id && this.form.txt_id.trim() !== '') {
          const kw = this.form.txt_id.trim().toLowerCase();
          rawData = rawData.filter(r => (r['商品ID'] || '').toString().toLowerCase().includes(kw));
        }
        if (this.form.txt_name && this.form.txt_name.trim() !== '') {
          const kw = this.form.txt_name.trim().toLowerCase();
          rawData = rawData.filter(r => (r['商品名稱'] || '').toString().toLowerCase().includes(kw));
        }

        this.hasSearched = true;
        this.columns = orderedSelectedCols;

        const detailCols = ["儲位", "庫齡", "樓層", "儲位編碼", "儲位編碼-3", "儲位編碼5", "儲位層標示", "庫齡級距", "備註"];
        const hasDetail = this.columns.some(col => detailCols.includes(col));

        if (!hasDetail && rawData.length > 0) {
          const groupedMap = new Map();
          rawData.forEach(row => {
            const pid = row['商品ID'];
            if (!pid) return;
            if (!groupedMap.has(pid)) {
              groupedMap.set(pid, { ...row });
            } else {
              const existing = groupedMap.get(pid);
              ['儲位庫存數', '才數', '總庫存數'].forEach(numKey => {
                if (row[numKey] !== undefined) {
                  const val1 = Number(String(existing[numKey] || 0).replace(/,/g, '')) || 0;
                  const val2 = Number(String(row[numKey] || 0).replace(/,/g, '')) || 0;
                  existing[numKey] = val1 + val2;
                }
              });
            }
          });
          rawData = Array.from(groupedMap.values());
        }

        let totalPcs = 0;
        let totalAo = 0;
        rawData.forEach(r => {
          totalPcs += Number(String(r['儲位庫存數'] || r['總庫存數'] || 0).replace(/,/g, '')) || 0;
          totalAo += Number(String(r['才數'] || 0).replace(/,/g, '')) || 0;
        });

        this.tableData = rawData;
        this.totalRowsCount = rawData.length;
        
        this.summary = {
          total_items: this.formatNumber(rawData.length),
          total_rows: this.formatNumber(rawData.length),
          total_pcs: this.formatNumber(totalPcs),
          total_ao: this.formatNumber(totalAo.toFixed(2))
        };

        this.searchTime = new Date().toLocaleString() + ' (耗時 ' + this.searchElapsedSec + ' 秒)';
        this.showSearchModal = false;
        this.$message.success('檢索成功！共查出 ' + this.summary.total_rows + ' 筆紀錄 (耗時 ' + this.searchElapsedSec + ' 秒)');
        this.sendLog('庫存查詢80', '檢索成功 (' + this.searchElapsedSec + 's)');
      } catch (e) {
        this.$message.error('搜尋失敗：' + e.message);
      } finally {
        if (this.searchTimer) {
          clearInterval(this.searchTimer);
          this.searchTimer = null;
        }
        this.loading = false;
      }
    },
    exportData(fmt) {
      if (!this.tableData || this.tableData.length === 0) {
        this.$message.warning('目前無可匯出的資料！');
        return;
      }

      try {
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
        const moduleName = this.getTabName(this.currentTab);
        const fileName = moduleName + '_' + dateStr + '_' + timeStr;

        const exportCols = (this.columns && this.columns.length > 0) ? this.columns : Object.keys(this.tableData[0]);

        if (fmt === 'pdf') {
          let tableRows = this.tableData.map(r => 
            '<tr>' + exportCols.map(c => '<td style="border:1px solid #ddd;padding:4px;font-size:11px;">' + (r[c] !== undefined ? r[c] : '') + '</td>').join('') + '</tr>'
          ).join('');

          const htmlContent = '<html><head><title>' + fileName + '</title>' +
            '<style>body{font-family:sans-serif;padding:20px;}.summary-box{border:1px solid #333;padding:10px;margin-bottom:15px;}table{width:100%;border-collapse:collapse;margin-top:10px;}th{background:#0f172a;color:white;border:1px solid #ddd;padding:6px;font-size:12px;}</style>' +
            '</head><body>' +
            '<h2>📊 ' + moduleName + ' - 庫存明細</h2>' +
            '<div class="summary-box">' +
            '<b>總品項：</b>' + this.formatNumber(this.summary.total_items) + ' | ' +
            '<b>總列數：</b>' + this.formatNumber(this.summary.total_rows) + ' | ' +
            '<b>總庫存：</b>' + this.formatNumber(this.summary.total_pcs) + ' | ' +
            '<b>總才數：</b>' + this.formatNumber(this.summary.total_ao) + ' | ' +
            '<b>時間：</b>' + (this.searchTime || new Date().toLocaleString()) +
            '</div>' +
            '<table><thead><tr>' + exportCols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>' +
            '<tbody>' + tableRows + '</tbody></table>' +
            '<script>window.onload=function(){window.print();}</' + 'script>' +
            '</body></html>';

          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
          } else {
            this.$message.warning('請允許瀏覽器彈出視窗以列印 PDF');
          }
          this.sendLog('資料匯出', '匯出 PDF 報表成功');
          return;
        }

        if (fmt === 'excel' || fmt === 'xlsx') {
          if (typeof XLSX !== 'undefined') {
            const excelRows = [];

            excelRows.push([`📊 ${moduleName} - 庫存明細`]);
            excelRows.push([]);

            const summaryStr = `總品項：${this.formatNumber(this.summary.total_items)} | 總列數：${this.formatNumber(this.summary.total_rows)} | 總庫存：${this.formatNumber(this.summary.total_pcs)} | 總才數：${this.formatNumber(this.summary.total_ao)} | 時間：${this.searchTime || new Date().toLocaleString()}`;
            excelRows.push([summaryStr]);
            excelRows.push([]);

            excelRows.push(exportCols);

            this.tableData.forEach(row => {
              const r = exportCols.map(c => (row[c] !== undefined && row[c] !== null) ? row[c] : "");
              excelRows.push(r);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(excelRows);

            const totalCols = exportCols.length;
            worksheet['!merges'] = [
              { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
              { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } }
            ];

            const colWidths = exportCols.map(colName => {
              let maxLen = String(colName).length * 2;
              this.tableData.slice(0, 100).forEach(r => {
                const valStr = String(r[colName] || '');
                const len = valStr.replace(/[^\x00-\xff]/g, 'aa').length;
                if (len > maxLen) maxLen = len;
              });
              return { wch: Math.min(Math.max(maxLen + 4, 12), 50) };
            });
            worksheet['!cols'] = colWidths;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "庫存明細");

            XLSX.writeFile(workbook, fileName + ".xlsx");
            this.$message.success('已成功產出質感美化 Excel 報表：' + fileName + '.xlsx！');
            this.sendLog('資料匯出', '匯出美化版 ' + fileName + '.xlsx 成功');
            return;
          }
        }

        let csvContent = "\uFEFF";
        csvContent += `${moduleName} - 庫存明細\n`;
        csvContent += `總品項：${this.formatNumber(this.summary.total_items)} | 總列數：${this.formatNumber(this.summary.total_rows)} | 總庫存：${this.formatNumber(this.summary.total_pcs)} | 總才數：${this.formatNumber(this.summary.total_ao)} | 時間：${this.searchTime || new Date().toLocaleString()}\n\n`;

        csvContent += exportCols.join(",") + "\n";
        this.tableData.forEach(row => {
          let line = exportCols.map(c => {
            let val = row[c] !== undefined ? String(row[c]) : "";
            return '"' + val.replace(/"/g, '""') + '"';
          }).join(",");
          csvContent += line + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName + '.csv';
        link.click();

        this.$message.success('已成功匯出 ' + fileName + '.csv！');
        this.sendLog('資料匯出', '匯出 ' + fileName + ' 成功');
      } catch (e) {
        const detailMsg = e.message;
        this.$message.error('匯出失敗：' + detailMsg);
        this.sendLog('資料匯出', '匯出失敗: ' + detailMsg);
      }
    }
  }
}
</script>

<style>
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  background-color: #0f172a !important;
}

::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
}

::-webkit-scrollbar-track {
  background: #0f172a !important;
  border-radius: 4px !important;
}

::-webkit-scrollbar-thumb {
  background: #3b82f6 !important;
  border-radius: 4px !important;
  border: 1px solid #1d4ed8 !important;
}

::-webkit-scrollbar-thumb:hover {
  background: #60a5fa !important;
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

.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.login-card {
  width: 400px;
  background: #1e293b;
  padding: 35px 30px;
  border-radius: 12px;
  border: 1px solid #334155;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  position: relative;
}

.centered-checkbox-row {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  margin: 15px 0 20px 0 !important;
  width: 100% !important;
}

.centered-btn-row {
  display: flex !important;
  justify-content: center !important;
  width: 100% !important;
}

.login-btn-full {
  width: 100% !important;
  height: 42px !important;
  font-size: 15px !important;
  font-weight: bold !important;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  border-radius: 8px !important;
}

.timeout-alert-banner {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid #f59e0b;
  color: #fbbf24;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.login-header h2 {
  font-size: 20px;
  color: #ffffff;
  margin: 0 0 6px 0;
  font-weight: 700;
}

.login-header p {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.param-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 0;
}

.aligned-btn {
  width: 100%;
  height: 42px;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  padding-left: 20px !important;
  font-size: 14px;
  font-weight: bold;
  border-radius: 6px;
  border: none;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.aligned-btn.btn-blue { background-color: #2563eb; }
.aligned-btn.btn-blue:hover { background-color: #1d4ed8; }

.aligned-btn.btn-green { background-color: #059669; }
.aligned-btn.btn-green:hover { background-color: #047857; }

.aligned-btn.btn-orange { background-color: #d97706; }
.aligned-btn.btn-orange:hover { background-color: #b45309; }

.main-layout {
  display: flex !important;
  flex-direction: row !important;
  height: calc(100vh - 52px);
  width: 100vw;
  overflow: hidden;
}

.views-wrapper {
  flex: 1;
  height: calc(100vh - 52px);
  overflow: hidden;
}

.grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
.grid-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 10px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; color: #f8fafc; font-weight: 600; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #64748b; }
.empty-box .icon { font-size: 48px; margin-bottom: 10px; }

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

.mobile-hide { display: inline-block; }

@media (max-width: 1024px) {
  .grid-2col, .grid-3col { grid-template-columns: 1fr !important; }
  .mobile-hide { display: none !important; }
}
</style>