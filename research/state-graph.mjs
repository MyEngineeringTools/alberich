#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * V3 state-graph measurements.
 *
 * Live protocol is four-rotor double-step (Rev 47+). The pure notch cascade
 * is a future option only — see docs/crypto-spec/cascade-future.md.
 *
 *   node research/state-graph.mjs --smoke   # CI
 *   node research/state-graph.mjs --full    # committed results
 */
import {
  generateLueckenfueller,
  nextV3Positions,
  nextV3PositionsCascade,
} from '../web/js/modern-v3.js';
import { mulberry32, seededInt, writeJson, stampLiveV3, stampCascadeFuture } from './lib.mjs';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SPACE = 26 ** 4;
const COUNTS = [5, 7, 9];

function pack(p) {
  return ((p.thin * 26 + p.left) * 26 + p.middle) * 26 + p.right;
}

function unpack(n) {
  const right = n % 26;
  n = (n - right) / 26;
  const middle = n % 26;
  n = (n - middle) / 26;
  const left = n % 26;
  const thin = (n - left) / 26;
  return { thin, left, middle, right };
}

function notchAt(set, pos) {
  return set.includes(AZ[pos]);
}

function flags(pos, notches) {
  return {
    left: notchAt(notches.left, pos.left),
    middle: notchAt(notches.middle, pos.middle),
    right: notchAt(notches.right, pos.right),
  };
}

function nextOf(kind, pos, notches) {
  const fn = kind === 'cascade' ? nextV3PositionsCascade : nextV3Positions;
  return fn(pos, flags(pos, notches));
}

/**
 * Reconstruct the unique predecessor of a cascade state.
 * Notches are read on the *old* positions, so we peel the odometer backwards.
 */
function prevCascade(pos, notches) {
  const right = (pos.right + 25) % 26;
  const middleMoved = notchAt(notches.right, right);
  const middle = middleMoved ? (pos.middle + 25) % 26 : pos.middle;
  const leftMoved = middleMoved && notchAt(notches.middle, middle);
  const left = leftMoved ? (pos.left + 25) % 26 : pos.left;
  const thinMoved = leftMoved && notchAt(notches.left, left);
  const thin = thinMoved ? (pos.thin + 25) % 26 : pos.thin;
  return { thin, left, middle, right };
}

function samePos(a, b) {
  return a.thin === b.thin && a.left === b.left && a.middle === b.middle && a.right === b.right;
}

function invertibilityCheck(notches) {
  for (let i = 0; i < SPACE; i++) {
    const pos = unpack(i);
    const nxt = nextOf('cascade', pos, notches);
    const back = prevCascade(nxt, notches);
    if (!samePos(back, pos)) {
      return { invertible: false, failedAt: i };
    }
  }
  return { invertible: true, failedAt: null };
}

function bijectionCheck(kind, notches) {
  const indeg = new Uint16Array(SPACE);
  let collisions = 0;
  let images = 0;
  for (let i = 0; i < SPACE; i++) {
    const nxt = pack(nextOf(kind, unpack(i), notches));
    if (indeg[nxt]) collisions += 1;
    else images += 1;
    indeg[nxt] += 1;
  }
  let indegree1 = 0;
  let indegree0 = 0;
  let indegreeMax = 0;
  for (let i = 0; i < SPACE; i++) {
    if (indeg[i] === 1) indegree1 += 1;
    if (indeg[i] === 0) indegree0 += 1;
    if (indeg[i] > indegreeMax) indegreeMax = indeg[i];
  }
  return {
    states: SPACE,
    uniqueSuccessors: images,
    collisions,
    indegree1,
    indegree0,
    indegreeMax,
    bijective: collisions === 0 && images === SPACE && indegree1 === SPACE,
  };
}

