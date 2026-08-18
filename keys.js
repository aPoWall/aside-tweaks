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
  tidyUp: { code: 'KeyT', meta: true, ctrl: false, alt: true, shift: false },
  togglePanel: null,   // панель просит жест пользователя — надёжно только нативным ⌃⇧S
  bookmarkTab: null,
  openPalette: { code: 'KeyK', meta: true, ctrl: false, alt: false, shift: true },
  groupByRules: null,
  groupByDomain: null,
  ungroupAll: null,
  sortByDomain: null,
  sortByOpened: null
};

let enabled = true;
let keymap = DEFAULT_KEYMAP;

chrome.storage.sync.get({ keymap: null, keymapEnabled: true }).then(s => {
  // поверх дефолтной, а не вместо неё — иначе новые действия остаются без клавиш
  keymap = { ...DEFAULT_KEYMAP, ...(s.keymap || {}) };
  enabled = s.keymapEnabled !== false;
}).catch(() => { });

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'sync') return;
  if (ch.keymap) keymap = { ...DEFAULT_KEYMAP, ...(ch.keymap.newValue || {}) };
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

// ---------- палитра слоем поверх страницы ----------
// Отдельное окно нельзя лишить заголовка и светофора, и тень оно кладёт системную.
// Слой на странице читается полем: затемнение, размытие, крупная тень, своя анимация.
// Страница может запретить чужие рамки своей политикой — тогда молча уходим в окно.

let palette = null;
let paletteReady = false;

function closePalette() {
  if (!palette) return;
  const el = palette;
  palette = null;
  paletteReady = false;
  el.classList.add('out');
  setTimeout(() => el.remove(), 160);
}

function openPaletteLayer({ win, tab }) {
  if (palette) return true;
  if (!document.body) return false;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .back {
      position: fixed; inset: 0;
      background: rgba(10, 9, 8, .5);
      backdrop-filter: blur(3px) saturate(.9);
      -webkit-backdrop-filter: blur(3px) saturate(.9);
      opacity: 0; transition: opacity .18s ease;
    }
    .wrap {
      position: fixed; inset: 0;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 12vh 16px 16px;
      pointer-events: none;
    }
    iframe {
      pointer-events: auto;
      width: min(660px, 92vw); height: min(500px, 72vh);
      border: 1px solid rgba(0, 0, 0, .22); border-radius: 13px;
      background: #f2ede3;
      box-shadow: 0 42px 120px rgba(0, 0, 0, .55), 0 12px 34px rgba(0, 0, 0, .32);
      opacity: 0; transform: translateY(-8px) scale(.985);
      transition: opacity .18s ease, transform .18s cubic-bezier(.2, .8, .3, 1);
    }
    :host(.in) .back { opacity: 1; }
    :host(.in) iframe { opacity: 1; transform: none; }
    :host(.out) .back { opacity: 0; }
    :host(.out) iframe { opacity: 0; transform: translateY(-6px) scale(.99); }
  `;

  const back = document.createElement('div');
  back.className = 'back';
  back.addEventListener('mousedown', closePalette);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'aside tweaks palette');
  frame.src = chrome.runtime.getURL('palette.html') + '?embed=1&win=' + (win ?? '') + '&tab=' + (tab ?? '');
  wrap.append(frame);

  root.append(style, back, wrap);
  // не в body: сайт мог повесить на него transform, и тогда fixed внутри перестаёт быть fixed
  document.documentElement.append(host);
  palette = host;
  requestAnimationFrame(() => host.classList.add('in'));
  setTimeout(() => frame.focus(), 40);

  // рамку могла срезать политика безопасности страницы — тогда пусть открывается окном
  setTimeout(() => {
    if (palette === host && !paletteReady) {
      closePalette();
      try { chrome.runtime.sendMessage({ action: 'openPaletteWindow' }, () => void chrome.runtime.lastError); } catch { }
    }
  }, 900);
  return true;
}

window.addEventListener('message', (e) => {
  if (e.data?.tw === 'palette-ready') paletteReady = true;
  if (e.data?.tw === 'palette-close') closePalette();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'toast' && typeof msg.text === 'string') toast(msg.text);
  if (msg?.type === 'dim') setDim(!!msg.on);
  if (msg?.type === 'palette') {
    if (window.top !== window) return;          // слой строит только верхний документ
    if (!msg.on) { closePalette(); sendResponse({ shown: false }); return; }
    sendResponse({ shown: openPaletteLayer(msg) });
  }
});
