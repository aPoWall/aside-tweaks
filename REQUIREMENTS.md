# Aside Tweaks · requirements ledger

One row per requirement that reached this product from the AI Mindset apps sprints
(`lab-sites/internal-sites/aim-product-system/SPRINT-2026-09-*.md`, waves 3 to 9) and from the rule book
`AIM-APPS-RULES.md`. Status is what the code and `tests/sw-smoke.mjs` plus `tests/surfaces.mjs` show today.
Wave 9 (`SPRINT-2026-09-17-JANITOR.md` § D) asked for this ledger, for the leftovers to be closed and for
two open questions of Alex to be answered here.

Legend: `done` shipped and asserted by a test · `open` still to do · `exception` declared deviation with a
reason · `blocked` waits for something outside the product.

## Gestures and keys

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| K1 | `⌘D` as in Arc: the bookmark joins the end of the bar, the tab stays open and selected, a second `⌘D` takes it out | wave 6 § D | done · sw-smoke asserts order, focus and the toggle | 2026-09-16 |
| K2 | `⇧⌘D` pins and unpins, the focus stays on the tab | wave 6 § D | done · sw-smoke | 2026-09-16 |
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
| S5 | the voxel character leaves the extension surfaces and stays on the product page | wave 7 § D, rule 39 | done | 2026-09-16 |
| S6 | every control has a consequence, controls without one leave | wave 7 § D, rules 38, 41 | done · surfaces test fails on a static button with no handler | 2026-09-16 |
| S7 | short dash only in every string a person reads | rule 18 | done · surfaces test fails on a long dash | 2026-09-16 |
| S8 | pin on the browser surfaces | rule 31 | exception · a popup cannot survive an outside click and a sidebar stays open until it is closed, so a pin button would be a control without a consequence (rule 38); the slots stay empty and the order holds | 2026-09-16 |

## Release

| id | requirement | source | status | date |
|----|-------------|--------|--------|------|
| V1 | version in `manifest.json` matches the top entry of `CHANGELOG.md` | rule 13 | done · surfaces test | 2026-09-17 |
| V2 | product page carries the version and what's new | rule 11 | done for 4.23.0 | 2026-09-17 |
| V3 | commits stay on the wave branch, nothing is pushed | wave 9 boundaries | done · `codex/janitor-4.23` | 2026-09-17 |

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
