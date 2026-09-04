/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W6 security-state v2, rollback, pinning, delayed externalize.
 */
import {
  SECURITY_DB_NAME,
  SECURITY_STORE,
  SECURITY_WATERMARK_STORE,
  START,
  WATERMARK,
  authorizeSessionStart,
  advanceSendWatermark,
  configureSecurityState,
  countReservations,
  openSecurityDb,
  readSendWatermark,
  resetSecurityStateForTests,
  upgradeSecurityDb,
} from '../security-state.js';
import { createModernSession, MODERN_SESSION } from '../modern-session.js';
import { createFakeIndexedDB } from './fake-indexeddb.js';
import { TIME_PROFILE, getSlotsForDay } from '../alberich-key-time.js';

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
const BOOK = 'bb'.repeat(32);
const PROF = TIME_PROFILE.HOURS_4;

function installFake(extra = {}, idbOpts = {}) {
  resetSecurityStateForTests();
  const idb = extra.idb || createFakeIndexedDB(idbOpts);
  configureSecurityState({
    idbFactory: extra.idbFactory || (() => idb),
    locks: extra.locks || (() => null),
    now: extra.now || (() => 1_000_000),
    afterAdd: extra.afterAdd,
  });
  return idb;
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('aborted'));
    tx.onerror = () => reject(tx.error || new Error('tx error'));
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

{
  const idb = createFakeIndexedDB();
  const db1 = await new Promise((resolve, reject) => {
    const req = idb.open(SECURITY_DB_NAME, 1);
    req.onupgradeneeded = (e) => upgradeSecurityDb(req.result, e.oldVersion, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert(db1.objectStoreNames.contains(SECURITY_STORE), 'v1 has reservations');
  assert(!db1.objectStoreNames.contains(SECURITY_WATERMARK_STORE), 'v1 has no watermark store');
  const tx = db1.transaction([SECURITY_STORE], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(SECURITY_STORE).add({
    fullKeyFingerprint: FP,
    messageKey: 'KEEP',
    reservedAt: 1,
    securityStateVersion: 1,
  });
  await done;
  resetSecurityStateForTests();
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
  const db2 = await openSecurityDb();
  assert(db2.objectStoreNames.contains(SECURITY_WATERMARK_STORE), 'v2 adds watermark store');
  assert(await countReservations() === 1, 'migration keeps reservations');
}

function nextMkFactory(seq) {
  let i = 0;
  return () => seq[i++] || 'ZZZZ';
}

{
  installFake();
  const slot = getSlotsForDay(2026, 9, 3, PROF)[2];
  const a = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: slot.ordinal,
    slotId: `${slot.day}/${slot.slotIndex}`,
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'AAAA',
  });
  assert(a.status === START.AUTHORIZED, 'A: no watermark → session starts');
  const mark = await readSendWatermark(BOOK, PROF);
  assert(!mark, 'A: authorize does not write watermark');
}

{
  installFake();
  const slot = getSlotsForDay(2026, 9, 3, PROF)[2];
  const opts = {
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: slot.ordinal,
    slotId: 'd3/2',
    fullKeyFingerprint: FP,
  };
  const a = await authorizeSessionStart({ ...opts, nextMessageKey: () => 'AAAA' });
  const b = await authorizeSessionStart({
    ...opts,
    fullKeyFingerprint: 'cc'.repeat(32),
    nextMessageKey: () => 'BBBB',
  });
  assert(a.status === START.AUTHORIZED && b.status === START.AUTHORIZED, 'B: same slot two MKs both ok');
  await advanceSendWatermark({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: slot.ordinal,
    slotId: 'd3/2',
  });
  const c = await authorizeSessionStart({
    ...opts,
    fullKeyFingerprint: 'dd'.repeat(32),
    nextMessageKey: () => 'CCCC',
  });
  assert(c.status === START.AUTHORIZED, 'B: same highest ordinal still allowed');
}

{
  installFake();
  const s0 = getSlotsForDay(2026, 9, 3, PROF)[0];
  const s1 = getSlotsForDay(2026, 9, 3, PROF)[1];
  const high = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'high',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'HIGH',
  });
  assert(high.status === START.AUTHORIZED, 'C: future private session authorized');
  assert(!(await readSendWatermark(BOOK, PROF)), 'C: watermark still empty after private future');
}

