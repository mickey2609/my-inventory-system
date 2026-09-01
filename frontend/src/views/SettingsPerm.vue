<template>
  <div class="main-layout settings-layout dark-bg">
    <div class="settings-card dark-card" style="width: 95%; margin: 15px auto;">
      <div class="settings-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 class="text-white">🔐 權限設定 (帳號管理)</h3>
        <div style="display: flex; gap: 8px;">
          <input type="file" ref="batchUserFileInput" style="display: none;" accept=".xlsx,.xls,.csv" @change="$emit('batch-upload', $event)" />
          <el-button type="warning" size="small" @click="$emit('open-import-tip')">📥 批次匯入帳號</el-button>
          <el-button type="success" size="small" @click="$emit('export-users')">📊 匯出帳號與權限</el-button>
          <el-button type="info" size="small" @click="$emit('refresh-users')">🔄 重新整理</el-button>
          <el-button type="primary" size="small" @click="$emit('open-add-dialog')">➕ 新增帳號</el-button>
        </div>
      </div>

      <el-table :data="usersList" border style="width: 100%" size="medium" class="dark-table">
        <el-table-column prop="username" label="登入帳號" width="105">
          <template #default="scope">
            <span style="font-weight: bold; color: #38bdf8;">{{ scope.row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="姓名" width="110">
          <template #default="scope">
            <span style="font-weight: bold; color: #f8fafc;">{{ scope.row.name || scope.row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column label="身份" width="95" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.role === 'admin' || scope.row.username === 'admin'" size="mini" type="danger">👑 管理員</el-tag>
            <el-tag v-else size="mini" type="primary">👤 一般人員</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="在線狀態" width="90" align="center">
          <template #default="scope">
            <span v-if="scope.row.username === currentUser" style="color: #4ade80; font-weight: bold; font-size: 12px;">🟢 在線</span>
            <span v-else style="color: #64748b; font-size: 12px;">⚪ 離線</span>
          </template>
        </el-table-column>

        <el-table-column prop="password" label="密碼" width="75" align="center">
          <template #default><span style="color: #94a3b8;">******</span></template>
        </el-table-column>

        <el-table-column label="開放功能模組" min-width="260">
          <template #default="scope">
            <el-tag v-for="perm in (scope.row.permissions || [])" :key="perm" size="mini" type="info" style="margin-right: 4px; margin-bottom: 2px;">
              {{ getTabName(perm) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="380" align="center" header-align="center">
          <template #default="scope">
            <div style="display: flex; justify-content: center; align-items: center; gap: 4px; white-space: nowrap;">
              <el-button type="purple" size="mini" style="background: #8b5cf6; border-color: #7c3aed; color: #fff; margin: 0;" @click="$emit('open-role', scope.row)">🆔 身份設定</el-button>
              <el-button type="warning" size="mini" style="margin: 0;" @click="$emit('open-pwd', scope.row)">修改密碼</el-button>
              <el-button type="primary" size="mini" style="margin: 0;" @click="$emit('open-perm', scope.row)">權限設定</el-button>
              <el-button type="danger" size="mini" style="margin: 0;" :disabled="scope.row.username === 'admin'" @click="$emit('delete-user', scope.row.username)">刪除</el-button>
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
  props: ['usersList', 'currentUser'],
  emits: ['open-import-tip', 'export-users', 'refresh-users', 'open-add-dialog', 'open-role', 'open-pwd', 'open-perm', 'delete-user', 'batch-upload'],
  methods: {
    getTabName(tabKey) {
      const names = {
        'inv80': '庫存查詢80',
        'inv15': '庫存查詢15',
        'loc_summary': '儲位數才數統整',
        'turnover': '迴轉率清單',
        'abnormal_purchase': '不合理進貨清單'
      };
      return names[tabKey] || '系統模組';
    }
  }
}
</script>