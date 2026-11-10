/* ================= simulation ================= */
function buildGraph(){
  const S=stations.length, idx=new Map(); stations.forEach((s,i)=>idx.set(s.id,i));
  const nodes=[], adj=[], plat=new Map(), TR=throughRunning();
  for(let i=0;i<S;i++){ nodes.push({st:i,line:-1}); adj.push([]); }
  lines.forEach((L,li)=>{
    if(L.stops.length<2) return; ensurePaths(L);
    const ids=L.stops.map((id,k)=>{ const q=nodes.length; nodes.push({st:idx.get(id),line:li,k}); adj.push([]); return q; }); plat.set(L.id,ids);
    // trains come twice as often on track shared with another line
    ids.forEach((q,k)=>{ const hub=nodes[q].st; adj[hub].push([q,lineWait(L)*(TR.shared.has(L.id+'@'+L.stops[k])?0.65:1)]); adj[q].push([hub,ALIGHT]); });
    for(let k=0;k<segCount(L);k++){ const a=ids[k], b=ids[(k+1)%ids.length]; const tt=plen(L.paths[k])/lineV(L)+lineDwell(L); adj[a].push([b,tt]); adj[b].push([a,tt]); }
    // faster services: own platform nodes, longer headways, skip the smaller stops
    if(L.svc&&L.xs&&!L.loop){ const seg=L.paths.map(p=>plen(p)/METRO_V);
      L.xs.forEach((sids,ti)=>{ const tr=ti+1, pos=sids.map(id=>L.stops.indexOf(id));
        const q=sids.map((id,j)=>{ const v=nodes.length; nodes.push({st:idx.get(id),line:li,k:pos[j],svc:tr}); adj.push([]); const hub=idx.get(id); adj[hub].push([v,SVC_WAIT[tr]]); adj[v].push([hub,ALIGHT]); return v; });
        for(let j=0;j<q.length-1;j++){ let run=0; for(let k=pos[j];k<pos[j+1];k++) run+=seg[k]; const tt=run/SVC_SPEED[tr]+DWELL; adj[q[j]].push([q[j+1],tt]); adj[q[j+1]].push([q[j],tt]); } }); }
  });
  // through-running: a train reaching the end of one line carries on along the other, so nobody has to change
  for(const t of TR.thru){ const A=lineById(t.a), B=lineById(t.b), pa=plat.get(t.a), pb=plat.get(t.b); if(!A||!B||!pa||!pb) continue;
    const u=pa[A.stops.indexOf(t.st)], v=pb[B.stops.indexOf(t.next)], kb=B.stops.indexOf(t.st), seg=t.dir>0?kb:(kb-1+B.stops.length)%B.stops.length;
    if(u==null||v==null||!B.paths[seg]) continue; const tt=plen(B.paths[seg])/lineV(B)+lineDwell(B); adj[u].push([v,tt]); adj[v].push([u,tt]); }
  // shared track: changing between the two lines is across the platform
  for(const k of TR.pairs){ const [ia,ib,id]=k; const pa=plat.get(ia), pb=plat.get(ib), A=lineById(ia), B=lineById(ib); if(!pa||!pb) continue;
    const u=pa[A.stops.indexOf(id)], v=pb[B.stops.indexOf(id)]; if(u==null||v==null) continue; adj[u].push([v,XFER_CROSS]); adj[v].push([u,XFER_CROSS]); }
  return {S,nodes,adj};
}
/* Through-running (直通运转), found automatically:
   - shared track: two lines with consecutive stops in common run on the same track there;
   - through service: where a line ends at a station of another line and the other line carries on roughly the same way,
     its trains continue onto that line (the way subway lines run through onto suburban railways). */
