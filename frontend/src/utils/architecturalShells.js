// frontend/src/utils/architecturalShells.js
// 全棟建築結構基準：柱心間距 12 公尺（1 單位 = 1 公尺）

export function buildStructuralColumns(widthM, depthM) {
  const cols = [];
  for (let x = 0; x <= widthM; x += 12) {
    for (let y = 0; y <= depthM; y += 12) {
      cols.push({ x, y });
    }
  }
  return cols;
}

// 2F 西側夾層柱位（18m + 6m = 24m）
export function buildWestWingColumns(widthM = 60) {
  const yAxes = [0, 18, 24];
  const cols = [];
  for (let x = 0; x <= widthM; x += 12) {
    for (const y of yAxes) {
      cols.push({ x, y });
    }
  }
  return cols;
}

// 2F 東側夾層標準固定隔間（每區 60m × 24m）
export const SHELL_2F_EAST = {
  '2F-E-A': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 0, w: 6, h: 17, label: '廁所、茶水間' },
      { x: 6, y: 0, w: 6, h: 12, label: '電梯' },
      { x: 0, y: 17, w: 12, h: 7, label: '梯間' },
      { x: 12, y: 17, w: 2.5, h: 7, label: '排煙管道' },
      { x: 25, y: 0, w: 10, h: 4, label: '空壓系統' },
      { x: 48, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 56.5, y: 20.5, w: 3.5, h: 3.5, label: '排煙管道' }
    ]
  },
  '2F-E-B': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 47, y: 7, w: 13, h: 5, label: '茶水間、廁所' },
      { x: 0, y: 20.5, w: 4, h: 3.5, label: '排煙管道' },
      { x: 5.5, y: 18.5, w: 5.5, h: 5.5, label: '輸送帶預留垂直開口' },
      { x: 37, y: 18, w: 4, h: 6, label: '排煙管道' },
      { x: 41, y: 18, w: 6, h: 6, label: '機房' },
      { x: 47, y: 18, w: 3, h: 6, label: '樓梯' },
      { x: 50, y: 20, w: 3.5, h: 4, label: '客梯' },
      { x: 53.5, y: 20, w: 3.5, h: 4, label: '棧板機' },
      { x: 57, y: 18, w: 3, h: 6, label: '電梯' }
    ]
  },
  '2F-E-C': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 7, w: 13, h: 5, label: '茶水間、廁所' },
      { x: 48, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 0, y: 18, w: 4, h: 6, label: '電梯' },
      { x: 4, y: 20, w: 3.5, h: 4, label: '棧板機' },
      { x: 7.5, y: 18, w: 3, h: 6, label: '樓梯' },
      { x: 11.5, y: 18, w: 3, h: 6, label: '樓梯' },
      { x: 14.5, y: 18, w: 5.5, h: 6, label: '機房' },
      { x: 20, y: 18, w: 3.5, h: 6, label: '排煙管道' },
      { x: 56, y: 20.5, w: 4, h: 3.5, label: '排煙管道' }
    ]
  }
};

// 2F 西側夾層標準固定隔間（每區 60m × 24m，18m + 6m）
export const SHELL_2F_WEST = {
  '2F-W-A': {
    widthM: 60,
    depthM: 24,
    columns: buildWestWingColumns(60),
    rooms: [
      { x: 0, y: 0, w: 12, h: 13, label: '電梯' },
      { x: 0, y: 13, w: 3.5, h: 6, label: '樓梯' },
      { x: 3.5, y: 13, w: 8.5, h: 11, label: '機房' },
      { x: 56, y: 18, w: 4, h: 6, label: '排煙管道' }
    ]
  },
  '2F-W-B': {
    widthM: 60,
    depthM: 24,
    columns: buildWestWingColumns(60),
    rooms: [
      { x: 2.5, y: 18, w: 3.5, h: 6, label: '排煙管道' },
      { x: 48, y: 0, w: 12, h: 6, label: '樓梯' },
      { x: 54, y: 6, w: 6, h: 6, label: '電梯' },
      { x: 48, y: 12, w: 12, h: 6, label: '空調機房' },
      { x: 48, y: 18, w: 12, h: 4, label: '廁所、茶水間' }
    ]
  },
  '2F-W-C': {
    widthM: 60,
    depthM: 24,
    columns: buildWestWingColumns(60),
    rooms: [
      { x: 0, y: 0, w: 12, h: 6, label: '樓梯' },
      { x: 0, y: 6, w: 6, h: 6, label: '電梯' },
      { x: 0, y: 12, w: 12, h: 6, label: '空調機房' },
      { x: 0, y: 18, w: 12, h: 4, label: '廁所、茶水間' },
      { x: 55, y: 18, w: 3.5, h: 6, label: '排煙管道' }
    ]
  }
};

