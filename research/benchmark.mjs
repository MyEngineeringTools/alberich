#!/usr/bin/env node
/**
 * Grober Durchsatz: Buchstaben/s und Payload-Runden/s.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernEncryptPayload, modernDecryptPayload, utf8ToBase26 } from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok benchmark'); process.exit(0); }

const engine = new CipherEngine();
configureSyntheticV2(engine, 'LDNQ');
const block = 'A'.repeat(10000);
const t0 = performance.now();
engine.encryptMessage(block);
const letterMs = performance.now() - t0;

const rounds = 200;
const t1 = performance.now();
for (let i = 0; i < rounds; i++) {
  const e = new CipherEngine();
  const enc = modernEncryptPayload({
    engine: e,
    configure: (key) => configureSyntheticV2(e, key),
    groundKey: SYNTHETIC_V2.ground,
    plainText: 'benchmark payload äöü',
    messageKey: 'LDNQ',
  });
  const d = new CipherEngine();
  modernDecryptPayload({
    engine: d,
    configure: (key) => configureSyntheticV2(d, key),
    groundKey: SYNTHETIC_V2.ground,
    cipherLetters: enc.cipher,
  });
}
const payloadMs = performance.now() - t1;

const out = {
  generatedAt: new Date().toISOString(),
  letters: {
    n: block.length,
    ms: Number(letterMs.toFixed(2)),
    lettersPerSec: Math.round(block.length / (letterMs / 1000)),
  },
  payloads: {
    rounds,
    ms: Number(payloadMs.toFixed(2)),
    roundsPerSec: Number(((rounds / payloadMs) * 1000).toFixed(1)),
  },
};

writeJson('benchmark.json', out);
console.log(out);
