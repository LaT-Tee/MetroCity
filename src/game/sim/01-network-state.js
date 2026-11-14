/* ================= network state ================= */
let G=null, stations=[], lines=[], nextSid=1, nextLineNum=1, activeLineId=null, undoStack=[], redoStack=[], netVersion=0;
let sim=null, baseline=null, growth=null, months=0;
const lineById=id=>lines.find(l=>l.id===id);
const stById=id=>stations.find(s=>s.id===id);
// asked many times a frame, so the answer is kept until the theme changes (reading computed style is not free)
let darkC=null;
function isDark(){ if(darkC==null) darkC=typeof document!=='undefined' && getComputedStyle(document.documentElement).colorScheme.includes('dark'); return darkC; }
function lineColor(L){ const c=LINE_COLORS[L.ci]; return (L.ci===18&&isDark())?'#9b6fe0':c; }

/* geometry */
function plen(pts){ let d=0; for(let i=1;i<pts.length;i++) d+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); return d; }
function wetFrac(pts){ let wet=0,tot=0; for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i], k=Math.max(1,Math.ceil(dist(a[0],a[1],b[0],b[1])));
  for(let j=0;j<k;j++){ const tt=j/k, x=Math.round(lerp(a[0],b[0],tt)), y=Math.round(lerp(a[1],b[1],tt)); tot++; if(x>=0&&y>=0&&x<W&&y<H&&G.water[y*W+x]) wet++; } } return tot?wet/tot:0; }
function pathCost(pts){ return plen(pts)*TRACK_COST*(1+1.6*wetFrac(pts)); }
function smoothPath(raw,a,b){
  let pts=[[a.x,a.y]];
  for(const p of raw){ const l=pts[pts.length-1]; if(dist(p[0],p[1],l[0],l[1])>=0.8) pts.push([p[0],p[1]]); }
  const l=pts[pts.length-1]; if(pts.length>1&&dist(l[0],l[1],b.x,b.y)<0.8) pts[pts.length-1]=[b.x,b.y]; else pts.push([b.x,b.y]);
  if(pts.length<3) return [[a.x,a.y],[b.x,b.y]];
  pts=rdp(chaikin(pts,3),0.06); pts[0]=[a.x,a.y]; pts[pts.length-1]=[b.x,b.y];
  return pts.map(p=>[Math.round(p[0]*100)/100,Math.round(p[1]*100)/100]);
}
function catmullSeg(p0,p1,p2,p3,k){ const o=[]; for(let i=0;i<=k;i++){ const tt=i/k,t2=tt*tt,t3=t2*tt; const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*tt+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3); o.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]); } return o; }
const isRapid=L=>L&&L.kind==='rapid', lineV=L=>isRapid(L)?RAPID_V:METRO_V, lineWait=L=>isRapid(L)?RAPID_WAIT:WAIT, lineDwell=L=>isRapid(L)?RAPID_DWELL:DWELL;
function segCount(L){ return L.stops.length<2?0:(L.loop?L.stops.length:L.stops.length-1); }
function smoothThrough(L){
  const s=L.stops.map(stById).map(p=>[p.x,p.y]), n=s.length;
  const P=i=>L.loop?s[((i%n)+n)%n]:s[clamp(i,0,n-1)];
  L.paths=[]; for(let i=0;i<segCount(L);i++){ const p1=P(i),p2=P(i+1); L.paths.push(catmullSeg(P(i-1),p1,p2,P(i+2),Math.max(2,Math.ceil(dist(p1[0],p1[1],p2[0],p2[1])/1.5)))); }
}
function ensurePaths(L){ if(!L.paths||L.paths.length!==segCount(L)){ L.paths=[]; const s=L.stops.map(stById); for(let i=0;i<segCount(L);i++){ const a=s[i],b=s[(i+1)%s.length]; L.paths.push([[a.x,a.y],[b.x,b.y]]); } } }
function reverseLine(L){ ensurePaths(L); const n=L.stops.length, old=L.paths; L.stops.reverse(); if(n<2){ L.paths=[]; return; } const np=[]; for(let j=0;j<segCount(L);j++) np.push(old[((n-2-j)%n+n)%n].slice().reverse()); L.paths=np; }
function removeStop(L,k){
  ensurePaths(L); const n=L.stops.length;
  if(L.loop){ const prev=(k-1+n)%n; L.paths[prev]=L.paths[prev].concat(L.paths[k].slice(1)); L.paths.splice(k,1); L.stops.splice(k,1); if(L.stops.length<3){ L.loop=false; L.paths.pop(); } return; }
  if(n<=1){ L.stops=[]; L.paths=[]; return; }
  if(k===0){ L.stops.shift(); L.paths.shift(); } else if(k===n-1){ L.stops.pop(); L.paths.pop(); }
  else { L.paths.splice(k-1,2,L.paths[k-1].concat(L.paths[k].slice(1))); L.stops.splice(k,1); }
}
function linePathPts(L){ ensurePaths(L); const o=[]; L.paths.forEach((p,i)=>{ for(let j=i?1:0;j<p.length;j++) o.push(p[j]); }); return o; }
function totalCost(){ let c=stations.length*ST_COST; for(const L of lines){ ensurePaths(L); let lc=0; for(const p of L.paths) lc+=pathCost(p); c+=lc*(1+0.12*(L.svc||0))*(isRapid(L)?RAPID_COST:1); } return c; }
function lineLength(L){ ensurePaths(L); return L.paths.reduce((s,p)=>s+plen(p),0); }

