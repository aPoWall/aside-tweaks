// Aside Tweaks — palette (⌘K)
// Окно по центру рабочего окна: вкладки, история, закладки, команды, калькулятор.
// Всё оконное уходит в фон с явным windowId: сама палитра живёт в popup-окне,
// и «текущее окно» там указывает на неё, а не на браузер.

const params = new URLSearchParams(location.search);
const srcWin = Number(params.get('win')) || null;

const qEl = document.getElementById('q');
const listEl = document.getElementById('list');
const scopesEl = document.getElementById('scopes');

const SCOPES = ['all', 'tabs', 'history', 'bookmarks', 'commands'];
let scope = 'all';

const CMDS = [
  { keys: 'tidy sweep clean order all', title: 'Tidy up — clean, group, sort', action: 'tidyUp' },
  { keys: 'dd dedup duplicates clean empty', title: 'Clean duplicates and empty tabs', action: 'tidyDuplicates' },
  { keys: 'blocks group rules', title: 'Group tabs by my blocks', action: 'groupByRules' },
  { keys: 'group site domain', title: 'Group tabs by site', action: 'groupByDomain' },
  { keys: 'ungroup flat', title: 'Ungroup everything', action: 'ungroupAll' },
  { keys: 'sort order site', title: 'Sort tabs by site', action: 'sortByDomain' },
  { keys: 'opened order time recent', title: 'Order tabs by when they were opened', action: 'sortByOpened' },
  { keys: 'pin unpin', title: 'Pin / unpin current tab', action: 'pinTab' },
  { keys: 'bookmark bm save', title: 'Bookmark current tab (no dialog)', action: 'bookmarkTab' },
  { keys: 'panel sidebar', title: 'Open the tweaks panel', action: 'togglePanel' }
];

let items = [];
let sel = 0;
let blocks = [];

chrome.storage.sync.get({ groupRules: [] }).then(s => {
  blocks = (s.groupRules || []).map(r => r.name).filter(Boolean);
});

// ---------- частота выбора: то, что открываешь чаще, всплывает выше ----------

let frecency = {};
chrome.storage.local.get({ twFrecency: {} }).then(s => { frecency = s.twFrecency || {}; });

function bump(key) {
  if (!key) return;
  const e = frecency[key] || { n: 0, last: 0 };
  frecency[key] = { n: e.n + 1, last: Date.now() };
  chrome.storage.local.set({ twFrecency: frecency }).catch(() => { });
}

function score(key) {
  const e = frecency[key];
  if (!e) return 0;
  const days = (Date.now() - e.last) / 86400000;
  return e.n * Math.exp(-days / 14);   // вес тает за пару недель
}

// ---------- утилиты ----------

const TRACKING = /^(utm_|_gl$|gclid$|fbclid$|yclid$)/;

function normUrl(raw) {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.origin + u.pathname.replace(/\/$/, '') + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
  } catch { return raw || ''; }
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

function favicon(u) {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', u);
    url.searchParams.set('size', '32');
    return url.toString();
  } catch { return ''; }
}

const norm = s => (s || '').toLowerCase();
const looksLikeUrl = s => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/.test(s) && !s.includes(' ');
const toUrl = s => s.startsWith('http') ? s : 'https://' + s;

// калькулятор как в Raycast: только арифметика, никакого произвольного кода
function calc(expr) {
  const e = expr.trim();
  if (!/^[\d\s+\-*/%.()]+$/.test(e) || !/[+\-*/%]/.test(e) || e.length > 60) return null;
  try {
    const v = Function('"use strict";return (' + e + ')')();
    return (typeof v === 'number' && isFinite(v)) ? String(Math.round(v * 1e10) / 1e10) : null;
  } catch { return null; }
}

async function send(action, extra = {}) {
  return chrome.runtime.sendMessage({ action, windowId: srcWin, ...extra });
}

async function openUrl(url, { pinned = false, group = null } = {}) {
  bump(normUrl(url));
  await send('openUrl', { url, pinned, groupName: group });
  window.close();
}

