/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * CBQR2 canonical binary codec. node js/tests/cbqr2-selftest.js
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from '../vendor/fflate-browser.js';
import qrcode from '../vendor/qrcode-generator.js';
import { TIME_PROFILE } from '../alberich-key-time.js';
import { generateTimebook } from '../timebook-generate.js';
import { listTimebookSlots, timebookFingerprint, validateTimebook } from '../timebook.js';
import {
  FULL_KEY_BIN_V1_BYTES,
  decodeFullKeyBinV1,
  encodeFullKeyBinV1,
} from '../full-key-binary.js';
import {
  CBQR2_HEADER_PREFIX_BYTES,
  CBQR2_MAGIC,
  decodeCbqr2,
  encodeCbqr2,
  expectedCbqr2Length,
  isCbqr2Bytes,
  timebookBinaryFilename,
} from '../cbqr2-binary.js';
import { parseCodebookJson } from '../codebook.js';
import { buildCompressedQrPayload } from '../codebook-export.js';
import { generateMonthSheet } from '../codebook-generate.js';
import { CipherEngine } from '../cipher-engine.js';
import { modernV3EncryptPayload } from '../modern-v3.js';
import { MAC_SEARCH, searchTimebookPruef20 } from '../timebook-search.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PYTHON = join(ROOT, 'reference/cbqr2_reference.py');

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

function sha256hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digestHex(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return sha256hex(new Uint8Array(buf));
}

function pythonCheck(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'cbqr2-'));
  const path = join(dir, 'pack.bin');
  writeFileSync(path, bytes);
  const r = spawnSync('python3', [PYTHON, path], { encoding: 'utf8' });
  return r;
}

