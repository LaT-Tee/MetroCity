/* ---------- 3D view (computers only): sit by the window of a real-looking city ----------
   Three.js is fetched only when someone opens the 3D view on a computer, so phones and the map never pay for it.
   1 unit = 1 cell (150 m); x and z are the map's x and y, y is up. Everything is built from the game's own city:
   the land (grass, parks, woods, sea, lakes and rivers), the street web, the buildings (houses with pitched roofs in
   the suburbs, apartment and office blocks, glass towers downtown, sheds by the industrial estates), trees in the
   parks and woods, and the metro on concrete viaducts with rails, overhead wires, platforms and proper trains. */
// three.js is built into the page itself (no download when the 3D view is first opened, and it works offline)
const w3d={ready:false,loading:false,T:null,active:false,sig:'',bc:null,labels:[],objs:[],local:[],gnd:[],trash:[],lj:null,gj:null};
const TRK=0.08, BZ3=1.2, DECK=0.03, UGY=-0.075, TUN_W=0.036, TUN_H=0.046;   // deck ~12 m up, half-width ~4.5 m; tunnels ~11 m down
const W3D_CAR=0.12, W3D_GAP=0.006, W3D_CARS=5, W3D_TO=0.0125;      // W3D_TO: each line is double track, one track this far either side of its centre
async function w3dStart(){
  w3d.active=true; const box=$('#cv3d'); box.hidden=false;
  if(w3d.ready){ w3dBuild(); return; } if(w3d.loading) return; w3d.loading=true;
  box.innerHTML=`<div class="note">${t('w3dLoading')}</div>`;
  try{ w3d.T=await import('three'); }catch(e){ w3d.loading=false; box.hidden=true; box.innerHTML=''; watch.view='2d'; toast(t('w3dFail')); renderWatchBar(); return; }
  w3d.loading=false; if(!w3d.active){ box.hidden=true; return; }
  const T=w3d.T, R=new T.WebGLRenderer({antialias:true,stencil:true,powerPreference:'high-performance'}); w3d.prMax=Math.min(dpr,1.5); w3d.pr=w3d.prMax; R.setPixelRatio(w3d.pr); R.outputColorSpace=T.SRGBColorSpace;
  R.toneMapping=T.ACESFilmicToneMapping; R.toneMappingExposure=0.95; R.shadowMap.enabled=true; R.shadowMap.type=T.PCFSoftShadowMap;
  box.innerHTML=''; box.appendChild(R.domElement);
  const S=new T.Scene(), cam3=new T.PerspectiveCamera(60,1,0.02,70);
  const hemi=new T.HemisphereLight(0xd6e6ff,0x8e8d88,0.9), sun=new T.DirectionalLight(0xfff0dc,2.6); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-W3D_SH,right:W3D_SH,top:W3D_SH,bottom:-W3D_SH,near:0.5,far:50}); sun.shadow.bias=-0.00025; sun.shadow.normalBias=0.0035; sun.shadow.radius=1.6; S.add(hemi,sun,sun.target); hemi.layers.enable(1); sun.layers.enable(1);
  Object.assign(w3d,{R,S,cam3,sun,hemi,ready:true,camPos:null,camTgt:null}); 
  R.domElement.addEventListener('pointerdown',e=>{ w3d.down=[e.clientX,e.clientY]; });
  R.domElement.addEventListener('pointerup',e=>{ if(!w3d.down||Math.hypot(e.clientX-w3d.down[0],e.clientY-w3d.down[1])>6) return; w3dTap(e.clientX,e.clientY); });
  w3dBuild(); }
function w3dStop(){ w3d.active=false; bldFreeze=false; const box=$('#cv3d'); box.hidden=true; box.classList.remove('seat'); }
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
const w3dShared=tx=>!!tx&&['facadeTex','balconyTex','brickTex','ribbonTex','glassTex','dglassTex','shopTex','shedTex','houseTex','roofTex'].some(k=>w3d[k]===tx);
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
  // a house wall: render, one window with shutters and a sill to each bay
  w3d.houseTex=tile((g,w,h)=>{ g.fillStyle='#f3f0ea'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.03)'; for(let i=0;i<70;i++) g.fillRect((i*41)%w,(i*29)%h,3,2);
    g.fillStyle='#8b6f5a'; g.fillRect(30,30,14,56); g.fillRect(84,30,14,56); g.fillStyle='#e9e4da'; g.fillRect(44,26,40,64); pane(g,48,30,32,56,'#a9bccb','#566573'); g.fillStyle='#e9e4da'; g.fillRect(62,30,4,56); g.fillRect(48,56,32,3);
    g.fillStyle='#cfc9bd'; g.fillRect(40,90,48,5); g.fillStyle='rgba(0,0,0,.10)'; g.fillRect(40,95,48,3); g.fillStyle='rgba(0,0,0,.06)'; g.fillRect(0,122,w,6); },128,128);
  // roof tiles: courses with a shadow line under each, staggered joints
  w3d.roofTex=tile((g,w,h)=>{ g.fillStyle='#d9d9d9'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=16){ g.fillStyle='rgba(0,0,0,.28)'; g.fillRect(0,y+13,w,3); g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(0,y,w,2); for(let x=(y/16%2)*8;x<w;x+=16){ g.fillStyle='rgba(0,0,0,.16)'; g.fillRect(x,y,1.5,14); g.fillStyle=`rgba(0,0,0,${0.03+((x*7+y*3)%5)*0.012})`; g.fillRect(x+2,y+2,12,10); } } },128,128);
  // corrugated shed wall
  w3d.shedTex=tile((g,w,h)=>{ g.fillStyle='#d4d8dc'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=4){ g.fillStyle=x%8?'rgba(0,0,0,.05)':'rgba(255,255,255,.25)'; g.fillRect(x,0,2,h); } g.fillStyle='#8e9aa6'; g.fillRect(0,h-8,w,8); },64,64);
}
// a standard material whose texture repeats per window bay and per floor, whatever the box's size (aRep = bays across x, floors, bays across z)
// a normal map from a painted texture: dark lines and edges read as grooves, so walls, window frames, bricks and tiles catch the light
function w3dNormalOf(tx,k){ const T=w3d.T, c=tx.image, w=c.width, h=c.height, src=c.getContext('2d').getImageData(0,0,w,h).data, o=document.createElement('canvas'); o.width=w; o.height=h; const g=o.getContext('2d'), id=g.createImageData(w,h), L=(x,y)=>{ const i=(((y+h)%h)*w+((x+w)%w))*4; return (src[i]*0.3+src[i+1]*0.59+src[i+2]*0.11)/255; };
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const dx=(L(x+1,y)-L(x-1,y))*k, dy=(L(x,y+1)-L(x,y-1))*k, l=Math.hypot(dx,dy,1), i=(y*w+x)*4; id.data[i]=(-dx/l*0.5+0.5)*255; id.data[i+1]=(dy/l*0.5+0.5)*255; id.data[i+2]=(1/l*0.5+0.5)*255; id.data[i+3]=255; }
  g.putImageData(id,0,0); const n=new T.CanvasTexture(o); n.wrapS=n.wrapT=T.RepeatWrapping; n.anisotropy=8; return n; }
const W3D_NIGHT={value:0};
// trains, coaches and cars at night: their windows (dark blue-grey in the model) glow with the light inside, head lamps (pale yellow) shine
function w3dVehMat(opt){ const T=w3d.T, m=new T.MeshStandardMaterial({vertexColors:true,...opt}); m.userData.keep=true;
  m.onBeforeCompile=sh=>{ sh.uniforms.uNight=W3D_NIGHT; sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    #ifdef USE_COLOR
    { vec3 c=vColor.rgb; float win=step(c.r+0.012,c.b)*step(dot(c,vec3(0.33)),0.09), lamp=step(0.85,c.r)*step(0.8,c.g)*step(c.b,0.75); totalEmissiveRadiance+=(vec3(1.0,0.86,0.6)*win*2.8+vec3(1.0,0.95,0.8)*lamp*5.0)*smoothstep(0.35,0.9,uNight); }
    #endif`); };
  m.customProgramCacheKey=()=>'veh1'; return m; }
function w3dFacadeMat(map,opt){ const T=w3d.T, m=new T.MeshStandardMaterial({map,normalMap:w3dNormalOf(map,2.2),normalScale:new T.Vector2(0.7,0.7),...opt});
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aRep;\nvarying float vFootY;').replace('#include <begin_vertex>','#include <begin_vertex>\n\t#ifdef USE_INSTANCING\n\tvFootY=(instanceMatrix*vec4(position,1.0)).y;\n\t#else\n\tvFootY=1.0;\n\t#endif').replace('#include <uv_vertex>',`#include <uv_vertex>
    vec2 rep = abs(normal.x)>0.5 ? aRep.zy : (abs(normal.y)>0.5 ? vec2(0.0) : aRep.xy);
    #ifdef USE_MAP
    vMapUv *= rep;
    #endif
    #ifdef USE_NORMALMAP
    vNormalMapUv *= rep;
    #endif
`); };
  // (above) walls darken towards the ground, as they do where the sky is hidden by the street: the cheapest thing that makes a box stand on its site
  { const prev=m.onBeforeCompile; m.onBeforeCompile=sh=>{ prev(sh); sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFootY;').replace('#include <color_fragment>','#include <color_fragment>\n\tdiffuseColor.rgb*=mix(0.62,1.0,smoothstep(0.0,0.05,vFootY));').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    // at night the windows light up: the glass in the facade (bluish and darker than the walls), some bays lit and some not
    if(uNight>0.01){ vec3 cc=diffuseColor.rgb; float glass=step(cc.r+0.02,cc.b)*step(dot(cc,vec3(0.33)),0.62);
      #ifdef USE_MAP
      vec2 bay=floor(vMapUv);
      #else
      vec2 bay=vec2(0.0);
      #endif
      // lit by home, not by window: a run of three or four neighbouring windows on one floor together, most of the building dark.
      // Far off there are no separate points of light at all (a field of dots is hard to look at), only a faint warm glow on the glass.
      vec2 home=vec2(floor((bay.x+floor(bay.y*1.7))/3.0),bay.y); float rr=fract(sin(dot(home,vec2(12.9898,78.233)))*43758.5453), on=step(0.8,rr)*(0.6+0.4*fract(rr*7.31));
      float far=smoothstep(1.2,4.5,length(vViewPosition)); on=mix(on,0.12,far); totalEmissiveRadiance+=vec3(1.0,0.74,0.45)*glass*on*smoothstep(0.55,1.0,uNight)*1.1; }`).replace('#include <common>','#include <common>\nuniform float uNight;'); sh.uniforms.uNight=W3D_NIGHT; }; }
  m.customProgramCacheKey=()=>'facade4'; return m; }
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
  shed:['shedTex',8,9,[0xe6eaee,0xd9e1e8,0xc9d4de,0xe8e3d8],{roughness:0.6,metalness:0.2}],
  house:['houseTex',4.2,2.9,W3D_HOUSE,{roughness:0.9}] };
// the unit box every building mass is an instance of; its underside is never seen, so it has none (a sixth fewer triangles in a city of boxes)
function w3dUnit(){ const g=new w3d.T.BoxGeometry(1,1,1); g.translate(0.5,0.5,0.5); const ix=Array.from(g.index.array); ix.splice(18,6); g.setIndex(ix); g.clearGroups(); [0,1,2,4,5].forEach((m,k)=>g.addGroup(k*6,6,m)); return g; }
// a pitched roof over the unit square: ridge along x (ax 0) or along z (ax 1), eaves at y 0, ridge at y 1
function w3dRoofGeo(ax){ const T=w3d.T, g=new T.BufferGeometry(), v=ax===0
    ?[0,0,0, 1,1,0.5, 1,0,0, 0,0,0, 0,1,0.5, 1,1,0.5,  0,0,1, 1,0,1, 1,1,0.5, 0,0,1, 1,1,0.5, 0,1,0.5,  0,0,0, 0,0,1, 0,1,0.5,  1,0,0, 1,1,0.5, 1,0,1]
    :[0,0,0, 0,0,1, 0.5,1,1, 0,0,0, 0.5,1,1, 0.5,1,0,  1,0,0, 0.5,1,1, 1,0,1, 1,0,0, 0.5,1,0, 0.5,1,1,  0,0,0, 0.5,1,0, 1,0,0,  0,0,1, 1,0,1, 0.5,1,1];
  const uv=[]; for(let i=0;i<v.length;i+=3) uv.push((ax===0?v[i]:v[i+2])*5,v[i+1]*2.4+(ax===0?v[i+2]:v[i])*0.01);
  g.setAttribute('position',new T.Float32BufferAttribute(v,3)); g.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); g.computeVertexNormals(); return g; }
function w3dMats(){ if(w3d.mats) return w3d.mats; const T=w3d.T; w3dTextures(); const keep=m=>{ m.userData.keep=true; return w3dSee(m); }, M={};
  for(const k in W3D_KIND){ const o=W3D_KIND[k]; M[k]=keep(w3dFacadeMat(w3d[o[0]],o[4])); }
  M.cyl=keep(new T.MeshStandardMaterial({roughness:0.1,metalness:0.45})); M.roof=keep(new T.MeshStandardMaterial({color:0xbdbab3,roughness:0.92})); M.plain=keep(new T.MeshStandardMaterial({roughness:0.6,metalness:0.15}));
  M.houseWall=M.house; M.houseRoof=keep(new T.MeshStandardMaterial({map:w3d.roofTex,normalMap:w3dNormalOf(w3d.roofTex,3),roughness:0.8,side:T.DoubleSide}));
  return w3d.mats=M; }
// collects building masses by facade kind, then makes one instanced mesh per kind
function w3dBoxes(){ const T=w3d.T, lists={}, plain=[], cyl=[], grow=[], H3=BZ3; let fa=0, fx=0, fz=0, gy=0, born=false;      // the building being added: its angle and the centre it turns about
  const put=(k,x,z,w,d,y0,h,c)=>{ (lists[k]||(lists[k]=[])).push([x,z,w,d,y0,h,c,fa,fx,fz,born,gy]); }, frame=b=>{ fa=b.a||0; fx=b.x+b.w/2; fz=b.y+b.d/2; gy=w3dUnder(b); }, pl=q=>{ q.push(fa,fx,fz,born,gy); plain.push(q); };
  const place=(M,q,R,Pv)=>{ M.makeScale(q[2],q[5],q[3]).setPosition(q[0],q[4]+q[11],q[1]); if(q[7]){ R.makeRotationY(-q[7]); Pv.makeTranslation(q[8],0,q[9]); M.premultiply(Pv.clone().invert()).premultiply(R).premultiply(Pv); } };
  const pal=(k,h)=>{ const p=W3D_KIND[k][3]; return p[h%p.length]; };
  const GM=new T.Matrix4(), GR=new T.Matrix4(), GP=new T.Matrix4();
  return {
    grow, setBorn(v){ born=v; },
    // set every new building to a fraction of its height
    growTo(f){ for(const g of grow){ const q=g.q, a=q[4], b=q[5]; q[4]=a*f; q[5]=Math.max(b*f,1e-4); place(GM,q,GR,GP); q[4]=a; q[5]=b; g.m.setMatrixAt(g.i,GM); g.m.instanceMatrix.needsUpdate=true; } },
    shed(b,hh){ frame(b); const h=Math.min(b.h,0.09)*H3; put('shed',b.x,b.y,b.w,b.d,0,h,pal('shed',hh)); pl([b.x+b.w*0.2,b.y+b.d*0.2,b.w*0.15,b.d*0.15,h,0.006,0xb9bec4]); },
    // a building far off in the haze: one mass, no more
    block(b,hh){ frame(b); const k=b.h*150>48?'glass':'ribbon'; put(k,b.x,b.y,b.w,b.d,0,b.h*H3,pal(k,hh>>>12)); },
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
      if(tv===1&&hm>55){ const ph=Math.min(H*0.2,24*H3/150), rr=Math.min(b.w,b.d)*0.46; put('ribbon',b.x,b.y,b.w,b.d,y0,ph,pal('ribbon',hh>>>7)); cyl.push([b.x+b.w/2,b.y+b.d/2,rr,y0+ph,H-ph-y0,[0x9fc0dc,0x8fb3c9,0xb6cfe0,0x7fa3bd][hh&3],fa,fx,fz,gy]);
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
      if(cyl.length){ const g=new T.CylinderGeometry(1,1,1,20); g.translate(0,0.5,0); const m=new T.InstancedMesh(g,mats.cyl,cyl.length); cyl.forEach((q,i)=>{ M.makeScale(q[2],q[4],q[2]).setPosition(q[0],q[3]+q[9],q[1]); m.setMatrixAt(i,M); col.set(q[5]); m.setColorAt(i,col); }); m.castShadow=shadow; m.receiveShadow=shadow; yield m; }
      if(plain.length&&shadow){ const m=new T.InstancedMesh(w3dUnit(),mats.plain,plain.length); plain.forEach((q,i)=>{ place(M,q,R,Pv); m.setMatrixAt(i,M); if(q[10]) grow.push({m,i,q}); col.set(q[6]); m.setColorAt(i,col); }); m.castShadow=m.receiveShadow=true; yield m; } } }; }
// ---- the land: grass, parks, woods, sea and lakes from the base map; rivers, streets, rail and sports pitches drawn on
// Streets touching a world rectangle (with a margin), so each ground tile strokes only its own
function w3dEdgesIn(x0,y0,x1,y1,list){ const R=G.rn, out=[]; if(!R) return out; const m=0.3; for(const e of (list||R.ea.keys())){ const a=R.ea[e], b=R.eb[e];
  if(Math.max(R.x[a],R.x[b])>x0-m&&Math.min(R.x[a],R.x[b])<x1+m&&Math.max(R.y[a],R.y[b])>y0-m&&Math.min(R.y[a],R.y[b])<y1+m) out.push(e); } return out; }
function w3dStreets(g,E,wd,layers){ const R=G.rn; for(const [extra,col,dash,from] of layers) for(let k=from||0;k<5;k++){ g.strokeStyle=typeof col==='function'?col(k):col; g.lineWidth=extra<0?-extra:wd[k]+extra; g.setLineDash(dash?(typeof dash==='function'?dash(k):dash):[]);
  g.beginPath(); for(const e of E){ if(R.ec[e]!==k) continue; const a=R.ea[e], b=R.eb[e]; g.moveTo(R.x[a],R.y[a]); g.lineTo(R.x[b],R.y[b]); } g.stroke(); } g.setLineDash([]); }
// the countryside is farmed: a patchwork of fields in blocks of a few cells, each its own crop and furrow direction
const W3D_FIELD=['#9db36a','#b7b56a','#8aa85c','#c9b873','#a6a25e','#7f9e58','#b99f6b','#93ad66'];
// what a field is used for (by block): 0 crops; 1 orchard; 2 vineyard; 3 flowers; 4 paddy; 5 greenhouses; 6 solar farm; 7 pasture with hay
const W3D_FKCOL=[null,'#86a860','#a8a070','#b9b26a','#7fa9a8','#b9b6a6','#8f9a78','#93b060'];
function w3dFieldKind(h){ const q=(h>>>10)&63; return q<34?0:q<40?1:q<45?2:q<49?3:q<54?4:q<57?5:q<59?6:7; }
function w3dFieldAt(x,y){ if(x<0||y<0||x>=W||y>=H) return -1; const i=y*W+x; if(G.water[i]||G.D[i]>=0.045||G.pk[i]>0.1||G.e[i]>0.5) return -1; { const ap=G.fac.airport; if(Math.abs(x-ap.x)<13&&Math.abs(y-ap.y)<13) return -1; for(const f of (G.fac2||[])) if(f.t==='air'&&Math.abs(x-f.x)<13&&Math.abs(y-f.y)<13) return -1; } const bx=Math.floor((x+((y>>2)&1)*2)/3), by=Math.floor(y/2), h=hashInt(bx*7349+by*9151+G.seed); return (h&7)===7?-1:h; }
function w3dFields(g,x0,y0,x1,y1,fine){
  for(let y=Math.max(0,Math.floor(y0));y<=Math.min(H-1,Math.ceil(y1));y++) for(let x=Math.max(0,Math.floor(x0));x<=Math.min(W-1,Math.ceil(x1));x++){ const h=w3dFieldAt(x,y); if(h<0) continue;
    const fk=w3dFieldKind(h); g.fillStyle=fk===0?W3D_FIELD[(h>>3)&7]:W3D_FKCOL[fk]; g.globalAlpha=fk===0?0.55:0.8; g.fillRect(x-0.5,y-0.5,1.02,1.02); g.globalAlpha=1;
    if(fine&&fk){ const vert=(h>>6)&1, row=(k,w,c)=>{ g.fillStyle=c; if(vert) g.fillRect(x-0.5+k,y-0.5,w,1); else g.fillRect(x-0.5,y-0.5+k,1,w); };
      if(fk===2) for(let k=0.03;k<1;k+=0.06) row(k,0.022,'rgba(74,104,52,.8)');                                                    // vineyard: close rows
      else if(fk===3) for(let k=0,q=0;k<1;k+=0.1,q++) row(k,0.085,['#d9547a','#e6b93c','#9a6ac8','#e88a3c','#f2f2e6'][(q+(h>>8))%5]);   // flower fields: bands of colour
      else if(fk===4){ for(let k=0;k<1;k+=0.25) row(k,0.012,'rgba(120,110,80,.8)'); g.fillStyle='rgba(120,110,80,.8)'; g.fillRect(x-0.5,y-0.5,vert?1:0.012,vert?0.012:1); }   // paddies: water between low banks
      else if(fk===5) for(let k=0.06;k<1;k+=0.24) row(k,0.03,'rgba(120,110,90,.6)');                                                 // greenhouses stand on gravel strips
    }
    if(fine&&!fk){ g.strokeStyle='rgba(60,70,30,.16)'; g.lineWidth=0.012; g.beginPath(); const vert=(h>>6)&1; for(let k=0.06;k<1;k+=0.12){ if(vert){ g.moveTo(x-0.5+k,y-0.5); g.lineTo(x-0.5+k,y+0.5); } else { g.moveTo(x-0.5,y-0.5+k); g.lineTo(x+0.5,y-0.5+k); } } g.stroke();
      g.strokeStyle='rgba(70,95,45,.55)'; g.lineWidth=0.03; g.beginPath(); if(w3dFieldAt(x+1,y)>>3!==h>>3){ g.moveTo(x+0.5,y-0.5); g.lineTo(x+0.5,y+0.5); } if(w3dFieldAt(x,y+1)>>3!==h>>3){ g.moveTo(x-0.5,y+0.5); g.lineTo(x+0.5,y+0.5); } g.stroke(); } } }
function* w3dGroundGen(){ w3dTerrain();
  const T=w3d.T, B=G.bounds, K=6, cw=(B[2]-B[0])*K, ch=(B[3]-B[1])*K, dark=w3dDark();
  const pal=dark?{sea:[22,44,70],sh:[30,56,84],land:[52,66,46],urb:[70,72,78],park:[38,64,40],forest:[30,52,34],hill:[60,66,50],str:[70,72,78]}
                :{sea:[58,110,152],sh:[84,136,172],land:[138,162,98],urb:[171,173,174],park:[102,146,72],forest:[70,108,56],hill:[130,144,98],str:[171,173,174],sand:[218,205,168],quay:[196,196,192]};
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
      g.drawImage(c,(x0-(B[0]-0.5))*K,(y0-(B[1]-0.5))*K,w*K,h*K,0,0,g.canvas.width,g.canvas.height); g.setTransform(k,0,0,k,-x0*k,-y0*k); w3dRock(g,x0,y0,w,h); g.lineCap='round'; g.lineJoin='round';
      g.strokeStyle=wc; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18); g.stroke(r.p); }
      if(P2.rail){ g.strokeStyle=dark?'#4a443e':'#9a8f84'; g.lineWidth=0.09; g.stroke(P2.rail); g.strokeStyle=dark?'#2a2a2a':'#5a5450'; g.lineWidth=0.012; g.setLineDash([0.02,0.02]); g.stroke(P2.rail); g.setLineDash([]); }
      // streets: kerbs and pavement under asphalt, centre lines on the bigger roads
      w3dStreets(g,w3dEdgesIn(x0,y0,x0+w,y0+h),wd,[[0.03,pave],[0,asph],[-0.004,k=>k===4?'#e8c547':'rgba(255,255,255,.8)',k=>k===4?[]:[0.03,0.03],2]]); },
    // water is glossy: a roughness map with the sea, lakes and rivers dark
    (g,x0,y0,w,h,k)=>{ g.fillStyle='#f0f0f0'; g.fillRect(0,0,g.canvas.width,g.canvas.height); g.setTransform(k,0,0,k,-x0*k,-y0*k); g.fillStyle='#262626';
      for(let y=Math.max(B[1],Math.floor(y0));y<Math.min(B[3],y0+h+1);y++) for(let x=Math.max(B[0],Math.floor(x0));x<Math.min(B[2],x0+w+1);x++) if(G.water[y*W+x]) g.fillRect(x-0.5,y-0.5,1,1);
      g.strokeStyle='#262626'; for(const r of (P2.rivers||[])){ g.lineWidth=Math.max(r.w,0.18); g.stroke(r.p); } },
    (tx,rt)=>w3dSee(new T.MeshStandardMaterial({map:tx,roughnessMap:rt,roughness:1,metalness:0.02,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4,...w3dCutFar()})),      /* the far ground is pushed back a little in depth, so the sharp ground near the viewer and everything lying on it wins without needing an offset of its own */m=>{ m.renderOrder=-5; out.push(m); });
  // swap in the finished ground; the old one goes after the next frame, once the new one has been drawn
  return ()=>{ w3d.groundCanvas=c; out.forEach(m=>w3d.S.add(m)); w3dTrash(w3d.gnd); w3d.gnd=out; }; }
// the world rectangle (x0,y0,w,h) as n×n ground tiles at ppc pixels a cell: each tile is painted, uploaded and placed on its own step
/* Hills and mountains. The land rises where the height map is high, and is kept level wherever something stands on
   it (streets, built-up ground, the railway, the airport, metro lines), easing up from a few cells away, so a road
   or a line through the hills runs in a cutting. Everything that is not on level ground (trees, the camera) asks w3dHt. */
const W3D_HS=1.5, W3D_TUN=0.3, W3D_ROLL=0.2;      // W3D_ROLL: how much the land a town stands on rises and falls (cells)
// the ground under a footprint: its lowest corner, so nothing built on a slope shows daylight under it
function w3dUnder(b){ if(!w3d.tF) return 0; const q=bldCorners(b); return Math.min(w3dHt(q[0],q[1]),w3dHt(q[2],q[3]),w3dHt(q[4],q[5]),w3dHt(q[6],q[7]),w3dHt((q[0]+q[4])/2,(q[1]+q[5])/2)); }      // W3D_TUN: ground that would rise this high (cells) is not levelled for a line or the railway: they tunnel through it
function w3dTerrain(){ const key=netVersion+'|'+(G.rn?Math.floor(G.rn.ea.length/200):0)+'|'+Math.floor(months/12)+'|'+G.seed+'|'+G.stage; if(w3d.tK===key) return; w3d.tK=key;
  // mF: where the ground must be dead level (water, the railway, airports, metro lines and stations, the big set pieces);
  // mB: where the town is (streets, built-up ground). The town rides the gentle rise and fall of the land; only real
  // mountains keep clear of it.
  const n=W*H, mF=new Uint8Array(n), mB=new Uint8Array(n), mark=(x,y,r)=>{ for(let yy=Math.max(0,Math.round(y-r));yy<=Math.min(H-1,Math.round(y+r));yy++) for(let xx=Math.max(0,Math.round(x-r));xx<=Math.min(W-1,Math.round(x+r));xx++) mF[yy*W+xx]=1; };
  for(let i=0;i<n;i++){ if(G.water[i]) mF[i]=1; if(G.roadUse[i]||G.D[i]>0.04||G.water[i]) mB[i]=1; }
  const nat=(x,y)=>W3D_HS*Math.pow(smooth(G.e[clamp(Math.round(y),0,H-1)*W+clamp(Math.round(x),0,W-1)],0.3,0.88),1.25), low=(x,y)=>nat(x,y)<W3D_TUN;
  for(const p of G.rail) if(low(p[0],p[1])) mark(p[0],p[1],1); mark(G.fac.station.x,G.fac.station.y,2); mark(G.fac.coach.x,G.fac.coach.y,2); for(const f of (G.fac2||[])) if(f.t!=='air') mark(f.x,f.y,2); mark(G.fac.airport.x,G.fac.airport.y,13); for(const f of (G.fac2||[])) if(f.t==='air') mark(f.x,f.y,13);
  for(const p of (G.projects||[])) mark(p.x,p.y,2);
  for(const L of lines){ if(L.stops.length<2) continue; for(const p of lineLevels(L).pts) if(low(p[0],p[1])) mark(p[0],p[1],1); for(const id of L.stops){ const st=stById(id); if(st) mark(st.x,st.y,2); } }
  for(let i=0;i<n;i++) if(mF[i]) mB[i]=1;
  const dF=distTransform(mF), dB=distTransform(mB), F=w3d.tF||(w3d.tF=new Float32Array(n));
  for(let i=0;i<n;i++){ const e=G.e[i], mt=W3D_HS*Math.pow(smooth(e,0.3,0.88),1.25), roll=W3D_ROLL*smooth(e,0.05,0.36)+Math.min(mt,0.1); F[i]=smooth(dF[i],1.2,4.6)*(roll+(mt-Math.min(mt,0.1))*smooth(dB[i],1.2,4.2)); } }
function w3dHt(x,z){ return w3d.tF?bilinear(w3d.tF,x,z):0; }
// mountains are not lawns: bare rock shows where the slope is steep, pale scree and stone towards the summits
function w3dRock(g,x0,y0,w,h,fine){ w3dTerrain(); const F=w3d.tF; if(!F) return;
  for(let y=Math.max(1,Math.floor(y0)-1);y<=Math.min(H-2,Math.ceil(y0+h)+1);y++) for(let x=Math.max(1,Math.floor(x0)-1);x<=Math.min(W-2,Math.ceil(x0+w)+1);x++){ const i=y*W+x, hv=F[i]; if(hv<0.22) continue;
    const sl=Math.hypot(F[i+1]-F[i-1],F[i+W]-F[i-W])/2, nz=0.5+0.5*Math.sin(x*0.83+Math.sin(y*0.61)*1.7)*Math.cos(y*0.97+Math.sin(x*0.37)*1.3), a=clamp(smooth(sl,0.08,0.24)*(0.6+0.4*nz)+smooth(hv,0.9,1.4)*0.45*smooth(nz,0.3,0.75),0,0.92)*smooth(hv,0.22,0.4); if(a<0.05) continue;
    const c=hv>1.15&&nz>0.55?'176,171,160':(hashInt(i*31)&1)?'138,131,118':'122,117,108', gr=g.createRadialGradient(x,y,0,x,y,1.2); gr.addColorStop(0,'rgba('+c+','+a.toFixed(3)+')'); gr.addColorStop(1,'rgba('+c+',0)'); g.fillStyle=gr; g.fillRect(x-1.2,y-1.2,2.4,2.4);
    // close to, the rock is broken: darker clefts and paler slabs among it
    if(fine&&a>0.12) for(let q=0;q<26;q++){ const r=hashInt(i*131+q*977), sx=x-0.5+(r&255)/255, sy=y-0.5+((r>>8)&255)/255, rr=0.008+((r>>16)&63)/2400; g.fillStyle='rgba('+((r>>22)&1?'96,91,84':'168,163,152')+','+(a*0.42).toFixed(3)+')'; g.beginPath(); g.ellipse(sx,sy,rr*1.6,rr*0.7,((r>>23)&63)/20,0,6.283); g.fill(); } } }
/* Water lies lower than the land. The ground falls away at the water's edge to a bed below the water surface (a bank
   on a river, a shelving shore on the sea), and the water itself is a surface of its own a little below street level,
   with moving ripples that catch the sky and the sun. Bridges and viaducts therefore really span something. */
/* The river's edge, exactly. The map keeps the distance to the nearest river on its grid of cells, which is too coarse for a
   bank seen from close by: it comes out lumpy. For the ground near the viewer the distance is worked out from the river's
   own centre line and width, so the bank is a smooth line, and the texture painted on it is drawn from the same figures. */
