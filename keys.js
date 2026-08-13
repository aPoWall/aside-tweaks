// Aside Tweaks — своя раскладка клавиш поверх браузерных
//
// Почему так: chrome.commands нельзя переназначить из расширения (только на
// системной странице браузера) и нельзя повесить на занятые браузером сочетания.
// А keydown в capture-фазе приходит в страницу РАНЬШЕ, чем браузер применит свой
// акселератор, поэтому preventDefault() перебивает ⌘D, ⌘⇧D, ⌘S, ⌘P и подобные.
// Не перебиваются только зарезервированные системой: ⌘T, ⌘W, ⌘N, ⌘Q, ⌘⇧W, ⌘M.

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

let enabled = true;
let keymap = DEFAULT_KEYMAP;

chrome.storage.sync.get({ keymap: DEFAULT_KEYMAP, keymapEnabled: true }).then(s => {
  keymap = s.keymap || DEFAULT_KEYMAP;
  enabled = s.keymapEnabled !== false;
}).catch(() => { });

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'sync') return;
  if (ch.keymap) keymap = ch.keymap.newValue || DEFAULT_KEYMAP;
  if (ch.keymapEnabled) enabled = ch.keymapEnabled.newValue !== false;
});

function hit(e, c) {
  return !!c && e.code === c.code &&
    e.metaKey === !!c.meta && e.ctrlKey === !!c.ctrl &&
    e.altKey === !!c.alt && e.shiftKey === !!c.shift;
}

window.addEventListener('keydown', (e) => {
  if (!enabled || e.repeat || e.isComposing) return;
  // без модификаторов не перехватываем — иначе сломаем ввод текста
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return;
  for (const [action, combo] of Object.entries(keymap)) {
    if (!hit(e, combo)) continue;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      chrome.runtime.sendMessage({ action }, () => void chrome.runtime.lastError);
    } catch { /* расширение перезагрузили — контекст протух */ }
    return;
  }
}, true);

// ---------- всплывающая подсказка: что именно произошло ----------

let host = null, toastBox = null, hideTimer = null;

function toast(text) {
  if (!document.body) return;
  if (!host || !host.isConnected) {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483647;inset:auto 16px 16px auto;pointer-events:none';
    // closed-режим: наружу shadowRoot не отдаётся, поэтому держим ссылку на плашку сами
    const root = host.attachShadow({ mode: 'closed' });
    const box = document.createElement('div');
    box.style.cssText = [
      'font:11px/1.4 "SF Mono", ui-monospace, Menlo, monospace',
      'background:#111;color:#fff;padding:7px 11px;border-radius:5px',
      'box-shadow:0 4px 18px rgba(0,0,0,.28);opacity:0;transition:opacity .12s',
      'white-space:pre-line;max-width:280px'
    ].join(';');
    root.append(box);
    document.body.append(host);
    toastBox = box;
  }
  if (!toastBox) return;
  toastBox.textContent = text;
  toastBox.style.opacity = '1';
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (toastBox) toastBox.style.opacity = '0'; }, 1900);
}


// ---------- затемнение страницы, пока открыта палитра ----------

let dimEl = null;

function setDim(on) {
  if (!document.body) return;
  if (on) {
    if (!dimEl || !dimEl.isConnected) {
      dimEl = document.createElement('div');
      dimEl.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483646', 'pointer-events:none',
        'background:rgba(12,11,9,.42)', 'backdrop-filter:blur(1.5px)',
        '-webkit-backdrop-filter:blur(1.5px)',
        'opacity:0', 'transition:opacity .16s ease'
      ].join(';');
      document.body.append(dimEl);
    }
    requestAnimationFrame(() => { if (dimEl) dimEl.style.opacity = '1'; });
  } else if (dimEl) {
    const el = dimEl;
    dimEl = null;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'toast' && typeof msg.text === 'string') toast(msg.text);
  if (msg?.type === 'dim') setDim(!!msg.on);
});
