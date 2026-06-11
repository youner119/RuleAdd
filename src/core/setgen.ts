import { COLS, DIR_NONE, DIRS4, type Dir, dirEq, negDir, stepCell, stepCellBounded } from './lane';

/**
 * setgen — 세트 생성기. 활성 룰에 따라 칸별 행동을 충돌0·정답보장으로 배치한다.
 *
 * 기존의 "무작위 색칠 + 화살표 rejection sampling"(Spawner.decorate)을 대체하는
 * 통합 생성기. 행동은 내부적으로 num/확장으로 표현하고, 색/화살표/마커 매핑은 Spawner:
 *   num1 그대로(룰2) · num3 정지(룰3) · num4 통과(룰4, 그대로 이동) · num2 반대=비활성
 *   확장(룰5) = 인접 "벽"을 잡아먹음(eaten). 잡아먹는 벽·먹힌 벽 모두 제자리 유지.
 *
 * 4×1(rows=1)·4×4(rows=4) 공통. 방향은 2D(Dir)이고 이동/확장의 경계 처리는
 * warp 옵션이 정한다 — 기본 false(경계 밖 방향은 선택하지 않음, 캐주얼 지향),
 * true 면 wrap(토러스). warp 는 향후 "warp 룰"(tag 'warp') 활성화로 켜질 수 있게
 * 옵션으로 뚫려 있다. effShift 가 RuleEngine 의 effective 와 일치하므로
 * 생성기가 보장한 겹침0 이 게임 실제 쉬프트에서도 그대로 성립(세트별 warp 고정).
 */

export type Num = 1 | 2 | 3 | 4;

export type WallPlan =
  | { cell: number; kind: 'move'; num: Num; arrow: Dir }
  | { cell: number; kind: 'expand'; dirs: Dir[] } // 잡아먹는 방향들(4방위)
  | { cell: number; kind: 'eaten' }; // 다른 확장벽에 흡수됨(제자리 유지, 행동 없음)

export interface SetPlan {
  cellCount: number;
  gaps: number[]; // 빈 칸(구멍)
  walls: WallPlan[]; // 벽 칸 (통과벽·확장벽·먹힌벽 포함)
}

/** 라운드(누적 룰)로부터 도출되는 활성 행동. 색 행동(stop/passable/opposite)은
 *  해당 종류의 색 룰(정적+진행 동적)이 하나라도 색을 배정받았을 때 켜진다. */
export interface ActiveBehaviors {
  move: boolean; // 룰2 — 화살표 이동
  opposite: boolean; // 반대 방향 — 진행 색 룰(난이도별 스케줄)로 활성화될 수 있다
  stop: boolean; // 정지(룰3 + 진행 동적)
  passable: boolean; // 통과(룰4 + 진행 동적)
  expand: boolean; // 룰5 — 확장(잡아먹기)
}

export interface SetGenOptions {
  rows: number; // 세로 줄 수(1=4×1, 4=4×4).
  cols?: number; // 가로 칸 수(기본 COLS=4). 확장 룰로 4→5… 로 늘어난다.
  /** 안전칸(구멍 + 통과벽) 수. 기본 1 (= v1 gap 1칸). */
  passableCount?: number;
  /** 경계 wrap(토러스) 허용 — 기본 false(warp 없음). 향후 warp 룰 활성 시 true. */
  warp?: boolean;
  active: ActiveBehaviors;
}

/** 다방향 확장: 첫 방향 외 추가 방향을 이 확률로 더 먹음. */
const MULTI_EXPAND_PROB = 0.4;
/**
 * 각 안전칸이 통과벽(룰4 통과색)이 될 독립 확률. 나머지 안전칸은 빈 구멍.
 * 균등 랜덤(안전칸당 ≈50%)이면 통과색이 너무 자주 나와 쉬워져 25%로 낮춤.
 */
const PASSABLE_WALL_PROB = 0.25;
const MAX_TRIES = 80;

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

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** num + 화살표 → 실제 이동 방향 (엔진 effective 와 일치). */
export function effShift(num: Num, arrow: Dir): Dir {
  if (num === 3) return DIR_NONE; // 정지
  if (num === 2) return negDir(arrow); // 반대(비활성)
  return arrow; // 1, 4 = 그대로
}

/** 실제 이동 방향 e 를 만드는 (num, 화살표) 표시 후보 — 활성 룰만. cardinals=쓸 수 있는 방향. */
function displayReps(
  e: Dir,
  opposite: boolean,
  stop: boolean,
  cardinals: readonly Dir[],
): { num: Num; arrow: Dir }[] {
  const reps: { num: Num; arrow: Dir }[] = [{ num: 1, arrow: e }];
  if (opposite) reps.push({ num: 2, arrow: negDir(e) });
  if (stop && dirEq(e, DIR_NONE)) {
    // 정지 블록은 어떤 화살표(또는 없음)로 표시해도 안 움직인다.
    reps.push({ num: 3, arrow: DIR_NONE });
    for (const d of cardinals) reps.push({ num: 3, arrow: d });
  }
  return reps;
}

/**
 * 세트 생성. 안전칸을 구멍/통과벽으로 나누고, 나머지 벽에 이동/확장을 배치한다.
 *  - 이동-방향과 확장-방향을 동일 풀에서 선택. 자기 칸 정지가 항상 폴백.
 *  - 막히면 재시도, 최후엔 전부정지 → 반드시 겹침0 해를 얻는다.
 *  - 안전칸 = 구멍 + 통과벽 = passableCount → 한 스텝 뒤에도 안전칸 보장(정답).
 */
