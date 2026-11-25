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

// 3F B/C區重型層架作業區（東側朝右橫向：12m 待上架區 + 48m B/C重型層架 + 12m 出貨區 = 72m × 24m）
export const SHELL_3F_BC = {
  widthM: 72,
  depthM: 24,
  columns: buildStructuralColumns(72, 24),
  rooms: [
    { x: 0, y: 0, w: 12, h: 24, label: '待上架區 (12m)' },
    { x: 60, y: 0, w: 12, h: 24, label: '出貨區 (12m)' }
  ]
};

// 4F 獨立庫房（長 7.2m × 寬 6.3m，入口在右下角）
export const SHELL_4F = {
  widthM: 7.2,
  depthM: 6.3,
  columns: [
    { x: 0, y: 0 },
    { x: 7.2, y: 0 },
    { x: 0, y: 6.3 },
    { x: 7.2, y: 6.3 }
  ],
  rooms: [
    { x: 6.0, y: 5.7, w: 1.2, h: 0.6, label: '入口' }
  ]
};

// 6F 東側夾層標準固定隔間（B、C、D三區，每區 60m × 24m）
export const SHELL_6F = {
  '6F-B': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 54.5, y: 0, w: 5.5, h: 12, label: '茶水間、廁所' },
      { x: 1.5, y: 20.5, w: 3.5, h: 3.5, label: '排煙管道' },
      { x: 8.5, y: 18, w: 4.5, h: 6, label: '輸送帶預留垂直開口' },
      { x: 36.5, y: 18, w: 4, h: 6, label: '排煙管道' },
      { x: 40.5, y: 18, w: 6, h: 6, label: '機房' },
      { x: 46.5, y: 18, w: 3.5, h: 6, label: '樓梯' },
      { x: 50, y: 20, w: 3, h: 4, label: '客梯' },
      { x: 53, y: 20, w: 3, h: 4, label: '棧板機' },
      { x: 56, y: 18, w: 4, h: 6, label: '電梯' }
    ]
  },
  '6F-C': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 0, w: 5.5, h: 12, label: '茶水間、廁所' },
      { x: 48, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 0, y: 18, w: 4.5, h: 6, label: '電梯' },
      { x: 4.5, y: 20, w: 3.5, h: 4, label: '棧板機' },
      { x: 8, y: 18, w: 3.5, h: 6, label: '樓梯' },
      { x: 11.5, y: 18, w: 3.5, h: 6, label: '樓梯' },
      { x: 15, y: 18, w: 5, h: 6, label: '機房' },
      { x: 20, y: 18, w: 3.5, h: 6, label: '排煙管道' },
      { x: 56, y: 20.5, w: 4, h: 3.5, label: '排煙管道' }
    ]
  },
  '6F-D': {
    widthM: 60,
    depthM: 24,
    columns: buildStructuralColumns(60, 24),
    rooms: [
      { x: 0, y: 0, w: 12, h: 12, label: '空調機房' },
      { x: 48, y: 0, w: 6, h: 14, label: '電梯' },
      { x: 54, y: 0, w: 6, h: 17, label: '廁所、茶水間' },
      { x: 1.5, y: 18, w: 3.5, h: 6, label: '排煙管道' },
      { x: 8.5, y: 18, w: 4.5, h: 6, label: '輸送帶預留開口' },
      { x: 36.5, y: 20.5, w: 5.5, h: 3.5, label: '排煙管道' },
      { x: 42, y: 17, w: 3.5, h: 7, label: '樓梯' },
      { x: 45.5, y: 17, w: 14.5, h: 7, label: '梯間' }
    ]
  }
};