/* ---------- loop ---------- */
let clockUIt=0, lastDt=0;
function frame(ts){
  const dt=Math.min(0.1,(ts-lastTs)/1000||0); lastTs=ts; lastDt=dt;
  if(!paused){ trainT+=dt*5*speedMul; growthAcc+=dt*speedMul; if(growthAcc>=3){ growthAcc=0; doGrowth(); } }
  if(jobs.length) runJobs(6);
  if(stroke&&stroke.drawing){ strokeFrame(dt,ts); updateLiveEst(ts); }
  assistTick();
  { const show=touchMode&&tool==='build'&&!!(stroke&&stroke.drawing&&!stroke.done); const fb=$('#fab'); if(fb.hidden===show) fb.hidden=!show; }
  if(camAnim){ const f=clamp((ts-camAnim.t0)/camAnim.dur,0,1), e=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2; cam.x=lerp(camAnim.x0,camAnim.x1,e); cam.y=lerp(camAnim.y0,camAnim.y1,e); cam.s=lerp(camAnim.s0,camAnim.s1,e); clampCam(); if(f>=1) camAnim=null; }
  if(baseJob&&baseRows(baseJob,30)){ if(base2.width!==base.width){ base2.width=base.width; base2.height=base.height; } b2ctx.putImageData(baseJob.img,0,0); baseJob=null; baseFadeAt=ts; }
  frameN++; const busy=!!(stroke&&stroke.drawing)||!!camAnim||ts-lastInteract<400;
  if(busy||drawEMA<13||frameN%2===0){ const t0=performance.now(); draw(); drawEMA=drawEMA*0.9+(performance.now()-t0)*0.1; }
  if(ts-clockUIt>250){ clockUIt=ts; $('#clockLbl').textContent=t('year',{y:Math.floor(months/12)+1,m:months%12+1}); }
  requestAnimationFrame(frame);
}
// one simulated month, split into steps; the frame loop runs them a few milliseconds at a time
function doGrowth(sync){
  if((jobs.length||pendingImpact)&&!sync) return;    // previous month still settling, or an edit is being measured: wait
  months++;
  const used=stations.filter(st=>lines.some(L=>L.stops.length>=2&&L.stops.includes(st.id))); let before=null;
  const steps=[
    ()=>{ before=used.map(catchment); const d=growthTick(); growth.active=stations.length>0||d>0.3;
      const gains=used.map((st,i)=>({st,g:catchment(st)-before[i]})).filter(o=>o.g>250).sort((a,b)=>b.g-a.g).slice(0,5);
      const now=performance.now(); gains.slice(0,speedMul>1?2:4).forEach((o,i)=>{ if(floats.some(f=>f.sid===o.st.id&&now-f.t0<2600)) return; floats.push({sid:o.st.id,x:o.st.x,y:o.st.y,txt:'+'+fmtN(o.g),t0:now+i*160}); });
      yearReview(); },
    ()=>{ const now=performance.now();
      if(months%12===0&&sim){ const fs=checkFacilities(cityLevel(sim.riders)); if(fs.length){ buildPaths(); const f=fs[0], pt=facPoint(f); toast(t('facNew',{f:nm(facName(f))})); SFX.level(); floats.push({x:pt.x,y:pt.y,txt:nm(facName(f)),t0:now,big:true}); burst(60,vw/2,140,1.6); persist(); } }
      const pe=projectsTick(); if(pe.length){ let nr=false; pe.forEach(o=>{ if(o.type==='start') nr=true; }); if(nr) buildPaths();
        pe.forEach((o,i)=>floats.push({x:o.p.x,y:o.p.y,txt:nm(projName(o.p)),t0:now+i*300,big:true}));
        const o=pe[pe.length-1]; toast(t(o.type==='start'?'projStart':'projDone',{p:nm(projName(o.p))})); if(o.type==='done'){ SFX.level(); burst(40,vw/2,140,1.2); } else SFX.up(); persist(); }
      const ev=evolvePlaces(); if(ev.length){ let nr=false; ev.forEach(o=>{ if(roadForPlace(o.x,o.y,o.tier)) nr=true; }); if(nr) buildPaths(); ev.forEach((o,i)=>{ floats.push({x:o.x,y:o.y,txt:nm(o.to),t0:now+i*300,big:true}); }); const o=ev[0];
        toast(o.type==='new'?t('placeNew',{b:nm(o.to)}):t('placeUp',{a:nm(o.from),b:nm(o.to),t:t('tierName')[o.tier]})); SFX.up(); persist(); } },
    ()=>{ roadsTick(); },
    ()=>{ relocate(0.03); },
    ()=>{ buildHeat(); updatePop(); if(months%6===0) persist(); },
    ()=>{ scheduleSim(); }
  ];
  if(sync){ steps.forEach(f=>f()); return; }
  jobs.push(...steps);
}
function runJobs(budget){ const t0=performance.now(); while(jobs.length){ jobs.shift()(); if(performance.now()-t0>budget) break; } }
function updatePop(){
  $('#popLbl').textContent=fmtN(G.popTotal);
  const dp=G.popTotal-growth.pop0; $('#popDelta').textContent=Math.abs(dp)>=5000?(dp>0?'+':'−')+fmtN(Math.abs(dp)):'';
  $('#popDelta').style.color=dp<0?'var(--bad)':'var(--good)';
}
