/* ================= population follows good stations ================= */
function initGrowth(){
  const n=W*H, S=new Float32Array(n), ap=G.fac.airport;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(G.water[i]) continue;
    const park=smooth(G.pk[i],0.26,0.31), hill=smooth(G.e[i],0.45,0.78), ad=dist(x,y,ap.x,ap.y);
    S[i]=(1-0.92*park)*(1-0.85*hill)*(ad<14?smooth(ad,10,14):1); }
  growth={S,U:new Float32Array(n),D0:Float32Array.from(G.D),J0:Float32Array.from(G.J),pop0:G.popTotal,lastBaseD:Float32Array.from(G.D),lastBaseT:0,boosts:[]};
}
function growthTick(){
  const U=growth.U; U.fill(0);
  // how far people will live from a station grows over the years (walk → bus → bike: ~30 min becomes acceptable)
  // each station's pull is a Gaussian; instead of evaluating exp() around every station we drop impulses and
  // blur them three times with a box filter (≈ Gaussian, cost independent of radius and of station count)
  const years=months/12, sig=5.5+Math.min(9,years*0.9);
  const cnt=new Map(); lines.forEach(L=>{ if(L.stops.length>=2) L.stops.forEach(id=>cnt.set(id,(cnt.get(id)||0)+1)); });
  let anyS=false; const peak=2*Math.PI*sig*sig;
  for(const s of stations){
    const c=cnt.get(s.id)||0; if(!c) continue;
    const b=sim&&sim.stBoard[s.id]?sim.stBoard[s.id]:0, rc=sim&&sim.stReach?sim.stReach[s.id]||0:0, A=0.35+0.5*(c-1)+1.0*Math.min(1.5,b/4e4)+1.6*rc;
    const x0=Math.floor(s.x), y0=Math.floor(s.y), fx=s.x-x0, fy=s.y-y0;   // bilinear splat keeps sub-cell positions
    if(x0<0||y0<0||x0>=W-1||y0>=H-1) continue; const v=A*peak;
    U[y0*W+x0]+=v*(1-fx)*(1-fy); U[y0*W+x0+1]+=v*fx*(1-fy); U[(y0+1)*W+x0]+=v*(1-fx)*fy; U[(y0+1)*W+x0+1]+=v*fx*fy; anyS=true;
  }
  if(anyS){ const r=Math.max(1,Math.round((Math.sqrt(4*sig*sig+1)-1)/2)), B=G.bounds, m=3*r+2; for(let k=0;k<3;k++) boxBlur(U,r,Math.max(0,B[0]-m),Math.max(0,B[1]-m),Math.min(W,B[2]+m),Math.min(H,B[3]+m)); }
  const D=G.D, J=G.J, D0=growth.D0, J0=growth.J0, S=growth.S, B=G.bounds, lb=growth.lastBaseD;
  if(!growth.TG) growth.TG=new Float32Array(W*H);
  if(!growth.roadAcc||growth.roadN!==rnAccKey()) updateRoadAccess();
  const blur=blurD(), RA=growth.roadAcc, Wt=growth.TG, PA=placeAttr(); let pool=0, sw=0;
  // remote places with neither metro nor roads slowly empty out
  for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++){ const i=y*W+x; if(U[i]<0.05&&RA[i]<0.15&&D[i]>0.05){ const out=D[i]*0.002; D[i]-=out; pool+=out; } }
  // the city grows on its own; a good metro makes it grow faster
  const share=sim?sim.share:0, big=G.popTotal/growth.pop0; pool+=popIn()*(0.0018+0.006*share)*clamp(1.5-0.3*big,0.25,1)+popIn()*projectInflow();
  // where people settle: near the metro, near roads, next to existing neighbourhoods, wherever there is room
  for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++){ const i=y*W+x; let w=0;
    if(!G.water[i]&&S[i]>0.05){ const cap=S[i]*(1+0.6*Math.min(1,blur[i])+1.2*Math.min(1,U[i]/2.5)+0.5*Math.min(1,PA[i])); const room=cap-D[i];
      if(room>0) w=room*(0.12*RA[i]+0.55*Math.min(blur[i],1)+0.9*Math.min(U[i],1.2)+0.6*Math.min(PA[i],1))*(0.3+0.7*RA[i]); }
    Wt[i]=w; sw+=w; }
  let delta=0, sinceBase=0;
  for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++){ const i=y*W+x;
    if(sw>0&&Wt[i]>0){ const cap=S[i]*(1+0.6*Math.min(1,blur[i])+1.2*Math.min(1,U[i]/2.5)+0.5*Math.min(1,PA[i])); const dd=Math.min(pool*Wt[i]/sw,(cap-D[i])*0.15); if(dd>0){ D[i]+=dd; delta+=dd; } }
    sinceBase+=Math.abs(D[i]-lb[i]);
    J[i]+=(J0[i]+0.45*Math.max(0,D[i]-D0[i])-J[i])*0.1; }
  G.popTotal=popIn()*900; growth.sinceBase=sinceBase;
  return delta;
}
// villages, towns and development projects pull new homes towards them — bigger places pull harder
function placeAttr(){
  const ps=allPlaces().filter(p=>inB(p.x,p.y)&&p.name), pj=(G.projects||[]).filter(p=>inB(p.x,p.y));
  const key=ps.length+':'+ps.reduce((a,p)=>a+tierOf(p),0)+':'+pj.length+':'+pj.filter(p=>p.done).length+':'+(G.fac2||[]).length+':'+G.bounds.join(',');
  if(growth.paKey===key) return growth.PA;
  const n=W*H, PA=growth.PA||new Float32Array(n); PA.fill(0);
  const add=(px,py,A,sg)=>{ const R=Math.ceil(sg*2.5), s2=2*sg*sg; for(let y=Math.max(0,Math.floor(py-R));y<=Math.min(H-1,Math.ceil(py+R));y++) for(let x=Math.max(0,Math.floor(px-R));x<=Math.min(W-1,Math.ceil(px+R));x++){ const d2=(x-px)**2+(y-py)**2; if(d2<=R*R) PA[y*W+x]+=A*Math.exp(-d2/s2); } };
  for(const p of [...G.villages,...G.centers.filter(c=>c.type==='sub'||c.type==='twin')]){ if(!inB(p.x,p.y)) continue; const tr=tierOf(p); add(p.x,p.y,[0.45,0.7,0.95,1.2][tr]||0.45,5+tr*1.5); }
  for(const p of pj) add(p.x,p.y,PROJ[p.t].pull*(p.done?1:0.5),PROJ[p.t].sg);
  for(const f of (G.fac2||[])){ const pt=facPoint(f); if(inB(pt.x,pt.y)) add(pt.x,pt.y,PROJ[f.t].pull,PROJ[f.t].sg); }
  growth.PA=PA; growth.paKey=key; return PA;
}
// distance to the road network → how easy it is to build there
function updateRoadAccess(){
  const n=W*H, m=new Uint8Array(n); for(let i=0;i<n;i++) m[i]=G.roadUse[i]?1:0;
  const d=distTransform(m), a=growth.roadAcc||new Float32Array(n); for(let i=0;i<n;i++) a[i]=Math.exp(-d[i]/7);
  growth.roadAcc=a; growth.roadN=rnAccKey();
}
// in-place separable box blur (radius r) over a window [x0,x1)×[y0,y1); vertical pass runs row by row (cache friendly)
function boxBlur(A,r,x0,y0,x1,y1){
  x0=x0||0; y0=y0||0; x1=x1||W; y1=y1||H; const n=W*H, T=growth.bbTmp||(growth.bbTmp=new Float32Array(n)), col=growth.bbCol||(growth.bbCol=new Float32Array(W)), k=1/(2*r+1);
  for(let y=y0;y<y1;y++){ const o=y*W; let acc=0; for(let x=x0-r;x<=x0+r;x++) acc+=A[o+clamp(x,x0,x1-1)]; for(let x=x0;x<x1;x++){ T[o+x]=acc*k; acc+=A[o+Math.min(x1-1,x+r+1)]-A[o+Math.max(x0,x-r)]; } }
  for(let x=x0;x<x1;x++) col[x]=0;
  for(let y=y0-r;y<=y0+r;y++){ const o=clamp(y,y0,y1-1)*W; for(let x=x0;x<x1;x++) col[x]+=T[o+x]; }
  for(let y=y0;y<y1;y++){ const o=y*W, oa=Math.min(y1-1,y+r+1)*W, os=Math.max(y0,y-r)*W; for(let x=x0;x<x1;x++){ A[o+x]=col[x]*k; col[x]+=T[oa+x]-T[os+x]; } }
}
// neighbourhood density (separable box blur) — cities spread outward from where people already live
function blurD(){
  const n=W*H, r=5, tmp=growth.blurTmp||(growth.blurTmp=new Float32Array(n)), out=growth.blurOut||(growth.blurOut=new Float32Array(n)), D=G.D, k=1/(2*r+1);
  for(let y=0;y<H;y++){ let acc=0; const o=y*W; for(let x=-r;x<=r;x++) acc+=D[o+clamp(x,0,W-1)]; for(let x=0;x<W;x++){ tmp[o+x]=acc*k; acc+=D[o+Math.min(W-1,x+r+1)]-D[o+Math.max(0,x-r)]; } }
  for(let x=0;x<W;x++){ let acc=0; for(let y=-r;y<=r;y++) acc+=tmp[clamp(y,0,H-1)*W+x]; for(let y=0;y<H;y++){ out[y*W+x]=acc*k; acc+=tmp[Math.min(H-1,y+r+1)*W+x]-tmp[Math.max(0,y-r)*W+x]; } }
  return out;
}
function relocate(frac,rand){
  rand=rand||Math.random; const n=W*H, D=G.D, J=G.J;
  const cD=new Float64Array(n), cJ=new Float64Array(n); let s1=0,s2=0; for(let i=0;i<n;i++){ s1+=D[i]; cD[i]=s1; s2+=J[i]; cJ[i]=s2; }
  const pick=(c)=>{ const r=rand()*c[n-1]; let lo=0,hi=n-1; while(lo<hi){ const m=(lo+hi)>>1; if(c[m]<r) lo=m+1; else hi=m; } return lo; };
  const pt=i=>[(i%W)+rand()-.5,Math.floor(i/W)+rand()-.5];
  for(const a of G.agents){
    if(rand()>=frac) continue;
    for(let tr=0;tr<6;tr++){ const [hx,hy]=pt(pick(cD)); if(dist(hx,hy,a.wx,a.wy)>=4){ a.hx=hx; a.hy=hy; break; } }
    if(a.kind==='commute'){ for(let tr=0;tr<20;tr++){ const [wx,wy]=pt(pick(cJ)); if(dist(a.hx,a.hy,wx,wy)>=4&&rand()<Math.exp(-dist(a.hx,a.hy,wx,wy)/55)){ a.wx=wx; a.wy=wy; break; } } }
    if(a.kind==='airport'){ const airs=[G.fac.airport.term,...(G.fac2||[]).filter(f=>f.t==='air').map(f=>f.term)]; let b0=airs[0]; for(const t of airs) if(dist(t.x,t.y,a.hx,a.hy)<dist(b0.x,b0.y,a.hx,a.hy)) b0=t; a.wx=b0.x+rand()*2-1; a.wy=b0.y+rand()*2-1; }
    tripProps(a,D,G.water); a.t0=roadTime(a,1); a.oc=null;
  }
}
