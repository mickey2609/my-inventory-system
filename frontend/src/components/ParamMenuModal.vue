<template>
  <el-dialog 
    title="⚙️ 參數設定選項" 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)" 
    width="450px" 
    class="dark-dialog"
  >
    <div class="param-dialog-body">
      <!-- 🌟 將「匯入庫存 CSV」按鈕收合至此 -->
      <button class="aligned-btn btn-purple" @click="$emit('open-import-inventory')">
        📥 匯入最新庫存 CSV 資料
      </button>

      <button class="aligned-btn btn-blue" @click="$emit('open-col-setting')">
        1. 庫存明細欄位順序設定
      </button>

      <button class="aligned-btn btn-green" @click="$emit('open-width-config')">
        2. 庫存明細欄寬設定
      </button>

      <button class="aligned-btn btn-orange" @click="$emit('open-export-width-config')">
        3. 庫存明細匯出欄寬設定
      </button>

      <!-- 三種匯出格式權限控制區塊 -->
      <div class="export-toggle-box">
        <div class="toggle-header">
          <span class="toggle-title">🔒 開放庫存查詢 80 匯出功能權限</span>
          <span class="toggle-sub">未勾選之項目，一般管理員與一般人員將無法看見該匯出按鈕</span>
        </div>

        <div class="checkbox-group flex-col">
          <el-checkbox 
            :model-value="exportConfig.xlsx" 
            @change="$emit('update-export-config', { ...exportConfig, xlsx: $event })"
          >
            📊 開放 <b>匯出 xlsx</b> 按鈕
          </el-checkbox>

          <el-checkbox 
            :model-value="exportConfig.csv" 
            @change="$emit('update-export-config', { ...exportConfig, csv: $event })"
          >
            📄 開放 <b>匯出 CSV</b> 按鈕
          </el-checkbox>

          <el-checkbox 
            :model-value="exportConfig.pdf" 
            @change="$emit('update-export-config', { ...exportConfig, pdf: $event })"
          >
            🖨️ 開放 <b>匯出 PDF</b> 按鈕
          </el-checkbox>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:modelValue', false)">關閉</el-button>
        <el-button type="primary" :loading="saving" @click="$emit('save-export-config')">
          💾 儲存並同步至全公司
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'ParamMenuModal',
  props: {
    modelValue: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
    exportConfig: {
      type: Object,
      default: () => ({ xlsx: true, csv: true, pdf: true })
    }
  },
  emits: [
    'update:modelValue', 
    'update-export-config', 
    'save-export-config',
    'open-import-inventory',
    'open-col-setting', 
    'open-width-config', 
    'open-export-width-config'
  ]
}
</script>

<style scoped>
.param-dialog-body { display: flex; flex-direction: column; gap: 12px; padding: 10px 0; }
.aligned-btn { width: 100%; height: 42px; display: flex !important; align-items: center !important; justify-content: flex-start !important; padding-left: 20px !important; font-size: 14px; font-weight: bold; border-radius: 6px; border: none; color: #ffffff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); }
.aligned-btn.btn-purple { background-color: #8b5cf6; }
.aligned-btn.btn-purple:hover { background-color: #7c3aed; }
.aligned-btn.btn-blue { background-color: #2563eb; }
.aligned-btn.btn-blue:hover { background-color: #1d4ed8; }
.aligned-btn.btn-green { background-color: #059669; }
.aligned-btn.btn-green:hover { background-color: #047857; }
.aligned-btn.btn-orange { background-color: #d97706; }
.aligned-btn.btn-orange:hover { background-color: #b45309; }

.export-toggle-box {
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 14px;
  margin-top: 4px;
}

.toggle-header { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.toggle-title { color: #f8fafc; font-size: 14px; font-weight: bold; }
.toggle-sub { color: #94a3b8; font-size: 11px; }

.checkbox-group.flex-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 5px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-checkbox__label) {
  color: #cbd5e1 !important;
  font-size: 13px;
}
</style>