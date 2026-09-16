// подставной chrome: гоняем реальный background.js вне браузера и смотрим,
// что он делает с вкладками – это ловит и ошибки загрузки, и логику
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
  tabGroups: {
    query: (q = {}) => Promise.resolve(GROUPS.filter(g => q.windowId == null || g.windowId === q.windowId)
      .filter(g => q.title == null || g.title === q.title)),
    update: (id, props) => { Object.assign(GROUPS.find(g => g.id === id) || {}, props); return Promise.resolve(); }
  },
  tabs: {
    onCreated: mkEvent('tabCreated'), onRemoved: mkEvent('tabRemoved'), onUpdated: mkEvent('tabUpdated'),
    onActivated: mkEvent('tabActivated'), onMoved: mkEvent('tabMoved'), onDetached: mkEvent('d'), onAttached: mkEvent('a'), onReplaced: mkEvent('r'),
    query: (q = {}) => Promise.resolve(TABS.filter(t =>
      (q.windowId == null || t.windowId === q.windowId) &&
      (q.pinned == null || t.pinned === q.pinned) &&
      (q.active == null || t.active === q.active) &&
      (q.highlighted == null || !!t.highlighted === q.highlighted) &&
      (q.groupId == null || t.groupId === q.groupId) &&
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
    update: (id, p) => {
      const t = TABS.find(x => x.id === id);
      // выбор в окне один: браузер снимает активность с прежней вкладки сам
      if (t && p.active) for (const x of TABS) if (x.windowId === t.windowId) x.active = x.id === id;
      Object.assign(t || {}, p);
      return Promise.resolve();
    },
    group: ({ tabIds, groupId }) => {
      log.push('group ' + tabIds.join(',') + (groupId ? ' → ' + groupId : ''));
      let gid = groupId;
      if (gid == null) {
        gid = ++groupSeq;
        const host = TABS.find(t => t.id === tabIds[0]);
        GROUPS.push({ id: gid, windowId: host?.windowId ?? 1, title: '', collapsed: false });
      }
      for (const id of tabIds) { const t = TABS.find(x => x.id === id); if (t) t.groupId = gid; }
      return Promise.resolve(gid);
    },
    ungroup: ids => {
      log.push('ungroup ' + [].concat(ids).length);
      for (const id of [].concat(ids)) { const t = TABS.find(x => x.id === id); if (t) t.groupId = -1; }
      GROUPS = GROUPS.filter(g => TABS.some(t => t.groupId === g.id));
      return Promise.resolve();
    },
    discard: () => Promise.resolve(),
    // content script есть только на страницах из LAYER_OK: ping → pong, палитра → shown
    sendMessage: (id, msg, opts, cb) => {
      const callback = typeof opts === 'function' ? opts : cb;
      if (callback) { callback(); return; }          // тосты и dim идут колбэком – ответ не нужен
      const t = TABS.find(x => x.id === id);
      if (msg?.type === 'reviewProtection') return Promise.resolve({ dirty: DIRTY.has(id) });
      if (!t || !LAYER_OK.has(id)) return Promise.reject(new Error('no receiver'));
      sent.push({ id, ...msg });
      if (msg?.type === 'ping') return Promise.resolve({ pong: true, top: true });
      if (msg?.type === 'palette') return Promise.resolve({ shown: true });
      return Promise.resolve();
    }
  }
};
const LAYER_OK = new Set();
const DIRTY = new Set();
const sent = [];

// окна: обычное рабочее и popup-окно палитры – «последнее в фокусе» бывает вторым
const WINS = { 1: { id: 1, type: 'normal', focused: true }, 2: { id: 2, type: 'normal' }, 9: { id: 9, type: 'popup' } };
let lastFocused = 1;

let MARKS = [];
let markId = 0;

// блоки окна: ⌘-цифра адресует их по позиции первой вкладки
let GROUPS = [];
let groupSeq = 0;

let loadError = null;
try {
  const code = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8');
  new Function(code)();
} catch (e) { loadError = String(e); }
console.log('LOAD ERROR:', loadError || 'нет – service worker поднялся');

const wait = ms => new Promise(r => setTimeout(r, ms));
const fire = (name, ...args) => Promise.all((L[name] || []).map(f => f(...args)));

// сцена: 5 вкладок, активна третья (в середине)
TABS = [1,2,3,4,5].map((n,i) => ({ id: n, windowId: 1, index: i, pinned: false, active: n === 3, url: `https://site${n}.com/` }));
await fire('tabActivated', { tabId: 3, windowId: 1 });
await wait(60);

// браузер открыл новую вкладку В КОНЦЕ (как делает Chromium) – ждём переезда под третью
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
const callFrom = (action, tabId, extra = {}) => new Promise(res => {
  const handler = (L['msg'] || [])[0];
  handler({ action, ...extra }, { tab: TABS.find(t => t.id === tabId) }, res);
});

// сцена для уборки: дубль, пустая, разные сайты; lastAccessed – где были последней
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
check('tidyUp открыл review и сам ничего не закрыл', tidy?.ok === true && tidy.count === 0 && TABS.length === 5, JSON.stringify(tidy));
const reviewBeforeTidy = await call('previewTabReview', { windowId: 1 });
check('review разделяет exact cleanup и защищает активную', reviewBeforeTidy?.data?.summary?.exactClosable === 2 && reviewBeforeTidy.data.clusters[0]?.tabs.some(t => t.active && t.canonical), JSON.stringify(reviewBeforeTidy?.data?.summary));
const tidyApplied = await call('applyReviewBatch', { clusterKey: 'all-exact', intent: 'tidy', windowId: 1 });
check('tidy применяется только из строки подтверждения', tidyApplied?.ok && tidyApplied.count === 2 && tidyApplied.data?.receipt?.closed?.length === 2, JSON.stringify(tidyApplied));
check('receipt перечисляет canonical вкладку каждого exact-кластера', tidyApplied.data?.receipt?.keptTabs?.length === 1 && tidyApplied.data.receipt.keptTabs[0].url === 'https://b.com/x', JSON.stringify(tidyApplied.data?.receipt));
check('дубль и пустая убраны', TABS.length === 3, 'осталось ' + TABS.map(t => t.id).join(' '));
check('россыпь по свежести: где был последним – сверху', TABS.map(t => t.url).join(' ') === 'https://a.com/ https://b.com/x https://c.com/', TABS.map(t => t.url).join(' '));
check('пары и одиночки блоком не становятся', !log.slice(-12).some(l => l.startsWith('group')), log.slice(-6).join(' | '));

// из двух копий остаётся та, где были последней – не первая попавшаяся
TABS = [
  { id: 61, windowId: 1, index: 0, pinned: false, url: 'https://x.com/p', lastAccessed: 100 },
  { id: 62, windowId: 1, index: 1, pinned: false, url: 'http://x.com/p/', lastAccessed: 900 },
  { id: 63, windowId: 1, index: 2, pinned: false, active: true, url: 'https://y.com/' }
];
const dd = await call('tidyDuplicates');
check('дедуп-команда открывает review и не закрывает молча', dd?.ok && dd.count === 0 && TABS.length === 3, JSON.stringify(dd));
const ddApplied = await call('applyReviewBatch', { clusterKey: 'all-exact', intent: 'review', windowId: 1 });
check('после подтверждения остаётся свежая копия', ddApplied?.count === 1 && TABS.some(t => t.id === 62) && !TABS.some(t => t.id === 61), TABS.map(t => t.id).join(' '));

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
await call('applyReviewBatch', { clusterKey: 'all-exact', intent: 'tidy', windowId: 1 });
check('tidy: россыпь сверху, блок из трёх ниже', TABS.map(t => t.id).join(' ') === '52 54 51 53 55', TABS.map(t => t.id).join(' '));
check('tidy: собран ровно один блок', log.slice(mark).filter(l => l.startsWith('group')).join('|') === 'group 51,53,55', log.slice(mark).filter(l => l.startsWith('group')).join('|'));

// страница из панели закладок в блок не идёт: сайдбар вплавит её в строку закладки
MARKS = [{ id: 'bh', title: 'one', url: 'https://github.com/1' }];
TABS.forEach((t, i) => { t.index = i; });
mark = log.length;
await wait(500);
await call('tidyUp', { windowId: 1 });
await call('applyReviewBatch', { clusterKey: 'all-exact', intent: 'tidy', windowId: 1 });
check('tidy: вкладка с закладкой остаётся вне блока, блока из двух нет',
  !log.slice(mark).some(l => l.startsWith('group')) && TABS[0]?.id === 51, TABS.map(t => t.id).join(' '));
MARKS = [];

const pin = await call('pinTab', { windowId: 1 });
check('pinTab закрепил', pin?.ok && pin.count === 1 && TABS.some(t => t.pinned));

// ⌘D – тогл в обе стороны, вкладка при этом жива: закрытие будило бы соседа и он перезагружался
MARKS = [];
TABS = [
  { id: 21, windowId: 1, index: 0, pinned: true, url: 'https://pinned.com/' },
  { id: 22, windowId: 1, index: 1, pinned: false, url: 'https://a.com/' },
  { id: 23, windowId: 1, index: 2, pinned: false, active: true, url: 'https://keep.me/page', groupId: 7 },
  { id: 24, windowId: 1, index: 3, pinned: false, url: 'https://c.com/' }
];
mark = log.length;
// прежняя механика (v4.14) – при выключенном закрытии
store.sync.favoriteCloses = false;
await fire('storeChanged', { favoriteCloses: { newValue: false } }, 'sync');
await wait(20);
const fav = await call('favoriteTab', { windowId: 1 });
check('favoriteTab сделал закладку', fav?.ok && fav.count === 1 && MARKS.length === 1, JSON.stringify(MARKS));
check('вкладка осталась жива – без закрытия и перезагрузки', TABS.some(t => t.id === 23), TABS.map(t => t.id).join(' '));
check('⌘D вывел вкладку из блока – сайдбар вплавит её в строку закладки', log.slice(mark).includes('ungroup 1') && TABS.find(t => t.id === 23)?.groupId === -1, log.slice(mark).join(' | '));
check('порядок вкладок ⌘D не трогает', TABS.map(t => t.id).join(' ') === '21 22 23 24', TABS.map(t => t.id).join(' '));

// адрес уже открыт – переключение вместо второй вкладки, как в Arc
const before = TABS.length;
const sw = await call('openUrl', { url: 'http://www.a.com', windowId: 1 });
check('openUrl переключается на открытую копию, дубля нет', sw?.count === 2 && TABS.length === before && TABS.find(t => t.id === 22)?.active === true, JSON.stringify(sw) + ' · ' + TABS.length);
TABS.find(t => t.id === 22).active = false;
TABS.find(t => t.id === 23).active = true;

await wait(500);   // защита от двойного срабатывания: повтор в пределах 450 мс глушится
const unfav = await call('favoriteTab', { windowId: 1 });
check('второе нажатие сняло закладку', unfav?.ok && unfav.count === -1 && MARKS.length === 0);
check('снятие закладки порядок тоже не трогает', TABS.map(t => t.id).join(' ') === '21 22 23 24', TABS.map(t => t.id).join(' '));

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

// близнецы по заголовку: четыре «AIM VISUAL» с разными query-строками – одна страница
TABS = [
  { id: 41, windowId: 1, index: 0, pinned: false, active: true, url: 'https://visual-team.aimindset.org/?lab=s26&section=youtube', title: 'AIM VISUAL', lastAccessed: 400 },
  { id: 42, windowId: 1, index: 1, pinned: false, url: 'https://visual-team.aimindset.org/?lab=refpack&section=library', title: '💤 AIM VISUAL', lastAccessed: 300, discarded: true },
  { id: 43, windowId: 1, index: 2, pinned: false, url: 'https://visual-team.aimindset.org/', title: '💤 AIM VISUAL', lastAccessed: 200, discarded: true },
  { id: 44, windowId: 1, index: 3, pinned: false, url: 'https://visual-team.aimindset.org/?lab=s26&section=wide&copy=abc', title: 'AIM VISUAL', lastAccessed: 100 },
  { id: 45, windowId: 1, index: 4, pinned: false, url: 'https://github.com/aPoWall/aside-tweaks', title: 'aPoWall/aside-tweaks', lastAccessed: 50 },
  { id: 46, windowId: 1, index: 5, pinned: false, url: 'https://github.com/aPoWall/language-relay', title: 'aPoWall/language-relay', lastAccessed: 40 },
  { id: 47, windowId: 1, index: 6, pinned: false, url: 'https://example.com/a', title: 'New Tab', lastAccessed: 30 },
  { id: 48, windowId: 1, index: 7, pinned: false, url: 'https://example.com/b', title: 'New Tab', lastAccessed: 20 }
];
const near = await call('getStats');
check('близнецы по заголовку считаются: 4 AIM VISUAL → 3 лишних', near?.data?.dups === 3, JSON.stringify(near?.data));
check('twinOf отдаёт размер кластера на каждую вкладку', near?.data?.twinOf?.[41] === 4 && near?.data?.twinOf?.[44] === 4 && !near?.data?.twinOf?.[45], JSON.stringify(near?.data?.twinOf));
check('разные заголовки на одном хосте и «New Tab» близнецами не считаются', !near?.data?.twinOf?.[46] && !near?.data?.twinOf?.[47], JSON.stringify(near?.data?.twinOf));
const nearReview = await call('previewTabReview', { windowId: 1 });
check('review показывает exact-кластер до закрытия', nearReview?.data?.clusters?.some(c => c.kind === 'exact' && c.tabs.length === 4 && c.closeIds.length === 3), JSON.stringify(nearReview?.data?.summary));
const nearClean = await call('applyReviewBatch', { clusterKey: 'all-exact', intent: 'review', windowId: 1 });
check('подтверждённая чистка закрыла трёх близнецов и оставила активную', nearClean?.count === 3 && TABS.some(t => t.id === 41) && ![42, 43, 44].some(id => TABS.some(t => t.id === id)), TABS.map(t => t.id).join(' '));

// тумблер выключен – те же вкладки чистка не трогает
await fire('storeChanged', { dedupByTitle: { newValue: false } }, 'sync');
store.sync.dedupByTitle = false;
await wait(30);
TABS = [
  { id: 41, windowId: 1, index: 0, pinned: false, active: true, url: 'https://visual-team.aimindset.org/?lab=s26', title: 'AIM VISUAL', lastAccessed: 400 },
  { id: 42, windowId: 1, index: 1, pinned: false, url: 'https://visual-team.aimindset.org/?lab=refpack', title: 'AIM VISUAL', lastAccessed: 300 }
];
const strict = await call('getStats');
check('dedupByTitle выключен – только точный адрес', strict?.data?.dups === 0, JSON.stringify(strict?.data));
store.sync.dedupByTitle = true;
await fire('storeChanged', { dedupByTitle: { newValue: true } }, 'sync');

// semantic review: один продукт на разных хостах, отдельные event и research,
// canonical + dirty-form защита, явное имя и receipt после подтверждения
TABS = [
  { id: 121, windowId: 1, index: 0, pinned: false, url: 'https://space.aimindset.org/#evolution', title: 'AI Mindset {space} · evolution', lastAccessed: 500 },
  { id: 122, windowId: 1, index: 1, pinned: false, url: 'https://space-dataflow.aimindset.org/?step=q6', title: 'AI Mindset · Space Dataflow', lastAccessed: 400 },
  { id: 123, windowId: 1, index: 2, pinned: false, url: 'http://127.0.0.1:8916/?present=1', title: 'AI Mindset {space} · session', lastAccessed: 300 },
  { id: 124, windowId: 1, index: 3, pinned: false, url: 'https://calendly.com/example/30min', title: 'Calendly event', lastAccessed: 200 },
  { id: 125, windowId: 1, index: 4, pinned: false, active: true, url: 'https://youtube.com/watch?v=abc', title: 'Research talk – YouTube', lastAccessed: 600 }
];
DIRTY.add(122);
const semantic = await call('previewTabReview', { windowId: 1 });
const spaceCluster = semantic?.data?.clusters?.find(c => c.kind === 'related' && c.tabs.length === 3);
check('semantic review собирает Space на разных хостах', !!spaceCluster, JSON.stringify(semantic?.data?.clusters?.map(c => [c.kind, c.name, c.tabs.length])));
check('event и research остаются отдельными классами', semantic?.data?.events?.some(t => t.id === 124) && semantic?.data?.references?.some(t => t.id === 125), JSON.stringify(semantic?.data?.summary));
check('несохранённая форма защищена', spaceCluster?.tabs?.find(t => t.id === 122)?.protections?.includes('unsaved form'), JSON.stringify(spaceCluster?.tabs?.find(t => t.id === 122)));
const named = await call('renameReviewCluster', { clusterKey: spaceCluster.key, name: 'Space product', windowId: 1 });
check('кластер получает явное имя', named?.data?.name === 'Space product', JSON.stringify(named));
const kept = await call('setReviewCanonical', { clusterKey: spaceCluster.key, tabId: 121, windowId: 1 });
check('canonical сохраняется и получает receipt', kept?.ok && kept.data?.receipt?.kept?.url?.includes('space.aimindset.org'), JSON.stringify(kept));
const semantic2 = await call('previewTabReview', { windowId: 1 });
const namedSpace = semantic2?.data?.clusters?.find(c => c.key === spaceCluster.key);
check('canonical и имя переживают повторный preview', namedSpace?.name === 'Space product' && namedSpace?.canonicalId === 121 && namedSpace.tabs.find(t => t.id === 121)?.protections?.includes('marked'), JSON.stringify(namedSpace));
const closedSpace = await call('applyReviewBatch', { clusterKey: spaceCluster.key, intent: 'review', windowId: 1 });
check('batch закрывает только безопасного sibling, canonical и dirty остаются', closedSpace?.count === 1 && TABS.some(t => t.id === 121) && TABS.some(t => t.id === 122) && !TABS.some(t => t.id === 123), TABS.map(t => t.id).join(' '));
check('batch пишет source receipt', closedSpace?.data?.receipt?.action === 'close reviewed siblings' && closedSpace.data.receipt.closed.length === 1, JSON.stringify(closedSpace?.data?.receipt));
DIRTY.clear();

// сигнальная страница моста, путь 1: прежняя вкладка умеет слой – сигнальная закрывается, палитра там
TABS = [
  { id: 71, windowId: 1, index: 0, pinned: false, url: 'https://docs.example/page', title: 'Docs', lastAccessed: 500 },
  { id: 72, windowId: 1, index: 1, pinned: false, url: 'https://old.example/', title: 'Old', lastAccessed: 100 },
  { id: 73, windowId: 1, index: 2, pinned: false, active: true, url: 'http://127.0.0.1:49321/aside-tweaks/palette?q=mini', title: 'aside tweaks' }
];
LAYER_OK.add(71); sent.length = 0;
const sig1 = await callFrom('paletteSignal', 73, { q: 'mini' });
const pal1 = sent.find(m => m.type === 'palette');
check('сигнал: прежняя вкладка по свежести, не по индексу', pal1?.id === 71 && pal1?.tab === 71, JSON.stringify(pal1));
check('сигнал: запрос доехал до палитры', pal1?.q === 'mini' && !pal1?.signal);
check('сигнал: сигнальная вкладка закрыта, прежняя активна', sig1?.count === 1 && !TABS.some(t => t.id === 73) && TABS.find(t => t.id === 71)?.active === true, TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));

