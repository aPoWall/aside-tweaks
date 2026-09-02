// Aside Tweaks — попап. Плитки собираются из commands.js: одна правка меняет
// и попап, и панель, и палитру. Секции — по полю group, имена — по short.

const LABELS = {
  tidyDuplicates: () => 'review opened',
  pinTab: n => n === 1 ? 'pinned ↑' : 'unpinned',
  favoriteTab: n => n === 1 ? 'bookmarked ↑ first · tab closed, next tab active' : 'bookmark removed · the tab stays',
  bookmarkTab: n => n === 1 ? 'bookmarked ✓' : 'bookmark removed',
  groupByRules: n => n ? `${n} blocks` : 'nothing to group',
  groupByDomain: n => n ? `${n} blocks` : 'nothing to group',
  groupBySense: n => n ? `${n} blocks proposed` : 'no key · settings card 07',
  ungroupAll: n => n ? `${n} ungrouped` : 'no blocks',
  sortByDomain: n => `${n} ordered by site`,
  sortByOpened: n => `${n} ordered by open time`,
  tidyUp: () => 'review opened',
  openPalette: () => 'palette'
};

const SECTIONS = [
  { group: 'surface', n: '01', title: 'surfaces' },
  { group: 'tab', n: '02', title: 'this tab' },
  { group: 'window', n: '03', title: 'this window' },
  { group: 'order', n: '', title: '' }
];

// версия берётся из манифеста: подписанная руками разъезжается с установленной
document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

const status = document.getElementById('status');
const say = t => { status.textContent = t; };
let stats = null;

function tile(c) {
  const b = document.createElement('button');
  b.className = 'tile';
  b.dataset.action = c.action;
  b.title = c.hint;
  const main = document.createElement('span');
  main.className = 'tile-main';
  main.textContent = (c.glyph && c.group !== 'surface' && c.group !== 'tab' ? c.glyph + ' ' : '') + c.short;
  if (c.key) {
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = c.key;
    main.append(k);
  }
  b.append(main);
  if (c.action === 'tidyDuplicates') {
    const s = document.createElement('span');
    s.className = 'tile-sub';
    s.id = 'dupsub';
    s.textContent = 'protected preview';
    b.append(s);
  }
  b.addEventListener('click', () => run(c));
  return b;
}

function build() {
  const box = document.getElementById('secs');
  box.replaceChildren();
  const cmds = commandsFor('popup');
  for (const sec of SECTIONS) {
    const list = cmds.filter(c => c.group === sec.group);
    if (!list.length) continue;
    const wrap = document.createElement('div');
    wrap.className = 'sec';
    if (sec.title) {
      const l = document.createElement('div');
      l.className = 'sec-label';
      l.innerHTML = `<span class="n">${sec.n}</span> ${sec.title}`;
      wrap.append(l);
    }
    const grid = document.createElement('div');
    grid.className = 'tiles' + (sec.group === 'order' ? ' three' : '');
    for (const c of list) grid.append(tile(c));
    wrap.append(grid);
    box.append(wrap);
  }
}

async function refreshStats() {
  // service worker может спать — первый вызов его будит, второй уже отвечает
  let res = await chrome.runtime.sendMessage({ action: 'getStats' }).catch(() => null);
  if (!res?.ok) res = await chrome.runtime.sendMessage({ action: 'getStats' }).catch(() => null);
  if (!res?.ok) { document.getElementById('statsub').textContent = 'service worker asleep · press again'; return; }
  stats = res.data || null;
  if (!stats) return;
  const { total, dups, pinned, empties = 0 } = stats;
  document.getElementById('stats').textContent = `${total} tabs`;
  const parts = [];
  if (dups) parts.push(`${dups} duplicate${dups === 1 ? '' : 's'}`);
  if (empties) parts.push(`${empties} empty`);
  if (pinned) parts.push(`${pinned} pinned`);
  document.getElementById('statsub').textContent = parts.length ? '· ' + parts.join(' · ') : '· clean';
  const d = document.getElementById('dupsub');
  if (d) d.textContent = (dups || empties) ? `review ${dups + empties}` : 'review product families';
}

async function run(c) {
  // открыть панель можно только по жесту пользователя — клик в попапе им и является
  if (c.action === 'togglePanel') {
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
    try { await chrome.sidePanel.open(w ? { windowId: w.id } : {}); window.close(); }
    catch (e) { say('failed: ' + String(e).slice(0, 40)); }
    return;
  }
  say('…');
  const res = await chrome.runtime.sendMessage({ action: c.action }).catch(() => null);
  const label = LABELS[c.action];
  say(res?.ok ? (label ? label(res.count) : 'done') : 'error: ' + (res?.error || '?'));
  refreshStats();
}

build();
refreshStats();
