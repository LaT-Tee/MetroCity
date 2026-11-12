/* Petitions: something to play for between the big milestones.
   Every so often the people of one district who all work in another, and who have no decent way to get there, ask for
   one: "connect us". The petition names the two places, how many people make the trip and how long it takes them, and
   asks for the metro to carry a given share of them within three years. Build the line and it is answered at once, with
   a celebration and a boost to the district they travel to. Leave it, and the petition lapses; or, as people who cannot
   stand a commute do, they move away, and the petition goes with them.
   The measure is taken from the commuters themselves (those living round one end and working round the other), so it
   follows what the player builds exactly. */
const PET_R=7, PET_GOAL=0.35, PET_MONTHS=36;
let petition=null, petLog={won:0,lost:0,last:-9,past:[]};
Object.assign(T.zh,{petTitle:'市民请愿',petBody:'<b>{a}</b> → <b>{b}</b>：每天 {n} 人通勤，平均 {m} 分钟。',petGoal:'让地铁承担这条走廊 {g}% 的出行',petLeft:'还剩 {y}',petYears:'{y} 年 {m} 个月',petMonths:'{m} 个月',petShow:'去看看',petNew:'新的请愿：{a} 的居民想坐地铁去 {b}',petWon:'请愿兑现：{a} 到 {b} 通地铁了！',petLost:'请愿过期：{a} 的居民还在路上堵着',petGone:'{a} 的居民等不及，搬走了',petCount:'已兑现 {n} 份'});
Object.assign(T.en,{petTitle:'Petition',petBody:'<b>{a}</b> → <b>{b}</b>: {n} people a day, {m} min on average.',petGoal:'Get the metro carrying {g}% of this corridor',petLeft:'{y} left',petYears:'{y} y {m} mo',petMonths:'{m} mo',petShow:'Show me',petNew:'New petition: {a} wants a metro to {b}',petWon:'Petition answered: {a} to {b} is on the metro!',petLost:'Petition lapsed: {a} is still stuck in traffic',petGone:'The people of {a} gave up waiting and moved away',petCount:'{n} answered'});
Object.assign(T.ja,{petTitle:'住民の請願',petBody:'<b>{a}</b> → <b>{b}</b>：1日 {n} 人、平均 {m} 分。',petGoal:'この区間の移動の {g}% を地下鉄で',petLeft:'残り {y}',petYears:'{y} 年 {m} か月',petMonths:'{m} か月',petShow:'見に行く',petNew:'新しい請願：{a} の住民が {b} への地下鉄を求めています',petWon:'請願達成：{a} から {b} へ地下鉄が通りました！',petLost:'請願は期限切れ：{a} の住民はまだ渋滞の中',petGone:'{a} の住民は待ちきれず引っ越しました',petCount:'達成 {n} 件'});
function petMeasure(p){ let n=0, sp=0, tt=0; for(const a of G.agents){ if(Math.abs(a.hx-p.x)>PET_R||Math.abs(a.hy-p.y)>PET_R||Math.abs(a.wx-p.x2)>PET_R||Math.abs(a.wy-p.y2)>PET_R) continue; if(dist(a.hx,a.hy,p.x,p.y)>PET_R||dist(a.wx,a.wy,p.x2,p.y2)>PET_R) continue; n++; sp+=a.p||0; tt+=a.t||0; } return {n,share:n?sp/n:0,t:n?tt/n:0}; }
function petPick(){ if(!sim||!sim.flows||!sim.flows.length) return null; const B=G.bounds, ok=(x,y)=>x>B[0]+2&&x<B[2]-2&&y>B[1]+2&&y<B[3]-2;
  const c=sim.flows.filter(f=>f.share<0.15&&dist(f.x,f.y,f.x2,f.y2)>9&&ok(f.x,f.y)&&ok(f.x2,f.y2)&&!petLog.past.some(q=>dist(q[0],q[1],f.x,f.y)<9&&dist(q[2],q[3],f.x2,f.y2)<9));
  for(const f of c.slice(0,6).sort(()=>Math.random()-0.5)){ const p={x:f.x,y:f.y,x2:f.x2,y2:f.y2,m0:months,due:months+PET_MONTHS,a:placeName(f.x,f.y),b:placeName(f.x2,f.y2)}, m=petMeasure(p); if(m.n<12||m.share>=PET_GOAL*0.5) continue;
    p.n0=m.n; p.t0=m.t; p.now=m; return p; } return null; }
// measured again (after every simulation, and monthly): returns what happened, if anything did
function petitionCheck(monthly){ if(!G||!G.agents) return null;
  if(petition){ const p=petition, m=p.now=petMeasure(p); let ev=null;
    if(m.n>=5&&m.share>=PET_GOAL) ev='won'; else if(monthly&&m.n<p.n0*0.4) ev='gone'; else if(monthly&&months>=p.due) ev='lost';
    if(ev){ petition=null; petLog.last=months; petLog.past.push([p.x,p.y,p.x2,p.y2]); if(petLog.past.length>12) petLog.past.shift(); if(ev==='won'){ petLog.won++; boostJobs(p.x2,p.y2,0.12,true); } else petLog.lost++; return {type:ev,p}; } return null; }
  if(monthly&&months>=4&&months-petLog.last>=5&&activeLineCount()>=1){ const p=petPick(); if(p){ petition=p; return {type:'new',p}; } }
  return null; }
