# Research baseline — live Modern V3

Verified against production source on 17 August 2026.
Normative files: `web/js/modern-v3.js`, `web/js/cipher-engine.js`.

This page is what research must measure. A cascade formula that is not
in `CipherEngine.step()` is **not** current Modern V3.

## Signal path

Encrypt (after the step):

```
Stecker → Right → Middle → Left → Thin → Endwalze → Stecker
```

Decrypt uses the same step, then the inverse path:

```
Stecker → Endwalze⁻¹ → Thin ← Left ← Middle ← Right → Stecker
```

Code: `CipherEngine.encryptLetterModern` / `decryptLetterModern`.

## Rotors

Thin, Left, Middle, Right. Thin has no notches and drives nothing.

## Rings and ground

Four ring letters (`thin.ring` is live). Four ground letters. Ground is
part of `canonicalDayKey` (`ground:ABCD`).

## Plugboard

Modern V3 Standard Profile: exactly 10 disjoint pairs.

## Endwalze

Free 26-letter permutation. Involutions rejected. Fail-closed after 64
Fisher–Yates attempts. Production RNG is Web Crypto.

Support: \(26! - I(26)\). The gap to \(26!\) is negligible in bits, not
zero.

## Lückenfüller

Counts from `{5,7,9}` chosen uniformly, then a uniform subset of that
size, independently on Left, Middle, Right. Sets of different sizes are
**not** equiprobable.

## Step rule (live)

Notches are read **before** the move.

```
Right always
stepMiddle = rightAtNotch || middleAtNotch
stepLeft   = middleAtNotch || leftAtNotch
stepThin   = leftAtNotch
```

That is the historical-style **double-step** in `stepModernV3()` and
`nextV3Positions()`.

The pure carry cascade

```
stepMiddle = rightAtNotch
stepLeft   = stepMiddle && middleAtNotch
stepThin   = stepLeft && leftAtNotch
```

lives only in `nextV3PositionsCascade()`. It is a future option. Wiring
it into `step()` breaks Revision 47/49 telegrams (MAC can still pass).

Traditional / Modern V2 keep the three-wheel step (Left notch unused,
Thin parked).

## Encoding and telegram

Base-26 V2. Shape:

```
ALBV | HDR4 | MID8 | BODY | PRUEF20
```

Message key is four letters (rotor start). MID is eight random letters,
not a rotor.

## Authentication

```
ALB3-KEY
net:<netz>
epoch:<YYYY-MM-DD|MANUAL>
rotors:<thin>,<left>,<middle>,<right>
rings:<4>
ground:<4>
plugs:<canonical pairs>
end:<26>
notches:<L>|<M>|<R>
```

HKDF-SHA-256 → HMAC-SHA-256 → 20-letter Prüfgruppe. Decrypt checks the
MAC first. A candidate day key can be rejected or accepted offline by
recomputing PRUEF. That is an oracle for key-recovery cost, not an HMAC
break.

## What research must not do

- Treat cascade periods as live V3.
- Treat V2 three-wheel periods as live V3.
- Equate support-size bits with security bits.
- Use the research PRNG (`mulberry32`) for production keys.
