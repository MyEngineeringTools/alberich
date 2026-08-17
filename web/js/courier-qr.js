/**
 * Kurier-QR: ein Spruch als einzelner Code (Parity Android CourierQr).
 * Alphanumeric-Nutzlast ALBERICH-CTQR1- + A–Z, QR Version 20 / ECC M = 970 Zeichen.
 */

import { utf8ToBase26 } from './modern-crypto.js';

export const COURIER_QR_MAGIC = 'ALBERICH-CTQR1';
export const COURIER_QR_SEPARATOR = '-';
export const COURIER_QR_PREFIX = `${COURIER_QR_MAGIC}${COURIER_QR_SEPARATOR}`;

export const MAX_QR_ALPHANUMERIC = 970;
export const HEADER_LETTERS = 4;
export const MAX_CIPHER_LETTERS = MAX_QR_ALPHANUMERIC - COURIER_QR_PREFIX.length; // 955
export const MAX_BASE26_BODY = MAX_CIPHER_LETTERS - HEADER_LETTERS; // 951
export const MAX_UTF8_BYTES = Math.floor(MAX_BASE26_BODY / 2); // 475

const APPROACHING_NUM = 4;
const APPROACHING_DEN = 5;

/** @typedef {'ok' | 'approaching' | 'over'} CourierFit */

export function cipherLettersFromPlain(plain) {
  return HEADER_LETTERS + utf8ToBase26(plain).length;
}

export function cipherLettersFromField(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '').length;
}

/** @param {number} cipherLetters @returns {CourierFit} */
export function courierFit(cipherLetters) {
  if (cipherLetters > MAX_CIPHER_LETTERS) return 'over';
  const approachingAt = Math.floor((MAX_CIPHER_LETTERS * APPROACHING_NUM) / APPROACHING_DEN);
  if (cipherLetters > approachingAt) return 'approaching';
  return 'ok';
}

export function buildCourierPayload(cipher) {
  const letters = String(cipher || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return COURIER_QR_PREFIX + letters;
}

export function parseCourierPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed.toUpperCase().startsWith(COURIER_QR_MAGIC)) return null;
  const rest = trimmed.slice(COURIER_QR_MAGIC.length).replace(/^[-|:\s]+/, '');
  const letters = rest.toUpperCase().replace(/[^A-Z]/g, '');
  return letters || null;
}

export function payloadFits(payload) {
  return String(payload || '').length <= MAX_QR_ALPHANUMERIC;
}

export function isCourierScanTarget(raw) {
  return parseCourierPayload(raw) != null;
}

export function canShowCourierQr(cipher) {
  const n = cipherLettersFromField(cipher);
  return n > 0 && courierFit(n) !== 'over';
}

/** QR-Nutzlast oder nackte A–Z (Messenger-Text) → nur Buchstaben. */
export function lettersFromInput(raw) {
  const text = String(raw ?? '');
  if (text.toUpperCase().includes('ALBERICH-CBQR1')) return '';
  return parseCourierPayload(text) || text.toUpperCase().replace(/[^A-Z]/g, '');
}
