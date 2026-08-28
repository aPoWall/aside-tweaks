#!/usr/bin/env python3
"""
aside tweaks · desk bridge

A tiny local HTTP server that lets the palette reach two things a browser
extension cannot touch on its own:

  • recent Obsidian notes  — read from each vault's .obsidian/workspace.json
                             (the same list Obsidian shows as «recent files»),
                             plus a filename search over the vault;
  • agents                 — live Orca terminals to switch to, and a new agent
                             (claude / codex) started in a chosen working folder.

Listens on 127.0.0.1 only and answers only to requests carrying the
`X-Aside-Tweaks: desk` header (a web page cannot add it without a CORS
preflight, and the preflight is refused); an Origin, when present, must be a
chrome-extension:// page, optionally pinned to specific ids. Standard library
only — no pip.

Config: ~/.config/aside-tweaks/desk.json  (see bridge/install.sh for a template)
"""
import json
import os
import shlex
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CONFIG_PATH = os.path.expanduser(os.environ.get("ASIDE_DESK_CONFIG", "~/.config/aside-tweaks/desk.json"))

DEFAULTS = {
    "port": 49321,
    "extension_ids": [],          # empty = any chrome-extension:// origin
    "vaults": [],                 # {name, path, uri_id?, via?: {vault, prefix}}
    "worktrees": [],              # {name, path}
    "agent": "claude",            # command that starts an agent in a terminal
    "orca": "orca",               # orca CLI binary
    "app": "Aside",               # process whose menu bar the palette can search and click
    "hs": "hs",                   # Hammerspoon CLI: reads the menu tree in under a second, no extra permissions
}


def load_config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8") as fh:
            cfg.update(json.load(fh))
    except FileNotFoundError:
        pass
    for v in cfg["vaults"]:
        v["path"] = os.path.realpath(os.path.expanduser(v["path"]))
    for w in cfg["worktrees"]:
        w["path"] = os.path.realpath(os.path.expanduser(w["path"]))
    return cfg


CFG = load_config()


# ---------- notes ----------

def recent_of(vault):
    """lastOpenFiles from workspace.json — Obsidian's own «recent files», MRU order."""
    ws = os.path.join(vault["path"], ".obsidian", "workspace.json")
    try:
        with open(ws, encoding="utf-8") as fh:
            files = json.load(fh).get("lastOpenFiles", [])
    except (OSError, ValueError):
        return []
    out = []
    for rank, rel in enumerate(files):
        full = os.path.join(vault["path"], rel)
        if not os.path.isfile(full):
            continue
        out.append(note_of(vault, rel, full, rank))
    return out


def note_of(vault, rel, full, rank=None):
    base = os.path.basename(rel)
    title = base[:-3] if base.endswith(".md") else base
    try:
        mtime = os.stat(full).st_mtime
    except OSError:
        mtime = 0
    return {
        "vault": vault["name"],
        "file": rel,
        "path": full,
        "title": title,
        "folder": os.path.dirname(rel),
        "mtime": int(mtime),
        "rank": rank,
    }


_index = {"at": 0, "notes": []}
SKIP_DIRS = {".obsidian", ".git", ".trash", "node_modules", ".claude", "__pycache__"}


def index_notes():
    """Filename index over every vault, refreshed at most once a minute."""
    if time.time() - _index["at"] < 60 and _index["notes"]:
        return _index["notes"]
    notes = []
    for v in CFG["vaults"]:
        root = v["path"]
        for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
            for fn in filenames:
                if not fn.endswith(".md"):
                    continue
                full = os.path.join(dirpath, fn)
                notes.append(note_of(v, os.path.relpath(full, root), full))
    _index.update(at=time.time(), notes=notes)
    return notes