{
  installFake();
  const s1 = getSlotsForDay(2026, 9, 3, PROF)[1];
  await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'x',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'PRIV',
  });
  assert(!(await readSendWatermark(BOOK, PROF)), 'D: discarded private session leaves watermark unset');
}

{
  installFake();
  const s1 = getSlotsForDay(2026, 9, 3, PROF)[1];
  await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'e',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'EXPO',
  });
  const adv = await advanceSendWatermark({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'e',
  });
  assert(adv.status === WATERMARK.ADVANCED && adv.highestOrdinal === s1.ordinal, 'E: externalize raises watermark');
}

{
  installFake();
  const s0 = getSlotsForDay(2026, 9, 3, PROF)[0];
  const s1 = getSlotsForDay(2026, 9, 3, PROF)[1];
  await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'e',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'EXPO',
  });
  await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s1.ordinal, slotId: 'e',
  });
  const blocked = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s0.ordinal,
    slotId: 'old',
    fullKeyFingerprint: 'ee'.repeat(32),
    nextMessageKey: () => 'OLDX',
  });
  assert(blocked.status === START.TIME_ROLLBACK_BLOCKED, 'F: new lower slot blocked');
  assert(await countReservations() === 1, 'F: blocked start does not reserve MK');
}

{
  installFake();
  const s0 = getSlotsForDay(2026, 9, 3, PROF)[0];
  const s1 = getSlotsForDay(2026, 9, 3, PROF)[1];
  const sessionA = createModernSession();
  const authA = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s0.ordinal,
    slotId: 'A',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'MESA',
  });
  sessionA.noteAuthorized({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotId: 'A',
    slotOrdinal: s0.ordinal,
    fullKeyFingerprint: FP,
    messageKey: authA.messageKey,
    fullKey: { keyCode: 'CDSZ' },
  });
  const authB = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s1.ordinal,
    slotId: 'B',
    fullKeyFingerprint: 'ff'.repeat(32),
    nextMessageKey: () => 'MESB',
  });
  await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s1.ordinal, slotId: 'B',
  });
  const delayed = await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s0.ordinal, slotId: 'A',
  });
  assert(delayed.status === WATERMARK.UNCHANGED, 'G: delayed A does not lower watermark');
  const wm = await readSendWatermark(BOOK, PROF);
  assert(wm.highestOrdinal === s1.ordinal, 'G: watermark stays max(B, A)');
  assert(sessionA.phase() === MODERN_SESSION.ACTIVE_PRIVATE, 'G: old session still authorized');
  assert(sessionA.pinnedSlot().slotOrdinal === s0.ordinal, 'G: A keeps pinned slot');
  void authB;
}

{
  installFake();
  const s0 = getSlotsForDay(2026, 9, 3, PROF)[0];
  const s10 = getSlotsForDay(2026, 9, 3, PROF)[5];
  await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s0.ordinal, slotId: 'N',
  });
  await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s10.ordinal,
    slotId: 'future',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'FUTR',
  });
  const wm = await readSendWatermark(BOOK, PROF);
  assert(wm.highestOrdinal === s0.ordinal, 'future-preview discard: watermark stays N');
  const next = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s0.ordinal,
    slotId: 'n2',
    fullKeyFingerprint: '11'.repeat(32),
    nextMessageKey: () => 'NEXT',
  });
  assert(next.status === START.AUTHORIZED, 'after discarded future, slot N still usable');
}

