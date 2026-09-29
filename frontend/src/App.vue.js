import axios from 'axios';
export default (await import('vue')).defineComponent({
    name: 'App',
    data() {
        return {
            isLoggedIn: false,
            currentUser: '',
            loginLoading: false,
            savingConfig: false,
            showUnifiedDrawer: false,
            showSearchModal: false,
            searchTimer: null,
            searchElapsedSec: 0,
            loginForm: {
                username: '',
                password: '',
                rememberMe: true
            },
            currentTab: 'inv80',
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
            summaryGridData: [],
            summaryVolData: [],
            areaGridTable: [],
            areaVolTable: [],
            summaryStats: {
                total_plan_grid: 0,
                total_used_grid: 0,
                total_rem_grid: 0,
                total_plan_vol: 0,
                total_used_vol: 0,
                total_health: '0.0%'
            },
            showColSettingDialog: false,
            showEditRoleDialog: false,
            showEditPwdDialog: false,
            showEditPermDialog: false,
            targetUser: '',
            editRoleForm: {
                target_name: '',
                target_role: 'user'
            },
            editPasswordForm: {
                new_password: ''
            },
            editPermForm: {
                selected_modules: []
            },
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
                "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
                "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", "才數", "材積別", "儲位編碼-3",
                "儲位編碼", "儲位編碼5", "樓層", "樓層區域", "儲位型態", "大區編", "大區名", "三邊長", "最長邊",
                "最短邊", "儲位才數", "儲位健康度", "不符合", "材積判斷", "才數.1", "人工/自動", "儲位層標示",
                "庫齡級距", "樓層設定", "重型架判斷", "ID指定樓層", "備註"
            ],
            allAvailableColumns: [
                "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
                "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", "(近)90日-有揀貨單天數",
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
                selected_columns: [
                    "商品ID", "商品名稱", "借/採", "儲位庫存數", "庫齡",
                    "區編", "區名", "館編", "館名", "大區名", "樓層"
                ],
                chk_show_loc: true,
                chk_show_dim: false,
                cbo_sort: '商品ID',
                sort_order: 'desc'
            },
            options: {
                big_zones: [],
                zones_map: {},
                zones: [],
                floors: [],
                ap_types: [],
                vol_types: []
            },
            summary: {
                total_items: 0,
                total_rows: 0,
                total_pcs: 0,
                total_ao: 0
            },
            columns: [],
            tableData: [],
            usersList: [],
            logsList: [],
            showAddUserDialog: false,
            newUserForm: {
                username: '',
                name: '',
                role: 'user'
            }
        };
    },
    computed: {
        isAdmin() {
            return this.currentUser === 'admin';
        },
        filteredLogsList() {
            if (this.logTab === 'error') {
                return this.logsList.filter(row => this.isErrorAction(row.action));
            }
            return this.logsList.filter(row => !this.isErrorAction(row.action));
        }
    },
    mounted() {
        const savedTab = localStorage.getItem('current_tab');
        if (savedTab) {
            this.currentTab = savedTab;
        }
        const savedUser = localStorage.getItem('remember_username');
        const savedPwd = localStorage.getItem('remember_password');
        if (savedUser && savedPwd) {
            this.loginForm.username = atob(savedUser);
            this.loginForm.password = atob(savedPwd);
            this.loginForm.rememberMe = true;
        }
        const currentLoggedInUser = localStorage.getItem('inventory_user');
        const savedLoginTime = localStorage.getItem('inventory_login_time');
        if (currentLoggedInUser) {
            this.isLoggedIn = true;
            this.currentUser = currentLoggedInUser;
            if (savedLoginTime) {
                this.loginTimestamp = parseInt(savedLoginTime, 10);
            }
            else {
                this.loginTimestamp = Date.now();
                localStorage.setItem('inventory_login_time', this.loginTimestamp);
            }
            this.formatLoginTimeStr();
            this.startTimers();
            this.loadColumnConfig();
            if (this.currentTab === 'inv80') {
                this.fetchInitData();
            }
            else if (this.currentTab === 'loc_summary') {
                this.handleSummaryCalc();
            }
            else if (this.currentTab === 'settings_perm') {
                this.fetchUsers();
            }
        }
        this.fetchUsers();
        this.fetchLogs();
    },
    beforeUnmount() {
        this.stopTimers();
        if (this.progressTimer)
            clearInterval(this.progressTimer);
        if (this.searchTimer)
            clearInterval(this.searchTimer);
    },
    methods: {
        formatNumber(val) {
            if (val === null || val === undefined || val === '')
                return '0';
            const num = Number(String(val).replace(/,/g, ''));
            return isNaN(num) ? val : num.toLocaleString();
        },
        async handleBatchUsersUpload(event) {
            const file = event.target.files[0];
            if (!file)
                return;
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
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail || e.message;
                this.$message.error('批次匯入失敗：' + detailMsg);
                this.sendLog('帳號管理', '批次匯入失敗: ' + detailMsg);
            }
            finally {
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
            }
            catch (e) {
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
                link.download = '帳號權限清單_' + new Date().toISOString().slice(0, 10) + '.xlsx';
                link.click();
                this.$message.success('已成功匯出帳號與權限清單！');
                this.sendLog('帳號管理', '匯出帳號與權限 Excel 清單');
            }
            catch (e) {
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
                        this.form.selected_columns = [...res.data.selected_columns];
                    }
                }
            }
            catch (e) {
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
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail || e.message;
                this.$message.error('儲存失敗：' + detailMsg);
                this.sendLog('欄位設定', '儲存失敗: ' + detailMsg);
            }
            finally {
                this.savingConfig = false;
            }
        },
        formatLoginTimeStr() {
            if (!this.loginTimestamp)
                return;
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
            if (this.clockInterval)
                clearInterval(this.clockInterval);
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
        resetUserActivity() {
            this.lastActiveTimestamp = Date.now();
        },
        updateClockTick() {
            if (!this.isLoggedIn || !this.loginTimestamp)
                return;
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
            }
            else {
                const remSec = Math.floor(remMs / 1000);
                const remMm = String(Math.floor(remSec / 60)).padStart(2, '0');
                const remSs = String(remSec % 60).padStart(2, '0');
                this.idleCountdownStr = remMm + ':' + remSs;
            }
        },
        async handleAutoLogout() {
            if (!this.isLoggedIn)
                return;
            await this.sendLog('系統安全', '超過1小時未操作，系統自動安全登出');
            this.stopTimers();
            this.isLoggedIn = false;
            this.currentUser = '';
            localStorage.removeItem('inventory_user');
            localStorage.removeItem('inventory_login_time');
            const savedUser = localStorage.getItem('remember_username');
            const savedPwd = localStorage.getItem('remember_password');
            if (savedUser && savedPwd) {
                this.loginForm.username = atob(savedUser);
                this.loginForm.password = atob(savedPwd);
            }
            else {
                this.loginForm.password = '';
            }
            this.$alert('您已超過 1 小時未有任何操作，系統已為您自動安全登出。', '系統提示', {
                confirmButtonText: '重新登入',
                type: 'warning'
            });
        },
        getDeviceType() {
            const ua = navigator.userAgent || '';
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isMobileWidth = window.innerWidth <= 768;
            return (isMobileUA || isMobileWidth) ? '📱 手機' : '💻 電腦';
        },
        isErrorAction(action) {
            if (!action)
                return false;
            const str = action.toString().toLowerCase();
            return str.includes('失敗') || str.includes('錯誤') || str.includes('error') || str.includes('400') || str.includes('500') || str.includes('404') || str.includes('503');
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
            }
            catch (e) {
                console.error('紀錄日誌失敗:', e);
            }
        },
        getColWidth(colName) {
            if (!colName)
                return 110;
            const col = colName.toString().trim();
            if (col.includes('商品名稱') || col.includes('備註') || col.includes('供應商名稱')) {
                return 320;
            }
            if (col.includes('商品ID') || col.includes('儲位') || col.includes('編碼') || col.includes('三邊長') || col.includes('PM')) {
                return 180;
            }
            if (col.includes('樓層') || col.includes('借/採') || col.includes('庫齡') || col === '區編' || col === '館編') {
                return 90;
            }
            return 130;
        },
        getColLetter(idx) {
            const letters = [
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
                "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV"
            ];
            return letters[idx] || (idx + 1);
        },
        getColOriginalIndex(colName) {
            return this.rawColumnsMaster.indexOf(colName);
        },
        getSelectedOrder(colName) {
            const idx = this.form.selected_columns.indexOf(colName);
            return idx >= 0 ? (idx + 1) : '-';
        },
        toggleColumnSelection(colName) {
            const idx = this.form.selected_columns.indexOf(colName);
            if (idx >= 0) {
                this.form.selected_columns.splice(idx, 1);
            }
            else {
                this.form.selected_columns.push(colName);
            }
        },
        onDragStart(event, idx) {
            this.draggedIndex = idx;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', idx);
        },
        onDragOver(event, idx) {
            if (this.draggedIndex === null || this.draggedIndex === idx)
                return;
            const itemToMove = this.allAvailableColumns.splice(this.draggedIndex, 1)[0];
            this.allAvailableColumns.splice(idx, 0, itemToMove);
            this.draggedIndex = idx;
            this.syncSelectedColumnsOrder();
        },
        onDrop() {
            this.draggedIndex = null;
        },
        onDragEnd() {
            this.draggedIndex = null;
        },
        syncSelectedColumnsOrder() {
            const newSelected = [];
            this.allAvailableColumns.forEach(c => {
                if (this.form.selected_columns.includes(c)) {
                    newSelected.push(c);
                }
            });
            this.form.selected_columns = newSelected;
        },
        selectAllCols() {
            this.form.selected_columns = [...this.allAvailableColumns];
        },
        unselectAllCols() {
            this.form.selected_columns = [];
        },
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
            }
            catch (e) {
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
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail || e.message;
                this.$message.error('更新權限失敗：' + detailMsg);
                this.sendLog('權限管理', '更新權限失敗: ' + detailMsg);
            }
        },
        startProgressSimulation() {
            this.calcProgress = 0;
            if (this.progressTimer)
                clearInterval(this.progressTimer);
            this.progressTimer = setInterval(() => {
                if (this.calcProgress < 92) {
                    const step = Math.floor(Math.random() * 8) + 3;
                    this.calcProgress = Math.min(92, this.calcProgress + step);
                }
            }, 200);
        },
        finishProgressSimulation() {
            if (this.progressTimer)
                clearInterval(this.progressTimer);
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
            }
            catch (e) {
                if (this.progressTimer)
                    clearInterval(this.progressTimer);
                this.calcProgress = 0;
                const detailMsg = e.response?.data?.detail
                    ? (typeof e.response.data.detail === 'object' ? JSON.stringify(e.response.data.detail) : e.response.data.detail)
                    : e.message;
                this.$message.error('計算失敗：' + detailMsg);
                this.sendLog('儲位數才數統整', '計算失敗：' + detailMsg);
            }
            finally {
                setTimeout(() => {
                    this.loading = false;
                }, 300);
            }
        },
        tableRowStyle({ row }) {
            if (row.is_total)
                return 'grandtotal-row-dark';
            if (row.is_subtotal)
                return 'subtotal-row-dark';
            return '';
        },
        getHealthClass(val) {
            if (!val || val === '-')
                return '';
            const num = parseFloat(val);
            if (num > 90)
                return 'text-danger';
            if (num > 75)
                return 'text-warning';
            return 'text-success';
        },
        handleSettingsCommand(cmd) {
            if (cmd === 'cols') {
                this.showColSettingDialog = true;
                this.sendLog('庫存查詢80', '開啟一般模式顯示欄位設定彈窗');
            }
            else if (cmd === 'perm') {
                this.switchTab('settings_perm');
            }
            else if (cmd === 'log') {
                this.switchTab('settings_log');
            }
        },
        async fetchUsers() {
            try {
                const res = await axios.get('/api/get-users');
                if (res.data && res.data.users) {
                    this.usersList = [...res.data.users];
                }
            }
            catch (e) {
                if (this.$message) {
                    this.$message.error('取得使用者列表失敗');
                }
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
            }
            catch (e) {
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
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail || e.message;
                this.$message.error(detailMsg);
                this.sendLog('帳號管理', '刪除帳號失敗: ' + detailMsg);
            }
        },
        async fetchLogs() {
            try {
                const res = await axios.get('/api/get-logs');
                if (res.data && res.data.logs) {
                    this.logsList = res.data.logs;
                }
            }
            catch (e) {
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
                    }
                    else {
                        localStorage.removeItem('remember_username');
                        localStorage.removeItem('remember_password');
                    }
                    this.isLoggedIn = true;
                    this.currentUser = res.data.username;
                    this.loginTimestamp = Date.now();
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
                            }).catch(() => { });
                        }, 800);
                    }
                    if (this.currentTab === 'inv80') {
                        this.fetchInitData();
                    }
                    else if (this.currentTab === 'loc_summary') {
                        this.handleSummaryCalc();
                    }
                    else if (this.currentTab === 'settings_perm') {
                        this.fetchUsers();
                    }
                    this.fetchLogs();
                }
                else {
                    const detailMsg = res.data?.detail || '帳號或密碼錯誤！';
                    this.$message.error(detailMsg);
                    this.sendLog('系統安全', '登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
                }
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail || '登入連線失敗！';
                this.$message.error(detailMsg);
                this.sendLog('系統安全', '登入失敗 (' + this.loginForm.username + '): ' + detailMsg);
            }
            finally {
                this.loginLoading = false;
            }
        },
        handleLogout() {
            this.sendLog('系統安全', '使用者手動登出系統');
            this.stopTimers();
            this.isLoggedIn = false;
            this.currentUser = '';
            this.loginTimestamp = null;
            localStorage.removeItem('inventory_user');
            localStorage.removeItem('inventory_login_time');
            const savedUser = localStorage.getItem('remember_username');
            const savedPwd = localStorage.getItem('remember_password');
            if (savedUser && savedPwd) {
                this.loginForm.username = atob(savedUser);
                this.loginForm.password = atob(savedPwd);
            }
            else {
                this.loginForm.password = '';
            }
            this.$message.info('已成功登出系統');
        },
        switchTab(tabKey) {
            if (this.currentTab === tabKey)
                return;
            this.currentTab = tabKey;
            localStorage.setItem('current_tab', tabKey);
            this.hasSearched = false;
            this.tableData = [];
            this.sendLog('選單切換', '切換至頁籤: ' + this.getTabName(tabKey));
            if (tabKey === 'loc_summary') {
                this.handleSummaryCalc();
            }
            else if (tabKey === 'inv80') {
                this.resetForm();
                this.fetchInitData();
            }
            else if (tabKey === 'settings_perm') {
                this.fetchUsers();
            }
            else if (tabKey === 'settings_log') {
                this.fetchLogs();
            }
            else if (!tabKey.startsWith('settings_')) {
                if (this.$message) {
                    this.$message.info('【' + this.getTabName(tabKey) + '】功能尚在開發中！');
                }
            }
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
                    if (optionsData.big_zones && optionsData.big_zones.length > 0) {
                        this.options.big_zones = (optionsData.big_zones || []).filter(item => item && !item.includes('#N/A'));
                        this.options.zones_map = optionsData.zones_map || {};
                        this.options.floors = (optionsData.floors || []).filter(item => item && !item.includes('#N/A'));
                        this.options.ap_types = optionsData.ap_types || [];
                        this.options.vol_types = optionsData.vol_types || [];
                        return;
                    }
                }
            }
            catch (e) {
                console.warn('⚠️ options.json 讀取失敗...', e);
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
            }
            else {
                this.options.zones = [];
            }
        },
        async handleSearch() {
            this.loading = true;
            this.searchElapsedSec = 0;
            if (this.searchTimer)
                clearInterval(this.searchTimer);
            this.searchTimer = setInterval(() => {
                this.searchElapsedSec = (parseFloat(this.searchElapsedSec) + 0.1).toFixed(1);
            }, 100);
            try {
                const orderedSelectedCols = [];
                this.allAvailableColumns.forEach(col => {
                    if (this.form.selected_columns.includes(col)) {
                        orderedSelectedCols.push(col);
                    }
                });
                const searchPayload = {
                    ...this.form,
                    selected_columns: orderedSelectedCols,
                    repo_type: '80'
                };
                const res = await axios.post('/api/search-inventory', searchPayload);
                if (res.data && res.data.status === 'success') {
                    this.hasSearched = true;
                    this.summary = res.data.summary;
                    if (res.data.columns && res.data.columns.length > 0) {
                        this.columns = res.data.columns;
                    }
                    else {
                        this.columns = orderedSelectedCols;
                    }
                    this.tableData = res.data.data;
                    this.searchTime = new Date().toLocaleString() + ' (耗時 ' + this.searchElapsedSec + ' 秒)';
                    this.showSearchModal = false;
                    this.$message.success('檢索成功！共查出 ' + (res.data.summary?.total_rows || 0) + ' 筆紀錄 (耗時 ' + this.searchElapsedSec + ' 秒)');
                    this.sendLog('庫存查詢80', '檢索成功 (' + this.searchElapsedSec + 's)');
                }
            }
            catch (e) {
                const detailMsg = e.response?.data?.detail
                    ? (typeof e.response.data.detail === 'object' ? JSON.stringify(e.response.data.detail) : e.response.data.detail)
                    : e.message;
                this.$message.error('搜尋失敗：' + detailMsg);
                this.sendLog('庫存查詢80', '檢索失敗：' + detailMsg);
            }
            finally {
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
                const exportCols = this.columns && this.columns.length > 0 ? this.columns : Object.keys(this.tableData[0]);
                if (fmt === 'pdf') {
                    let tableRows = this.tableData.map(r => '<tr>' + exportCols.map(c => '<td style="border:1px solid #ddd;padding:4px;font-size:11px;">' + (r[c] !== undefined ? r[c] : '') + '</td>').join('') + '</tr>').join('');
                    const htmlContent = '<html><head><title>庫存檢索報表 PDF</title>' +
                        '<style>body{font-family:sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;margin-top:10px;}th{background:#0f172a;color:white;border:1px solid #ddd;padding:6px;font-size:12px;}</style>' +
                        '</head><body>' +
                        '<h2>📦 庫存查詢 80 分析報表</h2>' +
                        '<p>匯出時間：' + new Date().toLocaleString() + ' | 筆數：' + this.tableData.length + ' 筆</p>' +
                        '<table><thead><tr>' + exportCols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>' +
                        '<tbody>' + tableRows + '</tbody></table>' +
                        '<script>window.onload=function(){window.print();}</' + 'script>' +
                        '</body></html>';
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                    }
                    else {
                        this.$message.warning('請允許瀏覽器彈出視窗以列印 PDF');
                    }
                    this.sendLog('資料匯出', '匯出 PDF 報表成功');
                    return;
                }
                let csvContent = "\uFEFF" + exportCols.join(",") + "\n";
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
                link.download = 'Inventory_Export_' + new Date().toISOString().slice(0, 10) + '.' + (fmt === 'excel' ? 'csv' : fmt);
                link.click();
                this.$message.success('已成功匯出 ' + fmt.toUpperCase() + ' 報表！');
                this.sendLog('資料匯出', '匯出 ' + fmt.toUpperCase() + ' 報表成功');
            }
            catch (e) {
                const detailMsg = e.message;
                this.$message.error('匯出失敗：' + detailMsg);
                this.sendLog('資料匯出', '匯出失敗 (' + fmt.toUpperCase() + '): ' + detailMsg);
            }
        }
    }
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-section']} */ ;
/** @type {__VLS_StyleScopedClasses['user-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['user-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['user-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['user-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['setting']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['col-setting-header-info']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-drag-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-drag-item']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-readonly-item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-drag-item']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['order-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__fixed-left']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__fixed-left']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['el-table__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['dual-column-row']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-only-section']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['right-block']} */ ;
/** @type {__VLS_StyleScopedClasses['navbar-center-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['el-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-3col']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-hide']} */ ;
/** @type {__VLS_StyleScopedClasses['top-navbar']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['login-form']} */ ;
/** @type {__VLS_StyleScopedClasses['login-form']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    id: "app",
    ...{ class: "app-container dark-mode" },
});
if (!__VLS_ctx.isLoggedIn) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "login-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "login-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "login-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "logo-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    const __VLS_0 = {}.ElForm;
    /** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onSubmit': {} },
        model: (__VLS_ctx.loginForm),
        labelWidth: "70px",
        ...{ class: "login-form" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onSubmit': {} },
        model: (__VLS_ctx.loginForm),
        labelWidth: "70px",
        ...{ class: "login-form" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_4;
    let __VLS_5;
    let __VLS_6;
    const __VLS_7 = {
        onSubmit: (__VLS_ctx.handleLogin)
    };
    __VLS_3.slots.default;
    const __VLS_8 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        label: "帳號",
    }));
    const __VLS_10 = __VLS_9({
        label: "帳號",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    const __VLS_12 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        modelValue: (__VLS_ctx.loginForm.username),
        placeholder: "請輸入 6 碼員編",
        prefixIcon: "User",
        clearable: true,
    }));
    const __VLS_14 = __VLS_13({
        modelValue: (__VLS_ctx.loginForm.username),
        placeholder: "請輸入 6 碼員編",
        prefixIcon: "User",
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    var __VLS_11;
    const __VLS_16 = {}.ElFormItem;
    /** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        label: "密碼",
    }));
    const __VLS_18 = __VLS_17({
        label: "密碼",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_19.slots.default;
    const __VLS_20 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.loginForm.password),
        type: "password",
        placeholder: "請輸入密碼 (初登入預設同員編)",
        showPassword: true,
        prefixIcon: "Lock",
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.loginForm.password),
        type: "password",
        placeholder: "請輸入密碼 (初登入預設同員編)",
        showPassword: true,
        prefixIcon: "Lock",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_24;
    let __VLS_25;
    let __VLS_26;
    const __VLS_27 = {
        onKeyup: (__VLS_ctx.handleLogin)
    };
    var __VLS_23;
    var __VLS_19;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    const __VLS_28 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        modelValue: (__VLS_ctx.loginForm.rememberMe),
        ...{ style: {} },
    }));
    const __VLS_30 = __VLS_29({
        modelValue: (__VLS_ctx.loginForm.rememberMe),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_31.slots.default;
    var __VLS_31;
    const __VLS_32 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "login-btn-full" },
        loading: (__VLS_ctx.loginLoading),
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick': {} },
        type: "primary",
        ...{ class: "login-btn-full" },
        loading: (__VLS_ctx.loginLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        onClick: (__VLS_ctx.handleLogin)
    };
    __VLS_35.slots.default;
    var __VLS_35;
    var __VLS_3;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "app-main-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
        ...{ class: "top-navbar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "navbar-brand" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "brand-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "brand-version" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "navbar-center-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "center-title-text" },
    });
    (__VLS_ctx.getTabName(__VLS_ctx.currentTab));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "top-right-actions" },
    });
    if (__VLS_ctx.currentTab === 'loc_summary' && (__VLS_ctx.summaryGridData.length > 0 || __VLS_ctx.areaGridTable.length > 0)) {
        const __VLS_40 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            ...{ 'onClick': {} },
            type: "success",
            size: "medium",
            icon: "Download",
            ...{ class: "header-export-btn" },
        }));
        const __VLS_42 = __VLS_41({
            ...{ 'onClick': {} },
            type: "success",
            size: "medium",
            icon: "Download",
            ...{ class: "header-export-btn" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        let __VLS_44;
        let __VLS_45;
        let __VLS_46;
        const __VLS_47 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.isLoggedIn))
                    return;
                if (!(__VLS_ctx.currentTab === 'loc_summary' && (__VLS_ctx.summaryGridData.length > 0 || __VLS_ctx.areaGridTable.length > 0)))
                    return;
                __VLS_ctx.exportData('excel');
            }
        };
        __VLS_43.slots.default;
        var __VLS_43;
    }
    const __VLS_48 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        ...{ 'onClick': {} },
        type: "primary",
        size: "medium",
        icon: "Menu",
        ...{ class: "unified-menu-btn" },
    }));
    const __VLS_50 = __VLS_49({
        ...{ 'onClick': {} },
        type: "primary",
        size: "medium",
        icon: "Menu",
        ...{ class: "unified-menu-btn" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    let __VLS_52;
    let __VLS_53;
    let __VLS_54;
    const __VLS_55 = {
        onClick: (...[$event]) => {
            if (!!(!__VLS_ctx.isLoggedIn))
                return;
            __VLS_ctx.showUnifiedDrawer = true;
        }
    };
    __VLS_51.slots.default;
    var __VLS_51;
    if (__VLS_ctx.currentTab === 'loc_summary') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "main-layout scroll-layout" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
            ...{ class: "content-area standalone dark-bg main-scrollable" },
        });
        if (__VLS_ctx.loading || (__VLS_ctx.summaryGridData.length === 0 && __VLS_ctx.areaGridTable.length === 0)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "progress-box-panel dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "progress-info" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "status-title" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "percent-text" },
            });
            (__VLS_ctx.calcProgress);
            const __VLS_56 = {}.ElProgress;
            /** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
            // @ts-ignore
            const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
                percentage: (__VLS_ctx.calcProgress),
                strokeWidth: (12),
                color: (__VLS_ctx.progressColors),
                showText: (false),
                stripe: true,
                animated: true,
            }));
            const __VLS_58 = __VLS_57({
                percentage: (__VLS_ctx.calcProgress),
                strokeWidth: (12),
                color: (__VLS_ctx.progressColors),
                showText: (false),
                stripe: true,
                animated: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_57));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "progress-subtext" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "summary-wrapper" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "summary-cards" },
                ...{ style: {} },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card highlight" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.summaryStats.total_plan_grid);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.summaryStats.total_used_grid);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.summaryStats.total_rem_grid);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card highlight-vol" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.summaryStats.total_plan_vol);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.summaryStats.total_used_vol);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card highlight-health" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-success" },
            });
            (__VLS_ctx.summaryStats.total_health);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "table-container dark-table-container scroll-container" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "dual-column-row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "column-block left-block desktop-only-section" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "block-header-tag blue-tag" },
            });
            const __VLS_60 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
                data: (__VLS_ctx.areaGridTable),
                border: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table fit-table" },
            }));
            const __VLS_62 = __VLS_61({
                data: (__VLS_ctx.areaGridTable),
                border: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table fit-table" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_61));
            __VLS_63.slots.default;
            const __VLS_64 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }));
            const __VLS_66 = __VLS_65({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }, ...__VLS_functionalComponentArgsRest(__VLS_65));
            const __VLS_68 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }));
            const __VLS_70 = __VLS_69({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }, ...__VLS_functionalComponentArgsRest(__VLS_69));
            const __VLS_72 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
                label: "規劃格數",
            }));
            const __VLS_74 = __VLS_73({
                label: "規劃格數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_73));
            __VLS_75.slots.default;
            const __VLS_76 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                prop: "p_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_78 = __VLS_77({
                prop: "p_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_77));
            const __VLS_80 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
                prop: "p_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_82 = __VLS_81({
                prop: "p_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            const __VLS_84 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
                prop: "p_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_86 = __VLS_85({
                prop: "p_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_85));
            const __VLS_88 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
                prop: "p_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_90 = __VLS_89({
                prop: "p_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_89));
            var __VLS_75;
            const __VLS_92 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
                label: "已使用格數",
            }));
            const __VLS_94 = __VLS_93({
                label: "已使用格數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_93));
            __VLS_95.slots.default;
            const __VLS_96 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
                prop: "u_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_98 = __VLS_97({
                prop: "u_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_97));
            const __VLS_100 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
                prop: "u_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_102 = __VLS_101({
                prop: "u_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_101));
            const __VLS_104 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
                prop: "u_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_106 = __VLS_105({
                prop: "u_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_105));
            const __VLS_108 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
                prop: "u_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_110 = __VLS_109({
                prop: "u_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_109));
            var __VLS_95;
            const __VLS_112 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
                label: "未使用率 (%)",
            }));
            const __VLS_114 = __VLS_113({
                label: "未使用率 (%)",
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            __VLS_115.slots.default;
            const __VLS_116 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
                prop: "r_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_118 = __VLS_117({
                prop: "r_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_117));
            const __VLS_120 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
                prop: "r_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_122 = __VLS_121({
                prop: "r_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_121));
            const __VLS_124 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
                prop: "r_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_126 = __VLS_125({
                prop: "r_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_125));
            const __VLS_128 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
                prop: "r_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_130 = __VLS_129({
                prop: "r_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_129));
            var __VLS_115;
            const __VLS_132 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
                label: "剩餘格數",
            }));
            const __VLS_134 = __VLS_133({
                label: "剩餘格數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_133));
            __VLS_135.slots.default;
            const __VLS_136 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
                prop: "rem_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_138 = __VLS_137({
                prop: "rem_A",
                label: "A區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_137));
            const __VLS_140 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({
                prop: "rem_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_142 = __VLS_141({
                prop: "rem_B",
                label: "B區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_141));
            const __VLS_144 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
                prop: "rem_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_146 = __VLS_145({
                prop: "rem_C",
                label: "C區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_145));
            const __VLS_148 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
                prop: "rem_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }));
            const __VLS_150 = __VLS_149({
                prop: "rem_D",
                label: "D區",
                minWidth: "45",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_149));
            var __VLS_135;
            var __VLS_63;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "column-block right-block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "block-header-tag green-tag" },
            });
            const __VLS_152 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
                data: (__VLS_ctx.summaryGridData),
                border: true,
                stripe: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table sticky-table" },
            }));
            const __VLS_154 = __VLS_153({
                data: (__VLS_ctx.summaryGridData),
                border: true,
                stripe: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table sticky-table" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_153));
            __VLS_155.slots.default;
            const __VLS_156 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
                label: "全區儲位彙總指標",
            }));
            const __VLS_158 = __VLS_157({
                label: "全區儲位彙總指標",
            }, ...__VLS_functionalComponentArgsRest(__VLS_157));
            __VLS_159.slots.default;
            const __VLS_160 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }));
            const __VLS_162 = __VLS_161({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }, ...__VLS_functionalComponentArgsRest(__VLS_161));
            const __VLS_164 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }));
            const __VLS_166 = __VLS_165({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }, ...__VLS_functionalComponentArgsRest(__VLS_165));
            const __VLS_168 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
                prop: "grid_plan",
                label: "規劃數",
                minWidth: "70",
                align: "right",
            }));
            const __VLS_170 = __VLS_169({
                prop: "grid_plan",
                label: "規劃數",
                minWidth: "70",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_169));
            const __VLS_172 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
                prop: "grid_used",
                label: "已使用",
                minWidth: "70",
                align: "right",
            }));
            const __VLS_174 = __VLS_173({
                prop: "grid_used",
                label: "已使用",
                minWidth: "70",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_173));
            const __VLS_176 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
                prop: "grid_unused_rate",
                label: "未使用率(%)",
                minWidth: "85",
                align: "right",
            }));
            const __VLS_178 = __VLS_177({
                prop: "grid_unused_rate",
                label: "未使用率(%)",
                minWidth: "85",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_177));
            const __VLS_180 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
                prop: "grid_rem",
                label: "剩餘儲位數",
                minWidth: "80",
                align: "right",
            }));
            const __VLS_182 = __VLS_181({
                prop: "grid_rem",
                label: "剩餘儲位數",
                minWidth: "80",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_181));
            const __VLS_184 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({
                prop: "vol_rem",
                label: "剩餘才數",
                minWidth: "80",
                align: "right",
            }));
            const __VLS_186 = __VLS_185({
                prop: "vol_rem",
                label: "剩餘才數",
                minWidth: "80",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_185));
            var __VLS_159;
            var __VLS_155;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "dual-column-row" },
                ...{ style: {} },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "column-block left-block desktop-only-section" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "block-header-tag blue-tag" },
            });
            const __VLS_188 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
                data: (__VLS_ctx.areaVolTable),
                border: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table fit-table" },
            }));
            const __VLS_190 = __VLS_189({
                data: (__VLS_ctx.areaVolTable),
                border: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table fit-table" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_189));
            __VLS_191.slots.default;
            const __VLS_192 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_193 = __VLS_asFunctionalComponent(__VLS_192, new __VLS_192({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }));
            const __VLS_194 = __VLS_193({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }, ...__VLS_functionalComponentArgsRest(__VLS_193));
            const __VLS_196 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }));
            const __VLS_198 = __VLS_197({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }, ...__VLS_functionalComponentArgsRest(__VLS_197));
            const __VLS_200 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_201 = __VLS_asFunctionalComponent(__VLS_200, new __VLS_200({
                label: "規劃才數",
            }));
            const __VLS_202 = __VLS_201({
                label: "規劃才數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_201));
            __VLS_203.slots.default;
            const __VLS_204 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
                prop: "vp_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_206 = __VLS_205({
                prop: "vp_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_205));
            const __VLS_208 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
                prop: "vp_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_210 = __VLS_209({
                prop: "vp_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_209));
            const __VLS_212 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({
                prop: "vp_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_214 = __VLS_213({
                prop: "vp_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_213));
            const __VLS_216 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
                prop: "vp_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_218 = __VLS_217({
                prop: "vp_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_217));
            var __VLS_203;
            const __VLS_220 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({
                label: "已使用才數",
            }));
            const __VLS_222 = __VLS_221({
                label: "已使用才數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_221));
            __VLS_223.slots.default;
            const __VLS_224 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
                prop: "vu_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_226 = __VLS_225({
                prop: "vu_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_225));
            const __VLS_228 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
                prop: "vu_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_230 = __VLS_229({
                prop: "vu_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_229));
            const __VLS_232 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
                prop: "vu_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_234 = __VLS_233({
                prop: "vu_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_233));
            const __VLS_236 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
                prop: "vu_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_238 = __VLS_237({
                prop: "vu_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_237));
            var __VLS_223;
            const __VLS_240 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({
                label: "未使用率 (%)",
            }));
            const __VLS_242 = __VLS_241({
                label: "未使用率 (%)",
            }, ...__VLS_functionalComponentArgsRest(__VLS_241));
            __VLS_243.slots.default;
            const __VLS_244 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({
                prop: "vr_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_246 = __VLS_245({
                prop: "vr_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_245));
            const __VLS_248 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
                prop: "vr_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_250 = __VLS_249({
                prop: "vr_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_249));
            const __VLS_252 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
                prop: "vr_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_254 = __VLS_253({
                prop: "vr_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_253));
            const __VLS_256 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({
                prop: "vr_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_258 = __VLS_257({
                prop: "vr_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_257));
            var __VLS_243;
            const __VLS_260 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({
                label: "剩餘才數",
            }));
            const __VLS_262 = __VLS_261({
                label: "剩餘才數",
            }, ...__VLS_functionalComponentArgsRest(__VLS_261));
            __VLS_263.slots.default;
            const __VLS_264 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
                prop: "vrem_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_266 = __VLS_265({
                prop: "vrem_A",
                label: "A區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_265));
            const __VLS_268 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_269 = __VLS_asFunctionalComponent(__VLS_268, new __VLS_268({
                prop: "vrem_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_270 = __VLS_269({
                prop: "vrem_B",
                label: "B區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_269));
            const __VLS_272 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
                prop: "vrem_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_274 = __VLS_273({
                prop: "vrem_C",
                label: "C區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_273));
            const __VLS_276 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_277 = __VLS_asFunctionalComponent(__VLS_276, new __VLS_276({
                prop: "vrem_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }));
            const __VLS_278 = __VLS_277({
                prop: "vrem_D",
                label: "D區",
                minWidth: "55",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_277));
            var __VLS_263;
            var __VLS_191;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "column-block right-block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "block-header-tag green-tag" },
            });
            const __VLS_280 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
                data: (__VLS_ctx.summaryVolData),
                border: true,
                stripe: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table sticky-table" },
            }));
            const __VLS_282 = __VLS_281({
                data: (__VLS_ctx.summaryVolData),
                border: true,
                stripe: true,
                ...{ style: {} },
                size: "small",
                rowClassName: (__VLS_ctx.tableRowStyle),
                ...{ class: "dark-table sticky-table" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_281));
            __VLS_283.slots.default;
            const __VLS_284 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_285 = __VLS_asFunctionalComponent(__VLS_284, new __VLS_284({
                label: "全區才數彙總指標",
            }));
            const __VLS_286 = __VLS_285({
                label: "全區才數彙總指標",
            }, ...__VLS_functionalComponentArgsRest(__VLS_285));
            __VLS_287.slots.default;
            const __VLS_288 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_289 = __VLS_asFunctionalComponent(__VLS_288, new __VLS_288({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }));
            const __VLS_290 = __VLS_289({
                prop: "floor",
                label: "樓層",
                width: "52",
                fixed: "left",
                align: "center",
            }, ...__VLS_functionalComponentArgsRest(__VLS_289));
            const __VLS_292 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_293 = __VLS_asFunctionalComponent(__VLS_292, new __VLS_292({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }));
            const __VLS_294 = __VLS_293({
                prop: "type",
                label: "儲位類型",
                width: "105",
                fixed: "left",
            }, ...__VLS_functionalComponentArgsRest(__VLS_293));
            const __VLS_296 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_297 = __VLS_asFunctionalComponent(__VLS_296, new __VLS_296({
                prop: "vol_plan",
                label: "規劃數",
                minWidth: "80",
                align: "right",
            }));
            const __VLS_298 = __VLS_297({
                prop: "vol_plan",
                label: "規劃數",
                minWidth: "80",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_297));
            const __VLS_300 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_301 = __VLS_asFunctionalComponent(__VLS_300, new __VLS_300({
                prop: "vol_used",
                label: "已使用",
                minWidth: "80",
                align: "right",
            }));
            const __VLS_302 = __VLS_301({
                prop: "vol_used",
                label: "已使用",
                minWidth: "80",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_301));
            const __VLS_304 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_305 = __VLS_asFunctionalComponent(__VLS_304, new __VLS_304({
                prop: "vol_unused_rate",
                label: "未使用率(%)",
                minWidth: "85",
                align: "right",
            }));
            const __VLS_306 = __VLS_305({
                prop: "vol_unused_rate",
                label: "未使用率(%)",
                minWidth: "85",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_305));
            const __VLS_308 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_309 = __VLS_asFunctionalComponent(__VLS_308, new __VLS_308({
                prop: "vol_rem",
                label: "剩餘才數",
                minWidth: "80",
                align: "right",
            }));
            const __VLS_310 = __VLS_309({
                prop: "vol_rem",
                label: "剩餘才數",
                minWidth: "80",
                align: "right",
            }, ...__VLS_functionalComponentArgsRest(__VLS_309));
            const __VLS_312 = {}.ElTableColumn;
            /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
            // @ts-ignore
            const __VLS_313 = __VLS_asFunctionalComponent(__VLS_312, new __VLS_312({
                prop: "health_score",
                label: "健康度",
                minWidth: "80",
                align: "center",
            }));
            const __VLS_314 = __VLS_313({
                prop: "health_score",
                label: "健康度",
                minWidth: "80",
                align: "center",
            }, ...__VLS_functionalComponentArgsRest(__VLS_313));
            __VLS_315.slots.default;
            {
                const { default: __VLS_thisSlot } = __VLS_315.slots;
                const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: (__VLS_ctx.getHealthClass(scope.row.health_score)) },
                });
                (scope.row.health_score);
            }
            var __VLS_315;
            var __VLS_287;
            var __VLS_283;
        }
    }
    else if (__VLS_ctx.currentTab === 'inv80') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "main-layout dark-bg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
            ...{ class: "content-area standalone dark-bg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "top-action-bar flex-btn-row" },
        });
        const __VLS_316 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_317 = __VLS_asFunctionalComponent(__VLS_316, new __VLS_316({
            ...{ 'onClick': {} },
            type: "primary",
            size: "large",
            ...{ class: "flex-btn action-bar-btn search-trigger-btn" },
        }));
        const __VLS_318 = __VLS_317({
            ...{ 'onClick': {} },
            type: "primary",
            size: "large",
            ...{ class: "flex-btn action-bar-btn search-trigger-btn" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_317));
        let __VLS_320;
        let __VLS_321;
        let __VLS_322;
        const __VLS_323 = {
            onClick: (__VLS_ctx.openSearchModal)
        };
        __VLS_319.slots.default;
        var __VLS_319;
        if (__VLS_ctx.hasSearched) {
            const __VLS_324 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_325 = __VLS_asFunctionalComponent(__VLS_324, new __VLS_324({
                ...{ 'onClick': {} },
                type: "success",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }));
            const __VLS_326 = __VLS_325({
                ...{ 'onClick': {} },
                type: "success",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_325));
            let __VLS_328;
            let __VLS_329;
            let __VLS_330;
            const __VLS_331 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!(__VLS_ctx.hasSearched))
                        return;
                    __VLS_ctx.exportData('excel');
                }
            };
            __VLS_327.slots.default;
            var __VLS_327;
            const __VLS_332 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_333 = __VLS_asFunctionalComponent(__VLS_332, new __VLS_332({
                ...{ 'onClick': {} },
                type: "primary",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }));
            const __VLS_334 = __VLS_333({
                ...{ 'onClick': {} },
                type: "primary",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_333));
            let __VLS_336;
            let __VLS_337;
            let __VLS_338;
            const __VLS_339 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!(__VLS_ctx.hasSearched))
                        return;
                    __VLS_ctx.exportData('csv');
                }
            };
            __VLS_335.slots.default;
            var __VLS_335;
            const __VLS_340 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_341 = __VLS_asFunctionalComponent(__VLS_340, new __VLS_340({
                ...{ 'onClick': {} },
                type: "danger",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }));
            const __VLS_342 = __VLS_341({
                ...{ 'onClick': {} },
                type: "danger",
                size: "large",
                ...{ class: "flex-btn action-bar-btn" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_341));
            let __VLS_344;
            let __VLS_345;
            let __VLS_346;
            const __VLS_347 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!(__VLS_ctx.hasSearched))
                        return;
                    __VLS_ctx.exportData('pdf');
                }
            };
            __VLS_343.slots.default;
            var __VLS_343;
        }
        if (__VLS_ctx.hasSearched) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "report-wrapper" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "report-panel dark-panel" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "panel-header" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
                ...{ class: "text-white" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "summary-cards" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.formatNumber(__VLS_ctx.summary.total_items));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.formatNumber(__VLS_ctx.summary.total_rows));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.formatNumber(__VLS_ctx.summary.total_pcs));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white" },
            });
            (__VLS_ctx.formatNumber(__VLS_ctx.summary.total_ao));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card dark-card mobile-hide" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "value text-white time" },
            });
            (__VLS_ctx.searchTime);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "table-container dark-table-container scrollable-table-box" },
            });
            const __VLS_348 = {}.ElTable;
            /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
            // @ts-ignore
            const __VLS_349 = __VLS_asFunctionalComponent(__VLS_348, new __VLS_348({
                data: (__VLS_ctx.tableData),
                border: true,
                stripe: true,
                height: "100%",
                ...{ style: {} },
                size: "small",
                ...{ class: "dark-table" },
            }));
            const __VLS_350 = __VLS_349({
                data: (__VLS_ctx.tableData),
                border: true,
                stripe: true,
                height: "100%",
                ...{ style: {} },
                size: "small",
                ...{ class: "dark-table" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_349));
            __VLS_351.slots.default;
            for (const [col] of __VLS_getVForSourceType((__VLS_ctx.columns))) {
                const __VLS_352 = {}.ElTableColumn;
                /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
                // @ts-ignore
                const __VLS_353 = __VLS_asFunctionalComponent(__VLS_352, new __VLS_352({
                    key: (col),
                    prop: (col),
                    label: (col),
                    sortable: true,
                    showOverflowTooltip: true,
                    minWidth: (__VLS_ctx.getColWidth(col)),
                }));
                const __VLS_354 = __VLS_353({
                    key: (col),
                    prop: (col),
                    label: (col),
                    sortable: true,
                    showOverflowTooltip: true,
                    minWidth: (__VLS_ctx.getColWidth(col)),
                }, ...__VLS_functionalComponentArgsRest(__VLS_353));
            }
            var __VLS_351;
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "empty-state" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "empty-box" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "icon" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
    else if (__VLS_ctx.currentTab === 'settings_log') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "main-layout settings-layout dark-bg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "settings-card dark-card" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "settings-header" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "text-white" },
            ...{ style: {} },
        });
        const __VLS_356 = {}.ElRadioGroup;
        /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
        // @ts-ignore
        const __VLS_357 = __VLS_asFunctionalComponent(__VLS_356, new __VLS_356({
            ...{ 'onChange': {} },
            modelValue: (__VLS_ctx.logTab),
            size: "small",
        }));
        const __VLS_358 = __VLS_357({
            ...{ 'onChange': {} },
            modelValue: (__VLS_ctx.logTab),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_357));
        let __VLS_360;
        let __VLS_361;
        let __VLS_362;
        const __VLS_363 = {
            onChange: (__VLS_ctx.fetchLogs)
        };
        __VLS_359.slots.default;
        const __VLS_364 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_365 = __VLS_asFunctionalComponent(__VLS_364, new __VLS_364({
            label: "normal",
        }));
        const __VLS_366 = __VLS_365({
            label: "normal",
        }, ...__VLS_functionalComponentArgsRest(__VLS_365));
        __VLS_367.slots.default;
        var __VLS_367;
        const __VLS_368 = {}.ElRadioButton;
        /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
        // @ts-ignore
        const __VLS_369 = __VLS_asFunctionalComponent(__VLS_368, new __VLS_368({
            label: "error",
        }));
        const __VLS_370 = __VLS_369({
            label: "error",
        }, ...__VLS_functionalComponentArgsRest(__VLS_369));
        __VLS_371.slots.default;
        var __VLS_371;
        var __VLS_359;
        const __VLS_372 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_373 = __VLS_asFunctionalComponent(__VLS_372, new __VLS_372({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
        }));
        const __VLS_374 = __VLS_373({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_373));
        let __VLS_376;
        let __VLS_377;
        let __VLS_378;
        const __VLS_379 = {
            onClick: (__VLS_ctx.fetchLogs)
        };
        __VLS_375.slots.default;
        var __VLS_375;
        const __VLS_380 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_381 = __VLS_asFunctionalComponent(__VLS_380, new __VLS_380({
            data: (__VLS_ctx.filteredLogsList),
            border: true,
            height: "500px",
            ...{ style: {} },
            size: "small",
            ...{ class: "dark-table" },
        }));
        const __VLS_382 = __VLS_381({
            data: (__VLS_ctx.filteredLogsList),
            border: true,
            height: "500px",
            ...{ style: {} },
            size: "small",
            ...{ class: "dark-table" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_381));
        __VLS_383.slots.default;
        const __VLS_384 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_385 = __VLS_asFunctionalComponent(__VLS_384, new __VLS_384({
            prop: "username",
            label: "登入帳號",
            minWidth: "105",
        }));
        const __VLS_386 = __VLS_385({
            prop: "username",
            label: "登入帳號",
            minWidth: "105",
        }, ...__VLS_functionalComponentArgsRest(__VLS_385));
        const __VLS_388 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_389 = __VLS_asFunctionalComponent(__VLS_388, new __VLS_388({
            prop: "device",
            label: "登入裝置",
            minWidth: "110",
            align: "center",
        }));
        const __VLS_390 = __VLS_389({
            prop: "device",
            label: "登入裝置",
            minWidth: "110",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_389));
        __VLS_391.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_391.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            if (scope.row.device && scope.row.device.includes('手機')) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
            }
        }
        var __VLS_391;
        const __VLS_392 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_393 = __VLS_asFunctionalComponent(__VLS_392, new __VLS_392({
            prop: "feature",
            label: "使用功能",
            minWidth: "130",
        }));
        const __VLS_394 = __VLS_393({
            prop: "feature",
            label: "使用功能",
            minWidth: "130",
        }, ...__VLS_functionalComponentArgsRest(__VLS_393));
        __VLS_395.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_395.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (scope.row.feature || '通用功能');
        }
        var __VLS_395;
        const __VLS_396 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_397 = __VLS_asFunctionalComponent(__VLS_396, new __VLS_396({
            prop: "action",
            label: "操作動作 / 錯誤訊息",
            minWidth: "320",
            showOverflowTooltip: true,
        }));
        const __VLS_398 = __VLS_397({
            prop: "action",
            label: "操作動作 / 錯誤訊息",
            minWidth: "320",
            showOverflowTooltip: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_397));
        __VLS_399.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_399.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            if (__VLS_ctx.isErrorAction(scope.row.action)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
                (scope.row.action);
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
                (scope.row.action);
            }
        }
        var __VLS_399;
        const __VLS_400 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_401 = __VLS_asFunctionalComponent(__VLS_400, new __VLS_400({
            prop: "login_time",
            label: "時間",
            minWidth: "160",
            sortable: true,
        }));
        const __VLS_402 = __VLS_401({
            prop: "login_time",
            label: "時間",
            minWidth: "160",
            sortable: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_401));
        const __VLS_404 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_405 = __VLS_asFunctionalComponent(__VLS_404, new __VLS_404({
            prop: "ip",
            label: "IP",
            minWidth: "110",
        }));
        const __VLS_406 = __VLS_405({
            prop: "ip",
            label: "IP",
            minWidth: "110",
        }, ...__VLS_functionalComponentArgsRest(__VLS_405));
        var __VLS_383;
    }
    else if (__VLS_ctx.currentTab === 'settings_perm') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "main-layout settings-layout dark-bg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "settings-card dark-card" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "settings-header" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "text-white" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.handleBatchUsersUpload) },
            type: "file",
            ref: "batchUserFileInput",
            ...{ style: {} },
            accept: ".xlsx,.xls,.csv",
        });
        /** @type {typeof __VLS_ctx.batchUserFileInput} */ ;
        const __VLS_408 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_409 = __VLS_asFunctionalComponent(__VLS_408, new __VLS_408({
            ...{ 'onClick': {} },
            type: "warning",
            size: "small",
        }));
        const __VLS_410 = __VLS_409({
            ...{ 'onClick': {} },
            type: "warning",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_409));
        let __VLS_412;
        let __VLS_413;
        let __VLS_414;
        const __VLS_415 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.isLoggedIn))
                    return;
                if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                    return;
                if (!!(__VLS_ctx.currentTab === 'inv80'))
                    return;
                if (!!(__VLS_ctx.currentTab === 'settings_log'))
                    return;
                if (!(__VLS_ctx.currentTab === 'settings_perm'))
                    return;
                __VLS_ctx.$refs.batchUserFileInput.click();
            }
        };
        __VLS_411.slots.default;
        var __VLS_411;
        const __VLS_416 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_417 = __VLS_asFunctionalComponent(__VLS_416, new __VLS_416({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
        }));
        const __VLS_418 = __VLS_417({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_417));
        let __VLS_420;
        let __VLS_421;
        let __VLS_422;
        const __VLS_423 = {
            onClick: (__VLS_ctx.exportUsersExcel)
        };
        __VLS_419.slots.default;
        var __VLS_419;
        const __VLS_424 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_425 = __VLS_asFunctionalComponent(__VLS_424, new __VLS_424({
            ...{ 'onClick': {} },
            type: "info",
            size: "small",
        }));
        const __VLS_426 = __VLS_425({
            ...{ 'onClick': {} },
            type: "info",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_425));
        let __VLS_428;
        let __VLS_429;
        let __VLS_430;
        const __VLS_431 = {
            onClick: (__VLS_ctx.fetchUsers)
        };
        __VLS_427.slots.default;
        var __VLS_427;
        const __VLS_432 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_433 = __VLS_asFunctionalComponent(__VLS_432, new __VLS_432({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
        }));
        const __VLS_434 = __VLS_433({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_433));
        let __VLS_436;
        let __VLS_437;
        let __VLS_438;
        const __VLS_439 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.isLoggedIn))
                    return;
                if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                    return;
                if (!!(__VLS_ctx.currentTab === 'inv80'))
                    return;
                if (!!(__VLS_ctx.currentTab === 'settings_log'))
                    return;
                if (!(__VLS_ctx.currentTab === 'settings_perm'))
                    return;
                __VLS_ctx.showAddUserDialog = true;
            }
        };
        __VLS_435.slots.default;
        var __VLS_435;
        const __VLS_440 = {}.ElTable;
        /** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
        // @ts-ignore
        const __VLS_441 = __VLS_asFunctionalComponent(__VLS_440, new __VLS_440({
            data: (__VLS_ctx.usersList),
            border: true,
            ...{ style: {} },
            size: "medium",
            ...{ class: "dark-table" },
        }));
        const __VLS_442 = __VLS_441({
            data: (__VLS_ctx.usersList),
            border: true,
            ...{ style: {} },
            size: "medium",
            ...{ class: "dark-table" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_441));
        __VLS_443.slots.default;
        const __VLS_444 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_445 = __VLS_asFunctionalComponent(__VLS_444, new __VLS_444({
            prop: "username",
            label: "登入帳號",
            width: "105",
        }));
        const __VLS_446 = __VLS_445({
            prop: "username",
            label: "登入帳號",
            width: "105",
        }, ...__VLS_functionalComponentArgsRest(__VLS_445));
        __VLS_447.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_447.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (scope.row.username);
        }
        var __VLS_447;
        const __VLS_448 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_449 = __VLS_asFunctionalComponent(__VLS_448, new __VLS_448({
            prop: "name",
            label: "姓名",
            width: "110",
        }));
        const __VLS_450 = __VLS_449({
            prop: "name",
            label: "姓名",
            width: "110",
        }, ...__VLS_functionalComponentArgsRest(__VLS_449));
        __VLS_451.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_451.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (scope.row.name || scope.row.username);
        }
        var __VLS_451;
        const __VLS_452 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_453 = __VLS_asFunctionalComponent(__VLS_452, new __VLS_452({
            label: "身份",
            width: "95",
            align: "center",
        }));
        const __VLS_454 = __VLS_453({
            label: "身份",
            width: "95",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_453));
        __VLS_455.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_455.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            if (scope.row.role === 'admin' || scope.row.username === 'admin') {
                const __VLS_456 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_457 = __VLS_asFunctionalComponent(__VLS_456, new __VLS_456({
                    size: "mini",
                    type: "danger",
                }));
                const __VLS_458 = __VLS_457({
                    size: "mini",
                    type: "danger",
                }, ...__VLS_functionalComponentArgsRest(__VLS_457));
                __VLS_459.slots.default;
                var __VLS_459;
            }
            else {
                const __VLS_460 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_461 = __VLS_asFunctionalComponent(__VLS_460, new __VLS_460({
                    size: "mini",
                    type: "primary",
                }));
                const __VLS_462 = __VLS_461({
                    size: "mini",
                    type: "primary",
                }, ...__VLS_functionalComponentArgsRest(__VLS_461));
                __VLS_463.slots.default;
                var __VLS_463;
            }
        }
        var __VLS_455;
        const __VLS_464 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_465 = __VLS_asFunctionalComponent(__VLS_464, new __VLS_464({
            label: "在線狀態",
            width: "90",
            align: "center",
        }));
        const __VLS_466 = __VLS_465({
            label: "在線狀態",
            width: "90",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_465));
        __VLS_467.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_467.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            if (scope.row.username === __VLS_ctx.currentUser) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
            }
        }
        var __VLS_467;
        const __VLS_468 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_469 = __VLS_asFunctionalComponent(__VLS_468, new __VLS_468({
            prop: "password",
            label: "密碼",
            width: "75",
            align: "center",
        }));
        const __VLS_470 = __VLS_469({
            prop: "password",
            label: "密碼",
            width: "75",
            align: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_469));
        __VLS_471.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_471.slots;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
        }
        var __VLS_471;
        const __VLS_472 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_473 = __VLS_asFunctionalComponent(__VLS_472, new __VLS_472({
            label: "開放功能模組",
            minWidth: "260",
        }));
        const __VLS_474 = __VLS_473({
            label: "開放功能模組",
            minWidth: "260",
        }, ...__VLS_functionalComponentArgsRest(__VLS_473));
        __VLS_475.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_475.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            for (const [perm] of __VLS_getVForSourceType(((scope.row.permissions || [])))) {
                const __VLS_476 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_477 = __VLS_asFunctionalComponent(__VLS_476, new __VLS_476({
                    key: (perm),
                    size: "mini",
                    type: "info",
                    ...{ style: {} },
                }));
                const __VLS_478 = __VLS_477({
                    key: (perm),
                    size: "mini",
                    type: "info",
                    ...{ style: {} },
                }, ...__VLS_functionalComponentArgsRest(__VLS_477));
                __VLS_479.slots.default;
                (__VLS_ctx.getTabName(perm));
                var __VLS_479;
            }
        }
        var __VLS_475;
        const __VLS_480 = {}.ElTableColumn;
        /** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
        // @ts-ignore
        const __VLS_481 = __VLS_asFunctionalComponent(__VLS_480, new __VLS_480({
            label: "操作",
            width: "380",
            align: "center",
            headerAlign: "center",
        }));
        const __VLS_482 = __VLS_481({
            label: "操作",
            width: "380",
            align: "center",
            headerAlign: "center",
        }, ...__VLS_functionalComponentArgsRest(__VLS_481));
        __VLS_483.slots.default;
        {
            const { default: __VLS_thisSlot } = __VLS_483.slots;
            const [scope] = __VLS_getSlotParams(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ style: {} },
            });
            const __VLS_484 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_485 = __VLS_asFunctionalComponent(__VLS_484, new __VLS_484({
                ...{ 'onClick': {} },
                type: "purple",
                size: "mini",
                ...{ style: {} },
            }));
            const __VLS_486 = __VLS_485({
                ...{ 'onClick': {} },
                type: "purple",
                size: "mini",
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_485));
            let __VLS_488;
            let __VLS_489;
            let __VLS_490;
            const __VLS_491 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_log'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'settings_perm'))
                        return;
                    __VLS_ctx.openRoleDialog(scope.row);
                }
            };
            __VLS_487.slots.default;
            var __VLS_487;
            const __VLS_492 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_493 = __VLS_asFunctionalComponent(__VLS_492, new __VLS_492({
                ...{ 'onClick': {} },
                type: "warning",
                size: "mini",
                ...{ style: {} },
            }));
            const __VLS_494 = __VLS_493({
                ...{ 'onClick': {} },
                type: "warning",
                size: "mini",
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_493));
            let __VLS_496;
            let __VLS_497;
            let __VLS_498;
            const __VLS_499 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_log'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'settings_perm'))
                        return;
                    __VLS_ctx.openPwdDialog(scope.row);
                }
            };
            __VLS_495.slots.default;
            var __VLS_495;
            const __VLS_500 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_501 = __VLS_asFunctionalComponent(__VLS_500, new __VLS_500({
                ...{ 'onClick': {} },
                type: "primary",
                size: "mini",
                ...{ style: {} },
            }));
            const __VLS_502 = __VLS_501({
                ...{ 'onClick': {} },
                type: "primary",
                size: "mini",
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_501));
            let __VLS_504;
            let __VLS_505;
            let __VLS_506;
            const __VLS_507 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_log'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'settings_perm'))
                        return;
                    __VLS_ctx.openPermDialog(scope.row);
                }
            };
            __VLS_503.slots.default;
            var __VLS_503;
            const __VLS_508 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_509 = __VLS_asFunctionalComponent(__VLS_508, new __VLS_508({
                ...{ 'onClick': {} },
                type: "danger",
                size: "mini",
                ...{ style: {} },
                disabled: (scope.row.username === 'admin'),
            }));
            const __VLS_510 = __VLS_509({
                ...{ 'onClick': {} },
                type: "danger",
                size: "mini",
                ...{ style: {} },
                disabled: (scope.row.username === 'admin'),
            }, ...__VLS_functionalComponentArgsRest(__VLS_509));
            let __VLS_512;
            let __VLS_513;
            let __VLS_514;
            const __VLS_515 = {
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_log'))
                        return;
                    if (!(__VLS_ctx.currentTab === 'settings_perm'))
                        return;
                    __VLS_ctx.deleteUser(scope.row.username);
                }
            };
            __VLS_511.slots.default;
            var __VLS_511;
        }
        var __VLS_483;
        var __VLS_443;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "coming-soon-container dark-bg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "coming-soon-card dark-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "icon" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "text-white" },
        });
        (__VLS_ctx.getTabName(__VLS_ctx.currentTab));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.isLoggedIn))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'loc_summary'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'inv80'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_log'))
                        return;
                    if (!!(__VLS_ctx.currentTab === 'settings_perm'))
                        return;
                    __VLS_ctx.switchTab('inv80');
                } },
            ...{ class: "back-btn" },
        });
    }
}
const __VLS_516 = {}.ElDrawer;
/** @type {[typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, typeof __VLS_components.ElDrawer, typeof __VLS_components.elDrawer, ]} */ ;
// @ts-ignore
const __VLS_517 = __VLS_asFunctionalComponent(__VLS_516, new __VLS_516({
    title: "🎛️ 系統控制中心",
    modelValue: (__VLS_ctx.showUnifiedDrawer),
    direction: "rtl",
    size: "340px",
    ...{ class: "dark-drawer unified-drawer" },
}));
const __VLS_518 = __VLS_517({
    title: "🎛️ 系統控制中心",
    modelValue: (__VLS_ctx.showUnifiedDrawer),
    direction: "rtl",
    size: "340px",
    ...{ class: "dark-drawer unified-drawer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_517));
__VLS_519.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drawer-content-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drawer-section user-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-badge" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "avatar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-meta" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "name" },
});
(__VLS_ctx.currentUser);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-dot" },
});
const __VLS_520 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_521 = __VLS_asFunctionalComponent(__VLS_520, new __VLS_520({
    ...{ 'onClick': {} },
    type: "danger",
    size: "mini",
    ...{ class: "drawer-logout-btn" },
}));
const __VLS_522 = __VLS_521({
    ...{ 'onClick': {} },
    type: "danger",
    size: "mini",
    ...{ class: "drawer-logout-btn" },
}, ...__VLS_functionalComponentArgsRest(__VLS_521));
let __VLS_524;
let __VLS_525;
let __VLS_526;
const __VLS_527 = {
    onClick: (...[$event]) => {
        __VLS_ctx.handleLogout();
        __VLS_ctx.showUnifiedDrawer = false;
        ;
    }
};
__VLS_523.slots.default;
var __VLS_523;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timer-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timer-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "val date-val" },
});
(__VLS_ctx.loginTimeStr);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timer-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "val online-val" },
});
(__VLS_ctx.sessionDurationStr);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "timer-row highlight" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "val idle-val" },
});
(__VLS_ctx.idleCountdownStr);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drawer-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.switchTab('loc_summary');
            __VLS_ctx.showUnifiedDrawer = false;
            ;
        } },
    ...{ class: (['nav-btn-item', { active: __VLS_ctx.currentTab === 'loc_summary' }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.switchTab('inv80');
            __VLS_ctx.showUnifiedDrawer = false;
            ;
        } },
    ...{ class: (['nav-btn-item', { active: __VLS_ctx.currentTab === 'inv80' }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "nav-btn-item disabled" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "badge" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "nav-btn-item disabled" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "badge" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "nav-btn-item disabled" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "badge" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drawer-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showColSettingDialog = true;
            __VLS_ctx.showUnifiedDrawer = false;
            ;
        } },
    ...{ class: "nav-btn-item setting" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.switchTab('settings_perm');
            __VLS_ctx.showUnifiedDrawer = false;
            ;
        } },
    ...{ class: "nav-btn-item setting" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.switchTab('settings_log');
            __VLS_ctx.showUnifiedDrawer = false;
            ;
        } },
    ...{ class: "nav-btn-item setting" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text" },
});
var __VLS_519;
const __VLS_528 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_529 = __VLS_asFunctionalComponent(__VLS_528, new __VLS_528({
    title: "🔍 庫存檢索條件設定",
    modelValue: (__VLS_ctx.showSearchModal),
    width: "600px",
    customClass: "dark-dialog search-modal-dialog",
}));
const __VLS_530 = __VLS_529({
    title: "🔍 庫存檢索條件設定",
    modelValue: (__VLS_ctx.showSearchModal),
    width: "600px",
    customClass: "dark-dialog search-modal-dialog",
}, ...__VLS_functionalComponentArgsRest(__VLS_529));
__VLS_531.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "modal-search-form" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_532 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_533 = __VLS_asFunctionalComponent(__VLS_532, new __VLS_532({
    modelValue: (__VLS_ctx.form.search_mode),
    ...{ style: {} },
}));
const __VLS_534 = __VLS_533({
    modelValue: (__VLS_ctx.form.search_mode),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_533));
