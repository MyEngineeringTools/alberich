/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * FULL_KEY_BIN_V1 — fixed 70-byte encoding of one complete Modern V3 key.
 * Same cryptographic fields as ALB3-FULLKEY-V1. Big-endian. Canonical only.
 */

import { normalizePlugPairsCanonical } from './modern-crypto.js';
import { validateFullV3Key } from './timebook.js';

export const FULL_KEY_BIN_V1_BYTES = 70;

/** Frozen numeric IDs. Not JS array positions. 0 is unused. */
export const CBQR2_ROTOR_BY_ID = Object.freeze({
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'Beta',
  10: 'Gamma',
});

export const CBQR2_ROTOR_ID = Object.freeze({
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  Beta: 9,
  Gamma: 10,
});

const THIN_IDS = new Set([9, 10]);
const MAIN_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const NOTCH_COUNTS = new Set([5, 7, 9]);

function fail(error) {
  return { ok: false, rejected: 'IMPORT_REJECTED', error };
}

export function letterToU8(ch) {
  const n = String(ch).charCodeAt(0) - 65;
  if (n < 0 || n > 25) return -1;
  return n;
}

export function u8ToLetter(n) {
  if (!Number.isInteger(n) || n < 0 || n > 25) return '';
  return String.fromCharCode(65 + n);
}

export function notchMaskFromLetters(letters) {
  const s = String(letters ?? '');
  let mask = 0;
  for (let i = 0; i < s.length; i++) {
    const b = letterToU8(s[i]);
    if (b < 0) return -1;
    mask |= 1 << b;
  }
  return mask >>> 0;
}

export function lettersFromNotchMask(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= (1 << 26)) return null;
  let out = '';
  let n = 0;
  for (let i = 0; i < 26; i++) {
    if (mask & (1 << i)) {
      out += u8ToLetter(i);
      n += 1;
    }
  }
  if (!NOTCH_COUNTS.has(n)) return null;
  return out;
}

function writeU32BE(view, offset, value) {
  view.setUint32(offset, value >>> 0, false);
}

function readU32BE(view, offset) {
  return view.getUint32(offset, false);
}

/**
 * @param {object} key
 * @returns {{ ok: true, bytes: Uint8Array } | { ok: false, rejected: string, error: string }}
 */
export function encodeFullKeyBinV1(key) {
  const checked = validateFullV3Key(key);
  if (!checked.ok) return fail(checked.error);
  const k = checked.key;
  const thin = CBQR2_ROTOR_ID[k.rotorThin];
  const left = CBQR2_ROTOR_ID[k.rotorLeft];
  const middle = CBQR2_ROTOR_ID[k.rotorMiddle];
  const right = CBQR2_ROTOR_ID[k.rotorRight];
  if (!THIN_IDS.has(thin) || !MAIN_IDS.has(left) || !MAIN_IDS.has(middle) || !MAIN_IDS.has(right)) {
    return fail('cbqr2.err.rotorId');
  }
  if (new Set([left, middle, right]).size !== 3) return fail('codebook.err.mainUnique');

  const pairs = normalizePlugPairsCanonical(k.plugboard);
  if (pairs.length !== 10) return fail('codebook.err.plugsInvalid');

  const bytes = new Uint8Array(FULL_KEY_BIN_V1_BYTES);
  const view = new DataView(bytes.buffer);
  bytes[0] = thin;
  bytes[1] = left;
  bytes[2] = middle;
  bytes[3] = right;
  for (let i = 0; i < 4; i++) {
    const r = letterToU8(k.ringCode[i]);
    const g = letterToU8(k.keyCode[i]);
    if (r < 0 || g < 0) return fail('cbqr2.err.letter');
    bytes[4 + i] = r;
    bytes[8 + i] = g;
  }
  for (let i = 0; i < 10; i++) {
    const a = letterToU8(pairs[i][0]);
    const b = letterToU8(pairs[i][1]);
    if (a < 0 || b < 0 || a >= b) return fail('cbqr2.err.plugsCanonical');
    bytes[12 + i * 2] = a;
    bytes[13 + i * 2] = b;
  }
  for (let i = 0; i < 26; i++) {
    const e = letterToU8(k.endwalzeWiring[i]);
    if (e < 0) return fail('cbqr2.err.endwalze');
    bytes[32 + i] = e;
  }
  const leftN = notchMaskFromLetters(k.lueckenfueller.left);
  const midN = notchMaskFromLetters(k.lueckenfueller.middle);
  const rightN = notchMaskFromLetters(k.lueckenfueller.right);
  if (leftN < 0 || midN < 0 || rightN < 0) return fail('cbqr2.err.notches');
  writeU32BE(view, 58, leftN);
  writeU32BE(view, 62, midN);
  writeU32BE(view, 66, rightN);
  return { ok: true, bytes };
}

