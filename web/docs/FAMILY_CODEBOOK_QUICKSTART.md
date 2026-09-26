# Alberich im Familien- oder Freundeskreis

Diese Anleitung beschreibt die normale Alberich-App und Web mit den lokalen
Codebook-Korrekturen vom 26. September 2026. Den genauen getesteten Stand und
die offenen Abnahmen nennt der [Produktionsreview](PRODUCTION_REVIEW_2026-09-26.md).
Eine lokale Aktualisierung bedeutet keine Veröffentlichung im Store oder Webhost.

## Einmal gemeinsam einrichten

1. **Modern**, **Kurier aus**, Quelle **Schlüsseltafel** wählen. Ein eigenes,
   eindeutig benanntes Netz für die Gruppe anlegen, beispielsweise „Familie“.
2. Eine Person erzeugt die Monatstafel. Für einen einfachen automatischen Alltag
   ist **V3 gehärtet · 24 Stunden** übersichtlich; 4h/1h verkürzen den Zeitraum
   desselben Schlüssels. Sie ersetzen weder sichere Übergabe noch geprüfte Kryptografie.
3. Dieselbe Tafel vertraulich an alle Gruppenmitglieder übergeben. Gehärtete
   Tafeln verwenden `.alb3cb2` oder Live-QR; Tagestafeln JSON oder Standbild-QR.
   Die Tafel enthält geheime Schlüssel, nicht nur eine harmlose Kontaktkennung.
4. Aktives Netz, Monat und Tafelwort/Fingerabdruck gemeinsam vergleichen.
   Tafelwörter helfen gegen Verwechslungen; sie authentifizieren keine Person.
   Tafel und spätere Geheimtexte nicht einfach gemeinsam im selben ungeschützten
   Chat verteilen. Eine persönlich überprüfte Übergabe ist leichter zu beurteilen.
5. Eine harmlose Probenachricht in beide Richtungen senden und den Klartext vergleichen.

## Eine Nachricht senden oder lesen

- **Senden:** richtiges Netz wählen → Eingabe-Art **Klartext** → schreiben →
  **Ausgabe kopieren/teilen**. Verschickt wird die komplette Ausgabe ab `ALBV`,
  einschließlich der Prüfgruppen am Ende.
- **Lesen:** richtiges Netz wählen → Eingabe-Art **Geheimtext** → gesamte Nachricht
  einfügen. In Alberich funktioniert auch „Teilen an Alberich“ aus einer anderen App.
- Bei einer Fehlermeldung zuerst Netz, Monat und vollständigen Nachrichtentext prüfen.
  Bei Tagestafeln muss der Tafeltag übereinstimmen. **Heute** verwendet im korrigierten
  Stand UTC+1 ganzjährig; im Sommer liegt diese Zeit eine Stunde hinter deutscher Ortszeit.
- Eine bereits ausgegebene Nachricht darf korrigiert werden. Die nächste geänderte
  Ausgabe erhält im korrigierten Stand einen neuen Spruchschlüssel und eine neue Kennung.
  Für eine bewusst neue Unterhaltung „Alle Felder löschen“ verwenden.
- Vor Monatsende die nächste Monatstafel abstimmen. Eine fehlende Tafel soll den
  Versand blockieren; zufällige/manuelle Einstellungen sind kein Ersatz für die Gruppentafel.

## Was Sicherheit hier bedeutet

Modern V3 ist ein eigenes experimentelles Rotorverfahren mit Integritätsprüfung.
Die Funktions- und Fehlertests sind **kein unabhängiger Kryptografie-Audit** und
belegen keine AES-Äquivalenz. Traditionell ist eine historische Simulation.

Eine gemeinsame Tafel berechtigt alle Besitzer zum Entschlüsseln und Erzeugen
passender Nachrichten. Sie beweist nicht, welches einzelne Familienmitglied
wirklich geschrieben hat. Gerät oder Monatstafel kompromittiert: neue Tafel über
einen wieder vertrauenswürdigen Weg verteilen; kürzere Slots reparieren diesen
Vorfall nicht. Forward Secrecy wird nicht zugesichert.

Tafeln liegen lokal in App-/Browserdaten. JSON, Binärdateien, QR-Bilder und
Zwischenablage sind nicht dadurch passwortverschlüsselt, dass Alberich sie erzeugt.
Gerätesperre und Schutz des Browserprofils bleiben relevant. Die Android-Markierung
„sensibel“ unterdrückt eine Zwischenablage-Vorschau, nicht den eigentlichen Inhalt.
Ein frischer Browser, gelöschte Website-Daten oder ein neues Telefon besitzen die
alte lokale Spruchschlüssel-Registry nicht. Keine globale Gruppen-Eindeutigkeit versprechen.

## Wiederholbare kurze Abnahme

| Schritt | Erwartung |
|---|---|
| Beide Partner importieren dieselbe Testtafel | gleicher Monat und Vergleichswert |
| „Grüße 🔐 – Sonntag 15:30“ senden | exakt gleicher Klartext, auch mit Zeilenumbruch |
| Kopieren, dann 15:30 → 16:00 ändern | neue Ausgabe; beide Nachrichten lesbar |
| Ein Geheimtextzeichen verändern | Fehlermeldung, kein Klartext |
| Falsches/leeres Netz auswählen | kein irreführender erfolgreicher Versand |
| App/Browser neu starten | Tafel bleibt; neue Nachrichten funktionieren |
| Defekte Datei importieren | bisherige Tafel bleibt erhalten |
| Tafel entfernen / Ersatz abbrechen | nur die bestätigte Aktion hat Wirkung |

Für einen ersten Pilotkreis empfehlen sich wenige eingeweihte Teilnehmer und
harmlose Nachrichten. Ein kurzer beobachteter Durchlauf mit tatsächlichen
Familienmitgliedern bleibt nötig: automatisierte Bedienung misst nicht, wie
verständlich die Begriffe für Erstnutzer sind.