export function generateSet(opts: SetGenOptions): SetPlan {
  const rows = opts.rows;
  const cols = opts.cols ?? COLS;
  const N = cols * rows;
  const passableCount = Math.max(1, Math.min(opts.passableCount ?? 1, N - 1));
  const { passable } = opts.active;

  // 안전칸 → 빈 구멍 vs 통과벽(num4, 룰4 색) 분배.
  // 통과 룰 활성 시 각 안전칸을 독립 확률(PASSABLE_WALL_PROB)로 통과벽으로 — 통과색
  // 빈도를 낮춰(균등 랜덤 ≈50% → 25%) 난이도 유지. 나머지는 빈 구멍.
  const order = shuffle([...Array(N).keys()]);
  const safe = order.slice(0, passableCount);
  const passableWalls = new Set<number>();
  const gaps: number[] = [];
  for (const c of safe) {
    if (passable && Math.random() < PASSABLE_WALL_PROB) passableWalls.add(c);
    else gaps.push(c);
  }
  const gapSet = new Set(gaps);
  const wallCells = [...Array(N).keys()].filter((c) => !gapSet.has(c));

  for (let t = 0; t < MAX_TRIES; t++) {
    const walls = assignOnce(rows, cols, opts.warp ?? false, wallCells, passableWalls, opts.active);
    if (walls) return { cellCount: N, gaps, walls };
  }
  // 폴백: 전부 제자리 정지 (서로 다른 칸 → 충돌 없음).
  const walls: WallPlan[] = wallCells.map((cell) => ({
    cell,
    kind: 'move',
    num: passableWalls.has(cell) ? 4 : 1,
    arrow: DIR_NONE,
  }));
  return { cellCount: N, gaps, walls };
}

/** 단일 풀 그리디 1패스. 막히면 null(상위에서 재시도). */
function assignOnce(
  rows: number,
  cols: number,
  warp: boolean,
  wallCells: number[],
  passableWalls: Set<number>,
  active: ActiveBehaviors,
): WallPlan[] | null {
  const { move, opposite, stop, expand } = active;
  // 경계 처리 — warp 면 wrap(토러스), 아니면 경계 밖 -1(해당 방향 미선택).
  const step = (cell: number, d: Dir): number =>
    warp ? stepCell(cell, d, rows, cols) : stepCellBounded(cell, d, rows, cols);
  const occupied = new Set<number>();
  const result = new Map<number, WallPlan>(); // cell → plan
  const isUnactedWall = (cell: number) => wallCells.includes(cell) && !result.has(cell);
  const isEatable = (cell: number) => isUnactedWall(cell) && !passableWalls.has(cell);
  // rows=1(4×1) 이면 세로 이동은 wrap 돼 제자리라 무의미 → 가로만 사용.
  const cardinals: Dir[] = rows > 1 ? [...DIRS4] : DIRS4.filter((d) => d.y === 0);
  const moveDirs: Dir[] = move ? [DIR_NONE, ...cardinals] : [DIR_NONE];

  for (const cell of shuffle(wallCells)) {
    if (result.has(cell)) continue; // 이미 먹힘 등
    const isPW = passableWalls.has(cell);
    const selfFree = !occupied.has(cell);

    const validMove = moveDirs.filter((e) => {
      const target = step(cell, e);
      return target >= 0 && !occupied.has(target); // warp 아니면 경계 밖 이동은 생성하지 않음
    });
    const validExp =
      expand && !isPW && selfFree
        ? cardinals.filter((d) => {
            const nb = step(cell, d);
            return nb >= 0 && !occupied.has(nb) && isEatable(nb);
          })
        : [];

    // 카테고리(정지/이동/확장) 단위로 먼저 균등 선택 → 방향 수가 많아도(4×4)
    // "정지" 비중이 줄지 않는다: 정지50·이동50, 확장 가능 시 각 33.
    const stayOk = validMove.some((e) => dirEq(e, DIR_NONE));
    const moveOpts = validMove.filter((e) => !dirEq(e, DIR_NONE));
    const cats: ('stay' | 'move' | 'expand')[] = [];
    if (stayOk) cats.push('stay');
    if (moveOpts.length > 0) cats.push('move');
    if (validExp.length > 0) cats.push('expand');
    if (cats.length === 0) return null; // 막힘 → 재시도

    const cat = randPick(cats);
    const pick: { t: 'm'; e: Dir } | { t: 'x'; d: Dir } =
      cat === 'expand'
        ? { t: 'x', d: randPick(validExp) }
        : cat === 'move'
          ? { t: 'm', e: randPick(moveOpts) }
          : { t: 'm', e: DIR_NONE };

    if (pick.t === 'm') {
      occupied.add(step(cell, pick.e)); // validMove 에서 검증된 방향 — 항상 ≥0
      if (isPW) result.set(cell, { cell, kind: 'move', num: 4, arrow: pick.e });
      else {
        const rep = randPick(displayReps(pick.e, opposite, stop, cardinals));
        result.set(cell, { cell, kind: 'move', num: rep.num, arrow: rep.arrow });
      }
    } else {
      const dirs = [pick.d];
      for (const d of validExp) {
        if (dirEq(d, pick.d)) continue;
        const nb = step(cell, d);
        if (!occupied.has(nb) && isEatable(nb) && Math.random() < MULTI_EXPAND_PROB) dirs.push(d);
      }
      occupied.add(cell);
      result.set(cell, { cell, kind: 'expand', dirs });
      for (const d of dirs) {
        const nb = step(cell, d); // validExp 에서 검증된 방향 — 항상 ≥0
        occupied.add(nb);
        result.set(nb, { cell: nb, kind: 'eaten' });
      }
    }
  }
  return wallCells.map((c) => result.get(c) as WallPlan);
}
