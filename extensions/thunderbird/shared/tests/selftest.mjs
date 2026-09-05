/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Node-Selftest für shared Modern-Crypto + Key-Manager.
 * Ausführen: node shared/tests/selftest.mjs
 */

import { createKeyManager, createMemoryStorage } from '../key-manager.js';
import { decryptModern, encryptModern } from '../modern-ops.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  } else {
    console.log('OK  ', msg);
  }
}

const sampleSheet = {
  format: 'alberich-codebook',
  formatVersion: 1,
  year: 2026,
  month: 7,
  monthLabel: 'Juli 2026',
  generatedAt: new Date().toISOString(),
  days: [
    {
      day: 12,
      date: '2026-07-12',
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'V',
      rotorMiddle: 'VI',
      rotorRight: 'VIII',
      ringCode: 'EPEL',
      keyCode: 'CDSZ',
      plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
    },
    {
      day: 13,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'AAAA',
      plugboard: 'AB CD', // only 2 pairs → needMinPlugs
    },
  ],
};

const storage = createMemoryStorage();
const keys = createKeyManager(storage);

const imp = await keys.importSheet(sampleSheet);
assert(imp.ok, 'import sheet');
assert(keys.getStatusSummary().loaded, 'status loaded');

// Prefer day 12 if default picks something else
await keys.setDay(12);
const config = keys.getDayConfig();
assert(config && config.keyCode === 'CDSZ', 'day config CDSZ');

const v3cfgEarly = {
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'EPEL',
  ringThin: 'E',
  ringLeft: 'P',
  ringMiddle: 'E',
  ringRight: 'L',
  keyCode: 'CDSZ',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  notches: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  networkContext: 'ALB',
  epoch: '2026-08-16',
};

const plain = 'Hallo Companion! Äpfel 42 🔐';
const enc = await encryptModern(v3cfgEarly, plain, 'LDNQ');
assert(enc.ok, 'encrypt ok');
assert(enc.cipher.startsWith('ALBV'), 'cipher starts ALBV');
assert(enc.header.length === 4, 'header 4');

const dec = await decryptModern(v3cfgEarly, enc.cipherGrouped);
assert(dec.ok, 'decrypt ok');
assert(dec.plainText === plain, 'round-trip UTF-8');

const decRaw = await decryptModern(v3cfgEarly, enc.cipher);
assert(decRaw.ok && decRaw.plainText === plain, 'round-trip ungrouped');

const bad = await decryptModern(v3cfgEarly, 'XXXXYYYYZZZZWWWWAAAAAAAA');
assert(!bad.ok, 'garbage cipher rejected');

const legacyEnc = await encryptModern(config, 'Hi');
assert(!legacyEnc.ok && legacyEnc.error === 'modern.needPermutation', 'legacy sheet rejected for encrypt');

const noKey = await encryptModern(null, 'x');
assert(!noKey.ok, 'no config rejected');

const v3cfg = {
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'EPEL',
  ringThin: 'E',
  ringLeft: 'P',
  ringMiddle: 'E',
  ringRight: 'L',
  keyCode: 'CDSZ',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  notches: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  networkContext: 'ALB',
  epoch: '2026-08-16',
};
const { modernV3EncryptPayload } = await import('../crypto/modern-v3.js');
const { CipherEngine } = await import('../crypto/cipher-engine.js');
const { configureModernEngine } = await import('../modern-ops.js');
const eng = new CipherEngine();
const golden = await modernV3EncryptPayload({
  engine: eng,
  configure: (code) => configureModernEngine(eng, v3cfg, code).ok,
  groundKey: 'CDSZ',
  plainText: 'Hello',
  messageKey: 'LDNQ',
  messageId: 'TESTMSGX',
  dayConfig: v3cfg,
});
assert(golden.ok && golden.cipher === 'ALBVKCBDTESTMSGXXWSWIYDBUEFRKEQMITQRCOGPDSZAL', `V3 golden Hello (got ${golden.cipher})`);
const v3dec = await decryptModern(v3cfg, golden.cipher);
assert(v3dec.ok && v3dec.plainText === 'Hello', 'V3 decrypt Hello');

if (process.exitCode) {
  console.error('\nSelftest FAILED');
  process.exit(1);
}
console.log('\nAll companion selftests passed.');
