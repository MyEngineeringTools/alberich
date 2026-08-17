# Security

## What this is

Alberich Modern V3 is a **specified experimental rotor protocol**: visible
rotors, rings, plugs, notches, and end-rotor wiring; a 4-letter message key;
A–Z groups; an HMAC-SHA-256 Prüfgruppe. It is not AES, not a NIST algorithm,
and not a substitute for a reviewed modern AEAD. There is no security proof.

Traditional mode is a historical simulator. It is involutory. Do not use it
to hide anything you care about.

The cryptographic workspace performs no analytics or telemetry.
No tracking. No external analytics scripts.

## What we do promise

- The machine in this repo matches the spec and the selftests.
- Courier mode (`Kurier`) does not encrypt. It only moves letters and QR
  between an offline device and an online messenger.
- This tree does not contain operational month sheets.

## What we do not promise

- Confidentiality against a determined cryptanalyst with the same sheet
- Authenticity stronger than the ~94-bit Prüfgruppe (HMAC-SHA-256 over
  HKDF-SHA-256)
- Persistent replay protection (the cache is optional and in-session only)
- Protection of metadata (who talked to whom, when)
- Safety of a seized offline device that still holds the sheet

Confidentiality stays a rotor cipher. The Prüfgruppe detects silent
mutation of a telegram; it does not replace the day sheet as the secret.
A candidate day key can be checked offline against PRUEF — that is a
verification oracle for key recovery, not extra confidentiality.

Live stepping is the four-rotor **double-step** in `stepModernV3()`.
Research numbers that describe a pure notch cascade or the old
three-wheel walk are not this protocol.

Support-size bits (including the ~248-bit Standard-Profile product) are
not a security claim. See `research/results/EVALUATION.md`.
The V3 auth key is bound to the full day key, including the four-letter
ground. Changing only the ground changes the Prüfgruppe. A telegram
from a build without `ground:` in `canonicalDayKey` will fail the MAC
on this line.

## Supported versions

Supported line is in [VERSIONS](VERSIONS): web `1.0` (Revision 49),
browser `1.0.24`, Thunderbird `1.0.14`, Android `1.0` (Revision 29).
Older store and site revisions are not maintained.

## Reporting

Do **not** open a public GitHub issue for a security vulnerability.

Please report privately to **alberich@posteo.de** first. Give us a reasonable
window to fix and ship a revision.

Do not send real operational keys or live traffic in a report. A synthetic
sheet and a short repro is enough.

## Coordinated disclosure

We prefer coordinated disclosure.

- We aim to **acknowledge** a report within 14 days.
- Severity is assessed together; a disclosure date is agreed, not
  automatic.
- Critical issues are patched first.
- There is no SLA that a fix ships in 14 days, and no automatic
  permission to publish after that window if we have acknowledged the
  report and are working a coordinated date.
