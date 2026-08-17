#!/usr/bin/env python3
"""Independent Alberich reference (Traditional + Modern V3).

Written from the specification, not transcribed from the JavaScript.
Golden vectors must match Web and the browser companion.

No security proof. No AES-equivalence claim.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import sys
from dataclasses import dataclass
from pathlib import Path

AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
STAMP = "ALBV"
PRUEF_LEN = 20
MID_LEN = 8
HKDF_SALT = b"ALBERICH-ALB3-AUTH"
HKDF_INFO = b"pruefgruppe-v1"
PRUEF_MOD = 26**20

ROTORS = {
    "I": ("EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"),
    "II": ("AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"),
    "III": ("BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"),
    "IV": ("ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"),
    "V": ("VZBRGITYUPSDNHLXAWMJQOFECK", "Z"),
    "VI": ("JPGVOUMFYQBENHZRDKASXLICTW", "ZM"),
    "VII": ("NZJHGRCXMYSWBOUFAIVLPEKQDT", "ZM"),
    "VIII": ("FKQHTLXOCBJSPDZRAMEWNIUYGV", "ZM"),
    "Beta": ("LEYJVCNIXWPBQMDRTAKZGFUHOS", ""),
    "Gamma": ("FSOKANUERHMBTIYCWLQPZXVGJD", ""),
}

REFLECTORS = {
    "B": "ENKQAUYWJICOPBLMDXZVFTHRGS",
    "C": "RDOBJNTKVEHMLFCWZAXGYIPSUQ",
}


def letter_pos(ch: str) -> int:
    return ord(ch.upper()) - 65


def pos_letter(i: int) -> str:
    return chr(65 + (i % 26 + 26) % 26)


def perm_of(wiring: str) -> list[int]:
    return [ord(c) - 65 for c in wiring]


def inverse_perm(wiring: str) -> list[int]:
    out = [0] * 26
    for i, c in enumerate(wiring):
        out[ord(c) - 65] = i
    return out


def int_to_base26(n: int, width: int) -> str:
    chars = ["A"] * width
    for i in range(width - 1, -1, -1):
        chars[i] = pos_letter(n % 26)
        n //= 26
    return "".join(chars)


def base26_to_int(letters: str) -> int:
    n = 0
    for ch in letters:
        n = n * 26 + letter_pos(ch)
    return n


def min_digits_for_byte_len(byte_len: int) -> int:
    if byte_len == 0:
        return 0
    limit = 1 << (8 * byte_len)
    k = 0
    acc = 1
    while acc < limit:
        acc *= 26
        k += 1
    return k


def byte_len_from_digits(k: int) -> int | None:
    if k == 0:
        return 0
    lo, hi = 1, max(4, k)
    while min_digits_for_byte_len(hi) < k:
        hi *= 2
    while lo <= hi:
        mid = (lo + hi) // 2
        d = min_digits_for_byte_len(mid)
        if d == k:
            return mid
        if d < k:
            lo = mid + 1
        else:
            hi = mid - 1
    return None


def utf8_to_base26v2(text: str) -> str:
    data = text.encode("utf-8")
    if not data:
        return ""
    n = int.from_bytes(data, "big")
    return int_to_base26(n, min_digits_for_byte_len(len(data)))


def base26v2_to_utf8(letters: str) -> str:
    clean = "".join(ch for ch in letters.upper() if "A" <= ch <= "Z")
    if not clean:
        return ""
    length = byte_len_from_digits(len(clean))
    if length is None:
        raise ValueError("modern.base26InvalidLength")
    n = base26_to_int(clean)
    if n >= 1 << (8 * length):
        raise ValueError("modern.base26Range")
    return n.to_bytes(length, "big").decode("utf-8")


def hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    out = b""
    block = b""
    counter = 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        out += block
        counter += 1
    return out[:length]


def encode_pruefgruppe(mac: bytes) -> str:
    n = int.from_bytes(mac[:12], "big") % PRUEF_MOD
    return int_to_base26(n, PRUEF_LEN)


def timing_safe_eq(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    acc = 0
    for x, y in zip(a.encode("ascii"), b.encode("ascii")):
        acc |= x ^ y
    return acc == 0


def normalize_plugs(plugboard: str) -> str:
    used: set[str] = set()
    pairs: list[str] = []
    for token in plugboard.upper().split():
        if len(token) != 2:
            continue
        x, y = token[0], token[1]
        if x == y or x in used or y in used:
            continue
        used.add(x)
        used.add(y)
        pairs.append(x + y if x < y else y + x)
    pairs.sort()
    return " ".join(pairs)


def normalize_ground_key(value: object) -> str:
    s = "".join(ch for ch in str(value or "").upper() if "A" <= ch <= "Z")
    return s[:4]


def canonical_day_key(cfg: dict) -> str:
    notches = cfg["notches"]
    return "\n".join(
        [
            "ALB3-KEY",
            f"net:{cfg.get('networkContext', 'ALB')}",
            f"epoch:{cfg.get('epoch', 'MANUAL')}",
            f"rotors:{cfg['rotorThin']},{cfg['rotorLeft']},{cfg['rotorMiddle']},{cfg['rotorRight']}",
            f"rings:{str(cfg.get('ringCode', '')).upper()}",
            f"ground:{normalize_ground_key(cfg.get('groundKey', ''))}",
            f"plugs:{normalize_plugs(cfg['plugboard'])}",
            f"end:{cfg['endwalzeWiring']}",
            f"notches:{notches['left']}|{notches['middle']}|{notches['right']}",
            "",
        ]
    )


def canonical_mac_input(cfg: dict, message_id: str, header: str, body: str) -> str:
    return "\n".join(
        [
            "ALB3-MAC",
            f"net:{cfg.get('networkContext', 'ALB')}",
            f"epoch:{cfg.get('epoch', 'MANUAL')}",
            f"mid:{message_id}",
            f"hdr:{header}",
            f"body:{body}",
            "",
        ]
    )


@dataclass
class Rotor:
    wiring: str
    notch: str
    pos: int = 0
    ring: int = 0

    def at_notch(self) -> bool:
        return any(self.pos == letter_pos(ch) for ch in self.notch)

    def forward(self, p: int) -> int:
        shift = (self.pos - self.ring) % 26
        mapped = perm_of(self.wiring)[(p + shift) % 26]
        return (mapped - shift) % 26

    def backward(self, p: int) -> int:
        shift = (self.pos - self.ring) % 26
        mapped = inverse_perm(self.wiring)[(p + shift) % 26]
        return (mapped - shift) % 26


class Machine:
    def __init__(self) -> None:
        self.left = Rotor(*ROTORS["I"])
        self.middle = Rotor(*ROTORS["II"])
        self.right = Rotor(*ROTORS["III"])
        self.thin = Rotor(*ROTORS["Beta"])
        self.mode = "traditional"
        self.protocol = "v2"
        self.reflector = REFLECTORS["B"]
        self.endwalze = "QWERTYUIOPASDFGHJKLZXCVBNM"
        self.plug: dict[str, str] = {}

    def set_plugboard(self, pairs: str) -> None:
        self.plug = {}
        for token in pairs.upper().split():
            if len(token) != 2 or token[0] == token[1]:
                continue
            if token[0] in self.plug or token[1] in self.plug:
                continue
            self.plug[token[0]] = token[1]
            self.plug[token[1]] = token[0]

    def apply_plug(self, ch: str) -> str:
        return self.plug.get(ch, ch)

    def set_rotors(
        self,
        left: str,
        middle: str,
        right: str,
        thin: str,
        pos_l: str,
        pos_m: str,
        pos_r: str,
        pos_t: str,
        ring_l: str,
        ring_m: str,
        ring_r: str,
        ring_t: str | None = None,
    ) -> None:
        self.left = Rotor(*ROTORS[left], pos=letter_pos(pos_l), ring=letter_pos(ring_l))
        self.middle = Rotor(*ROTORS[middle], pos=letter_pos(pos_m), ring=letter_pos(ring_m))
        self.right = Rotor(*ROTORS[right], pos=letter_pos(pos_r), ring=letter_pos(ring_r))
        thin_ring = letter_pos(ring_t) if ring_t and self.protocol == "v3" else 0
        self.thin = Rotor(*ROTORS[thin], pos=letter_pos(pos_t), ring=thin_ring)

    def step(self) -> None:
        if self.mode == "modern" and self.protocol == "v3":
            right_at = self.right.at_notch()
            middle_at = self.middle.at_notch()
            left_at = self.left.at_notch()
            if left_at:
                self.thin.pos = (self.thin.pos + 1) % 26
            if left_at or middle_at:
                self.left.pos = (self.left.pos + 1) % 26
            if middle_at or right_at:
                self.middle.pos = (self.middle.pos + 1) % 26
            self.right.pos = (self.right.pos + 1) % 26
            return
        step_middle = False
        step_left = False
        if self.middle.at_notch():
            step_left = True
            step_middle = True
        if self.right.at_notch():
            step_middle = True
        if step_left:
            self.left.pos = (self.left.pos + 1) % 26
        if step_middle:
            self.middle.pos = (self.middle.pos + 1) % 26
        self.right.pos = (self.right.pos + 1) % 26

    def encrypt_letter_traditional(self, ch: str) -> str:
        c = self.apply_plug(ch.upper())
        self.step()
        p = letter_pos(c)
        p = self.right.forward(p)
        p = self.middle.forward(p)
        p = self.left.forward(p)
        p = self.thin.forward(p)
        p = perm_of(self.reflector)[p]
        p = self.thin.backward(p)
        p = self.left.backward(p)
        p = self.middle.backward(p)
        p = self.right.backward(p)
        return self.apply_plug(pos_letter(p))

    def encrypt_letter_modern(self, ch: str) -> str:
        c = self.apply_plug(ch.upper())
        self.step()
        p = letter_pos(c)
        p = self.right.forward(p)
        p = self.middle.forward(p)
        p = self.left.forward(p)
        p = self.thin.forward(p)
        p = perm_of(self.endwalze)[p]
        return self.apply_plug(pos_letter(p))

    def decrypt_letter_modern(self, ch: str) -> str:
        c = self.apply_plug(ch.upper())
        self.step()
        p = letter_pos(c)
        p = inverse_perm(self.endwalze)[p]
        p = self.thin.backward(p)
        p = self.left.backward(p)
        p = self.middle.backward(p)
        p = self.right.backward(p)
        return self.apply_plug(pos_letter(p))

    def encrypt_message(self, text: str) -> str:
        out = []
        for ch in text:
            if ch.isalpha():
                if self.mode == "modern":
                    out.append(self.encrypt_letter_modern(ch))
                else:
                    out.append(self.encrypt_letter_traditional(ch))
            else:
                out.append(ch)
        return "".join(out)

    def decrypt_message(self, text: str) -> str:
        if self.mode != "modern":
            return self.encrypt_message(text)
        return "".join(
            self.decrypt_letter_modern(ch) if ch.isalpha() else ch for ch in text
        )


def configure_v3(machine: Machine, cfg: dict, key: str) -> None:
    machine.mode = "modern"
    machine.protocol = "v3"
    machine.endwalze = cfg["endwalzeWiring"]
    machine.set_rotors(
        cfg["rotorLeft"],
        cfg["rotorMiddle"],
        cfg["rotorRight"],
        cfg["rotorThin"],
        key[1],
        key[2],
        key[3],
        key[0],
        cfg.get("ringLeft", cfg["ringCode"][1]),
        cfg.get("ringMiddle", cfg["ringCode"][2]),
        cfg.get("ringRight", cfg["ringCode"][3]),
        cfg.get("ringThin", cfg["ringCode"][0]),
    )
    machine.left.notch = cfg["notches"]["left"]
    machine.middle.notch = cfg["notches"]["middle"]
    machine.right.notch = cfg["notches"]["right"]
    machine.set_plugboard(cfg["plugboard"])


def encrypt_v3(cfg: dict, plaintext: str, message_key: str, message_id: str) -> str:
    machine = Machine()
    configure_v3(machine, cfg, cfg["groundKey"])
    header = machine.encrypt_message(message_key)
    configure_v3(machine, cfg, message_key)
    body = machine.encrypt_message(utf8_to_base26v2(plaintext))
    auth = hkdf_sha256(canonical_day_key(cfg).encode("utf-8"), HKDF_SALT, HKDF_INFO)
    tag = hmac.new(auth, canonical_mac_input(cfg, message_id, header, body).encode("utf-8"), hashlib.sha256).digest()
    return STAMP + header + message_id + body + encode_pruefgruppe(tag)


def decrypt_v3(cfg: dict, telegram: str) -> str:
    clean = "".join(ch for ch in telegram.upper() if "A" <= ch <= "Z")
    if not clean.startswith(STAMP) or len(clean) < 4 + 4 + MID_LEN + PRUEF_LEN:
        raise ValueError("modern.notV3")
    header = clean[4:8]
    message_id = clean[8:16]
    pruef = clean[-PRUEF_LEN:]
    body = clean[16:-PRUEF_LEN]
    auth = hkdf_sha256(canonical_day_key(cfg).encode("utf-8"), HKDF_SALT, HKDF_INFO)
    expected = encode_pruefgruppe(
        hmac.new(auth, canonical_mac_input(cfg, message_id, header, body).encode("utf-8"), hashlib.sha256).digest()
    )
    if not timing_safe_eq(expected, pruef):
        raise ValueError("modern.macFailed")
    machine = Machine()
    configure_v3(machine, cfg, cfg["groundKey"])
    message_key = machine.decrypt_message(header)
    configure_v3(machine, cfg, message_key)
    return base26v2_to_utf8(machine.decrypt_message(body))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Alberich independent reference")
    parser.add_argument("--vectors", type=Path, help="JSON golden vectors to verify")
    args = parser.parse_args(argv)
    if not args.vectors:
        print("Alberich reference ready. Pass --vectors FILE.json")
        return 0
    data = json.loads(args.vectors.read_text(encoding="utf-8"))
    failed = 0
    for item in data.get("vectors", []):
        name = item["name"]
        try:
            if item["kind"] == "v3-roundtrip":
                got = encrypt_v3(item["day"], item["plain"], item["messageKey"], item["messageId"])
                if got != item["cipher"]:
                    raise AssertionError(f"cipher mismatch\n got {got}\n exp {item['cipher']}")
                back = decrypt_v3(item["day"], got)
                if back != item["plain"]:
                    raise AssertionError(f"plain mismatch {back!r}")
            elif item["kind"] == "traditional":
                machine = Machine()
                machine.mode = "traditional"
                machine.protocol = "v2"
                machine.reflector = REFLECTORS[item["reflectorId"]]
                machine.set_rotors(**item["rotors"])
                machine.set_plugboard(item["plugboard"])
                cipher = machine.encrypt_message(item["plain"])
                if cipher != item["cipher"]:
                    raise AssertionError(f"trad cipher {cipher}")
                machine.set_rotors(**item["rotors"])
                machine.set_plugboard(item["plugboard"])
                if machine.encrypt_message(cipher) != item["plain"]:
                    raise AssertionError("trad not involutory")
            elif item["kind"] == "base26v2":
                letters = utf8_to_base26v2(item["plain"])
                if letters != item["letters"]:
                    raise AssertionError(f"b26 {letters} != {item['letters']}")
                if base26v2_to_utf8(letters) != item["plain"]:
                    raise AssertionError("b26 roundtrip")
            else:
                raise AssertionError(f"unknown kind {item['kind']}")
            print("OK  ", name)
        except Exception as exc:  # noqa: BLE001 — report all vector failures
            failed += 1
            print("FAIL", name, exc)
    if failed:
        print(f"{failed} vector(s) failed")
        return 1
    print("All reference vectors matched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
