#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only

# Run the DOM-free Node selftests shipped with the web app, companions,
# and the independent Python reference.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"
enable_node18_webcrypto
cd "$ROOT/web"

# package.json "type": "module" markers so Node 18 accepts import in *.js
# (Node 20.19+/22 detect ESM from syntax; Node 18 does not).
node js/tests/modern-crypto-selftest.js
node js/tests/modern-v3-selftest.js
node js/tests/codebook-selftest.js
node js/tests/courier-qr-selftest.js
node js/tests/secure-random-selftest.mjs
node js/tests/limits-selftest.js

echo
echo "— algorithm fingerprint —"
cd "$ROOT"
node research/fingerprint-selftest.mjs

echo
echo "— browser companion —"
cd "$ROOT/extensions/browser"
node shared/tests/selftest.mjs
node shared/tests/courier-qr-selftest.mjs

echo
echo "— thunderbird —"
cd "$ROOT/extensions/thunderbird"
node shared/tests/selftest.mjs
node shared/tests/courier-qr-selftest.mjs

echo
echo "— python reference —"
cd "$ROOT"
python3 reference/alberich_reference.py --vectors reference/golden-vectors.json

echo
echo "All selftests passed."
