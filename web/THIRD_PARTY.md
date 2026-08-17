# Third-party notices — Alberich Web

Alberich is licensed under **AGPL-3.0-only**.
The following libraries are bundled under `js/vendor/` and keep their own terms.

## qrcode-generator

- Author: Kazuhiko Arase
- URL: http://www.d-project.com/
- License: MIT — `js/vendor/qrcode-generator.LICENSE`
- Used for: encoding courier and codebook QR images

The word “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.

## jsQR

- Author: Cosmo Wolfe
- URL: https://github.com/cozmo/jsQR
- License: Apache License 2.0 — `js/vendor/jsQR.LICENSE`
- Used for: reading QR images when the browser has no BarcodeDetector
- Note: this copy is the upstream webpack browser bundle; a license header
  was added locally because the bundle ships without one.

## fflate

- Author: Arjun Barrett
- URL: https://github.com/101arrowz/fflate
- License: MIT — `js/vendor/fflate.LICENSE`
- Used for: gzip / gunzip of codebook sheet payloads
- Note: this copy is the upstream browser build; a license header was added
  locally because the build ships without one.

Matomo analytics, if enabled, is loaded from a separate host and is not part
of the Alberich application files served from this directory.
