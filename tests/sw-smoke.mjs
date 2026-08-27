// подставной chrome: гоняем реальный background.js вне браузера и смотрим,
// что он делает с вкладками — это ловит и ошибки загрузки, и логику
import fs from 'fs';

const L = {};                       // слушатели событий
const ev = () => ({ addListener: f => (L[ev.cur] ??= []).push(f) });
function mkEvent(name) { return { addListener: f => (L[name] ??= []).push(f) }; }

let TABS = [];
let nextId = 100;
const store = { sync: {}, session: {}, local: {} };
const area = (bag) => ({
  get: (d) => Promise.resolve(typeof d === 'string' ? { [d]: bag[d] } : Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [k, k in bag ? bag[k] : v]))),
  set: (o) => (Object.assign(bag, o), Promise.resolve()),
  remove: (k) => ([].concat(k).forEach(x => delete bag[x]), Promise.resolve())
});

const log = [];
globalThis.chrome = {
  runtime: { onMessage: mkEvent('msg'), lastError: null, getURL: p => 'chrome-extension://x' + p, id: 'x' },
  storage: { sync: area(store.sync), session: area(store.session), local: area(store.local), onChanged: mkEvent('storeChanged') },
  action: { setBadgeText: () => Promise.resolve(), setBadgeBackgroundColor: () => Promise.resolve(), setBadgeTextColor: () => Promise.resolve() },
  sidePanel: { setPanelBehavior: () => Promise.resolve(), open: () => Promise.resolve() },
  omnibox: { setDefaultSuggestion: () => {}, onInputChanged: mkEvent('omni1'), onInputEntered: mkEvent('omni2') },
  commands: { onCommand: mkEvent('cmd') },
  windows: {
    WINDOW_ID_NONE: -1,
    onRemoved: mkEvent('winRemoved'), onFocusChanged: mkEvent('winFocus'),
    getAll: () => Promise.resolve(Object.values(WINS)),
    get: id => WINS[id] ? Promise.resolve(WINS[id]) : Promise.reject(new Error('no window')),
    getLastFocused: () => Promise.resolve(WINS[lastFocused]),
    getCurrent: () => Promise.resolve(WINS[lastFocused]),
    create: () => Promise.resolve({ id: 99 }),
    update: () => Promise.resolve()
  },
  bookmarks: {
    // панель закладок с настоящим состоянием: тогл ⌘D иначе не проверить
    getChildren: id => Promise.resolve(id === '1' ? MARKS.slice() : []),
    create: o => { const b = { id: 'b' + (++markId), ...o }; MARKS.splice(o.index ?? MARKS.length, 0, b); return Promise.resolve(b); },
    remove: id => { MARKS = MARKS.filter(b => b.id !== id); return Promise.resolve(); },
    move: () => Promise.resolve(), search: () => Promise.resolve([]), getRecent: () => Promise.resolve([])
  },
  tabGroups: { query: () => Promise.resolve([]), update: () => Promise.resolve() },
  tabs: {
    onCreated: mkEvent('tabCreated'), onRemoved: mkEvent('tabRemoved'), onUpdated: mkEvent('tabUpdated'),
    onActivated: mkEvent('tabActivated'), onMoved: mkEvent('tabMoved'), onDetached: mkEvent('d'), onAttached: mkEvent('a'), onReplaced: mkEvent('r'),
    query: (q = {}) => Promise.resolve(TABS.filter(t =>
      (q.windowId == null || t.windowId === q.windowId) &&
      (q.pinned == null || t.pinned === q.pinned) &&
      (q.active == null || t.active === q.active) &&
      (q.discarded == null || !!t.discarded === q.discarded))),
    get: id => { const t = TABS.find(x => x.id === id); return t ? Promise.resolve(t) : Promise.reject(new Error('no tab')); },
    move: (id, { index }) => {
      const i = TABS.findIndex(t => t.id === id);
      if (i < 0) return Promise.reject(new Error('no tab'));
      const [t] = TABS.splice(i, 1);
      TABS.splice(index < 0 ? TABS.length : index, 0, t);
      TABS.forEach((x, n) => x.index = n);
      log.push(`move ${id} → ${index}`);
      return Promise.resolve(t);
    },
    remove: ids => { const arr = [].concat(ids); TABS = TABS.filter(t => !arr.includes(t.id)); TABS.forEach((x,n)=>x.index=n); log.push('remove ' + arr.join(',')); return Promise.resolve(); },
    create: o => { const t = { id: nextId++, windowId: 1, index: TABS.length, pinned: !!o.pinned, url: o.url, title: o.url }; TABS.push(t); TABS.forEach((x,n)=>x.index=n); return Promise.resolve(t); },
    update: (id, p) => { Object.assign(TABS.find(t => t.id === id) || {}, p); return Promise.resolve(); },
    group: ({ tabIds }) => { log.push('group ' + tabIds.join(',')); return Promise.resolve(1); },
    ungroup: ids => { log.push('ungroup ' + [].concat(ids).length); return Promise.resolve(); },
    discard: () => Promise.resolve()
  }
};

