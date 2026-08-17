/**
 * Modern V3 — spezifiziertes experimentelles Rotorprotokoll.
 *
 * Traditional und Modern V2 bleiben unberührt. V3 ist ein eigener Pfad:
 * ALB3-Telegramm, vierstufige Kaskade, freie Endwalzen-Permutation,
 * unabhängige Lückenfüller auf der Tafel, Base-26 V2, Prüfgruppe (HMAC).
 *
 * Keine AES-Äquivalenz, kein Sicherheitsbeweis.
 */

import {
  LUECKENFUELLER_NOTCH_COUNTS,
  inverseWiring,
  isInvolutoryWiring,
  isPermutationWiring,
  letterToPos,
  modernDecryptPayload,
  modernEncryptPayload,
  normalizePlugPairsCanonical,
  posToLetter,
} from './modern-crypto.js';
import { cryptoRandomInt, randomFourLetters } from './secure-random.js';

/** Sichtbarer Telegrammstempel — nur A–Z, sonst frisst extractLetters die Ziffer. */
export const MODERN_V3_STAMP = 'ALBV';
export const MODERN_V3_FORMAT_VERSION = 3;
/** Protokollname im kanonischen Schlüsselmaterial (darf Ziffern enthalten). */
export const MODERN_V3_PROTOCOL = 'ALB3';
export const PRUEF_LETTERS = 20;
export const MESSAGE_ID_LETTERS = 8;
export const HEADER_LETTERS = 4;
export const HKDF_SALT = 'ALBERICH-ALB3-AUTH';
export const HKDF_INFO = 'pruefgruppe-v1';
export const DEFAULT_NETWORK_CONTEXT = 'ALB';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PRUEF_MOD = 26n ** BigInt(PRUEF_LETTERS);
const NOTCH_COUNT_SET = new Set(LUECKENFUELLER_NOTCH_COUNTS);

function nextIntFn(nextInt) {
  return typeof nextInt === 'function' ? nextInt : cryptoRandomInt;
}

export function randomLetters(n, nextInt = cryptoRandomInt) {
  const rnd = nextIntFn(nextInt);
  let out = '';
  for (let i = 0; i < n; i++) out += AZ[rnd(26)];
  return out;
}

export function randomMessageId(nextInt = cryptoRandomInt) {
  return randomLetters(MESSAGE_ID_LETTERS, nextInt);
}

// ---------------------------------------------------------------------------
// Lückenfüller — unabhängiges Tagesmaterial, sichtbar, keine Normalisierung
// ---------------------------------------------------------------------------

export function generateNotchSet(nextInt = cryptoRandomInt) {
  const rnd = nextIntFn(nextInt);
  const count = LUECKENFUELLER_NOTCH_COUNTS[rnd(LUECKENFUELLER_NOTCH_COUNTS.length)];
  const pool = [...AZ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort().join('');
}

export function generateLueckenfueller(nextInt = cryptoRandomInt) {
  return {
    left: generateNotchSet(nextInt),
    middle: generateNotchSet(nextInt),
    right: generateNotchSet(nextInt),
  };
}

/**
 * Strikt: A–Z, eindeutig, Länge in {5,7,9}, bereits A→Z sortiert.
 * Keine stillschweigende Umsortierung.
 */
export function validateNotchSet(raw) {
  const s = String(raw ?? '');
  if (!/^[A-Z]+$/.test(s)) {
    return { ok: false, error: 'modern.notchesInvalid' };
  }
  if (!NOTCH_COUNT_SET.has(s.length)) {
    return { ok: false, error: 'modern.notchesCount' };
  }
  if (new Set(s).size !== s.length) {
    return { ok: false, error: 'modern.notchesDuplicate' };
  }
  const sorted = [...s].sort().join('');
  if (sorted !== s) {
    return { ok: false, error: 'modern.notchesUnsorted' };
  }
  return { ok: true, notches: s };
}

export function validateLueckenfueller(value) {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'modern.notchesMissing' };
  }
  const left = validateNotchSet(value.left);
  const middle = validateNotchSet(value.middle);
  const right = validateNotchSet(value.right);
  if (!left.ok) return left;
  if (!middle.ok) return middle;
  if (!right.ok) return right;
  return {
    ok: true,
    notches: { left: left.notches, middle: middle.notches, right: right.notches },
  };
}

// ---------------------------------------------------------------------------
// Endwalze — echte 26!-Permutation
// ---------------------------------------------------------------------------

