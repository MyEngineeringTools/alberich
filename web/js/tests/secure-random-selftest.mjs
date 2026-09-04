/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Selftest: secure-random.js (CSPRNG-Helfer)
 * node js/tests/secure-random-selftest.mjs
 */

import {
  cryptoRandomInt,
  pick,
  randomFourLetters,
  randomMainRotors,
  randomPlugboard,
  shuffle,
} from '../secure-random.js';
import { randomMessageKey4 } from '../modern-crypto.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
  console.log('OK  ', msg);
}

assert(cryptoRandomInt(1) === 0, 'cryptoRandomInt(1)');
for (let i = 0; i < 50; i++) {
  const n = cryptoRandomInt(26);
  assert(n >= 0 && n < 26, `cryptoRandomInt range ${n}`);
}

const arr = [1, 2, 3, 4, 5];
const s = shuffle(arr);
assert(s.length === 5 && arr[0] === 1, 'shuffle copies');
assert(s.slice().sort((a, b) => a - b).join() === '1,2,3,4,5', 'shuffle permutation');

assert(/^[A-Z]{4}$/.test(randomFourLetters()), 'randomFourLetters shape');
assert(/^[A-Z]{4}$/.test(randomMessageKey4()), 'randomMessageKey4 CSPRNG shape');
assert(randomMessageKey4(() => 0) === 'AAAA', 'randomMessageKey4 test rng');

const plugs = randomPlugboard(10);
const pairs = plugs.split(/\s+/).filter(Boolean);
assert(pairs.length === 10, '10 plug pairs');
assert(pairs.every((p) => /^[A-Z]{2}$/.test(p) && p[0] < p[1]), 'canonical pairs');
const letters = pairs.join('').split('');
assert(new Set(letters).size === 20, '20 distinct plug letters');

const mains = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const three = randomMainRotors(mains);
assert(three.length === 3, '3 main rotors');
assert(new Set(three).size === 3, 'distinct main rotors');
assert(three.every((id) => mains.includes(id)), 'known main rotors');

assert(typeof pick(mains) === 'string', 'pick');

{
  const src = await import('node:fs/promises').then((fs) => fs);
  const files = [
    'js/secure-random.js',
    'js/codebook-generate.js',
    'js/modern-v3.js',
    'js/modern-crypto.js',
    'js/full-key-fingerprint.js',
  ];
  for (const rel of files) {
    const text = await src.readFile(rel, 'utf8');
    assert(!/\bMath\.random\b/.test(text), `${rel} has no Math.random`);
  }
  const random = await src.readFile('js/secure-random.js', 'utf8');
  assert(random.includes('crypto.getRandomValues') || random.includes('getRandomValues'), 'CSPRNG uses getRandomValues');
  assert(random.includes('x >= limit'), 'rejection sampling present');
  assert(random.includes('0x100000000'), 'rejection uses 2^32 range');
}

{
  const n = 3;
  const limit = Math.floor(0x100000000 / n) * n;
  assert(limit % n === 0, 'rejection limit is multiple of n');
  assert(limit === 4294967295, 'n=3 rejects 0xFFFFFFFF');
  const orig = crypto.getRandomValues.bind(crypto);
  let calls = 0;
  crypto.getRandomValues = (buf) => {
    calls += 1;
    if (calls === 1) {
      buf[0] = 0xFFFFFFFF;
      return buf;
    }
    buf[0] = 1;
    return buf;
  };
  try {
    const v = cryptoRandomInt(3);
    assert(calls >= 2, 'out-of-range draw rejected, CSPRNG called again');
    assert(v === 1 % 3, 'accepted draw after rejection');
  } finally {
    crypto.getRandomValues = orig;
  }
}

{
  const orig = crypto.getRandomValues;
  try {
    delete crypto.getRandomValues;
    if (crypto.getRandomValues) crypto.getRandomValues = undefined;
    Object.defineProperty(crypto, 'getRandomValues', { value: undefined, configurable: true, writable: true });
    let threw = false;
    try {
      cryptoRandomInt(26);
    } catch {
      threw = true;
    }
    assert(threw, 'missing getRandomValues fails closed');
  } finally {
    Object.defineProperty(crypto, 'getRandomValues', { value: orig, configurable: true, writable: true });
  }
}

{
  const counts = new Array(26).fill(0);
  const samples = 26 * 400;
  for (let i = 0; i < samples; i++) counts[cryptoRandomInt(26)] += 1;
  const expected = samples / 26;
  let chi = 0;
  for (const c of counts) chi += ((c - expected) ** 2) / expected;
  assert(chi < 52.62, `chi-square smoke cryptoRandomInt(26) χ²=${chi.toFixed(2)} (df=25, 0.001)`);
}

assert(randomMessageKey4(() => 0.999) !== randomMessageKey4(), 'test rng injection does not replace production CSPRNG');

console.log('\nAll secure-random selftests passed.');
