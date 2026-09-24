// src/utils/exportImportHelpers.js
import axios from 'axios';

// 輔助函式：讓 CPU 喘息，避免 HTTP 連線擠塞
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 安全的欄位值讀取工具函式
const getRowValue = (row, col) => {
  if (!row) return '-';
  const val = row[col];
  if (val !== null && val !== undefined && String(val).trim() !== '') return val;
  return '-';
};

// 1. CSV 批次寫入地端 SQLite (完整 48 欄位轉譯，絕不漏掉任何一個欄位)
export async function processCsvUpload(file, onProgress, sendLogCallback) {
  return new Promise((resolve, reject) => {
    const papa = window.Papa || (typeof Papa !== 'undefined' ? Papa : null);
    if (!papa) {
      reject(new Error('PapaParse 解析庫尚未載入完成，請重新整理頁面再試'));
      return;
    }

    papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(), // 清理 UTF-8 BOM 頭與空格
      complete: async (results) => {
        const allData = results.data;
        const totalRows = allData.length;

        try {
          if (!allData || totalRows === 0) {
            throw new Error('CSV 檔案為空或無有效資料！');
          }

          if (onProgress) onProgress(0);

          const batchSize = 10000;
          let inserted = 0;

          for (let i = 0; i < totalRows; i += batchSize) {
            const chunk = allData.slice(i, i + batchSize);

            // 🌟 完整 48 欄位精準轉譯與傳輸
            const parsedChunk = chunk.map(row => ({
              item_id: row['商品ID'] || row['item_id'] || '',
              item_name: row['商品名稱'] || row['item_name'] || '',
              borrow_proc: row['借/採'] || row['borrow_proc'] || '',
              location: row['儲位'] || row['location'] || '',
              qty: row['儲位庫存數'] || row['qty'] || 0,
              age: row['庫齡'] || row['age'] || 0,
              zone_id: row['區編'] || row['zone_id'] || '',
              zone_name: row['區名'] || row['zone_name'] || '',
              hall_id: row['館編'] || row['hall_id'] || '',
              hall_name: row['館名'] || row['hall_name'] || '',
              length: row['長(cm)'] || row['length'] || 0,
              width: row['寬(cm)'] || row['width'] || 0,
              height: row['高(cm)'] || row['height'] || 0,
              weight: row['重量(kg)'] || row['weight'] || 0,
              monthly_sales: row['(近)月銷量'] || row['monthly_sales'] || 0,
              pick_days_m: row['(近)月-有揀貨單天數'] || row['pick_days_m'] || 0,
              sales_90d: row['(近)90日銷量'] || row['sales_90d'] || 0,
              pick_days_90d: row['(近)90日-有揀貨單天數'] || row['pick_days_90d'] || 0,
              supplier_id: row['供應商ID'] || row['supplier_id'] || '',
              supplier_name: row['供應商名稱'] || row['supplier_name'] || '',
              pm: row['所屬PM'] || row['pm'] || '',
              total_qty: row['總庫存數'] || row['total_qty'] || 0,
              turn_days_total: row['總庫存_迴轉天數'] || row['turn_days_total'] || 0,
              cubic_feet: row['才數'] || row['cubic_feet'] || 0,
              vol_type: row['材積別'] || row['vol_type'] || '',
              loc_code_3: row['儲位編碼-3'] || row['loc_code_3'] || '',
              loc_code_full: row['儲位編碼'] || row['loc_code_full'] || '',
              loc_code_5: row['儲位編碼5'] || row['loc_code_5'] || '',
              floor: row['樓層'] || row['floor'] || '',
              floor_zone: row['樓層區域'] || row['floor_zone'] || '',
              loc_type: row['儲位型態'] || row['loc_type'] || '',
              big_zone_id: row['大區編'] || row['big_zone_id'] || '',
              big_zone: row['大區名'] || row['big_zone'] || '',
              dim_sum: row['三邊長'] || row['dim_sum'] || 0,
              max_dim: row['最長邊'] || row['max_dim'] || 0,
              min_dim: row['最短邊'] || row['min_dim'] || 0,
              loc_cubic_feet: row['儲位才數'] || row['loc_cubic_feet'] || 0,
              loc_health: row['儲位健康度'] || row['loc_health'] || '',
              non_compliant: row['不符合'] || row['non_compliant'] || '',
              vol_check: row['材積判斷'] || row['vol_check'] || '',
              total_cubic_feet: row['總才數'] || row['total_cubic_feet'] || 0,
              auto_type: row['人工/自動'] || row['auto_type'] || '',
              shelf_level: row['儲位層標示'] || row['shelf_level'] || '',
              age_bracket: row['庫齡級距'] || row['age_bracket'] || '',
              floor_config: row['樓層設定'] || row['floor_config'] || '',
              heavy_rack_check: row['重型架判斷'] || row['heavy_rack_check'] || '',
              assigned_floor: row['ID指定樓層'] || row['assigned_floor'] || '',
              remark: row['備註'] || row['remark'] || ''
            }));
            
            const response = await axios.post('/api/upload', { 
              items: parsedChunk,
              isFirstChunk: i === 0 
            });

            if (!response.data || !response.data.success) {
              throw new Error(response.data?.message || `第 ${i + 1} ~ ${i + chunk.length} 筆寫入失敗`);
            }

            inserted += chunk.length;
            const percent = Math.min(100, Math.round((inserted / totalRows) * 100));
            
            if (onProgress) onProgress(percent);
            await sleep(30);
          }

          if (sendLogCallback) sendLogCallback('資料匯入', `成功匯入 ${totalRows.toLocaleString()} 筆資料至地端 SQLite：` + file.name);
          resolve(totalRows);
        } catch (err) {
          const errorMsg = err.response?.data?.error || err.message;
          if (sendLogCallback) sendLogCallback('資料匯入', '⚠️ 寫入地端 SQLite 失敗: ' + errorMsg);
          reject(new Error(errorMsg));
        }
      },
      error: (err) => {
        if (sendLogCallback) sendLogCallback('資料匯入', '⚠️ 解析 CSV 檔案失敗: ' + err.message);
        reject(err);
      }
    });
  });
}

