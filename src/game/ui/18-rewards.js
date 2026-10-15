/* ---------- rewards: sound, confetti, floating gains, achievements, levels ---------- */
let AC=null, soundOn=true, floats=[], confetti=[], unlocked=new Set(), achQueue=[], achBusy=false, prevLevel=-1, yearStats=null, hoverFlow=null, progressReady=false;
try{ soundOn=localStorage.getItem('mc-sound')!=='0'; }catch(e){}
function audio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ AC=null; } } return AC; }
function tone(f,dur,delay,type,vol){ if(!soundOn) return; const a=audio(); if(!a||a.state!=='running') return; const t0=a.currentTime+(delay||0), o=a.createOscillator(), g=a.createGain();
  o.type=type||'sine'; o.frequency.value=f; g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol||0.09,t0+0.012); g.gain.exponentialRampToValueAtTime(0.0008,t0+dur); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0+dur+0.05); }
const SFX={ station:()=>tone(880,0.12,0,'sine',0.07), line:()=>{ tone(523,0.18); tone(784,0.26,0.09); }, xfer:()=>{ tone(659,0.16); tone(784,0.16,0.07); tone(988,0.3,0.14); },
  ach:()=>[523,659,784,1047].forEach((f,i)=>tone(f,0.32,i*0.08,'triangle',0.08)), level:()=>[392,523,659,784,1047,1319].forEach((f,i)=>tone(f,0.5,i*0.09,'triangle',0.08)), up:()=>{ tone(740,0.12,0,'sine',0.06); tone(1109,0.22,0.06,'sine',0.06); } };
function setSound(on){ soundOn=on; try{ localStorage.setItem('mc-sound',on?'1':'0'); }catch(e){} $('#muteIcon').innerHTML=on?'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>':'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'; $('#muteBtn').setAttribute('aria-label',t('mute')); }
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function burst(n,sx,sy,spread){ if(reduceMotion) return; for(let i=0;i<n;i++){ const a=-Math.PI/2+(Math.random()-0.5)*spread, v=260+Math.random()*420; confetti.push({x:sx+(Math.random()-0.5)*40,y:sy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*6.28,vr:(Math.random()-0.5)*12,c:LINE_COLORS[Math.floor(Math.random()*LINE_COLORS.length)],w:5+Math.random()*5,life:1.8+Math.random()*0.8,t:0}); } }
function drawFx(dt){
  const now=performance.now();
  floats=floats.filter(f=>now-f.t0<2600);
  for(const f of floats){ const k=(now-f.t0)/2600, [x,y]=toScreen(f.x,f.y); ctx.globalAlpha=k<0.15?k/0.15:1-Math.max(0,(k-0.55)/0.45);
    ctx.font=`700 ${f.big?15:13}px ${FONT()}`; ctx.textAlign='center'; ctx.textBaseline='middle'; const yy=y-18-k*34;
    ctx.lineWidth=3.5; ctx.strokeStyle=C.halo; ctx.strokeText(f.txt,x,yy); ctx.fillStyle=C.good; ctx.fillText(f.txt,x,yy); ctx.globalAlpha=1; }
  if(confetti.length){ for(const p of confetti){ p.t+=dt; p.vy+=900*dt; p.vx*=0.985; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=p.vr*dt;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.globalAlpha=Math.max(0,1-p.t/p.life); ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.w/4,p.w,p.w/2); ctx.restore(); }
    confetti=confetti.filter(p=>p.t<p.life&&p.y<vh+40); ctx.globalAlpha=1; }
}
function medalColor(id){ const i=ACH.findIndex(a=>a[0]===id); return LINE_COLORS[(i*7)%LINE_COLORS.length]; }
function showNextAch(){
  if(achBusy||!achQueue.length) return; achBusy=true; const id=achQueue.shift(), tx=t('ach')[id];
  const el=$('#achPop'); el.innerHTML=`<span class="medal" style="background:${medalColor(id)}">${ACH.findIndex(a=>a[0]===id)+1}</span><span><span class="t1">${t('achUnlocked')}</span><br><span class="t2">${tx[0]}</span><br><span class="t3">${tx[1]}</span></span>`;
  el.hidden=false; el.style.animation='none'; void el.offsetWidth; el.style.animation='';
  SFX.ach(); burst(50,vw/2,150,1.6);
  setTimeout(()=>{ el.hidden=true; achBusy=false; showNextAch(); },2800);
}
function updateAchBtn(){ $('#achBtn').textContent=t('achBtn',{a:unlocked.size,b:ACH.length}); }
let expandShown=false;
function updateExpand(){ const ok=G&&canExpand(); const b=$('#expandBtn'); if(!b) return; b.hidden=!ok; if(ok&&!expandShown&&progressReady){ toast(t('expandReady')); SFX.up(); } expandShown=ok; }
function doExpand(){ if(!canExpand()) return; setStage(G.stage+1); pendingImpact=null; flashCanvas=null; const B=G.bounds; flyTo((B[0]+B[2])/2,(B[1]+B[3])/2,0.01); camAnim.s1=Math.max(minS()*1.15,0.5);
  toast(t('expanded',{w:Math.round((B[2]-B[0])*CELL_KM),h:Math.round((B[3]-B[1])*CELL_KM)})); SFX.level(); burst(140,vw/2,vh*0.35,2.4); updatePop(); netVersion++; scheduleSim(); persist(); expandShown=false; updateExpand(); }
