/* ---------- city lifecycle + persistence ---------- */
function persist(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify({nameVer:2,seed:G.seed,stations,lines,nextSid,nextLineNum,months,unlocked:[...unlocked],prevLevel,yearStats,stage:G.stage,pop0:growth.pop0,places:placeState()},jsonRep)); }catch(e){} }
function newCity(seed,saved){
  jobs=[]; if(typeof assist!=='undefined'){ assist.job=null; assist.top=[]; assist.key=''; } G=generate(seed); initGrowth(); redoStack=[];
  if(saved){ for(let k=1;k<=(saved.stage||0);k++) setStage(k); applyPlaceState(saved.places); if(saved.pop0) growth.pop0=saved.pop0; } unlocked=new Set(saved&&saved.unlocked||[]); prevLevel=saved&&saved.prevLevel!=null?saved.prevLevel:-1; yearStats=saved&&saved.yearStats||null; progressReady=false; floats=[]; confetti=[]; achQueue=[]; stations=[]; lines=[]; nextSid=1; nextLineNum=1; activeLineId=null; undoStack=[]; sim=null; months=0; stroke=null; forceNew=false;
  if(saved){ stations=saved.stations||[]; lines=saved.lines||[]; nextSid=saved.nextSid||1; nextLineNum=saved.nextLineNum||(lines.reduce((m,l)=>Math.max(m,l.num),0)+1); months=saved.months||0;
    if(saved.nameVer!==2) stations.forEach(s=>{ s.name=null; });        // names from an older naming scheme: rename once, consistently
    stations.forEach(s=>{ if(!s.name||typeof s.name==='string'||s.name.r) s.name=nameStation(s.x,s.y); });
    lines.forEach((L,i)=>{ if(L.ci==null) L.ci=(L.num-1)%LINE_COLORS.length; ensurePaths(L); });
    if(G.dRestored){ relocate(0.7); growth.lastBaseD=Float32Array.from(G.D); } else if(activeLineCount()){ sim=runSim(); for(let k=0;k<40;k++){ growthTick(); relocate(0.03); } growth.active=true; } }
  if(!G.rn) rnBuild();
  sim=runSim(); baseline=baseline||{avg:0,jam:1};
  renderBase(); buildPaths(); fit(); netVersion++; geomKey='';
  refreshSign(); updatePop();
  uiShown={avg:sim.avg,share:sim.share*100,cover:sim.cover*100,riders:sim.riders,eff:efficiency()};
  $('#mAvg').textContent=sim.avg.toFixed(1);
  pendingImpact=null; flashCanvas=null; focus=null; commuteCanvas=null; suggKey=''; heatPrev=null;
  setTool('pan'); renderLines(); updateMetrics(); renderSuggestions(); if(heatMode==='commute') buildCommuteHeat(); persist();
}
function placeHelp(){ const h=$('#help'); if(vw>=760) h.style.top=($('.sign').getBoundingClientRect().bottom+12)+'px'; else h.style.top=''; }
function onTheme(){ if(!G) return; layerVer++; renderBase(); geomKey=''; renderLines(); }
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',onTheme);
new MutationObserver(onTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
window.addEventListener('resize',()=>{ resize(); clampCam(); placeHelp(); });

resize();
let lang0=null; try{ lang0=localStorage.getItem('mc-lang'); }catch(e){}
if(!lang0){ const nl=(navigator.language||'zh').toLowerCase(); lang0=nl.startsWith('ja')?'ja':nl.startsWith('zh')?'zh':'en'; }
LANG=lang0; setLang(lang0);
let saved=null; try{ saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null'); }catch(e){}
try{ if(localStorage.getItem('mc-help')) $('#help').hidden=true; }catch(e){}
if(vw<760) $('#panel').classList.add('collapsed');
{ const ld=$('#loading'); ld.textContent=t('generating'); ld.hidden=false;
  setTimeout(()=>{ if(saved&&saved.seed) newCity(saved.seed,saved); else newCity(Math.floor(Math.random()*99999)+1);
    setLang(LANG); setAssist(assistOn,true); ld.hidden=true; requestAnimationFrame(frame); placeHelp(); if(document.fonts) document.fonts.ready.then(placeHelp); },30); }
window.__mc={get ready(){ return !!(G&&G.rn&&sim); },get unlocked(){ return [...unlocked]; },adoptTop:()=>{ const job=assistJob(analyze()); while(!job.step()); assist.top=job.top; const r=job.top[0]; if(r){ adoptAssist(0); return r.type; } return null; },drawStats:()=>({ema:drawEMA.toFixed(1),lo:!!sceneLo,up:!!sceneUp,assistMs:(assist.ms||0).toFixed(1)+' / create '+(assist.msC||0).toFixed(1),est:stroke&&stroke.est,st:stroke?{d:stroke.drawing,inv:!!stroke.invalid,L:!!stroke.L}:null,tool}),newCity,fit,doGrowth:()=>doGrowth(true),cycleSvc,changed,selectLine,isLand,get sugg(){ return lastSugg; },get cam(){ return cam; }};
