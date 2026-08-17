# Alberich – Kurzanleitung

Dieselbe Anleitung wie in der Web-App unter **Anleitung**. Tutorials mit
Videos: [alberich.pro/blog](https://alberich.pro/blog/).

## 1. Was ist Alberich?

Alberich ist ein kostenloser Enigma-M4-Simulator im Browser (Deutsch/Englisch), ohne Account. Vier-Walzen-Chiffre mit Walzen, Ringen, Steckerbrett und Tagesschlüssel – plus Schlüsseltafeln und Netze. Monatstafeln erzeugt die Web-App oder die Android-App.

## 2. Zwei Hauptmodi

**Traditionell:** Historisches Verhalten (involutorisch, A–Z). Unteroptionen *Einfach* und *Spruchschlüssel*. Ideal zum Lernen und für klassische Übungen.

**Modern:** Alltagspaket – beliebiger Text (UTF-8), automatischer Spruchschlüssel, Endwalze und Lückenfüllerwalzen. Du pflegst nur den Tagesschlüssel; Ver- und Entschlüsseln sind getrennt (nicht involutorisch).

Oben siehst du den aktiven Modus. Umschalten mit „Traditionell“ / „Modern“; bei Traditionell zusätzlich das Verfahren wählen.

## 3. Modern – Alltag

So schickst und empfängst du eine Nachricht im Modern-Modus:

1. Hauptmodus „Modern“ wählen.
2. Tagesschlüssel einstellen (Walzen tippen → Setup): Grundstellung, Ringe, Stecker, Walzenlage – aus der Schlüsseltafel oder manuell. Mindestens 3 Steckerpaare.
3. Senden: Eingabe-Art „Klartext“, Text tippen oder einfügen. Die Ausgabe ist der Geheimtext (4er-Gruppen).
4. Geheimtext teilen (kopieren/teilen). Der Empfänger braucht denselben Tagesschlüssel.
5. Empfangen: Eingabe-Art „Geheimtext“, den kompletten Geheimtext einfügen — von ALBV bis zur Prüfgruppe am Ende. Ausgabe ist der Originaltext.
6. Kurier: QR an der Ausgabe zeigen, damit der Geheimtext auf ein anderes Gerät (z. B. die Android-App) geht. Zu lange Texte werden über dem Eingabefeld gemeldet. Ohne Kurier-Verfahren kannst du die Meldung ignorieren.

Aufbau des Modern-Spruchs (in der Leiste wie der Spruchschlüssel):

- Stempel ALBV — unverschlüsselt, immer dieselben vier Buchstaben. Sagt: das ist ein Modern-Spruch.
- Kopfgruppe (4) — Walzen-Geheimtext. Darin steckt der Spruchschlüssel, unter der Grundstellung verschlüsselt.
- Message-ID (8) — unverschlüsselter Zufall, keine Walzenlage. Steckt im Siegel und verhindert Replay in dieser Sitzung.
- Körper — die Nachricht als eine Zahl in A–Z, dann durch die Walzen. Ein weiteres Zeichen ändert die ganze Zahl (×256 + Byte), deshalb wirkt der Körper beim Tippen neu gemischt.
- Prüfgruppe (20) — HMAC-Siegel am Ende. Weder ver- noch entschlüsselt; nur nachrechnen und vergleichen. Ohne sie und ohne den ganzen Spruch gibt es keinen Klartext.

HKDF zieht aus der Tafel einen Schlüssel nur fürs Siegel. HMAC erkennt Änderungen, bevor ein Klartext erscheint. Replay merkt sich Message-ID plus Tag in dieser Sitzung — kein Adressbuch in der Cloud.

Pro Nachricht wählt Alberich intern einen neuen Zufalls-Spruchschlüssel und eine neue Message-ID. Neu nach Löschen der Felder, Rollenwechsel oder Änderung des Tagesschlüssels – nicht bei jedem Tastendruck. Die Kopfgruppe in der Leiste ist die zweite Vierergruppe, nicht ALBV.

Beliebige Zeichen (Umlaute, Zahlen, Emoji …) werden intern über Base-26 verarbeitet. Du musst nichts umkodieren.

Weniger als 3 Steckerpaare: Fehlermeldung, kein Lauf. Im Setup Stecker ergänzen.

## 4. Traditionell

**Einfach:** Eine Startlage für den ganzen Text. Tippen → Ausgabe. Dieselbe Einstellung entschlüsselt wieder (reziprok).

**Spruchschlüssel:** Historisches Verfahren mit manueller Kontrolle:

1. Tagesschlüssel (inkl. Grundstellung) einstellen.
2. Pro Nachricht neuen Spruchschlüssel wählen oder würfeln (4 Buchstaben).
3. Klartext senden: Kopfgruppe wird aus dem Spruchschlüssel gebildet, Text läuft mit dem Spruchschlüssel.
4. Geheimtext empfangen: Einfügen – erste 4 Buchstaben = Kopfgruppe → Spruchschlüssel, Rest = Textkörper.

Nur A–Z für die Maschine. Zahlen und Satzzeichen werden umgewandelt (z. B. Punkt → X, Komma → Y, ? → UD). Leerzeichen bleiben in der Eingabe.

## 5. Schlüssel & Netze

**Walzenlage:** Dünne Walze / Griechenwalze (Beta/Gamma) + drei Hauptwalzen (I–VIII), jede Hauptwalze nur einmal. Beispiel B241 = Beta + II + IV + I. Sie sitzt in allen Modi im Stromweg. Traditionell: sie dreht nicht, Ringstellung der Griechenwalze bleibt 0. Modern: sie läuft mit, wenn die linke Walze an einer Kerbe steht; sie selbst hat keine Kerben und treibt nichts. Im Modern-Modus gilt auch ihre Ringstellung.

**Ringstellung:** 4 Buchstaben, gilt für die ganze Nachricht / den Tag.

**Grundstellung:** Startlage aus dem Tagesschlüssel. Bei Traditionell · Einfach oft auch die sichtbare Startlage; bei Spruchschlüssel/Modern die Tages-Startlage (Spruchschlüssel separat bzw. automatisch).

**Steckerbrett:** Paare mit Leerzeichen (z. B. AB CD EF). Historisch oft 10 Paare; Modern mindestens 3.

**Umkehrwalze / Endwalze:** Traditionell: Bruno, Caesar oder Dora. Modern: eine volle 26-Buchstaben-Permutation auf der Tafel.

**Endwalze in der Tafel:** Modern erzeugt immer freie Permutation (Telegramm ALBV). Traditionell: *Mix* oder *Nur Bruno/Caesar*.

**Zufällig ohne Tafel:** Unter Zufällig/Manuell dieselbe Endwalzen-Wahl wie bei der Tafel. Vorauswahl folgt dem Hauptmodus; passt sie nicht, erscheint ein Hinweis. „Zufällig“ würfelt den Tagesschlüssel nach der gewählten Politik.

**Schlüsseltafel:** Im Setup eine Monatstafel erzeugen oder JSON/QR importieren und den Tag wählen – oder manuell/zufällig. „Tafel anzeigen“ zeigt die Monatstabelle; von dort drucken oder als Text kopieren. Gehört die Tafel zum laufenden Monat, stellt die Seite beim Laden auf heute (ältere Tage bleiben wählbar). Passt der Monat nicht, erscheint ein Hinweis — du kannst den gewählten Tag behalten oder eine neue Tafel erzeugen. Nach dem Laden erscheint ein Tafelwort (sieben Buchstaben). Einmal mit dem Partner vergleichen: gleiches Wort, dieselbe Tafel.

**Netze:** Bis zu fünf benannte Netze mit je einer Monatstafel. Tafel im Setup erzeugen oder JSON/QR importieren. Tafel teilen (JSON, QR, System-Teilen). „Tafel entfernen“ leert nur das aktive Netz; „Not-Aus“ löscht alle Tafeln in diesem Browser.

## 6. Tipps

- Walzen und Schlüssel nur bei leeren Textfeldern ändern.
- Aktiven Modus immer im Status oben prüfen, bevor du sendest.
- Traditionell und Modern sind nicht mischbar: gleicher Modus und gleicher Tagesschlüssel bei beiden Seiten.
- Mit Alberich kannst du deine Kommunikation sicher und schnell verschlüsseln – unabhängig von Messenger, Mail-Programm oder SMS. Alberich ist aber nicht unknackbar. Nimm an unserer täglichen Challenge auf X teil und versuche es!

## 7. Zwei Geräte (Kurier)

Kurier trennt Rechnen und Transport. Ver- und Entschlüsseln bleibt auf einem zweiten Gerät, das dauerhaft offline bleibt (Kurier aus, Flugmodus). Das alltägliche Online-Gerät (Kurier an) sieht nur den fertigen Geheimtext.

Warum: Debatten um Client-Side-Scanning („Chatkontrolle 2.0“) betreffen das Kommunikationsgerät. Liegen Klartext und Tagesschlüssel nie dort, liefert ein solcher Scan nur Buchstabensalat.

Das ist keine Rechtsberatung und kein Schutz vor Metadaten (wer mit wem, wann). Das Offline-Gerät darf nicht „kurz online“ gehen; keine Cloud-Backups, keine Screenshots vom Klartext.

1. Offline: Kurier aus, Modern, Tagesschlüssel aus der Tafel. Dieses Gerät rechnet.
2. Online: Kurier an. Keine Schlüsseltafel, kein Klartext. Nur QR und Buchstaben.
3. Senden: offline verschlüsseln, QR zeigen, online scannen, Buchstaben in den Messenger.
4. Empfangen: online Buchstaben einfügen oder QR zeigen, offline scannen, entschlüsseln.
