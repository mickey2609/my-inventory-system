<template>
  <div class="main-layout settings-layout dark-bg">
    <div class="settings-card dark-card" style="width: 95%; margin: 15px auto;">
      <div class="settings-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <h3 class="text-white" style="margin: 0;">📜 系統日誌查詢</h3>
          <el-radio-group :model-value="logTab" @change="$emit('update:logTab', $event)" size="small">
            <el-radio-button label="normal">📜 正常操作歷程</el-radio-button>
            <el-radio-button label="error">⚠️ 系統錯誤日誌</el-radio-button>
          </el-radio-group>
        </div>
        <el-button type="success" size="small" @click="$emit('refresh-logs')">🔄 重新整理</el-button>
      </div>

      <!-- 🔥 簡化表格樣式，高對比度深黑色字體 -->
      <el-table :data="filteredLogsList" border height="500px" style="width: 100%" size="small" class="pretty-log-table">
        <el-table-column prop="username" label="登入帳號" min-width="105">
          <template #default="scope">
            <span class="dark-text-bold">{{ scope.row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="device" label="登入裝置" min-width="110" align="center">
          <template #default="scope">
            <span v-if="scope.row.device && scope.row.device.includes('手機')" style="color: #2563eb; font-weight: bold;">📱 手機</span>
            <span v-else style="color: #059669; font-weight: bold;">💻 電腦</span>
          </template>
        </el-table-column>

        <el-table-column prop="feature" label="使用功能" min-width="130">
          <template #default="scope">
            <span style="color: #2563eb; font-weight: bold;">{{ scope.row.feature || '通用功能' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="action" label="操作動作 / 錯誤訊息" min-width="380" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="isErrorAction(scope.row.action)" style="color: #dc2626; font-weight: bold;">⚠️ {{ scope.row.action }}</span>
            <span v-else class="dark-text-bold">{{ scope.row.action }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="login_time" label="時間" min-width="160" sortable>
          <template #default="scope">
            <span class="dark-text-bold">{{ scope.row.login_time }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="ip" label="IP" min-width="120">
          <template #default="scope">
            <span class="dark-text-bold">{{ scope.row.ip }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SettingsLog',
  props: ['logTab', 'filteredLogsList'],
  emits: ['update:logTab', 'refresh-logs'],
  methods: {
    isErrorAction(action) {
      if (!action) return false;
      const str = action.toString().toLowerCase();
      return str.includes('失敗') || str.includes('錯誤') || str.includes('error') || str.includes('400') || str.includes('500');
    }
  }
}
</script>

<style scoped>
.pretty-log-table {
  background-color: #ffffff !important;
}

.dark-text-bold {
  color: #0f172a !important;
  font-weight: 600 !important;
  font-size: 13px !important;
}

:deep(.pretty-log-table td.el-table__cell) {
  color: #0f172a !important;
  font-size: 13px !important;
}

:deep(.pretty-log-table th.el-table__cell) {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
  font-weight: bold !important;
}
</style>