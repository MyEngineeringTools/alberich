/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Internal ALB3_TIMEBOOK_V1. Not a public export/CBQR format.
 *
 * Time selects an already-independent full V3 key. Time does not derive keys.
 * V3 epoch remains YYYY-MM-DD | MANUAL of the sheet day, not a slot id.
 *
 * codebookFingerprint is SHA-256 of the canonical identity (keys + profile +
 * month). UI names, network display names, generatedAt are excluded.
 *
 * `networkContext` on a V3 sheet is a MAC parameter (default ALB), not an
 * immutable codebook identity. User-facing network names are UI. Neither
 * belongs in codebookFingerprint (W6 §14).
 *
 * Weak-Key-Rejection: BLOCKED / Laboratory (P0.4). No placeholder filter.
 */

import {
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
} from './cipher-data.js';
import { validateStandardPlugboard } from './codebook.js';
import {
  TIME_PROFILE,
  SLOTS_PER_DAY,
  formatSlotId,
  getSlotForTimestamp,
  getSlotsForDay,
  requireTimeProfile,
} from './alberich-key-time.js';
import { fullKeyFingerprint } from './full-key-fingerprint.js';
import { validateEndwalzeWiring, validateLueckenfueller } from './modern-v3.js';

export const TIMEBOOK_KIND = 'ALB3_TIMEBOOK_V1';
export const TIMEBOOK_ID_VERSION = 'ALB3-TIMEBOOK-ID-V1';
export const KEY_TIME_REFERENCE = 'UTC+1';

const MAIN_SET = new Set(MAIN_ROTOR_IDS);
const THIN_SET = new Set(THIN_ROTOR_IDS);

export function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function validateFullV3Key(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'timebook.err.keyMissing' };
  }
  const rotorThin = String(raw.rotorThin ?? '');
  const rotorLeft = String(raw.rotorLeft ?? '');
  const rotorMiddle = String(raw.rotorMiddle ?? '');
  const rotorRight = String(raw.rotorRight ?? '');
  if (!THIN_SET.has(rotorThin)) return { ok: false, error: 'codebook.err.badThin' };
  if (!MAIN_SET.has(rotorLeft) || !MAIN_SET.has(rotorMiddle) || !MAIN_SET.has(rotorRight)) {
    return { ok: false, error: 'codebook.err.badMain' };
  }
  if (new Set([rotorLeft, rotorMiddle, rotorRight]).size !== 3) {
    return { ok: false, error: 'codebook.err.mainUnique' };
  }
  const ringCode = String(raw.ringCode ?? '').toUpperCase();
  const keyCode = String(raw.keyCode ?? '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(ringCode)) return { ok: false, error: 'codebook.err.ringsIncomplete' };
  if (!/^[A-Z]{4}$/.test(keyCode)) return { ok: false, error: 'codebook.err.keyIncomplete' };
  const plugs = validateStandardPlugboard(raw.plugboard);
  if (!plugs.ok) return plugs;
  const wired = validateEndwalzeWiring(raw.endwalzeWiring);
  if (!wired.ok) return { ok: false, error: wired.error };
  const notches = validateLueckenfueller(raw.lueckenfueller);
  if (!notches.ok) return { ok: false, error: notches.error };
  return {
    ok: true,
    key: {
      rotorThin,
      rotorLeft,
      rotorMiddle,
      rotorRight,
      ringCode,
      keyCode,
      plugboard: plugs.plugboard,
      endwalzeWiring: wired.wiring,
      lueckenfueller: notches.notches,
    },
  };
}

function fail(error) {
  return { ok: false, error };
}

/**
 * Strict internal timebook check. Generated books must be a full month.
 * Legacy adapters may pass `{ allowPartial: true }`.
 */
export function validateTimebook(book, opts = {}) {
  if (!book || book.kind !== TIMEBOOK_KIND) return fail('timebook.err.kind');
  if (!Number.isInteger(book.year) || book.year < 1900 || book.year > 2100) {
    return fail('timebook.err.year');
  }
  if (!Number.isInteger(book.month) || book.month < 1 || book.month > 12) {
    return fail('timebook.err.month');
  }
  try {
    requireTimeProfile(book.timeProfile);
  } catch {
    return fail('timebook.err.profile');
  }
  if (book.keyTimeReference !== KEY_TIME_REFERENCE) {
    return fail('timebook.err.keyTime');
  }
  if (!Array.isArray(book.days) || book.days.length === 0) return fail('timebook.err.noDays');

  const dim = daysInUtcMonth(book.year, book.month);
  const slotsPerDay = SLOTS_PER_DAY[book.timeProfile];
  if (!opts.allowPartial && book.days.length !== dim) return fail('timebook.err.dayCount');

  const seenDays = new Set();
  const seenFp = new Set();
  let expectedDay = opts.allowPartial ? book.days[0]?.day : 1;

  for (const dayEntry of book.days) {
    const day = dayEntry?.day;
    if (!Number.isInteger(day) || day < 1 || day > dim) return fail('timebook.err.badDay');
    if (seenDays.has(day)) return fail('timebook.err.duplicateDay');
    if (!opts.allowPartial && day !== expectedDay) return fail('timebook.err.dayOrder');
    seenDays.add(day);
    expectedDay = day + 1;
    if (dayEntry.date !== isoDate(book.year, book.month, day)) return fail('timebook.err.date');
    if (!Array.isArray(dayEntry.slots) || dayEntry.slots.length !== slotsPerDay) {
      return fail('timebook.err.slotCount');
    }
    for (let i = 0; i < slotsPerDay; i++) {
      const slot = dayEntry.slots[i];
      if (!slot || slot.slotIndex !== i) return fail('timebook.err.slotIndex');
      const checked = validateFullV3Key(slot.key);
      if (!checked.ok) return fail(checked.error);
      if (!/^[0-9a-f]{64}$/.test(slot.fullKeyFingerprint || '')) {
        return fail('timebook.err.fingerprint');
      }
      if (seenFp.has(slot.fullKeyFingerprint)) return fail('timebook.err.duplicateKey');
      seenFp.add(slot.fullKeyFingerprint);
    }
  }
  return { ok: true };
}

