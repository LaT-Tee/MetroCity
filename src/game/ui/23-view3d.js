/* ---------- 3D view (computers only): sit by the window of a real-looking city ----------
   Three.js is fetched only when someone opens the 3D view on a computer, so phones and the map never pay for it.
   1 unit = 1 cell (150 m); x and z are the map's x and y, y is up. Everything is built from the game's own city:
   the land (grass, parks, woods, sea, lakes and rivers), the street web, the buildings (houses with pitched roofs in
   the suburbs, apartment and office blocks, glass towers downtown, sheds by the industrial estates), trees in the
   parks and woods, and the metro on concrete viaducts with rails, overhead wires, platforms and proper trains. */
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const w3d={ready:false,loading:false,T:null,active:false,sig:'',bc:null,labels:[],objs:[],local:[],gnd:[],trash:[],lj:null,gj:null};
const TRK=0.08, BZ3=1.2, DECK=0.03, UGY=-0.075, TUN_W=0.036, TUN_H=0.046;   // deck ~12 m up, half-width ~4.5 m; tunnels ~11 m down
const W3D_CAR=0.12, W3D_GAP=0.006, W3D_CARS=5, W3D_TO=0.0125;      // W3D_TO: each line is double track, one track this far either side of its centre
async function w3dStart(){
  w3d.active=true; const box=$('#cv3d'); box.hidden=false;
  if(w3d.ready){ w3dBuild(); return; } if(w3d.loading) return; w3d.loading=true;
  box.innerHTML=`<div class="note">${t('w3dLoading')}</div>`;
  try{ w3d.T=await import(/* @vite-ignore */ THREE_URL); }catch(e){ w3d.loading=false; box.hidden=true; box.innerHTML=''; watch.view='2d'; toast(t('w3dFail')); renderWatchBar(); return; }
  w3d.loading=false; if(!w3d.active){ box.hidden=true; return; }
  const T=w3d.T, R=new T.WebGLRenderer({antialias:true,stencil:true,powerPreference:'high-performance'}); w3d.prMax=Math.min(dpr,1.5); w3d.pr=w3d.prMax; R.setPixelRatio(w3d.pr); R.outputColorSpace=T.SRGBColorSpace;
  R.toneMapping=T.ACESFilmicToneMapping; R.toneMappingExposure=0.95; R.shadowMap.enabled=true; R.shadowMap.type=T.PCFSoftShadowMap;
  box.innerHTML=''; box.appendChild(R.domElement);
  const S=new T.Scene(), cam3=new T.PerspectiveCamera(60,1,0.0015,120);
  const hemi=new T.HemisphereLight(0xd6e6ff,0x8e8d88,0.9), sun=new T.DirectionalLight(0xfff0dc,2.6); sun.castShadow=true; sun.shadow.mapSize.set(4096,4096);
  Object.assign(sun.shadow.camera,{left:-W3D_SH,right:W3D_SH,top:W3D_SH,bottom:-W3D_SH,near:0.5,far:50}); sun.shadow.bias=-0.00025; sun.shadow.normalBias=0.0035; sun.shadow.radius=1.6; S.add(hemi,sun,sun.target);
  Object.assign(w3d,{R,S,cam3,sun,hemi,ready:true,camPos:null,camTgt:null}); w3d.see=w3d.see||{value:new T.Vector4(0,0,0,0)}; w3d.seeE=w3d.seeE||{value:new T.Vector4(1,0,1,1)};
  R.domElement.addEventListener('pointerdown',e=>{ w3d.down=[e.clientX,e.clientY]; });
  R.domElement.addEventListener('pointerup',e=>{ if(!w3d.down||Math.hypot(e.clientX-w3d.down[0],e.clientY-w3d.down[1])>6) return; w3dTap(e.clientX,e.clientY); });
  w3dBuild(); }
function w3dStop(){ w3d.active=false; const box=$('#cv3d'); box.hidden=true; box.classList.remove('seat'); }
const W3D_SH=4.5;                    // the sun's shadows reach this many cells either side of the viewer
const w3dDark=()=>false;              // the 3D city is always seen by day, whatever the page theme
// ---- small geometry helpers: boxes with vertex colours merged into one geometry
function w3dMerge(parts){ const T=w3d.T, pos=[], nor=[], col=[];
  for(const p of parts){ const g=p.g.index?p.g.toNonIndexed():p.g; if(p.m) g.applyMatrix4(p.m); const P=g.attributes.position.array, N=g.attributes.normal.array, c=new T.Color(p.c);
    for(let i=0;i<P.length;i+=3){ pos.push(P[i],P[i+1],P[i+2]); nor.push(N[i],N[i+1],N[i+2]); col.push(c.r,c.g,c.b); } }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(col,3)); return g; }
