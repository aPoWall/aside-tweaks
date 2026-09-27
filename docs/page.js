/* aside tweaks · product page · the palette model that runs in the page. en/ru through aim-i18n (document lang). */
(() => {
  const paletteData = {
    palette: [
      ['Recent'], ['AT', 'Aside Tweaks · product page', 'apps.aimindset.org', 'tab'], ['S', 'Space · working surface', 'space.aimindset.org', 'tab'],
      ['Notes'], ['◇', 'aside product map', 'Obsidian · today', 'note'], ['Commands'], ['★', 'bookmark ⇄ tab', 'first in the bar · pinned on top', '⌘D'], ['◎', 'review tabs', 'exact · related · event · source', '⌥⌘D']
    ],
    review: [
      ['Related product · Space'], ['S', 'AI Mindset {space} · evolution', 'canonical · protected', 'keep'], ['D', 'Space Dataflow', 'unsaved form · protected', 'keep'], ['L', 'Space local preview', 'eligible sibling', 'close'],
      ['Sources'], ['G', 'Space product source', 'github.com', 'bookmark']
    ]
  };
  const T = {
    en: { start: 'drag the palette. arrows move, ⌘K opens actions.', palette: 'arrows move. ⌘K opens actions.', review: 'review is a proposal until you confirm.', kept: 'saved first · pinned on top · still active.', returned: 'row and square removed · page stays active.', actionsOn: 'actions open. choose the explicit verb.', actionsOff: 'actions closed.', moved: 'window moved. state stays put.' },
    ru: { start: 'тащи палитру. стрелки двигают, ⌘K открывает действия.', palette: 'стрелки двигают. ⌘K открывает действия.', review: 'ревью остаётся предложением, пока ты не подтвердишь.', kept: 'сохранено первой · закреплено наверху · фокус на месте.', returned: 'строка и квадрат сняты · страница остаётся активной.', actionsOn: 'действия открыты. выбери точный глагол.', actionsOff: 'действия закрыты.', moved: 'окно передвинуто. состояние на месте.' }
  };
  const lang = () => (document.documentElement.lang === 'ru' ? 'ru' : 'en');
  const stage = document.getElementById('stage');
  const palette = document.getElementById('palette');
  const list = document.getElementById('paletteList');
  const query = document.getElementById('paletteQuery');
  const actionMenu = document.getElementById('actionMenu');
  const demoText = document.getElementById('demoText');
  if (!stage || !palette || !list || !query || !actionMenu || !demoText) return;
  let mode = 'palette', selected = 0, kept = false;

  const setCopy = (el, en, ru) => {
    if (!el) return;
    el.dataset.en = en;
    el.dataset.ru = ru;
    el.textContent = (document.documentElement.lang === 'ru' ? ru : en);
  };
  setCopy(document.querySelector('#example .example-head p:nth-child(2) span'),
    '⌘D puts that page first in the bar and pins it into the square on top. ⌥⌘D shows the cluster.',
    '⌘D кладёт её первой строкой панели и закрепляет квадратом наверху. ⌥⌘D показывает кластер.');
  setCopy(document.querySelector('#features article:first-child p:last-child'),
    'the row becomes the first bookmark row and the live page becomes a pinned square on top, with the focus still on it. press ⌘D again to remove both while the page stays open.',
    'строка становится первой в закладках, а живая страница закрепляется квадратом наверху и держит фокус. повторное ⌘D снимает строку и квадрат, оставляя страницу открытой.');
  setCopy(document.querySelector('#install > .eyebrow'), 'unpacked extension · 4.28.0', 'распакованное расширение · 4.28.0');
  setCopy(document.querySelector('#install h3 + p'),
    'pull the repository and press reload on the extension card. 4.28.0 keeps keymaps, bookmarks, review state, bridge config and theme settings. it restores the ⌘D pin switch once; rollback to 4.27 keeps every bookmark and pin.',
    'обновите репозиторий и нажмите reload на карточке расширения. 4.28.0 сохраняет клавиши, закладки, ревью, bridge и тему. версия один раз возвращает pin для ⌘D; откат на 4.27 сохраняет все закладки и пины.');
  setCopy(document.querySelector('.privacy h3 + p'),
    'version 4.28.0 uses the shared apps shell and keeps the panel state local. the character, product mark and toolbar icon come from the same checked exports.',
    'версия 4.28.0 использует общую оболочку apps и хранит состояние панели локально. персонаж, знак продукта и иконка панели приходят из одних проверенных экспортов.');

  function say(key) { demoText.dataset.key = key; demoText.textContent = T[lang()][key] || ''; }
  document.addEventListener('aim:lang', () => say(demoText.dataset.key || 'start'));

  function rowsForMode() {
    const q = query.value.trim().toLowerCase();
    return paletteData[mode === 'review' ? 'review' : 'palette'].filter(row => row.length === 1 || !q || row.join(' ').toLowerCase().includes(q));
  }
  function draw() {
    const rows = rowsForMode(), selectable = rows.filter(row => row.length > 1);
    selected = Math.max(0, Math.min(selected, selectable.length - 1)); list.replaceChildren(); let optionIndex = 0;
    rows.forEach(row => {
      if (row.length === 1) { const h = document.createElement('div'); h.className = 'result-head'; h.textContent = row[0]; list.append(h); return; }
      const el = document.createElement('div'); el.className = 'result' + (optionIndex === selected ? ' sel' : ''); el.setAttribute('role', 'option'); el.setAttribute('aria-selected', String(optionIndex === selected));
      const cells = [['glyph', row[0]], ['title', row[1]], ['sub', row[2]], ['kind', row[3]]];
      cells.forEach(([cls, text]) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; el.append(s); });
      const own = optionIndex; el.addEventListener('click', () => { selected = own; draw(); }); list.append(el); optionIndex++;
    });
    document.getElementById('primaryAction').textContent = mode === 'review' ? 'inspect' : 'open';
  }
  function togglePalette(open = true) {
    palette.classList.toggle('closed', !open); actionMenu.classList.remove('on');
    if (open) { setTimeout(() => query.focus({ preventScroll: true }), 180); say(mode === 'review' ? 'review' : 'palette'); }
  }
  function setMode(next) {
    mode = next; selected = 0; query.value = '';
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === next));
    document.getElementById('scopes').hidden = next === 'review'; draw();
    if (next === 'keep') { togglePalette(false); setTimeout(keepPage, 120); } else togglePalette(true);
  }
  function keepPage() {
    const tab = document.getElementById('keepTab'), favorites = document.getElementById('favorites');
    if (kept) {
      favorites.querySelector('[data-demo-favorite]')?.remove();
      tab.classList.remove('parked'); tab.classList.add('active'); kept = false; say('returned'); return;
    }
    const stageRect = stage.getBoundingClientRect(), tabRect = tab.getBoundingClientRect(), destRect = favorites.getBoundingClientRect();
    const clone = tab.cloneNode(true); clone.removeAttribute('id'); clone.className = 'aside-tab fly';
    clone.style.left = (tabRect.left - stageRect.left) + 'px'; clone.style.top = (tabRect.top - stageRect.top) + 'px'; clone.style.width = tabRect.width + 'px'; stage.append(clone);
    const dx = destRect.left - tabRect.left + 6, dy = destRect.top - tabRect.top + 4;   // 4.25: новая строка встаёт первой в полосе
    const finish = () => {
      // 4.26: страница встаёт первой строкой закладок и квадратиком наверху –
      // в сайдбаре она живёт квадратом, строка вкладки уступает ему место
      clone.remove();
      const fav = document.createElement('span'); fav.className = 'favorite new'; fav.dataset.demoFavorite = ''; fav.textContent = 'AT'; favorites.prepend(fav);
      tab.classList.add('parked'); tab.classList.remove('active');
      kept = true; say('kept');
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !clone.animate) { finish(); return; }
    const anim = clone.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .64}px,${dy * .38}px) scale(.88)`, offset: .55 }, { transform: `translate(${dx}px,${dy}px) scale(.32)`, opacity: .2 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    anim.onfinish = finish;
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('#scopes button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('#scopes button').forEach(b => b.classList.toggle('on', b === button));
    query.value = button.textContent === 'all' ? '' : button.textContent; selected = 0; draw();
  }));
  query.addEventListener('input', () => { selected = 0; draw(); });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.metaKey && event.shiftKey && key === 'k') { event.preventDefault(); setMode('palette'); return; }
    if (event.metaKey && !event.shiftKey && !event.altKey && key === 'd' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); setMode('keep'); return; }
    if (event.metaKey && !event.shiftKey && key === 'k' && !palette.classList.contains('closed')) { event.preventDefault(); actionMenu.classList.toggle('on'); say(actionMenu.classList.contains('on') ? 'actionsOn' : 'actionsOff'); return; }
    if (event.key === 'Escape') { togglePalette(false); return; }
    if (!palette.classList.contains('closed') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); const count = rowsForMode().filter(row => row.length > 1).length; selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + count) % count; draw();
    }
  }, true);
  let drag = null;
  const handle = document.getElementById('paletteHandle');
  handle.addEventListener('pointerdown', event => {
    if (event.target.closest('input,kbd')) return;
    drag = { x: event.clientX, y: event.clientY, dx: parseFloat(palette.style.getPropertyValue('--dx')) || 0, dy: parseFloat(palette.style.getPropertyValue('--dy')) || 0 };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag) return;
    const bounds = stage.getBoundingClientRect(), box = palette.getBoundingClientRect();
    const wantX = drag.dx + event.clientX - drag.x, wantY = drag.dy + event.clientY - drag.y;
    const dx = Math.max(wantX - (box.left - bounds.left) + 6, Math.min(wantX + (bounds.right - box.right) - 6, wantX));
    const dy = Math.max(wantY - (box.top - bounds.top) + 48, Math.min(wantY + (bounds.bottom - box.bottom) - 6, wantY));
    palette.style.setProperty('--dx', dx + 'px'); palette.style.setProperty('--dy', dy + 'px');
  });
  handle.addEventListener('pointerup', event => { drag = null; handle.releasePointerCapture(event.pointerId); say('moved'); });
  say('start'); draw();
})();
