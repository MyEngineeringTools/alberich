#!/usr/bin/env node
/**
 * Ciphertext-only Statistik. Synthetisch. Fester Seed.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernEncryptPayload, utf8ToBase26 } from '../web/js/modern-crypto.js';
import {
  SYNTHETIC_V2,
  configureSyntheticV2,
  mulberry32,
  writeJson,
  alphabet,
} from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok ciphertext-statistics'); process.exit(0); }

const AZ = alphabet();
const rng = mulberry32(0xC1A0);

function encrypt(plain, messageKey) {
  const engine = new CipherEngine();
  const enc = modernEncryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key),
    groundKey: SYNTHETIC_V2.ground,
    plainText: plain,
    messageKey,
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
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
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

function repeatDistances(letters, n = 3) {
  const pos = new Map();
  const dists = [];
  for (let i = 0; i + n <= letters.length; i++) {
    const g = letters.slice(i, i + n);
    if (pos.has(g)) dists.push(i - pos.get(g));
    pos.set(g, i);
  }
  dists.sort((a, b) => a - b);
  return dists.slice(0, 40);
}

const english = 'THIS IS A SYNTHETIC RESEARCH CORPUS FOR ALBERICH CIPHERTEXT STATISTICS ONLY. ';
const longPlain = english.repeat(40);
const single = encrypt(longPlain, 'LDNQ');

const sameDay = [];
for (let i = 0; i < 12; i++) {
  const mk = 'AAAA'.replace('A', AZ[i]) + 'XYZ';
  const key = `${AZ[i]}${AZ[(i + 3) % 26]}${AZ[(i + 7) % 26]}${AZ[(i + 11) % 26]}`;
  sameDay.push(encrypt(`message number ${i} ${english}`, key).cipher);
}

const even = [];
const odd = [];
for (let i = 0; i < single.body.length; i++) {
  (i % 2 === 0 ? even : odd).push(single.body[i]);
}

const out = {
  generatedAt: new Date().toISOString(),
  seed: 'mulberry32(0xC1A0)',
  singleMessage: {
    plainBytes: new TextEncoder().encode(longPlain).length,
    cipherLen: single.cipher.length,
    bodyLen: single.body.length,
    icBody: Number(ic(single.body).toFixed(6)),
    icEnglishRef: 0.066,
    icRandomRef: 1 / 26,
    freqs: freqs(single.body),
    topBigrams: ngrams(single.body, 2),
    topTrigrams: ngrams(single.body, 3),
    autocorrelation: autocorrelation(single.body),
    repeatDistances3: repeatDistances(single.body, 3),
    evenPosFreqs: freqs(even.join('')),
    oddPosFreqs: freqs(odd.join('')),
    evenIC: Number(ic(even.join('')).toFixed(6)),
    oddIC: Number(ic(odd.join('')).toFixed(6)),
  },
  sameDayKeySeveralMessages: {
    count: sameDay.length,
    ics: sameDay.map((c) => Number(ic(c.slice(4)).toFixed(6))),
    note: 'Mehrere Nachrichten desselben Tagesschlüssels, verschiedene Spruchschlüssel.',
  },
};

writeJson('ciphertext-statistics.json', out);
console.log('IC body', out.singleMessage.icBody, 'random ref', (1 / 26).toFixed(4));
console.log('even IC', out.singleMessage.evenIC, 'odd IC', out.singleMessage.oddIC);