// ---------- сбор результатов ----------

async function build(raw) {
  const qRaw = raw.trim();
  const q = norm(qRaw);
  const out = [];

  const value = calc(qRaw);
  if (value !== null) {
    out.push({
      kind: 'calc', glyph: '=', title: value, sub: qRaw, badge: 'copy',
      run: async () => { await navigator.clipboard.writeText(value).catch(() => { }); window.close(); }
    });
  }

  const wantTabs = scope === 'all' || scope === 'tabs';
  const wantHist = scope === 'all' || scope === 'history';
  const wantMarks = scope === 'all' || scope === 'bookmarks';
  const wantCmds = scope === 'all' || scope === 'commands';

  // открытые вкладки
  let tabs = [];
  if (wantTabs) {
    tabs = (await chrome.tabs.query({})).filter(t =>
      t.url && !t.url.startsWith('chrome-extension://' + chrome.runtime.id) &&
      (!q || norm(t.title).includes(q) || norm(t.url).includes(q))
    );
    tabs.sort((a, b) => score(normUrl(b.url)) - score(normUrl(a.url)));
    for (const t of tabs.slice(0, scope === 'tabs' ? 40 : (q ? 6 : 4))) {
      out.push({
        kind: 'tab', icon: favicon(t.url), title: t.title || t.url, sub: hostOf(t.url),
        badge: t.pinned ? 'pinned' : 'tab',
        alt: async () => {
          await chrome.tabs.update(t.id, { pinned: !t.pinned });
          window.close();
        },
        run: async () => {
          bump(normUrl(t.url));
          await chrome.tabs.update(t.id, { active: true });
          await chrome.windows.update(t.windowId, { focused: true });
          window.close();
        }
      });
    }
  }

  // команды
  if (wantCmds) {
    for (const c of CMDS) {
      if (q && !norm(c.keys + ' ' + c.title).includes(q)) continue;
      if (!q && scope === 'all' && out.length > 7) break;
      out.push({
        kind: 'cmd', glyph: '▸', title: c.title, sub: '', badge: 'command',
        run: async () => { await send(c.action); window.close(); }
      });
    }
  }

  // закладки
  if (wantMarks && (q || scope === 'bookmarks')) {
    // пустой поиск: search({}) в Chromium — ошибка, поэтому берём свежие закладки
    const marks = q
      ? await chrome.bookmarks.search({ query: qRaw }).catch(() => [])
      : await chrome.bookmarks.getRecent(30).catch(() => []);
    const seen = new Set();
    for (const b of marks) {
      if (!b.url) continue;
      const k = normUrl(b.url);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        kind: 'mark', icon: favicon(b.url), title: b.title || b.url, sub: hostOf(b.url), badge: 'bookmark',
        run: () => openUrl(b.url),
        alt: () => openUrl(b.url, { pinned: true })
      });
      if (seen.size >= (scope === 'bookmarks' ? 30 : 4)) break;
    }
  }

  // история — свёрнутая по нормализованному адресу, иначе один и тот же сайт занимает весь список
  if (wantHist) {
    const hist = await chrome.history.search({
      text: qRaw, maxResults: 120, startTime: 0
    }).catch(() => []);
    const openKeys = new Set(tabs.map(t => normUrl(t.url)));
    const byKey = new Map();
    for (const h of hist) {
      if (!h.url) continue;
      const k = normUrl(h.url);
      if (openKeys.has(k)) continue;
      const prev = byKey.get(k);
      if (!prev || (h.lastVisitTime || 0) > (prev.lastVisitTime || 0)) {
        byKey.set(k, { ...h, visitCount: (prev?.visitCount || 0) + (h.visitCount || 1) });
      }
    }
    const ranked = [...byKey.entries()]
      .map(([k, h]) => ({ h, w: score(k) * 10 + (h.visitCount || 1) + (h.lastVisitTime || 0) / 1e13 }))
      .sort((a, b) => b.w - a.w)
      .slice(0, scope === 'history' ? 40 : 8);
    for (const { h } of ranked) {
      out.push({
        kind: 'hist', icon: favicon(h.url), title: h.title || h.url, sub: hostOf(h.url), badge: 'history',
        run: () => openUrl(h.url),
        alt: () => openUrl(h.url, { pinned: true })
      });
    }
  }

  // адрес или поиск — вместе с «открыть в блоке»
  if (q) {
    const isUrl = looksLikeUrl(qRaw);
    if (isUrl) {
      const url = toUrl(qRaw);
      out.unshift({
        kind: 'open', glyph: '→', title: 'Open ' + qRaw, sub: '', badge: 'url',
        run: () => openUrl(url),
        alt: () => openUrl(url, { pinned: true })
      });
      for (const b of blocks) {
        out.push({
          kind: 'open', glyph: '▤', title: `Open in block · ${b}`, sub: hostOf(url), badge: 'block',
          run: () => openUrl(url, { group: b })
        });
      }
      out.push({
        kind: 'open', glyph: '◆', title: 'Open pinned', sub: hostOf(url), badge: 'pin',
        run: () => openUrl(url, { pinned: true })
      });
    } else {
      out.push({
        kind: 'search', glyph: '?', title: 'Search: ' + qRaw, sub: '', badge: 'google',
        run: () => openUrl('https://www.google.com/search?q=' + encodeURIComponent(qRaw))
      });
    }
  }

  return out;
}

