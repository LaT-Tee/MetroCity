/* ================= road web: a street graph that grows like a spider web =================
   Streets branch off existing roads (T-junctions), snap onto neighbours (crossroads, loops),
   reach into wherever people settle, and widen where traffic keeps using them. Display + growth only. */
const RN_G=2, RN_GW=Math.ceil(W/RN_G)+1, RN_SPEED=[0.55,0.75,1,1.3,1.8], RN_MAXN=60000;
function rnNew(){ return {x:[],y:[],adj:[],ea:[],eb:[],ec:[],ef:[],et:[],eg:new Map(),ng:new Map(),ver:0,trips:0}; }
const rnKey=(gx,gy)=>gy*RN_GW+gx;
function rnPut(m,k,v){ const a=m.get(k); if(a) a.push(v); else m.set(k,[v]); }
function rnAddNode(R,x,y){ const i=R.x.length; R.x.push(x); R.y.push(y); R.adj.push([]); rnPut(R.ng,rnKey(Math.floor(x/RN_G),Math.floor(y/RN_G)),i); return i; }
function rnCells(R,e,fn){ const a=R.ea[e], b=R.eb[e], x0=Math.floor(Math.min(R.x[a],R.x[b])/RN_G), x1=Math.floor(Math.max(R.x[a],R.x[b])/RN_G), y0=Math.floor(Math.min(R.y[a],R.y[b])/RN_G), y1=Math.floor(Math.max(R.y[a],R.y[b])/RN_G);
  for(let gy=y0;gy<=y1;gy++) for(let gx=x0;gx<=x1;gx++) fn(rnKey(gx,gy)); }
function rnLv(c){ return c>=4?3:c>=3?2:1; }
function rnAddEdge(R,a,b,c){
  if(a===b) return -1;
  for(const e of R.adj[a]) if(R.ea[e]===b||R.eb[e]===b){ if(R.ec[e]<c){ R.ec[e]=c; R.ver++; } return e; }
  const e=R.ea.length; R.ea.push(a); R.eb.push(b); R.ec.push(c); R.ef.push(0); R.et.push(months); R.adj[a].push(e); R.adj[b].push(e);
  rnCells(R,e,k=>rnPut(R.eg,k,e)); markRoad([[R.x[a],R.y[a]],[R.x[b],R.y[b]]],rnLv(c)); R.ver++; return e;
}
function rnNearNode(R,x,y,r){ let best=-1, bd=r*r;
  for(let gy=Math.floor((y-r)/RN_G);gy<=Math.floor((y+r)/RN_G);gy++) for(let gx=Math.floor((x-r)/RN_G);gx<=Math.floor((x+r)/RN_G);gx++){ const a=R.ng.get(rnKey(gx,gy)); if(!a) continue;
    for(const i of a){ const d=(R.x[i]-x)**2+(R.y[i]-y)**2; if(d<bd){ bd=d; best=i; } } }
  return best; }
function rnProj(R,e,x,y){ const a=R.ea[e], b=R.eb[e], ax=R.x[a], ay=R.y[a], dx=R.x[b]-ax, dy=R.y[b]-ay, l2=dx*dx+dy*dy||1e-9, t=clamp(((x-ax)*dx+(y-ay)*dy)/l2,0,1), px=ax+dx*t, py=ay+dy*t; return {e,t,px,py,d:Math.hypot(x-px,y-py)}; }
function rnNearEdge(R,x,y,r){ let best=null;
  for(let gy=Math.floor((y-r)/RN_G);gy<=Math.floor((y+r)/RN_G);gy++) for(let gx=Math.floor((x-r)/RN_G);gx<=Math.floor((x+r)/RN_G);gx++){ const a=R.eg.get(rnKey(gx,gy)); if(!a) continue;
    for(const e of a){ const p=rnProj(R,e,x,y); if(p.d<r&&(!best||p.d<best.d)) best=p; } }
  return best; }
