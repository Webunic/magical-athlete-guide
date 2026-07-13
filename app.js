const STORAGE = 'magical-athlete-party-v3';
const LEGACY_KEYS = ['magical-athlete-party-v2', 'magical-athlete-party-v1'];
const VERSION = '1.1.0';
const STATUSES = new Set(['not_in_party', 'pool', 'player', 'race', 'spent', 'other']);
const FAQ = {
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

let DATA = [];
let tab = 'pool';
let referenceFilter = 'all';
let state = loadState();
const $ = selector => document.querySelector(selector);

function defaultState() {
  return {
    playerCount: 4,
    doubleRacers: false,
    names: ['Игрок 1', 'Игрок 2', 'Игрок 3', 'Игрок 4'],
    raceNumber: 1,
    cards: {},
    lastRaceUndo: null
  };
}

function migrateCard(raw = {}) {
  if (STATUSES.has(raw.status)) {
    return sanitizeCard({
      status: raw.status,
      owner: raw.owner,
      spentRace: raw.spentRace
    });
  }
  let status = 'not_in_party';
  if (raw.inRace && Number.isInteger(raw.owner)) status = 'race';
  else if (raw.owner === 'other') status = 'other';
  else if (Number.isInteger(raw.owner)) status = 'player';
  else if (raw.inPool) status = 'pool';
  return sanitizeCard({status, owner: raw.owner, spentRace: null});
}

function sanitizeCard(raw = {}) {
  const status = STATUSES.has(raw.status) ? raw.status : 'not_in_party';
  const owner = (status === 'player' || status === 'race') && Number.isInteger(raw.owner) ? raw.owner : null;
  const spentRace = status === 'spent' ? Math.max(1, Number(raw.spentRace) || 1) : null;
  return {status, owner, spentRace};
}

function normalizeState(raw = {}) {
  const base = defaultState();
  const merged = {...base, ...raw};
  merged.playerCount = Math.min(6, Math.max(2, Number(merged.playerCount) || 4));
  merged.raceNumber = Math.max(1, Number(merged.raceNumber) || 1);
  merged.names = Array.isArray(merged.names) ? merged.names.slice(0, 6) : base.names;
  while (merged.names.length < merged.playerCount) merged.names.push(`Игрок ${merged.names.length + 1}`);
  merged.cards = Object.fromEntries(Object.entries(merged.cards || {}).map(([id, value]) => [id, migrateCard(value)]));
  if (!merged.lastRaceUndo || !Array.isArray(merged.lastRaceUndo.cards)) merged.lastRaceUndo = null;
  return merged;
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    const loaded = normalizeState(raw ? JSON.parse(raw) : {});
    localStorage.setItem(STORAGE, JSON.stringify(loaded));
    return loaded;
  } catch {
    return defaultState();
  }
}

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function norm(value) {
  return String(value || '').toLocaleLowerCase().replaceAll('ё', 'е');
}

function entry(id) {
  return state.cards[id] || {status:'not_in_party', owner:null, spentRace:null};
}

function playerName(index) {
  return state.names[index] || `Игрок ${index + 1}`;
}

function clearUndo() {
  state.lastRaceUndo = null;
}

function setCard(id, patch, {keepUndo = false} = {}) {
  if (!keepUndo) clearUndo();
  state.cards[id] = sanitizeCard({...entry(id), ...patch});
  save();
  render();
}

function searchedCards() {
  const query = norm($('#search').value);
  return DATA.filter(card => norm(`${card.ru} ${card.en} ${card.original} ${card.translation} ${FAQ[card.id] || ''}`).includes(query));
}

function referenceCards() {
  const list = searchedCards();
  if (referenceFilter === 'all') return list;
  if (referenceFilter === 'players') return list.filter(card => entry(card.id).status === 'player');
  return list.filter(card => entry(card.id).status === referenceFilter);
}

