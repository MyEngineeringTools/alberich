#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Chrome als UI-Quelle → Edge (1:1) + Firefox (Panel + shared-Kopie)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

for rel in panel background offscreen icons _locales; do
  rsync -a --delete "$ROOT/Chrome/$rel/" "$ROOT/Edge/$rel/"
done
ln -sfn ../shared "$ROOT/Edge/shared"
ln -sfn ../shared "$ROOT/Chrome/shared"

cp -f "$ROOT/Chrome/panel/panel.html" "$ROOT/Firefox/panel/panel.html"
cp -f "$ROOT/Chrome/panel/panel.css" "$ROOT/Firefox/panel/panel.css"
cp -f "$ROOT/Chrome/panel/panel.js" "$ROOT/Firefox/panel/panel.js"
rsync -a --delete "$ROOT/shared/" "$ROOT/Firefox/shared/"

# Icons 16/32/48/128 angleichen, falls vorhanden
if [[ -f "$ROOT/Chrome/icons/icon-128.png" ]]; then
  cp -f "$ROOT/Chrome/icons/"icon-*.png "$ROOT/Edge/icons/" 2>/dev/null || true
  cp -f "$ROOT/Chrome/icons/"icon-*.png "$ROOT/Firefox/icons/" 2>/dev/null || true
fi

echo "Synced Chrome → Edge; Chrome panel + shared → Firefox."
echo "Note: Firefox keeps its own manifest.json and background/service-worker.js"
