// Aside Tweaks — palette (⇧⌘K)
// Слой на странице или окно по центру: вкладки, история, закладки, заметки Obsidian
// (через локальный мост), агенты Orca (`> prompt`), команды, калькулятор.
// Всё оконное уходит в фон с явным windowId: сама палитра живёт в popup-окне,
// и «текущее окно» там указывает на неё, а не на браузер.
//
// Строение как у Raycast: тип строки справа, главное действие в нижней строке,
// панель действий на ⌘K, esc сначала чистит запрос и только потом закрывает.
// Список строится один раз на запрос; выбор строки, наведение и стрелки только
// переключают класс — без перерисовки, иначе палитра дёргается.

const params = new URLSearchParams(location.search);
const srcWin = Number(params.get('win')) || null;
const srcTab = Number(params.get('tab')) || null;
// запрос, с которым палитру позвали снаружи (Raycast: «aside palette <текст>»)
const q0 = params.get('q') || '';
// встроенный режим: палитра живёт слоем на странице, закрывать окно нечего
const embed = params.get('embed') === '1';

function closeSelf() {
  if (embed) { parent.postMessage({ tw: 'palette-close' }, '*'); return; }
  window.close();
}

const qEl = document.getElementById('q');
const listEl = document.getElementById('list');
const scopesEl = document.getElementById('scopes');
const actsEl = document.getElementById('acts');
const primaryEl = document.getElementById('primary');
const deskDot = document.getElementById('deskdot');

const SCOPES = ['all', 'tabs', 'history', 'bookmarks', 'notes', 'commands'];
let scope = 'all';

const CMDS = commandsFor('palette').map(c => ({
  keys: c.words + ' ' + c.title,
  title: c.title,
  sub: c.sub || '',
  action: c.action,
  key: c.key,
  glyph: c.glyph
}));

let items = [];
let rows = [];
let sel = 0;
let blocks = [];
let mouseLive = false;   // наведение выбирает строку только после реального движения мыши
let desk = null;         // мост к машине: { ok, vaults, worktrees } либо null — тогда заметок и агентов нет
// как показывать заметки — карточка 09 настроек
let notesPrefs = { notesLimit: 3, notesClean: true, notesDate: true, notesOrder: 'modified' };
let view = null;         // drill-down: { kind: 'dupes' } — список того, что закроет чистка; null = обычный поиск
let menuCache = null;    // пункты меню Aside с моста — один раз на открытие палитры
let currentQ = '';       // запрос, по которому построен список — для подсветки совпадений
chrome.storage.sync.get(notesPrefs).then(s => { notesPrefs = { ...notesPrefs, ...s }; });
let actsOpen = false, actSel = 0, acts = [];

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

// имя заметки в волте: `{project} {type} Описание – YYYY-MM-DD[ HHMM].md` —
// фигурные скобки становятся бейджами, дата уходит вправо, остаётся чистый заголовок
function parseNote(name) {
  let t = (name || '').trim();
  const tags = [];
  // недавние в Obsidian бывают и картинками, и pdf: расширение уходит в бейдж, дата остаётся читаемой
  const ext = /\.(png|jpe?g|gif|webp|svg|pdf|csv|json|txt|mp4|mov|excalidraw|canvas|base)$/i.exec(t);
  if (ext) { t = t.slice(0, ext.index); if (!/^(excalidraw|canvas|base)$/i.test(ext[1])) tags.push(ext[1].toLowerCase()); }
  // фигурные скобки бывают и в середине: `S26 {draw} Слайды – дата`
  t = t.replace(/\{([^}]{1,24})\}\s*/g, (_, tag) => { tags.push(tag); return ''; });
  let date = '';
  const d = /\s[–—-]\s(\d{4}-\d{2}-\d{2})(?:\s+\d{4})?\s*$/.exec(t);
  if (d) { date = d[1]; t = t.slice(0, d.index); }
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (!t) return { title: name, tags: [], date };
  return { title: t, tags, date };
}

