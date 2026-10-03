// Aside Tweaks – панель (chrome.sidePanel)
// Mirrors native navigation: Pins, ordered Bookmarks, then live Tabs.
// Filtering and folding are display-only. They never rearrange browser data.

const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'com.br', 'com.au', 'co.jp', 'com.tr']);
const BAR = '1';           // Bookmarks Bar – закладки лежат в корне, без папки
const FLASH_WINDOW = 4000; // сколько времени свежий пин/закладка подсвечиваются
const HISTORY_LIMIT = 6;   // история помогает вернуться, но не становится второй лентой вкладок
const TRACKING = /^(utm_|_gl$|gclid$|fbclid$|yclid$|mc_cid$|mc_eid$)/;

let winId = Number(new URLSearchParams(location.search).get('win')) || null;
let rules = [];
let runtimeReady = true;
let navigation = null;
let revealRequested = false;
let panelPrefs = { panelGrouping: 'native', panelHistory: false, panelCollapsed: [] };
const NAV = AsideNavigation;

async function checkRuntime() {
  const expected = chrome.runtime.getManifest().version;
  const { build = null } = await chrome.storage.local.get({ build: null }).catch(() => ({}));
  const runtimeBuild = build?.version || '';
  runtimeReady = runtimeBuild === expected;
  const notice = document.getElementById('runtime-notice');
  const note = document.getElementById('review-note');
  const remove = document.getElementById('remove-duplicates');
  if (notice) notice.hidden = runtimeReady;
  if (note) note.hidden = !runtimeReady;
  if (remove) remove.disabled = !runtimeReady;
  if (!runtimeReady) say(`update waiting · worker ${runtimeBuild || 'older'} · files ${expected}`);
  return runtimeReady;
}

function rootDomain(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    if (/^[\d.]+$/.test(host) || !host.includes('.')) return host;
    const parts = host.split('.');
    const last2 = parts.slice(-2).join('.');
    return SECOND_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
  } catch { return null; }
}

// то же правило, что и у групп в background.js
function blockOf(tab) {
  const hay = ((tab.url || '') + ' ' + (tab.title || '')).toLowerCase();
  for (const r of rules) {
    if (r.name && r.patterns?.some(p => p && hay.includes(p.toLowerCase()))) return r.name;
  }
  return rootDomain(tab.url) || 'other';
}

function normUrl(raw) {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    const host = u.hostname.replace(/^www\./, '');
    const port = u.port && !((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) ? ':' + u.port : '';
    const path = u.pathname.replace(/\/(index\.html?)?$/, '');
    return host + port + path + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
  } catch { return raw || ''; }
}

function favicon(u) {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', u);
    url.searchParams.set('size', '32');
    return url.toString();
  } catch { return ''; }
}

// у живой вкладки иконка уже загружена; кэш /_favicon/ знает только то, что видел раньше,
// и на всё остальное отдаёт серый глобус
function iconFor(url, live) {
  const img = document.createElement('img');
  img.src = live && /^https?:|^data:/.test(live) ? live : favicon(url || '');
  img.addEventListener('error', () => {
    const g = document.createElement('span');
    g.className = 'glyph';
    g.textContent = '·';
    img.replaceWith(g);
  });
  return img;
}

