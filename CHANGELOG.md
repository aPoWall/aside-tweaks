# Changelog

## 4.22.0 – 2026-09-16

- one shell for every surface: the popup, the panel and the palette take the header, the bottom line and the product mark from the shared L2 export of AI Mindset apps. `vendor/aim-app-shell.css`, `vendor/aim-app-mark.js`, `vendor/aim-app-marks.svg` and `vendor/aim-mini-apps.css` are vendored byte for byte and verified by sha-256 through `vendored-consumers.json` of the apps system (rules 10, 34, 40);
- header, one order everywhere: mark 40 px, product name, the state line under the name, version, `settings`; the panel adds `×`. A slot the surface does not own stays empty and the order holds (rule 32): a browser popup cannot survive an outside click and cannot be pinned, and the browser owns the popup frame;
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
