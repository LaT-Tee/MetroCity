/* ---------- buildings: generated from the city itself, shown from above on the map and in 3D in the viewing mode ----------
   Every built-up cell (150 m) gets a few buildings from a hash of its position, so they never move between frames or
   visits; how many and how tall follows the cell's density, so the skyline rises as the city grows. Parks, water and
   highway cells stay clear. Footprints and heights are in cells (1 cell = 150 m). */
const BLD_T=12;                         // tile size in cells
let bldVer=0, bldCache=new Map(), bldRoadVer=-1, bldRoadOf=null, bldRoadN=0, bldRoadC=null, bldRoadDirty=0;
// a new year: tiles are not thrown away, each is worked out again when next needed and keeps its old picture until then
function bldBump(){ bldVer++; }
// during a ride in the 3D view the city round the train must not change under the viewer's eyes: while this is set, a
// tile that has been worked out keeps its buildings even if the city has moved on (it catches up at the next cut)
let bldFreeze=false;
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
  bldRoadN=R.ea.length; bldRoadVer=R.ver; for(const k of dirty){ const t=bldCache.get(k); if(t) t.ver=-1; } if(dirty.size) bldRoadDirty++; }
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
  const key=tx*1000+ty; let t=bldCache.get(key); if(t&&(t.ver===bldVer||bldFreeze)) return t; const stale=t;
  const out=[], x0=tx*BLD_T, y0=ty*BLD_T, pk=G.pk, D=G.D, water=G.water, B=G.bounds, rm=bldSegs(x0,y0), R=G.rn;
  const ox=x0-0.5-BLD_M, oy=y0-0.5-BLD_M, ON=(BLD_T+2*BLD_M)*BLD_OC, occ=new Uint8Array(ON*ON);
  // claim a turned footprint on the occupancy grid (with a small gap to the neighbours); false if something is there
  const claim=(cx,cy,hw,hd,ca,sa,gap)=>{ const rx=Math.abs(hw*ca)+Math.abs(hd*sa)+gap, ry=Math.abs(hw*sa)+Math.abs(hd*ca)+gap;
    const gx0=Math.max(0,Math.floor((cx-rx-ox)*BLD_OC)), gx1=Math.min(ON-1,Math.floor((cx+rx-ox)*BLD_OC)), gy0=Math.max(0,Math.floor((cy-ry-oy)*BLD_OC)), gy1=Math.min(ON-1,Math.floor((cy+ry-oy)*BLD_OC));
    const ci=clamp(Math.floor((cy-oy)*BLD_OC),0,ON-1)*ON+clamp(Math.floor((cx-ox)*BLD_OC),0,ON-1); if(occ[ci]) return false;
    for(let pass=0;pass<2;pass++){ const g=pass?0:gap; for(let gy=gy0;gy<=gy1;gy++) for(let gx=gx0;gx<=gx1;gx++){ const px=ox+(gx+0.5)/BLD_OC-cx, py=oy+(gy+0.5)/BLD_OC-cy, u=px*ca+py*sa, v=-px*sa+py*ca;
        if(Math.abs(u)<=hw+g&&Math.abs(v)<=hd+g){ if(pass) occ[gy*ON+gx]=1; else if(occ[gy*ON+gx]) return false; } } }
    occ[ci]=1; return true; };
  const okGround=(x,y)=>{ const xi=Math.round(x), yi=Math.round(y); if(xi<B[0]||yi<B[1]||xi>=B[2]||yi>=B[3]) return -1; const i=yi*W+xi; return water[i]||pk[i]>0.255||(G.air&&G.air[i])?-1:D[i]; };
  const inTile=(x,y)=>x>=x0-0.5&&x<x0+BLD_T-0.5&&y>=y0-0.5&&y<y0+BLD_T-0.5;
  // the whole footprint on dry land, a little back from the bank
  const dry=(cx,cy,hw,hd,ca,sa)=>{ const ux=hw*ca, uy=hw*sa, vx=-hd*sa, vy=hd*ca; return !(wetAt(cx,cy,0.06)||wetAt(cx-ux-vx,cy-uy-vy,0.05)||wetAt(cx+ux-vx,cy+uy-vy,0.05)||wetAt(cx+ux+vx,cy+uy+vy,0.05)||wetAt(cx-ux+vx,cy-uy+vy,0.05)); };
  const feats=[];
  // 0. the places that are not buildings: parks, squares, playgrounds, pitches, car parks, and the plots of schools,
  //    churches and shopping centres. Each cell rolls for one; what it gets follows how built-up the place is, and it is
  //    turned to face the nearest street and shrunk until it fits its block.
  for(let y=y0-BLD_M;y<y0+BLD_T+BLD_M;y++) for(let x=x0-BLD_M;x<x0+BLD_T+BLD_M;x++){
    if(x<B[0]||y<B[1]||x>=B[2]||y>=B[3]) continue; const i=y*W+x; if(water[i]||pk[i]>0.255) continue; const d=D[i]; if(d<0.07) continue;
    let h=hashInt(i*31337+G.seed*7+5); const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
    if(rnd()>(d<0.3?0.045:d<0.8?0.07:0.085)) continue;
    const r=rnd()*100, k=d<0.3?(r<30?'park':r<50?'play':r<68?'pitch':r<82?'school':r<91?'gym':'stadium'):d<0.8?(r<18?'park':r<28?'play':r<40?'plaza':r<48?'pitch':r<58?'lot':r<67?'school':r<75?'church':r<83?'library':r<89?'gym':r<95?'hospital':'stadium'):(r<28?'plaza':r<46?'park':r<54?'lot':r<70?'mall':r<76?'church':r<86?'gov':r<94?'library':'hospital');
    let fw,fd; const q=rnd(), q2=rnd();
    if(k==='park'){ fw=0.5+q*0.5; fd=0.4+q2*0.45; } else if(k==='play'){ fw=0.2+q*0.12; fd=0.18+q2*0.1; } else if(k==='plaza'){ fw=0.32+q*0.3; fd=0.3+q2*0.25; }
    else if(k==='pitch'){ if(q<0.5){ fw=0.72; fd=0.46; } else { fw=0.24; fd=0.14; } } else if(k==='lot'){ fw=0.3+q*0.22; fd=0.22+q2*0.14; }
    else if(k==='school'){ fw=0.5+q*0.15; fd=0.4+q2*0.1; } else if(k==='church'){ fw=0.2+q*0.06; fd=0.3+q2*0.08; } else if(k==='library'){ fw=0.3+q*0.1; fd=0.28+q2*0.08; } else if(k==='gym'){ fw=0.42+q*0.13; fd=0.3+q2*0.06; }
    else if(k==='stadium'){ fw=1.0; fd=0.78; } else if(k==='gov'){ fw=0.5+q*0.12; fd=0.4+q2*0.08; } else if(k==='hospital'){ fw=0.5+q*0.1; fd=0.4+q2*0.06; } else { fw=0.58+q*0.2; fd=0.42+q2*0.12; }
    // face the nearest street
    let ang=0; { const l=rm.get(i); if(l&&l.length){ const sg=l[Math.floor(rnd()*l.length)%l.length]; ang=Math.atan2(sg[3]-sg[1],sg[2]-sg[0]); } }
    const ca=Math.cos(ang), sa=Math.sin(ang); let ok=false, cx=0, cy=0, sc=1;
    for(let tr=0;tr<6&&!ok;tr++){ sc=[1,1,0.8,0.8,0.62,0.5][tr]; cx=x+(rnd()-0.5)*0.7; cy=y+(rnd()-0.5)*0.7; if((k==='pitch'&&sc<0.8&&fw>0.5)||(k==='stadium'&&sc<0.8)) continue;
      ok=cx>ox+0.2&&cy>oy+0.2&&cx<ox+ON/BLD_OC-0.2&&cy<oy+ON/BLD_OC-0.2&&okGround(cx,cy)>=0.05&&!bldOnRoadR(rm,cx,cy,fw*sc/2+0.012,fd*sc/2+0.012,ca,sa)&&dry(cx,cy,fw*sc/2,fd*sc/2,ca,sa)&&claim(cx,cy,fw*sc/2,fd*sc/2,ca,sa,0.02); }
    if(!ok) continue; fw*=sc; fd*=sc;
    const f={k,x:cx-fw/2,y:cy-fd/2,w:fw,d:fd,a:ang,r:h>>>0}; if(inTile(cx,cy)) feats.push(f);
    // the buildings that belong to it: lx, lz are measured from the plot's centre along and across the plot
    const sub=(lx,lz,w,dd,hm,sp)=>{ const bx=cx+lx*ca-lz*sa, by=cy+lx*sa+lz*ca; if(inTile(cx,cy)) out.push({x:bx-w/2,y:by-dd/2,w,d:dd,h:hm/150,c:(h>>>20)&3,a:ang,sp}); };
    if(k==='school'){ sub(0,-fd*0.32,fw*0.9,fd*0.26,11+q*4,'school'); sub(-fw*0.36,fd*0.06,fw*0.18,fd*0.44,8,'school'); }
    else if(k==='church') sub(0,-fd*0.08,fw*0.5,fd*0.72,11+q*3,'church');
    else if(k==='mall') sub(0,-fd*0.2,fw*0.94,fd*0.56,13+q*5,'mall');
    else if(k==='library'){ f.hm=12; sub(0,-fd*0.1,fw*0.72,fd*0.58,12,'library'); } else if(k==='gym'){ f.hm=13; sub(0,-fd*0.04,fw*0.86,fd*0.78,13,'gym'); }
    else if(k==='gov'){ f.hm=16+q*6; sub(0,-fd*0.16,fw*0.8,fd*0.42,f.hm,'gov'); }
    else if(k==='hospital'){ f.hm=22+q*10; sub(0,-fd*0.22,fw*0.9,fd*0.28,f.hm,'hospital'); sub(-fw*0.32,fd*0.1,fw*0.2,fd*0.38,14,'hospital'); sub(fw*0.32,fd*0.1,fw*0.2,fd*0.38,14,'hospital'); } }
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
          if(bldOnRoadR(rm,cx,cy,bw/2,dp/2,tx_,ty_)||!dry(cx,cy,bw/2,dp/2,tx_,ty_)||!claim(cx,cy,bw/2,dp/2,tx_,ty_,0.014)) continue;
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
        w=f*(0.8+rnd()*0.3); dd=f*(0.75+rnd()*0.3); bx=x-0.5+sx+(sz-w)*(k===2?0.5:rnd()); by=y-0.5+sy+(sz-dd)*(k===2?0.5:rnd()); ok=!bldOnRoad(rm,bx,by,w,dd)&&dry(bx+w/2,by+dd/2,w/2,dd/2,1,0)&&claim(bx+w/2,by+dd/2,w/2,dd/2,1,0,0.016); }
      if(!ok) continue;
      let hm=(6+30*Math.pow(Math.min(d,1.5),1.5))*(0.6+rnd()*0.7);         // metres
      if(d>1&&rnd()<0.06) hm=Math.min(240,hm*(1.8+rnd()*1.4));               // the odd tower downtown
      out.push({x:bx,y:by,w,d:dd,h:hm/150,c:(h>>>20)&3,a:0}); } }
  t={list:out,feat:feats,ver:bldVer,rs:null,rsOld:stale?(stale.rs&&stale.rs.some(Boolean)?stale.rs:stale.rsOld):null}; bldCache.delete(key); bldCache.set(key,t); if(bldCache.size>900) bldCache.delete(bldCache.keys().next().value); return t;
}
function bldInRect(x0,y0,x1,y1,cb){
  const tx0=Math.floor((x0-1)/BLD_T), ty0=Math.floor((y0-1)/BLD_T), tx1=Math.floor((x1+1)/BLD_T), ty1=Math.floor((y1+1)/BLD_T);
  for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){ if(tx<0||ty<0||tx*BLD_T>=W||ty*BLD_T>=H) continue; for(const b of bldTile(tx,ty).list) if(b.x+b.w+0.2>=x0&&b.x-0.2<=x1&&b.y+b.d+0.2>=y0&&b.y-0.2<=y1) cb(b); }
}
function bldFeatInRect(x0,y0,x1,y1,cb){ for(let ty=Math.floor((y0-1)/BLD_T);ty<=Math.floor((y1+1)/BLD_T);ty++) for(let tx=Math.floor((x0-1)/BLD_T);tx<=Math.floor((x1+1)/BLD_T);tx++){ if(tx<0||ty<0||tx*BLD_T>=W||ty*BLD_T>=H) continue; for(const f of bldTile(tx,ty).feat) if(f.x+f.w+0.3>=x0&&f.x-0.3<=x1&&f.y+f.d+0.3>=y0&&f.y-0.3<=y1) cb(f); } }
// a point of a plot given along (u) and across (v) it, each from -1 to 1
function featPt(f,u,v){ const ca=Math.cos(f.a), sa=Math.sin(f.a), lx=u*f.w/2, lz=v*f.d/2; return [f.x+f.w/2+lx*ca-lz*sa,f.y+f.d/2+lx*sa+lz*ca]; }
// The trees of a park or a churchyard, as [along, across, size, number] with along/across from -1 to 1. A park is laid
// out, not sown: a row inside each edge, an avenue either side of the two paths, and a clump in one or two of the lawns.
function featTrees(f){ const o=[], put=(u,v,s,k)=>o.push([u,v,s,hashInt(f.r+k*7919)]);
  if(f.k==='church'){ let k=0; for(const u of [-0.85,0.85]) for(let v=-0.8;v<=0.85;v+=0.4) put(u,v,0.85,k++); put(-0.4,0.86,0.8,k++); put(0.4,0.86,0.8,k++); return o; }
  const nu=Math.max(3,Math.round(f.w/0.085)), nv=Math.max(3,Math.round(f.d/0.085)); let k=0;
  for(let i=0;i<=nu;i++){ const u=-0.9+1.8*i/nu; if(Math.abs(u)<0.14) continue; put(u,-0.9,0.9,k++); put(u,0.9,0.9,k++); }
  for(let i=1;i<nv;i++){ const v=-0.9+1.8*i/nv; if(Math.abs(v)<0.14) continue; put(-0.9,v,0.9,k++); put(0.9,v,0.9,k++); }
  if(f.w>0.55) for(let i=1;i<nu;i++){ const u=-0.9+1.8*i/nu; if(Math.abs(u)<0.2||Math.abs(u)>0.8) continue; put(u,-0.13,0.7,k++); put(u,0.13,0.7,k++); }
  const q=f.r>>>3, cl=[[-0.5,-0.5],[0.5,-0.5],[-0.5,0.5],[0.5,0.5]]; for(const c of [cl[q&3],cl[(q>>2)&3]]){ if(f.w>0.7&&c[0]>0&&c[1]>0) continue; for(let j=0;j<5;j++){ const h=hashInt(f.r+j*131+c[0]*17+c[1]*29); put(c[0]+((h&255)/255-0.5)*0.34,c[1]+(((h>>8)&255)/255-0.5)*0.34,0.9+((h>>16)&63)/90,k++); } }
  return o; }
