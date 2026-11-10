/* ================= inserting stations on existing lines ================= */
function nearestOnLine(L,x,y){
  ensurePaths(L); let best={d:Infinity};
  L.paths.forEach((p,si)=>{ for(let j=0;j<p.length-1;j++){ const ax=p[j][0],ay=p[j][1],bx=p[j+1][0],by=p[j+1][1], dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy||1e-9;
    const tt=clamp(((x-ax)*dx+(y-ay)*dy)/l2,0,1), px=ax+dx*tt, py=ay+dy*tt, d=Math.hypot(x-px,y-py);
    if(d<best.d) best={d,seg:si,sub:j,px,py}; } });
  return best;
}
function splitInsert(L,seg,sub,st){
  const p=L.paths[seg], a=p.slice(0,sub+1), b=p.slice(sub+1);
  a.push([st.x,st.y]); b.unshift([st.x,st.y]);
  L.paths.splice(seg,1,a,b); L.stops.splice(seg+1,0,st.id);
}
function insertStation(L,st){ const nr=nearestOnLine(L,st.x,st.y); if(!isFinite(nr.d)) return false; splitInsert(L,nr.seg,nr.sub,st); return true; }
// every other line passing through the station's spot picks it up, turning it into a transfer
function joinCrossing(st,except,tol){
  tol=tol||1.2; const joined=[];
  for(const M of lines){
    if(M===except||M.stops.length<2||M.stops.includes(st.id)) continue;
    const nr=nearestOnLine(M,st.x,st.y); if(nr.d>tol) continue;
    if(M.stops.some(id=>{ const o=stById(id); return o&&dist(o.x,o.y,st.x,st.y)<1.6; })) continue;
    splitInsert(M,nr.seg,nr.sub,st); joined.push(M);
  }
  return joined;
}
function segX(a,b,c,d){ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null;
  const u=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, v=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; if(u<0||u>1||v<0||v>1) return null; return [a[0]+r[0]*u,a[1]+r[1]*u]; }
// nearest crossing between line L and any other line, within radius R of (x,y)
function crossingNear(L,x,y,R){
  let best=null, bd=R; const near=(p,q)=>Math.min(p[0],q[0])-R<=x&&Math.max(p[0],q[0])+R>=x&&Math.min(p[1],q[1])-R<=y&&Math.max(p[1],q[1])+R>=y;
  for(const pa of L.paths) for(let i=0;i<pa.length-1;i++){ if(!near(pa[i],pa[i+1])) continue;
    for(const M of lines){ if(M===L||M.stops.length<2) continue; for(const pb of M.paths) for(let j=0;j<pb.length-1;j++){ if(!near(pb[j],pb[j+1])) continue;
      const X=segX(pa[i],pa[i+1],pb[j],pb[j+1]); if(X){ const d=dist(X[0],X[1],x,y); if(d<bd){ bd=d; best=X; } } } } }
  return best;
}

// A newly drawn stretch (segment seg of line L) that crosses another line makes an interchange there, as real metros do:
// at that line's own station when one is close (the new line bends to call at it), otherwise a new station on both.
function crossInterchange(L,seg){
  const made=[], dry=(x,y)=>{ const xi=Math.round(x), yi=Math.round(y); return inB(x,y,1)&&G.water[yi*W+xi]===0; };
  for(let guard=0;guard<6&&seg<L.paths.length;guard++){
    const pa=L.paths[seg]; let hit=null;
    for(let i=0;i<pa.length-1&&!hit;i++) for(const M of lines){ if(M===L||M.stops.length<2||hit) continue;
      for(let s2=0;s2<M.paths.length&&!hit;s2++){ const pb=M.paths[s2]; for(let j=0;j<pb.length-1;j++){ const X=segX(pa[i],pa[i+1],pb[j],pb[j+1]); if(!X) continue;
        if(L.stops.some(id=>{ const o=stById(id); return o&&dist(o.x,o.y,X[0],X[1])<2.4; })) continue;
        hit={X,M,s2,j,i}; break; } } }
    if(!hit) break; const {X,M,s2,j,i}=hit;
    let S=null, bd=2.6; for(const id of M.stops){ const o=stById(id); if(!o||L.stops.includes(id)) continue; const d=dist(o.x,o.y,X[0],X[1]); if(d<bd&&!L.stops.some(q=>{ const w=stById(q); return w&&dist(w.x,w.y,o.x,o.y)<2.2; })){ bd=d; S=o; } }
    if(S){ // bend the new line through the existing station
      const far=q=>dist(q[0],q[1],S.x,S.y)>2.6, a=pa.slice(0,i+1).filter((q,k)=>k===0||far(q)), b=pa.slice(i+1).filter((q,k,arr)=>k===arr.length-1||far(q));
      a.push([S.x,S.y]); b.unshift([S.x,S.y]); L.paths.splice(seg,1,chaikin(a,2),chaikin(b,2)); L.stops.splice(seg+1,0,S.id); made.push(S); }
    else if(dry(X[0],X[1])&&!M.stops.some(id=>{ const o=stById(id); return o&&dist(o.x,o.y,X[0],X[1])<1.6; })){
      const st=newStation(X[0],X[1]); splitInsert(L,seg,i,st); splitInsert(M,s2,j,st); made.push(st); }
    else break;
    seg++; }
  return made;
}