/**
 * Strict: canonical pair order, involution rejected via validateFullV3Key.
 */
export function decodeFullKeyBinV1(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== FULL_KEY_BIN_V1_BYTES) {
    return fail('cbqr2.err.keyLength');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const thinId = bytes[0];
  const leftId = bytes[1];
  const middleId = bytes[2];
  const rightId = bytes[3];
  if (!THIN_IDS.has(thinId) || !MAIN_IDS.has(leftId) || !MAIN_IDS.has(middleId) || !MAIN_IDS.has(rightId)) {
    return fail('cbqr2.err.rotorId');
  }
  if (new Set([leftId, middleId, rightId]).size !== 3) return fail('codebook.err.mainUnique');

  const ring = [];
  const ground = [];
  for (let i = 0; i < 4; i++) {
    const r = u8ToLetter(bytes[4 + i]);
    const g = u8ToLetter(bytes[8 + i]);
    if (!r || !g) return fail('cbqr2.err.letter');
    ring.push(r);
    ground.push(g);
  }

  const pairStrs = [];
  const used = new Set();
  for (let i = 0; i < 10; i++) {
    const a = bytes[12 + i * 2];
    const b = bytes[13 + i * 2];
    if (a > 25 || b > 25 || a >= b) return fail('cbqr2.err.plugsCanonical');
    const pa = u8ToLetter(a);
    const pb = u8ToLetter(b);
    if (used.has(pa) || used.has(pb)) return fail('codebook.err.plugDuplicate');
    used.add(pa);
    used.add(pb);
    pairStrs.push(pa + pb);
  }
  for (let i = 1; i < pairStrs.length; i++) {
    if (pairStrs[i - 1] >= pairStrs[i]) return fail('cbqr2.err.plugsCanonical');
  }

  let wiring = '';
  for (let i = 0; i < 26; i++) {
    const ch = u8ToLetter(bytes[32 + i]);
    if (!ch) return fail('cbqr2.err.endwalze');
    wiring += ch;
  }

  const leftMask = readU32BE(view, 58);
  const midMask = readU32BE(view, 62);
  const rightMask = readU32BE(view, 66);
  if ((leftMask >>> 26) || (midMask >>> 26) || (rightMask >>> 26)) {
    return fail('cbqr2.err.notchReserved');
  }
  const leftN = lettersFromNotchMask(leftMask);
  const midN = lettersFromNotchMask(midMask);
  const rightN = lettersFromNotchMask(rightMask);
  if (!leftN || !midN || !rightN) return fail('cbqr2.err.notches');

  const checked = validateFullV3Key({
    rotorThin: CBQR2_ROTOR_BY_ID[thinId],
    rotorLeft: CBQR2_ROTOR_BY_ID[leftId],
    rotorMiddle: CBQR2_ROTOR_BY_ID[middleId],
    rotorRight: CBQR2_ROTOR_BY_ID[rightId],
    ringCode: ring.join(''),
    keyCode: ground.join(''),
    plugboard: pairStrs.join(' '),
    endwalzeWiring: wiring,
    lueckenfueller: { left: leftN, middle: midN, right: rightN },
  });
  if (!checked.ok) return fail(checked.error);
  return { ok: true, key: checked.key };
}
