# Lückenfüller

Modern does not use the historical single/double notches. The three moving
rotors get notch sets of size **5, 7, or 9** (coprime to 26, away from 1
and from 15–25). Thin rotor has none.

## V3 — independent notches on the sheet

Counts and positions are **daily key material**, visible on the sheet.

- Count per rotor L/M/R from `{5,7,9}`
- Positions: CSPRNG subset of A–Z, stored sorted A→Z
- Import: no silent normalisation
- Invalid count, duplicates, or unsorted letters → reject

## V2 — derivation (Weg B)

Legacy Modern (formatVersion 1–2) derives notches from rings and plugs.
No extra sheet field.

Inputs: ring letters of left / middle / right, and at least three plug pairs.
Pairs are canonicalised (each pair A<B, list sorted).

For slot `i ∈ {0,1,2}` and pairs `p_j = pairs[j mod n]`:

```
shift[i] = ( ring[i]
  + 7·p_i[0] + 11·p_i[1]
  + 3·p_{i+1}[0] + 5·p_{i+1}[1]
  + 13·p_{i+2}[0]
  + 17·n + 19·i ) mod 26

countIdx[i] = ( ring[i]
  + 11·p_i[0] + 13·p_i[1]
  + 17·p_{i+1}[0] + 19·p_{i+1}[1]
  + 23·p_{i+2}[1]
  + 3·n + 7·i ) mod 3

count[i] = {5,7,9}[countIdx[i]]
```

Letters in a pair are taken as `A=0 … Z=25`.

Base pattern for a count `c`:

`position[k] = floor(k · 26 / c)` for `k = 0 … c−1`

Then rotate every letter by `shift[i]` mod 26 and sort.

Fewer than three plug pairs: Modern refuses to configure.
