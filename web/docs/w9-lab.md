# W9 Labor — Web-QR-Kanal

Isolierte Seite, **nicht** im normalen Alberich-Pfad:

`js/tests/w9-lab.html`

## Sicherer Kontext

`getUserMedia` / `BarcodeDetector` brauchen einen Secure Context.

Lokal:

```
cd alberich-web
./start.sh
```

Dann: `http://localhost:8765/js/tests/w9-lab.html`

`localhost` und `127.0.0.1` gelten als sicher. Keine HTTP-IP im LAN ohne HTTPS.
Keine Produktumgehung (kein unsicheres getUserMedia-Polyfill).

## Bedienung

1. Sender: Profil/Modus/Fragment/fps/Größe wählen, **Start**. Payload wird eingefroren.
2. Pause / Weiter / Abbruch. Tab verbergen pausiert und deckt den QR zu.
3. Scanner: **Kamera start** (Rückkamera ideal, Fallback jede Kamera) oder **Canvas→jsQR** auf derselben Seite.
4. Erfolg erst nach Transport + CBQR2 + Fingerprint (`TRANSFER_VALID`).

Keine Logs von UR-Frames, Envelope oder Keys. Kein LocalStorage.

## Defaults zum Testen

Baseline: GZIP, DYNAMIC, Fragment **250**, **4 fps**, ECC **M**, mittel 320 CSS-px.
STATIC nur für DAY_24H-Vergleiche (v38–v40).
