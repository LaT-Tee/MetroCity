/* ---------- buildings: generated from the city itself, shown from above on the map and in 3D in the viewing mode ----------
   Every built-up cell (150 m) gets a few buildings from a hash of its position, so they never move between frames or
   visits; how many and how tall follows the cell's density, so the skyline rises as the city grows. Parks, water and
   highway cells stay clear. Footprints and heights are in cells (1 cell = 150 m). */
const BLD_T=12;                         // tile size in cells
let bldVer=0, bldCache=new Map(), bldRoadVer=-1, bldRoadOf=null, bldRoadN=0, bldRoadC=null, bldRoadDirty=0;
function bldBump(){ bldVer++; bldCache.clear(); }
// streets stay clear: every plot is tested against the actual street segments nearby, widened to the drawn street plus
// its pavement, so no building ever sits on a road. When streets are added (or widened) each month only the building
// tiles they pass through are regenerated.
const BLD_CLR=ROAD_W.map(w=>w/2+0.018), BLD_RAIL=0.1;     // half-width to keep clear, by street class (cells)
const bldTileOfEdge=(R,e,dirty)=>{ const a=R.ea[e], b=R.eb[e], m=1.2, x0=Math.min(R.x[a],R.x[b])-m, x1=Math.max(R.x[a],R.x[b])+m, y0=Math.min(R.y[a],R.y[b])-m, y1=Math.max(R.y[a],R.y[b])+m;
  for(let ty=Math.floor((y0+0.5)/BLD_T);ty<=Math.floor((y1+0.5)/BLD_T);ty++) for(let tx=Math.floor((x0+0.5)/BLD_T);tx<=Math.floor((x1+0.5)/BLD_T);tx++) dirty.add(tx*1000+ty); };
function bldRoadSync(){
  const R=G.rn; if(!R){ bldRoadOf=null; return; } if(bldRoadOf===R&&bldRoadVer===R.ver) return;
  if(bldRoadOf!==R||R.ea.length<bldRoadN||!bldRoadC){ bldRoadOf=R; bldRoadVer=R.ver; bldRoadN=R.ea.length; bldRoadC=Uint8Array.from(R.ec); bldCache.clear(); bldRoadDirty++; return; }
  const dirty=new Set(); if(bldRoadC.length<R.ea.length){ const c=new Uint8Array(R.ea.length*2); c.set(bldRoadC); bldRoadC=c; }
  for(let e=0;e<R.ea.length;e++) if(e>=bldRoadN||bldRoadC[e]!==R.ec[e]){ bldTileOfEdge(R,e,dirty); bldRoadC[e]=R.ec[e]; }
  bldRoadN=R.ea.length; bldRoadVer=R.ver; for(const k of dirty) bldCache.delete(k); if(dirty.size) bldRoadDirty++; }
// the street and rail segments near one tile, binned per cell so each plot only looks at the few next to it
function bldSegs(x0,y0){ const R=G.rn, bins=new Map(), add=(ax,ay,bx,by,c)=>{ const s=[ax,ay,bx,by,c];
    for(let y=Math.floor(Math.min(ay,by)-c+0.5);y<=Math.floor(Math.max(ay,by)+c+0.5);y++) for(let x=Math.floor(Math.min(ax,bx)-c+0.5);x<=Math.floor(Math.max(ax,bx)+c+0.5);x++){
      if(x<x0-1||y<y0-1||x>x0+BLD_T||y>y0+BLD_T) continue; const k=y*W+x; let l=bins.get(k); if(!l){ l=[]; bins.set(k,l); } l.push(s); } };
  if(R){ const seen=new Set(); for(let gy=Math.floor((y0-1)/RN_G);gy<=Math.floor((y0+BLD_T+1)/RN_G);gy++) for(let gx=Math.floor((x0-1)/RN_G);gx<=Math.floor((x0+BLD_T+1)/RN_G);gx++){ const l=R.eg.get(rnKey(gx,gy)); if(!l) continue;
      for(const e of l){ if(seen.has(e)) continue; seen.add(e); const a=R.ea[e], b=R.eb[e]; add(R.x[a],R.y[a],R.x[b],R.y[b],BLD_CLR[R.ec[e]]||0.1); } } }
  const rl=G.rail; if(rl) for(let i=1;i<rl.length;i++){ const a=rl[i-1], b=rl[i]; if(Math.max(a[0],b[0])<x0-2||Math.min(a[0],b[0])>x0+BLD_T+1||Math.max(a[1],b[1])<y0-2||Math.min(a[1],b[1])>y0+BLD_T+1) continue; add(a[0],a[1],b[0],b[1],BLD_RAIL); }
  return bins; }
