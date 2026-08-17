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
  wantsFull,
  writeJson,
  stampLiveV3,
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

function birthdayProb(n, space) {
  if (n < 2) return 0;
  return 1 - Math.exp((-n * (n - 1)) / (2 * space));
}

async function multiMessageStudy(sizes, seed = 0xc011) {
  const rng = mulberry32(seed);
  const maxN = Math.max(...sizes);
  const headers = new Map();
  const mids = new Set();
  const starts = new Set();
  let headerCollisions = 0;
  let midCollisions = 0;
  let startCollisions = 0;
  const snapshots = [];
  const engine = new CipherEngine();
  for (let i = 0; i < maxN; i++) {
    const mk = Array.from({ length: 4 }, () => AZ[seededInt(rng, 26)]).join('');
    const mid = Array.from({ length: 8 }, () => AZ[seededInt(rng, 26)]).join('');
    const enc = await modernV3EncryptPayload({
      engine,
      configure: (key) => configureSyntheticV3(engine, key),
      groundKey: SYNTHETIC_V3.groundKey,
      plainText: 'x',
      messageKey: mk,
      messageId: mid,
      dayConfig: SYNTHETIC_V3,
    });
    if (!enc.ok) throw new Error(enc.error);
    if (headers.has(enc.header)) headerCollisions += 1;
    else headers.set(enc.header, mk);
    if (mids.has(mid)) midCollisions += 1;
    else mids.add(mid);
    if (starts.has(mk)) startCollisions += 1;
    else starts.add(mk);
    if (sizes.includes(i + 1)) {
      snapshots.push({
        messages: i + 1,
        distinctHeaders: headers.size,
        headerCollisions,
        distinctMids: mids.size,
        midCollisions,
        distinctStarts: starts.size,
        startCollisions,
        theoryHeaderCollision: Number(birthdayProb(i + 1, 26 ** 4).toFixed(6)),
        theoryMidCollision: Number(birthdayProb(i + 1, 26 ** 8).toFixed(12)),
      });
    }
  }
  return {
    seed: `mulberry32(0x${seed.toString(16)})`,
    spaceMessageKey: 26 ** 4,
    spaceMid: 26 ** 8,
    snapshots,
    attackNote:
      'Same day key, many messages: SK birthday is 26^4. Repeated starts reuse the rotor walk. MID collisions are negligible. HMAC still binds each telegram.',
  };
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
    keysPerSec: null,
    wallMs: null,
    timingOmitted: 'volatile Node timing is not a reproducibility input',
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

const sizes = smoke ? [10, 20] : wantsFull() ? [10, 50, 100, 250, 500, 1000, 10000] : [10, 50, 100, 250];
const multi = await multiMessageStudy(sizes);

const out = {
  ...stampLiveV3({ script: 'research/v3-attacks.mjs' }),
  hmacIsCandidateOracle: true,
  candidateOracle: {
    status: 'PASS',
    procedure: 'candidate day key → canonicalDayKey → HKDF → HMAC → compare PRUEF',
    note: 'This is not an HMAC break. It must be counted in key-recovery cost: a wrong candidate is rejected cheaply and a right one is confirmed.',
    macFirstOnWrongGround: macFirst,
  },
  classification: {
    knownPlaintext: 'PARTIAL',
    chosenPlaintext: 'PARTIAL',
    endwalzeCsp: 'PARTIAL',
    plugboardRecovery: 'NOT TESTED',
    multiMessage: 'PARTIAL',
    formalSecurityProof: 'NONE',
  },
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
    ? `smoke ok macFirst=${macFirst} survivors=${cribRows[0].survivors} msgs=${multi.snapshots.at(-1)?.messages}`
    : JSON.stringify(out, null, 2),
);
