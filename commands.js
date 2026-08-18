// Aside Tweaks — единый список команд.
//
// Панель, палитра и попап читают отсюда: пока каждый список жил своей жизнью,
// «очистить дубликаты» была в палитре и отсутствовала в панели, а названия
// расходились. Поле `on` говорит, на каких поверхностях команда показывается;
// действия на текущей вкладке в панели не нужны — там они живут в строке.

const TWEAK_COMMANDS = [
  {
    action: 'tidyUp', glyph: '✦', title: 'tidy up', sub: 'one sweep', key: '⌥⌘T',
    hint: 'clean duplicates and empty tabs → flatten groups → order → rebuild blocks',
    words: 'tidy sweep clean order everything', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'tidyDuplicates', glyph: '⊗', title: 'clean duplicates', sub: 'and empty tabs', key: '⌥⌘D',
    hint: 'close duplicates and empty tabs, leave the order alone',
    words: 'dd dedup duplicates empty clean', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'groupByRules', glyph: '▤', title: 'group by my blocks', sub: 'rules from settings', key: '',
    hint: 'a block is a name plus substrings, set in settings',
    words: 'blocks group rules', on: ['panel', 'palette']
  },
  {
    action: 'groupByDomain', glyph: '◈', title: 'group by site', sub: 'root domain', key: '',
    hint: 'one group per site, groups open expanded',
    words: 'group site domain host', on: ['panel', 'palette']
  },
  {
    action: 'ungroupAll', glyph: '⊟', title: 'ungroup everything', sub: 'flatten the window', key: '',
    hint: 'take every tab out of its group, order untouched',
    words: 'ungroup flatten flat', on: ['panel', 'palette']
  },
  {
    action: 'sortByDomain', glyph: '↕', title: 'order by site', sub: 'a → z', key: '',
    hint: 'alphabetical by host',
    words: 'sort order site alphabetical', on: ['panel', 'palette']
  },
  {
    action: 'sortByOpened', glyph: '↻', title: 'order by when opened', sub: 'oldest first', key: '',
    hint: 'tab id is the open order, so this is the order you opened them',
    words: 'opened order time recent age', on: ['panel', 'palette']
  },
  {
    action: 'favoriteTab', glyph: '★', title: 'bookmark ⇄ tab', sub: 'last row of the bar', key: '⌘D',
    hint: 'the page joins the bookmarks bar, the tab stays open · again brings it back to the top',
    words: 'bookmark bar keep star', on: ['palette', 'popup']
  },
  {
    action: 'pinTab', glyph: '◆', title: 'pin / unpin tab', sub: 'the squares on top', key: '⇧⌘D',
    hint: 'unpinning returns the page to the first row of the tabs and keeps it selected',
    words: 'pin unpin squares', on: ['palette', 'popup']
  },
  {
    action: 'bookmarkTab', glyph: '☆', title: 'bookmark, no dialog', sub: 'toggle', key: '',
    hint: 'writes the bookmark without the browser dialog, second call removes it',
    words: 'bookmark bm save no dialog', on: ['palette']
  },
  {
    action: 'togglePanel', glyph: '◧', title: 'open the tweaks panel', sub: 'bookmarks · pinned · tabs', key: '⌃⇧S',
    hint: 'the side panel of this extension',
    words: 'panel sidebar surface', on: ['palette']
  }
];

const commandsFor = surface => TWEAK_COMMANDS.filter(c => c.on.includes(surface));

if (typeof module !== 'undefined') module.exports = { TWEAK_COMMANDS, commandsFor };
