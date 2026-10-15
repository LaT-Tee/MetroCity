/* ---------- camera ---------- */
function resize(){ dpr=Math.min(2,window.devicePixelRatio||1); vw=cvs.clientWidth; vh=cvs.clientHeight; cvs.width=Math.round(vw*dpr); cvs.height=Math.round(vh*dpr); }
function fit(){ const M=G.centers[0]; if(vw<760){ cam.s=Math.max(vw/W*1.6,vh/H*1.1); cam.x=M.x; cam.y=M.y+8; } else { cam.s=Math.max(vw/W,vh/H)*1.35; cam.x=M.x+8; cam.y=M.y; } clampCam(); }
function minS(){ const B=G?G.bounds:[0,0,W,H]; return Math.min(vw/(B[2]-B[0]),vh/(B[3]-B[1]))*0.8; }
function clampCam(){ const B=G?G.bounds:[0,0,W,H]; cam.s=clamp(cam.s,minS(),28); cam.x=clamp(cam.x,B[0],B[2]); cam.y=clamp(cam.y,B[1],B[3]); }
const toWorld=(sx,sy)=>[(sx-vw/2)/cam.s+cam.x,(sy-vh/2)/cam.s+cam.y];
const toScreen=(x,y)=>[(x-cam.x)*cam.s+vw/2,(y-cam.y)*cam.s+vh/2];
function worldT(){ ctx.setTransform(dpr*cam.s,0,0,dpr*cam.s,dpr*(vw/2-cam.x*cam.s),dpr*(vh/2-cam.y*cam.s)); }
function screenT(){ ctx.setTransform(dpr,0,0,dpr,0,0); }
const isLand=(x,y)=>{ const xi=Math.round(x), yi=Math.round(y); return inB(x,y,1)&&G.water[yi*W+xi]===0; };
const whyNot=(x,y)=>inB(x,y,1)?t('toastWater'):t('locked');
