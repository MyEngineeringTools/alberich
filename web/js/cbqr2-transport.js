/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * CBQR2 Transport Envelope v1. Wraps canonical CBQR2 bytes for QR/MUR.
 * Not codebook identity. gzip is transport only.
 */

import { expectedCbqr2Length } from './cbqr2-binary.js';
import { TIME_PROFILE } from './alberich-key-time.js';
import { gzipSync, gunzipSync } from './vendor/fflate-browser.js';

export const TRANSPORT_MAGIC = 'ALB3Q2';
export const TRANSPORT_VERSION = 1;
export const TRANSPORT_CODEC = Object.freeze({
  RAW: 0,
  GZIP: 1,
});
export const TRANSPORT_HEADER_BYTES = 12;

/** 31-day HOUR_1, netLen 16: 19 + 16 + 744×70 + 64 */
export const MAX_CBQR2_BYTES = expectedCbqr2Length(2000, 1, TIME_PROFILE.HOUR_1, 16);

/** gzip of incompressible data expands by a small header/block overhead. */
export const MAX_TRANSPORT_PAYLOAD = MAX_CBQR2_BYTES + 256;
export const MAX_ENVELOPE_BYTES = TRANSPORT_HEADER_BYTES + MAX_TRANSPORT_PAYLOAD;

const MAGIC_BYTES = new TextEncoder().encode(TRANSPORT_MAGIC);

function fail(error) {
  return { ok: false, rejected: 'IMPORT_REJECTED', error };
}

function equalBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

async function gzipNative(bytes) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  const writeP = writer.write(bytes).then(() => writer.close());
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await writeP;
  return concatChunks(chunks, total);
}

async function gunzipNative(bytes, maxOut) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  let writeErr = null;
  const writeP = writer.write(bytes).then(() => writer.close()).catch((e) => {
    writeErr = e;
  });
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxOut) {
        try { await writer.abort(); } catch { /* ignore */ }
        try { await reader.cancel(); } catch { /* ignore */ }
        throw Object.assign(new Error('transport.err.gzipBomb'), { code: 'transport.err.gzipBomb' });
      }
      chunks.push(value);
    }
  } finally {
    await writeP.catch(() => {});
  }
  if (writeErr) {
    throw Object.assign(new Error('transport.err.gzip'), { code: 'transport.err.gzip' });
  }
  return concatChunks(chunks, total);
}

function gzipFooterIsize(bytes) {
  if (bytes.length < 18) return -1;
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true);
}

function gunzipFflateBounded(bytes, maxOut) {
  const isize = gzipFooterIsize(bytes);
  if (isize < 0 || isize > maxOut) {
    throw Object.assign(new Error('transport.err.gzipBomb'), { code: 'transport.err.gzipBomb' });
  }
  let out;
  try {
    out = gunzipSync(bytes);
  } catch {
    throw Object.assign(new Error('transport.err.gzip'), { code: 'transport.err.gzip' });
  }
  if (out.length > maxOut) {
    throw Object.assign(new Error('transport.err.gzipBomb'), { code: 'transport.err.gzipBomb' });
  }
  return out;
}