// сигнальная страница моста — техническая, в списке вкладок ей не место
const SIGNAL_URL = /^http:\/\/127\.0\.0\.1(:\d+)?\/aside-tweaks\/palette(\?|#|$)/;

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

const copy = async text => { await navigator.clipboard.writeText(text).catch(() => { }); closeSelf(); };

// фон сам переключится на уже открытую вкладку с тем же адресом — дубль не появится
async function openUrl(url, { pinned = false, group = null } = {}) {
  bump(normUrl(url));
  await send('openUrl', { url, pinned, groupName: group });
  closeSelf();
}

// действия «открыть» для адреса: просто, пином, в блоке — одинаковы для закладок, истории и вставленного url
function openActions(url) {
  const a = [
    { label: 'open', key: '↵', fn: () => openUrl(url) },
    { label: 'open pinned', key: '⇧↵', fn: () => openUrl(url, { pinned: true }) }
  ];
  for (const b of blocks) a.push({ label: `open in block · ${b}`, key: '', fn: () => openUrl(url, { group: b }) });
  a.push({ label: 'copy url', key: '⌘C', fn: () => copy(url) });
  return a;
}

// ---------- мост к машине: заметки Obsidian и агенты Orca ----------

async function deskProbe() {
  desk = (await send('deskHealth'))?.data || null;
  deskDot.classList.toggle('off', !desk?.ok);
}

// ---------- сбор результатов ----------

async function build(raw) {
  const qRaw = raw.trim();
  const q = norm(qRaw);
  const out = [];

  // `> prompt` — режим агентов: живые терминалы Orca и запуск агента в рабочей папке
  if (qRaw.startsWith('>')) {
    const prompt = qRaw.slice(1).trim();
    if (!desk?.ok) {
      out.push({ kind: 'note', glyph: '○', title: 'desk bridge is not running', sub: 'settings card 08 · bridge/install.sh', kindLabel: 'desk', primary: 'settings', run: () => chrome.runtime.openOptionsPage() });
      return out;
    }
    const agents = (await send('deskAgents'))?.data?.terminals || [];
    for (const t of agents) {
      if (prompt && !norm(t.title + ' ' + t.path).includes(norm(prompt))) continue;
      out.push({
        kind: 'agent', section: 'agents', glyph: t.connected ? '●' : '○', title: t.title || t.path, sub: t.path.replace(/^\/Users\/[^/]+/, '~'),
        kindLabel: 'terminal', primary: 'switch',
        run: async () => { await send('deskSwitch', { handle: t.handle }); closeSelf(); }
      });
    }
    if (prompt) {
      for (const w of desk.worktrees || []) {
        out.push({
          kind: 'run', section: 'run an agent', glyph: '▶', title: `${w.name} · ${prompt}`, sub: w.path.replace(/^\/Users\/[^/]+/, '~'),
          kindLabel: 'new agent', primary: 'run',
          run: async () => { await send('deskRun', { prompt, path: w.path, name: w.name }); closeSelf(); }
        });
      }
    }
    return out;
  }

  // drill-down: что закроет чистка — по кластерам из фона, с причиной
  if (view?.kind === 'dupes') {
    const pv = (await send('previewDuplicates'))?.data;
    if (!pv || !pv.closes) {
      out.push({ kind: 'info', glyph: '○', title: 'nothing to close right now', sub: 'no twins, no empty tabs', kindLabel: '', primary: 'back', run: () => { view = null; refresh(); } });
      return out;
    }
    for (const c of pv.clusters) {
      for (const t of c.close) {
        if (q && !norm(t.title + ' ' + t.url).includes(q)) continue;
        out.push({
          kind: 'twin', section: `would close ${pv.closes} · ${c.reason}`, icon: favicon(t.url), title: t.title || t.url, sub: hostOf(t.url),
          why: 'keeps: ' + (c.keep.title || '').slice(0, 28), kindLabel: t.asleep ? 'asleep' : 'tab', primary: 'switch',
          run: async () => { await chrome.tabs.update(t.id, { active: true }); closeSelf(); },
          actions: [
            { label: 'switch to tab', key: '↵', fn: null },
            { label: 'close this one', key: '⌘⌫', fn: async () => { await chrome.tabs.remove(t.id).catch(() => { }); refresh(); } },
            { label: 'keep this one instead', key: '', fn: async () => { await chrome.tabs.update(t.id, { active: true }); refresh(); } }
          ]
        });
      }
    }
    for (const e of pv.empties) {
      out.push({ kind: 'twin', section: 'empty tabs', glyph: '·', title: 'empty tab', sub: e.url || 'new tab', kindLabel: 'tab', primary: 'close',
        run: async () => { await chrome.tabs.remove(e.id).catch(() => { }); refresh(); } });
    }
    out.push({ kind: 'cmd', glyph: '⊗', title: `clean all ${pv.closes} now`, sub: 'the copy you used last stays', kindLabel: 'command', primary: 'run',
      run: async () => { await send('tidyDuplicates'); closeSelf(); } });
    return out;
  }

  const value = calc(qRaw);
  if (value !== null) {
    out.push({ kind: 'calc', glyph: '=', title: value, sub: qRaw, kindLabel: 'calc', primary: 'copy', run: () => copy(value) });
  }

  const wantTabs = scope === 'all' || scope === 'tabs';
  const wantHist = scope === 'all' || scope === 'history';
  const wantMarks = scope === 'all' || scope === 'bookmarks';
  const wantNotes = (scope === 'all' || scope === 'notes') && desk?.ok;
  const wantCmds = scope === 'all' || scope === 'commands';

  // открытые вкладки — по свежести, как ⌃⇥ в Arc: последняя, где был, первой;
  // текущая — в самом низу, с неё и переключаешься
  // пустые новые вкладки в список не идут — переключаться на них незачем, чистка их и так уберёт
  const EMPTY = /^(about:blank|chrome:\/\/newtab\/?|chrome:\/\/new-tab-page\/?|aside:\/\/newtab\/?)$/;
  const allTabs = (await chrome.tabs.query({}).catch(() => []))
    .filter(t => t.url && !EMPTY.test(t.url) && !SIGNAL_URL.test(t.url) && !t.url.startsWith('chrome-extension://' + chrome.runtime.id));
  const open = new Set(allTabs.map(t => normUrl(t.url)));
  // близнецы считает фон — тем же правилом, что и чистка: точный адрес либо тот же хост и заголовок
  const stats = (await send('getStats'))?.data || null;
  const twinOf = stats?.twinOf || {};

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
      const n = twinOf[t.id] || 1;
      out.push({
        kind: 'tab', section: q ? 'tabs' : 'recent',
        icon: (t.favIconUrl && /^https?:|^data:/.test(t.favIconUrl)) ? t.favIconUrl : favicon(t.url),
        title: t.title || t.url, sub: hostOf(t.url),
        twin: n > 1 ? '×' + n : '',
        kindLabel: t.pinned ? 'pinned' : t.discarded ? 'asleep' : 'tab',
        primary: isCurrent(t) ? 'here' : 'switch',
        run: async () => {
          bump(normUrl(t.url));
          await chrome.tabs.update(t.id, { active: true });
          await chrome.windows.update(t.windowId, { focused: true });
          closeSelf();
        },
        actions: [
          { label: 'switch to tab', key: '↵', fn: null },
          { label: t.pinned ? 'unpin' : 'pin', key: '⇧↵', fn: async () => { await chrome.tabs.update(t.id, { pinned: !t.pinned }); closeSelf(); } },
          { label: 'bookmark ⇄ tab', key: '⌘B', fn: async () => { await chrome.tabs.update(t.id, { active: true }); await send('favoriteTab', { windowId: t.windowId }); closeSelf(); } },
          { label: 'close tab', key: '⌘⌫', fn: async () => { await chrome.tabs.remove(t.id).catch(() => { }); refresh(); } },
          { label: 'copy url', key: '⌘C', fn: () => copy(t.url) }
        ]
      });
    }
  }

  // заметки Obsidian — недавние из workspace.json обоих волтов, по запросу — поиск по именам
  const notesLimit = scope === 'notes' ? 40 : (q ? 6 : Number(notesPrefs.notesLimit) || 0);
  if (wantNotes && notesLimit > 0 && (q || scope !== 'commands')) {
    const order = notesPrefs.notesOrder === 'opened' ? 'opened' : 'modified';
    // область notes без запроса: сначала то, что менялось сегодня, потом остальное по свежести
    const batches = (scope === 'notes' && !q)
      ? [{ section: 'today', since: 'today', limit: 12 }, { section: 'recent', since: '', limit: notesLimit }]
      : [{ section: 'notes', since: '', limit: notesLimit }];
    const seenNotes = new Set();
    for (const b of batches) {
    const res = (await send('deskNotes', { q: qRaw, limit: b.limit, sort: order, since: b.since }))?.data;
    for (const n of res?.notes || []) {
      if (seenNotes.has(n.path)) continue;
      seenNotes.add(n.path);
      const key = 'note:' + n.vault + '/' + n.file;
      const parsed = notesPrefs.notesClean === false ? { title: n.title, tags: [], date: '' } : parseNote(n.title);
      const folder = (n.folder || '').split('/').filter(Boolean).slice(-1)[0] || '';
      out.push({
        kind: 'note', section: b.section, glyph: '◇', title: parsed.title, sub: n.vault + (folder ? ' · ' + folder : ''),
        tags: parsed.tags, date: notesPrefs.notesDate === false ? '' : parsed.date,
        kindLabel: 'note', primary: 'open', frec: score(key),
        run: async () => { bump(key); await send('deskOpen', { vault: n.vault, file: n.file }); closeSelf(); },
        actions: [
          { label: 'open in obsidian', key: '↵', fn: null },
          { label: 'copy path', key: '⌘C', fn: () => copy(n.path || n.file) }
        ]
      });
    }
    }
  }

  // команды — с живым счётом того, что чистка сейчас закроет
  if (wantCmds) {
    let shown = 0;
    for (const c of CMDS) {
      if (q && !norm(c.keys + ' ' + c.title).includes(q)) continue;
      if (!q && scope === 'all' && shown >= 3) break;
      let sub = c.sub;
      if (c.action === 'tidyDuplicates' && stats) {
        sub = (stats.dups || stats.empties)
          ? `closes ${stats.dups + stats.empties} · ${stats.dups} duplicate${stats.dups === 1 ? '' : 's'}, ${stats.empties} empty`
          : 'nothing to close right now';
      }
      shown++;
      const row = {
        kind: 'cmd', section: 'commands', glyph: c.glyph || '▸', title: c.title, sub,
        k: c.key || '', kindLabel: 'command', primary: 'run',
        run: async () => { await send(c.action); closeSelf(); }
      };
      if (c.action === 'tidyDuplicates') {
        row.actions = [
          { label: 'clean now', key: '↵', fn: null },
          { label: 'show what closes', key: '⇧↵', fn: () => { view = { kind: 'dupes' }; refresh(); } }
        ];
      }
      out.push(row);
    }
  }

  // пункты меню самого Aside — как Raycast → Search Menu Items, но изнутри браузера
  if (wantCmds && desk?.ok && (q || scope === 'commands')) {
    if (!menuCache) menuCache = (await send('deskMenu'))?.data || null;
    const m = menuCache;
    if (m?.error === 'accessibility') {
      out.push({ kind: 'info', glyph: '○', title: 'menu items need Accessibility for the bridge', sub: 'System Settings → Privacy & Security → Accessibility → python3', kindLabel: 'desk', primary: 'settings', run: () => chrome.runtime.openOptionsPage() });
    } else if (m?.busy && !m.items?.length) {
      out.push({ kind: 'info', glyph: '◌', title: 'reading the menu bar…', sub: 'about half a minute the first time', kindLabel: 'desk', primary: 'wait', run: () => refresh() });
    }
    let shown = 0;
    const limit = scope === 'commands' ? 200 : 6;
    for (const it of m?.items || []) {
      if (q && !norm(it.title + ' ' + it.path).includes(q)) continue;
      if (shown >= limit) break;
      shown++;
      out.push({
        kind: 'menu', section: (m.app || 'aside').toLowerCase() + ' menu', glyph: '≡', title: it.title, sub: it.path,
        k: it.key || '', kindLabel: it.enabled ? 'menu' : 'disabled', primary: 'run',
        run: async () => { const r = await send('deskMenuClick', { menu: it.menu, index: it.index, sub: it.sub }); if (r?.data?.ok) closeSelf(); else refresh(); },
        actions: [
          { label: 'run menu item', key: '↵', fn: null },
          { label: 'refresh the menu tree', key: '', fn: async () => { menuCache = null; await send('deskMenu', { refresh: true }); refresh(); } }
        ]
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
      const isOpen = open.has(k);
      out.push({
        kind: 'mark', section: 'bookmarks', icon: favicon(b.url), title: b.title || b.url, sub: hostOf(b.url),
        kindLabel: isOpen ? 'open' : 'bookmark', primary: isOpen ? 'switch' : 'open',
        run: () => openUrl(b.url), actions: openActions(b.url)
      });
      if (seen.size >= (scope === 'bookmarks' ? 30 : 4)) break;
    }
  }

  // история — свёрнутая по нормализованному адресу, иначе один и тот же сайт занимает весь список
  if (wantHist) {
    const hist = await chrome.history.search({ text: qRaw, maxResults: 120, startTime: 0 }).catch(() => []);
    const byKey = new Map();
    for (const h of hist) {
      if (!h.url) continue;
      const k = normUrl(h.url);
      if (open.has(k)) continue;   // открытое уже есть во вкладках
      const prev = byKey.get(k);
      if (!prev || (h.lastVisitTime || 0) > (prev.lastVisitTime || 0)) {
        byKey.set(k, { ...h, visitCount: (prev?.visitCount || 0) + (h.visitCount || 1) });
      }
    }
    const ranked = [...byKey.entries()]
      .map(([k, h]) => ({ h, w: score(k) * 10 + (h.visitCount || 1) + (h.lastVisitTime || 0) / 1e13 }))
      .sort((a, b) => b.w - a.w)
      .slice(0, scope === 'history' ? 40 : (q ? 8 : 6));
    for (const { h } of ranked) {
      out.push({
        kind: 'hist', section: 'history', icon: favicon(h.url), title: h.title || h.url, sub: hostOf(h.url),
        kindLabel: 'history', primary: 'open',
        run: () => openUrl(h.url), actions: openActions(h.url)
      });
    }
  }

  // адрес или поиск — вместе с «открыть в блоке»
  if (q) {
    const isUrl = looksLikeUrl(qRaw);
    if (isUrl) {
      const url = toUrl(qRaw);
      const isOpen = open.has(normUrl(url));
      out.unshift({
        kind: 'open', section: 'open', glyph: '→', title: (isOpen ? 'Switch to ' : 'Open ') + qRaw, sub: '',
        kindLabel: 'url', primary: isOpen ? 'switch' : 'open',
        run: () => openUrl(url), actions: openActions(url)
      });
    } else {
      out.push({
        kind: 'search', glyph: '?', title: 'Search: ' + qRaw, sub: 'google', kindLabel: 'web', primary: 'search',
        run: () => openUrl('https://www.google.com/search?q=' + encodeURIComponent(qRaw))
      });
    }
  }

  return out;
}

// ---------- отрисовка ----------

// совпадение с запросом выделяется в заголовке и подписи; слова запроса — каждое отдельно
function highlight(el, text, q) {
  el.replaceChildren();
  const words = (q || '').toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (!words.length || !text) { el.textContent = text; return; }
  const lower = text.toLowerCase();
  const spans = [];
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i >= 0) { spans.push([i, i + w.length]); i = lower.indexOf(w, i + w.length); }
  }
  spans.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  for (const [a, b] of spans) {
    if (a < pos) continue;
    if (a > pos) el.append(text.slice(pos, a));
    const m = document.createElement('mark');
    m.textContent = text.slice(a, b);
    el.append(m);
    pos = b;
  }
  if (pos < text.length) el.append(text.slice(pos));
}

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
  highlight(t, it.title, currentQ);
  const s = document.createElement('span');
  s.className = 's';
  highlight(s, it.sub || '', currentQ);
  d.append(t, s);
  if (it.why) {
    const w = document.createElement('span');
    w.className = 'why';
    w.textContent = it.why;
    d.append(w);
  }
  if (it.twin) {
    const w = document.createElement('span');
    w.className = 'twin';
    w.textContent = it.twin;
    w.title = 'this page is open more than once · clean duplicates keeps the copy you used last';
    d.append(w);
  }
  for (const tag of it.tags || []) {
    const b = document.createElement('span');
    b.className = 'tag';
    b.textContent = tag;
    d.append(b);
  }
  if (it.date) {
    const dt = document.createElement('span');
    dt.className = 'date';
    dt.textContent = it.date;
    d.append(dt);
  }
  if (it.k) {
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = it.k;
    d.append(k);
  }
  const kind = document.createElement('span');
  kind.className = 'kind';
  kind.textContent = it.kindLabel || '';
  d.append(kind);
  d.addEventListener('click', () => it.run());
  d.addEventListener('mouseenter', () => { if (mouseLive) setSel(i, false); });
  return d;
}

