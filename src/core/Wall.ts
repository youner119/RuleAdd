import * as THREE from 'three';
import { CELL_COUNT, CELL_SIZE, cellToX, LANE_Y } from './lane';

/**
 * Wall — 한 "세트". 4×1 한 줄에서 일부 칸을 막고 ≥1칸 gap 을 남긴다.
 *
 * 막힌 칸마다 흰색 정사각 블록(EdgesGeometry 테두리)을 둔다. 흰색인 이유는
 * 룰3에서 칸별 색을 입히기 위함(지금은 흰색·테두리, 모양으로 구와 구별).
 * 정사각(CELL_SIZE×CELL_SIZE) 이라 4×4 확장 시 Y로 균일하게 쌓을 수 있다.
 *
 * 패턴(어느 칸이 막혔는지)은 생성자 인자로 받는다 — 생성 규칙은 Spawner/T6.
 */

export const WALL_THICKNESS = 0.6; // Z 두께 (면은 정사각, 두께만 얕게). 충돌 Z 판정에도 사용.
const BLOCK_COLOR = 0xffffff;
const EDGE_COLOR = 0x222222;

// 모든 벽이 공유하는 리소스 (동일 규격 → 메모리 절약, despawn 시 dispose 불필요).
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

export class Wall {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  /** 칸별 막힘 여부 (true=막힘, false=gap). 길이 CELL_COUNT. */
  readonly blocked: readonly boolean[];

  constructor(blocked: readonly boolean[]) {
    this.blocked = blocked;
    this.object = new THREE.Group();

    for (let i = 0; i < CELL_COUNT; i++) {
      if (!blocked[i]) continue; // gap 은 빈 칸
      const body = new THREE.Mesh(cellGeo, bodyMat);
      body.castShadow = true;
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      const cell = new THREE.Group();
      cell.add(body, edges);
      cell.position.set(cellToX(i), LANE_Y + CELL_SIZE / 2, 0); // 레인 위에 얹음
      this.object.add(cell);
    }
  }

  get z(): number {
    return this.object.position.z;
  }
  set z(v: number) {
    this.object.position.z = v;
  }
}