// 3F 完整樓層標準固定隔間（東側朝右橫向：寬 132m [西0m → 東132m] × 高 60m [北0m → 南60m]）
export const SHELL_3F = {
  '3F-A': {
    widthM: 132,
    depthM: 60,
    columns: buildStructuralColumns(132, 60),
    rooms: [
      { x: 0, y: 0, w: 12, h: 12, label: '電梯' },
      { x: 108, y: 0, w: 12, h: 12, label: '梯間' },
      { x: 120, y: 0, w: 12, h: 12, label: '機房 / 電梯' },
      { x: 12, y: 6, w: 96, h: 48, label: '自動化設備區域（已關閉）' }
    ]
  },
  '3F-B': {
    widthM: 132,
    depthM: 60,
    columns: buildStructuralColumns(132, 60),
    rooms: [
      // 東側夾層與核心筒（x = 108m ~ 132m）
      { x: 108, y: 0, w: 24, h: 48, label: '東側夾層下方空間' },
      { x: 108, y: 48, w: 12, h: 12, label: '茶水間、廁所' },
      { x: 120, y: 48, w: 6, h: 12, label: '電梯' },
      { x: 126, y: 48, w: 6, h: 12, label: '樓梯' },
      // 西側核心筒（x = 0m ~ 24m）
      { x: 0, y: 48, w: 12, h: 12, label: '電梯 / 機房' },
      { x: 12, y: 48, w: 12, h: 12, label: '樓梯' },
      // 自動化區域（重型架北側留 2m 走道後整區為自動化區域）
      { x: 24, y: 4, w: 80, h: 40, label: '自動化區域' },
      // 重型架東西兩端作業區（銜接 C 區）
      { x: 28, y: 46, w: 8, h: 14, label: '待上架區' },
      { x: 84, y: 46, w: 8, h: 14, label: '出貨線' }
    ]
  },
  '3F-C': {
    widthM: 132,
    depthM: 60,
    columns: buildStructuralColumns(132, 60),
    rooms: [
      // 東側核心筒與夾層（x = 108m ~ 132m）
      { x: 108, y: 0, w: 12, h: 12, label: '茶水間、廁所' },
      { x: 120, y: 0, w: 6, h: 12, label: '電梯' },
      { x: 126, y: 0, w: 6, h: 12, label: '樓梯' },
      { x: 108, y: 12, w: 24, h: 48, label: '東側夾層下方空間' },
      // 西側核心筒（x = 0m ~ 24m）
      { x: 0, y: 0, w: 12, h: 12, label: '電梯 / 機房' },
      { x: 12, y: 0, w: 12, h: 12, label: '樓梯' },
      // 重型架東西兩端作業區（銜接 B 區）
      { x: 28, y: 0, w: 8, h: 14, label: '待上架區' },
      { x: 84, y: 0, w: 8, h: 14, label: '出貨線' },
      // 自動化區域（重型架南側留 2m 走道後整區為自動化區域）
      { x: 24, y: 16, w: 80, h: 40, label: '自動化區域' }
    ]
  },
  '3F-D': {
    widthM: 132,
    depthM: 60,
    columns: buildStructuralColumns(132, 60),
    rooms: [
      { x: 0, y: 48, w: 12, h: 12, label: '電梯' },
      { x: 108, y: 48, w: 12, h: 12, label: '梯間' },
      { x: 120, y: 48, w: 12, h: 12, label: '機房 / 電梯' },
      { x: 12, y: 6, w: 96, h: 48, label: '自動化設備區域（已關閉）' }
    ]
  }
};