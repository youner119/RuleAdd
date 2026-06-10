// 숫자 포함 다양성 진단 (고정 격자)
//  - 충돌은 effective(실제) 도착 칸으로만 결정 → effective 해 공간은 숫자 도입 전과 동일.
//  - 표시(display) 상태는 한 벽당 15가지(화살표5×숫자3)라 표시 해 공간은 폭증.
//  - effective dir 별 표시 표현 수(mult): stop=7, 그 외=2.
//      stop ← (stop,1),(stop,2), (*,3)×5 = 7
//      up   ← (up,1),(down,2) = 2  (좌우상하 동일)
import {
  SIZE, DIRS, dest, effectiveDir, makeGrid, assignArrows,
  type Dir, type Num, type Cell,
} from "./core.ts";

const N = Number(process.argv[2] ?? 100_000);

const MULT: Record<Dir, number> = { up: 2, down: 2, left: 2, right: 2, stop: 7 };

// 고정 격자: 구멍 index {1,10,12}
const HOLES = new Set([1, 10, 12]);
const WALLS: [number, number][] = [];
for (let r = 0; r < SIZE; r++)
  for (let c = 0; c < SIZE; c++)
    if (!HOLES.has(r * SIZE + c)) WALLS.push([r, c]);

function makeFixedGrid(): Cell[][] {
  const g: Cell[][] = [];
  for (let r = 0; r < SIZE; r++)
    g.push(Array.from({ length: SIZE }, (_, c) => ({ wall: !HOLES.has(r * SIZE + c) })));
  return g;
}

// ---- (A) 전수탐색: effective 해 공간 + 표시 해 공간 + 이상적 분포 ----
let T_eff = 0;       // effective 해 개수
let T_disp = 0;      // 표시 해 개수 = Σ Π mult
// effective-dir 분포 (effective-uniform: 각 effective 해 가중치 1)
const effUni: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
// effective-dir 분포 (display-uniform: effective 해를 W=Πmult 로 가중)
const effDisp: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
// 숫자 분포 (display-uniform 이상): num1=num2 (대칭), num3 은 stop 에서만
let dispNum1 = 0, dispNum3 = 0;
let uniTotalSlots = 0;   // = T_eff * 13
let dispTotalW = 0;      // = Σ W
{
  const occupied = new Set<number>();
  const cnt: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
  const rec = (i: number, W: number) => {
    if (i === WALLS.length) {
      T_eff++;
      T_disp += W;
      dispTotalW += W;
      uniTotalSlots += WALLS.length;
      for (const d of DIRS) {
        effUni[d] += cnt[d];
        effDisp[d] += W * cnt[d];
      }
      // 숫자: 각 벽은 num1·num2 표현이 정확히 1개씩 → Σ_w (1/mult)
      let invSum = 0, stopShare = 0;
      for (const d of DIRS) {
        invSum += cnt[d] / MULT[d];
        if (d === "stop") stopShare += cnt[d] * 5 / MULT.stop;
      }
      dispNum1 += W * invSum;     // num1 == num2
      dispNum3 += W * stopShare;
      return;
    }
    const [r, c] = WALLS[i];
    for (const e of DIRS) {
      const [dr, dc] = dest(r, c, e);
      const k = dr * SIZE + dc;
      if (occupied.has(k)) continue;
      occupied.add(k); cnt[e]++;
      rec(i + 1, W * MULT[e]);
      occupied.delete(k); cnt[e]--;
    }
  };
  rec(0, 1);
}

console.error(`[checkpoint] 전수탐색 완료: T_eff=${T_eff}, ${(performance.now()).toFixed(0)}ms`);

// ---- (B) 무작위 생성기 N회 ----
const CH: Record<Dir, string> = { up: "u", down: "d", left: "l", right: "r", stop: "s" };
const arrowCnt: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
const numCnt: Record<Num, number> = { 1: 0, 2: 0, 3: 0 };
const effCnt: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
const seen = new Set<string>();

const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const g = makeFixedGrid();
  assignArrows(g);
  let key = "";
  for (const [r, c] of WALLS) {
    const cell = g[r][c];
    const d = cell.dir!, n = cell.num!;
    arrowCnt[d]++; numCnt[n]++; effCnt[effectiveDir(d, n)]++;
    key += CH[d] + n;
  }
  seen.add(key);
}
const elapsed = performance.now() - t0;

// ---- 출력 ----
const pct = (x: number, tot: number) => (100 * x / tot).toFixed(2).padStart(6);
const slots = N * WALLS.length;

console.log(`=== 고정 격자 (구멍 {1,10,12}, 벽 13칸) ===\n`);
console.log(`[전수] effective 해: ${T_eff.toLocaleString()} 개`);
console.log(`[전수] display 해  : ${T_disp.toExponential(4)} 개  (숫자 aliasing 으로 폭증)`);
console.log(`[샘플] ${N.toLocaleString()}회, ${(elapsed / 1000).toFixed(2)}s\n`);

console.log(`--- 다양성(표시 기준) ---`);
console.log(`고유 표시 해: ${seen.size.toLocaleString()} / ${N.toLocaleString()}  (${pct(seen.size, N)}% 가 서로 다름)\n`);

console.log(`--- 화살표 분포 (이상적 균일 = 20%) ---`);
for (const d of DIRS) console.log(`  ${d.padEnd(5)}: ${pct(arrowCnt[d], slots)}%`);

console.log(`\n--- 숫자 분포 (샘플 vs display-uniform 이상) ---`);
const idealNum1 = dispNum1 / dispTotalW / WALLS.length * 100;
const idealNum3 = dispNum3 / dispTotalW / WALLS.length * 100;
console.log(`  1 : 샘플 ${pct(numCnt[1], slots)}%  |  이상 ${idealNum1.toFixed(2)}%`);
console.log(`  2 : 샘플 ${pct(numCnt[2], slots)}%  |  이상 ${idealNum1.toFixed(2)}%`);
console.log(`  3 : 샘플 ${pct(numCnt[3], slots)}%  |  이상 ${idealNum3.toFixed(2)}%`);

console.log(`\n--- effective(실제) 방향 분포 ---`);
console.log(`  방향   샘플      eff-uniform   disp-uniform`);
for (const d of DIRS) {
  const s = pct(effCnt[d], slots);
  const u = (100 * effUni[d] / uniTotalSlots).toFixed(2).padStart(6);
  const w = (100 * effDisp[d] / (dispTotalW * WALLS.length)).toFixed(2).padStart(6);
  console.log(`  ${d.padEnd(5)} ${s}%    ${u}%       ${w}%`);
}
