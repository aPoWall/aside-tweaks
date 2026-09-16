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

// попап тоже рендерит из общего списка — и у каждой его команды есть короткое имя и секция
const popupJs = read('popup.js');
check('попап рендерит из общего списка', popupJs.includes("commandsFor('popup')") && !popup.includes('data-action='));
const noShort = commandsFor('popup').filter(c => !c.short || !c.group);
check('у команд попапа есть short и group', noShort.length === 0, noShort.map(c => c.action).join(', '));

// панель и палитра рендерят из общего списка
check('панель рендерит из общего списка', panel.includes("commandsFor('panel')"));
check('палитра рендерит из общего списка', palette.includes("commandsFor('palette')"));

// чистка дублей обязана быть на всех трёх поверхностях — это и была жалоба
const dedup = TWEAK_COMMANDS.find(c => c.action === 'tidyDuplicates');
check('чистка дублей есть в панели, палитре и попапе',
  ['panel', 'palette', 'popup'].every(s => dedup.on.includes(s)), dedup.on.join(' '));

// Чистка обязана быть достижимой с поверхности. Регрессия 4.20: applyDuplicateCleanup
// вызывалась только из applyTidyUp, а та не висела ни на клавише, ни на строке, и «чистка
// перестала работать» была не багом логики, а недостижимой функцией.
const reviewActions = (bg.match(/const REVIEW_ACTIONS = \{([\s\S]*?)\};/) || [])[1] || '';
check('чистка дублей достижима с поверхности',
  (known + reviewActions).includes('applyDuplicateCleanup') && palette.includes("send('applyDuplicateCleanup')"));

// и в фоне не остаётся функций, которых никто не зовёт — тот же класс поломки
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

console.log(fails ? `\n${fails} провалов` : '\nповерхности согласованы');
process.exit(fails ? 1 : 0);
