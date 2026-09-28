# Aside Tweaks

![Aside Tweaks – Tab Keeper](docs/tab-keeper.png)

**A review layer for the [Aside](https://aside.com) browser.** Aside Tweaks turns open tabs into named product families, protects work in progress, previews every cleanup batch, and records what stayed and what closed.

The extension also ships a Raycast-shaped palette, a browser-level keymap, Arc-style keep and pin gestures, stable tab placement, a local smart history, an optional Obsidian/agent bridge, panel, popup and settings.

[Product page](https://apps.aimindset.org/aside-tweaks/) · [Source](https://github.com/aPoWall/aside-tweaks)

## Product identity

**Aside Tweaks** is the canonical product name, repository and extension package. **Aside X** was a working label for the broader idea; there is no separate source product to maintain or install.

| Surface | Canonical source |
| --- | --- |
| Extension | repository root |
| Local desk bridge | `bridge/` in this repository |
| Product page | `docs/index.html` |
| Public deployment | `ai-mindset-org/lab-sites/sites/apps/aside-tweaks/` |

The `lab-sites` worktrees are deployment or review copies. They do not own product code.

## Install

```bash
git clone https://github.com/aPoWall/aside-tweaks.git
```

In Aside:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Press **Load unpacked** and select this repository.
4. Open `chrome://extensions/shortcuts` and give `save / remove from Bookmarks` the key `⌘D`. On a fresh profile the browser keeps `⌘D` for its own **Bookmark This Tab…** and leaves the suggested key unassigned; the page keymap still catches `⌘D` on ordinary pages, and the manual binding covers the browser's own pages. Settings show the empty field as `–`.

Chromium 114+ and Manifest V3 are required.

Optional desk bridge:

```bash
bridge/install.sh
bridge/install.sh --remove
```

The bridge listens on `127.0.0.1:49321` by default. Its config lives at `~/.config/aside-tweaks/desk.json`.

## Review tabs – ⌥⌘D

Review separates four different decisions:

- **exact duplicates** – one normalized address, or one meaningful title on the same site;
- **related products** – pages that belong to one working thread across apps, previews and source systems;
- **stale / event pages** – time-bound or long-untouched tabs;
- **research references** – source material that can be bookmarked and carried into a handoff.

For each product family you can:

- rename the cluster;
- choose one canonical tab;
- bookmark a source;
- protect or unprotect a page;
- close one eligible tab;
- preview a batch that closes reviewed siblings;
- copy a handoff with the canonical page and every source.

Review opens as an inspection screen. Its first row says **nothing closes on this screen**; clusters then expose keep, source, protect and inspect actions. A destructive row always opens one more preview that lists `will close` and `stays` before it runs. Every confirmed batch writes a local receipt with the canonical URL and closed URLs.

Duplicate cleanup is the same executor everywhere: `⌥⌘D` and the popup tile show the number that the confirmation will actually close, with the same protections applied.

### Cleanup contract

- Pinned tabs are protected.
- The active tab is protected.
- Tabs with unsaved form input are protected. Field values never leave the page; the content script reports one boolean flag.
- User-marked tabs are protected.
- A bookmarked page is protected everywhere except inside an exact-duplicate cluster: the bar row holds the address, not each of its copies, and treating it as protection kept every copy of a bookmarked page open.
- A related cluster wider than 8 tabs offers no batch at all; its rows close one by one.
- A model may propose groups. Only a person applies them.
- Every destructive batch has a final preview.
- Semantic siblings never join an automatic close batch.
- The last tab of a window stays open.

The legacy `auto-dedupe` preference is ignored from v4.18 onward. A newly opened duplicate receives a quiet notice and remains open.

## Palette – ⇧⌘K

The palette searches tabs, history, bookmarks, Obsidian notes, Aside menu items and Orca agents. `⌘K` opens actions for the selected row, and the panel has the same shape on every row type: the row's own actions first, then `⌘C` copy address or path and `⌥⌘C` copy title.

Ranking is the same rule in every section: exact matches first, then freshness. Notes come from the two configured local Obsidian vaults through the loopback desk bridge. An empty Notes scope names its source as `edited today`, `last modified on disk` or `last opened in Obsidian`; a query searches file names and folders only. Note contents never enter the palette. A row without a favicon shows a monospace letter avatar instead of a dot.

Useful keys:

| Key | Action |
| --- | --- |
| `⌥⇧A` | open or close the surface of the product |
| `⇧⌘K` | open palette |
| `⌥⌘D` | review tab families; nothing closes yet |
| `⌥⌘T` | review, then tidy the window |
| `⌘D` | save / remove the active page in the last Bookmarks row |
| `⇧⌘D` | pin / unpin the square at the top |
| `⇥` | change palette scope |
| `⇧↵` | secondary row action |
| `⌘⌫` | close one eligible tab |
| `⌘B` | save/remove the selected palette tab, or bookmark a review source |
| `⌘C` | copy URL, handoff or receipt |
| `⌥⌘C` | copy the row title |
| `⌘1`…`⌘9` | switch to the block with that number |
| `⇧⌘1`…`⇧⌘9` | put the current tab into that block |

The page-level keymap uses physical key codes, so Latin and Cyrillic layouts keep the same bindings. Browser-reserved shortcuts still belong to the operating system or Chromium.

### Family keys – declared exception to rule 37

AIM apps rule 37 fixes `⌘K` as the palette key for the whole family. In a browser `⌘K` belongs to the pages: Linear, Slack and GitHub open their own palette on it, and the page keymap of this product listens in the capture phase, so a palette on `⌘K` would take the key from every site. Aside Tweaks therefore declares one exception: the palette opens on `⇧⌘K`, and `⌘K` keeps the single meaning of «actions for the selected row» inside the palette. Rechecked on 2026-09-27 against Aside 1.0.922.1 on Chromium 153.0.8010.53: the browser itself no longer holds `⌘K` (no menu item, and an extension command on `Command+K` registers), so the reason is the pages and the second meaning inside the palette. The exception is printed on the product page (feature 02) and in the palette itself. Every other family key keeps its family meaning: `esc` closes, digits switch blocks, `⌘D` saves a page in Bookmarks.

`⌘D` appends the active page to the **last native Bookmarks row**. If the page sits inside a tab group, the extension takes it out so Aside can fold the live page into that one saved row; the page remains selected. A second `⌘D` removes the bookmark and returns the page to Tabs. `⇧⌘D` separately owns the Pin square at the top. Existing 4.28 keep-on-top switches stay available as compatibility settings, but 4.30 turns them off once. Aside's native **Chats** section and system-owned `⌘W` / `⌘V` behavior are outside the extension API.

### Panel: active page, categories and smart history

The active row is labelled and centred after a tab switch, window focus, panel reveal or sidebar reopen. The panel reads the last 14 Bookmarks rows in their native order, matching the place where `⌘D` appends a new one. Bookmarks and Pins are separate sections with explicit labels; repeated sites become one category and isolated sites stay in one compact `other` group.

Smart history shows at most six local pages. It excludes URLs that are already open or bookmarked and ranks the rest from Chromium visit data plus the same decaying choice score used by the palette. Opening a history row strengthens that local score. Nothing is sent to a server.

### Blocks under the number keys

`⌘1`…`⌘9` switch to the blocks of the window, counted from the left by the position of the block's first tab; a folded block opens. A number with no block behind it keeps the meaning it has in the browser and selects the tab in that position, `⌘9` the last one, so the key works in a window that has no blocks yet. `⇧⌘1`…`⇧⌘9` put the current tab into that block, and the next free number opens a new block around it. The palette lists the blocks with their numbers, so a number always has a visible owner. The number keys can be given back to the browser in settings (`⌘1…⌘9 address the blocks of the window`).

### Gestures taken from Arc

- **block from selected tabs** – select several tabs with shift-click or `⌘`-click and run the command; the selection becomes one named block. Arc has the same gesture in its sidebar (multi-select by shift-click, then one group action); it has no lasso rectangle and never had one.
- **fold / unfold blocks** – one command collapses every block of the window or opens them all back, the way Arc keeps `Collapse Pinned` and `Expand Pinned` as commands.
- `⌘D` and `⇧⌘D` leave the focus where it was: Arc removed its rename prompt on pin for the same reason.

## Shell and product mark

Aside Tweaks is the fourth product of the AI Mindset apps system (rule 36), and since 4.22 its browser surfaces are assembled from the same L2 shell as the three native apps.

| Surface | Header | Bottom line | Close |
| --- | --- | --- | --- |
| popup | character 40 · name · state · version · `settings` | keys · `esc close` · tab count | the browser closes the popup |
| panel | character 40 · name · state · version · `settings` · `×` | keys · `esc close` · version | `×`, `esc`, `⌘W` reach one `closePanel()` |
| palette | search field, the palette's own contract | mark · primary action · `actions ⌘K` | `esc`, outside click |

Rule 32 keeps the order of the right edge and leaves an empty slot where the surface owns nothing. The popup carries no `pin`, because a browser popup cannot survive an outside click, and no `×`, because the browser owns its frame and closes it on its own. The panel carries no `pin` either: a sidebar stays open until it is closed, so there is no outside click to survive; it keeps `×` and `esc`. No browser surface of the product has a pin button, and a later wave that adds one adds a control without a consequence (rules 38, 41).

The mark comes from one source. `icons/mark.svg` is the `aside` glyph of `vendor/aim-app-marks.svg` on a white plate, `icons/16 · 32 · 48 · 128.png` are rendered from it, and the header draws the same symbol through `vendor/aim-app-mark.js`. The toolbar button, the settings page, the palette line and the favicons are the same picture (rule 39). Since 4.24 the header of the popup and the panel draws the voxel character instead (rule 48): 40 px, assembled in 700 ms with the finished figure as the first frame, lifting under the cursor and stepping its red cursor on a click, with reduced motion keeping the gesture alone.

### The menu bar contract in a browser (rule 47)

The toolbar button is this product's menu bar item. One click opens the surface, the next click closes it, and `⌥⇧A` does the same from any window. The mode of the button is one list in settings card `00 menu bar`, with a live preview of the button next to it:

| Mode | What the button draws |
| --- | --- |
| `mark` | the product mark alone, the default |
| `mark + value` | the mark with the tab count of this window in the badge |
| `value` | the count drawn as the button, a white plate with the red signal in its corner |
| `hidden` | an empty square, chosen through a confirmation |

`hidden` is a declared exception. Chrome gives an extension no way to remove its own button from the toolbar, so the mode empties the drawing and the button title says the square is unpinned by hand from its own menu and that the surface still opens with the combination. The count follows tab creation, closing, a move between windows and window focus; nothing polls on a timer.

### One combination, and where ⌥⌘A went

The family default of rule 49 is `⌥⌘A`. Chromium refuses that combination for an extension command at manifest load: `Invalid value for 'commands[8].mac': Alt+Command+A`, and the extension is disabled until it is changed. The shipped default is therefore `⌥⇧A`. The product never prints a combination from its own manifest: `shell.js` fills `[data-aim-key]` and the service worker builds the button title from `chrome.commands.getAll()`, so setting `⌥⌘A` by hand on `chrome://extensions/shortcuts` moves every line of the product onto it, and a combination the browser refuses to register comes back empty, turns the settings row red and is never stored.

The command is `toggle-surface`. It opens the popup through `chrome.action.openPopup()` and falls back to the side panel where that route is missing; each surface holds a port while it lives, so the same key closes what is open. Chrome allows four suggested keys per extension, so `open-panel` kept its command and any custom binding a person already set, and gave up its suggested `⌃⇧S`.

### Vendored shared files

| File | Source in `ai-mindset-org/lab-sites` |
| --- | --- |
| `vendor/aim-mini-apps.css` | `sites/apps/assets/aim-mini-apps.css` |
| `vendor/aim-app-shell.css` | `sites/apps/assets/aim-app-shell.css` |
| `vendor/aim-app-mark.js` | `sites/apps/assets/aim-app-mark.js` |
| `vendor/aim-app-marks.svg` | `sites/apps/assets/aim-app-marks.svg` |
| `vendor/aim-voxel.js` | `sites/apps/assets/aim-voxel.js` |
| `vendor/aim-voxel-models.json` | `sites/apps/assets/voxel-models.json` |

Byte-for-byte copies, no hand edit inside them (rule 10). The judge is `sites/apps/assets/aim-mini-apps.receipt.json`; Aside Tweaks is registered in `internal-sites/aim-product-system/vendored-consumers.json`, and `node internal-sites/aim-product-system/check.mjs` fails on any drift. The two voxel files of 4.24 are not in that registry yet, so `tests/surfaces.mjs` carries their sha-256 and compares the copy both with the recorded digest and with the live export when `lab-sites` is checked out next to the repository. `shell.js` is the product side: it installs the mark sprite, stamps `[data-aim-version]` from the manifest and holds the shared `say()` of the bottom line.

### Face, declared exception to rule 2

The shared shell reads its face from `--aim-s-font`. The extension keeps the system face of the Aside sidebar there and bridges the token in `instrument.css`, next to the colour tokens, so the header stands on the same field as the rows under it. Geometry, grid, control sizes and the red signal stay the shared ones.

## Desk bridge

`bridge/desk.py` is a standard-library Python service with a narrow local gate. It can:

- index configured Obsidian vault filenames and recent files;
- open a note through Obsidian;
- list and switch Orca terminals;
- start an agent only in configured folders;
- read and select Aside menu items through Hammerspoon.

The extension sends only the configured request to the loopback service. Page content, cookies and form values are outside the bridge protocol.

Health check:

```bash
curl -H 'X-Aside-Tweaks: desk' http://127.0.0.1:49321/health
```

## Development

No package install is required.

```bash
node --check background.js
node --check palette.js
node tests/surfaces.mjs
node tests/sw-smoke.mjs
node ~/repos/lab-sites/internal-sites/aim-product-system/check.mjs   # vendored copies, SHA-256
```

### Testbed – a second Aside of its own

Gestures that move tabs and bookmarks cannot be checked in the working window: the test
rearranges the pages and the bar of the person sitting at the machine. The testbed starts a
second Aside on its own profile, with its own bookmarks bar and a debugging port, and the
main window is never touched.

```bash
scripts/testbed.sh up            # headless, nothing appears on screen
node tests/testbed-favorite.mjs  # ⌘D and ⇧⌘D against the real service worker
scripts/testbed.sh down
scripts/testbed.sh fresh         # wipe the profile of the testbed
```

`tests/cdp.mjs` is the DevTools Protocol client: it finds the service worker of the
extension, confirms it by the manifest name – Aside ships built-in extensions with the same
`background.js` path – and evaluates code inside it, so the scenario calls the same `ACTIONS`
map a key press calls. Two traps are worth knowing. The worker sleeps and disappears from the
target list, so the client opens a page of the extension to wake it. And the worker script
lives in the cache of the profile: it survives a browser restart, `chrome.runtime.reload()`
throws out an extension loaded with `--load-extension`, so `testbed.sh up` clears
`Default/Service Worker` and the browser reads the edited file from disk.

`node tests/testbed-visual.mjs` against `scripts/testbed.sh up --visible` writes window
snapshots to `/tmp/aside-testbed-*.png` through Hammerspoon – the sidebar of Aside is native
and no API shows it. The snapshot needs the window raised on the current desktop.

`tests/sw-smoke.mjs` executes the real service worker against a small Chromium stub. It covers tab placement, protected review, semantic clusters, receipts, grouping proposals, bookmarks, pins, palette handoff, the whole duplicate-cleanup chain from the popup number to the receipt, and the block number keys.

`tests/surfaces.mjs` also guards the class of breakage that 4.20 shipped: a cleanup function that no key and no surface could reach. It fails when a function in the service worker has no caller and no place in the action maps, when a static button of a surface has no handler (rule 38), when a surface stops taking the shared shell, when the extension icon drifts from the mark glyph, and when a long dash appears in a text.

## Operator release

1. Confirm the repository is clean before changes and stage only scoped files.
2. Update `manifest.json`, `CHANGELOG.md` and this README.
3. Run syntax and smoke tests.
4. Open `chrome://extensions` and press **Reload** on Aside Tweaks.
5. Verify `chrome-extension://biahbgkjdbjnidodbpekgoigldpmpjpg/options.html` reports the new version and that `⌘D` on a QA page appends one row at the bottom of Bookmarks, does not create a Pin square and keeps the page selected.
6. Copy `docs/` into the existing `lab-sites/sites/apps/aside-tweaks/` lane.
7. Run the `lab-sites` preflight, commit only that site path, push `main`, and verify production.

### Migration and rollback

**v4.29 → v4.30:** `favoriteBookmarkFoldRev` turns on `show the live page in the Bookmarks row` once. Direct upgrades from 4.28 also run the 4.29 split: `favoriteMovesTab`, `favoriteRowTop` and `favoritePins` become off, while `favoriteLeavesGroup` becomes on. Existing bookmark and pin order, keymaps, review state, receipts, bridge config and theme settings stay intact. Rolling back to 4.29 keeps every bookmark and pin; turn off `⌘D takes the tab out of its block` if you want the 4.29 grouped-tab behavior.

**v4.28 → v4.29:** `favoriteBookmarkTailRev` separates bookmark from Pin once: the Bookmarks row appends at the end, tab movement and Pin on `⌘D` turn off, and `⇧⌘D` keeps Pin. Existing bookmark and pin order stays intact.

**v4.27 → v4.28:** `⌘D` pins again, once, under the `favoriteRepinRev` key: `⌘D also pins the page into the squares on top` is set to on and remains a switch. Existing bookmarks and pins keep their current order. Keymaps, review state, receipts, bridge config and theme settings are untouched. Rolling back to 4.27 keeps the migration keys; 4.27 does not remove existing pins, and its setting can be changed by hand.

**v4.26 → v4.27:** `⌘D` stops pinning, once, under the `favoriteUnpinRev` key: `⌘D also pins the page into the squares on top` is set to off and stays a switch. Pages pinned by 4.26 keep their squares – unpin them with `⇧⌘D` or from the panel. Bookmarks, keymaps, review state, receipts, bridge config and theme settings are untouched.

**v4.25 → v4.26:** `⌘D` starts pinning the page, once, under the `favoritePinRev` key: `⌘D pins the page into the squares on top` is set to on and stays a switch in the options page. Existing bookmarks, pins, keymaps, review state, receipts, bridge config and theme settings are untouched. `tidy up` and `remove duplicates` become working commands instead of doors into review – both keep every protection and write a receipt, and `review tabs` still opens the review surface.

**v4.24 → v4.25:** `⌘D` moves to the pin contract once, under the `favoriteTopRev` key: `the open tab rises to the first row` and `the new row goes first in the bookmarks bar` are set to on. Both stay in the options page and switch back to the 4.21 behaviour. Existing bookmarks keep their order; only new rows go to the top. Keymaps, review state, receipts, bridge config and theme settings are untouched.

**v4.21 → v4.22:** no stored value changes. Keymaps, bookmarks, review state, receipts, bridge config and theme settings stay as they are. The voxel character disappears from the panel and popup header and is replaced by the product mark; the popup loses the `settings ↗` link, which is now the `settings` button in the header. The extension icon changes to the product mark, so the toolbar button looks different after the reload.

**v4.20 → v4.21:** `⌘D` switches to the Arc contract once, under the `favoriteArcRev` key: `after ⌘D the tab closes` and `the open tab moves to the top` are set to off. Both settings stay in the options page and can be switched back on. Existing bookmarks keep their order; new rows go to the end of the bar. `⌘1…⌘9` start addressing blocks, which can be returned to the browser with the `blockKeys` switch. Review state, keymaps, bridge config and theme settings are untouched.

**v4.19 → v4.20:** the extension gains `vendor/` and `mark.js`; keymaps, bookmarks, bridge config, review state and theme settings remain untouched.

**v4.18 → v4.19:** existing keymaps, bookmarks, bridge config, review state and theme settings remain. New bookmarks created by `⌘D` go to row one; the default close flow selects the next unpinned tab. Existing bookmark order is untouched.

**v4.17 → v4.18:** the old auto-dedupe switch stops applying destructive behavior. Cleanup keys open review.

**Rollback:** check out v4.18 or the previous commit, then press **Reload** on the extension card. Existing bookmarks remain in their current order; v4.18 resumes appending new `⌘D` bookmarks. The review state lives in `chrome.storage.local`; older versions ignore it. The bridge can be rolled back with the repository or removed with `bridge/install.sh --remove`.

## Privacy

Review classification is local. Optional model grouping sends only tab titles and hosts to the configured OpenRouter model and stores the key in local extension storage. It creates a proposal window and never applies groups automatically.

MIT · built by [Alex Povaliaev](https://github.com/aPoWall).
