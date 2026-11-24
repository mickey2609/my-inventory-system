// frontend/src/utils/floors/floor3F.js
import { SHELL_3F } from '../architecturalShells.js';

export const FLOOR_3F = {
  floor: '3F',
  title: '3F 完整大平面（東側朝右橫向｜柱距12m）',
  orientation: 'east-right',
  zones: [
    { id: '3F-A', label: 'A區', ruleFloor: '3F', defaultRole: 'CLOSED', meterMode: true, pxPerM: 9.5, shell: SHELL_3F['3F-A'] },
    { id: '3F-B', label: 'B區', ruleFloor: '3F', meterMode: true, pxPerM: 9.5, shell: SHELL_3F['3F-B'] },
    { id: '3F-C', label: 'C區', ruleFloor: '3F', meterMode: true, pxPerM: 9.5, shell: SHELL_3F['3F-C'] },
    { id: '3F-D', label: 'D區', ruleFloor: '3F', defaultRole: 'CLOSED', meterMode: true, pxPerM: 9.5, shell: SHELL_3F['3F-D'] }
  ],
  zoneRacks: {
    '3F-A': [],
    // ==================== 3F B區重型層架（x = 36m ~ 84m 共 48m，y = 46m ~ 58m 共 12m） ====================
    '3F-B': [
      // 80E08 排（整排貫通 48m）
      { x: 36, y: 46.2, w: 48, h: 1.8, label: '80E08001A~039E', xCode: 'E08' },
      // 80E07 排（西段 + 東段）
      { x: 36, y: 49.4, w: 28, h: 1.8, label: '80E07017A~039E', xCode: 'E07' },
      { x: 67, y: 49.4, w: 17, h: 1.8, label: '80E07001A~013E', xCode: 'E07' },
      // 80E06 排（背靠背）
      { x: 36, y: 51.4, w: 28, h: 1.8, label: '80E06017A~039E', xCode: 'E06' },
      { x: 67, y: 51.4, w: 17, h: 1.8, label: '80E06001A~013E', xCode: 'E06' },
      // 80E05 排（靠 B/C 交界走道）
      { x: 36, y: 54.8, w: 28, h: 1.8, label: '80E05017A~039E', xCode: 'E05' },
      { x: 67, y: 54.8, w: 17, h: 1.8, label: '80E05001A~013E', xCode: 'E05' }
    ],
    // ==================== 3F C區重型層架（x = 36m ~ 84m 共 48m，y = 2m ~ 14m 共 12m） ====================
    '3F-C': [
      // 80E04 排（靠 B/C 交界走道）
      { x: 36, y: 2.2, w: 28, h: 1.8, label: '80E04017A~039E', xCode: 'E04' },
      { x: 67, y: 2.2, w: 17, h: 1.8, label: '80E04001A~013E', xCode: 'E04' },
      // 80E03 排
      { x: 36, y: 5.6, w: 28, h: 1.8, label: '80E03017A~039E', xCode: 'E03' },
      { x: 67, y: 5.6, w: 17, h: 1.8, label: '80E03001A~013E', xCode: 'E03' },
      // 80E02 排（背靠背）
      { x: 36, y: 7.6, w: 28, h: 1.8, label: '80E02017A~039E', xCode: 'E02' },
      { x: 67, y: 7.6, w: 17, h: 1.8, label: '80E02001A~013E', xCode: 'E02' },
      // 80E01 排（四段式）
      { x: 36, y: 11.0, w: 10, h: 1.8, label: '80E01031A~038E', xCode: 'E01' },
      { x: 48, y: 11.0, w: 10, h: 1.8, label: '80E01021A~028E', xCode: 'E01' },
      { x: 61, y: 11.0, w: 10, h: 1.8, label: '80E01012A~018E', xCode: 'E01' },
      { x: 74, y: 11.0, w: 10, h: 1.8, label: '80E01002A~009E', xCode: 'E01' }
    ],
    '3F-D': []
  },
  i: []
};