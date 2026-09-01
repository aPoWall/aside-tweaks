#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/alex/Documents/_code/_tools/aside-tweaks"
PREVIEW_PORT=4178

while lsof -nP -iTCP:${PREVIEW_PORT} -sTCP:LISTEN >/dev/null 2>&1; do
  if curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/" 2>/dev/null | grep -q "Aside Tweaks"; then
    break
  fi
  PREVIEW_PORT=$((PREVIEW_PORT + 1))
done

if ! lsof -nP -iTCP:${PREVIEW_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  cd "$PROJECT_ROOT/docs"
  python3 -m http.server "$PREVIEW_PORT" --bind 0.0.0.0 >/tmp/aside-tweaks-preview.log 2>&1 &
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
echo "desktop · http://localhost:${PREVIEW_PORT}/"
[[ -n "$LAN_IP" ]] && echo "phone   · http://${LAN_IP}:${PREVIEW_PORT}/"
open "http://localhost:${PREVIEW_PORT}/"
