/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Hard input limits for the crypto workspace. Fail closed.
 *
 * Technical maxima protect memory / BigInt / UI. They are not a
 * security rating. Live V3 double-step periods are often ~3e3–2e4
 * body letters; a 200k-letter body can wrap that walk many times.
 * RECOMMENDED_* is the cryptanalytic advice for Modern V3 Standard.
 */

export const LIMITS = Object.freeze({
  MAX_PLAINTEXT_CHARS: 200_000,
  MAX_CIPHER_LETTERS: 200_000,
  MAX_CODEBOOK_JSON_BYTES: 2_000_000,
  MAX_QR_IMAGE_BYTES: 8_000_000,
  MAX_QR_IMAGE_PIXELS: 16_777_216,
  MAX_QR_IMAGE_EDGE: 4096,
  MAX_QR_COMPRESSED_BYTES: 80_000,
  MAX_QR_DECOMPRESSED_BYTES: 2_000_000,
  MAX_BASE26_LETTERS: 200_000,
  MAX_NETWORK_CONTEXT: 16,
  RECOMMENDED_PLAINTEXT_CHARS: 4096,
  RECOMMENDED_BASE26_LETTERS: 8000,
});

export function rejectIfTooLong(value, max, error = 'limits.tooLong') {
  const n = String(value ?? '').length;
  if (n > max) return { ok: false, error, length: n, max };
  return { ok: true, length: n, max };
}

export function rejectIfTooManyBytes(value, max, error = 'limits.tooLong') {
  const n = Number(value);
  if (!Number.isFinite(n) || n > max) return { ok: false, error, length: n, max };
  return { ok: true, length: n, max };
}
