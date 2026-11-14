/* ---------- viewing mode (观景): sit by the window and watch the city go by ----------
   A quiet mode with no building tools. You take the seat of one commuter — board, ride, change trains (or stay on
   when the train runs through onto another line), get off — then the seat of someone else; now and then you simply
   ride a train to the end of its line. The view is first person out of the window: in 3D on a computer, and as a
   drawn window under the moving map on phones. Trains move at a calm pace, about three times real speed. */
const watch={on:false,subj:null,user:0,win:true,view:null,scroll:0};
// a calm pace (cells a second; 1 cell = 150 m), with real braking into and pulling out of every station
const W_SPD={ride:0.3,rapid:0.44}, W_ACC={ride:0.032,rapid:0.036}, W_DWELL=8, W_BOARD=4;
// one run between two stops: accelerate, cruise, brake (or just accelerate and brake on a short hop)
function runTime(d,v,a){ const da=v*v/(2*a); return d>=2*da?d/v+v/a:2*Math.sqrt(d/a); }
function runAt(d,v,a,t){ const T=runTime(d,v,a), da=v*v/(2*a);
  if(d>=2*da){ const ta=v/a; if(t<ta) return [0.5*a*t*t,a*t]; if(t<T-ta) return [da+v*(t-ta),v]; const r=Math.max(0,T-t); return [d-0.5*a*r*r,a*r]; }
  const tp=T/2; if(t<tp) return [0.5*a*t*t,a*t]; const r=Math.max(0,T-t); return [d-0.5*a*r*r,a*r]; }
// a point along a polyline, and a heading taken over a short chord so it turns smoothly through bends and stations
function polyAt(P,cum,u){ u=clamp(u,0,cum[cum.length-1]); const i=Math.max(1,trainSeg(cum,u)), f=(u-cum[i-1])/((cum[i]-cum[i-1])||1); return [lerp(P[i-1][0],P[i][0],f),lerp(P[i-1][1],P[i][1],f)]; }
function polyHead(P,cum,u,h){ const a=polyAt(P,cum,u-(h||0.12)), b=polyAt(P,cum,u+(h||0.12)), hx=b[0]-a[0], hy=b[1]-a[1], l=Math.hypot(hx,hy)||1; return [hx/l,hy/l]; }
function canWatch3D(){ return !touchMode&&vw>=900; }
function setWatch(on){
  if(on===watch.on) return; watch.on=on; document.body.classList.toggle('watching',on); $('#watchBtn').setAttribute('aria-pressed',on);
  if(on){ setTool('pan'); toast(t('watchOn')); watch.prevCam={x:cam.x,y:cam.y,s:cam.s}; watch.subj=null; watch.user=0; $('#watchBar').hidden=false;
    if(watch.view==null) watch.view=canWatch3D()?'3d':'2d'; if(!canWatch3D()) watch.view='2d';
    $('#w3d').hidden=!canWatch3D(); if(watch.view==='3d') w3dStart(); nextSubject(); }
  else { $('#watchBar').hidden=true; w3dStop(); const p=watch.prevCam; if(p) camAnim={x0:cam.x,y0:cam.y,s0:cam.s,x1:p.x,y1:p.y,s1:p.s,t0:performance.now(),dur:700}; watch.subj=null; }
  renderWatchBar(); }
// one ride along a line through the given stop indices: track geometry, stop positions and timing
function makeRide(L,ks,board){
  const pts=[], stopsAt=[0], n=L.stops.length; ensurePaths(L);
  for(let j=1;j<ks.length;j++){ let k=ks[j-1]; const k2=ks[j], fwd=L.loop?((k2-k+n)%n)<=n/2:k2>k;
    while(k!==k2){ const nk=L.loop?(k+(fwd?1:-1)+n)%n:k+(fwd?1:-1), seg=fwd?k:nk, P=L.paths[seg]; if(!P) return null; const pp=fwd?P:P.slice().reverse();
      for(let m=pts.length?1:0;m<pp.length;m++) pts.push(pp[m]); k=nk; }
    stopsAt.push(pts.length-1); }
  if(pts.length<2) return null; const cum=[0]; for(let m=1;m<pts.length;m++) cum.push(cum[m-1]+dist(pts[m-1][0],pts[m-1][1],pts[m][0],pts[m][1]));
  const q={k:'ride',L,ks,pts,cum,stopU:stopsAt.map(m=>cum[m]),stopIds:ks.map(k=>L.stops[k]),v:isRapid(L)?W_SPD.rapid:W_SPD.ride,a:isRapid(L)?W_ACC.rapid:W_ACC.ride,dwell:isRapid(L)?6:W_DWELL,board:board?W_BOARD:0};
  q.runs=q.stopU.slice(1).map((u,j)=>runTime(Math.max(1e-6,u-q.stopU[j]),q.v,q.a));
  q.dur=q.board+q.runs.reduce((x,y)=>x+y,0)+(q.stopU.length-2)*q.dwell; return q; }
