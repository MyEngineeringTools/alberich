# Modern V3 — Spezifikation

Stand: 4. September 2026. Normativ sind diese Datei plus die Selbsttests
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

Decrypt: **MAC zuerst**. Vergleich über `timingSafeEqualLetters` (best-effort
in JavaScript, kein Timing-Sicherheitsbeweis). Bei Fehler kein Klartext.
Kein Legacy-Fallback, der die Prüfgruppe überspringt. Semantik unverändert
(W4-Audit); Golden `PRUEF20 = EFRKEQMITQRCOGPDSZAL`.

Replay: optionaler Sitzungs-Cache `(epoch|messageId)`, max. 512, kein Cloud-State.

Netzkontext der ersten V3-Runde: fest `ALB` (nicht die lokale UUID — die
hätten Sender und Empfänger nicht gemeinsam).

## Codebook formatVersion 3

Neue Tafeln im Modern-Default. Alte Versionen 1/2 bleiben gültig und
werden nicht als V3 gelesen. Android lehnt Version 3 ab, bis es portiert
ist.

## Zufall und Full-Key-Fingerprint (W2)

Produktiver Zufallsanker: `crypto.getRandomValues` über `cryptoRandomInt`.
Kein `Math.random` im Schlüsselpfad. Fehlt Web Crypto, schlägt die
Erzeugung fehl (kein unsicherer Fallback). Test-RNG darf nur als
explizites Argument injiziert werden.

`cryptoRandomInt(n)` nutzt Rejection Sampling auf dem 32-Bit-Bereich
(`limit = floor(2^32 / n) * n`), danach `x % n`. Fisher–Yates, Walzen,
Stecker, Endwalze, Lückenfüller und Spruchschlüssel bauen darauf.

Innerhalb einer neu erzeugten V3-Tafel werden vollständige Schlüssel
über `fullKeyFingerprint = SHA-256(ALB3-FULLKEY-V1 …)` dedupliziert.
Kanonisch sind nur Walzen, Ringe, Grundstellung, Stecker, Endwalze und
Lückenfüller. Datum, Slot, Tafelname und Netz zählen nicht. Nur exakt
identische Full Keys werden verworfen und komplett neu erzeugt — keine
Äquivalenzklassen.

## Lokaler Security-State (W3)

IndexedDB `alberich-security-v1`, Store `message_key_reservations`,
Composite Key `[fullKeyFingerprint, messageKey]`. Reservierung nur per
`add()`. Erst nach `transaction.complete` wird verschlüsselt.

Garantie: auf demselben erhaltenen Browser-Security-State wird derselbe
Spruchschlüssel unter demselben vollständigen V3-Schlüssel nicht erneut
zum Erzeugen neuer Chiffretexte verwendet.

Keine Garantie: Gruppen-Eindeutigkeit, andere Geräte, Überleben nach
vollständigem Löschen der Website-Daten. Die Registry liegt nicht im
Codebook. Entschlüsseln schreibt nicht in die Registry. `navigator.locks`
koordiniert Tabs, ersetzt aber nicht die IndexedDB-Atomizität.

Live-Vorschau einer noch nicht herausgegebenen Nachricht darf denselben
reservierten Spruchschlüssel verwenden. Kontrollierte Ausgabe (Kopieren,
Teilen, Nachrichten-QR, Sitzungsleiste kopieren) markiert die Version als
ausgegeben. Unveränderte erneute Ausgabe behält den MK. Die nächste
kryptographisch relevante Änderung (Klartext, Schlüssel, Tafel, Netz)
beginnt eine neue Session mit neuem MK. Screenshots und Kopieren außerhalb
der App-Aktionen sind nicht abgedeckt.

`SECURITY_DB_VERSION` ist die IndexedDB-Schemaversion (`onupgradeneeded`).
`securityStateVersion` ist ein Feld am Reservierungsdatensatz. Beide sind
heute `1`, bedeuten aber Verschiedenes und dürfen nicht implizit gekoppelt
werden. Ein Upgrade legt fehlende Stores nur an; vorhandene Reservierungen
werden nicht gelöscht. `navigator.storage.persist()` wird nicht automatisch
aufgerufen.

Session-Invalidierung folgt dem aktiven `fullKeyFingerprint`, nicht allein
dem Kalendertag. Ändert sich der Fingerprint (Tagwechsel heute, später
P1-Slotwechsel), endet die Session.

### P1 — Zeitslot-Kern (W5), noch kein neues Codebook