// путь 2: прежняя без content script – палитра на сигнальной странице, после закрытия та уходит
TABS = [
  { id: 81, windowId: 1, index: 0, pinned: false, url: 'about:blank', title: '', lastAccessed: 500 },
  { id: 82, windowId: 1, index: 1, pinned: false, active: true, url: 'http://127.0.0.1:49321/aside-tweaks/palette', title: 'aside tweaks' }
];
LAYER_OK.clear(); LAYER_OK.add(82); sent.length = 0;
const sig2 = await callFrom('paletteSignal', 82);
const pal2 = sent.find(m => m.type === 'palette');
check('сигнал без слоя рядом: палитра на самой сигнальной странице', sig2?.count === 2 && pal2?.id === 82 && pal2?.signal === true && pal2?.tab === 81, JSON.stringify(pal2));
check('сигнальная вкладка пока жива', TABS.some(t => t.id === 82));
const done2 = await callFrom('signalDone', 82);
check('после закрытия: сигнальная ушла, прежняя вернулась', done2?.count === 1 && !TABS.some(t => t.id === 82) && TABS.find(t => t.id === 81)?.active === true, TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));

// выбор из палитры уже активировал другую вкладку – назад на прежнюю не возвращаемся
TABS = [
  { id: 91, windowId: 1, index: 0, pinned: false, url: 'about:blank', lastAccessed: 500 },
  { id: 92, windowId: 1, index: 1, pinned: false, url: 'https://target.example/', title: 'Target', lastAccessed: 50 },
  { id: 93, windowId: 1, index: 2, pinned: false, active: true, url: 'http://127.0.0.1:49321/aside-tweaks/palette' }
];
LAYER_OK.clear(); LAYER_OK.add(93);
await callFrom('paletteSignal', 93);
TABS.forEach(t => t.active = t.id === 92);   // палитра переключила на цель
await callFrom('signalDone', 93);
check('переключение из палитры сильнее возврата', TABS.find(t => t.id === 92)?.active === true && !TABS.some(t => t.id === 93), TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));

