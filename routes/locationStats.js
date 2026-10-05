// routes/locationStats.js
// 80 庫儲位 7 大 KPI 與各儲位類型細節歷史快照專屬模組
const express = require('express');
const router = express.Router();

function initLocationStatsTable(db) {
  db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL;`);
    db.run(`PRAGMA synchronous = OFF;`);

    // 1. 建立 80 庫總體 7 大 KPI 快照表
    db.run(`
      CREATE TABLE IF NOT EXISTS location_stats_history (
        record_date TEXT PRIMARY KEY,
        source_module TEXT,
        file_name TEXT,
        plan_grid INTEGER,
        used_grid INTEGER,
        rem_grid INTEGER,
        plan_vol REAL,
        used_vol REAL,
        rem_vol REAL,
        health_rate REAL,
        created_at TEXT
      );
    `);

    // 2. 建立各儲位類型 (loc_type) 細節快照表
    db.run(`
      CREATE TABLE IF NOT EXISTS location_type_stats_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_date TEXT,
        loc_type TEXT,
        plan_grid INTEGER,
        used_grid INTEGER,
        rem_grid INTEGER,
        plan_vol REAL,
        used_vol REAL,
        rem_vol REAL,
        health_rate REAL,
        created_at TEXT,
        UNIQUE(record_date, loc_type)
      );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_loc_stats_date ON location_stats_history(record_date);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_loc_type_date ON location_type_stats_history(record_date);`);

    // 🌟 服務啟動時自動修正過去寫錯的剩餘才數與健康度 🌟
    db.run(`
      UPDATE location_type_stats_history 
      SET rem_vol = ROUND(rem_grid * (plan_vol * 1.0 / plan_grid), 1)
      WHERE plan_grid > 0 AND (rem_vol = plan_vol - used_vol OR rem_vol IS NULL);
    `);

    db.run(`
      UPDATE location_type_stats_history 
      SET health_rate = ROUND(
        (used_vol / (1.0 - (rem_vol / plan_vol)) / plan_vol) * 100.0, 1
      )
      WHERE plan_vol > 0 AND (1.0 - (rem_vol / plan_vol)) > 0;
    `);
  });
}

module.exports = function(db) {
  initLocationStatsTable(db);

  // [GET] /api/location-stats/history
  router.get('/history', (req, res) => {
    const sqlMaster = `
      SELECT 
        record_date, source_module, file_name,
        plan_grid, used_grid, rem_grid,
        plan_vol, used_vol, rem_vol, health_rate, created_at
      FROM location_stats_history 
      WHERE source_module = 'inv80' 
      ORDER BY record_date DESC 
      LIMIT 180
    `;

    const sqlTypeDetails = `
      SELECT record_date, loc_type, plan_grid, used_grid, rem_grid, plan_vol, used_vol, rem_vol, health_rate
      FROM location_type_stats_history
      ORDER BY record_date DESC, loc_type ASC
    `;

    db.all(sqlMaster, [], (err, masterRows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      db.all(sqlTypeDetails, [], (err2, typeRows) => {
        if (err2) return res.status(500).json({ success: false, error: err2.message });

        const typeMap = {};
        (typeRows || []).forEach(r => {
          if (!typeMap[r.record_date]) typeMap[r.record_date] = [];
          typeMap[r.record_date].push(r);
        });

        const combinedData = (masterRows || []).map(m => ({
          ...m,
          type_details: typeMap[m.record_date] || []
        }));

        res.json({ success: true, data: combinedData });
      });
    });
  });

  // [POST] /api/location-stats/save
  router.post('/save', (req, res) => {
    const { record_date, file_name, stats, type_subtotals } = req.body;
    if (!record_date || !stats) {
      return res.status(400).json({ success: false, message: '缺少 record_date 或 stats 數據' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmtMaster = db.prepare(`
        INSERT INTO location_stats_history (
          record_date, source_module, file_name,
          plan_grid, used_grid, rem_grid,
          plan_vol, used_vol, rem_vol, health_rate, created_at
        ) VALUES (?, 'inv80', ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))
        ON CONFLICT(record_date) DO UPDATE SET
          file_name = excluded.file_name,
          plan_grid = excluded.plan_grid,
          used_grid = excluded.used_grid,
          rem_grid = excluded.rem_grid,
          plan_vol = excluded.plan_vol,
          used_vol = excluded.used_vol,
          rem_vol = excluded.rem_vol,
          health_rate = excluded.health_rate,
          created_at = DATETIME('now', 'localtime')
      `);

      stmtMaster.run([
        record_date,
        file_name || 'latest_inventory.csv',
        stats.total_plan_grid || 0,
        stats.total_used_grid || 0,
        stats.total_rem_grid || 0,
        stats.total_plan_vol || 0,
        stats.total_used_vol || 0,
        stats.total_rem_vol || 0,
        parseFloat(String(stats.total_health || '0').replace('%', '')) || 0
      ]);
      stmtMaster.finalize();

      if (Array.isArray(type_subtotals) && type_subtotals.length > 0) {
        const stmtType = db.prepare(`
          INSERT INTO location_type_stats_history (
            record_date, loc_type, plan_grid, used_grid, rem_grid,
            plan_vol, used_vol, rem_vol, health_rate, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))
          ON CONFLICT(record_date, loc_type) DO UPDATE SET
            plan_grid = excluded.plan_grid,
            used_grid = excluded.used_grid,
            rem_grid = excluded.rem_grid,
            plan_vol = excluded.plan_vol,
            used_vol = excluded.used_vol,
            rem_vol = excluded.rem_vol,
            health_rate = excluded.health_rate,
            created_at = DATETIME('now', 'localtime')
        `);

        for (const t of type_subtotals) {
          if (!t.loc_type) continue;

          const planG = Number(t.plan_grid || 0);
          const usedG = Number(t.used_grid || 0);
          const remG = Number(t.rem_grid || 0);

          const planV = Number(t.plan_vol || 0);
          const usedV = Number(t.used_vol || 0);
          
          // 🌟 剩餘才數 = 剩餘空儲格數 × 單儲位才數
          const unitVol = planG > 0 ? (planV / planG) : 0;
          const remV = Number(t.rem_vol !== undefined ? t.rem_vol : (remG * unitVol));

          let calcHealth = 0;
          if (planV > 0) {
            const unrate = remV / planV;
            const denom = 1 - unrate;
            if (denom > 0) {
              calcHealth = parseFloat((((usedV / denom) / planV) * 100).toFixed(1));
            }
          }

          stmtType.run([
            record_date,
            t.loc_type,
            planG,
            usedG,
            remG,
            planV,
            usedV,
            remV,
            calcHealth
          ]);
        }
        stmtType.finalize();
      }

      db.run('COMMIT', (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: `已成功儲存 ${record_date} 之歷史快照紀錄！` });
      });
    });
  });

  // [DELETE] /api/location-stats/delete
  router.delete('/delete', (req, res) => {
    const { record_date } = req.body;
    if (!record_date) {
      return res.status(400).json({ success: false, message: '缺少 record_date 參數' });
    }

    db.serialize(() => {
      db.run('DELETE FROM location_stats_history WHERE record_date = ? AND source_module = "inv80"', [record_date]);
      db.run('DELETE FROM location_type_stats_history WHERE record_date = ?', [record_date], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: `已成功刪除 ${record_date} 之歷史快照紀錄！` });
      });
    });
  });

  return router;
};