# Test vectors

Run `bash scripts/test.sh`. These values must keep matching.

## CRC-32 / Tafelwort

| Input | Result |
|---|---|
| UTF-8 `123456789` | CRC `0xCBF43926` |
| `encodeTafelwortLetters(0)` | `AAAAAAA` |
| Demo sheet `examples/demo-month-sheet.json` | **`CXRI YQP`** |
| V3 demo `examples/demo-codebook-v3.json` | **`CPTZ YYH`** |

Canonical payload of the July 2026 two-day demo (empty policy line):

```
ALBTW1
1
2026
7

1|C|Beta|I|II|III|AAAA|WXYZ|AB CD EF|
18|C|Beta|I|II|III|BBBB|ABCD|AB CD EF|
```

Changing `monthLabel` or `generatedAt` must not change the word. Changing
a `ringCode` or `endwalzePolicy` must.

## Modern V3

Golden vectors live in `reference/golden-vectors.json` and are checked by
`web/js/tests/modern-v3-selftest.js` and
`python3 reference/alberich_reference.py --vectors reference/golden-vectors.json`.

Demo V3 sheet word: `CPTZ YYH`. Day 16 of that sheet is the documented
golden day.

## Endwalze

- Bruno and Caesar are permutations and **not** involutory.
- Historical UKW Bruno **is** involutory.
- `inverseWiring(ENDWALZE_BRUNO)` is a two-sided inverse.
- A V3 `endwalzeWiring` is 26 unique A–Z letters and not an involution.

## Lückenfüller

- Allowed counts are exactly `{5, 7, 9}`.
- Fewer than three plug pairs is rejected (`modern.needMinPlugs`).
- V2: pair order does not matter after canonicalisation; same rings + same
  pairs → same notch strings.
- V3: notches are stored on the sheet; unsorted or duplicate letters are
  rejected.

## Courier QR

Prefix `ALBERICH-CTQR1-` plus A–Z only. Max **955** ciphertext letters
(alphanumeric capacity 970 minus the 15-character prefix).
