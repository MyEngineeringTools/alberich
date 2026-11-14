# Familien-Codebook-Review — 26. September 2026, erste Runde

Historischer NKB-Nachweis. Die spätere normale Produktionsrunde steht im
[Produktionsreview](PRODUCTION_REVIEW_2026-09-26.md).

Lokaler Webstand Revision 66 mit unveröffentlichten Korrekturen; kein Host-Upload.
Getestet gegen Pixel 6a/API 36 mit der separaten Alberich-NKB-Debug-App.

## Ergebnis

Tages-Codebook und gehärtete 24h/4h/1h-Tafeln tauschen die geprüften UTF-8-Nachrichten
in beide Richtungen korrekt aus. Auf Android erzeugte Tages- und 24h-Tafeln werden
hier importiert und verwendet. Die vollständige `bash js/tests/run-all.sh`-Suite
inklusive Python-Referenzen besteht. Elf Browser-Fallgruppen bestehen in frischen
Chromium-Kontexten: Reload/Integrität, leere Netze, Importgrenzen, Copy/Edit-Rennen,
UTC+1, fehlende IndexedDB, Unicode/Langtext, schmale Ansicht und geladene Seite offline.

## Korrekturen

- Explizite Codebook-Quelle ohne Tafel verschlüsselt nicht mit alten Restwerten.
- Ausgabe markiert ihre Sitzung vor asynchronem Watermark-Commit; bei geändertem
  Text erneut ausgeben lassen. Kopieren/Share verwenden den zugesagten Stand.
- Entschlüsselter Klartext wird nicht als Kurier-Geheimtext-QR angeboten.
- Native `hidden`-Semantik bleibt trotz komponentenspezifischem `display` erhalten.
- Gehärtete Tafeln zeigen im Status ihren gruppierten Fingerabdruck.
- Import/Heute wählen auch Tages-Codebooks nach UTC+1 ganzjährig. Manuelle Auswahl
  bleibt. Alte/neue Clients müssen bis zur gemeinsamen Aktualisierung denselben
  Tafeltag wählen; insbesondere an Sommerzeit-/Zeitzonengrenzen.
- 1h wird als „Kurzes Intervall“ beschrieben, nicht als Sicherheitsgarantie.

Kein Cipher-/Codec-/Keygen-Eingriff, keine Dependency, keine Änderung von
`navigator.storage.persist()`. Keine Prüfung des veröffentlichten Hosts durch diese Runde.

## Reproduktion und Grenzen

Die Pixel- und Browserprotokolle liegen nicht in diesem Repository.
Familien-Kurzanleitung in diesem Baum: [FAMILY_CODEBOOK_QUICKSTART.md](FAMILY_CODEBOOK_QUICKSTART.md).
Die Browserprozedur verwendet vorhandenes Playwright/Chromium, keine neue Projektabhängigkeit.

Ein persistentes Testprofil lieferte ältere Skripte; finale Nachweise nutzen frische
Kontexte. Normale Veröffentlichung braucht Asset-Cache-Abnahme/Versionierung.
Physische Kamera/Live-QR und tatsächliche Familien-Erstnutzer wurden nicht ersetzt.
Das eigene experimentelle Rotorverfahren besitzt durch Funktionstests keinen
unabhängigen Sicherheitsnachweis. Gruppentafeln authentifizieren keine Einzelperson.
