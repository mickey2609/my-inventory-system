<template>
  <div>
    <!-- 1. 編輯身份與姓名彈窗 -->
    <el-dialog 
      :title="`🆔 帳號資料設定 - [${targetUser}]`" 
      :model-value="showEditRole" 
      @update:model-value="$emit('update:showEditRole', $event)" 
      width="420px" 
      custom-class="dark-dialog"
    >
      <el-form :model="editRoleForm" label-width="95px" style="padding-top: 10px;">
        <el-form-item label="使用者姓名">
          <el-input v-model="editRoleForm.target_name" placeholder="請輸入姓名"></el-input>
        </el-form-item>
        <el-form-item label="帳號身份">
          <el-select v-model="editRoleForm.target_role" placeholder="請選擇身份" style="width: 100%;">
            <el-option label="👑 系統管理員 (sys_admin - 限全公司參數)" value="sys_admin"></el-option>
            <el-option label="👑 管理員 (admin)" value="admin"></el-option>
            <el-option label="👤 一般人員 (user)" value="user"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:showEditRole', false)">取消</el-button>
          <el-button type="primary" @click="$emit('save-role')">儲存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 2. 修改密碼彈窗 -->
    <el-dialog 
      :title="`🔑 修改密碼 - [${targetUser}]`" 
      :model-value="showEditPwd" 
      @update:model-value="$emit('update:showEditPwd', $event)" 
      width="400px" 
      custom-class="dark-dialog"
    >
      <el-form :model="editPasswordForm" label-width="85px" style="padding-top: 10px;">
        <el-form-item label="新密碼">
          <el-input v-model="editPasswordForm.new_password" type="password" show-password placeholder="請輸入新密碼"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:showEditPwd', false)">取消</el-button>
          <el-button type="warning" @click="$emit('save-pwd')">確定修改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 🌟 3. 模組權限設定彈窗 (精準修正 label 與 value 綁定) -->
    <el-dialog 
      :title="`🔒 權限設定 - [${targetUser}]`" 
      :model-value="showEditPerm" 
      @update:model-value="$emit('update:showEditPerm', $event)" 
      width="450px" 
      custom-class="dark-dialog"
    >
      <div style="padding: 10px 0;">
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">請勾選該使用者可存取的功能模組：</p>
        <el-checkbox-group v-model="editPermForm.selected_modules">
          <div v-for="mod in availableModules" :key="mod.key" style="margin-bottom: 10px;">
            <el-checkbox :label="mod.key" :value="mod.key">{{ mod.name }}</el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:showEditPerm', false)">取消</el-button>
          <el-button type="primary" @click="$emit('save-perm')">儲存權限</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 4. 新增帳號彈窗 -->
    <el-dialog 
      title="➕ 新增使用者帳號" 
      :model-value="showAddUser" 
      @update:model-value="$emit('update:showAddUser', $event)" 
      width="420px" 
      custom-class="dark-dialog"
    >
      <el-form :model="newUserForm" label-width="95px" style="padding-top: 10px;">
        <el-form-item label="登入帳號">
          <el-input v-model="newUserForm.username" placeholder="請輸入員編或帳號"></el-input>
        </el-form-item>
        <el-form-item label="使用者姓名">
          <el-input v-model="newUserForm.name" placeholder="請輸入姓名"></el-input>
        </el-form-item>
        <el-form-item label="預設密碼">
          <el-input v-model="newUserForm.password" type="password" show-password placeholder="預設密碼為 123456"></el-input>
        </el-form-item>
        <el-form-item label="帳號身份">
          <el-select v-model="newUserForm.role" placeholder="請選擇身份" style="width: 100%;">
            <el-option label="👑 系統管理員 (sys_admin - 限全公司參數)" value="sys_admin"></el-option>
            <el-option label="👑 管理員 (admin)" value="admin"></el-option>
            <el-option label="👤 一般人員 (user)" value="user"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:showAddUser', false)">取消</el-button>
          <el-button type="primary" @click="$emit('save-add-user')">確定新增</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'UserManagementModals',
  props: {
    showEditRole: Boolean,
    showEditPwd: Boolean,
    showEditPerm: Boolean,
    showAddUser: Boolean,
    targetUser: String,
    editRoleForm: Object,
    editPasswordForm: Object,
    editPermForm: Object,
    newUserForm: Object,
    availableModules: Array
  },
  emits: [
    'update:showEditRole', 'update:showEditPwd', 'update:showEditPerm', 'update:showAddUser',
    'save-role', 'save-pwd', 'save-perm', 'save-add-user'
  ]
}
</script>

<style scoped>
:deep(.el-checkbox__label) {
  color: #cbd5e1 !important;
}
</style>