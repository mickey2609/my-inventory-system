<template>
  <el-dialog 
    title="📋 設定顯示欄位與順序 (全公司同步)" 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)" 
    width="920px" 
    custom-class="dark-dialog col-config-dialog"
  >
    <div class="col-config-container">
      <div class="tip-bar">
        <span>💡 打勾選取欄位，按住 <b>☰</b> 拖拉卡片即可調整縱向/橫向順序（完成後全公司同步生效）</span>
        <div class="btn-group">
          <el-button type="primary" size="mini" @click="$emit('select-all')">全選</el-button>
          <el-button size="mini" @click="$emit('unselect-all')">全不選</el-button>
        </div>
      </div>

      <!-- 🌟 改為直向流動 (grid-auto-flow: column) 網格容器 -->
      <div class="column-cards-grid">
        <div 
          v-for="(col, idx) in allAvailableColumns" 
          :key="col"
          class="col-card-item"
          :class="{ 'is-selected': isSelected(col), 'is-dragging': draggedIndex === idx }"
          draggable="true"
          @dragstart="$emit('drag-start', $event, idx)"
          @dragover.prevent="$emit('drag-over', $event, idx)"
          @drop="$emit('drag-drop')"
          @dragend="$emit('drag-end')"
        >
          <div class="drag-handle" title="按住拖拽調整順序">☰</div>
          <el-checkbox 
            :model-value="isSelected(col)" 
            @change="$emit('toggle-col', col)"
            class="col-checkbox"
          >
            <span class="col-name">[{{ getExcelColLetter(idx) }}] {{ col }}</span>
          </el-checkbox>
          <span class="order-badge">{{ idx + 1 }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:modelValue', false)">取消</el-button>
        <el-button 
          v-if="isAdmin" 
          type="warning" 
          :loading="savingConfig" 
          @click="$emit('save-config')"
          style="background: #eab308; border-color: #d97706; color: #000; font-weight: bold;"
        >
          💾 儲存為全公司預設順序
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'ColConfigModal',
  props: {
    modelValue: Boolean,
    isAdmin: Boolean,
    allAvailableColumns: {
      type: Array,
      default: () => []
    },
    selectedColumns: {
      type: Array,
      default: () => []
    },
    draggedIndex: Number,
    savingConfig: Boolean
  },
  methods: {
    isSelected(col) {
      return Array.isArray(this.selectedColumns) && this.selectedColumns.includes(col);
    },
    // 自動生成 Excel 欄位英文字母代號 (A, B... Z, AA, AB...)
    getExcelColLetter(index) {
      let temp = '';
      let letter = '';
      while (index >= 0) {
        temp = index % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    }
  }
}
</script>

<style scoped>
.col-config-container {
  padding: 5px;
}

.tip-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  background-color: #0f172a;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  font-size: 13px;
  color: #cbd5e1;
}

.btn-group {
  display: flex;
  gap: 8px;
}

/* 🌟 設定固定 9 列 (rows)，並使用 grid-auto-flow: column 讓資料直向填滿排列 */
.column-cards-grid {
  display: grid;
  grid-template-rows: repeat(9, auto);
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 1fr);
  gap: 10px;
  max-height: 60vh;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
}

/* 單一欄位卡片樣式 */
.col-card-item {
  display: flex;
  align-items: center;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
  user-select: none;
  transition: all 0.2s ease;
  position: relative;
  height: 38px;
  box-sizing: border-box;
}

.col-card-item:hover {
  border-color: #38bdf8;
  background-color: #1e293b;
  transform: translateY(-1px);
}

.col-card-item.is-selected {
  border-color: #0284c7;
  background-color: rgba(2, 132, 199, 0.15);
}

.col-card-item.is-dragging {
  opacity: 0.4;
  border: 2px dashed #38bdf8;
}

.drag-handle {
  cursor: grab;
  color: #64748b;
  font-size: 16px;
  margin-right: 8px;
}

.drag-handle:active {
  cursor: grabbing;
  color: #38bdf8;
}

.col-checkbox {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  margin-right: 0 !important;
}

:deep(.col-checkbox .el-checkbox__label) {
  color: #f8fafc !important;
  font-size: 13px;
  padding-left: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-badge {
  background-color: #334155;
  color: #94a3b8;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
  margin-left: 6px;
}

.col-card-item.is-selected .order-badge {
  background-color: #0284c7;
  color: #ffffff;
}
</style>