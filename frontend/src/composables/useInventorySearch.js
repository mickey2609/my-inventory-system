import { ref } from 'vue';
import axios from 'axios';
import { processExportData } from '../utils/exportImportHelpers.js';

export function useInventorySearch(form, columns, customColWidths, getTabName, currentTab, sendCurrentLog, formatNumber) {
  const loading = ref(false);
  const hasSearched = ref(false);
  const tableData = ref([]);
  const activeColumns = ref([]);
  const currentPage = ref(1);
  const pageSize = ref(1000);
  const totalRowsCount = ref(0);
  const searchTime = ref('');
  const searchElapsedSec = ref(0);
  const searchTimer = ref(null);
  const summary = ref({ total_items: 0, total_rows: 0, total_pcs: 0, total_ao: 0 });

  const handleSearch = async (showSearchModalRef) => {
    loading.value = true;
    searchElapsedSec.value = 0;

    if (searchTimer.value) clearInterval(searchTimer.value);
    searchTimer.value = setInterval(() => {
      searchElapsedSec.value = (parseFloat(searchElapsedSec.value) + 0.1).toFixed(1);
    }, 100);

    try {
      let currentCols = [...form.selected_columns];

      if (form.chk_show_loc) {
        if (!currentCols.includes('儲位')) {
          const insertIdx = currentCols.indexOf('儲位庫存數');
          if (insertIdx >= 0) currentCols.splice(insertIdx, 0, '儲位');
          else currentCols.push('儲位');
        }
      } else {
        currentCols = currentCols.filter(c => c !== '儲位');
      }

      const dimCols = ['長(cm)', '寬(cm)', '高(cm)', '重量(kg)', '才數', '材積別'];
      if (form.chk_show_dim) {
        dimCols.forEach(col => {
          if (!currentCols.includes(col)) currentCols.push(col);
        });
      } else {
        currentCols = currentCols.filter(c => !dimCols.includes(c));
      }

      activeColumns.value = currentCols;
      const hasLocationCol = activeColumns.value.includes('儲位');

      const mode = form.search_mode || 'normal';
      let batchTxt = '';
      if (mode === 'batch_id') {
        batchTxt = form.batch_ids || '';
      } else if (mode === 'batch_zone') {
        batchTxt = form.batch_zones || '';
      }

      const params = new URLSearchParams({
        page: currentPage.value,
        pageSize: pageSize.value,
        searchMode: mode,
        batchIds: batchTxt,
        categoryLarge: form.cbo_big_zone || '',
        categorySmall: form.cbo_zone || '',
        keyword: form.txt_id || form.txt_name || '',
        aggregate: hasLocationCol ? 'false' : 'true'
      });

      const res = await axios.get(`/api/search?${params.toString()}`);

      if (res.data && res.data.success) {
        totalRowsCount.value = res.data.total || 0;

        const rawData = res.data.data || [];
        tableData.value = rawData.map(row => {
          const getAnyVal = (...keys) => {
            for (const k of keys) {
              if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
                return row[k];
              }
            }
            return '-';
          };

          return {
            ...row,
            '商品ID': getAnyVal('商品ID', 'item_id'),
            '商品名稱': getAnyVal('商品名稱', 'item_name'),
            '借/採': getAnyVal('借/採', 'borrow_proc', 'borrow_type', 'proc_type', 'borrowProc', 'bp'),
            '儲位': getAnyVal('儲位', 'location', 'loc'),
            '儲位庫存數': getAnyVal('儲位庫存數', 'qty', 'loc_qty'),
            '庫齡': getAnyVal('庫齡', 'age'),
            '區編': getAnyVal('區編', 'zone_id'),
            '區名': getAnyVal('區名', 'zone_name'),
            '館編': getAnyVal('館編', 'hall_id'),
            '館名': getAnyVal('館名', 'hall_name'),
            '長(cm)': getAnyVal('長(cm)', 'length'),
            '寬(cm)': getAnyVal('寬(cm)', 'width'),
            '高(cm)': getAnyVal('高(cm)', 'height'),
            '重量(kg)': getAnyVal('重量(kg)', 'weight'),
            '(近)月銷量': getAnyVal('(近)月銷量', 'monthly_sales'),
            '(近)月-有揀貨單天數': getAnyVal('(近)月-有揀貨單天數', 'pick_days_m'),
            '(近)90日銷量': getAnyVal('(近)90日銷量', 'sales_90d'),
            '(近)90日-有揀貨單天數': getAnyVal('(近)90日-有揀貨單天數', 'pick_days_90d'),
            '供應商ID': getAnyVal('供應商ID', 'supplier_id'),
            '供應商名稱': getAnyVal('供應商名稱', 'supplier_name'),
            '所屬PM': getAnyVal('所屬PM', 'pm'),
            '總庫存數': getAnyVal('總庫存數', 'total_qty'),
            '總庫存_迴轉天數': getAnyVal('總庫存_迴轉天數', 'turn_days_total'),
            '才數': getAnyVal('才數', 'cubic_feet'),
            '材積別': getAnyVal('材積別', 'vol_type'),
            '樓層': getAnyVal('樓層', 'floor'),
            '儲位型態': getAnyVal('儲位型態', 'loc_type'),
            '大區編': getAnyVal('大區編', 'big_zone_id'),
            '大區名': getAnyVal('大區名', 'big_zone'),
            '儲位才數': getAnyVal('儲位才數', 'loc_cubic_feet'),
            '儲位健康度': getAnyVal('儲位健康度', 'loc_health'),
            '材積判斷': getAnyVal('材積判斷', 'vol_check'),
            '總才數': getAnyVal('總才數', 'total_cubic_feet'),
            '人工/自動': getAnyVal('人工/自動', 'auto_type', 'is_auto', 'autoType', 'am'),
            '庫齡級距': getAnyVal('庫齡級距', 'age_bracket'),
            '重型架判斷': getAnyVal('重型架判斷', 'heavy_rack_check')
          };
        });

        hasSearched.value = true;
        if (res.data.summary) summary.value = res.data.summary;
        searchTime.value = new Date().toLocaleString() + ' (耗時 ' + searchElapsedSec.value + ' 秒)';
        if (showSearchModalRef) showSearchModalRef.value = false;
      } else {
        tableData.value = [];
      }
    } catch (e) {
      tableData.value = [];
    } finally {
      if (searchTimer.value) clearInterval(searchTimer.value);
      loading.value = false;
    }
  };

  const exportData = async (fmt, $message) => {
    if (!hasSearched.value) {
      $message.warning('請先執行檢索再進行匯出！');
      return;
    }

    const loadingMsg = $message.info({
      message: `⚡ 正在打包全量庫存資料 (${totalRowsCount.value.toLocaleString()} 筆)，請稍候...`,
      duration: 0
    });

    try {
      const hasLocationCol = activeColumns.value.includes('儲位') || form.chk_show_loc;
      const mode = form.search_mode || 'normal';
      let batchTxt = '';

      if (mode === 'batch_id') {
        batchTxt = form.batch_ids || '';
      } else if (mode === 'batch_zone') {
        batchTxt = form.batch_zones || '';
      }

      const params = new URLSearchParams({
        searchMode: mode,
        batchIds: batchTxt,
        categoryLarge: form.cbo_big_zone || '',
        categorySmall: form.cbo_zone || '',
        keyword: form.txt_id || form.txt_name || '',
        aggregate: hasLocationCol ? 'false' : 'true',
        exportAll: 'true'
      });

      const res = await axios.get(`/api/search?${params.toString()}`);
      loadingMsg.close();

      if (res.data && res.data.success && res.data.data) {
        const rawList = res.data.data;
        const exportList = rawList.map(row => {
          const getAnyVal = (...keys) => {
            for (const k of keys) {
              if (row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '') {
                return row[k];
              }
            }
            return '-';
          };

          return {
            ...row,
            '商品ID': getAnyVal('商品ID', 'item_id'),
            '商品名稱': getAnyVal('商品名稱', 'item_name'),
            '借/採': getAnyVal('借/採', 'borrow_proc', 'borrow_type', 'proc_type', 'borrowProc', 'bp'),
            '儲位': getAnyVal('儲位', 'location', 'loc'),
            '儲位庫存數': getAnyVal('儲位庫存數', 'qty', 'loc_qty'),
            '庫齡': getAnyVal('庫齡', 'age'),
            '區編': getAnyVal('區編', 'zone_id'),
            '區名': getAnyVal('區名', 'zone_name'),
            '館編': getAnyVal('館編', 'hall_id'),
            '館名': getAnyVal('館名', 'hall_name'),
            '長(cm)': getAnyVal('長(cm)', 'length'),
            '寬(cm)': getAnyVal('寬(cm)', 'width'),
            '高(cm)': getAnyVal('高(cm)', 'height'),
            '重量(kg)': getAnyVal('重量(kg)', 'weight'),
            '(近)月銷量': getAnyVal('(近)月銷量', 'monthly_sales'),
            '(近)月-有揀貨單天數': getAnyVal('(近)月-有揀貨單天數', 'pick_days_m'),
            '(近)90日銷量': getAnyVal('(近)90日銷量', 'sales_90d'),
            '(近)90日-有揀貨單天數': getAnyVal('(近)90日-有揀貨單天數', 'pick_days_90d'),
            '供應商ID': getAnyVal('供應商ID', 'supplier_id'),
            '供應商名稱': getAnyVal('供應商名稱', 'supplier_name'),
            '所屬PM': getAnyVal('所屬PM', 'pm'),
            '總庫存數': getAnyVal('總庫存數', 'total_qty'),
            '總庫存_迴轉天數': getAnyVal('總庫存_迴轉天數', 'turn_days_total'),
            '才數': getAnyVal('才數', 'cubic_feet'),
            '材積別': getAnyVal('材積別', 'vol_type'),
            '樓層': getAnyVal('樓層', 'floor'),
            '儲位型態': getAnyVal('儲位型態', 'loc_type'),
            '大區編': getAnyVal('大區編', 'big_zone_id'),
            '大區名': getAnyVal('大區名', 'big_zone'),
            '儲位才數': getAnyVal('儲位才數', 'loc_cubic_feet'),
            '儲位健康度': getAnyVal('儲位健康度', 'loc_health'),
            '材積判斷': getAnyVal('材積判斷', 'vol_check'),
            '總才數': getAnyVal('總才數', 'total_cubic_feet'),
            '人工/自動': getAnyVal('人工/自動', 'auto_type', 'is_auto', 'autoType', 'am'),
            '庫齡級距': getAnyVal('庫齡級距', 'age_bracket'),
            '重型架判斷': getAnyVal('重型架判斷', 'heavy_rack_check')
          };
        });

        processExportData({
          fmt,
          tableData: exportList,
          exportCols: activeColumns.value,
          moduleName: getTabName(currentTab.value),
          summary: summary.value,
          searchTime: searchTime.value,
          sendLogCallback: (feat, act) => sendCurrentLog(feat, act),
          formatNumber
        });

        $message.success(`🎉 成功匯出 ${exportList.length.toLocaleString()} 筆庫存資料！`);
      } else {
        $message.error('全量資料拉取失敗，請重試！');
      }
    } catch (e) {
      loadingMsg.close();
      $message.error('匯出過程發生錯誤：' + e.message);
    }
  };

  return {
    loading,
    hasSearched,
    tableData,
    activeColumns,
    currentPage,
    pageSize,
    totalRowsCount,
    searchTime,
    searchElapsedSec,
    summary,
    handleSearch,
    exportData
  };
}