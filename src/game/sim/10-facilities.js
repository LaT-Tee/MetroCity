/* ================= new facilities as the city grows ================= */
function nearestPlace(x,y){ let best=null,bd=1e9; for(const p of [...G.centers,...G.villages]){ if(p.name.s==null) continue; const d=dist(p.x,p.y,x,y); if(d<bd){ bd=d; best=p; } } return best; }
function dirFrom(x,y){ const M=G.centers[0], a=Math.atan2(y-M.y,x-M.x); return a>-Math.PI/4&&a<=Math.PI/4?0:a>Math.PI/4&&a<=3*Math.PI/4?1:(a>3*Math.PI/4||a<=-3*Math.PI/4)?2:3; }
function siteRail(){
  let best=null, bs=-1; for(let k=0;k<G.rail.length;k+=2){ const [x,y]=G.rail[k]; if(!inB(x,y,10)||G.water[Math.round(y)*W+Math.round(x)]) continue;
    if(dist(x,y,G.fac.station.x,G.fac.station.y)<45||(G.fac2||[]).some(f=>f.t==='rail'&&dist(f.x,f.y,x,y)<45)) continue;
    const sc=popAround(x,y,12); if(sc>bs){ bs=sc; best={x,y}; } }
  if(!best||bs<4e4) return null; const p=nearestPlace(best.x,best.y); return {t:'rail',x:best.x,y:best.y,s:p.name.s,d:dirFrom(best.x,best.y)};
}
function siteCoach(){
  let best=null, bs=-1; for(const p of [...G.centers.slice(1),...G.villages]){ if(tierOf(p)<2||!inB(p.x,p.y,8)) continue; if(dist(p.x,p.y,G.fac.coach.x,G.fac.coach.y)<25||(G.fac2||[]).some(f=>f.t==='coach'&&dist(f.x,f.y,p.x,p.y)<25)) continue;
    const sc=popAround(p.x,p.y,10); if(sc>bs){ bs=sc; best=p; } }
  if(!best) return null; const x=best.x+2.5, y=best.y+2; if(G.water[Math.round(y)*W+Math.round(x)]) return null; return {t:'coach',x,y,s:best.name.s};
}
function siteAirport(){
  const M=G.centers[0], B=G.bounds, R=mulberry32(G.seed*7+(G.fac2||[]).length); let best=null, bs=-1e9;
  for(let tr=0;tr<1800;tr++){ const x=B[0]+16+R()*(B[2]-B[0]-32), y=B[1]+16+R()*(B[3]-B[1]-32), i=Math.round(y)*W+Math.round(x); if(G.water[i]||G.e[i]>0.35) continue;
    if(dist(x,y,M.x,M.y)<60||dist(x,y,G.fac.airport.x,G.fac.airport.y)<75||(G.fac2||[]).some(f=>f.t==='air'&&dist(f.x,f.y,x,y)<75)||G.centers.some(c=>c.name.k==='core'&&dist(c.x,c.y,x,y)<35)) continue;
    const a=R()*Math.PI; let ok=true; for(let u=-9;u<=9&&ok;u+=1.5) for(let v=-4;v<=4&&ok;v+=2){ const px=x+Math.cos(a)*u-Math.sin(a)*v, py=y+Math.sin(a)*u+Math.cos(a)*v, j=Math.round(py)*W+Math.round(px); if(!inB(px,py,2)||G.water[j]||G.e[j]>0.45) ok=false; }
    if(!ok) continue; const dr=airDry(x,y,a,waterSD), sc=-popAround(x,y,8)/1e4+R()*2-((dr&1)&&(dr&6)?0:1e5); if(sc>bs){ bs=sc; best={x,y,a,dr}; } }
  if(!best) return null; const p=nearestPlace(best.x,best.y);
  let term={x:best.x-Math.sin(best.a)*5.5,y:best.y+Math.cos(best.a)*5.5}; if(G.water[Math.round(term.y)*W+Math.round(term.x)]||(!(best.dr&2)&&(best.dr&4))) term={x:best.x+Math.sin(best.a)*5.5,y:best.y-Math.cos(best.a)*5.5};
  return {t:'air',x:best.x,y:best.y,a:best.a,term,s:p.name.s};
}
// an airfield takes its land: nobody lives on it and nothing is built there, however the city grows afterwards
function airportClear(f){ if(!growth||!growth.S) return; G.air=airMaskOf([G.fac.airport,...(G.fac2||[]).filter(o=>o.t==='air')]); const R=14; for(let y=Math.max(0,Math.floor(f.y-R));y<=Math.min(H-1,Math.ceil(f.y+R));y++) for(let x=Math.max(0,Math.floor(f.x-R));x<=Math.min(W-1,Math.ceil(f.x+R));x++){ const ad=dist(x,y,f.x,f.y); if(ad>=R) continue; const i=y*W+x; growth.S[i]*=smooth(ad,10,14); G.D[i]*=smooth(ad,9,14); if(G.air[i]){ G.D[i]=0; growth.S[i]=0; } if(growth.D0) growth.D0[i]=Math.min(growth.D0[i],G.D[i]); } }
/* Ground that is kept. A railway station (platforms, hall and forecourt) and each development's plot belong to them
   alone: no street is laid across one (a street already there is taken up), nothing else is built on it. The same
   site is used by everything that draws or tests the place, so they always agree. */
