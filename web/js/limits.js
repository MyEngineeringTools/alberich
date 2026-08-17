/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Hard input limits for the crypto workspace. Fail closed.
 */

export const LIMITS = Object.freeze({
  MAX_PLAINTEXT_CHARS: 200_000,
  MAX_CIPHER_LETTERS: 200_000,
  MAX_CODEBOOK_JSON_BYTES: 2_000_000,
  MAX_QR_IMAGE_BYTES: 8_000_000,
  MAX_QR_COMPRESSED_BYTES: 80_000,
  MAX_QR_DECOMPRESSED_BYTES: 2_000_000,
  MAX_BASE26_LETTERS: 200_000,
  MAX_NETWORK_CONTEXT: 16,
});

export function rejectIfTooLong(value, max, error = 'limits.tooLong') {
  const n = String(value ?? '').length;
  if (n > max) return { ok: false, error, length: n, max };
  return { ok: true, length: n, max };
}
