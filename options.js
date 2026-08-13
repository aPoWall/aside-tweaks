// Aside Tweaks — настройки

const DEFAULT_KEYMAP = {
  favoriteTab: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: false },
  pinTab: { code: 'KeyD', meta: true, ctrl: false, alt: false, shift: true },
  tidyDuplicates: { code: 'KeyD', meta: true, ctrl: false, alt: true, shift: false },
  togglePanel: null,   // панель просит жест пользователя — надёжно только нативным ⌃⇧S
  bookmarkTab: null,
  openPalette: null,
  groupByRules: null,
  groupByDomain: null,
  ungroupAll: null,
  sortByDomain: null
};

const DEFAULTS = {
  dedupAuto: true, dedupIgnoreHash: true, dedupIgnoreUtm: true,
  keepPins: true, keymapEnabled: true, dimBehindPalette: true,
  tabPlacement: 'underCurrent', placementGuardMs: 2500,
  keymap: DEFAULT_KEYMAP,
  theme: { mode: 'auto', accent: '#111111', tint: 8, density: 'normal' },
  groupRules: [{ name: 'aim', patterns: ['aimindset', 'aim-'] }]
};

const ACTIONS = [
  ['favoriteTab', 'bookmark to the top', 'first row of the bar · closes the tab'],
  ['pinTab', 'pin / unpin tab', 'the squares on top of the sidebar · native ⌃D'],
  ['tidyDuplicates', 'clean duplicates + empty tabs', 'native ⌃⇧D'],
  ['togglePanel', 'open tweaks panel', 'native ⌃⇧S is more reliable'],
  ['bookmarkTab', 'bookmark, no dialog', ''],
  ['openPalette', 'palette', 'native ⌘K'],
  ['groupByRules', 'group by my blocks', ''],
  ['groupByDomain', 'group by site', ''],
  ['ungroupAll', 'ungroup everything', ''],
  ['sortByDomain', 'sort by site', '']
];

// сочетания, которые macOS/браузер забирают до страницы — перехватить нельзя
const RESERVED = [
  { code: 'KeyT', meta: true, shift: false }, { code: 'KeyW', meta: true },
  { code: 'KeyN', meta: true }, { code: 'KeyQ', meta: true },
  { code: 'KeyM', meta: true }, { code: 'KeyH', meta: true },
  { code: 'Tab', ctrl: true }
];

const saved = document.getElementById('saved');
let state = { ...DEFAULTS };

function flash(msg = 'saved ✓') {
  saved.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => saved.textContent = '', 1600);
}

async function patch(obj) {
  Object.assign(state, obj);
  await chrome.storage.sync.set(obj);
  flash();
}

// ---------- подпись сочетания ----------

const CODE_LABEL = {
  Space: '␣', Enter: '↵', Backspace: '⌫', Escape: 'esc', Tab: '⇥',
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';',
  Quote: "'", Backquote: '`', Minus: '−', Equal: '=',
  BracketLeft: '[', BracketRight: ']',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'
};

function codeLabel(code) {
  if (!code) return '';
  if (CODE_LABEL[code]) return CODE_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'num' + code.slice(6);
  return code;
}

function comboLabel(c) {
  if (!c) return '—';
  return (c.ctrl ? '⌃' : '') + (c.alt ? '⌥' : '') + (c.shift ? '⇧' : '') + (c.meta ? '⌘' : '') + codeLabel(c.code);
}

function isReserved(c) {
  if (!c) return false;
  return RESERVED.some(r =>
    r.code === c.code &&
    (r.meta == null || !!r.meta === !!c.meta) &&
    (r.ctrl == null || !!r.ctrl === !!c.ctrl) &&
    (r.shift == null || !!r.shift === !!c.shift));
}

// ---------- таблица клавиш ----------

