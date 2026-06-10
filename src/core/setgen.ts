import { wrapCell } from './pattern';

/**
 * setgen — 세트 생성기. 활성 룰에 따라 칸별 행동을 충돌0·정답보장으로 배치한다.
 *
 * 기존의 "무작위 색칠 + 화살표 rejection sampling"(Spawner.decorate)을 대체하는
 * 통합 생성기. 행동은 내부적으로 num/확장으로 표현하고, 색/화살표/마커 매핑은 Spawner:
 *   num1 그대로(룰2) · num2 반대(룰3) · num3 정지(룰4) · num4 통과(룰5, 그대로 이동)
 *   확장(룰6) = 인접 "벽"을 잡아먹음(eaten). 잡아먹는 벽·먹힌 벽 모두 제자리 유지.
 *
 * effShift(num, 화살표)는 RuleEngine 의 effective 와 정확히 일치 → 생성기가 보장한
 * 겹침0 이 게임 실제 쉬프트에서도 그대로 성립. 확장/먹힘 벽은 화살표 없음 → 제자리.
 *
 * 4×1(cellCount=4) 기준이며 cellCount 로 일반화(4×4 확장 대비).
 */

export type Num = 1 | 2 | 3 | 4;

export type WallPlan =
  | { cell: number; kind: 'move'; num: Num; arrowDir: number }
  | { cell: number; kind: 'expand'; dirs: number[] } // 잡아먹는 방향들(-1/+1)
  | { cell: number; kind: 'eaten' }; // 다른 확장벽에 흡수됨(제자리 유지, 행동 없음)

export interface SetPlan {
  cellCount: number;
  gaps: number[]; // 빈 칸(구멍)
  walls: WallPlan[]; // 벽 칸 (통과벽·확장벽·먹힌벽 포함)
}

/** 라운드(누적 룰)로부터 도출되는 활성 행동. */
export interface ActiveBehaviors {
  move: boolean; // 룰2 — 화살표 이동
  opposite: boolean; // 룰3 — 반대 방향
  stop: boolean; // 룰4 — 정지
  passable: boolean; // 룰5 — 통과
  expand: boolean; // 룰6 — 확장(잡아먹기)
}

export interface SetGenOptions {
  cellCount: number;
  /** 안전칸(구멍 + 통과벽) 수. 기본 1 (= v1 gap 1칸). */
  passableCount?: number;
  active: ActiveBehaviors;
}

/** 다방향 확장: 첫 방향 외 추가 방향을 이 확률로 더 먹음(1D라 드묾). */
const MULTI_EXPAND_PROB = 0.5;
const MAX_TRIES = 64;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/** num + 화살표 → 실제 이동 방향 (엔진 effective 와 일치). */
export function effShift(num: Num, arrowDir: number): number {
  if (num === 3) return 0; // 정지
  if (num === 2) return -arrowDir; // 반대
  return arrowDir; // 1, 4 = 그대로
}

/** 실제 이동 방향 e 를 만드는 (num, 화살표) 표시 후보 — 활성 룰만. */
function displayReps(e: number, opposite: boolean, stop: boolean): { num: Num; arrowDir: number }[] {
  const reps: { num: Num; arrowDir: number }[] = [{ num: 1, arrowDir: e }];
  if (opposite) reps.push({ num: 2, arrowDir: -e });
  if (stop && e === 0) reps.push({ num: 3, arrowDir: -1 }, { num: 3, arrowDir: 1 }, { num: 3, arrowDir: 0 });
  return reps;
}

/**
 * 세트 생성. 안전칸을 구멍/통과벽으로 나누고, 나머지 벽에 이동/확장을 배치한다.
 *  - 이동-방향과 확장-방향을 동일 가중치 풀에서 선택(동일시). 자기 칸 정지가 항상 폴백.
 *  - 막히면 재시도, 최후엔 전부정지 → 반드시 겹침0 해를 얻는다.
 *  - 안전칸 = 구멍 + 통과벽 = passableCount → 한 스텝 뒤에도 안전칸 보장(정답).
 */
