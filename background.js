// Aside Tweaks v4 — service worker

// ---------- настройки ----------

// раскладка: одна запись = одно сочетание, code вместо key (не зависит от русской раскладки)
const DEFAULT_KEYMAP = {
  favoriteTab: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: false },
  pinTab: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: true },
  tidyDuplicates: { code: 'KeyD', meta: true, ctrl: false, alt: true, shift: false },
  tidyUp: { code: 'KeyT', meta: true, ctrl: false, alt: true, shift: false },
  togglePanel: null,   // панель просит жест пользователя — надёжно только нативным ⌃⇧S
  bookmarkTab: null,
  openPalette: { code: 'KeyK', meta: true, ctrl: false, alt: false, shift: true },
  groupByRules: null,
  groupByDomain: null,
  ungroupAll: null,
  sortByDomain: null,
  sortByOpened: null
};

const DEFAULT_THEME = {
  look: 'aside',       // aside | paper — серое поле сайдбара и системный шрифт, либо бумага apowall
  mode: 'light',       // auto | light | dark — по умолчанию светло, как сам Aside
  accent: '#111111',   // цвет панели, палитры, попапа
  tint: 0,             // сколько акцента подмешано в фон — свойство бумаги, %
  density: 'normal'    // normal | compact
};

const DEFAULTS = {
  dedupAuto: false,          // молча закрывать свежую вкладку — слишком грубо
  dedupNotice: true,         // вместо этого просто говорим, что такая уже открыта
  dedupIgnoreHash: true,
  dedupIgnoreUtm: true,
  dedupByTitle: true,        // тот же хост + тот же заголовок = одна страница, даже если query-строки разные
  nextToCurrent: true,              // legacy-тумблер, читается при миграции
  tabPlacement: 'underCurrent',     // underCurrent | end | browser
  placementGuardMs: 2500,           // сколько держим вкладку на месте, если Aside её двигает
  keepPins: true,
  favoriteMovesTab: true,   // ⌘D двигает и вкладку: вниз при закладке, наверх при возврате
  favoriteLeavesGroup: true, // ⌘D выводит вкладку из блока: вне блока сайдбар Aside вплавляет её в строку закладки
  tidyMinGroup: 3,           // блок при уборке собирается от стольких вкладок; пары остаются россыпью
  paletteOverlay: true,     // палитра слоем поверх страницы; выключено — отдельным окном
  keymapEnabled: true,
  dimBehindPalette: true,
  keymap: DEFAULT_KEYMAP,
  theme: DEFAULT_THEME,
  groupRules: [
    { name: "aim", patterns: ["aimindset", "aim-"] }
  ]
};

let settings = { ...DEFAULTS };

// Поднимаем, когда в раскладке появляется действие с новой дефолтной клавишей.
// Сохранённая карта пишется целиком, вместе с null'ами, и такой null навсегда
// перекрывает новый дефолт — отсюда «поставил клавишу, а работает старая».
const KEYMAP_REV = 2;
const comboKey = c => c ? [c.code, !!c.meta, !!c.ctrl, !!c.alt, !!c.shift].join('/') : '';

function upgradeKeymap(stored) {
  const map = { ...DEFAULT_KEYMAP, ...(stored || {}) };
  const taken = new Set(Object.values(map).map(comboKey).filter(Boolean));
  let changed = false;
  for (const [action, def] of Object.entries(DEFAULT_KEYMAP)) {
    if (!def || map[action]) continue;
    if (taken.has(comboKey(def))) continue;   // сочетание человек отдал другому действию — не отбираем
    map[action] = def;
    taken.add(comboKey(def));
    changed = true;
  }
  return changed ? map : null;
}

chrome.storage.sync.get({ ...DEFAULTS, keymapRev: 0 }).then(s => {
  // раскладку накладываем поверх дефолтной: иначе действия, добавленные позже,
  // остаются вообще без привязки — в хранилище лежит карта старой версии
  settings = { ...DEFAULTS, ...s, keymap: { ...DEFAULT_KEYMAP, ...(s.keymap || {}) } };

  if (s.keymapRev !== KEYMAP_REV) {
    const fixed = upgradeKeymap(s.keymap);
    if (fixed) settings.keymap = fixed;
    chrome.storage.sync.set({ keymapRev: KEYMAP_REV, ...(fixed ? { keymap: fixed } : {}) }).catch(() => { });
  }
  // миграция со старого булева тумблера: выключен → браузер решает сам
  if (s.tabPlacement == null && s.nextToCurrent === false) {
    settings.tabPlacement = 'browser';
    chrome.storage.sync.set({ tabPlacement: 'browser' }).catch(() => { });
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [k, v] of Object.entries(changes)) {
    // раскладку всегда кладём поверх дефолтной, иначе новые действия остаются без клавиш
    settings[k] = k === 'keymap' ? { ...DEFAULT_KEYMAP, ...(v.newValue || {}) } : v.newValue;
  }
  if (changes.keymap) settings.keymap = { ...DEFAULT_KEYMAP, ...(changes.keymap.newValue || {}) };
});

// панель открывается своей командой/кнопкой, а не кликом по иконке (там попап)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => { });

// ---------- обратная связь бейджем на иконке ----------

let badgeTimer = null;
let quiet = false;   // составная команда отчитывается один раз, а не за каждый шаг

// бейдж на иконке + всплывашка в активной вкладке: видно, что сочетание сработало
async function flash(badge, note = '', ok = true) {
  if (quiet) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ color: ok ? '#111111' : '#b00020' });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    await chrome.action.setBadgeText({ text: String(badge).slice(0, 4) });
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => chrome.action.setBadgeText({ text: '' }).catch(() => { }), 1800);
  } catch { }
  if (!note) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toast', text: note }, () => void chrome.runtime.lastError);
  } catch { }
}

// ---------- helpers ----------

const TRACKING_PARAMS = /^(utm_|_gl$|gclid$|fbclid$|yclid$|mc_cid$|mc_eid$)/;

