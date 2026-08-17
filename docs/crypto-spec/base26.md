# Base-26

Modern maps UTF-8 to A–Z so the machine stays on letters.

## V3 — Base-26 V2 (whole message as integer)

The whole UTF-8 message is one big-endian integer. The letter count `k`
determines the byte length `L` uniquely, because
`k = min{ n | 26^n ≥ 256^L }` is strictly increasing in `L`.

Empty stays empty. Invalid `k`, value ≥ 256^L, or non-UTF-8 → error.

The V1 A–J pattern on every even position is gone for longer texts. The
most-significant digit stays slightly biased — that is not sold as
avalanche.

## V2 / legacy — Base-26 V1 (byte pairs)

Encode one byte `b` (0–255):

- high = `floor(b / 26)` → letter
- low = `b mod 26` → letter

Decode: `value = high * 26 + low`. Values above 255 are skipped. An odd
trailing letter is dropped. Invalid UTF-8 becomes U+FFFD (`TextDecoder`).

A plaintext of `n` UTF-8 bytes becomes `2n` body letters. Every even
position is only A–J. Legacy V2 telegrams still use this encoding.
