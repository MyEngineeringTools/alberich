/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W10 product integration tests. node js/tests/w10-selftest.js
 */
import { TIME_PROFILE, formatSlotHours, getSlotForTimestamp } from '../alberich-key-time.js';
import { generateTimebook } from '../timebook-generate.js';
import { isTimebook, rejectTimebookExport, resolveTimebookSlot } from '../timebook.js';
import { CBQR2_MUR_PROFILE_V1 } from '../cbqr2-mur-profile.js';
import { beginTimebookSendSession, decryptTimebookTelegram, MAC_SEARCH } from '../timebook-session.js';
import { configureSecurityState, resetSecurityStateForTests, START } from '../security-state.js';
import { createFakeIndexedDB } from './fake-indexeddb.js';
import { CipherEngine } from '../cipher-engine.js';
import { modernV3EncryptPayload } from '../modern-v3.js';
import { applyKeyCode, applyRingCode } from '../text-processing.js';
import { freezeShareSession, LAB_MODE } from '../cbqr2-lab-session.js';
import { LabReceiver, TRANSFER } from '../cbqr2-lab-scan.js';
import { TRANSPORT_CODEC } from '../cbqr2-transport.js';
import { parseCodebookQrPayload } from '../codebook-qr.js';
import { generateMonthSheet } from '../codebook-generate.js';
import { buildCompressedQrPayload } from '../codebook-export.js';
import { encodeDynamicFrame, rasterizeQrToRgba } from '../cbqr2-lab-qr.js';
import { decodeJsQrFromRgba } from '../cbqr2-lab-scan.js';
import { createModernSession } from '../modern-session.js';
import { acceptStoredSheet, migrateNetworksState } from '../networks.js';
import { decodeCbqr2, encodeCbqr2, isCbqr2Bytes, timebookBinaryFilename } from '../cbqr2-binary.js';

resetSecurityStateForTests();
{
  const idb = createFakeIndexedDB();
  configureSecurityState({ idbFactory: () => idb, locks: () => null });
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

function lcg(seed) {
  let s = seed >>> 0;
  return (max) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

assert(CBQR2_MUR_PROFILE_V1.maxFragmentLen === 250, 'MUR profile fragment 250');
assert(CBQR2_MUR_PROFILE_V1.fps === 4, 'MUR profile 4 fps');
assert(CBQR2_MUR_PROFILE_V1.ecc === 'M', 'MUR profile ECC M');

const { timebook: book4 } = await generateTimebook(2026, 8, TIME_PROFILE.HOURS_4, { rng: lcg(4) });
const { timebook: book24 } = await generateTimebook(2026, 1, TIME_PROFILE.DAY_24H, { rng: lcg(2) });
const { timebook: book1 } = await generateTimebook(2026, 8, TIME_PROFILE.HOUR_1, { rng: lcg(6) });

assert(isTimebook(book4) && book4.days[0].slots.length === 6, '4h has 6 slots/day');
assert(book24.days[0].slots.length === 1, '24h has 1 slot/day');
assert(book1.days[0].slots.length === 24, '1h has 24 slots/day');
assert(book1.days.length * 24 === 744, '1h August 744 keys');

{
  let threw = false;
  try { rejectTimebookExport(book4); } catch { threw = true; }
  assert(threw, 'timebook cannot export CBQR1');
  const packed = await encodeCbqr2(book4);
  assert(packed.ok && isCbqr2Bytes(packed.bytes), 'timebook can export CBQR2 binary file');
  const back = await decodeCbqr2(packed.bytes);
  assert(back.ok && back.timebook.codebookFingerprint === book4.codebookFingerprint, 'binary file roundtrip');
  assert(timebookBinaryFilename(book4).endsWith('.alb3cb2'), 'binary filename extension');
}

{
  const noon = Date.UTC(2026, 7, 3, 11, 0, 0); // 12:00 ALB = 11:00 UTC
  const slot = getSlotForTimestamp(noon, TIME_PROFILE.HOURS_4);
  assert(formatSlotHours(slot) === `12\u201316`, 'slot hours 12–16');
  const resolved = resolveTimebookSlot(book4, noon);
  assert(resolved.ok && resolved.epoch === '2026-08-03', 'epoch is sheet day not slot id');
  assert(!String(resolved.epoch).includes('HOURS_4'), 'epoch has no slot id');
  assert(resolved.meta.slotIndex === 3, 'timestamp resolver uses clock not slot object');
}

{
  const stored = acceptStoredSheet(book4);
  assert(stored && stored.codebookFingerprint === book4.codebookFingerprint, 'timebook survives acceptStoredSheet');
  const migrated = migrateNetworksState({
    networks: [{ id: 'net-1', name: 'Familie', sheet: book4, selectedDay: 3 }],
    activeNetworkId: 'net-1',
  });
  assert(isTimebook(migrated.codebookSheet), 'reload keeps timebook in network store');
  assert(migrated.codebookSheet.codebookFingerprint === book4.codebookFingerprint, 'reload fingerprint');
  assert(!book4.monthLabel, 'CBQR2/timebook has no monthLabel until the UI attaches it');
  const badgeMonth = book4.monthLabel || `${book4.year}-${String(book4.month).padStart(2, '0')}`;
  assert(badgeMonth === '2026-08', 'network chip can show month without legacy tafelwort');
  assert(/^[0-9a-f]{64}$/.test(book4.codebookFingerprint), 'network chip can show fingerprint');
}

function configureFromKey(engine, key, code) {
  const pos = applyKeyCode(code);
  const rings = applyRingCode(key.ringCode);
  engine.setRotors(
    key.rotorLeft, key.rotorMiddle, key.rotorRight, key.rotorThin,
    pos[1], pos[2], pos[3], pos[0],
    rings.left, rings.middle, rings.right, rings.thin,
  );
  engine.setPlugboard(key.plugboard);
  engine.setThinRing(rings.thin);
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setEndwalze(key.endwalzeWiring);
  engine.setLueckenfuellerNotches(key.lueckenfueller);
  return true;
}

let mkSeq = 0;
function nextTestMk() {
  mkSeq += 1;
  const n = mkSeq;
  return String.fromCharCode(65 + (n % 26), 65 + ((n * 3) % 26), 65 + ((n * 5) % 26), 65 + ((n * 7) % 26));
}

async function encryptOnBook(book, text, timestampMs) {
  const engine = new CipherEngine();
  const started = await beginTimebookSendSession({
    timebook: book,
    timestampMs,
    nextMessageKey: nextTestMk,
  });
  if (!started.ok) return started;
  const key = started.pin.fullKey;
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (code) => configureFromKey(engine, key, code),
    groundKey: key.keyCode,
    plainText: text,
    messageKey: started.messageKey,
    messageId: 'TESTMSGX',
    dayConfig: {
      ...key,
      notches: key.lueckenfueller,
      networkContext: book.networkContext,
      epoch: started.pin.epoch,
    },
  });
  return { ...started, enc };
}