export function generateSet(opts: SetGenOptions): SetPlan {
  const N = opts.cellCount;
  const passableCount = Math.max(1, Math.min(opts.passableCount ?? 1, N - 1));
  const { passable } = opts.active;

  // 안전칸 → 구멍(gap) vs 통과벽(num4) 분배 (통과 룰 활성 시에만 통과벽 가능).
  const order = shuffle([...Array(N).keys()]);
  const safe = order.slice(0, passableCount);
  const maxPW = passable ? safe.length : 0;
  const pwCount = maxPW > 0 ? Math.floor(Math.random() * (maxPW + 1)) : 0;
  const passableWalls = new Set(safe.slice(0, pwCount));
  const gaps = safe.slice(pwCount);
  const gapSet = new Set(gaps);
  const wallCells = [...Array(N).keys()].filter((c) => !gapSet.has(c));

  for (let t = 0; t < MAX_TRIES; t++) {
    const walls = assignOnce(N, wallCells, passableWalls, opts.active);
    if (walls) return { cellCount: N, gaps, walls };
  }
  // 폴백: 전부 제자리 정지 (서로 다른 칸 → 충돌 없음).
  const walls: WallPlan[] = wallCells.map((cell) => ({
    cell,
    kind: 'move',
    num: passableWalls.has(cell) ? 4 : 1,
    arrowDir: 0,
  }));
  return { cellCount: N, gaps, walls };
}

/** 단일 풀 그리디 1패스. 막히면 null(상위에서 재시도). */
function assignOnce(
  N: number,
  wallCells: number[],
  passableWalls: Set<number>,
  active: ActiveBehaviors,
): WallPlan[] | null {
  const { move, opposite, stop, expand } = active;
  const occupied = new Set<number>();
  const result = new Map<number, WallPlan>(); // cell → plan
  const isUnactedWall = (cell: number) => wallCells.includes(cell) && !result.has(cell);
  const isEatable = (cell: number) => isUnactedWall(cell) && !passableWalls.has(cell);
  const effDirs = move ? [-1, 0, 1] : [0];

  for (const cell of shuffle(wallCells)) {
    if (result.has(cell)) continue; // 이미 먹힘 등
    const isPW = passableWalls.has(cell);
    const selfFree = !occupied.has(cell);

    const validMove = effDirs.filter((e) => !occupied.has(wrapCell(cell + e, N)));
    const validExp =
      expand && !isPW && selfFree
        ? [-1, 1].filter((d) => {
            const nb = wrapCell(cell + d, N);
            return !occupied.has(nb) && isEatable(nb);
          })
        : [];

    const pool: ({ t: 'm'; e: number } | { t: 'x'; d: number })[] = [
      ...validMove.map((e) => ({ t: 'm' as const, e })),
      ...validExp.map((d) => ({ t: 'x' as const, d })),
    ];
    if (pool.length === 0) return null; // 막힘 → 재시도
    const pick = pool[Math.floor(Math.random() * pool.length)] as
      | { t: 'm'; e: number }
      | { t: 'x'; d: number };

    if (pick.t === 'm') {
      occupied.add(wrapCell(cell + pick.e, N));
      if (isPW) result.set(cell, { cell, kind: 'move', num: 4, arrowDir: pick.e });
      else {
        const reps = displayReps(pick.e, opposite, stop);
        const rep = reps[Math.floor(Math.random() * reps.length)] as { num: Num; arrowDir: number };
        result.set(cell, { cell, kind: 'move', num: rep.num, arrowDir: rep.arrowDir });
      }
    } else {
      const dirs = [pick.d];
      for (const d of validExp) {
        if (d === pick.d) continue;
        const nb = wrapCell(cell + d, N);
        if (!occupied.has(nb) && isEatable(nb) && Math.random() < MULTI_EXPAND_PROB) dirs.push(d);
      }
      occupied.add(cell);
      result.set(cell, { cell, kind: 'expand', dirs });
      for (const d of dirs) {
        const nb = wrapCell(cell + d, N);
        occupied.add(nb);
        result.set(nb, { cell: nb, kind: 'eaten' });
      }
    }
  }
  return wallCells.map((c) => result.get(c) as WallPlan);
}
