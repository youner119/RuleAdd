import * as THREE from 'three';

/**
 * lane — 레인 좌표 정본(single source of truth).
 *
 * 셀은 **플랫 인덱스** `row*COLS + col` 로 식별한다(4×1 은 row 0 한 줄, 4×4 는 4줄).
 * Player·Spawner·CollisionSystem·Wall 이 모두 cellToX/cellToY 를 공유해 좌표
 * 불일치를 원천 차단한다. col/row 분해는 colOf/rowOf 가 정본.
 */

/**
 * COLS = 기본/시작 그리드 한 변(가로 칸 수). 좌표 함수의 `cols` 기본값이며,
 * 그리드 확장(룰)으로 런타임에 한 변이 늘면 Game/Spawner/Player/Wall 이
 * 동적 cols 를 좌표 함수에 명시 전달한다(그래서 좌표 함수가 cols 인자를 받음).
 * cols 를 안 넘기면 4 — 즉 확장 전(4×1·4×4) 동작은 완전히 동일하다.
 */
export const COLS = 4; // 시작 가로 칸 수(X축). 세로 줄 수(ROWS)는 4×4 모드/룰6 에서 1↔4.
export const CELL_SIZE = 1;
export const START_CELL = 1; // 0-based — 가운데-왼쪽 칸(col 1, row 0)에서 시작

/** 플랫 셀 인덱스(row*cols+col) → 열(0..cols-1). */
export function colOf(cell: number, cols = COLS): number {
  return ((cell % cols) + cols) % cols;
}
/** 플랫 셀 인덱스 → 행(0 = 맨 아래). */
export function rowOf(cell: number, cols = COLS): number {
  return Math.floor(cell / cols);
}
/** (열,행) → 플랫 셀 인덱스. */
export function cellIndex(col: number, row: number, cols = COLS): number {
  return row * cols + col;
}

/** 셀(플랫 인덱스) → 월드 X (열 기준, 중앙정렬). */
export function cellToX(cell: number, cols = COLS): number {
  return (colOf(cell, cols) - (cols - 1) / 2) * CELL_SIZE;
}

/** 셀(플랫 인덱스) → 월드 Y (행 기준; row 0 = 맨 아래 = 기존 4×1 높이). */
export function cellToY(cell: number, cols = COLS): number {
  return LANE_Y + CELL_SIZE / 2 + rowOf(cell, cols) * CELL_SIZE;
}

/** X 좌표 → 가장 가까운 열 인덱스 ([0,cols) clamp). */
export function xToCell(x: number, cols = COLS): number {
  const idx = Math.round(x / CELL_SIZE + (cols - 1) / 2);
  return Math.max(0, Math.min(cols - 1, idx));
}

// --- 2D 방향 (화살표·쉬프트·확장) ---

/** 2D 격자 방향. 각 성분 -1/0/+1, 기본은 4방위(둘 중 하나만 비0) 또는 {0,0}=없음. */
export interface Dir {
  x: number; // 열 방향 (+우/-좌)
  y: number; // 행 방향 (+위/-아래)
}
export const DIR_NONE: Dir = { x: 0, y: 0 };
/** 4방위 (우/좌/위/아래). */
export const DIRS4: readonly Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
export function dirEq(a: Dir, b: Dir): boolean {
  return a.x === b.x && a.y === b.y;
}
/** 방향이 있는가(움직이는가). {0,0} 이면 false. */
export function isDir(d: Dir): boolean {
  return d.x !== 0 || d.y !== 0;
}
export function negDir(d: Dir): Dir {
  return { x: -d.x, y: -d.y };
}
/** 셀에서 dir 방향 한 칸 이웃 — 열·행 각각 wrap(토러스). rows = 세로 줄 수, cols = 가로 칸 수. */
export function stepCell(cell: number, d: Dir, rows: number, cols = COLS): number {
  const col = (((colOf(cell, cols) + d.x) % cols) + cols) % cols;
  const row = (((rowOf(cell, cols) + d.y) % rows) + rows) % rows;
  return cellIndex(col, row, cols);
}

