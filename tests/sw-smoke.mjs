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
  set: (o) => (Object.assign(bag, o), Promise.resolve())
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
    onRemoved: mkEvent('winRemoved'),
    get: id => Promise.resolve({ id, type: 'normal' }),
    getLastFocused: () => Promise.resolve({ id: 1, type: 'normal' }),
    getCurrent: () => Promise.resolve({ id: 1 }),
    update: () => Promise.resolve()
  },
  bookmarks: {
    getChildren: () => Promise.resolve([]), create: o => Promise.resolve({ id: 'b1', ...o }),
    remove: () => Promise.resolve(), move: () => Promise.resolve(), search: () => Promise.resolve([]), getRecent: () => Promise.resolve([])
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

// сцена для уборки: дубль, пустая, разные сайты
TABS = [
  { id: 11, windowId: 1, index: 0, pinned: false, active: true, url: 'https://b.com/x' },
  { id: 12, windowId: 1, index: 1, pinned: false, url: 'https://a.com/' },
  { id: 13, windowId: 1, index: 2, pinned: false, url: 'https://b.com/x' },
  { id: 14, windowId: 1, index: 3, pinned: false, url: 'chrome://newtab/' },
  { id: 15, windowId: 1, index: 4, pinned: false, url: 'https://c.com/' }
];
const stats = await call('getStats');
check('getStats отвечает', stats?.ok && stats.data?.total === 5, JSON.stringify(stats?.data));

const tidy = await call('tidyUp', { windowId: 1 });
await wait(200);
check('tidyUp отработал', tidy?.ok === true, 'закрыто/групп: ' + tidy?.count);
check('дубль и пустая убраны', TABS.length === 3, 'осталось ' + TABS.map(t => t.id).join(' '));
check('порядок по сайту', TABS.map(t => t.url).join(' ') === 'https://a.com/ https://b.com/x https://c.com/', TABS.map(t => t.url).join(' '));

const pin = await call('pinTab', { windowId: 1 });
check('pinTab закрепил', pin?.ok && pin.count === 1 && TABS.some(t => t.pinned));

const fav = await call('favoriteTab', { windowId: 1 });
check('favoriteTab положил закладку и закрыл вкладку', fav?.ok && fav.count === 1);

const opened = await call('sortByOpened', { windowId: 1 });
check('sortByOpened отвечает', opened?.ok === true, 'переставлено ' + opened?.count);

console.log(fails ? `\n${fails} провалов` : '\nвсе проверки зелёные');
process.exit(fails ? 1 : 0);
