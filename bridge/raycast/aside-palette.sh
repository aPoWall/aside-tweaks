#!/bin/bash
# Raycast script command · aside tweaks palette from anywhere.
# Put this file in a Raycast script directory, give it a hotkey in Raycast.
# With an argument the palette opens with that query typed — ↵ runs the top row.
#
# @raycast.schemaVersion 1
# @raycast.title Aside Palette
# @raycast.mode silent
# @raycast.icon ⌘
# @raycast.packageName Aside Tweaks
# @raycast.argument1 { "type": "text", "placeholder": "search · > agent", "optional": true }
# @raycast.description tabs, history, bookmarks, notes and agents — the aside tweaks palette, from any app

PORT="${ASIDE_DESK_PORT:-49321}"
Q="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "${1:-}")"
URL="http://127.0.0.1:$PORT/aside-tweaks/palette${Q:+?q=$Q}"
open -a Aside "$URL" 2>/dev/null || open "$URL"