const w3dBox=(w,h,d,x,y,z,c)=>{ const T=w3d.T; return {g:new T.BoxGeometry(w,h,d),m:new T.Matrix4().makeTranslation(x,y,z),c}; };
// a ribbon (or a low wall) following a polyline: half-width hw, top at y, thickness th
function w3dRibbon(pts,hw,y0,th){ const T=w3d.T, n=pts.length, pos=[], idx=[];
  for(let i=0;i<n;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dy=b[1]-a[1]; const l=Math.hypot(dx,dy)||1; dx/=l; dy/=l; const nx=-dy*hw, ny=dx*hw, x=pts[i][0], z=pts[i][1], y=y0+(pts[i][2]!=null?pts[i][2]-TRK:0);   /* a third coordinate is the track's own height there */
    pos.push(x+nx,y,z+ny, x-nx,y,z-ny, x+nx,y-th,z+ny, x-nx,y-th,z-ny); }
  for(let i=0;i<n-1;i++){ const o=i*4, q=o+4; idx.push(o,q,o+1, o+1,q,q+1, o,o+2,q, q,o+2,q+2, o+1,q+1,o+3, o+3,q+1,q+3, o+2,o+3,q+2, q+2,o+3,q+3); }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const w3dShared=tx=>!!tx&&['facadeTex','balconyTex','brickTex','ribbonTex','glassTex','dglassTex','shopTex','shedTex'].some(k=>w3d[k]===tx);
function w3dClear(list){ for(const m of list){ if(m.parent) m.parent.remove(m); m.traverse&&m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(mm=>{ if(mm.userData.keep) return; if(mm.map&&!w3dShared(mm.map)) mm.map.dispose(); if(mm.roughnessMap) mm.roughnessMap.dispose(); mm.dispose(); }); } }); } list.length=0; }
// ---- background work: heavy rebuilds run as generators a few milliseconds per frame, so the view never stalls
function w3dRun(job,budget){ const t0=performance.now(); while(job.it){ const r=job.it.next(); if(r.done){ job.it=null; if(r.value) r.value(); return true; } if(performance.now()-t0>budget) return false; } return true; }
function w3dAdd(m,list){ w3d.S.add(m); (list||w3d.objs).push(m); return m; }
// ---- textures drawn once: each is one window bay of one floor, repeated over a facade
function w3dTextures(){ const T=w3d.T; if(w3d.facadeTex) return;
  const tile=(draw,w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const tx=new T.CanvasTexture(c); tx.wrapS=tx.wrapT=T.RepeatWrapping; tx.colorSpace=T.SRGBColorSpace; tx.anisotropy=8; return tx; };
  // glass: the sky reflected at the top, the room dimly behind
  const pane=(g,x,y,w,h,top,bot)=>{ const gr=g.createLinearGradient(0,y,0,y+h); gr.addColorStop(0,top||'#9fb4c6'); gr.addColorStop(0.5,'#6d8193'); gr.addColorStop(1,bot||'#4a5866'); g.fillStyle=gr; g.fillRect(x,y,w,h);
    g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+w*0.45,y); g.lineTo(x+w*0.15,y+h); g.lineTo(x,y+h); g.fill(); };
  // plastered walls with framed windows and a sill
  w3d.facadeTex=tile((g,w,h)=>{ g.fillStyle='#f4f2ee'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.035)'; for(let i=0;i<60;i++) g.fillRect((i*37)%w,(i*53)%h,2,2);
    g.fillStyle='#d6d2ca'; g.fillRect(20,20,88,72); pane(g,25,25,78,62); g.fillStyle='#d6d2ca'; g.fillRect(62,25,4,62); g.fillStyle='#c9c4ba'; g.fillRect(16,92,96,6); g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(16,98,96,3); g.fillStyle='rgba(0,0,0,.05)'; g.fillRect(0,124,w,4); },128,128);
  // apartment block with balconies: sliding doors, a slab and a frosted railing in front
  w3d.balconyTex=tile((g,w,h)=>{ g.fillStyle='#efece6'; g.fillRect(0,0,w,h); pane(g,14,12,100,90,'#a9bccb','#55636f'); g.fillStyle='#cfcac2'; g.fillRect(62,12,4,90); g.fillRect(14,12,100,3);
    g.fillStyle='rgba(225,233,238,.86)'; g.fillRect(4,66,120,34); g.fillStyle='rgba(255,255,255,.5)'; g.fillRect(4,66,120,3); g.fillStyle='#b9bec2'; for(let x=8;x<124;x+=29) g.fillRect(x,66,2,34);
    g.fillStyle='#e2ded6'; g.fillRect(0,100,w,10); g.fillStyle='rgba(0,0,0,.16)'; g.fillRect(0,110,w,5); g.fillStyle='#e7e2d9'; g.fillRect(0,0,6,h); g.fillRect(122,0,6,h); },128,128);
  // brick with white window surrounds and a stone lintel
  w3d.brickTex=tile((g,w,h)=>{ g.fillStyle='#8f4c39'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=8){ for(let x=-(y/8%2)*8;x<w;x+=16){ const v=(x*7+y*13)%5; g.fillStyle=['#a35a43','#9a5440','#ad6249','#93503d','#a8604a'][v]; g.fillRect(x+1,y+1,14,6); } }
    g.fillStyle='#ece6dc'; g.fillRect(28,18,72,80); pane(g,33,23,62,70); g.fillStyle='#ece6dc'; g.fillRect(62,23,4,70); g.fillRect(33,56,62,3); g.fillStyle='#d9d1c4'; g.fillRect(24,12,80,7); g.fillRect(24,98,80,6); },128,128);
  // offices: continuous bands of glass between concrete spandrels
  w3d.ribbonTex=tile((g,w,h)=>{ g.fillStyle='#e4e6e8'; g.fillRect(0,0,w,h); pane(g,0,14,w,74,'#b3c6d6','#5a6b7a'); g.fillStyle='#8d979f'; for(let x=0;x<w;x+=32) g.fillRect(x,14,3,74);
    g.fillStyle='rgba(0,0,0,.10)'; g.fillRect(0,88,w,4); g.fillStyle='rgba(255,255,255,.4)'; g.fillRect(0,92,w,2); },128,128);
  // curtain wall: tall glass with thin mullions
  w3d.glassTex=tile((g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#b7cfe3'); gr.addColorStop(0.5,'#7c9cba'); gr.addColorStop(1,'#a9c3d9'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(0,0,w,10); g.fillStyle='#5c6d7e'; g.fillRect(0,h-6,w,6); g.fillRect(0,0,3,h); g.fillStyle='rgba(30,45,60,.25)'; g.fillRect(6,h-26,w-12,20); },64,128);
  // dark glass with pale vertical fins
  w3d.dglassTex=tile((g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#5d7f8a'); gr.addColorStop(1,'#2f4750'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.fillStyle='rgba(255,255,255,.12)'; g.fillRect(0,0,w,h*0.3);
    g.fillStyle='#d9dfe2'; g.fillRect(0,0,6,h); g.fillStyle='#9aa7ad'; g.fillRect(6,0,2,h); g.fillStyle='#24363e'; g.fillRect(0,h-8,w,8); },64,128);
  // shop fronts: two shops a bay, each with a sign band, an awning and a lit window
  w3d.shopTex=tile((g,w,h)=>{ g.fillStyle='#e9e5de'; g.fillRect(0,0,w,h); const signs=[['#c8423a','#f2c14e'],['#2f6fae','#ffffff']];
    for(let s=0;s<2;s++){ const x=s*128; g.fillStyle=signs[s][0]; g.fillRect(x+6,6,116,22); g.fillStyle=signs[s][1]; for(let i=0;i<5;i++) g.fillRect(x+20+i*18,13,11,8);
      for(let i=0;i<8;i++){ g.fillStyle=i%2?'#f4f1ea':signs[s][0]; g.beginPath(); g.moveTo(x+6+i*14.5,30); g.lineTo(x+6+(i+1)*14.5,30); g.lineTo(x+4+(i+1)*14.5,42); g.lineTo(x+4+i*14.5,42); g.fill(); }
      const gr=g.createLinearGradient(0,44,0,124); gr.addColorStop(0,'#fff1d2'); gr.addColorStop(1,'#d9b98c'); g.fillStyle=gr; g.fillRect(x+10,44,108,80); g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(x+10,44,40,80);
      g.fillStyle='#5b5f66'; g.fillRect(x+10,44,108,3); g.fillRect(x+62,44,3,80); g.fillStyle='rgba(60,50,40,.35)'; for(let i=0;i<4;i++) g.fillRect(x+16+i*24,96,16,24); } },256,128);
  // corrugated shed wall
  w3d.shedTex=tile((g,w,h)=>{ g.fillStyle='#d4d8dc'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=4){ g.fillStyle=x%8?'rgba(0,0,0,.05)':'rgba(255,255,255,.25)'; g.fillRect(x,0,2,h); } g.fillStyle='#8e9aa6'; g.fillRect(0,h-8,w,8); },64,64);
}
// a standard material whose texture repeats per window bay and per floor, whatever the box's size (aRep = bays across x, floors, bays across z)
function w3dFacadeMat(map,opt){ const T=w3d.T, m=new T.MeshStandardMaterial({map,...opt});
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aRep;').replace('#include <uv_vertex>',`#include <uv_vertex>
    vec2 rep = abs(normal.x)>0.5 ? aRep.zy : (abs(normal.y)>0.5 ? vec2(0.0) : aRep.xy);
    #ifdef USE_MAP
    vMapUv *= rep;
    #endif
`); };
  m.customProgramCacheKey=()=>'facade'; return m; }
// ---- buildings: a handful of facade kinds, each one material shared by every building of that kind
const W3D_HOUSE=[0xf3eee4,0xeae3d6,0xdcd6cc,0xefe4cf,0xe1e5e8,0xd9cdbd,0xc9d2d6,0xf0e2d8];
const W3D_ROOF=[0x9a4a36,0x7d4436,0x5a6068,0x4a5463,0x6b5a4e,0x3f4a57,0x8c8a86,0x6e3b33];
// facade kinds: [texture, bay width m, floor height m, colours to tint with, material options]
const W3D_KIND={
  plaster:['facadeTex',5,3.3,[0xf6f3ec,0xece6dc,0xe0dcd3,0xebe0cd,0xdde1e4,0xf1e7dc,0xd9d0c2],{roughness:0.85}],
  balcony:['balconyTex',6,3.1,[0xf6f2ea,0xe9e3d8,0xdde1e6,0xf0e5d3,0xd8dee2,0xe8dccb],{roughness:0.8}],
  brick:['brickTex',4.5,3.3,[0xffffff,0xf3ebe5,0xe6ddd6,0xfff4ea],{roughness:0.92}],
  ribbon:['ribbonTex',6,3.9,[0xeef0f2,0xe2e6ea,0xf4f3ef,0xd7dde2,0xe9e4dc],{roughness:0.35,metalness:0.08}],
  glass:['glassTex',3,3.9,[0xe6eff6,0xd4e2ec,0xe9f1f2,0xd6e6e2,0xdfe3ea],{roughness:0.08,metalness:0.35}],
  dglass:['dglassTex',3,4,[0xffffff,0xe6eef0,0xf2ece4],{roughness:0.08,metalness:0.4}],
  shop:['shopTex',7,4.5,[0xffffff,0xf7f2ea,0xf1f4f6],{roughness:0.55}],
  shed:['shedTex',8,9,[0xe6eaee,0xd9e1e8,0xc9d4de,0xe8e3d8],{roughness:0.6,metalness:0.2}] };
function w3dUnit(){ const g=new w3d.T.BoxGeometry(1,1,1); g.translate(0.5,0.5,0.5); return g; }
// a pitched roof over the unit square: ridge along x (ax 0) or along z (ax 1), eaves at y 0, ridge at y 1
function w3dRoofGeo(ax){ const T=w3d.T, g=new T.BufferGeometry(), v=ax===0
    ?[0,0,0, 1,1,0.5, 1,0,0, 0,0,0, 0,1,0.5, 1,1,0.5,  0,0,1, 1,0,1, 1,1,0.5, 0,0,1, 1,1,0.5, 0,1,0.5,  0,0,0, 0,0,1, 0,1,0.5,  1,0,0, 1,1,0.5, 1,0,1]
    :[0,0,0, 0,0,1, 0.5,1,1, 0,0,0, 0.5,1,1, 0.5,1,0,  1,0,0, 0.5,1,1, 1,0,1, 1,0,0, 0.5,1,0, 0.5,1,1,  0,0,0, 0.5,1,0, 1,0,0,  0,0,1, 1,0,1, 0.5,1,1];
  g.setAttribute('position',new T.Float32BufferAttribute(v,3)); g.computeVertexNormals(); return g; }
function w3dMats(){ if(w3d.mats) return w3d.mats; const T=w3d.T; w3dTextures(); const keep=m=>{ m.userData.keep=true; return w3dSee(m); }, M={};
  for(const k in W3D_KIND){ const o=W3D_KIND[k]; M[k]=keep(w3dFacadeMat(w3d[o[0]],o[4])); }
  M.cyl=keep(new T.MeshStandardMaterial({roughness:0.1,metalness:0.45})); M.roof=keep(new T.MeshStandardMaterial({color:0xbdbab3,roughness:0.92})); M.plain=keep(new T.MeshStandardMaterial({roughness:0.6,metalness:0.15}));
  M.houseWall=keep(new T.MeshStandardMaterial({roughness:0.9})); M.houseRoof=keep(new T.MeshStandardMaterial({roughness:0.75,side:T.DoubleSide}));
  return w3d.mats=M; }
// collects building masses by facade kind, then makes one instanced mesh per kind
function w3dBoxes(){ const T=w3d.T, lists={}, plain=[], cyl=[], grow=[], H3=BZ3; let fa=0, fx=0, fz=0, born=false;      // the building being added: its angle and the centre it turns about
  const put=(k,x,z,w,d,y0,h,c)=>{ (lists[k]||(lists[k]=[])).push([x,z,w,d,y0,h,c,fa,fx,fz,born]); }, frame=b=>{ fa=b.a||0; fx=b.x+b.w/2; fz=b.y+b.d/2; }, pl=q=>{ q.push(fa,fx,fz,born); plain.push(q); };
  const place=(M,q,R,Pv)=>{ M.makeScale(q[2],q[5],q[3]).setPosition(q[0],q[4],q[1]); if(q[7]){ R.makeRotationY(-q[7]); Pv.makeTranslation(q[8],0,q[9]); M.premultiply(Pv.clone().invert()).premultiply(R).premultiply(Pv); } };
  const pal=(k,h)=>{ const p=W3D_KIND[k][3]; return p[h%p.length]; };
  const GM=new T.Matrix4(), GR=new T.Matrix4(), GP=new T.Matrix4();
  return {
    grow, setBorn(v){ born=v; },
    // set every new building to a fraction of its height
    growTo(f){ for(const g of grow){ const q=g.q, a=q[4], b=q[5]; q[4]=a*f; q[5]=Math.max(b*f,1e-4); place(GM,q,GR,GP); q[4]=a; q[5]=b; g.m.setMatrixAt(g.i,GM); g.m.instanceMatrix.needsUpdate=true; } },
    shed(b,hh){ frame(b); const h=Math.min(b.h,0.09)*H3; put('shed',b.x,b.y,b.w,b.d,0,h,pal('shed',hh)); pl([b.x+b.w*0.2,b.y+b.d*0.2,b.w*0.15,b.d*0.15,h,0.006,0xb9bec4]); },
    mall(b,hh){ frame(b); const H=Math.max(b.h*H3,0.07), sh=4.5*H3/150*1.4; put('shop',b.x,b.y,b.w,b.d,0,sh,pal('shop',hh)); put('ribbon',b.x,b.y,b.w,b.d,sh,H-sh,pal('ribbon',hh>>>5));
      pl([b.x+b.w*0.2,b.y+b.d*0.96,b.w*0.6,0.004,H,0.022,[0xd9534f,0x3f7fbf,0xe0a030,0x4f9e62][hh&3]]); pl([b.x+b.w*0.06,b.y+b.d*0.08,b.w*0.5,b.d*0.6,H,0.004,0xcdd2d8]); pl([b.x+b.w*0.62,b.y+b.d*0.2,b.w*0.3,b.d*0.5,H,0.012,0xb7bcc2]); },
    building(b,d,hh,detail,kind){ frame(b); const hm=b.h*150, H=b.h*H3, r=(hh>>>4)&255, tower=!kind&&(hm>48||(b.h>0.28&&(hh&3)===0));
      let k; if(tower) k=['glass','dglass','ribbon','glass','dglass'][r%5];
      else if(d>0.9) k=['ribbon','plaster','balcony','brick','ribbon','plaster'][r%6]; else k=['balcony','plaster','brick','balcony','plaster','ribbon'][r%6];
      if(kind) k=kind; const c=pal(k,hh>>>12); let y0=0;
      // shops along the ground floor of busy streets
      if(d>0.4&&hm>12&&k!=='glass'&&k!=='dglass'&&((hh>>>9)&3)!==0){ const sh=4.5*H3/150; put('shop',b.x,b.y,b.w,b.d,0,sh,pal('shop',hh>>>3)); y0=sh; }
      // tall towers step back above a podium, and carry a crown
      // towers come in a few forms: stepped back above a podium, a round shaft, a slab with a mast, or a pair
      const tv=tower?(hh>>>20)%4:-1;
      if(tv===1&&hm>55){ const ph=Math.min(H*0.2,24*H3/150), rr=Math.min(b.w,b.d)*0.46; put('ribbon',b.x,b.y,b.w,b.d,y0,ph,pal('ribbon',hh>>>7)); cyl.push([b.x+b.w/2,b.y+b.d/2,rr,y0+ph,H-ph-y0,[0x9fc0dc,0x8fb3c9,0xb6cfe0,0x7fa3bd][hh&3],fa,fx,fz]);
        if(detail) pl([b.x+b.w/2-0.0015,b.y+b.d/2-0.0015,0.003,0.003,H,0.045,0xc9ced4]); return; }
      if(tv===2&&hm>55&&b.w>0.12){ put(k,b.x,b.y,b.w*0.42,b.d,y0,H-y0,c); put(k,b.x+b.w*0.58,b.y,b.w*0.42,b.d,y0,(H-y0)*0.86,c); put('ribbon',b.x+b.w*0.42,b.y+b.d*0.2,b.w*0.16,b.d*0.6,y0,(H-y0)*0.5,pal('ribbon',hh>>>7)); return; }
      if(tv===3&&hm>55){ put(k,b.x,b.y,b.w,b.d,y0,H-y0,c); if(detail){ pl([b.x+b.w*0.08,b.y+b.d*0.08,b.w*0.84,b.d*0.84,H,0.01,0xd6d9dd]); pl([b.x+b.w*0.5-0.0012,b.y+b.d*0.5-0.0012,0.0024,0.0024,H+0.01,0.06,0xb9bec4]); } return; }
      if(tower&&hm>70){ const ph=Math.min(H*0.32,30*H3/150), ins=0.14; put(k==='glass'?'ribbon':'plaster',b.x,b.y,b.w,b.d,y0,ph,pal('ribbon',hh>>>7)); const t0=y0+ph;
        put(k,b.x+b.w*ins/2,b.y+b.d*ins/2,b.w*(1-ins),b.d*(1-ins),t0,H*0.72-t0,c);
        put(k,b.x+b.w*ins,b.y+b.d*ins,b.w*(1-2*ins),b.d*(1-2*ins),H*0.72,H*0.28,c);
        if(detail) pl([b.x+b.w*0.35,b.y+b.d*0.35,b.w*0.3,b.d*0.3,H,0.012,0xc5cad0]); return; }
      // ordinary blocks are not all boxes either: L and U plans round a yard, stepped and paired slabs, roof gardens, hoardings
      const hv=Math.max(0.004,H-y0), sv=!tower&&!kind&&b.w>0.13&&b.d>0.11?(hh>>>17)%8:0;
      if(sv===2){ put(k,b.x,b.y,b.w,b.d*0.48,y0,hv,c); put(k,b.x,b.y+b.d*0.48,b.w*0.42,b.d*0.52,y0,hv*0.8,c); if(detail) pl([b.x+b.w*0.46,b.y+b.d*0.52,b.w*0.5,b.d*0.44,y0,0.002,0x6fa055]); return; }
      if(sv===3){ put(k,b.x,b.y,b.w,b.d*0.36,y0,hv,c); put(k,b.x,b.y+b.d*0.36,b.w*0.3,b.d*0.64,y0,hv,c); put(k,b.x+b.w*0.7,b.y+b.d*0.36,b.w*0.3,b.d*0.64,y0,hv,c); if(detail) pl([b.x+b.w*0.32,b.y+b.d*0.4,b.w*0.36,b.d*0.56,y0,0.002,0x6fa055]); return; }
      if(sv===4){ put(k,b.x,b.y,b.w,b.d,y0,hv*0.55,c); put(k,b.x+b.w*0.12,b.y+b.d*0.1,b.w*0.6,b.d*0.8,y0+hv*0.55,hv*0.45,c); if(detail) pl([b.x+b.w*0.76,b.y+b.d*0.15,b.w*0.2,b.d*0.7,y0+hv*0.55,0.002,0x6fa055]); return; }
      if(sv===5){ put(k,b.x,b.y,b.w*0.44,b.d,y0,hv,c); put(k,b.x+b.w*0.56,b.y,b.w*0.44,b.d,y0,hv*0.85,c); return; }
      put(k,b.x,b.y,b.w,b.d,y0,hv,c);
      if(detail&&sv===6) pl([b.x+b.w*0.1,b.y+b.d*0.1,b.w*0.8,b.d*0.8,H,0.002,0x6fa055]);
      if(detail&&sv===7) pl([b.x+b.w*0.1,b.y+b.d*0.03,b.w*0.8,0.004,H,0.02,[0xd9534f,0x3f7fbf,0xe0a030][hh%3]]);
      // on the roof: lift motor room, air conditioning units, a water tank on some
      if(detail){ const n=1+((hh>>>14)&1)+(hm>25?1:0); for(let j=0;j<n;j++){ const q=hashInt(hh+j*977), w=b.w*(0.14+(q&7)/50), dd=b.d*(0.12+((q>>3)&7)/50), x=b.x+(b.w-w)*((q>>6)&255)/255, z=b.y+(b.d-dd)*((q>>14)&255)/255;
          pl([x,z,w,dd,H,j===0?0.016:0.006,j===0?0xd6d3cc:0xb7bcc2]); } } },
    *meshes(shadow){ const M=new T.Matrix4(), R=new T.Matrix4(), Pv=new T.Matrix4(), col=new T.Color(), mats=w3dMats();
      for(const k in lists){ const L=lists[k], o=W3D_KIND[k], g=w3dUnit(), ar=new Float32Array(L.length*3), m=new T.InstancedMesh(g,[mats[k],mats[k],mats.roof,mats.roof,mats[k],mats[k]],L.length);
        L.forEach((q,i)=>{ place(M,q,R,Pv); m.setMatrixAt(i,M); if(q[10]) grow.push({m,i,q}); col.set(q[6]); m.setColorAt(i,col);
          ar[i*3]=Math.max(1,Math.round(q[2]*150/o[1])); ar[i*3+1]=Math.max(1,Math.round(q[5]*150/H3/o[2])); ar[i*3+2]=Math.max(1,Math.round(q[3]*150/o[1])); });
        g.setAttribute('aRep',new T.InstancedBufferAttribute(ar,3)); m.castShadow=shadow; m.receiveShadow=shadow; yield m; }
      if(cyl.length){ const g=new T.CylinderGeometry(1,1,1,20); g.translate(0,0.5,0); const m=new T.InstancedMesh(g,mats.cyl,cyl.length); cyl.forEach((q,i)=>{ M.makeScale(q[2],q[4],q[2]).setPosition(q[0],q[3],q[1]); m.setMatrixAt(i,M); col.set(q[5]); m.setColorAt(i,col); }); m.castShadow=shadow; m.receiveShadow=shadow; yield m; }
      if(plain.length&&shadow){ const m=new T.InstancedMesh(w3dUnit(),mats.plain,plain.length); plain.forEach((q,i)=>{ place(M,q,R,Pv); m.setMatrixAt(i,M); if(q[10]) grow.push({m,i,q}); col.set(q[6]); m.setColorAt(i,col); }); m.castShadow=m.receiveShadow=true; yield m; } } }; }
// ---- the land: grass, parks, woods, sea and lakes from the base map; rivers, streets, rail and sports pitches drawn on
// Streets touching a world rectangle (with a margin), so each ground tile strokes only its own
function w3dEdgesIn(x0,y0,x1,y1,list){ const R=G.rn, out=[]; if(!R) return out; const m=0.3; for(const e of (list||R.ea.keys())){ const a=R.ea[e], b=R.eb[e];
  if(Math.max(R.x[a],R.x[b])>x0-m&&Math.min(R.x[a],R.x[b])<x1+m&&Math.max(R.y[a],R.y[b])>y0-m&&Math.min(R.y[a],R.y[b])<y1+m) out.push(e); } return out; }
function w3dStreets(g,E,wd,layers){ const R=G.rn; for(const [extra,col,dash,from] of layers) for(let k=from||0;k<5;k++){ g.strokeStyle=typeof col==='function'?col(k):col; g.lineWidth=extra<0?-extra:wd[k]+extra; g.setLineDash(dash?(typeof dash==='function'?dash(k):dash):[]);
  g.beginPath(); for(const e of E){ if(R.ec[e]!==k) continue; const a=R.ea[e], b=R.eb[e]; g.moveTo(R.x[a],R.y[a]); g.lineTo(R.x[b],R.y[b]); } g.stroke(); } g.setLineDash([]); }
// the countryside is farmed: a patchwork of fields in blocks of a few cells, each its own crop and furrow direction
const W3D_FIELD=['#9db36a','#b7b56a','#8aa85c','#c9b873','#a6a25e','#7f9e58','#b99f6b','#93ad66'];
function w3dFieldAt(x,y){ if(x<0||y<0||x>=W||y>=H) return -1; const i=y*W+x; if(G.water[i]||G.D[i]>=0.045||G.pk[i]>0.1||G.e[i]>0.5) return -1; const bx=Math.floor((x+((y>>2)&1)*2)/3), by=Math.floor(y/2), h=hashInt(bx*7349+by*9151+G.seed); return (h&7)===7?-1:h; }
function w3dFields(g,x0,y0,x1,y1,fine){
  for(let y=Math.max(0,Math.floor(y0));y<=Math.min(H-1,Math.ceil(y1));y++) for(let x=Math.max(0,Math.floor(x0));x<=Math.min(W-1,Math.ceil(x1));x++){ const h=w3dFieldAt(x,y); if(h<0) continue;
    g.fillStyle=W3D_FIELD[(h>>3)&7]; g.globalAlpha=0.55; g.fillRect(x-0.5,y-0.5,1.02,1.02); g.globalAlpha=1;
    if(fine){ g.strokeStyle='rgba(60,70,30,.16)'; g.lineWidth=0.012; g.beginPath(); const vert=(h>>6)&1; for(let k=0.06;k<1;k+=0.12){ if(vert){ g.moveTo(x-0.5+k,y-0.5); g.lineTo(x-0.5+k,y+0.5); } else { g.moveTo(x-0.5,y-0.5+k); g.lineTo(x+0.5,y-0.5+k); } } g.stroke();
      g.strokeStyle='rgba(70,95,45,.55)'; g.lineWidth=0.03; g.beginPath(); if(w3dFieldAt(x+1,y)>>3!==h>>3){ g.moveTo(x+0.5,y-0.5); g.lineTo(x+0.5,y+0.5); } if(w3dFieldAt(x,y+1)>>3!==h>>3){ g.moveTo(x-0.5,y+0.5); g.lineTo(x+0.5,y+0.5); } g.stroke(); } } }
function* w3dGroundGen(){ w3dTerrain();
  const T=w3d.T, B=G.bounds, K=6, cw=(B[2]-B[0])*K, ch=(B[3]-B[1])*K, dark=w3dDark();
  const pal=dark?{sea:[22,44,70],sh:[30,56,84],land:[52,66,46],urb:[70,72,78],park:[38,64,40],forest:[30,52,34],hill:[60,66,50],str:[70,72,78]}
                :{sea:[58,110,152],sh:[84,136,172],land:[138,162,98],urb:[166,162,154],park:[102,146,72],forest:[70,108,56],hill:[130,144,98],str:[166,162,154]};
  const lo=document.createElement('canvas'), lg=lo.getContext('2d'), job=baseSetup({ctx:lg,ox:B[0],oy:B[1],cw:B[2]-B[0],ch:B[3]-B[1],ppc:3,pal,urban:true});
  lo.width=job.bw; lo.height=job.bh; while(!baseRows(job,48)) yield; lg.putImageData(job.img,0,0); yield;
  // the land itself (also the base the sharp ground near the viewer is drawn from)
  const c=document.createElement('canvas'); c.width=cw; c.height=ch; const g=c.getContext('2d'); g.imageSmoothingEnabled=true; g.drawImage(lo,0,0,cw,ch);
  g.setTransform(K,0,0,K,(0.5-B[0])*K,(0.5-B[1])*K);
  w3dFields(g,B[0],B[1],B[2],B[3],false); yield;
  // sports pitches and a few allotments in the parks
  for(let y=B[1];y<B[3];y++) for(let x=B[0];x<B[2];x++){ const i=y*W+x; if(G.water[i]||G.pk[i]<0.27||G.D[i]>0.9) continue; const h=hashInt(i*31+7); if((h&63)>1) continue;
    const a=((h>>8)&1)?0:Math.PI/2; g.save(); g.translate(x,y); g.rotate(a); g.fillStyle=dark?'#2f5a2e':'#5d9a48'; g.fillRect(-0.33,-0.22,0.66,0.44); g.fillStyle=dark?'#346334':'#68a552'; for(let s=0;s<6;s+=2) g.fillRect(-0.33+s*0.11,-0.22,0.11,0.44);
    g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=0.012; g.strokeRect(-0.31,-0.2,0.62,0.4); g.beginPath(); g.moveTo(0,-0.2); g.lineTo(0,0.2); g.stroke(); g.beginPath(); g.arc(0,0,0.06,0,6.283); g.stroke(); g.restore(); }
  yield;
  const wc=dark?'#1c3550':'#4a86b4', wd=ROAD_W.map(w=>w-0.03), pave=dark?'#5d5f66':'#d9d6cf', asph=dark?'#2a2c31':'#5b5e66';
  // each tile paints its own piece (rivers, rail, streets) and is uploaded on its own frame
  const out=[]; yield* w3dTiles(B[0]-0.5,B[1]-0.5,B[2]-B[0],B[3]-B[1],0,4,K,(g,x0,y0,w,h,k)=>{
      g.drawImage(c,(x0-(B[0]-0.5))*K,(y0-(B[1]-0.5))*K,w*K,h*K,0,0,g.canvas.width,g.canvas.height); g.setTransform(k,0,0,k,-x0*k,-y0*k); g.lineCap='round'; g.lineJoin='round';
      g.strokeStyle=wc; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18); g.stroke(r.p); }
      if(P2.rail){ g.strokeStyle=dark?'#4a443e':'#9a8f84'; g.lineWidth=0.09; g.stroke(P2.rail); g.strokeStyle=dark?'#2a2a2a':'#5a5450'; g.lineWidth=0.012; g.setLineDash([0.02,0.02]); g.stroke(P2.rail); g.setLineDash([]); }
      // streets: kerbs and pavement under asphalt, centre lines on the bigger roads
      w3dStreets(g,w3dEdgesIn(x0,y0,x0+w,y0+h),wd,[[0.03,pave],[0,asph],[-0.004,k=>k===4?'#e8c547':'rgba(255,255,255,.8)',k=>k===4?[]:[0.03,0.03],2]]); },
    // water is glossy: a roughness map with the sea, lakes and rivers dark
    (g,x0,y0,w,h,k)=>{ g.fillStyle='#f0f0f0'; g.fillRect(0,0,g.canvas.width,g.canvas.height); g.setTransform(k,0,0,k,-x0*k,-y0*k); g.fillStyle='#262626';
      for(let y=Math.max(B[1],Math.floor(y0));y<Math.min(B[3],y0+h+1);y++) for(let x=Math.max(B[0],Math.floor(x0));x<Math.min(B[2],x0+w+1);x++) if(G.water[y*W+x]) g.fillRect(x-0.5,y-0.5,1,1);
      g.strokeStyle='#262626'; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18); g.stroke(r.p); } },
    (tx,rt)=>w3dSee(new T.MeshStandardMaterial({map:tx,roughnessMap:rt,roughness:1,metalness:0.02,...w3dCut()})),m=>{ m.renderOrder=-5; out.push(m); });
  // swap in the finished ground; the old one goes after the next frame, once the new one has been drawn
  return ()=>{ w3d.groundCanvas=c; out.forEach(m=>w3d.S.add(m)); w3dTrash(w3d.gnd); w3d.gnd=out; }; }
// the world rectangle (x0,y0,w,h) as n×n ground tiles at ppc pixels a cell: each tile is painted, uploaded and placed on its own step
/* Hills and mountains. The land rises where the height map is high, and is kept level wherever something stands on
   it (streets, built-up ground, the railway, the airport, metro lines), easing up from a few cells away, so a road
   or a line through the hills runs in a cutting. Everything that is not on level ground (trees, the camera) asks w3dHt. */
const W3D_HS=1.15;
function w3dTerrain(){ const key=netVersion+'|'+(G.rn?Math.floor(G.rn.ea.length/200):0)+'|'+Math.floor(months/12)+'|'+G.seed+'|'+G.stage; if(w3d.tK===key) return; w3d.tK=key;
  const n=W*H, m=new Uint8Array(n), mark=(x,y,r)=>{ for(let yy=Math.max(0,Math.round(y-r));yy<=Math.min(H-1,Math.round(y+r));yy++) for(let xx=Math.max(0,Math.round(x-r));xx<=Math.min(W-1,Math.round(x+r));xx++) m[yy*W+xx]=1; };
  for(let i=0;i<n;i++) if(G.roadUse[i]||G.D[i]>0.04||G.water[i]) m[i]=1;
  for(const p of G.rail) mark(p[0],p[1],1); mark(G.fac.airport.x,G.fac.airport.y,13); for(const f of (G.fac2||[])) if(f.t==='air') mark(f.x,f.y,13);
  for(const L of lines){ if(L.stops.length<2) continue; for(const p of lineLevels(L).pts) mark(p[0],p[1],1); }
  const d=distTransform(m), F=w3d.tF||(w3d.tF=new Float32Array(n)); for(let i=0;i<n;i++) F[i]=W3D_HS*Math.pow(smooth(G.e[i],0.36,0.9),1.3)*smooth(d[i],1.5,6); }
function w3dHt(x,z){ return w3d.tF?bilinear(w3d.tF,x,z):0; }
function* w3dTiles(x0,y0,w,h,y,n,ppc,paint,paintRough,mat,put){ const T=w3d.T, an=w3d.R.capabilities.getMaxAnisotropy();
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const tx0=x0+w*i/n, ty0=y0+h*j/n, tw=w/n, th=h/n;
    const mk=(k,fn,srgb)=>{ const cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(tw*k)); cv.height=Math.max(1,Math.round(th*k)); const g=cv.getContext('2d'); g.imageSmoothingEnabled=true;
      fn(g,tx0,ty0,tw,th,cv.width/tw); const tx=new T.CanvasTexture(cv); tx.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace; tx.anisotropy=an; w3d.R.initTexture(tx); return tx; };
    const tx=mk(ppc,paint,true), rt=paintRough?mk(ppc/2,paintRough,false):null;
    const sg=tw<20?2:1, geo=new T.PlaneGeometry(tw,th,Math.min(128,Math.ceil(tw*sg)),Math.min(128,Math.ceil(th*sg))); { const pa=geo.attributes.position; let any=false; for(let v=0;v<pa.count;v++){ const hv=w3dHt(tx0+tw/2+pa.getX(v),ty0+th/2-pa.getY(v)); if(hv>1e-4){ pa.setZ(v,hv); any=true; } } if(any) geo.computeVertexNormals(); }
    const m=new T.Mesh(geo,mat(tx,rt)); m.rotation.x=-Math.PI/2; m.position.set(tx0+tw/2,y,ty0+th/2); m.receiveShadow=true; put(m); yield; } }
// material settings for anything lying on the ground: it is left out where a cutting has been marked (see the mask in w3dBuild)
function w3dCut(){ const T=w3d.T; return {stencilWrite:true,stencilFunc:T.NotEqualStencilFunc,stencilRef:1,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.KeepStencilOp}; }
/* Seeing the train through whatever is in the way. Every material that can stand between the camera and the train
   (ground, streets, buildings, trees, tunnel walls, station roofs) is drawn as a transparent surface whose opacity
   is worked out per pixel: inside an ellipse on the screen that reaches from just behind the train to well ahead
   along its route, anything nearer than the route fades to about a quarter, smoothly back to solid at the rim. So
   the train and the track ahead show through the city above them, softly, with no hole and no dots.
   uSee = (centre x, y in pixels, depth beyond which nothing fades, how strongly); uSeeE = (long axis direction x, y, 1/long, 1/short). */
function w3dSee(m){ const prev=m.onBeforeCompile, key=m.customProgramCacheKey?m.customProgramCacheKey():''; m.transparent=true;
  m.onBeforeCompile=(sh,r)=>{ if(prev) prev(sh,r); sh.uniforms.uSee=w3d.see; sh.uniforms.uSeeE=w3d.seeE;
    sh.fragmentShader='uniform vec4 uSee;\nuniform vec4 uSeeE;\n'+sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n\tif(uSee.w>0.0&&gl_FragCoord.z<uSee.z){ vec2 seeD=gl_FragCoord.xy-uSee.xy; float seeR=length(vec2(dot(seeD,uSeeE.xy)*uSeeE.z,dot(seeD,vec2(-uSeeE.y,uSeeE.x))*uSeeE.w)); gl_FragColor.a*=mix(1.0,mix(0.26,1.0,smoothstep(0.5,1.0,seeR)),uSee.w); }'); };
  m.customProgramCacheKey=()=>key+'|see2'; return m; }
function w3dTrash(list){ if(list&&list.length) (w3d.trash||(w3d.trash=[])).push(...list); }
function w3dEmpty(){ if(w3d.trash&&w3d.trash.length){ w3dClear(w3d.trash); } }

// ---- everything that only changes with the network or the year
function w3dBuild(){
  const T=w3d.T, dark=w3dDark(), gs=G.stage+'|'+dark+'|'+G.seed, sig=netVersion+'|'+gs+'|'+Math.floor(months/12); if(sig===w3d.sig) return; w3d.sig=sig; w3dClear(w3d.objs); w3dTextures();
  // the land only when the map itself changes (a new city, a bigger map, the theme); new streets are drawn in later, in the background
  if(gs!==w3d.gSig){ w3d.gSig=gs; if(w3d.gj) w3d.gj=null; w3d.gRn=G.rn?G.rn.ver:0; w3d.gAt=performance.now(); w3d.gj={it:w3dGroundGen()}; w3dRun(w3d.gj,Infinity); w3d.gj=null; w3d.bc=null; }
  { const k0=w3d.tK; w3dTerrain(); if(k0&&k0!==w3d.tK&&!w3d.gj){ w3d.gAt=performance.now(); w3d.gj={it:w3dGroundGen()}; } }
  // sky, haze and light: a clear late morning, or dusk in the dark theme
  const sky=document.createElement('canvas'); sky.width=2; sky.height=256; { const g=sky.getContext('2d'), gr=g.createLinearGradient(0,0,0,256);
    if(dark){ gr.addColorStop(0,'#0b1430'); gr.addColorStop(0.55,'#2c3460'); gr.addColorStop(0.8,'#b5657a'); gr.addColorStop(1,'#f0a66a'); } else { gr.addColorStop(0,'#5d97d4'); gr.addColorStop(0.55,'#a9cbe9'); gr.addColorStop(1,'#e9f0f2'); } g.fillStyle=gr; g.fillRect(0,0,2,256); }
  const st=new T.CanvasTexture(sky); st.colorSpace=T.SRGBColorSpace; if(w3d.S.background&&w3d.S.background.dispose) w3d.S.background.dispose(); w3d.S.background=st; const hz=dark?0x8a6a7e:0xdfe9ee; w3d.S.fog=new T.Fog(hz,3,dark?16:24);
  w3d.sun.color.set(0xffefd9); w3d.sun.intensity=2.9; w3d.hemi.intensity=0.42; w3d.hemi.color.set(0xdde8f5); w3d.hemi.groundColor.set(0xa89f8e);
  // the sky lights the city too: an environment map made from the same sky, so walls in shade and glass are never black
  if(!w3d.env){ const pm=new T.PMREMGenerator(w3d.R), es=new T.Scene(), sm=new T.MeshBasicMaterial({map:st,side:T.BackSide,color:0xa0a0a0}); es.add(new T.Mesh(new T.SphereGeometry(10,32,16),sm));
    const gm=new T.Mesh(new T.CircleGeometry(10,32),new T.MeshBasicMaterial({color:0x6d695f})); gm.rotation.x=-Math.PI/2; gm.position.y=-0.6; es.add(gm); w3d.env=pm.fromScene(es,0.03).texture; pm.dispose(); sm.dispose(); }
  w3d.S.environment=w3d.env;
  // lines that share a stretch run side by side, the way the map draws them
  const groups=new Map(), kk=(a,b)=>a<b?a+'-'+b:b+'-'+a;
  for(const L of lines){ ensurePaths(L); const n=L.stops.length; for(let i=0;i<segCount(L);i++){ const k=kk(L.stops[i],L.stops[(i+1)%n]); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(L.id); } }
  for(const L of lines){ if(L.stops.length<2) continue; let P=[]; const ns=L.stops.length;
    for(let i=0;i<segCount(L);i++){ const a=L.stops[i], b=L.stops[(i+1)%ns], gq=groups.get(kk(a,b)); let off=(gq.indexOf(L.id)-(gq.length-1)/2)*(DECK*2+0.012); if(a>b) off=-off;
      const pp=off?offsetPts(L.paths[i],off):L.paths[i]; for(let j=P.length?1:0;j<pp.length;j++) P.push(pp[j]); }
    P=densify(P,0.4); const cum=[0]; for(let i=1;i<P.length;i++) cum.push(cum[i-1]+dist(P[i-1][0],P[i-1][1],P[i][0],P[i][1]));
    // the track's height all along: on the viaduct, down the ramp, in the tunnel
    const lv=lineLevels(L), len=cum[cum.length-1]||1, Y=cum.map(u=>TRK+(UGY-TRK)*levelDep(lv,u/len*lv.len)); L._p3={pts:P,cum,Y}; }
  // viaducts: concrete deck and parapets, a band in the line colour, rails, piers, masts and overhead wires;
  // tunnels: a lit concrete tube; where the two meet, a portal
  const concrete=new T.MeshStandardMaterial({color:dark?0x77767a:0xc4c1ba,roughness:0.85}), railM=new T.MeshStandardMaterial({color:0x4a4a4c,roughness:0.35,metalness:0.6});
  const piers=[], masts=[], wire=[], cuts=[], tubes=[]; w3d.trains=[];
  const o3=(pc,off)=>offsetPts(pc,off).map((q,i)=>[q[0],q[1],pc[i][2]]);
  for(const L of lines) if(L.stops.length>=2) w3dStopsOn(L);
  w3dStationPlan(); for(const L of lines) if(L.stops.length>=2) w3dStopsOn(L);
  for(const L of lines){ if(L.stops.length<2) continue; const P=L._p3, len=P.cum[P.cum.length-1], lc=new T.Color(lineColor(L));
    const above=w3dSpans(P,y=>y>0.003), cutS=w3dSpans(P,y=>y<=0.006&&y>-0.054), below=w3dSpans(P,y=>y<-0.05), stCut=(under)=>P.sU.filter(u=>(w3dHAt(P,u)<0)===under).map(u=>[u-W3D_PLAT/2-0.03,u+W3D_PLAT/2+0.03]);
    for(const [a,b] of above){ const pc=w3dPart(P,a,b), deck=w3dAdd(new T.Mesh(w3dRibbon(pc,DECK,TRK,0.014),concrete)); deck.castShadow=true; deck.receiveShadow=true;
      for(const s of [1,-1]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,s*(DECK+0.0002)),0.0004,TRK-0.002,0.006),new T.MeshStandardMaterial({color:lc,roughness:0.5}))); }
    // parapets stop at the stations, where the platforms take their place
    for(const [a,b] of w3dMinus(above,stCut(false))){ const pc=w3dPart(P,a,b); for(const s of [1,-1]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,s*(DECK-0.0015)),0.0015,TRK+0.008,0.008),concrete)).castShadow=true; }
    { const pc=w3dPart(P,0,len); for(const r of [W3D_TO+0.0048,W3D_TO-0.0048,-W3D_TO+0.0048,-W3D_TO-0.0048]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,r),0.0008,TRK+0.0016,0.0016),railM)); }
    for(const [a,b] of cutS){ const pc=w3dPart(P,Math.max(0,a-0.05),Math.min(len,b+0.05)); cuts.push(pc); }
    for(const [a,b] of w3dMinus(below,stCut(true))) tubes.push(w3dPart(P,a,b));
    const pts=P.pts; let accM=0; for(let i=1;i<pts.length;i++){ const d=dist(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]); accM+=d;
      const a=Math.atan2(pts[i][1]-pts[i-1][1],pts[i][0]-pts[i-1][0]), y=P.Y[i];
      if(y>0.02) piers.push([pts[i][0],pts[i][1],a,y/TRK]);
      if(y>0.004){ for(const hh of [0.036,0.044]) wire.push(pts[i-1][0],P.Y[i-1]+hh,pts[i-1][1],pts[i][0],y+hh,pts[i][1]);
        if(accM>=0.33&&!stations.some(s=>Math.abs(s.x-pts[i][0])<0.35&&Math.abs(s.y-pts[i][1])<0.35&&dist(s.x,s.y,pts[i][0],pts[i][1])<0.35)){ accM=0; masts.push([pts[i][0]-Math.sin(a)*(DECK-0.004),pts[i][1]+Math.cos(a)*(DECK-0.004),a,y-TRK]); } } }
    // trains: five cars that each follow the track, silver bodies, a band in the line colour, dark window strip and car ends
    const lcs=lineColor(L), parts=[], CAR=W3D_CAR;
    parts.push(w3dBox(CAR,0.024,0.019,0,0.012,0,0xe7eaee),w3dBox(CAR*0.98,0.0032,0.0195,0,0.0075,0,lcs),w3dBox(CAR*0.9,0.0075,0.0196,0,0.0155,0,0x3a4856),w3dBox(CAR*0.9,0.0012,0.01965,0,0.0186,0,0x6f8394),w3dBox(CAR*0.96,0.002,0.016,0,0.0248,0,0xb9bec5),w3dBox(CAR*0.5,0.003,0.008,0,0.0262,0,0x9aa0a8));
    for(const dx of [-0.39,-0.13,0.13,0.39]){ parts.push(w3dBox(0.0095,0.0165,0.0197,dx*CAR,0.0118,0,0xcfd4da),w3dBox(0.0035,0.0065,0.01975,dx*CAR-0.0024,0.0158,0,0x3a4856),w3dBox(0.0035,0.0065,0.01975,dx*CAR+0.0024,0.0158,0,0x3a4856)); }   /* four doors a side, each with two windows */
    for(const e of [-1,1]) parts.push(w3dBox(0.003,0.011,0.015,e*(CAR/2+0.0004),0.0148,0,0x1d2530),w3dBox(0.0031,0.0022,0.0152,e*(CAR/2+0.0004),0.0068,0,lcs));
    const tg=w3dMerge(parts), tmat=new T.MeshStandardMaterial({vertexColors:true,roughness:0.32,metalness:0.35}), g0=trainAt(L,0), tm=new T.InstancedMesh(tg,tmat,g0.n*W3D_CARS);
    tm.castShadow=true; tm.frustumCulled=false; w3dAdd(tm); w3d.trains.push({L,m:tm,n:g0.n,geo:tg}); }
  if(piers.length){ const pg=w3dMerge([{g:new T.CylinderGeometry(0.0075,0.009,TRK-0.014,10),m:new T.Matrix4().makeTranslation(0,(TRK-0.014)/2,0),c:dark?0x77767a:0xbdb9b1},w3dBox(0.014,0.006,DECK*1.8,0,TRK-0.017,0,dark?0x77767a:0xbdb9b1)]);
    const pm=new T.InstancedMesh(pg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.9}),piers.length), M=new T.Matrix4(), Q=new T.Quaternion(), up=new T.Vector3(0,1,0), V=new T.Vector3(), Sc=new T.Vector3();
    piers.forEach((p,i)=>{ Q.setFromAxisAngle(up,-p[2]); M.compose(V.set(p[0],0,p[1]),Q,Sc.set(1,p[3],1)); pm.setMatrixAt(i,M); }); pm.castShadow=true; pm.receiveShadow=true; w3dAdd(pm); }
  if(masts.length){ const mg=w3dMerge([{g:new T.CylinderGeometry(0.0007,0.0008,0.05,6),m:new T.Matrix4().makeTranslation(0,TRK+0.025,0),c:0x9aa0a8},w3dBox(0.0008,0.0008,DECK*0.95,0,TRK+0.046,DECK*0.45,0x9aa0a8)]);
    const mm=new T.InstancedMesh(mg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.5,metalness:0.5}),masts.length), M=new T.Matrix4(), Q=new T.Quaternion(), up=new T.Vector3(0,1,0), V=new T.Vector3(), one=new T.Vector3(1,1,1);
    masts.forEach((p,i)=>{ Q.setFromAxisAngle(up,-p[2]); M.compose(V.set(p[0],p[3],p[1]),Q,one); mm.setMatrixAt(i,M); }); mm.castShadow=true; w3dAdd(mm); }
  if(wire.length){ const wg=new T.BufferGeometry(); wg.setAttribute('position',new T.Float32BufferAttribute(wire,3)); w3dAdd(new T.LineSegments(wg,new T.LineBasicMaterial({color:0x33363b,transparent:true,opacity:0.7}))); }
  // open cuttings where the track sinks below the street: the ground is masked out over them (stencil), and a concrete
  // trough with low parapets carries the track down to the tunnel mouth
  for(const pc of cuts){ const flat=pc.map(q=>[q[0],q[1]]), mk=new T.Mesh(w3dRibbon(flat,TUN_W-0.0006,0.0012,0),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:T.AlwaysStencilFunc,stencilFail:T.ReplaceStencilOp,stencilZFail:T.ReplaceStencilOp,stencilZPass:T.ReplaceStencilOp}));
    mk.renderOrder=-10; w3dAdd(mk); const tr=w3dAdd(new T.Mesh(w3dTrough(pc,TUN_W,0.011),new T.MeshStandardMaterial({color:0xb9b6ae,roughness:0.9,side:T.DoubleSide}))); tr.receiveShadow=true; }
  if(tubes.length){ const B=G.bounds, ep=new T.Mesh(new T.PlaneGeometry(B[2]-B[0]+40,B[3]-B[1]+40),new T.MeshBasicMaterial({color:0x17181b,fog:false})); ep.rotation.x=Math.PI/2; ep.position.set((B[0]+B[2])/2,-0.0015,(B[1]+B[3])/2); w3dAdd(ep); }
  if(tubes.length){ w3dTunnelTex(); const tm=w3dSee(new T.MeshBasicMaterial({map:w3d.tunTex,vertexColors:true,side:T.DoubleSide,fog:false})); for(const pc of tubes){ w3dAdd(new T.Mesh(w3dTube(pc,TUN_W,TUN_H,[0]),tm)); w3dAdd(new T.Mesh(w3dTube(pc,TUN_W,TUN_H,[2,4,6]),tm)); }
    // deep earth under everything, seen through the thinned ground round a train underground
    const B=G.bounds, ef=new T.Mesh(new T.PlaneGeometry(B[2]-B[0]+40,B[3]-B[1]+40),new T.MeshBasicMaterial({color:0x4d463d,fog:false})); ef.rotation.x=-Math.PI/2; ef.position.set((B[0]+B[2])/2,UGY*2.9,(B[1]+B[3])/2); w3dAdd(ef); }
  // stations: platforms beside the outermost tracks, a canopy over all of them with the line colours on its edge,
  // columns, name boards, benches and a concourse under the viaduct; lines running side by side share one station.
  // Underground the same platforms stand in a lit hall, with an entrance pavilion on the street above.
  { const parts=[], uparts=[], hall=[], hallX=[], spots=[]; const pl=0xbdbab3, cano=0xeeeeea, col=0xa9b0b9, glass=0x9fb4c2, wall=0xd9d5cc; w3d.stY=new Map();
    for(const st of stations){ const here=[]; for(const L of lines){ if(L.stops.length<2||!L._p3||!L._p3.sU) continue; const k=L.stops.indexOf(st.id); if(k<0) continue; const u=L._p3.sU[k], p=polyAt(L._p3.pts,L._p3.cum,u), h=polyHead(L._p3.pts,L._p3.cum,u,0.2); here.push({L,p,h,y:w3dHAt(L._p3,u)}); }
      const groups=[]; for(const o of here){ const g=groups.find(g=>Math.abs(g[0].h[0]*o.h[0]+g[0].h[1]*o.h[1])>0.85&&dist(g[0].p[0],g[0].p[1],o.p[0],o.p[1])<0.3&&(g[0].y<0)===(o.y<0)); if(g) g.push(o); else groups.push([o]); }
      if(here.length) w3d.stY.set(st.id,Math.max(...here.map(o=>o.y)));
      for(const g of groups){ const hx=g[0].h[0], hy=g[0].h[1], nx=-hy, ny=hx, cx=g.reduce((a,o)=>a+o.p[0],0)/g.length, cy=g.reduce((a,o)=>a+o.p[1],0)/g.length, under=g[0].y<0, dy=g[0].y-TRK;
        const offs=g.map(o=>(o.p[0]-cx)*nx+(o.p[1]-cy)*ny), lo=Math.min(...offs)-W3D_TO-0.0108, hi=Math.max(...offs)+W3D_TO+0.0108, PW=0.03, Lp=W3D_PLAT, mid=(lo+hi)/2, span=hi-lo+2*PW;
        const Gm=new T.Matrix4().makeTranslation(cx,0,cy).multiply(new T.Matrix4().makeRotationY(-Math.atan2(hy,hx)));
        const mk=(list,yo)=>(w,h,d,x,y,z,c)=>{ const q=w3dBox(w,h,d,x,y+yo,z,c); q.m=Gm.clone().multiply(q.m); list.push(q); }, B=mk(under?uparts:parts,dy), S=mk(parts,0);
        const lc=lineColor(g[0].L);
        if(!under) B(Lp+0.06,0.014,span+0.02,0,TRK-0.007,mid,0xc4c1ba);                                  // the wider deck
        for(const sd of [-1,1]){ const z=sd<0?lo-PW/2:hi+PW/2, edge=sd<0?lo:hi;
          B(Lp,0.0075,PW,0,TRK+0.00375,z,under?0xd8d5ce:pl); B(Lp,0.0004,0.003,0,TRK+0.0077,edge+sd*0.0035,0xf2c200);        // platform and tactile strip
          if(!under){ B(Lp,0.0008,0.0012,0,TRK+0.0145,z+sd*(PW/2-0.0006),0x9aa1a8); for(let x=-Lp/2;x<=Lp/2;x+=0.03) B(0.0007,0.007,0.0007,x,TRK+0.011,z+sd*(PW/2-0.0006),0x9aa1a8); }   // a railing on the outer edge
          for(const x of [-0.34,-0.18,0.18,0.34]) B(under?0.004:0.0011,under?0.04:0.032,under?0.004:0.0011,x,TRK+(under?0.0275:0.0235),z+sd*(PW/2-0.004)*(under?0:1),under?0xeceae4:0xdfe3e7);    // columns
          for(const x of [-Lp*0.3,0,Lp*0.3]){ B(0.03,0.0055,0.0012,x+0.03,TRK+0.031,z+sd*(under?PW/2-0.002:-0.006),0xffffff); B(0.03,0.0012,0.00125,x+0.03,TRK+0.0292,z+sd*(under?PW/2-0.002:-0.006),lc); }   // name boards
          for(const x of [-Lp*0.18,Lp*0.12,Lp*0.38]) B(0.016,0.003,0.004,x,TRK+0.009,z+sd*0.006,0x6d7480);                     // benches
          if(under) B(Lp,0.004,0.0012,0,TRK+0.022,z+sd*(PW/2-0.0008),lc);                                                         // a band in the line colour along the wall
          else B(Lp*0.82,0.004,0.0016,0,TRK+0.0385,z+sd*(PW/2),lc); }                                                              // fascia in the line colour
        if(under){ // the hall round the platforms, dark where the tunnels leave it; and the way up to the street
          const Hh=mk(hall,dy), Hx=mk(hallX,dy), hl=Lp+0.1, z0=lo-PW-0.003, z1=hi+PW+0.003, POST=[0xd9534f,0x3f7fbf,0xe0a030,0x4f9e62,0x7a5aa6,0xe8e4da];
          Hh(hl,0.002,z1-z0,0,TRK-0.0022,mid,0x77746e); Hx(hl,0.002,z1-z0,0,TRK+0.05,mid,0xd6d3cc);                                     // track bed and ceiling
          for(const sd of [-1,1]){ const zw=sd<0?z0:z1, zp=sd<0?lo-PW/2:hi+PW/2, edge=sd<0?lo:hi;
            Hx(hl,0.052,0.002,0,TRK+0.024,zw,0xcbc8c0); Hx(hl,0.012,0.0006,0,TRK+0.0135,zw-sd*0.0014,0xa7a39a);                         // wall and dado
            Hh(Lp,0.0075,0.0006,0,TRK+0.00375,edge-sd*0.0002,0x97938b); Hx(Lp*0.94,0.0006,0.005,0,TRK+0.0488,zp,0xffffff);               // platform edge, strip lights
            for(let x=-Lp/2+0.07,q=0;x<Lp/2-0.05;x+=0.115,q++){ if(q%3===1) continue; Hx(0.04,0.016,0.0006,x,TRK+0.034,zw-sd*0.0016,POST[(q+st.id)%POST.length]); } }      // posters
          { const iv=offs.map(o=>[o-TUN_W,o+TUN_W]).sort((p,q)=>p[0]-q[0]); let zc=z0; const gaps=[]; for(const [a,b] of iv){ if(a>zc+0.001) gaps.push([zc,a]); zc=Math.max(zc,b); } if(zc<z1-0.001) gaps.push([zc,z1]);
            for(const ex of [-1,1]){ for(const [a,b] of gaps) Hx(0.002,0.052,b-a,ex*hl/2,TRK+0.024,(a+b)/2,0xbfbcb4); Hx(0.002,0.052-TUN_H,z1-z0,ex*hl/2,TRK+TUN_H-0.002+(0.052-TUN_H)/2,mid,0xbfbcb4); } }                         // end walls, open where the tunnels leave
          const ez=mid+span/2+0.045; S(0.07,0.02,0.035,0,0.01,ez,glass); S(0.082,0.003,0.045,0,0.0215,ez,cano); S(0.082,0.004,0.0015,0,0.0185,ez+0.022,lc); S(0.012,0.012,0.012,0.06,0.03,ez,lc); S(0.0018,0.026,0.0018,0.06,0.013,ez,col);
          spots.push({x:cx+nx*ez,y:cy+ny*ez,hx,hy,len:0.2,half:0.05}); continue; }
        B(Lp*0.82,0.0022,span+0.006,0,TRK+0.0405,mid,cano);                                    // canopy
        B(0.34,TRK-0.03,Math.min(span*0.8,0.11),0,0.008+(TRK-0.03)/2,mid,wall); B(0.3,TRK-0.04,Math.min(span*0.8,0.11)+0.002,0,0.008+(TRK-0.04)/2,mid,glass);   // concourse under the viaduct
        { const ez=mid+Math.min(span*0.4,0.055)+0.015; B(0.1,0.003,0.03,0,0.022,ez,cano); for(const ex of [-0.045,0.045]) B(0.0018,0.021,0.0018,ex,0.0105,ez+0.013,col); } B(0.1,0.0015,0.0012,0,0.0195,mid+Math.min(span*0.4,0.055)+0.03,lc);                  // entrance canopy
        spots.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp+0.1,half:span/2+0.05}); }
      // an interchange where lines meet at an angle: one concourse building joining their platforms
      const up=groups.filter(g=>g[0].y>=0); if(up.length>=2){ const cx=up.reduce((a,g)=>a+g[0].p[0],0)/up.length, cy=up.reduce((a,g)=>a+g[0].p[1],0)/up.length; parts.push(w3dBox(0.2,TRK-0.02,0.2,cx,(TRK-0.02)/2,cy,0xdcd8cf),w3dBox(0.21,0.004,0.21,cx,TRK-0.018,cy,0xeeeeea),w3dBox(0.17,0.03,0.202,cx,0.02,cy,0x9fb4c2),w3dBox(0.202,0.03,0.17,cx,0.02,cy,0x9fb4c2)); spots.push({x:cx,y:cy,hx:1,hy:0,len:0.3,half:0.15}); } }
    w3d.stSpots=spots; if(parts.length){ const sm=new T.Mesh(w3dMerge(parts),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.6,metalness:0.05}))); sm.castShadow=true; sm.receiveShadow=true; w3dAdd(sm); }
    if(uparts.length) w3dAdd(new T.Mesh(w3dMerge(uparts),new T.MeshBasicMaterial({vertexColors:true,fog:false})));
    if(hall.length) w3dAdd(new T.Mesh(w3dMerge(hall),new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide})));
    if(hallX.length) w3dAdd(new T.Mesh(w3dMerge(hallX),w3dSee(new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide})))); }
  // the rider's own train (seen from outside in the chase view)
  w3d.myTrain=null; const L0=lines.find(l=>l.stops.length>=2); if(L0){ const tr=w3d.trains[0]; w3d.myTrain=w3dAdd(new T.InstancedMesh(tr.geo,new T.MeshStandardMaterial({vertexColors:true,roughness:0.3,metalness:0.35}),W3D_CARS)); w3d.myTrain.castShadow=true; w3d.myTrain.frustumCulled=false; }
  w3d.bcStale=true; w3d.labels.forEach(l=>l.el.remove()); w3d.labels=[]; }
function w3dNear(L,x,y){ const P=L._p3?L._p3.pts:null; if(!P) return [x,y,0]; const C=L._p3.cum; let bd=1e9, bx=x, by=y, bu=0; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1e-9, q=clamp(((x-a[0])*dx+(y-a[1])*dy)/l2,0,1), xx=a[0]+dx*q, yy=a[1]+dy*q, d=(xx-x)**2+(yy-y)**2; if(d<bd){ bd=d; bx=xx; by=yy; bu=C[i-1]+(C[i]-C[i-1])*q; } } return [bx,by,bu]; }
// the track's height at distance u along a line's 3D path
function w3dHAt(P,u){ const c=P.cum, n=c.length; if(u<=0) return P.Y[0]; if(u>=c[n-1]) return P.Y[n-1]; const i=Math.max(1,trainSeg(c,u)), f=(u-c[i-1])/((c[i]-c[i-1])||1); return P.Y[i-1]+(P.Y[i]-P.Y[i-1])*f; }
// the stretches (as distances along the path) where the track's height passes a test, e.g. above the street
function w3dSpans(P,ok){ const o=[], n=P.pts.length; let a=null; for(let i=0;i<n;i++){ const v=ok(P.Y[i]); if(v&&a==null) a=P.cum[Math.max(0,i-1)]; if(!v&&a!=null){ o.push([a,P.cum[i]]); a=null; } } if(a!=null) o.push([a,P.cum[n-1]]); return o.filter(q=>q[1]-q[0]>0.05); }
function w3dMinus(spans,cuts){ let cur=spans.map(q=>q.slice()); for(const [ca,cb] of cuts){ const nx=[]; for(const [a,b] of cur){ if(cb<=a||ca>=b){ nx.push([a,b]); continue; } if(ca>a) nx.push([a,ca]); if(cb<b) nx.push([cb,b]); } cur=nx; } return cur.filter(q=>q[1]-q[0]>0.03); }
// a stretch of the path as [x, z, height] points
function w3dPart(P,a,b){ const at=u=>{ const p=polyAt(P.pts,P.cum,u); return [p[0],p[1],w3dHAt(P,u)]; }, o=[at(a)]; for(let i=0;i<P.pts.length;i++) if(P.cum[i]>a+1e-4&&P.cum[i]<b-1e-4) o.push([P.pts[i][0],P.pts[i][1],P.Y[i]]); o.push(at(b)); return o; }
// the tunnel: a rectangular concrete tube, seen from inside; lamps and cable runs are in the texture
function w3dTunnelTex(){ if(w3d.tunTex) return; const T=w3d.T, c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d');
  g.fillStyle='#3a3e45'; g.fillRect(0,0,256,128); g.fillStyle='#2c2f35'; g.fillRect(0,92,256,36); g.fillStyle='rgba(255,255,255,.04)'; for(let i=0;i<90;i++) g.fillRect((i*53)%256,(i*29)%128,3,2);
  g.fillStyle='#23262b'; g.fillRect(0,0,7,128); g.fillRect(128,0,4,128); g.fillStyle='#1c1e22'; g.fillRect(0,34,256,2); g.fillRect(0,40,256,2); g.fillRect(0,70,256,3);
  g.fillStyle='#fff3cf'; g.fillRect(40,14,52,7); g.fillStyle='rgba(255,240,200,.16)'; g.fillRect(28,6,76,24); g.fillStyle='#e8c547'; g.fillRect(0,88,256,2); g.fillStyle='#4f9e62'; g.fillRect(180,52,14,9);
  const tx=new T.CanvasTexture(c); tx.wrapS=tx.wrapT=T.RepeatWrapping; tx.colorSpace=T.SRGBColorSpace; tx.anisotropy=8; w3d.tunTex=tx; }
// an open concrete trough: floor and two walls that rise a little above the street as parapets
function w3dTrough(pc,hw,top){ const T=w3d.T, n=pc.length, pos=[], idx=[];
  for(let i=0;i<n;i++){ const a=pc[Math.max(0,i-1)], b=pc[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l; const nx=-dz*hw, nz=dx*hw, x=pc[i][0], z=pc[i][1], y0=Math.min(pc[i][2]-0.0012,top-0.002);
    pos.push(x+nx,y0,z+nz, x-nx,y0,z-nz,  x+nx,y0,z+nz, x+nx,top,z+nz,  x-nx,y0,z-nz, x-nx,top,z-nz); }
  for(let i=0;i<n-1;i++){ const o=i*6, q=o+6; for(const k of [0,2,4]) idx.push(o+k,q+k,o+k+1, o+k+1,q+k,q+k+1); }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function w3dTube(pc,hw,h,faces){ const T=w3d.T, n=pc.length, pos=[], uv=[], col=[], idx=[]; let d=0;
  for(let i=0;i<n;i++){ const a=pc[Math.max(0,i-1)], b=pc[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l; const nx=-dz*hw, nz=dx*hw, x=pc[i][0], z=pc[i][1], y0=pc[i][2]-0.0012, y1=y0+h; if(i) d+=dist(pc[i-1][0],pc[i-1][1],x,z); const u=d/0.42;
    pos.push(x+nx,y0,z+nz, x-nx,y0,z-nz,  x+nx,y1,z+nz, x-nx,y1,z-nz,  x+nx,y0,z+nz, x+nx,y1,z+nz,  x-nx,y0,z-nz, x-nx,y1,z-nz);
    uv.push(u,0.02,u,0.02, u,0.98,u,0.98, u,0,u,1, u,0,u,1); for(let k=0;k<4;k++) col.push(0.42,0.42,0.42); for(let k=0;k<4;k++) col.push(1,1,1); }
  for(let i=0;i<n-1;i++){ const o=i*8, q=o+8; for(const k of (faces||[0,2,4,6])) idx.push(o+k,q+k,o+k+1, o+k+1,q+k,q+k+1); }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); g.setAttribute('color',new T.Float32BufferAttribute(col,3)); g.setIndex(idx); return g; }
/* Big stations are laid out the way real ones are. Lines that pass through a station in roughly the same direction
   are drawn together into parallel tracks side by side, each pair with its own platforms; lines that cross it in
   another direction get a level of their own, a deck higher on viaduct or a storey deeper underground, with ramps
   either side. So an interchange is a set of stacked, parallel platform groups, not tracks crossing in a star. */
function w3dStationPlan(){ const gap=DECK*2+0.012;
  for(const st of stations){ const here=[];
    for(const L of lines){ if(L.stops.length<2||!L._p3||!L._p3.sU) continue; const k=L.stops.indexOf(st.id); if(k<0) continue; const P=L._p3, u=P.sU[k]; here.push({P,u,h:polyHead(P.pts,P.cum,u,0.5),p:polyAt(P.pts,P.cum,u)}); }
    if(!here.length) continue; const cl=[];
    for(const o of here){ const c=cl.find(c=>Math.abs(c.ax[0]*o.h[0]+c.ax[1]*o.h[1])>0.72); if(c) c.m.push(o); else cl.push({ax:o.h.slice(),m:[o]}); }
    cl.sort((a,b)=>b.m.length-a.m.length); const under=w3dHAt(here[0].P,here[0].u)<0;
    cl.forEach((c,ci)=>{ const ax=c.ax, n=[-ax[1],ax[0]], dY=Math.min(ci,2)*(under?-0.066:0.07);
      c.m.forEach(o=>{ o.lat=(o.p[0]-st.x)*n[0]+(o.p[1]-st.y)*n[1]; }); c.m.sort((a,b)=>a.lat-b.lat);
      c.m.forEach((o,i)=>{ const want=c.m.length>1?(i-(c.m.length-1)/2)*gap:o.lat, P=o.P;
        for(let v=0;v<P.pts.length;v++){ const du=Math.abs(P.cum[v]-o.u); if(du>3.6) continue;
          if(du<1.9){ const w=1-smooth(du,0.75,1.9), q=P.pts[v], t=(q[0]-st.x)*ax[0]+(q[1]-st.y)*ax[1]; P.pts[v]=[q[0]+(st.x+ax[0]*t+n[0]*want-q[0])*w,q[1]+(st.y+ax[1]*t+n[1]*want-q[1])*w]; }
          if(dY) P.Y[v]+=dY*(1-smooth(du,1.0,3.6)); } }); }); }
  for(const L of lines){ const P=L._p3; if(!P||L.stops.length<2) continue; for(let i=1;i<P.pts.length;i++) P.cum[i]=P.cum[i-1]+dist(P.pts[i-1][0],P.pts[i-1][1],P.pts[i][0],P.pts[i][1]); } }
// where each stop of a line lies along its 3D path (searched near where it is expected, so stops stay in order)
const W3D_PLAT=0.8;                       // platform length in cells (120 m: a six-car train)
function w3dStopsOn(L){ const P=L._p3, len=P.cum[P.cum.length-1], sc=stopCum(L), tot=sc[sc.length-1]||1, out=[];
  L.stops.forEach((id,k)=>{ const s=stById(id), e=sc[k]/tot*len; let bd=1e9, bu=e; for(let i=1;i<P.pts.length;i++){ if(P.cum[i]<e-2||P.cum[i-1]>e+2) continue; const a=P.pts[i-1], b=P.pts[i], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1e-9, q=clamp(((s.x-a[0])*dx+(s.y-a[1])*dy)/l2,0,1), d=(a[0]+dx*q-s.x)**2+(a[1]+dy*q-s.y)**2; if(d<bd){ bd=d; bu=P.cum[i-1]+q*(P.cum[i]-P.cum[i-1]); } }
    out.push(k&&bu<out[k-1]?out[k-1]:bu); });
  if(L.loop) out.push(len); P.sU=out; P.sched=null; return out; }
// the parts of a polyline outside some intervals of its length
function w3dSubPolys(pts,cum,cuts){ const out=[], len=cum[cum.length-1], keep=[]; let u=0; for(const [a,b] of cuts.slice().sort((p,q)=>p[0]-q[0])){ if(a>u) keep.push([u,a]); u=Math.max(u,b); } if(u<len) keep.push([u,len]);
  for(const [a,b] of keep){ if(b-a<0.02) continue; const pc=[polyAt(pts,cum,a)]; for(let i=0;i<pts.length;i++) if(cum[i]>a&&cum[i]<b) pc.push(pts[i]); pc.push(polyAt(pts,cum,b)); out.push(pc); } return out; }
// the other trains keep a timetable: they brake into every station, wait, and pull away again, there and back
function w3dSched(L){ const P=L._p3; if(P.sched) return P.sched; const sU=P.sU||w3dStopsOn(L), v=isRapid(L)?W_SPD.rapid:W_SPD.ride, a=isRapid(L)?W_ACC.rapid:W_ACC.ride, dw=isRapid(L)?6:W_DWELL, legs=[];
  const leg=(u0,u1)=>{ const d=Math.abs(u1-u0); if(d<1e-4) return; legs.push({u0,u1,d,run:runTime(d,v,a),dw}); };
  for(let i=0;i<sU.length-1;i++) leg(sU[i],sU[i+1]); if(!L.loop) for(let i=sU.length-1;i>0;i--) leg(sU[i],sU[i-1]);
  let T=0; for(const l of legs){ l.t0=T; T+=l.run+l.dw; } return P.sched={legs,T,v,a}; }
// ---- buildings and trees round the viewer, rebuilt as the train travels
function w3dLocal(cx,cy){
  const j=w3d.lj;
  if(j){ // a rebuild is under way: keep at it, unless the viewer has jumped far from where it started
    if(dist(j.c[0],j.c[1],cx,cy)<20){ if(w3dRun(j,5)) w3d.lj=null; return; }
    j.it.return(); w3dClear([j.grp]); w3d.lj=null; }
  const far=!w3d.bc||!w3d.local.length||dist(w3d.bc[0],w3d.bc[1],cx,cy)>20;
  if(!far&&!w3d.bcStale&&dist(w3d.bc[0],w3d.bc[1],cx,cy)<9) return;
  w3d.bc=[cx,cy]; w3d.bcStale=false; const grp=new w3d.T.Group(); grp.visible=false; w3d.S.add(grp);
  const nj={it:w3dLocalGen(cx,cy,grp),grp,c:[cx,cy]};
  // a jump to a new train is built at once (the view changes anyway); travelling on, the next stretch is built in the background
  if(far) w3dRun(nj,Infinity); else if(!w3dRun(nj,5)) w3d.lj=nj; }
function* w3dLocalGen(cx,cy,grp){
  const T=w3d.T, dark=w3dDark(), add=m=>{ grp.add(m); return m; }; w3dTextures();
  w3dTerrain(); yield* w3dLocalGround(cx,cy,add); yield;
  // viaducts run over streets: keep buildings off the track corridor
  const near=new Set(); for(const L of lines){ if(L.stops.length<2||!L._p3) continue; const pts=L._p3.pts, Yv=L._p3.Y; for(let i=1;i<pts.length;i++){ if(Yv&&Yv[i]<-0.06&&Yv[i-1]<-0.06) continue; const a=pts[i-1], b=pts[i], n=Math.ceil(dist(a[0],a[1],b[0],b[1])*8); for(let k=0;k<=n;k++){ const x=lerp(a[0],b[0],k/n), y=lerp(a[1],b[1],k/n); if(Math.abs(x-cx)>34||Math.abs(y-cy)>34) continue; near.add(Math.floor(x*8)*100000+Math.floor(y*8)); } } }
  // stations are wider than the viaduct: keep their footprint clear too
  for(const z of (w3d.stSpots||[])){ if(Math.abs(z.x-cx)>34||Math.abs(z.y-cy)>34) continue; const nx=-z.hy, ny=z.hx;
    for(let a=-z.len/2;a<=z.len/2;a+=0.06) for(let c=-z.half;c<=z.half;c+=0.06){ const x=z.x+z.hx*a+nx*c, y=z.y+z.hy*a+ny*c; near.add(Math.floor(x*8)*100000+Math.floor(y*8)); } }
  yield;
  const hit=b=>{ const m=b.a?0.04+Math.abs(b.w-b.d)*0.5:0.04; for(let yy=Math.floor((b.y-m)*8);yy<=Math.floor((b.y+b.d+m)*8);yy++) for(let xx=Math.floor((b.x-m)*8);xx<=Math.floor((b.x+b.w+m)*8);xx++) if(near.has(xx*100000+yy)) return true; return false; };
  const R=30, house=[], spires=[], ind=(G.projects||[]).filter(p=>p.type==='p_ind'||p.type==='p_port'), bx=w3dBoxes();
  const HR=6, HN=2*(R+2)*HR, hg={x0:cx-R-2,y0:cy-R-2,res:HR,n:HN,a:new Float32Array(HN*HN)};
  const keys=new Set(), prevK=w3d.bKeys, prevC=w3d.bKC, hgrow=[]; let nBorn=0;
  bldInRect(cx-R,cy-R,cx+R,cy+R,b=>{ if(dist(b.x,b.y,cx,cy)>R||hit(b)) return;
    const bk=Math.round(b.x*40)*200003+Math.round(b.y*40), isNew=!!prevK&&!prevK.has(bk)&&dist(b.x,b.y,prevC[0],prevC[1])<R-2; keys.add(bk); if(isNew) nBorn++; bx.setBorn(isNew); const h0=house.length;
    { const q=bldCorners(b), hv=b.h*BZ3, i0=Math.max(0,Math.floor((Math.min(q[0],q[2],q[4],q[6])-hg.x0)*HR)), i1=Math.min(HN-1,Math.floor((Math.max(q[0],q[2],q[4],q[6])-hg.x0)*HR)), j0=Math.max(0,Math.floor((Math.min(q[1],q[3],q[5],q[7])-hg.y0)*HR)), j1=Math.min(HN-1,Math.floor((Math.max(q[1],q[3],q[5],q[7])-hg.y0)*HR));
      for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) if(hg.a[j*HN+i]<hv) hg.a[j*HN+i]=hv; } const i=Math.round(b.y)*W+Math.round(b.x), d=G.D[i]||0, hm=b.h*150, hh=hashInt(i*13+Math.round(b.x*97)+Math.round(b.y*61));
    if(b.sp==='church'){ house.push({x:b.x,y:b.y,w:b.w,d:b.d,h:b.h*1.25,r:(hh&~0xf0)|0x20,a:b.a||0,px:b.x+b.w/2,pz:b.y+b.d/2,wall:0xe9e3d7}); spires.push(b); return; }
    if(b.sp==='mall'){ bx.mall(b,hh); return; } if(b.sp==='school'){ bx.building(b,d,hh,true,'brick'); return; }
    if(ind.some(p=>dist(p.x,p.y,b.x,b.y)<6)&&hm<30){ bx.shed(b,hh); return; }
    if(hm<14&&d<0.5){ const nx=Math.max(1,Math.round(b.w/0.1)), ny=Math.max(1,Math.round(b.d/0.09)), sx=b.w/nx, sy=b.d/ny;   // a plot of detached houses
      for(let a=0;a<nx;a++) for(let c=0;c<ny;c++){ const r=hashInt(hh+a*31+c*7), one=nx*ny===1; house.push({born:isNew,x:b.x+a*sx+(one?0:sx*0.12),y:b.y+c*sy+(one?0:sy*0.12),w:one?sx:sx*(0.62+(r&15)/80),d:one?sy:sy*(0.6+((r>>4)&15)/80),h:b.h*(0.8+((r>>8)&15)/40),r,a:b.a||0,px:b.x+b.w/2,pz:b.y+b.d/2}); } return; }
    bx.building(b,d,hh,true); });
  yield;
  // houses: plastered or sided walls under pitched roofs in tile, slate or sheet metal, the ridge along the longer side
  if(house.length){ const M=new T.Matrix4(), R=new T.Matrix4(), Pv=new T.Matrix4(), col=new T.Color(), mats=w3dMats(), hw=new T.InstancedMesh(w3dUnit(),mats.houseWall,house.length), turn=o=>{ if(o.a){ R.makeRotationY(-o.a); Pv.makeTranslation(o.px,0,o.pz); M.premultiply(Pv.clone().invert()).premultiply(R).premultiply(Pv); } };
    house.forEach((o,i)=>{ M.makeScale(o.w,o.h*BZ3*0.7,o.d).setPosition(o.x,0,o.y); turn(o); hw.setMatrixAt(i,M); if(o.born) hgrow.push(f=>{ M.makeScale(o.w,Math.max(o.h*BZ3*0.7*f,1e-4),o.d).setPosition(o.x,0,o.y); turn(o); hw.setMatrixAt(i,M); hw.instanceMatrix.needsUpdate=true; }); col.set(o.wall||W3D_HOUSE[o.r%W3D_HOUSE.length]); hw.setColorAt(i,col); }); hw.castShadow=hw.receiveShadow=true; add(hw);
    for(const ax of [0,1]){ const L=house.filter(o=>(o.w>=o.d)===(ax===0)); if(!L.length) continue; const rm=new T.InstancedMesh(w3dRoofGeo(ax),mats.houseRoof,L.length);
      L.forEach((o,i)=>{ const ex=0.012; M.makeScale(o.w+ex,o.h*BZ3*(0.4+((o.r>>14)&7)/40),o.d+ex).setPosition(o.x-ex/2,o.h*BZ3*0.7,o.y-ex/2); turn(o); rm.setMatrixAt(i,M); if(o.born) hgrow.push(f=>{ M.makeScale(o.w+ex,Math.max(o.h*BZ3*(0.4+((o.r>>14)&7)/40)*smooth(f,0.7,1),1e-4),o.d+ex).setPosition(o.x-ex/2,o.h*BZ3*0.7*f,o.y-ex/2); turn(o); rm.setMatrixAt(i,M); rm.instanceMatrix.needsUpdate=true; }); col.set(W3D_ROOF[(o.r>>4)%W3D_ROOF.length]); rm.setColorAt(i,col); });
      rm.castShadow=rm.receiveShadow=true; add(rm); } }
  yield;
  // blocks and towers, grouped by facade so each kind is one draw call
  for(const m of bx.meshes(true)){ add(m); yield; }
  // trees: in parks and woods, and lining residential streets
  const M=new T.Matrix4(), col=new T.Color(), trees=[]; const r2=24;
  for(let y=Math.floor(cy-r2);y<=cy+r2;y++) for(let x=Math.floor(cx-r2);x<=cx+r2;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]) continue; const pk=G.pk[i], d=G.D[i];
    const n=pk>0.27?7:pk>0.255?4:(pk>0.12&&d<0.05)?5:d>0.06&&d<0.45?3:d<0.9?1:0;   /* woods, parks, gardens */ for(let k=0;k<n;k++){ const h=hashInt(i*59+k*7919), tx=x-0.5+(h&1023)/1023, ty=y-0.5+((h>>10)&1023)/1023; if(dist(tx,ty,cx,cy)>r2||near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) continue; trees.push([tx,ty,0.7+((h>>20)&255)/255*0.7,h]); } }
  for(let y=Math.floor(cy-r2);y<=cy+r2;y++) for(let x=Math.floor(cx-r2);x<=cx+r2;x++){ const hf=w3dFieldAt(x,y); if(hf<0) continue; const eE=w3dFieldAt(x+1,y)>>3!==hf>>3, eS=w3dFieldAt(x,y+1)>>3!==hf>>3;
    for(let k=0;k<5;k++){ const q=hashInt(hf+k*131+x*17+y); if((q&3)>1) continue; const tt=((q>>4)&255)/255-0.5; let tx,ty; if(eE&&(k&1)){ tx=x+0.5; ty=y+tt; } else if(eS){ tx=x+tt; ty=y+0.5; } else continue; if(dist(tx,ty,cx,cy)<r2&&!near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) trees.push([tx,ty,0.8+((q>>12)&63)/90,q]); } }
  const Rn=G.rn; if(Rn) for(let gy=Math.floor((cy-14)/RN_G);gy<=Math.floor((cy+14)/RN_G);gy++) for(let gx=Math.floor((cx-14)/RN_G);gx<=Math.floor((cx+14)/RN_G);gx++){ const a=Rn.eg.get(rnKey(gx,gy)); if(!a) continue;
    for(const e of a){ if(Rn.ec[e]<1||Rn.ec[e]>3||trees.length>14000) continue; const p=Rn.ea[e], q=Rn.eb[e], L=dist(Rn.x[p],Rn.y[p],Rn.x[q],Rn.y[q]); const dx=(Rn.x[q]-Rn.x[p])/(L||1), dy=(Rn.y[q]-Rn.y[p])/(L||1), off=[0,0.06,0.075,0.09][Rn.ec[e]];
      for(let s=0.06;s<L-0.04;s+=0.1) for(const sd of [1,-1]){ const tx=Rn.x[p]+dx*s-dy*off*sd, ty=Rn.y[p]+dy*s+dx*off*sd, ci=Math.round(ty)*W+Math.round(tx); const dd=G.D[ci]||0; if(dd<0.06||dd>1.3||G.water[ci]) continue;
        const h=hashInt(e*977+Math.round(s*100)*3+(sd>0?1:0)); if((h&3)===0||near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) continue; trees.push([tx,ty,0.55+((h>>20)&255)/255*0.35,h]); } } }
  yield;
  // streets as real surfaces near the viewer, the grounds and furniture of parks, squares and the rest, parked cars
  { const rm=w3dRoadMesh(cx,cy,24); if(rm) add(rm); } yield;
  { const fp=w3dFeatures(cx,cy,26,(x,y,sc,h)=>{ if(!near.has(Math.floor(x*8)*100000+Math.floor(y*8))) trees.push([x,y,sc,h]); },spires); for(const m of fp) add(m); } yield;
  if(trees.length){ const greens=dark?[0x2e4a2c,0x34522f,0x2a4230]:[0x5f8f45,0x6e9a4c,0x4f7f3f,0x7aa356,0x587f3a], V=new T.Vector3(), Q=new T.Quaternion(), Sc=new T.Vector3(), up=new T.Vector3(0,1,0);
    const mk=(list,det,shadow)=>{ if(!list.length) return; const tg=w3dMerge([{g:new T.CylinderGeometry(0.0012,0.0018,0.012,5),m:new T.Matrix4().makeTranslation(0,0.006,0),c:0x6b5440},{g:new T.IcosahedronGeometry(0.0085,det),m:new T.Matrix4().makeTranslation(0,0.017,0),c:0xffffff}]);
      const tm=new T.InstancedMesh(tg,w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.95,flatShading:det===0})),list.length);
      list.forEach((p,i)=>{ Q.setFromAxisAngle(up,(p[3]&255)/40); Sc.set(p[2],p[2]*(0.9+((p[3]>>8)&63)/150),p[2]); M.compose(V.set(p[0],w3dHt(p[0],p[1]),p[1]),Q,Sc); tm.setMatrixAt(i,M); col.set(greens[p[3]%greens.length]); tm.setColorAt(i,col); });
      tm.castShadow=shadow; tm.receiveShadow=true; add(tm); };
    mk(trees.filter(p=>dist(p[0],p[1],cx,cy)<=8),1,true); yield; mk(trees.filter(p=>dist(p[0],p[1],cx,cy)>8),0,false); }
  yield;
  // the skyline further out: the same facades, without shadows, softened by the haze
  { const fb=w3dBoxes(); bldInRect(cx-70,cy-70,cx+70,cy+70,b=>{ const dd=dist(b.x,b.y,cx,cy); if(dd>R&&dd<70&&b.h>0.1){ const i=Math.round(b.y)*W+Math.round(b.x); fb.building(b,G.D[i]||0,hashInt(i*13+Math.round(b.x*97)+Math.round(b.y*61)),false); } });
    for(const m of fb.meshes(false)){ add(m); yield; } }
  // traffic on the streets near the line
  yield; const cars=w3dCars(cx,cy,add);
  // what was not here at the last look goes up over a quarter of a minute rather than appearing between two frames
  const G2=nBorn>0&&nBorn<700?{t:0,bx,hgrow}:null; if(G2){ bx.growTo(0); hgrow.forEach(f=>f(0)); }
  return ()=>{ grp.visible=true; w3dTrash(w3d.local); w3d.local=[grp]; w3d.cars=cars; w3d.hg=hg; w3d.bKeys=keys; w3d.bKC=[cx,cy]; w3d.grow=G2; }; }
// Streets near the viewer as geometry rather than paint: pavements, a roadway inside them, junctions rounded off,
// centre and lane lines, zebra crossings on the bigger roads. Drawn straight over the ground in three passes
// (pavement, roadway, paint), so every edge is sharp at any distance and angle.
function w3dRoadMesh(cx,cy,R){
  const T=w3d.T, Rn=G.rn; if(!Rn) return null; const Ls=[[],[],[]], Cs=[[],[],[]], col=new T.Color(), Y=0.0007;
  const quad=(L,ax,az,bx,bz,hw,c,lat)=>{ let dx=bx-ax, dz=bz-az; const l=Math.hypot(dx,dz); if(l<1e-5) return; dx/=l; dz/=l; const nx=-dz, nz=dx, o=lat||0; ax+=nx*o; az+=nz*o; bx+=nx*o; bz+=nz*o;
    Ls[L].push(ax+nx*hw,Y,az+nz*hw, bx+nx*hw,Y,bz+nz*hw, bx-nx*hw,Y,bz-nz*hw, ax+nx*hw,Y,az+nz*hw, bx-nx*hw,Y,bz-nz*hw, ax-nx*hw,Y,az-nz*hw); col.set(c); for(let k=0;k<6;k++) Cs[L].push(col.r,col.g,col.b); };
  const disc=(L,x,z,r,c)=>{ col.set(c); for(let k=0;k<8;k++){ const a0=k*Math.PI/4, a1=(k+1)*Math.PI/4; Ls[L].push(x,Y,z, x+Math.cos(a1)*r,Y,z+Math.sin(a1)*r, x+Math.cos(a0)*r,Y,z+Math.sin(a0)*r); for(let q=0;q<3;q++) Cs[L].push(col.r,col.g,col.b); } };
  const es=[], seen=new Set(), nodes=new Map(); for(let gy=Math.floor((cy-R)/RN_G);gy<=Math.floor((cy+R)/RN_G);gy++) for(let gx=Math.floor((cx-R)/RN_G);gx<=Math.floor((cx+R)/RN_G);gx++){ const l=Rn.eg.get(rnKey(gx,gy)); if(l) for(const e of l) if(!seen.has(e)){ seen.add(e); es.push(e); } }
  if(!es.length) return null; const PAVE=0xcbc8c0, ASPH=[0x5d6066,0x55585e,0x4f5258,0x4a4d53,0x45484e], hwP=c=>ROAD_W[c]/2, hwA=c=>c===4?ROAD_W[c]/2-0.004:ROAD_W[c]/2-0.014;
  for(const e of es){ const c=Rn.ec[e]; for(const n of [Rn.ea[e],Rn.eb[e]]){ const o=nodes.get(n); if(!o) nodes.set(n,{p:hwP(c),a:hwA(c),c}); else { o.p=Math.max(o.p,hwP(c)); o.a=Math.max(o.a,hwA(c)); o.c=Math.max(o.c,c); } } }
  for(const e of es){ const c=Rn.ec[e], a=Rn.ea[e], b=Rn.eb[e], ax=Rn.x[a], az=Rn.y[a], bx=Rn.x[b], bz=Rn.y[b], l=Math.hypot(bx-ax,bz-az); if(l<1e-4) continue; const dx=(bx-ax)/l, dz=(bz-az)/l;
    if(c<4) quad(0,ax,az,bx,bz,hwP(c),PAVE); else quad(0,ax,az,bx,bz,hwP(c),0x8d9096); quad(1,ax,az,bx,bz,hwA(c),ASPH[c]);
    if(c<1) continue; const da=Rn.adj[a].length, db=Rn.adj[b].length, zeb=c>=2&&c<4, ta=da>=3?nodes.get(a).a+(zeb?0.026:0.006):0, tb=db>=3?nodes.get(b).a+(zeb?0.026:0.006):0; if(l-ta-tb<0.03) continue;
    const seg=(s0,s1,hw,cc,lat)=>quad(2,ax+dx*s0,az+dz*s0,ax+dx*s1,az+dz*s1,hw,cc,lat), dash=(lat,cc)=>{ for(let q=ta;q<l-tb-0.02;q+=0.07) seg(q,Math.min(q+0.03,l-tb),0.0011,cc,lat); };
    if(c===1) seg(ta,l-tb,0.0009,0xbfc1c4,0); else if(c===2) dash(0,0xe6e6e6); else { seg(ta,l-tb,0.001,0xe3c04a,0.0018); seg(ta,l-tb,0.001,0xe3c04a,-0.0018); dash(hwA(c)*0.5,0xe6e6e6); dash(-hwA(c)*0.5,0xe6e6e6); if(c===4){ seg(ta,l-tb,0.001,0xe6e6e6,hwA(c)-0.004); seg(ta,l-tb,0.001,0xe6e6e6,-hwA(c)+0.004); } }
    if(zeb) for(const [dg,s0] of [[da,nodes.get(a).a+0.004],[db,l-nodes.get(b).a-0.02]]){ if(dg<3) continue; for(let o=-hwA(c)+0.005;o<hwA(c)-0.003;o+=0.008) seg(s0,s0+0.016,0.002,0xe9e9e9,o); } }
  for(const [n,o] of nodes){ const x=Rn.x[n], z=Rn.y[n]; if(o.c<4) disc(0,x,z,o.p,PAVE); disc(1,x,z,o.a,ASPH[o.c]); }
  const pos=[].concat(Ls[0],Ls[1],Ls[2]), cl=[].concat(Cs[0],Cs[1],Cs[2]), nor=new Float32Array(pos.length); for(let i=1;i<nor.length;i+=3) nor[i]=1;
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(cl,3));
  const m=new T.Mesh(g,w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.93,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,...w3dCut()}))); m.renderOrder=-3; m.receiveShadow=true; return m; }
const w3dCarGeo=()=>w3dMerge([w3dBox(0.028,0.008,0.012,0,0.005,0,0xffffff),w3dBox(0.016,0.006,0.011,-0.002,0.011,0,0x2b3440)]);
// What stands in the parks, squares, playgrounds, pitches, car parks and churchyards near the viewer. Everything is
// placed from the plot's own number, so a place looks the same every time it is passed.
function w3dFeatures(cx,cy,R,addTree,spires){
  const T=w3d.T, parts=[], flat=[], cars=[], out=[];
  const GC={park:0x6fa055,play:0xd9bd84,plaza:0xcfc8b8,pitch:0x5b9846,lot:0x55585e,school:0xc9b38d,church:0x6fa055,mall:0x55585e};
  bldFeatInRect(cx-R,cy-R,cx+R,cy+R,f=>{ const fx=f.x+f.w/2, fz=f.y+f.d/2; if(dist(fx,fz,cx,cy)>R) return;
    const Fm=new T.Matrix4().makeTranslation(fx,0,fz).multiply(new T.Matrix4().makeRotationY(-f.a)), hw=f.w/2, hd=f.d/2;
    const B=(w,h,d,x,y,z,c,list)=>{ const q=w3dBox(w,h,d,x,y,z,c); q.m=Fm.clone().multiply(q.m); (list||parts).push(q); }, Gd=(w,d,x,z,c,y)=>B(w,0.0004,d,x,(y||0.0012),z,c,flat);
    const Cy=(r,h,x,y,z,c,seg,sx,sz)=>{ parts.push({g:new T.CylinderGeometry(r,r,h,seg||14),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(x,y+h/2,z)).multiply(new T.Matrix4().makeScale(sx||1,1,sz||1)),c}); };
    let h=f.r; const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
    Gd(f.w,f.d,0,0,GC[f.k]);
    const lamp=(x,z)=>{ B(0.0012,0.028,0.0012,x,0.014,z,0x5a6068); B(0.005,0.0015,0.0025,x,0.0285,z,0xf2efe2); }, bench=(x,z,r)=>B(r?0.004:0.014,0.003,r?0.014:0.004,x,0.0025,z,0x7a5a3c);
    if(f.k==='park'||f.k==='church'){ let q=f.r; const n=Math.round(f.w*f.d*(f.k==='park'?34:16));
      for(let k=0;k<n;k++){ q=hashInt(q+k); const u=((q&1023)/1023*2-1)*0.9, v=(((q>>10)&1023)/1023*2-1)*0.9; if(f.k==='church'&&Math.abs(u)<0.6&&v<0.7) continue; if(Math.abs(u)<0.12||Math.abs(v)<0.1) continue; const c=featPt(f,u,v); addTree(c[0],c[1],0.75+((q>>20)&63)/63*0.7,q); }
      if(f.k==='park'){ Gd(f.w,0.014,0,0,0xd8cfb6,0.0016); Gd(0.014,f.d,0,0,0xd8cfb6,0.0016); bench(hw*0.5,0.012); bench(-hw*0.5,-0.012); bench(0.012,hd*0.5,1); lamp(0.012,0.012); lamp(-hw*0.7,0.012); lamp(hw*0.7,-0.012);
        if(f.w>0.7){ Cy(f.w*0.14,0.0008,hw*0.45,0.0012,hd*0.45,0x4f88b5,18,1,f.d*0.12/(f.w*0.14)); } else if(rnd()<0.5){ Cy(0.016,0.004,hw*0.4,0.0012,-hd*0.4,0xbdb8ad,12); B(0.02,0.012,0.02,hw*0.4,0.01,-hd*0.4,0x8a5a3c); } }
      else { B(0.004,0.006,f.d*0.9,-hw+0.004,0.003,0,0xb9b3a6); B(0.004,0.006,f.d*0.9,hw-0.004,0.003,0,0xb9b3a6); } }
    else if(f.k==='plaza'){ const r=Math.min(f.w,f.d)*0.2; for(let k=-2;k<=2;k++){ Gd(f.w,0.002,0,k*f.d/5.2,0xbdb6a5,0.0015); Gd(0.002,f.d,k*f.w/5.2,0,0xbdb6a5,0.0015); }
      if(rnd()<0.6){ Cy(r,0.005,0,0.0012,0,0xbdb8ad,18); Cy(r*0.86,0.0054,0,0.0012,0,0x5a9ac8,18); Cy(r*0.14,0.02,0,0.0012,0,0xcfcac0,10); Cy(r*0.34,0.002,0,0.02,0,0xcfcac0,10); }
      else { B(r*0.9,0.01,r*0.9,0,0.006,0,0xbdb8ad); B(r*0.28,0.05,r*0.28,0,0.036,0,0x8f9aa3); Cy(r*0.2,0.006,0,0.061,0,0x7d8791,8); }
      for(const [u,v] of [[-0.7,-0.7],[0.7,-0.7],[0.7,0.7],[-0.7,0.7]]){ const c=featPt(f,u,v); addTree(c[0],c[1],0.8,hashInt(f.r+u*7+v*13)); lamp(u*hw*0.5,v*hd*0.9); } bench(hw*0.55,0); bench(-hw*0.55,0); bench(0,hd*0.6,1); bench(0,-hd*0.6,1);
      for(let k=0;k<3;k++) B(0.012,0.0012,0.012,(rnd()-0.5)*f.w*0.6,0.011,hd*0.82,[0xd9534f,0x3f7fbf,0xe0a030][k]); }       /* market umbrellas along one side */
    else if(f.k==='play'){ const x1=-hw*0.45, z1=-hd*0.2; for(const sx of [-0.012,0.012]){ B(0.0012,0.016,0.0012,x1+sx,0.008,z1-0.006,0xd9534f); B(0.0012,0.016,0.0012,x1+sx,0.008,z1+0.006,0xd9534f); } B(0.026,0.0012,0.0012,x1,0.016,z1,0xd9534f); B(0.004,0.0008,0.003,x1-0.005,0.006,z1,0x2f3440); B(0.004,0.0008,0.003,x1+0.006,0.006,z1,0x2f3440);
      const x2=hw*0.4, z2=hd*0.3; B(0.012,0.014,0.012,x2,0.007,z2,0x3f7fbf); B(0.014,0.003,0.014,x2,0.0155,z2,0xe0a030); { const q=w3dBox(0.03,0.0012,0.007,0,0,0,0xe0c040); q.m=Fm.clone().multiply(new T.Matrix4().makeTranslation(x2-0.019,0.0075,z2)).multiply(new T.Matrix4().makeRotationZ(0.42)); parts.push(q); }
      parts.push({g:new T.IcosahedronGeometry(0.011,0),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(-hw*0.1,0.004,hd*0.5)),c:0x4f9e62}); B(0.024,0.0015,0.003,hw*0.1,0.004,-hd*0.55,0x7a5aa6); B(0.002,0.004,0.004,hw*0.1,0.002,-hd*0.55,0x5a6068);
      Gd(f.w*0.3,f.d*0.3,hw*0.45,-hd*0.5,0xe6d3a3,0.0016); bench(-hw*0.75,hd*0.7); const c=featPt(f,0.6,-0.6); addTree(c[0],c[1],0.9,f.r); B(f.w,0.004,0.0008,0,0.002,-hd,0x8fa37a); B(f.w,0.004,0.0008,0,0.002,hd,0x8fa37a); }
    else if(f.k==='pitch'){ const big=f.w>0.5, wl=0xf2f2f2, m=0.9; if(!big) Gd(f.w*0.92,f.d*0.9,0,0,(f.r&1)?0x3f6fa8:0xb5553c,0.0016); else for(let k=0;k<6;k+=2) Gd(f.w*m/6,f.d*m,(-2.5+k)*f.w*m/6,0,0x66a550,0.0015);
      const ln=(w,d,x,z)=>Gd(w,d,x,z,wl,0.002); ln(f.w*m,0.0025,0,-hd*m); ln(f.w*m,0.0025,0,hd*m); ln(0.0025,f.d*m,-hw*m,0); ln(0.0025,f.d*m,hw*m,0); ln(0.0025,f.d*m,0,0);
      for(const sx of [-1,1]){ const x=sx*hw*m; if(big){ B(0.0012,0.012,0.0012,x,0.006,-0.024,wl); B(0.0012,0.012,0.0012,x,0.006,0.024,wl); B(0.0012,0.0012,0.05,x,0.012,0,wl); ln(f.w*0.14,0.0025,x-sx*f.w*0.07,-hd*0.45); ln(f.w*0.14,0.0025,x-sx*f.w*0.07,hd*0.45); ln(0.0025,f.d*0.45,x-sx*f.w*0.14,0); } else { B(0.0012,0.02,0.0012,x,0.01,0,0x5a6068); B(0.001,0.007,0.01,x-sx*0.003,0.019,0,wl); } }
      if(big){ B(f.w*0.5,0.008,0.012,0,0.004,-hd-0.01,0x9aa3ad); B(f.w*0.5,0.008,0.008,0,0.01,-hd-0.016,0x8a939d); for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ B(0.0016,0.05,0.0016,u*hw,0.025,v*hd,0x6a7078); B(0.01,0.003,0.006,u*hw,0.051,v*hd,0xf4f1e4); } } }
    else if(f.k==='lot'||f.k==='mall'){ const v0=f.k==='mall'?0.38:-0.82, rows=[[v0,1],[0.86,-1]], n=Math.max(3,Math.round(f.w/0.035));
      for(const [v,sd] of rows) for(let k=0;k<=n;k++){ const u=-0.92+1.84*k/n; Gd(0.0016,f.d*0.15,u*hw,(v+sd*0.15)*hd,0xe6e6e6,0.0016); if(k<n&&rnd()<0.62) cars.push([...featPt(f,u+0.92/n,v+sd*0.15),f.a+(sd>0?1:-1)*Math.PI/2,(h>>>8)&7]); }
      lamp(0,(v0+0.86)/2*hd); if(f.k==='lot') B(0.014,0.012,0.01,-hw+0.012,0.006,-hd+0.01,0xe0a030); }
    else if(f.k==='school'){ Gd(f.w*0.5,f.d*0.42,hw*0.4,hd*0.42,0x3f6fa8,0.0016); for(const sx of [-1,1]){ B(0.0012,0.02,0.0012,hw*0.4+sx*f.w*0.23,0.01,hd*0.42,0x5a6068); } B(0.001,0.045,0.001,-hw*0.1,0.0225,hd*0.2,0xc9ced4); B(0.012,0.007,0.0006,-hw*0.1+0.006,0.041,hd*0.2,0xd9534f);
      B(f.w,0.006,0.001,0,0.003,hd,0x7d8791); B(0.001,0.006,f.d,hw,0.003,0,0x7d8791); const c=featPt(f,0.8,-0.1); addTree(c[0],c[1],1,f.r); const c2=featPt(f,-0.2,0.8); addTree(c2[0],c2[1],0.9,f.r+3); } });
  // church towers and spires
  for(const b of spires){ const Fm=new T.Matrix4().makeTranslation(b.x+b.w/2,0,b.y+b.d/2).multiply(new T.Matrix4().makeRotationY(-(b.a||0))), hN=b.h*BZ3*1.25, tw=Math.min(b.w,0.045), q=w3dBox(tw,hN*1.7,tw,0,hN*0.85,b.d/2-tw/2,0xe4ded2); q.m=Fm.clone().multiply(q.m); parts.push(q);
    parts.push({g:new T.ConeGeometry(tw*0.78,hN*0.9,4),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(0,hN*1.7+hN*0.45,b.d/2-tw/2)).multiply(new T.Matrix4().makeRotationY(Math.PI/4)),c:0x5a6068}); }
  if(flat.length){ const m=new T.Mesh(w3dMerge(flat),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.95,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,...w3dCut()}))); m.receiveShadow=true; m.renderOrder=-2; out.push(m); }
  if(parts.length){ const m=new T.Mesh(w3dMerge(parts),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.7,metalness:0.05}))); m.castShadow=true; m.receiveShadow=true; out.push(m); }
  if(cars.length){ const cols=[0xf2f2f2,0x1f2329,0xb7bcc3,0xa1262c,0x2c4d7a,0x6c7076,0xe0e0dc,0x3b3f45], m=new T.InstancedMesh(w3dCarGeo(),new T.MeshStandardMaterial({vertexColors:true,roughness:0.35,metalness:0.4}),cars.length), M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1), col=new T.Color();
    cars.forEach((c,i)=>{ Q.setFromAxisAngle(up,-c[2]); M.compose(V.set(c[0],0.0012,c[1]),Q,one); m.setMatrixAt(i,M); col.set(cols[c[3]]); m.setColorAt(i,col); }); m.castShadow=true; m.receiveShadow=true; out.push(m); }
  return out; }
function w3dCars(cx,cy,add){
  const T=w3d.T, Rn=G.rn; if(!Rn) return null; const E=[];
  for(let gy=Math.floor((cy-7)/RN_G);gy<=Math.floor((cy+7)/RN_G);gy++) for(let gx=Math.floor((cx-7)/RN_G);gx<=Math.floor((cx+7)/RN_G);gx++){ const a=Rn.eg.get(rnKey(gx,gy)); if(a) for(const e of a) if(!E.includes(e)) E.push(e); }
  if(!E.length) return null; const n=Math.min(260,E.length*3), cars=[];
  for(let i=0;i<n;i++){ const e=E[Math.floor(Math.random()*E.length)]; cars.push({e,t:Math.random(),fwd:Math.random()<0.5,v:0.18+Math.random()*0.12}); }
  const g=w3dCarGeo();
  const cols=[0xf2f2f2,0x1f2329,0xb7bcc3,0xa1262c,0x2c4d7a,0x6c7076,0xe0e0dc,0x3b3f45], m=new T.InstancedMesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:0.35,metalness:0.4}),n), col=new T.Color();
  for(let i=0;i<n;i++){ col.set(cols[i%cols.length]); m.setColorAt(i,col); } m.castShadow=true; add(m); return {m,cars,E}; }
function w3dCarsTick(dt){
  const c=w3d.cars; if(!c) return; const T=w3d.T, Rn=G.rn, M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1);
  c.cars.forEach((o,i)=>{ const a=Rn.ea[o.e], b=Rn.eb[o.e], ax=Rn.x[a], ay=Rn.y[a], bx=Rn.x[b], by=Rn.y[b], L=Math.hypot(bx-ax,by-ay)||0.1;
    o.t+=dt*o.v/L*(o.fwd?1:-1); if(o.t>1||o.t<0){ const nd=o.t>1?b:a, nx=Rn.adj[nd].filter(e=>e!==o.e); if(nx.length&&c.E.length){ o.e=nx[Math.floor(Math.random()*nx.length)]; o.fwd=Rn.ea[o.e]===nd; o.t=o.fwd?0:1; } else { o.fwd=!o.fwd; o.t=clamp(o.t,0,1); } return; }
    const dx=(bx-ax)/L, dy=(by-ay)/L, s=o.fwd?1:-1, lane=0.012*s, x=ax+(bx-ax)*o.t-dy*lane, y=ay+(by-ay)*o.t+dx*lane;
    Q.setFromAxisAngle(up,-Math.atan2(dy*s,dx*s)); M.compose(V.set(x,0.0005,y),Q,one); c.m.setMatrixAt(i,M); });
  c.m.instanceMatrix.needsUpdate=true; }
// near the viewer the ground is redrawn sharp: 56 px per cell (about 2.7 m a pixel) so kerbs, lane markings and paths read from the train
function* w3dLocalGround(cx,cy,add){
  const T=w3d.T, B=G.bounds, S=26, K=56, x0=Math.max(B[0]-0.5,Math.round(cx)-S/2-0.5), y0=Math.max(B[1]-0.5,Math.round(cy)-S/2-0.5), sw=Math.min(S,B[2]-0.5-x0), sh=Math.min(S,B[3]-0.5-y0); if(sw<=0||sh<=0) return;
  const dark=w3dDark(), GK=6, gc=w3d.groundCanvas; if(!gc) return;
  // texture: grain in grass and paving
  if(!w3d.noise){ const n=document.createElement('canvas'); n.width=n.height=128; const ng=n.getContext('2d'), id=ng.createImageData(128,128); for(let i=0;i<id.data.length;i+=4){ const v=128+((hashInt(i)&255)-128)*0.5; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } ng.putImageData(id,0,0); w3d.noise=n; }
  const E=w3dEdgesIn(x0,y0,x0+sw,y0+sh), wc=dark?'#1c3550':'#3f7aa8', wd=ROAD_W.map(w=>w-0.03), pave=dark?'#5d5f66':'#d6d3cb', asph=dark?'#2a2c31':'#55585f'; yield;
  yield* w3dTiles(x0,y0,sw,sh,0.0004,3,K,(g,tx0,ty0,tw,th,k)=>{ const cv=g.canvas;
      g.drawImage(gc,(tx0-(B[0]-0.5))*GK,(ty0-(B[1]-0.5))*GK,tw*GK,th*GK,0,0,cv.width,cv.height);
      g.globalAlpha=0.07; g.globalCompositeOperation='overlay'; g.fillStyle=g.createPattern(w3d.noise,'repeat'); g.fillRect(0,0,cv.width,cv.height); g.globalAlpha=1; g.globalCompositeOperation='source-over';
      g.setTransform(k,0,0,k,-tx0*k,-ty0*k); g.lineCap='butt'; w3dFields(g,tx0,ty0,tx0+tw,ty0+th,true); g.lineCap='round'; g.lineJoin='round';
      g.strokeStyle=dark?'#3a3a30':'#b9ad8c'; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18)+0.03; g.stroke(r.p); } g.strokeStyle=wc; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18); g.stroke(r.p); }
      // footpaths wandering through the parks
      g.strokeStyle=dark?'#4d4a40':'#d8cfb6'; g.lineWidth=0.018; g.beginPath();
      for(let y=Math.floor(ty0);y<ty0+th+1;y++) for(let x=Math.floor(tx0);x<tx0+tw+1;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]||G.pk[i]<0.27) continue; const h=hashInt(i*17+3);
        g.moveTo(x-0.5,y-0.5+((h&255)/255)); g.bezierCurveTo(x-0.1,y-0.3,x+0.1,y+0.3,x+0.5,y-0.5+(((h>>8)&255)/255)); } g.stroke();
      if(P2.rail){ g.strokeStyle=dark?'#4a443e':'#9a8f84'; g.lineWidth=0.09; g.stroke(P2.rail); g.strokeStyle=dark?'#2a2a2a':'#4a4440'; g.lineWidth=0.006; for(const o of [-0.012,0.012]){ g.save(); g.translate(0,o); g.stroke(P2.rail); g.restore(); } }
      w3dStreets(g,w3dEdgesIn(tx0,ty0,tx0+tw,ty0+th,E),wd,[[0.034,pave],[0.006,dark?'#3a3c42':'#777a80'],[0,asph],[-0.0035,k=>k===4?'#e8c547':'rgba(255,255,255,.85)',k=>k===4?[]:[0.025,0.03],2]]); },
    null,tx=>w3dSee(new T.MeshStandardMaterial({map:tx,roughness:0.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,...w3dCut()})),m=>{ m.renderOrder=-4; add(m); }); }
// a point a given fraction along a line's 3D path (with its bundle offset)
function w3dOn(L,f,dir){ const P=L._p3; if(!P||P.pts.length<2){ const g=trainAt(L,0); return {x:g.x,y:g.y,hx:1,hy:0}; } const len=P.cum[P.cum.length-1], u=clamp(f,0,1)*len, i=Math.max(1,trainSeg(P.cum,u)), q=(u-P.cum[i-1])/((P.cum[i]-P.cum[i-1])||1), a=P.pts[i-1], b=P.pts[i];
  const hx=(b[0]-a[0])*(dir||1), hy=(b[1]-a[1])*(dir||1), hl=Math.hypot(hx,hy)||1; return {x:lerp(a[0],b[0],q),y:lerp(a[1],b[1],q),hx:hx/hl,hy:hy/hl}; }
// the other trains in 3D: same timetable-free shuttle as the map, at the calm viewing pace
function w3dTrainPos(tr,k){ const P=tr.L._p3, S=w3dSched(tr.L), len=P.cum[P.cum.length-1]; if(!S.legs.length){ const p=polyAt(P.pts,P.cum,0), h=polyHead(P.pts,P.cum,0); return {x:p[0],y:p[1],hx:h[0],hy:h[1],f:0,dir:1,u:0}; }
  const tt=(((w3d.tt||0)+k*S.T/tr.n)%S.T+S.T)%S.T; let lg=S.legs[S.legs.length-1]; for(const l of S.legs) if(tt<l.t0+l.run+l.dw){ lg=l; break; }
  const dir=lg.u1>=lg.u0?1:-1, r=tt-lg.t0, u=r<lg.run?lg.u0+dir*runAt(lg.d,S.v,S.a,r)[0]:lg.u1, uu=((u%len)+len)%len, p=polyAt(P.pts,P.cum,uu), h=polyHead(P.pts,P.cum,uu,0.15);
  return {x:p[0],y:p[1],hx:h[0]*dir,hy:h[1]*dir,f:uu/len,dir,u:uu}; }
// the cars of one train, each set on the track at its own place and heading, so the train bends through curves and ramps
function w3dSetCars(mesh,base,L,u,dir){ const off=(dir<0?-1:1)*W3D_TO; const T=w3d.T, P=L._p3, len=P.cum[P.cum.length-1], M=w3dSetCars.M||(w3dSetCars.M=new T.Matrix4()), Q=w3dSetCars.Q||(w3dSetCars.Q=new T.Quaternion()), V=w3dSetCars.V||(w3dSetCars.V=new T.Vector3()), Sc=w3dSetCars.S||(w3dSetCars.S=new T.Vector3(1,1,1)), E=w3dSetCars.E||(w3dSetCars.E=new T.Euler(0,0,0,'YZX'));
  for(let c=0;c<W3D_CARS;c++){ let uc=u+(c-(W3D_CARS-1)/2)*(W3D_CAR+W3D_GAP); uc=L.loop?((uc%len)+len)%len:clamp(uc,0,len);
    const p=polyAt(P.pts,P.cum,uc), h=polyHead(P.pts,P.cum,uc,0.05), y=w3dHAt(P,uc), sl=(w3dHAt(P,Math.min(len,uc+0.05))-w3dHAt(P,Math.max(0,uc-0.05)))/0.1;
    E.set(0,-Math.atan2(h[1],h[0]),Math.atan(sl)); Q.setFromEuler(E); M.compose(V.set(p[0]-h[1]*off,y,p[1]+h[0]*off),Q,Sc); mesh.setMatrixAt(base+c,M); } }
function w3dTap(cx,cy){ const r=w3d.R.domElement.getBoundingClientRect(), T=w3d.T, v=new T.Vector3(); let best=null, bd=40;
  for(const tr of (w3d.trains||[])){ if(!tr.L._p3) continue; for(let k=0;k<tr.n;k++){ const p=w3dTrainPos(tr,k); v.set(p.x,w3dHAt(tr.L._p3,p.u)+0.015,p.y).project(w3d.cam3); if(v.z>1) continue; const sx=(v.x+1)/2*r.width+r.left, sy=(1-v.y)/2*r.height+r.top, d=Math.hypot(sx-cx,sy-cy); if(d<bd){ bd=d; best={L:tr.L,p}; } } }
  if(best){ const L=best.L, sc=stopCum(L), u=best.p.f*sc[sc.length-1]; let k0=0; if(best.p.dir>0){ for(let j=0;j<sc.length;j++) if(sc[j]<=u) k0=j; } else { k0=sc.length-1; for(let j=sc.length-1;j>=0;j--) if(sc[j]>=u) k0=j; }
    const s=pickTrain(L,Math.min(k0,L.stops.length-1),best.p.dir); if(s){ watch.subj=s; watch.user=0; renderWatchBar(); } } }
function w3dFrame(dt){
  if(!w3d.active||!w3d.ready) return; w3dBuild(); const T=w3d.T, R=w3d.R, box=$('#cv3d'), bw=box.clientWidth, bh=box.clientHeight;
  if(R.domElement.width!==Math.round(bw*R.getPixelRatio())||R.domElement.height!==Math.round(bh*R.getPixelRatio())){ R.setSize(bw,bh,false); w3d.cam3.aspect=bw/bh; w3d.cam3.updateProjectionMatrix(); }
  const st=watch.st, M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1);
  // the other trains glide along at the same calm pace as yours
  w3d.tt=(w3d.tt||0)+dt; w3dCarsTick(dt);
  if(w3d.grow){ const g=w3d.grow; g.t+=dt; const f=smooth(g.t,0,15); g.bx.growTo(f); g.hgrow.forEach(fn=>fn(f)); if(f>=1) w3d.grow=null; }
  // streets added since the land was drawn: redraw it in the background now and then, never while the surroundings are being built
  const now=performance.now(); if(!w3d.gj&&G.rn&&G.rn.ver!==w3d.gRn&&now-(w3d.gAt||0)>30000){ w3d.gRn=G.rn.ver; w3d.gAt=now; w3d.gj={it:w3dGroundGen()}; }
  if(w3d.gj&&!w3d.lj&&w3dRun(w3d.gj,4)) w3d.gj=null;
  for(const tr of (w3d.trains||[])){ if(!tr.L._p3) continue; for(let k=0;k<tr.n;k++){ const p=w3dTrainPos(tr,k); w3dSetCars(tr.m,k*W3D_CARS,tr.L,p.u,p.dir); } tr.m.instanceMatrix.needsUpdate=true; }
  if(!st){ R.render(w3d.S,w3d.cam3); w3dEmpty(); return; }
  const P3=st.L&&st.L._p3, ru=P3?w3dRideU(st):null; let x, z, u3, hx=st.hx, hz=st.hy, sg=1;
  if(ru){ u3=ru.u; sg=ru.sg; w3d.lastSg=sg; const p=polyAt(P3.pts,P3.cum,u3), h=polyHead(P3.pts,P3.cum,u3,0.08); x=p[0]; z=p[1]; hx=h[0]*sg; hz=h[1]*sg; }
  else { [x,z,u3]=st.L?w3dNear(st.L,st.x,st.y):[st.x,st.y,0]; if(P3){ const hd=polyHead(P3.pts,P3.cum,u3,0.05); sg=(hd[0]*hx+hd[1]*hz)>=0?1:-1; } }
  const nx=-hz, nz=hx; w3dLocal(x,z);
  const yT=P3&&P3.Y?w3dHAt(P3,u3):TRK, under=yT<-0.01, len3=P3?P3.cum[P3.cum.length-1]:0; if(st.mode==='ride'){ x+=nx*W3D_TO; z+=nz*W3D_TO; }
  const seat=watch.win, mine=w3d.myTrain;
  if(mine){ mine.visible=!seat&&!!P3&&st.mode==='ride'; if(P3&&mine.visible){ const tr=w3d.trains.find(o=>o.L===st.L); if(tr&&mine.geometry!==tr.geo) mine.geometry=tr.geo; w3dSetCars(mine,0,st.L,u3,sg); mine.instanceMatrix.needsUpdate=true; } }
  let cp, ct, kp, kt; const sw=st.speed?Math.sin(performance.now()/260)*0.00025:0;
  if(seat&&st.mode==='ride'){ cp=[x+nx*0.0075+hx*0.01,yT+0.017+sw,z+nz*0.0075+hz*0.01]; ct=[x+nx*1+hx*0.22,yT+0.017-(under?0.02:0.13),z+nz*1+hz*0.22]; kp=kt=12; }   /* at the window: looking out and a little down, as you do from a viaduct */
  else if(seat){ cp=[x+nx*(DECK+0.02),yT+0.017,z+nz*(DECK+0.02)]; ct=[x-nx*1+hx*0.35,yT+0.01,z-nz*1+hz*0.35]; kp=kt=6; }   // on the platform, facing the tracks
  else {
    /* The following camera. In the open it circles slowly behind the train (swinging out to either side, rising and
       falling, drawing in at stations) and keeps itself out of the buildings next to it. It stays above ground:
       when the train goes underground it keeps roughly over the line and looks down more steeply, and whatever lies
       between it and the train (ground, buildings, tunnel) is thinned so the train shows through (see w3dSee). */
    const C=w3d.cc||(w3d.cc={t:Math.random()*50,slow:0}); C.t+=dt; C.slow+=((st.speed>0.02?0:1)-C.slow)*Math.min(1,dt*0.8);
    C.ug=(C.ug||0)+((yT<0.02?1:0)-(C.ug||0))*Math.min(1,dt*1.2);
    const az=(0.6*Math.sin(C.t*0.085)+0.3*Math.sin(C.t*0.031+1.3))*(1-0.8*C.ug), dd=lerp(lerp(0.66+0.2*Math.sin(C.t*0.052+2),0.5,C.slow),0.52,C.ug), hh=lerp(lerp(0.15+0.07*Math.sin(C.t*0.067+0.5),0.1,C.slow),0.4,C.ug);
    const ca=Math.cos(az), sa=Math.sin(az), ty=Math.max(yT,0)+0.012; let d2=dd, cy=Math.max(yT,0)+hh, ox=0, oz=0;
    for(let tr=0;tr<6;tr++){ ox=(-hx*ca+nx*sa)*d2; oz=(-hz*ca+nz*sa)*d2; let need=cy;
      for(let q=6;q<=10;q++){ const f=q/10, g=Math.max(w3dHgt(x+ox*f,z+oz*f),w3dHt(x+ox*f,z+oz*f)+0.01); if(g>0){ const yn=ty+(g+0.014-ty)/f; if(yn>need) need=yn; } }
      if(need<=0.6+tr*0.08){ cy=need; break; } d2*=0.75; cy=need; }
    cy=Math.min(cy,1.0); const cpO=[x+ox,cy,z+oz];
    cp=cpO; ct=[x+hx*0.22,Math.max(yT,-0.02)+0.012,z+hz*0.22]; kp=2.2; kt=4.5; }
  const snap=!w3d.camPos||dist(w3d.camPos[0],w3d.camPos[2],cp[0],cp[2])>1.8, a1=snap?1:1-Math.exp(-dt*kp), a2=snap?1:1-Math.exp(-dt*kt);
  w3d.camPos=w3d.camPos&&!snap?w3d.camPos.map((v,i)=>v+(cp[i]-v)*a1):cp; w3d.camTgt=w3d.camTgt&&!snap?w3d.camTgt.map((v,i)=>v+(ct[i]-v)*a2):ct;
  w3d.cam3.position.set(...w3d.camPos); w3d.cam3.lookAt(...w3d.camTgt);
  // the see-through ellipse: from a little behind the train to well ahead along its route (off at the window seat)
  { const U=w3d.see.value, E=w3d.seeE.value; if(seat||!P3) U.set(0,0,0,0); else { w3d.cam3.updateMatrixWorld(); const v=(w3d.seeV||(w3d.seeV=new T.Vector3())), bw=R.domElement.width, bh=R.domElement.height, c=w3d.cam3.position;
      const at=u=>{ const uu=clamp(u,0,len3), p=polyAt(P3.pts,P3.cum,uu); v.set(p[0],w3dHAt(P3,uu)+0.014,p[1]).project(w3d.cam3); return v.z>1||v.z<-1||Math.abs(v.x)>4||Math.abs(v.y)>4?null:[(v.x+1)/2*bw,(v.y+1)/2*bh,v.z*0.5+0.5]; };
      // a point of the route behind the camera cannot be placed on the screen: reach less far that way
      const sm=at(u3)||[bw/2,bh/2,1]; let s0=null, s1=null; for(const d of [0.7,0.35,0.1]) if((s0=at(u3-sg*d))) break; for(const d of [2.4,1.7,1.1,0.6,0.2]) if((s1=at(u3+sg*d))) break; s0=s0||sm; s1=s1||sm; const dx=s1[0]-s0[0], dy=s1[1]-s0[1], L=Math.hypot(dx,dy)||1, la=clamp(L/2+bh*0.1,bh*0.2,bh*0.75), sb=clamp(la*0.5,bh*0.17,bh*0.3);
      // underground everything above the route fades, as far as the route reaches; in the open only what is nearer than the train itself
      const ugN=yT<0.004, dl=Math.hypot(c.x-x,c.y-yT,c.z-z)||1, k=Math.min(0.05,dl*0.2)/dl; v.set(x+(c.x-x)*k,yT+0.014+(c.y-yT)*k,z+(c.z-z)*k).project(w3d.cam3);
      const zOpen=v.z*0.5+0.5, zUnder=Math.max(s0[2],s1[2],sm[2])-1e-6; w3d.seeW=(w3d.seeW||0)+(1-(w3d.seeW||0))*Math.min(1,dt*3);
      U.set((s0[0]+s1[0])/2,(s0[1]+s1[1])/2,ugN?zUnder:zOpen,w3d.seeW); E.set(dx/L,dy/L,1/la,1/sb); } }
  // the sun: its shadow map follows the viewer in whole-texel steps, so shadow edges stay still instead of crawling
  { const sx=x+nx*0.6, sz=z+nz*0.6, D=[-8,14,10], ts=2*W3D_SH/w3d.sun.shadow.mapSize.x, r=[D[2],0,-D[0]], rl=Math.hypot(r[0],r[2]), rx=r[0]/rl, rz=r[2]/rl, dl=Math.hypot(...D), ux=-rz*D[1]/dl, uy=(rz*D[0]-rx*D[2])/dl, uz=rx*D[1]/dl;
    const pa=sx*rx+sz*rz, pb=sx*ux+sz*uz, da=Math.round(pa/ts)*ts-pa, db=Math.round(pb/ts)*ts-pb, tx=sx+da*rx+db*ux, ty=db*uy, tz=sz+da*rz+db*uz;
    w3d.sun.target.position.set(tx,ty,tz); w3d.sun.position.set(tx+D[0],ty+D[1],tz+D[2]); }
  // keep it smooth: if frames run long the picture is drawn at a slightly lower resolution (and shadows every other frame), and back up when there is room
  { const ms=dt*1000, A=w3d.ad||(w3d.ad={e:16,n:0,f:0}); A.e+=(Math.min(ms,100)-A.e)*0.05; A.n++; A.f++;
    if(A.n>50&&A.e>23&&w3d.pr>0.75){ w3d.pr=Math.max(0.75,w3d.pr-0.25); R.setPixelRatio(w3d.pr); A.n=0; }
    else if(A.n>300&&A.e<12.5&&w3d.pr<w3d.prMax){ w3d.pr=Math.min(w3d.prMax,w3d.pr+0.25); R.setPixelRatio(w3d.pr); A.n=0; }
    R.shadowMap.autoUpdate=false; R.shadowMap.needsUpdate=A.e<21||(A.f&1)===0; }
  R.render(w3d.S,w3d.cam3); w3dEmpty(); w3dLabels(); }
// Where the watched train is along its line's 3D track. The ride knows which two stops it is between and how far along;
// that maps straight onto the track, so the position can only move forward (searching for the nearest piece of track
// jumped back and forth wherever the line bends close to itself or is drawn aside into a station).
function w3dRideU(st){ const L=st.L, P=L&&L._p3; if(!P||!P.sU) return null; const n=L.stops.length;
  if(st.mode==='ride'&&st.q&&st.q.L===L){ const q=st.q, S=q.stopU; let j=0; while(j<S.length-2&&st.u>S[j+1]) j++; const a=q.ks[j], b=q.ks[j+1]; let ua, ub;
    if(L.loop){ if(b===(a+1)%n){ ua=P.sU[a]; ub=P.sU[a+1]; } else if(a===(b+1)%n){ ua=P.sU[b+1]; ub=P.sU[b]; } else return null; } else { ua=P.sU[a]; ub=P.sU[b]; }
    if(ua==null||ub==null) return null; const f=clamp((st.u-S[j])/((S[j+1]-S[j])||1),0,1); return {u:ua+(ub-ua)*f,sg:ub>=ua?1:-1}; }
  const k=st.st?L.stops.indexOf(st.st.id):-1; return k<0||P.sU[k]==null?null:{u:P.sU[k],sg:w3d.lastSg||1}; }
// how high the buildings stand at a point near the viewer (0 where there are none): a coarse grid filled when the surroundings are built
function w3dHgt(x,z){ const g=w3d.hg; if(!g) return 0; const i=Math.floor((x-g.x0)*g.res), j=Math.floor((z-g.y0)*g.res); return i<0||j<0||i>=g.n||j>=g.n?0:g.a[j*g.n+i]; }
// station names over the nearest platforms
function w3dLabels(){
  const T=w3d.T, box=$('#cv3d'), v=new T.Vector3(), cp=w3d.cam3.position, near=(w3d.usedV===netVersion?w3d.used:(w3d.usedV=netVersion,w3d.used=stations.filter(s=>lines.some(L=>L.stops.length>=2&&L.stops.includes(s.id))))).map(s=>({s,d:dist(s.x,s.y,cp.x,cp.z)})).filter(o=>o.d<4).sort((a,b)=>a.d-b.d).slice(0,6);
  while(w3d.labels.length<near.length){ const el=document.createElement('div'); el.className='lbl'; box.appendChild(el); w3d.labels.push({el}); }
  w3d.labels.forEach((l,i)=>{ const o=near[i]; if(!o){ l.el.style.display='none'; return; } { const sy=w3d.stY&&w3d.stY.get(o.s.id); v.set(o.s.x,sy!=null&&sy<0?(w3d.cam3.position.y<0?sy+0.04:0.045):TRK+0.06,o.s.y).project(w3d.cam3); } if(v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1){ l.el.style.display='none'; return; }
    const L=lines.find(q=>q.stops.length>=2&&q.stops.includes(o.s.id)); l.el.style.display=''; l.el.style.left=((v.x+1)/2*box.clientWidth)+'px'; l.el.style.top=((1-v.y)/2*box.clientHeight)+'px';
    const txt=nm(o.s.name); if(l.el.textContent!==txt) l.el.textContent=txt; l.el.style.setProperty('--c',L?lineColor(L):'#888'); }); }
