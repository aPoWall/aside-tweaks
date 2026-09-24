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

# 2. расширение: что реально поднялось в браузере
#    Первый признак – метка сборки, которую расширение пишет о себе при загрузке.
#    Пока она не появилась (её пишут версии с 4.27), читаем ключ миграции 4.26.
want=$(grep -o '"version": "[0-9.]*"' "$REPO/manifest.json" | head -1 | grep -o '[0-9.]*')
local_db="$PROFILE/Local Extension Settings/$ID"
sync_db="$PROFILE/Sync Extension Settings/$ID"
stamp=$(strings "$local_db"/*.log 2>/dev/null | grep -o '"version":"[0-9.]*"' | tail -1 | grep -o '[0-9.]*')
off=$($NODE -e '
  const fs = require("fs");
  const e = (JSON.parse(fs.readFileSync(process.argv[1] + "/Secure Preferences", "utf8")).extensions?.settings ?? {})[process.argv[2]];
  console.log(!e ? "нет записи" : (e.disable_reasons ?? []).join(",") || "");
' "$PROFILE" "$ID" 2>/dev/null)

if [[ -n "$off" ]]; then
  hint="$off"
  [[ "$off" == *16777216* ]] && hint="16777216 = DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION · chrome://extensions → Developer mode"
  say FAIL "расширение выключено браузером" "$hint"
elif [[ -n "$stamp" ]]; then
  [[ "$stamp" == "$want" ]] && say PASS "расширение живёт и это $stamp" \
    || say FAIL "в браузере $stamp, на диске $want" "нужен Reload"
elif strings "$sync_db"/*.log 2>/dev/null | grep -q favoritePinRev; then
  say PASS "расширение живёт, ключ миграции 4.26 на месте" "метка сборки появится после Reload"
else
  say FAIL "расширение не отметилось" "ни метки сборки, ни ключа миграции"
fi

# 3. магазинные расширения: запись в профиле без файлов = мёртвый значок в панели
#    именно так выглядела поломка 24.09 – Extensions пустая, а закреплённые значки на месте
recs=$($NODE -e '
  const fs = require("fs");
  const s = JSON.parse(fs.readFileSync(process.argv[1] + "/Secure Preferences", "utf8")).extensions?.settings ?? {};
  console.log(Object.keys(s).length);
' "$PROFILE" 2>/dev/null)
have=$(ls "$PROFILE/Extensions" 2>/dev/null | wc -l | tr -d ' ')
waiting=$(ls "$HOME/Library/Application Support/Aside/ExternalCRX"/*.crx 2>/dev/null | wc -l | tr -d ' ')
if [[ "${have:-0}" -gt 0 ]]; then
  say PASS "расширения из магазина на месте" "$have из $recs записей"
elif [[ "${waiting:-0}" -gt 0 ]]; then
  say PASS "расширения возвращены, ждут перезапуска браузера" "$waiting crx готовы"
else
  say FAIL "у магазинных расширений нет файлов" "$recs записей, 0 папок · scripts/extensions-restore.py --used"
fi

# 4. стенд – тот же путь, которым сессия с сервера ведёт браузер
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
