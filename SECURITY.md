# Security

## What this is

Alberich Modern V3 is a **specified experimental rotor protocol**: visible
rotors, rings, plugs, notches, and end-rotor wiring; a 4-letter message key;
A–Z groups; an HMAC-SHA-256 Prüfgruppe. It is not AES, not a NIST algorithm,
and not a substitute for a reviewed modern AEAD. There is no security proof.

Traditional mode is a historical simulator. It is involutory. Do not use it
to hide anything you care about.

The cryptographic workspace performs no analytics or telemetry.

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
The V3 auth key is bound to the full day key, including the four-letter
ground. Changing only the ground changes the Prüfgruppe. A telegram
from a build without `ground:` in `canonicalDayKey` will fail the MAC
on this line.

## Supported versions

Supported line is in [VERSIONS](VERSIONS): web `1.0` (Revision 47),
browser `1.0.23`, Thunderbird `1.0.13`, Android `1.0` (Revision 28).
Older store and site revisions are not maintained.

## Reporting

Do **not** open a public GitHub issue for a security vulnerability.

Please report privately to **alberich@posteo.de** first. Give us a reasonable
window to fix and ship a revision.

Do not send real operational keys or live traffic in a report. A synthetic
sheet and a short repro is enough.

## Coordinated disclosure

We prefer coordinated disclosure. If we do not respond within 14 days, you
may publish after that window.
