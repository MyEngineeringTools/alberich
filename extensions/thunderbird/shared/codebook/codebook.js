/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Import von Alberich-Schlüsseltafeln (JSON aus dem Codebook-Tool).
 * Format: format === "alberich-codebook", formatVersion 1 oder 2.
 */

import {
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
  DEFAULT_REFLECTOR_D_PAIRS,
} from '../crypto/cipher-data.js';
import { applyKeyCode, applyRingCode } from './key-codes.js';
import { validateEndwalzeWiring, validateLueckenfueller } from '../crypto/modern-v3.js';

export const ALBERICH_CODEBOOK_FORMAT = 'alberich-codebook';
export const ALBERICH_CODEBOOK_FORMAT_VERSION = 3;

const REFLECTOR_IDS = new Set([
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
]);
const MAIN_SET = new Set(MAIN_ROTOR_IDS);
const THIN_SET = new Set(THIN_ROTOR_IDS);

/**
 * @typedef {object} CodebookDay
 * @property {number} day
 * @property {string} [date]
 * @property {string} reflectorId
 * @property {string} rotorThin
 * @property {string} rotorLeft
 * @property {string} rotorMiddle
 * @property {string} rotorRight
 * @property {string} ringCode
 * @property {string} keyCode
 * @property {string} plugboard
 * @property {string} [reflectorD]
 * @property {object} [meta]
 */

/**
 * @typedef {object} CodebookSheet
 * @property {string} format
 * @property {number} formatVersion
 * @property {number} year
 * @property {number} month
 * @property {string} [monthLabel]
 * @property {string} [generatedAt]
 * @property {string} [endwalzePolicy]
 * @property {CodebookDay[]} days
 */

/**
 * JSON-Text oder Objekt parsen und validieren.
 * @param {string|object} raw
 * @returns {{ ok: true, sheet: CodebookSheet } | { ok: false, error: string }}
 */
export function parseCodebookJson(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, error: 'codebook.err.invalidJson' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'codebook.err.notObject' };
  }

  if (data.format !== ALBERICH_CODEBOOK_FORMAT) {
    return { ok: false, error: 'codebook.err.badFormat' };
  }

  const version = Number(data.formatVersion);
  if (!Number.isFinite(version) || version < 1 || version > ALBERICH_CODEBOOK_FORMAT_VERSION) {
    return { ok: false, error: `codebook.err.badVersion|${data.formatVersion}` };
  }

  if (!Array.isArray(data.days) || data.days.length === 0) {
    return { ok: false, error: 'codebook.err.noDays' };
  }

  const days = [];
  for (const entry of data.days) {
    const checked = validateDayEntry(entry, version);
    if (!checked.ok) {
      return {
        ok: false,
        error: `codebook.err.dayEntry\t${entry?.day ?? '?'}\t${checked.error}`,
      };
    }
    days.push(checked.day);
  }

  days.sort((a, b) => a.day - b.day);

  const year = Number(data.year);
  const month = Number(data.month);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { ok: false, error: 'codebook.err.badYear' };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: 'codebook.err.badMonth' };
  }

  const endwalzePolicy = parseEndwalzePolicy(data.endwalzePolicy);

  return {
    ok: true,
    sheet: {
      format: ALBERICH_CODEBOOK_FORMAT,
      formatVersion: version,
      year,
      month,
      monthIndex0: typeof data.monthIndex0 === 'number' ? data.monthIndex0 : month - 1,
      monthLabel: typeof data.monthLabel === 'string' ? data.monthLabel : `${month}/${year}`,
      generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : '',
      ...(endwalzePolicy ? { endwalzePolicy } : {}),
      ...(typeof data.networkContext === 'string' && data.networkContext.trim()
        ? { networkContext: data.networkContext.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) }
        : {}),
      days,
    },
  };
}

function parseEndwalzePolicy(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'permutation' || v === 'dora' || v === 'mix' || v === 'historic' ? v : null;
}

/**
 * true, wenn die Tafel einen anderen Kalendermonat trägt als [year]/[month].
 * @param {CodebookSheet | null | undefined} sheet
 * @param {number} year
 * @param {number} month 1–12
 */
export function sheetDiffersFromCalendar(sheet, year, month) {
  if (!sheet) return false;
  return Number(sheet.year) !== year || Number(sheet.month) !== month;
}

/**
 * @param {unknown} entry
 * @returns {{ ok: true, day: CodebookDay } | { ok: false, error: string }}
 */
