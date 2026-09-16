# Changelog

## 4.21.0 – 2026-09-16

- `⌘D` follows Arc: the bookmark joins the end of the bar, the rows above it keep their places, the tab stays open and selected, and a second `⌘D` takes the row out. Closing the tab remains a setting and is off by default (one-time migration under `favoriteArcRev`);
- `⇧⌘D` keeps the focus on the tab after pinning and unpinning;
- fixed duplicate cleanup: `applyDuplicateCleanup` had no caller since the tidy path was rewritten, so no key and no surface could reach it. Cleanup now runs from the review confirmation, covers every window, and writes a receipt; the popup tile shows the number that confirmation will close;
- a bookmarked page no longer protects each of its own copies inside an exact-duplicate cluster; on a 92-tab window this moved the offer from 24 to 32 tabs that really close;
- review opens with the summary and the confirm line instead of hiding them below a hundred rows, and a related cluster wider than 8 tabs offers no batch at all;
- related clusters stop growing through one common word that half the window shares;
- review asks each page about unsaved input with a 200 ms limit and skips sleeping tabs, so one hung content script no longer delays the whole list;
- `⌘1`…`⌘9` address the blocks of the window and `⇧⌘1`…`⇧⌘9` put the current tab into a block; the palette lists what each number holds, and the keys can be given back to the browser in settings;
- added `block from selected tabs`, the Arc multi-select gesture: shift-click or `⌘`-click several tabs, then one command turns the selection into one named block;
- added `fold / unfold blocks`, the Arc collapse-pinned gesture as one command;
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
