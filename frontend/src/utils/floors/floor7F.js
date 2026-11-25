// frontend/src/utils/floors/floor7F.js
import { SHELL_7F } from '../architecturalShells.js';

// 產生 A 區 AGV 小層架直排（M53 由左至右遞減至 M01，跨越 12m 柱列自動留出柱位）
function buildAgvMRows(startNum, endNum, y, h, suffix) {
  const rows = [];
  let x = 3.2;
  for (let n = startNum; n >= endNum; n--) {
    // 避讓 x = 12, 24, 36, 48 的結構柱
    if (Math.abs(x - 11.8) < 0.6 || Math.abs(x - 23.8) < 0.6 || Math.abs(x - 35.8) < 0.6 || Math.abs(x - 47.8) < 0.6) {
      x += 1.0;
    }
    const code = `M${String(n).padStart(2, '0')}`;
    rows.push({
      x: Number(x.toFixed(2)),
      y,
      w: 0.85,
      h,
      label: `80${code}${suffix}`,
      xCode: code
    });
    // 背靠背雙排間距 0.9m，走道間距 1.05m
    x += (startNum - n) % 2 === 1 ? 0.9 : 1.05;
  }
  return rows;
}

// 產生重型層架背靠背雙排與單排（startNum 由左至右遞減至 endNum）
function buildHeavyNRows({
  startNum,
  endNum,
  startX,
  y,
  h,
  prefix = 'N',
  rangeSuffix = '001~075',
  layerSuffix = 'A~B',
  closed = false,
  customHMap = {}
}) {
  const rows = [];
  let x = startX;
  let pairIdx = 0;

  for (let n = startNum; n >= endNum; n--) {
    const code = `${prefix}${String(n).padStart(2, '0')}`;
    const rowH = customHMap[n] ?? h;
    const statusTag = closed ? '關閉中 ' : '';
    rows.push({
      x: Number(x.toFixed(2)),
      y,
      w: 1.05,
      h: rowH,
      label: `${statusTag}80${code}${rangeSuffix}${layerSuffix}`,
      xCode: code
    });

    if (pairIdx % 2 === 0) {
      // 同組背靠背緊鄰
      x += 1.15;
    } else {
      // 走道間距
      x += 2.05;
    }
    pairIdx++;
  }
  return rows;
}

// ==================== 7F A區貨架 ====================
const RACKS_7F_A_AGV = [
  // 第1段：001~052 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 49.0, 12.5, '001~052A~E'),
  // 第2段：056~067 A~F（M01~M53）
  ...buildAgvMRows(53, 1, 63.5, 12.5, '056~067A~F'),
  // 第3段：068~079 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 78.0, 12.5, '068~079A~E'),
  // 第4段：080~085 A~E（左下角煙管上方 M43~M53）
  ...buildAgvMRows(53, 43, 92.5, 9.5, '080~085A~E')
];

const build7FAHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 69,
    endNum: 55,
    startX: 15.0,
    y: 103.5,
    h: 27.5,
    prefix: 'N',
    rangeSuffix: '052~075',
    layerSuffix,
    customHMap: { 55: 22.5 } // 最右側 N55 避讓右下煙管
  });

// ==================== 7F B區貨架（N53~N35） ====================
const build7FBHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 53,
    endNum: 35,
    startX: 7.2,
    y: 48.0,
    h: 83.0,
    prefix: 'N',
    rangeSuffix: '027~075',
    layerSuffix,
    customHMap: {
      37: 48.0, // 右側避讓中央樓梯/電梯
      36: 48.0,
      35: 48.0
    }
  });

// ==================== 7F C區貨架（N34~N15） ====================
const build7FCHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 34,
    endNum: 15,
    startX: 2.0,
    y: 42.0,
    h: 89.0,
    prefix: 'N',
    rangeSuffix: '001~075',
    layerSuffix,
    customHMap: {
      34: 54.0, // 左側緊鄰中央樓梯/電梯
      33: 60.0
    }
  });

// ==================== 7F D區貨架（N14~N01 + 關閉中 S05~S01） ====================
const build7FDHeavy = (layerSuffix) => [
  ...buildHeavyNRows({
    startNum: 14,
    endNum: 1,
    startX: 2.0,
    y: 42.0,
    h: 89.0,
    prefix: 'N',
    rangeSuffix: '001~075',
    layerSuffix
  }),
  ...buildHeavyNRows({
    startNum: 5,
    endNum: 1,
    startX: 46.8,
    y: 42.0,
    h: 65.0,
    prefix: 'S',
    rangeSuffix: '001~056',
    layerSuffix,
    closed: true,
    customHMap: {
      1: 56.0 // 最外側 S01 避讓右下煙管
    }
  })
];

export const FLOOR_7F = {
  floor: '7F',
  title: '7F 全層儲區（A～D區｜柱距12m）',
  orientation: 'east-up',
  zones: [
    { id: '7F-A', label: 'A區 (撿貨區｜M01~53 + N55~69 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-A'] },
    { id: '7F-A-STORAGE', label: 'A區 (庫區｜N55~69 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-A'] },
    { id: '7F-B', label: 'B區 (撿貨區｜N35~53 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-B'] },
    { id: '7F-B-STORAGE', label: 'B區 (庫區｜N35~53 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-B'] },
    { id: '7F-C', label: 'C區 (撿貨區｜N15~34 A~B)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-C'] },
    { id: '7F-C-STORAGE', label: 'C區 (庫區｜N15~34 C~E)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-C'] },
    { id: '7F-D', label: 'D區 (撿貨區｜N01~14 A~B + S01~05關閉)', ruleFloor: '7F', defaultRole: 'PICK', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-D'] },
    { id: '7F-D-STORAGE', label: 'D區 (庫區｜N01~14 C~E + S01~05關閉)', ruleFloor: '7F', defaultRole: 'STORAGE', meterMode: true, pxPerM: 6.5, shell: SHELL_7F['7F-D'] }
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