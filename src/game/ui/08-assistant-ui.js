/* ---------- build assistant: ghost lines ---------- */
const ASSIST_COL=['#ff6b00','#7b5cff','#00a39a'];
let assistOn=false, assist={job:null,top:[],focus:0,key:'',t:0};
try{ assistOn=localStorage.getItem('mc-assist')==='1'; }catch(e){}
function setAssist(on,quiet){ assistOn=on; try{ localStorage.setItem('mc-assist',on?'1':'0'); }catch(e){} $('#assistBtn').setAttribute('aria-pressed',on);
  if(!on){ assist.job=null; assist.top=[]; assist.key=''; assist.bySrc=null; } suggKey=''; if(G) renderSuggestions(); if(!quiet) toast(t(on?'assistOn':'assistOff')); renderAssist(); }
function assistTick(){
  if(!assistOn||!sim||!G) return;
  if(stroke&&stroke.drawing) return;
  const key=lines.map(L=>L.id+':'+L.stops.join('.')+':'+(L.svc||0)+(L.loop?'o':'')).join('|')+'#'+Math.floor(months/24)+'|'+G.stage+'|'+lastSugg.map(o=>o.type+Math.round(o.x/8)+','+Math.round(o.y/8)).join(';');
  if(!assist.job&&key!==assist.key&&!jobs.length&&performance.now()-assist.t>400){ const t0=performance.now(); assist.key=key; assist.job=assistJob(lastSugg); assist.lastJob=assist.job; assist.jobSig=suggSig(lastSugg); assist.t=performance.now(); assist.msC=Math.max(assist.msC||0,assist.t-t0); if(!assist.top.length) renderAssist(); return; }
  if(assist.job){ const t0=performance.now(); while(performance.now()-t0<5){ if(assist.job.step()){ const prev=assist.top[assist.focus]; assist.top=assist.job.top; assist.job=null;
        const same=prev?assist.top.findIndex(r=>r.type===prev.type&&r.line===prev.line&&r.nodes.length===prev.nodes.length):-1; assist.focus=same>=0?same:0;
        const by={}; (assist.lastJob.bySrc||new Map()).forEach((r,k)=>by[k]=r); assist.bySrc=by; assist.sig=assist.jobSig; suggKey=''; renderSuggestions(); renderAssist(); break; } } assist.ms=Math.max(assist.ms||0,performance.now()-t0); }
}
function assistName(r){ const P=n=>n.id!=null?stById(n.id):n, a=P(r.nodes[0]), b=P(r.nodes[r.nodes.length-1]), L=r.line?lineById(r.line):null, ln=L?lineName(L):'';
  const na=a&&a.name?nm(a.name):nm(placeName(a.x,a.y)), nb=b&&b.name?nm(b.name):nm(placeName(b.x,b.y));
  if(r.type==='ext') return t('assistExt',{l:ln})+'：'+na+' → '+nb;
  if(r.type==='ins') return t('assistIns',{l:ln})+'：'+nm(placeName(a.x,a.y));
  if(r.type==='xfer'){ const L2=lineById(r.line2); return t('assistXfer',{a:ln,b:L2?lineName(L2):''})+'：'+nm(placeName(a.x,a.y)); }
  if(r.type==='exp') return t('assistExpT',{l:ln,s:t('svcName')[r.tier]});
  if(r.type==='loop') return t('assistLoop',{l:ln});
  if(r.type==='ring') return t('assistRing',{n:r.nodes.length});
  return t('assistNew')+'：'+na+' → '+nb; }
