<template>
  <el-dialog 
    title="🔍 庫存查詢條件設定" 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)" 
    width="800px" 
    custom-class="dark-dialog inventory-search-modal"
  >
    <div class="search-modal-container">
      <!-- 只有最高系統管理員看得到此按鈕 -->
      <el-button 
        v-if="isSysAdmin"
        type="warning" 
        class="param-btn" 
        @click="onParamMenuClick"
      >
        📋 參數設定
      </el-button>

      <div class="form-section">
        <!-- 1. 查詢模式切換 -->
        <div class="form-row">
          <div class="form-group full-width">
            <label class="field-label">查詢模式</label>
            <el-select v-model="form.search_mode" placeholder="請選擇模式" style="width: 100%;" @change="onSearchModeChange">
              <el-option label="一般查詢 (單項/多條件)" value="normal"></el-option>
              <el-option label="批次商品 ID 查詢 (多筆ID)" value="batch_id"></el-option>
              <el-option label="批次儲位區編查詢 (多筆區編)" value="batch_zone"></el-option>
            </el-select>
          </div>
        </div>

        <!-- 2. 批次查詢輸入框 (依據模式切換) -->
        <div v-if="form.search_mode === 'batch_id'" class="form-row">
          <div class="form-group full-width">
            <label class="field-label">批次商品 ID (以換行、短劃線或空白分隔)</label>
            <el-input type="textarea" :rows="6" v-model="form.batch_ids" placeholder="請在此貼上多筆商品 ID，例如：&#10;DYAQ8F-A900GY9S3-000&#10;DYAQ8F-A900GBL5E-000"></el-input>
          </div>
        </div>

        <div v-else-if="form.search_mode === 'batch_zone'" class="form-row">
          <div class="form-group full-width">
            <label class="field-label">批次儲位區編 (以換行、逗號或空白分隔)</label>
            <el-input type="textarea" :rows="6" v-model="form.batch_zones" placeholder="例如: A01, A02, B01..."></el-input>
          </div>
        </div>

        <!-- 3. 一般多條件查詢欄位 (當非批次模式時顯示) -->
        <template v-else>
          <div class="form-row two-cols">
            <div class="form-group">
              <label class="field-label">商品 ID (關鍵字)</label>
              <el-input v-model="form.txt_id" placeholder="關鍵字..." clearable></el-input>
            </div>
            <div class="form-group">
              <label class="field-label">商品名稱 (關鍵字)</label>
              <el-input v-model="form.txt_name" placeholder="關鍵字..." clearable></el-input>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label class="field-label">大區名 (商品大類)</label>
              <el-select v-model="form.cbo_big_zone" placeholder="全部" style="width: 100%;" clearable @change="$emit('big-zone-change', $event)">
                <el-option v-for="item in options.big_zones" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
            <div class="form-group">
              <label class="field-label">區名 (商品細類)</label>
              <el-select v-model="form.cbo_zone" placeholder="全部" style="width: 100%;" clearable>
                <el-option v-for="item in options.zones" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label class="field-label">儲位查詢 (關鍵字)</label>
              <el-input v-model="form.cbo_loc_id" placeholder="輸入儲位..." clearable></el-input>
            </div>
            <div class="form-group">
              <label class="field-label">樓層</label>
              <el-select v-model="form.cbo_floor" placeholder="全部" style="width: 100%;" clearable>
                <el-option v-for="item in ['1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F']" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>

          <div class="form-row three-cols">
            <div class="form-group">
              <label class="field-label">庫齡 (>=或範圍)</label>
              <el-input v-model="form.txt_age" placeholder="例:30或10-50" clearable></el-input>
            </div>
            <div class="form-group">
              <label class="field-label">重量 (>=KG)</label>
              <el-input v-model="form.txt_weight" placeholder="例:5" clearable></el-input>
            </div>
            <div class="form-group">
              <label class="field-label">月銷量 (>=)</label>
              <el-input v-model="form.txt_monthly_sales" placeholder="例:100" clearable></el-input>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label class="field-label">存放區域 (人工/自動)</label>
              <el-select v-model="form.cbo_type" placeholder="全部" style="width: 100%;" clearable>
                <el-option label="人工" value="人工"></el-option>
                <el-option label="自動" value="自動"></el-option>
              </el-select>
            </div>
            <div class="form-group">
              <label class="field-label">材積別</label>
              <el-select v-model="form.cbo_vol_type" placeholder="全部" style="width: 100%;" clearable>
                <el-option v-for="item in options.vol_types" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </div>
          </div>
        </template>

        <!-- 4. 顯示與排序設定區塊 -->
        <div class="divider-line">
          <span>顯示與排序設定</span>
        </div>

        <div class="form-row checkbox-row">
          <el-checkbox v-model="form.chk_show_loc">顯示儲位明細 (+儲位)</el-checkbox>
          <el-checkbox v-model="form.chk_show_dim">顯示長寬高重量 (+材積/重量)</el-checkbox>
        </div>

        <div class="form-row sort-row">
          <div class="form-group flex-1">
            <label class="field-label">清單排序欄位</label>
            <el-select v-model="form.cbo_sort" placeholder="排序欄位" style="width: 100%;">
              <el-option v-for="col in form.selected_columns" :key="col" :label="col" :value="col"></el-option>
            </el-select>
          </div>
          <div class="form-group radio-group">
            <el-radio-group v-model="form.sort_order">
              <el-radio label="asc">遞增</el-radio>
              <el-radio label="desc">遞減</el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:modelValue', false)">取消</el-button>
        <el-button type="danger" class="submit-btn" :loading="loading" @click="$emit('submit-search')">
          🚀 開始搜索 {{ loading ? `(${searchElapsedSec}s)` : '' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'InventorySearchModal',
  props: {
    modelValue: Boolean,
    form: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default: () => ({ big_zones: [], zones: [], vol_types: [] })
    },
    loading: Boolean,
    searchElapsedSec: [Number, String],
    isSysAdmin: Boolean
  },
  emits: ['update:modelValue', 'open-param-menu', 'big-zone-change', 'submit-search'],
  methods: {
    onParamMenuClick() {
      if (!this.isSysAdmin) {
        this.$message.warning('⚠️ 僅限最高系統管理員 (admin) 才能修改全公司預設參數設定！');
        return;
      }
      this.$emit('open-param-menu');
    },
    onSearchModeChange(val) {
      if (val === 'batch_id') {
        // 🌟 切換至批次商品 ID 模式時，徹底清空一般查詢條件與批次區編
        this.form.txt_id = '';
        this.form.txt_name = '';
        this.form.cbo_big_zone = '';
        this.form.cbo_zone = '';
        this.form.cbo_loc_id = '';
        this.form.cbo_floor = '';
        this.form.txt_age = '';
        this.form.txt_weight = '';
        this.form.txt_monthly_sales = '';
        this.form.cbo_type = '';
        this.form.cbo_vol_type = '';
        this.form.batch_zones = '';
      } else if (val === 'batch_zone') {
        // 切換至批次區編模式時，清空其他條件
        this.form.txt_id = '';
        this.form.txt_name = '';
        this.form.cbo_big_zone = '';
        this.form.cbo_zone = '';
        this.form.cbo_loc_id = '';
        this.form.cbo_floor = '';
        this.form.txt_age = '';
        this.form.txt_weight = '';
        this.form.txt_monthly_sales = '';
        this.form.cbo_type = '';
        this.form.cbo_vol_type = '';
        this.form.batch_ids = '';
      } else if (val === 'normal') {
        // 切換回一般模式時，清空批次欄位
        this.form.batch_ids = '';
        this.form.batch_zones = '';
      }
    }
  }
}
</script>

