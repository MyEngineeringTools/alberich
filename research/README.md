# Alberich Modern — Cryptanalysis-Labor

Nur synthetische Schlüssel. Keine echten Monatstafeln.

```bash
cd research
node keyspace.mjs
node equivalent-keys.mjs
node stepping-periods.mjs
node base26-statistics.mjs
node diffusion.mjs
node malleability.mjs
node ciphertext-statistics.mjs
node known-plaintext.mjs
node crib-search.mjs
node partial-key-search.mjs
node message-key-analysis.mjs
node benchmark.mjs
```

Ergebnisse: `research/results/*.json`.
Bewertung: `research/results/EVALUATION.md`.

Seeds sind nicht-kryptographisch (`mulberry32`) und in den JSON-Dateien
notiert.

`state-graph.mjs` compares live double-step with the
[cascade future option](../docs/crypto-spec/cascade-future.md). That
option is not the shipped machine.

Die produktive Spezifikation bleibt Traditional plus die sichtbare
Walzenmechanik. Dieses Labor misst, es ersetzt die Maschine nicht.