Alberich-Schlüsselzeit ist **UTC+1 ganzjährig**, nicht `Europe/Berlin`.
Berechnung: `unixMs + 1 h`, Kalenderfelder über UTC-Getter. Host-TZ, DST
und Standort zählen nicht. Zeitquelle Produktion: `Date.now()`; Tests
injizieren die Uhr. Kein NTP.

Profile: `DAY_24H` (1 Slot), `HOURS_4` (6), `HOUR_1` (24). Intervalle
halboffen `[start, end)`. Slot-ID intern:

```
year-month-day / profile / slotIndex
```

plus monotone `ordinal` (nur innerhalb desselben Profils vergleichbar).
Die Slot-ID ist **kein** Telegrammfeld.

V3-`epoch` bleibt `YYYY-MM-DD | MANUAL` des Tafeltags. Ein 4-h-Slot
ersetzt `epoch` nicht. Zeitslot wählt nur, welcher bereits unabhängig
erzeugte vollständige V3-Schlüssel aktiv ist. Keine Ableitung aus Zeit,
Seed oder Fingerprint. Kein Nachrichtenzähler.

Encrypt später: Oberfläche darf den Slot neu berechnen; der Kryptolauf
nimmt genau einen Snapshot (`pinSlotForOperation`). Session-Wechsel
weiter über `fullKeyFingerprint`, nicht über eine Extra-4-h-Session.

`highest_send_slot_used` wird in W5 **nicht** gespeichert. Spätere
Rollback-Sicherung gegen Rückwärtsbewegung der Gerätezeit soll nicht an
einen lokalen Tafel-Namen hängen, sondern an:

```
codebook fingerprint / immutable codebook identity
+
time-profile (24 h | 4 h | 1 h)
```

Die genaue Store-Struktur bleibt dem P1-Gate vorbehalten. Eine künftige
Schema-Erhöhung darf den Store `message_key_reservations` nur erweitern,
nicht ersetzen.

PRUEF20 (≈ 94,1 Bit) verwirft einen falschen vollständigen V3-Schlüssel
mit überwältigender Wahrscheinlichkeit und reicht damit, unter wenigen
oder auch hunderten Zeitschlüssel-Kandidaten den passenden zu erkennen.
Keine Suche in W5.

Kandidatensuche (W6): nicht den ganzen BODY mit jedem Schlüssel rotieren.
Zuerst PRUEF20/MAC je Kandidat, Rotor-BODY erst nach genau einem PASS.

## Internes Timebook (W6)

`ALB3_TIMEBOOK_V1` ist eine interne Struktur, kein öffentliches JSON/CBQR.
Bestehende V3-Monatstafeln bleiben CBQR1; ein Adapter liest sie als
`DAY_24H` / Slot 0, ohne das Original zu mutieren. 4-h-/1-h-Timebooks
erzeugen jeden Slot mit einem eigenen CSPRNG-V3-Keygen; Deduplizierung
über die ganze Tafel. Keine KDF/Seeds. P0.4 bleibt BLOCKED.

`codebookFingerprint = SHA-256(ALB3-TIMEBOOK-ID-V1 … ordered slot fps)`.
Nicht enthalten: Anzeigename, Netz-UI, generatedAt. `networkContext` ist
MAC-Parameter (typisch `ALB`), keine Codebook-Identität.

IndexedDB-Schema 2: Store `send_slot_watermarks` zusätzlich zu
`message_key_reservations`. Watermark nur bei kontrollierter Ausgabe,
Prüfung bereits beim Session-Start. `epoch` bleibt `YYYY-MM-DD`.

## CBQR2 (W7)

Kanonische Binärserialisierung von `ALB3_TIMEBOOK_V1`. Magic `ALB3CB2`,
Big-Endian, `FULL_KEY_BIN_V1` = 70 Bytes/Schlüssel. Norm:
[`cbqr2-binary-v1.md`](cbqr2-binary-v1.md). Kein CBQR1-Ersatz, kein
Telegramm, keine Schlüsselableitung. CBQR1 bleibt parallel.

## CBQR2 Transport / MUR (W8)

Transport-Envelope `ALB3Q2` v1, Codec `0=RAW` / `1=GZIP`, darüber
`ur:bytes` Multipart-UR nach BCR-2024-001. Norm:
[`cbqr2-transport-v1.md`](cbqr2-transport-v1.md),
[`cbqr2-mur-v1.md`](cbqr2-mur-v1.md).
`@ngraveio/bc-ur` ist **REJECT**
([`w8-bc-ur-audit.md`](w8-bc-ur-audit.md)).
W8 selbst verdrahtete keine Share-GUI.

