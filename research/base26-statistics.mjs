#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Base-26 V1-Statistik (Ist) und V2-Statistik falls vorhanden.
 */

import { utf8ToBase26 } from '../web/js/modern-crypto.js';
import { mulberry32, writeJson, alphabet, stampLiveV3 } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok base26-statistics'); process.exit(0); }

const AZ = alphabet();

function counts26() {
  return Array(26).fill(0);
}

function entropyFromCounts(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return 0;
  let h = 0;
  for (const c of counts) {
    if (!c) continue;
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

function analyzeLetters(letters) {
  const even = counts26();
  const odd = counts26();
  const all = counts26();
  for (let i = 0; i < letters.length; i++) {
    const p = letters.charCodeAt(i) - 65;
    if (p < 0 || p > 25) continue;
    all[p] += 1;
    if (i % 2 === 0) even[p] += 1;
    else odd[p] += 1;
  }
  const evenLettersUsed = even.filter((c) => c > 0).length;
  return {
    length: letters.length,
    evenPositionsRestrictedToAJ: even.slice(10).every((c) => c === 0) && even.slice(0, 10).some((c) => c > 0),
    evenLettersUsed,
    oddLettersUsed: odd.filter((c) => c > 0).length,
    entropyEven: Number(entropyFromCounts(even).toFixed(4)),
    entropyOdd: Number(entropyFromCounts(odd).toFixed(4)),
    entropyAll: Number(entropyFromCounts(all).toFixed(4)),
    evenShareAJ: even.slice(0, 10).reduce((a, b) => a + b, 0) / Math.max(1, even.reduce((a, b) => a + b, 0)),
    freqEven: Object.fromEntries(AZ.split('').map((ch, i) => [ch, even[i]])),
    freqOdd: Object.fromEntries(AZ.split('').map((ch, i) => [ch, odd[i]])),
  };
}

const rng = mulberry32(0xB26);
const samples = [];

function addSample(name, text) {
  const letters = utf8ToBase26(text);
  const bytes = new TextEncoder().encode(text);
  samples.push({
    name,
    utf8Bytes: bytes.length,
    letters: letters.length,
    lettersPerByte: bytes.length ? letters.length / bytes.length : 0,
    ...analyzeLetters(letters),
  });
}

addSample('empty', '');
addSample('ascii-A', 'A');
addSample('ascii-Hello', 'Hello');
addSample('pangram', 'The quick brown fox jumps over the lazy dog 0123456789');
addSample('umlauts', 'Äpfel, Öl und Übergrößen — Straße');
addSample('emoji', '🔐 test 🎯');
{
  const bytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) bytes[i] = i;
  samples.push({
    name: 'all-bytes-raw',
    utf8Bytes: bytes.length,
    letters: null,
    note: 'raw Uint8Array 0..255 — no TextDecoder',
    byteSum: [...bytes].reduce((a, b) => a + b, 0),
  });
}
{
  const raw = new Uint8Array(4000);
  for (let i = 0; i < raw.length; i++) raw[i] = seededByte(rng);
  const asLatin1Fallback = [...raw].map((b) => String.fromCharCode(b)).join('');
  addSample('random-4000-bytes-as-code-units', asLatin1Fallback);
}

function seededByte(r) {
  return Math.floor(r() * 256) % 256;
}

let v2 = { available: false };
try {
  const mod = await import('../web/js/modern-v3.js');
  if (typeof mod.utf8ToBase26v2 === 'function') {
    const v2samples = [];
    const texts = [
      ['empty', ''],
      ['ascii-A', 'A'],
      ['ascii-Hello', 'Hello'],
      ['pangram', 'The quick brown fox jumps over the lazy dog 0123456789'],
      ['umlauts', 'Äpfel, Öl und Übergrößen — Straße'],
      ['emoji', '🔐 test 🎯'],
    ];
    for (const [name, text] of texts) {
      const letters = mod.utf8ToBase26v2(text);
      const back = mod.base26v2ToUtf8(letters);
      const bytes = new TextEncoder().encode(text);
      v2samples.push({
        name,
        utf8Bytes: bytes.length,
        letters: letters.length,
        lettersPerByte: bytes.length ? letters.length / bytes.length : 0,
        roundTrip: back === text,
        ...analyzeLetters(letters),
      });
    }
    v2 = { available: true, samples: v2samples };
  }
} catch {
  v2 = { available: false };
}

const out = {
  seed: 'mulberry32(0xB26)',
  v1: {
    mapping: 'high=floor(byte/26) ∈ 0..9, low=byte%26 — even positions theoretically A–J only',
    samples,
    finding:
      'An jeder geraden Position (0-basiert) liegt der High-Nibble-Buchstabe nur in A–J. Das ist ein struktureller Crib, kein Avalanche-Problem der Rotoren.',
  },
  v2,
};

writeJson('base26-statistics.json', { ...stampLiveV3({ script: 'research/base26-statistics.mjs' }), encodingOnly: true, ...out });
console.log('V1 even-position A–J on random-4000:', samples.at(-1).evenPositionsRestrictedToAJ);
console.log('V1 entropy even/odd random:', samples.at(-1).entropyEven, samples.at(-1).entropyOdd);
console.log('V2 available:', v2.available);
