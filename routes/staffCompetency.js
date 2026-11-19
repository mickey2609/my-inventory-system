// routes/staffCompetency.js
const express = require('express');

module.exports = function(db) {
  const router = express.Router();
  const WAREHOUSES = ['林口倉', '3PL一組'];

  let currentVersion = Date.now();
  function bumpVersion() {
    currentVersion = Date.now();
  }

  function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
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

  let tablesReadyPromise = null;
  function ensureTables() {
    if (tablesReadyPromise) return tablesReadyPromise;
    tablesReadyPromise = (async () => {
      // 1. 檢查並升級 staff_competency_skills（若為舊表缺少 wh_name 或 skill_id 則重建）
      const skillCols = await dbAll(`PRAGMA table_info(staff_competency_skills)`);
      if (skillCols.length > 0 && (!skillCols.some(c => c.name === 'wh_name') || !skillCols.some(c => c.name === 'skill_id'))) {
        await dbRun(`DROP TABLE IF EXISTS staff_competency_skills`);
      }

      await dbRun(`
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

      // 2. 檢查並升級 staff_competency_employees（若為舊表缺少 wh_name 或 emp_id 則重建）
      const empCols = await dbAll(`PRAGMA table_info(staff_competency_employees)`);
      if (empCols.length > 0 && (!empCols.some(c => c.name === 'wh_name') || !empCols.some(c => c.name === 'emp_id'))) {
        await dbRun(`DROP TABLE IF EXISTS staff_competency_employees`);
      }

      await dbRun(`
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

      const updatedEmpCols = await dbAll(`PRAGMA table_info(staff_competency_employees)`);
      if (!updatedEmpCols.some(c => c.name === 'shift_name')) {
        await dbRun(`ALTER TABLE staff_competency_employees ADD COLUMN shift_name TEXT DEFAULT ''`);
      }

      // 3. 每週快照資料表
      await dbRun(`
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

      // 4. 幹部組別權限資料表
      await dbRun(`
        CREATE TABLE IF NOT EXISTS staff_competency_group_perms (
          username TEXT PRIMARY KEY,
          allowed_groups_json TEXT DEFAULT '[]',
          updated_at TEXT DEFAULT ''
        )
      `);
    })().catch(err => {
      tablesReadyPromise = null;
      throw err;
    });
    return tablesReadyPromise;
  }

  async function buildFullDataObject() {
    const result = {
      '林口倉': { skills: [], employees: [] },
      '3PL一組': { skills: [], employees: [] }
    };

    const skillRows = await dbAll(
      `SELECT wh_name, skill_id, skill_group, skill_type, skill_name, sub_header
       FROM staff_competency_skills
       WHERE wh_name IN ('林口倉', '3PL一組')
       ORDER BY sort_order ASC, id ASC`
    );

    skillRows.forEach(r => {
      if (!result[r.wh_name]) result[r.wh_name] = { skills: [], employees: [] };
      result[r.wh_name].skills.push({
        id: r.skill_id,
        group: r.skill_group,
        type: r.skill_type,
        name: r.skill_name,
        subHeader: r.sub_header || ''
      });
    });

    const empRows = await dbAll(
      `SELECT wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json
       FROM staff_competency_employees
       WHERE wh_name IN ('林口倉', '3PL一組')
       ORDER BY sort_order ASC, id ASC`
    );

    empRows.forEach(r => {
      if (!result[r.wh_name]) result[r.wh_name] = { skills: [], employees: [] };
      let parsedSkills = {};
      try { parsedSkills = JSON.parse(r.skills_json || '{}'); } catch (e) {}
      result[r.wh_name].employees.push({
        id: r.emp_id,
        name: r.emp_name,
        staffGroup: r.staff_group || '未分組',
        shiftName: r.shift_name || '',
        lastUpdated: r.last_updated || '',
        skills: parsedSkills
      });
    });

    return result;
  }

  async function ensureWeeklyAutoSnapshot(existingData = null) {
    try {
      const { weekKey, dateStr } = getIsoWeekLabel(new Date());
      const row = await dbGet(
        `SELECT id FROM staff_competency_snapshots WHERE week_key = ? AND snapshot_type = 'auto'`,
        [weekKey]
      );
      if (row) return;

      const fullData = existingData || await buildFullDataObject();
      const totalEmps = (fullData['林口倉']?.employees?.length || 0) + (fullData['3PL一組']?.employees?.length || 0);
      if (totalEmps === 0) return;

      const nowStr = `${dateStr} ${new Date().toTimeString().slice(0, 5)}`;
      await dbRun(
        `INSERT INTO staff_competency_snapshots (week_key, snapshot_name, snapshot_type, created_by, created_at, payload_json)
         VALUES (?, ?, 'auto', 'system', ?, ?)`,
        [weekKey, `${weekKey} 自動週備份 (${dateStr})`, nowStr, JSON.stringify(fullData)]
      );
    } catch (e) {
      console.error('自動週備份略過:', e.message);
    }
  }

  // 1. 輕量級版本號查詢
  router.get('/version', (req, res) => {
    res.json({ success: true, version: currentVersion });
  });

  // 2. 取得完整倉別資料 + 帳號組別權限設定
  router.get('/all', async (req, res) => {
    try {
      await ensureTables();
      const result = await buildFullDataObject();
      const permRows = await dbAll(`SELECT username, allowed_groups_json FROM staff_competency_group_perms`);
      const groupPerms = {};
      permRows.forEach(p => {
        try { groupPerms[p.username] = JSON.parse(p.allowed_groups_json || '[]'); } catch (e) { groupPerms[p.username] = []; }
      });
      res.json({ success: true, version: currentVersion, data: result, groupPerms });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. 儲存幹部帳號的可管理組別權限
  router.post('/group-perms/save', async (req, res) => {
    const { permsMap } = req.body;
    if (!permsMap || typeof permsMap !== 'object') {
      return res.status(400).json({ success: false, message: '無效的組別權限設定資料' });
    }
    try {
      await ensureTables();
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      await dbRun('BEGIN TRANSACTION');
      try {
        for (const [username, groups] of Object.entries(permsMap)) {
          const cleanGroups = Array.isArray(groups) ? groups : [];
          await dbRun(
            `INSERT INTO staff_competency_group_perms (username, allowed_groups_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(username) DO UPDATE SET allowed_groups_json = excluded.allowed_groups_json, updated_at = excluded.updated_at`,
            [username, JSON.stringify(cleanGroups), nowStr]
          );
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }
      bumpVersion();
      res.json({ success: true, version: currentVersion, message: '🎉 幹部組別權限參數已儲存並同步！' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. 批次即時勾選同步
  router.post('/batch-toggle', async (req, res) => {
    const updates = req.body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.json({ success: true, updated: 0, version: currentVersion });
    }

    try {
      await ensureTables();
      await ensureWeeklyAutoSnapshot();

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

      const entries = Array.from(grouped.values());
      if (entries.length === 0) {
        return res.json({ success: true, updated: 0, version: currentVersion });
      }

      await dbRun('BEGIN TRANSACTION');
      try {
        for (const item of entries) {
          const row = await dbGet(
            `SELECT skills_json FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`,
            [item.whName, item.empId]
          );
          if (row) {
            let sk = {};
            try { sk = JSON.parse(row.skills_json || '{}'); } catch (e) {}
            Object.entries(item.changes).forEach(([sid, val]) => {
              if (val === 1) sk[sid] = 1;
              else delete sk[sid];
            });
            await dbRun(
              `UPDATE staff_competency_employees SET skills_json = ?, last_updated = ? WHERE wh_name = ? AND emp_id = ?`,
              [JSON.stringify(sk), item.lastUpdated, item.whName, item.empId]
            );
          }
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }

      bumpVersion();
      res.json({ success: true, updated: entries.length, version: currentVersion });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. 新增或編輯單一員工資料
  router.post('/employee/save', async (req, res) => {
    const { originalWarehouse, originalEmpId, targetWarehouse, emp } = req.body;
    if (!targetWarehouse || !emp || !emp.id || !emp.name) {
      return res.status(400).json({ success: false, message: '缺少必要的人員資料' });
    }

    try {
      await ensureTables();
      await ensureWeeklyAutoSnapshot();

      await dbRun('BEGIN TRANSACTION');
      try {
        if (originalWarehouse && originalEmpId && (originalWarehouse !== targetWarehouse || originalEmpId !== emp.id)) {
          await dbRun(`DELETE FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`, [originalWarehouse, originalEmpId]);
        }

        await dbRun(
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
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }

      bumpVersion();
      res.json({ success: true, version: currentVersion });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. 刪除單一員工
  router.post('/employee/delete', async (req, res) => {
    const { warehouse, empId } = req.body;
    try {
      await ensureTables();
      await ensureWeeklyAutoSnapshot();
      await dbRun(`DELETE FROM staff_competency_employees WHERE wh_name = ? AND emp_id = ?`, [warehouse, empId]);
      bumpVersion();
      res.json({ success: true, version: currentVersion });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. 新增單一能力項目
  router.post('/skill/add', async (req, res) => {
    const { warehouse, skill } = req.body;
    if (!warehouse || !skill || !skill.id || !skill.name) {
      return res.status(400).json({ success: false, message: '缺少能力項目參數' });
    }
    try {
      await ensureTables();
      await dbRun(
        `INSERT INTO staff_competency_skills (wh_name, skill_id, skill_group, skill_type, skill_name, sub_header, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 999)
         ON CONFLICT(wh_name, skill_id) DO UPDATE SET
           skill_group = excluded.skill_group,
           skill_type = excluded.skill_type,
           skill_name = excluded.skill_name,
           sub_header = excluded.sub_header`,
        [warehouse, skill.id, skill.group, skill.type, skill.name, skill.subHeader || '']
      );
      bumpVersion();
      res.json({ success: true, version: currentVersion });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 8. 刪除單一能力項目
  router.post('/skill/delete', async (req, res) => {
    const { warehouse, skillId } = req.body;
    try {
      await ensureTables();
      await ensureWeeklyAutoSnapshot();
      await dbRun('BEGIN TRANSACTION');
      try {
        await dbRun(`DELETE FROM staff_competency_skills WHERE wh_name = ? AND skill_id = ?`, [warehouse, skillId]);
        const rows = await dbAll(`SELECT id, skills_json FROM staff_competency_employees WHERE wh_name = ?`, [warehouse]);
        for (const r of rows) {
          try {
            const sk = JSON.parse(r.skills_json || '{}');
            if (sk[skillId]) {
              delete sk[skillId];
              await dbRun(`UPDATE staff_competency_employees SET skills_json = ? WHERE id = ?`, [JSON.stringify(sk), r.id]);
            }
          } catch (e) {}
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }
      bumpVersion();
      res.json({ success: true, version: currentVersion });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. 模式 A：最高管理員「主檔匯入」（同步名冊與技能結構，100% 保留既有打勾紀錄）
  router.post('/import-master', async (req, res) => {
    const payload = req.body.data;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: '無效的主檔匯入資料' });
    }

    try {
      await ensureTables();
      const existingData = await buildFullDataObject();
      await ensureWeeklyAutoSnapshot(existingData);

      await dbRun('BEGIN TRANSACTION');
      try {
        for (const wh of WAREHOUSES) {
          const whBlock = payload[wh];
          if (!whBlock) continue;

          if (Array.isArray(whBlock.skills) && whBlock.skills.length > 0) {
            await dbRun(`DELETE FROM staff_competency_skills WHERE wh_name = ?`, [wh]);
            for (let idx = 0; idx < whBlock.skills.length; idx++) {
              const s = whBlock.skills[idx];
              await dbRun(
                `INSERT INTO staff_competency_skills (wh_name, skill_id, skill_group, skill_type, skill_name, sub_header, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [wh, s.id, s.group, s.type, s.name, s.subHeader || '', idx]
              );
            }
          }

          if (Array.isArray(whBlock.employees)) {
            const prevMap = new Map((existingData[wh]?.employees || []).map(e => [e.id, e]));
            await dbRun(`DELETE FROM staff_competency_employees WHERE wh_name = ?`, [wh]);
            for (let idx = 0; idx < whBlock.employees.length; idx++) {
              const e = whBlock.employees[idx];
              const empId = String(e.id || '').trim();
              if (!empId) continue;
              const prev = prevMap.get(empId);
              const mergedSkills = { ...(prev?.skills || {}), ...(e.skills || {}) };
              const finalLastUpdated = e.lastUpdated || prev?.lastUpdated || '';

              await dbRun(
                `INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  wh,
                  empId,
                  String(e.name || '').trim(),
                  e.staffGroup || prev?.staffGroup || '未分組',
                  e.shiftName || prev?.shiftName || '',
                  finalLastUpdated,
                  JSON.stringify(mergedSkills),
                  idx
                ]
              );
            }
          }
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }

      bumpVersion();
      const latestData = await buildFullDataObject();
      res.json({
        success: true,
        version: currentVersion,
        data: latestData,
        message: '🎉 主檔匯入完成！人員名冊與技能結構已同步，既有打勾紀錄已完整保留。'
      });
    } catch (err) {
      console.error('import-master 錯誤:', err);
      res.status(500).json({ success: false, message: '主檔寫入資料庫失敗：' + err.message });
    }
  });

  // 10. 模式 B：現場幹部「各組局部合併匯入」
  router.post('/import-group-merge', async (req, res) => {
    const { warehouse = '林口倉', groupsData } = req.body;
    if (!Array.isArray(groupsData) || groupsData.length === 0) {
      return res.status(400).json({ success: false, message: '無效的各組匯入資料' });
    }

    try {
      await ensureTables();
      const existingData = await buildFullDataObject();
      await ensureWeeklyAutoSnapshot(existingData);

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

          groupSkillIds.forEach(sid => {
            delete targetEmp.skills[sid];
          });
          Object.entries(incoming.skills || {}).forEach(([sid, val]) => {
            if (val === 1) targetEmp.skills[sid] = 1;
          });
          mergedEmpCount++;
        });
      });

      await dbRun('BEGIN TRANSACTION');
      try {
        for (const e of empMap.values()) {
          await dbRun(
            `INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, 999)
             ON CONFLICT(wh_name, emp_id) DO UPDATE SET
               emp_name = excluded.emp_name,
               staff_group = excluded.staff_group,
               shift_name = excluded.shift_name,
               last_updated = excluded.last_updated,
               skills_json = excluded.skills_json`,
            [
              warehouse,
              e.id,
              e.name,
              e.staffGroup || '未分組',
              e.shiftName || '',
              e.lastUpdated || '',
              JSON.stringify(e.skills || {})
            ]
          );
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }

      bumpVersion();
      const latestData = await buildFullDataObject();
      res.json({
        success: true,
        version: currentVersion,
        data: latestData,
        message: `🎉 各組局部合併成功！共更新 ${mergedEmpCount} 筆組員本組能力（他組人員與跨組能力皆已保留）。`
      });
    } catch (err) {
      console.error('import-group-merge 錯誤:', err);
      res.status(500).json({ success: false, message: '各組匯入寫入資料庫失敗：' + err.message });
    }
  });

  // 11. 取得所有每週歷史備份快照清單
  router.get('/snapshots', async (req, res) => {
    try {
      await ensureTables();
      const rows = await dbAll(
        `SELECT id, week_key, snapshot_name, snapshot_type, created_by, created_at
         FROM staff_competency_snapshots
         ORDER BY id DESC LIMIT 60`
      );
      res.json({ success: true, snapshots: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. 取得單一快照的完整資料內容
  router.get('/snapshots/:id', async (req, res) => {
    try {
      await ensureTables();
      const row = await dbGet(`SELECT * FROM staff_competency_snapshots WHERE id = ?`, [req.params.id]);
      if (!row) return res.status(404).json({ success: false, message: '找不到該筆備份快照' });
      let parsed = {};
      try { parsed = JSON.parse(row.payload_json || '{}'); } catch (e) {}
      res.json({ success: true, snapshot: row, data: parsed });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 13. 手動立即建立一筆週次備份快照
  router.post('/snapshots/create', async (req, res) => {
    const { createdBy = 'admin', customNote = '' } = req.body;
    try {
      await ensureTables();
      const fullData = await buildFullDataObject();
      const { weekKey, dateStr } = getIsoWeekLabel(new Date());
      const nowStr = `${dateStr} ${new Date().toTimeString().slice(0, 5)}`;
      const title = customNote ? `${weekKey} ${customNote} (${nowStr})` : `${weekKey} 手動備份 (${nowStr})`;

      const info = await dbRun(
        `INSERT INTO staff_competency_snapshots (week_key, snapshot_name, snapshot_type, created_by, created_at, payload_json)
         VALUES (?, ?, 'manual', ?, ?, ?)`,
        [weekKey, title, createdBy, nowStr, JSON.stringify(fullData)]
      );
      res.json({ success: true, id: info.lastID, message: `📸 已建立備份快照：${title}` });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 14. 從歷史快照還原「單一組員」或「指定組別」
  router.post('/snapshots/restore', async (req, res) => {
    const { snapshotId, warehouse, empId = '', staffGroup = '' } = req.body;
    if (!snapshotId || !warehouse) {
      return res.status(400).json({ success: false, message: '缺少快照 ID 或倉別參數' });
    }

    try {
      await ensureTables();
      const row = await dbGet(`SELECT * FROM staff_competency_snapshots WHERE id = ?`, [snapshotId]);
      if (!row) return res.status(404).json({ success: false, message: '找不到該筆備份快照' });

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

      await dbRun('BEGIN TRANSACTION');
      try {
        for (const e of targets) {
          await dbRun(
            `INSERT INTO staff_competency_employees (wh_name, emp_id, emp_name, staff_group, shift_name, last_updated, skills_json, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, 999)
             ON CONFLICT(wh_name, emp_id) DO UPDATE SET
               emp_name = excluded.emp_name,
               staff_group = excluded.staff_group,
               shift_name = excluded.shift_name,
               last_updated = excluded.last_updated,
               skills_json = excluded.skills_json`,
            [
              warehouse,
              e.id,
              e.name,
              e.staffGroup || '未分組',
              e.shiftName || '',
              e.lastUpdated || '',
              JSON.stringify(e.skills || {})
            ]
          );
        }
        await dbRun('COMMIT');
      } catch (txErr) {
        await dbRun('ROLLBACK').catch(() => {});
        throw txErr;
      }

      bumpVersion();
      res.json({
        success: true,
        version: currentVersion,
        message: `↩️ 已成功從快照「${row.snapshot_name}」還原 ${targets.length} 位人員的能力紀錄！`
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};