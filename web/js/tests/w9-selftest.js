/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W9 laboratory QR channel. node js/tests/w9-selftest.js
 */
import { TIME_PROFILE } from '../alberich-key-time.js';
import { generateTimebook } from '../timebook-generate.js';
import { TRANSPORT_CODEC } from '../cbqr2-transport.js';
import { UrBytesEncoder } from '../ur-bytes.js';
import { decodeJsQrFromRgba, LabReceiver, TRANSFER, classifyCameraError } from '../cbqr2-lab-scan.js';
import {
  DISPLAY_PRESETS,
  encodeDynamicFrame,
  encodeLabQr,
  encodeStaticFrame,
  isQrAlphanumeric,
  rasterizeQrToRgba,
  urForQr,
} from '../cbqr2-lab-qr.js';
import { freezeShareSession, LAB_MODE, nextSessionFrame } from '../cbqr2-lab-session.js';

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

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

{
  const ur = 'ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadae';
  assert(!isQrAlphanumeric(ur), 'lowercase UR is not alphanumeric');
  assert(isQrAlphanumeric(urForQr(ur)), 'uppercase UR is alphanumeric');
  let threw = false;
  try { encodeLabQr(ur, { mode: 'Alphanumeric' }); } catch { threw = true; }
  assert(threw, 'qrcode-generator Alphanumeric rejects lowercase');
  const alnum = encodeDynamicFrame(ur, 'M');
  const byte = encodeLabQr(urForQr(ur), { ecc: 'M', mode: 'Byte' });
  assert(alnum.mode === 'Alphanumeric', 'dynamic mode is Alphanumeric');
  assert(alnum.type < byte.type || alnum.modules < byte.modules, 'Alphanumeric uses fewer modules than Byte');
  const staticSample = 'ALBERICH-CBQR2|v1|abc_def-0123';
  assert(!isQrAlphanumeric(staticSample), 'static envelope is not alphanumeric');
  const st = encodeStaticFrame(staticSample, 'M');
  assert(st.mode === 'Byte', 'static uses Byte mode');
}

{
  const err = new Error('denied');
  err.name = 'NotAllowedError';
  assert(classifyCameraError(err) === 'permission-denied', 'camera permission class');
  const nf = new Error('x');
  nf.name = 'NotFoundError';
  assert(classifyCameraError(nf) === 'no-camera', 'no camera class');
  const sc = new Error('camera.needHttps');
  sc.name = 'SecurityError';
  assert(classifyCameraError(sc) === 'insecure-context', 'insecure class');
}

const { timebook: book24 } = await generateTimebook(2026, 1, TIME_PROFILE.DAY_24H, { rng: lcg(2) });
const { timebook: book4 } = await generateTimebook(2026, 8, TIME_PROFILE.HOURS_4, { rng: lcg(4) });
const { timebook: book1 } = await generateTimebook(2026, 8, TIME_PROFILE.HOUR_1, { rng: lcg(6) });

{
  const sess = await freezeShareSession({
    timebook: book4,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: 250,
  });
  assert(sess.ok && sess.seqLen > 1, 'freeze 4h gzip dynamic');
  const fp = sess.codebookFingerprint;
  const sha = sess.cbqr2Sha256;
  const originalYear = book4.year;
  book4.year = 1999;
  const frame = await nextSessionFrame(sess);
  book4.year = originalYear;
  const rec = new LabReceiver();
  const raster = rasterizeQrToRgba(encodeDynamicFrame(frame, 'M').qr, { modulePx: 3 });
  const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
  assert(text && text.toUpperCase() === urForQr(frame), 'jsQR reads alphanumeric UR frame');
  await rec.ingest(text);
  assert(rec.status !== TRANSFER.VALID, 'one frame is not complete');
  assert(sess.codebookFingerprint === fp && sess.cbqr2Sha256 === sha, 'frozen identity unchanged after timebook mutation');
}

{
  const sess = await freezeShareSession({
    timebook: book24,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.STATIC,
  });
  assert(sess.ok && sess.staticText.startsWith('ALBERICH-CBQR2|v1|'), 'static text envelope');
  const encoded = encodeStaticFrame(sess.staticText, 'M');
  const rec = new LabReceiver();
  const raster = rasterizeQrToRgba(encoded.qr, { modulePx: 3 });
  const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
  const got = await rec.ingest(text);
  assert(got.status === TRANSFER.VALID, 'static optical TRANSFER_VALID');
  assert(rec.codebookFingerprint === sess.codebookFingerprint, 'static fingerprint match');
  assert(rec.cbqr2Sha256 === sess.cbqr2Sha256, 'static canonical SHA-256 match');
}

