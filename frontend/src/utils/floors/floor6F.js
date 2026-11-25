// frontend/src/utils/floors/floor6F.js
import { SHELL_6F } from '../architecturalShells.js';

function buildVerticalRows(startNum, endNum, startX, stepX, y, h, suffix, disabledNums = []) {
  const rows = [];
  const step = startNum >= endNum ? -1 : 1;
  let idx = 0;
  for (let n = startNum; step > 0 ? n <= endNum : n >= endNum; n += step) {
    const code = `L${String(n).padStart(2, '0')}`;
    const isOff = disabledNums.includes(n);
    rows.push({
      x: Number((startX + idx * stepX).toFixed(2)),
      y,
      w: Number((stepX - 0.1).toFixed(2)),
      h,
      label: `${isOff ? '不使用 ' : ''}80${code}${suffix}`,
      xCode: code
    });
    idx++;
  }
  return rows;
}

// 6F B區重型層架（K01~K05）
const RACKS_6F_B_K = [
  { x: 13.0, y: 0.8, w: 38.0, h: 1.3, label: '80K01061A~092C', xCode: 'K01' },
  { x: 14.8, y: 3.4, w: 36.2, h: 1.3, label: '80K02061A~090C', xCode: 'K02' },
  { x: 14.8, y: 5.2, w: 36.2, h: 1.3, label: '80K03061A~090C', xCode: 'K03' },
  { x: 14.8, y: 8.0, w: 29.8, h: 1.3, label: '80K04057A~090C', xCode: 'K04' },
  // 80K05 排（依 12m 柱位分為三段）
  { x: 14.8, y: 10.2, w: 8.6, h: 1.3, label: '80K05085A~090C', xCode: 'K05' },
  { x: 24.6, y: 10.2, w: 10.8, h: 1.3, label: '80K05075A~082C', xCode: 'K05' },
  { x: 36.6, y: 10.2, w: 8.4, h: 1.3, label: '80K05067A~072C', xCode: 'K05' }
];

// 6F C區重型層架（K01~K05）
const RACKS_6F_C_K = [
  { x: 9.0, y: 0.8, w: 38.0, h: 1.3, label: '80K01027A~058C', xCode: 'K01' },
  { x: 9.0, y: 3.4, w: 36.2, h: 1.3, label: '80K02029A~058C', xCode: 'K02' },
  { x: 9.0, y: 5.2, w: 36.2, h: 1.3, label: '80K03029A~058C', xCode: 'K03' },
  { x: 15.4, y: 8.0, w: 29.8, h: 1.3, label: '80K04029A~052C', xCode: 'K04' },
  // 80K05 排（依 12m 柱位分為三段）
  { x: 15.0, y: 10.2, w: 8.4, h: 1.3, label: '80K05047A~052C', xCode: 'K05' },
  { x: 24.6, y: 10.2, w: 10.8, h: 1.3, label: '80K05037A~044C', xCode: 'K05' },
  { x: 36.6, y: 10.2, w: 8.6, h: 1.3, label: '80K05029A~034C', xCode: 'K05' }
];

export const FLOOR_6F = {
  floor: '6F',
  title: '6F 東側夾層（B～D區｜柱距12m）',
  orientation: 'east-up',
  zones: [
    { id: '6F-B', label: 'B區 (撿貨區)', ruleFloor: '6F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_6F['6F-B'] },
    { id: '6F-B-STORAGE', label: 'B區 (庫區｜K01~05 C層)', ruleFloor: '6F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 20, shell: SHELL_6F['6F-B'] },
    { id: '6F-C', label: 'C區 (撿貨區)', ruleFloor: '6F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_6F['6F-C'] },
    { id: '6F-C-STORAGE', label: 'C區 (庫區｜K01~05 C層)', ruleFloor: '6F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 20, shell: SHELL_6F['6F-C'] },
    { id: '6F-D', label: 'D區 (撿貨區)', ruleFloor: '6F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_6F['6F-D'] }
  ],
  zoneRacks: {
    // ==================== 6F B區（撿貨區：K01~05 下層 ＋ L84~62） ====================
    '6F-B': [
      ...RACKS_6F_B_K,
      ...buildVerticalRows(84, 75, 13.6, 0.96, 15.6, 8.0, '001A~005F', [84]),
      ...buildVerticalRows(74, 71, 24.4, 0.96, 15.6, 6.2, '002A~005F'),
      ...buildVerticalRows(70, 62, 28.3, 0.90, 15.6, 8.0, '001A~005F', [62])
    ],
    // ==================== 6F B區（庫區：僅顯示 K01~05 重型層架 C 層） ====================
    '6F-B-STORAGE': RACKS_6F_B_K,

    // ==================== 6F C區（撿貨區：K01~05 下層 ＋ L60~31） ====================
    '6F-C': [
      ...RACKS_6F_C_K,
      ...buildVerticalRows(60, 53, 24.4, 0.96, 15.6, 8.0, '001A~050E'),
      ...buildVerticalRows(52, 49, 32.1, 0.94, 15.6, 6.2, '002A~050E'),
      ...buildVerticalRows(48, 39, 36.6, 0.96, 15.6, 8.0, '001A~050E'),
      ...buildVerticalRows(38, 31, 47.2, 0.96, 15.6, 8.0, '001A~050E')
    ],
    // ==================== 6F C區（庫區：僅顯示 K01~05 重型層架 C 層） ====================
    '6F-C-STORAGE': RACKS_6F_C_K,

    // ==================== 6F D區（80L30~01 上下兩段直排） ====================
    '6F-D': [
      ...buildVerticalRows(30, 21, 13.4, 0.98, 0.8, 12.2, '021A~050F'),
      ...buildVerticalRows(20, 9, 24.4, 0.94, 0.8, 12.2, '021A~050C'),
      ...buildVerticalRows(8, 7, 36.6, 0.96, 0.8, 10.2, '021A~050C'),
      ...buildVerticalRows(6, 1, 38.6, 0.96, 0.8, 12.2, '021A~050C'),
      ...buildVerticalRows(30, 21, 13.4, 0.98, 15.6, 8.0, '001A~020C'),
      ...buildVerticalRows(20, 9, 24.4, 0.94, 15.6, 8.0, '001A~020C'),
      ...buildVerticalRows(8, 3, 36.6, 0.92, 15.6, 4.5, '001A~020C')
    ]
  },
  i: []
};