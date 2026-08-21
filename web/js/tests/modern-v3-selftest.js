/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Modern V3 + Traditional-Regression.
 * Ausführen: node js/tests/modern-v3-selftest.js
 */
import { CipherEngine } from '../cipher-engine.js';
import {
  ENDWALZE_BRUNO,
  deriveLueckenfuellerNotches,
  isInvolutoryWiring,
  isPermutationWiring,
  modernDecryptPayload,
  modernEncryptPayload,
  resolveEndwalzeWiring,
} from '../modern-crypto.js';
import {
  MODERN_V3_STAMP,
  ReplayCache,
  base26v2ToUtf8,
  byteLenFromDigits,
  canonicalDayKey,
  deriveAuthKey,
  detectModernProtocol,
  ENDWALZE_GENERATE_FAILED,
  ENDWALZE_GENERATION_MAX_ATTEMPTS,
  generateEndwalzeWiring,
  generateLueckenfueller,
  isV3Telegram,
  minDigitsForByteLen,
  maxByteLenForDigits,
  modernV3DecryptPayload,
  modernV3EncryptPayload,
  nextV3Positions,
  parseV3Telegram,
  timingSafeEqualLetters,
  utf8ToBase26v2,
  validateEndwalzeWiring,
  validateLueckenfueller,
  validateNotchSet,
} from '../modern-v3.js';
import { parseCodebookJson } from '../codebook.js';
import { generateMonthSheet } from '../codebook-generate.js';
import { tafelwort } from '../codebook-tafelwort.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

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
};

function configureV3(engine, keyCode4) {
  const positions = [...keyCode4];
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setRotors(
    DAY.rotorLeft,
    DAY.rotorMiddle,
    DAY.rotorRight,
    DAY.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    DAY.ringLeft,
    DAY.ringMiddle,
    DAY.ringRight,
  );
  engine.setThinRing(DAY.ringThin);
  engine.setPlugboard(DAY.plugboard);
  engine.setEndwalze(DAY.endwalzeWiring);
  engine.setLueckenfuellerNotches(DAY.notches);
  return true;
}

function configureTraditional(engine, ringThin = DAY.ringThin) {
  engine.setCryptoMode('traditional');
  engine.setModernProtocol('v2');
  engine.setReflector('C');
  engine.setRotors('V', 'VI', 'VIII', 'Beta', 'D', 'S', 'Z', 'C', 'P', 'E', 'L', ringThin);
  engine.setThinRing(ringThin);
  engine.setPlugboard(DAY.plugboard);
}

// --- Traditional regression ---
{
  const engine = new CipherEngine();
  configureTraditional(engine);
  assert(engine.rotors.thin.ring === 4, 'traditional thin ring E applied');
  const startThinPos = engine.rotors.thin.pos;
  const plain = 'HELLOALBERICHTESTMESSAGE';
  const cipher = engine.encryptMessage(plain);
  assert(engine.rotors.thin.pos === startThinPos, 'traditional thin does not step');
  configureTraditional(engine);
  assert(engine.encryptMessage(cipher) === plain, 'traditional still involutory');

  const engineA = new CipherEngine();
  configureTraditional(engineA, 'A');
  const cipherA = engineA.encryptMessage(plain);
  const engineE = new CipherEngine();
  configureTraditional(engineE, 'E');
  const cipherE = engineE.encryptMessage(plain);
  assert(cipherA !== cipherE, 'traditional thin ring changes ciphertext');
}

// --- V2 still works ---
{
  const engine = new CipherEngine();
  const plug = DAY.plugboard;
  const configure = (key) => {
    const positions = [...key];
    engine.setCryptoMode('modern');
    engine.setModernProtocol('v2');
    engine.setRotors('V', 'VI', 'VIII', 'Beta', positions[1], positions[2], positions[3], positions[0], 'P', 'E', 'L');
    engine.setPlugboard(plug);
    const n = deriveLueckenfuellerNotches('P', 'E', 'L', plug);
    if (!n.ok) return false;
    engine.setEndwalze(resolveEndwalzeWiring('C'));
    engine.setLueckenfuellerNotches(n.notches);
    return true;
  };
  const enc = modernEncryptPayload({
    engine, configure, groundKey: 'CDSZ', plainText: 'V2 bleibt', messageKey: 'LDNQ',
  });
  const dec = modernDecryptPayload({
    engine, configure, groundKey: 'CDSZ', cipherLetters: enc.cipher,
  });
  assert(enc.ok && dec.ok && dec.plainText === 'V2 bleibt', 'legacy V2 encrypt/decrypt');
  assert(!isV3Telegram(enc.cipher), 'V2 telegram has no ALB3 stamp');
}