function w3dRivIx(){ if(G._rivIx) return G._rivIx; const ix=new Map(), segs=[]; for(const r of (G.rivers||[])){ const w0=r.w0||1.1, w1=r.w1||2.9, n=r.length; for(let k=1;k<n;k++){ const a=r[k-1], b=r[k], sg=[a[0],a[1],b[0],b[1],(w0+(w1-w0)*(k-1)/n)/2,(w0+(w1-w0)*k/n)/2]; segs.push(sg);
      for(let gy=Math.floor(Math.min(a[1],b[1])/3);gy<=Math.floor(Math.max(a[1],b[1])/3);gy++) for(let gx=Math.floor(Math.min(a[0],b[0])/3);gx<=Math.floor(Math.max(a[0],b[0])/3);gx++){ const key=gy*1000+gx; let l=ix.get(key); if(!l) ix.set(key,l=[]); l.push(sg); } } } ix.segs=segs; return G._rivIx=ix; }
function w3dRivSD(x,z){ const ix=w3dRivIx(), gx=Math.floor(x/3), gy=Math.floor(z/3); let best=9; for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){ const l=ix.get((gy+oy)*1000+gx+ox); if(!l) continue; for(const q of l){ const dx=q[2]-q[0], dy=q[3]-q[1], t=clamp(((x-q[0])*dx+(z-q[1])*dy)/(dx*dx+dy*dy||1e-9),0,1), d=Math.hypot(x-q[0]-dx*t,z-q[1]-dy*t)-(q[4]+(q[5]-q[4])*t); if(d<best) best=d; } } return best; }
const W3D_WAT=-0.036, W3D_BED=-0.06;      // the water lies well below street level, so a bridge stands clear of it and boats pass under
function w3dDip(x,z){ if(x<0||z<0||x>W-1||z>H-1) return W3D_BED; let d=(bilinear(G.h,x,z)-G.sea-0.004)/0.012; if(G.rivSD&&bilinear(G.rivSD,x,z)<1.6){ const r=w3dRivSD(x,z); if(r<d) d=r; } return d>=0?0:W3D_BED*smooth(-d,0,0.2); }
function* w3dTiles(x0,y0,w,h,y,n,ppc,paint,paintRough,mat,put){ const T=w3d.T, an=w3d.R.capabilities.getMaxAnisotropy();
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const tx0=x0+w*i/n, ty0=y0+h*j/n, tw=w/n, th=h/n;
    const mk=(k,fn,srgb)=>{ const cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(tw*k)); cv.height=Math.max(1,Math.round(th*k)); const g=cv.getContext('2d'); g.imageSmoothingEnabled=true;
      fn(g,tx0,ty0,tw,th,cv.width/tw); const tx=new T.CanvasTexture(cv); tx.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace; tx.anisotropy=an; w3d.R.initTexture(tx); return tx; };
    const tx=mk(ppc,paint,true), rt=paintRough?mk(ppc/2,paintRough,false):null;
    const loc=tw<20; let hilly=false, wet=false; for(let b=ty0;b<=ty0+th&&!hilly;b+=1) for(let a=tx0;a<=tx0+tw;a+=1) if(w3dHt(a,b)>1e-4){ hilly=true; break; }
    if(loc) for(let b=ty0;b<=ty0+th&&!wet;b+=0.5) for(let a=tx0;a<=tx0+tw;a+=0.5) if(waterSD(a,b)<0.3){ wet=true; break; }
    const sg=wet?9:tw<20?2:1, shaped=hilly||wet, geo=shaped?new T.PlaneGeometry(tw,th,Math.min(128,Math.ceil(tw*sg)),Math.min(128,Math.ceil(th*sg))):new T.PlaneGeometry(tw,th);
    if(shaped){ const pa=geo.attributes.position; for(let v=0;v<pa.count;v++){ const px=tx0+tw/2+pa.getX(v), pz=ty0+th/2-pa.getY(v), hv=w3dHt(px,pz); if(hv>1e-4) pa.setZ(v,hv); else if(wet){ const dv=w3dDip(px,pz); if(dv<0) pa.setZ(v,dv); } } geo.computeVertexNormals();
      // on hills the slope is taken from the height field itself, so the shading runs unbroken from one piece of ground to the next
      if(hilly){ const na=geo.attributes.normal, e=0.5, Hq=(x,z)=>{ const h=w3dHt(x,z); return h>1e-4?h:0; }; for(let v=0;v<pa.count;v++){ if(pa.getZ(v)<=1e-4) continue; const px=tx0+tw/2+pa.getX(v), pz=ty0+th/2-pa.getY(v), hx=(Hq(px+e,pz)-Hq(px-e,pz))/(2*e), hz=(Hq(px,pz+e)-Hq(px,pz-e))/(2*e), l=Math.hypot(hx,hz,1); na.setXYZ(v,-hx/l,hz/l,1/l); } } }
    const m=new T.Mesh(geo,mat(tx,rt)); m.rotation.x=-Math.PI/2; m.position.set(tx0+tw/2,y,ty0+th/2); m.receiveShadow=true; put(m); yield; } }
// material settings for anything lying on the ground: it is left out where a cutting has been marked (see the mask in w3dBuild)
// Stencil bit 1 marks the cuttings; bit 2 marks where the sharp near ground has been drawn, so the coarse far ground (which is flat, and would
// otherwise lie over the river beds and shores the near ground models) is left out there.
function w3dCut(){ const T=w3d.T; return {stencilWrite:true,stencilFunc:T.NotEqualStencilFunc,stencilRef:1,stencilFuncMask:1,stencilWriteMask:0,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.KeepStencilOp}; }
function w3dCutNear(){ const T=w3d.T; return {stencilWrite:true,stencilFunc:T.NotEqualStencilFunc,stencilRef:3,stencilFuncMask:1,stencilWriteMask:2,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.ReplaceStencilOp}; }
function w3dCutFar(){ const T=w3d.T; return {stencilWrite:true,stencilFunc:T.EqualStencilFunc,stencilRef:0,stencilFuncMask:3,stencilWriteMask:0,stencilFail:T.KeepStencilOp,stencilZFail:T.KeepStencilOp,stencilZPass:T.KeepStencilOp}; }
function w3dSee(m){ return m; }
/* Seeing the metro through the city, without making anything in the city transparent. The frame is drawn in layers:
   1. the whole scene as usual, every surface solid (the fast path);
   2. only what lies underground (trains, rails, tunnel floors, station halls, platforms) once more, into a texture
      of its own, with nothing in front of it;
   3. that texture laid over the picture at part strength, in a soft region round the watched train and its way ahead.
   The result is what you would get if everything between the camera and the metro (ground, streets, buildings,
   trees) were made the same degree transparent, but it costs one small extra pass and one blend, whatever stands
   in the way. */