function act(glyph, title, on, fn) {
  const b = document.createElement('button');
  b.className = 'act' + (on ? ' on' : '');
  b.textContent = glyph;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

function rowAction(row, fn) {
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', (row.title || row.textContent).split('\n')[0]);
  row.addEventListener('click', fn);
  row.addEventListener('keydown', e => {
    if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    fn();
  });
}

// ---------- favorites ----------

function favRow(mark, tab) {
  const d = document.createElement('div');
  d.className = 'row' + (tab?.active ? ' active' : '');
  if (tab?.active) d.setAttribute('aria-current', 'page');
  d.title = (mark.title || '') + '\n' + mark.url;
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = mark.title || mark.url;
  d.append(iconFor(mark.url, tab?.favIconUrl), t);
  if (tab?.active) {
    const tag = document.createElement('span'); tag.className = 'tag now'; tag.textContent = 'active'; d.append(tag);
  }
  d.append(act('×', 'remove from the bar', false, async () => {
    await chrome.bookmarks.remove(mark.id).catch(() => { });
    say('removed from the bar');
    render();
  }));
  rowAction(d, async () => {
    if (tab) await chrome.tabs.update(tab.id, { active: true });
    else await chrome.runtime.sendMessage({ action: 'openUrl', url: mark.url, windowId: winId });
  });
  return d;
}

function historyRow(item) {
  const d = document.createElement('div');
  d.className = 'row history';
  d.title = (item.title || '') + '\n' + item.url;
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = item.title || item.url;
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'history';
  d.append(iconFor(item.url), t, tag);
  d.append(act('★', 'bookmark at the end of the bar', false, async () => {
    await chrome.bookmarks.create({ parentId: BAR, title: item.title || item.url, url: item.url }).catch(() => { });
    say('bookmarked · last row');
    render();
  }));
  rowAction(d, async () => {
    await bumpFrecency(item.url);
    chrome.runtime.sendMessage({ action: 'openUrl', url: item.url, windowId: winId });
  });
  return d;
}

// ---------- строка вкладки ----------

// хост строкой справа – тот же признак, по которому читается строка палитры
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function tabRow(tab) {
  const d = document.createElement('div');
  d.className = 'row' + (tab.active ? ' active' : '') + (tab.discarded ? ' sleeping' : '');
  if (tab.active) d.setAttribute('aria-current', 'page');
  d.draggable = true;
  d.title = (tab.title || '') + '\n' + (tab.url || '');

  const t = document.createElement('span');
  t.className = 't';
  t.textContent = tab.title || tab.url || 'untitled';
  d.append(iconFor(tab.url, tab.favIconUrl), t);

  // Как в палитре: справа сказано, что это за строка. Жалоба была ровно про это –
  // в палитре видно, где ты стоишь, а панель молчала.
  const tag = document.createElement('span');
  tag.className = 'tag' + (tab.active ? ' now' : '');
  tag.textContent = tab.active ? 'active' : tab.pinned ? 'pinned' : tab.discarded ? 'asleep' : hostOf(tab.url);
  d.append(tag);

  d.append(act('★', 'save / remove in Aside Bookmarks · last row · keep focus', false, async () => {
    if (!runtimeReady) { say('reload Aside Tweaks once · old worker is still active'); return; }
    await chrome.tabs.update(tab.id, { active: true });
    const r = await chrome.runtime.sendMessage({ action: 'favoriteTab', windowId: tab.windowId });
    say(r?.count === -1 ? 'removed from Bookmarks · page stays active' : 'saved in Bookmarks · last row · page stays active');
  }));
  d.append(act(tab.pinned ? '◆' : '◇', tab.pinned ? 'unpin' : 'pin to the sidebar squares', tab.pinned, async () => {
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    say(tab.pinned ? 'unpinned' : 'pinned ↑');
  }));
  d.append(act('×', 'close', false, () => chrome.tabs.remove(tab.id).catch(() => { })));

  rowAction(d, async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  });
  d.addEventListener('auxclick', (e) => { if (e.button === 1) chrome.tabs.remove(tab.id).catch(() => { }); });

  // перетаскивание меняет порядок вкладок в окне
  d.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(tab.id));
    e.dataTransfer.effectAllowed = 'move';
  });
  d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('drop-into'); });
  d.addEventListener('dragleave', () => d.classList.remove('drop-into'));
  d.addEventListener('drop', async (e) => {
    e.preventDefault();
    d.classList.remove('drop-into');
    const dragged = Number(e.dataTransfer.getData('text/plain'));
    if (!dragged || dragged === tab.id) return;
    const target = await chrome.tabs.get(tab.id).catch(() => null);
    const src = await chrome.tabs.get(dragged).catch(() => null);
    if (!target || !src) return;
    if (src.pinned !== target.pinned) await chrome.tabs.update(dragged, { pinned: target.pinned });
    await chrome.tabs.move(dragged, { index: target.index }).catch(() => { });
  });

  return d;
}

function emptyLine(text) {
  const e = document.createElement('div');
  e.className = 'empty';
  e.textContent = text;
  return e;
}

// ---------- отрисовка ----------

let renderSeq = 0;

