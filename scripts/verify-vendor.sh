#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Verify local vendor SHA-256. Does not download anything.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
check() {
  local want="$1" path="$2"
  local got
  got="$(sha256sum "$path" | awk '{print $1}')"
  if [[ "$got" != "$want" ]]; then
    echo "FAIL $path"
    echo "  want $want"
    echo "  got  $got"
    fail=1
  else
    echo "OK   $path"
  fi
}
check 86e07bd03bcfd50b44f3a86fe6776cba7169b1a47f4aed4216c489780743ce14 web/js/vendor/qrcode-generator.js
check 0cc13af85aa680b6b268dc9589af57371722745a8a43a00d30d826d8be186e0d web/js/vendor/jsQR.js
check 1efaee3f58d95b958ae7ef359cfcd058c53f706247915803334c31cb5f2ece4e web/js/vendor/fflate-browser.js
if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "Vendor checksums match."