function normalizeUrl(raw) {
  if (!raw) return null;
  if (!/^https?:\/\//.test(raw)) return null;
  try {
    const u = new URL(raw);
    if (settings.dedupIgnoreUtm) {
      for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
    }
    const hash = settings.dedupIgnoreHash ? '' : u.hash;
    // схема, www, порт по умолчанию, index.html и хвостовой слэш — одна и та же страница:
    // http://site и https://www.site/ открываются как один документ, дубль считаем дублем
    const host = u.hostname.replace(/^www\./, '');
    const port = u.port && !((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) ? ':' + u.port : '';
    const path = u.pathname.replace(/\/(index\.html?)?$/, '');
    return host + port + path + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + hash;
  } catch { return null; }
}

// ---------- близнецы ----------
// Точный ключ — нормализованный адрес. Ближний ключ — тот же хост и тот же заголовок:
// четыре вкладки «AIM VISUAL» на visual-team.aimindset.org с разными query-строками для
// глаза одна страница, а по адресу четыре разных, и «0 duplicates» на них выглядит ложью.
// Ближний ключ считается только когда заголовок что-то говорит: не пустой, не адрес,
// не «New Tab». Спящую вкладку Aside помечает 💤 прямо в заголовке — снимаем.
const GENERIC_TITLES = /^(new tab|untitled|loading…?|blank|about:blank)$/i;
const plainTitle = s => (s || '').replace(/^\s*💤\s*/, '').trim();

function nearKey(t) {
  if (!settings.dedupByTitle) return null;
  const title = plainTitle(t.title).toLowerCase();
  if (title.length < 4 || GENERIC_TITLES.test(title)) return null;
  let host;
  try {
    const u = new URL(t.url || '');
    if (!/^https?:$/.test(u.protocol)) return null;
    host = u.host.replace(/^www\./, '');
  } catch { return null; }
  if (title === host || title === (t.url || '').toLowerCase()) return null;
  return host + '|' + title;
}

// Раскладывает вкладки по кластерам близнецов: вкладки с одним точным ключом — вместе,
// кластеры с одним ближним ключом — сливаются (union-find). Возвращает только http(s).
function twinClusters(tabs) {
  const items = tabs.map(t => ({ t, exact: normalizeUrl(t.url) })).filter(x => x.exact);
  const parent = items.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const first = new Map();
  items.forEach((x, i) => {
    const near = nearKey(x.t);
    for (const k of near ? ['e:' + x.exact, 'n:' + near] : ['e:' + x.exact]) {
      if (first.has(k)) parent[find(i)] = find(first.get(k)); else first.set(k, i);
    }
  });
  const groups = new Map();
  items.forEach((x, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(x.t);
  });
  return [...groups.values()];
}

// ---------- новые вкладки под текущей ----------

// активные вкладки по окнам — переживает засыпание service worker'а
const currentActive = new Map();

chrome.storage.session.get('activeByWindow').then(({ activeByWindow = {} }) => {
  for (const [w, t] of Object.entries(activeByWindow)) {
    if (!currentActive.has(Number(w))) currentActive.set(Number(w), t);
  }
}).catch(() => { });

function saveActive() {
  chrome.storage.session.set({ activeByWindow: Object.fromEntries(currentActive) }).catch(() => { });
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  currentActive.set(windowId, tabId);
  saveActive();
});
chrome.windows.onRemoved.addListener(id => { currentActive.delete(id); saveActive(); });

const tabBirth = new Map();

const wait = ms => new Promise(r => setTimeout(r, ms));

// якорь: вкладка-родитель, иначе активная на момент создания, иначе активная сейчас
async function resolveAnchor(tabId, windowId, openerTabId) {
  let anchor = null;
  if (openerTabId != null) anchor = await chrome.tabs.get(openerTabId).catch(() => null);
  if (!anchor || anchor.windowId !== windowId) {
    const anchorId = currentActive.get(windowId);
    if (anchorId != null && anchorId !== tabId) anchor = await chrome.tabs.get(anchorId).catch(() => null);
  }
  if (!anchor || anchor.windowId !== windowId || anchor.id === tabId) {
    // fallback после рестарта service worker'а
    const arr = await chrome.tabs.query({ active: true, windowId }).catch(() => []);
    const a = arr[0];
    anchor = (a && a.id !== tabId) ? a : null;
  }
  return (anchor && anchor.id !== tabId) ? anchor : null;
}

// одна попытка поставить вкладку туда, где её хочет видеть пользователь
async function placeTab(tabId, windowId, openerTabId) {
  const mode = settings.tabPlacement || 'underCurrent';
  if (mode === 'browser') return true;

  const fresh = await chrome.tabs.get(tabId).catch(() => null);
  if (!fresh || fresh.pinned) return true; // пины живут своей жизнью

  if (mode === 'end') {
    const siblings = await chrome.tabs.query({ windowId, pinned: false }).catch(() => []);
    const last = siblings.length ? Math.max(...siblings.map(t => t.index)) : fresh.index;
    if (fresh.index === last) return true;
    await chrome.tabs.move(tabId, { index: -1 }).catch(() => { });
    return false;
  }

  const anchor = await resolveAnchor(tabId, windowId, openerTabId);
  if (!anchor) return true;
  if (fresh.index === anchor.index + 1) return true; // уже на месте
  // семантика move: при переносе снизу вверх индекс считается после изъятия вкладки
  const target = fresh.index < anchor.index ? anchor.index : anchor.index + 1;
  await chrome.tabs.move(tabId, { index: target }).catch(() => { });
  return false;
}

// Aside переставляет свежую вкладку уже ПОСЛЕ события onCreated — поэтому не одна
// попытка, а сторож: держим позицию весь placementGuardMs, пока она не перестанет уезжать
const GUARD_STEPS = [0, 90, 200, 380, 650, 1000, 1500, 2100, 2800, 3600];

chrome.tabs.onCreated.addListener(async (tab) => {
  tabBirth.set(tab.id, Date.now());
  if ((settings.tabPlacement || 'underCurrent') === 'browser') return;
  if (tab.pinned) return;
  const opener = tab.openerTabId;
  const guard = Math.max(0, Number(settings.placementGuardMs) || 0);
  let stable = 0;
  for (const step of GUARD_STEPS) {
    if (step > guard) break;
    if (step) await wait(step - (GUARD_STEPS[GUARD_STEPS.indexOf(step) - 1] || 0));
    let ok = false;
    try { ok = await placeTab(tab.id, tab.windowId, opener); } catch { return; }
    stable = ok ? stable + 1 : 0;
    if (stable >= 3 && step >= 650) return; // три тика подряд не двигалась — отпускаем
  }
});

chrome.tabs.onRemoved.addListener(id => tabBirth.delete(id));

// ---------- пины как в Arc: закрытие не убирает пин ----------

const pinnedCache = new Map(); // tabId -> {url, windowId, index}

async function refreshPinnedCache() {
  const pins = await chrome.tabs.query({ pinned: true }).catch(() => []);
  pinnedCache.clear();
  for (const t of pins) pinnedCache.set(t.id, { url: t.url, windowId: t.windowId, index: t.index });
}
refreshPinnedCache();

chrome.tabs.onUpdated.addListener((id, ch, tab) => {
  if (tab.pinned) pinnedCache.set(id, { url: tab.url, windowId: tab.windowId, index: tab.index });
  else pinnedCache.delete(id);
});

chrome.tabs.onRemoved.addListener(async (id, info) => {
  const p = pinnedCache.get(id);
  pinnedCache.delete(id);
  if (!p || info.isWindowClosing) return;
  if (!settings.keepPins) return;
  if (!/^https?:\/\//.test(p.url || '')) return;
  // возвращаем пин в спящем виде, как unload в Arc
  const t = await chrome.tabs.create({
    url: p.url, pinned: true, active: false,
    windowId: p.windowId, index: p.index
  }).catch(() => null);
  if (t) setTimeout(() => chrome.tabs.discard(t.id).catch(() => { }), 4000);
});

// ---------- авто-дедуп ----------

const DEDUP_WINDOW_MS = 20000;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!settings.dedupAuto && !settings.dedupNotice) return;
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  const birth = tabBirth.get(tabId);
  if (!birth || Date.now() - birth > DEDUP_WINDOW_MS) return;
  const key = normalizeUrl(tab.url || changeInfo.url);
  if (!key) return;
  try {
    const all = await chrome.tabs.query({});
    const twin = all.find(t => t.id !== tabId && normalizeUrl(t.url) === key && (tabBirth.get(t.id) ?? 0) < birth);
    if (!twin) return;
    if (!settings.dedupAuto) {
      // подсказка вместо действия: решение остаётся за человеком
      flash('DUP', 'this page is already open\n⌥⌘D cleans duplicates');
      return;
    }
    const wasActive = tab.active;
    await chrome.tabs.remove(tabId);
    if (wasActive) {
      await chrome.tabs.update(twin.id, { active: true });
      await chrome.windows.update(twin.windowId, { focused: true });
    }
  } catch { }
});

