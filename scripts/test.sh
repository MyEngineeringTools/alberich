#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only

# Run the DOM-free Node selftests shipped with the web app, companions,
# and the independent Python reference.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"

node js/tests/modern-crypto-selftest.js
node js/tests/modern-v3-selftest.js
node js/tests/codebook-selftest.js
node js/tests/courier-qr-selftest.js
node js/tests/secure-random-selftest.mjs

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
