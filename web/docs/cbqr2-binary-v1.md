# CBQR2 Binary Format v1

Normative serialization of an internal `ALB3_TIMEBOOK_V1`.
Not a V3 telegram. Not CBQR1. Byte order is **big-endian**.

CBQR2 is lossless transport of already-generated independent V3 keys.
It does not derive keys.

## Identities

| Name | Coverage |
|---|---|
| `codebookFingerprint` | SHA-256 of `ALB3-TIMEBOOK-ID-V1` (W6). Stored as 32 raw bytes. Recomputed on decode. |
| Package digest | SHA-256 of all bytes **except** the final 32-byte digest. |

They are not interchangeable.

## Magic

ASCII `ALB3CB2` (7 bytes: `41 4C 42 33 43 42 32`).
Format version: `uint8` = `1`.
Not `ALBV`.

## Header (prefix 19 bytes + net)

| Offset | Length | Field | Encoding |
|---:|---:|---|---|
| 0 | 7 | magic | `ALB3CB2` |
| 7 | 1 | version | `1` |
| 8 | 1 | flags | must be `0` |
| 9 | 2 | year | uint16 BE, 1900–2100 |
| 11 | 1 | month | 1–12 |
| 12 | 1 | timeProfile | enum |
| 13 | 1 | keyTime | enum |
| 14 | 1 | days | must equal calendar length of year/month |
| 15 | 1 | slotsPerDay | must equal profile |
| 16 | 2 | keyCount | uint16 BE = days × slotsPerDay |
| 18 | 1 | netLen | 1–16 |
| 19 | netLen | net | ASCII `A–Z0–9`, cryptographic PRUEF20 `net` |

### Enums

timeProfile: `0 = DAY_24H`, `1 = HOURS_4`, `2 = HOUR_1`. Other → reject.

keyTime: `1 = ALBERICH_UTC_PLUS_1_FIXED`. Other → reject. No DST, no `Europe/Berlin`.

Decoder ignores payload-claimed day/slot counts that disagree with `year+month+profile`.

Maximum keys: `31 × 24 = 744`. Allocate only from calendar, never from an unbounded claim.

## Payload keys

`keyCount` concatenated `FULL_KEY_BIN_V1` records, chronological:
day 1 slot 0, day 1 slot 1, … last day last slot.

Day numbers and slot indices are **not** stored. Reconstruct with the W5 time kernel.

Then:

| Field | Length |
|---|---:|
| codebookFingerprint | 32 |
| packageDigest | 32 |

`length = 19 + netLen + keyCount × 70 + 64`.

Trailing bytes forbidden. Truncation forbidden.

## FULL_KEY_BIN_V1 (70 bytes)

Same fields as `ALB3-FULLKEY-V1`.

| Offset | Length | Field | Encoding |
|---:|---:|---|---|
| 0 | 1 | rotorThin | rotor id |
| 1 | 1 | rotorLeft | rotor id |
| 2 | 1 | rotorMiddle | rotor id |
| 3 | 1 | rotorRight | rotor id |
| 4 | 4 | rings | uint8 0–25 = A–Z, thin..right |
| 8 | 4 | ground | uint8 0–25, thin..right |
| 12 | 20 | plugboard | 10 canonical pairs, each two uint8 0–25 |
| 32 | 26 | endwalze | permutation uint8 0–25 |
| 58 | 4 | notches left | uint32 BE bitmask |
| 62 | 4 | notches middle | uint32 BE bitmask |
| 66 | 4 | notches right | uint32 BE bitmask |

### Rotor IDs (frozen)

`1 I`, `2 II`, `3 III`, `4 IV`, `5 V`, `6 VI`, `7 VII`, `8 VIII`, `9 Beta`, `10 Gamma`.
`0` unused. Thin must be 9 or 10. Mains 1–8, pairwise distinct. Unknown → reject.

### Plugboard

Exactly 10 pairs. Within a pair first < second. Pairs strictly increasing lexicographically.
No self-pair, no shared letters. Decoder does **not** repair order.

### Endwalze

Bijection of 0–25. Involutions rejected (existing Modern V3 rule).

### Notch masks

Bit `i` = letter `A+i`. Bits 26–31 must be 0. Popcount ∈ {5,7,9}.
Letters implied by the mask are already A→Z sorted.

## Canonicalization

One valid byte string per timebook. Encoder validates the timebook, recomputes fingerprints, writes reserved bits as 0. Decoder accepts only that form.

No timestamps, nonces, or alternative encodings.

## `net`

`networkContext` is the PRUEF20 MAC field (`net:` in `canonicalDayKey` / `canonicalMacInput`), typically `ALB`.
It is **not** the UI network display name (`networks.js` `name`).
It is **not** part of `codebookFingerprint` (W6).
It **is** part of CBQR2 (cryptographic core for messages).

No new normalization: stored bytes must already match `^[A-Z0-9]{1,16}$`.

## Not in CBQR2

MK registry, watermarks, sessions, import time, `generatedAt`, UI names, storage IDs.

## Compression

gzip may wrap **these exact bytes** as a transport layer. gzip is not the canonical identity.
W8 defines that layer as `CBQR2 Transport Envelope v1` (`ALB3Q2`):
[`cbqr2-transport-v1.md`](cbqr2-transport-v1.md). This binary layout is unchanged.

## CBOR

Not used. The layout is a closed record of identical keys; a custom schema is smaller and easier to reimplement in Kotlin without a CBOR library.
