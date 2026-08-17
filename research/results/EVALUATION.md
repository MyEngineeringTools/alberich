# Modern V3 — evaluation status

Date: 17 August 2026.

These are research-completeness statuses for **live double-step** Modern V3.
They are **not** a cryptographic security rating and not an AES comparison.

| Test | Status | Ergebnis |
| --- | --- | --- |
| Independent implementation | PASS | Python reference matches Web JS |
| Golden vectors | PASS | Live double-step + `ground:` IKM |
| Traditional M4 | PASS | Unchanged involutory vector |
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
| Message-length advice | PASS | Technical max 200000 chars; recommended 4096 |

Technical maximum (`LIMITS.MAX_PLAINTEXT_CHARS` = 200000) is a
memory/BigInt gate. Live double-step periods in the current samples run
from about 2704 to 184548 body letters (median ~11492). A 200000-letter
body can wrap the typical walk more than ten times and can add
autocorrelation for classical period finding. That does **not** by
itself recover the day key.

Recommended Modern V3 Standard length: **4096 plaintext characters**
(~one typical cycle or less after Base-26 V2). This is advice, not a
silent hard fail. The hard fail stays at the technical maximum.

Nominal support, generator entropy, min-entropy, equivalent-key notes and
best demonstrated attack are different numbers. Do not collapse them into
“248-bit security”.
