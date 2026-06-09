import * as THREE from 'three';
import { CELL_COUNT, LANE_NEAR_Z, PLAYER_Z, SPAWN_Z } from './lane';
import { generateWallPattern, wrapCell } from './pattern';
import { Wall } from './Wall';
import type { RuleEngine } from '../rules/RuleEngine';

/**
 * Spawner — 벽 세트를 먼 곳에서 스폰하고 일정 속도로 +Z(플레이어쪽)로 접근시킨다.
 *
 * 속도는 라운드 무관 일정(가속 없음, AC5). 난이도는 룰 누적에서만 온다.
 * 룰2 활성 시 스폰 벽에 화살표(좌/우/없음) 부여, 트리거 도달 시 패턴 쉬프트
 * (방향은 엔진 resolveBehavior 경유 → 룰3/4 반영). 플레이어 지나친 벽 despawn.
 * 통과 카운트(세트 통과)는 T12에서 배선.
 */

const WALL_SPACING = 28; // 연속 벽(세트) 간 Z 거리 → 스폰 주기 = SPACING/SPEED
const DEFAULT_INTERVAL_SEC = 4; // 세트 도착 간격 기본값(난이도 미지정 시 = 쉬움 속도)
const DESPAWN_Z = LANE_NEAR_Z + 2; // 플레이어를 충분히 지나치면 제거
const SHIFT_TRIGGER_Z = PLAYER_Z - 4; // 플레이어 4유닛 앞 → 코앞에서 이동
const COLOR_RATE = 0.5; // 각 블록이 활성 룰 색을 받을 확률 (룰3/4/5)

