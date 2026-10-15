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
    if(!ok) continue; const sc=-popAround(x,y,8)/1e4+R()*2; if(sc>bs){ bs=sc; best={x,y,a}; } }
  if(!best) return null; const p=nearestPlace(best.x,best.y);
  let term={x:best.x-Math.sin(best.a)*5.5,y:best.y+Math.cos(best.a)*5.5}; if(G.water[Math.round(term.y)*W+Math.round(term.x)]) term={x:best.x+Math.sin(best.a)*5.5,y:best.y-Math.cos(best.a)*5.5};
  return {t:'air',x:best.x,y:best.y,a:best.a,term,s:p.name.s};
}
function facName(f){ return {k:f.t==='rail'?(f.v?'rail2b':'rail2'):f.t==='coach'?'coach2':'air2',s:f.s,d:f.d}; }
function facPoint(f){ return f.t==='air'?f.term:f; }
function checkFacilities(lv){
  G.fac2=G.fac2||[]; const has=t=>G.fac2.filter(f=>f.t===t).length, made=[];
  const want=[['rail',lv>=3&&has('rail')<1||lv>=5&&has('rail')<2],['coach',lv>=3&&has('coach')<1||lv>=5&&has('coach')<2],['air',(has('air')<1&&(lv>=5||G.popTotal>=growth.pop0*1.5))||(has('air')<2&&(lv>=6||G.popTotal>=growth.pop0*2.2))]];
  for(const [t,ok] of want){ if(!ok||made.length) continue; const f=t==='rail'?siteRail():t==='coach'?siteCoach():siteAirport(); if(!f) continue;
    if(t==='rail'&&G.fac2.some(o=>o.t==='rail'&&o.d===f.d)) f.v=1;
    G.fac2.push(f); const pt=facPoint(f); boostJobs(pt.x,pt.y,t==='air'?0.7:t==='rail'?0.35:0.2);
    if(t==='air') routeRoad(pt,G.centers[0],'hwy'); else { const p=nearestPlace(pt.x,pt.y); if(p&&dist(p.x,p.y,pt.x,pt.y)>6) routeRoad(pt,p,'art'); }
    made.push(f); }
  return made;
}
