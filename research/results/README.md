# Research results

Current files in this directory describe **live Modern V3** (double-step,
Revision 49). That is the algorithm in `CipherEngine.stepModernV3()`.

A file that is current must carry:

```json
{
  "protocol": "Modern V3",
  "algorithmRevision": "modern-v3-rev49-double-step",
  "algorithmFingerprint": "…",
  "stepRule": "double-step",
  "generatorProfile": "Modern V3 Standard",
  "sourceCommit": "…",
  "script": "…",
  "command": "…",
  "generatedAt": "…",
  "current": true
}
```

`generatedAt` is metadata (git commit time during `reproduce-research.sh`).
Replay depends on source commit, script, parameters, and the research PRNG
seed — never on wall-clock time alone.

Production keys use Web Crypto. Checked-in numbers use `mulberry32`.

## Current

| File | Script | What it measures |
|---|---|---|
| `keyspace.json` | `keyspace.mjs` | Support / Shannon / min-entropy / attack pointer |
| `v3-stepping-current.json` | `stepping-periods.mjs` | Live double-step periods |
| `stepping-periods.json` | same | Alias of the live file |
| `state-graph.json` | `state-graph.mjs` | Live map + nested cascade-future block |
| `diffusion.json` | `diffusion.mjs` | Hamming after single-field mutations |
| `malleability.json` | `malleability.mjs` | Prüfgruppe rejects mutants |
| `ciphertext-statistics.json` | `ciphertext-statistics.mjs` | IC, n-grams, same-day messages |
| `v3-attacks.json` | `v3-attacks.mjs` | KPA/CPA/CSP/oracle/multi-message |
| `equivalent-keys.json` | `equivalent-keys.mjs` | Live fields vs V2 dead fields |
| `message-key-analysis.json` | `message-key-analysis.mjs` | 26^4 SK, MID is not a rotor |
| `benchmark.json` | `benchmark.mjs` | Node reference performance |
| `base26-statistics.json` | `base26-statistics.mjs` | Encoding only |
| `fingerprint.json` | `reproduce-research.sh` | Algorithm hash for CI |
| `EVALUATION.md` | hand | Status board, not a security grade |

## Not current

| Path | Meaning |
|---|---|
| `legacy/v2/` | Modern V2 / three-wheel. `NOT CURRENT MODERN V3` |
| `future/` | Cascade option. Invertible, often period \(26^4\). **Not live.** |

The old three-wheel ballpark `{2028,4732,11492,12844,14196}` and any
unpublished “min 11492 / median 195364 / max 298116” series must not be
read as live V3.

Regenerate:

```bash
bash scripts/reproduce-research.sh --smoke
bash scripts/reproduce-research.sh --full
```
