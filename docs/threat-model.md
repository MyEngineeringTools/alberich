# Threat Model — Alberich Modern V3

Experimentelles Rotor-Kryptosystem. Kein Sicherheitsbeweis.
Kurier ist eine eigene Schicht und wird nicht mit der Chiffrierstärke
verrechnet.

## Ciphertext-only

**Goal:** Klartext oder Tagesschlüssel aus Telegrammen.
**Protected?** Rotorweg ohne Klartext ist historisch schwer; V3 vergrößert
den nominellen Schlüsselraum und entfernt den A–J-Crib von Base-26 V1.
**Not protected?** Periodensignale der Walzen, Längenleak, Stempel `ALBV`,
statistische Abweichungen. Keine AES-ähnliche Ciphertext-Zufälligkeit.
**Assumptions:** Angreifer sieht nur A–Z-Gruppen.
**Mitigation:** Offene Statistik in `research/`. Nicht als „unbrechbar“
verkaufen.

## Known plaintext

**Goal:** Tagesschlüssel oder Spruchschlüssel aus bekanntem Klartext.
**Protected?** Volle Kombination Rotor+Stecker+Endwalze+Kerben ist groß.
**Not protected?** Ist der Tagesschlüssel bekannt, fällt der
Spruchschlüssel in einem Header-Decrypt (4 Buchstaben). Cribs filtern
Kandidaten. Meet-in-the-Middle gegen Stecker/Endwalze bei bekanntem
Rotorweg.
**Assumptions:** Angreifer kennt Teile des Klartexts.
**Mitigation:** Live measurements in `v3-attacks.mjs` (PARTIAL). V2 crib
scripts stay under `research/results/legacy/v2/`. Grenzen dokumentieren,
nicht kaschieren.

## Chosen plaintext

**Goal:** Maschine als Orakel nutzen.
**Protected?** Nicht das Designziel.
**Not protected?** Beliebige Klartexte bei bekanntem oder steuerbarem
Tagesschlüssel. Schrittfolge hängt nicht vom Klartext ab.
**Assumptions:** Angreifer kann Texte wählen lassen.
**Mitigation:** Kein Avalanche behaupten. Diffusion offen messen.

## Mehrere Nachrichten desselben Tages

**Goal:** Gemeinsamen Tagesschlüssel ausnutzen.
**Protected?** Jede Nachricht hat eigenen SK und eigene Message-ID.
Prüfgruppe bindet Header+Body+MID+Epoche.
**Not protected?** Dieselben Rotoren, Ringe, Stecker, Endwalze, Kerben.
Historische Multi-Message-Angriffe bleiben das relevante Modell.
**Assumptions:** Mehrere ALBV-Telegramme eines Tages.
**Mitigation:** Tägliche Tafel. Kein Langzeitschlüssel über Monate
ohne neue Tafel. SK-Birthday ist \(26^4\); MID ersetzt keine Walze.
Zahlen: `research/results/v3-attacks.json`.

## Gestohlener Geheimtext

**Goal:** Lesen ohne Schlüssel.
**Protected?** Ohne Tagestafel kein MAC-Key und kein Rotorweg.
**Not protected?** Metadata, Länge, Wiederholungen, Beobachtung des QR.
**Assumptions:** Nur das Telegramm liegt vor.
**Mitigation:** Prüfgruppe verhindert stille Mutation, nicht das Lesen
bei gestohlener Tafel.

## Kompromittierter Messenger

**Goal:** Mithören oder Verändern im Transport.
**Protected?** Online-Gerät sieht bei Kurier nur Ciphertext. Prüfgruppe
erkennt Manipulation.
**Not protected?** Traffic-Metadata, Absender/Empfänger, Zeitpunkt.
**Assumptions:** Messenger-Betreiber ist neugierig oder feindlich.
**Mitigation:** Kurier + Prüfgruppe. Kein Klartext in die Cloud.

## Kompromittiertes Online-Gerät

