/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Alberich-Schlüsselzeit and slot identity. No DOM, crypto, codebook I/O, or UI.
 *
 * Alberich-Schlüsselzeit = UTC+1 year-round. Not Europe/Berlin (no DST).
 * Slot identity is codebook/state metadata. It is not part of the V3 telegram
 * and does not redefine `epoch` (still YYYY-MM-DD | MANUAL of the sheet day).
 *
 * Time selects which already-independent full V3 key is active. Time does not
 * derive key material.
 */

export const ALBERICH_UTC_OFFSET_MS = 60 * 60 * 1000;

export const TIME_PROFILE = Object.freeze({
  DAY_24H: 'DAY_24H',
  HOURS_4: 'HOURS_4',
  HOUR_1: 'HOUR_1',
});

export const SLOTS_PER_DAY = Object.freeze({
  [TIME_PROFILE.DAY_24H]: 1,
  [TIME_PROFILE.HOURS_4]: 6,
  [TIME_PROFILE.HOUR_1]: 24,
});

export const HOURS_PER_SLOT = Object.freeze({
  [TIME_PROFILE.DAY_24H]: 24,
  [TIME_PROFILE.HOURS_4]: 4,
  [TIME_PROFILE.HOUR_1]: 1,
});

const PROFILE_SET = new Set(Object.values(TIME_PROFILE));

let nowFn = () => Date.now();

export function configureKeyTime(partial = {}) {
  if (typeof partial.now === 'function') nowFn = partial.now;
}

export function resetKeyTimeForTests() {
  nowFn = () => Date.now();
}

function unixMs(timestampMs) {
  const t = timestampMs == null ? nowFn() : Number(timestampMs);
  if (!Number.isFinite(t)) {
    throw new Error('alberich.invalidTimestamp');
  }
  return Math.floor(t);
}

export function requireTimeProfile(profile) {
  if (!PROFILE_SET.has(profile)) {
    throw new Error('alberich.unknownTimeProfile');
  }
  return profile;
}

/**
 * Calendar and clock in Alberich-Schlüsselzeit (UTC+1, no DST).
 * Components are read from (unixMs + 1h) via UTC getters so the host TZ
 * cannot affect the result.
 */
export function getAlberichDateTime(timestampMs) {
  const unix = unixMs(timestampMs);
  const alb = unix + ALBERICH_UTC_OFFSET_MS;
  const d = new Date(alb);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    millisecond: d.getUTCMilliseconds(),
    unixMs: unix,
  };
}

/**
 * Inverse of getAlberichDateTime for a wall-clock instant in UTC+1.
 * `hour` may be 24 to mean next-day 00:00 (exclusive slot end).
 */
export function alberichWallToUnixMs(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  const y = Number(year);
  const m = Number(month);
  const n = Number(day);
  const h = Number(hour);
  const min = Number(minute);
  const s = Number(second);
  const ms = Number(millisecond);
  if (![y, m, n, h, min, s, ms].every(Number.isInteger)) {
    throw new Error('alberich.invalidDate');
  }
  if (h < 0 || h > 24 || min < 0 || min > 59 || s < 0 || s > 59 || ms < 0 || ms > 999) {
    throw new Error('alberich.invalidDate');
  }
  if (h === 24 && (min !== 0 || s !== 0 || ms !== 0)) {
    throw new Error('alberich.invalidDate');
  }
  if (h !== 24) assertAlberichDate(y, m, n);
  return Date.UTC(y, m - 1, n, h, min, s, ms) - ALBERICH_UTC_OFFSET_MS;
}

function assertAlberichDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('alberich.invalidDate');
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('alberich.invalidDate');
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() + 1 !== month
    || probe.getUTCDate() !== day
  ) {
    throw new Error('alberich.invalidDate');
  }
}

