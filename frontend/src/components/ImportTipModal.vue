<template>
  <div>
    <!-- 商品 CSV 匯入說明 -->
    <el-dialog 
      title="📥 商品資料明細匯入說明" 
      :model-value="showInventoryImportTip" 
      @update:model-value="$emit('update:showInventoryImportTip', $event)" 
      width="480px" 
      class="dark-dialog"
      :close-on-click-modal="!isUploading"
      :show-close="!isUploading"
    >
      <div style="font-size: 14px; line-height: 1.8; color: #cbd5e1;">
        <p style="margin-top: 0; color: #38bdf8; font-weight: bold;">請確認您準備上傳的商品明細檔案符合以下規範：</p>
        <ol style="padding-left: 20px; margin-bottom: 15px;">
          <li><b>建議上傳檔案格式</b>：<code style="color: #4ade80;">.csv</code></li>
          <li><b>更新效益</b>：上傳成功後，資料將直接寫入 Cloudflare D1 資料庫，<b>即時同步全公司最新庫存</b>！</li>
        </ol>

        <!-- 🎨 美化版動態進度條 (僅在上傳時顯示) -->
        <div v-if="isUploading" style="margin-top: 20px; padding: 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155;">
          <div style="font-size: 13px; color: #38bdf8; margin-bottom: 8px; font-weight: bold;">
            🚀 寫入 Cloudflare D1 資料庫中...
          </div>
          <el-progress 
            :percentage="uploadPercent" 
            :status="uploadPercent === 100 ? 'success' : ''"
            :stroke-width="18"
            striped
            striped-flow
            :duration="10"
          />
        </div>
      </div>

      <template #footer>
        <el-button :disabled="isUploading" @click="$emit('update:showInventoryImportTip', false)">取消</el-button>
        <el-button 
          type="warning" 
          :loading="isUploading"
          style="font-weight: bold; color: #000;" 
          @click="$emit('confirm-inventory-import')"
        >
          {{ isUploading ? '寫入中...' : '確定，選擇檔案並開始匯入' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 帳號批次匯入說明 -->
    <el-dialog 
      title="📥 批次匯入帳號欄位格式說明" 
      :model-value="showImportTip" 
      @update:model-value="$emit('update:showImportTip', $event)" 
      width="480px" 
      class="dark-dialog"
    >
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
  name: 'ImportTipModal',
  props: {
    showInventoryImportTip: Boolean,
    showImportTip: Boolean,
    isUploading: Boolean,
    uploadPercent: Number
  },
  emits: [
    'update:showInventoryImportTip',
    'update:showImportTip',
    'confirm-inventory-import',
    'confirm-batch-import'
  ]
}
</script>