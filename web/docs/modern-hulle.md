# Modern — Spruchhülle und Zahl

Stand: 16. August 2026. Ergänzt [`crypto-spec-modern-v3.md`](crypto-spec-modern-v3.md)
ohne sie zu ersetzen. Kein Sicherheitsbeweis.

Modern ist ein Verfahren. Der Spruch hat eine sichtbare Hülle um die
Walzen. In der App stehen Stempel, Spruchschlüssel, Kopfgruppe,
Message-ID und Prüfgruppe in derselben Leiste.

## Telegramm

```
ALBV | Kopf | Message-ID | Körper | Prüfgruppe
  4      4        8          …          20
```

Mindestlänge 36 Buchstaben. Vierergruppen sind nur Anzeige.

| Stück | Sichtbar als | Rolle |
|---|---|---|
| `ALBV` | Klartext, immer gleich | Typenschild: Modern-Spruch |
| Kopf | Walzen-Geheimtext | Spruchschlüssel unter der Grundstellung |
| Message-ID | 8 zufällige A–Z, Klartext | Etikett für Siegel und Replay; keine Walzenlage |
| Körper | Walzen-Geheimtext | 26er-Ziffern der Nachricht unter dem Spruchschlüssel |
| Prüfgruppe | 20 Buchstaben | HMAC-Siegel. Weder ver- noch entschlüsselt |

Empfang: Stempel erkennen → Kopf mit Grundstellung → Spruchschlüssel →
Prüfgruppe nachrechnen → Körper mit Spruchschlüssel → Zahl → Text.

`ALBV` ist Absicht, analog zu `BEGIN PGP MESSAGE`. Es verrät das
Protokoll, nicht den Schlüssel. Der Kurier-QR trägt ohnehin
`ALBERICH-CTQR1`.

## Die Nachricht als eine Zahl

Bytes (UTF-8) werden zu **einer** Ganzzahl: jedes weitere Byte ist

\[
n \leftarrow n \times 256 + \text{Byte}
\]

256, weil ein Byte 8 Bit hat — kein Längenfaktor für den Funkspruch.
Die Zahl wird in Basis 26 geschrieben (A=0 … Z=25). Länge ≈ 1,70
Buchstaben pro Klartext-Byte plus 36 Buchstaben Hülle.

256 ist keine Potenz von 26. Deshalb werden beim Anhängen **alle**
Ziffern neu gemischt. `A` → `CN`, `AB` → `AYSO`, nicht `CN` plus zwei
neue. Die Walzen bekommen jedes Mal eine neue Kette. Sie selbst haben
keinen Avalanche; der Totaleindruck kommt vom Encoding.

Zurück: Anzahl der 26er-Stellen legt die Bytelänge fest, die Zahl wird
wieder zu Bytes, UTF-8 zu Text.

Teil-Cribs („dieses Wort steht irgendwo“) treffen keine feste Stelle im
Körper. Den **ganzen** Klartext kennt der Angreifer die Zahl und damit
die Walzeneingabe — Encoding ist öffentlich.

## HKDF, HMAC, Replay

**HMAC** (SHA-256, mit Schlüssel): Siegel über Netz, Tag, Message-ID,
Kopf und Körper. Ohne Tafel ≈ \(2^{94}\) zum Raten. Mit Tafel kann jeder
siegeln. Stoppt stille Mutation (im alten Modern kamen viele
Ein-Buchstaben-Fälschungen als anderer Klartext durch).

**HKDF**: aus dem Tagesschlüssel einen Schlüssel **nur fürs Siegel**
(`salt` `ALBERICH-ALB3-AUTH`, `info` `pruefgruppe-v1`). Die Walzen sehen
ihn nicht.

**Replay**: Sitzungscache `Tag|Message-ID`, max. 512. Dieselbe ID in
derselben Sitzung → kein Klartext. Kein Cloud-Buch. Eigenes letztes
Telegramm und dasselbe Feld nochmal zählen nicht als Replay.

Walze verbirgt den Text ohne Tafel. HMAC verhindert unbemerktes Ändern.
HKDF trennt die Schlüssel. Replay ist nur Sitzung.

## Griechenwalze

Sitzt immer im Stromweg. Traditionell: dreht nicht, Ringstellung gilt
(historische M4). Modern: läuft mit, wenn die linke Walze an einer Kerbe
steht; selbst keine Kerben. Die Ringstellung gilt in beiden Modi.