function walk(kind, notches, start = { thin: 0, left: 0, middle: 0, right: 0 }) {
  const seen = new Map();
  let pos = { ...start };
  for (let i = 0; i <= SPACE + 4; i++) {
    const id = pack(pos);
    if (seen.has(id)) {
      const first = seen.get(id);
      return { transient: first, cycle: i - first, steps: i };
    }
    seen.set(id, i);
    pos = nextOf(kind, pos, notches);
  }
  return { transient: null, cycle: null, steps: SPACE + 4 };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function summarize(values) {
  const s = [...values].filter((n) => n != null).sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? null,
    p5: percentile(s, 5),
    p25: percentile(s, 25),
    median: percentile(s, 50),
    p75: percentile(s, 75),
    p95: percentile(s, 95),
    max: s[s.length - 1] ?? null,
  };
}

function countCombos() {
  const out = [];
  for (const left of COUNTS) {
    for (const middle of COUNTS) {
      for (const right of COUNTS) out.push({ left, middle, right });
    }
  }
  return out;
}

function rngNotches(rng) {
  return generateLueckenfueller((max) => seededInt(rng, max));
}

function parseArgs(argv) {
  const exhaustive = argv.includes('--exhaustive');
  const full = argv.includes('--full') || exhaustive;
  const smoke = argv.includes('--smoke') || !full;
  return { smoke, full, exhaustive };
}

const { smoke, full, exhaustive } = parseArgs(process.argv);
const rng = mulberry32(0x51e9);
const combos = countCombos();
const placementsPerCombo = exhaustive ? 3 : 1;
const extraDoubleStepSamples = exhaustive ? 24 : full ? 3 : 2;
const extraStarts = exhaustive ? 4 : 0;
const invertCombos = smoke
  ? combos.filter((c) => c.left === c.middle && c.middle === c.right)
  : combos;
const fullCascadeMaps = exhaustive
  ? combos
  : smoke
    ? invertCombos
    : combos.filter((c) => c.left === 5 && c.middle === 5 && c.right === 5
      || c.left === 7 && c.middle === 7 && c.right === 7
      || c.left === 9 && c.middle === 9 && c.right === 9);

const cascade = {
  invertibility: [],
  bijections: [],
  periods: [],
  fullPeriodCount: 0,
};
const doubleStep = {
  bijections: [],
  periods: [],
  bijectiveCount: 0,
};

for (const counts of invertCombos) {
  for (let p = 0; p < placementsPerCombo; p++) {
    const notches = rngNotches(rng);
    const expensive = exhaustive || fullCascadeMaps.some(
      (c) => c.left === counts.left && c.middle === counts.middle && c.right === counts.right,
    );
    const inv = invertibilityCheck(notches);
    cascade.invertibility.push({ counts, ...inv });
    if (!inv.invertible) {
      throw new Error(`cascade predecessor reconstruction failed for ${JSON.stringify(counts)}`);
    }

    if (expensive) {
      const bij = bijectionCheck('cascade', notches);
      cascade.bijections.push({ counts, ...bij });
      if (!bij.bijective) {
        throw new Error(`cascade was not bijective for ${JSON.stringify(counts)}`);
      }
      const w = walk('cascade', notches);
      cascade.periods.push({ counts, ...w });
      if (w.cycle === SPACE && w.transient === 0) cascade.fullPeriodCount += 1;
      for (let s = 0; s < extraStarts; s++) {
        const start = unpack(seededInt(rng, SPACE));
        const fromStart = walk('cascade', notches, start);
        if (fromStart.cycle !== w.cycle && fromStart.cycle !== null) {
          cascade.periods.push({ counts, start: pack(start), ...fromStart, note: 'extra-start' });
        }
      }
    }
  }
}

const dsCombos = exhaustive ? combos : combos.filter((_, i) => i % 3 === 0);
for (const counts of dsCombos) {
  const notches = rngNotches(rng);
  if (exhaustive || counts.left === counts.middle) {
    const bij = bijectionCheck('doubleStep', notches);
    doubleStep.bijections.push({ counts, ...bij });
    if (bij.bijective) doubleStep.bijectiveCount += 1;
  }
  const w = walk('doubleStep', notches);
  doubleStep.periods.push({ counts, ...w });
}

for (let i = 0; i < extraDoubleStepSamples; i++) {
  const notches = rngNotches(rng);
  doubleStep.periods.push({ sample: i, ...walk('doubleStep', notches) });
}

