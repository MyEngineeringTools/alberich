# Modern V3 — Spezifikation

Stand: 17. August 2026. Normativ sind diese Datei plus die Selbsttests
und die Python-Referenz `reference/alberich_reference.py`.

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

Kerben werden **vor** jeder Bewegung gelesen. **Live-V3** (ab Revision 47)
ist der vierstufige Double-Step — derselbe, der online ging:

- Right läuft immer.
- Right an einer Kerbe → Middle.
- Middle an einer Kerbe → Left und Middle (Doppel Schritt).
- Left an einer Kerbe → Thin und Left (Doppel Schritt).
- Thin hat keine Kerben. Thin treibt nichts.

Die reine Lückenfüller-Kaskade (Carry ohne Double-Step) ist eine
**Future Option**, nicht der Live-Pfad. Spezifikation:
[cascade-future.md](cascade-future.md). Code: `nextV3PositionsCascade`.
Sie ist bijektiv, bricht aber Sprüche der veröffentlichten 47.

Eine volle Periode ist **kein Sicherheitsbeweis**.

Traditional und V2 behalten den historischen Dreier-Schritt (linke Kerbe
tot, Thin fest).

### Thin-Ring

In V3 gilt `thin.ring`. In Traditional/V2 bleibt `thin.ring = 0`.

### Endwalze

26!-Permutation, Fisher–Yates mit `cryptoRandomInt`.
Involutionen werden beim Würfeln verworfen (bis zu 64 Versuche).
Scheitern alle Versuche, gilt ein fester 3-Zyklus auf der Identität
(`ABC` → `BCA`): `BCADEFGHIJKLMNOPQRSTUVWXYZ`. Das ist unabhängig vom
RNG niemals involutorisch.
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
werden nicht stillschweigend als V3 gelesen.

## Modern V3 Standard Profile

Nominelle Keyspace-Zahlen gelten nur für dieses Profil, nicht für beliebige
Hand-Einstellungen:

- vier Walzen nach V3-Auswahlregeln (Thin + drei verschiedene Hauptwalzen)
- vier Ringbuchstaben, vier Ground-Buchstaben
- genau zehn disjunkte Steckerpaare
- freie 26-Buchstaben-Endwalze, nicht involutorisch
- drei Lückenfüller mit Anzahlen aus `{5,7,9}`
- CSPRNG für Tafel und Spruchschlüssel
- acht Buchstaben Message-ID, 20 Buchstaben Prüfgruppe

Manuelle Abweichungen sind Research/Expert/Manual. Dafür gelten die
Support-Zahlen nicht automatisch.

Keyspace-Angaben immer trennen:

1. Support size (Kombinatorik)
2. Generator-Shannon-Entropie
3. Min-Entropie
4. Equivalent-key-adjusted space
5. Best demonstrated attack

Nie: „248 Bit Keyspace = 248 Bit Security“. Formaler Beweis: keiner.

## Spruchschlüssel

Weiter 4 Buchstaben: vier Walzenlagen, inkl. mitlaufender Thin.
Zusätzliche Entropie sitzt in der Message-ID, nicht in einer achten
Walzenposition.
