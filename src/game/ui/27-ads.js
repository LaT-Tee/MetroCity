/* The planning assistant is opened by watching an advertisement: about thirty seconds, for half an hour's use.
   The settings are in index.html (window.MC_ADS), so they can be changed without touching the game:
     enabled        false turns the whole thing off (the assistant is simply free)
     provider       'house'    a built-in thirty-second card of playing tips: a stand-in, so the flow can be tried with no ad account
                    'adsense'  Google's Ad Placement API for H5 games (rewarded ads); needs `client`
     client         the AdSense publisher id, 'ca-pub-…'
     seconds        length of the built-in card
     unlockMinutes  how long one viewing opens the assistant for
     test           true asks Google for test ads (never use real ads while developing)
   The reward is given only when the advertisement has been watched to the end (Google's `adViewed`), never for one that was
   closed early; and the player asks for each one: nothing plays by itself. If no advertisement is available the assistant is
   opened anyway, so nobody is locked out by an empty ad server. */
const AD=Object.assign({enabled:true,provider:'house',client:'',seconds:30,unlockMinutes:30,test:false},window.MC_ADS||{});
Object.assign(T.zh,{adTitle:'解锁规划助手',adBody:'看一段约 30 秒的广告，规划助手可以用 {m} 分钟。',adWatch:'看广告解锁',adCancel:'以后再说',adWait:'还有 {s} 秒',adDone:'规划助手已解锁 {m} 分钟',adNone:'暂时没有广告，这次直接解锁',adEarly:'广告没有看完，助手没有解锁',adExpired:'规划助手的解锁时间到了',adHouse:'广告位（示例）',adTips:['按住拖动就能画线，途中按空格放站。','新线穿过旧线的地方会自动变成换乘站。','切到"出行需求"热力图，看看谁最需要地铁。','城市委托按期完成，那一带会更繁荣。','按 V 进入观景模式，坐在窗边看你修的城。','两条线首尾相接、方向一致时，列车会直通运转。']});
Object.assign(T.en,{adTitle:'Unlock the planning assistant',adBody:'Watch an advertisement of about 30 seconds and the assistant is yours for {m} minutes.',adWatch:'Watch to unlock',adCancel:'Not now',adWait:'{s} s to go',adDone:'Assistant unlocked for {m} minutes',adNone:'No advertisement available: unlocked anyway',adEarly:'The advertisement was not watched to the end',adExpired:'The assistant’s time is up',adHouse:'Advertisement (placeholder)',adTips:['Drag to draw a line; press Space on the way to drop a station.','Where a new line crosses an old one, an interchange appears by itself.','Switch to the demand map to see who needs a metro most.','Answer a commission in time and that part of town does better.','Press V to ride along and watch the city you built from a window seat.','Two lines that meet end to end in the same direction run through trains.']});
Object.assign(T.ja,{adTitle:'計画アシスタントを解放',adBody:'約30秒の広告を見ると、アシスタントを {m} 分間使えます。',adWatch:'広告を見て解放',adCancel:'あとで',adWait:'あと {s} 秒',adDone:'アシスタントを {m} 分間解放しました',adNone:'広告がないため、今回はそのまま解放します',adEarly:'広告が最後まで再生されませんでした',adExpired:'アシスタントの利用時間が終わりました',adHouse:'広告枠（サンプル）',adTips:['ドラッグで線路を描き、途中でスペースを押すと駅になります。','新しい路線が既存の路線と交わる所は自動で乗換駅になります。','「移動需要」のヒートマップで、地下鉄を必要としている人を確認。','市からの依頼を期限内に達成すると、その地区が発展します。','V キーで眺めるモード。窓際の席から街を見られます。','端と端が同じ向きでつながる2路線は直通運転します。']});
let adUntil=0, adBusy=false, adHeld=0; try{ adUntil=+localStorage.getItem('mc-assist-until')||0; }catch(e){}
const adUnlocked=()=>!AD.enabled||Date.now()<adUntil;
function adGrant(){ adUntil=Date.now()+AD.unlockMinutes*60000; try{ localStorage.setItem('mc-assist-until',String(adUntil)); }catch(e){} }
// ---- Google's Ad Placement API, loaded only when it is the chosen provider
let adGoogle=null;
function adGoogleInit(){ if(adGoogle!==null||AD.provider!=='adsense'||!AD.client) return; adGoogle=false;
  const s=document.createElement('script'); s.async=true; s.crossOrigin='anonymous'; s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(AD.client); s.setAttribute('data-ad-frequency-hint','30s'); if(AD.test) s.setAttribute('data-adbreak-test','on');
  s.onload=()=>{ adGoogle=true; }; s.onerror=()=>{ adGoogle=false; }; document.head.appendChild(s);
  window.adsbygoogle=window.adsbygoogle||[]; window.adBreak=window.adConfig=function(o){ window.adsbygoogle.push(o); }; window.adConfig({preloadAdBreaks:'on',sound:'on'}); }
