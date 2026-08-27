// Aside Tweaks — palette (⇧⌘K)
// Слой на странице или окно по центру: вкладки, история, закладки, команды, калькулятор.
// Всё оконное уходит в фон с явным windowId: сама палитра живёт в popup-окне,
// и «текущее окно» там указывает на неё, а не на браузер.
//
// Список строится один раз на запрос. Выбор строки, наведение мыши и стрелки
// только переключают класс — без перерисовки, иначе каждая строка проигрывает
// свою анимацию заново и палитра дёргается.

const params = new URLSearchParams(location.search);
const srcWin = Number(params.get('win')) || null;
const srcTab = Number(params.get('tab')) || null;
// встроенный режим: палитра живёт слоем на странице, закрывать окно нечего
const embed = params.get('embed') === '1';

function closeSelf() {
  if (embed) { parent.postMessage({ tw: 'palette-close' }, '*'); return; }
  window.close();
}

const qEl = document.getElementById('q');
const listEl = document.getElementById('list');
const scopesEl = document.getElementById('scopes');

const SCOPES = ['all', 'tabs', 'history', 'bookmarks', 'commands'];
let scope = 'all';

const CMDS = commandsFor('palette').map(c => ({
  keys: c.words + ' ' + c.title,
  title: c.title,
  sub: c.sub || '',
  action: c.action,
  key: c.key
}));

let items = [];
let rows = [];
let sel = 0;
let blocks = [];
let mouseLive = false;   // наведение выбирает строку только после реального движения мыши

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

const TRACKING = /^(utm_|_gl$|gclid$|fbclid$|yclid$|mc_cid$|mc_eid$)/;

// тот же ключ, что и у дедупа в фоне: схема, www, порт по умолчанию и хвостовой слэш не различают страницы
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

// Aside помечает спящую вкладку эмодзи 💤 прямо в заголовке — для поиска его снимаем
const plainTitle = s => (s || '').replace(/^\s*💤\s*/, '');

// насколько строка отвечает запросу: начало заголовка > начало слова > где-то в заголовке > адрес
function matchScore(q, title, url) {
  if (!q) return 1;
  const t = norm(plainTitle(title)), u = norm(url);
  if (t.startsWith(q)) return 4;
  if (t.includes(' ' + q) || t.includes('·' + q) || t.includes('-' + q)) return 3;
  if (t.includes(q)) return 2;
  if (u.includes(q)) return 1.2;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every(w => t.includes(w) || u.includes(w))) return 1.5;
  return 0;
}

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
  return chrome.runtime.sendMessage({ action, windowId: srcWin, ...extra }).catch(() => null);
}

// фон сам переключится на уже открытую вкладку с тем же адресом — дубль не появится
async function openUrl(url, { pinned = false, group = null } = {}) {
  bump(normUrl(url));
  await send('openUrl', { url, pinned, groupName: group });
  closeSelf();
}

// ---------- сбор результатов ----------

