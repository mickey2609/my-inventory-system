// routes/storageAccuracy.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const DEFAULT_ZONE_ZONES = [
    { zone_name: '80D-B區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'A01', x_end: 'A06', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80D-B區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'A06', x_end: 'A08', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'A01', x_end: 'A06', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'A07', x_end: 'A08', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80C2A', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'A', x_start: 'C2A', x_end: 'C2A', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80C2B', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'C2B', x_end: 'C2B', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80C2C', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'C2C', x_end: 'C2C', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'E05', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'E05', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'E01', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'E01', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '中型層架(格)', wh: '80', area: 'B', x_start: 'H01', x_end: 'H17', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '小藍格', wh: '80', area: 'B', x_start: 'H18', x_end: 'H18', y_start: '001', y_end: '028', layer_start: 'A', layer_end: 'G' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'K01', x_end: 'K05', y_start: '061', y_end: '092', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'B', x_start: 'L61', x_end: 'L84', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'K01', x_end: 'K05', y_start: '027', y_end: '058', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'C', x_start: 'L31', x_end: 'L60', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L01', x_end: 'L26', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L27', x_end: 'L30', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'G' },
    { zone_name: '80M01-53(第一段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '001', y_end: '052', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80M01-53(第二段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M03', x_end: 'M53', y_start: '056', y_end: '067', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80M01-53(第三段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '068', y_end: '079', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80M01-53(第四段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M43', x_end: 'M53', y_start: '080', y_end: '094', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80O(貴重區)', floor: '7F', storage_type: '鐵櫃', wh: '80', area: 'A', x_start: 'O01', x_end: 'O01', y_start: '001', y_end: '027', layer_start: 'A', layer_end: 'L' },
    { zone_name: '80N55-69(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'A', x_start: 'N55', x_end: 'N69', y_start: '052', y_end: '075', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80N35-53(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'N35', x_end: 'N53', y_start: '027', y_end: '075', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80N015-33(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'N15', x_end: 'N33', y_start: '001', y_end: '075', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80N34', floor: '7F', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'N34', x_end: 'N34', y_start: '001', y_end: '044', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80S01-05(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'S01', x_end: 'S05', y_start: '001', y_end: '049', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80N01-14(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'N01', x_end: 'N14', y_start: '001', y_end: '068', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80R-A區', floor: '8F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'R11', x_end: 'R42', y_start: '001', y_end: '056', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80R、Q-B區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'R01', x_end: 'R05', y_start: '063', y_end: '098', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80R、Q-C區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'R01', x_end: 'R05', y_start: '027', y_end: '062', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80R、Q-D區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'R01', x_end: 'R05', y_start: '001', y_end: '026', layer_start: 'A', layer_end: 'C' }
  ];

  const DEFAULT_MODE_SETTINGS = {
    mode: 'CAT_TRADE', // 'CAT_TRADE' (大區+借採) | 'SALES_TRADE' (月銷+借採) | 'CAT_SALES_TRADE' (大區+月銷+借採)
    tierA_min: 50,     // A級爆品 >= 50
    tierB_min: 10,     // B級常銷 10 ~ 49
    tierC_min: 1       // C級慢銷 1 ~ 9；0 為 D級滯銷
  };

  function expandXRange(xStart, xEnd) {
    const s = String(xStart || '').trim().toUpperCase();
    const e = String(xEnd || '').trim().toUpperCase();
    if (!s || !e || s === e) return [s];
    const ms = s.match(/^([A-Z]+)(\d+)$/);
    const me = e.match(/^([A-Z]+)(\d+)$/);
    if (ms && me && ms[1] === me[1]) {
      const prefix = ms[1];
      const padLen = ms[2].length;
      const n1 = parseInt(ms[2], 10);
      const n2 = parseInt(me[2], 10);
      const step = n1 <= n2 ? 1 : -1;
      const list = [];
      for (let n = n1; step > 0 ? n <= n2 : n >= n2; n += step) {
        list.push(`${prefix}${String(n).padStart(padLen, '0')}`);
        if (list.length > 200) break;
      }
      return list;
    }
    return [s, e];
  }

  function ensureTables(callback) {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS storage_placement_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          zone_name TEXT NOT NULL,
          floor TEXT NOT NULL,
          storage_type TEXT DEFAULT '',
          area TEXT DEFAULT '',
          x_start TEXT NOT NULL,
          x_end TEXT NOT NULL,
          y_start TEXT DEFAULT '001',
          y_end TEXT DEFAULT '999',
          layer_start TEXT DEFAULT 'A',
          layer_end TEXT DEFAULT 'Z',
          allowed_trade TEXT DEFAULT 'ALL',
          allowed_categories TEXT DEFAULT '[]',
          allowed_volumes TEXT DEFAULT '[]',
          allowed_sales_tiers TEXT DEFAULT '[]',
          enabled INTEGER DEFAULT 1,
          remark TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        )
      `);

      db.run(`ALTER TABLE storage_placement_rules ADD COLUMN allowed_sales_tiers TEXT DEFAULT '[]'`, () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS storage_audit_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          sku_id TEXT NOT NULL,
          sku_name TEXT NOT NULL,
          trade_type TEXT DEFAULT '',
          bin_code TEXT NOT NULL,
          qty INTEGER DEFAULT 0,
          floor TEXT DEFAULT '',
          area TEXT DEFAULT '',
          storage_type TEXT DEFAULT '',
          cat_code TEXT DEFAULT '',
          cat_name TEXT DEFAULT '',
          volume_type TEXT DEFAULT '',
          monthly_sales REAL DEFAULT 0,
          pick_days_m REAL DEFAULT 0,
          note TEXT DEFAULT ''
        )
      `);

      db.run(`ALTER TABLE storage_audit_records ADD COLUMN monthly_sales REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN pick_days_m REAL DEFAULT 0`, () => {});

      db.run(`CREATE TABLE IF NOT EXISTS system_config (config_key TEXT PRIMARY KEY, config_value TEXT)`);

      db.get(`SELECT COUNT(*) as cnt FROM storage_placement_rules`, [], (err, row) => {
        if (!err && row && row.cnt === 0) {
          const stmt = db.prepare(`
            INSERT INTO storage_placement_rules
            (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, enabled, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALL', '[]', '[]', '[]', 1, ?)
          `);
          DEFAULT_ZONE_ZONES.forEach((z, idx) => {
            stmt.run(z.zone_name, z.floor, z.storage_type, z.area, z.x_start, z.x_end, z.y_start, z.y_end, z.layer_start, z.layer_end, idx * 100);
          });
          stmt.finalize(() => {
            if (typeof callback === 'function') callback();
          });
        } else {
          if (typeof callback === 'function') callback();
        }
      });
    });
  }

  ensureTables();

  function getModeSettings(cb) {
    db.get(`SELECT config_value FROM system_config WHERE config_key = 'storage_accuracy_mode_settings'`, [], (err, row) => {
      if (row && row.config_value) {
        try {
          return cb({ ...DEFAULT_MODE_SETTINGS, ...JSON.parse(row.config_value) });
        } catch (e) {}
      }
      cb({ ...DEFAULT_MODE_SETTINGS });
    });
  }

  function classifySalesTier(monthlySales, settings) {
    const s = Number(monthlySales || 0);
    if (s >= Number(settings.tierA_min || 50)) return 'A';
    if (s >= Number(settings.tierB_min || 10)) return 'B';
    if (s >= Number(settings.tierC_min || 1)) return 'C';
    return 'D';
  }

  function formatTierLabel(tier) {
    const map = {
      A: 'A級爆品',
      B: 'B級常銷',
      C: 'C級慢銷',
      D: 'D級滯銷'
    };
    return map[tier] || tier;
  }

  function parseBinCode(binCode) {
    const clean = String(binCode || '').trim().toUpperCase();
    const m = clean.match(/^80([A-Z0-9]{3})(\d{3})([A-Z])$/);
    if (m) return { x: m[1], y: parseInt(m[2], 10), layer: m[3] };
    const m2 = clean.match(/^80([A-Z0-9]{3})(\d{3})/);
    if (m2) return { x: m2[1], y: parseInt(m2[2], 10), layer: 'A' };
    return null;
  }

  function compareX(val, start, end) {
    if (!val || !start || !end) return false;
    if (start === end) return val === start;
    const mVal = val.match(/^([A-Z]+)(\d+)$/);
    const mStart = start.match(/^([A-Z]+)(\d+)$/);
    const mEnd = end.match(/^([A-Z]+)(\d+)$/);
    if (mVal && mStart && mEnd) {
      if (mVal[1] !== mStart[1] && mVal[1] !== mEnd[1]) return val >= start && val <= end;
      const nVal = parseInt(mVal[2], 10);
      const nStart = parseInt(mStart[2], 10);
      const nEnd = parseInt(mEnd[2], 10);
      return mVal[1] === mStart[1] && nVal >= nStart && nVal <= nEnd;
    }
    return val >= start && val <= end;
  }

  function matchRuleForRecord(rec, sortedRules) {
    const parsed = parseBinCode(rec.bin_code);
    for (let i = 0; i < sortedRules.length; i++) {
      const r = sortedRules[i];
      if (r.floor && rec.floor) {
        if (r.floor !== rec.floor && !(r.floor === '2F' && rec.floor.startsWith('2F'))) continue;
      }
      if (parsed) {
        if (!compareX(parsed.x, r.x_start, r.x_end)) continue;
        const yStart = parseInt(r.y_start || '0', 10);
        const yEnd = parseInt(r.y_end || '999', 10);
        if (parsed.y < yStart || parsed.y > yEnd) continue;
        if (r.layer_start && r.layer_end) {
          if (parsed.layer < r.layer_start || parsed.layer > r.layer_end) continue;
        }
        return r;
      } else if (r.area && rec.area === r.area && r.floor === rec.floor) {
        return r;
      }
    }
    return null;
  }

  // 取得整合後的 80 庫紀錄（若 storage_audit_records 為空或缺少月銷量，自動從主庫 inventory 補齊）
  function loadAuditRecordsWithSales(cb) {
    db.all(`SELECT * FROM storage_audit_records`, [], (dErr, records) => {
      if (dErr) return cb(dErr, []);
      db.all(`SELECT item_id, location, monthly_sales, pick_days_m, borrow_proc, qty, floor, floor_zone, loc_type, big_zone_id, big_zone, vol_check, remark, item_name FROM inventory`, [], (iErr, invRows) => {
        const invByBinSku = new Map();
        const invSalesBySku = new Map();

        (invRows || []).forEach(iv => {
          const sku = String(iv.item_id || '').trim();
          const bin = String(iv.location || '').trim().toUpperCase();
          const ms = Number(iv.monthly_sales || 0);
          const pd = Number(iv.pick_days_m || 0);
          if (sku && bin) invByBinSku.set(`${sku}|${bin}`, iv);
          if (sku && (!invSalesBySku.has(sku) || ms > invSalesBySku.get(sku).ms)) {
            invSalesBySku.set(sku, { ms, pd });
          }
        });

        if ((!records || records.length === 0) && invRows && invRows.length > 0) {
          const mapped = invRows
            .filter(iv => iv.item_id && iv.location)
            .map((iv, idx) => ({
              id: idx + 1,
              batch_id: 'main_inventory',
              sku_id: iv.item_id || '',
              sku_name: iv.item_name || '',
              trade_type: iv.borrow_proc || '',
              bin_code: iv.location || '',
              qty: Number(iv.qty || 0),
              floor: iv.floor || '',
              area: iv.floor_zone || '',
              storage_type: iv.loc_type || '',
              cat_code: iv.big_zone_id || '',
              cat_name: iv.big_zone || '',
              volume_type: iv.vol_check || '',
              monthly_sales: Number(iv.monthly_sales || 0),
              pick_days_m: Number(iv.pick_days_m || 0),
              note: iv.remark || ''
            }));
          return cb(null, mapped);
        }

        const enriched = (records || []).map(rec => {
          let ms = Number(rec.monthly_sales || 0);
          let pd = Number(rec.pick_days_m || 0);
          if (ms === 0 && pd === 0) {
            const exact = invByBinSku.get(`${rec.sku_id}|${String(rec.bin_code || '').toUpperCase()}`);
            if (exact) {
              ms = Number(exact.monthly_sales || 0);
              pd = Number(exact.pick_days_m || 0);
            } else if (invSalesBySku.has(rec.sku_id)) {
              const fallback = invSalesBySku.get(rec.sku_id);
              ms = fallback.ms;
              pd = fallback.pd;
            }
          }
          return { ...rec, monthly_sales: ms, pick_days_m: pd };
        });

        cb(null, enriched);
      });
    });
  }

  // 0. 讀取 / 儲存擺放模式與月銷量級距門檻
  router.get('/mode-settings', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        res.json({ success: true, settings });
      });
    });
  });

  router.post('/mode-settings/save', (req, res) => {
    const incoming = req.body.settings || {};
    const clean = {
      mode: ['CAT_TRADE', 'SALES_TRADE', 'CAT_SALES_TRADE'].includes(incoming.mode) ? incoming.mode : 'CAT_TRADE',
      tierA_min: Math.max(1, Number(incoming.tierA_min || 50)),
      tierB_min: Math.max(1, Number(incoming.tierB_min || 10)),
      tierC_min: Math.max(1, Number(incoming.tierC_min || 1))
    };
    db.run(
      `INSERT INTO system_config (config_key, config_value) VALUES ('storage_accuracy_mode_settings', ?)
       ON CONFLICT(config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
      [JSON.stringify(clean)],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, settings: clean, message: '🎉 擺放模式與月銷量級距設定已儲存！' });
      }
    );
  });

  // 1. 取得所有儲位擺放規則
  router.get('/rules', (req, res) => {
    ensureTables(() => {
      db.all(`SELECT * FROM storage_placement_rules ORDER BY floor ASC, x_start ASC, y_start ASC, id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const rules = (rows || []).map(r => {
          let cats = [], vols = [], tiers = [];
          try { cats = JSON.parse(r.allowed_categories || '[]'); } catch (e) {}
          try { vols = JSON.parse(r.allowed_volumes || '[]'); } catch (e) {}
          try { tiers = JSON.parse(r.allowed_sales_tiers || '[]'); } catch (e) {}
          return {
            ...r,
            allowed_categories: cats,
            allowed_volumes: vols,
            allowed_sales_tiers: tiers,
            enabled: r.enabled === 1
          };
        });
        res.json({ success: true, rules });
      });
    });
  });

  // 2. 儲存 / 更新單條規則
  router.post('/rules/save', (req, res) => {
    const rule = req.body.rule;
    if (!rule || !rule.zone_name || !rule.floor || !rule.x_start) {
      return res.status(400).json({ success: false, message: '請填寫區域名稱、樓層與 X 軸排號' });
    }
    const xStart = String(rule.x_start).trim().toUpperCase();
    const xEnd = String(rule.x_end || rule.x_start).trim().toUpperCase();
    const catsJson = JSON.stringify(rule.allowed_categories || []);
    const volsJson = JSON.stringify(rule.allowed_volumes || []);
    const tiersJson = JSON.stringify(rule.allowed_sales_tiers || []);
    const enabledInt = rule.enabled !== false ? 1 : 0;

    if (rule.id) {
      db.run(`
        UPDATE storage_placement_rules SET
          zone_name = ?, floor = ?, storage_type = ?, area = ?,
          x_start = ?, x_end = ?, y_start = ?, y_end = ?,
          layer_start = ?, layer_end = ?,
          allowed_trade = ?, allowed_categories = ?, allowed_volumes = ?, allowed_sales_tiers = ?,
          enabled = ?, remark = ?
        WHERE id = ?
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson, tiersJson,
        enabledInt, rule.remark || '', rule.id
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    } else {
      db.run(`
        INSERT INTO storage_placement_rules
        (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, enabled, remark, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson, tiersJson,
        enabledInt, rule.remark || ''
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    }
  });

  // 3. 把「區間規則」展開成單條 X 軸
  router.post('/rules/expand', (req, res) => {
    const { ruleId } = req.body;
    const query = ruleId
      ? `SELECT * FROM storage_placement_rules WHERE id = ?`
      : `SELECT * FROM storage_placement_rules WHERE x_start != x_end`;
    const params = ruleId ? [ruleId] : [];

    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!rows || rows.length === 0) {
        return res.json({ success: true, expandedCount: 0, message: '目前沒有需要展開的區間規則' });
      }

      let expandedCount = 0;
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        rows.forEach(r => {
          const xList = expandXRange(r.x_start, r.x_end);
          if (xList.length <= 1) return;

          db.run(`DELETE FROM storage_placement_rules WHERE id = ?`, [r.id]);
          xList.forEach((xCode, idx) => {
            db.run(`
              INSERT INTO storage_placement_rules
              (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, enabled, remark, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              `${r.zone_name}-${xCode}`, r.floor, r.storage_type, r.area,
              xCode, xCode, r.y_start, r.y_end, r.layer_start, r.layer_end,
              r.allowed_trade, r.allowed_categories, r.allowed_volumes, r.allowed_sales_tiers || '[]', r.enabled, r.remark,
              (r.sort_order || 0) + idx
            ]);
            expandedCount++;
          });
        });
        db.run('COMMIT', (cErr) => {
          if (cErr) return res.status(500).json({ success: false, message: cErr.message });
          res.json({ success: true, expandedCount, message: `🎉 已成功展開為 ${expandedCount} 條獨立 X 軸排號規則！` });
        });
      });
    });
  });

  // 4. 刪除單條規則
  router.post('/rules/delete', (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM storage_placement_rules WHERE id = ?`, [id], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true });
    });
  });

  // 5. 接收前端分批上傳的 80 庫 CSV 明細快照
  router.post('/audit/upload-chunk', (req, res) => {
    const { batchId, isFirstChunk, rows } = req.body;
    if (!batchId || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: '無效的上傳批次資料' });
    }

    ensureTables(() => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        if (isFirstChunk) {
          db.run(`DELETE FROM storage_audit_records`);
        }
        const stmt = db.prepare(`
          INSERT INTO storage_audit_records
          (batch_id, sku_id, sku_name, trade_type, bin_code, qty, floor, area, storage_type, cat_code, cat_name, volume_type, monthly_sales, pick_days_m, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        rows.forEach(r => {
          stmt.run(
            batchId,
            r.sku_id || '',
            r.sku_name || '',
            r.trade_type || '',
            r.bin_code || '',
            Number(r.qty || 0),
            r.floor || '',
            r.area || '',
            r.storage_type || '',
            r.cat_code || '',
            r.cat_name || '',
            r.volume_type || '',
            Number(r.monthly_sales || 0),
            Number(r.pick_days_m || 0),
            r.note || ''
          );
        });
        stmt.finalize(() => {
          db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, inserted: rows.length });
          });
        });
      });
    });
  });

  // 6. 依據目前「擺放模式」與規則，計算準確率、異常清單與各維度報表
  router.get('/audit/report', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        const activeMode = req.query.mode || settings.mode || 'CAT_TRADE';
        const checkCat = activeMode === 'CAT_TRADE' || activeMode === 'CAT_SALES_TRADE';
        const checkSales = activeMode === 'SALES_TRADE' || activeMode === 'CAT_SALES_TRADE';

        db.all(`SELECT * FROM storage_placement_rules WHERE enabled = 1`, [], (rErr, ruleRows) => {
          if (rErr) return res.status(500).json({ success: false, message: rErr.message });

          const rules = (ruleRows || []).map(r => {
            let cats = [], vols = [], tiers = [];
            try { cats = JSON.parse(r.allowed_categories || '[]'); } catch (e) {}
            try { vols = JSON.parse(r.allowed_volumes || '[]'); } catch (e) {}
            try { tiers = JSON.parse(r.allowed_sales_tiers || '[]'); } catch (e) {}
            return {
              ...r,
              allowed_categories: cats,
              allowed_volumes: vols,
              allowed_sales_tiers: tiers,
              _isExactX: r.x_start === r.x_end ? 1 : 0
            };
          }).sort((a, b) => b._isExactX - a._isExactX || a.id - b.id);

          loadAuditRecordsWithSales((dErr, records) => {
            if (dErr) return res.status(500).json({ success: false, message: dErr.message });

            const totalCount = (records || []).length;
            if (totalCount === 0) {
              return res.json({
                success: true,
                hasData: false,
                activeMode,
                settings,
                summary: { total: 0, audited: 0, passed: 0, failed: 0, accuracyPct: 0 },
                byTrade: [],
                byFloor: [],
                byCategory: [],
                bySalesTier: [],
                byXRow: {},
                exceptions: []
              });
            }

            let audited = 0, passed = 0, failed = 0;
            const tradeStats = {};
            const floorStats = {};
            const catStats = {};
            const tierStats = {
              A: { label: 'A級爆品', total: 0, passed: 0, failed: 0 },
              B: { label: 'B級常銷', total: 0, passed: 0, failed: 0 },
              C: { label: 'C級慢銷', total: 0, passed: 0, failed: 0 },
              D: { label: 'D級滯銷', total: 0, passed: 0, failed: 0 }
            };
            const byXRow = {};
            const exceptions = [];

            const catTargetMap = {};
            const tierTargetMap = {};
            rules.forEach(r => {
              const xLabel = r.x_start === r.x_end ? r.x_start : `${r.x_start}~${r.x_end}`;
              const label = `${r.floor} ${xLabel}${r.allowed_trade !== 'ALL' ? '(' + r.allowed_trade + ')' : ''}`;
              if (r.allowed_categories.length > 0) {
                r.allowed_categories.forEach(c => {
                  if (!catTargetMap[c]) catTargetMap[c] = [];
                  if (!catTargetMap[c].includes(label)) catTargetMap[c].push(label);
                });
              }
              if (r.allowed_sales_tiers.length > 0) {
                r.allowed_sales_tiers.forEach(t => {
                  if (!tierTargetMap[t]) tierTargetMap[t] = [];
                  if (!tierTargetMap[t].includes(label)) tierTargetMap[t].push(label);
                });
              }
            });

            records.forEach(rec => {
              const salesTier = classifySalesTier(rec.monthly_sales, settings);
              const matchedRule = matchRuleForRecord(rec, rules);

              const hasActiveConstraint = matchedRule && (
                (matchedRule.allowed_trade && matchedRule.allowed_trade !== 'ALL') ||
                (checkCat && matchedRule.allowed_categories && matchedRule.allowed_categories.length > 0) ||
                (checkSales && matchedRule.allowed_sales_tiers && matchedRule.allowed_sales_tiers.length > 0) ||
                (matchedRule.allowed_volumes && matchedRule.allowed_volumes.length > 0)
              );

              let isOk = true;
              const reasons = [];

              if (hasActiveConstraint) {
                audited++;
                if (matchedRule.allowed_trade !== 'ALL' && rec.trade_type && matchedRule.allowed_trade !== rec.trade_type) {
                  isOk = false;
                  reasons.push(`借/採不符：限放「${matchedRule.allowed_trade}」，實際「${rec.trade_type}」`);
                }
                if (checkCat && matchedRule.allowed_categories.length > 0 && rec.cat_name && !matchedRule.allowed_categories.includes(rec.cat_name)) {
                  isOk = false;
                  reasons.push(`大區不符：限放[${matchedRule.allowed_categories.join('、')}]，實際「${rec.cat_name}」`);
                }
                if (checkSales && matchedRule.allowed_sales_tiers.length > 0 && !matchedRule.allowed_sales_tiers.includes(salesTier)) {
                  const allowedLabels = matchedRule.allowed_sales_tiers.map(formatTierLabel).join('、');
                  isOk = false;
                  reasons.push(`月銷不符：限放[${allowedLabels}]，實際「${formatTierLabel(salesTier)}(月銷${rec.monthly_sales})」`);
                }
                if (matchedRule.allowed_volumes.length > 0 && rec.volume_type && !matchedRule.allowed_volumes.includes(rec.volume_type)) {
                  isOk = false;
                  reasons.push(`材積不符：限放[${matchedRule.allowed_volumes.join('、')}]，實際「${rec.volume_type}」`);
                }
              }

              if (isOk) passed++;
              else {
                failed++;
                if (exceptions.length < 3000) {
                  let suggestedList = [];
                  if (checkSales && tierTargetMap[salesTier]) suggestedList = suggestedList.concat(tierTargetMap[salesTier]);
                  if (checkCat && catTargetMap[rec.cat_name]) suggestedList = suggestedList.concat(catTargetMap[rec.cat_name]);
                  const suggested = Array.from(new Set(suggestedList)).slice(0, 2).join(' 或 ') || '請依設定規則調整儲位';

                  exceptions.push({
                    sku_id: rec.sku_id,
                    sku_name: rec.sku_name,
                    trade_type: rec.trade_type,
                    cat_name: rec.cat_name,
                    monthly_sales: rec.monthly_sales,
                    sales_tier: salesTier,
                    sales_tier_label: formatTierLabel(salesTier),
                    volume_type: rec.volume_type,
                    floor: rec.floor,
                    area: rec.area,
                    bin_code: rec.bin_code,
                    qty: rec.qty,
                    zone_name: matchedRule ? matchedRule.zone_name : '未定義區段',
                    reason: reasons.join('；'),
                    suggested_zone: suggested
                  });
                }
              }

              const parsed = parseBinCode(rec.bin_code);
              if (parsed && rec.floor) {
                const baseFloor = rec.floor.startsWith('2F') ? '2F' : rec.floor;
                const xKey = `${baseFloor}|${parsed.x}`;
                if (!byXRow[xKey]) {
                  byXRow[xKey] = { total: 0, passed: 0, failed: 0, borrowCnt: 0, buyCnt: 0, cats: {}, tiers: { A: 0, B: 0, C: 0, D: 0 } };
                }
                const xs = byXRow[xKey];
                xs.total++;
                if (isOk) xs.passed++; else xs.failed++;
                if (rec.trade_type === '借') xs.borrowCnt++;
                if (rec.trade_type === '採') xs.buyCnt++;
                if (rec.cat_name) xs.cats[rec.cat_name] = (xs.cats[rec.cat_name] || 0) + 1;
                xs.tiers[salesTier] = (xs.tiers[salesTier] || 0) + 1;
              }

              const tKey = rec.trade_type || '未標示';
              if (!tradeStats[tKey]) tradeStats[tKey] = { label: tKey, total: 0, passed: 0, failed: 0 };
              tradeStats[tKey].total++;
              if (isOk) tradeStats[tKey].passed++; else tradeStats[tKey].failed++;

              const fKey = rec.floor || '未標示';
              if (!floorStats[fKey]) floorStats[fKey] = { label: fKey, total: 0, passed: 0, failed: 0 };
              floorStats[fKey].total++;
              if (isOk) floorStats[fKey].passed++; else floorStats[fKey].failed++;

              const cKey = rec.cat_name || '未分類';
              if (!catStats[cKey]) catStats[cKey] = { label: cKey, total: 0, passed: 0, failed: 0 };
              catStats[cKey].total++;
              if (isOk) catStats[cKey].passed++; else catStats[cKey].failed++;

              tierStats[salesTier].total++;
              if (isOk) tierStats[salesTier].passed++; else tierStats[salesTier].failed++;
            });

            const toArr = (obj) => Object.values(obj).map(x => ({
              ...x,
              accuracyPct: x.total > 0 ? Number(((x.passed / x.total) * 100).toFixed(2)) : 0
            })).sort((a, b) => b.total - a.total);

            const bySalesTier = ['A', 'B', 'C', 'D'].map(k => ({
              tier: k,
              ...tierStats[k],
              accuracyPct: tierStats[k].total > 0 ? Number(((tierStats[k].passed / tierStats[k].total) * 100).toFixed(2)) : 0
            }));

            res.json({
              success: true,
              hasData: true,
              activeMode,
              settings,
              summary: {
                total: totalCount,
                audited,
                passed,
                failed,
                accuracyPct: totalCount > 0 ? Number(((passed / totalCount) * 100).toFixed(2)) : 0
              },
              byTrade: toArr(tradeStats),
              byFloor: toArr(floorStats),
              byCategory: toArr(catStats),
              bySalesTier,
              byXRow,
              exceptions
            });
          });
        });
      });
    });
  });

  // 7. 🧠 80 庫真實數據「三種擺放模式動線與找貨效益模擬分析」（以 7F A區為出發點；2/4/6/8F 夾層結構校準）
  router.get('/audit/simulate-modes', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        loadAuditRecordsWithSales((err, records) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          if (!records || records.length === 0) {
            return res.json({ success: true, hasData: false });
          }

          // 🌟 現場真實動線距離權重（出發點：7F A區；2/4/6/8F 為夾層）
          const getRealWarehouseDistance = (floorStr, areaStr, binCode) => {
            const f = String(floorStr || '').toUpperCase().trim();
            const a = String(areaStr || '').toUpperCase().trim();
            const parsed = parseBinCode(binCode);
            const yOffset = parsed ? (parsed.y / 100) * 0.45 : 0.2;

            // 1. 出發核心層：7F (A~D區)
            if (f.startsWith('7F')) {
              if (a === 'A' || (parsed && parsed.x.startsWith('M'))) {
                return 1.0 + yOffset; // 7F A區起點核心
              }
              if (a === 'B') return 1.5 + yOffset;
              if (a === 'C') return 1.7 + yOffset;
              return 1.9 + yOffset; // 7F D區
            }

            // 2. 相鄰夾層：6F (B~D區) 在 7F 正下方夾層
            if (f.startsWith('6F')) {
              if (a === 'B') return 2.3 + yOffset;
              if (a === 'C') return 2.5 + yOffset;
              return 2.7 + yOffset; // 6F D區
            }

            // 3. 相鄰夾層：8F (A~D區) 在 7F 正上方夾層
            if (f.startsWith('8F')) {
              if (a === 'A') return 2.6 + yOffset;
              if (a === 'B') return 2.8 + yOffset;
              if (a === 'C') return 3.0 + yOffset;
              return 3.2 + yOffset; // 8F D區
            }

            // 4. 4F 夾層貴重區（B區小房間）
            if (f.startsWith('4F')) {
              return 3.7 + yOffset;
            }

            // 5. 3F 重型貨架（3B、3C 位於樓層最中間）
            if (f.startsWith('3F')) {
              return 4.1 + yOffset;
            }

            // 6. 2F 夾層（東側 A/B區、西側 B區 — 距離 7F 出發點最遠）
            if (f.startsWith('2F')) {
              if (f.includes('東')) return 4.7 + yOffset;
              if (f.includes('西')) return 5.0 + yOffset;
              return 4.9 + yOffset;
            }

            return 3.5 + yOffset;
          };

          // 🌟 黃金動線區定義（從 7F A區出發免跨遠樓層的高效區）：
          // 一級黃金區：7F A區（起點核心）
          // 二級黃金區：7F B/C/D區（同層免上下樓）＋ 6F B/C區前段（緊鄰下方夾層）
          const isRealGoldenZone = (floorStr, areaStr, binCode) => {
            const f = String(floorStr || '').toUpperCase().trim();
            const a = String(areaStr || '').toUpperCase().trim();
            const parsed = parseBinCode(binCode);

            if (f.startsWith('7F')) return true;
            if (f.startsWith('6F') && (a === 'B' || a === 'C') && (!parsed || parsed.y <= 60)) return true;
            return false;
          };

          let currentWalkIndex = 0;
          let totalPickFrequency = 0;
          let hotItemsCount = 0;
          let hotItemsInGoldenZone = 0;

          const catFloorSpread = {};
          const tierDistribution = {
            A: { tier: 'A', label: `A級爆品 (≥${settings.tierA_min})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
            B: { tier: 'B', label: `B級常銷 (${settings.tierB_min}~${settings.tierA_min - 1})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
            C: { tier: 'C', label: `C級慢銷 (${settings.tierC_min}~${settings.tierB_min - 1})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
            D: { tier: 'D', label: `D級滯銷 (0)`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 }
          };

          const seenSkuTier = new Set();

          records.forEach(rec => {
            const tier = classifySalesTier(rec.monthly_sales, settings);
            const pickFreq = Math.max(1, Number(rec.pick_days_m || 0) || Math.ceil(Number(rec.monthly_sales || 0) / 3));
            const distW = getRealWarehouseDistance(rec.floor, rec.area, rec.bin_code);

            currentWalkIndex += pickFreq * distW;
            totalPickFrequency += pickFreq;

            const isGolden = isRealGoldenZone(rec.floor, rec.area, rec.bin_code);

            if (tier === 'A' || tier === 'B') {
              hotItemsCount++;
              if (isGolden) hotItemsInGoldenZone++;
            }

            const td = tierDistribution[tier];
            td.binCount++;
            td.totalSales += Number(rec.monthly_sales || 0);
            td.pickFreq += pickFreq;
            if (isGolden) td.goldenBins++;

            const skuKey = `${tier}|${rec.sku_id}`;
            if (!seenSkuTier.has(skuKey)) {
              seenSkuTier.add(skuKey);
              td.skuCount++;
            }

            if (rec.cat_name) {
              if (!catFloorSpread[rec.cat_name]) catFloorSpread[rec.cat_name] = new Set();
              catFloorSpread[rec.cat_name].add(rec.floor || '未知');
            }
          });

          const allSlotWeights = records.map(r => getRealWarehouseDistance(r.floor, r.area, r.bin_code)).sort((a, b) => a - b);
          const recordsByFreqDesc = [...records].sort((a, b) => {
            const fa = Math.max(1, Number(a.pick_days_m || 0) || Math.ceil(Number(a.monthly_sales || 0) / 3));
            const fb = Math.max(1, Number(b.pick_days_m || 0) || Math.ceil(Number(b.monthly_sales || 0) / 3));
            return fb - fa;
          });

          let pureSalesWalkIndex = 0;
          recordsByFreqDesc.forEach((r, idx) => {
            const freq = Math.max(1, Number(r.pick_days_m || 0) || Math.ceil(Number(r.monthly_sales || 0) / 3));
            pureSalesWalkIndex += freq * (allSlotWeights[idx] || 2.5);
          });

          const hybridWalkIndex = pureSalesWalkIndex * 0.65 + currentWalkIndex * 0.35;

          const avgCatFloors = Object.values(catFloorSpread).length > 0
            ? Object.values(catFloorSpread).reduce((acc, s) => acc + s.size, 0) / Object.values(catFloorSpread).length
            : 1;

          const currentHotRatio = hotItemsCount > 0 ? Math.round((hotItemsInGoldenZone / hotItemsCount) * 100) : 0;
          const misallocatedHotRatio = Math.max(5, 100 - currentHotRatio);

          const modesComparison = [
            {
              mode: 'CAT_TRADE',
              name: '模式 1：大區 + 借採（屬性分區導向）',
              walkDistanceIndex: Math.round(currentWalkIndex),
              walkSavingPct: 0,
              goldenHotPct: currentHotRatio,
              findEaseScore: Math.min(98, Math.max(78, Math.round(100 - avgCatFloors * 3.5))),
              moveEffortLevel: '低（維持現有大區骨架）',
              pros: '同大區商品高度集中，人員看區名就能直覺找貨、盤點最容易',
              cons: '同大區內的爆品與滯銷品混放，需頻繁從 7F A區跨夾層上下至 2F/3F/4F 走動',
              recommended: false
            },
            {
              mode: 'SALES_TRADE',
              name: '模式 2：月銷 + 借採（純熱度動線導向）',
              walkDistanceIndex: Math.round(pureSalesWalkIndex),
              walkSavingPct: currentWalkIndex > 0 ? Number((((currentWalkIndex - pureSalesWalkIndex) / currentWalkIndex) * 100).toFixed(1)) : 0,
              goldenHotPct: Math.min(98, Math.max(currentHotRatio + 22, 88)),
              findEaseScore: 64,
              moveEffortLevel: `高（約 ${Math.min(65, Math.round(misallocatedHotRatio * 0.85))}% 儲位需大搬風）`,
              pros: 'A/B 級爆品全數集中於 7F A區起點核心與 7F/6F 黃金層，揀貨行走距離最短',
              cons: '不同大區商品混雜在一起，失去品類邏輯，極度依賴系統儲位導引',
              recommended: false
            },
            {
              mode: 'CAT_SALES_TRADE',
              name: '模式 3：大區 + 月銷 + 借採（黃金平衡模式）',
              walkDistanceIndex: Math.round(hybridWalkIndex),
              walkSavingPct: currentWalkIndex > 0 ? Number((((currentWalkIndex - hybridWalkIndex) / currentWalkIndex) * 100).toFixed(1)) : 0,
              goldenHotPct: Math.min(92, Math.max(currentHotRatio + 15, 78)),
              findEaseScore: Math.min(95, Math.max(82, Math.round(98 - avgCatFloors * 3.0))),
              moveEffortLevel: `中（僅需將遠端 2F~4F 的 A/B 爆品前移約 ${Math.min(35, Math.round(misallocatedHotRatio * 0.45))}%）`,
              pros: '保留「大區＋借採」找貨直覺，同時將高月銷爆品拉回 7F/6F 近端黃金排位，兼顧找貨速度與短距離',
              cons: '規則設定需同時維護大區與月銷級距',
              recommended: true
            }
          ];

          // 找出當前放在遠端低樓層（2F 夾層東/西側、3F、4F 貴重區）的 A/B 級高熱銷爆品，建議拉回 7F / 6F 黃金區
          const topMoveCandidates = records
            .map(r => ({
              ...r,
              sales_tier: classifySalesTier(r.monthly_sales, settings),
              distW: getRealWarehouseDistance(r.floor, r.area, r.bin_code)
            }))
            .filter(r => (r.sales_tier === 'A' || r.sales_tier === 'B') && r.distW >= 3.6)
            .sort((a, b) => Number(b.monthly_sales || 0) - Number(a.monthly_sales || 0))
            .slice(0, 15);

          res.json({
            success: true,
            hasData: true,
            settings,
            totalRecords: records.length,
            totalPickFrequency,
            tierDistribution: Object.values(tierDistribution),
            modesComparison,
            topMoveCandidates
          });
        });
      });
    });
  });

  // 8. 一鍵自動學習（依據現有 80 庫實際分布填入主要大區與主要月銷級距）
  router.post('/rules/auto-suggest', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        db.all(`SELECT * FROM storage_placement_rules`, [], (rErr, rules) => {
          loadAuditRecordsWithSales((dErr, records) => {
            if (!records || records.length === 0) {
              return res.status(400).json({ success: false, message: '請先匯入一份 80 庫 CSV 資料，系統才能自動分析各區分布！' });
            }

            const zoneCatCounts = {};
            const zoneTierCounts = {};

            records.forEach(rec => {
              const matched = matchRuleForRecord(rec, rules);
              if (matched) {
                if (rec.cat_name) {
                  if (!zoneCatCounts[matched.id]) zoneCatCounts[matched.id] = {};
                  zoneCatCounts[matched.id][rec.cat_name] = (zoneCatCounts[matched.id][rec.cat_name] || 0) + 1;
                }
                const tier = classifySalesTier(rec.monthly_sales, settings);
                if (!zoneTierCounts[matched.id]) zoneTierCounts[matched.id] = {};
                zoneTierCounts[matched.id][tier] = (zoneTierCounts[matched.id][tier] || 0) + 1;
              }
            });

            db.serialize(() => {
              db.run('BEGIN TRANSACTION');
              Object.keys(zoneCatCounts).forEach((ruleId) => {
                const counts = zoneCatCounts[ruleId] || {};
                const totalInZone = Object.values(counts).reduce((a, b) => a + b, 0);
                const majorCats = Object.entries(counts)
                  .filter(([, cnt]) => cnt / totalInZone >= 0.15)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat]) => cat);

                const tCounts = zoneTierCounts[ruleId] || {};
                const totalT = Object.values(tCounts).reduce((a, b) => a + b, 0);
                const majorTiers = Object.entries(tCounts)
                  .filter(([, cnt]) => cnt / totalT >= 0.15)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([t]) => t);

                db.run(
                  `UPDATE storage_placement_rules SET allowed_categories = ?, allowed_sales_tiers = ? WHERE id = ?`,
                  [JSON.stringify(majorCats), JSON.stringify(majorTiers), Number(ruleId)]
                );
              });
              db.run('COMMIT', (cErr) => {
                if (cErr) return res.status(500).json({ success: false, message: cErr.message });
                res.json({ success: true, message: '🎉 已根據目前 80 庫實際分布自動填入各區段主要大區與月銷級距！' });
              });
            });
          });
        });
      });
    });
  });

  return router;
};