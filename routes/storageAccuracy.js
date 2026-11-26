// routes/storageAccuracy.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 驗證是否為系統管理員 (sys_admin)
  function requireSysAdmin(req, res, next) {
    const headerUser = String(req.headers['x-username'] || req.body?.operator_username || '').trim();
    const headerRole = String(req.headers['x-user-role'] || req.body?.operator_role || '').trim();

    if (headerUser) {
      db.get(`SELECT role FROM users WHERE username = ?`, [headerUser], (err, row) => {
        if (!err && row && row.role === 'sys_admin') {
          return next();
        }
        return res.status(403).json({ success: false, message: '⛔ 權限不足：僅限系統管理員 (sys_admin) 執行此操作！' });
      });
    } else if (headerRole === 'sys_admin') {
      return next();
    } else {
      return res.status(403).json({ success: false, message: '⛔ 權限不足：僅限系統管理員 (sys_admin) 執行此操作！' });
    }
  }

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

  const DEFAULT_SKU_GROUPS = [
    { name: '商品ID溫度區', skus: [] },
    { name: '商品ID貴重區', skus: [] },
    { name: '商品ID票卷區', skus: [] },
    { name: '商品ID清倉區', skus: [] }
  ];

  const DEFAULT_MODE_SETTINGS = {
    mode: 'CAT_TRADE',
    tierA_min: 50,
    tierB_min: 10,
    tierC_min: 1,
    sku_groups: DEFAULT_SKU_GROUPS
  };

  const VALID_ZONE_ROLES = ['STORAGE', 'PICK', 'BOTH', 'CLOSED'];

  const BASE_RACK_CAPACITY_ORDER = [
    { baseType: '鐵櫃', maxCf: 0.2 },
    { baseType: '小藍格', maxCf: 0.6 },
    { baseType: '中型層架(格)', maxCf: 1.8 },
    { baseType: 'AGV層架-紙抽', maxCf: 1.8 },
    { baseType: 'AGV層架', maxCf: 7.1 },
    { baseType: '中型層架', maxCf: 8.6 },
    { baseType: '重型層架-低', maxCf: 39.8 },
    { baseType: '重型層架', maxCf: 45.5 },
    { baseType: '落地儲位', maxCf: 45.5 },
    { baseType: '板式', maxCf: 49.8 }
  ];

  function formatZoneRoleLabel(role) {
    const map = {
      STORAGE: '庫區',
      PICK: '撿貨區',
      BOTH: '庫區+撿貨區',
      CLOSED: '關閉中'
    };
    return map[role] || '撿貨區';
  }

  function normalizeBaseRackType(rawType) {
    const t = String(rawType || '').trim();
    if (!t) return '';
    if (t.includes('鐵櫃')) return '鐵櫃';
    if (t.includes('小藍格')) return '小藍格';
    if (t.includes('中型層架(格)')) return '中型層架(格)';
    if (t.includes('紙抽')) return 'AGV層架-紙抽';
    if (t.includes('AGV')) return 'AGV層架';
    if (t.includes('中型層架') || t.includes('小層架')) return '中型層架';
    if (t.includes('重型層架-低') || /重(30|50|65|80|90|100|110|140)/.test(t)) return '重型層架-低';
    if (t.includes('重型層架') || t.includes('重160')) return '重型層架';
    if (t.includes('落地')) return '落地儲位';
    if (t.includes('板式') || t.includes('板140')) return '板式';
    return t;
  }

  function classifyRackSpecByCubicFeet(totalCf) {
    const cf = Number(totalCf || 0);
    if (cf <= 0.2) return { label: '鐵櫃 (鐵10)', baseType: '鐵櫃' };
    if (cf <= 0.6) return { label: '小藍格 (小藍格20)', baseType: '小藍格' };
    if (cf <= 1.8) return { label: '中型層架(格) / AGV層架-紙抽', baseType: '中型層架(格)' };
    if (cf <= 5.3) return { label: 'AGV層架30 (A30)', baseType: 'AGV層架' };
    if (cf <= 7.1) return { label: 'AGV層架40 (A40)', baseType: 'AGV層架' };
    if (cf <= 8.6) return { label: '中型層架 / 小層架 (中40)', baseType: '中型層架' };
    if (cf <= 14.2) return { label: '重型層架-低7 (重50)', baseType: '重型層架-低' };
    if (cf <= 18.5) return { label: '重型層架-低6 (重65)', baseType: '重型層架-低' };
    if (cf <= 22.8) return { label: '重型層架-低5 (重80)', baseType: '重型層架-低' };
    if (cf <= 25.6) return { label: '重型層架-低4 (重90)', baseType: '重型層架-低' };
    if (cf <= 28.4) return { label: '重型層架-低3 (重100)', baseType: '重型層架-低' };
    if (cf <= 31.3) return { label: '重型層架-低2 (重110)', baseType: '重型層架-低' };
    if (cf <= 39.8) return { label: '重型層架-低1 (重140)', baseType: '重型層架-低' };
    if (cf <= 45.5) return { label: '重型層架160 / 落地儲位', baseType: '重型層架' };
    return { label: '板式 / 超大材 (板140)', baseType: '板式' };
  }

  function buildFloorRackInventory(masterRows, openRules) {
    const floorTypesMap = {};
    const addType = (fl, rawType) => {
      const f = String(fl || '').trim();
      const base = normalizeBaseRackType(rawType);
      if (!f || !base) return;
      if (!floorTypesMap[f]) floorTypesMap[f] = new Set();
      floorTypesMap[f].add(base);
      if (f.startsWith('2F') && f !== '2F') {
        if (!floorTypesMap['2F']) floorTypesMap['2F'] = new Set();
        floorTypesMap['2F'].add(base);
      }
    };

    (masterRows || []).forEach(m => {
      if (Number(m.grid_count || 0) > 0 || Number(m.cubic_feet || 0) > 0) {
        addType(m.floor, m.loc_type);
      }
    });
    (openRules || []).forEach(r => {
      addType(r.floor, r.storage_type);
    });

    const floorHasBaseType = (fl, baseType) => {
      const f = String(fl || '').trim();
      if (!f || !baseType) return false;
      const checkSet = (key) => {
        const set = floorTypesMap[key];
        if (!set || set.size === 0) return false;
        if (set.has(baseType)) return true;
        if (baseType === '中型層架(格)' && set.has('AGV層架-紙抽')) return true;
        if (baseType === '重型層架' && set.has('落地儲位')) return true;
        return false;
      };
      if (checkSet(f)) return true;
      if (f === '2F') return checkSet('2F東') || checkSet('2F西');
      return false;
    };

    const pickBestAvailableOnFloor = (fl, totalCf, idealSpec) => {
      const f = String(fl || '').trim();
      const set = floorTypesMap[f] || (f === '2F' ? (floorTypesMap['2F東'] || floorTypesMap['2F西']) : null);
      if (!set || set.size === 0) return idealSpec.label;

      const available = BASE_RACK_CAPACITY_ORDER.filter(item => set.has(item.baseType));
      if (available.length === 0) {
        const firstType = Array.from(set)[0];
        return `${firstType} (${f}現有層架｜原材積適${idealSpec.baseType})`;
      }

      const fit = available.find(item => item.maxCf >= Number(totalCf || 0)) || available[available.length - 1];
      return `${fit.baseType} (${f}現有規格｜原材積適${idealSpec.baseType})`;
    };

    return { floorTypesMap, floorHasBaseType, pickBestAvailableOnFloor };
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
          allowed_targets TEXT DEFAULT '[]',
          allowed_volumes TEXT DEFAULT '[]',
          allowed_sales_tiers TEXT DEFAULT '[]',
          rack_length_m REAL DEFAULT 20,
          zone_role TEXT DEFAULT 'PICK',
          enabled INTEGER DEFAULT 1,
          remark TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        )
      `);

      db.run(`ALTER TABLE storage_placement_rules ADD COLUMN allowed_targets TEXT DEFAULT '[]'`, () => {});
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
          zone_id TEXT DEFAULT '',
          zone_name TEXT DEFAULT '',
          vol_type TEXT DEFAULT '',
          volume_type TEXT DEFAULT '',
          total_cubic_feet REAL DEFAULT 0,
          monthly_sales REAL DEFAULT 0,
          pick_days_m REAL DEFAULT 0,
          note TEXT DEFAULT ''
        )
      `);

      db.run(`ALTER TABLE storage_audit_records ADD COLUMN monthly_sales REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN pick_days_m REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN zone_id TEXT DEFAULT ''`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN zone_name TEXT DEFAULT ''`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN vol_type TEXT DEFAULT ''`, () => {});
      db.run(`ALTER TABLE storage_audit_records ADD COLUMN total_cubic_feet REAL DEFAULT 0`, () => {});

      db.run(`CREATE TABLE IF NOT EXISTS system_config (config_key TEXT PRIMARY KEY, config_value TEXT)`);

      db.get(`SELECT COUNT(*) as cnt FROM storage_placement_rules`, [], (err, row) => {
        if (!err && row && row.cnt === 0) {
          const stmt = db.prepare(`
            INSERT INTO storage_placement_rules
            (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_targets, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALL', '[]', '[]', '[]', '[]', ?, ?, 1, ?)
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
          const parsed = JSON.parse(row.config_value);
          return cb({
            ...DEFAULT_MODE_SETTINGS,
            ...parsed,
            sku_groups: Array.isArray(parsed.sku_groups) && parsed.sku_groups.length > 0
              ? parsed.sku_groups
              : DEFAULT_SKU_GROUPS
          });
        } catch (e) {}
      }
      cb({ ...DEFAULT_MODE_SETTINGS, sku_groups: DEFAULT_SKU_GROUPS });
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
    const clean = String(binCode || '').trim().toUpperCase().replace(/^80-/, '80');
    const m = clean.match(/^80([A-Z0-9]{3})(\d{2,3})([A-Z]?)$/);
    if (m) {
      const x = m[1];
      const y = parseInt(m[2], 10);
      const layer = m[3] || 'A';
      const subX = `${x}${String(y).padStart(2, '0')}`;
      return { x, y, layer, subX };
    }
    return null;
  }

  function compareX(val, start, end) {
    if (!val || !start || !end) return false;
    if (start === end) return val === start;
    const mVal = val.match(/^([A-Z0-9]+?)(\d+)$/);
    const mStart = start.match(/^([A-Z0-9]+?)(\d+)$/);
    const mEnd = end.match(/^([A-Z0-9]+?)(\d+)$/);
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
        const is5CharRule = r.x_start.length >= 5 || r.x_end.length >= 5;
        const targetX = is5CharRule ? parsed.subX : parsed.x;
        if (!compareX(targetX, r.x_start, r.x_end)) continue;

        if (!is5CharRule) {
          const yStart = parseInt(r.y_start || '0', 10);
          const yEnd = parseInt(r.y_end || '999', 10);
          if (parsed.y < yStart || parsed.y > yEnd) continue;
        }
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

  function parseRuleAllowedTargets(rule) {
    let targets = [];
    try {
      const raw = typeof rule.allowed_targets === 'string'
        ? JSON.parse(rule.allowed_targets || '[]')
        : (rule.allowed_targets || []);
      if (Array.isArray(raw)) targets = [...raw];
    } catch (e) {}

    if (targets.length === 0) {
      let cats = [];
      try {
        cats = typeof rule.allowed_categories === 'string'
          ? JSON.parse(rule.allowed_categories || '[]')
          : (rule.allowed_categories || []);
      } catch (e) {}
      if (Array.isArray(cats) && cats.length > 0) {
        targets = cats.map(c => `CAT:|${c}`);
      }
    }
    return targets;
  }

  function formatTargetDisplay(token) {
    const str = String(token || '');
    if (str.startsWith('GROUP:')) return `【專區】${str.slice(6)}`;
    if (str.startsWith('ZONE:')) {
      const [code, name] = str.slice(5).split('|');
      return code ? `【區】${code}-${name || ''}` : `【區】${name || ''}`;
    }
    if (str.startsWith('CAT:')) {
      const [code, name] = str.slice(4).split('|');
      return code ? `【大區】${code}-${name || ''}` : `【大區】${name || ''}`;
    }
    return str;
  }

  function loadAuditRecordsWithSales(cb) {
    db.all(`SELECT * FROM storage_audit_records`, [], (dErr, records) => {
      if (dErr) return cb(dErr, []);
      db.get(`SELECT imported_at FROM import_logs WHERE module_type = '80' ORDER BY id DESC LIMIT 1`, [], (lErr, latestLog) => {
        db.all(
          `SELECT item_id, item_name, borrow_proc, location, qty, zone_id, zone_name, floor, floor_zone, loc_type, big_zone_id, big_zone, vol_type, vol_check, cubic_feet, total_cubic_feet, monthly_sales, pick_days_m, assigned_floor, remark FROM inventory`,
          [],
          (iErr, invRows) => {
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

            let auditBatchMs = 0;
            if (records && records.length > 0 && records[0].batch_id) {
              const m = String(records[0].batch_id).match(/^batch_(\d+)$/);
              if (m) auditBatchMs = Number(m[1]);
            }
            let mainImportMs = 0;
            if (latestLog && latestLog.imported_at) {
              const parsedMs = Date.parse(latestLog.imported_at.replace(' ', 'T') + 'Z');
              if (!Number.isNaN(parsedMs)) mainImportMs = parsedMs;
            }

            const shouldUseMainInventory =
              (invRows && invRows.length > 0) &&
              (!records || records.length === 0 || (mainImportMs > 0 && mainImportMs > auditBatchMs));

            if (shouldUseMainInventory) {
              const mapped = invRows
                .filter(iv => iv.item_id && iv.location)
                .map((iv, idx) => {
                  const totalCf = Number(iv.total_cubic_feet || 0) > 0
                    ? Number(iv.total_cubic_feet)
                    : Number((Number(iv.cubic_feet || 0) * Number(iv.qty || 0)).toFixed(2));
                  return {
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
                    zone_id: iv.zone_id || '',
                    zone_name: iv.zone_name || '',
                    vol_type: iv.vol_type || '',
                    volume_type: iv.vol_check || '',
                    total_cubic_feet: totalCf,
                    monthly_sales: Number(iv.monthly_sales || 0),
                    pick_days_m: Number(iv.pick_days_m || 0),
                    assigned_floor: iv.assigned_floor || '',
                    note: iv.remark || ''
                  };
                });
              return cb(null, mapped);
            }

            const enriched = (records || []).map(rec => {
              const exact = invByBinSku.get(`${rec.sku_id}|${String(rec.bin_code || '').toUpperCase()}`);
              let ms = Number(rec.monthly_sales || 0);
              let pd = Number(rec.pick_days_m || 0);
              if (ms === 0 && pd === 0) {
                if (exact) {
                  ms = Number(exact.monthly_sales || 0);
                  pd = Number(exact.pick_days_m || 0);
                } else if (invSalesBySku.has(rec.sku_id)) {
                  const fallback = invSalesBySku.get(rec.sku_id);
                  ms = fallback.ms;
                  pd = fallback.pd;
                }
              }
              const totalCf = Number(rec.total_cubic_feet || 0) > 0
                ? Number(rec.total_cubic_feet)
                : (exact
                    ? (Number(exact.total_cubic_feet || 0) > 0
                        ? Number(exact.total_cubic_feet)
                        : Number((Number(exact.cubic_feet || 0) * Number(rec.qty || 0)).toFixed(2)))
                    : 0);

              return {
                ...rec,
                zone_id: rec.zone_id || (exact ? exact.zone_id || '' : ''),
                zone_name: rec.zone_name || (exact ? exact.zone_name || '' : ''),
                vol_type: rec.vol_type || (exact ? exact.vol_type || '' : ''),
                total_cubic_feet: totalCf,
                monthly_sales: ms,
                pick_days_m: pd,
                assigned_floor: exact ? exact.assigned_floor || '' : ''
              };
            });

            cb(null, enriched);
          }
        );
      });
    });
  }

  // 0. 讀取 / 儲存參數設定（僅 sys_admin 可寫入）
  router.get('/mode-settings', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        res.json({ success: true, settings });
      });
    });
  });

  router.post('/mode-settings/save', requireSysAdmin, (req, res) => {
    const incoming = req.body.settings || {};
    const cleanGroups = Array.isArray(incoming.sku_groups)
      ? incoming.sku_groups
          .filter(g => g && String(g.name || '').trim())
          .map(g => ({
            name: String(g.name).trim(),
            skus: Array.from(new Set((Array.isArray(g.skus) ? g.skus : []).map(s => String(s).trim()).filter(Boolean)))
          }))
      : DEFAULT_SKU_GROUPS;

    const clean = {
      mode: ['CAT_TRADE', 'SALES_TRADE', 'CAT_SALES_TRADE'].includes(incoming.mode) ? incoming.mode : 'CAT_TRADE',
      tierA_min: Math.max(1, Number(incoming.tierA_min || 50)),
      tierB_min: Math.max(1, Number(incoming.tierB_min || 10)),
      tierC_min: Math.max(1, Number(incoming.tierC_min || 1)),
      sku_groups: cleanGroups
    };
    db.run(
      `INSERT INTO system_config (config_key, config_value) VALUES ('storage_accuracy_mode_settings', ?)
       ON CONFLICT(config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
      [JSON.stringify(clean)],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, settings: clean, message: '🎉 參數設定（月銷門檻與商品ID專區）已儲存！' });
      }
    );
  });

  // 0.5 取得下拉選單選項（商品ID+名稱、區編+區名、大區編+大區名）
  router.get('/lookup-options', (req, res) => {
    ensureTables(() => {
      loadAuditRecordsWithSales((err, records) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const skuMap = new Map();
        const zoneMap = new Map();
        const catMap = new Map();

        (records || []).forEach(r => {
          const sku = String(r.sku_id || '').trim();
          const sName = String(r.sku_name || '').trim();
          if (sku && !skuMap.has(sku)) {
            skuMap.set(sku, { sku_id: sku, sku_name: sName, label: sName ? `${sku} - ${sName}` : sku });
          }

          const zId = String(r.zone_id || '').trim();
          const zName = String(r.zone_name || '').trim();
          if (zId || zName) {
            const zKey = `${zId}|${zName}`;
            if (!zoneMap.has(zKey)) {
              zoneMap.set(zKey, {
                token: `ZONE:${zKey}`,
                zone_id: zId,
                zone_name: zName,
                label: zId && zName ? `${zId} - ${zName}` : (zId || zName)
              });
            }
          }

          const cId = String(r.cat_code || '').trim();
          const cName = String(r.cat_name || '').trim();
          if (cId || cName) {
            const cKey = `${cId}|${cName}`;
            if (!catMap.has(cKey)) {
              catMap.set(cKey, {
                token: `CAT:${cKey}`,
                cat_code: cId,
                cat_name: cName,
                label: cId && cName ? `${cId} - ${cName}` : (cId || cName)
              });
            }
          }
        });

        res.json({
          success: true,
          skus: Array.from(skuMap.values()).sort((a, b) => a.sku_id.localeCompare(b.sku_id)),
          zones: Array.from(zoneMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
          categories: Array.from(catMap.values()).sort((a, b) => a.label.localeCompare(b.label))
        });
      });
    });
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
          const targets = parseRuleAllowedTargets(r);
          const zoneRole = VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK';
          return {
            ...r,
            allowed_categories: cats,
            allowed_targets: targets,
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

  // 2. 儲存 / 更新單條規則（僅 sys_admin 可寫入）
  router.post('/rules/save', requireSysAdmin, (req, res) => {
    const rule = req.body.rule;
    if (!rule || !rule.zone_name || !rule.floor || !rule.x_start) {
      return res.status(400).json({ success: false, message: '請填寫區域名稱、樓層與 X 軸排號' });
    }
    const xStart = String(rule.x_start).trim().toUpperCase();
    const xEnd = String(rule.x_end || rule.x_start).trim().toUpperCase();
    const targetsArr = Array.isArray(rule.allowed_targets) ? rule.allowed_targets : [];
    const legacyCats = targetsArr
      .filter(t => String(t).startsWith('CAT:'))
      .map(t => String(t).slice(4).split('|')[1] || String(t).slice(4).split('|')[0])
      .filter(Boolean);
    const catsJson = JSON.stringify(legacyCats.length > 0 ? legacyCats : (rule.allowed_categories || []));
    const targetsJson = JSON.stringify(targetsArr);
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
          allowed_trade = ?, allowed_categories = ?, allowed_targets = ?, allowed_volumes = ?, allowed_sales_tiers = ?,
          rack_length_m = ?, zone_role = ?, enabled = ?, remark = ?
        WHERE id = ?
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, targetsJson, volsJson, tiersJson,
        rackLen, zoneRole, enabledInt, rule.remark || '', rule.id
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    } else {
      db.run(`
        INSERT INTO storage_placement_rules
        (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_targets, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, remark, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        xStart, xEnd,
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, targetsJson, volsJson, tiersJson,
        rackLen, zoneRole, enabledInt, rule.remark || ''
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    }
  });

  // 3. 把「區間規則」展開成單條 X 軸（僅 sys_admin 可寫入）
  router.post('/rules/expand', requireSysAdmin, (req, res) => {
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
              (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_targets, allowed_volumes, allowed_sales_tiers, rack_length_m, zone_role, enabled, remark, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              `${r.zone_name}-${xCode}`, r.floor, r.storage_type, r.area,
              xCode, xCode, r.y_start, r.y_end, r.layer_start, r.layer_end,
              r.allowed_trade, r.allowed_categories, r.allowed_targets || '[]', r.allowed_volumes, r.allowed_sales_tiers || '[]',
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

  // 4. 刪除單條規則（僅 sys_admin 可寫入）
  router.post('/rules/delete', requireSysAdmin, (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM storage_placement_rules WHERE id = ?`, [id], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true });
    });
  });

  // 5. 接收前端分批上傳的 80 庫 CSV 明細快照（僅 sys_admin 可寫入）
  router.post('/audit/upload-chunk', requireSysAdmin, (req, res) => {
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
          (batch_id, sku_id, sku_name, trade_type, bin_code, qty, floor, area, storage_type, cat_code, cat_name, zone_id, zone_name, vol_type, volume_type, total_cubic_feet, monthly_sales, pick_days_m, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            r.zone_id || '',
            r.zone_name || '',
            r.vol_type || '',
            r.volume_type || '',
            Number(r.total_cubic_feet || 0),
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

  // 6. 依據順位（第一順位：借/採 -> 第二順位：商品ID**區 > 區名 > 大區名 -> 第三順位：月銷量級距）計算準確率
  router.get('/audit/report', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        const activeMode = req.query.mode || settings.mode || 'CAT_TRADE';

        const skuToGroupsMap = new Map();
        (settings.sku_groups || []).forEach(g => {
          const gName = String(g.name || '').trim();
          if (!gName) return;
          (g.skus || []).forEach(sku => {
            const cleanSku = String(sku || '').trim();
            if (!cleanSku) return;
            if (!skuToGroupsMap.has(cleanSku)) skuToGroupsMap.set(cleanSku, new Set());
            skuToGroupsMap.get(cleanSku).add(gName);
          });
        });

        db.all(`SELECT * FROM storage_placement_rules WHERE enabled = 1`, [], (rErr, ruleRows) => {
          if (rErr) return res.status(500).json({ success: false, message: rErr.message });

          db.all(`SELECT floor, zone, loc_type, cubic_feet, grid_count, single_cubic_feet FROM locations_master`, [], (mErr, masterRows) => {
            const rules = (ruleRows || []).map(r => {
              let cats = [], vols = [], tiers = [];
              try { cats = JSON.parse(r.allowed_categories || '[]'); } catch (e) {}
              try { vols = JSON.parse(r.allowed_volumes || '[]'); } catch (e) {}
              try { tiers = JSON.parse(r.allowed_sales_tiers || '[]'); } catch (e) {}
              const targets = parseRuleAllowedTargets(r);
              const isSingleX = r.x_start === r.x_end;
              const is5CharSingle = isSingleX && String(r.x_start).length >= 5;
              const specificity = is5CharSingle ? 2 : (isSingleX ? 1 : 0);

              return {
                ...r,
                allowed_categories: cats,
                allowed_targets: targets,
                allowed_volumes: vols,
                allowed_sales_tiers: tiers,
                rack_length_m: Number(r.rack_length_m || 20),
                zone_role: VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK',
                _specificity: specificity
              };
            }).sort((a, b) => b._specificity - a._specificity || a.id - b.id);

            const openRules = rules.filter(r => r.zone_role !== 'CLOSED');
            const { floorHasBaseType, pickBestAvailableOnFloor } = buildFloorRackInventory(masterRows || [], openRules);

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

              const targetTokenMap = {};
              const tierTargetMap = {};
              const allOpenTargets = [];

              openRules.forEach(r => {
                const xLabel = r.x_start === r.x_end ? r.x_start : `${r.x_start}~${r.x_end}`;
                const roleTag = `[${formatZoneRoleLabel(r.zone_role)}]`;
                const areaStr = r.area ? `${r.area}區` : '';
                const label = `${r.floor} ${areaStr} ${xLabel}${roleTag}${r.allowed_trade !== 'ALL' ? '(' + r.allowed_trade + ')' : ''}`.replace(/\s+/g, ' ');
                const targetObj = {
                  floor: r.floor || '',
                  area: areaStr,
                  xLabel,
                  baseRackType: normalizeBaseRackType(r.storage_type),
                  allowedTrade: r.allowed_trade || 'ALL',
                  label
                };
                allOpenTargets.push(targetObj);

                r.allowed_targets.forEach(tok => {
                  if (!targetTokenMap[tok]) targetTokenMap[tok] = [];
                  if (!targetTokenMap[tok].some(t => t.label === label)) targetTokenMap[tok].push(targetObj);
                });

                if (r.allowed_sales_tiers.length > 0) {
                  r.allowed_sales_tiers.forEach(t => {
                    if (!tierTargetMap[t]) tierTargetMap[t] = [];
                    if (!tierTargetMap[t].some(item => item.label === label)) tierTargetMap[t].push(targetObj);
                  });
                }
              });

              const checkTargetTokenMatch = (token, rec, itemGroups) => {
                const str = String(token || '');
                if (str.startsWith('GROUP:')) {
                  const gName = str.slice(6);
                  return itemGroups ? itemGroups.has(gName) : false;
                }
                if (str.startsWith('ZONE:')) {
                  const [zCode, zName] = str.slice(5).split('|');
                  const recZCode = String(rec.zone_id || '').trim();
                  const recZName = String(rec.zone_name || '').trim();
                  if (zCode && recZCode) return zCode === recZCode;
                  return Boolean(zName && zName === recZName);
                }
                if (str.startsWith('CAT:')) {
                  const [cCode, cName] = str.slice(4).split('|');
                  const recCCode = String(rec.cat_code || '').trim();
                  const recCName = String(rec.cat_name || '').trim();
                  if (cCode && recCCode) return cCode === recCCode;
                  return Boolean(cName && cName === recCName);
                }
                return false;
              };

              records.forEach(rec => {
                const salesTier = classifySalesTier(rec.monthly_sales, settings);
                const matchedRule = matchRuleForRecord(rec, rules);
                const zoneRole = matchedRule ? matchedRule.zone_role : 'PICK';
                const itemGroups = skuToGroupsMap.get(String(rec.sku_id || '').trim()) || null;

                const isClosedZone = zoneRole === 'CLOSED';
                const ruleTargets = matchedRule ? matchedRule.allowed_targets : [];
                const hasActiveConstraint = Boolean(
                  (itemGroups && itemGroups.size > 0) ||
                  (matchedRule && (
                    isClosedZone ||
                    (matchedRule.allowed_trade && matchedRule.allowed_trade !== 'ALL') ||
                    ruleTargets.length > 0 ||
                    (matchedRule.allowed_sales_tiers && matchedRule.allowed_sales_tiers.length > 0) ||
                    (matchedRule.allowed_volumes && matchedRule.allowed_volumes.length > 0)
                  ))
                );

                let isOk = true;
                const reasons = [];

                if (hasActiveConstraint) {
                  audited++;

                  if (isClosedZone) {
                    isOk = false;
                    reasons.push(`🚫 區域「關閉中」：該儲位已停用關閉，禁止存放庫存（現有 ${rec.qty} 件需立即移出）`);
                  } else {
                    let step1Passed = true;
                    if (matchedRule && matchedRule.allowed_trade && matchedRule.allowed_trade !== 'ALL') {
                      if (!rec.trade_type || matchedRule.allowed_trade !== rec.trade_type) {
                        isOk = false;
                        step1Passed = false;
                        reasons.push(`【第一順位】借/採不符：限放「${matchedRule.allowed_trade}」，實際「${rec.trade_type || '未標示'}」`);
                      }
                    }

                    let step2Passed = true;
                    if (step1Passed) {
                      if (itemGroups && itemGroups.size > 0) {
                        const groupList = Array.from(itemGroups);
                        const allowedByGroup = ruleTargets.some(
                          tok => tok.startsWith('GROUP:') && itemGroups.has(tok.slice(6))
                        );
                        if (!allowedByGroup) {
                          isOk = false;
                          step2Passed = false;
                          reasons.push(`【第二順位】商品ID專區不符：此商品限定放置於[${groupList.join('、')}]`);
                        }
                      } else if (ruleTargets.length > 0) {
                        const matchedAnyTarget = ruleTargets.some(tok => checkTargetTokenMatch(tok, rec, itemGroups));
                        if (!matchedAnyTarget) {
                          isOk = false;
                          step2Passed = false;
                          const allowedNames = ruleTargets.map(formatTargetDisplay).join('、');
                          const actualInfo = [
                            rec.zone_id || rec.zone_name ? `區:${rec.zone_id}-${rec.zone_name}` : '',
                            rec.cat_code || rec.cat_name ? `大區:${rec.cat_code}-${rec.cat_name}` : ''
                          ].filter(Boolean).join(' / ') || '未分類';
                          reasons.push(`【第二順位】專區/區名/大區不符：限放[${allowedNames}]，實際「${actualInfo}」`);
                        }
                      }
                    }

                    if (step1Passed && step2Passed && matchedRule && matchedRule.allowed_sales_tiers.length > 0) {
                      if (!matchedRule.allowed_sales_tiers.includes(salesTier)) {
                        const allowedLabels = matchedRule.allowed_sales_tiers.map(formatTierLabel).join('、');
                        isOk = false;
                        reasons.push(`【第三順位】月銷不符：限放[${allowedLabels}]，實際「${formatTierLabel(salesTier)}(月銷${rec.monthly_sales})」`);
                      }
                    }

                    if (matchedRule && matchedRule.allowed_volumes.length > 0 && rec.volume_type && !matchedRule.allowed_volumes.includes(rec.volume_type)) {
                      isOk = false;
                      reasons.push(`材積不符：限放[${matchedRule.allowed_volumes.join('、')}]，實際「${rec.volume_type}」`);
                    }
                  }
                }

                const parsed = parseBinCode(rec.bin_code);

                if (isOk) passed++;
                else {
                  failed++;
                  if (exceptions.length < 5000) {
                    const totalCf = Number(rec.total_cubic_feet || 0);
                    const idealSpec = classifyRackSpecByCubicFeet(totalCf);

                    let targetObjs = [];
                    if (itemGroups && itemGroups.size > 0) {
                      itemGroups.forEach(gName => {
                        const tok = `GROUP:${gName}`;
                        if (targetTokenMap[tok]) targetObjs = targetObjs.concat(targetTokenMap[tok]);
                      });
                    } else {
                      const zTok = `ZONE:${rec.zone_id || ''}|${rec.zone_name || ''}`;
                      const cTok = `CAT:${rec.cat_code || ''}|${rec.cat_name || ''}`;
                      if (targetTokenMap[zTok]) targetObjs = targetObjs.concat(targetTokenMap[zTok]);
                      if (targetTokenMap[cTok]) targetObjs = targetObjs.concat(targetTokenMap[cTok]);
                      if (tierTargetMap[salesTier]) targetObjs = targetObjs.concat(tierTargetMap[salesTier]);
                    }

                    const tradeMatchedTargets = targetObjs.filter(
                      t => t.allowedTrade === 'ALL' || !rec.trade_type || t.allowedTrade === rec.trade_type
                    );
                    const candidatePool = tradeMatchedTargets.length > 0 ? tradeMatchedTargets : targetObjs;

                    const uniqueTargets = [];
                    const seenLabels = new Set();
                    candidatePool.forEach(t => {
                      if (!seenLabels.has(t.label)) {
                        seenLabels.add(t.label);
                        uniqueTargets.push(t);
                      }
                    });

                    const targetWithMatchingRack = uniqueTargets.find(
                      t => t.baseRackType === idealSpec.baseType || floorHasBaseType(t.floor, idealSpec.baseType)
                    );

                    let primaryTarget = targetWithMatchingRack || uniqueTargets[0] || null;
                    let suggestedFloor = '';
                    let suggestedArea = '';
                    let finalRackType = idealSpec.label;

                    if (primaryTarget) {
                      suggestedFloor = primaryTarget.floor;
                      suggestedArea = primaryTarget.area || '依規則/動線分配';
                      if (!floorHasBaseType(suggestedFloor, idealSpec.baseType)) {
                        finalRackType = pickBestAvailableOnFloor(suggestedFloor, totalCf, idealSpec);
                      }
                    } else if (itemGroups && itemGroups.size > 0) {
                      suggestedFloor = '尚未設定專區儲位';
                      suggestedArea = Array.from(itemGroups).join('、');
                    } else {
                      const fallbackRackTarget = allOpenTargets.find(
                        t => (t.allowedTrade === 'ALL' || !rec.trade_type || t.allowedTrade === rec.trade_type) &&
                             (t.baseRackType === idealSpec.baseType || floorHasBaseType(t.floor, idealSpec.baseType))
                      );
                      if (fallbackRackTarget) {
                        suggestedFloor = fallbackRackTarget.floor;
                        suggestedArea = fallbackRackTarget.area || '開放撿貨區/庫區';
                      } else {
                        suggestedFloor = rec.assigned_floor || (salesTier === 'A' ? '7F' : '6F');
                        suggestedArea = '開放撿貨區/庫區';
                        if (!floorHasBaseType(suggestedFloor, idealSpec.baseType)) {
                          finalRackType = pickBestAvailableOnFloor(suggestedFloor, totalCf, idealSpec);
                        }
                      }
                    }

                    const prioritizedTargets = targetWithMatchingRack
                      ? [targetWithMatchingRack, ...uniqueTargets.filter(t => t.label !== targetWithMatchingRack.label)]
                      : uniqueTargets;
                    const suggested = prioritizedTargets.slice(0, 2).map(t => t.label).join(' 或 ') || '請移往符合規則的開放儲位';

                    exceptions.push({
                      sku_id: rec.sku_id,
                      sku_name: rec.sku_name,
                      trade_type: rec.trade_type,
                      cat_code: rec.cat_code || '',
                      cat_name: rec.cat_name || '',
                      zone_id: rec.zone_id || '',
                      zone_name: rec.zone_name || (matchedRule ? matchedRule.zone_name : '未定義區段'),
                      vol_type: rec.vol_type || rec.volume_type || '',
                      total_cubic_feet: Number(totalCf.toFixed(2)),
                      monthly_sales: rec.monthly_sales,
                      sales_tier: salesTier,
                      sales_tier_label: formatTierLabel(salesTier),
                      volume_type: rec.volume_type,
                      floor: rec.floor,
                      area: rec.area,
                      bin_code: rec.bin_code,
                      x_code: parsed ? parsed.x : '',
                      sub_x_code: parsed ? parsed.subX : '',
                      qty: rec.qty,
                      zone_role: zoneRole,
                      zone_role_label: formatZoneRoleLabel(zoneRole),
                      reason: reasons.join('；'),
                      suggested_floor: suggestedFloor,
                      suggested_area: suggestedArea,
                      suggested_rack_type: finalRackType,
                      suggested_zone: suggested
                    });
                  }
                }

                if (parsed) {
                  const rawFl = String(rec.floor || '').trim();
                  const baseFloor = rawFl
                    ? (rawFl.startsWith('2F') ? '2F' : rawFl)
                    : (parsed.x.startsWith('C2') ? '2F' : '');

                  if (baseFloor) {
                    const keys = [parsed.x];
                    if (parsed.subX && parsed.subX !== parsed.x) keys.push(parsed.subX);

                    keys.forEach(kCode => {
                      const xKey = `${baseFloor}|${kCode}`;
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
                    });
                  }
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
  });

  // 7. 三種擺放模式實際步行公尺(m)與找貨效益精算分析
  router.get('/audit/simulate-modes', (req, res) => {
    ensureTables(() => {
      getModeSettings((settings) => {
        db.all(`SELECT * FROM storage_placement_rules WHERE enabled = 1`, [], (rErr, ruleRows) => {
          const rules = (ruleRows || []).map(r => {
            const isSingleX = r.x_start === r.x_end;
            const is5CharSingle = isSingleX && String(r.x_start).length >= 5;
            return {
              ...r,
              rack_length_m: Number(r.rack_length_m || 20),
              zone_role: VALID_ZONE_ROLES.includes(r.zone_role) ? r.zone_role : 'PICK',
              _specificity: is5CharSingle ? 2 : (isSingleX ? 1 : 0)
            };
          }).sort((a, b) => b._specificity - a._specificity || a.id - b.id);

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

  // 8. 一鍵自動學習（僅 sys_admin 可寫入）
  router.post('/rules/auto-suggest', requireSysAdmin, (req, res) => {
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
                if (rec.cat_code || rec.cat_name) {
                  const tok = `CAT:${rec.cat_code || ''}|${rec.cat_name || ''}`;
                  if (!zoneCatCounts[matched.id]) zoneCatCounts[matched.id] = {};
                  zoneCatCounts[matched.id][tok] = (zoneCatCounts[matched.id][tok] || 0) + 1;
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
                const majorTokens = Object.entries(counts)
                  .filter(([, cnt]) => cnt / totalInZone >= 0.15)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tok]) => tok);

                const tCounts = zoneTierCounts[ruleId] || {};
                const totalT = Object.values(tCounts).reduce((a, b) => a + b, 0);
                const majorTiers = Object.entries(tCounts)
                  .filter(([, cnt]) => cnt / totalT >= 0.15)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([t]) => t);

                db.run(
                  `UPDATE storage_placement_rules SET allowed_targets = ?, allowed_sales_tiers = ? WHERE id = ?`,
                  [JSON.stringify(majorTokens), JSON.stringify(majorTiers), Number(ruleId)]
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