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
function achContext(){
  const cnt=new Map(); lines.forEach(L=>{ if(L.stops.length>=2) L.stops.forEach(id=>cnt.set(id,(cnt.get(id)||0)+1)); });
  let maxX=0; cnt.forEach(v=>maxX=Math.max(maxX,v));
  const F=G.fac, has=(x,y,r)=>stations.some(s=>cnt.get(s.id)&&dist(s.x,s.y,x,y)<r);
  const twin=G.centers.find(c=>c.type==='twin');
  return {lines:activeLineCount(), stations:stations.filter(s=>cnt.get(s.id)).length, maxXfer:maxX, loop:lines.some(l=>l.loop&&l.stops.length>=3),
    airport:has(F.airport.term.x,F.airport.term.y,7), rail:has(F.station.x,F.station.y,4), sea:lines.some(L=>L.stops.length>=2&&L.paths.some(p=>wetFrac(p)>0.08)),
    twin:!!twin&&has(twin.x,twin.y,10)&&has(G.centers[0].x,G.centers[0].y,10), hub:stations.some(s=>(s.lv||0)>=3),
    riders:sim?sim.riders:0, share:sim?sim.share:0, cut:sim&&baseline?baseline.avg-sim.avg:0, cover:sim?sim.cover:0, popGrow:growth?(G.popTotal-growth.pop0)/growth.pop0:0};
}
