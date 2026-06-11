import * as THREE from 'three';
import { COLS, LANE_NEAR_Z, PLAYER_Z, SPAWN_Z, isDir, stepCell } from './lane';
import { generateSet, type Num, type SetPlan } from './setgen';
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

export class Spawner {
  private readonly walls: Wall[] = [];
  private distSinceSpawn = WALL_SPACING; // 첫 프레임에 즉시 첫 벽 스폰
  private lastSig = ''; // 직전 패턴 (연속 동일 회피)
  /** 기본 벽 이동 속도(월드 단위/초). 세트 간격(초) = WALL_SPACING / 이 값. */
  private readonly baseSpeed: number;
  /** 진행(속도 룰) 누적 배율 — Game 이 setSpeedMult 로 갱신(10·20·30… 라운드 ×1.05). */
  private speedMult = 1;
  /** 세로 줄 수 (1차원=1, 2차원=4·확장 시 5). Game 이 setRows 로 바꾼다. */
  private rows: number;
  /** 가로 칸 수 (확장 룰로 4→5…). Game 이 setCols 로 바꾼다. */
  private cols: number;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly engine: RuleEngine,
    setIntervalSec: number = DEFAULT_INTERVAL_SEC,
    rows = 1,
    cols = COLS,
  ) {
    this.baseSpeed = WALL_SPACING / setIntervalSec;
    this.rows = rows;
    this.cols = cols;
  }

  /** 진행 속도 배율 갱신(라운드 10·20·30… 누적 ×1.05). 비행 중 세트에도 즉시 적용. */
  setSpeedMult(mult: number): void {
    this.speedMult = mult;
  }

  /** 세로 줄 수 갱신(2차원 모드 확장 4→5). 다음 스폰부터 적용. */
  setRows(rows: number): void {
    this.rows = rows;
  }

  /** 가로 칸 수 갱신(확장 룰). 다음 스폰부터 적용. */
  setCols(cols: number): void {
    this.cols = cols;
  }

  /** 그리드 확장 시 비행 중인 세트를 보존한 채 새 그리드로 재배치(Wall.regrid). */
  regridWalls(rows: number, cols: number): void {
    for (const w of this.walls) w.regrid(cols, rows);
  }

  /**
   * 라운드 전환 텀(게임 정지) 동안 벽 애니메이션만 진행 — Z 이동·스폰 없이
   * regrid 슬라이드/확장 성장 보간만 돌린다(Game 이 전환 중 호출).
   */
  tickTweens(dt: number): void {
    for (const w of this.walls) w.update(dt);
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
    const dz = this.baseSpeed * this.speedMult * speedMul * dt;

    // 이동 + 룰2 쉬프트/룰5 확장 트리거 (같은 타이밍)
    for (const w of this.walls) {
      w.z += dz;
      if (!w.shifted && w.z >= SHIFT_TRIGGER_Z) {
        this.shiftWall(w);
        this.expandWall(w);
        w.shifted = true; // 1회만
        w.after = w.snapshot(); // 쉬프트·확장 후 모습(게임오버 표시용)
      }
      w.update(dt); // 확장 성장 애니메이션
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
      const dir = this.engine.resolveBehavior(b).shift; // 2D 방향(룰3 정지 등 반영)
      // 세트 자신의 스폰 시점 그리드 기준 — 확장 직후 날아오던 옛 세트도 올바르게 이동.
      return stepCell(b.cell, dir, wall.rows, wall.cols); // 끝에서 바깥 → 반대쪽 끝(토러스)
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

  /**
   * 룰5 확장 — 쉬프트와 같은 타이밍에, 확장벽이 마커 방향의 인접 칸으로 자라난다.
   * 그 칸은 스폰 때 빈 칸으로 보였던 함정 칸(생성기가 겹침0·정답을 이미 보장).
   */
  private expandWall(wall: Wall): void {
    for (const b of [...wall.blocks]) {
      if (!b.expDirs) continue;
      for (const d of b.expDirs) {
        wall.growBlock(stepCell(b.cell, d, wall.rows, wall.cols), d);
      }
    }
  }

  private spawn(): void {
    // 새 생성기(setgen)로 세트 구성. 직전과 동일하면 몇 번 다시 굴려 단조로움 방지.
    let plan = this.makePlan();
    for (let t = 0; t < 3 && planSig(plan) === this.lastSig; t++) plan = this.makePlan();
    this.lastSig = planSig(plan);

    const wall = new Wall(blockedFromPlan(plan), this.cols);
    wall.z = SPAWN_Z;
    this.applyPlan(wall, plan);
    wall.before = wall.snapshot(); // 스폰 시점 모습(게임오버 표시용)

    this.scene.add(wall.object);
    this.walls.push(wall);
  }

  /** 해당 행동 종류의 색 룰이 활성이고 색까지 배정됐는가(생성기 활성 판단). */
  private hasColoredKind(kind: 'stop' | 'pass' | 'opposite'): boolean {
    return this.engine.activeRules.some(
      (r) => r.behaviorKind === kind && typeof r.targetColor === 'string',
    );
  }

  /** 활성 룰(라운드)에서 생성기 파라미터를 도출해 세트를 생성. */
  private makePlan(): SetPlan {
    return generateSet({
      rows: this.rows,
      cols: this.cols,
      // 안전칸 = floor(총칸/5), 최소 1 — 4×1=1, 4×4=3, 5×5=5 (확장 룰 설계 공식).
      passableCount: Math.max(1, Math.floor((this.cols * this.rows) / 5)),
      active: {
        move: this.engine.isActive(2),
        // 색 행동은 종류(behaviorKind) 기준 — 진행(동적) 색 룰도 자동 반영.
        // 반대 방향은 15라운드부터 진행 룰로 추가될 수 있다.
        opposite: this.hasColoredKind('opposite'),
        stop: this.hasColoredKind('stop'),
        passable: this.hasColoredKind('pass'),
        expand: this.engine.isActive(5),
      },
    });
  }

  /**
   * 생성기 결과를 벽에 적용 — 행동을 기존 색/화살표/확장마커로 매핑.
   *   move: num1 그대로(색없음)·num3 정지(룰3색)·num4 통과(룰4색) + 화살표. num2(반대)=비활성.
   *   expand(룰5): 확장 마커(먹는 방향 분면 검정). eaten: 흡수됨 — 제자리 흰 벽(표시 없음).
   * setgen 의 effShift 가 엔진 effective 와 일치하므로 쉬프트 시 겹침0 이 그대로 성립.
   */
  private applyPlan(wall: Wall, plan: SetPlan): void {
    for (const w of plan.walls) {
      const block = wall.blocks.find((b) => b.cell === w.cell);
      if (!block) continue;
      if (w.kind === 'move') {
        const color = this.colorForNum(w.num);
        if (color) wall.setColor(block, color);
        if (isDir(w.arrow)) wall.showArrow(block, w.arrow);
      } else if (w.kind === 'expand') {
        wall.showExpansion(block, w.dirs);
      }
      // 'eaten' — 표시 없음(제자리 유지, 화살표 0 → 쉬프트 안 함).
    }
  }

  /**
   * 행동 num → 색. num1=색 없음. num3(정지)/num4(통과)/num2(반대)는 그 행동
   * 종류의 활성 색 룰 중 하나를 무작위 선택 — 같은 행동의 색이 여러 개(진행
   * 동적 룰)면 세트마다 섞여 나온다.
   */
  private colorForNum(num: Num): string | null {
    const kind = num === 3 ? 'stop' : num === 4 ? 'pass' : num === 2 ? 'opposite' : null;
    if (!kind) return null;
    const colors = this.engine.activeRules
      .filter((r) => r.behaviorKind === kind && typeof r.targetColor === 'string')
      .map((r) => r.targetColor as string);
    if (colors.length === 0) return null;
    return colors[Math.floor(Math.random() * colors.length)] as string;
  }
}

/**
 * plan → blocked[] (스폰 시점 모습). gap 과 eaten(먹힌 칸) 둘 다 빈 칸으로 —
 * 먹힌 칸은 구멍처럼 보이다가 쉬프트 트리거에서 확장벽이 자라며 막힌다(함정).
 */
function blockedFromPlan(plan: SetPlan): boolean[] {
  const blocked = new Array<boolean>(plan.cellCount).fill(true);
  for (const g of plan.gaps) blocked[g] = false;
  for (const w of plan.walls) if (w.kind === 'eaten') blocked[w.cell] = false;
  return blocked;
}

/** plan 시그니처 — 연속 동일 회피용 (칸별 행동, gap='g'). */
function planSig(plan: SetPlan): string {
  const byCell = new Map<number, string>();
  for (const w of plan.walls) {
    byCell.set(
      w.cell,
      w.kind === 'move'
        ? `m${w.num}:${w.arrow.x},${w.arrow.y}`
        : w.kind === 'expand'
          ? `x${w.dirs.map((d) => `${d.x},${d.y}`).join('|')}`
          : 'e',
    );
  }
  let s = '';
  for (let c = 0; c < plan.cellCount; c++) s += byCell.get(c) ?? 'g';
  return s;
}
