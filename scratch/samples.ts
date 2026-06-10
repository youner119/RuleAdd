import { SIZE, makeGrid, assignArrows, render, footprint, describeExpansions, type Cell } from "./core.ts";
function collisions(g: Cell[][]) {
  const seen = new Set<number>(); let col = 0;
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++){ const x=g[r][c]; if(!x.wall)continue;
    for (const k of footprint(r,c,x)){ if(seen.has(k))col++; seen.add(k); } }
  return col;
}
function counts(g: Cell[][]) {
  let holes=0, four=0, exp=0, eaten=0, move=0;
  for(const row of g) for(const x of row){ if(!x.wall){holes++;continue;}
    if(x.eaten)eaten++; else if(x.exp)exp++; else if(x.num===4)four++; else move++; }
  return {holes, four, exp, eaten, move, passable: holes+four};
}
const N = Number(process.argv[2] ?? 6);
for (let i=1;i<=N;i++){
  const g = makeGrid(); assignArrows(g);
  const {holes, four, exp, eaten, move, passable} = counts(g);
  console.log(`── 샘플 ${i}  (□구멍 ?4통과벽 ✦n확장벽 ▨먹힌벽 나머지이동) ──`);
  console.log(render(g));
  const exps = describeExpansions(g);
  if (exps.length) console.log("  " + exps.join("   "));
  console.log(`통과가능 ${passable}(구멍${holes}+4벽${four}) | 확장${exp} 먹힘${eaten} 이동${move} | 충돌 ${collisions(g)}\n`);
}
