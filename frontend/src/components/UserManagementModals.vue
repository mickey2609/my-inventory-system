<!-- frontend/src/components/UserManagementModals.vue -->
<template>
  <div>
    <!-- 1. 帳號身份與組別設定彈窗 -->
    <el-dialog 
      title="🆔 帳號資料與組別設定" 
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

        <el-form-item label="所屬組別">
          <el-select v-model="editRoleForm.target_group" placeholder="請選擇所屬組別" clearable style="width: 100%;">
            <el-option v-for="grp in userAccountGroups" :key="grp" :label="grp" :value="grp" />
          </el-select>
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

    <!-- 2. 新增使用者彈窗 -->
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

        <el-form-item label="所屬組別">
          <el-select v-model="newUserForm.staff_group" placeholder="請選擇所屬組別" clearable style="width: 100%;">
            <el-option v-for="grp in userAccountGroups" :key="grp" :label="grp" :value="grp" />
          </el-select>
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

    <!-- 4. 模組權限設定彈窗（全寬雙欄大視窗版） -->
    <el-dialog 
      title="🔒 模組操作權限設定（依業務分組）" 
      :model-value="showEditPerm" 
      @update:model-value="$emit('update:showEditPerm', $event)" 
      width="94%"
      top="2vh"
      custom-class="dark-dialog perm-wide-dialog"
    >
      <div class="perm-dialog-body">
        <!-- 頂部操作工具列 -->
        <div class="perm-header-bar">
          <div class="perm-tip">
            設定帳號 <b style="color: #38bdf8; font-size: 15px;">[{{ targetUser }}]</b> 可存取的功能模組與匯入/匯出操作權限：
          </div>
          <div class="quick-check-btns">
            <el-button size="small" type="primary" plain @click="toggleAllModules">
              {{ isAllModulesSelected ? '取消全選模組' : '☑️ 全勾選模組' }}
            </el-button>
            <el-button size="small" type="warning" plain @click="toggleAllAction('import')">
              {{ isAllActionSelected('import') ? '取消全選匯入' : '📥 全勾選匯入' }}
            </el-button>
            <el-button size="small" type="success" plain @click="toggleAllAction('export')">
              {{ isAllActionSelected('export') ? '取消全選匯出' : '📊 全勾選匯出' }}
            </el-button>
            <el-button size="small" type="danger" plain @click="clearAllPerms">
              🧹 全部清空
            </el-button>
          </div>
        </div>

        <!-- 雙欄網格分組區塊 -->
        <div class="perm-grouped-grid">
          <div
            v-for="cat in groupedModules"
            :key="cat.id"
            class="perm-category-card"
            :style="{ borderColor: cat.borderColor }"
          >
            <!-- 分類群組標題列 -->
            <div class="perm-cat-header" :style="{ background: cat.headerBg }">
              <div class="perm-cat-left">
                <el-checkbox
                  :model-value="isCategoryAllChecked(cat)"
                  :indeterminate="isCategoryIndeterminate(cat)"
                  @change="val => toggleCategoryModules(cat, val)"
                >
                  <span class="cat-title" :style="{ color: cat.titleColor }">
                    {{ cat.title }}（{{ getCategoryCheckedCount(cat) }}/{{ cat.modules.length }}）
                  </span>
                </el-checkbox>
              </div>
              <div class="perm-cat-actions">
                <el-button
                  size="mini"
                  plain
                  type="warning"
                  @click="toggleCategoryAction(cat, 'import')"
                >
                  {{ isCategoryAllAction(cat, 'import') ? '取消本組匯入' : '📥 本組全匯入' }}
                </el-button>
                <el-button
                  size="mini"
                  plain
                  type="success"
                  @click="toggleCategoryAction(cat, 'export')"
                >
                  {{ isCategoryAllAction(cat, 'export') ? '取消本組匯出' : '📊 本組全匯出' }}
                </el-button>
              </div>
            </div>

            <!-- 該分類底下的模組清單 -->
            <div class="perm-cat-body">
              <div
                v-for="mod in cat.modules"
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

                <!-- 人員綜合能力管理：每一組獨立配置「日班、早半、夜班、夜半、大夜班」矩陣 -->
                <div v-if="mod.key === 'staff_competency' && isModuleChecked('staff_competency')" class="staff-group-perm-subbox">
                  <div class="sgp-title">🔑 每一組獨立設定可編輯與匯入的【組別 ＋ 班別】（勾選組別可一鍵全選該組 5 班別）：</div>
                  <div class="gs-matrix-list">
                    <div
                      v-for="grp in staffCompetencyGroups"
                      :key="grp"
                      class="gs-matrix-row"
                      :class="{ 'gs-row-active': isGroupAnyShiftChecked(grp) }"
                    >
                      <div class="gs-group-col">
                        <el-checkbox
                          :model-value="isGroupAllShiftsChecked(grp)"
                          :indeterminate="isGroupIndeterminate(grp)"
                          @change="val => onToggleGroupAllShifts(grp, val)"
                        >
                          <span class="sgp-label">{{ grp }}</span>
                        </el-checkbox>
                      </div>

                      <div class="gs-shifts-col">
                        <el-checkbox
                          v-for="sh in staffCompetencyShifts"
                          :key="`${grp}_${sh}`"
                          :model-value="isGroupShiftChecked(grp, sh)"
                          @change="val => onToggleGroupShift(grp, sh, val)"
                        >
                          <span class="sgp-shift-label">{{ sh }}</span>
                        </el-checkbox>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="$emit('update:showEditPerm', false)">取消</el-button>
        <el-button type="primary" @click="$emit('save-perm')">💾 儲存權限設定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
