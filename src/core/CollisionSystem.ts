import { CELL_COUNT, CELL_SIZE, cellToX, PLAYER_Z } from './lane';
import { Player, PLAYER_RADIUS } from './Player';
import { Wall, WALL_THICKNESS } from './Wall';

/**
 * CollisionSystem — 구가 막힌 칸과 겹치면 충돌(=게임오버).
 *
 * 기하 판정: 구를 반지름 PLAYER_RADIUS 원으로 보고,
 *   - Z: 벽 두께가 구의 Z(PLAYER_Z)를 스쳐 지나는 동안만 검사
 *   - X: 막힌 칸([cx±CELL/2])과 구([px±r])가 겹치면 충돌
 * 즉 구가 gap(1칸) 안에 충분히 들어가 있어야 생존. 구가 작아(0.3) 여유 있음.
 */

const Z_REACH = WALL_THICKNESS / 2 + PLAYER_RADIUS; // 충돌 가능 Z 거리
const X_REACH = CELL_SIZE / 2 + PLAYER_RADIUS; // 막힌 칸과 겹치는 X 거리

export function checkCollision(player: Player, walls: readonly Wall[]): boolean {
  const px = player.x;
  for (const wall of walls) {
    if (Math.abs(wall.z - PLAYER_Z) >= Z_REACH) continue; // Z 미접촉
    for (let i = 0; i < CELL_COUNT; i++) {
      if (!wall.blocked[i]) continue; // gap 은 안전
      if (Math.abs(px - cellToX(i)) < X_REACH) return true; // 막힌 칸과 겹침
    }
  }
  return false;
}