// окна: обычное рабочее и popup-окно палитры — «последнее в фокусе» бывает вторым
const WINS = { 1: { id: 1, type: 'normal', focused: true }, 9: { id: 9, type: 'popup' } };
let lastFocused = 1;

let MARKS = [];
let markId = 0;

let loadError = null;
try {
  const code = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8');
  new Function(code)();
} catch (e) { loadError = String(e); }
console.log('LOAD ERROR:', loadError || 'нет — service worker поднялся');

const wait = ms => new Promise(r => setTimeout(r, ms));
const fire = (name, ...args) => Promise.all((L[name] || []).map(f => f(...args)));

// сцена: 5 вкладок, активна третья (в середине)
TABS = [1,2,3,4,5].map((n,i) => ({ id: n, windowId: 1, index: i, pinned: false, active: n === 3, url: `https://site${n}.com/` }));
await fire('tabActivated', { tabId: 3, windowId: 1 });
await wait(60);

// браузер открыл новую вкладку В КОНЦЕ (как делает Chromium) — ждём переезда под третью
const fresh = { id: 9, windowId: 1, index: 5, pinned: false, url: 'https://new.com/', openerTabId: 3 };
TABS.push(fresh);
await fire('tabCreated', fresh);
await wait(1200);
console.log('после onCreated порядок:', TABS.map(t => t.id).join(' '), '| ожидается 1 2 3 9 4 5');

// и сценарий Aside: вкладка создана В НАЧАЛЕ списка
TABS = [1,2,3,4,5].map((n,i) => ({ id: n, windowId: 1, index: i, pinned: false, active: n === 3, url: `https://site${n}.com/` }));
await fire('tabActivated', { tabId: 3, windowId: 1 });
const top = { id: 8, windowId: 1, index: 0, pinned: false, url: 'https://top.com/', openerTabId: undefined };
TABS.unshift(top); TABS.forEach((x,n)=>x.index=n);
await fire('tabCreated', top);
await wait(1200);
console.log('вкладка сверху →', TABS.map(t => t.id).join(' '), '| ожидается 1 2 3 8 4 5');
console.log('журнал перемещений:', log.filter(l => l.startsWith('move')).slice(0,6));

// ---------- действия через шину сообщений: ровно так их зовут попап и палитра ----------
const call = (action, extra = {}) => new Promise(res => {
  const handler = (L['msg'] || [])[0];
  if (!handler) return res({ ok: false, error: 'нет обработчика сообщений' });
  handler({ action, ...extra }, {}, res);
});

let fails = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' · ' + detail : '')); if (!ok) fails++; };

// сцена для уборки: дубль, пустая, разные сайты; lastAccessed — где были последней
TABS = [
  { id: 11, windowId: 1, index: 0, pinned: false, active: true, url: 'https://b.com/x', lastAccessed: 200 },
  { id: 12, windowId: 1, index: 1, pinned: false, url: 'https://a.com/', lastAccessed: 300 },
  { id: 13, windowId: 1, index: 2, pinned: false, url: 'https://www.b.com/x/', lastAccessed: 150 },
  { id: 14, windowId: 1, index: 3, pinned: false, url: 'chrome://newtab/' },
  { id: 15, windowId: 1, index: 4, pinned: false, url: 'https://c.com/', lastAccessed: 100 }
];
const stats = await call('getStats');
check('getStats отвечает', stats?.ok && stats.data?.total === 5, JSON.stringify(stats?.data));
check('getStats видит дубль сквозь www и слэш, и пустую вкладку', stats.data?.dups === 1 && stats.data?.empties === 1, JSON.stringify(stats?.data));

