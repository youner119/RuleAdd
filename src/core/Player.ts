import * as THREE from 'three';
import { CELL_COUNT, cellToX, LANE_Y, PLAYER_Z, START_CELL } from './lane';

/**
 * Player — 흰 구.
 *
 * 흰 배경에서 형태가 읽히도록 두 겹으로 만든다:
 *   1) 흰 구 본체 (MeshStandard + emissive, castShadow)
 *   2) inverted-hull 테두리 (살짝 키운 BackSide 어두운 구 → 검은 실루엣)
 *
 * 이동 = 슬라이드 스냅: a/d 최초 press 시 목표 칸(±1)을 지정하고
 * SLIDE_SPEED 로 부드럽게 슬라이드한 뒤 칸 중앙에 정확히 정지.
 * 슬라이드 중 추가 입력은 무시된다(Game 이 consumeMove 로 처리).
 */

export const PLAYER_RADIUS = 0.3; // 셀 1단위보다 작게(지름 0.6) — 충돌 판정 여유.
const OUTLINE_SCALE = 1.06;
const OUTLINE_COLOR = 0x222222;

/** 슬라이드 속도 (월드 단위/초). 1칸(1유닛) ≈ 83ms. */
const SLIDE_SPEED = 12;
const SNAP_THRESHOLD = 0.01;

export class Player {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private currentCell = START_CELL;
  private targetX: number;
  private sliding = false;
  private bufferedDir = 0; // 슬라이드 중 입력 1개 보관 (나중 입력이 덮어씀)

  constructor() {
    this.object = new THREE.Group();

    const geo = new THREE.SphereGeometry(PLAYER_RADIUS, 48, 32);

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      metalness: 0,
    });
    const body = new THREE.Mesh(geo, this.bodyMat);
    body.castShadow = true;

    const outline = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }),
    );
    outline.scale.setScalar(OUTLINE_SCALE);

    this.object.add(outline, body);
    this.targetX = cellToX(START_CELL);
    this.object.position.set(this.targetX, LANE_Y + PLAYER_RADIUS, PLAYER_Z);
  }

  /** 현재 X 위치 (충돌 판정 등에서 사용). */
  get x(): number {
    return this.object.position.x;
  }

  /**
   * 이동 요청 — 슬라이드 중이면 무시, 경계 밖이면 정지.
   * Game 이 consumeMove() 결과를 받아 매 프레임 호출한다.
   */
  tryMove(dir: number): void {
    if (this.sliding) {
      this.bufferedDir = dir; // 슬라이드 완료 후 실행
      return;
    }
    this.startSlide(dir);
  }

  private startSlide(dir: number): void {
    const next = Math.max(0, Math.min(CELL_COUNT - 1, this.currentCell + dir));
    if (next === this.currentCell) return; // 경계 밖 — 무시
    this.currentCell = next;
    this.targetX = cellToX(next);
    this.sliding = true;
  }

  /** 한 프레임 업데이트 — 슬라이드 중이면 targetX 쪽으로 이동. */
  update(dt: number): void {
    if (!this.sliding) return;
    const pos = this.object.position;
    const diff = this.targetX - pos.x;
    if (Math.abs(diff) <= SNAP_THRESHOLD) {
      pos.x = this.targetX;
      this.sliding = false;
      if (this.bufferedDir !== 0) {
        const d = this.bufferedDir;
        this.bufferedDir = 0;
        this.startSlide(d);
      }
      return;
    }
    pos.x += Math.sign(diff) * Math.min(Math.abs(diff), SLIDE_SPEED * dt);
  }

  /** 재시작 — 시작 셀로 복귀 + 충돌 표시 해제. */
  reset(): void {
    this.currentCell = START_CELL;
    this.targetX = cellToX(START_CELL);
    this.object.position.x = this.targetX;
    this.sliding = false;
    this.bufferedDir = 0;
    this.setHit(false);
  }

  /** 충돌 표시 — true=빨강, false=흰색. */
  setHit(hit: boolean): void {
    const c = hit ? 0xe23b3b : 0xffffff;
    this.bodyMat.color.setHex(c);
    this.bodyMat.emissive.setHex(c);
  }
}
