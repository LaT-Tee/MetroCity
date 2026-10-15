/* ---------- base raster (re-rendered progressively as the city grows) ---------- */
const LIGHT_PAL={sea:[230,242,250],sh:[240,248,253],land:[251,251,248],urb:[233,235,241],park:[217,239,216],forest:[207,231,204],hill:[228,233,218],str:[223,225,236]};
function baseSetup(o){
  o=o||{}; C=readColors();
  const ox=o.ox||0, oy=o.oy||0, cw=o.cw||W, ch=o.ch||H, P=o.ppc||BS, bw=Math.round(cw*P), bh=Math.round(ch*P);
  const tgt=o.ctx||bctx; if(!o.ctx&&base.width!==bw){ base.width=bw; base.height=bh; }
  const c=o.pal||{sea:C.rgb('sea'),sh:C.rgb('sea-shallow'),land:C.rgb('land'),urb:C.rgb('urban'),park:C.rgb('park'),forest:C.rgb('forest'),hill:C.rgb('hill'),str:C.rgb('street')};
  return {ox,oy,P,bw,bh,img:tgt.createImageData(bw,bh),row:0,D:Float32Array.from(G.D),c,urban:!!o.urban};
}
function baseRows(job,count){
  const {ox,oy,P,bw,bh,img,D,c,urban}=job, px=img.data, {h,sea,hmax,pk}=G;
  let r,g,b; const mix=(cc,tt)=>{ r+=(cc[0]-r)*tt; g+=(cc[1]-g)*tt; b+=(cc[2]-b)*tt; };
  const end=Math.min(bh,job.row+count);
  for(let py=job.row;py<end;py++){
    const fy=oy+(py+0.5)/P-0.5;
    for(let pxx=0;pxx<bw;pxx++){
      const fx=ox+(pxx+0.5)/P-0.5, hv=bilinear(h,fx,fy), landT=smooth((hv-sea)/0.006,-0.5,0.5);
      r=c.sh[0]; g=c.sh[1]; b=c.sh[2]; mix(c.sea,smooth(sea-hv,0,0.05)); const wr=r,wg=g,wb=b;
      r=c.land[0]; g=c.land[1]; b=c.land[2];
      mix(c.hill,smooth((hv-sea)/(hmax-sea),0.42,0.8)*0.95);
      const dv=urban?Math.max(0,bilinear(D,fx,fy)):0, pv=bilinear(pk,fx,fy);
      const park=smooth(pv,0.26,0.31), forest=smooth(pv,0.12,0.22)*(1-smooth(dv,0.04,0.18)), gr=Math.max(park,forest*0.75);
      mix(park>forest?c.park:c.forest,gr);
      if(urban) mix(c.urb,smooth(dv,0.03,0.65)*(1-gr)*0.9);
      if(dv>1){ const k=smooth(dv,1,2.2)*0.13*(1-gr); r*=1-k; g*=1-k; b*=1-k*0.7; }
      const o=(py*bw+pxx)*4;
      px[o]=wr+(r-wr)*landT; px[o+1]=wg+(g-wg)*landT; px[o+2]=wb+(b-wb)*landT; px[o+3]=255;
    }
  }
  job.row=end; return end>=bh;
}
function renderBase(){ baseJob=null; baseFadeAt=0; const j=baseSetup(); baseRows(j,j.bh); bctx.putImageData(j.img,0,0); growth.lastBaseD=j.D; layerVer++; G.landT=null; buildHeat(); }
function startBaseJob(){ if(baseJob) return; baseJob=baseSetup(); growth.lastBaseD=baseJob.D; growth.lastBaseT=performance.now(); }
