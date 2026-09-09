const fs = require('fs');
const axios = require('axios');

// 讀取筆電本機的 CSV 或 JSON
const csvData = fs.readFileSync('./latest_inventory.csv', 'utf8');
const lines = csvData.split('\n');
const headers = lines[0].split(',');

const items = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const values = lines[i].split(',');
  items.push({
    item_id: values[0]?.trim(),
    item_name: values[1]?.trim(),
    qty: parseFloat(values[2]) || 0,
    location: values[3]?.trim()
  });
}

console.log(`🚀 正在將 ${items.length} 筆資料傳送至桌機...`);

axios.post('https://vincent-laugh-pan-orange.trycloudflare.com/api/upload', { items })
  .then(res => console.log('🎉 桌機回應:', res.data))
  .catch(err => console.error('❌ 上傳失敗:', err.message));