// routes/storageAccuracy.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const DEFAULT_ZONE_ZONES = [
    { zone_name: '80D-B區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'A01', x_end: 'A06', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'B', rack_length_m: 18, zone_role: 'BOTH' },
    { zone_name: '80D-B區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'A06', x_end: 'A08', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'A', rack_length_m: 18, zone_role: 'STORAGE' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'A01', x_end: 'A06', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'B', rack_length_m: 18, zone_role: 'CLOSED' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'A07', x_end: 'A08', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'A', rack_length_m: 18, zone_role: 'CLOSED' },
    { zone_name: '80C2A', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'A', x_start: 'C2A', x_end: 'C2A', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I', rack_length_m: 26, zone_role: 'BOTH' },
    { zone_name: '80C2B', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'C2B', x_end: 'C2B', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I', rack_length_m: 26, zone_role: 'BOTH' },
    { zone_name: '80C2C', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'C2C', x_end: 'C2C', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I', rack_length_m: 26, zone_role: 'CLOSED' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'E05', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E', rack_length_m: 24, zone_role: 'STORAGE' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'E05', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B', rack_length_m: 24, zone_role: 'PICK' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'E01', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E', rack_length_m: 24, zone_role: 'STORAGE' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'E01', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B', rack_length_m: 24, zone_role: 'PICK' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '中型層架(格)', wh: '80', area: 'B', x_start: 'H01', x_end: 'H17', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E', rack_length_m: 6, zone_role: 'PICK' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '小藍格', wh: '80', area: 'B', x_start: 'H18', x_end: 'H18', y_start: '001', y_end: '028', layer_start: 'A', layer_end: 'G', rack_length_m: 12, zone_role: 'PICK' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'K01', x_end: 'K05', y_start: '061', y_end: '092', layer_start: 'A', layer_end: 'C', rack_length_m: 20, zone_role: 'BOTH' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'B', x_start: 'L61', x_end: 'L84', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'F', rack_length_m: 6, zone_role: 'PICK' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'K01', x_end: 'K05', y_start: '027', y_end: '058', layer_start: 'A', layer_end: 'C', rack_length_m: 20, zone_role: 'BOTH' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'C', x_start: 'L31', x_end: 'L60', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E', rack_length_m: 6, zone_role: 'PICK' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L01', x_end: 'L26', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'E', rack_length_m: 28, zone_role: 'PICK' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L27', x_end: 'L30', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'G', rack_length_m: 28, zone_role: 'PICK' },
    { zone_name: '80M01-53(第一段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '001', y_end: '052', layer_start: 'A', layer_end: 'E', rack_length_m: 24, zone_role: 'PICK' },
    { zone_name: '80M01-53(第二段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M03', x_end: 'M53', y_start: '056', y_end: '067', layer_start: 'A', layer_end: 'F', rack_length_m: 8, zone_role: 'PICK' },
    { zone_name: '80M01-53(第三段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '068', y_end: '079', layer_start: 'A', layer_end: 'E', rack_length_m: 8, zone_role: 'PICK' },
    { zone_name: '80M01-53(第四段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M43', x_end: 'M53', y_start: '080', y_end: '094', layer_start: 'A', layer_end: 'E', rack_length_m: 9, zone_role: 'PICK' },
    { zone_name: '80O(貴重區)', floor: '7F', storage_type: '鐵櫃', wh: '80', area: 'A', x_start: 'O01', x_end: 'O01', y_start: '001', y_end: '027', layer_start: 'A', layer_end: 'L', rack_length_m: 12, zone_role: 'PICK' },
    { zone_name: '80N55-69(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'A', x_start: 'N55', x_end: 'N69', y_start: '052', y_end: '075', layer_start: 'A', layer_end: 'E', rack_length_m: 16, zone_role: 'BOTH' },
    { zone_name: '80N35-53(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'N35', x_end: 'N53', y_start: '027', y_end: '075', layer_start: 'A', layer_end: 'E', rack_length_m: 30, zone_role: 'BOTH' },
    { zone_name: '80N015-33(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'N15', x_end: 'N33', y_start: '001', y_end: '075', layer_start: 'A', layer_end: 'E', rack_length_m: 42, zone_role: 'BOTH' },
    { zone_name: '80N34', floor: '7F', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'N34', x_end: 'N34', y_start: '001', y_end: '044', layer_start: 'A', layer_end: 'A', rack_length_m: 25, zone_role: 'STORAGE' },
    { zone_name: '80S01-05(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'S01', x_end: 'S05', y_start: '001', y_end: '049', layer_start: 'A', layer_end: 'E', rack_length_m: 28, zone_role: 'BOTH' },
    { zone_name: '80N01-14(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'N01', x_end: 'N14', y_start: '001', y_end: '068', layer_start: 'A', layer_end: 'E', rack_length_m: 38, zone_role: 'BOTH' },
    { zone_name: '80R-A區', floor: '8F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'R11', x_end: 'R42', y_start: '001', y_end: '056', layer_start: 'A', layer_end: 'F', rack_length_m: 26, zone_role: 'PICK' },
    { zone_name: '80R、Q-B區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'R01', x_end: 'R05', y_start: '063', y_end: '098', layer_start: 'A', layer_end: 'C', rack_length_m: 22, zone_role: 'BOTH' },
    { zone_name: '80R、Q-C區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'R01', x_end: 'R05', y_start: '027', y_end: '062', layer_start: 'A', layer_end: 'C', rack_length_m: 22, zone_role: 'BOTH' },
    { zone_name: '80R、Q-D區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'R01', x_end: 'R05', y_start: '001', y_end: '026', layer_start: 'A', layer_end: 'C', rack_length_m: 16, zone_role: 'BOTH' }
  ];

  const DEFAULT_MODE_SETTINGS = {
    mode: 'CAT_TRADE',
    tierA_min: 50,
    tierB_min: 10,
    tierC_min: 1
  };

  // 區域用途屬性：'STORAGE' (庫區) | 'PICK' (撿貨區) | 'BOTH' (庫區+撿貨區) | 'CLOSED' (關閉中)
  const VALID_ZONE_ROLES = ['STORAGE', 'PICK', 'BOTH', 'CLOSED'];

  function formatZoneRoleLabel(role) {
    const map = {
      STORAGE: '庫區',
      PICK: '撿貨區',
      BOTH: '庫區+撿貨區',
      CLOSED: '關閉中'
    };
    return map[role] || '撿貨區';
  }

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
          rack_length_m REAL DEFAULT 20,
          zone_role TEXT DEFAULT 'PICK',
          enabled INTEGER DEFAULT 1,
          remark TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        )
      `);

      db.run(`ALTER TABLE storage_placement_rules ADD COLUMN allowed_sales_tiers TEXT DEFAULT '[]'`, () => {});
      db.run(`ALTER TABLE storage_placement_rules ADD COLUMN rack_length_m REAL DEFAULT 20`, () => {});
      db.run(`ALTER TABLE storage_placement_rules ADD COLUMN zone_role TEXT DEFAULT 'PICK'`, () => {});

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
            (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALL', '[]', '[]', '[]', ?, ?, 1, ?)
          `);
          DEFAULT_ZONE_ZONES.forEach((z, idx) => {
            stmt.run(z.zone_name, z.floor, z.storage_type, z.area, z.x_start, z.x_end, z.y_start, z.y_end, z.layer_start, z.layer_end, z.rack_length_m || 20, z.zone_role || 'PICK', idx * 100);
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
          const zoneRole = VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK';
          return {
            ...r,
            allowed_categories: cats,
            allowed_volumes: vols,
            allowed_sales_tiers: tiers,
            rack_length_m: Number(r.rack_length_m || 20),
            zone_role: zoneRole,
            enabled: r.enabled === 1
          };
        });
        res.json({ success: true, rules });
      });
    });
  });

  // 2. 儲存 / 更新單條規則（含層架長度 rack_length_m 與區域屬性 zone_role）
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
    const rackLen = Math.max(0.5, Number(rule.rack_length_m || 20));
    const zoneRole = VALID_ZONE_ROLES.includes(rule.zone_role) ? rule.zone_role : 'PICK';
    const enabledInt = rule.enabled !== false ? 1 : 0;

    if (rule.id) {
      db.run(`
        UPDATE storage_placement_rules SET
          zone_name = ?, floor = ?, storage_type = ?, area = ?,
          x_start = ?, x_end = ?, y_start = ?, y_end = ?,
          layer_start = ?, layer_end = ?,
          allowed_trade = ?, allowed_categories = ?, allowed_volumes = ?, allowed_sales_tiers = ?,
          rack_length_m = ?, zone_role = ?, enabled = ?, remark = ?
        WHERE id = ?
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson, tiersJson,
        rackLen, zoneRole, enabledInt, rule.remark || '', rule.id
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    } else {
      db.run(`
        INSERT INTO storage_placement_rules
        (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, remark, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson, tiersJson,
        rackLen, zoneRole, enabledInt, rule.remark || ''
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
              (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, remark, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              `${r.zone_name}-${xCode}`, r.floor, r.storage_type, r.area,
              xCode, xCode, r.y_start, r.y_end, r.layer_start, r.layer_end,
              r.allowed_trade, r.allowed_categories, r.allowed_volumes, r.allowed_sales_tiers || '[]',
              Number(r.rack_length_m || 20), r.zone_role || 'PICK', r.enabled, r.remark,
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

  // 6. 依據目前「擺放模式」、「區域用途(庫區/撿貨區/庫區+撿貨區/關閉中)」與規則，計算準確率與異常清單
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
              rack_length_m: Number(r.rack_length_m || 20),
              zone_role: VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK',
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
                byZoneRole: [],
                byXRow: {},
                exceptions: []
              });
            }

            let audited = 0, passed = 0, failed = 0;
            const tradeStats = {};
            const floorStats = {};
            const catStats = {};
            const roleStats = {
              PICK: { role: 'PICK', label: '🛒 撿貨區', total: 0, passed: 0, failed: 0 },
              BOTH: { role: 'BOTH', label: '🔄 庫區+撿貨區', total: 0, passed: 0, failed: 0 },
              STORAGE: { role: 'STORAGE', label: '📦 庫區', total: 0, passed: 0, failed: 0 },
              CLOSED: { role: 'CLOSED', label: '🚫 關閉中', total: 0, passed: 0, failed: 0 }
            };
            const tierStats = {
              A: { label: 'A級爆品', total: 0, passed: 0, failed: 0 },
              B: { label: 'B級常銷', total: 0, passed: 0, failed: 0 },
              C: { label: 'C級慢銷', total: 0, passed: 0, failed: 0 },
              D: { label: 'D級滯銷', total: 0, passed: 0, failed: 0 }
            };
            const byXRow = {};
            const exceptions = [];

            // 建議移庫目標池（自動排除「關閉中」的區域）
            const catTargetMap = {};
            const tierTargetMap = {};
            rules.filter(r => r.zone_role !== 'CLOSED').forEach(r => {
              const xLabel = r.x_start === r.x_end ? r.x_start : `${r.x_start}~${r.x_end}`;
              const roleTag = `[${formatZoneRoleLabel(r.zone_role)}]`;
              const label = `${r.floor} ${xLabel}${roleTag}${r.allowed_trade !== 'ALL' ? '(' + r.allowed_trade + ')' : ''}`;
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
              const zoneRole = matchedRule ? matchedRule.zone_role : 'PICK';

              const isClosedZone = zoneRole === 'CLOSED';
              const hasActiveConstraint = matchedRule && (
                isClosedZone ||
                (matchedRule.allowed_trade && matchedRule.allowed_trade !== 'ALL') ||
                (checkCat && matchedRule.allowed_categories && matchedRule.allowed_categories.length > 0) ||
                (checkSales && matchedRule.allowed_sales_tiers && matchedRule.allowed_sales_tiers.length > 0) ||
                (matchedRule.allowed_volumes && matchedRule.allowed_volumes.length > 0)
              );

              let isOk = true;
              const reasons = [];

              if (hasActiveConstraint) {
                audited++;

                if (isClosedZone) {
                  isOk = false;
                  reasons.push(`🚫 區域「關閉中」：該儲位已停用關閉，禁止存放庫存（現有 ${rec.qty} 件需立即移出）`);
                } else {
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
              }

              if (isOk) passed++;
              else {
                failed++;
                if (exceptions.length < 3000) {
                  let suggestedList = [];
                  if (checkSales && tierTargetMap[salesTier]) suggestedList = suggestedList.concat(tierTargetMap[salesTier]);
                  if (checkCat && catTargetMap[rec.cat_name]) suggestedList = suggestedList.concat(catTargetMap[rec.cat_name]);
                  const suggested = Array.from(new Set(suggestedList)).slice(0, 2).join(' 或 ') || '請移往開放中的撿貨區/庫區';

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
                    zone_role: zoneRole,
                    zone_role_label: formatZoneRoleLabel(zoneRole),
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

              if (roleStats[zoneRole]) {
                roleStats[zoneRole].total++;
                if (isOk) roleStats[zoneRole].passed++; else roleStats[zoneRole].failed++;
              }
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

            const byZoneRole = ['PICK', 'BOTH', 'STORAGE', 'CLOSED'].map(k => ({
              ...roleStats[k],
              accuracyPct: roleStats[k].total > 0 ? Number(((roleStats[k].passed / roleStats[k].total) * 100).toFixed(2)) : 0
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
              byZoneRole,
              byXRow,
              exceptions
            });
          });
        });
      });
    });
  });

  // 7. 🧠 80 庫真實數據「三種擺放模式實際步行公尺(m)與找貨效益精算分析」（納入庫區/撿貨區/庫區+撿貨區/關閉中屬性）
  router.get('/audit/simulate-modes', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        db.all(`SELECT * FROM storage_placement_rules WHERE enabled = 1`, [], (rErr, ruleRows) => {
          const rules = (ruleRows || []).map(r => ({
            ...r,
            rack_length_m: Number(r.rack_length_m || 20),
            zone_role: VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK',
            _isExactX: r.x_start === r.x_end ? 1 : 0
          })).sort((a, b) => b._isExactX - a._isExactX || a.id - b.id);

          loadAuditRecordsWithSales((err, records) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (!records || records.length === 0) {
              return res.json({ success: true, hasData: false });
            }

            const calcRealRoundTripMeters = (rec, matchedRule) => {
              const f = String(rec.floor || '').toUpperCase().trim();
              const a = String(rec.area || '').toUpperCase().trim();
              const parsed = parseBinCode(rec.bin_code);

              const rackLenM = matchedRule && matchedRule.rack_length_m > 0 ? matchedRule.rack_length_m : 20;

              let aisleDepthM = rackLenM * 0.4;
              if (parsed) {
                const yStart = matchedRule ? Math.max(1, parseInt(matchedRule.y_start || '1', 10)) : 1;
                const yEnd = matchedRule ? Math.max(yStart + 1, parseInt(matchedRule.y_end || '60', 10)) : 60;
                const ratio = Math.min(1, Math.max(0, (parsed.y - yStart) / Math.max(1, yEnd - yStart)));
                aisleDepthM = ratio * rackLenM;
              }

              let rowIndexOffsetM = 0;
              if (parsed) {
                const mNum = parsed.x.match(/(\d+)$/);
                if (mNum) {
                  const rowNo = parseInt(mNum[1], 10);
                  rowIndexOffsetM = (rowNo % 30) * 1.4;
                }
              }

              let zoneEntryM = 45;
              if (f.startsWith('7F')) {
                if (a === 'A' || (parsed && parsed.x.startsWith('M'))) zoneEntryM = 6;
                else if (a === 'B') zoneEntryM = 24;
                else if (a === 'C') zoneEntryM = 34;
                else zoneEntryM = 42;
              } else if (f.startsWith('6F')) {
                if (a === 'B') zoneEntryM = 48;
                else if (a === 'C') zoneEntryM = 56;
                else zoneEntryM = 64;
              } else if (f.startsWith('8F')) {
                if (a === 'A') zoneEntryM = 54;
                else if (a === 'B') zoneEntryM = 62;
                else if (a === 'C') zoneEntryM = 68;
                else zoneEntryM = 74;
              } else if (f.startsWith('4F')) {
                zoneEntryM = 88;
              } else if (f.startsWith('3F')) {
                zoneEntryM = 96;
              } else if (f.startsWith('2F')) {
                zoneEntryM = f.includes('東') ? 115 : 128;
              }

              const oneWayM = zoneEntryM + rowIndexOffsetM + aisleDepthM;
              return Number((oneWayM * 2).toFixed(1));
            };

            const isRealGoldenZone = (floorStr, areaStr, binCode, zoneRole) => {
              if (zoneRole === 'CLOSED' || zoneRole === 'STORAGE') return false;
              const f = String(floorStr || '').toUpperCase().trim();
              const a = String(areaStr || '').toUpperCase().trim();
              const parsed = parseBinCode(binCode);
              if (f.startsWith('7F')) return true;
              if (f.startsWith('6F') && (a === 'B' || a === 'C') && (!parsed || parsed.y <= 60)) return true;
              return false;
            };

            let currentTotalMeters = 0;
            let totalPickFrequency = 0;
            let hotItemsCount = 0;
            let hotItemsInGoldenZone = 0;
            let closedZoneStockCount = 0;
            let hotInStorageOnlyCount = 0;

            const catFloorSpread = {};
            const tierDistribution = {
              A: { tier: 'A', label: `A級爆品 (≥${settings.tierA_min})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
              B: { tier: 'B', label: `B級常銷 (${settings.tierB_min}~${settings.tierA_min - 1})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
              C: { tier: 'C', label: `C級慢銷 (${settings.tierC_min}~${settings.tierB_min - 1})`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 },
              D: { tier: 'D', label: `D級滯銷 (0)`, skuCount: 0, binCount: 0, totalSales: 0, pickFreq: 0, goldenBins: 0 }
            };

            const seenSkuTier = new Set();
            const enrichedRecords = records.map(rec => {
              const matchedRule = matchRuleForRecord(rec, rules);
              const zoneRole = matchedRule ? matchedRule.zone_role : 'PICK';
              const roundTripM = calcRealRoundTripMeters(rec, matchedRule);
              const pickFreq = Math.max(1, Number(rec.pick_days_m || 0) || Math.ceil(Number(rec.monthly_sales || 0) / 3));
              return { ...rec, zoneRole, roundTripM, pickFreq };
            });

            enrichedRecords.forEach(rec => {
              const tier = classifySalesTier(rec.monthly_sales, settings);

              if (rec.zoneRole === 'CLOSED') {
                closedZoneStockCount++;
              }

              // 只有「撿貨區 (PICK)」與「庫區+撿貨區 (BOTH)」計入日常散單揀貨步行公里數；「純庫區 (STORAGE)」不計入散單步行
              if (rec.zoneRole === 'PICK' || rec.zoneRole === 'BOTH') {
                currentTotalMeters += rec.pickFreq * rec.roundTripM;
                totalPickFrequency += rec.pickFreq;
              } else if (rec.zoneRole === 'STORAGE' && (tier === 'A' || tier === 'B')) {
                hotInStorageOnlyCount++;
              }

              const isGolden = isRealGoldenZone(rec.floor, rec.area, rec.bin_code, rec.zoneRole);
              if (tier === 'A' || tier === 'B') {
                hotItemsCount++;
                if (isGolden) hotItemsInGoldenZone++;
              }

              const td = tierDistribution[tier];
              td.binCount++;
              td.totalSales += Number(rec.monthly_sales || 0);
              td.pickFreq += rec.pickFreq;
              if (isGolden) td.goldenBins++;

              const skuKey = `${tier}|${rec.sku_id}`;
              if (!seenSkuTier.has(skuKey)) {
                seenSkuTier.add(skuKey);
                td.skuCount++;
              }

              if (rec.cat_name && rec.zoneRole !== 'CLOSED') {
                if (!catFloorSpread[rec.cat_name]) catFloorSpread[rec.cat_name] = new Set();
                catFloorSpread[rec.cat_name].add(rec.floor || '未知');
              }
            });

            // 只在「撿貨區 / 庫區+撿貨區」的有效儲位池中進行熱度重排模擬（排除關閉中與純庫區）
            const activePickRecords = enrichedRecords.filter(r => r.zoneRole === 'PICK' || r.zoneRole === 'BOTH');
            const allSlotMeters = activePickRecords.map(r => r.roundTripM).sort((a, b) => a - b);
            const recordsByFreqDesc = [...activePickRecords].sort((a, b) => b.pickFreq - a.pickFreq);

            let pureSalesMeters = 0;
            recordsByFreqDesc.forEach((r, idx) => {
              pureSalesMeters += r.pickFreq * (allSlotMeters[idx] || 60);
            });

            const hybridMeters = pureSalesMeters * 0.65 + currentTotalMeters * 0.35;

            const currentKm = Number((currentTotalMeters / 1000).toFixed(1));
            const pureSalesKm = Number((pureSalesMeters / 1000).toFixed(1));
            const hybridKm = Number((hybridMeters / 1000).toFixed(1));

            const calcSavedHours = (baseM, newM) => Number((Math.max(0, baseM - newM) / 4000).toFixed(1));

            const avgCatFloors = Object.values(catFloorSpread).length > 0
              ? Object.values(catFloorSpread).reduce((acc, s) => acc + s.size, 0) / Object.values(catFloorSpread).length
              : 1;

            const currentHotRatio = hotItemsCount > 0 ? Math.round((hotItemsInGoldenZone / hotItemsCount) * 100) : 0;
            const misallocatedHotRatio = Math.max(5, 100 - currentHotRatio);

            const modesComparison = [
              {
                mode: 'CAT_TRADE',
                name: '模式 1：大區 + 借採（屬性分區導向）',
                walkDistanceIndex: currentKm,
                walkUnit: 'km / 月',
                walkSavingPct: 0,
                savedKm: 0,
                savedHours: 0,
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
                walkDistanceIndex: pureSalesKm,
                walkUnit: 'km / 月',
                walkSavingPct: currentTotalMeters > 0 ? Number((((currentTotalMeters - pureSalesMeters) / currentTotalMeters) * 100).toFixed(1)) : 0,
                savedKm: Number((currentKm - pureSalesKm).toFixed(1)),
                savedHours: calcSavedHours(currentTotalMeters, pureSalesMeters),
                goldenHotPct: Math.min(98, Math.max(currentHotRatio + 22, 88)),
                findEaseScore: 64,
                moveEffortLevel: `高（約 ${Math.min(65, Math.round(misallocatedHotRatio * 0.85))}% 撿貨區儲位需大搬風）`,
                pros: 'A/B 級爆品全數集中於 7F/6F 撿貨黃金區，每月行走公里數最短',
                cons: '不同大區商品混雜在一起，失去品類邏輯，極度依賴系統儲位導引',
                recommended: false
              },
              {
                mode: 'CAT_SALES_TRADE',
                name: '模式 3：大區 + 月銷 + 借採（黃金平衡模式）',
                walkDistanceIndex: hybridKm,
                walkUnit: 'km / 月',
                walkSavingPct: currentTotalMeters > 0 ? Number((((currentTotalMeters - hybridMeters) / currentTotalMeters) * 100).toFixed(1)) : 0,
                savedKm: Number((currentKm - hybridKm).toFixed(1)),
                savedHours: calcSavedHours(currentTotalMeters, hybridMeters),
                goldenHotPct: Math.min(92, Math.max(currentHotRatio + 15, 78)),
                findEaseScore: Math.min(95, Math.max(82, Math.round(98 - avgCatFloors * 3.0))),
                moveEffortLevel: `中（僅需將遠端 2F~4F 的 A/B 爆品前移約 ${Math.min(35, Math.round(misallocatedHotRatio * 0.45))}%）`,
                pros: '保留「大區＋借採」找貨直覺，將 D級滯銷品移入「庫區」、爆品集中「撿貨區」前段',
                cons: '規則設定需同時維護大區、月銷級距與區域用途',
                recommended: true
              }
            ];

            // 優先移庫建議：1) 放在「關閉中」區域的庫存  2) 放在純「庫區」的 A/B 級爆品  3) 放在遠端夾層(2F~4F)的 A/B 級爆品
            const topMoveCandidates = enrichedRecords
              .map(r => {
                const tier = classifySalesTier(r.monthly_sales, settings);
                let moveReason = '';
                if (r.zoneRole === 'CLOSED') moveReason = '🚫 位於「關閉中」區域，需立即清空移出';
                else if (r.zoneRole === 'STORAGE' && (tier === 'A' || tier === 'B')) moveReason = '📦 爆品誤放純「庫區」，建議移入撿貨區減少補貨';
                else if ((tier === 'A' || tier === 'B') && r.roundTripM >= 165) moveReason = '🚶 爆品位於遠端低樓層，拉回 7F/6F 可大幅縮短步行';
                return { ...r, sales_tier: tier, zone_role_label: formatZoneRoleLabel(r.zoneRole), moveReason };
              })
              .filter(r => r.moveReason !== '')
              .sort((a, b) => (a.zoneRole === 'CLOSED' ? -1 : 1) - (b.zoneRole === 'CLOSED' ? -1 : 1) || Number(b.monthly_sales || 0) - Number(a.monthly_sales || 0))
              .slice(0, 15);

            res.json({
              success: true,
              hasData: true,
              settings,
              totalRecords: records.length,
              closedZoneStockCount,
              hotInStorageOnlyCount,
              totalPickFrequency,
              tierDistribution: Object.values(tierDistribution),
              modesComparison,
              topMoveCandidates
            });
          });
        });
      });
    });
  });

  // 8. 一鍵自動學習
  router.post('/rules/auto-suggest', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        db.all(`SELECT * FROM storage_placement_rules WHERE zone_role != 'CLOSED'`, [], (rErr, rules) => {
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
                res.json({ success: true, message: '🎉 已根據目前 80 庫實際分布自動填入各開放區段主要大區與月銷級距！' });
              });
            });
          });
        });
      });
    });
  });

  return router;
};