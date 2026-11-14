# Alberich Web – Release Notes (Deutsch)

**Aktuell: 1.0 (Revision 68)** — folgt Revision 67. Lokal, nicht hochgeladen.

| Plattform | Stand |
|---|---|
| **Web** | 1.0 (Revision 68), lokal |
| **Android** | 1.0 (Revision 33), `versionCode` 33, lokal |
| **Companion** | 1.0.25 |
| **Thunderbird** | 1.0.18 |

What’s new kurz: [`whatsnew-de.txt`](whatsnew-de.txt)  
Ausführlich: [`whatsnew-long-de.txt`](whatsnew-long-de.txt)  
X: [`promo-x-de.txt`](promo-x-de.txt)

Revision 68: Die manuelle Ringstellung übernimmt den ersten Buchstaben für die Zusatzwalze. Anzeige, Export, Prüfgruppe und Maschine nutzen denselben Wert. Ältere Nachrichten mit stillem anderem ersten Buchstaben (meist E) brauchen diesen Buchstaben. Schlüsseltafel und Schlüssel-QR waren nicht betroffen.

Revision 67: Netzgebundene Tafeln, sichere Ausgabe/Bearbeitung, begrenzter Import und UTC+1-Tageswahl. Gehärtetes Tafeldatum folgt dem verwendeten Satz; geteilte ALBV-Nachrichten werden automatisch als Geheimtext erkannt.

V3 gehärtet im normalen Web-Pfad: Zeitslots, eigener Vollschlüssel je Slot, Walzenstellung folgt der Uhr (ungepinnt), Endwalze als 26-Buchstaben-Verdrahtung, Transfer per Live-QR oder Binärdatei `.alb3cb2`. Kurz erklärt unterscheidet 24 Stunden · Einfach von V3 · Tagesschlüssel. Netze zeigt gehärtete Tafeln mit Monat und Fingerprint.

Cipher-Kern und Telegrammform ALBV unverändert. Spezifikation: [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md).
