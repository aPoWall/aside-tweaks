# Changelog

## 4.33.0 – 2026-10-03

- the navigation panel follows native Sidebar order: Pin squares, complete ordered Bookmarks with folders,
  then Tabs. A saved live page is highlighted in Bookmarks and represented once; other live copies remain visible;
- a local title/URL filter, keyboard navigation, Current button and display-only groups/sites/list selector
  replace the long numbered tier labels. Active groups stay open, and focus/reopen events reveal the current row
  against the actual scroll viewport. Coalesced tab updates no longer cancel an activation's reveal request;
- recent history is an opt-in drawer. Notes are searched in the Notes scope by default; the desk settings can
  include them in All again. Browser results paint before the optional bridge responds. No notes, history,
  groups, bookmark order or tab protections are deleted;
- the public demo now has synthetic inspect → preview → explicit confirmation → receipt → reset states,
  showing 2 closed / 3 stays with pinned and bookmarked reasons. Release date corrected to October 3;
- operator: reload the unpacked extension once. Panel display preferences are local; keymap and bridge
  settings remain intact. Rollback to 4.32 restores the old panel; the new preferences may remain unused.

## 4.32.0 – 2026-10-03

- exact cleanup now treats a native Bookmarks row as a protection inside an exact-duplicate cluster;
  matching live copies stay in the reviewed window until the bookmark is removed or a row is handled
  explicitly;
- the confirmed receipt records the reviewed window, every tab that actually closed and every canonical
  or protected row that actually stayed. A stale tab id from another window is ignored at commit time;
- the batch remains current-window only and still requires the visible palette confirmation. Pins, the
  active page, user marks and unsaved forms keep their existing protections.

## 4.31.0 – 2026-09-29

- **Remove Duplicates** is now a visible panel action. It opens the exact/empty preview for the current
  Aside window; the final row names every tab that will close and requires one explicit confirmation.
  `tidy up` uses the same preview and only rearranges the reviewed window;
- removed the old global cleanup path that could close tabs in another window after a current-window
  review. Pinned, active, user-marked, unsaved-form and last-in-window tabs remain protected, and a
  confirmed batch still writes its canonical/source receipt;
- the panel compares the manifest with the service worker's build stamp. An unpacked update with an old
  worker now says `update waiting · reload Aside Tweaks once` and disables cleanup instead of silently
  running the previous command contract;
- clarified the native ownership model: Aside's vertical Sidebar owns Pins, Bookmarks and saved Tab
  Groups; the extension mirrors them, adds review and search, and keeps smart history as a local read-only
  ranking. Browser history deletion is outside the cleanup command.

## 4.30.0 – 2026-09-29

- `⌘D` now completes the native Aside move: it appends the active page to the bottom of **Bookmarks**, takes it out of a tab group so Aside can show one live saved row, and keeps that page selected. `⇧⌘D` remains the separate Pin square. The one-time `favoriteBookmarkFoldRev` migration clears the three 4.28 keep-on-top defaults and enables the native Bookmarks fold without changing existing bookmark order;
- palette, panel, popup, settings and browser command labels now say **Bookmarks** and **Pin** explicitly. The selected-tab action is `save / remove selected tab in Bookmarks`, and the legacy duplicate bookmark command no longer appears in the palette;
- tab review opens with `nothing closes on this screen`, names the four review families and sends every destructive batch through its separate preview. Notes say why they are present: edited today, filename match, last modified on disk or last opened in Obsidian;
- product copy and the interactive website model use the same 4.30 contract.

## 4.29.0 – 2026-09-28

- `⌘D` returns to the bookmark contract: the new row is appended to the end of Bookmarks, the open tab
  stays in its native group and keeps focus, and no pinned square is created. `⇧⌘D` remains the dedicated
  pin command. A one-time migration removes the three 4.28 keep-on-top defaults while preserving an
  operator's later choices;
- the panel shows the newest bookmark rows from the end of the bar, puts native Aside tab-group names
  ahead of inferred blocks, and folds the full command catalogue into a compact drawer;
