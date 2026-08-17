# Automatic message key (Modern)

Every Modern message uses a fresh four-letter key from the Web Crypto CSPRNG.
Those four letters are the rotor start positions, including the moving Thin
rotor in V3.

## V3 telegram

```
ALBV | HDR4 | MID8 | BODY | PRUEF20
```

`ALBV` is the visible stamp. The internal protocol name stays `ALB3`.

Encrypt:

1. Configure the machine on the **ground** (`keyCode`, four letters).
2. Encrypt the four-letter message key → **HDR4**.
3. Draw an 8-letter **message id** (not a rotor position).
4. Configure on the **message key**.
5. Encrypt `utf8ToBase26v2(plaintext)` → **BODY**.
6. Append the 20-letter Prüfgruppe (HMAC-SHA-256 over HKDF-SHA-256).

Decrypt: **MAC first**. On failure, no plaintext. Then recover the message
key from HDR4 and decrypt the body.

Minimum length: 36 letters.

## V2 / legacy telegram

Encrypt:

1. Configure the machine on the **ground**.
2. Encrypt the four-letter message key → **header**.
3. Configure on the **message key**.
4. Encrypt `utf8ToBase26(plaintext)` → **body**.
5. Ciphertext is `header + body` (shown in groups of four).

Decrypt:

1. Configure on ground, decrypt the first four letters → message key.
2. Configure on that key, decrypt the body, run Base-26 → UTF-8.
3. **Round-trip check:** encrypt again with the recovered key. If header or
   body does not match, fail (`modern.decryptFailed` or
   `modern.decryptIncomplete` if the body length is odd).

Traditional “message key” is the historical procedure and is separate.
The Endwalze is inverted only on the Modern decrypt path; the indicator
procedure above already accounts for that by using `encryptMessage` /
`decryptMessage` on the engine.
