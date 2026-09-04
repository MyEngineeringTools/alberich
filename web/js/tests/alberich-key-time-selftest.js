/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Alberich-Schlüsselzeit / slot kernel. node js/tests/alberich-key-time-selftest.js
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ALBERICH_UTC_OFFSET_MS,
  HOURS_PER_SLOT,
  SLOTS_PER_DAY,
  TIME_PROFILE,
  alberichWallToUnixMs,
  codebookMonthOfSlot,
  compareSlots,
  configureKeyTime,
  createSlotKeyResolver,
  formatSlotId,
  getAlberichDateTime,
  getSlotForTimestamp,
  getSlotsForDay,
  isSlotRollback,
  pinSlotForOperation,
  requireTimeProfile,
  resetKeyTimeForTests,
  slotOrdinal,
} from '../alberich-key-time.js';
import { fullKeyFingerprint } from '../full-key-fingerprint.js';
import { createModernSession, MODERN_SESSION } from '../modern-session.js';

const SELF = fileURLToPath(import.meta.url);

if (process.env.W5_KEY_TIME_CHILD === '1') {
  const ts = Number(process.env.W5_TS);
  const profile = process.env.W5_PROFILE;
  const slot = getSlotForTimestamp(ts, profile);
  const dt = getAlberichDateTime(ts);
  process.stdout.write(JSON.stringify({
    id: formatSlotId(slot),
    ordinal: slotOrdinal(slot),
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
  }));
  process.exit(0);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

function wall(y, m, d, hh = 0, mm = 0, ss = 0, ms = 0) {
  return alberichWallToUnixMs(y, m, d, hh, mm, ss, ms);
}

function ymd(dt) {
  return `${dt.year}-${String(dt.month).padStart(2, '0')}-${String(dt.day).padStart(2, '0')}`;
}

function childSlot(ts, profile, tz) {
  const r = spawnSync(process.execPath, [SELF], {
    env: {
      ...process.env,
      TZ: tz,
      W5_KEY_TIME_CHILD: '1',
      W5_TS: String(ts),
      W5_PROFILE: profile,
    },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`tz child ${tz} failed: ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout);
}

const KEY_A = {
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'EPEL',
  keyCode: 'CDSZ',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
};
const KEY_B = { ...KEY_A, keyCode: 'AAAA' };
const KEY_C = { ...KEY_A, rotorLeft: 'I' };

assert(ALBERICH_UTC_OFFSET_MS === 3600000, 'offset is exactly one hour');
assert(requireTimeProfile(TIME_PROFILE.HOURS_4) === 'HOURS_4', 'known profile accepted');
try {
  requireTimeProfile('EUROPE_BERLIN');
  assert(false, 'unknown profile must throw');
} catch (err) {
  assert(err.message === 'alberich.unknownTimeProfile', 'unknown profile fail-closed');
}

{
  const utc = Date.UTC(2026, 8, 3, 10, 30, 0, 0);
  const alb = getAlberichDateTime(utc);
  assert(alb.year === 2026 && alb.month === 9 && alb.day === 3, 'example date ALB 2026-09-03');
  assert(alb.hour === 11 && alb.minute === 30, 'UTC 10:30 → ALB 11:30');
  assert(alb.unixMs === utc, 'unixMs is the UTC instant, not ALB-shifted');
}

{
  configureKeyTime({ now: () => Date.UTC(2026, 8, 3, 10, 30, 0, 0) });
  const alb = getAlberichDateTime();
  assert(alb.hour === 11 && alb.minute === 30, 'injected clock used when timestamp omitted');
  resetKeyTimeForTests();
}

{
  const ts = wall(2026, 9, 3, 11, 30);
  const dt = getAlberichDateTime(ts);
  assert(dt.hour === 11 && dt.minute === 30, 'wall inverse 11:30 ALB');
  assert(ts === Date.UTC(2026, 8, 3, 10, 30, 0, 0), '11:30 ALB is 10:30 UTC');
}

{
  const ts = wall(2026, 9, 3, 12);
  const day = getSlotForTimestamp(ts, TIME_PROFILE.DAY_24H);
  const four = getSlotForTimestamp(ts, TIME_PROFILE.HOURS_4);
  const hour = getSlotForTimestamp(ts, TIME_PROFILE.HOUR_1);
  assert(day.slotIndex === 0 && day.startHour === 0 && day.endHour === 24, '24h single slot');
  assert(four.slotIndex === 3 && four.startHour === 12 && four.endHour === 16, '4h 12–16 is index 3');
  assert(hour.slotIndex === 12 && hour.startHour === 12 && hour.endHour === 13, '1h 12–13');
  assert(formatSlotId(four) === '2026-09-03/HOURS_4/3', '12:00 is index 3');
  assert(formatSlotId(getSlotForTimestamp(wall(2026, 9, 3, 8), TIME_PROFILE.HOURS_4)) === '2026-09-03/HOURS_4/2', '08–12 is index 2');
}

{
  const before = getSlotForTimestamp(wall(2026, 9, 3, 7, 59, 59, 999), TIME_PROFILE.HOURS_4);
  const at = getSlotForTimestamp(wall(2026, 9, 3, 8, 0, 0, 0), TIME_PROFILE.HOURS_4);
  assert(before.slotIndex === 1 && before.startHour === 4, '07:59:59.999 → 04–08');
  assert(at.slotIndex === 2 && at.startHour === 8, '08:00:00.000 → 08–12');
  assert(compareSlots(before, at) === -1, 'boundary is strictly increasing');
}

{
  const bounds = [
    [0, 0],
    [3, 59, 59, 999, 0],
    [4, 0, 0, 0, 1],
    [7, 59, 59, 999, 1],
    [8, 0, 0, 0, 2],
    [11, 59, 59, 999, 2],
    [12, 0, 0, 0, 3],
    [15, 59, 59, 999, 3],
    [16, 0, 0, 0, 4],
    [19, 59, 59, 999, 4],
    [20, 0, 0, 0, 5],
    [23, 59, 59, 999, 5],
  ];
  for (const row of bounds) {
    const expected = row[row.length - 1];
    const args = row.slice(0, -1);
    while (args.length < 4) args.push(0);
    const slot = getSlotForTimestamp(wall(2026, 9, 3, ...args), TIME_PROFILE.HOURS_4);
    assert(
      slot.slotIndex === expected,
      `4h ${String(args[0]).padStart(2, '0')}:${String(args[1]).padStart(2, '0')} → slot ${expected} (got ${slot.slotIndex})`,
    );
  }
}

{
  const a = getSlotForTimestamp(wall(2026, 9, 3, 23, 59, 59, 999), TIME_PROFILE.DAY_24H);
  const b = getSlotForTimestamp(wall(2026, 9, 4, 0, 0, 0, 0), TIME_PROFILE.DAY_24H);
  assert(a.day === 3 && b.day === 4, '24h midnight splits calendar days');
  assert(compareSlots(a, b) === -1, '24h day B is later');
}

{
  const a = getSlotForTimestamp(wall(2026, 9, 3, 23, 59, 59, 999), TIME_PROFILE.HOUR_1);
  const b = getSlotForTimestamp(wall(2026, 9, 4, 0, 0, 0, 0), TIME_PROFILE.HOUR_1);
  assert(a.slotIndex === 23 && a.day === 3, '1h 23:00–24:00');
  assert(b.slotIndex === 0 && b.day === 4, '1h next day 00:00–01:00');
  const noon = getSlotForTimestamp(wall(2026, 9, 3, 12, 0, 0, 0), TIME_PROFILE.HOUR_1);
  const almost = getSlotForTimestamp(wall(2026, 9, 3, 12, 59, 59, 999), TIME_PROFILE.HOUR_1);
  const next = getSlotForTimestamp(wall(2026, 9, 3, 13, 0, 0, 0), TIME_PROFILE.HOUR_1);
  assert(noon.slotIndex === 12 && almost.slotIndex === 12, '1h holds the whole hour');
  assert(next.slotIndex === 13, '1h 13:00 is the next slot');
}

{
  const sep = getSlotForTimestamp(wall(2026, 9, 30, 23, 59, 59, 999), TIME_PROFILE.HOURS_4);
  const oct = getSlotForTimestamp(wall(2026, 10, 1, 0, 0, 0, 0), TIME_PROFILE.HOURS_4);
  assert(codebookMonthOfSlot(sep).month === 9 && codebookMonthOfSlot(sep).year === 2026, '30.09 ALB → September sheet');
  assert(codebookMonthOfSlot(oct).month === 10 && oct.slotIndex === 0, '01.10 ALB → October sheet');
  assert(wall(2026, 10, 1, 0) - wall(2026, 9, 30, 23, 59, 59, 999) === 1, 'month boundary is 1 ms');
}

{
  const dec = getSlotForTimestamp(wall(2026, 12, 31, 23, 59, 59, 999), TIME_PROFILE.DAY_24H);
  const jan = getSlotForTimestamp(wall(2027, 1, 1, 0, 0, 0, 0), TIME_PROFILE.DAY_24H);
  assert(dec.year === 2026 && jan.year === 2027, 'year rolls 31.12 → 01.01');
  assert(codebookMonthOfSlot(jan).month === 1, '01.01 belongs to January');
}

{
  const leap = getSlotForTimestamp(wall(2028, 2, 29, 12), TIME_PROFILE.DAY_24H);
  assert(leap.year === 2028 && leap.month === 2 && leap.day === 29, '2028-02-29 exists');
  const slots = getSlotsForDay(2028, 2, 29, TIME_PROFILE.HOUR_1);
  assert(slots.length === 24, 'leap day has 24 hourly slots');
  try {
    getSlotsForDay(2027, 2, 29, TIME_PROFILE.DAY_24H);
    assert(false, '2027-02-29 must not exist');
  } catch (err) {
    assert(err.message === 'alberich.invalidDate', 'non-leap 29 Feb rejected');
  }
  const feb = getSlotForTimestamp(wall(2027, 2, 28, 23, 59, 59, 999), TIME_PROFILE.DAY_24H);
  const mar = getSlotForTimestamp(wall(2027, 3, 1, 0, 0, 0, 0), TIME_PROFILE.DAY_24H);
  assert(feb.month === 2 && feb.day === 28, '2027-02-28 last winter day');
  assert(mar.month === 3 && mar.day === 1, '2027-02-28 → 2027-03-01');
}

{
  const apr = getSlotsForDay(2026, 4, 30, TIME_PROFILE.DAY_24H);
  assert(apr.length === 1 && apr[0].day === 30, 'April has day 30');
  try {
    getSlotsForDay(2026, 4, 31, TIME_PROFILE.DAY_24H);
    assert(false, '31 April must throw');
  } catch (err) {
    assert(err.message === 'alberich.invalidDate', '31 April rejected');
  }
  assert(getSlotsForDay(2026, 8, 31, TIME_PROFILE.HOURS_4).length === 6, '31 Aug has six 4h slots');
}

{
  // EU spring-forward 2026-03-29 01:00 UTC: Berlin 02:00 CET → 03:00 CEST.
  const beforeUtc = Date.UTC(2026, 2, 29, 0, 59, 59, 999);
  const atUtc = Date.UTC(2026, 2, 29, 1, 0, 0, 0);
  const before = getAlberichDateTime(beforeUtc);
  const at = getAlberichDateTime(atUtc);
  assert(before.hour === 1 && before.minute === 59, 'DST March: ALB still 01:59 at 00:59:59.999 UTC');
  assert(at.hour === 2 && at.minute === 0, 'DST March: ALB 02:00 exists (Berlin skipped it)');
  const slot2 = getSlotForTimestamp(atUtc, TIME_PROFILE.HOUR_1);
  assert(slot2.slotIndex === 2 && slot2.day === 29, 'ALB hour 2 is a real 1h slot on the spring day');
  const four = getSlotForTimestamp(atUtc, TIME_PROFILE.HOURS_4);
  assert(four.slotIndex === 0, '02:00 ALB remains in 00–04, no one-hour jump');
}

{
  // EU fall-back 2026-10-25 01:00 UTC: Berlin 03:00 CEST → 02:00 CET.
  const beforeUtc = Date.UTC(2026, 9, 25, 0, 59, 59, 999);
  const atUtc = Date.UTC(2026, 9, 25, 1, 0, 0, 0);
  const before = getAlberichDateTime(beforeUtc);
  const at = getAlberichDateTime(atUtc);
  assert(before.hour === 1 && before.minute === 59, 'DST Oct: ALB 01:59 at 00:59:59.999 UTC');
  assert(at.hour === 2 && at.minute === 0, 'DST Oct: ALB 02:00 once (Berlin repeats 02:00)');
  const hour1 = getSlotForTimestamp(beforeUtc, TIME_PROFILE.HOUR_1);
  const hour2 = getSlotForTimestamp(atUtc, TIME_PROFILE.HOUR_1);
  assert(hour1.slotIndex === 1 && hour2.slotIndex === 2, 'fall-back does not duplicate an ALB hour');
  assert(slotOrdinal(hour2) === slotOrdinal(hour1) + 1, 'ordinal still steps by one');
}

{
  const ts = Date.UTC(2026, 2, 29, 1, 0, 0, 0);
  const zones = ['UTC', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo'];
  const ids = zones.map((tz) => childSlot(ts, TIME_PROFILE.HOURS_4, tz));
  assert(ids.every((row) => row.id === ids[0].id), `TZ-independent slot id (${ids[0].id})`);
  assert(ids.every((row) => row.hour === 2 && row.ordinal === ids[0].ordinal), 'TZ-independent ALB 02:00 / ordinal');
  const winter = Date.UTC(2026, 0, 15, 10, 30, 0, 0);
  const winterIds = zones.map((tz) => childSlot(winter, TIME_PROFILE.HOUR_1, tz));
  assert(winterIds.every((row) => row.id === winterIds[0].id && row.hour === 11), 'winter TZ-independent 11:30 ALB');
}

{
  const a = getSlotForTimestamp(wall(2026, 9, 3, 8), TIME_PROFILE.HOURS_4);
  const b = getSlotForTimestamp(wall(2026, 9, 3, 12), TIME_PROFILE.HOURS_4);
  const same = getSlotForTimestamp(wall(2026, 9, 3, 9, 30), TIME_PROFILE.HOURS_4);
  const hour = getSlotForTimestamp(wall(2026, 9, 3, 8), TIME_PROFILE.HOUR_1);
  assert(compareSlots(a, same) === 0, 'same 4h slot compares equal');
  assert(compareSlots(a, b) === -1 && compareSlots(b, a) === 1, 'later 4h slot is greater');
  assert(isSlotRollback(a, b), 'watermark later → earlier candidate is rollback');
  assert(!isSlotRollback(b, a), 'forward slot is not rollback');
  try {
    compareSlots(a, hour);
    assert(false, 'cross-profile compare must throw');
  } catch (err) {
    assert(err.message === 'alberich.slotProfileMismatch', '4h and 1h are not mixed');
  }
  assert(SLOTS_PER_DAY[TIME_PROFILE.HOURS_4] === 6, 'six 4h slots');
  assert(HOURS_PER_SLOT[TIME_PROFILE.HOUR_1] === 1, '1h duration');
}

{
  const slotA = getSlotForTimestamp(wall(2026, 9, 3, 11, 59, 59, 999), TIME_PROFILE.HOURS_4);
  const slotB = getSlotForTimestamp(wall(2026, 9, 3, 12, 0, 0, 0), TIME_PROFILE.HOURS_4);
  const table = createSlotKeyResolver([
    { slot: slotA, key: KEY_A },
    { slot: slotB, key: KEY_B },
    { slot: getSlotForTimestamp(wall(2026, 9, 3, 16), TIME_PROFILE.HOURS_4), key: KEY_C },
  ]);
  assert(table.resolve(slotA) === KEY_A, 'resolver Slot A → Key A');
  assert(table.resolve(slotB) === KEY_B, 'resolver Slot B → Key B');
  assert(table.resolve(getSlotForTimestamp(wall(2026, 9, 3, 17), TIME_PROFILE.HOURS_4)) === KEY_C, 'resolver Slot C → Key C');
  assert(table.resolve(getSlotForTimestamp(wall(2026, 9, 3, 0), TIME_PROFILE.HOURS_4)) == null, 'unknown slot has no derived key');

  const fpA = await fullKeyFingerprint(KEY_A);
  const fpB = await fullKeyFingerprint(KEY_B);
  assert(fpA !== fpB, 'independent keys have distinct fingerprints');
  const session = createModernSession();
  session.noteReserved(fpA, 'KPLM');
  assert(session.phase() === MODERN_SESSION.ACTIVE_PRIVATE, 'session active under Key A');
  assert(session.shouldInvalidateForFingerprint(fpB), '11:59→12:00 fingerprint change is visible');
  session.invalidate();
  session.noteReserved(fpB, 'QXFR');
  assert(session.reservedFingerprint() === fpB, 'session restarts under Key B');
  assert(!session.shouldInvalidateForFingerprint(fpB), 'same fingerprint does not invalidate');
  assert(session.reservedMessageKey() === 'QXFR', 'new MK after fingerprint change');
}

{
  let clock = wall(2026, 9, 3, 11, 59, 59, 999);
  configureKeyTime({ now: () => clock });
  const pinned = pinSlotForOperation(undefined, TIME_PROFILE.HOURS_4);
  clock = wall(2026, 9, 3, 12, 0, 0, 0);
  const later = getSlotForTimestamp(undefined, TIME_PROFILE.HOURS_4);
  assert(pinned.slotIndex === 2, 'pinned snapshot stays on 08–12');
  assert(later.slotIndex === 3, 'display clock may already show 12–16');
  assert(compareSlots(pinned, later) === -1, 'crypto snapshot is not mutated by a later slot');
  resetKeyTimeForTests();
}

{
  const src = getSlotForTimestamp(wall(2026, 9, 3, 8), TIME_PROFILE.HOURS_4);
  try {
    src.slotIndex = 99;
  } catch {
    /* frozen */
  }
  assert(src.slotIndex === 2, 'slot object is immutable');
}

if (failed > 0) {
  console.error(`\n${failed} alberich-key-time test(s) failed`);
  process.exit(1);
}
console.log('\nAll alberich-key-time selftests passed.');
