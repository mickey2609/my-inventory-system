// frontend/src/utils/floors/floor7F.js
import { SHELL_7F } from '../architecturalShells.js';

// 7F A區 AGV 小層架固定 Y 座標對照表（1座AGV貨架 = 2排，第41~42排為走道）
// 對柱子排數：43~44(y=12m)、31~32(y=24m)、19~20(y=36m)、7~8(y=48m)
const AGV_M_LAYOUT = [
  // 北側第1柱跨（y = 0 ~ 12m）：M53(單排未使用) + M52~M45(4組雙排)
  { num: 53, y: 1.6, unused: true },
  { num: 52, y: 3.2 }, { num: 51, y: 4.15 },
  { num: 50, y: 5.4 }, { num: 49, y: 6.35 },
  { num: 48, y: 7.6 }, { num: 47, y: 8.55 },
  { num: 46, y: 9.8 }, { num: 45, y: 10.75 },

  // 對齊 y = 12m 柱列：M44~M43（其下方 M42~M41 拿掉作為走道）
  { num: 44, y: 11.55, onCol: true }, { num: 43, y: 12.5, onCol: true },

  // 第2柱跨（y = 12 ~ 24m）：M40~M33(4組雙排)
  { num: 40, y: 15.6 }, { num: 39, y: 16.55 },
  { num: 38, y: 17.7 }, { num: 37, y: 18.65 },
  { num: 36, y: 19.8 }, { num: 35, y: 20.75 },
  { num: 34, y: 21.9 }, { num: 33, y: 22.85 },

  // 對齊 y = 24m 柱列：M32~M31
  { num: 32, y: 23.55, onCol: true }, { num: 31, y: 24.5, onCol: true },

  // 第3柱跨（y = 24 ~ 36m）：M30~M21(5組雙排)
  { num: 30, y: 25.6 }, { num: 29, y: 26.55 },
  { num: 28, y: 27.6 }, { num: 27, y: 28.55 },
  { num: 26, y: 29.6 }, { num: 25, y: 30.55 },
  { num: 24, y: 31.6 }, { num: 23, y: 32.55 },
  { num: 22, y: 33.6 }, { num: 21, y: 34.55 },

  // 對齊 y = 36m 柱列：M20~M19
  { num: 20, y: 35.55, onCol: true }, { num: 19, y: 36.5, onCol: true },

  // 第4柱跨（y = 36 ~ 48m）：M18~M09(5組雙排)
  { num: 18, y: 37.6 }, { num: 17, y: 38.55 },
  { num: 16, y: 39.6 }, { num: 15, y: 40.55 },
  { num: 14, y: 41.6 }, { num: 13, y: 42.55 },
  { num: 12, y: 43.6 }, { num: 11, y: 44.55 },
  { num: 10, y: 45.6 }, { num: 9, y: 46.55 },

  // 對齊 y = 48m 柱列：M08~M07
  { num: 8, y: 47.55, onCol: true }, { num: 7, y: 48.5, onCol: true },

  // 南側第5柱跨（y = 48 ~ 60m）：M06~M01(3組雙排)
  { num: 6, y: 50.0 }, { num: 5, y: 50.95 },
  { num: 4, y: 52.3 }, { num: 3, y: 53.25 },
  { num: 2, y: 54.6 }, { num: 1, y: 55.55 }
];

// 產生 A 區 AGV 小層架橫排（對柱子排數自動縮短東端以避開結構柱）
function buildAgvMRows(startNum, endNum, x, w, suffix, shortenOnCol = false) {
  return AGV_M_LAYOUT
    .filter((item) => item.num <= startNum && item.num >= endNum)
    .map((item) => {
      const code = `M${String(item.num).padStart(2, '0')}`;
      const rowW = shortenOnCol && item.onCol ? Number((w - 1.6).toFixed(2)) : w;
      const prefixTag = item.unused ? '不使用 ' : '';
      return {
        x,
        y: item.y,
        w: rowW,
        h: 0.85,
        label: `${prefixTag}80${code}${suffix}`,
        xCode: code
      };
    });
}

// 產生重型層架橫向背靠背雙排與單排（B/C/D區通用）
function buildHeavyNRows({
  startNum,
  endNum,
  startY,
  eastX,
  defaultW,
  prefix = 'N',
  rangeSuffix = '001~075',
  layerSuffix = 'A~B',
  closed = false,
  customWMap = {}
}) {
  const rows = [];
  let y = startY;
  let pairIdx = 0;

  for (let n = startNum; n >= endNum; n--) {
    const code = `${prefix}${String(n).padStart(2, '0')}`;
    const rowW = customWMap[n] ?? defaultW;
    const statusTag = closed ? '關閉中 ' : '';
    rows.push({
      x: Number((eastX - rowW).toFixed(2)),
      y: Number(y.toFixed(2)),
      w: rowW,
      h: 1.05,
      label: `${statusTag}80${code}${rangeSuffix}${layerSuffix}`,
      xCode: code
    });

    if (pairIdx % 2 === 0) {
      y += 1.15;
    } else {
      y += 2.05;
    }
    pairIdx++;
  }
  return rows;
}

// ==================== 7F A區貨架 ====================
const RACKS_7F_A_AGV = [
  // 第1段（最靠東側，對柱排數縮短避柱）：001~052 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 70.5, 12.5, '001~052A~E', true),
  // 第2段：056~067 A~F（M01~M53）
  ...buildAgvMRows(53, 1, 56.0, 12.5, '056~067A~F', false),
  // 第3段：068~079 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 41.5, 12.5, '068~079A~E', false),
  // 第4段（靠西側煙管旁）：080~085 A~E（M43~M53）
  ...buildAgvMRows(53, 43, 30.0, 9.5, '080~085A~E', false)
];

