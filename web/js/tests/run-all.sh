#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# shellcheck source=../../scripts/lib-git.sh
if [[ -f "$ROOT/scripts/lib-git.sh" ]]; then
  # shellcheck source=../../scripts/lib-git.sh
  source "$ROOT/scripts/lib-git.sh"
  enable_node18_webcrypto
fi
cd "$(dirname "$0")/../.."
node js/tests/modern-crypto-selftest.js
node js/tests/modern-v3-selftest.js
node js/tests/codebook-selftest.js
node js/tests/courier-qr-selftest.js
python3 reference/alberich_reference.py --vectors reference/golden-vectors.json
echo "All Alberich web tests + reference vectors passed."
