// 다양성 진단: 하나의 고정 격자에 대해
//  (A) 전수탐색으로 유효 해 전체를 열거 (ground truth)
//  (B) 무작위+백트래킹 생성기를 N회 돌려 커버리지·균일성·방향분포 측정
import { SIZE, DIRS, dest, type Dir, type Cell } from "./core.ts";

const N = Number(process.argv[2] ?? 1_000_000);

// 고정 격자: 구멍 3칸 = index {1, 10, 12} (나머지 13칸 벽)
const HOLES = new Set([1, 10, 12]);
const WALLS: [number, number][] = [];
for (let r = 0; r < SIZE; r++)
  for (let c = 0; c < SIZE; c++)
    if (!HOLES.has(r * SIZE + c)) WALLS.push([r, c]);

const CH: Record<Dir, string> = { up: "u", down: "d", left: "l", right: "r", stop: "s" };

// ---- (A) 전수탐색: 모든 유효 해를 key 로 열거 ----
const allSolutions = new Set<string>();
const dirCountBrute: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
{
  const occupied = new Set<number>();
  const cur: Dir[] = [];
  const rec = (i: number) => {
    if (i === WALLS.length) {
      allSolutions.add(cur.map((d) => CH[d]).join(""));
      for (const d of cur) dirCountBrute[d]++;
      return;
    }
    const [r, c] = WALLS[i];
    for (const dir of DIRS) {
      const [dr, dc] = dest(r, c, dir);
      const key = dr * SIZE + dc;
      if (occupied.has(key)) continue;
      occupied.add(key);
      cur.push(dir);
      rec(i + 1);
      cur.pop();
      occupied.delete(key);
    }
  };
  rec(0);
}
const T = allSolutions.size;

// ---- (B) 무작위+백트래킹 N회 ----
const shuffle = <T>(a: T[]): T[] => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
// 고정 격자 위에서 무작위 해 1개를 뽑아 key 반환.
// 벽 처리 순서도 매번 셔플 (단, key 는 정준 인덱스 순서로 기록).
const SHUFFLE_WALL_ORDER = process.env.WALLSHUF !== "0";
function randomSolutionKey(): string {
  const occupied = new Set<number>();
  const out: Dir[] = new Array(WALLS.length);
  const order = SHUFFLE_WALL_ORDER
    ? shuffle(WALLS.map((_, i) => i))
    : WALLS.map((_, i) => i);
  const solve = (oi: number): boolean => {
    if (oi === order.length) return true;
    const wi = order[oi];
    const [r, c] = WALLS[wi];
    for (const dir of shuffle(DIRS)) {
      const [dr, dc] = dest(r, c, dir);
      const k = dr * SIZE + dc;
      if (occupied.has(k)) continue;
      occupied.add(k);
      out[wi] = dir;
      if (solve(oi + 1)) return true;
      occupied.delete(k);
    }
    return false;
  };
  solve(0);
  return out.map((d) => CH[d]).join("");
}

const freq = new Map<string, number>();
const dirCountRand: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0, stop: 0 };
const INV: Record<string, Dir> = { u: "up", d: "down", l: "left", r: "right", s: "stop" };

const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const key = randomSolutionKey();
  freq.set(key, (freq.get(key) ?? 0) + 1);
  for (const ch of key) dirCountRand[INV[ch]]++;
}
const elapsed = performance.now() - t0;

// ---- 분석 ----
const hit = freq.size;
const counts = [...freq.values()];
const mean = N / T;                       // 균일 가정 기대 빈도
const observedMean = N / hit;
let min = Infinity, max = -Infinity, sumSq = 0;
for (const v of counts) { if (v < min) min = v; if (v > max) max = v; }
// 빈도 표준편차(미관측 해는 0)
let sum = 0;
for (const v of counts) sum += v;
let varSum = 0;
for (const v of counts) varSum += (v - mean) ** 2;
varSum += (T - hit) * (0 - mean) ** 2;    // 한 번도 안 나온 해들
const cv = Math.sqrt(varSum / T) / mean;  // 변동계수 (0=완전균일)

console.log(`=== 고정 격자 (구멍 index {1,10,12}, 벽 13칸) ===\n`);
console.log(`[전수탐색] 전체 유효 해: ${T.toLocaleString()} 개`);
console.log(`[샘플링]   ${N.toLocaleString()}회, ${(elapsed / 1000).toFixed(2)}s\n`);

console.log(`--- 커버리지 ---`);
console.log(`고유 해 발견: ${hit.toLocaleString()} / ${T.toLocaleString()}  (${(100 * hit / T).toFixed(2)}%)`);
console.log(`미발견 해: ${(T - hit).toLocaleString()}\n`);

console.log(`--- 균일성 ---`);
console.log(`균일 기대 빈도: ${mean.toFixed(1)} / 해`);
console.log(`실제 최소~최대: ${min.toLocaleString()} ~ ${max.toLocaleString()}`);
console.log(`최대/최소 비: ${(max / min).toFixed(1)}배`);
console.log(`변동계수(CV): ${cv.toFixed(3)}  (0=완전균일, 클수록 쏠림)\n`);

console.log(`--- 방향 분포 (샘플링 vs 전수탐색=이상적 균일) ---`);
const totalRand = N * WALLS.length;
const totalBrute = T * WALLS.length;
for (const d of DIRS) {
  const pr = (100 * dirCountRand[d] / totalRand).toFixed(2);
  const pb = (100 * dirCountBrute[d] / totalBrute).toFixed(2);
  console.log(`  ${d.padEnd(5)}: 샘플 ${pr}%  |  전수 ${pb}%`);
}