// is the segment within c of the rectangle? (it crosses it, or an end or a corner is that close)
function segHitsRect(s,x,y,w,d){ const c=s[4];
  if(Math.max(s[0],s[2])<x-c||Math.min(s[0],s[2])>x+w+c||Math.max(s[1],s[3])<y-c||Math.min(s[1],s[3])>y+d+c) return false;
  const dx=s[2]-s[0], dy=s[3]-s[1]; let t0=0, t1=1;
  const clip=(p,q)=>{ if(p===0) return q>=0; const r=q/p; if(p<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; } return true; };
  if(clip(-dx,s[0]-x)&&clip(dx,x+w-s[0])&&clip(-dy,s[1]-y)&&clip(dy,y+d-s[1])&&t0<=t1) return true;
  const pr=(px,py)=>{ const ex=px-clamp(px,x,x+w), ey=py-clamp(py,y,y+d); return ex*ex+ey*ey; }, l2=dx*dx+dy*dy||1e-9;
  const ps=(px,py)=>{ const t=clamp(((px-s[0])*dx+(py-s[1])*dy)/l2,0,1), ex=s[0]+dx*t-px, ey=s[1]+dy*t-py; return ex*ex+ey*ey; };
  return Math.min(pr(s[0],s[1]),pr(s[2],s[3]),ps(x,y),ps(x+w,y),ps(x,y+d),ps(x+w,y+d))<=c*c; }
function bldOnRoad(bins,x,y,w,d){ for(let cy=Math.floor(y+0.5);cy<=Math.floor(y+d+0.5);cy++) for(let cx=Math.floor(x+0.5);cx<=Math.floor(x+w+0.5);cx++){ const l=bins.get(cy*W+cx); if(l) for(const s of l) if(segHitsRect(s,x,y,w,d)) return true; } return false; }
// the same for a building turned by an angle about its centre: the street is turned back into the building's own frame
function bldOnRoadR(bins,cx,cy,hw,hd,ca,sa){ const rx=Math.abs(hw*ca)+Math.abs(hd*sa), ry=Math.abs(hw*sa)+Math.abs(hd*ca), t=[0,0,0,0,0];
  for(let yy=Math.floor(cy-ry+0.5);yy<=Math.floor(cy+ry+0.5);yy++) for(let xx=Math.floor(cx-rx+0.5);xx<=Math.floor(cx+rx+0.5);xx++){ const l=bins.get(yy*W+xx); if(!l) continue;
    for(const s of l){ const ax=s[0]-cx, ay=s[1]-cy, bx=s[2]-cx, by=s[3]-cy; t[0]=ax*ca+ay*sa; t[1]=-ax*sa+ay*ca; t[2]=bx*ca+by*sa; t[3]=-bx*sa+by*ca; t[4]=s[4]; if(segHitsRect(t,-hw,-hd,2*hw,2*hd)) return true; } } return false; }
/* A tile of buildings. Streets come first: every street is lined with plots on both sides, each building facing the
   street it stands on (houses with gardens in the suburbs, terraces and blocks further in, big footprints downtown),
   then the insides of the blocks are filled where the city is dense. A fine occupancy grid keeps buildings apart, and
   every footprint is tested against the streets and the railway, so nothing stands on a road. A building is
   {x,y,w,d} (its footprint before turning), a (its angle about the footprint's centre), h (height in cells). */