export class Spawner {
  private readonly walls: Wall[] = [];
  private distSinceSpawn = WALL_SPACING; // 첫 프레임에 즉시 첫 벽 스폰
  private lastSig = ''; // 직전 패턴 (연속 동일 회피)
  /** 벽 이동 속도(월드 단위/초). 세트 간격(초) = WALL_SPACING / 이 값. */
  private readonly wallSpeed: number;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly engine: RuleEngine,
    setIntervalSec: number = DEFAULT_INTERVAL_SEC,
  ) {
    this.wallSpeed = WALL_SPACING / setIntervalSec;
  }

  /** 활성 벽 목록 (T7 충돌 판정에서 사용). */
  get activeWalls(): readonly Wall[] {
    return this.walls;
  }

  /** 재시작 — 모든 벽 제거 + 스폰 상태 초기화. */
  reset(): void {
    for (const w of this.walls) this.scene.remove(w.object);
    this.walls.length = 0;
    this.distSinceSpawn = WALL_SPACING; // 다음 프레임 즉시 첫 벽
    this.lastSig = '';
  }

  /**
   * @param speedMul 진행 속도 배율(스페이스바 스킵 시 >1). 벽 이동·스폰 주기에
   *   동일 적용 → 세트 간격(WALL_SPACING)은 배율과 무관하게 유지.
   * @returns 이 프레임에 플레이어를 지나친(통과한) 세트 수.
   */
  update(dt: number, speedMul = 1): number {
    const dz = this.wallSpeed * speedMul * dt;

    // 이동 + 룰2 쉬프트 트리거
    for (const w of this.walls) {
      w.z += dz;
      if (!w.shifted && w.z >= SHIFT_TRIGGER_Z) {
        this.shiftWall(w);
        w.shifted = true; // 1회만
      }
    }

    // despawn (플레이어 지나침) = 세트 통과
    let passed = 0;
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      if (w && w.z > DESPAWN_Z) {
        this.scene.remove(w.object);
        this.walls.splice(i, 1);
        passed++;
      }
    }

    // 스폰 (거리 기반 주기)
    this.distSinceSpawn += dz;
    if (this.distSinceSpawn >= WALL_SPACING) {
      this.distSinceSpawn -= WALL_SPACING;
      this.spawn();
    }

    return passed;
  }

  /**
   * 룰2 쉬프트 — 블록별 화살표 방향(엔진 shiftDir, 룰3/4 반영)으로 1칸 이동.
   * 단, 다른 블록이 점유한(또는 점유하게 될) 칸으로는 못 들어간다(겹침 방지).
   * 목표 칸이 빈 경우에만 이동을 허용하며, 비워지는 칸을 반복 반영한다.
   */
  private shiftWall(wall: Wall): void {
    const blocks = wall.blocks;
    const finals = blocks.map((b) => {
      const dir = this.engine.resolveBehavior(b).shiftDir; // 룰3 반대/룰4 정지
      return wrapCell(b.cell + dir, CELL_COUNT); // 끝에서 바깥 → 반대쪽 끝(순환)
    });

    // 최종 칸이 모두 distinct → 전부 적용(맞바꿈 포함, 겹침 없음).
    // 보통 케이스: pickArrows 가 구성 단계에서 이미 distinct 를 보장.
    if (new Set(finals).size === finals.length) {
      blocks.forEach((b, i) => {
        const f = finals[i] as number;
        if (f !== b.cell) wall.moveBlock(b, f);
      });
      return;
    }

    // 충돌(룰 반전 등) → 빈 칸으로만 그리디 이동, 나머지 정지(겹침 0 보장).
    const plan = blocks.map((b, i) => ({ block: b, pos: b.cell, target: finals[i] as number }));
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of plan) {
        if (p.pos === p.target) continue;
        if (!plan.some((q) => q !== p && q.pos === p.target)) {
          p.pos = p.target;
          changed = true;
        }
      }
    }
    for (const p of plan) {
      if (p.pos !== p.block.cell) wall.moveBlock(p.block, p.pos);
    }
  }

  private spawn(): void {
    // 직전과 동일한 패턴이면 몇 번 다시 굴려 단조로움 방지.
    let pattern = generateWallPattern();
    for (let t = 0; t < 3 && sig(pattern) === this.lastSig; t++) {
      pattern = generateWallPattern();
    }
    this.lastSig = sig(pattern);

    const wall = new Wall(pattern);
    wall.z = SPAWN_Z;

    this.decorate(wall);

    this.scene.add(wall.object);
    this.walls.push(wall);
  }

  /**
   * 세트 구성 — 색(룰3/4/5) + 화살표(룰2) 부여.
   * 색을 먼저 칠하고, 엔진이 계산한 실제 이동(반대/정지 반영) 기준으로 겹침0 +
   * 정답이 되도록 화살표를 구성한다(rejection sampling). 실패 시 화살표 0.
   */
  private decorate(wall: Wall): void {
    const blocks = wall.blocks;

    // 1) 색칠 — 활성 색 룰의 targetColor 중 무작위(확률 COLOR_RATE).
    const activeColors = this.engine.activeRules
      .map((r) => r.targetColor)
      .filter((c): c is string => typeof c === 'string');
    if (activeColors.length > 0) {
      for (const b of blocks) {
        if (Math.random() < COLOR_RATE) {
          wall.setColor(b, activeColors[Math.floor(Math.random() * activeColors.length)] as string);
        }
      }
    }

    // 2) 화살표 — 룰2 활성 시, 실제 이동 기준 겹침0 이 되는 조합을 찾는다.
    if (!this.engine.isActive(2)) return;
    for (let t = 0; t < 24; t++) {
      const dirs = blocks.map(() => Math.floor(Math.random() * 3) - 1); // -1/0/+1
      blocks.forEach((b, i) => (b.arrowDir = dirs[i] as number)); // effective 계산용
      const finals = blocks.map((b) =>
        wrapCell(b.cell + this.engine.resolveBehavior(b).shiftDir, CELL_COUNT),
      );
      if (new Set(finals).size === finals.length) {
        blocks.forEach((b, i) => {
          if ((dirs[i] as number) !== 0) wall.showArrow(b, dirs[i] as number);
        });
        return;
      }
    }
    blocks.forEach((b) => (b.arrowDir = 0)); // 실패 시 정지
  }
}

/** 패턴 시그니처 ("1011" 등) — 연속 동일 비교용. */
function sig(blocked: readonly boolean[]): string {
  return blocked.map((b) => (b ? '1' : '0')).join('');
}
