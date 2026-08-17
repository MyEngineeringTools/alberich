#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
export TZ=UTC
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"
export SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)"

require_clean_git "refusing release from dirty working tree"
require_cmd git
require_cmd node
require_cmd python3
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

pack() {
  python3 "$ROOT/scripts/write-deterministic-zip.py" \
    --root "$1" \
    --out "$2" \
    --epoch "${SOURCE_DATE_EPOCH}" \
    ${3:+--prefix "$3"}
}

tmp="$(mktemp -d)"
mkdir -p "$tmp/alberich-web"
cp -a "$ROOT/web/." "$tmp/alberich-web/"
sed -i "s/const BUILD_COMMIT = 'unpublished';/const BUILD_COMMIT = '${SHORT}';/" \
  "$tmp/alberich-web/js/app.js"
cp "$OUT/BUILD_INFO.json" "$tmp/alberich-web/BUILD_INFO.json"
find "$tmp/alberich-web" -type d -exec chmod 755 {} +
find "$tmp/alberich-web" -type f -exec chmod 644 {} +
pack "$tmp/alberich-web" "$OUT/alberich-web-${VER}.zip" alberich-web
rm -rf "$tmp"

for browser in chrome edge firefox; do
  find "$ROOT/dist/extensions/${browser}" -type d -exec chmod 755 {} +
  find "$ROOT/dist/extensions/${browser}" -type f -exec chmod 644 {} +
  pack "$ROOT/dist/extensions/${browser}" "$OUT/alberich-${browser}-${VER}.zip"
done

(cd "$OUT" && sha256sum alberich-*.zip BUILD_INFO.json > SHA256SUMS)
echo "Release artefacts in $OUT"
cat "$OUT/SHA256SUMS"
