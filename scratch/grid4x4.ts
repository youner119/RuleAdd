// 데모: 구멍 배치 + (화살표+숫자) 생성 → 표시 + 실제 이동 결과 + 충돌 독립검증
import {
  SIZE, makeGrid, assignArrows, render, step, effectiveDir, dest, type Cell,
} from "./core.ts";

// 실제 도착 칸이 모두 유니크한지 독립 검사 (생성기와 별개 로직)
function verify(grid: Cell[][]): { ok: boolean; collisions: number } {
  const seen = new Set<number>();
  let collisions = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (!cell.wall) continue;
      const [dr, dc] = dest(r, c, effectiveDir(cell.dir!, cell.num!));
      const k = dr * SIZE + dc;
      if (seen.has(k)) collisions++;
      seen.add(k);
    }
  return { ok: collisions === 0, collisions };
}

const grid = makeGrid();
assignArrows(grid);

console.log("표시 (화살표+숫자,  □=구멍):");
console.log(render(grid));

const { ok, collisions } = verify(grid);
console.log(`\n독립 검증: ${ok ? "충돌 0 — OK" : `충돌 ${collisions}건 — FAIL`}`);

console.log("\n한 스텝 뒤 실제 격자 (■=벽, □=구멍):");
const next = step(grid);
console.log(
  next
    .map((row) => "  " + row.map((c) => (c.wall ? "■" : "□")).join(" "))
    .join("\n")
);

// 한 스텝 뒤에도 벽 수가 유지되면(=구멍 수 유지) 충돌 없음을 재확인
let wallsAfter = 0;
for (const row of next) for (const c of row) if (c.wall) wallsAfter++;
let wallsBefore = 0;
for (const row of grid) for (const c of row) if (c.wall) wallsBefore++;
console.log(`\n벽 수: ${wallsBefore} → ${wallsAfter} (${wallsBefore === wallsAfter ? "유지 = 충돌 없음" : "감소 = 충돌!"})`);
