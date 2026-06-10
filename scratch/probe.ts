import { makeGrid, assignArrows, SIZE, footprint, type Cell } from "./core.ts";
function colcount(g:Cell[][]){const s=new Set<number>();let col=0;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const x=g[r][c];if(!x.wall)continue;
    for(const k of footprint(r,c,x)){if(s.has(k))col++;s.add(k);}}return col;}
const N=Number(process.argv[2]??100000);
let max=0,slow=0,totCol=0,exp=0,eaten=0,move=0,badPass=0;const t0=performance.now();
for(let i=0;i<N;i++){const g=makeGrid();const s=performance.now();assignArrows(g);const dt=performance.now()-s;
  if(dt>max)max=dt;if(dt>1)slow++;totCol+=colcount(g);
  let pass=0;
  for(const row of g)for(const x of row){
    if(!x.wall){pass++;continue;} if(x.eaten)eaten++; else if(x.exp)exp++; else if(x.num===4){pass++;move++;} else move++; }
  if(pass!==3)badPass++;}
const tot=performance.now()-t0;
console.log(`${N.toLocaleString()}회: 총 ${(tot/1000).toFixed(2)}s, 평균 ${(tot/N*1000).toFixed(1)}µs, 최대 1콜 ${max.toFixed(2)}ms, >1ms ${slow}`);
console.log(`충돌 총합 ${totCol} | 통과가능≠3 인 세트 ${badPass}`);
console.log(`평균/세트: 확장 ${(exp/N).toFixed(2)}, 먹힘 ${(eaten/N).toFixed(2)}, 이동 ${(move/N).toFixed(2)}`);