// ⌘D по умолчанию 4.21: закладка уходит в КОНЕЦ панели, вкладка живёт и остаётся выбранной
store.sync.favoriteCloses = false;
store.sync.favoriteMovesTab = false;
await fire('storeChanged', { favoriteCloses: { newValue: false }, favoriteMovesTab: { newValue: false } }, 'sync');
await wait(20);
MARKS = [{ id: 'existing', title: 'Existing', url: 'https://existing.example/', index: 0, parentId: '1' }];
TABS = [
  { id: 101, windowId: 1, index: 0, pinned: true, url: 'https://pinned.example/', title: 'Pinned', lastAccessed: 999 },
  { id: 102, windowId: 1, index: 1, pinned: false, url: 'https://prev.example/', title: 'Previous', lastAccessed: 900 },
  { id: 103, windowId: 1, index: 2, pinned: false, active: true, url: 'https://keep.example/page', title: 'Keep me', lastAccessed: 950 },
  { id: 104, windowId: 1, index: 3, pinned: false, url: 'https://next.example/', title: 'Next', lastAccessed: 50 }
];
await wait(500);   // защита от повтора: то же действие в пределах 450 мс глушится
const favArc = await call('favoriteTab', { windowId: 1 });
check('⌘D: закладка встаёт в конец панели, строки выше не съезжают',
  favArc?.count === 1 && MARKS.length === 2 && MARKS[0].id === 'existing' && MARKS[1].url === 'https://keep.example/page',
  JSON.stringify(MARKS.map(b => b.url)));
