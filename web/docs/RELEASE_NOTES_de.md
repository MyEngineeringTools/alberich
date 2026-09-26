# Alberich Web – Release Notes (Deutsch)

**Aktuell: 1.0 (Revision 67)** — folgt Revision 66.

| Plattform | Stand |
|---|---|
| **Web** | 1.0 (Revision 67) |
| **Android** | 1.0 (Revision 31), `versionCode` 31 |
| **Companion** | 1.0.25 |
| **Thunderbird** | 1.0.18 |

What’s new kurz: [`whatsnew-de.txt`](whatsnew-de.txt)  
Ausführlich: [`whatsnew-long-de.txt`](whatsnew-long-de.txt)  
X: [`promo-x-de.txt`](promo-x-de.txt)

Revision 67: Netzgebundene Tafeln, sichere Ausgabe/Bearbeitung, begrenzter Import und UTC+1-Tageswahl. Gehärtetes Tafeldatum folgt dem verwendeten Satz; geteilte ALBV-Nachrichten werden automatisch als Geheimtext erkannt.

V3 gehärtet im normalen Web-Pfad: Zeitslots, eigener Vollschlüssel je Slot, Walzenstellung folgt der Uhr (ungepinnt), Endwalze als 26-Buchstaben-Verdrahtung, Transfer per Live-QR oder Binärdatei `.alb3cb2`. Kurz erklärt unterscheidet 24 Stunden · Einfach von V3 · Tagesschlüssel. Netze zeigt gehärtete Tafeln mit Monat und Fingerprint.

Cipher-Kern und Telegrammform ALBV unverändert. Spezifikation: [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md).