{
  const ts = Date.UTC(2026, 7, 3, 11, 0, 0);
  const out = await encryptOnBook(book4, 'Hallo', ts);
  assert(out.ok && out.enc.ok, 'encrypt on 4h timebook');
  assert(out.enc.cipher.startsWith('ALBV'), 'ALBV stamp');
  assert(out.pin.epoch === '2026-08-03', 'send pin epoch is sheet day');
  const engine = new CipherEngine();
  const found = await decryptTimebookTelegram({
    timebook: book4,
    cipherLetters: out.enc.cipher,
    currentSlot: getSlotForTimestamp(ts, TIME_PROFILE.HOURS_4),
    engine,
    configure: (code, key) => configureFromKey(engine, key, code),
  });
  assert(found.status === MAC_SEARCH.MATCH && found.decryptCalls === 1, 'MAC-first one decrypt');
  assert(found.result.plainText === 'Hallo', 'decrypt recovers plaintext');
}

{
  const ts12 = Date.UTC(2026, 7, 3, 11, 0, 0);
  const ts16 = Date.UTC(2026, 7, 3, 15, 1, 0);
  const session = createModernSession();
  const started = await beginTimebookSendSession({
    timebook: book4,
    timestampMs: ts12,
    nextMessageKey: () => 'PINK',
  });
  assert(started.ok, 'pin session authorizes at 12:00');
  session.noteAuthorized({ ...started.pin, messageKey: started.messageKey });
  const pin = session.pinnedSlot();
  assert(pin.epoch === '2026-08-03' && pin.fullKey, 'noteAuthorized keeps epoch');
  const laterSlot = resolveTimebookSlot(book4, ts16);
  assert(laterSlot.ok && laterSlot.fullKeyFingerprint !== pin.fullKeyFingerprint, 'clock moved to a new slot');
  assert(session.pinnedSlot().fullKeyFingerprint === started.pin.fullKeyFingerprint, 'pin survives slot tick');
}

