// Aside Tweaks — своя боковая панель (chrome.sidePanel)
// Нативный сайдбар Aside расширению недоступен, эта панель — то, что мы полностью
// контролируем: секции, порядок, цвета (см. theme.js).

const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'com.br', 'com.au', 'co.jp', 'com.tr']);

let winId = null;
let rules = [];
let filter = '';

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
  const prev = el.dataset.base || el.textContent;
  el.dataset.base = prev;
  el.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { el.textContent = el.dataset.base; }, 2600);
}

// ---------- строка вкладки ----------

function row(tab) {
  const d = document.createElement('div');
  d.className = 'row' + (tab.active ? ' active' : '') + (tab.discarded ? ' sleeping' : '');
  d.draggable = true;
  d.dataset.id = String(tab.id);
  d.title = (tab.title || '') + '\n' + (tab.url || '');

  const img = document.createElement('img');
  img.src = favicon(tab.url || '');
  img.addEventListener('error', () => {
    const g = document.createElement('span');
    g.className = 'glyph';
    g.textContent = '·';
    img.replaceWith(g);
  });

  const t = document.createElement('span');
  t.className = 't';
  t.textContent = tab.title || tab.url || 'untitled';

  const pin = document.createElement('button');
  pin.className = 'act' + (tab.pinned ? ' on' : '');
  pin.textContent = tab.pinned ? '◆' : '◇';
  pin.title = tab.pinned ? 'unpin' : 'pin — goes to the squares on top of the sidebar';
  pin.addEventListener('click', async (e) => {
    e.stopPropagation();
    await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    say(tab.pinned ? 'unpinned' : 'pinned ↑');
  });

  const close = document.createElement('button');
  close.className = 'act';
  close.textContent = '×';
  close.title = 'close';
  close.addEventListener('click', async (e) => {
    e.stopPropagation();
    await chrome.tabs.remove(tab.id).catch(() => { });
  });

  d.append(img, t, pin, close);

  d.addEventListener('click', async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  });
  d.addEventListener('auxclick', (e) => {
    if (e.button === 1) chrome.tabs.remove(tab.id).catch(() => { });
  });

  // перетаскивание: меняем порядок вкладок прямо в панели
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

// ---------- отрисовка ----------

let renderSeq = 0;

async function render() {
  const my = ++renderSeq;
  if (winId == null) winId = (await chrome.windows.getCurrent().catch(() => null))?.id ?? null;
  const all = await chrome.tabs.query(winId != null ? { windowId: winId } : { currentWindow: true }).catch(() => []);
  if (my !== renderSeq) return;

  const q = filter.trim().toLowerCase();
  const match = t => !q || (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q);

  const pins = all.filter(t => t.pinned && match(t)).sort((a, b) => a.index - b.index);
  const rest = all.filter(t => !t.pinned && match(t)).sort((a, b) => a.index - b.index);

  const pinsEl = document.getElementById('pins');
  const tabsEl = document.getElementById('tabs');
  pinsEl.replaceChildren();
  tabsEl.replaceChildren();

  if (!pins.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = q ? 'no matches' : 'empty · ⌘D or ◇ on a row pins a tab';
    pinsEl.append(e);
  } else {
    for (const t of pins) pinsEl.append(row(t));
  }

  // группировка по блокам из настроек, внутри — порядок как в браузере
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
      const s = document.createElement('span');
      s.textContent = `${name} · ${list.length}`;
      h.append(s);
      tabsEl.append(h);
    }
    for (const t of list) tabsEl.append(row(t));
  }
  if (!rest.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = q ? 'no matches' : 'empty';
    tabsEl.append(e);
  }

  document.getElementById('nPins').textContent = String(pins.length);
  document.getElementById('nTabs').textContent = String(rest.length);
  const sleeping = all.filter(t => t.discarded).length;
  document.getElementById('count').textContent =
    `${all.length} tabs${sleeping ? ` · ${sleeping} asleep` : ''}`;
}

let rerenderTimer = null;
function rerender() {
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(render, 60);
}

for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onActivated', 'onDetached', 'onAttached', 'onReplaced']) {
  chrome.tabs[ev]?.addListener(rerender);
}

document.getElementById('q').addEventListener('input', (e) => { filter = e.target.value; render(); });
document.getElementById('gear').addEventListener('click', () => chrome.runtime.openOptionsPage());

document.querySelectorAll('.cmds button[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: btn.dataset.action, windowId: winId });
    say(res?.ok ? `${btn.textContent}: ${res.count ?? 'done'}` : 'error');
    rerender();
  });
});

chrome.storage.sync.get({ groupRules: [] }).then(s => { rules = s.groupRules || []; render(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && ch.groupRules) { rules = ch.groupRules.newValue || []; render(); }
});

render();
