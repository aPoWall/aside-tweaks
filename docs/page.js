/* aside tweaks · product page · the palette model that runs in the page. en/ru through aim-i18n (document lang). */
(() => {
  const paletteData = {
    palette: [
      ['Recent'], ['AT', 'Aside Tweaks · product page', 'apps.aimindset.org', 'tab'], ['S', 'Space · working surface', 'space.aimindset.org', 'tab'],
      ['Bookmarks'], ['★', 'AI Mindset apps', 'apps.aimindset.org · saved locally', 'bookmark'],
      ['History'], ['◴', 'Calendar Control', 'apps.aimindset.org/calendar-control · visited locally', 'history'],
      ['Notes · edited today'], ['◇', 'aside product map', 'local Obsidian · edited today', 'note'], ['Commands'], ['★', 'save in Bookmarks', 'last native row · page stays active', '⌘D'], ['−', 'remove duplicates', 'preview exact / empty in this window', 'preview'], ['◎', 'review tab families', 'inspect first · nothing closes yet', '⌥⌘D']
    ],
    review: [
      ['Safe review · synthetic window'], ['◎', 'Nothing closes on this screen', '5 demo tabs · no browser access', 'guide'], ['Batch'], ['−', 'Preview 2 exact copies', '3 protected tabs stay', 'preview'],
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
  const demoControls = document.createElement('div'); demoControls.className = 'demo-batch-controls'; demoControls.hidden = true;
  palette.insertBefore(demoControls, palette.querySelector('.palette-foot'));
  let mode = 'palette', selected = 0, kept = false, demoScope = 'all';
  let reviewStep = 'inspect';
  const demoTabs = [
    ['◆', 'Space · pinned home', 'pinned · stays', 'protected'],
    ['★', 'Space · saved page', 'bookmarked · stays', 'protected'],
    ['★', 'Space · saved copy', 'bookmarked duplicate · stays', 'protected'],
    ['−', 'Space · preview copy A', 'exact copy of pinned home · close', 'eligible'],
    ['−', 'Space · preview copy B', 'exact copy of pinned home · close', 'eligible']
  ];

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
  if (productVersion) productVersion.textContent = '4.33.0';
  const bookmarkAction = actionMenu.querySelector('.action:nth-of-type(3)');
  if (bookmarkAction?.firstChild) bookmarkAction.firstChild.textContent = 'save selected tab in Bookmarks ';
  setCopy(document.querySelector('.hero .eyebrow'), 'aside browser extension · version 4.33.0', 'расширение для aside · версия 4.33.0');
  setCopy(document.querySelector('.hero .lead'),
    '⌘D moves the active page into the last native Bookmarks row and keeps it selected. Remove Duplicates opens a current-window preview. ⇧⌘K searches tabs, smart history, bookmarks, local Obsidian notes, Aside menu items and agents from one fast palette.',
    '⌘D переносит активную страницу в последнюю нативную строку Bookmarks и оставляет её выбранной. Remove Duplicates открывает превью текущего окна. ⇧⌘K быстро ищет вкладки, умную историю, закладки, локальные заметки Obsidian, меню Aside и агентов.');
  setCopy(document.querySelector('.hero .button.primary span'), 'get 4.33.0 on github', 'взять 4.33.0 на github');
  const releaseDate = document.querySelector('[data-release-date]');
  if (releaseDate) releaseDate.textContent = '2026-10-03';
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
  setCopy(document.querySelector('#install > .eyebrow'), 'unpacked extension · 4.33.0', 'распакованное расширение · 4.33.0');
  setCopy(document.querySelector('#install h3 + p'),
    'pull the repository and press reload on the extension card. 4.33.0 adds Pin squares, ordered Bookmarks, a local filter and a Current action. Keymaps, browser data, bridge and theme stay intact. Rollback to 4.32 restores the previous panel.',
    'обновите репозиторий и нажмите reload на карточке расширения. 4.33.0 добавляет квадраты Pins, полный Bookmarks, локальный фильтр и кнопку Current. Клавиши, данные браузера, bridge и тема сохраняются. Откат на 4.32 возвращает прежнюю панель.');
  setCopy(document.querySelector('.privacy h3 + p'),
    'version 4.33.0 uses the shared apps shell and keeps the panel state local. the character, product mark and toolbar icon come from the same checked exports.',
    'версия 4.33.0 использует общую оболочку apps и хранит состояние панели локально. персонаж, знак продукта и иконка панели приходят из одних проверенных экспортов.');

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
    if (mode === 'review' && reviewStep !== 'inspect') {
      if (reviewStep === 'receipt') return [
        [lang() === 'ru' ? 'Чек · только демо' : 'Receipt · demo only'],
        ['✓', '2 closed / 3 stays', 'reviewed window · synthetic-01', 'receipt'],
        ...demoTabs.slice(0, 3),
        ['Closed'], ...demoTabs.slice(3).map(row => [row[0], row[1], 'closed after explicit confirmation', 'closed'])
      ];
      return [['Final preview · synthetic-01'], ...demoTabs];
    }
    const out = []; let section = null, added = false;
    for (const row of paletteData[mode === 'review' ? 'review' : 'palette']) {
      if (row.length === 1) { section = row; added = false; continue; }
      const scope = { tab: 'tabs', note: 'notes', bookmark: 'bookmarks', history: 'history' }[row[3]] || 'commands';
      if (mode !== 'review' && (demoScope === 'all' ? scope === 'notes' : scope !== demoScope)) continue;
      if (mode !== 'review' && demoScope === 'all' && !q && ['bookmarks', 'history'].includes(scope)) continue;
      if (q && !row.join(' ').toLowerCase().includes(q)) continue;
      if (!added && section) { out.push(section); added = true; } out.push(row);
    }
    return out;
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
    palette.dataset.demoState = mode === 'review' ? reviewStep : mode;
    demoControls.hidden = mode !== 'review'; demoControls.replaceChildren();
    query.disabled = mode === 'review' && reviewStep !== 'inspect';
    if (mode === 'review') {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'demo-batch-action';
      button.id = reviewStep === 'inspect' ? 'demo-preview' : reviewStep === 'preview' ? 'demo-confirm' : 'demo-reset';
      button.textContent = reviewStep === 'inspect' ? (lang() === 'ru' ? 'Показать 2 копии →' : 'Preview 2 copies →') :
        reviewStep === 'preview' ? (lang() === 'ru' ? 'Подтвердить закрытие 2 демо-вкладок' : 'Confirm close 2 demo tabs') :
        (lang() === 'ru' ? 'Сбросить демо' : 'Reset demo');
      button.addEventListener('click', () => {
        reviewStep = reviewStep === 'inspect' ? 'preview' : reviewStep === 'preview' ? 'receipt' : 'inspect';
        query.value = ''; selected = 0; draw();
        demoText.textContent = reviewStep === 'receipt' ? (lang() === 'ru' ? '2 закрыто · 3 осталось · пины и закладки защищены. Всё синтетическое.' : '2 closed · 3 stays · pinned and bookmarked tabs protected. Synthetic data only.') :
          reviewStep === 'preview' ? (lang() === 'ru' ? 'Проверь 5 демо-вкладок. Закроются только 2 указанные копии.' : 'Review all 5 demo tabs. Only the 2 listed copies will close.') : T[lang()].review;
      });
      demoControls.append(button);
      if (reviewStep === 'preview') {
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'demo-batch-action';
        cancel.textContent = lang() === 'ru' ? 'Отмена' : 'Cancel';
        cancel.addEventListener('click', () => { reviewStep = 'inspect'; draw(); say('review'); }); demoControls.append(cancel);
      }
    }
    document.getElementById('primaryAction').textContent = mode === 'review' ? (reviewStep === 'receipt' ? 'receipt' : 'inspect') : 'open';
  }
  function togglePalette(open = true) {
    palette.classList.toggle('closed', !open); actionMenu.classList.remove('on');
    if (open) { setTimeout(() => query.focus({ preventScroll: true }), 180); say(mode === 'review' ? 'review' : 'palette'); }
  }
  function setMode(next) {
    mode = next; selected = 0; query.value = ''; reviewStep = 'inspect';
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
    demoScope = button.textContent.trim(); query.value = ''; selected = 0; draw();
  }));
  query.addEventListener('input', () => { selected = 0; draw(); });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.metaKey && event.shiftKey && key === 'k') { event.preventDefault(); setMode('palette'); return; }
    if (event.metaKey && !event.shiftKey && !event.altKey && key === 'd' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); setMode('keep'); return; }
    if (event.metaKey && !event.shiftKey && key === 'k' && !palette.classList.contains('closed')) { event.preventDefault(); actionMenu.classList.toggle('on'); say(actionMenu.classList.contains('on') ? 'actionsOn' : 'actionsOff'); return; }
    if (event.key === 'Escape') { togglePalette(false); return; }
    if (!palette.classList.contains('closed') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); const count = rowsForMode().filter(row => row.length > 1).length; if (!count) return; selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + count) % count; draw();
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
