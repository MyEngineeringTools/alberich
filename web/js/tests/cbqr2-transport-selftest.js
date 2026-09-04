/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W8 transport envelope, MUR glue, loss/reorder, benches.
 * node js/tests/cbqr2-transport-selftest.js
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from '../vendor/fflate-browser.js';
import qrcode from '../vendor/qrcode-generator.js';
import { TIME_PROFILE } from '../alberich-key-time.js';
import { generateTimebook } from '../timebook-generate.js';
import { encodeCbqr2, decodeCbqr2 } from '../cbqr2-binary.js';
import {
  MAX_CBQR2_BYTES,
  MAX_ENVELOPE_BYTES,
  TRANSPORT_CODEC,
  TRANSPORT_MAGIC,
  TRANSPORT_VERSION,
  decodeCbqr2Transport,
  decodeStaticText,
  encodeCbqr2Transport,
  encodeStaticText,
  hasNativeGzip,
} from '../cbqr2-transport.js';
import { bytesToHex, hexToBytes } from '../mur-fountain.js';
import { UrBytesDecoder, UrBytesEncoder, encodeSinglePartUr } from '../ur-bytes.js';
import { acceptEnvelopeToTimebook, encodeTimebookToMur } from '../cbqr2-mur.js';
import { timebookFingerprint } from '../timebook.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN = JSON.parse(readFileSync(join(ROOT, 'reference/cbqr2-transport-golden.json'), 'utf8'));
const PYTHON = join(ROOT, 'reference/cbqr2_transport_reference.py');

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

function tryQrText(text, ecc, mode = 'Byte') {
  try {
    const qr = qrcode(0, ecc);
    qr.addData(text, mode);
    qr.make();
    const modules = qr.getModuleCount();
    return { ok: true, ecc, mode, modules, type: (modules - 17) / 4, chars: text.length };
  } catch (err) {
    return { ok: false, ecc, mode, chars: text.length, error: String(err?.message || err) };
  }
}

function pythonRaw(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'cbqr2t-'));
  const path = join(dir, 'env.bin');
  writeFileSync(path, bytes);
  return spawnSync('python3', [PYTHON, path]);
}

assert(TRANSPORT_MAGIC === 'ALB3Q2', 'transport magic ALB3Q2');
assert(TRANSPORT_MAGIC !== 'ALB3CB2', 'transport magic ≠ CBQR2 magic');
assert(TRANSPORT_VERSION === 1, 'transport version 1');
assert(MAX_CBQR2_BYTES === 52179, `MAX_CBQR2_BYTES 52179 (got ${MAX_CBQR2_BYTES})`);
assert(hasNativeGzip(), 'native CompressionStream/DecompressionStream present');

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW);
  assert(env.ok, 'RAW encode ok');
  assert(bytesToHex(env.bytes) === GOLDEN.raw.envelopeHex, 'RAW envelope byte-exact golden');
  const dec = await decodeCbqr2Transport(env.bytes);
  assert(dec.ok && bytesToHex(dec.bytes) === GOLDEN.raw.innerHex, 'RAW decode roundtrip');
  const py = pythonRaw(env.bytes);
  assert(py.status === 0 && bytesToHex(new Uint8Array(py.stdout)) === GOLDEN.raw.innerHex, 'Python RAW independent decode');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const gz = await encodeCbqr2Transport(inner, TRANSPORT_CODEC.GZIP);
  assert(gz.ok && gz.codec === 1, 'GZIP encode ok');
  const dec = await decodeCbqr2Transport(gz.bytes);
  assert(dec.ok && bytesToHex(dec.bytes) === GOLDEN.raw.innerHex, 'native GZIP decode roundtrip');
  const fflateOut = gunzipSync(gz.bytes.subarray(12));
  assert(bytesToHex(fflateOut) === GOLDEN.raw.innerHex, 'fflate decodes native gzip payload');
  const fflateGz = gzipSync(inner);
  const env2 = new Uint8Array(12 + fflateGz.length);
  env2.set(gz.bytes.subarray(0, 12));
  env2[7] = TRANSPORT_CODEC.GZIP;
  env2.set(fflateGz, 12);
  const dec2 = await decodeCbqr2Transport(env2);
  assert(dec2.ok && bytesToHex(dec2.bytes) === GOLDEN.raw.innerHex, 'native decoder accepts fflate gzip');
  const py = pythonRaw(gz.bytes);
  assert(py.status === 0 && bytesToHex(new Uint8Array(py.stdout)) === GOLDEN.raw.innerHex, 'Python GZIP independent decode');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const raw = await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW);
  const flip = (i) => {
    const c = new Uint8Array(raw.bytes);
    c[i] ^= 1;
    return c;
  };
  async function mustReject(bytes, name, code) {
    const r = await decodeCbqr2Transport(bytes);
    assert(!r.ok && (!code || r.error === code), `reject ${name} (${r.error})`);
  }
  await mustReject(flip(0), 'mutated magic', 'transport.err.magic');
  const ver = new Uint8Array(raw.bytes);
  ver[6] = 2;
  await mustReject(ver, 'unknown version', 'transport.err.version');
  const codec = new Uint8Array(raw.bytes);
  codec[7] = 2;
  await mustReject(codec, 'unknown codec', 'transport.err.codec');
  const sniff = new Uint8Array(raw.bytes);
  sniff[12] = 0x1f;
  sniff[13] = 0x8b;
  const sniffed = await decodeCbqr2Transport(sniff);
  assert(sniffed.ok && sniffed.codec === 0, 'RAW does not sniff gzip magic');
  const short = raw.bytes.subarray(0, 11);
  await mustReject(short, 'truncated header', 'transport.err.truncated');
  const mismatch = new Uint8Array(raw.bytes);
  mismatch[11] = 99;
  await mustReject(mismatch, 'RAW length mismatch', 'transport.err.rawLength');
}

