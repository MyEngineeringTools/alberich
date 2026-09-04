/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * V3_PROTOCOL_GOLDEN — unveränderliche Regression Guards.
 *
 * Diese Werte dürfen bei P0/P1 nicht aktualisiert werden, nur weil eine neue
 * Implementierung andere Ergebnisse erzeugt. Eine Änderung wäre eine
 * Protokoll-/Kryptokernänderung und braucht eine separate Architekturentscheidung.
 *
 * Erwartungswerte kommen ausschließlich aus reference/v3-protocol-golden.json.
 * Nicht: expected = encrypt(...).
 *
 * Ausführen: node js/tests/v3-protocol-golden-selftest.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CipherEngine } from '../cipher-engine.js';
import {
  MODERN_V3_STAMP,
  HEADER_LETTERS,
  MESSAGE_ID_LETTERS,
  PRUEF_LETTERS,
  modernV3DecryptPayload,
  modernV3EncryptPayload,
  parseV3Telegram,
  utf8ToBase26v2,
} from '../modern-v3.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN_PATH = join(ROOT, 'reference/v3-protocol-golden.json');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

function flipAt(letters, index) {
  const i = index < 0 ? letters.length + index : index;
  const cur = letters[i];
  const next = cur === 'A' ? 'B' : 'A';
  return letters.slice(0, i) + next + letters.slice(i + 1);
}

function configureV3(engine, keyCode4, day) {
  const positions = [...keyCode4];
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setRotors(
    day.rotorLeft,
    day.rotorMiddle,
    day.rotorRight,
    day.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    day.ringLeft,
    day.ringMiddle,
    day.ringRight,
  );
  engine.setThinRing(day.ringThin);
  engine.setPlugboard(day.plugboard);
  engine.setEndwalze(day.endwalzeWiring);
  engine.setLueckenfuellerNotches(day.notches);
  return true;
}

const frozen = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
assert(frozen.guard === 'V3_PROTOCOL_GOLDEN', 'file marked V3_PROTOCOL_GOLDEN');
assert(frozen.algorithmFingerprint === '909cc1f35c98789c', 'frozen fingerprint matches lab reference');
assert(frozen.protocol === 'ALBV | HDR4 | MID8 | BODY | PRUEF20', 'frozen protocol layout');
assert(Array.isArray(frozen.vectors) && frozen.vectors.length >= 7, 'at least 7 frozen vectors');

const byName = Object.fromEntries(frozen.vectors.map((v) => [v.name, v]));

for (const vector of frozen.vectors) {
  assert(vector.guard === 'V3_PROTOCOL_GOLDEN', `${vector.name} guard tag`);
  assert(vector.stamp === MODERN_V3_STAMP, `${vector.name} stamp ALBV`);
  assert(vector.header.length === HEADER_LETTERS, `${vector.name} HDR4 length`);
  assert(/^[A-Z]{8}$/.test(vector.messageId), `${vector.name} MID8 is A–Z only`);
  assert(vector.messageId.length === MESSAGE_ID_LETTERS, `${vector.name} MID8 length`);
  assert(/^[A-Z]+$/.test(vector.cipher), `${vector.name} telegram is A–Z only`);
  assert(vector.pruefgruppe.length === PRUEF_LETTERS, `${vector.name} PRUEF20 length`);
  assert(
    vector.cipher === vector.stamp + vector.header + vector.messageId + vector.body + vector.pruefgruppe,
    `${vector.name} serialisation ALBV|HDR4|MID8|BODY|PRUEF20`,
  );

  const parsed = parseV3Telegram(vector.cipher);
  assert(parsed.ok, `${vector.name} frozen cipher parses`);
  assert(parsed.header === vector.header, `${vector.name} parsed HDR4`);
  assert(parsed.messageId === vector.messageId, `${vector.name} parsed MID8`);
  assert(parsed.body === vector.body, `${vector.name} parsed BODY`);
  assert(parsed.pruef === vector.pruefgruppe, `${vector.name} parsed PRUEF20`);

  assert(utf8ToBase26v2(vector.plain) === vector.base26v2, `${vector.name} frozen Base-26 V2`);

  const engine = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureV3(engine, key, vector.day),
    groundKey: vector.day.groundKey,
    plainText: vector.plain,
    messageKey: vector.messageKey,
    messageId: vector.messageId,
    dayConfig: vector.day,
  });
  assert(enc.ok, `${vector.name} encrypt ok`);
  assert(enc.cipher === vector.cipher, `${vector.name} encrypt matches frozen telegram`);
  assert(enc.header === vector.header, `${vector.name} encrypt HDR4 frozen`);
  assert(enc.messageId === vector.messageId, `${vector.name} encrypt MID8 frozen`);
  assert(enc.body === vector.body, `${vector.name} encrypt BODY frozen`);
  assert(enc.pruefgruppe === vector.pruefgruppe, `${vector.name} encrypt PRUEF20 frozen`);

  const decEngine = new CipherEngine();
  const dec = await modernV3DecryptPayload({
    engine: decEngine,
    configure: (key) => configureV3(decEngine, key, vector.day),
    groundKey: vector.day.groundKey,
    cipherLetters: vector.cipher,
    dayConfig: vector.day,
  });
  assert(dec.ok, `${vector.name} decrypt frozen telegram`);
  assert(dec.plainText === vector.plain, `${vector.name} decrypt matches frozen plaintext`);
  assert(dec.messageKey === vector.messageKey, `${vector.name} recovered SK`);
  assert(dec.header === vector.header, `${vector.name} decrypt HDR4`);
  assert(dec.messageId === vector.messageId, `${vector.name} decrypt MID8`);
  assert(dec.pruefgruppe === vector.pruefgruppe, `${vector.name} decrypt PRUEF20`);
}

