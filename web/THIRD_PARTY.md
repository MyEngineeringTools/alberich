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
- Version: **1.4.0** (webpack browser bundle, locally wrapped as ESM)
- License: Apache License 2.0 — `js/vendor/jsQR.LICENSE`
- Used for: reading QR images when the browser has no BarcodeDetector
- SHA-256: `0cc13af85aa680b6b268dc9589af57371722745a8a43a00d30d826d8be186e0d`
- Note: this copy is the upstream webpack browser bundle; a license header
  was added locally because the bundle ships without one. Not upgraded in W9.

## Blockchain Commons Uniform Resources / Bytewords / MUR

**Not a runtime library.** Alberich reimplements the public research papers
in-tree (AGPL-3.0-only). Provenance of the frozen v1 spec:

- Papers: BCR-2020-005, BCR-2020-012, BCR-2024-001
  ([BlockchainCommons/Research](https://github.com/BlockchainCommons/Research))
- Reference vectors: `test/test.cpp` in
  [BlockchainCommons/bc-ur](https://github.com/BlockchainCommons/bc-ur)
- License of those specs/reference implementations:
  **BSD-2-Clause Plus Patent**
- Frozen commits: [`docs/cbqr2-mur-provenance.md`](docs/cbqr2-mur-provenance.md)

No Blockchain Commons JavaScript package is shipped.

## fflate

- Author: Arjun Barrett
- URL: https://github.com/101arrowz/fflate
- License: MIT — `js/vendor/fflate.LICENSE`
- Used for: gzip / gunzip of codebook sheet payloads; fallback for CBQR2 transport gzip when `CompressionStream` is missing
- Note: this copy is the upstream browser build; a license header was added
  locally because the build ships without one.