function w3dRender(){ const T=w3d.T, R=w3d.R, cam=w3d.cam3, k=w3d.seeW||0; R.render(w3d.S,cam); if(k<=0.001||!w3d.seeAt) return;
  const bw=R.domElement.width, bh=R.domElement.height;
  if(!w3d.urt||w3d.urt.width!==bw||w3d.urt.height!==bh){ if(w3d.urt) w3d.urt.dispose(); w3d.urt=new T.WebGLRenderTarget(bw,bh,{type:T.HalfFloatType,samples:2,depthBuffer:true}); }
  if(!w3d.cq){ const m=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{tU:{value:null},uM:{value:new T.Vector4()},uE:{value:new T.Vector4(1,0,1,1)},uK:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader:`uniform sampler2D tU; uniform vec4 uM; uniform vec4 uE; uniform float uK; varying vec2 vUv;
        void main(){ vec4 c=texture2D(tU,vUv); if(c.a<0.004) discard; vec2 d=gl_FragCoord.xy-uM.xy; float r=length(vec2(dot(d,uE.xy)*uE.z,dot(d,vec2(-uE.y,uE.x))*uE.w));
          gl_FragColor=vec4(c.rgb/max(c.a,0.004),c.a*uK*(1.0-smoothstep(0.25,1.0,r)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}); const q=new T.Mesh(new T.PlaneGeometry(2,2),m); q.frustumCulled=false; const sc=new T.Scene(); sc.add(q); w3d.cq={sc,m,cam:new T.OrthographicCamera(-1,1,1,-1,0,1)}; }
  // 2. the underground alone
  const bg=w3d.S.background, fg=w3d.S.fog, au=R.shadowMap.autoUpdate, nu=R.shadowMap.needsUpdate; w3d.S.background=null; R.shadowMap.autoUpdate=false; R.shadowMap.needsUpdate=false;
  // A cutaway, so it reads as looking in, not as a picture pasted on: of the walls and roofs of tunnels and halls only
  // what lies behind their nearest surface is drawn (first their nearest depth alone, then everything deeper than it),
  // which leaves the far wall and takes away the roof and the wall on the camera's side; then floors, platforms and trains.
  const ac0=R.autoClear; R.autoClear=false; R.setRenderTarget(w3d.urt); R.setClearColor(0x000000,0); R.clear();
  if(!w3d.preM) w3d.preM=new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide});
  cam.layers.set(2); w3d.S.overrideMaterial=w3d.preM; R.render(w3d.S,cam); w3d.S.overrideMaterial=null;
  for(const m of (w3d.shellM||[])){ m.depthFunc=T.GreaterDepth; m.depthWrite=false; } R.render(w3d.S,cam); for(const m of (w3d.shellM||[])){ m.depthFunc=T.LessEqualDepth; m.depthWrite=true; }
  R.clearDepth(); cam.layers.set(1); R.render(w3d.S,cam); cam.layers.set(0); R.setRenderTarget(null); R.autoClear=ac0; w3d.S.background=bg; R.shadowMap.autoUpdate=au; R.shadowMap.needsUpdate=nu;
  // 3. laid over the picture, round the train and along its route
  const [x,yT,z,u3,sg,P3,len3]=w3d.seeAt, v=w3d.seeV||(w3d.seeV=new T.Vector3()), at=u=>{ const uu=clamp(u,0,len3), p=polyAt(P3.pts,P3.cum,uu); v.set(p[0],w3dHAt(P3,uu)+0.014,p[1]).project(cam); return v.z>1||v.z<-1||Math.abs(v.x)>4||Math.abs(v.y)>4?null:[(v.x+1)/2*bw,(v.y+1)/2*bh]; };
  const sm=at(u3)||[bw/2,bh/2]; let s0=null, s1=null; for(const d of [0.55,0.3,0.1]) if((s0=at(u3-sg*d))) break; for(const d of [1.25,0.9,0.6,0.3]) if((s1=at(u3+sg*d))) break; s0=s0||sm; s1=s1||sm;
  let dx=s1[0]-s0[0], dy=s1[1]-s0[1]; const L=Math.hypot(dx,dy)||1; dx/=L; dy/=L; const la=clamp(L/2+bh*0.1,bh*0.2,bh*0.6), sb=clamp(la*0.62,bh*0.17,bh*0.3), tg=[(s0[0]+s1[0])/2,(s0[1]+s1[1])/2,dx,dy,la,sb];
  let S=w3d.seeS; if(!S) S=w3d.seeS=tg; else { if(S[2]*tg[2]+S[3]*tg[3]<0){ tg[2]=-tg[2]; tg[3]=-tg[3]; } const f=Math.min(1,(w3d.seeDt||0.016)*7); for(let i=0;i<6;i++) S[i]+=(tg[i]-S[i])*f; }
  const al=Math.hypot(S[2],S[3])||1, U=w3d.cq.m.uniforms; U.tU.value=w3d.urt.texture; U.uM.value.set(S[0],S[1],0,0); U.uE.value.set(S[2]/al,S[3]/al,1/S[4],1/S[5]); U.uK.value=0.66*k;      /* the city in front keeps a third of its strength: the underground is seen through it, not instead of it */
  const ac=R.autoClear; R.autoClear=false; R.render(w3d.cq.sc,w3d.cq.cam); R.autoClear=ac; }
function w3dTrash(list){ if(list&&list.length) (w3d.trash||(w3d.trash=[])).push(...list); }
// old pieces are let go a few a frame, not all on the frame they are replaced
function w3dEmpty(){ if(w3d.trash&&w3d.trash.length){ w3dClear(w3d.trash.splice(0,3)); } }

// ---- everything that only changes with the network or the year
function w3dBuild(){
  const T=w3d.T, dark=w3dDark(), gs=G.stage+'|'+dark+'|'+G.seed, sig=netVersion+'|'+gs+'|'+(w3d.cutYear||0)+'|'+LANG+'|'+(bldFreeze&&w3d.pjSig!=null?w3d.pjSig:(w3d.pjSig=(G.projects||[]).map(p=>p.done?1:0).join(''))); if(sig===w3d.sig) return; w3d.sig=sig; w3dClear(w3d.objs); w3dTextures();
  if(gs!==w3d.gSig&&w3d.cars){ w3dTrash([w3d.cars.m]); w3d.cars=null; }
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
  // the sky itself: a dome that travels with the camera, blue deepening overhead, haze at the horizon, a glow round the sun
  // and clouds drifting on the wind (a few layers of soft noise, flattened towards the horizon)
  if(!w3d.sky){ const sm=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{uT:{value:0},uSun:{value:new T.Vector3(-8,14,10).normalize()},uNight:W3D_NIGHT},
      vertexShader:'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:`varying vec3 vD; uniform float uT; uniform vec3 uSun; uniform float uNight;
        float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return s; }
        void main(){ vec3 d=normalize(vD); float y=max(d.y,0.0);
          vec3 col=mix(vec3(0.87,0.92,0.95),vec3(0.30,0.53,0.84),pow(y,0.55));
          float sd=max(dot(d,uSun),0.0); col+=vec3(1.0,0.93,0.78)*(pow(sd,300.0)*1.5+pow(sd,12.0)*0.12);
          if(d.y>0.012){ vec2 uv=d.xz/(d.y+0.18)*1.5+vec2(uT*0.008,uT*0.003); float c=fbm(uv), c2=fbm(uv*2.3+vec2(4.0,-uT*0.006));
            float cov=smoothstep(0.50,0.72,c*0.75+c2*0.25), lit=0.82+0.18*smoothstep(0.45,0.8,fbm(uv+uSun.xz*0.25));
            col=mix(col,vec3(1.0,0.99,0.97)*lit,cov*smoothstep(0.012,0.14,d.y)*0.92); }
          // dusk and night: the sky goes to a deep blue with an afterglow low down, then stars
          float nn=uNight; vec3 dusk=mix(vec3(0.98,0.56,0.32),vec3(0.16,0.2,0.42),smoothstep(0.0,0.35,y)); col=mix(col,dusk,smoothstep(0.0,0.45,nn)*(1.0-smoothstep(0.55,1.0,nn)));
          col=mix(col,mix(vec3(0.07,0.09,0.18),vec3(0.015,0.02,0.05),pow(y,0.5)),smoothstep(0.45,1.0,nn));
          if(nn>0.5&&d.y>0.05){ vec2 sp=floor(d.xz/(d.y+0.3)*260.0); float st=step(0.9975,h2(sp)); col+=vec3(st)*smoothstep(0.6,1.0,nn)*0.9; }
          gl_FragColor=vec4(col,1.0); }`});
    w3d.sky=new T.Mesh(new T.SphereGeometry(55,32,16),sm); w3d.sky.renderOrder=-1000; w3d.sky.frustumCulled=false; w3d.sky.userData.keepSky=true; }
  if(!w3d.sky.parent) w3d.S.add(w3d.sky);
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
  const hillM=new T.MeshStandardMaterial({color:0xb5b1a8,roughness:0.9,side:T.DoubleSide}), piers=[], masts=[], wire=[], cuts=[], tubes=[], portals=[]; w3d.pierPts=[]; w3d.trains=[]; w3d.portals=portals;
  const o3=(pc,off)=>offsetPts(pc,off).map((q,i)=>[q[0],q[1],pc[i][2]]);
  for(const L of lines) if(L.stops.length>=2) w3dStopsOn(L);
  w3dStationPlan(); for(const L of lines) if(L.stops.length>=2) w3dStopsOn(L); w3dLevelPlan();
  for(const L of lines){ if(L.stops.length<2) continue; const P=L._p3, len=P.cum[P.cum.length-1], lc=new T.Color(lineColor(L));
    // inside a mountain: wherever the ground stands as high as the track, the line is in a tunnel bored through it
    const Hl=P.hill=P.pts.map((q,i)=>w3dHt(q[0],q[1])>P.Y[i]-0.02); { const n=Hl.length; for(let i=0;i<n;i++) if(Hl[i]) for(const u of P.sU) if(Math.abs(P.cum[i]-u)<W3D_PLAT/2+0.1) Hl[i]=false; }
    const above=w3dSpans(P,(y,i)=>y>0.003&&!Hl[i]), cutS=w3dSpans(P,(y,i)=>y<=0.006&&y>-0.05&&!Hl[i]), below=w3dSpans(P,(y,i)=>y<-0.05||Hl[i]), hillS=w3dSpans(P,(y,i)=>Hl[i]&&y>=-0.05);
    for(const [a,b] of hillS){ const sg=w3dTube(w3dPart(P,a,b),TUN_W+0.005,TUN_H+0.006,[2,4,6]); sg.computeVertexNormals(); const sh=w3dAdd(new T.Mesh(sg,hillM)); sh.castShadow=true; sh.receiveShadow=true; }
    for(const [a,b] of hillS) for(const [u,sg] of [[a,-1],[b,1]]){ if(u<0.2||u>len-0.2) continue; const q=polyAt(P.pts,P.cum,u), h=polyHead(P.pts,P.cum,u,0.3); portals.push([q[0],q[1],Math.atan2(h[1],h[0]),w3dHAt(P,u),TUN_W,TUN_H]); }
    const  stCut=(under)=>P.sU.filter(u=>(w3dHAt(P,u)<0)===under).map(u=>[u-W3D_PLAT/2-0.03,u+W3D_PLAT/2+0.03]);
    for(const [a,b] of above){ const pc=w3dPart(P,a,b), deck=w3dAdd(new T.Mesh(w3dRibbon(pc,DECK,TRK,0.014),concrete)); deck.castShadow=true; deck.receiveShadow=true;
      for(const s of [1,-1]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,s*(DECK+0.0002)),0.0004,TRK-0.002,0.006),new T.MeshStandardMaterial({color:lc,roughness:0.5}))); }
    // parapets stop at the stations, where the platforms take their place
    for(const [a,b] of w3dMinus(above,stCut(false))){ const pc=w3dPart(P,a,b); for(const s of [1,-1]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,s*(DECK-0.0015)),0.0015,TRK+0.008,0.008),concrete)).castShadow=true; }
    { const pc=w3dPart(P,0,len); for(const r of [W3D_TO+0.0048,W3D_TO-0.0048,-W3D_TO+0.0048,-W3D_TO-0.0048]) w3dAdd(new T.Mesh(w3dRibbon(o3(pc,r),0.0008,TRK+0.0016,0.0016),railM)).layers.enable(1); }
    for(const [a,b] of cutS){ const pc=w3dPart(P,a,b); cuts.push(pc); }
    for(const [a,b] of w3dMinus(below,stCut(true))) tubes.push(w3dPart(P,a,b));
    const pts=P.pts; let accM=0; for(let i=1;i<pts.length;i++){ const d=dist(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]); accM+=d;
      const a=Math.atan2(pts[i][1]-pts[i-1][1],pts[i][0]-pts[i-1][0]), y=P.Y[i]; if(Hl[i]||Hl[i-1]) continue;
      if(y>0.02){ // a pier never stands in a roadway: it is moved along the viaduct to the nearest clear spot, or that span simply runs longer
        const ca=Math.cos(a), sa=Math.sin(a), clear=(x,z)=>!w3dOnRoad(x,z,0.014)&&!w3dOnRoad(x-sa*0.012,z+ca*0.012,0.006)&&!w3dOnRoad(x+sa*0.012,z-ca*0.012,0.006); for(const o of [0,-0.08,0.08,-0.16,0.16]){ const px=pts[i][0]+ca*o, pz=pts[i][1]+sa*o; if(clear(px,pz)){ piers.push([px,pz,a,y/TRK]); w3d.pierPts.push([px,pz,1]); break; } } }
      if(y>0.004){ for(const hh of [0.036,0.044]) wire.push(pts[i-1][0],P.Y[i-1]+hh,pts[i-1][1],pts[i][0],y+hh,pts[i][1]);
        if(accM>=0.33&&!stations.some(s=>Math.abs(s.x-pts[i][0])<0.35&&Math.abs(s.y-pts[i][1])<0.35&&dist(s.x,s.y,pts[i][0],pts[i][1])<0.35)){ accM=0; masts.push([pts[i][0]-Math.sin(a)*(DECK-0.004),pts[i][1]+Math.cos(a)*(DECK-0.004),a,y-TRK]); } } }
    // trains: five cars that each follow the track, silver bodies, a band in the line colour, dark window strip and car ends
    const lcs=lineColor(L), parts=[], CAR=W3D_CAR;
    parts.push(w3dBox(CAR,0.024,0.019,0,0.012,0,0xe7eaee),w3dBox(CAR*0.98,0.0032,0.0195,0,0.0075,0,lcs),w3dBox(CAR*0.9,0.0075,0.0196,0,0.0155,0,0x3a4856),w3dBox(CAR*0.9,0.0012,0.01965,0,0.0186,0,0x6f8394),w3dBox(CAR*0.96,0.002,0.016,0,0.0248,0,0xb9bec5),w3dBox(CAR*0.5,0.003,0.008,0,0.0262,0,0x9aa0a8));
    for(const dx of [-0.39,-0.13,0.13,0.39]){ parts.push(w3dBox(0.0095,0.0165,0.0197,dx*CAR,0.0118,0,0xcfd4da),w3dBox(0.0035,0.0065,0.01975,dx*CAR-0.0024,0.0158,0,0x3a4856),w3dBox(0.0035,0.0065,0.01975,dx*CAR+0.0024,0.0158,0,0x3a4856)); }   /* four doors a side, each with two windows */
    for(const e of [-1,1]) parts.push(w3dBox(0.003,0.011,0.015,e*(CAR/2+0.0004),0.0148,0,0x1d2530),w3dBox(0.0031,0.0022,0.0152,e*(CAR/2+0.0004),0.0068,0,lcs),w3dBox(0.0012,0.0018,0.003,e*(CAR/2+0.002),0.0052,0.0055,0xfff3c4),w3dBox(0.0012,0.0018,0.003,e*(CAR/2+0.002),0.0052,-0.0055,0xfff3c4));
    const tg=w3dMerge(parts), tmat=w3dVehMat({roughness:0.32,metalness:0.35}), g0=trainAt(L,0), tm=new T.InstancedMesh(tg,tmat,g0.n*W3D_CARS);
    tm.castShadow=true; tm.frustumCulled=false; tm.layers.enable(1); w3dAdd(tm); w3d.trains.push({L,m:tm,n:g0.n,geo:tg}); }
  if(piers.length){ const pg=w3dMerge([{g:new T.CylinderGeometry(0.0075,0.009,TRK-0.014,10),m:new T.Matrix4().makeTranslation(0,(TRK-0.014)/2,0),c:dark?0x77767a:0xbdb9b1},{g:new T.CylinderGeometry(0.011,0.011,0.066,10),m:new T.Matrix4().makeTranslation(0,-0.0335,0),c:0xa9a59c},w3dBox(0.014,0.006,DECK*1.8,0,TRK-0.017,0,dark?0x77767a:0xbdb9b1)]);
    const pm=new T.InstancedMesh(pg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.9}),piers.length), M=new T.Matrix4(), Q=new T.Quaternion(), up=new T.Vector3(0,1,0), V=new T.Vector3(), Sc=new T.Vector3();
    piers.forEach((p,i)=>{ Q.setFromAxisAngle(up,-p[2]); M.compose(V.set(p[0],0,p[1]),Q,Sc.set(1,p[3],1)); pm.setMatrixAt(i,M); }); pm.castShadow=true; pm.receiveShadow=true; w3dAdd(pm); }
  if(masts.length){ const mg=w3dMerge([{g:new T.CylinderGeometry(0.0007,0.0008,0.05,6),m:new T.Matrix4().makeTranslation(0,TRK+0.025,0),c:0x9aa0a8},w3dBox(0.0008,0.0008,DECK*0.95,0,TRK+0.046,DECK*0.45,0x9aa0a8)]);
    const mm=new T.InstancedMesh(mg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.5,metalness:0.5}),masts.length), M=new T.Matrix4(), Q=new T.Quaternion(), up=new T.Vector3(0,1,0), V=new T.Vector3(), one=new T.Vector3(1,1,1);
    masts.forEach((p,i)=>{ Q.setFromAxisAngle(up,-p[2]); M.compose(V.set(p[0],p[3],p[1]),Q,one); mm.setMatrixAt(i,M); }); mm.castShadow=true; w3dAdd(mm); }
  if(wire.length){ const wg=new T.BufferGeometry(); wg.setAttribute('position',new T.Float32BufferAttribute(wire,3)); w3dAdd(new T.LineSegments(wg,new T.LineBasicMaterial({color:0x33363b,transparent:true,opacity:0.7}))); }
  // open cuttings where the track sinks below the street: the ground is masked out over them (stencil), and a concrete
  // trough with low parapets carries the track down to the tunnel mouth
  for(const pc of cuts){ const flat=pc.map(q=>[q[0],q[1]]), mk=new T.Mesh(w3dRibbon(flat,TUN_W-0.0006,0.0012,0),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:T.AlwaysStencilFunc,stencilFail:T.ReplaceStencilOp,stencilZFail:T.ReplaceStencilOp,stencilZPass:T.ReplaceStencilOp}));
    mk.renderOrder=-10; w3dAdd(mk); const tr=w3dAdd(new T.Mesh(w3dTrough(pc,TUN_W-0.0012,0.011),new T.MeshStandardMaterial({color:0xb9b6ae,roughness:0.9,side:T.DoubleSide}))); tr.receiveShadow=true; }
  if(tubes.length){ const B=G.bounds, ep=new T.Mesh(new T.PlaneGeometry(B[2]-B[0]+40,B[3]-B[1]+40),new T.MeshBasicMaterial({color:0x17181b,fog:false})); ep.rotation.x=Math.PI/2; ep.position.set((B[0]+B[2])/2,-0.0015,(B[1]+B[3])/2); w3dAdd(ep); }
  // tunnel mouths in a hillside: a concrete frame round the bore, wing walls holding the slope back
  { const rl=G.rail, B0=G.bounds; for(let i=1;i<rl.length;i++){ if(rl[i][0]<B0[0]-3||rl[i][0]>B0[2]+3||rl[i][1]<B0[1]-3||rl[i][1]>B0[3]+3) continue; const h0=w3dHt(rl[i-1][0],rl[i-1][1])>0.045, h1=w3dHt(rl[i][0],rl[i][1])>0.045; if(h0!==h1) portals.push([rl[i][0],rl[i][1],Math.atan2(rl[i][1]-rl[i-1][1],rl[i][0]-rl[i-1][0]),0.002,0.042,0.05]); } }
  if(portals.length){ const pp=[]; for(const [x,z,a,y,hw,hh] of portals){ const Fm=new T.Matrix4().makeTranslation(x,y,z).multiply(new T.Matrix4().makeRotationY(-a)), B=(w,h,d,lx,ly,lz,c)=>{ const q=w3dBox(w,h,d,lx,ly,lz,c); q.m=Fm.clone().multiply(q.m); pp.push(q); };
      B(0.02,0.012,2*hw+0.03,0,hh+0.005,0,0xb5b1a8); for(const e of [-1,1]){ B(0.02,hh+0.012,0.012,0,(hh+0.012)/2-0.001,e*(hw+0.007),0xb5b1a8); B(0.012,hh*0.8,0.05,0,hh*0.4,e*(hw+0.036),0xa7a39a); } B(0.021,0.004,2*hw+0.036,0,hh+0.013,0,0x8f8b82); }
    const pm=w3dAdd(new T.Mesh(w3dMerge(pp),new T.MeshStandardMaterial({vertexColors:true,roughness:0.9}))); pm.castShadow=true; pm.receiveShadow=true; }
  w3d.shellM=[];      /* materials of tunnel and hall walls and roofs: drawn specially when the underground is looked into (w3dRender) */
  if(tubes.length){ w3dTunnelTex(); const tm=w3dSee(new T.MeshBasicMaterial({map:w3d.tunTex,vertexColors:true,side:T.DoubleSide,fog:false})); const tmS=tm.clone(); w3d.shellM.push(tmS); for(const pc of tubes){ w3dAdd(new T.Mesh(w3dTube(pc,TUN_W,TUN_H,[0]),tm)).layers.enable(1); { const sh=w3dAdd(new T.Mesh(w3dTube(pc,TUN_W,TUN_H,[2,4,6]),tmS)); sh.layers.enable(2); } }
    // deep earth under everything, seen through the thinned ground round a train underground
    const B=G.bounds, ef=new T.Mesh(new T.PlaneGeometry(B[2]-B[0]+40,B[3]-B[1]+40),new T.MeshBasicMaterial({color:0x4d463d,fog:false})); ef.rotation.x=-Math.PI/2; ef.position.set((B[0]+B[2])/2,-0.33,(B[1]+B[3])/2);      /* below the deepest passages */ w3dAdd(ef); }
  // stations: platforms beside the outermost tracks, a canopy over all of them with the line colours on its edge,
  // columns, name boards, benches and a concourse under the viaduct; lines running side by side share one station.
  // Underground the same platforms stand in a lit hall, with an entrance pavilion on the street above.
  { const stB=w3dBoxes(), parts=[], uparts=[], hall=[], hallX=[], spots=[], plats=[], signs=[], hubOf=k=>(w3d.hubs||[]).some(q=>q.cx===k); w3d.plats=plats; w3dLandmarks(parts,spots,signs); const pl=0xbdbab3, cano=0xeeeeea, col=0xa9b0b9, glass=0x9fb4c2, wall=0xd9d5cc; w3d.stY=new Map();
    // an interchange with platforms above ground is entered there: its platforms below ground reach the elevated station by passage
    for(const st of stations){ const cxI=w3d.stCx&&w3d.stCx.get(st.id); if(!cxI||cxI.n<2||hubOf(cxI.k)) continue; for(const L of lines){ const P=L._p3; if(L.stops.length<2||!P||!P.sU) continue; const k=L.stops.indexOf(st.id); if(k<0) continue; const u=P.sU[k]; if(w3dHAt(P,u)>0.02){ const q=polyAt(P.pts,P.cum,u); (w3d.hubs||(w3d.hubs=[])).push({x:q[0],y:q[1],r:3,cx:cxI.k,elev:1}); break; } } }
    for(const st of stations){ const here=[]; for(const L of lines){ if(L.stops.length<2||!L._p3||!L._p3.sU) continue; const k=L.stops.indexOf(st.id); if(k<0) continue; const u=L._p3.sU[k], p=polyAt(L._p3.pts,L._p3.cum,u), h=polyHead(L._p3.pts,L._p3.cum,u,0.2); here.push({L,p,h,y:w3dHAt(L._p3,u)}); }
      const groups=[]; for(const o of here){ const g=groups.find(g=>Math.abs(g[0].h[0]*o.h[0]+g[0].h[1]*o.h[1])>0.85&&dist(g[0].p[0],g[0].p[1],o.p[0],o.p[1])<0.7&&Math.abs(g[0].y-o.y)<0.03); if(g) g.push(o); else groups.push([o]); }
      if(here.length) w3d.stY.set(st.id,Math.max(...here.map(o=>o.y)));
      for(const g of groups){ const hx=g[0].h[0], hy=g[0].h[1], nx=-hy, ny=hx, cx=g.reduce((a,o)=>a+o.p[0],0)/g.length, cy=g.reduce((a,o)=>a+o.p[1],0)/g.length, under=g[0].y<0, dy=g[0].y-TRK;
        const offs=g.map(o=>(o.p[0]-cx)*nx+(o.p[1]-cy)*ny), lo=Math.min(...offs)-W3D_TO-0.0108, hi=Math.max(...offs)+W3D_TO+0.0108, PW=0.03, Lp=W3D_PLAT, mid=(lo+hi)/2, span=hi-lo+2*PW;
        const Gm=new T.Matrix4().makeTranslation(cx,0,cy).multiply(new T.Matrix4().makeRotationY(-Math.atan2(hy,hx)));
        const mk=(list,yo)=>(w,h,d,x,y,z,c)=>{ const q=w3dBox(w,h,d,x,y+yo,z,c); q.m=Gm.clone().multiply(q.m); list.push(q); }, B=mk(under?uparts:parts,dy), S=mk(parts,0);
        const lc=lineColor(g[0].L);
        if(!under) B(Lp+0.06,0.014,span+0.02,0,TRK-0.0082,mid,0xc4c1ba);                                  // the wider deck
        // more than one line through here: an island platform between each pair of them, so every track has a platform face
        { const so=offs.slice().sort((p,q)=>p-q); for(let k=1;k<so.length;k++){ const wI=so[k]-so[k-1]-2*(W3D_TO+0.0108), zc=(so[k]+so[k-1])/2; if(wI<0.014) continue;
            B(Lp,0.0075,wI,0,TRK+0.00375,zc,under?0xd8d5ce:pl); for(const e of [-1,1]) B(Lp,0.0004,0.003,0,TRK+0.0077,zc+e*(wI/2-0.0035),0xf2c200);
            for(const x of [-0.34,-0.18,0.18,0.34]) B(under?0.004:0.0014,under?0.04:0.032,under?0.004:0.0014,x,TRK+(under?0.0275:0.0235),zc,under?0xeceae4:0xdfe3e7);
            for(const x of [-Lp*0.3,0,Lp*0.3]){ B(0.03,0.0055,0.0012,x+0.03,TRK+0.031,zc,0xffffff); B(0.03,0.0012,0.00125,x+0.03,TRK+0.0292,zc,lineColor(g[Math.min(k,g.length-1)].L)); } for(const x of [-Lp*0.2,Lp*0.2]) B(0.016,0.003,0.004,x,TRK+0.009,zc,0x6d7480); } }
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
          Hh(hl,0.002,z1-z0,0,TRK-0.0032,mid,0x77746e); Hx(hl,0.002,z1-z0,0,TRK+0.05,mid,0xd6d3cc);                                     // track bed and ceiling
          for(const sd of [-1,1]){ const zw=sd<0?z0:z1, zp=sd<0?lo-PW/2:hi+PW/2, edge=sd<0?lo:hi;
            Hx(hl,0.052,0.002,0,TRK+0.024,zw,0xcbc8c0); Hx(hl,0.012,0.0006,0,TRK+0.0135,zw-sd*0.0014,0xa7a39a);                         // wall and dado
            Hh(Lp,0.0075,0.0006,0,TRK+0.00375,edge-sd*0.0002,0x97938b); Hx(Lp*0.94,0.0006,0.005,0,TRK+0.0488,zp,0xffffff);               // platform edge, strip lights
            for(let x=-Lp/2+0.07,q=0;x<Lp/2-0.05;x+=0.115,q++){ if(q%3===1) continue; Hx(0.04,0.016,0.0006,x,TRK+0.034,zw-sd*0.0016,POST[(q+st.id)%POST.length]); } }      // posters
          { const iv=offs.map(o=>[o-TUN_W,o+TUN_W]).sort((p,q)=>p[0]-q[0]); let zc=z0; const gaps=[]; for(const [a,b] of iv){ if(a>zc+0.001) gaps.push([zc,a]); zc=Math.max(zc,b); } if(zc<z1-0.001) gaps.push([zc,z1]);
            for(const ex of [-1,1]){ for(const [a,b] of gaps) Hx(0.002,0.052,b-a,ex*hl/2,TRK+0.024,(a+b)/2,0xbfbcb4); Hx(0.002,0.052-TUN_H,z1-z0,ex*hl/2,TRK+TUN_H-0.002+(0.052-TUN_H)/2,mid,0xbfbcb4); } }                         // end walls, open where the tunnels leave
          // the way up. One for a whole interchange (a single station building for every line that meets here, the way a big Japanese
          // station is one building), on dry ground with its whole footprint clear of the roadway; if no such plot is free, the
          // building stands on both sides of the street with a glazed bridge across it.
          const cxI=w3d.stCx&&w3d.stCx.get(st.id), cxKey=cxI?cxI.k:'s'+st.id, nLx=Math.max(here.length,cxI?cxI.n:1);
          let bigSt=nLx>=2||(st.lv||0)>=2, ez=mid+span/2+0.045, ex=0, found=false, bridge=null; const BW=Math.min(0.44,0.26+0.06*Math.max(0,nLx-2));
          const freeOfW=(px,py,r)=>{ for(const q of spots){ if(!q.g) continue; const ex=px-q.x, ey=py-q.y; if(Math.abs(ex*q.hx+ey*q.hy)<q.len/2+r&&Math.abs(-ex*q.hy+ey*q.hx)<q.half+r) return false; } return true; }, freeOf=(dx,dz,r)=>freeOfW(cx+hx*dx+nx*dz,cy+hy*dx+ny*dz,r);
          const clearW=(px,py,ux,uy,hw,hd)=>{ const n=Math.max(2,Math.ceil(hw/0.04)), m=Math.max(2,Math.ceil(hd/0.04)); for(let a=0;a<=n;a++) for(let c=0;c<=m;c++){ const u=-hw+2*hw*a/n, v=-hd+2*hd*c/m, x=px+ux*u-uy*v, y=py+uy*u+ux*v; if(waterSD(x,y)<0.05||w3dOnRoad(x,y,0.01)||keepAt(x,y)) return false; } return true; }, boxOk=(dx,dz,hw,hd)=>clearW(cx+hx*dx+nx*dz,cy+hy*dx+ny*dz,hx,hy,hw,hd);
          if(hubOf(cxKey)) found=false; else {
            for(const big of (bigSt?[true,false]:[false])){ if(!(big&&w3d.dbgBridge)) for(const dz of [span/2+0.045,-(span/2+0.045),span/2+0.11,-(span/2+0.11),span/2+0.22,-(span/2+0.22),span/2+0.34,-(span/2+0.34)]){ for(const dx of [0,0.22,-0.22,0.4,-0.4]){ const z=mid+dz, so=dz>0?1:-1; if(big?boxOk(dx,z+so*0.03,BW/2+0.02,0.075)&&freeOf(dx,z+so*0.03,0.04):boxOk(dx,z,0.062,0.04)&&freeOf(dx,z,0.03)){ ez=z; ex=dx; found=true; break; } } if(found) break; } if(found){ bigSt=big; break; }
              if(big&&G.rn){ // no plot: two wings facing each other across the nearest street, joined by a bridge over it
                const h=rnNearEdge(G.rn,cx+nx*mid,cy+ny*mid,1.2); if(h){ const R=G.rn, e=h.e, ra=Math.atan2(R.y[R.eb[e]]-R.y[R.ea[e]],R.x[R.eb[e]]-R.x[R.ea[e]]), ux=Math.cos(ra), uy=Math.sin(ra), rw=ROAD_W[R.ec[e]]/2+0.025, WW=Math.min(0.3,BW*0.75);
                  for(const t of [0,0.18,-0.18,0.36,-0.36]){ const px=h.px+ux*t, py=h.py+uy*t, wings=[1,-1].map(s2=>[px-uy*s2*(rw+0.055),py+ux*s2*(rw+0.055)]); if(wings.every(w=>clearW(w[0],w[1],ux,uy,WW/2,0.05)&&freeOfW(w[0],w[1],0.03))){ bridge={px,py,a:ra,ux,uy,rw,WW,wings}; break; } } } } } }          { const sx=cx+nx*mid, sy=cy+ny*mid, ci=clamp(Math.round(sy),0,H-1)*W+clamp(Math.round(sx),0,W-1); let hub=null, bd=1e9;
            for(const q of (w3d.hubs||[])){ const d=dist(q.x,q.y,sx,sy); if((q.air?(G.air&&G.air[ci]&&d<16):d<q.r)&&(q.cx==null||q.cx===cxKey)&&d<bd){ bd=d; hub=q; } }
            if(hub){ if(bd>0.3) w3dPassage(hall,hallX,sx,sy,g[0].y,hub.x,hub.y,hub.elev?TRK:0,lc);
              plats.push({x:sx,y:sy,hx,hy,len:Lp,half:span/2,lv:g[0].y}); continue; } }
          if(bridge){ const {px,py,a:ra,ux,uy,rw,WW,wings}=bridge, Fm=new T.Matrix4().makeTranslation(px,0,py).multiply(new T.Matrix4().makeRotationY(-ra)), Bw=(w,h,d,lx,y,lz,c)=>{ const q=w3dBox(w,h,d,lx,y,lz,c); q.m=Fm.clone().multiply(q.m); parts.push(q); }, hb=0.07+0.012*Math.min(3,nLx);
              wings.forEach((w,k)=>{ const s2=k?-1:1; stB.mall({x:w[0]-WW/2,y:w[1]-0.045,w:WW,d:0.09,h:hb/BZ3,a:ra},((st.id*2654435761)>>>0)+k); Bw(WW+0.02,0.003,0.11,0,0.0015,s2*(rw+0.055),0xc9c7c1); spots.push({x:w[0],y:w[1],hx:ux,hy:uy,len:WW+0.02,half:0.055,h:hb+0.02,g:1}); });
              const L2=2*rw+0.02; Bw(0.07,0.022,L2,0,0.045,0,0x9fb4c2); Bw(0.074,0.003,L2+0.004,0,0.0575,0,0xe9ecef); Bw(0.074,0.003,L2+0.004,0,0.0335,0,0xbfc4ca); for(const e of [-1,1]) Bw(0.074,0.004,0.002,0,0.03,e*0.012,lc);      // the bridge, high enough for a bus beneath
              spots.push({x:px,y:py,hx:-uy,hy:ux,len:L2,half:0.04,h:0.065});
              for(const s2 of [1,-1]) signs.push({m:Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.045,s2*(rw+0.055)-s2*0.0465)).multiply(new T.Matrix4().makeRotationY(s2>0?Math.PI:0)),w:Math.min(0.24,WW*0.8),h:0.014,text:nm(st.name),c:lc});
              (w3d.hubs||(w3d.hubs=[])).push({x:px,y:py,r:3,cx:cxKey}); plats.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp,half:span/2,lv:g[0].y}); continue; }
          if(!found){ plats.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp,half:span/2,lv:g[0].y}); continue; } const so=ez>=mid?1:-1;
          if(bigSt){ // a busy station gets a station building over its entrance: shops at street level, floors above, its name across the front
            const zc=ez+so*0.03, hb=0.07+0.012*Math.min(3,nLx); S(BW+0.04,0.003,0.15,ex,0.0015,zc,0xc9c7c1); { const wx=cx+hx*ex+nx*zc, wz=cy+hy*ex+ny*zc; stB.mall({x:wx-BW/2,y:wz-0.055,w:BW,d:0.11,h:hb/BZ3,a:Math.atan2(hy,hx)},(st.id*2654435761>>>0)); (w3d.hubs||(w3d.hubs=[])).push({x:wx,y:wz,r:3,cx:cxKey}); }      /* a station building is a shopping building: shop fronts at street level, banded glazing above, not rows of flat windows */ S(0.27,0.003,0.12,ex,hb+0.0015,zc,0xbfc4ca); S(0.06,0.012,0.04,ex-0.07,hb+0.009,zc,0xb7bcc2); S(0.1,0.003,0.03,ex,0.0245,zc+so*0.07,cano);
            signs.push({m:Gm.clone().multiply(new T.Matrix4().makeTranslation(ex,0.031,zc+so*0.0565)).multiply(new T.Matrix4().makeRotationY(so>0?0:Math.PI)),w:0.2,h:0.014,text:nm(st.name),c:lc});
            spots.push({x:cx+hx*ex+nx*zc,y:cy+hy*ex+ny*zc,hx,hy,len:BW+0.04,half:0.075,h:hb+0.02,g:1}); }
          else { S(0.12,0.0025,0.075,ex,0.00125,ez,0xc9c7c1); S(0.07,0.02,0.035,ex,0.01,ez,glass); S(0.082,0.003,0.045,ex,0.0215,ez,cano); S(0.082,0.004,0.0015,ex,0.0185,ez+0.022,lc); S(0.012,0.012,0.012,ex+0.06,0.03,ez,lc); S(0.0018,0.026,0.0018,ex+0.06,0.013,ez,col);
            spots.push({x:cx+hx*ex+nx*ez,y:cy+hy*ex+ny*ez,hx,hy,len:0.13,half:0.045,h:0.03,g:1}); (w3d.hubs||(w3d.hubs=[])).push({x:cx+hx*ex+nx*ez,y:cy+hy*ex+ny*ez,r:3,cx:cxKey}); } plats.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp,half:span/2,lv:g[0].y}); continue; }
        B(Lp*0.82,0.0022,span+0.006,0,TRK+0.0405,mid,cano);                                    // canopy
        B(Lp*0.74,0.0006,Math.max(0.012,span*0.3),0,TRK+0.0418,mid,0x9fc3d9); for(let x=-Lp*0.4;x<=Lp*0.4+1e-6;x+=Lp*0.1) B(0.004,0.003,span+0.01,x,TRK+0.0422,mid,0xcfd4da); for(const e of [-1,1]) B(Lp*0.82,0.004,0.003,0,TRK+0.0405,mid+e*(span/2+0.003),lc);      // a skylight along its ridge, ribs across it, its edges in the line's colour
        // the concourse hangs under the deck, clear of whatever street runs below; stairs come down on the side that is not roadway
        for(const sd of [-1,1]) signs.push({m:Gm.clone().multiply(new T.Matrix4().makeTranslation(0,TRK+0.0362+dy,(sd<0?lo-PW:hi+PW)+sd*0.0016)).multiply(new T.Matrix4().makeRotationY(sd>0?0:Math.PI)),w:0.2,h:0.0115,text:nm(st.name),c:lc});      // its name along both edges of the canopy
        if(g[0].y<0.062){ // close to the ground: steps up from a small entrance beside the platforms, no hall beneath
          const sOk=sd=>[-0.1,0,0.1].every(e=>waterSD(cx+hx*e+nx*(mid+sd*(span/2+0.03)),cy+hy*e+ny*(mid+sd*(span/2+0.03)))>0.03)&&!w3dOnRoad(cx+nx*(mid+sd*(span/2+0.03)),cy+ny*(mid+sd*(span/2+0.03)),0.02), sd=[1,-1].find(sOk);
          if(sd){ const z=mid+sd*(span/2+0.022); S(0.09,0.02,0.03,0,0.01,z,0xe9e5de); S(0.096,0.003,0.036,0,0.0215,z,cano); S(0.05,0.012,0.0008,0,0.009,z+sd*0.0154,0x55697a); } }
        else { const cw=Math.min(span*0.8,0.11); signs.push({m:Gm.clone().multiply(new T.Matrix4().makeTranslation(0,TRK-0.029+dy,mid+cw/2+0.0016)),w:0.17,h:0.012,text:nm(st.name),c:lc}); B(0.34,0.03,cw,0,TRK-0.029,mid,wall); B(0.3,0.016,cw+0.002,0,TRK-0.03,mid,glass); B(0.34,0.002,cw+0.004,0,TRK-0.0455,mid,0xb9b6ae);
          const dryS=sd=>[-0.17,-0.12,0.12,0.17].every(e=>waterSD(cx+hx*e+nx*(mid+sd*(cw/2+0.012)),cy+hy*e+ny*(mid+sd*(cw/2+0.012)))>0.03), sideOk=sd=>dryS(sd)&&!w3dOnRoad(cx+nx*(mid+sd*(cw/2+0.03)),cy+ny*(mid+sd*(cw/2+0.03)),0.02), sds=[1,-1].filter(sideOk), use=sds.length?sds:[1,-1].filter(dryS).slice(0,1);
          for(const sd of use) for(const ex of [-0.12,0.12]){ const z=mid+sd*(cw/2+0.012); B(0.05,0.003,0.014,ex,0.0225,z,0xc9c6bf); B(0.05,0.003,0.014,ex+Math.sign(ex)*0.045,0.0075,z,0xc9c6bf); B(0.0025,TRK-0.045,0.0025,ex-Math.sign(ex)*0.02,(TRK-0.045)/2,z,col); B(0.06,0.0012,0.016,ex,TRK-0.047,z,lc); } }
        spots.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp+0.1,half:span/2+0.05,h:g[0].y+0.055}); plats.push({x:cx+nx*mid,y:cy+ny*mid,hx,hy,len:Lp,half:span/2,lv:g[0].y}); }
      // an interchange where lines meet at an angle: one concourse building joining their platforms
      // groups of one interchange above ground (this station and its neighbours in the complex) are joined by a covered bridge at the upper platforms' level, clear of every track
      if(w3d.stShift) for(const L of lines){ const sh=w3d.stShift.get(L.id+'|'+st.id); if(!sh||!L._p3) continue; const P=L._p3, k=L.stops.indexOf(st.id), u=P.sU[k], y=w3dHAt(P,u), cxI=w3d.stCx&&w3d.stCx.get(st.id); if(!cxI||y<0.02) continue;
        // the bridge runs beside this line's viaduct (never over its tracks), from the end of its platforms back to the crossing, at platform level
        const u0=u-Math.sign(sh)*(W3D_PLAT/2-0.04), u1=u-sh, h=polyHead(P.pts,P.cum,u,0.3), nx=-h[1], ny=h[0], off=DECK+0.032, a=polyAt(P.pts,P.cum,u0), b=polyAt(P.pts,P.cum,u1);
        let side=1; { const m=polyAt(P.pts,P.cum,(u0+u1)/2); if(w3dOnRoad(m[0]+nx*off,m[1]+ny*off,0)&&!w3dOnRoad(m[0]-nx*off,m[1]-ny*off,0)) side=-1; }
        const ax=a[0]+nx*off*side, az=a[1]+ny*off*side, bx=b[0]+nx*off*side, bz=b[1]+ny*off*side, d=dist(ax,az,bx,bz); if(d<0.15) continue; const ang=Math.atan2(bz-az,bx-ax), Fm=new T.Matrix4().makeTranslation((ax+bx)/2,0,(az+bz)/2).multiply(new T.Matrix4().makeRotationY(-ang)), yb=y+TRK+0.002;
        const Bq=(w,hh,d2,x,yy,z,c)=>{ const o=w3dBox(w,hh,d2,x,yy,z,c); o.m=Fm.clone().multiply(o.m); parts.push(o); }; Bq(d,0.003,0.03,0,yb,0,0xc9c6bf); for(const e of [-1,1]) Bq(d,0.016,0.0015,0,yb+0.0095,e*0.0145,0x9fb4c2); Bq(d,0.002,0.034,0,yb+0.0185,0,0xeeeeea); Bq(d,0.0012,0.0342,0,yb+0.0015,0,lineColor(L)); } }
    // every name board in one mesh: the names are written onto one sheet, each board takes its strip of it
    if(signs.length){ const n=signs.length, rows=Math.ceil(n/2), cv=document.createElement('canvas'); cv.width=1024; cv.height=Math.min(4096,rows*64); const g=cv.getContext('2d'), pos=[], uv=[], V=new T.Vector3();
      signs.forEach((q,i)=>{ const cxp=(i%2)*512, cyp=Math.floor(i/2)*64; if(cyp+64>cv.height) return; g.fillStyle='#f7f7f4'; g.fillRect(cxp,cyp,512,64); g.fillStyle=q.c; g.fillRect(cxp,cyp,512,9); g.fillRect(cxp,cyp+55,512,9); g.fillRect(cxp+10,cyp+16,34,32); g.fillStyle='#fff'; g.font='700 24px '+FONT(); g.textAlign='center'; g.textBaseline='middle'; g.fillText('M',cxp+27,cyp+33);
        g.fillStyle='#1b2030'; let fs=34; g.font='700 '+fs+'px '+FONT(); while(fs>14&&g.measureText(q.text).width>440){ fs-=2; g.font='700 '+fs+'px '+FONT(); } g.fillText(q.text,cxp+278,cyp+33);
        const u0=cxp/1024, u1=(cxp+512)/1024, v1=1-cyp/cv.height, v0=1-(cyp+64)/cv.height, hw=q.w/2, hh=q.h/2; for(const [x,y,u,v] of [[-hw,-hh,u0,v0],[hw,-hh,u1,v0],[hw,hh,u1,v1],[-hw,-hh,u0,v0],[hw,hh,u1,v1],[-hw,hh,u0,v1]]){ V.set(x,y,0).applyMatrix4(q.m); pos.push(V.x,V.y,V.z); uv.push(u,v); } });
      const tx=new T.CanvasTexture(cv); tx.colorSpace=T.SRGBColorSpace; tx.anisotropy=8; const sg=new T.BufferGeometry(); sg.setAttribute('position',new T.Float32BufferAttribute(pos,3)); sg.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); w3dAdd(new T.Mesh(sg,new T.MeshBasicMaterial({map:tx,side:T.DoubleSide}))); }
    for(const m of stB.meshes(true)) w3dAdd(m);
    w3d.stSpots=spots; if(parts.length){ const sm=new T.Mesh(w3dMerge(parts),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.6,metalness:0.05}))); sm.castShadow=true; sm.receiveShadow=true; w3dAdd(sm); }
    if(uparts.length) w3dAdd(new T.Mesh(w3dMerge(uparts),new T.MeshBasicMaterial({vertexColors:true,fog:false}))).layers.enable(1);
    if(hall.length) w3dAdd(new T.Mesh(w3dMerge(hall),new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide}))).layers.enable(1);
    if(hallX.length){ const hm=new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide}); w3d.shellM.push(hm); w3dAdd(new T.Mesh(w3dMerge(hallX),hm)).layers.enable(2); } }
  // the rider's own train (seen from outside in the chase view)
  w3d.myTrain=null; const L0=lines.find(l=>l.stops.length>=2); if(L0){ const tr=w3d.trains[0]; w3d.myTrain=w3dAdd(new T.InstancedMesh(tr.geo,w3dVehMat({roughness:0.3,metalness:0.35}),W3D_CARS));      /* the train being ridden: lit at night like every other */ w3d.myTrain.castShadow=true; w3d.myTrain.layers.enable(1); w3d.myTrain.frustumCulled=false; }
  w3d.bcStale=true; w3d.labels.forEach(l=>l.el.remove()); w3d.labels=[]; }
function w3dNear(L,x,y){ const P=L._p3?L._p3.pts:null; if(!P) return [x,y,0]; const C=L._p3.cum; let bd=1e9, bx=x, by=y, bu=0; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1e-9, q=clamp(((x-a[0])*dx+(y-a[1])*dy)/l2,0,1), xx=a[0]+dx*q, yy=a[1]+dy*q, d=(xx-x)**2+(yy-y)**2; if(d<bd){ bd=d; bx=xx; by=yy; bu=C[i-1]+(C[i]-C[i-1])*q; } } return [bx,by,bu]; }
// the track's height at distance u along a line's 3D path
function w3dHAt(P,u){ const c=P.cum, n=c.length; if(u<=0) return P.Y[0]; if(u>=c[n-1]) return P.Y[n-1]; const i=Math.max(1,trainSeg(c,u)), f=(u-c[i-1])/((c[i]-c[i-1])||1); return P.Y[i-1]+(P.Y[i]-P.Y[i-1])*f; }
// the stretches (as distances along the path) where the track's height passes a test, e.g. above the street
function w3dSpans(P,ok){ const o=[], n=P.pts.length; let a=null; for(let i=0;i<n;i++){ const v=ok(P.Y[i],i); if(v&&a==null) a=P.cum[Math.max(0,i-1)]; if(!v&&a!=null){ o.push([a,P.cum[i]]); a=null; } } if(a!=null) o.push([a,P.cum[n-1]]); return o.filter(q=>q[1]-q[0]>0.05); }
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
  for(let i=0;i<n;i++){ const a=pc[Math.max(0,i-1)], b=pc[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l; const nx=-dz*hw, nz=dx*hw, x=pc[i][0], z=pc[i][1], y0=Math.min(pc[i][2]-0.002,top-0.002);
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
/* A passage between platforms underground and the building they are entered from (a terminal, a station hall, the
   other level of an interchange). A long one does not run at platform level, where it would cut through other lines'
   tunnels: a shaft takes it down below every tunnel, it runs there with moving walkways, lit, and a shaft at the far
   end takes it up into the building. A short one is a plain corridor at platform level. */
function w3dPassage(hall,hallX,ax,az,ay,bx,bz,by,lc){ const T=w3d.T, d=dist(ax,az,bx,bz), ang=Math.atan2(bz-az,bx-ax), deep=d>0.45, yP=deep?-0.27:ay+0.0065, W=deep?0.05:0.034, Hh=0.032;
  const Cm=new T.Matrix4().makeTranslation((ax+bx)/2,0,(az+bz)/2).multiply(new T.Matrix4().makeRotationY(-ang)), cb=(list,w,h,dd,x,y,z,c)=>{ const q=w3dBox(w,h,dd,x,y,z,c); q.m=Cm.clone().multiply(q.m); list.push(q); }, L=deep?d-0.05:d;
  cb(hall,L,0.002,W,0,yP,0,0xd8d5ce); cb(hall,L,0.0006,0.004,0,yP+0.0014,0,lc); for(const sd of [-1,1]) cb(hallX,L,Hh,0.002,0,yP+Hh/2,sd*(W/2),0xcbc8c0); cb(hallX,L,0.002,W+0.004,0,yP+Hh,0,0xd6d3cc); cb(hall,L*0.96,0.0006,0.006,0,yP+Hh-0.0015,0,0xffffff);
  if(deep){ for(const sd of [-1,1]){ cb(hall,L-0.06,0.0016,0.012,0,yP+0.0018,sd*0.012,0x3a3d43); for(const e of [-1,1]) cb(hall,L-0.06,0.0008,0.0008,0,yP+0.0028,sd*0.012+e*0.006,0xf2c200); cb(hall,L-0.06,0.006,0.001,0,yP+0.006,sd*0.019,0x2b3440); }
    for(let x=-L/2+0.1;x<L/2-0.08;x+=0.24) for(const sd of [-1,1]) cb(hall,0.05,0.016,0.0006,x,yP+0.016,sd*(W/2-0.0012),[0xd9534f,0x3f7fbf,0xe0a030,0x4f9e62][Math.round((x+sd)*7)&3]);      // posters along the walls
    // the shafts: lift and escalator wells at both ends
    for(const [sx,top] of [[-d/2,ay+0.04],[d/2,by]]){ const h=top-yP; cb(hall,0.06,0.002,0.06,sx,yP,0,0xd8d5ce); for(const e of [-1,1]){ cb(hallX,0.002,h,0.06,sx+e*0.03,yP+h/2,0,0xcbc8c0); cb(hallX,0.06,h,0.002,sx,yP+h/2,e*0.03,0xcbc8c0); } cb(hall,0.012,h*0.96,0.02,sx,yP+h/2,0,0x8f98a3); } } }
function w3dStationPlan(){ const gap=DECK*2+0.012, gapS=gap+0.042; w3d.stShift=new Map();      /* at a station the lines of one direction stand further apart: there is an island platform between each pair */
  // stations of different lines that stand right next to each other are one complex: laid out together, so their platforms cannot overlap
  const used=stations.filter(st=>lines.some(L=>L.stops.length>=2&&L._p3&&L._p3.sU&&L.stops.includes(st.id))), par=used.map((_,i)=>i), find=i=>{ while(par[i]!==i) i=par[i]=par[par[i]]; return i; };
  const shares=(a,b)=>lines.some(L=>L.stops.includes(a.id)&&L.stops.includes(b.id));
  for(let i=0;i<used.length;i++) for(let j=i+1;j<used.length;j++) if(dist(used[i].x,used[i].y,used[j].x,used[j].y)<1.25&&!shares(used[i],used[j])) par[find(i)]=find(j);
  const comps=new Map(); used.forEach((st,i)=>{ const r=find(i); if(!comps.has(r)) comps.set(r,[]); comps.get(r).push(st); });
  w3d.stCx=new Map(); let ck=0;
  for(const sts of comps.values()){ const here=[], cx=sts.reduce((a,q)=>a+q.x,0)/sts.length, cy=sts.reduce((a,q)=>a+q.y,0)/sts.length, nL=new Set(lines.filter(L=>L.stops.length>=2&&sts.some(q=>L.stops.includes(q.id))).map(L=>L.id)).size; ck++; for(const q of sts) w3d.stCx.set(q.id,{k:'c'+ck,n:nL,x:cx,y:cy});
    for(const st of sts) for(const L of lines){ if(L.stops.length<2||!L._p3||!L._p3.sU) continue; const k=L.stops.indexOf(st.id); if(k<0) continue; const P=L._p3, u=P.sU[k]; here.push({P,u,h:polyHead(P.pts,P.cum,u,0.5),p:polyAt(P.pts,P.cum,u)}); }
    if(!here.length) continue; const cl=[];
    for(const o of here){ const c=cl.find(c=>Math.abs(c.ax[0]*o.h[0]+c.ax[1]*o.h[1])>0.72); if(c) c.m.push(o); else cl.push({ax:o.h.slice(),m:[o]}); }
    cl.sort((a,b)=>b.m.length-a.m.length); const under=w3dHAt(here[0].P,here[0].u)<0;
    /* Lines that cross here in another direction are a level apart, and above ground their platforms do not stand over one
       another either: the second group stops just past the crossing, clear of the first group's platforms, and a covered
       bridge joins the two (as at a big Japanese interchange, where one line's platforms lie beside the other's). */
    const halfMain=cl.length?(cl[0].m.length*gapS)/2+0.12:0.2;
    cl.forEach((c,ci)=>{ const ax=c.ax, n=[-ax[1],ax[0]], dY0=ci*(under?-0.066:0.07), sh=0;
      c.m.forEach(o=>{ o.lat=(o.p[0]-cx)*n[0]+(o.p[1]-cy)*n[1]; }); c.m.sort((a,b)=>a.lat-b.lat);
      c.m.forEach((o,i)=>{ const want=c.m.length>1?(i-(c.m.length-1)/2)*gapS:o.lat, P=o.P, len=P.cum[P.cum.length-1];
        let du0=0; if(sh){ const sg=o.u+sh<len-0.6?1:-1; du0=sg*sh; if(o.u+du0<0.6||o.u+du0>len-0.6) du0=0; if(du0){ const L=lines.find(l=>l._p3===P), st=sts.find(q=>L&&L.stops.includes(q.id)); if(L&&st) w3d.stShift.set(L.id+'|'+st.id,du0); } }
        // above ground, a line crossing the main ones goes underground through the station: one station, its platforms on two levels,
        // the crossing line's beneath the others' (a level deeper again for a third direction)
        const yNow=w3dHAt(P,o.u), dY=ci&&!under?(UGY-0.07*(ci-1))-yNow:dY0, ease=ci&&!under?4.6:3.6;
        for(let v=0;v<P.pts.length;v++){ const du=Math.abs(P.cum[v]-o.u); if(du>ease) continue;
          if(du<1.9){ const w=1-smooth(du,0.75,1.9), q=P.pts[v], t=(q[0]-cx)*ax[0]+(q[1]-cy)*ax[1]; P.pts[v]=[q[0]+(cx+ax[0]*t+n[0]*want-q[0])*w,q[1]+(cy+ax[1]*t+n[1]*want-q[1])*w]; }
          if(dY) P.Y[v]+=dY*(1-smooth(du,1.0,ease)); } }); }); }
  for(const L of lines){ const P=L._p3; if(!P||L.stops.length<2) continue; for(let i=1;i<P.pts.length;i++) P.cum[i]=P.cum[i-1]+dist(P.pts[i-1][0],P.pts[i-1][1],P.pts[i][0],P.pts[i][1]); } }
/* No line passes through another, and none runs at the level of the water.
   Where the paths of two lines cross at the same height (other than two tracks of one corridor weaving), one of them
   is taken a level up over the other, or underground a level deeper, easing back to its own height either side: a
   flyover, or a deeper tunnel. The line moved is the one whose own stations are further from the crossing, and the
   change of height is over before it reaches them, so no platform is tilted or split by it.
   Where a line would meet a river or the shore at about street level (on its ramp, in a cutting), it is lifted onto
   a bridge or pushed down into a tunnel there. */
function w3dCrossings(){ const Ls=lines.filter(L=>L.stops.length>=2&&L._p3), grid=new Map(), out=[];
  Ls.forEach((L,li)=>{ const p=L._p3.pts; for(let i=1;i<p.length;i++){ const k=Math.floor((p[i][0]+p[i-1][0])/2)*4099+Math.floor((p[i][1]+p[i-1][1])/2); let c=grid.get(k); if(!c) grid.set(k,c=[]); c.push(li,i); } });
  Ls.forEach((L,li)=>{ const P=L._p3, p=P.pts; for(let i=1;i<p.length;i++){ const ax=p[i-1][0], ay=p[i-1][1], bx=p[i][0], by=p[i][1], gx=Math.floor((ax+bx)/2), gy=Math.floor((ay+by)/2), rx=bx-ax, ry=by-ay, la=Math.hypot(rx,ry); if(la<1e-6) continue;
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){ const c=grid.get((gx+ox)*4099+gy+oy); if(!c) continue; for(let q=0;q<c.length;q+=2){ const lj=c[q]; if(lj<=li) continue; const Q=Ls[lj]._p3, j=c[q+1], cx=Q.pts[j-1][0], cy=Q.pts[j-1][1], sx=Q.pts[j][0]-cx, sy=Q.pts[j][1]-cy, lb=Math.hypot(sx,sy), den=rx*sy-ry*sx; if(lb<1e-6||Math.abs(den)<1e-9) continue;
          const t=((cx-ax)*sy-(cy-ay)*sx)/den, u=((cx-ax)*ry-(cy-ay)*rx)/den; if(t<0||t>=1||u<0||u>=1) continue;
          const ua=lerp(P.cum[i-1],P.cum[i],t), ub=lerp(Q.cum[j-1],Q.cum[j],u); out.push({A:P,B:Q,ua,ub,x:ax+rx*t,y:ay+ry*t,par:Math.abs(rx*sx+ry*sy)/(la*lb)}); } } } });
  return out; }
function w3dBump(P,u,dY,flat,ease){ for(let v=0;v<P.pts.length;v++){ const du=Math.abs(P.cum[v]-u); if(du<ease) P.Y[v]+=dY*(1-smooth(du,flat,ease)); } }
function w3dLevelPlan(){ const room=(P,u)=>{ let m=9; for(const s of (P.sU||[])) m=Math.min(m,Math.abs(s-u)); return m; };
  const sep=()=>{ for(let pass=0;pass<5;pass++){ let n=0;
    for(const c of w3dCrossings()){ if(c.par>0.94) continue; const ya=w3dHAt(c.A,c.ua), yb=w3dHAt(c.B,c.ub), gapY=Math.abs(ya-yb); if(gapY>=0.058) continue;
      const ra=room(c.A,c.ua), rb=room(c.B,c.ub), mvA=ra>rb, P=mvA?c.A:c.B, u=mvA?c.ua:c.ub, r=Math.max(ra,rb), yM=mvA?ya:yb, yO=mvA?yb:ya, ease=clamp(r-W3D_PLAT/2-0.05,0.6,3.6); if(r<W3D_PLAT/2+0.7){ // both are at their platforms here (an interchange): one whole station moves a level, platforms and all
        const both=ya>0.003&&yb>0.003, mA=both?ya>=yb:ya<=yb, P2=mA?c.A:c.B, u2=mA?c.ua:c.ub, y2=mA?ya:yb, yo=mA?yb:ya; w3dBump(P2,u2,both?(yo+0.072)-y2:(yo-0.068)-y2,W3D_PLAT/2+0.3,W3D_PLAT/2+2.2); n++; continue; } n++;
      // up over it if both are in the air and the other is not higher already; otherwise down under it
      const up=yO>0.003&&yM>0.003, dY=up?(yO+0.072)-yM:(yO-0.068)-yM; w3dBump(P,u,dY,Math.min(0.5,ease*0.3),ease); }
    if(!n) break; } }; sep();
  // nothing at water level
  for(const L of lines){ const P=L._p3; if(!P||L.stops.length<2) continue; const n=P.pts.length, wet=P.pts.map(q=>waterSD(q[0],q[1])<0.12); let a=-1;
    for(let v=0;v<=n;v++){ const bad=v<n&&wet[v]&&P.Y[v]>-0.116&&P.Y[v]<0.05; if(bad&&a<0) a=v; if(!bad&&a>=0){ const b=v-1; let ym=0; for(let k=a;k<=b;k++) ym+=P.Y[k]; ym/=(b-a+1);
        // over it or under it, whichever the line is nearer to; the points either side ease to that height, but never back into the band
        const down=ym<-0.01, T=down?-0.12:0.054, u=(P.cum[a]+P.cum[b])/2, hw=(P.cum[b]-P.cum[a])/2+0.2;
        for(let k=0;k<n;k++){ const du=Math.abs(P.cum[k]-u); if(du>=hw+1.6||((k<a||k>b)&&wet[k])) continue; const ny=lerp(P.Y[k],T,1-smooth(du,hw,hw+1.6)); P.Y[k]=down?Math.min(P.Y[k],ny):Math.max(P.Y[k],ny); } a=-1; } } }
  // A station stands on level track: a line still climbing or sinking where it stops is levelled through the platforms (at
  // the height it had in the middle of them, or just clear of street level if that was neither above nor below it), and
  // takes up its slope again beyond their ends.
  for(const L of lines){ const P=L._p3; if(!P||L.stops.length<2||!P.sU) continue; const flat=W3D_PLAT/2+0.12, fix=[];
    for(const u of P.sU){ let ys=w3dHAt(P,u); const band=ys>-0.055&&ys<0.03; if(!band&&Math.abs(w3dHAt(P,u-0.4)-ys)<0.003&&Math.abs(w3dHAt(P,u+0.4)-ys)<0.003) continue; if(band) ys=ys<-0.012?-0.068:TRK;      /* a station half way up is put on the full viaduct, clear over any street beneath, or underground */ fix.push([u,ys]); }
    // each point answers to the station nearest it only, so two stations close together cannot pull each other's platforms out of level
    if(fix.length) for(let v=0;v<P.pts.length;v++){ let bd=1e9, by=0, near=1e9; for(const u of P.sU) near=Math.min(near,Math.abs(P.cum[v]-u)); for(const [u,ys] of fix){ const du=Math.abs(P.cum[v]-u); if(du<bd){ bd=du; by=ys; } } if(bd<flat+1.3&&bd<=near+1e-6) P.Y[v]=lerp(P.Y[v],by,1-smooth(bd,flat,flat+1.3)); } }
  sep();      /* and once more, for crossings those two rules brought back together */ }
/* The places a city is known by, as models rather than icons: the main line railway with its tracks and a train on it,
   the central station (platforms under canopies, a hall with a clock tower, a footbridge), the coach station (a
   canopy over the bays, coaches waiting) and every airport (runways with their markings, taxiways, a terminal with
   piers, a control tower, aircraft at the stands, hangars). All of it goes into the same mesh as the metro stations. */
function w3dLandmarks(parts,spots,signs){ const T=w3d.T, B0=G.bounds, texB=w3dBoxes();
  // a block in one of the city's own facade materials, placed in a landmark's frame (centre cx,cz, turned by a)
  const texAt=(cx,cz,a,lx,lz,w,d,h,kind,hh)=>{ const ca=Math.cos(a), sa=Math.sin(a), wx=cx+ca*lx-sa*lz, wz=cz+sa*lx+ca*lz; texB.building({x:wx-w/2,y:wz-d/2,w,d,h:h/BZ3,a},0,hh||7,false,kind); };
  const frame=(x,z,a)=>{ const Fm=new T.Matrix4().makeTranslation(x,0,z).multiply(new T.Matrix4().makeRotationY(-a)); return {Fm,B:(w,h,d,lx,y,lz,c)=>{ const q=w3dBox(w,h,d,lx,y,lz,c); q.m=Fm.clone().multiply(q.m); parts.push(q); },
    R:(w,h,d,lx,y,lz,c,rot)=>{ parts.push({g:new T.BoxGeometry(w,h,d),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(lx,y,lz)).multiply(rot),c}); },
    C:(r0,r1,h,lx,y,lz,c,seg,rot)=>{ let m=Fm.clone().multiply(new T.Matrix4().makeTranslation(lx,y,lz)); if(rot) m=m.multiply(rot); parts.push({g:new T.CylinderGeometry(r0,r1,h,seg||14),m,c}); }}; };
  // --- main line: ballast, two tracks, masts
  const rl=densify(G.rail.filter(p=>p[0]>B0[0]-3&&p[0]<B0[2]+3&&p[1]>B0[1]-3&&p[1]<B0[3]+3),0.25);
  if(rl.length>2){ const cum=[0]; for(let i=1;i<rl.length;i++) cum.push(cum[i-1]+dist(rl[i-1][0],rl[i-1][1],rl[i][0],rl[i][1]));
    // where the line crosses water it climbs onto a bridge (level again by the time it reaches a station): a deep girder on piers standing in the bed
    const RBR=0.032, wetR=rl.map(q=>waterSD(q[0],q[1])<0.06), dW=new Float32Array(rl.length).fill(1e9), sts=[G.fac.station,...(G.fac2||[]).filter(f=>f.t==='rail')]; { let d=1e9; for(let i=0;i<rl.length;i++){ d=wetR[i]?0:d+(i?cum[i]-cum[i-1]:0); dW[i]=d; } d=1e9; for(let i=rl.length-1;i>=0;i--){ d=wetR[i]?0:d+(i<rl.length-1?cum[i+1]-cum[i]:0); if(d<dW[i]) dW[i]=d; } }
    const lift=rl.map((q,i)=>{ let ds=1e9; for(const st of sts) ds=Math.min(ds,dist(st.x,st.y,q[0],q[1])); return RBR*(1-smooth(dW[i],0.15,1.5))*smooth(ds,0.95,1.7); }), r3=(pts)=>pts.map((q,i)=>[q[0],q[1],TRK+lift[i]]), rl3=r3(rl);
    w3d.railP={pts:rl,cum,len:cum[cum.length-1],lift};
    const ball=w3dAdd(new T.Mesh(w3dRibbon(rl3,0.036,0.0032,0.0032),w3dSee(new T.MeshStandardMaterial({color:0x8f877b,roughness:1})))); ball.receiveShadow=true;
    const rm=new T.MeshStandardMaterial({color:0x4a4a4c,roughness:0.35,metalness:0.6}); for(const r of [W3D_TO+0.0048,W3D_TO-0.0048,-W3D_TO+0.0048,-W3D_TO-0.0048]) w3dAdd(new T.Mesh(w3dRibbon(r3(offsetPts(rl,r)),0.0008,0.0046,0.0014),rm));
    { const gm=new T.MeshStandardMaterial({color:0x6f7a84,roughness:0.6,metalness:0.3}), cm=new T.MeshStandardMaterial({color:0xb5b1a8,roughness:0.9}); let a0=-1;
      for(let i=0;i<=rl.length;i++){ const up=i<rl.length&&lift[i]>0.0015; if(up&&a0<0) a0=i; if(!up&&a0>=0){ const seg=rl3.slice(Math.max(0,a0-1),i+1), off=Math.max(0,a0-1); if(seg.length>1){ const dk=w3dAdd(new T.Mesh(w3dRibbon(seg,0.04,0,0.012),cm)); dk.castShadow=true; dk.receiveShadow=true; const em=w3dAdd(new T.Mesh(w3dRibbon(seg,0.034,-0.011,0.05),cm)); em.receiveShadow=true;
            for(const sd of [1,-1]) w3dAdd(new T.Mesh(w3dRibbon(offsetPts(seg.map(q=>[q[0],q[1]]),sd*0.041).map((q,k)=>[q[0],q[1],seg[k][2]]),0.0016,0.016,0.03),gm)).castShadow=true; } a0=-1; } }
      let acc=0; for(let i=1;i<rl.length;i++){ acc+=cum[i]-cum[i-1]; if(acc<0.5||!(waterSD(rl[i][0],rl[i][1])<-0.08)) continue; acc=0; const a=Math.atan2(rl[i][1]-rl[i-1][1],rl[i][0]-rl[i-1][0]), F=frame(rl[i][0],rl[i][1],a); w3d.pierPts.push([rl[i][0],rl[i][1],0]); F.B(0.02,lift[i]-W3D_BED,0.09,0,(lift[i]+W3D_BED)/2-0.012,0,0xa9a59c); F.B(0.03,0.006,0.1,0,lift[i]-0.014,0,0xb5b1a8); } }
    let acc=0; for(let i=1;i<rl.length;i++){ acc+=cum[i]-cum[i-1]; if(acc<0.4||w3dHt(rl[i][0],rl[i][1])>0.02) continue; acc=0; const a=Math.atan2(rl[i][1]-rl[i-1][1],rl[i][0]-rl[i-1][0]), F=frame(rl[i][0],rl[i][1],a), ly=lift[i]; F.B(0.0016,0.05,0.0016,0,0.025+ly,0.034,0x8a9099); F.B(0.0012,0.0012,0.068,0,0.049+ly,0,0x8a9099); }
    // an intercity train: eight long cars, white with a blue band
    const cp=[], CL=0.165; cp.push(w3dBox(CL,0.026,0.02,0,0.016,0,0xf2f3f5),w3dBox(CL*0.99,0.0045,0.0204,0,0.0105,0,0x2f5fb5),w3dBox(CL*0.92,0.007,0.0206,0,0.02,0,0x2a3644),w3dBox(CL*0.96,0.002,0.016,0,0.03,0,0xc4c9cf)); for(const e of [-1,1]) cp.push(w3dBox(0.003,0.014,0.016,e*(CL/2+0.0004),0.018,0,0x1d2530));
    for(const e of [-1,1]) cp.push(w3dBox(0.0012,0.002,0.004,e*(CL/2+0.002),0.008,0.006,0xfff3c4),w3dBox(0.0012,0.002,0.004,e*(CL/2+0.002),0.008,-0.006,0xfff3c4));
    const im=new T.InstancedMesh(w3dMerge(cp),w3dVehMat({roughness:0.3,metalness:0.35}),8); im.castShadow=true; im.frustumCulled=false; w3dAdd(im); w3d.railT={m:im,n:8,cl:CL+0.006}; } else { w3d.railP=null; w3d.railT=null; }
  // --- central station
  w3d.hubs=[];      /* where a metro station under one of these buildings comes up: inside the building, by a passage (see the stations) */
  for(const st of [G.fac.station,...(G.fac2||[]).filter(f=>f.t==='rail')]){ const site=railSite(st), PL=1.5, sd=site.sd, a=site.a, c=[site.x,site.y], F=frame(c[0],c[1],a);
    for(const z of [-0.053,0.053]){ F.B(PL,0.008,0.03,0,0.004,z,0xbdbab3); F.B(PL,0.0005,0.003,0,0.0083,z-Math.sign(z)*0.0125,0xf2c200); F.B(PL*0.9,0.0025,0.036,0,0.047,z,0xe9e9e4); for(let x=-PL*0.42;x<=PL*0.42;x+=0.14) F.B(0.0025,0.039,0.0025,x,0.0275,z+Math.sign(z)*0.008,0xcfd4da); for(const x of [-0.4,0,0.4]){ F.B(0.05,0.006,0.001,x,0.036,z,0x1f3f8f); F.B(0.02,0.003,0.005,x+0.12,0.0095,z,0x6d7480); } }
    F.B(0.03,0.004,0.16,0.64,0.058,0,0xcfd2d6); F.B(0.03,0.012,0.002,0.64,0.064,-0.079,0x9aa7b3); F.B(0.03,0.012,0.002,0.64,0.064,0.079,0x9aa7b3); for(const z of [-0.075,0.075]) F.B(0.03,0.058,0.012,0.64,0.029,z,0xcfd2d6);
    // the train shed: a glazed barrel vault on iron ribs over the tracks and platforms, open at both ends, a lantern along its ridge
    { const SL=1.04, SR=0.088, SY=0.82, arch=(len,r,x,c,y0)=>parts.push({g:new T.CylinderGeometry(r,r,len,20,1,true,0,Math.PI),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(x,y0||0,0)).multiply(new T.Matrix4().makeScale(1,SY,1)).multiply(new T.Matrix4().makeRotationZ(Math.PI/2)),c});
      arch(SL,SR,0,0xa9c3d3); for(let x=-SL/2;x<=SL/2+1e-6;x+=SL/8) arch(0.008,SR+0.0012,x,0x5f6b76); arch(SL*0.9,0.02,0,0xe4edf2,SR*SY-0.012);
      for(const z of [-SR,SR]){ F.B(SL,0.004,0.006,0,0.002,z,0x6d7780); for(let x=-SL/2;x<=SL/2+1e-6;x+=SL/8) F.B(0.004,0.012,0.004,x,0.006,z,0x5f6b76); }
      for(const e of [-1,1]){ F.B(0.003,0.02,SR*2,e*SL/2,SR*SY-0.006,0,0x5f6b76); for(const z of [-SR*0.62,SR*0.62]) F.B(0.003,SR*SY*0.78,0.003,e*SL/2,SR*SY*0.39,z,0x5f6b76); } }       // footbridge and its stair towers
    const hz=sd*0.135, ca_=Math.cos(a), sa_=Math.sin(a), hs_=hashInt(Math.round(c[0]*31+c[1]*17)), wall=(lx,lz,w,d,h,kind)=>{ const wx=c[0]+ca_*lx-sa_*lz, wz=c[1]+sa_*lx+ca_*lz; texB.building({x:wx-w/2,y:wz-d/2,w,d,h:h/BZ3,a},0,hs_,false,kind); };
    // the hall in real masonry: brick wings with rows of windows either side of a rendered centre block, under tiled roofs
    wall(-0.23,hz,0.26,0.1,0.085,'brick'); wall(0.23,hz,0.26,0.1,0.085,'brick'); wall(0,hz,0.2,0.11,0.11,'plaster'); wall(-0.3,hz,0.05,0.05,0.2,'plaster');
    F.B(0.74,0.004,0.108,0,0.087,hz,0x8c4a3a); F.B(0.21,0.004,0.118,0,0.112,hz,0x8c4a3a);
    for(const x of [-0.06,0,0.06]) F.B(0.036,0.07,0.0008,x,0.045,hz+sd*0.0555,0x55697a);
    F.B(0.058,0.006,0.058,-0.3,0.203,hz,0x8c4a3a); F.C(0.0001,0.03,0.05,-0.3,0.231,hz,0x5a6068,4,new T.Matrix4().makeRotationY(Math.PI/4)); F.C(0.016,0.016,0.002,-0.3,0.17,hz+sd*0.0262,0xf7f4ea,16,new T.Matrix4().makeRotationX(Math.PI/2));
    // a portico of columns under a stepped attic on the entrance front, wings with cornices, and a forecourt with a taxi rank
    for(const x of [-0.085,-0.051,-0.017,0.017,0.051,0.085]) F.C(0.0038,0.0044,0.062,x,0.031,hz+sd*0.066,0xf1ece0,10); F.B(0.2,0.008,0.022,0,0.066,hz+sd*0.064,0xe9e2d4); F.B(0.17,0.008,0.02,0,0.074,hz+sd*0.064,0xe9e2d4); F.B(0.11,0.007,0.018,0,0.0815,hz+sd*0.064,0xe9e2d4); F.B(0.21,0.003,0.03,0,0.0015,hz+sd*0.07,0xd9d3c6);
    for(const e of [-1,1]){ F.B(0.27,0.006,0.106,e*0.235,0.08,hz,0xd8d0c0); F.B(0.012,0.085,0.104,e*0.366,0.0425,hz,0xdcd4c4); }
    for(let k=0;k<5;k++){ F.B(0.026,0.007,0.012,-0.26+k*0.04,0.0045,hz+sd*0.15,k%2?0xe8c020:0xf2f2f2); F.B(0.014,0.005,0.011,-0.262+k*0.04,0.0095,hz+sd*0.15,0x2b3440); }
    F.B(0.16,0.003,0.028,0.22,0.03,hz+sd*0.15,0xe9ecef); for(const x of [0.15,0.29]) F.B(0.003,0.03,0.003,x,0.015,hz+sd*0.15,0x8a9099); F.B(0.07,0.02,0.022,0.22,0.011,hz+sd*0.15,0x2f8f6a); F.B(0.066,0.007,0.0225,0.22,0.015,hz+sd*0.15,0x2b3440);
    F.B(0.9,0.0012,0.14,0,0.0006,hz+sd*0.12,0xcfc8b8); for(const x of [-0.3,-0.1,0.1,0.3]){ F.B(0.0016,0.03,0.0016,x,0.015,hz+sd*0.13,0x5a6068); F.B(0.006,0.002,0.003,x,0.0305,hz+sd*0.13,0xf2efe2); }
    const nx=-Math.sin(a), ny=Math.cos(a); spots.push({x:c[0]+nx*sd*0.07,y:c[1]+ny*sd*0.07,hx:Math.cos(a),hy:Math.sin(a),len:PL+0.1,half:0.25,h:0.24,g:1,lm:1}); w3d.hubs.push({x:c[0]+nx*sd*0.135,y:c[1]+ny*sd*0.135,r:1.7});
    signs.push({m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.098,hz+sd*0.0562)).multiply(new T.Matrix4().makeRotationY(sd>0?0:Math.PI)),w:0.19,h:0.014,text:nm(st===G.fac.station?{k:'rail'}:facName(st)),c:'#3c4252'}); }
  // --- coach station
  for(const co of [G.fac.coach,...(G.fac2||[]).filter(f=>f.t==='coach')]){ const cs=coachSite(co), x=cs.x, z=cs.y, a=cs.a;
    const F=frame(x,z,a), RY=t=>new T.Matrix4().makeRotationY(t), RX=t=>new T.Matrix4().makeRotationX(t); F.B(0.6,0.0014,0.36,0,0.0007,0,0x55585e); F.B(0.6,0.003,0.006,0,0.0015,0.178,0xb9b6ae); for(const e of [-1,1]) F.B(0.006,0.003,0.36,e*0.298,0.0015,0,0xb9b6ae);
    // the hall: glass front to the street under a floating roof, a clock and a sign pylon
    texAt(x,z,a,0,-0.135,0.4,0.075,0.05,'plaster',hashInt(Math.round(x*13+z*7))); F.B(0.36,0.034,0.0008,0,0.022,-0.1732,0x4f6678); for(let k=-4;k<=4;k++) F.B(0.0025,0.036,0.0012,k*0.04,0.022,-0.1736,0xdfe3e7); F.B(0.44,0.005,0.1,0,0.0535,-0.14,0x2f6fae); F.B(0.45,0.0015,0.11,0,0.0568,-0.14,0xe9ecef);
    F.B(0.012,0.11,0.012,-0.25,0.055,-0.14,0xdfe3e7); F.B(0.05,0.03,0.014,-0.25,0.1,-0.14,0x0f7a5c);
    // seven bays set at an angle under a saw-tooth canopy, a coach in most of them
    const BC=[0xd9534f,0x2f6fae,0xf2f2f2,0x4f9e62,0xe0a030,0x7a5aa6,0xf2f2f2];
    for(let k=0;k<7;k++){ const bx=-0.24+k*0.08; F.R(0.076,0.003,0.1,bx,0.043,-0.035,k%2?0xe9ecef:0xcfd8df,new T.Matrix4().makeRotationZ(0.2)); F.B(0.002,0.012,0.1,bx+0.037,0.045,-0.035,0x7f8a96); F.B(0.003,0.04,0.003,bx-0.03,0.02,-0.075,0xa9b0b9); F.B(0.003,0.044,0.003,bx+0.03,0.022,0.015,0xa9b0b9); F.R(0.002,0.0003,0.11,bx+0.04,0.0016,0.0,0xe6e6e6,RY(0.42));
      if(k%4!==3){ F.R(0.024,0.022,0.078,bx+0.012,0.0135,0.04,BC[k],RY(0.42)); F.R(0.0245,0.008,0.07,bx+0.012,0.018,0.04,0x2b3440,RY(0.42)); F.R(0.02,0.002,0.06,bx+0.012,0.0255,0.04,0xe6e9ec,RY(0.42)); } }
    for(let k=-2;k<=2;k++) F.B(0.05,0.004,0.03,k*0.075,0.0595,-0.14,0x9fc3d9); F.B(0.03,0.01,0.03,0.17,0.0625,-0.16,0xb7bcc2); F.C(0.012,0.012,0.0016,0,0.04,-0.1745,0xf7f4ea,14,new T.Matrix4().makeRotationX(Math.PI/2)); for(const e of [-0.21,0.21]){ F.C(0.006,0.008,0.012,e,0.006,-0.19,0x8a8a86,8); F.C(0.014,0.014,0.02,e,0.022,-0.19,0x5f8f45,8); }
    F.B(0.5,0.006,0.012,0,0.0035,-0.09,0xc9c6bf);      // the passenger kerb along the bays
    // coaches waiting on the far side, the way in and out marked on the yard
    for(let k=0;k<3;k++){ F.B(0.078,0.022,0.024,-0.17+k*0.13,0.0135,0.135,BC[(k+2)%7]); F.B(0.072,0.008,0.0245,-0.17+k*0.13,0.018,0.135,0x2b3440); } for(const e of [-1,1]){ F.B(0.05,0.0003,0.004,e*0.24,0.0016,0.09,0xf2c200); F.B(0.012,0.0003,0.016,e*0.24+e*0.02,0.0016,0.09,0xf2c200); }
    spots.push({x,y:z,hx:Math.cos(a),hy:Math.sin(a),len:0.62,half:0.2,h:0.07,g:1,lm:1}); w3d.hubs.push({x:x-Math.sin(a)*-0.13,y:z+Math.cos(a)*-0.13,r:1.3});
    signs.push({m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.06,-0.094)).multiply(new T.Matrix4().makeRotationY(Math.PI)),w:0.2,h:0.012,text:nm(co===G.fac.coach?{k:'coach'}:facName(co)),c:'#0f7a5c'}); }
  // --- airports
  for(const ap of [G.fac.airport,...(G.fac2||[]).filter(f=>f.t==='air')]){ if(!ap||ap.x==null) continue; w3d.hubs.push({x:ap.term.x,y:ap.term.y,r:0,air:ap}); const a=ap.a, F=frame(ap.x,ap.y,a), ca=Math.cos(a), sa=Math.sin(a), tz=(ap.term.x-ap.x)*-sa+(ap.term.y-ap.y)*ca, ts=tz>=0?1:-1, RW=0x3a3d43, wl=0xf0f0f0;
    for(const [z,L,w] of [[-2.6,19,1.1],[2.2,15,0.9]]){ F.B(L,0.006,w,0,0.003,z,RW); for(let x=-L/2+1;x<L/2-0.8;x+=0.5) F.B(0.25,0.001,0.035,x,0.0062,z,wl); for(const e of [-1,1]){ for(let k=-3;k<=3;k++) F.B(0.35,0.001,0.05,e*(L/2-0.4),0.0062,z+k*w*0.12,wl); F.B(L,0.001,0.02,0,0.0062,z+e*(w/2-0.05),wl); } }
    F.B(0.22,0.005,4.8,-5,0.0025,-0.2,0x4a4d53); F.B(0.22,0.005,4.8,5,0.0025,-0.2,0x4a4d53); F.B(0.22,0.005,Math.abs(tz)-0.6,0,0.0025,ts*(Math.abs(tz)-0.6)/2+ts*2.2*0+ts*0.0,0x4a4d53); F.B(10,0.005,0.22,0,0.0025,tz-ts*1.9,0x4a4d53);
    F.B(8.6,0.0048,1.5,0,0.0024,tz-ts*1.05,0xb5b4ae);                                                               // apron
    texAt(ap.x,ap.y,a,0,tz+ts*0.2,6,0.55,0.11,'glass',3); F.B(6.06,0.006,0.62,0,0.113,tz+ts*0.2,0xe9ecef); F.B(6,0.03,0.56,0,0.015,tz+ts*0.2,0xdfe3e7); for(let x=-2.8;x<=2.8;x+=0.4) F.B(0.02,0.11,0.56,x,0.055,tz+ts*0.2,0xd6dbe0);
    texAt(ap.x,ap.y,a,0,tz+ts*0.55,1.2,0.3,0.15,'dglass',5); F.B(1.26,0.006,0.36,0,0.153,tz+ts*0.55,0xe9ecef); F.B(5.6,0.012,0.4,0,0.122,tz+ts*0.2,0xdfe4e8); F.B(4.6,0.01,0.26,0,0.133,tz+ts*0.2,0xeef1f3);
    for(let x=-2.9;x<=2.9;x+=0.2) F.B(0.006,0.085,0.004,x,0.072,tz+ts*0.477,0x6f8496); { const DY=0.046, dz=tz+ts*0.84, RL=1.5, sl=Math.atan2(DY,RL), rl=Math.hypot(DY,RL), asph=0x4a4d53, CC=[0xf2f2f2,0x1f2329,0xb7bcc3,0xa1262c,0x2c4d7a,0xe8c020,0x6c7076];
      // a car: body, glazed cabin, roof, four wheels. along: lying along the front (x) or nose-in (z)
      const car=(lx,y,lz,c,along)=>{ const q=(w,h,d,ox,oy,oz,cc)=>along?F.B(w,h,d,lx+ox,y+oy,lz+oz,cc):F.B(d,h,w,lx+oz,y+oy,lz+ox,cc); q(0.027,0.0048,0.0118,0,0.0042,0,c); q(0.015,0.0038,0.0106,-0.0015,0.0084,0,0x26303a); q(0.0135,0.0008,0.0098,-0.0015,0.0106,0,c); for(const ex of [-0.0085,0.0085]) for(const ez of [-0.0052,0.0052]) q(0.0048,0.0036,0.0018,ex,0.0018,ez,0x15171a); };
      F.B(5.9,0.006,0.24,0,DY-0.003,dz,0xb9b6ae); F.B(5.9,0.0006,0.2,0,DY+0.0004,dz,asph); for(const e of [-1,1]) F.B(5.9,0.008,0.004,0,DY+0.004,dz+e*0.118,0xd6d3cc); for(let x=-2.8;x<=2.8;x+=0.35) for(const e of [-1,1]) F.B(0.01,DY-0.006,0.01,x,(DY-0.006)/2,dz+e*0.108,0xa9a59c);      // the departures deck on its columns
      for(const e of [-1,1]){ F.R(rl,0.006,0.2,e*(2.95+RL/2),DY/2-0.003,dz,0xb9b6ae,new T.Matrix4().makeRotationZ(-e*sl)); F.R(rl,0.0006,0.17,e*(2.95+RL/2),DY/2+0.0006,dz,asph,new T.Matrix4().makeRotationZ(-e*sl)); for(const f of [0.3,0.6]) F.B(0.01,DY*f,0.16,e*(2.95+RL*(1-f)),DY*f/2-0.003,dz,0xa9a59c); }      // the ramps up to it
      // everything laid on the ground here has its own height, well clear of the ground and of each other, and none of it overlaps: nothing to flicker
      F.B(8.9,0.004,0.18,0,0.002,dz,asph); F.B(5.6,0.006,0.03,0,0.003,dz-ts*0.135,0xd9d6cf);                                               // arrivals at ground level beneath, with its kerb
      F.B(5.9,0.004,0.08,0,0.002,tz+ts*0.7,0xcfc8b8);                                                                                       // the pavement between the doors and the kerb
      for(let x=-2.6;x<=2.6;x+=0.65){ car(x,DY+0.0007,dz+ts*0.03,CC[(Math.round(x*10)&7)%7],true); car(x+0.2,0.004,dz-ts*0.03,CC[(Math.round(x*7)&7)%7],true); }      // cars setting down and picking up
      F.B(5.9,0.003,0.26,0,0.118,dz,0xe9ecef); for(let x=-2.8;x<=2.8;x+=0.7) F.B(0.008,0.118-DY,0.008,x,DY+(0.118-DY)/2,dz+ts*0.11,0xa9b0b9);     // the canopy over the departures kerb
      // the approach: from the gate along the far side of the car parks to both ends of the front
      const gz=tz+ts*1.7, lz=tz+ts*1.5; F.B(0.2,0.004,Math.abs(gz-lz)-0.1,0,0.002,(gz+lz)/2+ts*0.05,asph); F.B(8.9,0.004,0.2,0,0.002,lz,asph); for(const e of [-1,1]) F.B(0.2,0.004,Math.abs(lz-dz)-0.2,e*4.35,0.002,(lz+dz)/2,asph);
      for(const e of [-1,1]){ F.B(3.5,0.003,0.34,e*2.15,0.0015,tz+ts*1.17,0x5a5d63); for(const rz of [1.07,1.27]) F.B(3.4,0.0034,0.003,e*2.15,0.0017,tz+ts*(rz+0.035*(rz<1.1?-1:1)),0xe6e6e6);
        for(let k=0;k<64;k++){ const x=0.5+k*0.052; if(hashInt(k*31+(e>0?7:1))%3===0) continue; car(e*x,0.003,tz+ts*(k%2?1.11:1.23),CC[hashInt(k*17+3)%7],false); } } }
    signs.push({m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.2,tz+ts*0.71)).multiply(new T.Matrix4().makeRotationY(ts>0?0:Math.PI)),w:1.1,h:0.075,text:nm(ap===G.fac.airport?{k:'airport'}:facName(ap)),c:'#1d3b8f'});
    for(const px of [-2.2,-0.75,0.75,2.2]){ F.B(0.12,0.05,0.75,px,0.04,tz-ts*0.45,0xc9d1d8); F.B(0.13,0.004,0.77,px,0.067,tz-ts*0.45,0xe9ecef);
      // a jet bridge off each pier, with its round head
      for(const e of [-1,1]){ F.B(0.2,0.014,0.016,px+e*0.16,0.045,tz-ts*0.62,0xd9dee3); F.C(0.016,0.016,0.018,px+e*0.27,0.045,tz-ts*0.62,0xc3cad1,10); F.B(0.006,0.038,0.006,px+e*0.27,0.019,tz-ts*0.62,0x8f98a3); } }
    F.C(0.045,0.06,0.5,3.6,0.25,tz+ts*0.75,0xdfe3e7,14); F.C(0.085,0.065,0.05,3.6,0.525,tz+ts*0.75,0x2f3f4f,14); F.C(0.09,0.09,0.008,3.6,0.554,tz+ts*0.75,0xe9ecef,14); F.B(0.004,0.06,0.004,3.6,0.59,tz+ts*0.75,0xc8423a);      // control tower
    for(const hx of [-4,-3.1]){ texAt(ap.x,ap.y,a,hx,tz+ts*0.3,0.75,0.6,0.16,'shed',hx<-3.5?2:6); F.B(0.77,0.02,0.62,hx,0.17,tz+ts*0.3,0x9aa5b0); F.B(0.6,0.12,0.004,hx,0.06,tz+ts*0.3-ts*0.302,0x56616c); }
    { const nxa=-sa, nya=ca, at=(lx,lz)=>[ap.x+ca*lx+nxa*lz,ap.y+sa*lx+nya*lz]; let q=at(0,tz+ts*0.3); spots.push({x:q[0],y:q[1],hx:ca,hy:sa,len:6.3,half:0.75,h:0.2}); q=at(3.6,tz+ts*0.75); spots.push({x:q[0],y:q[1],hx:ca,hy:sa,len:0.3,half:0.15,h:0.66}); q=at(-3.55,tz+ts*0.3); spots.push({x:q[0],y:q[1],hx:ca,hy:sa,len:1.8,half:0.36,h:0.22}); q=at(0,tz-ts*0.85); spots.push({x:q[0],y:q[1],hx:ca,hy:sa,len:5.4,half:0.5,h:0.14}); }
    }
  // --- the city's developments, each a landmark of its own kind (a building site with a crane until it opens)
  for(const p of (G.projects||[])){ if(p.x<B0[0]-1||p.x>B0[2]+1||p.y<B0[1]-1||p.y>B0[3]+1) continue; const hs=hashInt(Math.round(p.x*10)*7919+Math.round(p.y*10)); let px=p.x, pz=p.y, a=(hs&3)*Math.PI/2;
    { const q=projSite(p); px=q.px; pz=q.pz; }
    const F=frame(px,pz,a), B=F.B, C=F.C, RYm=t=>new T.Matrix4().makeRotationY(t), dome=(r,lx,y,lz,c,sy)=>parts.push({g:new T.SphereGeometry(r,14,7,0,6.2832,0,1.5708),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(lx,y,lz)).multiply(new T.Matrix4().makeScale(1,sy||1,1)),c}), cone=(r,h,lx,y,lz,c,seg)=>C(0.0001,r,h,lx,y+h/2,lz,c,seg||4,RYm(Math.PI/4));
    let top=0.1; B(0.74,0.0026,0.74,0,0.0013,0,p.done?0xcfc8b8:0xc2b08c);                 // its plot
    if(!p.done){ top=0.3; B(0.3,0.06,0.24,-0.08,0.03,0.05,0xb8b4aa); for(let y=0.012;y<0.06;y+=0.012) B(0.304,0.0015,0.244,-0.08,y,0.05,0x8a8a86); for(const [x,z] of [[-0.23,-0.07],[0.07,-0.07],[0.07,0.17],[-0.23,0.17]]) B(0.006,0.085,0.006,x,0.0425,z,0x9a9a96);
      B(0.012,0.28,0.012,0.2,0.14,-0.18,0xe8b020); B(0.34,0.008,0.008,0.1,0.275,-0.18,0xe8b020); B(0.03,0.02,0.02,0.2,0.262,-0.18,0x3a3d43); B(0.002,0.12,0.002,-0.04,0.21,-0.18,0x33363b); B(0.03,0.012,0.03,-0.04,0.146,-0.18,0x7a7d83); B(0.1,0.03,0.04,0.2,0.015,0.2,0x2f6fae); B(0.16,0.012,0.1,-0.2,0.006,-0.22,0xb89a6a); }
    else if(p.t==='ind'){ top=0.2; for(let k=0;k<3;k++){ B(0.56,0.045,0.15,0,0.0225,-0.2+k*0.2,0xb9bec4); for(let j=-3;j<=3;j++) F.R(0.07,0.004,0.15,j*0.08,0.052,-0.2+k*0.2,0x8c9aa6,new T.Matrix4().makeRotationZ(0.35)); } C(0.012,0.016,0.2,0.3,0.1,0.28,0xb5553f,10); B(0.018,0.004,0.018,0.3,0.201,0.28,0xe9e6dc); C(0.03,0.03,0.07,-0.3,0.035,0.29,0xd9dde2,12); C(0.03,0.03,0.07,-0.22,0.035,0.29,0xd9dde2,12); }
    else if(p.t==='tech'){ top=0.2; B(0.3,0.09,0.16,-0.16,0.045,-0.18,0x8fb3c9); B(0.31,0.004,0.17,-0.16,0.092,-0.18,0xe9ecef); B(0.16,0.15,0.16,0.2,0.075,-0.14,0x7fa6bf); B(0.165,0.004,0.165,0.2,0.152,-0.14,0xe9ecef); B(0.36,0.06,0.14,0.05,0.03,0.2,0x9cbfd2); B(0.37,0.003,0.15,0.05,0.0615,0.2,0x6ea05a); dome(0.075,-0.2,0.0026,0.14,0xdfe9ef,0.8); for(const x of [-0.05,0.08,0.21]) B(0.05,0.002,0.09,x,0.064,0.2,0x26364a); }
    else if(p.t==='univ'){ top=0.22; for(const [x,z,w,d] of [[0,-0.24,0.56,0.1],[0,0.24,0.56,0.1],[-0.24,0,0.1,0.38],[0.24,0,0.1,0.38]]){ B(w,0.07,d,x,0.035,z,0xb5654a); B(w+0.01,0.012,d+0.01,x,0.076,z,0x5a6068); } B(0.36,0.002,0.36,0,0.0036,0,0x6fa055); B(0.07,0.2,0.07,0,0.1,-0.24,0xb5654a); cone(0.055,0.05,0,0.2,-0.24,0x5a6068); C(0.018,0.018,0.002,0,0.16,-0.204,0xf7f4ea,14,new T.Matrix4().makeRotationX(Math.PI/2)); }
    else if(p.t==='beach'){ top=0.24; B(0.12,0.22,0.3,-0.26,0.11,0,0xf1ece2); for(let y=0.02;y<0.21;y+=0.022) B(0.123,0.006,0.302,-0.26,y,0,0x8fb6cc); B(0.4,0.0025,0.5,0.1,0.004,0,0xe9d9a6); for(let k=0;k<8;k++){ const x=-0.04+(k%4)*0.1, z=-0.12+Math.floor(k/4)*0.2; B(0.002,0.016,0.002,x,0.012,z,0x8a8a86); cone(0.022,0.01,x,0.02,z,[0xd9534f,0x2f6fae,0xe8c020,0x4f9e62][k%4],8); } B(0.08,0.0025,0.16,0.2,0.0052,0.1,0x4aa3c9); }
    else if(p.t==='scenic'){ top=0.36; C(0.014,0.022,0.28,0,0.14,0,0xd9dde2,10); C(0.05,0.03,0.03,0,0.285,0,0x55697a,14); C(0.052,0.052,0.004,0,0.302,0,0xe9ecef,14); B(0.003,0.05,0.003,0,0.33,0,0xc8423a); B(0.22,0.03,0.12,-0.2,0.015,0.2,0xc9b38d); B(0.24,0.006,0.14,-0.2,0.033,0.2,0x6b4a3a); }
    else if(p.t==='theme'){ top=0.3; parts.push({g:new T.TorusGeometry(0.12,0.004,6,28),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(-0.16,0.15,-0.12)),c:0xe9ecef}); for(let k=0;k<12;k++){ const an=k*0.5236; F.R(0.12,0.0015,0.0015,-0.16+Math.cos(an)*0.06,0.15+Math.sin(an)*0.06,-0.12,0xcfd4da,new T.Matrix4().makeRotationZ(an)); B(0.014,0.012,0.012,-0.16+Math.cos(an)*0.12,0.15+Math.sin(an)*0.12-0.008,-0.12,[0xd9534f,0xe8c020,0x2f6fae,0x4f9e62][k%4]); } for(const e of [-1,1]) F.R(0.006,0.17,0.006,-0.16+e*0.04,0.078,-0.12,0x8a9099,new T.Matrix4().makeRotationZ(e*0.25));
      B(0.12,0.08,0.1,0.2,0.04,-0.2,0xe8d6e6); for(const [x,z] of [[0.14,-0.25],[0.26,-0.25],[0.14,-0.15],[0.26,-0.15]]){ C(0.014,0.014,0.13,x,0.065,z,0xf1e6f1,8); cone(0.02,0.04,x,0.13,z,0x7a5aa6,8); } cone(0.07,0.07,0.1,0.0026,0.2,0xd9534f,8); cone(0.05,0.05,-0.12,0.0026,0.24,0xe8c020,8); }
    else if(p.t==='hist'){ top=0.26; B(0.26,0.02,0.26,0,0.01,0,0xb9b3a4); for(let k=0;k<4;k++){ const w=0.2-k*0.035, y=0.02+k*0.05; B(w,0.036,w,0,y+0.018,0,0xa8382e); B(w+0.07,0.006,w+0.07,0,y+0.04,0,0x3f4a57); } cone(0.07,0.05,0,0.22,0,0x3f4a57); B(0.003,0.03,0.003,0,0.275,0,0xd9b84a); B(0.5,0.02,0.02,0,0.01,0.33,0xe9e3d7); B(0.12,0.05,0.03,0,0.025,0.33,0xa8382e); B(0.16,0.006,0.05,0,0.053,0.33,0x3f4a57); }
    else if(p.t==='spa'){ top=0.12; B(0.34,0.06,0.16,-0.1,0.03,-0.2,0xc9a77a); F.R(0.36,0.006,0.11,-0.1,0.078,-0.245,0x6b4a3a,new T.Matrix4().makeRotationX(-0.5)); F.R(0.36,0.006,0.11,-0.1,0.078,-0.155,0x6b4a3a,new T.Matrix4().makeRotationX(0.5)); for(const [x,z,r] of [[0.12,0.1,0.09],[-0.14,0.16,0.06],[0.24,-0.1,0.05]]){ C(r+0.012,r+0.012,0.006,x,0.0056,z,0x9a958a,16); C(r,r,0.0064,x,0.0058,z,0x6fc3d9,16); } }
    else if(p.t==='port'){ top=0.22; const CC2=[0xb5562f,0x2f6f8f,0x9a9d68,0xd9b84a,0x4f6f52,0x8c3a2e]; for(let i=0;i<5;i++) for(let j=0;j<3;j++){ const n=1+(hashInt(hs+i*7+j*13)%3); for(let k=0;k<n;k++) B(0.09,0.02,0.036,-0.24+i*0.11,0.0126+k*0.02,-0.26+j*0.05,CC2[hashInt(hs+i*31+j*17+k)%6]); }
      for(const x of [-0.16,0.16]){ for(const z of [0.1,0.26]) B(0.012,0.16,0.012,x,0.08,z,0xe8b020); B(0.02,0.012,0.3,x,0.163,0.18,0xe8b020); B(0.014,0.012,0.4,x,0.178,0.2,0xd9a010); B(0.03,0.02,0.03,x,0.15,0.3,0x3a3d43); } B(0.5,0.05,0.1,0,0.025,-0.02,0xb9bec4); B(0.51,0.004,0.11,0,0.052,-0.02,0x7f8a96); }
    else if(p.t==='ent'){ top=0.2; B(0.4,0.11,0.3,0,0.055,-0.06,0x3a3350); B(0.42,0.006,0.32,0,0.113,-0.06,0x2a2540); B(0.3,0.06,0.004,0,0.075,0.092,0xe84a7a); B(0.26,0.04,0.005,0,0.075,0.0925,0xf7e9b0); B(0.34,0.004,0.08,0,0.036,0.13,0xe8c020); for(const x of [-0.15,0.15]) B(0.006,0.036,0.006,x,0.018,0.165,0xd9dde2); C(0.07,0.07,0.16,-0.25,0.08,0.2,0x554a7a,14); dome(0.07,-0.25,0.16,0.2,0xe84a7a,0.6); }
    else if(p.t==='fin'){ top=0.62; for(const [x,z,h,c] of [[-0.14,-0.1,0.5,0x5f87a6],[0.14,0.1,0.58,0x4f7896]]){ B(0.16,h,0.16,x,h/2,z,c); for(let y=0.03;y<h-0.01;y+=0.03) B(0.162,0.004,0.162,x,y,z,0xcfe0ea); B(0.12,0.03,0.12,x,h+0.015,z,0x9fc0d4); B(0.004,0.05,0.004,x,h+0.055,z,0xd9dde2); } B(0.5,0.03,0.5,0,0.015,0,0xd9dde2); B(0.2,0.012,0.05,0,0.3,0,0x9fc0d4); }
    else if(p.t==='gov'){ top=0.26; B(0.56,0.014,0.4,0,0.007,0,0xe9e6dc); B(0.5,0.09,0.26,0,0.059,-0.04,0xf1ede2); B(0.52,0.008,0.28,0,0.108,-0.04,0xe1dccf); for(let x=-0.2;x<=0.2001;x+=0.05) C(0.008,0.009,0.08,x,0.054,0.105,0xf7f4ea,10); B(0.46,0.012,0.04,0,0.1,0.105,0xe9e6dc); C(0.08,0.08,0.05,0,0.137,-0.04,0xf1ede2,18); dome(0.075,0,0.162,-0.04,0x7fa69a,1.0); B(0.004,0.04,0.004,0,0.255,-0.04,0xd9b84a); for(const x of [-0.24,0.24]) B(0.003,0.1,0.003,x,0.05,0.24,0xcfd4da); }
    else if(p.t==='arena'){ top=0.16; parts.push({g:new T.CylinderGeometry(0.3,0.26,0.1,28,1,true),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.05,0)).multiply(new T.Matrix4().makeScale(1,1,0.78)),c:0xd9dde2}); parts.push({g:new T.CylinderGeometry(0.2,0.29,0.085,28,1,true),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.0475,0)).multiply(new T.Matrix4().makeScale(1,1,0.78)),c:0x8f98a3}); parts.push({g:new T.TorusGeometry(0.3,0.012,6,28),m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.102,0)).multiply(new T.Matrix4().makeScale(1,1,0.78)).multiply(new T.Matrix4().makeRotationX(Math.PI/2)),c:0xf2f3f5});
      B(0.3,0.002,0.19,0,0.0052,0,0x5b9846); B(0.26,0.0022,0.002,0,0.0054,0,0xffffff); for(const [x,z] of [[-0.3,-0.26],[0.3,-0.26],[0.3,0.26],[-0.3,0.26]]){ B(0.006,0.16,0.006,x,0.08,z,0xb9bec4); B(0.04,0.012,0.02,x,0.164,z,0xf7f4ea); } }
    spots.push({x:px,y:pz,hx:Math.cos(a),hy:Math.sin(a),len:0.8,half:0.4,h:top,g:1,lm:1});
    if(p.done) signs.push({m:F.Fm.clone().multiply(new T.Matrix4().makeTranslation(0,0.03,0.372)),w:0.26,h:0.016,text:nm(projName(p)),c:'#7a4a9a'}); }
  for(const m of texB.meshes(true)) w3dAdd(m);
}
// the intercity train runs up and down the main line
function w3dRailTick(dt){ const P=w3d.railP, Tn=w3d.railT; if(!P||!Tn) return; const T=w3d.T, L=Math.max(1,P.len-Tn.n*Tn.cl-0.4), per=2*L+24; w3d.railU=((w3d.railU||0)+dt*0.9)%per; let u=w3d.railU, dir=1; if(u>L+12){ u=Math.max(0,per-u-12); dir=-1; } else u=Math.min(u,L);
  const M=w3dRailTick.M||(w3dRailTick.M=new T.Matrix4()), Q=w3dRailTick.Q||(w3dRailTick.Q=new T.Quaternion()), V=w3dRailTick.V||(w3dRailTick.V=new T.Vector3()), S1=w3dRailTick.S||(w3dRailTick.S=new T.Vector3(1,1,1)), up=w3dRailTick.U||(w3dRailTick.U=new T.Vector3(0,1,0)), off=dir*W3D_TO;
  for(let c=0;c<Tn.n;c++){ const uc=0.2+u+(c+0.5)*Tn.cl, p=polyAt(P.pts,P.cum,uc), h=polyHead(P.pts,P.cum,uc,0.06); Q.setFromAxisAngle(up,-Math.atan2(h[1],h[0])); { const k=clamp(trainSeg(P.cum,uc),1,P.cum.length-1), f=clamp((uc-P.cum[k-1])/((P.cum[k]-P.cum[k-1])||1),0,1), ly=P.lift?lerp(P.lift[k-1],P.lift[k],f):0; M.compose(V.set(p[0]-h[1]*off,0.0046+ly,p[1]+h[0]*off),Q,S1); } Tn.m.setMatrixAt(c,M); } Tn.m.instanceMatrix.needsUpdate=true; }
// where each stop of a line lies along its 3D path (searched near where it is expected, so stops stay in order)
const W3D_PLAT=0.8;                       // platform length in cells (120 m: a six-car train)
function w3dStopsOn(L){ const P=L._p3, len=P.cum[P.cum.length-1], sc=stopCum(L), tot=sc[sc.length-1]||1, out=[];
  L.stops.forEach((id,k)=>{ const s=stById(id), e=sc[k]/tot*len; let bd=1e9, bu=e; for(let i=1;i<P.pts.length;i++){ if(P.cum[i]<e-2||P.cum[i-1]>e+2) continue; const a=P.pts[i-1], b=P.pts[i], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1e-9, q=clamp(((s.x-a[0])*dx+(s.y-a[1])*dy)/l2,0,1), d=(a[0]+dx*q-s.x)**2+(a[1]+dy*q-s.y)**2; if(d<bd){ bd=d; bu=P.cum[i-1]+q*(P.cum[i]-P.cum[i-1]); } }
    { const sh=w3d.stShift&&w3d.stShift.get(L.id+'|'+id); if(sh) bu=clamp(bu+sh,0,len); } out.push(k&&bu<out[k-1]?out[k-1]:bu); });
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
/* The surroundings follow the train, but nothing the viewer can see may change while they do. So: the next stretch is
   prepared in the background well before its edge comes into view (everything it adds lies in the haze), its pieces
   are shown a couple a frame while the old ones are still there (where the two overlap they are identical, so the
   hand-over cannot be seen), and the city itself is frozen for the length of a ride: growth, new streets and the new
   year only reach the 3D view at a cut, when the camera jumps to another train or passenger anyway. */
function w3dLocal(cx,cy){
  const j=w3d.lj;
  if(j){ // a rebuild is under way: keep at it, unless the viewer has jumped far from where it started
    if(dist(j.c[0],j.c[1],cx,cy)<20){ if(w3dRun(j,4)) w3d.lj=null; return; }
    j.it.return(); w3dClear([j.grp]); w3d.lj=null; }
  const far=!w3d.bc||!w3d.local.length||dist(w3d.bc[0],w3d.bc[1],cx,cy)>20;
  if(!far&&!w3d.bcStale&&dist(w3d.bc[0],w3d.bc[1],cx,cy)<6) return;
  w3d.bc=[cx,cy]; w3d.bcStale=false; const grp=new w3d.T.Group(); grp.visible=false; w3d.S.add(grp);
  w3d.parked=[];
  const nj={it:w3dLocalGen(cx,cy,grp,far),grp,c:[cx,cy]};
  // a cut: the city catches up, and everything is built at once (the view changes anyway)
  if(far){ bldFreeze=false; w3d.cutYear=Math.floor(months/12); w3d.pjSig=null; w3d.cut=true; try{ w3dRun(nj,Infinity); } finally { bldFreeze=true; } }
  else if(!w3dRun(nj,4)) w3d.lj=nj; }
function* w3dLocalGen(cx,cy,grp,far){
  const T=w3d.T, dark=w3dDark(), add=m=>{ if(!m.renderOrder) m.renderOrder=10+grp.children.length; grp.add(m); return m; }; w3dTextures();
  if(!w3d.tF) w3dTerrain(); yield* w3dLocalGround(cx,cy,add); yield;
  // viaducts run over streets: keep buildings off the track corridor
  const near=new Set(); for(const L of lines){ if(L.stops.length<2||!L._p3) continue; const pts=L._p3.pts, Yv=L._p3.Y; for(let i=1;i<pts.length;i++){ if(Yv&&Yv[i]<-0.06&&Yv[i-1]<-0.06) continue; const a=pts[i-1], b=pts[i], n=Math.ceil(dist(a[0],a[1],b[0],b[1])*8); for(let k=0;k<=n;k++){ const x=lerp(a[0],b[0],k/n), y=lerp(a[1],b[1],k/n); if(Math.abs(x-cx)>34||Math.abs(y-cy)>34) continue; near.add(Math.floor(x*8)*100000+Math.floor(y*8)); } } }
  // stations are wider than the viaduct: keep their footprint clear too
  for(const z of (w3d.stSpots||[])){ if(Math.abs(z.x-cx)>34||Math.abs(z.y-cy)>34) continue; const nx=-z.hy, ny=z.hx;
    for(let a=-z.len/2;a<=z.len/2;a+=0.06) for(let c=-z.half;c<=z.half;c+=0.06){ const x=z.x+z.hx*a+nx*c, y=z.y+z.hy*a+ny*c; near.add(Math.floor(x*8)*100000+Math.floor(y*8)); } }
  yield;
  const hit=b=>{ const m=b.a?0.04+Math.abs(b.w-b.d)*0.5:0.04; for(let yy=Math.floor((b.y-m)*8);yy<=Math.floor((b.y+b.d+m)*8);yy++) for(let xx=Math.floor((b.x-m)*8);xx<=Math.floor((b.x+b.w+m)*8);xx++) if(near.has(xx*100000+yy)) return true; return false; };
  // Buildings are drawn in full only as far as the haze lets them be seen, and only those close enough to throw a shadow the viewer could
  // see are given to the shadow pass (it draws every instance of a mesh it is given, in view or not): near ones with roof details in one
  // set, the rest plainer in another.
  const R=26, RN=11, house=[], spires=[], ind=[], bx=w3dBoxes(), bxM=w3dBoxes();
  const HR=6, HN=2*(R+2)*HR, hg={x0:cx-R-2,y0:cy-R-2,res:HR,n:HN,a:new Float32Array(HN*HN)};
  const keys=new Set(), prevK=w3d.bKeys, prevC=w3d.bKC, hgrow=[]; let nBorn=0;
  bldInRect(cx-R,cy-R,cx+R,cy+R,b=>{ if(dist(b.x,b.y,cx,cy)>R||hit(b)) return;
    const bk=Math.round(b.x*40)*200003+Math.round(b.y*40), isNew=!!prevK&&!prevK.has(bk)&&dist(b.x,b.y,prevC[0],prevC[1])<R-2; keys.add(bk); if(isNew) nBorn++; const nearB=dist(b.x,b.y,cx,cy)<=RN, B_=nearB?bx:bxM; B_.setBorn(isNew); const h0=house.length;
    { const q=bldCorners(b), hv=b.h*BZ3+w3dHt(b.x+b.w/2,b.y+b.d/2), i0=Math.max(0,Math.floor((Math.min(q[0],q[2],q[4],q[6])-hg.x0)*HR)), i1=Math.min(HN-1,Math.floor((Math.max(q[0],q[2],q[4],q[6])-hg.x0)*HR)), j0=Math.max(0,Math.floor((Math.min(q[1],q[3],q[5],q[7])-hg.y0)*HR)), j1=Math.min(HN-1,Math.floor((Math.max(q[1],q[3],q[5],q[7])-hg.y0)*HR));
      for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) if(hg.a[j*HN+i]<hv) hg.a[j*HN+i]=hv; } const i=Math.round(b.y)*W+Math.round(b.x), d=G.D[i]||0, hm=b.h*150, hh=hashInt(i*13+Math.round(b.x*97)+Math.round(b.y*61));
    if(b.sp==='church'){ house.push({x:b.x,y:b.y,w:b.w,d:b.d,h:b.h*1.25,r:(hh&~0xf0)|0x20,a:b.a||0,px:b.x+b.w/2,pz:b.y+b.d/2,wall:0xe9e3d7}); spires.push(b); return; }
    if(b.sp==='mall'){ B_.mall(b,hh); return; } if(b.sp==='school'){ B_.building(b,d,hh,nearB,'brick'); return; }
    if(b.sp==='library'){ house.push({x:b.x,y:b.y,w:b.w,d:b.d,h:b.h*1.3,r:(hh&~0xf0)|0x40,a:b.a||0,px:b.x+b.w/2,pz:b.y+b.d/2,wall:0xe6dfd0}); return; }
    if(b.sp==='gym'){ B_.building(b,d,hh,nearB,'shed'); return; } if(b.sp==='gov'||b.sp==='hospital'){ B_.building(b,d,hh,nearB,'plaster'); return; }
    if(ind.some(p=>dist(p.x,p.y,b.x,b.y)<6)&&hm<30){ B_.shed(b,hh); return; }
    if(hm<14&&d<0.5){ const nx=Math.max(1,Math.round(b.w/0.1)), ny=Math.max(1,Math.round(b.d/0.09)), sx=b.w/nx, sy=b.d/ny;   // a plot of detached houses
      for(let a=0;a<nx;a++) for(let c=0;c<ny;c++){ const r=hashInt(hh+a*31+c*7), one=nx*ny===1; house.push({born:isNew,x:b.x+a*sx+(one?0:sx*0.12),y:b.y+c*sy+(one?0:sy*0.12),w:one?sx:sx*(0.62+(r&15)/80),d:one?sy:sy*(0.6+((r>>4)&15)/80),h:b.h*(0.8+((r>>8)&15)/40),r,a:b.a||0,px:b.x+b.w/2,pz:b.y+b.d/2}); } return; }
    B_.building(b,d,hh,nearB); });
  { const put=(x,z,hv)=>{ const i=Math.floor((x-hg.x0)*HR), j=Math.floor((z-hg.y0)*HR); if(i>=0&&j>=0&&i<HN&&j<HN&&hg.a[j*HN+i]<hv) hg.a[j*HN+i]=hv; };
    for(const q of (w3d.stSpots||[])){ if(!q.h||Math.abs(q.x-cx)>R+8||Math.abs(q.y-cy)>R+8) continue; const nx=-q.hy, ny=q.hx; for(let a=-q.len/2;a<=q.len/2;a+=0.1) for(let c=-q.half;c<=q.half;c+=0.1) put(q.x+q.hx*a+nx*c,q.y+q.hy*a+ny*c,q.h); }
    for(const L of lines){ const P=L._p3; if(L.stops.length<2||!P) continue; for(let i=0;i<P.pts.length;i++){ const y=P.Y[i]; if(y<0.004) continue; const p=P.pts[i]; if(Math.abs(p[0]-cx)>R||Math.abs(p[1]-cy)>R) continue; for(const [ax,az] of [[0,0],[0.1,0],[-0.1,0],[0,0.1],[0,-0.1]]) put(p[0]+ax,p[1]+az,y+0.05); } } }
  yield;
  // houses: plastered or sided walls under pitched roofs in tile, slate or sheet metal, the ridge along the longer side
  for(const [house_,cast] of [[house.filter(o=>dist(o.x,o.y,cx,cy)<=RN),true],[house.filter(o=>dist(o.x,o.y,cx,cy)>RN),false]]) if(house_.length){ const house=house_; for(const o of house) if(o.gy==null) o.gy=w3dUnder(o); const  M=new T.Matrix4(), R=new T.Matrix4(), Pv=new T.Matrix4(), col=new T.Color(), mats=w3dMats(), hg0=w3dUnit(), hrep=new Float32Array(house.length*3), hw=new T.InstancedMesh(hg0,[mats.house,mats.house,mats.roof,mats.roof,mats.house,mats.house],house.length), turn=o=>{ if(o.a){ R.makeRotationY(-o.a); Pv.makeTranslation(o.px,0,o.pz); M.premultiply(Pv.clone().invert()).premultiply(R).premultiply(Pv); } };
    house.forEach((o,i)=>{ hrep[i*3]=Math.max(1,Math.round(o.w*150/4.2)); hrep[i*3+1]=Math.max(1,Math.round(o.h*150*0.7/2.9)); hrep[i*3+2]=Math.max(1,Math.round(o.d*150/4.2)); });
    hg0.setAttribute('aRep',new T.InstancedBufferAttribute(hrep,3));
    house.forEach((o,i)=>{ M.makeScale(o.w,o.h*BZ3*0.7,o.d).setPosition(o.x,o.gy,o.y); turn(o); hw.setMatrixAt(i,M); if(o.born) hgrow.push(f=>{ M.makeScale(o.w,Math.max(o.h*BZ3*0.7*f,1e-4),o.d).setPosition(o.x,o.gy,o.y); turn(o); hw.setMatrixAt(i,M); hw.instanceMatrix.needsUpdate=true; }); col.set(o.wall||W3D_HOUSE[o.r%W3D_HOUSE.length]); hw.setColorAt(i,col); }); hw.castShadow=cast; hw.receiveShadow=true; add(hw);
    for(const ax of [0,1]){ const L=house.filter(o=>(o.w>=o.d)===(ax===0)); if(!L.length) continue; const rm=new T.InstancedMesh(w3dRoofGeo(ax),mats.houseRoof,L.length);
      L.forEach((o,i)=>{ const ex=0.012; M.makeScale(o.w+ex,o.h*BZ3*(0.4+((o.r>>14)&7)/40),o.d+ex).setPosition(o.x-ex/2,o.gy+o.h*BZ3*0.7,o.y-ex/2); turn(o); rm.setMatrixAt(i,M); if(o.born) hgrow.push(f=>{ M.makeScale(o.w+ex,Math.max(o.h*BZ3*(0.4+((o.r>>14)&7)/40)*smooth(f,0.7,1),1e-4),o.d+ex).setPosition(o.x-ex/2,o.gy+o.h*BZ3*0.7*f,o.y-ex/2); turn(o); rm.setMatrixAt(i,M); rm.instanceMatrix.needsUpdate=true; }); col.set(W3D_ROOF[(o.r>>4)%W3D_ROOF.length]); rm.setColorAt(i,col); });
      rm.castShadow=cast; rm.receiveShadow=true; add(rm); } }
  yield;
  // blocks and towers, grouped by facade so each kind is one draw call
  for(const m of bx.meshes(true)){ add(m); yield; } for(const m of bxM.meshes(false)){ m.receiveShadow=true; add(m); yield; }
  // trees: in parks and woods, and lining residential streets
  const M=new T.Matrix4(), col=new T.Color(), trees=[]; const r2=27;
  for(let y=Math.floor(cy-r2);y<=cy+r2;y++) for(let x=Math.floor(cx-r2);x<=cx+r2;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]||(G.air&&G.air[i])) continue; const pk=G.pk[i], d=G.D[i];
    const wood=pk>0.27, n=wood?17:pk>0.255?6:(pk>0.12&&d<0.05)?7:d>0.06&&d<0.3?1:0;   /* woods and the edges of parks thick with trees; the odd garden tree among the houses; the rest of the town's trees are planted (streets, parks) */ for(let k=0;k<n;k++){ const h=hashInt(i*59+k*7919), tx=x-0.5+(h&1023)/1023, ty=y-0.5+((h>>10)&1023)/1023; if(dist(tx,ty,cx,cy)>r2||near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) continue; trees.push([tx,ty,(0.7+((h>>20)&255)/255*0.7)*(wood?1.45:1),h]); } }
  for(let y=Math.floor(cy-r2);y<=cy+r2;y++) for(let x=Math.floor(cx-r2);x<=cx+r2;x++){ const hf=w3dFieldAt(x,y); if(hf<0) continue; const eE=w3dFieldAt(x+1,y)>>3!==hf>>3, eS=w3dFieldAt(x,y+1)>>3!==hf>>3;
    for(let k=0;k<5;k++){ const q=hashInt(hf+k*131+x*17+y); if((q&3)>1) continue; const tt=((q>>4)&255)/255-0.5; let tx,ty; if(eE&&(k&1)){ tx=x+0.5; ty=y+tt; } else if(eS){ tx=x+tt; ty=y+0.5; } else continue; if(dist(tx,ty,cx,cy)<r2&&!near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) trees.push([tx,ty,0.8+((q>>12)&63)/90,q]); } }
  const Rn=G.rn; if(Rn) for(let gy=Math.floor((cy-14)/RN_G);gy<=Math.floor((cy+14)/RN_G);gy++) for(let gx=Math.floor((cx-14)/RN_G);gx<=Math.floor((cx+14)/RN_G);gx++){ const a=Rn.eg.get(rnKey(gx,gy)); if(!a) continue;
    for(const e of a){ if(Rn.ec[e]<1||Rn.ec[e]>3||trees.length>14000) continue; const p=Rn.ea[e], q=Rn.eb[e], L=dist(Rn.x[p],Rn.y[p],Rn.x[q],Rn.y[q]); const dx=(Rn.x[q]-Rn.x[p])/(L||1), dy=(Rn.y[q]-Rn.y[p])/(L||1), off=[0,0.06,0.075,0.09][Rn.ec[e]];
      for(let s=0.05;s<L-0.03;s+=0.09) for(const sd of [1,-1]){      /* an avenue: evenly spaced, both sides, one kind of tree to a street */ const tx=Rn.x[p]+dx*s-dy*off*sd, ty=Rn.y[p]+dy*s+dx*off*sd, ci=Math.round(ty)*W+Math.round(tx); const dd=G.D[ci]||0; if(dd<0.06||dd>1.3||G.water[ci]) continue;
        if(near.has(Math.floor(tx*8)*100000+Math.floor(ty*8))) continue; const h=(hashInt(Math.round(Rn.x[p]*7)+Math.round(Rn.y[p]*13)*977)&~7)|(Math.round(s*11)&3); trees.push([tx,ty,0.62+(Rn.ec[e]>=2?0.14:0),h,hashInt(Math.round(Rn.x[p]+Rn.y[p]*31)>>2)%3===0?2:0]); } } }
  yield;
  // streets as real surfaces near the viewer, the grounds and furniture of parks, squares and the rest, parked cars
  { const rm=w3dRoadMesh(cx,cy,27); if(rm) for(const q of rm) add(q); } yield;
  { const fp=w3dFeatures(cx,cy,28,(x,y,sc,h)=>{ if(!near.has(Math.floor(x*8)*100000+Math.floor(y*8))) trees.push([x,y,sc,h]); },spires); for(const m of fp) add(m); } yield;
  w3dBoats(cx,cy,add); yield;
  { const cm=w3dCountry(cx,cy,(x,y,sc,h)=>{ if(!near.has(Math.floor(x*8)*100000+Math.floor(y*8))) trees.push([x,y,sc,h]); }); if(cm) add(cm); } yield;
  // nothing grows in the roadway, through a building or on the railway
  { const keepT=[], hq=(x,z)=>{ const i=Math.floor((x-hg.x0)*hg.res), j=Math.floor((z-hg.y0)*hg.res); return i<0||j<0||i>=hg.n||j>=hg.n?0:hg.a[j*hg.n+i]; }, rl=G.rail; let c=0;
    for(const t of trees){ if(++c%2500===0) yield; if(hq(t[0],t[1])>0||hq(t[0]+0.03,t[1])>0||hq(t[0],t[1]+0.03)>0||w3dOnRoad(t[0],t[1],0.012)||waterSD(t[0],t[1])<0.09) continue; let bad=false; for(let i=0;i<rl.length;i+=2) if(Math.abs(rl[i][0]-t[0])<0.9&&Math.abs(rl[i][1]-t[1])<0.9&&dist(rl[i][0],rl[i][1],t[0],t[1])<0.16){ bad=true; break; } if(!bad) keepT.push(t); }
    trees.length=0; for(const t of keepT) trees.push(t); }
  if(trees.length){ const greens=dark?[0x2e4a2c,0x34522f,0x2a4230]:[0x5f8f45,0x6e9a4c,0x4f7f3f,0x7aa356,0x587f3a], V=new T.Vector3(), Q=new T.Quaternion(), Sc=new T.Vector3(), up=new T.Vector3(0,1,0);
    // three kinds of tree: a broad crown in two masses, a conifer in two tiers, a tall narrow one; the number a tree carries picks its kind and its green
    // Trees are most of what there is to draw in a town, so they are modelled twice: near the viewer with a trunk and a crown in
    // several masses, further off as one or two plain solids of the same outline (a fifth of the triangles; at that distance it shows no difference).
    const TR=new T.Matrix4(), geo=(kind,det)=>{ const tr={g:new T.CylinderGeometry(0.0011,0.0017,0.012,5,1,true),m:new T.Matrix4().makeTranslation(0,0.006,0),c:0x6b5440};
        if(kind===1) return w3dMerge(det?[tr,{g:new T.ConeGeometry(0.0068,0.017,7,1,true),m:new T.Matrix4().makeTranslation(0,0.0165,0),c:0xffffff},{g:new T.ConeGeometry(0.0048,0.014,7,1,true),m:new T.Matrix4().makeTranslation(0,0.027,0),c:0xf0f0f0}]
                                    :[{g:new T.ConeGeometry(0.0066,0.03,5,1,true),m:new T.Matrix4().makeTranslation(0,0.019,0),c:0xf6f6f6}]);
        if(kind===2) return w3dMerge(det?[tr,{g:new T.IcosahedronGeometry(0.006,1),m:new T.Matrix4().makeTranslation(0,0.021,0).multiply(TR.makeScale(0.8,1.9,0.8)),c:0xffffff}]
                                    :[{g:new T.IcosahedronGeometry(0.006,0),m:new T.Matrix4().makeTranslation(0,0.019,0).multiply(TR.makeScale(0.8,2.1,0.8)),c:0xffffff}]);
        return w3dMerge(det?[tr,{g:new T.IcosahedronGeometry(0.0082,1),m:new T.Matrix4().makeTranslation(0,0.0165,0).multiply(TR.makeScale(1,0.82,1)),c:0xffffff},{g:new T.IcosahedronGeometry(0.0058,0),m:new T.Matrix4().makeTranslation(0.0032,0.0225,0.0018),c:0xe9e9e9},{g:new T.IcosahedronGeometry(0.005,0),m:new T.Matrix4().makeTranslation(-0.0036,0.0195,-0.002),c:0xdcdcdc}]
                       :[{g:new T.IcosahedronGeometry(0.0088,0),m:new T.Matrix4().makeTranslation(0,0.0165,0).multiply(TR.makeScale(1,1.05,1)),c:0xf4f4f4}]); };
    const kindOf=p=>{ if(p[4]!=null) return p[4]; const k=(p[3]>>>3)%10; return k<7?0:k<9?1:2; }, GR=[greens,dark?[0x24402a,0x2a4630]:[0x3f6f45,0x4a7a4c,0x356338],dark?[0x2e4a2c]:[0x6a9a4a,0x7aa356]];
    const mk=(list,det,shadow)=>{ for(let kind=0;kind<3;kind++){ const L=list.filter(p=>kindOf(p)===kind); if(!L.length) continue;
        const tm=new T.InstancedMesh(geo(kind,det),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.95,flatShading:true})),L.length), gp=GR[kind];
        L.forEach((p,i)=>{ Q.setFromAxisAngle(up,(p[3]&255)/40); Sc.set(p[2]*1.5,p[2]*1.5*(0.9+((p[3]>>8)&63)/150),p[2]*1.5); M.compose(V.set(p[0],w3dHt(p[0],p[1]),p[1]),Q,Sc); tm.setMatrixAt(i,M); col.set(gp[(p[3]>>>11)%gp.length]); tm.setColorAt(i,col); });
        tm.castShadow=shadow; tm.receiveShadow=true; add(tm); } };
    mk(trees.filter(p=>dist(p[0],p[1],cx,cy)<=6),1,true); yield; mk(trees.filter(p=>{ const d=dist(p[0],p[1],cx,cy); return d>6&&(d<17||(p[3]&3)!==0); }),0,false); }      /* in the haze a quarter of them are left out */
  yield;
  // the skyline further out: the same facades, without shadows, softened by the haze
  { const fb=w3dBoxes(); bldInRect(cx-56,cy-56,cx+56,cy+56,b=>{ const dd=dist(b.x,b.y,cx,cy); if(dd>R&&dd<56&&b.h>0.13){ const i=Math.round(b.y)*W+Math.round(b.x); fb.block(b,hashInt(i*13+Math.round(b.x*97)+Math.round(b.y*61))); } });
    for(const m of fb.meshes(false)){ add(m); yield; } }
  // traffic on the streets near the line
  yield; const cars=far||!w3d.cars?w3dCars(cx,cy,m=>w3d.S.add(m)):w3d.cars;      /* the traffic carries on across rebuilds */
  // what was not here at the last look goes up over a quarter of a minute rather than appearing between two frames
  const G2=nBorn>0&&nBorn<700?{t:0,bx:{growTo:f=>{ bx.growTo(f); bxM.growTo(f); }},hgrow}:null; if(G2){ G2.bx.growTo(0); hgrow.forEach(f=>f(0)); }
  return ()=>{ const old=w3d.local.slice(), drop=l=>{ for(const g of l) w3dTrash([...g.children,g]); }; if(w3d.reveal){ old.push(...w3d.reveal.old); w3d.reveal=null; }
    grp.visible=true; w3d.local=[grp]; if(far||!old.length) drop(old); else { const kids=grp.children.slice(); kids.forEach(k=>{ k.visible=false; }); w3d.reveal={kids,old,drop}; }
    if(cars!==w3d.cars){ if(w3d.cars) w3dTrash([w3d.cars.m]); w3d.cars=cars; } w3d.hg=hg; w3d.bKeys=keys; w3d.bKC=[cx,cy]; w3d.grow=G2; }; }
// Streets near the viewer as geometry rather than paint: pavements, a roadway inside them, junctions rounded off,
// centre and lane lines, zebra crossings on the bigger roads. Drawn straight over the ground in three passes
// (pavement, roadway, paint), so every edge is sharp at any distance and angle.
// a street's height at one of its junctions: on the ground, or up on the bridge deck where the junction is over water
const W3D_BR=0.03;      // a road bridge's deck above street level
// which junctions are flyovers (an expressway over lesser streets) and which expressway pieces climb over them
function w3dFlySet(es){ const Rn=G.rn, flyN=new Set(), flyI=new Map(), seenN=new Set();
  for(const e of es) for(const n of [Rn.ea[e],Rn.eb[e]]){ if(seenN.has(n)) continue; seenN.add(n); const ad=Rn.adj[n]; if(ad.length<3) continue; let hw=0, lo=0; for(const f of ad){ if(Rn.ec[f]>=4) hw++; else lo++; } if(hw>=1&&hw<=2&&lo>=1&&waterSD(Rn.x[n],Rn.y[n])>0.5&&!keepAt(Rn.x[n],Rn.y[n],0.3)) flyN.add(n); }
  for(const e of es){ if(Rn.ec[e]<4) continue; const ends=[]; if(flyN.has(Rn.ea[e])) ends.push(0); if(flyN.has(Rn.eb[e])) ends.push(1); if(ends.length) flyI.set(e,ends); }
  return {flyN,flyI}; }
function w3dRoadMesh(cx,cy,R){
  const T=w3d.T, Rn=G.rn; if(!Rn) return null; const Ls=[[],[],[]], Cs=[[],[],[]], col=new T.Color(), Y=0.0007;
  // a strip of road: cut into half-cell lengths, each end set on the ground under it, so a street follows a slope instead of spanning it
  const quad=(L,ax0,az0,bx0,bz0,hw,c,lat,ya,yb,fn)=>{ let dx=bx0-ax0, dz=bz0-az0; const l=Math.hypot(dx,dz); if(l<1e-5) return; dx/=l; dz/=l; const nx=-dz, nz=dx, o=lat||0, n=Math.max(1,Math.ceil(l/(fn?0.12:0.5))); col.set(c);
    for(let q=0;q<n;q++){ const t0=q/n, t1=(q+1)/n, cax=ax0+(bx0-ax0)*t0, caz=az0+(bz0-az0)*t0, cbx=ax0+(bx0-ax0)*t1, cbz=az0+(bz0-az0)*t1, Ya=Y+(fn?fn(t0):lerp(ya||0,yb||0,t0))+w3dHt(cax,caz), Yb=Y+(fn?fn(t1):lerp(ya||0,yb||0,t1))+w3dHt(cbx,cbz), ax=cax+nx*o, az=caz+nz*o, bx=cbx+nx*o, bz=cbz+nz*o;
      Ls[L].push(ax+nx*hw,Ya,az+nz*hw, bx+nx*hw,Yb,bz+nz*hw, bx-nx*hw,Yb,bz-nz*hw, ax+nx*hw,Ya,az+nz*hw, bx-nx*hw,Yb,bz-nz*hw, ax-nx*hw,Ya,az-nz*hw); for(let k=0;k<6;k++) Cs[L].push(col.r,col.g,col.b); } };
  const disc=(L,x,z,r,c,yn)=>{ const Yn=Y+(yn||0)+w3dHt(x,z); col.set(c); for(let k=0;k<8;k++){ const a0=k*Math.PI/4, a1=(k+1)*Math.PI/4; Ls[L].push(x,Yn,z, x+Math.cos(a1)*r,Yn,z+Math.sin(a1)*r, x+Math.cos(a0)*r,Yn,z+Math.sin(a0)*r); for(let q=0;q<3;q++) Cs[L].push(col.r,col.g,col.b); } };
  const es=[], seen=new Set(), nodes=new Map(); for(let gy=Math.floor((cy-R)/RN_G);gy<=Math.floor((cy+R)/RN_G);gy++) for(let gx=Math.floor((cx-R)/RN_G);gx<=Math.floor((cx+R)/RN_G);gx++){ const l=Rn.eg.get(rnKey(gx,gy)); if(l) for(const e of l) if(!seen.has(e)){ seen.add(e); es.push(e); } }
  if(!es.length) return null; const PAVE=0xcbc8c0, ASPH=[0x5d6066,0x55585e,0x4f5258,0x4a4d53,0x45484e], hwP=c=>ROAD_W[c]/2, hwA=c=>c===4?ROAD_W[c]/2-0.004:ROAD_W[c]/2-0.014;
  for(const e of es){ const c=Rn.ec[e]; for(const n of [Rn.ea[e],Rn.eb[e]]){ const o=nodes.get(n); if(!o) nodes.set(n,{p:hwP(c),a:hwA(c),c,y:0}); else { o.p=Math.max(o.p,hwP(c)); o.a=Math.max(o.a,hwA(c)); o.c=Math.max(o.c,c); } } }
  /* Bridges. A street that crosses water (whether or not one of its junctions stands in it) rises to a deck clear of the
     water, on a ramp either side, with piers standing in the bed. The rise is worked out along each street: the stretch
     over the water is at full height, and it falls away over RAMP cells beyond; junctions pass the height on to the
     streets that meet there, so a ramp can run on into the next street. */
  const lamps=[], br=[], BRC=0xbdb9b1, RAMP=0.95, wetI=new Map(), geo=e=>{ const a=Rn.ea[e], b=Rn.eb[e]; return [Rn.x[a],Rn.y[a],Rn.x[b],Rn.y[b],Math.hypot(Rn.x[b]-Rn.x[a],Rn.y[b]-Rn.y[a])]; };
  for(const e of es){ const [ax,az,bx,bz,l]=geo(e); if(l<1e-4) continue; let s0=-1, s1=-1; const n=Math.max(2,Math.ceil(l/0.08)); for(let k=0;k<=n;k++){ const t=k/n; if(waterSD(ax+(bx-ax)*t,az+(bz-az)*t)<0.03){ if(s0<0) s0=t*l; s1=t*l; } } if(s0>=0) wetI.set(e,[s0,s1]); }
  /* Flyovers. Where an expressway meets lesser streets at a junction, it does not stop at lights: it is carried over on a
     deck, coming down again on a ramp either side, and the streets below cross under it at ground level. */
  const {flyN,flyI}=w3dFlySet(es), FLY=0.036, FR=0.95;
  const own=(e,sd)=>{ let v=0; const w=wetI.get(e); if(w){ const d=sd<w[0]?w[0]-sd:sd>w[1]?sd-w[1]:0; v=W3D_BR*(1-smooth(d,0,RAMP)); } const f=flyI.get(e); if(f){ const l=geo(e)[4]; for(const k of f){ const d=Math.abs(sd-k*l); v=Math.max(v,FLY*(1-smooth(d,0.14,0.14+FR))); } } return v; };
  for(const [n,o] of nodes) o.y=0; for(const e of es){ if(!wetI.has(e)) continue; const l=geo(e)[4], na=nodes.get(Rn.ea[e]), nb=nodes.get(Rn.eb[e]); if(!flyN.has(Rn.ea[e])) na.y=Math.max(na.y,own(e,0)); if(!flyN.has(Rn.eb[e])) nb.y=Math.max(nb.y,own(e,l)); }
  // at a flyover junction the ground disc is the size of the streets below, not of the expressway passing over it
  for(const n of flyN){ const o=nodes.get(n); let p=0, q=0, c=0; for(const f of Rn.adj[n]) if(Rn.ec[f]<4){ p=Math.max(p,hwP(Rn.ec[f])); q=Math.max(q,hwA(Rn.ec[f])); c=Math.max(c,Rn.ec[f]); } o.p=p; o.a=q; o.c=c; }
  const lifts=w3d.rLift=new Map(), pierL=w3d.pierPts2=[];
  w3d.flyN=flyN;
  for(const e of es){ const c=Rn.ec[e], a=Rn.ea[e], b=Rn.eb[e], [ax,az,bx,bz,l]=geo(e); if(l<1e-4) continue; const dx=(bx-ax)/l, dz=(bz-az)/l, ya=nodes.get(a).y, yb=nodes.get(b).y, lf=sd=>Math.max(own(e,sd),ya+(yb-ya)*sd/l), fn=t=>lf(t*l), up=ya>0||yb>0||wetI.has(e)||flyI.has(e); if(up) lifts.set(e,lf);
    if(c<4) quad(0,ax,az,bx,bz,hwP(c),PAVE,0,0,0,up&&fn); else quad(0,ax,az,bx,bz,hwP(c),0x8d9096,0,0,0,up&&fn); quad(1,ax,az,bx,bz,hwA(c),ASPH[c],0,0,0,up&&fn);
    if(up){ const w=hwP(c), P2=[], n=Math.max(1,Math.ceil(l/0.2)); for(let k=0;k<=n;k++){ const sd=l*k/n, x=ax+dx*sd, z=az+dz*sd, y=lf(sd); P2.push([x,z,TRK+y+w3dHt(x,z)]); }
      br.push({g:w3dRibbon(P2,w+0.004,-0.0004,0.006),c:BRC}); for(const sd of [1,-1]) br.push({g:w3dRibbon(offsetPts(P2,sd*(w+0.0025)).map((q,i)=>[q[0],q[1],P2[i][2]]),0.0014,0.0075,0.008),c:0xcfcbc3});
      // piers in the water, abutments where the deck leaves the bank
      for(let sd=0.2;sd<l;sd+=0.42){ const x=ax+dx*sd, z=az+dz*sd, y=lf(sd), wsd=waterSD(x,z); if(y<0.012||(wsd>0.05&&y<W3D_BR*0.6)) continue; { let blocked=false; for(const o of [-w*0.7,0,w*0.7]){ const h=rnNearEdge(Rn,x-dz*o,z+dx*o,0.3); if(h&&h.e!==e&&h.d<ROAD_W[Rn.ec[h.e]]/2+0.01&&!wetI.has(h.e)){ blocked=true; break; } } if(blocked) continue; } pierL.push([x,z,0]); const bot=wsd<0?W3D_BED:0, q=w3dBox(0.014,y-bot,w*1.5,0,(y+bot)/2-0.004,0,0xaeaaa2); q.m=new T.Matrix4().makeTranslation(x,0,z).multiply(new T.Matrix4().makeRotationY(-Math.atan2(dz,dx))).multiply(q.m); br.push(q); } }
    if(c>=2&&!up&&Math.hypot(ax-cx,az-cy)<R*0.7) for(let sd=0.15;sd<l-0.1;sd+=0.32){ const x=ax+dx*sd, z=az+dz*sd, o=hwP(c)-0.004, k=Math.round(sd/0.32)&1?1:-1; lamps.push([x-dz*o*k,z+dx*o*k,Math.atan2(dz,dx)+(k>0?Math.PI/2:-Math.PI/2)]); }
    if(c<1) continue; const da=flyN.has(a)&&c>=4?2:Rn.adj[a].length, db=flyN.has(b)&&c>=4?2:Rn.adj[b].length, zeb=c>=2&&c<4, ta=da>=3?nodes.get(a).a+(zeb?0.026:0.006):0, tb=db>=3?nodes.get(b).a+(zeb?0.026:0.006):0; if(l-ta-tb<0.03) continue;
    const seg=(s0,s1,hw,cc,lat)=>quad(2,ax+dx*s0,az+dz*s0,ax+dx*s1,az+dz*s1,hw,cc,lat,0,0,up&&(t=>lf(s0+(s1-s0)*t))), dash=(lat,cc)=>{ for(let q=ta;q<l-tb-0.02;q+=0.07) seg(q,Math.min(q+0.03,l-tb),0.0011,cc,lat); };
    if(c===1) seg(ta,l-tb,0.0009,0xbfc1c4,0); else if(c===2) dash(0,0xe6e6e6); else { seg(ta,l-tb,0.001,0xe3c04a,0.0018); seg(ta,l-tb,0.001,0xe3c04a,-0.0018); dash(hwA(c)*0.5,0xe6e6e6); dash(-hwA(c)*0.5,0xe6e6e6); if(c===4){ seg(ta,l-tb,0.001,0xe6e6e6,hwA(c)-0.004); seg(ta,l-tb,0.001,0xe6e6e6,-hwA(c)+0.004); } }
    if(zeb) for(const [dg,s0] of [[da,nodes.get(a).a+0.004],[db,l-nodes.get(b).a-0.02]]){ if(dg<3) continue; for(let o=-hwA(c)+0.005;o<hwA(c)-0.003;o+=0.008) seg(s0,s0+0.016,0.002,0xe9e9e9,o); } }
  for(const [n,o] of nodes){ const x=Rn.x[n], z=Rn.y[n], head=Rn.adj[n].length===1&&o.c<=2&&waterSD(x,z)>0.3?1.75:1;      /* a cul-de-sac ends in a turning head */
    if(o.c<4) disc(0,x,z,o.p*head,PAVE,o.y); disc(1,x,z,o.a*head,ASPH[o.c],o.y); }
  const pos=[].concat(Ls[0],Ls[1],Ls[2]), cl=[].concat(Cs[0],Cs[1],Cs[2]), nor=new Float32Array(pos.length); for(let i=1;i<nor.length;i+=3) nor[i]=1;
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new T.Float32BufferAttribute(nor,3)); g.setAttribute('color',new T.Float32BufferAttribute(cl,3));
  const m=new T.Mesh(g,w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.93,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,...w3dCut()}))); m.renderOrder=-3; m.receiveShadow=true;
  const out=[m]; if(br.length){ const bm=new T.Mesh(w3dMerge(br),new T.MeshStandardMaterial({vertexColors:true,roughness:0.9})); bm.renderOrder=-3.5; bm.castShadow=true; bm.receiveShadow=true; out.unshift(bm); }
  if(lamps.length){ const pg=w3dMerge([w3dBox(0.0012,0.032,0.0012,0,0.016,0,0x5a6068),w3dBox(0.012,0.0012,0.0012,0.006,0.0315,0,0x5a6068)]), hg=new T.BoxGeometry(0.006,0.0016,0.003); hg.translate(0.011,0.0305,0);
    const pm=new T.InstancedMesh(pg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.6}),lamps.length), lm=w3d.lampM||(w3d.lampM=new T.MeshStandardMaterial({color:0xfff2d0,emissive:0xffd59a,emissiveIntensity:0})), hm=new T.InstancedMesh(hg,lm,lamps.length), M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1);
    lm.userData.keep=true; lamps.forEach((q,i)=>{ Q.setFromAxisAngle(up,-q[2]); M.compose(V.set(q[0],w3dHt(q[0],q[1]),q[1]),Q,one); pm.setMatrixAt(i,M); hm.setMatrixAt(i,M); }); pm.castShadow=true; out.push(pm,hm); }
  return out; }
const w3dCarGeo=()=>w3dMerge([w3dBox(0.028,0.0052,0.012,0,0.0046,0,0xffffff),w3dBox(0.0155,0.004,0.0108,-0.0018,0.0092,0,0x26303a),w3dBox(0.014,0.0009,0.01,-0.0018,0.0116,0,0xffffff),w3dBox(0.0012,0.0016,0.0102,0.0138,0.0052,0,0xfff3c4),w3dBox(0.0012,0.0016,0.0102,-0.0138,0.0052,0,0xb3261e),...[-0.0088,0.0088].flatMap(x=>[-0.0054,0.0054].map(z=>w3dBox(0.005,0.0038,0.0018,x,0.0019,z,0x15171a)))]);
// What stands in the parks, squares, playgrounds, pitches, car parks and churchyards near the viewer. Everything is
// placed from the plot's own number, so a place looks the same every time it is passed.
function w3dFeatures(cx,cy,R,addTree,spires){
  const T=w3d.T, parts=[], flat=[], cars=[], out=[];
  const GC={park:0x6fa055,play:0xd9bd84,plaza:0xcfc8b8,pitch:0x5b9846,lot:0x55585e,school:0xc9b38d,church:0x6fa055,mall:0x55585e,library:0xcfc8b8,gov:0xd6d0c2,hospital:0xcfd2d4,gym:0xb9b3a4,stadium:0xb9b6ae,pool:0xd6d0c2,tennis:0x4f8a4a,market:0xcfc8b8,fire:0xb9b6ae,cemetery:0x6a9a52};
  bldFeatInRect(cx-R,cy-R,cx+R,cy+R,f=>{ const fx=f.x+f.w/2, fz=f.y+f.d/2; if(dist(fx,fz,cx,cy)>R) return;
    const hw=f.w/2, hd=f.d/2, tr=Math.max(hw,hd,0.15), sx=(w3dHt(fx+tr,fz)-w3dHt(fx-tr,fz))/(2*tr), sz=(w3dHt(fx,fz+tr)-w3dHt(fx,fz-tr))/(2*tr), gm=(w3dHt(fx+tr,fz)+w3dHt(fx-tr,fz)+w3dHt(fx,fz+tr)+w3dHt(fx,fz-tr)+2*w3dHt(fx,fz))/6;
    const Fm=new T.Matrix4().makeTranslation(fx,gm,fz).multiply(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-sx,1,-sz).normalize()))).multiply(new T.Matrix4().makeRotationY(-f.a));
    const B=(w,h,d,x,y,z,c,list)=>{ const q=w3dBox(w,h,d,x,y,z,c); q.m=Fm.clone().multiply(q.m); (list||parts).push(q); }, Gd=(w,d,x,z,c,y)=>B(w,0.0004,d,x,(y||0.0012),z,c,flat);
    const Cy=(r,h,x,y,z,c,seg,sx,sz)=>{ parts.push({g:new T.CylinderGeometry(r,r,h,seg||14),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(x,y+h/2,z)).multiply(new T.Matrix4().makeScale(sx||1,1,sz||1)),c}); };
    let h=f.r; const rnd=()=>{ h=hashInt(h); return (h&0xffff)/65536; };
    Gd(f.w,f.d,0,0,GC[f.k]);
    const lamp=(x,z)=>{ B(0.0012,0.028,0.0012,x,0.014,z,0x5a6068); B(0.005,0.0015,0.0025,x,0.0285,z,0xf2efe2); }, bench=(x,z,r)=>B(r?0.004:0.014,0.003,r?0.014:0.004,x,0.0025,z,0x7a5a3c);
    if(f.k==='park'||f.k==='church'){ for(const [u,v,sz,hq] of featTrees(f)){ const c=featPt(f,u,v); addTree(c[0],c[1],sz,hq); }
      if(f.k==='park'){ // a clipped hedge round it with gaps at the gates, lawns mown in two greens, flower beds where the paths cross, a bandstand in the bigger ones
        for(const sd of [-1,1]){ for(const e of [-1,1]){ B(f.w*0.42,0.0045,0.006,e*f.w*0.27,0.00225,sd*(hd-0.004),0x3f6b35); B(0.006,0.0045,f.d*0.42,sd*(hw-0.004),0.00225,e*f.d*0.27,0x3f6b35); } }
        for(const [u,v] of [[-0.5,-0.5],[0.5,0.5]]) Gd(f.w*0.36,f.d*0.36,u*hw,v*hd,0x7aab5c,0.0014);
        for(const [u,v,cc] of [[-0.16,-0.16,0xd9547a],[0.16,-0.16,0xe6b93c],[-0.16,0.16,0xe6b93c],[0.16,0.16,0xd9547a]]) Cy(0.012,0.002,u*hw,0.0012,v*hd,cc,10);
        if(f.w>0.6){ const gx=-hw*0.5, gz=hd*0.5; Cy(0.022,0.003,gx,0.0012,gz,0xd9d3c4,8); for(let k=0;k<6;k++) B(0.0014,0.02,0.0014,gx+Math.cos(k*1.047)*0.019,0.013,gz+Math.sin(k*1.047)*0.019,0xf2efe6); parts.push({g:new T.ConeGeometry(0.027,0.012,8),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(gx,0.029,gz)),c:0x8c4a3a}); } }
      if(f.k==='park'){ Gd(f.w,0.014,0,0,0xd8cfb6,0.0016); Gd(0.014,f.d,0,0,0xd8cfb6,0.0016); bench(hw*0.5,0.012); bench(-hw*0.5,-0.012); bench(0.012,hd*0.5,1); lamp(0.012,0.012); lamp(-hw*0.7,0.012); lamp(hw*0.7,-0.012);
        if(f.w>0.7){ Cy(f.w*0.14,0.0008,hw*0.45,0.0012,hd*0.45,0x4f88b5,18,1,f.d*0.12/(f.w*0.14)); } else if(rnd()<0.5){ Cy(0.016,0.004,hw*0.4,0.0012,-hd*0.4,0xbdb8ad,12); B(0.02,0.012,0.02,hw*0.4,0.01,-hd*0.4,0x8a5a3c); } }
      else { B(0.004,0.006,f.d*0.9,-hw+0.004,0.003,0,0xb9b3a6); B(0.004,0.006,f.d*0.9,hw-0.004,0.003,0,0xb9b3a6); } }
    else if(f.k==='pool'){ // an open-air pool: the basin with its lanes, a paddling pool, sunbeds on the grass, a diving board
      B(f.w*0.74,0.003,f.d*0.5,0,0.0015,hd*0.25,0xe9ecef); B(f.w*0.7,0.0032,f.d*0.44,0,0.0017,hd*0.25,0x4fb3d9); for(let k=-2;k<=2;k++) B(f.w*0.7,0.0002,0.0015,0,0.0034,hd*0.25+k*f.d*0.073,0xf2f2f2); Cy(0.02,0.003,-hw*0.7,0.0012,-hd*0.25,0x7fcbe6,14);
      B(0.004,0.012,0.004,hw*0.62,0.006,hd*0.25,0xcfd4da); B(0.02,0.0012,0.005,hw*0.58,0.0125,hd*0.25,0xf2f2f2); for(let k=0;k<5;k++) B(0.006,0.0015,0.014,-hw*0.3+k*0.022,0.0022,-hd*0.3,[0xf2c200,0xe84a7a,0x2f6fae][k%3]); Gd(f.w*0.5,f.d*0.2,-hw*0.1,-hd*0.3,0x7aab5c,0.0014); }
    else if(f.k==='tennis'){ // two courts behind a wire fence
      for(const u of [-0.48,0.48]){ Gd(f.w*0.4,f.d*0.8,u*hw,0,0xb5553f,0.0014); Gd(f.w*0.3,f.d*0.62,u*hw,0,0x3f7a4a,0.0016); for(const e of [-1,1]){ Gd(0.0012,f.d*0.62,u*hw+e*f.w*0.15,0,0xf2f2f2,0.0018); Gd(f.w*0.3,0.0012,u*hw,e*f.d*0.31,0xf2f2f2,0.0018); } Gd(f.w*0.3,0.0012,u*hw,0,0xf2f2f2,0.0018); B(f.w*0.31,0.004,0.0006,u*hw,0.004,0,0xe9ecef); }
      for(const e of [-1,1]){ B(f.w,0.012,0.0006,0,0.006,e*(hd-0.002),0x8a9099); B(0.0006,0.012,f.d,e*(hw-0.002),0.006,0,0x8a9099); } }
    else if(f.k==='market'){ // a market square: rows of stalls under striped awnings, crates and a clock
      const AW=[0xd9534f,0xf2f2f2,0x3f7fbf,0xe0a030,0x4f9e62,0xf2f2f2]; let q=0; for(const v of [-0.55,0,0.55]) for(let u=-0.78;u<=0.79;u+=0.26){ const x=u*hw, z=v*hd; B(0.03,0.008,0.016,x,0.004,z,0x9a7b54); B(0.036,0.0015,0.022,x,0.0135,z,AW[(q++)%6]); for(const e of [-1,1]) B(0.001,0.013,0.001,x+e*0.015,0.0065,z+0.009,0x6d7480); }
      B(0.004,0.03,0.004,hw*0.9,0.015,hd*0.85,0x5a6068); Cy(0.006,0.002,hw*0.9,0.03,hd*0.85,0xf7f4ea,10); lamp(-hw*0.9,-hd*0.85); lamp(-hw*0.9,hd*0.85); }
    else if(f.k==='fire'){ // a fire station: the appliance bays with red doors on the forecourt side, engines out front, a drill tower
      for(let k=-1;k<=1;k++){ B(f.w*0.16,0.016,0.001,-f.w*0.08+k*f.w*0.2,0.008,-hd*0.4+f.d*0.212,0xc8322a); B(f.w*0.16,0.002,0.0012,-f.w*0.08+k*f.w*0.2,0.012,-hd*0.4+f.d*0.213,0xf2f2f2); }
      for(const k of [-1,0]){ B(0.036,0.012,0.014,-f.w*0.08+k*f.w*0.2,0.007,hd*0.3,0xc8322a); B(0.012,0.006,0.0142,-f.w*0.08+k*f.w*0.2+0.011,0.011,hd*0.3,0x26303a); B(0.02,0.002,0.004,-f.w*0.08+k*f.w*0.2-0.004,0.0142,hd*0.3,0xcfd4da); }
      B(0.03,0.09,0.03,hw*0.72,0.045,-hd*0.5,0xb9b3a6); for(let y=0.02;y<0.09;y+=0.022) B(0.031,0.003,0.031,hw*0.72,y,-hd*0.5,0x8a8a86); B(0.034,0.003,0.034,hw*0.72,0.0915,-hd*0.5,0xc8322a); Gd(f.w*0.9,f.d*0.3,0,hd*0.6,0x6a6d73,0.0014); }
    else if(f.k==='cemetery'){ // rows of headstones between gravel walks, yews, a wall round it
      Gd(f.w,0.01,0,0,0xd8cfb6,0.0016); Gd(0.01,f.d,0,0,0xd8cfb6,0.0016); for(let u=-0.86;u<=0.86;u+=0.11) for(const v of [-0.72,-0.5,-0.28,0.28,0.5,0.72]){ if(Math.abs(u)<0.08||(u<-0.4&&v<-0.2)) continue; const hq=hashInt(f.r+Math.round(u*50)*31+Math.round(v*50)); if((hq&7)===0) continue; B(0.004,0.004+(hq>>4&3)*0.001,0.0012,u*hw,0.003,v*hd,(hq>>8)&1?0xb9b6ae:0x8f8d86); }
      for(const [u,v] of [[-0.9,0.9],[0.9,0.9],[0.9,-0.9],[0.5,0],[-0.5,0.1]]){ const c=featPt(f,u,v); addTree(c[0],c[1],0.9,(hashInt(f.r+u*9+v*5)&~7)|1); } for(const e of [-1,1]){ B(f.w,0.005,0.002,0,0.0025,e*(hd-0.002),0xb9b3a6); B(0.002,0.005,f.d,e*(hw-0.002),0.0025,0,0xb9b3a6); } }
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
    else if(f.k==='lot'||f.k==='mall'){ const v0=f.k==='mall'?0.38:-0.82, rows=[[v0,1]], n=Math.max(3,Math.round(f.w/0.035)); if(Math.abs((0.86-0.15)-(v0+0.15))*hd>=0.036) rows.push([0.86,-1]);      /* a second row only where it does not reach into the first (a car is 0.028 long) */
      for(const [v,sd] of rows) for(let k=0;k<=n;k++){ const u=-0.92+1.84*k/n; Gd(0.0016,f.d*0.15,u*hw,(v+sd*0.15)*hd,0xe6e6e6,0.0016); if(k<n&&rnd()<0.62) cars.push([...featPt(f,u+0.92/n,v+sd*0.15),f.a+(sd>0?1:-1)*Math.PI/2,(h>>>8)&7]); }
      lamp(0,(v0+0.86)/2*hd); if(f.k==='lot') B(0.014,0.012,0.01,-hw+0.012,0.006,-hd+0.01,0xe0a030); }
    else if(f.k==='library'){ const H1=f.hm/150*BZ3*1.3*0.7, zf=-f.d*0.1+f.d*0.29; B(f.w*0.5,0.004,0.03,0,0.002,zf+0.016,0xd9d3c4); B(f.w*0.42,0.008,0.02,0,0.004,zf+0.011,0xdcd6c8);       /* steps, a row of columns under the gable, lamps and trees */
      for(let k=0;k<6;k++) Cy(0.0032,H1-0.008,(-0.5+k/5)*f.w*0.5,0.008,zf+0.008,0xefeadf,8); B(f.w*0.56,0.004,0.014,0,H1,zf+0.007,0xe6dfd0); lamp(-hw*0.8,hd*0.7); lamp(hw*0.8,hd*0.7); for(const u of [-0.8,0.8]){ const c=featPt(f,u,0.75); addTree(c[0],c[1],0.9,f.r+u*10); } bench(-hw*0.4,hd*0.75); bench(hw*0.4,hd*0.75); }
    else if(f.k==='gym'){ const H1=f.hm/150*BZ3, bw=f.w*0.86, bd=f.d*0.78, z0=-f.d*0.04; for(let k=0;k<4;k++){ const sc=1-k*0.2; B(bw*1.01,0.004,bd*sc,0,H1+0.002+k*0.004,z0,k%2?0x3f6fa8:0x4a7bb5); }      /* a vaulted roof in bands, an entrance canopy, a court outside */
      B(bw*0.3,0.003,0.03,0,0.022,z0+bd/2+0.015,0xeeeeea); for(const ex of [-1,1]) B(0.002,0.022,0.002,ex*bw*0.13,0.011,z0+bd/2+0.028,0xa9b0b9); Gd(f.w*0.3,f.d*0.12,hw*0.55,hd*0.86,0xb5553c,0.0016); lamp(-hw*0.85,hd*0.85); }
    else if(f.k==='stadium'){ const wl=0xf2f2f2, pw=f.w*0.5, pd=f.d*0.5; for(let k=0;k<6;k+=2) Gd(pw/6,pd,(-2.5+k)*pw/6,0,0x66a550,0.0015); Gd(pw,pd,0,0,0x5b9846,0.0013);
      const ln=(w,d,x,z)=>Gd(w,d,x,z,wl,0.002); ln(pw,0.003,0,-pd/2); ln(pw,0.003,0,pd/2); ln(0.003,pd,-pw/2,0); ln(0.003,pd,pw/2,0); ln(0.003,pd,0,0);
      // stands: rising tiers on all four sides, roofs over the long sides, floodlight masts at the corners
      for(let k=0;k<5;k++){ const hgt=0.008+k*0.009, off=0.03+k*0.026; for(const sd of [-1,1]){ B(pw+0.1+k*0.05,hgt,0.026,0,hgt/2,sd*(pd/2+off),k%2?0xb9bec4:0x8f98a3); B(0.026,hgt,pd+0.02+k*0.05,sd*(pw/2+off),hgt/2,0,k%2?0xb9bec4:0x8f98a3); } }
      for(const sd of [-1,1]){ B(pw+0.3,0.004,0.12,0,0.075,sd*(pd/2+0.12),0xeef0f2); for(const ex of [-1,-0.33,0.33,1]) B(0.003,0.075,0.003,ex*(pw/2+0.1),0.0375,sd*(pd/2+0.17),0x9aa3ad); }
      for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ B(0.004,0.13,0.004,u*hw*0.94,0.065,v*hd*0.94,0x6a7078); B(0.03,0.012,0.004,u*hw*0.94,0.134,v*hd*0.94,0xf4f1e4); } }
    else if(f.k==='gov'){ const H1=f.hm/150*BZ3, zb=-f.d*0.16, zf=zb+f.d*0.21; Cy(f.w*0.09,0.03,0,H1,zb,0xe6e0d2,16); parts.push({g:new T.SphereGeometry(f.w*0.085,16,10,0,Math.PI*2,0,Math.PI/2),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(0,H1+0.03,zb)),c:0x7fa59a}); B(0.002,0.03,0.002,0,H1+0.03+f.w*0.085+0.015,zb,0xc9ced4);   /* a dome, a portico, steps, flags and a forecourt */
      B(f.w*0.3,0.006,0.03,0,0.003,zf+0.015,0xd9d3c4); for(let k=0;k<6;k++) Cy(0.0035,H1*0.6,(-0.5+k/5)*f.w*0.26,0.006,zf+0.01,0xf0ebe0,8); B(f.w*0.3,0.006,0.02,0,H1*0.6+0.009,zf+0.01,0xe6e0d2);
      for(const ex of [-1,0,1]){ B(0.001,0.05,0.001,ex*f.w*0.22,0.025,hd*0.55,0xc9ced4); B(0.014,0.008,0.0006,ex*f.w*0.22+0.007,0.045,hd*0.55,[0xd9534f,0x3f7fbf,0xe0a030][ex+1]); } for(const u of [-0.8,-0.4,0.4,0.8]){ const c=featPt(f,u,0.8); addTree(c[0],c[1],0.85,f.r+u*10); } lamp(-hw*0.6,hd*0.4); lamp(hw*0.6,hd*0.4);
      for(let k=-2;k<=2;k++) Gd(f.w,0.002,0,hd*0.2+k*f.d/9,0xc2bbab,0.0015); }
    else if(f.k==='hospital'){ const H1=f.hm/150*BZ3, zb=-f.d*0.22; B(0.02,0.02,0.0008,0,H1*0.85,zb+f.d*0.141,0xd9342f); B(0.006,0.02,0.001,0,H1*0.85,zb+f.d*0.1412,0xffffff); B(0.02,0.006,0.001,0,H1*0.85,zb+f.d*0.1412,0xffffff);      /* a red sign with its cross, a helipad on the roof, an ambulance bay, a car park */
      Cy(0.035,0.0015,-f.w*0.25,H1,zb,0x4a5560,18); B(0.03,0.0006,0.005,-f.w*0.25,H1+0.0018,zb,0xffffff); for(const ex of [-1,1]) B(0.005,0.0006,0.03,-f.w*0.25+ex*0.0125,H1+0.0018,zb,0xffffff);
      B(0.1,0.003,0.04,0,0.022,zb+f.d*0.14+0.02,0xeeeeea); for(const ex of [-0.045,0.045]) B(0.002,0.022,0.002,ex,0.011,zb+f.d*0.14+0.036,0xa9b0b9); B(0.028,0.011,0.012,0.02,0.0065,zb+f.d*0.14+0.022,0xf4f4f4); B(0.028,0.002,0.0124,0.02,0.0085,zb+f.d*0.14+0.022,0xd9342f);
      Gd(f.w*0.5,f.d*0.3,0,hd*0.62,0x55585e,0.0016); for(let k=0;k<=8;k++){ const u=-0.22+0.44*k/8; Gd(0.0016,f.d*0.1,u*f.w,hd*0.5,0xe6e6e6,0.002); if(k<8&&rnd()<0.6) cars.push([...featPt(f,(u+0.0275)*2,0.5),f.a+Math.PI/2,(h>>>8)&7]); } lamp(-hw*0.8,hd*0.8); lamp(hw*0.8,hd*0.8); }
    else if(f.k==='school'){ Gd(f.w*0.5,f.d*0.42,hw*0.4,hd*0.42,0x3f6fa8,0.0016); for(const sx of [-1,1]){ B(0.0012,0.02,0.0012,hw*0.4+sx*f.w*0.23,0.01,hd*0.42,0x5a6068); } B(0.001,0.045,0.001,-hw*0.1,0.0225,hd*0.2,0xc9ced4); B(0.012,0.007,0.0006,-hw*0.1+0.006,0.041,hd*0.2,0xd9534f);
      B(f.w,0.006,0.001,0,0.003,hd,0x7d8791); B(0.001,0.006,f.d,hw,0.003,0,0x7d8791); const c=featPt(f,0.8,-0.1); addTree(c[0],c[1],1,f.r); const c2=featPt(f,-0.2,0.8); addTree(c2[0],c2[1],0.9,f.r+3); } });
  // church towers and spires
  for(const b of spires){ const Fm=new T.Matrix4().makeTranslation(b.x+b.w/2,w3dUnder(b),b.y+b.d/2).multiply(new T.Matrix4().makeRotationY(-(b.a||0))), hN=b.h*BZ3*1.25, tw=Math.min(b.w,0.045), q=w3dBox(tw,hN*1.7,tw,0,hN*0.85,b.d/2-tw/2,0xe4ded2); q.m=Fm.clone().multiply(q.m); parts.push(q);
    parts.push({g:new T.ConeGeometry(tw*0.78,hN*0.9,4),m:Fm.clone().multiply(new T.Matrix4().makeTranslation(0,hN*1.7+hN*0.45,b.d/2-tw/2)).multiply(new T.Matrix4().makeRotationY(Math.PI/4)),c:0x5a6068}); }
  if(flat.length){ const m=new T.Mesh(w3dMerge(flat),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.95,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,...w3dCut()}))); m.receiveShadow=true; m.renderOrder=-2; out.push(m); }
  if(parts.length){ const m=new T.Mesh(w3dMerge(parts),w3dSee(new T.MeshStandardMaterial({vertexColors:true,roughness:0.7,metalness:0.05}))); m.castShadow=true; m.receiveShadow=true; out.push(m); }
  if(cars.length){ const cols=[0xf2f2f2,0x1f2329,0xb7bcc3,0xa1262c,0x2c4d7a,0x6c7076,0xe0e0dc,0x3b3f45], m=new T.InstancedMesh(w3dCarGeo(),w3dVehMat({roughness:0.35,metalness:0.4}),cars.length), M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1), col=new T.Color();
    (w3d.parked||(w3d.parked=[])).push(...cars.map(c=>[c[0],c[1],c[2]]));
    cars.forEach((c,i)=>{ Q.setFromAxisAngle(up,-c[2]); M.compose(V.set(c[0],0.0012+w3dHt(c[0],c[1]),c[1]),Q,one); m.setMatrixAt(i,M); col.set(cols[c[3]]); m.setColorAt(i,col); }); m.castShadow=true; m.receiveShadow=true; out.push(m); }
  return out; }
/* Boats: sailing boats and ferries on the open water, barges and launches on the rivers. Where a boat is depends only
   on its place and the time of day, so they are the same boats, in the same places, however the viewer got there. */
function w3dBoats(cx,cy,add){ const T=w3d.T, R=18, K=[[],[],[]], PP=[...(w3d.pierPts||[]),...(w3d.pierPts2||[])].filter(q=>Math.abs(q[0]-cx)<R+4&&Math.abs(q[1]-cy)<R+4), pierAt=(x,y)=>{ for(const q of PP) if(Math.abs(q[0]-x)<0.09&&Math.abs(q[1]-y)<0.09) return true; return false; };      /* no boat's course passes within a boat's length of a pier */
  for(let y=Math.floor(cy-R);y<=cy+R;y++) for(let x=Math.floor(cx-R);x<=cx+R;x++){ if(x<2||y<2||x>=W-2||y>=H-2) continue; const wv=G.water[y*W+x]; if(!wv) continue; const riv=wv===2, h=hashInt(x*7349+y*9151+G.seed*31); if((h&255)>(riv?56:26)) continue;
    const px=x+((h>>8)&255)/255-0.5, py=y+((h>>16)&255)/255-0.5, side=riv?0.14:0.6; if(waterSD(px,py)>-0.1) continue; let dx, dy;
    if(riv){ const gx=bilinear(G.rivSD,px+0.25,py)-bilinear(G.rivSD,px-0.25,py), gy=bilinear(G.rivSD,px,py+0.25)-bilinear(G.rivSD,px,py-0.25), l=Math.hypot(gx,gy); if(l<1e-4) continue; dx=-gy/l; dy=gx/l; } else { const an=((h>>20)&255)/255*6.283; dx=Math.cos(an); dy=Math.sin(an); }
    // how far it can go each way and stay in deep water
    const open=t=>{ const qx=px+dx*t, qy=py+dy*t; return !pierAt(qx,qy)&&waterSD(qx,qy)<-0.1&&waterSD(qx-dy*side,qy+dx*side)<-0.02&&waterSD(qx+dy*side,qy-dx*side)<-0.02; }; if(!open(0)) continue;
    let t0=0, t1=0; while(t1<3&&open(t1+0.25)) t1+=0.25; while(t0>-3&&open(t0-0.25)) t0-=0.25; t1-=0.2; t0+=0.2; if(t1-t0<0.5) continue;
    const kind=riv?((h>>28)&1?2:1):((h>>28)&3)===0?1:0; K[kind].push({x:px+dx*(t0+t1)/2,y:py+dy*(t0+t1)/2,dx,dy,amp:(t1-t0)/2,ph:(h>>4)&1023,w:(kind===0?0.05:kind===1?0.09:0.045)/((t1-t0)/2)}); }
  const mats=new T.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0.05}), cone=(r,h2,sx,sz,x,y,z,c)=>({g:new T.ConeGeometry(r,h2,4),m:new T.Matrix4().makeTranslation(x,y,z).multiply(new T.Matrix4().makeScale(sx,1,sz)),c});
  const geos=[ // a sailing boat; a ferry; a barge
    ()=>w3dMerge([w3dBox(0.034,0.004,0.011,0,0.002,0,0xf4f4f0),w3dBox(0.012,0.003,0.008,-0.004,0.0055,0,0xd9d4c8),w3dBox(0.0008,0.04,0.0008,0.003,0.024,0,0x8a8a86),cone(0.014,0.036,1,0.05,-0.0045,0.026,0,0xffffff),cone(0.008,0.026,1,0.05,0.0095,0.02,0,0xf0ede4)]),
    ()=>w3dMerge([w3dBox(0.1,0.008,0.026,0,0.004,0,0xf2f3f5),w3dBox(0.1,0.002,0.0265,0,0.0035,0,0x2f5fb5),w3dBox(0.07,0.009,0.021,-0.004,0.0125,0,0xe6e9ec),w3dBox(0.071,0.004,0.0212,-0.004,0.013,0,0x2b3a4a),w3dBox(0.03,0.006,0.016,0.006,0.02,0,0xf2f3f5),w3dBox(0.006,0.01,0.006,-0.02,0.022,0,0xc8423a)]),
    ()=>w3dMerge([w3dBox(0.12,0.006,0.022,0,0.003,0,0x3b4048),w3dBox(0.12,0.0015,0.0225,0,0.0052,0,0x8c3a2e),w3dBox(0.026,0.008,0.016,-0.03,0.01,0,0xb5562f),w3dBox(0.026,0.008,0.016,0.0,0.01,0,0x2f6f8f),w3dBox(0.026,0.008,0.016,0.03,0.01,0,0x9a9d68),w3dBox(0.014,0.012,0.016,-0.05,0.012,0,0xe9e6dc)])];
  const out=[]; K.forEach((L,k)=>{ if(!L.length) return; const m=new T.InstancedMesh(geos[k](),mats,L.length); m.frustumCulled=false; m.receiveShadow=true; add(m); out.push({m,L}); });
  if(out.length){ (w3d.boats||(w3d.boats=[])).push(...out); w3dBoatsTick(); } }
function w3dBoatsTick(){ const B=w3d.boats; if(!B||!B.length) return; const T=w3d.T, t=performance.now()/1000, M=new T.Matrix4(), Q=new T.Quaternion(), Q2=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), fw=new T.Vector3(1,0,0), one=new T.Vector3(1.3,1.3,1.3);
  for(let i=B.length-1;i>=0;i--){ const b=B[i]; if(!b.m.parent){ B.splice(i,1); continue; } if(!b.m.parent.parent&&b.done) continue; b.done=true;
    b.L.forEach((o,j)=>{ const ang=t*o.w+o.ph, sn=Math.sin(ang), cs=Math.cos(ang), s=cs>=0?1:-1, x=o.x+o.dx*o.amp*sn, y=o.y+o.dy*o.amp*sn;
      Q.setFromAxisAngle(up,-Math.atan2(o.dy*s,o.dx*s)); Q2.setFromAxisAngle(fw,Math.sin(t*1.3+o.ph)*0.035); Q.multiply(Q2); M.compose(V.set(x,W3D_WAT-0.0012+Math.sin(t*1.7+o.ph)*0.0005,y),Q,one); b.m.setMatrixAt(j,M); });
    b.m.instanceMatrix.needsUpdate=true; } }
/* The country beyond the town: orchards in rows, greenhouses, solar farms, hay bales on the pasture, a barn and a silo to
   every few fields; wind turbines on the high ground; a lighthouse here and there on the coast. Placed by position alone. */
function w3dCountry(cx,cy,addTree){ const T=w3d.T, parts=[], R=15, put=(g,x,y,z,c,rot,sc)=>{ let m=new T.Matrix4().makeTranslation(x,y,z); if(rot) m=m.multiply(rot); if(sc) m=m.multiply(sc); parts.push({g,m,c}); }, box=(w,h,d,x,y,z,c,rot)=>put(new T.BoxGeometry(w,h,d),x,y,z,c,rot), RY=a=>new T.Matrix4().makeRotationY(a);
  for(let y=Math.floor(cy-R);y<=cy+R;y++) for(let x=Math.floor(cx-R);x<=cx+R;x++){ if(x<2||y<2||x>=W-2||y>=H-2||dist(x,y,cx,cy)>R) continue; const i=y*W+x, gy=w3dHt(x,y);
    const h=w3dFieldAt(x,y); if(h>=0){ const fk=w3dFieldKind(h), vert=(h>>6)&1, hc=hashInt(i*7717+3);
      if(fk===1){ for(let a=0;a<4;a++) for(let b=0;b<4;b++) addTree(x-0.375+a*0.25,y-0.375+b*0.25,0.55,(hashInt(i+a*7+b*13)&~7)); }
      else if(fk===5){ for(let k=0;k<4;k++){ const o=-0.36+k*0.24, gx=vert?x+o:x, gz=vert?y:y+o; box(vert?0.16:0.86,0.018,vert?0.86:0.16,gx,gy+0.009,gz,0xdcebee); box(vert?0.02:0.86,0.006,vert?0.86:0.02,gx,gy+0.021,gz,0xf2f8f9); } }
      else if(fk===6){ for(let k=0;k<7;k++){ const o=-0.42+k*0.14; box(vert?0.07:0.9,0.002,vert?0.9:0.07,vert?x+o:x,gy+0.016,vert?y:y+o,0x25365a,vert?new T.Matrix4().makeRotationZ(0.4):new T.Matrix4().makeRotationX(-0.4)); box(vert?0.004:0.9,0.014,vert?0.9:0.004,vert?x+o:x,gy+0.007,vert?y:y+o,0x8a9099); } }
      else if(fk===7&&(hc&3)===0){ for(let k=0;k<4;k++){ const q=hashInt(hc+k*31); put(new T.CylinderGeometry(0.011,0.011,0.016,10),x-0.4+(q&255)/320,gy+0.011,y-0.4+((q>>8)&255)/320,0xd9c27a,new T.Matrix4().makeRotationZ(Math.PI/2).multiply(RY((q>>16&7)*0.4))); } }
      // a farmstead where a block of fields begins: a barn, a house, a silo
      if(((h>>>17)&15)===0&&(x%3)===0&&(y&1)===0&&fk!==5&&fk!==6){ const a=(h>>>21&3)*0.785, fx=x+0.2, fz=y+0.2; box(0.11,0.045,0.07,fx,gy+0.0225,fz,0xa8382e,RY(a)); put(new T.CylinderGeometry(0.0001,0.05,0.03,4),fx,gy+0.06,fz,0x5a4a44,RY(a+0.785),new T.Matrix4().makeScale(1.55,1,1)); put(new T.CylinderGeometry(0.018,0.018,0.075,10),fx+0.09,gy+0.0375,fz+0.03,0xcfd4da); put(new T.SphereGeometry(0.018,10,5,0,6.2832,0,1.5708),fx+0.09,gy+0.075,fz+0.03,0xb7bcc2); box(0.05,0.03,0.045,fx-0.1,gy+0.015,fz+0.05,0xe9e3d7,RY(a)); box(0.056,0.012,0.05,fx-0.1,gy+0.036,fz+0.05,0x7d4436,RY(a)); } }
    // wind turbines along the high ground
    if(!G.water[i]&&G.D[i]<0.02&&G.e[i]>0.4&&G.e[i]<0.66&&gy>0.25&&hashInt(i*5381+17)%53===0){ const a=(hashInt(i*31)&63)/10, th=0.3; put(new T.CylinderGeometry(0.005,0.009,th,8),x,gy+th/2,y,0xf2f3f5); box(0.03,0.012,0.012,x,gy+th+0.004,y,0xe6e9ec,RY(0.6)); for(let k=0;k<3;k++) box(0.006,0.13,0.002,x+Math.cos(0.6)*0.016,gy+th+0.004,y-Math.sin(0.6)*0.016,0xf7f8f9,RY(0.6).multiply(new T.Matrix4().makeRotationX(a+k*2.094)).multiply(new T.Matrix4().makeTranslation(0,0.065,0))); }
    // a lighthouse on a headland
    if(!G.water[i]&&G.D[i]<0.5&&(G.water[i+1]===1||G.water[i-1]===1||G.water[i+W]===1||G.water[i-W]===1)&&hashInt(i*9176+G.seed)%83===0&&waterSD(x,y)>0.12&&!(G.air&&G.air[i])&&!w3dOnRoad(x,y,0.08)){ put(new T.CylinderGeometry(0.014,0.022,0.14,12),x,gy+0.07,y,0xf7f4ea); for(const yy of [0.035,0.09]) put(new T.CylinderGeometry(0.0185,0.0205,0.022,12),x,gy+yy,y,0xc8322a); put(new T.CylinderGeometry(0.02,0.02,0.004,12),x,gy+0.142,y,0x3a3d43); put(new T.CylinderGeometry(0.011,0.011,0.018,10),x,gy+0.153,y,0xfff3c4); put(new T.ConeGeometry(0.016,0.016,10),x,gy+0.17,y,0xc8322a); box(0.05,0.022,0.035,x+0.04,gy+0.011,y,0xf1ece2); box(0.054,0.006,0.039,x+0.04,gy+0.025,y,0x8c4a3a); } }
  if(!parts.length) return null; const m=new T.Mesh(w3dMerge(parts),new T.MeshStandardMaterial({vertexColors:true,roughness:0.7,metalness:0.05})); m.castShadow=true; m.receiveShadow=true; return m; }
function w3dCars(cx,cy,add){
  const T=w3d.T, Rn=G.rn; if(!Rn) return null; const E=[];
  for(let gy=Math.floor((cy-7)/RN_G);gy<=Math.floor((cy+7)/RN_G);gy++) for(let gx=Math.floor((cx-7)/RN_G);gx<=Math.floor((cx+7)/RN_G);gx++){ const a=Rn.eg.get(rnKey(gx,gy)); if(a) for(const e of a) if(!E.includes(e)) E.push(e); }
  if(!E.length) return null; const n=Math.min(260,E.length*3), cars=[];
  for(let i=0;i<n;i++){ const e=E[Math.floor(Math.random()*E.length)]; cars.push({e,t:Math.random(),fwd:Math.random()<0.5,v:0.18+Math.random()*0.12}); }
  const g=w3dCarGeo();
  const cols=[0xf2f2f2,0x1f2329,0xb7bcc3,0xa1262c,0x2c4d7a,0x6c7076,0xe0e0dc,0x3b3f45], m=new T.InstancedMesh(g,w3dVehMat({roughness:0.35,metalness:0.4}),n), col=new T.Color();
  for(let i=0;i<n;i++){ col.set(cols[i%cols.length]); m.setColorAt(i,col); } m.castShadow=true; add(m); return {m,cars,E}; }
function w3dCarsTick(dt){
  const c=w3d.cars; if(!c) return; const T=w3d.T, Rn=G.rn, M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1);
  const vp=w3d.vp||[0,0], again=o=>{ const an=Math.random()*6.283, r=7.5+Math.random()*3, l=Rn.eg.get(rnKey(Math.floor((vp[0]+Math.cos(an)*r)/RN_G),Math.floor((vp[1]+Math.sin(an)*r)/RN_G))); if(l&&l.length){ o.e=l[Math.floor(Math.random()*l.length)]; o.t=Math.random(); } };
  if(c.R!==Rn){ if(c.R){ c.cars.forEach(again); w3d.rLift=null; } c.R=Rn; }      /* the street web was rebuilt: its numbering is new */
  c.cars.forEach((o,i)=>{ const a=Rn.ea[o.e], b=Rn.eb[o.e]; if(a==null||b==null){ again(o); return; } const ax=Rn.x[a], ay=Rn.y[a], bx=Rn.x[b], by=Rn.y[b], L=Math.hypot(bx-ax,by-ay)||0.1;
    if(Math.abs(ax-vp[0])>12||Math.abs(ay-vp[1])>12){ again(o); return; }      /* left far behind: comes back on a street well away from the viewer */
    o.t+=dt*o.v/L*(o.fwd?1:-1); if(o.t>1||o.t<0){ const nd=o.t>1?b:a, nx=Rn.adj[nd].filter(e=>e!==o.e); if(nx.length&&c.E.length){ o.e=nx[Math.floor(Math.random()*nx.length)]; o.fwd=Rn.ea[o.e]===nd; o.t=o.fwd?0:1; } else { o.fwd=!o.fwd; o.t=clamp(o.t,0,1); } return; }
    const dx=(bx-ax)/L, dy=(by-ay)/L, s=o.fwd?1:-1, lane=0.012*s, x=ax+(bx-ax)*o.t-dy*lane, y=ay+(by-ay)*o.t+dx*lane;
    Q.setFromAxisAngle(up,-Math.atan2(dy*s,dx*s)); { const lf=w3d.rLift&&w3d.rLift.get(o.e); M.compose(V.set(x,0.0005+w3dHt(x,y)+(lf?lf(o.t*L):0),y),Q,one); } c.m.setMatrixAt(i,M); });
  c.m.instanceMatrix.needsUpdate=true; }
// near the viewer the ground is redrawn sharp: 56 px per cell (about 2.7 m a pixel) so kerbs, lane markings and paths read from the train
function* w3dLocalGround(cx,cy,add){
  const T=w3d.T, B=G.bounds, S=32, K=52, x0=Math.max(B[0]-0.5,Math.round(cx)-S/2-0.5), y0=Math.max(B[1]-0.5,Math.round(cy)-S/2-0.5), sw=Math.min(S,B[2]-0.5-x0), sh=Math.min(S,B[3]-0.5-y0); if(sw<=0||sh<=0) return;
  const dark=w3dDark(), GK=6, gc=w3d.groundCanvas; if(!gc) return;
  // texture: grain in grass and paving
  if(!w3d.noise){ const n=document.createElement('canvas'); n.width=n.height=128; const ng=n.getContext('2d'), id=ng.createImageData(128,128); for(let i=0;i<id.data.length;i+=4){ const v=128+((hashInt(i)&255)-128)*0.5; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } ng.putImageData(id,0,0); w3d.noise=n; }
  const Rg=G.rn, dryC=new Map(), flyE=new Set(Rg?w3dFlySet(w3dEdgesIn(x0-1,y0-1,x0+sw+1,y0+sh+1)).flyI.keys():[]), dryEdge=e=>{ let v=dryC.get(e); if(v==null){ const a=Rg.ea[e], b=Rg.eb[e], l=Math.hypot(Rg.x[b]-Rg.x[a],Rg.y[b]-Rg.y[a]), n=Math.max(2,Math.ceil(l/0.1)); v=!flyE.has(e); for(let k=0;k<=n&&v;k++) if(waterSD(lerp(Rg.x[a],Rg.x[b],k/n),lerp(Rg.y[a],Rg.y[b],k/n))<0.32) v=false; dryC.set(e,v); } return v; };
  const E=w3dEdgesIn(x0,y0,x0+sw,y0+sh), wc=dark?'#1c3550':'#3f7aa8', wd=ROAD_W.map(w=>w-0.03), pave=dark?'#5d5f66':'#d6d3cb', asph=dark?'#2a2c31':'#55585f'; yield;
  yield* w3dTiles(x0,y0,sw,sh,0.0004,3,K,(g,tx0,ty0,tw,th,k)=>{ const cv=g.canvas;
      g.drawImage(gc,(tx0-(B[0]-0.5))*GK,(ty0-(B[1]-0.5))*GK,tw*GK,th*GK,0,0,cv.width,cv.height);
      g.globalAlpha=0.07; g.globalCompositeOperation='overlay'; g.fillStyle=g.createPattern(w3d.noise,'repeat'); g.fillRect(0,0,cv.width,cv.height); g.globalAlpha=1; g.globalCompositeOperation='source-over';
      g.setTransform(k,0,0,k,-tx0*k,-ty0*k); w3dRock(g,tx0,ty0,tw,th,true); g.lineCap='butt'; w3dFields(g,tx0,ty0,tx0+tw,ty0+th,true); g.lineCap='round'; g.lineJoin='round';
      { const segs=w3dRivIx().segs.filter(q=>Math.max(q[0],q[2])>tx0-3&&Math.min(q[0],q[2])<tx0+tw+3&&Math.max(q[1],q[3])>ty0-3&&Math.min(q[1],q[3])<ty0+th+3), pass=(extra,col)=>{ g.strokeStyle=col; for(const q of segs){ const w=q[4]+q[5]+extra; if(w<=0.02) continue; g.lineWidth=w; g.beginPath(); g.moveTo(q[0],q[1]); g.lineTo(q[2],q[3]); g.stroke(); } };
        // a green bank with a riverside path along it (walkers and cyclists), grass down to the water, then the water itself
        pass(0.62,dark?'#36543a':'#7fae62'); pass(0.40,dark?'#5d5a4c':'#d9d2bd'); pass(0.33,dark?'#3a5c3e':'#86b468'); pass(-0.2,dark?'#17304a':'#356d94'); }
      // under the trees of a wood the ground is dark: leaf litter and shade, not lawn
      for(let y=Math.floor(ty0)-1;y<ty0+th+1;y++) for(let x=Math.floor(tx0)-1;x<tx0+tw+1;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]||G.pk[i]<=0.27) continue; for(let q=0;q<5;q++){ const hq=hashInt(i*211+q*977), px=x-0.5+(hq&255)/255, py=y-0.5+((hq>>8)&255)/255, gr=g.createRadialGradient(px,py,0,px,py,0.5); gr.addColorStop(0,dark?'rgba(20,40,22,.5)':'rgba(52,86,44,.5)'); gr.addColorStop(1,'rgba(52,86,44,0)'); g.fillStyle=gr; g.fillRect(px-0.5,py-0.5,1,1); } }
      // footpaths wandering through the parks
      g.strokeStyle=dark?'#4d4a40':'#d8cfb6'; g.lineWidth=0.018; g.beginPath();
      for(let y=Math.floor(ty0);y<ty0+th+1;y++) for(let x=Math.floor(tx0);x<tx0+tw+1;x++){ if(x<0||y<0||x>=W||y>=H) continue; const i=y*W+x; if(G.water[i]||G.pk[i]<0.27) continue; const h=hashInt(i*17+3); if((h>>20)&3) continue;      /* a path here and there */
        g.moveTo(x-0.5,y-0.5+((h&255)/255)); g.bezierCurveTo(x-0.1,y-0.3,x+0.1,y+0.3,x+0.5,y-0.5+(((h>>8)&255)/255)); } g.stroke();
      if(P2.rail){ g.strokeStyle=dark?'#4a443e':'#9a8f84'; g.lineWidth=0.09; g.stroke(P2.rail); g.strokeStyle=dark?'#2a2a2a':'#4a4440'; g.lineWidth=0.006; for(const o of [-0.012,0.012]){ g.save(); g.translate(0,o); g.stroke(P2.rail); g.restore(); } }
      w3dStreets(g,w3dEdgesIn(tx0,ty0,tx0+tw,ty0+th,E).filter(dryEdge),wd,[[0.034,pave],[0.006,dark?'#3a3c42':'#777a80'],[0,asph],[-0.0035,k=>k===4?'#e8c547':'rgba(255,255,255,.85)',k=>k===4?[]:[0.025,0.03],2]]); },
    null,tx=>w3dSee(new T.MeshStandardMaterial({map:tx,roughness:0.95,...w3dCutNear()})),m=>{ m.renderOrder=-6; add(m); });
  // the water surface, wherever there is water within this piece of ground
  { const pos=[], uv=[], idx=[], X0=Math.floor(x0), Y0=Math.floor(y0), nx=Math.ceil(sw)+1, ny=Math.ceil(sh)+1, id=new Int32Array((nx+1)*(ny+1)).fill(-1), wt=new Uint8Array((nx+1)*(ny+1));
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++) wt[j*(nx+1)+i]=waterSD(X0+i,Y0+j)<0.75?1:0;
    const vert=(i,j)=>{ const k=j*(nx+1)+i; if(id[k]<0){ id[k]=pos.length/3; pos.push(clamp(X0+i,x0,x0+sw),W3D_WAT,clamp(Y0+j,y0,y0+sh)); uv.push((X0+i)*5.5,(Y0+j)*5.5); } return id[k]; };
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ if(!(wt[j*(nx+1)+i]||wt[j*(nx+1)+i+1]||wt[(j+1)*(nx+1)+i]||wt[(j+1)*(nx+1)+i+1])) continue; const a=vert(i,j), b=vert(i+1,j), c=vert(i+1,j+1), d=vert(i,j+1); idx.push(a,d,c,a,c,b); }
    if(idx.length){ const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
      const m=new T.Mesh(g,w3dWaterMat()); m.renderOrder=-5.5; m.receiveShadow=true; add(m); } } }
/* The water: one material for sea, lakes and rivers. Two layers of ripples (the same normal map at two scales, drifting
   across each other) break up the reflection of the sky, the sun glints on them, and the water is clearer and greener
   seen from above, more of a mirror towards the horizon. */
function w3dWaterMat(){ if(w3d.watM) return w3d.watM; const T=w3d.T, N=128, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d'), im=g.createImageData(N,N), hf=new Float32Array(N*N);
  // a tiling height field of a few wave trains, turned into a normal map
  // a tiling height field: a few octaves of smooth noise (no regular wave trains, which show as a lattice from far off)
  for(const [P,am] of [[6,0.5],[11,0.3],[19,0.2],[37,0.12]]){ const lat=new Float32Array(P*P); for(let i=0;i<P*P;i++) lat[i]=(hashInt(i*7919+P*104729)&65535)/65535;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const fx=x/N*P, fy=y/N*P, ix=Math.floor(fx), iy=Math.floor(fy); let tx=fx-ix, ty=fy-iy; tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty); const a0=lat[iy*P+ix], a1=lat[iy*P+(ix+1)%P], b0=lat[((iy+1)%P)*P+ix], b1=lat[((iy+1)%P)*P+(ix+1)%P]; hf[y*N+x]+=am*(lerp(lerp(a0,a1,tx),lerp(b0,b1,tx),ty)*2-1)*2.2; } }
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const dx=hf[y*N+(x+1)%N]-hf[y*N+(x+N-1)%N], dy=hf[((y+1)%N)*N+x]-hf[((y+N-1)%N)*N+x], l=Math.hypot(dx*6,dy*6,1), o=(y*N+x)*4; im.data[o]=128-dx*6/l*127; im.data[o+1]=128-dy*6/l*127; im.data[o+2]=1/l*255; im.data[o+3]=255; }
  g.putImageData(im,0,0); const nt=new T.CanvasTexture(c); nt.wrapS=nt.wrapT=T.RepeatWrapping; nt.colorSpace=T.NoColorSpace; nt.anisotropy=4;
  const m=new T.MeshStandardMaterial({color:0x2f6f96,roughness:0.16,metalness:0.0,normalMap:nt,normalScale:new T.Vector2(0.55,0.55),transparent:true,opacity:0.82,envMapIntensity:1.5,depthWrite:false}); m.userData.keep=true; m.userData.uT={value:0};
  m.onBeforeCompile=sh=>{ sh.uniforms.uT=m.userData.uT;
    sh.fragmentShader='uniform float uT;\n'+sh.fragmentShader.replace('#include <normal_fragment_maps>',`
      { vec2 wu=vNormalMapUv; vec3 n1=texture2D(normalMap,wu+vec2(uT*0.021,uT*0.013)).xyz*2.0-1.0, n2=texture2D(normalMap,mat2(0.76,0.65,-0.65,0.76)*wu*2.3+vec2(-uT*0.034,uT*0.027)).xyz*2.0-1.0, n3=texture2D(normalMap,mat2(0.91,-0.41,0.41,0.91)*wu*0.19+vec2(uT*0.004,-uT*0.003)).xyz*2.0-1.0; n2.xy=mat2(0.76,-0.65,0.65,0.76)*n2.xy; n3.xy=mat2(0.91,0.41,-0.41,0.91)*n3.xy; float wf=1.0/(1.0+length(vViewPosition)*0.22);
        vec3 mapN=normalize(vec3((n1.xy*wf+n2.xy*0.6*wf+n3.xy*0.6)*normalScale,2.2)); normal=normalize(tbn*mapN); }`)
      .replace('#include <opaque_fragment>',`{ float fr=pow(1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0),3.0); outgoingLight=mix(outgoingLight,outgoingLight*1.12+vec3(0.05,0.07,0.08),fr); diffuseColor.a=mix(diffuseColor.a,0.97,fr); }
      #include <opaque_fragment>`); };
  return w3d.watM=m; }
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
  // the time of day: morning, noon, a long golden evening, night, dawn. Only the light changes, never what is there.
