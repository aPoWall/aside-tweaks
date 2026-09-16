// Проверка согласованности поверхностей.
//
// Жалоба, из которой вырос этот файл: «команда очистки дублей есть в палитре,
// а в боковой панели её нет». Пока каждый список жил своей жизнью, такое
// расхождение было делом одного коммита.

import fs from 'node:fs';
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
const dashed = ['popup.html', 'panel.html', 'palette.html', 'shell.js', 'popup.js', 'panel.js', 'instrument.css', 'README.md', 'CHANGELOG.md']
  .filter(f => read(f).includes('\u2014'));
check('в текстах нет длинного тире', dashed.length === 0, dashed.join(', '));

console.log(fails ? `\n${fails} провалов` : '\nповерхности согласованы');
process.exit(fails ? 1 : 0);