- window refocus now reasserts the remembered active tab only when it is still the browser's active tab.
  This refreshes the native sidebar highlight without overriding an intentional tab switch;
- the product page demonstrates the same bookmark-at-the-end transition and names 4.29 consistently.

## 4.28.0 – 2026-09-27

- `⌘D` is one keep-on-top gesture again: it writes the durable row first in the bookmarks bar, pins the
  open page into the squares on top and returns the focus to that page. A second `⌘D` removes both while
  leaving the page open and selected. Migration key `favoriteRepinRev` restores the switch once; after
  that the setting belongs to the person;
- fixed the invisible-new-row regression: the command inserted a bookmark at index 0 while the panel
  rendered the last 14 bookmarks, so a successful `⌘D` looked broken on a long bar. The panel now reads
  the first 14 and keeps the newest row visible;
- the panel gains a six-row local smart history, ranked with the palette's recency and choice signals and
  excluding pages already open or bookmarked. Kept pages and pins form compact categories only for named
  rules or repeated sites; one-off domains stay together instead of producing a wall of headings;
- reopening, revealing or focusing the panel rereads the window and centres the active row immediately.
  Tab activation does the same after the fresh state renders, so a stale previous row can no longer win.

## 4.27.0 – 2026-09-24

- `⌘D` stops pinning. The squares on top belong to `⇧⌘D`; `⌘D` writes the row, first in the bookmarks
  bar, and the sidebar of Aside folds the open tab into that row – the page leaves the tab list and
  stands in the sidebar once, with the focus on it. 4.26 sent it into the squares, which is a different
  gesture and a different place. Pinning stays as a switch, `⌘D also pins the page into the squares on
  top`, off by default; migration key `favoriteUnpinRev` turns it off once;
- the panel says where you are and goes there. Every row carries a label on the right, the way a palette
  row does – `active`, `pinned`, `asleep` or the host – and the panel scrolls the active row into the
  middle of its own window on every render and on every tab switch. Until now the highlight was there
  and the panel never moved to it, so on fifty tabs «where am I» meant scrolling by hand;
- tests: sw-smoke asserts the new default in both directions and keeps the pin under its switch;
  `tests/testbed-favorite.mjs` asserts the same in a real browser.

## 4.26.0 – 2026-09-22

- `⌘D` puts the page where `⇧⌘D` puts it. The row becomes the first row of the bookmarks bar and the
  tab is pinned, so in the sidebar it stands as a square on top, with the focus still on it. 4.25 lifted
  the tab to the first row of the tab list, which in this sidebar still reads as «down there», and one
  page kept showing as two entries. A second `⌘D` takes the row and the square out and leaves the tab
  open, selected and first in the list. Setting `⌘D pins the page into the squares on top`, migration
  key `favoritePinRev`, applied once;
- the selection is confirmed twice. The sidebar rebuilds its list after a pin and after a new bookmark
  row and moves the highlight to a neighbour; a second pass 260 ms later brings it back to the page
  the person is working on;
- `remove duplicates` is a command again – in the palette, the panel and the popup. It closes the exact
  duplicates and the empty tabs of every window straight away, with the same protections as before
  (pinned, active, marked, unsaved form, last tab in its window) and the same receipt;
- `tidy up` runs the sweep instead of opening the palette: cleanup → flatten → recent loose tabs on top
  → blocks from three tabs → receipt. `review tabs` stays the door into the review surface, and this
  reverses the 4.18 rule that sent every cleanup key through review first;
- the palette puts the tab the person is on first and marks it `active`; until now it was sorted to the
  end of the list.

## 4.25.0 – 2026-09-22

- `⌘D` makes the same move as pin. The row goes **first** in the bookmarks bar and the open tab
  rises to the first row of the tabs, under the pinned squares, with the focus still on it. Before
  this the row joined the end of the bar while the tab stayed wherever the list held it, so one page
  showed up twice in the sidebar – the copy on top, the focus at the bottom. Migration key
  `favoriteTopRev` turns both halves on once; `the new row goes first in the bookmarks bar` and
  `the open tab rises to the first row` stay in settings card `02 pin vs bookmark` and switch back
  to the 4.21 contract;
