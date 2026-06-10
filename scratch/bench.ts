// 생성기(구멍 배치 + 화살표 배치) N회 실행 시간 측정
import { makeGrid, assignArrows } from "./core.ts";

const RUNS = Number(process.argv[2] ?? 100);
let okCount = 0;

const t0 = performance.now();
for (let i = 0; i < RUNS; i++) {
  const grid = makeGrid();
  if (assignArrows(grid)) okCount++;
}
const t1 = performance.now();

const total = t1 - t0;
console.log(`${RUNS.toLocaleString()}회 실행`);
console.log(`총 시간: ${total.toFixed(1)} ms (${(total / 1000).toFixed(3)} s)`);
console.log(`1회 평균: ${(total / RUNS * 1000).toFixed(3)} µs`);
console.log(`성공: ${okCount}/${RUNS}`);