check('⌘D: вкладка осталась открытой и выбранной',
  TABS.find(t => t.id === 103)?.active === true && TABS.some(t => t.id === 103), TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));
check('⌘D: порядок вкладок не перескочил', TABS.map(t => t.id).join(' ') === '101 102 103 104', TABS.map(t => t.id).join(' '));
await wait(500);
const unfavArc = await call('favoriteTab', { windowId: 1 });
check('⌘D второй раз снимает строку, вкладка на месте',
  unfavArc?.count === -1 && MARKS.length === 1 && TABS.find(t => t.id === 103)?.active === true, JSON.stringify(MARKS.map(b => b.url)));

// прежнее поведение остаётся настройкой: включили закрытие – вкладка закрывается, фокус идёт дальше
store.sync.favoriteCloses = true;
await fire('storeChanged', { favoriteCloses: { newValue: true } }, 'sync');
await wait(520);
const favClose = await call('favoriteTab', { windowId: 1 });
check('настройка «после ⌘D вкладка закрывается» работает', favClose?.count === 1 && !TABS.some(t => t.id === 103), TABS.map(t => t.id).join(' '));
check('⌘D с закрытием: фокус на следующей незакреплённой, pinned не будится',
  TABS.find(t => t.id === 104)?.active === true && !TABS.find(t => t.id === 101)?.active, TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));
