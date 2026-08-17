/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Kryptographisch sicherer Zufall (Web Crypto API).
 * Gleichverteilt per Rejection Sampling — wie im Codebook-Generator.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Gleichverteilte Ganzzahl in [0, maxExclusive).
 * @param {number} maxExclusive
 */
export function cryptoRandomInt(maxExclusive) {
  const max = Math.floor(Number(maxExclusive));
  if (!Number.isFinite(max) || max <= 0) return 0;
  if (max === 1) return 0;
  // 2^32-Bereich ohne Modulo-Bias
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/**
 * @template T
 * @param {T[]} array
 * @returns {T}
 */
export function pick(array) {
  if (!array?.length) {
    throw new Error('pick: empty array');
  }
  return array[cryptoRandomInt(array.length)];
}

/**
 * Fisher–Yates mit CSPRNG.
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
export function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Ein Buchstabe A–Z. */
export function randomLetter() {
  return ALPHABET[cryptoRandomInt(26)];
}

/** Vier Buchstaben A–Z (Grund-/Ring-/Spruchschlüssel). */
export function randomFourLetters() {
  return randomLetter() + randomLetter() + randomLetter() + randomLetter();
}

/**
 * Steckerpaare (Standard 10, wie Codebook / Kriegsmarine-üblich).
 * Paare kanonisch sortiert (AB), Liste alphabetisch.
 * @param {number} [pairCount=10]
 */
export function randomPlugboard(pairCount = 10) {
  const count = Math.max(0, Math.min(13, Math.floor(pairCount)));
  const letters = shuffle([...ALPHABET]);
  const pairs = [];
  for (let i = 0; i < count * 2; i += 2) {
    const a = letters[i];
    const b = letters[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * UKW Dora: 12 editierbare Paare über A–Z ohne B und O (festes BO in der Engine).
 */
export function randomDoraEditablePairs() {
  const remaining = shuffle(
    [...ALPHABET].filter((c) => c !== 'B' && c !== 'O'),
  );
  const pairs = [];
  for (let i = 0; i < 24; i += 2) {
    const a = remaining[i];
    const b = remaining[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * Freie Dora: 13 Paare über A–Z, kein festes BO.
 */
export function randomDoraFreePairs() {
  const letters = shuffle([...ALPHABET]);
  const pairs = [];
  for (let i = 0; i < 26; i += 2) {
    const a = letters[i];
    const b = letters[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * Drei verschiedene Hauptwalzen aus der übergebenen ID-Liste.
 * @param {string[]} mainRotorIds
 * @returns {[string, string, string]}
 */
export function randomMainRotors(mainRotorIds) {
  const three = shuffle(mainRotorIds).slice(0, 3);
  if (three.length < 3) {
    throw new Error('randomMainRotors: need at least 3 main rotors');
  }
  return /** @type {[string, string, string]} */ (three);
}
