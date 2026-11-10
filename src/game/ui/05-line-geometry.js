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
  const key=netVersion+'|'+Math.round(lwW*40)+'|'+Math.floor(months/12); if(key===geomKey) return; geomKey=key;
  const groups=new Map(), kk=(a,b)=>a<b?a+'-'+b:b+'-'+a;
  for(const L of lines){ ensurePaths(L); const n=L.stops.length; for(let i=0;i<segCount(L);i++){ const k=kk(L.stops[i],L.stops[(i+1)%n]); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(L.id); } }
  for(const L of lines){
    const p=new Path2D(), n=L.stops.length, pA=new Path2D(), pU=new Path2D(), lv=L.stops.length>=2?lineLevels(L):null; let hasU=false;
    for(let i=0;i<segCount(L);i++){
      const a=L.stops[i], b=L.stops[(i+1)%n], g=groups.get(kk(a,b));
      let off=(g.indexOf(L.id)-(g.length-1)/2)*lwW*0.92; if(a>b) off=-off;
      const pts=off?offsetPts(L.paths[i],off):L.paths[i];
      if(i===0) p.moveTo(pts[0][0],pts[0][1]); else p.lineTo(pts[0][0],pts[0][1]);
      for(let j=1;j<pts.length;j++) p.lineTo(pts[j][0],pts[j][1]);
      // the same stretch split where the line goes underground, for the close-up map
      if(lv){ const raw=L.paths[i]; let u=lv.sU[i];
        for(let j=1;j<pts.length;j++){ const dl=Math.hypot(raw[j][0]-raw[j-1][0],raw[j][1]-raw[j-1][1]), a=pts[j-1], b=pts[j], cuts=[0]; for(const x of lv.bd) if(x>u&&x<u+dl) cuts.push((x-u)/dl); cuts.push(1);
          for(let c=1;c<cuts.length;c++){ const t0=cuts[c-1], t1=cuts[c], under=levelDep(lv,u+dl*(t0+t1)/2)>0.5, q=under?pU:pA; if(under) hasU=true; q.moveTo(a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0); q.lineTo(a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1); }
          u+=dl; } }
    }
    L._path=p; L._pA=pA; L._pU=hasU?pU:null;
  }
}
