# Alberich Web – Release Notes (English)

**Current: 1.0 (Revision 67)** — follows revision 65.

| Platform | Now |
|---|---|
| **Web** | 1.0 (Revision 67) |
| **Android** | 1.0 (Revision 31), `versionCode` 31 |
| **Companion** | 1.0.25 |
| **Thunderbird** | 1.0.18 |

What’s new (short): [`whatsnew-en.txt`](whatsnew-en.txt)  
Long form: [`whatsnew-long-en.txt`](whatsnew-long-en.txt)  
X: [`promo-x-en.txt`](promo-x-en.txt)

Revision 67: Network-bound codebooks, safer output/edit handling, bounded import and UTC+1 day selection. The hardened sheet date follows the key in use; shared ALBV messages are detected as ciphertext.

Hardened V3 on the normal web path: time slots, a full key per slot, rotor view follows the clock (unpinned), end rotor shown as 26-letter wiring, transfer by live QR or `.alb3cb2` binary file. The short explainer distinguishes 24 hours · Simple from V3 · daily key. Networks show hardened sheets with month and fingerprint.

Cipher core and ALBV telegram shape unchanged. Spec: [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md).
