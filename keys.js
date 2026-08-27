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

// цвет рамки палитры до загрузки документа — иначе на тёмной теме мигает серым
let paletteSkin = { bg: '#ececec', line: 'rgba(0,0,0,.14)', dark: false };
function skinOf(t) {
  const look = t?.look === 'paper' ? 'paper' : 'aside';
  const m = t?.mode || 'light';
  const dark = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const bg = { aside: ['#ececec', '#1e1e20'], paper: ['#f2ede3', '#1a1a18'] }[look][dark ? 1 : 0];
  return { bg, line: dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)', dark };
}

chrome.storage.sync.get({ keymap: null, keymapEnabled: true, theme: null }).then(s => {
  // поверх дефолтной, а не вместо неё — иначе новые действия остаются без клавиш
  keymap = { ...DEFAULT_KEYMAP, ...(s.keymap || {}) };
  enabled = s.keymapEnabled !== false;
  paletteSkin = skinOf(s.theme);
}).catch(() => { });

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'sync') return;
  if (ch.keymap) keymap = { ...DEFAULT_KEYMAP, ...(ch.keymap.newValue || {}) };
  if (ch.keymapEnabled) enabled = ch.keymapEnabled.newValue !== false;
  if (ch.theme) paletteSkin = skinOf(ch.theme.newValue);
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
let signalHost = false;   // палитра стоит на сигнальной странице моста — после закрытия та уходит

function closePalette() {
  if (!palette) return;
  const el = palette;
  palette = null;
  paletteReady = false;
  el.classList.add('out');
  setTimeout(() => el.remove(), 160);
  if (signalHost) {
    signalHost = false;
    try { chrome.runtime.sendMessage({ action: 'signalDone' }, () => void chrome.runtime.lastError); } catch { }
  }
}

function openPaletteLayer({ win, tab, q, signal }) {
  if (palette) return true;
  if (!document.body) return false;
  signalHost = !!signal;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';
  host.style.setProperty('--tw-bg', paletteSkin.bg);
  host.style.setProperty('--tw-line', paletteSkin.line);
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .back {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, .32);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      opacity: 0; transition: opacity .16s ease;
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
      border: 1px solid var(--tw-line, rgba(0, 0, 0, .14)); border-radius: 12px;
      background: var(--tw-bg, #ececec);
      box-shadow: 0 30px 90px rgba(0, 0, 0, .40), 0 8px 24px rgba(0, 0, 0, .22);
      opacity: 0; transform: translateY(-6px) scale(.99);
      transition: opacity .16s ease, transform .16s cubic-bezier(.2, .8, .3, 1);
    }
    @media (prefers-reduced-motion: reduce) { .back, iframe { transition: none; } }
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
  frame.src = chrome.runtime.getURL('palette.html') + '?embed=1&win=' + (win ?? '') + '&tab=' + (tab ?? '') + (q ? '&q=' + encodeURIComponent(q) : '');
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

// сигнальная страница моста: сюда приводит `open -a Aside http://127.0.0.1:<port>/aside-tweaks/palette`
// с глобальной клавиши (Raycast, Hammerspoon) — просим палитру, дальше решает фон
const SIGNAL_PAGE = /^127\.0\.0\.1(:\d+)?$/.test(location.host) && location.pathname === '/aside-tweaks/palette';
if (SIGNAL_PAGE && window.top === window) {
  const fire = () => {
    const q = new URLSearchParams(location.search).get('q') || '';
    try { chrome.runtime.sendMessage({ action: 'paletteSignal', q }, () => void chrome.runtime.lastError); } catch { }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fire, { once: true });
  else fire();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'ping') { sendResponse({ pong: true, top: window.top === window }); return; }
  if (msg?.type === 'toast' && typeof msg.text === 'string') toast(msg.text);
  if (msg?.type === 'dim') setDim(!!msg.on);
  if (msg?.type === 'palette') {
    if (window.top !== window) return;          // слой строит только верхний документ
    if (!msg.on) { closePalette(); sendResponse({ shown: false }); return; }
    sendResponse({ shown: openPaletteLayer(msg) });
  }
});
