/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Glue: ALB3_TIMEBOOK_V1 → CBQR2 → Transport Envelope → ur:bytes MUR.
 * MUR success is not codebook acceptance.
 */

import { decodeCbqr2, encodeCbqr2 } from './cbqr2-binary.js';
import {
  decodeCbqr2Transport,
  encodeCbqr2Transport,
  TRANSPORT_CODEC,
} from './cbqr2-transport.js';
import { UrBytesDecoder, UrBytesEncoder } from './ur-bytes.js';

function fail(error) {
  return { ok: false, rejected: 'IMPORT_REJECTED', error };
}

/**
 * @param {Uint8Array} envelopeBytes already-encoded CBQR2 transport envelope
 */
export function createMurEncoder(envelopeBytes, opts = {}) {
  return new UrBytesEncoder(envelopeBytes, {
    maxFragmentLen: opts.maxFragmentLen ?? 250,
    minFragmentLen: opts.minFragmentLen ?? 10,
    firstSeqNum: opts.firstSeqNum ?? 0,
  });
}

export function createMurDecoder() {
  return new UrBytesDecoder();
}

/**
 * Full encode path from a validated timebook to a MUR encoder over the envelope.
 */
export async function encodeTimebookToMur(timebook, opts = {}) {
  const codec = opts.codec ?? TRANSPORT_CODEC.GZIP;
  const encoded = await encodeCbqr2(timebook);
  if (!encoded.ok) return encoded;
  const env = await encodeCbqr2Transport(encoded.bytes, codec);
  if (!env.ok) return env;
  const encoder = createMurEncoder(env.bytes, opts);
  return {
    ok: true,
    encoder,
    envelope: env,
    cbqr2Length: encoded.length,
    codebookFingerprint: encoded.codebookFingerprint,
  };
}

/**
 * After MUR reconstruction: envelope → CBQR2 → timebook.
 * Outer fountain checksum is not codebook identity.
 */
export async function acceptEnvelopeToTimebook(envelopeBytes) {
  const transport = await decodeCbqr2Transport(envelopeBytes);
  if (!transport.ok) return transport;
  const decoded = await decodeCbqr2(transport.bytes);
  if (!decoded.ok) return decoded;
  return {
    ok: true,
    timebook: decoded.timebook,
    codec: transport.codec,
    cbqr2Length: transport.bytes.length,
  };
}

export async function acceptMurDecoder(decoder) {
  if (!decoder?.isSuccess || !decoder.result) return fail('mur.err.incomplete');
  return acceptEnvelopeToTimebook(decoder.result);
}
