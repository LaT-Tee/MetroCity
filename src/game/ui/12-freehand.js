/* ---------- freehand drawing ---------- */
function beginStroke(wx,wy,type,sx,sy){
  const hit=stationAt(wx,wy); let L=null, from=null;
  const act=lineById(activeLineId);
  if(hit){
    if(act&&isEnd(act,hit.id)&&!forceNew) L=act;
    else if(act&&act.stops.length===0) L=act;
    else if(!forceNew){ L=lines.find(l=>l.stops.length>=2&&isEnd(l,hit.id))||null; }
    from=hit;
  } else {
    if(!isLand(wx,wy)) return {invalid:true,drawing:false,at:[wx,wy]};
    from={x:wx,y:wy,isNew:true};
    if(act&&act.stops.length===0) L=act;
  }
  if(L&&L.loop) L=null;
  return {L,from,raw:[],pen:[wx,wy],drawing:false,type,sx,sy,lastMove:performance.now(),held:false,undoPushed:false,
    needReverse:!!(L&&L.stops.length>1&&L.stops[0]===from.id)};
}
function strokePlace(wx,wy){
  const s=stroke; if(!s||!s.from) return false;
  const hit=stationAt(wx,wy);
  const target=hit||(isLand(wx,wy)?{x:wx,y:wy,isNew:true}:null);
  if(!target){ toast(whyNot(wx,wy)); return false; }
  if(hit&&!s.from.isNew&&hit.id===s.from.id) return false;
  const path=smoothPath(s.raw,s.from,target);
  if(plen(path)<1.2) return false;
  let L=s.L;
  // closing a loop: from one end of a line back to its other end. The line is found from both ends, so it works even when the
  // start station is also the end of another line, and a release just beside the far end still counts (busy interchanges)
  if(!s.from.isNew){ const r=Math.max(1.4,13/cam.s)*1.6, cands=lines.filter(M=>M.stops.length>=3&&isEnd(M,s.from.id));
    if(L&&cands.includes(L)){ cands.splice(cands.indexOf(L),1); cands.unshift(L); }
    for(const M of cands){ const farId=M.stops[0]===s.from.id?M.stops[M.stops.length-1]:M.stops[0], fs=stById(farId); if(!fs||farId===s.from.id) continue;
      const df=dist(fs.x,fs.y,wx,wy);
      if((hit&&hit.id===farId)||(df<=r&&(!hit||df<dist(hit.x,hit.y,wx,wy)+1.2))){
        pushUndo(); if(M.stops[0]===s.from.id) reverseLine(M); s.L=M; s.needReverse=false;
        M.paths.push(smoothPath(s.raw,s.from,fs)); M.loop=true; s.done=true; activeLineId=M.id; changed(); toast(t('toastLoop',{l:lineName(M)})); SFX.line(); updateBuildHint(); return true; } } }
  if(hit&&L&&L.stops.includes(hit.id)){
    toast(t('toastOnLine')); return false;
  }
  pushUndo();
  if(!L){ if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); return false; } L=newLine(); s.L=L; }
  activeLineId=L.id; forceNew=false;
  if(L.stops.length===0){ const st0=s.from.isNew?newStation(s.from.x,s.from.y):s.from; L.stops.push(st0.id); if(s.from.isNew) s.newStart=st0; s.from=st0; }
  else if(s.needReverse){ reverseLine(L); s.needReverse=false; }
  const st1=target.isNew?newStation(target.x,target.y):hit;
  L.stops.push(st1.id); L.paths.push(path);
  if(s.newStart){ joinCrossing(s.newStart,L); s.newStart=null; }
  const jn=target.isNew?joinCrossing(st1,L):[]; (jn.length||!target.isNew)?SFX.xfer():SFX.station();
  s.from=st1; s.raw=[];
  changed(); updateBuildHint();
  return true;
}
function strokeFrame(dt,ts){
  const s=stroke, edge=44; let vx=0, vy=0;
  if(s.sx<edge) vx=-(edge-s.sx)/edge; else if(s.sx>vw-edge) vx=(s.sx-(vw-edge))/edge;
  if(s.sy<edge) vy=-(edge-s.sy)/edge; else if(s.sy>vh-edge) vy=(s.sy-(vh-edge))/edge;
  if(vx||vy){ cam.x+=vx*520*dt/cam.s; cam.y+=vy*520*dt/cam.s; clampCam(); strokeMove(s.sx,s.sy,true); }
  if(s.type==='touch'&&!s.held&&ts-s.lastMove>650&&!s.done){ s.held=true; strokePlace(s.pen[0],s.pen[1]); }
}
function strokeMove(sx,sy,auto){
  const s=stroke; const [wx,wy]=toWorld(sx,sy); s.sx=sx; s.sy=sy; s.pen=[wx,wy];
  const l=s.raw.length?s.raw[s.raw.length-1]:[s.from.x,s.from.y];
  if(dist(wx,wy,l[0],l[1])>=0.35){ s.raw.push([wx,wy]); if(!auto){ s.lastMove=performance.now(); s.held=false; } }
}
function endStroke(){
  const s=stroke; stroke=null; if(!s||!s.drawing||s.done) return;
  const len=plen([[s.from.x,s.from.y],...s.raw]);
  if(len>=1.5) { stroke=s; strokePlace(s.pen[0],s.pen[1]); stroke=null; }
  const L=s.L; if(L&&L.stops.length>=2&&!L.loop){ toast(t('toastBuilt',{l:lineName(L),n:L.stops.length})); SFX.line(); }
}