export function hasNativeGzip() {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

export async function gzipTransport(bytes) {
  if (hasNativeGzip()) return gzipNative(bytes);
  return gzipSync(bytes);
}

export async function gunzipTransport(bytes, maxOut) {
  if (hasNativeGzip()) return gunzipNative(bytes, maxOut);
  return gunzipFflateBounded(bytes, maxOut);
}

/**
 * @param {Uint8Array} cbqr2
 * @param {0 | 1} codec
 * @returns {Promise<{ ok: true, bytes: Uint8Array, codec: number, uncompressedLength: number, payloadLength: number } | { ok: false, rejected: string, error: string }>}
 */
export async function encodeCbqr2Transport(cbqr2, codec = TRANSPORT_CODEC.RAW) {
  if (!(cbqr2 instanceof Uint8Array)) return fail('transport.err.notBytes');
  if (cbqr2.length === 0 || cbqr2.length > MAX_CBQR2_BYTES) return fail('transport.err.size');
  if (codec !== TRANSPORT_CODEC.RAW && codec !== TRANSPORT_CODEC.GZIP) {
    return fail('transport.err.codec');
  }

  let payload;
  if (codec === TRANSPORT_CODEC.RAW) {
    payload = new Uint8Array(cbqr2);
  } else {
    try {
      payload = await gzipTransport(cbqr2);
    } catch {
      return fail('transport.err.gzip');
    }
    if (payload.length > MAX_TRANSPORT_PAYLOAD) return fail('transport.err.size');
  }

  const bytes = new Uint8Array(TRANSPORT_HEADER_BYTES + payload.length);
  const view = new DataView(bytes.buffer);
  bytes.set(MAGIC_BYTES, 0);
  bytes[6] = TRANSPORT_VERSION;
  bytes[7] = codec;
  view.setUint32(8, cbqr2.length, false);
  bytes.set(payload, TRANSPORT_HEADER_BYTES);
  return {
    ok: true,
    bytes,
    codec,
    uncompressedLength: cbqr2.length,
    payloadLength: payload.length,
  };
}

/**
 * Envelope only. Does not decode CBQR2.
 * @param {Uint8Array} input
 */
export async function decodeCbqr2Transport(input) {
  if (!(input instanceof Uint8Array)) return fail('transport.err.notBytes');
  if (input.length < TRANSPORT_HEADER_BYTES + 1) return fail('transport.err.truncated');
  if (input.length > MAX_ENVELOPE_BYTES) return fail('transport.err.size');
  if (!equalBytes(input.subarray(0, 6), MAGIC_BYTES)) return fail('transport.err.magic');
  if (input[6] !== TRANSPORT_VERSION) return fail('transport.err.version');
  const codec = input[7];
  if (codec !== TRANSPORT_CODEC.RAW && codec !== TRANSPORT_CODEC.GZIP) {
    return fail('transport.err.codec');
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const uncompressedLength = view.getUint32(8, false);
  if (uncompressedLength < 1 || uncompressedLength > MAX_CBQR2_BYTES) {
    return fail('transport.err.rawLength');
  }
  const payload = input.subarray(TRANSPORT_HEADER_BYTES);
  if (payload.length < 1 || payload.length > MAX_TRANSPORT_PAYLOAD) {
    return fail('transport.err.size');
  }

  let raw;
  if (codec === TRANSPORT_CODEC.RAW) {
    if (payload.length !== uncompressedLength) return fail('transport.err.rawLength');
    raw = payload;
  } else {
    const cap = Math.min(uncompressedLength, MAX_CBQR2_BYTES);
    let decoded;
    try {
      decoded = await gunzipTransport(payload, cap);
    } catch (err) {
      return fail(err?.code || 'transport.err.gzip');
    }
    if (decoded.length !== uncompressedLength) return fail('transport.err.rawLength');
    raw = decoded;
  }
  return {
    ok: true,
    bytes: raw,
    codec,
    uncompressedLength,
    payloadLength: payload.length,
  };
}

export const STATIC_TEXT_MAGIC = 'ALBERICH-CBQR2';
export const STATIC_TEXT_VERSION = 'v1';

export function bytesToBase64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const b64 = globalThis.btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlToBytes(text) {
  const s = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = globalThis.atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Compact static QR text wrapping a transport envelope.
 * `ALBERICH-CBQR2|v1|<base64url>`
 */
export function encodeStaticText(envelopeBytes) {
  if (!(envelopeBytes instanceof Uint8Array) || envelopeBytes.length === 0) {
    return fail('transport.err.notBytes');
  }
  if (envelopeBytes.length > MAX_ENVELOPE_BYTES) return fail('transport.err.size');
  return {
    ok: true,
    text: `${STATIC_TEXT_MAGIC}|${STATIC_TEXT_VERSION}|${bytesToBase64url(envelopeBytes)}`,
  };
}

export function decodeStaticText(text) {
  const raw = String(text || '').trim();
  const parts = raw.split('|');
  if (parts.length !== 3) return fail('transport.err.staticFormat');
  if (parts[0] !== STATIC_TEXT_MAGIC) return fail('transport.err.staticMagic');
  if (parts[1] !== STATIC_TEXT_VERSION) return fail('transport.err.staticVersion');
  const b64 = parts[2].replace(/\s+/g, '');
  if (!b64 || b64.length > MAX_ENVELOPE_BYTES * 2) return fail('transport.err.size');
  let bytes;
  try {
    bytes = base64urlToBytes(b64);
  } catch {
    return fail('transport.err.base64');
  }
  if (bytes.length > MAX_ENVELOPE_BYTES) return fail('transport.err.size');
  return { ok: true, bytes };
}

export { equalBytes };