// ---------- тайди-команды ----------

// пустая вкладка: новая вкладка браузера или about:blank — их дедуп по URL не видит,
// потому что normalizeUrl пропускает только http(s)
const EMPTY_URLS = /^(about:blank|chrome:\/\/newtab\/?|chrome:\/\/new-tab-page\/?|edge:\/\/newtab\/?|aside:\/\/newtab\/?)$/;

function isEmptyTab(t) {
  const u = (t.url || '').trim();
  return u === '' || EMPTY_URLS.test(u);
}

// кого из близнецов оставить: активную, иначе ту, где были последней, иначе не спящую, иначе старшую
function keeperOf(a, b) {
  if (!!a.active !== !!b.active) return a.active ? a : b;
  const la = a.lastAccessed || 0, lb = b.lastAccessed || 0;
  if (la !== lb) return la > lb ? a : b;
  if (!!a.discarded !== !!b.discarded) return a.discarded ? b : a;
  return a.id < b.id ? a : b;
}

async function tidyDuplicates() {
  const all = await chrome.tabs.query({});
  const loose = all.filter(t => !t.pinned);
  const toClose = [];
  const empties = loose.filter(isEmptyTab);

  // из каждого кластера близнецов остаётся один хранитель, остальные закрываются
  for (const twins of twinClusters(loose)) {
    if (twins.length < 2) continue;
    const keep = twins.reduce(keeperOf);
    for (const t of twins) if (t !== keep) toClose.push(t.id);
  }

  // пустые убираем целиком; последнюю вкладку окна не трогаем, иначе окно закроется
  const perWindow = new Map();
  for (const t of all) perWindow.set(t.windowId, (perWindow.get(t.windowId) || 0) + 1);
  let emptiesClosed = 0;
  for (const t of empties) {
    const left = perWindow.get(t.windowId) || 0;
    if (left <= 1) continue;
    perWindow.set(t.windowId, left - 1);
    toClose.push(t.id);
    emptiesClosed++;
  }

  if (toClose.length) await chrome.tabs.remove(toClose);
  const dups = toClose.length - emptiesClosed;
  const note = toClose.length
    ? `closed ${toClose.length}` + (emptiesClosed ? ` · ${dups} dupes, ${emptiesClosed} empty` : ' duplicates')
    : 'nothing to clean';
  flash(toClose.length ? '−' + toClose.length : '0', note);
  return toClose.length;
}

const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'com.br', 'com.au', 'co.jp', 'com.tr']);

function rootDomain(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    if (/^[\d.]+$/.test(host) || !host.includes('.')) return host; // IP или localhost
    const parts = host.split('.');
    const last2 = parts.slice(-2).join('.');
    return SECOND_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
  } catch { return null; }
}

// «текущее окно» из палитры — это окно палитры, а не браузера; поэтому окно
// всегда разрешаем явно и popup-окна отсекаем
// Последнее ОБЫЧНОЕ окно помним сами. windowTypes у getLastFocused помечен устаревшим и
// местами игнорируется: пока открыта палитра, «последнее окно» указывает на неё, и любой
// перенос падает с «Tabs can only be moved to and from normal windows».
let lastNormalWin = null;

chrome.windows.onFocusChanged.addListener(async id => {
  if (id === chrome.windows.WINDOW_ID_NONE) return;
  const w = await chrome.windows.get(id).catch(() => null);
  if (w?.type === 'normal') lastNormalWin = w.id;
});
chrome.tabs.onActivated.addListener(async ({ windowId }) => {
  const w = await chrome.windows.get(windowId).catch(() => null);
  if (w?.type === 'normal') lastNormalWin = w.id;
});

async function targetWindowId(explicit) {
  if (explicit != null) {
    const w = await chrome.windows.get(explicit).catch(() => null);
    if (w && w.type === 'normal') return w.id;
  }
  const last = await chrome.windows.getLastFocused().catch(() => null);
  if (last?.type === 'normal') return last.id;

  if (lastNormalWin != null) {
    const w = await chrome.windows.get(lastNormalWin).catch(() => null);
    if (w?.type === 'normal') return w.id;
    lastNormalWin = null;
  }
  const all = await chrome.windows.getAll().catch(() => []);
  const normal = all.filter(w => w.type === 'normal');
  return (normal.find(w => w.focused) || normal[0])?.id ?? null;
}

async function makeGroups(keyFn, windowId) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const all = await chrome.tabs.query({ windowId: wid, pinned: false });
  const buckets = new Map();
  for (const t of all) {
    const key = keyFn(t);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t.id);
  }
  let groups = 0;
  for (const [name, ids] of buckets) {
    if (ids.length < 2) continue;
    const groupId = await chrome.tabs.group({ tabIds: ids });
    // группы создаём раскрытыми — свёрнутые прячут вкладки и ломают ориентировку
    await chrome.tabGroups.update(groupId, { title: name, collapsed: false });
    groups++;
  }
  flash(String(groups), groups ? `${groups} group${groups > 1 ? 's' : ''} made` : 'nothing to group');
  return groups;
}

// по корневому домену: все *.aimindset.org попадают в одну группу
async function groupByDomain(windowId) {
  return makeGroups(t => rootDomain(t.url), windowId);
}