// --- notches validation ---
assert(validateNotchSet('AFLRX').ok, 'sorted 5 ok');
assert(!validateNotchSet('XRFAL').ok, 'unsorted rejected');
assert(!validateNotchSet('AFLRA').ok, 'duplicate rejected');
assert(!validateNotchSet('ABCD').ok, 'count 4 rejected');
assert(validateLueckenfueller(DAY.notches).ok, 'triple ok');

// --- endwalze ---
assert(validateEndwalzeWiring(DAY.endwalzeWiring).ok, 'default perm ok');
assert(!isInvolutoryWiring(DAY.endwalzeWiring), 'default not involutory');
{
  assert(!validateEndwalzeWiring('ABCDEFGHIJKLMNOPQRSTUVWXYZ').ok, 'identity involution rejected');
  const w = generateEndwalzeWiring(() => 0);
  assert(isPermutationWiring(w) && !isInvolutoryWiring(w), 'generated perm not involutory');

  // always j = i → identity (involution) → retry then fail closed
  let involCalls = 0;
  try {
    generateEndwalzeWiring((max) => {
      involCalls += 1;
      return max - 1;
    });
    assert(false, 'all-involution RNG must throw');
  } catch (err) {
    assert(err instanceof Error, 'fail-closed throws Error');
    assert(err.message === ENDWALZE_GENERATE_FAILED, 'fail-closed message');
  }
  assert(involCalls === ENDWALZE_GENERATION_MAX_ATTEMPTS * 25, 'Fisher–Yates consumed max attempts');

  let attempts = 0;
  const afterRetry = generateEndwalzeWiring((max) => {
    attempts += 1;
    if (attempts <= 25 * 3) return max - 1;
    return 0;
  });
  assert(isPermutationWiring(afterRetry) && !isInvolutoryWiring(afterRetry), 'involutions are retried');
  assert(afterRetry !== 'BCADEFGHIJKLMNOPQRSTUVWXYZ', 'no deterministic fallback wiring');
}

{
  const de = await import('../i18n/de.js');
  const en = await import('../i18n/en.js');
  assert(typeof de.default['modern.endwalzeGenerateFailed'] === 'string', 'DE UI error string');
  assert(typeof en.default['modern.endwalzeGenerateFailed'] === 'string', 'EN UI error string');
  assert(/schlüsselmaterial/i.test(de.default['modern.endwalzeGenerateFailed']), 'DE fail-closed UI');
  assert(en.default['modern.endwalzeGenerateFailed'].includes('No key material'), 'EN fail-closed UI');
}

// --- Base-26 V2 ---
assert(utf8ToBase26v2('') === '', 'v2 empty');
assert(base26v2ToUtf8('').ok && base26v2ToUtf8('').text === '', 'v2 empty decode');
assert(base26v2ToUtf8(utf8ToBase26v2('Hello')).text === 'Hello', 'v2 Hello');
assert(base26v2ToUtf8(utf8ToBase26v2('Äpfel 🔐')).text === 'Äpfel 🔐', 'v2 utf8');
{
  const letters = utf8ToBase26v2('A');
  const even = [...letters].filter((_, i) => i % 2 === 0);
  const onlyAJ = even.every((ch) => ch <= 'J');
  assert(letters.length === minDigitsForByteLen(1), 'v2 1-byte digit count');
  assert(byteLenFromDigits(letters.length) === 1, 'v2 invert digit count');
  {
    const cap = 2_000;
    const maxBytes = maxByteLenForDigits(cap);
    assert(maxBytes > 0, 'base26 cap maps to positive UTF-8 bytes');
    assert(minDigitsForByteLen(maxBytes) <= cap, 'max bytes fit the digit cap');
    assert(minDigitsForByteLen(maxBytes + 1) > cap, 'one more byte exceeds the digit cap');
  }
  // single byte still small; multi-byte must escape the every-other A–J crib
  const long = utf8ToBase26v2('The quick brown fox jumps over the lazy dog 0123456789');
  const evenLong = [...long].filter((_, i) => i % 2 === 0);
  const used = new Set(evenLong);
  assert(used.size > 10, 'v2 even positions use more than A–J on long text');
  assert(!onlyAJ || letters.length <= 2, 'v2 short single-byte may still be compact');
}
assert(base26v2ToUtf8('ABC').ok === false, 'v2 invalid length rejected');

