/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Internal timebook model, generation, fingerprint, adapter, MAC-first search.
 */
import { CipherEngine } from '../cipher-engine.js';
import { TIME_PROFILE, alberichWallToUnixMs, getSlotForTimestamp, getSlotsForDay } from '../alberich-key-time.js';
import { takeUniqueFullKey } from '../full-key-fingerprint.js';
import {
  TIMEBOOK_KIND,
  adaptLegacySheetToTimebook,
  canonicalizeTimebookIdentity,
  isTimebook,
  listTimebookSlots,
  rejectTimebookExport,
  selectDisplayFullKey,
  timebookFingerprint,
  validateTimebook,
} from '../timebook.js';
import { generateIndependentV3Key, generateTimebook } from '../timebook-generate.js';
import { MAC_SEARCH, candidateSlotOrder, searchTimebookPruef20 } from '../timebook-search.js';
import { generateMonthSheet } from '../codebook-generate.js';
import { parseCodebookJson } from '../codebook.js';
import { sheetToJsonString, buildCompressedQrPayload } from '../codebook-export.js';
import { modernV3EncryptPayload } from '../modern-v3.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

function lcg(seed) {
  let s = seed >>> 0;
  return (max) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

function makeDraw(rng) {
  const nextInt = rng;
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return {
    nextInt,
    pick(items) { return items[nextInt(items.length)]; },
    shuffle(items) {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = nextInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    fourLetters() {
      return Array.from({ length: 4 }, () => AZ[nextInt(26)]).join('');
    },
  };
}

function configureFromKey(engine, keyCode4, key) {
  const pos = [...keyCode4];
  const rings = [...key.ringCode];
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setRotors(
    key.rotorLeft, key.rotorMiddle, key.rotorRight, key.rotorThin,
    pos[1], pos[2], pos[3], pos[0],
    rings[1], rings[2], rings[3],
  );
  engine.setThinRing(rings[0]);
  engine.setPlugboard(key.plugboard);
  engine.setEndwalze(key.endwalzeWiring);
  engine.setLueckenfuellerNotches(key.lueckenfueller);
  return true;
}

function flipAt(letters, index) {
  const i = index < 0 ? letters.length + index : index;
  const cur = letters[i];
  return letters.slice(0, i) + (cur === 'A' ? 'B' : 'A') + letters.slice(i + 1);
}

assert(TIMEBOOK_KIND === 'ALB3_TIMEBOOK_V1', 'internal kind');

{
  const { timebook, stats } = await generateTimebook(2026, 4, TIME_PROFILE.DAY_24H, { rng: lcg(7) });
  assert(validateTimebook(timebook).ok, 'A: DAY_24H validates');
  assert(timebook.days.length === 30, 'A: April has 30 days');
  assert(timebook.days.every((d) => d.slots.length === 1), 'A: one slot per day');
  assert(stats.keyCount === 30, 'A: 30 keys');
}

{
  const { timebook, stats } = await generateTimebook(2026, 4, TIME_PROFILE.HOURS_4, { rng: lcg(11) });
  assert(timebook.days.every((d) => d.slots.length === 6), 'B: 6 slots/day');
  assert(stats.keyCount === 30 * 6, 'B: 180 keys in 30-day 4h');
}

{
  const { timebook, stats } = await generateTimebook(2026, 2, TIME_PROFILE.HOUR_1, { rng: lcg(13) });
  assert(timebook.days.every((d) => d.slots.length === 24), 'C: 24 slots/day');
  assert(stats.keyCount === 28 * 24, 'C: 672 keys in non-leap Feb 1h');
}

{
  const { timebook, stats } = await generateTimebook(2026, 8, TIME_PROFILE.HOUR_1, { rng: lcg(17) });
  const fps = listTimebookSlots(timebook).map((s) => s.fullKeyFingerprint);
  assert(stats.keyCount === 744, 'D: 31-day HOUR_1 is 744 keys');
  assert(new Set(fps).size === 744, 'E: all 744 fingerprints unique');
  assert(timebook.keyTimeReference === 'UTC+1', 'key time UTC+1');
  globalThis.__w6Aug1h = { timebook, stats };
}

{
  const { fullKeyFingerprint } = await import('../full-key-fingerprint.js');
  const draw = makeDraw(lcg(99));
  const frozen = generateIndependentV3Key(draw);
  const seen = new Set([await fullKeyFingerprint(frozen)]);
  let calls = 0;
  const taken = await takeUniqueFullKey(seen, () => {
    calls += 1;
    return calls === 1 ? structuredClone(frozen) : generateIndependentV3Key(draw);
  });
  assert(calls === 2, 'F: duplicate candidates discarded, factory called again');
  assert(taken.attempts === 2, 'F: entire candidate replaced, not patched');
  assert(taken.fingerprint !== [...seen][0], 'F: accepted key is a later independent draw');
}

{
  const draw = makeDraw(lcg(3));
  const a = generateIndependentV3Key(draw);
  const b = generateIndependentV3Key(draw);
  assert(JSON.stringify(a) !== JSON.stringify(b), 'G: successive CSPRNG/keygen calls differ');
  assert(!Object.is(a, b), 'G: new object per slot');
}

{
  const { timebook } = await generateTimebook(2026, 3, TIME_PROFILE.DAY_24H, { rng: lcg(42) });
  const fp = timebook.codebookFingerprint;
  const again = await timebookFingerprint(timebook);
  assert(fp === again && /^[0-9a-f]{64}$/.test(fp), 'fingerprint A: identical book → same SHA-256');
  const renamed = { ...timebook, displayName: 'Secret Net', generatedAt: '2099-01-01' };
  assert(await timebookFingerprint(renamed) === fp, 'fingerprint B: rename/generatedAt ignored');
  const canon = canonicalizeTimebookIdentity(timebook);
  assert(canon.startsWith('ALB3-TIMEBOOK-ID-V1\n'), 'canonical header');
  assert(!canon.includes('Secret'), 'canonical has no display name');
  assert(!canon.includes('2099'), 'canonical has no generatedAt');
  assert(!canon.toLowerCase().includes('network'), 'canonical has no net/UI name');

  const reconstructed = {
    kind: timebook.kind,
    year: timebook.year,
    month: timebook.month,
    timeProfile: timebook.timeProfile,
    keyTimeReference: timebook.keyTimeReference,
    days: timebook.days.map((d) => ({
      day: d.day,
      date: d.date,
      slots: d.slots.map((s) => ({
        slotIndex: s.slotIndex,
        fullKeyFingerprint: s.fullKeyFingerprint,
        key: { ...s.key, lueckenfueller: { ...s.key.lueckenfueller } },
      })),
    })),
  };
  assert(await timebookFingerprint(reconstructed) === fp, 'fingerprint C: reimport identical data');

  const mutated = structuredClone(timebook);
  mutated.days[0].slots[0].fullKeyFingerprint = 'ab'.repeat(32);
  assert(await timebookFingerprint(mutated) !== fp, 'fingerprint D: one slot fp changes identity');

  const otherProfile = { ...timebook, timeProfile: TIME_PROFILE.HOURS_4 };
  assert(await timebookFingerprint(otherProfile) !== fp, 'fingerprint E: profile changes identity');

  const otherMonth = { ...timebook, month: 4 };
  assert(await timebookFingerprint(otherMonth) !== fp, 'fingerprint F: month changes identity');

  assert(
    fp === 'a3b8b4334131cef0a7f04bbf0fbcc5273a1ba86d8808b7ea23e2adae6dba1d9c',
    'fingerprint test vector March 2026 DAY_24H lcg(42)',
  );
}

{
  const sheet = await generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation', rng: lcg(5) });
  const original = JSON.stringify(sheet);
  const adapted = await adaptLegacySheetToTimebook(sheet);
  assert(adapted.ok && adapted.timebook.timeProfile === TIME_PROFILE.DAY_24H, 'legacy adapter DAY_24H');
  assert(adapted.timebook.days[0].slots.length === 1, 'legacy day → slot 0');
  assert(JSON.stringify(sheet) === original, 'adapter does not mutate original');
  assert(sheet.days[0].keyCode === adapted.timebook.days[0].slots[0].key.keyCode, 'adapter keeps existing key');
}

{
  const { timebook } = await generateTimebook(2026, 1, TIME_PROFILE.HOURS_4, { rng: lcg(21) });
  try {
    rejectTimebookExport(timebook);
    assert(false, 'export must throw');
  } catch (err) {
    assert(err.message === 'timebook.err.noCbqr1Export', 'CBQR1/JSON export rejected');
  }
  try {
    sheetToJsonString(timebook);
    assert(false, 'json export must throw');
  } catch (err) {
    assert(err.message === 'timebook.err.noCbqr1Export', 'sheetToJsonString rejects timebook');
  }
  try {
    buildCompressedQrPayload(timebook);
    assert(false, 'qr export must throw');
  } catch (err) {
    assert(err.message === 'timebook.err.noCbqr1Export', 'CBQR1 payload rejects timebook');
  }
  const parsed = parseCodebookJson(timebook);
  assert(!parsed.ok && parsed.error === 'timebook.err.notLegacyFormat', 'JSON import of timebook rejected');
  assert(isTimebook(timebook), 'isTimebook');
}

{
  const { timebook } = await generateTimebook(2026, 4, TIME_PROFILE.DAY_24H, { rng: lcg(8) });
  const slots = listTimebookSlots(timebook);
  const engine = new CipherEngine();
  async function encryptAt(index, text = 'Hello') {
    const s = slots[index];
    return modernV3EncryptPayload({
      engine,
      configure: (code) => configureFromKey(engine, code, s.key),
      groundKey: s.key.keyCode,
      plainText: text,
      messageKey: 'LDNQ',
      messageId: 'TESTMSGX',
      dayConfig: {
        ...s.key,
        notches: s.key.lueckenfueller,
        networkContext: 'ALB',
        epoch: s.epoch,
      },
    });
  }
  const first = await encryptAt(0);
  const mid = await encryptAt(Math.floor(slots.length / 2));
  const last = await encryptAt(slots.length - 1);
  const prevDay = await encryptAt(9);
  assert(first.ok && mid.ok && last.ok && prevDay.ok, 'search fixtures encrypt');

  const current = slots[10];
  async function find(cipher) {
    return searchTimebookPruef20({
      timebook,
      cipherLetters: cipher,
      currentSlot: current,
      engine,
      configure: (code, key) => configureFromKey(engine, code, key),
    });
  }
  const f1 = await find(first.cipher);
  const f2 = await find(mid.cipher);
  const f3 = await find(last.cipher);
  const f4 = await find(prevDay.cipher);
  assert(f1.status === MAC_SEARCH.MATCH && f1.match.day === 1, 'search first slot');
  assert(f2.status === MAC_SEARCH.MATCH && f2.match.day === slots[Math.floor(slots.length / 2)].day, 'search middle slot of month');
  assert(f3.status === MAC_SEARCH.MATCH && f3.match.day === 30, 'search last slot');
  assert(f4.status === MAC_SEARCH.MATCH && f4.match.day === 10, 'search previous day');
  assert(f1.decryptCalls === 1 && f2.decryptCalls === 1, 'success decrypts BODY once');

  let decryptCalls = 0;
  const wrapped = async (o) => {
    decryptCalls += 1;
    return { ok: true, plainText: 'nope' };
  };
  const badHdr = await searchTimebookPruef20({
    timebook,
    cipherLetters: flipAt(first.cipher, 4),
    currentSlot: current,
    engine,
    configure: () => true,
    decryptPayload: wrapped,
  });
  const badMid = await searchTimebookPruef20({
    timebook, cipherLetters: flipAt(first.cipher, 8), currentSlot: current, engine, configure: () => true, decryptPayload: wrapped,
  });
  const badBody = await searchTimebookPruef20({
    timebook, cipherLetters: flipAt(first.cipher, 16), currentSlot: current, engine, configure: () => true, decryptPayload: wrapped,
  });
  const badPruef = await searchTimebookPruef20({
    timebook, cipherLetters: flipAt(first.cipher, -1), currentSlot: current, engine, configure: () => true, decryptPayload: wrapped,
  });
  assert(
    [badHdr, badMid, badBody, badPruef].every((r) => r.status === MAC_SEARCH.NO_KEY_MATCH),
    'manipulated HDR/MID/BODY/PRUEF → NO_KEY_MATCH',
  );
  assert(decryptCalls === 0, 'failure never calls rotor decrypt');

  decryptCalls = 0;
  const ambiguous = await searchTimebookPruef20({
    timebook,
    cipherLetters: first.cipher,
    currentSlot: current,
    engine,
    configure: () => true,
    verifyMac: async () => true,
    decryptPayload: wrapped,
  });
  assert(ambiguous.status === MAC_SEARCH.AMBIGUOUS_KEY_MATCH, 'injected dual PASS → AMBIGUOUS');
  assert(decryptCalls === 0, 'ambiguous does not decrypt');

  const order = candidateSlotOrder(timebook, current);
  assert(order[0].day === current.day, 'order starts at current');
  assert(order.length === slots.length, 'order covers the whole book');
}

{
  const d24 = await generateTimebook(2026, 8, TIME_PROFILE.DAY_24H, { rng: lcg(31) });
  const d4 = await generateTimebook(2026, 8, TIME_PROFILE.HOURS_4, { rng: lcg(32) });
  const d1 = globalThis.__w6Aug1h;
  async function benchSearch(book, label) {
    const slots = listTimebookSlots(book);
    const engine = new CipherEngine();
    const first = slots[0];
    const last = slots[slots.length - 1];
    async function enc(s) {
      return modernV3EncryptPayload({
        engine,
        configure: (code, key) => configureFromKey(engine, code, key || s.key),
        groundKey: s.key.keyCode,
        plainText: 'Hi',
        messageKey: 'LDNQ',
        messageId: 'BENCHMID',
        dayConfig: {
          ...s.key,
          notches: s.key.lueckenfueller,
          networkContext: 'ALB',
          epoch: s.epoch,
        },
      });
    }
    const cFirst = await enc(first);
    const cLast = await enc(last);
    const t0 = performance.now();
    const rFirst = await searchTimebookPruef20({
      timebook: book, cipherLetters: cFirst.cipher, currentSlot: first, engine,
      configure: (code, key) => configureFromKey(engine, code, key),
    });
    const t1 = performance.now();
    const rLast = await searchTimebookPruef20({
      timebook: book, cipherLetters: cLast.cipher, currentSlot: first, engine,
      configure: (code, key) => configureFromKey(engine, code, key),
    });
    const t2 = performance.now();
    const rNone = await searchTimebookPruef20({
      timebook: book, cipherLetters: flipAt(cFirst.cipher, -1), currentSlot: first, engine,
      configure: (code, key) => configureFromKey(engine, code, key),
    });
    const t3 = performance.now();
    assert(rFirst.status === MAC_SEARCH.MATCH && rFirst.decryptCalls === 1, `${label} search-first match`);
    assert(rLast.status === MAC_SEARCH.MATCH && rLast.decryptCalls === 1, `${label} search-last match`);
    assert(rNone.status === MAC_SEARCH.NO_KEY_MATCH && rNone.decryptCalls === 0, `${label} no-match`);
    return {
      keys: slots.length,
      firstMs: t1 - t0,
      lastMs: t2 - t1,
      noneMs: t3 - t2,
      macLast: rLast.macChecks,
      macNone: rNone.macChecks,
    };
  }
  const b24 = await benchSearch(d24.timebook, '24h');
  const b4 = await benchSearch(d4.timebook, '4h');
  const b1 = await benchSearch(d1.timebook, '1h');
  console.log('W6 performance 31-day August 2026');
  console.log('Profile   Keys   GenerateMs   Search-first   Search-last   No-match   approxBytes');
  const row = (name, gen, b) => `${name.padEnd(8)} ${String(b.keys).padStart(4)} ${String(Math.round(gen)).padStart(12)} ${b.firstMs.toFixed(0).padStart(13)} ${b.lastMs.toFixed(0).padStart(12)} ${b.noneMs.toFixed(0).padStart(10)} ${String(gen && 0)}`.trim();
  console.log(`DAY_24H  ${b24.keys}  gen=${d24.stats.generateMs.toFixed(0)}ms  first=${b24.firstMs.toFixed(0)}ms  last=${b24.lastMs.toFixed(0)}ms  none=${b24.noneMs.toFixed(0)}ms  bytes=${d24.stats.approxBytes} retries=${d24.stats.duplicateRetries}`);
  console.log(`HOURS_4  ${b4.keys}  gen=${d4.stats.generateMs.toFixed(0)}ms  first=${b4.firstMs.toFixed(0)}ms  last=${b4.lastMs.toFixed(0)}ms  none=${b4.noneMs.toFixed(0)}ms  bytes=${d4.stats.approxBytes} retries=${d4.stats.duplicateRetries}`);
  console.log(`HOUR_1   ${b1.keys}  gen=${d1.stats.generateMs.toFixed(0)}ms  first=${b1.firstMs.toFixed(0)}ms  last=${b1.lastMs.toFixed(0)}ms  none=${b1.noneMs.toFixed(0)}ms  bytes=${d1.stats.approxBytes} retries=${d1.stats.duplicateRetries}`);
  void row;
}

{
  const { timebook } = await generateTimebook(2026, 4, TIME_PROFILE.HOUR_1, { rng: lcg(41) });
  const t10 = alberichWallToUnixMs(2026, 4, 2, 10, 0, 0, 0);
  const t11 = alberichWallToUnixMs(2026, 4, 2, 11, 0, 0, 0);
  const clock10 = selectDisplayFullKey({
    book: timebook,
    keySource: 'codebook',
    isModernMode: true,
    pin: null,
    timestampMs: t10,
  });
  const clock11 = selectDisplayFullKey({
    book: timebook,
    keySource: 'codebook',
    isModernMode: true,
    pin: null,
    timestampMs: t11,
  });
  assert(clock10 && clock11, 'display: clock resolves 10h and 11h');
  assert(clock10.source === 'clock' && clock11.source === 'clock', 'display: source is clock');
  assert(clock10.slotId !== clock11.slotId, 'display: full hour → new slot id');
  assert(
    clock10.key.keyCode !== clock11.key.keyCode
      || clock10.key.rotorLeft !== clock11.key.rotorLeft
      || clock10.key.endwalzeWiring !== clock11.key.endwalzeWiring,
    'display: full hour → different stored full key',
  );
  const pinned = selectDisplayFullKey({
    book: timebook,
    keySource: 'codebook',
    isModernMode: true,
    pin: { fullKey: clock10.key, slotId: clock10.slotId },
    timestampMs: t11,
  });
  assert(pinned.source === 'pin' && pinned.slotId === clock10.slotId, 'display: pin wins over later hour');
  assert(pinned.key.keyCode === clock10.key.keyCode, 'display: pin keeps the started-message key');
  assert(
    selectDisplayFullKey({
      book: timebook,
      keySource: 'manual',
      isModernMode: true,
      pin: null,
      timestampMs: t10,
    }) === null,
    'display: manual source has no timebook key',
  );
}

if (failed > 0) {
  console.error(`\n${failed} timebook test(s) failed`);
  process.exit(1);
}
console.log('\nAll timebook selftests passed.');
