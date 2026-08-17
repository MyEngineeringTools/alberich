#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VER="${1:-}"
if [[ -z "$VER" ]]; then
  VER="$(awk -F= '/^web.display=/{print $2}' VERSIONS | tr -d ' ()' | tr '[:upper:]' '[:lower:]')"
fi
OUT="$ROOT/dist/release"
rm -rf "$OUT"
mkdir -p "$OUT"

bash "$ROOT/scripts/package-extensions.sh"

# Offline web zip — no network assets
tmp="$(mktemp -d)"
mkdir -p "$tmp/alberich-web"
cp -a "$ROOT/web/." "$tmp/alberich-web/"
commit="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unpublished)"
sed -i "s/const BUILD_COMMIT = 'unpublished';/const BUILD_COMMIT = '${commit}';/" \
  "$tmp/alberich-web/js/app.js"
# Keep vendor, drop nothing required for offline run.
(cd "$tmp" && zip -qr "$OUT/alberich-web-${VER}.zip" alberich-web)
rm -rf "$tmp"

(cd "$ROOT/dist/extensions/chrome" && zip -qr "$OUT/alberich-chrome-${VER}.zip" .)
(cd "$ROOT/dist/extensions/edge" && zip -qr "$OUT/alberich-edge-${VER}.zip" .)
(cd "$ROOT/dist/extensions/firefox" && zip -qr "$OUT/alberich-firefox-${VER}.zip" .)

(cd "$OUT" && sha256sum alberich-*.zip > SHA256SUMS)
echo "Release artefacts in $OUT"
cat "$OUT/SHA256SUMS"
