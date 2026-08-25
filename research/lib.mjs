/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Gemeinsame Hilfen für das Modern-Research-Labor.
 *
 * Production keys use Web Crypto. Everything here that needs a stream of
 * numbers uses mulberry32 so checked-in results replay. Never wire this
 * generator into codebook or end-wheel production.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  deriveLueckenfuellerNotches,
  resolveEndwalzeWiring,
  utf8ToBase26,
} from '../web/js/modern-crypto.js';

export const RESEARCH_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(RESEARCH_DIR);
export const RESULTS_DIR = `${RESEARCH_DIR}/results`;
export const CORPUS_DIR = `${RESEARCH_DIR}/corpus`;

/** Files that define the live Modern V3 machine. A change here invalidates results.
 *  VERSIONS is the product display number, not the algorithm — a UI/CSS
 *  revision must not move the research fingerprint. */
export const ALGORITHM_SOURCE_FILES = Object.freeze([
  'web/js/cipher-data.js',
  'web/js/cipher-engine.js',
  'web/js/codebook-generate.js',
  'web/js/codebook.js',
  'web/js/limits.js',
  'web/js/modern-crypto.js',
  'web/js/modern-v3.js',
  'web/js/secure-random.js',
]);

export const LIVE_STEP_RULE = 'double-step';
export const LIVE_STEP_RULE_DETAIL =
  'Right always; Right notch → Middle; Middle notch → Left and Middle; Left notch → Thin and Left';

export function webRevision() {
  const text = readFileSync(`${REPO_ROOT}/VERSIONS`, 'utf8');
  const m = text.match(/^web\.revision=(\d+)/m);
  return m ? m[1] : 'unknown';
}

export function algorithmRevision() {
  return `modern-v3-rev${webRevision()}-double-step`;
}

