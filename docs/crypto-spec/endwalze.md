# Endwalze

In Modern the historical UKW is replaced by a 26-letter **permutation that
is not involutory**. The signal does not return through the rotors.

Encrypt (after plugs and step):

`R → M → L → Thin → Endwalze → plugs`

Decrypt uses the same step, then:

`plugs → Endwalze⁻¹ → Thin ← L ← M ← R → plugs`

## V3 — free permutation

On a formatVersion-3 sheet the wiring is stored as `endwalzeWiring`: 26
unique A–Z letters. It is rolled with Fisher–Yates (`cryptoRandomInt`).
Involutions are discarded. Fixed points are allowed and counted, not
forbidden.

Bruno, Caesar, and Dora are not used as the Modern V3 end rotor.

## V2 / Traditional — derived wirings

Legacy Modern (formatVersion 1–2) still derives the end rotor from
Bruno / Caesar / Dora.

Affine family `wiring[i] = (a·i + b) mod 26` with `gcd(a, 26) = 1`:

| Name | a | b | When |
|---|---|---|---|
| Bruno | 3 | 5 | day-key UKW B |
| Caesar | 5 | 8 | day-key UKW C |
| Dora mix | 7 | 3 | composed with UKW-Dora |

### Dora

Build the involutory UKW-Dora pairing (format 1: fixed pair BO plus twelve
editable pairs; format 2 / Nur-Dora: thirteen free pairs). Then:

`Endwalze_Dora = ENDWALZE_DORA_MIX ∘ UKW_Dora`

Composition is `(F∘G)(i) = F(G(i))`. The result is not involutory.

## Policy on a sheet

| `endwalzePolicy` | Pool | Format |
|---|---|---|
| `permutation` | free 26-letter wiring | 3 |
| `dora` | Dora only, free wiring | 2 |
| `mix` | Bruno, Caesar, Dora (fixed BO) | 1 |
| `historic` | Bruno, Caesar | 1 |
| missing | treated as `mix` | 1 |

Modern sheets generated in the UI default to `permutation`. Traditional
defaults to `historic`. Old sheets are never silently read as V3.
