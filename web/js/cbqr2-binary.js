/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * CBQR2 v1 — canonical binary serialization of ALB3_TIMEBOOK_V1.
 * Transport only. No key derivation. Big-endian. Strict decoder.
 */

import {
  KEY_TIME_REFERENCE,
  TIMEBOOK_KIND,
  daysInUtcMonth,
  listTimebookSlots,
  timebookFingerprint,
  validateTimebook,
} from './timebook.js';
import { SLOTS_PER_DAY, TIME_PROFILE } from './alberich-key-time.js';
import { fullKeyFingerprint } from './full-key-fingerprint.js';
import {
  FULL_KEY_BIN_V1_BYTES,
  decodeFullKeyBinV1,
  encodeFullKeyBinV1,
} from './full-key-binary.js';

export const CBQR2_MAGIC = 'ALB3CB2';
export const CBQR2_FILE_EXTENSION = 'alb3cb2';
export const CBQR2_VERSION = 1;
export const CBQR2_KEY_TIME_UTC_PLUS_1 = 1;
export const CBQR2_HEADER_PREFIX_BYTES = 19;
export const CBQR2_HASH_BYTES = 32;

export const CBQR2_PROFILE_ID = Object.freeze({
  [TIME_PROFILE.DAY_24H]: 0,
  [TIME_PROFILE.HOURS_4]: 1,
  [TIME_PROFILE.HOUR_1]: 2,
});

export const CBQR2_PROFILE_BY_ID = Object.freeze({
  0: TIME_PROFILE.DAY_24H,
  1: TIME_PROFILE.HOURS_4,
  2: TIME_PROFILE.HOUR_1,
});

const MAGIC_BYTES = new TextEncoder().encode(CBQR2_MAGIC);
const NET_RE = /^[A-Z0-9]{1,16}$/;

function fail(error) {
  return { ok: false, rejected: 'IMPORT_REJECTED', error };
}

function equalBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function sha256(bytes) {
  const api = globalThis.crypto?.subtle;
  if (!api?.digest) throw new Error('Web Crypto subtle.digest required for CBQR2');
  return new Uint8Array(await api.digest('SHA-256', bytes));
}

