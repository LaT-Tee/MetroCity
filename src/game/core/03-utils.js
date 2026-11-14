/* ================= utils ================= */
const clamp = (v,a,b)=> v<a?a:v>b?b:v;
const lerp = (a,b,t)=> a+(b-a)*t;
const smooth = (x,a,b)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const dist = (ax,ay,bx,by)=> Math.hypot(ax-bx, ay-by);
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makePerlin(rand){
  const perm=[...Array(256).keys()];
  for(let i=255;i>0;i--){ const j=Math.floor(rand()*(i+1)); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
  const p=new Uint8Array(512); for(let i=0;i<512;i++) p[i]=perm[i&255];
  const GX=[1,-1,1,-1,1,-1,0,0], GY=[1,1,-1,-1,0,0,1,-1];
  const fade=t=>t*t*t*(t*(t*6-15)+10);
  const g=(h,dx,dy)=>{ h&=7; return GX[h]*dx+GY[h]*dy; };
  return (x,y)=>{
    const X=Math.floor(x), Y=Math.floor(y), xf=x-X, yf=y-Y, xi=X&255, yi=Y&255;
    const aa=p[p[xi]+yi], ab=p[p[xi]+yi+1], ba=p[p[xi+1]+yi], bb=p[p[xi+1]+yi+1];
    const u=fade(xf), v=fade(yf);
    return lerp(lerp(g(aa,xf,yf),g(ba,xf-1,yf),u), lerp(g(ab,xf,yf-1),g(bb,xf-1,yf-1),u), v);
  };
}
function fbm(n,x,y,o){ let a=1,f=1,s=0,t=0; for(let i=0;i<o;i++){ s+=a*n(x*f,y*f); t+=a; a*=.5; f*=2.03; } return s/t; }
function distTransform(mask){
  const d=new Float32Array(W*H);
  for(let i=0;i<W*H;i++) d[i]=mask[i]?0:1e9;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; let v=d[i];
    if(x>0) v=Math.min(v,d[i-1]+1);
    if(y>0){ v=Math.min(v,d[i-W]+1); if(x>0) v=Math.min(v,d[i-W-1]+1.414); if(x<W-1) v=Math.min(v,d[i-W+1]+1.414); }
    d[i]=v; }
  for(let y=H-1;y>=0;y--) for(let x=W-1;x>=0;x--){ const i=y*W+x; let v=d[i];
    if(x<W-1) v=Math.min(v,d[i+1]+1);
    if(y<H-1){ v=Math.min(v,d[i+W]+1); if(x<W-1) v=Math.min(v,d[i+W+1]+1.414); if(x>0) v=Math.min(v,d[i+W-1]+1.414); }
    d[i]=v; }
  return d;
}
function bilinear(arr,fx,fy){
  fx=clamp(fx,0,W-1.001); fy=clamp(fy,0,H-1.001);
  const x0=fx|0, y0=fy|0, tx=fx-x0, ty=fy-y0, i=y0*W+x0;
  return (arr[i]*(1-tx)+arr[i+1]*tx)*(1-ty)+(arr[i+W]*(1-tx)+arr[i+W+1]*tx)*ty;
}
function chaikin(pts,it){ for(let k=0;k<it;k++){ if(pts.length<3) return pts; const o=[pts[0]]; for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1]; o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]); } o.push(pts[pts.length-1]); pts=o; } return pts; }
function rdp(pts,eps){ if(pts.length<3) return pts; const keep=new Uint8Array(pts.length); keep[0]=keep[pts.length-1]=1; const st=[[0,pts.length-1]];
  while(st.length){ const [i,j]=st.pop(); let md=0,mi=-1; const ax=pts[i][0],ay=pts[i][1],bx=pts[j][0],by=pts[j][1]; const L=Math.hypot(bx-ax,by-ay)||1e-9;
    for(let k=i+1;k<j;k++){ const d=Math.abs((bx-ax)*(ay-pts[k][1])-(ax-pts[k][0])*(by-ay))/L; if(d>md){md=d;mi=k;} }
    if(md>eps&&mi>0){ keep[mi]=1; st.push([i,mi],[mi,j]); } }
  return pts.filter((_,k)=>keep[k]); }
function angDiff(a,b){ let d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }
function hpush(h,it){ h.push(it); let i=h.length-1; while(i>0){ const p=(i-1)>>1; if(h[p][0]<=h[i][0]) break; const t=h[p]; h[p]=h[i]; h[i]=t; i=p; } }
function hpop(h){ const top=h[0], last=h.pop(); if(h.length){ h[0]=last; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<h.length&&h[l][0]<h[m][0]) m=l; if(r<h.length&&h[r][0]<h[m][0]) m=r; if(m===i) break; const t=h[m]; h[m]=h[i]; h[i]=t; i=m; } } return top; }

