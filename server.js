// C:\my-inventory-server\server.js
// 業務主程式 API 伺服器 (整合 48 欄位 + 完全對齊圖1/2/3 彙總欄位與新算式)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const SERVER_START_TIME = Date.now();

const COLUMN_MAP = {
  '商品ID': 'item_id', '商品名稱': 'item_name', '借/採': 'borrow_proc', '儲位': 'location',
  '儲位庫存數': 'qty', '庫齡': 'age', '區編': 'zone_id', '區名': 'zone_name',
  '館編': 'hall_id', '館名': 'hall_name', '長(cm)': 'length', '寬(cm)': 'width',
  '高(cm)': 'height', '重量(kg)': 'weight', '(近)月銷量': 'monthly_sales', '(近)月-有揀貨單天數': 'pick_days_m',
  '(近)90日銷量': 'sales_90d', '(近)90日-有揀貨單天數': 'pick_days_90d', '供應商ID': 'supplier_id',
  '供應商名稱': 'supplier_name', '所屬PM': 'pm', '總庫存數': 'total_qty', '總庫存_迴轉天數': 'turn_days_total',
  '才數': 'cubic_feet', '材積別': 'vol_type', '儲位編碼-3': 'loc_code_3', '儲位編碼': 'loc_code_full',
  '儲位編碼5': 'loc_code_5', '樓層': 'floor', '樓層區域': 'floor_zone', '儲位型態': 'loc_type',
  '大區編': 'big_zone_id', '大區名': 'big_zone', '三邊長': 'dim_sum', '最長邊': 'max_dim',
  '最短邊': 'min_dim', '儲位才數': 'loc_cubic_feet', '儲位健康度': 'loc_health', '不符合': 'non_compliant',
  '材積判斷': 'vol_check', '總才數': 'total_cubic_feet', '人工/自動': 'auto_type', '儲位層標示': 'shelf_level',
  '庫齡級距': 'age_bracket', '樓層設定': 'floor_config', '重型架判斷': 'heavy_rack_check',
  'ID指定樓層': 'assigned_floor', '備註': 'remark'
};

const db = new sqlite3.Database('inventory_local.sqlite', (err) => {
  if (err) console.error('❌ 資料庫連線失敗:', err.message);
  else console.log('✅ SQLite 資料庫檔案已成功連結！');
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.post('/api/system/update-server-code', (req, res) => {
  const http = require('http');
  const payload = JSON.stringify(req.body);
  const options = {
    hostname: '127.0.0.1', port: 3001, path: '/api/system/update-server-code', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  const proxyReq = http.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => res.status(proxyRes.statusCode).send(body));
  });
  proxyReq.on('error', (err) => res.status(500).json({ success: false, message: '無法連線至 Port 3001: ' + err.message }));
  proxyReq.write(payload);
  proxyReq.end();
});

db.serialize(() => {
  db.all("PRAGMA table_info(inventory)", [], (err, columns) => {
    const hasLocCode3 = columns && columns.some(c => c.name === 'loc_code_3');
    if (!hasLocCode3 && columns && columns.length > 0) {
      console.log('⚠️ 自動升級重建為完整 48 欄位 Schema...');
      db.run(`DROP TABLE IF EXISTS inventory`);
    }
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, item_name TEXT, borrow_proc TEXT, location TEXT, qty REAL, age INTEGER,
        zone_id TEXT, zone_name TEXT, hall_id TEXT, hall_name TEXT, length REAL, width REAL, height REAL, weight REAL,
        monthly_sales REAL, pick_days_m REAL, sales_90d REAL, pick_days_90d REAL, supplier_id TEXT, supplier_name TEXT, pm TEXT,
        total_qty REAL, turn_days_total REAL, cubic_feet REAL, vol_type TEXT, loc_code_3 TEXT, loc_code_full TEXT, loc_code_5 TEXT,
        floor TEXT, floor_zone TEXT, loc_type TEXT, big_zone_id TEXT, big_zone TEXT, dim_sum REAL, max_dim REAL, min_dim REAL,
        loc_cubic_feet REAL, loc_health TEXT, non_compliant TEXT, vol_check TEXT, total_cubic_feet REAL, auto_type TEXT,
        shelf_level TEXT, age_bracket TEXT, floor_config TEXT, heavy_rack_check TEXT, assigned_floor TEXT, remark TEXT
      );
    `);
  });
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, role TEXT, password TEXT, permissions TEXT, last_active INTEGER);`);
  db.run(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, name TEXT, role TEXT, device TEXT, feature TEXT, action TEXT, created_at TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS column_config (key TEXT PRIMARY KEY, config_json TEXT, updated_at TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS locations_master (id INTEGER PRIMARY KEY AUTOINCREMENT, floor TEXT, zone TEXT, loc_type TEXT, cubic_feet REAL, grid_count INTEGER, single_cubic_feet REAL);`);
  db.run(`INSERT OR IGNORE INTO users (username, name, role, password, permissions) VALUES ('admin', '系統管理員', 'sys_admin', 'admin', 'all');`);
  db.run(`INSERT OR IGNORE INTO users (username, name, role, password, permissions) VALUES ('801854', '黃勝鴻', 'sys_admin', '801854', 'all');`);
});

// 精準校正儲位型態
function getAdjustedType(floor, rType, storageCode, locCode5, shelfLevel, heavyRackCheck) {
  floor = String(floor || '').toUpperCase().trim();
  rType = String(rType || '').trim();
  heavyRackCheck = String(heavyRackCheck || '').trim();

  if (heavyRackCheck.includes('重型層架-低') || heavyRackCheck.includes('低') || heavyRackCheck === '重型層架-低') {
    return '重型層架-低';
  }

  let code = String(locCode5 || '').toUpperCase().trim();
  if (!code) code = String(storageCode || '').toUpperCase().trim();

  if (code.includes('-')) {
    const parts = code.split('-');
    code = parts[parts.length - 1];
  }

  const rowTag = code.length >= 3 ? code.substring(0, 3) : '';
  const seatTag = code.length >= 6 ? (parseInt(code.substring(3, 6), 10) || 0) : 0;
  
  let level = String(shelfLevel || '').toUpperCase().trim();
  if (!level && code.length >= 7) {
    level = code.substring(6, 7);
  }

  if (floor.includes('7F') || code.startsWith('M')) {
    if (rowTag >= 'M01' && rowTag <= 'M53' && seatTag <= 56) {
      if (level === 'B' || level === 'C' || !level) return 'AGV層架-紙抽';
    }
  } 

  if (floor.includes('6F') || code.startsWith('L')) {
    if (rowTag >= 'L01' && rowTag <= 'L26' && seatTag <= 60) {
      if (['A', 'B', 'C'].includes(level) || !level) return 'AGV層架-紙抽';
    } else if (rowTag >= 'L27' && rowTag <= 'L30' && seatTag <= 60) {
      if (['A', 'B', 'C', 'D', 'E', 'F'].includes(level) || !level) return 'AGV層架-紙抽';
    }
  }

  if (rowTag >= 'R13' && rowTag <= 'R42') {
    if (level === 'A' || level === 'B' || !level) return 'AGV層架-紙抽';
  } else if ((rowTag === 'R11' || rowTag === 'R12') && seatTag >= 1 && seatTag <= 20) {
    if (level === 'A' || level === 'B' || !level) return 'AGV層架-紙抽';
  }

  return rType;
}

function parseCsvTextToObjects(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const list = [];
  for (let i = 1; i < lines.length; i++) {
    const rowVals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (rowVals.length < headers.length) continue;
    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = rowVals[idx]);
    list.push(rowObj);
  }
  return list;
}

app.get('/api/get-locations-master', (req, res) => {
  const sql = `SELECT COALESCE(floor, '') as 樓層, COALESCE(zone, '') as 區域, COALESCE(loc_type, '') as 儲位類型, COALESCE(cubic_feet, 0) as 才數, COALESCE(grid_count, 0) as 儲格數, COALESCE(single_cubic_feet, 0) as 儲位才數 FROM locations_master ORDER BY id ASC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: '讀取儲位定義失敗: ' + err.message });
    res.json({ success: true, data: rows || [] });
  });
});