// имя блока по правилам из настроек — общая функция для групп и для панели
function blockOf(tab) {
  const rules = (settings.groupRules || []).filter(r => r.name && r.patterns?.length);
  const hay = ((tab.url || '') + ' ' + (tab.title || '')).toLowerCase();
  for (const r of rules) {
    if (r.patterns.some(p => p && hay.includes(p.toLowerCase()))) return r.name;
  }
  return rootDomain(tab.url);
}

// по пользовательским правилам; остальное — по корневому домену
async function groupByRules(windowId) {
  return makeGroups(blockOf, windowId);
}

async function ungroupAll(windowId) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const all = await chrome.tabs.query({ windowId: wid });
  const ids = all.filter(t => t.groupId !== -1).map(t => t.id);
  if (ids.length) await chrome.tabs.ungroup(ids);
  flash(ids.length ? String(ids.length) : '0', ids.length ? `${ids.length} tabs ungrouped` : 'no groups');
  return ids.length;
}

async function reorder(windowId, keyFn, label) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const all = await chrome.tabs.query({ windowId: wid, pinned: false });
  const sortable = all.map(t => ({ id: t.id, key: keyFn(t) }));
  sortable.sort((a, b) => (typeof a.key === 'number' ? a.key - b.key : String(a.key).localeCompare(String(b.key))));
  const startIndex = all.length ? Math.min(...all.map(t => t.index)) : 0;
  let moved = 0;
  for (let i = 0; i < sortable.length; i++) {
    // сгруппированная вкладка может отказаться уезжать за границу группы —
    // это не повод ронять весь проход
    const ok = await chrome.tabs.move(sortable[i].id, { index: startIndex + i }).then(() => true).catch(() => false);
    if (ok) moved++;
  }
  flash(String(moved), `${moved} tabs ordered ${label}`);
  return moved;
}

function hostOfTab(t) {
  try { return new URL(t.url).hostname.replace(/^www\./, ''); } catch { return '~'; }
}

async function sortByDomain(windowId) {
  return reorder(windowId, hostOfTab, 'by site');
}

// id вкладки в Chromium растёт монотонно, поэтому он же и есть порядок открытия
async function sortByOpened(windowId) {
  return reorder(windowId, t => t.id, 'by when opened');
}

// Один жест вместо четырёх. Порядок важен: группы расплетаются ДО перестановок,
// иначе перемещения упираются в границы групп и шаг падает целиком.
//
// Что остаётся после: сверху россыпь — то, чем занимался последним, по свежести, как «сегодня» в Arc;
// ниже блоки от tidyMinGroup вкладок — сначала правила из настроек, потом сайты, внутри тоже по свежести.
// Пары одного сайта блоком не становятся: два github — это ещё не рабочая зона.
// Вкладки, чей адрес лежит в панели закладок, остаются вне блоков: сайдбар Aside сам
// вплавляет их в строку закладки, и из списка вкладок они исчезают.
async function tidyUp(windowId) {
  quiet = true;
  const step = async (fn) => { try { return await fn(); } catch { return null; } };
  let closed = 0, loose = 0, blocks = 0, failed = 0;
  try {
    closed = await step(() => tidyDuplicates()) ?? (failed++, 0);
    const wid = await targetWindowId(windowId);
    if (wid != null) {
      await step(() => ungroupAll(wid));
      const r = await step(() => arrangeWindow(wid));
      if (r) { loose = r.loose; blocks = r.blocks; } else failed++;
    }
  } finally {
    quiet = false;
  }
  flash('TIDY', `tidied up\n${closed} closed · ${loose} loose on top · ${blocks} block${blocks === 1 ? '' : 's'}` + (failed ? `\n${failed} steps refused` : ''));
  return closed + blocks;
}

const recentOf = t => t.lastAccessed || 0;

async function arrangeWindow(wid) {
  const all = await chrome.tabs.query({ windowId: wid, pinned: false });
  const bar = await chrome.bookmarks.getChildren(BAR).catch(() => []);
  const home = new Set(bar.filter(k => k.url).map(k => normalizeUrl(k.url)).filter(Boolean));
  const min = Math.max(2, Number(settings.tidyMinGroup) || 3);
  const ruleOrder = (settings.groupRules || []).map(r => r.name).filter(Boolean);

  const buckets = new Map();
  const looseTabs = [];
  for (const t of all) {
    const key = normalizeUrl(t.url);
    if (key && home.has(key)) { looseTabs.push(t); continue; }   // домой, в строку закладки
    const name = blockOf(t);
    if (!name) { looseTabs.push(t); continue; }
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(t);
  }
  const blockList = [];
  for (const [name, list] of buckets) {
    if (list.length < min) { looseTabs.push(...list); continue; }
    list.sort((a, b) => recentOf(b) - recentOf(a) || a.index - b.index);
    blockList.push({ name, list, rule: ruleOrder.indexOf(name), fresh: recentOf(list[0]) });
  }
  // блоки по правилам — в порядке правил; остальные — по тому, где были последней
  blockList.sort((a, b) => {
    const ra = a.rule < 0 ? 1 : 0, rb = b.rule < 0 ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (!ra) return a.rule - b.rule;
    return b.fresh - a.fresh;
  });
  looseTabs.sort((a, b) => recentOf(b) - recentOf(a) || a.index - b.index);

  const order = [...looseTabs, ...blockList.flatMap(b => b.list)];
  const start = all.length ? Math.min(...all.map(t => t.index)) : 0;
  for (let i = 0; i < order.length; i++) {
    await chrome.tabs.move(order[i].id, { index: start + i }).catch(() => { });
  }
  let made = 0;
  for (const b of blockList) {
    const gid = await chrome.tabs.group({ tabIds: b.list.map(t => t.id) }).catch(() => null);
    if (gid == null) continue;
    await chrome.tabGroups.update(gid, { title: b.name, collapsed: false, color: GROUP_COLORS[made % GROUP_COLORS.length] }).catch(() => { });
    made++;
  }
  return { loose: looseTabs.length, blocks: made };
}

// ---------- группировка по смыслу: модель через OpenRouter ----------
//
// Домен — плохой признак: полтора десятка вкладок на одном github ничего не
// говорят о том, чем человек занят. Модель видит только заголовки и хосты,
// содержимое страниц никуда не уходит. Ключ хранится локально и не синкается.
// Ничего не применяется молча: сначала окно с предложением, применяет человек.

const AI_DEFAULTS = { aiKey: '', aiModel: 'anthropic/claude-haiku-4.5' };

const SENSE_PROMPT = [
  'You sort open browser tabs into working blocks — by what the person is doing, not by website.',
  'Answer with JSON only: {"groups":[{"name":"...","tabs":[0,2,5]}]}.',
  'Rules: 3 to 7 groups; name is one or two lowercase words, no emoji, no punctuation;',
  'every group holds at least two tabs; a tab belongs to at most one group;',
  'leave a tab out of every group if it fits nothing.'
].join(' ');