function tryQr(bytes, ecc) {
  if (bytes.length > 2953) {
    return { ok: false, ecc, error: 'over-v40-L-byte' };
  }
  try {
    const qr = qrcode(0, ecc);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    qr.addData(bin, 'Byte');
    qr.make();
    const modules = qr.getModuleCount();
    return { ok: true, ecc, modules, type: (modules - 17) / 4 };
  } catch (err) {
    return { ok: false, ecc, error: String(err?.message || err) };
  }
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

assert(CBQR2_MAGIC === 'ALB3CB2', 'magic ASCII ALB3CB2');
assert(FULL_KEY_BIN_V1_BYTES === 70, 'FULL_KEY_BIN_V1 is 70 bytes');
assert(new TextEncoder().encode(CBQR2_MAGIC).length === 7, 'magic 7 bytes');

{
  const { timebook } = await generateTimebook(2026, 2, TIME_PROFILE.DAY_24H, { rng: lcg(42) });
  const key = timebook.days[0].slots[0].key;
  const enc = encodeFullKeyBinV1(key);
  assert(enc.ok && enc.bytes.length === 70, 'one key encodes to 70 bytes');
  const dec = decodeFullKeyBinV1(enc.bytes);
  assert(dec.ok && JSON.stringify(dec.key) === JSON.stringify(key), 'FULL_KEY_BIN_V1 roundtrip');
  const again = encodeFullKeyBinV1(dec.key);
  assert(again.ok && Buffer.from(again.bytes).equals(Buffer.from(enc.bytes)), 'key encode deterministic');
}

async function roundtrip(year, month, profile, seed, label) {
  const { timebook, stats } = await generateTimebook(year, month, profile, { rng: lcg(seed) });
  const t0 = performance.now();
  const encoded = await encodeCbqr2(timebook);
  const t1 = performance.now();
  assert(encoded.ok, `${label} encode ok`);
  assert(isCbqr2Bytes(encoded.bytes), `${label} file magic ALB3CB2`);
  assert(
    timebookBinaryFilename(timebook) === `alberich-timebook-${year}-${String(month).padStart(2, '0')}.alb3cb2`,
    `${label} binary filename`,
  );
  const encoded2 = await encodeCbqr2(timebook);
  assert(
    encoded2.ok && Buffer.from(encoded.bytes).equals(Buffer.from(encoded2.bytes)),
    `${label} encode deterministic`,
  );
  const t2 = performance.now();
  const decoded = await decodeCbqr2(encoded.bytes);
  const t3 = performance.now();
  assert(decoded.ok, `${label} decode ok`);
  assert(decoded.timebook.codebookFingerprint === timebook.codebookFingerprint, `${label} codebookFingerprint`);
  const a = listTimebookSlots(timebook);
  const b = listTimebookSlots(decoded.timebook);
  assert(a.length === b.length, `${label} slot count`);
  assert(a.every((s, i) => s.fullKeyFingerprint === b[i].fullKeyFingerprint), `${label} slot fingerprints`);
  assert(
    a.every((s, i) => JSON.stringify(s.key) === JSON.stringify(b[i].key)),
    `${label} key fields`,
  );
  assert(decoded.timebook.networkContext === 'ALB', `${label} net ALB preserved`);
  assert(decoded.timebook.timeProfile === profile, `${label} profile`);
  assert(validateTimebook(decoded.timebook).ok, `${label} revalidated`);

  const py = pythonCheck(encoded.bytes);
  assert(py.status === 0, `${label} python reference PASS (${py.stderr || ''})`);
  if (py.status === 0) {
    const info = JSON.parse(py.stdout);
    assert(info.codebookFingerprint === timebook.codebookFingerprint, `${label} python identity`);
  }

  return {
    timebook,
    bytes: encoded.bytes,
    stats,
    encodeMs: t1 - t0,
    decodeMs: t3 - t2,
    digestMs: t2 - t1,
  };
}

const r24 = await roundtrip(2026, 2, TIME_PROFILE.DAY_24H, 42, '24h Feb');
const r4 = await roundtrip(2026, 4, TIME_PROFILE.HOURS_4, 43, '4h Apr');
const r1 = await roundtrip(2026, 2, TIME_PROFILE.HOUR_1, 44, '1h Feb');

{
  const pack = r24.bytes;
  assert(pack[7] === 1 && pack[8] === 0, 'version 1 flags 0');
  const frozen = JSON.parse(readFileSync(join(ROOT, 'reference/cbqr2-golden.json'), 'utf8'));
  assert(frozen.guard === 'CBQR2_BINARY_V1', 'golden file guard');
  const sha24 = await digestHex(r24.bytes);
  const sha4 = await digestHex(r4.bytes);
  const sha1 = await digestHex(r1.bytes);
  assert(sha24 === frozen.vectors[0].packageSha256, 'golden 24h Feb package SHA-256');
  assert(sha4 === frozen.vectors[1].packageSha256, 'golden 4h Apr package SHA-256');
  assert(sha1 === frozen.vectors[2].packageSha256, 'golden 1h Feb package SHA-256');
}

{
  const slots = listTimebookSlots(r24.timebook);
  const engine = new CipherEngine();
  const s = slots[0];
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (code) => configureFromKey(engine, code, s.key),
    groundKey: s.key.keyCode,
    plainText: 'W7',
    messageKey: 'LDNQ',
    messageId: 'CBQR2MID',
    dayConfig: {
      ...s.key,
      notches: s.key.lueckenfueller,
      networkContext: r24.timebook.networkContext,
      epoch: s.epoch,
    },
  });
  const decoded = await decodeCbqr2(r24.bytes);
  const found = await searchTimebookPruef20({
    timebook: decoded.timebook,
    cipherLetters: enc.cipher,
    currentSlot: slots[0],
    engine,
    configure: (code, key) => configureFromKey(engine, code, key),
  });
  assert(found.status === MAC_SEARCH.MATCH && found.decryptCalls === 1, 'W6 search after CBQR2 roundtrip');
}

