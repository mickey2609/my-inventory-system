<template>
  <el-dialog title="📋 設定一般模式顯示欄位與順序 (全公司同步)" v-model="visible" width="560px" class="dark-dialog pretty-col-dialog">
    <div class="col-setting-header-info">
      <div class="tip-text">
        <span v-if="isAdmin">💡 打勾選取欄位，按住 ☰ 拖拉即可調整順序（完成後全公司同步生效）</span>
        <span v-else>🔒 目前為全公司統一檢索欄位順序（僅管理者可調整）</span>
      </div>
      <div v-if="isAdmin" class="quick-select-btns">
        <el-button size="mini" type="primary" plain @click="$emit('select-all')">全選</el-button>
        <el-button size="mini" type="info" plain @click="$emit('unselect-all')">全不選</el-button>
      </div>
    </div>

    <div class="col-scroll-box pretty-scroll-box">
      <div v-if="isAdmin" class="admin-drag-cols">
        <div 
          v-for="(col, idx) in allAvailableColumns" 
          :key="col" 
          draggable="true"
          @dragstart="$emit('drag-start', $event, idx)"
          @dragover.prevent="$emit('drag-over', $event, idx)"
          @drop="$emit('drag-drop')"
          @dragend="$emit('drag-end')"
          class="pretty-drag-item"
          :class="{ 'dragging-item': draggedIndex === idx, 'is-selected': selectedColumns.includes(col) }"
        >
          <div class="drag-left">
            <span class="drag-handle" title="按住左鍵上下拖拉">☰</span>
            <el-checkbox :label="col" :model-value="selectedColumns.includes(col)" @change="$emit('toggle-col', col)">
              <span class="col-code-tag">[{{ getColLetter(getColOriginalIndex(col)) }}]</span>
              <span class="col-name-text">{{ col }}</span>
            </el-checkbox>
          </div>
          <div class="drag-right">
            <span class="order-badge" :class="{ 'active-badge': selectedColumns.includes(col) }">第 {{ idx + 1 }} 順位</span>
          </div>
        </div>
      </div>

      <div v-else class="user-readonly-cols">
        <div v-for="col in allAvailableColumns" :key="col" class="pretty-readonly-item" :class="{ 'is-selected': selectedColumns.includes(col) }">
          <div class="drag-left">
            <span class="col-code-tag">[{{ getColLetter(getColOriginalIndex(col)) }}]</span>
            <span class="col-name-text">{{ col }}</span>
          </div>
          <div class="drag-right">
            <span v-if="selectedColumns.includes(col)" class="order-badge active-badge">第 {{ getSelectedOrder(col) }} 順位</span>
            <span v-if="selectedColumns.includes(col)" class="checked-tag">✓ 預設顯示</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">關閉</el-button>
      <el-button type="primary" :loading="savingConfig" @click="$emit('save-config')">
        {{ isAdmin ? '💾 儲存並同步至全公司' : '確定' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'ColConfigModal',
  props: ['modelValue', 'isAdmin', 'allAvailableColumns', 'selectedColumns', 'draggedIndex', 'savingConfig', 'rawColumnsMaster'],
  emits: ['update:modelValue', 'select-all', 'unselect-all', 'drag-start', 'drag-over', 'drag-drop', 'drag-end', 'toggle-col', 'save-config'],
  computed: {
    visible: {
      get() { return this.modelValue },
      set(val) { this.$emit('update:modelValue', val) }
    }
  },
  methods: {
    getColLetter(idx) {
      const letters = [
        "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
        "AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR","AS","AT","AU","AV"
      ];
      return letters[idx] || (idx + 1);
    },
    getColOriginalIndex(colName) {
      return this.rawColumnsMaster.indexOf(colName);
    },
    getSelectedOrder(colName) {
      const idx = this.selectedColumns.indexOf(colName);
      return idx >= 0 ? (idx + 1) : '-';
    }
  }
}
</script>