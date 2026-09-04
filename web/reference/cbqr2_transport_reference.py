#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
"""Independent CBQR2 Transport Envelope v1 decoder (RAW + GZIP)."""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

MAGIC = b"ALB3Q2"
VERSION = 1
CODEC_RAW = 0
CODEC_GZIP = 1
HEADER = 12
# 31-day HOUR_1, netLen 16: 19 + 16 + 744 * 70 + 64
MAX_CBQR2 = 52179
MAX_PAYLOAD = MAX_CBQR2 + 256
MAX_ENVELOPE = HEADER + MAX_PAYLOAD


def fail(code: str) -> dict:
    return {"ok": False, "rejected": "IMPORT_REJECTED", "error": code}


def decode_transport(data: bytes) -> dict:
    if not isinstance(data, (bytes, bytearray)):
        return fail("transport.err.notBytes")
    if len(data) < HEADER + 1:
        return fail("transport.err.truncated")
    if len(data) > MAX_ENVELOPE:
        return fail("transport.err.size")
    if data[:6] != MAGIC:
        return fail("transport.err.magic")
    if data[6] != VERSION:
        return fail("transport.err.version")
    codec = data[7]
    if codec not in (CODEC_RAW, CODEC_GZIP):
        return fail("transport.err.codec")
    uncompressed = int.from_bytes(data[8:12], "big")
    if uncompressed < 1 or uncompressed > MAX_CBQR2:
        return fail("transport.err.rawLength")
    payload = data[HEADER:]
    if len(payload) < 1 or len(payload) > MAX_PAYLOAD:
        return fail("transport.err.size")
    if codec == CODEC_RAW:
        if len(payload) != uncompressed:
            return fail("transport.err.rawLength")
        raw = payload
    else:
        try:
            decoder = gzip.GzipFile(fileobj=__import__("io").BytesIO(payload))
            chunks = []
            total = 0
            cap = min(uncompressed, MAX_CBQR2)
            while True:
                chunk = decoder.read(4096)
                if not chunk:
                    break
                total += len(chunk)
                if total > cap:
                    return fail("transport.err.gzipBomb")
                chunks.append(chunk)
            raw = b"".join(chunks)
        except OSError:
            return fail("transport.err.gzip")
        if len(raw) != uncompressed:
            return fail("transport.err.rawLength")
    return {
        "ok": True,
        "bytes": raw,
        "codec": codec,
        "uncompressedLength": uncompressed,
        "payloadLength": len(payload),
    }


def selftest() -> int:
    root = Path(__file__).resolve().parent
    golden = json.loads((root / "cbqr2-transport-golden.json").read_text())
    raw_env = bytes.fromhex(golden["raw"]["envelopeHex"])
    inner = bytes.fromhex(golden["raw"]["innerHex"])
    got = decode_transport(raw_env)
    if not got["ok"] or got["bytes"] != inner or got["codec"] != 0:
        print("FAIL python RAW golden", got)
        return 1
    gz = gzip.compress(inner)
    env = MAGIC + bytes([VERSION, CODEC_GZIP]) + len(inner).to_bytes(4, "big") + gz
    got = decode_transport(env)
    if not got["ok"] or got["bytes"] != inner or got["codec"] != 1:
        print("FAIL python GZIP roundtrip")
        return 1
    bad_ver = bytearray(raw_env)
    bad_ver[6] = 2
    if decode_transport(bytes(bad_ver))["ok"]:
        print("FAIL python unknown version")
        return 1
    print("OK   python transport RAW golden + GZIP roundtrip")
    return 0


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--selftest":
        return selftest()
    if len(sys.argv) < 2:
        print("usage: cbqr2_transport_reference.py <envelope.bin>|--selftest")
        return 2
    data = Path(sys.argv[1]).read_bytes()
    got = decode_transport(data)
    if not got["ok"]:
        print(got["error"], file=sys.stderr)
        return 1
    sys.stdout.buffer.write(got["bytes"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