app.post(['/api/import-locations-master', '/api/import-locations-master-json'], (req, res) => {
  let chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const rawText = buffer.toString('utf8');
      let items = [];

      if (rawText.includes('name="file"') || rawText.includes('Content-Type:')) {
        const matches = rawText.match(/\r\n\r\n([\s\S]*?)\r\n--/);
        if (matches && matches[1]) items = parseCsvTextToObjects(matches[1].trim());
      } else if (rawText.includes(',') && !rawText.trim().startsWith('{') && !rawText.trim().startsWith('[')) {
        items = parseCsvTextToObjects(rawText.trim());
      } else if (req.body) {
        items = req.body;
        if (items && Array.isArray(items.items)) items = items.items;
        else if (items && Array.isArray(items.data)) items = items.data;
      }

      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: '未接收到有效 CSV 內容或資料為空' });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM locations_master');
        const stmt = db.prepare(`INSERT INTO locations_master (floor, zone, loc_type, cubic_feet, grid_count, single_cubic_feet) VALUES (?, ?, ?, ?, ?, ?)`);

        const parseNum = (val) => val ? (parseFloat(String(val).replace(/,/g, '').trim()) || 0) : 0;
        const parseIntNum = (val) => val ? (parseInt(String(val).replace(/,/g, '').trim(), 10) || 0) : 0;

        for (const r of items) {
          if (!r || typeof r !== 'object') continue;
          const floor = String(r['樓層'] || r.floor || '').trim();
          const zone = String(r['區域'] || r['樓層區域'] || r.zone || '').trim();
          const locType = String(r['儲位類型'] || r['儲位型態'] || r.loc_type || '').trim();
          const cubicFeet = parseNum(r['才數'] || r.cubic_feet);
          const gridCount = parseIntNum(r['儲格數(板、層)'] || r['儲格數'] || r.grid_count);
          const singleCubicFeet = parseNum(r['儲位才數'] || r.single_cubic_feet);

          stmt.run(floor, zone, locType, cubicFeet, gridCount, singleCubicFeet);
        }

        stmt.finalize();
        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, message: '寫入資料庫失敗: ' + err.message });
          res.json({ success: true, count: items.length, message: '儲位結構定義更新成功！' });
        });
      });
    } catch (err) {
      db.run('ROLLBACK');
      res.status(500).json({ success: false, message: '伺服器處理失敗: ' + err.message });
    }
  });
});

