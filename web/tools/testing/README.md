# Browser-/Interoperabilitätsprüfung

Voraussetzung: vorhandenes Playwright und Chromium; keine Projektdependency wird installiert. Eigenen lokalen Server starten (`./start.sh`) und frische Browserkontexte verwenden.

```bash
PLAYWRIGHT_MODULE=/pfad/zu/playwright \
BROWSER_EXECUTABLE=/pfad/zu/chromium \
ALBERICH_BASE_URL=http://127.0.0.1:8765 \
timeout 900 node tools/testing/family-web-regression.cjs
```

Elf Fallgruppen, darunter fünf Copy/Edit-Rennen, echter Browser-Storage, Reload, falsche/manipulierte Nachrichten, Importgrenzen, UTC+1, Offline und schmale Ansicht. Interne Frist zehn Minuten; Aktionen 15 Sekunden. Fixtures sind eigene öffentliche Wegwerf-Daten, aktuell September 2026. Für spätere Monate Fixtures kontrolliert regenerieren; keine Nutzeruhr ändern.

Zusätzlich `bash js/tests/run-all.sh`: sämtliche vorhandenen JS-Suiten und Python-Referenzen. Android-Austausch benutzt tatsächlich auf dem isolierten Pixel erzeugte Antworten/Tafeln; diese Ergebnisse getrennt von browserinternen Rundläufen dokumentieren. Physische Kamera und OS-Fotowähler sind separate Abnahmen.

## Tatsächliche Android-Exporte

`android-exchange.cjs` erwartet `ANDROID_EXCHANGE_DIR` mit `pixel-replies.json` (Liste aus `plain`/`cipher`), `android-daily.json`, `android-24h.alb3cb2` und je `android-<Typ>_message.json`. Nur öffentliche Testexporte verwenden. Dieselben Browser-Umgebungsvariablen wie oben. Der Test prüft exakte Klartexte und verborgenes Kurier-QR.

## Gefüllter Cache beim Versionswechsel

`cache-upgrade.cjs` erwartet `BEFORE_WEB_ROOT` mit einer isolierten Kopie der vorherigen Revision 66. Startet selbst einen lokalen Server: HTML revalidiert, Assets ein Jahr cachebar. Lädt 66 und eine öffentliche Tafel, wechselt auf den aktuellen Baum 67 und prüft neue App-/CSS-/i18n-Requests, erhaltene Tafel und Entschlüsselung. Kein Test der echten Host-Header.
