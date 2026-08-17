#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/package-extensions.sh"
DIST="$ROOT/dist/extensions"

links="$(find "$DIST" -type l || true)"
if [[ -n "$links" ]]; then
  echo "FAIL: symlinks in packaged extensions:" >&2
  echo "$links" >&2
  exit 1
fi

for browser in chrome edge firefox; do
  dir="$DIST/$browser"
  test -f "$dir/manifest.json" || { echo "FAIL: $browser missing manifest"; exit 1; }
  python3 - <<PY
import json
from pathlib import Path
p = Path("$dir/manifest.json")
json.loads(p.read_text())
print("OK   $browser manifest JSON")
PY
  test -f "$dir/shared/crypto/modern-v3.js" || { echo "FAIL: $browser missing modern-v3"; exit 1; }
  test -f "$dir/shared/crypto/cipher-engine.js" || { echo "FAIL: $browser missing engine"; exit 1; }
done

# Required Chrome/Edge UI files
for rel in panel/panel.html panel/panel.js background/service-worker.js; do
  test -f "$DIST/chrome/$rel" || { echo "FAIL: chrome missing $rel"; exit 1; }
  test -f "$DIST/edge/$rel" || { echo "FAIL: edge missing $rel"; exit 1; }
done
test -f "$DIST/firefox/panel/panel.html" || { echo "FAIL: firefox missing panel"; exit 1; }

diff -q "$DIST/chrome/shared/crypto/modern-v3.js" "$ROOT/extensions/browser/shared/crypto/modern-v3.js"
echo "OK   packaged shared crypto matches source"
echo "Packaging checks passed."