{
  const inner = new Uint8Array(200);
  for (let i = 0; i < inner.length; i++) inner[i] = i & 255;
  const gz = gzipSync(inner);
  const env = new Uint8Array(12 + gz.length);
  env.set(new TextEncoder().encode('ALB3Q2'));
  env[6] = 1;
  env[7] = TRANSPORT_CODEC.GZIP;
  new DataView(env.buffer).setUint32(8, 10, false);
  env.set(gz, 12);
  const r = await decodeCbqr2Transport(env);
  assert(!r.ok && (r.error === 'transport.err.gzipBomb' || r.error === 'transport.err.rawLength'), `gzip bomb/length reject (${r.error})`);
}

{
  const huge = new Uint8Array(12 + 8);
  huge.set(new TextEncoder().encode('ALB3Q2'));
  huge[6] = 1;
  huge[7] = TRANSPORT_CODEC.GZIP;
  new DataView(huge.buffer).setUint32(8, MAX_CBQR2_BYTES + 1, false);
  const r = await decodeCbqr2Transport(huge);
  assert(!r.ok && r.error === 'transport.err.rawLength', 'declared length above MAX_CBQR2 reject');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW);
  const encoder = new UrBytesEncoder(env.bytes, {
    maxFragmentLen: GOLDEN.mur.maxFragmentLength,
    minFragmentLen: GOLDEN.mur.minFragmentLength,
    firstSeqNum: GOLDEN.mur.firstSeqNum,
  });
  assert(encoder.seqLen === GOLDEN.mur.seqLen, 'Alberich MUR seqLen');
  const frames = [];
  for (let i = 0; i < GOLDEN.mur.firstFrames.length; i++) frames.push(await encoder.nextPart());
  assert(JSON.stringify(frames) === JSON.stringify(GOLDEN.mur.firstFrames), 'Alberich MUR first frames frozen');
  const dec = new UrBytesDecoder();
  await dec.receive(frames[0]);
  await dec.receive(frames[1]);
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(env.bytes), 'golden frames reconstruct envelope');
}