// A區西側重型層架（N69~N55）：依柱位分為 67~69、63~66、59~62、55~58
const build7FAHeavy = (layerSuffix) => {
  const layout = [
    // y = 12 ~ 24m 柱跨（68~69 置中於柱間 y = 18m，67 靠南柱）
    { num: 69, y: 16.9, range: '052~072' },
    { num: 68, y: 18.1, range: '052~072' },
    { num: 67, y: 22.1, range: '052~072' },

    // y = 24 ~ 36m 柱跨（63~66，64~65 置中於柱間 y = 30m）
    { num: 66, y: 24.8, range: '052~072' },
    { num: 65, y: 28.9, range: '052~072' },
    { num: 64, y: 30.1, range: '052~072' },
    { num: 63, y: 34.1, range: '052~072' },

    // y = 36 ~ 48m 柱跨（59~62，60~61 置中於柱間 y = 42m）
    { num: 62, y: 36.8, range: '052~072' },
    { num: 61, y: 40.9, range: '052~072' },
    { num: 60, y: 42.1, range: '052~072' },
    { num: 59, y: 46.1, range: '052~072' },

    // y = 48 ~ 60m 柱跨（55~58，56 與 55 西側避讓排煙管道）
    { num: 58, y: 48.8, range: '052~072' },
    { num: 57, y: 52.4, range: '052~075', w: 28.0 },
    { num: 56, y: 53.6, range: '052~069', w: 22.5 },
    { num: 55, y: 57.2, range: '055~069', w: 21.0, eastX: 27.5 }
  ];

  return layout.map((item) => {
    const code = `N${String(item.num).padStart(2, '0')}`;
    const rowW = item.w ?? 27.5;
    const eastX = item.eastX ?? 28.5;
    return {
      x: Number((eastX - rowW).toFixed(2)),
      y: item.y,
      w: rowW,
      h: 1.05,
      label: `80${code}${item.range}${layerSuffix}`,
      xCode: code
    };
  });
};

// ==================== 7F B區貨架（N53~N35） ====================
const build7FBHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 53,
    endNum: 35,
    startY: 7.2,
    eastX: 84.0,
    defaultW: 83.0,
    prefix: 'N',
    rangeSuffix: '027~075',
    layerSuffix,
    customWMap: {
      37: 48.0,
      36: 48.0,
      35: 48.0
    }
  });

// ==================== 7F C區貨架（N34~N15） ====================
const build7FCHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 34,
    endNum: 15,
    startY: 2.0,
    eastX: 90.0,
    defaultW: 89.0,
    prefix: 'N',
    rangeSuffix: '001~075',
    layerSuffix,
    customWMap: {
      34: 54.0,
      33: 60.0
    }
  });

// ==================== 7F D區貨架（N14~N01 + 靠南側關閉中 S05~S01） ====================
const build7FDHeavy = (layerSuffix) => [
  ...buildHeavyNRows({
    startNum: 14,
    endNum: 1,
    startY: 2.0,
    eastX: 90.0,
    defaultW: 89.0,
    prefix: 'N',
    rangeSuffix: '001~075',
    layerSuffix
  }),
  ...buildHeavyNRows({
    startNum: 5,
    endNum: 1,
    startY: 46.8,
    eastX: 90.0,
    defaultW: 65.0,
    prefix: 'S',
    rangeSuffix: '001~056',
    layerSuffix,
    closed: true,
    customWMap: {
      1: 56.0
    }
  })
];

export const FLOOR_7F = {
  floor: '7F',
  title: '7F 全層儲區（東側朝右橫向｜A～D區｜柱距12m）',
  orientation: 'east-right',
  zones: [
    { id: '7F-A', label: 'A區 (撿貨區｜M01~53 + N55~69 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-A'] },
    { id: '7F-A-STORAGE', label: 'A區 (庫區｜N55~69 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-A'] },
    { id: '7F-B', label: 'B區 (撿貨區｜N35~53 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-B'] },
    { id: '7F-B-STORAGE', label: 'B區 (庫區｜N35~53 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-B'] },
    { id: '7F-C', label: 'C區 (撿貨區｜N15~34 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-C'] },
    { id: '7F-C-STORAGE', label: 'C區 (庫區｜N15~34 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-C'] },
    { id: '7F-D', label: 'D區 (撿貨區｜N01~14 A~B + S01~05關閉)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-D'] },
    { id: '7F-D-STORAGE', label: 'D區 (庫區｜N01~14 C~E + S01~05關閉)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 9.5, shell: SHELL_7F['7F-D'] }
  ],
  zoneRacks: {
    '7F-A': [...RACKS_7F_A_AGV, ...build7FAHeavy('A~B')],
    '7F-A-STORAGE': build7FAHeavy('C~E'),
    '7F-B': build7FBHeavy('A~B'),
    '7F-B-STORAGE': build7FBHeavy('C~E'),
    '7F-C': build7FCHeavy('A~B'),
    '7F-C-STORAGE': build7FCHeavy('C~E'),
    '7F-D': build7FDHeavy('A~B'),
    '7F-D-STORAGE': build7FDHeavy('C~E')
  },
  i: []
};