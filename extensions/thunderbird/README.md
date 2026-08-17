# Alberich Companion (Thunderbird)

Schlanke **MailExtension** für [Thunderbird](https://www.thunderbird.net/) – **nur Modern-Modus**, lokal, ohne Upload.

Begleitet [alberich.pro](https://alberich.pro) und denselben JSON-Codebook-Export wie die Browser-Companions.

| | |
|---|---|
| **Version** | 1.0.14 |
| **Extension-Ordner** | `thunderbird/` |
| **ID** | `alberich-mail@alberich.pro` |
| **Mindest-Thunderbird** | 128 (Manifest V3) |

## Idee

Im **Schreiben-Fenster** Text tippen → Alberich-Button → ver- oder entschlüsseln → Ergebnis zurück in die Mail. Monatstafel (JSON) einmal laden, Tag wählen, fertig.

**Kurier an:** keine Chiffre, nur Buchstaben und QR zwischen Offline-Gerät und Mail. QR-Fenster extra (wie der JSON-Import), damit Kamera und Dateidialog das Popup nicht schließen.

## Installation (temporär / Entwicklung)

1. Thunderbird öffnen  
2. Menü **Extras → Add-ons und Themes** (oder `about:addons`)  
3. Zahnrad ⚙ → **Debug-Add-ons** / *Debug Add-ons*  
   - Alternativ: Adresszeile `about:debugging#/runtime/this-firefox` (Desktop)  
4. **Temporäres Add-on laden…**  
5. Datei wählen:  
   `…/alberich-mail/thunderbird/manifest.json`

Nach einem Thunderbird-Neustart ist ein temporäres Add-on wieder weg – erneut laden.

### Später: Thunderbird Add-ons Store

- XPI bauen (Inhalt von `thunderbird/` zippen, Endung `.xpi`)  
- Unter [addons.thunderbird.net](https://addons.thunderbird.net/) einreichen  
- Reviewer: Demo-Tafel unter **Info → Demo-Tafel laden**

## Bedienung (kurz)

1. **Codebook laden** → öffnet ein **eigenes Import-Fenster** (JSON-Datei oder Einfügen).  
   *Hinweis:* Direkt im kleinen Alberich-Popup funktioniert der Dateidialog unter Thunderbird oft nicht (Popup schließt).  
   Alternativ: Demo unter **Info**.  
2. **Tag** wählen  
3. Neue Nachricht schreiben (Klartext bzw. Geheimtext im Schreiben-Fenster)  
4. **Alberich** in der Compose-Leiste öffnen  
5. **Verschlüsseln** oder **Entschlüsseln** — ein Klick  

| Aktion | Quelle | Ergebnis |
|---|---|---|
| Verschlüsseln | Schreiben-Fenster | Geheimtext zurück ins Schreiben-Fenster |
| Entschlüsseln | Schreiben-Fenster | Klartext zurück |
| Entschlüsseln | **empfangene Mail** (nur lesend) | **neuer Tab** mit Klartext |

Spruchschlüssel und Kopfgruppe werden beim Modern-Modus automatisch erzeugt bzw. ausgewertet.

Status:

- **Tafel … · Tag …** = gültiger Tagesschlüssel geladen  
- Badge **OK** / **!** am Button (Background)

## Berechtigungen

| Permission | Warum |
|---|---|
| `storage` | Monatstafel + gewählter Tag + Sprache (lokal) |
| `compose` | Body im Schreiben-Fenster lesen und schreiben |
| `messagesRead` | Text empfangener Mails zum Entschlüsseln lesen (kein Ändern) |
| `clipboardWrite` / `clipboardRead` | Kopieren / Einfügen |

**Keine** Host-Permissions, kein Netzwerk, keine Telemetrie. Klar- und Geheimtext bleiben auf dem Gerät.

### ATN-Linter: „Invalid permissions compose / messagesRead“

Beim Hochladen auf [addons.thunderbird.net](https://addons.thunderbird.net/) meldet der Linter oft:

- `Invalid permissions "compose"`
- `Invalid permissions "messagesRead"`

(jeweils plus MDN-Link). Das sind **False Positives**: beides sind **gültige Thunderbird-Permissions**. Der Linter prüft primär gegen das **Firefox**-Schema und kennt TB-Rechte unvollständig.

| Permission | Wofür (nicht entfernen) |
|---|---|
| `compose` | Ver-/Entschlüsseln im Schreiben-Fenster |
| `messagesRead` | Text empfangener Mails lesen → Klartext-Tab |

Die Warnungen blockieren die Einreichung in der Regel nicht. Text für Reviewer: `store/ATN_REVIEWER_NOTES_*.txt`.

## Architektur

```text
alberich-mail/
├── README.md
├── sync-shared.sh              # Core aus alberich-browser übernehmen
└── thunderbird/                # ladbare Extension
    ├── manifest.json
    ├── background/             # Badge, storage-Listener (TB-spezifisch)
    ├── popup/                  # UI + compose-io.js (TB-spezifisch)
    ├── shared/                 # wiederverwendbarer Core (Crypto, Codebook, i18n)
    ├── icons/
    └── _locales/
```

### Core (wiederverwendbar)

Identisch im Ansatz zum Browser-Companion (`alberich-browser/shared/`):

- `shared/crypto/` – Modern-Crypto, Engine, Round-Trip-Prüfung  
- `shared/codebook/` – `alberich-codebook` v1  
- `shared/modern-ops.js` – Encrypt/Decrypt  
- `shared/key-manager.js` – Tafel/Tag → Maschinenkonfig  
- `shared/i18n.js` – DE|EN  
- `shared/courier-*.js` – Kurier-QR, Scan, Render, Persistenz  
- `shared/samples/demo-codebook.json` – öffentliche Demo-Tafel  

### Thunderbird-spezifisch

- `manifest.json` – `compose_action`, `action`, `compose`-Permission  
- `background/background.js` – Badge „OK“ / „!“  
- `popup/compose-io.js` – `compose.getComposeDetails` / `setComposeDetails`  
- `popup/popup.*` – UI (an Browser-Companion angelehnt)  
- `import/` – persistentes Fenster für JSON-Datei / Paste (umgeht Popup-Dateidialog-Bug)  
- `courier/` – persistentes Fenster für Kurier-QR (Scan / Bild / anzeigen)  
- `result/` – Klartext-Tab nach Entschlüsselung gelesener Mails  
- `popup/mail-io.js` – angezeigte Nachricht lesen

Core-Update aus dem Browser-Repo:

```bash
./sync-shared.sh
```

Danach Thunderbird-spezifische Anpassungen in `shared/i18n.js` / `key-manager.js` ggf. erneut prüfen (Skript überschreibt `shared/`).

## Selftest (Core)

```bash
node thunderbird/shared/tests/selftest.mjs
node thunderbird/shared/tests/courier-qr-selftest.mjs
```

## Privacy

Nur lokal. Keine Server, keine Analyse. Companion zur Enigma-M4-Simulation Alberich – kein generischer Mail-Verschlüsselungsdienst (kein OpenPGP/S/MIME-Ersatz im klassischen Sinne).
