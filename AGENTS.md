# Project Agent Instructions — public Alberich git tree

This clone is the **public snapshot** (`web/`, `extensions/`, crypto spec,
tests). It is **not** the workbench editor.

The private workbench and the Android tree are not part of this repository.
Edit product source there first, then sync into this public snapshot.

If you only have this clone (e.g. GitHub checkout), use the docs **in this
tree**: `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`,
`docs/crypto-spec/`, `docs/threat-model.md`, `SECURITY.md`.

## Read first

- This file
- `README.md`
- `CONTRIBUTING.md`
- `docs/architecture.md`
- `VERSIONS` — **may drift**; prefer manifests and `CHANGELOG.md`. See
  workbench `docs/KNOWN_ISSUES.md` if that tree is available.

## Rules that apply even in this clone

- No bundler, no npm dependency tree.
- Android stays out.
- Chrome panel is companion UI source; `extensions/browser/sync-from-chrome.sh`.
- Do not add Thunderbird `modern-session.js` as unused file.
- Do not call `navigator.storage.persist()`.
- Cipher changes require golden vectors (`scripts/test.sh`) and explicit user
  intent. Fingerprint `909cc1f35c98789c`.
- `git commit -s` (DCO). No push unless asked.

## Commands in this tree

```bash
bash scripts/test.sh
bash scripts/test-research.sh
bash scripts/test-repository.sh
bash scripts/test-packaging.sh
cd web && ./start.sh
```

Sync direction if the workbench exists: workbench → this clone, never reverse.
