# Alberich Companion – Firefox

## Neu laden (nach jedem Fix)

1. `about:debugging#/runtime/this-firefox`
2. Altes **Alberich Companion** → **Entfernen** (falls geladen)
3. **Temporäres Add-on laden…** →  
   `…/alberich-browser/Firefox/manifest.json`
4. Unter dem Eintrag: **Untersuchen** → Konsole auf Fehler prüfen

## Seitenleiste öffnen

| Weg | Aktion |
|---|---|
| **A** | Toolbar-Icon **Alberich** klicken |
| **B** | Menü **Ansicht → Sidebar → Alberich Companion** |
| **C** | Falls A scheitert: es öffnet sich ein **Tab** mit dem Panel (Fallback) |

Die Firefox-Sidebar sitzt oft **links** (nicht rechts wie Chrome).

## Bekannte Ursachen für „Klick tut nichts“

1. **Background-Skript abgestürzt** (früher: `shared` nur als Symlink nach außen – behoben)  
2. Icon nicht in der Leiste: Rechtsklick auf Leiste → **Anpassen** → Icon platzieren  
3. Temporäres Add-on nach Firefox-Neustart weg → erneut laden  

## Demo-Tafel (Store / Test)

In der Sidebar: **Info** → Warnung lesen → **V3-Demo-Tafel laden**.  
Datei: `shared/samples/demo-codebook-v3.json` (öffentlich, Tafelwort CPTZ YYH). Legacy: `demo-codebook.json`.

## Sync von Chrome-UI

```bash
cd …/alberich-browser
./sync-from-chrome.sh
# Demo-Strings/JSON manuell prüfen — Demo-Button ist Firefox-spezifisch in panel.html
```