function w3dTod(dt){ w3d.tod=w3d.todFix!=null?w3d.todFix:((w3d.tod==null?0.12:w3d.tod)+dt/360)%1; const td=w3d.tod, n=td<0.55?0:td<0.68?smooth(td,0.55,0.68):td<0.9?1:1-smooth(td,0.9,0.98); W3D_NIGHT.value=n;
    const gold=smooth(td,0.45,0.6)*(1-smooth(td,0.62,0.7)); w3d.sun.intensity=2.9*(1-n*0.92); w3d.sun.color.setRGB(1,0.94-gold*0.25,0.85-gold*0.45); w3d.hemi.intensity=0.42*(1-n*0.8); w3d.hemi.color.setRGB(0.87-n*0.6,0.91-n*0.55,0.96-n*0.35);
    w3d.R.toneMappingExposure=0.95*(1-n*0.62); if(w3d.S.fog) w3d.S.fog.color.setRGB(0.87-n*0.8+gold*0.08,0.91-n*0.83-gold*0.05,0.93-n*0.78-gold*0.12); if(w3d.lampM) w3d.lampM.emissiveIntensity=n*3; if(w3d.watM) w3d.watM.envMapIntensity=1.5*(1-n*0.8); }
function w3dFrame(dt){
  if(!w3d.active||!w3d.ready) return; bldFreeze=true; w3d.seeDt=dt; w3dBuild(); const T=w3d.T, R=w3d.R, box=$('#cv3d'), bw=box.clientWidth, bh=box.clientHeight;
  if(R.domElement.width!==Math.round(bw*R.getPixelRatio())||R.domElement.height!==Math.round(bh*R.getPixelRatio())){ R.setSize(bw,bh,false); w3d.cam3.aspect=bw/bh; w3d.cam3.updateProjectionMatrix(); }
  const st=watch.st, M=new T.Matrix4(), Q=new T.Quaternion(), V=new T.Vector3(), up=new T.Vector3(0,1,0), one=new T.Vector3(1,1,1);
  // the other trains glide along at the same calm pace as yours
  w3d.tt=(w3d.tt||0)+dt; w3dCarsTick(dt); w3dRailTick(dt); w3dBoatsTick();
  if(w3d.grow){ const g=w3d.grow; g.t+=dt; const f=smooth(g.t,0,15); g.bx.growTo(f); g.hgrow.forEach(fn=>fn(f)); if(f>=1) w3d.grow=null; }
  // streets added since the land was drawn: redraw it in the background now and then, never while the surroundings are being built
  const now=performance.now(); if(w3d.cut){ w3d.cut=false; if(!w3d.gj&&G.rn&&G.rn.ver!==w3d.gRn){ w3d.gRn=G.rn.ver; w3d.gAt=now; w3d.gj={it:w3dGroundGen()}; } }      /* new streets reach the land only at a cut */
  if(w3d.reveal){ const r=w3d.reveal; for(let k=0;k<2&&r.kids.length;k++) r.kids.shift().visible=true; if(!r.kids.length){ r.drop(r.old); w3d.reveal=null; } }
  if(w3d.gj&&!w3d.lj&&w3dRun(w3d.gj,4)) w3d.gj=null;
  for(const tr of (w3d.trains||[])){ if(!tr.L._p3) continue; for(let k=0;k<tr.n;k++){ const p=w3dTrainPos(tr,k); w3dSetCars(tr.m,k*W3D_CARS,tr.L,p.u,p.dir); } tr.m.instanceMatrix.needsUpdate=true; }
  if(w3d.look){ const q=w3d.look; w3d.vp=[q.x,q.z]; w3dLocal(q.x,q.z); w3d.cam3.position.set(q.x+Math.cos(q.az)*q.d,q.h,q.z+Math.sin(q.az)*q.d); w3d.cam3.lookAt(q.x,q.ty||0.03,q.z); if(w3d.sky){ w3d.sky.position.copy(w3d.cam3.position); w3d.sky.material.uniforms.uT.value=performance.now()/1000; } if(w3d.watM) w3d.watM.userData.uT.value=performance.now()/1000%4000;
    w3dTod(0); w3d.sun.target.position.set(q.x,0,q.z); w3d.sun.position.set(q.x-8,14,q.z+10); R.shadowMap.needsUpdate=true; R.render(w3d.S,w3d.cam3); w3dEmpty(); return; }      /* a fixed look at a place (debugging) */
  if(!st){ R.render(w3d.S,w3d.cam3); w3dEmpty(); return; }
  const P3=st.L&&st.L._p3, ru=P3?w3dRideU(st):null; let x, z, u3, hx=st.hx, hz=st.hy, sg=1;
  if(ru){ u3=ru.u; sg=ru.sg; w3d.lastSg=sg; const p=polyAt(P3.pts,P3.cum,u3), h=polyHead(P3.pts,P3.cum,u3,0.08); x=p[0]; z=p[1]; hx=h[0]*sg; hz=h[1]*sg; }
  else { [x,z,u3]=st.L?w3dNear(st.L,st.x,st.y):[st.x,st.y,0]; if(P3){ const hd=polyHead(P3.pts,P3.cum,u3,0.05); sg=(hd[0]*hx+hd[1]*hz)>=0?1:-1; } }
  const nx=-hz, nz=hx; w3d.vp=[x,z]; w3dLocal(x,z);
  // the line's own timetable would put another train where the watched one is: that one is left out while it is near
  if(P3&&st.mode==='ride') for(const tr of (w3d.trains||[])){ if(tr.L!==st.L) continue; const Z=w3d.zeroM||(w3d.zeroM=new T.Matrix4().makeScale(0,0,0)); for(let k=0;k<tr.n;k++){ const p=w3dTrainPos(tr,k); if(p.dir===sg&&Math.abs(p.u-u3)<1.6) for(let c=0;c<W3D_CARS;c++) tr.m.setMatrixAt(k*W3D_CARS+c,Z); } }
  const yT=P3&&P3.Y?w3dHAt(P3,u3):TRK, inHill=!!(P3&&P3.hill&&P3.hill[clamp(trainSeg(P3.cum,u3),0,P3.hill.length-1)]), under=yT<-0.01, len3=P3?P3.cum[P3.cum.length-1]:0; if(st.mode==='ride'){ x+=nx*W3D_TO; z+=nz*W3D_TO; }
  const seat=watch.win, mine=w3d.myTrain;
  if(mine){ mine.visible=!seat&&!!P3&&st.mode==='ride'; if(P3&&mine.visible){ const tr=w3d.trains.find(o=>o.L===st.L); if(tr&&mine.geometry!==tr.geo) mine.geometry=tr.geo; w3dSetCars(mine,0,st.L,u3,sg); mine.instanceMatrix.needsUpdate=true; } }
  let cp, ct, kp, kt; const sw=st.speed?Math.sin(performance.now()/260)*0.00025:0;
  if(seat&&st.mode==='ride'){ cp=[x+nx*0.0075+hx*0.01,yT+0.017+sw,z+nz*0.0075+hz*0.01]; ct=[x+nx*1+hx*0.22,yT+0.017-(under?0.02:0.13),z+nz*1+hz*0.22]; kp=kt=12; }   /* at the window: looking out and a little down, as you do from a viaduct */
  else if(seat){ cp=[x+nx*(DECK+0.02),yT+0.017,z+nz*(DECK+0.02)]; ct=[x-nx*1+hx*0.35,yT+0.01,z-nz*1+hz*0.35]; kp=kt=6; }   // on the platform, facing the tracks
  else {
    /* The following camera flies like a small drone chasing the train, and it looks where it is going. Each frame it
       weighs a handful of places it could be, from well left of the line to well right: for each, how high it would
       have to fly to clear everything on the way ahead (buildings, stations, viaducts, airport buildings, hills) and
       to keep the train in sight. It takes the one that lets it stay low, which is the street or the gap between
       two blocks, not the roof; it only climbs when there is no way through, and starts in good time because it
       looks more than a block ahead. Where it flies and how high are both carried by soft springs, it drifts gently
       up and down on its own, and when the train stands at a platform it all but hovers. */
    const C=w3d.cc||(w3d.cc={t:Math.random()*50,slow:0,ug:0,s:0.15}); C.slow+=((st.speed>0.02?0:1)-C.slow)*Math.min(1,dt*0.7); C.t+=dt*(1-0.8*C.slow); C.ug+=((yT<0.02?1:0)-C.ug)*Math.min(1,dt*1.2);
    const calm=1-0.85*C.slow, back=lerp(0.5+0.08*Math.sin(C.t*0.17+2),0.42,C.slow), sPref=(0.2*Math.sin(C.t*0.26)+0.07*Math.sin(C.t*0.11+1.3))*calm*(1-0.5*C.ug);
    const base=Math.max(yT,0)+lerp(0.075+0.045*(0.5+0.5*Math.sin(C.t*0.19+0.5))*calm+0.02*Math.sin(C.t*0.47)*calm,0.3,C.ug), ty=Math.max(yT,-0.02)+0.012, top=(px,pz)=>Math.max(w3dHgt(px,pz),w3dHt(px,pz));
    // Its place is on the track the train has just run over, a set distance back, not straight behind the train's nose:
    // through a curve it follows the curve at the train's own pace instead of being swung round like a tail.
    const slot=(sv,d)=>{ if(!P3) return [x-hx*(back-d)+nx*sv,z-hz*(back-d)+nz*sv,hx,hz]; const uu=clamp(u3+sg*(d-back),0,len3), p=polyAt(P3.pts,P3.cum,uu), h=polyHead(P3.pts,P3.cum,uu,0.25), ax=h[0]*sg, az=h[1]*sg, o=sv+W3D_TO; return [p[0]-az*o,p[1]+ax*o,ax,az]; };
    // how high a place s to the side of the line would have to be flown, now and for the next block and a half
    const needAt=sv=>{ let nd=base, w0=null;
      for(const d of [-0.12,0,0.15,0.32,0.5,0.75,1.0,1.3,1.6]){ const q=slot(sv,d); if(d===0) w0=q; for(const e of [-0.06,0,0.06]){ const g=top(q[0]-q[3]*e,q[1]+q[2]*e); if(g>0&&g+0.035>nd) nd=g+0.035; } }
      // a mountain is seen coming from further off than a building: it starts to climb (or picks a way round) in good time
      for(const d of [2.2,3,4,5.2]){ const q=slot(sv,d), gh=w3dHt(q[0],q[1]); if(gh<0.4) continue; const g=gh+0.06-(d-1.6)*0.22; if(g>nd) nd=g; }
      if(C.ug<0.5||inHill) for(let q=4;q<=9;q++){ const f=q/10, g=top(x+(w0[0]-x)*f,z+(w0[1]-z)*f); if(g>0){ const yn=ty+(g+0.02-ty)/f; if(yn>nd) nd=yn; } }
      return Math.min(nd,2.2); };
    let bestS=C.s, bestC=1e9, bestN=base; const lanes=[-0.46,-0.32,-0.2,-0.1,0,0.1,0.2,0.32,0.46]; if(w3dHt(x+hx*2,z+hz*2)>0.5||w3dHt(x+hx*4,z+hz*4)>0.5||w3dHt(x,z)>0.5) lanes.push(-1.6,-1.1,-0.75,0.75,1.1,1.6);      /* in the hills it may swing much wider, round a shoulder of the mountain */
    for(const sv of lanes){ const nd=needAt(sv), cost=(nd-base)*4+Math.abs(sv-sPref)*0.5+Math.abs(sv-(C.sT==null?C.s:C.sT))*1.1;      /* it changes its place across the line only for a clear gain */ if(cost<bestC){ bestC=cost; bestS=sv; bestN=nd; } }
    C.sT=bestS; const sl=slot(C.s,0), wx=sl[0], wz=sl[1], need=Math.max(bestN,needAt(C.s));      /* on the way across to the chosen place it clears what is under it now */
    if(!C.p||dist(C.p[0],C.p[2],wx,wz)>2){ C.s=bestS; C.sv=0; const q=slot(bestS,0); C.p=[q[0],need,q[1]]; C.v=[0,0,0]; C.hd=Math.atan2(q[3],q[2]); C.roll=0; }
    // soft springs all round: it drifts across the line, trails the train with a little give, rises a touch quicker than it sinks; a firm push only if it actually touches something
    { const ks=0.45, as=ks*(C.sT-C.s)-2*Math.sqrt(ks)*(C.sv||0); C.sv=(C.sv||0)+as*dt; C.s+=C.sv*dt;
      const sp=(i,tg,k)=>{ const a=k*(tg-C.p[i])-2*Math.sqrt(k)*C.v[i]; C.v[i]+=a*dt; C.p[i]+=C.v[i]*dt; }; sp(0,wx,3.6); sp(2,wz,3.6);
      const hit=top(C.p[0],C.p[2])+0.012; sp(1,need,C.p[1]<hit?24:need>C.p[1]?1.5:0.8); if(C.p[1]<hit-0.02) C.p[1]=hit-0.02;
      // and never, whatever else, inside the ground: the camera is always a clear margin above the hillside under it
      { const gr=w3dHt(C.p[0],C.p[2])+0.04; if(C.p[1]<gr){ C.p[1]=gr; if(C.v[1]<0) C.v[1]=0; } } }
    cp=C.p.slice(); ct=[x+hx*0.16,ty,z+hz*0.16]; kp=60; kt=3.2;
    // banking: it leans into a turn as far as the turn is tight and its speed is high, and into each move across the line
    { const hd=Math.atan2(sl[3],sl[2]); let dh=hd-(C.hd==null?hd:C.hd); dh=Math.atan2(Math.sin(dh),Math.cos(dh)); C.hd=hd; const rate=dt>0?dh/dt:0; C.yr=(C.yr||0)+(clamp(rate,-1.5,1.5)-(C.yr||0))*Math.min(1,dt*2.5);
      C.roll=(C.roll||0)+(clamp(C.yr*0.55+(C.sv||0)*1.6,-0.32,0.32)-(C.roll||0))*Math.min(1,dt*2.2); } }
  const snap=!w3d.camPos||dist(w3d.camPos[0],w3d.camPos[2],cp[0],cp[2])>1.8, a1=snap?1:1-Math.exp(-dt*kp), a2=snap?1:1-Math.exp(-dt*kt);
  w3d.camPos=w3d.camPos&&!snap?w3d.camPos.map((v,i)=>v+(cp[i]-v)*a1):cp; w3d.camTgt=w3d.camTgt&&!snap?w3d.camTgt.map((v,i)=>v+(ct[i]-v)*a2):ct;
  if(!seat){ const gr=w3dHt(w3d.camPos[0],w3d.camPos[2])+0.03; if(w3d.camPos[1]<gr) w3d.camPos[1]=gr; }
  // Depth is measured most finely near the camera's near plane. At the window seat things pass within a few metres, so it must be close;
  // from the air nothing is nearer than a few tens of metres, and pushing it out is what stops distant surfaces that lie close together from flickering.
  { const nr=seat?0.004:0.02; if(w3d.cam3.near!==nr){ w3d.cam3.near=nr; w3d.cam3.updateProjectionMatrix(); } }
  w3d.cam3.position.set(...w3d.camPos); w3d.cam3.lookAt(...w3d.camTgt); if(!seat&&w3d.cc&&w3d.cc.roll) w3d.cam3.rotateZ(-w3d.cc.roll); if(w3d.sky){ w3d.sky.position.copy(w3d.cam3.position); w3d.sky.material.uniforms.uT.value=performance.now()/1000; } if(w3d.watM) w3d.watM.userData.uT.value=performance.now()/1000%4000;
  // how strongly the underground shows through (see w3dRender): on while the watched train is below ground and seen from outside, fading in and out
  { w3d.seeOn=!seat&&!!P3&&(inHill||(yT<0?true:yT>0.03?false:!!w3d.seeOn)); w3d.seeW=clamp((w3d.seeW||0)+(w3d.seeOn?1:-1)*dt*2.5,0,1); w3d.seeAt=P3?[x,yT,z,u3,sg,P3,len3]:null; }
  w3dTod(dt);
  // the sun: its shadow map follows the viewer in whole-texel steps, so shadow edges stay still instead of crawling
  { const sx=x+nx*0.6, sz=z+nz*0.6, D=[-8,14,10], ts=2*W3D_SH/w3d.sun.shadow.mapSize.x, r=[D[2],0,-D[0]], rl=Math.hypot(r[0],r[2]), rx=r[0]/rl, rz=r[2]/rl, dl=Math.hypot(...D), ux=-rz*D[1]/dl, uy=(rz*D[0]-rx*D[2])/dl, uz=rx*D[1]/dl;
    const pa=sx*rx+sz*rz, pb=sx*ux+sz*uz, da=Math.round(pa/ts)*ts-pa, db=Math.round(pb/ts)*ts-pb, tx=sx+da*rx+db*ux, ty=db*uy, tz=sz+da*rz+db*uz;
    w3d.sun.target.position.set(tx,ty,tz); w3d.sun.position.set(tx+D[0],ty+D[1],tz+D[2]); }
  // keep it smooth: if frames run long the picture is drawn at a slightly lower resolution (and shadows every other frame), and back up when there is room
  { const ms=dt*1000, A=w3d.ad||(w3d.ad={e:16,n:0,f:0}); A.e+=(Math.min(ms,100)-A.e)*0.05; A.n++; A.f++;
    if(A.n>50&&A.e>23&&w3d.pr>0.75){ w3d.pr=Math.max(0.75,w3d.pr-0.25); R.setPixelRatio(w3d.pr); A.n=0; }
    else if(A.n>300&&A.e<12.5&&w3d.pr<w3d.prMax){ w3d.pr=Math.min(w3d.prMax,w3d.pr+0.25); R.setPixelRatio(w3d.pr); A.n=0; }
    R.shadowMap.autoUpdate=false; R.shadowMap.needsUpdate=A.e<21||(A.f&1)===0; }
  w3dRender(); w3dEmpty(); w3dLabels(); }