function railSite(st){ const C=G._sites||(G._sites=new Map()), key=st.x+','+st.y; if(C.has(key)) return C.get(key); const rl=G.rail, M=G.centers[0], PL=1.5;
  let bi=0, bd=1e9; rl.forEach((p,i)=>{ const d=dist(p[0],p[1],st.x,st.y); if(d<bd){ bd=d; bi=i; } });
  const angAt=i=>{ const p0=rl[Math.max(0,i-2)], p1=rl[Math.min(rl.length-1,i+2)]; return Math.atan2(p1[1]-p0[1],p1[0]-p0[0]); };
  const dryAt=(i,sd)=>{ const c=rl[i], a=angAt(i), ca=Math.cos(a), sa=Math.sin(a); for(let lx=-PL/2;lx<=PL/2+1e-6;lx+=0.25) for(const lz of [-0.075,0.075,sd*0.14,sd*0.21]) if(waterSD(c[0]+ca*lx-sa*lz,c[1]+sa*lx+ca*lz)<0.04) return false; return true; };
  let sd=1; { const a=angAt(bi), c=rl[bi]; if((M.x-c[0])*-Math.sin(a)+(M.y-c[1])*Math.cos(a)<0) sd=-1; }       // the hall faces the city centre
  { let got=false; for(let k=0;k<=16&&!got;k++) for(const i of (k?[bi+k,bi-k]:[bi])){ if(i<2||i>rl.length-3) continue; for(const s2 of [sd,-sd]) if(dryAt(i,s2)){ bi=i; sd=s2; got=true; break; } if(got) break; } }
  const o={i:bi,x:rl[bi][0],y:rl[bi][1],a:angAt(bi),sd}; C.set(key,o); return o; }
