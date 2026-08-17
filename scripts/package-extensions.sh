#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Build symlink-free extension trees under dist/extensions/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/extensions"
SHARED="$ROOT/extensions/browser/shared"

rm -rf "$DIST"
mkdir -p "$DIST/chrome" "$DIST/edge" "$DIST/firefox"

copy_tree() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  tar -C "$src" --exclude='shared' -cf - . | tar -C "$dest" -xf -
}

copy_tree "$ROOT/extensions/browser/Chrome" "$DIST/chrome"
copy_tree "$ROOT/extensions/browser/Edge" "$DIST/edge"
# Firefox already vendors a shared copy; still overwrite from the canonical tree.
copy_tree "$ROOT/extensions/browser/Firefox" "$DIST/firefox"

for dest in "$DIST/chrome" "$DIST/edge" "$DIST/firefox"; do
  rm -rf "$dest/shared"
  mkdir -p "$dest/shared"
  tar -C "$SHARED" -cf - . | tar -C "$dest/shared" -xf -
done

# Firefox keeps its own background/manifest; shared crypto must match Chrome source.
if ! diff -q "$DIST/chrome/shared/crypto/modern-v3.js" "$ROOT/web/js/modern-v3.js" >/dev/null; then
  echo "WARN: packaged modern-v3.js differs from web/js/modern-v3.js" >&2
fi

echo "Packed extensions into $DIST"
links="$(find "$DIST" -type l || true)"
if [[ -n "$links" ]]; then
  echo "ERROR: symlinks in dist:" >&2
  echo "$links" >&2
  exit 1
fi
echo "No symlinks in dist/extensions."