const tidy = await call('tidyUp', { windowId: 1 });
await wait(200);
check('tidyUp отработал', tidy?.ok === true, 'закрыто/блоков: ' + tidy?.count);
check('дубль и пустая убраны', TABS.length === 3, 'осталось ' + TABS.map(t => t.id).join(' '));
check('россыпь по свежести: где был последним — сверху', TABS.map(t => t.url).join(' ') === 'https://a.com/ https://b.com/x https://c.com/', TABS.map(t => t.url).join(' '));
check('пары и одиночки блоком не становятся', !log.slice(-12).some(l => l.startsWith('group')), log.slice(-6).join(' | '));

// из двух копий остаётся та, где были последней — не первая попавшаяся
TABS = [
  { id: 61, windowId: 1, index: 0, pinned: false, url: 'https://x.com/p', lastAccessed: 100 },
  { id: 62, windowId: 1, index: 1, pinned: false, url: 'http://x.com/p/', lastAccessed: 900 },
  { id: 63, windowId: 1, index: 2, pinned: false, active: true, url: 'https://y.com/' }
];
const dd = await call('tidyDuplicates');
check('дедуп оставляет свежую копию', dd?.ok && dd.count === 1 && TABS.some(t => t.id === 62) && !TABS.some(t => t.id === 61), TABS.map(t => t.id).join(' '));

// блок собирается от трёх вкладок; пара того же сайта остаётся россыпью сверху
TABS = [
  { id: 51, windowId: 1, index: 0, pinned: false, url: 'https://github.com/1', lastAccessed: 500 },
  { id: 52, windowId: 1, index: 1, pinned: false, url: 'https://a.com/x', lastAccessed: 400 },
  { id: 53, windowId: 1, index: 2, pinned: false, url: 'https://github.com/2', lastAccessed: 300 },
  { id: 54, windowId: 1, index: 3, pinned: false, active: true, url: 'https://a.com/y', lastAccessed: 200 },
  { id: 55, windowId: 1, index: 4, pinned: false, url: 'https://github.com/3', lastAccessed: 100 }
];
let mark = log.length;
await wait(500);   // тогл-команды глушат повтор в пределах 450 мс
await call('tidyUp', { windowId: 1 });
check('tidy: россыпь сверху, блок из трёх ниже', TABS.map(t => t.id).join(' ') === '52 54 51 53 55', TABS.map(t => t.id).join(' '));
check('tidy: собран ровно один блок', log.slice(mark).filter(l => l.startsWith('group')).join('|') === 'group 51,53,55', log.slice(mark).filter(l => l.startsWith('group')).join('|'));

// страница из панели закладок в блок не идёт: сайдбар вплавит её в строку закладки
MARKS = [{ id: 'bh', title: 'one', url: 'https://github.com/1' }];
TABS.forEach((t, i) => { t.index = i; });
mark = log.length;
await wait(500);
await call('tidyUp', { windowId: 1 });
check('tidy: вкладка с закладкой остаётся вне блока, блока из двух нет',
  !log.slice(mark).some(l => l.startsWith('group')) && TABS[0]?.id === 51, TABS.map(t => t.id).join(' '));
MARKS = [];

const pin = await call('pinTab', { windowId: 1 });
check('pinTab закрепил', pin?.ok && pin.count === 1 && TABS.some(t => t.pinned));

// ⌘D — тогл в обе стороны, вкладка при этом жива: закрытие будило бы соседа и он перезагружался
MARKS = [];
TABS = [
  { id: 21, windowId: 1, index: 0, pinned: true, url: 'https://pinned.com/' },
  { id: 22, windowId: 1, index: 1, pinned: false, url: 'https://a.com/' },
  { id: 23, windowId: 1, index: 2, pinned: false, active: true, url: 'https://keep.me/page', groupId: 7 },
  { id: 24, windowId: 1, index: 3, pinned: false, url: 'https://c.com/' }
];
mark = log.length;
const fav = await call('favoriteTab', { windowId: 1 });
check('favoriteTab сделал закладку', fav?.ok && fav.count === 1 && MARKS.length === 1, JSON.stringify(MARKS));
check('вкладка осталась жива — без закрытия и перезагрузки', TABS.some(t => t.id === 23), TABS.map(t => t.id).join(' '));
check('⌘D вывел вкладку из блока — сайдбар вплавит её в строку закладки', log.slice(mark).includes('ungroup 1') && TABS.find(t => t.id === 23)?.groupId === -1, log.slice(mark).join(' | '));
check('вкладка встала первой строкой вкладок, под закреплённой', TABS[1]?.id === 23, TABS.map(t => t.id).join(' '));

