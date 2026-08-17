# Research script classification

Live Modern V3 is **double-step** (`CipherEngine.stepModernV3`). Cascade is
not current. See [research-baseline.md](../docs/crypto-spec/research-baseline.md).

| Script | V2 | V3 current | Legacy V3 | Status |
| ------ | -- | ---------- | --------- | ------ |
| `keyspace.mjs` | comparison only | Standard Profile layers A–E | — | CURRENT |
| `equivalent-keys.mjs` | writes `legacy/v2/` | thin ring / left notch / ground live | — | CURRENT + V2 ONLY archive |
| `stepping-periods.mjs` | `legacy/v2/` | `v3-stepping-current.json` (double-step) | cascade → `future/` | CURRENT |
| `state-graph.mjs` | — | live double-step map | cascade → `future/` | CURRENT |
| `base26-statistics.mjs` | V1 crib note | Base-26 V2 encoding | — | CURRENT (encoding) |
| `diffusion.mjs` | old file in `legacy/v2/` | live V3 Hamming cases | — | CURRENT |
| `malleability.mjs` | old file in `legacy/v2/` | Prüfgruppe mutations | — | CURRENT |
| `ciphertext-statistics.mjs` | old file in `legacy/v2/` | live V3 body stats | — | CURRENT |
| `known-plaintext.mjs` | yes | no (see `v3-attacks.mjs`) | — | V2 ONLY |
| `crib-search.mjs` | yes | no (see `v3-attacks.mjs`) | — | V2 ONLY |
| `partial-key-search.mjs` | yes | no | — | V2 ONLY |
| `message-key-analysis.mjs` | archived | 26^4 + MID note | — | CURRENT |
| `benchmark.mjs` | archived | Node reference performance | — | CURRENT |
| `v3-attacks.mjs` | — | KPA/CPA/CSP/oracle/multi-message | — | PARTIAL V3 |

Status values used above: CURRENT, V2 ONLY, PARTIAL V3.
No script is labelled CURRENT if it still drives the V2 three-wheel path.