function renderKeys() {
  const table = document.getElementById('keys');
  table.replaceChildren();
  for (const [action, label, note] of ACTIONS) {
    const tr = document.createElement('tr');

    const tdL = document.createElement('td');
    tdL.textContent = label;
    if (note) {
      const n = document.createElement('div');
      n.className = 'note';
      n.textContent = note;
      tdL.append(n);
    }

    const tdB = document.createElement('td');
    const b = document.createElement('button');
    const combo = state.keymap?.[action] || null;
    b.className = 'combo' + (isReserved(combo) ? ' warn' : '');
    b.textContent = comboLabel(combo);
    b.title = 'click to record · ⌫ clears · esc cancels';
    b.addEventListener('click', () => record(b, action));
    tdB.append(b);

    const tdC = document.createElement('td');
    tdC.style.width = '22px';
    if (combo) {
      const x = document.createElement('button');
      x.className = 'del';
      x.textContent = '×';
      x.title = 'clear shortcut';
      x.addEventListener('click', async () => {
        await patch({ keymap: { ...state.keymap, [action]: null } });
        renderKeys();
      });
      tdC.append(x);
    }

    tr.append(tdL, tdB, tdC);
    table.append(tr);
  }
}

let recording = null;

function record(btn, action) {
  if (recording) stopRecord();
  recording = { btn, action };
  btn.classList.add('rec');
  btn.textContent = 'press…';
  window.addEventListener('keydown', onRecordKey, true);
}

function stopRecord() {
  if (!recording) return;
  recording.btn.classList.remove('rec');
  window.removeEventListener('keydown', onRecordKey, true);
  recording = null;
  renderKeys();
}

async function onRecordKey(e) {
  if (!recording) return;
  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.key === 'Escape') { stopRecord(); return; }
  if (e.code === 'Backspace' || e.code === 'Delete') {
    const action = recording.action;
    stopRecord();
    await patch({ keymap: { ...state.keymap, [action]: null } });
    renderKeys();
    return;
  }
  // сами модификаторы не считаем нажатием
  if (['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) return;
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    recording.btn.textContent = 'needs ⌘ / ⌃ / ⌥';
    return;
  }

  const combo = { code: e.code, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
  const action = recording.action;
  // одно сочетание — одно действие: снимаем его с прежнего владельца
  const map = { ...state.keymap };
  for (const [k, v] of Object.entries(map)) {
    if (v && k !== action && comboLabel(v) === comboLabel(combo)) map[k] = null;
  }
  map[action] = combo;
  stopRecord();
  await patch({ keymap: map });
  renderKeys();
  if (isReserved(combo)) flash('⚠ the browser takes this one before the page — it will not fire');
}

// ---------- блоки ----------

function renderRules() {
  const table = document.getElementById('rules');
  table.replaceChildren();
  (state.groupRules || []).forEach((r, i) => {
    const tr = document.createElement('tr');

    const tdN = document.createElement('td');
    tdN.style.width = '110px';
    const inN = document.createElement('input');
    inN.type = 'text'; inN.value = r.name || ''; inN.placeholder = 'block name';
    tdN.append(inN);

    const tdP = document.createElement('td');
    const inP = document.createElement('input');
    inP.type = 'text'; inP.value = (r.patterns || []).join(', '); inP.placeholder = 'substrings, comma separated';
    tdP.append(inP);

    const tdD = document.createElement('td');
    tdD.style.width = '22px';
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '×';
    tdD.append(del);

    tr.append(tdN, tdP, tdD);
    table.append(tr);

    const save = async () => {
      const rules = [...state.groupRules];
      rules[i] = { name: inN.value.trim(), patterns: inP.value.split(',').map(s => s.trim()).filter(Boolean) };
      await patch({ groupRules: rules.filter(x => x.name) });
    };
    inN.addEventListener('change', save);
    inP.addEventListener('change', save);
    del.addEventListener('click', async () => {
      const rules = [...state.groupRules];
      rules.splice(i, 1);
      await patch({ groupRules: rules });
      renderRules();
    });
  });
}

// ---------- внешний вид ----------

function renderSwatches() {
  const box = document.getElementById('swatches');
  box.replaceChildren();
  for (const p of ACCENT_PRESETS) {
    const b = document.createElement('button');
    b.className = 'sw' + (p.value.toLowerCase() === (state.theme.accent || '').toLowerCase() ? ' on' : '');
    b.style.background = p.value;
    b.title = p.name;
    b.addEventListener('click', () => setTheme({ accent: p.value }));
    box.append(b);
  }
  document.getElementById('accentCustom').value = state.theme.accent || '#111111';
}

async function setTheme(part) {
  const theme = { ...state.theme, ...part };
  applyTheme(theme);                       // мгновенно, до записи в storage
  await patch({ theme });
  renderSwatches();
}

function seg(id, value, onPick) {
  const box = document.getElementById(id);
  for (const b of box.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === String(value));
    b.onclick = () => onPick(b.dataset.v);
  }
}