function render() {
  mouseLive = false;
  closeActs();
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
  if (!rows.length) { sel = 0; primaryEl.textContent = '—'; return; }
  i = Math.max(0, Math.min(i, rows.length - 1));
  if (rows[sel] && sel !== i) rows[sel].classList.remove('sel');
  sel = i;
  const el = rows[sel];
  el.classList.add('sel');
  if (scroll) el.scrollIntoView({ block: 'nearest' });
  primaryEl.textContent = items[sel]?.primary || 'open';
}

function renderScopes() {
  for (const b of scopesEl.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.scope === scope);
    b.onclick = () => { scope = b.dataset.scope; renderScopes(); softRefresh(); qEl.focus(); };
  }
}

// ---------- панель действий ⌘K ----------

function actionsOf(it) {
  if (!it) return [];
  const list = it.actions ? it.actions.slice() : [{ label: it.primary || 'open', key: '↵', fn: null }];
  // первое действие всегда главное — его выполняет ↵
  return list.map(a => ({ ...a, fn: a.fn || it.run }));
}

function openActs() {
  const it = items[sel];
  acts = actionsOf(it);
  if (!acts.length) return;
  actSel = 0;
  actsEl.replaceChildren();
  const h = document.createElement('div');
  h.className = 'ah';
  h.textContent = it.title;
  actsEl.append(h);
  acts.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'a' + (i === 0 ? ' sel' : '');
    const l = document.createElement('span');
    l.textContent = a.label;
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = a.key || '';
    d.append(l, k);
    d.addEventListener('click', () => { closeActs(); a.fn(); });
    d.addEventListener('mouseenter', () => setActSel(i));
    actsEl.append(d);
  });
  actsEl.classList.add('on');
  actsOpen = true;
}

