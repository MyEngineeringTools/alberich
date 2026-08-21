# Alberich – Quick guide

Same text as **Guide** in the web app. Tutorials with videos:
[alberich.pro/blog](https://alberich.pro/blog/).

## 1. What is Alberich?

Alberich is a free Enigma M4 simulator in the browser (German/English), no account required. Four-rotor cipher with rotors, rings, plugboard and daily keys — plus code sheets and networks. Monthly sheets are created in the web app or the Android app.

## 2. Two main modes

**Traditional:** Historical behaviour (involutory, A–Z). Sub-options *Simple* and *Message key*. Best for learning and classic practice.

**Modern:** Everyday package — any text (UTF-8), automatic message key, end rotor and filler rotors. You only maintain the daily key; encrypt and decrypt use separate paths (not involutory).

The active mode is shown at the top. Switch with “Traditional” / “Modern”; in Traditional also pick the procedure.

## 3. Modern – everyday use

How to send and receive a message in Modern mode:

1. Select main mode “Modern”.
2. Set the daily key (tap rotors → setup): ground setting, rings, plugboard, rotor order — from a code sheet or manually. At least 3 plugboard pairs.
3. Send: input type “Plaintext”, type or paste the message. Output is the ciphertext (groups of 4).
4. Share the ciphertext (copy/share). The receiver needs the same daily key.
5. Receive: input type “Ciphertext”, paste the full ciphertext — from ALBV through the check group at the end. Output is the original text.
6. Courier: show the QR on the output to hand the ciphertext to another device (e.g. the Android app). Texts that are too long are flagged above the input field. You can ignore this if you are not using courier.

Modern telegram layout (shown in the bar like the message key):

- Stamp ALBV — unencrypted, always the same four letters. Marks a Modern telegram.
- Header (4) — rotor ciphertext. It carries the message key encrypted under the ground setting.
- Message ID (8) — random letters in the clear, not rotor positions. Bound into the tag; used for in-session replay.
- Body — the message as one integer in A–Z, then through the rotors. Another character changes the whole integer (×256 + byte), so the body looks freshly mixed while you type.
- Check group (20) — HMAC tag at the end. Not encrypted or decrypted; only recomputed and compared. Without it and without the full telegram there is no plaintext.

HKDF derives a key from the sheet for the tag only. HMAC rejects changes before any plaintext appears. Replay remembers message ID plus day in this session — no cloud address book.

Per message Alberich picks a new random message key and message ID. New after clearing fields, switching roles, or changing the daily key — not on every keystroke. The header in the bar is the second group of four, not ALBV.

Any characters (umlauts, numbers, emoji…) are handled via Base-26 internally. You do not re-encode anything yourself.

Fewer than 3 plugboard pairs: error, no encryption. Add pairs in setup.

## 4. Traditional

**Simple:** One start position for the whole text. Type → output. The same settings decrypt again (reciprocal).

**Message key:** Historical procedure with manual control:

1. Set the daily key (including ground setting).
2. For each message choose or dice a new message key (4 letters).
3. Send plaintext: header is built from the message key; body runs under that key.
4. Receive ciphertext: paste — first 4 letters = header → message key; rest = body.

A–Z only for the machine. Numbers and punctuation are converted (e.g. period → X, comma → Y, ? → UD). Spaces stay in the input.

## 5. Keys & networks

**Rotor order:** Thin / Greek rotor (Beta/Gamma) + three main rotors (I–VIII), each main rotor once. Example B241 = Beta + II + IV + I. It sits in the electrical path in every mode. Traditional: it does not step; its ring setting applies. Modern: it steps when the left rotor is at a notch; it has no notches of its own and drives nothing. The Greek rotor ring applies in both modes.

**Ring settings:** 4 letters, fixed for the message / day.

**Ground setting:** Start positions from the daily key. In Traditional · Simple often the visible start; in Message key / Modern the daily start (message key separate or automatic).

**Plugboard:** Pairs separated by spaces (e.g. AB CD EF). Historically often 10 pairs; Modern needs at least 3.

**Reflector / end rotor:** Traditional: Bruno, Caesar or Dora. Modern: a full 26-letter permutation on the sheet.

**End rotor on the sheet:** Modern always creates a free permutation (telegram ALBV). Traditional: *Mix* or *Bruno/Caesar only*.

**Random without a sheet:** Under Random / Manual the same end-rotor choice as for sheets. The default follows the main mode; a note appears if it does not match. Random rolls the daily key according to the chosen policy.

**Code sheet:** In setup, generate a monthly sheet or import JSON/QR and pick the day — or set keys manually/randomly. “Show sheet” opens the monthly table; from there print or copy as text. If the sheet is for the current month, the page selects today on load (older days stay selectable). If the month does not match, a notice appears — you can keep the chosen day or create a new sheet. After loading, a seven-letter sheet word appears. Compare it once with your partner: same word, same sheet.

**Networks:** Up to five named networks, each with a monthly sheet. Generate a sheet in setup or import JSON/QR. Share sheets (JSON, QR, system share). “Remove sheet” clears the active network; “Emergency wipe” deletes every sheet in this browser.

## 6. Tips

- Change rotors and keys only when message fields are empty.
- Always check the active mode at the top before sending.
- Traditional and Modern do not mix: both sides need the same mode and daily key.
- With Alberich you can encrypt your communication securely and quickly — independent of messenger, email or SMS. Alberich is not unbreakable, though. Join our daily challenge on X and try to crack it!

## 7. Two devices (courier)

Courier splits computing from transport. Encrypt and decrypt stay on a second device that remains offline (courier off, airplane mode). The everyday online device (courier on) only ever sees the finished ciphertext.

Why: debates about client-side scanning (“Chat Control 2.0”) target the communications device. If plaintext and the daily key never live there, such a scan only gets letter salad.

This is not legal advice and does not hide metadata (who talked to whom, when). The offline device must not go “briefly online”; no cloud backups, no screenshots of plaintext.

1. Offline: courier off, Modern, daily key from the code sheet. This device does the crypto.
2. Online: courier on. No code sheet, no plaintext. Only QR and letters.
3. Send: encrypt offline, show QR, scan online, copy letters into the messenger.
4. Receive: paste letters or show a QR online, scan offline, decrypt.
