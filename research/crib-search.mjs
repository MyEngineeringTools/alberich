#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Crib-Suche: bekannten Klartext-Buchstabenstrom im Körper verschieben.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernEncryptPayload, utf8ToBase26 } from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson, META_LEGACY_V2 } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok crib-search'); process.exit(0); }

const PLAIN = 'XXXXHELLOALBERICHYYYY';
const engine0 = new CipherEngine();
const enc = modernEncryptPayload({
  engine: engine0,
  configure: (key) => configureSyntheticV2(engine0, key),
  groundKey: SYNTHETIC_V2.ground,
  plainText: PLAIN,
  messageKey: 'LDNQ',
});

const bodyLetters = utf8ToBase26(PLAIN);
const crib = utf8ToBase26('HELLOALBERICH');
const cribAt = bodyLetters.indexOf(crib);

function scoreOffset(offset) {
  if (offset < 0 || offset + crib.length > enc.body.length) return null;
  const engine = new CipherEngine();
  configureSyntheticV2(engine, 'LDNQ');
  // skip `offset` dummy letters to reach the window
  if (offset) engine.encryptMessage('A'.repeat(offset));
  const window = enc.body.slice(offset, offset + crib.length);
  const got = engine.encryptMessage(crib);
  return got === window;
}

const t0 = performance.now();
const hits = [];
for (let off = 0; off <= enc.body.length - crib.length; off++) {
  if (scoreOffset(off)) hits.push(off);
}
const ms = performance.now() - t0;

const out = {
  cribLetters: crib.length,
  trueOffset: cribAt,
  hits,
  offsetsTested: enc.body.length - crib.length + 1,
  ms: Number(ms.toFixed(2)),
  note: 'Bei bekanntem Tagesschlüssel und SK ist die Crib-Lage ein linearer Scan. Ohne Tagesschlüssel ist das kein praktischer Bruch.',
};

writeJson('legacy/v2/crib-search.json', { ...META_LEGACY_V2, status: 'NOT CURRENT MODERN V3', script: 'research/crib-search.mjs', ...out });
console.log(out);
