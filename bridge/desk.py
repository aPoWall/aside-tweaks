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
import subprocess
import sys
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


def notes(q="", limit=30):
    seen = set()
    out = []
    if q:
        words = [w for w in q.lower().split() if w]
        hits = [n for n in index_notes() if all(w in n["title"].lower() or w in n["folder"].lower() for w in words)]
        # начало заголовка выше, потом свежесть правки
        hits.sort(key=lambda n: (0 if n["title"].lower().startswith(words[0]) else 1, -n["mtime"]))
        pool = hits
    else:
        # недавние из всех волтов вперемешку по позиции в MRU: 0,0,1,1,2,2…
        pool = sorted((n for v in CFG["vaults"] for n in recent_of(v)), key=lambda n: (n["rank"], n["vault"]))
    for n in pool:
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
            self._send(200, {"ok": True, "notes": notes(one("q").strip(), limit)})
        elif u.path == "/agents":
            self._send(200, {"ok": True, **agents()})
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
        else:
            self._send(404, {"ok": False, "error": "no such route"})
            return
        self._send(200 if ok else 400, {"ok": ok, "info": info})


def main():
    port = int(os.environ.get("ASIDE_DESK_PORT") or CFG["port"])
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    sys.stderr.write("aside tweaks desk · 127.0.0.1:%d · vaults: %s · worktrees: %s\n" % (
        port, ", ".join(v["name"] for v in CFG["vaults"]) or "none", ", ".join(w["name"] for w in CFG["worktrees"]) or "none"))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