<style scoped>
.search-modal-container {
  padding: 5px;
}

.param-btn {
  width: 100%;
  background-color: #eab308 !important;
  border-color: #ca8a04 !important;
  color: #000000 !important;
  font-weight: bold;
  margin-bottom: 20px;
  height: 38px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-row {
  display: flex;
  gap: 15px;
  align-items: center;
}

.form-row.two-cols .form-group {
  flex: 1;
}

.form-row.three-cols .form-group {
  flex: 1;
}

.form-group.full-width {
  width: 100%;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #cbd5e1;
  margin-bottom: 6px;
  font-weight: bold;
}

.divider-line {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 10px 0;
}

.divider-line::before,
.divider-line::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #334155;
}

.divider-line span {
  padding: 0 10px;
  color: #94a3b8;
  font-size: 12px;
}

.checkbox-row {
  justify-content: flex-start;
  gap: 30px;
}

:deep(.el-checkbox__label) {
  color: #cbd5e1 !important;
}

.sort-row {
  align-items: flex-end;
}

.radio-group {
  padding-bottom: 5px;
}

:deep(.el-radio__label) {
  color: #cbd5e1 !important;
}

.submit-btn {
  background-color: #ef4444 !important;
  border-color: #dc2626 !important;
  font-weight: bold;
  padding: 10px 25px;
}
</style>