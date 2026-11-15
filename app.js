const STATUSES = [
  { id:'hp', name:'HP', icon:'🛡️', color:'#e89fa2', actions:[['腕立て伏せをした',3],['スクワットをした',3],['筋トレを10分した',5],['ストレッチをした',2]] },
  { id:'attack', name:'こうげき', icon:'⚔️', color:'#f0bd70', actions:[['自分から人に話しかけた',3],['相手の話をよく聞いた',3],['感謝を言葉にした',2],['誰かを誘ってみた',5]] },
  { id:'defense', name:'ぼうぎょ', icon:'🛡️', color:'#8bbbe0', actions:[] },
  { id:'spattack', name:'とくこう', icon:'🪄', color:'#c5a2ed', actions:[['仕事に集中して取り組んだ',3],['大事なタスクをひとつ終えた',5],['新しいことを学んだ',3],['明日の段取りをした',2]] },
  { id:'spdefense', name:'とくぼう', icon:'🔮', color:'#78caba', actions:[] },
  { id:'speed', name:'すばやさ', icon:'👟', color:'#8bd4a6', actions:[['ご飯を我慢した',3],['体を動かした',3],['エレベーターより階段を選んだ',2],['食事を記録した',2]] },
];
const KEY='quest-log-save-v1';
let state=loadState(), activeStat=null, pendingAction=null, toastTimer;
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function freshState(){return {progressionVersion:3,name:'ぼうけん者',stats:Object.fromEntries(STATUSES.map(s=>[s.id,{exp:0}])),actions:Object.fromEntries(STATUSES.map(s=>[s.id,s.actions.map(([name,exp])=>({id:uid(),name,exp}))])),logs:[],adjustments:[]}}
function loadState(){
 try{
  const saved=JSON.parse(localStorage.getItem(KEY));const fresh=freshState();if(!saved)return fresh;
  const legacy=Object.hasOwn(saved,'hp')||!saved.stats,needsCurveMigration=saved.progressionVersion!==3;
  fresh.name=typeof saved.name==='string'?saved.name:fresh.name;
  fresh.stats=Object.assign(fresh.stats,legacy?Object.fromEntries(STATUSES.map(s=>[s.id,{exp:Math.max(0,Number(saved[s.id]?.exp)||0)}])):saved.stats);
  fresh.actions=legacy?fresh.actions:Object.assign(fresh.actions,saved.actions||{});
  for(const s of STATUSES){let exp=Math.max(0,Number(fresh.stats[s.id]?.exp)||0);if(needsCurveMigration)exp=totalExpAtLevel(Math.floor(exp/10))+(exp%10);fresh.stats[s.id]={exp};fresh.actions[s.id]=(fresh.actions[s.id]||[]).map(a=>Array.isArray(a)?{id:uid(),name:a[0],exp:Number(String(a[1]).match(/\d+/)?.[0])||1}:{id:a.id||uid(),name:String(a.name||''),exp:Math.max(1,Number(a.exp)||1)}).filter(a=>a.name)}
  fresh.logs=Array.isArray(saved.logs)?saved.logs:[];fresh.adjustments=Array.isArray(saved.adjustments)?saved.adjustments:[];if(needsCurveMigration)fresh.adjustments=fresh.adjustments.map(h=>({...h,before:totalExpAtLevel(Math.floor((Number(h.before)||0)/10))+((Number(h.before)||0)%10),after:totalExpAtLevel(Math.floor((Number(h.after)||0)/10))+((Number(h.after)||0)%10)}));return fresh;
 }catch{return freshState()}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function requiredExp(level){
 const x=level;
 if(x<=25)return 10+2*x;
 if(x<=50)return 60+3*(x-25);
 if(x<=100)return 135+3*(x-50)+Math.floor(3*(x-50)/10);
 return 300;
}
function totalExpAtLevel(level){
 let count=Math.max(0,Math.floor(level)),total=0;
 const first=Math.min(count,26);total+=10*first+first*(first-1);count-=first;
 const second=Math.min(count,25);total+=60*second+3*second*(second+1)/2;count-=second;
 const third=Math.min(count,50);total+=135*third+3*third*(third+1)/2;for(let y=1;y<=third;y++)total+=Math.floor(3*y/10);count-=third;
 return total+300*count;
}
function levelInfo(totalExp){
 const exp=Math.max(0,Math.floor(Number(totalExp)||0));let low=0,high=Math.floor(exp/10)+1;
 while(low<high){const mid=Math.ceil((low+high)/2);if(totalExpAtLevel(mid)<=exp)low=mid;else high=mid-1}
 const progress=exp-totalExpAtLevel(low),needed=requiredExp(low);
 return {level:low,progress,needed};
}
function safe(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localDate(iso){const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateTime(iso){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))}
function getAverage(){return Math.floor(STATUSES.reduce((n,s)=>n+levelInfo(state.stats[s.id].exp).level,0)/STATUSES.length)}
function renderHome(){
 document.getElementById('player-name').textContent=state.name;
 const grid=document.getElementById('stat-grid');grid.innerHTML=STATUSES.map(s=>{const info=levelInfo(state.stats[s.id].exp);return `<button class="stat-card" data-stat="${s.id}" style="--accent:${s.color}"><div class="stat-top"><span class="stat-icon">${s.icon}</span><span class="stat-level">Lv.${info.level}</span></div><div class="stat-name">${s.name}</div><div class="mini-track"><span style="width:${info.progress/info.needed*100}%"></span></div><div class="stat-xp"><span>${info.progress} / ${info.needed} EXP</span><span>QUEST ›</span></div></button>`}).join('');
 grid.querySelectorAll('[data-stat]').forEach(el=>el.addEventListener('click',()=>openStat(el.dataset.stat)));
 const average=getAverage();document.getElementById('overall-level').textContent=average;document.querySelector('.overall-emblem').dataset.rank=average<3?'1':average<8?'2':'3';
 renderLogs();
}
function showScreen(id){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));window.scrollTo({top:0,behavior:'smooth'})}
function openStat(id){activeStat=STATUSES.find(s=>s.id===id);if(!activeStat)return;showScreen('detail');renderDetail()}
function renderDetail(){
 const s=activeStat,exp=state.stats[s.id].exp,info=levelInfo(exp);document.getElementById('detail-icon').textContent=s.icon;document.getElementById('detail-icon').style.borderColor=s.color;document.getElementById('detail-name').textContent=s.name;document.getElementById('detail-kicker').textContent='STATUS / QUEST';document.getElementById('detail-caption').textContent='';document.getElementById('detail-level').textContent=info.level;document.getElementById('detail-total-exp').textContent=exp;document.getElementById('detail-progress').style.width=`${info.progress/info.needed*100}%`;document.getElementById('detail-progress-text').textContent=`${info.progress} / ${info.needed} EXP`;document.getElementById('next-level-text').textContent=`あと ${info.needed-info.progress} EXP でレベルアップ`;
 const list=document.getElementById('action-list');list.innerHTML=state.actions[s.id].length?state.actions[s.id].map(a=>`<div class="quest-row" data-action-id="${safe(a.id)}"><button class="action-card" data-complete="${safe(a.id)}"><span class="action-symbol">✦</span><span class="action-title">${safe(a.name)}</span><span class="action-reward">+${a.exp} EXP</span></button><div class="quest-tools"><button type="button" data-edit="${safe(a.id)}" aria-label="${safe(a.name)}を変更">変更</button><button type="button" class="delete-button" data-delete="${safe(a.id)}" aria-label="${safe(a.name)}を削除">削除</button></div></div>`).join(''):'<div class="empty-quests">クエストはまだありません。下のフォームから追加できます。</div>';
 list.querySelectorAll('[data-complete]').forEach(el=>el.addEventListener('click',()=>completeAction(el.dataset.complete)));
 list.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',()=>editAction(el.dataset.edit)));
 list.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',()=>deleteAction(el.dataset.delete)));
 document.getElementById('add-action-form').reset();document.getElementById('new-action-exp').value=3;
}
function completeAction(id){
 const status=activeStat,action=state.actions[status.id].find(a=>a.id===id);if(!action)return;
 pendingAction={statusId:status.id,actionId:id,trigger:document.activeElement};
 const modal=document.getElementById('power-modal'),scene=document.getElementById('power-scene');
 const weapons={hp:'💪',attack:'⚔️',defense:'🛡️',spattack:'🪄',spdefense:'🔮',speed:'👟'};
 scene.dataset.art=status.id;document.getElementById('scene-weapon').textContent=weapons[status.id]||'✦';
 document.getElementById('power-message').textContent=`${status.name}の経験値を ${action.exp} 取得します。`;
 document.getElementById('power-action').textContent=action.name;
 document.getElementById('power-reward').textContent=`+${action.exp} EXP`;
 modal.hidden=false;document.body.classList.add('modal-open');document.getElementById('confirm-action').focus();
}
function closePowerModal(restoreFocus=true){
 const trigger=pendingAction?.trigger;document.getElementById('power-modal').hidden=true;document.body.classList.remove('modal-open');pendingAction=null;
 if(restoreFocus&&trigger?.isConnected)trigger.focus();
}
function cancelAction(){if(!pendingAction)return;closePowerModal(true)}
function confirmAction(){
 if(!pendingAction)return;const {statusId,actionId}=pendingAction,status=STATUSES.find(s=>s.id===statusId),action=state.actions[statusId].find(a=>a.id===actionId);if(!status||!action){cancelAction();return}
 const before=levelInfo(state.stats[statusId].exp).level;state.stats[statusId].exp+=action.exp;state.logs.push({id:uid(),status:statusId,action:action.name,exp:action.exp,at:new Date().toISOString()});save();renderDetail();renderHome();closePowerModal(false);
 const after=levelInfo(state.stats[statusId].exp).level,button=document.querySelector(`[data-complete="${CSS.escape(actionId)}"]`);if(button)button.focus();if(after>before)showToast(`LEVEL UP! ${status.name} Lv.${after}`);
}
function editAction(id){const row=document.querySelector(`[data-action-id="${CSS.escape(id)}"]`),action=state.actions[activeStat.id].find(a=>a.id===id);if(!row||!action)return;row.innerHTML=`<form class="inline-edit"><label>行動名<input name="name" maxlength="60" required value="${safe(action.name)}"></label><label>EXP<input name="exp" type="number" min="1" max="9999" required value="${action.exp}"></label><div class="form-buttons"><button class="primary-button" type="submit">保存</button><button type="button" class="cancel-button">取消</button></div></form>`;const form=row.querySelector('form');form.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(form),name=String(data.get('name')).trim(),exp=Number(data.get('exp'));if(!name||!Number.isInteger(exp)||exp<1)return;action.name=name;action.exp=exp;save();renderDetail()});form.querySelector('.cancel-button').addEventListener('click',renderDetail)}
function deleteAction(id){const action=state.actions[activeStat.id].find(a=>a.id===id);if(!action)return;if(!confirm(`「${action.name}」を削除しますか？`))return;state.actions[activeStat.id]=state.actions[activeStat.id].filter(a=>a.id!==id);save();renderDetail();showToast('行動を削除しました')}
function renderLogs(){
 const selector=document.getElementById('log-status');if(selector.options.length===1)STATUSES.forEach(s=>selector.add(new Option(s.name,s.id)));
 const from=document.getElementById('log-from').value,to=document.getElementById('log-to').value,status=document.getElementById('log-status').value;
 const logs=[...state.logs].filter(log=>(!from||localDate(log.at)>=from)&&(!to||localDate(log.at)<=to)&&(status==='all'||log.status===status)).sort((a,b)=>b.at.localeCompare(a.at));
 document.getElementById('log-count').textContent=`${logs.length}件`;
 document.getElementById('log-list').innerHTML=logs.length?logs.map(log=>{const s=STATUSES.find(x=>x.id===log.status);return `<article class="log-entry"><span class="log-gem">✦</span><div class="log-copy"><strong>${safe(log.action)}</strong><span>${safe(s?.name||'')} · ${dateTime(log.at)}</span></div><b>+${Number(log.exp)} EXP</b></article>`}).join(''):'<p class="empty-logs">この条件の成長ログはありません。</p>';
}
function renderSettings(){document.getElementById('name-input').value=state.name;document.getElementById('status-editor').innerHTML=STATUSES.map(s=>{const info=levelInfo(state.stats[s.id].exp);return `<form class="status-edit-card panel" data-adjust="${s.id}"><div class="status-edit-title"><span style="color:${s.color}">${s.icon}</span><strong>${s.name}</strong></div><div class="adjust-fields"><label>レベル<input name="level" type="number" min="0" max="99999" value="${info.level}" required></label><label>レベル内 EXP<input name="progress" type="number" min="0" max="${info.needed-1}" value="${info.progress}" required></label></div><button class="primary-button" type="submit">調整を保存</button></form>`}).join('');
 document.querySelectorAll('[data-adjust]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const id=form.dataset.adjust,old=state.stats[id].exp,fields=new FormData(form),level=Number(fields.get('level')),progress=Number(fields.get('progress')),needed=requiredExp(level);if(!Number.isInteger(level)||level<0||!Number.isInteger(progress)||progress<0||progress>=needed)return;const next=totalExpAtLevel(level)+progress;if(old===next){showToast('変更はありません');return}state.adjustments.push({id:uid(),status:id,before:old,after:next,at:new Date().toISOString()});state.stats[id].exp=next;save();renderSettings();renderHome();showToast(`${STATUSES.find(s=>s.id===id).name}を調整しました`)}));
 const history=[...state.adjustments].sort((a,b)=>b.at.localeCompare(a.at));document.getElementById('adjustment-history').innerHTML=history.length?history.map(h=>{const s=STATUSES.find(x=>x.id===h.status),before=levelInfo(h.before),after=levelInfo(h.after);return `<article class="history-entry"><div><strong>${safe(s?.name||'')}</strong><span>${dateTime(h.at)}</span></div><p>${before.level} Lv. (${before.progress} EXP) <span>→</span> ${after.level} Lv. (${after.progress} EXP)</p></article>`}).join(''):'<p class="empty-logs">調整履歴はまだありません。</p>';
}
function showToast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}
document.getElementById('back-home').addEventListener('click',()=>showScreen('home'));
document.getElementById('open-settings').addEventListener('click',()=>{renderSettings();showScreen('settings')});
document.querySelectorAll('[data-home]').forEach(el=>el.addEventListener('click',()=>showScreen('home')));
document.getElementById('name-form').addEventListener('submit',e=>{e.preventDefault();const name=document.getElementById('name-input').value.trim();if(!name)return;state.name=name;save();renderHome();showToast('名前を変更しました')});
document.getElementById('add-action-form').addEventListener('submit',e=>{e.preventDefault();const name=document.getElementById('new-action-name').value.trim(),exp=Number(document.getElementById('new-action-exp').value);if(!name||!Number.isInteger(exp)||exp<1)return;state.actions[activeStat.id].push({id:uid(),name,exp});save();renderDetail();showToast('新しい行動を追加しました')});
document.getElementById('confirm-action').addEventListener('click',confirmAction);
document.getElementById('cancel-action').addEventListener('click',cancelAction);
document.getElementById('power-modal').addEventListener('click',e=>{if(e.target.id==='power-modal')cancelAction()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('power-modal').hidden)cancelAction()});
['log-from','log-to','log-status'].forEach(id=>document.getElementById(id).addEventListener('change',renderLogs));
document.querySelector('[data-overall]').addEventListener('click',()=>{const panel=document.getElementById('growth-panel');panel.open=!panel.open;panel.scrollIntoView({behavior:'smooth',block:'center'})});
renderHome();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

