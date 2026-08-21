# Changelog

Versions in this repository are the same as the shipped apps. There is no
separate GitHub 0.x line.

## 1.0 (Revision 50) — web

Folgt **1.0 (Revision 49)**. Traditional Greek-rotor ring applies
as on the historical M4. Older Traditional traffic whose first ring
letter was not A decrypts differently. Handbook at `/manual/`.
Modern V3 unchanged.

- Web app under `web/` — version `1.0 (Revision 50)`.
- Browser extension under `extensions/browser/` — version `1.0.24`.
- Thunderbird MailExtension under `extensions/thunderbird/` — version `1.0.14`.
- Android (outside this tree) — `1.0 (Revision 29)`, `versionCode` 29.

## 1.0 (Revision 49) — web

Folgt **1.0 (Revision 48)**. Live V3 stepping is again the Revision 47
double-step. The cascade-only step shipped in 48 made authentic 47
telegrams fail as invalid UTF-8 after a valid MAC.

Public-release hygiene on this same revision line (no protocol change):

- Release and full research refuse a dirty working tree. ZIPs carry
  `BUILD_INFO.json` (commit, algorithm fingerprint).
- Input limits are enforced. The 200000 figure is an input guard, not a
  guaranteed encodable length: Base-26 V2 hits `MAX_BASE26_LETTERS`
  sooner. Recommended Modern V3 length remains 4096 characters.
- Release ZIPs are built with `TZ=UTC` and a deterministic ZIP writer.

- Research results labelled by protocol and step rule; legacy three-wheel
  numbers live under `research/results/legacy/` as `NOT CURRENT`.
- `state-graph.mjs` has `--smoke` / `--full`; cascade invertibility is
  documented as a future option only.
- First-party sources carry SPDX headers; vendor licences are untouched.
- Zero-telemetry wording is consistent. Browser companions are packaged
  from `scripts/package-extensions.sh` / GitHub Release ZIPs.
- Endwalze generation fails closed after 64 involutory CSPRNG draws.
  There is no deterministic substitute wiring.
- `script-src` no longer needs `'unsafe-inline'` (JSON-LD is hashed).
  `style-src 'unsafe-inline'` remains for vendor QR HTML.

- Web app under `web/` — version `1.0 (Revision 49)`.
- Browser extension under `extensions/browser/` — version `1.0.24`.
- Thunderbird MailExtension under `extensions/thunderbird/` — version `1.0.14`.
- Android (outside this tree) — `1.0 (Revision 29)`, `versionCode` 29.

## 1.0 (Revision 48) — web

Folgt **1.0 (Revision 47)**. Companion and Thunderbird now use the same
sheet-day `epoch` as Web/Android, so ALBV telegrams verify again.

## 1.0 (Revision 47) — web

Folgt **1.0 (Revision 46)**. V3 auth IKM now includes `ground:`. Endwalze
fallback is a fixed 3-cycle, never an involution. Existing ALBV
Prüfgruppen from Revision 46 will not verify. Telegram shape is
unchanged. Traditional and Modern V2 are unchanged.

- Web app under `web/` — version `1.0 (Revision 47)`.
- Browser extension under `extensions/browser/` — version `1.0.23`.
- Thunderbird MailExtension under `extensions/thunderbird/` — version `1.0.13`.
- Android (outside this tree) — `1.0 (Revision 28)`, `versionCode` 28.
- Shared protocol notes under `docs/crypto-spec/`.
- Golden vectors and a Python reference under `reference/`.

## 1.0 (Revision 46) — web

Folgt **1.0 (Revision 45)**. Studio → this tree. Modern is one procedure
(formerly V3): free end rotor, notches on the sheet, telegram `ALBV`. No
V2 live path. Courier length warning can be ignored if courier is off.
Main window shows `PERM`, not Caesar.

- Historical Enigma M4 simulation (traditional mode) and experimental modern
  rotor mode.
- Web app under `web/` — version `1.0 (Revision 46)`.
- Browser extension under `extensions/browser/` — version `1.0.22`
  (follows store `1.0.21`).
- Thunderbird MailExtension under `extensions/thunderbird/` — version `1.0.12`
  (follows store `1.0.10`).
- Android (outside this tree) — `1.0 (Revision 27)`, `versionCode` 27.
- Shared protocol notes under `docs/crypto-spec/`.
- Golden vectors and a Python reference under `reference/`.

Canonical numbers: [VERSIONS](VERSIONS).
