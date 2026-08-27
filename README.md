# Aside Tweaks

![aside tweaks — instrument 01, tab surgery](docs/banner.png)

A small extension for the [Aside](https://aside.com) browser: a command palette built like
Raycast over tabs, history, bookmarks, Obsidian notes and agents, a keymap that sits **above** the
browser's own shortcuts, Arc-style pins, duplicate cleanup that also sees twins by title, and tab
placement that actually holds.

Built by [Alex Povaliaev](https://github.com/aPoWall) for daily use, kept in the open.

## Why it exists

Aside is a Chromium browser with an AI agent bolted into the sidebar, and the parts it inherits
from Chromium behave like Chromium: new tabs land at the top of the list, `⌘D` opens a bookmark
dialog nobody asked for, duplicates pile up, empty new tabs accumulate, and there is no way to
re-bind any of it from inside the browser.

Three things follow from that, and each one is a feature here.

**A tab list is not a filing cabinet.** Arc taught a generation of users that the page you keep
belongs *above* the churn — one keystroke moves it up and it stops competing with the twenty tabs
you opened this hour. Chromium's pin does half of that; it keeps the tab alive in the strip but
never lets it leave the tree. So `⌘D` here writes the page into the bookmarks bar as its last row,
takes the tab out of its block and lets Aside's sidebar fold the two into one live row on top —
without closing anything. Closing would wake a sleeping neighbour, that neighbour reloads, and the
whole gesture reads as «the browser took me somewhere». Press `⌘D` again on the same page: the
bookmark goes and the tab is back in the list, at the very top.

**Shortcuts should belong to the person, not to the vendor.** Chromium lets an extension declare
four shortcuts and re-bind them only on its own settings page. This extension listens in the
capture phase on the page instead, which arrives *before* the browser applies its accelerator —
so any combo the page can see becomes bindable, `⌘D` and `⌘⇧D` included. Combos are stored by
physical key code, so switching to a non-Latin layout doesn't silently break them.

**Search beats navigation.** With fifty tabs open, hunting the sidebar is slower than typing.
The palette opens on the tabs you were in last, ranks a query by what you actually pick — frequency
with a two-week decay — collapses history by normalised url so one site can't flood the list, and
switches to a page that is already open instead of opening it twice. Since v4.15 it also reaches
past the browser: the notes you had open in Obsidian and the agents running in Orca, through a
small local bridge (below).

Everything else is repair work: a placement guard that holds a new tab under the current one while
the browser re-orders it, cleanup that also collects the empty new tabs, groups that open expanded
instead of collapsed.

## Install

```bash
git clone https://github.com/aPoWall/aside-tweaks.git
```

`chrome://extensions` → enable Developer mode → **Load unpacked** → pick the folder.
Chromium 114+ (Aside is built on 151), Manifest V3.

Optional, for notes and agents in the palette — the desk bridge, a LaunchAgent on macOS:

```bash
bridge/install.sh        # writes ~/.config/aside-tweaks/desk.json on first run — edit it, run again
bridge/install.sh --remove
```

## What it does

**Palette — ⇧⌘K.** A layer over the page, not a second window: the page behind it darkens and
blurs, the palette casts a large shadow, and there is no title bar and no traffic lights to
mistake it for something you have to manage. It is an extension document inside a shadow-root
frame, so it keeps full access to tabs, history and bookmarks while it sits on the page. Where no
page exists — `chrome://`, a new tab, Aside's own interface — or where the site's security policy
refuses foreign frames, it falls back to a centred window automatically. `⇥` switches scope:
`all · tabs · history · bookmarks · notes · commands`.

The shape is Raycast's: a row is icon · title · subtitle · **type** on the right (`tab`, `asleep`,
`history`, `bookmark`, `note`, `command`, `terminal`), the footer names the primary action for the
selected row (`switch ↵`, `open ↵`, `run ↵`), and **`⌘K` opens the actions panel** for that row —
switch, pin, `bookmark ⇄ tab`, close tab, copy url for a tab; open, open pinned, open in a block,
copy url for a bookmark or a history row. The keys printed in the panel work without opening it:
`⇧↵` `⌘⌫` `⌘B` `⌘C`. `esc` clears the query first and closes only when it is empty.

- an empty query shows **recent** — the open tabs in the order you were in them, the way `⌃⇥`
  cycles in Arc; the page you are on sits last, since that is the one you are switching *from*
- a query ranks title starts above word starts above substrings, then by pick frequency with a
  two-week decay, `n · e^(−days/14)`
- history collapses by normalised url (utm stripped), so one site stops eating the whole list;
  pages that are already open are left to the tabs section
- a bookmark or a history row whose page is open says `switch ↵` and goes to that tab; a pasted
  address that is open becomes `Switch to …` — nothing opens twice
- a tab that is open more than once carries `×2` — counted by the background with the same rule
  as the cleanup, so twins by title show it too; *clean duplicates* shows what it would close
  right now, counted live
- `> prompt` is agent mode: the live Orca terminals to switch to, and `run in <folder>` rows that
  start a new agent with that prompt — needs the desk bridge
- paste a url and you get `Open`, `Open in block · <name>`, `Open pinned`
- `⇧↵` is the row's second action: pin the tab, or open the address already pinned
- arithmetic in the input (`2+2`, `(19*3)/2`), `↵` copies the result
- the list is built once per query; arrows and the mouse only move the selection, so nothing
  re-animates while you type — the rows fade in on the first paint and stay put after that

**Two looks.** The default is lifted from Aside's own sidebar: the same grey field (`#ececec`),
a white pill with a hairline shadow on the selected row, section labels in `#6f6f6f`, the system
font, light by default. Chosen so the palette reads as part of the browser rather than a visitor.
The older **paper** look — warm sheet, monospace lowercase, accent tint — stays in settings card 06.
Both drive every surface here: palette, popup, settings, panel. The sidebar itself is native chrome
and stays whatever Aside paints it.

**Blocks by meaning — opt-in.** A site is a weak signal: fifteen tabs on one `github.com` say nothing
about what you are doing. This hands the **titles and hosts** of the open tabs to a model through
OpenRouter and asks for working blocks. Page contents, cookies and full addresses never leave the
machine, the key lives in local storage and never syncs, and the answer arrives as a **proposal in a
small window** — nothing is regrouped until you press apply. Off until you paste a key in settings
card 07; network access to `openrouter.ai` is an optional permission requested at that moment, not
held in advance.

**Notes and agents — the desk bridge.** A browser extension cannot read a file or start a
process, so `bridge/desk.py` does it on its behalf: a standard-library Python server on
`127.0.0.1:49321` that reads each vault's `.obsidian/workspace.json` — Obsidian's own *recent
files* list — keeps a filename index for search, opens a note through `obsidian://` (Advanced URI
when the vault id is configured, plain `open` otherwise), lists Orca terminals with
`orca terminal list`, switches to one, or creates one with `claude '<prompt>'` in a folder from
the config. The gate is a header only this extension sends: Chromium sends no `Origin` for an
extension's own requests, and a web page cannot add a custom header without a CORS preflight the
bridge refuses. Config: `~/.config/aside-tweaks/desk.json` — vaults, folders an agent may start in,
the agent command. Nothing runs until you install it; without it the palette simply has no `notes`
and `>` answers with a pointer to the settings card.

Notes are drawn from their vault names: `{AIM} {guide} Internal Mini-Deck Standard – 2026-08-27`
reads as **Internal Mini-Deck Standard** with `aim` `guide` badges and the date on the right;
settings card 09 sets how many recent notes an empty query shows (none · 3 · 5 · 8), whether titles
are cleaned, and whether the date is shown.

**From anywhere.** A global key cannot reach an extension — `chrome-extension://` pages do not open
from outside the browser and the service worker sleeps — but it can open a page. The bridge serves
`/aside-tweaks/palette`; `open -a Aside http://127.0.0.1:49321/aside-tweaks/palette` lands as a
tab that carries the extension's content script, and that script asks for the palette. If the page
you came from can host the layer, the signal tab closes and the palette opens there; otherwise the
palette opens on the signal page itself — a grey field, no title bar, no traffic lights — and when
it closes that tab goes and the previous one comes back. `?q=` types a query in advance.
`bridge/raycast/aside-palette.sh` is a Raycast script command (give it a hotkey; its argument is
the query), `bridge/hammerspoon.lua` binds ⌥⌘K.

**One list of commands.** `commands.js` holds every command with its title, short name, glyph,
key, section and one-line explanation; the palette, the panel and the popup render from it. Adding
a command in one place adds it everywhere, and the names cannot drift apart between surfaces.

**Own keymap.** Every action is bindable inside the extension, and the binding wins over the
browser's: keydown reaches the page in the capture phase *before* the browser applies its
accelerator, so `preventDefault()` takes over `⌘D`, `⌘⇧D`, `⌘S`, `⌘P`. Combos are stored by
`event.code`, not `event.key` — a non-Latin keyboard layout doesn't break them.

Defaults: `⌘D` bookmark ⇄ tab · `⇧⌘D` pin · `⌥⌘D` clean up · `⌥⌘T` tidy up.
Native fallbacks: `⌃D` pin, `⌃⇧D` clean, `⌃⇧S` panel, `⇧⌘K` palette.

Two levels hold keys, and only one of them is ours. The page-level keymap above is stored by the
extension and can be rebound freely. The browser-level commands live in `chrome://extensions/shortcuts`;
a manifest can *suggest* them but nothing in the extension can rebind or clear them — which is why a
key that keeps firing an old action is set there, not here. Settings card 01 lists both, the browser's
side read live from `chrome.commands.getAll()`.

**Bookmark ⇄ tab — ⌘D.** The current page becomes the *last* row of the bookmarks bar; the tab
stays open, loaded and active, and moves to the first row of the tabs. Press it again on the same
page and it reverses: the bookmark is removed and the tab stays on top. Nothing is ever closed, so
nothing reloads. No dedicated folder — the bar itself is the destination.

What makes this a pin rather than a bookmark is Aside's sidebar: its bookmarks section shows the
bar, and an **open tab whose address matches a bookmark is folded into that row** — one line, live,
asleep with `💤` when discarded, gone from the tabs list below. That is Arc's pinned tab, built from
a bookmark and a tab. The fold only happens for a tab outside any block; inside one the page would
show twice, in the bar and in the block. So `⌘D` takes the tab out of its block first (settings
card 02, on by default), and writes the address exactly as the tab has it, because the sidebar
matches literally.

**Pins, Arc-style.** A pin moves the tab into the squares on top of the sidebar. Closing a pinned
tab brings the pin back asleep instead of dropping it; to remove it, unpin first. A pin is not a
bookmark — bookmarking is a separate action that writes to the bookmarks bar with no dialog and
toggles off on a second call.

**Cleanup.** Two copies are the same page when they differ only by `http`/`https`, `www.`, a
default port, `index.html`, a trailing slash, tracking params or the `#anchor` — the key is shared
by dedupe, the palette's `×2` and the bookmark match. They are also the same page when they share
the **host and the title**: four `AIM VISUAL` tabs on one app with four different query strings
read as one page to the eye, and `0 duplicates` on them was a lie. Titles that say nothing —
`New Tab`, the address itself, anything under four characters — never match; the sidebar's `💤`
marker is stripped before comparing; settings card 04 turns the title rule off. Clusters are built
with union-find, so a tab can join through either key. Of the copies the one you used last is kept
(the active one first, then the most recently accessed, then whichever is awake), the rest close.
The manual command clears every empty new tab as well, leaving a window its last tab so it never
closes itself. Auto-dedupe stays off by default; opening a duplicate shows a note instead.

**Tidy up — ⌥⌘T.** One sweep, four steps, and what is left reads like a desk rather than an index:

1. duplicates and empty tabs close (as above);
2. every group is flattened;
3. **loose tabs go on top, most recent first** — what you touched last is at hand, the way Arc's
   *Today* reads;
4. below them, **blocks** — a block is gathered only from **3 or more** tabs of one rule or one
   site (settings card 04; pairs are not a working area and stay loose), rule blocks in the order
   of the rules, site blocks by their freshest tab, tabs inside each block by recency.

Pages that sit in the bookmarks bar never enter a block: left loose, the sidebar folds them into
their bookmark row (see `⌘D`) and they leave the tabs list altogether. Pinned squares are untouched.

**Placement.** New tabs open under the current one. Aside re-orders a fresh tab *after* it is
created, so a guard keeps putting it back until it stops drifting (window configurable, 2.5 s by
default). Other modes: at the end of the list, or leave it to the browser.

**Panel — ⌃⇧S.** Own side panel via `chrome.sidePanel`, four numbered sections: the top of the
bookmarks bar, pinned tabs, the rest grouped by blocks, commands. Rows carry three actions on hover — move up to
favorites, pin, close — and drag reorders the window.

**Blocks.** A block is a name plus substrings. Blocks drive tab grouping, the palette's
«open in block» and the panel's sections. Groups are created expanded.

## The behaviour contract

Written down because these were asked for one by one and each is easy to break by accident.

| Gesture | What must happen |
|---|---|
| `⌘D` on a fresh page | bookmark appended as the **last** row of the bar, url written verbatim; the tab leaves its block, stays open, loaded, **selected**, and moves to the **first row of the tabs** — the sidebar then folds it into the bookmark row |
| `⌘D` again on the same page | bookmark removed; the tab stays at the first row, still selected |
| either direction | the page always ends up **at the top**, never at the bottom — the sidebar scrolls up to it, the way pinning already behaves |
| `⇧⌘D` on an ordinary tab | pinned into the squares on top of the sidebar |
| `⇧⌘D` on a pinned tab | unpinned **and** moved to the first row of the tabs, and it stays the selected tab |
| any of the above | nothing is ever closed, so no sleeping neighbour wakes up and reloads |
| a tab inside a group | `⌘D` takes it out (so the sidebar can fold it in); `⇧⌘D` and the panel leave blocks alone |
| opening an address that is already open | the palette, a bookmark row, a pasted url — all **switch** to the open tab; no second copy |
| `⌥⌘T` | closes duplicates and empties, keeps the copy used last, puts loose tabs on top by recency, gathers blocks only from ≥3 tabs, never groups a page that lives in the bookmarks bar |
| the palette | opens on recent tabs, current one last; typing never re-animates the list; `⌘K` lists the row's actions, `esc` clears before it closes |
| duplicates | by normalised address **or** by host + title; the copy used last survives; the count in the popup, the palette's `×N` and the cleanup agree because one function computes all three |
| the desk bridge | listens on `127.0.0.1` only, answers only to the extension's header, opens only files inside a configured vault, starts an agent only in a configured folder |
| the signal page | never stays: closed at once when the previous page hosts the layer, closed on palette exit otherwise; a switch made from the palette wins over the return to the previous tab |
| the same key from two levels | a repeat within 450 ms is swallowed, so a page-level and a browser-level binding on one combo cannot toggle twice |
| opening a duplicate | a note on the page, nothing closed — cleaning is a command you run |
| ordering / grouping | always acts on the last **normal** window, even when the palette window was focused last |
| every command | present in the palette, the panel and the popup with the same name, from one list |
| the model | proposes, never applies — and only sees titles and hosts |

## Tests

```bash
node tests/sw-smoke.mjs
```

The service worker is loaded into a stubbed `chrome` and driven the way the popup drives it:
placement of a fresh tab under the active one, the tidy sweep (recency order, a block only from
three tabs, a bookmarked page kept loose), duplicate detection through `www.` and a trailing slash
with the freshest copy kept, twins by title (four `AIM VISUAL` tabs with different queries → three
closed, the active one kept; `New Tab` and different titles on one host never match; the rule off
→ exact address only), pin and unpin, the bookmark toggle in both directions including the exit
from a block, switching to an open copy instead of opening it twice, the repeat guard, and
ordering while a popup window was the last focused one. It exists because a silent `ReferenceError`
at load makes every feature look broken at once — the worker dies, nothing registers, and the UI
just stops answering.

`node tests/surfaces.mjs` checks that every command exists on every surface it claims, and that
the popup, the panel and the palette all render from `commands.js`.

Reloading after a change without touching `chrome://extensions`: open any page of the extension
(`chrome-extension://<id>/popup.html`) and run `chrome.runtime.reload()` from its console — the
service worker and the manifest come back fresh.

## Limits worth knowing

**Aside's own `✦ Tidy` cannot be triggered from here.** It is a button in the browser's native
sidebar: no menu command, no URL scheme (`Info.plist` registers only http, https and file), and
the window reports **zero elements** to macOS Accessibility, so there is nothing to click by
script either. `⌥⌘T` is our own sweep — deterministic, four steps, one report.

**The layer covers the page, not the browser.** A page-level overlay cannot darken the sidebar or
the toolbar; no extension can draw over browser chrome. What it can do is own the page area
completely, which is what makes it read as a field rather than a window.

**`⌘T ⌘W ⌘N ⌘Q ⌘M ⇧⌘W` cannot be taken over by any extension** — the browser consumes them before
the page exists. On `chrome://` pages, the new tab and inside Aside's own interface there is no page
at all, so only native shortcuts fire there. Every extension that promises custom shortcuts
(Shortkeys included) has exactly this ceiling.

The layer above is macOS itself: menu commands can be re-bound per app, which is what
System Settings → Keyboard → Keyboard Shortcuts → App Shortcuts does. To free `⌘D` from the native
bookmark dialog:

```bash
defaults write at.studio.AsideBrowser NSUserKeyEquivalents \
  -dict-add "Bookmark This Tab…" "^@b"
```

Restart the browser afterwards; `@` is ⌘, `^` is ⌃, `~` is ⌥, `$` is ⇧. The two that matter for
this extension:

```bash
defaults write at.studio.AsideBrowser NSUserKeyEquivalents -dict-add "Bookmark This Tab…" "^@b"
defaults write at.studio.AsideBrowser NSUserKeyEquivalents -dict-add "Bookmark All Tabs…" "^@\$b"
```

The repo ships this as a script — `scripts/native-shortcuts.sh` applies the whole table,
`--reset` puts the stock keys back:

| menu item | new binding | frees |
|-----------|-------------|-------|
| `Bookmark This Tab…` | `⌃⌘B` | `⌘D` |
| `Bookmark All Tabs…` | `⌃⇧⌘B` | `⇧⌘D` |
| `Always Show Bookmarks Bar` | `⌥⇧⌘B` | `⇧⌘B` |

Menus build their key equivalents at launch, so nothing changes until the browser is quit and
reopened — the menu keeps showing the old keys in the meantime, which looks like the write failed.
It didn't; check with `defaults read at.studio.AsideBrowser NSUserKeyEquivalents`.

Menu titles are exact strings — read them with
`osascript -e 'tell application "System Events" to tell process "Aside" to get name of menu items of menu 1 of menu bar item "Bookmarks" of menu bar 1'`.

Two things this cannot reach: Aside registers no custom url scheme (only `http`, `https`, `file`),
so nothing outside the browser can hand a prompt to its agent; and the sidebar's **Tidy** button is
not a menu command, so macOS has no handle to bind it to.

**Aside's own sidebar cannot be repainted or restyled by an extension.** It is native browser
chrome: colours come from internal palette ids (`kColorAsideFloatingSidebarBackground`,
`kColorAsideSidebarItemBackgroundHover`), and its preferences expose width, expand-on-hover and
sections — no colour key at all. The browser theme paints the toolbar and leaves the sidebar alone.
Everything this extension draws is themable instead: palette, popup, settings, panel — and by
default it borrows the sidebar's own values, sampled from a screenshot of it.

**What the sidebar does with bookmarks is the other half of `⌘D`.** With
`aside.vertical_tabs.bookmarks_section_enabled` the sidebar lists the bookmarks bar above *Chats*
and *Tabs*, and folds an open tab into the bookmark row that matches its url. The match is literal
and it skips tabs inside a group — both are facts this extension works around, not switches it can
flip.

## Layout

| file | role |
|------|------|
| `background.js` | service worker: placement, dedupe, pins, groups, palette window, omnibox `tw` |
| `keys.js` | content script: the keymap over the browser's shortcuts, plus on-page toasts |
| `palette.js` / `.html` | the ⇧⌘K palette, as a layer or as a window |
| `commands.js` | the single list of commands every surface renders |
| `sense.js` / `.html` | the proposal window for blocks by meaning |
| `panel.js` / `.html` | the side panel |
| `options.js` / `.html` | settings: keys, pins, tabs, cleanup, blocks, appearance |
| `popup.js` / `.html` | toolbar popup |
| `theme.js` · `instrument.css` | shared surface: the two looks (aside · paper), accent, numbered sections, tiles |
| `scripts/native-shortcuts.sh` | re-binds Aside's own menu shortcuts at the macOS level |

## Adjacent: Raycast snippets losing their first letter

If a snippet expands as `a` + text instead of replacing the alias, that is Raycast's injection
speed, not the browser — the first backspace is dropped while the field is still catching up:

```bash
osascript -e 'quit app "Raycast"'
defaults write com.raycast.macos snippetsResponseTime -string "slowest"
open -a Raycast
```

Quit Raycast **before** writing, otherwise it flushes its cached preferences over yours.

## License

MIT © Alex Povaliaev