// [GET] 📊 儲位才數與格數強效交叉計算 API
app.get(['/api/calc-location-summary', '/api/stats/location-capacity'], (req, res) => {
  const masterSql = `SELECT COALESCE(floor, '') as floor, COALESCE(zone, '') as zone, COALESCE(loc_type, '') as loc_type, COALESCE(cubic_feet, 0) as cubic_feet, COALESCE(grid_count, 0) as grid_count, COALESCE(single_cubic_feet, 0) as single_cubic_feet FROM locations_master`;
  const inventorySql = `SELECT COALESCE(floor, '') as floor, COALESCE(floor_zone, '') as floor_zone, COALESCE(loc_type, '') as loc_type, COALESCE(heavy_rack_check, '') as heavy_rack_check, COALESCE(location, '') as location, COALESCE(loc_code_5, '') as loc_code_5, COALESCE(shelf_level, '') as shelf_level, COALESCE(total_cubic_feet, 0) as total_cubic_feet, COALESCE(cubic_feet, 0) as cubic_feet, COALESCE(qty, 0) as qty FROM inventory`;

  db.all(masterSql, [], (err, masterRows) => {
    db.all(inventorySql, [], (err, invRows) => {
      masterRows = masterRows || [];
      invRows = invRows || [];

      const matrixMap = {};
      const zones = ['A區', 'B區', 'C區', 'D區'];

      let grandPlanVol = 0;

      masterRows.forEach(r => {
        let f = String(r.floor || '').trim();
        let z = String(r.zone || '').trim();
        let t = String(r.loc_type || '').trim();
        if (!f || !t || f === '樓層') return;
        if (!z.endsWith('區')) z = z + '區';

        const k = `${f}_${t}`;
        if (!matrixMap[k]) {
          matrixMap[k] = {
            floor: f, loc_type: t,
            single_cf_map: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            plan_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            used_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            plan_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            used_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 }
          };
        }
        const gCnt = parseInt(r.grid_count || 0, 10);
        const singleCf = parseFloat(r.single_cubic_feet || 0);
        
        let vCnt = parseFloat(r.cubic_feet || 0);
        if (vCnt === 0) vCnt = singleCf * gCnt;

        if (singleCf > 0) matrixMap[k].single_cf_map[z] = singleCf;

        matrixMap[k].plan_grid[z] = (matrixMap[k].plan_grid[z] || 0) + gCnt;
        matrixMap[k].plan_vol[z] = (matrixMap[k].plan_vol[z] || 0) + vCnt;

        grandPlanVol += vCnt;
      });

      const usedStorageCheck = new Set();
      let grandUsedVol = 0;

      invRows.forEach(r => {
        let invFloor = String(r.floor || '').trim();
        let invZone = String(r.floor_zone || '').trim();
        const code = String(r.location || '').toUpperCase().trim();
        const locCode5 = String(r.loc_code_5 || '').toUpperCase().trim();
        const origType = String(r.loc_type || '').trim();
        const heavyCheck = String(r.heavy_rack_check || '').trim();
        const shelfLevel = String(r.shelf_level || '').trim();

        if (!invFloor && code.length >= 2) {
          const matchFloor = code.match(/^([0-9]F[東西南北]?)/i);
          if (matchFloor) invFloor = matchFloor[1].toUpperCase();
          else {
            const matchSimple = code.match(/^([0-9]F)/i);
            if (matchSimple) invFloor = matchSimple[1].toUpperCase();
          }
        }

        if (!invZone.endsWith('區')) invZone = invZone + '區';

        const adjType = getAdjustedType(invFloor, origType, code, locCode5, shelfLevel, heavyCheck);
        const cleanType = (adjType || origType || '').replace(/\s+/g, '');

        const matchKey = Object.keys(matrixMap).find(k => {
          const m = matrixMap[k];
          
          let floorMatch = false;
          if (m.floor === invFloor) floorMatch = true;
          else if (m.floor.length > invFloor.length && m.floor.includes(invFloor)) floorMatch = true;
          else if (invFloor.length > m.floor.length && invFloor.includes(m.floor)) floorMatch = true;

          let typeMatch = (m.loc_type === cleanType) || (m.loc_type.replace(/\s+/g, '') === cleanType);

          return floorMatch && typeMatch;
        });

        if (matchKey) {
          const item = matrixMap[matchKey];
          const zKey = zones.includes(invZone) ? invZone : (item.plan_grid[invZone] !== undefined ? invZone : 'A區');
          
          const curVol = parseFloat(r.total_cubic_feet) > 0 
            ? parseFloat(r.total_cubic_feet) 
            : (parseFloat(r.cubic_feet || 0) * parseFloat(r.qty || 0));

          item.used_vol[zKey] = (item.used_vol[zKey] || 0) + curVol;
          grandUsedVol += curVol;

          if (code && !usedStorageCheck.has(code)) {
            usedStorageCheck.add(code);
            item.used_grid[zKey] = (item.used_grid[zKey] || 0) + 1;
          }
        }
      });

      const gridPivotTable = [];
      const volPivotTable = [];

      const typeSubtotals = {};
      const grandTotalGrid = {
        floor: '', loc_type: '全區總計', is_total: true,
        plan_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
        used_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
        plan_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
        used_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 }
      };

      let grandRemVolReal = 0;

      Object.values(matrixMap).forEach(row => {
        const t = row.loc_type;
        if (!typeSubtotals[t]) {
          typeSubtotals[t] = {
            floor: '', loc_type: t, is_subtotal: true,
            plan_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            used_grid: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            plan_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 },
            used_vol: { 'A區':0, 'B區':0, 'C區':0, 'D區':0 }
          };
        }

        const gridRow = { floor: row.floor, loc_type: row.loc_type };
        const volRow = { floor: row.floor, loc_type: row.loc_type };

        let rowPlanG = 0, rowUsedG = 0, rowRemG = 0;
        let rowPlanV = 0, rowUsedV = 0, rowRemV = 0;

        zones.forEach(z => {
          const pg = row.plan_grid[z] || 0;
          const ug = row.used_grid[z] || 0;
          const rg = Math.max(0, pg - ug);
          const unrateG = pg > 0 ? ((rg / pg) * 100).toFixed(1) + '%' : '';

          gridRow[`plan_${z}`] = pg > 0 ? pg : '';
          gridRow[`used_${z}`] = ug > 0 ? ug : '';
          gridRow[`unrate_${z}`] = unrateG;
          gridRow[`rem_${z}`] = rg > 0 ? rg : '';

          rowPlanG += pg; rowUsedG += ug; rowRemG += rg;

          const pv = row.plan_vol[z] || 0;
          const uv = row.used_vol[z] || 0;
          
          let singleCf = row.single_cf_map[z] || 0;
          if (singleCf === 0 && pg > 0) singleCf = pv / pg;
          
          const rvReal = singleCf > 0 ? (rg * singleCf) : Math.max(0, pv - uv);

          volRow[`plan_${z}`] = pv > 0 ? parseFloat(pv.toFixed(1)) : '';
          volRow[`used_${z}`] = uv > 0 ? parseFloat(uv.toFixed(1)) : '';
          volRow[`rem_${z}`] = rvReal > 0 ? parseFloat(rvReal.toFixed(1)) : '';

          rowPlanV += pv; rowUsedV += uv; rowRemV += rvReal;

          typeSubtotals[t].plan_grid[z] += pg;
          typeSubtotals[t].used_grid[z] += ug;
          typeSubtotals[t].plan_vol[z] += pv;
          typeSubtotals[t].used_vol[z] += uv;

          grandTotalGrid.plan_grid[z] += pg;
          grandTotalGrid.used_grid[z] += ug;

          grandRemVolReal += rvReal;
        });

        const rowUnrateG = rowPlanG > 0 ? (((rowPlanG - rowUsedG) / rowPlanG) * 100).toFixed(1) + '%' : '0.0%';
        gridRow['sum_plan_grid'] = rowPlanG; gridRow['sumPlanGrid'] = rowPlanG;
        gridRow['sum_used_grid'] = rowUsedG; gridRow['sumUsedGrid'] = rowUsedG;
        gridRow['sum_unrate_grid'] = rowUnrateG; gridRow['sumUnrateGrid'] = rowUnrateG;
        gridRow['sum_rem_grid'] = rowRemG; gridRow['sumRemGrid'] = rowRemG;
        gridRow['sum_rem_vol'] = parseFloat(rowRemV.toFixed(1)); gridRow['sumRemVol'] = parseFloat(rowRemV.toFixed(1));

        const rowUnrateV = rowPlanV > 0 ? (rowRemV / rowPlanV) : 0;
        let rowHealthV = '0.0%';
        if (rowPlanV > 0 && (1 - rowUnrateV) > 0) {
          rowHealthV = (((rowUsedV / (1 - rowUnrateV)) / rowPlanV) * 100).toFixed(1) + '%';
        }

        volRow['sum_plan_vol'] = parseFloat(rowPlanV.toFixed(1)); volRow['sumPlanVol'] = parseFloat(rowPlanV.toFixed(1));
        volRow['sum_used_vol'] = parseFloat(rowUsedV.toFixed(1)); volRow['sumUsedVol'] = parseFloat(rowUsedV.toFixed(1));
        volRow['sum_unrate_vol'] = (rowUnrateV * 100).toFixed(1) + '%'; volRow['sumUnrateVol'] = (rowUnrateV * 100).toFixed(1) + '%';
        volRow['sum_rem_vol'] = parseFloat(rowRemV.toFixed(1)); volRow['sumRemVol'] = parseFloat(rowRemV.toFixed(1));
        volRow['sum_health_vol'] = rowHealthV; volRow['sumHealthVol'] = rowHealthV;

        gridPivotTable.push(gridRow);
        volPivotTable.push(volRow);
      });

      // 附加黃色小計列
      Object.values(typeSubtotals).forEach(sub => {
        const subGridRow = { floor: sub.floor, loc_type: sub.loc_type, is_subtotal: true };
        const subVolRow = { floor: sub.floor, loc_type: sub.loc_type, is_subtotal: true };

        let subPG = 0, subUG = 0, subRG = 0;
        let subPV = 0, subUV = 0, subRV = 0;

        zones.forEach(z => {
          const pg = sub.plan_grid[z];
          const ug = sub.used_grid[z];
          const rg = Math.max(0, pg - ug);
          const unrateG = pg > 0 ? ((rg / pg) * 100).toFixed(1) + '%' : '';

          subGridRow[`plan_${z}`] = pg > 0 ? pg : '';
          subGridRow[`used_${z}`] = ug > 0 ? ug : '';
          subGridRow[`unrate_${z}`] = unrateG;
          subGridRow[`rem_${z}`] = rg > 0 ? rg : '';

          subPG += pg; subUG += ug; subRG += rg;

          const pv = sub.plan_vol[z];
          const uv = sub.used_vol[z];
          const rv = Math.max(0, pv - uv);

          subVolRow[`plan_${z}`] = pv > 0 ? parseFloat(pv.toFixed(1)) : '';
          subVolRow[`used_${z}`] = uv > 0 ? parseFloat(uv.toFixed(1)) : '';
          subVolRow[`rem_${z}`] = rv > 0 ? parseFloat(rv.toFixed(1)) : '';

          subPV += pv; subUV += uv; subRV += rv;
        });

        const subUnrateG = subPG > 0 ? (((subPG - subUG) / subPG) * 100).toFixed(1) + '%' : '0.0%';
        subGridRow['sum_plan_grid'] = subPG; subGridRow['sumPlanGrid'] = subPG;
        subGridRow['sum_used_grid'] = subUG; subGridRow['sumUsedGrid'] = subUG;
        subGridRow['sum_unrate_grid'] = subUnrateG; subGridRow['sumUnrateGrid'] = subUnrateG;
        subGridRow['sum_rem_grid'] = subRG; subGridRow['sumRemGrid'] = subRG;
        subGridRow['sum_rem_vol'] = parseFloat(subRV.toFixed(1)); subGridRow['sumRemVol'] = parseFloat(subRV.toFixed(1));

        const subUnrateV = subPV > 0 ? (subRV / subPV) : 0;
        let subHealthV = '0.0%';
        if (subPV > 0 && (1 - subUnrateV) > 0) {
          subHealthV = (((subUV / (1 - subUnrateV)) / subPV) * 100).toFixed(1) + '%';
        }

        subVolRow['sum_plan_vol'] = parseFloat(subPV.toFixed(1)); subVolRow['sumPlanVol'] = parseFloat(subPV.toFixed(1));
        subVolRow['sum_used_vol'] = parseFloat(subUV.toFixed(1)); subVolRow['sumUsedVol'] = parseFloat(subUV.toFixed(1));
        subVolRow['sum_unrate_vol'] = (subUnrateV * 100).toFixed(1) + '%'; subVolRow['sumUnrateVol'] = (subUnrateV * 100).toFixed(1) + '%';
        subVolRow['sum_rem_vol'] = parseFloat(subRV.toFixed(1)); subVolRow['sumRemVol'] = parseFloat(subRV.toFixed(1));
        subVolRow['sum_health_vol'] = subHealthV; subVolRow['sumHealthVol'] = subHealthV;

        gridPivotTable.push(subGridRow);
        volPivotTable.push(subVolRow);
      });

      // 附加綠色總計列
      const totalGridRow = { floor: grandTotalGrid.floor, loc_type: grandTotalGrid.loc_type, is_total: true };
      const totalVolRow = { floor: grandTotalGrid.floor, loc_type: grandTotalGrid.loc_type, is_total: true };

      let sumPlanG = 0, sumUsedG = 0;
      zones.forEach(z => {
        const pg = grandTotalGrid.plan_grid[z];
        const ug = grandTotalGrid.used_grid[z];
        const rg = Math.max(0, pg - ug);
        const unrateG = pg > 0 ? ((rg / pg) * 100).toFixed(1) + '%' : '';

        totalGridRow[`plan_${z}`] = pg > 0 ? pg : '';
        totalGridRow[`used_${z}`] = ug > 0 ? ug : '';
        totalGridRow[`unrate_${z}`] = unrateG;
        totalGridRow[`rem_${z}`] = rg > 0 ? rg : '';

        sumPlanG += pg;
        sumUsedG += ug;
      });

      const totalRemG = Math.max(0, sumPlanG - sumUsedG);
      const totalUnrateG = sumPlanG > 0 ? ((totalRemG / sumPlanG) * 100).toFixed(1) + '%' : '0.0%';

      totalGridRow['sum_plan_grid'] = sumPlanG; totalGridRow['sumPlanGrid'] = sumPlanG;
      totalGridRow['sum_used_grid'] = sumUsedG; totalGridRow['sumUsedGrid'] = sumUsedG;
      totalGridRow['sum_unrate_grid'] = totalUnrateG; totalGridRow['sumUnrateGrid'] = totalUnrateG;
      totalGridRow['sum_rem_grid'] = totalRemG; totalGridRow['sumRemGrid'] = totalRemG;
      totalGridRow['sum_rem_vol'] = parseFloat(grandRemVolReal.toFixed(1)); totalGridRow['sumRemVol'] = parseFloat(grandRemVolReal.toFixed(1));

      const overallUnusedRateVol = grandPlanVol > 0 ? (grandRemVolReal / grandPlanVol) : 0;
      let overallHealthCalc = '0.0%';
      const denominator = 1 - overallUnusedRateVol;

      if (grandPlanVol > 0 && denominator > 0) {
        const adjustedUsedVol = grandUsedVol / denominator;
        overallHealthCalc = ((adjustedUsedVol / grandPlanVol) * 100).toFixed(1) + '%';
      }

      totalVolRow['sum_plan_vol'] = parseFloat(grandPlanVol.toFixed(1)); totalVolRow['sumPlanVol'] = parseFloat(grandPlanVol.toFixed(1));
      totalVolRow['sum_used_vol'] = parseFloat(grandUsedVol.toFixed(1)); totalVolRow['sumUsedVol'] = parseFloat(grandUsedVol.toFixed(1));
      totalVolRow['sum_unrate_vol'] = (overallUnusedRateVol * 100).toFixed(1) + '%'; totalVolRow['sumUnrateVol'] = (overallUnusedRateVol * 100).toFixed(1) + '%';
      totalVolRow['sum_rem_vol'] = parseFloat(grandRemVolReal.toFixed(1)); totalVolRow['sumRemVol'] = parseFloat(grandRemVolReal.toFixed(1));
      totalVolRow['sum_health_vol'] = overallHealthCalc; totalVolRow['sumHealthVol'] = overallHealthCalc;

      volPivotTable.push(totalVolRow);
      gridPivotTable.push(totalGridRow);

      res.json({
        success: true,
        status: 'success',
        summaryStats: {
          total_plan_grid: sumPlanG,
          total_used_grid: sumUsedG,
          total_rem_grid: totalRemG,
          total_plan_vol: parseFloat(grandPlanVol.toFixed(1)),
          total_used_vol: parseFloat(grandUsedVol.toFixed(1)),
          total_rem_vol: parseFloat(grandRemVolReal.toFixed(1)),
          total_health: overallHealthCalc
        },
        grid_summary: gridPivotTable,
        summaryGridData: gridPivotTable,
        vol_summary: volPivotTable,
        summaryVolData: volPivotTable,
        area_grid_table: gridPivotTable,
        area_vol_table: gridPivotTable
      });
    });
  });
});

