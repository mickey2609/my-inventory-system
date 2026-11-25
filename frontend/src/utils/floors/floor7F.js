// frontend/src/utils/floors/floor7F.js
import { SHELL_7F } from '../architecturalShells.js';

// 產生 A 區 AGV 小層架橫排（東側朝右：M53 由上至下遞減至 M01，跨越 12m 柱列自動留出柱位）
function buildAgvMRows(startNum, endNum, x, w, suffix) {
  const rows = [];
  let y = 3.2;
  for (let n = startNum; n >= endNum; n--) {
    // 避讓 y = 12, 24, 36, 48 的結構柱
    if (Math.abs(y - 11.8) < 0.6 || Math.abs(y - 23.8) < 0.6 || Math.abs(y - 35.8) < 0.6 || Math.abs(y - 47.8) < 0.6) {
      y += 1.0;
    }
    const code = `M${String(n).padStart(2, '0')}`;
    rows.push({
      x,
      y: Number(y.toFixed(2)),
      w,
      h: 0.85,
      label: `80${code}${suffix}`,
      xCode: code
    });
    // 背靠背雙排間距 0.9m，走道間距 1.05m
    y += (startNum - n) % 2 === 1 ? 0.9 : 1.05;
  }
  return rows;
}

// 產生重型層架橫向背靠背雙排與單排（東側朝右：startNum 由上至下遞減至 endNum）
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
      // 同組背靠背緊鄰
      y += 1.15;
    } else {
      // 走道間距
      y += 2.05;
    }
    pairIdx++;
  }
  return rows;
}

// ==================== 7F A區貨架 ====================
const RACKS_7F_A_AGV = [
  // 第1段（最靠東側）：001~052 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 70.5, 12.5, '001~052A~E'),
  // 第2段：056~067 A~F（M01~M53）
  ...buildAgvMRows(53, 1, 56.0, 12.5, '056~067A~F'),
  // 第3段：068~079 A~E（M01~M53）
  ...buildAgvMRows(53, 1, 41.5, 12.5, '068~079A~E'),
  // 第4段（靠西側煙管旁）：080~085 A~E（M43~M53）
  ...buildAgvMRows(53, 43, 30.0, 9.5, '080~085A~E')
];

const build7FAHeavy = (layerSuffix) =>
  buildHeavyNRows({
    startNum: 69,
    endNum: 55,
    startY: 15.0,
    eastX: 28.5,
    defaultW: 27.5,
    prefix: 'N',
    rangeSuffix: '052~075',
    layerSuffix,
    customWMap: { 55: 22.5 } // 最南側 N55 避讓西南角煙管
  });

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
      37: 48.0, // 下方避讓中央樓梯/電梯
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
      34: 54.0, // 上方緊鄰中央樓梯/電梯
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
      1: 56.0 // 最南側 S01 避讓煙管
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