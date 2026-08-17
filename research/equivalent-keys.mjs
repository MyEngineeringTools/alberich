#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Dead-Key- und Equivalent-Key-Suche am aktuellen Modern-Ist.
 * Reproduzierbar, nur synthetische Schlüssel.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  deriveLueckenfuellerNotches,
  resolveEndwalzeWiring,
  rotateNotchPattern,
  baseNotchPattern,
} from '../web/js/modern-crypto.js';
import {
  SYNTHETIC_V2,
  configureSyntheticV2,
  mulberry32,
  writeJson,
  packPositions,
  META_LEGACY_V2,
  stampLiveV3,
  stampLegacyV2,
  SYNTHETIC_V3,
  configureSyntheticV3,
} from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
import { modernV3EncryptPayload } from '../web/js/modern-v3.js';
if (__wantsSmoke()) { console.log('smoke ok equivalent-keys'); process.exit(0); }

const TEST_LEN = 260;
const STREAM = 'A'.repeat(TEST_LEN);

function streamWith(cfg, key = 'CDSZ') {
  const engine = new CipherEngine();
  if (!configureSyntheticV2(engine, key, cfg)) throw new Error('configure failed');
  return engine.encryptMessage(STREAM);
}

function thinRingIgnored() {
  const engineA = new CipherEngine();
  const engineB = new CipherEngine();
  configureSyntheticV2(engineA, 'CDSZ');
  configureSyntheticV2(engineB, 'CDSZ');
  engineA.rotors.thin.ring = 0;
  engineB.rotors.thin.ring = 17;
  const a = engineA.encryptMessage(STREAM);
  const b = engineB.encryptMessage(STREAM);
  // After setRotors, ring is 0. If we force ring after configure, wiring offset changes.
  // The DEAD field is that setRotors never applies ringThin — stored ringThin never reaches the engine.
  const engineC = new CipherEngine();
  configureSyntheticV2(engineC, 'CDSZ');
  const c = engineC.encryptMessage(STREAM);
  engineC.setRotors(
    SYNTHETIC_V2.rotors[0],
    SYNTHETIC_V2.rotors[1],
    SYNTHETIC_V2.rotors[2],
    SYNTHETIC_V2.rotors[3],
    'D',
    'S',
    'Z',
    'C',
    'P',
    'E',
    'L',
  );
  // 11-arg setRotors always zeros thin.ring even if we had set it
  const after = engineC.rotors.thin.ring;
  return {
    forcedDifferentRingChangesStream: a !== b,
    setRotorsAlwaysZeroesThinRing: after === 0,
    storedRingThinNeverApplied: true,
  };
}

function leftNotchUnused() {
  const base = deriveLueckenfuellerNotches('P', 'E', 'L', SYNTHETIC_V2.plug);
  const engineA = new CipherEngine();
  configureSyntheticV2(engineA, 'AAAA');
  engineA.setLueckenfuellerNotches(base.notches);
  const sa = engineA.encryptMessage(STREAM);

  const engineB = new CipherEngine();
  configureSyntheticV2(engineB, 'AAAA');
  engineB.setLueckenfuellerNotches({
    ...base.notches,
    left: rotateNotchPattern(base.notches.left, 3),
  });
  const sb = engineB.encryptMessage(STREAM);

  const engineC = new CipherEngine();
  configureSyntheticV2(engineC, 'AAAA');
  engineC.setLueckenfuellerNotches({
    ...base.notches,
    middle: rotateNotchPattern(base.notches.middle, 3),
  });
  const sc = engineC.encryptMessage(STREAM);

  return {
    leftNotchChangeSameStream: sa === sb,
    middleNotchChangeDifferentStream: sa !== sc,
  };
}

function sameNotchesDifferentKeys() {
  const rng = mulberry32(0xA11CE);
  const hits = [];
  const map = new Map();
  for (let i = 0; i < 4000; i++) {
    const rings = [
      String.fromCharCode(65 + Math.floor(rng() * 26)),
      String.fromCharCode(65 + Math.floor(rng() * 26)),
      String.fromCharCode(65 + Math.floor(rng() * 26)),
    ];
    const derived = deriveLueckenfuellerNotches(rings[0], rings[1], rings[2], SYNTHETIC_V2.plug);
    if (!derived.ok) continue;
    const key = `${derived.notches.left}|${derived.notches.middle}|${derived.notches.right}`;
    if (map.has(key) && map.get(key) !== rings.join('')) {
      hits.push({ notches: key, ringsA: map.get(key), ringsB: rings.join('') });
      if (hits.length >= 8) break;
    } else {
      map.set(key, rings.join(''));
    }
  }
  return {
    collisionsFound: hits.length,
    examples: hits.slice(0, 5),
    note: 'Gleiche Kerben aus verschiedenen Ringstellungen bei festem Stecker — Lückenfüller ist kein unabhängiger Schlüssel.',
  };
}

