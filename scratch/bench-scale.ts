// 숫자 개수(K)를 늘렸을 때 생성 시간 변화 측정.
// 단, 추가 숫자는 기존 5개 effective 방향에만 매핑되는 "별칭"(새 도착 칸 없음).
import { SIZE, DIRS, dest, type Dir } from "./core.ts";

const HOLES = new Set([1,10,12]);
const WALLS:[number,number][]=[]; for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++) if(!HOLES.has(r*SIZE+c))WALLS.push([r,c]);
const OPP:Record<Dir,Dir>={up:"down",down:"up",left:"right",right:"left",stop:"stop"};
const TRANSFORMS = [(d:Dir)=>d, (d:Dir)=>OPP[d], (_d:Dir)=>"stop" as Dir]; // as-is / opposite / stop

function run(K:number, N:number){
  // 숫자 i(0..K-1)의 effective 변환을 3종을 순환 배정 → effective 도착은 항상 ≤5
  const numTf = Array.from({length:K},(_,i)=>TRANSFORMS[i%TRANSFORMS.length]);
  // REPS: effective dir → [{dir,num}] (별칭들)
  const REPS:Record<Dir,{dir:Dir;num:number}[]>={up:[],down:[],left:[],right:[],stop:[]};
  for(const d of DIRS) for(let n=0;n<K;n++) REPS[numTf[n](d)].push({dir:d,num:n});
  const shuffle=<T,>(a:T[])=>{const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};

  const grid=()=>WALLS.map(()=>({dir:"" as any,num:0}));
  let max=0; const t0=performance.now();
  for(let it=0;it<N;it++){
    const order=shuffle(WALLS.map((_,i)=>i));
    const occ=new Set<number>(); const out=new Array(WALLS.length);
    const s=performance.now();
    const solve=(oi:number):boolean=>{
      if(oi===order.length)return true;
      const [r,c]=WALLS[order[oi]];
      for(const e of shuffle(DIRS)){ const [dr,dc]=dest(r,c,e); const k=dr*SIZE+dc;
        if(occ.has(k))continue; occ.add(k);
        const reps=REPS[e]; out[order[oi]]=reps[Math.floor(Math.random()*reps.length)];
        if(solve(oi+1))return true; occ.delete(k); }
      return false;
    };
    solve(0); const dt=performance.now()-s; if(dt>max)max=dt;
  }
  const tot=performance.now()-t0;
  console.log(`K=${String(K).padStart(2)} 숫자: 1콜 평균 ${(tot/N*1000).toFixed(2)}µs, 최대 ${max.toFixed(2)}ms, 총 ${(tot/1000).toFixed(2)}s`);
}
const N=Number(process.argv[2]??100000);
console.log(`고정 13벽, 각 ${N.toLocaleString()}회 (추가 숫자=별칭, 새 도착칸 없음)\n`);
for(const K of [3,4,10,15,30]) run(K,N);
