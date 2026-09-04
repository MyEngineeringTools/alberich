# W8 dependency audit: `@ngraveio/bc-ur`

Date: 2026-09-04.
Decision: **REJECT** as an Alberich-web product dependency.

## Candidate

| | npm `latest` | GitHub `main` / npm `beta` |
|---|---|---|
| Package | `@ngraveio/bc-ur` | same |
| Version | **1.1.13** (2024-04-17) | **2.0.0-beta.10** |
| License | MIT | MIT |
| Unpacked | ~114 KB | larger (cbor2 + buffer) |

Alberich-web has **no** `package.json` / npm. Installing either version
would introduce a Node-shaped runtime.

## Runtime dependencies

**1.1.13:** `crc`, `jsbi`, `assert`, `sha.js@^2.4.11`, `cbor-sync`,
`bignumber.js`, `@keystonehq/alias-sampling`.

**2.0.0-beta.10:** `buffer@^6.0.3`, `cbor2`, `crc`, `sha.js@^2.4.11`,
`@bacons/text-decoder`. Dev/build uses `rollup-plugin-node-polyfills`.

Both stacks require a **Buffer** and/or Node `assert` / `sha.js` path.
W8 §25: if extensive browser polyfills are required → **STOP**.

## Advisories

`sha.js` ≤ 2.4.11 is **CVE-2025-9288** / GHSA-95m3-7q98-8xr5 (hash
state rewind / crafted objects). Both published bc-ur lines still
declare `sha.js ^2.4.11`. Alberich uses Web Crypto `subtle.digest`
instead.

## Browser / ESM

alberich-web is vanilla ESM, no bundler, no Buffer global.
bc-ur is ESM-capable on paper (tshy/rollup) but ships Node crypto and
Buffer polyfills. Not acceptable in the product graph.

## MUR spec conformance

The **specification** is BCR-2024-001, not this library.
W8 implements the papers in-tree. BCR vectors in
`js/tests/mur-selftest.js` **PASS** (CRC32, Xoshiro256**, sampler,
degree, fragments, encoder CBOR, `ur:bytes` single- and multipart
strings from Blockchain Commons `bc-ur` C++ tests).

## Decision

```
Library: @ngraveio/bc-ur
Version: 1.1.13 (latest) / 2.0.0-beta.10 (beta)
License: MIT
Runtime dependencies: Buffer / sha.js / crc / cbor + polyfills
Browser polyfills: required (STOP per W8 §25)
Bundle impact: would add Node compatibility to a no-npm app
MUR spec conformance: not used; in-tree implementation matches BCR vectors
Decision: REJECT
```

No lockfile. No registry type. No `^` pin, because it is not installed.

Replacement: isolated spec-conforming fountain + bytewords + tiny CBOR,
AGPL-3.0-only, Web Crypto SHA-256, existing `crc32Ieee`.