// loaded with the page (not at the first click): an advertisement can then be ready when it is asked for, and the site shows its ad code to the ad network's review
if(AD.enabled) (window.requestIdleCallback||(f=>setTimeout(f,1500)))(()=>adGoogleInit());
// ---- the gate
function adGate(done){ const m=$('#unlockModal'); if(adBusy&&m&&!m.hidden) return; adBusy=false; if(!m){ adGrant(); done(); return; } adGoogleInit();
  const wasPaused=paused, hold=()=>{ if(!paused){ togglePlay(); adHeld=performance.now(); } if(typeof musicStop==='function') musicStop(); }, release=()=>{ if(adHeld&&paused) togglePlay(); adHeld=0; if(typeof musicOn!=='undefined'&&musicOn&&typeof musicStart==='function') musicStart(); };
  const close=()=>{ m.hidden=true; adBusy=false; clearInterval(tick); release(); }, win=free=>{ adGrant(); close(); release(); toast(t(free?'adNone':'adDone',{m:AD.unlockMinutes})); done(); }; let tick=0;
  $('#ulGo').disabled=false;
  $('#ulTitle').textContent=t('ulTitle'); $('#ulBody').textContent=t('ulBody',{m:AD.unlockMinutes}); $('#ulGo').textContent=t('adWatch'); $('#ulNo').textContent=t('adCancel'); $('#ulStage').hidden=true; $('#ulRow').hidden=false; m.hidden=false;
  $('#ulNo').onclick=()=>{ close(); };
  // if the card cannot be seen (something on the page hides it), the assistant is opened rather than left behind a dead button
  if(!(m.offsetWidth||m.offsetHeight)){ adGrant(); close(); toast(t('adDone',{m:AD.unlockMinutes})); done(); return; }
  // the built-in card: tips, a bar filling up, no way to skip
  const house=()=>{ adBusy=true; hold(); const tips=t('adTips'), t0=performance.now(), bar=$('#ulBar'), tip=$('#ulTip'), left=$('#ulLeft'); $('#ulTag').textContent=t('adHouse'); $('#ulStage').hidden=false; $('#ulRow').hidden=true; let k=-1;
      const step=()=>{ const el=(performance.now()-t0)/1000, kk=Math.floor(el/6)%tips.length; if(kk!==k){ k=kk; tip.textContent=tips[k]; } bar.style.width=Math.min(100,el/AD.seconds*100)+'%'; left.textContent=t('adWait',{s:Math.max(0,Math.ceil(AD.seconds-el))}); if(el>=AD.seconds) win(false); }; step(); tick=setInterval(step,200); };
  /* Asking the ad network. It may answer with an advertisement, answer that it has none, or (an account still under review, a
     blocked request) not answer at all: after a few seconds of silence the built-in card is shown instead, and whatever the
     network says after that is ignored. Nothing here can leave the button dead. */
  $('#ulGo').onclick=()=>{ if(adBusy) return; const go=$('#ulGo');
    if(AD.provider==='adsense'&&adGoogle&&window.adBreak){ adBusy=true; go.disabled=true; go.textContent='…'; let seen=false, shown=false, over=false;
      const dog=setTimeout(()=>{ if(shown||over) return; over=true; adBusy=false; go.disabled=false; house(); },4000), end=fn=>{ if(over) return; over=true; clearTimeout(dog); go.disabled=false; fn(); };
      try{ window.adBreak({type:'reward',name:'assistant',beforeAd:()=>{ if(!over) hold(); },afterAd:()=>{ if(shown) release(); },beforeReward:show=>{ if(over) return; shown=true; clearTimeout(dog); m.hidden=true; show(); },adViewed:()=>{ seen=true; },adDismissed:()=>{},
        adBreakDone:()=>end(()=>{ if(seen) win(false); else if(!shown){ adBusy=false; house(); } else { close(); release(); toast(t('adEarly')); } })}); }
      catch(e){ end(()=>{ adBusy=false; house(); }); } }
    else house(); }; }
// the assistant closes again when its time is up
setInterval(()=>{ if(typeof assistOn!=='undefined'&&assistOn&&!adUnlocked()){ setAssist(false,true); toast(t('adExpired')); } },15000);
// a safety net: the game is never left paused by an advertisement that did not report back
setInterval(()=>{ if(adHeld&&performance.now()-adHeld>90000){ adHeld=0; if(paused) togglePlay(); const m=$('#unlockModal'); if(m) m.hidden=true; adBusy=false; } },5000);
