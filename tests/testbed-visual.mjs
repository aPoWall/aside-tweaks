// Снимок сайдбара стенда – единственный способ увидеть то, чего не видит API.
//
// chrome.tabs и chrome.bookmarks отвечают, где лежат вкладка и строка. Они не отвечают
// на главный вопрос жалобы: показывает ли сайдбар Aside одну строку или две – вплавил ли
// он открытую вкладку в строку закладки с тем же адресом. Это видно только глазами.
//
//   scripts/testbed.sh down && scripts/testbed.sh up --visible
//   node tests/testbed-visual.mjs                 → /tmp/aside-testbed-<шаг>.png
//
// Снимок делает Hammerspoon: у него есть разрешение на запись экрана, и он снимает
// конкретное окно, а не весь экран – чужие окна в кадр не попадают.

import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { browserSocket, extensionSession, evalInWorker } from './cdp.mjs';

const run = promisify(execFile);
const HS = process.env.HS_BIN || '/opt/homebrew/bin/hs';
const MARK = 'aside testbed';     // по заголовку находим своё окно среди чужих

const pages = http.createServer((req, res) => {
  const name = (req.url || '/').replace('/', '') || 'page';
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>' + MARK + ' · ' + name + '</title><h1>' + name + '</h1>');
});
await new Promise(ok => pages.listen(0, '127.0.0.1', ok));
const url = p => 'http://127.0.0.1:' + pages.address().port + '/' + p;

const cdp = await browserSocket();
const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { sessionId } = await extensionSession(cdp, { repo });
const worker = code => evalInWorker(cdp, sessionId, code);
const wait = ms => new Promise(r => setTimeout(r, ms));

const shot = async step => {
  const out = '/tmp/aside-testbed-' + step + '.png';
  // w:snapshot() на этой macOS отдаёт nil, поэтому снимаем область экрана под окном.
  // Значит, окно должно быть на текущем рабочем столе и поверх: переносим, поднимаем,
  // снимаем и сразу возвращаем фокус тому окну, которое его держало.
  const lua = `
    local prev = hs.window.focusedWindow()
    for _, w in ipairs(hs.window.allWindows()) do
      if (w:title() or ''):find('${MARK}', 1, true) then
        pcall(function() hs.spaces.moveWindowToSpace(w, hs.spaces.focusedSpace()) end)
        w:raise(); w:focus()
        hs.timer.usleep(800000)
        local f = w:frame()
        local img = w:screen():snapshot(hs.geometry.rect(f.x, f.y, f.w, f.h))
        local ok = img and img:saveToFile('${out}')
        if prev then prev:focus() end
        return '${out} · ' .. tostring(ok) .. ' · ' .. w:title()
      end
    end
    return 'окно стенда не найдено – поднят ли он с --visible?'`;
  const { stdout } = await run(HS, ['-c', lua]);
  console.log(step + ' → ' + stdout.trim().split('\n').pop());
};

// Сцена живёт в собственном окне. Чужие окна стенда – приветственную страницу
// встроенного расширения Aside – не трогаем: на свежем профиле её закрытие уносило
// за собой и наше окно, а сценарий и так смотрит только в своё.
const wid = await worker(`
  const win = await chrome.windows.create({ url: ${JSON.stringify([url('one'), url('two'), url('three')])}, focused: true });
  const kids = await chrome.bookmarks.getChildren('1').catch(() => []);
  for (const k of kids) await chrome.bookmarks.remove(k.id).catch(() => chrome.bookmarks.removeTree(k.id).catch(() => {}));
  // три готовые строки: на пустой панели «наверх» и «в конец» неразличимы
  // разные места хранения с говорящими именами: по снимку видно, какое из них
  // рисуется квадратиками наверху сайдбара, а какое – строками ниже
  for (const t of ['BAR ONE', 'BAR TWO', 'BAR THREE']) await chrome.bookmarks.create({ parentId: '1', title: t, url: 'https://example.com/' + t });
  const folder = await chrome.bookmarks.create({ parentId: '1', title: 'FOLDER' });
  await chrome.bookmarks.create({ parentId: folder.id, title: 'IN FOLDER', url: 'https://example.com/in-folder' });
  await chrome.bookmarks.create({ parentId: '2', title: 'OTHER ONE', url: 'https://example.com/other' });
  return win.id;
`);
await wait(5000);   // ждём сторожа размещения, иначе в кадре его работа, а не результат команды

await worker(`
  const tabs = await chrome.tabs.query({ windowId: ${wid} });
  await chrome.tabs.update(tabs.sort((a, b) => a.index - b.index).at(-1).id, { active: true });
`);
await wait(600);
await shot('before');

await worker(`return await ACTIONS.favoriteTab(${wid});`);
await wait(1200);
await shot('after');

pages.close();
cdp.close();