// the coach station's yard: beside the street nearest to it, on whichever side (and how far along) the whole yard is on dry land
function coachSite(co){ const C=G._sites||(G._sites=new Map()), key='c'+co.x+','+co.y; if(C.has(key)) return C.get(key); const R=G.rn, h=R?rnNearEdge(R,co.x,co.y,2.5):null; let a=0, x=co.x, z=co.y;
  const dryC=(x,z,a)=>{ const ca=Math.cos(a), sa=Math.sin(a); for(const lx of [-0.3,0,0.3]) for(const lz of [-0.19,0,0.19]) if(waterSD(x+ca*lx-sa*lz,z+sa*lx+ca*lz)<0.04) return false; return true; }, onRd=(x,z,m)=>{ const q=rnNearEdge(R,x,z,0.4); return !!q&&q.d<ROAD_W[R.ec[q.e]]/2+m; };
  if(h){ const e=h.e; a=Math.atan2(R.y[R.eb[e]]-R.y[R.ea[e]],R.x[R.eb[e]]-R.x[R.ea[e]]); const nx=-Math.sin(a), ny=Math.cos(a), s0=((co.x-h.px)*nx+(co.y-h.py)*ny)>=0?1:-1, off=ROAD_W[R.ec[e]]/2+0.2;
    let got=false; for(const t of [0,0.4,-0.4,0.8,-0.8,1.3,-1.3]){ for(const s2 of [s0,-s0]){ const px=h.px+Math.cos(a)*t+nx*s2*off, pz=h.py+Math.sin(a)*t+ny*s2*off; if(dryC(px,pz,a)&&!onRd(px,pz,0.17)){ x=px; z=pz; got=true; break; } } if(got) break; }
    if(!got){ x=h.px+nx*s0*off; z=h.py+ny*s0*off; } }
  if(!dryC(x,z,a)){ const d=dryNear(x,z,0.45,8); if(d){ x=d[0]; z=d[1]; } }
  const o={x,y:z,a}; if(R) C.set(key,o); return o; }
function projSite(p){ if(p.px!=null) return p; let px=p.x, pz=p.y; const okAt=(x,z)=>{ for(const [ox,oz] of [[0,0],[0.3,0.3],[-0.3,0.3],[0.3,-0.3],[-0.3,-0.3]]){ if(waterSD(x+ox,z+oz)<0.08) return false; if(G.rn){ const h=rnNearEdge(G.rn,x+ox,z+oz,0.2); if(h&&h.d<ROAD_W[G.rn.ec[h.e]]/2+0.02) return false; } } for(let i=0;i<G.rail.length;i+=2) if(dist(G.rail[i][0],G.rail[i][1],x,z)<0.6) return false; return !(G.air&&G.air[clamp(Math.round(z),0,H-1)*W+clamp(Math.round(x),0,W-1)]); };
  let got=okAt(px,pz); for(let r=0.2;r<=1.6&&!got;r+=0.2) for(let k=0;k<10;k++){ const an=k*0.6283+r, x=p.x+Math.cos(an)*r, z=p.y+Math.sin(an)*r; if(okAt(x,z)){ px=x; pz=z; got=true; break; } } if(!got){ const d=dryNear(px,pz,0.5,6); if(d){ px=d[0]; pz=d[1]; } }
  p.px=Math.round(px*100)/100; p.pz=Math.round(pz*100)/100; return p; }
/* Every railway station is reached by road: a street from the nearest junction to the edge of its forecourt, in front of
   the hall. (The airport has its own road to the terminal; the coach station stands beside its street.) */
function facAccess(){ const R=G.rn; if(!R) return 0; let n=0;
  for(const st of [G.fac.station,...(G.fac2||[]).filter(f=>f.t==='rail')]){ const q=railSite(st), nx=-Math.sin(q.a), ny=Math.cos(q.a), fx=q.x+nx*q.sd*0.44, fy=q.y+ny*q.sd*0.44;
    if(waterSD(fx,fy)<0.1) continue; const h=rnNearEdge(R,fx,fy,0.2); if(h&&h.d<0.12) continue;      // a street already runs past the forecourt
    let best=-1, bd=1e9; for(let gy=Math.floor((fy-3)/RN_G);gy<=Math.floor((fy+3)/RN_G);gy++) for(let gx=Math.floor((fx-3)/RN_G);gx<=Math.floor((fx+3)/RN_G);gx++){ const a=R.ng.get(rnKey(gx,gy)); if(!a) continue;
      for(const j of a){ if(!R.adj[j].length) continue; const vx=R.x[j]-fx, vy=R.y[j]-fy, d=Math.hypot(vx,vy); if(d>3||d<0.15) continue; if((vx*nx+vy*ny)*q.sd<-0.1*d) continue;   // out from the front, not round behind the station
        let ok=true; const m=Math.max(2,Math.ceil(d/0.2)); for(let k=1;k<m&&ok;k++){ const px=lerp(fx,R.x[j],k/m), py=lerp(fy,R.y[j],k/m); if(waterSD(px,py)<0.1||keepAt(px,py,0.01)) ok=false; } if(ok&&d<bd){ bd=d; best=j; } } }
    if(best<0) continue; const a0=rnAddNode(R,fx,fy); rnLink(R,a0,R.x[best],R.y[best],2,0.3); if(R.adj[a0].length) n++; }
  return n; }
