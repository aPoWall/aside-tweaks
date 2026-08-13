// Aside Tweaks v4 — service worker

// ---------- настройки ----------

// раскладка: одна запись = одно сочетание, code вместо key (не зависит от русской раскладки)
const DEFAULT_KEYMAP = {
  favoriteTab: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: false },
  pinTab: null,
  tidyDuplicates: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: true },
  togglePanel: null,   // панель просит жест пользователя — надёжно только нативным ⌃⇧S
  bookmarkTab: null,
  openPalette: null,
  groupByRules: null,
  groupByDomain: null,
  ungroupAll: null,
  sortByDomain: null
};

const DEFAULT_THEME = {
  mode: 'auto',        // auto | light | dark
  accent: '#111111',   // цвет панели, палитры, попапа
  tint: 8,             // сколько акцента подмешано в фон панели, %
  density: 'normal'    // normal | compact
};

const DEFAULTS = {
  dedupAuto: true,
  dedupIgnoreHash: true,
  dedupIgnoreUtm: true,
  nextToCurrent: true,              // legacy-тумблер, читается при миграции
  tabPlacement: 'underCurrent',     // underCurrent | end | browser
  placementGuardMs: 2500,           // сколько держим вкладку на месте, если Aside её двигает
  keepPins: true,
  keymapEnabled: true,
  keymap: DEFAULT_KEYMAP,
  theme: DEFAULT_THEME,
  groupRules: [
    { name: "aim", patterns: ["aimindset", "aim-"] }
  ]
};

let settings = { ...DEFAULTS };