def notes(q="", limit=30, sort="modified", since=""):
    """sort: modified — по времени правки файла (индекс имён); opened — порядок «недавних» Obsidian.
    since=today — только файлы, изменённые с полуночи."""
    seen = set()
    out = []
    floor = 0
    if since == "today":
        floor = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
    if q:
        words = [w for w in q.lower().split() if w]
        hits = [n for n in index_notes() if all(w in n["title"].lower() or w in n["folder"].lower() for w in words)]
        # начало заголовка выше, потом свежесть правки
        hits.sort(key=lambda n: (0 if n["title"].lower().startswith(words[0]) else 1, -n["mtime"]))
        pool = hits
    elif sort == "opened":
        # недавние из всех волтов вперемешку по позиции в MRU: 0,0,1,1,2,2…
        pool = sorted((n for v in CFG["vaults"] for n in recent_of(v)), key=lambda n: (n["rank"], n["vault"]))
    else:
        pool = sorted(index_notes(), key=lambda n: -n["mtime"])
    for n in pool:
        if floor and n["mtime"] < floor:
            continue
        key = os.path.realpath(n["path"])
        if key in seen:
            continue
        seen.add(key)
        out.append(n)
        if len(out) >= limit:
            break
    return out


def open_note(vault_name, rel):
    v = next((x for x in CFG["vaults"] if x["name"] == vault_name), None)
    if not v:
        return False, "unknown vault"
    # normpath, не realpath: папка team/ в личном волте — симлинк наружу, а «..» он всё равно режет
    full = os.path.normpath(os.path.join(v["path"], rel))
    if not full.startswith(v["path"] + os.sep) or not os.path.isfile(full):
        return False, "outside the vault"
    via = v.get("via")
    if via:
        host = next((x for x in CFG["vaults"] if x["name"] == via["vault"]), None)
        if host and host.get("uri_id"):
            url = "obsidian://adv-uri?vault=%s&filepath=%s&openmode=true" % (
                host["uri_id"], urllib.parse.quote(via.get("prefix", "") + rel, safe=""))
        else:
            return False, "via-vault has no uri_id"
    elif v.get("uri_id"):
        url = "obsidian://adv-uri?vault=%s&filepath=%s&openmode=true" % (v["uri_id"], urllib.parse.quote(rel, safe=""))
    else:
        url = "obsidian://open?vault=%s&file=%s" % (
            urllib.parse.quote(v["name"], safe=""), urllib.parse.quote(rel[:-3] if rel.endswith(".md") else rel, safe=""))
    subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return True, url


# ---------- agents (Orca) ----------

