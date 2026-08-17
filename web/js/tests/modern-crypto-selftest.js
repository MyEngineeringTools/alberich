/**
 * Selbsttest: Modern-Kern komplett (Endwalze, Lückenfüller, Base-26, Auto-SK)
 * + Traditionell-Regression.
 * Ausführen: node js/tests/modern-crypto-selftest.js
 */
import { CipherEngine } from '../cipher-engine.js';
import {
  ENDWALZE_BRUNO,
  ENDWALZE_CAESAR,
  MIN_STECKER_PAIRS,
  LUECKENFUELLER_NOTCH_COUNTS,
  base26ToUtf8,
  baseNotchPattern,
  composeWiring,
  deriveLueckenfuellerNotches,
  deriveLueckenfuellerParams,
  deriveNotchShiftsWegB,
  inverseWiring,
  isInvolutoryWiring,
  isPermutationWiring,
  modernDecryptPayload,
  modernEncryptPayload,
  normalizePlugPairsCanonical,
  randomMessageKey4,
  resolveEndwalzeWiring,
  rotateNotchPattern,
  utf8ToBase26,
} from '../modern-crypto.js';
import { REFLECTOR_BRUNO, DEFAULT_REFLECTOR_D_PAIRS } from '../cipher-data.js';
import { getModeCapabilities } from '../operation-mode.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

/**
 * @param {CipherEngine} engine
 * @param {string} keyCode4
 * @param {string} plug
 */
function configureModernEngine(engine, keyCode4, plug = 'AE BF CM DQ HU JN LX PR SZ VW') {
  const positions = [...keyCode4];
  engine.setCryptoMode('modern');
  engine.setReflector('C');
  engine.setRotors(
    'V', 'VI', 'VIII', 'Beta',
    positions[1], positions[2], positions[3], positions[0],
    'P', 'E', 'L',
  );
  engine.setPlugboard(plug);
  const notches = deriveLueckenfuellerNotches('P', 'E', 'L', plug);
  if (!notches.ok) return false;
  engine.setEndwalze(resolveEndwalzeWiring('C'));
  engine.setLueckenfuellerNotches(notches.notches);
  return true;
}

function configureTraditional(engine) {
  engine.setCryptoMode('traditional');
  engine.setReflector('C');
  engine.setRotors('V', 'VI', 'VIII', 'Beta', 'D', 'S', 'Z', 'C', 'P', 'E', 'L');
  engine.setPlugboard('AE BF CM DQ HU JN LX PR SZ VW');
}

// --- pure modern-crypto ---
assert(isPermutationWiring(ENDWALZE_BRUNO), 'ENDWALZE_BRUNO permutation');
assert(!isInvolutoryWiring(ENDWALZE_BRUNO), 'ENDWALZE_BRUNO not involutory');
assert(isInvolutoryWiring(REFLECTOR_BRUNO), 'classic UKW Bruno is involutory');

const inv = inverseWiring(ENDWALZE_BRUNO);
for (let i = 0; i < 26; i++) {
  const img = ENDWALZE_BRUNO.charCodeAt(i) - 65;
  assert(inv.charCodeAt(img) - 65 === i, `inverse maps ${i}`);
}

assert(rotateNotchPattern('ABC', 1) === 'BCD', 'rotate pattern +1 sorted');
assert(
  LUECKENFUELLER_NOTCH_COUNTS.length === 3
    && LUECKENFUELLER_NOTCH_COUNTS[0] === 5
    && LUECKENFUELLER_NOTCH_COUNTS[1] === 7
    && LUECKENFUELLER_NOTCH_COUNTS[2] === 9,
  'allowed notch counts are {5,7,9}',
);
assert(
  LUECKENFUELLER_NOTCH_COUNTS.every((c) => {
    let a = c;
    let b = 26;
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a === 1;
  }),
  'all allowed counts coprime to 26',
);

// base patterns: exact length, unique letters, subset of A–Z
for (const c of LUECKENFUELLER_NOTCH_COUNTS) {
  const pat = baseNotchPattern(c);
  assert(pat.length === c, `baseNotchPattern(${c}) length`);
  assert(new Set(pat).size === c, `baseNotchPattern(${c}) unique`);
  assert(/^[A-Z]+$/.test(pat), `baseNotchPattern(${c}) letters`);
}

const few = deriveLueckenfuellerParams('A', 'B', 'C', 'AE BF');
assert(!few.ok && few.error === 'modern.needMinPlugs', 'params reject <3 pairs');

const enough = deriveLueckenfuellerParams('P', 'E', 'L', 'AE BF CM DQ');
const again = deriveLueckenfuellerParams('P', 'E', 'L', 'DQ CM BF AE');
assert(
  enough.ok
    && again.ok
    && enough.shifts[0] === again.shifts[0]
    && enough.shifts[1] === again.shifts[1]
    && enough.shifts[2] === again.shifts[2]
    && enough.counts[0] === again.counts[0]
    && enough.counts[1] === again.counts[1]
    && enough.counts[2] === again.counts[2],
  'params deterministic under pair reorder',
);
assert(
  enough.counts.every((c) => LUECKENFUELLER_NOTCH_COUNTS.includes(c)),
  'counts are allowed values {5,7,9}',
);

