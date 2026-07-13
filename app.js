const KEY='magical-athlete-selected-v5';
const FAQ={
  'magician':'После переброса используется последний полученный результат. Можно остановиться после первого или второго переброса.',
  'romantic':'Способность проверяет любую клетку поля: когда кто-либо останавливается на клетке, где уже находится ровно один гонщик, Romantic перемещается на 2.',
  'stickler':'Ограничение действует только на других гонщиков. Для финиша им нужно получить ровно недостающее движение; при перелёте они не двигаются вовсе.',
  'huge-baby':'Кроме старта, другой гонщик не может закончить перемещение на клетке Huge Baby. Вместо этого его ставят на клетку непосредственно позади Huge Baby.',
  'third-wheel':'Это именно warp: Third Wheel переносится на выбранную клетку с ровно двумя гонщиками до основного перемещения.',
  'copycat':'Берётся способность текущего лидера гонки, а не ближайшего гонщика впереди. При совместном лидерстве Copycat выбирает одного.',
  'twin':'Можно выбрать только гонщика, победившего в одной из предыдущих гонок этой партии.',
  'duelist':'Дуэль объявляется, когда другой гонщик разделяет клетку с Duelist. Оба бросают кубик; победитель перемещается на 2, ничьи выигрывает Duelist.',
  'inchworm':'Если другой гонщик выбросил 1 для основного перемещения, он полностью пропускает это перемещение, а Inchworm перемещается на 1.',
  'alchemist':'Замена результата 1 или 2 на движение 4 необязательна.',
  'blimp':'Бонус или штраф определяется положением Blimp в начале хода: до второго поворота +3, на нём или после него −1.',
  'flip-flop':'Вместо броска основного перемещения происходит полноценный обмен клетками с выбранным гонщиком.',
  'egg':'Три карты берутся перед гонкой; Egg получает способность только выбранного гонщика.',
  'sisyphus':'При результате 6 Sisyphus не выполняет обычное движение: возвращается на старт и теряет один жетон очка.',
  'suckerfish':'Suckerfish может последовать на новую клетку только за гонщиком, который начал перемещение на одной клетке с ним.',
  'party-animal':'Сначала все гонщики сдвигаются на 1 клетку в сторону Party Animal, затем определяется бонус к его основному перемещению.',
  'm-o-u-t-h':'Условие требует ровно одного другого гонщика на клетке в момент остановки M.O.U.T.H.; при большем числе гонщиков никто не выбывает.'
};
let DATA=[],mode='all';let selected=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));
const $=s=>document.querySelector(s);const cards=$('#cards'),picked=$('#selected'),search=$('#search'),app=$('#app');
function norm(s){return(s||'').toLocaleLowerCase().replaceAll('ё','е')}
function makeCard(c,compact=false){
  const a=document.createElement('article');a.className='card'+(compact?' selected-card':'');
  const faq=FAQ[c.id];
  a.innerHTML=`<div class="top"><div class="title"><h3>${c.ru}</h3><small>${c.en}</small></div><button class="pin ${selected.has(c.id)?'on':''}">${selected.has(c.id)?'✓ В игре':'＋ В игру'}</button></div><div class="label">Оригинал</div><p class="original">${c.original}</p><div class="label">Перевод</div><p>${c.translation}</p>${faq?`<details class="faq"><summary>Уточнение по правилам</summary><p>${faq}</p></details>`:''}`;
  a.querySelector('.pin').onclick=()=>toggle(c.id);return a
}
function toggle(id){selected.has(id)?selected.delete(id):selected.add(id);localStorage.setItem(KEY,JSON.stringify([...selected]));render()}
function render(){
  const q=norm(search.value);cards.innerHTML='';picked.innerHTML='';let shown=0;
  DATA.forEach(c=>{if(selected.has(c.id))picked.appendChild(makeCard(c,true));const hay=norm(c.ru+' '+c.en+' '+c.original+' '+c.translation+' '+(FAQ[c.id]||''));if(hay.includes(q)){cards.appendChild(makeCard(c));shown++}});
  if(!selected.size)picked.innerHTML='<div class="empty">Нажмите «＋ В игру» на нужных карточках — они соберутся здесь.</div>';
  $('#selectedCount').textContent=selected.size;$('#countBadge').textContent=selected.size;$('#summary').textContent=`Показано: ${shown} из ${DATA.length}`;
  app.classList.toggle('only-game',mode==='game');$('#allBtn').classList.toggle('active',mode==='all');$('#gameBtn').classList.toggle('active',mode==='game')
}
search.addEventListener('input',render);$('#allBtn').onclick=()=>{mode='all';render()};$('#gameBtn').onclick=()=>{mode='game';render();window.scrollTo({top:0,behavior:'smooth'})};$('#clearBtn').onclick=()=>{if(selected.size&&confirm('Убрать все карты из состава партии?')){selected.clear();localStorage.removeItem(KEY);render()}};
fetch('./cards.json').then(r=>r.json()).then(d=>{DATA=d;render()}).catch(()=>{$('#summary').textContent='Не удалось загрузить список карт.'});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});