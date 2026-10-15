/* ---------- live estimate while drawing: the stroke's line (plus the stop under the pen) against the network as it was ---------- */
function updateLiveEst(now){
  const s=stroke; if(!s||!s.drawing||!sim) return;
  if(!s.eb){ s.eb=estBase(); if(!s.eb) return; }
  if(now-(s.estT||0)<90) return;
  let ids=[]; if(s.L&&s.L.stops.length){ ids=s.L.stops.slice(); if(s.needReverse) ids.reverse(); }
  const nodes=ids.map(id=>({id}));
  if(!nodes.length) nodes.push(s.from.isNew?{x:s.from.x,y:s.from.y}:{id:s.from.id});
  const last=nodes[nodes.length-1], lp=last.id!=null?stById(last.id):last, [px,py]=s.pen, hit=stationAt(px,py);
  if(hit){ if(!nodes.some(n=>n.id===hit.id)) nodes.push({id:hit.id}); } else if(isLand(px,py)&&lp&&dist(lp.x,lp.y,px,py)>=1.2) nodes.push({x:px,y:py});
  const key=nodes.map(n=>n.id!=null?n.id:Math.round(n.x*2)+','+Math.round(n.y*2)).join('|'); s.estT=now;
  if(key===s.estK) return; s.estK=key;
  s.est=nodes.length>=2?quickEstimate(s.eb,nodes):null;
}
