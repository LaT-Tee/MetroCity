/* ================= network state ================= */
let G=null, stations=[], lines=[], nextSid=1, nextLineNum=1, activeLineId=null, undoStack=[], redoStack=[], netVersion=0;
let sim=null, baseline=null, growth=null, months=0;
const lineById=id=>lines.find(l=>l.id===id);
const stById=id=>stations.find(s=>s.id===id);
function isDark(){ return typeof document!=='undefined' && getComputedStyle(document.documentElement).colorScheme.includes('dark'); }
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
function totalCost(){ let c=stations.length*ST_COST; for(const L of lines){ ensurePaths(L); let lc=0; for(const p of L.paths) lc+=pathCost(p); c+=lc*(1+0.12*(L.svc||0)); } return c; }
function lineLength(L){ ensurePaths(L); return L.paths.reduce((s,p)=>s+plen(p),0); }

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
function newStation(x,y){ const s={id:nextSid++,x:Math.round(x*100)/100,y:Math.round(y*100)/100}; s.name=nameStation(x,y); stations.push(s); return s; }
function activeLineCount(){ return lines.filter(l=>l.stops.length>=2).length; }
function newLine(){
  const num=nextLineNum++; const usedC=new Set(lines.map(l=>l.ci)); let ci=(num-1)%LINE_COLORS.length;
  if(usedC.has(ci)){ for(let k=0;k<LINE_COLORS.length;k++){ if(!usedC.has(k)){ ci=k; break; } } }
  const L={id:'L'+num+'_'+Math.floor(Math.random()*1e6).toString(36),num,ci,stops:[],paths:[],loop:false}; lines.push(L); lines.sort((a,b)=>a.num-b.num); return L;
}
function cleanup(){
  lines=lines.filter(L=>L.stops.length>=2||L.id===activeLineId);
  lines.forEach(L=>{ if(L.loop&&L.stops.length<3){ L.loop=false; } ensurePaths(L); });
  const used=new Set(); lines.forEach(L=>L.stops.forEach(id=>used.add(id)));
  stations=stations.filter(s=>used.has(s.id));
}
const jsonRep=(k,v)=>k==='_path'?undefined:v;
function snapshot(){ return JSON.stringify({stations,lines,nextSid,nextLineNum,activeLineId},jsonRep); }
function restore(js){ const o=JSON.parse(js); stations=o.stations; lines=o.lines; nextSid=o.nextSid; nextLineNum=o.nextLineNum; activeLineId=o.activeLineId; }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length>120) undoStack.shift(); redoStack=[]; }
