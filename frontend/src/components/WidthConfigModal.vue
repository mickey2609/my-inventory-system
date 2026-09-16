<template>
  <div>
    <!-- 顯示欄寬設定 (px) -->
    <el-dialog 
      title="📏 2. 庫存明細顯示欄寬設定 (px)" 
      :model-value="showWidthConfig" 
      @update:model-value="$emit('update:showWidthConfig', $event)" 
      width="480px" 
      class="dark-dialog"
    >
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in selectedColumns" :key="col" class="config-row">
          <span class="config-label">{{ col }}</span>
          <el-input-number size="small" :min="50" :max="600" v-model="customColWidths[col]" placeholder="像素(px)"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="$emit('update:showWidthConfig', false); $message.success('已套用畫面顯示欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>

    <!-- 匯出欄寬設定 (字符) -->
    <el-dialog 
      title="📊 3. 庫存明細匯出欄寬設定 (字符)" 
      :model-value="showExportWidthConfig" 
      @update:model-value="$emit('update:showExportWidthConfig', $event)" 
      width="480px" 
      class="dark-dialog"
    >
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in selectedColumns" :key="col" class="config-row">
          <span class="config-label">{{ col }}</span>
          <el-input-number size="small" :min="10" :max="100" v-model="customExportColWidths[col]" placeholder="字符寬度"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="$emit('update:showExportWidthConfig', false); $message.success('已套用匯出報表欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'WidthConfigModal',
  props: {
    showWidthConfig: Boolean,
    showExportWidthConfig: Boolean,
    selectedColumns: { type: Array, default: () => [] },
    customColWidths: { type: Object, default: () => ({}) },
    customExportColWidths: { type: Object, default: () => ({}) }
  },
  emits: ['update:showWidthConfig', 'update:showExportWidthConfig']
}
</script>

<style scoped>
.config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; }
.config-label { font-weight: bold; color: #f8fafc; font-size: 13px; }
</style>