# Alberich Web – Release Notes (English)

**Current: 1.0 (Revision 68)** — follows revision 67. Local, not uploaded.

| Platform | Now |
|---|---|
| **Web** | 1.0 (Revision 68), local |
| **Android** | 1.0 (Revision 33), `versionCode` 33, local |
| **Companion** | 1.0.25 |
| **Thunderbird** | 1.0.18 |

What’s new (short): [`whatsnew-en.txt`](whatsnew-en.txt)  
Long form: [`whatsnew-long-en.txt`](whatsnew-long-en.txt)  
X: [`promo-x-en.txt`](promo-x-en.txt)

Revision 68: A ring setting typed by hand applies its first letter to the extra rotor. Display, export, authentication group and the machine use that same value. Older messages made with a different stored first letter (usually E) need that letter. Key-sheet import and key QR were not affected.

Revision 67: Network-bound codebooks, safer output/edit handling, bounded import and UTC+1 day selection. The hardened sheet date follows the key in use; shared ALBV messages are detected as ciphertext.

Hardened V3 on the normal web path: time slots, a full key per slot, rotor view follows the clock (unpinned), end rotor shown as 26-letter wiring, transfer by live QR or `.alb3cb2` binary file. The short explainer distinguishes 24 hours · Simple from V3 · daily key. Networks show hardened sheets with month and fingerprint.

Cipher core and ALBV telegram shape unchanged. Spec: [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md).
