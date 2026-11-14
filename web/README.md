# Alberich Web

**Lokal: 1.0 (Revision 68)** · 14. November 2026 · nicht hochgeladen.

Lokale Rotor-Verschlüsselung ohne Konto: historische M4-Simulation und eigenes experimentelles Modern V3. Statische Vanilla-ESM-App, kein Bundler und keine installierbaren Runtime-Dependencies.

## Start und Prüfung

```bash
./start.sh
bash js/tests/run-all.sh
```

Start auf http://localhost:8765. Browserprüfungen: [Testprozedur](tools/testing/README.md).

## Dokumentation

- [Roadmap](docs/PRODUCTION_ROADMAP_2026-09-26.md)
- [Produktionsreview](docs/PRODUCTION_REVIEW_2026-09-26.md)
- [Familien-Kurzanleitung](docs/FAMILY_CODEBOOK_QUICKSTART.md)
- [Changelog](CHANGELOG.md) und [Drittanbieterhinweise](THIRD_PARTY.md)
- [Modern-V3-Spezifikation](docs/crypto-spec-modern-v3.md)

Dieser Ordner ist der lokale Editor. Lokale Revisionen bedeuten keinen Host-Upload. Versionsquelle sind App-Anzeige/HTML und das zentrale `../00_ops/VERSIONS`; die lokale Datei `VERSIONS` ist ein daraus generierter Spiegel und wird nicht von Hand editiert.

## Veröffentlichung vorbereiten

Die statischen Produktdateien `index.html`, `styles.css`, `js/` (ohne `js/tests/`), Bilder/Icons sowie LICENSE/THIRD_PARTY und vorhandene zugehörige Assets gemeinsam übernehmen. Geänderte Dateien stehen im Review-Manifest. HTML muss beim erneuten Öffnen revalidiert werden; für die geänderten Einstiegsskripte und Sprachmodule werden neue Cache-URLs verwendet. Vor einem echten Upload die konkreten Server-Cache-Header prüfen. Diese Runde lädt nichts hoch.

Tafeln sind gemeinsame Geheimnisse. Öffentliche Fixtures unter `js/tests/fixtures/` dienen ausschließlich der Regression und dürfen nie privat verwendet werden. Funktionstests sind kein unabhängiger Sicherheitsnachweis.