/* The airport's own roads, as part of the street web. Departures is a road in the air: a deck along the front of the
   terminal at the first floor, reached by a ramp at each end. Arrivals runs at ground level between the deck and the
   doors. Both join a loop round the car parks that meets the road from the city at the gate. Streets can have height:
   G.rdDeck lists the raised stretches (world x,y,height at each end), and the 3D view builds them as bridges. */
const AIR_DY=0.046;
function airRoads(ap){ const f=airFrame(ap), at=(lx,lz)=>[ap.x+f.ca*lx-f.sa*f.ts*(f.tz+lz),ap.y+f.sa*lx+f.ca*f.ts*(f.tz+lz)];
  return {dep:[[-4.45,0.95],[-2.95,0.95],[2.95,0.95],[4.45,0.95]],depZ:[0,AIR_DY,AIR_DY,0],arr:[[-4.95,0.6],[4.95,0.6]],links:[[[-4.45,0.95],[-4.45,1.5]],[[4.45,0.95],[4.45,1.5]],[[-4.95,0.6],[-4.95,1.5]],[[4.95,0.6],[4.95,1.5]],[[-4.95,1.5],[4.95,1.5]],[[0,1.5],[0,1.72]]],at}; }
function airDecks(){ const out=[]; for(const ap of [G.fac.airport,...(G.fac2||[]).filter(f=>f.t==='air')]){ if(!ap||ap.x==null) continue; const r=airRoads(ap); for(let k=1;k<r.dep.length;k++){ const a=r.at(...r.dep[k-1]), b=r.at(...r.dep[k]); out.push([a[0],a[1],r.depZ[k-1],b[0],b[1],r.depZ[k]]); } } return out; }
let rnAirOK=false;
function airAccess(){ const R=G.rn; if(!R) return 0; let n=0; rnAirOK=true;
  try{ for(const ap of [G.fac.airport,...(G.fac2||[]).filter(f=>f.t==='air')]){ if(!ap||ap.x==null) continue; const r=airRoads(ap), d0=r.at(...r.dep[1]), h=rnNearNode(R,d0[0],d0[1],0.03); if(h>=0&&R.adj[h].length) continue;      // already there
      // laid node by node: the street web's usual snapping would merge the two levels, which lie close together in plan
      const own=new Map(), node=q=>{ const k=q[0].toFixed(2)+','+q[1].toFixed(2); let i=own.get(k); if(i==null){ const w=r.at(...q); i=rnAddNode(R,w[0],w[1]); own.set(k,i); } return i; },
        lay=(pts,c)=>{ for(let k=1;k<pts.length;k++){ const a=pts[k-1], b=pts[k], m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5)); let pv=node(a); for(let q=1;q<=m;q++){ const nx=node([lerp(a[0],b[0],q/m),lerp(a[1],b[1],q/m)]); rnAddEdge(R,pv,nx,c); pv=nx; } } };
      lay(r.dep,3); lay(r.arr,2); for(const l of r.links.slice(0,4)) lay(l,2);
      lay([[-4.95,1.5],[-4.45,1.5],[0,1.5],[4.45,1.5],[4.95,1.5]],3); const g=r.at(0,1.72), c0=node([0,1.5]); rnLink(R,c0,g[0],g[1],3,0.3); n++; } }
  finally{ rnAirOK=false; } if(n) R.ver++; return n; }
