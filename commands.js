// Aside Tweaks — единый список команд.
//
// Панель, палитра и попап читают отсюда: пока каждый список жил своей жизнью,
// «очистить дубликаты» была в палитре и отсутствовала в панели, а названия
// расходились. Поле `on` говорит, на каких поверхностях команда показывается;
// `short` — имя для плитки попапа, где место дорогое; `group` — секция попапа.

const TWEAK_COMMANDS = [
  {
    action: 'togglePanel', glyph: '◧', title: 'open the tweaks panel', short: 'panel', sub: 'bookmarks · pinned · tabs', key: '⌃⇧S',
    hint: 'the side panel of this extension',
    words: 'panel sidebar surface', group: 'surface', on: ['palette', 'popup']
  },
  {
    action: 'openPalette', glyph: '⌕', title: 'palette', short: 'palette', sub: 'tabs · history · notes', key: '⇧⌘K',
    hint: 'one search over tabs, history, bookmarks, notes and commands',
    words: 'palette search find', group: 'surface', on: ['popup']
  },
  {
    action: 'favoriteTab', glyph: '★', title: 'bookmark ⇄ tab', short: 'bookmark ⇄ tab', sub: 'first row of the bar', key: '⌘D',
    hint: 'the page becomes the first bookmark and the tab closes — focus moves to the next open tab · ⌘D on an open bookmarked page removes the bookmark',
    words: 'bookmark bar keep star', group: 'tab', on: ['palette', 'popup']
  },
  {
    action: 'pinTab', glyph: '◆', title: 'pin / unpin tab', short: 'pin / unpin', sub: 'the squares on top', key: '⇧⌘D',
    hint: 'unpinning returns the page to the first row of the tabs and keeps it selected',
    words: 'pin unpin squares', group: 'tab', on: ['palette', 'popup']
  },
  {
    action: 'tidyUp', glyph: '✦', title: 'tidy up', short: 'tidy up', sub: 'one sweep', key: '⌥⌘T',
    hint: 'opens review first, then cleans exact duplicates and empty tabs → flatten → recent loose tabs on top → blocks from 3 tabs',
    words: 'tidy sweep clean order everything', group: 'window', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'tidyDuplicates', glyph: '◎', title: 'review tabs', short: 'review tabs', sub: 'exact · related · stale · sources', key: '⌥⌘D',
    hint: 'review product clusters before closing anything · protected tabs stay protected · every batch gets a receipt',
    words: 'review dd dedup duplicates twins semantic siblings stale event research source cleanup', group: 'window', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'groupBySense', glyph: '✳', title: 'blocks by meaning', short: 'by meaning', sub: 'a model reads the titles', key: '',
    hint: 'sends titles and hosts of the open tabs to OpenRouter and proposes blocks — you apply them yourself',
    words: 'ai smart sense meaning model openrouter blocks', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'groupByRules', glyph: '▤', title: 'group by my blocks', short: 'my blocks', sub: 'rules from settings', key: '',
    hint: 'a block is a name plus substrings, set in settings',
    words: 'blocks group rules', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'groupByDomain', glyph: '◈', title: 'group by site', short: 'by site', sub: 'root domain', key: '',
    hint: 'one group per site, groups open expanded',
    words: 'group site domain host', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'ungroupAll', glyph: '⊟', title: 'ungroup everything', short: 'ungroup', sub: 'flatten the window', key: '',
    hint: 'take every tab out of its group, order untouched',
    words: 'ungroup flatten flat', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'sortByDomain', glyph: '↕', title: 'order by site', short: 'a → z by site', sub: 'a → z', key: '',
    hint: 'alphabetical by host',
    words: 'sort order site alphabetical', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'sortByOpened', glyph: '↻', title: 'order by when opened', short: 'by opened', sub: 'oldest first', key: '',
    hint: 'tab id is the open order, so this is the order you opened them',
    words: 'opened order time recent age', group: 'order', on: ['panel', 'palette', 'popup']
  },
  {
    action: 'bookmarkTab', glyph: '☆', title: 'bookmark, no dialog', short: 'bookmark', sub: 'toggle', key: '',
    hint: 'writes the bookmark without the browser dialog, second call removes it',
    words: 'bookmark bm save no dialog', group: 'tab', on: ['palette']
  }
];

const commandsFor = surface => TWEAK_COMMANDS.filter(c => c.on.includes(surface));

if (typeof module !== 'undefined') module.exports = { TWEAK_COMMANDS, commandsFor };