app.get('/api/get-global-config', (req, res) => {
  const currentUptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  res.json({ success: true, data: { system_name: "庫存儲位管理系統", version: "v2026.09.24-48COL-ALIGNED", server_uptime_seconds: currentUptimeSec } });
});

app.get('/api/categories/large', (req, res) => {
  db.all('SELECT DISTINCT big_zone FROM inventory WHERE big_zone IS NOT NULL AND big_zone != ""', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: (rows || []).map(r => r.big_zone) });
  });
});

app.get('/api/categories/small', (req, res) => {
  const large = req.query.large || '';
  let sql = 'SELECT DISTINCT zone_name FROM inventory WHERE zone_name IS NOT NULL AND zone_name != ""';
  let params = [];
  if (large) { sql += ' AND big_zone = ?'; params.push(large); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: (rows || []).map(r => r.zone_name) });
  });
});

app.post('/api/heartbeat', (req, res) => {
  if (req.body.username) db.run('UPDATE users SET last_active = ? WHERE username = ?', [Math.floor(Date.now() / 1000), req.body.username]);
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  if (req.body.username) db.run('UPDATE users SET last_active = 0 WHERE username = ?', [req.body.username]);
  res.json({ success: true, message: '已成功登出' });
});

app.get('/api/get-users', (req, res) => {
  db.all('SELECT username, name, role, permissions, last_active FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const now = Math.floor(Date.now() / 1000);
    res.json({ success: true, users: (rows || []).map(u => ({ ...u, is_online: !!(u.last_active && (now - u.last_active < 60)) })) });
  });
});

