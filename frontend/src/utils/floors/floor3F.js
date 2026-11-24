// frontend/src/utils/floors/floor3F.js
import { SHELL_3F_BC } from '../architecturalShells.js';

// B/C區重型層架（48m × 24m，所有儲位嚴格落在 12m 柱子與柱子之間）
const RACKS_3F_BC = [
  // ==================== B區（北半跨 y = 0m ~ 12m｜80E05 ~ 80E08） ====================
  // 80E08 排（整排貫通，位於北側柱列內側 y = 1.0m）
  { x: 12.6, y: 1.0, w: 46.8, h: 1.6, label: '80E08001A~039E', xCode: 'E08' },

  // 80E07 排（西段 + 東段）
  { x: 12.6, y: 4.4, w: 27.6, h: 1.6, label: '80E07017A~039E', xCode: 'E07' },
  { x: 42.6, y: 4.4, w: 16.8, h: 1.6, label: '80E07001A~013E', xCode: 'E07' },

  // 80E06 排（背靠背）
  { x: 12.6, y: 6.2, w: 27.6, h: 1.6, label: '80E06017A~039E', xCode: 'E06' },
  { x: 42.6, y: 6.2, w: 16.8, h: 1.6, label: '80E06001A~013E', xCode: 'E06' },

  // 80E05 排（位於中央柱列北側 y = 9.6m，不壓柱）
  { x: 12.6, y: 9.6, w: 27.6, h: 1.6, label: '80E05017A~039E', xCode: 'E05' },
  { x: 42.6, y: 9.6, w: 16.8, h: 1.6, label: '80E05001A~013E', xCode: 'E05' },

  // ==================== C區（南半跨 y = 12m ~ 24m｜80E01 ~ 80E04） ====================
  // 80E04 排（位於中央柱列南側 y = 12.8m，不壓柱）
  { x: 12.6, y: 12.8, w: 27.6, h: 1.6, label: '80E04017A~039E', xCode: 'E04' },
  { x: 42.6, y: 12.8, w: 16.8, h: 1.6, label: '80E04001A~013E', xCode: 'E04' },

  // 80E03 排
  { x: 12.6, y: 16.2, w: 27.6, h: 1.6, label: '80E03017A~039E', xCode: 'E03' },
  { x: 42.6, y: 16.2, w: 16.8, h: 1.6, label: '80E03001A~013E', xCode: 'E03' },

  // 80E02 排（背靠背）
  { x: 12.6, y: 18.0, w: 27.6, h: 1.6, label: '80E02017A~039E', xCode: 'E02' },
  { x: 42.6, y: 18.0, w: 16.8, h: 1.6, label: '80E02001A~013E', xCode: 'E02' },

  // 80E01 排（四段式，各自落在 4 個 12m 柱跨內）
  { x: 12.8, y: 21.4, w: 10.4, h: 1.6, label: '80E01031A~038E', xCode: 'E01' },
  { x: 24.8, y: 21.4, w: 10.4, h: 1.6, label: '80E01021A~028E', xCode: 'E01' },
  { x: 36.8, y: 21.4, w: 10.4, h: 1.6, label: '80E01012A~018E', xCode: 'E01' },
  { x: 48.8, y: 21.4, w: 10.4, h: 1.6, label: '80E01002A~009E', xCode: 'E01' }
];

export const FLOOR_3F = {
  floor: '3F',
  title: '3F B/C區重型層架（東側朝右橫向｜柱距12m）',
  orientation: 'east-right',
  zones: [
    { id: '3F-BC-PICK', label: 'B/C區 (撿貨區)', ruleFloor: '3F', defaultRole: 'PICK', meterMode: true, pxPerM: 17.5, shell: SHELL_3F_BC },
    { id: '3F-BC-STORAGE', label: 'B/C區 (庫區)', ruleFloor: '3F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 17.5, shell: SHELL_3F_BC }
  ],
  zoneRacks: {
    '3F-BC-PICK': RACKS_3F_BC,
    '3F-BC-STORAGE': RACKS_3F_BC
  },
  i: []
};