/* ================= development projects: a new industrial estate, science park, resort or university pulls people in ================= */
// pull: how strongly it draws new homes; jobs: workplaces it adds; d: distance band from the centre; max: per city; late: needs a bigger city
const PROJ={
  ind:{pull:0.9,sg:7,jobs:0.7,d:[35,85],max:3}, tech:{pull:1.1,sg:7,jobs:0.85,d:[25,55],max:2}, univ:{pull:1.0,sg:6,jobs:0.45,d:[25,60],max:2},
  beach:{pull:0.8,sg:6,jobs:0.3,d:[20,90],max:1}, scenic:{pull:0.6,sg:6,jobs:0.25,d:[30,100],max:1}, theme:{pull:0.85,sg:6,jobs:0.4,d:[25,60],max:1},
  hist:{pull:0.6,sg:5,jobs:0.25,d:[25,90],max:1}, spa:{pull:0.55,sg:5,jobs:0.25,d:[35,100],max:1}, port:{pull:0.7,sg:7,jobs:0.65,d:[30,85],max:1},
  ent:{pull:1.0,sg:6,jobs:0.6,d:[12,32],max:1,late:1,dense:0.9}, fin:{pull:1.2,sg:7,jobs:1.3,d:[14,34],max:1,late:1,dense:1.1},
  gov:{pull:1.3,sg:8,jobs:1.0,d:[28,52],max:1,late:1}, arena:{pull:0.7,sg:6,jobs:0.35,d:[18,45],max:1,late:1},
  air:{pull:0.8,sg:9}, rail:{pull:0.95,sg:6}, coach:{pull:0.5,sg:5}};
const PROJ_TYPES=['ind','tech','univ','beach','scenic','theme','hist','spa','port','ent','fin','gov','arena'];
const PROJ_BUILD=12;   // months under construction
function projName(p){ return {k:'p_'+p.t,s:p.s}; }
function projDone(p){ return months-p.m0>=PROJ_BUILD; }
function siteProject(type,R){
  const B=G.bounds, M=G.centers[0], ps=allPlaces(), pj=G.projects||[], RAc=growth.roadAcc, P=PROJ[type]; let best=null, bs=-1e9;
  for(let tr=0;tr<800;tr++){
    const x=B[0]+8+R()*(B[2]-B[0]-16), y=B[1]+8+R()*(B[3]-B[1]-16), i=Math.round(y)*W+Math.round(x);
    if(G.water[i]||growth.S[i]<0.2||G.D[i]>(P.dense||0.45)) continue;
    const dm=dist(x,y,M.x,M.y); if(dm<P.d[0]||dm>P.d[1]) continue;
    if(ps.some(p=>dist(p.x,p.y,x,y)<(type==='hist'?2.5:6))||pj.some(p=>dist(p.x,p.y,x,y)<18)) continue;
    if(dist(x,y,G.fac.airport.x,G.fac.airport.y)<16||(G.fac2||[]).some(f=>dist(f.x,f.y,x,y)<14)) continue;
    const ra=RAc?RAc[i]:0.5, e=G.e[i], dw=G.dw[i], pk=G.pk[i], flat=1-smooth(e,0.3,0.6), mid=1-Math.abs(dm-(P.d[0]+P.d[1])/2)/(P.d[1]-P.d[0]); let sc;
    if(type==='ind') sc=1.4*ra+0.8*flat+0.5*mid;
    else if(type==='tech'){ let near=0; for(const c of G.centers) if(c!==M){ const d=dist(c.x,c.y,x,y); if(d>8&&d<34) near=Math.max(near,1-d/34); } sc=ra+1.2*near+0.4*mid; }
    else if(type==='univ') sc=0.9*smooth(pk,0.12,0.3)+0.6*ra+0.5*mid;
    else if(type==='beach'){ if(dw>7||dw<2) continue; sc=1-Math.abs(dw-3.5)/4+0.5*ra; }
    else if(type==='scenic'){ if(e<0.4) continue; sc=0.8*smooth(e,0.4,0.6)+0.6*smooth(pk,0.15,0.3)+0.4*ra; }
    else if(type==='theme') sc=0.9*flat+0.8*ra+0.4*(dw<10?1:0)+0.4*mid;
    else if(type==='hist'){ const v=G.villages.find(v=>!v.born&&dist(v.x,v.y,x,y)<6); if(!v) continue; sc=0.6*smooth(e,0.3,0.55)+0.5*(dw<6?1:0)+0.4*smooth(pk,0.1,0.25)+0.3*ra; }
    else if(type==='spa'){ if(e<0.45) continue; sc=smooth(e,0.45,0.7)+0.3*ra+0.3*smooth(pk,0.1,0.25); }
    else if(type==='port'){ if(dw>5||dw<1.5) continue; sc=0.8*flat+0.8*ra+0.3*mid; }
    else if(type==='ent') sc=0.8*(dw<6?1:0)+0.7*ra+0.4*mid;
    else if(type==='fin'){ let rl=1e9; for(let k=0;k<G.rail.length;k+=3) rl=Math.min(rl,dist(x,y,G.rail[k][0],G.rail[k][1])); sc=0.7*(dw<6?1:0)+0.6*(rl<6?1:0)+0.8*ra+0.3*mid; }
    else if(type==='gov') sc=0.9*flat+0.6*ra+0.5*mid+0.3*smooth(pk,0.1,0.25)-0.6*Math.min(1,G.D[i]*3);
    else sc=0.9*flat+0.9*ra+0.4*mid;
    sc+=R()*0.35; if(sc>bs){ bs=sc; best={x,y}; }
  }
  return best;
}
// called once a month; returns events for the UI
function projectsTick(){
  G.projects=G.projects||[]; const ev=[];
  for(const p of G.projects) if(!p.done&&projDone(p)){ p.done=true; boostJobs(p.x,p.y,PROJ[p.t].jobs); ev.push({type:'done',p}); }
  const active=G.projects.filter(p=>!p.done).length, gap=G.projects.length?11+(hashInt(G.seed*31+G.projects.length)%9):6;
  if(active<2&&months-(G.lastProj||0)>=gap){
    G.lastProj=months;
    const R=mulberry32(G.seed*97+G.projects.length*13+months), recent=G.projects.slice(-5).map(p=>p.t), big=months>=48||G.popTotal>=growth.pop0*1.2;
    const ok=PROJ_TYPES.filter(t=>(!PROJ[t].late||big)&&G.projects.filter(p=>p.t===t).length<PROJ[t].max);
    // never the same kind twice in a row; prefer kinds the city hasn't seen lately; big-city kinds get a nudge once unlocked
    const tries=ok.map(t=>[t,R()+(recent.includes(t)?-1.5:0)+(recent[recent.length-1]===t?-5:0)+(PROJ[t].late?0.35:0)]).sort((a,b)=>b[1]-a[1]).map(o=>o[0]);
    for(const t of tries){ const site=siteProject(t,R); if(!site) continue;
      const p={t,x:Math.round(site.x*10)/10,y:Math.round(site.y*10)/10,s:freshSeed(site.x,site.y),m0:months,done:false};
      G.projects.push(p); const np=nearestPlace(p.x,p.y); if(np&&dist(np.x,np.y,p.x,p.y)>5) routeRoad(p,np,'art'); ev.push({type:'start',p}); break; }
  }
  return ev;
}
// extra newcomers drawn in by projects that are being built or just opened
function projectInflow(){ let f=0; for(const p of (G.projects||[])){ const age=months-p.m0; if(age<PROJ_BUILD+36) f+=age<PROJ_BUILD?0.0002:0.00035; } return f; }
