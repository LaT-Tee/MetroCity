/* ================= quick "what if": estimate a new line (or an extension) without re-running the simulation =================
   Trick: the shortest paths of the current network are already known for every pair of stations. A trip that uses the new
   chain of stops boards it at some stop a and leaves at stop b, so its new time is
       min( old time , best way to reach a + ride a→b + best way on from b ).
   With the chain's stops in order, the best (a,b) pair is found in one forward and one backward sweep — no Dijkstra at all. */
const EST_N=3000;
function estBase(){
  if(!sim||!runSim.sp||!runSim.ids) return null;
  const A=G.agents, n=Math.min(EST_N,A.length), stp=A.length/n, ag=[];
  for(let i=0;i<n;i++){ const a=A[Math.floor(i*stp)]; if((!a.oc||!a.dc)&&runSim.ids.length>=2) continue; if(a.t==null||a.tr==null) continue; ag.push({oc:a.oc||[],dc:a.dc||[],tm:a.tm,t:a.t,p:a.p,tr:a.tr,hx:a.hx,hy:a.hy,wx:a.wx,wy:a.wy,kc:a.dRoad*CONG*a.dens/CAR_V}); }
  const hub=new Map(); runSim.ids.forEach((id,i)=>hub.set(id,i));
  return {sp:runSim.sp,hub,ag,w:G.popTotal*0.55*2/Math.max(1,ag.length),key:runSim.gsig+'|'+months,kcSum:ag.reduce((s,a)=>s+(1-a.p)*a.kc,0)};
}
// chain: [{id}|{x,y}] in riding order
function quickEstimate(base,chain,opt){
  if(!base||chain.length<2) return null; opt=opt||{};
  const P=chain.map(c=>c.id!=null?stById(c.id):c); if(P.some(p=>!p)) return null;
  const n=P.length, cum=new Float64Array(n), hub=new Int32Array(n), hub2=new Int32Array(n).fill(-1), add2=new Float64Array(n);
  for(let k=0;k<n;k++){ hub[k]=chain[k].id!=null&&base.hub.has(chain[k].id)?base.hub.get(chain[k].id):-1;
    if(chain[k].nb!=null&&base.hub.has(chain[k].nb)){ hub2[k]=base.hub.get(chain[k].nb); add2[k]=chain[k].nbT||0; }   // a new interchange: reach the crossed line through its nearest station
    if(k) cum[k]=cum[k-1]+(opt.segT?opt.segT[k-1]:dist(P[k-1].x,P[k-1].y,P[k].x,P[k].y)*1.12/METRO_V+DWELL); }
  const R2=WALK_R*WALK_R, sp=base.sp, f=new Float64Array(n), g=new Float64Array(n); let dT=0, dP=0, dKc=0;
  for(const a of base.ag){
    for(let k=0;k<n;k++){
      let fb=Infinity, gb=Infinity; const p=P[k];
      const h2=(p.x-a.hx)**2+(p.y-a.hy)**2; if(h2<R2) fb=Math.sqrt(h2)*WALK_F/WALK_V;
      const w2=(p.x-a.wx)**2+(p.y-a.wy)**2; if(w2<R2) gb=Math.sqrt(w2)*WALK_F/WALK_V;
      const hk=hub[k]; if(hk>=0){ for(const [o,wo] of a.oc){ const v=wo+sp[o].d[hk]; if(v<fb) fb=v; } const sk=sp[hk].d; for(const [d,wd] of a.dc){ const v=sk[d]+wd; if(v<gb) gb=v; } }
      const h2k=hub2[k]; if(h2k>=0){ const ad=add2[k]; for(const [o,wo] of a.oc){ const v=wo+sp[o].d[h2k]+ad; if(v<fb) fb=v; } const sk=sp[h2k].d; for(const [d,wd] of a.dc){ const v=sk[d]+wd+ad; if(v<gb) gb=v; } }
      f[k]=fb; g[k]=gb;
    }
    let via=Infinity, m=Infinity;
    for(let k=0;k<n;k++){ const v=m+cum[k]+g[k]; if(v<via) via=v; const c=f[k]-cum[k]; if(c<m) m=c; }
    m=Infinity; for(let k=n-1;k>=0;k--){ const v=m-cum[k]+g[k]; if(v<via) via=v; const c=f[k]+cum[k]; if(c<m) m=c; }
    via+=(opt.wait!=null?opt.wait:WAIT)+ALIGHT-DWELL;
    const tm=Math.min(a.tm,via); if(!(tm<a.tm)) continue;
    const p=1/(1+Math.exp((tm-a.tr)/3.5)), t=p*tm+(1-p)*a.tr; dT+=t-a.t; dP+=p-a.p; dKc+=(p-a.p)*a.kc;
  }
  // fewer cars: everyone still driving gets a slightly faster road (first-order congestion relief)
  const N=base.ag.length, dLoad=-0.95*dP/N; dT+=(base.kcSum-dKc)*dLoad;
  return {dAvg:dT/N, dRiders:dP*base.w*0.85};
}
