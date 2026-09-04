/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W3a Modern V3 session lifetime. node js/tests/modern-session-selftest.js
 */
import { createModernSession, MODERN_SESSION } from '../modern-session.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

const FP = '752a32bdcd340561985d0f11f75a6bc000ebc650498e7e2d96a93e64610f8a66';

{
  const s = createModernSession();
  assert(s.phase() === MODERN_SESSION.EMPTY, 'starts EMPTY');
  s.noteReserved(FP, 'KPLM');
  assert(s.phase() === MODERN_SESSION.ACTIVE_PRIVATE, 'reserve → ACTIVE_PRIVATE');
  assert(s.isReservedFor(FP, 'KPLM'), 'same MK still reserved');
  assert(!s.shouldRotateForPlain('H'), 'A: edit HALLO steps do not rotate');
  assert(!s.shouldRotateForPlain('HA'), 'A: HA');
  assert(!s.shouldRotateForPlain('HALLO'), 'A: HALLO still same session');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  assert(s.phase() === MODERN_SESSION.EXPOSED, 'B: copy → EXPOSED');
  s.markExposed('Text A');
  s.markExposed('Text A');
  assert(s.phase() === MODERN_SESSION.EXPOSED, 'B: repeat copy stays EXPOSED');
  assert(!s.shouldRotateForPlain('Text A'), 'B: unchanged text needs no new MK');
  assert(s.isReservedFor(FP, 'KPLM'), 'B: same MK after extra copies');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  assert(s.shouldRotateForPlain('Text B'), 'C: copy then edit requires new MK');
  s.invalidate();
  assert(s.phase() === MODERN_SESSION.EMPTY, 'C: session ended');
  s.noteReserved(FP, 'QXFR');
  assert(s.reservedMessageKey() === 'QXFR', 'C: new MK after expose+edit');
  assert(!s.isReservedFor(FP, 'KPLM'), 'C: old MK not reused in session');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  assert(s.shouldRotateForPlain('Text B'), 'D: share then edit same as copy');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  assert(s.shouldRotateForPlain('Text B'), 'E: message QR then edit same as copy');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.invalidate();
  assert(s.phase() === MODERN_SESSION.EMPTY, 'F: clear/new ends session');
  s.noteReserved(FP, 'NEWM');
  assert(s.reservedMessageKey() === 'NEWM', 'F: next message gets a new MK slot');
}

{
  const s = createModernSession();
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  s.invalidate();
  assert(s.phase() === MODERN_SESSION.EMPTY, 'G: codebook/key change invalidates');
  s.noteReserved('b'.repeat(64), 'KPLM');
  assert(s.reservedFingerprint() !== FP, 'G: new full key is a new session');
}

{
  const s = createModernSession();
  s.markExposed('ignored');
  assert(s.phase() === MODERN_SESSION.EMPTY, 'expose in EMPTY is a no-op');
}

{
  const s = createModernSession();
  const other = 'c'.repeat(64);
  s.noteReserved(FP, 'KPLM');
  s.markExposed('Text A');
  assert(s.shouldInvalidateForFingerprint(other), 'H: other full key invalidates session');
  assert(!s.shouldInvalidateForFingerprint(FP), 'H: same full key keeps session');
  s.invalidate();
  assert(!s.shouldInvalidateForFingerprint(other), 'H: EMPTY does not flag fingerprint change');
}

if (failed > 0) {
  console.error(`\n${failed} modern-session test(s) failed`);
  process.exit(1);
}
console.log('\nAll modern-session selftests passed.');