const GROUP_COLORS = ['blue', 'cyan', 'green', 'yellow', 'orange', 'pink', 'purple', 'grey'];

const clip = (t, n) => (t || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function senseProposal(windowId) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;

  const { aiKey, aiModel } = await chrome.storage.local.get(AI_DEFAULTS);
  if (!aiKey) { flash('KEY', 'grouping by meaning needs an OpenRouter key\nsettings → card 07', false); return 0; }

  const tabs = (await chrome.tabs.query({ windowId: wid, pinned: false })).filter(t => /^https?:/.test(t.url || ''));
  if (tabs.length < 4) { flash('—', 'too few tabs to read a pattern in', false); return 0; }

  const list = tabs.map((t, i) => `${i}. ${clip(t.title, 90)} — ${hostOfTab(t)}`).join('\n');
  flash('AI', 'reading ' + tabs.length + ' titles…');

  let parsed;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + aiKey,
        'HTTP-Referer': 'https://apps.aimindset.org/aside-tweaks/',
        'X-Title': 'Aside Tweaks'
      },
      body: JSON.stringify({
        model: aiModel, temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SENSE_PROMPT }, { role: 'user', content: list }]
      })
    });
    if (!r.ok) throw new Error(r.status + ' ' + clip(await r.text(), 100));
    const j = await r.json();
    parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}');
  } catch (e) {
    flash('AI', 'openrouter refused\n' + clip(String(e), 90), false);
    return 0;
  }

  const seen = new Set();
  const groups = [];
  for (const g of parsed.groups || []) {
    const ids = [], titles = [];
    for (const i of g.tabs || []) {
      const t = tabs[Number(i)];
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      ids.push(t.id);
      titles.push(clip(t.title || t.url, 60));
    }
    if (ids.length > 1) groups.push({ name: clip(String(g.name || 'block'), 24).toLowerCase(), ids, titles });
  }
  if (!groups.length) { flash('—', 'the model found no blocks here', false); return 0; }

  await chrome.storage.session.set({
    sensePlan: { windowId: wid, groups, left: tabs.length - seen.size, model: aiModel, at: Date.now() }
  });
  await openSenseWindow(wid);
  return groups.length;
}

let senseWinId = null;

async function openSenseWindow(wid) {
  if (senseWinId != null) {
    const w = await chrome.windows.get(senseWinId).catch(() => null);
    if (w) { await chrome.windows.update(senseWinId, { focused: true }); return; }
    senseWinId = null;
  }
  const src = wid != null ? await chrome.windows.get(wid).catch(() => null) : null;
  const W = 430, H = 460;
  const w = await chrome.windows.create({
    url: chrome.runtime.getURL('sense.html'),
    type: 'popup', width: W, height: H, focused: true,
    left: src ? Math.round(src.left + (src.width - W) / 2) : undefined,
    top: src ? Math.round(src.top + (src.height - H) / 3) : undefined
  });
  senseWinId = w.id;
}

chrome.windows.onRemoved.addListener(id => { if (id === senseWinId) senseWinId = null; });

async function senseApply() {
  const { sensePlan } = await chrome.storage.session.get({ sensePlan: null });
  if (!sensePlan?.groups?.length) return 0;
  let made = 0;
  for (const g of sensePlan.groups) {
    const alive = [];
    for (const id of g.ids) if (await chrome.tabs.get(id).catch(() => null)) alive.push(id);
    if (alive.length < 2) continue;
    const groupId = await chrome.tabs.group({ tabIds: alive }).catch(() => null);
    if (groupId == null) continue;
    await chrome.tabGroups.update(groupId, {
      title: g.name, collapsed: false, color: GROUP_COLORS[made % GROUP_COLORS.length]
    }).catch(() => { });
    made++;
  }
  await chrome.storage.session.remove('sensePlan').catch(() => { });
  flash(String(made), made ? `${made} blocks made by meaning` : 'nothing left to group');
  return made;
}

// ---------- закладка ⇄ вкладка: одна клавиша в обе стороны ----------
// Страница ложится ПОСЛЕДНЕЙ строкой панели закладок. Вкладку при этом не закрываем:
// закрытие будит соседнюю спящую вкладку и та перезагружается — ощущается как «увело
// куда-то и перезагрузило». Живая вкладка просто уезжает вниз списка, второе нажатие
// снимает закладку и поднимает её в самый верх вкладок.

const BAR = '1'; // Bookmarks Bar в Chromium

// одноразовый переезд со старой схемы: содержимое папки Favorites поднимаем в корень
async function migrateFavoritesFolder() {
  const kids = await chrome.bookmarks.getChildren(BAR).catch(() => []);
  const folder = kids.find(k => !k.url && k.title === 'Favorites');
  if (!folder) return;
  const inside = await chrome.bookmarks.getChildren(folder.id).catch(() => []);
  for (const b of inside) await chrome.bookmarks.move(b.id, { parentId: BAR, index: 0 }).catch(() => { });
  const left = await chrome.bookmarks.getChildren(folder.id).catch(() => []);
  if (!left.length) await chrome.bookmarks.remove(folder.id).catch(() => { });
}
migrateFavoritesFolder();

async function listFavorites() {
  const kids = await chrome.bookmarks.getChildren(BAR).catch(() => []);
  return { items: kids.filter(k => k.url).map(k => ({ id: k.id, title: k.title, url: k.url })) };
}

// после переноса боковая панель теряет подсветку строки — возвращаем её на ту же страницу
async function keepSelected(tabId, windowId) {
  await chrome.tabs.update(tabId, { active: true }).catch(() => { });
  if (windowId != null) await chrome.windows.update(windowId, { focused: true }).catch(() => { });
}

// Сайдбар Aside вплавляет открытую вкладку в строку закладки с тем же адресом — но только
// вкладку вне блока. Внутри блока страница показывалась бы дважды: в закладках и в блоке.
// Поэтому ⌘D сначала выводит её из блока.
async function leaveGroup(tab) {
  if (!settings.favoriteLeavesGroup) return false;
  if (tab.groupId == null || tab.groupId < 0) return false;
  const ok = await chrome.tabs.ungroup([tab.id]).then(() => true).catch(() => false);
  if (ok) tab.groupId = -1;
  return ok;
}

// Всегда наверх, в обе стороны. Низ списка означает прокрутку боковой панели вниз —
// у полусотни вкладок это выглядит как «меня куда-то унесло». Пин работает именно так,
// и закладка должна ощущаться так же.
async function moveTabTo(tab) {
  if (!settings.favoriteMovesTab || tab.pinned) return false;
  if (tab.groupId != null && tab.groupId > -1) return false;   // блок не разрываем, если ⌘D его не покидает
  const all = await chrome.tabs.query({ windowId: tab.windowId }).catch(() => []);
  const index = all.filter(t => t.pinned).length;   // сразу под закреплёнными квадратиками
  try { await chrome.tabs.move(tab.id, { index }); return true; } catch { return false; }
}