const MODULE_CATEGORY_DEFS = [
  {
    id: 'inventory',
    title: '📦 庫存與儲位分析',
    titleColor: '#38bdf8',
    headerBg: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    keys: ['inv80', 'inv15', 'loc_summary', 'storage_accuracy', 'turnover', 'item_sales_history']
  },
  {
    id: 'warehouse_fish',
    title: '🐟 倉內進貨、補貨與調撥魚群',
    titleColor: '#4ade80',
    headerBg: 'rgba(74, 222, 128, 0.14)',
    borderColor: 'rgba(74, 222, 128, 0.4)',
    keys: ['inbound_fish', 'replenish_fish', 'transfer_80_15', 'transfer_15_80', 'dispatch_fish', 'abnormal_purchase']
  },
  {
    id: 'delivery',
    title: '🚚 宅配流線與物流成本分析',
    titleColor: '#fbbf24',
    headerBg: 'rgba(251, 191, 36, 0.14)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    keys: ['delivery_flow', 'delivery_cost', 'delivery_undelivered']
  },
  {
    id: 'staff_ai',
    title: '🧑‍💼 人員能力與 AI 輔助工具',
    titleColor: '#c084fc',
    headerBg: 'rgba(192, 132, 252, 0.14)',
    borderColor: 'rgba(192, 132, 252, 0.4)',
    keys: ['staff_competency', 'wms_fish_screenshot']
  }
];

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
    isSysAdmin: Boolean,
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
      userAccountGroups: [
        '管理組',
        '進貨驗收組',
        '儲位上架組',
        '進出貨作業組',
        '揀出貨作業組',
        '庫存作業組',
        '還貨作業組',
        '3PL一組'
      ],
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
        '早半',
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
    },
    groupedModules() {
      const modMap = new Map(this.availableModules.map(m => [m.key, m]));
      const assignedKeys = new Set();

      const groups = MODULE_CATEGORY_DEFS.map(def => {
        const modules = def.keys
          .map(k => modMap.get(k))
          .filter(Boolean);
        modules.forEach(m => assignedKeys.add(m.key));
        return { ...def, modules };
      }).filter(g => g.modules.length > 0);

      const unassigned = this.availableModules.filter(m => !assignedKeys.has(m.key));
      if (unassigned.length > 0) {
        groups.push({
          id: 'others',
          title: '📌 其他功能模組',
          titleColor: '#94a3b8',
          headerBg: 'rgba(148, 163, 184, 0.12)',
          borderColor: 'rgba(148, 163, 184, 0.35)',
          modules: unassigned
        });
      }

      return groups;
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

    getCategoryCheckedCount(cat) {
      return cat.modules.filter(m => this.selectedList.includes(m.key)).length;
    },
    isCategoryAllChecked(cat) {
      return cat.modules.length > 0 && cat.modules.every(m => this.selectedList.includes(m.key));
    },
    isCategoryIndeterminate(cat) {
      const cnt = this.getCategoryCheckedCount(cat);
      return cnt > 0 && cnt < cat.modules.length;
    },
    isCategoryAllAction(cat, action) {
      return cat.modules.length > 0 && cat.modules.every(m => this.selectedList.includes(`${m.key}:${action}`));
    },
    toggleCategoryModules(cat, checked) {
      const set = new Set(this.selectedList);
      cat.modules.forEach(m => {
        if (checked) {
          set.add(m.key);
        } else {
          set.delete(m.key);
          set.delete(`${m.key}:import`);
          set.delete(`${m.key}:export`);
          if (m.key === 'staff_competency') {
            this.clearAllStaffCompetencySubPerms(set);
          }
        }
      });
      this.editPermForm.selected_modules = Array.from(set);
    },
    toggleCategoryAction(cat, action) {
      const set = new Set(this.selectedList);
      const allSelected = this.isCategoryAllAction(cat, action);
      cat.modules.forEach(m => {
        if (allSelected) {
          set.delete(`${m.key}:${action}`);
        } else {
          set.add(m.key);
          set.add(`${m.key}:${action}`);
        }
      });
      this.editPermForm.selected_modules = Array.from(set);
    },

    isGroupShiftChecked(grp, sh) {
      if (this.selectedList.includes(`staff_competency:gs:${grp}:${sh}`)) return true;
      const hasAnyExplicitShift = this.staffCompetencyShifts.some(s =>
        this.selectedList.includes(`staff_competency:gs:${grp}:${s}`)
      );
      if (!hasAnyExplicitShift && this.selectedList.includes(`staff_competency:group:${grp}`)) {
        return true;
      }
      return false;
    },
    isGroupAnyShiftChecked(grp) {
      return this.staffCompetencyShifts.some(sh => this.isGroupShiftChecked(grp, sh));
    },
    isGroupAllShiftsChecked(grp) {
      return this.staffCompetencyShifts.every(sh => this.isGroupShiftChecked(grp, sh));
    },
    isGroupIndeterminate(grp) {
      const cnt = this.staffCompetencyShifts.filter(sh => this.isGroupShiftChecked(grp, sh)).length;
      return cnt > 0 && cnt < this.staffCompetencyShifts.length;
    },
    isAllActionSelected(action) {
      if (!this.availableModules.length) return false;
      return this.availableModules.every(m => this.selectedList.includes(`${m.key}:${action}`));
    },

    clearAllStaffCompetencySubPerms(set) {
      Array.from(set).forEach(token => {
        if (token.startsWith('staff_competency:group:') || token.startsWith('staff_competency:shift:') || token.startsWith('staff_competency:gs:')) {
          set.delete(token);
        }
      });
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
          this.clearAllStaffCompetencySubPerms(set);
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

    onToggleGroupAllShifts(grp, checked) {
      const set = new Set(this.selectedList);
      set.delete(`staff_competency:group:${grp}`);
      this.staffCompetencyShifts.forEach(sh => set.delete(`staff_competency:gs:${grp}:${sh}`));

      if (checked) {
        set.add('staff_competency');
        set.add(`staff_competency:group:${grp}`);
        this.staffCompetencyShifts.forEach(sh => {
          set.add(`staff_competency:gs:${grp}:${sh}`);
        });
      }
      this.editPermForm.selected_modules = Array.from(set);
    },

    onToggleGroupShift(grp, sh, checked) {
      const set = new Set(this.selectedList);
      const hadLegacyOnly = set.has(`staff_competency:group:${grp}`) &&
        !this.staffCompetencyShifts.some(s => set.has(`staff_competency:gs:${grp}:${s}`));
      if (hadLegacyOnly) {
        this.staffCompetencyShifts.forEach(s => set.add(`staff_competency:gs:${grp}:${s}`));
      }

      if (checked) {
        set.add('staff_competency');
        set.add(`staff_competency:group:${grp}`);
        set.add(`staff_competency:gs:${grp}:${sh}`);
      } else {
        set.delete(`staff_competency:gs:${grp}:${sh}`);
        const stillHasAny = this.staffCompetencyShifts.some(s => set.has(`staff_competency:gs:${grp}:${s}`));
        if (!stillHasAny) {
          set.delete(`staff_competency:group:${grp}`);
        }
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
        this.clearAllStaffCompetencySubPerms(set);
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
.perm-dialog-body { padding: 0; }
.perm-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
}
.perm-tip { font-size: 14px; color: #cbd5e1; }
.quick-check-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 雙欄並排 Grid：大螢幕一次看清全部四個分類 */
.perm-grouped-grid {
  max-height: 74vh;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding-right: 4px;
  align-items: start;
}

@media (max-width: 1100px) {
  .perm-grouped-grid {
    grid-template-columns: 1fr;
  }
}

.perm-category-card {
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
}

.perm-cat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px;
  border-bottom: 1px solid rgba(51, 65, 85, 0.8);
}

.cat-title {
  font-size: 14px;
  font-weight: bold;
}

.perm-cat-actions {
  display: flex;
  gap: 6px;
}

.perm-cat-body {
  display: flex;
  flex-direction: column;
}

.perm-matrix-item-wrap {
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  transition: background 0.15s;
}
.perm-matrix-item-wrap:last-child { border-bottom: none; }
.perm-matrix-item-wrap:hover { background: rgba(255, 255, 255, 0.03); }
.row-checked { background: rgba(56, 189, 248, 0.06); }

.perm-matrix-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 14px;
}

.staff-group-perm-subbox {
  margin: 0 12px 12px 16px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px dashed #38bdf8;
  border-radius: 6px;
}
.sgp-title {
  font-size: 12px;
  color: #7dd3fc;
  font-weight: bold;
  margin-bottom: 8px;
}

.gs-matrix-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gs-matrix-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(30, 41, 59, 0.55);
  border: 1px solid rgba(51, 65, 85, 0.65);
}
.gs-row-active {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.45);
}
.gs-group-col {
  min-width: 120px;
  flex-shrink: 0;
}
.gs-shifts-col {
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
  font-weight: 500;
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