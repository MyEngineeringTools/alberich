/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Tafelwort: CRC-32-Kenngruppe über den Slim-Inhalt einer Monatstafel.
 *
 * Nicht JSON.stringify — nur die Felder, die die Maschine braucht.
 * monthLabel / generatedAt / date ändern das Wort nicht.
 *
 * Kanonischer UTF-8-Strom (eine Zeile = ein \\n):
 *
 *   ALBTW1
 *   {formatVersion}
 *   {year}
 *   {month}
 *   {endwalzePolicy oder leer}
 *   {day}|{reflectorId}|{thin}|{left}|{middle}|{right}|{ring}|{key}|{stecker}|{dora oder leer}
 *
 * IEEE CRC-32 (poly 0xEDB88320, wie java.util.zip.CRC32), dann 7 Buchstaben
 * A–Z (Base-26, höchstwertig links), Anzeige „XXXX XXX“.
 */

/** @typedef {import('./codebook.js').CodebookSheet} CodebookSheet */
/** @typedef {import('./codebook.js').CodebookDay} CodebookDay */

export const TAFELWORT_MAGIC = 'ALBTW1';
export const TAFELWORT_LETTER_COUNT = 7;

const CRC32_POLY = 0xedb88320;
const CRC32_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? CRC32_POLY ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * IEEE CRC-32 über beliebige Bytes.
 * Bekannter Vektor: „123456789“ → 0xCBF43926.
 * @param {Uint8Array} bytes
 * @returns {number} unsigned 32-bit
 */
export function crc32Ieee(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 32-Bit-Wert → 7 Buchstaben A–Z, höchstwertige Stelle links.
 * @param {number} crc
 * @returns {string}
 */
export function encodeTafelwortLetters(crc) {
  let n = crc >>> 0;
  const digits = new Array(TAFELWORT_LETTER_COUNT);
  for (let i = TAFELWORT_LETTER_COUNT - 1; i >= 0; i--) {
    digits[i] = n % 26;
    n = Math.floor(n / 26);
  }
  return digits.map((d) => String.fromCharCode(65 + d)).join('');
}

/**
 * Sieben Buchstaben → „XXXX XXX“.
 * @param {string} letters
 * @returns {string}
 */
export function formatTafelwort(letters) {
  const compact = String(letters || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, TAFELWORT_LETTER_COUNT)
    .padStart(TAFELWORT_LETTER_COUNT, 'A');
  return `${compact.slice(0, 4)} ${compact.slice(4)}`;
}

/**
 * Kanonischer Payload (UTF-8-Zeilen, immer mit abschließendem \\n pro Zeile).
 * @param {CodebookSheet | null | undefined} sheet
 * @returns {string}
 */
export function canonicalTafelwortPayload(sheet) {
  if (!sheet || !Array.isArray(sheet.days) || sheet.days.length === 0) return '';

  const version = Number.isInteger(sheet.formatVersion) ? sheet.formatVersion : 1;
  const year = Number(sheet.year);
  const month = Number(sheet.month);
  const policy = typeof sheet.endwalzePolicy === 'string' ? sheet.endwalzePolicy : '';

  const lines = [
    TAFELWORT_MAGIC,
    String(version),
    String(year),
    String(month),
    policy,
    ...(version >= 3 ? [typeof sheet.networkContext === 'string' ? sheet.networkContext : 'ALB'] : []),
  ];

  const days = sheet.days.slice().sort((a, b) => a.day - b.day);
  for (const day of days) {
    if (version >= 3) {
      const lf = day.lueckenfueller || {};
      lines.push(
        [
          day.day,
          'PERM',
          day.rotorThin,
          day.rotorLeft,
          day.rotorMiddle,
          day.rotorRight,
          day.ringCode,
          day.keyCode,
          day.plugboard ?? '',
          day.endwalzeWiring ?? '',
          lf.left ?? '',
          lf.middle ?? '',
          lf.right ?? '',
        ].join('|'),
      );
      continue;
    }
    const dora = day.reflectorD == null ? '' : String(day.reflectorD);
    lines.push(
      [
        day.day,
        day.reflectorId,
        day.rotorThin,
        day.rotorLeft,
        day.rotorMiddle,
        day.rotorRight,
        day.ringCode,
        day.keyCode,
        day.plugboard ?? '',
        dora,
      ].join('|'),
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Tafelwort der Monatstafel, oder leer ohne Tage.
 * @param {CodebookSheet | null | undefined} sheet
 * @returns {string}
 */
export function tafelwort(sheet) {
  const payload = canonicalTafelwortPayload(sheet);
  if (!payload) return '';
  const bytes = new TextEncoder().encode(payload);
  return formatTafelwort(encodeTafelwortLetters(crc32Ieee(bytes)));
}
