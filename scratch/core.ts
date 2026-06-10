// 4×4 토러스 격자 코어: 구멍 배치 + 충돌 없는 (화살표 + 숫자) 배치.
//
// 화살표: 상/하/좌/우/정지 (표시).
// 숫자  : 1=그대로, 2=화살표 반대, 3=강제 정지. → 화살표의 "실제 효과"를 바꿈.
// 실제 이동 = effectiveDir(화살표, 숫자). 충돌 = 두 벽의 "실제 도착 칸"이 겹침.
// swap·chain 허용. 가장자리는 wrap(토러스).
export const SIZE = 4;

export type Dir = "up" | "down" | "left" | "right" | "stop";
// 1=그대로, 2=반대, 3=강제정지, 4=그대로+플레이어 통과가능
export type Num = 1 | 2 | 3 | 4;
// 벽은 "이동"(dir+num) / "확장=잡아먹기"(exp) / "먹힘"(eaten) 중 하나.
//   exp 가 있으면 확장 벽 — 숫자 없음, 자기 칸 유지하며 각 방향 인접 "벽"을 삼킴.
//   eaten 이면 다른 확장벽에 흡수됨 — 독립 행동/계산 없음(footprint 없음). 칸은 solid 유지.
export type Cell = { wall: boolean; dir?: Dir; num?: Num; exp?: Dir[]; eaten?: boolean };

export const DIRS: Dir[] = ["up", "down", "left", "right", "stop"];
// 일반 벽에 부여되는 이동 숫자(4 제외 — 4는 안전칸 분배에서만 생성)
export const NUMS: Num[] = [1, 2, 3];

// 다방향 확장 추가 동전: 확장이 선택된 뒤, 다른 유효 확장 방향을 각각 이 확률로 추가.
// (1차 선택은 이동/확장 동일 가중치 풀에서 — assignArrows 참고)
export const EXPAND_PROB = 0.2;

// 확장 가능 방향(정지 제외) + 비어있지 않은 15개 부분집합(다방향 동시 확장)
export const EXP_DIRS: Dir[] = ["up", "down", "left", "right"];
export const EXP_SUBSETS: Dir[][] = (() => {
  const subs: Dir[][] = [];
  for (let m = 1; m < 1 << EXP_DIRS.length; m++) {
    const s: Dir[] = [];
    EXP_DIRS.forEach((d, i) => { if (m & (1 << i)) s.push(d); });
    subs.push(s);
  }
  return subs;
})();

// 플레이어가 통과 가능한 칸 = 구멍 또는 4번 벽 (확장 벽은 일반 벽 → 통과 불가)
export const isPassable = (cell: Cell): boolean => !cell.wall || cell.num === 4;

export const GLYPH: Record<Dir, string> = {
  up: "↑", down: "↓", left: "←", right: "→", stop: "●",
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down", down: "up", left: "right", right: "left", stop: "stop",
};

// 화살표 + 숫자 → 실제 이동 방향
export function effectiveDir(dir: Dir, num: Num): Dir {
  if (num === 3) return "stop";        // 강제 정지
  if (num === 2) return OPPOSITE[dir]; // 반대
  return dir;                          // 1, 4 = 그대로
}

// 한 벽의 표시 상태 후보 = 화살표 5 × 숫자 3 = 15가지
export const COMBOS: { dir: Dir; num: Num }[] = DIRS.flatMap((dir) =>
  NUMS.map((num) => ({ dir, num }))
);

// effective 방향 → 그 방향을 만드는 표시 조합들 (aliasing).
//   stop ← (stop,1),(stop,2),(*,3)×5 = 7개 / 그 외 ← 2개씩
export const REPS: Record<Dir, { dir: Dir; num: Num }[]> = {
  up: [], down: [], left: [], right: [], stop: [],
};
for (const combo of COMBOS) REPS[effectiveDir(combo.dir, combo.num)].push(combo);

