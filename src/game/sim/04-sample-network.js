/* ================= sample network ================= */
function autoPlan(){
  stations=[]; lines=[]; nextSid=1; nextLineNum=1; activeLineId=null;
  const F=G.fac, M=G.centers[0], subs=G.centers.slice(1);
  const landNear=(x,y)=>{ for(let r=0;r<=3;r+=0.75) for(let a=0;a<6.28;a+=0.8){ const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; const i=Math.round(py)*W+Math.round(px); if(px>=1&&py>=1&&px<W-1&&py<H-1&&G.water[i]===0) return {x:px,y:py}; if(r===0) break; } return null; };
  const mirror=(p,c,f)=>landNear(clamp(c.x+(c.x-p.x)*f,3,W-3),clamp(c.y+(c.y-p.y)*f,3,H-3));
  const plans=[], sorted=subs.map(s=>({s,a:Math.atan2(s.y-M.y,s.x-M.x)})), usedSub=new Set();
  if(sorted.length>=2){
    let best=null,bd=-1; for(const o of sorted.slice(1)){ const df=Math.abs(angDiff(sorted[0].a,o.a)); if(df>bd){bd=df;best=o;} }
    plans.push({wps:[sorted[0].s,{x:M.x+1.5,y:M.y-1},best.s]}); usedSub.add(sorted[0].s); usedSub.add(best.s);
  }
  for(const o of sorted) if(!usedSub.has(o.s)){ const m=mirror(o.s,M,0.9); plans.push({wps:m?[o.s,{x:M.x-1,y:M.y+1.5},m]:[o.s,M]}); }
  plans.push({wps:[F.airport.term,F.station,{x:M.x,y:M.y}],sp:11});
  plans.push({wps:[F.coach,{x:M.x+1,y:M.y+1},mirror(F.coach,M,1.1)||F.station]});
  const rr=Math.max(12,M.s*0.85), rp=[]; for(let k=0;k<12;k++){ const a=k*Math.PI/6, p={x:M.x+Math.cos(a)*rr,y:M.y+Math.sin(a)*rr}; if(p.x>2&&p.y>2&&p.x<W-2&&p.y<H-2&&G.water[Math.round(p.y)*W+Math.round(p.x)]===0) rp.push(p); }
  if(rp.length>=10) plans.push({wps:rp,loop:true,sp:6});
  for(const pl of plans){
    const L=newLine(), spc=pl.sp||8, wps=pl.loop?[...pl.wps,pl.wps[0]]:pl.wps;
    for(let w=0;w<wps.length-1;w++){
      const a=wps[w], b=wps[w+1], d=dist(a.x,a.y,b.x,b.y), k=Math.max(1,Math.round(d/spc));
      for(let q=(w===0?0:1);q<=k;q++){
        if(pl.loop&&w===wps.length-2&&q===k) break;
        const tt=q/k, p=landNear(lerp(a.x,b.x,tt),lerp(a.y,b.y,tt)); if(!p) continue;
        let s=stations.find(s=>dist(s.x,s.y,p.x,p.y)<3.2);
        if(s&&L.stops.includes(s.id)) continue;
        if(!s) s=newStation(p.x,p.y);
        L.stops.push(s.id);
      }
    }
    if(pl.loop&&L.stops.length>=3) L.loop=true;
    if(L.stops.length>=2) smoothThrough(L);
  }
  cleanup();
}
