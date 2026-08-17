# Modern V3 — evaluation status

Date: 17 August 2026.

These are engineering / research statuses. They are **not** a cryptographic
security rating and not an AES comparison.

| Area | Status | Notes |
|---|---|---|
| Independent implementation | PASS | Python reference matches Web JS |
| Golden vectors | PASS | Match live double-step + `ground:` IKM |
| Traditional M4 | PASS | Unchanged, involutory vector kept |
| V3 state graph (cascade) | PASS | Bijection on sampled full `26^4` maps |
| V3 state graph (old double-step) | OPEN | Short cycles; not live |
| V3 KPA | PARTIAL | Crib filter implemented; no day-key break |
| V3 CPA | PARTIAL | Chosen strings measured; no recovery |
| Plugboard recovery | NOT TESTED | Hillclimb/SA reserved |
| Endwalze CSP | PARTIAL | Known-mapping leftover factorial only |
| HMAC as oracle | PASS | Wrong ground → `modern.macFailed` before plaintext |
| Multi-message / birthday | PARTIAL | Header collisions counted; 26^4 is small |
| Formal security proof | NONE | |

Nominal configuration support, generator entropy, min-entropy, equivalent-key
adjustment and best demonstrated attack are different numbers. Do not collapse
them into “248-bit security”.
