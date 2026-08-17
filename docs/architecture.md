# Architecture

Alberich Web is a static front-end. There is no application server and no
account. Opening `web/` in a local file server is the same cryptographic
workspace as https://alberich.pro/.

No analytics. No telemetry. No tracking. No external analytics scripts.

```
browser
  ├── index.html / styles.css / app.js     UI, i18n, camera, networks
  ├── cipher-engine.js                     letter path + stepping
  ├── modern-crypto.js                     V2 path + Endwalze helpers
  ├── modern-v3.js                         V3 telegram, Prüfgruppe, Base-26 V2
  ├── cipher-data.js                       historical wirings + Dora pairs
  ├── codebook-*.js                        month sheets, Tafelwort, QR
  └── js/vendor/                           qrcode-generator, jsQR, fflate
```

## Modes

| Mode | Path | Involutory | Alphabet |
|---|---|---|---|
| Traditional | Stecker → R M L Thin → UKW → back → Stecker | yes | A–Z (punctuation spelled) |
| Modern (live) | Stecker → R M L Thin → Endwalze → Stecker; four-rotor double-step | no | UTF-8 via Base-26 |

Modern decrypt inverts the Endwalze and walks the rotors backward. Stepping
is the same as on encrypt. Live V3 uses the four-rotor double-step published
in Revision 47. A pure notch cascade is documented as a
[future option](crypto-spec/cascade-future.md) and is not wired into
`step()`. Traditional / V2 keep the historical three-wheel step.
`modern-crypto.js` still holds older V2 helpers for tests; they are not a
live product path.

The cryptographic workspace performs no analytics or telemetry. There is
no optional analytics exception for the live host.

## Keys

A **day key** lives on a month sheet (or is set by hand): rotors, rings,
ground, plugs, Endwalze / UKW, and in V3 the visible notch sets. V3 binds
that whole day key — including the four-letter ground — into
`canonicalDayKey` (line `ground:CDSZ`) before HKDF. A
**message key** is four letters. Modern always generates one and puts the
encrypted indicator in the header.

V3 telegram: `ALBV` + header (4) + message-id (8) + body + Prüfgruppe (20).

Traditional can run simple (ground = message) or with a manual message key.

**Courier on:** no crypto, no sheet import. The window only moves A–Z and
`ALBERICH-CTQR1` QR between an offline machine and an online messenger.

## Sheets

Format `alberich-codebook`:

| `formatVersion` | Policy | Notes |
|---|---|---|
| 1 | mix / historic | Dora with fixed BO where used |
| 2 | dora | free 13-pair Dora |
| 3 | permutation | V3: `endwalzeWiring` + independent notches |

Import as JSON or `ALBERICH-CBQR1|gzip|<base64>`. Versions 1 and 2 stay
readable and are never silently treated as V3. The sheet word is CRC-32
over a canonical slim stream — see
[crypto-spec/tafelwort.md](crypto-spec/tafelwort.md).

## Extensions

`extensions/browser/` is the Chrome / Edge / Firefox companion. One
`shared/` tree is the source of truth. Chrome and Edge may symlink to it
in the working tree; `scripts/package-extensions.sh` copies files into
`dist/extensions/` with **no symlinks**. Firefox also receives a copy via
`sync-from-chrome.sh`. Crypto is still duplicated from `web/js/`.

`extensions/thunderbird/` is the MailExtension. Same engines, own UI.

## Content Security Policy

`web/index.html` ships:

```
script-src 'self' 'sha256-…'   # hash covers the JSON-LD block only
style-src  'self' 'unsafe-inline'
```

First-party JavaScript is in external modules (`js/app.js`,
`js/rotor-selects.js`). There is no inline executable script.

`style-src` still allows `'unsafe-inline'` because:

1. `js/vendor/qrcode-generator.js` emits `<table style="…">` / `<td style="…">`
   for courier and codebook QR images. Changing that vendor bundle would
   risk breaking QR/camera/offline share.
2. The workspace toggles a few layout nodes via `element.style.display`.

Do not drop `style-src 'unsafe-inline'` without replacing both. If the
JSON-LD block in `index.html` changes, recompute its SHA-256 and update
the `script-src` hash (`scripts/test-repository.sh` checks this).
`web/start.sh` reads that same meta tag so the local file server cannot
silently re-introduce `'unsafe-inline'` for scripts. `web/.htaccess`
must carry the same `script-src` hash (no `'unsafe-inline'` for
scripts). `scripts/test-repository.sh` compares the three.

## What is not here

Android sources stay outside this repository. There is no analytics
component in this tree.