function throughRunning(){
  const key=lines.map(L=>L.id+':'+L.stops.join('.')+(L.loop?'o':'')).join('|')+'#'+stations.length;
  if(throughRunning.key===key) return throughRunning.res;
  const built=lines.filter(L=>L.stops.length>=2), shared=new Set(), pairs=[], thru=[], adjOf=(L,id)=>{ const k=L.stops.indexOf(id), n=L.stops.length, o=[]; if(k<0) return o; if(k>0||L.loop) o.push(L.stops[(k-1+n)%n]); if(k<n-1||L.loop) o.push(L.stops[(k+1)%n]); return o; };
  for(let i=0;i<built.length;i++) for(let j=i+1;j<built.length;j++){ const A=built[i], B=built[j];
    for(const id of A.stops){ if(!B.stops.includes(id)) continue; const na=adjOf(A,id), nb=adjOf(B,id); if(!na.some(x=>nb.includes(x))) continue;
      shared.add(A.id+'@'+id); shared.add(B.id+'@'+id); pairs.push([A.id,B.id,id]); } }
  for(const A of built){ if(A.loop) continue;
    for(const end of [0,1]){ const n=A.stops.length, st=end?A.stops[n-1]:A.stops[0], pr=end?A.stops[n-2]:A.stops[1], s=stById(st), p=stById(pr); if(!s||!p) continue;
      let best=null;
      for(const B of built){ if(B===A) continue; const kb=B.stops.indexOf(st); if(kb<0) continue;
        for(const dir of [1,-1]){ let kn=kb+dir; if(B.loop) kn=(kn+B.stops.length)%B.stops.length; else if(kn<0||kn>=B.stops.length) continue;
          const nx=B.stops[kn], q=stById(nx); if(!q||A.stops.includes(nx)) continue;
          const c=((s.x-p.x)*(q.x-s.x)+(s.y-p.y)*(q.y-s.y))/((dist(p.x,p.y,s.x,s.y)||1)*(dist(s.x,s.y,q.x,q.y)||1));
          if(c>=0.35&&(!best||c>best.c)) best={a:A.id,b:B.id,st,next:nx,dir,c}; } }
      if(best) thru.push(best); } }
  throughRunning.key=key; throughRunning.res={shared,pairs,thru}; return throughRunning.res;
}
// compact adjacency (CSR) + typed binary heap: no per-edge allocations
function toCSR(adj){ const V=adj.length; let m=0; for(const a of adj) m+=a.length; const off=new Int32Array(V+1), to=new Int32Array(m), w=new Float32Array(m); let k=0;
  for(let u=0;u<V;u++){ off[u]=k; for(const e of adj[u]){ to[k]=e[0]; w[k]=e[1]; k++; } } off[V]=k; return {V,off,to,w}; }
const HPQ={k:new Float64Array(4096),v:new Int32Array(4096),n:0};
function hqPush(key,v,H){ H=H||HPQ; if(H.n>=H.k.length){ const k2=new Float64Array(H.k.length*2), v2=new Int32Array(H.k.length*2); k2.set(H.k); v2.set(H.v); H.k=k2; H.v=v2; }
  let i=H.n++; const K=H.k, Vv=H.v; while(i>0){ const p=(i-1)>>1; if(K[p]<=key) break; K[i]=K[p]; Vv[i]=Vv[p]; i=p; } K[i]=key; Vv[i]=v; }
function hqPop(H){ H=H||HPQ; const K=H.k, Vv=H.v, top=Vv[0], lk=K[--H.n], lv=Vv[H.n]; let i=0;
  for(;;){ const l=2*i+1; if(l>=H.n) break; let m=l; if(l+1<H.n&&K[l+1]<K[l]) m=l+1; if(K[m]>=lk) break; K[i]=K[m]; Vv[i]=Vv[m]; i=m; } K[i]=lk; Vv[i]=lv; return top; }
