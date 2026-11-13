/* ---------- loop ---------- */
let clockUIt=0, lastDt=0, frameEMA=16, slowN=0;
function frame(ts){
  // A screen that refreshes 120 or 144 times a second would have everything drawn twice as often for no visible gain, and the
  // machine runs hot for it: frames are held to about sixty a second.
  if(ts-lastTs<14.5){ requestAnimationFrame(frame); return; }
  const raw=ts-lastTs, dt=Math.min(0.1,raw/1000||0); lastTs=ts; lastDt=dt;
  // if frames keep arriving late the map is drawn a little less sharp: on a dense screen that is most of the work
  if(raw>0&&raw<250&&!(watch.on&&watch.view==='3d')){ frameEMA+=(raw-frameEMA)*0.04; if(frameEMA>22) slowN++; else slowN=Math.max(0,slowN-2);
    if(slowN>110&&dpr>1){ dprCap=Math.max(1,dpr-0.25); slowN=0; frameEMA=16; resize(); clampCam(); } }
  if(!paused){ trainT+=dt*5*speedMul; growthAcc+=dt*speedMul; if(growthAcc>=3){ growthAcc=0; doGrowth(); } }
  if(jobs.length) runJobs(6);
  if(stroke&&stroke.drawing){ strokeFrame(dt,ts); updateLiveEst(ts); }
  if(watch.on) watchTick(dt,ts); else assistTick();
  { const show=touchMode&&tool==='build'&&!!(stroke&&stroke.drawing&&!stroke.done); const fb=$('#fab'); if(fb.hidden===show) fb.hidden=!show; }
  if(camAnim){ const f=clamp((ts-camAnim.t0)/camAnim.dur,0,1), e=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2; cam.x=lerp(camAnim.x0,camAnim.x1,e); cam.y=lerp(camAnim.y0,camAnim.y1,e); cam.s=lerp(camAnim.s0,camAnim.s1,e); clampCam(); if(f>=1) camAnim=null; }
  if(baseJob&&baseRows(baseJob,30)){ if(base2.width!==base.width){ base2.width=base.width; base2.height=base.height; } b2ctx.putImageData(baseJob.img,0,0); baseJob=null; baseFadeAt=ts; }
  frameN++; const busy=!!(stroke&&stroke.drawing)||!!camAnim||ts-lastInteract<400;
  if(watch.on&&watch.view==='3d'&&w3d.ready){ w3dFrame(dt); }
  else if(busy||watch.on||frameN%2===0){      /* nothing being dragged, drawn or watched: the map is redrawn thirty times a second, which the slow trains do not show */ const t0=performance.now(); draw(); const dd=performance.now()-t0; drawEMA=drawEMA*0.9+dd*0.1; if(window.__mcProf&&dd>12) window.__mcProf.push(['draw',Math.round(dd)]); }
  if(ts-clockUIt>250){ clockUIt=ts; $('#clockLbl').textContent=t('year',{y:Math.floor(months/12)+1,m:months%12+1}); }
  requestAnimationFrame(frame);
}
// one simulated month, split into steps; the frame loop runs them a few milliseconds at a time
function doGrowth(sync){
  if((jobs.length||pendingImpact)&&!sync) return;    // previous month still settling, or an edit is being measured: wait
  months++;
  const used=stations.filter(st=>lines.some(L=>L.stops.length>=2&&L.stops.includes(st.id))); let before=null;
  const steps=[
    function*(){ before=used.map(catchment); const d=yield* growthGen(); growth.active=stations.length>0||d>0.3;
      const gains=used.map((st,i)=>({st,g:catchment(st)-before[i]})).filter(o=>o.g>250).sort((a,b)=>b.g-a.g).slice(0,5);
      const now=performance.now(); gains.slice(0,speedMul>1?2:4).forEach((o,i)=>{ if(floats.some(f=>f.sid===o.st.id&&now-f.t0<2600)) return; floats.push({sid:o.st.id,x:o.st.x,y:o.st.y,txt:'+'+fmtN(o.g),t0:now+i*160}); });
      yearReview(); },
    ()=>{ const now=performance.now();
      if(months%12===0) bldBump();
      if(months%12===0&&sim){ const fs=checkFacilities(cityLevel(sim.riders)); if(fs.length){ bldBump(); buildPaths(); const f=fs[0], pt=facPoint(f); toast(t('facNew',{f:nm(facName(f))})); SFX.level(); floats.push({x:pt.x,y:pt.y,txt:nm(facName(f)),t0:now,big:true}); burst(60,vw/2,140,1.6); persistSoon(); } } },
    ()=>{ petEvent(petitionCheck(true)); petCard(); },
    ()=>{ if(months%6!==3||!sim) return; const up=autoOps(); if(up.length){ const L=up[0], [t0,t1,n]=svcTimes(L), a=stById(L.stops[0]), b=stById(L.stops[L.stops.length-1]); toast(t('svcAuto')+t('svcUp',{l:lineName(L),s:t('svcName')[L.svc],a:nm(a.name),b:nm(b.name),m0:Math.round(t0),m1:Math.round(t1),n})); SFX.up(); changed(); } },
    ()=>{ const now=performance.now(); const pe=projectsTick(); if(pe.length){ let nr=false; pe.forEach(o=>{ if(o.type==='start') nr=true; }); if(nr) buildPaths();
        pe.forEach((o,i)=>floats.push({x:o.p.x,y:o.p.y,txt:nm(projName(o.p)),t0:now+i*300,big:true}));
        const o=pe[pe.length-1]; toast(t(o.type==='start'?'projStart':'projDone',{p:nm(projName(o.p))})); if(o.type==='done'){ SFX.level(); burst(40,vw/2,140,1.2); } else SFX.up(); persistSoon(); } },
    ()=>{ const now=performance.now(); const ev=evolvePlaces(); if(ev.length){ let nr=false; ev.forEach(o=>{ if(roadForPlace(o.x,o.y,o.tier)) nr=true; }); if(nr) buildPaths(); ev.forEach((o,i)=>{ floats.push({x:o.x,y:o.y,txt:nm(o.to),t0:now+i*300,big:true}); }); const o=ev[0];
        toast(o.type==='new'?t('placeNew',{b:nm(o.to)}):t('placeUp',{a:nm(o.from),b:nm(o.to),t:t('tierName')[o.tier]})); SFX.up(); persistSoon(); } },
    // the month's street work in pieces, so no single piece is long enough to be felt
    ()=>{ if(G.rn) rnGrow(G.rn,140); }, ()=>{ if(G.rn) rnGrow(G.rn,140); }, ()=>{ if(G.rn) rnGrow(G.rn,140); },
    ()=>{ const R=G.rn; if(!R) return; rnTraffic(R,20); if(months%12===0) rnWiden(R); }, ()=>{ const R=G.rn; if(!R) return; if(months%12===0) rnTidy(R); if(months%12===6) rnBridges(R); },
    ()=>{ relocate(0.03); },
    ()=>{ buildHeat(); updatePop(); if(months%6===0) persistSoon(); },
    ()=>{ scheduleSim(); }
  ];
  if(sync){ steps.forEach(f=>{ const r=f(); if(r&&r.next) while(!r.next().done); }); return; }
  jobs.push(...steps);
}
function runJobs(budget){ const t0=performance.now(), pf=window.__mcProf;
  // a job is a function, or a generator that yields between its heavier stages
  while(jobs.length){ const j=jobs[0], a=performance.now(); if(j.next){ if(j.next().done) jobs.shift(); } else { jobs.shift(); const r=j(); if(r&&r.next) jobs.unshift(r); }
    if(pf){ const d=performance.now()-a; if(d>4) pf.push(['job',(j.next?'gen':String(j).slice(0,50)),Math.round(d)]); } if(performance.now()-t0>budget) break; } }
function updatePop(){
  $('#popLbl').textContent=fmtN(G.popTotal);
  const dp=G.popTotal-growth.pop0; $('#popDelta').textContent=Math.abs(dp)>=5000?(dp>0?'+':'−')+fmtN(Math.abs(dp)):'';
  $('#popDelta').style.color=dp<0?'var(--bad)':'var(--good)';
}