// 2. 報表匯出 (PDF / Excel / CSV)
export function processExportData({ fmt, tableData, exportCols, moduleName, summary, searchTime, sendLogCallback, formatNumber }) {
  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  const fileName = `${moduleName}_${dateStr}_${timeStr}`;

  const safeFormat = formatNumber || (val => val || 0);
  const targetFmt = String(fmt).toLowerCase();

  // A. Excel
  if (targetFmt === 'excel' || targetFmt === 'xlsx') {
    const xlsxLib = window.XLSX || (typeof XLSX !== 'undefined' ? XLSX : null);
    if (xlsxLib) {
      const excelRows = [];
      excelRows.push([`📊 ${moduleName} - 庫存明細`]);
      excelRows.push([]);
      const summaryStr = `總品項：${safeFormat(summary?.total_items || 0)} | 總列數：${safeFormat(summary?.total_rows || 0)} | 總庫存：${safeFormat(summary?.total_pcs || 0)} | 總才數：${safeFormat(summary?.total_ao || 0)} | 時間：${searchTime || new Date().toLocaleString()}`;
      excelRows.push([summaryStr]);
      excelRows.push([]);
      excelRows.push(exportCols);

      tableData.forEach(row => {
        const r = exportCols.map(c => getRowValue(row, c));
        excelRows.push(r);
      });

      const worksheet = xlsxLib.utils.aoa_to_sheet(excelRows);
      const totalCols = exportCols.length;
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } }
      ];

      const colWidths = exportCols.map(colName => {
        let maxLen = String(colName).length * 2;
        tableData.slice(0, 100).forEach(r => {
          const valStr = String(getRowValue(r, colName) || '');
          const len = valStr.replace(/[^\x00-\xff]/g, 'aa').length;
          if (len > maxLen) maxLen = len;
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 50) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(workbook, worksheet, "庫存明細");
      xlsxLib.writeFile(workbook, fileName + ".xlsx");

      if (sendLogCallback) sendLogCallback('資料匯出', '匯出美化版 ' + fileName + '.xlsx 成功');
      return fileName;
    }
  }

  // B. CSV
  if (targetFmt === 'csv') {
    let csvContent = "\uFEFF";
    csvContent += `"${moduleName} - 庫存明細"\n`;
    const summaryStr = `總品項：${safeFormat(summary?.total_items || 0)} | 總列數：${safeFormat(summary?.total_rows || 0)} | 總庫存：${safeFormat(summary?.total_pcs || 0)} | 總才數：${safeFormat(summary?.total_ao || 0)} | 時間：${searchTime || new Date().toLocaleString()}`;
    csvContent += `"${summaryStr}"\n\n`;

    csvContent += exportCols.map(c => `"${c}"`).join(",") + "\n";
    tableData.forEach(row => {
      let line = exportCols.map(c => {
        let val = String(getRowValue(row, c));
        return '"' + val.replace(/"/g, '""') + '"';
      }).join(",");
      csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName + '.csv';
    link.click();

    if (sendLogCallback) sendLogCallback('資料匯出', '匯出 ' + fileName + '.csv 成功');
    return fileName;
  }

  // C. PDF
  if (targetFmt === 'pdf') {
    let tableRows = tableData.map(r =>
      '<tr>' + exportCols.map(c => '<td style="border:1px solid #ddd;padding:4px;font-size:11px;">' + getRowValue(r, c) + '</td>').join('') + '</tr>'
    ).join('');

    const htmlContent = '<html><head><title>' + fileName + '</title>' +
      '<style>body{font-family:sans-serif;padding:20px;}.summary-box{border:1px solid #333;padding:10px;margin-bottom:15px;}table{width:100%;border-collapse:collapse;margin-top:10px;}th{background:#0f172a;color:white;border:1px solid #ddd;padding:6px;font-size:12px;}</style>' +
      '</head><body>' +
      '<h2>📊 ' + moduleName + ' - 庫存明細</h2>' +
      '<div class="summary-box">' +
      '<b>總品項：</b>' + safeFormat(summary?.total_items || 0) + ' | ' +
      '<b>總列數：</b>' + safeFormat(summary?.total_rows || 0) + ' | ' +
      '<b>總庫存：</b>' + safeFormat(summary?.total_pcs || 0) + ' | ' +
      '<b>總才數：</b>' + safeFormat(summary?.total_ao || 0) + ' | ' +
      '<b>時間：</b>' + (searchTime || new Date().toLocaleString()) +
      '</div>' +
      '<table><thead><tr>' + exportCols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + tableRows + '</tbody></table>' +
      '<script>window.onload=function(){window.print();}</' + 'script>' +
      '</body></html>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
    if (sendLogCallback) sendLogCallback('資料匯出', '匯出 PDF 報表成功');
    return fileName;
  }
}