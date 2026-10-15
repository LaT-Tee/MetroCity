const $=s=>document.querySelector(s);
const cvs=$('#map'), mainCtx=cvs.getContext('2d'); let ctx=mainCtx;
let base=document.createElement('canvas'), bctx=base.getContext('2d'), base2=document.createElement('canvas'), b2ctx=base2.getContext('2d'), baseFadeAt=0, heatPrev=null, heatSpare=null, heatFadeAt=0, urbCanvas=null, urbPrev=null, urbSpare=null;
let stCache={v:-1}, drawEMA=8, frameN=0, lastInteract=0;
let sceneLo=null, sceneUp=null, loKey='', upKey='', prevLoKey='', prevUpKey='', layerVer=0, jobs=[];
let dpr=1, vw=0, vh=0, cam={x:W/2,y:H/2,s:4}, C={}, P2={}, heatCanvas=null, heatMode='pop', commuteCanvas=null, flashCanvas=null, flashAt=0, pendingImpact=null, focus=null, camAnim=null, suggKey='';
let tool='pan', paused=false, speedMul=1, lastTs=0, trainT=0, growthAcc=0, baseJob=null;
let hover=null, hoverWorld=null, simTimer=null, uiShown={avg:0,share:0,cover:0,riders:0,eff:40};
let stroke=null, forceNew=false, touchMode=window.matchMedia('(pointer: coarse)').matches, tipTimer=null;
const FONT=()=>LANG==='ja'?'"Noto Sans JP","Hiragino Sans",sans-serif':'"Noto Sans SC","PingFang SC",sans-serif';

function readColors(){
  const cs=getComputedStyle(document.documentElement), v=k=>cs.getPropertyValue('--'+k).trim();
  const keys=['sea','sea-shallow','land','urban','park','forest','hill','street','arterial','arterial-edge','highway','rail','runway','ink','ink-2','ink-3','halo','accent','card-solid','bad','good','warn'];
  const o={}; keys.forEach(k=>o[k]=v(k));
  const tmp=document.createElement('canvas').getContext('2d');
  o.rgb=k=>{ tmp.fillStyle='#000'; tmp.fillStyle=o[k]; const s=tmp.fillStyle; if(s[0]==='#') return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)]; const m=s.match(/[\d.]+/g); return [+m[0],+m[1],+m[2]]; };
  return o;
}
