// routes/locationStats.js
// 80 庫儲位 7 大 KPI 歷史快照專屬模組
const express = require('express');
const router = express.Router();

function initLocationStatsTable(db) {
  db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL;`);
    db.run(`PRAGMA synchronous = OFF;`);

    // 建立 80 庫儲位 7 大 KPI 歷史快照資料表
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

    db.run(`CREATE INDEX IF NOT EXISTS idx_loc_stats_date ON location_stats_history(record_date);`);
  });
}

module.exports = function(db) {
  initLocationStatsTable(db);

  // [GET] /api/location-stats/history - 取得已紀錄的歷史日期清單與快照數據
  router.get('/history', (req, res) => {
    const sql = `
      SELECT 
        record_date, source_module, file_name,
        plan_grid, used_grid, rem_grid,
        plan_vol, used_vol, rem_vol, health_rate, created_at
      FROM location_stats_history 
      WHERE source_module = 'inv80' 
      ORDER BY record_date DESC 
      LIMIT 180
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, data: rows || [] });
    });
  });

  // [POST] /api/location-stats/save - 儲存/更新指定日期的快照數據
  router.post('/save', (req, res) => {
    const { record_date, file_name, stats } = req.body;
    if (!record_date || !stats) {
      return res.status(400).json({ success: false, message: '缺少 record_date 或 stats 數據' });
    }

    const stmt = db.prepare(`
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

    stmt.run([
      record_date,
      file_name || 'latest_inventory.csv',
      stats.total_plan_grid || 0,
      stats.total_used_grid || 0,
      stats.total_rem_grid || 0,
      stats.total_plan_vol || 0,
      stats.total_used_vol || 0,
      stats.total_rem_vol || 0,
      parseFloat(String(stats.total_health || '0').replace('%', '')) || 0
    ], (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: `已成功儲存 ${record_date} 之 80 庫儲位快照！` });
    });
  });

  // [DELETE] /api/location-stats/delete - 刪除指定日期的快照紀錄
  router.delete('/delete', (req, res) => {
    const { record_date } = req.body;
    if (!record_date) {
      return res.status(400).json({ success: false, message: '缺少 record_date 參數' });
    }

    db.run('DELETE FROM location_stats_history WHERE record_date = ? AND source_module = "inv80"', [record_date], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: `已成功刪除 ${record_date} 之歷史快照紀錄！` });
    });
  });

  return router;
};