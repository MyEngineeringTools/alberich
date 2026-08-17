# Third-party notices

Alberich (this repository) is licensed under **AGPL-3.0-only**.
The following bundled libraries keep their own terms.

They live under `web/js/vendor/`. The browser companion vendors jsQR and
qrcode-generator again under `extensions/browser/shared/vendor/` (no fflate).

## qrcode-generator

- Author: Kazuhiko Arase
- Upstream: http://www.d-project.com/ (historical); commonly mirrored as https://github.com/kazuhikoarase/qrcode-generator
- Version / tag: browser build vendored locally (no runtime URL)
- Upstream commit: not recorded at intake (pre-public vendor copy)
- License: MIT — `web/js/vendor/qrcode-generator.LICENSE`
- Local SHA-256: `86e07bd03bcfd50b44f3a86fe6776cba7169b1a47f4aed4216c489780743ce14`
- Local changes: none beyond the upstream file as stored
- Taken: before 2026-08 public release
- Used for: encoding courier and codebook QR images

The word “QR Code” is a registered trademark of DENSO WAVE INCORPORATED.

## jsQR

- Author: Cosmo Wolfe
- Upstream: https://github.com/cozmo/jsQR
- Version / tag: webpack browser bundle vendored locally
- Upstream commit: not recorded at intake (pre-public vendor copy)
- License: Apache License 2.0 — `web/js/vendor/jsQR.LICENSE`
- Local SHA-256: `0cc13af85aa680b6b268dc9589af57371722745a8a43a00d30d826d8be186e0d`
- Local changes: license header restored because the upstream bundle ships without one
- Taken: before 2026-08 public release
- Used for: reading QR images when the browser has no BarcodeDetector

## fflate

- Author: Arjun Barrett
- Upstream: https://github.com/101arrowz/fflate
- Version / tag: browser build vendored locally
- Upstream commit: not recorded at intake (pre-public vendor copy)
- License: MIT — `web/js/vendor/fflate.LICENSE`
- Local SHA-256: `1efaee3f58d95b958ae7ef359cfcd058c53f706247915803334c31cb5f2ece4e`
- Local changes: license header restored because the upstream build ships without one
- Taken: before 2026-08 public release
- Used for: gzip / gunzip of codebook sheet payloads

Verify local hashes with `bash scripts/verify-vendor.sh`. Nothing is fetched at build or runtime.
