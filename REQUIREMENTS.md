# Aside Tweaks · requirements ledger

One row per requirement that reached this product from the AI Mindset apps sprints
(`lab-sites/internal-sites/aim-product-system/SPRINT-2026-09-*.md`, waves 3 to 10) and from the rule book
`AIM-APPS-RULES.md`. Status is what the code and `tests/sw-smoke.mjs` plus `tests/surfaces.mjs` show today.
Wave 9 (`SPRINT-2026-09-17-JANITOR.md` § D) asked for this ledger, for the leftovers to be closed and for
two open questions of Alex to be answered here. Wave 10 (`SPRINT-2026-09-17-MENUBAR.md` § A, B, C) added the
menu bar contract, the character in the header and the one global combination, rules 47 to 49. The review
of 2026-09-17 added rows B11 and B12 and sharpened B3, B7, B8 and V2.

Legend: `done` shipped and asserted by a test · `open` still to do · `exception` declared deviation with a
reason · `blocked` waits for something outside the product.

## Gestures and keys

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| K1 | `⌘D` puts the page where `⇧⌘D` puts it: the row first in the bar, the tab pinned into the squares on top of the sidebar, the focus on it; a second `⌘D` takes both out | wave 11 § ⌘D, 2026-09-22 | done · sw-smoke asserts both directions and the switches, `tests/testbed-favorite.mjs` asserts pin, row and focus in a real browser | 2026-09-22 |
| K2 | `⇧⌘D` pins and unpins, the focus stays on the tab | wave 6 § D | done · sw-smoke, and the testbed compares `⌘D` with it as the reference move | 2026-09-22 |
| K3 | `⌘1`…`⌘9` address the blocks of the window, `⇧⌘` with the same number files the current tab | wave 6 § D | done · sw-smoke | 2026-09-16 |
| K4 | a number key never lands on nothing | wave 9 § D, rule 38 | done · a number with no block selects the tab in that position, `⌘9` the last one; `⇧⌘` on the next free number opens a block around the tab | 2026-09-17 |
| K5 | the palette lists what each number holds | wave 6 § D | done · `listBlocks` feeds the palette | 2026-09-16 |
| K6 | family keys: the palette opens on `⇧⌘K` because the browser owns `⌘K` | rule 37 | exception · declared in README, family keys | 2026-09-16 |
| K7 | the Arc multi-select gesture arrives as its own command | wave 6 § D | done · `block from selected tabs`, `fold / unfold blocks` | 2026-09-16 |

## Review and cleanup

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| R1 | duplicate cleanup works again, with a test and a receipt | wave 6 § D | done · `applyDuplicateCleanup` runs from the review confirmation; sw-smoke covers the plan and the receipt | 2026-09-16 |
| R2 | the popup tile shows the number the confirmation will really close | wave 6 § D | done · `dupsub` reads `closable` and `blocked` | 2026-09-16 |
| R3 | no batch ever empties a window | wave 6 § D | done · the last tab of a window goes to `blocked` with its reason | 2026-09-16 |
| R4 | review tabs is explained in one line on the surface or leaves it | wave 6 § D | done · the first row of review says what the list is, the command hint says it in the palette and in the popup | 2026-09-17 |
| R5 | the summary and the confirm line stand first, above the rows | wave 6 § D | done | 2026-09-16 |
| R6 | unsaved input is asked with a time limit, sleeping tabs are skipped | wave 6 § D | done · 200 ms per tab | 2026-09-16 |

| C9 | a command that names an action performs it: `remove duplicates` closes, `tidy up` sweeps, `review tabs` opens the review | wave 11, 2026-09-22 | done · reverses the 4.18 rule that sent every cleanup key into review; protections and receipts hold in both paths, sw-smoke asserts each | 2026-09-22 |
| C10 | the palette shows the tab the person is on, first and marked `active` | wave 11, 2026-09-22 | done · `palette.js` ranks it first without a query | 2026-09-22 |

## Palette and rows

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| L1 | ranking: exact matches first, then freshness | wave 6 § D | done | 2026-09-16 |
| L2 | notes carry the reason they are on the list | wave 6 § D | done | 2026-09-16 |
| L3 | row icons and letter avatars in the N1 brand | wave 6 § D, rule 35 | done | 2026-09-16 |
| L4 | the `⌘K` row panel is the same on every row type | wave 6 § D | done · row actions, then copy address, then copy title | 2026-09-16 |