function statusText(cardState) {
  switch (cardState.status) {
    case 'other': return ['Забрал другой игрок', 'other'];
    case 'player': return [playerName(cardState.owner), 'mine'];
    case 'race': return [`${playerName(cardState.owner)} · в гонке`, 'race'];
    case 'spent': return [`Сыграна в гонке ${cardState.spentRace}`, 'spent'];
    case 'pool': return ['Доступна в пуле', ''];
    default: return ['Не добавлена', ''];
  }
}

function imageStyle(card) {
  const index = Math.max(0, DATA.findIndex(item => item.id === card.id));
  const x = (index % 6) * 20;
  const y = Math.floor(index / 6) * 20;
  return `background-position:${x}% ${y}%`;
}

function cardActions(card, context) {
  const cardState = entry(card.id);
  if (context === 'reference') {
    if (cardState.status === 'not_in_party') return '<div class="actions"><button data-act="add-pool">Добавить в пул</button></div>';
    if (cardState.status === 'pool') return '<div class="actions"><button class="secondary" data-act="remove-pool">Убрать из пула</button></div>';
    if (cardState.status === 'spent') return '<div class="actions"><button class="secondary" data-act="restore-pool">Вернуть в пул</button></div>';
    if (cardState.status === 'other') return '<div class="actions"><button disabled>Забрал другой игрок</button></div>';
    return `<div class="actions"><button disabled>${escapeHtml(playerName(cardState.owner))}${cardState.status === 'race' ? ' · в гонке' : ''}</button></div>`;
  }
  if (context === 'pool') {
    let options = `<option value="" ${cardState.status === 'pool' ? 'selected' : ''}>Доступна</option>`;
    for (let i = 0; i < state.playerCount; i++) {
      options += `<option value="p${i}" ${(cardState.status === 'player' || cardState.status === 'race') && cardState.owner === i ? 'selected' : ''}>${escapeHtml(playerName(i))}</option>`;
    }
    options += `<option value="other" ${cardState.status === 'other' ? 'selected' : ''}>Забрал другой игрок</option>`;
    return `<div class="actions"><select data-act="owner">${options}</select><button data-act="remove-pool">Убрать из пула</button></div>`;
  }
  if (context === 'player') {
    return `<div class="actions"><button data-act="race" class="${cardState.status === 'race' ? 'primary' : ''}">${cardState.status === 'race' ? 'Убрать из гонки' : 'В текущую гонку'}</button><button data-act="return-pool">Вернуть в пул</button></div>`;
  }
  return '';
}

function buildCard(cardData, context) {
  const cardState = entry(cardData.id);
  const [status, statusClass] = statusText(cardState);
  const article = document.createElement('article');
  article.className = 'card';
  const showOriginal = context === 'race' || context === 'reference';
  article.innerHTML = `
    <div class="thumb" style="${imageStyle(cardData)}" role="img" aria-label="${escapeHtml(cardData.ru)}"></div>
    <div class="card-body">
      <div class="top"><div class="title"><h3>${escapeHtml(cardData.ru)}</h3><small>${escapeHtml(cardData.en)}</small></div></div>
      <span class="status ${statusClass}">${escapeHtml(status)}</span>
      <div class="label">Перевод</div><p>${escapeHtml(cardData.translation)}</p>
      ${showOriginal ? `<div class="label">Оригинал</div><p class="original">${escapeHtml(cardData.original)}</p>` : ''}
      ${FAQ[cardData.id] ? `<details class="faq"><summary>Уточнение по правилам</summary><p>${escapeHtml(FAQ[cardData.id])}</p></details>` : ''}
      ${cardActions(cardData, context)}
    </div>`;

  article.querySelector('[data-act=add-pool]')?.addEventListener('click', () => setCard(cardData.id, {status:'pool', owner:null, spentRace:null}));
  article.querySelectorAll('[data-act=remove-pool]').forEach(button => button.addEventListener('click', () => setCard(cardData.id, {status:'not_in_party', owner:null, spentRace:null})));
  article.querySelector('[data-act=restore-pool]')?.addEventListener('click', () => {
    if (confirm(`Вернуть «${cardData.ru}» в открытый пул?`)) setCard(cardData.id, {status:'pool', owner:null, spentRace:null});
  });
  article.querySelector('[data-act=return-pool]')?.addEventListener('click', () => setCard(cardData.id, {status:'pool', owner:null, spentRace:null}));
  article.querySelector('[data-act=race]')?.addEventListener('click', () => toggleRace(cardData.id));
  article.querySelector('[data-act=owner]')?.addEventListener('change', event => {
    const value = event.target.value;
    if (value === 'other') setCard(cardData.id, {status:'other', owner:null, spentRace:null});
    else if (value) setCard(cardData.id, {status:'player', owner:Number(value.slice(1)), spentRace:null});
    else setCard(cardData.id, {status:'pool', owner:null, spentRace:null});
  });
  return article;
}