export const shuffle = <T>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 안전칸(플레이어 통과 가능) safe개를 무작위로 잡고, 그 안에서
// 구멍(빈 칸) vs 4번 벽(움직이는 위장 벽)을 매번 랜덤 분배(구멍 수 0~safe 균일).
export function makeGrid(safe = 3): Cell[][] {
  const idx = shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i));
  const safeCells = idx.slice(0, safe);
  const holeCount = Math.floor(Math.random() * (safe + 1)); // 0..safe 균일
  const holeSet = new Set(safeCells.slice(0, holeCount));
  const fourSet = new Set(safeCells.slice(holeCount));
  const grid: Cell[][] = [];
  for (let r = 0; r < SIZE; r++) {
    grid.push(
      Array.from({ length: SIZE }, (_, c) => {
        const i = r * SIZE + c;
        if (holeSet.has(i)) return { wall: false };       // 구멍
        if (fourSet.has(i)) return { wall: true, num: 4 }; // 4번 벽 (이동방향은 assignArrows에서)
        return { wall: true };                             // 일반 벽
      })
    );
  }
  return grid;
}

// 방향대로 한 스텝 이동한 도착 칸 (wrap)
export function dest(r: number, c: number, dir: Dir): [number, number] {
  switch (dir) {
    case "up": return [(r - 1 + SIZE) % SIZE, c];
    case "down": return [(r + 1) % SIZE, c];
    case "left": return [r, (c - 1 + SIZE) % SIZE];
    case "right": return [r, (c + 1) % SIZE];
    case "stop": return [r, c];
  }
}

// 한 벽이 한 스텝 뒤 점유하는 칸 인덱스 집합 (footprint).
//   먹힘 벽 → [] (확장벽 footprint 에 포함됨, 중복 계산 방지)
//   확장 벽 → {자기 칸} ∪ {삼킨 인접 벽 칸들}
//   이동 벽 → {도착 칸} 1칸
export function footprint(r: number, c: number, cell: Cell): number[] {
  if (cell.eaten) return [];
  if (cell.exp) {
    const cells = [r * SIZE + c];
    for (const d of cell.exp) {
      const [dr, dc] = dest(r, c, d);
      cells.push(dr * SIZE + dc);
    }
    return cells;
  }
  const [dr, dc] = dest(r, c, effectiveDir(cell.dir!, cell.num!));
  return [dr * SIZE + dc];
}

const acted = (n: Cell) => n.dir !== undefined || !!n.exp || !!n.eaten;

// 행동 상태 초기화(벽 종류·구멍은 유지). 재시도/폴백용.
function resetActions(grid: Cell[][]): void {
  for (const row of grid)
    for (const cell of row) {
      if (!cell.wall) continue;
      cell.dir = undefined;
      cell.exp = undefined;
      cell.eaten = false;
      if (cell.num !== 4) cell.num = undefined;
    }
}

