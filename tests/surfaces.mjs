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

// попап выложен руками — значит, его состав нужно сверять
const missingPopup = commandsFor('popup').filter(c => !popup.includes(`data-action="${c.action}"`));
check('попап показывает свои команды', missingPopup.length === 0, missingPopup.map(c => c.action).join(', '));

// панель и палитра рендерят из общего списка
check('панель рендерит из общего списка', panel.includes("commandsFor('panel')"));
check('палитра рендерит из общего списка', palette.includes("commandsFor('palette')"));

// чистка дублей обязана быть на всех трёх поверхностях — это и была жалоба
const dedup = TWEAK_COMMANDS.find(c => c.action === 'tidyDuplicates');
check('чистка дублей есть в панели, палитре и попапе',
  ['panel', 'palette', 'popup'].every(s => dedup.on.includes(s)), dedup.on.join(' '));

// у каждой команды есть подпись и пояснение
const thin = TWEAK_COMMANDS.filter(c => !c.title || !c.sub || !c.hint || !c.words);
check('у каждой команды есть название, подпись, пояснение и слова для поиска',
  thin.length === 0, thin.map(c => c.action).join(', '));

console.log(fails ? `\n${fails} провалов` : '\nповерхности согласованы');
process.exit(fails ? 1 : 0);
