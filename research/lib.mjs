/**
 * Gemeinsame Hilfen für das Modern-Research-Labor.
 * Nur synthetische Schlüssel. Feste Seeds. Keine echten Tafeln.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  deriveLueckenfuellerNotches,
  resolveEndwalzeWiring,
  utf8ToBase26,
} from '../web/js/modern-crypto.js';

export const RESEARCH_DIR = dirname(fileURLToPath(import.meta.url));
export const RESULTS_DIR = `${RESEARCH_DIR}/results`;
export const CORPUS_DIR = `${RESEARCH_DIR}/corpus`;

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

/** log2(n) als Zahl mit ~12 Nachkommastellen (BigInt). */
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

/**
 * @param {CipherEngine} engine
 * @param {string} keyCode4
 * @param {typeof SYNTHETIC_V2} [cfg]
 */
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

export { CipherEngine, utf8ToBase26, deriveLueckenfuellerNotches };
