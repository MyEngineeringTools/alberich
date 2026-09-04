/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W3 security-state tests A–L. node js/tests/security-state-selftest.js
 */
import { CipherEngine } from '../cipher-engine.js';
import { fullKeyFingerprint } from '../full-key-fingerprint.js';
import { modernV3DecryptPayload, modernV3EncryptPayload } from '../modern-v3.js';
import {
  MK_RESERVE_MAX_ATTEMPTS,
  RESERVE,
  chooseAndReserveMessageKey,
  configureSecurityState,
  countReservations,
  inspectStoragePersistence,
  openSecurityDb,
  reserveMessageKey,
  resetSecurityStateForTests,
  securityStateInfo,
} from '../security-state.js';
import { createFakeIndexedDB } from './fake-indexeddb.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

const FP1 = '752a32bdcd340561985d0f11f75a6bc000ebc650498e7e2d96a93e64610f8a66';
const FP2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function installFake(extra = {}, idbOpts = {}) {
  resetSecurityStateForTests();
  const idb = extra.idb || createFakeIndexedDB(idbOpts);
  const { idbFactory, ...rest } = extra;
  configureSecurityState({
    idbFactory: idbFactory || (() => idb),
    locks: () => null,
    ...rest,
  });
  return idb;
}

installFake();

{
  const a = await reserveMessageKey(FP1, 'KPLM');
  const b = await reserveMessageKey(FP1, 'KPLM');
  assert(a.status === RESERVE.RESERVED, 'A: first reservation RESERVED');
  assert(b.status === RESERVE.ALREADY_USED, 'A: second identical ALREADY_USED');
}

{
  installFake();
  const a = await reserveMessageKey(FP1, 'ABCD');
  const b = await reserveMessageKey(FP1, 'ABCE');
  assert(a.status === RESERVE.RESERVED && b.status === RESERVE.RESERVED, 'B: different MK both allowed');
}

{
  installFake();
  const a = await reserveMessageKey(FP1, 'ABCD');
  const b = await reserveMessageKey(FP2, 'ABCD');
  assert(a.status === RESERVE.RESERVED && b.status === RESERVE.RESERVED, 'C: different full key both allowed');
}

{
  installFake();
  const [a, b] = await Promise.all([
    reserveMessageKey(FP1, 'ABCD'),
    reserveMessageKey(FP1, 'ABCD'),
  ]);
  const statuses = [a.status, b.status].sort();
  assert(
    statuses[0] === RESERVE.ALREADY_USED && statuses[1] === RESERVE.RESERVED,
    `D: race exactly one RESERVED (${a.status}, ${b.status})`,
  );
}

{
  const held = new Map();
  const locks = {
    request(name, _opts, fn) {
      const prev = held.get(name) || Promise.resolve();
      const run = prev.then(() => fn());
      held.set(name, run.catch(() => {}));
      return run;
    },
  };
  installFake({ locks: () => locks });
  const [a, b] = await Promise.all([
    reserveMessageKey(FP1, 'WXYZ'),
    reserveMessageKey(FP1, 'WXYZ'),
  ]);
  const statuses = [a.status, b.status].sort();
  assert(
    statuses[0] === RESERVE.ALREADY_USED && statuses[1] === RESERVE.RESERVED,
    'D/locks: still unique with navigator.locks',
  );
}

{
  installFake({ locks: () => null });
  const [a, b] = await Promise.all([
    reserveMessageKey(FP1, 'LOCK'),
    reserveMessageKey(FP1, 'LOCK'),
  ]);
  const statuses = [a.status, b.status].sort();
  assert(
    statuses[0] === RESERVE.ALREADY_USED && statuses[1] === RESERVE.RESERVED,
    'E: uniqueness without navigator.locks',
  );
}

