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

# порт — из конфига моста, иначе 49321; Raycast не несёт переменных окружения оболочки
CONF="$HOME/.config/aside-tweaks/desk.json"
PORT="$(python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("port", 49321))
except Exception: print(49321)' "$CONF")"
Q="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "${1:-}")"
URL="http://127.0.0.1:$PORT/aside-tweaks/palette${Q:+?q=$Q}"
# Aside и есть цель: в другом браузере расширения нет, поэтому без Aside просто ничего не открываем
if ! open -a Aside "$URL" 2>/dev/null; then
  echo "aside browser not found" >&2
  exit 1
fi
