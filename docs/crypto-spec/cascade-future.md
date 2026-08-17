# Future option: reine Lückenfüller-Kaskade

**Status: not live.** Live Modern V3 remains the four-rotor **double-step**
published in Revision 47. This page records a possible later protocol,
not a silent replacement.

Switching would be a **new protocol version**. Existing ALBV telegrams
from 47/49 would no longer decrypt (MAC can still pass; the body becomes
invalid UTF-8). Traditional M4 is unaffected.

## Rule

Notches are read before the move. Right always steps. Carry only if the
driving wheel is on a notch:

```
stepMiddle = rightAtNotch
stepLeft   = stepMiddle && middleAtNotch
stepThin   = stepLeft && leftAtNotch
```

Thin has no notches and drives nothing.

Code (research only, not used by `CipherEngine.step()`):

```text
web/js/modern-v3.js          nextV3PositionsCascade()
research/state-graph.mjs     --smoke compares cascade vs live double-step
```

## Why it exists

Double-step is not injective: two states can share a successor, some
states have no predecessor, cycles can be much shorter than \(26^4\).
The cascade is a 4-wheel odometer with irregular teeth. In samples it is
bijective and often has period \(26^4\).

A full period is **not** a security proof.

## Trade-off

| | Live double-step | Cascade (future) |
|---|---|---|
| Shipped 47 / Android 1a | yes | no |
| Enigma-like extra step | yes | no |
| Thin / Left move often | more often | only on full carry |
| State map | not bijective | bijective (sampled) |
| Typical period | often << \(26^4\) | often \(26^4\) |
| Adopt without a break | — | no |

## If it is ever adopted

1. Give it an explicit protocol id (not a quiet change to `v3`).
2. Change Web, Companion, Thunderbird, Android, and the Python reference
   together.
3. Regenerate golden vectors. Keep a double-step decoder for old mail
   or declare a cut-over date.
4. Bump product revisions. Measure again (`state-graph`, KPA/CPA).
5. Do not claim AES equivalence.

Until then: measure in `research/`, do not wire it into `stepModernV3()`.