function updateLevel(){
  const r=sim?sim.riders:0, lv=cityLevel(r), names=t('lvl');
  $('#lvlName').textContent='Lv'+(lv+1)+'  '+names[lv];
  if(lv<LEVEL_AT.length-1){ $('#lvlNext').textContent=t('lvlNext',{n:fmtN(LEVEL_AT[lv+1])}); $('#lvlBar').style.width=clamp((r-LEVEL_AT[lv])/(LEVEL_AT[lv+1]-LEVEL_AT[lv])*100,2,100)+'%'; }
  else { $('#lvlNext').textContent=t('lvlMax'); $('#lvlBar').style.width='100%'; }
  updateExpand();
  return lv;
}
function progressCheck(silent){
  if(!sim) return;
  // station upgrades
  for(const st of stations){ const nl=stationLevel(sim.stBoard[st.id]||0), ol=st.lv||0;
    if(nl>ol&&nl>=2&&!silent){ toast(t('stUp',{s:nm(st.name),l:t('stLv')[nl]})); SFX.up(); floats.push({x:st.x,y:st.y,txt:nm(st.name)+' '+t('stLv')[nl],t0:performance.now(),big:true}); }
    st.lv=nl; }
  // city level
  const lv=updateLevel();
  if(prevLevel>=0&&lv>prevLevel&&!silent){ toast(t('lvlUp',{l:t('lvl')[lv]})); SFX.level(); burst(170,vw/2,vh*0.35,2.4); }
  prevLevel=Math.max(prevLevel,lv);
  // achievements
  const c=achContext();
  for(const [id,test] of ACH){ if(unlocked.has(id)) continue; if(test(c)){ unlocked.add(id); if(!silent) achQueue.push(id); } }
  updateAchBtn(); showNextAch();
}
function openAch(){
  $('#achSub').textContent=t('achBtn',{a:unlocked.size,b:ACH.length});
  $('#achGrid').innerHTML=ACH.map(([id],i)=>{ const tx=t('ach')[id], on=unlocked.has(id); return `<div class="ach-item${on?'':' locked'}"><span class="medal" style="background:${medalColor(id)}">${i+1}</span><span><b>${tx[0]}</b><span>${tx[1]}</span></span></div>`; }).join('');
  $('#achModal').hidden=false;
}
// travel-demand arcs
function flowCurve(f){ const mx=(f.x+f.x2)/2-(f.y2-f.y)*0.18, my=(f.y+f.y2)/2+(f.x2-f.x)*0.18; return [mx,my]; }
function flowColor(f){ return f.share>=0.5?'#22a866':f.share>=0.2?'#f0a03c':'#d3384a'; }
function drawFlows(){
  if(!sim||!sim.flows) return; const px=1/cam.s; ctx.save(); ctx.lineCap='round';
  const list=sim.flows.slice().reverse();
  for(const f of list){ const [mx,my]=flowCurve(f), w=clamp(Math.sqrt(f.people)/22,1.6,10)*px, hot=hoverFlow===f;
    ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.quadraticCurveTo(mx,my,f.x2,f.y2);
    ctx.strokeStyle=C.halo; ctx.globalAlpha=0.7; ctx.lineWidth=w+2.5*px; ctx.stroke();
    ctx.strokeStyle=flowColor(f); ctx.globalAlpha=hot?1:0.78; ctx.lineWidth=hot?w*1.4:w; ctx.stroke();
    const ang=Math.atan2(f.y2-my,f.x2-mx), L=Math.max(3,w/px*0.9)*px*2.2; ctx.fillStyle=flowColor(f); ctx.beginPath(); ctx.moveTo(f.x2,f.y2); ctx.lineTo(f.x2-Math.cos(ang-0.45)*L,f.y2-Math.sin(ang-0.45)*L); ctx.lineTo(f.x2-Math.cos(ang+0.45)*L,f.y2-Math.sin(ang+0.45)*L); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(f.x,f.y,Math.max(2.5*px,w*0.6),0,Math.PI*2); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha=1;
}
function flowAt(wx,wy){ if(!sim||!sim.flows) return null; let best=null, bd=9/cam.s;
  for(const f of sim.flows){ const [mx,my]=flowCurve(f); for(let k=0;k<=16;k++){ const tt=k/16, x=(1-tt)*(1-tt)*f.x+2*(1-tt)*tt*mx+tt*tt*f.x2, y=(1-tt)*(1-tt)*f.y+2*(1-tt)*tt*my+tt*tt*f.y2, d=dist(x,y,wx,wy); if(d<bd){ bd=d; best=f; } } }
  return best; }
function flowTipHTML(f){ return `<div class="n" style="font-size:14px;letter-spacing:0">${t('flowTip',{a:nm(placeName(f.x,f.y)),b:nm(placeName(f.x2,f.y2))})}</div><div class="f">${t('flowPeople',{n:`<b>${fmtN(f.people)}</b>`})}<br>${t('flowCar',{m:`<b>${Math.round(f.car)}</b>`})}  ${f.metro!=null?t('flowMetro',{m:`<b>${Math.round(f.metro)}</b>`}):t('flowNoMetro')}<br>${t('flowShare',{p:`<b>${Math.round(f.share*100)}</b>`})}</div>`; }
// yearly review
function yearReview(){
  if(!sim) return; const now={riders:sim.riders,pop:G.popTotal,st:stations.length};
  if(yearStats&&months>0&&months%12===0&&activeLineCount()){
    const dr=yearStats.riders>0?(now.riders/yearStats.riders-1)*100:null, dp=now.pop-yearStats.pop, ds=now.st-yearStats.st;
    const el=$('#impact'), g=v=>v>0?'good':v<0?'bad':'';
    el.innerHTML=`<span class="ttl">${t('yearTitle',{y:Math.floor(months/12)})}</span><span class="it"><span>${t('yearRiders')}</span><b class="${g(dr||1)}">${dr==null?fmtN(now.riders):(dr>=0?'+':'−')+Math.abs(dr).toFixed(0)+'%'}</b></span><span class="it"><span>${t('yearPop')}</span><b class="${g(dp)}">${dp>=0?'+':'−'}${fmtN(Math.abs(dp))}</b></span><span class="it"><span>${t('yearSt')}</span><b>+${Math.max(0,ds)}</b></span>`;
    el.hidden=false; clearTimeout(showImpact.tm); showImpact.tm=setTimeout(()=>el.hidden=true,5500); SFX.up();
  }
  if(months%12===0||!yearStats) yearStats=now;
}
// export a clean transit map
function exportMap(){
  $('#exportModal').hidden=false; const img=$('#exImg'); img.removeAttribute('src'); img.alt=t('exportMaking');
  $('#exTitle').textContent=t('exportTitle',{c:nm({k:'city'})}); $('#exSub').textContent=t('exportMaking'); $('#exSave').removeAttribute('href');
  setTimeout(()=>{
    let x0=0,y0=0,x1=W,y1=H; const used=stations.filter(st=>lines.some(L=>L.stops.length>=2&&L.stops.includes(st.id)));
    if(used.length){ x0=Math.min(...used.map(s=>s.x))-26; x1=Math.max(...used.map(s=>s.x))+26; y0=Math.min(...used.map(s=>s.y))-30; y1=Math.max(...used.map(s=>s.y))+22;
      let bw=x1-x0, bh=y1-y0; const cxm=(x0+x1)/2, cym=(y0+y1)/2; if(bw<bh*1.25) bw=bh*1.25; if(bh<bw/1.7) bh=bw/1.7; bw=Math.max(bw,90); bh=Math.max(bh,60);
      x0=clamp(cxm-bw/2,0,W-Math.min(W,bw)); x1=Math.min(W,x0+bw); y0=clamp(cym-bh/2,0,H-Math.min(H,bh)); y1=Math.min(H,y0+bh); }
    const cw=x1-x0, ch=y1-y0, P=clamp(2600/cw,5,16), out=document.createElement('canvas'), cx=out.getContext('2d');
    out.width=Math.round(cw*P); out.height=Math.round(ch*P);
    const job=baseSetup({ox:x0,oy:y0,cw,ch,ppc:P,pal:LIGHT_PAL,ctx:cx,urban:true}); baseRows(job,job.bh); cx.putImageData(job.img,0,0);
    const ink='#1a1f2e', u=P/5;
    cx.setTransform(P,0,0,P,-x0*P,-y0*P); cx.lineCap='round'; cx.lineJoin='round';
    const px=1/P; cx.strokeStyle='#e6f2fa'; for(const r of P2.rivers){ cx.lineWidth=r.w; cx.stroke(r.p); }
    strokeRoads(cx,u*px*2,{edge:'#d3d6e4',core:'#fff',hwy:'#bfc3cd'},1,0.8);
    cx.strokeStyle='#a9adb7'; cx.lineWidth=2.6*u*px*2; cx.stroke(P2.rail); cx.setLineDash([6*u*px*2,6*u*px*2]); cx.strokeStyle='#fbfbf8'; cx.lineWidth=1.2*u*px*2; cx.stroke(P2.rail); cx.setLineDash([]);
    cx.fillStyle='#e9ebf1'; cx.fill(P2.apron); cx.fillStyle='#9ea4b0'; cx.fill(P2.runways);
    const lw=Math.max(0.55,3.2*u*px*1.6); geomKey=''; lineGeometry(lw);
    const built=lines.filter(L=>L.stops.length>=2);
    for(const L of built){ cx.strokeStyle='#ffffff'; cx.lineWidth=lw+2*u*px*1.6; cx.stroke(L._path); }
    for(const L of built){ cx.strokeStyle=LINE_COLORS[L.ci]; cx.lineWidth=lw; cx.stroke(L._path); }
    const cnt=new Map(); built.forEach(L=>L.stops.forEach(id=>cnt.set(id,(cnt.get(id)||0)+1)));
    for(const st of used){ const tr=(cnt.get(st.id)||0)>1, r=tr?lw*0.95:lw*0.6; cx.beginPath(); cx.arc(st.x,st.y,r,0,Math.PI*2); cx.fillStyle='#fff'; cx.fill(); cx.lineWidth=tr?lw*0.34:lw*0.3; cx.strokeStyle=tr?ink:LINE_COLORS[built.find(L=>L.stops.includes(st.id)).ci]; cx.stroke(); }
    geomKey='';
    // labels in pixel space
    cx.setTransform(1,0,0,1,0,0); const fam=FONT(), boxes=[];
    const lab=(text,X,Y,size,weight,color)=>{ cx.font=`${weight} ${size}px ${fam}`; const w=cx.measureText(text).width+6, b=[X-w/2,Y-size/2-2,X+w/2,Y+size/2+2]; if(boxes.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1])) return; boxes.push(b); cx.textAlign='center'; cx.textBaseline='middle'; cx.lineWidth=Math.max(3,size*0.28); cx.strokeStyle='rgba(255,255,255,.95)'; cx.lineJoin='round'; cx.strokeText(text,X,Y); cx.fillStyle=color; cx.fillText(text,X,Y); };
    const S=(x,y)=>[(x-x0)*P,(y-y0)*P], fs=clamp(P*1.25,11,19);
    const order=used.slice().sort((a,b)=>(cnt.get(b.id)||0)-(cnt.get(a.id)||0));
    for(const st of order){ const [X,Y]=S(st.x,st.y), tr=(cnt.get(st.id)||0)>1; lab(nm(st.name),X,Y-lw*P-fs*0.75,tr?fs*1.06:fs*0.92,tr?700:500,ink); }
    for(const c of G.centers){ const [X,Y]=S(c.x,c.y-c.s*0.3); if(X>0&&Y>0&&X<out.width&&Y<out.height) lab(nm(c.name),X,Y,fs*1.1,700,'#7a8095'); }
    // title block
    const pad=Math.round(out.width*0.025), tsz=Math.round(out.width*0.03);
    cx.textAlign='left'; cx.textBaseline='alphabetic';
    const title=t('exportTitle',{c:nm({k:'city'})}), km=(built.reduce((a,L)=>a+lineLength(L),0)*CELL_KM).toFixed(0);
    const stats=t('exportStats',{l:built.length,s:used.length,km,r:fmtN(sim?sim.riders:0)});
    cx.font=`900 ${tsz}px ${fam}`; const tw=cx.measureText(title).width; cx.font=`500 ${Math.round(tsz*0.42)}px ${fam}`; const sw=cx.measureText(stats).width;
    cx.fillStyle='rgba(255,255,255,.92)'; cx.fillRect(pad*0.6,pad*0.6,Math.max(tw,sw)+pad*0.9,tsz*1.95);
    cx.fillStyle=ink; cx.font=`900 ${tsz}px ${fam}`; cx.fillText(title,pad,pad*0.6+tsz*1.05); cx.fillStyle='#545b70'; cx.font=`500 ${Math.round(tsz*0.42)}px ${fam}`; cx.fillText(stats,pad,pad*0.6+tsz*1.7);
    // legend in two columns, bottom-left, like a printed system map
    if(built.length){ const rh=Math.round(tsz*0.62), sw2=Math.round(rh*1.6), cols=Math.min(4,Math.max(1,Math.ceil(built.length/10))), rows=Math.ceil(built.length/cols);
      cx.font=`700 ${Math.round(rh*0.82)}px "Barlow Condensed", ${fam}`; const nmW=Math.max(...built.map(L=>{ const a=stById(L.stops[0]), b=stById(L.stops[L.stops.length-1]); cx.font=`500 ${Math.round(rh*0.62)}px ${fam}`; return cx.measureText(L.loop?t('loopTitle',{a:nm(a.name)}):t('lineTitle',{a:nm(a.name),b:nm(b.name)})).width; }));
      const colW=sw2+rh*1.6+nmW+rh, bw2=cols*colW+rh, bh2=rows*rh*1.25+rh*0.8, bx=pad*0.6, by=out.height-pad*0.6-bh2;
      cx.fillStyle='rgba(255,255,255,.92)'; cx.fillRect(bx,by,bw2,bh2);
      built.forEach((L,i)=>{ const col=Math.floor(i/rows), row=i%rows, X=bx+rh*0.6+col*colW, Y=by+rh*0.55+row*rh*1.25;
        cx.fillStyle=LINE_COLORS[L.ci]; cx.fillRect(X,Y,sw2,rh*0.7);
        cx.fillStyle=ink; cx.textBaseline='middle'; cx.font=`700 ${Math.round(rh*0.95)}px "Barlow Condensed", ${fam}`; cx.fillText(String(L.num),X+sw2+rh*0.3,Y+rh*0.38);
        const a=stById(L.stops[0]), b=stById(L.stops[L.stops.length-1]); cx.font=`500 ${Math.round(rh*0.62)}px ${fam}`; cx.fillStyle='#545b70'; cx.fillText(L.loop?t('loopTitle',{a:nm(a.name)}):t('lineTitle',{a:nm(a.name),b:nm(b.name)}),X+sw2+rh*1.6,Y+rh*0.38); });
      cx.textBaseline='alphabetic'; }
    cx.textAlign='right'; cx.fillStyle='#8a90a2'; cx.font=`500 ${Math.round(tsz*0.36)}px ${fam}`; cx.fillText('地铁织城   '+t('year',{y:Math.floor(months/12)+1,m:months%12+1}),out.width-pad*0.8,out.height-pad*0.7);
    out.toBlob(b=>{ if(!b) return; const url=URL.createObjectURL(b); img.src=url; img.alt=title; const a=$('#exSave'); a.href=url; a.download=nm({k:'city'},'en').replace(/\s+/g,'-')+'-metro-map.png'; $('#exSub').textContent=stats; },'image/png');
  },40);
}
