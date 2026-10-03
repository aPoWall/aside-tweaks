// Shared deterministic navigation model. No browser mutations.
(() => {
  const key = url => { try { return new URL(url).href; } catch { return url || ''; } };
  function leaves(nodes) {
    return nodes.flatMap(node => node.url ? [node] : leaves(node.children || []));
  }
  function partition(tabs, bookmarks) {
    const saved = new Map();
    const ordered = [...tabs].sort((a, b) => Number(b.active) - Number(a.active) || a.index - b.index);
    const claimed = new Set();
    for (const mark of leaves(bookmarks)) {
      const tab = ordered.find(t => !t.pinned && !claimed.has(t.id) && key(t.url) === key(mark.url));
      if (tab) { saved.set(mark.id, tab); claimed.add(tab.id); }
    }
    const represented = new Set([...saved.values()].map(t => t.id));
    return {
      saved,
      pins: tabs.filter(t => t.pinned).sort((a, b) => a.index - b.index),
      tabs: tabs.filter(t => !t.pinned && !represented.has(t.id)).sort((a, b) => a.index - b.index)
    };
  }
  function matches(item, query) {
    const hay = `${item.title || ''} ${item.url || ''}`.toLowerCase();
    return query.trim().toLowerCase().split(/\s+/).every(word => hay.includes(word));
  }
  globalThis.AsideNavigation = { key, leaves, partition, matches };
})();
