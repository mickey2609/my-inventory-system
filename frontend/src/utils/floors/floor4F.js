// frontend/src/utils/floors/floor4F.js
import { SHELL_4F } from '../architecturalShells.js';

export const FLOOR_4F = {
  floor: '4F',
  title: '4F 獨立儲區（7.2m × 6.3m｜入口右下角）',
  orientation: 'east-up',
  zones: [
    { id: '4F-MAIN', label: '4F 庫房 (80H01~18)', ruleFloor: '4F', defaultRole: 'PICK', meterMode: true, pxPerM: 85, shell: SHELL_4F }
  ],
  zoneRacks: {
    '4F-MAIN': [
      // 上方橫排（由左至右：80H06 ~ 80H03）
      { x: 0.6, y: 0, w: 1.5, h: 0.6, label: '80H06', xCode: 'H06' },
      { x: 2.1, y: 0, w: 1.5, h: 0.6, label: '80H05', xCode: 'H05' },
      { x: 3.6, y: 0, w: 1.5, h: 0.6, label: '80H04', xCode: 'H04' },
      { x: 5.1, y: 0, w: 1.5, h: 0.6, label: '80H03', xCode: 'H03' },

      // 左牆直排（由上至下：80H07 ~ 80H09）
      { x: 0, y: 0.6, w: 0.6, h: 1.4, label: '80H07', xCode: 'H07' },
      { x: 0, y: 2.0, w: 0.6, h: 1.4, label: '80H08', xCode: 'H08' },
      { x: 0, y: 3.4, w: 0.6, h: 1.4, label: '80H09', xCode: 'H09' },

      // 右牆直排（由上至下：80H02 ~ 80H01）
      { x: 6.6, y: 1.4, w: 0.6, h: 1.4, label: '80H02', xCode: 'H02' },
      { x: 6.6, y: 2.8, w: 0.6, h: 1.4, label: '80H01', xCode: 'H01' },

      // 中左雙排島（背靠背：80H10~11 / 80H12~13）
      { x: 1.7, y: 1.4, w: 0.65, h: 1.4, label: '80H10', xCode: 'H10' },
      { x: 1.7, y: 2.8, w: 0.65, h: 1.4, label: '80H11', xCode: 'H11' },
      { x: 2.35, y: 1.4, w: 0.65, h: 1.4, label: '80H12', xCode: 'H12' },
      { x: 2.35, y: 2.8, w: 0.65, h: 1.4, label: '80H13', xCode: 'H13' },

      // 中右雙排島（背靠背：80H14~15 / 80H16~17）
      { x: 4.2, y: 1.4, w: 0.65, h: 1.4, label: '80H14', xCode: 'H14' },
      { x: 4.2, y: 2.8, w: 0.65, h: 1.4, label: '80H15', xCode: 'H15' },
      { x: 4.85, y: 1.4, w: 0.65, h: 1.4, label: '80H16', xCode: 'H16' },
      { x: 4.85, y: 2.8, w: 0.65, h: 1.4, label: '80H17', xCode: 'H17' },

      // 下方長排（緊鄰入口左側：80H18 小藍格）
      { x: 0, y: 5.7, w: 6.0, h: 0.6, label: '80H18(小藍格)', xCode: 'H18' }
    ]
  },
  i: []
};