/* ================= planner: lay lines out the way transit planners do =================
   Lines run between real destinations (downtown, sub-centres, towns, airports, rail stations, big projects),
   stops are spaced evenly (~1.1 km) and placed on the densest spot nearby, a stop within ~600 m of an existing
   station simply becomes that station, every crossing with another line is a shared interchange, and a line
   may not double back, wander, cross another line at a glancing angle or run alongside it. */
function planAnchors(extra){
  const M=G.centers[0], out=[];
  const add=(x,y,w,kind)=>{ if(!inB(x,y,2)||G.water[Math.round(y)*W+Math.round(x)]) return; const o=out.find(o=>dist(o.x,o.y,x,y)<7);
    if(o){ if(w>o.w){ o.x=x; o.y=y; o.kind=kind; } o.w=Math.max(o.w,w)+Math.min(o.w,w)*0.3; return; } out.push({x,y,w,kind}); };
  add(M.x,M.y,popAround(M.x,M.y,8)*1.5+2e5,'main');
  for(const c of G.centers.slice(1)) add(c.x,c.y,popAround(c.x,c.y,8)+5e4,'center');
  for(const v of G.villages){ const tr=tierOf(v); if(tr>=1) add(v.x,v.y,popAround(v.x,v.y,7)*(tr>=2?1.2:0.8),'place'); }
  for(const p of (G.projects||[])) if(p.done) add(p.x,p.y,popAround(p.x,p.y,6)+3e4,'project');
  const F=G.fac; add(F.airport.term.x,F.airport.term.y,9e4,'air'); add(F.station.x,F.station.y,9e4,'rail');
  for(const f of (G.fac2||[])){ const pt=facPoint(f); add(pt.x,pt.y,7e4,f.t); }
  for(const e of (extra||[])) add(e.x,e.y,e.w||4e4,'target');
  for(const a of out){ let st=null, sd=5; for(const s of stations){ const d=dist(s.x,s.y,a.x,a.y); if(d<sd){ sd=d; st=s; } } a.st=st?st.id:null; a.served=!!st&&lines.some(L=>L.stops.length>=2&&L.stops.includes(st.id)); }
  return out.sort((a,b)=>b.w-a.w);
}
const planWp=a=>a.st!=null?{id:a.st}:{x:a.x,y:a.y};
// destinations lying along a corridor a→b (close to the straight line, not at its ends)
function planVia(anchors,a,b,skip){ const dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy||1, out=[];
  for(const c of anchors){ if(skip&&skip(c)) continue; const t=((c.x-a.x)*dx+(c.y-a.y)*dy)/l2; if(t<0.15||t>0.85) continue; if(dist(a.x+dx*t,a.y+dy*t,c.x,c.y)<Math.min(7,Math.sqrt(l2)*0.18)) out.push({c,t}); }
  return out.sort((p,q)=>p.t-q.t).map(o=>o.c); }
