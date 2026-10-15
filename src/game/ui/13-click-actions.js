/* ---------- click actions ---------- */
function buildClick(wx,wy){
  const hit=stationAt(wx,wy); let L=lineById(activeLineId);
  if(L&&L.loop){ toast(t('toastLoopDone')); return; }
  if(forceNew) L=L&&L.stops.length===0?L:null;
  const tail=L&&L.stops.length?stById(L.stops[L.stops.length-1]):null;
  if(hit){
    if(L&&L.stops.includes(hit.id)){
      if(hit.id===L.stops[0]&&L.stops.length>=3){ pushUndo(); L.paths.push([[tail.x,tail.y],[hit.x,hit.y]]); L.loop=true; changed(); toast(t('toastLoop',{l:lineName(L)})); return; }
      if(hit.id!==L.stops[L.stops.length-1]) toast(t('toastOnLine'));
      return;
    }
    pushUndo(); if(!L){ if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); undoStack.pop(); return; } L=newLine(); }
    activeLineId=L.id; forceNew=false;
    if(tail) L.paths.push([[tail.x,tail.y],[hit.x,hit.y]]);
    L.stops.push(hit.id); changed(); updateBuildHint(); return;
  }
  if(!isLand(wx,wy)){ toast(whyNot(wx,wy)); return; }
  pushUndo(); if(!L){ if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); undoStack.pop(); return; } L=newLine(); }
  activeLineId=L.id; forceNew=false;
  const s=newStation(wx,wy); if(tail) L.paths.push([[tail.x,tail.y],[s.x,s.y]]); L.stops.push(s.id); changed(); updateBuildHint(); SFX.station();
}
function eraseClick(wx,wy){
  const hit=stationAt(wx,wy); if(!hit){ toast(t('toastClickStation')); return; }
  pushUndo(); lines.forEach(L=>{ const k=L.stops.indexOf(hit.id); if(k>=0) removeStop(L,k); });
  stations=stations.filter(s=>s.id!==hit.id); toast(t('toastRemoved',{s:nm(hit.name)})); changed();
}
function finishLine(){ if(!activeLineId) return; activeLineId=null; forceNew=false; changed(); updateBuildHint(); }
function undo(){ if(stroke&&stroke.drawing) return; if(!undoStack.length){ toast(t('toastNoUndo')); return; } redoStack.push(snapshot()); restore(undoStack.pop()); changed(); updateBuildHint(); toast(t('undone')); }
function redo(){ if(stroke&&stroke.drawing) return; if(!redoStack.length){ toast(t('toastNoRedo')); return; } undoStack.push(snapshot()); restore(redoStack.pop()); changed(); updateBuildHint(); toast(t('redone')); }
