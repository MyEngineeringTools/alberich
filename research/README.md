# Alberich Modern — Cryptanalysis-Labor

Only synthetic keys. No operational month sheets.

Live algorithm: **Modern V3 double-step**. Baseline:
[docs/crypto-spec/research-baseline.md](../docs/crypto-spec/research-baseline.md).

```bash
bash scripts/reproduce-research.sh --smoke
bash scripts/reproduce-research.sh --full
```

Scripts: [SCRIPTS.md](SCRIPTS.md). Results: `results/`. Board: `results/EVALUATION.md`.

The research PRNG is `mulberry32` with fixed seeds. Production key
generation uses Web Crypto. Do not mix them.

`state-graph.mjs` also measures the
[cascade future option](../docs/crypto-spec/cascade-future.md). Those
numbers are stored under `results/future/` and are not the shipped machine.
