/* ================= progression ================= */
const LEVEL_AT=[0,5e4,2e5,5e5,1e6,2e6,4e6];
function cityLevel(riders){ let l=0; for(let i=0;i<LEVEL_AT.length;i++) if(riders>=LEVEL_AT[i]) l=i; return l; }
const ST_LV=[0,2e4,6e4,1.5e5];
function stationLevel(b){ let l=0; for(let i=0;i<ST_LV.length;i++) if(b>=ST_LV[i]) l=i; return l; }
const ACH=[
  ['firstLine', c=>c.lines>=1], ['firstXfer', c=>c.maxXfer>=2], ['tripleXfer', c=>c.maxXfer>=3], ['loop', c=>c.loop],
  ['airport', c=>c.airport], ['rail', c=>c.rail], ['sea', c=>c.sea], ['twin', c=>c.twin],
  ['lines5', c=>c.lines>=5], ['lines10', c=>c.lines>=10], ['lines20', c=>c.lines>=20], ['lines30', c=>c.lines>=30], ['st50', c=>c.stations>=50], ['hub', c=>c.hub],
  ['riders1', c=>c.riders>=1e5], ['riders2', c=>c.riders>=5e5], ['riders3', c=>c.riders>=1e6], ['riders4', c=>c.riders>=3e6],
  ['share1', c=>c.share>=0.2], ['share2', c=>c.share>=0.4], ['cut1', c=>c.cut>=5], ['cut2', c=>c.cut>=12],
  ['cover1', c=>c.cover>=0.5], ['cover2', c=>c.cover>=0.75], ['pop1', c=>c.popGrow>=0.1], ['pop2', c=>c.popGrow>=0.25]
];
// a ring made of several lines: some 2-connected part of the station graph (any two of its stations lie on a common
// cycle) spans real ground. Biconnected components via an iterative Tarjan pass: linear time, so it scales to any network size.
function netRing(){
  const adj=new Map(), add=(a,b)=>{ if(a===b) return; if(!adj.has(a)) adj.set(a,new Set()); if(!adj.has(b)) adj.set(b,new Set()); adj.get(a).add(b); adj.get(b).add(a); };
  for(const L of lines){ if(L.stops.length<2) continue; for(let k=1;k<L.stops.length;k++) add(L.stops[k-1],L.stops[k]); if(L.loop&&L.stops.length>=3) add(L.stops[L.stops.length-1],L.stops[0]); }
  const disc=new Map(), low=new Map(); let time=0;
  const bigEnough=ids=>{ if(ids.size<5) return false; const pts=[...ids].map(stById).filter(Boolean).map(o=>[o.x,o.y]); if(pts.length<5) return false;
    pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]), lo=[], up=[];
    for(const p of pts){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); }
    for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
    const h=lo.slice(0,-1).concat(up.slice(0,-1)); let per=0, ar=0; for(let i=0;i<h.length;i++){ const a=h[i], b=h[(i+1)%h.length]; per+=dist(a[0],a[1],b[0],b[1]); ar+=a[0]*b[1]-b[0]*a[1]; }
    return per>=36&&Math.abs(ar)/2>=60; };
  for(const root of adj.keys()){ if(disc.has(root)) continue;
    disc.set(root,time); low.set(root,time); time++; const stack=[[root,null,[...adj.get(root)],0]], es=[];
    while(stack.length){ const fr=stack[stack.length-1], [u,parent,nb]=fr;
      if(fr[3]<nb.length){ const v=nb[fr[3]++]; if(v===parent) continue;
        if(!disc.has(v)){ es.push([u,v]); disc.set(v,time); low.set(v,time); time++; stack.push([v,u,[...adj.get(v)],0]); }
        else if(disc.get(v)<disc.get(u)){ es.push([u,v]); low.set(u,Math.min(low.get(u),disc.get(v))); } }
      else { stack.pop(); if(parent==null) continue; low.set(parent,Math.min(low.get(parent),low.get(u)));
        if(low.get(u)>=disc.get(parent)){ const comp=new Set(); for(;;){ const e=es.pop(); comp.add(e[0]); comp.add(e[1]); if((e[0]===parent&&e[1]===u)||!es.length) break; } if(bigEnough(comp)) return true; } } } }
  return false;
}
function achContext(){
  const cnt=new Map(); lines.forEach(L=>{ if(L.stops.length>=2) L.stops.forEach(id=>cnt.set(id,(cnt.get(id)||0)+1)); });
  let maxX=0; cnt.forEach(v=>maxX=Math.max(maxX,v));
  const F=G.fac, has=(x,y,r)=>stations.some(s=>cnt.get(s.id)&&dist(s.x,s.y,x,y)<r);
  const twin=G.centers.find(c=>c.type==='twin');
  return {lines:activeLineCount(), stations:stations.filter(s=>cnt.get(s.id)).length, maxXfer:maxX, get loop(){ return lines.some(l=>l.loop&&l.stops.length>=3)||netRing(); },
    airport:has(F.airport.term.x,F.airport.term.y,7), rail:has(F.station.x,F.station.y,4), sea:lines.some(L=>L.stops.length>=2&&L.paths.some(p=>wetFrac(p)>0.08)),
    twin:!!twin&&has(twin.x,twin.y,10)&&has(G.centers[0].x,G.centers[0].y,10), hub:stations.some(s=>(s.lv||0)>=3),
    riders:sim?sim.riders:0, share:sim?sim.share:0, cut:sim&&baseline?baseline.avg-sim.avg:0, cover:sim?sim.cover:0, popGrow:growth?(G.popTotal-growth.pop0)/growth.pop0:0};
}
