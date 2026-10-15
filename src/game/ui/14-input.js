/* ---------- input ---------- */
const pointers=new Map(); let drag=null, pinch=null;
const rel=e=>{ const r=cvs.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
cvs.addEventListener('pointerdown',e=>{ lastInteract=performance.now();
  if(e.pointerType==='touch'&&!touchMode){ touchMode=true; applyTouchTexts(); }
  try{ cvs.setPointerCapture(e.pointerId); }catch(err){} pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); const ac=audio(); if(ac&&ac.state==='suspended') ac.resume();
  if(pointers.size===2){ const [a,b]=[...pointers.values()]; pinch={d:dist(a.x,a.y,b.x,b.y),s:cam.s,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,cx:cam.x,cy:cam.y}; if(stroke){ const s=stroke; stroke=null; if(s.drawing&&!s.done) netVersion++; } drag=null; return; }
  const [sx,sy]=rel(e), [wx,wy]=toWorld(sx,sy), panBtn=e.button===1||e.button===2;
  camAnim=null; drag={sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y,moved:false,btn:e.button,pan:tool!=='build'||panBtn};
  if(tool==='build'&&!panBtn) stroke=beginStroke(wx,wy,e.pointerType,sx,sy);
});
cvs.addEventListener('pointermove',e=>{ lastInteract=performance.now();
  const [mx,my]=rel(e);
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&pointers.size===2){ const [a,b]=[...pointers.values()]; cam.s=clamp(pinch.s*dist(a.x,a.y,b.x,b.y)/pinch.d,minS(),28);
    cam.x=pinch.cx-((a.x+b.x)/2-pinch.mx)/cam.s; cam.y=pinch.cy-((a.y+b.y)/2-pinch.my)/cam.s; clampCam(); return; }
  if(drag){
    const dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
    if(!drag.moved&&Math.hypot(dx,dy)>5){ drag.moved=true; $('#tip').hidden=true;
      if(stroke){ if(stroke.invalid){ toast(whyNot(...stroke.at)); stroke=null; } else stroke.drawing=true; }
      if(drag.pan) cvs.classList.add('dragging'); }
    if(drag.moved&&drag.pan){ cam.x=drag.cx-dx/cam.s; cam.y=drag.cy-dy/cam.s; clampCam(); return; }
    if(stroke&&stroke.drawing) strokeMove(mx,my,false);
  }
  const ph=(stroke&&stroke.drawing)?null:pinAt(mx,my); if(ph!==pinHover){ pinHover=ph; markHot(); }
  if(pinHover!=null){ const o=lastSugg[pinHover], el=$('#tip'); el.innerHTML=`<div class="f" style="text-align:left;background:none;font-size:12.5px;color:var(--ink)">${o.text}<br><span style="color:var(--ink-3)">${o.how}</span></div>`; el.hidden=false; const w=el.offsetWidth,h=el.offsetHeight; el.style.left=clamp(mx+16,8,vw-w-8)+'px'; el.style.top=clamp(my-h-12,8,vh-h-8)+'px'; hoverWorld=toWorld(mx,my); return; }
  hoverWorld=toWorld(mx,my); hover=stationAt(...hoverWorld); hoverFlow=(heatMode==='demand'&&!stroke&&!hover)?flowAt(...hoverWorld):null; showTip(mx,my);
});
const endPtr=e=>{
  pointers.delete(e.pointerId); cvs.classList.remove('dragging');
  if(pinch){ if(pointers.size<2) pinch=null; drag=null; return; }
  const [sx,sy]=rel(e), [wx,wy]=toWorld(sx,sy);
  if(stroke&&!stroke.drawing&&drag&&!drag.moved&&pinAt(sx,sy)!=null){ stroke=null; focusSuggestion(lastSugg[pinAt(sx,sy)]); drag=null; return; }
  if(stroke){ if(stroke.drawing) endStroke(); else { stroke=null; if(drag&&!drag.moved){ const Lh=lineAt(wx,wy), SLc=lineById(activeLineId); hoverWorld=[wx,wy];
        if(SLc&&SLc.stops.length>=2&&(Lh===SLc||(stationAt(wx,wy)&&snapTarget()&&snapTarget().kind==='xfer'))) spaceInsert();
        else if(Lh&&Lh.id!==activeLineId&&!stationAt(wx,wy)) selectLine(Lh); else buildClick(wx,wy); } } drag=null; return; }
  if(drag&&!drag.moved&&drag.btn===0&&pinAt(sx,sy)!=null){ focusSuggestion(lastSugg[pinAt(sx,sy)]); drag=null; return; }
  if(drag&&!drag.moved){
    if(drag.btn===2){ if(tool==='build') finishLine(); }
    else if(tool==='erase') eraseClick(wx,wy);
    else if(tool==='pan'&&heatMode==='demand'&&!stationAt(wx,wy)&&flowAt(wx,wy)){ const f=flowAt(wx,wy); focusSuggestion({type:'corr',...f}); if(touchMode){ hover=null; hoverFlow=f; pinTip(sx,sy); } }
    else if(tool==='pan'){ const sh=stationAt(wx,wy); if(touchMode&&sh){ hover=sh; hoverFlow=null; pinTip(sx,sy); } const L=lineAt(wx,wy)||(sh&&lines.find(l=>l.stops.includes(sh.id)&&l.stops.length>=2)); if(L) selectLine(L); else if(activeLineId){ activeLineId=null; renderLines(); updateBuildHint(); } }
  }
  drag=null;
};
cvs.addEventListener('pointerup',endPtr); cvs.addEventListener('pointercancel',endPtr);
cvs.addEventListener('pointerleave',()=>{ if(!stroke){ hoverWorld=null; hover=null; } $('#tip').hidden=true; });
cvs.addEventListener('contextmenu',e=>e.preventDefault());
cvs.addEventListener('wheel',e=>{ lastInteract=performance.now();
  e.preventDefault(); camAnim=null; const [mx,my]=rel(e), [wx,wy]=toWorld(mx,my);
  cam.s=clamp(cam.s*Math.exp(-e.deltaY*0.0015),minS(),28); cam.x=wx-(mx-vw/2)/cam.s; cam.y=wy-(my-vh/2)/cam.s; clampCam();
  if(stroke&&stroke.drawing) strokeMove(stroke.sx,stroke.sy,true);
},{passive:false});
function showTip(mx,my){
  const el=$('#tip');
  if(!hover&&hoverFlow&&!(stroke&&stroke.drawing)){ el.innerHTML=flowTipHTML(hoverFlow); el.hidden=false; const w=el.offsetWidth,h=el.offsetHeight; el.style.left=clamp(mx+16,8,vw-w-8)+'px'; el.style.top=clamp(my-h-12,8,vh-h-8)+'px'; return; }
  if(!hover||(stroke&&stroke.drawing)){ el.hidden=true; return; }
  const ls=lines.filter(L=>L.stops.includes(hover.id)&&L.stops.length>=2), b=sim&&sim.stBoard[hover.id]!=null?sim.stBoard[hover.id]:0;
  el.innerHTML=`<div class="n">${nm(hover.name)}</div><div class="lines-of">${ls.map(L=>`<span><i class="swatch" style="background:${lineColor(L)}"></i><span class="lnum">${L.num}</span></span>`).join('')}</div><div class="f">${ls.length>1?t('transfer')+'  ':''}${t('entries',{x:`<b>${fmtN(b)}</b>`})}<br>${t('catch',{n:`<b>${fmtN(catchment(hover))}</b>`})}${(()=>{ const sv=ls.filter(L=>L.svc&&L.xs&&L.xs.length).map(L=>{ const k=svcOf(L,hover.id); return `<span class="lnum" style="font-size:13px">${L.num}</span> ${t('svcName').slice(0,k+1).join('·')}`; }); return sv.length?'<br>'+t('svcStops',{s:sv.join('　')}):''; })()}</div>`;
  el.hidden=false; const w=el.offsetWidth, h=el.offsetHeight; el.style.left=clamp(mx+16,8,vw-w-8)+'px'; el.style.top=clamp(my-h-12,8,vh-h-8)+'px';
}
window.addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input,textarea')) return;
  if(e.key===' '||e.code==='Space'){ e.preventDefault(); if(e.repeat) return; if(stroke&&stroke.drawing) strokePlace(stroke.pen[0],stroke.pen[1]); else if(tool!=='erase') spaceInsert(); return; }
  if((e.key==='a'||e.key==='A')&&!e.ctrlKey&&!e.metaKey){ setAssist(!assistOn); return; }
  if(e.key==='Tab'&&assistOn&&assist.top.length&&!(stroke&&stroke.drawing)){ e.preventDefault(); assist.focus=(assist.focus+(e.shiftKey?assist.top.length-1:1))%assist.top.length; renderAssist(); return; }
  if(e.key==='Enter'&&assistOn&&assist.top.length&&!(stroke&&stroke.drawing)&&!(e.target.closest&&e.target.closest('button,.line-item'))){ e.preventDefault(); adoptAssist(); return; }
  if((e.key==='e'||e.key==='E')&&!e.ctrlKey&&!e.metaKey){ const L=lineById(activeLineId); if(L&&L.stops.length>=2){ cycleSvc(L); return; } }
  if(e.key==='['){ cycleLine(-1); return; } if(e.key===']'){ cycleLine(1); return; }
  if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){ e.preventDefault(); redo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); return; }
  if(e.key==='1') setTool('pan'); else if(e.key==='2') setTool('build'); else if(e.key==='3') setTool('erase');
  else if(e.key==='p'||e.key==='P') togglePlay();
  else if(e.key==='Escape'){ if(!$('#achModal').hidden) $('#achModal').hidden=true; else if(!$('#exportModal').hidden) $('#exportModal').hidden=true; else if(!$('#report').hidden) $('#report').hidden=true; else if(activeLineId) finishLine(); else setTool('pan'); }
});