// --- stepping state machine ---
{
  const pos = { thin: 0, left: 0, middle: 0, right: 0 };
  const n0 = nextV3Positions(pos, { left: false, middle: false, right: false });
  assert(n0.right === 1 && n0.thin === 0 && n0.left === 0 && n0.middle === 0, 'only right steps');
  const nR = nextV3Positions(pos, { left: false, middle: false, right: true });
  assert(nR.middle === 1 && nR.right === 1 && nR.left === 0, 'right notch drives middle');
  const nM = nextV3Positions(pos, { left: false, middle: true, right: false });
  assert(nM.left === 1 && nM.middle === 1, 'middle notch double-steps middle and drives left');
  const nL = nextV3Positions(pos, { left: true, middle: false, right: false });
  assert(nL.thin === 1 && nL.left === 1, 'left notch drives thin and double-steps left');
}

{
  const engine = new CipherEngine();
  configureV3(engine, 'AAAA');
  const startThin = engine.rotors.thin.pos;
  let moved = false;
  for (let i = 0; i < 26 * 26 * 26 + 5; i++) {
    engine.step();
    if (engine.rotors.thin.pos !== startThin) {
      moved = true;
      break;
    }
  }
  assert(moved, 'V3 thin actually moves');
}

{
  const engine = new CipherEngine();
  configureV3(engine, 'CDSZ');
  const before = engine.rotors.thin.ring;
  assert(before === 'E'.charCodeAt(0) - 65, 'V3 thin ring applied');
}

// --- left notch now matters ---
{
  const engineA = new CipherEngine();
  configureV3(engineA, 'AAAA');
  const sa = engineA.encryptMessage('AAAAAAAAAAAAAAAAAAAAAAAA');
  const engineB = new CipherEngine();
  configureV3(engineB, 'AAAA');
  engineB.setLueckenfuellerNotches({ ...DAY.notches, left: 'BHMSY' });
  const sb = engineB.encryptMessage('AAAAAAAAAAAAAAAAAAAAAAAA');
  assert(sa !== sb, 'V3 left notches change ciphertext');
}

// --- full package ---
{
  const engine = new CipherEngine();
  const original = 'Guten Tag! Äpfel, 42 € und 🔐 — V3.';
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    plainText: original,
    messageKey: 'LDNQ',
    messageId: 'TESTMSGX',
    dayConfig: DAY,
  });
  assert(enc.ok, 'V3 encrypt ok');
  assert(enc.cipher.startsWith(MODERN_V3_STAMP), 'ALBV stamp');
  assert(enc.cipher.endsWith(enc.pruefgruppe), 'prüfgruppe at end');
  assert(enc.pruefgruppe.length === 20, '20-letter prüfgruppe');
  assert(enc.messageId === 'TESTMSGX', 'message id kept');

  const dec = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: enc.cipher,
    dayConfig: DAY,
  });
  assert(dec.ok && dec.plainText === original, 'V3 round-trip UTF-8');
  assert(dec.messageKey === 'LDNQ', 'V3 recovered SK');

  const parsed = parseV3Telegram(enc.cipher);
  const flipped = parsed.letters.slice(0, -1) + (parsed.letters.slice(-1) === 'A' ? 'B' : 'A');
  const badMac = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: flipped,
    dayConfig: DAY,
  });
  assert(!badMac.ok && badMac.error === 'modern.macFailed', 'MAC failure before plaintext');

  const v2OnV3 = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: 'NOTA' + 'X'.repeat(40),
    dayConfig: DAY,
  });
  assert(!v2OnV3.ok, 'non-ALB3 rejected on V3 decrypt');
}

// --- replay ---
{
  const engine = new CipherEngine();
  const cache = new ReplayCache(8);
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    plainText: 'once',
    messageKey: 'AAAA',
    messageId: 'REPLAY01',
    dayConfig: DAY,
  });
  const first = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: enc.cipher,
    dayConfig: DAY,
    replayCache: cache,
  });
  const second = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: enc.cipher,
    dayConfig: DAY,
    replayCache: cache,
  });
  assert(first.ok && !second.ok && second.error === 'modern.replay', 'replay cache rejects second delivery');
}

{
  const albv = `${MODERN_V3_STAMP}${'A'.repeat(40)}`;
  assert(detectModernProtocol(albv, 2) === 'v3', 'ALBV wins over leftover v2 sheet');
  assert(detectModernProtocol(albv, 0) === 'v3', 'ALBV without sheet is v3');
  assert(detectModernProtocol(`XXXX${'A'.repeat(40)}`, 2) === 'v2', 'unstamped + v2 sheet is v2');
  assert(detectModernProtocol(`XXXX${'A'.repeat(40)}`, 3) === 'v3', 'unstamped + v3 sheet hint is v3');
}