function toggleRace(id) {
  const cardState = entry(id);
  if (cardState.status === 'race') {
    setCard(id, {status:'player', owner:cardState.owner, spentRace:null});
    return;
  }
  if (cardState.status !== 'player' || !Number.isInteger(cardState.owner)) return;
  const limit = state.doubleRacers ? 2 : 1;
  const active = DATA.filter(card => {
    const current = entry(card.id);
    return current.status === 'race' && current.owner === cardState.owner;
  });
  if (active.length >= limit) {
    alert(`У ${playerName(cardState.owner)} уже выбрано максимум: ${limit}.`);
    return;
  }
  setCard(id, {status:'race', owner:cardState.owner, spentRace:null});
}

function enforceRaceLimits() {
  const limit = state.doubleRacers ? 2 : 1;
  for (let owner = 0; owner < state.playerCount; owner++) {
    const active = DATA.filter(card => {
      const current = entry(card.id);
      return current.status === 'race' && current.owner === owner;
    });
    active.slice(limit).forEach(card => {
      state.cards[card.id] = sanitizeCard({status:'player', owner, spentRace:null});
    });
  }
}

function poolLedgerCards() {
  return searchedCards().filter(card => ['pool', 'player', 'race', 'other'].includes(entry(card.id).status));
}

function renderPool() {
  const grid = $('#poolGrid');
  const list = poolLedgerCards();
  const fullCount = DATA.filter(card => ['pool', 'player', 'race', 'other'].includes(entry(card.id).status)).length;
  grid.innerHTML = '';
  list.forEach(card => grid.appendChild(buildCard(card, 'pool')));
  $('#poolCount').textContent = fullCount;
  $('#poolEmpty').textContent = fullCount === 0 ? 'Пул пуст. Перейди в «Справочник» и нажми «Добавить в пул».' : 'По запросу ничего не найдено.';
  $('#poolEmpty').classList.toggle('hidden', list.length > 0);
}

function renderPlayers() {
  const root = $('#playersGrid');
  const searchList = searchedCards();
  const limit = state.doubleRacers ? 2 : 1;
  root.innerHTML = '';
  for (let owner = 0; owner < state.playerCount; owner++) {
    const allOwned = DATA.filter(card => {
      const current = entry(card.id);
      return (current.status === 'player' || current.status === 'race') && current.owner === owner;
    });
    const visible = searchList.filter(card => {
      const current = entry(card.id);
      return (current.status === 'player' || current.status === 'race') && current.owner === owner;
    });
    const selected = allOwned.filter(card => entry(card.id).status === 'race').length;
    const box = document.createElement('section');
    box.className = `player-box${allOwned.length > 0 && selected < limit ? ' needs-racer' : ''}`;
    box.innerHTML = `<h3>${escapeHtml(playerName(owner))}</h3><div class="player-meta">Карт: ${allOwned.length} · выбрано ${selected}/${limit}</div><div class="grid"></div>`;
    visible.forEach(card => box.querySelector('.grid').appendChild(buildCard(card, 'player')));
    if (!visible.length) box.insertAdjacentHTML('beforeend', `<div class="empty">${allOwned.length ? 'По запросу ничего не найдено.' : 'Карты пока не назначены.'}</div>`);
    root.appendChild(box);
  }
  const otherAll = DATA.filter(card => entry(card.id).status === 'other');
  const otherVisible = searchList.filter(card => entry(card.id).status === 'other');
  if (otherAll.length) {
    const box = document.createElement('section');
    box.className = 'player-box';
    box.innerHTML = `<h3>Другие игроки</h3><div class="player-meta">Карт: ${otherAll.length}</div><div class="grid"></div>`;
    otherVisible.forEach(card => box.querySelector('.grid').appendChild(buildCard(card, 'pool')));
    if (!otherVisible.length) box.insertAdjacentHTML('beforeend', '<div class="empty">По запросу ничего не найдено.</div>');
    root.appendChild(box);
  }
}

