#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"
enable_node18_webcrypto
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

# Current checked-in results must not pose as live V3 when they are legacy.
if [[ -f research/results/stepping-periods.json ]]; then
  if grep -q 'Left-Kerbe ungenutzt' research/results/stepping-periods.json; then
    echo "FAIL: current stepping-periods.json still describes the three-wheel legacy rule" >&2
    exit 1
  fi
  grep -Fq '"stepRule": "double-step"' research/results/stepping-periods.json \
    || { echo "FAIL: live stepping result is not labelled double-step" >&2; exit 1; }
fi
if [[ -f research/results/v3-stepping-current.json ]]; then
  grep -Fq '"current": true' research/results/v3-stepping-current.json
  grep -Fq '"stepRule": "double-step"' research/results/v3-stepping-current.json \
    || { echo "FAIL: v3-stepping-current.json is not live double-step" >&2; exit 1; }
  if grep -q '"stepRule": "cascade"' research/results/v3-stepping-current.json; then
    echo "FAIL: cascade labelled as current stepping" >&2
    exit 1
  fi
fi
echo "OK   current stepping-periods not a legacy three-wheel file"

node --input-type=module <<'JS'
import { readdirSync, readFileSync } from 'node:fs';
import { algorithmFingerprint } from './research/lib.mjs';
const fp = algorithmFingerprint();
const dir = 'research/results';
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.json')) continue;
  const j = JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
  if (j.current !== true) continue;
  if (j.algorithmFingerprint && j.algorithmFingerprint !== fp) {
    console.error(`FAIL: ${name} fingerprint ${j.algorithmFingerprint} != ${fp}`);
    process.exit(1);
  }
  if (j.stepRule && j.stepRule !== 'double-step') {
    console.error(`FAIL: ${name} current file has stepRule=${j.stepRule}`);
    process.exit(1);
  }
}
console.log('OK   current results match algorithm fingerprint', fp);
JS