// the four corners of a building's footprint, turned about its centre
function bldCorners(b,dx,dy){ const cx=b.x+b.w/2+(dx||0), cy=b.y+b.d/2+(dy||0), hw=b.w/2, hd=b.d/2; if(!b.a) return [cx-hw,cy-hd,cx+hw,cy-hd,cx+hw,cy+hd,cx-hw,cy+hd];
  const ca=Math.cos(b.a), sa=Math.sin(b.a), ux=hw*ca, uy=hw*sa, vx=-hd*sa, vy=hd*ca; return [cx-ux-vx,cy-uy-vy,cx+ux-vx,cy+uy-vy,cx+ux+vx,cy+uy+vy,cx-ux+vx,cy-uy+vy]; }
// On the map buildings are seen from straight above, like a city plan: each one casts a shadow to the south-east, as
// long as the building is tall and joined to its foot, so the skyline reads. Each tile keeps its outlines as ready-made
// paths (grounds, shadows, rims, one per roof colour, trees), so painting a tile is a handful of fills.
const BLD_Z=1.0;                         // shadow length per unit of height
const FEAT_COL={light:{park:'#cfe6c4',play:'#f0dcb6',plaza:'#e7e2d6',pitch:'#a5d093',lot:'#cdd0d8',yard:'#eadcc4',water:'#bcd9ee',line:'rgba(255,255,255,.9)',path:'#efe9d6'},
                dark:{park:'#21382a',play:'#4a4030',plaza:'#3a3d45',pitch:'#2d5233',lot:'#2c313b',yard:'#3d3a32',water:'#12324c',line:'rgba(255,255,255,.45)',path:'#4a4a40'}};
