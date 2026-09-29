<template>
  <div>
    <!-- 1. 帳號身份設定彈窗 -->
    <el-dialog 
      title="🆔 帳號資料設定" 
      :model-value="showEditRole" 
      @update:model-value="$emit('update:showEditRole', $event)" 
      width="420px" 
      custom-class="dark-dialog"
    >
      <el-form :model="editRoleForm" label-width="90px">
        <el-form-item label="登入帳號">
          <el-input :model-value="targetUser" disabled />
        </el-form-item>

        <el-form-item label="使用者姓名">
          <el-input v-model="editRoleForm.target_name" placeholder="請輸入姓名" />
        </el-form-item>

        <el-form-item label="帳號身份">
          <el-select v-model="editRoleForm.target_role" placeholder="請選擇身份" style="width: 100%;">
            <!-- 👑 只有 targetUser 本身是 admin 時，才會顯示系統管理員選項 -->
            <el-option 
              v-if="targetUser === 'admin'" 
              label="👑 系統管理員 (sys_admin - 限 admin 專用)" 
              value="sys_admin" 
            />
            <el-option label="👑 管理員 (admin)" value="admin" />
            <el-option label="👤 一般人員 (user)" value="user" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="$emit('update:showEditRole', false)">取消</el-button>
        <el-button type="primary" @click="$emit('save-role')">確定儲存</el-button>
      </template>
    </el-dialog>

    <!-- 2. 新增使用者彈窗 (強制 6 碼數字員編驗證) -->
    <el-dialog 
      title="➕ 新增使用者帳號" 
      :model-value="showAddUser" 
      @update:model-value="$emit('update:showAddUser', $event)" 
      width="420px" 
      custom-class="dark-dialog"
    >
      <el-form :model="newUserForm" label-width="90px">
        <el-form-item label="登入帳號" required>
          <el-input 
            v-model="newUserForm.username" 
            placeholder="請輸入 6 位數字員編 (例: 801854)" 
            maxlength="6"
            clearable
            @input="onUsernameInput"
          />
        </el-form-item>

        <el-form-item label="使用者姓名" required>
          <el-input v-model="newUserForm.name" placeholder="請輸入姓名" />
        </el-form-item>

        <el-form-item label="預設密碼" required>
          <el-input v-model="newUserForm.password" type="password" show-password placeholder="預設密碼" />
        </el-form-item>

        <el-form-item label="帳號身份">
          <el-select v-model="newUserForm.role" placeholder="請選擇身份" style="width: 100%;">
            <!-- 🌟 新增帳號一律只有「管理員」與「一般人員」，不可建 sys_admin -->
            <el-option label="👑 管理員 (admin)" value="admin" />
            <el-option label="👤 一般人員 (user)" value="user" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="$emit('update:showAddUser', false)">取消</el-button>
        <el-button type="primary" @click="handleConfirmAdd">確定新增</el-button>
      </template>
    </el-dialog>

    <!-- 3. 修改密碼彈窗 -->
    <el-dialog 
      title="🔑 修改使用者密碼" 
      :model-value="showEditPwd" 
      @update:model-value="$emit('update:showEditPwd', $event)" 
      width="400px" 
      custom-class="dark-dialog"
    >
      <el-form :model="editPasswordForm" label-width="90px">
        <el-form-item label="目標帳號">
          <el-input :model-value="targetUser" disabled />
        </el-form-item>
        <el-form-item label="新密碼">
          <el-input v-model="editPasswordForm.new_password" type="password" show-password placeholder="請輸入新密碼" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="$emit('update:showEditPwd', false)">取消</el-button>
        <el-button type="primary" @click="$emit('save-pwd')">確定修改</el-button>
      </template>
    </el-dialog>

    <!-- 4. 模組權限設定彈窗 -->
    <el-dialog 
      title="🔒 模組操作權限設定" 
      :model-value="showEditPerm" 
      @update:model-value="$emit('update:showEditPerm', $event)" 
      width="480px" 
      custom-class="dark-dialog"
    >
      <div class="perm-dialog-body">
        <div class="perm-tip">
          設定帳號 <b>[{{ targetUser }}]</b> 可存取的功能模組：
        </div>
        <el-checkbox-group v-model="editPermForm.selected_modules" class="perm-checkbox-group">
          <el-checkbox 
            v-for="mod in availableModules" 
            :key="mod.key" 
            :label="mod.key"
          >
            {{ mod.name }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <el-button @click="$emit('update:showEditPerm', false)">取消</el-button>
        <el-button type="primary" @click="$emit('save-perm')">儲存權限</el-button>
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
  ],
  methods: {
    // 🌟 自動過濾非數字字元，嚴格限制員編為純數字
    onUsernameInput(val) {
      if (this.newUserForm) {
        this.newUserForm.username = String(val || '').replace(/\D/g, '');
      }
    },
    // 🌟 新增帳號前校驗：必須為 6 位數字員編
    handleConfirmAdd() {
      const username = this.newUserForm?.username || '';
      if (username.length !== 6) {
        this.$message.warning('⚠️ 帳號格式錯誤：一般使用者帳號必須為 6 位數字員編！');
        return;
      }
      if (!this.newUserForm?.name) {
        this.$message.warning('⚠️ 請輸入使用者姓名！');
        return;
      }
      if (!this.newUserForm?.password) {
        this.$message.warning('⚠️ 請輸入預設密碼！');
        return;
      }
      this.$emit('save-add-user');
    }
  }
}
</script>

<style scoped>
.perm-dialog-body { padding: 10px 0; }
.perm-tip { margin-bottom: 15px; font-size: 14px; color: #cbd5e1; }
.perm-checkbox-group { display: flex; flex-direction: column; gap: 12px; padding-left: 10px; }
:deep(.el-checkbox__label) { color: #f8fafc !important; font-size: 14px; }
</style>