// write markup only when it actually changed: rebuilding unchanged DOM costs layout and style work for nothing
function setHTML(el,html){ if(!el) return; if(el._h!==html){ el.innerHTML=html; el._h=html; } }
// is this point in the water, or within m cells of it? The coast comes from the height field and the rivers from their
// own distance field, both read between the cells, so the answer follows the drawn shoreline rather than whole cells
function wetAt(x,y,m){ m=m||0; if(x<0||y<0||x>W-1||y>H-1) return true; if(bilinear(G.h,x,y)<G.sea+0.004+m*0.012) return true; return !!G.rivSD&&bilinear(G.rivSD,x,y)<m; }
// Chance in the simulation is drawn from the city's seed and the month, not from the clock: the same city in the same month
// goes the same way however often the page is reloaded, so what the assistant advises does not change from one visit to the next.
function simRand(salt){ return mulberry32((Math.imul((G&&G.seed)|0,0x9E3779B1)^Math.imul(((typeof months==='number'?months:0)+1)|0,40503)^Math.imul(salt|0,0x85EBCA6B))>>>0); }
// distance from a point to the main-line railway (its centre line), measured to the segments, not to sample points
function railDist(x,y){ const rl=G&&G.rail; if(!rl||rl.length<2) return 1e9; let B=G._railBins; if(!B||B.n!==rl.length){ B=G._railBins=new Map(); B.n=rl.length; for(let k=1;k<rl.length;k++){ const a=rl[k-1], b=rl[k]; for(let gy=Math.floor(Math.min(a[1],b[1])/4);gy<=Math.floor(Math.max(a[1],b[1])/4);gy++) for(let gx=Math.floor(Math.min(a[0],b[0])/4);gx<=Math.floor(Math.max(a[0],b[0])/4);gx++){ const kk=gy*1000+gx; let l=B.get(kk); if(!l) B.set(kk,l=[]); l.push(k); } } }
  let best=1e9; const gx=Math.floor(x/4), gy=Math.floor(y/4); for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){ const l=B.get((gy+oy)*1000+gx+ox); if(!l) continue; for(const k of l){ const a=rl[k-1], b=rl[k], dx=b[0]-a[0], dy=b[1]-a[1], t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1e-9),0,1), d=Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t); if(d<best) best=d; } } return best; }
// how far a point is from the water's edge, in cells: negative in the sea, a lake or a river, positive on land
function waterSD(x,y){ if(x<0||y<0||x>W-1||y>H-1) return -1; let d=(bilinear(G.h,x,y)-G.sea-0.004)/0.012; if(G.rivSD){ const r=bilinear(G.rivSD,x,y); if(r<d) d=r; } return d; }
// is the ground an airport at (x,y), runways along a, would pave all dry? wsd(x,y) is the distance from water. Returns bit 1 for the
// airfield itself, bits 2 and 4 for the terminal and its apron on either side.
function airDry(x,y,a,wsd){ const ca=Math.cos(a), sa=Math.sin(a), at=(lx,lz)=>wsd(x+ca*lx-sa*lz,y+sa*lx+ca*lz)>0.1; let r=7;
  for(let lx=-10;lx<=10&&(r&1);lx+=0.5) for(let lz=-3.4;lz<=3;lz+=0.4) if(!at(lx,lz)){ r&=~1; break; }
  for(const [bit,ts] of [[2,1],[4,-1]]) for(let lx=-4.8;lx<=4.8&&(r&bit);lx+=0.6) for(let lz=3;lz<=7.4;lz+=0.4) if(!at(lx,ts*lz)){ r&=~bit; break; }
  return r; }
// the nearest dry ground to a point (itself if it is dry): rings outward, the first ring with dry ground wins. m is the margin kept from the water.
function dryNear(x,y,m,rmax){ m=m||0.2; if(waterSD(x,y)>=m) return [x,y]; for(let r=0.25;r<=(rmax||6);r+=0.25){ let best=null, bd=-1; const n=Math.max(8,Math.round(r*10)); for(let k=0;k<n;k++){ const a=k/n*6.2832, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r, d=waterSD(px,py); if(d>=m&&d>bd){ bd=d; best=[px,py]; } } if(best) return best; } return null; }
/* The ground an airport takes, as a mask over the cells. Bit 1 is the airfield itself (runways, taxiways, apron) and the
   terminal block: nothing else exists there, no street crosses it, nothing is built, planted or laid out as a park.
   Bit 2 is the precinct round it and in front of the terminal: the access road comes in here, but nothing is built or
   planted. Everything that puts things on the map asks this mask, so an airport is never something else as well. */
function airFrame(ap){ const ca=Math.cos(ap.a), sa=Math.sin(ap.a), tz=(ap.term.x-ap.x)*-sa+(ap.term.y-ap.y)*ca, ts=tz>=0?1:-1; return {ca,sa,tz:Math.abs(tz),ts}; }
// where the road from the city arrives: in front of the terminal, on the side away from the runways
function airGate(ap){ const f=airFrame(ap), d=f.tz+1.7; return {x:ap.x-f.sa*f.ts*d,y:ap.y+f.ca*f.ts*d}; }
function airMaskOf(list){ const m=new Uint8Array(W*H);
  for(const ap of list){ const f=airFrame(ap);
    for(let y=Math.max(0,Math.floor(ap.y-15));y<=Math.min(H-1,Math.ceil(ap.y+15));y++) for(let x=Math.max(0,Math.floor(ap.x-15));x<=Math.min(W-1,Math.ceil(ap.x+15));x++){
      const dx=x-ap.x, dy=y-ap.y, lx=dx*f.ca+dy*f.sa, lz=(-dx*f.sa+dy*f.ca)*f.ts; if(Math.abs(lx)>12.6||lz<-5.2||lz>f.tz+2.8) continue;
      m[y*W+x]|=(Math.abs(lx)<=11.9&&lz>=-4.5&&lz<f.tz-0.4)||(Math.abs(lx)<=4.8&&lz<f.tz+1.3)?1:2; } }
  return m; }
