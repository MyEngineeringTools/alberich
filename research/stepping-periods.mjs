#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Period measurements, labelled by protocol and step rule.
 *
 *   --smoke  one cheap sample of each rule
 *   --full   write current + legacy result files
 */
import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  LUECKENFUELLER_NOTCH_COUNTS,
  baseNotchPattern,
  rotateNotchPattern,
} from '../web/js/modern-crypto.js';
import { generateLueckenfueller, nextV3Positions, nextV3PositionsCascade } from '../web/js/modern-v3.js';
import {
  mulberry32,
  seededInt,
  writeJson,
  packPositions,
  stampLiveV3,
  stampCascadeFuture,
  stampLegacyV2,
} from './lib.mjs';

const COUNTS = LUECKENFUELLER_NOTCH_COUNTS;
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SPACE = 26 ** 4;

function applyNotches(engine, left, middle, right) {
  engine.rotors.left.notch = left;
  engine.rotors.middle.notch = middle;
  engine.rotors.right.notch = right;
}

function resetPos(engine, t = 0, l = 0, m = 0, r = 0) {
  engine.rotors.thin.pos = t;
  engine.rotors.left.pos = l;
  engine.rotors.middle.pos = m;
  engine.rotors.right.pos = r;
}

function measureFrom(engine, maxSteps = SPACE + 26) {
  const start = packPositions(engine);
  const seen = new Map();
  seen.set(start, 0);
  for (let i = 1; i <= maxSteps; i++) {
    engine.step();
    const s = packPositions(engine);
    if (seen.has(s)) {
      const first = seen.get(s);
      return {
        firstRepeatAt: i,
        transient: first,
        period: i - first,
        returnedToStart: s === start,
      };
    }
    seen.set(s, i);
  }
  return { firstRepeatAt: null, transient: null, period: null, returnedToStart: false };
}

function pack(p) {
  return ((p.thin * 26 + p.left) * 26 + p.middle) * 26 + p.right;
}

function nextOf(fn, pos, notches) {
  const flags = {
    left: notches.left.includes(AZ[pos.left]),
    middle: notches.middle.includes(AZ[pos.middle]),
    right: notches.right.includes(AZ[pos.right]),
  };
  return fn(pos, flags);
}

function walkFn(fn, notches, start = { thin: 0, left: 0, middle: 0, right: 0 }) {
  const seen = new Map();
  let pos = { ...start };
  for (let i = 0; i <= SPACE + 4; i++) {
    const id = pack(pos);
    if (seen.has(id)) {
      return { transient: seen.get(id), period: i - seen.get(id), firstRepeatAt: i };
    }
    seen.set(id, i);
    pos = nextOf(fn, pos, notches);
  }
  return { transient: null, period: null, firstRepeatAt: null };
}

/** Legacy three-wheel modern step: Thin parked, Left notch unused. NOT live V3. */
function legacyThreeWheelPeriods() {
  const engine = new CipherEngine();
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v2');
  engine.setRotors('I', 'II', 'III', 'Beta', 'A', 'A', 'A', 'A', 'A', 'A', 'A');

  const periodSet = new Map();
  const samples = [];

  for (const cM of COUNTS) {
    for (const cR of COUNTS) {
      const baseM = baseNotchPattern(cM);
      const baseR = baseNotchPattern(cR);
      const baseL = baseNotchPattern(5);
      for (let sM = 0; sM < 26; sM += 1) {
        for (let sR = 0; sR < 26; sR += 1) {
          applyNotches(
            engine,
            rotateNotchPattern(baseL, 0),
            rotateNotchPattern(baseM, sM),
            rotateNotchPattern(baseR, sR),
          );
          resetPos(engine);
          const m = measureFrom(engine);
          const key = String(m.period);
          periodSet.set(key, (periodSet.get(key) || 0) + 1);
        }
      }
      resetPos(engine);
      applyNotches(engine, baseL, baseM, baseR);
      samples.push({
        counts: { middle: cM, right: cR },
        fromAAA: measureFrom(engine),
      });
    }
  }

  const periods = [...periodSet.entries()]
    .map(([period, count]) => ({ period: Number(period), count }))
    .sort((a, b) => a.period - b.period);

  return {
    protocol: 'V2 / V3 legacy step rule',
    stepRule: 'Right always; Middle on Right notch; Left+Middle on Middle notch; Left notch unused; Thin stands',
    current: false,
    status: 'NOT CURRENT',
    note: 'These periods describe the old three-wheel modern step. They do not describe live V3 double-step and they do not describe the cascade future option.',
    configs: 3 * 3 * 26 * 26,
    distinctPeriods: periods.map((p) => p.period),
    histogram: periods,
    sampleAAA: samples,
  };
}

function summarize(periods) {
  const s = [...periods].filter((n) => n != null).sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const hist = new Map();
  for (const p of s) hist.set(p, (hist.get(p) || 0) + 1);
  return {
    n: s.length,
    min: s[0] ?? null,
    max: s[s.length - 1] ?? null,
    median: s.length ? (s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) : null,
    histogram: [...hist.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period - b.period),
  };
}