// evenly spaced stops along a smooth curve through the waypoints
function planChain(wps){
  const P=n=>n.id!=null?stById(n.id):n, pts=wps.map(P), n=pts.length, Pc=i=>{ const p=pts[clamp(i,0,n-1)]; return [p.x,p.y]; }, nodes=[wps[0]], used=new Set(wps.filter(w=>w.id!=null).map(w=>w.id));
  const touched=new Set(); for(const w of wps) if(w.id!=null) for(const L of lines) if(L.stops.includes(w.id)) touched.add(L.id);
  const fresh=s=>!lines.some(L=>touched.has(L.id)&&L.stops.includes(s.id));   // a station of a line the route already meets would make it touch that line twice
  for(let i=0;i<n-1;i++){
    const seg=catmullSeg(Pc(i-1),Pc(i),Pc(i+1),Pc(i+2),24), cum=[0]; for(let k=1;k<seg.length;k++) cum.push(cum[k-1]+dist(seg[k-1][0],seg[k-1][1],seg[k][0],seg[k][1]));
    const len=cum[cum.length-1], m=Math.max(1,Math.round(len/7.5));
    for(let j=1;j<m;j++){ const target=len*j/m; let k=1; while(k<cum.length-1&&cum[k]<target) k++; const [qx,qy]=seg[k];
      let ex=null, ed=4; for(const s of stations){ if(used.has(s.id)||!fresh(s)) continue; const d=dist(s.x,s.y,qx,qy); if(d<ed){ ed=d; ex=s; } }
      if(ex){ used.add(ex.id); for(const L of lines) if(L.stops.includes(ex.id)) touched.add(L.id); nodes.push({id:ex.id}); continue; }
      let bx=null, by=null, bv=-1; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){ const x=Math.round(qx)+dx, y=Math.round(qy)+dy; if(!inB(x,y,1)||G.water[y*W+x]||dx*dx+dy*dy>5) continue; const v=G.D[y*W+x]-0.02*(dx*dx+dy*dy); if(v>bv){ bv=v; bx=x; by=y; } }
      if(bx!=null) nodes.push({x:bx,y:by}); }
    nodes.push(wps[i+1]);
  }
  return nodes;
}
// crossings of segment a→b with other lines
function planCross(a,b,ctx,skipLine){
  const out=[], seen=new Set(), k0x=Math.floor(Math.min(a.x,b.x)/8)-1, k1x=Math.floor(Math.max(a.x,b.x)/8)+1, k0y=Math.floor(Math.min(a.y,b.y)/8)-1, k1y=Math.floor(Math.max(a.y,b.y)/8)+1;
  for(let ky=k0y;ky<=k1y;ky++) for(let kx=k0x;kx<=k1x;kx++){ const L=ctx.bk.get(ky*1000+kx); if(!L) continue;
    for(const sg of L){ if(sg.line===skipLine||seen.has(sg)) continue; seen.add(sg); const X=segX([a.x,a.y],[b.x,b.y],sg.a,sg.b); if(!X) continue;
      const ux=b.x-a.x, uy=b.y-a.y, vx=sg.b[0]-sg.a[0], vy=sg.b[1]-sg.a[1]; out.push({x:X[0],y:X[1],line:sg.line,cos:(ux*vx+uy*vy)/((Math.hypot(ux,uy)||1)*(Math.hypot(vx,vy)||1))}); } }
  return out;
}
// longest stretch (in cells) running alongside another line, plus how much of the route is over water
function planParallel(pts,ctx,skipLine,stopIds){
  let run=0, best=0, wet=0, n=0;
  for(let k=1;k<pts.length;k++){ const a=pts[k-1], b=pts[k], m=Math.max(1,Math.ceil(dist(a.x,a.y,b.x,b.y))), ux=(b.x-a.x)/m, uy=(b.y-a.y)/m, ul=Math.hypot(ux,uy)||1;
    for(let t=0;t<m;t++){ const x=a.x+ux*t, y=a.y+uy*t; n++; if(G.water[Math.round(y)*W+Math.round(x)]===1) wet++;
      if(stopIds&&stopIds.some(p=>dist(p.x,p.y,x,y)<3)){ run=0; continue; }
      let par=false; const kx=Math.floor(x/8), ky=Math.floor(y/8);
      for(let dy=-1;dy<=1&&!par;dy++) for(let dx=-1;dx<=1&&!par;dx++){ const L=ctx.bk.get((ky+dy)*1000+kx+dx); if(!L) continue;
        for(const sg of L){ if(sg.line===skipLine) continue; const vx=sg.b[0]-sg.a[0], vy=sg.b[1]-sg.a[1], vl=Math.hypot(vx,vy)||1;
          if(Math.abs((ux*vx+uy*vy)/(ul*vl))<0.85) continue; const tt=clamp(((x-sg.a[0])*vx+(y-sg.a[1])*vy)/(vl*vl),0,1); if(dist(x,y,sg.a[0]+vx*tt,sg.a[1]+vy*tt)<(G.D[Math.round(y)*W+Math.round(x)]>0.9?3.4:5.5)){ par=true; break; } } }
      run=par?run+1:0; if(run>best) best=run; } }
  return {par:best,wet:n?wet/n:0};
}
function planValidate(nodes,opt){
  opt=opt||{}; const P=q=>q.id!=null?stById(q.id):q, own=opt.own||new Set(), isNew=q=>q.id==null&&!q.join;
  if(nodes.some(q=>!P(q))) return null; nodes=nodes.slice();
  // a new stop within ~600 m of an existing station is that station
  for(let k=0;k<nodes.length;k++){ const q=nodes[k]; if(!isNew(q)) continue; let best=null, bd=4.6; for(const s of stations){ if(own.has(s.id)) continue; const d=dist(s.x,s.y,q.x,q.y); if(d<bd){ bd=d; best=s; } }
    const clash=best&&(nodes.some(o=>o.id===best.id)||lines.some(L=>L.id!==opt.skipLine&&L.stops.includes(best.id)&&nodes.some(o=>o!==q&&(o.join===L.id||(o.id!=null&&L.stops.includes(o.id))))));
    if(best){ if(clash){ if(k>0&&k<nodes.length-1){ nodes.splice(k,1); k--; } else return null; } else nodes[k]={id:best.id}; } }
  // stops at least ~500 m apart
  for(let k=1;k<nodes.length;k++){ const a=P(nodes[k-1]), b=P(nodes[k]); if(dist(a.x,a.y,b.x,b.y)>=3.4) continue;
    const drop=isNew(nodes[k])&&k<nodes.length-1?k:isNew(nodes[k-1])&&k-1>0?k-1:-1; if(drop<0) return null; nodes.splice(drop,1); k--; }
  // every crossing becomes a shared interchange — through the crossed line's own station when it has one nearby
  for(let guard=0;guard<14;guard++){ let fixed=false;
    for(let k=1;k<nodes.length&&!fixed;k++){ const a=P(nodes[k-1]), b=P(nodes[k]);
      for(const X of planCross(a,b,opt.ctx,opt.skipLine)){ const L=lineById(X.line); if(!L) continue;
        if((nodes[k-1].id!=null&&L.stops.includes(nodes[k-1].id))||(nodes[k].id!=null&&L.stops.includes(nodes[k].id))) continue;
        if(Math.abs(X.cos)>0.82) return null;                                 // glancing crossing = running alongside
        let st=null, sd=4.5; for(const id of L.stops){ const o=stById(id); const d=o?dist(o.x,o.y,X.x,X.y):1e9; if(d<sd){ sd=d; st=id; } }
        const ins=st!=null&&!nodes.some(q=>q.id===st)?{id:st}:{x:X.x,y:X.y,join:X.line}; if(ins.id==null&&G.water[Math.round(X.y)*W+Math.round(X.x)]) return null;
        const ip=P(ins);
        if(dist(ip.x,ip.y,a.x,a.y)<3.4){ if(isNew(nodes[k-1])&&k-1>0) nodes[k-1]=ins; else return null; }
        else if(dist(ip.x,ip.y,b.x,b.y)<3.4){ if(isNew(nodes[k])&&k<nodes.length-1) nodes[k]=ins; else return null; }
        else nodes.splice(k,0,ins);
        fixed=true; break; } }
    if(!fixed) break; }
  if(new Set(nodes.filter(q=>q.id!=null).map(q=>q.id)).size!==nodes.filter(q=>q.id!=null).length) return null;
  // touching another line: once only (twice = weaving round it; rings excepted), never on two stops in a row (= running alongside)
  const linesAt=q=>q.join!=null?[q.join]:q.id!=null?lines.filter(L=>L.id!==opt.skipLine&&L.stops.length>=2&&L.stops.includes(q.id)).map(L=>L.id):[];
  const lastAt=new Map();
  for(let k=0;k<nodes.length;k++){ for(const li of linesAt(nodes[k])){ const L=lineById(li); if(lastAt.has(li)&&L&&!L.loop) return null; lastAt.set(li,k); }
    if(k&&linesAt(nodes[k]).some(li=>linesAt(nodes[k-1]).includes(li))) return null; }
  for(const q of nodes) if(q.join!=null&&q.nb==null){ const L=lineById(q.join); let nb=null, nd=1e9; for(const id of (L?L.stops:[])){ const o=stById(id); const d=o?dist(o.x,o.y,q.x,q.y):1e9; if(d<nd){ nd=d; nb=id; } } if(nb!=null&&nd<12){ q.nb=nb; q.nbT=nd*1.12/METRO_V+DWELL+1; } }
  // geometry: no turn sharper than ~75°, no winding (route at most 45 % longer than the straight line)
  const pts=[...(opt.lead||[]),...nodes.map(P)];
  for(let k=1;k<pts.length-1;k++){ const a=pts[k-1], b=pts[k], c=pts[k+1], ux=b.x-a.x, uy=b.y-a.y, vx=c.x-b.x, vy=c.y-b.y; if((ux*vx+uy*vy)/((Math.hypot(ux,uy)||1)*(Math.hypot(vx,vy)||1))<0.25) return null; }
  const np=nodes.map(P), len=plen(np.map(p=>[p.x,p.y])), dd=dist(np[0].x,np[0].y,np[np.length-1].x,np[np.length-1].y);
  if(!opt.loop&&dd>12&&len/dd>1.45) return null;
  // no curling: the line's heading may swing through at most ~140° overall (small zig-zags cancel out)
  if(!opt.loop){ let turn=0, lo=0, hi=0; for(let k=1;k<pts.length-1;k++){ const a=pts[k-1], b=pts[k], c=pts[k+1]; let d=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x); while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; turn+=d; lo=Math.min(lo,turn); hi=Math.max(hi,turn); } if(hi-lo>2.45) return null; }
  // no duplicate corridor: outside the dense core, three new stops in a row within ~1 km of another line = the same catchment twice
  let shade=0; for(let k=0;k<nodes.length;k++){ if(!isNew(nodes[k])){ shade=0; continue; } const p=np[k]; if(G.D[Math.round(p.y)*W+Math.round(p.x)]>0.75){ shade=0; continue; }
    let near=false; const kx=Math.floor(p.x/8), ky=Math.floor(p.y/8);
    for(let dy=-1;dy<=1&&!near;dy++) for(let dx=-1;dx<=1&&!near;dx++){ const L=opt.ctx.bk.get((ky+dy)*1000+kx+dx); if(!L) continue;
      for(const sg of L){ if(sg.line===opt.skipLine) continue; const vx=sg.b[0]-sg.a[0], vy=sg.b[1]-sg.a[1], tt=clamp(((p.x-sg.a[0])*vx+(p.y-sg.a[1])*vy)/((vx*vx+vy*vy)||1),0,1); if(dist(p.x,p.y,sg.a[0]+vx*tt,sg.a[1]+vy*tt)<7){ near=true; break; } } }
    shade=near?shade+1:0; if(shade>=3) return null; }
  // not alongside another line for more than ~1 km, not mostly over water
  const pp=planParallel(np,opt.ctx,opt.skipLine,np.filter((p,i)=>nodes[i].id!=null||nodes[i].join)); if(pp.par>7||pp.wet>0.3) return null;
  return nodes;
}
