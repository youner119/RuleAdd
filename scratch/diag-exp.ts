// 확장(벽 잡아먹기) 단일풀 모델 진단 — 자연 생성 N회. move-d vs expand-d 동등성 확인.
import { SIZE, DIRS, makeGrid, assignArrows, footprint, effectiveDir,
         type Dir, type Cell } from "./core.ts";
const N = Number(process.argv[2] ?? 1_000_000);
const pct = (x:number,t:number)=>(100*x/t).toFixed(2).padStart(6);

function collisions(g:Cell[][]){const s=new Set<number>();let col=0;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const x=g[r][c];if(!x.wall)continue;
    for(const k of footprint(r,c,x)){if(s.has(k))col++;s.add(k);}}return col;}

let max=0,slow=0,totCol=0,badPass=0;
let sumEater=0,sumEaten=0,sumMove=0;
const expDir:Record<Dir,number>={up:0,down:0,left:0,right:0,stop:0}; // 확장 방향
const movDir:Record<Dir,number>={up:0,down:0,left:0,right:0,stop:0}; // 이동 effective 방향
const expK:Record<number,number>={1:0,2:0,3:0,4:0};
let actingWalls=0; // 행동하는 벽 = 이동벽 + 확장벽 (먹힌 벽 제외)

const t0=performance.now();
for(let i=0;i<N;i++){
  const g=makeGrid(); const s=performance.now(); assignArrows(g); const dt=performance.now()-s;
  if(dt>max)max=dt; if(dt>1)slow++;
  totCol+=collisions(g);
  let pass=0;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const x=g[r][c];
    if(!x.wall){pass++;continue;}
    if(x.eaten){sumEaten++;continue;}
    if(x.exp){sumEater++;actingWalls++;expK[x.exp.length]++;for(const d of x.exp)expDir[d]++;continue;}
    if(x.num===4)pass++;
    sumMove++;actingWalls++;movDir[effectiveDir(x.dir!,x.num!)]++;
  }
  if(pass!==3)badPass++;
}
const tot=performance.now()-t0;

console.log(`=== 확장 단일풀 모델 진단  (${N.toLocaleString()}회, ${(tot/1000).toFixed(2)}s) ===\n`);
console.log(`성능: 1콜 평균 ${(tot/N*1000).toFixed(1)}µs, 최대 ${max.toFixed(2)}ms, >1ms ${slow}건`);
console.log(`불변식: 충돌 총합 ${totCol}, 통과가능≠3 세트 ${badPass}  (둘 다 0이어야 정상)\n`);
console.log(`평균/세트: 확장벽 ${(sumEater/N).toFixed(2)}, 먹힘 ${(sumEaten/N).toFixed(2)}, 이동벽 ${(sumMove/N).toFixed(2)}\n`);

console.log(`--- ★ 동등성: 행동벽 중 "이동-d" vs "확장-d" 비율 (방향별로 같아야 함) ---`);
console.log(`  방향    이동-d     확장-d`);
for(const d of ["up","down","left","right"] as Dir[])
  console.log(`  ${d.padEnd(5)} ${pct(movDir[d],actingWalls)}%   ${pct(expDir[d],actingWalls)}%`);
console.log(`  stop  ${pct(movDir.stop,actingWalls)}%   (정지는 이동에만)`);

console.log(`\n--- 확장벽당 방향 수 ---`);
for(const k of [1,2,3,4]) console.log(`  ${k}방향: ${pct(expK[k],sumEater)}%`);
