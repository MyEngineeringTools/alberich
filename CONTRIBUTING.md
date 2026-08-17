# Contributing

Alberich is a small solo project. Patches are welcome if they stay focused.

## Before you start

- Read [docs/crypto-spec/overview.md](docs/crypto-spec/overview.md). Behaviour
  that disagrees with the spec or the golden vectors is a bug.
- Product versions live in [VERSIONS](VERSIONS). They are the same numbers
  as the shipped apps (web Revision 47 is Revision 47, not a GitHub-only
  0.x). Bump that file first, then `web/js/app.js`, `web/index.html`, the
  extension manifests, and (outside this tree) Android `version.properties`.
  Do not let studio copies drift. Sync studio → this tree, never the reverse.
- Keep the web app a static site. Do not add a bundler or a package.json just
  to look like a workspace.
- Android stays out of this tree.
- Browser companion lives in `extensions/browser/`. Chrome is the UI
  source; run `sync-from-chrome.sh` after panel changes.
- Thunderbird lives in `extensions/thunderbird/`. Do not invent a third
  crypto copy; keep it aligned with `web/js/` and the browser shared tree.

## How to send a change

1. Fork and branch from `main`.
2. Match the existing style (ES modules, no framework, DE/EN i18n together).
3. Run `bash scripts/test.sh`, `test-research.sh`, `test-repository.sh`, and `test-packaging.sh`.
4. Commit with `git commit -s`. That adds `Signed-off-by: Name <email>`, the
   Developer Certificate of Origin. There is no CLA.
5. If you add or remove third-party code, update `THIRD_PARTY.md`, the vendor
   license files, and the About dialog. Notices must match what the release
   actually ships.
6. Open a pull request with a complete-sentence description of *what* and *why*.

By submitting a contribution you certify the Developer Certificate of Origin
(DCO 1.1): you wrote the change or have the right to submit it under
**AGPL-3.0-only**, and you license it under those terms. You keep your
copyright. There is no CLA. This project is not dual-licensed.

## License headers

First-party source files use:

```
SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
SPDX-License-Identifier: AGPL-3.0-only
```

Do not put that header on `**/vendor/**` or other third-party files.

## What we will not merge

- Operational month sheets or real daily keys
- Tracking SDKs
- Features that are not in the shipped spec
- Drive-by refactors that do not serve the change
