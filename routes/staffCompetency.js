// routes/staffCompetency.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();
  const WAREHOUSES = ['大園倉', '林口倉', '3PL一組', '3PL二組'];

  function formatNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function normalizeEmpId(rawId) {
    let s = String(rawId || '').trim();
    if (s.endsWith('.0')) s = s.slice(0, -2);
    if (/^\d{5}$/.test(s)) s = s.padStart(6, '0');
    return s;
  }

  function ensureTables(callback) {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          warehouse TEXT NOT NULL,
          skill_id TEXT NOT NULL,
          group_name TEXT NOT NULL,
          skill_type TEXT NOT NULL,
          skill_name TEXT NOT NULL,
          sub_header TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          UNIQUE(warehouse, skill_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          warehouse TEXT NOT NULL,
          emp_id TEXT NOT NULL,
          emp_name TEXT NOT NULL,
          staff_group TEXT NOT NULL,
          last_updated TEXT DEFAULT '',
          skills_json TEXT DEFAULT '{}',
          sort_order INTEGER DEFAULT 0,
          UNIQUE(warehouse, emp_id)
        )
      `, () => {
        if (typeof callback === 'function') callback();
      });
    });
  }

  ensureTables();

  // 1. 取得全部倉別能力項目與人員資料
  router.get('/all', (req, res) => {
    ensureTables(() => {
      db.all(`SELECT * FROM staff_competency_skills ORDER BY warehouse ASC, sort_order ASC, id ASC`, [], (sErr, skillRows) => {
        if (sErr) return res.status(500).json({ success: false, message: sErr.message });

        db.all(`SELECT * FROM staff_competency_employees ORDER BY warehouse ASC, sort_order ASC, id ASC`, [], (eErr, empRows) => {
          if (eErr) return res.status(500).json({ success: false, message: eErr.message });

          const data = {};
          WAREHOUSES.forEach(wh => {
            data[wh] = { skills: [], employees: [] };
          });

          (skillRows || []).forEach(r => {
            if (!data[r.warehouse]) data[r.warehouse] = { skills: [], employees: [] };
            data[r.warehouse].skills.push({
              id: r.skill_id,
              group: r.group_name,
              type: r.skill_type,
              name: r.skill_name,
              subHeader: r.sub_header
            });
          });

          (empRows || []).forEach(r => {
            if (!data[r.warehouse]) data[r.warehouse] = { skills: [], employees: [] };
            let parsedSkills = {};
            try { parsedSkills = JSON.parse(r.skills_json || '{}'); } catch (e) {}
            data[r.warehouse].employees.push({
              id: normalizeEmpId(r.emp_id),
              name: r.emp_name,
              staffGroup: r.staff_group,
              lastUpdated: r.last_updated || '',
              skills: parsedSkills
            });
          });

          res.json({ success: true, data });
        });
      });
    });
  });

  // 2. 批次快速更新打勾狀態（鍵盤 / 點擊即時儲存）
  router.post('/batch-toggle', (req, res) => {
    const updates = req.body.updates || [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const grouped = {};
    updates.forEach(u => {
      const wh = u.whName;
      const eid = normalizeEmpId(u.empId);
      const key = `${wh}|||${eid}`;
      if (!grouped[key]) grouped[key] = { wh, eid, changes: [], lastUpdated: u.lastUpdated || formatNow() };
      grouped[key].changes.push({ skillId: u.skillId, val: u.val });
      if (u.lastUpdated) grouped[key].lastUpdated = u.lastUpdated;
    });

    const entries = Object.values(grouped);
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      let done = 0;
      entries.forEach(entry => {
        db.get(
          `SELECT skills_json FROM staff_competency_employees WHERE warehouse = ? AND emp_id = ?`,
          [entry.wh, entry.eid],
          (err, row) => {
            if (!err && row) {
              let skillsObj = {};
              try { skillsObj = JSON.parse(row.skills_json || '{}'); } catch (e) {}
              entry.changes.forEach(c => {
                if (c.val === 1) skillsObj[c.skillId] = 1;
                else delete skillsObj[c.skillId];
              });
              db.run(
                `UPDATE staff_competency_employees SET skills_json = ?, last_updated = ? WHERE warehouse = ? AND emp_id = ?`,
                [JSON.stringify(skillsObj), entry.lastUpdated, entry.wh, entry.eid]
              );
            }
            done++;
            if (done === entries.length) {
              db.run('COMMIT', (cErr) => {
                if (cErr) return res.status(500).json({ success: false, message: cErr.message });
                res.json({ success: true, updatedEmployees: entries.length });
              });
            }
          }
        );
      });
    });
  });

  // 3. 新增 / 編輯 / 調倉單一人員
  router.post('/employee/save', (req, res) => {
    const { originalWarehouse, originalEmpId, targetWarehouse, emp } = req.body;
    if (!targetWarehouse || !emp || !emp.id || !emp.name) {
      return res.status(400).json({ success: false, message: '缺少必要的人員欄位' });
    }
    const cleanId = normalizeEmpId(emp.id);

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      if (originalWarehouse && originalEmpId && (originalWarehouse !== targetWarehouse || normalizeEmpId(originalEmpId) !== cleanId)) {
        db.run(`DELETE FROM staff_competency_employees WHERE warehouse = ? AND emp_id = ?`, [originalWarehouse, normalizeEmpId(originalEmpId)]);
      }

      db.run(`
        INSERT INTO staff_competency_employees (warehouse, emp_id, emp_name, staff_group, last_updated, skills_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(warehouse, emp_id) DO UPDATE SET
          emp_name = EXCLUDED.emp_name,
          staff_group = EXCLUDED.staff_group,
          last_updated = EXCLUDED.last_updated,
          skills_json = EXCLUDED.skills_json
      `, [
        targetWarehouse,
        cleanId,
        String(emp.name).trim(),
        String(emp.staffGroup || '一般作業組').trim(),
        emp.lastUpdated || '',
        JSON.stringify(emp.skills || {})
      ]);

      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      });
    });
  });

  // 4. 刪除人員
  router.post('/employee/delete', (req, res) => {
    const { warehouse, empId } = req.body;
    db.run(
      `DELETE FROM staff_competency_employees WHERE warehouse = ? AND emp_id = ?`,
      [warehouse, normalizeEmpId(empId)],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
      }
    );
  });

  // 5. 新增能力項目
  router.post('/skill/add', (req, res) => {
    const { warehouse, skill } = req.body;
    if (!warehouse || !skill || !skill.id) {
      return res.status(400).json({ success: false, message: '缺少能力項目參數' });
    }
    db.get(`SELECT MAX(sort_order) as max_ord FROM staff_competency_skills WHERE warehouse = ?`, [warehouse], (err, row) => {
      const nextOrd = (row && row.max_ord !== null) ? row.max_ord + 1 : 0;
      db.run(`
        INSERT OR IGNORE INTO staff_competency_skills
        (warehouse, skill_id, group_name, skill_type, skill_name, sub_header, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [warehouse, skill.id, skill.group, skill.type, skill.name, skill.subHeader || '', nextOrd], (iErr) => {
        if (iErr) return res.status(500).json({ success: false, message: iErr.message });
        res.json({ success: true });
      });
    });
  });

  // 6. 刪除能力項目
  router.post('/skill/delete', (req, res) => {
    const { warehouse, skillId } = req.body;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`DELETE FROM staff_competency_skills WHERE warehouse = ? AND skill_id = ?`, [warehouse, skillId]);
      db.all(`SELECT id, skills_json FROM staff_competency_employees WHERE warehouse = ?`, [warehouse], (err, rows) => {
        (rows || []).forEach(r => {
          let sObj = {};
          try { sObj = JSON.parse(r.skills_json || '{}'); } catch (e) {}
          if (sObj[skillId]) {
            delete sObj[skillId];
            db.run(`UPDATE staff_competency_employees SET skills_json = ? WHERE id = ?`, [JSON.stringify(sObj), r.id]);
          }
        });
        db.run('COMMIT', (cErr) => {
          if (cErr) return res.status(500).json({ success: false, message: cErr.message });
          res.json({ success: true });
        });
      });
    });
  });

  // 7. 整批匯入 / 覆蓋同步（確保完全寫入地端 SQLite 後才回傳）
  router.post('/sync-all', (req, res) => {
    const payload = req.body.data || {};
    let totalSkills = 0;
    let totalEmployees = 0;

    ensureTables(() => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const skillStmt = db.prepare(`
          INSERT OR REPLACE INTO staff_competency_skills
          (warehouse, skill_id, group_name, skill_type, skill_name, sub_header, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const empStmt = db.prepare(`
          INSERT OR REPLACE INTO staff_competency_employees
          (warehouse, emp_id, emp_name, staff_group, last_updated, skills_json, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        Object.keys(payload).forEach(wh => {
          const whBlock = payload[wh];
          if (!whBlock) return;
          if (Array.isArray(whBlock.skills) && whBlock.skills.length > 0) {
            db.run(`DELETE FROM staff_competency_skills WHERE warehouse = ?`, [wh]);
            whBlock.skills.forEach((s, idx) => {
              skillStmt.run(wh, s.id, s.group, s.type, s.name, s.subHeader || '', idx);
              totalSkills++;
            });
          }
          if (Array.isArray(whBlock.employees) && whBlock.employees.length > 0) {
            db.run(`DELETE FROM staff_competency_employees WHERE warehouse = ?`, [wh]);
            whBlock.employees.forEach((e, idx) => {
              empStmt.run(
                wh,
                normalizeEmpId(e.id),
                e.name,
                e.staffGroup || '一般作業組',
                e.lastUpdated || '',
                JSON.stringify(e.skills || {}),
                idx
              );
              totalEmployees++;
            });
          }
        });

        skillStmt.finalize();
        empStmt.finalize();

        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, message: '寫入資料庫失敗：' + err.message });
          res.json({
            success: true,
            totalSkills,
            totalEmployees,
            message: `已成功寫入地端資料庫（共 ${totalEmployees} 位人員、${totalSkills} 項能力）`
          });
        });
      });
    });
  });

  return router;
};