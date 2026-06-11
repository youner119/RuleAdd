import * as THREE from 'three';
import {
  CELL_SIZE,
  COLS,
  DIR_NONE,
  type Dir,
  cellIndex,
  cellToX,
  cellToY,
  colOf,
  isDir,
  rowOf,
} from './lane';

/**
 * Wall — 한 "세트"(다가오는 한 줄). Z로 함께 이동하지만, 그 안의 각 블록은
 * 개별 "벽"으로서 독립적으로 행동한다.
 *
 * 각 블록(막힌 칸) = 흰색 정사각 + 테두리. 룰2 활성 시 블록마다 중앙에
 * 화살표(있을 수도/없을 수도)가 붙고, 근접 시 자기 화살표 방향으로 1칸
 * 이동한다(방향은 엔진이 블록별로 결정 — 룰3 반대/룰4 정지). 룰3/4/5 색도
 * 블록별 속성. 정사각이라 4×4 확장 시 균일하게 쌓인다.
 */

export const WALL_THICKNESS = 0.6; // Z 두께. 충돌 Z 판정에도 사용.
const BLOCK_COLOR = 0xffffff;
const EDGE_COLOR = 0x222222;

// 공유 리소스 (동일 규격 → 메모리 절약, despawn 시 dispose 불필요).
const cellGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, WALL_THICKNESS);
const edgeGeo = new THREE.EdgesGeometry(cellGeo);
const bodyMat = new THREE.MeshStandardMaterial({
  color: BLOCK_COLOR,
  emissive: 0xffffff,
  emissiveIntensity: 0.25,
  roughness: 0.6,
  metalness: 0,
});
const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });

// 색 블록(룰3/4/5) 머티리얼 캐시 — 색별 1개 공유.
const bodyMats = new Map<string, THREE.MeshStandardMaterial>();
function bodyMatFor(color: string): THREE.MeshStandardMaterial {
  let mat = bodyMats.get(color);
  if (!mat) {
    const c = new THREE.Color(color);
    mat = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.12,
      roughness: 0.6,
      metalness: 0,
    });
    bodyMats.set(color, mat);
  }
  return mat;
}

// --- 화살표(흰색 + 테두리) 공유 리소스 ---
const ARROW_SHAPE = (() => {
  const s = new THREE.Shape(); // +X(오른쪽)를 가리키는 화살표
  s.moveTo(0.32, 0);
  s.lineTo(-0.04, 0.24);
  s.lineTo(-0.04, 0.09);
  s.lineTo(-0.32, 0.09);
  s.lineTo(-0.32, -0.09);
  s.lineTo(-0.04, -0.09);
  s.lineTo(-0.04, -0.24);
  s.closePath();
  return s;
})();
const arrowGeo = new THREE.ShapeGeometry(ARROW_SHAPE);
const arrowEdgeGeo = new THREE.EdgesGeometry(arrowGeo);
const arrowMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 0.3,
  roughness: 0.6,
  metalness: 0,
  side: THREE.DoubleSide,
});
const arrowEdgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });

// --- 확장 마커(룰5: 동그라미 + X + 먹는 방향 분면 검정) 공유 리소스 ---
const MARK_R = 0.32;
const markDiscGeo = new THREE.CircleGeometry(MARK_R, 48); // 바탕 흰 원판
const markRingGeo = new THREE.RingGeometry(MARK_R - 0.03, MARK_R, 48); // 동그라미(테두리 링)
const markWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const markBlackMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const markXGeo = (() => {
  const d = MARK_R * Math.SQRT1_2; // 대각선 끝(±45°)
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-d, -d, 0, d, d, 0, -d, d, 0, d, -d, 0], 3),
  );
  return g;
})();
const markLineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const wedgeGeos = new Map<number, THREE.ShapeGeometry>(); // centerAngle → 90° 부채꼴
function wedgeGeoFor(centerAngle: number): THREE.ShapeGeometry {
  let g = wedgeGeos.get(centerAngle);
  if (!g) {
    // 중심(0,0) → 호 시작점을 lineTo 로 먼저 연결해야 진짜 부채꼴이 된다.
    // (absarc 를 첫 커브로 쓰면 moveTo(0,0)이 무시되어 활꼴만 남는 three.js 동작 주의)
    const a0 = centerAngle - Math.PI / 4;
    const a1 = centerAngle + Math.PI / 4;
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(Math.cos(a0) * MARK_R, Math.sin(a0) * MARK_R);
    s.absarc(0, 0, MARK_R, a0, a1, false);
    s.lineTo(0, 0);
    g = new THREE.ShapeGeometry(s);
    wedgeGeos.set(centerAngle, g);
  }
  return g;
}
/** 확장 방향 → 마커 분면 중심각. 우=0 / 위=π/2 / 좌=π / 아래=-π/2 (4방위). */
function expAngle(dir: Dir): number {
  return Math.atan2(dir.y, dir.x);
}