- testbed: `scripts/testbed.sh` starts a second Aside on its own profile with its own bookmarks bar
  and a debugging port, so a gesture that moves tabs and bookmarks is checked without touching the
  working window. `tests/cdp.mjs` talks to the service worker of the extension over the DevTools
  Protocol and `tests/testbed-favorite.mjs` drives `⌘D` and `⇧⌘D` in the real browser: where the row
  lands, where the tab lands, what keeps the focus. `tests/testbed-visual.mjs` takes window snapshots
  for what the API cannot show – the native sidebar;
- tests: `sw-smoke` asserts the new default in both directions and keeps the 4.21 contract under its
  two switches.

## 4.24.0 – 2026-09-17

- the toolbar button reads as a menu bar item (rule 47): it is visible by default, one click opens the
  surface of the product and the next click closes it, and the mode of the button is one list in settings
  card `00 menu bar`: `mark` (the product mark alone, the default), `mark + value` (the mark with the tab
  count of this window), `value` (the count drawn as the button itself, with the red signal in its corner)
  and `hidden`. The row carries a live preview of the button in the chosen mode and the count is read from
  the window, not from a timer: it follows tab creation, closing, a move between windows and window focus;
- `hidden` asks first and says what it can and cannot do: the browser keeps the square in the toolbar and
  only a person can unpin it from the button's own menu, so the mode empties the drawing and the title,
  the note and the confirmation point at the combination the browser actually registered and at the unpin
  step. Declared as an exception in `REQUIREMENTS.md`;
- one global combination, shipped as `⌥⇧A` (rule 49; Chromium refuses `⌥⌘A` for an extension command,
  so the family default is set by hand on `chrome://extensions/shortcuts`): `toggle-surface` opens the popup through `chrome.action.openPopup`
  and falls back to the side panel where the browser has no popup route; the same key closes what is open,
  because each surface holds a port while it lives and closes itself on the message. Chrome allows four
  suggested keys per extension, so `open-panel` keeps its command and its custom binding and gives up the
  suggested `⌃⇧S`. A combination the browser refuses to register arrives empty in `chrome.commands.getAll`,
  and the settings row turns red and says it is not stored;
- the voxel character comes back into the header of the popup and the panel at 40 px (rule 48), assembles in
  700 ms with the finished figure as the first frame, lifts under the cursor and answers a click with the
  aside gesture: the red cursor steps down the list. The flat mark stays where 18 px turns a voxel body into
  a block: the toolbar button, the settings page, the palette line and the favicons. `vendor/aim-voxel.js`
  and `vendor/aim-voxel-models.json` are vendored byte for byte from `sites/apps/assets` and both digests are
  asserted by `tests/surfaces.mjs`, which is what the 4.22 removal was missing;
- the bottom line of both surfaces names its own combination first, read from the browser:
  `⌥⇧A panel · ⇧⌘K palette · ⌥⌘D review`;
- tests: `sw-smoke` drives the four bar modes against a stubbed toolbar, watches the count follow a new tab
  and presses `toggle-surface` twice, once with a connected surface and once without; `surfaces` checks the
  four modes in the service worker, the suggested-key budget, the vendored digests and the settings row.
- repair pass of the same wave, after the review: the settings note and the `hidden` confirmation took the
  combination from `chrome.commands.getAll()` instead of the literal `⌥⌘A` they printed, and an empty answer
  from the browser now reads `no combination · chrome://extensions/shortcuts`; the mode buttons went back to
  the words of the one list (`mark` · `mark + value` · `value` · `hidden`) with the product value left to the
  preview line; the service worker stopped caching the combination, so a change on the shortcuts page reaches
  the button title without a restart; the shell comments name rules 47 to 49 by their stable numbers.

## 4.23.0 – 2026-09-17