function keepRects(){ const key=(G.fac2||[]).length+'|'+(G.projects||[]).length+'|'+G.rail.length+'|'+(G.rn?1:0); if(G._keepK===key) return G._keep; const out=[];
  for(const st of [G.fac.station,...(G.fac2||[]).filter(f=>f.t==='rail')]){ const q=railSite(st), ca=Math.cos(q.a), sa=Math.sin(q.a); out.push({x:q.x-sa*q.sd*0.07,y:q.y+ca*q.sd*0.07,hx:ca,hy:sa,hl:0.86,hw:0.27}); }
  if(G.rn) for(const co of [G.fac.coach,...(G.fac2||[]).filter(f=>f.t==='coach')]){ const q=coachSite(co); out.push({x:q.x,y:q.y,hx:Math.cos(q.a),hy:Math.sin(q.a),hl:0.3,hw:0.18}); }
  for(const p of (G.projects||[])){ projSite(p); out.push({x:p.px,y:p.pz,hx:1,hy:0,hl:0.4,hw:0.4}); }
  G._keepK=key; return G._keep=out; }
function keepAt(x,y,m){ for(const q of keepRects()){ const dx=x-q.x, dy=y-q.y; if(Math.abs(dx*q.hx+dy*q.hy)<q.hl+(m||0)&&Math.abs(-dx*q.hy+dy*q.hx)<q.hw+(m||0)) return true; } return false; }
function keepHitSeg(ax,ay,bx,by){ const K=keepRects(); if(!K.length) return false; const l=Math.hypot(bx-ax,by-ay), n=Math.max(1,Math.ceil(l/0.06)); for(const q of K){ if(Math.min(ax,bx)>q.x+1.2||Math.max(ax,bx)<q.x-1.2||Math.min(ay,by)>q.y+1.2||Math.max(ay,by)<q.y-1.2) continue; for(let k=0;k<=n;k++){ const x=ax+(bx-ax)*k/n, y=ay+(by-ay)*k/n, dx=x-q.x, dy=y-q.y; if(Math.abs(dx*q.hx+dy*q.hy)<q.hl&&Math.abs(-dx*q.hy+dy*q.hx)<q.hw) return true; } } return false; }
function facName(f){ return {k:f.t==='rail'?(f.v?'rail2b':'rail2'):f.t==='coach'?'coach2':'air2',s:f.s,d:f.d}; }
function facPoint(f){ return f.t==='air'?f.term:f; }
function checkFacilities(lv){
  G.fac2=G.fac2||[]; const has=t=>G.fac2.filter(f=>f.t===t).length, made=[];
  const want=[['rail',lv>=3&&has('rail')<1||lv>=5&&has('rail')<2],['coach',lv>=3&&has('coach')<1||lv>=5&&has('coach')<2],['air',(has('air')<1&&(lv>=5||G.popTotal>=growth.pop0*1.5))||(has('air')<2&&(lv>=6||G.popTotal>=growth.pop0*2.2))]];
  for(const [t,ok] of want){ if(!ok||made.length) continue; const f=t==='rail'?siteRail():t==='coach'?siteCoach():siteAirport(); if(!f) continue;
    if(t==='rail'&&G.fac2.some(o=>o.t==='rail'&&o.d===f.d)) f.v=1;
    G.fac2.push(f); if(t==='air'){ airportClear(f); rnPruneAir(); } else { rnPruneAir(); facAccess(); } const pt=facPoint(f); boostJobs(pt.x,pt.y,t==='air'?0.7:t==='rail'?0.35:0.2);
    if(t==='air') routeRoad(airGate(f),G.centers[0],'hwy'); else { const p=nearestPlace(pt.x,pt.y); if(p&&dist(p.x,p.y,pt.x,pt.y)>6) routeRoad(pt,p,'art'); }
    made.push(f); }
  return made;
}
