import { CELL_SIZE, cellToX, PLAYER_Z } from './lane';
import { Player, PLAYER_RADIUS } from './Player';
import { Wall, WALL_THICKNESS } from './Wall';
import type { RuleEngine } from '../rules/RuleEngine';

/**
 * CollisionSystem — 구가 블록(개별 벽)과 겹치면 충돌(=게임오버).
 *
 * 기하 판정: 구를 반지름 PLAYER_RADIUS 원으로 보고,
 *   - Z: 벽 두께가 구의 Z(PLAYER_Z)를 스쳐 지나는 동안만 검사
 *   - X: 블록 칸([cx±CELL/2])과 구([px±r])가 겹치면 충돌
 * 즉 구가 gap 안에 충분히 들어가 있어야 생존. 구가 작아(0.3) 여유 있음.
 *
 * 블록의 충돌 가능 여부는 RuleEngine 이 블록별로 결정한다(룰5: 특정 색 통과).
 */

const Z_REACH = WALL_THICKNESS / 2 + PLAYER_RADIUS; // 충돌 가능 Z 거리
const X_REACH = CELL_SIZE / 2 + PLAYER_RADIUS; // 블록과 겹치는 X 거리

export function checkCollision(player: Player, walls: readonly Wall[], engine: RuleEngine): boolean {
  const px = player.x;
  for (const wall of walls) {
    if (Math.abs(wall.z - PLAYER_Z) >= Z_REACH) continue; // Z 미접촉
    for (const block of wall.blocks) {
      if (!engine.resolveBehavior(block).collidable) continue; // 룰5: 통과 블록
      if (Math.abs(px - cellToX(block.cell)) < X_REACH) return true; // 블록과 겹침
    }
  }
  return false;
}