chrome.storage.sync.get(DEFAULTS).then(s => {
  settings = { ...DEFAULTS, ...s };
  // миграция со старого булева тумблера: выключен → браузер решает сам
  if (s.tabPlacement == null && s.nextToCurrent === false) {
    settings.tabPlacement = 'browser';
    chrome.storage.sync.set({ tabPlacement: 'browser' }).catch(() => { });
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
});

// панель открывается своей командой/кнопкой, а не кликом по иконке (там попап)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => { });

// ---------- обратная связь бейджем на иконке ----------

let badgeTimer = null;

// бейдж на иконке + всплывашка в активной вкладке: видно, что сочетание сработало
async function flash(badge, note = '', ok = true) {
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
    return u.origin + u.pathname.replace(/\/$/, '') + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + hash;
  } catch { return null; }
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
  if (!settings.dedupAuto) return;
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  const birth = tabBirth.get(tabId);
  if (!birth || Date.now() - birth > DEDUP_WINDOW_MS) return;
  const key = normalizeUrl(tab.url || changeInfo.url);
  if (!key) return;
  try {
    const all = await chrome.tabs.query({});
    const twin = all.find(t => t.id !== tabId && normalizeUrl(t.url) === key && (tabBirth.get(t.id) ?? 0) < birth);
    if (!twin) return;
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

async function tidyDuplicates() {
  const all = await chrome.tabs.query({});
  const seen = new Map();
  const toClose = [];
  const empties = [];

  for (const t of all) {
    if (t.pinned) continue;
    if (isEmptyTab(t)) { empties.push(t); continue; }
    const key = normalizeUrl(t.url);
    if (!key) continue;
    const kept = seen.get(key);
    if (!kept) { seen.set(key, t); continue; }
    const better = t.active || (!t.discarded && kept.discarded);
    if (better) { toClose.push(kept.id); seen.set(key, t); }
    else toClose.push(t.id);
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
async function targetWindowId(explicit) {
  if (explicit != null) {
    const w = await chrome.windows.get(explicit).catch(() => null);
    if (w && w.type === 'normal') return w.id;
  }
  const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  return w?.id ?? null;
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

async function sortByDomain(windowId) {
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const all = await chrome.tabs.query({ windowId: wid, pinned: false });
  const sortable = all.map(t => {
    let host = '~';
    try { host = new URL(t.url).hostname.replace(/^www\./, ''); } catch { }
    return { id: t.id, host };
  });
  sortable.sort((a, b) => a.host.localeCompare(b.host));
  const startIndex = all.length ? Math.min(...all.map(t => t.index)) : 0;
  for (let i = 0; i < sortable.length; i++) await chrome.tabs.move(sortable[i].id, { index: startIndex + i });
  flash(String(sortable.length), `${sortable.length} tabs sorted by site`);
  return sortable.length;
}

async function pinTab(windowId) {
  const wid = await targetWindowId(windowId);
  const [tab] = await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true });
  if (!tab) return 0;
  const willPin = !tab.pinned;
  await chrome.tabs.update(tab.id, { pinned: willPin });
  flash(willPin ? 'PIN' : 'UN', willPin
    ? 'pinned ↑\nmoved to the pinned squares on top of the sidebar'
    : 'unpinned — back in the tab list');
  return willPin ? 1 : -1;
}


// ---------- favorites: пин по смыслу, закладка по технике ----------
// вкладка не дублируется — она уходит в папку favorites и закрывается,
// как это делает Arc со своими верхними квадратами

const FAV_FOLDER = 'Favorites';

async function favFolderId() {
  const bar = '1'; // Bookmarks Bar в Chromium
  const kids = await chrome.bookmarks.getChildren(bar).catch(() => []);
  const found = kids.find(k => !k.url && k.title === FAV_FOLDER);
  if (found) return found.id;
  const made = await chrome.bookmarks.create({ parentId: bar, title: FAV_FOLDER, index: 0 }).catch(() => null);
  return made?.id ?? null;
}

async function listFavorites() {
  const id = await favFolderId();
  if (!id) return { items: [] };
  const kids = await chrome.bookmarks.getChildren(id).catch(() => []);
  return { items: kids.filter(k => k.url).map(k => ({ id: k.id, title: k.title, url: k.url })) };
}

async function favoriteTab(windowId) {
  const wid = await targetWindowId(windowId);
  const [tab] = await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true });
  if (!tab?.url || !/^https?:\/\//.test(tab.url)) { flash('—', 'this page cannot be favorited', false); return 0; }
  const folder = await favFolderId();
  if (!folder) return 0;

  const kids = await chrome.bookmarks.getChildren(folder).catch(() => []);
  const twin = kids.find(k => k.url && normalizeUrl(k.url) === normalizeUrl(tab.url));
  if (twin) {
    await chrome.bookmarks.remove(twin.id).catch(() => { });
    flash('FAV−', 'removed from favorites');
    return -1;
  }

  await chrome.bookmarks.create({ parentId: folder, title: tab.title || tab.url, url: tab.url });
  // переносим, а не копируем: вкладка уходит из дерева, если окно не останется пустым
  const siblings = await chrome.tabs.query({ windowId: tab.windowId }).catch(() => []);
  flash('FAV+', 'moved to favorites ↑\nopen it from the panel or ⌘K');
  if (siblings.length > 1) await chrome.tabs.remove(tab.id).catch(() => { });
  return 1;
}

async function bookmarkTab(windowId) {
  const wid = await targetWindowId(windowId);
  const [tab] = await chrome.tabs.query(wid != null ? { active: true, windowId: wid } : { active: true, currentWindow: true });
  if (!tab?.url) return 0;
  const existing = await chrome.bookmarks.search({ url: tab.url }).catch(() => []);
  if (existing.length) {
    for (const b of existing) await chrome.bookmarks.remove(b.id).catch(() => { });
    flash('BM−', 'bookmark removed');
    return -1; // убрали из закладок
  }
  // '1' = Bookmarks Bar в Chromium
  await chrome.bookmarks.create({ parentId: '1', title: tab.title || tab.url, url: tab.url });
  flash('BM+', 'bookmarked ✓ — bookmarks section of the sidebar');
  return 1;
}

async function togglePanel(windowId) {
  const wid = windowId ?? (await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null))?.id;
  if (wid == null) return 0;
  try {
    await chrome.sidePanel.open({ windowId: wid });
    return 1;
  } catch {
    // open() требует жеста пользователя; из страницы жест не долетает
    flash('◧', 'panel opens with the native ⌃⇧S or the popup button', false);
    return 0;
  }
}

// открыть адрес: в обычном окне, под текущей вкладкой, при желании сразу в блок или в пин
async function openUrl({ url, windowId, groupName, pinned } = {}) {
  if (!url) return 0;
  const wid = await targetWindowId(windowId);
  if (wid == null) return 0;
  const active = (await chrome.tabs.query({ active: true, windowId: wid }).catch(() => []))[0];
  const tab = await chrome.tabs.create({
    url, windowId: wid, active: true,
    index: active ? active.index + 1 : undefined,
    pinned: !!pinned
  }).catch(() => null);
  if (!tab) return 0;
  await chrome.windows.update(wid, { focused: true }).catch(() => { });

  if (groupName && !pinned) {
    // сначала ищем существующую группу с этим именем в том же окне
    const groups = await chrome.tabGroups.query({ windowId: wid, title: groupName }).catch(() => []);
    if (groups.length) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: groups[0].id }).catch(() => { });
    } else {
      const gid = await chrome.tabs.group({ tabIds: [tab.id] }).catch(() => null);
      if (gid != null) await chrome.tabGroups.update(gid, { title: groupName, collapsed: false }).catch(() => { });
    }
  }
  return 1;
}

