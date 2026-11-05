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
const BLD_CLR=[0.08,0.09,0.11,0.13,0.16], BLD_RAIL=0.1;     // half-width to keep clear, by street class (cells)
const bldTileOfEdge=(R,e,dirty)=>{ const a=R.ea[e], b=R.eb[e], m=0.6, x0=Math.min(R.x[a],R.x[b])-m, x1=Math.max(R.x[a],R.x[b])+m, y0=Math.min(R.y[a],R.y[b])-m, y1=Math.max(R.y[a],R.y[b])+m;
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
function bldTile(tx,ty){
  if(G.rn&&(G.rn.ver!==bldRoadVer||G.rn!==bldRoadOf)) bldRoadSync();
  const key=tx*1000+ty; let t=bldCache.get(key); if(t) return t;
  const out=[], x0=tx*BLD_T, y0=ty*BLD_T, pk=G.pk, D=G.D, water=G.water, ru=G.roadUse, B=G.bounds, rm=bldSegs(x0,y0);
  for(let y=y0;y<y0+BLD_T;y++) for(let x=x0;x<x0+BLD_T;x++){
    if(x<B[0]||y<B[1]||x>=B[2]||y>=B[3]) continue; const i=y*W+x; if(water[i]||pk[i]>0.255) continue;
    const d=D[i]; if(d<0.07) continue;
    const r=ru?ru[i]:0; let h=hashInt(i*7919+G.seed); const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
    // a grid of plots (3×3 downtown, 2×2 elsewhere); a plot cut by a street gets a smaller building or none
    const n=d>0.45?3:2, fillP=d>0.6?0.95:d>0.3?0.8:d>0.15?0.55:0.35, sz=1/n;
    for(let s=0;s<n*n;s++){ if(rnd()>fillP) continue;
      const sx=(s%n)*sz, sy=Math.floor(s/n)*sz; let bx,by,w,dd,ok=false;
      for(let k=0;k<3&&!ok;k++){ const f=sz*(k===0?0.55+rnd()*0.3:k===1?0.45:0.32);
        w=f*(0.8+rnd()*0.3); dd=f*(0.75+rnd()*0.3); bx=x-0.5+sx+(sz-w)*(k===2?0.5:rnd()); by=y-0.5+sy+(sz-dd)*(k===2?0.5:rnd()); ok=!bldOnRoad(rm,bx,by,w,dd); }
      if(!ok) continue;
      let hm=(6+30*Math.pow(Math.min(d,1.5),1.5))*(0.6+rnd()*0.7);         // metres
      if(d>1&&rnd()<0.06) hm=Math.min(240,hm*(1.8+rnd()*1.4));               // the odd tower downtown
      out.push({x:bx,y:by,w,d:dd,h:hm/150,c:(h>>>20)&3}); } }
  out.sort((a,b)=>(a.y+a.d)-(b.y+b.d));
  t={list:out,ver:bldVer}; bldCache.set(key,t); if(bldCache.size>900) bldCache.delete(bldCache.keys().next().value); return t;
}
function bldInRect(x0,y0,x1,y1,cb){
  const tx0=Math.floor(x0/BLD_T), ty0=Math.floor(y0/BLD_T), tx1=Math.floor(x1/BLD_T), ty1=Math.floor(y1/BLD_T);
  for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){ if(tx<0||ty<0||tx*BLD_T>=W||ty*BLD_T>=H) continue; for(const b of bldTile(tx,ty).list) if(b.x+b.w>=x0&&b.x<=x1&&b.y+b.d>=y0&&b.y<=y1) cb(b); }
}
// On the map buildings are seen from straight above, like a city plan: each footprint casts a soft shadow to the
// south-east as long as the building is tall, so the skyline still reads, but nothing leans over the streets.
let bldBand=null;                      // while the map layer is repainted in bands: the screen rows being painted
const BLD_Z=1.0;                         // shadow length per unit of height
function drawBuildings2D(){
  const a=smooth(cam.s,9,14); if(a<=0.01) return;
  const yA=bldBand?bldBand[0]:0, yB=bldBand?bldBand[1]:vh, [x0,y0]=toWorld(-40,yA-40), [x1,y1]=toWorld(vw+40,yB+40), list=[];
  bldInRect(x0-1,y0-1,x1,y1,b=>list.push(b));
  ctx.save(); ctx.globalAlpha=a; ctx.lineJoin='miter';
  // shadows: the footprint swept towards the south-east
  const sh=new Path2D(); for(const b of list){ const z=Math.min(1.2,b.h*BLD_Z), ox=z*0.55, oy=z*0.42;   /* rectangles only: a path of plain rects fills far faster than one of polygons */
    sh.rect(b.x+ox*0.35,b.y+oy*0.35,b.w+ox*0.65,b.d+oy*0.65); }
  ctx.fillStyle=C['bld-shadow']; ctx.fill(sh);
  // roofs: flat ones in two greys, tiled ones on the low-rise houses; a darker rim on the sunless sides
  // (a filled sliver on the sunless sides instead of a stroked outline: fills are far cheaper to draw than strokes)
  const RC=[C['bld-roof'],C['bld-roof2'],'#c47a62','#9c7266','#7d8794','#b39478'], rf=RC.map(()=>new Path2D()), rim=new Path2D(), e=Math.max(0.6/cam.s,0.012);
  for(const b of list){ rim.rect(b.x+e,b.y+e,b.w,b.d); rf[b.h*150<14?2+(b.c&3):(b.c&1)].rect(b.x,b.y,b.w,b.d); }
  ctx.fillStyle=C['bld-side']; ctx.fill(rim); rf.forEach((p,i)=>{ ctx.fillStyle=RC[i]; ctx.fill(p); });
  // trees in the parks and woods
  const tr=new Path2D(), ts=new Path2D(), tz=0.06;
  for(let y=Math.floor(y0);y<=y1;y++) for(let x=Math.floor(x0);x<=x1;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]) continue; const pk=G.pk[i], n=pk>0.27?6:pk>0.255?3:(pk>0.12&&G.D[i]<0.05)?4:0;
    for(let k=0;k<n;k++){ const h=hashInt(i*59+k*7919), tx=x-0.5+(h&1023)/1023, ty=y-0.5+((h>>10)&1023)/1023, r=0.07+((h>>20)&63)/63*0.05; ts.moveTo(tx+r+0.04,ty+0.03); ts.arc(tx+0.04,ty+0.03,r,0,6.283); tr.moveTo(tx+r,ty-tz); tr.arc(tx,ty-tz,r,0,6.283); } }
  ctx.fillStyle='rgba(30,60,30,.18)'; ctx.fill(ts); ctx.fillStyle=isDark()?'#2f5a34':'#79a95e'; ctx.fill(tr);
  ctx.restore();
}
