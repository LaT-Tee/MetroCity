// ---- petitions: the card under the city sign, the corridor marked on the map, the fanfare when one is answered
let petSimSeen=null;
function petEvent(ev){ if(!ev) return; const p=ev.p, v={a:nm(p.a),b:nm(p.b)}, now=performance.now();
  if(ev.type==='new'){ toast(t('petNew',v)); SFX.up(); floats.push({x:p.x,y:p.y,txt:'✉',t0:now,big:true}); }
  else if(ev.type==='won'){ toast(t('petWon',v)); SFX.level(); burst(110,vw/2,vh*0.3,2.2); floats.push({x:p.x2,y:p.y2,txt:'✓ '+nm(p.b),t0:now,big:true}); }
  else toast(t(ev.type==='gone'?'petGone':'petLost',v));
  petCard(); persistSoon(); }
function petCard(){ const el=$('#petCard'); if(!el) return; const p=petition; el.hidden=!p; if(!p) return; const m=p.now||{n:p.n0,share:0,t:p.t0}, left=Math.max(0,p.due-months), wP=G.popTotal*0.55/G.agents.length;
  el.querySelector('.pet-h').textContent=t('petTitle')+(petLog.won?' · '+t('petCount',{n:petLog.won}):'');
  el.querySelector('.pet-b').innerHTML=t('petBody',{a:nm(p.a),b:nm(p.b),n:fmtN(Math.round(m.n*wP)),m:Math.round(m.t||p.t0)});
  el.querySelector('.pet-g').textContent=t('petGoal',{g:Math.round(PET_GOAL*100)})+' · '+t('petLeft',{y:left>=12?t('petYears',{y:Math.floor(left/12),m:left%12}):t('petMonths',{m:left})});
  el.querySelector('.pet-bar i').style.width=Math.round(clamp(m.share/PET_GOAL,0,1)*100)+'%'; el.querySelector('.pet-btn').textContent=t('petShow'); }
function petShow(){ const p=petition; if(!p) return; cam.x=(p.x+p.x2)/2; cam.y=(p.y+p.y2)/2; cam.s=Math.min(vw,vh)/(dist(p.x,p.y,p.x2,p.y2)+18)*0.8; clampCam(); }
// on the map: a dashed arc from the homes to the jobs, marching towards them, a ring at each end
function drawPetition(){ if(sim!==petSimSeen){ petSimSeen=sim; petEvent(petitionCheck(false)); petCard(); }
  const p=petition; if(!p) return; const px=1/cam.s, tt=performance.now()/1000, mx=(p.x+p.x2)/2-(p.y2-p.y)*0.22, my=(p.y+p.y2)/2+(p.x2-p.x)*0.22, col='#e0457b';
  ctx.save(); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.quadraticCurveTo(mx,my,p.x2,p.y2);
  ctx.strokeStyle=C.halo; ctx.globalAlpha=0.8; ctx.lineWidth=5.5*px; ctx.stroke(); ctx.strokeStyle=col; ctx.globalAlpha=0.95; ctx.lineWidth=3*px; ctx.setLineDash([7*px,7*px]); ctx.lineDashOffset=-tt*16*px; ctx.stroke(); ctx.setLineDash([]);
  for(const [x,y,home] of [[p.x,p.y,1],[p.x2,p.y2,0]]){ const r=(7+Math.sin(tt*3+(home?0:1.5))*1.5)*px; ctx.beginPath(); ctx.arc(x,y,r,0,6.283); ctx.fillStyle=home?C.halo:col; ctx.globalAlpha=0.95; ctx.fill(); ctx.lineWidth=2.5*px; ctx.strokeStyle=col; ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,PET_R,0,6.283); ctx.globalAlpha=0.28; ctx.lineWidth=1.5*px; ctx.setLineDash([4*px,5*px]); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore(); ctx.globalAlpha=1; }
