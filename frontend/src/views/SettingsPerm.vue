<!-- frontend/src/views/SettingsPerm.vue -->
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
        <el-table-column prop="username" label="登入帳號" width="120">
          <template #default="scope">
            <span class="cell-username">{{ scope.row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="姓名" width="130">
          <template #default="scope">
            <span class="cell-name">
              {{ scope.row.name || (scope.row.username === 'admin' ? '系統管理員' : scope.row.username) }}
            </span>
          </template>
        </el-table-column>

        <!-- 新增：所屬組別欄位 -->
        <el-table-column prop="staff_group" label="所屬組別" width="135">
          <template #default="scope">
            <span v-if="scope.row.staff_group" class="group-badge" :class="scope.row.staff_group === '管理組' ? 'grp-mgmt' : ''">
              {{ scope.row.staff_group }}
            </span>
            <span v-else class="group-empty">未設定</span>
          </template>
        </el-table-column>

        <!-- 身份角色標籤對應 -->
        <el-table-column prop="role" label="身份" width="145">
          <template #default="scope">
            <el-tag :type="getRoleTagType(scope.row)" size="small">
              {{ getRoleLabel(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 在線狀態 -->
        <el-table-column label="在線狀態" width="100">
          <template #default="scope">
            <span v-if="isUserOnline(scope.row)" class="status-online">🟢 在線</span>
            <span v-else class="status-offline">⚪ 離線</span>
          </template>
        </el-table-column>

        <!-- 密碼：只有系統管理員 (isSysAdmin) 可直接檢視明文密碼 -->
        <el-table-column label="密碼" width="120">
          <template #default="scope">
            <span v-if="scope.row.username === 'guest'" class="guest-pwd-tip">免密碼直達</span>
            <span v-else-if="isSysAdmin" class="pwd-plain">{{ scope.row.password || '-' }}</span>
            <span v-else class="pwd-mask">******</span>
          </template>
        </el-table-column>

        <el-table-column label="開放功能模組 (含匯入/匯出權限)" min-width="260">
          <template #default="scope">
            <span class="cell-perm-text">
              {{ formatPermissions(scope.row.permissions) }}
            </span>
          </template>
        </el-table-column>

        <!-- 操作按鈕群組 -->
        <el-table-column label="操作" width="360" fixed="right" align="center">
          <template #default="scope">
            <div class="opt-btn-group">
              <el-button type="purple" size="small" class="opt-btn purple-btn" @click="$emit('open-role', scope.row)">
                🆔 身份設定
              </el-button>
              
              <el-button 
                v-if="scope.row.username !== 'guest'"
                type="warning" 
                size="small" 
                class="opt-btn warning-btn" 
                @click="$emit('open-pwd', scope.row)"
              >
                修改密碼
              </el-button>
              <el-button 
                v-else
                type="info" 
                size="small" 
                class="opt-btn info-btn-disabled" 
                disabled
              >
                免設密碼
              </el-button>

              <el-button type="primary" size="small" class="opt-btn primary-btn" @click="$emit('open-perm', scope.row)">
                權限設定
              </el-button>
              
              <el-button 
                type="danger" 
                size="small" 
                class="opt-btn danger-btn" 
                :disabled="scope.row.username === 'admin' || scope.row.username === 'guest'"
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
    },
    isSysAdmin: {
      type: Boolean,
      default: false
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
  data() {
    return {
      autoRefreshTimer: null
    };
  },
  mounted() {
    this.$emit('refresh-users');
    this.autoRefreshTimer = setInterval(() => {
      this.$emit('refresh-users');
    }, 5000);
  },
  beforeUnmount() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
  },
  methods: {
    getRoleLabel(row) {
      if (!row) return '👤 一般人員';
      if (row.username === 'guest' || row.role === 'guest') return '🌐 訪客直達';
      const role = row.role;
      if (role === 'sys_admin' || row.username === 'admin') return '👑 系統管理員';
      if (role === 'admin') return '👑 管理員';
      return '👤 一般人員';
    },
    getRoleTagType(row) {
      if (!row) return 'info';
      if (row.username === 'guest' || row.role === 'guest') return 'success';
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
      if (!perms) return '無權限';
      if (perms === 'all' || perms === 'all,') return '全模組權限 (含全部匯入/匯出)';

      const moduleMap = {
        'loc_summary': '儲位數才數統整',
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'item_sales_history': '全商品歷史銷量與進貨履歷',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單',
        'inbound_fish': '進貨上架魚群',
        'replenish_fish': '立即補貨單魚群',
        'transfer_80_15': '跨庫調撥 80>15',
        'transfer_15_80': '跨庫調撥 15>80',
        'dispatch_fish': '收發魚群出沒分析',
        'delivery_flow': '宅配出貨流線魚群',
        'delivery_cost': '物流費與包材成本分析',
        'delivery_undelivered': '未配達與異常貨態追蹤',
        'staff_competency': '人員綜合能力管理',
        'storage_accuracy': '80庫儲位準確率',
        'wms_fish_screenshot': 'WMS 魚群截圖辨識'
      };

      const rawList = Array.isArray(perms) 
        ? perms 
        : String(perms).split(',').map(s => s.trim()).filter(Boolean);

      const permSet = new Set(rawList);
      const baseModules = [];

      rawList.forEach(token => {
        if (!token.includes(':')) {
          baseModules.push(token);
        }
      });

      if (baseModules.length === 0) return '無權限';

      return baseModules.map(key => {
        const label = moduleMap[key] || key;
        const canImp = permSet.has(`${key}:import`);
        const canExp = permSet.has(`${key}:export`);
        const actions = [];
        if (canImp) actions.push('匯入');
        if (canExp) actions.push('匯出');
        return actions.length > 0 ? `${label}(${actions.join('/')})` : label;
      }).join('、');
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
.group-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  background: rgba(56, 189, 248, 0.16);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.35);
}
.group-badge.grp-mgmt {
  background: rgba(250, 204, 21, 0.18);
  color: #fde047;
  border-color: rgba(250, 204, 21, 0.45);
}
.group-empty { color: #64748b !important; font-size: 12px; }

.status-online { color: #4ade80 !important; font-weight: bold; font-size: 13px; }
.status-offline { color: #94a3b8 !important; font-size: 13px; }
.pwd-plain { color: #fde047 !important; font-weight: bold; font-family: monospace; font-size: 13px; }
.pwd-mask { color: #64748b !important; }
.guest-pwd-tip { color: #38bdf8 !important; font-size: 12px; font-weight: bold; }
.cell-perm-text { color: #cbd5e1 !important; font-size: 13px; line-height: 1.5; }

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

.opt-btn.info-btn-disabled {
  background-color: #334155 !important;
  border-color: #475569 !important;
  color: #94a3b8 !important;
  cursor: not-allowed !important;
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