function renderAssist(){
  const el=$('#assistCard'); if(!assistOn){ el.hidden=true; return; }
  let h=`<div class="hd">${t('assistTitle')}<small>${assist.top.length?t('assistKeys'):''}</small></div>`;
  if(assist.job&&!assist.top.length) h+=`<div class="none">${t('assistThinking')}</div>`;
  else if(!assist.top.length) h+=`<div class="none">${t('assistNone')}</div>`;
  else { h+=assist.top.map((r,i)=>`<button type="button" class="row${i===assist.focus?' on':''}" data-as="${i}" style="--c:${ASSIST_COL[i]}"><i>${i+1}</i><span class="nm">${assistName(r)}</span><span class="g">${t('assistGain',{m:fmtMin(r.dAvg)})}</span><span class="sub">${r.src?`<b class="src">${t('assistFrom',{n:r.src})}</b> `:''}${t('assistSub',{n:r.nodes.length,r:fmtN(r.dRiders),h:fmtN(-r.dAvg*G.popTotal*0.55*2/60),c:fmtMoney(r.cost)})}</span></button>`).join('');
    h+=`<div class="ft"><span>${t('assistClose')}</span><button type="button" class="btn primary" data-as-go="1">${t('assistAdopt')} ↵</button></div>`; }
  el.innerHTML=h; el.hidden=false;
}
function adoptAssist(i){
  const r=assist.top[i==null?assist.focus:i]; if(!r) return;
  const mk=(n,L)=>{ if(n.id!=null) return stById(n.id); return stations.find(o=>dist(o.x,o.y,n.x,n.y)<1)||newStation(n.x,n.y); };
  let L=null;
  if(r.type==='exp'){ L=lineById(r.line); if(!L) return; pushUndo(); L.svc=r.tier; refreshExpress(true); netVersion++; }
  else if(r.type==='ins'){ L=lineById(r.line); if(!L) return; pushUndo(); const n=r.nodes[0], st=newStation(n.x,n.y), nr=nearestOnLine(L,st.x,st.y); if(!isFinite(nr.d)){ undo(); return; } splitInsert(L,nr.seg,nr.sub,st); joinCrossing(st,L); }
  else if(r.type==='xfer'){ L=lineById(r.line); const L2=lineById(r.line2); if(!L||!L2) return; pushUndo(); const n=r.nodes[0], st=newStation(n.x,n.y);
    for(const M of [L,L2]){ const nr=nearestOnLine(M,st.x,st.y); if(isFinite(nr.d)&&!M.stops.includes(st.id)) splitInsert(M,nr.seg,nr.sub,st); } }
  else if(r.type==='loop'){ L=lineById(r.line); if(!L||L.loop) return; pushUndo(); const add=[]; for(const n of (r.mid||[])){ const st=mk(n,L); if(st&&!L.stops.includes(st.id)) add.push(st); }
    const pts=[...L.stops.slice(-2).map(stById),...add,stById(L.stops[0]),stById(L.stops[1])].map(p=>[p.x,p.y]), Pn=k=>pts[clamp(k,0,pts.length-1)];
    for(let q=0;q<=add.length;q++){ const k=1+q; if(q<add.length) L.stops.push(add[q].id); L.paths.push(catmullSeg(Pn(k-1),Pn(k),Pn(k+1),Pn(k+2),Math.max(2,Math.ceil(dist(Pn(k)[0],Pn(k)[1],Pn(k+1)[0],Pn(k+1)[1])/1.5)))); }
    L.loop=true; add.forEach(st=>joinCrossing(st,L)); }
  else if(r.type==='ring'){ if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); return; } pushUndo(); L=newLine(); const made=[];
    for(const n of r.nodes){ const st=mk(n,L); if(st&&!L.stops.includes(st.id)){ L.stops.push(st.id); if(n.id==null) made.push(st); } }
    if(L.stops.length<4){ undo(); return; } L.loop=true; smoothThrough(L); made.forEach(st=>joinCrossing(st,L,1.6)); }
  else if(r.type==='ext'){ L=lineById(r.line); if(!L||L.loop) return; pushUndo(); if(r.atStart) reverseLine(L);
    const add=[]; for(const n of r.nodes.slice(1)){ const st=mk(n,L); if(st&&!L.stops.includes(st.id)) add.push(st); }
    const pts=[...L.stops.slice(-2).map(stById),...add].map(p=>[p.x,p.y]), off=pts.length-add.length-1, Pn=k=>pts[clamp(k,0,pts.length-1)];
    add.forEach((st,q)=>{ const k=off+q; L.stops.push(st.id); L.paths.push(catmullSeg(Pn(k-1),Pn(k),Pn(k+1),Pn(k+2),Math.max(2,Math.ceil(dist(Pn(k)[0],Pn(k)[1],Pn(k+1)[0],Pn(k+1)[1])/1.5)))); });
    add.forEach(st=>joinCrossing(st,L)); if(r.atStart) reverseLine(L); }
  else { if(activeLineCount()>=MAX_LINES){ toast(t('toastMax',{n:MAX_LINES})); return; }
    pushUndo(); L=newLine(); const made=[];
    for(const n of r.nodes){ const st=mk(n,L); if(st&&!L.stops.includes(st.id)){ L.stops.push(st.id); if(n.id==null) made.push(st); } }
    if(L.stops.length<2){ undo(); return; } smoothThrough(L); made.forEach(st=>joinCrossing(st,L,1.6)); }
  activeLineId=L.id; changed(); updateBuildHint();
  toast(t('assistAdopted',{l:assistName(r),m:fmtMin(r.dAvg)})); SFX.line(); burst(50,vw/2,vh*0.4,1.4);
  assist.top=[]; assist.key=''; renderAssist();
}
function drawAssist(lw){
  if(!assistOn||!assist.top.length||(stroke&&stroke.drawing)) return;
  const px=1/cam.s;
  assist.top.forEach((r,i)=>{ if(i===assist.focus) return; drawGhost(r,i,lw,px,0.38); });
  const r=assist.top[assist.focus]; if(r) drawGhost(r,assist.focus,lw,px,0.95);
}
function drawGhost(r,i,lw,px,a){
  const pts=r.nodes.map(n=>n.id!=null?stById(n.id):n).filter(Boolean); if(!pts.length) return;
  if(r.type==='ins'||r.type==='exp'||r.type==='xfer'){ const pulse=0.5+0.5*Math.sin(performance.now()/260); ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=ASSIST_COL[i]; ctx.lineWidth=lw*0.35;
    for(const p of pts){ ctx.beginPath(); ctx.arc(p.x,p.y,lw*(1.1+pulse*0.5),0,Math.PI*2); ctx.stroke(); if(r.type!=='exp'){ ctx.beginPath(); ctx.arc(p.x,p.y,lw*(r.type==='xfer'?0.95:0.62),0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.fill(); ctx.stroke(); } }
    ctx.restore(); return; }
  if(pts.length<2) return;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=ASSIST_COL[i]; ctx.lineWidth=lw*(a>0.5?1:0.8); ctx.setLineDash([lw*1.6,lw*1.1]); ctx.lineDashOffset=-performance.now()/60*px*4;
  if(r.type==='ring') pts.push(pts[0]);
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let k=1;k<pts.length;k++){ const p0=pts[k-1], p1=pts[k]; ctx.quadraticCurveTo(p0.x,p0.y,(p0.x+p1.x)/2,(p0.y+p1.y)/2); } ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y); ctx.stroke(); ctx.setLineDash([]);
  for(const p of pts){ ctx.beginPath(); ctx.arc(p.x,p.y,lw*0.62,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.fill(); ctx.lineWidth=lw*0.3; ctx.stroke(); }
  ctx.restore();
}
function drawAssistLabels(){
  if(!assistOn||!assist.top.length||(stroke&&stroke.drawing)) return;
  assist.top.forEach((r,i)=>{ const pts=r.nodes.map(n=>n.id!=null?stById(n.id):n).filter(Boolean), m=pts[Math.floor(pts.length/2)]; if(!m) return; const [x,y]=toScreen(m.x,m.y);
    const txt=(i+1)+'  '+t('assistGain',{m:fmtMin(r.dAvg)}); ctx.font=`700 12px ${FONT()}`; const w=ctx.measureText(txt).width+16;
    ctx.globalAlpha=i===assist.focus?0.95:0.6; ctx.fillStyle=ASSIST_COL[i]; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x-w/2,y-26,w,20,10); else ctx.rect(x-w/2,y-26,w,20); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,x,y-15.5); });
}
$('#assistBtn').addEventListener('click',()=>setAssist(!assistOn));
$('#assistCard').addEventListener('click',e=>{ const go=e.target.closest('[data-as-go]'); if(go){ adoptAssist(); return; } const b=e.target.closest('[data-as]'); if(!b) return; const i=+b.dataset.as; if(i===assist.focus&&touchMode) adoptAssist(i); else { assist.focus=i; renderAssist(); const r=assist.top[i], P=r.nodes.map(n=>n.id!=null?stById(n.id):n), a=P[0], c=P[P.length-1]; flyTo((a.x+c.x)/2,(a.y+c.y)/2,Math.min(cam.s,Math.max(2.5,Math.min(vw,vh)*0.55/Math.max(10,dist(a.x,a.y,c.x,c.y))))); } });
