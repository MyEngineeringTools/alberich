# Produktionsreview Web — 26. September 2026

Status: lokale Umsetzung und finale Abnahme abgeschlossen. Revision 66 → 67. Kein Host-Upload.

## Umfang

Die bereits lokal vorhandenen Familien-Codebook-Korrekturen wurden eigenständig geprüft: leere Netze sperren Verschlüsselung, Ausgabe und Bearbeitung trennen Nachrichtensitzungen, kein Kurier-QR von Klartext, hidden-CSS bleibt wirksam, gehärtete Tafel zeigt ihren Vergleichswert, Tageswahl verwendet UTC+1. 0j/0l sind im Code vorhanden.

Neue unabhängige Browserprozeduren und öffentliche Fixtures liegen in diesem Baum; keine NKB-Dateien als Voraussetzung. Neue README und Familien-Kurzanleitung erklären Nutzung, Grenzen und lokale Veröffentlichungsvorbereitung.

## Nachweise

- Vollständige `bash js/tests/run-all.sh` einschließlich Python-Referenzen: bestanden.
- Elf Browserfallgruppen: bestanden, inklusive fünf gezielter Copy/Edit-Rennen.
- Sieben Gegentests mit tatsächlichen Antworten/Exporten der isolierten Produktions-Android-App: bestanden (alle vier Tafeltypen, zusätzlicher QR-Pfad, Android-generierte Tages- und 24h-Tafel).
- Keine neuen Runtime-Dependencies, keine Cipher-/Codecänderungen, kein persist().

## Versionswechsel

HTML/CSS/App verwenden Revision 67, die geänderten Sprachmodule neue Cache-URLs 19. Der finale Warmcache-Test mit dem tatsächlichen Webbaum bestand: Tafel erhalten, alte Nachricht entschlüsselt, App/CSS 67 und Sprachmodule 19 neu angefordert. Die konkrete Cache-Konfiguration des öffentlichen Hosts bleibt vor Upload separat zu prüfen.

## Grenzen

Keine echte Kamera-/Live-QR-Übergabe oder Familien-Erstnutzerstudie. Kein unabhängiger Krypto-Sicherheitsnachweis. Gemeinsame Tafeln identifizieren keine Einzelperson und kurze Slots beheben keine kompromittierte Monatstafel. Kein Upload, keine Companion-Synchronisierung und keine behauptete Änderung ausgelieferter Versionen.

## Finale Abnahme Revision 67

Vollständige JS-/Python-Suite, elf Browsergruppen und sieben Gegentests erneut bestanden, letztere mit den Antworten und Exporten der finalen Android-Revision 32. Der Cache-Test wechselte im bestehenden Browserkontext vom gesicherten 66-Stand auf den tatsächlichen 67-Baum; er simuliert lange Asset-Cache-Zeiten und prüft keine öffentlichen Host-Header. 32 Kern-/Referenzdateien unverändert. Ergebnisdateien und Hashmanifest: [Nachweisindex](evidence/production-2026-09-26/README.md).

Zentrale Versionsprüfung bestanden; lokale und ausgelieferte Stände bleiben getrennt. Browser-/Mail-Companion erhielten ausschließlich regenerierte VERSIONS-Spiegel, keine neuen Pakete. Empfehlung: gemeinsamer Familien-Pilot mit Android 32 und physischem QR-/Galerieaustausch, danach eigener Veröffentlichungsentscheid einschließlich Prüfung der tatsächlichen Host-Cache-Header.