{
  const noise = new Uint8Array(64);
  for (let i = 0; i < noise.length; i++) noise[i] = i * 3 + 7;
  const enc = new UrBytesEncoder(noise, { maxFragmentLen: 40, minFragmentLen: 10 });
  const rec = new LabReceiver();
  let n = 0;
  while (rec.status === TRANSFER.PENDING && n < enc.seqLen * 10) {
    await rec.ingest(await enc.nextPart());
    n += 1;
  }
  assert(rec.status === TRANSFER.INVALID, 'garbage envelope → TRANSFER_INVALID');
  assert(rec.timebook == null, 'invalid transfer stores no keys');
}

{
  const sess = await freezeShareSession({
    timebook: book4,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: 250,
  });
  const rec = new LabReceiver();
  const first = await nextSessionFrame(sess);
  await rec.ingest(first);
  const p1 = rec.progress();
  await rec.ingest(first);
  await rec.ingest(first);
  const p2 = rec.progress();
  assert(p2.duplicates >= 2, 'duplicate QR strings counted');
  assert(p2.reconstructed === p1.reconstructed, 'duplicates do not increase reconstructed fragments');
  assert(p2.processedPartsCount === p1.processedPartsCount, 'dedupe happens before decoder');
  assert(p2.label.includes('/'), 'progress label uses reconstructed/seqLen');
  rec.abort();
  assert(rec.seen.size === 0 && rec.uniqueQr === 0, 'abort clears ephemeral state');
}

async function opticalTransfer(session, { modulePx = 3, loss = 0, seed = 1, capFactor = 10 } = {}) {
  const rec = new LabReceiver();
  const rng = mulberry(seed);
  const cap = session.seqLen * capFactor;
  let generated = 0;
  let decoded = 0;
  const t0 = performance.now();
  while (rec.status === TRANSFER.PENDING && generated < cap) {
    const frame = await nextSessionFrame(session);
    generated += 1;
    if (rng() < loss) continue;
    const encoded = session.mode === LAB_MODE.STATIC
      ? encodeStaticFrame(frame, session.ecc)
      : encodeDynamicFrame(frame, session.ecc);
    const raster = rasterizeQrToRgba(encoded.qr, { modulePx });
    const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
    if (!text) continue;
    decoded += 1;
    await rec.ingest(text);
  }
  const t1 = performance.now();
  return {
    status: rec.status,
    seqLen: session.seqLen,
    generated,
    decoded,
    unique: rec.uniqueQr,
    reconstructed: rec.reconstructedFragments,
    duplicates: rec.duplicates,
    elapsedMs: t1 - t0,
    fingerprintOk: rec.codebookFingerprint === session.codebookFingerprint,
    shaOk: rec.cbqr2Sha256 === session.cbqr2Sha256,
    type: rec.status === TRANSFER.VALID ? encodeDynamicFrame(session.staticText || 'UR:BYTES/1-1/AA', session.ecc).type : null,
  };
}

const staticRows = [];
{
  for (const [days, month, seed] of [[28, 2, 1], [30, 4, 30], [31, 1, 2]]) {
    const { timebook } = await generateTimebook(2026, month, TIME_PROFILE.DAY_24H, { rng: lcg(seed) });
    const sess = await freezeShareSession({
      timebook,
      codec: TRANSPORT_CODEC.GZIP,
      mode: LAB_MODE.STATIC,
    });
    const encoded = encodeStaticFrame(sess.staticText, 'M');
    const row = {
      days,
      qrVersion: encoded.type,
      modules: encoded.modules,
      chars: encoded.chars,
    };
    for (const px of [1, 2, 3, 4]) {
      const raster = rasterizeQrToRgba(encoded.qr, { modulePx: px });
      const t0 = performance.now();
      const text = decodeJsQrFromRgba(raster.data, raster.width, raster.height);
      const rec = new LabReceiver();
      if (text) await rec.ingest(text);
      row[`px${px}`] = rec.status === TRANSFER.VALID ? `PASS ${(performance.now() - t0).toFixed(1)}ms ${raster.dim}px` : 'FAIL';
    }
    staticRows.push(row);
    assert(row.px3.startsWith('PASS'), `static ${days}d optical at 3px/module`);
  }
}

