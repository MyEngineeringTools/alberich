# Roadmap: Alberich Web

Stand: 26. September 2026. Abgeschlossen: Revision 66 → 67. Die Erhöhung erfolgte nach den Implementierungen; finale Artefakte wurden anschließend geprüft.

| Schritt | Inhalt | Abnahme | Status |
|---|---|---|---|
| W1 | Ausgangsstand samt bereits lokal vorhandenen Codebook-Korrekturen sichern | Hashmanifest, veröffentlichter Host separat | erledigt |
| W2 | Leere Netze, Ausgabe/Bearbeitung, Klartext-QR, hidden-CSS, Fingerabdruck und UTC+1 reviewen | Browserregressionen einschließlich Grenzen | erledigt; finale Versionsprüfung bestanden |
| W3 | Eigenständige Testprozedur/öffentliche Testfixtures aufnehmen und Cache-Update prüfen | frische und bestehende Browserkontexte, eigene Reproduktion | erledigt; finale Versionsprüfung bestanden |
| W4 | vollständige JS-/Python-Referenzsuite, Browser und Android-Interoperabilität | reproduzierbare Ergebnisdateien | erledigt; finale Versionsprüfung bestanden |
| W5 | README, Anleitung, Changelog, Lizenzpass und Upload-/Abnahmehinweise konsistent machen | eigenständige Dokumentation | erledigt; finale Versionsprüfung bestanden |
| W6 | Nach Gesamtprüfung Revision 67 und Cache-Referenzen setzen; finales Update prüfen | Versionskonsistenz und Browsernachweis | erledigt; Ergebnis im Produktionsreview |

Keine neuen Bibliotheken, kein Bundler, kein persist(), Cipher und Codecs eingefroren. Keine Companion-Synchronisierung, kein Host-Upload/GitHub-Push.

Offen für spätere Freigabe: echte Kamera/Live-QR und Familien-Pilot; Funktionstests ersetzen kein unabhängiges Krypto-Audit. Der öffentlich ausgelieferte Stand wird durch diese lokale Runde nicht verändert.
