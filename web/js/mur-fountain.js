/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Isolated BCR-2024-001 Multipart UR fountain engine.
 * Spec wins over any JS library. No Node Buffer, no polyfills.
 * SHA-256 via Web Crypto. CRC-32 via existing crc32Ieee.
 */

import { crc32Ieee } from './codebook-tafelwort.js';
import { encodeArray, encodeBstr, encodeUint, decodeExact } from './cbor-lite.js';

const MASK64 = 0xffffffffffffffffn;
const TWO64 = 2n ** 64n;

async function sha256(bytes) {
  const api = globalThis.crypto?.subtle;
  if (!api?.digest) throw new Error('Web Crypto subtle.digest required for MUR');
  return new Uint8Array(await api.digest('SHA-256', bytes));
}

function rotl(x, k) {
  return ((x << BigInt(k)) | (x >> (64n - BigInt(k)))) & MASK64;
}

function u64be(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, false);
}

function uint32be(n) {
  const o = new Uint8Array(4);
  new DataView(o.buffer).setUint32(0, n >>> 0, false);
  return o;
}

export function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex) {
  const s = String(hex);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export class Xoshiro256 {
  /**
   * @param {BigInt[]} state four uint64
   */
  constructor(state) {
    this.state = state.slice();
  }

  static fromDigest(digest) {
    return new Xoshiro256([
      u64be(digest, 0),
      u64be(digest, 8),
      u64be(digest, 16),
      u64be(digest, 24),
    ]);
  }

  static async fromSeed(bytes) {
    return Xoshiro256.fromDigest(await sha256(bytes));
  }

  static async fromString(s) {
    return Xoshiro256.fromSeed(new TextEncoder().encode(s));
  }

  static async fromCrc32(crc) {
    return Xoshiro256.fromSeed(uint32be(crc >>> 0));
  }

  next() {
    const s = this.state;
    const result = (rotl((s[1] * 5n) & MASK64, 7) * 9n) & MASK64;
    const t = (s[1] << 17n) & MASK64;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 45);
    return result;
  }

  nextDouble() {
    return Number(this.next()) / Number(TWO64);
  }

  /** Half-open [lo, hi). Matches Swift `nextInt(in: lo ..< hi)`. */
  nextIntHalfOpen(lo, hi) {
    const n = hi - lo;
    return Math.trunc(this.nextDouble() * n) + lo;
  }

  /** Closed [lo, hi]. Matches Swift `nextInt(in: lo ... hi)`. */
  nextIntClosed(lo, hi) {
    const n = hi - lo + 1;
    return Math.trunc(this.nextDouble() * n) + lo;
  }

  nextByte() {
    return this.nextIntClosed(0, 255);
  }

  nextData(count) {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = this.nextByte();
    return out;
  }
}

export class RandomSampler {
  constructor(probs) {
    const n = probs.length;
    const sum = probs.reduce((a, b) => a + b, 0);
    const P = probs.map((p) => (p * n) / sum);
    const S = [];
    const L = [];
    for (let i = n - 1; i >= 0; i--) {
      if (P[i] < 1) S.push(i);
      else L.push(i);
    }
    const outProbs = new Float64Array(n);
    const aliases = new Int32Array(n);
    while (S.length && L.length) {
      const a = S.pop();
      const g = L.pop();
      outProbs[a] = P[a];
      aliases[a] = g;
      P[g] += P[a] - 1;
      if (P[g] < 1) S.push(g);
      else L.push(g);
    }
    while (L.length) outProbs[L.pop()] = 1;
    while (S.length) outProbs[S.pop()] = 1;
    this.probs = outProbs;
    this.aliases = aliases;
  }

  next(rngFn) {
    const r1 = rngFn();
    const r2 = rngFn();
    const n = this.probs.length;
    const i = Math.trunc(n * r1);
    return r2 < this.probs[i] ? i : this.aliases[i];
  }
}

export class DegreeChooser {
  constructor(seqLen) {
    this.seqLen = seqLen;
    const probs = [];
    for (let i = 1; i <= seqLen; i++) probs.push(1 / i);
    this.sampler = new RandomSampler(probs);
  }

  chooseDegree(rng) {
    return this.sampler.next(() => rng.nextDouble()) + 1;
  }
}

export function shuffled(items, rng, count) {
  const remaining = items.slice();
  const result = [];
  while (result.length !== count) {
    const index = rng.nextIntHalfOpen(0, remaining.length);
    const item = remaining.splice(index, 1)[0];
    result.push(item);
  }
  return result;
}

export class FragmentChooser {
  constructor(seqLen, checksum) {
    this.degreeChooser = new DegreeChooser(seqLen);
    this.indexes = Array.from({ length: seqLen }, (_, i) => i);
    this.checksum = checksum >>> 0;
    this.seqLen = seqLen;
  }