const BLD_OC=24, BLD_M=1;
function bldTile(tx,ty){
  if(G.rn&&(G.rn.ver!==bldRoadVer||G.rn!==bldRoadOf)) bldRoadSync();
  const key=tx*1000+ty; let t=bldCache.get(key); if(t) return t;
  const out=[], x0=tx*BLD_T, y0=ty*BLD_T, pk=G.pk, D=G.D, water=G.water, B=G.bounds, rm=bldSegs(x0,y0), R=G.rn;
  const ox=x0-0.5-BLD_M, oy=y0-0.5-BLD_M, ON=(BLD_T+2*BLD_M)*BLD_OC, occ=new Uint8Array(ON*ON);
  // claim a turned footprint on the occupancy grid (with a small gap to the neighbours); false if something is there
  const claim=(cx,cy,hw,hd,ca,sa,gap)=>{ const rx=Math.abs(hw*ca)+Math.abs(hd*sa)+gap, ry=Math.abs(hw*sa)+Math.abs(hd*ca)+gap;
    const gx0=Math.max(0,Math.floor((cx-rx-ox)*BLD_OC)), gx1=Math.min(ON-1,Math.floor((cx+rx-ox)*BLD_OC)), gy0=Math.max(0,Math.floor((cy-ry-oy)*BLD_OC)), gy1=Math.min(ON-1,Math.floor((cy+ry-oy)*BLD_OC));
    const ci=clamp(Math.floor((cy-oy)*BLD_OC),0,ON-1)*ON+clamp(Math.floor((cx-ox)*BLD_OC),0,ON-1); if(occ[ci]) return false;
    for(let pass=0;pass<2;pass++){ const g=pass?0:gap; for(let gy=gy0;gy<=gy1;gy++) for(let gx=gx0;gx<=gx1;gx++){ const px=ox+(gx+0.5)/BLD_OC-cx, py=oy+(gy+0.5)/BLD_OC-cy, u=px*ca+py*sa, v=-px*sa+py*ca;
        if(Math.abs(u)<=hw+g&&Math.abs(v)<=hd+g){ if(pass) occ[gy*ON+gx]=1; else if(occ[gy*ON+gx]) return false; } } }
    occ[ci]=1; return true; };
  const okGround=(x,y)=>{ const xi=Math.round(x), yi=Math.round(y); if(xi<B[0]||yi<B[1]||xi>=B[2]||yi>=B[3]) return -1; const i=yi*W+xi; return water[i]||pk[i]>0.255?-1:D[i]; };
  const inTile=(x,y)=>x>=x0-0.5&&x<x0+BLD_T-0.5&&y>=y0-0.5&&y<y0+BLD_T-0.5;
  // 1. plots along the streets
  if(R){ const es=[], seen=new Set(); for(let gy=Math.floor((y0-1.5)/RN_G);gy<=Math.floor((y0+BLD_T+1.5)/RN_G);gy++) for(let gx=Math.floor((x0-1.5)/RN_G);gx<=Math.floor((x0+BLD_T+1.5)/RN_G);gx++){ const l=R.eg.get(rnKey(gx,gy)); if(l) for(const e of l) if(!seen.has(e)){ seen.add(e); es.push(e); } }
    es.sort((p,q)=>p-q);
    for(const e of es){ const c=R.ec[e]; if(c>=4) continue; const ax=R.x[R.ea[e]], ay=R.y[R.ea[e]], bx=R.x[R.eb[e]], by=R.y[R.eb[e]], L=Math.hypot(bx-ax,by-ay); if(L<0.14) continue;
      const tx_=(bx-ax)/L, ty_=(by-ay)/L, ang=Math.atan2(ty_,tx_), he=hashInt((Math.imul(Math.round(ax*10),73856093)^Math.imul(Math.round(ay*10),19349663)^Math.imul(Math.round(bx*10),83492791)^Math.imul(Math.round(by*10),2654435))+G.seed);
      for(const sg of [1,-1]){ let h=hashInt(he+(sg>0?11:29)); const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
        let u=0.03+rnd()*0.05;
        for(let g=0;g<40&&u<L-0.05;g++){ const d=okGround(ax+tx_*u+ -ty_*sg*0.3,ay+ty_*u+tx_*sg*0.3); if(d<0.05){ u+=0.25; rnd(); continue; }
          let f,dp,bw,setb,fill,hm,gapU; const r1=rnd(), r2=rnd(), r3=rnd();
          if(d<0.3){ f=0.085+r1*0.05; dp=0.07+r2*0.04; bw=f*0.74; setb=0.03+r3*0.025; fill=d<0.1?0.5:d<0.18?0.74:0.9; hm=4.5+r2*4.5; gapU=0.012+r3*0.02; }
          else if(d<0.7){ f=0.13+r1*0.13; dp=0.1+r2*0.07; bw=f*0.9; setb=0.012; fill=0.94; hm=(6+30*Math.pow(d,1.5))*(0.6+r3*0.7); gapU=0.012; }
          else { f=0.17+r1*0.2; dp=0.14+r2*0.1; bw=f*0.92; setb=0.006; fill=0.97; hm=(6+30*Math.pow(Math.min(d,1.5),1.5))*(0.6+r3*0.7); gapU=0.014; }
          if(u+f>L+0.01){ if(L-u<f*0.6) break; f=L-u; bw=Math.min(bw,f*0.9); }
          const put=rnd()<fill, tower=d>1&&rnd()<0.07, off=BLD_CLR[c]+setb+dp/2, cx=ax+tx_*(u+f/2)-ty_*sg*off, cy=ay+ty_*(u+f/2)+tx_*sg*off; u+=f+gapU;
          if(!put||cx<ox+0.1||cy<oy+0.1||cx>ox+ON/BLD_OC-0.1||cy>oy+ON/BLD_OC-0.1||okGround(cx,cy)<0.04) continue;
          if(bldOnRoadR(rm,cx,cy,bw/2,dp/2,tx_,ty_)||!claim(cx,cy,bw/2,dp/2,tx_,ty_,0.014)) continue;
          if(tower) hm=Math.min(240,hm*(1.8+r1*1.4));
          if(inTile(cx,cy)) out.push({x:cx-bw/2,y:cy-dp/2,w:bw,d:dp,h:hm/150,c:(h>>>20)&3,a:ang}); } } } }
  // 2. the insides of the blocks, and the scattered buildings of places no street has reached yet
  for(let y=y0;y<y0+BLD_T;y++) for(let x=x0;x<x0+BLD_T;x++){
    if(x<B[0]||y<B[1]||x>=B[2]||y>=B[3]) continue; const i=y*W+x; if(water[i]||pk[i]>0.255) continue;
    const d=D[i]; if(d<0.07) continue;
    let h=hashInt(i*7919+G.seed); const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
    const n=d>0.45?3:2, fillP=d>0.6?0.9:d>0.3?0.7:d>0.15?0.3:0.2, sz=1/n;
    for(let s=0;s<n*n;s++){ if(rnd()>fillP) continue;
      const sx=(s%n)*sz, sy=Math.floor(s/n)*sz; let bx,by,w,dd,ok=false;
      for(let k=0;k<3&&!ok;k++){ const f=sz*(k===0?0.5+rnd()*0.3:k===1?0.4:0.28);
        w=f*(0.8+rnd()*0.3); dd=f*(0.75+rnd()*0.3); bx=x-0.5+sx+(sz-w)*(k===2?0.5:rnd()); by=y-0.5+sy+(sz-dd)*(k===2?0.5:rnd()); ok=!bldOnRoad(rm,bx,by,w,dd)&&claim(bx+w/2,by+dd/2,w/2,dd/2,1,0,0.016); }
      if(!ok) continue;
      let hm=(6+30*Math.pow(Math.min(d,1.5),1.5))*(0.6+rnd()*0.7);         // metres
      if(d>1&&rnd()<0.06) hm=Math.min(240,hm*(1.8+rnd()*1.4));               // the odd tower downtown
      out.push({x:bx,y:by,w,d:dd,h:hm/150,c:(h>>>20)&3,a:0}); } }
  t={list:out,ver:bldVer}; bldCache.set(key,t); if(bldCache.size>900) bldCache.delete(bldCache.keys().next().value); return t;
}
function bldInRect(x0,y0,x1,y1,cb){
  const tx0=Math.floor((x0-1)/BLD_T), ty0=Math.floor((y0-1)/BLD_T), tx1=Math.floor((x1+1)/BLD_T), ty1=Math.floor((y1+1)/BLD_T);
  for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){ if(tx<0||ty<0||tx*BLD_T>=W||ty*BLD_T>=H) continue; for(const b of bldTile(tx,ty).list) if(b.x+b.w+0.2>=x0&&b.x-0.2<=x1&&b.y+b.d+0.2>=y0&&b.y-0.2<=y1) cb(b); }
}
// the four corners of a building's footprint, turned about its centre
function bldCorners(b,dx,dy){ const cx=b.x+b.w/2+(dx||0), cy=b.y+b.d/2+(dy||0), hw=b.w/2, hd=b.d/2; if(!b.a) return [cx-hw,cy-hd,cx+hw,cy-hd,cx+hw,cy+hd,cx-hw,cy+hd];
  const ca=Math.cos(b.a), sa=Math.sin(b.a), ux=hw*ca, uy=hw*sa, vx=-hd*sa, vy=hd*ca; return [cx-ux-vx,cy-uy-vy,cx+ux-vx,cy+uy-vy,cx+ux+vx,cy+uy+vy,cx-ux+vx,cy-uy+vy]; }
