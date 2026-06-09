import * as THREE from 'three';

/**
 * lane — 4×1 레인의 좌표 정본(single source of truth).
 *
 * 셀 인덱스(0..3)와 월드 좌표의 변환을 여기 한곳에 모은다.
 * Player(현재 셀)·Spawner(벽 패턴)·CollisionSystem 이 모두 cellToX 를 공유해
 * 좌표 불일치를 원천 차단한다. 4×4 확장 시 cellToY 가 여기 추가된다.
 */

export const CELL_COUNT = 4;
export const CELL_SIZE = 1;
export const LANE_WIDTH = CELL_COUNT * CELL_SIZE; // 4
export const START_CELL = 1; // 0-based — 가운데-왼쪽 칸에서 시작

/** 셀 인덱스(0..3) → 월드 X (중앙정렬: -1.5 / -0.5 / 0.5 / 1.5). */
export function cellToX(index: number): number {
  return (index - (CELL_COUNT - 1) / 2) * CELL_SIZE;
}

// --- 높이(Y) ---
export const LANE_Y = 0.5; // 레인 표면을 격자(y=0) 위로 올린 높이. 구·벽이 이 위에 놓인다.

// --- 깊이(Z) 레이아웃 ---
export const PLAYER_Z = 3; // 플레이어 평면 = 충돌 평면 (T7)
export const SPAWN_Z = -32; // 벽 스폰 위치 (먼 곳) — 레인 러웨이 길이
export const LANE_NEAR_Z = 6; // 바닥 근거리 끝 (플레이어 뒤)
export const LANE_FAR_Z = SPAWN_Z - 2; // 바닥 원거리 끝

// --- 색 ---
const FLOOR_COLOR = 0xffffff; // 순백 바닥
const GRID_COLOR = 0xdadada; // 바닥 격자선 (T2 톤, 옅은 회색)
const GRID_CENTER_COLOR = 0xc4c4c4; // 격자 중앙 축선
const LANE_BORDER_COLOR = 0x888888; // 레인 경계 테두리 (4 레인 구별용, 격자보다 진하게)

/** 격자 한 변(월드 단위). 1단위 셀에 맞춰 divisions = size. 깊이(스폰 z≈-32)까지 덮음. */
const GRID_SIZE = 70;

/** 레인 X 경계 (x = -2 ~ 2). Player clamp 등에서 사용. */
export const LANE_X_MIN = cellToX(0) - CELL_SIZE / 2;
export const LANE_X_MAX = cellToX(CELL_COUNT - 1) + CELL_SIZE / 2;

/**
 * 흰 바닥(contact shadow 받음) + T2식 GridHelper(맵 전체 격자).
 *
 * 바닥·구 모두 순백이라 형태는 격자선 + 구의 테두리/그림자로만 읽힌다.
 * 격자는 1단위 간격이라 셀 경계(x = -2..2)와 자연히 정렬된다.
 */
export function createLaneGroup(): THREE.Group {
  const group = new THREE.Group();

  const depth = LANE_NEAR_Z - LANE_FAR_Z;
  const centerZ = (LANE_NEAR_Z + LANE_FAR_Z) / 2;

  // 흰 레인 평면 (XZ). 폭은 정확히 4 레인. emissive 로 회색기 제거(흰색), 그림자는 약하게 유지.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE_WIDTH, depth),
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
  // 세로 경계 5개 (x = -2,-1,0,1,2), 깊이 방향으로 길게.
  for (let i = 0; i <= CELL_COUNT; i++) {
    const x = LANE_X_MIN + i * CELL_SIZE;
    border.push(x, by, LANE_NEAR_Z, x, by, LANE_FAR_Z);
  }
  // 앞/뒤 가로 경계 (테두리 닫기).
  border.push(LANE_X_MIN, by, LANE_NEAR_Z, LANE_X_MAX, by, LANE_NEAR_Z);
  border.push(LANE_X_MIN, by, LANE_FAR_Z, LANE_X_MAX, by, LANE_FAR_Z);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(border, 3));
  const borders = new THREE.LineSegments(
    borderGeo,
    new THREE.LineBasicMaterial({ color: LANE_BORDER_COLOR }),
  );
  group.add(borders);

  return group;
}
