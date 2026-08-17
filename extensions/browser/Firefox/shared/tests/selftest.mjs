/**
 * Node-Selftest für shared Modern-Crypto + Key-Manager.
 * Ausführen: node shared/tests/selftest.mjs
 */

import { createKeyManager, createMemoryStorage } from '../key-manager.js';
import { decryptModern, encryptModern } from '../modern-ops.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCodebookJson } from '../codebook/codebook.js';
import { tafelwort } from '../codebook/codebook-tafelwort.js';
import { isFreeDoraPairs } from '../crypto/cipher-data.js';

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

const twRaw = {
  format: 'alberich-codebook',
  formatVersion: 1,
  year: 2026,
  month: 7,
  monthLabel: 'Juli 2026',
  days: [
    {
      day: 1,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'WXYZ',
      plugboard: 'AB CD EF',
    },
    {
      day: 18,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'BBBB',
      keyCode: 'ABCD',
      plugboard: 'AB CD EF',
    },
  ],
};
const twParsed = parseCodebookJson(twRaw);
assert(twParsed.ok, 'tafelwort sample parses');
assert(tafelwort(twParsed.ok ? twParsed.sheet : null) === 'CXRI YQP', 'tafelwort matches web/Android');

const doraV2 = {
  format: 'alberich-codebook',
  formatVersion: 2,
  endwalzePolicy: 'dora',
  year: 2026,
  month: 4,
  days: [
    {
      day: 1,
      reflectorId: 'D',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'WXYZ',
      plugboard: 'AB CD EF GH IJ KL MN OP QR ST',
      reflectorD: 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ',
    },
  ],
};
const doraParsed = parseCodebookJson(doraV2);
assert(doraParsed.ok && doraParsed.sheet.endwalzePolicy === 'dora', 'format 2 dora sheet parses');
assert(isFreeDoraPairs(doraParsed.sheet.days[0].reflectorD), 'format 2 free Dora 13 pairs');
const rejected = parseCodebookJson({ ...doraV2, formatVersion: 3 });
assert(!rejected.ok, 'formatVersion 3 without V3 day fields rejected');

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
const v3enc = await encryptModern(v3cfg, 'Hello', 'LDNQ');
assert(v3enc.ok, 'V3 encrypt ok');
assert(v3enc.cipher === 'ALBVKCBDTESTMSGXXWSWIYDBUEFRKEQMITQRCOGPDSZAL' || v3enc.cipher.startsWith('ALBV'), 'V3 stamp ALBV');
// Fixed messageId for golden match
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

const demoV3Path = join(dirname(fileURLToPath(import.meta.url)), '../samples/demo-codebook-v3.json');
const demoV3 = parseCodebookJson(readFileSync(demoV3Path, 'utf8'));
assert(demoV3.ok && demoV3.sheet.formatVersion === 3, 'bundled V3 demo parses');
assert(tafelwort(demoV3.sheet) === 'CPTZ YYH', `V3 demo tafelwort (got ${demoV3.ok ? tafelwort(demoV3.sheet) : '?'})`);
assert(demoV3.ok && demoV3.sheet.days.some((d) => d.day === 16 && d.keyCode === 'CDSZ'), 'V3 demo has golden day 16');

if (process.exitCode) {
  console.error('\nSelftest FAILED');
  process.exit(1);
}
console.log('\nAll companion selftests passed.');