// ---- a commuter's trip, seen from their seat: board, ride, change trains (or stay on through), get off
function buildJourney(a){
  const gr=runSim.gr, sp=runSim.sp, ids=runSim.ids; if(!gr||!sp||a.bo<0||a.bd<0||!sp[a.bo]) return null;
  const seq=[]; let u=a.bd, g=0; const pv=sp[a.bo].pv; while(u!==-1&&g++<800){ seq.push(u); if(u===a.bo) break; u=pv[u]; } if(seq[seq.length-1]!==a.bo) return null; seq.reverse();
  const stOf=i=>stById(ids[i]), L0=i=>lines[i], TR=throughRunning(), ph=[]; let ride=null, rides=0, pend=null;
  const endRide=()=>{ if(ride&&ride.ks.length>=2){ const q=makeRide(ride.L,ride.ks,rides===0||ride.fresh); if(!q) return false; ph.push(q); rides++; } ride=null; return true; };
  for(let i=1;i<seq.length;i++){ const p=gr.nodes[seq[i-1]], c=gr.nodes[seq[i]];
    if(p.line<0&&c.line>=0){ const L=L0(c.line); if(!L) return null; if(rides>0) ph.push({k:'xfer',st:stOf(c.st),L,dur:4}); ride={L,ks:[c.k],fresh:true}; continue; }
    if(p.line>=0&&c.line===p.line){ if(ride) ride.ks.push(c.k); continue; }
    if(p.line>=0&&c.line>=0){ const A=L0(p.line), B=L0(c.line); if(!A||!B) return null; const T=A.stops[p.k];
      const th=TR.thru.find(o=>(o.a===A.id&&o.b===B.id&&o.st===T)||(o.a===B.id&&o.b===A.id&&o.st===T));
      if(endRide()===false) return null; if(th){ ph.push({k:'thru',A,B,st:stById(T),dur:3.5}); ride={L:B,ks:[B.stops.indexOf(T),c.k]}; }
      else { ph.push({k:'cross',A,B,st:stOf(c.st),dur:4}); ride={L:B,ks:[c.k],fresh:true}; } continue; }
    if(p.line>=0&&c.line<0){ if(endRide()===false) return null; } }
  if(endRide()===false) return null; if(!rides) return null;
  const last=ph.filter(q=>q.k==='ride').pop(); ph.push({k:'arrive',st:stById(last.stopIds[last.stopIds.length-1]),L:last.L,dur:4.5});
  let t=0; for(const q of ph){ q.t0=t; t+=q.dur; }
  return {k:'rider',a,ph,T:t,t:0,from:nm(placeName(a.hx,a.hy)),to:nm(placeName(a.wx,a.wy)),car:a.tr,mins:a.tm}; }
function pickRider(){
  const A=G.agents; if(!sim||!runSim.gr||!A.length) return null; let best=null;
  for(let tries=0;tries<300;tries++){ const a=A[Math.floor(Math.random()*A.length)]; if(!(a.p>0.3)||a.bo<0||a.bd<0||!isFinite(a.tm)) continue;
    const j=buildJourney(a); if(!j) continue; const rides=j.ph.filter(q=>q.k==='ride').length, special=j.ph.some(q=>q.k==='thru'||q.k==='cross');
    const score=rides+(special?1.5:0)+Math.min(1.5,j.T/120)+Math.random()*0.8; if(!best||score>best.score){ best=j; best.score=score; } if(tries>60&&best&&best.score>=3) break; }
  return best; }