**Goal:** Klartext oder Schlüssel vom Handy/Browser.
**Protected?** Kurier hält die Maschine offline — wenn er benutzt wird.
**Not protected?** Ohne Kurier liegt alles auf dem Online-Gerät.
Malware liest localStorage, Tafel, Klartext.
**Assumptions:** Browser oder App ist verseucht.
**Mitigation:** Kurier. Keine Tafel im Online-Profil speichern.

## Kompromittiertes Offline-Gerät

**Goal:** Maschine und Tafel direkt.
**Protected?** Nichts Kryptographisches.
**Not protected?** Alles.
**Assumptions:** Physischer oder Software-Zugriff auf das Offline-Gerät.
**Mitigation:** Gerätehärtung, kurze Tafel-Lebensdauer. Nicht die Chiffre.

## Gestohlene Tagestafel

**Goal:** Alle Nachrichten des Tages lesen und fälschen.
**Protected?** Nicht gegen den Tafelbesitzer.
**Not protected?** Tagesschlüssel *ist* das Geheimnis. Replay-Cache
hilft dem Empfänger nur in derselben Sitzung.
**Assumptions:** JSON/QR/Ausdruck der Tafel abgeflossen.
**Mitigation:** Tafelwort vergleichen. Tafel nicht fotografieren.
Neue Tafel.

## Manipulierte Tagestafel

**Goal:** Partner auf falsche Kerben/Endwalze setzen.
**Protected?** Tafelwort erkennt inhaltliche Änderung des Slim-Stroms.
**Not protected?** Tafelwort ist CRC-32, kein MAC. Gezielte Kollision
ist machbar für einen bestimmten Angreifer.
**Assumptions:** Tafel wird über einen unsicheren Kanal verteilt.
**Mitigation:** Tafelwort mündlich vergleichen. Nicht als Signatur
verkaufen.

## Manipulierter Webserver

**Goal:** Gefälschte Maschine ausliefern.
**Protected?** Nicht durch die Chiffre.
**Not protected?** Beliebiger JS-Austausch, Key-Exfiltration.
**Assumptions:** HTTPS-Server oder CDN kompromittiert.
**Mitigation:** Offline-Kopie, Companion, Source-Pinning nach
öffentlichem Repo. AGPL-Quelle vergleichen.

## Supply-chain-Angriff

**Goal:** Abhängigkeit oder Build verdrehen.
**Protected?** Wenig Drittcode (jsQR, qrcode-generator, fflate).
Web Crypto ist Plattform.
**Not protected?** Kompromittierte Vendor-Datei oder Browser-Crypto.
**Assumptions:** Paket oder Vendor-Update ist feindlich.
**Mitigation:** Vendored Dateien mit License-Headern. Kein NPM-Baum
im Produktkern.

## Physischer Zugriff

**Goal:** Gerät, Ausdruck, QR auf dem Bildschirm.
**Protected?** Nicht.
**Not protected?** Alles Sichtbare und Gespeicherte.
**Assumptions:** Schulterblick, beschlagnahmtes Handy, Mülleimer-Tafel.
**Mitigation:** Kurier-Disziplin, Tafel vernichten.

## HMAC as a candidate oracle

**Goal:** Test a guessed day key against a captured telegram.
**Protected?** The Prüfgruppe does not leak the day key.
**Not protected?** Anyone who can propose a full candidate can accept or
reject it offline: derive `canonicalDayKey`, HKDF, HMAC, compare PRUEF.
That is expected MAC behaviour and must be included in recovery-cost
models. It is not an HMAC break.
**Assumptions:** At least one authentic ALBV telegram is known.
**Mitigation:** Do not treat HMAC verification as extra confidentiality.

## Kurier (eigene Schicht)

Kurier schützt die **Klartext- und Schlüssel-Exposition des
Online-Endgeräts**. Er schützt nicht automatisch Traffic-Metadata,
QR-Beobachtung, physische Kompromittierung, kompromittierten
Offline-Code oder manipulierte Geheimtexte ohne Prüfgruppe.

Mit Prüfgruppe sieht das Online-Gerät weiter nur Ciphertext; eine
Veränderung fällt beim Offline-Decrypt auf.