async function favoriteTab(windowId) {
  const wid = await targetWindowId(windowId);
  const [tab] = await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true });
  if (!tab?.url || !/^https?:\/\//.test(tab.url)) { flash('—', 'this page cannot be bookmarked', false); return 0; }

  const kids = await chrome.bookmarks.getChildren(BAR).catch(() => []);
  const twin = kids.find(k => k.url && normalizeUrl(k.url) === normalizeUrl(tab.url));

  if (twin) {
    await chrome.bookmarks.remove(twin.id).catch(() => { });
    await leaveGroup(tab);
    const moved = await moveTabTo(tab);
    await keepSelected(tab.id, tab.windowId);
    flash('BM−', moved
      ? 'back in the tabs — first row, selected ↑'
      : 'removed from the bookmarks bar ↑');
    return -1;
  }

  // последняя строка панели закладок — там, куда смотришь после нажатия;
  // адрес пишем как есть: сайдбар сличает его с вкладкой буквально
  const made = await chrome.bookmarks.create({ parentId: BAR, index: kids.length, title: tab.title || tab.url, url: tab.url });
  await chrome.storage.session.set({ lastFavId: made?.id ?? null, lastFavAt: Date.now() }).catch(() => { });
  const left = await leaveGroup(tab);
  const moved = await moveTabTo(tab);
  await keepSelected(tab.id, tab.windowId);
  flash('BM+', 'in the bookmarks bar ★' +
    (left ? '\nout of its block — the sidebar folds the tab into that row' : moved ? '\ntab stays open, folded into the bar row' : '') +
    '\n⌘D again takes it out');
  return 1;
}

async function pinTab(windowId, tabId) {
  const wid = await targetWindowId(windowId);
  const tab = tabId != null
    ? await chrome.tabs.get(tabId).catch(() => null)
    : (await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true }))[0];
  if (!tab) return 0;

  const willPin = !tab.pinned;
  await chrome.tabs.update(tab.id, { pinned: willPin });

  if (willPin) {
    await chrome.storage.session.set({ lastPinId: tab.id, lastPinAt: Date.now() }).catch(() => { });
  } else {
    // открепили — страница возвращается первой строкой вкладок, а не в хвост списка
    const rest = await chrome.tabs.query({ windowId: tab.windowId }).catch(() => []);
    const firstFree = rest.filter(t => t.pinned && t.id !== tab.id).length;
    await chrome.tabs.move(tab.id, { index: firstFree }).catch(() => { });
  }
  await keepSelected(tab.id, tab.windowId);
  flash(willPin ? 'PIN' : 'UN', willPin
    ? 'pinned ↑\nmoved to the pinned squares on top of the sidebar'
    : 'unpinned — first row of the tabs, still selected ↑');
  return willPin ? 1 : -1;
}

async function bookmarkTab(windowId) {
  const wid = await targetWindowId(windowId);
  const [tab] = await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true });
  if (!tab?.url) return 0;
  const existing = await chrome.bookmarks.search({ url: tab.url }).catch(() => []);
  if (existing.length) {
    for (const b of existing) await chrome.bookmarks.remove(b.id).catch(() => { });
    flash('BM−', 'bookmark removed');
    return -1;
  }
  await chrome.bookmarks.create({ parentId: BAR, title: tab.title || tab.url, url: tab.url });
  flash('BM+', 'bookmarked ✓ — bookmarks section of the sidebar');
  return 1;
}

async function togglePanel(windowId) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  try {
    await chrome.sidePanel.open({ windowId: wid });
    return 1;
  } catch {
    flash('◧', 'panel opens with the native ⌃⇧S or the popup button', false);
    return 0;
  }
}

async function joinGroup(tab, groupName) {
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId, title: groupName }).catch(() => []);
  if (groups.length) { await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id }).catch(() => { }); return; }
  const gid = await chrome.tabs.group({ tabIds: [tab.id] }).catch(() => null);
  if (gid != null) await chrome.tabGroups.update(gid, { title: groupName, collapsed: false }).catch(() => { });
}

// открыть адрес: в обычном окне, под текущей вкладкой, при желании сразу в блок или в пин.
// Адрес уже открыт — переключаемся на ту вкладку, как Arc, вместо второй такой же.
async function openUrl({ url, windowId, groupName, pinned } = {}) {
  if (!url) return 0;
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const key = normalizeUrl(url);
  if (key) {
    const twin = (await chrome.tabs.query({}).catch(() => []))
      .filter(t => normalizeUrl(t.url) === key)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    if (twin) {
      if (pinned && !twin.pinned) await chrome.tabs.update(twin.id, { pinned: true }).catch(() => { });
      await chrome.tabs.update(twin.id, { active: true }).catch(() => { });
      await chrome.windows.update(twin.windowId, { focused: true }).catch(() => { });
      if (groupName && !twin.pinned && !pinned) await joinGroup(twin, groupName);
      return 2;   // переключился, а не открыл
    }
  }
  const active = (await chrome.tabs.query({ active: true, windowId: wid }).catch(() => []))[0];
  const tab = await chrome.tabs.create({
    url, windowId: wid, active: true,
    index: active ? active.index + 1 : undefined,
    pinned: !!pinned
  }).catch(() => null);
  if (!tab) return 0;
  await chrome.windows.update(wid, { focused: true }).catch(() => { });

  if (groupName && !pinned) await joinGroup(tab, groupName);
  return 1;
}

// dups — сколько вкладок закроет чистка прямо сейчас; twinOf — у какой вкладки сколько близнецов,
// палитра рисует по этому «×N» на строке
async function getStats() {
  const all = await chrome.tabs.query({});
  let pinned = 0, empties = 0, dups = 0;
  const twinOf = {};
  for (const t of all) {
    if (t.pinned) pinned++;
    else if (isEmptyTab(t)) empties++;
  }
  for (const twins of twinClusters(all.filter(t => !t.pinned))) {
    if (twins.length < 2) continue;
    dups += twins.length - 1;
    for (const t of twins) twinOf[t.id] = twins.length;
  }
  return { total: all.length, dups, pinned, empties, twinOf };
}

// ---------- omnibox: tw + Tab ----------

