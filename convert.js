const fs = require('fs');
const path = require('path');
const readline = require('readline');

const csvPath = path.resolve(__dirname, 'latest_inventory.csv');
const sqlPath = path.resolve(__dirname, 'seed.sql');

function parseCSVLine(line) {
  const result = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      let field = line.substring(start, i).trim();
      if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
      }
      result.push(field);
      start = i + 1;
    }
  }
  let lastField = line.substring(start).trim();
  if (lastField.startsWith('"') && lastField.endsWith('"')) {
    lastField = lastField.slice(1, -1).replace(/""/g, '"');
  }
  result.push(lastField);
  return result;
}

function escapeSql(str) {
  return String(str || '').replace(/'/g, "''").trim();
}

function parseNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

async function convert() {
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 找不到檔案：${csvPath}`);
    return;
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const writeStream = fs.createWriteStream(sqlPath, { encoding: 'utf8' });

  // 建立資料表
  writeStream.write(`DROP TABLE IF EXISTS inventory;\n`);
  writeStream.write(`CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    item_name TEXT,
    big_zone TEXT,
    zone_name TEXT,
    location TEXT,
    qty REAL,
    age REAL,
    length REAL,
    width REAL,
    height REAL,
    weight REAL,
    monthly_sales REAL,
    cubic_feet REAL,
    vol_type TEXT,
    floor TEXT,
    ap_type TEXT
  );\n`);

  let headers = [];
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = parseCSVLine(line);

    if (headers.length === 0) {
      headers = parsed;
    } else {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = parsed[index] || '';
      });

      const itemId = escapeSql(row['商品ID'] || row['商品代碼']);
      const itemName = escapeSql(row['商品名稱']);
      const bigZone = escapeSql(row['大區名'] || row['大區編'] || row['大區'] || row['館名']);
      const zoneName = escapeSql(row['區名'] || row['區編'] || row['區']);
      const loc = escapeSql(row['儲位']);
      const qty = parseNum(row['儲位庫存數'] || row['總庫存數']);
      const age = parseNum(row['庫齡']);
      const length = parseNum(row['長(cm)']);
      const width = parseNum(row['寬(cm)']);
      const height = parseNum(row['高(cm)']);
      const weight = parseNum(row['重量(kg)']);
      const mSales = parseNum(row['(近)月銷量']);
      const cubic = parseNum(row['才數'] || row['儲位才數'] || row['總才數']);
      const volType = escapeSql(row['材積別']);
      const floor = escapeSql(row['樓層']);
      const apType = escapeSql(row['人工/自動'] || row['儲位型態']);

      const sql = `INSERT INTO inventory (item_id, item_name, big_zone, zone_name, location, qty, age, length, width, height, weight, monthly_sales, cubic_feet, vol_type, floor, ap_type) VALUES ('${itemId}', '${itemName}', '${bigZone}', '${zoneName}', '${loc}', ${qty}, ${age}, ${length}, ${width}, ${height}, ${weight}, ${mSales}, ${cubic}, '${volType}', '${floor}', '${apType}');\n`;
      
      writeStream.write(sql);
      count++;
    }
  }

  writeStream.end();

  writeStream.on('finish', () => {
    console.log(`✅ 重新產生成功！共處理 ${count.toLocaleString()} 筆資料（已移除 TRANSACTION 指令）。`);
  });
}

convert().catch(err => console.error('❌ 錯誤:', err));