  async chooseFragments(seqNum) {
    const n = seqNum >>> 0;
    if (n <= this.seqLen) return new Set([n - 1]);
    const seed = new Uint8Array(8);
    seed.set(uint32be(n), 0);
    seed.set(uint32be(this.checksum), 4);
    const rng = await Xoshiro256.fromSeed(seed);
    const degree = this.degreeChooser.chooseDegree(rng);
    return new Set(shuffled(this.indexes, rng, degree));
  }
}

export function findNominalFragmentLength(messageLen, minFragmentLen, maxFragmentLen) {
  if (messageLen <= 0 || minFragmentLen <= 0 || maxFragmentLen < minFragmentLen) {
    throw new Error('mur.err.fragmentLen');
  }
  const maxFragmentCount = Math.floor(messageLen / minFragmentLen);
  let fragmentLen = messageLen;
  for (let fragmentCount = 1; fragmentCount <= maxFragmentCount; fragmentCount++) {
    fragmentLen = Math.ceil(messageLen / fragmentCount);
    if (fragmentLen <= maxFragmentLen) break;
  }
  return fragmentLen;
}

export function partitionMessage(message, fragmentLen) {
  const fragments = [];
  for (let i = 0; i < message.length; i += fragmentLen) {
    const frag = new Uint8Array(fragmentLen);
    frag.set(message.subarray(i, Math.min(i + fragmentLen, message.length)));
    fragments.push(frag);
  }
  return fragments;
}

export function joinFragments(fragments, messageLen) {
  const total = new Uint8Array(fragments.length * (fragments[0]?.length || 0));
  let o = 0;
  for (const f of fragments) {
    total.set(f, o);
    o += f.length;
  }
  return total.subarray(0, messageLen);
}

export function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function xorInto(target, src) {
  for (let i = 0; i < target.length; i++) target[i] ^= src[i];
}

function setKey(indexes) {
  return [...indexes].sort((a, b) => a - b).join(',');
}

export class FountainPart {
  constructor(seqNum, seqLen, messageLen, checksum, data) {
    this.seqNum = seqNum >>> 0;
    this.seqLen = seqLen;
    this.messageLen = messageLen;
    this.checksum = checksum >>> 0;
    this.data = data;
  }

  get cbor() {
    return encodeArray([
      encodeUint(this.seqNum),
      encodeUint(this.seqLen),
      encodeUint(this.messageLen),
      encodeUint(this.checksum),
      encodeBstr(this.data),
    ]);
  }

  get description() {
    return `seqNum:${this.seqNum}, seqLen:${this.seqLen}, messageLen:${this.messageLen}, checksum:${this.checksum}, data:${bytesToHex(this.data)}`;
  }

  static fromCbor(bytes) {
    const v = decodeExact(bytes);
    if (!Array.isArray(v) || v.length !== 5) throw new Error('mur.err.partCbor');
    const [seqNum, seqLen, messageLen, checksum, data] = v;
    if (
      !Number.isInteger(seqNum) ||
      !Number.isInteger(seqLen) ||
      !Number.isInteger(messageLen) ||
      !Number.isInteger(checksum) ||
      !(data instanceof Uint8Array)
    ) {
      throw new Error('mur.err.partCbor');
    }
    return new FountainPart(seqNum, seqLen, messageLen, checksum, data);
  }
}

export class FountainEncoder {
  constructor(message, { maxFragmentLen = null, firstSeqNum = 0, minFragmentLen = 10 } = {}) {
    if (!(message instanceof Uint8Array) || message.length === 0) {
      throw new Error('mur.err.emptyMessage');
    }
    if (message.length > 0xffffffff) throw new Error('mur.err.messageTooLarge');
    this.messageLen = message.length;
    this.checksum = crc32Ieee(message);
    this.maxFragmentLen = maxFragmentLen == null ? message.length : maxFragmentLen;
    this.fragmentLen = findNominalFragmentLength(
      message.length,
      minFragmentLen,
      this.maxFragmentLen,
    );
    this.fragments = partitionMessage(message, this.fragmentLen);
    this.seqNum = firstSeqNum >>> 0;
    this.fragmentChooser = new FragmentChooser(this.fragments.length, this.checksum);
    this.lastFragmentIndexes = null;
  }

  get seqLen() {
    return this.fragments.length;
  }

  get isComplete() {
    return this.seqNum >= this.seqLen;
  }

  get isSinglePart() {
    return this.seqLen === 1;
  }

  mix(indexes) {
    if (indexes.size === 1) {
      return this.fragments[[...indexes][0]];
    }
    const mixed = new Uint8Array(this.fragmentLen);
    for (const i of indexes) xorInto(mixed, this.fragments[i]);
    return mixed;
  }

  async nextPart() {
    this.seqNum = (this.seqNum + 1) >>> 0;
    if (this.seqLen === 1 && this.seqNum !== 1) {
      throw new Error('mur.err.singlePartExhausted');
    }
    this.lastFragmentIndexes = await this.fragmentChooser.chooseFragments(this.seqNum);
    const mixed = this.mix(this.lastFragmentIndexes);
    return new FountainPart(
      this.seqNum,
      this.seqLen,
      this.messageLen,
      this.checksum,
      mixed,
    );
  }
}