store.sync.favoriteCloses = false;
await fire('storeChanged', { favoriteCloses: { newValue: false } }, 'sync');
await wait(20);

// единственная вкладка окна не закрывается – иначе закроется окно
MARKS = [];
TABS = [{ id: 111, windowId: 1, index: 0, pinned: false, active: true, url: 'https://only.example/', title: 'Only', lastAccessed: 10 }];
await wait(500);
await call('favoriteTab', { windowId: 1 });
check('⌘D на единственной вкладке: закладка есть, вкладка живёт', MARKS.length === 1 && TABS.some(t => t.id === 111));

// ---------- чистка дубликатов: от команды до закрытых вкладок ----------
//
// Регрессия 4.20: applyDuplicateCleanup вызывалась только из applyTidyUp, а та не висела
// ни на клавише, ни на строке интерфейса. Тест держит цепочку целиком: число в попапе,
// подтверждение, закрытые вкладки, квитанция.
MARKS = [{ id: 'bm1', title: 'Doc', url: 'https://doc.example/a', index: 0, parentId: '1' }];
GROUPS = [];
TABS = [
  { id: 201, windowId: 1, index: 0, pinned: false, active: true, url: 'https://home.example/', title: 'Home', lastAccessed: 900 },
  { id: 202, windowId: 1, index: 1, pinned: false, url: 'https://doc.example/a', title: 'Doc', lastAccessed: 800 },
  { id: 203, windowId: 1, index: 2, pinned: false, url: 'https://www.doc.example/a/', title: 'Doc', lastAccessed: 700 },
  { id: 204, windowId: 2, index: 0, pinned: false, url: 'https://doc.example/a?utm_source=x', title: 'Doc', lastAccessed: 600 },
  { id: 205, windowId: 2, index: 1, pinned: false, url: 'chrome://newtab/', title: 'New tab' },
  { id: 206, windowId: 2, index: 2, pinned: true, url: 'https://doc.example/a', title: 'Doc pinned', lastAccessed: 500 }
];
WINS[2] = { id: 2, type: 'normal' };