function bldPaths(t,tx,ty){ if(t.p) return t.p;
  // a very long path gets slower to add to with every piece, so each layer is kept as several shorter paths
  const bag=n=>{ const a=[new Path2D()]; let c=0; return {a,next(){ if(++c>n){ c=1; a.push(new Path2D()); } return a[a.length-1]; }}; };
  const shB=bag(40), rimB=bag(150), rfB=[0,1,2,3,4,5].map(()=>bag(150)), trB=bag(200), tsB=bag(200);
  const poly=(p,q)=>{ p.moveTo(q[0],q[1]); p.lineTo(q[2],q[3]); p.lineTo(q[4],q[5]); p.lineTo(q[6],q[7]); p.closePath(); };
  // a shadow is the footprint swept along the sun's direction: its far copy plus the strips swept by the edges, all wound the same way
  const quad=(p,ax,ay,bx,by,cx,cy,dx,dy)=>{ if((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)<0){ p.moveTo(ax,ay); p.lineTo(dx,dy); p.lineTo(cx,cy); p.lineTo(bx,by); } else { p.moveTo(ax,ay); p.lineTo(bx,by); p.lineTo(cx,cy); p.lineTo(dx,dy); } p.closePath(); };
  for(const b of t.list){ const z=Math.min(1.3,b.h*BLD_Z), sx=z*0.36, sy=z*0.28, q=bldCorners(b), sh=shB.next();
    // the footprint swept along the sun's direction is a six-cornered shape: each edge at its near or its far position
    { let px=NaN, py=NaN, first=true; const pt=(x,y)=>{ if(x===px&&y===py) return; if(first){ sh.moveTo(x,y); first=false; } else sh.lineTo(x,y); px=x; py=y; };
      for(let k=0;k<4;k++){ const a=k*2, c=((k+1)%4)*2, far=(q[c]-q[a])*sy-(q[c+1]-q[a+1])*sx>0, ox=far?sx:0, oy=far?sy:0; pt(q[a]+ox,q[a+1]+oy); pt(q[c]+ox,q[c+1]+oy); } sh.closePath(); }
    poly(rimB.next(),q); poly(rfB[b.h*150<14?2+(b.c&3):(b.c&1)].next(),q); }
  const tz=0.06, tree=(px,py,r)=>{ if(G.rn){ const h=rnNearEdge(G.rn,px,py,0.22); if(h&&h.d<ROAD_W[G.rn.ec[h.e]]/2+r*0.7) return; }      /* not in the roadway */
    const ts=tsB.next(), tr=trB.next(); ts.moveTo(px+r+0.04,py+0.03); ts.arc(px+0.04,py+0.03,r,0,6.283); tr.moveTo(px+r,py-tz*0.4); tr.arc(px,py-tz*0.4,r,0,6.283); };
  for(let y=ty*BLD_T;y<(ty+1)*BLD_T;y++) for(let x=tx*BLD_T;x<(tx+1)*BLD_T;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]||(G.air&&G.air[i])) continue; const pk=G.pk[i], n=pk>0.27?6:pk>0.255?3:(pk>0.12&&G.D[i]<0.05)?4:0;
    for(let k=0;k<n;k++){ const h=hashInt(i*59+k*7919), px=x-0.5+(h&1023)/1023, py=y-0.5+((h>>10)&1023)/1023; if(!wetAt(px,py,0.05)) tree(px,py,0.07+((h>>20)&63)/63*0.05); } }
  // grounds: one path per kind, plus white markings, footpaths and ponds
  const g={park:new Path2D(),play:new Path2D(),plaza:new Path2D(),pitch:new Path2D(),lot:new Path2D(),yard:new Path2D(),water:new Path2D(),line:new Path2D(),path:new Path2D(),dotA:new Path2D(),dotB:new Path2D()};
  for(const f of t.feat){ const q=bldCorners(f), P=(u,v)=>featPt(f,u,v), ln=(p,a,b)=>{ p.moveTo(a[0],a[1]); p.lineTo(b[0],b[1]); }, kind={school:'yard',church:'park',mall:'lot',library:'plaza',gov:'plaza',hospital:'plaza',gym:'yard',stadium:'yard'}[f.k]||f.k; poly(g[kind],q);
    if(f.k==='park'||f.k==='church'){ for(const [u,v,sz] of featTrees(f)){ const c=P(u,v); tree(c[0],c[1],0.036*sz); }
      if(f.k==='park'){ ln(g.path,P(-1,0),P(1,0)); ln(g.path,P(0,-1),P(0,1)); if(f.w>0.7){ const c=P(0.45,0.45); g.water.moveTo(c[0]+f.w*0.14,c[1]); g.water.ellipse(c[0],c[1],f.w*0.14,f.d*0.12,f.a,0,6.283); } } }
    else if(f.k==='stadium'){ const m=0.5; poly(g.pitch,[...P(-m,-m),...P(m,-m),...P(m,m),...P(-m,m)]); ln(g.line,P(-m,-m),P(m,-m)); ln(g.line,P(m,-m),P(m,m)); ln(g.line,P(m,m),P(-m,m)); ln(g.line,P(-m,m),P(-m,-m)); ln(g.line,P(0,-m),P(0,m)); for(const e of [0.66,0.82,0.96]){ ln(g.path,P(-e,-e),P(e,-e)); ln(g.path,P(e,-e),P(e,e)); ln(g.path,P(e,e),P(-e,e)); ln(g.path,P(-e,e),P(-e,-e)); } }
    else if(f.k==='pitch'){ const m=0.9; ln(g.line,P(-m,-m),P(m,-m)); ln(g.line,P(m,-m),P(m,m)); ln(g.line,P(m,m),P(-m,m)); ln(g.line,P(-m,m),P(-m,-m)); ln(g.line,P(0,-m),P(0,m)); const c=P(0,0); g.line.moveTo(c[0]+f.d*0.16,c[1]); g.line.arc(c[0],c[1],f.d*0.16,0,6.283); }
    else if(f.k==='lot'||f.k==='mall'){ const v0=f.k==='mall'?0.35:-0.8, n=Math.max(3,Math.round(f.w/0.035)); for(let k=0;k<=n;k++){ const u=-0.9+1.8*k/n; ln(g.line,P(u,v0),P(u,v0+0.3)); ln(g.line,P(u,0.9),P(u,0.6)); } }
    else if(f.k==='plaza'){ const c=P(0,0), r=Math.min(f.w,f.d)*0.2; g.water.moveTo(c[0]+r,c[1]); g.water.arc(c[0],c[1],r,0,6.283); g.dotB.moveTo(c[0]+r*0.3,c[1]); g.dotB.arc(c[0],c[1],r*0.3,0,6.283); for(const [u,v] of [[-0.7,-0.7],[0.7,-0.7],[0.7,0.7],[-0.7,0.7]]){ const e=P(u,v); tree(e[0],e[1],0.035); } }
    else if(f.k==='play'){ const a=P(-0.4,-0.2), b=P(0.4,0.3); g.dotA.moveTo(a[0]+0.03,a[1]); g.dotA.arc(a[0],a[1],0.03,0,6.283); g.dotB.moveTo(b[0]+0.025,b[1]); g.dotB.arc(b[0],b[1],0.025,0,6.283); const e=P(0.6,-0.6); tree(e[0],e[1],0.04); }
    else if(f.k==='school'){ const m=0.5; ln(g.line,P(-0.1,0),P(0.9,0)); ln(g.line,P(0.9,0),P(0.9,0.85)); ln(g.line,P(0.9,0.85),P(-0.1,0.85)); ln(g.line,P(-0.1,0.85),P(-0.1,0)); ln(g.line,P(0.4,0),P(0.4,0.85)); } }
  return t.p={sh:shB.a,rim:rimB.a,rf:rfB.map(o=>o.a),tr:trB.a,ts:tsB.a,g}; }
