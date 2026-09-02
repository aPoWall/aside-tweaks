# Changelog

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

Check out the required version, reload the unpacked extension, and verify the manifest version on `chrome://extensions`. Rolling back to 4.18 restores append-at-end behavior for future `⌘D` bookmarks; existing bookmark order and review storage remain intact.
