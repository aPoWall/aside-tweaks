// Aside Tweaks — панель (chrome.sidePanel)
// Три яруса сверху вниз: favorites (страницы, перенесённые наверх), pinned
// (нативные пины Chromium), tabs (всё остальное, разбитое по блокам).
// Поиска здесь нет намеренно — он живёт в палитре ⇧⌘K.

const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'com.br', 'com.au', 'co.jp', 'com.tr']);
const BAR = '1';           // Bookmarks Bar — закладки лежат в корне, без папки
const FLASH_WINDOW = 4000; // сколько времени свежий пин/закладка подсвечиваются

let winId = null;
let rules = [];

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

function favicon(u) {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', u);
    url.searchParams.set('size', '32');
    return url.toString();
  } catch { return ''; }
}

function say(text) {
  const el = document.getElementById('status');
  if (!el.dataset.base) el.dataset.base = el.textContent;
  el.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { el.textContent = el.dataset.base; }, 2600);
}

function iconFor(url) {
  const img = document.createElement('img');
  img.src = favicon(url || '');
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
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

// ---------- favorites ----------

function favRow(mark) {
  const d = document.createElement('div');
  d.className = 'row';
  d.title = (mark.title || '') + '\n' + mark.url;
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = mark.title || mark.url;
  d.append(iconFor(mark.url), t);
  d.append(act('×', 'remove from the bar', false, async () => {
    await chrome.bookmarks.remove(mark.id).catch(() => { });
    say('removed from the bar');
    render();
  }));
  d.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openUrl', url: mark.url, windowId: winId });
  });
  return d;
}

// ---------- строка вкладки ----------

function tabRow(tab) {
  const d = document.createElement('div');
  d.className = 'row' + (tab.active ? ' active' : '') + (tab.discarded ? ' sleeping' : '');
  d.draggable = true;
  d.title = (tab.title || '') + '\n' + (tab.url || '');

  const t = document.createElement('span');
  t.className = 't';
  t.textContent = tab.title || tab.url || 'untitled';
  d.append(iconFor(tab.url), t);

  d.append(act('★', 'bookmark ⇄ tab · last row of the bar, the tab stays open', false, async () => {
    await chrome.tabs.update(tab.id, { active: true });
    const r = await chrome.runtime.sendMessage({ action: 'favoriteTab', windowId: tab.windowId });
    say(r?.count === -1 ? 'back in the tabs, at the top' : 'bookmarked ↓ last row');
  }));
  d.append(act(tab.pinned ? '◆' : '◇', tab.pinned ? 'unpin' : 'pin to the sidebar squares', tab.pinned, async () => {
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    say(tab.pinned ? 'unpinned' : 'pinned ↑');
  }));
  d.append(act('×', 'close', false, () => chrome.tabs.remove(tab.id).catch(() => { })));

  d.addEventListener('click', async () => {
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

async function render() {
  const my = ++renderSeq;
  if (winId == null) winId = (await chrome.windows.getCurrent().catch(() => null))?.id ?? null;

  const all = await chrome.tabs.query(winId != null ? { windowId: winId } : { currentWindow: true }).catch(() => []);
  // закладка уезжает в конец панели — показываем хвост, свежая внизу, как в сайдбаре
  const marks = (await chrome.bookmarks.getChildren(BAR).catch(() => [])).filter(k => k.url).slice(-14);
  const hi = await chrome.storage.session.get({ lastFavId: null, lastFavAt: 0, lastPinId: null, lastPinAt: 0 }).catch(() => ({}));
  if (my !== renderSeq) return;

  const now = Date.now();
  const freshFav = (now - (hi.lastFavAt || 0) < FLASH_WINDOW) ? hi.lastFavId : null;
  const freshPin = (now - (hi.lastPinAt || 0) < FLASH_WINDOW) ? hi.lastPinId : null;

  const favsEl = document.getElementById('favs');
  const pinsEl = document.getElementById('pins');
  const tabsEl = document.getElementById('tabs');
  favsEl.replaceChildren();
  pinsEl.replaceChildren();
  tabsEl.replaceChildren();

  if (!marks.length) favsEl.append(emptyLine('empty · ⌘D puts the current page here'));
  else for (const m of marks) {
    const r = favRow(m);
    if (m.id === freshFav) r.classList.add('flash');
    favsEl.append(r);
  }

  const pins = all.filter(t => t.pinned).sort((a, b) => a.index - b.index);
  if (!pins.length) pinsEl.append(emptyLine('empty · ⇧⌘D pins to the squares on top'));
  else for (const t of pins) {
    const r = tabRow(t);
    if (t.id === freshPin) r.classList.add('flash');
    pinsEl.append(r);
  }

  const rest = all.filter(t => !t.pinned).sort((a, b) => a.index - b.index);
  const buckets = new Map();
  for (const t of rest) {
    const b = blockOf(t);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(t);
  }
  for (const [name, list] of buckets) {
    if (buckets.size > 1) {
      const h = document.createElement('div');
      h.className = 'blk';
      h.textContent = `${name} · ${list.length}`;
      tabsEl.append(h);
    }
    for (const t of list) tabsEl.append(tabRow(t));
  }
  if (!rest.length) tabsEl.append(emptyLine('empty'));

  document.getElementById('nFav').textContent = String(marks.length);
  document.getElementById('nPins').textContent = String(pins.length);
  document.getElementById('nTabs').textContent = String(rest.length);
  const sleeping = all.filter(t => t.discarded).length;
  document.getElementById('count').textContent =
    `${all.length} tabs${sleeping ? ` · ${sleeping} asleep` : ''}`;
}

let rerenderTimer = null;
function rerender() {
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(render, 70);
}

for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onActivated', 'onDetached', 'onAttached', 'onReplaced']) {
  chrome.tabs[ev]?.addListener(rerender);
}
for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
  chrome.bookmarks[ev]?.addListener(rerender);
}

document.getElementById('gear').addEventListener('click', () => chrome.runtime.openOptionsPage());

document.querySelectorAll('.cmds .tile[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: btn.dataset.action, windowId: winId });
    say(res?.ok ? `${btn.textContent.trim()}: ${res.count ?? 'done'}` : 'error');
    rerender();
  });
});

chrome.storage.sync.get({ groupRules: [] }).then(s => { rules = s.groupRules || []; render(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && ch.groupRules) { rules = ch.groupRules.newValue || []; render(); }
});

render();
