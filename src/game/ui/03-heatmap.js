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
const RD_CH=48;        // streets are also kept in chunks of this many cells, so a close view strokes only what it shows
function buildRoadPaths(){
  // three sets: streets already in the cached map layer, streets added since that layer was painted (drawn on top
  // until the next repaint, so the layer need not be redrawn every month) and this month's streets, which fade in
  const R=G.rn, mk5=()=>[0,1,2,3,4].map(()=>new Path2D()); P2.rd=mk5(); P2.rdNew=mk5(); P2.rdPend=mk5(); P2.rdT=new Map(); P2.rdVer=R?R.ver:-1; if(!R) return;
  const fresh=months, up=P2.upMonth==null?-1e9:P2.upMonth; let nf=0, np=0;
  for(let e=0;e<R.ea.length;e++){ const a=R.ea[e], b=R.eb[e], c=R.ec[e], isNew=R.et[e]>=fresh&&months>0, isPend=!isNew&&R.et[e]>=up, p=isNew?(nf++,P2.rdNew[c]):isPend?(np++,P2.rdPend[c]):P2.rd[c]; p.moveTo(R.x[a],R.y[a]); p.lineTo(R.x[b],R.y[b]);
    if(!isNew&&!isPend){ const k=Math.floor((R.x[a]+R.x[b])/2/RD_CH)+1000*Math.floor((R.y[a]+R.y[b])/2/RD_CH); let t=P2.rdT.get(k); if(!t){ t=mk5(); P2.rdT.set(k,t); } t[c].moveTo(R.x[a],R.y[a]); t[c].lineTo(R.x[b],R.y[b]); } }
  P2.rdAt=performance.now(); P2.rdHasNew=nf>0; P2.rdHasPend=np>0;
}
const RD_W=[[0.9,0],[1.5,0.6],[2.3,1.2],[3.1,1.8],[3.2,0]];   // least casing / centre widths in screen px
// far out a road is a line of a few pixels; close in it takes its true width, so buildings stand beside it, not on it
function strokeRoads(c,px,col,alphaNew,lanesA,which,view){
  const rd=P2.rd; if(!rd) return; let sets=which==='old'?[rd]:which==='new'?[P2.rdNew]:which==='pend'?[P2.rdPend]:[rd,P2.rdPend,P2.rdNew]; const old=sets;
  // a close view: only the chunks it shows
  if(which==='old'&&view&&P2.rdT&&(view[2]-view[0])*(view[3]-view[1])<W*H*0.35){ sets=[]; for(let cy=Math.floor((view[1]-3)/RD_CH);cy<=Math.floor((view[3]+3)/RD_CH);cy++) for(let cx=Math.floor((view[0]-3)/RD_CH);cx<=Math.floor((view[2]+3)/RD_CH);cx++){ const t=P2.rdT.get(cx+1000*cy); if(t) sets.push(t); } }
  const isOld=set=>which==='old'||set===rd;
  const wide=ROAD_W[0]>=2.4*px;      // streets wide enough on screen to be drawn as streets: kerbs and a pale roadway
  for(let k=0;k<5;k++){ for(const set of sets){ const p=set[k], a=isOld(set)?1:alphaNew; if(a<=0.01) continue;
      if(k===0&&!wide){ if(lanesA<=0.02) continue; c.globalAlpha=a*lanesA*0.85; c.strokeStyle=col.edge; c.lineWidth=Math.max(ROAD_W[0]*0.8,RD_W[0][0]*px); c.stroke(p); c.globalAlpha=1; continue; }
      if(k===4){ c.globalAlpha=a; c.strokeStyle=col.hwy; c.lineWidth=Math.max(ROAD_W[4],RD_W[4][0]*px); c.stroke(p); c.globalAlpha=1; continue; }
      c.globalAlpha=a; c.strokeStyle=col.edge; c.lineWidth=Math.max(ROAD_W[k],RD_W[k][0]*px); c.stroke(p); c.globalAlpha=1; } }
  for(let k=wide?0:1;k<4;k++) for(const set of sets){ const a=isOld(set)?1:alphaNew; if(a<=0.01) continue; c.globalAlpha=a; c.strokeStyle=col.core; c.lineWidth=k===0?ROAD_W[0]-2*px:Math.max(ROAD_W[k]-Math.max(2*px,0.03),RD_W[k][1]*px); c.stroke(set[k]); c.globalAlpha=1; }
  if(wide&&which==='old'){ c.strokeStyle=col.core; c.globalAlpha=0.55; c.lineWidth=Math.max(px,0.012); c.setLineDash([0.12,0.1]); for(const set of sets) c.stroke(set[4]); c.setLineDash([]); c.globalAlpha=1; }
}
function buildPaths(){
  P2.ver=(P2.ver||0)+1;
  buildRoadPaths(); P2.rail=mkPath([G.rail]);
  P2.rivers=[]; for(const r of G.rivers){ const sm=r, w0=r.w0||1.1, w1=r.w1||2.9, NC=8; for(let c=0;c<NC;c++){ const a=Math.floor(sm.length*c/NC), b=Math.min(sm.length,Math.floor(sm.length*(c+1)/NC)+1); P2.rivers.push({p:mkPath([sm.slice(a,b)]),w:w0+(w1-w0)*(c+0.5)/NC}); } }
  const ap=G.fac.airport, ca=Math.cos(ap.a), sa=Math.sin(ap.a);
  const rect=(cx,cy,l,w)=>{ const p=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>[cx+u*ca-v*sa,cy+u*sa+v*ca]); const q=new Path2D(); q.moveTo(...p[0]); p.slice(1).forEach(pt=>q.lineTo(...pt)); q.closePath(); return q; };
  P2.apron=rect(ap.x,ap.y,22,10); P2.runways=new Path2D(); P2.runways.addPath(rect(ap.x+sa*2.6,ap.y-ca*2.6,19,1.1)); P2.runways.addPath(rect(ap.x-sa*2.2,ap.y+ca*2.2,15,0.9));
  P2.terminal=rect(ap.term.x,ap.term.y,6,1.8);
  for(const f of (G.fac2||[]).filter(f=>f.t==='air')){ const c2=Math.cos(f.a), s2=Math.sin(f.a); const r2=(cx,cy,l,w)=>{ const p=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>[cx+u*c2-v*s2,cy+u*s2+v*c2]); const q=new Path2D(); q.moveTo(...p[0]); p.slice(1).forEach(pt=>q.lineTo(...pt)); q.closePath(); return q; };
    P2.apron.addPath(r2(f.x,f.y,22,10)); P2.runways.addPath(r2(f.x+s2*2.6,f.y-c2*2.6,19,1.1)); P2.runways.addPath(r2(f.x-s2*2.2,f.y+c2*2.2,15,0.9)); P2.terminal.addPath(r2(f.term.x,f.term.y,6,1.8)); }
}
