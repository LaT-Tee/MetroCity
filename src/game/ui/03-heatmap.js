/* ---------- population heatmap ---------- */
const HEAT_STOPS=[[0,[255,226,120]],[0.3,[250,170,70]],[0.65,[236,96,60]],[1.0,[205,40,70]],[1.35,[160,30,120]],[1.8,[100,30,150]],[2.4,[50,20,110]]];
const HEAT_LUT=new Uint8Array(512*3); for(let k=0;k<512;k++){ const c=heatRamp(k/212); HEAT_LUT[k*3]=c[0]; HEAT_LUT[k*3+1]=c[1]; HEAT_LUT[k*3+2]=c[2]; }   // colour lookup instead of per-pixel interpolation
function heatRamp(v){ for(let k=1;k<HEAT_STOPS.length;k++){ const [a,ca]=HEAT_STOPS[k-1], [b,cb]=HEAT_STOPS[k]; if(v<=b){ const f=(v-a)/(b-a); return ca.map((c,j)=>c+(cb[j]-c)*f); } } return HEAT_STOPS[HEAT_STOPS.length-1][1]; }
// population heat and the built-up tint, one pixel per cell (the canvas smooths them when scaled up)
function buildHeat(){
  const mk=sp=>{ const c=(sp&&sp!==heatCanvas&&sp!==urbCanvas)?sp:document.createElement('canvas'); if(c.width!==W){ c.width=W; c.height=H; } return c; };
  const c=mk(heatSpare), u=mk(urbSpare), x=c.getContext('2d'), xu=u.getContext('2d'), im=x.createImageData(W,H), iu=xu.createImageData(W,H), d=im.data, du=iu.data, D=G.D;
  if(!G.landT){ const lt=new Float32Array(W*H), pf=new Float32Array(W*H), ff=new Float32Array(W*H); for(let i=0;i<W*H;i++){ lt[i]=smooth((G.h[i]-G.sea)/0.006,-0.5,0.5); pf[i]=smooth(G.pk[i],0.26,0.31); ff[i]=smooth(G.pk[i],0.12,0.22); } G.landT=lt; G.parkF=pf; G.forF=ff; }
  const LT=G.landT, PF=G.parkF, FF=G.forF, ur=C.rgb?C.rgb('urban'):[233,235,241];
  for(let i=0;i<W*H;i++){ const v=D[i], lt=LT[i]; if(v<0.008||lt<=0) continue; const o=i*4;
    const li=Math.min(511,(v*212)|0)*3; d[o]=HEAT_LUT[li]; d[o+1]=HEAT_LUT[li+1]; d[o+2]=HEAT_LUT[li+2]; d[o+3]=Math.min(235,smooth(v,0.01,0.12)*(40+Math.min(v,1)*190+Math.max(0,v-1)*20))*lt;
    const gr=Math.max(PF[i],FF[i]*(1-smooth(v,0.04,0.18))*0.75), a=smooth(v,0.03,0.65)*(1-gr)*0.9, k=v>1?smooth(v,1,2.2)*0.13*(1-gr):0;
    du[o]=ur[0]*(1-k); du[o+1]=ur[1]*(1-k); du[o+2]=ur[2]*(1-k*0.7); du[o+3]=Math.min(255,(a+k)*255)*lt; }
  x.putImageData(im,0,0); xu.putImageData(iu,0,0);
  heatPrev=heatCanvas; heatSpare=heatPrev; heatCanvas=c; urbPrev=urbCanvas; urbSpare=urbPrev; urbCanvas=u; heatFadeAt=performance.now();
}
function mkPath(pieces){ const p=new Path2D(); for(const pts of pieces){ p.moveTo(pts[0][0],pts[0][1]); for(let k=1;k<pts.length;k++) p.lineTo(pts[k][0],pts[k][1]); } return p; }
// the street web: one path per road class, plus the newest streets so they can fade in
function buildRoadPaths(){
  const R=G.rn; P2.rd=[0,1,2,3,4].map(()=>new Path2D()); P2.rdNew=[0,1,2,3,4].map(()=>new Path2D()); P2.rdVer=R?R.ver:-1; if(!R) return;
  const fresh=months; let nf=0;
  for(let e=0;e<R.ea.length;e++){ const a=R.ea[e], b=R.eb[e], p=(R.et[e]>=fresh&&months>0)?(nf++,P2.rdNew[R.ec[e]]):P2.rd[R.ec[e]]; p.moveTo(R.x[a],R.y[a]); p.lineTo(R.x[b],R.y[b]); }
  P2.rdAt=performance.now(); P2.rdHasNew=nf>0;
}
const RD_W=[[0.9,0],[1.5,0.55],[2.1,1.0],[2.6,1.35],[2.8,0]];   // casing / centre widths in screen px
function strokeRoads(c,px,col,alphaNew,lanesA,which){
  const rd=P2.rd; if(!rd) return; const sets=which==='old'?[rd]:which==='new'?[P2.rdNew]:[rd,P2.rdNew];
  for(let k=0;k<5;k++){ for(const set of sets){ const p=set[k], a=set===rd?1:alphaNew; if(a<=0.01) continue;
      if(k===0){ if(lanesA<=0.02) continue; c.globalAlpha=a*lanesA*0.85; c.strokeStyle=col.edge; c.lineWidth=Math.max(0.12,RD_W[0][0]*px); c.stroke(p); c.globalAlpha=1; continue; }
      if(k===4){ c.globalAlpha=a; c.strokeStyle=col.hwy; c.lineWidth=Math.max(0.85,RD_W[4][0]*px); c.stroke(p); c.globalAlpha=1; continue; }
      c.globalAlpha=a; c.strokeStyle=col.edge; c.lineWidth=Math.max(0.3+0.2*k,RD_W[k][0]*px); c.stroke(p); c.globalAlpha=1; } }
  for(let k=1;k<4;k++) for(const set of sets){ const a=set===rd?1:alphaNew; if(a<=0.01) continue; c.globalAlpha=a; c.strokeStyle=col.core; c.lineWidth=Math.max(0.12+0.12*k,RD_W[k][1]*px); c.stroke(set[k]); c.globalAlpha=1; }
}
function buildPaths(){
  P2.ver=(P2.ver||0)+1;
  buildRoadPaths(); P2.rail=mkPath([G.rail]);
  P2.rivers=[]; for(const r of G.rivers){ const sm=chaikin(r.map(p=>[p[0],p[1]]),3); for(let c=0;c<5;c++){ const a=Math.floor(sm.length*c/5), b=Math.min(sm.length,Math.floor(sm.length*(c+1)/5)+1); P2.rivers.push({p:mkPath([sm.slice(a,b)]),w:1.1+c*0.45}); } }
  const ap=G.fac.airport, ca=Math.cos(ap.a), sa=Math.sin(ap.a);
  const rect=(cx,cy,l,w)=>{ const p=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>[cx+u*ca-v*sa,cy+u*sa+v*ca]); const q=new Path2D(); q.moveTo(...p[0]); p.slice(1).forEach(pt=>q.lineTo(...pt)); q.closePath(); return q; };
  P2.apron=rect(ap.x,ap.y,22,10); P2.runways=new Path2D(); P2.runways.addPath(rect(ap.x+sa*2.6,ap.y-ca*2.6,19,1.1)); P2.runways.addPath(rect(ap.x-sa*2.2,ap.y+ca*2.2,15,0.9));
  P2.terminal=rect(ap.term.x,ap.term.y,6,1.8);
  for(const f of (G.fac2||[]).filter(f=>f.t==='air')){ const c2=Math.cos(f.a), s2=Math.sin(f.a); const r2=(cx,cy,l,w)=>{ const p=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>[cx+u*c2-v*s2,cy+u*s2+v*c2]); const q=new Path2D(); q.moveTo(...p[0]); p.slice(1).forEach(pt=>q.lineTo(...pt)); q.closePath(); return q; };
    P2.apron.addPath(r2(f.x,f.y,22,10)); P2.runways.addPath(r2(f.x+s2*2.6,f.y-c2*2.6,19,1.1)); P2.runways.addPath(r2(f.x-s2*2.2,f.y+c2*2.2,15,0.9)); P2.terminal.addPath(r2(f.term.x,f.term.y,6,1.8)); }
}
