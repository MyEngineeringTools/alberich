/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Canonical identity of a complete V3 machine key (not the algorithm fingerprint).
 *
 * CSPRNG: production randomness is crypto.getRandomValues via cryptoRandomInt.
 * Sampling: cryptoRandomInt uses rejection sampling on the 2^32 range so
 *           `x % n` is unbiased for any n in (1, 2^32].
 * Duplicate policy: only byte-identical full keys (same canonical form) are
 *           rejected. No equivalence classes.
 *
 * Canonical UTF-8 (LF, trailing LF), then SHA-256 hex:
 *
 *   ALB3-FULLKEY-V1
 *   rotors:<thin>,<left>,<middle>,<right>
 *   rings:<4>
 *   ground:<4>
 *   plugs:<canonical pairs>
 *   end:<26>
 *   notches:<L>|<M>|<R>
 *
 * Not included: date, day number, slot, sheet name, networkContext, epoch,
 * generatedAt, formatVersion, GUI metadata.
 */

import { normalizePlugPairsCanonical } from './modern-crypto.js';

export const FULL_KEY_CANON_VERSION = 'ALB3-FULLKEY-V1';
export const FULL_KEY_UNIQUE_MAX_ATTEMPTS = 64;

/**
 * @param {Record<string, unknown>} material
 * @returns {string}
 */
export function canonicalizeFullV3Key(material) {
  const rings = String(material.ringCode ?? '').toUpperCase();
  const ground = String(material.keyCode ?? material.groundKey ?? '').toUpperCase();
  const plugs = normalizePlugPairsCanonical(material.plugboard).join(' ');
  const notches = material.lueckenfueller || material.notches || {};
  return [
    FULL_KEY_CANON_VERSION,
    `rotors:${material.rotorThin},${material.rotorLeft},${material.rotorMiddle},${material.rotorRight}`,
    `rings:${rings}`,
    `ground:${ground}`,
    `plugs:${plugs}`,
    `end:${String(material.endwalzeWiring ?? '').toUpperCase()}`,
    `notches:${notches.left ?? ''}|${notches.middle ?? ''}|${notches.right ?? ''}`,
    '',
  ].join('\n');
}

function hexDigest(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 of the canonical full V3 key. Not the implementation fingerprint.
 * @param {Record<string, unknown>} material
 * @returns {Promise<string>} lowercase hex
 */
export async function fullKeyFingerprint(material) {
  const api = globalThis.crypto?.subtle;
  if (!api?.digest) {
    throw new Error('Web Crypto subtle.digest required for fullKeyFingerprint');
  }
  const bytes = new TextEncoder().encode(canonicalizeFullV3Key(material));
  const digest = await api.digest('SHA-256', bytes);
  return hexDigest(digest);
}

/**
 * Accept the first candidate whose fingerprint is new in `seen`.
 * On collision the entire candidate is discarded; `factory` must produce a
 * complete new key (no partial repair).
 *
 * @template T
 * @param {Set<string>} seen
 * @param {() => T} factory
 * @param {number} [maxAttempts]
 * @returns {Promise<{ key: T, fingerprint: string, attempts: number }>}
 */
export async function takeUniqueFullKey(seen, factory, maxAttempts = FULL_KEY_UNIQUE_MAX_ATTEMPTS) {
  if (!(seen instanceof Set)) {
    throw new Error('takeUniqueFullKey: seen must be a Set of fingerprints');
  }
  const limit = Math.max(1, Math.floor(Number(maxAttempts)) || FULL_KEY_UNIQUE_MAX_ATTEMPTS);
  for (let attempt = 1; attempt <= limit; attempt++) {
    const key = factory();
    const fingerprint = await fullKeyFingerprint(key);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    return { key, fingerprint, attempts: attempt };
  }
  throw new Error('Unable to generate unique V3 key');
}