const n1 = deriveLueckenfuellerNotches('P', 'E', 'L', 'AE BF CM');
assert(n1.ok && n1.counts && n1.notches, 'derive notches ok');
assert(
  n1.notches.left.length === n1.counts[0]
    && n1.notches.middle.length === n1.counts[1]
    && n1.notches.right.length === n1.counts[2],
  'notch string lengths match derived counts',
);

// same key → same notches
const n2 = deriveLueckenfuellerNotches('P', 'E', 'L', 'AE BF CM');
assert(
  n1.notches.left === n2.notches.left
    && n1.notches.middle === n2.notches.middle
    && n1.notches.right === n2.notches.right,
  'same daily key → same notches',
);

// different rings → often different counts or shifts
const n3 = deriveLueckenfuellerNotches('A', 'A', 'A', 'AE BF CM');
assert(
  n3.ok
    && (
      n3.notches.left !== n1.notches.left
      || n3.notches.middle !== n1.notches.middle
      || n3.notches.right !== n1.notches.right
    ),
  'different rings change notches',
);

// alias still works
const alias = deriveNotchShiftsWegB('P', 'E', 'L', 'AE BF CM DQ');
assert(alias.ok && alias.shifts[0] === enough.shifts[0], 'Weg B alias shifts');

// --- Base-26 ---
assert(utf8ToBase26('') === '', 'base26 empty');
assert(utf8ToBase26('A').length === 2, 'ASCII one byte → 2 letters');
assert(base26ToUtf8(utf8ToBase26('Hello')) === 'Hello', 'base26 ASCII round-trip');
assert(base26ToUtf8(utf8ToBase26('Äpfel 123!')) === 'Äpfel 123!', 'base26 UTF-8 umlauts');
assert(base26ToUtf8(utf8ToBase26('🔐 test')) === '🔐 test', 'base26 emoji');
{
  const raw = new TextDecoder('latin1').decode(new Uint8Array([0x00, 0xff]));
  const b = utf8ToBase26(raw);
  assert(base26ToUtf8(b) === raw, 'latin1 0x00/0xFF round-trip via UTF-8');
  const pure = utf8ToBase26(new TextDecoder().decode(new Uint8Array([0x00, 0x7f])));
  assert(pure.length === 4 && base26ToUtf8(pure).charCodeAt(1) === 0x7f, 'bytes 0x00 and 0x7F → 4 letters');
}

const mk = randomMessageKey4(() => 0.5);
assert(/^[A-Z]{4}$/.test(mk), 'random message key shape');

// --- traditional involutory ---
{
  const engine = new CipherEngine();
  configureTraditional(engine);
  const plain = 'HELLOALBERICHTESTMESSAGE';
  const cipher = engine.encryptMessage(plain);
  configureTraditional(engine);
  const back = engine.encryptMessage(cipher);
  assert(back === plain, 'traditional: encrypt twice recovers plaintext');
}

// --- modern letter path still works ---
{
  const engine = new CipherEngine();
  configureModernEngine(engine, 'CDSZ');
  const plain = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const cipher = engine.encryptMessage(plain);
  configureModernEngine(engine, 'CDSZ');
  assert(engine.decryptMessage(cipher) === plain, 'modern letter decrypt(encrypt)');
  configureModernEngine(engine, 'CDSZ');
  assert(engine.encryptMessage(cipher) !== plain, 'modern not involutory');
}

// --- full modern package: Tagesschlüssel → Text → encrypt → decrypt ---
{
  const engine = new CipherEngine();
  const ground = 'CDSZ';
  const plug = 'AE BF CM DQ HU JN LX PR SZ VW';
  const original = 'Guten Tag! Äpfel, 42 € und 🔐 — Modern-Test.';
  const messageKey = 'LDNQ';

  const configure = (key) => configureModernEngine(engine, key, plug);

  const enc = modernEncryptPayload({
    engine,
    configure,
    groundKey: ground,
    plainText: original,
    messageKey,
  });
  assert(enc.ok, 'modernEncryptPayload ok');
  assert(enc.header.length === 4, 'header 4 letters');
  assert(enc.cipher.startsWith(enc.header), 'cipher starts with header');
  assert(enc.cipher.length === 4 + utf8ToBase26(original).length, 'cipher length = 4 + base26');

  const dec = modernDecryptPayload({
    engine,
    configure,
    groundKey: ground,
    cipherLetters: enc.cipher,
  });
  assert(dec.ok, 'modernDecryptPayload ok');
  assert(dec.messageKey === messageKey, 'recovered message key');
  assert(dec.header === enc.header, 'header matches');
  assert(dec.plainText === original, 'full package: decrypt recovers original UTF-8');

  const badGround = modernDecryptPayload({
    engine,
    configure,
    groundKey: 'AAAA',
    cipherLetters: enc.cipher,
  });
  assert(!badGround.ok && badGround.error === 'modern.decryptFailed', 'wrong ground rejected');

  const plainAsCipher = modernDecryptPayload({
    engine,
    configure,
    groundKey: ground,
    cipherLetters: 'HALLOWELTTESTXX',
  });
  assert(!plainAsCipher.ok, 'plaintext-as-cipher rejected by round-trip');
}

