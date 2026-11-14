#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Store-ZIPs ohne Tests, ohne Nested-Zips, ohne Symlinks.
# modern-session.js bleibt (Browser nutzt Pin-über-Uhr).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHARED="$ROOT/shared"
DIST="$ROOT/dist"
STAGE="$DIST/stage"

rm -rf "$STAGE"
mkdir -p "$DIST"

pack_one() {
  local name="$1"
  local src="$ROOT/$name"
  local dest="$STAGE/$name"
  local manifest="$src/manifest.json"
  test -f "$manifest" || { echo "missing $manifest" >&2; exit 1; }
  local version
  version="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$manifest")"
  mkdir -p "$dest"

  rsync -a \
    --copy-links \
    --exclude 'shared/' \
    --exclude '*.zip' \
    --exclude '*.xpi' \
    --exclude '.DS_Store' \
    --exclude 'README.md' \
    "$src/" "$dest/"

  mkdir -p "$dest/shared"
  rsync -a \
    --exclude 'tests/' \
    --exclude 'samples/README.md' \
    --exclude '*.zip' \
    "$SHARED/" "$dest/shared/"

  # Firefox-Popup gibt es nicht; messages-de.js wäre ungenutzt (ATN/AMO-Klasse).
  if [[ "$name" == "Firefox" ]]; then
    rm -f "$dest/shared/messages-de.js"
  fi

  python3 - "$dest" <<'PY'
import json, re, sys
from collections import deque
from pathlib import Path

src = Path(sys.argv[1]).resolve()
import_re = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]""")
html_script_re = re.compile(r"""<script[^>]+src=["']([^"']+)["']""", re.I)

def resolve(from_file: Path, spec: str):
    if not spec.startswith("."):
        return None
    target = (from_file.parent / spec).resolve()
    if target.suffix == "":
        for ext in (".js", ".mjs"):
            cand = Path(str(target) + ext)
            if cand.is_file():
                return cand
        index = target / "index.js"
        if index.is_file():
            return index
        return None
    return target if target.is_file() else None

entries = []
for html in src.rglob("*.html"):
    text = html.read_text(encoding="utf-8")
    for match in html_script_re.finditer(text):
        candidate = (html.parent / match.group(1)).resolve()
        if candidate.is_file() and candidate.suffix in {".js", ".mjs"}:
            entries.append(candidate)

manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
bg = manifest.get("background") or {}
for script in bg.get("scripts") or []:
    candidate = (src / script).resolve()
    if candidate.is_file():
        entries.append(candidate)
sw = bg.get("service_worker")
if sw:
    candidate = (src / sw).resolve()
    if candidate.is_file():
        entries.append(candidate)

seen = set()
queue = deque(entries)
while queue:
    current = queue.popleft().resolve()
    if current in seen or not current.is_file():
        continue
    seen.add(current)
    if current.suffix not in {".js", ".mjs"}:
        continue
    text = current.read_text(encoding="utf-8")
    for match in import_re.finditer(text):
        nxt = resolve(current, match.group(1))
        if nxt is None:
            continue
        try:
            nxt.relative_to(src)
        except ValueError:
            continue
        queue.append(nxt)

unused = sorted(
    p for p in list(src.rglob("*.js")) + list(src.rglob("*.mjs"))
    if p.resolve() not in seen
)
if unused:
    for path in unused:
        print(f"unreachable JS: {path.relative_to(src)}", file=sys.stderr)
    raise SystemExit("Refusing to pack unreachable JavaScript")
if not (src / "shared/timebook/modern-session.js").is_file():
    raise SystemExit("browser pack missing modern-session.js")
print(f"OK reachability {src.name}: {len(seen)} JS modules")
PY

  local out="$DIST/alberich-companion-${name,,}-${version}.zip"
  rm -f "$out"
  (
    cd "$dest"
    find . -type f ! -name '.DS_Store' | LC_ALL=C sort | zip -q -X -@ "$out"
  )
  python3 - "$out" "$version" "$name" <<'PY'
import sys, zipfile
path, version, name = sys.argv[1], sys.argv[2], sys.argv[3]
forbidden = ("shared/tests/", "samples/README.md")
if name == "Firefox":
    forbidden += ("messages-de.js",)
with zipfile.ZipFile(path) as z:
    names = z.namelist()
    if any(n.endswith(".zip") or n.endswith(".xpi") for n in names):
        raise SystemExit("nested archive in zip")
    for n in names:
        for bad in forbidden:
            if bad in n:
                raise SystemExit(f"forbidden path in {name} zip: {n}")
    if name != "Firefox" and not any("modern-session.js" in n for n in names):
        raise SystemExit("modern-session.js missing from browser zip")
    if name == "Firefox" and not any("modern-session.js" in n for n in names):
        raise SystemExit("modern-session.js missing from Firefox zip")
print(f"OK zip {path}")
PY
}

pack_one Chrome
pack_one Edge
pack_one Firefox
echo "Packed into $DIST"