function appendGrouped(root, items, rowFor) {
  const counts = new Map();
  for (const item of items) {
    const key = blockOf(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const named = new Set(rules.map(r => r.name).filter(Boolean));
  const buckets = new Map();
  for (const item of items) {
    const key = blockOf(item);
    const group = named.has(key) || counts.get(key) > 1 ? key : 'other';
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(item);
  }
  for (const [name, list] of buckets) {
    if (buckets.size > 1) {
      const h = document.createElement('div');
      h.className = 'blk';
      h.textContent = `${name} · ${list.length}`;
      root.append(h);
    }
    for (const item of list) root.append(rowFor(item));
  }
}

async function bumpFrecency(url) {
  const { twFrecency = {} } = await chrome.storage.local.get({ twFrecency: {} }).catch(() => ({}));
  const key = normUrl(url);
  const prev = twFrecency[key] || { n: 0, last: 0 };
  twFrecency[key] = { n: prev.n + 1, last: Date.now() };
  await chrome.storage.local.set({ twFrecency }).catch(() => { });
}

async function smartHistory(openUrls, bookmarkUrls) {
  const [items, saved] = await Promise.all([
    chrome.history.search({ text: '', maxResults: 120, startTime: Date.now() - 90 * 86400000 }).catch(() => []),
    chrome.storage.local.get({ twFrecency: {} }).catch(() => ({ twFrecency: {} }))
  ]);
  const byKey = new Map();
  for (const item of items) {
    if (!item.url || !/^https?:\/\//.test(item.url)) continue;
    const key = normUrl(item.url);
    if (openUrls.has(key) || bookmarkUrls.has(key)) continue;
    const prev = byKey.get(key);
    if (!prev || (item.lastVisitTime || 0) > (prev.lastVisitTime || 0)) {
      byKey.set(key, { ...item, visitCount: (prev?.visitCount || 0) + (item.visitCount || 1) });
    }
  }
  const frecency = saved.twFrecency || {};
  return [...byKey.entries()]
    .map(([key, item]) => {
      const seen = frecency[key];
      const days = seen ? (Date.now() - seen.last) / 86400000 : 0;
      const choice = seen ? seen.n * Math.exp(-days / 14) : 0;
      return { item, weight: choice * 10 + (item.visitCount || 1) + (item.lastVisitTime || 0) / 1e13 };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, HISTORY_LIMIT)
    .map(x => x.item);
}

async function render(revealActive = false) {
  revealRequested ||= revealActive;
  const my = ++renderSeq;
  if (winId == null) winId = (await chrome.windows.getCurrent().catch(() => null))?.id ?? null;

  const [all, nativeGroups] = await Promise.all([
    chrome.tabs.query(winId != null ? { windowId: winId } : { currentWindow: true }).catch(() => []),
    chrome.tabGroups.query(winId != null ? { windowId: winId } : {}).catch(() => [])
  ]);
  const markTree = (await chrome.bookmarks.getSubTree(BAR).catch(() => []))[0]?.children || [];
  const allMarks = NAV.leaves(markTree);
  const openUrls = new Set(all.map(t => normUrl(t.url)).filter(Boolean));
  const bookmarkUrls = new Set(allMarks.map(m => normUrl(m.url)).filter(Boolean));
  const history = panelPrefs.panelHistory ? await smartHistory(openUrls, bookmarkUrls) : [];
  const hi = await chrome.storage.session.get({ lastFavId: null, lastFavAt: 0, lastPinId: null, lastPinAt: 0 }).catch(() => ({}));
  if (my !== renderSeq) return;

  navigation = { all, nativeGroups, markTree, allMarks, history, hi };
  drawNavigation(revealRequested);
  revealRequested = false;
}

function groupBox(root, name, id, items, rowFor, active = false) {
  const box = document.createElement('details'); box.className = 'nav-group';
  const filtered = document.getElementById('panel-search').value.trim();
  box.open = active || !!filtered || !panelPrefs.panelCollapsed.includes(id);
  const summary = document.createElement('summary'); summary.textContent = `${name} · ${items.length}`;
  box.append(summary);
  for (const item of items) box.append(rowFor(item));
  root.append(box);
  box.addEventListener('toggle', () => {
    if (active && !box.open && !filtered) { box.open = true; return; }
    if (filtered || !box.isConnected) return;
    const collapsed = new Set(panelPrefs.panelCollapsed);
    if (box.open) collapsed.delete(id); else collapsed.add(id);
    panelPrefs.panelCollapsed = [...collapsed];
    chrome.storage.local.set({ panelCollapsed: panelPrefs.panelCollapsed });
  });
}

function drawNavigation(revealActive = false) {
  if (!navigation) return;
  const { all, nativeGroups, markTree, allMarks, history, hi } = navigation;
  const query = document.getElementById('panel-search').value;
  const match = item => NAV.matches(item, query);
  const parts = NAV.partition(all, markTree);
  const now = Date.now();
  const freshFav = (now - (hi.lastFavAt || 0) < FLASH_WINDOW) ? hi.lastFavId : null;
  const freshPin = (now - (hi.lastPinAt || 0) < FLASH_WINDOW) ? hi.lastPinId : null;

  const favsEl = document.getElementById('favs');
  const pinsEl = document.getElementById('pins');
  const historyEl = document.getElementById('history');
  const tabsEl = document.getElementById('tabs');
  favsEl.replaceChildren();
  pinsEl.replaceChildren();
  historyEl.replaceChildren();
  tabsEl.replaceChildren();

  function bookmarkRows(root, nodes) {
    for (const mark of nodes) {
      if (!mark.url) {
        const found = NAV.leaves(mark.children || []).filter(match);
        if (found.length) groupBox(root, mark.title || 'folder', `bookmark:${mark.id}`, found,
          m => favRow(m, parts.saved.get(m.id)), found.some(m => parts.saved.get(m.id)?.active));
      } else if (match(mark)) {
        const row = favRow(mark, parts.saved.get(mark.id));
        if (mark.id === freshFav) row.classList.add('flash');
        root.append(row);
      }
    }
  }
  bookmarkRows(favsEl, markTree);
  if (!favsEl.children.length) favsEl.append(emptyLine(query ? 'no matching bookmarks' : '⌘D saves the page here · newest last'));

  const pins = parts.pins.filter(match);
  if (!pins.length) pinsEl.append(emptyLine('empty · ⇧⌘D pins to the squares on top'));
  else for (const t of pins) {
    const r = document.createElement('button'); r.className = 'pin-square' + (t.active ? ' active' : '');
    r.title = t.title || t.url; r.setAttribute('aria-label', r.title);
    if (t.active) r.setAttribute('aria-current', 'page');
    r.append(iconFor(t.url, t.favIconUrl));
    r.addEventListener('click', () => chrome.tabs.update(t.id, { active: true }));
    if (t.id === freshPin) r.classList.add('flash');
    pinsEl.append(r);
  }

  if (!history.length) historyEl.append(emptyLine('nothing useful outside open tabs and bookmarks'));
  else appendGrouped(historyEl, history.filter(match), historyRow);

  const rest = parts.tabs.filter(match);
  const nativeNames = new Map(nativeGroups.map(g => [g.id, (g.title || '').trim() || 'group']));
  const buckets = new Map();
  for (const t of rest) {
    const b = panelPrefs.panelGrouping === 'flat' ? '' :
      panelPrefs.panelGrouping === 'sites' ? hostOf(t.url) || 'other' : nativeNames.get(t.groupId) || '';
    const id = panelPrefs.panelGrouping === 'native' && nativeNames.has(t.groupId) ? `native:${t.groupId}` : b;
    if (!buckets.has(id)) buckets.set(id, { name: b, list: [] });
    buckets.get(id).list.push(t);
  }
  for (const [id, { name, list }] of buckets) {
    if (name) groupBox(tabsEl, name, `tabs:${id}`, list, tabRow, list.some(t => t.active));
    else for (const t of list) tabsEl.append(tabRow(t));
  }
  if (!rest.length) tabsEl.append(emptyLine('empty'));

  // Панель догоняет вкладку. Активная строка встаёт в середину окна панели, иначе
  // при полусотне вкладок «где я сейчас» приходится искать прокруткой.
  focusActiveRow(revealActive);

  document.getElementById('nFav').textContent = String(allMarks.filter(match).length);
  document.getElementById('nPins').textContent = String(pins.length);
  document.getElementById('nHistory').textContent = String(history.length);
  document.getElementById('nTabs').textContent = String(rest.length);
  const sleeping = all.filter(t => t.discarded).length;
  // строка под именем продукта: из чего состоит окно прямо сейчас
  document.getElementById('count').textContent =
    `${all.length} tabs${sleeping ? ` · ${sleeping} asleep` : ''}`;
}

// Прокрутку делаем после кадра отрисовки: до него у строк нет геометрии.
// Едем только когда строка действительно не видна – иначе панель дёргалась бы
// на каждой перерисовке, а их здесь много: любое событие вкладок перерисовывает список.
function focusActiveRow(force = false) {
  requestAnimationFrame(() => {
    const row = document.querySelector('[aria-current="page"]');
    if (!row) return;
    const box = row.getBoundingClientRect();
    const viewport = document.querySelector('main').getBoundingClientRect();
    const pad = 8;
    if (!force && box.top >= viewport.top + pad && box.bottom <= viewport.bottom - pad) return;
    row.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' });
  });
}

let rerenderTimer = null;
let pendingReveal = false;
function rerender(revealActive = false) {
  pendingReveal ||= revealActive === true;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => { const reveal = pendingReveal; pendingReveal = false; render(reveal); }, 70);
}

for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onActivated', 'onDetached', 'onAttached', 'onReplaced']) {
  chrome.tabs[ev]?.addListener(() => rerender(ev === 'onActivated'));
}
// После возврата в окно или разворачивания панели состояние могло измениться, пока документ
// был скрыт. Перечитываем вкладки и сразу возвращаем активную строку в видимую область.
chrome.windows?.onFocusChanged?.addListener(() => rerender(true));
window.addEventListener('focus', () => rerender(true));
window.addEventListener('pageshow', () => rerender(true));
document.addEventListener('visibilitychange', () => { if (!document.hidden) rerender(true); });
for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
  chrome.bookmarks[ev]?.addListener(() => rerender());
}

// Одно закрытие (правило 33): ×, esc и ⌘W приходят сюда. Боковая панель – документ браузера,
// её закрывает window.close(); если браузер этого не сделал, панель снимается через sidePanel
// и сразу возвращается в доступные, чтобы кнопка расширения открывала её как раньше.
async function closePanel() {
  window.close();
  await new Promise(r => setTimeout(r, 250));
  const id = winId ?? (await chrome.windows.getCurrent().catch(() => null))?.id;
  if (id == null) return;
  await chrome.sidePanel.setOptions({ windowId: id, enabled: false }).catch(() => { });
  setTimeout(() => chrome.sidePanel.setOptions({ windowId: id, path: 'panel.html', enabled: true }).catch(() => { }), 300);
}

document.getElementById('close-panel').addEventListener('click', closePanel);
document.getElementById('panel-search').addEventListener('input', () => drawNavigation());
document.getElementById('panel-grouping').addEventListener('change', e => {
  panelPrefs.panelGrouping = e.target.value;
  chrome.storage.local.set({ panelGrouping: panelPrefs.panelGrouping }); drawNavigation();
});
document.getElementById('show-active').addEventListener('click', () => {
  document.getElementById('panel-search').value = ''; drawNavigation(true);
});
document.getElementById('history-drawer').addEventListener('toggle', e => {
  if (panelPrefs.panelHistory === e.target.open) return;
  panelPrefs.panelHistory = e.target.open;
  chrome.storage.local.set({ panelHistory: panelPrefs.panelHistory }); render();
});
document.addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
    const targets = [...document.querySelectorAll('main .row, main .pin-square')].filter(row => row.getClientRects().length);
    const current = targets.indexOf(document.activeElement);
    if (document.activeElement.id === 'panel-search' || current >= 0) {
      e.preventDefault(); const step = e.key === 'ArrowDown' ? 1 : -1;
      targets[current < 0 ? (step > 0 ? 0 : targets.length - 1) : (current + step + targets.length) % targets.length]?.focus(); return;
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault(); document.getElementById('panel-search').focus(); return;
  }
  if (e.key === 'Escape' && document.getElementById('panel-search').value) {
    e.preventDefault(); document.getElementById('panel-search').value = ''; drawNavigation(true); return;
  }
  if (e.key === 'Escape' || (e.key.toLowerCase() === 'w' && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    closePanel();
  }
});