async function getStats() {
  const all = await chrome.tabs.query({});
  const seen = new Set(); let dups = 0, pinned = 0;
  for (const t of all) {
    if (t.pinned) pinned++;
    const k = normalizeUrl(t.url);
    if (!k) continue;
    if (seen.has(k)) dups++; else seen.add(k);
  }
  return { total: all.length, dups, pinned };
}

// ---------- omnibox: tw + Tab ----------

const OMNI_COMMANDS = [
  { keys: ['dd', 'dedup', 'дубли'], desc: 'Clean duplicates and empty tabs', run: tidyDuplicates },
  { keys: ['panel', 'панель'], desc: 'Open the tweaks panel', run: () => togglePanel() },
  { keys: ['group', 'группы'], desc: 'Group tabs by site', run: groupByDomain },
  { keys: ['rules', 'блоки'], desc: 'Group tabs by my blocks', run: groupByRules },
  { keys: ['ungroup', 'разгруп'], desc: 'Ungroup everything', run: ungroupAll },
  { keys: ['sort', 'сорт'], desc: 'Sort tabs by site', run: sortByDomain },
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
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const t of tabs) {
      if (t.id == null) continue;
      chrome.tabs.sendMessage(t.id, { type: 'dim', on }, () => void chrome.runtime.lastError);
    }
  } catch { }
}

let paletteWinId = null;

async function openPalette() {
  if (paletteWinId != null) {
    const w = await chrome.windows.get(paletteWinId).catch(() => null);
    if (w) { await chrome.windows.update(paletteWinId, { focused: true }); return; }
    paletteWinId = null;
  }
  const src = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  let activeTab = null;
  if (src) {
    const arr = await chrome.tabs.query({ active: true, windowId: src.id }).catch(() => []);
    activeTab = arr[0] || null;
  }
  const W = 680, H = 470;
  const left = src ? Math.round(src.left + (src.width - W) / 2) : undefined;
  const top = src ? Math.round(src.top + (src.height - H) / 3) : undefined;
  const page = 'palette.html?win=' + (src?.id ?? '') + '&tab=' + (activeTab?.id ?? '');
  const w = await chrome.windows.create({
    url: chrome.runtime.getURL(page),
    type: 'popup', width: W, height: H, left, top, focused: true
  });
  paletteWinId = w.id;
  dimPage(true);
}

chrome.windows.onRemoved.addListener(id => { if (id === paletteWinId) { paletteWinId = null; dimPage(false); } });

// ---------- messages / commands ----------

const ACTIONS = {
  tidyDuplicates, groupByDomain, groupByRules, ungroupAll, sortByDomain,
  pinTab, favoriteTab, listFavorites, bookmarkTab, getStats, openPalette, togglePanel
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'blockOf') { sendResponse({ ok: true, data: blockOf(msg.tab || {}) }); return; }
  if (msg?.action === 'openUrl') {
    openUrl({ ...msg, windowId: msg.windowId ?? sender?.tab?.windowId })
      .then(r => sendResponse({ ok: true, count: r }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  const fn = ACTIONS[msg?.action];
  if (!fn) return;
  // окно передаёт вызывающая сторона: палитра живёт в popup-окне, «текущее окно»
  // для service worker'а там указывает не на браузер
  const wid = msg.windowId ?? sender?.tab?.windowId;
  fn(wid).then(r => sendResponse({ ok: true, count: typeof r === 'number' ? r : undefined, data: typeof r === 'object' ? r : undefined }))
    .catch(e => sendResponse({ ok: false, error: String(e) }));
  return true;
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'tidy-duplicates') tidyDuplicates();
  if (cmd === 'pin-tab') pinTab();
  if (cmd === 'bookmark-tab') bookmarkTab();
  if (cmd === 'open-palette') openPalette();
  if (cmd === 'open-panel') togglePanel(tab?.windowId);
});