- a number key always lands somewhere (rule 38): `⌘1`…`⌘9` still address the blocks of the window, and a
  number with no block behind it selects the tab in that position, `⌘9` the last one, which is what the same
  key means in the browser. Chrome hands a registered shortcut to the extension for good, so the product
  carries the browser reading itself instead of leaving the key dead in a window that has no blocks yet;
- `⇧⌘` on the next free number opens a new block around the current tab and names it `block N`; a number
  further out says which one is next instead of refusing without a direction;
- review says what it is on the surface: the first row of the list now reads `what this window already
  repeats, with the reason on every row`, next to the counts and above the confirmation line. The same
  sentence is in the command hint of the palette and on the popup tile before the counts arrive;
- `REQUIREMENTS.md`: every requirement that reached the product from waves 3 to 9 with its status, the
  declared exceptions (family keys, no pin on browser surfaces) and the answers to the two open questions,
  the number keys and review tabs;
- `tests/sw-smoke.mjs` covers the number fallback in both directions: a number with a block, a number with a
  tab, a number with neither, and the next free number that opens a block.

## 4.22.0 – 2026-09-16

- one shell for every surface: the popup, the panel and the palette take the header, the bottom line and the product mark from the shared L2 export of AI Mindset apps. `vendor/aim-app-shell.css`, `vendor/aim-app-mark.js`, `vendor/aim-app-marks.svg` and `vendor/aim-mini-apps.css` are vendored byte for byte and verified by sha-256 through `vendored-consumers.json` of the apps system (rules 10, 34, 40);
- header, one order everywhere: mark 40 px, product name, the state line under the name, version, `settings`; the panel adds `×`. A slot the surface does not own stays empty and the order holds (rule 32): a browser popup cannot survive an outside click and cannot be pinned, and the browser owns the popup frame, so it closes itself and takes no `×`. The panel has no pin either, because a sidebar stays open until it is closed; no browser surface of the product carries a pin button, and adding one would add a control without a consequence (rules 38, 41);
- rule 39, one drawing for the icon and the header: the toolbar icon was a half-filled circle while the header carried the voxel character, so the same product looked like two. `icons/mark.svg` is the aside glyph of `vendor/aim-app-marks.svg` with a white plate under it, and `icons/16 · 32 · 48 · 128.png` are rendered from it; the manifest ships the 32 px size for retina toolbars;
- the voxel character leaves the extension surfaces and stays on the product page as an illustration; `mark.js`, `vendor/aim-voxel.js` and `vendor/aim-voxel-aside.json` are removed. The two voxel copies had drifted from the shared export and no check caught it;
- panel, one close: `×`, `esc` and `⌘W` reach the same `closePanel()`, which closes the side-panel document and falls back to the `sidePanel` route if the browser keeps it open;
- bottom line, three parts on every surface: keys · `esc close` · version or state (rule 22);
- the palette summary line carries the product mark instead of the grey square placeholder;
- rule 38, controls with a consequence: the popup dropped the second `settings ↗` link that repeated the header button and the separate readout block. The counts moved into the state line under the name and into the right part of the bottom line, where they are read, not just displayed;
- colour and face come from the surface theme through one bridge block in `instrument.css`: the shared shell keeps the geometry of the native apps, the aside look keeps its grey field, its white pill and the system face on which it is drawn;
- `tests/surfaces.mjs` grew four checks: a static button with no handler, a surface that does not take the shared shell, an icon that drifts from the mark glyph, and a long dash in a text.

## 4.21.0 – 2026-09-16

