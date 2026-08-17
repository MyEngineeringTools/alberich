#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }

# --- versions ---
web_disp="$(awk -F= '/^web.display=/{print $2}' VERSIONS)"
browser_ver="$(awk -F= '/^browser.version=/{print $2}' VERSIONS)"
tb_ver="$(awk -F= '/^thunderbird.version=/{print $2}' VERSIONS)"
and_disp="$(awk -F= '/^android.display=/{print $2}' VERSIONS)"

grep -Fq "$web_disp" README.md || bad "README missing $web_disp"
grep -Fq "$browser_ver" README.md || bad "README missing $browser_ver"
grep -Fq "$tb_ver" README.md || bad "README missing $tb_ver"
grep -Fq "Revision ${web_disp##*Revision }" SECURITY.md || bad "SECURITY web revision"
grep -Fq "$browser_ver" extensions/browser/Chrome/manifest.json || bad "Chrome manifest version"
grep -Fq "$tb_ver" extensions/thunderbird/manifest.json || bad "Thunderbird manifest version"
grep -Fq "$web_disp" web/js/app.js || bad "app.js VERSION"
ok "VERSIONS consistent with README/manifests"

# --- telemetry ---
if grep -RIn --exclude-dir=vendor --exclude-dir=.git --exclude-dir=dist \
    -E 'matomo|google-analytics|googletagmanager|analytics.js' \
    --exclude='robots.txt' --exclude='test-repository.sh' \
    web extensions docs README.md SECURITY.md >/dev/null; then
  bad "telemetry marker found"
else
  ok "zero telemetry scan"
fi

# --- first-party JSON ---
while IFS= read -r -d '' f; do
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" || bad "JSON $f"
done < <(find examples reference research/results web/examples extensions -name '*.json' -not -path '*/vendor/*' -print0 2>/dev/null)
ok "first-party JSON parses"

# --- JS syntax ---
while IFS= read -r -d '' f; do
  node --check "$f" || bad "syntax $f"
done < <(find web/js extensions research reference -name '*.js' -o -name '*.mjs' | grep -v '/vendor/' | tr '\n' '\0')
ok "first-party JS syntax"

# --- python ---
python3 -m py_compile reference/alberich_reference.py || bad "python compile"
ok "python reference compiles"

# --- secret scan ---
if grep -RIn --exclude-dir=.git --exclude-dir=vendor --exclude-dir=dist --exclude-dir=node_modules \
    -E 'BEGIN (RSA|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['\''\"][A-Za-z0-9]{16,}' \
    . >/dev/null; then
  bad "secret heuristic hit"
else
  ok "secret scan clean"
fi

# --- AGPL notice ---
grep -Fq 'GNU AFFERO GENERAL PUBLIC LICENSE' LICENSE || bad "LICENSE"
grep -Fq 'AGPL-3.0-only' THIRD_PARTY.md || bad "THIRD_PARTY still denies OSS"
ok "license notices"

if [[ "$fail" -ne 0 ]]; then
  echo "$fail repository check(s) failed"
  exit 1
fi
echo "Repository checks passed."