async function build(raw) {
  const qRaw = raw.trim();
  const q = norm(qRaw);
  const out = [];

  const value = calc(qRaw);
  if (value !== null) {
    out.push({
      kind: 'calc', glyph: '=', title: value, sub: qRaw, hint: 'copy ↵',
      run: async () => { await navigator.clipboard.writeText(value).catch(() => { }); closeSelf(); }
    });
  }

  const wantTabs = scope === 'all' || scope === 'tabs';
  const wantHist = scope === 'all' || scope === 'history';
  const wantMarks = scope === 'all' || scope === 'bookmarks';
  const wantCmds = scope === 'all' || scope === 'commands';

  // открытые вкладки — по свежести, как ⌃⇥ в Arc: последняя, где был, первой;
  // текущая — в самом низу, с неё и переключаешься
  const allTabs = (await chrome.tabs.query({}).catch(() => []))
    .filter(t => t.url && !t.url.startsWith('chrome-extension://' + chrome.runtime.id));
  const twins = new Map();
  for (const t of allTabs) { const k = normUrl(t.url); twins.set(k, (twins.get(k) || 0) + 1); }

  if (wantTabs) {
    const isCurrent = t => srcTab != null ? t.id === srcTab : (t.active && t.windowId === srcWin);
    const recent = t => t.lastAccessed || 0;
    const ranked = allTabs
      .map(t => ({ t, m: matchScore(q, t.title, t.url) }))
      .filter(x => x.m > 0)
      .sort((a, b) => {
        if (q && b.m !== a.m) return b.m - a.m;
        const ca = isCurrent(a.t), cb = isCurrent(b.t);
        if (ca !== cb) return ca ? 1 : -1;
        if (q) {
          const fa = score(normUrl(a.t.url)), fb = score(normUrl(b.t.url));
          if (fb !== fa) return fb - fa;
        }
        return recent(b.t) - recent(a.t) || b.t.id - a.t.id;
      });
    const limit = scope === 'tabs' ? 80 : 6;
    for (const { t } of ranked.slice(0, limit)) {
      const n = twins.get(normUrl(t.url)) || 1;
      out.push({
        kind: 'tab', section: q ? 'tabs' : 'recent',
        icon: (t.favIconUrl && /^https?:|^data:/.test(t.favIconUrl)) ? t.favIconUrl : favicon(t.url),
        title: t.title || t.url, sub: hostOf(t.url),
        twin: n > 1 ? '×' + n : '',
        k: t.pinned ? 'pinned' : '', hint: isCurrent(t) ? 'here' : 'switch ↵',
        alt: async () => {
          await chrome.tabs.update(t.id, { pinned: !t.pinned });
          closeSelf();
        },
        run: async () => {
          bump(normUrl(t.url));
          await chrome.tabs.update(t.id, { active: true });
          await chrome.windows.update(t.windowId, { focused: true });
          closeSelf();
        }
      });
    }
  }

  // команды — с живым счётом того, что чистка сейчас закроет
  if (wantCmds) {
    const stats = (await send('getStats'))?.data || null;
    for (const c of CMDS) {
      if (q && !norm(c.keys + ' ' + c.title).includes(q)) continue;
      if (!q && scope === 'all' && out.length > 9) break;
      let sub = c.sub;
      if (c.action === 'tidyDuplicates' && stats) {
        sub = (stats.dups || stats.empties)
          ? `${stats.dups} duplicate${stats.dups === 1 ? '' : 's'} · ${stats.empties} empty now`
          : 'nothing to clean right now';
      }
      out.push({
        kind: 'cmd', section: 'commands', glyph: c.glyph || '▸', title: c.title, sub,
        k: c.key || '', hint: 'run ↵',
        run: async () => { await send(c.action); closeSelf(); }
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
      const open = twins.has(k);
      out.push({
        kind: 'mark', section: 'bookmarks', icon: favicon(b.url), title: b.title || b.url, sub: hostOf(b.url),
        k: open ? 'open' : '', hint: open ? 'switch ↵' : 'open ↵',
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
    const byKey = new Map();
    for (const h of hist) {
      if (!h.url) continue;
      const k = normUrl(h.url);
      if (twins.has(k)) continue;   // открытое уже есть во вкладках
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
        kind: 'hist', section: 'history', icon: favicon(h.url), title: h.title || h.url, sub: hostOf(h.url), hint: 'open ↵',
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
      const open = twins.has(normUrl(url));
      out.unshift({
        kind: 'open', section: 'open', glyph: '→', title: (open ? 'Switch to ' : 'Open ') + qRaw, sub: '', hint: open ? 'switch ↵' : 'open ↵',
        run: () => openUrl(url),
        alt: () => openUrl(url, { pinned: true })
      });
      for (const b of blocks) {
        out.push({
          kind: 'open', section: 'open', glyph: '▤', title: `Open in block · ${b}`, sub: hostOf(url), hint: 'open ↵',
          run: () => openUrl(url, { group: b })
        });
      }
      out.push({
        kind: 'open', section: 'open', glyph: '◆', title: 'Open pinned', sub: hostOf(url), hint: 'open ↵',
        run: () => openUrl(url, { pinned: true })
      });
    } else {
      out.push({
        kind: 'search', glyph: '?', title: 'Search: ' + qRaw, sub: 'google', hint: 'search ↵',
        run: () => openUrl('https://www.google.com/search?q=' + encodeURIComponent(qRaw))
      });
    }
  }

  return out;
}

// ---------- отрисовка ----------

function rowFor(it, i) {
  const d = document.createElement('div');
  d.className = 'item';
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
  d.append(t, s);
  if (it.twin) {
    const w = document.createElement('span');
    w.className = 'twin';
    w.textContent = it.twin;
    w.title = 'the same page is open more than once · clean duplicates closes the extras';
    d.append(w);
  }
  if (it.k) {
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = it.k;
    d.append(k);
  }
  const h = document.createElement('span');
  h.className = 'hint';
  h.textContent = it.hint || '';
  d.append(h);
  d.addEventListener('click', () => it.run());
  d.addEventListener('mouseenter', () => { if (mouseLive) setSel(i, false); });
  return d;
}

function render() {
  mouseLive = false;
  listEl.replaceChildren();
  rows = [];
  let last = null;
  items.forEach((it, i) => {
    if (it.section && it.section !== last) {
      const h = document.createElement('div');
      h.className = 'hdr';
      h.textContent = it.section;
      listEl.append(h);
      last = it.section;
    }
    const d = rowFor(it, i);
    rows.push(d);
    listEl.append(d);
  });
  setSel(sel, true);
  if (listEl.classList.contains('first')) setTimeout(() => listEl.classList.remove('first'), 240);
}

function setSel(i, scroll) {
  if (!rows.length) { sel = 0; return; }
  i = Math.max(0, Math.min(i, rows.length - 1));
  if (rows[sel] && sel !== i) rows[sel].classList.remove('sel');
  sel = i;
  const el = rows[sel];
  el.classList.add('sel');
  if (scroll) el.scrollIntoView({ block: 'nearest' });
}

function renderScopes() {
  for (const b of scopesEl.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.scope === scope);
    b.onclick = () => { scope = b.dataset.scope; renderScopes(); softRefresh(); qEl.focus(); };
  }
}

let seq = 0;
async function refresh() {
  const my = ++seq;
  const res = await build(qEl.value);
  if (my !== seq) return;
  items = res;
  if (qEl.value.trim()) sel = 0;
  render();
}

// смена охвата: список гаснет, подменяется невидимым и проявляется — без рывка
let swapping = false;
async function softRefresh() {
  if (swapping) { refresh(); return; }
  swapping = true;
  listEl.classList.add('swap');
  await new Promise(r => setTimeout(r, 70));
  await refresh();
  requestAnimationFrame(() => { listEl.classList.remove('swap'); swapping = false; });
}

qEl.addEventListener('input', refresh);
document.addEventListener('mousemove', () => { mouseLive = true; }, { passive: true });

document.addEventListener('keydown', (e) => {
  mouseLive = false;
  if (e.key === 'Escape') { closeSelf(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const i = SCOPES.indexOf(scope);
    scope = SCOPES[(i + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length];
    renderScopes();
    softRefresh();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1, true); }
  if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1, true); }
  if (e.key === 'Enter') {
    e.preventDefault();
    const it = items[sel];
    if (!it) return;
    // ⇧↵ — второе действие строки: закрепить вкладку либо открыть адрес сразу пином
    if (e.shiftKey && it.alt) { it.alt(); return; }
    it.run();
  }
});

// в окне уход фокуса закрывает палитру; слой на странице закрывается щелчком по фону
if (!embed) window.addEventListener('blur', () => setTimeout(() => closeSelf(), 150));
if (embed) {
  document.documentElement.classList.add('embed');
  parent.postMessage({ tw: 'palette-ready' }, '*');
  // рамке фокус отдают снаружи, уже после загрузки — забираем его обратно в поле ввода
  setTimeout(() => qEl.focus(), 80);
  window.addEventListener('focus', () => qEl.focus());
}

renderScopes();
qEl.focus();
refresh();
