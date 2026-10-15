/* ================= express services: semi-fast, fast and express trains skip the smaller stops ================= */
const SVC_MIN=[0,5,7,8], SVC_WAIT=[WAIT,3.2,4,5], SVC_SPEED=[1,1.1,1.2,1.3];
const KEY_ST=new Set(['st_airport','st_airport2','st_rail','st_coach','rail2','rail2b','coach2','air2']);
function lineCounts(){ const c=new Map(); lines.forEach(L=>{ if(L.stops.length>=2) L.stops.forEach(id=>c.set(id,(c.get(id)||0)+1)); }); return c; }
function stopScore(id,cnt){ const st=stById(id); const b=sim&&sim.stBoard&&sim.stBoard[id]!=null?sim.stBoard[id]+(sim.stAlight?sim.stAlight[id]||0:0):catchment(st)*0.6;
  const core=G.centers.some(c=>(c.type==='main'||c.name.k==='core'||c.name.k==='downtown')&&dist(c.x,c.y,st.x,st.y)<5)?3e5:0; return b+core+((cnt.get(id)||1)-1)*1.2e5+(KEY_ST.has(st.name.k)?6e5:0); }
// which stops each faster service calls at — chosen automatically from ridership, interchanges and key facilities
function expStops(L){
  const n=L.stops.length, cnt=lineCounts(), out=[]; if(L.loop||n<SVC_MIN[1]) return out;
  const must=new Set([L.stops[0],L.stops[n-1]]), hasAp=L.stops.some(id=>stById(id).name.k==='st_airport');
  L.stops.forEach(id=>{ const k=stById(id).name.k; if(KEY_ST.has(k)&&!(k==='st_airport2'&&hasAp)) must.add(id); });
  const ranked=L.stops.filter(id=>!must.has(id)).map(id=>[id,stopScore(id,cnt)]).sort((a,b)=>b[1]-a[1]).map(o=>o[0]);
  let prev=new Set(L.stops);
  for(let tr=1;tr<=Math.min(3,L.svc||0);tr++){
    if(n<SVC_MIN[tr]) break;
    const keep=new Set(must);
    if(tr===1){ ranked.forEach(id=>{ if((cnt.get(id)||1)>1) keep.add(id); }); ranked.slice(0,Math.ceil(ranked.length*0.5)).forEach(id=>keep.add(id)); }
    else if(tr===2) ranked.slice(0,Math.max(1,Math.ceil(ranked.length*0.25))).forEach(id=>keep.add(id));
    else ranked.slice(0,Math.min(2,Math.max(0,Math.floor(n/6)))).forEach(id=>keep.add(id));
    for(const id of [...keep]) if(!prev.has(id)) keep.delete(id);
    if(keep.size>=prev.size){ const drop=ranked.filter(id=>keep.has(id)&&!must.has(id)); if(drop.length) keep.delete(drop[drop.length-1]); }
    if(keep.size<2||keep.size>=prev.size) break;
    out.push(L.stops.filter(id=>keep.has(id))); prev=keep;
  }
  return out;
}
function refreshExpress(force){ for(const L of lines){ if(!L.svc||L.loop){ L.xs=null; continue; } const key=L.stops.join(',')+'|'+L.svc;
  if(force||L.xsKey!==key||months-(L.xsM||0)>=12||!L.xs){ L.xs=expStops(L); L.xsKey=key; L.xsM=months; } } }
function svcOf(L,id){ let t=0; (L.xs||[]).forEach((ids,i)=>{ if(ids.includes(id)) t=i+1; }); return t; }
// end-to-end minutes for the all-stations train and for the fastest service
function svcTimes(L){
  ensurePaths(L); const seg=L.paths.map(p=>plen(p)/METRO_V), tot=seg.reduce((a,b)=>a+b,0), t0=tot+(L.stops.length-1)*DWELL;
  const xs=L.xs||[]; if(!xs.length) return [t0,t0,L.stops.length];
  const top=xs.length, ids=xs[top-1]; return [t0,tot/SVC_SPEED[top]+(ids.length-1)*DWELL,ids.length];
}