function renderRace() {
  const visible = searchedCards().filter(card => entry(card.id).status === 'race');
  const all = DATA.filter(card => entry(card.id).status === 'race');
  const grid = $('#raceGrid');
  grid.innerHTML = '';
  visible.forEach(card => grid.appendChild(buildCard(card, 'race')));
  $('#raceCount').textContent = all.length;
  $('#raceEmpty').textContent = all.length === 0 ? 'Выбери участников гонки в разделе «Игроки».' : 'По запросу ничего не найдено.';
  $('#raceEmpty').classList.toggle('hidden', visible.length > 0);
  $('#raceHint').textContent = state.doubleRacers ? 'До двух гонщиков от каждого игрока.' : 'По одному гонщику от каждого игрока.';
  $('#raceTitle').textContent = `Гонка ${state.raceNumber}`;
  const nextButton = $('#nextRace');
  nextButton.disabled = all.length === 0;
  nextButton.textContent = all.length === 0 ? 'Сначала выбери участников' : `Завершить гонку ${state.raceNumber}`;
}

function renderReference() {
  const root = $('#referenceGrid');
  const list = referenceCards();
  root.innerHTML = '';
  list.forEach(card => root.appendChild(buildCard(card, 'reference')));
  $('#referenceCount').textContent = list.length;
  $('#referenceEmpty').classList.toggle('hidden', list.length > 0);
  document.querySelectorAll('.filters button').forEach(button => button.classList.toggle('active', button.dataset.filter === referenceFilter));
}

function renderNames() {
  const root = $('#playerNames');
  root.innerHTML = '';
  state.names = state.names.slice(0, state.playerCount);
  while (state.names.length < state.playerCount) state.names.push(`Игрок ${state.names.length + 1}`);
  state.names.forEach((name, index) => {
    const row = document.createElement('div');
    row.className = 'player-name-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = name;
    input.dataset.name = index;
    input.addEventListener('change', event => {
      state.names[index] = event.target.value.trim() || `Игрок ${index + 1}`;
      save();
      render();
    });
    row.appendChild(input);
    root.appendChild(row);
  });
}

function renderUndo() {
  const bar = $('#undoBar');
  if (!state.lastRaceUndo) {
    bar.classList.add('hidden');
    return;
  }
  $('#undoText').textContent = `Гонка ${state.lastRaceUndo.raceNumber} завершена. Сыграно карт: ${state.lastRaceUndo.cards.length}.`;
  bar.classList.remove('hidden');
}