/**
 * Block — 세트 안의 개별 벽(막힌 칸 하나).
 * color/arrowDir 는 RuleWall 을 만족(엔진이 블록별 행동을 resolve).
 */
export interface Block {
  /** 현재 칸 인덱스(플랫 row*COLS+col). 쉬프트로 바뀐다. */
  cell: number;
  /** 룰2 화살표 방향 (2D, {0,0}=없음=안 움직임). */
  arrow: Dir;
  /** 룰3/4/5 색 (없으면 null). */
  color: string | null;
  /** 룰5 확장: 잡아먹는 방향들(2D). 확장벽이 아니면 없음. */
  expDirs?: Dir[];
  /** 이 블록의 메시 그룹(body+edges, +arrow/marker). */
  readonly group: THREE.Group;
  /** body 메시 — 색칠 시 머티리얼 교체용. */
  readonly body: THREE.Mesh;
}

/**
 * CellSnapshot — 게임오버 "왜 죽었나" 표시용. 한 시점의 한 칸 모습.
 * before(스폰 시) / after(쉬프트·확장 후) 두 시점을 비교해 보여준다.
 */
export interface CellSnapshot {
  blocked: boolean;
  color: string | null;
  arrow: Dir; // 화살표 이동 방향 (2D, {0,0}=없음)
  expandDirs: Dir[]; // 확장(ⓧ) 방향들(2D). 비었으면 확장 아님
}

/** 확장(룰5) 성장 애니메이션 길이(초). */
const GROW_SEC = 0.25;
/** 그리드 재배치(regrid) 슬라이드 길이(초) — 라운드 전환 텀(1.8s) 안에 끝난다. */
const REGRID_SEC = 0.45;

/** easeInOutQuad — 보간용 가감속. */
function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2;
}

export class Wall {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  /** 세트 안 블록들(막힌 칸). gap 은 블록 없음. */
  readonly blocks: Block[];
  /** 룰2 쉬프트 1회 적용 완료 여부. */
  shifted = false;
  /** 이 세트가 이미 목숨을 1 깎았는지 — 세트당 1회만 차감. */
  lifeTaken = false;
  /** 스폰 시점(쉬프트 전) 칸 모습 — gap 이 안전해 보이던 배치(게임오버 표시용). */
  before?: CellSnapshot[];
  /** 쉬프트·확장 후 칸 모습 — 실제로 막힌 배치(게임오버 표시용). */
  after?: CellSnapshot[];
  /** 성장 중인 확장 블록(룰5) — update 에서 스케일 애니메이션. */
  private readonly growing: { block: Block; dir: Dir; t: number }[] = [];
  /** regrid 슬라이드 중인 블록 — update 에서 X 보간(반 칸 이동). */
  private readonly slidingBlocks: { block: Block; fromX: number; toX: number; t: number }[] = [];
  /** 이 세트의 총 칸수(= 그리드 cols×rows). blocked 배열 길이로 결정, regrid 로 커질 수 있다. */
  private cellTotal: number;
  /**
   * 이 세트의 가로 칸 수 — 셀 인덱스 → 좌표 변환 기준. 스폰 시점 그리드 기준이며,
   * 확장 룰로 그리드가 커지면 regrid 로 새 그리드에 재배치된다
   * (Spawner 쉬프트/확장·CollisionSystem 이 wall.cols/rows 를 쓴다).
   */
  private _cols: number;
  /**
   * 이 세트의 경계 wrap 여부 — 스폰 시점에 고정. 생성기(setgen)가 같은 warp
   * 전제로 겹침0 을 보장했으므로 런타임 쉬프트/확장(Spawner)도 이 값을 따른다.
   * 기본 false(warp 없음). 향후 warp 룰 활성 시 새로 스폰되는 세트부터 true.
   */
  readonly warp: boolean;

  get cols(): number {
    return this._cols;
  }

