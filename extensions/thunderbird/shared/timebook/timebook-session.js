/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Timebook send/decrypt glue for the live path. No GUI.
 */

import { formatSlotId } from './alberich-key-time.js';
import { isTimebook, resolveTimebookSlot } from './timebook.js';
import { START, WATERMARK, authorizeSessionStart, advanceSendWatermark } from './security-state.js';
import { MAC_SEARCH, searchTimebookPruef20 } from './timebook-search.js';

export async function beginTimebookSendSession(opts) {
  const book = opts.timebook;
  if (!isTimebook(book)) return { ok: false, error: 'timebook.err.kind' };
  const resolved = resolveTimebookSlot(book, opts.timestampMs);
  if (!resolved.ok) return { ok: false, error: resolved.error, resolved };
  const auth = await authorizeSessionStart({
    fullKeyFingerprint: resolved.fullKeyFingerprint,
    codebookFingerprint: book.codebookFingerprint,
    timeProfile: book.timeProfile,
    slotOrdinal: resolved.meta.ordinal,
    slotId: resolved.slotId || formatSlotId(resolved.meta),
    nextMessageKey: opts.nextMessageKey,
    preferredMessageKey: opts.preferredMessageKey,
  });
  if (auth.status === START.TIME_ROLLBACK_BLOCKED) {
    return { ok: false, error: 'modern.timeRollback', status: auth.status, highestOrdinal: auth.highestOrdinal };
  }
  if (auth.status !== START.AUTHORIZED) {
    return { ok: false, error: 'modern.securityStateFailed', status: auth.status };
  }
  return {
    ok: true,
    messageKey: auth.messageKey,
    pin: {
      codebookFingerprint: book.codebookFingerprint,
      timeProfile: book.timeProfile,
      slotId: resolved.slotId,
      slotOrdinal: resolved.meta.ordinal,
      fullKeyFingerprint: resolved.fullKeyFingerprint,
      fullKey: resolved.key,
      epoch: resolved.epoch,
    },
  };
}

export async function externalizePinnedSlot(pin) {
  if (!pin?.codebookFingerprint) return { ok: true, skipped: true };
  const adv = await advanceSendWatermark({
    codebookFingerprint: pin.codebookFingerprint,
    timeProfile: pin.timeProfile,
    slotOrdinal: pin.slotOrdinal,
    slotId: pin.slotId,
  });
  if (adv.status === WATERMARK.STORAGE_FAILURE) {
    return { ok: false, error: 'modern.externalizeFailed' };
  }
  return { ok: true, status: adv.status };
}

export async function decryptTimebookTelegram(opts) {
  return searchTimebookPruef20({
    timebook: opts.timebook,
    cipherLetters: opts.cipherLetters,
    currentSlot: opts.currentSlot,
    networkContext: opts.networkContext,
    engine: opts.engine,
    configure: opts.configure,
  });
}

export { MAC_SEARCH };
