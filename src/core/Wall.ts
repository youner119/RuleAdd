import * as THREE from 'three';
import { CELL_COUNT, CELL_SIZE, cellToX, LANE_Y } from './lane';

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

/**
 * Block — 세트 안의 개별 벽(막힌 칸 하나).
 * color/arrowDir 는 RuleWall 을 만족(엔진이 블록별 행동을 resolve).
 */
export interface Block {
  /** 현재 칸 인덱스 (0..CELL_COUNT-1). 쉬프트로 바뀐다. */
  cell: number;
  /** 룰2 화살표 방향 (-1/0/+1). 0=화살표 없음=안 움직임. */
  arrowDir: number;
  /** 룰3/4/5 색 (없으면 null). */
  color: string | null;
  /** 이 블록의 메시 그룹(body+edges, +arrow). */
  readonly group: THREE.Group;
  /** body 메시 — 색칠 시 머티리얼 교체용. */
  readonly body: THREE.Mesh;
}

export class Wall {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  /** 세트 안 블록들(막힌 칸). gap 은 블록 없음. */
  readonly blocks: Block[];
  /** 룰2 쉬프트 1회 적용 완료 여부. */
  shifted = false;

  constructor(blocked: readonly boolean[]) {
    this.object = new THREE.Group();
    this.blocks = [];

    for (let i = 0; i < CELL_COUNT; i++) {
      if (!blocked[i]) continue; // gap
      const group = new THREE.Group();
      const body = new THREE.Mesh(cellGeo, bodyMat);
      body.castShadow = true;
      group.add(body, new THREE.LineSegments(edgeGeo, edgeMat));
      group.position.set(cellToX(i), LANE_Y + CELL_SIZE / 2, 0);
      this.object.add(group);
      this.blocks.push({ cell: i, arrowDir: 0, color: null, group, body });
    }
  }

  /** 룰2: 블록 중앙(앞면)에 화살표(흰색+테두리). dir=-1/+1. */
  showArrow(block: Block, dir: number): void {
    block.arrowDir = dir;
    if (dir === 0) return;
    const arrow = new THREE.Group();
    arrow.add(new THREE.Mesh(arrowGeo, arrowMat));
    arrow.add(new THREE.LineSegments(arrowEdgeGeo, arrowEdgeMat));
    arrow.scale.x = dir; // -1 이면 좌측 미러
    arrow.position.set(0, 0, WALL_THICKNESS / 2 + 0.05); // 블록 로컬: 중앙·앞면
    block.group.add(arrow);
  }

  /** 룰3/4/5: 블록 색칠(body 머티리얼 교체). 테두리는 검정 유지. */
  setColor(block: Block, color: string): void {
    block.color = color;
    block.body.material = bodyMatFor(color);
  }

  /** 블록을 새 칸으로 이동(쉬프트 결과). */
  moveBlock(block: Block, newCell: number): void {
    block.cell = newCell;
    block.group.position.x = cellToX(newCell);
  }

  get z(): number {
    return this.object.position.z;
  }
  set z(v: number) {
    this.object.position.z = v;
  }
}
