#!/bin/zsh
# Отдельный Aside на собственном профиле.
#
# Правило родилось из простого неудобства: проверять ⌘D в рабочем окне значит
# трогать живые вкладки и закладки человека. Стенд поднимает второй экземпляр
# браузера со своим профилем, своей панелью закладок и отладочным портом,
# поэтому главное окно остаётся нетронутым.
#
#   scripts/testbed.sh up [--visible]   поднять стенд (по умолчанию headless)
#   scripts/testbed.sh down             погасить стенд
#   scripts/testbed.sh fresh            стереть профиль стенда целиком
#   scripts/testbed.sh status           порт, профиль, список целей
set -uo pipefail

REPO="${0:A:h:h}"
PROFILE="${ASIDE_TESTBED_PROFILE:-$HOME/.aside-tweaks-testbed/profile}"
PORT="${ASIDE_TESTBED_PORT:-9333}"
BIN="${ASIDE_BIN:-/Applications/Aside.app/Contents/MacOS/Aside}"
LOG="$HOME/.aside-tweaks-testbed/testbed.log"
PIDFILE="$HOME/.aside-tweaks-testbed/testbed.pid"

mkdir -p "$PROFILE" "${LOG:h}"

alive() { curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; }

stop() {
  [[ -f "$PIDFILE" ]] && kill "$(cat "$PIDFILE")" 2>/dev/null
  rm -f "$PIDFILE"
  # порт освобождается не мгновенно, а следующий `up` иначе решит, что стенд уже поднят
  for i in {1..60}; do alive || return 0; perl -e 'select(undef,undef,undef,0.25)'; done
  pkill -f "user-data-dir=${PROFILE}" 2>/dev/null
  for i in {1..20}; do alive || return 0; perl -e 'select(undef,undef,undef,0.25)'; done
}

case "${1:-status}" in
  up)
    if alive; then echo "testbed already up · port ${PORT}"; exit 0; fi
    # Скрипт service worker'а лежит в кэше профиля и переживает перезапуск браузера:
    # правка в background.js иначе не доезжает до окна, а chrome.runtime.reload()
    # выбрасывает расширение, поднятое флагом --load-extension. Стираем кэш – читается диск.
    rm -rf "$PROFILE/Default/Service Worker" 2>/dev/null
    MODE=()
    [[ "${2:-}" == "--visible" ]] || MODE=(--headless=new)
    "$BIN" \
      --user-data-dir="$PROFILE" \
      --load-extension="$REPO" \
      --remote-debugging-port="$PORT" \
      --no-first-run --no-default-browser-check \
      --disable-background-timer-throttling \
      --window-size=1280,900 \
      $MODE about:blank >"$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    for i in {1..40}; do alive && break; sleep 0.25; done
    alive && echo "testbed up · port ${PORT} · profile ${PROFILE}" || { echo "testbed did not answer on ${PORT}"; tail -5 "$LOG"; exit 1; }
    ;;
  down)
    stop
    echo "testbed down"
    ;;
  fresh)
    stop
    rm -rf "$PROFILE"
    echo "профиль стенда стёрт · ${PROFILE}"
    ;;
  status)
    alive && curl -fsS "http://127.0.0.1:${PORT}/json/version" || echo "testbed is not running on ${PORT}"
    ;;
  *) echo "usage: testbed.sh {up [--visible]|down|fresh|status}"; exit 2;;
esac
