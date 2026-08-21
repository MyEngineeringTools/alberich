# Modern V3 — evaluation status

Date: 17 August 2026.

These are research-completeness statuses for **live double-step** Modern V3.
They are **not** a cryptographic security rating and not an AES comparison.

| Test | Status | Ergebnis |
| --- | --- | --- |
| Independent implementation | PASS | Python reference matches Web JS |
| Golden vectors | PASS | Live double-step + `ground:` IKM |
| Traditional M4 | PASS | Involutory; four rings including Greek (Web Revision 50) |
| State graph (live) | PASS | Not bijective; typical period \(\ll 26^4\) |
| State graph (cascade, future) | PASS | Invertible; period \(26^4\) for `{5,7,9}` |
| Stepping period (live) | PASS | Measured; not a full cycle |
| Diffusion | PASS | Hamming measured; no avalanche claim |
| Ciphertext statistics | PASS | IC / n-grams / same-day sample |
| Malleability | PASS | No mutant released plaintext |
| V3 KPA | PARTIAL | Crib filter only; no day-key break |
| V3 CPA | PARTIAL | Chosen strings measured; no recovery |
| Plugboard recovery | NOT TESTED | |
| Endwalze CSP | PARTIAL | Leftover factorial after known images |
| Multi-message | PARTIAL | Birthday vs Monte-Carlo on SK/MID |
| Candidate oracle (HMAC) | PASS | Wrong day key → `modern.macFailed` |
| Formal security proof | NONE | |
| Message-length advice | PASS | UI guard 200000 chars; Base-26 cap is tighter; recommended 4096 |

Three different ceilings:

1. **UI/input guard** — `MAX_PLAINTEXT_CHARS` = 200000 characters accepted
   before processing. This is not “200000 characters always encrypt”.
2. **Transport bound** — `MAX_BASE26_LETTERS` = 200000 body letters. Base-26
   V2 needs `minDigitsForByteLen(L)` letters for `L` UTF-8 bytes
   (≈ `L · log(256)/log(26)`). `maxByteLenForDigits(200000)` = **117510
   UTF-8 bytes**; long ASCII hits this first.
3. **Recommended Modern V3** — **4096 plaintext characters**. Live
   double-step periods in current samples run from about 2704 to ~1e5 body
   letters (median ~10k). Advice, not a hard fail.

Nominal support, generator entropy, min-entropy, equivalent-key notes and
best demonstrated attack are different numbers. Do not collapse them into
“248-bit security”.
