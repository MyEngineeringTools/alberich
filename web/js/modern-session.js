/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Modern V3 message-key session lifetime (no GUI).
 *
 * EMPTY → reserve → ACTIVE_PRIVATE (live preview may reuse the MK)
 * ACTIVE_PRIVATE → controlled export → EXPOSED (repeat export of the same
 *   ciphertext does not rotate)
 * EXPOSED + relevant plaintext/key change → EMPTY (next encrypt reserves a new MK)
 *
 * Screenshots and OS-level copies outside app actions are out of scope.
 */

export const MODERN_SESSION = Object.freeze({
  EMPTY: 'EMPTY',
  ACTIVE_PRIVATE: 'ACTIVE_PRIVATE',
  EXPOSED: 'EXPOSED',
});

export function createModernSession() {
  let phase = MODERN_SESSION.EMPTY;
  let fp = '';
  let mk = '';
  let exposedPlain = null;
  let pin = null;

  return {
    phase() {
      return phase;
    },
    reservedFingerprint() {
      return fp;
    },
    reservedMessageKey() {
      return mk;
    },
    pinnedSlot() {
      return pin;
    },
    noteReserved(fullKeyFingerprint, messageKey) {
      fp = fullKeyFingerprint;
      mk = messageKey;
      if (phase === MODERN_SESSION.EMPTY) phase = MODERN_SESSION.ACTIVE_PRIVATE;
    },
    /**
     * Private authorization for a pinned slot/key. Flaky across reload by design.
     */
    noteAuthorized(auth) {
      fp = auth.fullKeyFingerprint;
      mk = auth.messageKey;
      pin = {
        codebookFingerprint: auth.codebookFingerprint,
        timeProfile: auth.timeProfile,
        slotId: auth.slotId,
        slotOrdinal: auth.slotOrdinal,
        fullKeyFingerprint: auth.fullKeyFingerprint,
        fullKey: auth.fullKey,
        epoch: auth.epoch,
      };
      if (phase === MODERN_SESSION.EMPTY) phase = MODERN_SESSION.ACTIVE_PRIVATE;
    },
    isReservedFor(fullKeyFingerprint, messageKey) {
      return phase !== MODERN_SESSION.EMPTY
        && fp === fullKeyFingerprint
        && mk === messageKey;
    },
    /**
     * P1 slot changes (and today's day change) alter the active full key.
     * Session lifetime follows the fingerprint, not the calendar date.
     */
    shouldInvalidateForFingerprint(fullKeyFingerprint) {
      return phase !== MODERN_SESSION.EMPTY
        && Boolean(fp)
        && fp !== fullKeyFingerprint;
    },
    markExposed(plainText) {
      if (phase === MODERN_SESSION.EMPTY) return;
      phase = MODERN_SESSION.EXPOSED;
      exposedPlain = String(plainText ?? '');
    },
    shouldRotateForPlain(plainText) {
      return phase === MODERN_SESSION.EXPOSED
        && String(plainText ?? '') !== exposedPlain;
    },
    invalidate() {
      phase = MODERN_SESSION.EMPTY;
      fp = '';
      mk = '';
      exposedPlain = null;
      pin = null;
    },
  };
}
