// routes/systemMonitor.js
const express = require('express');
const os = require('os');
const { exec } = require('child_process');

module.exports = function() {
  const router = express.Router();

  const historyQueue = [];
  const MAX_HISTORY = 90; // 保存過去 15 分鐘（每 10 秒 1 筆）

  // 計算 CPU 即時使用率（比對兩次時間差的 CPU 核心時間）
  function getCpuUsage() {
    return new Promise(resolve => {
      const start = os.cpus();
      setTimeout(() => {
        const end = os.cpus();
        let idleDiff = 0;
        let totalDiff = 0;

        for (let i = 0; i < start.length; i++) {
          const s = start[i].times;
          const e = end[i].times;

          const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
          const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;

          idleDiff += (e.idle - s.idle);
          totalDiff += (eTotal - sTotal);
        }

        const usage = totalDiff > 0 ? 100 - Math.round((100 * idleDiff) / totalDiff) : 0;
        resolve(Math.max(0, Math.min(100, usage)));
      }, 500);
    });
  }

  // 取得 C 槽磁碟空間（透過 Windows 原生 powershell 指令）
  function getDiskInfo() {
    return new Promise(resolve => {
      exec('powershell -NoProfile -Command "Get-PSDrive C | Select-Object Used, Free"', (err, stdout) => {
        if (err || !stdout) {
          return resolve({ usedGB: '0.0', totalGB: '0.0', usePercent: 0 });
        }
        const lines = stdout.trim().split('\n').filter(l => l.trim().length > 0);
        if (lines.length >= 2) {
          const parts = lines[lines.length - 1].trim().split(/\s+/);
          const usedBytes = parseFloat(parts[0]) || 0;
          const freeBytes = parseFloat(parts[1]) || 0;
          const totalBytes = usedBytes + freeBytes;

          const usedGB = (usedBytes / 1024 / 1024 / 1024).toFixed(1);
          const totalGB = (totalBytes / 1024 / 1024 / 1024).toFixed(1);
          const usePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
          return resolve({ usedGB, totalGB, usePercent });
        }
        resolve({ usedGB: '0.0', totalGB: '0.0', usePercent: 0 });
      });
    });
  }

  async function collectMetrics() {
    try {
      const [cpuUsage, diskInfo] = await Promise.all([
        getCpuUsage(),
        getDiskInfo()
      ]);

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const snapshot = {
        time: timeStr,
        cpu: cpuUsage,
        mem: memPercent,
        memUsedGB: (usedMem / 1024 / 1024 / 1024).toFixed(1),
        memTotalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
        diskUsedGB: diskInfo.usedGB,
        diskTotalGB: diskInfo.totalGB,
        diskUsePercent: diskInfo.usePercent,
        cpuModel: os.cpus()[0]?.model || '系統 CPU',
        cpuCores: os.cpus().length,
        uptimeSeconds: Math.floor(os.uptime())
      };

      historyQueue.push(snapshot);
      if (historyQueue.length > MAX_HISTORY) {
        historyQueue.shift();
      }
      return snapshot;
    } catch (e) {
      console.error('收集硬體指標失敗:', e.message);
      return null;
    }
  }

  // 伺服器每 10 秒取樣一次供折線圖使用
  setInterval(collectMetrics, 10000);
  collectMetrics();

  router.get('/metrics', async (req, res) => {
    const current = historyQueue[historyQueue.length - 1] || await collectMetrics();
    res.json({
      success: true,
      current,
      history: historyQueue
    });
  });

  return router;
};