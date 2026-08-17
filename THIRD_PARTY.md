# Third-party notices

Alberich (this repository) is licensed under **AGPL-3.0-only**.
The following bundled libraries keep their own terms.

They live under `web/js/vendor/`. The browser companion vendors jsQR and
qrcode-generator again under `extensions/browser/shared/vendor/` (no fflate).

## qrcode-generator

- Author: Kazuhiko Arase
- URL: http://www.d-project.com/
- License: MIT — `web/js/vendor/qrcode-generator.LICENSE`
- Used for: encoding courier and codebook QR images

The word “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.

## jsQR

- Author: Cosmo Wolfe
- URL: https://github.com/cozmo/jsQR
- License: Apache License 2.0 — `web/js/vendor/jsQR.LICENSE`
- Used for: reading QR images when the browser has no BarcodeDetector
- Note: this copy is the upstream webpack browser bundle; a license header
  was added locally because the bundle ships without one.

## fflate

- Author: Arjun Barrett
- URL: https://github.com/101arrowz/fflate
- License: MIT — `web/js/vendor/fflate.LICENSE`
- Used for: gzip / gunzip of codebook sheet payloads
- Note: this copy is the upstream browser build; a license header was added
  locally because the build ships without one.
