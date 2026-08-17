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

console.log('\nAll secure-random selftests passed.');