/* ---------- underground and elevated ----------
   Under the dense centre the metro runs in tunnel; further out it comes up a ramp and carries on on viaduct. The level
   follows the city (so a line dives as the centre grows): a stretch is underground where the density above it is high,
   short daylight gaps are closed, dives too short to be worth it are dropped, and every station sits level. */
const UG_D=0.5, UG_RAMP=1.3;
function densify(pts,step){ const o=[pts[0]]; for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], m=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step)); for(let q=1;q<=m;q++) o.push([a[0]+(b[0]-a[0])*q/m,a[1]+(b[1]-a[1])*q/m]); } return o; }
function lineLevels(L){
  const key=netVersion+'|'+Math.floor(months/12)+'|'+G.seed+'|'+(G.fac2||[]).length+'|'+(G.projects||[]).length; if(L._lvK===key&&L._lv) return L._lv;
  ensurePaths(L); const pts=densify(linePathPts(L),0.5), n=pts.length, cum=new Float64Array(n), ug=new Uint8Array(n);
  for(let i=1;i<n;i++) cum[i]=cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  // under an airfield, a main-line station or a coach station the metro is always in tunnel: it arrives beneath the building, it does not run through it
  const fz=[[G.fac.airport.x,G.fac.airport.y,12.5],[G.fac.airport.term.x,G.fac.airport.term.y,6.5],[G.fac.station.x,G.fac.station.y,3.4],[G.fac.coach.x,G.fac.coach.y,2.8]];
  for(const f of (G.fac2||[])){ if(f.t==='air'){ fz.push([f.x,f.y,12.5],[f.term.x,f.term.y,6.5]); } else fz.push([f.x,f.y,f.t==='rail'?3.4:2.8]); }
  // nor through a development: under its plot the metro is in tunnel (a station there is entered from the development itself)
  for(const p of (G.projects||[])){ const q=projSite(p); fz.push([q.px,q.pz,2.0]); }      /* the plot, and room for the ramps either side to be underground by the time they reach it */
  const inFac=q=>{ for(const z of fz) if(Math.abs(q[0]-z[0])<z[2]&&Math.abs(q[1]-z[1])<z[2]&&(q[0]-z[0])**2+(q[1]-z[1])**2<z[2]*z[2]) return true; return false; }, forced=new Uint8Array(n);
  for(let i=0;i<n;i++){ const c=clamp(Math.round(pts[i][1]),0,H-1)*W+clamp(Math.round(pts[i][0]),0,W-1); forced[i]=inFac(pts[i])?1:0; ug[i]=forced[i]?1:G.water[c]?(i?ug[i-1]:0):G.D[c]>=UG_D?1:0; }
  const runs=()=>{ const r=[]; let a=0; for(let i=1;i<=n;i++) if(i===n||ug[i]!==ug[a]){ r.push([a,i-1,ug[a]]); a=i; } return r; };
  for(const [a,b,v] of runs()) if(!v&&a>0&&b<n-1&&cum[b]-cum[a]<5) ug.fill(1,a,b+1);
  for(const [a,b,v] of runs()) if(v&&cum[b]-cum[a]<4){ let f=false; for(let i=a;i<=b;i++) if(forced[i]){ f=true; break; } if(!f) ug.fill(0,a,b+1); }
  // stations: level for the length of the platforms and a little more
  const sU=[0]; L.paths.forEach((q,i)=>sU.push(sU[i]+plen(q))); const at=u=>{ let lo=0, hi=n-1; while(lo<hi){ const m=(lo+hi)>>1; if(cum[m]<u) lo=m+1; else hi=m; } return lo; };
  for(const u of sU){ const k=at(u), v=ug[k]; for(let i=at(u-1.6);i<n&&cum[i]<=u+1.6;i++) ug[i]=v||forced[i]; }
  const bd=[]; for(let i=1;i<n;i++) if(ug[i]!==ug[i-1]) bd.push((cum[i]+cum[i-1])/2);
  /* A ramp (from the viaduct down into the tunnel or up out of it) runs UG_RAMP either side of where the line changes level.
     It never lies across a street or the railway: the change is moved along the line, a little at a time either way, to
     the nearest place where the whole ramp is clear of both, and not into a station's platforms. */
  if(bd.length&&G.rn){ const onRail=(x,y)=>railDist(x,y)<0.16,
      blocked=b=>{ for(let u=b-UG_RAMP*0.55;u<=b+UG_RAMP*0.55;u+=0.08){      /* only where the track is too low for a street beneath and not yet covered: the middle of the ramp */ if(u<0||u>cum[n-1]) continue; const i=Math.min(n-1,at(u)), q=pts[i]; const h=rnNearEdge(G.rn,q[0],q[1],0.3); if(h&&h.d<ROAD_W[G.rn.ec[h.e]]/2+0.045) return true; if(onRail(q[0],q[1])) return true; } return false; }, nearSt=b=>sU.some(u=>Math.abs(u-b)<UG_RAMP+0.55);
    for(let k=0;k<bd.length;k++){ if(!blocked(bd[k])) continue; let best=null; for(let s=0.25;s<=9;s+=0.25){ for(const sg of [1,-1]){ const b=bd[k]+sg*s; if(b<UG_RAMP||b>cum[n-1]-UG_RAMP||nearSt(b)||bd.some((o,j)=>j!==k&&Math.abs(o-b)<2*UG_RAMP)) continue; if(!blocked(b)){ best=b; break; } } if(best!=null) break; }
      if(best==null) continue; const a0=Math.min(bd[k],best), a1=Math.max(bd[k],best), v=ug[Math.min(n-1,at(bd[k]+(best>bd[k]?-0.2:0.2)))]; for(let i=at(a0);i<n&&cum[i]<=a1;i++) ug[i]=v; bd[k]=best; } }
  const dep=new Float32Array(n); for(let i=0;i<n;i++){ let m=1e9; for(const b of bd) m=Math.min(m,Math.abs(cum[i]-b)); dep[i]=bd.length?smooth(ug[i]?m:-m,-UG_RAMP,UG_RAMP):ug[i]; }
  L._lvK=key; return L._lv={pts,cum,ug,dep,bd,sU,len:cum[n-1],any:ug.some(v=>v)}; }
