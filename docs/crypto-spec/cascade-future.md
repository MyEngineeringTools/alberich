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
research/state-graph.mjs     --smoke / --full
```

## Why the step map is invertible

Write a state as \((T,L,M,R) \in (\mathbb{Z}/26\mathbb{Z})^4\). The cascade is

\[
\begin{aligned}
R' &= R+1,\\
M' &= M + [R \in N_R],\\
L' &= L + [R \in N_R]\,[M \in N_M],\\
T' &= T + [R \in N_R]\,[M \in N_M]\,[L \in N_L].
\end{aligned}
\]

From the new state \((T',L',M',R')\) the unique predecessor is recovered
in this order:

1. Previous Right: \(R = R' - 1\). Right always advanced by one.
2. Middle moved if and only if that previous Right stood on a notch
   (\(R \in N_R\)).
3. Previous Middle: \(M = M' - 1\) if Middle moved, else \(M = M'\).
4. Left moved if and only if Middle moved **and** that previous Middle
   stood on a notch.
5. Previous Left: \(L = L' - 1\) if Left moved, else \(L = L'\).
6. Thin moved if and only if Left moved **and** that previous Left stood
   on a notch.
7. Previous Thin: \(T = T' - 1\) if Thin moved, else \(T = T'\).

Each step is forced. The predecessor is unique, so the map is injective.
A finite set therefore makes it bijective, hence invertible.

`research/state-graph.mjs` checks this reconstruction on every one of the
\(26^4 = 456976\) states for each tested notch triple.

Live double-step is **not** of this form: Middle (resp. Left) can also
advance because *it* is on a notch. Two states can share a successor, so
that map is not injective.

## Why counts \(\{5,7,9\}\) give period \(26^4\)

\[
\gcd(5,26)=\gcd(7,26)=\gcd(9,26)=1.
\]

The cascade is an irregular odometer. Over one Right revolution (26
steps) Middle advances exactly \(|N_R|\) times.

- After \(t\) Right revolutions, \(R\) is back and \(M\) has moved by
  \(t\cdot|N_R|\). The first return of the pair \((M,R)\) needs
  \(26 \mid t\cdot|N_R|\). Because \(\gcd(|N_R|,26)=1\), this forces
  \(26 \mid t\). So \((M,R)\) has period \(26^2\).
- In one such period every pair \((M,R)\) occurs once. Left advances on
  pairs with \(R \in N_R\) and \(M \in N_M\), hence by
  \(|N_M|\cdot|N_R|\). After \(t\) periods of \((M,R)\),
  \(L\) has moved by \(t\cdot|N_M|\cdot|N_R|\). Coprimality of both
  counts to 26 implies \(\gcd(|N_M|\cdot|N_R|,26)=1\), so the first
  return of \((L,M,R)\) is at \(t=26\). Period \(26^3\).
- The same counting for Thin, now also requiring \(L \in N_L\), multiplies
  by another factor coprime to 26. The first return of \((T,L,M,R)\) is
  at period \(26^4\).

This is a period statement about the rotor *positions*, not a security
proof. `state-graph.mjs --full` walks those orbits for every combination
of counts \(\{5,7,9\}^3\) and several random placements.

## Why it exists

Double-step is not injective: two states can share a successor, some
states have no predecessor, cycles can be much shorter than \(26^4\).
The cascade is a 4-wheel odometer with irregular teeth.

A full period is **not** a security proof.

## Trade-off

| | Live double-step | Cascade (future) |
|---|---|---|
| Shipped 47 / Android 1a | yes | no |
| Enigma-like extra step | yes | no |
| Thin / Left move often | more often | only on full carry |
| State map | not bijective | bijective (proved + checked) |
| Typical period | often \(\ll 26^4\) | \(26^4\) when counts \(\perp 26\) |
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
