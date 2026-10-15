/* ---------- buttons ---------- */
document.querySelectorAll('.tool[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#undoBtn').addEventListener('click',undo);
$('#redoBtn').addEventListener('click',redo);
$('#newLineBtn').addEventListener('click',()=>{ if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); return; } setTool('build'); activeLineId=null; forceNew=true; renderLines(); updateBuildHint(); toast(t('toastNewLine',{l:t('lineName',{n:nextLineNum})})); });
$('#lineList').addEventListener('click',e=>{
  const item=e.target.closest('.line-item'); if(!item) return; const L=lineById(item.dataset.id); if(!L) return; const act=e.target.closest('[data-act]')?.dataset.act;
  if(act==='svc'){ cycleSvc(L); return; }
  if(act==='del'){ pushUndo(); lines=lines.filter(l=>l!==L); if(activeLineId===L.id) activeLineId=null; toast(t('toastLineDel',{l:lineName(L)})); changed(); updateBuildHint(); return; }
  if(tool==='erase') setTool('build');
  if(L.stops.length>=2) selectLine(L); else { activeLineId=L.id; renderLines(); updateBuildHint(); }
});
$('#lineList').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.classList.contains('line-item')) e.target.click(); });
$('#heatSeg').addEventListener('click',e=>{ const b=e.target.closest('[data-heat]'); if(!b) return; heatMode=b.dataset.heat; document.querySelectorAll('#heatSeg button').forEach(c=>c.setAttribute('aria-pressed',c===b)); if(heatMode==='commute') buildCommuteHeat(); updateLegend(); });
function updateLegend(){ const lg=$('#heatLegend'); lg.classList.toggle('off',heatMode==='off'); $('#legBar').classList.toggle('commute',heatMode==='commute'); $('#legBar').classList.toggle('demand',heatMode==='demand'); $('#legL').textContent=heatMode==='commute'?t('short'):heatMode==='demand'?t('dLegL'):t('sparse'); $('#legR').textContent=heatMode==='commute'?t('long'):heatMode==='demand'?t('dLegR'):t('crowded'); }
function markHot(){ document.querySelectorAll('#suggList button').forEach(b=>b.classList.toggle('hot',+b.dataset.sg===hoverSugg())); }
$('#suggList').addEventListener('mouseover',e=>{ const b=e.target.closest('[data-sg]'); const v=b?+b.dataset.sg:null; if(v!==listHover){ listHover=v; markHot(); } });
$('#suggList').addEventListener('mouseleave',()=>{ listHover=null; markHot(); });
$('#suggList').addEventListener('click',e=>{ const b=e.target.closest('[data-sg]'); if(!b) return; const o=lastSugg[+b.dataset.sg]; if(o) focusSuggestion(o); });
function togglePlay(){ paused=!paused; $('#playIcon').innerHTML=paused?'<path d="M7 5l12 7-12 7z"/>':'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'; }
$('#playBtn').addEventListener('click',togglePlay);
$('#speedBtn').addEventListener('click',()=>{ speedMul=speedMul===1?2:speedMul===2?4:1; $('#speedBtn').textContent=speedMul+'×'; });
function newCityAsync(seed,cb){ const ld=$('#loading'); ld.textContent=t('generating'); ld.hidden=false; setTimeout(()=>{ newCity(seed); ld.hidden=true; if(cb) cb(); },30); }
$('#newCity').addEventListener('click',()=>newCityAsync(Math.floor(Math.random()*99999)+1,()=>toast(t('toastNewCity',{c:nm({k:'city'})}))));
$('#panelToggle').addEventListener('click',()=>$('#panel').classList.toggle('collapsed'));
const hideHelp=()=>{ $('#help').hidden=true; try{ localStorage.setItem('mc-help','1'); }catch(e){} };
$('#helpClose').addEventListener('click',hideHelp);
$('#helpGo').addEventListener('click',()=>{ hideHelp(); setTool('build'); });
$('#reportBtn').addEventListener('click',openReport);
$('#achBtn').addEventListener('click',openAch);
$('#expandBtn').addEventListener('click',doExpand);
$('#achClose').addEventListener('click',()=>$('#achModal').hidden=true);
$('#achModal').addEventListener('click',e=>{ if(e.target.id==='achModal') $('#achModal').hidden=true; });
$('#exportBtn').addEventListener('click',exportMap);
$('#exClose').addEventListener('click',()=>$('#exportModal').hidden=true);
$('#exportModal').addEventListener('click',e=>{ if(e.target.id==='exportModal') $('#exportModal').hidden=true; });
$('#muteBtn').addEventListener('click',()=>{ const ac=audio(); if(ac&&ac.state==='suspended') ac.resume(); setSound(!soundOn); if(soundOn) SFX.station(); });
$('#repClose').addEventListener('click',()=>$('#report').hidden=true);
$('#repNew').addEventListener('click',()=>{ $('#report').hidden=true; newCityAsync(Math.floor(Math.random()*99999)+1); });
$('#report').addEventListener('click',e=>{ if(e.target.id==='report') $('#report').hidden=true; });
$('#langs').addEventListener('click',e=>{ const b=e.target.closest('[data-lang]'); if(b) setLang(b.dataset.lang); });