// painting one tile: what lies on the ground first (grounds and shadows), then what stands on it
function bldPaintGround(p,px){ const F=isDark()?FEAT_COL.dark:FEAT_COL.light, g=p.g;
  for(const k of ['park','play','plaza','pitch','lot','yard']){ ctx.fillStyle=F[k]; ctx.fill(g[k]); }
  ctx.strokeStyle=F.path; ctx.lineWidth=0.03; ctx.stroke(g.path); ctx.fillStyle=F.water; ctx.fill(g.water); ctx.strokeStyle=F.line; ctx.lineWidth=Math.max(0.008,0.7*px); ctx.stroke(g.line);
  ctx.fillStyle='#e2574c'; ctx.fill(g.dotA); ctx.fillStyle='#3f7fbf'; ctx.fill(g.dotB);
  ctx.fillStyle=C['bld-shadow']; for(const q of p.sh) ctx.fill(q); ctx.fillStyle='rgba(30,60,30,.18)'; for(const q of p.ts) ctx.fill(q); }
const BLD_RC=()=>[C['bld-roof'],C['bld-roof2'],'#c47a62','#9c7266','#7d8794','#b39478'];
function bldPaintRoofs(p,px){ const RC=BLD_RC(), e=Math.max(0.6*px,0.012);
  ctx.fillStyle=C['bld-side']; ctx.translate(e,e); for(const q of p.rim) ctx.fill(q); ctx.translate(-e,-e);
  for(let k=0;k<6;k++){ ctx.fillStyle=RC[k]; for(const q of p.rf[k]) ctx.fill(q); }
  ctx.fillStyle=isDark()?'#2f5a34':'#79a95e'; for(const q of p.tr) ctx.fill(q); }