def orca(*args, timeout=8):
    try:
        p = subprocess.run([CFG["orca"], *args, "--json"], capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, str(e)
    if p.returncode != 0:
        return None, (p.stderr or p.stdout).strip()[:300]
    try:
        return json.loads(p.stdout), None
    except ValueError:
        return None, "orca returned non-json"


def agents():
    data, err = orca("terminal", "list")
    if not data:
        return {"terminals": [], "error": err}
    terms = (data.get("result") or {}).get("terminals") or []
    out = []
    for t in terms:
        out.append({
            "handle": t.get("handle"),
            "title": (t.get("title") or "").strip(),
            "path": t.get("worktreePath") or "",
            "connected": bool(t.get("connected")),
            "lastOutputAt": t.get("lastOutputAt"),
        })
    out.sort(key=lambda t: -(t["lastOutputAt"] or 0))
    return {"terminals": out}


def switch_agent(handle):
    if not handle or not handle.startswith("term_"):
        return False, "bad handle"
    data, err = orca("terminal", "switch", "--terminal", handle)
    return bool(data), err


def run_agent(prompt, path, name=""):
    prompt = (prompt or "").strip()
    if not prompt:
        return False, "empty prompt"
    allowed = {w["path"] for w in CFG["worktrees"]}
    path = os.path.realpath(os.path.expanduser(path or ""))
    if path not in allowed:
        return False, "folder is not in the worktrees list"
    title = (name + " · " if name else "") + prompt[:48]
    command = "%s %s" % (CFG["agent"], shlex.quote(prompt))
    data, err = orca("terminal", "create", "--worktree", "path:" + path, "--title", title, "--command", command, "--focus", timeout=20)
    return bool(data), err


# ---------- меню приложения: как Raycast → Search Menu Items ----------
# Два пути к дереву меню. Hammerspoon (`hs -c`) читает его нативно за полсекунды и уже имеет
# Accessibility — основной путь. System Events через osascript — запасной: 25 секунд на дерево и
# Accessibility нужен самому python3 моста. Динамические хвосты (открытые вкладки в Tab, закладки
# в Bookmarks, история, окна, профили) режутся по опорным пунктам.

HS_MENU_LUA = '''
local a = hs.application.get(%s)
if not a then return "[]" end
local m = a:getMenuItems() or {}
local rows = {}
local function mods(t) local s = {} for _, x in ipairs(t or {}) do s[#s+1] = x end return s end
for _, mb in ipairs(m) do
  local menu = mb.AXTitle or ""
  local kids = (mb.AXChildren or {})[1] or {}
  for i, it in ipairs(kids) do
    local name = it.AXTitle or ""
    if name == "" then
      rows[#rows+1] = {menu = menu, index = i, sub = 0, name = "---", ch = "", mods = {}, enabled = false}
    else
      rows[#rows+1] = {menu = menu, index = i, sub = 0, name = name, ch = it.AXMenuItemCmdChar or "", glyph = it.AXMenuItemCmdGlyph or 0, mods = mods(it.AXMenuItemCmdModifiers), enabled = it.AXEnabled and true or false}
      local sk = (it.AXChildren or {})[1] or {}
      for j, sv in ipairs(sk) do
        local sn = sv.AXTitle or ""
        if sn ~= "" then
          rows[#rows+1] = {menu = menu, index = i, sub = j, name = name .. " → " .. sn, ch = sv.AXMenuItemCmdChar or "", glyph = sv.AXMenuItemCmdGlyph or 0, mods = mods(sv.AXMenuItemCmdModifiers), enabled = sv.AXEnabled and true or false}
        end
      end
    end
  end
end
return hs.json.encode(rows)
'''

# опорные пункты: после них (или до них / между ними) идёт содержимое, а не команды
MENU_ANCHORS = {
    "Tab": ("after", "Search Tabs…"),
    "Bookmarks": ("after", "Bookmark All Tabs…"),
    "Window": ("after", "Arrange in Front"),
    "Profiles": ("before", "Edit…"),
    "History": ("between", "Forward", "Show Full History"),
}

GLYPHS = {2: "⇥", 4: "↩", 9: "␣", 10: "⌦", 11: "⇞", 12: "⇟", 23: "⌫", 27: "esc", 98: "⇞", 99: "⇟", 100: "←", 101: "→", 104: "↑", 106: "↓",
          111: "F1", 112: "F2", 113: "F3", 114: "F4", 115: "F5", 116: "F6", 117: "F7", 118: "F8", 119: "F9", 120: "F10", 121: "F11", 122: "F12"}


def key_from_list(ch, mods, glyph=0):
    """Hammerspoon: модификаторы списком ("cmd", "shift", "alt", "ctrl", "fn"), символ или глиф."""
    mods = set(mods or [])
    c = KEY_CHARS.get(ch, ch.upper()) if ch else GLYPHS.get(int(glyph or 0), "")
    if not c and not mods:
        return ""
    if not c:
        return ""
    parts = []
    if "fn" in mods or not mods:
        parts.append("fn ")
    if "ctrl" in mods:
        parts.append("⌃")
    if "alt" in mods:
        parts.append("⌥")
    if "shift" in mods:
        parts.append("⇧")
    if "cmd" in mods:
        parts.append("⌘")
    return "".join(parts) + c


def cut_dynamic(menu, rows):
    rule = MENU_ANCHORS.get(menu)
    if not rule:
        return rows
    names = [r["name"] for r in rows]
    if rule[0] == "after" and rule[1] in names:
        return rows[:names.index(rule[1]) + 1]
    if rule[0] == "before" and rule[1] in names:
        return rows[names.index(rule[1]):]
    if rule[0] == "between" and rule[1] in names and rule[2] in names:
        return rows[:names.index(rule[1]) + 1] + rows[names.index(rule[2]):]
    return rows


def rows_to_items(rows):
    by, order = {}, []
    for r in rows:
        if r["menu"] not in by:
            by[r["menu"]] = []
            order.append(r["menu"])
        by[r["menu"]].append(r)
    items = []
    for menu in order:
        for r in cut_dynamic(menu, by[menu]):
            if r["name"] == "---" or r["name"].startswith("chrome-extension://"):
                continue
            parts = r["name"].split(" → ")
            items.append({"title": parts[-1], "path": " → ".join([menu] + parts[:-1]), "titles": [menu] + parts,
                          "menu": menu, "index": r["index"], "sub": r["sub"], "key": r.get("key", ""), "enabled": bool(r["enabled"])})
    return items


def menu_via_hs():
    hs = shutil.which(CFG.get("hs") or "hs")
    if not hs:
        return None, "no hs"
    try:
        p = subprocess.run([hs, "-c", HS_MENU_LUA % json.dumps(CFG["app"])], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, str(e)[:200]
    if p.returncode != 0:
        return None, (p.stderr or p.stdout).strip()[:200]
    text = p.stdout.strip().splitlines()[-1] if p.stdout.strip() else "[]"
    try:
        rows = json.loads(text)
    except ValueError:
        return None, "hs returned non-json"
    if not isinstance(rows, list):
        rows = []
    for r in rows:
        mods = r.get("mods")
        r["key"] = "" if r["name"] == "---" else key_from_list(r.get("ch") or "", mods if isinstance(mods, list) else [], r.get("glyph") or 0)
    return rows_to_items(rows), None

MENU_SCRIPT = '''
tell application "System Events" to tell process "%s"
  set out to ""
  repeat with mb in (menu bar items of menu bar 1)
    set mbName to name of mb
    if mbName is not "Apple" then
      set i to 0
      repeat with mi in (menu items of menu 1 of mb)
        set i to i + 1
        set nm to name of mi
        if nm is missing value then
          set out to out & mbName & "\t" & i & "\t0\t---\t\t\t\n"
        else
          set ch to ""
          set md to ""
          try
            set ch to value of attribute "AXMenuItemCmdChar" of mi
            set md to value of attribute "AXMenuItemCmdModifiers" of mi
          end try
          set hasSub to (count of menus of mi) > 0
          set out to out & mbName & "\t" & i & "\t0\t" & nm & "\t" & ch & "\t" & md & "\t" & (enabled of mi) & "\n"
          if hasSub then
            try
              set j to 0
              repeat with si in (menu items of menu 1 of mi)
                set j to j + 1
                set sn to name of si
                if sn is not missing value then
                  set sch to ""
                  set smd to ""
                  try
                    set sch to value of attribute "AXMenuItemCmdChar" of si
                    set smd to value of attribute "AXMenuItemCmdModifiers" of si
                  end try
                  set out to out & mbName & "\t" & i & "\t" & j & "\t" & nm & " → " & sn & "\t" & sch & "\t" & smd & "\t" & (enabled of si) & "\n"
                end if
              end repeat
            end try
          end if
        end if
      end repeat
    end if
  end repeat
  return out
end tell
'''

# хвосты меню, которые меняются с каждой вкладкой: after_first — всё после первого разделителя,
# after_last — после последнего, middle — между первым и последним, before_first — до первого
MENU_CUTS = {"Tab": "after_first", "Bookmarks": "after_first", "History": "middle", "Window": "after_last", "Profiles": "before_first"}

KEY_CHARS = {"\t": "⇥", " ": "␣", "\r": "↩", "\x1b": "esc", "\x7f": "⌫", "\x08": "⌫"}


def key_label(ch, mods):
    """AXMenuItemCmdModifiers: 1 ⇧ · 2 ⌥ · 4 ⌃ · 8 без ⌘ · 16 fn."""
    if ch == "missing value":
        ch = ""
    try:
        m = int(mods)
    except (TypeError, ValueError):
        m = 0
    if not ch and (m & 8):
        return ""
    parts = []
    if m & 16:
        parts.append("fn")
    if m & 4:
        parts.append("⌃")
    if m & 2:
        parts.append("⌥")
    if m & 1:
        parts.append("⇧")
    if not (m & 8):
        parts.append("⌘")
    c = KEY_CHARS.get(ch, ch.upper()) if ch else "⌫"
    return "".join(parts) + c


def parse_menu(text):
    by = {}
    order = []
    for line in text.splitlines():
        cols = line.split("\t")
        if len(cols) < 7:
            continue
        menu, idx, sub, name, ch, mods, enabled = cols[:7]
        if menu not in by:
            by[menu] = []
            order.append(menu)
        by[menu].append({"menu": menu, "index": int(idx or 0), "sub": int(sub or 0), "name": name,
                         "key": "" if name == "---" else key_label(ch, mods), "enabled": enabled.strip() == "true"})
    items = []
    for menu in order:
        rows = by[menu]
        seps = [i for i, r in enumerate(rows) if r["name"] == "---"]
        cut = MENU_CUTS.get(menu)
        if cut and seps:
            if cut == "after_first":
                rows = rows[:seps[0]]
            elif cut == "after_last":
                rows = rows[:seps[-1]]
            elif cut == "before_first":
                rows = rows[seps[0] + 1:]
            elif cut == "middle" and len(seps) >= 2:
                rows = rows[:seps[0]] + rows[seps[-1] + 1:]
        for r in rows:
            if r["name"] == "---" or r["name"].startswith("chrome-extension://"):
                continue
            title = r["name"].split(" → ")[-1]
            path = [menu] + r["name"].split(" → ")[:-1]
            items.append({"title": title, "path": " → ".join(path), "menu": menu, "index": r["index"], "sub": r["sub"],
                          "key": r["key"], "enabled": r["enabled"]})
    return items


_menu = {"at": 0, "items": [], "error": None, "busy": False}
_menu_lock = threading.Lock()


def refresh_menu():
    with _menu_lock:
        if _menu["busy"]:
            return
        _menu["busy"] = True
    try:
        items, err = menu_via_hs()
        if items is not None:
            _menu.update(items=items, error=None, at=time.time(), via="hammerspoon")
            return
        p = subprocess.run(["osascript", "-e", MENU_SCRIPT % CFG["app"]], capture_output=True, text=True, timeout=180)
        if p.returncode != 0:
            err = (p.stderr or p.stdout).strip()[:200]
            _menu.update(error=("accessibility" if "assistive" in err or "-25211" in err or "-1719" in err else err) or "osascript failed")
        else:
            _menu.update(items=parse_menu(p.stdout), error=None, at=time.time(), via="osascript")
    except (OSError, subprocess.TimeoutExpired) as e:
        _menu.update(error=str(e)[:200])
    finally:
        _menu["busy"] = False


def menu_click(menu, index, sub=0):
    item = next((i for i in _menu["items"] if i["menu"] == menu and i["index"] == index and i["sub"] == sub), None)
    if not item:
        return False, "no such menu item in the cache — refresh"
    hs = shutil.which(CFG.get("hs") or "hs")
    if hs and item.get("titles"):
        lua = 'local a = hs.application.get(%s); if not a then return "no app" end; a:activate(); return tostring(a:selectMenuItem(hs.json.decode(%s)))' % (
            json.dumps(CFG["app"]), json.dumps(json.dumps(item["titles"])))
        try:
            p = subprocess.run([hs, "-c", lua], capture_output=True, text=True, timeout=15)
            if p.returncode == 0 and "true" in p.stdout:
                return True, item["path"] + " → " + item["title"]
        except (OSError, subprocess.TimeoutExpired):
            pass
    target = 'menu item %d of menu 1 of menu bar item "%s" of menu bar 1' % (index, menu.replace('"', ''))
    if sub:
        target = 'menu item %d of menu 1 of %s' % (sub, target)
    script = 'tell application "System Events" to tell process "%s"\n  set frontmost to true\n  click %s\nend tell' % (CFG["app"], target)
    try:
        p = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)[:200]
    if p.returncode != 0:
        return False, (p.stderr or p.stdout).strip()[:200]
    return True, item["path"] + " → " + item["title"]


# ---------- сигнальная страница: палитра с глобальной клавиши ----------
# До расширения снаружи не достучаться: chrome-extension:// из системы не открывается,
# service worker спит. Зато `open -a Aside http://127.0.0.1:<port>/aside-tweaks/palette`
# открывает обычную вкладку — на ней есть content script расширения, он и просит палитру.
SIGNAL_PATH = "/aside-tweaks/palette"
SIGNAL_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>aside tweaks</title>
<meta name="color-scheme" content="light dark">
<style>html,body{height:100%;margin:0;background:#ececec;color:#6f6f6f;font:12.5px -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
.c{position:fixed;left:16px;bottom:12px;opacity:.8}
@media (prefers-color-scheme:dark){html,body{background:#1e1e20;color:#8e8e93}}</style></head>
<body><div class="c">aside tweaks · palette</div></body></html>""".encode("utf-8")


# ---------- http ----------

def origin_ok(origin):
    if not origin or not origin.startswith("chrome-extension://"):
        return False
    ids = CFG.get("extension_ids") or []
    return not ids or origin[len("chrome-extension://"):].rstrip("/") in ids


# Chromium не шлёт Origin для запросов расширения с host-permission, поэтому ворота —
# служебный заголовок: веб-страница поставить его может только через CORS-преддоговор,
# а преддоговор мы не подтверждаем. Origin, если он всё же пришёл, обязан быть расширением.
def request_ok(headers):
    if headers.get("X-Aside-Tweaks") != "desk":
        return False
    origin = headers.get("Origin")
    return not origin or origin_ok(origin)


class Handler(BaseHTTPRequestHandler):
    server_version = "aside-tweaks-desk/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin", "")
        if origin_ok(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Aside-Tweaks")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _gate(self):
        if request_ok(self.headers):
            return True
        self._send(403, {"ok": False, "error": "not the extension"})
        return False

    def do_OPTIONS(self):
        # преддоговор подтверждаем только расширению — страницам сайтов ворота закрыты
        if not origin_ok(self.headers.get("Origin", "")):
            self._send(403, {"ok": False, "error": "origin"})
            return
        self._send(204, {})

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        # без ворот: страница для браузера, а не для расширения — и пустая иконка, чтобы не шуметь 403
        if u.path == SIGNAL_PATH:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(SIGNAL_HTML)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(SIGNAL_HTML)
            return
        if u.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if not self._gate():
            return
        qs = urllib.parse.parse_qs(u.query)
        one = lambda k, d="": (qs.get(k) or [d])[0]
        if u.path == "/health":
            self._send(200, {"ok": True, "vaults": [v["name"] for v in CFG["vaults"]],
                             "worktrees": [{"name": w["name"], "path": w["path"]} for w in CFG["worktrees"]],
                             "agent": CFG["agent"]})
        elif u.path == "/notes":
            try:
                limit = max(1, min(80, int(one("limit", "30"))))
            except ValueError:
                limit = 30
            self._send(200, {"ok": True, "notes": notes(one("q").strip(), limit, one("sort", "modified"), one("since"))})
        elif u.path == "/agents":
            self._send(200, {"ok": True, **agents()})
        elif u.path == "/menu":
            # через Hammerspoon дерево читается за полсекунды — обновляем синхронно, если старше 30 с
            stale = time.time() - _menu["at"] > 30
            if (one("refresh") == "1" or stale) and not _menu["busy"]:
                if _menu.get("via") == "osascript" or (not _menu["items"] and not shutil.which(CFG.get("hs") or "hs")):
                    threading.Thread(target=refresh_menu, daemon=True).start()
                else:
                    refresh_menu()
            self._send(200, {"ok": not _menu["error"], "app": CFG["app"], "items": [{k: v for k, v in i.items() if k != "titles"} for i in _menu["items"]],
                             "at": int(_menu["at"]), "busy": _menu["busy"], "error": _menu["error"], "via": _menu.get("via")})
        else:
            self._send(404, {"ok": False, "error": "no such route"})

    def do_POST(self):
        if not self._gate():
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except ValueError:
            body = {}
        u = urllib.parse.urlsplit(self.path)
        if u.path == "/open":
            ok, info = open_note(body.get("vault"), body.get("file") or "")
        elif u.path == "/switch":
            ok, info = switch_agent(body.get("handle"))
        elif u.path == "/run":
            ok, info = run_agent(body.get("prompt"), body.get("path"), body.get("name", ""))
        elif u.path == "/menu/click":
            ok, info = menu_click(body.get("menu") or "", int(body.get("index") or 0), int(body.get("sub") or 0))
        else:
            self._send(404, {"ok": False, "error": "no such route"})
            return
        self._send(200 if ok else 400, {"ok": ok, "info": info})


def main():
    port = int(os.environ.get("ASIDE_DESK_PORT") or CFG["port"])
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=refresh_menu, daemon=True).start()   # дерево меню — в фоне, палитра не ждёт
    sys.stderr.write("aside tweaks desk · 127.0.0.1:%d · vaults: %s · worktrees: %s\n" % (
        port, ", ".join(v["name"] for v in CFG["vaults"]) or "none", ", ".join(w["name"] for w in CFG["worktrees"]) or "none"))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