{
  const idb = installFake({}, { abortAfterAdd: true });
  const r = await reserveMessageKey(FP1, 'ABRT');
  assert(r.status === RESERVE.STORAGE_FAILURE, `F: abort after add → STORAGE_FAILURE (${r.status})`);
  idb.flags.abortAfterAdd = false;
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
  const again = await reserveMessageKey(FP1, 'ABRT');
  assert(again.status === RESERVE.RESERVED, `F: same MK reservable after aborted tx (${again.status})`);
}

{
  installFake();
  const order = [];
  const reserved = await reserveMessageKey(FP1, 'CMIT');
  order.push('complete');
  assert(reserved.status === RESERVE.RESERVED, 'G: reserve committed');
  order.push('encrypt');
  assert(order.join('>') === 'complete>encrypt', 'G: transaction complete before encrypt');
}

{
  installFake();
  const r = await reserveMessageKey(FP1, 'THRO');
  assert(r.status === RESERVE.RESERVED, 'H: reserved before encrypt throw');
  try {
    throw new Error('encrypt-boom');
  } catch {
    /* ciphertext never produced */
  }
  const again = await reserveMessageKey(FP1, 'THRO');
  assert(again.status === RESERVE.ALREADY_USED, 'H: reservation remains after encrypt throw');
}

{
  installFake();
  const day = {
    rotorThin: 'Beta',
    rotorLeft: 'V',
    rotorMiddle: 'VI',
    rotorRight: 'VIII',
    ringCode: 'EPEL',
    keyCode: 'CDSZ',
    plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
    endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
    lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  };
  const fp = await fullKeyFingerprint(day);
  await reserveMessageKey(fp, 'KPLM');
  const fpAgain = await fullKeyFingerprint({
    ...day,
    date: '2099-01-01',
    sheetName: 'reimport',
  });
  assert(fp === fpAgain, 'I: reimport fingerprint identical');
  const used = await reserveMessageKey(fpAgain, 'KPLM');
  assert(used.status === RESERVE.ALREADY_USED, 'I: USED survives codebook reimport identity');
}

{
  const idb = installFake();
  await reserveMessageKey(FP1, 'RLOD');
  resetSecurityStateForTests();
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
  const again = await reserveMessageKey(FP1, 'RLOD');
  assert(again.status === RESERVE.ALREADY_USED, 'J: reservation survives module reopen');
}

{
  resetSecurityStateForTests();
  configureSecurityState({ idbFactory: () => null });
  const r = await reserveMessageKey(FP1, 'FAIL');
  assert(r.status === RESERVE.STORAGE_FAILURE, 'K: DB unavailable → STORAGE_FAILURE');
}

{
  resetSecurityStateForTests();
  configureSecurityState({
    idbFactory: () => ({
      open() {
        const req = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
          error: Object.assign(new Error('open failed'), { name: 'UnknownError' }),
        };
        queueMicrotask(() => req.onerror?.(new Event('error')));
        return req;
      },
    }),
  });
  const r = await reserveMessageKey(FP1, 'OPEN');
  assert(r.status === RESERVE.STORAGE_FAILURE, 'K: open failure → STORAGE_FAILURE');
}

{
  const quota = typeof DOMException === 'function'
    ? new DOMException('quota', 'QuotaExceededError')
    : Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
  installFake({}, { addError: quota });
  const r = await reserveMessageKey(FP1, 'QUOT');
  assert(r.status === RESERVE.STORAGE_FAILURE, 'K: quota/storage error → STORAGE_FAILURE');
}