// 단일 풀 그리디 1패스 — 확장과 이동을 동일 가중치로 취급.
//   각 벽: 유효 액션 풀 = {이동 ↑↓←→● (effective 5)} ∪ {확장(잡아먹기) ↑↓←→}
//          → 동일 가중치로 1개 선택. 확장이면 다른 방향을 EXPAND_PROB 독립 동전으로 추가(다방향).
//   이동은 빈 칸으로 자유롭게(침범 허용) → 동등성 유지. 막히면(빈 풀) false 반환 → 상위에서 재시도.
//   구멍/4벽(통과가능)은 잡아먹지 않음. 연쇄 X(행동한 벽은 못 먹힘).
function assignOnce(grid: Cell[][]): boolean {
  const walls: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (grid[r][c].wall) walls.push([r, c]);

  const occupied = new Set<number>();
  const isEatable = (r: number, c: number) =>
    grid[r][c].wall && grid[r][c].num !== 4 && !acted(grid[r][c]); // 미행동 일반 벽

  for (const wi of shuffle(walls.map((_, i) => i))) {
    const [r, c] = walls[wi];
    const cell = grid[r][c];
    if (acted(cell)) continue; // 이미 먹힘 등 (연쇄 X)
    const isFour = cell.num === 4;
    const self = r * SIZE + c;

    const selfFree = !occupied.has(self); // 자기 칸이 이미 침범됐으면 정지/확장 불가
    const validMove = DIRS.filter((e) => {
      const [dr, dc] = dest(r, c, e);
      return !occupied.has(dr * SIZE + dc); // 빈 칸이면 이동 가능 (침범 허용)
    });
    // 확장은 자기 칸을 유지해야 하므로 selfFree 필요. 4벽은 확장 X.
    const validExp = (isFour || !selfFree) ? [] : EXP_DIRS.filter((d) => {
      const [dr, dc] = dest(r, c, d);
      return !occupied.has(dr * SIZE + dc) && isEatable(dr, dc);
    });

    const pool = [
      ...validMove.map((e) => ({ kind: "move" as const, e })),
      ...validExp.map((d) => ({ kind: "exp" as const, d })),
    ];
    if (!pool.length) return false; // 막힘 → 재시도
    const pick = pool[Math.floor(Math.random() * pool.length)];

    if (pick.kind === "move") {
      const [dr, dc] = dest(r, c, pick.e);
      occupied.add(dr * SIZE + dc);
      if (isFour) cell.dir = pick.e;
      else {
        const rep = REPS[pick.e][Math.floor(Math.random() * REPS[pick.e].length)];
        cell.dir = rep.dir; cell.num = rep.num;
      }
    } else {
      const E = [pick.d];
      for (const d of validExp) {
        if (d === pick.d) continue;
        const [dr, dc] = dest(r, c, d);
        if (occupied.has(dr * SIZE + dc) || !isEatable(dr, dc)) continue;
        if (Math.random() < EXPAND_PROB) E.push(d);
      }
      cell.exp = E;
      occupied.add(self);
      for (const d of E) {
        const [dr, dc] = dest(r, c, d);
        grid[dr][dc].eaten = true;
        occupied.add(dr * SIZE + dc);
      }
    }
  }
  return true;
}

// 그리디 재시도 + 최후 전부정지 폴백 (항상 유효 배치 보장).
export function assignArrows(grid: Cell[][], maxTries = 64): boolean {
  for (let t = 0; t < maxTries; t++) {
    resetActions(grid);
    if (assignOnce(grid)) return true;
  }
  // 폴백: 전부 자기 칸 정지 (서로 다른 칸 → 항상 충돌 없음)
  resetActions(grid);
  for (const row of grid)
    for (const cell of row) {
      if (!cell.wall) continue;
      if (cell.num === 4) cell.dir = "stop";
      else { cell.dir = "stop"; cell.num = 3; } // ●3 = 강제 정지
    }
  return true;
}

const EXP_GLYPH: Record<Dir, string> = {
  up: "↑", down: "↓", left: "←", right: "→", stop: "",
};

// 표시: 구멍="□ ", 확장(먹는)벽="✦n", 먹힌 벽="▨ ", 이동 벽=화살표+숫자(예 "↑2")
export function render(grid: Cell[][]): string {
  return grid
    .map(
      (row) =>
        "  " +
        row
          .map((cell) =>
            !cell.wall ? "□ "
              : cell.eaten ? "▨ "
              : cell.exp ? `✦${cell.exp.length}`
              : `${GLYPH[cell.dir!]}${cell.num}`
          )
          .join("  ")
    )
    .join("\n");
}

// 확장(잡아먹기) 벽들을 사람이 읽는 형태로 (legend 용)
export function describeExpansions(grid: Cell[][]): string[] {
  const out: string[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell.exp) out.push(`(${r},${c}) ✦ 삼킴 ${cell.exp.map((d) => EXP_GLYPH[d]).join("")}`);
    }
  return out;
}

// 한 스텝 뒤 footprint 적용 격자 (검증/시뮬레이션용). 충돌 시 같은 칸이 덮어써짐.
export function step(grid: Cell[][]): Cell[][] {
  const next: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ wall: false }))
  );
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (!cell.wall) continue;
      for (const k of footprint(r, c, cell)) {
        next[Math.floor(k / SIZE)][k % SIZE] = { wall: true };
      }
    }
  return next;
}
