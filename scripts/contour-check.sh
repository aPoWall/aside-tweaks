#!/bin/zsh
# Контур браузера одной командой: кто открывает ссылки, живо ли расширение,
# поднимается ли стенд. Пишет строками PASS/FAIL и возвращает ненулевой код,
# если хоть одна строка красная – годится и для глаз, и для автоматизации.
#
#   scripts/contour-check.sh          проверить всё
#   scripts/contour-check.sh --quick  без стенда (быстро, ничего не запускает)
#
# Запускать на маке: браузер живёт там. С сервера – ssh macnew '<путь>/contour-check.sh'.
set -uo pipefail

REPO="${0:A:h:h}"
PROFILE="$HOME/Library/Application Support/Aside/Default"
ID=biahbgkjdbjnidodbpekgoigldpmpjpg
NODE="${NODE_BIN:-/opt/homebrew/bin/node}"
fails=0

say() { print -r -- "$1 $2${3:+ · $3}"; [[ "$1" == FAIL ]] && ((fails++)); return 0 }

# 1. браузер по умолчанию – его держит LaunchServices, а не файл настроек
handler=$(swift "$REPO/scripts/default-browser.swift" 2>/dev/null | awk '/^  http /{print $3}')
[[ "$handler" == "at.studio.AsideBrowser" ]] \
  && say PASS "ссылки открывает Aside" "$handler" \
  || say FAIL "ссылки открывает не Aside" "${handler:-неизвестно}"

# 2. расширение: версия на диске и то, что браузер записал о нём в профиль
want=$(grep -o '"version": "[0-9.]*"' "$REPO/manifest.json" | head -1 | grep -o '[0-9.]*')
state=$($NODE -e '
  const fs = require("fs");
  const p = process.argv[1] + "/Secure Preferences";
  const e = (JSON.parse(fs.readFileSync(p, "utf8")).extensions?.settings ?? {})[process.argv[2]];
  if (!e) { console.log("нет записи"); process.exit(0); }
  const off = (e.disable_reasons ?? []).length;
  const cmds = Object.keys(e.commands ?? {});
  console.log((off ? "выключено:" + e.disable_reasons.join(",") : "включено") + " commands:" + cmds.length + (cmds.includes("clean-duplicates") ? " 4.26+" : " до-4.26"));
' "$PROFILE" "$ID" 2>/dev/null)
case "$state" in
  включено*4.26+) say PASS "расширение включено и свежее" "на диске $want" ;;
  включено*)      say FAIL "расширение включено, но старее $want" "$state · нужен Reload" ;;
  *)              say FAIL "расширение не работает" "$state · chrome://extensions → Developer mode" ;;
esac

# 3. стенд – тот же путь, которым сессия с сервера ведёт браузер
if [[ "${1:-}" != "--quick" ]]; then
  if "$REPO/scripts/testbed.sh" up >/dev/null 2>&1; then
    out=$($NODE "$REPO/tests/testbed-favorite.mjs" 2>&1 | tail -1)
    [[ "$out" == *"всё сошлось"* ]] && say PASS "стенд ведёт сессию браузера" || say FAIL "стенд не прошёл" "$out"
    "$REPO/scripts/testbed.sh" down >/dev/null 2>&1
  else
    say FAIL "стенд не поднялся"
  fi
fi

if (( fails )); then print -r -- "$fails FAIL"; exit 1; fi
print -r -- "контур в порядке"
exit 0