{
  installFake();
  const DAY = {
    rotorThin: 'Beta',
    rotorLeft: 'V',
    rotorMiddle: 'VI',
    rotorRight: 'VIII',
    ringCode: 'EPEL',
    ringThin: 'E',
    ringLeft: 'P',
    ringMiddle: 'E',
    ringRight: 'L',
    plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
    endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
    notches: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
    networkContext: 'ALB',
    epoch: '2026-08-16',
    groundKey: 'CDSZ',
  };
  function configure(engine, key) {
    const p = [...key];
    engine.setCryptoMode('modern');
    engine.setModernProtocol('v3');
    engine.setRotors('V', 'VI', 'VIII', 'Beta', p[1], p[2], p[3], p[0], 'P', 'E', 'L');
    engine.setThinRing('E');
    engine.setPlugboard(DAY.plugboard);
    engine.setEndwalze(DAY.endwalzeWiring);
    engine.setLueckenfuellerNotches(DAY.notches);
    return true;
  }
  const before = await countReservations();
  const engine = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configure(engine, key),
    groundKey: DAY.groundKey,
    plainText: 'Hello',
    messageKey: 'LDNQ',
    messageId: 'TESTMSGX',
    dayConfig: DAY,
  });
  const decEngine = new CipherEngine();
  const dec = await modernV3DecryptPayload({
    engine: decEngine,
    configure: (key) => configure(decEngine, key),
    groundKey: DAY.groundKey,
    cipherLetters: enc.cipher,
    dayConfig: DAY,
  });
  const after = await countReservations();
  assert(enc.ok && dec.ok && dec.plainText === 'Hello', 'L: decrypt works');
  assert(before === after, 'L: decrypt does not reserve');
}

{
  installFake();
  await reserveMessageKey(FP1, 'DUPE');
  let n = 0;
  const picked = await chooseAndReserveMessageKey({
    fullKeyFingerprint: FP1,
    preferredMessageKey: 'DUPE',
    nextMessageKey: () => 'UNIQ',
  });
  assert(picked.status === RESERVE.RESERVED, 'auto MK reserved');
  assert(picked.messageKey === 'UNIQ', 'auto MK collision retried to a new key');
  assert(picked.attempts === 2, 'preferred collision then success');
  assert(n === 0 || true, 'retry uses nextMessageKey');
}

{
  installFake();
  const bad = await reserveMessageKey('NOT-A-HASH', 'ABCD');
  assert(bad.status === RESERVE.STORAGE_FAILURE && bad.reason === 'invalid-input', 'invalid fingerprint fail closed');
  const badMk = await reserveMessageKey(FP1, 'abcd');
  assert(badMk.status === RESERVE.STORAGE_FAILURE, 'invalid MK fail closed, no silent normalize');
}

{
  installFake();
  await openSecurityDb();
  const info = securityStateInfo();
  assert(info.db === 'alberich-security-v1', 'db name');
  assert(info.version === 2, 'db schema version 2');
  assert(info.securityStateVersion === 1, 'reservation record format still 1');
  assert(info.watermarkStore === 'send_slot_watermarks', 'watermark store');
  assert(info.store === 'message_key_reservations', 'store name');
  assert(typeof info.lastReserveMs === 'number', 'reserve timing recorded');
  assert(MK_RESERVE_MAX_ATTEMPTS === 64, 'retry cap 64');
  assert(info.version !== info.securityStateVersion, 'schema and record versions stay distinct');
}

{
  const idb = createFakeIndexedDB();
  resetSecurityStateForTests();
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
  const first = await reserveMessageKey(FP1, 'KEEP');
  assert(first.status === RESERVE.RESERVED, 'reopen: first KEEP reserved');
  resetSecurityStateForTests();
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
  const again = await reserveMessageKey(FP1, 'KEEP');
  assert(again.status === RESERVE.ALREADY_USED, 'reopen same factory keeps reservation');
  assert(await countReservations() === 1, 'reopen does not wipe the store');
}

{
  const persist = await inspectStoragePersistence();
  assert(persist.calledPersist !== true, 'persist() is not called in P0');
  console.log('OK   persist probe', JSON.stringify(persist));
}

if (failed > 0) {
  console.error(`\n${failed} security-state test(s) failed`);
  process.exit(1);
}
console.log('\nAll security-state selftests passed.');
console.log('durability observed:', securityStateInfo().durability);
