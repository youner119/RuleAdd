// Commit1+2 검증: setgen 불변식(겹침0·정답·게이팅·통과칸·확장 무연쇄) — 룰6 포함
import { generateSet, effShift } from '../src/core/setgen.ts';
import { wrapCell } from '../src/core/pattern.ts';

const N = 4, PASS = 1, RUNS = 200000;
const rounds = [
  { name:'R1', a:{move:false,opposite:false,stop:false,passable:false,expand:false} },
  { name:'R2', a:{move:true, opposite:false,stop:false,passable:false,expand:false} },
  { name:'R3', a:{move:true, opposite:true, stop:false,passable:false,expand:false} },
  { name:'R4', a:{move:true, opposite:true, stop:true, passable:false,expand:false} },
  { name:'R5', a:{move:true, opposite:true, stop:true, passable:true, expand:false} },
  { name:'R6', a:{move:true, opposite:true, stop:true, passable:true, expand:true } },
];

for (const r of rounds) {
  let collide=0, badPass=0, unsolvable=0, gate=0, chain=0, badEaten=0;
  let expanders=0, eaten=0, sets=0;
  for (let i=0;i<RUNS;i++){
    const p = generateSet({ cellCount:N, passableCount:PASS, active:r.a });
    sets++;
    // 최종 위치
    const finals: number[] = [];
    const collidableFinals: number[] = [];
    let pw=0;
    const kindAt = new Map<number,string>();
    for (const w of p.walls) kindAt.set(w.cell, w.kind);
    for (const w of p.walls){
      let pos:number;
      if (w.kind==='move'){ pos=wrapCell(w.cell+effShift(w.num,w.arrowDir),N); if(w.num===4)pw++; }
      else pos=w.cell; // expand/eaten 제자리
      finals.push(pos);
      const collidable = !(w.kind==='move' && w.num===4); // 통과벽만 비충돌
      if (collidable) collidableFinals.push(pos);
      // 게이팅
      if (w.kind==='move'){
        if (w.num===2 && !r.a.opposite) gate++;
        if (w.num===3 && !r.a.stop) gate++;
        if (w.num===4 && !r.a.passable) gate++;
        if (w.arrowDir!==0 && !r.a.move) gate++;
      }
      if (w.kind==='expand'){
        expanders++;
        if (!r.a.expand) gate++;
        // 무연쇄: 먹는 대상은 eaten 이어야(확장벽이면 연쇄)
        for (const d of w.dirs){ const nb=wrapCell(w.cell+d,N); if(kindAt.get(nb)!=='eaten') badEaten++; }
        // 확장벽이 먹히면 연쇄
      }
      if (w.kind==='eaten'){ eaten++; if(kindAt.get(w.cell)==='expand') chain++; }
    }
    // 겹침0: 모든 벽 최종 위치 distinct
    if (new Set(finals).size !== finals.length) collide++;
    // 통과칸 = gaps + 통과벽
    if (p.gaps.length + pw !== PASS) badPass++;
    // 정답: 충돌 벽이 없는 칸 ≥1
    const blocked = new Set(collidableFinals);
    let safe=0; for(let c=0;c<N;c++) if(!blocked.has(c)) safe++;
    if (safe<1) unsolvable++;
  }
  console.log(`${r.name} 겹침${collide} 통과칸오류${badPass} 막힘${unsolvable} 게이팅${gate} 연쇄${chain} 먹힘불일치${badEaten} | 확장벽 ${(expanders/sets).toFixed(2)}/세트 먹힘 ${(eaten/sets).toFixed(2)}/세트`);
}
