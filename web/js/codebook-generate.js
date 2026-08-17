/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Monatstafel erzeugen — Parität zu codebook.alberich.pro und Android CodebookGenerator.
 * Fisher–Yates, 3 verschiedene Hauptwalzen, 10 kanonische Stecker.
 *
 * Endwalzen-Politik (opts.endwalzePolicy):
 *   dora     — nur Dora, 13 freie Paare (BO nicht fest), formatVersion 2
 *   mix      — Bruno/Caesar/Dora, Dora = festes BO + 12 Paare (bisher)
 *   historic — nur Bruno/Caesar
 */

import {
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
  REFLECTOR_ID_DORA,
} from './cipher-data.js';
import { ALBERICH_CODEBOOK_FORMAT } from './codebook.js';
import {
  formatVersionForPolicy,
  normalizeEndwalzePolicy,
  reflectorIdsForPolicy,
  usesFreeDoraWiring,
  usesPermutationEndwalze,
} from './endwalze-policy.js';
import { cryptoRandomInt } from './secure-random.js';
import { generateEndwalzeWiring, generateLueckenfueller } from './modern-v3.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @param {number} year
 * @param {number} month 1–12
 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * @param {number} year
 * @param {number} month 1–12
 * @param {'de' | 'en'} [locale]
 */
export function monthLabel(year, month, locale = 'de') {
  const tag = locale === 'en' ? 'en-GB' : 'de-DE';
  return new Date(year, month - 1, 1).toLocaleDateString(tag, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * @param {(maxExclusive: number) => number} [rng]
 */
function makeDraw(rng) {
  const nextInt = typeof rng === 'function' ? rng : cryptoRandomInt;
  return {
    nextInt,
    /** @template T @param {T[]} items */
    pick(items) {
      return items[nextInt(items.length)];
    },
    /** @template T @param {T[]} items */
    shuffle(items) {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = nextInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    fourLetters() {
      return Array.from({ length: 4 }, () => ALPHABET[nextInt(26)]).join('');
    },
  };
}

/**
 * @param {ReturnType<typeof makeDraw>} draw
 * @param {number} pairCount
 */
function randomPlugboard(draw, pairCount = 10) {
  const letters = draw.shuffle([...ALPHABET]);
  const pairs = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const a = letters[i];
    const b = letters[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * @param {ReturnType<typeof makeDraw>} draw
 */
function randomDoraEditable(draw) {
  const remaining = draw.shuffle([...ALPHABET].filter((c) => c !== 'B' && c !== 'O'));
  const pairs = [];
  for (let i = 0; i < 24; i += 2) {
    const a = remaining[i];
    const b = remaining[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * @param {ReturnType<typeof makeDraw>} draw
 */
function randomDoraFree(draw) {
  const letters = draw.shuffle([...ALPHABET]);
  const pairs = [];
  for (let i = 0; i < 26; i += 2) {
    const a = letters[i];
    const b = letters[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {ReturnType<typeof makeDraw>} draw
 * @param {string} policy
 */
function generateDay(year, month, day, draw, policy) {
  const thin = draw.pick(THIN_ROTOR_IDS);
  const mains = draw.shuffle(MAIN_ROTOR_IDS).slice(0, 3);
  const isoMonth = String(month).padStart(2, '0');
  const isoDay = String(day).padStart(2, '0');
  /** @type {import('./codebook.js').CodebookDay} */
  const entry = {
    day,
    date: `${year}-${isoMonth}-${isoDay}`,
    rotorThin: thin,
    rotorLeft: mains[0],
    rotorMiddle: mains[1],
    rotorRight: mains[2],
    ringCode: draw.fourLetters(),
    keyCode: draw.fourLetters(),
    plugboard: randomPlugboard(draw, 10),
  };

  if (usesPermutationEndwalze(policy)) {
    entry.endwalzeWiring = generateEndwalzeWiring(draw.nextInt);
    entry.lueckenfueller = generateLueckenfueller(draw.nextInt);
    return entry;
  }

  const ids = reflectorIdsForPolicy(policy);
  const reflectorId = draw.pick(ids);
  entry.reflectorId = reflectorId;
  if (reflectorId === REFLECTOR_ID_DORA) {
    entry.reflectorD = usesFreeDoraWiring(policy)
      ? randomDoraFree(draw)
      : randomDoraEditable(draw);
  }
  return entry;
}

/**
 * Monatstafel im Format alberich-codebook.
 * @param {number} year
 * @param {number} month 1–12
 * @param {'de' | 'en'} [locale]
 * @param {{ rng?: (maxExclusive: number) => number, generatedAt?: string, endwalzePolicy?: string }} [opts]
 * @returns {import('./codebook.js').CodebookSheet}
 */
export function generateMonthSheet(year, month, locale = 'de', opts = {}) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    throw new Error('year out of range');
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error('month out of range');
  }
  const policy = normalizeEndwalzePolicy(opts.endwalzePolicy);
  const draw = makeDraw(opts.rng);
  const n = daysInMonth(y, m);
  const days = [];
  for (let day = 1; day <= n; day++) {
    days.push(generateDay(y, m, day, draw, policy));
  }
  return {
    format: ALBERICH_CODEBOOK_FORMAT,
    formatVersion: formatVersionForPolicy(policy),
    endwalzePolicy: policy,
    ...(usesPermutationEndwalze(policy)
      ? { networkContext: String(opts.networkContext || 'ALB').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'ALB' }
      : {}),
    year: y,
    month: m,
    monthLabel: monthLabel(y, m, locale),
    generatedAt: opts.generatedAt || new Date().toISOString(),
    days,
  };
}
