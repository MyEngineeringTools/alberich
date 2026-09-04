# CBQR2 MUR / Fountain (W8)

Multipart transport of a **CBQR2 Transport Envelope**.

**Alberich CBQR2/MUR v1 implementiert den hier eingefrorenen Spezifikationsstand.**
Spätere Änderungen upstream ändern Alberich v1 nicht automatisch.
Commits und Lizenz: [`cbqr2-mur-provenance.md`](cbqr2-mur-provenance.md).

Normative references (spec wins over any library):

- BCR-2020-005 Uniform Resources
- BCR-2020-012 Bytewords
- BCR-2024-001 Multipart UR (MUR)

Alberich implements those papers in-tree (`js/mur-fountain.js`,
`js/ur-bytes.js`, `js/bytewords.js`, `js/cbor-lite.js`).
`@ngraveio/bc-ur` is **not** a product dependency (see
[`w8-bc-ur-audit.md`](w8-bc-ur-audit.md)).
The W8 engine files are frozen for W9 unless a concrete bug appears.

## UR type

`bytes`

The UR message is a CBOR byte string wrapping the transport envelope.
No `ur:alberich-codebook`. No new Blockchain Commons registry type.

```
ur:bytes/<bytewords>                 # single-part (seqLen == 1)
ur:bytes/<seqNum>-<seqLen>/<bytewords>  # multipart
```

Multipart bytewords encode the CBOR array

```
[seqNum, seqLen, messageLen, checksum, data]
```

as specified in BCR-2024-001. First `seqLen` parts are pure fragments;
later parts are mixed XOR fountain fragments. The encoder may emit
forever.

## Decoder identity

From the first valid multipart part the decoder locks:

- UR type (`bytes`)
- `seqLen`, `messageLen`, `checksum`
- fragment data length

Contradictory frames are dropped. They do not mix into decoder state.
Foreign streams of a second envelope therefore cannot reconstruct a
chimera.

## Acceptance pipeline

MUR complete is **not** a valid codebook.

```
MUR complete
  → unwrap ur:bytes CBOR bstr
  → Transport Envelope decode
  → GZIP/RAW
  → decodeCbqr2()
  → package digest
  → codebookFingerprint
  → timebook validation
  → ACCEPTED
```

## Engineering progress

`estimatedPercentComplete` from BCR-2024-001:

`min(0.99, processedPartsCount / (seqLen × 1.75))`, and `1.0` only when
the message is reconstructed.

It is monotonic non-decreasing. Duplicate frames still increment
`processedPartsCount`, so the percentage can rise without new fragments.
`100 %` means complete. Not a UI.

## Test safety cap

Selftests stop at `10 × seqLen` generated frames. That is **not** a
production animation limit.

## Goldens

- BCR vectors: `reference/mur-bcr-vectors.json`
- Alberich frames: `reference/cbqr2-transport-golden.json` (`mur.firstFrames`)
  for maxFragmentLength 20, minFragmentLength 10, firstSeqNum 0.

## Android later

Same UR strings, same envelope. No Android code in W8. A future Kotlin
port should follow these papers plus the envelope layout, not a JS
library’s incidental encoding.
