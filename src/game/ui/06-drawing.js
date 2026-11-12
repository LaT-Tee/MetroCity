/* ---------- drawing ---------- */
let lastCamK='', upHard='', upSoft='', upAt=0, upStamp=0;
function drawLower(){
  screenT(); ctx.fillStyle=C.sea; ctx.fillRect(0,0,vw,vh);
  worldT(); ctx.imageSmoothingEnabled=true; ctx.drawImage(base,0,0,W,H);
  if(baseFadeAt){ const f=clamp((performance.now()-baseFadeAt)/1600,0,1); ctx.globalAlpha=f; ctx.drawImage(base2,0,0,W,H); ctx.globalAlpha=1; if(f>=1){ const tc=base, tx=bctx; base=base2; bctx=b2ctx; base2=tc; b2ctx=tx; baseFadeAt=0; layerVer++; } }
  const px=1/cam.s; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle=C['sea-shallow']; for(const r of P2.rivers){ ctx.lineWidth=Math.max(r.w,1.4*px); ctx.stroke(r.p); }
}
/* The city layer (streets, railway, airport, grounds, buildings) is the expensive one, so the screen never waits for it.
   It is painted into its own canvas, a little larger than the view, a few milliseconds a frame; every frame simply
   draws that picture moved and scaled to where the camera now is. Dragging and zooming therefore cost one image draw;
   a sharp repaint for the new view is made in the background and swapped in when it is ready. */
const CITY_M=0.22;
let cityC=null, cityI=null, cityJob=null, citySpare=null, cityEnd=0;
function cityStart(stamp){
  const mx=Math.round(vw*CITY_M), my=Math.round(vh*CITY_M), W2=vw+2*mx, H2=vh+2*my; let r=dpr; if(W2*H2*r*r>7.5e6) r=Math.sqrt(7.5e6/(W2*H2));
  const c=citySpare&&citySpare!==cityC?citySpare:document.createElement('canvas'), pw=Math.round(W2*r), ph=Math.round(H2*r); citySpare=null; if(c.width!==pw||c.height!==ph){ c.width=pw; c.height=ph; }
  const g=c.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,pw,ph);
  const J={c,g,x:cam.x,y:cam.y,s:cam.s,r,W2,H2,stamp,q:[],i:0}, hw=W2/2/cam.s, hh=H2/2/cam.s, view=[cam.x-hw,cam.y-hh,cam.x+hw,cam.y+hh];
  J.q.push(()=>{ worldT(); const px=1/cam.s; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.fillStyle=C.urban; ctx.fill(P2.apron); ctx.strokeStyle=C['arterial-edge']; ctx.lineWidth=px; ctx.stroke(P2.apron);
    ctx.fillStyle=C.runway; ctx.fill(P2.runways); ctx.fillStyle=C['ink-3']; ctx.fill(P2.terminal); });
  J.q.push(()=>{ worldT(); const px=1/cam.s; ctx.lineCap='round'; ctx.lineJoin='round';
    strokeRoads(ctx,px,{edge:C['arterial-edge'],core:C.arterial,hwy:C.highway},0,smooth(cam.s,1.3,3),'old',view);
    ctx.strokeStyle=C.rail; ctx.lineWidth=Math.max(0.7,2.6*px); ctx.stroke(P2.rail);
    ctx.setLineDash([Math.max(1,6*px),Math.max(1,6*px)]); ctx.strokeStyle=C.land; ctx.lineWidth=Math.max(0.35,1.2*px); ctx.stroke(P2.rail); ctx.setLineDash([]); });
  cityJob=J; }
// drawing is only recorded until someone looks at the canvas; reading one pixel's worth of it into a scratch canvas makes
// the browser do the work now, step by step, instead of all at once on the frame the finished picture is first shown
let cityScratch=null;
function cityFlush(c){ if(!cityScratch){ cityScratch=document.createElement('canvas'); cityScratch.width=cityScratch.height=1; } cityScratch.getContext('2d').drawImage(c,0,0,1,1,0,0,1,1); }
function cityRun(budget){
  const J=cityJob; if(!J) return; const t0=performance.now(), m=ctx, sv=[cam.x,cam.y,cam.s,vw,vh,dpr]; ctx=J.g; cam.x=J.x; cam.y=J.y; cam.s=J.s; vw=J.W2; vh=J.H2; dpr=J.r;
  try{ while(J.i<J.q.length){ const a=performance.now(); J.q[J.i++](); if(window.__mcProf&&performance.now()-a>12) window.__mcProf.push(['city',J.i-1,J.q.length,Math.round(performance.now()-a)]); if(performance.now()-t0>budget) break; } } finally { ctx=m; cam.x=sv[0]; cam.y=sv[1]; cam.s=sv[2]; vw=sv[3]; vh=sv[4]; dpr=sv[5]; }
  if(J.i>=J.q.length){ citySpare=cityC; cityC=J.c; cityI=J; cityJob=null; cityEnd=performance.now(); } }
