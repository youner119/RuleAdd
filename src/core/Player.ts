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
 * 세로(행) 이동은 rows>1(2차원 모드) 일 때만 의미가 있다 — rows=1 이면 w/s 무동작.
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
  private cols: number; // 가로 칸 수 (확장 룰로 4→5…). 열 이동 clamp + 셀 인덱스 기준.
  private targetX: number;
  private targetY: number;
  private sliding = false;
  private buffered: { dx: number; dy: number } | null = null; // 슬라이드 중 입력 1개 보관

  constructor(rows = 1, cols = COLS) {
    this.rows = rows;
    this.cols = cols;
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
    this.targetX = cellToX(cellIndex(START_CELL, 0, this.cols), this.cols);
    this.targetY = this.rowToY(0);
    this.object.position.set(this.targetX, this.targetY, PLAYER_Z);
  }

  /**
   * 행(row) → 구 중심 Y.
   *  - 4×1(rows=1): 레인 위에 얹힘(기존 그대로) — 한 줄뿐이라 세로 충돌 모호성 없음.
   *  - 4×4(rows>1): 칸 중앙(블록 중심과 동일) — 세로 충돌이 가로처럼 대칭이 되어
   *    아래/위 행 거리가 모두 1.0(>Y_REACH)으로 또렷이 안전·위험이 갈린다.
   */
  private rowToY(row: number): number {
    return this.rows > 1
      ? LANE_Y + CELL_SIZE / 2 + row * CELL_SIZE
      : LANE_Y + PLAYER_RADIUS;
  }

  /** 현재 X 위치 (충돌 판정 등에서 사용). */
  get x(): number {
    return this.object.position.x;
  }

  /** 현재 Y 위치 (4×4 세로 충돌 판정에서 사용). */
  get y(): number {
    return this.object.position.y;
  }

  /** 현재 칸(플랫 인덱스 row*cols+col) — 게임오버 "죽은 칸" 표시용. */
  get cell(): number {
    return cellIndex(this.currentCol, this.currentRow, this.cols);
  }

  /** 세로 줄 수 갱신(2차원 모드 확장 4→5). 행 clamp + Y 기준(바닥/중앙) 재계산. */
  setRows(rows: number): void {
    this.rows = rows;
    this.currentRow = Math.min(this.currentRow, rows - 1);
    this.targetY = this.rowToY(this.currentRow); // 4×1↔4×4 전환 시 높이 갱신
    this.object.position.y = this.targetY;
  }

  /** 가로 칸 수 갱신(확장 룰). 열 clamp + 새 X 로 슬라이드(반 칸 이동 애니메이션). */
  setCols(cols: number): void {
    this.cols = cols;
    this.currentCol = Math.min(this.currentCol, cols - 1);
    this.targetX = cellToX(cellIndex(this.currentCol, this.currentRow, cols), cols);
    if (Math.abs(this.targetX - this.object.position.x) > SNAP_THRESHOLD) this.sliding = true;
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
    const nextCol = Math.max(0, Math.min(this.cols - 1, this.currentCol + dx));
    const nextRow = Math.max(0, Math.min(this.rows - 1, this.currentRow + dy));
    if (nextCol === this.currentCol && nextRow === this.currentRow) return; // 경계 밖 — 무시
    this.currentCol = nextCol;
    this.currentRow = nextRow;
    this.targetX = cellToX(cellIndex(nextCol, nextRow, this.cols), this.cols);
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
    this.targetX = cellToX(cellIndex(START_CELL, 0, this.cols), this.cols);
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
