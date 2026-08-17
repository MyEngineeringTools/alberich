# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Shared git gates for release and full research reproduction.

require_clean_git() {
  local reason="${1:-refusing to continue from a dirty working tree}"
  if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "ERROR: no HEAD commit" >&2
    exit 1
  fi
  if [[ -d .git/rebase-merge || -d .git/rebase-apply || -f .git/MERGE_HEAD || -f .git/CHERRY_PICK_HEAD ]]; then
    echo "ERROR: refuse merge/rebase/cherry-pick state" >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: ${reason}" >&2
    git status --short >&2
    exit 1
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing tool: $1" >&2
    exit 1
  }
}
