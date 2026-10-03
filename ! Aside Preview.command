#!/bin/zsh
set -eu
cd "${0:A:h}"
preview_port=8927
for candidate in 8927 8928 8929; do
  preview_pid=$(lsof -t -iTCP:$candidate -sTCP:LISTEN 2>/dev/null || true)
  if [[ -z "$preview_pid" ]]; then preview_port=$candidate; break; fi
  preview_cwd=$(lsof -a -p "$preview_pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  if [[ "$preview_cwd" == "$PWD" ]] && curl -fsS "http://localhost:$candidate/aside-tweaks/page.js" >/dev/null; then
    preview_port=$candidate; break
  fi
  [[ $candidate != 8929 ]] || { print 'Preview ports occupied. Choose ASIDE_PREVIEW_PORT manually.'; exit 1; }
done
if ! lsof -t -iTCP:$preview_port -sTCP:LISTEN >/dev/null 2>&1; then
  ASIDE_PREVIEW_PORT=$preview_port nohup node scripts/preview.mjs >/tmp/aside-tweaks-preview.log 2>&1 &
  for attempt in {1..20}; do curl -fsS "http://localhost:$preview_port/aside-tweaks/" >/dev/null && break || sleep .2; done
fi
preview_lan=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
print "Desktop: http://localhost:$preview_port/aside-tweaks/"
[[ -z "$preview_lan" ]] || print "Phone: http://$preview_lan:$preview_port/aside-tweaks/"
open "http://localhost:$preview_port/aside-tweaks/"