// плитки собираются из общего списка команд – одна правка меняет и панель, и палитру
function renderCmds() {
  const box = document.getElementById('cmds');
  box.replaceChildren();
  for (const c of commandsFor('panel')) {
    const b = document.createElement('button');
    b.className = 'tile';
    b.title = c.hint;
    const main = document.createElement('span');
    main.className = 'tile-main';
    main.textContent = c.glyph + ' ' + c.title + ' ';
    if (c.key) {
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = c.key;
      main.append(k);
    }
    const sub = document.createElement('span');
    sub.className = 'tile-sub';
    sub.textContent = c.sub;
    b.append(main, sub);
    b.addEventListener('click', async () => {
      if (!runtimeReady) { say('reload Aside Tweaks once · old worker is still active'); return; }
      const res = await chrome.runtime.sendMessage({ action: c.action, windowId: winId });
      say(res?.ok ? `${c.title}: ${res.count ?? 'done'}` : 'error');
      rerender();
    });
    box.append(b);
  }
}
renderCmds();

document.getElementById('remove-duplicates').addEventListener('click', async () => {
  if (!runtimeReady) { say('reload Aside Tweaks once · old worker is still active'); return; }
  const res = await chrome.runtime.sendMessage({ action: 'cleanDuplicates', windowId: winId }).catch(() => null);
  say(res?.ok ? 'duplicate preview opened · nothing closed yet' : 'could not open duplicate preview');
});

checkRuntime();

chrome.storage.sync.get({ groupRules: [] }).then(s => { rules = s.groupRules || []; render(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && ch.groupRules) { rules = ch.groupRules.newValue || []; render(); }
});

chrome.storage.local.get(panelPrefs).then(s => {
  panelPrefs = { ...panelPrefs, ...s };
  document.getElementById('panel-grouping').value = panelPrefs.panelGrouping;
  document.getElementById('history-drawer').open = panelPrefs.panelHistory;
  render(true);
});
