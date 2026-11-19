// routes/staffCompetency.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();
  const WAREHOUSES = ['林口倉', '3PL一組'];

  let currentVersion = Date.now();
  function bumpVersion() {
    currentVersion = Date.now();
  }

  function getIsoWeekLabel(dateObj = new Date()) {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    return {
      weekKey: `${d.getUTCFullYear()}-W${pad(weekNo)}`,
      dateStr
    };
  }

  function ensureTables(callback) {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wh_name TEXT NOT NULL,
          skill_id TEXT NOT NULL,
          skill_group TEXT NOT NULL,
          skill_type TEXT NOT NULL,
          skill_name TEXT NOT NULL,
          sub_header TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0,
          UNIQUE(wh_name, skill_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wh_name TEXT NOT NULL,
          emp_id TEXT NOT NULL,
          emp_name TEXT NOT NULL,
          staff_group TEXT DEFAULT '未分組',
          shift_name TEXT DEFAULT '',
          last_updated TEXT DEFAULT '',
          skills_json TEXT DEFAULT '{}',
          sort_order INTEGER DEFAULT 0,
          UNIQUE(wh_name, emp_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_key TEXT NOT NULL,
          snapshot_name TEXT NOT NULL,
          snapshot_type TEXT DEFAULT 'auto',
          created_by TEXT DEFAULT 'system',
          created_at TEXT NOT NULL,
          payload_json TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS staff_competency_group_perms (
          username TEXT PRIMARY KEY,
          allowed_groups_json TEXT DEFAULT '[]',
          updated_at TEXT DEFAULT ''
        )
      `);

      db.all(`PRAGMA table_info(staff_competency_employees)`, [], (err, cols) => {
        if (!err && Array.isArray(cols)) {
          const hasShift = cols.some(c => c.name === 'shift_name');
          if (!hasShift) {
            db.run(`ALTER TABLE staff_competency_employees ADD COLUMN shift_name TEXT DEFAULT ''`);
          }
        }
        if (typeof callback === 'function') callback();
      });
    });
  }

  ensureTables();

  function buildFullDataObject(callback) {
    const result = {
      '林口倉': { skills: [], employees: [] },
      '3PL一組': { skills: [], employees: [] }
    };

    db.all(
      `SELECT wh_name, skill_id, skill_group, skill_type, skill_name, sub_header FROM staff_competency_skills WHERE wh_name IN ('林口倉', '3PL一組') ORDER BY sort_order ASC, id ASC`,
      [],
      (err, skillRows) => {
        if (err) return callback(err);
        (skillRows || []).forEach(r => {
          if (!result[r.wh_name]) result[r.wh_name] = { skills: [], employees: [] };
          result[r.wh_name].skills.push({
            id: r.skill_id,
            group: r.skill_group,
            type: r.skill_type,
            name: r.skill_name,
            subHeader: r.sub_header || ''
          });
        });

        db.all(
          `SELECT wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json FROM staff_competency_employees WHERE wh_name IN ('林口倉', '3PL一組') ORDER BY sort_order ASC, id ASC`,
          [],
          (eErr, empRows) => {
            if (eErr) return callback(eErr);
            (empRows || []).forEach(r => {
              if (!result[r.wh_name]) result[r.wh_name] = { skills: [], employees: [] };
              let parsedSkills = {};
              try {
                parsedSkills = JSON.parse(r.skills_json || '{}');
              } catch (e) {
                parsedSkills = {};
              }
              result[r.wh_name].employees.push({
                id: r.emp_id,
                name: r.emp_name,
                staffGroup: r.staff_group || '未分組',
                shiftName: r.shift_name || '',
                lastUpdated: r.last_updated || '',
                skills: parsedSkills
              });
            });
            callback(null, result);
          }
        );
      }
    );
  }

  // 自動確保當週有建立週備份快照（避免幹部誤刪無紀錄可還原）
  function ensureWeeklyAutoSnapshot() {
    const { weekKey, dateStr } = getIsoWeekLabel(new Date());
    db.get(
      `SELECT id FROM staff_competency_snapshots WHERE week_key = ? AND snapshot_type = 'auto'`,
      [weekKey],
      (err, row) => {
        if (err || row) return;
        buildFullDataObject((bErr, fullData) => {
          if (bErr || !fullData) return;
          const totalEmps = (fullData['林口倉']?.employees?.length || 0) + (fullData['3PL一組']?.employees?.length || 0);
          if (totalEmps === 0) return;

          const nowStr = `${dateStr} ${new Date().toTimeString().slice(0, 5)}`;
          db.run(
            `INSERT INTO staff_competency_snapshots (week_key, snapshot_name, snapshot_type, created_by, created_at, payload_json)
             VALUES (?, ?, 'auto', 'system', ?, ?)`,
            [weekKey, `${weekKey} 自動週備份 (${dateStr})`, nowStr, JSON.stringify(fullData)]
          );
        });
      }
    );
  }

  // 1. 輕量級版本號查詢
  router.get('/version', (req, res) => {
    res.json({ success: true, version: currentVersion });
  });

  // 2. 取得完整倉別資料 + 帳號組別權限設定
  router.get('/all', (req, res) => {
    ensureTables(() => {
      buildFullDataObject((err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        db.all(`SELECT username, allowed_groups_json FROM staff_competency_group_perms`, [], (pErr, permRows) => {
          const groupPerms = {};
          (permRows || []).forEach(p => {
            try {
              groupPerms[p.username] = JSON.parse(p.allowed_groups_json || '[]');
            } catch (e) {
              groupPerms[p.username] = [];
            }
          });
          res.json({ success: true, version: currentVersion, data: result, groupPerms });
        });
      });
    });
  });

  // 3. 儲存幹部帳號的可管理組別權限（參數設定）
  router.post('/group-perms/save', (req, res) => {
    const { permsMap } = req.body;
    if (!permsMap || typeof permsMap !== 'object') {
      return res.status(400).json({ success: false, message: '無效的組別權限設定資料' });
    }
    ensureTables(() => {
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        Object.entries(permsMap).forEach(([username, groups]) => {
          const cleanGroups = Array.isArray(groups) ? groups : [];
          db.run(
            `INSERT INTO staff_competency_group_perms (username, allowed_groups_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(username) DO UPDATE SET allowed_groups_json = excluded.allowed_groups_json, updated_at = excluded.updated_at`,
            [username, JSON.stringify(cleanGroups), nowStr]
          );
        });
        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          bumpVersion();
          res.json({ success: true, version: currentVersion, message: '🎉 幹部組別權限參數已儲存並同步！' });
        });
      });
    });
  });

  // 4. 批次即時勾選同步
  router.post('/batch-toggle', (req, res) => {
    const updates = req.body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.json({ success: true, updated: 0, version: currentVersion });
    }

    ensureTables(() => {
      ensureWeeklyAutoSnapshot();

      const grouped = new Map();
      updates.forEach(u => {
        if (!u.whName || !u.empId || !u.skillId) return;
        const key = `${u.whName}|||${u.empId}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            whName: u.whName,
            empId: u.empId,
            lastUpdated: u.lastUpdated || '',
            changes: {}
          });
        }
        const entry = grouped.get(key);
        entry.changes[u.skillId] = u.val ? 1 : 0;
        if (u.lastUpdated) entry.lastUpdated = u.lastUpdated;
      });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        let doneCount = 0;
        const entries = Array.from(grouped.values());

        if (entries.length === 0) {
          db.run('COMMIT');
          return res.json({ success: true, updated: 0, version: currentVersion });
        }

        entries.forEach(item => {
          db.get(
            `SELECT skills_json FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`,
            [item.whName, item.empId],
            (err, row) => {
              if (!err && row) {
                let sk = {};
                try { sk = JSON.parse(row.skills_json || '{}'); } catch (e) {}
                Object.entries(item.changes).forEach(([sid, val]) => {
                  if (val === 1) sk[sid] = 1;
                  else delete sk[sid];
                });
                db.run(
                  `UPDATE staff_competency_employees SET skills_json = ?, last_updated = ? WHERE wh_name = ? AND emp_id = ?`,
                  [JSON.stringify(sk), item.lastUpdated, item.whName, item.empId]
                );
              }
              doneCount++;
              if (doneCount === entries.length) {
                db.run('COMMIT', (cErr) => {
                  if (cErr) return res.status(500).json({ success: false, message: cErr.message });
                  bumpVersion();
                  res.json({ success: true, updated: entries.length, version: currentVersion });
                });
              }
            }
          );
        });
      });
    });
  });

  // 5. 新增或編輯單一員工資料
  router.post('/employee/save', (req, res) => {
    const { originalWarehouse, originalEmpId, targetWarehouse, emp } = req.body;
    if (!targetWarehouse || !emp || !emp.id || !emp.name) {
      return res.status(400).json({ success: false, message: '缺少必要的人員資料' });
    }

    ensureTables(() => {
      ensureWeeklyAutoSnapshot();
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        if (originalWarehouse && originalEmpId && (originalWarehouse !== targetWarehouse || originalEmpId !== emp.id)) {
          db.run(`DELETE FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`, [originalWarehouse, originalEmpId]);
        }

        db.run(
          `INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, 999)
           ON CONFLICT(wh_name, emp_id) DO UPDATE SET
             emp_name = excluded.emp_name,
             staff_group = excluded.staff_group,
             shift_name = excluded.shift_name,
             last_updated = excluded.last_updated,
             skills_json = excluded.skills_json`,
          [
            targetWarehouse,
            String(emp.id).trim(),
            String(emp.name).trim(),
            emp.staffGroup || '未分組',
            emp.shiftName || '',
            emp.lastUpdated || '',
            JSON.stringify(emp.skills || {})
          ]
        );

        db.run('COMMIT', (err) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          bumpVersion();
          res.json({ success: true, version: currentVersion });
        });
      });
    });
  });

  // 6. 刪除單一員工
  router.post('/employee/delete', (req, res) => {
    const { warehouse, empId } = req.body;
    ensureTables(() => {
      ensureWeeklyAutoSnapshot();
      db.run(`DELETE FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`, [warehouse, empId], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        bumpVersion();
        res.json({ success: true, version: currentVersion });
      });
    });
  });

  // 7. 新增單一能力項目
  router.post('/skill/add', (req, res) => {
    const { warehouse, skill } = req.body;
    if (!warehouse || !skill || !skill.id || !skill.name) {
      return res.status(400).json({ success: false, message: '缺少能力項目參數' });
    }
    ensureTables(() => {
      db.run(
        `INSERT INTO staff_competency_skills (wh_name, skill_id, skill_group, skill_type, skill_name, sub_header, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 999)
         ON CONFLICT(wh_name, skill_id) DO UPDATE SET
           skill_group = excluded.skill_group,
           skill_type = excluded.skill_type,
           skill_name = excluded.skill_name,
           sub_header = excluded.sub_header`,
        [warehouse, skill.id, skill.group, skill.type, skill.name, skill.subHeader || ''],
        (err) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          bumpVersion();
          res.json({ success: true, version: currentVersion });
        }
      );
    });
  });

  // 8. 刪除單一能力項目
  router.post('/skill/delete', (req, res) => {
    const { warehouse, skillId } = req.body;
    ensureTables(() => {
      ensureWeeklyAutoSnapshot();
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`DELETE FROM staff_competency_skills WHERE wh_name = ? AND skill_id = ?`, [warehouse, skillId]);
        db.all(`SELECT id, skills_json FROM staff_competency_employees WHERE wh_name = ?`, [warehouse], (err, rows) => {
          if (!err && rows) {
            rows.forEach(r => {
              try {
                const sk = JSON.parse(r.skills_json || '{}');
                if (sk[skillId]) {
                  delete sk[skillId];
                  db.run(`UPDATE staff_competency_employees SET skills_json = ? WHERE id = ?`, [JSON.stringify(sk), r.id]);
                }
              } catch (e) {}
            });
          }
          db.run('COMMIT', (cErr) => {
            if (cErr) return res.status(500).json({ success: false, message: cErr.message });
            bumpVersion();
            res.json({ success: true, version: currentVersion });
          });
        });
      });
    });
  });

  // 9. 模式 A：最高管理員「主檔匯入」（同步名冊與技能結構，100% 保留系統內既有打勾紀錄不覆蓋）
  router.post('/import-master', (req, res) => {
    const payload = req.body.data;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: '無效的主檔匯入資料' });
    }

    ensureTables(() => {
      ensureWeeklyAutoSnapshot();
      buildFullDataObject((bErr, existingData) => {
        if (bErr) return res.status(500).json({ success: false, message: bErr.message });

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          WAREHOUSES.forEach(wh => {
            const whBlock = payload[wh];
            if (!whBlock) return;

            if (Array.isArray(whBlock.skills) && whBlock.skills.length > 0) {
              db.run(`DELETE FROM staff_competency_skills WHERE wh_name = ?`, [wh]);
              const stmtSkill = db.prepare(`
                INSERT INTO staff_competency_skills (wh_name, skill_id, skill_group, skill_type, skill_name, sub_header, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              whBlock.skills.forEach((s, idx) => {
                stmtSkill.run(wh, s.id, s.group, s.type, s.name, s.subHeader || '', idx);
              });
              stmtSkill.finalize();
            }

            if (Array.isArray(whBlock.employees)) {
              const prevMap = new Map((existingData[wh]?.employees || []).map(e => [e.id, e]));
              db.run(`DELETE FROM staff_competency_employees WHERE wh_name = ?`, [wh]);
              const stmtEmp = db.prepare(`
                INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `);
              whBlock.employees.forEach((e, idx) => {
                const prev = prevMap.get(String(e.id).trim());
                // 主檔匯入保留系統內既有打勾，若主檔有標記 1 則一併合併
                const mergedSkills = { ...(prev?.skills || {}), ...(e.skills || {}) };
                const finalLastUpdated = e.lastUpdated || prev?.lastUpdated || '';
                stmtEmp.run(
                  wh,
                  String(e.id).trim(),
                  String(e.name).trim(),
                  e.staffGroup || prev?.staffGroup || '未分組',
                  e.shiftName || prev?.shiftName || '',
                  finalLastUpdated,
                  JSON.stringify(mergedSkills),
                  idx
                );
              });
              stmtEmp.finalize();
            }
          });

          db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            bumpVersion();
            buildFullDataObject((fErr, latestData) => {
              res.json({
                success: true,
                version: currentVersion,
                data: latestData,
                message: '🎉 主檔匯入完成！人員名冊與技能結構已同步，既有打勾紀錄已完整保留。'
              });
            });
          });
        });
      });
    });
  });

  // 10. 模式 B：現場幹部「各組局部合併匯入」（僅更新該組人員在該組技能的勾選，不影響他組人員，也保留跨組已學會能力）
  router.post('/import-group-merge', (req, res) => {
    const { warehouse = '林口倉', groupsData } = req.body;
    if (!Array.isArray(groupsData) || groupsData.length === 0) {
      return res.status(400).json({ success: false, message: '無效的各組匯入資料' });
    }

    ensureTables(() => {
      ensureWeeklyAutoSnapshot();
      buildFullDataObject((bErr, existingData) => {
        if (bErr) return res.status(500).json({ success: false, message: bErr.message });

        const whSkills = existingData[warehouse]?.skills || [];
        const whEmps = existingData[warehouse]?.employees || [];
        const empMap = new Map(whEmps.map(e => [e.id, { ...e, skills: { ...(e.skills || {}) } }]));
        let mergedEmpCount = 0;

        groupsData.forEach(gBlock => {
          const targetGroup = gBlock.groupName;
          const groupSkillIds = new Set(
            whSkills.filter(s => s.group === targetGroup).map(s => s.id)
          );
          (gBlock.skillIds || []).forEach(sid => groupSkillIds.add(sid));

          (gBlock.employees || []).forEach(incoming => {
            const empId = String(incoming.id || '').trim();
            if (!empId) return;

            let targetEmp = empMap.get(empId);
            if (!targetEmp) {
              targetEmp = {
                id: empId,
                name: incoming.name,
                staffGroup: incoming.staffGroup || targetGroup,
                shiftName: incoming.shiftName || '',
                lastUpdated: incoming.lastUpdated || '',
                skills: {}
              };
              empMap.set(empId, targetEmp);
            } else {
              if (incoming.name) targetEmp.name = incoming.name;
              if (incoming.shiftName) targetEmp.shiftName = incoming.shiftName;
              if (incoming.lastUpdated) targetEmp.lastUpdated = incoming.lastUpdated;
            }

            // 先清除該員在「本組技能範圍內」的舊勾選，再套用 Excel 本組勾選；其他組別的技能完整保留！
            groupSkillIds.forEach(sid => {
              delete targetEmp.skills[sid];
            });
            Object.entries(incoming.skills || {}).forEach(([sid, val]) => {
              if (val === 1) targetEmp.skills[sid] = 1;
            });
            mergedEmpCount++;
          });
        });

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          const stmt = db.prepare(`
            INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, 999)
            ON CONFLICT(wh_name, emp_id) DO UPDATE SET
              emp_name = excluded.emp_name,
              staff_group = excluded.staff_group,
              shift_name = excluded.shift_name,
              last_updated = excluded.last_updated,
              skills_json = excluded.skills_json
          `);
          Array.from(empMap.values()).forEach(e => {
            stmt.run(
              warehouse,
              e.id,
              e.name,
              e.staffGroup || '未分組',
              e.shiftName || '',
              e.lastUpdated || '',
              JSON.stringify(e.skills || {})
            );
          });
          stmt.finalize(() => {
            db.run('COMMIT', (err) => {
              if (err) return res.status(500).json({ success: false, message: err.message });
              bumpVersion();
              buildFullDataObject((fErr, latestData) => {
                res.json({
                  success: true,
                  version: currentVersion,
                  data: latestData,
                  message: `🎉 各組局部合併成功！共更新 ${mergedEmpCount} 筆組員本組能力（他組人員與跨組能力皆已保留）。`
                });
              });
            });
          });
        });
      });
    });
  });

  // 11. 取得所有每週歷史備份快照清單
  router.get('/snapshots', (req, res) => {
    ensureTables(() => {
      db.all(
        `SELECT id, week_key, snapshot_name, snapshot_type, created_by, created_at FROM staff_competency_snapshots ORDER BY id DESC LIMIT 60`,
        [],
        (err, rows) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          res.json({ success: true, snapshots: rows || [] });
        }
      );
    });
  });

  // 12. 取得單一快照的完整資料內容
  router.get('/snapshots/:id', (req, res) => {
    ensureTables(() => {
      db.get(`SELECT * FROM staff_competency_snapshots WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, message: '找不到該筆備份快照' });
        let parsed = {};
        try { parsed = JSON.parse(row.payload_json || '{}'); } catch (e) {}
        res.json({ success: true, snapshot: row, data: parsed });
      });
    });
  });

  // 13. 手動立即建立一筆週次備份快照
  router.post('/snapshots/create', (req, res) => {
    const { createdBy = 'admin', customNote = '' } = req.body;
    ensureTables(() => {
      buildFullDataObject((err, fullData) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        const { weekKey, dateStr } = getIsoWeekLabel(new Date());
        const nowStr = `${dateStr} ${new Date().toTimeString().slice(0, 5)}`;
        const title = customNote ? `${weekKey} ${customNote} (${nowStr})` : `${weekKey} 手動備份 (${nowStr})`;

        db.run(
          `INSERT INTO staff_competency_snapshots (week_key, snapshot_name, snapshot_type, created_by, created_at, payload_json)
           VALUES (?, ?, 'manual', ?, ?, ?)`,
          [weekKey, title, createdBy, nowStr, JSON.stringify(fullData)],
          function(iErr) {
            if (iErr) return res.status(500).json({ success: false, message: iErr.message });
            res.json({ success: true, id: this.lastID, message: `📸 已建立備份快照：${title}` });
          }
        );
      });
    });
  });

  // 14. 從歷史快照還原「單一組員」或「指定組別」的能力勾選紀錄（防誤刪救回）
  router.post('/snapshots/restore', (req, res) => {
    const { snapshotId, warehouse, empId = '', staffGroup = '' } = req.body;
    if (!snapshotId || !warehouse) {
      return res.status(400).json({ success: false, message: '缺少快照 ID 或倉別參數' });
    }

    ensureTables(() => {
      db.get(`SELECT * FROM staff_competency_snapshots WHERE id = ?`, [snapshotId], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, message: '找不到該筆備份快照' });
        let snapData = {};
        try { snapData = JSON.parse(row.payload_json || '{}'); } catch (e) {}
        const snapEmps = snapData[warehouse]?.employees || [];

        const targets = snapEmps.filter(e => {
          if (empId) return e.id === empId;
          if (staffGroup) return (e.staffGroup || '未分組') === staffGroup;
          return true;
        });

        if (targets.length === 0) {
          return res.status(400).json({ success: false, message: '該快照中找不到符合條件的人員資料' });
        }

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          const stmt = db.prepare(`
            INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, 999)
            ON CONFLICT(wh_name, emp_id) DO UPDATE SET
              emp_name = excluded.emp_name,
              staff_group = excluded.staff_group,
              shift_name = excluded.shift_name,
              last_updated = excluded.last_updated,
              skills_json = excluded.skills_json
          `);
          targets.forEach(e => {
            stmt.run(
              warehouse,
              e.id,
              e.name,
              e.staffGroup || '未分組',
              e.shiftName || '',
              e.lastUpdated || '',
              JSON.stringify(e.skills || {})
            );
          });
          stmt.finalize(() => {
            db.run('COMMIT', (cErr) => {
              if (cErr) return res.status(500).json({ success: false, message: cErr.message });
              bumpVersion();
              res.json({
                success: true,
                version: currentVersion,
                message: `↩️ 已成功從快照「${row.snapshot_name}」還原 ${targets.length} 位人員的能力紀錄！`
              });
            });
          });
        });
      });
    });
  });

  return router;
};