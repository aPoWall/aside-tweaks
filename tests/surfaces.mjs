// Проверка согласованности поверхностей.
//
// Жалоба, из которой вырос этот файл: «команда очистки дублей есть в палитре,
// а в боковой панели её нет». Пока каждый список жил своей жизнью, такое
// расхождение было делом одного коммита.

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { TWEAK_COMMANDS, commandsFor } = require('../commands.js');

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' · ' + detail : ''));
  if (!ok) fails++;
};

const bg = read('background.js');
const popup = read('popup.html');
const panel = read('panel.js');
const palette = read('palette.js');

// каждое действие обязано существовать в service worker'е
const known = (bg.match(/const ACTIONS = \{([\s\S]*?)\};/) || [])[1] || '';
const unknown = TWEAK_COMMANDS.filter(c => !known.includes(c.action));
check('каждая команда есть в ACTIONS', unknown.length === 0, unknown.map(c => c.action).join(', '));

// попап тоже рендерит из общего списка – и у каждой его команды есть короткое имя и секция
const popupJs = read('popup.js');
check('попап рендерит из общего списка', popupJs.includes("commandsFor('popup')") && !popup.includes('data-action='));
const noShort = commandsFor('popup').filter(c => !c.short || !c.group);
check('у команд попапа есть short и group', noShort.length === 0, noShort.map(c => c.action).join(', '));

// панель и палитра рендерят из общего списка
check('панель рендерит из общего списка', panel.includes("commandsFor('panel')"));
check('палитра рендерит из общего списка', palette.includes("commandsFor('palette')"));
check('панель показывает хвост закладок, куда ⌘D дописывает свежую строку',
  panel.includes('allMarks.slice(Math.max(0, allMarks.length - 14))'));
check('панель держит компактную умную историю на сигналах палитры',
  panel.includes('const HISTORY_LIMIT = 6') && panel.includes('chrome.history.search') && panel.includes('twFrecency'));
check('панель перечитывает окно и возвращает активную строку после раскрытия',
  panel.includes("window.addEventListener('focus'") && panel.includes("window.addEventListener('pageshow'") &&
  panel.includes("document.addEventListener('visibilitychange'") && panel.includes("ev === 'onActivated'"));

// чистка дублей обязана быть на всех трёх поверхностях – это и была жалоба
const dedup = TWEAK_COMMANDS.find(c => c.action === 'tidyDuplicates');
check('чистка дублей есть в панели, палитре и попапе',
  ['panel', 'palette', 'popup'].every(s => dedup.on.includes(s)), dedup.on.join(' '));

// Чистка обязана быть достижимой с поверхности. Регрессия 4.20: applyDuplicateCleanup
// вызывалась только из applyTidyUp, а та не висела ни на клавише, ни на строке, и «чистка
// перестала работать» была не багом логики, а недостижимой функцией.
const reviewActions = (bg.match(/const REVIEW_ACTIONS = \{([\s\S]*?)\};/) || [])[1] || '';
check('чистка дублей достижима с поверхности',
  (known + reviewActions).includes('applyDuplicateCleanup') && palette.includes("send('applyDuplicateCleanup')"));

// и в фоне не остаётся функций, которых никто не зовёт – тот же класс поломки
const surfaceMaps = known + reviewActions +
  ((bg.match(/const NUMBERED = \{([\s\S]*?)\};/) || [])[1] || '') +
  ((bg.match(/const SIGNAL = \{([\s\S]*?)\};/) || [])[1] || '') +
  ((bg.match(/const DESK = \{([\s\S]*?)\};/) || [])[1] || '');