// riding a train from somewhere along its line to the end of the line
function pickTrain(L,k0,dir){
  const built=lines.filter(l=>l.stops.length>=2); if(!built.length) return null;
  if(!L){ const w=built.map(l=>Math.sqrt((sim&&sim.lineRide[l.id])||1)), tot=w.reduce((a,b)=>a+b,0); let r=Math.random()*tot; L=built[0]; for(let i=0;i<built.length;i++){ r-=w[i]; if(r<=0){ L=built[i]; break; } } }
  const n=L.stops.length; if(dir==null) dir=Math.random()<0.5?1:-1; if(k0==null) k0=dir>0?Math.floor(Math.random()*Math.max(1,n-2)):n-1-Math.floor(Math.random()*Math.max(1,n-2));
  const ks=[]; if(L.loop){ for(let g=0;g<n;g++) ks.push(((k0+dir*g)%n+n)%n); } else { for(let k=k0;k>=0&&k<n;k+=dir) ks.push(k); }
  if(ks.length<2) return null; const q=makeRide(L,ks,true); if(!q) return null; q.t0=0;
  const end={k:'arrive',st:stById(L.stops[ks[ks.length-1]]),L,dur:4,t0:q.dur};
  return {k:'train',ph:[q,end],T:q.dur+end.dur,t:0,L}; }
function nextSubject(force){
  if(!lines.some(l=>l.stops.length>=2)){ watch.subj=null; renderWatchBar(); return; }
  const last=watch.subj; let s=null;
  if(force==='train'||(last&&last.k==='rider'&&Math.random()<0.25)) s=pickTrain(); else s=pickRider()||pickTrain();
  watch.subj=s; watch.scroll=0; renderWatchBar(); if(watch.view==='3d'&&w3d.ready&&w3d.active&&last){ w3dVeil(true); w3d.forceCut=true; w3d.camPos=null; } }
// ---- decorative trains: the same motion the map draws, as a function
function trainGeom(L){ if(L._tgV!==netVersion||!L._tg){ const pts=linePathPts(L), cum=new Float64Array(pts.length); for(let i=1;i<pts.length;i++) cum[i]=cum[i-1]+dist(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]); L._tg={pts,cum}; L._tgV=netVersion; } return L._tg; }
function trainAt(L,k){ const {pts,cum}=trainGeom(L), len=cum[cum.length-1], n=Math.max(2,Math.round(len/16)), per=L.loop?len:len*2, v=lineV(L)*0.85;
  let u=((trainT*v+k*per/n)%per+per)%per, dir=1; if(!L.loop&&u>len){ u=per-u; dir=-1; } const i=Math.max(1,trainSeg(cum,u)), f=(u-cum[i-1])/((cum[i]-cum[i-1])||1);
  const x=lerp(pts[i-1][0],pts[i][0],f), y=lerp(pts[i-1][1],pts[i][1],f), hx=(pts[i][0]-pts[i-1][0])*dir, hy=(pts[i][1]-pts[i-1][1])*dir, hl=Math.hypot(hx,hy)||1;
  return {x,y,hx:hx/hl,hy:hy/hl,u,dir,len,n,speed:v*5*speedMul*(paused?0:1)}; }
function stopCum(L){ if(L._scV===netVersion&&L._sc) return L._sc; ensurePaths(L); const o=[0]; L.paths.forEach((p,i)=>o.push(o[i]+plen(p))); L._sc=o; L._scV=netVersion; return o; }
function rideState(q,tt){ // tt: seconds into the ride → position, heading, speed, and whether the train stands at a stop
  let rem=tt-q.board, u=0, at=rem<0?0:null, sp=0, next=null; const S=q.stopU;
  if(rem>=0) for(let j=0;j<S.length-1;j++){ const run=q.runs[j]; if(rem<=run){ const r=runAt(S[j+1]-S[j],q.v,q.a,rem); u=S[j]+r[0]; sp=r[1]; at=null; next=j+1; break; } rem-=run; u=S[j+1];
    if(j+1<S.length-1){ if(rem<=q.dwell){ at=j+1; next=j+2; break; } rem-=q.dwell; } else at=S.length-1; }
  else next=1;
  u=Math.min(u,q.cum[q.cum.length-1]); const [x,y]=polyAt(q.pts,q.cum,u), [hx,hy]=polyHead(q.pts,q.cum,u);
  return {x,y,hx,hy,u,at,next:next!=null&&next<S.length?next:null,moving:at==null,speed:at!=null?0:sp}; }