  constructor(blocked: readonly boolean[], cols = COLS, warp = false) {
    this.cellTotal = blocked.length;
    this._cols = cols;
    this.warp = warp;
    this.object = new THREE.Group();
    this.blocks = [];

    for (let i = 0; i < this.cellTotal; i++) {
      if (!blocked[i]) continue; // gap
      const group = new THREE.Group();
      const body = new THREE.Mesh(cellGeo, bodyMat);
      body.castShadow = true;
      group.add(body, new THREE.LineSegments(edgeGeo, edgeMat));
      group.position.set(cellToX(i, cols), cellToY(i, cols), 0);
      this.object.add(group);
      this.blocks.push({ cell: i, arrow: DIR_NONE, color: null, group, body });
    }
  }

  /** 룰2: 블록 중앙(앞면)에 화살표(흰색+테두리). dir=4방위. */
  showArrow(block: Block, dir: Dir): void {
    block.arrow = dir;
    if (!isDir(dir)) return;
    const arrow = new THREE.Group();
    arrow.add(new THREE.Mesh(arrowGeo, arrowMat));
    arrow.add(new THREE.LineSegments(arrowEdgeGeo, arrowEdgeMat));
    arrow.rotation.z = Math.atan2(dir.y, dir.x); // +X 기준 화살표를 방향에 맞춰 회전
    arrow.position.set(0, 0, WALL_THICKNESS / 2 + 0.05); // 블록 로컬: 중앙·앞면
    block.group.add(arrow);
  }

  /** 룰5: 블록 중앙(앞면)에 확장 마커 — 동그라미 + X + 먹는 방향 분면 전체 검정. */
  showExpansion(block: Block, dirs: Dir[]): void {
    block.expDirs = dirs;
    const marker = new THREE.Group();
    marker.add(new THREE.Mesh(markDiscGeo, markWhiteMat)); // 바탕 흰 원판 (z 0)
    for (const d of dirs) {
      const wedge = new THREE.Mesh(wedgeGeoFor(expAngle(d)), markBlackMat); // 분면 검정칠
      wedge.position.z = 0.002; // 원판 위
      marker.add(wedge);
    }
    const ring = new THREE.Mesh(markRingGeo, markBlackMat); // 동그라미
    ring.position.z = 0.004;
    marker.add(ring);
    const x = new THREE.LineSegments(markXGeo, markLineMat); // X
    x.position.z = 0.006;
    marker.add(x);
    marker.position.set(0, 0, WALL_THICKNESS / 2 + 0.05); // 블록 로컬: 중앙·앞면
    block.group.add(marker);
  }

  /** 룰3/4/5: 블록 색칠(body 머티리얼 교체). 테두리는 검정 유지. */
  setColor(block: Block, color: string): void {
    block.color = color;
    block.body.material = bodyMatFor(color);
  }

  /** 블록을 새 칸으로 이동(쉬프트 결과). */
  moveBlock(block: Block, newCell: number): void {
    block.cell = newCell;
    block.group.position.x = cellToX(newCell, this.cols);
    block.group.position.y = cellToY(newCell, this.cols);
  }

  /**
   * 룰5: 확장벽이 인접 칸으로 자라난다 — 쉬프트 트리거 시점에 호출.
   * 스폰 때는 빈 칸으로 보이다가, 이 시점에 확장벽 쪽 모서리에서 바깥으로
   * 늘어나는 애니메이션과 함께 벽 블록이 생긴다(0 2 0 0 → 0 2 2 0 느낌).
   * from = 확장 방향(확장벽 → 이 칸, 4방위).
   */
  growBlock(cell: number, from: Dir): Block {
    const group = new THREE.Group();
    const body = new THREE.Mesh(cellGeo, bodyMat);
    body.castShadow = true;
    group.add(body, new THREE.LineSegments(edgeGeo, edgeMat));
    // 시작: 확장벽과 맞닿은 모서리에 납작하게 붙음(자라는 축만 0).
    group.position.set(
      cellToX(cell, this.cols) - from.x * (CELL_SIZE / 2),
      cellToY(cell, this.cols) - from.y * (CELL_SIZE / 2),
      0,
    );
    if (from.x !== 0) group.scale.x = 0.001;
    else group.scale.y = 0.001;
    this.object.add(group);
    const block: Block = { cell, arrow: DIR_NONE, color: null, group, body };
    this.blocks.push(block); // 충돌 대상 등록(트리거 시점부터 막힘)
    this.growing.push({ block, dir: from, t: 0 });
    return block;
  }

