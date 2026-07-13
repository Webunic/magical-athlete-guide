const STORAGE='magical-athlete-party-v3';
const LEGACY_STORAGES=['magical-athlete-party-v2','magical-athlete-party-v1'];
const VERSION='1.1.0';
const STATES=new Set(['pool','player','race','spent','other']);
const FAQ={'magician':'После переброса используется последний полученный результат. Можно остановиться после первого или второго переброса.','romantic':'Способность проверяет любую клетку поля: когда кто-либо останавливается на клетке, где уже находится ровно один гонщик, Romantic перемещается на 2.','stickler':'Ограничение действует только на других гонщиков. Для финиша им нужно получить ровно недостающее движение; при перелёте они не двигаются вовсе.','huge-baby':'Кроме старта, другой гонщик не может закончить перемещение на клетке Huge Baby. Вместо этого его ставят на клетку непосредственно позади Huge Baby.','third-wheel':'Это именно warp: Third Wheel переносится на выбранную клетку с ровно двумя гонщиками до основного перемещения.','copycat':'Берётся способность текущего лидера гонки, а не ближайшего гонщика впереди. При совместном лидерстве Copycat выбирает одного.','twin':'Можно выбрать только гонщика, победившего в одной из предыдущих гонок этой партии.','duelist':'Дуэль объявляется, когда другой гонщик разделяет клетку с Duelist. Оба бросают кубик; победитель перемещается на 2, ничьи выигрывает Duelist.','inchworm':'Если другой гонщик выбросил 1 для основного перемещения, он полностью пропускает это перемещение, а Inchworm перемещается на 1.','alchemist':'Замена результата 1 или 2 на движение 4 необязательна.','blimp':'Бонус или штраф определяется положением Blimp в начале хода: до второго поворота +3, на нём или после него −1.','flip-flop':'Вместо броска основного перемещения происходит полноценный обмен клетками с выбранным гонщиком.','egg':'Три карты берутся перед гонкой; Egg получает способность только выбранного гонщика.','sisyphus':'При результате 6 Sisyphus не выполняет обычное движение: возвращается на старт и теряет один жетон очка.','suckerfish':'Suckerfish может последовать на новую клетку только за гонщиком, который начал перемещение на одной клетке с ним.','party-animal':'Сначала все гонщики сдвигаются на 1 клетку в сторону Party Animal, затем определяется бонус к его основному перемещению.','m-o-u-t-h':'Условие требует ровно одного другого гонщика на клетке в момент остановки M.O.U.T.H.; при большем числе гонщиков никто не выбывает.'};
let DATA=[];
let tab='pool';
let referenceFilter='all';
let state=loadState();
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function defaultState(){return{schemaVersion:3,playerCount:4,doubleRacers:false,names:['Игрок 1','Игрок 2','Игрок 3','Игрок 4'],raceNumber:1,cards:{},lastTransition:null}}
function migrateCard(raw){
  if(!raw||typeof raw!=='object')return null;
  if(STATES.has(raw.status)){
    const next={status:raw.status};
    if((raw.status==='player'||raw.status==='race')&&Number.isInteger(raw.owner))next.owner=raw.owner;
    if(raw.status==='spent')next.spentRace=Math.max(1,Number(raw.spentRace)||1);
    return next;
  }
  if(raw.inRace&&Number.isInteger(raw.owner))return{status:'race',owner:raw.owner};
  if(raw.owner==='other')return{status:'other'};
  if(Number.isInteger(raw.owner))return{status:'player',owner:raw.owner};
  if(raw.inPool)return{status:'pool'};
  return null;
}
function normalizeState(raw){
  const base=defaultState();
  const merged=Object.assign(base,raw||{});
  merged.schemaVersion=3;
  merged.playerCount=Math.min(6,Math.max(2,Number(merged.playerCount)||4));
  merged.doubleRacers=Boolean(merged.doubleRacers);
  merged.raceNumber=Math.max(1,Number(merged.raceNumber)||1);
  merged.names=Array.isArray(merged.names)?merged.names.slice(0,6):base.names;
  while(merged.names.length<merged.playerCount)merged.names.push(`Игрок ${merged.names.length+1}`);
  const cards={};
  Object.entries(merged.cards||{}).forEach(([id,rawCard])=>{const migrated=migrateCard(rawCard);if(migrated)cards[id]=migrated});
  merged.cards=cards;
  if(!merged.lastTransition||!Array.isArray(merged.lastTransition.cards))merged.lastTransition=null;
  return merged;
}
function loadState(){
  try{
    let raw=localStorage.getItem(STORAGE);
    if(!raw){for(const key of LEGACY_STORAGES){raw=localStorage.getItem(key);if(raw)break}}
    const loaded=normalizeState(raw?JSON.parse(raw):{});
    localStorage.setItem(STORAGE,JSON.stringify(loaded));
    return loaded;
  }catch{return defaultState()}
}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function norm(value){return String(value||'').toLocaleLowerCase().replaceAll('ё','е')}
function entry(id){return state.cards[id]||null}
function statusOf(id){return entry(id)?.status||'none'}
function invalidateUndo(){state.lastTransition=null}
function setEntry(id,next,{keepUndo=false}={}){
  if(!keepUndo)invalidateUndo();
  if(!next||next.status==='none')delete state.cards[id];
  else state.cards[id]=next;
  save();
  render();
}
function playerName(index){return state.names[index]||`Игрок ${index+1}`}
function searchQuery(){return norm($('#search').value)}
function searchedCards(){const query=searchQuery();return DATA.filter(card=>norm(`${card.ru} ${card.en} ${card.original} ${card.translation} ${FAQ[card.id]||''}`).includes(query))}
function activePoolStatus(status){return status==='pool'||status==='player'||status==='race'||status==='other'}
function statusText(cardState){
  if(!cardState)return['Не добавлена',''];
  if(cardState.status==='other')return['Забрал другой игрок','other'];
  if(cardState.status==='spent')return[`Сыграна в гонке ${cardState.spentRace}`,'spent'];
  if(cardState.status==='race')return[`${playerName(cardState.owner)} · в гонке`,'race'];
  if(cardState.status==='player')return[playerName(cardState.owner),'mine'];
  return['Доступна в пуле',''];
}
function imageStyle(card){const index=Math.max(0,DATA.findIndex(item=>item.id===card.id));const x=(index%6)*20;const y=Math.floor(index/6)*20;return`background-position:${x}% ${y}%`}
function ownerOptions(cardState){
  let options=`<option value="" ${cardState?.status==='pool'?'selected':''}>Доступна</option>`;
  for(let index=0;index<state.playerCount;index++){
    const selected=(cardState?.status==='player'||cardState?.status==='race')&&cardState.owner===index?'selected':'';
    options+=`<option value="p${index}" ${selected}>${esc(playerName(index))}</option>`;
  }
  options+=`<option value="other" ${cardState?.status==='other'?'selected':''}>Забрал другой игрок</option>`;
  return options;
}
function card(cardData,context){
  const cardState=entry(cardData.id);
  const [statusLabel,statusClass]=statusText(cardState);
  const article=document.createElement('article');
  article.className=`card card-${context}`;
  let actions='';
  if(context==='reference'){
    if(!cardState)actions='<div class="actions"><button data-act="add">Добавить в пул</button></div>';
    else if(cardState.status==='pool')actions='<div class="actions"><button class="secondary" data-act="remove">Убрать из пула</button></div>';
    else if(cardState.status==='spent')actions='<div class="actions"><button class="secondary" data-act="restore">Вернуть в пул</button></div>';
    else actions=`<div class="actions"><button disabled>${esc(statusLabel)}</button></div>`;
  }
  if(context==='pool')actions=`<div class="actions"><select data-act="owner">${ownerOptions(cardState)}</select><button data-act="remove">Убрать из пула</button></div>`;
  if(context==='player')actions=`<div class="actions"><button data-act="race" class="${cardState?.status==='race'?'primary':''}">${cardState?.status==='race'?'Убрать из гонки':'В текущую гонку'}</button><button data-act="return">Вернуть в пул</button></div>`;
  if(context==='race')actions='<div class="actions"><button data-act="race" class="primary">Убрать из гонки</button></div>';
  const showOriginal=context==='race'||context==='reference';
  article.innerHTML=`<div class="thumb" style="${imageStyle(cardData)}" role="img" aria-label="${esc(cardData.ru)}"></div><div class="card-body"><div class="top"><div class="title"><h3>${esc(cardData.ru)}</h3><small>${esc(cardData.en)}</small></div></div><span class="status ${statusClass}">${esc(statusLabel)}</span><div class="label">Перевод</div><p>${esc(cardData.translation)}</p>${showOriginal?`<div class="label">Оригинал</div><p class="original">${esc(cardData.original)}</p>`:''}${FAQ[cardData.id]?`<details class="faq"><summary>Уточнение по правилам</summary><p>${esc(FAQ[cardData.id])}</p></details>`:''}${actions}</div>`;
  const add=article.querySelector('[data-act=add]');if(add)add.onclick=()=>setEntry(cardData.id,{status:'pool'});
  const remove=article.querySelector('[data-act=remove]');if(remove)remove.onclick=()=>removeFromParty(cardData.id);
  const restore=article.querySelector('[data-act=restore]');if(restore)restore.onclick=()=>setEntry(cardData.id,{status:'pool'});
  const owner=article.querySelector('[data-act=owner]');if(owner)owner.onchange=()=>assignOwner(cardData.id,owner.value);
  const race=article.querySelector('[data-act=race]');if(race)race.onclick=()=>toggleRace(cardData.id);
  const ret=article.querySelector('[data-act=return]');if(ret)ret.onclick=()=>setEntry(cardData.id,{status:'pool'});
  return article;
}
function removeFromParty(id){
  const cardState=entry(id);
  if(cardState?.status==='race'&&!confirm('Убрать участника из текущей гонки и из партии?'))return;
  setEntry(id,null);
}
function assignOwner(id,value){
  if(value==='other')setEntry(id,{status:'other'});
  else if(value)setEntry(id,{status:'player',owner:Number(value.slice(1))});
  else setEntry(id,{status:'pool'});
}
function toggleRace(id){
  const cardState=entry(id);
  if(!cardState||!(cardState.status==='player'||cardState.status==='race'))return;
  if(cardState.status==='race'){setEntry(id,{status:'player',owner:cardState.owner});return}
  const max=state.doubleRacers?2:1;
  const active=DATA.filter(item=>{const current=entry(item.id);return current?.status==='race'&&current.owner===cardState.owner});
  if(active.length>=max){alert(`У ${playerName(cardState.owner)} уже выбрано максимум: ${max}.`);return}
  setEntry(id,{status:'race',owner:cardState.owner});
}
function enforceRaceLimits(){
  if(state.doubleRacers)return;
  for(let owner=0;owner<state.playerCount;owner++){
    const active=DATA.filter(item=>{const current=entry(item.id);return current?.status==='race'&&current.owner===owner});
    active.slice(1).forEach(item=>{state.cards[item.id]={status:'player',owner}});
  }
}
function renderPool(){
  const all=DATA.filter(item=>activePoolStatus(statusOf(item.id)));
  const list=searchedCards().filter(item=>activePoolStatus(statusOf(item.id)));
  const root=$('#poolGrid');root.innerHTML='';list.forEach(item=>root.appendChild(card(item,'pool')));
  $('#poolCount').textContent=all.length;
  const empty=$('#poolEmpty');
  empty.classList.toggle('hidden',list.length>0);
  empty.textContent=all.length===0?'Пул пуст. Перейди в «Справочник» и нажми «Добавить в пул».':'По запросу ничего не найдено.';
}
function renderPlayers(){
  const root=$('#playersGrid');root.innerHTML='';
  const max=state.doubleRacers?2:1;
  for(let owner=0;owner<state.playerCount;owner++){
    const all=DATA.filter(item=>{const current=entry(item.id);return(current?.status==='player'||current?.status==='race')&&current.owner===owner});
    const list=searchedCards().filter(item=>{const current=entry(item.id);return(current?.status==='player'||current?.status==='race')&&current.owner===owner});
    const active=all.filter(item=>entry(item.id)?.status==='race').length;
    const box=document.createElement('section');box.className='player-box';
    if(all.length&&active<max)box.classList.add('needs-racer');
    if(active===max)box.classList.add('ready');
    box.innerHTML=`<div class="player-heading"><h3>${esc(playerName(owner))}</h3><span class="selection-count">В гонке ${active}/${max}</span></div><div class="grid"></div>`;
    list.forEach(item=>box.querySelector('.grid').appendChild(card(item,'player')));
    if(!list.length){const message=all.length?'По запросу ничего не найдено.':'Карты пока не назначены.';box.insertAdjacentHTML('beforeend',`<div class="empty">${message}</div>`)}
    root.appendChild(box);
  }
  const allOther=DATA.filter(item=>entry(item.id)?.status==='other');
  const other=searchedCards().filter(item=>entry(item.id)?.status==='other');
  if(allOther.length){
    const box=document.createElement('section');box.className='player-box other-player';box.innerHTML='<div class="player-heading"><h3>Другие игроки</h3></div><div class="grid"></div>';
    other.forEach(item=>box.querySelector('.grid').appendChild(card(item,'pool')));
    if(!other.length)box.insertAdjacentHTML('beforeend','<div class="empty">По запросу ничего не найдено.</div>');
    root.appendChild(box);
  }
}
function renderRace(){
  const all=DATA.filter(item=>entry(item.id)?.status==='race');
  const list=searchedCards().filter(item=>entry(item.id)?.status==='race');
  const root=$('#raceGrid');root.innerHTML='';list.forEach(item=>root.appendChild(card(item,'race')));
  $('#raceCount').textContent=all.length;
  $('#raceEmpty').classList.toggle('hidden',list.length>0);
  $('#raceEmpty').textContent=all.length?'По запросу ничего не найдено.':'Выбери участников гонки в разделе «Игроки».';
  $('#raceHint').textContent=state.doubleRacers?'До двух гонщиков от каждого игрока.':'По одному гонщику от каждого игрока.';
  $('#raceTitle').textContent=`Гонка ${state.raceNumber}`;
  const button=$('#nextRace');button.disabled=all.length===0;button.textContent=all.length?`Завершить гонку · ${all.length}`:'Завершить гонку';
}
function matchesReferenceFilter(item){
  const status=statusOf(item.id);
  if(referenceFilter==='all')return true;
  return status===referenceFilter;
}
function renderReference(){
  const list=searchedCards().filter(matchesReferenceFilter);
  const root=$('#referenceGrid');root.innerHTML='';list.forEach(item=>root.appendChild(card(item,'reference')));
  $('#referenceCount').textContent=list.length;
  $('#referenceEmpty').classList.toggle('hidden',list.length>0);
  document.querySelectorAll('.status-filters button').forEach(button=>button.classList.toggle('active',button.dataset.filter===referenceFilter));
}
function renderNames(){
  const root=$('#playerNames');root.innerHTML='';
  state.names=state.names.slice(0,state.playerCount);
  while(state.names.length<state.playerCount)state.names.push(`Игрок ${state.names.length+1}`);
  state.names.forEach((name,index)=>{
    const row=document.createElement('div');row.className='player-name-row';
    const input=document.createElement('input');input.type='text';input.value=name;input.dataset.name=index;
    input.onchange=event=>{invalidateUndo();state.names[index]=event.target.value.trim()||`Игрок ${index+1}`;save();render()};
    row.appendChild(input);root.appendChild(row);
  });
}
function renderUndo(){
  const banner=$('#undoBanner');
  if(!state.lastTransition){banner.classList.add('hidden');return}
  const count=state.lastTransition.cards.length;
  $('#undoTitle').textContent=`Гонка ${state.lastTransition.raceNumber} завершена`;
  $('#undoText').textContent=`Сыграно карт: ${count}. Их можно вернуть в завершённую гонку.`;
  banner.classList.remove('hidden');
}
function showTab(next){
  tab=next;
  document.querySelectorAll('.panel').forEach(panel=>panel.classList.add('hidden'));
  $(`#${next}Panel`).classList.remove('hidden');
  document.querySelectorAll('.tabs button').forEach(button=>button.classList.toggle('active',button.dataset.tab===next));
  render();
}
function completeRace(){
  const active=DATA.filter(item=>entry(item.id)?.status==='race');
  if(!active.length)return;
  if(!confirm(`Завершить гонку ${state.raceNumber}? ${active.length} карт(ы) будут сыграны и убраны из пула и списков игроков.`))return;
  state.lastTransition={raceNumber:state.raceNumber,cards:active.map(item=>({id:item.id,owner:entry(item.id).owner}))};
  active.forEach(item=>{state.cards[item.id]={status:'spent',spentRace:state.raceNumber}});
  state.raceNumber+=1;
  save();showTab('players');window.scrollTo({top:0,behavior:'smooth'});
}
function undoRace(){
  const transition=state.lastTransition;if(!transition)return;
  transition.cards.forEach(({id,owner})=>{const current=entry(id);if(current?.status==='spent'&&current.spentRace===transition.raceNumber)state.cards[id]={status:'race',owner}});
  state.raceNumber=transition.raceNumber;
  state.lastTransition=null;
  save();showTab('race');window.scrollTo({top:0,behavior:'smooth'});
}
function newParty(){
  if(!confirm('Начать новую партию? Пул, владельцы, сыгранные карты и состав гонки будут очищены, настройки игроков сохранятся.'))return;
  state={schemaVersion:3,playerCount:state.playerCount,doubleRacers:state.doubleRacers,names:[...state.names],raceNumber:1,cards:{},lastTransition:null};
  save();$('#setupPanel').classList.add('hidden');showTab('pool');
}
function fullReset(){
  if(!confirm('Полностью сбросить приложение, включая имена и настройки?'))return;
  if(!confirm('Это действие нельзя отменить. Подтвердить полный сброс?'))return;
  localStorage.removeItem(STORAGE);LEGACY_STORAGES.forEach(key=>localStorage.removeItem(key));state=defaultState();save();$('#setupPanel').classList.add('hidden');showTab('pool');
}
function render(){
  renderPool();renderPlayers();renderRace();renderReference();renderNames();renderUndo();
  $('#playerCount').value=state.playerCount;$('#doubleRacers').checked=state.doubleRacers;$('#raceNumber').textContent=`Гонка ${state.raceNumber}`;
}
async function validateImageDataUrl(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(url);image.onerror=reject;image.src=url})}
async function loadSprite(){
  try{
    const manifestResponse=await fetch('./assets/sprite-v11.json');
    if(!manifestResponse.ok)throw new Error('v1.1 sprite manifest');
    const manifest=await manifestResponse.json();
    const parts=await Promise.all(Array.from({length:manifest.parts},(_,index)=>fetch(`./assets/sprite-v11-${String(index+1).padStart(2,'0')}.txt`).then(response=>{if(!response.ok)throw new Error('v1.1 sprite part');return response.text()})));
    const url=`data:${manifest.mime||'image/jpeg'};base64,${parts.join('')}`;
    await validateImageDataUrl(url);document.documentElement.style.setProperty('--card-sprite',`url("${url}")`);return;
  }catch(error){console.warn('Новый sprite не загрузился, используется резервный.',error)}
  try{
    const parts=await Promise.all([1,2,3,4,5].map(index=>fetch(`./assets/sprite-${index}.txt`).then(response=>{if(!response.ok)throw new Error('legacy sprite');return response.text()})));
    const url=`data:image/webp;base64,${parts.join('')}`;await validateImageDataUrl(url);document.documentElement.style.setProperty('--card-sprite',`url("${url}")`);
  }catch(error){console.warn('Миниатюры не загрузились, используется резервный фон.',error)}
}

