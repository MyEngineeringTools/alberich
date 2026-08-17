#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Measure V3 stepping: live double-step vs research cascade.
 */
import {
  generateLueckenfueller,
  nextV3Positions,
  nextV3PositionsCascade,
} from '../web/js/modern-v3.js';
import { mulberry32, seededInt, wantsSmoke, writeJson } from './lib.mjs';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SPACE = 26 ** 4;

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

function bijectionCheck(kind, notches) {
  const seen = new Uint8Array(SPACE);
  let collisions = 0;
  let images = 0;
  for (let i = 0; i < SPACE; i++) {
    const nxt = pack(nextOf(kind, unpack(i), notches));
    if (seen[nxt]) collisions += 1;
    else {
      seen[nxt] = 1;
      images += 1;
    }
  }
  return { bijective: collisions === 0 && images === SPACE, collisions, images };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function summarize(cycles) {
  const s = [...cycles].filter((n) => n != null).sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? null,
    p1: percentile(s, 1),
    p5: percentile(s, 5),
    p25: percentile(s, 25),
    median: percentile(s, 50),
    p75: percentile(s, 75),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: s[s.length - 1] ?? null,
  };
}

function rngNotches(rng) {
  const nextInt = (max) => seededInt(rng, max);
  return generateLueckenfueller(nextInt);
}

const smoke = wantsSmoke();
const walks = smoke ? 4 : 10_000;
const bijections = smoke ? 1 : 8;
const rng = mulberry32(0x51e9);

const out = {
  generatedAt: new Date().toISOString(),
  space: SPACE,
  walks,
  bijections,
  note:
    'Live V3 uses double-step (Rev 47). Cascade is research only. A full period is not a security proof.',
  liveRule: 'double-step',
  cascade: { cycles: [], transients: [], bijections: [] },
  doubleStep: { cycles: [], transients: [], bijections: [] },
};

for (let i = 0; i < walks; i++) {
  const notches = rngNotches(rng);
  for (const kind of ['cascade', 'doubleStep']) {
    const w = walk(kind, notches);
    const bucket = kind === 'cascade' ? out.cascade : out.doubleStep;
    bucket.cycles.push(w.cycle);
    bucket.transients.push(w.transient);
  }
}

for (let i = 0; i < bijections; i++) {
  const notches = rngNotches(rng);
  out.cascade.bijections.push(bijectionCheck('cascade', notches));
  if (!smoke) out.doubleStep.bijections.push(bijectionCheck('doubleStep', notches));
}

function report(label, bucket) {
  const cycleStats = summarize(bucket.cycles);
  const transientStats = summarize(bucket.transients);
  const bij = bucket.bijections;
  return {
    label,
    cycle: cycleStats,
    transient: transientStats,
    bijection: {
      samples: bij.length,
      allBijective: bij.length ? bij.every((b) => b.bijective) : null,
    },
  };
}

const result = {
  ...out,
  cascade: report('cascade', out.cascade),
  doubleStep: report('doubleStep', out.doubleStep),
  decision:
    'Live stays double-step for published 47 interop. Cascade remains research: invertible, often full 26^4, but it is not the shipped protocol. Traditional M4 is unchanged.',
};

if (!smoke) writeJson('state-graph.json', result);
console.log(
  smoke
    ? `smoke ok cascadeBij=${result.cascade.bijection.allBijective} cycle=${result.cascade.cycle.median}`
    : JSON.stringify(
        {
          cascade: result.cascade,
          doubleStep: result.doubleStep,
          decision: result.decision,
        },
        null,
        2,
      ),
);