__VLS_535.slots.default;
const __VLS_536 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_537 = __VLS_asFunctionalComponent(__VLS_536, new __VLS_536({
    label: "一般查詢 (單項/多條件)",
    value: "normal",
}));
const __VLS_538 = __VLS_537({
    label: "一般查詢 (單項/多條件)",
    value: "normal",
}, ...__VLS_functionalComponentArgsRest(__VLS_537));
const __VLS_540 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_541 = __VLS_asFunctionalComponent(__VLS_540, new __VLS_540({
    label: "批次商品 ID 查詢",
    value: "batch_id",
}));
const __VLS_542 = __VLS_541({
    label: "批次商品 ID 查詢",
    value: "batch_id",
}, ...__VLS_functionalComponentArgsRest(__VLS_541));
const __VLS_544 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_545 = __VLS_asFunctionalComponent(__VLS_544, new __VLS_544({
    label: "批次儲位/區域 查詢",
    value: "batch_zone",
}));
const __VLS_546 = __VLS_545({
    label: "批次儲位/區域 查詢",
    value: "batch_zone",
}, ...__VLS_functionalComponentArgsRest(__VLS_545));
var __VLS_535;
if (__VLS_ctx.form.search_mode === 'batch_id') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_548 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_549 = __VLS_asFunctionalComponent(__VLS_548, new __VLS_548({
        type: "textarea",
        rows: (4),
        modelValue: (__VLS_ctx.form.batch_ids),
        placeholder: "請輸入商品ID，一行一個...",
    }));
    const __VLS_550 = __VLS_549({
        type: "textarea",
        rows: (4),
        modelValue: (__VLS_ctx.form.batch_ids),
        placeholder: "請輸入商品ID，一行一個...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_549));
}
if (__VLS_ctx.form.search_mode === 'batch_zone') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_552 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_553 = __VLS_asFunctionalComponent(__VLS_552, new __VLS_552({
        type: "textarea",
        rows: (4),
        modelValue: (__VLS_ctx.form.batch_zones),
        placeholder: "請輸入區域或儲位號碼...",
    }));
    const __VLS_554 = __VLS_553({
        type: "textarea",
        rows: (4),
        modelValue: (__VLS_ctx.form.batch_zones),
        placeholder: "請輸入區域或儲位號碼...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_553));
}
if (__VLS_ctx.form.search_mode === 'normal') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "normal-search-wrapper" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid-2col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_556 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_557 = __VLS_asFunctionalComponent(__VLS_556, new __VLS_556({
        modelValue: (__VLS_ctx.form.txt_id),
        placeholder: "關鍵字...",
        clearable: true,
    }));
    const __VLS_558 = __VLS_557({
        modelValue: (__VLS_ctx.form.txt_id),
        placeholder: "關鍵字...",
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_557));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_560 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_561 = __VLS_asFunctionalComponent(__VLS_560, new __VLS_560({
        modelValue: (__VLS_ctx.form.txt_name),
        placeholder: "關鍵字...",
        clearable: true,
    }));
    const __VLS_562 = __VLS_561({
        modelValue: (__VLS_ctx.form.txt_name),
        placeholder: "關鍵字...",
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_561));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid-2col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_564 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_565 = __VLS_asFunctionalComponent(__VLS_564, new __VLS_564({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.form.cbo_big_zone),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_566 = __VLS_565({
        ...{ 'onChange': {} },
        modelValue: (__VLS_ctx.form.cbo_big_zone),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_565));
    let __VLS_568;
    let __VLS_569;
    let __VLS_570;
    const __VLS_571 = {
        onChange: (__VLS_ctx.onBigZoneChange)
    };
    __VLS_567.slots.default;
    const __VLS_572 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_573 = __VLS_asFunctionalComponent(__VLS_572, new __VLS_572({
        label: "全部",
        value: "",
    }));
    const __VLS_574 = __VLS_573({
        label: "全部",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_573));
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.options.big_zones))) {
        const __VLS_576 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_577 = __VLS_asFunctionalComponent(__VLS_576, new __VLS_576({
            key: (item),
            label: (item),
            value: (item),
        }));
        const __VLS_578 = __VLS_577({
            key: (item),
            label: (item),
            value: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_577));
    }
    var __VLS_567;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_580 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_581 = __VLS_asFunctionalComponent(__VLS_580, new __VLS_580({
        modelValue: (__VLS_ctx.form.cbo_zone),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_582 = __VLS_581({
        modelValue: (__VLS_ctx.form.cbo_zone),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_581));
    __VLS_583.slots.default;
    const __VLS_584 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_585 = __VLS_asFunctionalComponent(__VLS_584, new __VLS_584({
        label: "全部",
        value: "",
    }));
    const __VLS_586 = __VLS_585({
        label: "全部",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_585));
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.options.zones))) {
        const __VLS_588 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_589 = __VLS_asFunctionalComponent(__VLS_588, new __VLS_588({
            key: (item),
            label: (item),
            value: (item),
        }));
        const __VLS_590 = __VLS_589({
            key: (item),
            label: (item),
            value: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_589));
    }
    var __VLS_583;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid-2col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_592 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_593 = __VLS_asFunctionalComponent(__VLS_592, new __VLS_592({
        modelValue: (__VLS_ctx.form.cbo_loc_id),
        placeholder: "輸入儲位...",
        clearable: true,
    }));
    const __VLS_594 = __VLS_593({
        modelValue: (__VLS_ctx.form.cbo_loc_id),
        placeholder: "輸入儲位...",
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_593));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_596 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_597 = __VLS_asFunctionalComponent(__VLS_596, new __VLS_596({
        modelValue: (__VLS_ctx.form.cbo_floor),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_598 = __VLS_597({
        modelValue: (__VLS_ctx.form.cbo_floor),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_597));
    __VLS_599.slots.default;
    const __VLS_600 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_601 = __VLS_asFunctionalComponent(__VLS_600, new __VLS_600({
        label: "全部",
        value: "",
    }));
    const __VLS_602 = __VLS_601({
        label: "全部",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_601));
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.options.floors))) {
        const __VLS_604 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_605 = __VLS_asFunctionalComponent(__VLS_604, new __VLS_604({
            key: (item),
            label: (item),
            value: (item),
        }));
        const __VLS_606 = __VLS_605({
            key: (item),
            label: (item),
            value: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_605));
    }
    var __VLS_599;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid-3col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_608 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_609 = __VLS_asFunctionalComponent(__VLS_608, new __VLS_608({
        modelValue: (__VLS_ctx.form.txt_age),
        placeholder: "例:30或10-50",
    }));
    const __VLS_610 = __VLS_609({
        modelValue: (__VLS_ctx.form.txt_age),
        placeholder: "例:30或10-50",
    }, ...__VLS_functionalComponentArgsRest(__VLS_609));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_612 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_613 = __VLS_asFunctionalComponent(__VLS_612, new __VLS_612({
        modelValue: (__VLS_ctx.form.txt_weight),
        placeholder: "例:5",
    }));
    const __VLS_614 = __VLS_613({
        modelValue: (__VLS_ctx.form.txt_weight),
        placeholder: "例:5",
    }, ...__VLS_functionalComponentArgsRest(__VLS_613));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_616 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_617 = __VLS_asFunctionalComponent(__VLS_616, new __VLS_616({
        modelValue: (__VLS_ctx.form.txt_monthly_sales),
        placeholder: "例:100",
    }));
    const __VLS_618 = __VLS_617({
        modelValue: (__VLS_ctx.form.txt_monthly_sales),
        placeholder: "例:100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_617));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid-2col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_620 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_621 = __VLS_asFunctionalComponent(__VLS_620, new __VLS_620({
        modelValue: (__VLS_ctx.form.cbo_type),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_622 = __VLS_621({
        modelValue: (__VLS_ctx.form.cbo_type),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_621));
    __VLS_623.slots.default;
    const __VLS_624 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_625 = __VLS_asFunctionalComponent(__VLS_624, new __VLS_624({
        label: "全部",
        value: "",
    }));
    const __VLS_626 = __VLS_625({
        label: "全部",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_625));
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.options.ap_types))) {
        const __VLS_628 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_629 = __VLS_asFunctionalComponent(__VLS_628, new __VLS_628({
            key: (item),
            label: (item),
            value: (item),
        }));
        const __VLS_630 = __VLS_629({
            key: (item),
            label: (item),
            value: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_629));
    }
    var __VLS_623;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    const __VLS_632 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_633 = __VLS_asFunctionalComponent(__VLS_632, new __VLS_632({
        modelValue: (__VLS_ctx.form.cbo_vol_type),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }));
    const __VLS_634 = __VLS_633({
        modelValue: (__VLS_ctx.form.cbo_vol_type),
        placeholder: "全部",
        clearable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_633));
    __VLS_635.slots.default;
    const __VLS_636 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_637 = __VLS_asFunctionalComponent(__VLS_636, new __VLS_636({
        label: "全部",
        value: "",
    }));
    const __VLS_638 = __VLS_637({
        label: "全部",
        value: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_637));
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.options.vol_types))) {
        const __VLS_640 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_641 = __VLS_asFunctionalComponent(__VLS_640, new __VLS_640({
            key: (item),
            label: (item),
            value: (item),
        }));
        const __VLS_642 = __VLS_641({
            key: (item),
            label: (item),
            value: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_641));
    }
    var __VLS_635;
}
const __VLS_644 = {}.ElDivider;
/** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
// @ts-ignore
const __VLS_645 = __VLS_asFunctionalComponent(__VLS_644, new __VLS_644({
    contentPosition: "left",
}));
const __VLS_646 = __VLS_645({
    contentPosition: "left",
}, ...__VLS_functionalComponentArgsRest(__VLS_645));
__VLS_647.slots.default;
var __VLS_647;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "checkbox-group" },
    ...{ style: {} },
});
const __VLS_648 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_649 = __VLS_asFunctionalComponent(__VLS_648, new __VLS_648({
    modelValue: (__VLS_ctx.form.chk_show_loc),
}));
const __VLS_650 = __VLS_649({
    modelValue: (__VLS_ctx.form.chk_show_loc),
}, ...__VLS_functionalComponentArgsRest(__VLS_649));
__VLS_651.slots.default;
var __VLS_651;
const __VLS_652 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
const __VLS_653 = __VLS_asFunctionalComponent(__VLS_652, new __VLS_652({
    modelValue: (__VLS_ctx.form.chk_show_dim),
}));
const __VLS_654 = __VLS_653({
    modelValue: (__VLS_ctx.form.chk_show_dim),
}, ...__VLS_functionalComponentArgsRest(__VLS_653));
__VLS_655.slots.default;
var __VLS_655;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid-2col" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_656 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_657 = __VLS_asFunctionalComponent(__VLS_656, new __VLS_656({
    modelValue: (__VLS_ctx.form.cbo_sort),
    placeholder: "預設",
    clearable: true,
    ...{ style: {} },
}));
const __VLS_658 = __VLS_657({
    modelValue: (__VLS_ctx.form.cbo_sort),
    placeholder: "預設",
    clearable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_657));
__VLS_659.slots.default;
const __VLS_660 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_661 = __VLS_asFunctionalComponent(__VLS_660, new __VLS_660({
    label: "商品ID",
    value: "商品ID",
}));
const __VLS_662 = __VLS_661({
    label: "商品ID",
    value: "商品ID",
}, ...__VLS_functionalComponentArgsRest(__VLS_661));
const __VLS_664 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_665 = __VLS_asFunctionalComponent(__VLS_664, new __VLS_664({
    label: "儲位",
    value: "儲位",
}));
const __VLS_666 = __VLS_665({
    label: "儲位",
    value: "儲位",
}, ...__VLS_functionalComponentArgsRest(__VLS_665));
const __VLS_668 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_669 = __VLS_asFunctionalComponent(__VLS_668, new __VLS_668({
    label: "庫齡",
    value: "庫齡",
}));
const __VLS_670 = __VLS_669({
    label: "庫齡",
    value: "庫齡",
}, ...__VLS_functionalComponentArgsRest(__VLS_669));
const __VLS_672 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_673 = __VLS_asFunctionalComponent(__VLS_672, new __VLS_672({
    label: "儲位庫存數",
    value: "儲位庫存數",
}));
const __VLS_674 = __VLS_673({
    label: "儲位庫存數",
    value: "儲位庫存數",
}, ...__VLS_functionalComponentArgsRest(__VLS_673));
const __VLS_676 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_677 = __VLS_asFunctionalComponent(__VLS_676, new __VLS_676({
    label: "才數",
    value: "才數",
}));
const __VLS_678 = __VLS_677({
    label: "才數",
    value: "才數",
}, ...__VLS_functionalComponentArgsRest(__VLS_677));
const __VLS_680 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_681 = __VLS_asFunctionalComponent(__VLS_680, new __VLS_680({
    label: "月銷量",
    value: "月銷量",
}));
const __VLS_682 = __VLS_681({
    label: "月銷量",
    value: "月銷量",
}, ...__VLS_functionalComponentArgsRest(__VLS_681));
var __VLS_659;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-group" },
    ...{ style: {} },
});
const __VLS_684 = {}.ElRadioGroup;
/** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
// @ts-ignore
const __VLS_685 = __VLS_asFunctionalComponent(__VLS_684, new __VLS_684({
    modelValue: (__VLS_ctx.form.sort_order),
    ...{ style: {} },
}));
const __VLS_686 = __VLS_685({
    modelValue: (__VLS_ctx.form.sort_order),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_685));
__VLS_687.slots.default;
const __VLS_688 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_689 = __VLS_asFunctionalComponent(__VLS_688, new __VLS_688({
    label: "asc",
}));
const __VLS_690 = __VLS_689({
    label: "asc",
}, ...__VLS_functionalComponentArgsRest(__VLS_689));
__VLS_691.slots.default;
var __VLS_691;
const __VLS_692 = {}.ElRadio;
/** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
// @ts-ignore
const __VLS_693 = __VLS_asFunctionalComponent(__VLS_692, new __VLS_692({
    label: "desc",
}));
const __VLS_694 = __VLS_693({
    label: "desc",
}, ...__VLS_functionalComponentArgsRest(__VLS_693));
__VLS_695.slots.default;
var __VLS_695;
var __VLS_687;
{
    const { footer: __VLS_thisSlot } = __VLS_531.slots;
    const __VLS_696 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_697 = __VLS_asFunctionalComponent(__VLS_696, new __VLS_696({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.loading),
    }));
    const __VLS_698 = __VLS_697({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_697));
    let __VLS_700;
    let __VLS_701;
    let __VLS_702;
    const __VLS_703 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showSearchModal = false;
        }
    };
    __VLS_699.slots.default;
    var __VLS_699;
    const __VLS_704 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_705 = __VLS_asFunctionalComponent(__VLS_704, new __VLS_704({
        ...{ 'onClick': {} },
        type: "danger",
        loading: (__VLS_ctx.loading),
        ...{ style: {} },
    }));
    const __VLS_706 = __VLS_705({
        ...{ 'onClick': {} },
        type: "danger",
        loading: (__VLS_ctx.loading),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_705));
    let __VLS_708;
    let __VLS_709;
    let __VLS_710;
    const __VLS_711 = {
        onClick: (__VLS_ctx.handleSearch)
    };
    __VLS_707.slots.default;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.searchElapsedSec);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    var __VLS_707;
}
var __VLS_531;
const __VLS_712 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_713 = __VLS_asFunctionalComponent(__VLS_712, new __VLS_712({
    title: (`🆔 帳號資料設定 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditRoleDialog),
    width: "380px",
    ...{ class: "dark-dialog" },
}));
const __VLS_714 = __VLS_713({
    title: (`🆔 帳號資料設定 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditRoleDialog),
    width: "380px",
    ...{ class: "dark-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_713));
__VLS_715.slots.default;
const __VLS_716 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_717 = __VLS_asFunctionalComponent(__VLS_716, new __VLS_716({
    labelWidth: "90px",
}));
const __VLS_718 = __VLS_717({
    labelWidth: "90px",
}, ...__VLS_functionalComponentArgsRest(__VLS_717));
__VLS_719.slots.default;
const __VLS_720 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_721 = __VLS_asFunctionalComponent(__VLS_720, new __VLS_720({
    label: "使用者姓名",
}));
const __VLS_722 = __VLS_721({
    label: "使用者姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_721));
__VLS_723.slots.default;
const __VLS_724 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_725 = __VLS_asFunctionalComponent(__VLS_724, new __VLS_724({
    modelValue: (__VLS_ctx.editRoleForm.target_name),
    placeholder: "請輸入真實姓名",
}));
const __VLS_726 = __VLS_725({
    modelValue: (__VLS_ctx.editRoleForm.target_name),
    placeholder: "請輸入真實姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_725));
var __VLS_723;
const __VLS_728 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_729 = __VLS_asFunctionalComponent(__VLS_728, new __VLS_728({
    label: "帳號身份",
}));
const __VLS_730 = __VLS_729({
    label: "帳號身份",
}, ...__VLS_functionalComponentArgsRest(__VLS_729));
__VLS_731.slots.default;
const __VLS_732 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_733 = __VLS_asFunctionalComponent(__VLS_732, new __VLS_732({
    modelValue: (__VLS_ctx.editRoleForm.target_role),
    ...{ style: {} },
}));
const __VLS_734 = __VLS_733({
    modelValue: (__VLS_ctx.editRoleForm.target_role),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_733));
__VLS_735.slots.default;
const __VLS_736 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_737 = __VLS_asFunctionalComponent(__VLS_736, new __VLS_736({
    label: "👑 管理員 (admin)",
    value: "admin",
}));
const __VLS_738 = __VLS_737({
    label: "👑 管理員 (admin)",
    value: "admin",
}, ...__VLS_functionalComponentArgsRest(__VLS_737));
const __VLS_740 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_741 = __VLS_asFunctionalComponent(__VLS_740, new __VLS_740({
    label: "👤 一般人員 (user)",
    value: "user",
}));
const __VLS_742 = __VLS_741({
    label: "👤 一般人員 (user)",
    value: "user",
}, ...__VLS_functionalComponentArgsRest(__VLS_741));
var __VLS_735;
var __VLS_731;
var __VLS_719;
{
    const { footer: __VLS_thisSlot } = __VLS_715.slots;
    const __VLS_744 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_745 = __VLS_asFunctionalComponent(__VLS_744, new __VLS_744({
        ...{ 'onClick': {} },
    }));
    const __VLS_746 = __VLS_745({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_745));
    let __VLS_748;
    let __VLS_749;
    let __VLS_750;
    const __VLS_751 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showEditRoleDialog = false;
        }
    };
    __VLS_747.slots.default;
    var __VLS_747;
    const __VLS_752 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_753 = __VLS_asFunctionalComponent(__VLS_752, new __VLS_752({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_754 = __VLS_753({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_753));
    let __VLS_756;
    let __VLS_757;
    let __VLS_758;
    const __VLS_759 = {
        onClick: (__VLS_ctx.handleUpdateRole)
    };
    __VLS_755.slots.default;
    var __VLS_755;
}
var __VLS_715;
const __VLS_760 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_761 = __VLS_asFunctionalComponent(__VLS_760, new __VLS_760({
    title: (`✏️ 修改密碼 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditPwdDialog),
    width: "380px",
    ...{ class: "dark-dialog" },
}));
const __VLS_762 = __VLS_761({
    title: (`✏️ 修改密碼 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditPwdDialog),
    width: "380px",
    ...{ class: "dark-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_761));
__VLS_763.slots.default;
const __VLS_764 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_765 = __VLS_asFunctionalComponent(__VLS_764, new __VLS_764({
    labelWidth: "80px",
}));
const __VLS_766 = __VLS_765({
    labelWidth: "80px",
}, ...__VLS_functionalComponentArgsRest(__VLS_765));
__VLS_767.slots.default;
const __VLS_768 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_769 = __VLS_asFunctionalComponent(__VLS_768, new __VLS_768({
    label: "新密碼",
}));
const __VLS_770 = __VLS_769({
    label: "新密碼",
}, ...__VLS_functionalComponentArgsRest(__VLS_769));
__VLS_771.slots.default;
const __VLS_772 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_773 = __VLS_asFunctionalComponent(__VLS_772, new __VLS_772({
    modelValue: (__VLS_ctx.editPasswordForm.new_password),
    type: "password",
    placeholder: "請輸入新密碼",
    showPassword: true,
}));
const __VLS_774 = __VLS_773({
    modelValue: (__VLS_ctx.editPasswordForm.new_password),
    type: "password",
    placeholder: "請輸入新密碼",
    showPassword: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_773));
var __VLS_771;
var __VLS_767;
{
    const { footer: __VLS_thisSlot } = __VLS_763.slots;
    const __VLS_776 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_777 = __VLS_asFunctionalComponent(__VLS_776, new __VLS_776({
        ...{ 'onClick': {} },
    }));
    const __VLS_778 = __VLS_777({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_777));
    let __VLS_780;
    let __VLS_781;
    let __VLS_782;
    const __VLS_783 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showEditPwdDialog = false;
        }
    };
    __VLS_779.slots.default;
    var __VLS_779;
    const __VLS_784 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_785 = __VLS_asFunctionalComponent(__VLS_784, new __VLS_784({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_786 = __VLS_785({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_785));
    let __VLS_788;
    let __VLS_789;
    let __VLS_790;
    const __VLS_791 = {
        onClick: (__VLS_ctx.handleUpdatePassword)
    };
    __VLS_787.slots.default;
    var __VLS_787;
}
var __VLS_763;
const __VLS_792 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_793 = __VLS_asFunctionalComponent(__VLS_792, new __VLS_792({
    title: (`🔐 設定模組權限 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditPermDialog),
    width: "420px",
    ...{ class: "dark-dialog" },
}));
const __VLS_794 = __VLS_793({
    title: (`🔐 設定模組權限 - [${__VLS_ctx.targetUser}]`),
    modelValue: (__VLS_ctx.showEditPermDialog),
    width: "420px",
    ...{ class: "dark-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_793));
__VLS_795.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
const __VLS_796 = {}.ElCheckboxGroup;
/** @type {[typeof __VLS_components.ElCheckboxGroup, typeof __VLS_components.elCheckboxGroup, typeof __VLS_components.ElCheckboxGroup, typeof __VLS_components.elCheckboxGroup, ]} */ ;
// @ts-ignore
const __VLS_797 = __VLS_asFunctionalComponent(__VLS_796, new __VLS_796({
    modelValue: (__VLS_ctx.editPermForm.selected_modules),
}));
const __VLS_798 = __VLS_797({
    modelValue: (__VLS_ctx.editPermForm.selected_modules),
}, ...__VLS_functionalComponentArgsRest(__VLS_797));
__VLS_799.slots.default;
for (const [mod] of __VLS_getVForSourceType((__VLS_ctx.availableModules))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (mod.key),
        ...{ style: {} },
    });
    const __VLS_800 = {}.ElCheckbox;
    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
    // @ts-ignore
    const __VLS_801 = __VLS_asFunctionalComponent(__VLS_800, new __VLS_800({
        label: (mod.key),
    }));
    const __VLS_802 = __VLS_801({
        label: (mod.key),
    }, ...__VLS_functionalComponentArgsRest(__VLS_801));
    __VLS_803.slots.default;
    (mod.name);
    var __VLS_803;
}
var __VLS_799;
{
    const { footer: __VLS_thisSlot } = __VLS_795.slots;
    const __VLS_804 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_805 = __VLS_asFunctionalComponent(__VLS_804, new __VLS_804({
        ...{ 'onClick': {} },
    }));
    const __VLS_806 = __VLS_805({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_805));
    let __VLS_808;
    let __VLS_809;
    let __VLS_810;
    const __VLS_811 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showEditPermDialog = false;
        }
    };
    __VLS_807.slots.default;
    var __VLS_807;
    const __VLS_812 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_813 = __VLS_asFunctionalComponent(__VLS_812, new __VLS_812({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_814 = __VLS_813({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_813));
    let __VLS_816;
    let __VLS_817;
    let __VLS_818;
    const __VLS_819 = {
        onClick: (__VLS_ctx.handleUpdatePermissions)
    };
    __VLS_815.slots.default;
    var __VLS_815;
}
var __VLS_795;
const __VLS_820 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_821 = __VLS_asFunctionalComponent(__VLS_820, new __VLS_820({
    title: "📋 設定一般模式顯示欄位與順序 (全公司同步)",
    modelValue: (__VLS_ctx.showColSettingDialog),
    width: "560px",
    ...{ class: "dark-dialog pretty-col-dialog" },
}));
const __VLS_822 = __VLS_821({
    title: "📋 設定一般模式顯示欄位與順序 (全公司同步)",
    modelValue: (__VLS_ctx.showColSettingDialog),
    width: "560px",
    ...{ class: "dark-dialog pretty-col-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_821));
__VLS_823.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-setting-header-info" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tip-text" },
});
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "quick-select-btns" },
    });
    const __VLS_824 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_825 = __VLS_asFunctionalComponent(__VLS_824, new __VLS_824({
        ...{ 'onClick': {} },
        size: "mini",
        type: "primary",
        plain: true,
    }));
    const __VLS_826 = __VLS_825({
        ...{ 'onClick': {} },
        size: "mini",
        type: "primary",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_825));
    let __VLS_828;
    let __VLS_829;
    let __VLS_830;
    const __VLS_831 = {
        onClick: (__VLS_ctx.selectAllCols)
    };
    __VLS_827.slots.default;
    var __VLS_827;
    const __VLS_832 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_833 = __VLS_asFunctionalComponent(__VLS_832, new __VLS_832({
        ...{ 'onClick': {} },
        size: "mini",
        type: "info",
        plain: true,
    }));
    const __VLS_834 = __VLS_833({
        ...{ 'onClick': {} },
        size: "mini",
        type: "info",
        plain: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_833));
    let __VLS_836;
    let __VLS_837;
    let __VLS_838;
    const __VLS_839 = {
        onClick: (__VLS_ctx.unselectAllCols)
    };
    __VLS_835.slots.default;
    var __VLS_835;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-scroll-box pretty-scroll-box" },
});
if (__VLS_ctx.isAdmin) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "admin-drag-cols" },
    });
    for (const [col, idx] of __VLS_getVForSourceType((__VLS_ctx.allAvailableColumns))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onDragstart: (...[$event]) => {
                    if (!(__VLS_ctx.isAdmin))
                        return;
                    __VLS_ctx.onDragStart($event, idx);
                } },
            ...{ onDragover: (...[$event]) => {
                    if (!(__VLS_ctx.isAdmin))
                        return;
                    __VLS_ctx.onDragOver($event, idx);
                } },
            ...{ onDrop: (__VLS_ctx.onDrop) },
            ...{ onDragend: (__VLS_ctx.onDragEnd) },
            key: (col),
            draggable: "true",
            ...{ class: "pretty-drag-item" },
            ...{ class: ({ 'dragging-item': __VLS_ctx.draggedIndex === idx, 'is-selected': __VLS_ctx.form.selected_columns.includes(col) }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "drag-left" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "drag-handle" },
            title: "按住左鍵上下拖拉",
        });
        const __VLS_840 = {}.ElCheckbox;
        /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
        // @ts-ignore
        const __VLS_841 = __VLS_asFunctionalComponent(__VLS_840, new __VLS_840({
            ...{ 'onChange': {} },
            label: (col),
            modelValue: (__VLS_ctx.form.selected_columns.includes(col)),
        }));
        const __VLS_842 = __VLS_841({
            ...{ 'onChange': {} },
            label: (col),
            modelValue: (__VLS_ctx.form.selected_columns.includes(col)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_841));
        let __VLS_844;
        let __VLS_845;
        let __VLS_846;
        const __VLS_847 = {
            onChange: (...[$event]) => {
                if (!(__VLS_ctx.isAdmin))
                    return;
                __VLS_ctx.toggleColumnSelection(col);
            }
        };
        __VLS_843.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "col-code-tag" },
        });
        (__VLS_ctx.getColLetter(__VLS_ctx.getColOriginalIndex(col)));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "col-name-text" },
        });
        (col);
        var __VLS_843;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "drag-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "order-badge" },
            ...{ class: ({ 'active-badge': __VLS_ctx.form.selected_columns.includes(col) }) },
        });
        (idx + 1);
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "user-readonly-cols" },
    });
    for (const [col, idx] of __VLS_getVForSourceType((__VLS_ctx.allAvailableColumns))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (col),
            ...{ class: "pretty-readonly-item" },
            ...{ class: ({ 'is-selected': __VLS_ctx.form.selected_columns.includes(col) }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "drag-left" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "col-code-tag" },
        });
        (__VLS_ctx.getColLetter(__VLS_ctx.getColOriginalIndex(col)));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "col-name-text" },
        });
        (col);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "drag-right" },
        });
        if (__VLS_ctx.form.selected_columns.includes(col)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "order-badge active-badge" },
            });
            (__VLS_ctx.getSelectedOrder(col));
        }
        if (__VLS_ctx.form.selected_columns.includes(col)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "checked-tag" },
            });
        }
    }
}
{
    const { footer: __VLS_thisSlot } = __VLS_823.slots;
    const __VLS_848 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_849 = __VLS_asFunctionalComponent(__VLS_848, new __VLS_848({
        ...{ 'onClick': {} },
    }));
    const __VLS_850 = __VLS_849({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_849));
    let __VLS_852;
    let __VLS_853;
    let __VLS_854;
    const __VLS_855 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showColSettingDialog = false;
        }
    };
    __VLS_851.slots.default;
    var __VLS_851;
    const __VLS_856 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_857 = __VLS_asFunctionalComponent(__VLS_856, new __VLS_856({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.savingConfig),
    }));
    const __VLS_858 = __VLS_857({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.savingConfig),
    }, ...__VLS_functionalComponentArgsRest(__VLS_857));
    let __VLS_860;
    let __VLS_861;
    let __VLS_862;
    const __VLS_863 = {
        onClick: (__VLS_ctx.saveColumnConfig)
    };
    __VLS_859.slots.default;
    (__VLS_ctx.isAdmin ? '💾 儲存並同步至全公司' : '確定');
    var __VLS_859;
}
var __VLS_823;
const __VLS_864 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
const __VLS_865 = __VLS_asFunctionalComponent(__VLS_864, new __VLS_864({
    title: "新增員編帳號",
    modelValue: (__VLS_ctx.showAddUserDialog),
    width: "400px",
    ...{ class: "dark-dialog" },
}));
const __VLS_866 = __VLS_865({
    title: "新增員編帳號",
    modelValue: (__VLS_ctx.showAddUserDialog),
    width: "400px",
    ...{ class: "dark-dialog" },
}, ...__VLS_functionalComponentArgsRest(__VLS_865));
__VLS_867.slots.default;
const __VLS_868 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_869 = __VLS_asFunctionalComponent(__VLS_868, new __VLS_868({
    model: (__VLS_ctx.newUserForm),
    labelWidth: "110px",
}));
const __VLS_870 = __VLS_869({
    model: (__VLS_ctx.newUserForm),
    labelWidth: "110px",
}, ...__VLS_functionalComponentArgsRest(__VLS_869));
__VLS_871.slots.default;
const __VLS_872 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_873 = __VLS_asFunctionalComponent(__VLS_872, new __VLS_872({
    label: "使用者姓名",
}));
const __VLS_874 = __VLS_873({
    label: "使用者姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_873));
__VLS_875.slots.default;
const __VLS_876 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_877 = __VLS_asFunctionalComponent(__VLS_876, new __VLS_876({
    modelValue: (__VLS_ctx.newUserForm.name),
    placeholder: "請輸入真實姓名",
}));
const __VLS_878 = __VLS_877({
    modelValue: (__VLS_ctx.newUserForm.name),
    placeholder: "請輸入真實姓名",
}, ...__VLS_functionalComponentArgsRest(__VLS_877));
var __VLS_875;
const __VLS_880 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_881 = __VLS_asFunctionalComponent(__VLS_880, new __VLS_880({
    label: "帳號(6碼員編)",
}));
const __VLS_882 = __VLS_881({
    label: "帳號(6碼員編)",
}, ...__VLS_functionalComponentArgsRest(__VLS_881));
__VLS_883.slots.default;
const __VLS_884 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_885 = __VLS_asFunctionalComponent(__VLS_884, new __VLS_884({
    modelValue: (__VLS_ctx.newUserForm.username),
    placeholder: "請輸入6碼純數字員編",
}));
const __VLS_886 = __VLS_885({
    modelValue: (__VLS_ctx.newUserForm.username),
    placeholder: "請輸入6碼純數字員編",
}, ...__VLS_functionalComponentArgsRest(__VLS_885));
var __VLS_883;
const __VLS_888 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_889 = __VLS_asFunctionalComponent(__VLS_888, new __VLS_888({
    label: "初始預設密碼",
}));
const __VLS_890 = __VLS_889({
    label: "初始預設密碼",
}, ...__VLS_functionalComponentArgsRest(__VLS_889));
__VLS_891.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ style: {} },
});
var __VLS_891;
const __VLS_892 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_893 = __VLS_asFunctionalComponent(__VLS_892, new __VLS_892({
    label: "身份權限",
}));
const __VLS_894 = __VLS_893({
    label: "身份權限",
}, ...__VLS_functionalComponentArgsRest(__VLS_893));
__VLS_895.slots.default;
const __VLS_896 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_897 = __VLS_asFunctionalComponent(__VLS_896, new __VLS_896({
    modelValue: (__VLS_ctx.newUserForm.role),
    ...{ style: {} },
}));
const __VLS_898 = __VLS_897({
    modelValue: (__VLS_ctx.newUserForm.role),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_897));
