#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"
require_clean_git "reproducible-release test requires a clean working tree"

utc="$(mktemp -d)"
berlin="$(mktemp -d)"
cleanup() { rm -rf "$utc" "$berlin"; }
trap cleanup EXIT

echo "— release TZ=UTC —"
TZ=UTC bash "$ROOT/scripts/release.sh"
cp -a "$ROOT/dist/release/." "$utc/"

echo "— release TZ=Europe/Berlin —"
rm -rf "$ROOT/dist/release"
TZ=Europe/Berlin bash "$ROOT/scripts/release.sh"
cp -a "$ROOT/dist/release/." "$berlin/"

fail=0
for name in alberich-web-*.zip alberich-chrome-*.zip alberich-edge-*.zip alberich-firefox-*.zip; do
  a="$(echo "$utc"/$name)"
  b="$(echo "$berlin"/$name)"
  ha="$(sha256sum "$a" | awk '{print $1}')"
  hb="$(sha256sum "$b" | awk '{print $1}')"
  if [[ "$ha" != "$hb" ]]; then
    echo "FAIL  $name"
    echo "  UTC    $ha"
    echo "  Berlin $hb"
    fail=1
  else
    echo "OK    $name"
  fi
done
if [[ "$fail" -ne 0 ]]; then
  echo "Release ZIPs are not timezone-reproducible" >&2
  exit 1
fi
echo "UTC build == Europe/Berlin build"
