#!/usr/bin/env bash
# Aside Tweaks — re-bind Aside's native menu shortcuts at the macOS level.
#
# Extensions cannot touch keys the browser owns before the page exists. Those keys
# are menu commands, and macOS lets any menu command be re-bound per application —
# the same thing System Settings › Keyboard › Keyboard Shortcuts › App Shortcuts does.
#
# Modifier syntax:  @ = ⌘   ^ = ⌃   ~ = ⌥   $ = ⇧
# Menu titles are exact strings, ellipsis included. Read the live ones with:
#   osascript -e 'tell application "System Events" to tell process "Aside" \
#     to get name of menu items of menu 1 of menu bar item "Bookmarks" of menu bar 1'

set -euo pipefail
DOMAIN="at.studio.AsideBrowser"

# menu item                     new binding   frees
MAP=(
  "Bookmark This Tab…|^@b|⌘D"
  "Bookmark All Tabs…|^@\$b|⇧⌘D"
  "Always Show Bookmarks Bar|~@\$b|⇧⌘B"
)

if [[ "${1:-}" == "--reset" ]]; then
  defaults delete "$DOMAIN" NSUserKeyEquivalents 2>/dev/null || true
  echo "removed every override · restart Aside to get the stock keys back"
  exit 0
fi

for row in "${MAP[@]}"; do
  IFS='|' read -r item key frees <<< "$row"
  defaults write "$DOMAIN" NSUserKeyEquivalents -dict-add "$item" "$key"
  printf '  %-28s → %-6s  frees %s\n' "$item" "$key" "$frees"
done

echo
echo "written to ~/Library/Preferences/$DOMAIN.plist"
echo "menus build their key equivalents at launch — quit and reopen Aside for this to bite."
