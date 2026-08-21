# Modern V3 — Spezifikation

Stand: 17. August 2026. Normativ sind diese Datei plus die Selbsttests
und die Python-Referenz `reference/alberich_reference.py`.
Nutzererklärung (Hülle, Zahl, HMAC): [`modern-hulle.md`](modern-hulle.md).

Modern V3 ist ein **experimentelles Rotor-Kryptosystem**. Es ist kein
AEAD-Ersatz für AES und trägt **keinen Sicherheitsbeweis**.

```
Nominal keyspace: siehe research/results/keyspace.json
Equivalent-key adjusted: nach Dead/Equivalent-Key-Labor
Best demonstrated attack: research/results/*.json
Security proof: none
```

Nicht behauptet: AES-128/192-Äquivalenz, NIST-Sicherheit, feste
Security-Bits ohne Messung.

## Was unverändert bleibt

Traditional (historische M4, involutorisch) ändert sich nicht.

Modern V2 (formatVersion 1–2, abgeleitete Kerben, Dora/Bruno/Caesar)
bleibt entschlüsselbar. Ein V2-Telegramm wird auf einer V3-Tafel
abgelehnt. Ein V3-Telegramm wird auf einer V2-Tafel abgelehnt.

## Telegramm

Nur A–Z. Gruppen zu 4 Buchstaben sind Anzeige, nicht Teil der Chiffre.

```
ALBV | HDR4 | MID8 | BODY | PRUEF20
```

`ALBV` ist der sichtbare Stempel. Der interne Protokollname bleibt
`ALB3`. Eine Ziffer im Stempel würde `extractLetters` zerstören.

- HDR4: verschlüsselter 4-Buchstaben-Spruchschlüssel (Walzenlagen)
- MID8: zufällige Message-ID, keine Walzenlage
- BODY: Base-26-V2-Klartext, durch die Rotormaschine
- PRUEF20: HMAC-Tag, ≈ 94,1 Bit, 5 Vierergruppen

Mindestlänge 36 Buchstaben.

## Maschine

Signalweg Modern (unverändert in der Idee, nicht involutorisch):

```
Stecker → Right → Middle → Left → Thin → Endwalze → Stecker
```

Entschlüsseln: invertierter Weg, gleiche Schrittfolge.

### Schritt V3

Kerben werden **vor** jeder Bewegung gelesen.

- Right läuft immer.
- Right an einer Kerbe → Middle.
- Middle an einer Kerbe → Left und Middle (Doppel Schritt).
- Left an einer Kerbe → Thin und Left (Doppel Schritt).
- Thin hat keine Kerben. Thin treibt nichts.

Traditional und V2 behalten den Dreier-Schritt (linke Kerbe tot, Thin fest).

### Thin-Ring

`thin.ring` gilt in Traditionell (historische M4) und in Modern V3.
Die Griechenwalze steppt nur in V3. V2 wird nicht weiter unterstützt.

### Endwalze

26!-Permutation, Fisher–Yates mit `cryptoRandomInt`.
Involutionen werden beim Würfeln verworfen (bis zu 64 Versuche).
Scheitern alle Versuche, bricht die Erzeugung hart ab
(`Unable to generate secure non-involutory end-wheel permutation`).
Es gibt keinen festen Ersatz-String und kein stilles Downgrade.
Fixpunkte sind erlaubt und werden gezählt, nicht verboten.
Format: `endwalzeWiring` = 26 eindeutige A–Z.

Bruno/Caesar/Dora bleiben für Traditional und Legacy-V2.

### Lückenfüller

Unabhängiges Tagesmaterial auf der Tafel, sichtbar.

- Anzahl je Walze L/M/R aus `{5,7,9}`
- Positionen: CSPRNG-Teilmenge von A–Z, gespeichert sortiert A→Z
- Import: keine stillschweigende Normalisierung
- ungültige Anzahl, Duplikate, Unsortiertheit → Ablehnung

## Base-26 V2

Die ganze UTF-8-Nachricht ist eine große Ganzzahl (big-endian).
Die Buchstabenanzahl `k` bestimmt die Bytelänge `L` eindeutig, weil
`k = min{ n | 26^n ≥ 256^L }` streng monoton in `L` ist.

Leer → leer. Ungültiges `k`, Wert ≥ 256^L oder kein UTF-8 → Fehler.

Das A–J-Muster an jeder geraden Position von V1 entfällt für längere
Texte. Die höchstwertige Stelle bleibt leicht verzerrt — das wird nicht
als Avalanche verkauft.

## Prüfgruppe

HKDF-SHA-256 über Web Crypto (Python: RFC 5869, SHA-256).

```
IKM  = canonicalDayKey  (UTF-8, Zeilen + Schluss-LF)
salt = "ALBERICH-ALB3-AUTH"
info = "pruefgruppe-v1"
L    = 32
```

`canonicalDayKey` ist der vollständige Tagesschlüssel, einschließlich
Grundstellung. Kanonische Zeilen, Schluss-LF:

```
ALB3-KEY
net:<netz>
epoch:<YYYY-MM-DD|MANUAL>
rotors:<thin>,<left>,<middle>,<right>
rings:<4>
ground:<4>
plugs:<kanonische Paare>
end:<26>
notches:<L>|<M>|<R>
```

`ground` ist A–Z, genau vier Buchstaben, keine locale-abhängige
Normalisierung. Encrypt und Decrypt übergeben dieselbe Grundstellung,
die den Spruchschlüssel-Header verschlüsselt. Falsche Grundstellung
scheitert am MAC; Klartext wird nicht freigegeben.

HMAC-SHA-256(authKey, canonicalMacInput).
Tag = erste 12 Bytes als Big-Endian-Integer modulo 26^20 → 20 Buchstaben.

Decrypt: **MAC zuerst**. Bei Fehler kein Klartext.

Replay: optionaler Sitzungs-Cache `(epoch|messageId)`, max. 512, kein Cloud-State.

Netzkontext der ersten V3-Runde: fest `ALB` (nicht die lokale UUID — die
hätten Sender und Empfänger nicht gemeinsam).

## Codebook formatVersion 3

Neue Tafeln im Modern-Default. Alte Versionen 1/2 bleiben gültig und
werden nicht als V3 gelesen. Android lehnt Version 3 ab, bis es portiert
ist.

## Spruchschlüssel

Weiter 4 Buchstaben: vier Walzenlagen, inkl. mitlaufender Thin.
Zusätzliche Entropie sitzt in der Message-ID, nicht in einer achten
Walzenposition.