function liveAndCascadePeriods(full) {
  const rng = mulberry32(0x7a11);
  const live = [];
  const cascade = [];
  const placements = process.argv.includes('--exhaustive') ? 3 : 1;

  for (const left of COUNTS) {
    for (const middle of COUNTS) {
      for (const right of COUNTS) {
        for (let p = 0; p < placements; p++) {
          const notches = generateLueckenfueller((max) => seededInt(rng, max));
          live.push({
            counts: { left, middle, right },
            placement: p,
            ...walkFn(nextV3Positions, notches),
          });
          cascade.push({
            counts: { left, middle, right },
            placement: p,
            ...walkFn(nextV3PositionsCascade, notches),
          });
        }
      }
    }
  }

  return {
    liveDoubleStep: {
      protocol: 'Modern V3',
      stepRule: 'double-step',
      stepRuleDetail:
        'Right always; Right notch → Middle; Middle notch → Left and Middle; Left notch → Thin and Left',
      current: true,
      status: 'CURRENT',
      theoreticalStateSpace: SPACE,
      ...summarize(live.map((x) => x.period)),
      samples: live,
      note: 'Live V3 (Rev 47+). Double-step is not bijective; periods are typically much smaller than 26^4.',
    },
    cascadeFuture: {
      protocol: 'V3 cascade (future option)',
      stepRule: 'pure carry / Lückenfüller cascade',
      current: false,
      status: 'NOT LIVE',
      theoreticalStateSpace: SPACE,
      ...summarize(cascade.map((x) => x.period)),
      samples: cascade,
      note: 'Research only. Invertible; with notch counts {5,7,9} sampled orbits have period 26^4. See docs/crypto-spec/cascade-future.md.',
    },
  };
}

if (process.argv.includes('--smoke')) {
  const engine = new CipherEngine();
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v2');
  engine.setRotors('I', 'II', 'III', 'Beta', 'A', 'A', 'A', 'A', 'A', 'A', 'A');
  applyNotches(engine, baseNotchPattern(5), baseNotchPattern(7), baseNotchPattern(9));
  resetPos(engine);
  const legacy = measureFrom(engine, 20_000);

  const notches = generateLueckenfueller(() => 0);
  const live = walkFn(nextV3Positions, notches);
  const cascade = walkFn(nextV3PositionsCascade, notches);
  if (legacy.period == null || live.period == null || cascade.period == null) {
    throw new Error('smoke period measurement failed');
  }
  console.log(
    `smoke ok legacy=${legacy.period} liveDoubleStep=${live.period} cascade=${cascade.period}`,
  );
  process.exit(0);
}

const exhaustive = process.argv.includes('--exhaustive');
const full = process.argv.includes('--full') || exhaustive || !process.argv.includes('--smoke');
const legacy = exhaustive ? legacyThreeWheelPeriods() : null;
const { liveDoubleStep, cascadeFuture } = liveAndCascadePeriods(full);

const expectedLegacyBallpark = [2028, 4732, 11492, 12844, 14196];
const verifiedLegacy = legacy
  ? {
      allExpectedPresent: expectedLegacyBallpark.every((p) => legacy.distinctPeriods.includes(p)),
      extraPeriods: legacy.distinctPeriods.filter((p) => !expectedLegacyBallpark.includes(p)),
      missingExpected: expectedLegacyBallpark.filter((p) => !legacy.distinctPeriods.includes(p)),
    }
  : { skipped: true, reason: 'legacy three-wheel walks run only with --exhaustive' };

const current = {
  ...stampLiveV3({ script: 'research/stepping-periods.mjs' }),
  space: SPACE,
  expectedPeriod: SPACE,
  observedPeriod: liveDoubleStep.median,
  bijective: false,
  transient: 'present (double-step is not injective)',
  coverage: liveDoubleStep.max === SPACE ? 1 : liveDoubleStep.max / SPACE,
  liveDoubleStep,
  note: 'Live Modern V3 is double-step. Typical periods are much smaller than 26^4. Cascade numbers are not current.',
};

const cascadeFile = {
  ...stampCascadeFuture({ script: 'research/stepping-periods.mjs' }),
  space: SPACE,
  expectedPeriod: SPACE,
  observedPeriod: cascadeFuture.median,
  bijective: cascadeFuture.min === SPACE && cascadeFuture.max === SPACE,
  transient: 0,
  coverage: cascadeFuture.min === SPACE ? 1 : cascadeFuture.max / SPACE,
  cascadeFuture,
};

if (legacy) {
  writeJson('legacy/v2/stepping-periods.json', {
    ...stampLegacyV2({ script: 'research/stepping-periods.mjs' }),
    status: 'NOT CURRENT MODERN V3',
    expectedLegacyBallpark,
    measurement: legacy,
    verifiedExpected: verifiedLegacy,
  });
}
writeJson('future/cascade-stepping.json', cascadeFile);
writeJson('v3-stepping-current.json', current);
writeJson('stepping-periods.json', current);

if (legacy) {
  console.log('Legacy distinct periods:', legacy.distinctPeriods);
  console.log('Legacy verify:', verifiedLegacy);
} else {
  console.log('Legacy three-wheel walks skipped (use --exhaustive)');
}
console.log(
  'Live V3 double-step:',
  `min=${liveDoubleStep.min} median=${liveDoubleStep.median} max=${liveDoubleStep.max}`,
);
console.log(
  'Cascade (not live):',
  `min=${cascadeFuture.min} median=${cascadeFuture.median} max=${cascadeFuture.max}`,
);
