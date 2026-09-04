/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Independent full V3 keys per time slot. Each slot calls the existing
 * CSPRNG-backed V3 keygen. No KDF, seed, previous-slot, date, or fingerprint
 * derivation.
 *
 * Duplicate policy: byte-identical full keys across the whole month are
 * discarded and fully regenerated (takeUniqueFullKey).
 *
 * Weak-Key-Rejection: BLOCKED / Laboratory (P0.4). Acceptance is structural
 * uniqueness only — do not add a placeholder weak-cycle filter here.
 */

import { MAIN_ROTOR_IDS, THIN_ROTOR_IDS } from './cipher-data.js';
import { SLOTS_PER_DAY, requireTimeProfile } from './alberich-key-time.js';
import { takeUniqueFullKey } from './full-key-fingerprint.js';
import { generateEndwalzeWiring, generateLueckenfueller } from './modern-v3.js';
import { cryptoRandomInt } from './secure-random.js';
import {
  KEY_TIME_REFERENCE,
  TIMEBOOK_KIND,
  daysInUtcMonth,
  timebookFingerprint,
  validateTimebook,
} from './timebook.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function makeDraw(rng) {
  const nextInt = typeof rng === 'function' ? rng : cryptoRandomInt;
  return {
    nextInt,
    pick(items) {
      return items[nextInt(items.length)];
    },
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

function randomPlugboard(draw) {
  const letters = draw.shuffle([...ALPHABET]);
  const pairs = [];
  for (let i = 0; i < 20; i += 2) {
    const a = letters[i];
    const b = letters[i + 1];
    pairs.push(a < b ? a + b : b + a);
  }
  return pairs.sort().join(' ');
}

/** One independent full V3 machine key. Not a function of slot/date. */
export function generateIndependentV3Key(draw) {
  const d = draw || makeDraw();
  const mains = d.shuffle(MAIN_ROTOR_IDS).slice(0, 3);
  return {
    rotorThin: d.pick(THIN_ROTOR_IDS),
    rotorLeft: mains[0],
    rotorMiddle: mains[1],
    rotorRight: mains[2],
    ringCode: d.fourLetters(),
    keyCode: d.fourLetters(),
    plugboard: randomPlugboard(d),
    endwalzeWiring: generateEndwalzeWiring(d.nextInt),
    lueckenfueller: generateLueckenfueller(d.nextInt),
  };
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @param {number} year
 * @param {number} month
 * @param {string} timeProfile
 * @param {{ rng?: (n: number) => number, networkContext?: string }} [opts]
 */
export async function generateTimebook(year, month, timeProfile, opts = {}) {
  const y = Number(year);
  const m = Number(month);
  const profile = requireTimeProfile(timeProfile);
  if (!Number.isInteger(y) || y < 1900 || y > 2100) throw new Error('timebook.err.year');
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('timebook.err.month');

  const draw = makeDraw(opts.rng);
  const dim = daysInUtcMonth(y, m);
  const slotsPerDay = SLOTS_PER_DAY[profile];
  const seen = new Set();
  const days = [];
  let duplicateRetries = 0;
  const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  let fingerprintMs = 0;

  for (let day = 1; day <= dim; day++) {
    const slots = [];
    for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex++) {
      const taken = await takeUniqueFullKey(seen, () => generateIndependentV3Key(draw));
      duplicateRetries += Math.max(0, taken.attempts - 1);
      slots.push({
        slotIndex,
        fullKeyFingerprint: taken.fingerprint,
        key: taken.key,
      });
    }
    days.push({
      day,
      date: isoDate(y, m, day),
      slots,
    });
  }

  const book = {
    kind: TIMEBOOK_KIND,
    year: y,
    month: m,
    timeProfile: profile,
    keyTimeReference: KEY_TIME_REFERENCE,
    networkContext: typeof opts.networkContext === 'string' && opts.networkContext
      ? opts.networkContext
      : 'ALB',
    days,
  };
  const checked = validateTimebook(book);
  if (!checked.ok) throw new Error(checked.error);

  const tf0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  book.codebookFingerprint = await timebookFingerprint(book);
  const tf1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  fingerprintMs += tf1 - tf0;

  const t1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const keyCount = dim * slotsPerDay;
  return {
    timebook: book,
    stats: {
      keyCount,
      generateMs: t1 - t0,
      fingerprintMs,
      duplicateRetries,
      approxBytes: JSON.stringify(book).length,
    },
  };
}