const sweepPlan = await call('previewDuplicateCleanup');
check('предпросмотр чистки видит копии во всех окнах',
  sweepPlan?.data?.closes === 3 && sweepPlan.data.windows === 2, JSON.stringify(sweepPlan?.data?.closes) + ' · окон ' + sweepPlan?.data?.windows);
const statsClean = await call('getStats');
check('число в попапе равно тому, что закроет подтверждение',
  statsClean?.data?.closable === sweepPlan.data.closes, `${statsClean?.data?.closable} vs ${sweepPlan?.data?.closes}`);
check('закладка не защищает копию внутри точного кластера',
  sweepPlan.data.blocked.every(b => !b.reasons.includes('bookmarked')), JSON.stringify(sweepPlan.data.blocked));

const swept = await call('applyDuplicateCleanup');
check('подтверждение действительно закрывает дубли и пустую вкладку',
  swept?.data?.closed === 3 && !TABS.some(t => [203, 204, 205].includes(t.id)), TABS.map(t => t.id).join(' '));
check('хранитель, закреплённая и активная остались',
  TABS.map(t => t.id).sort((a, b) => a - b).join(' ') === '201 202 206', TABS.map(t => t.id).join(' '));
check('чистка пишет квитанцию с закрытыми и оставленными',
  swept.data?.receipt?.closed?.length === 3 && swept.data.receipt.keptTabs?.length >= 1, JSON.stringify(swept.data?.receipt?.action));
