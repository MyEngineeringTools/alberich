#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "— research smoke —"
for script in research/*.mjs; do
  name="$(basename "$script")"
  [[ "$name" == "lib.mjs" ]] && continue
  echo "RUN  $name --smoke"
  if grep -q -- '--smoke' "$script"; then
    node "$script" --smoke
  else
    timeout 30s node "$script" --smoke 2>/dev/null || timeout 20s node "$script"
  fi
done

echo "Research smoke passed."
