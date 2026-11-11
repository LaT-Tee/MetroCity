/* ---------- background music: written as it is played ----------
   A slow, quiet piece that never repeats exactly. Four chords go round (a different order for every city), each held for
   two bars: a soft pad of detuned sines holds the chord, a bass note marks each bar, and a bell-like voice picks notes
   of the chord and its scale on a loose grid, more of them when the last few were sparse. Everything runs through a
   pair of feeding-back delays for space. It costs a dozen oscillators at most, is scheduled a little ahead of time
   from a timer, starts with the first click or key (browsers allow sound no earlier) and has its own switch. */
let musicOn=true, MU=null; try{ const v=localStorage.getItem('mc-music'); if(v!=null) musicOn=v==='1'; }catch(e){}
const MU_SCALE=[0,2,4,7,9], MU_PROG=[[0,9,5,7],[5,0,7,9],[0,4,5,2],[9,5,0,7],[0,5,9,7]];      // major pentatonic; chord roots in semitones above the key
function musicStart(){
  const ac=audio(); if(!ac||MU||!musicOn) return; if(ac.state==='suspended') ac.resume();
  const out=ac.createGain(); out.gain.value=0; out.connect(ac.destination); out.gain.linearRampToValueAtTime(0.42,ac.currentTime+4);
  const bus=ac.createGain(), wet=ac.createGain(), d1=ac.createDelay(1), d2=ac.createDelay(1), f1=ac.createGain(), f2=ac.createGain(), lp=ac.createBiquadFilter();
  wet.gain.value=0.5; d1.delayTime.value=0.37; d2.delayTime.value=0.53; f1.gain.value=0.4; f2.gain.value=0.36; lp.type='lowpass'; lp.frequency.value=1800;
  bus.connect(out); bus.connect(wet); wet.connect(d1); wet.connect(d2); d1.connect(f1); d2.connect(f2); f1.connect(lp); f2.connect(lp); lp.connect(d1); lp.connect(d2); d1.connect(out); d2.connect(out);
  const seed=(G&&G.seed)||1, R=mulberry32(seed*97+11), key=[48,50,53,55,45][Math.floor(R()*5)], prog=MU_PROG[Math.floor(R()*MU_PROG.length)], beat=60/(60+Math.floor(R()*10)), hz=n=>440*Math.pow(2,(n-69)/12);
  const voice=(type,f,t,a,d,g,det)=>{ const o=ac.createOscillator(), v=ac.createGain(); o.type=type; o.frequency.value=f; if(det) o.detune.value=det; v.gain.setValueAtTime(0.0001,t); v.gain.linearRampToValueAtTime(g,t+a); v.gain.exponentialRampToValueAtTime(0.0001,t+a+d); o.connect(v); v.connect(bus); o.start(t); o.stop(t+a+d+0.05); };
  MU={out,step:0,t:ac.currentTime+0.3,last:0,sparse:0,
    tick(){ if(!MU) return; const now=ac.currentTime; if(MU.t<now) MU.t=now+0.1;
      while(MU.t<now+0.7){ const st=MU.step, bar=Math.floor(st/8), ch=prog[Math.floor(bar/2)%4], root=key+ch, minor=ch===9||ch===2||ch===4, tri=[0,minor?3:4,7,minor?10:11], t=MU.t;
        if(st%16===0) for(const [iv,oc] of [[0,0],[2,0],[1,12],[3,12]]){ voice('sine',hz(root+tri[iv]+oc+12),t,2.2,beat*8-1.5,0.028,-5); voice('sine',hz(root+tri[iv]+oc+12),t,2.6,beat*8-1.8,0.022,6); }       // the pad
        if(st%8===0) voice('sine',hz(root-12),t,0.04,beat*3.4,0.11);                                                                                                                                         // the bass
        const p=(st%2===0?0.34:0.12)+MU.sparse*0.08; if(Math.random()<p){ MU.sparse=0; const pool=Math.random()<0.7?tri.map(v=>root+v):MU_SCALE.map(v=>key+v), n=pool[Math.floor(Math.random()*pool.length)]+12*(1+Math.floor(Math.random()*2)), near=Math.abs(n-MU.last)>9&&MU.last?n-12*Math.sign(n-MU.last):n;
          MU.last=near; voice('triangle',hz(near),t+Math.random()*0.02,0.012,1.6+Math.random()*1.2,0.05+Math.random()*0.03); if(Math.random()<0.25) voice('sine',hz(near+12),t+beat/2,0.012,1.2,0.022); } else MU.sparse++;
        MU.step++; MU.t+=beat/2; } }};
  MU.timer=setInterval(MU.tick,180); MU.tick();
}
function musicStop(){ if(!MU) return; const m=MU, ac=audio(); MU=null; clearInterval(m.timer); try{ m.out.gain.cancelScheduledValues(ac.currentTime); m.out.gain.setTargetAtTime(0,ac.currentTime,0.4); setTimeout(()=>{ try{ m.out.disconnect(); }catch(e){} },2500); }catch(e){} }
function setMusic(on){ musicOn=on; try{ localStorage.setItem('mc-music',on?'1':'0'); }catch(e){} const b=$('#musicBtn'); if(b){ b.setAttribute('aria-pressed',on); b.classList.toggle('off',!on); } if(on) musicStart(); else musicStop(); }
$('#musicBtn').addEventListener('click',()=>setMusic(!musicOn));
{ const first=()=>{ removeEventListener('pointerdown',first,true); removeEventListener('keydown',first,true); if(musicOn) musicStart(); }; addEventListener('pointerdown',first,true); addEventListener('keydown',first,true); setMusic(musicOn); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden) musicStop(); else if(musicOn) musicStart(); });
