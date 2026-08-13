# Aside Tweaks

A small extension for the [Aside](https://aside.com) browser: a command palette, a keymap that
sits **above** the browser's own shortcuts, Arc-style pins, duplicate cleanup and tab placement
that actually holds.

Built by [Alex Povaliaev](https://github.com/aPoWall) for daily use, kept in the open.

## Install

```bash
git clone https://github.com/aPoWall/aside-tweaks.git
```

`chrome://extensions` → enable Developer mode → **Load unpacked** → pick the folder.
Chromium 114+ (Aside is built on 151), Manifest V3.

## What it does

**Palette — ⌘K.** A window centred on the browser window. `⇥` switches scope:
`all · tabs · history · bookmarks · commands`.

- history collapses by normalised url (utm stripped), so one site stops eating the whole list
- ranking by pick frequency with a two-week decay, `n · e^(−days/14)`
- paste a url and you get `Open`, `Open in block · <name>`, `Open pinned`
- `⇧↵` is the row's second action: pin the tab, or open the address already pinned
- arithmetic in the input (`2+2`, `(19*3)/2`), `↵` copies the result

**Own keymap.** Every action is bindable inside the extension, and the binding wins over the
browser's: keydown reaches the page in the capture phase *before* the browser applies its
accelerator, so `preventDefault()` takes over `⌘D`, `⌘⇧D`, `⌘S`, `⌘P`. Combos are stored by
`event.code`, not `event.key` — a non-Latin keyboard layout doesn't break them.

Defaults: `⌘D` pin · `⌘⇧D` clean duplicates. Native fallbacks: `⌃D`, `⌃⇧D`, `⌃⇧S` panel, `⌘K` palette.

**Pins, Arc-style.** A pin moves the tab into the squares on top of the sidebar. Closing a pinned
tab brings the pin back asleep instead of dropping it; to remove it, unpin first. A pin is not a
bookmark — bookmarking is a separate action that writes to the bookmarks bar with no dialog and
toggles off on a second call.

**Cleanup.** Auto-dedupe closes a fresh tab when the same url is already open and switches to the
existing one. The manual command also collapses empty new tabs, keeping one per window.

**Placement.** New tabs open under the current one. Aside re-orders a fresh tab *after* it is
created, so a guard keeps putting it back until it stops drifting (window configurable, 2.5 s by
default). Other modes: at the end of the list, or leave it to the browser.

**Panel — ⌃⇧S.** Own side panel via `chrome.sidePanel`: pinned tabs as their own section, the rest
grouped by blocks, commands at the bottom, drag to reorder.

**Blocks.** A block is a name plus substrings. Blocks drive tab grouping, the palette's
«open in block» and the panel's sections. Groups are created expanded.

## Limits worth knowing

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

Restart the browser afterwards; `@` is ⌘, `^` is ⌃, `~` is ⌥, `$` is ⇧.

**Aside's own sidebar cannot be repainted or restyled by an extension.** It is native browser
chrome: colours come from internal palette ids (`kColorAsideFloatingSidebarBackground`,
`kColorAsideSidebarItemBackgroundHover`), and its preferences expose width, expand-on-hover and
sections — no colour key at all. The browser theme paints the toolbar and leaves the sidebar alone.
Everything this extension draws is themable instead: palette, popup, settings, panel.

## Layout

| file | role |
|------|------|
| `background.js` | service worker: placement, dedupe, pins, groups, palette window, omnibox `tw` |
| `keys.js` | content script: the keymap over the browser's shortcuts, plus on-page toasts |
| `palette.js` / `.html` | the ⌘K palette |
| `panel.js` / `.html` | the side panel |
| `options.js` / `.html` | settings: keys, pins, tabs, cleanup, blocks, appearance |
| `popup.js` / `.html` | toolbar popup |
| `theme.js` · `instrument.css` | shared surface: paper palette, accent, numbered sections, tiles |

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
