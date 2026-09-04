/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * BCR-2024-001 / BCR-2020-012 / BCR-2020-005 conformance.
 * node js/tests/mur-selftest.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32Ieee } from '../codebook-tafelwort.js';
import {
  decodeBytewords,
  encodeBytewordsMinimal,
  encodeBytewordsStandard,
} from '../bytewords.js';
import {
  DegreeChooser,
  FountainDecoder,
  FountainEncoder,
  FountainPart,
  FragmentChooser,
  RandomSampler,
  Xoshiro256,
  bytesToHex,
  findNominalFragmentLength,
  hexToBytes,
  joinFragments,
  makeMessage,
  partitionMessage,
  shuffled,
  xorBytes,
} from '../mur-fountain.js';
import { UrBytesDecoder, UrBytesEncoder, encodeSinglePartUr } from '../ur-bytes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VECTORS = JSON.parse(readFileSync(join(ROOT, 'reference/mur-bcr-vectors.json'), 'utf8'));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

function assertEq(a, b, msg) {
  const as = typeof a === 'string' ? a : JSON.stringify(a);
  const bs = typeof b === 'string' ? b : JSON.stringify(b);
  assert(as === bs, `${msg}${as === bs ? '' : ` got=${as} expected=${bs}`}`);
}

{
  const wolf = crc32Ieee(new TextEncoder().encode('Wolf'));
  assert(wolf === 0x598c84dc, 'CRC32 Wolf');
  const hello = crc32Ieee(new TextEncoder().encode('Hello, world!'));
  assert(hello === 0xebe6c6e6, 'CRC32 Hello, world!');
  const nine = crc32Ieee(new TextEncoder().encode('123456789'));
  assert(nine === 0xcbf43926, 'CRC32 123456789');
}

{
  const input = Uint8Array.from(VECTORS.bytewords_input_1);
  assertEq(encodeBytewordsStandard(input), VECTORS.bytewords_standard_1, 'bytewords standard');
  assertEq(encodeBytewordsMinimal(input), VECTORS.bytewords_minimal_1, 'bytewords minimal');
  assertEq(
    [...decodeBytewords(VECTORS.bytewords_minimal_1, 'minimal')],
    VECTORS.bytewords_input_1,
    'bytewords decode minimal',
  );
  let threw = false;
  try { decodeBytewords('aeadaolazojendeowf', 'minimal'); } catch { threw = true; }
  assert(threw, 'bytewords bad checksum rejected');
}

{
  const rng = await Xoshiro256.fromString('Wolf');
  const numbers = [];
  for (let i = 0; i < 100; i++) numbers.push(Number(rng.next() % 100n));
  assertEq(numbers, VECTORS.rng1_mod100, 'Xoshiro Wolf next()%100');
}

{
  const checksum = crc32Ieee(new TextEncoder().encode('Wolf'));
  const rng = await Xoshiro256.fromCrc32(checksum);
  const numbers = [];
  for (let i = 0; i < 100; i++) numbers.push(Number(rng.next() % 100n));
  assertEq(numbers, VECTORS.rng2_crc_mod100, 'Xoshiro crc32(Wolf) next()%100');
}

{
  const rng = await Xoshiro256.fromString('Wolf');
  const numbers = [];
  for (let i = 0; i < 100; i++) numbers.push(rng.nextIntClosed(1, 10));
  assertEq(numbers, VECTORS.rng3_int_1_10, 'Xoshiro nextInt 1...10');
}

{
  const sha = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
  ));
  assertEq(bytesToHex(sha), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1', 'SHA-256 NIST');
}

{
  const sampler = new RandomSampler([1, 2, 4, 8]);
  const rng = await Xoshiro256.fromString('Wolf');
  const samples = [];
  for (let i = 0; i < 500; i++) samples.push(sampler.next(() => rng.nextDouble()));
  assertEq(samples, VECTORS.sampler_500, 'RandomSampler 500');
  const totals = [0, 0, 0, 0];
  for (const s of samples) totals[s] += 1;
  assertEq(totals, VECTORS.sampler_totals, 'RandomSampler histogram');
}

{
  assert(findNominalFragmentLength(12345, 1005, 1955) === 1764, 'fragment length 1764');
  assert(findNominalFragmentLength(12345, 1005, 30000) === 12345, 'fragment length = message');
}

{
  const message = await makeMessage(1024);
  const fragmentLen = findNominalFragmentLength(message.length, 10, 100);
  const fragments = partitionMessage(message, fragmentLen);
  assertEq(fragments.map(bytesToHex), VECTORS.partition_1024_hex, 'partition 1024');
  const joined = joinFragments(fragments, message.length);
  assert(bytesToHex(joined) === bytesToHex(message), 'join fragments');
}

{
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = [];
  for (let count = 1; count <= 10; count++) {
    const rng = await Xoshiro256.fromString('Wolf');
    result.push(shuffled(values, rng, count));
  }
  const expected = [
    [6],
    [6, 4],
    [6, 4, 9],
    [6, 4, 9, 3],
    [6, 4, 9, 3, 10],
    [6, 4, 9, 3, 10, 5],
    [6, 4, 9, 3, 10, 5, 7],
    [6, 4, 9, 3, 10, 5, 7, 8],
    [6, 4, 9, 3, 10, 5, 7, 8, 1],
    [6, 4, 9, 3, 10, 5, 7, 8, 1, 2],
  ];
  assertEq(result, expected, 'Fisher-Yates prefix shuffle');
}

