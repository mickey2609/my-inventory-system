// frontend/src/utils/floors/floor7F.js
import { SHELL_7F } from '../architecturalShells.js';

// 7F A區 AGV 小層架固定 Y 座標對照表（1座AGV貨架 = 2排，第41~42排為走道）
// 對柱子排數：43~44(y=12m)、31~32(y=24m)、19~20(y=36m)、7~8(y=48m)
const AGV_M_LAYOUT = [
  { num: 53, y: 1.6, unused: true },
  { num: 52, y: 3.2 }, { num: 51, y: 4.15 },
  { num: 50, y: 5.4 }, { num: 49, y: 6.35 },
  { num: 48, y: 7.6 }, { num: 47, y: 8.55 },
  { num: 46, y: 9.8 }, { num: 45, y: 10.75 },

  { num: 44, y: 11.55, onCol: true }, { num: 43, y: 12.5, onCol: true },

  { num: 40, y: 15.6 }, { num: 39, y: 16.55 },
  { num: 38, y: 17.7 }, { num: 37, y: 18.65 },
  { num: 36, y: 19.8 }, { num: 35, y: 20.75 },
  { num: 34, y: 21.9 }, { num: 33, y: 22.85 },

  { num: 32, y: 23.55, onCol: true }, { num: 31, y: 24.5, onCol: true },

  { num: 30, y: 25.6 }, { num: 29, y: 26.55 },
  { num: 28, y: 27.6 }, { num: 27, y: 28.55 },
  { num: 26, y: 29.6 }, { num: 25, y: 30.55 },
  { num: 24, y: 31.6 }, { num: 23, y: 32.55 },
  { num: 22, y: 33.6 }, { num: 21, y: 34.55 },

  { num: 20, y: 35.55, onCol: true }, { num: 19, y: 36.5, onCol: true },

  { num: 18, y: 37.6 }, { num: 17, y: 38.55 },
  { num: 16, y: 39.6 }, { num: 15, y: 40.55 },
  { num: 14, y: 41.6 }, { num: 13, y: 42.55 },
  { num: 12, y: 43.6 }, { num: 11, y: 44.55 },
  { num: 10, y: 45.6 }, { num: 9, y: 46.55 },

  { num: 8, y: 47.55, onCol: true }, { num: 7, y: 48.5, onCol: true },

  { num: 6, y: 50.0 }, { num: 5, y: 50.95 },
  { num: 4, y: 52.3 }, { num: 3, y: 53.25 },
  { num: 2, y: 54.6 }, { num: 1, y: 55.55 }
];

