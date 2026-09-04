/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Display-only view of an ALB3_TIMEBOOK_V1 slot key.
 * Reads stored full-key fields. Does not derive, recode, or canonicalize.
 */

import { formatSlotHours, getSlotsForDay } from './alberich-key-time.js';

/** FULL_KEY_BIN_V1 cryptographic fields shown in the detail pane. */
export const TIMEBOOK_DISPLAY_FIELDS = Object.freeze([
  'rotorThin',
  'rotorLeft',
  'rotorMiddle',
  'rotorRight',
  'ringCode',
  'keyCode',
  'plugboard',
  'endwalzeWiring',
  'notchLeft',
  'notchMiddle',
  'notchRight',
]);

function stored(value) {
  return value == null ? '' : String(value);
}

/**
 * Rows for one already-validated slot key. Values are the stored strings.
 * Notch counts are the length of the stored letter lists.
 */
export function timebookKeyDisplayRows(key) {
  const k = key || {};
  const notches = k.lueckenfueller || {};
  const left = stored(notches.left);
  const middle = stored(notches.middle);
  const right = stored(notches.right);
  return [
    { id: 'rotorThin', labelKey: 'timebook.field.rotorThin', value: stored(k.rotorThin) },
    { id: 'rotorLeft', labelKey: 'timebook.field.rotorLeft', value: stored(k.rotorLeft) },
    { id: 'rotorMiddle', labelKey: 'timebook.field.rotorMiddle', value: stored(k.rotorMiddle) },
    { id: 'rotorRight', labelKey: 'timebook.field.rotorRight', value: stored(k.rotorRight) },
    { id: 'ringCode', labelKey: 'timebook.field.ringCode', value: stored(k.ringCode) },
    { id: 'keyCode', labelKey: 'timebook.field.keyCode', value: stored(k.keyCode) },
    { id: 'plugboard', labelKey: 'timebook.field.plugboard', value: stored(k.plugboard) },
    { id: 'endwalzeWiring', labelKey: 'timebook.field.endwalze', value: stored(k.endwalzeWiring) },
    { id: 'notchLeft', labelKey: 'timebook.field.notchLeft', value: left, count: left.length },
    { id: 'notchMiddle', labelKey: 'timebook.field.notchMiddle', value: middle, count: middle.length },
    { id: 'notchRight', labelKey: 'timebook.field.notchRight', value: right, count: right.length },
  ];
}

export function timebookKeyPlainText(key, t) {
  return timebookKeyDisplayRows(key).map((row) => {
    const label = t(row.labelKey, row.count != null ? { count: String(row.count) } : undefined);
    return `${label}: ${row.value}`;
  }).join('\n');
}

/**
 * Day/slot headers only. Slot keys are not copied into the outline.
 */
export function timebookDayOutline(book, current = null) {
  const currentDay = current?.ok ? current.meta.day : null;
  const currentSlot = current?.ok ? current.meta.slotIndex : null;
  const days = [];
  for (const dayEntry of book.days || []) {
    const templates = getSlotsForDay(book.year, book.month, dayEntry.day, book.timeProfile);
    const slots = (dayEntry.slots || []).map((slot, i) => {
      const meta = templates[i] || templates[slot.slotIndex];
      return {
        slotIndex: slot.slotIndex,
        hours: meta ? formatSlotHours(meta) : '',
        current: currentDay === dayEntry.day && currentSlot === slot.slotIndex,
      };
    });
    days.push({
      day: dayEntry.day,
      date: dayEntry.date,
      slotCount: slots.length,
      slots,
    });
  }
  return {
    days,
    currentDay,
    currentSlotIndex: currentSlot,
  };
}

export function slotSummaryText(hours, isCurrent, currentLabel) {
  const h = stored(hours);
  if (!isCurrent) return h;
  return `${h}  ${stored(currentLabel)}`;
}