{
  const ts = Date.UTC(2026, 7, 3, 11, 0, 0);
  const out = await encryptOnBook(book4, 'Hallo', ts);
  assert(out.ok && out.enc.ok, 'second encrypt on 4h timebook');
  const engine = new CipherEngine();
  const found = await decryptTimebookTelegram({
    timebook: book24,
    cipherLetters: out.enc.cipher,
    currentSlot: getSlotForTimestamp(ts, TIME_PROFILE.DAY_24H),
    engine,
    configure: (code, key) => configureFromKey(engine, key, code),
  });
  assert(found.status === MAC_SEARCH.NO_KEY_MATCH && found.decryptCalls === 0, 'wrong book no decrypt');
}

{
  const past = Date.UTC(2026, 7, 1, 10, 0, 0);
  await encryptOnBook(book4, 'A', Date.UTC(2026, 7, 10, 10, 0, 0));
  const { externalizePinnedSlot } = await import('../timebook-session.js');
  const later = await beginTimebookSendSession({
    timebook: book4,
    timestampMs: Date.UTC(2026, 7, 20, 10, 0, 0),
    nextMessageKey: nextTestMk,
  });
  assert(later.ok, 'later slot authorizes');
  await externalizePinnedSlot(later.pin);
  const early = await beginTimebookSendSession({
    timebook: book4,
    timestampMs: past,
    nextMessageKey: nextTestMk,
  });
  assert(early.error === 'modern.timeRollback' && early.status === START.TIME_ROLLBACK_BLOCKED, 'rollback blocks send');
}

async function opticalRoundtrip(book, name) {
  const sess = await freezeShareSession({
    timebook: book,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: CBQR2_MUR_PROFILE_V1.maxFragmentLen,
  });
  const rec = new LabReceiver();
  let n = 0;
  while (rec.status === TRANSFER.PENDING && n < sess.seqLen * 10) {
    const frame = await sess._encoder.nextPart();
    const encoded = encodeDynamicFrame(frame, CBQR2_MUR_PROFILE_V1.ecc);
    const raster = rasterizeQrToRgba(encoded.qr, { modulePx: 3 });
    const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
    if (text) await rec.ingest(text);
    n += 1;
  }
  assert(rec.status === TRANSFER.VALID, `${name} optical TRANSFER_VALID`);
  assert(rec.codebookFingerprint === book.codebookFingerprint, `${name} fingerprint`);
  assert(rec.cbqr2Sha256 === sess.cbqr2Sha256, `${name} SHA-256`);
}

await opticalRoundtrip(book24, '24h');
await opticalRoundtrip(book4, '4h');

{
  const sess = await freezeShareSession({
    timebook: book4,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: CBQR2_MUR_PROFILE_V1.maxFragmentLen,
  });
  const rec = new LabReceiver();
  let n = 0;
  let dropped = 0;
  while (rec.status === TRANSFER.PENDING && n < sess.seqLen * 12) {
    const frame = await sess._encoder.nextPart();
    n += 1;
    if (n % 4 === 0) {
      dropped += 1;
      continue;
    }
    const encoded = encodeDynamicFrame(frame, CBQR2_MUR_PROFILE_V1.ecc);
    const raster = rasterizeQrToRgba(encoded.qr, { modulePx: 3 });
    const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
    if (text) await rec.ingest(text);
  }
  assert(dropped > 0, '4h drop simulation skipped frames');
  assert(rec.status === TRANSFER.VALID, '4h 25% drop still TRANSFER_VALID');
  assert(rec.codebookFingerprint === book4.codebookFingerprint, '4h drop fingerprint');
}

{
  const sess = await freezeShareSession({
    timebook: book1,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: CBQR2_MUR_PROFILE_V1.maxFragmentLen,
  });
  const rec = new LabReceiver();
  let n = 0;
  while (rec.status === TRANSFER.PENDING && n < sess.seqLen * 8) {
    const frame = await sess._encoder.nextPart();
    await rec.ingest(frame);
    n += 1;
  }
  assert(rec.status === TRANSFER.VALID, '1h MUR text TRANSFER_VALID');
  assert(rec.codebookFingerprint === book1.codebookFingerprint, '1h fingerprint');
  assert(rec.cbqr2Sha256 === sess.cbqr2Sha256, '1h SHA-256');
}

{
  const sheet = await generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation', rng: lcg(5) });
  const qr = buildCompressedQrPayload(sheet);
  assert(qr.payload.startsWith('ALBERICH-CBQR1|gzip|'), 'CBQR1 static payload unchanged');
  const parsed = parseCodebookQrPayload(qr.payload);
  assert(parsed.ok, 'CBQR1 still imports');
}

if (failed) {
  console.error(`\n${failed} W10 test(s) failed`);
  process.exit(1);
}
console.log('\nW10 integration selftest passed.');
