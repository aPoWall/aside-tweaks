/* aside tweaks · product page · the palette model that runs in the page. en/ru through aim-i18n (document lang). */
(() => {
  const paletteData = {
    palette: [
      ['Recent'], ['AT', 'Aside Tweaks · product page', 'apps.aimindset.org', 'tab'], ['S', 'Space · working surface', 'space.aimindset.org', 'tab'],
      ['Notes · edited today'], ['◇', 'aside product map', 'local Obsidian · edited today', 'note'], ['Commands'], ['★', 'save in Bookmarks', 'last native row · page stays active', '⌘D'], ['−', 'remove duplicates', 'preview exact / empty in this window', 'preview'], ['◎', 'review tab families', 'inspect first · nothing closes yet', '⌥⌘D']
    ],
    review: [
      ['Safe review'], ['◎', 'Nothing closes on this screen', 'choose keep, source or inspect', 'guide'], ['Batch'], ['−', 'Remove 3 exact / empty tabs', 'final preview · one confirmation', 'preview'],
      ['Related product · Space'], ['S', 'AI Mindset {space} · evolution', 'canonical · protected', 'keep'], ['D', 'Space Dataflow', 'unsaved form · protected', 'keep'], ['L', 'Space local preview', 'eligible sibling', 'close'],
      ['Sources'], ['G', 'Space product source', 'github.com', 'bookmark']
    ]
  };
  const T = {
    en: { start: 'drag the palette. arrows move, ⌘K opens actions.', palette: 'arrows move. ⌘K opens actions.', review: 'review is a proposal until you confirm.', kept: 'bookmark added at the end · live tab stays active.', returned: 'bookmark removed · live tab stays active.', actionsOn: 'actions open. choose the explicit verb.', actionsOff: 'actions closed.', moved: 'window moved. state stays put.' },
    ru: { start: 'тащи палитру. стрелки двигают, ⌘K открывает действия.', palette: 'стрелки двигают. ⌘K открывает действия.', review: 'ревью остаётся предложением, пока ты не подтвердишь.', kept: 'закладка добавлена в конец · живая вкладка активна.', returned: 'закладка снята · живая вкладка активна.', actionsOn: 'действия открыты. выбери точный глагол.', actionsOff: 'действия закрыты.', moved: 'окно передвинуто. состояние на месте.' }
  };
  const lang = () => (document.documentElement.lang === 'ru' ? 'ru' : 'en');
  const stage = document.getElementById('stage');
  const palette = document.getElementById('palette');
  const list = document.getElementById('paletteList');
  const query = document.getElementById('paletteQuery');
  const actionMenu = document.getElementById('actionMenu');
  const demoText = document.getElementById('demoText');
  const productVoxel = document.querySelector('.product-voxel');
  if (!stage || !palette || !list || !query || !actionMenu || !demoText) return;
  let mode = 'palette', selected = 0, kept = false;

  // Сцена повторяет реальный Aside: квадраты наверху принадлежат pinned, Bookmarks –
  // отдельный список, и новый bookmark появляется в его конце.
  if (!document.getElementById('bookmarks')) {
    const sidebar = stage.querySelector('.sidebar');
    const chatsHead = [...sidebar.querySelectorAll('.side-head')].find(el => el.textContent.includes('Chats'));
    const head = document.createElement('div'); head.className = 'side-head';
    const title = document.createElement('span'); title.textContent = 'Bookmarks';
    const fold = document.createElement('span'); fold.textContent = '⌃';
    head.append(title, fold);
    const bookmarks = document.createElement('div'); bookmarks.id = 'bookmarks';
    for (const [glyph, label] of [['AI', 'AI Mindset · apps'], ['DS', 'design system']]) {
      const row = document.createElement('div'); row.className = 'aside-tab bookmark';
      const icon = document.createElement('span'); icon.className = 'ico'; icon.textContent = glyph;
      const text = document.createElement('span'); text.textContent = label;
      row.append(icon, text); bookmarks.append(row);
    }
    sidebar.insertBefore(head, chatsHead);
    sidebar.insertBefore(bookmarks, chatsHead);
  }

  const setCopy = (el, en, ru) => {
    if (!el) return;
    el.dataset.en = en;
    el.dataset.ru = ru;
    el.textContent = (document.documentElement.lang === 'ru' ? ru : en);
  };
  const productVersion = document.querySelector('.product-header > span');
  if (productVersion) productVersion.textContent = '4.31.0';
  const bookmarkAction = actionMenu.querySelector('.action:nth-of-type(3)');
  if (bookmarkAction?.firstChild) bookmarkAction.firstChild.textContent = 'save selected tab in Bookmarks ';
  setCopy(document.querySelector('.hero .eyebrow'), 'aside browser extension · version 4.31.0', 'расширение для aside · версия 4.31.0');
  setCopy(document.querySelector('.hero .lead'),
    '⌘D moves the active page into the last native Bookmarks row and keeps it selected. Remove Duplicates opens a current-window preview. ⇧⌘K searches tabs, smart history, bookmarks, local Obsidian notes, Aside menu items and agents from one fast palette.',
    '⌘D переносит активную страницу в последнюю нативную строку Bookmarks и оставляет её выбранной. Remove Duplicates открывает превью текущего окна. ⇧⌘K быстро ищет вкладки, умную историю, закладки, локальные заметки Obsidian, меню Aside и агентов.');
  setCopy(document.querySelector('.hero .button.primary span'), 'get 4.31.0 on github', 'взять 4.31.0 на github');
  const releaseDate = document.querySelector('[data-release-date]');
  if (releaseDate) releaseDate.textContent = '2026-09-29';
  setCopy(document.querySelector('#example .example-head p:nth-child(2) span'),
    '⌘D moves that page into the last Bookmarks row. ⌥⌘D opens an inspection screen where nothing closes yet.',
    '⌘D переносит страницу в последнюю строку Bookmarks. ⌥⌘D открывает экран проверки, где пока ничего не закрывается.');
  setCopy(document.querySelector('#features article:first-child p:last-child'),
    'the active page leaves its tab group and becomes one live row at the bottom of native Bookmarks. it stays selected. press ⌘D again to return it to Tabs.',
    'активная страница выходит из группы вкладок и становится одной живой строкой внизу нативного Bookmarks. она остаётся выбранной. повторное ⌘D возвращает её в Tabs.');
  setCopy(document.querySelector('#features article:first-child h2'),
    'one saved row. still your page.',
    'одна сохранённая строка. та же страница.');
  setCopy(document.querySelector('#features article:nth-child(2) p:last-child'),
    'tabs, smart history, Bookmarks, local Obsidian notes, Aside menu items, commands and agents share one field. note sections name why they appear: edited today, filename match, last modified or last opened. ⌘K opens explicit actions for the selected row.',
    'вкладки, умная история, Bookmarks, локальные заметки Obsidian, меню Aside, команды и агенты живут в одном поле. раздел заметок объясняет выбор: изменено сегодня, совпадение имени, последняя правка или последнее открытие. ⌘K открывает точные действия выбранной строки.');
  setCopy(document.querySelector('#features article:nth-child(3) p:last-child'),
    'exact copies, related products, stale events and research sources stay separate. the first screen only inspects; every close batch gets its own final preview and local receipt.',
    'точные копии, связанные продукты, устаревшие события и исследовательские источники разделены. первый экран только проверяет; каждая пачка закрытия получает отдельное финальное превью и локальный чек.');
  setCopy(document.querySelector('#install > .eyebrow'), 'unpacked extension · 4.31.0', 'распакованное расширение · 4.31.0');
  setCopy(document.querySelector('#install h3 + p'),
    'pull the repository and press reload on the extension card. 4.31.0 keeps keymaps, bookmark order, pins, groups, review state, bridge config and theme settings. cleanup now stops at a current-window preview; rollback to 4.30 restores the old global direct-cleanup path.',
    'обновите репозиторий и нажмите reload на карточке расширения. 4.31.0 сохраняет клавиши, порядок закладок, пины, группы, ревью, bridge и тему. очистка теперь останавливается на превью текущего окна; откат на 4.30 возвращает старый глобальный direct-cleanup.');
  setCopy(document.querySelector('.privacy h3 + p'),
    'version 4.31.0 uses the shared apps shell and keeps the panel state local. the character, product mark and toolbar icon come from the same checked exports.',
    'версия 4.31.0 использует общую оболочку apps и хранит состояние панели локально. персонаж, знак продукта и иконка панели приходят из одних проверенных экспортов.');

  function say(key) {
    demoText.dataset.key = key;
    demoText.textContent = T[lang()][key] || '';
    if (['kept', 'returned', 'actionsOn', 'moved'].includes(key) && productVoxel?.__aimv) {
      window.AIMVoxel?.gesture(productVoxel);
    }
  }
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
    const tab = document.getElementById('keepTab'), bookmarks = document.getElementById('bookmarks');
    if (kept) {
      bookmarks.querySelector('[data-demo-bookmark]')?.remove();
      tab.style.removeProperty('display');
      tab.classList.add('active'); kept = false; say('returned'); return;
    }
    const stageRect = stage.getBoundingClientRect(), tabRect = tab.getBoundingClientRect(), destRect = bookmarks.getBoundingClientRect();
    const clone = tab.cloneNode(true); clone.removeAttribute('id'); clone.className = 'aside-tab fly';
    clone.style.left = (tabRect.left - stageRect.left) + 'px'; clone.style.top = (tabRect.top - stageRect.top) + 'px'; clone.style.width = tabRect.width + 'px'; stage.append(clone);
    const dx = destRect.left - tabRect.left, dy = destRect.bottom - tabRect.top + 2;
    const finish = () => {
      clone.remove();
      const row = document.createElement('div'); row.className = 'aside-tab bookmark new active'; row.dataset.demoBookmark = '';
      const icon = document.createElement('span'); icon.className = 'ico'; icon.textContent = 'AT';
      const title = document.createElement('span'); title.textContent = 'Aside Tweaks · product page';
      row.append(icon, title); bookmarks.append(row);
      tab.classList.remove('active');
      tab.style.display = 'none';
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