// --- varied plugboards / rings (stress round-trip) ---
{
  const cases = [
    { rings: ['A', 'B', 'C'], plug: 'AB CD EF', ground: 'WXYZ', mk: 'QRST', plain: 'Hi!' },
    { rings: ['Z', 'Y', 'X'], plug: 'AE BF CM DQ HU JN', ground: 'AAAA', mk: 'BBBB', plain: 'ÄÖÜß' },
    { rings: ['M', 'M', 'M'], plug: 'AZ BY CX DW EV FU', ground: 'LMNO', mk: 'PQRS', plain: 'emoji 🎯' },
  ];
  for (const tc of cases) {
    const engine = new CipherEngine();
    const configure = (key) => {
      const positions = [...key];
      engine.setCryptoMode('modern');
      engine.setReflector('B');
      engine.setRotors(
        'I', 'II', 'III', 'Gamma',
        positions[1], positions[2], positions[3], positions[0],
        tc.rings[0], tc.rings[1], tc.rings[2],
      );
      engine.setPlugboard(tc.plug);
      const notches = deriveLueckenfuellerNotches(
        tc.rings[0],
        tc.rings[1],
        tc.rings[2],
        tc.plug,
      );
      if (!notches.ok) return false;
      engine.setEndwalze(resolveEndwalzeWiring('B'));
      engine.setLueckenfuellerNotches(notches.notches);
      return true;
    };
    const enc = modernEncryptPayload({
      engine,
      configure,
      groundKey: tc.ground,
      plainText: tc.plain,
      messageKey: tc.mk,
    });
    assert(enc.ok, `stress encrypt ${tc.plain}`);
    const dec = modernDecryptPayload({
      engine,
      configure,
      groundKey: tc.ground,
      cipherLetters: enc.cipher,
    });
    assert(dec.ok && dec.plainText === tc.plain, `stress decrypt ${tc.plain}`);
  }
}

// --- different message keys → different ciphertext ---
{
  const engine = new CipherEngine();
  const ground = 'AAAA';
  const plug = 'AB CD EF GH';
  const configure = (key) => configureModernEngine(engine, key, plug);
  const e1 = modernEncryptPayload({
    engine, configure, groundKey: ground, plainText: 'Hi', messageKey: 'AAAA',
  });
  const e2 = modernEncryptPayload({
    engine, configure, groundKey: ground, plainText: 'Hi', messageKey: 'BBBB',
  });
  assert(e1.ok && e2.ok && e1.cipher !== e2.cipher, 'different auto keys → different cipher');
}

// --- min plugs ---
{
  const bad = deriveLueckenfuellerNotches('A', 'A', 'A', 'AE BF');
  assert(!bad.ok && bad.error === 'modern.needMinPlugs', `min plugs ${MIN_STECKER_PAIRS}`);
  const engine = new CipherEngine();
  assert(!configureModernEngine(engine, 'CDSZ', 'AE BF'), 'configure fails with 2 plugs');
}

// --- capabilities ---
{
  const caps = getModeCapabilities('modern');
  assert(caps.endwalze && caps.lueckenfueller && caps.base26 && caps.autoMessageKey, 'modern caps all on');
  assert(!caps.historicalInvolutory && !caps.alphabetAzOnly, 'modern not historical A-Z only');
  const trad = getModeCapabilities('traditional');
  assert(trad.historicalInvolutory && trad.alphabetAzOnly && !trad.base26, 'traditional caps');
}

assert(composeWiring('ABCDEFGHIJKLMNOPQRSTUVWXYZ', ENDWALZE_CAESAR) === ENDWALZE_CAESAR, 'compose id');
assert(typeof DEFAULT_REFLECTOR_D_PAIRS === 'string', 'dora default present');
assert(normalizePlugPairsCanonical('BF AE').join(' ') === 'AE BF', 'plug normalize');

{
  const free = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ';
  const wired = resolveEndwalzeWiring('D', free, true);
  assert(isPermutationWiring(wired), 'free Dora endwalze is permutation');
  assert(!isInvolutoryWiring(wired), 'free Dora endwalze not involutory');
  const fixed = resolveEndwalzeWiring('D', DEFAULT_REFLECTOR_D_PAIRS, false);
  assert(wired !== fixed, 'free Dora wiring differs from BO-fixed Dora');
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll modern-crypto selftests passed (incl. variable Lückenfüller + full package).');