// Where the watched train is along its line's 3D track. The ride knows which two stops it is between and how far along;
// that maps straight onto the track, so the position can only move forward (searching for the nearest piece of track
// jumped back and forth wherever the line bends close to itself or is drawn aside into a station).
function w3dRideU(st){ const L=st.L, P=L&&L._p3; if(!P||!P.sU) return null; const n=L.stops.length;
  if(st.mode==='ride'&&st.q&&st.q.L===L){ const q=st.q, S=q.stopU; let j=0; while(j<S.length-2&&st.u>S[j+1]) j++; const a=q.ks[j], b=q.ks[j+1]; let ua, ub;
    if(L.loop){ if(b===(a+1)%n){ ua=P.sU[a]; ub=P.sU[a+1]; } else if(a===(b+1)%n){ ua=P.sU[b+1]; ub=P.sU[b]; } else return null; } else { ua=P.sU[a]; ub=P.sU[b]; }
    if(ua==null||ub==null) return null; const f=clamp((st.u-S[j])/((S[j+1]-S[j])||1),0,1); return {u:ua+(ub-ua)*f,sg:ub>=ua?1:-1}; }
  const k=st.st?L.stops.indexOf(st.st.id):-1; return k<0||P.sU[k]==null?null:{u:P.sU[k],sg:w3d.lastSg||1}; }