function hexToBytes(hex) {
  const s = String(hex ?? '');
  if (!/^[0-9a-f]{64}$/.test(s)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isCbqr2Bytes(input) {
  return input instanceof Uint8Array
    && input.length >= MAGIC_BYTES.length
    && equalBytes(input.subarray(0, MAGIC_BYTES.length), MAGIC_BYTES);
}

/** @param {{ year?: number, month?: number }} book */
export function timebookBinaryFilename(book) {
  const y = Number(book?.year) || 0;
  const m = String(Number(book?.month) || 0).padStart(2, '0');
  return `alberich-timebook-${y}-${m}.${CBQR2_FILE_EXTENSION}`;
}

export function expectedCbqr2Length(year, month, profile, netLen) {
  const days = daysInUtcMonth(year, month);
  const slots = SLOTS_PER_DAY[profile];
  if (!days || !slots) return -1;
  const keys = days * slots;
  if (keys > 31 * 24) return -1;
  return CBQR2_HEADER_PREFIX_BYTES + netLen + keys * FULL_KEY_BIN_V1_BYTES + CBQR2_HASH_BYTES * 2;
}

/**
 * Canonical CBQR2 bytes for a validated full-month timebook.
 * @returns {Promise<{ ok: true, bytes: Uint8Array, length: number } | { ok: false, rejected: string, error: string }>}
 */
export async function encodeCbqr2(timebook) {
  const checked = validateTimebook(timebook);
  if (!checked.ok) return fail(checked.error);
  const net = String(timebook.networkContext || '');
  if (!NET_RE.test(net)) return fail('cbqr2.err.networkContext');
  const profileId = CBQR2_PROFILE_ID[timebook.timeProfile];
  if (profileId == null) return fail('timebook.err.profile');
  if (timebook.keyTimeReference !== KEY_TIME_REFERENCE) return fail('timebook.err.keyTime');

  const year = timebook.year;
  const month = timebook.month;
  const days = daysInUtcMonth(year, month);
  const slotsPerDay = SLOTS_PER_DAY[timebook.timeProfile];
  const keyCount = days * slotsPerDay;
  const slots = listTimebookSlots(timebook);
  if (slots.length !== keyCount) return fail('timebook.err.slotCount');

  const seen = new Set();
  for (const slot of slots) {
    const fp = await fullKeyFingerprint(slot.key);
    if (fp !== slot.fullKeyFingerprint) return fail('cbqr2.err.keyFingerprint');
    if (seen.has(fp)) return fail('timebook.err.duplicateKey');
    seen.add(fp);
  }
  const identity = await timebookFingerprint(timebook);
  if (timebook.codebookFingerprint && timebook.codebookFingerprint !== identity) {
    return fail('cbqr2.err.codebookFingerprint');
  }

  const netBytes = new TextEncoder().encode(net);
  const length = expectedCbqr2Length(year, month, timebook.timeProfile, netBytes.length);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  bytes.set(MAGIC_BYTES, 0);
  bytes[7] = CBQR2_VERSION;
  bytes[8] = 0;
  view.setUint16(9, year, false);
  bytes[11] = month;
  bytes[12] = profileId;
  bytes[13] = CBQR2_KEY_TIME_UTC_PLUS_1;
  bytes[14] = days;
  bytes[15] = slotsPerDay;
  view.setUint16(16, keyCount, false);
  bytes[18] = netBytes.length;
  bytes.set(netBytes, 19);

  let off = 19 + netBytes.length;
  for (const slot of slots) {
    const encoded = encodeFullKeyBinV1(slot.key);
    if (!encoded.ok) return encoded;
    bytes.set(encoded.bytes, off);
    off += FULL_KEY_BIN_V1_BYTES;
  }
  const fpBytes = hexToBytes(identity);
  if (!fpBytes) return fail('cbqr2.err.codebookFingerprint');
  bytes.set(fpBytes, off);
  off += CBQR2_HASH_BYTES;
  const digest = await sha256(bytes.subarray(0, off));
  bytes.set(digest, off);
  return { ok: true, bytes, length: bytes.length, codebookFingerprint: identity };
}

export async function decodeCbqr2(input) {
  if (!(input instanceof Uint8Array)) return fail('cbqr2.err.notBytes');
  if (input.length < CBQR2_HEADER_PREFIX_BYTES + 1 + CBQR2_HASH_BYTES * 2) {
    return fail('cbqr2.err.truncated');
  }
  if (!equalBytes(input.subarray(0, 7), MAGIC_BYTES)) return fail('cbqr2.err.magic');
  if (input[7] !== CBQR2_VERSION) return fail('cbqr2.err.version');
  if (input[8] !== 0) return fail('cbqr2.err.flags');

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const year = view.getUint16(9, false);
  const month = input[11];
  const profileId = input[12];
  const keyTime = input[13];
  const daysHdr = input[14];
  const slotsHdr = input[15];
  const keyCountHdr = view.getUint16(16, false);
  const netLen = input[18];

  if (year < 1900 || year > 2100) return fail('timebook.err.year');
  if (month < 1 || month > 12) return fail('timebook.err.month');
  const profile = CBQR2_PROFILE_BY_ID[profileId];
  if (!profile) return fail('timebook.err.profile');
  if (keyTime !== CBQR2_KEY_TIME_UTC_PLUS_1) return fail('timebook.err.keyTime');
  if (netLen < 1 || netLen > 16) return fail('cbqr2.err.networkContext');

  const days = daysInUtcMonth(year, month);
  const slotsPerDay = SLOTS_PER_DAY[profile];
  const keyCount = days * slotsPerDay;
  if (daysHdr !== days || slotsHdr !== slotsPerDay || keyCountHdr !== keyCount) {
    return fail('cbqr2.err.calendar');
  }
  if (keyCount > 31 * 24) return fail('cbqr2.err.keyCount');

  const expected = expectedCbqr2Length(year, month, profile, netLen);
  if (input.length !== expected) {
    return fail(input.length < expected ? 'cbqr2.err.truncated' : 'cbqr2.err.trailing');
  }

  let net;
  try {
    net = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(19, 19 + netLen));
  } catch {
    return fail('cbqr2.err.networkContext');
  }
  if (!NET_RE.test(net)) return fail('cbqr2.err.networkContext');

  let off = 19 + netLen;
  const dayEntries = [];
  const seenFp = new Set();
  for (let day = 1; day <= days; day++) {
    const slots = [];
    for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex++) {
      const slice = input.subarray(off, off + FULL_KEY_BIN_V1_BYTES);
      const decoded = decodeFullKeyBinV1(slice);
      if (!decoded.ok) return decoded;
      const fp = await fullKeyFingerprint(decoded.key);
      if (seenFp.has(fp)) return fail('timebook.err.duplicateKey');
      seenFp.add(fp);
      slots.push({ slotIndex, fullKeyFingerprint: fp, key: decoded.key });
      off += FULL_KEY_BIN_V1_BYTES;
    }
    dayEntries.push({ day, date: isoDate(year, month, day), slots });
  }

  const storedFp = input.subarray(off, off + CBQR2_HASH_BYTES);
  off += CBQR2_HASH_BYTES;
  const storedDigest = input.subarray(off, off + CBQR2_HASH_BYTES);
  const digest = await sha256(input.subarray(0, input.length - CBQR2_HASH_BYTES));
  if (!equalBytes(digest, storedDigest)) return fail('cbqr2.err.packageDigest');

  const book = {
    kind: TIMEBOOK_KIND,
    year,
    month,
    timeProfile: profile,
    keyTimeReference: KEY_TIME_REFERENCE,
    networkContext: net,
    days: dayEntries,
  };
  const valid = validateTimebook(book);
  if (!valid.ok) return fail(valid.error);
  const identity = await timebookFingerprint(book);
  const identityBytes = hexToBytes(identity);
  if (!identityBytes || !equalBytes(identityBytes, storedFp)) {
    return fail('cbqr2.err.codebookFingerprint');
  }
  book.codebookFingerprint = identity;
  return { ok: true, timebook: book };
}

export { bytesToHex, equalBytes };
