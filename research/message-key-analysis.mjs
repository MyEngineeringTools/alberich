#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Live V3 message key is still 4 letters = 26^4 rotor starts. MID is not a rotor.
 */
import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernV3EncryptPayload, modernV3DecryptPayload } from '../web/js/modern-v3.js';
import {
  SYNTHETIC_V3,
  configureSyntheticV3,
  writeJson,
  wantsSmoke,
  stampLiveV3,
} from './lib.mjs';

const SPACE = 26 ** 4;

async function enc(plain, mk, mid = 'TESTMSGX') {
  const engine = new CipherEngine();
  return modernV3EncryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: SYNTHETIC_V3.groundKey,
    plainText: plain,
    messageKey: mk,
    messageId: mid,
    dayConfig: SYNTHETIC_V3,
  });
}

if (wantsSmoke()) {
  const a = await enc('same', 'AAAA');
  const b = await enc('same', 'AAAB');
  if (a.cipher === b.cipher) throw new Error('different MK produced identical telegram');
  console.log('smoke ok message-key-analysis');
  process.exit(0);
}

const a = await enc('same plaintext', 'AAAA');
const b = await enc('same plaintext', 'AAAB');
const c = await enc('same plaintext', 'AAAA', 'TESTMSGX');
const d = await enc('same plaintext', 'AAAA', 'OTHERMID');

const engine = new CipherEngine();
const dec = await modernV3DecryptPayload({
  engine,
  configure: (key) => configureSyntheticV3(engine, key),
  groundKey: SYNTHETIC_V3.groundKey,
  cipherLetters: a.cipher,
  dayConfig: SYNTHETIC_V3,
});

const out = {
  ...stampLiveV3({ script: 'research/message-key-analysis.mjs' }),
  messageKeyLetters: 4,
  combinatorial: { space: SPACE, bits: Number(Math.log2(SPACE).toFixed(4)) },
  birthday: {
    approxMessagesFor50pct: Math.round(1.177 * Math.sqrt(SPACE)),
    note: 'Header collisions follow the 26^4 message-key space, not the MID space.',
  },
  whatFourLettersControl: ['Thin start', 'Left start', 'Middle start', 'Right start'],
  observations: {
    samePlainDifferentMkDifferentCipher: a.cipher !== b.cipher,
    samePlainSameMkSameMidSameCipher: a.cipher === c.cipher,
    sameMkDifferentMidDifferentPruef: a.pruefgruppe !== d.pruefgruppe,
    headerDiffersWithMk: a.header !== b.header,
    recoveredMessageKey: dec.ok && dec.messageKey === 'AAAA',
  },
  bruteForceNote:
    'Given the day key, the message key is a 26^4 search. The header is the encrypted start. MID does not expand the rotor space. HMAC is an offline candidate oracle for the day key, not for guessing SK once the day key is known — SK is recovered by decrypting the header.',
};

writeJson('message-key-analysis.json', out);
console.log(JSON.stringify(out.observations, null, 2));
