# Alberich Companion – Microsoft Edge

Edge basiert auf Chromium — technisch **wie die Chrome-Version** (Side Panel, Offscreen-Clipboard, `contextMenus`).

## Laden (Entwicklermodus)

1. Edge öffnen → `edge://extensions`
2. **Entwicklermodus** aktivieren (unten links)
3. **Entpackte Erweiterung laden**
4. Ordner wählen:  
   `/home/christian/Dokumente/Alberich/alberich-browser/Edge`
5. Extension ggf. **neu laden** nach Updates
6. Icon in der Symbolleiste klicken → **Side Panel** (meist rechts)

## Nutzung

Identisch zu Chrome:

1. Monatstafel-JSON laden (Codebook)
2. Tag wählen
3. Ver-/Entschlüsseln im Panel oder per Rechtsklick → Zwischenablage
4. DE | EN, Info, Impressum

## Sync von Chrome

```bash
cd …/alberich-browser
./sync-from-chrome.sh
```

Kopiert Panel + Background + Offscreen von `Chrome/` nach `Edge/` (und Panel/Shared nach Firefox).

## Hinweis

`Edge/shared` ist ein Symlink auf `../shared` (wie bei Chrome). Beim Laden entpackter Erweiterungen unter Linux ist das i. d. R. in Ordnung.
