# Aside Tweaks

![Aside Tweaks – Tab Keeper](docs/tab-keeper.png)

**A review layer for the [Aside](https://aside.com) browser.** Aside Tweaks turns open tabs into named product families, protects work in progress, previews every cleanup batch, and records what stayed and what closed.

The extension also ships a Raycast-shaped palette, a browser-level keymap, Arc-style bookmark and pin gestures, stable tab placement, an optional Obsidian/agent bridge, panel, popup and settings.

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

Review opens with the summary and the confirm line, then the clusters. The first line says what the window holds, the second closes the exact copies and empty tabs of this window, and the third closes them across every window. Nothing closes until one of those lines is pressed, and every confirmed batch writes a local receipt with the canonical URL and closed URLs.

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

Ranking is the same rule in every section: exact matches first, then freshness. Notes carry the reason they are on the list (`name starts with the query`, `query in the name`, `edited today`, `12d`), and a row without a favicon shows a monospace letter avatar instead of a dot.

Useful keys:

| Key | Action |
| --- | --- |
| `⇧⌘K` | open palette |
| `⌥⌘D` | review tabs |
| `⌥⌘T` | review, then tidy the window |
| `⌘D` | bookmark ⇄ tab |
| `⇧⌘D` | pin / unpin |
| `⇥` | change palette scope |
| `⇧↵` | secondary row action |
| `⌘⌫` | close one eligible tab |
| `⌘B` | bookmark source |
| `⌘C` | copy URL, handoff or receipt |
| `⌥⌘C` | copy the row title |
| `⌘1`…`⌘9` | switch to the block with that number |
| `⇧⌘1`…`⇧⌘9` | put the current tab into that block |

The page-level keymap uses physical key codes, so Latin and Cyrillic layouts keep the same bindings. Browser-reserved shortcuts still belong to the operating system or Chromium.

`⌘D` appends the page to the **end** of the bookmarks bar, as Arc appends a pinned row to its section. The tab stays open and keeps the focus, the rows above it do not move, and a second `⌘D` on the same page takes the row out. Closing the tab after `⌘D` is still available as a setting and is off by default since 4.21; with it on, the next unpinned tab becomes active and pinned tabs are used only when no working tab remains. Aside's native **Chats** section and system-owned `⌘W` / `⌘V` behavior are outside the extension API.

### Blocks under the number keys

`⌘1`…`⌘9` switch to the blocks of the window, counted from the left by the position of the block's first tab; a folded block opens. `⇧⌘1`…`⇧⌘9` put the current tab into that block. The palette lists the blocks with their numbers, so a number always has a visible owner. The number keys can be given back to the browser in settings (`⌘1…⌘9 address the blocks of the window`).

### Gestures taken from Arc

- **block from selected tabs** – select several tabs with shift-click or `⌘`-click and run the command; the selection becomes one named block. Arc has the same gesture in its sidebar (multi-select by shift-click, then one group action); it has no lasso rectangle and never had one.
- **fold / unfold blocks** – one command collapses every block of the window or opens them all back, the way Arc keeps `Collapse Pinned` and `Expand Pinned` as commands.
- `⌘D` and `⇧⌘D` leave the focus where it was: Arc removed its rename prompt on pin for the same reason.

## Live mark

The panel and popup header carry the aside voxel character from the AI Mindset apps export. It follows the cursor with a small depth parallax; a click, Enter or Space scatters and reassembles it and steps the red cursor to a neighbouring cell. With Reduce Motion only the cursor moves.

`vendor/aim-voxel.js` and `vendor/aim-voxel-aside.json` are byte-for-byte copies of `sites/apps/assets/aim-voxel.js` and the `aside` model from `sites/apps/assets/voxel-models.json` in `ai-mindset-org/lab-sites`; compare them by SHA-256 before a release. `mark.js` renders the character without inline scripts.

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
```

`tests/sw-smoke.mjs` executes the real service worker against a small Chromium stub. It covers tab placement, protected review, semantic clusters, receipts, grouping proposals, bookmarks, pins, palette handoff, the whole duplicate-cleanup chain from the popup number to the receipt, and the block number keys.

`tests/surfaces.mjs` also guards the class of breakage that 4.20 shipped: a cleanup function that no key and no surface could reach. It fails when a function in the service worker has no caller and no place in the action maps.

## Operator release

1. Confirm the repository is clean before changes and stage only scoped files.
2. Update `manifest.json`, `CHANGELOG.md` and this README.
3. Run syntax and smoke tests.
4. Open `chrome://extensions` and press **Reload** on Aside Tweaks.
5. Verify `chrome-extension://biahbgkjdbjnidodbpekgoigldpmpjpg/options.html` reports the new version and that `⌘D` saves a QA page first, then selects the next unpinned tab.
6. Copy `docs/` into the existing `lab-sites/sites/apps/aside-tweaks/` lane.
7. Run the `lab-sites` preflight, commit only that site path, push `main`, and verify production.

### Migration and rollback

**v4.20 → v4.21:** `⌘D` switches to the Arc contract once, under the `favoriteArcRev` key: `after ⌘D the tab closes` and `the open tab moves to the top` are set to off. Both settings stay in the options page and can be switched back on. Existing bookmarks keep their order; new rows go to the end of the bar. `⌘1…⌘9` start addressing blocks, which can be returned to the browser with the `blockKeys` switch. Review state, keymaps, bridge config and theme settings are untouched.

**v4.19 → v4.20:** the extension gains `vendor/` and `mark.js`; keymaps, bookmarks, bridge config, review state and theme settings remain untouched.

**v4.18 → v4.19:** existing keymaps, bookmarks, bridge config, review state and theme settings remain. New bookmarks created by `⌘D` go to row one; the default close flow selects the next unpinned tab. Existing bookmark order is untouched.

**v4.17 → v4.18:** the old auto-dedupe switch stops applying destructive behavior. Cleanup keys open review.

**Rollback:** check out v4.18 or the previous commit, then press **Reload** on the extension card. Existing bookmarks remain in their current order; v4.18 resumes appending new `⌘D` bookmarks. The review state lives in `chrome.storage.local`; older versions ignore it. The bridge can be rolled back with the repository or removed with `bridge/install.sh --remove`.

## Privacy

Review classification is local. Optional model grouping sends only tab titles and hosts to the configured OpenRouter model and stores the key in local extension storage. It creates a proposal window and never applies groups automatically.

MIT · built by [Alex Povaliaev](https://github.com/aPoWall).