assert(timingSafeEqualLetters('ABCD', 'ABCD'), 'ct eq');
assert(!timingSafeEqualLetters('ABCD', 'ABCE'), 'ct neq');
{
  const keyA = canonicalDayKey({ ...DAY, groundKey: 'CDSZ' });
  const keyB = canonicalDayKey({ ...DAY, groundKey: 'ADSZ' });
  assert(keyA.startsWith('ALB3-KEY\n'), 'canonical key header');
  assert(keyA.includes('\nground:CDSZ\n'), 'canonical ground CDSZ');
  assert(keyB.includes('\nground:ADSZ\n'), 'canonical ground ADSZ');
  assert(keyA !== keyB, 'different ground → different canonical key');
  const authA = await deriveAuthKey(keyA);
  const authB = await deriveAuthKey(keyB);
  assert(authA.some((b, i) => b !== authB[i]), 'different ground → different auth key');

  const engine = new CipherEngine();
  const encA = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    plainText: 'Hello',
    messageKey: 'LDNQ',
    messageId: 'TESTMSGX',
    dayConfig: DAY,
  });
  const encB = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'ADSZ',
    plainText: 'Hello',
    messageKey: 'LDNQ',
    messageId: 'TESTMSGX',
    dayConfig: DAY,
  });
  assert(encA.ok && encB.ok, 'ground variants encrypt');
  assert(encA.pruefgruppe !== encB.pruefgruppe, 'different ground → different prüfgruppe');

  const wrongGround = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'ADSZ',
    cipherLetters: encA.cipher,
    dayConfig: DAY,
  });
  assert(
    !wrongGround.ok && wrongGround.error === 'modern.macFailed' && !wrongGround.plainText,
    'wrong ground fails MAC before plaintext',
  );

  const dated = { ...DAY, epoch: '2026-08-16' };
  const encDated = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    plainText: 'Hello',
    messageKey: 'LDNQ',
    messageId: 'TESTMSGX',
    dayConfig: dated,
  });
  const wrongEpoch = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key),
    groundKey: 'CDSZ',
    cipherLetters: encDated.cipher,
    dayConfig: { ...DAY, epoch: 'MANUAL' },
  });
  assert(
    !wrongEpoch.ok && wrongEpoch.error === 'modern.macFailed',
    'sheet epoch vs MANUAL fails MAC (companion bug)',
  );
}

// --- codebook v3 ---
{
  const sheet = generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation' });
  assert(sheet.formatVersion === 3, 'generated V3 version');
  assert(sheet.days.every((d) => d.endwalzeWiring && d.lueckenfueller), 'V3 days have wiring+notches');
  const parsed = parseCodebookJson(sheet);
  assert(parsed.ok, 'V3 sheet parses');
  const word = tafelwort(sheet);
  assert(/^[A-Z]{4} [A-Z]{3}$/.test(word), 'V3 tafelwort shape');

  const v2as3 = parseCodebookJson({
    format: 'alberich-codebook',
    formatVersion: 3,
    year: 2026,
    month: 9,
    days: [{
      day: 1,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'WXYZ',
      plugboard: 'AB CD EF',
    }],
  });
  assert(!v2as3.ok, 'V2 day silently as V3 rejected');

  const legacy = {
    format: 'alberich-codebook',
    formatVersion: 1,
    year: 2026,
    month: 7,
    days: [{
      day: 1,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'WXYZ',
      plugboard: 'AB CD EF',
    }],
  };
  const p1 = parseCodebookJson(legacy);
  assert(p1.ok && tafelwort(p1.sheet), 'V1 still parses');
}

// --- V2 golden tafelwort untouched ---
{
  const raw = {
    format: 'alberich-codebook',
    formatVersion: 1,
    year: 2026,
    month: 7,
    days: [
      {
        day: 1, reflectorId: 'C', rotorThin: 'Beta',
        rotorLeft: 'I', rotorMiddle: 'II', rotorRight: 'III',
        ringCode: 'AAAA', keyCode: 'WXYZ', plugboard: 'AB CD EF',
      },
      {
        day: 18, reflectorId: 'C', rotorThin: 'Beta',
        rotorLeft: 'I', rotorMiddle: 'II', rotorRight: 'III',
        ringCode: 'BBBB', keyCode: 'ABCD', plugboard: 'AB CD EF',
      },
    ],
  };
  const parsed = parseCodebookJson(raw);
  assert(parsed.ok && tafelwort(parsed.sheet) === 'CXRI YQP', 'July 2026 Tafelwort unchanged');
}

if (failed > 0) {
  console.error(`\n${failed} V3 test(s) failed`);
  process.exit(1);
}
console.log('\nAll modern-v3 selftests passed.');