{
  const { timebook } = await generateTimebook(2026, 2, TIME_PROFILE.DAY_24H, { rng: lcg(42) });
  const fp = await timebookFingerprint(timebook);
  const packed = await encodeCbqr2(timebook);
  for (const codec of [TRANSPORT_CODEC.RAW, TRANSPORT_CODEC.GZIP]) {
    const env = await encodeCbqr2Transport(packed.bytes, codec);
    const mur = new UrBytesEncoder(env.bytes, { maxFragmentLen: 200, minFragmentLen: 10 });
    const dec = new UrBytesDecoder();
    let n = 0;
    while (!dec.isComplete && n < mur.seqLen * 10) {
      await dec.receive(await mur.nextPart());
      n += 1;
    }
    const accepted = await acceptEnvelopeToTimebook(dec.result);
    assert(
      accepted.ok && accepted.timebook.codebookFingerprint === fp,
      `pipeline codec=${codec} ACCEPTED fingerprint`,
    );
  }
}

async function collectFrames(encoder, count) {
  const frames = [];
  for (let i = 0; i < count; i++) frames.push(await encoder.nextPart());
  return frames;
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const envA = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const innerB = new Uint8Array(inner);
  innerB[0] ^= 0xff;
  const envB = (await encodeCbqr2Transport(innerB, TRANSPORT_CODEC.RAW)).bytes;
  const encA = new UrBytesEncoder(envA, { maxFragmentLen: 20, minFragmentLen: 10 });
  const encB = new UrBytesEncoder(envB, { maxFragmentLen: 20, minFragmentLen: 10 });
  const framesA = await collectFrames(encA, 8);
  const framesB = await collectFrames(encB, 8);
  const mixed = [];
  for (let i = 0; i < 8; i++) {
    mixed.push(framesA[i]);
    mixed.push(framesB[i]);
  }
  const dec = new UrBytesDecoder();
  for (const f of mixed) await dec.receive(f);
  assert(dec.isSuccess, 'foreign-stream still completes from first identity');
  assert(bytesToHex(dec.result) === bytesToHex(envA), 'foreign frames did not mix payload');
  assert(dec.fountain.rejectedForeign > 0, 'foreign frames counted as rejected');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const enc = new UrBytesEncoder(env, { maxFragmentLen: 20, minFragmentLen: 10 });
  const frames = await collectFrames(enc, 10);
  const shuffled = frames.slice().sort(() => 0.3 - 0.7);
  const dec = new UrBytesDecoder();
  for (const f of shuffled) await dec.receive(f);
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(env), 'reorder converges');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const enc = new UrBytesEncoder(env, { maxFragmentLen: 20, minFragmentLen: 10 });
  const frames = await collectFrames(enc, 6);
  const delayed = [...frames.slice(2), frames[0], frames[1]];
  const dec = new UrBytesDecoder();
  for (const f of delayed) await dec.receive(f);
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(env), 'delayed pures converge');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const enc = new UrBytesEncoder(env, { maxFragmentLen: 20, minFragmentLen: 10 });
  const frames = await collectFrames(enc, 4);
  const dec = new UrBytesDecoder();
  const percents = [];
  for (let i = 0; i < 40; i++) {
    await dec.receive(frames[i % frames.length]);
    percents.push(dec.estimatedPercentComplete);
  }
  let mono = true;
  for (let i = 1; i < percents.length; i++) if (percents[i] + 1e-12 < percents[i - 1]) mono = false;
  assert(mono, 'progress monotonic');
  assert(dec.isSuccess && percents[percents.length - 1] === 1, '100% only at complete');
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(env), 'duplicates do not false-complete wrongly');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const enc = new UrBytesEncoder(env, { maxFragmentLen: 20, minFragmentLen: 10 });
  const frames = await collectFrames(enc, 4);
  const dec = new UrBytesDecoder();
  await dec.receive(frames[0]);
  const before = dec.fountain.processedPartsCount;
  const corrupt = frames[1].slice(0, -1) + (frames[1].endsWith('a') ? 'b' : 'a');
  const truncated = frames[1].slice(0, Math.max(8, frames[1].length - 5));
  const badSeq = frames[1].replace(/\/\d+-\d+\//, '/99-2/');
  assert((await dec.receive(corrupt)) === false, 'corrupt frame dropped');
  assert((await dec.receive(truncated)) === false, 'truncated frame dropped');
  assert((await dec.receive(badSeq)) === false, 'seq mismatch dropped');
  assert(dec.fountain.processedPartsCount === before, 'bad frames do not advance decoder');
  await dec.receive(frames[1]);
  assert(dec.isSuccess, 'decoder still completes after junk');
}