const emptyPlan = await call('previewDuplicateCleanup');
check('после чистки закрывать больше нечего', emptyPlan?.data?.closes === 0, JSON.stringify(emptyPlan?.data?.closes));
delete WINS[2];

// команда ⌥⌘D остаётся входом в review и сама ничего не закрывает
const reviewOnly = await call('tidyDuplicates', { windowId: 1 });
check('⌥⌘D открывает review, не закрывая вкладки', reviewOnly?.ok && TABS.length === 3, JSON.stringify(reviewOnly));

// ---------- ⌘-цифра: блоки окна ----------
MARKS = [];
GROUPS = [];
TABS = [
  { id: 301, windowId: 1, index: 0, pinned: false, active: true, url: 'https://loose.example/', title: 'Loose', lastAccessed: 900 },
  { id: 302, windowId: 1, index: 1, pinned: false, url: 'https://work.example/1', title: 'Work one', lastAccessed: 800, groupId: -1 },
  { id: 303, windowId: 1, index: 2, pinned: false, url: 'https://work.example/2', title: 'Work two', lastAccessed: 700, groupId: -1 },
  { id: 304, windowId: 1, index: 3, pinned: false, url: 'https://read.example/1', title: 'Read one', lastAccessed: 600, groupId: -1 }
];
GROUPS = [
  { id: 11, windowId: 1, title: 'work', collapsed: false },
  { id: 12, windowId: 1, title: 'read', collapsed: true }
];
TABS.find(t => t.id === 302).groupId = 11;
TABS.find(t => t.id === 303).groupId = 11;
TABS.find(t => t.id === 304).groupId = 12;

const blockList = await call('listBlocks', { windowId: 1 });
check('блоки нумеруются по положению в окне',
  blockList?.data?.blocks.map(b => b.n + ':' + b.title).join(' ') === '1:work 2:read', JSON.stringify(blockList?.data?.blocks));
const gotoBlock = await call('focusBlock', { n: 2, windowId: 1 });
check('⌘2 разворачивает блок и выбирает его вкладку',
  gotoBlock?.data?.ok && TABS.find(t => t.id === 304)?.active === true && GROUPS.find(g => g.id === 12)?.collapsed === false,
  TABS.map(t => t.id + (t.active ? '·act' : '')).join(' '));
// номер без блока не пропадает: он значит вкладку по позиции, как в браузере (⌘9 = последняя)
const thirdTab = await call('focusBlock', { n: 3, windowId: 1 });
check('⌘3 без третьего блока выбирает третью вкладку окна',
  thirdTab?.data?.ok === true && thirdTab?.data?.fallback === 'tab' && TABS.find(t => t.id === 303)?.active === true,
  JSON.stringify(thirdTab?.data));
const lastTab = await call('focusBlock', { n: 9, windowId: 1 });
check('⌘9 без девятого блока выбирает последнюю вкладку окна',
  lastTab?.data?.ok === true && TABS.find(t => t.id === 304)?.active === true, JSON.stringify(lastTab?.data));
const missing = await call('focusBlock', { n: 7, windowId: 1 });
check('⌘7 без седьмого блока и без седьмой вкладки говорит об этом и ничего не трогает',
  missing?.data?.ok === false && missing?.data?.fallback === 'none', JSON.stringify(missing?.data));
// проверка про ⇧⌘1 начинается с вкладки 304, как и до появления запасного хода по цифре
TABS.forEach(t => { t.active = t.id === 304; });
const put = await call('putInBlock', { n: 1, windowId: 1 });
check('⇧⌘1 кладёт текущую вкладку в первый блок и оставляет её выбранной',
  put?.data?.ok && TABS.find(t => t.id === 304)?.groupId === 11 && TABS.find(t => t.id === 304)?.active === true,
  TABS.map(t => t.id + ':' + t.groupId).join(' '));

// следующий свободный номер заводит блок: ⇧⌘N всегда кладёт вкладку куда-то
const nextBlock = await call('putInBlock', { n: 3, windowId: 1 });
check('⇧⌘3 в окне с двумя блоками заводит третий и кладёт в него вкладку',
  nextBlock?.data?.ok === true && nextBlock?.data?.created === true &&
  GROUPS.some(g => g.title === 'block 3'), JSON.stringify(nextBlock?.data));
