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

Every confirmed batch writes a local receipt with the canonical URL and closed URLs.

### Cleanup contract

- Pinned tabs are protected.
- The active tab is protected.
- Tabs with unsaved form input are protected. Field values never leave the page; the content script reports one boolean flag.
- Bookmarked and user-marked tabs are protected.
- A model may propose groups. Only a person applies them.
- Every destructive batch has a final preview.
- Semantic siblings never join an automatic close batch.
- The last tab of a window stays open.

The legacy `auto-dedupe` preference is ignored from v4.18 onward. A newly opened duplicate receives a quiet notice and remains open.

## Palette – ⇧⌘K

The palette searches tabs, history, bookmarks, Obsidian notes, Aside menu items and Orca agents. `⌘K` opens actions for the selected row.

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

The page-level keymap uses physical key codes, so Latin and Cyrillic layouts keep the same bindings. Browser-reserved shortcuts still belong to the operating system or Chromium.

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

`tests/sw-smoke.mjs` executes the real service worker against a small Chromium stub. It covers tab placement, protected review, semantic clusters, receipts, grouping proposals, bookmarks, pins and palette handoff.

## Operator release

1. Confirm the repository is clean before changes and stage only scoped files.
2. Update `manifest.json`, `CHANGELOG.md` and this README.
3. Run syntax and smoke tests.
4. Open `chrome://extensions` and press **Reload** on Aside Tweaks.
5. Verify `chrome-extension://biahbgkjdbjnidodbpekgoigldpmpjpg/options.html` reports the new version.
6. Copy `docs/` into the existing `lab-sites/sites/apps/aside-tweaks/` lane.
7. Run the `lab-sites` preflight, commit only that site path, push `main`, and verify production.

### Migration and rollback

**v4.17 → v4.18:** existing keymaps, bookmarks, bridge config and theme settings remain. The old auto-dedupe switch stops applying destructive behavior. Cleanup keys open review.

**Rollback:** check out the previous commit or tag, then press **Reload** on the extension card. The review state lives in `chrome.storage.local`; older versions ignore it. The bridge can be rolled back with the repository or removed with `bridge/install.sh --remove`.

## Privacy

Review classification is local. Optional model grouping sends only tab titles and hosts to the configured OpenRouter model and stores the key in local extension storage. It creates a proposal window and never applies groups automatically.

MIT · built by [Alex Povaliaev](https://github.com/aPoWall).