function bldTilesIn(x0,y0,x1,y1){ const o=[]; for(let ty=Math.max(0,Math.floor((y0-1)/BLD_T));ty<=Math.floor((y1+1)/BLD_T)&&ty*BLD_T<H;ty++) for(let tx=Math.max(0,Math.floor((x0-1)/BLD_T));tx<=Math.floor((x1+1)/BLD_T)&&tx*BLD_T<W;tx++) o.push([tx,ty]); return o; }

/* Buildings on the map are pictures, not drawings. A tile's thousand outlines are painted once into a small bitmap
   (at the sharpness of the current zoom, a few tiles a frame) and from then on a frame only pastes bitmaps: dragging,
   zooming and the monthly changes to the streets never redraw a building that has not changed. While a sharper or
   newer picture of a tile is still to come, whatever picture of it exists is shown. */
const BLD_LV=[6,12,24,48], BLD_RMAX=110e6; let bldRBytes=0, bldRQ=[], bldTheme='';
function bldRaster(t,tx,ty,li){ const R=BLD_LV[li], c=document.createElement('canvas'); c.width=c.height=BLD_T*R; const g=c.getContext('2d',{willReadFrequently:true}), m=ctx; ctx=g;
  try{ g.setTransform(R,0,0,R,-(tx*BLD_T-0.5)*R,-(ty*BLD_T-0.5)*R); g.lineCap='round'; g.lineJoin='round';
    // shadows fall to the south-east: those of the tiles to the west and north reach into this one
    g.fillStyle=C['bld-shadow']; for(const [dx,dy] of [[-1,0],[0,-1],[-1,-1]]){ if(tx+dx<0||ty+dy<0) continue; const n=bldCache.get((tx+dx)*1000+ty+dy); if(n&&n.p) for(const q of n.p.sh) g.fill(q); }
    const p=bldPaths(t,tx,ty); bldPaintGround(p,1/R); bldPaintRoofs(p,1/R); } finally { ctx=m; }
  if(!t.rs) t.rs=[null,null,null,null]; t.rs[li]=c; const bytes=c.width*c.height*4; bldRBytes+=bytes; bldRQ.push({t,li,bytes});
  while(bldRBytes>BLD_RMAX&&bldRQ.length>1){ const o=bldRQ.shift(); bldRBytes-=o.bytes; if(o.t.rs&&o.t.rs[o.li]){ o.t.rs[o.li].width=0; o.t.rs[o.li]=null; } }
  return c; }
