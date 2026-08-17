#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Live Modern V3 diffusion. Not a block-cipher avalanche claim.
 */
import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernV3EncryptPayload } from '../web/js/modern-v3.js';
import {
  SYNTHETIC_V3,
  configureSyntheticV3,
  writeJson,
  wantsSmoke,
  stampLiveV3,
  hammingLetters,
} from './lib.mjs';

const PLAIN = 'AAAAAAAABBBBBBBBCCCCCCCCHELLOALBERICH';

async function encryptV3(plain, overrides = {}) {
  const day = { ...SYNTHETIC_V3, ...overrides.day };
  const engine = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key, day),
    groundKey: overrides.groundKey || day.groundKey,
    plainText: plain,
    messageKey: overrides.messageKey || 'LDNQ',
    messageId: overrides.messageId || 'TESTMSGX',
    dayConfig: day,
  });
  if (!enc.ok) throw new Error(enc.error);
  return enc;
}

function notchTweak(set) {
  const letters = [...set];
  const first = letters[0];
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    if (!set.includes(ch)) {
      letters[0] = ch;
      return letters.sort().join('');
    }
  }
  return set.replace(first, first === 'A' ? 'B' : 'A');
}

if (wantsSmoke()) {
  const a = await encryptV3(PLAIN);
  const b = await encryptV3(`B${PLAIN.slice(1)}`);
  const h = hammingLetters(a.body, b.body);
  if (h.hamming < 1) throw new Error('plaintext mutation did not move the body');
  console.log(`smoke ok diffusion hamming=${h.hamming}`);
  process.exit(0);
}

const base = await encryptV3(PLAIN);
const cases = [];

{
  const other = await encryptV3(`B${PLAIN.slice(1)}`);
  cases.push({ name: 'plaintext-first-symbol', field: 'plaintext', ...hammingLetters(base.body, other.body) });
}
{
  const other = await encryptV3(`${PLAIN.slice(0, 8)}X${PLAIN.slice(9)}`);
  cases.push({ name: 'plaintext-mid-symbol', field: 'plaintext', ...hammingLetters(base.body, other.body) });
}
{
  const other = await encryptV3(PLAIN, { groundKey: 'ADSZ' });
  cases.push({
    name: 'ground-first-letter',
    field: 'ground',
    headerChanged: base.header !== other.header,
    pruefChanged: base.pruefgruppe !== other.pruefgruppe,
    ...hammingLetters(base.body, other.body),
  });
}
{
  const other = await encryptV3(PLAIN, { day: { ringRight: 'M', ringCode: 'EPEM' } });
  cases.push({ name: 'ring-right-plus-one', field: 'rings', ...hammingLetters(base.body, other.body) });
}
{
  const other = await encryptV3(PLAIN, {
    day: { plugboard: 'AF BF CM DQ HU JN LX PR SZ VW' },
  });
  cases.push({ name: 'plug-AE-to-AF', field: 'plugboard', ...hammingLetters(base.body, other.body) });
}
{
  const w = SYNTHETIC_V3.endwalzeWiring;
  const swapped = `${w[1]}${w[0]}${w.slice(2)}`;
  const other = await encryptV3(PLAIN, { day: { endwalzeWiring: swapped } });
  cases.push({ name: 'endwalze-swap-first-two', field: 'endwalze', ...hammingLetters(base.body, other.body) });
}
{
  const n = SYNTHETIC_V3.notches;
  const other = await encryptV3(PLAIN, {
    day: { notches: { ...n, right: notchTweak(n.right) } },
  });
  cases.push({ name: 'right-notch-set-tweak', field: 'notches', ...hammingLetters(base.body, other.body) });
}
{
  const other = await encryptV3(PLAIN, { messageKey: 'LDNR' });
  cases.push({ name: 'message-key-last-letter', field: 'messageKey', ...hammingLetters(base.cipher, other.cipher) });
}

const out = {
  ...stampLiveV3({ script: 'research/diffusion.mjs' }),
  statement:
    'Stepping does not depend on the plaintext. A changed symbol does not avalanche like a block cipher. Hamming distances below are measurements, not a security rating.',
  steppingIsPlaintextIndependent: true,
  plaintext: PLAIN,
  cases,
};

writeJson('diffusion.json', out);
console.log(out.statement);
for (const c of cases) {
  console.log(`${c.name}: hamming=${c.hamming} first=${c.first} last=${c.last} rate=${c.affectedRate}`);
}
