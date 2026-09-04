#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
cd "$(dirname "$0")/../.."
node js/tests/modern-crypto-selftest.js
node js/tests/modern-v3-selftest.js
node js/tests/codebook-selftest.js
node js/tests/courier-qr-selftest.js
node js/tests/secure-random-selftest.mjs
node js/tests/full-key-fingerprint-selftest.js
node js/tests/security-state-selftest.js
node js/tests/modern-session-selftest.js
node js/tests/alberich-key-time-selftest.js
node js/tests/timebook-selftest.js
node js/tests/timebook-security-selftest.js
node js/tests/cbqr2-selftest.js
node js/tests/mur-selftest.js
node js/tests/cbqr2-transport-selftest.js
python3 reference/cbqr2_transport_reference.py --selftest
node js/tests/w9-selftest.js
node js/tests/w10-selftest.js
node js/tests/timebook-sheet-view-selftest.js
node js/tests/w10b-layout-selftest.js
node js/tests/qr-layout-selftest.js
node js/tests/limits-selftest.js
node js/tests/v3-protocol-golden-selftest.js
python3 reference/alberich_reference.py --vectors reference/golden-vectors.json
python3 reference/alberich_reference.py --vectors reference/v3-protocol-golden.json
echo "All Alberich web tests + reference vectors passed."
