#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Offensive V3 measurements. Not a break of the day key.
 */
import { performance } from 'node:perf_hooks';
import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  modernV3DecryptPayload,
  modernV3EncryptPayload,
  utf8ToBase26v2,
  canonicalDayKey,
  deriveAuthKey,
  computePruefgruppe,
  canonicalMacInput,
  parseV3Telegram,
} from '../web/js/modern-v3.js';
import {
  SYNTHETIC_V3,
  configureSyntheticV3,
  mulberry32,
  seededInt,
  wantsSmoke,
  writeJson,
} from './lib.mjs';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

async function encrypt(plain, opts = {}) {
  const engine = new CipherEngine();
  return modernV3EncryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: opts.groundKey || SYNTHETIC_V3.groundKey,
    plainText: plain,
    messageKey: opts.messageKey || 'LDNQ',
    messageId: opts.messageId || 'TESTMSGX',
    dayConfig: { ...SYNTHETIC_V3, ...opts.day },
  });
}

function invertEndwalzePartial(pairs) {
  // pairs: array of [inLetter, outLetter] through the whole machine is not isolated.
  // Here we treat known wiring constraints W[x]=y.
  const map = new Map(pairs);
  const used = new Set(map.values());
  let freeIn = 0;
  let freeOut = 0;
  for (const ch of AZ) {
    if (!map.has(ch)) freeIn += 1;
    if (!used.has(ch)) freeOut += 1;
  }
  let remaining = 1n;
  let n = BigInt(freeIn);
  while (n > 1n) {
    remaining *= n;
    n -= 1n;
  }
  return { known: map.size, remaining: remaining.toString(), remainingBits: Number(remaining === 0n ? 0 : Math.log2(Number(remaining > 2n ** 53n ? 2n ** 53n : remaining))) };
}

async function hmacOracleRejectsWrongGround(cipher) {
  const engine = new CipherEngine();
  const dec = await modernV3DecryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: 'ADSZ',
    cipherLetters: cipher,
    dayConfig: SYNTHETIC_V3,
  });
  return !dec.ok && dec.error === 'modern.macFailed';
}

async function birthdayHeaders(n) {
  const seen = new Map();
  let collisions = 0;
  const engine = new CipherEngine();
  const rng = mulberry32(0xc011);
  for (let i = 0; i < n; i++) {
    const mk = Array.from({ length: 4 }, () => AZ[seededInt(rng, 26)]).join('');
    const enc = await modernV3EncryptPayload({
      engine,
      configure: (key) => configureSyntheticV3(engine, key),
      groundKey: SYNTHETIC_V3.groundKey,
      plainText: 'x',
      messageKey: mk,
      messageId: `ID${String(i).padStart(6, 'A')}`.slice(0, 8).replace(/[^A-Z]/g, 'A'),
      dayConfig: SYNTHETIC_V3,
    });
    if (!enc.ok) throw new Error(enc.error);
    if (seen.has(enc.header)) collisions += 1;
    else seen.set(enc.header, mk);
  }
  return { messages: n, distinctHeaders: seen.size, headerCollisions: collisions };
}

async function cribFilter(crib, cipherBodyLen) {
  const start = performance.now();
  let tested = 0;
  let survivors = 0;
  const target = await encrypt(crib);
  const engine = new CipherEngine();
  for (const ch of 'ABCDEFGH') {
    tested += 1;
    const trial = await modernV3EncryptPayload({
      engine,
      configure: (key) => configureSyntheticV3(engine, key),
      groundKey: SYNTHETIC_V3.groundKey,
      plainText: crib,
      messageKey: `${ch}DNQ`,
      messageId: 'TESTMSGX',
      dayConfig: SYNTHETIC_V3,
    });
    if (trial.ok && trial.body === target.body) survivors += 1;
  }
  const ms = performance.now() - start;
  return {
    cribLen: crib.length,
    cipherBodyLen,
    tested,
    survivors,
    keysPerSec: tested / (ms / 1000),
    wallMs: ms,
  };
}

const smoke = wantsSmoke();

const encHello = await encrypt('Hello');
const parsed = parseV3Telegram(encHello.cipher);
const macFirst = await hmacOracleRejectsWrongGround(encHello.cipher);

const cribs = smoke ? ['AAAAAAAA'] : ['AAAAAAAA', 'A'.repeat(16), 'A'.repeat(32)];
const cribRows = [];
for (const crib of cribs) {
  const body = utf8ToBase26v2(crib);
  cribRows.push(await cribFilter(crib, body.length));
}

const chosen = [];
for (const text of smoke ? ['AAAAAAAA'] : ['AAAAAAAAAAAA', 'ABABABABABAB', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']) {
  const enc = await encrypt(text);
  chosen.push({ text, cipherLen: enc.cipher.length, header: enc.header });
}

const wiringPairs = [...SYNTHETIC_V3.endwalzeWiring].map((y, i) => [AZ[i], y]).slice(0, smoke ? 4 : 10);
const csp = invertEndwalzePartial(wiringPairs);

const multi = await birthdayHeaders(smoke ? 20 : 200);

const out = {
  generatedAt: new Date().toISOString(),
  protocol: 'Modern V3',
  hmacIsCandidateOracle: true,
  macFirstOnWrongGround: macFirst,
  knownPlaintext: cribRows,
  chosenPlaintext: chosen,
  endwalzeCsp: csp,
  multiMessage: multi,
  spruchschluesselSpace: 26 ** 4,
  birthdayNote:
    '4-letter message keys collide after a few hundred messages on one day key. Message-ID is not a substitute rotor. Do not treat 26^4 as security bits.',
  formalSecurityProof: 'none',
  bestDemonstratedAttack:
    'HMAC is a perfect offline oracle once a candidate day key is proposed. No practical recovery of the full day key is implemented.',
};

if (!smoke) writeJson('v3-attacks.json', out);
console.log(
  smoke
    ? `smoke ok macFirst=${macFirst} survivors=${cribRows[0].survivors} collisions=${multi.headerCollisions}`
    : JSON.stringify(out, null, 2),
);
