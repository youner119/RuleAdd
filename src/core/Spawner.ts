import * as THREE from 'three';
import { LANE_NEAR_Z, SPAWN_Z } from './lane';
import { generateWallPattern } from './pattern';
import { Wall } from './Wall';

/**
 * Spawner — 벽 세트를 먼 곳에서 스폰하고 일정 속도로 +Z(플레이어쪽)로 접근시킨다.
 *
 * 속도는 라운드 무관 일정(가속 없음, AC5). 난이도는 룰 누적에서만 온다.
 * 플레이어를 지나친 벽은 despawn. 통과 카운트(세트 통과)는 T12에서 배선.
 */

const WALL_SPEED = 6; // 월드 단위/초, 일정
const WALL_SPACING = 10; // 연속 벽 간 Z 거리 → 스폰 주기 = SPACING/SPEED
const DESPAWN_Z = LANE_NEAR_Z + 2; // 플레이어를 충분히 지나치면 제거

export class Spawner {
  private readonly walls: Wall[] = [];
  private distSinceSpawn = WALL_SPACING; // 첫 프레임에 즉시 첫 벽 스폰
  private lastSig = ''; // 직전 패턴 (연속 동일 회피)

  constructor(private readonly scene: THREE.Scene) {}

  /** 활성 벽 목록 (T7 충돌 판정에서 사용). */
  get activeWalls(): readonly Wall[] {
    return this.walls;
  }

  update(dt: number): void {
    const dz = WALL_SPEED * dt;

    // 이동
    for (const w of this.walls) w.z += dz;

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

  private spawn(): void {
    // 직전과 동일한 패턴이면 몇 번 다시 굴려 단조로움 방지.
    let pattern = generateWallPattern();
    for (let t = 0; t < 3 && sig(pattern) === this.lastSig; t++) {
      pattern = generateWallPattern();
    }
    this.lastSig = sig(pattern);

    const wall = new Wall(pattern);
    wall.z = SPAWN_Z;
    this.scene.add(wall.object);
    this.walls.push(wall);
  }
}

/** 패턴 시그니처 ("1011" 등) — 연속 동일 비교용. */
function sig(blocked: readonly boolean[]): string {
  return blocked.map((b) => (b ? '1' : '0')).join('');
}
