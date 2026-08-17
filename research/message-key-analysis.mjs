#!/usr/bin/env node
/**
 * Auto-Spruchschlüssel: 26^4 ≈ 18,8 Bit steuern vier Walzenlagen.
 * Zusätzliche Buchstaben nur sinnvoll, wenn sie Maschinenparameter steuern.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernEncryptPayload, modernDecryptPayload } from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok message-key-analysis'); process.exit(0); }

const SPACE = 26 ** 4;

function enc(plain, mk) {
  const engine = new CipherEngine();
  return modernEncryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key),
    groundKey: SYNTHETIC_V2.ground,
    plainText: plain,
    messageKey: mk,
  });
}

const a = enc('same plaintext', 'AAAA');
const b = enc('same plaintext', 'AAAB');
const c = enc('same plaintext', 'AAAA');

let recoveredOk = false;
{
  const engine = new CipherEngine();
  const dec = modernDecryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key),
    groundKey: SYNTHETIC_V2.ground,
    cipherLetters: a.cipher,
  });
  recoveredOk = dec.ok && dec.messageKey === 'AAAA';
}

const out = {
  generatedAt: new Date().toISOString(),
  messageKeyLetters: 4,
  combinatorial: {
    space: SPACE,
    bits: Number(Math.log2(SPACE).toFixed(4)),
  },
  whatFourLettersControl: [
    'Thin-Position (in V2: Thin steht danach still)',
    'Left-Position',
    'Middle-Position',
    'Right-Position',
  ],
  recommendation:
    'Vier Buchstaben bleiben mechanisch korrekt, solange vier Rotorlagen der Startzustand sind. Eine zufällige Message-ID gehört nicht in die Walzen, sondern in die Prüfgruppe.',
  observations: {
    samePlainDifferentMkDifferentCipher: a.cipher !== b.cipher,
    samePlainSameMkSameCipher: a.cipher === c.cipher,
    headerDiffersWithMk: a.header !== b.header,
    recoveredMessageKey: recoveredOk,
  },
  bruteForceNote:
    'Bei bekanntem Tagesschlüssel ist der Spruchschlüssel 26^4. Der Header ist die Verschlüsselung des SK unter der Grundstellung — Known-Header-Crib der Länge 4. Das ist historisch üblich und kein Ersatz für Authentizität.',
  multiMessage:
    'Viele Nachrichten desselben Tages teilen Rotorwahl, Ringe, Stecker, Endwalze. Der SK wechselt. V2 hat keinen Message-Identifier und keinen MAC.',
};

writeJson('message-key-analysis.json', out);
console.log(JSON.stringify(out.observations, null, 2));
console.log(out.recommendation);
