/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Import von Alberich-Schlüsseltafeln (JSON aus dem Codebook-Tool).
 * Format: format === "alberich-codebook", formatVersion 1, 2 oder 3.
 */

import {
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
  DEFAULT_REFLECTOR_D_PAIRS,
} from './cipher-data.js';
import { parseEndwalzePolicy } from './endwalze-policy.js';
import { applyKeyCode, applyRingCode } from './text-processing.js';
import { validateEndwalzeWiring, validateLueckenfueller } from './modern-v3.js';
import { LIMITS } from './limits.js';

export const ALBERICH_CODEBOOK_FORMAT = 'alberich-codebook';
/** Höchste akzeptierte Version (3 = Modern V3 / freie Permutation). */
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
 * @property {string} [endwalzeWiring]
 * @property {{ left: string, middle: string, right: string }} [lueckenfueller]
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
  if (typeof raw === 'string' && new TextEncoder().encode(raw).length > LIMITS.MAX_CODEBOOK_JSON_BYTES) {
    return { ok: false, error: 'limits.codebookJson' };
  }
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

  const dim = daysInUtcMonth(year, month);
  const seenDays = new Set();
  for (const d of days) {
    if (d.day > dim) return { ok: false, error: 'codebook.err.dayOutOfMonth' };
    if (seenDays.has(d.day)) return { ok: false, error: 'codebook.err.duplicateDay' };
    seenDays.add(d.day);
    if (d.date) {
      const expected = `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
      if (d.date !== expected) return { ok: false, error: 'codebook.err.dateMismatch' };
    }
  }

  const endwalzePolicy = parseEndwalzePolicy(data.endwalzePolicy);
  if (version >= 3) {
    if (endwalzePolicy !== 'permutation') {
      return { ok: false, error: 'codebook.err.v3Policy' };
    }
  }

  let networkContext;
  if (Object.prototype.hasOwnProperty.call(data, 'networkContext') && data.networkContext != null && data.networkContext !== '') {
    const net = String(data.networkContext);
    if (!/^[A-Z0-9]{1,16}$/.test(net)) {
      return { ok: false, error: 'codebook.err.networkContext' };
    }
    networkContext = net;
  }

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
      ...(networkContext ? { networkContext } : {}),
      days,
    },
  };
}

function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Modern V3 standard profile: exactly 10 disjoint pairs. Validate, do not repair. */
export function validateStandardPlugboard(raw) {
  const s = String(raw ?? '').toUpperCase().trim();
  if (!/^(?:[A-Z]{2} ){9}[A-Z]{2}$/.test(s)) {
    return { ok: false, error: 'codebook.err.plugsInvalid' };
  }
  const pairs = s.split(' ');
  const letters = [];
  for (const pair of pairs) {
    if (pair[0] === pair[1]) return { ok: false, error: 'codebook.err.plugSelf' };
    letters.push(pair[0], pair[1]);
  }
  if (new Set(letters).size !== 20) return { ok: false, error: 'codebook.err.plugDuplicate' };
  return { ok: true, plugboard: s };
}

/**
 * @param {unknown} entry
 * @param {number} version
 * @returns {{ ok: true, day: CodebookDay } | { ok: false, error: string }}
 */
function validateDayEntry(entry, version) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, error: 'codebook.err.entryMissing' };
  }

  const day = Number(/** @type {object} */ (entry).day);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: 'codebook.err.badDay' };
  }

  const e = /** @type {Record<string, unknown>} */ (entry);

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

  const ringCode = String(e.ringCode ?? '').toUpperCase();
  const keyCode = String(e.keyCode ?? '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(ringCode)) return { ok: false, error: 'codebook.err.ringsIncomplete' };
  if (!/^[A-Z]{4}$/.test(keyCode)) return { ok: false, error: 'codebook.err.keyIncomplete' };

  let plugboard = String(e.plugboard ?? '').toUpperCase().trim();
  if (version >= 3) {
    const plugs = validateStandardPlugboard(plugboard);
    if (!plugs.ok) return plugs;
    plugboard = plugs.plugboard;
  } else {
    plugboard = plugboard.replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** @type {CodebookDay} */
  const out = {
    day,
    date: typeof e.date === 'string' ? e.date : undefined,
    rotorThin,
    rotorLeft,
    rotorMiddle,
    rotorRight,
    ringCode,
    keyCode,
    plugboard,
    meta: e.meta && typeof e.meta === 'object' ? /** @type {object} */ (e.meta) : undefined,
  };

  if (version >= 3) {
    const wired = validateEndwalzeWiring(e.endwalzeWiring);
    if (!wired.ok) return { ok: false, error: wired.error };
    const notches = validateLueckenfueller(e.lueckenfueller);
    if (!notches.ok) return { ok: false, error: notches.error };
    out.endwalzeWiring = wired.wiring;
    out.lueckenfueller = notches.notches;
    if (e.reflectorId != null && e.reflectorId !== '') {
      const reflectorId = String(e.reflectorId).toUpperCase();
      if (!REFLECTOR_IDS.has(reflectorId)) return { ok: false, error: 'codebook.err.badReflector' };
      out.reflectorId = reflectorId;
    }
    return { ok: true, day: out };
  }

  const reflectorId = String(e.reflectorId ?? '').toUpperCase();
  if (!REFLECTOR_IDS.has(reflectorId)) {
    return { ok: false, error: 'codebook.err.badReflector' };
  }
  out.reflectorId = reflectorId;
  if (reflectorId === REFLECTOR_ID_DORA) {
    let reflectorD = DEFAULT_REFLECTOR_D_PAIRS;
    if (typeof e.reflectorD === 'string' && e.reflectorD.trim()) {
      reflectorD = e.reflectorD.toUpperCase().replace(/[^A-Z ]/g, '').trim();
    }
    out.reflectorD = reflectorD;
  }
  return { ok: true, day: out };
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

  /** @type {Record<string, unknown>} */
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
  } else {
    patch.modernProtocol = 'v2';
    patch.endwalzeWiring = '';
    patch.lueckenfueller = null;
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
 * Heutiger Kalendertag, wenn die Tafel genau diesen Monat abdeckt und den Tag enthält.
 * @param {CodebookSheet} sheet
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} dayOfMonth
 * @returns {number | null}
 */
export function todayOnSheet(sheet, year, month, dayOfMonth) {
  if (!sheet || sheet.year !== year || sheet.month !== month) return null;
  return findCodebookDay(sheet, dayOfMonth)?.day ?? null;
}

/**
 * true, wenn die Tafel einen anderen Kalendermonat trägt als heute.
 * @param {CodebookSheet | null | undefined} sheet
 * @param {number} year
 * @param {number} month 1–12
 */
export function sheetDiffersFromCalendar(sheet, year, month) {
  if (!sheet) return false;
  return Number(sheet.year) !== year || Number(sheet.month) !== month;
}

/**
 * Sinnvollen Standard-Tag wählen (heute, falls im Monat der Tafel).
 * @param {CodebookSheet} sheet
 */
export function defaultCodebookDay(sheet) {
  const now = new Date();
  return todayOnSheet(sheet, now.getFullYear(), now.getMonth() + 1, now.getDate())
    ?? sheet.days[0]?.day
    ?? 1;
}