export function fingerprintFromContents(files) {
  const h = createHash('sha256');
  for (const rel of ALGORITHM_SOURCE_FILES) {
    if (!(rel in files)) throw new Error(`missing algorithm source ${rel}`);
    h.update(rel);
    h.update('\0');
    h.update(files[rel]);
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

export function readAlgorithmSources(root = REPO_ROOT) {
  const files = {};
  for (const rel of ALGORITHM_SOURCE_FILES) {
    files[rel] = readFileSync(`${root}/${rel}`);
  }
  return files;
}

export function algorithmFingerprint(root = REPO_ROOT) {
  return fingerprintFromContents(readAlgorithmSources(root));
}

export function gitHead() {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unpublished';
  }
}

export function gitCommitTime() {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%cI'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

/** Last commit that touched a normative algorithm file. Stable across packaging commits. */
export function algorithmSourceCommit() {
  try {
    return execFileSync(
      'git',
      ['-C', REPO_ROOT, 'log', '-1', '--format=%H', '--', ...ALGORITHM_SOURCE_FILES],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return 'unpublished';
  }
}

export function algorithmSourceCommitTime() {
  try {
    return execFileSync(
      'git',
      ['-C', REPO_ROOT, 'log', '-1', '--format=%cI', '--', ...ALGORITHM_SOURCE_FILES],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

/** Wall clock is not a reproducibility input. */
export function researchTimestamp() {
  return process.env.ALBERICH_RESEARCH_TIME || algorithmSourceCommitTime();
}

export function researchMode() {
  if (process.argv.includes('--exhaustive')) return 'exhaustive';
  if (process.argv.includes('--full')) return 'full';
  if (process.argv.includes('--smoke')) return 'smoke';
  return 'full';
}

export function stampLiveV3({ script, command } = {}) {
  return {
    protocol: 'Modern V3',
    algorithmRevision: algorithmRevision(),
    algorithmFingerprint: algorithmFingerprint(),
    stepRule: LIVE_STEP_RULE,
    stepRuleDetail: LIVE_STEP_RULE_DETAIL,
    generatorProfile: 'Modern V3 Standard',
    algorithmSourceCommit: algorithmSourceCommit(),
    script,
    command: command || process.argv.slice(1).map((p) => p.replace(`${REPO_ROOT}/`, '')).join(' '),
    generatedAt: researchTimestamp(),
    researchMode: researchMode(),
    current: true,
    status: 'CURRENT',
    researchRng: 'mulberry32 deterministic research PRNG — never used for production keys',
    productionRng: 'Web Crypto CSPRNG',
  };
}

export function stampCascadeFuture({ script } = {}) {
  return {
    protocol: 'V3 cascade (future option)',
    algorithmRevision: algorithmRevision(),
    stepRule: 'cascade',
    current: false,
    status: 'NOT CURRENT MODERN V3',
    note: 'nextV3PositionsCascade is not wired into CipherEngine.step(). Live is double-step.',
    script,
    generatedAt: researchTimestamp(),
    algorithmSourceCommit: algorithmSourceCommit(),
  };
}

export function stampLegacyV2({ script } = {}) {
  return {
    protocol: 'Modern V2 / three-wheel',
    stepRule: 'Right always; Middle on Right notch; Left+Middle on Middle notch; Left unused; Thin stands',
    current: false,
    status: 'NOT CURRENT MODERN V3',
    script,
    generatedAt: researchTimestamp(),
  };
}

export const META_LIVE_V3 = stampLiveV3({ script: 'research/lib.mjs' });
export const META_LEGACY_V2 = stampLegacyV2({ script: 'research/lib.mjs' });

/** Nicht-kryptographischer, reproduzierbarer Generator. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive) % maxExclusive;
}

export function factorial(n) {
  let r = 1n;
  const N = BigInt(n);
  for (let i = 2n; i <= N; i++) r *= i;
  return r;
}

export function binomial(n, k) {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  const kk = Math.min(k, n - k);
  let r = 1n;
  for (let i = 0; i < kk; i++) {
    r = (r * BigInt(n - i)) / BigInt(i + 1);
  }
  return r;
}

/** Involutions on n letters: I(n) = I(n-1) + (n-1)·I(n-2). */
export function involutionCount(n) {
  if (n < 0) return 0n;
  if (n <= 1) return 1n;
  let prev2 = 1n;
  let prev1 = 1n;
  for (let i = 2; i <= n; i++) {
    const next = prev1 + BigInt(i - 1) * prev2;
    prev2 = prev1;
    prev1 = next;
  }
  return prev1;
}

export function log2Big(n) {
  if (n <= 0n) return -Infinity;
  const hex = n.toString(16);
  const topBits = BigInt(`0x${hex.slice(0, 13)}`);
  const exp = (hex.length - Math.min(hex.length, 13)) * 4;
  return exp + Math.log2(Number(topBits));
}

export function bitsOf(n) {
  return log2Big(n);
}

/**
 * Live generator: pick k uniformly from {5,7,9}, then a uniform k-subset.
 * Sets of different sizes are therefore not equiprobable.
 */
export function lueckenfuellerEntropy(counts = [5, 7, 9], rotors = 3) {
  const combos = counts.map((k) => binomial(26, k));
  const supportOne = combos.reduce((a, b) => a + b, 0n);
  const log3 = Math.log2(counts.length);
  const shannonOne =
    log3 + counts.reduce((acc, k, i) => acc + log2Big(combos[i]), 0) / counts.length;
  const minCombo = combos.reduce((a, b) => (a < b ? a : b));
  const minOne = log3 + log2Big(minCombo);
  return {
    counts,
    rotors,
    combinationsPerCount: Object.fromEntries(counts.map((k, i) => [k, combos[i].toString()])),
    supportOne: supportOne.toString(),
    supportOneBits: Number(bitsOf(supportOne).toFixed(6)),
    supportAll: (supportOne ** BigInt(rotors)).toString(),
    supportAllBits: Number((rotors * bitsOf(supportOne)).toFixed(6)),
    shannonOneBits: Number(shannonOne.toFixed(6)),
    shannonAllBits: Number((rotors * shannonOne).toFixed(6)),
    minEntropyOneBits: Number(minOne.toFixed(6)),
    minEntropyAllBits: Number((rotors * minOne).toFixed(6)),
    mostProbableCount: counts[combos.findIndex((c) => c === minCombo)],
    formula:
      'P(set) = 1/|{5,7,9}| · 1/C(26,k). Support = [Σ C(26,k)]^3. Shannon and min-entropy follow the mixture.',
  };
}

export function writeJson(relPath, data) {
  const path = relPath.startsWith('/') ? relPath : `${RESULTS_DIR}/${relPath}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, replacer, 2)}\n`);
  return path;
}

function replacer(_key, value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export const SYNTHETIC_V2 = Object.freeze({
  rotors: ['V', 'VI', 'VIII', 'Beta'],
  rings: ['P', 'E', 'L'],
  plug: 'AE BF CM DQ HU JN LX PR SZ VW',
  ground: 'CDSZ',
  reflectorId: 'C',
  doraFree: false,
});

export function configureSyntheticV2(engine, keyCode4, cfg = SYNTHETIC_V2) {
  const positions = [...keyCode4];
  engine.setCryptoMode('modern');
  engine.setReflector(cfg.reflectorId);
  engine.setRotors(
    cfg.rotors[0],
    cfg.rotors[1],
    cfg.rotors[2],
    cfg.rotors[3],
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    cfg.rings[0],
    cfg.rings[1],
    cfg.rings[2],
  );
  engine.setPlugboard(cfg.plug);
  const notches = deriveLueckenfuellerNotches(
    cfg.rings[0],
    cfg.rings[1],
    cfg.rings[2],
    cfg.plug,
  );
  if (!notches.ok) return false;
  engine.setEndwalze(resolveEndwalzeWiring(cfg.reflectorId, undefined, cfg.doraFree));
  engine.setLueckenfuellerNotches(notches.notches);
  return true;
}

export function packPositions(engine) {
  const { thin, left, middle, right } = engine.rotors;
  return ((thin.pos * 26 + left.pos) * 26 + middle.pos) * 26 + right.pos;
}

export function alphabet() {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
}

export const SYNTHETIC_V3 = Object.freeze({
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'EPEL',
  ringThin: 'E',
  ringLeft: 'P',
  ringMiddle: 'E',
  ringRight: 'L',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  notches: Object.freeze({ left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' }),
  networkContext: 'ALB',
  epoch: '2026-08-16',
  groundKey: 'CDSZ',
});

export function configureSyntheticV3(engine, keyCode4, cfg = SYNTHETIC_V3) {
  const positions = [...keyCode4];
  engine.setCryptoMode('modern');
  if (typeof engine.setModernProtocol === 'function') engine.setModernProtocol('v3');
  engine.setRotors(
    cfg.rotorLeft,
    cfg.rotorMiddle,
    cfg.rotorRight,
    cfg.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    cfg.ringLeft,
    cfg.ringMiddle,
    cfg.ringRight,
  );
  if (typeof engine.setThinRing === 'function') engine.setThinRing(cfg.ringThin);
  engine.setPlugboard(cfg.plugboard);
  engine.setEndwalze(cfg.endwalzeWiring);
  engine.setLueckenfuellerNotches(cfg.notches);
  return true;
}

export function wantsSmoke() {
  return process.argv.includes('--smoke');
}

export function wantsFull() {
  return process.argv.includes('--full');
}

export function wantsV3() {
  return process.argv.includes('--version') && process.argv.includes('v3')
    || process.argv.includes('--version=v3');
}

export function isValidUtf8RoundTrip(s) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(s)) === s;
  } catch {
    return false;
  }
}

export function hammingLetters(a, b) {
  const n = Math.max(a.length, b.length);
  let d = 0;
  const idx = [];
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      d += 1;
      idx.push(i);
    }
  }
  return {
    hamming: d,
    lengthA: a.length,
    lengthB: b.length,
    count: d,
    first: idx[0] ?? null,
    last: idx[idx.length - 1] ?? null,
    positions: idx.length <= 64 ? idx : idx.slice(0, 32).concat(idx.slice(-8)),
    prefixEqual: idx[0] ?? Math.min(a.length, b.length),
    affectedRate: n ? Number((d / n).toFixed(4)) : 0,
  };
}

export { CipherEngine, utf8ToBase26, deriveLueckenfuellerNotches, existsSync };
