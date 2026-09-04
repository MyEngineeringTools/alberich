/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * ur:bytes — Uniform Resources (BCR-2020-005) over MUR (BCR-2024-001).
 * Payload is a CBOR byte string wrapping the caller's bytes (the CBQR2
 * transport envelope). No custom UR type in W8.
 */

import { encodeBytewordsMinimal, decodeBytewords } from './bytewords.js';
import { encodeBstr, unwrapBstr } from './cbor-lite.js';
import { FountainDecoder, FountainEncoder, FountainPart } from './mur-fountain.js';

export const UR_TYPE_BYTES = 'bytes';
const TYPE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

export function wrapUrBytes(payload) {
  if (!(payload instanceof Uint8Array) || payload.length === 0) throw fail('ur.err.empty');
  return encodeBstr(payload);
}

export function unwrapUrBytes(cbor) {
  return unwrapBstr(cbor);
}

export function encodeSinglePartUr(payload, type = UR_TYPE_BYTES) {
  if (!TYPE_RE.test(type)) throw fail('ur.err.type');
  const body = encodeBytewordsMinimal(wrapUrBytes(payload));
  return `ur:${type}/${body}`;
}

export function parseUr(string) {
  const lowered = String(string || '').trim().toLowerCase();
  if (!lowered.startsWith('ur:')) throw fail('ur.err.scheme');
  const parts = lowered.slice(3).split('/');
  if (parts.length < 2) throw fail('ur.err.path');
  const type = parts[0];
  if (!TYPE_RE.test(type)) throw fail('ur.err.type');
  return { type, components: parts.slice(1) };
}

function parseSeq(s) {
  const m = /^([0-9]+)-([0-9]+)$/.exec(s);
  if (!m) throw fail('ur.err.seq');
  const seqNum = Number(m[1]);
  const seqLen = Number(m[2]);
  if (!Number.isInteger(seqNum) || !Number.isInteger(seqLen) || seqNum < 1 || seqLen < 1) {
    throw fail('ur.err.seq');
  }
  return { seqNum, seqLen };
}

export class UrBytesEncoder {
  constructor(payload, opts = {}) {
    this.type = opts.type || UR_TYPE_BYTES;
    if (!TYPE_RE.test(this.type)) throw fail('ur.err.type');
    this.cbor = wrapUrBytes(payload);
    this.fountain = new FountainEncoder(this.cbor, {
      maxFragmentLen: opts.maxFragmentLen ?? this.cbor.length,
      firstSeqNum: opts.firstSeqNum ?? 0,
      minFragmentLen: opts.minFragmentLen ?? 10,
    });
  }

  get seqLen() {
    return this.fountain.seqLen;
  }

  get fragmentLen() {
    return this.fountain.fragmentLen;
  }

  get isComplete() {
    return this.fountain.isComplete;
  }

  get isSinglePart() {
    return this.fountain.isSinglePart;
  }

  encodePart(part) {
    const seq = `${part.seqNum}-${part.seqLen}`;
    const body = encodeBytewordsMinimal(part.cbor);
    return `ur:${this.type}/${seq}/${body}`;
  }

  async nextPart() {
    if (this.isSinglePart) {
      this.fountain.seqNum = (this.fountain.seqNum + 1) >>> 0;
      if (this.fountain.seqNum !== 1) throw new Error('mur.err.singlePartExhausted');
      return `ur:${this.type}/${encodeBytewordsMinimal(this.cbor)}`;
    }
    const part = await this.fountain.nextPart();
    return this.encodePart(part);
  }
}

export class UrBytesDecoder {
  constructor() {
    this.fountain = new FountainDecoder();
    this.expectedType = null;
    this.result = null;
    this.error = null;
    this.lastAccepted = false;
  }

  get isComplete() {
    return this.result != null || this.error != null || this.fountain.isComplete;
  }

  get isSuccess() {
    return this.result != null;
  }

  get estimatedPercentComplete() {
    if (this.result) return 1;
    return this.fountain.estimatedPercentComplete;
  }

  get processedPartsCount() {
    return this.fountain.processedPartsCount;
  }

  get receivedFragmentIndexes() {
    return this.fountain.receivedFragmentIndexes;
  }

  /**
   * @param {string} frame
   * @returns {Promise<boolean>} true if the frame was accepted into decoder state
   */
  async receive(frame) {
    this.lastAccepted = false;
    if (this.result || this.error) return false;
    let parsed;
    try {
      parsed = parseUr(frame);
    } catch {
      return false;
    }
    if (!this.expectedType) {
      if (parsed.type !== UR_TYPE_BYTES) return false;
      this.expectedType = parsed.type;
    } else if (parsed.type !== this.expectedType) {
      this.fountain.rejectedForeign += 1;
      return false;
    }

    if (parsed.components.length === 1) {
      if (this.fountain.expectedFragmentIndexes) return false;
      try {
        const cbor = decodeBytewords(parsed.components[0], 'minimal');
        this.result = unwrapUrBytes(cbor);
        this.lastAccepted = true;
        return true;
      } catch {
        this.expectedType = this.expectedType; // keep lock if already set from this frame
        return false;
      }
    }

    if (parsed.components.length !== 2) return false;
    let seq;
    let part;
    try {
      seq = parseSeq(parsed.components[0]);
      const cbor = decodeBytewords(parsed.components[1], 'minimal');
      part = FountainPart.fromCbor(cbor);
    } catch {
      return false;
    }
    if (seq.seqNum !== part.seqNum || seq.seqLen !== part.seqLen) return false;
    const ok = await this.fountain.receivePart(part);
    if (!ok) return false;
    this.lastAccepted = true;
    if (this.fountain.result) {
      try {
        this.result = unwrapUrBytes(this.fountain.result);
      } catch {
        this.error = 'ur.err.cbor';
      }
    } else if (this.fountain.error) {
      this.error = this.fountain.error;
    }
    return true;
  }
}
