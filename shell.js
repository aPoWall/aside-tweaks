// Aside Tweaks – общая оболочка на веб-поверхностях (правила 21, 22, 32, 39, 40).
//
// Знак продукта приходит из vendor/aim-app-mark.js и рисуется тем же спрайтом
// vendor/aim-app-marks.svg, из которого собраны иконки расширения: кнопка в тулбаре
// и знак в шапке – одна картинка из одного источника, а не две похожие.
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

(() => {
  for (const el of document.querySelectorAll('[data-aim-version]')) el.textContent = SHELL_VERSION;

  AIMAppMark.install(chrome.runtime.getURL('vendor/aim-app-marks.svg'))
    .then(ok => { if (ok) AIMAppMark.upgrade(document); });

  const settings = document.getElementById('settings');
  if (settings) settings.addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
