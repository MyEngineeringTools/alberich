# Tafelwort

A seven-letter check over the **slim** month sheet. Partners compare it after
import. Display: `XXXX XXX`.

`monthLabel`, `generatedAt`, and per-day `date` are **not** in the digest.

## Canonical stream

UTF-8, one `\n` after every line, including the last:

```
ALBTW1
{formatVersion}
{year}
{month}
{endwalzePolicy or empty}
{networkContext}          ← formatVersion ≥ 3 only
{day}|…                   ← one line per day
```

Days are sorted by `day`. `formatVersion` defaults to 1 if missing.

### formatVersion 1–2

```
{day}|{reflectorId}|{thin}|{left}|{middle}|{right}|{ring}|{key}|{stecker}|{dora or empty}
```

Dora column is empty when `reflectorD` is absent.

### formatVersion 3

```
{day}|PERM|{thin}|{left}|{middle}|{right}|{ring}|{key}|{stecker}|{endwalzeWiring}|{lfLeft}|{lfMiddle}|{lfRight}
```

The extra `networkContext` line sits after the policy line. Default
context is `ALB`.

## Digest

IEEE CRC-32, polynomial `0xEDB88320`, same as `java.util.zip.CRC32`.
Known vector: UTF-8 `123456789` → `0xCBF43926`.

Map the 32-bit value to seven letters A–Z, most significant digit on the
left (base 26). Zero is `AAAAAAA`.