// On the map buildings are seen from straight above, like a city plan: each footprint casts a soft shadow to the
// south-east as long as the building is tall, so the skyline still reads, but nothing leans over the streets.
// Each tile keeps its outlines as ready-made paths (shadows, rims, one per roof colour, trees), so a frame only fills
// a handful of paths per tile however many buildings there are.
let bldBand=null, bldPending=false;    // while the map layer is repainted in bands: the screen rows being painted
const BLD_Z=1.0;                         // shadow length per unit of height
function bldPaths(t,tx,ty){ if(t.p) return t.p;
  const sh=new Path2D(), rim=new Path2D(), rf=[0,1,2,3,4,5].map(()=>new Path2D()), poly=(p,q)=>{ p.moveTo(q[0],q[1]); p.lineTo(q[2],q[3]); p.lineTo(q[4],q[5]); p.lineTo(q[6],q[7]); p.closePath(); };
  for(const b of t.list){ const z=Math.min(1.2,b.h*BLD_Z); poly(sh,bldCorners(b,z*0.32,z*0.25)); const q=bldCorners(b); poly(rim,q); poly(rf[b.h*150<14?2+(b.c&3):(b.c&1)],q); }
  const tr=new Path2D(), ts=new Path2D(), tz=0.06;
  for(let y=ty*BLD_T;y<(ty+1)*BLD_T;y++) for(let x=tx*BLD_T;x<(tx+1)*BLD_T;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]) continue; const pk=G.pk[i], n=pk>0.27?6:pk>0.255?3:(pk>0.12&&G.D[i]<0.05)?4:0;
    for(let k=0;k<n;k++){ const h=hashInt(i*59+k*7919), px=x-0.5+(h&1023)/1023, py=y-0.5+((h>>10)&1023)/1023, r=0.07+((h>>20)&63)/63*0.05; ts.moveTo(px+r+0.04,py+0.03); ts.arc(px+0.04,py+0.03,r,0,6.283); tr.moveTo(px+r,py-tz); tr.arc(px,py-tz,r,0,6.283); } }
  return t.p={sh,rim,rf,tr,ts}; }