app.post('/api/add-user', (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username) return res.status(400).json({ success: false, message: '帳號名稱不可為空！' });
  const stmt = db.prepare(`INSERT INTO users (username, name, role, password, permissions, last_active) VALUES (?, ?, ?, ?, 'all', ?) ON CONFLICT(username) DO UPDATE SET name = excluded.name, role = excluded.role, password = excluded.password`);
  stmt.run(username, name || username, role || 'user', password || '123456', Math.floor(Date.now() / 1000), (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '新增帳號成功！' });
  });
});

app.post(['/api/update-role', '/api/update-user-role', '/api/update-user'], (req, res) => {
  const { username, target_role, role, target_name, name } = req.body;
  db.run('UPDATE users SET role = COALESCE(?, role), name = COALESCE(?, name) WHERE username = ?', [role || target_role, name || target_name, username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '角色已成功更新！' });
  });
});

app.post(['/api/update-password', '/api/update-user-password'], (req, res) => {
  db.run('UPDATE users SET password = ? WHERE username = ?', [req.body.new_password || req.body.password, req.body.username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '密碼已成功變更！' });
  });
});

app.post(['/api/update-permissions', '/api/update-user-permissions'], (req, res) => {
  const permStr = Array.isArray(req.body.permissions || req.body.selected_modules) ? (req.body.permissions || req.body.selected_modules).join(',') : String(req.body.permissions || req.body.selected_modules || '');
  db.run('UPDATE users SET permissions = ? WHERE username = ?', [permStr, req.body.username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '模組權限已成功更新！' });
  });
});