  /** 성장·재배치 애니메이션 진행 — 매 프레임 호출(Spawner. 전환 텀에는 tickTweens). */
  update(dt: number): void {
    for (let i = this.slidingBlocks.length - 1; i >= 0; i--) {
      const s = this.slidingBlocks[i]!;
      s.t += dt / REGRID_SEC;
      const k = Math.min(1, s.t);
      s.block.group.position.x = s.fromX + (s.toX - s.fromX) * easeInOut(k);
      if (k >= 1) this.slidingBlocks.splice(i, 1);
    }
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i]!;
      g.t += dt / GROW_SEC;
      const s = Math.min(1, g.t);
      const bx = cellToX(g.block.cell, this.cols);
      const by = cellToY(g.block.cell, this.cols);
      // 확장벽 쪽 모서리를 고정한 채 바깥으로 자란다(자라는 축만 스케일).
      if (g.dir.x !== 0) {
        g.block.group.scale.x = Math.max(0.001, s);
        g.block.group.position.x = bx - g.dir.x * ((1 - s) * (CELL_SIZE / 2));
        g.block.group.position.y = by;
      } else {
        g.block.group.scale.y = Math.max(0.001, s);
        g.block.group.position.y = by - g.dir.y * ((1 - s) * (CELL_SIZE / 2));
        g.block.group.position.x = bx;
      }
      if (s >= 1) this.growing.splice(i, 1);
    }
  }

  /** 현재 blocks 상태를 칸별 스냅샷으로(게임오버 before/after 표시용). */
  snapshot(): CellSnapshot[] {
    const cells: CellSnapshot[] = [];
    for (let i = 0; i < this.cellTotal; i++) {
      const b = this.blocks.find((bl) => bl.cell === i);
      cells.push(
        b
          ? { blocked: true, color: b.color, arrow: b.arrow, expandDirs: b.expDirs ?? [] }
          : { blocked: false, color: null, arrow: DIR_NONE, expandDirs: [] },
      );
    }
    return cells;
  }

  /** 이 세트의 세로 줄 수 — 총 칸수/cols. regrid 로 커질 수 있다. */
  get rows(): number {
    return Math.max(1, Math.round(this.cellTotal / this.cols));
  }

  /**
   * 그리드 확장 시 재배치(보존) — 비행 중인 세트를 비우지 않고 새 그리드로 옮긴다.
   * 옛 (col,row) 를 그대로 새 그리드 인덱스로 재인코딩(왼쪽 정렬: 새 열은 오른쪽,
   * 새 행은 위에 빈 칸으로 추가). 플레이어도 같은 방식으로 반 칸 이동하므로
   * 구–벽의 상대 위치(공정성)가 정확히 보존된다. 스냅샷(before/after)도 재매핑.
   */
  regrid(cols: number, rows: number): void {
    const oldCols = this._cols;
    if (cols === oldCols && cols * rows === this.cellTotal) return;
    for (const block of this.blocks) {
      block.cell = cellIndex(colOf(block.cell, oldCols), rowOf(block.cell, oldCols), cols);
    }
    this._cols = cols;
    this.cellTotal = cols * rows;
    for (const block of this.blocks) {
      block.group.position.y = cellToY(block.cell, cols); // 행 보존이라 사실상 불변
      const toX = cellToX(block.cell, cols);
      // 성장(growing) 중인 블록은 그 애니메이션이 새 cols 로 위치를 재계산하므로 제외.
      if (this.growing.some((g) => g.block === block)) continue;
      if (Math.abs(toX - block.group.position.x) > 1e-6) {
        this.slidingBlocks.push({ block, fromX: block.group.position.x, toX, t: 0 });
      }
    }
    if (this.before) this.before = remapSnapshot(this.before, oldCols, cols, rows);
    if (this.after) this.after = remapSnapshot(this.after, oldCols, cols, rows);
  }

  get z(): number {
    return this.object.position.z;
  }
  set z(v: number) {
    this.object.position.z = v;
  }
}

/** 스냅샷(칸별 배열)을 옛 그리드 → 새 그리드 인덱스로 재매핑. 새 칸은 빈 칸. */
function remapSnapshot(
  snap: CellSnapshot[],
  oldCols: number,
  cols: number,
  rows: number,
): CellSnapshot[] {
  const out: CellSnapshot[] = Array.from({ length: cols * rows }, () => ({
    blocked: false,
    color: null,
    arrow: DIR_NONE,
    expandDirs: [],
  }));
  snap.forEach((c, i) => {
    out[cellIndex(colOf(i, oldCols), rowOf(i, oldCols), cols)] = c;
  });
  return out;
}