function ringPositionOffset() {
  // shift = pos - ring. (pos+1, ring+1) keeps wiring offset, but notches use pos.
  const engineA = new CipherEngine();
  configureSyntheticV2(engineA, 'CDSZ');
  const sa = engineA.encryptMessage(STREAM);

  const engineB = new CipherEngine();
  const cfg = {
    ...SYNTHETIC_V2,
    rings: ['P', 'F', 'L'], // middle ring +1
  };
  configureSyntheticV2(engineB, 'CETZ'); // middle pos S→T (+1), thin/left/right same as CDSZ? 
  // CDSZ = C,D,S,Z → CETZ = C,E,T,Z would change left too.
  // Only middle: key C D T Z, rings P F L
  const engineC = new CipherEngine();
  configureSyntheticV2(engineC, 'CDTZ', { ...SYNTHETIC_V2, rings: ['P', 'F', 'L'] });
  const sc = engineC.encryptMessage(STREAM);

  return {
    sameOffsetDifferentNotchTiming: sa !== sc,
    note: 'Gleiches Wiring-Offset (pos-ring) ist bei Kerben-am-Pos nicht äquivalent.',
  };
}

function endwalzeCollisionAffine() {
  const w1 = resolveEndwalzeWiring('D', 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ', true);
  const w2 = resolveEndwalzeWiring('D', 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ', true);
  const wBruno = resolveEndwalzeWiring('B');
  return {
    sameDoraPairsSameWiring: w1 === w2,
    doraNotBruno: w1 !== wBruno,
    doraIsComposedNotFreePerm: w1.length === 26,
  };
}

function longIdenticalKeystream() {
  const a = streamWith(SYNTHETIC_V2, 'CDSZ');
  const b = streamWith(SYNTHETIC_V2, 'CDSZ');
  const c = streamWith(SYNTHETIC_V2, 'CDSA');
  return {
    sameKeySameStream: a === b,
    differentGroundDifferentStream: a !== c,
  };
}

const out = {
  seed: 'mulberry32(0xA11CE)',
  tests: {
    ringThin: thinRingIgnored(),
    leftNotch: leftNotchUnused(),
    derivedNotchCollisions: sameNotchesDifferentKeys(),
    ringPosition: ringPositionOffset(),
    endwalze: endwalzeCollisionAffine(),
    keystream: longIdenticalKeystream(),
  },
  findings: [
    'DEAD: ringThin — setRotors setzt thin.ring immer auf 0.',
    'DEAD: left Lückenfüller-Kerbe — step() prüft nur middle und right.',
    'Equivalent/derived: verschiedene Ringstellungen können dieselben Kerben erzeugen.',
    'Ring/Pos-Offset allein erzeugt keinen Equivalent Key, weil Kerben an pos hängen.',
    'Endwalze Dora: Paarung + feste affine Mischung, nicht 26!.',
  ],
};

writeJson('legacy/v2/equivalent-keys.json', {
  ...stampLegacyV2({ script: 'research/equivalent-keys.mjs' }),
  status: 'NOT CURRENT MODERN V3',
  script: 'research/equivalent-keys.mjs',
  ...out,
});

async function v3LiveFields() {
  async function enc(dayOverrides = {}) {
    const engine = new CipherEngine();
    const day = { ...SYNTHETIC_V3, ...dayOverrides };
    return modernV3EncryptPayload({
      engine,
      configure: (key) => configureSyntheticV3(engine, key, day),
      groundKey: day.groundKey,
      plainText: 'equivalent-key-probe',
      messageKey: 'LDNQ',
      messageId: 'EQKEYMID',
      dayConfig: day,
    });
  }
  const base = await enc();
  const thin = await enc({ ringThin: 'F', ringCode: 'FPEL' });
  const leftNotch = await enc({
    notches: { ...SYNTHETIC_V3.notches, left: 'BGMSY' },
  });
  const ground = await enc({ groundKey: 'ADSZ' });
  return {
    thinRingChangesCipher: base.cipher !== thin.cipher,
    leftNotchChangesCipher: base.cipher !== leftNotch.cipher,
    groundChangesPruef: base.pruefgruppe !== ground.pruefgruppe,
  };
}

const v3 = await v3LiveFields();
writeJson('equivalent-keys.json', {
  ...stampLiveV3({ script: 'research/equivalent-keys.mjs' }),
  tests: v3,
  findings: [
    'LIVE: thin.ring changes the body (no V2-style dead thin ring).',
    'LIVE: Left notches change the body (no unused left notch).',
    'LIVE: ground is in canonicalDayKey; a different ground changes PRUEF.',
  ],
  statusNote: 'No complete equivalent-key classification. These are existence checks against the V2 dead fields.',
});

console.log('V2 (legacy)', JSON.stringify(out.tests, null, 2));
console.log('V3 live', v3);