app.post('/api/delete-user', (req, res) => {
  db.run('DELETE FROM users WHERE username = ?', [req.body.username], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '刪除帳號成功！' });
  });
});

// [GET] 庫存查詢 API
app.get('/api/search', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '500', 10);
  const searchMode = req.query.searchMode || req.query.search_mode || 'normal';
  const batchIds = req.query.batchIds || req.query.batch_ids || '';
  const batchZones = req.query.batchZones || req.query.batch_zones || '';

  const categoryLarge = req.query.categoryLarge || req.query.cbo_big_zone || '';
  const categorySmall = req.query.categorySmall || req.query.cbo_zone || '';
  const keyword = req.query.keyword || req.query.txt_id || req.query.txt_name || req.query.cbo_loc_id || '';
  const ageInput = req.query.txtAge || req.query.txt_age || req.query.age || '';
  const aggregate = req.query.aggregate === 'true';

  const sortByChinese = req.query.cbo_sort || req.query.cboSort || '';
  const sortOrder = (req.query.sort_order || req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const sortColumn = COLUMN_MAP[sortByChinese] || 'id';

  let whereConditions = [];
  let bindings = [];

  if (searchMode === 'batch_id' && batchIds.trim()) {
    const idList = batchIds.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (idList.length > 0) {
      whereConditions.push(`item_id IN (${idList.map(() => '?').join(',')})`);
      bindings.push(...idList);
    }
  } else if (searchMode === 'batch_zone' && (batchZones.trim() || batchIds.trim())) {
    const zoneStr = batchZones.trim() || batchIds.trim();
    const zoneList = zoneStr.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (zoneList.length > 0) {
      const zoneConditions = [
        `big_zone IN (${zoneList.map(() => '?').join(',')})`,
        `zone_name IN (${zoneList.map(() => '?').join(',')})`,
        `zone_id IN (${zoneList.map(() => '?').join(',')})`,
        ...zoneList.map(() => `location LIKE ?`)
      ];
      whereConditions.push(`(${zoneConditions.join(' OR ')})`);
      bindings.push(...zoneList, ...zoneList, ...zoneList);
      zoneList.forEach(z => bindings.push(`${z}%`));
    }
  } else {
    if (categoryLarge) { whereConditions.push("big_zone = ?"); bindings.push(categoryLarge); }
    if (categorySmall) { whereConditions.push("zone_name = ?"); bindings.push(categorySmall); }
    if (keyword) {
      whereConditions.push("(item_id LIKE ? OR item_name LIKE ? OR location LIKE ?)");
      bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (ageInput.trim()) {
      const cleanAge = ageInput.trim().replace(/\s+/g, '');
      if (cleanAge.includes('~') || cleanAge.includes('-')) {
        const parts = cleanAge.split(/[~-]/);
        const minAge = parseInt(parts[0], 10);
        const maxAge = parseInt(parts[1], 10);
        if (!isNaN(minAge) && !isNaN(maxAge)) {
          whereConditions.push("CAST(age AS INTEGER) BETWEEN ? AND ?");
          bindings.push(Math.min(minAge, maxAge), Math.max(minAge, maxAge));
        }
      } else {
        const numAge = parseInt(cleanAge, 10);
        if (!isNaN(numAge)) {
          whereConditions.push("CAST(age AS INTEGER) >= ?");
          bindings.push(numAge);
        }
      }
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const summarySql = `
    SELECT 
      COUNT(DISTINCT item_id) as total_items,
      COUNT(*) as total_rows,
      IFNULL(SUM(qty), 0) as total_pcs,
      IFNULL(SUM(CASE WHEN total_cubic_feet > 0 THEN total_cubic_feet ELSE (cubic_feet * qty) END), 0) as total_ao
    FROM inventory ${whereClause}
  `;

  db.get(summarySql, bindings, (err, summaryRow) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const totalCount = summaryRow ? summaryRow.total_rows : 0;

    let baseQuery = '';
    if (aggregate) {
      baseQuery = `
        SELECT item_id, MAX(item_name) as item_name, MAX(borrow_proc) as borrow_proc, MAX(location) as location,
          MAX(big_zone) as big_zone, MAX(zone_id) as zone_id, MAX(zone_name) as zone_name, MAX(hall_id) as hall_id,
          MAX(hall_name) as hall_name, MAX(floor) as floor, MAX(auto_type) as auto_type, MAX(vol_type) as vol_type,
          MAX(cubic_feet) as cubic_feet, MAX(length) as length, MAX(width) as width, MAX(height) as height,
          MAX(weight) as weight, MAX(monthly_sales) as monthly_sales, MAX(pick_days_m) as pick_days_m,
          MAX(sales_90d) as sales_90d, MAX(pick_days_90d) as pick_days_90d, MAX(supplier_id) as supplier_id,
          MAX(supplier_name) as supplier_name, MAX(pm) as pm, MAX(total_qty) as total_qty, MAX(turn_days_total) as turn_days_total,
          MAX(loc_code_3) as loc_code_3, MAX(loc_code_full) as loc_code_full, MAX(loc_code_5) as loc_code_5,
          MAX(floor_zone) as floor_zone, MAX(loc_type) as loc_type, MAX(big_zone_id) as big_zone_id,
          MAX(dim_sum) as dim_sum, MAX(max_dim) as max_dim, MAX(min_dim) as min_dim, MAX(loc_cubic_feet) as loc_cubic_feet,
          MAX(loc_health) as loc_health, MAX(non_compliant) as non_compliant, MAX(vol_check) as vol_check,
          MAX(total_cubic_feet) as total_cubic_feet, MAX(shelf_level) as shelf_level, MAX(age_bracket) as age_bracket,
          MAX(floor_config) as floor_config, MAX(heavy_rack_check) as heavy_rack_check, MAX(assigned_floor) as assigned_floor,
          MAX(remark) as remark, age, SUM(qty) as qty
        FROM inventory ${whereClause}
        GROUP BY item_id, age
        ORDER BY ${sortColumn} ${sortOrder}
      `;
    } else {
      baseQuery = `SELECT * FROM inventory ${whereClause} ORDER BY ${sortColumn} ${sortOrder}`;
    }

    db.all(`${baseQuery} LIMIT ? OFFSET ?`, [...bindings, pageSize, offset], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      const formattedRows = rows.map(row => {
        const getVal = (field) => (row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== '') ? row[field] : '-';
        return {
          ...row,
          '商品ID': getVal('item_id'), '商品名稱': getVal('item_name'), '借/採': getVal('borrow_proc'),
          '儲位': getVal('location'), '儲位庫存數': getVal('qty'), '庫齡': getVal('age'),
          '區編': getVal('zone_id'), '區名': getVal('zone_name'), '館編': getVal('hall_id'),
          '館名': getVal('hall_name'), '長(cm)': getVal('length'), '寬(cm)': getVal('width'),
          '高(cm)': getVal('height'), '重量(kg)': getVal('weight'), '(近)月銷量': getVal('monthly_sales'),
          '(近)月-有揀貨單天數': getVal('pick_days_m'), '(近)90日銷量': getVal('sales_90d'),
          '(近)90日-有揀貨單天數': getVal('pick_days_90d'), '供應商ID': getVal('supplier_id'),
          '供應商名稱': getVal('supplier_name'), '所屬PM': getVal('pm'), '總庫存數': getVal('total_qty'),
          '總庫存_迴轉天數': getVal('turn_days_total'), '才數': getVal('cubic_feet'), '材積別': getVal('vol_type'),
          '儲位編碼-3': getVal('loc_code_3'), '儲位編碼': getVal('loc_code_full'), '儲位編碼5': getVal('loc_code_5'),
          '樓層': getVal('floor'), '樓層區域': getVal('floor_zone'), '儲位型態': getVal('loc_type'),
          '大區編': getVal('big_zone_id'), '大區名': getVal('big_zone'), '三邊長': getVal('dim_sum'),
          '最長邊': getVal('max_dim'), '最短邊': getVal('min_dim'), '儲位才數': getVal('loc_cubic_feet'),
          '儲位健康度': getVal('loc_health'), '不符合': getVal('non_compliant'), '材積判斷': getVal('vol_check'),
          '總才數': getVal('total_cubic_feet'), '人工/自動': getVal('auto_type'), '儲位層標示': getVal('shelf_level'),
          '庫齡級距': getVal('age_bracket'), '樓層設定': getVal('floor_config'), '重型架判斷': getVal('heavy_rack_check'),
          'ID指定樓層': getVal('assigned_floor'), '備註': getVal('remark')
        };
      });

      res.json({
        success: true, total: totalCount,
        summary: { total_items: summaryRow ? summaryRow.total_items : 0, total_rows: totalCount, total_pcs: summaryRow ? Math.round(summaryRow.total_pcs) : 0, total_ao: summaryRow ? parseFloat(summaryRow.total_ao.toFixed(2)) : 0 },
        data: formattedRows
      });
    });
  });
});

