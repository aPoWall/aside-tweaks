// Aside Tweaks — живой знак продукта в шапке панели и попапа.
// Персонаж aside из общего экспорта AI Mindset apps (vendor/aim-voxel.js + vendor/aim-voxel-aside.json,
// байт-в-байт с sites/apps/assets). Наведение даёт параллакс по глубине, клик или Enter/Space
// рассыпает и собирает фигуру и переносит красный курсор на соседнюю клетку; reduced motion — только курсор.
(() => {
  const stage = document.querySelector('[data-aim-mark]');
  if (!stage || !window.AIMVoxel) return;
  const src = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('vendor/aim-voxel-aside.json')
    : 'vendor/aim-voxel-aside.json';
  fetch(src).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then(model => {
    AIMVoxel.render(stage, model, { unit: 10, interactive: true, duration: 1600, label: 'aside tweaks' });
    stage.classList.add('is-rendered');
  }).catch(() => { stage.hidden = true; });
})();
