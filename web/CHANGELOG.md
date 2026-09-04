# Changelog – Alberich Web

Format: Version **X.Y (Revision N)**

## 1.0 (Revision 65)

- Kurz erklärt: 24 Stunden · Einfach vs. V3 · Tagesschlüssel (gleicher Takt, Live-QR/MEZ vs. JSON/Standbild)
- Netze: gehärtete Tafel zeigt Monat + Fingerprint (nicht Legacy-Tafelwort); Scan setzt fehlendes Monatslabel
- Live-QR: während MUR-Empfang voller Frame und kürzerer Takt (1-Stunden-Tafeln)
- Speichern: Quota-/Schreibfehler sichtbar statt still
- Gehärtete Tafeln: Binärdatei (.alb3cb2) importieren und speichern, analog JSON beim Tagesschlüssel
- Cache-Bust `styles.css?v=65` / `js/app.js?v=65` / i18n `?v=17`

Folgt **1.0 (Revision 64)**.

## 1.0 (Revision 64)

- V3 gehärtet: Aktuelle Walzenstellung folgt dem Zeitslot (Walzen, Endwalze, Lagecode, Kerben, Stecker)
- Begonnene Nachricht bleibt auf dem gepinnten Slot; neue Nachrichten nutzen den Uhr-Schlüssel
- Endwalze zeigt die 26-Buchstaben-Verdrahtung statt PERM
- Cache-Bust `styles.css?v=64` / `js/app.js?v=64`

Folgt **1.0 (Revision 63)**.

## 1.0 (Revision 63)

- Walzenstellung: Hinweis auf aktive Lückenfüller-Kerben L/M/R, wenn V3-Kerben gesetzt sind
- Cache-Bust `styles.css?v=63` / `js/app.js?v=63`

Folgt **1.0 (Revision 62)**.

## 1.0 (Revision 62)

- Hauptseite: Badge „V3 gehärtet“ mit laufender Restzeit bis zum Schlüsselwechsel
- Cache-Bust `styles.css?v=62` / `js/app.js?v=62`

Folgt **1.0 (Revision 61)**.

## 1.0 (Revision 61)

- V3 gehärtet: „Kurz erklärt“ zu Zeitslots, Alberich-Schlüsselzeit und 24 h / 4 h / 1 h
- Cache-Bust `styles.css?v=61` / `js/app.js?v=61`

Folgt **1.0 (Revision 60)**.

## 1.0 (Revision 60)

- Gehärtete Tafel: JSON importieren, QR-Bild laden und JSON speichern sichtbar, aber deaktiviert
- Transfer weiter nur über Kamera bzw. animierten QR
- Cache-Bust `styles.css?v=60` / `js/app.js?v=60`

Folgt **1.0 (Revision 59)**.

## 1.0 (Revision 59)

- Terminologie: „feste dünne Walze“ → „Griechenwalze“ (sichtbare Texte, Modern V3)
- Keine Änderung an Kryptographie, Feldnamen oder Formaten

Folgt **1.0 (Revision 58)**.

## 1.0 (Revision 58)

- Schlüsselgültigkeit: drei Optionskarten (24 h / 4 h Default / 1 h), ganze Karte klickbar
- Layout-only; Profil-IDs und Default unverändert
- Cache-Bust `styles.css?v=58` / `js/app.js?v=58`

Folgt **1.0 (Revision 57)**.

## 1.0 (Revision 57)

- V3 gehärtet: eigener Schlüsseltafel-Renderer (Tag → Zeitslot → vollständiger V3-Schlüssel)
- Keine UKW-/Dora-Spalten in der gehärteten Ansicht; Endwalze und Lückenfüller aus dem gespeicherten Slot-Key
- Legacy-CBQR1-Tafelansicht unverändert
- Cache-Bust `styles.css?v=57` / `js/app.js?v=57`

Folgt **1.0 (Revision 56)**.

## 1.0 (Revision 56)

- WEB V3 HARDENED RELEASE CANDIDATE (nicht Production Released)
- V3 gehärtet: Timebooks mit 24 h / 4 h (Default) / 1 h, Alberich-Schlüsselzeit MEZ/UTC+1
- Live-Pfad: Slot-Pin, MK-Reservation, Watermark vor Ausgabe, Rollback blockiert nur Senden
- Empfang: MAC-first über die Tafel, kein Slot wählen
- CBQR2 immer dynamisches MUR; CBQR1 bleibt statisch; Scanner erkennt beides
- P0.4 Weak-cycle rejection bleibt BLOCKED / Laboratory
- Cache-Bust `styles.css?v=56` / `js/app.js?v=56`
- Modern-V3-Cipher-Kern unverändert

