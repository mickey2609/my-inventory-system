<template>
  <div class="settings-log-container dark-view">
    <!-- 頂部操作列 -->
    <div class="action-header">
      <div class="title-group">
        <h2>📜 系統日誌查詢</h2>
        <div class="tab-toggle">
          <button 
            class="toggle-btn" 
            :class="{ active: logTab === 'normal' }" 
            @click="$emit('update:logTab', 'normal')"
          >
            📋 正常操作歷程
          </button>
          <button 
            class="toggle-btn error-btn" 
            :class="{ active: logTab === 'error' }" 
            @click="$emit('update:logTab', 'error')"
          >
            ⚠️ 系統錯誤日誌
          </button>
        </div>
      </div>

      <button class="refresh-btn" @click="$emit('refresh-logs')">
        🔄 重新整理
      </button>
    </div>

    <!-- 深色表格內容區 -->
    <div class="table-card">
      <el-table 
        :data="displayLogs" 
        style="width: 100%" 
        height="100%"
        class="dark-table"
        empty-text="目前尚無相關日誌紀錄"
      >
        <el-table-column prop="username" label="登入帳號" width="120" />
        <el-table-column prop="name" label="登入名稱" width="130">
          <template #default="scope">
            {{ scope.row.name || scope.row.username || '系統使用者' }}
          </template>
        </el-table-column>
        <el-table-column prop="role" label="身份" width="120">
          <template #default="scope">
            <el-tag :type="(scope.row.username === 'admin' || scope.row.role === 'admin') ? 'danger' : 'info'" size="small">
              {{ (scope.row.username === 'admin' || scope.row.role === 'admin') ? '👑 管理員' : '👤 一般人員' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="device" label="登入裝置" width="110" />
        <el-table-column prop="feature" label="使用功能" width="150" />
        <el-table-column prop="action" label="操作動作 / 錯誤訊息" min-width="260">
          <template #default="scope">
            <span :style="{ color: isError(scope.row.action) ? '#f87171' : '#cbd5e1' }">
              {{ scope.row.action }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="時間 (台灣)" width="180" sortable>
          <template #default="scope">
            {{ formatTaiwanTime(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SettingsLog',
  props: {
    logTab: {
      type: String,
      default: 'normal'
    },
    filteredLogsList: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:logTab', 'refresh-logs'],
  computed: {
    displayLogs() {
      if (this.logTab === 'error') {
        return this.filteredLogsList.filter(item => this.isError(item.action));
      }
      return this.filteredLogsList.filter(item => !this.isError(item.action));
    }
  },
  methods: {
    isError(actionStr) {
      if (!actionStr) return false;
      const str = actionStr.toString();
      return str.includes('⚠️') || str.includes('失敗') || str.includes('錯誤') || str.includes('error') || str.includes('500') || str.includes('404');
    },
    formatTaiwanTime(utcTimeStr) {
      if (!utcTimeStr) return '--';
      try {
        const date = new Date(utcTimeStr.replace(' ', 'T') + 'Z');
        if (isNaN(date.getTime())) {
          return utcTimeStr;
        }
        return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      } catch (e) {
        return utcTimeStr;
      }
    }
  }
}
</script>

<style scoped>
.settings-log-container {
  padding: 20px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #0f172a;
  color: #f8fafc;
}

.action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title-group { display: flex; align-items: center; gap: 20px; }
.title-group h2 { margin: 0; font-size: 1.25rem; color: #38bdf8; }

.tab-toggle { display: flex; background: #1e293b; padding: 4px; border-radius: 8px; border: 1px solid #334155; }
.toggle-btn { padding: 6px 14px; border: none; background: transparent; color: #94a3b8; font-size: 0.85rem; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.toggle-btn.active { background: #2563eb; color: #ffffff; }
.toggle-btn.error-btn.active { background: #dc2626; color: #ffffff; }

.refresh-btn { background: #059669; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
.refresh-btn:hover { opacity: 0.9; }

.table-card { flex: 1; background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; }

:deep(.dark-table) { background-color: #1e293b !important; color: #f8fafc !important; }
:deep(.dark-table th.el-table__cell) { background-color: #0f172a !important; color: #38bdf8 !important; border-bottom: 1px solid #334155 !important; }
:deep(.dark-table td.el-table__cell) { background-color: #1e293b !important; border-bottom: 1px solid #334155 !important; }
:deep(.dark-table .el-table__empty-block) { background-color: #1e293b !important; }
:deep(.dark-table .el-table__empty-text) { color: #64748b !important; }
</style>