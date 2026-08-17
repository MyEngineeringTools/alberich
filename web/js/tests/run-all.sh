#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node js/tests/modern-crypto-selftest.js
node js/tests/modern-v3-selftest.js
node js/tests/codebook-selftest.js
node js/tests/courier-qr-selftest.js
python3 reference/alberich_reference.py --vectors reference/golden-vectors.json
echo "All Alberich web tests + reference vectors passed."