function setActSel(i) {
  const els = actsEl.querySelectorAll('.a');
  if (!els.length) return;
  i = (i + els.length) % els.length;
  els[actSel]?.classList.remove('sel');
  actSel = i;
  els[actSel].classList.add('sel');
}

function closeActs() {
  if (!actsOpen) return;
  actsEl.classList.remove('on');
  actsOpen = false;
}

document.getElementById('actsbtn').addEventListener('click', () => { actsOpen ? closeActs() : openActs(); qEl.focus(); });

// быстрые клавиши строки без открытия панели: ⇧↵, ⌘⌫, ⌘C, ⌘B — те же, что подписаны в панели
function runByKey(key) {
  const a = actionsOf(items[sel]).find(x => x.key === key);
  if (!a) return false;
  a.fn();
  return true;
}

let seq = 0;
async function refresh() {
  const my = ++seq;
  currentQ = qEl.value.trim().replace(/^>\s*/, '');
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
document.addEventListener('mousedown', (e) => { if (actsOpen && !actsEl.contains(e.target) && !e.target.closest('#actsbtn')) closeActs(); });

document.addEventListener('keydown', (e) => {
  mouseLive = false;
  const meta = e.metaKey || e.ctrlKey;

  if (meta && e.code === 'KeyK') { e.preventDefault(); actsOpen ? closeActs() : openActs(); return; }

  if (actsOpen) {
    if (e.key === 'Escape') { e.preventDefault(); closeActs(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActSel(actSel + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActSel(actSel - 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); const a = acts[actSel]; closeActs(); a?.fn(); return; }
    return;
  }

  // esc как в Raycast: сначала чистит запрос, пустой запрос закрывает палитру
  if (e.key === 'Escape') {
    e.preventDefault();
    if (view) { view = null; refresh(); return; }
    if (qEl.value) { qEl.value = ''; refresh(); return; }
    closeSelf();
    return;
  }
  // Backspace на пустом поле — шаг назад из режима, как в Raycast
  if (e.key === 'Backspace' && !qEl.value && view) { e.preventDefault(); view = null; refresh(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const i = SCOPES.indexOf(scope);
    scope = SCOPES[(i + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length];
    renderScopes();
    softRefresh();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1, true); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1, true); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey && runByKey('⇧↵')) return;
    items[sel]?.run();
    return;
  }
  if (meta && e.key === 'Backspace') { if (runByKey('⌘⌫')) e.preventDefault(); return; }
  if (meta && e.code === 'KeyB') { if (runByKey('⌘B')) e.preventDefault(); return; }
  // ⌘C копирует адрес строки только когда в поле ввода нечего копировать
  if (meta && e.code === 'KeyC' && qEl.selectionStart === qEl.selectionEnd) { if (runByKey('⌘C')) e.preventDefault(); }
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
if (q0) qEl.value = q0;
qEl.focus();
deskProbe().then(refresh);