__VLS_899.slots.default;
const __VLS_900 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_901 = __VLS_asFunctionalComponent(__VLS_900, new __VLS_900({
    label: "👤 一般人員",
    value: "user",
}));
const __VLS_902 = __VLS_901({
    label: "👤 一般人員",
    value: "user",
}, ...__VLS_functionalComponentArgsRest(__VLS_901));
const __VLS_904 = {}.ElOption;
/** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
// @ts-ignore
const __VLS_905 = __VLS_asFunctionalComponent(__VLS_904, new __VLS_904({
    label: "👑 管理員",
    value: "admin",
}));
const __VLS_906 = __VLS_905({
    label: "👑 管理員",
    value: "admin",
}, ...__VLS_functionalComponentArgsRest(__VLS_905));
var __VLS_899;
var __VLS_895;
var __VLS_871;
{
    const { footer: __VLS_thisSlot } = __VLS_867.slots;
    const __VLS_908 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_909 = __VLS_asFunctionalComponent(__VLS_908, new __VLS_908({
        ...{ 'onClick': {} },
    }));
    const __VLS_910 = __VLS_909({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_909));
    let __VLS_912;
    let __VLS_913;
    let __VLS_914;
    const __VLS_915 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showAddUserDialog = false;
        }
    };
    __VLS_911.slots.default;
    var __VLS_911;
    const __VLS_916 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_917 = __VLS_asFunctionalComponent(__VLS_916, new __VLS_916({
        ...{ 'onClick': {} },
        type: "primary",
    }));
    const __VLS_918 = __VLS_917({
        ...{ 'onClick': {} },
        type: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_917));
    let __VLS_920;
    let __VLS_921;
    let __VLS_922;
    const __VLS_923 = {
        onClick: (__VLS_ctx.handleAddUser)
    };
    __VLS_919.slots.default;
    var __VLS_919;
}
var __VLS_867;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-mode']} */ ;
/** @type {__VLS_StyleScopedClasses['login-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['login-card']} */ ;
/** @type {__VLS_StyleScopedClasses['login-header']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['login-form']} */ ;
/** @type {__VLS_StyleScopedClasses['login-btn-full']} */ ;
/** @type {__VLS_StyleScopedClasses['app-main-content']} */ ;
/** @type {__VLS_StyleScopedClasses['top-navbar']} */ ;
/** @type {__VLS_StyleScopedClasses['navbar-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-title']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-version']} */ ;
/** @type {__VLS_StyleScopedClasses['navbar-center-title']} */ ;
/** @type {__VLS_StyleScopedClasses['center-title-text']} */ ;
/** @type {__VLS_StyleScopedClasses['top-right-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['header-export-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['unified-menu-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['scroll-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
/** @type {__VLS_StyleScopedClasses['standalone']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['main-scrollable']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-box-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-info']} */ ;
/** @type {__VLS_StyleScopedClasses['status-title']} */ ;
/** @type {__VLS_StyleScopedClasses['percent-text']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-subtext']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight-vol']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight-health']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['scroll-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dual-column-row']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['left-block']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-only-section']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['blue-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['fit-table']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['right-block']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['green-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-table']} */ ;
/** @type {__VLS_StyleScopedClasses['dual-column-row']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['left-block']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-only-section']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['blue-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['fit-table']} */ ;
/** @type {__VLS_StyleScopedClasses['column-block']} */ ;
/** @type {__VLS_StyleScopedClasses['right-block']} */ ;
/** @type {__VLS_StyleScopedClasses['block-header-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['green-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-table']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['content-area']} */ ;
/** @type {__VLS_StyleScopedClasses['standalone']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['top-action-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-bar-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['search-trigger-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-bar-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-bar-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-bar-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['report-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['report-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-hide']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['time']} */ ;
/** @type {__VLS_StyleScopedClasses['table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['scrollable-table-box']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-box']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-header']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['main-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-header']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-table']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-container']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['coming-soon-card']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-card']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-drawer']} */ ;
/** @type {__VLS_StyleScopedClasses['unified-drawer']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-content-box']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-section']} */ ;
/** @type {__VLS_StyleScopedClasses['user-section']} */ ;
/** @type {__VLS_StyleScopedClasses['user-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['user-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['name']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-logout-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-box']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['val']} */ ;
/** @type {__VLS_StyleScopedClasses['date-val']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['val']} */ ;
/** @type {__VLS_StyleScopedClasses['online-val']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-row']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['val']} */ ;
/** @type {__VLS_StyleScopedClasses['idle-val']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['drawer-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-list']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['setting']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['setting']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['setting']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-search-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['normal-search-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-3col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-group']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-2col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-col-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['col-setting-header-info']} */ ;
/** @type {__VLS_StyleScopedClasses['tip-text']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-select-btns']} */ ;
/** @type {__VLS_StyleScopedClasses['col-scroll-box']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-scroll-box']} */ ;
/** @type {__VLS_StyleScopedClasses['admin-drag-cols']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-drag-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dragging-item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-left']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['col-code-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['col-name-text']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-right']} */ ;
/** @type {__VLS_StyleScopedClasses['order-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['active-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['user-readonly-cols']} */ ;
/** @type {__VLS_StyleScopedClasses['pretty-readonly-item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-left']} */ ;
/** @type {__VLS_StyleScopedClasses['col-code-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['col-name-text']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-right']} */ ;
/** @type {__VLS_StyleScopedClasses['order-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['active-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['checked-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-dialog']} */ ;
var __VLS_dollars;
let __VLS_self;
