#!/usr/bin/env python3
"""Возврат расширений из Chrome Web Store в профиль Aside.

Что чинит. В профиле остались записи расширений – закреплённые значки, клавиши,
настройки, – а папка `Default/Extensions` пустая: файлов нет ни у одного магазинного
расширения. Отсюда `ERR_FILE_NOT_FOUND` на боковой панели и мёртвые значки в панели.

Как чинит. Скачивает crx из магазина и прописывает его локальным файлом в
`External Extensions/<id>.json` (`external_crx` + `external_version`). При следующем
старте браузер ставит расширение сам, без магазина и без рук. Прежние записи
сохраняются рядом с меткой времени.

    scripts/extensions-restore.py --list            что установлено и что потеряно
    scripts/extensions-restore.py --dry-run         что сделает, ничего не трогая
    scripts/extensions-restore.py --used            вернуть закреплённые и те, у кого есть клавиши
    scripts/extensions-restore.py --all             вернуть всё магазинное
    scripts/extensions-restore.py --ids a,b,c       вернуть поимённо

Запускать на маке при закрытом или открытом браузере – установка произойдёт при старте.
"""

import argparse, io, json, os, sys, time, urllib.request, zipfile

ASIDE = os.path.expanduser("~/Library/Application Support/Aside")
PROFILE = os.path.join(ASIDE, "Default")
EXTERNAL = os.path.join(ASIDE, "External Extensions")
CRX_DIR = os.path.join(ASIDE, "ExternalCRX")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36")
# расширения самого Aside и наши распакованные – их магазин не знает, трогать нечего
SKIP = {"clcdgiameigmljcbkkcbjiljinmfkncl", "fjdhphbdlfjogobdofoaagnlnkoibdge",
        "biahbgkjdbjnidodbpekgoigldpmpjpg", "nfkmpljldiokdfjogheiaiohaadfhllh"}


def read_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default if default is not None else {}


def profile_state():
    sec = read_json(os.path.join(PROFILE, "Secure Preferences"))
    pref = read_json(os.path.join(PROFILE, "Preferences"))
    ext = pref.get("extensions") or {}
    ids = sorted((sec.get("extensions") or {}).get("settings", {}).keys())
    pinned = set(ext.get("pinned_extensions") or [])
    gone = set(ext.get("external_uninstalls") or [])
    commanded = set()
    for key, val in (ext.get("commands") or {}).items():
        commanded.add((val or {}).get("extension") or key.split(":")[0])
    installed = set(os.listdir(os.path.join(PROFILE, "Extensions"))) if os.path.isdir(
        os.path.join(PROFILE, "Extensions")) else set()
    return ids, pinned, commanded, gone, installed


def fetch_crx(eid):
    """Возвращает (данные crx, имя, версия) либо (None, None, None)."""
    url = ("https://clients2.google.com/service/update2/crx?response=redirect"
           "&prodversion=152.0&acceptformat=crx3&x=id%3D" + eid + "%26uc")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
            data = r.read()
    except Exception:
        return None, None, None
    start = data.find(b"PK\x03\x04")          # crx3 = заголовок с подписью, затем обычный zip
    if start < 0 or len(data) < 1000:
        return None, None, None
    try:
        z = zipfile.ZipFile(io.BytesIO(data[start:]))
        m = json.loads(z.read("manifest.json").decode("utf-8-sig"))
    except Exception:
        return None, None, None
    name, ver = m.get("name", ""), m.get("version", "")
    if name.startswith("__MSG_"):             # имя лежит в локали, а не в манифесте
        key = name[6:-2]
        for loc in ("en", "en_US", "en_GB"):
            path = "_locales/%s/messages.json" % loc
            if path in z.namelist():
                msgs = json.loads(z.read(path).decode("utf-8-sig"))
                name = (msgs.get(key) or msgs.get(key.lower()) or {}).get("message", name)
                break
    return data, name, ver


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--used", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--ids", default="")
    args = ap.parse_args()

    ids, pinned, commanded, gone, installed = profile_state()
    print("записей о расширениях: %d · файлы есть у %d · закреплено %d · снесено вручную %d"
          % (len(ids), len(installed), len(pinned), len(gone)))

    if args.ids:
        target = [i.strip() for i in args.ids.split(",") if i.strip()]
    elif args.all:
        target = [i for i in ids if i not in SKIP and i not in gone]
    elif args.used:
        target = [i for i in ids if i not in SKIP and i not in gone and (i in pinned or i in commanded)]
    else:
        target = []

    if not target and not args.list:
        print("нечего делать: укажите --used, --all, --ids или --list")
        return 0

    rows, order = [], target or [i for i in ids if i not in SKIP]
    os.makedirs(CRX_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")

    for eid in order:
        data, name, ver = fetch_crx(eid)
        if not data:
            rows.append((eid, "", "не отдаётся магазином", False))
            continue
        mark = "закреплено" if eid in pinned else ("есть клавиши" if eid in commanded else "")
        if args.list or args.dry_run or eid not in target:
            rows.append((eid, ver, name + (" · " + mark if mark else ""), False))
            continue
        crx = os.path.join(CRX_DIR, eid + ".crx")
        with open(crx, "wb") as f:
            f.write(data)
        reg = os.path.join(EXTERNAL, eid + ".json")
        if os.path.exists(reg):
            os.replace(reg, reg + ".bak-" + stamp)
        with open(reg, "w") as f:
            json.dump({"external_crx": crx, "external_version": ver}, f, indent=2)
        rows.append((eid, ver, name + (" · " + mark if mark else "") + " → прописано", True))

    done = sum(1 for r in rows if r[3])
    print()
    for eid, ver, note, ok in rows:
        print(("+" if ok else " "), eid[:12].ljust(12), (ver or "").ljust(11), note[:60])
    print()
    if done:
        print("прописано расширений: %d · crx в %s · прежние записи с меткой .bak-%s" % (done, CRX_DIR, stamp))
        print("установка произойдёт при следующем старте браузера")
    return 0


if __name__ == "__main__":
    sys.exit(main())