{
  installFake();
  const s0 = getSlotsForDay(2026, 9, 3, PROF)[0];
  const s10 = getSlotsForDay(2026, 9, 3, PROF)[5];
  await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s0.ordinal, slotId: 'N',
  });
  await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s10.ordinal,
    slotId: 'copied',
    fullKeyFingerprint: FP,
    nextMessageKey: () => 'COPY',
  });
  await advanceSendWatermark({
    codebookFingerprint: BOOK, timeProfile: PROF, slotOrdinal: s10.ordinal, slotId: 'copied',
  });
  const blocked = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: s0.ordinal,
    slotId: 'back',
    fullKeyFingerprint: '22'.repeat(32),
    nextMessageKey: () => 'BACK',
  });
  assert(blocked.status === START.TIME_ROLLBACK_BLOCKED, 'future externalized then clock back → blocked');
}

{
  installFake();
  const slot = getSlotsForDay(2026, 9, 3, PROF)[2];
  const [t1, t2] = await Promise.all([
    authorizeSessionStart({
      codebookFingerprint: BOOK,
      timeProfile: PROF,
      slotOrdinal: slot.ordinal,
      slotId: 'tab',
      fullKeyFingerprint: FP,
      nextMessageKey: nextMkFactory(['TABA', 'ZZZA']),
    }),
    authorizeSessionStart({
      codebookFingerprint: BOOK,
      timeProfile: PROF,
      slotOrdinal: slot.ordinal,
      slotId: 'tab',
      fullKeyFingerprint: '33'.repeat(32),
      nextMessageKey: nextMkFactory(['TABB', 'ZZZB']),
    }),
  ]);
  assert(
    t1.status === START.AUTHORIZED && t2.status === START.AUTHORIZED,
    'multi-tab same slot different MK both send',
  );
}

{
  installFake();
  const slot = getSlotsForDay(2026, 9, 3, PROF)[2];
  const a = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: slot.ordinal,
    slotId: 'race',
    fullKeyFingerprint: FP,
    preferredMessageKey: 'SAME',
    nextMessageKey: () => 'AAAX',
  });
  const b = await authorizeSessionStart({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotOrdinal: slot.ordinal,
    slotId: 'race',
    fullKeyFingerprint: FP,
    preferredMessageKey: 'SAME',
    nextMessageKey: () => 'AAAY',
  });
  assert(a.status === START.AUTHORIZED && a.messageKey === 'SAME', 'same MK first reservation');
  assert(b.status === START.AUTHORIZED && b.messageKey === 'AAAY', 'same MK second start retries to a new MK');
}

{
  const s = createModernSession();
  const slotA = getSlotsForDay(2026, 9, 3, PROF)[2];
  const slotB = getSlotsForDay(2026, 9, 3, PROF)[3];
  s.noteAuthorized({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotId: 'pin',
    slotOrdinal: slotA.ordinal,
    fullKeyFingerprint: FP,
    messageKey: 'PINA',
    fullKey: { keyCode: 'AAAA' },
  });
  assert(s.pinnedSlot().fullKey.keyCode === 'AAAA', 'pin snapshot stores full key');
  assert(s.pinnedSlot().slotOrdinal === slotA.ordinal, 'pin keeps 08–12 across 12:00');
  assert(s.shouldInvalidateForFingerprint('44'.repeat(32)), 'new message after EXPOSED/new key invalidates');
  s.invalidate();
  s.noteAuthorized({
    codebookFingerprint: BOOK,
    timeProfile: PROF,
    slotId: 'pin2',
    slotOrdinal: slotB.ordinal,
    fullKeyFingerprint: '44'.repeat(32),
    messageKey: 'PINB',
    fullKey: { keyCode: 'BBBB' },
  });
  assert(s.pinnedSlot().slotOrdinal === slotB.ordinal, 'new session takes 12–16');
  assert(s.pinnedSlot().fullKey.keyCode !== 'AAAA', 'pinned key replaced only on new session');
}

if (failed > 0) {
  console.error(`\n${failed} timebook-security test(s) failed`);
  process.exit(1);
}
console.log('\nAll timebook-security selftests passed.');
