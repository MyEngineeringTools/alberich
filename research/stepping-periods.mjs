#!/usr/bin/env node
/**
 * Walzenperioden der aktuellen step()-Maschine und optional Modern V3.
 * Empirisch, nicht „teilerfremd zu 26 ⇒ gut“.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  LUECKENFUELLER_NOTCH_COUNTS,
  baseNotchPattern,
  rotateNotchPattern,
} from '../web/js/modern-crypto.js';
import { writeJson, packPositions } from './lib.mjs';

const COUNTS = LUECKENFUELLER_NOTCH_COUNTS;

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

/**
 * Periode + Transient vom Startzustand.
 * State = (thin,left,middle,right) in 26^4.
 */
function measureFrom(engine, maxSteps = 26 ** 4 + 26) {
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

function currentImplPeriods() {
  const engine = new CipherEngine();
  engine.setCryptoMode('modern');
  engine.setRotors('I', 'II', 'III', 'Beta', 'A', 'A', 'A', 'A', 'A', 'A', 'A');

  const periodSet = new Map();
  const samples = [];

  // Left notches unused — still vary counts for documentation.
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
    note: 'Aktuelle step(): Right immer, Middle bei Right-Kerbe, Left+Middle bei Middle-Kerbe. Left-Kerbe ungenutzt. Thin steht.',
    configs: 3 * 3 * 26 * 26,
    distinctPeriods: periods.map((p) => p.period),
    histogram: periods,
    sampleAAA: samples,
  };
}

async function v3PeriodsIfPresent() {
  try {
    const v3 = await import('../web/js/modern-v3.js');
    if (typeof v3.measureV3Stepping !== 'function') {
      const engine = new CipherEngine();
      engine.setCryptoMode('modern');
      if (typeof engine.setModernProtocol === 'function') {
        engine.setModernProtocol('v3');
      }
      engine.setRotors('I', 'II', 'III', 'Beta', 'A', 'A', 'A', 'A', 'A', 'A', 'A');
      const counts = [];
      const hist = new Map();
      for (const cL of COUNTS) {
        for (const cM of COUNTS) {
          for (const cR of COUNTS) {
            applyNotches(
              engine,
              baseNotchPattern(cL),
              baseNotchPattern(cM),
              baseNotchPattern(cR),
            );
            resetPos(engine);
            const m = measureFrom(engine);
            counts.push(m.period);
            hist.set(m.period, (hist.get(m.period) || 0) + 1);
          }
        }
      }
      const sorted = [...counts].filter((x) => x != null).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return {
        available: true,
        theoreticalStateSpace: 26 ** 4,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
        histogram: [...hist.entries()]
          .map(([period, count]) => ({ period, count }))
          .sort((a, b) => a.period - b.period),
        fractionOfStateSpaceMin: sorted[0] / 26 ** 4,
        fractionOfStateSpaceMax: sorted[sorted.length - 1] / 26 ** 4,
        note: 'Nur gleichmäßige Basis-Muster {5,7,9}, Start AAAA. Zufällige Teilmengen separat in V3-Tests.',
      };
    }
    return { available: true, ...(await v3.measureV3Stepping()) };
  } catch {
    return { available: false, note: 'modern-v3.js noch nicht geladen — nur Ist-Messung.' };
  }
}

function verifyExpected(got, expected) {
  const set = new Set(got);
  return {
    allExpectedPresent: expected.every((p) => set.has(p)),
    extraPeriods: got.filter((p) => !expected.includes(p)),
    missingExpected: expected.filter((p) => !set.has(p)),
  };
}

if (process.argv.includes('--smoke')) {
  const engine = new CipherEngine();
  engine.setCryptoMode('modern');
  engine.setRotors('I', 'II', 'III', 'Beta', 'A', 'A', 'A', 'A', 'A', 'A', 'A');
  applyNotches(engine, baseNotchPattern(5), baseNotchPattern(7), baseNotchPattern(9));
  resetPos(engine);
  const sample = measureFrom(engine, 20_000);
  const v3 = await import('../web/js/modern-v3.js');
  if (typeof v3.generateEndwalzeWiring !== 'function') {
    throw new Error('modern-v3 import failed');
  }
  console.log(`smoke ok period=${sample.period} v3=${typeof v3.canonicalDayKey}`);
  process.exit(0);
}

const current = currentImplPeriods();
const v3 = await v3PeriodsIfPresent();
const expectedCurrentBallpark = [2028, 4732, 11492, 12844, 14196];
const verifiedExpected = verifyExpected(current.distinctPeriods, expectedCurrentBallpark);

const out = {
  generatedAt: new Date().toISOString(),
  expectedCurrentBallpark,
  current,
  verifiedExpected,
  modernV3: v3,
};

writeJson('stepping-periods.json', out);
console.log('Current distinct periods:', current.distinctPeriods);
console.log('Verify:', out.verifiedExpected);
console.log('V3:', v3.available ? `min=${v3.min} max=${v3.max} median=${v3.median}` : v3.note);
