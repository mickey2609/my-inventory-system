const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'frontend/public/latest_inventory.csv');
const jsonPath = path.join(__dirname, 'frontend/public/latest_inventory.json');

if (!fs.existsSync(csvPath)) {
  console.error('❌ 找不到 latest_inventory.csv 檔案！');
  process.exit(1);
}

console.log('⏳ 正在讀取 36 欄位 CSV 並生成 JSON...');
const text = fs.readFileSync(csvPath, 'utf-8');
const lines = text.split(/\r\n|\n/);
if (lines.length < 2) process.exit(1);

const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/\ufeff/g, ''));
const result = [];

const keepFields = [
  "商品ID", "商品名稱", "借/採", "儲位", "儲位庫存數", "庫齡", "區編", "區名", "館編", "館名",
  "長(cm)", "寬(cm)", "高(cm)", "重量(kg)", "(近)月銷量", "(近)月-有揀貨單天數", "(近)90日銷量", 
  "(近)90日-有揀貨單天數", "供應商ID", "供應商名稱", "所屬PM", "總庫存數", "總庫存_迴轉天數", 
  "才數", "材積別", "樓層", "儲位型態", "大區編", "大區名", "儲位才數", "儲位健康度", 
  "材積判斷", "總才數", "人工/自動", "庫齡級距", "重型架判斷"
];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const row = [];
  let insideQuote = false;
  let entry = '';
  for (let char of lines[i]) {
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      row.push(entry.trim().replace(/^"|"$/g, ''));
      entry = '';
    } else {
      entry += char;
    }
  }
  row.push(entry.trim().replace(/^"|"$/g, ''));

  if (row.length >= headers.length) {
    const obj = {};
    headers.forEach((h, idx) => {
      if (keepFields.includes(h)) {
        obj[h] = row[idx] || '';
      }
    });
    result.push(obj);
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(result), 'utf-8');
const stats = fs.statSync(jsonPath);
const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log('🎉 轉檔成功！共 ' + result.length + ' 筆資料，JSON 大小：' + fileSizeInMB + ' MB');