- `⌘D` follows Arc: the bookmark joins the end of the bar, the rows above it keep their places, the tab stays open and selected, and a second `⌘D` takes the row out. Closing the tab remains a setting and is off by default (one-time migration under `favoriteArcRev`);
- `⇧⌘D` keeps the focus on the tab after pinning and unpinning;
- fixed duplicate cleanup: `applyDuplicateCleanup` had no caller since the tidy path was rewritten, so no key and no surface could reach it. Cleanup now runs from the review confirmation, covers every window, and writes a receipt; the popup tile shows the number that confirmation will close;
- cleanup counts what is left in every window: a window whose tabs are all cross-window duplicates keeps one of them, the rest go to `blocked` with the reason `last tab in its window`, so no batch closes a window;
- a bookmarked page no longer protects each of its own copies inside an exact-duplicate cluster; on a 92-tab window this moved the offer from 24 to 32 tabs that really close;
- review opens with the summary and the confirm line instead of hiding them below a hundred rows, and a related cluster wider than 8 tabs offers no batch at all;
- related clusters stop growing through one common word that half the window shares;
- review asks each page about unsaved input with a 200 ms limit and skips sleeping tabs, so one hung content script no longer delays the whole list;
- `⌘1`…`⌘9` address the blocks of the window and `⇧⌘1`…`⇧⌘9` put the current tab into a block; the palette lists what each number holds, and the keys can be given back to the browser in settings;
- added `block from selected tabs`, the Arc multi-select gesture: shift-click or `⌘`-click several tabs, then one command turns the selection into one named block;
- added `fold / unfold blocks`, the Arc collapse-pinned gesture as one command;
- family keys, declared exception to rule 37: the browser keeps `⌘K`, so the palette opens on `⇧⌘K` and `⌘K` stays the row action panel (README · family keys);
- short dash only (U+2013) in every string the user reads, in the panel, the palette, the popup, settings and the bridge;
- the `⌘K` panel is the same on every row type: the row's own actions, then `⌘C` copy address or path and `⌥⌘C` copy title;
- notes in the palette are ranked by match first and freshness second and carry the reason they are on the list; a row without a favicon shows a monospace letter avatar;
- `tests/surfaces.mjs` fails when a function in the service worker has no caller and no place in the action maps, which is exactly how the cleanup broke.

## 4.20.0 – 2026-09-14

- added the live product mark: the aside voxel character sits in the panel and popup header, follows the cursor with a small depth parallax, and scatters and reassembles on click, Enter or Space while its red cursor steps to a neighbouring cell;
- vendored `vendor/aim-voxel.js` byte for byte from the AI Mindset apps export (`sites/apps/assets/aim-voxel.js`, sha-256 `9ed762d5…6eccb`); `vendor/aim-voxel-aside.json` is the aside model extracted from `voxel-models.json` of 2026-09-13 (sha-256 `346273ca…3ce1`); `mark.js` renders the character without inline scripts;
- reduced motion keeps the character static and only moves the red cursor;
- rebuilt the product page on the shared N1 structure with English by default and a Russian switch.

## 4.19.0 – 2026-09-02

- moved new `⌘D` bookmarks to the first row of the bookmarks bar;
- made post-close focus follow the next unpinned tab, with pinned tabs as fallback only;
- aligned settings, palette, popup and panel copy with the installed behavior;
- restored the product page's AI Mindset Apps engineering language and concise first viewport;
- added a draggable live palette, keyboard demo, animated keep transition and reactive Tab Keeper;
- kept semantic review as an explicit palette mode instead of presenting it as the whole product.

## 4.18.0 – 2026-09-01

- added product-aware tab review with exact, related, stale/event and research states;
- added persistent cluster names, canonical tabs, user protection, source bookmarks and local receipts;
- protected pinned, active, bookmarked, user-marked and unsaved-form tabs from batches;
- routed duplicate cleanup and tidy shortcuts through a final preview;
- retired destructive behavior from the legacy auto-dedupe preference;
- redesigned the product page around the live review workflow and Tab Keeper character;
- shortened the README and added operator, migration and rollback guidance.

## 4.17.0 – 2026-08-28

- added bookmark-and-close behavior for `⌘D`;
- added duplicate preview with reasons and selected keeper;
- added recent Obsidian notes with a today section;
- made Aside menu items searchable through the desk bridge.

## Rollback

Check out the required version, reload the unpacked extension, and verify the manifest version on `chrome://extensions`. Rolling back to 4.20 restores the first-row `⌘D` bookmark and the tab-closing default, and gives `⌘1…⌘9` back to the browser; existing bookmark order and review storage remain intact.