// first existing edge the segment a→b runs into (not counting edges at node skip)
function rnCross(R,ax,ay,bx,by,skip){ let best=null; const seen=new Set();
  for(let gy=Math.floor(Math.min(ay,by)/RN_G);gy<=Math.floor(Math.max(ay,by)/RN_G);gy++) for(let gx=Math.floor(Math.min(ax,bx)/RN_G);gx<=Math.floor(Math.max(ax,bx)/RN_G);gx++){ const L=R.eg.get(rnKey(gx,gy)); if(!L) continue;
    for(const e of L){ if(seen.has(e)) continue; seen.add(e); const p=R.ea[e], q=R.eb[e]; if(p===skip||q===skip) continue;
      const px=R.x[p], py=R.y[p], rx=R.x[q]-px, ry=R.y[q]-py, sx=bx-ax, sy=by-ay, den=sx*ry-sy*rx; if(Math.abs(den)<1e-9) continue;
      const t=((px-ax)*ry-(py-ay)*rx)/den, u=((px-ax)*sy-(py-ay)*sx)/den;
      if(t>1e-4&&t<=1&&u>=0&&u<=1&&(!best||t<best.t)) best={e,t,u,x:ax+sx*t,y:ay+sy*t}; } }
  return best; }
function rnSplit(R,e,x,y){
  const a=R.ea[e], b=R.eb[e];
  if(Math.hypot(R.x[a]-x,R.y[a]-y)<0.35) return a; if(Math.hypot(R.x[b]-x,R.y[b]-y)<0.35) return b;
  const n=rnAddNode(R,x,y), e2=R.ea.length; R.eb[e]=n; R.ea.push(n); R.eb.push(b); R.ec.push(R.ec[e]); R.ef.push(R.ef[e]); R.et.push(R.et[e]);
  const ad=R.adj[b]; ad[ad.indexOf(e)]=e2; R.adj[n].push(e,e2); rnCells(R,e2,k=>rnPut(R.eg,k,e2)); R.ver++; return n;
}
// a point on the network near (x,y): an existing junction, or a new junction on the nearest road
function rnSnap(R,x,y,r){ const n=rnNearNode(R,x,y,r); if(n>=0) return n; const h=rnNearEdge(R,x,y,r*0.8); return h?rnSplit(R,h.e,h.px,h.py):-1; }
// run a road from node a to (bx,by); every road it meets becomes a junction
function rnLink(R,a,bx,by,c,snapR){
  for(let it=0;it<10;it++){
    const hit=rnCross(R,R.x[a],R.y[a],bx,by,a);
    if(hit&&hit.t<0.999){ const n=rnSplit(R,hit.e,hit.x,hit.y); if(n===a) return a; rnAddEdge(R,a,n,c); a=n; if(Math.hypot(R.x[n]-bx,R.y[n]-by)<0.5) return n; continue; }
    let b=rnSnap(R,bx,by,snapR); if(b<0) b=rnAddNode(R,bx,by); if(b!==a) rnAddEdge(R,a,b,c); return b;
  }
  return a;
}
function rnPolyline(R,pts,c){
  if(pts.length<2) return; const P=[pts[0]];
  for(let k=1;k<pts.length;k++){ const a=pts[k-1], b=pts[k], n=Math.max(1,Math.ceil(dist(a[0],a[1],b[0],b[1])/1.8)); for(let q=1;q<=n;q++) P.push([lerp(a[0],b[0],q/n),lerp(a[1],b[1],q/n)]); }
  let a=rnSnap(R,P[0][0],P[0][1],1.0); if(a<0) a=rnAddNode(R,P[0][0],P[0][1]);
  for(let k=1;k<P.length;k++) a=rnLink(R,a,P[k][0],P[k][1],c,k===P.length-1?1.0:0.4);
}
// how dense streets get: ~225 m blocks downtown, ~600 m at the fringe
function rnSpacing(d){ return d>=1?1.25:d>=0.4?1.25+(1-d)/0.6*0.45:d>=0.05?1.7+(0.4-d)/0.35*1.5:3.4; }
function rnOkTurn(R,a,dx,dy){ const l=Math.hypot(dx,dy)||1; for(const e of R.adj[a]){ const o=R.ea[e]===a?R.eb[e]:R.ea[e], ox=R.x[o]-R.x[a], oy=R.y[o]-R.y[a], ol=Math.hypot(ox,oy)||1; if((ox*dx+oy*dy)/(ol*l)>0.85) return false; } return true; }
function rnLandOk(x,y){ const xi=Math.round(x), yi=Math.round(y); if(xi<0||yi<0||xi>=W||yi>=H) return false; const i=yi*W+xi; return !G.water[i]&&G.e[i]<0.74&&G.pk[i]<0.3; }
function rnGrow(R,tries,rand){
  rand=rand||Math.random; const B=G.bounds; let added=0; if(R.x.length>RN_MAXN) return 0;
  // only places people live that are still far from any road
  // distance to the nearest road comes from the growth model's road-access field (refreshed as roads are added)
  if(!growth.roadAcc) updateRoadAccess(); const RAc=growth.roadAcc;
  const cand=[]; for(let y=B[1]+2;y<B[3]-2;y++) for(let x=B[0]+2;x<B[2]-2;x++){ const i=y*W+x, d=G.D[i]; if(d>=0.05&&!G.water[i]&&-7*Math.log(Math.max(RAc[i],1e-9))>=rnSpacing(d)*0.6) cand.push(i); }
  if(!cand.length) return 0; const dead=[]; for(let i=0;i<R.x.length;i++) if(R.adj[i].length===1&&inB(R.x[i],R.y[i],2)) dead.push(i);
  const Dat=(x,y)=>G.D[clamp(Math.round(y),0,H-1)*W+clamp(Math.round(x),0,W-1)];
  // walk a street forward from node a in direction (dx,dy): straight-ish, crossing what it meets, stopping where it would crowd another road
  const walk=(a,dx,dy,maxSteps,force)=>{ force=force||0;
    let n=0;
    for(let st=0;st<maxSteps;st++){
      const d=Math.max(Dat(R.x[a]+dx*1.2,R.y[a]+dy*1.2),st<force?0.06:0); if(d<0.03) break; const sp=rnSpacing(d), L=clamp(sp*1.15,1.2,3), ex=R.x[a]+dx*L, ey=R.y[a]+dy*L;
      if(!inB(ex,ey,1)||!rnLandOk(ex,ey)||!rnLandOk((R.x[a]+ex)/2,(R.y[a]+ey)/2)) break;
      // a road running alongside, too close: join it and stop
      const near=rnNearNode(R,ex,ey,sp*0.45); if(near>=0&&near!==a){ if(R.adj[a].some(e=>R.ea[e]===near||R.eb[e]===near)) break; const b=rnLink(R,a,R.x[near],R.y[near],0,0.2); n++; if(b!==a) break; break; }
      const side=rnNearEdge(R,ex,ey,sp*0.42); if(side&&R.ea[side.e]!==a&&R.eb[side.e]!==a){ const b=rnLink(R,a,side.px,side.py,0,0.3); n++; break; }
      const b=rnLink(R,a,ex,ey,0,0.55); if(b===a) break; n++;
      if(R.adj[b].length>2&&st>0&&rand()<0.5) break;          // reached a crossroads: sometimes carry on through
      a=b; const tw=(rand()-0.5)*0.16, c=Math.cos(tw), s2=Math.sin(tw); const nx=dx*c-dy*s2, ny=dx*s2+dy*c; dx=nx; dy=ny;
    }
    return n;
  };
  for(let k=0;k<tries;k++){
    if(rand()<0.25){ // carry on a dead-end street
      if(!dead.length) continue; const a=dead[Math.floor(rand()*dead.length)]; if(R.adj[a].length!==1) continue; const e=R.adj[a][0], o=R.ea[e]===a?R.eb[e]:R.ea[e];
      const dx=R.x[a]-R.x[o], dy=R.y[a]-R.y[o], l=Math.hypot(dx,dy)||1; added+=walk(a,dx/l,dy/l,4); continue;
    }
    const ci=cand[Math.floor(rand()*cand.length)], x=ci%W+rand()-0.5, y=Math.floor(ci/W)+rand()-0.5, d=G.D[ci];
    if(!rnLandOk(x,y)) continue;
    const s=rnSpacing(d); let h=rnNearEdge(R,x,y,s*2.8);
    if(!h){ // far out: send a road out from the nearest road towards the new houses
      h=rnNearEdge(R,x,y,14); if(!h) continue; const ux=(x-h.px)/h.d, uy=(y-h.py)/h.d; const a=rnSplit(R,h.e,h.px,h.py); if(!rnOkTurn(R,a,ux,uy)) continue; added+=walk(a,ux,uy,Math.ceil(h.d/2)+2,Math.ceil(h.d/2.2)); continue; }
    if(h.d<s*0.62) continue;
    const a0=R.ea[h.e], b0=R.eb[h.e], tx=R.x[b0]-R.x[a0], ty=R.y[b0]-R.y[a0], tl=Math.hypot(tx,ty)||1;
    let nx=-ty/tl, ny=tx/tl; if(nx*(x-h.px)+ny*(y-h.py)<0){ nx=-nx; ny=-ny; }
    // branch off at a right angle — or reuse a nearby junction so streets line up into crossroads
    let a=-1; const jn=rnNearNode(R,h.px,h.py,s*0.45); if(jn>=0&&R.adj[jn].length>=2) a=jn;
    if(a<0){ if(!rnLandOk(h.px+nx*1.2,h.py+ny*1.2)) continue; a=rnSplit(R,h.e,h.px,h.py); }
    if(!rnOkTurn(R,a,nx,ny)) continue;
    added+=walk(a,nx,ny,3+Math.floor(rand()*7),1);
  }
  return added;
}
// trips on the street graph: roads people keep using get wider
function rnTraffic(R,n,rand){
  rand=rand||Math.random; const N=R.x.length; if(N<2||!G.agents||!G.agents.length) return;
  if(!R.dd||R.dd.length<N){ R.dd=new Float32Array(N+4096); R.pe=new Int32Array(N+4096); R.st=new Int32Array(N+4096); R.run=0; }
  const dd=R.dd, pe=R.pe, st=R.st;
  for(let k=0;k<n;k++){
    const ag=G.agents[Math.floor(rand()*G.agents.length)], s=rnNearNode(R,ag.hx,ag.hy,4), t=rnNearNode(R,ag.wx,ag.wy,4); if(s<0||t<0||s===t) continue;
    const run=++R.run, tx=R.x[t], ty=R.y[t]; dd[s]=0; pe[s]=-1; st[s]=run; HPQ.n=0; hqPush(0,s); let found=false, pops=0;
    while(HPQ.n&&pops<40000){ const u=hqPop(); pops++; if(u===t){ found=true; break; }
      for(const e of R.adj[u]){ const v=R.ea[e]===u?R.eb[e]:R.ea[e], w=Math.hypot(R.x[v]-R.x[u],R.y[v]-R.y[u])/RN_SPEED[R.ec[e]], nd=dd[u]+w;
        if(st[v]!==run||nd<dd[v]){ dd[v]=nd; pe[v]=e; st[v]=run; hqPush(nd+Math.hypot(R.x[v]-tx,R.y[v]-ty)/RN_SPEED[4],v); } } }
    if(!found) continue; R.trips++;
    for(let u=t;u!==s;){ const e=pe[u]; R.ef[e]+=1; u=R.ea[e]===u?R.eb[e]:R.ea[e]; }
  }
}
// once a year: busy streets get upgraded
function rnWiden(R){
  const T=Math.max(1,R.trips)/240; let up=0;
  for(let e=0;e<R.ea.length;e++){ const f=R.ef[e]/T, c=R.ec[e]; let nc=c;
    if(c<1&&f>=2) nc=1; if(c<2&&f>=5.5) nc=2; if(c<3&&f>=14) nc=3;
    if(nc!==c){ R.ec[e]=nc; up++; markRoad([[R.x[R.ea[e]],R.y[R.ea[e]]],[R.x[R.eb[e]],R.y[R.eb[e]]]],rnLv(nc)); }
    R.ef[e]*=0.5; }
  R.trips*=0.5; if(up) R.ver++; return up;
}
function rnBuild(){
  const R=rnNew(); G.rn=R; const rand=mulberry32(G.seed*53+7);
  for(const p of G.highways) rnPolyline(R,p,4); for(const p of G.arterials) rnPolyline(R,p,3); for(const p of (G.locals||[])) rnPolyline(R,p,1);
  for(const r of G.extraRoads) rnPolyline(R,r.p,r.c==='hwy'?4:r.c==='art'?3:1); G.extraRoads=[];
  rnFill(R,rand); R.et.fill(-99); R.ver++; return R;
}
function rnFill(R,rand){ for(let round=0;round<16;round++){ updateRoadAccess(); const a=rnGrow(R,5000,rand); if(a<40) break; } rnTraffic(R,240,rand); rnWiden(R); }
// compact save: node coords ×10 and edge endpoints as 16-bit, classes as bytes
function b64(u8){ if(typeof btoa!=='undefined'){ let s=''; for(let i=0;i<u8.length;i+=8192) s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192)); return btoa(s); } return Buffer.from(u8).toString('base64'); }
function unb64(s){ if(typeof atob!=='undefined'){ const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s,'base64')); }
function rnEncode(R){
  if(R.enc&&R.encVer===R.ver) return R.enc;
  const N=R.x.length, E=R.ea.length, nb=new Uint16Array(N*2), eb=new Uint16Array(E*2), cb=new Uint8Array(E);
  for(let i=0;i<N;i++){ nb[2*i]=Math.round(R.x[i]*10); nb[2*i+1]=Math.round(R.y[i]*10); }
  for(let e=0;e<E;e++){ eb[2*e]=R.ea[e]; eb[2*e+1]=R.eb[e]; cb[e]=R.ec[e]; }
  R.enc={n:b64(new Uint8Array(nb.buffer)),e:b64(new Uint8Array(eb.buffer)),c:b64(cb)}; R.encVer=R.ver; return R.enc;
}
function rnDecode(o){
  const R=rnNew(), nu=unb64(o.n).slice(), eu=unb64(o.e).slice(), cb=unb64(o.c), nb=new Uint16Array(nu.buffer,0,nu.length>>1), eb=new Uint16Array(eu.buffer,0,eu.length>>1);
  for(let i=0;i<nb.length;i+=2) rnAddNode(R,nb[i]/10,nb[i+1]/10);
  for(let e=0;e<cb.length;e++){ const a=eb[2*e], b=eb[2*e+1]; if(a>=R.x.length||b>=R.x.length) continue; const k=R.ea.length; R.ea.push(a); R.eb.push(b); R.ec.push(cb[e]); R.ef.push(0); R.et.push(-99); R.adj[a].push(k); R.adj[b].push(k); rnCells(R,k,q=>rnPut(R.eg,q,k)); markRoad([[R.x[a],R.y[a]],[R.x[b],R.y[b]]],rnLv(cb[e])); }
  return R;
}

function rnAccKey(){ return G.rn?Math.floor(G.rn.ea.length/150):'-'+G.extraRoads.length; }
// monthly: streets creep outward, traffic is counted, once a year busy streets widen
function roadsTick(){ const R=G.rn; if(!R) return 0; const v=R.ver; rnGrow(R,420); rnTraffic(R,20); if(months%12===0) rnWiden(R); return R.ver!==v; }

// population grid save: sqrt-scaled bytes with zero runs, ~100–200 KB
function encodeD(){
  const n=W*H, out=[]; let z=0;
  for(let i=0;i<n;i++){ const q=Math.min(255,Math.round(Math.sqrt(Math.max(0,G.D[i])/4)*255)); if(q===0){ z++; if(z===255){ out.push(0,255); z=0; } continue; } if(z){ out.push(0,z); z=0; } out.push(q); }
  if(z) out.push(0,z); return b64(Uint8Array.from(out));
}
function decodeD(str){
  const u=unb64(str), n=W*H, D=new Float32Array(n); let i=0;
  for(let k=0;k<u.length&&i<n;k++){ const q=u[k]; if(q===0){ i+=u[++k]; continue; } const f=q/255; D[i++]=f*f*4; }
  return i===n?D:null;
}
