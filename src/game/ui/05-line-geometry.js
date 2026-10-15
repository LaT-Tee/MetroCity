/* ---------- metro line geometry (cached) ---------- */
let geomKey='';
function offsetPts(pts,off){
  const n=pts.length, o=[];
  for(let i=0;i<n;i++){
    let nx=0, ny=0;
    for(const [a,b] of [[i-1,i],[i,i+1]]){ if(a<0||b>=n) continue; const dx=pts[b][0]-pts[a][0], dy=pts[b][1]-pts[a][1], l=Math.hypot(dx,dy)||1; nx+=-dy/l; ny+=dx/l; }
    const l=Math.hypot(nx,ny)||1; o.push([pts[i][0]+nx/l*off,pts[i][1]+ny/l*off]);
  }
  return o;
}
function lineGeometry(lwW){
  const key=netVersion+'|'+Math.round(lwW*40); if(key===geomKey) return; geomKey=key;
  const groups=new Map(), kk=(a,b)=>a<b?a+'-'+b:b+'-'+a;
  for(const L of lines){ ensurePaths(L); const n=L.stops.length; for(let i=0;i<segCount(L);i++){ const k=kk(L.stops[i],L.stops[(i+1)%n]); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(L.id); } }
  for(const L of lines){
    const p=new Path2D(), n=L.stops.length;
    for(let i=0;i<segCount(L);i++){
      const a=L.stops[i], b=L.stops[(i+1)%n], g=groups.get(kk(a,b));
      let off=(g.indexOf(L.id)-(g.length-1)/2)*lwW*0.92; if(a>b) off=-off;
      const pts=off?offsetPts(L.paths[i],off):L.paths[i];
      if(i===0) p.moveTo(pts[0][0],pts[0][1]); else p.lineTo(pts[0][0],pts[0][1]);
      for(let j=1;j<pts.length;j++) p.lineTo(pts[j][0],pts[j][1]);
    }
    L._path=p;
  }
}
