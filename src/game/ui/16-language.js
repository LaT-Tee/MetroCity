/* ---------- language ---------- */
function setLang(l){
  LANG=T[l]?l:'zh'; document.documentElement.lang=LANG==='zh'?'zh-CN':LANG;
  try{ localStorage.setItem('mc-lang',LANG); }catch(e){}
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
  document.querySelectorAll('#langs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===LANG));
  const tips={pan:'browse',build:'build',erase:'erase'}; document.querySelectorAll('.tool[data-tool]').forEach(b=>b.title=t(tips[b.dataset.tool])+' ('+({pan:1,build:2,erase:3})[b.dataset.tool]+')');
  $('#undoBtn').title=t('undo')+' (Ctrl+Z)'; $('#redoBtn').title=t('redo')+' (Ctrl+Y)'; $('#assistBtn').title=t('assistTitle')+' (A)'; if(G&&typeof renderAssist==='function') renderAssist();
  applyTouchTexts();
  if(G){ refreshSign(); updatePop(); renderLines(); updateMetrics(); updateBuildHint(); renderSuggestions(); updateLevel(); updateAchBtn(); if(!$('#report').hidden) openReport(); if(!$('#achModal').hidden) openAch(); }
  if(typeof setSound==='function') setSound(soundOn);
  updateLegend();
  if(!sim) $('#mNote').innerHTML=t('noteNone');
  placeHelp();
}
function refreshSign(){
  $('#cityName').textContent=nm({k:'city'});
  const ro=cityRoman(LANG); $('#cityPinyin').textContent=(ro?ro+'   ':'')+'#'+G.seed; $('#cityPinyin').hidden=false;
}