## CBQR2 Web-QR-Labor (W9)

Isolierte Laborseite `js/tests/w9-lab.html` bleibt unverkettet. Spez-Stand
eingefroren: [`cbqr2-mur-provenance.md`](cbqr2-mur-provenance.md).
`PHYSICAL_CAMERA_MATRIX` ist OPEN.

## Produktive Web-Integration (W10)

Status: **WEB V3 HARDENED RELEASE CANDIDATE** — nicht Production Released.

Gehärtete Tafeln (`ALB3_TIMEBOOK_V1`) liegen im normalen Web-Pfad:

- Erzeugung: unabhängige volle V3-Schlüssel je Slot, Full-Key-Dedup,
  Validierung, `codebookFingerprint`, erst dann Aktivierung. Fail closed.
- Profile in der GUI: 4 h (Default, empfohlen), 24 h, 1 h. Keine
  Krypto-Bit-Behauptungen, kein Nachrichtenzähler.
- Alberich-Schlüsselzeit: MEZ / UTC+1 ganzjährig.
- Senden: Slot resolven → Rollback-Check → MK-Reservation → Session-Pin
  → Encrypt. Ein begonnener Chiffretext bleibt auf dem gepinnten Slot.
- Ausgabe erst nach Watermark-Commit. Rollback blockiert nur neue
  Sendesessions; Entschlüsseln bleibt möglich.
- Empfang: MAC-first über das Timebook, ein Rotor-Decrypt nach genau
  einem PRUEF20-Treffer. `epoch` bleibt der Tafeltag.
- CBQR1 bleibt statisches Sharing. CBQR2 immer dynamisches MUR
  (`CBQR2_MUR_PROFILE_V1`: Fragment 250, 4 fps, ECC M, UR alphanumeric).
  Keine sichtbare Transportwahl.
- Scanner erkennt CBQR1 und CBQR2 ohne Vorauswahl. Import erst nach
  `TRANSFER_VALID` plus Bestätigung.
- P0.4 Weak-cycle rejection: **BLOCKED / Laboratory**
  (`pending validated production classifier`).
- `navigator.storage.persist()` wird nicht automatisch aufgerufen.
- Cipher-Kern unverändert: `cipher-engine.js`, `modern-v3.js`,
  `modern-crypto.js`, `secure-random.js`.

Product Source Hash der W10-JS-Fläche (41 Dateien unter `js/`, ohne
`js/tests/` und `js/vendor/`, SHA-256 über die sortierte Liste der
Datei-Hashes): `e5021cd71561dc8c`. Das ist **kein** neuer
Chiffre-Identifikator. Die V3 Protocol Golden Baseline bleibt
`909cc1f35c98789c`.

Nicht behauptet: Forward Secrecy, Post-Compromise Security, globale
MK-Eindeutigkeit, mathematisch bewiesene Sicherheit.

## Importvalidierung (W4)

Vertrauensgrenze: JSON-Import, CBQR1 nach Expand, Netz-Load. Erst nach
vollständigem PASS wird die Tafel übernommen. Ein Fehler liefert
`IMPORT_REJECTED` und lässt die bisherige Tafel unangetastet.

V3: Rotor-IDs, eindeutige Hauptwalzen, Ringe/Grund A–Z×4, 10 disjunkte
Steckerpaare ohne Selbststeckung, bijektive nicht-involutorische Endwalze,
Lückenfüller {5,7,9} sortiert ohne Duplikate. Keine stille Reparatur,
keine Weak-Key-Klassen (`P0.4` bleibt Laboratory).

Legacy formatVersion 1/2: bisherige gültige Tafeln bleiben gültig. Dort
besteht historisch eine enge Stecker-/Dora-Bereinigung (Nicht-A–Z streichen,
fehlende Dora-Paare durch die Standard-BO-Paare ersetzen). Das ist
Absicht für Altbestände, kein V3-Pfad.

W4 ändert produktive Nicht-Cipher-Dateien (Import, Session, Logs,
Security-State). Product-Hash der W4-JS-Fläche `a411cb426758dd7d`. Das ist
**kein** neuer Chiffre-Identifikator. Die V3 Protocol Golden Baseline
bleibt `909cc1f35c98789c`.

## Spruchschlüssel

Weiter 4 Buchstaben: vier Walzenlagen, inkl. mitlaufender Thin.
Zusätzliche Entropie sitzt in der Message-ID, nicht in einer achten
Walzenposition.
