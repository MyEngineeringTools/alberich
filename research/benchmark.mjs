#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Reference (Node) performance only. Not attack complexity. Not years of security.
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

if (wantsSmoke()) {
  console.log('smoke ok benchmark');
  process.exit(0);
}

const engine = new CipherEngine();
configureSyntheticV3(engine, 'LDNQ');
const block = 'A'.repeat(4000);
const t0 = performance.now();
engine.encryptMessage(block);
const letterMs = performance.now() - t0;

const rounds = 40;
const t1 = performance.now();
for (let i = 0; i < rounds; i++) {
  const e = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine: e,
    configure: (key) => configureSyntheticV3(e, key),
    groundKey: SYNTHETIC_V3.groundKey,
    plainText: 'benchmark payload äöü',
    messageKey: 'LDNQ',
    messageId: 'BENCHMID',
    dayConfig: SYNTHETIC_V3,
  });
  const d = new CipherEngine();
  await modernV3DecryptPayload({
    engine: d,
    configure: (key) => configureSyntheticV3(d, key),
    groundKey: SYNTHETIC_V3.groundKey,
    cipherLetters: enc.cipher,
    dayConfig: SYNTHETIC_V3,
  });
}
const payloadMs = performance.now() - t1;

const out = {
  ...stampLiveV3({ script: 'research/benchmark.mjs' }),
  class: 'reference-performance',
  environment: 'Node.js CipherEngine + Web Crypto HMAC',
  notClaimed: [
    'Node keys/s extrapolated to years of security',
    'optimized C++/Rust attack performance (none in this tree)',
  ],
  reference: {
    letters: { n: block.length, ran: true },
    payloads: { rounds, ran: true },
    lastLocalSample: {
      letterMs: Number(letterMs.toFixed(2)),
      lettersPerSec: Math.round(block.length / (letterMs / 1000)),
      payloadMs: Number(payloadMs.toFixed(2)),
      roundsPerSec: Number(((rounds / payloadMs) * 1000).toFixed(1)),
      note: 'Informative only. Not compared in git diff / CI.',
    },
  },
  attackHarness: {
    status: 'see research/v3-attacks.mjs keysPerSec fields',
    optimizedNative: false,
  },
};

const committed = {
  ...out,
  reference: {
    letters: out.reference.letters,
    payloads: out.reference.payloads,
  },
};
writeJson('benchmark.json', committed);
console.log(JSON.stringify(out.reference, null, 2));