/**
 * Resolve the independent slot key for an absolute timestamp.
 * Time selects; it does not derive.
 */
export function resolveTimebookSlot(book, timestampMs) {
  if (!isTimebook(book)) return { ok: false, error: 'timebook.err.kind' };
  const meta = getSlotForTimestamp(timestampMs, book.timeProfile);
  if (meta.year !== book.year || meta.month !== book.month) {
    return { ok: false, error: 'timebook.err.outOfMonth', meta };
  }
  const dayEntry = (book.days || []).find((d) => d.day === meta.day);
  const slot = dayEntry?.slots?.[meta.slotIndex];
  if (!slot?.key) return { ok: false, error: 'timebook.err.slotMissing', meta };
  return {
    ok: true,
    meta,
    key: slot.key,
    fullKeyFingerprint: slot.fullKeyFingerprint,
    epoch: dayEntry.date,
    date: dayEntry.date,
    slotId: formatSlotId(meta),
  };
}

/**
 * Which stored full V3 key the main Walzenstellung should show.
 * A pinned in-progress message wins; otherwise the clock slot.
 * @returns {{ key: object, slotId: string, source: 'pin' | 'clock' } | null}
 */
export function selectDisplayFullKey(opts) {
  const book = opts.book;
  if (!opts.isModernMode || opts.keySource !== 'codebook' || !isTimebook(book)) {
    return null;
  }
  const pin = opts.pin;
  if (pin?.fullKey) {
    return {
      key: pin.fullKey,
      slotId: pin.slotId || '',
      source: 'pin',
    };
  }
  const resolved = resolveTimebookSlot(book, opts.timestampMs);
  if (!resolved.ok || !resolved.key) return null;
  return {
    key: resolved.key,
    slotId: resolved.slotId || '',
    source: 'clock',
  };
}

export function listTimebookSlots(book) {
  const out = [];
  for (const dayEntry of book.days || []) {
    const templates = getSlotsForDay(book.year, book.month, dayEntry.day, book.timeProfile);
    for (const slot of dayEntry.slots || []) {
      const meta = templates[slot.slotIndex];
      if (!meta) continue;
      out.push({
        ...meta,
        date: dayEntry.date,
        epoch: dayEntry.date,
        key: slot.key,
        fullKeyFingerprint: slot.fullKeyFingerprint,
      });
    }
  }
  return out;
}

export function canonicalizeTimebookIdentity(book) {
  const lines = [
    TIMEBOOK_ID_VERSION,
    `year:${book.year}`,
    `month:${book.month}`,
    `timeProfile:${book.timeProfile}`,
    `keyTimeReference:${KEY_TIME_REFERENCE}`,
    'slots:',
  ];
  for (const dayEntry of book.days) {
    for (const slot of dayEntry.slots) {
      lines.push(`${dayEntry.day}|${slot.slotIndex}|${slot.fullKeyFingerprint}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function hexDigest(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function timebookFingerprint(book) {
  const api = globalThis.crypto?.subtle;
  if (!api?.digest) {
    throw new Error('Web Crypto subtle.digest required for timebookFingerprint');
  }
  const bytes = new TextEncoder().encode(canonicalizeTimebookIdentity(book));
  return hexDigest(await api.digest('SHA-256', bytes));
}

/**
 * Read-only view of a V3 permutation month sheet as DAY_24H slot 0 per day.
 * Does not mutate `sheet`. Partial months are allowed (legacy).
 */
export async function adaptLegacySheetToTimebook(sheet) {
  if (!sheet || sheet.format !== 'alberich-codebook' || Number(sheet.formatVersion) < 3) {
    return { ok: false, error: 'timebook.err.notV3Sheet' };
  }
  if (sheet.endwalzePolicy && sheet.endwalzePolicy !== 'permutation') {
    return { ok: false, error: 'timebook.err.notV3Sheet' };
  }
  const days = [];
  for (const entry of sheet.days || []) {
    const checked = validateFullV3Key(entry);
    if (!checked.ok) return { ok: false, error: checked.error };
    const fp = await fullKeyFingerprint(checked.key);
    const date = entry.date || isoDate(sheet.year, sheet.month, entry.day);
    days.push({
      day: entry.day,
      date,
      slots: [{ slotIndex: 0, fullKeyFingerprint: fp, key: checked.key }],
    });
  }
  const book = {
    kind: TIMEBOOK_KIND,
    year: sheet.year,
    month: sheet.month,
    timeProfile: TIME_PROFILE.DAY_24H,
    keyTimeReference: KEY_TIME_REFERENCE,
    networkContext: sheet.networkContext || 'ALB',
    legacyPartial: days.length !== daysInUtcMonth(sheet.year, sheet.month),
    days,
  };
  const checked = validateTimebook(book, { allowPartial: true });
  if (!checked.ok) return checked;
  book.codebookFingerprint = await timebookFingerprint(book);
  return { ok: true, timebook: book };
}

export function isTimebook(value) {
  return Boolean(value && value.kind === TIMEBOOK_KIND);
}

export function rejectTimebookExport(value) {
  if (isTimebook(value)) {
    throw new Error('timebook.err.noCbqr1Export');
  }
}