document.querySelectorAll('.tabs button').forEach(button=>button.onclick=()=>showTab(button.dataset.tab));
document.querySelectorAll('.status-filters button').forEach(button=>button.onclick=()=>{referenceFilter=button.dataset.filter;renderReference()});
$('#search').oninput=render;
$('#settingsBtn').onclick=()=>$('#setupPanel').classList.toggle('hidden');
$('#closeSettings').onclick=()=>$('#setupPanel').classList.add('hidden');
$('#playerCount').onchange=event=>{invalidateUndo();const next=Number(event.target.value);state.playerCount=next;Object.values(state.cards).forEach(cardState=>{if((cardState.status==='player'||cardState.status==='race')&&cardState.owner>=next){cardState.status='other';delete cardState.owner}});save();render()};
$('#doubleRacers').onchange=event=>{invalidateUndo();state.doubleRacers=event.target.checked;enforceRaceLimits();save();render()};
$('#nextRace').onclick=completeRace;
$('#undoRace').onclick=undoRace;
$('#newParty').onclick=newParty;
$('#fullReset').onclick=fullReset;

Promise.all([fetch('./cards.json').then(response=>{if(!response.ok)throw new Error('cards');return response.json()}),loadSprite()]).then(([cards])=>{DATA=cards;enforceRaceLimits();save();render()}).catch(error=>{console.error(error);$('#poolEmpty').textContent='Не удалось загрузить карты.'});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
