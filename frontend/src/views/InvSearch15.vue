<template>
  <div class="main-layout dark-bg inv-search15-page">
    <div class="search-container">
      <!-- 頂部標題與操作區 -->
      <div class="top-bar-actions">
        <span class="page-title-text">📦 庫存明細查詢 15 (大數據 30~40萬筆處理)</span>
        <div class="btn-group">
          <!-- 上傳按鈕 -->
          <input 
            type="file" 
            ref="csvFileInput15" 
            accept=".csv" 
            style="display: none;" 
            @change="handleCsvUpload15" 
          />
          <el-button 
            type="success" 
            icon="el-icon-upload2" 
            size="small"
            :loading="isUploading"
            @click="$refs.csvFileInput15.click()"
          >
            📥 匯入最新庫存 CSV (latest_inventory15.csv)
          </el-button>

          <el-button 
            type="primary" 
            icon="el-icon-search" 
            size="small" 
            :loading="loading" 
            @click="fetchData(1)"
          >
            🔍 執行查詢
          </el-button>
        </div>
      </div>

      <!-- 篩選列 -->
      <div class="filter-panel dark-panel">
        <el-form :inline="true" size="small" class="dark-form">
          <el-form-item label="關鍵字搜尋:">
            <el-input 
              v-model="query.keyword" 
              placeholder="搜尋商品ID / 名稱 / 儲位" 
              clearable 
              @keyup.enter="fetchData(1)"
              style="width: 240px;"
            ></el-input>
          </el-form-item>

          <el-form-item label="大區名:">
            <el-input v-model="query.categoryLarge" placeholder="輸入大區名" clearable style="width: 150px;"></el-input>
          </el-form-item>

          <el-form-item label="區名:">
            <el-input v-model="query.categorySmall" placeholder="輸入區名" clearable style="width: 150px;"></el-input>
          </el-form-item>
        </el-form>
      </div>

      <!-- 上傳進度條 (當上傳大檔案時顯示) -->
      <div v-if="isUploading" class="upload-progress-box dark-panel">
        <div class="progress-text">⚡ 正在進行分塊寫入 SQLite 中 (已處理: {{ uploadedCount.toLocaleString() }} 筆)...</div>
        <el-progress :percentage="uploadPercentage" :stroke-width="16" striped stripe-processing></el-progress>
      </div>

      <!-- 數據表格區 -->
      <div class="table-wrapper">
        <el-table 
          :data="tableData" 
          border 
          height="100%" 
          size="mini" 
          v-loading="loading" 
          class="dark-table"
        >
          <el-table-column prop="item_id" label="商品ID" width="130" fixed="left"></el-table-column>
          <el-table-column prop="item_name" label="商品名稱" min-width="200" show-overflow-tooltip></el-table-column>
          <el-table-column prop="location" label="儲位" width="120" align="center"></el-table-column>
          <el-table-column prop="qty" label="儲位庫存數" width="100" align="right">
            <template #default="scope">{{ formatNumber(scope.row.qty) }}</template>
          </el-table-column>
          <el-table-column prop="age" label="庫齡" width="80" align="right"></el-table-column>
          <el-table-column prop="big_zone" label="大區名" width="120"></el-table-column>
          <el-table-column prop="zone_name" label="區名" width="120"></el-table-column>
          <el-table-column prop="floor" label="樓層" width="80" align="center"></el-table-column>
          <el-table-column prop="loc_type" label="儲位型態" width="130"></el-table-column>
        </el-table>
      </div>

      <!-- 分頁列 -->
      <div class="pagination-bar dark-panel">
        <span class="total-text">📊 總筆數：<strong>{{ total.toLocaleString() }}</strong> 筆 | 總數量：<strong>{{ totalPcs.toLocaleString() }}</strong> PCS</span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[100, 500, 1000, 2000]"
          layout="sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="fetchData(1)"
          @current-change="fetchData"
          background
        >
        </el-pagination>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'InvSearch15',
  data() {
    return {
      loading: false,
      isUploading: false,
      uploadedCount: 0,
      uploadPercentage: 0,
      page: 1,
      pageSize: 500,
      total: 0,
      totalPcs: 0,
      tableData: [],
      query: {
        keyword: '',
        categoryLarge: '',
        categorySmall: ''
      }
    }
  },
  mounted() {
    this.fetchData(1);
  },
  methods: {
    formatNumber(val) {
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(String(val).replace(/,/g, ''));
      return isNaN(num) ? val : num.toLocaleString();
    },
    async fetchData(targetPage = this.page) {
      this.page = targetPage;
      this.loading = true;
      try {
        const res = await axios.get('/api/inventory15/search', {
          params: {
            page: this.page,
            pageSize: this.pageSize,
            keyword: this.query.keyword,
            categoryLarge: this.query.categoryLarge,
            categorySmall: this.query.categorySmall
          }
        });

        if (res.data?.success) {
          this.tableData = res.data.data || [];
          this.total = res.data.total || 0;
          this.totalPcs = res.data.summary?.total_pcs || 0;
        }
      } catch (err) {
        this.$message.error('讀取庫存 15 資料失敗：' + (err.response?.data?.message || err.message));
      } finally {
        this.loading = false;
      }
    },

    // 🌟 大檔案 CSV 分塊讀取與上傳處理 (已加入空白列自動剔除)
async handleCsvUpload15(event) {
  const file = event.target.files[0];
  if (!file) return;

  this.isUploading = true;
  this.uploadedCount = 0;
  this.uploadPercentage = 0;

  const chunkSize = 10000;
  let isFirstChunk = true;

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length <= 1) {
      this.$message.error('檔案格式無效或無資料');
      this.isUploading = false;
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    let currentBatch = [];

    // 🌟 先過濾出有效資料行（必須包含有效內容，且非純逗號）
    const validLines = [];
    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i].replace(/,/g, '').trim();
      if (lineStr.length > 0) {
        validLines.push(lines[i]);
      }
    }

    const totalLines = validLines.length;

    for (let i = 0; i < totalLines; i++) {
      const rowVals = validLines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (rowVals.length >= headers.length) {
        const rowObj = {};
        headers.forEach((h, idx) => rowObj[h] = rowVals[idx]);

        // 🌟 關鍵過濾：確認 商品ID 或 儲位 不為空
        const itemId = rowObj['商品ID'] || rowObj['item_id'] || '';
        if (itemId.trim() !== '') {
          currentBatch.push(rowObj);
        }
      }

      if (currentBatch.length >= chunkSize || i === totalLines - 1) {
        if (currentBatch.length > 0) {
          await axios.post('/api/inventory15/upload', {
            items: currentBatch,
            isFirstChunk: isFirstChunk
          });

          this.uploadedCount += currentBatch.length;
          this.uploadPercentage = Math.round((i / totalLines) * 100);
          isFirstChunk = false;
          currentBatch = [];
        }
      }
    }

    this.$message.success(`🎉 成功過濾並匯入 ${this.uploadedCount.toLocaleString()} 筆有效資料至 庫存15！`);
    this.fetchData(1);
  } catch (err) {
    this.$message.error('匯入過程發生錯誤：' + (err.response?.data?.message || err.message));
  } finally {
    this.isUploading = false;
    event.target.value = '';
  }
}
  }
}
</script>

<style scoped>
.inv-search15-page {
  padding: 12px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.search-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-bar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.page-title-text {
  font-size: 15px;
  font-weight: bold;
  color: #38bdf8;
}

.btn-group {
  display: flex;
  gap: 8px;
}

.filter-panel {
  background: #1e293b;
  padding: 10px 14px 2px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  margin-bottom: 8px;
}

.upload-progress-box {
  background: #1e293b;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #38bdf8;
  margin-bottom: 8px;
}

.progress-text {
  color: #38bdf8;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 6px;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  margin-bottom: 8px;
}

.pagination-bar {
  background: #1e293b;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-text {
  color: #94a3b8;
  font-size: 13px;
}

.total-text strong {
  color: #38bdf8;
}
</style>