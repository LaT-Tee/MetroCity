/* Commissions: the city asks for a station where something is going up.
   The demand map and the assistant already say which journeys want a line; a commission is about a place instead.
   When a development breaks ground (a stadium, a science park, a resort...) the city asks for the metro to be there by
   the time it has been open a year; before any of those, it asks for the railway station, the coach station and the
   airport to be connected. One at a time. A station within walking distance (PET_R cells) on a working line answers
   it: a celebration, and the place draws more people and jobs than it would have. Unanswered, it lapses. */
const PET_R=2.2, PET_FAC=36;
let petition=null, petLog={won:0,lost:0,last:-9,past:[]};
Object.assign(T.zh,{petTitle:'城市委托',petBuild:'<b>{a}</b> 正在建设，{m} 个月后开业。',petOpen:'<b>{a}</b> 已经开业，还没有通地铁。',petFac:'<b>{a}</b> 还没有通地铁。',petGoal:'在它旁边设一座地铁站',petDist:'最近的车站还差 {d} km',petLeft:'还剩 {y}',petYears:'{y} 年 {m} 个月',petMonths:'{m} 个月',petShow:'去看看',petNew:'新委托：把地铁修到{a}',petWon:'{a}通地铁了！周边更热闹了',petLost:'委托过期：{a}还是没通地铁',petCount:'已完成 {n} 项'});
Object.assign(T.en,{petTitle:'Commission',petBuild:'<b>{a}</b> is under construction and opens in {m} months.',petOpen:'<b>{a}</b> is open, with no metro yet.',petFac:'<b>{a}</b> has no metro yet.',petGoal:'Put a metro station next to it',petDist:'nearest station {d} km short',petLeft:'{y} left',petYears:'{y} y {m} mo',petMonths:'{m} mo',petShow:'Show me',petNew:'New commission: bring the metro to {a}',petWon:'{a} is on the metro! The area is busier for it',petLost:'Commission lapsed: {a} still has no metro',petCount:'{n} done'});
Object.assign(T.ja,{petTitle:'市からの依頼',petBuild:'<b>{a}</b> は建設中、{m} か月後に開業。',petOpen:'<b>{a}</b> は開業済み、まだ地下鉄がありません。',petFac:'<b>{a}</b> にはまだ地下鉄がありません。',petGoal:'すぐそばに地下鉄の駅を',petDist:'最寄り駅まであと {d} km',petLeft:'残り {y}',petYears:'{y} 年 {m} か月',petMonths:'{m} か月',petShow:'見に行く',petNew:'新しい依頼：{a} に地下鉄を',petWon:'{a} に地下鉄が開通！周辺がにぎわいます',petLost:'依頼は期限切れ：{a} にはまだ地下鉄がありません',petCount:'達成 {n} 件'});
// how far the nearest station on a working line is from a point
function petNearest(x,y){ let bd=1e9, bs=null; const on=new Set(); for(const L of lines) if(L.stops.length>=2) for(const id of L.stops) on.add(id); for(const st of stations){ if(!on.has(st.id)) continue; const d=dist(st.x,st.y,x,y); if(d<bd){ bd=d; bs=st; } } return {d:bd,st:bs}; }
function petCandidates(){ const out=[], B=G.bounds, inside=(x,y)=>x>B[0]+2&&x<B[2]-2&&y>B[1]+2&&y<B[3]-2, add=(key,x,y,name,due,proj)=>{ if(inside(x,y)&&!petLog.past.includes(key)&&petNearest(x,y).d>PET_R) out.push({key,x,y,name,m0:months,due,proj}); };
  (G.projects||[]).forEach((p,i)=>{ if(months-p.m0<PROJ_BUILD+6) add('p'+i+':'+p.t,p.x,p.y,projName(p),p.m0+PROJ_BUILD+12,i); });
  if(out.length) return out;
  add('f:rail',G.fac.station.x,G.fac.station.y,{k:'rail'},months+PET_FAC); add('f:coach',G.fac.coach.x,G.fac.coach.y,{k:'coach'},months+PET_FAC); add('f:air',G.fac.airport.term.x,G.fac.airport.term.y,{k:'airport'},months+PET_FAC);
  (G.fac2||[]).forEach((f,i)=>{ const q=facPoint(f); add('f2:'+i+':'+f.t,q.x,q.y,facName(f),months+PET_FAC); });
  return out.slice(0,1); }
// checked after every change to the network and once a month: returns what happened, if anything did
function petitionCheck(monthly){ if(!G||!G.fac) return null;
  if(petition&&!petition.key) petition=null;                      // an older save's petition
  if(petition){ const p=petition, nr=petNearest(p.x,p.y); p.d=nr.d; let ev=null; if(nr.d<=PET_R) ev='won'; else if(monthly&&months>=p.due) ev='lost';
    if(ev){ petition=null; petLog.last=months; petLog.past.push(p.key); if(ev==='won'){ petLog.won++; boostJobs(p.x,p.y,0.15,true); } else petLog.lost++; return {type:ev,p}; } return null; }
  if(monthly&&months>=2&&months-petLog.last>=3&&activeLineCount()>=1){ const c=petCandidates(); if(c.length){ petition=c[0]; petition.d=petNearest(c[0].x,c[0].y).d; return {type:'new',p:petition}; } }
  return null; }