function dijkstra(g,src){
  if(!g.off) g=toCSR(g); const V=g.V, d=new Float64Array(V).fill(Infinity), pv=new Int32Array(V).fill(-1), done=new Uint8Array(V), off=g.off, to=g.to, w=g.w; d[src]=0; HPQ.n=0; hqPush(0,src);
  while(HPQ.n){ const u=hqPop(); if(done[u]) continue; done[u]=1; const du=d[u]; for(let k=off[u];k<off[u+1];k++){ const v=to[k], nd=du+w[k]; if(nd<d[v]){ d[v]=nd; pv[v]=u; hqPush(nd,v); } } }
  return {d,pv};
}
// the quickest a commute could ever be by rail: walk to a station and wait, then ride a straight line with few stops
function idealRail(d,metroOnly){ return metroOnly?6+d*(1.1/METRO_V+DWELL/7.5):7+d*(1.08/RAPID_V+RAPID_DWELL/14); }
function isFar(a){ const fk=a.hx*1e6+a.hy*1e3+a.wx+a.wy*1e-3; if(a._fk!==fk){ a._fk=fk; a._far=idealRail(dist(a.hx,a.hy,a.wx,a.wy))>FAR_MIN; } return a._far; }
// the whole measurement in one go (new city, tests); during play it runs as runSimGen, a slice at a time between frames
function runSim(){ const g=runSimGen(); let r; while(!(r=g.next()).done); return r.value; }
function* runSimGen(){
  refreshExpress();
  // travel times through the network only change when the network does: reuse all shortest paths month to month
  const gsig=stations.length+'#'+lines.map(L=>L.id+':'+L.stops.join('.')+':'+(L.loop?1:0)+':'+(L.kind||'')+':'+(L.svc||0)+':'+(L.xs?L.xs.map(x=>x.join('.')).join('/'):'')+':'+Math.round(lineLength(L)*100)).join('|');
  let gr, sp;
  if(runSim.gsig===gsig&&runSim.sp){ gr=runSim.gr; sp=runSim.sp; }
  else { gr=buildGraph(); const csr=toCSR(gr.adj); sp=[]; for(let o=0;o<gr.S;o++){ sp.push(dijkstra(csr,o)); if(o%12===11) yield; } runSim.gr=gr; runSim.sp=sp; runSim.gsig=gsig; runSim.reach=null; runSim.ids=stations.map(s=>s.id); }
  const S=gr.S;
  const A=G.agents, R2=WALK_R*WALK_R;
  // stations bucketed by walking radius: each lookup checks 3×3 buckets instead of every station
  const CS=WALK_R, GW=Math.ceil(W/CS)+2, sg=new Map(); stations.forEach((s,i)=>{ const k=Math.floor(s.y/CS)*GW+Math.floor(s.x/CS); const b=sg.get(k); if(b) b.push(i); else sg.set(k,[i]); });
  const near=(x,y)=>{ const c=[], gx=Math.floor(x/CS), gy=Math.floor(y/CS);
    for(let yy=gy-1;yy<=gy+1;yy++) for(let xx=gx-1;xx<=gx+1;xx++){ const b=sg.get(yy*GW+xx); if(!b) continue; for(const i of b){ const s=stations[i], d2=(s.x-x)**2+(s.y-y)**2; if(d2<R2) c.push([d2,i]); } }
    c.sort((a,b)=>a[0]-b[0]); return c.slice(0,5).map(([d2,i])=>[i,Math.sqrt(d2)*WALK_F/WALK_V]); };
  // nearby stations per person only change when the stations change or the person moves
  const sig=stations.length+':'+nextSid+':'+stations.reduce((h,s)=>(h*31+s.id)|0,7), fresh=runSim.sig!==sig; runSim.sig=sig;
  let cA=0; for(const a of A){ if(++cA%1500===0) yield;
    a.tm=Infinity; a.bo=-1; a.bd=-1;
    if(S<2) continue;
    if(fresh||!a.oc){ a.oc=near(a.hx,a.hy); a.dc=near(a.wx,a.wy); }
    const oc=a.oc, dc=a.dc; if(!oc.length||!dc.length) continue;
    for(const [o,wo] of oc){ const so=sp[o].d; for(const [d,wd] of dc){ if(o===d) continue; const tt=wo+so[d]+wd; if(tt<a.tm){ a.tm=tt; a.bo=o; a.bd=d; } } }
  }
  if(!runSim.reach){ const r={}; for(let o=0;o<S;o++){ let c=0; for(let d=0;d<S;d++) if(d!==o&&sp[o].d[d]<25) c++; r[stations[o].id]=S>1?c/(S-1):0; } runSim.reach=r; } const stReach=runSim.reach;
  yield; let load=1, share=0;
  for(let it=0;it<5;it++){ if(it===2) yield;
    let s=0; for(const a of A){ const tr=roadTime(a,load); a.p=isFinite(a.tm)?1/(1+Math.exp((a.tm-tr)/3.5)):0; s+=a.p; }
    share=s/A.length; load=1-share*0.95;
  }
  yield; let sumT=0, sumT0=0, sumF=0, sumF0=0, sumTn=0, sumT0n=0, nN=0, nFar=0; const wPer=G.popTotal*0.55/A.length;
  const lineRide=new Float64Array(lines.length), expRide=new Float64Array(lines.length), stBoard=new Float64Array(S), stAl=new Float64Array(S);
  for(const a of A){
    a.tr=roadTime(a,load); a.t=a.p*a.tm+(1-a.p)*a.tr; if(!isFinite(a.t)) a.t=a.tr; sumT+=a.t; sumT0+=a.t0;
    if(isFar(a)) nFar++; else { sumTn+=a.t; sumT0n+=a.t0; nN++; }
    sumF+=1+CONG*a.dens*load; sumF0+=1+CONG*a.dens;
    if(a.p>0.01&&a.bo>=0){
      stBoard[a.bo]+=a.p*wPer*2; if(a.bd>=0) stAl[a.bd]+=a.p*wPer*2;
      let u=a.bd; const seen=new Set(), seenX=new Set();
      while(u!==-1&&u!==a.bo){ const nd=gr.nodes[u]; if(nd.line>=0&&!seen.has(nd.line)){ seen.add(nd.line); lineRide[nd.line]+=a.p*wPer*2; } if(nd.svc&&!seenX.has(nd.line)){ seenX.add(nd.line); expRide[nd.line]+=a.p*wPer*2; } u=sp[a.bo].pv[u]; }
    }
  }
  yield; let cov=0, sumD=0; const cm=coverageMask(Math.sqrt(29)-1e-6);
  const Bc=G.bounds; for(let y=Bc[1];y<Bc[3];y++) for(let x=Bc[0];x<Bc[2];x++){ const i=y*W+x, d=G.D[i]; if(d<0.01) continue; sumD+=d; if(cm[i]) cov+=d; }
  baseline={avg:sumT0/A.length,jam:sumF0/A.length,avgN:nN?sumT0n/nN:sumT0/A.length};
  yield; const ZB=22, zw=Math.ceil(W/ZB), fm=new Map(), wP=G.popTotal*0.55/A.length;
  for(const a of A){ const h=Math.floor(a.hy/ZB)*zw+Math.floor(a.hx/ZB), w=Math.floor(a.wy/ZB)*zw+Math.floor(a.wx/ZB); if(h===w) continue;
    const k=h+'>'+w; let f=fm.get(k); if(!f){ f={n:0,tr:0,tm:0,nm:0,p:0,hx:0,hy:0,wx:0,wy:0}; fm.set(k,f); }
    f.n++; f.tr+=a.tr; f.p+=a.p; f.hx+=a.hx; f.hy+=a.hy; f.wx+=a.wx; f.wy+=a.wy; if(isFinite(a.tm)){ f.tm+=a.tm; f.nm++; } }
  const flows=[...fm.values()].filter(f=>f.n>=8).sort((a,b)=>b.n-a.n).slice(0,32).map(f=>{ const x=f.hx/f.n, y=f.hy/f.n, x2=f.wx/f.n, y2=f.wy/f.n; return {x,y,x2,y2,people:f.n*wP,car:f.tr/f.n,metro:f.nm>f.n*0.3?f.tm/f.nm:null,share:f.p/f.n,ideal:idealRail(dist(x,y,x2,y2)),idealMetro:idealRail(dist(x,y,x2,y2),true)}; });
  return {avg:sumT/A.length,avgN:nN?sumTn/nN:sumT/A.length,farPeople:nFar*wPer,share,load,cover:sumD?cov/sumD:0,riders:A.reduce((s,a)=>s+a.p,0)*wPer*2,
    lineRide:Object.fromEntries(lines.map((L,i)=>[L.id,lineRide[i]])),expRide:Object.fromEntries(lines.map((L,i)=>[L.id,expRide[i]])),stBoard:Object.fromEntries(stations.map((s,i)=>[s.id,stBoard[i]])),stAlight:Object.fromEntries(stations.map((s,i)=>[s.id,stAl[i]])),
    jam:sumF/A.length,cost:(runSim.costSig===gsig?runSim.cost:(runSim.costSig=gsig,runSim.cost=totalCost())),flows,stReach};
}
