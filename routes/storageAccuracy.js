// routes/storageAccuracy.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // 依據你們 80 庫儲位區段對照表建立的初始主檔（46 個標準區段）
  const DEFAULT_ZONE_ZONES = [
    { zone_name: '80D-B區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'A01', x_end: 'A06', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80D-B區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'A06', x_end: 'A08', y_start: '043', y_end: '072', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'A01', x_end: 'A06', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80D-C區', floor: '2F西', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'A07', x_end: 'A08', y_start: '005', y_end: '034', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80C2A', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'A', x_start: 'C2A', x_end: 'C2A', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80C2B', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'C2B', x_end: 'C2B', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80C2C', floor: '2F東', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'C2C', x_end: 'C2C', y_start: '002', y_end: '056', layer_start: 'A', layer_end: 'I' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'E05', x_end: 'E07', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'E08', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'E05', x_end: 'E07', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80E-B區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'E08', x_end: 'E08', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'E01', x_end: 'E01', y_start: '002', y_end: '038', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'E02', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'E01', x_end: 'E01', y_start: '002', y_end: '038', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80E-C區', floor: '3F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'E02', x_end: 'E04', y_start: '001', y_end: '039', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '中型層架(格)', wh: '80', area: 'B', x_start: 'H01', x_end: 'H17', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80H(貴重區)', floor: '4F', storage_type: '小藍格', wh: '80', area: 'B', x_start: 'H18', x_end: 'H18', y_start: '001', y_end: '028', layer_start: 'A', layer_end: 'G' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'K01', x_end: 'K05', y_start: '061', y_end: '092', layer_start: 'C', layer_end: 'C' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'K01', x_end: 'K05', y_start: '061', y_end: '092', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'B', x_start: 'L61', x_end: 'L84', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80K、L-B區', floor: '6F', storage_type: '落地儲位', wh: '80', area: 'B', x_start: 'K01', x_end: 'K05', y_start: '061', y_end: '092', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'K01', x_end: 'K05', y_start: '027', y_end: '058', layer_start: 'C', layer_end: 'C' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'K01', x_end: 'K05', y_start: '027', y_end: '058', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'C', x_start: 'L31', x_end: 'L60', y_start: '001', y_end: '005', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80K、L-C區', floor: '6F', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'K01', x_end: 'K05', y_start: '027', y_end: '058', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L01', x_end: 'L26', y_start: '001', y_end: '060', layer_start: 'D', layer_end: 'E' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架-紙抽', wh: '80', area: 'D', x_start: 'L01', x_end: 'L26', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架', wh: '80', area: 'D', x_start: 'L27', x_end: 'L30', y_start: '001', y_end: '060', layer_start: 'G', layer_end: 'G' },
    { zone_name: '80L-D區', floor: '6F', storage_type: 'AGV層架-紙抽', wh: '80', area: 'D', x_start: 'L27', x_end: 'L30', y_start: '001', y_end: '060', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80M01-53(第一段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '001', y_end: '049', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80M01-53(第一段)', floor: '7F', storage_type: 'AGV層架-紙抽', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '001', y_end: '052', layer_start: 'B', layer_end: 'C' },
    { zone_name: '80M01-53(第二段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M03', x_end: 'M53', y_start: '056', y_end: '067', layer_start: 'A', layer_end: 'F' },
    { zone_name: '80M01-53(第三段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M01', x_end: 'M53', y_start: '068', y_end: '079', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80M01-53(第四段)', floor: '7F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'M43', x_end: 'M53', y_start: '080', y_end: '094', layer_start: 'A', layer_end: 'E' },
    { zone_name: '80O(貴重區)', floor: '7F', storage_type: '鐵櫃', wh: '80', area: 'A', x_start: 'O01', x_end: 'O01', y_start: '001', y_end: '027', layer_start: 'A', layer_end: 'L' },
    { zone_name: '80N55-69(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'A', x_start: 'N55', x_end: 'N69', y_start: '052', y_end: '075', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80N55-69(重型架)', floor: '7F', storage_type: '重型層架-低', wh: '80', area: 'A', x_start: 'N55', x_end: 'N69', y_start: '052', y_end: '075', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80N35-53(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'N35', x_end: 'N53', y_start: '027', y_end: '075', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80N35-53(重型架)', floor: '7F', storage_type: '重型層架-低', wh: '80', area: 'B', x_start: 'N35', x_end: 'N53', y_start: '027', y_end: '075', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80N015-33(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'N15', x_end: 'N33', y_start: '001', y_end: '075', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80N015-33(重型架)', floor: '7F', storage_type: '重型層架-低', wh: '80', area: 'C', x_start: 'N15', x_end: 'N33', y_start: '001', y_end: '075', layer_start: 'A', layer_end: 'B' },
    { zone_name: '80N34', floor: '7F', storage_type: '落地儲位', wh: '80', area: 'C', x_start: 'N34', x_end: 'N34', y_start: '001', y_end: '044', layer_start: 'A', layer_end: 'A' },
    { zone_name: '80S01-05(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'S01', x_end: 'S05', y_start: '001', y_end: '049', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80N01-14(重型架)', floor: '7F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'N01', x_end: 'N14', y_start: '001', y_end: '068', layer_start: 'C', layer_end: 'E' },
    { zone_name: '80R-A區', floor: '8F', storage_type: 'AGV層架', wh: '80', area: 'A', x_start: 'R11', x_end: 'R42', y_start: '001', y_end: '056', layer_start: 'C', layer_end: 'F' },
    { zone_name: '80R、Q-B區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'B', x_start: 'R01', x_end: 'R05', y_start: '063', y_end: '098', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80R、Q-C區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'C', x_start: 'R01', x_end: 'R05', y_start: '027', y_end: '062', layer_start: 'A', layer_end: 'C' },
    { zone_name: '80R、Q-D區', floor: '8F', storage_type: '重型層架', wh: '80', area: 'D', x_start: 'R01', x_end: 'R05', y_start: '001', y_end: '026', layer_start: 'A', layer_end: 'C' }
  ];

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
          enabled INTEGER DEFAULT 1,
          remark TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        )
      `);

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
          note TEXT DEFAULT ''
        )
      `);

      db.get(`SELECT COUNT(*) as cnt FROM storage_placement_rules`, [], (err, row) => {
        if (!err && row && row.cnt === 0) {
          const stmt = db.prepare(`
            INSERT INTO storage_placement_rules
            (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, enabled, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALL', '[]', '[]', 1, ?)
          `);
          DEFAULT_ZONE_ZONES.forEach((z, idx) => {
            stmt.run(z.zone_name, z.floor, z.storage_type, z.area, z.x_start, z.x_end, z.y_start, z.y_end, z.layer_start, z.layer_end, idx);
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

  // 解析儲位編碼，例如 "80M22078D" -> { x: "M22", y: 78, layer: "D" }
  function parseBinCode(binCode) {
    const clean = String(binCode || '').trim().toUpperCase();
    // 常見格式：80 + 3碼X軸(如M22/C2A) + 3碼Y軸(如078) + 1碼層(如D)
    const m = clean.match(/^80([A-Z0-9]{3})(\d{3})([A-Z])$/);
    if (m) {
      return { x: m[1], y: parseInt(m[2], 10), layer: m[3] };
    }
    const m2 = clean.match(/^80([A-Z0-9]{3})(\d{3})/);
    if (m2) {
      return { x: m2[1], y: parseInt(m2[2], 10), layer: 'A' };
    }
    return null;
  }

  function compareX(val, start, end) {
    if (!val || !start || !end) return false;
    // 若同為英文字母開頭+數字（如 M01 ~ M53），比較前綴與數字大小
    const mVal = val.match(/^([A-Z]+)(\d+)$/);
    const mStart = start.match(/^([A-Z]+)(\d+)$/);
    const mEnd = end.match(/^([A-Z]+)(\d+)$/);
    if (mVal && mStart && mEnd) {
      if (mVal[1] !== mStart[1] && mVal[1] !== mEnd[1]) {
        return val >= start && val <= end;
      }
      const nVal = parseInt(mVal[2], 10);
      const nStart = parseInt(mStart[2], 10);
      const nEnd = parseInt(mEnd[2], 10);
      return mVal[1] === mStart[1] && nVal >= nStart && nVal <= nEnd;
    }
    return val >= start && val <= end;
  }

  function matchRuleForRecord(rec, rules) {
    const parsed = parseBinCode(rec.bin_code);
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (r.floor && rec.floor && r.floor !== rec.floor) continue;
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

  // 1. 取得所有儲位擺放規則
  router.get('/rules', (req, res) => {
    ensureTables(() => {
      db.all(`SELECT * FROM storage_placement_rules ORDER BY sort_order ASC, id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const rules = (rows || []).map(r => {
          let cats = [], vols = [];
          try { cats = JSON.parse(r.allowed_categories || '[]'); } catch (e) {}
          try { vols = JSON.parse(r.allowed_volumes || '[]'); } catch (e) {}
          return {
            ...r,
            allowed_categories: cats,
            allowed_volumes: vols,
            enabled: r.enabled === 1
          };
        });
        res.json({ success: true, rules });
      });
    });
  });

  // 2. 儲存 / 更新單條或整批規則
  router.post('/rules/save', (req, res) => {
    const rule = req.body.rule;
    if (!rule || !rule.zone_name || !rule.floor || !rule.x_start || !rule.x_end) {
      return res.status(400).json({ success: false, message: '請填寫區域名稱、樓層與 X 軸起訖' });
    }
    const catsJson = JSON.stringify(rule.allowed_categories || []);
    const volsJson = JSON.stringify(rule.allowed_volumes || []);
    const enabledInt = rule.enabled ? 1 : 0;

    if (rule.id) {
      db.run(`
        UPDATE storage_placement_rules SET
          zone_name = ?, floor = ?, storage_type = ?, area = ?,
          x_start = ?, x_end = ?, y_start = ?, y_end = ?,
          layer_start = ?, layer_end = ?,
          allowed_trade = ?, allowed_categories = ?, allowed_volumes = ?,
          enabled = ?, remark = ?
        WHERE id = ?
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        String(rule.x_start).toUpperCase(), String(rule.x_end).toUpperCase(),
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson,
        enabledInt, rule.remark || '', rule.id
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    } else {
      db.run(`
        INSERT INTO storage_placement_rules
        (zone_name, floor, storage_type, area, x_start, x_end, y_start, y_end, layer_start, layer_end, allowed_trade, allowed_categories, allowed_volumes, enabled, remark, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)
      `, [
        rule.zone_name, rule.floor, rule.storage_type || '', rule.area || '',
        String(rule.x_start).toUpperCase(), String(rule.x_end).toUpperCase(),
        String(rule.y_start || '001').padStart(3, '0'), String(rule.y_end || '999').padStart(3, '0'),
        String(rule.layer_start || 'A').toUpperCase(), String(rule.layer_end || 'Z').toUpperCase(),
        rule.allowed_trade || 'ALL', catsJson, volsJson,
        enabledInt, rule.remark || ''
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    }
  });

  // 3. 刪除單條規則
  router.post('/rules/delete', (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM storage_placement_rules WHERE id = ?`, [id], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true });
    });
  });

  // 4. 接收前端分批上傳的 80 庫 CSV 明細快照
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
          (batch_id, sku_id, sku_name, trade_type, bin_code, qty, floor, area, storage_type, cat_code, cat_name, volume_type, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  // 5. 依據目前線上設定的規則，即時計算最新 80 庫快照的擺放準確率與異常清單
  router.get('/audit/report', (req, res) => {
    ensureTables(() => {
      db.all(`SELECT * FROM storage_placement_rules WHERE enabled = 1 ORDER BY sort_order ASC, id ASC`, [], (rErr, ruleRows) => {
        if (rErr) return res.status(500).json({ success: false, message: rErr.message });

        const rules = (ruleRows || []).map(r => {
          let cats = [], vols = [];
          try { cats = JSON.parse(r.allowed_categories || '[]'); } catch (e) {}
          try { vols = JSON.parse(r.allowed_volumes || '[]'); } catch (e) {}
          return { ...r, allowed_categories: cats, allowed_volumes: vols };
        });

        db.all(`SELECT * FROM storage_audit_records`, [], (dErr, records) => {
          if (dErr) return res.status(500).json({ success: false, message: dErr.message });

          const totalCount = (records || []).length;
          if (totalCount === 0) {
            return res.json({
              success: true,
              hasData: false,
              summary: { total: 0, audited: 0, passed: 0, failed: 0, accuracyPct: 0 },
              byTrade: [],
              byFloor: [],
              byCategory: [],
              exceptions: []
            });
          }

          let audited = 0, passed = 0, failed = 0;
          const tradeStats = {};
          const floorStats = {};
          const catStats = {};
          const exceptions = [];

          // 預先建立「大區 -> 建議儲位區段」對照表，方便在異常明細提示應移往哪裡
          const catTargetMap = {};
          rules.forEach(r => {
            if (r.allowed_categories.length > 0) {
              r.allowed_categories.forEach(c => {
                if (!catTargetMap[c]) catTargetMap[c] = [];
                const label = `${r.floor} ${r.zone_name}(${r.x_start}~${r.x_end}${r.allowed_trade !== 'ALL' ? '/' + r.allowed_trade : ''})`;
                if (!catTargetMap[c].includes(label)) catTargetMap[c].push(label);
              });
            }
          });

          records.forEach(rec => {
            const matchedRule = matchRuleForRecord(rec, rules);
            const hasActiveConstraint = matchedRule && (
              (matchedRule.allowed_trade && matchedRule.allowed_trade !== 'ALL') ||
              (matchedRule.allowed_categories && matchedRule.allowed_categories.length > 0) ||
              (matchedRule.allowed_volumes && matchedRule.allowed_volumes.length > 0)
            );

            // 若該儲位尚未設定任何限制條件，視為免檢/預設合格
            let isOk = true;
            const reasons = [];

            if (hasActiveConstraint) {
              audited++;
              if (matchedRule.allowed_trade !== 'ALL' && rec.trade_type && matchedRule.allowed_trade !== rec.trade_type) {
                isOk = false;
                reasons.push(`借/採不符：此區限放「${matchedRule.allowed_trade}」，實際為「${rec.trade_type}」`);
              }
              if (matchedRule.allowed_categories.length > 0 && rec.cat_name && !matchedRule.allowed_categories.includes(rec.cat_name)) {
                isOk = false;
                reasons.push(`大區不符：此區限放[${matchedRule.allowed_categories.join('、')}]，實際為「${rec.cat_name}」`);
              }
              if (matchedRule.allowed_volumes.length > 0 && rec.volume_type && !matchedRule.allowed_volumes.includes(rec.volume_type)) {
                isOk = false;
                reasons.push(`材積不符：此區限放[${matchedRule.allowed_volumes.join('、')}]，實際為「${rec.volume_type}」`);
              }
            }

            if (isOk) passed++;
            else {
              failed++;
              if (exceptions.length < 3000) {
                const suggested = (catTargetMap[rec.cat_name] || []).slice(0, 2).join(' 或 ') || '請依大區/借採規則調整';
                exceptions.push({
                  sku_id: rec.sku_id,
                  sku_name: rec.sku_name,
                  trade_type: rec.trade_type,
                  cat_name: rec.cat_name,
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
          });

          const toArr = (obj) => Object.values(obj).map(x => ({
            ...x,
            accuracyPct: x.total > 0 ? Number(((x.passed / x.total) * 100).toFixed(2)) : 0
          })).sort((a, b) => b.total - a.total);

          res.json({
            success: true,
            hasData: true,
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
            exceptions
          });
        });
      });
    });
  });

  // 6. 一鍵自動學習：根據目前上傳的 80 庫資料，自動分析各區段的主要大區分布並填入初始規則
  router.post('/rules/auto-suggest', (req, res) => {
    ensureTables(() => {
      db.all(`SELECT * FROM storage_placement_rules`, [], (rErr, rules) => {
        db.all(`SELECT bin_code, floor, area, cat_name FROM storage_audit_records`, [], (dErr, records) => {
          if (!records || records.length === 0) {
            return res.status(400).json({ success: false, message: '請先匯入一份 80 庫 CSV 資料，系統才能自動分析各區大區分布！' });
          }

          const zoneCatCounts = {};
          records.forEach(rec => {
            const matched = matchRuleForRecord(rec, rules);
            if (matched && rec.cat_name) {
              if (!zoneCatCounts[matched.id]) zoneCatCounts[matched.id] = {};
              zoneCatCounts[matched.id][rec.cat_name] = (zoneCatCounts[matched.id][rec.cat_name] || 0) + 1;
            }
          });

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            Object.entries(zoneCatCounts).forEach(([ruleId, counts]) => {
              const totalInZone = Object.values(counts).reduce((a, b) => a + b, 0);
              // 找出在該區段佔比 >= 15% 的主要大區
              const majorCats = Object.entries(counts)
                .filter(([, cnt]) => cnt / totalInZone >= 0.15)
                .sort((a, b) => b[1] - a[1])
                .map(([cat]) => cat);

              if (majorCats.length > 0) {
                db.run(
                  `UPDATE storage_placement_rules SET allowed_categories = ? WHERE id = ?`,
                  [JSON.stringify(majorCats), Number(ruleId)]
                );
              }
            });
            db.run('COMMIT', (cErr) => {
              if (cErr) return res.status(500).json({ success: false, message: cErr.message });
              res.json({ success: true, message: '🎉 已根據目前 80 庫實際分布自動填入各區段主要大區，您可接著微調「借 / 採」限制！' });
            });
          });
        });
      });
    });
  });

  return router;
};