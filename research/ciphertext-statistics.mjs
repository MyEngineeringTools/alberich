#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Live Modern V3 ciphertext-only statistics. Base-26 V2 body.
 */
import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernV3EncryptPayload, utf8ToBase26v2 } from '../web/js/modern-v3.js';
import {
  SYNTHETIC_V3,
  configureSyntheticV3,
  mulberry32,
  seededInt,
  writeJson,
  wantsSmoke,
  stampLiveV3,
  alphabet,
} from './lib.mjs';

const AZ = alphabet();

async function encrypt(plain, messageKey, messageId = 'TESTMSGX') {
  const engine = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: SYNTHETIC_V3.groundKey,
    plainText: plain,
    messageKey,
    messageId,
    dayConfig: SYNTHETIC_V3,
  });
  if (!enc.ok) throw new Error(enc.error);
  return enc;
}

function ic(letters) {
  const c = Array(26).fill(0);
  for (const ch of letters) c[ch.charCodeAt(0) - 65] += 1;
  const n = letters.length;
  if (n < 2) return 0;
  let sum = 0;
  for (const x of c) sum += x * (x - 1);
  return sum / (n * (n - 1));
}

function freqs(letters) {
  const c = Array(26).fill(0);
  for (const ch of letters) c[ch.charCodeAt(0) - 65] += 1;
  const n = Math.max(1, letters.length);
  return Object.fromEntries(AZ.split('').map((ch, i) => [ch, Number((c[i] / n).toFixed(5))]));
}

function ngrams(letters, n) {
  const map = new Map();
  for (let i = 0; i + n <= letters.length; i++) {
    const g = letters.slice(i, i + n);
    map.set(g, (map.get(g) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function autocorrelation(letters, maxLag = 40) {
  const out = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let hit = 0;
    let n = 0;
    for (let i = 0; i + lag < letters.length; i++) {
      n += 1;
      if (letters[i] === letters[i + lag]) hit += 1;
    }
    out.push({ lag, rate: n ? Number((hit / n).toFixed(5)) : 0 });
  }
  return out;
}

if (wantsSmoke()) {
  const enc = await encrypt('Hello Alberich ciphertext smoke', 'LDNQ');
  const bodyIc = ic(enc.body);
  if (!(bodyIc > 0 && bodyIc < 0.2)) throw new Error(`implausible IC ${bodyIc}`);
  console.log(`smoke ok ciphertext-statistics ic=${bodyIc.toFixed(4)} body=${enc.body.length}`);
  process.exit(0);
}

const rng = mulberry32(0xc1a0);
const english = 'THIS IS A SYNTHETIC RESEARCH CORPUS FOR ALBERICH CIPHERTEXT STATISTICS ONLY. ';
const lengths = [20, 80, 200, 800];
const byLength = [];
for (const n of lengths) {
  const plain = english.repeat(Math.ceil(n / english.length)).slice(0, n);
  const enc = await encrypt(plain, 'LDNQ');
  byLength.push({
    plainChars: n,
    bodyLen: enc.body.length,
    base26Len: utf8ToBase26v2(plain).length,
    icBody: Number(ic(enc.body).toFixed(6)),
  });
}

const longPlain = english.repeat(40);
const single = await encrypt(longPlain, 'LDNQ');
const even = [];
const odd = [];
for (let i = 0; i < single.body.length; i++) {
  (i % 2 === 0 ? even : odd).push(single.body[i]);
}

const sameDay = [];
for (let i = 0; i < 12; i++) {
  const mk = `${AZ[i]}${AZ[(i + 3) % 26]}${AZ[(i + 7) % 26]}${AZ[(i + 11) % 26]}`;
  const mid = `ID${String(i).padStart(6, 'A')}`.replace(/[^A-Z]/g, 'A').slice(0, 8);
  const enc = await encrypt(`message number ${i} ${english}`, mk, mid);
  sameDay.push({ messageKey: mk, icBody: Number(ic(enc.body).toFixed(6)), header: enc.header });
}

const out = {
  ...stampLiveV3({ script: 'research/ciphertext-statistics.mjs' }),
  seed: 'mulberry32(0xC1A0)',
  encoding: 'Base-26 V2',
  singleMessage: {
    plainBytes: new TextEncoder().encode(longPlain).length,
    cipherLen: single.cipher.length,
    bodyLen: single.body.length,
    icBody: Number(ic(single.body).toFixed(6)),
    icEnglishRef: 0.066,
    icRandomRef: Number((1 / 26).toFixed(6)),
    freqs: freqs(single.body),
    topBigrams: ngrams(single.body, 2),
    topTrigrams: ngrams(single.body, 3),
    autocorrelation: autocorrelation(single.body),
    evenPosFreqs: freqs(even.join('')),
    oddPosFreqs: freqs(odd.join('')),
    evenIC: Number(ic(even.join('')).toFixed(6)),
    oddIC: Number(ic(odd.join('')).toFixed(6)),
  },
  byPlaintextLength: byLength,
  sameDayKeySeveralMessages: {
    count: sameDay.length,
    rows: sameDay,
    note: 'Same day key, different message keys. Not a uniformity proof.',
  },
  unusedSeedDraw: seededInt(rng, 26),
};

writeJson('ciphertext-statistics.json', out);
console.log('Modern V3 current IC body', out.singleMessage.icBody, 'random ref', out.singleMessage.icRandomRef);
