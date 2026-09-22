// Маленький клиент DevTools Protocol для стенда.
//
// Сценарии стенда говорят с расширением через его собственный service worker:
// так проверяется настоящий background.js в настоящем браузере, а не подставной
// chrome из sw-smoke. Зависимостей нет – WebSocket в node уже встроен.

import { createHash } from 'node:crypto';

const PORT = process.env.ASIDE_TESTBED_PORT || 9333;
const HOST = 'http://127.0.0.1:' + PORT;

export async function browserSocket() {
  const version = await fetch(HOST + '/json/version').then(r => r.json());
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('cdp: нет сокета браузера')); });

  let id = 0;
  const waiting = new Map();
  const events = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, no } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) events.push(msg);
  };

  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const mid = ++id;
    waiting.set(mid, { ok, no });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => waiting.has(mid) && (waiting.delete(mid), no(new Error('cdp: ' + method + ' не ответил'))), 20000);
  });

  return { ws, send, events, close: () => ws.close() };
}

// Идентификатор распакованного расширения Chromium считает от пути к папке:
// sha-256 пути, первые 16 байт, каждая шестнадцатеричная цифра сдвинута в a…p.
// Это даёт адрес страницы расширения ещё до того, как его воркер проснулся.
export function unpackedId(dir) {
  const hex = createHash('sha256').update(dir, 'utf8').digest('hex').slice(0, 32);
  return [...hex].map(c => 'abcdefghijklmnop'[parseInt(c, 16)]).join('');
}

// Цель расширения: service worker живёт по адресу chrome-extension://<id>/background.js.
//
// Две ловушки. Воркер засыпает – и пропадает из списка целей, поэтому сначала
// открываем страницу расширения, она его будит. У самого Aside есть встроенные
// расширения с тем же именем файла, поэтому цель подтверждаем именем из манифеста.
export async function extensionSession(cdp, { wait = 20000, name = 'Aside Tweaks', repo } = {}) {
  const until = Date.now() + wait;
  const id = repo ? unpackedId(repo) : null;
  let waker = null, wokeAt = 0;
  // после chrome.runtime.reload() прежняя страница расширения умирает вместе с ним,
  // поэтому будильник не одноразовый: если воркер не поднялся, открываем страницу заново
  const wake = async () => {
    if (!id) return;
    if (waker) await cdp.send('Target.closeTarget', { targetId: waker }).catch(() => { });
    waker = await cdp.send('Target.createTarget', { url: 'chrome-extension://' + id + '/options.html' })
      .then(r => r.targetId, () => null);
    wokeAt = Date.now();
  };
  await wake();
  // Будильник может оказаться единственной вкладкой окна – закрыть его значит закрыть
  // окно, и следом браузер отвечает «No current window». Поэтому сначала подстилаем пустую.
  const done = async out => {
    if (!waker) return out;
    const { targetInfos } = await cdp.send('Target.getTargets').catch(() => ({ targetInfos: [] }));
    if (targetInfos.filter(t => t.type === 'page').length < 2) {
      await cdp.send('Target.createTarget', { url: 'about:blank' }).catch(() => { });
    }
    await cdp.send('Target.closeTarget', { targetId: waker }).catch(() => { });
    return out;
  };
  for (;;) {
    if (id && Date.now() - wokeAt > 3000) await wake();
    const { targetInfos } = await cdp.send('Target.getTargets');
    const workers = targetInfos.filter(t => t.type === 'service_worker' && /^chrome-extension:\/\/\w+\/background\.js/.test(t.url));
    for (const sw of workers) {
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true });
      await cdp.send('Runtime.enable', {}, sessionId);
      const mine = await cdp.send('Runtime.evaluate', {
        expression: 'chrome.runtime.getManifest().name', returnByValue: true
      }, sessionId).then(r => r.result?.value, () => null);
      if (mine === name) return done({ sessionId, extensionId: new URL(sw.url).host });
      await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => { });
    }
    if (Date.now() > until) { await done(); throw new Error('cdp: service worker «' + name + '» не найден – стенд поднят с --load-extension?'); }
    await new Promise(r => setTimeout(r, 300));
  }
}

// Код исполняется внутри service worker расширения: chrome.* доступен целиком.
export async function evalInWorker(cdp, sessionId, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression: '(async () => { ' + expression + ' })()',
    awaitPromise: true, returnByValue: true
  }, sessionId);
  if (res.exceptionDetails) throw new Error('worker: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
  return res.result.value;
}