Folgt **1.0 (Revision 52)**. Zwischenstände 53–55 waren interne Cache-Busts der W10-Verdrahtung.

## 1.0 (Revision 52)

- QR-Live-Scan für ältere Mobilgeräte/iPads optimiert
- Kamera versucht zuerst ein ausreichend hochauflösendes 4:3-Sensorbild, danach weiche High-Res- und kompatible Fallback-Profile
- Unterstützte Continuous-Focus-/Belichtungs-/Weißabgleich-Modi werden capability-basiert und fehlertolerant aktiviert
- Kamerazoom wird, falls steuerbar, auf den kleinsten Wert gesetzt, um den größtmöglichen Bildausschnitt zu erhalten
- jsQR priorisiert den sichtbaren Scanbereich und rotiert CPU-schonend zwischen enger ROI, sichtbarem Quadrat und Full-Frame-Fallback
- Wiederverwendeter Decode-Canvas und gecachter nativer BarcodeDetector reduzieren Allokationen und Initialisierungsaufwand
- Bildimport dekodiert bis 1800 px Kantenlänge; Live-Scan bis 1536 px ohne künstliches Upscaling
- Scanintervall von 280 ms auf 180 ms reduziert, ohne parallele Decoderläufe
- Gelber Scanrahmen an die primäre ROI angepasst
- Schlüsseltafel- und Kurier-QR verwenden weiterhin dieselbe Scan-Pipeline
- Cache-Bust `styles.css?v=52` / `js/app.js?v=52`
- Modern V3 unverändert

Folgt **1.0 (Revision 51)**.

## 1.0 (Revision 51)

- QR-Scan der Rückkamera nicht mehr gespiegelt (Tafel-QR und Kurier-QR)
- Vorschau entspricht dem Sensorbild; gelber Rahmen quadratisch
- Cache-Bust `styles.css?v=51` / `js/app.js?v=51` (CSS 7 Tage Cache)
- Modern V3 unverändert

Folgt **1.0 (Revision 50)**.

## 1.0 (Revision 50)

- Traditionell: Ringstellung der Griechenwalze gilt wie auf der historischen M4
- Ältere Traditional-Sprüche mit erstem Ringbuchstaben ≠ A entschlüsseln anders
- Handbuch unter `/manual/`; Footer, Kurzanleitung und Info verlinken dorthin
- Modern V3 unverändert

Folgt **1.0 (Revision 49)**.

## 1.0 (Revision 49)

- Live-V3 wieder mit Double-Step wie Revision 47 (Kaskade nur Research)
- Sprüche von 47/48 mit Double-Step wieder entschlüsselbar

Folgt **1.0 (Revision 48)**.

## 1.0 (Revision 48)

- Companion und Thunderbird nutzen dasselbe Tafeltags-`epoch` wie Web/Android
- Kurier-Überlänge: Hinweis, dass die Meldung ohne Kurier ignorierbar ist

Folgt **1.0 (Revision 47)**.

## 1.0 (Revision 47)

- V3-Authentisierung bindet die Grundstellung (`ground:` in `canonicalDayKey`)
- Endwalzen-Fallback ist ein fester 3-Zyklus, niemals involutorisch
- Setup: Datums-Dropdowns lesbar; Modern-Sitzungsleiste hat einen Kopier-Knopf
- Bestehende ALBV-Sprüche der Revision 46 scheitern am MAC; Telegrammform unverändert

Folgt **1.0 (Revision 46)**.

## 1.0 (Revision 46)

- Modern ist ein Verfahren (ehemals V3): freie Endwalze, Kerben auf der Tafel, Telegramm ALBV
- Kein V2-Ver-/Entschlüsseln mehr im Live-Pfad; Nur-Dora entfällt als Modern-Politik
- Kurier-Längenhinweis: ohne Kurier ignorierbar; Schlüssel-Export zeigt Kerben
- Hilfe/Store-Texte an den aktuellen Stand angeglichen

Folgt **1.0 (Revision 45)**.

## 1.0 (Revision 44)

- Modern V3: vierstufige Kaskade, freie Endwalzen-Permutation, unabhängige Lückenfüller auf der Tafel
- Base-26 V2 (ganze Nachricht als Integer, kein A–J an jeder zweiten Stelle)
- Prüfgruppe (HKDF-SHA-256 + HMAC-SHA-256), Message-ID, optionaler Replay-Cache
- Telegramm `ALBV` + Kopf + Message-ID + Körper + 20-Buchstaben-Prüfgruppe
- Codebook formatVersion 3; Legacy V1/V2 bleiben lesbar und werden nicht still als V3 gelesen
- Traditional unverändert; Modern V2 weiter entschlüsselbar

Folgt der online liegenden **1.0 (Revision 43)**.