app.post('/api/save-column-config', (req, res) => {
  const stmt = db.prepare(`INSERT INTO column_config (key, config_json, updated_at) VALUES (?, ?, DATETIME('now')) ON CONFLICT(key) DO UPDATE SET config_json = excluded.config_json, updated_at = DATETIME('now')`);
  stmt.run(req.body.key || 'global_default', JSON.stringify(req.body.config || {}), (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: '欄位設定儲存成功' });
  });
});

app.get('/api/get-column-config', (req, res) => {
  db.get('SELECT config_json FROM column_config WHERE key = ?', [req.query.key || 'global_default'], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: row ? JSON.parse(row.config_json) : null });
  });
});

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: '請輸入帳號' });
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    let realName = row ? row.name : (username === 'admin' ? '系統管理員' : username);
    const userRole = row ? (row.role || 'user') : (username === 'admin' ? 'sys_admin' : 'user');
    const userPayload = { username, name: realName, role: userRole, permissions: row ? (row.permissions || 'all') : 'all', token: 'fake-jwt-token' };
    db.run('UPDATE users SET last_active = ? WHERE username = ?', [Math.floor(Date.now() / 1000), username]);
    res.json({ success: true, status: 'success', username, name: realName, role: userRole, permissions: userPayload.permissions, user: userPayload, data: userPayload, token: userPayload.token });
  });
});