const orphans = [...bg.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\(/gm)]
  .map(m => m[1])
  .filter(name => !surfaceMaps.includes(name))
  .filter(name => (bg.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length < 2);
check('в фоне нет функций, которых никто не зовёт', orphans.length === 0, orphans.join(', '));

// ⌘-цифра живёт в трёх местах сразу: клавиша, фон, подсказка в палитре
const keys = read('keys.js');
check('⌘-цифра доходит от клавиши до блока',
  keys.includes("'putInBlock'") && keys.includes("'focusBlock'") && bg.includes('async function focusBlock') && palette.includes('listBlocks'));

// у каждой команды есть подпись и пояснение
const thin = TWEAK_COMMANDS.filter(c => !c.title || !c.sub || !c.hint || !c.words);
check('у каждой команды есть название, подпись, пояснение и слова для поиска',
  thin.length === 0, thin.map(c => c.action).join(', '));

// ---------- общая оболочка (правила 38, 39, 40) ----------

// Правило 38: у каждого контрола есть следствие. Претензия 16.09 – «часть элементов ничего
// не делает и не меняет вид при нажатии». Статическая кнопка поверхности обязана быть названной
// в её же скрипте или в общей оболочке; кнопка без обработчика проваливает проверку здесь.
const shell = read('shell.js');
const SURFACES = [
  { html: 'popup.html', js: ['popup.js'] },
  { html: 'panel.html', js: ['panel.js'] },
  { html: 'palette.html', js: ['palette.js'] }
];
const dead = [];
for (const s of SURFACES) {
  const markup = read(s.html);
  const code = s.js.map(read).join('\n') + shell;
  for (const tag of markup.match(/<button[^>]*>/g) || []) {
    const id = (tag.match(/id="([^"]+)"/) || [])[1];
    const data = (tag.match(/data-([a-z-]+)=/) || [])[1];
    const handle = id ? `'${id}'` : data ? `data-${data}` : null;
    const found = id ? code.includes(`'${id}'`) || code.includes(`"${id}"`)
      : data ? code.includes(data) : false;
    if (!found) dead.push(`${s.html} ${handle || tag}`);
  }
}
check('у каждой статической кнопки поверхности есть обработчик', dead.length === 0, dead.join(', '));

// Правило 40: шапка, подвал и знак приходят из общей оболочки, а не из копии в каждой поверхности
for (const s of SURFACES) {
  const markup = read(s.html);
  check(`${s.html} собран на общей оболочке`,
    markup.includes('vendor/aim-app-shell.css') && markup.includes('vendor/aim-app-mark.js') &&
    markup.includes('shell.js') && markup.includes('data-aim-mark="aside"'));
}
for (const part of ['aim-shell-head', 'aim-shell-foot', 'aim-shell-version', 'data-aim-version']) {
  check(`шапка и подвал попапа и панели держат ${part}`,
    read('popup.html').includes(part) && read('panel.html').includes(part));
}

// Правило 39: знак в шапке и иконка расширения рисуются из одного источника
const markSvg = read('vendor/aim-app-marks.svg');
const iconSvg = read('icons/mark.svg');
const glyph = 'M14 13v22M21 18h14M21 24h9M21 30h12';
check('иконка расширения повторяет глиф знака aside', markSvg.includes(glyph) && iconSvg.includes(glyph));
const manifest = JSON.parse(read('manifest.json'));
check('манифест отдаёт иконку в четырёх размерах',
  ['16', '32', '48', '128'].every(k => manifest.icons[k]), Object.keys(manifest.icons).join(' '));
check('версия манифеста совпадает с верхней записью CHANGELOG',
  read('CHANGELOG.md').includes(`## ${manifest.version}`), manifest.version);

// Правило 10: общие экспорты вендорятся байт в байт; здесь – что копия на месте и не пустая
for (const f of ['aim-app-shell.css', 'aim-app-mark.js', 'aim-app-marks.svg', 'aim-mini-apps.css']) {
  check(`вендоренная копия на месте: ${f}`, read('vendor/' + f).length > 500);
}

// Правило 18: только короткое тире
// длинное тире ищем в строках, которые читает человек: внутри символьного класса регулярки
// тот же знак – это данные (нормализация чужих заголовков), а не текст продукта
const longDash = f => read(f).split('\n').some(line => line.includes('\u2014') && !/\.replace\(\//.test(line));
const dashed = ['popup.html', 'panel.html', 'palette.html', 'shell.js', 'popup.js', 'panel.js', 'options.html', 'options.js', 'background.js', 'instrument.css', 'README.md', 'CHANGELOG.md', 'REQUIREMENTS.md']
  .filter(longDash);
check('в текстах нет длинного тире', dashed.length === 0, dashed.join(', '));


// ---------- строка меню, персонаж и комбинация (правила 47, 48, 49) ----------

// Правило 47: четыре режима кнопки и ни одного лишнего; snapshot smart снят и мигрирует один раз.
check('фон знает четыре режима кнопки и не знает smart',
  /const BAR_MODES = \['mark', 'mark \+ value', 'value', 'hidden'\]/.test(bg) && !/'smart'/.test(bg));
check('сохранённый режим мигрирует один раз по ключу', bg.includes('barModeRev') && bg.includes("settings.barMode = 'mark + value'"));
check('режим value рисует число иконкой, mark + value – бейджем',
  bg.includes('function valueIcon') && bg.includes("mode === 'mark + value' ? String"));
check('кнопка перерисовывается на событиях окна, а не по таймеру',
  ['chrome.tabs.onCreated.addListener(scheduleBar)', 'chrome.tabs.onRemoved.addListener(scheduleBar)',
   'chrome.windows.onFocusChanged.addListener(scheduleBar)'].every(l => bg.includes(l)) && !/setInterval/.test(bg));

// Правило 49: одна комбинация на открытие и закрытие, и в манифесте не больше четырёх предложенных
const suggested = Object.values(manifest.commands).filter(c => c.suggested_key);
check('манифест предлагает не больше четырёх сочетаний', suggested.length <= 4, String(suggested.length));
// Браузер отказывает расширению в ⌥⌘A на уровне манифеста («Invalid value for 'commands[8].mac':
// Alt+Command+A»), поэтому предложено то, что он принимает, а строки продукта читают живую комбинацию.
check('комбинация предложена командой toggle-surface и принимается браузером',
  manifest.commands['toggle-surface']?.suggested_key?.mac === 'Alt+Shift+A', JSON.stringify(manifest.commands['toggle-surface']?.suggested_key));
check('строки продукта читают комбинацию у браузера, а не у манифеста',
  shell.includes("chrome.commands.getAll()") && shell.includes('data-aim-key') && bg.includes('async function surfaceKey'));
check('команда доходит до действия', bg.includes("'toggle-surface': 'toggleSurface'") && bg.includes('async function toggleSurface'));
check('поверхность держит порт и закрывает себя сама',
  shell.includes("chrome.runtime.connect({ name: surface })") && shell.includes('window.close()') &&
  bg.includes("port.name !== 'popup' && port.name !== 'panel'"));
for (const f of ['popup.html', 'panel.html']) {
  check(`подвал ${f} называет свою комбинацию`, read(f).includes('data-aim-key="toggle-surface"'));
  check(`${f} объявляет свою поверхность`, /data-aim-surface="(popup|panel)"/.test(read(f)));
}

// Правило 48: персонаж в шапке, плоский знак остаётся кнопке расширения и настройкам
for (const f of ['popup.html', 'panel.html']) {
  const markup = read(f);
  check(`${f} ставит в шапку воксельного персонажа`,
    markup.includes('data-aim-voxel="aside"') && markup.includes('vendor/aim-voxel.js'));
  check(`${f} держит плоский знак запасным вариантом`, markup.includes('data-aim-mark="aside"'));
}
check('оболочка собирает персонажа из общей модели',
  shell.includes('vendor/aim-voxel-models.json') && shell.includes("animate: 'assemble'") && shell.includes('interactive: true'));
check('настройки и палитра остаются с плоским знаком',
  read('options.html').includes('data-aim-mark="aside"') && !read('options.html').includes('data-aim-voxel') &&
  read('palette.html').includes('data-aim-mark="aside"') && !read('palette.html').includes('data-aim-voxel'));

// Правило 10 для двух новых копий: байт в байт с общим экспортом, судья – sha-256.
// Цифры записаны здесь, а когда lab-sites лежит рядом, копия сверяется и с живым файлом.
const VENDORED = {
  'aim-voxel.js': '3b82eb53545533e41cf3ed272109a916586ad1637ad907923004af41f461fcb8',
  'aim-voxel-models.json': 'caa520ddc9aa37fedd8ccc5c9f1de773e7fa3b2fc005d506b2ea03bcf9762ca3'
};
const EXPORTS = { 'aim-voxel.js': 'aim-voxel.js', 'aim-voxel-models.json': 'voxel-models.json' };
const appsAssets = new URL('file://' + (process.env.HOME || '') + '/repos/lab-sites/sites/apps/assets/');
for (const [name, digest] of Object.entries(VENDORED)) {
  const sha = createHash('sha256').update(fs.readFileSync(new URL('../vendor/' + name, import.meta.url))).digest('hex');
  check(`вендоренная копия совпадает с экспортом: ${name}`, sha === digest, sha.slice(0, 12));
  const live = new URL(EXPORTS[name], appsAssets);
  if (!fs.existsSync(live)) { console.log(`SKIP  живой экспорт не подключён: ${name}`); continue; }
  const liveSha = createHash('sha256').update(fs.readFileSync(live)).digest('hex');
  check(`живой экспорт не ушёл вперёд: ${name}`, liveSha === digest, liveSha.slice(0, 12));
}
check('модель aside лежит в вендоренном файле',
  !!JSON.parse(read('vendor/aim-voxel-models.json')).models?.aside?.voxels?.length);

// Правило 47 в настройках: строка menu bar с живым предпросмотром и строкой комбинации
const optionsHtml = read('options.html'), optionsJs = read('options.js');
check('настройки держат строку menu bar с предпросмотром',
  optionsHtml.includes('<span class="ttl">menu bar</span>') && optionsHtml.includes('id="barPrev"') && optionsHtml.includes('id="barMode"'));
check('предпросмотр рисует выбранный режим', optionsJs.includes('function renderBar') && optionsJs.includes("AIMAppMark.el('aside'"));
check('hidden выбирается через подтверждение', optionsJs.includes("v === 'hidden' && !confirm("));
check('конфликт комбинации показан красной строкой и не сохраняется',
  optionsJs.includes("chrome.commands.getAll") && optionsJs.includes("classList.toggle('bad'") && optionsJs.includes('conflict:'));

// Правило 49: ни одна строка, которую читает человек, не держит комбинацию литералом –
// её берут у браузера, поэтому смена на chrome://extensions/shortcuts видна сразу.
const barSection = optionsJs.slice(optionsJs.indexOf('// ---------- menu bar'), optionsJs.indexOf('// ---------- \u0441\u0431\u043e\u0440\u043a\u0430'));
check('строка menu bar не называет комбинацию литералом', barSection.length > 500 && !/\u2325[\u2318\u21e7]/.test(barSection));
check('подтверждение hidden и заметка берут живую комбинацию',
  optionsJs.includes('async function toggleCommand') && optionsJs.includes('BAR_NOTES[mode](combo)') &&
  optionsJs.includes('${combo}') && optionsJs.includes('chrome://extensions/shortcuts'));
check('подпись кнопки не кэширует комбинацию', !bg.includes('let barKey') && !bg.includes('if (barKey) return barKey'));

// Правило 47: один список режимов на четыре продукта, продуктовое значение живёт в предпросмотре
check('кнопки режима подписаны каноном списка',
  ['>mark<', '>mark + value<', '>value<', '>hidden<'].every(w => optionsHtml.includes(w)) &&
  !optionsHtml.includes('>mark + tabs<'));

console.log(fails ? `\n${fails} провалов` : '\nповерхности согласованы');
process.exit(fails ? 1 : 0);
