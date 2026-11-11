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
