/* Common sense, checked. Counts the things that must never be, over the whole map as it stands: anything in the
   water, on an airport or in a roadway that has no business there, platforms or lines passing through each other.
   Each rule is enforced where the thing is made; this is the proof, run on several cities before a change goes out.
   __mc.dbg.audit() in the console; every count should be 0. (The 3D counts need the 3D view to have been opened.) */
function auditWorld(){ const B=G.bounds, r={stWet:0,facWet:0,airWet:0,bldWet:0,bldAir:0,bldRoad:0,featWet:0,roadAir:0,spotWet:0,spotRoad:0,spotClash:0,platClash:0,lineClash:0,lineWet:0,stAirfield:0}, ex={};
  const bad=(k,o)=>{ r[k]++; const e=ex[k]||(ex[k]=[]); if(e.length<4) e.push(o.map(v=>typeof v==='number'?+v.toFixed(2):v)); };
  for(const st of stations) if(waterSD(st.x,st.y)<0.2) bad('stWet',[st.x,st.y]);
  for(const f of [G.fac.station,G.fac.coach,...(G.fac2||[]).filter(f=>f.t!=='air')]) if(waterSD(f.x,f.y)<0) bad('facWet',[f.t||'main',f.x,f.y]);
  for(const ap of [G.fac.airport,...(G.fac2||[]).filter(f=>f.t==='air')]){ if(!ap||ap.x==null) continue; const f=airFrame(ap), dr=airDry(ap.x,ap.y,ap.a,waterSD); if(!(dr&1)||!(dr&(f.ts>0?2:4))) bad('airWet',[ap.x,ap.y,dr]); }
  const R=G.rn, onRoad=(x,y)=>{ if(!R) return false; const h=rnNearEdge(R,x,y,0.16); return !!h&&h.d<ROAD_W[R.ec[h.e]]/2-0.012; };
  bldInRect(B[0],B[1],B[2],B[3],b=>{ const q=bldCorners(b), cx=(q[0]+q[4])/2, cy=(q[1]+q[5])/2; let w=waterSD(cx,cy)<0, a=false, rd=onRoad(cx,cy); for(let k=0;k<8;k+=2){ if(waterSD(q[k],q[k+1])<0) w=true; if(G.air&&G.air[clamp(Math.round(q[k+1]),0,H-1)*W+clamp(Math.round(q[k]),0,W-1)]) a=true; }
    if(w) bad('bldWet',[cx,cy]); if(a) bad('bldAir',[cx,cy]); if(rd) bad('bldRoad',[cx,cy]); });
  bldFeatInRect(B[0],B[1],B[2],B[3],f=>{ const q=bldCorners(f); for(let k=0;k<8;k+=2) if(waterSD(q[k],q[k+1])<0){ bad('featWet',[f.k,f.x,f.y]); break; } });
  // no street on an airfield
  if(R) for(let e=0;e<R.ea.length;e++){ const a=R.ea[e], b=R.eb[e]; if(a==null||a<0||R.ec[e]==null||R.ec[e]<0) continue; if(R.x[a]<B[0]||R.x[a]>B[2]||R.y[a]<B[1]||R.y[a]>B[3]) continue; if(G.air&&(G.air[Math.round((R.y[a]+R.y[b])/2)*W+Math.round((R.x[a]+R.x[b])/2)]&1)) bad('roadAir',[R.x[a],R.y[a]]); }
  // --- the 3D models
  const S=typeof w3d!=='undefined'&&w3d.stSpots; if(S){ const pts=(q,m)=>{ const o=[], nx=-q.hy, ny=q.hx; for(const a of [-1,-0.5,0,0.5,1]) for(const c of [-1,0,1]) o.push([q.x+q.hx*a*(q.len/2-m)+nx*c*(q.half-m),q.y+q.hy*a*(q.len/2-m)+ny*c*(q.half-m)]); return o; }, inside=(q,p)=>{ const dx=p[0]-q.x, dy=p[1]-q.y; return Math.abs(dx*q.hx+dy*q.hy)<q.len/2&&Math.abs(-dx*q.hy+dy*q.hx)<q.half; };
    const gs=S.filter(q=>q.g);
    for(const q of gs){ if(pts(q,0).some(p=>waterSD(p[0],p[1])<0)) bad('spotWet',[q.x,q.y,q.lm?'landmark':'station']); if(!q.lm&&w3dOnRoad(q.x,q.y,0)) bad('spotRoad',[q.x,q.y]); }
    for(let i=0;i<gs.length;i++) for(let j=i+1;j<gs.length;j++){ if(dist(gs[i].x,gs[i].y,gs[j].x,gs[j].y)>2) continue; if(pts(gs[i],0.01).some(p=>inside(gs[j],p))||pts(gs[j],0.01).some(p=>inside(gs[i],p))) bad('spotClash',[gs[i].x,gs[i].y,gs[j].x,gs[j].y]); }
    { const P=w3d.plats||[]; for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ const a=P[i], b=P[j]; if(Math.abs(a.lv-b.lv)>0.04) continue; const dx=b.x-a.x, dy=b.y-a.y, par=Math.abs(a.hx*b.hx+a.hy*b.hy); if(par>0.95){ const al=Math.abs(dx*a.hx+dy*a.hy), ac=Math.abs(-dx*a.hy+dy*a.hx); if(al<(a.len+b.len)/2-0.02&&ac<a.half+b.half-0.004) bad('platClash',[a.x,a.y,b.x,b.y]); } else if(Math.hypot(dx,dy)<Math.min(a.len,b.len)/2) bad('platClash',[a.x,a.y,'x']); } }
    for(const c of w3dCrossings()){ if(c.par>0.94) continue; const ya=w3dHAt(c.A,c.ua), yb=w3dHAt(c.B,c.ub); if(Math.abs(ya-yb)<0.05) bad('lineClash',[c.x,c.y,ya,yb]); }
    for(const L of lines){ const P=L._p3; if(!P||L.stops.length<2) continue; let run=false; for(let v=0;v<P.pts.length;v++){ const w=P.Y[v]>-0.055&&P.Y[v]<0.028&&waterSD(P.pts[v][0],P.pts[v][1])<0; if(w&&!run) bad('lineWet',[P.pts[v][0],P.pts[v][1],P.Y[v]]); run=w; } }
    for(const st of stations){ if(G.air&&(G.air[Math.round(st.y)*W+Math.round(st.x)]&1)&&w3d.stY&&w3d.stY.get(st.id)>-0.03) bad('stAirfield',[st.x,st.y]); } }
  else r.note='3D not built: spot/plat/line counts not checked';
  r.total=Object.values(r).reduce((a,v)=>a+(typeof v==='number'?v:0),0); r.ex=ex; return r; }