// ---------- сборка ----------

const TOGGLES = ['dedupAuto', 'dedupIgnoreHash', 'dedupIgnoreUtm', 'keepPins', 'keymapEnabled', 'dimBehindPalette'];

function renderAll() {
  for (const k of TOGGLES) document.getElementById(k).checked = !!state[k];

  seg('mode', state.theme.mode, v => setTheme({ mode: v }).then(renderAll));
  seg('density', state.theme.density, v => setTheme({ density: v }).then(renderAll));
  seg('placement', state.tabPlacement, v => patch({ tabPlacement: v }).then(renderAll));

  const tint = document.getElementById('tint');
  tint.value = state.theme.tint ?? 8;
  document.getElementById('tintVal').textContent = (state.theme.tint ?? 8) + '%';

  const guard = document.getElementById('guard');
  guard.value = state.placementGuardMs ?? 2500;
  document.getElementById('guardVal').textContent = (state.placementGuardMs ?? 2500) + ' ms';

  renderSwatches();
  renderKeys();
  renderRules();
}

chrome.storage.sync.get(DEFAULTS).then(s => {
  state = { ...DEFAULTS, ...s, theme: { ...DEFAULTS.theme, ...(s.theme || {}) } };
  renderAll();
});

for (const k of TOGGLES) {
  document.getElementById(k).addEventListener('change', e => patch({ [k]: e.target.checked }));
}

document.getElementById('tint').addEventListener('input', e => {
  const v = Number(e.target.value);
  document.getElementById('tintVal').textContent = v + '%';
  applyTheme({ ...state.theme, tint: v });
});
document.getElementById('tint').addEventListener('change', e => setTheme({ tint: Number(e.target.value) }));

document.getElementById('accentCustom').addEventListener('input', e => applyTheme({ ...state.theme, accent: e.target.value }));
document.getElementById('accentCustom').addEventListener('change', e => setTheme({ accent: e.target.value }));

document.getElementById('guard').addEventListener('input', e => {
  document.getElementById('guardVal').textContent = e.target.value + ' ms';
});
document.getElementById('guard').addEventListener('change', e => patch({ placementGuardMs: Number(e.target.value) }));

document.getElementById('addRule').addEventListener('click', async () => {
  await patch({ groupRules: [...(state.groupRules || []), { name: '', patterns: [] }] });
  renderRules();
});

document.getElementById('copyDefaults')?.addEventListener('click', async () => {
  const cmd = [
    'defaults write at.studio.AsideBrowser NSUserKeyEquivalents -dict-add "Bookmark This Tab…" "^@b"',
    'defaults write at.studio.AsideBrowser NSUserKeyEquivalents -dict-add "Bookmark All Tabs…" "^@$b"',
    'defaults write at.studio.AsideBrowser NSUserKeyEquivalents -dict-add "Always Show Bookmarks Bar" "~@$b"'
  ].join('\n');
  await navigator.clipboard.writeText(cmd).catch(() => { });
  flash('three commands copied · run them, then restart Aside');
});

document.getElementById('resetKeys').addEventListener('click', async () => {
  await patch({ keymap: { ...DEFAULT_KEYMAP } });
  renderKeys();
  flash('keys reset · ⌘D pins, ⌘⇧D cleans duplicates');
});

document.getElementById('native').addEventListener('click', async () => {
  const url = 'chrome://extensions/shortcuts';
  try {
    await chrome.tabs.create({ url });
  } catch {
    await navigator.clipboard.writeText(url).catch(() => { });
    flash('address copied: ' + url);
  }
});
