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

/** 행/열 가이드 점선 — 색·투명도·점선 패턴(- - - - 느낌, 은은하게). */
const GUIDE_COLOR = 0xaaaaaa;
const GUIDE_OPACITY = 0.28;
const GUIDE_DASH = 0.2;
const GUIDE_GAP = 0.26;

export class Player {
  /** 씬에 추가하는 루트. */
  readonly object: THREE.Group;
  /**
   * 행/열 가이드 점선(2차원 전용) — 플레이어 평면(z=PLAYER_Z)에서 구의 양 끝
   * (위/아래·좌/우 가장자리)에 닿는 반투명 점선 4줄. 구가 점선 레일 사이에 끼어
   * 있는 모양으로 내 행/열을 알려준다(Y 위치 인지 보조).
   * 구를 따라 움직이므로 별도 씬 오브젝트(Game 이 scene 에 추가). rows=1 이면 숨김.
   */
  readonly guide: THREE.LineSegments;
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

    // 가이드 점선 — 가로 2줄(0-3)·세로 2줄(4-7), 총 4선분. 매 프레임 위치 갱신.
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
    this.guide = new THREE.LineSegments(
      guideGeo,
      new THREE.LineDashedMaterial({
        color: GUIDE_COLOR,
        transparent: true,
        opacity: GUIDE_OPACITY,
        dashSize: GUIDE_DASH,
        gapSize: GUIDE_GAP,
      }),
    );
    this.refreshGuide();
  }

  /** 가이드 점선 갱신 — 구 양 끝에 닿는 가로/세로 점선 4줄을 다시 깐다(2차원 전용). */
  private refreshGuide(): void {
    this.guide.visible = this.rows > 1;
    if (!this.guide.visible) return;
    const xMin = cellToX(0, this.cols) - CELL_SIZE / 2;
    const xMax = cellToX(this.cols - 1, this.cols) + CELL_SIZE / 2;
    const yMin = LANE_Y;
    const yMax = LANE_Y + this.rows * CELL_SIZE;
    const px = this.object.position.x;
    const py = this.object.position.y;
    const r = CELL_SIZE / 2; // 칸 경계에 선이 깔린다 — "4×4 의 어느 칸인지"가 읽히게
    const pos = this.guide.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, xMin, py + r, PLAYER_Z); // 가로 점선(내 행 위 경계)
    pos.setXYZ(1, xMax, py + r, PLAYER_Z);
    pos.setXYZ(2, xMin, py - r, PLAYER_Z); // 가로 점선(내 행 아래 경계)
    pos.setXYZ(3, xMax, py - r, PLAYER_Z);
    pos.setXYZ(4, px - r, yMin, PLAYER_Z); // 세로 점선(내 열 왼쪽 경계)
    pos.setXYZ(5, px - r, yMax, PLAYER_Z);
    pos.setXYZ(6, px + r, yMin, PLAYER_Z); // 세로 점선(내 열 오른쪽 경계)
    pos.setXYZ(7, px + r, yMax, PLAYER_Z);
    pos.needsUpdate = true;
    this.guide.computeLineDistances(); // 점선 패턴은 선분 거리 기반 — 위치 갱신마다 재계산
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
    this.refreshGuide();
  }

  /** 가로 칸 수 갱신(확장 룰). 열 clamp + 새 X 로 슬라이드(반 칸 이동 애니메이션). */
  setCols(cols: number): void {
    this.cols = cols;
    this.currentCol = Math.min(this.currentCol, cols - 1);
    this.targetX = cellToX(cellIndex(this.currentCol, this.currentRow, cols), cols);
    if (Math.abs(this.targetX - this.object.position.x) > SNAP_THRESHOLD) this.sliding = true;
    this.refreshGuide();
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

  /** 한 프레임 업데이트 — 슬라이드 중이면 목표(X,Y) 쪽으로 이동(+실금 따라옴). */
  update(dt: number): void {
    this.refreshGuide(); // 직전 프레임 이동분 반영(슬라이드 중 실금이 함께 따라온다)
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
    this.refreshGuide();
  }

  /** 충돌 표시 — true=빨강, false=흰색. */
  setHit(hit: boolean): void {
    const c = hit ? 0xe23b3b : 0xffffff;
    this.bodyMat.color.setHex(c);
    this.bodyMat.emissive.setHex(c);
  }
}