function showTab(next) {
  tab = next;
  document.querySelectorAll('.panel').forEach(panel => panel.classList.add('hidden'));
  $(`#${next}Panel`).classList.remove('hidden');
  document.querySelectorAll('.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === next));
  render();
}

function finishRace() {
  const active = DATA.filter(card => entry(card.id).status === 'race');
  if (!active.length) return;
  if (!confirm(`Завершить гонку ${state.raceNumber}? ${active.length} карт(ы) будут сыграны и исчезнут из пула и списков игроков.`)) return;
  state.lastRaceUndo = {
    raceNumber: state.raceNumber,
    cards: active.map(card => ({id:card.id, owner:entry(card.id).owner}))
  };
  active.forEach(card => {
    state.cards[card.id] = sanitizeCard({status:'spent', owner:null, spentRace:state.raceNumber});
  });
  state.raceNumber += 1;
  save();
  showTab('players');
  window.scrollTo({top:0, behavior:'smooth'});
}

function undoLastRace() {
  const undo = state.lastRaceUndo;
  if (!undo) return;
  if (!confirm(`Вернуть гонку ${undo.raceNumber} и её участников?`)) return;
  undo.cards.forEach(item => {
    state.cards[item.id] = sanitizeCard({status:'race', owner:item.owner, spentRace:null});
  });
  state.raceNumber = undo.raceNumber;
  state.lastRaceUndo = null;
  save();
  showTab('race');
}

function newParty() {
  if (!confirm('Начать новую партию? Пул, владельцы, сыгранные карты и состав гонки будут очищены, настройки игроков сохранятся.')) return;
  state = normalizeState({
    playerCount: state.playerCount,
    doubleRacers: state.doubleRacers,
    names: [...state.names],
    raceNumber: 1,
    cards: {},
    lastRaceUndo: null
  });
  save();
  $('#setupPanel').classList.add('hidden');
  showTab('pool');
}

function fullReset() {
  if (!confirm('Полностью сбросить приложение, включая имена и настройки?')) return;
  if (!confirm('Это действие нельзя отменить. Подтвердить полный сброс?')) return;
  localStorage.removeItem(STORAGE);
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  state = defaultState();
  save();
  $('#setupPanel').classList.add('hidden');
  showTab('pool');
}

function render() {
  renderPool();
  renderPlayers();
  renderRace();
  renderReference();
  renderNames();
  renderUndo();
  $('#playerCount').value = state.playerCount;
  $('#doubleRacers').checked = state.doubleRacers;
  $('#raceNumber').textContent = `Гонка ${state.raceNumber}`;
}

document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => showTab(button.dataset.tab)));
document.querySelectorAll('.filters button').forEach(button => button.addEventListener('click', () => {referenceFilter = button.dataset.filter; renderReference();}));
$('#search').addEventListener('input', render);
$('#settingsBtn').addEventListener('click', () => $('#setupPanel').classList.toggle('hidden'));
$('#closeSettings').addEventListener('click', () => $('#setupPanel').classList.add('hidden'));
$('#nextRace').addEventListener('click', finishRace);
$('#undoRace').addEventListener('click', undoLastRace);
$('#newParty').addEventListener('click', newParty);
$('#fullReset').addEventListener('click', fullReset);
$('#playerCount').addEventListener('change', event => {
  clearUndo();
  const nextCount = Number(event.target.value);
  state.playerCount = nextCount;
  Object.values(state.cards).forEach(cardState => {
    if ((cardState.status === 'player' || cardState.status === 'race') && Number.isInteger(cardState.owner) && cardState.owner >= nextCount) {
      cardState.status = 'other';
      cardState.owner = null;
      cardState.spentRace = null;
    }
  });
  save();
  render();
});
$('#doubleRacers').addEventListener('change', event => {
  clearUndo();
  state.doubleRacers = event.target.checked;
  enforceRaceLimits();
  save();
  render();
});

async function loadSprite() {
  const parts = await Promise.all(Array.from({length: 15}, (_, index) =>
    fetch(`./assets/sprite-v11-${String(index + 1).padStart(2, '0')}.txt`).then(response => {
      if (!response.ok) throw new Error(`sprite-v11-${String(index + 1).padStart(2, '0')}`);
      return response.text();
    })
  ));
  document.documentElement.style.setProperty('--card-sprite', `url("data:image/jpeg;base64,${parts.join('')}")`);
}

Promise.all([
  fetch('./cards.json').then(response => {
    if (!response.ok) throw new Error('cards');
    return response.json();
  }),
  loadSprite()
])
  .then(([cards]) => {
    DATA = cards;
    enforceRaceLimits();
    save();
    render();
  })
  .catch(() => {
    $('#poolEmpty').textContent = 'Не удалось загрузить карты или миниатюры.';
  });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