const OMNI_COMMANDS = [
  { keys: ['tidy', 'убрать'], desc: 'Tidy up — clean, group by blocks, sort', run: tidyUp },
  { keys: ['dd', 'dedup', 'дубли'], desc: 'Clean duplicates and empty tabs', run: tidyDuplicates },
  { keys: ['panel', 'панель'], desc: 'Open the tweaks panel', run: () => togglePanel() },
  { keys: ['group', 'группы'], desc: 'Group tabs by site', run: groupByDomain },
  { keys: ['rules', 'блоки'], desc: 'Group tabs by my blocks', run: groupByRules },
  { keys: ['ungroup', 'разгруп'], desc: 'Ungroup everything', run: ungroupAll },
  { keys: ['sort', 'сорт'], desc: 'Sort tabs by site', run: sortByDomain },
  { keys: ['opened', 'порядок'], desc: 'Order tabs by when they were opened', run: sortByOpened },
  { keys: ['pin', 'пин'], desc: 'Pin / unpin current tab', run: pinTab },
  { keys: ['bm', 'закладка'], desc: 'Bookmark without the dialog (toggle)', run: bookmarkTab }
];

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }

async function getHistory() {
  const { twHistory = [] } = await chrome.storage.local.get('twHistory');
  return twHistory;
}

async function pushHistory(q) {
  let h = await getHistory();
  h = [q, ...h.filter(x => x !== q)].slice(0, 30);
  await chrome.storage.local.set({ twHistory: h });
}

chrome.omnibox.setDefaultSuggestion({ description: 'tw: команды (dd, panel, group, rules, sort, pin, bm) · или поиск' });

chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  const q = input.trim().toLowerCase();
  const out = [];
  for (const c of OMNI_COMMANDS) {
    if (!q || c.keys.some(k => k.startsWith(q)) || c.desc.toLowerCase().includes(q)) {
      out.push({ content: '!cmd:' + c.keys[0], description: `<match>${c.keys[0]}</match> — ${esc(c.desc)}` });
    }
  }
  const hist = await getHistory();
  for (const h of hist.filter(h => !q || h.toLowerCase().includes(q)).slice(0, 5)) {
    out.push({ content: h, description: `<dim>история:</dim> ${esc(h)}` });
  }
  suggest(out.slice(0, 10));
});

chrome.omnibox.onInputEntered.addListener(async (input) => {
  if (input.startsWith('!cmd:')) {
    const key = input.slice(5);
    const cmd = OMNI_COMMANDS.find(c => c.keys[0] === key);
    if (cmd) await cmd.run();
    return;
  }
  // обычный поиск + своя история
  const q = input.trim();
  if (!q) return;
  await pushHistory(q);
  const cmd = OMNI_COMMANDS.find(c => c.keys.includes(q.toLowerCase()));
  if (cmd) { await cmd.run(); return; }
  const url = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/|\?|#|$)/.test(q) && !q.includes(' ')
    ? (q.startsWith('http') ? q : 'https://' + q)
    : 'https://www.google.com/search?q=' + encodeURIComponent(q);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.update(tab.id, { url });
});

// ---------- палитра (⌘K) ----------


// пока палитра открыта — гасим страницу под ней
async function dimPage(on) {
  if (on && settings.dimBehindPalette === false) return;
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const t of tabs) {
      if (t.id == null) continue;
      chrome.tabs.sendMessage(t.id, { type: 'dim', on }, () => void chrome.runtime.lastError);
    }
  } catch { }
}

let paletteWinId = null;
let paletteOpening = false;   // ⇧⌘K приходит и от страницы, и от команды браузера — окно должно остаться одно

// Палитра живёт прямо на странице: слой поверх сайта, без заголовка окна и светофора,
// с затемнением и тенью — так она читается полем, а не вторым окном. Там, где страницы
// нет (chrome://, новая вкладка, интерфейс самого Aside), падаем в отдельное окно.
async function openPalette(windowId) {
  if (paletteOpening) return;
  if (paletteWinId != null) {
    const w = await chrome.windows.get(paletteWinId).catch(() => null);
    if (w) { await chrome.windows.update(paletteWinId, { focused: true }); return; }
    paletteWinId = null;
  }

  const wid = await targetWindowId(windowId);
  const [tab] = wid != null ? await chrome.tabs.query({ active: true, windowId: wid }).catch(() => []) : [];

  if (settings.paletteOverlay !== false && tab && /^https?:\/\//.test(tab.url || '')) {
    // только верхний документ: во фреймах страницы слой не нужен, а их ответы
    // пришли бы первыми и увели нас в запасное окно
    const shown = await chrome.tabs.sendMessage(tab.id, {
      type: 'palette', on: true, win: wid, tab: tab.id
    }, { frameId: 0 }).catch(() => null);
    if (shown?.shown) return;
  }
  await openPaletteWindow(wid);
}

async function openPaletteWindow(windowId, q = '') {
  if (paletteWinId != null || paletteOpening) return;
  const wid = await targetWindowId(windowId);
  const src = wid != null ? await chrome.windows.get(wid).catch(() => null) : null;
  let activeTab = null;
  if (src) {
    const arr = await chrome.tabs.query({ active: true, windowId: src.id }).catch(() => []);
    activeTab = arr[0] || null;
  }
  paletteOpening = true;
  const W = 640, H = 480;
  const left = src ? Math.round(src.left + (src.width - W) / 2) : undefined;
  const top = src ? Math.round(src.top + (src.height - H) / 3) : undefined;
  const page = 'palette.html?win=' + (src?.id ?? '') + '&tab=' + (activeTab?.id ?? '') + (q ? '&q=' + encodeURIComponent(q) : '');
  try {
    const w = await chrome.windows.create({
      url: chrome.runtime.getURL(page),
      type: 'popup', width: W, height: H, left, top, focused: true
    });
    paletteWinId = w.id;
    dimPage(true);
  } finally {
    paletteOpening = false;
  }
}

chrome.windows.onRemoved.addListener(id => { if (id === paletteWinId) { paletteWinId = null; dimPage(false); } });

// ---------- глобальная клавиша: сигнальная страница моста ----------
// Снаружи до расширения не достучаться: chrome-extension:// из системы не открывается, а
// service worker спит. Зато `open -a Aside http://127.0.0.1:<port>/aside-tweaks/palette`
// открывает обычную вкладку с нашим content script — он присылает paletteSignal. Если
// страница, с которой ушли, умеет слой — сигнальная вкладка закрывается и палитра встаёт
// там; иначе палитра встаёт слоем на самой сигнальной странице (серое поле, без
// светофора), а когда закрывается — та вкладка уходит и возвращается прежняя.
const signalPrev = new Map();   // сигнальная вкладка → вкладка, где были до неё

