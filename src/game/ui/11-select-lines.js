/* ---------- selecting lines and adding stops ---------- */
function lineAt(wx,wy){ let best=null,bd=10/cam.s; for(const L of lines){ if(L.stops.length<2) continue; const nr=nearestOnLine(L,wx,wy); if(nr.d<bd){ bd=nr.d; best=L; } } return best; }
function selectLine(L){
  activeLineId=L.id; forceNew=false; renderLines(); updateBuildHint();
  if(L.loop) toast(t('toastSelected',{l:lineName(L)}));
  else toast(t('toastSelected',{l:lineName(L)})+'  '+t('extendHint',{a:nm(stById(L.stops[0]).name),b:nm(stById(L.stops[L.stops.length-1]).name),l:lineName(L)}));
}
function cycleLine(dir){ const ls=lines.filter(l=>l.stops.length>=2); if(!ls.length) return; let i=ls.findIndex(l=>l.id===activeLineId); i=(i+dir+ls.length)%ls.length; if(tool==='erase') setTool('build'); selectLine(ls[i]); }
function snapTarget(){
  const L=lineById(activeLineId); if(!L||L.stops.length<2||!hoverWorld) return null;
  const [cx,cy]=hoverWorld, R=16/cam.s, h=stationAt(cx,cy);
  if(h){ if(L.stops.includes(h.id)) return {kind:'has',st:h}; const nr=nearestOnLine(L,h.x,h.y); return nr.d<Math.max(R,1.4)?{kind:'xfer',st:h,pt:[h.x,h.y]}:{kind:'onto'}; }
  const X=crossingNear(L,cx,cy,R); if(X) return {kind:'xfer',pt:X};
  const nr=nearestOnLine(L,cx,cy); if(nr.d<=R) return {kind:'add',pt:[nr.px,nr.py]};
  return {kind:'onto'};
}
function spaceInsert(){
  const L=lineById(activeLineId); if(!L||L.stops.length<2){ toast(t('toastSelectFirst')); return; }
  const sn=snapTarget(); if(!sn||sn.kind==='onto'){ toast(t('toastMoveOnto',{l:lineName(L)})); return; }
  if(sn.kind==='has'){ toast(t('toastHasStop')); return; }
  let st=sn.st;
  if(!st){ const [x,y]=sn.pt;
    if(!isLand(x,y)){ toast(whyNot(x,y)); return; }
    if(L.stops.some(id=>{ const o=stById(id); return dist(o.x,o.y,x,y)<1.2; })){ toast(t('toastHasStop')); return; }
    pushUndo(); st=stations.find(o=>dist(o.x,o.y,x,y)<1.0)||newStation(x,y);
  } else pushUndo();
  if(!L.stops.includes(st.id)) insertStation(L,st);
  joinCrossing(st,L);
  changed();
  const ls=lines.filter(M=>M.stops.includes(st.id)&&M.stops.length>=2);
  toast(ls.length>1?t('toastXfer',{s:nm(st.name),ls:ls.map(lineName).join(t('sep'))}):t('toastAdded',{l:lineName(L),s:nm(st.name)})); ls.length>1?SFX.xfer():SFX.station();
}
