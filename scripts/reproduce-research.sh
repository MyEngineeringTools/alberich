#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
#
# Rebuild checked-in Modern V3 research results.
#   --smoke        CI
#   --full         current public results (clean git required)
#   --exhaustive   includes legacy three-wheel walks (clean git required)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib-git.sh
source "$ROOT/scripts/lib-git.sh"
enable_node18_webcrypto

MODE="${1:---smoke}"
echo "reproduce $MODE"

if [[ "$MODE" == "--smoke" ]]; then
  bash "$ROOT/scripts/test-research.sh"
  exit 0
fi

if [[ "$MODE" != "--full" && "$MODE" != "--exhaustive" ]]; then
  echo "usage: $0 --smoke|--full|--exhaustive" >&2
  exit 2
fi

require_clean_git "full research reproduction requires a clean working tree"

node research/keyspace.mjs
node research/base26-statistics.mjs
node research/equivalent-keys.mjs
node research/stepping-periods.mjs "$MODE"
node research/state-graph.mjs "$MODE"
node research/diffusion.mjs
node research/malleability.mjs
node research/ciphertext-statistics.mjs
node research/message-key-analysis.mjs
node research/benchmark.mjs
node research/v3-attacks.mjs "$MODE"

node --input-type=module - <<'JS'
import { writeJson, stampLiveV3, algorithmFingerprint, algorithmRevision, ALGORITHM_SOURCE_FILES } from './research/lib.mjs';
writeJson('fingerprint.json', {
  ...stampLiveV3({ script: 'scripts/reproduce-research.sh', command: `scripts/reproduce-research.sh ${process.argv[1] || '--full'}` }),
  files: [...ALGORITHM_SOURCE_FILES],
  algorithmFingerprint: algorithmFingerprint(),
  algorithmRevision: algorithmRevision(),
});
console.log('wrote research/results/fingerprint.json', algorithmFingerprint());
JS

echo "Research results written. Compare with: git diff -- research/results/"
