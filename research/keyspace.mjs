#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Modern V3 Standard Profile keyspace, split into support / Shannon /
 * min-entropy / equivalent-key notes / best demonstrated attack.
 * Never: "248-bit keyspace = 248-bit security".
 */
import {
  factorial,
  bitsOf,
  writeJson,
  wantsSmoke,
  stampLiveV3,
  stampLegacyV2,
  lueckenfuellerEntropy,
  involutionCount,
} from './lib.mjs';

const FACT_26 = factorial(26);
const I26 = involutionCount(26);
const ENDWALZE_SUPPORT = FACT_26 - I26;

function pairings(k) {
  return FACT_26 / (2n ** BigInt(k) * factorial(k) * factorial(26 - 2 * k));
}

function row(name, value, note) {
  return {
    name,
    count: typeof value === 'bigint' ? value.toString() : String(value),
    bits: typeof value === 'bigint' ? Number(bitsOf(value).toFixed(6)) : Number(value),
    note,
  };
}

if (wantsSmoke()) {
  const notches = lueckenfuellerEntropy();
  const endBits = bitsOf(ENDWALZE_SUPPORT);
  if (!(notches.supportAllBits > 65 && notches.supportAllBits < 66)) {
    throw new Error(`notch support bits drifted: ${notches.supportAllBits}`);
  }
  if (!(notches.minEntropyAllBits > 52 && notches.minEntropyAllBits < 53)) {
    throw new Error(`notch min-entropy drifted: ${notches.minEntropyAllBits}`);
  }
  if (!(notches.shannonAllBits > 61.6 && notches.shannonAllBits < 61.7)) {
    throw new Error(`notch Shannon drifted: ${notches.shannonAllBits}`);
  }
  if (!(endBits > 88.38 && endBits < 88.382)) {
    throw new Error(`endwalze bits drifted: ${endBits}`);
  }
  if (I26 >= FACT_26) throw new Error('involution count impossible');
  console.log(
    `smoke ok keyspace notchesSupport=${notches.supportAllBits} notchesH=${notches.shannonAllBits} notchesMin=${notches.minEntropyAllBits} end=${endBits.toFixed(6)}`,
  );
  process.exit(0);
}

const rotorChoice = 2n * (8n * 7n * 6n);
const plug10 = pairings(10);
const rings = 26n ** 4n;
const ground = 26n ** 4n;
const messageKey = 26n ** 4n;
const mid = 26n ** 8n;
const notches = lueckenfuellerEntropy();
const notchSupport = BigInt(notches.supportAll);

const supportDay =
  rotorChoice * plug10 * ENDWALZE_SUPPORT * rings * ground * notchSupport;

const out = {
  ...stampLiveV3({ script: 'research/keyspace.mjs' }),
  disclaimer: {
    support: 'A — number of representable Standard-Profile configurations.',
    shannon: 'B — entropy of the actual generators (notch mixture; Endwalze rejection sampling).',
    minEntropy: 'C — −log2 of the most likely generator output.',
    equivalent: 'D — known dead/equivalent fields only. No complete classification.',
    attack: 'E — from research/results/v3-attacks.json, not from bit counting.',
    securityProof: 'none',
    notClaimed: [
      'AES-128-Äquivalenz',
      '248-bit security',
      'NIST-Sicherheit',
      'support bits = attack complexity',
    ],
  },
  layers: {
    A_supportSize: {
      components: [
        row('rotorSelection', rotorChoice, '2 Thin × P(8,3)'),
        row('rings', rings, 'four live ring letters including Thin'),
        row('ground', ground, 'four ground letters, bound into canonicalDayKey'),
        row('plugboard10', plug10, '10 disjoint unordered pairs'),
        row('endwalzeNonInvolutory', ENDWALZE_SUPPORT, '26! − I(26)'),
        row('lueckenfuellerSupport', notchSupport, 'three independent rotors; see mixture below'),
      ],
      dayKey: row('dayKeySupport', supportDay, 'product of the components above; not security bits'),
      perMessage: [
        row('messageKey', messageKey, '4-letter rotor start; birthday ~ √(26^4)'),
        row('messageId', mid, '8 letters, not a rotor, visible in the telegram'),
      ],
    },
    B_shannonEntropy: {
      endwalzeBits: Number(bitsOf(ENDWALZE_SUPPORT).toFixed(6)),
      endwalzeNote: 'Rejection sampling of involutions is uniform on the allowed set.',
      lueckenfueller: {
        perRotor: notches.shannonOneBits,
        threeRotors: notches.shannonAllBits,
      },
      note: 'Rotor choice, rings, ground and the plugboard are treated as uniform on their support.',
    },
    C_minEntropy: {
      lueckenfueller: {
        perRotor: notches.minEntropyOneBits,
        threeRotors: notches.minEntropyAllBits,
        mostProbableCount: notches.mostProbableCount,
      },
      endwalzeBits: Number(bitsOf(ENDWALZE_SUPPORT).toFixed(6)),
    },
    D_equivalentKeyAdjusted: {
      status: 'PARTIAL',
      liveV3: {
        thinRingLive: true,
        leftNotchesLive: true,
        groundInMac: true,
        knownDeadFields: [],
      },
      legacyV2: {
        ...stampLegacyV2({ script: 'research/keyspace.mjs' }),
        thinRingDead: true,
        leftNotchUnused: true,
        derivedNotches: true,
      },
    },
    E_bestDemonstratedAttack: {
      status: 'PARTIAL',
      pointer: 'research/results/v3-attacks.json',
      note: 'HMAC is a perfect offline candidate oracle. No practical full day-key recovery is implemented.',
    },
  },
  endwalze: {
    factorial26: FACT_26.toString(),
    factorial26Bits: Number(bitsOf(FACT_26).toFixed(6)),
    involutionsI26: I26.toString(),
    involutionsBits: Number(bitsOf(I26).toFixed(6)),
    nonInvolutory: ENDWALZE_SUPPORT.toString(),
    nonInvolutoryBits: Number(bitsOf(ENDWALZE_SUPPORT).toFixed(6)),
    gapBits: Number((bitsOf(FACT_26) - bitsOf(ENDWALZE_SUPPORT)).toFixed(12)),
    note: 'The deviation from 26! is practically negligible in bits and scientifically not zero.',
  },
  lueckenfueller: notches,
  formalSecurityProof: 'none',
};

writeJson('keyspace.json', out);

const fmt = (r) => `  ${r.name.padEnd(28)} ${r.bits.toFixed(2).padStart(8)} bit`;
console.log('=== Modern V3 Standard keyspace ===');
console.log('A support');
for (const r of out.layers.A_supportSize.components) console.log(fmt(r));
console.log(fmt(out.layers.A_supportSize.dayKey));
console.log('B notch Shannon', notches.shannonAllBits, 'C notch min-entropy', notches.minEntropyAllBits);
console.log('Endwalze 26!-I(26)', out.endwalze.nonInvolutoryBits, 'gap bits', out.endwalze.gapBits);
console.log('Formal proof: none');
console.log('wrote research/results/keyspace.json');