export class FountainDecoder {
  constructor() {
    this.expectedFragmentIndexes = null;
    this.expectedFragmentLen = null;
    this.expectedMessageLen = null;
    this.expectedChecksum = null;
    this.receivedFragmentIndexes = new Set();
    this.lastFragmentIndexes = null;
    this.processedPartsCount = 0;
    this.simpleParts = new Map();
    this.mixedParts = new Map();
    this.queuedParts = [];
    this.fragmentChooser = null;
    this.result = null;
    this.error = null;
    this.rejectedForeign = 0;
    this.rejectedDuplicate = 0;
  }

  get expectedFragmentCount() {
    return this.expectedFragmentIndexes ? this.expectedFragmentIndexes.size : null;
  }

  get isComplete() {
    return this.result != null || this.error != null;
  }

  get isSuccess() {
    return this.result != null;
  }

  get estimatedPercentComplete() {
    if (this.result) return 1;
    if (this.error) return 0;
    if (!this.expectedFragmentCount) return 0;
    const estimatedInputParts = this.expectedFragmentCount * 1.75;
    return Math.min(0.99, this.processedPartsCount / estimatedInputParts);
  }

  validatePart(part) {
    if (!this.expectedFragmentIndexes) {
      if (part.seqLen < 1 || part.messageLen < 1 || part.data.length < 1) return false;
      this.expectedFragmentIndexes = new Set(Array.from({ length: part.seqLen }, (_, i) => i));
      this.expectedMessageLen = part.messageLen;
      this.expectedChecksum = part.checksum;
      this.expectedFragmentLen = part.data.length;
      this.fragmentChooser = new FragmentChooser(part.seqLen, part.checksum);
      return true;
    }
    if (
      this.expectedFragmentCount !== part.seqLen ||
      this.expectedMessageLen !== part.messageLen ||
      this.expectedChecksum !== part.checksum ||
      this.expectedFragmentLen !== part.data.length
    ) {
      this.rejectedForeign += 1;
      return false;
    }
    return true;
  }

  async receivePart(part) {
    if (this.isComplete) return false;
    if (!this.validatePart(part)) return false;
    const fragmentIndexes = await this.fragmentChooser.chooseFragments(part.seqNum);
    this.lastFragmentIndexes = fragmentIndexes;
    this.queuedParts.push({ fragmentIndexes, data: part.data });
    this.processQueue();
    this.processedPartsCount += 1;
    return true;
  }

  processQueue() {
    while (!this.isComplete && this.queuedParts.length) {
      const part = this.queuedParts.shift();
      if (part.fragmentIndexes.size === 1) this.processSimplePart(part);
      else this.processMixedPart(part);
    }
  }

  processSimplePart(part) {
    const index = [...part.fragmentIndexes][0];
    if (this.receivedFragmentIndexes.has(index)) {
      this.rejectedDuplicate += 1;
      return;
    }
    this.simpleParts.set(setKey(part.fragmentIndexes), part);
    this.receivedFragmentIndexes.add(index);
    if (this.receivedFragmentIndexes.size === this.expectedFragmentCount) {
      const sorted = [...this.simpleParts.values()].sort(
        (a, b) => [...a.fragmentIndexes][0] - [...b.fragmentIndexes][0],
      );
      const message = joinFragments(sorted.map((p) => p.data), this.expectedMessageLen);
      const checksum = crc32Ieee(message);
      if (checksum === this.expectedChecksum) this.result = message;
      else this.error = 'mur.err.checksum';
      return;
    }
    this.reduceMixed(part);
  }

  processMixedPart(part) {
    const key = setKey(part.fragmentIndexes);
    if (this.mixedParts.has(key)) {
      this.rejectedDuplicate += 1;
      return;
    }
    let p = part;
    for (const other of this.simpleParts.values()) p = reducePart(p, other);
    for (const other of this.mixedParts.values()) p = reducePart(p, other);
    if (p.fragmentIndexes.size === 1) {
      this.queuedParts.push(p);
    } else {
      this.reduceMixed(p);
      this.mixedParts.set(setKey(p.fragmentIndexes), p);
    }
  }

  reduceMixed(by) {
    const reduced = [];
    for (const part of this.mixedParts.values()) reduced.push(reducePart(part, by));
    const next = new Map();
    for (const p of reduced) {
      if (p.fragmentIndexes.size === 1) this.queuedParts.push(p);
      else next.set(setKey(p.fragmentIndexes), p);
    }
    this.mixedParts = next;
  }
}

function isStrictSubset(a, b) {
  if (a.size >= b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function reducePart(a, b) {
  if (!isStrictSubset(b.fragmentIndexes, a.fragmentIndexes)) return a;
  const newIndexes = new Set(a.fragmentIndexes);
  for (const i of b.fragmentIndexes) newIndexes.delete(i);
  return { fragmentIndexes: newIndexes, data: xorBytes(a.data, b.data) };
}

export async function makeMessage(len, seed = 'Wolf') {
  const rng = await Xoshiro256.fromString(seed);
  return rng.nextData(len);
}