{
  const message = await makeMessage(1024);
  const fragmentLen = findNominalFragmentLength(message.length, 10, 100);
  const fragments = partitionMessage(message, fragmentLen);
  const chooser = new DegreeChooser(fragments.length);
  const rng = await Xoshiro256.fromString('Wolf');
  const degrees = [];
  for (let i = 0; i < 1000; i++) degrees.push(chooser.chooseDegree(rng));
  assertEq(degrees, VECTORS.degree_1000, 'DegreeChooser 1000');
  const totals = [];
  for (const d of degrees) {
    totals[d - 1] = (totals[d - 1] || 0) + 1;
  }
  assertEq(totals, VECTORS.degree_totals, 'DegreeChooser histogram');
}

{
  const message = await makeMessage(1024);
  const checksum = crc32Ieee(message);
  const fragmentLen = findNominalFragmentLength(message.length, 10, 100);
  const fragments = partitionMessage(message, fragmentLen);
  const chooser = new FragmentChooser(fragments.length, checksum);
  const indexes = [];
  for (let n = 1; n <= 50; n++) {
    const set = await chooser.chooseFragments(n);
    indexes.push([...set].sort((a, b) => a - b));
  }
  assertEq(indexes, VECTORS.fragment_indexes_1_50, 'fragment indexes 1..50');
  assert(indexes.slice(0, 11).every((a, i) => a.length === 1 && a[0] === i), 'first seqLen are pure');
  assert(indexes[12].length > 1, 'seq 13 is mixed');
}

{
  const rng = await Xoshiro256.fromString('Wolf');
  const data1 = rng.nextData(10);
  const data2 = rng.nextData(10);
  assertEq(bytesToHex(data1), '916ec65cf77cadf55cd7', 'xor data1');
  assertEq(bytesToHex(data2), 'f9cda1a1030026ddd42e', 'xor data2');
  assertEq(bytesToHex(xorBytes(data1, data2)), '68a367fdf47c8b2888f9', 'xor mix');
}

{
  const part = new FountainPart(12, 8, 100, 0x12345678, Uint8Array.from([1, 5, 3, 3, 5]));
  assertEq(bytesToHex(part.cbor), '850c0818641a12345678450105030305', 'part CBOR');
  const again = FountainPart.fromCbor(part.cbor);
  assertEq(bytesToHex(again.cbor), bytesToHex(part.cbor), 'part CBOR roundtrip');
}

{
  const message = await makeMessage(256);
  const encoder = new FountainEncoder(message, { maxFragmentLen: 30 });
  const desc = [];
  const cbor = [];
  for (let i = 0; i < 20; i++) {
    const part = await encoder.nextPart();
    desc.push(part.description);
    cbor.push(bytesToHex(part.cbor));
  }
  assertEq(desc, VECTORS.encoder_parts_desc, 'fountain encoder descriptions');
  assertEq(cbor, VECTORS.encoder_parts_cbor_hex, 'fountain encoder CBOR');
}

{
  const message = await makeMessage(256);
  const encoder = new FountainEncoder(message, { maxFragmentLen: 30 });
  let n = 0;
  while (!encoder.isComplete) {
    await encoder.nextPart();
    n += 1;
  }
  assert(n === encoder.seqLen, 'isComplete after seqLen pure parts');
}

{
  const payload = await makeMessage(50);
  const encoded = encodeSinglePartUr(payload);
  assertEq(encoded, VECTORS.single_part_ur_50, 'single-part ur:bytes/50');
  const dec = new UrBytesDecoder();
  const ok = await dec.receive(encoded);
  assert(ok && dec.isSuccess && bytesToHex(dec.result) === bytesToHex(payload), 'single-part decode');
}

{
  const payload = await makeMessage(256);
  const encoder = new UrBytesEncoder(payload, { maxFragmentLen: 30 });
  const parts = [];
  for (let i = 0; i < 20; i++) parts.push(await encoder.nextPart());
  assertEq(parts, VECTORS.ur_encoder_256_max30, 'multipart ur:bytes 256/30');
  const dec = new UrBytesDecoder();
  for (const p of parts.slice(0, encoder.seqLen)) await dec.receive(p);
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(payload), 'multipart decode from pure frames');
}

{
  const payload = await makeMessage(32767);
  const encoder = new UrBytesEncoder(payload, { maxFragmentLen: 1000, firstSeqNum: 100 });
  const dec = new UrBytesDecoder();
  let n = 0;
  while (!dec.isComplete && n < encoder.seqLen * 10) {
    const frame = await encoder.nextPart();
    await dec.receive(frame);
    n += 1;
  }
  assert(dec.isSuccess && bytesToHex(dec.result) === bytesToHex(payload), `fountain 32767 complete in ${n} frames`);
}

if (failed) {
  console.error(`MUR selftest FAILED (${failed})`);
  process.exit(1);
}
console.log('MUR selftest passed.');