// адрес уже открыт — переключение вместо второй вкладки, как в Arc
const before = TABS.length;
const sw = await call('openUrl', { url: 'http://www.a.com', windowId: 1 });
check('openUrl переключается на открытую копию, дубля нет', sw?.count === 2 && TABS.length === before && TABS.find(t => t.id === 22)?.active === true, JSON.stringify(sw) + ' · ' + TABS.length);
TABS.find(t => t.id === 22).active = false;
TABS.find(t => t.id === 23).active = true;

await wait(500);   // защита от двойного срабатывания: повтор в пределах 450 мс глушится
const unfav = await call('favoriteTab', { windowId: 1 });
check('второе нажатие сняло закладку', unfav?.ok && unfav.count === -1 && MARKS.length === 0);
check('вкладка вернулась в самый верх, под закреплённые', TABS[1]?.id === 23, TABS.map(t => t.id).join(' '));

const twice = await call('favoriteTab', { windowId: 1 });
const twiceAgain = await call('favoriteTab', { windowId: 1 });
check('повтор в пределах кадра глушится', twiceAgain?.skipped === true, JSON.stringify(twiceAgain));
await wait(500);
await call('favoriteTab', { windowId: 1 });   // возвращаем сцену: закладки снова нет

// ---------- группировка по смыслу ----------
TABS = [
  { id: 41, windowId: 1, index: 0, pinned: false, active: true, url: 'https://a.com/one', title: 'смета проекта' },
  { id: 42, windowId: 1, index: 1, pinned: false, url: 'https://b.com/two', title: 'договор подряда' },
  { id: 43, windowId: 1, index: 2, pinned: false, url: 'https://c.com/three', title: 'обои для стола' },
  { id: 44, windowId: 1, index: 3, pinned: false, url: 'https://d.com/four', title: 'подбор кресла' }
];
store.local.aiKey = '';
const noKey = await call('groupBySense', { windowId: 1 });
check('без ключа группировка по смыслу не ходит в сеть', noKey?.ok && noKey.count === 0 && !store.session.sensePlan);

store.local.aiKey = 'sk-or-test';
store.local.aiModel = 'anthropic/claude-haiku-4.5';
const markSense = log.length;
let sentBody = null;
globalThis.fetch = async (url, opt) => {
  sentBody = JSON.parse(opt.body);
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({
      groups: [{ name: 'работа', tabs: [0, 1] }, { name: 'дом', tabs: [2, 3] }]
    }) } }] })
  };
};
const plan = await call('groupBySense', { windowId: 1 });
check('предложение собрано', plan?.ok && plan.count === 2, JSON.stringify(plan));
check('план лежит в session, а не применён молча',
  store.session.sensePlan?.groups?.length === 2 && !log.slice(markSense).some(l => l.startsWith('group')),
  JSON.stringify(store.session.sensePlan?.groups?.map(g => g.name)));
const promptText = JSON.stringify(sentBody?.messages || []);
check('наружу уходят только заголовки и хосты',
  promptText.includes('смета проекта') && promptText.includes('a.com') && !promptText.includes('/one'),
  promptText.slice(0, 90));

const applied = await call('senseApply');
check('применение делает группы', applied?.ok && applied.count === 2, 'групп: ' + applied?.count);
check('план после применения стёрт', !store.session.sensePlan);

const opened = await call('sortByOpened', { windowId: 1 });
check('sortByOpened отвечает', opened?.ok === true, 'переставлено ' + opened?.count);

// сцена бага: последним в фокусе оказалось popup-окно палитры, окно не передали
lastFocused = 9;
const blind = await call('sortByOpened');
check('порядок работает, когда последним было окно палитры', blind?.ok === true && blind.count > 0,
  JSON.stringify(blind));
lastFocused = 1;

// открепление возвращает страницу первой строкой вкладок
TABS = [
  { id: 31, windowId: 1, index: 0, pinned: true, active: true, url: 'https://pinned.com/' },
  { id: 32, windowId: 1, index: 1, pinned: false, url: 'https://a.com/' },
  { id: 33, windowId: 1, index: 2, pinned: false, url: 'https://b.com/' }
];
const unpin = await call('pinTab', { windowId: 1 });
check('pinTab открепил', unpin?.ok && unpin.count === -1);
check('открепленная встала первой строкой вкладок', TABS[0]?.id === 31 && !TABS[0].pinned,
  TABS.map(t => t.id + (t.pinned ? '·pin' : '')).join(' '));

console.log(fails ? `\n${fails} провалов` : '\nвсе проверки зелёные');
process.exit(fails ? 1 : 0);
