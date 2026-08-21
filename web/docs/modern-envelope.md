# Modern — envelope and the integer

16 August 2026. Companion to [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md).
Not a security proof.

Modern is one procedure. The telegram wraps the rotors in a visible
envelope. The app shows stamp, message key, header, message ID and
check group in the same bar as the automatic message key.

## Telegram

```
ALBV | header | message ID | body | check group
  4       4         8          …        20
```

Minimum 36 letters. Groups of four are display only.

| Part | You see | Role |
|---|---|---|
| `ALBV` | Cleartext, always the same | Protocol stamp |
| Header | Rotor ciphertext | Message key under the ground setting |
| Message ID | 8 random A–Z, clear | Label for the MAC and replay; not rotor positions |
| Body | Rotor ciphertext | Base-26 digits of the message under the message key |
| Check group | 20 letters | HMAC tag. Not encrypted or decrypted |

Receive: see the stamp → run the header at ground setting → recover the
message key → recompute the tag → run the body at the message key →
integer → UTF-8.

`ALBV` is deliberate, like `BEGIN PGP MESSAGE`. It names the protocol,
not the key. Courier QR already says `ALBERICH-CTQR1`.

## The message as one integer

UTF-8 bytes become **one** integer. Another byte is

\[
n \leftarrow n \times 256 + \text{byte}
\]

256 is the size of a byte, not a length multiplier for the telegram.
The integer is written in base 26 (A=0 … Z=25). Length ≈ 1.70 letters
per plaintext byte plus 36 letters of envelope.

256 is not a power of 26, so appending remixes **all** digits. `A` →
`CN`, `AB` → `AYSO`, not `CN` plus two new letters. The rotors see a
new chain each time. They have no avalanche; the “everything changed”
look comes from the encoding.

Reverse: the digit count fixes the byte length; the integer becomes
bytes; UTF-8 becomes text.

A partial crib (a phrase somewhere in unknown text) does not map to a
fixed run of body letters. The **full** plaintext gives the integer and
thus the rotor input — the encoding is public.

## HKDF, HMAC, replay

**HMAC** (SHA-256, keyed): tag over network, day, message ID, header and
body. Without the sheet, guessing is about \(2^{94}\). With the sheet
anyone can tag. Stops silent mutation (legacy Modern accepted many
single-letter forgeries as other valid plaintext).

**HKDF**: derive a key **only for the tag** from the daily key (`salt`
`ALBERICH-ALB3-AUTH`, `info` `pruefgruppe-v1`). The rotors never see it.

**Replay**: in-session cache `epoch|messageId`, max 512. Same ID again
in this session → no plaintext. No cloud book. Your own last telegram
and re-processing the same field are not treated as replay.

The rotor hides text from anyone without the sheet. HMAC stops unnoticed
edits. HKDF separates keys. Replay is session-only.

## Greek / thin rotor

Always in the electrical path. Traditional: does not step; the Greek
rotor ring applies (historical M4). Modern: steps when the left rotor is
at a notch; no notches of its own. The ring applies in both modes.
