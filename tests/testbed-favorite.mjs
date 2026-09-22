// ⌘D и ⇧⌘D в настоящем браузере.
//
// sw-smoke гоняет background.js против подставного chrome и отвечает на вопрос
// «что делает код». Этот сценарий поднимает расширение в отдельном Aside со своим
// профилем и отвечает на другой вопрос – «что после команды видно в окне»:
// где встала строка закладки, куда уехала вкладка и осталась ли она выбранной.
//
//   scripts/testbed.sh up
//   node tests/testbed-favorite.mjs
//
// Порт стенда – ASIDE_TESTBED_PORT, по умолчанию 9333.

import http from 'node:http';
import { browserSocket, extensionSession, evalInWorker } from './cdp.mjs';

// порт берём свободный: у человека на соседних портах живёт превью сайта
let PORT = Number(process.env.ASIDE_TESTBED_PAGES || 0);
const PAGES = { '/one': 'page one', '/two': 'page two', '/three': 'page three' };

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' · ' + detail : ''));
  if (!ok) fails++;
};
const wait = ms => new Promise(r => setTimeout(r, ms));

// Свои страницы вместо внешних адресов: стенд не должен зависеть от сети,
// а у вкладки должен быть настоящий http-адрес – ⌘D отказывается от прочих схем.
const pages = http.createServer((req, res) => {
  const title = PAGES[req.url] || 'page';
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>' + title + '</title><h1>' + title + '</h1>');
});
await new Promise(ok => pages.listen(PORT, '127.0.0.1', ok));
PORT = pages.address().port;
const url = path => 'http://127.0.0.1:' + PORT + path;

const cdp = await browserSocket();
const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
// свежий код в окне обеспечивает `scripts/testbed.sh up`: он стирает кэш воркера
const { sessionId, extensionId } = await extensionSession(cdp, { repo });
const version = await evalInWorker(cdp, sessionId, 'return chrome.runtime.getManifest().version;');
console.log('стенд · расширение ' + extensionId + ' · версия ' + version + ' · страницы на ' + PORT);

const worker = code => evalInWorker(cdp, sessionId, code);

// ---------- подготовка чистого окна ----------

// Сцена живёт в собственном окне. Чужие окна стенда – приветственную страницу
// встроенного расширения Aside – не трогаем: на свежем профиле её закрытие уносило
// за собой и наше окно, а сценарий и так смотрит только в своё.
const wid = await worker(`
  const win = await chrome.windows.create({ url: ${JSON.stringify([url('/one'), url('/two'), url('/three')])}, focused: true });
  const kids = await chrome.bookmarks.getChildren('1').catch(() => []);
  for (const k of kids) await chrome.bookmarks.remove(k.id).catch(() => chrome.bookmarks.removeTree(k.id).catch(() => {}));
  // три готовые строки: на пустой панели «наверх» и «в конец» неразличимы
  for (const t of ['alpha', 'beta', 'gamma']) await chrome.bookmarks.create({ parentId: '1', title: t, url: 'https://example.com/' + t });
  return win.id;
`);
// сторож размещения досылает свежие вкладки на место до placementGuardMs –
// снимок раньше этого показывает не результат команды, а работу сторожа
await wait(4500);

const snapshot = async () => worker(`
  const tabs = await chrome.tabs.query({ windowId: ${wid} });
  const bar = await chrome.bookmarks.getChildren('1').catch(() => []);
  return {
    tabs: tabs.sort((a, b) => a.index - b.index).map(t => ({ id: t.id, i: t.index, url: t.url, active: t.active, pinned: t.pinned, group: t.groupId })),
    bar: bar.map(b => ({ i: b.index, title: b.title, url: b.url }))
  };
`);

const show = s => s.tabs.map(t => (t.active ? '▶' : ' ') + t.i + (t.pinned ? '📌' : '') + ' ' + (t.url || '').replace('http://127.0.0.1:' + PORT, '')).join(' | ')
  + '   bar: [' + s.bar.map(b => b.i + ':' + b.title).join(', ') + ']';

const act = async (action, ...args) => {
  const out = await worker(`return await ACTIONS.${action}(${[wid, ...args].join(', ')});`);
  await wait(500);
  return out;
};

// ---------- сценарий ----------

// берём последнюю вкладку окна: жалоба ровно про неё – «фокус остаётся внизу»
await worker(`
  const tabs = await chrome.tabs.query({ windowId: ${wid} });
  if (!tabs.length) throw new Error('сцена пуста: окно ${wid} закрылось');
  const mid = tabs.sort((a, b) => a.index - b.index).at(-1);
  await chrome.tabs.update(mid.id, { active: true });
`);
await wait(300);

const before = await snapshot();
console.log('до   ⌘D · ' + show(before));
const live = before.tabs.find(t => t.active);

await act('favoriteTab');
const after = await snapshot();
console.log('после ⌘D · ' + show(after));

const row = after.bar.find(b => b.url === live.url);
const same = after.tabs.find(t => t.id === live.id);

check('⌘D пишет строку в панель закладок', !!row, row ? row.title : 'строки нет');
check('строка встаёт наверх панели закладок', row?.i === 0, 'index ' + row?.i);
check('вкладка остаётся открытой', !!same);
check('вкладка остаётся выбранной', !!same?.active);
check('вкладка закреплена – в сайдбаре это квадратик наверху', same?.pinned === true);
check('закреплённая вкладка стоит первой', same?.i === 0, 'index ' + same?.i);
check('копии вкладки не появилось', after.tabs.filter(t => t.url === live.url).length === 1,
  after.tabs.filter(t => t.url === live.url).length + ' вкладок с этим адресом');

// второй ⌘D – строка уходит, вкладка остаётся
await act('favoriteTab');
const back = await snapshot();
console.log('второй ⌘D · ' + show(back));
check('второй ⌘D убирает строку', !back.bar.some(b => b.url === live.url));
check('второй ⌘D снимает и закрепление', back.tabs.find(t => t.id === live.id)?.pinned === false);
check('второй ⌘D оставляет вкладку выбранной', !!back.tabs.find(t => t.id === live.id)?.active);

// ⇧⌘D – эталон поведения, с которым сравнивают ⌘D
await act('pinTab');
const pinned = await snapshot();
console.log('после ⇧⌘D · ' + show(pinned));
const ptab = pinned.tabs.find(t => t.id === live.id);
check('⇧⌘D закрепляет вкладку', !!ptab?.pinned);
check('⇧⌘D ставит её наверх', ptab?.i === 0, 'index ' + ptab?.i);
check('⇧⌘D оставляет фокус на ней', !!ptab?.active);
await act('pinTab');

pages.close();
cdp.close();
console.log(fails ? '\n' + fails + ' FAIL' : '\nвсё сошлось');
process.exit(fails ? 1 : 0);