{
  const inner = hexToBytes(GOLDEN.raw.innerHex);
  const env = (await encodeCbqr2Transport(inner, TRANSPORT_CODEC.RAW)).bytes;
  const enc = new UrBytesEncoder(env, { maxFragmentLen: 20, minFragmentLen: 10 });
  const only = await enc.nextPart();
  const dec = new UrBytesDecoder();
  const cap = enc.seqLen * 10;
  let n = 0;
  while (!dec.isComplete && n < cap) {
    await dec.receive(only);
    n += 1;
  }
  assert(!dec.isSuccess && n === cap, `max-frame safety stops at ${cap} without false complete`);
}

const lossTable = [];
{
  const { timebook } = await generateTimebook(2026, 8, TIME_PROFILE.HOURS_4, { rng: lcg(4) });
  const packed = await encodeCbqr2(timebook);
  const env = await encodeCbqr2Transport(packed.bytes, TRANSPORT_CODEC.GZIP);
  const rates = [0, 0.1, 0.25, 0.4];
  const seeds = [1, 2, 3, 4, 5];
  for (const rate of rates) {
    const runs = [];
    for (const seed of seeds) {
      const enc = new UrBytesEncoder(env.bytes, { maxFragmentLen: 250, minFragmentLen: 10 });
      const dec = new UrBytesDecoder();
      const rng = mulberry(seed * 1000 + Math.round(rate * 100));
      const cap = enc.seqLen * 10;
      let generated = 0;
      let received = 0;
      while (!dec.isComplete && generated < cap) {
        const frame = await enc.nextPart();
        generated += 1;
        if (rng() < rate) continue;
        received += 1;
        await dec.receive(frame);
      }
      const ok = dec.isSuccess;
      if (!ok) {
        failed += 1;
        console.error('FAIL: loss run', rate, seed, 'generated', generated);
      }
      runs.push({ generated, received, seqLen: enc.seqLen, ok });
    }
    const avgRecv = runs.reduce((s, r) => s + r.received, 0) / runs.length;
    const seqLen = runs[0].seqLen;
    const overhead = avgRecv / seqLen;
    const pass = runs.every((r) => r.ok);
    lossTable.push({
      loss: `${Math.round(rate * 100)}%`,
      seqLen,
      avgReceived: avgRecv,
      overhead,
      pass,
    });
    assert(pass, `loss ${Math.round(rate * 100)}% all seeds complete`);
  }
}

const compressionRows = [];
const fragmentSweep = [];
const staticRows = [];
const perfRows = [];

async function packProfile(year, month, profile, seed) {
  const { timebook } = await generateTimebook(year, month, profile, { rng: lcg(seed) });
  const packed = await encodeCbqr2(timebook);
  const rawEnv = await encodeCbqr2Transport(packed.bytes, TRANSPORT_CODEC.RAW);
  const gzEnv = await encodeCbqr2Transport(packed.bytes, TRANSPORT_CODEC.GZIP);
  return { timebook, packed, rawEnv, gzEnv };
}