function drawBuildingTiles(budget){
  const a=smooth(cam.s,9,14); if(a<=0.01) return; const th=isDark()?'d':'l'; if(th!==bldTheme){ bldTheme=th; for(const t of bldCache.values()){ t.rsOld=null; t.rs=null; } bldRQ=[]; bldRBytes=0; }
  const want=cam.s*dpr/1.35; let li=BLD_LV.length-1; for(let k=0;k<BLD_LV.length;k++) if(BLD_LV[k]>=want){ li=k; break; }
  const [x0,y0]=toWorld(0,0), [x1,y1]=toWorld(vw,vh), todo=[]; worldT(); ctx.globalAlpha=a; ctx.imageSmoothingEnabled=true;
  for(let ty=Math.max(0,Math.floor((y0+0.5)/BLD_T));ty<=Math.floor((y1+0.5)/BLD_T)&&ty*BLD_T<H;ty++) for(let tx=Math.max(0,Math.floor((x0+0.5)/BLD_T));tx<=Math.floor((x1+0.5)/BLD_T)&&tx*BLD_T<W;tx++){
    const t=bldCache.get(tx*1000+ty), fresh=t&&t.ver===bldVer; let c=null;
    if(t){ const pick=rs=>{ if(!rs) return null; if(rs[li]) return rs[li]; for(let k=li+1;k<rs.length;k++) if(rs[k]) return rs[k]; for(let k=li-1;k>=0;k--) if(rs[k]) return rs[k]; return null; }; c=pick(t.rs)||pick(t.rsOld); }
    if(c) ctx.drawImage(c,tx*BLD_T-0.5,ty*BLD_T-0.5,BLD_T,BLD_T);
    if(!fresh||!t.rs||!t.rs[li]) todo.push([tx,ty,(tx*BLD_T+BLD_T/2-cam.x)**2+(ty*BLD_T+BLD_T/2-cam.y)**2+(c?1e6:0)]); }
  ctx.globalAlpha=1;
  // work out and paint the missing ones, nearest the middle of the view first, those with no picture at all before those with an old one
  if(todo.length){ todo.sort((p,q)=>p[2]-q[2]); const t0=performance.now(); drawBuildingTiles.n=(drawBuildingTiles.n||0)+1;
    for(const [tx,ty,pr] of todo){ if(pr>=1e6&&drawBuildingTiles.n%4) break;      /* tiles that only need refreshing: one every fourth frame */
      const t=bldTile(tx,ty); bldRaster(t,tx,ty,li); if(pr>=1e6||performance.now()-t0>budget) break; } } }