// how deep the line is at distance u along it: 0 on the viaduct, 1 in the tunnel, in between on the ramps
function levelDep(lv,u){ const c=lv.cum, n=c.length; if(u<=0) return lv.dep[0]; if(u>=c[n-1]) return lv.dep[n-1]; let lo=1, hi=n-1; while(lo<hi){ const m=(lo+hi)>>1; if(c[m]<u) lo=m+1; else hi=m; }
  const f=(u-c[lo-1])/((c[lo]-c[lo-1])||1); return lv.dep[lo-1]+(lv.dep[lo]-lv.dep[lo-1])*f; }
function stationUnder(st){ for(const L of lines){ const k=L.stops.indexOf(st.id); if(k<0||L.stops.length<2) continue; const lv=lineLevels(L); if(levelDep(lv,lv.sU[Math.min(k,lv.sU.length-1)])>0.5) return true; } return false; }
function nameStation(x,y){
  const used=new Set(); stations.forEach(st=>{ if(st.name) nameKey(st.name).split('|').forEach(v=>used.add(v)); });
  const F=G.fac, free=o=>!nameKey(o).split('|').some(v=>used.has(v)), tryN=o=>free(o)?o:null;
  if(dist(x,y,F.airport.term.x,F.airport.term.y)<6){ const r=tryN({k:'st_airport'})||tryN({k:'st_airport2'}); if(r) return r; }
  if(dist(x,y,F.station.x,F.station.y)<3.5){ const r=tryN({k:'st_rail'}); if(r) return r; }
  if(dist(x,y,F.coach.x,F.coach.y)<3){ const r=tryN({k:'st_coach'}); if(r) return r; }
  for(const f of (G.fac2||[])){ const pt=facPoint(f); if(dist(x,y,pt.x,pt.y)<(f.t==='air'?6:3.5)){ const r=tryN(facName(f)); if(r) return r; } }
  for(const p of (G.projects||[])) if(dist(x,y,p.x,p.y)<3){ const r=tryN(projName(p)); if(r) return r; }
  for(const c of G.centers) if(dist(x,y,c.x,c.y)<3){ const r=tryN(c.name); if(r) return r; }
  for(const p of [...G.plazas,...G.inds]) if(dist(x,y,p.x,p.y)<3.5){ const r=tryN(p.name); if(r) return r; }
  for(const v of G.villages) if(dist(x,y,v.x,v.y)<4){ const r=tryN({s:v.name.s,k:'plain'}); if(r) return r; }
  // what is actually here decides which kinds of names make sense
  const T=terrainAt(x,y,G.water,G.e), i=clamp(Math.round(y),0,H-1)*W+clamp(Math.round(x),0,W-1), park=smooth(G.pk[i],0.2,0.3)>0.5;
  let shore=false; for(let dy=-3;dy<=3&&!shore;dy++) for(let dx=-3;dx<=3;dx++){ const xx=Math.round(x)+dx, yy=Math.round(y)+dy; if(xx>=0&&yy>=0&&xx<W&&yy<H&&G.water[yy*W+xx]===1&&dx*dx+dy*dy<=9){ shore=true; break; } }
  let riverside=false; for(let dy=-2;dy<=2&&!riverside;dy++) for(let dx=-2;dx<=2;dx++){ const xx=Math.round(x)+dx, yy=Math.round(y)+dy; if(xx>=0&&yy>=0&&xx<W&&yy<H&&G.water[yy*W+xx]===2){ riverside=true; break; } }
  const kinds=['street','avenue','gate','cross','plain','green'];
  if(shore) kinds.unshift('harbor','bay'); if(riverside||shore) kinds.unshift('bridge'); if(park) kinds.unshift('park','green'); if(T==='hill') kinds.unshift('hill');
  const hsh=(Math.imul(Math.floor(x*5),73856093)^Math.imul(Math.floor(y*5),19349663))>>>0;
  // borrow the nearest district's name, but only for a couple of stations, and with the compass direction that is true
  let near=null, nd=1e9; for(const d of G.districts){ if(d.name.s==null) continue; const dd=dist(x,y,d.x,d.y); if(dd<nd){ nd=dd; near=d; } }
  if(near&&nd<16){
    const same=stations.filter(st=>st.name&&st.name.s===near.name.s&&dist(st.x,st.y,near.x,near.y)<20).length;
    if(same<2){
      const ang=Math.atan2(y-near.y,x-near.x), dir=(nd<3||/[东西南北]/.test(rootName(near.name.s,'zh')))?null:ang>-Math.PI/4&&ang<=Math.PI/4?'east':ang>Math.PI/4&&ang<=3*Math.PI/4?'south':(ang>3*Math.PI/4||ang<=-3*Math.PI/4)?'west':'north';
      const rest=kinds.filter(k=>k!=='plain'), order=[...(nd<3?['plain']:[]),...(dir?[dir]:[]),...rest.map((_,k)=>rest[(k+hsh)%rest.length])];
      for(const kk of order){ const o={s:near.name.s,k:kk}; if(free(o)) return o; }
    }
  }
  // otherwise a new local name that suits the ground (no "harbour" inland, no "hill" on the flat)
  for(let tr=0;tr<600;tr++){
    const sd=hashInt(hsh*13+tr*7919); if(tr<500&&!rootFits(sd,T)) continue;
    const k=kinds[hashInt(hsh+tr*31)%kinds.length], o={s:sd,k}; if(free(o)) return o;
  }
  return {s:hashInt(stations.length*104729+7),k:'street'};
}
// A station stands on dry land: one asked for at the water's edge is put a little inland.
const ST_DRY=0.3;
function newStation(x,y){ { const d=dryNear(x,y,ST_DRY,6); if(d){ x=d[0]; y=d[1]; } } const s={id:nextSid++,x:Math.round(x*100)/100,y:Math.round(y*100)/100}; s.name=nameStation(x,y); stations.push(s); return s; }
function activeLineCount(){ return lines.filter(l=>l.stops.length>=2).length; }
function newLine(){
  const num=nextLineNum++; const usedC=new Set(lines.map(l=>l.ci)); let ci=(num-1)%LINE_COLORS.length;
  if(usedC.has(ci)){ for(let k=0;k<LINE_COLORS.length;k++){ if(!usedC.has(k)){ ci=k; break; } } }
  const L={id:'L'+num+'_'+Math.floor(Math.random()*1e6).toString(36),num,ci,stops:[],paths:[],loop:false}; lines.push(L); lines.sort((a,b)=>a.num-b.num); return L;
}
// stations from an older save (or left at the water's edge by a change of the map) are moved ashore, their lines with them
function dryStations(){ if(!G||!G.h) return 0; let n=0; for(const st of stations){ if(waterSD(st.x,st.y)>=ST_DRY-0.05) continue; const d=dryNear(st.x,st.y,ST_DRY,8); if(!d) continue; const ox=st.x, oy=st.y; st.x=Math.round(d[0]*100)/100; st.y=Math.round(d[1]*100)/100; n++;
    for(const L of lines){ if(!L.paths||!L.stops.includes(st.id)) continue; for(const p of L.paths){ for(const e of [p[0],p[p.length-1]]) if(e&&Math.abs(e[0]-ox)<0.02&&Math.abs(e[1]-oy)<0.02){ e[0]=st.x; e[1]=st.y; } } } } return n; }
function cleanup(){
  dryStations();
  lines=lines.filter(L=>L.stops.length>=2||L.id===activeLineId);
  lines.forEach(L=>{ if(L.loop&&L.stops.length<3){ L.loop=false; } ensurePaths(L); });
  const used=new Set(); lines.forEach(L=>L.stops.forEach(id=>used.add(id)));
  stations=stations.filter(s=>used.has(s.id));
}
const jsonRep=(k,v)=>k==='_path'?undefined:v;
function snapshot(){ return JSON.stringify({stations,lines,nextSid,nextLineNum,activeLineId},jsonRep); }
function restore(js){ const o=JSON.parse(js); stations=o.stations; lines=o.lines; nextSid=o.nextSid; nextLineNum=o.nextLineNum; activeLineId=o.activeLineId; }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length>120) undoStack.shift(); redoStack=[]; }
