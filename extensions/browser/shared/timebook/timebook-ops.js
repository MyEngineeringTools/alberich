/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Timebook encrypt/decrypt for Companion panel and background.
 */

import { CipherEngine } from '../crypto/cipher-engine.js';
import { randomMessageKey4 } from '../crypto/modern-crypto.js';
import { extractLetters, configureModernEngine, encryptModern } from '../modern-ops.js';
import { dayEntryToSettingsPatch } from '../codebook/codebook.js';
import { getSlotForTimestamp, alberichWallToUnixMs } from './alberich-key-time.js';
import { isTimebook } from './timebook.js';
import {
  beginTimebookSendSession,
  decryptTimebookTelegram,
  externalizePinnedSlot,
  MAC_SEARCH,
} from './timebook-session.js';

export { MAC_SEARCH };

export function timebookKeyToConfig(key, book, epoch) {
  const patch = dayEntryToSettingsPatch(key);
  return {
    ...patch,
    networkContext: book.networkContext || 'ALB',
    epoch,
  };
}

export function slotEndUnixMs(meta) {
  if (!meta) return 0;
  return alberichWallToUnixMs(
    meta.year,
    meta.month,
    meta.day,
    meta.endHour === 24 ? 24 : meta.endHour,
  );
}

export function formatCountdownClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function shortFingerprint(hex) {
  const s = String(hex || '');
  if (s.length < 12) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

/**
 * Controlled export: reserve MK, encrypt, raise send watermark.
 * No leftover pin (context-menu / one-shot).
 */
export async function encryptTimebookOnce(book, plainText) {
  if (!isTimebook(book)) return { ok: false, error: 'timebook.err.kind' };
  const started = await beginTimebookSendSession({
    timebook: book,
    timestampMs: Date.now(),
    nextMessageKey: randomMessageKey4,
  });
  if (!started.ok) return started;
  const config = timebookKeyToConfig(started.pin.fullKey, book, started.pin.epoch);
  const result = await encryptModern(config, plainText, started.messageKey);
  if (!result.ok) return result;
  const ext = await externalizePinnedSlot(started.pin);
  if (!ext.ok) return ext;
  return result;
}

export async function decryptTimebookOnce(book, cipherText) {
  if (!isTimebook(book)) return { ok: false, error: 'timebook.err.kind' };
  const engine = new CipherEngine();
  const letters = extractLetters(cipherText);
  const current = getSlotForTimestamp(Date.now(), book.timeProfile);
  const search = await decryptTimebookTelegram({
    timebook: book,
    cipherLetters: letters,
    currentSlot: current,
    networkContext: book.networkContext,
    engine,
    configure: (code, key) => configureModernEngine(
      engine,
      timebookKeyToConfig(key, book),
      code,
    ).ok,
  });
  if (search.status === MAC_SEARCH.MATCH && search.result?.ok) {
    return {
      ok: true,
      plainText: search.result.plainText,
      header: search.result.header,
      messageKey: search.result.messageKey,
      messageId: search.result.messageId,
      pruefgruppe: search.result.pruefgruppe,
    };
  }
  if (search.status === MAC_SEARCH.AMBIGUOUS_KEY_MATCH) {
    return { ok: false, error: 'modern.ambiguousKey' };
  }
  return { ok: false, error: search.error || 'modern.noKeyMatch' };
}
