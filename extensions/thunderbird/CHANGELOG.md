# Changelog – Alberich Mail Companion

## 1.0.16

- Add-on-Name vollständig auf **Alberich Mail Companion** vereinheitlicht.
- Alte Thunderbird-Nennung aus der Produktbezeichnung, UI-Tagline, Store- und Reviewer-Texten entfernt.
- Build-/Paketname auf `alberich-mail-companion-1.0.16.xpi` umgestellt.

## 1.0.15

- Add-on-Name: Alberich Mail Companion (Mozilla-Markenformat)
- XPI ohne ungenutzte Dateien (`shared/tests/`, `messages-de.js`, Legacy-`demo-codebook.json`)
- Permission `clipboardRead` entfernt; Einfügen bleibt ein Textfeld. `clipboardWrite` bleibt (Kopieren im Klartext-Tab)
- Statuszeile: Tafelwort und Monatsabweichung (fehlende i18n-Keys)

Folgt der auf ATN abgelehnten **1.0.14**.

## 1.0.14

- Tafeltags-`epoch` wie Web/Android — ALBV-Sprüche von der Website wieder entschlüsselbar

Folgt der veröffentlichten **1.0.13**.

## 1.0.13

- V3-Authentisierung bindet die Grundstellung (`ground:`); Endwalzen-Fallback ist ein 3-Zyklus
- Golden Vector wie Web Revision 47; ALBV-Sprüche von 1.0.12 scheitern am MAC

Folgt der veröffentlichten **1.0.12**.

## 1.0.12

- Modern nur noch mit freier Endwalze und Kerben auf der Tafel (ALBV)
- Kurier-Längenhinweis: ohne Kurier ignorierbar
- Tagesanzeige PERM statt Bruno/Caesar bei Format-3-Tafeln

Folgt der veröffentlichten **1.0.11**.

## 1.0.11

- Modern: Tafel formatVersion 3, Telegramm ALBV + Prüfgruppe
- Nur Modern-Pfad (keine Legacy-Tafel als Tagesschlüssel)

Folgt der veröffentlichten **1.0.10**.