{
  const specs = [
    ['24h-28', 2026, 2, TIME_PROFILE.DAY_24H, 1],
    ['24h-31', 2026, 1, TIME_PROFILE.DAY_24H, 2],
    ['4h-28', 2026, 2, TIME_PROFILE.HOURS_4, 3],
    ['4h-31', 2026, 8, TIME_PROFILE.HOURS_4, 4],
    ['1h-28', 2026, 2, TIME_PROFILE.HOUR_1, 5],
    ['1h-31', 2026, 8, TIME_PROFILE.HOUR_1, 6],
  ];
  for (const [name, y, m, p, seed] of specs) {
    const { packed, rawEnv, gzEnv } = await packProfile(y, m, p, seed);
    const rawMur = new UrBytesEncoder(rawEnv.bytes, { maxFragmentLen: 250, minFragmentLen: 10 });
    const gzMur = new UrBytesEncoder(gzEnv.bytes, { maxFragmentLen: 250, minFragmentLen: 10 });
    compressionRows.push({
      profile: name,
      raw: packed.bytes.length,
      gzip: gzEnv.payloadLength,
      envRaw: rawEnv.bytes.length,
      envGzip: gzEnv.bytes.length,
      seqLenRaw: rawMur.seqLen,
      seqLenGzip: gzMur.seqLen,
      saving: 1 - gzEnv.payloadLength / packed.bytes.length,
    });
  }
  assert(compressionRows.find((r) => r.profile === '24h-31').gzip < compressionRows.find((r) => r.profile === '24h-31').raw, 'gzip smaller than raw 24h');
}

{
  const { gzEnv } = await packProfile(2026, 8, TIME_PROFILE.HOURS_4, 4);
  const { gzEnv: gz1h } = await packProfile(2026, 8, TIME_PROFILE.HOUR_1, 6);
  for (const [label, env] of [['4h-gzip', gzEnv], ['1h-gzip', gz1h]]) {
    for (const frag of [100, 150, 200, 250, 300, 350, 400]) {
      const enc = new UrBytesEncoder(env.bytes, { maxFragmentLen: frag, minFragmentLen: 10 });
      const frame = await enc.nextPart();
      const qrByte = tryQrText(frame, 'M', 'Byte');
      const qrAlnum = tryQrText(frame.toUpperCase(), 'M', 'Alphanumeric');
      fragmentSweep.push({
        payload: label,
        fragment: frag,
        urChars: frame.length,
        seqLen: enc.seqLen,
        qrByte: qrByte.ok ? `v${qrByte.type}/${qrByte.modules}` : qrByte.error,
        qrAlnum: qrAlnum.ok ? `v${qrAlnum.type}/${qrAlnum.modules}` : qrAlnum.error,
        dense: (qrAlnum.ok && qrAlnum.type >= 30) || (qrByte.ok && qrByte.type >= 30),
      });
    }
  }
}

{
  const months = [
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 1, 31],
  ];
  for (const [y, m, days] of months) {
    const { timebook, packed, gzEnv } = await packProfile(y, m, TIME_PROFILE.DAY_24H, days);
    assert(timebook.days.length === days, `${days}-day month`);
    const staticText = encodeStaticText(gzEnv.bytes);
    const singleUr = encodeSinglePartUr(gzEnv.bytes);
    const qrStatic = tryQrText(staticText.text, 'M', 'Byte');
    const qrUrByte = tryQrText(singleUr, 'M', 'Byte');
    const qrUrAlnum = tryQrText(singleUr.toUpperCase(), 'M', 'Alphanumeric');
    staticRows.push({
      days,
      cbqr2: packed.bytes.length,
      envGzip: gzEnv.bytes.length,
      representation: 'ALBERICH-CBQR2|v1|base64url',
      characters: staticText.text.length,
      qr: qrStatic.ok ? `v${qrStatic.type} M ${qrStatic.modules}mod` : qrStatic.error,
      fitsM: qrStatic.ok && qrStatic.type <= 40,
    });
    staticRows.push({
      days,
      cbqr2: packed.bytes.length,
      envGzip: gzEnv.bytes.length,
      representation: 'ur:bytes single-part',
      characters: singleUr.length,
      qr: qrUrAlnum.ok ? `v${qrUrAlnum.type} M alnum ${qrUrAlnum.modules}mod` : (qrUrByte.ok ? `v${qrUrByte.type} M byte` : qrUrAlnum.error),
      fitsM: qrUrAlnum.ok && qrUrAlnum.type <= 40,
    });
    const parsed = decodeStaticText(staticText.text);
    const back = await decodeCbqr2Transport(parsed.bytes);
    const book = await decodeCbqr2(back.bytes);
    assert(book.ok && book.timebook.days.length === days, `static text ${days}d roundtrip`);
  }
}

