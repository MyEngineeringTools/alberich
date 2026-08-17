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
    -E 'matomo|google-analytics|googletagmanager|analytics\.js|self-hosted analytics' \
    --exclude='robots.txt' --exclude='test-repository.sh' \
    web extensions docs README.md SECURITY.md >/dev/null; then
  bad "telemetry marker found"
else
  ok "zero telemetry scan"
fi
for f in README.md SECURITY.md docs/architecture.md; do
  grep -Fq "no analytics or telemetry" "$f" \
    || grep -Fq "No analytics" "$f" \
    || bad "$f missing zero-telemetry statement"
done
ok "zero-telemetry docs agree"

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
cmp -s LICENSE web/LICENSE || bad "web/LICENSE must match root LICENSE"
grep -Fq 'about.license' web/index.html || bad "About missing license paragraph"
grep -Fq 'href="LICENSE"' web/index.html || bad "web footer/About must link LICENSE"
grep -Fq 'github.com/MyEngineeringTools/alberich' web/js/i18n/de.js || bad "DE About missing source offer"
grep -Fq 'github.com/MyEngineeringTools/alberich' web/js/i18n/en.js || bad "EN About missing source offer"
ok "license notices"

# --- SPDX: first-party has AGPL; vendor must not claim Alberich copyright ---
while IFS= read -r -d '' f; do
  grep -q 'SPDX-License-Identifier: AGPL-3.0-only' "$f" || bad "missing SPDX $f"
done < <(find web/js extensions research reference scripts web/start.sh web/index.html web/styles.css \
    \( -name '*.js' -o -name '*.mjs' -o -name '*.py' -o -name '*.sh' -o -name '*.css' -o -name '*.html' \) \
    -not -path '*/vendor/*' -print0)
ok "first-party SPDX present"

if grep -RIn --exclude-dir=.git 'SPDX-License-Identifier: AGPL-3.0-only' \
    web/js/vendor extensions/browser/shared/vendor extensions/thunderbird/shared/vendor \
    extensions/browser/Firefox/shared/vendor >/dev/null 2>&1; then
  bad "vendor file marked as AGPL-3.0-only"
else
  ok "vendor licences left alone"
fi

# --- CSP ---
csp="$(tr '\n' ' ' < web/index.html | sed -n 's/.*Content-Security-Policy" content="\([^"]*\)".*/\1/p')"
echo "$csp" | grep -q "script-src 'self'" || bad "CSP missing script-src 'self'"
echo "$csp" | grep -q "script-src 'self' 'unsafe-inline'" && bad "CSP script-src still has unsafe-inline"
echo "$csp" | grep -q "style-src 'self' 'unsafe-inline'" || bad "CSP dropped style-src unsafe-inline without replacing vendor QR styles"
python3 - <<'PY' || bad "JSON-LD CSP hash mismatch"
import hashlib, re, base64
from pathlib import Path
html = Path("web/index.html").read_text()
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
if not m:
    raise SystemExit("no JSON-LD block")
digest = base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode()
token = f"'sha256-{digest}'"
if token not in html:
    raise SystemExit(f"expected {token} in CSP")
print("OK   JSON-LD hash", digest)
PY
grep -Fq "unsafe-inline" docs/architecture.md || bad "architecture.md must document remaining style-src unsafe-inline"
grep -Fq 'Content-Security-Policy' web/start.sh || bad "start.sh must apply the index.html CSP"
if grep -q "script-src 'self' 'unsafe-inline'" web/start.sh; then
  bad "start.sh still hardcodes script-src unsafe-inline"
fi
if grep -q "script-src 'self' 'unsafe-inline'" web/.htaccess; then
  bad ".htaccess still has script-src unsafe-inline"
fi
python3 - <<'PY' || bad "CSP sources disagree"
import re
from pathlib import Path
html = Path("web/index.html").read_text()
ht = Path("web/.htaccess").read_text()
m = re.search(r'Content-Security-Policy" content="([^"]+)"', html)
h = re.search(r'Content-Security-Policy "([^"]+)"', ht)
if not m or not h:
    raise SystemExit("missing CSP")
if "unsafe-inline" in m.group(1).split("style-src")[0] and "script-src" in m.group(1):
    script = m.group(1).split("style-src")[0]
    if "'unsafe-inline'" in script:
        raise SystemExit("html script-src still unsafe-inline")
if "'sha256-" not in h.group(1) or "'unsafe-inline'" in h.group(1).split("style-src")[0]:
    raise SystemExit("htaccess script-src weaker than html")
print("OK   index.html and .htaccess script-src both hashed")
PY
ok "CSP hardened and documented"

# --- algorithm provenance ---
# Identity is the file hash, not git ancestry. Shallow CI clones do not
# contain algorithmSourceCommit; requiring it made GitHub Actions fail.
if [[ -f research/results/fingerprint.json ]]; then
  node --input-type=module - <<'JS' || bad "research provenance"
import { readFileSync } from 'node:fs';
import { algorithmFingerprint } from './research/lib.mjs';

const recorded = JSON.parse(readFileSync('research/results/fingerprint.json', 'utf8'));
const live = algorithmFingerprint();
if (!recorded.algorithmFingerprint) {
  throw new Error('fingerprint.json missing algorithmFingerprint');
}
if (recorded.algorithmFingerprint !== live) {
  throw new Error(
    `fingerprint.json ${recorded.algorithmFingerprint} != live ${live}`,
  );
}
console.log('OK   current research fingerprint matches live algorithm', live);
JS
fi
grep -Fq 'refusing release from dirty working tree' scripts/release.sh || bad "release.sh dirty-tree gate"
grep -Fq 'full research reproduction requires a clean working tree' scripts/reproduce-research.sh || bad "reproduce-research dirty-tree gate"
ok "release/research provenance gates"

if [[ -x scripts/verify-vendor.sh ]]; then
  bash scripts/verify-vendor.sh || bad "vendor checksums"
fi

# --- research labelling ---
if [[ -f research/results/stepping-periods.json ]]; then
  grep -Fq '"stepRule": "double-step"' research/results/stepping-periods.json \
    || bad "current stepping-periods.json is not labelled live double-step"
  grep -Fq '"current": true' research/results/stepping-periods.json \
    || bad "current stepping-periods.json missing current:true"
  if grep -Fq '"expectedCurrentBallpark"' research/results/stepping-periods.json; then
    bad "legacy ballpark left in current stepping-periods.json"
  fi
fi
if [[ -d research/results/legacy ]]; then
  while IFS= read -r -d '' f; do
    grep -Fq 'NOT CURRENT' "$f" || bad "legacy result unlabelled $f"
  done < <(find research/results/legacy -name '*.json' -print0)
fi
if [[ -d research/results/future ]]; then
  while IFS= read -r -d '' f; do
    grep -Fq 'NOT CURRENT' "$f" || bad "future result unlabelled $f"
  done < <(find research/results/future -name '*.json' -print0)
fi
while IFS= read -r -d '' f; do
  grep -Fq '"current": true' "$f" || bad "current result unlabelled $f"
done < <(find research/results -maxdepth 1 -name '*.json' -print0)
ok "research results labelled"

# --- extension install path ---
grep -Fq 'scripts/package-extensions.sh' README.md || bad "README missing package-extensions.sh"
grep -Fq 'dist/extensions/chrome/' README.md || bad "README missing dist/extensions/chrome/"
grep -Fq 'alberich-chrome-' README.md || bad "README missing release ZIP names"
ok "extension packaging documented"

if [[ "$fail" -ne 0 ]]; then
  echo "$fail repository check(s) failed"
  exit 1
fi
echo "Repository checks passed."
