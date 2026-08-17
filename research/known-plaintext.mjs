#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Known-Plaintext / Crib-Labor. Misst Kandidaten und keys/s.
 * Keine reinen Theorieaussagen.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernEncryptPayload, utf8ToBase26 } from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson, alphabet, META_LEGACY_V2 } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok known-plaintext'); process.exit(0); }

const AZ = alphabet();
const PLAIN = 'KNOWNPLAINTEXT-CRIB-BLOCK-0123456789-XXXXXXXX';
const CRIBS = [8, 16, 32, 64];

function encrypt(plain, mk = 'LDNQ') {
  const engine = new CipherEngine();
  return modernEncryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key),
    groundKey: SYNTHETIC_V2.ground,
    plainText: plain,
    messageKey: mk,
  });
}

const enc = encrypt(PLAIN);
const bodyPlain = utf8ToBase26(PLAIN);

function timeKeys(n, fn) {
  const t0 = performance.now();
  let hits = 0;
  for (let i = 0; i < n; i++) hits += fn(i) ? 1 : 0;
  const ms = performance.now() - t0;
  return { tested: n, hits, ms: Number(ms.toFixed(2)), keysPerSec: Number(((n / ms) * 1000).toFixed(1)) };
}

function mkFromIndex(i) {
  let n = i;
  let s = '';
  for (let k = 0; k < 4; k++) {
    s = AZ[n % 26] + s;
    n = Math.floor(n / 26);
  }
  return s;
}

const scenarios = {};

{
  // F: crib of length L — filter message keys by first L body letters (day key known except MK)
  const budget = 4000;
  for (const L of CRIBS) {
    const want = enc.body.slice(0, L);
    const need = bodyPlain.slice(0, L);
    const r = timeKeys(budget, (i) => {
      const mk = i === 0 ? 'LDNQ' : mkFromIndex(i);
      const engine = new CipherEngine();
      configureSyntheticV2(engine, mk);
      return engine.encryptMessage(need) === want;
    });
    scenarios[`F_crib_${L}`] = {
      ...r,
      note: 'Tagesschlüssel bekannt, Spruchschlüssel unbekannt, Crib-Filter auf dem Körper.',
    };
  }
}

{
  // A: rotors known — brute a 2-letter ring slice as stand-in for partial unknown rings
  const budget = 26 * 26;
  const r = timeKeys(budget, (i) => {
    const ringLeft = AZ[i % 26];
    const ringMiddle = AZ[Math.floor(i / 26) % 26];
    const engine = new CipherEngine();
    return configureSyntheticV2(engine, 'LDNQ', {
      ...SYNTHETIC_V2,
      rings: [ringLeft, ringMiddle, SYNTHETIC_V2.rings[2]],
    }) && (() => {
      const e = modernEncryptPayload({
        engine,
        configure: (key) => configureSyntheticV2(engine, key, {
          ...SYNTHETIC_V2,
          rings: [ringLeft, ringMiddle, SYNTHETIC_V2.rings[2]],
        }),
        groundKey: SYNTHETIC_V2.ground,
        plainText: PLAIN.slice(0, 8),
        messageKey: 'LDNQ',
      });
      return e.ok && e.body === enc.body.slice(0, utf8ToBase26(PLAIN.slice(0, 8)).length);
    })();
  });
  scenarios.C_two_rings_unknown = {
    ...r,
    survivorsExpected: 1,
    note: 'Zwei Ringbuchstaben unbekannt, Rest inkl. SK bekannt. 26^2 voll durchsucht.',
  };
}

{
  const t0 = performance.now();
  const engine = new CipherEngine();
  configureSyntheticV2(engine, SYNTHETIC_V2.ground);
  const recovered = engine.decryptMessage(enc.header);
  scenarios.A_rotors_known_header_recover = {
    recovered,
    correct: recovered === 'LDNQ',
    ms: Number((performance.now() - t0).toFixed(3)),
    note: 'Wenn der Tagesschlüssel bekannt ist, ist der Spruchschlüssel ein 4-Buchstaben-Decrypt. Kein Suchraum.',
  };
}

const out = {
  scenarios,
  limits: [
    'Vollsuche Plugboard 10 Paare oder 26! Endwalze ist hier nicht ausführbar.',
    'Gemessen wird die tatsächlich implementierte Suche, nicht eine behauptete Bit-Sicherheit.',
  ],
};

writeJson('legacy/v2/known-plaintext.json', { ...META_LEGACY_V2, status: 'NOT CURRENT MODERN V3', script: 'research/known-plaintext.mjs', ...out });
console.log(JSON.stringify(scenarios, null, 2));
