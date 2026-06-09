import * as THREE from 'three';
import { cellToX, LANE_X_MAX, LANE_X_MIN, LANE_Y, PLAYER_Z, START_CELL } from './lane';

/**
 * Player — 흰 구.
 *
 * 흰 배경에서 형태가 읽히도록 두 겹으로 만든다:
 *   1) 흰 구 본체 (MeshStandard + emissive, castShadow)
 *   2) inverted-hull 테두리 (살짝 키운 BackSide 어두운 구 → 검은 실루엣)
 *
 * 이동 = 자유 연속(free continuous): a/d 를 누르는 동안 일정 속도로 X 를
 * 따라 미끄러지고, 레인 경계에서 clamp 된다. 위치는 셀에 고정되지 않는다
 * (셀은 벽 패턴·충돌 판정의 기준이고, 플레이어 X 는 실수값).
 */

export const PLAYER_RADIUS = 0.3; // 셀 1단위보다 작게(지름 0.6) — 충돌 판정(T7) 여유.
const OUTLINE_SCALE = 1.06;
const OUTLINE_COLOR = 0x222222;

/** 좌우 이동 속도 (월드 단위/초). 레인 폭 4 → 약 0.7s 에 횡단. */
const MOVE_SPEED = 5;

// 구가 레인 밖으로 삐져나가지 않도록 한 X 범위.
const MIN_X = LANE_X_MIN + PLAYER_RADIUS;
const MAX_X = LANE_X_MAX - PLAYER_RADIUS;

export class Player {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;

  constructor() {
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
    // 레인 표면(LANE_Y) 위, 시작 셀의 X 에서 출발.
    this.object.position.set(cellToX(START_CELL), LANE_Y + PLAYER_RADIUS, PLAYER_Z);
  }

  /** 현재 X 위치 (충돌 판정 등에서 사용). */
  get x(): number {
    return this.object.position.x;
  }

  /** 재시작 — 시작 셀 X 로 복귀. */
  reset(): void {
    this.object.position.x = cellToX(START_CELL);
  }

  /**
   * 한 프레임 이동. dir = -1(좌)/0/+1(우), dt = 초.
   * 레인 경계 clamp.
   */
  update(dt: number, dir: number): void {
    if (dir === 0) return;
    const next = this.object.position.x + dir * MOVE_SPEED * dt;
    this.object.position.x = THREE.MathUtils.clamp(next, MIN_X, MAX_X);
  }
}