// tiles of the current view that are still missing are worked out a few milliseconds a frame; true once all are there
let bldWarmAt=0;
function bldWarm(){ const [x0,y0]=toWorld(-40,-40), [x1,y1]=toWorld(vw+40,vh+40), t0=performance.now(); let left=0;
  for(let ty=Math.max(0,Math.floor((y0-1)/BLD_T));ty<=Math.floor((y1+1)/BLD_T)&&ty*BLD_T<H;ty++) for(let tx=Math.max(0,Math.floor((x0-1)/BLD_T));tx<=Math.floor((x1+1)/BLD_T)&&tx*BLD_T<W;tx++){
    if(bldCache.has(tx*1000+ty)) continue; if(performance.now()-t0>8){ left++; continue; } bldPaths(bldTile(tx,ty),tx,ty); }
  if(left&&t0-bldWarmAt<350) return 0; bldWarmAt=t0; return left?2:1; }
function drawBuildings2D(){
  const a=smooth(cam.s,9,14); if(a<=0.01) return;
  const yA=bldBand?bldBand[0]:0, yB=bldBand?bldBand[1]:vh, [x0,y0]=toWorld(-40,yA-40), [x1,y1]=toWorld(vw+40,yB+40), tiles=[], t0=performance.now();
  for(let ty=Math.max(0,Math.floor((y0-1)/BLD_T));ty<=Math.floor((y1+1)/BLD_T)&&ty*BLD_T<H;ty++) for(let tx=Math.max(0,Math.floor((x0-1)/BLD_T));tx<=Math.floor((x1+1)/BLD_T)&&tx*BLD_T<W;tx++){
    // new tiles are worked out a few milliseconds a frame; the rest follow on the next frames
    if(!bldCache.has(tx*1000+ty)&&performance.now()-t0>(bldBand?2:9)){ bldPending=true; continue; } tiles.push(bldPaths(bldTile(tx,ty),tx,ty)); }
  ctx.save(); ctx.globalAlpha=a; ctx.lineJoin='miter';
  ctx.fillStyle=C['bld-shadow']; for(const p of tiles) ctx.fill(p.sh);
  // roofs: flat ones in two greys, tiled ones on the low-rise houses; a darker rim on the sunless sides
  const RC=[C['bld-roof'],C['bld-roof2'],'#c47a62','#9c7266','#7d8794','#b39478'], e=Math.max(0.6/cam.s,0.012);
  ctx.fillStyle=C['bld-side']; ctx.translate(e,e); for(const p of tiles) ctx.fill(p.rim); ctx.translate(-e,-e);
  for(let k=0;k<6;k++){ ctx.fillStyle=RC[k]; for(const p of tiles) ctx.fill(p.rf[k]); }
  // trees in the parks and woods
  ctx.fillStyle='rgba(30,60,30,.18)'; for(const p of tiles) ctx.fill(p.ts); ctx.fillStyle=isDark()?'#2f5a34':'#79a95e'; for(const p of tiles) ctx.fill(p.tr);
  ctx.restore();
}
