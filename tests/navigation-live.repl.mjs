// Run with: aside repl "$(< tests/navigation-live.repl.mjs)"
// Start scripts/preview.mjs on port 8927 first.
// Creates only a task window and task bookmark folder. Existing browser data is read-only.
const navControl = await openTab('chrome-extension://biahbgkjdbjnidodbpekgoigldpmpjpg/panel.html');
console.log((await snapshot(navControl, { interactive: true, selector: 'header' })).tree);
let navFixture;
try {
  navFixture = await navControl.evaluate(async () => {
    const prefs = await chrome.storage.local.get(['panelGrouping', 'panelHistory', 'panelCollapsed']);
    const theme = (await chrome.storage.sync.get('theme')).theme;
    const before = (await chrome.tabs.query({})).length;
    const urls = ['pin', 'saved', 'work'].map(n => 'http://127.0.0.1:8927/aside-tweaks/preview.html?navqa=' + n);
    let win, folder;
    try {
    win = await chrome.windows.create({ url: urls, focused: false });
    folder = await chrome.bookmarks.create({ parentId: '1', title: 'Aside navigation QA' });
    for (let i = 0; i < 20; i++) await chrome.bookmarks.create({ parentId: folder.id, title: 'QA reference ' + i, url: 'https://example.test/navqa/' + i });
    const mark = await chrome.bookmarks.create({ parentId: folder.id, title: 'QA saved active page', url: urls[1] });
    const all = await chrome.tabs.query({ windowId: win.id });
    const pin = all.find(t => t.url === urls[0]);
    const saved = all.find(t => t.url === urls[1]);
    const work = all.find(t => t.url === urls[2]);
    await chrome.tabs.update(pin.id, { pinned: true });
    await chrome.tabs.update(saved.id, { active: true });
    const group = await chrome.tabs.group({ tabIds: [work.id], createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(group, { title: 'QA work group' });
    return { winId: win.id, folderId: folder.id, markId: mark.id, savedId: saved.id, workId: work.id, prefs, theme, before };
    } catch (error) {
      if (folder) await chrome.bookmarks.removeTree(folder.id).catch(() => {});
      if (win) await chrome.windows.remove(win.id).catch(() => {});
      throw error;
    }
  });
  const navPanel = await openTab('chrome-extension://biahbgkjdbjnidodbpekgoigldpmpjpg/panel.html?win=' + navFixture.winId);
  console.log((await snapshot(navPanel, { interactive: true, selector: '.nav-tools' })).tree);
  await navPanel.locator('#favs [aria-current="page"]').waitFor();
  const initial = await navPanel.evaluate(() => ({
    apiTabs: navigation.all.map(t => ({ id: t.id, url: t.url, pinned: t.pinned, groupId: t.groupId })),
    activeSaved: document.querySelector('#favs [aria-current="page"]')?.getAttribute('aria-label'),
    pinSquares: document.querySelectorAll('.pin-square').length,
    tabRows: document.querySelectorAll('#tabs .row').length,
    historyClosed: !document.getElementById('history-drawer').open,
    folderRows: [...document.querySelectorAll('#favs .nav-group')].find(g => g.textContent.includes('Aside navigation QA'))?.querySelectorAll('.row').length
  }));
  if (initial.activeSaved !== 'QA saved active page' || initial.pinSquares !== 1 || initial.tabRows !== 1 || initial.folderRows !== 21) throw Error('initial navigation: ' + JSON.stringify(initial));
  console.log('PASS live native-shaped navigation', initial);
  await navPanel.locator('#panel-search').fill('QA saved');
  console.log((await snapshot(navPanel, { interactive: true, selector: 'main' })).diff);
  if (await navPanel.locator('#favs .row').count() !== 1) throw Error('filter did not narrow saved rows');
  await navPanel.locator('#show-active').click();
  console.log((await snapshot(navPanel, { interactive: true, selector: '.nav-tools' })).diff);
  await navPanel.evaluate(() => {
    document.querySelector('main').scrollTop = 0;
    window.dispatchEvent(new Event('focus'));
  });
  await sleep(200); // focus handler deliberately coalesces updates for 70ms
  const focus = await navPanel.evaluate(() => {
    const row = document.querySelector('[aria-current="page"]').getBoundingClientRect();
    const main = document.querySelector('main').getBoundingClientRect();
    return row.top >= main.top && row.bottom <= main.bottom;
  });
  if (!focus) throw Error('active bookmark remained outside the panel viewport');
  console.log('PASS live focus reveal within main viewport');
  await navPanel.locator('#tabs .nav-group summary').click();
  console.log((await snapshot(navPanel, { interactive: true, selector: '#tabs' })).diff);
  await navPanel.evaluate(async id => {
    await chrome.tabs.update(id, { active: true });
    await chrome.tabs.update(id, { muted: false }); // adjacent update must not cancel activation reveal
  }, navFixture.workId);
  await navPanel.locator('#tabs [aria-current="page"]').waitFor();
  await sleep(150);
  const groupReveal = await navPanel.evaluate(() => {
    const row = document.querySelector('#tabs [aria-current="page"]');
    const box = row.getBoundingClientRect(), view = document.querySelector('main').getBoundingClientRect();
    return row.closest('details').open && box.top >= view.top && box.bottom <= view.bottom;
  });
  if (!groupReveal) throw Error('activation did not reveal the closed group');
  console.log('PASS native group opens and reveals active row despite adjacent update');
  await navPanel.locator('#panel-grouping').selectOption('sites');
  console.log((await snapshot(navPanel, { interactive: true, selector: '#tabs' })).diff);
  await navPanel.evaluate(() => { document.body.style.width = '420px'; });
  await fs.mkdir('./artifacts', { recursive: true });
  await fs.writeFile('./artifacts/aside-panel-light.png', await navPanel.screenshot({ clip: { x: 0, y: 0, width: 420, height: 760 } }));
  await navPanel.evaluate(async () => {
    const { theme = {} } = await chrome.storage.sync.get('theme');
    await chrome.storage.sync.set({ theme: { ...theme, mode: 'dark' } });
  });
  console.log((await snapshot(navPanel, { interactive: true, selector: '.nav-tools' })).diff);
  await fs.writeFile('./artifacts/aside-panel-dark.png', await navPanel.screenshot({ clip: { x: 0, y: 0, width: 420, height: 760 } }));
  console.log('screenshots ./artifacts/aside-panel-light.png and aside-panel-dark.png');
} finally {
  if (navFixture) {
    await navControl.evaluate(async f => {
      await chrome.tabs.remove(f.workId).catch(() => {});
      await chrome.windows.remove(f.winId).catch(() => {});
      await chrome.bookmarks.removeTree(f.folderId).catch(() => {});
      await chrome.storage.local.remove(['panelGrouping', 'panelHistory', 'panelCollapsed']);
      await chrome.storage.local.set(f.prefs);
      if (f.theme) await chrome.storage.sync.set({ theme: f.theme });
      else await chrome.storage.sync.remove('theme');
      return true;
    }, navFixture);
    console.log('cleanup: task window/folder removed, display settings restored');
  }
}