{
  const good = r24.bytes;
  async function mustReject(bytes, why) {
    const r = await decodeCbqr2(bytes);
    assert(!r.ok && r.rejected === 'IMPORT_REJECTED', why);
  }
  const flip = (i) => {
    const c = new Uint8Array(good);
    c[i] ^= 1;
    return c;
  };
  await mustReject(flip(0), 'mutated magic');
  await mustReject(flip(7), 'mutated version');
  await mustReject(flip(8), 'mutated flags');
  await mustReject(flip(12), 'mutated profile');
  await mustReject(flip(9), 'mutated year');
  await mustReject(flip(11), 'mutated month');
  await mustReject(flip(16), 'mutated key count');
  await mustReject(flip(19 + 3 + 0), 'mutated rotor');
  await mustReject(flip(19 + 3 + 4), 'mutated ring');
  await mustReject(flip(19 + 3 + 12), 'mutated plug');
  await mustReject(flip(19 + 3 + 32), 'mutated endwalze');
  await mustReject(flip(19 + 3 + 58), 'mutated notches');
  await mustReject(flip(good.length - 40), 'mutated codebook fingerprint');
  await mustReject(flip(good.length - 1), 'mutated package digest');
  await mustReject(good.subarray(0, 10), 'truncated header');
  await mustReject(good.subarray(0, 19 + 3 + 40), 'truncated key');
  await mustReject(good.subarray(0, good.length - 1), 'truncated digest');
  const extra = new Uint8Array(good.length + 1);
  extra.set(good);
  extra[extra.length - 1] = 0;
  await mustReject(extra, 'trailing byte');
}

{
  const sheet = await generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation', rng: lcg(5) });
  assert(parseCodebookJson(JSON.stringify(sheet)).ok, 'legacy JSON still parses');
  const qr = buildCompressedQrPayload(sheet);
  assert(qr.payload.startsWith('ALBERICH-CBQR1|gzip|'), 'CBQR1 envelope unchanged');
}

{
  const rows = [];
  async function measure(year, month, profile, seed, name) {
    const { timebook, stats } = await generateTimebook(year, month, profile, { rng: lcg(seed) });
    const encoded = await encodeCbqr2(timebook);
    const raw = encoded.bytes;
    const gzip = gzipSync(raw, { level: 9 });
    const t0 = performance.now();
    await encodeCbqr2(timebook);
    const t1 = performance.now();
    await decodeCbqr2(raw);
    const t2 = performance.now();
    const qrM = tryQr(raw, 'M');
    const qrL = tryQr(raw, 'L');
    rows.push({
      name,
      days: timebook.days.length,
      keys: stats.keyCount,
      js: stats.approxBytes,
      raw: raw.length,
      gzip: gzip.length,
      perKey: FULL_KEY_BIN_V1_BYTES,
      header: raw.length - stats.keyCount * FULL_KEY_BIN_V1_BYTES,
      encodeMs: t1 - t0,
      decodeMs: t2 - t1,
      qrM: qrM.ok ? `v${qrM.type}/${qrM.modules}` : 'no',
      qrL: qrL.ok ? `v${qrL.type}/${qrL.modules}` : 'no',
    });
  }
  await measure(2026, 2, TIME_PROFILE.DAY_24H, 1, '24h-28');
  await measure(2026, 8, TIME_PROFILE.DAY_24H, 2, '24h-31');
  await measure(2026, 2, TIME_PROFILE.HOURS_4, 3, '4h-28');
  await measure(2026, 8, TIME_PROFILE.HOURS_4, 4, '4h-31');
  await measure(2026, 2, TIME_PROFILE.HOUR_1, 5, '1h-28');
  await measure(2026, 8, TIME_PROFILE.HOUR_1, 6, '1h-31');
  console.log('W7 size/QR');
  for (const r of rows) {
    console.log(
      `${r.name} keys=${r.keys} js=${r.js} raw=${r.raw} gzip=${r.gzip} header=${r.header} enc=${r.encodeMs.toFixed(1)}ms dec=${r.decodeMs.toFixed(1)}ms qrM=${r.qrM} qrL=${r.qrL}`,
    );
  }
  globalThis.__w7rows = rows;
}

{
  const net = r24.timebook.networkContext;
  const expect = expectedCbqr2Length(2026, 2, TIME_PROFILE.DAY_24H, net.length);
  assert(r24.bytes.length === expect, 'length formula matches package');
  assert(CBQR2_HEADER_PREFIX_BYTES === 19, 'header prefix 19');
}

if (failed > 0) {
  console.error(`\n${failed} CBQR2 test(s) failed`);
  process.exit(1);
}
console.log('\nAll CBQR2 selftests passed.');
