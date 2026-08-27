const LABELS = {
  tidyDuplicates: n => n ? `closed ${n}` : 'nothing to clean',
  pinTab: n => n === 1 ? 'pinned ↑ · squares on top' : 'unpinned',
  favoriteTab: n => n === 1 ? 'bookmarked ★ · folded into the bar row' : 'back in the tabs, at the top',
  bookmarkTab: n => n === 1 ? 'bookmarked ✓' : 'bookmark removed',
  groupByRules: n => n ? `${n} groups` : 'nothing to group',
  groupByDomain: n => n ? `${n} groups` : 'nothing to group',
  ungroupAll: n => n ? `${n} ungrouped` : 'no groups',
  sortByDomain: n => `${n} ordered by site`,
  sortByOpened: n => `${n} ordered by open time`,
  tidyUp: () => 'tidied up ✓',
  openPalette: () => 'palette opened'
};

// версия берётся из манифеста: подписанная руками разъезжается с установленной
document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

const status = document.getElementById('status');
const say = t => { status.textContent = t; };

async function refreshStats() {
  // service worker может спать — первый вызов его будит, второй уже отвечает
  let res = await chrome.runtime.sendMessage({ action: 'getStats' }).catch(() => null);
  if (!res?.ok) res = await chrome.runtime.sendMessage({ action: 'getStats' }).catch(() => null);
  if (!res?.ok) { document.getElementById('statsub').textContent = 'service worker asleep · press again'; return; }
  if (res?.ok && res.data) {
    const { total, dups, pinned, empties = 0 } = res.data;
    document.getElementById('stats').textContent = `${total} tabs`;
    document.getElementById('statsub').textContent =
      `${dups} duplicate${dups === 1 ? '' : 's'} · ${empties} empty · ${pinned} pinned`;
  }
}

// открыть панель можно только по жесту пользователя — клик в попапе им и является
document.getElementById('openPanel').addEventListener('click', async () => {
  const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  try {
    await chrome.sidePanel.open(w ? { windowId: w.id } : {});
    window.close();
  } catch (e) {
    say('failed: ' + String(e).slice(0, 40));
  }
});

document.querySelectorAll('button[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    say('...');
    const res = await chrome.runtime.sendMessage({ action: btn.dataset.action });
    const label = LABELS[btn.dataset.action];
    say(res?.ok ? (label ? label(res.count) : 'done') : 'error: ' + (res?.error || '?'));
    refreshStats();
  });
});

refreshStats();