/** Identity with a fixed 3-cycle ABC → BCA. Never an involution, independent of RNG. */
function nonInvolutoryFallbackWiring() {
  const letters = [...AZ];
  const first = letters[0];
  letters[0] = letters[1];
  letters[1] = letters[2];
  letters[2] = first;
  return letters.join('');
}

export function generateEndwalzeWiring(nextInt = cryptoRandomInt) {
  const rnd = nextIntFn(nextInt);
  for (let attempt = 0; attempt < 64; attempt++) {
    const letters = [...AZ];
    for (let i = letters.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const wiring = letters.join('');
    if (!isInvolutoryWiring(wiring)) return wiring;
  }
  return nonInvolutoryFallbackWiring();
}

export function validateEndwalzeWiring(raw, opts = {}) {
  const wiring = String(raw ?? '').toUpperCase();
  if (!isPermutationWiring(wiring)) {
    return { ok: false, error: 'modern.endwalzeInvalid' };
  }
  const rejectInvolutory = opts.rejectInvolutory !== false;
  if (rejectInvolutory && isInvolutoryWiring(wiring)) {
    return { ok: false, error: 'modern.endwalzeInvolutory' };
  }
  let fixedPoints = 0;
  for (let i = 0; i < 26; i++) {
    if (wiring.charCodeAt(i) - 65 === i) fixedPoints += 1;
  }
  return { ok: true, wiring, involutory: isInvolutoryWiring(wiring), fixedPoints };
}

// ---------------------------------------------------------------------------
// Base-26 V2 — ganze Nachricht als Integer, Länge aus Ziffernzahl
// ---------------------------------------------------------------------------

export function minDigitsForByteLen(byteLen) {
  const L = Number(byteLen);
  if (!Number.isInteger(L) || L < 0) return -1;
  if (L === 0) return 0;
  const limit = 1n << (8n * BigInt(L));
  let k = 0;
  let acc = 1n;
  while (acc < limit) {
    acc *= 26n;
    k += 1;
  }
  return k;
}

export function byteLenFromDigits(k) {
  const K = Number(k);
  if (!Number.isInteger(K) || K < 0) return null;
  if (K === 0) return 0;
  let lo = 1;
  let hi = Math.max(4, Math.ceil(K / 1.5) + 8);
  while (minDigitsForByteLen(hi) < K) hi *= 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = minDigitsForByteLen(mid);
    if (d === K) return mid;
    if (d < K) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

export function intToBase26(n, width) {
  let x = BigInt(n);
  const out = new Array(width);
  for (let i = width - 1; i >= 0; i--) {
    out[i] = posToLetter(Number(x % 26n));
    x /= 26n;
  }
  return out.join('');
}

export function base26ToInt(letters) {
  let n = 0n;
  for (const ch of letters) {
    n = n * 26n + BigInt(letterToPos(ch));
  }
  return n;
}

export function utf8ToBase26v2(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  if (bytes.length === 0) return '';
  let n = 0n;
  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  return intToBase26(n, minDigitsForByteLen(bytes.length));
}

export function base26v2ToUtf8(letters) {
  const clean = String(letters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (clean.length === 0) return { ok: true, text: '' };
  const L = byteLenFromDigits(clean.length);
  if (L == null) return { ok: false, error: 'modern.base26InvalidLength' };
  const n = base26ToInt(clean);
  const limit = 1n << (8n * BigInt(L));
  if (n >= limit) return { ok: false, error: 'modern.base26Range' };
  const bytes = new Uint8Array(L);
  let x = n;
  for (let i = L - 1; i >= 0; i--) {
    bytes[i] = Number(x & 255n);
    x >>= 8n;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'modern.base26Utf8' };
  }
}

// ---------------------------------------------------------------------------
// Kanonisches Schlüsselmaterial + Prüfgruppe
// ---------------------------------------------------------------------------

export function normalizeNetworkContext(value) {
  const s = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
  return s || DEFAULT_NETWORK_CONTEXT;
}

export function normalizeEpoch(value) {
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s === 'MANUAL' || s === '') return 'MANUAL';
  return 'MANUAL';
}

/**
 * Same epoch Web and Android use for a sheet day.
 * Companion/Thunderbird must use this, not a silent MANUAL fallback.
 */
export function resolveV3Epoch({ date, year, month, day } = {}) {
  const stamped = normalizeEpoch(date);
  if (stamped !== 'MANUAL') return stamped;
  const y = Number(year);
  const m = Number(month);
  const n = Number(day);
  if (
    Number.isInteger(y) && y >= 1900 && y <= 2100
    && Number.isInteger(m) && m >= 1 && m <= 12
    && Number.isInteger(n) && n >= 1 && n <= 31
  ) {
    return `${y}-${String(m).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  }
  return 'MANUAL';
}

/** A–Z only, at most four letters. No locale-dependent mapping. */
export function normalizeGroundKey(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

/**
 * @param {{
 *   networkContext?: string,
 *   epoch?: string,
 *   rotorThin: string,
 *   rotorLeft: string,
 *   rotorMiddle: string,
 *   rotorRight: string,
 *   ringCode: string,
 *   groundKey?: string,
 *   plugboard: string,
 *   endwalzeWiring: string,
 *   notches: { left: string, middle: string, right: string },
 * }} material
 */
export function canonicalDayKey(material) {
  const plugs = normalizePlugPairsCanonical(material.plugboard).join(' ');
  const notches = material.notches;
  return [
    'ALB3-KEY',
    `net:${normalizeNetworkContext(material.networkContext)}`,
    `epoch:${normalizeEpoch(material.epoch)}`,
    `rotors:${material.rotorThin},${material.rotorLeft},${material.rotorMiddle},${material.rotorRight}`,
    `rings:${String(material.ringCode || '').toUpperCase()}`,
    `ground:${normalizeGroundKey(material.groundKey)}`,
    `plugs:${plugs}`,
    `end:${String(material.endwalzeWiring || '').toUpperCase()}`,
    `notches:${notches.left}|${notches.middle}|${notches.right}`,
    '',
  ].join('\n');
}

export function canonicalMacInput({ networkContext, epoch, messageId, header, body }) {
  return [
    'ALB3-MAC',
    `net:${normalizeNetworkContext(networkContext)}`,
    `epoch:${normalizeEpoch(epoch)}`,
    `mid:${String(messageId || '').toUpperCase()}`,
    `hdr:${String(header || '').toUpperCase()}`,
    `body:${String(body || '').toUpperCase()}`,
    '',
  ].join('\n');
}

function subtle() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('Web Crypto subtle API required for Modern V3');
  return c.subtle;
}

export async function deriveAuthKey(canonicalKeyUtf8) {
  const api = subtle();
  const ikm = new TextEncoder().encode(canonicalKeyUtf8);
  const salt = new TextEncoder().encode(HKDF_SALT);
  const info = new TextEncoder().encode(HKDF_INFO);
  const key = await api.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await api.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hmacSha256(keyBytes, msgBytes) {
  const api = subtle();
  const key = await api.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await api.sign('HMAC', key, msgBytes));
}

export function encodePruefgruppe(hmacBytes) {
  let n = 0n;
  for (let i = 0; i < 12; i++) n = (n << 8n) | BigInt(hmacBytes[i] ?? 0);
  n %= PRUEF_MOD;
  return intToBase26(n, PRUEF_LETTERS);
}

export function timingSafeEqualLetters(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  const n = Math.max(x.length, y.length);
  let diff = x.length === y.length ? 0 : 1;
  for (let i = 0; i < n; i++) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function computePruefgruppe(authKeyBytes, macInputUtf8) {
  const mac = await hmacSha256(authKeyBytes, new TextEncoder().encode(macInputUtf8));
  return encodePruefgruppe(mac);
}

export class ReplayCache {
  /**
   * @param {number} [max=512]
   */
  constructor(max = 512) {
    this.max = max;
    this.order = [];
    this.set = new Set();
  }

  key(epoch, messageId) {
    return `${normalizeEpoch(epoch)}|${String(messageId || '').toUpperCase()}`;
  }

  has(epoch, messageId) {
    return this.set.has(this.key(epoch, messageId));
  }

  add(epoch, messageId) {
    const k = this.key(epoch, messageId);
    if (this.set.has(k)) return;
    this.set.add(k);
    this.order.push(k);
    while (this.order.length > this.max) {
      const old = this.order.shift();
      this.set.delete(old);
    }
  }
}

// ---------------------------------------------------------------------------
// Telegramm
// ---------------------------------------------------------------------------

export function isV3Telegram(letters) {
  const clean = String(letters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return clean.startsWith(MODERN_V3_STAMP);
}

export function parseV3Telegram(letters) {
  const clean = String(letters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const min = MODERN_V3_STAMP.length + HEADER_LETTERS + MESSAGE_ID_LETTERS + PRUEF_LETTERS;
  if (clean.length < min) {
    return { ok: false, error: 'modern.v3TooShort' };
  }
  if (!clean.startsWith(MODERN_V3_STAMP)) {
    return { ok: false, error: 'modern.notV3' };
  }
  const header = clean.slice(4, 8);
  const messageId = clean.slice(8, 16);
  const pruef = clean.slice(-PRUEF_LETTERS);
  const body = clean.slice(16, clean.length - PRUEF_LETTERS);
  return { ok: true, stamp: MODERN_V3_STAMP, header, messageId, body, pruef, letters: clean };
}

/**
 * Live V3 (published Rev 47): double-step, four rotors.
 * Engine.step() does the same when modernProtocol === 'v3'.
 *
 * Notch-Prüfung vor jeder Bewegung.
 * Right läuft immer.
 * Right-Kerbe → Middle.
 * Middle-Kerbe → Left und Middle (Doppel Schritt).
 * Left-Kerbe → Thin und Left (Doppel Schritt).
 */
export function nextV3Positions(pos, notchesAt) {
  const stepThin = !!notchesAt.left;
  const stepLeft = !!notchesAt.left || !!notchesAt.middle;
  const stepMiddle = !!notchesAt.middle || !!notchesAt.right;
  return {
    thin: (pos.thin + (stepThin ? 1 : 0)) % 26,
    left: (pos.left + (stepLeft ? 1 : 0)) % 26,
    middle: (pos.middle + (stepMiddle ? 1 : 0)) % 26,
    right: (pos.right + 1) % 26,
  };
}

/** Future option / research: pure carry, no double-step. Not used by step(). */
export function nextV3PositionsCascade(pos, notchesAt) {
  const stepMiddle = !!notchesAt.right;
  const stepLeft = stepMiddle && !!notchesAt.middle;
  const stepThin = stepLeft && !!notchesAt.left;
  return {
    thin: (pos.thin + (stepThin ? 1 : 0)) % 26,
    left: (pos.left + (stepLeft ? 1 : 0)) % 26,
    middle: (pos.middle + (stepMiddle ? 1 : 0)) % 26,
    right: (pos.right + 1) % 26,
  };
}

/** @deprecated Use nextV3Positions (live is double-step again). */
export function nextV3PositionsDoubleStep(pos, notchesAt) {
  return nextV3Positions(pos, notchesAt);
}

export const V3_STANDARD_PROFILE = Object.freeze({
  name: 'Modern V3 Standard Profile',
  rotors: 4,
  ringLetters: 4,
  groundLetters: 4,
  plugPairs: 10,
  endwalzeLetters: 26,
  notchCounts: Object.freeze([5, 7, 9]),
  stamp: MODERN_V3_STAMP,
  headerLetters: HEADER_LETTERS,
  messageIdLetters: MESSAGE_ID_LETTERS,
  pruefLetters: PRUEF_LETTERS,
});

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   engine: { encryptMessage: (s: string) => string },
 *   configure: (keyCode: string) => boolean,
 *   groundKey: string,
 *   plainText: string,
 *   messageKey: string,
 *   messageId?: string,
 *   dayConfig: Record<string, unknown>,
 * }} opts
 */
export async function modernV3EncryptPayload(opts) {
  const { engine, configure, groundKey, plainText, messageKey, dayConfig } = opts;
  if (!/^[A-Z]{4}$/.test(groundKey)) {
    return { ok: false, error: 'modern.groundIncomplete' };
  }
  if (!/^[A-Z]{4}$/.test(messageKey)) {
    return { ok: false, error: 'modern.messageKeyInvalid' };
  }
  const wiring = validateEndwalzeWiring(dayConfig?.endwalzeWiring);
  if (!wiring.ok) return { ok: false, error: wiring.error };
  const notches = validateLueckenfueller(dayConfig?.notches || dayConfig?.lueckenfueller);
  if (!notches.ok) return { ok: false, error: notches.error };

  const bodyLetters = utf8ToBase26v2(plainText);
  if (!configure(groundKey)) return { ok: false, error: 'modern.configureFailed' };
  const header = engine.encryptMessage(messageKey);
  if (header.length !== HEADER_LETTERS) return { ok: false, error: 'modern.headerFailed' };
  if (!configure(messageKey)) return { ok: false, error: 'modern.configureFailed' };
  const body = engine.encryptMessage(bodyLetters);

  const messageId = /^[A-Z]{8}$/.test(opts.messageId || '')
    ? opts.messageId
    : randomMessageId();
  const networkContext = normalizeNetworkContext(dayConfig.networkContext);
  const epoch = normalizeEpoch(dayConfig.epoch);
  const authKey = await deriveAuthKey(
    canonicalDayKey({
      ...dayConfig,
      groundKey,
      endwalzeWiring: wiring.wiring,
      notches: notches.notches,
      networkContext,
      epoch,
    }),
  );
  const pruef = await computePruefgruppe(
    authKey,
    canonicalMacInput({ networkContext, epoch, messageId, header, body }),
  );

  return {
    ok: true,
    cipher: MODERN_V3_STAMP + header + messageId + body + pruef,
    header,
    body,
    messageKey,
    messageId,
    pruefgruppe: pruef,
    base26Length: bodyLetters.length,
  };
}

/**
 * MAC zuerst. Klartext erst danach.
 *
 * @param {{
 *   engine: { decryptMessage: (s: string) => string },
 *   configure: (keyCode: string) => boolean,
 *   groundKey: string,
 *   cipherLetters: string,
 *   dayConfig: Record<string, unknown>,
 *   replayCache?: ReplayCache | null,
 * }} opts
 */
export async function modernV3DecryptPayload(opts) {
  const { engine, configure, groundKey, dayConfig, replayCache } = opts;
  if (!/^[A-Z]{4}$/.test(groundKey)) {
    return { ok: false, error: 'modern.groundIncomplete' };
  }
  const parsed = parseV3Telegram(opts.cipherLetters);
  if (!parsed.ok) return parsed;

  const wiring = validateEndwalzeWiring(dayConfig?.endwalzeWiring);
  if (!wiring.ok) return { ok: false, error: wiring.error };
  const notches = validateLueckenfueller(dayConfig?.notches || dayConfig?.lueckenfueller);
  if (!notches.ok) return { ok: false, error: notches.error };

  const networkContext = normalizeNetworkContext(dayConfig.networkContext);
  const epoch = normalizeEpoch(dayConfig.epoch);
  const authKey = await deriveAuthKey(
    canonicalDayKey({
      ...dayConfig,
      groundKey,
      endwalzeWiring: wiring.wiring,
      notches: notches.notches,
      networkContext,
      epoch,
    }),
  );
  const expected = await computePruefgruppe(
    authKey,
    canonicalMacInput({
      networkContext,
      epoch,
      messageId: parsed.messageId,
      header: parsed.header,
      body: parsed.body,
    }),
  );
  if (!timingSafeEqualLetters(expected, parsed.pruef)) {
    return { ok: false, error: 'modern.macFailed' };
  }

  if (replayCache && replayCache.has(epoch, parsed.messageId)) {
    return { ok: false, error: 'modern.replay' };
  }

  if (!configure(groundKey)) return { ok: false, error: 'modern.configureFailed' };
  const messageKey = engine.decryptMessage(parsed.header);
  if (!/^[A-Z]{4}$/.test(messageKey)) {
    return { ok: false, error: 'modern.messageKeyInvalid' };
  }
  if (!configure(messageKey)) return { ok: false, error: 'modern.configureFailed' };
  const bodyLetters = engine.decryptMessage(parsed.body);
  const decoded = base26v2ToUtf8(bodyLetters);
  if (!decoded.ok) return { ok: false, error: decoded.error };

  if (replayCache) replayCache.add(epoch, parsed.messageId);

  return {
    ok: true,
    plainText: decoded.text,
    header: parsed.header,
    bodyCipher: parsed.body,
    messageKey,
    messageId: parsed.messageId,
    pruefgruppe: parsed.pruef,
  };
}

export function detectModernProtocol(cipherLetters, sheetVersion) {
  const clean = String(cipherLetters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  // Stamp wins. A leftover v1/v2 sheet must not hide an ALBV telegram.
  if (isV3Telegram(clean)) return 'v3';
  const ver = Number(sheetVersion);
  if (ver >= 3) return 'v3';
  if (ver > 0 && ver < 3) return 'v2';
  return 'v2';
}

export {
  inverseWiring,
  modernDecryptPayload,
  modernEncryptPayload,
  randomFourLetters,
};