function subjState(){
  const s=watch.subj; if(!s) return null;
  const q=s.ph.find(o=>s.t>=o.t0&&s.t<o.t0+o.dur)||s.ph[s.ph.length-1], tt=s.t-q.t0;
  if(q.k==='ride'){ const r=rideState(q,tt); return {mode:'ride',q,...r,L:q.L,board:tt<q.board,stop:r.at!=null?stById(q.stopIds[r.at]):null,next:r.next!=null?stById(q.stopIds[r.next]):null,end:stById(q.stopIds[q.stopIds.length-1])}; }
  // between rides the camera stays in the station: last position on the previous ride (or the next one)
  const i=s.ph.indexOf(q), prev=s.ph.slice(0,i).reverse().find(o=>o.k==='ride'), nx=s.ph.slice(i+1).find(o=>o.k==='ride'), ref=prev||nx, st=q.st;
  let hx=1, hy=0; if(ref){ [hx,hy]=polyHead(ref.pts,ref.cum,prev?ref.cum[ref.cum.length-1]:0); }
  return {mode:q.k,q,x:st.x,y:st.y,hx,hy,st,stop:st,L:q.k==='xfer'?q.L:q.k==='arrive'?q.L:q.B,speed:0,ride:nx}; }
// ---- per frame
function watchTick(dt,ts){
  const s=watch.subj; if(!s){ if(ts-(watch.idleAt||0)>2000){ watch.idleAt=ts; nextSubject(); } return; }
  s.t+=dt; if(s.t>=s.T){ nextSubject(); return; }
  const st=subjState(); if(!st){ nextSubject(); return; } watch.st=st; watch.scroll+=(st.speed||0)*dt;
  // the map glides after the train unless the viewer is moving it themselves
  if(watch.view!=='3d'&&ts-watch.user>2600&&!camAnim){ if(watch.barH==null||ts-(watch.barAt||0)>1000){ watch.barH=$('#watchBar').offsetHeight||0; watch.barAt=ts; }
    const k=1-Math.exp(-dt*2.4), occ=watch.barH*0.5/cam.s; cam.x+=(st.x-cam.x)*k; cam.y+=(st.y+occ-cam.y)*k; cam.s+=(16-cam.s)*(1-Math.exp(-dt*1.2)); clampCam(); }
  if(ts-(watch.capAt||0)>250){ watch.capAt=ts; renderWatchBar(); } }
// ---- on the map: the train being ridden, and people on the platforms nearby
function drawWatch(lw){
  const s=watch.subj, st=watch.st; if(!s||!st) return; const now=performance.now();
  ctx.save();
  for(const x of stations){ if(Math.abs(x.x-cam.x)*cam.s>vw||Math.abs(x.y-cam.y)*cam.s>vh) continue; const b=(sim&&sim.stBoard[x.id])||0; if(b<1) continue;
    const n=clamp(Math.round(b/9000),2,14); for(let i=0;i<n;i++){ const h=hashInt(x.id*131+i), a=(h&1023)/1023*6.283+now/2600*((h>>10&1)?1:-1)*0.3, r=0.55+((h>>12)&255)/255*0.6;
      ctx.beginPath(); ctx.arc(x.x+Math.cos(a)*r,x.y+Math.sin(a)*r*0.7,lw*0.16,0,6.283); ctx.fillStyle=C['ink-2']; ctx.globalAlpha=0.75; ctx.fill(); } ctx.globalAlpha=1; }
  const col=st.L?lineColor(st.L):C.accent, pulse=0.5+0.5*Math.sin(now/400);
  ctx.beginPath(); ctx.arc(st.x,st.y,lw*(2.4+pulse*0.6),0,6.283); ctx.strokeStyle=col; ctx.globalAlpha=0.35; ctx.lineWidth=lw*0.35; ctx.stroke(); ctx.globalAlpha=1;
  ctx.translate(st.x,st.y); { const a=Math.atan2(st.hy,st.hx); if(watch.ang==null||!isFinite(watch.ang)) watch.ang=a; let d=a-watch.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); watch.ang+=d*Math.min(1,lastDt*8); ctx.rotate(watch.ang); } const l=lw*3.6, w=lw*1.15; ctx.fillStyle=col; ctx.strokeStyle=C['card-solid']; ctx.lineWidth=lw*0.3;
  ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-l/2,-w/2,l,w,w/2); else ctx.rect(-l/2,-w/2,l,w); ctx.fill(); ctx.stroke();
  ctx.restore(); }
