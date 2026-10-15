/* ================= build assistant: corridor → route → stops → quick estimate ================= */
// route on a half-resolution grid: dense, unserved land is cheap, water is expensive
const AHQ={k:new Float64Array(4096),v:new Int32Array(4096),n:0};   // private heap: a paused route search must not share the global one
function* assistRoute(a,b,cov,lm){
  const Q=dist(a[0],a[1],b[0],b[1])>45?3:2, gw=Math.ceil(W/Q), gh=Math.ceil(H/Q), n=gw*gh, B=G.bounds;   // coarser grid for long routes
  const ix=(x,y)=>clamp(Math.round(y/Q),0,gh-1)*gw+clamp(Math.round(x/Q),0,gw-1), s0=ix(a[0],a[1]), t0=ix(b[0],b[1]); if(s0===t0) return null;
  if(!assistRoute.buf||assistRoute.buf.q!==Q) assistRoute.buf={q:Q,g:new Float64Array(n),p:new Int32Array(n),st:new Int32Array(n),run:0}; const AR=assistRoute.buf, run=++AR.run;
  const tx=t0%gw, ty=(t0/gw)|0, x0=Math.max(Math.floor(B[0]/Q),Math.min(s0%gw,tx)-25), x1=Math.min(Math.ceil(B[2]/Q)-1,Math.max(s0%gw,tx)+25), y0=Math.max(Math.floor(B[1]/Q),Math.min((s0/gw)|0,ty)-25), y1=Math.min(Math.ceil(B[3]/Q)-1,Math.max((s0/gw)|0,ty)+25);
  AR.g[s0]=0; AR.p[s0]=-1; AR.st[s0]=run; AHQ.n=0; hqPush(0,s0,AHQ); let found=false, pops=0;
  while(AHQ.n&&pops<26000){ const u=hqPop(AHQ); pops++; if(pops%2500===0) yield; if(u===t0){ found=true; break; } const ux=u%gw, uy=(u/gw)|0, gu=AR.g[u];
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const vx=ux+dx, vy=uy+dy; if(vx<x0||vy<y0||vx>x1||vy>y1) continue; const v=vy*gw+vx, ci=Math.min(H-1,vy*Q)*W+Math.min(W-1,vx*Q);
      const nearEnd=Math.abs(vx-s0%gw)+Math.abs(vy-((s0/gw)|0))<6/Q*2||Math.abs(vx-tx)+Math.abs(vy-ty)<6/Q*2;
      const c=(G.water[ci]?3.5:1)*(1-0.55*Math.min(1,G.D[ci])*(cov[ci]?0.3:1))*(lm&&lm[ci]&&!nearEnd&&Math.abs(Math.cos(Math.atan2(dy,dx)-lm.ang[ci]))>0.8?4:1)*(dx&&dy?1.414:1), ng=gu+c;
      if(AR.st[v]!==run||ng<AR.g[v]){ AR.g[v]=ng; AR.p[v]=u; AR.st[v]=run; hqPush(ng+Math.hypot(vx-tx,vy-ty)*0.75,v,AHQ); } } }
  if(!found) return null; const pts=[]; for(let u=t0;u!==-1;u=(AR.st[u]===run?AR.p[u]:-1)){ pts.push([(u%gw)*Q,((u/gw)|0)*Q]); if(u===s0) break; } return pts.reverse();
}
// stops roughly every kilometre; an existing station nearby is reused (a free interchange)
// share of a route that runs alongside an existing line (ends excluded): parallel duplicates are what makes a network worse
function assistOverlap(path,lm){ let n=0,o=0; const L=path.length; for(let k=1;k<L;k++){ const [x,y]=path[k]; if(dist(x,y,path[0][0],path[0][1])<6||dist(x,y,path[L-1][0],path[L-1][1])<6) continue; n++; const i=Math.round(y)*W+Math.round(x); if(lm[i]&&Math.abs(Math.cos(Math.atan2(y-path[k-1][1],x-path[k-1][0])-lm.ang[i]))>0.8) o++; } return n?o/n:0; }   // share of a route running alongside an existing line (crossing it doesn't count)
// where the route crosses existing lines
function assistCrossings(path,ctx){
  const out=[];
  for(let k=1;k<path.length;k++){ const a=path[k-1], b=path[k], key=Math.floor((a[1]+b[1])/16)*1000+Math.floor((a[0]+b[0])/16);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const L=ctx.bk.get(key+dy*1000+dx); if(!L) continue;
      for(const sg of L){ const X=segX(a,b,sg.a,sg.b); if(X&&!out.some(o=>o.line===sg.line&&dist(o.x,o.y,X[0],X[1])<4)) out.push({k,x:X[0],y:X[1],line:sg.line}); } } }
  return out;
}
// stops along a route: existing stations near the route are visited first (free interchanges), a crossed line is
// joined at its own nearby station when it has one, and only then are new stops spaced about a kilometre apart
function assistStops(path,ctx,skip){
  skip=skip||new Set(); const n=path.length, must=[];
  const nearIdx=(x,y)=>{ let bk=0, bd=1e9; for(let k=0;k<n;k++){ const d=(path[k][0]-x)**2+(path[k][1]-y)**2; if(d<bd){ bd=d; bk=k; } } return [bk,Math.sqrt(bd)]; };
  for(const st of stations){ if(skip.has(st.id)) continue; const [k,d]=nearIdx(st.x,st.y); if(d<=4) must.push({k,id:st.id,d}); }
  for(const c of (ctx?assistCrossings(path,ctx):[])){ const L=lineById(c.line); if(!L||must.some(m=>Math.abs(m.k-c.k)<=3&&L.stops.includes(m.id))) continue;
    let best=null, bd=6; for(const id of L.stops){ if(skip.has(id)) continue; const o=stById(id); const d=o?dist(o.x,o.y,c.x,c.y):1e9; if(d<bd){ bd=d; best=id; } }
    if(best!=null){ const o=stById(best); must.push({k:nearIdx(o.x,o.y)[0],id:best,d:bd}); continue; }
    if(G.water[Math.round(c.y)*W+Math.round(c.x)]) continue;
    let nb=null, nd=1e9; for(const id of L.stops){ const o=stById(id); const d=o?dist(o.x,o.y,c.x,c.y):1e9; if(d<nd){ nd=d; nb=id; } }
    must.push({k:c.k,x:c.x,y:c.y,join:c.line,nb:nd<9?nb:null,nbT:nd*1.12/METRO_V+DWELL+1}); }
  must.sort((a,b)=>a.k-b.k||a.d-b.d);
  const nodes=[]; const pos=q=>q.id!=null?stById(q.id):q;
  const push=q=>{ if(q.id!=null&&nodes.some(o=>o.id===q.id)) return; const last=nodes[nodes.length-1];
    if(last){ const a=pos(last), b=pos(q); if(dist(a.x,a.y,b.x,b.y)<2.6){ if(last.id==null&&!last.join&&(q.id!=null||q.join)) nodes.pop(); else return; } } nodes.push(q); };
  const s0=stations.find(o=>!skip.has(o.id)&&dist(o.x,o.y,path[0][0],path[0][1])<1.8); push(s0?{id:s0.id}:{x:path[0][0],y:path[0][1]});
  let acc=0, mi=0;
  for(let k=1;k<n;k++){
    acc+=dist(path[k][0],path[k][1],path[k-1][0],path[k-1][1]);
    while(mi<must.length&&must[mi].k<=k){ const m=must[mi++]; push(m.id!=null?{id:m.id}:{x:m.x,y:m.y,join:m.join,nb:m.nb,nbT:m.nbT}); acc=0; }
    const last=k===n-1, [x,y]=path[k];
    if(last){ const e=stations.find(o=>!skip.has(o.id)&&dist(o.x,o.y,x,y)<1.8); if(e) push({id:e.id}); else if(!G.water[Math.round(y)*W+Math.round(x)]) push({x,y}); break; }
    if(acc>=6.5&&!G.water[Math.round(y)*W+Math.round(x)]&&inB(x,y,1)){ push({x,y}); acc=0; }
  }
  return assistSmooth(nodes);
}
// drop stops that make the line double back (a turn sharper than ~105°); new stops go first, existing stations only if unavoidable
function assistSmooth(nodes,lead){
  const pos=q=>q.id!=null?stById(q.id):q; let changed=true, guard=0;
  while(changed&&guard++<50){ changed=false; const all=[...(lead||[]),...nodes], off=(lead||[]).length;
    for(let k=Math.max(1,off);k<all.length-1;k++){ const a=pos(all[k-1]), b=pos(all[k]), c=pos(all[k+1]);
      const ux=b.x-a.x, uy=b.y-a.y, vx=c.x-b.x, vy=c.y-b.y, cs=(ux*vx+uy*vy)/((Math.hypot(ux,uy)||1)*(Math.hypot(vx,vy)||1));
      if(cs<-0.25){ const kk=k-off; if(kk<0||kk>=nodes.length) continue; let cand=nodes[kk].id==null?kk:(kk+1<nodes.length&&nodes[kk+1].id==null?kk+1:kk); if(lead&&cand===0){ if(nodes.length>1) cand=1; else continue; } if(cand===nodes.length-1&&nodes.length<=2) return nodes; nodes.splice(cand,1); changed=true; break; } } }
  return nodes;
}
function assistTurnsOk(pts){ for(let k=1;k<pts.length-1;k++){ const a=pts[k-1], b=pts[k], c=pts[k+1]; const ux=b.x-a.x, uy=b.y-a.y, vx=c.x-b.x, vy=c.y-b.y; if((ux*vx+uy*vy)/((Math.hypot(ux,uy)||1)*(Math.hypot(vx,vy)||1))<-0.25) return false; } return true; }
// candidate corridors for brand-new lines that do not come from a listed suggestion
function assistCorridors(){
  const out=[]; if(!sim) return out;
  (sim.flows||[]).filter(f=>f.metro==null||f.metro>f.car*0.8).sort((a,b)=>b.people*b.car-a.people*a.car).slice(0,8).forEach(f=>out.push({a:[f.x,f.y],b:[f.x2,f.y2]}));
  if(!stations.length){ const M=G.centers[0]; for(const c of G.centers.slice(1)) if(inB(c.x,c.y,6)) out.push({a:[M.x,M.y],b:[c.x,c.y]}); }
  return out.filter((c,i)=>dist(c.a[0],c.a[1],c.b[0],c.b[1])>10&&!out.slice(0,i).some(o=>dist(o.a[0],o.a[1],c.a[0],c.a[1])<8&&dist(o.b[0],o.b[1],c.b[0],c.b[1])<8));
}
/* The assistant works through the improvement suggestions first — each one is turned into concrete options
   (extend a line, add a stop, branch from a station, express trains, an interchange) — then adds a few ideas of its own.
   Every option is scored with the same quick estimate and ranked by how much commuting time it saves. */
