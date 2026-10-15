/* ---------- report ---------- */
function openReport(){
  if(!sim) return;
  const imp=(baseline.avg-sim.avg)/baseline.avg*100;
  const grade=imp>=33?'S':imp>=24?'A':imp>=15?'B':imp>=7?'C':'D';
  const city=nm({k:'city'}), km=(lines.reduce((s,L)=>s+lineLength(L),0)*CELL_KM).toFixed(0);
  $('#repTitle').textContent=t('repTitle',{c:city});
  $('#repSub').textContent=t('repSub',{l:activeLineCount(),s:stations.length,km,inv:fmtMoney(sim.cost)});
  $('#repGrade').textContent=grade; $('#repStamp').style.color=grade==='S'||grade==='A'?'var(--accent)':grade==='D'?'var(--bad)':'var(--ink)';
  $('#repBefore').textContent=baseline.avg.toFixed(1); $('#repAfter').textContent=sim.avg.toFixed(1); $('#repAfter').classList.toggle('good',sim.avg<baseline.avg);
  $('#repLine').textContent=t('repCut',{p:imp.toFixed(1)})+t('verdict')[grade];
  const saved=(baseline.avg-sim.avg)*G.popTotal*0.55*2/60;
  const carKmCut=G.agents.reduce((s,a)=>s+a.p*a.dRoad,0)/G.agents.length*CELL_KM*G.popTotal*0.55*2;
  const dp=Math.max(0,G.popTotal-growth.pop0);
  const cells=[[t('cSaved'),fmtN(saved),t('hours')],[t('cShare'),(sim.share*100).toFixed(1),'%'],[t('cRiders'),fmtN(sim.riders),t('trips')],[t('cWalk'),(sim.cover*100).toFixed(0),t('ofPop')],[t('cNew'),fmtN(dp),t('people')],[t('cCarbon'),fmtN(carKmCut*0.17/1000),t('tons')]];
  $('#repGrid').innerHTML=cells.map(([k,v,u])=>`<div><div class="k">${k}</div><div class="v">${v}<small>${u}</small></div></div>`).join('');
  $('#report').hidden=false; drawHist();
}
function drawHist(){
  const c=$('#histCanvas'), r=c.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1); c.width=r.width*d; c.height=r.height*d; const x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0);
  const w=r.width, h=r.height, bins=12, b0=new Array(bins).fill(0), b1=new Array(bins).fill(0);
  for(const a of G.agents){ b0[Math.min(bins-1,Math.floor(a.t0/10))]++; b1[Math.min(bins-1,Math.floor(a.t/10))]++; }
  const mx=Math.max(...b0,...b1), padL=8, padB=22, bw=(w-padL*2)/bins;
  x.font='11px "Barlow Condensed", sans-serif'; x.textAlign='center';
  for(let i=0;i<bins;i++){
    const X=padL+i*bw, h0=(b0[i]/mx)*(h-padB-10), h1=(b1[i]/mx)*(h-padB-10);
    x.fillStyle=C['ink-3']; x.globalAlpha=0.35; x.fillRect(X+2,h-padB-h0,bw*0.45-2,h0);
    x.globalAlpha=1; x.fillStyle=C.accent; x.fillRect(X+bw*0.45+1,h-padB-h1,bw*0.45-2,h1);
    x.fillStyle=C['ink-3']; x.fillText(i===bins-1?'110+':String(i*10),X+bw/2,h-6);
  }
  x.strokeStyle=C['ink-3']; x.globalAlpha=0.4; x.beginPath(); x.moveTo(padL,h-padB+0.5); x.lineTo(w-padL,h-padB+0.5); x.stroke(); x.globalAlpha=1;
}