## Shell and marks

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| S1 | popup, panel and palette take the shared web shell, vendored byte for byte | wave 7 § D, rules 10, 40 | done · surfaces test checks the four vendored files by sha-256 | 2026-09-16 |
| S2 | one header order on every surface, an empty slot keeps the order | wave 7 § D, rule 32 | done · a browser popup has no `×` and no pin, the slots stay empty | 2026-09-16 |
| S3 | the toolbar icon and the header mark are one drawing | wave 7 § D, rule 39 | done · `icons/mark.svg` from the aside glyph, surfaces test compares them | 2026-09-16 |
| S4 | bottom line in three parts on every surface | wave 7 § D, rule 22 | done | 2026-09-16 |
| S5 | the voxel character leaves the extension surfaces and stays on the product page | wave 7 § D, rule 39 | superseded by S9 · rule 48 of wave 10 puts the character back into the header and keeps the flat mark in the bar | 2026-09-17 |
| S6 | every control has a consequence, controls without one leave | wave 7 § D, rules 38, 41 | done · surfaces test fails on a static button with no handler | 2026-09-16 |
| S7 | short dash only in every string a person reads | rule 18 | done · surfaces test fails on a long dash | 2026-09-16 |
| S9 | the voxel character stands in the header of the popup and the panel at 40 px, the flat mark stays in the bar | wave 10 § B, rule 48 | done · `data-aim-voxel` slot, `shell.js` renders from the shared model, surfaces test asserts both surfaces and that settings and palette keep the flat mark | 2026-09-17 |
| S10 | the character assembles in 700 ms, first frame finished, reduced motion keeps the gesture | wave 10 § B, rules 7, 48 | done · `AIMVoxel.render(… animate: 'assemble', interactive: true)`, the library owns the motion numbers | 2026-09-17 |
| S11 | `aim-voxel.js` and the model file are vendored byte for byte | wave 10 § B, rule 10 | done · `vendor/aim-voxel.js` + `vendor/aim-voxel-models.json`, sha-256 asserted against the recorded digest and against the live export; not yet listed in `vendored-consumers.json`, which is the coordinator's file | 2026-09-17 |
| S8 | pin on the browser surfaces | rule 31 | exception · a popup cannot survive an outside click and a sidebar stays open until it is closed, so a pin button would be a control without a consequence (rule 38); the slots stay empty and the order holds | 2026-09-16 |


