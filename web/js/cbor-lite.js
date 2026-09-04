/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Tiny deterministic CBOR subset for MUR parts and ur:bytes wrapping.
 * Unsigned integers, byte strings, definite arrays only. No tags, no
 * indefinite lengths, no floats. Trailing bytes rejected.
 */

function fail(error) {
  const err = new Error(error);
  err.code = error;
  return err;
}

export function encodeUint(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw fail('cbor.err.uint');
  }
  if (n < 24) return Uint8Array.of(n);
  if (n < 256) return Uint8Array.of(0x18, n);
  if (n < 65536) return Uint8Array.of(0x19, n >> 8, n & 0xff);
  const out = new Uint8Array(5);
  out[0] = 0x1a;
  new DataView(out.buffer).setUint32(1, n, false);
  return out;
}

export function encodeBstr(bytes) {
  if (!(bytes instanceof Uint8Array)) throw fail('cbor.err.bstr');
  const len = bytes.length;
  let header;
  if (len < 24) header = Uint8Array.of(0x40 + len);
  else if (len < 256) header = Uint8Array.of(0x58, len);
  else if (len < 65536) header = Uint8Array.of(0x59, len >> 8, len & 0xff);
  else {
    header = new Uint8Array(5);
    header[0] = 0x5a;
    new DataView(header.buffer).setUint32(1, len, false);
  }
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(bytes, header.length);
  return out;
}

export function encodeArray(encodedItems) {
  const n = encodedItems.length;
  if (n >= 24) throw fail('cbor.err.array');
  let total = 1;
  for (const it of encodedItems) total += it.length;
  const out = new Uint8Array(total);
  out[0] = 0x80 + n;
  let o = 1;
  for (const it of encodedItems) {
    out.set(it, o);
    o += it.length;
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{ value: unknown, offset: number }}
 */
export function decodeItem(bytes, offset = 0) {
  if (offset >= bytes.length) throw fail('cbor.err.truncated');
  const ib = bytes[offset];
  const major = ib >> 5;
  const add = ib & 0x1f;
  let pos = offset + 1;
  let n;
  if (add < 24) n = add;
  else if (add === 24) {
    if (pos >= bytes.length) throw fail('cbor.err.truncated');
    n = bytes[pos];
    pos += 1;
  } else if (add === 25) {
    if (pos + 1 >= bytes.length) throw fail('cbor.err.truncated');
    n = (bytes[pos] << 8) | bytes[pos + 1];
    pos += 2;
  } else if (add === 26) {
    if (pos + 3 >= bytes.length) throw fail('cbor.err.truncated');
    n = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0, false);
    pos += 4;
  } else {
    throw fail('cbor.err.unsupported');
  }

  if (major === 0) {
    return { value: n, offset: pos };
  }
  if (major === 2) {
    if (pos + n > bytes.length) throw fail('cbor.err.truncated');
    return { value: bytes.subarray(pos, pos + n), offset: pos + n };
  }
  if (major === 4) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const next = decodeItem(bytes, pos);
      items.push(next.value);
      pos = next.offset;
    }
    return { value: items, offset: pos };
  }
  throw fail('cbor.err.unsupported');
}

export function decodeExact(bytes) {
  const r = decodeItem(bytes, 0);
  if (r.offset !== bytes.length) throw fail('cbor.err.trailing');
  return r.value;
}

export function unwrapBstr(bytes) {
  const value = decodeExact(bytes);
  if (!(value instanceof Uint8Array)) throw fail('cbor.err.notBstr');
  return value;
}
