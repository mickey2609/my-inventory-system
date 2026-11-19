<!-- frontend/src/components/UserManagementModals.vue -->
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

    <!-- 4. 模組權限設定彈窗（支援全勾選 ＋ 匯入/匯出 ＋ 人員能力表「組別＋班別」雙重權限） -->
    <el-dialog 
      title="🔒 模組操作權限設定" 
      :model-value="showEditPerm" 
      @update:model-value="$emit('update:showEditPerm', $event)" 
      width="650px" 
      top="5vh"
      custom-class="dark-dialog"
    >
      <div class="perm-dialog-body">
        <div class="perm-header-bar">
          <div class="perm-tip">
            設定帳號 <b>[{{ targetUser }}]</b> 可存取的功能模組與操作權限：
          </div>
          <div class="quick-check-btns">
            <el-button size="mini" type="primary" plain @click="toggleAllModules">
              {{ isAllModulesSelected ? '取消全選模組' : '☑️ 全勾選模組' }}
            </el-button>
            <el-button size="mini" type="warning" plain @click="toggleAllAction('import')">
              {{ isAllActionSelected('import') ? '取消全選匯入' : '📥 全勾選匯入' }}
            </el-button>
            <el-button size="mini" type="success" plain @click="toggleAllAction('export')">
              {{ isAllActionSelected('export') ? '取消全選匯出' : '📊 全勾選匯出' }}
            </el-button>
            <el-button size="mini" type="danger" plain @click="clearAllPerms">
              🧹 全部清空
            </el-button>
          </div>
        </div>

        <div class="perm-matrix-header">
          <span>功能模組名稱</span>
          <span class="action-cols-title">操作權限控制</span>
        </div>

        <div class="perm-matrix-list">
          <div
            v-for="mod in availableModules"
            :key="mod.key"
            class="perm-matrix-item-wrap"
            :class="{ 'row-checked': isModuleChecked(mod.key) }"
          >
            <div class="perm-matrix-row">
              <el-checkbox
                :model-value="isModuleChecked(mod.key)"
                @change="val => onToggleModule(mod.key, val)"
              >
                <span class="mod-label">{{ mod.name }}</span>
              </el-checkbox>

              <div class="mod-actions-box">
                <el-checkbox
                  :model-value="isActionChecked(mod.key, 'import')"
                  @change="val => onToggleAction(mod.key, 'import', val)"
                >
                  <span class="act-tag act-import">📥 匯入</span>
                </el-checkbox>
                <el-checkbox
                  :model-value="isActionChecked(mod.key, 'export')"
                  @change="val => onToggleAction(mod.key, 'export', val)"
                >
                  <span class="act-tag act-export">📊 匯出</span>
                </el-checkbox>
              </div>
            </div>

            <!-- 人員綜合能力管理：專屬「組別 ＋ 班別」雙重權限子區塊 -->
            <div v-if="mod.key === 'staff_competency' && isModuleChecked('staff_competency')" class="staff-group-perm-subbox">
              <div class="sgp-title">🔑 1. 允許編輯與匯入的【作業組別】（未勾選的組別將鎖定為唯讀）：</div>
              <div class="sgp-checks" style="margin-bottom: 10px;">
                <el-checkbox
                  v-for="grp in staffCompetencyGroups"
                  :key="grp"
                  :model-value="isStaffGroupChecked(grp)"
                  @change="val => onToggleStaffGroup(grp, val)"
                >
                  <span class="sgp-label">{{ grp }}</span>
                </el-checkbox>
              </div>

              <div class="sgp-title" style="border-top: 1px dashed #334155; padding-top: 8px;">
                🕒 2. 允許編輯與匯入的【班別】（若全不勾選則代表該組全部班別皆可編輯）：
              </div>
              <div class="sgp-checks">
                <el-checkbox
                  v-for="sh in staffCompetencyShifts"
                  :key="sh"
                  :model-value="isStaffShiftChecked(sh)"
                  @change="val => onToggleStaffShift(sh, val)"
                >
                  <span class="sgp-shift-label">{{ sh }}</span>
                </el-checkbox>
              </div>
            </div>
          </div>
        </div>
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
    availableModules: {
      type: Array,
      default: () => []
    }
  },
  emits: [
    'update:showEditRole', 'update:showEditPwd', 'update:showEditPerm', 'update:showAddUser',
    'save-role', 'save-pwd', 'save-perm', 'save-add-user'
  ],
  data() {
    return {
      staffCompetencyGroups: [
        '進貨驗收組',
        '儲位上架組',
        '揀出貨作業組',
        '庫存作業組',
        '還貨作業組',
        '3PL一組'
      ],
      staffCompetencyShifts: [
        '日班',
        '早班',
        '早半',
        '中班',
        '夜班',
        '夜半',
        '大夜班'
      ]
    };
  },
  computed: {
    selectedList() {
      return Array.isArray(this.editPermForm?.selected_modules)
        ? this.editPermForm.selected_modules
        : [];
    },
    isAllModulesSelected() {
      if (!this.availableModules.length) return false;
      return this.availableModules.every(m => this.selectedList.includes(m.key));
    }
  },
  methods: {
    onUsernameInput(val) {
      if (this.newUserForm) {
        this.newUserForm.username = String(val || '').replace(/\D/g, '');
      }
    },
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
    },

    isModuleChecked(modKey) {
      return this.selectedList.includes(modKey);
    },
    isActionChecked(modKey, action) {
      return this.selectedList.includes(`${modKey}:${action}`);
    },
    isStaffGroupChecked(grp) {
      return this.selectedList.includes(`staff_competency:group:${grp}`);
    },
    isStaffShiftChecked(sh) {
      return this.selectedList.includes(`staff_competency:shift:${sh}`);
    },
    isAllActionSelected(action) {
      if (!this.availableModules.length) return false;
      return this.availableModules.every(m => this.selectedList.includes(`${m.key}:${action}`));
    },

    onToggleModule(modKey, checked) {
      const set = new Set(this.selectedList);
      if (checked) {
        set.add(modKey);
      } else {
        set.delete(modKey);
        set.delete(`${modKey}:import`);
        set.delete(`${modKey}:export`);
        if (modKey === 'staff_competency') {
          this.staffCompetencyGroups.forEach(g => set.delete(`staff_competency:group:${g}`));
          this.staffCompetencyShifts.forEach(s => set.delete(`staff_competency:shift:${s}`));
        }
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    onToggleAction(modKey, action, checked) {
      const set = new Set(this.selectedList);
      if (checked) {
        set.add(modKey);
        set.add(`${modKey}:${action}`);
      } else {
        set.delete(`${modKey}:${action}`);
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    onToggleStaffGroup(grp, checked) {
      const set = new Set(this.selectedList);
      if (checked) {
        set.add('staff_competency');
        set.add(`staff_competency:group:${grp}`);
      } else {
        set.delete(`staff_competency:group:${grp}`);
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    onToggleStaffShift(sh, checked) {
      const set = new Set(this.selectedList);
      if (checked) {
        set.add('staff_competency');
        set.add(`staff_competency:shift:${sh}`);
      } else {
        set.delete(`staff_competency:shift:${sh}`);
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    toggleAllModules() {
      const set = new Set(this.selectedList);
      if (this.isAllModulesSelected) {
        this.availableModules.forEach(m => {
          set.delete(m.key);
          set.delete(`${m.key}:import`);
          set.delete(`${m.key}:export`);
        });
        this.staffCompetencyGroups.forEach(g => set.delete(`staff_competency:group:${g}`));
        this.staffCompetencyShifts.forEach(s => set.delete(`staff_competency:shift:${s}`));
      } else {
        this.availableModules.forEach(m => set.add(m.key));
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    toggleAllAction(action) {
      const set = new Set(this.selectedList);
      if (this.isAllActionSelected(action)) {
        this.availableModules.forEach(m => set.delete(`${m.key}:${action}`));
      } else {
        this.availableModules.forEach(m => {
          set.add(m.key);
          set.add(`${m.key}:${action}`);
        });
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    clearAllPerms() {
      this.editPermForm.selected_modules = [];
    }
  }
}
</script>

<style scoped>
.perm-dialog-body { padding: 4px 0; }
.perm-header-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.perm-tip { font-size: 14px; color: #cbd5e1; }
.quick-check-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.perm-matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  font-weight: bold;
  color: #38bdf8;
}
.action-cols-title { padding-right: 18px; }

.perm-matrix-list {
  max-height: 440px;
  overflow-y: auto;
  border: 1px solid #334155;
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: #0f172a;
}
.perm-matrix-item-wrap {
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
  transition: background 0.15s;
}
.perm-matrix-item-wrap:last-child { border-bottom: none; }
.perm-matrix-item-wrap:hover { background: rgba(255, 255, 255, 0.03); }
.row-checked { background: rgba(56, 189, 248, 0.06); }

.perm-matrix-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 12px;
}

.staff-group-perm-subbox {
  margin: 0 12px 9px 28px;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px dashed #38bdf8;
  border-radius: 6px;
}
.sgp-title {
  font-size: 11px;
  color: #7dd3fc;
  font-weight: bold;
  margin-bottom: 6px;
}
.sgp-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.sgp-label {
  font-size: 12px;
  color: #fde047;
  font-weight: bold;
}
.sgp-shift-label {
  font-size: 12px;
  color: #6ee7b7;
  font-weight: bold;
}

.mod-label {
  color: #f8fafc;
  font-size: 13px;
  font-weight: bold;
}
.mod-actions-box {
  display: flex;
  align-items: center;
  gap: 14px;
}
.act-tag {
  font-size: 12px;
  font-weight: bold;
}
.act-import { color: #fbbf24; }
.act-export { color: #4ade80; }

:deep(.el-checkbox__label) { color: #f8fafc !important; }
</style>