const dynRows = [];
{
  for (const frag of [200, 250, 300]) {
    const sess = await freezeShareSession({
      timebook: book4,
      codec: TRANSPORT_CODEC.GZIP,
      mode: LAB_MODE.DYNAMIC,
      maxFragmentLen: frag,
    });
    const first = await nextSessionFrame(sess);
    const meta = encodeDynamicFrame(first, 'M');
    const run = await opticalTransfer(sess, { modulePx: 3, loss: 0, seed: 7 });
    dynRows.push({
      profile: '4h-31',
      fragment: frag,
      fpsHint: 4,
      qrVersion: meta.type,
      modules: meta.modules,
      seqLen: sess.seqLen,
      generated: run.generated,
      decoded: run.decoded,
      theoreticalSec: (run.generated / 4).toFixed(2),
      opticalMs: run.elapsedMs.toFixed(1),
      loss: 0,
      success: run.status === TRANSFER.VALID && run.fingerprintOk && run.shaOk,
    });
    assert(run.status === TRANSFER.VALID && run.shaOk, `4h optical frag ${frag}`);
  }
}

{
  const sess = await freezeShareSession({
    timebook: book4,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: 250,
  });
  const run = await opticalTransfer(sess, { modulePx: 3, loss: 0.25, seed: 11 });
  dynRows.push({
    profile: '4h-31',
    fragment: 250,
    fpsHint: 4,
    qrVersion: 15,
    seqLen: sess.seqLen,
    generated: run.generated,
    decoded: run.decoded,
    theoreticalSec: (run.generated / 4).toFixed(2),
    opticalMs: run.elapsedMs.toFixed(1),
    loss: 0.25,
    success: run.status === TRANSFER.VALID && run.shaOk,
  });
  assert(run.status === TRANSFER.VALID && run.shaOk, '4h optical 25% frame drop');
}

{
  for (const frag of [200, 250, 300]) {
    const sess = await freezeShareSession({
      timebook: book1,
      codec: TRANSPORT_CODEC.GZIP,
      mode: LAB_MODE.DYNAMIC,
      maxFragmentLen: frag,
    });
    const first = await nextSessionFrame(sess);
    const meta = encodeDynamicFrame(first, 'M');
    const run = await opticalTransfer(sess, { modulePx: 3, loss: 0, seed: 3 + frag });
    dynRows.push({
      profile: '1h-31',
      fragment: frag,
      fpsHint: 4,
      qrVersion: meta.type,
      modules: meta.modules,
      seqLen: sess.seqLen,
      generated: run.generated,
      decoded: run.decoded,
      theoreticalSec: (run.generated / 4).toFixed(2),
      opticalMs: run.elapsedMs.toFixed(1),
      loss: 0,
      success: run.status === TRANSFER.VALID && run.shaOk,
    });
    assert(run.status === TRANSFER.VALID && run.shaOk, `1h-31 optical frag ${frag}`);
  }
}

{
  const rawSess = await freezeShareSession({
    timebook: book24,
    codec: TRANSPORT_CODEC.RAW,
    mode: LAB_MODE.STATIC,
  });
  const rec = new LabReceiver();
  await rec.ingest(rawSess.staticText);
  assert(rec.status === TRANSFER.VALID && rec.codec === TRANSPORT_CODEC.RAW, 'RAW static text still decodes');
  let overflow = false;
  try { encodeStaticFrame(rawSess.staticText, 'M'); } catch { overflow = true; }
  assert(overflow, 'RAW 24h static does not fit ECC M (expected)');
}

console.log('\nW9 static optical (jsQR on raster, not a phone camera)');
console.log('days  version  modules  chars  1px  2px  3px  4px');
for (const r of staticRows) {
  console.log(`${r.days}  v${r.qrVersion}  ${r.modules}  ${r.chars}  ${r.px1}  ${r.px2}  ${r.px3}  ${r.px4}`);
}

console.log('\nW9 dynamic optical');
console.log('profile frag loss seqLen qr generated decoded t@4fps success');
for (const r of dynRows) {
  console.log(
    `${r.profile} ${r.fragment} ${r.loss} ${r.seqLen} v${r.qrVersion} ${r.generated} ${r.decoded} ${r.theoreticalSec}s ${r.success ? 'PASS' : 'FAIL'}`,
  );
}

console.log('\nW9 display presets CSS px', DISPLAY_PRESETS);

globalThis.__w9 = { staticRows, dynRows };

if (failed) {
  console.error(`\n${failed} W9 test(s) failed`);
  process.exit(1);
}
console.log('\nW9 laboratory selftest passed.');