// --- 높이(Y) ---
export const LANE_Y = 0.5; // 레인 표면을 격자(y=0) 위로 올린 높이. 구·벽이 이 위에 놓인다.

// --- 깊이(Z) 레이아웃 ---
export const PLAYER_Z = 3; // 플레이어 평면 = 충돌 평면 (T7)
export const SPAWN_Z = -60; // 벽 스폰 위치 (먼 곳) — 레인 러웨이 길이
export const LANE_NEAR_Z = 6; // 바닥 근거리 끝 (플레이어 뒤)
export const LANE_FAR_Z = SPAWN_Z - 2; // 바닥 원거리 끝

// --- 색 ---
const FLOOR_COLOR = 0xffffff; // 순백 바닥
const GRID_COLOR = 0xdadada; // 바닥 격자선 (T2 톤, 옅은 회색)
const GRID_CENTER_COLOR = 0xc4c4c4; // 격자 중앙 축선
const LANE_BORDER_COLOR = 0x888888; // 레인 경계 테두리 (4 레인 구별용, 격자보다 진하게)

/** 격자 한 변(월드 단위). 1단위 셀에 맞춰 divisions = size. 깊이(스폰 z≈-32)까지 덮음. */
const GRID_SIZE = 70;

/**
 * 흰 바닥(contact shadow 받음) + T2식 GridHelper(맵 전체 격자).
 *
 * 바닥·구 모두 순백이라 형태는 격자선 + 구의 테두리/그림자로만 읽힌다.
 * 격자는 1단위 간격이라 셀 경계와 자연히 정렬된다. cols = 가로 칸 수(레인 폭·경계선 수).
 */
export function createLaneGroup(cols = COLS): THREE.Group {
  const group = new THREE.Group();

  const laneWidth = cols * CELL_SIZE;
  const laneXMin = cellToX(0, cols) - CELL_SIZE / 2;
  const laneXMax = cellToX(cols - 1, cols) + CELL_SIZE / 2;

  const depth = LANE_NEAR_Z - LANE_FAR_Z;
  const centerZ = (LANE_NEAR_Z + LANE_FAR_Z) / 2;

  // 흰 레인 평면 (XZ). 폭은 정확히 cols 레인. emissive 로 회색기 제거(흰색), 그림자는 약하게 유지.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(laneWidth, depth),
    new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      emissive: 0xffffff,
      emissiveIntensity: 0.4,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, LANE_Y, centerZ); // 격자(y=0) 위로 올린 레인 표면
  floor.receiveShadow = true;
  group.add(floor);

  // T2식 격자 — XZ 평면(y=0, 레인 아래)에 1단위 정사각 격자.
  const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, GRID_CENTER_COLOR, GRID_COLOR);
  group.add(grid);

  // 레인 경계 테두리 — 4 레인 구별. 레인 표면 위(y+ε)에 진한 톤 선.
  const by = LANE_Y + 0.012;
  const border: number[] = [];
  // 세로 경계 (cols+1 개), 깊이 방향으로 길게.
  for (let i = 0; i <= cols; i++) {
    const x = laneXMin + i * CELL_SIZE;
    border.push(x, by, LANE_NEAR_Z, x, by, LANE_FAR_Z);
  }
  // 앞/뒤 가로 경계 (테두리 닫기).
  border.push(laneXMin, by, LANE_NEAR_Z, laneXMax, by, LANE_NEAR_Z);
  border.push(laneXMin, by, LANE_FAR_Z, laneXMax, by, LANE_FAR_Z);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(border, 3));
  const borders = new THREE.LineSegments(
    borderGeo,
    new THREE.LineBasicMaterial({ color: LANE_BORDER_COLOR }),
  );
  group.add(borders);

  return group;
}
