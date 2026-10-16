/* ---------- sim scheduling + UI ---------- */
function scheduleSim(){ clearTimeout(simTimer); simTimer=setTimeout(()=>{ sim=runSim(); updateMetrics(); renderLines(); if(heatMode==='commute') buildCommuteHeat(); if(pendingImpact){ showImpact(pendingImpact); pendingImpact=null; } renderSuggestions(); progressCheck(!progressReady); progressReady=true; },60); }
const KB=4, kw=Math.ceil(W/KB), kh=Math.ceil(H/KB);
function blockGrid(val){ const sum=new Float64Array(kw*kh), n=new Float64Array(kw*kh); G.agents.forEach((a,i)=>{ const k=clamp(Math.floor(a.hy/KB),0,kh-1)*kw+clamp(Math.floor(a.hx/KB),0,kw-1); sum[k]+=val(a,i); n[k]++; }); return {sum,n}; }
function blurGrid(v,w){ const o=new Float64Array(v.length), on=new Float64Array(v.length); for(let y=0;y<kh;y++) for(let x=0;x<kw;x++) for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const X=x+dx,Y=y+dy; if(X<0||Y<0||X>=kw||Y>=kh) continue; const f=(dx||dy)?0.5:1; o[y*kw+x]+=v[Y*kw+X]*f; on[y*kw+x]+=w[Y*kw+X]*f; } return [o,on]; }
function gridCanvas(colorAt){ const c=document.createElement('canvas'); c.width=kw; c.height=kh; const x=c.getContext('2d'), im=x.createImageData(kw,kh); for(let i=0;i<kw*kh;i++){ const col=colorAt(i); if(!col) continue; im.data.set(col,i*4); } x.putImageData(im,0,0); return c; }
function buildCommuteHeat(){
  if(!sim) return; const {sum,n}=blockGrid(a=>a.t); const [bs,bn]=blurGrid(sum,n);
  const ramp=[[44,180,110],[240,200,60],[230,100,60],[170,30,60]];
  if(!G.landFrac){ const lf=new Float32Array(kw*kh); for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(!G.water[y*W+x]) lf[Math.floor(y/KB)*kw+Math.floor(x/KB)]+=1/(KB*KB); G.landFrac=lf; }
  commuteCanvas=gridCanvas(i=>{ if(bn[i]<0.6||G.landFrac[i]<0.15) return null; const tv=clamp((bs[i]/bn[i]-18)/45,0,1)*(ramp.length-1), k=Math.min(ramp.length-2,Math.floor(tv)), f=tv-k; const c=ramp[k].map((v,j)=>v+(ramp[k+1][j]-v)*f); return [c[0],c[1],c[2],Math.min(220,60+bn[i]*16)*Math.min(1,G.landFrac[i]*1.3)]; });
}
function showImpact(before){
  const dA=sim.avg-before.avg, dS=(sim.share-before.share)*100, dC=(sim.cover-before.cover)*100;
  if(Math.abs(dA)<0.05&&Math.abs(dS)<0.05&&Math.abs(dC)<0.5) return;
  const f=(v,unit,goodNeg)=>{ const good=goodNeg?v<0:v>0; return `<b class="${Math.abs(v)<0.05?'':good?'good':'bad'}">${v>0?'+':v<0?'−':'±'}${Math.abs(v).toFixed(1)}${unit}</b>`; };
  const el=$('#impact'); el.innerHTML=`<span class="ttl">${t('impTitle')}</span><span class="it"><span>${t('impAvg')}</span>${f(dA,' '+t('min'),true)}</span><span class="it"><span>${t('impShare')}</span>${f(dS,'%')}</span><span class="it"><span>${t('impWalk')}</span>${f(dC,'%')}</span>`;
  el.hidden=false; clearTimeout(showImpact.tm); showImpact.tm=setTimeout(()=>el.hidden=true,5000);
  // where it changed: per-block change in commute time of the people living there
  const {sum,n}=blockGrid((a,i)=>before.h[i]===a.hx+a.wy*7?(before.t[i]||a.t)-a.t:0); const [bs,bn]=blurGrid(sum,n);
  flashCanvas=gridCanvas(i=>{ if(bn[i]<0.6) return null; const v=bs[i]/bn[i]; if(Math.abs(v)<0.3) return null; const a=Math.min(230,Math.abs(v)/6*230); return v>0?[30,200,110,a]:[230,60,60,a]; });
  flashAt=performance.now();
}
let lastSugg=[], prevSuggKeys=new Set(), listHover=null, pinHover=null, suggMinH=0, suggHKey='';
const SUGG_COL={xfer:'#2b62e8',gap:'#e0812e',corr:'#d3384a',slow:'#b0479a',busy:'#6b4fd8',weak:'#8a90a2',exp:'#c7323f',proj:'#c08a12'};
const SVC_COL=['','#2f8f5b','#e07b1f','#d0303e'];
const hoverSugg=()=>pinHover!=null?pinHover:listHover;
// with the assistant on, every suggestion shows what its best concrete fix would actually achieve
const suggSig=list=>list.map(o=>o.type+Math.round(o.x/8)+','+Math.round(o.y/8)).join(';');
function assistTag(i,list){
  if(!assistOn||!assist.bySrc||assist.sig!==suggSig(list)) return '';
  const r=assist.bySrc[i+1];
  if(!r) return `<span class="ast none">${t('assistTagNone')}</span>`;
  return `<span class="ast">${t('assistTag',{t:t('assistKind')[r.type],m:fmtMin(r.dAvg)})}</span>`;
}
function fmtMin(d){ const a=Math.abs(d); return (a<0.1?a.toFixed(2):a.toFixed(1)); }
function renderSuggestions(){
  if(!sim) return; const list=analyze(); lastSugg=list;
  const nameOf=o=>nm(placeName(o.x,o.y)), ln=id=>{ const L=lineById(id); return L?lineName(L):''; };
  const col=SUGG_COL, keys=list.map(o=>o.type+':'+Math.round(o.x/6)+':'+Math.round(o.y/6));
  const html=list.map((o,i)=>{ let tx,how;
    if(o.type==='xfer'){ tx=t('sugXfer',{a:ln(o.a),b:ln(o.b),p:nameOf(o)}); how=t('sugXferHow',{a:ln(o.a)}); }
    else if(o.type==='gap'){ tx=t('sugGap',{p:nameOf(o),n:fmtN(o.pop)}); how=t('sugGapHow'); }
    else if(o.type==='corr'){ tx=t('sugCorr',{n:fmtN(o.people),a:nameOf(o),b:nm(placeName(o.x2,o.y2)),m:Math.round(o.avg)}); how=t('sugCorrHow'); }
    else if(o.type==='slow'){ tx=t('sugSlow',{n:fmtN(o.people),a:nameOf(o),b:nm(placeName(o.x2,o.y2)),m:Math.round(o.avg)}); how=t(o.why==='none'?'slowNoMetro':o.why==='detour'?'slowDetour':'slowWeak'); }
    else if(o.type==='exp'){ const L=lineById(o.line); tx=t('sugExp',{l:ln(o.line),m:Math.round(o.mins)}); how=t('sugExpHow',{l:ln(o.line),s:t('svcShort')[o.next]}); }
    else if(o.type==='proj'){ tx=t('sugProj',{p:nm(projName(o.proj)),s:t('projState')[o.proj.done?1:0],n:fmtN(o.pop)}); how=t('sugProjHow'); }
    else if(o.type==='busy'){ const st=stById(o.st); tx=t('sugBusy',{s:st?nm(st.name):'',n:fmtN(o.people)}); how=t('sugBusyHow'); }
    else { tx=t('sugWeak',{l:ln(o.line),r:o.ratio}); how=t('sugWeakHow'); }
    o.text=tx; o.how=how; const fresh=prevSuggKeys.size>0&&!prevSuggKeys.has(keys[i]); how+=assistTag(i,list);
    return `<button type="button" data-sg="${i}" class="${fresh?'fresh':''}${hoverSugg()===i?' hot':''}"><i style="background:${col[o.type]}">${i+1}</i><span>${fresh?`<span class="nb">${t('newBadge')}</span>`:''}${tx}<span class="how">${how}</span></span></button>`; }).join('');
  const key=LANG+activeLineCount()+html; if(key===suggKey) return; suggKey=key;
  // the box never shrinks between refreshes (so the line list below doesn't jump up and down); it is re-measured only
  // when the network itself changes, the language changes or the panel is resized
  const el=$('#suggList'), hk=LANG+netVersion+'|'+el.clientWidth; if(hk!==suggHKey){ suggHKey=hk; suggMinH=0; }
  el.innerHTML=(activeLineCount()?'':`<div class="none">${t('sugStart')}</div>`)+(html||`<div class="none">${t('sugNone')}</div>`);
  el.style.minHeight=''; suggMinH=Math.max(suggMinH,el.offsetHeight); el.style.minHeight=suggMinH+'px';
  prevSuggKeys=new Set(keys);
}
function pinPos(o){ const q=toScreen(o.x,o.y); return o.type==='proj'?[q[0]+17,q[1]-24]:q; }
function drawPins(){
  lastSugg.forEach((o,i)=>{ const [x,y]=pinPos(o); if(x<-20||y<-20||x>vw+20||y>vh+20) return; const hot=hoverSugg()===i, r=hot?13:10.5;
    ctx.beginPath(); ctx.arc(x,y,r+2,0,Math.PI*2); ctx.fillStyle=C['card-solid']; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=SUGG_COL[o.type]; ctx.fill();
    ctx.fillStyle='#fff'; ctx.font=`700 ${hot?14:12}px "Barlow Condensed", sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),x,y+0.5); });
}
function pinAt(sx,sy){ for(let i=0;i<lastSugg.length;i++){ const [x,y]=pinPos(lastSugg[i]); if(Math.hypot(x-sx,y-sy)<14) return i; } return null; }
function flyTo(x,y,s){ camAnim={x0:cam.x,y0:cam.y,s0:cam.s,x1:x,y1:y,s1:Math.max(cam.s,s||5),t0:performance.now(),dur:650}; }
function focusSuggestion(o){
  if(o.type==='corr'||o.type==='slow') flyTo((o.x+o.x2)/2,(o.y+o.y2)/2,Math.min(cam.s,Math.max(3,Math.min(vw,vh)*0.5/Math.max(10,dist(o.x,o.y,o.x2,o.y2)))));
  else flyTo(o.x,o.y,6);
  focus={...o,until:performance.now()+7000};
  if(o.type==='xfer'){ const L=lineById(o.a); if(L){ if(tool==='erase') setTool('pan'); activeLineId=L.id; renderLines(); updateBuildHint(); } }
  if(o.type==='weak'||o.type==='exp'){ const L=lineById(o.line); if(L){ if(tool==='erase') setTool('pan'); selectLine(L); } }
  if(window.innerWidth<760) $('#panel').classList.add('collapsed');
}
function drawFocus(){
  const now=performance.now(); if(focus&&now>focus.until) focus=null;
  const hv=hoverSugg()!=null?lastSugg[hoverSugg()]:null;
  if(focus) drawMarker(focus,now); if(hv&&hv!==focus) drawMarker(hv,now);
}
function drawMarker(focus,now){
  const pulse=0.5+0.5*Math.sin(now/220), px=1/cam.s; ctx.save();
  const col=SUGG_COL[focus.type]||C.accent;
  ctx.strokeStyle=col; ctx.lineWidth=2.5*px;
  if(focus.type==='corr'||focus.type==='slow'){
    const mx=(focus.x+focus.x2)/2-(focus.y2-focus.y)*0.18, my=(focus.y+focus.y2)/2+(focus.x2-focus.x)*0.18;
    ctx.setLineDash([8*px,6*px]); ctx.lineDashOffset=-now/40*px; ctx.beginPath(); ctx.moveTo(focus.x,focus.y); ctx.quadraticCurveTo(mx,my,focus.x2,focus.y2); ctx.stroke(); ctx.setLineDash([]);
    for(const [x,y] of [[focus.x,focus.y],[focus.x2,focus.y2]]){ ctx.beginPath(); ctx.arc(x,y,(5+pulse*2.5),0,Math.PI*2); ctx.stroke(); }
    const ang=Math.atan2(focus.y2-my,focus.x2-mx), hx=focus.x2-Math.cos(ang)*(5+pulse*2.5), hy=focus.y2-Math.sin(ang)*(5+pulse*2.5);
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(hx-Math.cos(ang-0.5)*2.4,hy-Math.sin(ang-0.5)*2.4); ctx.lineTo(hx-Math.cos(ang+0.5)*2.4,hy-Math.sin(ang+0.5)*2.4); ctx.closePath(); ctx.fill();
  } else {
    if(focus.type==='exp'){ const L=lineById(focus.line); if(L&&L._path){ ctx.globalAlpha=0.35+0.3*pulse; ctx.lineWidth=(10+4*pulse)*px; ctx.stroke(L._path); ctx.globalAlpha=1; } }
    const big=focus.type==='gap'||focus.type==='proj', r=focus.type==='proj'?9:big?7:2.2; ctx.beginPath(); ctx.arc(focus.x,focus.y,r+pulse*(big?2:1.2),0,Math.PI*2); ctx.stroke();
    if(big){ ctx.fillStyle=col; ctx.globalAlpha=0.08; ctx.fill(); }
  }
  ctx.restore();
}
function changed(save=true){ if(sim&&!pendingImpact) pendingImpact={avg:sim.avg,share:sim.share,cover:sim.cover,t:G.agents.map(a=>a.t),h:G.agents.map(a=>a.hx+a.wy*7)}; cleanup(); netVersion++; renderLines(); scheduleSim(); if(save) persist(); }
function tween(key,to,fmt,el){
  const from=uiShown[key], t0=performance.now(), dur=650;
  const step=(tt)=>{ const f=Math.min(1,(tt-t0)/dur), e=1-Math.pow(1-f,3), v=from+(to-from)*e; el.innerHTML=fmt(v); if(f<1) requestAnimationFrame(step); else uiShown[key]=to; };
  requestAnimationFrame(step);
}
function efficiency(){ if(!sim||!baseline) return 40; return clamp(Math.round(40+(baseline.avg-sim.avg)/baseline.avg*100*1.8),0,100); }
function jamIdx(f){ return f<1.5?0:f<1.8?1:f<2.1?2:f<2.45?3:4; }
const JAMC=['var(--good)','var(--good)','var(--warn)','var(--warn)','var(--bad)'];
function updateMetrics(){
  if(!sim) return;
  tween('avg',sim.avg,v=>v.toFixed(1),$('#mAvg'));
  const dlt=baseline.avg-sim.avg, dEl=$('#mDelta');
  dEl.textContent=(dlt>0.05?'−':dlt<-0.05?'+':'±')+Math.abs(dlt).toFixed(1); dEl.classList.toggle('good',dlt>0.05); dEl.classList.toggle('bad',dlt<-0.05);
  const dp=G.popTotal-growth.pop0;
  $('#mNote').innerHTML=activeLineCount()<1?t('noteNone'):dlt>0.05?t('noteSaved',{h:fmtN(dlt*G.popTotal*0.55*2/60)})+(dp>5000?t('noteGrow',{p:fmtN(dp)}):''):t('noteWeak');
  tween('share',sim.share*100,v=>v.toFixed(1),$('#mShare'));
  tween('cover',sim.cover*100,v=>v.toFixed(0)+'<small>%</small>',$('#mCover'));
  tween('riders',sim.riders,v=>fmtN(v),$('#mRiders'));
  const ji=jamIdx(sim.jam); $('#mJam').innerHTML=`<span style="color:${JAMC[ji]}">${t('jam')[ji]}</span>`;
  $('#mInvest').textContent=fmtMoney(sim.cost);
  const ef=efficiency(); tween('eff',ef,v=>Math.round(v),$('#mEff')); $('#mEff').classList.toggle('good',ef>=70);
}
function renderStripe(){ $('#stripe').innerHTML=lines.filter(L=>L.stops.length>=2).map(L=>`<i style="background:${lineColor(L)}"></i>`).join(''); }
const ICONS={
  extend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17c3 0 4-8 8-8s4 5 8 5"/><path d="M19 10v8M15 14h8"/></svg>',
  del:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
};
const lineName=L=>LANG==='ja'&&L.stops.length>=2?jaLineNames().get(L.id)||t('lineName',{n:L.num}):t('lineName',{n:L.num});
/* Japanese lines are named, not numbered, the way Tokyo's are: by what they do (環状線, 空港線), by direction through the
   centre (東西線, 南北線, 中央線), after the outer terminus of a radial (〇〇線), or by one character from each end, the
   central end first (京葉線 = 東京 + 千葉). Names are handed out in line-number order and never repeat. */
let jaNamesKey='', jaNamesMap=new Map();
function jaLineNames(){
  const key=netVersion+'|'+lines.map(L=>L.id+':'+L.stops.length+(L.loop?'o':'')).join(','); if(key===jaNamesKey) return jaNamesMap; jaNamesKey=key;
  const M=G.centers[0], out=new Map(), taken=new Set(), DIRC='新北南東西上下中大小', jn=st=>nm(st.name,'ja');
  const head=s=>{ const c=[...s]; if(c.length>2&&DIRC.includes(c[0])) c.shift(); return c[0]||''; };
  const give=(L,cands)=>{ for(const c of cands){ if(c&&!taken.has(c)){ taken.add(c); out.set(L.id,c); return true; } } return false; };
  for(const L of lines.filter(L=>L.stops.length>=2).sort((a,b)=>a.num-b.num)){
    const ss=L.stops.map(stById).filter(Boolean), a=ss[0], b=ss[ss.length-1], dc=s=>dist(s.x,s.y,M.x,M.y), cands=[];
    if(L.loop){ const far=ss.reduce((x,y)=>dc(y)>dc(x)?y:x); cands.push('環状線','外環状線',head(jn(far))+'環状線'); }
    else {
      const ap=ss.some(s=>/^st_airport/.test(s.name.k)||s.name.k==='air2'), [inner,outer]=dc(a)<=dc(b)?[a,b]:[b,a];
      const thru=ss.slice(1,-1).some(s=>dc(s)<6), radial=dc(inner)<6, ang=Math.abs(Math.atan2(b.y-a.y,b.x-a.x)), ew=ang<Math.PI*0.28||ang>Math.PI*0.72, ns=ang>Math.PI*0.36&&ang<Math.PI*0.64;
      if(ap&&(dc(a)>15||dc(b)>15)) cands.push('空港線');
      if(thru){ if(ew) cands.push('東西線'); if(ns) cands.push('南北線'); cands.push('中央線'); if(ew) cands.push('新東西線'); if(ns) cands.push('新南北線'); }
      if(radial) cands.push(jn(outer).replace(/(駅|空港)$/,'')+'線');
      const h1=head(jn(inner)), h2=head(jn(outer)); if(h1&&h2&&h1!==h2) cands.push(h1+h2+'線');
      cands.push(jn(outer).replace(/(駅|空港)$/,'')+'線', jn(inner).replace(/(駅|空港)$/,'')+'線'); }
    give(L,cands)||give(L,[t('lineName',{n:L.num})]); }
  jaNamesMap=out; return out;
}
function cycleSvc(L){
  if(L.loop){ toast(t('svcLoop')); return; }
  // upgrades only go up: at the top tier (or short of stations for the next) a click explains why and changes nothing
  const cur=L.svc||0, nx=cur+1; if(nx>3){ toast(t('svcTop',{l:lineName(L),s:t('svcName')[cur]})); return; }
  if(L.stops.length<SVC_MIN[nx]){ toast(t('svcNeed',{l:lineName(L),n:SVC_MIN[nx],s:t('svcName')[nx]})); return; }
  pushUndo(); L.svc=nx; refreshExpress(true);
  if(!L.xs||L.xs.length<nx){ undoStack.pop(); L.svc=cur; refreshExpress(true); toast(t(cur?'svcTop':'svcNeed',{l:lineName(L),s:t('svcName')[cur||nx],n:SVC_MIN[nx]})); return; }   // no stops left to skip
  { const [t0,t1,n]=svcTimes(L), a=stById(L.stops[0]), b=stById(L.stops[L.stops.length-1]); toast(t('svcUp',{l:lineName(L),s:t('svcName')[L.svc],a:nm(a.name),b:nm(b.name),m0:Math.round(t0),m1:Math.round(t1),n})); SFX.up(); }
  netVersion++; changed();
}
function renderLines(){
  renderStripe();
  const box=$('#lineList'); $('#lineCount').textContent=lines.length?' '+activeLineCount():'';
  if(!lines.length){ box.innerHTML=`<div class="empty">${t('empty')}</div>`; return; }
  box.innerHTML=lines.map(L=>{
    const km=(lineLength(L)*CELL_KM).toFixed(1), rd=sim&&sim.lineRide[L.id]!=null?fmtN(sim.lineRide[L.id]):null;
    const first=stById(L.stops[0]), last=stById(L.stops[L.stops.length-1]);
    const title=L.stops.length<2?lineName(L):LANG==='ja'?lineName(L)+(L.loop?'':'　'+t('lineTitle',{a:nm(first.name),b:nm(last.name)})):L.loop?t('loopTitle',{a:nm(first.name)}):t('lineTitle',{a:nm(first.name),b:nm(last.name)});   // Japanese lines go by their names
    const sub=L.stops.length<2?t('building'):t('lineSub',{n:`<b>${L.stops.length}</b>`,km:`<b>${km}</b>`})+(rd!=null?t('lineRide',{r:`<b>${rd}</b>`}):'');
    const lv=L.svc||0, xr=lv&&sim&&sim.expRide&&sim.expRide[L.id]?t('expRide',{r:`<b>${fmtN(sim.expRide[L.id])}</b>`}):'';
    const svc=L.stops.length>=2&&!L.loop?`<div class="svc-row"><button class="svc-btn" type="button" data-act="svc" data-lv="${lv}" title="${t('svcTip')}">${lv?t('svcName')[lv]:'+ '+t('svcShort')[1]}</button><span class="xr">${xr}</span></div>`:'';
    return `<div class="line-item${L.id===activeLineId?' active':''}" data-id="${L.id}" role="button" tabindex="0">
      <span class="swatch" style="background:${lineColor(L)}"></span><span class="lnum">${L.num}</span>
      <div class="info"><div class="t">${title}</div><div class="s">${sub}</div>${svc}</div>
      <div class="acts"><button class="icon-btn" type="button" data-act="extend" aria-label="extend">${ICONS.extend}</button><button class="icon-btn" type="button" data-act="del" aria-label="delete">${ICONS.del}</button></div>
    </div>`;
  }).join('');
}
let toastT=null;
function toast(msg){ const el=$('#toast'); el.textContent=msg; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>el.hidden=true,2600); }
function setTool(tl){
  tool=tl; document.querySelectorAll('.tool[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===tl));
  cvs.classList.toggle('build',tl==='build'); cvs.classList.toggle('erase',tl==='erase');
  cvs.classList.toggle('sel',!!activeLineId&&tl!=='erase');
  if(tl!=='build'){ forceNew=false; const L=lineById(activeLineId); if(L&&(L.stops.length<2||tl==='erase')){ activeLineId=null; if(L.stops.length<2) changed(); else renderLines(); } }
  updateBuildHint();
}
function pinTip(sx,sy){ showTip(sx,sy); clearTimeout(tipTimer); tipTimer=setTimeout(()=>{ $('#tip').hidden=true; hover=null; hoverFlow=null; },3200); }
function applyTouchTexts(){
  const h=document.querySelectorAll('#help li'); if(h.length>=3){ h[0].innerHTML=t(touchMode?'helpT1':'help1'); h[1].innerHTML=t(touchMode?'helpT2':'help2'); h[2].innerHTML=t(touchMode?'helpT3':'help3'); }
  $('#langCycle').textContent=({zh:'中',en:'EN',ja:'日'})[LANG];
  if(G) updateBuildHint();
}
$('#fab').addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); if(stroke&&stroke.drawing&&!stroke.done){ strokePlace(stroke.pen[0],stroke.pen[1]); stroke.held=true; } });
$('#langCycle').addEventListener('click',()=>setLang(({zh:'en',en:'ja',ja:'zh'})[LANG]));
function updateBuildHint(){
  const el=$('#buildHint');
  if(tool==='build'){ const L=lineById(activeLineId); el.innerHTML=L?`<span class="swatch" style="background:${lineColor(L)}"></span><span class="lnum" style="font-size:18px;color:var(--ink)">${L.num}</span><span>${t(touchMode?'hintBuildLineT':'hintBuildLine')}</span>`:`<span>${t(touchMode?'hintBuildT':'hintBuild')}</span>`; el.hidden=false; }
  else if(tool==='erase'){ el.innerHTML=t('hintErase'); el.hidden=false; }
  else if(lineById(activeLineId)){ const L=lineById(activeLineId); el.innerHTML=`<span class="swatch" style="background:${lineColor(L)}"></span><span class="lnum" style="font-size:18px;color:var(--ink)">${L.num}</span><span>${t(touchMode?'hintPanT':'hintPan')}${!touchMode&&L.stops.length>=2&&!L.loop?'　'+t('hintExp'):''}</span>`; el.hidden=false; }
  else el.hidden=true;
  cvs.classList.toggle('sel',!!activeLineId&&tool!=='erase');
}
function stationAt(wx,wy){ const r=Math.max(1.4,13/cam.s); let best=null,bd=r; for(const s of stations){ const d=dist(s.x,s.y,wx,wy); if(d<bd){bd=d;best=s;} } return best; }
const isEnd=(L,id)=>!L.loop&&L.stops.length>=1&&(L.stops[L.stops.length-1]===id||L.stops[0]===id);