const farBlock = await call('putInBlock', { n: 8, windowId: 1 });
check('⇧⌘8 через номер не заводит блок и говорит про следующий свободный',
  farBlock?.data?.ok === false, JSON.stringify(farBlock?.data));

// ---------- жест Arc: блок из выбранных вкладок ----------
GROUPS = [];
TABS = [
  { id: 401, windowId: 1, index: 0, pinned: false, active: true, highlighted: true, url: 'https://lab.example/one', title: 'AI Mindset lab one', groupId: -1 },
  { id: 402, windowId: 1, index: 1, pinned: false, highlighted: true, url: 'https://lab.example/two', title: 'AI Mindset lab two', groupId: -1 },
  { id: 403, windowId: 1, index: 2, pinned: false, url: 'https://other.example/', title: 'Other', groupId: -1 }
];
const madeBlock = await call('blockSelected', { windowId: 1 });
check('выбранные вкладки становятся одним именованным блоком',
  madeBlock?.count === 2 && GROUPS.length === 1 && !!GROUPS[0].title && TABS.filter(t => t.groupId === GROUPS[0].id).length === 2,
  JSON.stringify(GROUPS));
TABS.forEach(t => { t.highlighted = t.id === 403; });
const noBlock = await call('blockSelected', { windowId: 1 });
check('одна выбранная строка блока не собирает', noBlock?.count === 0, JSON.stringify(noBlock));
const folded = await call('foldBlocks', { windowId: 1 });
check('одна команда сворачивает все блоки окна', folded?.count === 1 && GROUPS.every(g => g.collapsed), JSON.stringify(GROUPS));


// ---------- чистка не закрывает окно целиком ----------
// второе окно целиком состоит из межоконных дублей: план обязан оставить в нём вкладку
TABS = [
  { id: 71, windowId: 1, index: 0, pinned: false, active: true, url: 'https://a.com/x', lastAccessed: 900 },
  { id: 72, windowId: 1, index: 1, pinned: false, url: 'https://b.com/y', lastAccessed: 800 },
  { id: 73, windowId: 2, index: 0, pinned: false, url: 'https://a.com/x', lastAccessed: 100 },
  { id: 74, windowId: 2, index: 1, pinned: false, url: 'https://b.com/y', lastAccessed: 100 }
];
const crossPlan = await call('previewDuplicateCleanup');
const leftIn = (wid, ids) => TABS.filter(t => t.windowId === wid && !ids.includes(t.id)).length;
check('план чистки оставляет вкладку в каждом окне',
  leftIn(2, crossPlan?.data?.closeIds || []) >= 1 && (crossPlan?.data?.closeIds || []).length === 1,
  JSON.stringify(crossPlan?.data?.closeIds));
check('последняя вкладка окна попадает в blocked с причиной',
  (crossPlan?.data?.blocked || []).some(b => b.reasons.includes('last tab in its window')),
  JSON.stringify(crossPlan?.data?.blocked));

// дубль плюс пустая в том же окне: тоже не опустошать
TABS = [
  { id: 81, windowId: 1, index: 0, pinned: false, active: true, url: 'https://a.com/x', lastAccessed: 900 },
  { id: 82, windowId: 2, index: 0, pinned: false, url: 'https://a.com/x', lastAccessed: 100 },
  { id: 83, windowId: 2, index: 1, pinned: false, url: 'chrome://newtab/' }
];
const mixedPlan = await call('previewDuplicateCleanup');
check('дубль и пустая в одном окне не закрываются обе',
  leftIn(2, mixedPlan?.data?.closeIds || []) >= 1, JSON.stringify(mixedPlan?.data?.closeIds));

// обычный случай не изменился: дубль и пустая внутри одного окна уходят
TABS = [
  { id: 91, windowId: 1, index: 0, pinned: false, active: true, url: 'https://a.com/x', lastAccessed: 900 },
  { id: 92, windowId: 1, index: 1, pinned: false, url: 'https://a.com/x/', lastAccessed: 100 },
  { id: 93, windowId: 1, index: 2, pinned: false, url: 'chrome://newtab/' },
  { id: 94, windowId: 1, index: 3, pinned: false, url: 'https://c.com/' }
];
const plainPlan = await call('previewDuplicateCleanup');
check('обычная чистка в одном окне закрывает дубль и пустую',
  (plainPlan?.data?.closeIds || []).sort().join(',') === '92,93', JSON.stringify(plainPlan?.data?.closeIds));

console.log(fails ? `\n${fails} провалов` : '\nвсе проверки зелёные');
process.exit(fails ? 1 : 0);
