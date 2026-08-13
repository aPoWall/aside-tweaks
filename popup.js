const LABELS = {
  tidyDuplicates: n => n ? `closed ${n}` : 'nothing to clean',
  pinTab: n => n === 1 ? 'pinned ↑ · squares on top' : 'unpinned',
  favoriteTab: n => n === 1 ? 'bookmarked ↑ · first row of the bar' : 'removed from the bar',
  bookmarkTab: n => n === 1 ? 'bookmarked ✓' : 'bookmark removed',
  groupByRules: n => n ? `${n} groups` : 'nothing to group',
  groupByDomain: n => n ? `${n} groups` : 'nothing to group',
  ungroupAll: n => n ? `${n} ungrouped` : 'no groups',
  sortByDomain: n => `${n} sorted`,
  openPalette: () => 'palette opened'
};

const status = document.getElementById('status');
const say = t => { status.textContent = t; };

async function refreshStats() {
  const res = await chrome.runtime.sendMessage({ action: 'getStats' });
  if (res?.ok && res.data) {
    const { total, dups, pinned } = res.data;
    document.getElementById('stats').textContent = `${total} tabs`;
    document.getElementById('statsub').textContent =
      `${dups} duplicate${dups === 1 ? '' : 's'} · ${pinned} pinned`;
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