const standard = byName['v3-2-Hello'];
assert(!!standard, 'standard vector v3-2-Hello present');
assert(standard.header === 'KCBD', 'standard HDR4 frozen KCBD');
assert(standard.messageId === 'TESTMSGX', 'standard MID8 frozen TESTMSGX');
assert(standard.pruefgruppe === 'EFRKEQMITQRCOGPDSZAL', 'standard PRUEF20 frozen');

const longVec = byName['v3-5-long-stepping'];
assert(!!longVec, 'long vector present');
assert(longVec.plainChars >= 2000, 'long vector is not a short smoke text');
assert(longVec.bodyLetters >= 3000, 'long vector body has many rotor steps');
assert(longVec.steppingObservedAtFreeze.thin >= 1, 'freeze record: thin rotor stepped');
assert(longVec.steppingObservedAtFreeze.left >= 1, 'freeze record: left rotor stepped');
assert(longVec.steppingObservedAtFreeze.middle >= 1, 'freeze record: middle rotor stepped');
assert(longVec.steppingObservedAtFreeze.right >= 1, 'freeze record: right rotor stepped');

const utfVec = byName['v3-6-utf8-structure'];
assert(!!utfVec, 'UTF-8/structure vector present');
assert(/[a-z]/.test(utfVec.plain) && /[A-Z]/.test(utfVec.plain), 'UTF-8 vector mixed case');
assert(/[äöüÄÖÜß]/.test(utfVec.plain), 'UTF-8 vector umlauts');
assert(utfVec.plain.includes('\n'), 'UTF-8 vector newlines');
assert(/[?!.;:,]/.test(utfVec.plain), 'UTF-8 vector punctuation');

async function decryptFrozen(cipherLetters, day = standard.day) {
  const engine = new CipherEngine();
  return modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key, day),
    groundKey: day.groundKey,
    cipherLetters,
    dayConfig: day,
  });
}

{
  const wrongGround = { ...standard.day, groundKey: 'ADSZ' };
  const bad = await decryptFrozen(standard.cipher, wrongGround);
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: wrong daily ground → MAC fail, no plaintext');
}

{
  const badHeader = flipAt(standard.cipher, 4);
  const bad = await decryptFrozen(badHeader);
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: manipulated HDR4 → MAC fail');
}

{
  const badMid = flipAt(standard.cipher, 8);
  const bad = await decryptFrozen(badMid);
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: manipulated MID8 → MAC fail');
}

{
  const badBody = flipAt(standard.cipher, 16);
  const bad = await decryptFrozen(badBody);
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: manipulated BODY → MAC fail');
}

{
  const badPruef = flipAt(standard.cipher, -1);
  const bad = await decryptFrozen(badPruef);
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: manipulated PRUEF20 → MAC fail');
}

{
  const truncated = standard.cipher.slice(0, 20);
  const bad = await decryptFrozen(truncated);
  assert(!bad.ok && bad.error === 'modern.v3TooShort', 'negative: truncated telegram rejected');
}

{
  const unstamped = `XXXX${standard.cipher.slice(4)}`;
  const bad = await decryptFrozen(unstamped);
  assert(!bad.ok && bad.error === 'modern.notV3', 'negative: structurally invalid stamp rejected');
}

{
  const longBodyFlip = flipAt(longVec.cipher, 16);
  const engine = new CipherEngine();
  const bad = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureV3(engine, key, longVec.day),
    groundKey: longVec.day.groundKey,
    cipherLetters: longBodyFlip,
    dayConfig: longVec.day,
  });
  assert(!bad.ok && bad.error === 'modern.macFailed' && !bad.plainText, 'negative: long-vector BODY flip → MAC fail');
}

if (failed > 0) {
  console.error(`\n${failed} V3_PROTOCOL_GOLDEN test(s) failed`);
  process.exit(1);
}
console.log('\nAll V3_PROTOCOL_GOLDEN tests passed.');
