<template>
  <div>
    <SystemDrawer 
      :model-value="showUnifiedDrawer"
      @update:model-value="$emit('update:showUnifiedDrawer', $event)"
      :current-user="currentUser"
      :current-tab="currentTab"
      :login-time-str="loginTimeStr"
      :session-duration-str="sessionDurationStr"
      :idle-countdown-str="idleCountdownStr"
      @logout="$emit('logout')"
      @switch-tab="$emit('open-new-tab', $event)"
      @open-import-inventory="$emit('open-import-inv')"
    />

    <ColConfigModal 
      :model-value="showColSettingDialog"
      @update:model-value="$emit('update:showColSettingDialog', $event)"
      :is-admin="isAdmin"
      :all-available-columns="allAvailableColumns"
      :selected-columns="form.selected_columns"
      :dragged-index="draggedIndex"
      :saving-config="savingConfig"
      :raw-columns-master="rawColumnsMaster"
      @select-all="$emit('select-all-cols')"
      @unselect-all="$emit('unselect-all-cols')"
      @drag-start="$emit('drag-start', $event)"
      @drag-over="$emit('drag-over', $event)"
      @drag-drop="$emit('drag-drop')"
      @drag-end="$emit('drag-end')"
      @toggle-col="$emit('toggle-col', $event)"
      @save-config="$emit('save-column-config')"
    />

    <ParamMenuModal 
      :model-value="showParamMenuDialog"
      @update:model-value="$emit('update:showParamMenuDialog', $event)"
      @open-col-setting="$emit('open-col-setting')"
      @open-width-config="$emit('open-width-config')"
      @open-export-width-config="$emit('open-export-width-config')"
    />

    <WidthConfigModal 
      :show-width-config="showWidthConfigDialog"
      @update:show-width-config="$emit('update:showWidthConfigDialog', $event)"
      :show-export-width-config="showExportWidthConfigDialog"
      @update:show-export-width-config="$emit('update:showExportWidthConfigDialog', $event)"
      :selected-columns="form.selected_columns"
      :custom-col-widths="customColWidths"
      :custom-export-col-widths="customExportColWidths"
    />

    <ImportTipModal 
      :show-inventory-import-tip="showInventoryImportTipDialog"
      @update:show-inventory-import-tip="$emit('update:showInventoryImportTipDialog', $event)"
      :show-import-tip="showImportTipDialog"
      @update:show-import-tip="$emit('update:showImportTipDialog', $event)"
      :is-uploading="isUploading"
      :upload-percent="uploadPercent"
      @confirm-inventory-import="$emit('trigger-select-inv-file')"
      @confirm-batch-import="$emit('trigger-select-batch-file')"
    />

    <UserManagementModals 
      :show-edit-role="showEditRoleDialog"
      @update:show-edit-role="$emit('update:showEditRoleDialog', $event)"
      :show-edit-pwd="showEditPwdDialog"
      @update:show-edit-pwd="$emit('update:showEditPwdDialog', $event)"
      :show-edit-perm="showEditPermDialog"
      @update:show-edit-perm="$emit('update:showEditPermDialog', $event)"
      :show-add-user="showAddUserDialog"
      @update:show-add-user="$emit('update:showAddUserDialog', $event)"
      :target-user="targetUser"
      :edit-role-form="editRoleForm"
      :edit-password-form="editPasswordForm"
      :edit-perm-form="editPermForm"
      :new-user-form="newUserForm"
      :available-modules="availableModules"
      @save-role="$emit('save-role')"
      @save-pwd="$emit('save-pwd')"
      @save-perm="$emit('save-perm')"
      @save-add-user="$emit('save-add-user')"
    />

    <InventorySearchModal 
      :model-value="showSearchModal"
      @update:model-value="$emit('update:showSearchModal', $event)"
      :form="form"
      :options="options"
      :loading="loading"
      :search-elapsed-sec="searchElapsedSec"
      @open-param-menu="$emit('open-param-menu')"
      @big-zone-change="$emit('big-zone-change', $event)"
      @submit-search="$emit('submit-search')"
    />
  </div>
</template>

<script>
import SystemDrawer from './SystemDrawer.vue'
import ColConfigModal from './ColConfigModal.vue'
import ParamMenuModal from './ParamMenuModal.vue'
import WidthConfigModal from './WidthConfigModal.vue'
import ImportTipModal from './ImportTipModal.vue'
import UserManagementModals from './UserManagementModals.vue'
import InventorySearchModal from './InventorySearchModal.vue'

export default {
  name: 'GlobalModalsContainer',
  components: {
    SystemDrawer, ColConfigModal, ParamMenuModal, WidthConfigModal,
    ImportTipModal, UserManagementModals, InventorySearchModal
  },
  props: {
    showUnifiedDrawer: Boolean, showColSettingDialog: Boolean, showParamMenuDialog: Boolean,
    showWidthConfigDialog: Boolean, showExportWidthConfigDialog: Boolean, showImportTipDialog: Boolean,
    showInventoryImportTipDialog: Boolean, showEditRoleDialog: Boolean, showEditPwdDialog: Boolean,
    showEditPermDialog: Boolean, showAddUserDialog: Boolean, showSearchModal: Boolean,
    isAdmin: Boolean, isUploading: Boolean, savingConfig: Boolean, loading: Boolean,
    uploadPercent: Number, searchElapsedSec: [Number, String], draggedIndex: Number,
    currentUser: String, currentTab: String, loginTimeStr: String, sessionDurationStr: String,
    idleCountdownStr: String, targetUser: String,
    allAvailableColumns: Array, rawColumnsMaster: Array, availableModules: Array,
    customColWidths: Object, customExportColWidths: Object, form: Object, options: Object,
    editRoleForm: Object, editPasswordForm: Object, editPermForm: Object, newUserForm: Object
  }
}
</script>