function buildAgvMRows(startNum, endNum, x, w, suffix, shortenOnCol = false) {
  return AGV_M_LAYOUT
    .filter((item) => item.num <= startNum && item.num >= endNum)
    .map((item) => {
      const code = `M${String(item.num).padStart(2, '0')}`;
      const rowW = shortenOnCol && item.onCol ? Number((w - 1.2).toFixed(2)) : w;
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

// A區第4段小層架（M43~M53）：總長 7.32m（6座 × 1.22m），緊貼 x=24m 牆側；M51~M53 避讓排煙管道
function buildAgvSeg4Rows() {
  return AGV_M_LAYOUT
    .filter((item) => item.num <= 53 && item.num >= 43)
    .map((item) => {
      const code = `M${String(item.num).padStart(2, '0')}`;
      const isShortByDuct = item.num >= 51;
      const prefixTag = item.unused ? '不使用 ' : '';
      return {
        x: isShortByDuct ? 28.8 : 24.5,
        y: item.y,
        w: isShortByDuct ? 3.02 : 7.32,
        h: 0.85,
        label: `${prefixTag}80${code}080~085A~E`,
        xCode: code
      };
    });
}

// ==================== 7F A區貨架 ====================
const RACKS_7F_A_AGV = [
  // 第1段：15.91m（13座 × 1.22m，東端切齊 x=84m）
  ...buildAgvMRows(53, 1, 68.09, 15.91, '001~052A~E', true),
  // 第2段：14.69m（12座 × 1.22m）
  ...buildAgvMRows(53, 1, 51.60, 14.69, '056~067A~F', false),
  // 第3段：14.69m（12座 × 1.22m）
  ...buildAgvMRows(53, 1, 35.11, 14.69, '068~079A~E', false),
  // 第4段：7.32m（6座 × 1.22m）
  ...buildAgvSeg4Rows()
];

// A區西側重型層架（N69~N55）：67~69、63~66、59~62、55~58
const build7FAHeavy = (layerSuffix) => {
  const layout = [
    { num: 69, y: 16.9, range: '052~072' },
    { num: 68, y: 18.1, range: '052~072' },
    { num: 67, y: 22.1, range: '052~072' },

    { num: 66, y: 24.8, range: '052~072' },
    { num: 65, y: 28.9, range: '052~072' },
    { num: 64, y: 30.1, range: '052~072' },
    { num: 63, y: 34.1, range: '052~072' },

    { num: 62, y: 36.8, range: '052~072' },
    { num: 61, y: 40.9, range: '052~072' },
    { num: 60, y: 42.1, range: '052~072' },
    { num: 59, y: 46.1, range: '052~072' },

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
const build7FBHeavy = (layerSuffix) => {
  const layout = [
    // y = 0 ~ 12m 柱跨（51~53，3排；N53 避讓西北排煙管道，與 N52 不一樣長）
    { num: 53, y: 4.9, x: 6.5, w: 53.5 },
    { num: 52, y: 6.1, x: 1.0, w: 59.0 },
    { num: 51, y: 10.1 },

    // y = 12 ~ 24m 柱跨（47~50，4排）
    { num: 50, y: 12.8 },
    { num: 49, y: 16.9 },
    { num: 48, y: 18.1 },
    { num: 47, y: 22.1 },

    // y = 24 ~ 36m 柱跨（43~46，4排）
    { num: 46, y: 24.8 },
    { num: 45, y: 28.9 },
    { num: 44, y: 30.1 },
    { num: 43, y: 34.1 },

    // y = 36 ~ 48m 柱跨（39~42，4排）
    { num: 42, y: 36.8 },
    { num: 41, y: 40.9 },
    { num: 40, y: 42.1 },
    { num: 39, y: 46.1 },

    // y = 48 ~ 60m 柱跨（35~38，4排；N38 移至 y=48m 柱線下方，N35~38 全部切齊 x=36m 紅線）
    { num: 38, y: 49.2, x: 25.0, w: 11.0 },
    { num: 37, y: 52.4, x: 25.0, w: 11.0 },
    { num: 36, y: 53.6, x: 25.0, w: 11.0 },
    { num: 35, y: 57.5, x: 25.0, w: 11.0 }
  ];

  return layout.map((item) => {
    const code = `N${String(item.num).padStart(2, '0')}`;
    return {
      x: item.x ?? 1.0,
      y: item.y,
      w: item.w ?? 59.0,
      h: 1.05,
      label: `80${code}027~075${layerSuffix}`,
      xCode: code
    };
  });
};

// ==================== 7F C區貨架（N34~N15） ====================
const build7FCHeavy = (layerSuffix) => {
  const layout = [
    // y = 0 ~ 12m 柱跨（31~34，4排；N32~34 切齊 x=36m 紅線，N31 位於 y=12m 柱上方延伸至 x=95m）
    { num: 34, y: 1.4, x: 25.0, w: 11.0, floorOnlyA: true },
    { num: 33, y: 5.2, x: 25.0, w: 11.0 },
    { num: 32, y: 6.4, x: 25.0, w: 11.0 },
    { num: 31, y: 10.2, x: 25.0, w: 70.0 },

    // y = 12 ~ 24m 柱跨（N27~N30 完整落在柱子與柱子之間共 4 排）
    { num: 30, y: 13.2 },
    { num: 29, y: 16.9 },
    { num: 28, y: 18.1 },
    { num: 27, y: 22.1 },

    // y = 24 ~ 36m 柱跨（23~26，4排）
    { num: 26, y: 24.8 },
    { num: 25, y: 28.9 },
    { num: 24, y: 30.1 },
    { num: 23, y: 34.1 },

    // y = 36 ~ 48m 柱跨（19~22，4排）
    { num: 22, y: 36.8 },
    { num: 21, y: 40.9 },
    { num: 20, y: 42.1 },
    { num: 19, y: 46.1 },

    // y = 48 ~ 60m 柱跨（15~18，4排；第 15~16 排避讓西側南端排煙管道較短）
    { num: 18, y: 48.8 },
    { num: 17, y: 52.4 },
    { num: 16, y: 53.6, x: 6.0, w: 89.0 },
    { num: 15, y: 57.5, x: 6.0, w: 89.0 }
  ];

  return layout
    .filter((item) => !(item.floorOnlyA && layerSuffix === 'C~E'))
    .map((item) => {
      const code = `N${String(item.num).padStart(2, '0')}`;
      const layers = item.floorOnlyA ? 'A(落地)' : layerSuffix;
      return {
        x: item.x ?? 1.0,
        y: item.y,
        w: item.w ?? 94.0,
        h: 1.05,
        label: `80${code}001~075${layers}`,
        xCode: code
      };
    });
};

// ==================== 7F D區貨架（N14~N01 + S05~S01） ====================
const build7FDHeavy = (layerSuffix) => {
  const layout = [
    // y = 0 ~ 12m 柱跨（N14落地與N14一樣短，避讓西北排煙管道）
    { prefix: 'N', num: 14, y: 1.4, x: 6.5, w: 88.5, floorOnlyA: true, tag: '落地 ' },
    { prefix: 'N', num: 14, y: 5.4, x: 6.5, w: 88.5 },
    { prefix: 'N', num: 13, y: 6.6, x: 1.0, w: 94.0 },
    { prefix: 'N', num: 12, y: 10.1 },

    // y = 12 ~ 24m 柱跨（N08~N11，4排）
    { prefix: 'N', num: 11, y: 12.8 },
    { prefix: 'N', num: 10, y: 16.9 },
    { prefix: 'N', num: 9, y: 18.1 },
    { prefix: 'N', num: 8, y: 22.1 },

    // y = 24 ~ 36m 柱跨（N04~N07，4排）
    { prefix: 'N', num: 7, y: 24.8 },
    { prefix: 'N', num: 6, y: 28.9 },
    { prefix: 'N', num: 5, y: 30.1 },
    { prefix: 'N', num: 4, y: 34.1 },

    // y = 36 ~ 48m 柱跨（S05~N03，4排）
    { prefix: 'N', num: 3, y: 36.8 },
    { prefix: 'N', num: 2, y: 40.9 },
    { prefix: 'N', num: 1, y: 42.1 },
    { prefix: 'S', num: 5, y: 46.1, closed: true, range: '001~056' },

    // y = 48 ~ 60m 柱跨（S01~S04，4排關閉中；S02與S03等長，S01切齊x=36m紅線）
    { prefix: 'S', num: 4, y: 48.8, x: 25.0, w: 70.0, closed: true, range: '001~056' },
    { prefix: 'S', num: 3, y: 52.4, x: 25.0, w: 70.0, closed: true, range: '001~056' },
    { prefix: 'S', num: 2, y: 53.6, x: 25.0, w: 70.0, closed: true, range: '001~056' },
    { prefix: 'S', num: 1, y: 57.5, x: 29.0, w: 7.0, closed: true, range: '001~056' }
  ];

  return layout
    .filter((item) => !(item.floorOnlyA && layerSuffix === 'C~E'))
    .map((item) => {
      const code = `${item.prefix}${String(item.num).padStart(2, '0')}`;
      const statusTag = item.closed ? '關閉中 ' : (item.tag || '');
      const range = item.range ?? '001~075';
      const layers = item.floorOnlyA ? 'A(落地)' : layerSuffix;
      return {
        x: item.x ?? 1.0,
        y: item.y,
        w: item.w ?? 94.0,
        h: 1.05,
        label: `${statusTag}80${code}${range}${layers}`,
        xCode: code
      };
    });
};

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