function makeSlot(profile, year, month, day, slotIndex) {
  const hours = HOURS_PER_SLOT[profile];
  const count = SLOTS_PER_DAY[profile];
  return Object.freeze({
    profile,
    year,
    month,
    day,
    slotIndex,
    startHour: slotIndex * hours,
    endHour: (slotIndex + 1) * hours,
    ordinal: dayOrdinal(year, month, day) * count + slotIndex,
  });
}

function dayOrdinal(year, month, day) {
  return Date.UTC(year, month - 1, day) / 86400000;
}

/**
 * Half-open slot [start, end) containing `timestampMs` in the given profile.
 */
export function getSlotForTimestamp(timestampMs, profile) {
  const p = requireTimeProfile(profile);
  const alb = getAlberichDateTime(timestampMs);
  const hours = HOURS_PER_SLOT[p];
  const slotIndex = Math.floor(alb.hour / hours);
  return makeSlot(p, alb.year, alb.month, alb.day, slotIndex);
}

export function getSlotsForDay(year, month, day, profile) {
  const p = requireTimeProfile(profile);
  assertAlberichDate(year, month, day);
  const count = SLOTS_PER_DAY[p];
  const slots = [];
  for (let i = 0; i < count; i++) slots.push(makeSlot(p, year, month, day, i));
  return slots;
}

export function formatSlotHours(slot) {
  if (!slot || !Number.isInteger(slot.startHour) || !Number.isInteger(slot.endHour)) {
    throw new Error('alberich.invalidSlot');
  }
  const a = String(slot.startHour).padStart(2, '0');
  const b = slot.endHour === 24 ? '24' : String(slot.endHour).padStart(2, '0');
  return `${a}–${b}`;
}

export function formatSlotId(slot) {
  if (!slot || !PROFILE_SET.has(slot.profile)) {
    throw new Error('alberich.invalidSlot');
  }
  const y = String(slot.year);
  const m = String(slot.month).padStart(2, '0');
  const d = String(slot.day).padStart(2, '0');
  return `${y}-${m}-${d}/${slot.profile}/${slot.slotIndex}`;
}

export function slotOrdinal(slot) {
  if (!slot || !PROFILE_SET.has(slot.profile) || !Number.isInteger(slot.ordinal)) {
    throw new Error('alberich.invalidSlot');
  }
  return slot.ordinal;
}

/**
 * Same-profile ordering: -1 / 0 / 1. Different profiles throw.
 * Suitable later for `candidateSlot < highestSendSlot` within one profile.
 */
export function compareSlots(a, b) {
  if (!a || !b || a.profile !== b.profile) {
    throw new Error('alberich.slotProfileMismatch');
  }
  const da = slotOrdinal(a) - slotOrdinal(b);
  return da < 0 ? -1 : da > 0 ? 1 : 0;
}

export function isSlotRollback(candidate, watermark) {
  return compareSlots(candidate, watermark) < 0;
}

/** Codebook month of a slot (Alberich calendar, not the host TZ). */
export function codebookMonthOfSlot(slot) {
  if (!slot || !PROFILE_SET.has(slot.profile)) {
    throw new Error('alberich.invalidSlot');
  }
  return { year: slot.year, month: slot.month };
}

/**
 * Encrypt-path snapshot: compute the slot once. UI may recompute freely;
 * a crypto operation must keep this object, not call getSlotForTimestamp again.
 */
export function pinSlotForOperation(timestampMs, profile) {
  return getSlotForTimestamp(timestampMs, profile);
}

/**
 * Abstract slot → already-independent full V3 key. No derivation from time.
 * @param {Iterable<{ slot: object, key: unknown }>} entries
 */
export function createSlotKeyResolver(entries) {
  const byId = new Map();
  for (const entry of entries || []) {
    byId.set(formatSlotId(entry.slot), entry.key);
  }
  return {
    resolve(slot) {
      if (!slot) return null;
      return byId.get(formatSlotId(slot)) ?? null;
    },
  };
}
