# Crypto specification

Normative behaviour is the code under `web/js/` plus the selftests and the
Python reference `reference/alberich_reference.py`. These pages describe
that behaviour so another implementation can match.

| Topic | File |
|---|---|
| Modern V3 (current) | [modern-v3.md](modern-v3.md) |
| Research baseline (must match production) | [research-baseline.md](research-baseline.md) |
| Cascade stepping (future option, not live) | [cascade-future.md](cascade-future.md) |
| Threat model | [../threat-model.md](../threat-model.md) |
| Endwalze | [endwalze.md](endwalze.md) |
| Lückenfüller notches `{5,7,9}` | [lueckenfueller.md](lueckenfueller.md) |
| Base-26 | [base26.md](base26.md) |
| Automatic message key | [spruchschluessel.md](spruchschluessel.md) |
| Sheet word | [tafelwort.md](tafelwort.md) |
| Vectors | [test-vectors.md](test-vectors.md) |

Traditional mode follows published M4 wirings in `cipher-data.js` (rotors
I–VIII, Beta/Gamma, UKW Bruno/Caesar). That path is involutory: decrypt
equals encrypt.

Modern V3 is an **experimental rotor protocol**, not a drop-in Enigma and
**not** a modern AEAD. Confidentiality stays a rotor cipher. Integrity is
an HMAC-SHA-256 Prüfgruppe (~94 bits). Replay protection is optional and
in-session only. There is no security proof.

The live apps ship **Modern only** (this V3 path). Engine helpers for the
older Modern V2 telegram remain for tests. A V2 telegram is rejected on a
V3 sheet. A V3 telegram is rejected on a V2 sheet. Old sheets are never
silently treated as V3.