{
  for (const [name, profile, seed] of [
    ['4h-31', TIME_PROFILE.HOURS_4, 4],
    ['1h-31', TIME_PROFILE.HOUR_1, 6],
  ]) {
    const { packed, rawEnv, gzEnv } = await packProfile(2026, 8, profile, seed);
    for (const [codecName, env] of [['RAW', rawEnv], ['GZIP', gzEnv]]) {
      const mem0 = process.memoryUsage().heapUsed;
      const t0 = performance.now();
      const enc = new UrBytesEncoder(env.bytes, { maxFragmentLen: 250, minFragmentLen: 10 });
      const t1 = performance.now();
      const n = Math.min(enc.seqLen * 2, 400);
      const t2 = performance.now();
      const frames = [];
      for (let i = 0; i < n; i++) frames.push(await enc.nextPart());
      const t3 = performance.now();
      const dec = new UrBytesDecoder();
      const t4 = performance.now();
      for (const f of frames) {
        await dec.receive(f);
        if (dec.isComplete) break;
      }
      const t5 = performance.now();
      const mem1 = process.memoryUsage().heapUsed;
      assert(dec.isSuccess, `perf ${name} ${codecName} completes`);
      perfRows.push({
        name: `${name} ${codecName}`,
        cbqr2: packed.bytes.length,
        env: env.bytes.length,
        seqLen: enc.seqLen,
        initMs: t1 - t0,
        nextAvgMs: (t3 - t2) / n,
        receiveAvgMs: (t5 - t4) / Math.max(1, dec.processedPartsCount),
        completeMs: t5 - t4,
        heapDeltaKb: Math.round((mem1 - mem0) / 1024),
      });
    }
  }
}

console.log('\nW8 compression');
console.log('Profile  Raw  Gzip  envRaw  envGzip  seqLenRaw  seqLenGzip  saving');
for (const r of compressionRows) {
  console.log(
    `${r.profile}  ${r.raw}  ${r.gzip}  ${r.envRaw}  ${r.envGzip}  ${r.seqLenRaw}  ${r.seqLenGzip}  ${(r.saving * 100).toFixed(1)}%`,
  );
}

console.log('\nW8 fragment sweep (first frame, ECC M)');
console.log('payload fragment urChars seqLen qrByte qrAlnum dense?');
for (const r of fragmentSweep) {
  console.log(`${r.payload} ${r.fragment} ${r.urChars} ${r.seqLen} ${r.qrByte} ${r.qrAlnum} ${r.dense ? 'DENSE' : 'ok'}`);
}

console.log('\nW8 fountain loss (4h gzip, maxFrag 250, 5 seeds)');
for (const r of lossTable) {
  console.log(`${r.loss} seqLen=${r.seqLen} avgReceived=${r.avgReceived.toFixed(1)} overhead=${r.overhead.toFixed(2)}x ${r.pass ? 'PASS' : 'FAIL'}`);
}

console.log('\nW8 static 24h');
for (const r of staticRows) {
  console.log(`${r.days}d ${r.representation} chars=${r.characters} envGzip=${r.envGzip} qr=${r.qr} fitsM=${r.fitsM}`);
}

console.log('\nW8 performance');
for (const r of perfRows) {
  console.log(
    `${r.name} env=${r.env} seqLen=${r.seqLen} init=${r.initMs.toFixed(2)}ms next=${r.nextAvgMs.toFixed(3)}ms recv=${r.receiveAvgMs.toFixed(3)}ms complete=${r.completeMs.toFixed(1)}ms heapΔ=${r.heapDeltaKb}KB`,
  );
}

globalThis.__w8 = { compressionRows, fragmentSweep, lossTable, staticRows, perfRows, MAX_CBQR2_BYTES, MAX_ENVELOPE_BYTES };

if (failed) {
  console.error(`\n${failed} W8 transport test(s) failed`);
  process.exit(1);
}
console.log('\nW8 transport selftest passed.');