function assistJob(sugg){
  sugg=sugg||[];
  const base=estBase(), cov=coverageMask(5.4), res=[], tasks=[], P=n=>n.id!=null?stById(n.id):n, xy=n=>{ const p=P(n); return [p.x,p.y]; };
  // corridors that already have a line (≈450 m either side) and every line segment bucketed (8-cell buckets, keyed by the midpoint) for crossing tests
  const lm=new Uint8Array(W*H), la=new Float32Array(W*H), ctx={bk:new Map()}; lm.ang=la;
  for(const L of lines){ if(L.stops.length<2) continue; ensurePaths(L);
    for(const p of L.paths) for(let q=1;q<p.length;q++){ const a=p[q-1], b=p[q], m=Math.max(1,Math.ceil(dist(a[0],a[1],b[0],b[1]))), ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(let t=0;t<=m;t++){ const x=Math.round(lerp(a[0],b[0],t/m)), y=Math.round(lerp(a[1],b[1],t/m)); for(let dy=-6;dy<=6;dy++) for(let dx=-6;dx<=6;dx++){ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=W||yy>=H) continue; const i2=yy*W+xx, r2=G.D[i2]>0.9?10:37; if(dx*dx+dy*dy<=r2){ lm[i2]=1; la[i2]=ang; } } }   // ~450 m in the dense core, ~900 m elsewhere
      const key=Math.floor((a[1]+b[1])/16)*1000+Math.floor((a[0]+b[0])/16); const bkt=ctx.bk.get(key); const sg={a,b,line:L.id}; if(bkt) bkt.push(sg); else ctx.bk.set(key,[sg]); } }
  const pushRes=(r,e)=>{ if(!e||!(e.dAvg<(r.type==='xfer'?-0.002:-0.03))) return;   /* every crossing should be an interchange: even a small gain is worth it */ const pts=r.nodes.map(P), newSt=r.nodes.filter(n=>n.id==null).length; r.dAvg=e.dAvg; r.dRiders=e.dRiders;
    r.cost=r.type==='ring'?r.nodes.filter(n=>n.id==null).length*ST_COST+plen([...pts,pts[0]].map(p=>[p.x,p.y]))*TRACK_COST:r.type==='xfer'||r.type==='ins'?ST_COST:r.type==='exp'?lineLength(lineById(r.line))*TRACK_COST*0.12:newSt*ST_COST+plen(pts.map(p=>[p.x,p.y]))*TRACK_COST; res.push(r); };
  const retraces=nodes=>{ for(let q=1;q<nodes.length;q++){ const a=nodes[q-1].id, b=nodes[q].id; if(a!=null&&b!=null&&lines.some(L=>{ const i=L.stops.indexOf(a); return i>=0&&(L.stops[i+1]===b||L.stops[i-1]===b); })) return true; } return false; };
  const tooLong=(L,nodes)=>lineLength(L)+plen(nodes.map(xy))>270||L.stops.length+nodes.length>42;
  // option builders
  // ---- planner-based builders: lines between real destinations, validated like a planner would ----
  const lineCount=new Map(); for(const L of lines) for(const id of new Set(L.stops)) lineCount.set(id,(lineCount.get(id)||0)+1);
  const M0=G.centers[0]; let cst=null; { let cd=1e9; for(const s of stations){ if(!lineCount.get(s.id)) continue; const d=dist(s.x,s.y,M0.x,M0.y); if(d<cd){ cd=d; cst=s; } } }
  const hubs=stations.filter(s=>(lineCount.get(s.id)||0)>=2||s===cst);
  const extraT=[]; for(const o of sugg){ if(o.type==='gap'||o.type==='proj') extraT.push({x:o.x,y:o.y,w:6e4}); else if(o.type==='slow'||o.type==='corr'){ extraT.push({x:o.x,y:o.y,w:5e4}); extraT.push({x:o.x2,y:o.y2,w:5e4}); } }
  const anchors=planAnchors(extraT);
  const snapWp=(x,y)=>{ let b=null, bd=4; for(const s of stations){ const d=dist(s.x,s.y,x,y); if(d<bd){ bd=d; b=s; } } if(b) return {id:b.id};
    let a=null, ad=6; for(const o of anchors){ const d=dist(o.x,o.y,x,y); if(d<ad){ ad=d; a=o; } } if(a) return planWp(a);
    if(!inB(x,y,1)||G.water[Math.round(y)*W+Math.round(x)]) return null; return {x,y}; };
  const cleanWps=w=>{ const out=[]; for(const q of w){ if(!q) return null; const p=P(q), l=out[out.length-1]; if(l){ const lp=P(l); if(dist(lp.x,lp.y,p.x,p.y)<3.4){ if(l.id==null&&q.id!=null) out[out.length-1]=q; continue; } } if(q.id!=null&&out.some(o=>o.id===q.id)) return null; out.push(q); } return out; };
  const corridor=(A,B,hub)=>{ const pa=P(A), pb=P(B); if(!pa||!pb) return null; const near=c=>dist(c.x,c.y,pa.x,pa.y)<6||dist(c.x,c.y,pb.x,pb.y)<6;
    const linesOf=q=>q.id!=null?lines.filter(L=>L.stops.length>=2&&L.stops.includes(q.id)).map(L=>L.id):[], touched=new Set([...linesOf(A),...linesOf(B)]);
    let via=planVia(anchors,pa,pb,near).map(planWp).filter(v=>{ const ls=linesOf(v); if(ls.some(l=>touched.has(l))) return false; ls.forEach(l=>touched.add(l)); return true; });   /* never visit a line twice */ if(hub&&!via.some(v=>v.id===hub.id)&&!(A.id===hub.id||B.id===hub.id)&&!linesOf({id:hub.id}).some(l=>touched.has(l))){ const dx=pb.x-pa.x, dy=pb.y-pa.y, l2=dx*dx+dy*dy||1, t=((hub.x-pa.x)*dx+(hub.y-pa.y)*dy)/l2;
      if(t>0.2&&t<0.8&&dist(pa.x+dx*t,pa.y+dy*t,hub.x,hub.y)<Math.sqrt(l2)*0.3){ via.push({id:hub.id}); via.sort((u,v)=>{ const p=P(u), q=P(v); return ((p.x-pa.x)*dx+(p.y-pa.y)*dy)-((q.x-pa.x)*dx+(q.y-pa.y)*dy); }); } }
    return cleanWps([A,...via,B]); };
  const seen=new Set(), once=k=>{ if(seen.has(k)) return false; seen.add(k); return true; }, wkey=w=>w.map(q=>q.id!=null?'s'+q.id:Math.round(q.x)+','+Math.round(q.y)).join('-');
  function* ext(L,atStart,wps,src){ yield; if(L.loop||L.stops.length<2||!wps) return; const ids=atStart?L.stops.slice().reverse():L.stops, e=stById(ids[ids.length-1]), pr=stById(ids[ids.length-2]); if(!e||!pr) return;
    const w=cleanWps([{id:e.id},...wps]); if(!w||w.length<2||!once('e'+L.id+atStart+wkey(w))) return;
    const own=new Set(L.stops); let nodes=planValidate(planChain(w),{ctx,own,skipLine:L.id,lead:[pr]});
    if(!nodes||nodes.length<2||nodes[0].id!==e.id||nodes.slice(1).some(n=>n.id!=null&&L.stops.includes(n.id))||tooLong(L,nodes)) return;
    const hx=e.x-pr.x, hy=e.y-pr.y, hl=Math.hypot(hx,hy)||1; let along=0;   // keeps heading outwards: no hairpin at the old terminus
    for(const q of nodes.slice(1)){ const p=P(q), a=((p.x-e.x)*hx+(p.y-e.y)*hy)/hl; if(a<along-1) return; along=Math.max(along,a); }
    pushRes({type:'ext',line:L.id,atStart,nodes,src},quickEstimate(base,[...ids.slice(0,-1).map(id=>({id})),...nodes])); }
  function* fresh(wps,src){ yield; if(!wps||wps.length<2||!once('n'+wkey(wps))) return; const nodes=planValidate(planChain(wps),{ctx});
    if(!nodes||nodes.length<3||plen(nodes.map(xy))>250||retraces(nodes)) return;
    pushRes({type:'new',nodes,src},quickEstimate(base,nodes));
    // starting or ending at a line's terminus: build it as that line's extension instead (no change of trains, no extra line)
    for(const flip of [false,true]){ const ns=flip?nodes.slice().reverse():nodes, first=ns[0]; if(first.id==null) continue;
      for(const L of lines){ if(L.loop||L.stops.length<2) continue; const atStart=L.stops[0]===first.id; if(!atStart&&L.stops[L.stops.length-1]!==first.id) continue;
        const ids=atStart?L.stops.slice().reverse():L.stops; if(ns.slice(1).some(n=>n.id!=null&&L.stops.includes(n.id))||tooLong(L,ns)||!assistTurnsOk([stById(ids[ids.length-2]),...ns.map(P)])) continue;
        const pr=stById(ids[ids.length-2]), e=stById(first.id); if(((P(ns[1]).x-e.x)*(e.x-pr.x)+(P(ns[1]).y-e.y)*(e.y-pr.y))<=0) continue;
        pushRes({type:'ext',line:L.id,atStart,nodes:ns,src},quickEstimate(base,[...ids.slice(0,-1).map(id=>({id})),...ns])); } } }
  function* ins(L,x,y,src){ ensurePaths(L); const nr=nearestOnLine(L,x,y); if(!isFinite(nr.d)||nr.d>7) return; const px=nr.px, py=nr.py;
    if(G.water[Math.round(py)*W+Math.round(px)]||L.stops.some(id=>{ const o=stById(id); return o&&dist(o.x,o.y,px,py)<3.5; })) return;
    const chain=[...L.stops.slice(0,nr.seg+1).map(id=>({id})),{x:px,y:py},...L.stops.slice(nr.seg+1).map(id=>({id}))]; pushRes({type:'ins',line:L.id,nodes:[{x:px,y:py}],src},quickEstimate(base,chain)); }
  function* exp(L,src){ const nx=(L.svc||0)+1; if(L.loop||nx>3||L.stops.length<SVC_MIN[nx]) return; const xs=expStops({stops:L.stops,loop:false,svc:nx}); if(xs.length<nx) return; const ids=xs[nx-1]; ensurePaths(L);
    const cumL=[0]; L.paths.forEach((p,k)=>cumL.push(cumL[k]+plen(p)/METRO_V)); const pos=ids.map(id=>L.stops.indexOf(id)), segT=[];
    for(let q=1;q<pos.length;q++) segT.push((cumL[pos[q]]-cumL[pos[q-1]])/SVC_SPEED[nx]+DWELL);
    pushRes({type:'exp',line:L.id,tier:nx,nodes:ids.map(id=>({id})),src},quickEstimate(base,ids.map(id=>({id})),{segT,wait:SVC_WAIT[nx]})); }
  function* xfer(o,src){ const A=lineById(o.a), B=lineById(o.b); if(!A||!B||G.water[Math.round(o.y)*W+Math.round(o.x)]) return;
    const na=nearestOnLine(A,o.x,o.y); if(!isFinite(na.d)) return; let nb=null, nd=1e9; for(const id of B.stops){ const q=stById(id); const d=q?dist(q.x,q.y,o.x,o.y):1e9; if(d<nd){ nd=d; nb=id; } }
    const chain=[...A.stops.slice(0,na.seg+1).map(id=>({id})),{x:o.x,y:o.y,nb,nbT:nd*1.12/METRO_V+DWELL},...A.stops.slice(na.seg+1).map(id=>({id}))];
    pushRes({type:'xfer',line:A.id,line2:B.id,nodes:[{x:o.x,y:o.y}],src},quickEstimate(base,chain)); }
  // a loop is estimated as its stop list written twice in a row: riding either way round is then a plain sub-chain
  function* close(L,src){ yield; if(L.loop||L.stops.length<6||lineLength(L)<50) return; const a=stById(L.stops[L.stops.length-1]), b=stById(L.stops[0]); if(!a||!b) return; const d=dist(a.x,a.y,b.x,b.y); if(d<6||d>45) return;
    const own=new Set(L.stops.filter(id=>id!==a.id&&id!==b.id)), w=corridor({id:a.id},{id:b.id}); if(!w||w.slice(1,-1).some(q=>q.id!=null&&L.stops.includes(q.id))) return;
    const nodes=planValidate(planChain(w),{ctx,own,skipLine:L.id,loop:true}); if(!nodes||nodes[0].id!==a.id||nodes[nodes.length-1].id!==b.id) return;
    const mid=nodes.slice(1,-1); if(mid.some(q=>q.id!=null&&L.stops.includes(q.id))) return;
    const seq=[...L.stops.map(id=>({id})),...mid]; if(!assistTurnsOk([...seq,seq[0],seq[1]].map(P))) return;
    pushRes({type:'loop',line:L.id,nodes,mid,src},quickEstimate(base,[...seq,...seq])); }
  // a ring through each radial line once, at a given distance from downtown, every crossing an interchange
  function* ring(r,src){ yield; const M=G.centers[0], picks=[];
    for(const L of lines){ if(L.stops.length<2||L.loop) continue; let best=null, bd=4.5; for(const id of L.stops){ const o=stById(id); if(!o) continue; const dd=Math.abs(dist(o.x,o.y,M.x,M.y)-r); if(dd<bd){ bd=dd; best=o; } } if(best&&!picks.includes(best)) picks.push(best); }
    if(picks.length<4) return; picks.sort((a,b)=>Math.atan2(a.y-M.y,a.x-M.x)-Math.atan2(b.y-M.y,b.x-M.x));
    let nodes=[]; for(let q=0;q<picks.length;q++){ const a=picks[q], b=picks[(q+1)%picks.length]; nodes.push({id:a.id});
      let a0=Math.atan2(a.y-M.y,a.x-M.x), a1=Math.atan2(b.y-M.y,b.x-M.x); if(a1<=a0) a1+=Math.PI*2; if(a1-a0>Math.PI*0.9) return;   // a big gap: not a ring
      const gap=(a1-a0)*r, nIn=Math.floor(gap/7.5);
      for(let t=1;t<=nIn;t++){ const an=a0+(a1-a0)*t/(nIn+1), x=M.x+Math.cos(an)*r, y=M.y+Math.sin(an)*r; if(inB(x,y,1)&&!G.water[Math.round(y)*W+Math.round(x)]) nodes.push({x,y}); } }
    if(lines.some(L=>L.loop&&L.stops.filter(id=>nodes.some(n=>n.id===id)).length>=3)) return;
    const closed=planValidate([...nodes,nodes[0]],{ctx,loop:true}); if(!closed||closed[closed.length-1].id!==nodes[0].id) return; nodes=closed.slice(0,-1);
    if(nodes.length<6||!assistTurnsOk([...nodes,nodes[0],nodes[1]].map(P))) return;
    pushRes({type:'ring',nodes,src},quickEstimate(base,[...nodes,...nodes])); }
  // every sensible way of reaching a place: a stop on a line passing nearby, a line end already heading that way
  // (cost and direction decide), a radial from an interchange hub, or a diametric line through downtown
  const reach=(tx,ty,src)=>{
    const T=snapWp(tx,ty); if(!T) return; const pt=P(T);
    for(const L of lines){ if(L.stops.length<2) continue; const nr=nearestOnLine(L,tx,ty); if(nr.d<=7) tasks.push(()=>ins(L,tx,ty,src)); }
    if(T.id!=null&&lineCount.get(T.id)) return;   // already a station on a line
    const beyond=from=>{ const hx=pt.x-from.x, hy=pt.y-from.y, hl=Math.hypot(hx,hy)||1; let b=null, bs=0;
      for(const a of anchors){ const d=dist(a.x,a.y,pt.x,pt.y); if(d<8||d>30) continue; const c=((a.x-pt.x)*hx+(a.y-pt.y)*hy)/(d*hl); if(c<0.7) continue; const s=a.w*c/d; if(s>bs){ bs=s; b=a; } } return b?planWp(b):null; };
    const ends=[]; for(const L of lines){ if(L.loop||L.stops.length<2||L.stops.length>=36||lineLength(L)>=240) continue;
      for(const atStart of [false,true]){ const ids=atStart?L.stops.slice().reverse():L.stops, e=stById(ids[ids.length-1]), pr=stById(ids[ids.length-2]); if(!e||!pr) continue;
        const d=dist(e.x,e.y,pt.x,pt.y); if(d<5||d>55) continue; const dx=e.x-pr.x, dy=e.y-pr.y, cosA=((pt.x-e.x)*dx+(pt.y-e.y)*dy)/(d*(Math.hypot(dx,dy)||1)); if(cosA<(d<15?0.15:0.55)) continue;   /* a short hop may bend a little, a long extension must keep the line heading */ ends.push({L,atStart,e,score:d*(1.6-cosA)}); } }
    ends.sort((a,b)=>a.score-b.score).slice(0,3).forEach(o=>{ const w=corridor({id:o.e.id},T); if(!w) return; tasks.push(()=>ext(o.L,o.atStart,w.slice(1),src)); const bn=beyond(o.e); if(bn) tasks.push(()=>ext(o.L,o.atStart,cleanWps([...w.slice(1),bn]),src)); });
    const hs=hubs.map(h=>({h,d:dist(h.x,h.y,pt.x,pt.y)})).filter(o=>o.d>=7&&o.d<=60).sort((a,b)=>a.d-b.d).slice(0,2);
    for(const {h} of hs){ const w=corridor({id:h.id},T); if(!w) continue; tasks.push(()=>fresh(w,src)); const bn=beyond(h); if(bn) tasks.push(()=>fresh(cleanWps([...w,bn]),src));
      // diametric: carry on through the hub to a destination on the far side
      let opp=null, os=0; for(const a of anchors){ const d=dist(a.x,a.y,h.x,h.y); if(d<12||d>60) continue; const c=((a.x-h.x)*(pt.x-h.x)+(a.y-h.y)*(pt.y-h.y))/(d*(dist(h.x,h.y,pt.x,pt.y)||1)); if(c>-0.57) continue; const s=a.w*(a.served?0.6:1)*(-c)/d; if(s>os){ os=s; opp=a; } }
      if(opp){ const w1=corridor(planWp(opp),{id:h.id}); if(w1) tasks.push(()=>fresh(cleanWps([...w1,...w.slice(1)]),src)); } }
    if(!hubs.length){ const w=corridor(snapWp(M0.x,M0.y)||{x:M0.x,y:M0.y},T); if(w) tasks.push(()=>fresh(w,src)); }
  };
  if(base){
    // 1) the improvement suggestions, in the order they are listed
    sugg.forEach((o,si)=>{ const src=si+1;
      if(o.type==='exp'){ const L=lineById(o.line); if(L) tasks.push(()=>exp(L,src)); }
      else if(o.type==='xfer') tasks.push(()=>xfer(o,src));
      else if(o.type==='gap'||o.type==='proj') reach(o.x,o.y,src);
      else if(o.type==='slow'||o.type==='corr'){ const A=snapWp(o.x,o.y), B=snapWp(o.x2,o.y2);
        if(A&&B){ tasks.push(()=>fresh(corridor(A,B),src)); if(cst) tasks.push(()=>fresh(corridor(A,B,cst),src)); }
        reach(o.x2,o.y2,src); reach(o.x,o.y,src);
        for(const L of lines){ const near=(x,y)=>L.stops.some(id=>{ const q=stById(id); return q&&dist(q.x,q.y,x,y)<9; }); if(near(o.x,o.y)&&near(o.x2,o.y2)) tasks.push(()=>exp(L,src)); } } });
    // 2) its own ideas: express trains, unserved destinations, diametric/tangential links between big destinations, loops and rings
    for(const L of lines) if(!sugg.some(o=>o.type==='exp'&&o.line===L.id)) tasks.push(()=>exp(L,0));
    for(const a of anchors.filter(a=>!a.served).slice(0,6)) reach(a.x,a.y,0);
    for(const c of assistCorridors()){ const A=snapWp(c.a[0],c.a[1]), B=snapWp(c.b[0],c.b[1]); if(A&&B) tasks.push(()=>fresh(corridor(A,B,cst),0)); }
    const big=anchors.slice(0,10), pairs=[];
    for(let i=0;i<big.length;i++) for(let j=i+1;j<big.length;j++){ const a=big[i], b=big[j], d=dist(a.x,a.y,b.x,b.y); if(d<25||d>90) continue;
      if(a.st!=null&&b.st!=null&&lines.some(L=>L.stops.includes(a.st)&&L.stops.includes(b.st))) continue; pairs.push({a,b,s:a.w*b.w/d}); }
    pairs.sort((p,q)=>q.s-p.s).slice(0,6).forEach(p=>tasks.push(()=>fresh(corridor(planWp(p.a),planWp(p.b),cst),0)));
    for(const L of lines) tasks.push(()=>close(L,0));
    if(lines.length>=4){ const ds=stations.filter(o=>lineCount.get(o.id)).map(o=>dist(o.x,o.y,M0.x,M0.y)).sort((a,b)=>a-b), mid=ds[Math.floor(ds.length*0.45)]||20; for(const r of [mid*0.6,mid*0.9,mid*1.2]) if(r>=10) tasks.push(()=>ring(r,0)); }
  }
  let k=0, cur=null;
  const job={top:null,base,step(){
    if(cur||k<tasks.length){ if(!cur) cur=tasks[k++](); if(cur.next().done) cur=null; return false; }
    // 1) for each listed suggestion, its best answer — value for money decides between ways of doing the same job
    const val=r=>-r.dAvg*(1+40/(40+r.cost))*(r.type==='new'||r.type==='ring'?1:1.15), bySrc=new Map();
    for(const r of res) if(r.src){ const o=bySrc.get(r.src); if(!o||val(r)>val(o)) bySrc.set(r.src,r); }
    // 2) answers to suggestions first, by time saved; then the assistant's own ideas, by time saved
    const ordered=[...[...bySrc.values()].sort((a,b)=>a.dAvg-b.dAvg),...res.filter(r=>!r.src).sort((a,b)=>a.dAvg-b.dAvg)]; const top=[];
    for(const r of ordered){ if(top.length>=3) break; const pr=r.nodes.map(P);
      if(top.some(o=>{ if(o.type==='exp'||r.type==='exp') return o.type===r.type&&o.line===r.line; if((o.type==='ins'||o.type==='xfer')&&(r.type==='ins'||r.type==='xfer')) return o.line===r.line&&dist(o.nodes[0].x,o.nodes[0].y,r.nodes[0].x,r.nodes[0].y)<6;
        const po=o.nodes.map(P); return pr.filter(p=>po.some(q=>dist(p.x,p.y,q.x,q.y)<5)).length>pr.length/3; })) continue; top.push(r); }
    job.top=top; job.all=res; job.bySrc=bySrc; return true; }};
  return job;
}
// places worth reaching that no suggestion lists: grown towns without a station, far ends of slow flows
function assistTargets(){
  const out=[];
  for(const f of ((sim&&sim.flows)||[]).slice(0,12)) if(f.metro==null||f.metro>f.car*0.8){ out.push({x:f.x2,y:f.y2,w:f.people}); out.push({x:f.x,y:f.y,w:f.people}); }
  for(const v of G.villages) if(inB(v.x,v.y,3)&&tierOf(v)>=1&&!servedNear(v.x,v.y,6)) out.push({x:v.x,y:v.y,w:popAround(v.x,v.y,8)});
  out.sort((a,b)=>b.w-a.w); return out.filter((t,i)=>!out.slice(0,i).some(o=>dist(o.x,o.y,t.x,t.y)<10));
}
