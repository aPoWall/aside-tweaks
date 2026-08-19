// Aside Tweaks — предложение по группировке.
//
// Окно показывает, ЧТО именно произойдёт, до того как что-то произошло.
// Модель ошибается, и молча переставленные полсотни вкладок — плохая цена
// за её ошибку. Поэтому применяет человек, одной кнопкой.

const listEl = document.getElementById('list');
const subEl = document.getElementById('sub');
const leftEl = document.getElementById('left');

const COLORS = ['#3b6fd4', '#1f9aa8', '#3f8f4f', '#b08a1e', '#c2671f', '#b6437f', '#7a4bb5', '#7b7b76'];

function render(plan) {
  listEl.replaceChildren();

  if (!plan?.groups?.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = 'nothing to apply — the proposal expired, run the command again';
    listEl.append(d);
    document.getElementById('apply').disabled = true;
    return;
  }

  subEl.textContent = `${plan.groups.length} blocks · ${plan.model}`;

  plan.groups.forEach((g, i) => {
    const box = document.createElement('div');
    box.className = 'grp';

    const name = document.createElement('div');
    name.className = 'name';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = COLORS[i % COLORS.length];
    const label = document.createElement('span');
    label.className = 'lbl';
    label.textContent = g.name;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = g.ids.length + ' tabs';
    name.append(dot, label, n);

    const ul = document.createElement('ul');
    for (const t of g.titles) {
      const li = document.createElement('li');
      li.textContent = t;
      li.title = t;
      ul.append(li);
    }

    box.append(name, ul);
    listEl.append(box);
  });

  leftEl.textContent = plan.left
    ? `${plan.left} tabs stay outside the blocks`
    : 'every tab found a block';
}

chrome.storage.session.get({ sensePlan: null }).then(s => render(s.sensePlan));

document.getElementById('apply').addEventListener('click', async () => {
  const btn = document.getElementById('apply');
  btn.disabled = true;
  btn.textContent = 'applying…';
  await chrome.runtime.sendMessage({ action: 'senseApply' }).catch(() => { });
  window.close();
});

document.getElementById('cancel').addEventListener('click', async () => {
  await chrome.storage.session.remove('sensePlan').catch(() => { });
  window.close();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.close();
  if (e.key === 'Enter') document.getElementById('apply').click();
});
