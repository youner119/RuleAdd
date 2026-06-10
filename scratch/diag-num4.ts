// 숫자4 포함 다양성/성능 진단
//  (A) 자연 생성 분포: makeGrid()+assignArrows() N회 → 분배/숫자/방향/성능(tail)
//  (B) 고정 13벽 effective 균일성: 리팩터 후에도 near-uniform 유지되는지 (전수 vs 샘플)
import { SIZE, DIRS, dest, effectiveDir, makeGrid, assignArrows,
         type Dir, type Num, type Cell } from "./core.ts";

const N = Number(process.argv[2] ?? 100_000);
const pct = (x: number, t: number) => (100*x/t).toFixed(2).padStart(6);

// ===== (A) 자연 생성 분포 =====
const split: Record<number, number> = {0:0,1:0,2:0,3:0}; // 구멍 수 히스토그램
const numCnt: Record<Num, number> = {1:0,2:0,3:0,4:0};
const arrowCnt: Record<Dir, number> = {up:0,down:0,left:0,right:0,stop:0};
const effCnt: Record<Dir, number> = {up:0,down:0,left:0,right:0,stop:0};
let wallSlots=0, totalCollisions=0, maxCall=0, slowCalls=0;
let sumHoles=0, sumFour=0, sumWalls=0;

const tA0 = performance.now();
for (let i=0;i<N;i++){
  const g = makeGrid();
  const s = performance.now(); assignArrows(g); const dt = performance.now()-s;
  if (dt>maxCall) maxCall=dt; if (dt>1) slowCalls++;
  let holes=0, four=0, walls=0;
  const seen = new Set<number>();
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++){
    const x=g[r][c];
    if (!x.wall){ holes++; continue; }
    walls++; if (x.num===4) four++;
    numCnt[x.num!]++; arrowCnt[x.dir!]++;
    const e = effectiveDir(x.dir!, x.num!); effCnt[e]++;
    const [dr,dc]=dest(r,c,e); const k=dr*SIZE+dc;
    if (seen.has(k)) totalCollisions++; seen.add(k);
  }
  split[holes]++; sumHoles+=holes; sumFour+=four; sumWalls+=walls; wallSlots+=walls;
}
const tA = performance.now()-tA0;

console.log(`=== (A) 자연 생성 분포  (${N.toLocaleString()}회, ${(tA/1000).toFixed(2)}s) ===\n`);
console.log(`평균: 구멍 ${(sumHoles/N).toFixed(2)} + 4벽 ${(sumFour/N).toFixed(2)} = 통과가능 3.00 / 벽 ${(sumWalls/N).toFixed(2)}`);
console.log(`충돌 총합: ${totalCollisions} (0이어야 정상)`);
console.log(`성능: 1콜 평균 ${(tA/N*1000).toFixed(1)}µs, 최대 ${maxCall.toFixed(2)}ms, >1ms ${slowCalls}건 (폭주 없음 확인)\n`);

console.log(`--- 안전칸 분배 (구멍 수, 균일 25%씩 기대) ---`);
for (const h of [0,1,2,3]) console.log(`  구멍 ${h} + 4벽 ${3-h}: ${pct(split[h],N)}%`);

console.log(`\n--- 숫자 분포 (전체 벽 기준) ---`);
for (const n of [1,2,3,4] as Num[]) console.log(`  ${n}: ${pct(numCnt[n], wallSlots)}%`);
console.log(`  (4 = 4벽 비율 ≈ 평균4벽/평균벽 = ${(sumFour/sumWalls*100).toFixed(2)}%)`);

console.log(`\n--- 화살표 분포 ---`);
for (const d of DIRS) console.log(`  ${d.padEnd(5)}: ${pct(arrowCnt[d], wallSlots)}%`);

console.log(`\n--- effective(실제) 방향 분포 (균일 20% 기대) ---`);
for (const d of DIRS) console.log(`  ${d.padEnd(5)}: ${pct(effCnt[d], wallSlots)}%`);

// ===== (B) 고정 13벽 effective 균일성 (전수 vs 샘플) =====
const HOLES = new Set([1,10,12]);
const WALLS:[number,number][]=[];
for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if(!HOLES.has(r*SIZE+c)) WALLS.push([r,c]);

let T=0; const effUni:Record<Dir,number>={up:0,down:0,left:0,right:0,stop:0};
{
  const occ=new Set<number>(); const cnt:Record<Dir,number>={up:0,down:0,left:0,right:0,stop:0};
  const rec=(i:number)=>{
    if(i===WALLS.length){T++; for(const d of DIRS) effUni[d]+=cnt[d]; return;}
    const [r,c]=WALLS[i];
    for(const e of DIRS){ const [dr,dc]=dest(r,c,e); const k=dr*SIZE+dc;
      if(occ.has(k))continue; occ.add(k); cnt[e]++; rec(i+1); occ.delete(k); cnt[e]--; }
  };
  rec(0);
}
function fixedGrid():Cell[][]{ const g:Cell[][]=[];
  for(let r=0;r<SIZE;r++) g.push(Array.from({length:SIZE},(_,c)=>({wall:!HOLES.has(r*SIZE+c)}))); return g; }
const M = Math.min(N, 200_000);
const effS:Record<Dir,number>={up:0,down:0,left:0,right:0,stop:0}; let slots=0;
for(let i=0;i<M;i++){ const g=fixedGrid(); assignArrows(g);
  for(const [r,c] of WALLS){ effS[effectiveDir(g[r][c].dir!,g[r][c].num!)]++; slots++; } }

console.log(`\n=== (B) 고정 13벽 effective 균일성 (전수 ${T.toLocaleString()}해, 샘플 ${M.toLocaleString()}회) ===`);
console.log(`  방향   샘플      전수(이상)`);
for(const d of DIRS){
  const s=pct(effS[d],slots); const u=(100*effUni[d]/(T*WALLS.length)).toFixed(2).padStart(6);
  console.log(`  ${d.padEnd(5)} ${s}%    ${u}%`);
}
