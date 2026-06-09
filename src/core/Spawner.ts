import * as THREE from 'three';
import { CELL_COUNT, LANE_NEAR_Z, PLAYER_Z, SPAWN_Z } from './lane';
import { generateWallPattern, pickArrows, wrapCell } from './pattern';
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

const WALL_SPEED = 7; // 월드 단위/초, 일정
const WALL_SPACING = 14; // 연속 벽(세트) 간 Z 거리 → 스폰 주기 = SPACING/SPEED
const DESPAWN_Z = LANE_NEAR_Z + 2; // 플레이어를 충분히 지나치면 제거
const SHIFT_TRIGGER_Z = PLAYER_Z - 4; // 플레이어 4유닛 앞 → 코앞에서 이동

export class Spawner {
  private readonly walls: Wall[] = [];
  private distSinceSpawn = WALL_SPACING; // 첫 프레임에 즉시 첫 벽 스폰
  private lastSig = ''; // 직전 패턴 (연속 동일 회피)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly engine: RuleEngine,
  ) {}

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

  update(dt: number): void {
    const dz = WALL_SPEED * dt;

    // 이동 + 룰2 쉬프트 트리거
    for (const w of this.walls) {
      w.z += dz;
      if (!w.shifted && w.z >= SHIFT_TRIGGER_Z) {
        this.shiftWall(w);
        w.shifted = true; // 1회만
      }
    }

    // despawn (플레이어 지나침)
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      if (w && w.z > DESPAWN_Z) {
        this.scene.remove(w.object);
        this.walls.splice(i, 1);
        // TODO(T12): 세트 통과 카운트 + 점수(T13).
      }
    }

    // 스폰 (거리 기반 주기)
    this.distSinceSpawn += dz;
    if (this.distSinceSpawn >= WALL_SPACING) {
      this.distSinceSpawn -= WALL_SPACING;
      this.spawn();
    }
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

    // 룰2 활성 시 화살표 구성 — 겹침 0 + 끝 블록 안쪽 + 명확한 정답.
    if (this.engine.isActive(2)) {
      const dirs = pickArrows(
        wall.blocks.map((b) => b.cell),
        CELL_COUNT,
      );
      wall.blocks.forEach((block, i) => {
        const dir = dirs[i] ?? 0;
        if (dir !== 0) wall.showArrow(block, dir);
      });
    }

    this.scene.add(wall.object);
    this.walls.push(wall);
  }
}

/** 패턴 시그니처 ("1011" 등) — 연속 동일 비교용. */
function sig(blocked: readonly boolean[]): string {
  return blocked.map((b) => (b ? '1' : '0')).join('');
}
