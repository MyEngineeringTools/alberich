# Alberich Companion (Browser)

Schlanke Companion-Extension für [alberich.pro](https://alberich.pro) – **nur Modern-Modus**.

- Lokal · JSON-Tafel · Demo-Tafel (Info) · Seitenleiste · Kontextmenü · DE|EN  
- Version **1.0.23** (Chrome / Edge / Firefox) — folgt 1.0.22; Modern (ALBV, formatVersion 3)

## Struktur

```text
alberich-browser/
├── shared/                 # Crypto, Codebook, i18n, samples/demo-codebook.json
├── Chrome/                 # Side Panel (Chromium)
├── Edge/                   # wie Chrome
├── Firefox/                # Sidebar + eigenes Background
├── store/                  # Reviewer-Notes, Anleitungen
├── sync-from-chrome.sh
└── README.md
```

## Laden

| Browser | Adresse | Pfad |
|---|---|---|
| Chrome | `chrome://extensions` entpackt | `…/Chrome` |
| Edge | `edge://extensions` entpackt | `…/Edge` |
| Firefox | `about:debugging` temporär | `…/Firefox/manifest.json` |

## Demo-Tafel (Reviewer / Test)

**Info** → Warnung → **Demo-Tafel laden**  
Dateien: `shared/samples/demo-codebook-v3.json` (Standard-Demo, ALBV) und `demo-codebook.json` (Legacy V1). Öffentlich, nicht produktiv. Tafelwort V3: CPTZ YYH.

## Sync nach UI-Änderungen

```bash
./sync-from-chrome.sh
```

Firefox-Manifest und Firefox-Background bleiben erhalten.

## Selftest

```bash
node shared/tests/selftest.mjs
node shared/tests/courier-qr-selftest.mjs
```

## Privacy

Nur lokal. Keine Server, keine Analyse.
