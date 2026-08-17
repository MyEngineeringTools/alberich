# Changelog – Alberich Web

Format: Version **X.Y (Revision N)**

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