function cityLayer(stamp,rest){
  const I=cityI, exact=I&&I.stamp===stamp&&I.x===cam.x&&I.y===cam.y&&I.s===cam.s&&I.W2===vw+2*Math.round(vw*CITY_M)&&I.H2===vh+2*Math.round(vh*CITY_M);
  if(!exact&&!cityJob){ const k=I?cam.s/I.s:0, hw=vw/2/cam.s, hh=vh/2/cam.s;
    const covered=I&&I.stamp===stamp&&cam.x-hw>=I.x-I.W2/2/I.s&&cam.x+hw<=I.x+I.W2/2/I.s&&cam.y-hh>=I.y-I.H2/2/I.s&&cam.y+hh<=I.y+I.H2/2/I.s&&k>0.72&&k<1.4;
    // at rest: make it sharp. On the move: only when the old picture no longer covers the view
    if(rest||!covered) cityStart(stamp); }
  if(cityJob) cityRun(!cityI?40:rest?7:4.5);
  if(cityC&&cityI){ const I2=cityI; worldT(); ctx.imageSmoothingEnabled=true; ctx.drawImage(cityC,I2.x-I2.W2/2/I2.s,I2.y-I2.H2/2/I2.s,I2.W2/I2.s,I2.H2/I2.s); } }
// Static layers are rendered once into screen-sized canvases and reused while the camera rests.
// A layer is cached on the second frame with the same key, so continuous panning never pays for the copy.
function cachedLayer(which,key,paint,canCache,rest){
  const isLo=which==='lo', cur=isLo?loKey:upKey, prev=isLo?prevLoKey:prevUpKey;
  if(isLo) prevLoKey=key; else prevUpKey=key;
  // with the camera at rest a changed layer goes straight into the cache, so it is painted once, not twice
  if(canCache&&(cur===key||prev===key||rest)){
    let c=isLo?sceneLo:sceneUp;
    if(cur!==key){ if(!c) c=document.createElement('canvas'); if(c.width!==cvs.width||c.height!==cvs.height){ c.width=cvs.width; c.height=cvs.height; }
      const g=c.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,c.width,c.height); const m=ctx; ctx=g; paint(); ctx=m;
      if(isLo){ sceneLo=c; loKey=key; } else { sceneUp=c; upKey=key; } }
    ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(c,0,0); return;
  }
  paint();
}
function draw(){
  if(G.rn&&P2.rdVer!==G.rn.ver) buildRoadPaths();
  const camK=cam.x+','+cam.y+','+cam.s+','+cvs.width+','+cvs.height+','+layerVer, rest=camK===lastCamK; lastCamK=camK;
  cachedLayer('lo',camK,drawLower,!baseFadeAt,rest);
  // the street and building layer: while the camera rests, monthly street and building changes are folded in at most
  // every 12 s (new streets show on top meanwhile); a moving camera repaints anyway and takes everything at once
  { const now=performance.now(), hard=P2.ver+'|'+G.bounds.join(','), soft=''+P2.rdVer;
    if(hard!==upHard||(soft!==upSoft&&(!rest||now-upAt>12000))){ upHard=hard; upSoft=soft; upAt=now; if(P2.upMonth!==months){ P2.upMonth=months; buildRoadPaths(); } upStamp++; } }
  worldT(); const px=1/cam.s; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.imageSmoothingEnabled=true;
  const hf=heatPrev?clamp((performance.now()-heatFadeAt)/(2800/speedMul),0,1):1;
  if(urbCanvas){ if(urbPrev&&hf<1){ ctx.globalAlpha=1-hf; ctx.drawImage(urbPrev,0,0,W,H); ctx.globalAlpha=Math.max(hf,0.15); } ctx.drawImage(urbCanvas,0,0,W,H); ctx.globalAlpha=1; }
  const ha=0.58*(1-0.55*smooth(cam.s,9,16));   /* lighter heat at street zoom, where the buildings carry the picture */
  if(heatMode==='pop'&&heatCanvas&&!watch.on){ if(heatPrev&&hf<1){ ctx.globalAlpha=ha*(1-hf); ctx.drawImage(heatPrev,0,0,W,H); } ctx.globalAlpha=ha*(heatPrev&&hf<1?Math.max(hf,0.15):1); ctx.drawImage(heatCanvas,0,0,W,H); ctx.globalAlpha=1; }
  if(hf>=1){ heatPrev=null; urbPrev=null; }
  if(heatMode==='commute'&&commuteCanvas){ ctx.globalAlpha=0.6; ctx.drawImage(commuteCanvas,0,0,W,H); ctx.globalAlpha=1; }
  if(flashCanvas){ const a=1-(performance.now()-flashAt)/4500; if(a>0){ ctx.globalAlpha=Math.min(1,a*1.4)*0.85; ctx.drawImage(flashCanvas,0,0,W,H); ctx.globalAlpha=1; } else flashCanvas=null; }
  if(cam.s>4){ ctx.strokeStyle=C['sea-shallow']; for(const r of P2.rivers){ ctx.lineWidth=Math.max(r.w,1.4*px); ctx.stroke(r.p); } }
  cityLayer(upStamp+'|'+layerVer,rest);
  drawBuildingTiles(rest?6:3.5);
  { worldT(); const B=G.bounds, fog=new Path2D(); fog.rect(-50,-50,W+100,H+100); fog.rect(B[0],B[1],B[2]-B[0],B[3]-B[1]); ctx.fillStyle=C['card-solid']; ctx.globalAlpha=0.62; ctx.fill(fog,'evenodd'); ctx.globalAlpha=1;
    ctx.setLineDash([6*px,5*px]); ctx.strokeStyle=C['ink-3']; ctx.lineWidth=1.5*px; ctx.strokeRect(B[0],B[1],B[2]-B[0],B[3]-B[1]); ctx.setLineDash([]); }
  worldT(); ctx.lineCap='round'; ctx.lineJoin='round';
  if(P2.rdHasPend) strokeRoads(ctx,px,{edge:C['arterial-edge'],core:C.arterial,hwy:C.highway},1,smooth(cam.s,1.3,3),'pend');
  if(P2.rdHasNew){ const a=clamp((performance.now()-P2.rdAt)/(1600/speedMul),0,1); strokeRoads(ctx,px,{edge:C['arterial-edge'],core:C.arterial,hwy:C.highway},a,smooth(cam.s,1.3,3),'new'); }
  if(tool==='build'&&stations.length){ const p=new Path2D(); for(const s of stations){ p.moveTo(s.x+5.4,s.y); p.arc(s.x,s.y,5.4,0,Math.PI*2); } ctx.fillStyle=C.accent; ctx.globalAlpha=0.07; ctx.fill(p); ctx.globalAlpha=1; }
  // metro lines
  const lw=clamp(cam.s*0.9,2.6,8)*px; lineGeometry(lw);
  const ugA=smooth(cam.s,9,13);     // close in, tunnels are drawn see-through: the city stands above them
  for(const L of lines){ if(!L._path||L.stops.length<2) continue; ctx.strokeStyle=C.halo; ctx.globalAlpha=0.85; ctx.lineWidth=lw+2.4*px; if(L._pU&&ugA>0.5) ctx.stroke(L._pA); else ctx.stroke(L._path); ctx.globalAlpha=1; }
  const ordered=lines.slice().sort((a,b)=>(a.id===activeLineId)-(b.id===activeLineId));
  for(const L of ordered){ if(!L._path||L.stops.length<2) continue; const sel=L.id===activeLineId, dim=activeLineId&&!sel; if(sel){ ctx.strokeStyle=C.halo; ctx.lineWidth=lw*1.15+3*px; ctx.stroke(L._path); } const la=dim?0.42:1; ctx.globalAlpha=la; ctx.strokeStyle=lineColor(L); ctx.lineWidth=sel?lw*1.15:lw;
    if(L._pU&&ugA>0.01){ ctx.stroke(L._pA); ctx.globalAlpha=la*(1-0.5*ugA); ctx.stroke(L._pU); ctx.globalAlpha=la; if(ugA>0.5){ ctx.setLineDash([lw*0.5,lw*0.9]); ctx.strokeStyle=C['card-solid']; ctx.lineWidth=lw*0.16; ctx.globalAlpha=la*0.8; ctx.stroke(L._pU); ctx.setLineDash([]); ctx.globalAlpha=la; ctx.strokeStyle=lineColor(L); ctx.lineWidth=sel?lw*1.15:lw; } } else ctx.stroke(L._path);
    if(isRapid(L)){ ctx.strokeStyle=C['card-solid']; ctx.lineWidth=(sel?lw*1.15:lw)*0.3; ctx.setLineDash([lw*1.6,lw*1.1]); ctx.stroke(L._path); ctx.setLineDash([]); }   // rapid lines: a railway-style dashed core
    ctx.globalAlpha=1; }
  // stroke preview
  if(stroke&&stroke.drawing){
    const L=stroke.L, col=L?lineColor(L):LINE_COLORS[(nextLineNum-1)%LINE_COLORS.length];
    const from=stroke.from, pts=[[from.x,from.y]]; for(const p of stroke.raw){ const l=pts[pts.length-1]; if(dist(p[0],p[1],l[0],l[1])>=0.6) pts.push(p); }
    pts.push(stroke.pen); const sm=chaikin(pts,2);
    ctx.strokeStyle=C.halo; ctx.globalAlpha=0.8; ctx.lineWidth=lw+2.4*px; ctx.beginPath(); ctx.moveTo(sm[0][0],sm[0][1]); sm.forEach(p=>ctx.lineTo(p[0],p[1])); ctx.stroke();
    ctx.globalAlpha=1; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke();
    if(from.isNew){ ctx.beginPath(); ctx.arc(from.x,from.y,lw*0.62,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.fill(); ctx.strokeStyle=col; ctx.lineWidth=lw*0.3; ctx.stroke(); }
  }
  drawTrains(lw); if(watch.on) drawWatch(lw); else drawAssist(lw);
  // stations
  if(stCache.v!==netVersion){ const c=new Map(), fl=new Map(); lines.forEach(L=>L.stops.forEach(id=>{ c.set(id,(c.get(id)||0)+1); if(!fl.has(id)) fl.set(id,L); })); stCache={v:netVersion,cnt:c,fl}; }
  const cnt=stCache.cnt;
  for(const s of stations){
    const c=cnt.get(s.id)||0, transfer=c>1, slv=s.lv||0, rr=(transfer?lw*(0.95+0.2*Math.min(3,c-2)):lw*0.62)*(1+0.16*slv);
    if(slv>=2){ ctx.beginPath(); ctx.arc(s.x,s.y,rr+lw*0.55,0,Math.PI*2); ctx.strokeStyle=C.ink; ctx.globalAlpha=0.25; ctx.lineWidth=lw*0.35; ctx.stroke(); ctx.globalAlpha=1; }
    if(slv>=3){ ctx.beginPath(); ctx.arc(s.x,s.y,rr+lw*1.05,0,Math.PI*2); ctx.strokeStyle=C.ink; ctx.globalAlpha=0.15; ctx.lineWidth=lw*0.3; ctx.stroke(); ctx.globalAlpha=1; }
    ctx.beginPath(); ctx.arc(s.x,s.y,rr,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.fill();
    ctx.lineWidth=transfer?Math.max(1.6*px,lw*0.32):Math.max(1.3*px,lw*0.3);
    const L=stCache.fl.get(s.id); ctx.strokeStyle=transfer||!L?C.ink:lineColor(L); ctx.stroke();
    if(c>2){ ctx.beginPath(); ctx.arc(s.x,s.y,rr*0.42,0,Math.PI*2); ctx.fillStyle=C.ink; ctx.fill(); }   /* a hub of three lines or more */
    if(hover&&hover.id===s.id){ ctx.beginPath(); ctx.arc(s.x,s.y,rr+3*px,0,Math.PI*2); ctx.strokeStyle=C.accent; ctx.lineWidth=2*px; ctx.stroke(); }
  }
  if(heatMode==='demand') drawFlows();
  drawPetition();
  const SL=lineById(activeLineId);
  if(SL&&SL.xs&&SL.svc&&SL.xs.length){ for(const id of SL.stops){ const k=svcOf(SL,id); if(!k) continue; const st=stById(id), d=lw*0.42, y0=st.y+lw*1.35;
      for(let q=0;q<k;q++){ const x=st.x+(q-(k-1)/2)*d*2.1; ctx.beginPath(); ctx.arc(x,y0,d,0,Math.PI*2); ctx.fillStyle=SVC_COL[q+1]; ctx.fill(); ctx.strokeStyle=C.halo; ctx.lineWidth=lw*0.12; ctx.stroke(); } } }
  if(SL&&SL.stops.length>=2&&!SL.loop&&tool!=='erase'){ const pulse=0.5+0.5*Math.sin(performance.now()/260);
    for(const id of [SL.stops[0],SL.stops[SL.stops.length-1]]){ const e=stById(id); ctx.beginPath(); ctx.arc(e.x,e.y,lw*(1.2+pulse*0.7),0,Math.PI*2); ctx.strokeStyle=lineColor(SL); ctx.globalAlpha=0.35+0.4*(1-pulse); ctx.lineWidth=2*px; ctx.stroke(); ctx.globalAlpha=1; } }
  if(SL&&SL.stops.length>=2&&tool!=='erase'&&hoverWorld&&!(stroke&&stroke.drawing)){
    const sn=snapTarget(), col=lineColor(SL);
    if(sn&&sn.pt&&!sn.st){ const big=sn.kind==='xfer'; ctx.beginPath(); ctx.arc(sn.pt[0],sn.pt[1],big?lw*0.95:lw*0.62,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.globalAlpha=0.9; ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=big?C.ink:col; ctx.lineWidth=big?Math.max(1.6*px,lw*0.32):lw*0.3; ctx.stroke(); }
    if(sn&&sn.st&&sn.kind==='xfer'){ ctx.beginPath(); ctx.arc(sn.st.x,sn.st.y,lw*1.3,0,Math.PI*2); ctx.strokeStyle=col; ctx.lineWidth=2.2*px; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(hoverWorld[0],hoverWorld[1],9*px,0,Math.PI*2); ctx.strokeStyle=col; ctx.lineWidth=2.4*px; ctx.stroke();
    ctx.beginPath(); ctx.arc(hoverWorld[0],hoverWorld[1],1.6*px,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  }
  // pen marker / click ghost
  if(tool==='build'&&hoverWorld&&!(SL&&SL.stops.length>=2&&!(stroke&&stroke.drawing))){
    const tgt=hover||{x:hoverWorld[0],y:hoverWorld[1]};
    if(!hover){ const L=stroke&&stroke.L?stroke.L:lineById(activeLineId); const col=L?lineColor(L):LINE_COLORS[(nextLineNum-1)%LINE_COLORS.length];
      ctx.beginPath(); ctx.arc(tgt.x,tgt.y,lw*0.62,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.globalAlpha=0.85; ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=col; ctx.lineWidth=lw*0.3; ctx.stroke(); }
  }
  drawFocus();
  screenT(); drawLabels(cnt); drawAssistLabels(); drawPins(); drawFx(lastDt);
  if(hoverWorld&&tool!=='erase') drawPenTag();
}
function trainSeg(cum,u){ let lo=1, hi=cum.length-1; while(lo<hi){ const m=(lo+hi)>>1; if(cum[m]<u) lo=m+1; else hi=m; } return lo; }
// a train is drawn as a short piece of its own track, so it bends through the curves instead of pivoting like a ruler
function trackSlice(pts,cum,u0,u1,off){ const len=cum[cum.length-1]; u0=clamp(u0,0,len); u1=clamp(u1,0,len); const at=u=>{ const i=Math.max(1,trainSeg(cum,u)), f=(u-cum[i-1])/((cum[i]-cum[i-1])||1); return [lerp(pts[i-1][0],pts[i][0],f),lerp(pts[i-1][1],pts[i][1],f),i]; };
  const a=at(u0), b=at(u1); let P=[a]; for(let i=a[2];i<b[2];i++) P.push(pts[i]); P.push(b); if(off){ if(P.length===2&&P[0][0]===P[1][0]&&P[0][1]===P[1][1]){ const i=a[2], dx=pts[i][0]-pts[i-1][0], dy=pts[i][1]-pts[i-1][1], l=Math.hypot(dx,dy)||1; P=[[a[0]-dy/l*off,a[1]+dx/l*off]]; P.push(P[0]); } else P=offsetPts(P,off); }
  ctx.beginPath(); ctx.moveTo(P[0][0],P[0][1]); for(let i=1;i<P.length;i++) ctx.lineTo(P[i][0],P[i][1]); return P[P.length-1]; }
function drawTrains(lw){
  ctx.lineCap='round'; ctx.lineJoin='round';
  for(const L of lines){
    if(L.stops.length<2) continue;
    const {pts,cum}=trainGeom(L), len=cum[cum.length-1]; if(len<1) continue;
    const n=Math.max(2,Math.round(len/16)), per=L.loop?len:len*2, v=lineV(L)*0.85, col=lineColor(L);
    for(let k=0;k<n;k++){
      let u=(trainT*v+k*per/n)%per, dir=1; if(!L.loop&&u>len){ u=per-u; dir=-1; }
      const l=lw*2.6, w=lw*0.9, off=dir*lw*0.46;      /* each direction on its own side, so trains pass instead of running through each other */
      trackSlice(pts,cum,u-l/2+w/2,u+l/2-w/2,off); ctx.strokeStyle=C.ink; ctx.lineWidth=w+lw*0.44; ctx.stroke(); ctx.strokeStyle=C['card-solid']; ctx.lineWidth=w; ctx.stroke();
      ctx.lineCap='butt'; trackSlice(pts,cum,u+dir*l*0.12-(dir<0?l*0.26:0),u+dir*l*0.12+(dir>0?l*0.26:0),off); ctx.strokeStyle=col; ctx.lineWidth=w*0.44; ctx.stroke(); ctx.lineCap='round';
    }
    // faster services: longer trains in the line colour with a tier-coloured nose
    for(let tr=1;tr<=((L.xs&&L.svc)?L.xs.length:0);tr++){
      const ne=Math.max(1,Math.round(len/45)), ve=v*SVC_SPEED[tr]*1.25;
      for(let k=0;k<ne;k++){
        let u=(trainT*ve+(k+0.37*tr)*per/ne)%per, dir=1; if(u>len){ u=per-u; dir=-1; }
        const l=lw*3.4, w=lw*0.95, off=dir*lw*0.46;
        trackSlice(pts,cum,u-l/2+w/2,u+l/2-w/2,off); ctx.strokeStyle=C['card-solid']; ctx.lineWidth=w+lw*0.44; ctx.stroke(); ctx.strokeStyle=col; ctx.lineWidth=w; ctx.stroke();
        const nose=trackSlice(pts,cum,u+dir*(l/2-w*0.55),u+dir*(l/2-w*0.55),off); ctx.fillStyle=SVC_COL[tr]; ctx.beginPath(); ctx.arc(dir>0?nose[0]:nose[0],nose[1],w*0.32,0,Math.PI*2); ctx.fill();
      }
    }
  }
}
let labelBoxes=[], labelGrid=new Map(); const MW=new Map();
// label collision: boxes bucketed on a 64 px grid, text widths measured once per font+text
function addBox(b){ labelBoxes.push(b); for(let gy=Math.floor(b[1]/64);gy<=Math.floor(b[3]/64);gy++) for(let gx=Math.floor(b[0]/64);gx<=Math.floor(b[2]/64);gx++){ const k=gy*1000+gx; const a=labelGrid.get(k); if(a) a.push(b); else labelGrid.set(k,[b]); } }
function hitBox(box){ for(let gy=Math.floor(box[1]/64);gy<=Math.floor(box[3]/64);gy++) for(let gx=Math.floor(box[0]/64);gx<=Math.floor(box[2]/64);gx++){ const a=labelGrid.get(gy*1000+gx); if(a) for(const b of a) if(box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]) return true; } return false; }
function label(text,x,y,size,weight,color,force){
  const font=`${weight} ${size}px ${FONT()}`, mk=font+'|'+text; let w=MW.get(mk); ctx.font=font;
  if(w==null){ w=ctx.measureText(text).width+6; if(MW.size>6000) MW.clear(); MW.set(mk,w); } const hgt=size+4;
  const box=[x-w/2,y-hgt/2,x+w/2,y+hgt/2];
  if(!force&&hitBox(box)) return false;
  addBox(box);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.lineWidth=3.2; ctx.strokeStyle=C.halo; ctx.lineJoin='round'; ctx.strokeText(text,x,y); ctx.fillStyle=color; ctx.fillText(text,x,y); return true;
}
function drawIcon(kind,x,y){
  const s=22; ctx.save(); ctx.translate(x,y);
  ctx.fillStyle=kind==='air'?'#1d3b8f':kind==='rail'?'#3c4252':'#0f7a5c';
  ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-s/2,-s/2,s,s,5); else ctx.rect(-s/2,-s/2,s,s); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='#fff';
  if(kind==='air'){ ctx.rotate(-Math.PI/4); ctx.beginPath(); [[0,-8],[1.4,-6],[1.4,-1.5],[7.5,2.5],[7.5,4.2],[1.4,2.2],[1.2,5.6],[3.4,7.4],[3.4,8.6],[0,7.6],[-3.4,8.6],[-3.4,7.4],[-1.2,5.6],[-1.4,2.2],[-7.5,4.2],[-7.5,2.5],[-1.4,-1.5],[-1.4,-6]].forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b)); ctx.closePath(); ctx.fill(); }
  else if(kind==='rail'){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-5.5,-7.5,11,12,3); else ctx.rect(-5.5,-7.5,11,12); ctx.fill(); ctx.fillStyle='#3c4252'; ctx.fillRect(-3.6,-5.5,7.2,4); ctx.beginPath(); ctx.arc(-2.8,1.6,1.1,0,6.3); ctx.arc(2.8,1.6,1.1,0,6.3); ctx.fill(); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-4,5.5); ctx.lineTo(-6,8.5); ctx.moveTo(4,5.5); ctx.lineTo(6,8.5); ctx.stroke(); }
  else { ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-7,-6.5,14,11.5,2.5); else ctx.rect(-7,-6.5,14,11.5); ctx.fill(); ctx.fillStyle='#0f7a5c'; ctx.fillRect(-5,-4.5,10,4.2); ctx.beginPath(); ctx.arc(-3.8,2.4,1,0,6.3); ctx.arc(3.8,2.4,1,0,6.3); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillRect(-5.5,5,2.6,2.4); ctx.fillRect(2.9,5,2.6,2.4); }
  ctx.restore();
}
const PROJ_COL={ind:'#6b5a3e',tech:'#3557c9',beach:'#0e8fb0',scenic:'#3f8a3a',univ:'#8a3f9e',theme:'#e0457b',ent:'#c2338f',gov:'#9a2f2f',fin:'#1f5f8b',hist:'#8c5a2b',spa:'#c4572a',arena:'#2c8a6e',port:'#2d4a7a'};
function drawProj(p,x,y){
  const s=20, col=PROJ_COL[p.t]||'#555', prog=clamp((months-p.m0)/PROJ_BUILD,0,1); ctx.save(); ctx.translate(x,y);
  ctx.fillStyle=col; ctx.globalAlpha=p.done?1:0.85; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-s/2,-s/2,s,s,10); else ctx.rect(-s/2,-s/2,s,s); ctx.fill(); ctx.globalAlpha=1;
  if(!p.done){ ctx.strokeStyle=col; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(0,0,s/2+3,-Math.PI/2,-Math.PI/2+prog*Math.PI*2); ctx.stroke(); }
  ctx.fillStyle='#fff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.6; ctx.lineCap='round'; ctx.lineJoin='round';
  if(!p.done){ // crane
    ctx.beginPath(); ctx.moveTo(-3,6); ctx.lineTo(-3,-6); ctx.lineTo(6,-6); ctx.moveTo(-6,-3.5); ctx.lineTo(-3,-6); ctx.moveTo(4,-6); ctx.lineTo(4,0); ctx.moveTo(-6,6); ctx.lineTo(1,6); ctx.stroke(); ctx.fillRect(2.6,0,2.8,2.4);
  } else if(p.t==='ind'){ ctx.beginPath(); ctx.moveTo(-6.5,6); ctx.lineTo(-6.5,-1); ctx.lineTo(-2.5,1.5); ctx.lineTo(-2.5,-1); ctx.lineTo(1.5,1.5); ctx.lineTo(1.5,-6); ctx.lineTo(4.5,-6); ctx.lineTo(4.5,6); ctx.closePath(); ctx.fill(); }
  else if(p.t==='tech'){ ctx.beginPath(); ctx.arc(0,0,2,0,6.3); ctx.fill(); ctx.lineWidth=1.3; for(const a of [0,1.05,2.1]){ ctx.beginPath(); ctx.ellipse(0,0,6.5,2.6,a,0,6.3); ctx.stroke(); } }
  else if(p.t==='beach'){ ctx.beginPath(); ctx.moveTo(-6,-1); ctx.quadraticCurveTo(0,-8,6,-1); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(1.5,6); ctx.moveTo(-6.5,6.5); ctx.quadraticCurveTo(0,4,6.5,6.5); ctx.stroke(); }
  else if(p.t==='scenic'){ ctx.beginPath(); ctx.moveTo(-7,6); ctx.lineTo(-2,-3); ctx.lineTo(0.5,1); ctx.lineTo(3,-5.5); ctx.lineTo(7.5,6); ctx.closePath(); ctx.fill(); }
  else if(p.t==='univ'){ ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(8,-2); ctx.lineTo(0,2); ctx.lineTo(-8,-2); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4.5,0); ctx.lineTo(-4.5,4); ctx.quadraticCurveTo(0,7,4.5,4); ctx.lineTo(4.5,0); ctx.stroke(); }
  else if(p.t==='theme'){ ctx.lineWidth=1.3; ctx.beginPath(); ctx.arc(0,-1.5,5.5,0,6.3); ctx.stroke(); for(let a=0;a<6;a++){ ctx.beginPath(); ctx.moveTo(0,-1.5); ctx.lineTo(Math.cos(a*1.047)*5.5,-1.5+Math.sin(a*1.047)*5.5); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-3.5,7); ctx.lineTo(0,-1.5); ctx.lineTo(3.5,7); ctx.stroke(); }
  else if(p.t==='ent'){ ctx.beginPath(); for(let a=0;a<10;a++){ const r=a%2?3:7.5, t=-Math.PI/2+a*Math.PI/5; ctx.lineTo(Math.cos(t)*r,Math.sin(t)*r+0.5); } ctx.closePath(); ctx.fill(); }
  else if(p.t==='gov'){ ctx.beginPath(); ctx.moveTo(-7.5,-2.5); ctx.lineTo(0,-7); ctx.lineTo(7.5,-2.5); ctx.closePath(); ctx.fill(); ctx.fillRect(-7,5,14,2); for(const u of [-5,-1.6,1.8,5.2]) ctx.fillRect(u-0.9,-1.5,1.8,6.2); }
  else if(p.t==='fin'){ ctx.fillRect(-6.5,-1,3.5,8); ctx.fillRect(-1.8,-7,3.6,14); ctx.fillRect(3,-3.5,3.5,10.5); }
  else if(p.t==='hist'){ ctx.beginPath(); ctx.moveTo(-8,-1); ctx.quadraticCurveTo(0,-4,8,-1); ctx.lineTo(5,-4.5); ctx.quadraticCurveTo(0,-6.5,-5,-4.5); ctx.closePath(); ctx.fill(); ctx.fillRect(-4.5,-1,9,1.6); ctx.fillRect(-3.5,0.6,1.6,6.4); ctx.fillRect(1.9,0.6,1.6,6.4); ctx.fillRect(-6,6,12,1.4); }
  else if(p.t==='spa'){ ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(0,4,7,2.4,0,0,Math.PI); ctx.stroke(); for(const u of [-3.5,0,3.5]){ ctx.beginPath(); ctx.moveTo(u,2.5); ctx.bezierCurveTo(u-2,0,u+2,-2,u,-6.5); ctx.stroke(); } }
  else if(p.t==='arena'){ ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(0,0,7.5,4.8,0,0,6.3); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0,0,4,2,0,0,6.3); ctx.fill(); }
  else { ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(0,-5,1.6,0,6.3); ctx.moveTo(0,-3.4); ctx.lineTo(0,6.5); ctx.moveTo(-3.5,-1.5); ctx.lineTo(3.5,-1.5); ctx.moveTo(-6.5,2); ctx.quadraticCurveTo(-5.5,6.5,0,6.5); ctx.quadraticCurveTo(5.5,6.5,6.5,2); ctx.stroke(); }
  ctx.restore();
}
function drawLabels(cnt){
  labelBoxes=[]; labelGrid.clear();
  const s=cam.s, F=G.fac, inView=(x,y)=>x>-80&&y>-30&&x<vw+80&&y<vh+30;
  for(const [k,pt,nmo] of [['air',F.airport.term,{k:'airport'}],['rail',F.station,{k:'rail'}],['coach',F.coach,{k:'coach'}],...(G.fac2||[]).map(f=>[f.t,facPoint(f),facName(f)])]){
    const [x,y]=toScreen(pt.x,pt.y-1.8); if(!inView(x,y)) continue; drawIcon(k,x,y-12); addBox([x-12,y-24,x+12,y]); if(s>2.4) label(nm(nmo),x,y+8,11.5,700,C.ink); }
  for(const p of (G.projects||[])){ if(!inB(p.x,p.y)) continue; const [x,y]=toScreen(p.x,p.y); if(!inView(x,y)) continue; drawProj(p,x,y-10); addBox([x-12,y-22,x+12,y+2]); if(s>2.0) label(nm(projName(p))+(p.done?'':' · '+t('projState')[0]),x,y+10,11,600,p.done?C.ink:C['ink-3']); }
  if(s>2.2) for(const c of G.centers){ if(!inB(c.x,c.y)) continue; const [x,y]=toScreen(c.x,c.y-c.s*0.25); if(inView(x,y)) label(nm(c.name),x,y,c.type==='main'||c.name.k==='core'?16:13.5,700,C['ink-2']); }
  for(const v of G.villages){ const tr=tierOf(v); if(tr<2||!inB(v.x,v.y)||v.gone) continue; const [x,y]=toScreen(v.x,v.y); if(inView(x,y)&&s>2.2) label(nm(v.name),x,y,tr>=3?15:13.5,700,C['ink-2']); }
  if(s>7.5||(s>4.2&&tool==='build')){ const order=stations.slice().sort((a,b)=>(cnt.get(b.id)||0)-(cnt.get(a.id)||0));
    for(const st of order){ const [x,y]=toScreen(st.x,st.y); if(!inView(x,y)) continue; const tr=(cnt.get(st.id)||0)>1; label(nm(st.name),x,y-Math.max(11,s*0.9)-4,tr?12.5:11.5,tr?700:500,C.ink); } }
  if(s>3.2){ for(const v of G.villages){ const tr=tierOf(v); if(tr>=2||!inB(v.x,v.y)||v.gone) continue; const [x,y]=toScreen(v.x,v.y); if(inView(x,y)) label(nm(v.name),x,y,tr?12:11,tr?600:500,C['ink-3']); }
    for(const p of [...G.plazas,...G.inds]){ if(!inB(p.x,p.y)) continue; const [x,y]=toScreen(p.x,p.y); if(inView(x,y)) label(nm(p.name),x,y,11,500,C['ink-3']); } }
}
function drawPenTag(){
  let txt, warn=false;
  const tgtX=stroke&&stroke.drawing?stroke.pen[0]:hoverWorld[0], tgtY=stroke&&stroke.drawing?stroke.pen[1]:hoverWorld[1];
  if(stroke&&stroke.drawing){
    const L=stroke.L, h=stationAt(tgtX,tgtY);
    const km=(plen([[stroke.from.x,stroke.from.y],...stroke.raw])*CELL_KM).toFixed(1);
    if(h&&L&&L.stops[0]===h.id&&L.stops.length>=3) txt=t('tagLoop');
    else if(h) txt=t('tagJoin');
    else if(!isLand(tgtX,tgtY)){ txt=whyNot(tgtX,tgtY); warn=true; }
    else txt=km+' km  '+(stroke.type==='touch'?t('tagTouch'):t('tagSpace'));
  } else if(lineById(activeLineId)&&lineById(activeLineId).stops.length>=2){
    const sn=snapTarget(); if(!sn||sn.kind==='has') return;
    txt=sn.kind==='xfer'?t('tagXfer'):sn.kind==='add'?t('tagAdd'):t('tagOnto');
  } else {
    if(tool!=='build') return;
    if(hover) txt=t('tagStart'); else if(!isLand(tgtX,tgtY)){ txt=whyNot(tgtX,tgtY); warn=true; } else return;
  }
  const [x,y]=toScreen(tgtX,tgtY);
  ctx.font=`600 12px ${FONT()}`; const w=ctx.measureText(txt).width+14;
  ctx.fillStyle=warn?C.bad:C.ink; ctx.globalAlpha=0.9; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x+14,y+12,w,22,11); else ctx.rect(x+14,y+12,w,22); ctx.fill(); ctx.globalAlpha=1;
  ctx.fillStyle=C['card-solid']; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(txt,x+21,y+23.5);
  const E=stroke&&stroke.drawing&&stroke.est;
  if(E&&!warn){ const good=E.dAvg<-0.02, et=t('estTag',{m:(E.dAvg<0?'−':'+')+Math.abs(E.dAvg).toFixed(1),r:(E.dRiders>=0?'+':'−')+fmtN(Math.abs(E.dRiders))});
    ctx.font=`700 12px ${FONT()}`; const w2=ctx.measureText(et).width+14; ctx.fillStyle=good?C.good:C['ink-3']; ctx.globalAlpha=0.92; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x+14,y+38,w2,22,11); else ctx.rect(x+14,y+38,w2,22); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle='#fff'; ctx.fillText(et,x+21,y+49.5); }
}
