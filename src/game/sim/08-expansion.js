/* ================= open area, growing places, expansion ================= */
const inB=(x,y,m)=>{ const B=G.bounds; m=m||0; return x>=B[0]+m&&y>=B[1]+m&&x<B[2]-m&&y<B[3]-m; };
function popIn(){ const B=G.bounds; let s=0; for(let y=B[1];y<B[3];y++){ const o=y*W; for(let x=B[0];x<B[2];x++) s+=G.D[o+x]; } return s; }
const TIER_KIND=['village','town','newcity','core'], TIER_POP=[0,2e4,6e4,1.6e5];
function tierOf(p){ const k=p.name.k; return k==='village'?0:k==='town'?1:(k==='newtown'||k==='newcity'||k==='born')?2:k==='core'?3:0; }
function popAround(x,y,r){ let s=0; for(let yy=Math.max(0,Math.floor(y-r));yy<=Math.min(H-1,Math.ceil(y+r));yy++) for(let xx=Math.max(0,Math.floor(x-r));xx<=Math.min(W-1,Math.ceil(x+r));xx++) if((xx-x)**2+(yy-y)**2<=r*r) s+=G.D[yy*W+xx]; return s*900; }
function boostJobs(x,y,a,record){
  const sg=5, R3=16; for(let yy=Math.max(0,Math.floor(y-R3));yy<=Math.min(H-1,Math.ceil(y+R3));yy++) for(let xx=Math.max(0,Math.floor(x-R3));xx<=Math.min(W-1,Math.ceil(x+R3));xx++){ const i=yy*W+xx; if(G.water[i]) continue; growth.J0[i]+=a*Math.exp(-((xx-x)**2+(yy-y)**2)/(2*sg*sg)); }
  if(record!==false) growth.boosts.push([Math.round(x*10)/10,Math.round(y*10)/10,a]);
}
function servedNear(x,y,r){ return stations.some(st=>(st.x-x)**2+(st.y-y)**2<r*r&&lines.some(L=>L.stops.length>=2&&L.stops.includes(st.id))); }
function allPlaces(){ return [...G.centers,...G.plazas,...G.inds,...G.villages]; }
function freshSeed(x,y){
  const used=new Set(); [...allPlaces(),...(G.projects||[]).map(p=>({name:{s:p.s}}))].forEach(p=>{ if(p.name&&p.name.s!=null) ['zh','en','ja'].forEach(l=>used.add(rootName(p.name.s,l))); });
  const T=terrainAt(x,y,G.water,G.e);
  for(let k=0;k<600;k++){ const sd=hashInt(Math.floor(x*13)*7919+Math.floor(y*13)*104729+k*7717); if(k<450&&!rootFits(sd,T)) continue; if(!['zh','en','ja'].some(l=>used.has(rootName(sd,l)))) return sd; }
  return hashInt(Math.floor(x)+Math.floor(y)*977);
}
// settlements climb tiers as people arrive; brand-new districts appear where crowds form with no name yet
function evolvePlaces(){
  const ev=[];
  for(const p of [...G.villages,...G.centers.filter(c=>c.type==='sub'||c.type==='twin')]){
    if(!inB(p.x,p.y)) continue;
    p.age=(p.age||0)+1; if(p.age<12) continue;                       // at most one step per game year
    const t=tierOf(p), pop=popAround(p.x,p.y,9); let nt=t;
    if(t>=1&&!servedNear(p.x,p.y,16)) continue;                       // villages grow into towns by themselves; beyond that needs the metro
    if(t<TIER_KIND.length-1&&pop>=TIER_POP[t+1]) nt=t+1;
    if(nt>t){ p.age=0; const from={...p.name}; p.name={s:p.name.s,k:TIER_KIND[nt]}; boostJobs(p.x,p.y,[0,0.12,0.3,0.6][nt]); ev.push({type:'up',from,to:p.name,x:p.x,y:p.y,tier:nt}); if(ev.length>=2) break; }
  }
  const BK=12, B=G.bounds; let best=null;
  for(let by=B[1];by<B[3]-BK;by+=BK) for(let bx=B[0];bx<B[2]-BK;bx+=BK){
    let sm=0,sx=0,sy=0; for(let y=by;y<by+BK;y++) for(let x=bx;x<bx+BK;x++){ const d=G.D[y*W+x]; sm+=d; sx+=d*x; sy+=d*y; }
    if(sm*900<5e4) continue; const cx=sx/sm, cy=sy/sm;
    if(allPlaces().some(p=>dist(p.x,p.y,cx,cy)<13)) continue;
    if(!servedNear(cx,cy,18)&&!(growth.roadAcc&&growth.roadAcc[Math.round(cy)*W+Math.round(cx)]>0.5)) continue;
    if(!best||sm>best.sm) best={sm,cx,cy};
  }
  if(best){ const p={x:best.cx,y:best.cy,name:{s:freshSeed(best.cx,best.cy),k:'born'},s:3,w:0,ang:0,born:true,age:0}; G.villages.push(p); boostJobs(p.x,p.y,0.3); ev.push({type:'new',to:p.name,x:p.x,y:p.y,tier:2}); }
  return ev;
}
function placeState(){ const nb=G.villages.filter(v=>!v.born).length; return {fac2:G.fac2||[], roads:[], rn:G.rn?rnEncode(G.rn):null, ra:G.roadsAdded||0, dq:encodeD(), v:G.villages.slice(0,nb).map(v=>v.name.k), born:G.villages.filter(v=>v.born).map(v=>[Math.round(v.x*10)/10,Math.round(v.y*10)/10,v.name.s,v.name.k]), c:G.centers.map(c=>c.name.k), boosts:growth.boosts, pj:(G.projects||[]).map(p=>[p.t,p.x,p.y,p.s,p.m0,p.done?1:0]), lp:G.lastProj||0}; }
function applyPlaceState(ps){
  if(!ps) return;
  (ps.v||[]).forEach((k,i)=>{ if(G.villages[i]) G.villages[i].name.k=k; });
  (ps.born||[]).forEach(([x,y,sd,k])=>G.villages.push({x,y,name:{s:sd,k},s:3,w:0,ang:0,born:true}));
  (ps.c||[]).forEach((k,i)=>{ if(G.centers[i]) G.centers[i].name.k=k; });
  (ps.boosts||[]).forEach(([x,y,a])=>boostJobs(x,y,a));
  if(ps.rn){ try{ G.rn=rnDecode(ps.rn); }catch(e){ G.rn=null; } } G.roadsAdded=ps.ra||0;
  if(ps.dq){ try{ const D=decodeD(ps.dq); if(D){ G.D.set(D); for(let i=0;i<W*H;i++) G.J[i]=growth.J0[i]+0.45*Math.max(0,G.D[i]-growth.D0[i]); G.popTotal=popIn()*900; G.dRestored=true; } }catch(e){} }
  if(!G.rn) (ps.roads||[]).forEach(([c,flat])=>{ const p=[]; for(let k=0;k<flat.length;k+=2) p.push([flat[k],flat[k+1]]); G.extraRoads.push({c:c===2?'hwy':c?'art':'loc',p}); markRoad(p,c+1); });
  G.fac2=(ps.fac2||[]).slice();
  G.projects=(ps.pj||[]).map(([t,x,y,s,m0,d])=>({t,x,y,s,m0,done:!!d})); G.lastProj=ps.lp||0;
}
function setStage(stage){
  const prev=G.bounds.slice(); G.stage=stage; G.bounds=STAGES[stage].slice();
  let added=0; const B=G.bounds; for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++) if(!(x>=prev[0]&&x<prev[2]&&y>=prev[1]&&y<prev[3])) added+=growth.D0[y*W+x];
  growth.pop0+=added*900; G.popTotal=popIn()*900;
  G.agents=buildAgents(G,B,STAGE_AGENTS[stage],mulberry32(G.seed*31+stage));
  if(G.rn) rnFill(G.rn,mulberry32(G.seed*59+stage));
}
function nearEdgeStations(){ const B=G.bounds; return stations.filter(s=>s.x-B[0]<20||B[2]-s.x<20||s.y-B[1]<16||B[3]-s.y<16).length; }
function canExpand(){ if(G.stage>=STAGES.length-1||!sim) return false; return cityLevel(sim.riders)>=2+G.stage||(nearEdgeStations()>=2&&activeLineCount()>=2); }