const SIGNAL_URL = /^http:\/\/127\.0\.0\.1(:\d+)?\/aside-tweaks\/palette(\?|#|$)/;

async function paletteSignal({ q = '' } = {}, sender) {
  const sig = sender?.tab;
  if (!sig) return 0;
  const wid = sig.windowId;
  if (paletteWinId != null) {
    const w = await chrome.windows.get(paletteWinId).catch(() => null);
    if (w) { await chrome.tabs.remove(sig.id).catch(() => { }); await chrome.windows.update(paletteWinId, { focused: true }); return 0; }
    paletteWinId = null;
  }
  const others = (await chrome.tabs.query({ windowId: wid }).catch(() => []))
    .filter(t => t.id !== sig.id && !SIGNAL_URL.test(t.url || ''));
  const prev = others.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;

  // прежняя страница умеет слой — уходим туда, сигнальная вкладка больше не нужна
  if (prev && settings.paletteOverlay !== false && /^https?:\/\//.test(prev.url || '')) {
    const alive = await chrome.tabs.sendMessage(prev.id, { type: 'ping' }, { frameId: 0 }).catch(() => null);
    if (alive?.pong) {
      await chrome.tabs.update(prev.id, { active: true }).catch(() => { });
      await chrome.tabs.remove(sig.id).catch(() => { });
      const shown = await chrome.tabs.sendMessage(prev.id, { type: 'palette', on: true, win: wid, tab: prev.id, q }, { frameId: 0 }).catch(() => null);
      if (!shown?.shown) await openPaletteWindow(wid, q);
      await chrome.windows.update(wid, { focused: true }).catch(() => { });
      return 1;
    }
  }
  // иначе палитра живёт на сигнальной странице; «здесь» для неё — прежняя вкладка
  signalPrev.set(sig.id, prev?.id ?? null);
  const shown = await chrome.tabs.sendMessage(sig.id, { type: 'palette', on: true, win: wid, tab: prev?.id ?? sig.id, q, signal: true }, { frameId: 0 }).catch(() => null);
  if (!shown?.shown) { signalPrev.delete(sig.id); await openPaletteWindow(wid, q); }
  await chrome.windows.update(wid, { focused: true }).catch(() => { });
  return 2;
}

// палитра на сигнальной странице закрылась: если выбор ничего не активировал — вернуться на
// прежнюю вкладку; сигнальную убрать в любом случае
async function signalDone(_, sender) {
  const sig = sender?.tab;
  if (!sig) return 0;
  const prevId = signalPrev.get(sig.id);
  signalPrev.delete(sig.id);
  const still = await chrome.tabs.get(sig.id).catch(() => null);
  if (!still) return 0;
  if (still.active && prevId != null) await chrome.tabs.update(prevId, { active: true }).catch(() => { });
  await chrome.tabs.remove(sig.id).catch(() => { });
  return 1;
}

const SIGNAL = { paletteSignal, signalDone };

// ---------- desk bridge: заметки Obsidian и агенты Orca через локальный мост ----------
// Мост — bridge/desk.py на 127.0.0.1 (manifest: host_permissions на 127.0.0.1, без диалога —
// адрес локальный, а мост сам отвечает только этому расширению). Нет моста — нет и заметок.

const DESK_DEFAULTS = { deskPort: 49321 };

async function deskBase() {
  const { deskPort } = await chrome.storage.sync.get(DESK_DEFAULTS);
  return `http://127.0.0.1:${Number(deskPort) || 49321}`;
}

async function deskFetch(path, body) {
  const base = await deskBase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), body ? 25000 : 2500);
  try {
    // служебный заголовок — ворота моста: Origin из service worker'а браузер не шлёт
    const headers = { 'X-Aside-Tweaks': 'desk' };
    const r = await fetch(base + path, body
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }
      : { headers, signal: ctrl.signal });
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

let deskHealthCache = { at: 0, data: null };
async function deskHealth() {
  if (Date.now() - deskHealthCache.at < 15000) return deskHealthCache.data;
  const data = await deskFetch('/health');
  deskHealthCache = { at: Date.now(), data };
  return data;
}

const deskNotes = ({ q = '', limit = 30 } = {}) =>
  deskFetch(`/notes?q=${encodeURIComponent(q)}&limit=${Number(limit) || 30}`);
const deskAgents = () => deskFetch('/agents');
const deskOpen = ({ vault, file }) => deskFetch('/open', { vault, file });
const deskSwitch = ({ handle }) => deskFetch('/switch', { handle });
const deskRun = ({ prompt, path, name }) => deskFetch('/run', { prompt, path, name });

const DESK = { deskHealth, deskNotes, deskAgents, deskOpen, deskSwitch, deskRun };

// ---------- messages / commands ----------

const ACTIONS = {
  tidyDuplicates, groupByDomain, groupByRules, ungroupAll, sortByDomain,
  pinTab, favoriteTab, listFavorites, bookmarkTab, tidyUp, sortByOpened, getStats, openPalette, togglePanel,
  groupBySense: senseProposal, senseApply
};

// Одно и то же сочетание приходит с двух уровней — от страницы и от команды браузера.
// Для тоглов это означало бы «поставил и тут же снял», поэтому повтор в пределах кадра глушим.
const TOGGLES = new Set(['favoriteTab', 'pinTab', 'bookmarkTab', 'tidyUp', 'tidyDuplicates']);
const lastRun = new Map();

function tooSoon(action) {
  if (!TOGGLES.has(action)) return false;
  const now = Date.now();
  if (now - (lastRun.get(action) || 0) < 450) return true;
  lastRun.set(action, now);
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'blockOf') { sendResponse({ ok: true, data: blockOf(msg.tab || {}) }); return; }
  if (msg?.action === 'openUrl') {
    openUrl({ ...msg, windowId: msg.windowId ?? sender?.tab?.windowId })
      .then(r => sendResponse({ ok: true, count: r }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.action === 'openPaletteWindow') { openPaletteWindow(msg.windowId, typeof msg.q === 'string' ? msg.q : ''); sendResponse({ ok: true }); return; }
  if (SIGNAL[msg?.action]) {
    SIGNAL[msg.action](msg, sender).then(r => sendResponse({ ok: true, count: r })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (DESK[msg?.action]) {
    DESK[msg.action](msg).then(data => sendResponse({ ok: !!data, data })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  const fn = ACTIONS[msg?.action];
  if (!fn) return;
  if (tooSoon(msg.action)) { sendResponse({ ok: true, count: 0, skipped: true }); return; }
  // окно передаёт вызывающая сторона: палитра живёт в popup-окне, «текущее окно»
  // для service worker'а там указывает не на браузер
  const wid = msg.windowId ?? sender?.tab?.windowId;
  fn(wid).then(r => sendResponse({ ok: true, count: typeof r === 'number' ? r : undefined, data: typeof r === 'object' ? r : undefined }))
    .catch(e => sendResponse({ ok: false, error: String(e) }));
  return true;
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  const map = {
    'favorite-tab': 'favoriteTab', 'tidy-up': 'tidyUp', 'tidy-duplicates': 'tidyDuplicates',
    'pin-tab': 'pinTab', 'bookmark-tab': 'bookmarkTab', 'open-palette': 'openPalette', 'open-panel': 'togglePanel'
  };
  const action = map[cmd];
  if (!action || tooSoon(action)) return;
  ACTIONS[action]?.(tab?.windowId);
});
