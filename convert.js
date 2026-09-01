const fs = require('fs');
const path = require('path');
const readline = require('readline');

const csvPath = path.resolve(__dirname, 'latest_inventory.csv');
const jsonPath = path.resolve(__dirname, 'frontend', 'public', 'latest_inventory.json');

// 處理 CSV 欄位解析
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

async function convert() {
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let headers = [];
    const results = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        const parsed = parseCSVLine(line);
        if (headers.length === 0) {
            headers = parsed;
        } else {
            const row = {};
            headers.forEach((header, index) => {
                const val = parsed[index] || '';
                // 排除空值，節省空間
                if (val !== '') {
                    row[header] = val;
                }
            });
            results.push(row);
        }
    }

    // 使用無縮排壓縮格式 (JSON.stringify 移除第三個參數 null, 2)
    fs.writeFileSync(jsonPath, JSON.stringify(results), 'utf8');
    const stats = fs.statSync(jsonPath);
    console.log(`✅ 轉檔成功！檔案大小：${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

convert().catch(err => console.error('❌ 錯誤:', err));