const gcdNote = COUNTS.map((n) => `gcd(${n},26)=${gcd(n, 26)}`).join(', ');

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

const liveBij = doubleStep.bijections[0] || null;
const result = {
  ...stampLiveV3({ script: 'research/state-graph.mjs' }),
  liveStepRule: 'double-step',
  cascadeStatus: 'NOT LIVE — future option',
  space: SPACE,
  mode: full ? 'full' : 'smoke',
  placementsPerCombo,
  note:
    'Live V3 is double-step. The 26^4 single-cycle claim is for the cascade future option only and is not a security proof.',
  gcd: gcdNote,
  live: {
    states: SPACE,
    uniqueSuccessors: liveBij?.uniqueSuccessors ?? null,
    indegree1: liveBij?.indegree1 ?? null,
    cycles: 'many (sampled)',
    cycleLength: summarize(doubleStep.periods.map((p) => p.cycle)),
    transient: summarize(doubleStep.periods.map((p) => p.transient)),
    coverage: null,
    bijection: full
      ? {
          samples: doubleStep.bijections.length,
          bijectiveCount: doubleStep.bijectiveCount,
          allBijective: doubleStep.bijectiveCount === doubleStep.bijections.length,
          typical: liveBij,
        }
      : { samples: 0, note: 'smoke skips exhaustive double-step image counts' },
    period: summarize(doubleStep.periods.map((p) => p.cycle)),
    statement: 'Double-step is not injective. Typical cycles are much shorter than 26^4.',
  },
  cascadeFuture: {
    ...stampCascadeFuture({ script: 'research/state-graph.mjs' }),
    invertibility: {
      samples: cascade.invertibility.length,
      allInvertible: cascade.invertibility.every((x) => x.invertible),
    },
    bijection: {
      samples: cascade.bijections.length,
      allBijective: cascade.bijections.every((x) => x.bijective),
      typical: cascade.bijections[0] || null,
    },
    period: summarize(cascade.periods.map((p) => p.cycle)),
    fullPeriodCount: cascade.fullPeriodCount,
    fullPeriodFraction:
      cascade.fullPeriodCount / cascade.periods.filter((p) => p.note !== 'extra-start').length,
    cycles: cascade.fullPeriodCount === cascade.periods.filter((p) => p.note !== 'extra-start').length ? 1 : 'mixed',
    cycleLength: SPACE,
    transient: 0,
    coverage: 1,
    proof: 'docs/crypto-spec/cascade-future.md',
  },
  doubleStep: {
    bijection: full
      ? {
          samples: doubleStep.bijections.length,
          bijectiveCount: doubleStep.bijectiveCount,
          allBijective: doubleStep.bijectiveCount === doubleStep.bijections.length,
        }
      : { samples: 0, note: 'smoke skips exhaustive double-step image counts' },
    period: summarize(doubleStep.periods.map((p) => p.cycle)),
    note: 'Double-step is not injective. Typical cycles are much shorter than 26^4.',
  },
  decision:
    'Current results describe live double-step. Cascade 26^4 is documented as a future option only.',
};
if (full) {
  writeJson('state-graph.json', result);
  writeJson('future/cascade-state-graph.json', result.cascadeFuture);
}

const cascadeOk =
  result.cascadeFuture.invertibility.allInvertible && result.cascadeFuture.bijection.allBijective;
if (!cascadeOk) {
  throw new Error('cascade invertibility/bijection check failed');
}

if (full && result.cascadeFuture.fullPeriodCount === 0) {
  throw new Error('cascade full-period samples were empty');
}

console.log(
  full
    ? JSON.stringify(
        {
          mode: result.mode,
          live: result.live,
          cascadeFuture: {
            invertibility: result.cascadeFuture.invertibility,
            bijection: result.cascadeFuture.bijection,
            period: result.cascadeFuture.period,
          },
          decision: result.decision,
        },
        null,
        2,
      )
    : `smoke ok liveMedian=${result.live.period.median} cascadeInvertible=${result.cascadeFuture.invertibility.allInvertible} cascadeBij=${result.cascadeFuture.bijection.allBijective} cascadeMedian=${result.cascadeFuture.period.median}`,
);
