# Changelog – Alberich Web

Format: Version **X.Y (Revision N)**

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
- Endwalze: nach 64 involutorischen CSPRNG-Ziehungen hartes Fail-Closed, kein fester Ersatz
- Workspace ohne Analytics/Telemetry; Extensions über `dist/` bzw. Release-ZIP laden

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
