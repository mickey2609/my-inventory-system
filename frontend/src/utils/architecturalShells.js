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

// 7F 全層柱位（東側朝右橫向：132m 寬 × 60m 深｜西側 2 跨 6m + 東側 10 跨 12m）
export function build7FColumns() {
  const xAxes = [0, 6, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132];
  const cols = [];
  for (const x of xAxes) {
    for (let y = 0; y <= 60; y += 12) {
      cols.push({ x, y });
    }
  }
  return cols;
}

// 7F 全層標準固定隔間（A、B、C、D 四區，每區 132m × 60m，東側朝右；x = 108m 為挑高區與東側夾層分界線）
export const SHELL_7F = {
  '7F-A': {
    widthM: 132,
    depthM: 60,
    columns: build7FColumns().filter((c) => !(c.x < 12 && c.y < 12)),
    cutouts: [
      { x: 0, y: 0, w: 12, h: 12 }
    ],
    dividers: [
      { x1: 108, y1: 0, x2: 108, y2: 60, label: '挑高區 ◀｜▶ 東側夾層' }
    ],
    rooms: [
      // 西側建築構造（緊鄰西北 12x12m 缺角）
      { x: 12, y: 0, w: 18, h: 3.5, label: '機房' },
      { x: 12, y: 3.5, w: 18, h: 3.5, label: '樓梯' },
      { x: 12, y: 7, w: 18, h: 5, label: '電梯' },
      { x: 30, y: 1.5, w: 4.5, h: 4.5, label: '煙管' },
      // 西側南端排煙管道（與 C 區同位置）
      { x: 0.5, y: 54, w: 4.5, h: 5, label: '排煙管道' },
      // 挑高區東南角排煙管道（緊鄰 108m 夾層線左側）
      { x: 103, y: 55, w: 5, h: 5, label: '排煙管道' },
      // 東側夾層（x = 108 ~ 132m）
      { x: 108, y: 0, w: 9, h: 12, label: '梯間' },
      { x: 108, y: 12, w: 6, h: 2.5, label: '排煙管道' },
      { x: 117, y: 0, w: 15, h: 6, label: '廁所、茶水間' },
      { x: 117, y: 6, w: 15, h: 6, label: '電梯' }
    ]
  },
  '7F-B': {
    widthM: 132,
    depthM: 60,
    columns: build7FColumns(),
    dividers: [
      { x1: 108, y1: 0, x2: 108, y2: 60, label: '挑高區 ◀｜▶ 東側夾層' }
    ],
    rooms: [
      // 西側北端排煙管道（與 D 區同位置，使 N53 較 N52 短）
      { x: 1, y: 3.5, w: 4.5, h: 4.5, label: '排煙管道' },
      // 西側南端核心筒（12m × 12m：x = 12 ~ 24, y = 48 ~ 60）
      { x: 12, y: 48, w: 6, h: 12, label: '樓梯' },
      { x: 18, y: 52, w: 6, h: 8, label: '電梯' },
      // 東側夾層（x = 108 ~ 132m）
      { x: 108, y: 0, w: 5, h: 4, label: '排煙管道' },
      { x: 110, y: 8, w: 5, h: 5, label: '輸送帶預留垂直開口' },
      { x: 108, y: 36, w: 6, h: 3.5, label: '排煙管道' },
      { x: 108, y: 39.5, w: 6, h: 6, label: '機房' },
      { x: 108, y: 45.5, w: 6, h: 3, label: '樓梯' },
      { x: 108, y: 48.5, w: 3.5, h: 3.5, label: '客梯' },
      { x: 108, y: 52, w: 3.5, h: 4, label: '棧板機' },
      { x: 108, y: 56, w: 6, h: 4, label: '電梯' }
    ]
  },
  '7F-C': {
    widthM: 132,
    depthM: 60,
    columns: build7FColumns(),
    dividers: [
      { x1: 108, y1: 0, x2: 108, y2: 60, label: '挑高區 ◀｜▶ 東側夾層' }
    ],
    rooms: [
      // 西側北端核心筒（12m × 12m：x = 12 ~ 24, y = 0 ~ 12，與 B 區對稱）
      { x: 12, y: 0, w: 6, h: 12, label: '樓梯' },
      { x: 18, y: 0, w: 6, h: 8, label: '電梯' },
      // 西側南端排煙管道（與 A 區同位置，使 N15~16 較短）
      { x: 0.5, y: 54, w: 4.5, h: 5, label: '排煙管道' },
      // 東側夾層（x = 108 ~ 132m，對稱於 B 區東側夾層）
      { x: 108, y: 0, w: 6, h: 4, label: '電梯' },
      { x: 108, y: 4, w: 3.5, h: 4, label: '棧板機' },
      { x: 108, y: 8, w: 3.5, h: 3.5, label: '樓梯' },
      { x: 108, y: 11.5, w: 6, h: 3, label: '樓梯' },
      { x: 108, y: 14.5, w: 6, h: 6, label: '機房' },
      { x: 108, y: 20.5, w: 6, h: 3.5, label: '排煙管道' },
      { x: 108, y: 56, w: 5, h: 4, label: '排煙管道' }
    ]
  },
  '7F-D': {
    widthM: 132,
    depthM: 60,
    columns: build7FColumns().filter((c) => !(c.x < 12 && c.y > 48)),
    cutouts: [
      { x: 0, y: 48, w: 12, h: 12 }
    ],
    dividers: [
      { x1: 108, y1: 0, x2: 108, y2: 60, label: '挑高區 ◀｜▶ 東側夾層' }
    ],
    rooms: [
      // 西側北端排煙管道（與 B 區同位置，使 N14 落地排較 N13 短）
      { x: 1, y: 3.5, w: 4.5, h: 4.5, label: '排煙管道' },
      // 西側南端建築構造（緊鄰西南 12x12m 缺角，與 A 區對稱）
      { x: 12, y: 48, w: 18, h: 5, label: '電梯' },
      { x: 12, y: 53, w: 18, h: 3.5, label: '樓梯' },
      { x: 12, y: 56.5, w: 18, h: 3.5, label: '機房' },
      // 東側夾層（x = 108 ~ 132m）
      { x: 108, y: 0, w: 5, h: 4, label: '排煙管道' },
      { x: 110, y: 8, w: 5, h: 5, label: '輸送帶預留垂直開口' },
      { x: 108, y: 45, w: 5.5, h: 3, label: '排煙管道' },
      { x: 113.5, y: 45, w: 3.5, h: 3, label: '樓梯' },
      { x: 108, y: 48, w: 9, h: 12, label: '梯間' },
      { x: 117, y: 48, w: 15, h: 6, label: '電梯' },
      { x: 117, y: 54, w: 15, h: 6, label: '廁所、茶水間' }
    ]
  }
};