// Aside Tweaks – общая оболочка на веб-поверхностях (правила 21, 22, 32, 39, 40, 45, 46).
//
// Знак продукта приходит из vendor/aim-app-mark.js и рисуется тем же спрайтом
// vendor/aim-app-marks.svg, из которого собраны иконки расширения: кнопка в тулбаре
// и знак в шапке – одна картинка из одного источника, а не две похожие.
//
// Правило 46 (волна 17.09): в шапке поверхности стоит воксельный персонаж 40 px, а плоский
// знак остаётся кнопке расширения, странице настроек и фавиконам. Персонаж собирается
// из vendor/aim-voxel-models.json через vendor/aim-voxel.js; пока модель не пришла, в слоте
// стоит плоский знак – он же остаётся, если скрипт или файл модели недоступны.
// Файл подключают popup, panel и palette; каждая поверхность объявляет только своё тело.

// версия берётся из манифеста: подписанная руками разъезжается с установленной
const SHELL_VERSION = chrome.runtime.getManifest().version;

// нижняя строка: слева ответ поверхности, который сам возвращается к своей подписи
function say(text) {
  const el = document.getElementById('status');
  if (!el) return;
  if (!el.dataset.base) el.dataset.base = el.textContent;
  el.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { el.textContent = el.dataset.base; }, 2600);
}

// воксельный персонаж в шапке: статичный первый кадр, сборка 700 мс, жест по клику.
// reduced motion разбирает библиотека: сборка не запускается, остаётся один жест.
function installVoxel() {
  const slots = [...document.querySelectorAll('[data-aim-voxel]')];
  if (!slots.length || !window.AIMVoxel) return Promise.resolve(false);
  return fetch(chrome.runtime.getURL('vendor/aim-voxel-models.json'))
    .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
    .then(doc => {
      for (const slot of slots) {
        const model = doc.models?.[slot.dataset.aimVoxel];
        if (!model) continue;
        slot.classList.add('has-voxel');
        slot.removeAttribute('data-aim-mark');   // плоский знак уходит из слота, когда персонаж собран
        AIMVoxel.render(slot, model, { unit: 10, animate: 'assemble', whenVisible: false, interactive: true });
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('role', 'img');
      }
      return true;
    })
    .catch(() => false);
}

(() => {
  for (const el of document.querySelectorAll('[data-aim-version]')) el.textContent = SHELL_VERSION;

  AIMAppMark.install(chrome.runtime.getURL('vendor/aim-app-marks.svg'))
    .then(ok => { if (ok) AIMAppMark.upgrade(document); })
    .then(() => installVoxel());

  // Правило 49: подвал называет свою комбинацию. Регистрирует её браузер, поэтому строка
  // берёт то, что браузер действительно отдал, а не то, что предложил манифест.
  const keySlots = [...document.querySelectorAll('[data-aim-key]')];
  if (keySlots.length && chrome.commands?.getAll) {
    chrome.commands.getAll().then(list => {
      for (const slot of keySlots) {
        const own = list.find(c => c.name === slot.dataset.aimKey);
        slot.textContent = own?.shortcut || 'no key';
      }
    }).catch(() => { });
  }

  const settings = document.getElementById('settings');
  if (settings) settings.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Правило 45 в браузерном прочтении: у поверхности есть одна комбинация открытия и закрытия.
  // Открывает её браузер, закрывает сама поверхность – окно попапа или документ боковой панели.
  const surface = document.body.dataset.aimSurface;
  if (surface) {
    let port = null;
    try { port = chrome.runtime.connect({ name: surface }); } catch { }
    if (port) port.onMessage.addListener(msg => { if (msg?.close) window.close(); });
    addEventListener('keydown', e => {
      // своя комбинация закрывает поверхность изнутри: и та, что зарегистрировал браузер,
      // и семейная ⌥⌘A, которую браузер расширению не отдаёт
      if (e.altKey && !e.ctrlKey && (e.shiftKey || e.metaKey) && e.code === 'KeyA') { e.preventDefault(); window.close(); }
    });
  }
})();
