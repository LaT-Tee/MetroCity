/* ================= what to improve next ================= */
function placeName(x,y){
  let best=null, bd=4; for(const s of stations){ const d=dist(s.x,s.y,x,y); if(d<bd){ bd=d; best=s.name; } } if(best) return best;
  bd=1e9; for(const p of [...G.centers,...G.plazas,...G.inds,...G.villages]){ const d=dist(p.x,p.y,x,y)/(p.type==='main'?1.6:1); if(d<bd){ bd=d; best=p.type==='main'?p.name:(p.name.k==='village'||p.name.k==='town'?{s:p.name.s,k:p.name.k}:p.name); } }
  return best;
}
function coverageMask(r){
  const m=new Uint8Array(W*H), r2=r*r-1e-9;
  for(const s of stations){ for(let y=Math.max(0,Math.floor(s.y-r));y<=Math.min(H-1,Math.ceil(s.y+r));y++) for(let x=Math.max(0,Math.floor(s.x-r));x<=Math.min(W-1,Math.ceil(s.x+r));x++) if((x-s.x)**2+(y-s.y)**2<=r2) m[y*W+x]=1; }
  return m;
}
function analyze(){
  const out=[], built=lines.filter(l=>l.stops.length>=2);
  // 1. lines that cross without an interchange — depends only on the network, so cached until it changes;
  //    path pieces are boxed first so only overlapping boxes get the exact segment test
  const xsig=built.map(L=>L.id+':'+L.stops.join('.')+(L.loop?'o':'')).join('|');
  if(analyze.xsig!==xsig){
    const xs=[], seen=[], boxes=built.map(L=>L.paths.map(p=>{ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const q of p){ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1]; } return [x0,y0,x1,y1]; }));
    for(let i=0;i<built.length;i++) for(let j=i+1;j<built.length;j++){
      const A=built[i], B=built[j];
      A.paths.forEach((pa,ia)=>{ const ba=boxes[i][ia]; B.paths.forEach((pb,ib)=>{ const bb=boxes[j][ib]; if(ba[0]>bb[2]||bb[0]>ba[2]||ba[1]>bb[3]||bb[1]>ba[3]) return;
        for(let a=0;a<pa.length-1;a++) for(let b=0;b<pb.length-1;b++){
          const X=segX(pa[a],pa[a+1],pb[b],pb[b+1]); if(!X) continue;
          const shared=A.stops.some(id=>B.stops.includes(id)&&dist(stById(id).x,stById(id).y,X[0],X[1])<2.5);
          if(shared||seen.some(p=>dist(p[0],p[1],X[0],X[1])<4)) continue;
          seen.push(X); xs.push({type:'xfer',x:X[0],y:X[1],a:A.id,b:B.id,score:1e9});
        } }); });
    }
    analyze.xsig=xsig; analyze.xs=xs;
  }
  out.push(...analyze.xs.map(o=>({...o})));
  // 2. dense areas out of walking reach
  const cov=coverageMask(5.4), BK=8, gw=Math.ceil(W/BK), gh=Math.ceil(H/BK), bs=new Float64Array(gw*gh), bx=new Float64Array(gw*gh), by=new Float64Array(gw*gh);
  const Ba=G.bounds; for(let y=Ba[1];y<Ba[3];y++) for(let x=Ba[0];x<Ba[2];x++){ const i=y*W+x, d=G.D[i]; if(d<0.06||cov[i]) continue; const k=Math.floor(y/BK)*gw+Math.floor(x/BK); bs[k]+=d; bx[k]+=d*x; by[k]+=d*y; }
  const gaps=[]; for(let k=0;k<bs.length;k++) if(bs[k]*900>30000) gaps.push({x:bx[k]/bs[k],y:by[k]/bs[k],pop:bs[k]*900});
  gaps.sort((a,b)=>b.pop-a.pop); const pickedGaps=[];
  for(const g of gaps){ if(pickedGaps.length>=2) break; if(pickedGaps.some(p=>dist(p.x,p.y,g.x,g.y)<20)) continue; pickedGaps.push(g); out.push({type:'gap',x:g.x,y:g.y,pop:g.pop,score:g.pop}); }
  // 3. long car commutes between the same two areas
  const CB=14, cw=Math.ceil(W/CB), wPer=G.popTotal*0.55/G.agents.length*2, corr=new Map();
  for(const a of G.agents){ if(a.p>0.4||a.tr<30) continue; const h=Math.floor(a.hy/CB)*cw+Math.floor(a.hx/CB), w=Math.floor(a.wy/CB)*cw+Math.floor(a.wx/CB); if(h===w) continue;
    const key=h+'>'+w; let c=corr.get(key); if(!c){ c={n:0,t:0,hx:0,hy:0,wx:0,wy:0}; corr.set(key,c); } c.n++; c.t+=a.tr; c.hx+=a.hx; c.hy+=a.hy; c.wx+=a.wx; c.wy+=a.wy; }
  const cs=[...corr.values()].filter(c=>c.n>=10).map(c=>({x:c.hx/c.n,y:c.hy/c.n,x2:c.wx/c.n,y2:c.wy/c.n,people:c.n*wPer,avg:c.t/c.n,score:c.n*c.t/c.n}));
  cs.sort((a,b)=>b.score-a.score);
  const pickedC=[]; for(const c of cs){ if(pickedC.length>=1) break; if(dist(c.x,c.y,c.x2,c.y2)<14) continue; pickedC.push(c); out.push({type:'corr',...c}); }
  // 4. lines carrying far fewer riders per km than the rest
  if(built.length>=2&&sim){ const rk=built.map(L=>({L,r:(sim.lineRide[L.id]||0)/Math.max(1,lineLength(L)*CELL_KM)})); const avg=rk.reduce((s,o)=>s+o.r,0)/rk.length;
    for(const o of rk){ if(o.r<avg*0.35&&lineLength(o.L)*CELL_KM>2.5){ const pts=linePathPts(o.L), m=pts[Math.floor(pts.length/2)]; out.push({type:'weak',line:o.L.id,x:m[0],y:m[1],ratio:Math.round(o.r/avg*100),score:1}); } } }
  // 5. trips that still take too long, even where the metro exists
  if(sim&&sim.flows){ const lim=Math.max(38,sim.avg*1.15), picked=[];
    const cand=sim.flows.map(f=>({...f,tt:f.share*(f.metro!=null?f.metro:f.car)+(1-f.share)*f.car})).filter(f=>f.tt>lim&&dist(f.x,f.y,f.x2,f.y2)>14).sort((a,b)=>b.people*b.tt-a.people*a.tt);
    for(const f of cand){ if(picked.length>=3) break; if([...out,...picked].some(o=>(o.type==='corr'||o.type==='slow')&&dist(o.x,o.y,f.x,f.y)<14&&dist(o.x2,o.y2,f.x2,f.y2)<14)) continue;
      picked.push({type:'slow',x:f.x,y:f.y,x2:f.x2,y2:f.y2,people:f.people,avg:f.tt,why:f.metro==null?'none':f.metro>f.car*0.9?'detour':'weak'}); }
    out.push(...picked); }
  // 6. long, busy lines where people ride far: an express would help
  if(sim){ const avgR=built.reduce((s,L)=>s+(sim.lineRide[L.id]||0),0)/Math.max(1,built.length);
    for(const L of built){ const nx=(L.svc||0)+1; if(L.loop||nx>3||L.stops.length<SVC_MIN[nx]) continue; ensurePaths(L);
      const seg=L.paths.map(p=>plen(p)/METRO_V), t0=seg.reduce((a,b)=>a+b,0)+(L.stops.length-1)*DWELL, r=sim.lineRide[L.id]||0;
      if(t0<20+nx*4||r<avgR*0.6) continue; const pts=linePathPts(L), m=pts[Math.floor(pts.length*0.6)];
      out.push({type:'exp',line:L.id,x:m[0],y:m[1],mins:t0,people:r*0.5,next:nx}); } }
  // 7. stations carrying more than they comfortably can
  if(sim){ for(const st of stations){ const b=sim.stBoard[st.id]||0; if(b>3.5e5) out.push({type:'busy',x:st.x,y:st.y,st:st.id,people:b}); } }
  // order: interchanges first (cheapest fix), then the biggest groups of people
  const rank={xfer:0,gap:1,corr:1,busy:2,slow:2,weak:3};
  const ofType=t=>out.filter(o=>o.type===t).sort((a,b)=>(b.people||b.pop||0)-(a.people||a.pop||0));
  // 8. development projects with people moving in and no metro yet
  for(const p of (G.projects||[])){ if(!inB(p.x,p.y)||servedNear(p.x,p.y,9)) continue; const pop=popAround(p.x,p.y,10); if(!p.done&&pop<8e3) continue; out.push({type:'proj',x:p.x,y:p.y,proj:p,pop,people:pop}); }
  const X=ofType('xfer'), SL=ofType('slow'), GP=ofType('gap'), CO=ofType('corr'), BU=ofType('busy'), WK=ofType('weak'), EX=ofType('exp'), PJ=ofType('proj');
  const lim=[...X.slice(0,1),...SL.slice(0,2),...PJ.slice(0,1),...EX.slice(0,1),...GP.slice(0,1),...CO.slice(0,1),...BU.slice(0,1),...X.slice(1,2),...GP.slice(1,2),...SL.slice(2,3),...EX.slice(1,2),...WK].slice(0,5);
  return lim;
}
function catchment(s){ let sum=0; const r=5.4; for(let y=Math.max(0,Math.floor(s.y-r));y<=Math.min(H-1,Math.ceil(s.y+r));y++) for(let x=Math.max(0,Math.floor(s.x-r));x<=Math.min(W-1,Math.ceil(s.x+r));x++) if((x-s.x)**2+(y-s.y)**2<=r*r) sum+=G.D[y*W+x]; return sum*900; }
