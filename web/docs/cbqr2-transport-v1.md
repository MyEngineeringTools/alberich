# CBQR2 Transport Envelope v1

Wraps **canonical CBQR2 bytes** for QR / MUR. Not a codebook identity.
Does not change `CBQR2 Binary Format v1`.

```
ALB3_TIMEBOOK_V1
        ↓
CBQR2 canonical bytes
        ↓
CBQR2 TRANSPORT ENVELOPE   ← this document
        ↓
Single QR  or  MUR / Fountain
```

gzip is transport only. Two gzip implementations may emit different
compressed bytes for the same CBQR2. `codebookFingerprint` is always
over the reconstructed timebook. The CBQR2 package digest is always over
the inner canonical CBQR2 bytes.

## Magic

ASCII `ALB3Q2` (6 bytes: `41 4C 42 33 51 32`).
Not `ALB3CB2`. Not `ALBV`.

## Layout (big-endian)

| Offset | Length | Field | Encoding |
|---:|---:|---|---|
| 0 | 6 | magic | `ALB3Q2` |
| 6 | 1 | version | `1` |
| 7 | 1 | codec | enum |
| 8 | 4 | uncompressedLength | uint32 BE = CBQR2 byte length |
| 12 | rest | payload | codec-dependent |

Header is 12 bytes. Trailing bytes after the payload are part of the
payload (the envelope has no inner length field for the compressed
form; the payload is “the rest”).

## Version

`1`. Unknown version → reject.

## Codec

| id | name | payload |
|---:|---|---|
| 0 | RAW | exact canonical CBQR2 bytes |
| 1 | GZIP | gzip of those exact bytes |

No string names. No “maybe gzip” sniffing of payload magic.
Unknown codec → reject.

## RAW

`payload.length` must equal `uncompressedLength`.
Decoder returns the payload as CBQR2 bytes. Caller then `decodeCbqr2()`.

## GZIP

Payload is a gzip member of the CBQR2 bytes. After decompression:

`actual length == uncompressedLength`

else reject.

Encoder prefers `CompressionStream("gzip")`. If that API is missing,
the already-vendored `fflate` gzip is a fallback. RAW must remain
possible without gzip. **Do not treat gzip bytes as canonical.**

## Length protection

`uncompressedLength` is the expected CBQR2 size.

- `uncompressedLength ∈ [1, MAX_CBQR2_BYTES]`
- After gzip, abort as soon as output exceeds
  `min(uncompressedLength, MAX_CBQR2_BYTES)` (gzip-bomb)
- Transport payload ≤ `MAX_CBQR2_BYTES + 256`
- Envelope ≤ `12 + MAX_CBQR2_BYTES + 256`

`MAX_CBQR2_BYTES = 52179` = W7 formula for 31-day `HOUR_1` with
`netLen = 16`: `19 + 16 + 744×70 + 64`.

## Golden

`reference/cbqr2-transport-golden.json`

- RAW envelope of a 16-byte fixture is **byte-exact**.
- GZIP is roundtrip-only (native gzip ≠ fflate ≠ Python gzip).

Independent decoder: `reference/cbqr2_transport_reference.py`.

## Static text (lab, not product GUI)

Scanner-friendly wrapping of an already-built envelope:

```
ALBERICH-CBQR2|v1|<base64url>
```

Base64url, no padding. The envelope still carries codec/version.
This is not CBQR1 (`ALBERICH-CBQR1|gzip|<standard-base64>`).
Not wired to the share button in W8.

## Errors

Decoder fail-closed: `IMPORT_REJECTED` plus `transport.err.*`.
Product logs: error name only. Never log envelope bytes, CBQR2, keys,
or UR frames of real codebooks.
