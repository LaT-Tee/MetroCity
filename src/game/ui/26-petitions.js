// ---- commissions: the card under the city sign, the place marked on the map, the fanfare when one is answered
let petNetSeen=-1;
function petEvent(ev){ if(!ev) return; const p=ev.p, v={a:nm(p.name)}, now=performance.now();
  if(ev.type==='new'){ toast(t('petNew',v)); SFX.up(); floats.push({x:p.x,y:p.y,txt:'★',t0:now,big:true}); }
  else if(ev.type==='won'){ toast(t('petWon',v)); SFX.level(); burst(110,vw/2,vh*0.3,2.2); floats.push({x:p.x,y:p.y,txt:'✓ '+nm(p.name),t0:now,big:true}); }
  else toast(t('petLost',v));
  petCard(); persistSoon(); }
function petCard(){ const el=$('#petCard'); if(!el) return; const p=petition&&petition.key?petition:null; el.hidden=!p; if(!p) return; const left=Math.max(0,p.due-months), pj=p.proj!=null&&G.projects?G.projects[p.proj]:null, toOpen=pj?pj.m0+PROJ_BUILD-months:0, d=isFinite(p.d)?p.d:60;
  el.querySelector('.pet-h').textContent=t('petTitle')+(petLog.won?' · '+t('petCount',{n:petLog.won}):'');
  el.querySelector('.pet-b').innerHTML=(pj?(toOpen>0?t('petBuild',{a:nm(p.name),m:toOpen}):t('petOpen',{a:nm(p.name)})):t('petFac',{a:nm(p.name)}))+' '+t('petGoal')+(d<50?' · '+t('petDist',{d:(Math.max(0,d-PET_R)*CELL_KM).toFixed(1)}):'');
  el.querySelector('.pet-g').textContent=t('petLeft',{y:left>=12?t('petYears',{y:Math.floor(left/12),m:left%12}):t('petMonths',{m:left})});
  el.querySelector('.pet-bar i').style.width=Math.round(clamp(1-(d-PET_R)/25,0.04,1)*100)+'%'; el.querySelector('.pet-btn').textContent=t('petShow'); }
function petShow(){ const p=petition; if(!p) return; const nr=petNearest(p.x,p.y), far=nr.st&&nr.d<60; cam.x=far?(p.x+nr.st.x)/2:p.x; cam.y=far?(p.y+nr.st.y)/2:p.y; cam.s=Math.min(vw,vh)/((far?nr.d:10)+16)*0.8; clampCam(); }
// on the map: a ring round the place showing how near a station must be, and a dashed line from the nearest station there is
function drawPetition(){ if(netVersion!==petNetSeen){ petNetSeen=netVersion; petEvent(petitionCheck(false)); petCard(); }
  const p=petition; if(!p||!p.key) return; const px=1/cam.s, tt=performance.now()/1000, col='#e0457b', nr=petNearest(p.x,p.y);
  ctx.save(); ctx.lineCap='round';
  if(nr.st&&nr.d<70){ ctx.beginPath(); ctx.moveTo(nr.st.x,nr.st.y); ctx.lineTo(p.x,p.y); ctx.strokeStyle=C.halo; ctx.globalAlpha=0.8; ctx.lineWidth=5*px; ctx.stroke(); ctx.strokeStyle=col; ctx.globalAlpha=0.9; ctx.lineWidth=2.5*px; ctx.setLineDash([6*px,7*px]); ctx.lineDashOffset=-tt*14*px; ctx.stroke(); ctx.setLineDash([]); }
  ctx.beginPath(); ctx.arc(p.x,p.y,PET_R,0,6.283); ctx.fillStyle=col; ctx.globalAlpha=0.10+0.05*Math.sin(tt*3); ctx.fill(); ctx.globalAlpha=0.9; ctx.strokeStyle=col; ctx.lineWidth=2.5*px; ctx.setLineDash([5*px,5*px]); ctx.lineDashOffset=tt*10*px; ctx.stroke(); ctx.setLineDash([]);
  ctx.restore(); ctx.globalAlpha=1; }