function validateDayEntry(entry, version = 1) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, error: 'codebook.err.entryMissing' };
  }

  const day = Number(/** @type {object} */ (entry).day);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: 'codebook.err.badDay' };
  }

  const e = /** @type {Record<string, unknown>} */ (entry);
  if (version >= 3) {
    const rotorThin = String(e.rotorThin ?? '');
    const rotorLeft = String(e.rotorLeft ?? '');
    const rotorMiddle = String(e.rotorMiddle ?? '');
    const rotorRight = String(e.rotorRight ?? '');
    if (!THIN_SET.has(rotorThin)) return { ok: false, error: 'codebook.err.badThin' };
    if (!MAIN_SET.has(rotorLeft) || !MAIN_SET.has(rotorMiddle) || !MAIN_SET.has(rotorRight)) {
      return { ok: false, error: 'codebook.err.badMain' };
    }
    if (new Set([rotorLeft, rotorMiddle, rotorRight]).size !== 3) {
      return { ok: false, error: 'codebook.err.mainUnique' };
    }
    const ringCode = String(e.ringCode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    const keyCode = String(e.keyCode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    if (ringCode.length !== 4) return { ok: false, error: 'codebook.err.ringsIncomplete' };
    if (keyCode.length !== 4) return { ok: false, error: 'codebook.err.keyIncomplete' };
    const wired = validateEndwalzeWiring(e.endwalzeWiring);
    if (!wired.ok) return { ok: false, error: wired.error };
    const notches = validateLueckenfueller(e.lueckenfueller);
    if (!notches.ok) return { ok: false, error: notches.error };
    return {
      ok: true,
      day: {
        day,
        date: typeof e.date === 'string' ? e.date : undefined,
        rotorThin,
        rotorLeft,
        rotorMiddle,
        rotorRight,
        ringCode,
        keyCode,
        plugboard: String(e.plugboard ?? '').toUpperCase().replace(/[^A-Z ]/g, '').trim(),
        endwalzeWiring: wired.wiring,
        lueckenfueller: notches.notches,
      },
    };
  }

  const reflectorId = String(e.reflectorId ?? '').toUpperCase();
  if (!REFLECTOR_IDS.has(reflectorId)) {
    return { ok: false, error: 'codebook.err.badReflector' };
  }

  const rotorThin = String(e.rotorThin ?? '');
  if (!THIN_SET.has(rotorThin)) {
    return { ok: false, error: 'codebook.err.badThin' };
  }

  const rotorLeft = String(e.rotorLeft ?? '');
  const rotorMiddle = String(e.rotorMiddle ?? '');
  const rotorRight = String(e.rotorRight ?? '');
  if (!MAIN_SET.has(rotorLeft) || !MAIN_SET.has(rotorMiddle) || !MAIN_SET.has(rotorRight)) {
    return { ok: false, error: 'codebook.err.badMain' };
  }
  if (new Set([rotorLeft, rotorMiddle, rotorRight]).size !== 3) {
    return { ok: false, error: 'codebook.err.mainUnique' };
  }

  const ringCode = String(e.ringCode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const keyCode = String(e.keyCode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (ringCode.length !== 4) return { ok: false, error: 'codebook.err.ringsIncomplete' };
  if (keyCode.length !== 4) return { ok: false, error: 'codebook.err.keyIncomplete' };

  const plugboard = String(e.plugboard ?? '').toUpperCase().replace(/[^A-Z ]/g, '').trim();
  let reflectorD = DEFAULT_REFLECTOR_D_PAIRS;
  if (reflectorId === REFLECTOR_ID_DORA) {
    if (typeof e.reflectorD === 'string' && e.reflectorD.trim()) {
      reflectorD = e.reflectorD.toUpperCase().replace(/[^A-Z ]/g, '').trim();
    }
  }

  return {
    ok: true,
    day: {
      day,
      date: typeof e.date === 'string' ? e.date : undefined,
      reflectorId,
      rotorThin,
      rotorLeft,
      rotorMiddle,
      rotorRight,
      ringCode,
      keyCode,
      plugboard,
      reflectorD: reflectorId === REFLECTOR_ID_DORA ? reflectorD : undefined,
      meta: e.meta && typeof e.meta === 'object' ? /** @type {object} */ (e.meta) : undefined,
    },
  };
}

/**
 * Tageseintrag → Patch für den Alberich-Maschinenstate (ohne plaintext/ciphertext).
 * @param {CodebookDay} day
 * @returns {Record<string, string>}
 */
export function dayEntryToSettingsPatch(day) {
  const positions = applyKeyCode(day.keyCode);
  const rings = applyRingCode(day.ringCode);
  if (!positions || !rings) {
    throw new Error('Ring- oder Grundstellung ungültig');
  }

  /** @type {Record<string, string>} */
  const patch = {
    reflectorId: day.reflectorId,
    rotorThin: day.rotorThin,
    rotorLeft: day.rotorLeft,
    rotorMiddle: day.rotorMiddle,
    rotorRight: day.rotorRight,
    ringCode: day.ringCode,
    ringThin: rings.thin,
    ringLeft: rings.left,
    ringMiddle: rings.middle,
    ringRight: rings.right,
    // ring thin is rings.thin — state may not store ringThin separately; ringCode holds all 4
    keyCode: day.keyCode,
    posThin: positions[0],
    posLeft: positions[1],
    posMiddle: positions[2],
    posRight: positions[3],
    plugboard: day.plugboard,
  };

  if (day.reflectorId === REFLECTOR_ID_DORA && day.reflectorD) {
    patch.reflectorD = day.reflectorD;
  }
  if (day.endwalzeWiring && day.lueckenfueller) {
    patch.endwalzeWiring = day.endwalzeWiring;
    patch.lueckenfueller = day.lueckenfueller;
    patch.modernProtocol = 'v3';
  }

  return patch;
}

/**
 * @param {CodebookSheet} sheet
 * @param {number} dayNum
 * @returns {CodebookDay|null}
 */
export function findCodebookDay(sheet, dayNum) {
  if (!sheet?.days) return null;
  return sheet.days.find((d) => d.day === dayNum) ?? null;
}

/**
 * Sinnvollen Standard-Tag wählen (heute, falls im Monat der Tafel).
 * @param {CodebookSheet} sheet
 */
export function defaultCodebookDay(sheet) {
  const now = new Date();
  if (now.getFullYear() === sheet.year && now.getMonth() + 1 === sheet.month) {
    const today = now.getDate();
    if (findCodebookDay(sheet, today)) return today;
  }
  return sheet.days[0]?.day ?? 1;
}
