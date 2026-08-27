#!/usr/bin/env bash
# aside tweaks · desk bridge — install as a LaunchAgent (macOS)
#
#   bridge/install.sh            install or update, start now
#   bridge/install.sh --remove   stop and remove the agent
#
# Config lives in ~/.config/aside-tweaks/desk.json; a template is written on
# first run — edit vaults, worktrees, extension_ids there, then run again.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="dev.apowall.aside-tweaks-desk"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONF_DIR="$HOME/.config/aside-tweaks"
CONF="$CONF_DIR/desk.json"
LOG="$HOME/Library/Logs/aside-tweaks-desk.log"

if [[ "${1:-}" == "--remove" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL"
  exit 0
fi

mkdir -p "$CONF_DIR" "$HOME/Library/LaunchAgents"
if [[ ! -f "$CONF" ]]; then
  cat > "$CONF" <<JSON
{
  "port": 49321,
  "extension_ids": [],
  "vaults": [
    { "name": "notes", "path": "~/Documents/notes" }
  ],
  "worktrees": [
    { "name": "home", "path": "~" }
  ],
  "agent": "claude",
  "orca": "orca"
}
JSON
  echo "wrote a template config → $CONF  (edit vaults / worktrees, then run again)"
fi

PY="$(command -v python3)"
ORCA_DIR="$(dirname "$(command -v orca 2>/dev/null || echo /opt/homebrew/bin/orca)")"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$PY</string>
    <string>$HERE/desk.py</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$ORCA_DIR:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 1
PORT="$($PY -c "import json;print(json.load(open('$CONF')).get('port',49321))")"
if curl -s -H "X-Aside-Tweaks: desk" "http://127.0.0.1:$PORT/health" >/dev/null; then
  echo "desk bridge is up on 127.0.0.1:$PORT · log: $LOG"
else
  echo "started, but /health did not answer yet — check $LOG"
fi
