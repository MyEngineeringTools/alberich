#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"

require_clean_git "refusing release from dirty working tree"
require_cmd git
require_cmd node
require_cmd python3
require_cmd zip
require_cmd sha256sum
require_cmd awk

VER="${1:-}"
if [[ -z "$VER" ]]; then
  VER="$(awk -F= '/^web.display=/{print $2}' VERSIONS | tr -d ' ()' | tr '[:upper:]' '[:lower:]')"
fi
if [[ -z "$VER" ]]; then
  echo "ERROR: could not read version from VERSIONS" >&2
  exit 1
fi

COMMIT="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
OUT="$ROOT/dist/release"
rm -rf "$OUT"
mkdir -p "$OUT"

bash "$ROOT/scripts/package-extensions.sh"

export COMMIT VER
node --input-type=module - <<'JS'
import { writeFileSync } from 'node:fs';
import { algorithmFingerprint, algorithmRevision } from './research/lib.mjs';
const info = {
  version: process.env.VER,
  gitCommit: process.env.COMMIT,
  protocol: 'Modern V3',
  algorithmRevision: algorithmRevision(),
  algorithmFingerprint: algorithmFingerprint(),
  stepRule: 'double-step',
};
writeFileSync('dist/release/BUILD_INFO.json', `${JSON.stringify(info, null, 2)}\n`);
console.log('BUILD_INFO', info.gitCommit, info.algorithmFingerprint);
JS

EPOCH="$(git log -1 --format=%ct)"
stamp() {
  find "$1" -exec touch -d "@${EPOCH}" {} +
}

tmp="$(mktemp -d)"
mkdir -p "$tmp/alberich-web"
cp -a "$ROOT/web/." "$tmp/alberich-web/"
sed -i "s/const BUILD_COMMIT = 'unpublished';/const BUILD_COMMIT = '${SHORT}';/" \
  "$tmp/alberich-web/js/app.js"
cp "$OUT/BUILD_INFO.json" "$tmp/alberich-web/BUILD_INFO.json"
stamp "$tmp/alberich-web"
(cd "$tmp" && zip -Xqr "$OUT/alberich-web-${VER}.zip" alberich-web)
rm -rf "$tmp"

for browser in chrome edge firefox; do
  stamp "$ROOT/dist/extensions/${browser}"
  (cd "$ROOT/dist/extensions/${browser}" && zip -Xqr "$OUT/alberich-${browser}-${VER}.zip" .)
done

(cd "$OUT" && sha256sum alberich-*.zip BUILD_INFO.json > SHA256SUMS)
echo "Release artefacts in $OUT"
cat "$OUT/SHA256SUMS"