// is this point on a street (within m of its edge)?
function w3dOnRoad(x,z,m){ const R=G.rn; if(!R) return false; const h=rnNearEdge(R,x,z,0.16+(m||0)); return !!h&&h.d<ROAD_W[R.ec[h.e]]/2+(m||0); }
// how high the buildings stand at a point near the viewer (0 where there are none): a coarse grid filled when the surroundings are built
function w3dHgt(x,z){ const g=w3d.hg; if(!g) return 0; const i=Math.floor((x-g.x0)*g.res), j=Math.floor((z-g.y0)*g.res); return i<0||j<0||i>=g.n||j>=g.n?0:g.a[j*g.n+i]; }
// station names over the nearest platforms
function w3dLabels(){
  const T=w3d.T, box=$('#cv3d'), v=new T.Vector3(), cp=w3d.cam3.position, near=(w3d.usedV===netVersion?w3d.used:(w3d.usedV=netVersion,w3d.used=stations.filter(s=>lines.some(L=>L.stops.length>=2&&L.stops.includes(s.id))))).map(s=>({s,d:dist(s.x,s.y,cp.x,cp.z)})).filter(o=>o.d<4).sort((a,b)=>a.d-b.d).slice(0,6);
  while(w3d.labels.length<near.length){ const el=document.createElement('div'); el.className='lbl'; box.appendChild(el); w3d.labels.push({el}); }
  w3d.labels.forEach((l,i)=>{ const o=near[i]; if(!o){ l.el.style.display='none'; return; } { const sy=w3d.stY&&w3d.stY.get(o.s.id); v.set(o.s.x,sy!=null&&sy<0?(w3d.cam3.position.y<0?sy+0.04:0.045):TRK+0.06,o.s.y).project(w3d.cam3); } if(v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1){ l.el.style.display='none'; return; }
    const L=lines.find(q=>q.stops.length>=2&&q.stops.includes(o.s.id)); l.el.style.display=''; l.el.style.left=((v.x+1)/2*box.clientWidth)+'px'; l.el.style.top=((1-v.y)/2*box.clientHeight)+'px';
    const txt=nm(o.s.name); if(l.el.textContent!==txt) l.el.textContent=txt; l.el.style.setProperty('--c',L?lineColor(L):'#888'); }); }
