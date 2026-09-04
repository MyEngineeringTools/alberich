# CBQR2 / MUR v1 — Spezifikations-Provenienz

Eingefroren am 2026-09-04 für Alberich CBQR2/MUR **v1**.
Spätere Upstream-Änderungen ändern diesen Stand **nicht** automatisch.

Alberich implementiert die Papiere in-tree. Das ist **keine** Runtime-Dependency
auf Blockchain-Commons-Code. Lizenz der Referenzspezifikationen und
Referenzimplementierungen:

**BSD-2-Clause Plus Patent** (SPDX: `BSD-2-Clause-Patent`)
Copyright © Blockchain Commons, LLC.

Quellen:

| Dokument | Repo | Pfad | Letzter inhaltlicher Commit |
|---|---|---|---|
| Uniform Resources (BCR-2020-005) | [BlockchainCommons/Research](https://github.com/BlockchainCommons/Research) | `papers/bcr-2020-005-ur.md` | `6657889891d1c3395c19eae61e3e5c0336b91ac6` (2025-02-18, „Closes #134“, 2 Zeilen) |
| Bytewords (BCR-2020-012) | Research | `papers/bcr-2020-012-bytewords.md` | `bacd8054be636ec48b0118763384cf6c7f947ab7` (2023-12-03) |
| Multipart UR (BCR-2024-001) | Research | `papers/bcr-2024-001-multipart-ur.md` | `6067e7f706606b28245b437164b814ecfe6969ec` (2024-05-08, „Match URKit test“) |
| C++-Referenzvektoren | [BlockchainCommons/bc-ur](https://github.com/BlockchainCommons/bc-ur) | `test/test.cpp` | `603c21c7412e0e5ef85d0a5a74b0327667d9a8c2` (2020-10-05, Bytewords-Alphabet) |

Alberich-Goldens:

- `reference/mur-bcr-vectors.json` — CRC32, Xoshiro256**, Sampler, Degree, Fragmente, Encoder-CBOR, `ur:bytes` single/multipart
- `reference/cbqr2-transport-golden.json` — RAW-Envelope bytegenau, erste MUR-Frames

Wortliste Bytewords: 256 Wörter à 4 Buchstaben laut BCR-2020-012
(Alphabetisierungsfix vom 2020-10-04 / Issue #45).

Runtime-JS von Blockchain Commons / `@ngraveio/bc-ur` ist **nicht** eingebunden
(siehe `w8-bc-ur-audit.md`).