// ---- caption
function watchCaption(){
  const s=watch.subj, st=watch.st; if(!s) return {a:t('wNone'),b:''}; if(!st) return {a:'',b:''};
  const ln=L=>L?lineName(L):'', sn=x=>x?nm(x.name):'', end=st.end?sn(st.end):'';
  let a='';
  if(st.mode==='ride') a=st.board?t('wBoard',{s:sn(st.stop),l:ln(st.L),d:end}):st.stop?t('wAt',{l:ln(st.L),s:sn(st.stop)}):t('wRide',{l:ln(st.L),d:end,n:sn(st.next)});
  else if(st.mode==='xfer') a=t('wXfer',{s:sn(st.st),l:ln(st.L),d:st.ride?sn(stById(st.ride.stopIds[st.ride.stopIds.length-1])):''});
  else if(st.mode==='thru') a=t('wThru',{l:ln(st.q.B),s:sn(st.st)});
  else if(st.mode==='cross') a=t('wCross',{s:sn(st.st),l:ln(st.q.B)});
  else a=s.k==='rider'?t('wArrive',{s:sn(st.st),p:s.to,m:Math.round(s.mins),c:Math.round(s.car)}):t('wEnd',{s:sn(st.st)});
  return {a,b:s.k==='rider'?t('wWho',{a:s.from,b:s.to}):t('wTrainSub',{l:ln(s.L)}),L:st.L}; }
function renderWatchBar(){
  if(!watch.on) return; const c=watchCaption(), el=$('#watchCap');
  const sw=c.L?`<i class="sw" style="background:${lineColor(c.L)}">${c.L.num}</i>`:'<i class="sw walk"></i>';
  const html=`${sw}<span class="t"><b>${c.a}</b><small>${c.b}</small></span>`; if(el.dataset.h!==html){ el.innerHTML=html; el.dataset.h=html; }
  $('#cv3d').classList.toggle('seat',watch.view==='3d'&&watch.win); $('#wWin').hidden=watch.view!=='3d';   /* window seat or chase camera: a 3D choice only */
  $('#wWin').setAttribute('aria-pressed',watch.win); $('#w3d').setAttribute('aria-pressed',watch.view==='3d'); }
// a tap on a train boards it, heading the way it is going
function trainFromDeco(L,k){ const g=trainAt(L,k), sc=stopCum(L); let k0=0; if(g.dir>0){ for(let j=0;j<sc.length;j++) if(sc[j]<=g.u) k0=j; } else { k0=sc.length-1; for(let j=sc.length-1;j>=0;j--) if(sc[j]>=g.u) k0=j; }
  return pickTrain(L,Math.min(k0,L.stops.length-1),g.dir); }
function watchTap(wx,wy){
  let best=null, bd=Math.max(1.2,14/cam.s);
  for(const L of lines){ if(L.stops.length<2) continue; const n=trainAt(L,0).n; for(let k=0;k<n;k++){ const g=trainAt(L,k), d=dist(g.x,g.y,wx,wy); if(d<bd){ bd=d; best={L,k}; } } }
  if(best){ const s=trainFromDeco(best.L,best.k); if(s){ watch.subj=s; watch.user=0; renderWatchBar(); return true; } } return false; }
$('#watchBtn').addEventListener('click',()=>setWatch(!watch.on));
// overlays on phones sit just below the city card, whatever its height
{ const sg=document.querySelector('.sign'), upd=()=>{ const r=sg.getBoundingClientRect(); document.documentElement.style.setProperty('--signb',Math.round(r.bottom)+'px'); };
  if(window.ResizeObserver) new ResizeObserver(upd).observe(sg); window.addEventListener('resize',upd); setTimeout(upd,300); }
$('#wExit').addEventListener('click',e=>{ e.stopPropagation(); setWatch(false); });
$('#wNext').addEventListener('click',()=>{ watch.user=0; nextSubject(); });
$('#wWin').addEventListener('click',()=>{ watch.win=!watch.win; renderWatchBar(); });
$('#w3d').addEventListener('click',()=>{ if(watch.view==='3d'){ watch.view='2d'; w3dStop(); } else if(canWatch3D()){ watch.view='3d'; w3dStart(); } try{ localStorage.setItem('mc-view3d',watch.view==='3d'?'1':'0'); }catch(e){} renderWatchBar(); });
try{ const v=localStorage.getItem('mc-view3d'); if(v!=null) watch.view=v==='1'?'3d':'2d'; }catch(e){}
