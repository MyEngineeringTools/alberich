/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * PRUEF20 MAC-first candidate search over an internal timebook.
 * Does not change PRUEF20 semantics. Rotor BODY is decrypted only after
 * exactly one MAC match.
 */

import { listTimebookSlots } from './timebook.js';
import {
  canonicalDayKey,
  canonicalMacInput,
  computePruefgruppe,
  deriveAuthKey,
  modernV3DecryptPayload,
  parseV3Telegram,
  timingSafeEqualLetters,
} from './modern-v3.js';

export const MAC_SEARCH = Object.freeze({
  MATCH: 'MATCH',
  NO_KEY_MATCH: 'NO_KEY_MATCH',
  AMBIGUOUS_KEY_MATCH: 'AMBIGUOUS_KEY_MATCH',
});

function slotKey(slot) {
  return `${slot.day}:${slot.slotIndex}`;
}

/**
 * Deterministic UX order: current, previous, next, rest of current ALB day
 * by proximity, then the rest of the timebook by proximity.
 */
export function candidateSlotOrder(timebook, currentSlot) {
  const all = listTimebookSlots(timebook);
  if (!all.length) return [];
  const currentOrdinal = currentSlot?.ordinal;
  const dist = (s) => (
    Number.isInteger(currentOrdinal) ? Math.abs(s.ordinal - currentOrdinal) : s.ordinal
  );
  const byId = new Map(all.map((s) => [slotKey(s), s]));
  const picked = [];
  const used = new Set();
  const take = (s) => {
    if (!s) return;
    const id = slotKey(s);
    if (used.has(id) || !byId.has(id)) return;
    used.add(id);
    picked.push(byId.get(id));
  };

  const current = Number.isInteger(currentSlot?.day) && Number.isInteger(currentSlot?.slotIndex)
    ? byId.get(slotKey(currentSlot))
    : null;
  const idx = current ? all.findIndex((s) => slotKey(s) === slotKey(current)) : -1;
  take(current);
  if (idx > 0) take(all[idx - 1]);
  if (idx >= 0 && idx + 1 < all.length) take(all[idx + 1]);

  const dayNum = current?.day ?? currentSlot?.day;
  const sameDay = all.filter((s) => s.day === dayNum)
    .sort((a, b) => dist(a) - dist(b) || a.slotIndex - b.slotIndex);
  for (const s of sameDay) take(s);

  const rest = [...all].sort((a, b) => dist(a) - dist(b) || a.ordinal - b.ordinal);
  for (const s of rest) take(s);
  return picked;
}

export async function defaultVerifySlotMac({ key, epoch, parsed, networkContext }) {
  const dayConfig = {
    ...key,
    groundKey: key.keyCode,
    notches: key.lueckenfueller,
    networkContext,
    epoch,
  };
  const authKey = await deriveAuthKey(canonicalDayKey(dayConfig));
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
  return timingSafeEqualLetters(expected, parsed.pruef);
}

/**
 * @param {{
 *   timebook: object,
 *   cipherLetters: string,
 *   currentSlot: object,
 *   networkContext?: string,
 *   verifyMac?: Function,
 *   decryptPayload?: Function,
 *   engine: object,
 *   configure: Function,
 * }} opts
 */
export async function searchTimebookPruef20(opts) {
  const parsed = parseV3Telegram(opts.cipherLetters);
  if (!parsed.ok) {
    return { status: MAC_SEARCH.NO_KEY_MATCH, error: parsed.error, macChecks: 0, decryptCalls: 0 };
  }
  const networkContext = opts.networkContext || opts.timebook.networkContext || 'ALB';
  const order = candidateSlotOrder(opts.timebook, opts.currentSlot);
  const verify = opts.verifyMac || defaultVerifySlotMac;
  const hits = [];
  let macChecks = 0;

  for (const slot of order) {
    macChecks += 1;
    const pass = await verify({
      key: slot.key,
      epoch: slot.epoch,
      parsed,
      networkContext,
      slot,
    });
    if (pass) hits.push(slot);
    if (hits.length > 1) break;
  }

  if (hits.length === 0) {
    return { status: MAC_SEARCH.NO_KEY_MATCH, macChecks, decryptCalls: 0 };
  }
  if (hits.length > 1) {
    return { status: MAC_SEARCH.AMBIGUOUS_KEY_MATCH, macChecks, decryptCalls: 0, hits };
  }

  const match = hits[0];
  const decrypt = opts.decryptPayload || modernV3DecryptPayload;
  const configure = (code) => {
    if (typeof opts.configure === 'function') return opts.configure(code, match.key);
    return false;
  };
  const result = await decrypt({
    engine: opts.engine,
    configure,
    groundKey: match.key.keyCode,
    cipherLetters: opts.cipherLetters,
    dayConfig: {
      ...match.key,
      notches: match.key.lueckenfueller,
      networkContext,
      epoch: match.epoch,
    },
  });
  return {
    status: result?.ok ? MAC_SEARCH.MATCH : MAC_SEARCH.NO_KEY_MATCH,
    macChecks,
    decryptCalls: 1,
    match,
    result,
  };
}