// ---------- отрисовка ----------

function render() {
  listEl.replaceChildren();
  const HDRS = {
    tab: 'tabs', cmd: 'commands', mark: 'bookmarks',
    hist: 'history', open: 'open', search: '', calc: ''
  };
  let lastKind = null;
  items.forEach((it, i) => {
    if (it.kind !== lastKind && HDRS[it.kind]) {
      const h = document.createElement('div');
      h.className = 'hdr';
      h.textContent = HDRS[it.kind];
      listEl.append(h);
    }
    lastKind = it.kind;

    const d = document.createElement('div');
    d.className = 'item' + (i === sel ? ' sel' : '');
    if (it.icon) {
      const img = document.createElement('img');
      img.src = it.icon;
      img.addEventListener('error', () => {
        const g = document.createElement('span');
        g.className = 'glyph';
        g.textContent = '·';
        img.replaceWith(g);
      });
      d.append(img);
    } else {
      const g = document.createElement('span');
      g.className = 'glyph';
      g.textContent = it.glyph || '·';
      d.append(g);
    }
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = it.title;
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = it.sub || '';
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = it.badge;
    d.append(t, s, b);
    d.addEventListener('click', () => it.run());
    d.addEventListener('mousemove', () => { if (sel !== i) { sel = i; render(); } });
    listEl.append(d);
  });
  listEl.querySelector('.item.sel')?.scrollIntoView({ block: 'nearest' });
}

function renderScopes() {
  for (const b of scopesEl.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.scope === scope);
    b.onclick = () => { scope = b.dataset.scope; renderScopes(); refresh(); qEl.focus(); };
  }
}

let seq = 0;
async function refresh() {
  const my = ++seq;
  const res = await build(qEl.value);
  if (my !== seq) return;
  items = res;
  sel = Math.min(sel, Math.max(0, items.length - 1));
  if (qEl.value.trim()) sel = 0;
  render();
}

qEl.addEventListener('input', refresh);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { window.close(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const i = SCOPES.indexOf(scope);
    scope = SCOPES[(i + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length];
    renderScopes();
    refresh();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); render(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
  if (e.key === 'Enter') {
    e.preventDefault();
    const it = items[sel];
    if (!it) return;
    // ⇧↵ — второе действие строки: закрепить вкладку либо открыть адрес сразу пином
    if (e.shiftKey && it.alt) { it.alt(); return; }
    it.run();
  }
});

window.addEventListener('blur', () => setTimeout(() => window.close(), 150));

renderScopes();
qEl.focus();
refresh();