## Menu bar and the global combination

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| B1 | the button is visible by default and its mode is one list: `mark`, `mark + value`, `value`, `hidden` | wave 10 § A, rule 47 | done · setting `barMode`, service worker paints all four, sw-smoke walks them | 2026-09-17 |
| B2 | `mark + value` carries the tab count of the window; `value` draws the count as the button | wave 10 § A, rule 47 | done · badge for one, an `OffscreenCanvas` plate with the red signal for the other; the count follows tab and window events, never a timer | 2026-09-17 |
| B3 | `hidden` asks for a confirmation that names how the surface is reached afterwards | wave 10 § A, rule 47 | exception · a browser gives an extension no way to remove its own toolbar button, so the mode empties the drawing and the confirmation, the note and the button title name the manual unpin plus the combination read from `chrome.commands.getAll()`; an empty answer reads `no combination · chrome://extensions/shortcuts` | 2026-09-17 |
| B4 | a stored `smart` setting migrates once to `mark + value` | wave 10 § A, rule 47 | done · key `barModeRev`; the product never had `smart`, so the migration only catches a value that is not one of the four | 2026-09-17 |
| B5 | one click opens the surface, the next closes it | wave 10 § A, rule 47 | done · the browser toggles the popup by itself, and `toggle-surface` closes through the live port of the open surface | 2026-09-17 |
| B6 | the position of the item survives a rebuild | wave 10 § A, rule 47 | exception · the browser owns the toolbar; a person pins and orders the button, and the browser keeps that across reloads. There is no `autosaveName` to verify | 2026-09-17 |
| B7 | settings carry a `menu bar` row with a live preview of the button | wave 10 § A, rule 47 | done · card `00`, the buttons carry the words of the one list (`mark` · `mark + value` · `value` · `hidden`) and the preview draws the chosen mode with the same badge colours the worker paints, the product value in its note | 2026-09-17 |
| B8 | one global combination for open and close, `⌥⌘A` by default | wave 10 § C, rule 49 | exception · Chromium refuses that combination for an extension command at load: `Invalid value for 'commands[8].mac': Alt+Command+A`, and disables the extension. The shipped default is `⌥⇧A`; every line of the product reads the combination from `chrome.commands.getAll()` with no cache in the service worker, so setting `⌥⌘A` by hand on `chrome://extensions/shortcuts` moves the product onto it at once. Rule 49, the design system table and the team vault rule carry `⌥⇧A` with that reason | 2026-09-17 |
| B9 | a conflict is shown as a red line in settings and is never stored | wave 10 § C, rule 49 | done · the browser registers nothing on a conflict and returns an empty shortcut; the row and its note turn red and say it is not stored | 2026-09-17 |
| B10 | the footer of the surface names its own combination | wave 10 § C, rules 22, 49 | done · `[data-aim-key="toggle-surface"]` in the bottom line of the popup and the panel, filled from the browser | 2026-09-17 |
| B11 | every line a person reads takes the combination from the browser, never from a literal | review 2026-09-17, rule 49 | done · `toggleCommand()` feeds the `hidden` confirmation and the bar note in `options.js`, `surfaceKey()` in `background.js` dropped its `barKey` cache; `surfaces` fails on a literal inside the menu bar section, `sw-smoke` changes the registered combination mid-run and asserts the button title follows | 2026-09-17 |
| B12 | the shell comments name the rules by their stable numbers | review 2026-09-17, rule 43 | done · `shell.js` reads 47 to 49; 45 and 46 stay with the janitor wave | 2026-09-17 |

## Release

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| V1 | version in `manifest.json` matches the top entry of `CHANGELOG.md` | rule 13 | done · surfaces test | 2026-09-17 |
| V2 | product page carries the version and what's new | rule 11 | done for 4.24.0 · the page carries the four bar modes by the words of the one list, the shipped combination `⌥⇧A` with its reason and a shot of the surface | 2026-09-17 |
| V3 | commits stay on the wave branch until a release is asked for | wave 9 and 10 boundaries | done · `codex/janitor-4.23`, `codex/menubar-4.24`, then `codex/favorite-top-4.25`, merged and pushed on request | 2026-09-22 |
| T1 | a gesture that moves tabs and bookmarks is checked in a browser, not only against a stub | wave 11, 2026-09-22 | done · `scripts/testbed.sh` starts a second Aside on its own profile, `tests/cdp.mjs` reaches the service worker, `tests/testbed-favorite.mjs` runs the scenario, `tests/testbed-visual.mjs` snapshots the window | 2026-09-22 |
| V4 | the reload of the extension confirms the version | wave 10 | done · reloaded through the browser, `4.24.0`, enabled, no manifest or runtime errors, `toggle-surface` registered as `⌥⇧A` | 2026-09-17 |

## Two open questions of Alex, answered

**Do the number keys belong to the blocks or to the browser?**
They stay with the blocks, and the browser meaning survives as the fallback. The reason is in how the two
are addressed: `⌘1`…`⌘9` in a browser count tab positions, and a position in a window of ninety tabs points at
a different page every few minutes, so the key is a guess. A block is named and holds its number until the
blocks themselves are reordered, so the same key means the same thing tomorrow. Chrome hands a registered
shortcut to the extension for good, so a key cannot be routed per window; the product instead keeps the
browser reading as the fallback. A number with no block behind it selects the tab in that position, `⌘9` the
last one, `⇧⌘` on the next free number opens a block around the current tab, and the whole set goes back to
the browser with one switch in settings (`⌘1…⌘9 address the blocks of the window`).

**What does review tabs do?**
It shows what the window already repeats and why, before anything closes. One list per window: exact copies
of the same address, working threads of one product, stale event pages, research references, and the tabs
that are protected, each row with the reason it is there. The first line carries the summary and the
confirmation, so closing is one explicit press, and every batch leaves a receipt with what closed and what
stayed. That sentence now sits on the surface itself, as the first row of the list, in the command hint of
the palette and on the popup tile, so the name is never the only explanation.
