/* ================= city generation ================= */
function generate(seed){
  const R=mulberry32(seed);
  const N1=makePerlin(R), N2=makePerlin(R), N3=makePerlin(R), N4=makePerlin(R);
  const n=W*H, rnd=(a,b)=>a+R()*(b-a);
  const usedRoots=new Set();
  // the random stream is consumed exactly as in earlier versions so saved cities keep the same terrain and places;
  // the actual name is then chosen from a separate hash sequence: unique in every language and fitting the ground
  const usedV1=new Set();
  const mkRoot=(x,y,city)=>{ let sd=null; for(let tr=0;tr<80;tr++){ const s0=Math.floor(R()*1e9); const parts=['zh','en','ja'].map(l=>rootNameV1(s0,l)); if(!parts.some(p=>usedV1.has(p))){ parts.forEach(p=>usedV1.add(p)); sd=s0; break; } } if(sd==null) sd=Math.floor(R()*1e9);
    let t=x==null?'land':terrainAt(x,y,water,e);
    if(city){ let wet=false, hl=false; for(let i=0;i<n;i+=3){ const xx=i%W, yy=(i/W)|0; if((xx-x)**2+(yy-y)**2>1600) continue; if(water[i]) wet=true; if(e[i]>0.5) hl=true; } t=wet?'sea':hl?'hill':'land'; }   // a city is named after its wider surroundings
    for(let k=0;k<400;k++){ const s2=hashInt(sd+k*7717+seed*31); const parts=['zh','en','ja'].map(l=>rootName(s2,l)); if(parts.some(p=>usedRoots.has(p))) continue; if(k<300&&!rootFits(s2,t,city)) continue; parts.forEach(p=>usedRoots.add(p)); return s2; }
    return hashInt(sd+seed); };

  // --- terrain: fbm noise tilted toward a coast direction
  const h=new Float32Array(n);
  const ang=R()*Math.PI*2, cdx=Math.cos(ang), cdy=Math.sin(ang), o1=R()*100, o2=R()*100;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const nx=(x-W/2)/W, ny=(y-H/2)/W;
    h[y*W+x]=fbm(N1,x*0.016+o1,y*0.016,5)*1.1-(nx*cdx+ny*cdy)*1.5+fbm(N2,x*0.045,y*0.045+o2,3)*0.25;
  }
  const sorted=Float32Array.from(h).sort();
  const sea=sorted[Math.floor(n*(0.3+R()*0.1))], hmax=sorted[n-1];
  const water=new Uint8Array(n); for(let i=0;i<n;i++) if(h[i]<sea) water[i]=1;
  const e=new Float32Array(n); for(let i=0;i<n;i++) e[i]=water[i]?0:(h[i]-sea)/(hmax-sea);

  // --- river: steepest descent from the hills to the sea
  const rivers=[];
  const dw0=distTransform(water);
  for(let tr=0;tr<40&&!rivers.length;tr++){
    const sx=Math.floor(R()*W), sy=Math.floor(R()*H), si=sy*W+sx;
    if(water[si]||e[si]<0.3||dw0[si]<28) continue;
    const path=[], vis=new Set(); let cx=sx, cy=sy, ok=false;
    for(let k=0;k<700;k++){
      path.push([cx,cy]); vis.add(cy*W+cx);
      let bi=-1,bv=1e9,bx=0,by=0;
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
        if(!ox&&!oy) continue; const nx=cx+ox, ny=cy+oy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni=ny*W+nx; if(vis.has(ni)) continue;
        const v=h[ni]+(R()-.5)*0.006; if(v<bv){ bv=v; bi=ni; bx=nx; by=ny; }
      }
      if(bi<0) break; cx=bx; cy=by;
      if(water[bi]===1){ path.push([cx,cy]); ok=true; break; }
    }
    if(ok&&path.length>40&&path.length<420) rivers.push(path);
  }
  rivers.forEach(p=>p.forEach(([x,y],k)=>{ const i=y*W+x; if(!water[i]) water[i]=2; if(k>p.length*0.55&&x+1<W&&!water[i+1]) water[i+1]=2; }));
  const dw=distTransform(water);
  const land=(x,y)=>{ x=Math.round(x); y=Math.round(y); return x>=0&&y>=0&&x<W&&y<H&&water[y*W+x]===0; };
  const ix=(x,y)=>clamp(Math.round(y),0,H-1)*W+clamp(Math.round(x),0,W-1);
  const pk=new Float32Array(n); for(let y=0;y<H;y++) for(let x=0;x<W;x++) pk[y*W+x]=fbm(N3,x*0.04,y*0.04,4);

  // --- main centre
  const seaMask=new Uint8Array(n); for(let i=0;i<n;i++) seaMask[i]=water[i]===1?1:0;
  const dws=distTransform(seaMask);                       // distance to the sea only (rivers don't count)
  const landAround=(x,y,r)=>{ let a=0,t=0; for(let k=0;k<24;k++){ const ang=k/24*Math.PI*2; for(const rr of [r*0.5,r]){ t++; if(land(x+Math.cos(ang)*rr,y+Math.sin(ang)*rr)) a++; } } return a/t; };
  let main=null, bs=-1e9; const seaTarget=rnd(16,34);
  for(let tr=0;tr<1400;tr++){
    const x=rnd(150,450), y=rnd(115,305), i=ix(x,y); if(!land(x,y)) continue;
    const s=Math.exp(-(((dws[i]-seaTarget)/12)**2))*1.2+landAround(x,y,22)*0.9+(1-dist(x,y,W/2,H/2)/(W/2))*0.6-e[i]*1.8+Math.exp(-dw[i]/4)*0.15*(water[i]===0?1:0)+R()*0.15;
    if(s>bs){ bs=s; main={x,y}; }
  }
  if(!main) main={x:W/2,y:H/2};
  const centers=[{x:main.x,y:main.y,w:0.85,s:13,name:{k:'downtown'},type:'main',ang:R()*Math.PI}];
  const nCore=2+Math.floor(R()*3);
  for(let k=0;k<nCore;k++){
    let best=null, b0=-1e9;
    for(let tr=0;tr<300;tr++){
      const a=R()*Math.PI*2, r=rnd(9,18), x=main.x+Math.cos(a)*r, y=main.y+Math.sin(a)*r, i=ix(x,y);
      if(!land(x,y)||e[i]>0.42) continue; let md=1e9; centers.forEach(c=>md=Math.min(md,dist(x,y,c.x,c.y))); if(md<8) continue;
      const sc=Math.min(md,16)/16+Math.min(dws[i],20)/30-e[i]+R()*0.3; if(sc>b0){ b0=sc; best={x,y}; }
    }
    if(best) centers.push({x:best.x,y:best.y,w:rnd(0.62,0.82),s:rnd(8,11),name:{s:mkRoot(best.x,best.y),k:'core'},type:'core',ang:R()*Math.PI});
  }
  const coreC=(()=>{ const cs=centers; return {x:cs.reduce((a,c)=>a+c.x,0)/cs.length,y:cs.reduce((a,c)=>a+c.y,0)/cs.length}; })();
  const nSub=5+Math.floor(R()*3);
  for(let k=0;k<nSub;k++){
    let best=null, b=-1e9;
    for(let tr=0;tr<400;tr++){
      const x=rnd(10,W-10), y=rnd(10,H-10), i=ix(x,y); if(!land(x,y)) continue;
      const dm=dist(x,y,main.x,main.y); if(dm<26||dm>(k===0?160:120)) continue;
      let md=1e9; centers.forEach(c=>md=Math.min(md,dist(x,y,c.x,c.y))); if(md<20) continue;
      const s=-e[i]*1.4+Math.min(md,70)/60+(k===0?dm/80:0)+R()*0.25;
      if(s>b){ b=s; best={x,y}; }
    }
    if(best) centers.push(k===0&&dist(best.x,best.y,main.x,main.y)>75?{x:best.x,y:best.y,w:0.85,s:14,name:{s:mkRoot(best.x,best.y),k:'newtown'},type:'twin',ang:R()*Math.PI}:{x:best.x,y:best.y,w:rnd(0.42,0.62),s:rnd(8,12),name:{s:mkRoot(best.x,best.y),k:'newtown'},type:'sub',ang:R()*Math.PI});
  }

  // --- railway station + intercity line that stays on land
  let st=null;
  for(let tr=0;tr<200&&!st;tr++){ const a=R()*Math.PI*2, r=rnd(5,12), x=main.x+Math.cos(a)*r, y=main.y+Math.sin(a)*r; if(land(x,y)&&e[ix(x,y)]<0.5) st={x,y}; }
  if(!st) st={x:main.x+3,y:main.y};
  const dryOrOut=(x,y)=>{ if(x<0||y<0||x>=W||y>=H) return true; return water[ix(x,y)]!==1; };
  const out=(x,y)=>x<-3||y<-3||x>W+3||y>H+3;
  const railWalk=(x,y,hd)=>{
    const seg=[], target=hd;
    for(let k=0;k<260;k++){
      let best=null, bsc=-1e9;
      for(const dh of [0,-0.12,0.12,-0.25,0.25,-0.4,0.4,-0.6,0.6,-0.85,0.85]){
        const hh=hd+dh, nx=x+Math.cos(hh)*2.5, ny=y+Math.sin(hh)*2.5;
        if(Math.abs(angDiff(hh,target))>1.5) continue;
        let clear=true; for(let q=0.5;q<=2.5;q+=0.5){ if(!dryOrOut(x+Math.cos(hh)*q,y+Math.sin(hh)*q)){ clear=false; break; } } if(!clear) continue;
        let ahead=0; for(let q=2;q<=6;q++) if(dryOrOut(x+Math.cos(hh)*2.5*q,y+Math.sin(hh)*2.5*q)) ahead++; else break;
        const sc=ahead*1.0-Math.abs(dh)*1.6-Math.abs(angDiff(hh,target))*0.6+R()*0.05;
        if(sc>bsc){ bsc=sc; best=[nx,ny,hh]; }
      }
      if(!best) break;
      x=best[0]; y=best[1]; hd=best[2]; seg.push([x,y]);
      if(out(x,y)) break;
    }
    return seg;
  };
  let railDir=R()*Math.PI*2, bestLen=-1;
  for(let tr=0;tr<6;tr++){ const d=R()*Math.PI*2; const a=railWalk(st.x,st.y,d), b=railWalk(st.x,st.y,d+Math.PI); const ok=(a.length&&out(...a[a.length-1])?1:0)+(b.length&&out(...b[b.length-1])?1:0); const sc=ok*1000+a.length+b.length; if(sc>bestLen){ bestLen=sc; railDir=d; } }
  const ra=railWalk(st.x,st.y,railDir+Math.PI), rb=railWalk(st.x,st.y,railDir);
  const rawRail=[...ra.reverse(),[st.x,st.y],...rb];
  const railDry=pts=>{ for(let k=1;k<pts.length;k++){ const a0=pts[k-1],b0=pts[k]; for(let q=0;q<=4;q++){ const x=lerp(a0[0],b0[0],q/4), y=lerp(a0[1],b0[1],q/4); if(!dryOrOut(x,y)) return false; } } return true; };
  let rail=chaikin(rawRail,2); if(!railDry(rail)) rail=chaikin(rawRail,1); if(!railDry(rail)) rail=rawRail;
  const distToRail=(x,y)=>{ let m=1e9; for(let k=0;k<rail.length;k+=3) m=Math.min(m,dist(x,y,rail[k][0],rail[k][1])); return m; };

  // --- airport
  let ap=null, b=-1e9;
  for(let pass=0;pass<3&&!ap;pass++){
    const dmin=[55,40,26][pass], dmax=[140,170,220][pass], emax=[0.32,0.45,0.7][pass];
    for(let tr=0;tr<900;tr++){
      const x=rnd(116,484), y=rnd(86,334); if(!land(x,y)) continue;
      const dm=dist(x,y,main.x,main.y); if(dm<dmin||dm>dmax) continue;
      const a=R()*Math.PI; let ok=true;
      for(let u=-9;u<=9&&ok;u+=1.5) for(let v=-4;v<=4&&ok;v+=2){ const px=x+Math.cos(a)*u-Math.sin(a)*v, py=y+Math.sin(a)*u+Math.cos(a)*v; if(!land(px,py)||e[ix(px,py)]>emax+0.08) ok=false; }
      if(!ok) continue;
      let md=1e9; centers.forEach(c=>md=Math.min(md,dist(x,y,c.x,c.y)));
      const s=Math.min(md,40)-dm*0.15+R()*8; if(s>b){ b=s; ap={x,y,a}; }
    }
  }
  if(!ap) ap={x:clamp(main.x+50,116,484),y:main.y,a:0};
  ap.term={x:ap.x-Math.sin(ap.a)*5.5, y:ap.y+Math.cos(ap.a)*5.5};
  if(!land(ap.term.x,ap.term.y)) ap.term={x:ap.x+Math.sin(ap.a)*5.5, y:ap.y-Math.cos(ap.a)*5.5};

  // --- coach station
  let coach=null; b=-1e9;
  for(let tr=0;tr<400;tr++){
    const a=R()*Math.PI*2, r=rnd(14,26), x=main.x+Math.cos(a)*r, y=main.y+Math.sin(a)*r; if(!land(x,y)||e[ix(x,y)]>0.45) continue;
    if(dist(x,y,st.x,st.y)<10) continue;
    let s=R(); centers.slice(1).forEach(c=>{ const ca=Math.atan2(c.y-main.y,c.x-main.x); s+=Math.cos(angDiff(a,ca))>0.85?1:0; });
    if(s>b){ b=s; coach={x,y}; }
  }
  if(!coach) coach={x:main.x-8,y:main.y+8};

  // --- plazas, industrial parks, villages
  const plazas=[];
  for(let tr=0;tr<300&&plazas.length<14;tr++){
    const c=centers[R()<0.45?0:Math.floor(R()*centers.length)];
    const x=c.x+(R()+R()+R()-1.5)*c.s*0.9, y=c.y+(R()+R()+R()-1.5)*c.s*0.9;
    if(!land(x,y)||plazas.some(p=>dist(p.x,p.y,x,y)<8)) continue;
    plazas.push({x,y,name:{s:mkRoot(x,y),k:'plaza'}});
  }
  const inds=[];
  for(let tr=0;tr<1200&&inds.length<7;tr++){
    const x=rnd(8,W-8), y=rnd(8,H-8); if(!land(x,y)||e[ix(x,y)]>0.35) continue;
    const dm=dist(x,y,main.x,main.y); if(dm<30||dm>130||distToRail(x,y)>16) continue;
    if(inds.some(p=>dist(p.x,p.y,x,y)<20)||dist(x,y,ap.x,ap.y)<14) continue;
    inds.push({x,y,name:{s:mkRoot(x,y),k:'ind'}});
  }
  const villages=[];
  for(let tr=0;tr<7000&&villages.length<95;tr++){
    const x=rnd(4,W-4), y=rnd(4,H-4); if(!land(x,y)||e[ix(x,y)]>0.62) continue;
    let md=1e9; centers.forEach(c=>md=Math.min(md,dist(x,y,c.x,c.y)/(c.s/12)));
    if(md<34||villages.some(v=>dist(v.x,v.y,x,y)<13)||dist(x,y,ap.x,ap.y)<11) continue;
    villages.push({x,y,name:{s:mkRoot(x,y),k:R()<0.5?'town':'village'},s:rnd(1.8,3),w:rnd(0.2,0.38),ang:R()*Math.PI});
  }

  // --- residential attractiveness → population density D
  const g=(x,y,c,s)=>{ const d2=(x-c.x)**2+(y-c.y)**2; return d2>18*s*s?0:Math.exp(-d2/(2*s*s)); };   // beyond 4.2σ the tail is < 1e-4
  const D=new Float32Array(n), J=new Float32Array(n), PL=new Float32Array(n), VL=new Float32Array(n);
  const addBlob=(arr,c,sig,amp,mode)=>{ const R3=Math.ceil(sig*3.2); for(let y=Math.max(0,Math.floor(c.y-R3));y<=Math.min(H-1,Math.ceil(c.y+R3));y++) for(let x=Math.max(0,Math.floor(c.x-R3));x<=Math.min(W-1,Math.ceil(c.x+R3));x++){ const v=amp*Math.exp(-((x-c.x)**2+(y-c.y)**2)/(2*sig*sig)); const i=y*W+x; if(mode) arr[i]=Math.max(arr[i],v); else arr[i]+=v; } };
  for(const p of plazas) addBlob(PL,p,3.5,0.22,0);
  for(const v of villages) addBlob(VL,v,v.s,v.w,1);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x; if(water[i]) continue;
    let A=0.85*g(x,y,main,13)+0.35*g(x,y,main,5)+0.24*g(x,y,coreC,40);
    for(let k=1;k<centers.length;k++){ const c=centers[k]; A+=c.w*g(x,y,c,c.s)+(c.type==='core'?0.3*c.w*g(x,y,c,4.5):0); }
    A+=0.3*Math.exp(-(dw[i]-1)/3.2)*(0.4+0.6*Math.min(1,A*3));
    A+=0.16*smooth(pk[i],0.12,0.42)*Math.min(1,A*4);
    A+=PL[i];
    A+=0.14*fbm(N4,x*0.07,y*0.07,3);
    A-=Math.max(0,e[i]-0.4)*2.2;
    let d=smooth(A,0.12,1.15);
    d=Math.max(d,VL[i]);
    d*=1-0.85*smooth(pk[i],0.26,0.31);
    const ad=dist(x,y,ap.x,ap.y); if(ad<14) d*=smooth(ad,9,14);
    D[i]=d;
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=y*W+x; if(water[i]) continue;
    let j=1.3*g(x,y,main,5)+0.4*g(x,y,main,13);
    for(let k=1;k<centers.length;k++){ const c=centers[k]; j+=c.type==='core'?1.1*c.w*g(x,y,c,5)+0.35*c.w*g(x,y,c,12):0.6*c.w*g(x,y,c,7); }
    j+=0.45*g(x,y,st,4)+0.8*g(x,y,ap,6)+0.25*g(x,y,coach,3);
    for(const p of inds) j+=0.55*g(x,y,p,5);
    j+=0.18*D[i];
    J[i]=j;
  }
  let sumD=0; for(let i=0;i<n;i++) sumD+=D[i];

  // --- road network: least-cost routes over the terrain that merge into shared corridors
  const roadUse=new Uint8Array(n);            // 0 none, 1 local, 2 arterial, 3 highway
  const gC=new Float32Array(n), prev=new Int32Array(n), stamp=new Int32Array(n), closedS=new Int32Array(n); let run=0;
  const astar=(sx,sy,tx,ty)=>{
    const s0=ix(sx,sy), t0=ix(tx,ty); if(s0===t0) return null; run++;
    const G_=i=>stamp[i]===run?gC[i]:Infinity, P_=i=>stamp[i]===run?prev[i]:-1;
    const closed={get:i=>closedS[i]===run};
    const tX=t0%W, tY=(t0/W)|0, hh=i=>Math.hypot(i%W-tX,((i/W)|0)-tY)*0.75, sX=s0%W, sY=(s0/W)|0;
    const wx0=Math.max(0,Math.min(sX,tX)-60), wx1=Math.min(W-1,Math.max(sX,tX)+60), wy0=Math.max(0,Math.min(sY,tY)-60), wy1=Math.min(H-1,Math.max(sY,tY)+60);   // search window
    gC[s0]=0; prev[s0]=-1; stamp[s0]=run; HPQ.n=0; hqPush(hh(s0),s0);
    const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
    while(HPQ.n){
      const u=hqPop(); if(closedS[u]===run) continue; closedS[u]=run; if(u===t0) break;
      const ux=u%W, uy=(u/W)|0;
      for(const [dx,dy,dl] of NB){
        const vx=ux+dx, vy=uy+dy; if(vx<wx0||vy<wy0||vx>wx1||vy>wy1) continue; const v=vy*W+vx; if(closedS[v]===run) continue;
        let m=water[v]===1?28:water[v]===2?6:1+5*Math.max(0,e[v]-0.35)+2.5*smooth(pk[v],0.26,0.31);
        const ru=roadUse[v]; if(ru) m=Math.min(m,ru>=2?0.3:0.45);
        const ng=G_(u)+dl*m; if(ng<G_(v)){ gC[v]=ng; prev[v]=u; stamp[v]=run; hqPush(ng+hh(v),v); }
      }
    }
    if(P_(t0)<0) return null;
    const cells=[]; for(let u=t0;u!==-1;u=P_(u)) cells.push(u); cells.reverse(); return cells;
  };
  const roads={hwy:[],art:[],loc:[]};
  const route=(a,b,cls)=>{
    const cells=astar(a.x,a.y,b.x,b.y); if(!cells) return;
    const lv=cls==='hwy'?3:cls==='art'?2:1;
    // keep only the stretch that is new road; reused corridors are already drawn
    let cur=[];
    const flush=()=>{ if(cur.length>1){ let pts=cur.map(i=>[i%W,(i/W)|0]); pts=chaikin(rdp(pts,0.7),2); roads[cls].push(pts); } cur=[]; };
    for(let k=0;k<cells.length;k++){ const c=cells[k]; const had=roadUse[c];
      if(had>=lv&&k>0&&k<cells.length-1){ if(cur.length){ cur.push(c); flush(); } continue; }
      if(!cur.length&&k>0) cur.push(cells[k-1]);
      cur.push(c); if(had<lv) roadUse[c]=lv; }
    flush();
  };
  // exits: land cells on the map edge, spread apart
  const exits=[];
  for(let tr=0;tr<600&&exits.length<5;tr++){
    const side=Math.floor(R()*4), u=R(); const x=side<2?u*(W-1):(side===2?0:W-1), y=side<2?(side===0?0:H-1):u*(H-1);
    if(!land(x,y)||e[ix(x,y)]>0.55) continue; if(exits.some(p=>dist(p.x,p.y,x,y)<110)) continue; exits.push({x,y});
  }
  const twin=centers.find(c=>c.type==='twin'); if(twin) route(main,twin,'hwy');
  for(const ex of exits.slice(0,4)) route(main,ex,'hwy');
  route(main,ap.term,'hwy');
  const cores=centers.filter(c=>c.type==='core'); for(const c of cores) route(main,c,'art');
  for(let k=0;k<cores.length;k++){ const a=cores[k], b=cores[(k+1)%cores.length]; if(cores.length>1&&dist(a.x,a.y,b.x,b.y)<26) route(a,b,'art'); }
  for(const c of centers.filter(c=>c.type==='sub'||c.type==='twin')){ let best=main,bd=dist(c.x,c.y,main.x,main.y); for(const o of cores){ const d=dist(c.x,c.y,o.x,o.y); if(d<bd){ bd=d; best=o; } } route(best,c,'art'); }
  route(main,st,'art'); route(main,coach,'art');
  for(const p of inds){ let best=main,bd=dist(p.x,p.y,main.x,main.y); for(const c of centers){ const d=dist(p.x,p.y,c.x,c.y); if(d<bd){bd=d;best=c;} } route(best,p,'art'); }
  // ring road through land points around the centre
  { const rr=rnd(17,22), pts=[]; for(let k=0;k<10;k++){ const a=k*Math.PI/5+0.2; const p={x:main.x+Math.cos(a)*rr,y:main.y+Math.sin(a)*rr}; if(land(p.x,p.y)) pts.push(p); }
    if(pts.length>=6) for(let k=0;k<pts.length;k++){ const a=pts[k], b=pts[(k+1)%pts.length]; if(dist(a.x,a.y,b.x,b.y)<rr*1.4) route(a,b,'art'); } }
  // villages join the network: each links to the nearest already-connected place, plus a few loops
  const linked=[main,...centers.slice(1),st,coach,...inds]; const pending=villages.slice();
  while(pending.length){
    let bi=0,bt=null,bd=1e9;
    pending.forEach((v,k)=>{ for(const o of linked){ const d=dist(v.x,v.y,o.x,o.y); if(d<bd){ bd=d; bi=k; bt=o; } } });
    const v=pending.splice(bi,1)[0]; route(v,bt,'loc'); linked.push(v);
  }
  for(const v of villages){ const others=villages.filter(o=>o!==v).sort((a,b)=>dist(v.x,v.y,a.x,a.y)-dist(v.x,v.y,b.x,b.y)); const o=others[1]; if(o&&dist(v.x,v.y,o.x,o.y)<38&&R()<0.45) route(v,o,'loc'); }
  const arterials=roads.art, highways=roads.hwy, locals=roads.loc;

  const districts=[...centers,...villages];
  const dist_i=new Uint8Array(n);
  { const dx_=districts.map(c=>c.x), dy_=districts.map(c=>c.y), is2=districts.map(c=>1/((c.s||3)*(c.s||3))), K=districts.length;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ let bi=0,bd=1e18; for(let k=0;k<K;k++){ const ax=x-dx_[k], ay=y-dy_[k], d=(ax*ax+ay*ay)*is2[k]; if(d<bd){ bd=d; bi=k; } } dist_i[y*W+x]=bi; } }

  const B=STAGES[0], citySeed=mkRoot(main.x,main.y,true);
  let sumIn=0; for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++) sumIn+=D[y*W+x];
  const Gl={seed,h,sea,hmax,water,e,dw,pk,D,J,centers,plazas,inds,villages,districts,dist_i,rivers,rail,arterials,highways,locals,
    fac:{station:st,airport:ap,coach},popTotal:sumIn*900,citySeed,bounds:B.slice(),stage:0,roadUse,extraRoads:[],projects:[],lastProj:0};
  Gl.agents=buildAgents(Gl,B,STAGE_AGENTS[0],R);
  return Gl;
}
// residents & trips inside the open part of the map (gravity model)
function buildAgents(Gl,B,N,R){
  const {D,J,water}=Gl, ap=Gl.fac.airport, st=Gl.fac.station, coach=Gl.fac.coach, main=Gl.centers[0];
  const cells=[], cD=[], cJ=[]; let sd=0, sj=0;
  for(let y=Math.max(0,B[1]);y<Math.min(H,B[3]);y++) for(let x=Math.max(0,B[0]);x<Math.min(W,B[2]);x++){ const i=y*W+x; if(water[i]) continue; cells.push(i); sd+=D[i]; sj+=J[i]; cD.push(sd); cJ.push(sj); }
  const pick=(c)=>{ const r=R()*c[c.length-1]; let lo=0,hi=c.length-1; while(lo<hi){ const m=(lo+hi)>>1; if(c[m]<r) lo=m+1; else hi=m; } return cells[lo]; };
  const cellPt=(i)=>[ (i%W)+R()-.5, Math.floor(i/W)+R()-.5 ];
  const plz=Gl.plazas.filter(p=>p.x>B[0]&&p.x<B[2]&&p.y>B[1]&&p.y<B[3]);
  const agents=[];
  for(let a=0;a<N;a++){
    const [hx,hy]=cellPt(pick(cD)); let wx,wy, kind='commute'; const r=R();
    if(r<0.06){ wx=ap.term.x+R()*2-1; wy=ap.term.y+R()*2-1; kind='airport'; }
    else if(r<0.13){ wx=st.x+R()-.5; wy=st.y+R()-.5; kind='rail'; }
    else if(r<0.17){ wx=coach.x+R()-.5; wy=coach.y+R()-.5; kind='coach'; }
    else if(r<0.25){ const p=plz[Math.floor(R()*plz.length)]||main; wx=p.x+R()*3-1.5; wy=p.y+R()*3-1.5; kind='leisure'; }
    else { for(let tr=0;tr<25;tr++){ [wx,wy]=cellPt(pick(cJ)); if(R()<Math.exp(-dist(hx,hy,wx,wy)/70)) break; } }
    if(dist(hx,hy,wx,wy)<4){ a--; continue; }
    const ag={hx,hy,wx,wy,kind}; tripProps(ag,D,water); ag.t0=roadTime(ag,1); agents.push(ag);
  }
  return agents;
}
function tripProps(a,D,water){
  const dd=dist(a.hx,a.hy,a.wx,a.wy); let dens=0, wet=0;
  for(let k=0;k<=15;k++){ const tt=k/15, px=lerp(a.hx,a.wx,tt), py=lerp(a.hy,a.wy,tt), i=clamp(Math.round(py),0,H-1)*W+clamp(Math.round(px),0,W-1); if(k%2===0) dens+=Math.min(D[i],1.3); if(water[i]===1) wet++; }
  dens/=8; const wcells=wet/16*dd;
  a.dd=dd; a.dens=dens; a.dRoad=dd*1.3+wcells*1.2+(wcells>dd*0.35?wcells*1.5:0);
}
function roadTime(a,load){ return CAR_OVERHEAD + a.dRoad*(1+CONG*a.dens*load)/CAR_V; }
