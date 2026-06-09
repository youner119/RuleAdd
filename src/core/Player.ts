import * as THREE from 'three';
import { cellToX, LANE_Y, PLAYER_Z, START_CELL } from './lane';

/**
 * Player — 흰 구.
 *
 * 흰 배경에서 형태가 읽히도록 두 겹으로 만든다:
 *   1) 흰 구 본체 (MeshStandard, 조명 음영 + castShadow)
 *   2) inverted-hull 테두리 (살짝 키운 BackSide 어두운 구 → 검은 실루엣)
 *
 * 이동(a/d) 로직은 T4에서 이 클래스에 추가한다. 여기서는 시작 셀 배치까지.
 */

// 셀 1단위보다 작게(지름 0.6) — 셀 안 양쪽 0.2 여유로 충돌 판정(T7)이 너그러움.
export const PLAYER_RADIUS = 0.3;
const OUTLINE_SCALE = 1.06;
const OUTLINE_COLOR = 0x222222;

export class Player {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  /** 현재 셀 인덱스(0..3). */
  currentCell: number;

  constructor() {
    this.currentCell = START_CELL;
    this.object = new THREE.Group();

    const geo = new THREE.SphereGeometry(PLAYER_RADIUS, 48, 32);

    const body = new THREE.Mesh(
      geo,
      // emissive 흰색을 약하게 더해 음영진 측면도 흰색으로 읽히게. 형태는 테두리/그림자가 담당.
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.6,
        metalness: 0,
      }),
    );
    body.castShadow = true;

    const outline = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }),
    );
    outline.scale.setScalar(OUTLINE_SCALE);

    this.object.add(outline, body);
    // 레인 표면(LANE_Y) 위에 구가 놓이도록 반지름만큼 더 올림.
    this.object.position.set(cellToX(this.currentCell), LANE_Y + PLAYER_RADIUS, PLAYER_Z);
  }
}
