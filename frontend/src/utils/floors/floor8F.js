// frontend/src/utils/floors/floor8F.js
import { SHELL_8F } from '../architecturalShells.js';

function buildVerticalQRows(startNum, endNum, startX, stepX, y, h, suffix, disabledNums = []) {
  const rows = [];
  const step = startNum >= endNum ? -1 : 1;
  let idx = 0;
  for (let n = startNum; step > 0 ? n <= endNum : n >= endNum; n += step) {
    const code = `Q${String(n).padStart(2, '0')}`;
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

// 8F A區小層架與小藍格（R42 由左至右遞減至 R11，分為北段 021~056/062 與南段 001~020）
function build8FARacks() {
  const rows = [
    // 左側電梯與梯間之間凹槽：R43 落地儲位
    { x: 6.2, y: 12.6, w: 5.6, h: 4.0, label: '80R43001A~008A(落地儲位*8)', xCode: 'R43' }
  ];

  // 由左(R42)至右(R11)的 X 座標與分段配置（避開 x=24m、x=36m 結構柱）
  const cols = [
    // R42 ~ R35（x = 15.6 ~ 23.2m）
    { n: 42, x: 15.6 }, { n: 41, x: 16.5 },
    { n: 40, x: 17.6 }, { n: 39, x: 18.5 },
    { n: 38, x: 19.6 }, { n: 37, x: 20.5 },
    { n: 36, x: 21.6 }, { n: 35, x: 22.5 },

    // R34 ~ R33（緊鄰 x = 24m 柱位右側，北段底端內縮避柱）
    { n: 34, x: 24.4, topH: 9.2 }, { n: 33, x: 25.3, topH: 9.2 },

    // R32 ~ R23（x = 26.4 ~ 35.6m）
    { n: 32, x: 26.4 }, { n: 31, x: 27.3 },
    { n: 30, x: 28.4 }, { n: 29, x: 29.3 },
    { n: 28, x: 30.4 }, { n: 27, x: 31.3 },
    { n: 26, x: 32.4 }, { n: 25, x: 33.3 },
    { n: 24, x: 34.4 }, { n: 23, x: 35.3 },

    // R22 ~ R21（緊鄰 x = 36m 柱位右側、室外機下方，上下皆略短）
    { n: 22, x: 36.5, topY: 2.6, topH: 8.4, topRange: '021~052A~B', botH: 7.4, botRange: '001~015A~B' },
    { n: 21, x: 37.4, topY: 2.6, topH: 8.4, topRange: '021~052A~B', botH: 7.4, botRange: '001~015A~B' },

    // R20 ~ R13（室外機下方，北段由 y = 2.6m 起算）
    { n: 20, x: 38.6, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 19, x: 39.5, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 18, x: 40.6, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 17, x: 41.5, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 16, x: 42.6, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 15, x: 43.5, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 14, x: 44.6, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },
    { n: 13, x: 45.5, topY: 2.6, topH: 9.8, topRange: '021~052A~B' },

    // R12 ~ R11（北段為小藍格 A~L層 021~062，南段為小層架 A~B層 001~020）
    { n: 12, x: 46.6, topY: 2.6, topH: 9.8, topRange: '021~062A~L(小藍格)' },
    { n: 11, x: 47.5, topY: 2.6, topH: 9.8, topRange: '021~062A~L(小藍格)' }
  ];

  cols.forEach((c) => {
    const code = `R${String(c.n).padStart(2, '0')}`;
    const topY = c.topY ?? 1.2;
    const topH = c.topH ?? 11.2;
    const topRange = c.topRange ?? '021~056A~B';
    const botH = c.botH ?? 9.2;
    const botRange = c.botRange ?? '001~020A~B';

    // 北段（上方）
    rows.push({
      x: c.x,
      y: topY,
      w: 0.85,
      h: topH,
      label: `80${code}${topRange}`,
      xCode: code
    });

    // 南段（下方）
    rows.push({
      x: c.x,
      y: 14.2,
      w: 0.85,
      h: botH,
      label: `80${code}${botRange}`,
      xCode: code
    });
  });

  return rows;
}

// 8F B區重型層架（R01~R05）
const RACKS_8F_B_R = [
  { x: 13.0, y: 0.8, w: 44.5, h: 1.3, label: '80R01063A~098C', xCode: 'R01' },
  { x: 15.4, y: 3.4, w: 29.2, h: 1.3, label: '80R02075A~096C', xCode: 'R02' },
  { x: 15.4, y: 5.2, w: 29.2, h: 1.3, label: '80R03075A~096C', xCode: 'R03' },
  { x: 15.4, y: 8.0, w: 29.2, h: 1.3, label: '80R04075A~096C', xCode: 'R04' },
  // 80R05 排（依 12m 柱位分為三段）
  { x: 15.4, y: 10.2, w: 8.0, h: 1.3, label: '80R05091A~096C', xCode: 'R05' },
  { x: 24.6, y: 10.2, w: 10.8, h: 1.3, label: '80R05081A~088C', xCode: 'R05' },
  { x: 36.6, y: 10.2, w: 8.0, h: 1.3, label: '80R05075A~078C', xCode: 'R05' }
];

// 8F C區重型層架（R01~R05）
const RACKS_8F_C_R = [
  { x: 1.5, y: 0.8, w: 45.5, h: 1.3, label: '80R01027A~062C', xCode: 'R01' },
  { x: 15.4, y: 3.4, w: 29.2, h: 1.3, label: '80R02029A~050C', xCode: 'R02' },
  { x: 15.4, y: 5.2, w: 29.2, h: 1.3, label: '80R03029A~050C', xCode: 'R03' },
  { x: 15.4, y: 8.0, w: 29.2, h: 1.3, label: '80R04029A~050C', xCode: 'R04' },
  // 80R05 排（依 12m 柱位分為三段）
  { x: 15.4, y: 10.2, w: 8.0, h: 1.3, label: '80R05047A~050C', xCode: 'R05' },
  { x: 24.6, y: 10.2, w: 10.8, h: 1.3, label: '80R05037A~044C', xCode: 'R05' },
  { x: 36.6, y: 10.2, w: 8.0, h: 1.3, label: '80R05029A~034C', xCode: 'R05' }
];

// 8F D區重型層架（R01~R05）
const RACKS_8F_D_R = [
  { x: 13.0, y: 0.8, w: 31.6, h: 1.3, label: '80R01001A~026C', xCode: 'R01' },
  { x: 15.4, y: 3.4, w: 26.8, h: 1.3, label: '80R02003A~024C', xCode: 'R02' },
  { x: 15.4, y: 5.2, w: 26.8, h: 1.3, label: '80R03003A~024C', xCode: 'R03' },
  { x: 15.4, y: 8.0, w: 26.8, h: 1.3, label: '80R04003A~024C', xCode: 'R04' },
  // 80R05 排（依 12m 柱位分為三段）
  { x: 15.4, y: 10.2, w: 8.0, h: 1.3, label: '80R05019A~024C', xCode: 'R05' },
  { x: 24.6, y: 10.2, w: 10.8, h: 1.3, label: '80R05009A~016C', xCode: 'R05' },
  { x: 36.6, y: 10.2, w: 5.6, h: 1.3, label: '80R05003A~006C', xCode: 'R05' }
];

export const FLOOR_8F = {
  floor: '8F',
  title: '8F 東側夾層（A～D區｜柱距12m）',
  orientation: 'east-up',
  zones: [
    { id: '8F-A', label: 'A區 (撿貨區｜R11~43)', ruleFloor: '8F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-A'] },
    { id: '8F-B', label: 'B區 (撿貨區｜R01~05 A~B + Q61~84)', ruleFloor: '8F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-B'] },
    { id: '8F-B-STORAGE', label: 'B區 (庫區｜R01~05 C層)', ruleFloor: '8F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-B'] },
    { id: '8F-C', label: 'C區 (撿貨區｜R01~05 A~B + Q31~60)', ruleFloor: '8F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-C'] },
    { id: '8F-C-STORAGE', label: 'C區 (庫區｜R01~05 C層)', ruleFloor: '8F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-C'] },
    { id: '8F-D', label: 'D區 (撿貨區｜R01~05 A~B + Q01~30)', ruleFloor: '8F', defaultRole: 'PICK', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-D'] },
    { id: '8F-D-STORAGE', label: 'D區 (庫區｜R01~05 C層)', ruleFloor: '8F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 20, shell: SHELL_8F['8F-D'] }
  ],
  zoneRacks: {
    // ==================== 8F A區（小藍格 R11~12 + 小層架 R11~42 + R43） ====================
    '8F-A': build8FARacks(),

    // ==================== 8F B區（重型層架 R01~05 + 小層架 Q84~61） ====================
    '8F-B': [
      ...RACKS_8F_B_R,
      ...buildVerticalQRows(84, 73, 13.6, 0.90, 15.6, 8.0, '001A~005F'),
      ...buildVerticalQRows(72, 71, 24.4, 0.90, 15.6, 6.2, '002A~005F'),
      ...buildVerticalQRows(70, 61, 26.2, 0.96, 15.6, 8.0, '001A~005F', [61])
    ],
    '8F-B-STORAGE': RACKS_8F_B_R,

    // ==================== 8F C區（重型層架 R01~05 + 小層架 Q60~31） ====================
    '8F-C': [
      ...RACKS_8F_C_R,
      ...buildVerticalQRows(60, 51, 24.4, 0.96, 15.6, 8.0, '001A~005E'),
      ...buildVerticalQRows(50, 49, 34.0, 0.94, 15.6, 6.2, '002A~005E'),
      ...buildVerticalQRows(48, 37, 36.6, 0.96, 15.6, 8.0, '001A~005E'),
      ...buildVerticalQRows(36, 31, 48.6, 0.96, 15.6, 8.0, '001A~005E')
    ],
    '8F-C-STORAGE': RACKS_8F_C_R,

    // ==================== 8F D區（重型層架 R01~05 + 小層架 Q30~01） ====================
    '8F-D': [
      ...RACKS_8F_D_R,
      ...buildVerticalQRows(30, 19, 13.6, 0.90, 15.6, 8.0, '001A~005E'),
      ...buildVerticalQRows(18, 7, 24.6, 0.96, 15.6, 8.0, '001A~005E'),
      ...buildVerticalQRows(6, 1, 36.4, 0.90, 15.6, 4.5, '001A~005E', [1])
    ],
    '8F-D-STORAGE': RACKS_8F_D_R
  },
  i: []
};