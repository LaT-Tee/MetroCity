/* ================= roads that appear as the city grows (display only) ================= */
let RA=null;
function routeRoad(a,b,cls){
  const n=W*H; if(!RA) RA={g:new Float32Array(n),p:new Int32Array(n),st:new Int32Array(n),cl:new Int32Array(n),run:0};
  const ix=(x,y)=>clamp(Math.round(y),0,H-1)*W+clamp(Math.round(x),0,W-1), s0=ix(a.x,a.y), t0=ix(b.x,b.y); if(s0===t0) return [];
  const run=++RA.run, gC=RA.g, prev=RA.p, stamp=RA.st, closed=RA.cl, water=G.water, e=G.e, pk=G.pk, ru=G.roadUse;
  const x0=Math.max(0,Math.min(a.x,b.x)-40), x1=Math.min(W-1,Math.max(a.x,b.x)+40), y0=Math.max(0,Math.min(a.y,b.y)-40), y1=Math.min(H-1,Math.max(a.y,b.y)+40);
  const tX=t0%W, tY=(t0/W)|0, hh=i=>Math.hypot(i%W-tX,((i/W)|0)-tY)*0.75, Gv=i=>stamp[i]===run?gC[i]:Infinity;
  gC[s0]=0; prev[s0]=-1; stamp[s0]=run; HPQ.n=0; hqPush(hh(s0),s0);
  const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found=false;
  while(HPQ.n){ const u=hqPop(); if(closed[u]===run) continue; closed[u]=run; if(u===t0){ found=true; break; }
    const ux=u%W, uy=(u/W)|0;
    for(const [dx,dy,dl] of NB){ const vx=ux+dx, vy=uy+dy; if(vx<x0||vy<y0||vx>x1||vy>y1) continue; const v=vy*W+vx; if(closed[v]===run) continue;
      let m=water[v]===1?28:water[v]===2?6:1+5*Math.max(0,e[v]-0.35)+2.5*smooth(pk[v],0.26,0.31); if(ru[v]) m=Math.min(m,ru[v]>=2?0.3:0.45);
      const ng=Gv(u)+dl*m; if(ng<Gv(v)){ gC[v]=ng; prev[v]=u; stamp[v]=run; hqPush(ng+hh(v),v); } } }
  if(!found) return [];
  const cells=[]; for(let u=t0;u!==-1;u=(stamp[u]===run?prev[u]:-1)) cells.push(u); cells.reverse();
  const lv=cls==='hwy'?3:cls==='art'?2:1, out=[]; let cur=[];
  const flush=()=>{ if(cur.length>3){ let pts=cur.map(i=>[i%W,(i/W)|0]); pts=chaikin(rdp(pts,0.7),2).map(p=>[Math.round(p[0]*10)/10,Math.round(p[1]*10)/10]); out.push(pts); if(G.rn) rnPolyline(G.rn,pts,cls==='hwy'?4:cls==='art'?3:1); else G.extraRoads.push({c:cls,p:pts}); G.roadsAdded=(G.roadsAdded||0)+1; } cur=[]; };
  for(let k=0;k<cells.length;k++){ const c=cells[k], had=ru[c];
    if(had>=lv&&k>0&&k<cells.length-1){ if(cur.length){ cur.push(c); flush(); } continue; }
    if(!cur.length&&k>0) cur.push(cells[k-1]); cur.push(c); if(had<lv) ru[c]=lv; }
  flush(); return out;
}
// connect a place that just grew to the nearest established place
function roadForPlace(x,y,tier){
  if((G.roadsAdded||0)>160) return false;
  let best=null, bd=1e9; for(const p of [...G.centers,...G.villages]){ const d=dist(p.x,p.y,x,y); if(d>6&&d<bd&&inB(p.x,p.y)){ bd=d; best=p; } }
  if(!best||bd>70) return false;
  return routeRoad({x,y},best,tier>=2?'art':'loc').length>0;
}
function markRoad(pts,lv){ for(let k=1;k<pts.length;k++){ const a=pts[k-1], b=pts[k], n=Math.max(1,Math.ceil(dist(a[0],a[1],b[0],b[1]))); for(let q=0;q<=n;q++){ const x=Math.round(lerp(a[0],b[0],q/n)), y=Math.round(lerp(a[1],b[1],q/n)); if(x>=0&&y>=0&&x<W&&y<H){ const i=y*W+x; if(G.roadUse[i]<lv) G.roadUse[i]=lv; } } } }
