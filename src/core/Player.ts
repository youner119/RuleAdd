import * as THREE from 'three';
import { COLS, CELL_SIZE, cellIndex, cellToX, LANE_Y, PLAYER_Z, START_CELL } from './lane';

/**
 * Player — 흰 구.
 *
 * 흰 배경에서 형태가 읽히도록 두 겹으로 만든다:
 *   1) 흰 구 본체 (MeshStandard + emissive, castShadow)
 *   2) inverted-hull 테두리 (살짝 키운 BackSide 어두운 구 → 검은 실루엣)
 *
 * 이동 = 슬라이드 스냅: wasd 최초 press 시 목표 칸(열 ±1 / 행 ±1)을 지정하고
 * SLIDE_SPEED 로 부드럽게 슬라이드한 뒤 칸 중앙에 정확히 정지.
 * 슬라이드 중 추가 입력은 1개만 버퍼링(Game 이 consumeMove 로 처리).
 * 세로(행) 이동은 rows>1(4×4 모드/룰6) 일 때만 의미가 있다 — rows=1 이면 w/s 무동작.
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
  private currentCol = START_CELL;
  private currentRow = 0;
  private rows: number; // 세로 줄 수 (1=4×1, 4=4×4). 행 이동 clamp 범위.
  private targetX: number;
  private targetY: number;
  private sliding = false;
  private buffered: { dx: number; dy: number } | null = null; // 슬라이드 중 입력 1개 보관

  constructor(rows = 1) {
    this.rows = rows;
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
    this.targetX = cellToX(cellIndex(START_CELL, 0));
    this.targetY = this.rowToY(0);
    this.object.position.set(this.targetX, this.targetY, PLAYER_Z);
  }

  /** 행(row) → 구 중심 Y. row 0 = 기존 4×1 높이(레인 위), 위로 한 칸씩 올라간다. */
  private rowToY(row: number): number {
    return LANE_Y + PLAYER_RADIUS + row * CELL_SIZE;
  }

  /** 현재 X 위치 (충돌 판정 등에서 사용). */
  get x(): number {
    return this.object.position.x;
  }

  /** 현재 Y 위치 (4×4 세로 충돌 판정에서 사용). */
  get y(): number {
    return this.object.position.y;
  }

  /** 세로 줄 수 갱신(4×4 모드/룰6 확장). 현재 행이 범위를 벗어나면 clamp. */
  setRows(rows: number): void {
    this.rows = rows;
    if (this.currentRow > rows - 1) {
      this.currentRow = rows - 1;
      this.targetY = this.rowToY(this.currentRow);
      this.object.position.y = this.targetY;
    }
  }

  /**
   * 이동 요청 (dx=열 ±1, dy=행 ±1) — 슬라이드 중이면 1개 버퍼, 경계 밖이면 정지.
   * Game 이 consumeMove() 결과를 받아 매 프레임 호출한다.
   */
  tryMove(dx: number, dy: number): void {
    if (this.sliding) {
      this.buffered = { dx, dy }; // 슬라이드 완료 후 실행
      return;
    }
    this.startSlide(dx, dy);
  }

  private startSlide(dx: number, dy: number): void {
    const nextCol = Math.max(0, Math.min(COLS - 1, this.currentCol + dx));
    const nextRow = Math.max(0, Math.min(this.rows - 1, this.currentRow + dy));
    if (nextCol === this.currentCol && nextRow === this.currentRow) return; // 경계 밖 — 무시
    this.currentCol = nextCol;
    this.currentRow = nextRow;
    this.targetX = cellToX(cellIndex(nextCol, nextRow));
    this.targetY = this.rowToY(nextRow);
    this.sliding = true;
  }

  /** 한 프레임 업데이트 — 슬라이드 중이면 목표(X,Y) 쪽으로 이동. */
  update(dt: number): void {
    if (!this.sliding) return;
    const pos = this.object.position;
    const dx = this.targetX - pos.x;
    const dy = this.targetY - pos.y;
    if (Math.abs(dx) <= SNAP_THRESHOLD && Math.abs(dy) <= SNAP_THRESHOLD) {
      pos.x = this.targetX;
      pos.y = this.targetY;
      this.sliding = false;
      if (this.buffered) {
        const b = this.buffered;
        this.buffered = null;
        this.startSlide(b.dx, b.dy);
      }
      return;
    }
    const step = SLIDE_SPEED * dt;
    if (Math.abs(dx) > SNAP_THRESHOLD) pos.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
    if (Math.abs(dy) > SNAP_THRESHOLD) pos.y += Math.sign(dy) * Math.min(Math.abs(dy), step);
  }

  /** 재시작 — 시작 셀(col START_CELL, row 0)로 복귀 + 충돌 표시 해제. */
  reset(): void {
    this.currentCol = START_CELL;
    this.currentRow = 0;
    this.targetX = cellToX(cellIndex(START_CELL, 0));
    this.targetY = this.rowToY(0);
    this.object.position.set(this.targetX, this.targetY, PLAYER_Z);
    this.sliding = false;
    this.buffered = null;
    this.setHit(false);
  }

  /** 충돌 표시 — true=빨강, false=흰색. */
  setHit(hit: boolean): void {
    const c = hit ? 0xe23b3b : 0xffffff;
    this.bodyMat.color.setHex(c);
    this.bodyMat.emissive.setHex(c);
  }
}
