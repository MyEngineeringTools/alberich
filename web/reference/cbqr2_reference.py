#!/usr/bin/env python3
"""Independent CBQR2 / FULL_KEY_BIN_V1 reference.

Not transcribed from JavaScript. No third-party packages.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import struct
import sys
from pathlib import Path

MAGIC = b"ALB3CB2"
VERSION = 1
KEY_TIME_UTC_PLUS_1 = 1
HEADER_PREFIX = 19
KEY_BYTES = 70
HASH_BYTES = 32
NOTCH_COUNTS = {5, 7, 9}

ROTOR_BY_ID = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "Beta",
    10: "Gamma",
}
ROTOR_ID = {name: i for i, name in ROTOR_BY_ID.items()}
THIN = {9, 10}
MAIN = {1, 2, 3, 4, 5, 6, 7, 8}
PROFILE_BY_ID = {0: "DAY_24H", 1: "HOURS_4", 2: "HOUR_1"}
SLOTS = {"DAY_24H": 1, "HOURS_4": 6, "HOUR_1": 24}


class Reject(Exception):
    pass


def days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def letter(n: int) -> str:
    if not 0 <= n <= 25:
        raise Reject("cbqr2.err.letter")
    return chr(65 + n)


def u8(ch: str) -> int:
    n = ord(ch) - 65
    if not 0 <= n <= 25:
        raise Reject("cbqr2.err.letter")
    return n


def notch_mask(letters: str) -> int:
    mask = 0
    for ch in letters:
        mask |= 1 << u8(ch)
    return mask


def letters_from_mask(mask: int) -> str:
    if mask < 0 or mask >= (1 << 26):
        raise Reject("cbqr2.err.notchReserved")
    out = []
    for i in range(26):
        if mask & (1 << i):
            out.append(letter(i))
    if len(out) not in NOTCH_COUNTS:
        raise Reject("cbqr2.err.notches")
    return "".join(out)


def canonical_plugs(plugboard: str) -> list[str]:
    pairs = []
    used: set[str] = set()
    for token in plugboard.upper().split():
        if len(token) != 2:
            raise Reject("codebook.err.plugsInvalid")
        a, b = token[0], token[1]
        if a == b:
            raise Reject("codebook.err.plugSelf")
        if a in used or b in used:
            raise Reject("codebook.err.plugDuplicate")
        used.add(a)
        used.add(b)
        pairs.append(a + b if a < b else b + a)
    pairs.sort()
    if len(pairs) != 10:
        raise Reject("codebook.err.plugsInvalid")
    return pairs


def is_involution(wiring: str) -> bool:
    if len(wiring) != 26:
        return False
    for i, ch in enumerate(wiring):
        j = ord(ch) - 65
        if ord(wiring[j]) - 65 != i:
            return False
    return True


def is_permutation(wiring: str) -> bool:
    return len(wiring) == 26 and set(wiring) == set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def encode_key(key: dict) -> bytes:
    thin = ROTOR_ID[key["rotorThin"]]
    left = ROTOR_ID[key["rotorLeft"]]
    middle = ROTOR_ID[key["rotorMiddle"]]
    right = ROTOR_ID[key["rotorRight"]]
    if thin not in THIN or left not in MAIN or middle not in MAIN or right not in MAIN:
        raise Reject("cbqr2.err.rotorId")
    if len({left, middle, right}) != 3:
        raise Reject("codebook.err.mainUnique")
    pairs = canonical_plugs(key["plugboard"])
    out = bytearray(KEY_BYTES)
    out[0:4] = bytes((thin, left, middle, right))
    for i, ch in enumerate(key["ringCode"]):
        out[4 + i] = u8(ch)
    for i, ch in enumerate(key["keyCode"]):
        out[8 + i] = u8(ch)
    for i, pair in enumerate(pairs):
        a, b = u8(pair[0]), u8(pair[1])
        if a >= b:
            raise Reject("cbqr2.err.plugsCanonical")
        out[12 + i * 2] = a
        out[13 + i * 2] = b
    wiring = key["endwalzeWiring"]
    if not is_permutation(wiring) or is_involution(wiring):
        raise Reject("modern.endwalzeInvalid")
    for i, ch in enumerate(wiring):
        out[32 + i] = u8(ch)
    notches = key["lueckenfueller"]
    struct.pack_into(">I", out, 58, notch_mask(notches["left"]))
    struct.pack_into(">I", out, 62, notch_mask(notches["middle"]))
    struct.pack_into(">I", out, 66, notch_mask(notches["right"]))
    return bytes(out)


def decode_key(raw: bytes) -> dict:
    if len(raw) != KEY_BYTES:
        raise Reject("cbqr2.err.keyLength")
    thin, left, middle, right = raw[0:4]
    if thin not in THIN or left not in MAIN or middle not in MAIN or right not in MAIN:
        raise Reject("cbqr2.err.rotorId")
    if len({left, middle, right}) != 3:
        raise Reject("codebook.err.mainUnique")
    ring = "".join(letter(b) for b in raw[4:8])
    ground = "".join(letter(b) for b in raw[8:12])
    pairs = []
    used: set[str] = set()
    for i in range(10):
        a, b = raw[12 + i * 2], raw[13 + i * 2]
        if a > 25 or b > 25 or a >= b:
            raise Reject("cbqr2.err.plugsCanonical")
        pa, pb = letter(a), letter(b)
        if pa in used or pb in used:
            raise Reject("codebook.err.plugDuplicate")
        used.add(pa)
        used.add(pb)
        pairs.append(pa + pb)
    if pairs != sorted(pairs):
        raise Reject("cbqr2.err.plugsCanonical")
    wiring = "".join(letter(b) for b in raw[32:58])
    if not is_permutation(wiring) or is_involution(wiring):
        raise Reject("modern.endwalzeInvalid")
    left_m, mid_m, right_m = struct.unpack_from(">III", raw, 58)
    if left_m >> 26 or mid_m >> 26 or right_m >> 26:
        raise Reject("cbqr2.err.notchReserved")
    return {
        "rotorThin": ROTOR_BY_ID[thin],
        "rotorLeft": ROTOR_BY_ID[left],
        "rotorMiddle": ROTOR_BY_ID[middle],
        "rotorRight": ROTOR_BY_ID[right],
        "ringCode": ring,
        "keyCode": ground,
        "plugboard": " ".join(pairs),
        "endwalzeWiring": wiring,
        "lueckenfueller": {
            "left": letters_from_mask(left_m),
            "middle": letters_from_mask(mid_m),
            "right": letters_from_mask(right_m),
        },
    }


def full_key_fingerprint(key: dict) -> str:
    plugs = " ".join(canonical_plugs(key["plugboard"]))
    n = key["lueckenfueller"]
    text = (
        "ALB3-FULLKEY-V1\n"
        f"rotors:{key['rotorThin']},{key['rotorLeft']},{key['rotorMiddle']},{key['rotorRight']}\n"
        f"rings:{key['ringCode'].upper()}\n"
        f"ground:{key['keyCode'].upper()}\n"
        f"plugs:{plugs}\n"
        f"end:{key['endwalzeWiring'].upper()}\n"
        f"notches:{n['left']}|{n['middle']}|{n['right']}\n"
    )
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def timebook_fingerprint(year: int, month: int, profile: str, slots: list[tuple[int, int, str]]) -> str:
    lines = [
        "ALB3-TIMEBOOK-ID-V1",
        f"year:{year}",
        f"month:{month}",
        f"timeProfile:{profile}",
        "keyTimeReference:UTC+1",
        "slots:",
    ]
    for day, index, fp in slots:
        lines.append(f"{day}|{index}|{fp}")
    return hashlib.sha256(("\n".join(lines) + "\n").encode("utf-8")).hexdigest()


def decode_cbqr2(data: bytes) -> dict:
    if len(data) < HEADER_PREFIX + 1 + HASH_BYTES * 2:
        raise Reject("cbqr2.err.truncated")
    if data[:7] != MAGIC:
        raise Reject("cbqr2.err.magic")
    if data[7] != VERSION:
        raise Reject("cbqr2.err.version")
    if data[8] != 0:
        raise Reject("cbqr2.err.flags")
    year = struct.unpack_from(">H", data, 9)[0]
    month = data[11]
    profile_id = data[12]
    key_time = data[13]
    days_h = data[14]
    slots_h = data[15]
    key_count_h = struct.unpack_from(">H", data, 16)[0]
    net_len = data[18]
    profile = PROFILE_BY_ID.get(profile_id)
    if profile is None:
        raise Reject("timebook.err.profile")
    if key_time != KEY_TIME_UTC_PLUS_1:
        raise Reject("timebook.err.keyTime")
    days = days_in_month(year, month)
    slots_per = SLOTS[profile]
    key_count = days * slots_per
    if days_h != days or slots_h != slots_per or key_count_h != key_count:
        raise Reject("cbqr2.err.calendar")
    expected = HEADER_PREFIX + net_len + key_count * KEY_BYTES + HASH_BYTES * 2
    if len(data) != expected:
        raise Reject("cbqr2.err.truncated" if len(data) < expected else "cbqr2.err.trailing")
    net = data[19 : 19 + net_len].decode("ascii")
    if not net or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" for c in net):
        raise Reject("cbqr2.err.networkContext")
    off = 19 + net_len
    rec_slots = []
    seen = set()
    for day in range(1, days + 1):
        for index in range(slots_per):
            key = decode_key(data[off : off + KEY_BYTES])
            fp = full_key_fingerprint(key)
            if fp in seen:
                raise Reject("timebook.err.duplicateKey")
            seen.add(fp)
            rec_slots.append((day, index, fp, key))
            off += KEY_BYTES
    stored_fp = data[off : off + HASH_BYTES]
    stored_digest = data[off + HASH_BYTES :]
    digest = hashlib.sha256(data[: -HASH_BYTES]).digest()
    if digest != stored_digest:
        raise Reject("cbqr2.err.packageDigest")
    identity = timebook_fingerprint(year, month, profile, [(d, i, fp) for d, i, fp, _ in rec_slots])
    if bytes.fromhex(identity) != stored_fp:
        raise Reject("cbqr2.err.codebookFingerprint")
    return {
        "year": year,
        "month": month,
        "timeProfile": profile,
        "networkContext": net,
        "keyCount": key_count,
        "codebookFingerprint": identity,
        "packageSha256": hashlib.sha256(data).hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()
    data = Path(args.path).read_bytes()
    try:
        info = decode_cbqr2(data)
    except Reject as err:
        print(f"REJECT {err}", file=sys.stderr)
        return 1
    print(json_dumps(info))
    return 0


def json_dumps(obj: dict) -> str:
    import json

    return json.dumps(obj, sort_keys=True)


if __name__ == "__main__":
    sys.exit(main())
