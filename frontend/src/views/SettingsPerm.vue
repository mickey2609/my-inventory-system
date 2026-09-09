<template>
  <div class="settings-perm-container dark-view">
    <!-- 頂部操作列 -->
    <div class="action-header">
      <div class="title-group">
        <h2>🔐 權限設定 (帳號管理)</h2>
      </div>

      <div class="btn-group">
        <button class="action-btn warning-btn" @click="$emit('open-import-tip')">
          📥 批次匯入帳號
        </button>
        <button class="action-btn success-btn" @click="$emit('export-users')">
          📊 匯出帳號與權限
        </button>
        <button class="action-btn info-btn" @click="$emit('refresh-users')">
          🔄 重新整理
        </button>
        <button class="action-btn primary-btn" @click="$emit('open-add-dialog')">
          ➕ 新增帳號
        </button>
      </div>
    </div>

    <!-- 表格卡片區 -->
    <div class="table-card">
      <el-table 
        :data="usersList" 
        style="width: 100%" 
        height="100%"
        class="custom-perm-table"
        empty-text="目前尚無帳號資料"
      >
        <el-table-column prop="username" label="登入帳號" width="130">
          <template #default="scope">
            <span class="cell-username">{{ scope.row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="姓名" width="150">
          <template #default="scope">
            <span class="cell-name">
              {{ scope.row.name || (scope.row.username === 'admin' ? '系統管理員' : scope.row.username) }}
            </span>
          </template>
        </el-table-column>

        <!-- 身份角色標籤對應 (sys_admin / admin / user) -->
        <el-table-column prop="role" label="身份" width="150">
          <template #default="scope">
            <el-tag :type="getRoleTagType(scope.row)" size="small">
              {{ getRoleLabel(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 精準全域在線狀態判定 -->
        <el-table-column label="在線狀態" width="110">
          <template #default="scope">
            <span v-if="isUserOnline(scope.row)" class="status-online">🟢 在線</span>
            <span v-else class="status-offline">⚪ 離線</span>
          </template>
        </el-table-column>

        <el-table-column label="密碼" width="100">
          <template #default>
            <span class="pwd-mask">******</span>
          </template>
        </el-table-column>

        <el-table-column label="開放功能模組" min-width="180">
          <template #default="scope">
            <span class="cell-perm-text">
              {{ formatPermissions(scope.row.permissions) }}
            </span>
          </template>
        </el-table-column>

        <!-- 🌟【關鍵修復 1】將欄寬改為 360，確保右側「刪除」按鈕不會被切掉邊緣 -->
        <el-table-column label="操作" width="360" fixed="right" align="center">
          <template #default="scope">
            <div class="opt-btn-group">
              <el-button type="purple" size="small" class="opt-btn purple-btn" @click="$emit('open-role', scope.row)">
                🆔 身份設定
              </el-button>
              <el-button type="warning" size="small" class="opt-btn warning-btn" @click="$emit('open-pwd', scope.row)">
                修改密碼
              </el-button>
              <el-button type="primary" size="small" class="opt-btn primary-btn" @click="$emit('open-perm', scope.row)">
                權限設定
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                class="opt-btn danger-btn" 
                :disabled="scope.row.username === 'admin'"
                @click="$emit('delete-user', scope.row.username)"
              >
                刪除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SettingsPerm',
  props: {
    usersList: {
      type: Array,
      default: () => []
    },
    currentUser: {
      type: String,
      default: ''
    },
    currentUsername: {
      type: String,
      default: ''
    }
  },
  emits: [
    'open-import-tip',
    'export-users',
    'refresh-users',
    'open-add-dialog',
    'open-role',
    'open-pwd',
    'open-perm',
    'delete-user'
  ],
  methods: {
    getRoleLabel(row) {
      if (!row) return '👤 一般人員';
      const role = row.role;
      if (role === 'sys_admin' || row.username === 'admin') return '👑 系統管理員';
      if (role === 'admin') return '👑 管理員';
      return '👤 一般人員';
    },
    getRoleTagType(row) {
      if (!row) return 'info';
      const role = row.role;
      if (role === 'sys_admin' || row.username === 'admin') return 'danger'; 
      if (role === 'admin') return 'warning'; 
      return 'info';                          
    },
    isUserOnline(row) {
      if (!row) return false;
      if (row.is_online !== undefined && row.is_online !== null) {
        return row.is_online;
      }

      const curUser = (this.currentUser || '').toLowerCase();
      const curUsername = (this.currentUsername || '').toLowerCase();
      const rowUser = (row.username || '').toLowerCase();
      const rowName = (row.name || '').toLowerCase();

      return (rowUser && rowUser === curUsername) || 
             (rowUser && rowUser === curUser) || 
             (rowName && rowName === curUser);
    },
    formatPermissions(perms) {
      if (!perms || perms === 'all' || perms === 'all,') return '全模組開放';
      if (Array.isArray(perms)) {
        return perms.length > 0 ? perms.join(', ') : '全模組開放';
      }
      const namesMap = {
        'loc_summary': '儲位數才數統整',
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單'
      };
      const arr = String(perms).split(',').map(s => s.trim()).filter(Boolean);
      return arr.map(k => namesMap[k] || k).join(', ');
    }
  }
}
</script>

<style scoped>
.settings-perm-container {
  padding: 20px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #0f172a;
  color: #f8fafc;
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title-group h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #38bdf8;
}

.btn-group {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  color: #ffffff;
  transition: opacity 0.2s;
}

.action-btn:hover { opacity: 0.85; }
.warning-btn { background-color: #d97706; }
.success-btn { background-color: #059669; }
.info-btn { background-color: #475569; }
.primary-btn { background-color: #2563eb; }

.table-card {
  flex: 1;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  overflow: hidden;
}

.cell-username { color: #38bdf8 !important; font-weight: bold; }
.cell-name { color: #f1f5f9 !important; font-weight: bold; font-size: 14px; }
.status-online { color: #4ade80 !important; font-weight: bold; font-size: 13px; }
.status-offline { color: #94a3b8 !important; font-size: 13px; }
.pwd-mask { color: #64748b !important; }
.cell-perm-text { color: #cbd5e1 !important; font-size: 13px; }

/* 🌟【關鍵修復 2】縮微按鈕間距與外距，擺脫邊緣遮擋問題 */
.opt-btn-group {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding-right: 6px;
}

.opt-btn-group .el-button {
  margin-left: 0 !important;
  padding: 7px 9px !important;
}

.opt-btn.purple-btn {
  background-color: #8b5cf6 !important;
  border-color: #7c3aed !important;
  color: #ffffff !important;
}

:deep(.custom-perm-table) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
}

:deep(.custom-perm-table th.el-table__cell) {
  background-color: #0f172a !important;
  color: #38bdf8 !important;
  border-bottom: 1px solid #334155 !important;
  font-weight: bold;
}

:deep(.custom-perm-table td.el-table__cell) {
  background-color: #1e293b !important;
  border-bottom: 1px solid #334155 !important;
  color: #f8fafc !important;
}

:deep(.custom-perm-table .el-table__empty-block) {
  background-color: #1e293b !important;
}
</style>