app.post('/api/record-log', (req, res) => {
  db.run(`INSERT INTO system_logs (username, name, role, device, feature, action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.body.username || 'admin', req.body.name || '系統管理員', req.body.role || 'sys_admin', req.body.device || 'Desktop', req.body.feature, req.body.action, new Date().toISOString()],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    });
});

app.get('/api/get-logs', (req, res) => {
  db.all('SELECT * FROM system_logs ORDER BY id DESC LIMIT 200', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, logs: rows });
  });
});

app.post('/api/upload', (req, res) => {
  try {
    const { items, isFirstChunk } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: '上傳資料格式無效' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      if (isFirstChunk) db.run('DELETE FROM inventory');

      const stmt = db.prepare(`
        INSERT INTO inventory (
          item_id, item_name, borrow_proc, location, qty, age,
          zone_id, zone_name, hall_id, hall_name, length, width, height, weight,
          monthly_sales, pick_days_m, sales_90d, pick_days_90d, supplier_id, supplier_name, pm,
          total_qty, turn_days_total, cubic_feet, vol_type, loc_code_3, loc_code_full, loc_code_5,
          floor, floor_zone, loc_type, big_zone_id, big_zone, dim_sum, max_dim, min_dim,
          loc_cubic_feet, loc_health, non_compliant, vol_check, total_cubic_feet, auto_type,
          shelf_level, age_bracket, floor_config, heavy_rack_check, assigned_floor, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const getField = (...keys) => {
          if (!item || typeof item !== 'object') return '';
          for (const k of keys) {
            if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') return String(item[k]).trim();
          }
          return '';
        };
        const getNum = (...keys) => {
          const val = getField(...keys);
          return val ? (parseFloat(String(val).replace(/,/g, '')) || 0) : 0;
        };

        stmt.run(
          getField('item_id', '商品ID'), getField('item_name', '商品名稱'), getField('borrow_proc', '借/採'), getField('location', '儲位'), getNum('qty', '儲位庫存數'), parseInt(getField('age', '庫齡') || 0, 10),
          getField('zone_id', '區編'), getField('zone_name', '區名'), getField('hall_id', '館編'), getField('hall_name', '館名'), getNum('length', '長(cm)'), getNum('width', '寬(cm)'),
          getNum('height', '高(cm)'), getNum('weight', '重量(kg)'), getNum('monthly_sales', '(近)月銷量'), getNum('pick_days_m', '(近)月-有揀貨單天數'), getNum('sales_90d', '(近)90日銷量'), getNum('pick_days_90d', '(近)90日-有揀貨單天數'),
          getField('supplier_id', '供應商ID'), getField('supplier_name', '供應商名稱'), getField('pm', '所屬PM'), getNum('total_qty', '總庫存數'), getNum('turn_days_total', '總庫存_迴轉天數'), getNum('cubic_feet', '才數'),
          getField('vol_type', '材積別'), getField('loc_code_3', '儲位編碼-3'), getField('loc_code_full', '儲位編碼'), getField('loc_code_5', '儲位編碼5'), getField('floor', '樓層'), getField('floor_zone', '樓層區域'),
          getField('loc_type', '儲位型態'), getField('big_zone_id', '大區編'), getField('big_zone', '大區名'), getNum('dim_sum', '三邊長'), getNum('max_dim', '最長邊'), getNum('min_dim', '最短邊'),
          getNum('loc_cubic_feet', '儲位才數'), getField('loc_health', '儲位健康度'), getField('non_compliant', '不符合'), getField('vol_check', '材積判斷'), getNum('total_cubic_feet', '總才數'), getField('auto_type', '人工/自動'),
          getField('shelf_level', '儲位層標示'), getField('age_bracket', '庫齡級距'), getField('floor_config', '樓層設定'), getField('heavy_rack_check', '重型架判斷'), getField('assigned_floor', 'ID指定樓層'), getField('remark', '備註')
        );
      }
      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, count: items.length, message: '48 欄位極速寫入成功！' });
      });
    });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 業務 API 伺服器已成功啟動！(Port: ${PORT})`);
});