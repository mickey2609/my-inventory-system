<template>
  <div>
    <!-- 1. 參數設定選項菜單 -->
    <el-dialog title="⚙️ 參數設定選項" :model-value="showParamMenu" @update:model-value="$emit('update:showParamMenu', $event)" width="400px" class="dark-dialog">
      <div class="param-dialog-body">
        <button class="aligned-btn btn-blue" @click="$emit('open-col-setting')">
          1. 庫存明細欄位順序設定
        </button>
        <button class="aligned-btn btn-green" @click="$emit('open-width-config')">
          2. 庫存明細欄寬設定
        </button>
        <button class="aligned-btn btn-orange" @click="$emit('open-export-width-config')">
          3. 庫存明細匯出欄寬設定
        </button>
      </div>
      <template #footer>
        <el-button @click="$emit('update:showParamMenu', false)">關閉</el-button>
      </template>
    </el-dialog>

    <!-- 2. 顯示欄寬設定 -->
    <el-dialog title="📏 2. 庫存明細顯示欄寬設定 (px)" :model-value="showWidthConfig" @update:model-value="$emit('update:showWidthConfig', $event)" width="480px" class="dark-dialog">
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in selectedColumns" :key="col" class="config-row">
          <span class="config-label">{{ col }}</span>
          <el-input-number size="small" :min="50" :max="600" :model-value="customColWidths[col]" @update:model-value="updateWidth(col, $event)" placeholder="像素(px)"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="$emit('update:showWidthConfig', false); $message.success('已套用畫面顯示欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>

    <!-- 3. 匯出欄寬設定 -->
    <el-dialog title="📊 3. 庫存明細匯出欄寬設定 (字符)" :model-value="showExportWidthConfig" @update:model-value="$emit('update:showExportWidthConfig', $event)" width="480px" class="dark-dialog">
      <div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">
        <div v-for="col in selectedColumns" :key="col" class="config-row">
          <span class="config-label">{{ col }}</span>
          <el-input-number size="small" :min="10" :max="100" :model-value="customExportColWidths[col]" @update:model-value="updateExportWidth(col, $event)" placeholder="字符寬度"></el-input-number>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="$emit('update:showExportWidthConfig', false); $message.success('已套用匯出報表欄寬設定！');">確定套用</el-button>
      </template>
    </el-dialog>

    <!-- 4. 商品資料明細匯入說明 -->
    <el-dialog title="📥 商品資料明細匯入說明" :model-value="showInventoryImportTip" @update:model-value="$emit('update:showInventoryImportTip', $event)" width="480px" class="dark-dialog">
      <div style="font-size: 14px; line-height: 1.8; color: #cbd5e1;">
        <p style="margin-top: 0; color: #38bdf8; font-weight: bold;">請確認您準備上傳的商品明細檔案符合以下規範：</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li><b>建議上傳檔案格式</b>：<code style="color: #4ade80;">.csv</code></li>
          <li><b>更新效益</b>：上傳成功後，資料將直接寫入 Cloudflare D1 資料庫，<b>即時同步全公司最新庫存</b>！</li>
        </ol>
      </div>
      <template #footer>
        <el-button @click="$emit('update:showInventoryImportTip', false)">取消</el-button>
        <el-button type="warning" style="font-weight: bold; color: #000;" @click="$emit('confirm-inventory-import')">確定，選擇檔案並開始匯入</el-button>
      </template>
    </el-dialog>

    <!-- 5. 批次匯入帳號欄位格式說明 -->
    <el-dialog title="📥 批次匯入帳號欄位格式說明" :model-value="showImportTip" @update:model-value="$emit('update:showImportTip', $event)" width="480px" class="dark-dialog">
      <div style="font-size: 14px; line-height: 1.8; color: #cbd5e1;">
        <p style="margin-top: 0; color: #38bdf8; font-weight: bold;">請確認您準備上傳的 Excel/CSV 檔案符合以下格式：</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li><b>第 1 列為欄位表頭</b>，必須包含：<br/><code style="color: #4ade80;">帳號</code> (或 <code>員編</code>)、<code style="color: #4ade80;">姓名</code>、<code style="color: #4ade80;">身份</code> (可選)</li>
          <li><b>帳號格式</b>：必須為 6 碼純數字員編（例如：<code>102609</code>）。</li>
          <li><b>預設密碼</b>：匯入後系統將自動將密碼設為同「6 碼員編」。</li>
          <li><b>身份欄位</b>：可填寫 <code>admin</code> 或 <code>user</code>（預設為 user）。</li>
        </ol>
      </div>
      <template #footer>
        <el-button @click="$emit('update:showImportTip', false)">取消</el-button>
        <el-button type="primary" @click="$emit('confirm-batch-import')">確定，選擇檔案並上傳</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'ParamConfigModals',
  props: {
    showParamMenu: Boolean,
    showWidthConfig: Boolean,
    showExportWidthConfig: Boolean,
    showInventoryImportTip: Boolean,
    showImportTip: Boolean,
    selectedColumns: { type: Array, default: () => [] },
    customColWidths: { type: Object, default: () => ({}) },
    customExportColWidths: { type: Object, default: () => ({}) }
  },
  emits: [
    'update:showParamMenu',
    'update:showWidthConfig',
    'update:showExportWidthConfig',
    'update:showInventoryImportTip',
    'update:showImportTip',
    'open-col-setting',
    'open-width-config',
    'open-export-width-config',
    'confirm-inventory-import',
    'confirm-batch-import'
  ],
  methods: {
    updateWidth(col, val) {
      this.customColWidths[col] = val;
    },
    updateExportWidth(col, val) {
      this.customExportColWidths[col] = val;
    }
  }
}
</script>

<style scoped>
.param-dialog-body { display: flex; flex-direction: column; gap: 12px; padding: 10px 0; }
.aligned-btn { width: 100%; height: 42px; display: flex !important; align-items: center !important; justify-content: flex-start !important; padding-left: 20px !important; font-size: 14px; font-weight: bold; border-radius: 6px; border: none; color: #ffffff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.aligned-btn.btn-blue { background-color: #2563eb; }
.aligned-btn.btn-green { background-color: #059669; }
.aligned-btn.btn-orange { background-color: #d97706; }
.config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; }
.config-label { font-weight: bold; color: #f8fafc; font-size: 13px; }
</style>