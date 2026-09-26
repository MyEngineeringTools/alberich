/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * UI-Sprachen DE / EN für Alberich Companion.
 */
/**
 * UI-Sprachen DE / EN für Alberich Companion.
 */

/** @typedef {'de'|'en'} Locale */

/** @type {Record<Locale, Record<string, string>>} */
export const STRINGS = {
  de: {
    'ui.tagline': 'Alberich Mail Companion',
    'ui.info': 'Info',
    'ui.infoTitle': 'Kurzhilfe',
    'ui.infoHeading': 'Kurzhilfe',
    'ui.info.modern.label': 'Nur Modern:',
    'ui.info.modern.body': 'Endwalze, Lückenfüller, Base-26, Auto-Spruchschlüssel. Spruch: ALBV (klar) · Kopf (Walze) · Message-ID (klar, 8) · Körper (Walze) · Prüfgruppe (HMAC, 20, nicht durch die Walzen).',
    'ui.info.sheet.label': 'Tafel:',
    'ui.info.sheet.body': 'JSON (Tagesschlüssel) oder .alb3cb2 (V3 gehärtet) — Knopf „Codebook laden“.',
    'ui.info.send.label': 'Senden:',
    'ui.info.send.body': 'Klartext → Geheimtext. V3: ALBV + Kopf + Message-ID + Körper + Prüfgruppe am Ende.',
    'ui.info.recv.label': 'Empfangen:',
    'ui.info.recv.body': 'ganzen Spruch einfügen: ALBV bis zur Prüfgruppe. Message-ID ist Zufall, keine Walzenlage. HKDF/HMAC siegeln; Replay nur in dieser Sitzung.',
    'ui.info.browser.label': 'Browser:',
    'ui.info.browser.body': 'Text markieren → Rechtsklick → Alberich → Zwischenablage.',
    'ui.info.local.label': 'Lokal:',
    'ui.info.local.body': 'Alles bleibt lokal — kein Upload, keine Telemetrie.',
    'ui.info.fullApp': 'Volle Walzen-UI und Traditionell-Modus:',
    'ui.info.codebook': 'Schlüsseltafel:',
    'ui.demoHeading': 'Demo-Tafel V3 (Store / Test)',
    'ui.demoWarn':
      'Öffentliche Modern-V3-Tafel (ALBV, formatVersion 3). Nicht geheim, nicht für echte Nachrichten. Tafelwort CPTZ YYH. Tag 16 = dokumentierter Goldtag.',
    'ui.demoLoad': 'V3-Demo-Tafel laden',
    'ui.demoLoaded': 'V3-Demo-Tafel geladen (nicht produktiv).',
    'ui.demoFailed': 'Demo-Tafel konnte nicht geladen werden.',
    'ui.imprint': 'Impressum',
    'ui.emailLabel': 'E-Mail:',
    'ui.thirdParty':
      'QR: qrcode-generator (MIT, Kazuhiko Arase), jsQR (Apache-2.0, Cosmo Wolfe). „QR Code“ ist eine Marke von DENSO WAVE.',
    'ui.license': 'Lizenz: AGPL-3.0-only · Name und Marke nicht unter der AGPL.',
    'ui.licenseLink': 'Lizenztext',
    'ui.sourceLink': 'Quellcode',
    'ui.thirdPartyLink': 'Hinweise Dritter',
    'ui.howto.label': 'Im Browser:',
    'ui.howto.body': 'Schreiben: ver-/entschlüsseln. Empfangene Mail: Entschlüsseln → Klartext-Tab.',
    'ui.noSheet': 'Keine Tafel — JSON oder .alb3cb2 laden',
    'ui.day': 'Tag',
    'ui.dayPlaceholder': 'Tag …',
    'ui.dayTitle': 'Tag wählen',
    'ui.dayTitleEmpty': 'Zuerst Monatstafel (JSON) laden',
    'ui.loadJson': 'Codebook laden',
    'ui.loadJsonTitle': 'Monatstafel (JSON oder .alb3cb2) — öffnet Import-Fenster',
    'ui.loadAlb3cb2': '.alb3cb2',
    'ui.loadAlb3cb2Title': 'V3 gehärtet (Binärdatei .alb3cb2)',
    'ui.clearSheet': 'Tafel entfernen',
    'ui.settingsSummary': 'Tagesschlüssel-Details',
    'ui.settingsSummaryHardened': 'Aktueller Zeitslot',
    'ui.dayTitleHardened': 'Slot folgt der Alberich-Schlüsselzeit',
    'ui.send': 'Senden',
    'ui.recv': 'Empfangen',
    'ui.messageKey': 'Spruchschlüssel',
    'ui.sessionAuto': 'auto · —',
    'ui.sessionNote': 'Wird automatisch erzeugt (Modern)',
    'ui.headerGroup': 'Kopfgruppe',
    'ui.stamp': 'Stempel',
    'ui.messageId': 'Message-ID',
    'ui.pruefgruppe': 'Prüfgruppe',
    'ui.sessionLegend':
      'ALBV und Message-ID stehen klar im Spruch. Kopfgruppe = verschlüsselter Spruchschlüssel. Prüfgruppe = HMAC-Siegel.',
    'ui.plain': 'Klartext',
    'ui.cipher': 'Geheimtext',
    'ui.placeholderPlain': 'Text tippen, einfügen oder per Rechtsklick im Browser…',
    'ui.placeholderCipher': 'Geheimtext ALBV … inkl. Prüfgruppe…',
    'ui.encrypt': 'Verschlüsseln',
    'ui.decrypt': 'Entschlüsseln',
    'ui.copy': 'Kopieren',
    'ui.paste': 'Einfügen',
    'ui.clear': 'Löschen',
    'ui.footer': 'Lokal · Base-26 · Auto-Spruchschlüssel · #ChatkontrolleAde',
    'ui.clipboardUnavailable': 'Zwischenablage nicht verfügbar.',
    'ui.clipboardEmpty': 'Zwischenablage ist leer.',
    'ui.clipboardBlocked':
      'Zwischenablage gesperrt — Strg+V im Textfeld nutzen oder Berechtigung erlauben.',
    'ui.menuEncrypt': 'Alberich: Verschlüsseln (Zwischenablage)',
    'ui.menuDecrypt': 'Alberich: Entschlüsseln (Zwischenablage)',
    'ui.menuCourierCopy': 'Alberich: Kurier-Buchstaben kopieren',
    'ui.langDe': 'DE',
    'ui.langEn': 'EN',
    'ui.langTitle': 'Sprache',
    'ui.taglineCourier': 'Kurier-Brücke — nur Geheimtext',
    'ui.footerCourier': 'Kurier an · nur QR und Buchstaben · #ChatkontrolleAde',
    'ui.info.courier.label': 'Kurier:',
    'ui.info.courier.body':
      'An = dieses Fenster transportiert nur Geheimtext (QR/Buchstaben). Rechnen bleibt auf dem Offline-Gerät.',

    'courier.roleLabel': 'Kurier',
    'courier.off': 'Kurier aus',
    'courier.on': 'Kurier an',
    'courier.hintOn':
      'Nur Geheimtext-QR. Ver- und Entschlüsseln bleibt auf dem Offline-Gerät — dieses Fenster sieht nur Buchstabensalat.',
    'courier.confirmOn':
      'Kurier einschalten? Dieses Fenster bewegt nur noch Geheimtext zwischen QR und Messenger. Es verschlüsselt und entschlüsselt nicht.\n\nKlartext und Tagesschlüssel bleiben auf dem Offline-Gerät.',
    'courier.confirmOnSheet':
      'Hier liegt noch eine Schlüsseltafel. Bei Kurier an wird sie nicht benutzt — besser entfernen, wenn das das Online-Gerät ist.',
    'courier.confirmOff':
      'Kurier ausschalten? Dieses Fenster ver- und entschlüsselt wieder. Nur auf dem Offline-Gerät mit Tagesschlüssel.',
    'courier.bridgeTitle': 'Kurier-Brücke',
    'courier.bridgeBody':
      'QR vom Offline-Gerät scannen und die Buchstaben in den Messenger kopieren — oder Buchstaben aus dem Messenger einfügen und als QR zeigen.',
    'courier.bridgeFooter': 'Auf dem Offline-Gerät bleibt Kurier aus — dort wird gerechnet.',
    'courier.sheetWarn': 'Hier liegt eine Schlüsseltafel. Für das Online-Gerät: Tafel entfernen.',
    'courier.clearSheet': 'Tafel entfernen',
    'courier.placeholder': 'Geheimtext-Buchstaben…',
    'courier.scan': 'QR scannen',
    'courier.pickImage': 'QR-Bild',
    'courier.stopScan': 'Scan beenden',
    'courier.scanHint': 'QR vom anderen Gerät (ALBERICH-CTQR1). Kein Tafel-QR.',
    'courier.camDenied': 'Kamera nicht verfügbar — QR-Bild wählen oder Buchstaben einfügen.',
    'courier.showQr': 'QR anzeigen',
    'courier.hideQr': 'QR schließen',
    'courier.letterCount': '{count} / {max} Buchstaben',
    'courier.qrNotFound': 'Kein Kurier-QR erkannt',
    'courier.qrTitle': 'Kurier-QR',
    'courier.qrMeta': '{count} Geheimtext-Buchstaben · ALBERICH-CTQR1',
    'courier.warnApproaching':
      'Kurier-QR wird lang: {count} von {max} Geheimtext-Buchstaben. Noch ein scannbarer Code — lieber nicht weiter wachsen lassen. Ohne Kurier-Verfahren kannst du die Meldung ignorieren.',
    'courier.warnOver':
      'Zu lang für einen Kurier-QR: {count} von höchstens {max} Buchstaben. Bitte kürzen. Ohne Kurier-Verfahren kannst du die Meldung ignorieren.',
    'courier.qrTooLong': 'Text zu lang für einen Kurier-QR',
    'courier.qrFailed': 'QR-Code konnte nicht erzeugt werden.',
    'toast.courierOn': 'Kurier an — nur Geheimtext',
    'toast.courierOff': 'Kurier aus',
    'toast.courierNoKeys': 'Kurier importiert keine Schlüssel',
    'courier.toCompose': 'In die Mail schreiben',
    'courier.fromCompose': 'Aus der Mail holen',
    'courier.fromMessage': 'Aus der Mail holen',
    'courier.toComposeDone': 'Buchstaben ins Schreiben-Fenster geschrieben.',
    'courier.fromComposeDone': 'Buchstaben aus der Mail übernommen.',
    'courier.windowTitle': 'Alberich — Kurier-QR',
    'courier.windowOpenFailed': 'Kurier-Fenster konnte nicht geöffnet werden.',

    'status.noSheet': 'Keine Tafel — JSON oder .alb3cb2 laden',
    'status.loaded': 'Tafel {ym} · Tag {day} · {plugs} Stecker · {layout}',
    'status.tafelwort': 'Tafelwort: {word}',
    'status.fingerprint': 'Fingerprint: {fp}',
    'status.hardened': 'V3 gehärtet {ym} · {slot} · noch {remain}',
    'status.hardenedShort': 'noch {remain}',
    'status.hardenedLive': '{source} · {slot} · {remain}',
    'status.clock': 'Uhr',
    'status.pinned': 'Pin',
    'status.monthMismatch': 'Tafel ist {sheetMonth} – heute ist {todayMonth}.',
    'status.monthKeep': 'Trotzdem diesen Tag nutzen',
    'status.dayLabel': 'Tag {day}',
    'session.summaryBoth': '{mk} · Kopf {hd}',

    'day.tag': 'Tag {day}',
    'day.rotors': 'Walzen {thin} · {left} {middle} {right} ({layout})',
    'day.rings': 'Ringe {ringCode} · Grund {keyCode}',
    'day.endwalze': 'Endwalze {name} · {plugs} Stecker',
    'rotor.perm': 'PERM',
    'day.notches': 'Kerben L {left} · M {middle} · R {right}',
    'day.stecker': 'Stecker {plugboard}',
    'day.dora': 'EW-Dora-Belegung: {pairs}',

    'modern.noKey': 'Bitte Monatstafel (JSON oder .alb3cb2) laden.',
    'modern.needMinPlugs': 'Mindestens 3 Steckerpaare nötig (aktuell {count}).',
    'modern.groundIncomplete': 'Grundstellung unvollständig.',
    'modern.configureFailed': 'Maschinenkonfiguration fehlgeschlagen.',
    'modern.headerFailed': 'Kopfgruppe konnte nicht gebildet werden.',
    'modern.tooShortForHeader': 'Geheimtext zu kurz (mind. 4 Buchstaben Kopfgruppe).',
    'modern.messageKeyInvalid': 'Spruchschlüssel konnte nicht ermittelt werden.',
    'modern.decryptFailed':
      'Entschlüsselung fehlgeschlagen — Tag, Tafel und vollständigen Geheimtext prüfen.',
    'modern.decryptIncomplete': 'Geheimtext unvollständig…',
    'modern.macFailed': 'Prüfgruppe ungültig — Telegramm verworfen, kein Klartext.',
    'modern.replay': 'Diese Message-ID wurde in dieser Sitzung schon empfangen.',
    'modern.v3CipherOnLegacy': 'Modern-V3-Telegramm passt nicht zu einer Legacy-Tafel.',
    'modern.legacyCipherOnV3': 'Legacy-Modern-Geheimtext — diese Tafel ist V3.',
    'modern.v3TooShort': 'V3-Telegramm zu kurz.',
    'modern.notV3': 'Kein Modern-Telegramm (erwartet ALBV…).',
    'modern.needPermutation': 'Modern braucht eine freie Endwalze und Kerben auf dem Tag. V3-Tafel laden.',
    'codebook.err.invalidJson': 'Ungültiges JSON.',
    'codebook.err.notObject': 'JSON ist kein Objekt.',
    'codebook.err.badFormat': 'Kein alberich-codebook-Format.',
    'codebook.err.badVersion': 'Unbekannte Format-Version.',
    'codebook.err.noDays': 'Tafel enthält keine Tage.',
    'codebook.err.badYear': 'Ungültiges Jahr.',
    'codebook.err.badMonth': 'Ungültiger Monat.',
    'codebook.err.badDay': 'Tag nicht in der Tafel.',
    'codebook.err.dayEntry': 'Ungültiger Tageseintrag.',
    'codebook.err.dayEntryFmt': 'Tag {day}: {detail}',
    'codebook.err.plugsInvalid': 'Steckerbrett: genau 10 Paare nötig.',
    'codebook.err.plugSelf': 'Steckerpaar darf nicht denselben Buchstaben doppelt haben.',
    'codebook.err.plugDuplicate': 'Steckerbuchstabe doppelt.',
    'timebook.err.notLegacyFormat': 'Gehärtete Tafel ist kein JSON — bitte .alb3cb2 laden.',
    'timebook.err.kind': 'Keine gehärtete Tafel geladen.',
    'timebook.err.outOfMonth': 'Die Tafel gilt nicht für den aktuellen Monat der Alberich-Schlüsselzeit.',
    'timebook.err.clockSelects': 'Bei V3 gehärtet wählt die Uhr den Slot.',
    'timebook.err.profile': 'Unbekanntes Zeitslot-Profil.',
    'timebook.err.keyTime': 'Schlüsselzeit muss UTC+1 sein.',
    'cbqr2.err.magic': 'Keine .alb3cb2-Datei (Magic ALB3CB2).',
    'cbqr2.err.truncated': 'Datei unvollständig.',
    'cbqr2.err.version': 'Unbekannte CBQR2-Version.',
    'modern.timeRollback': 'Die Gerätezeit liegt vor einem bereits verwendeten Zeitslot.',
    'modern.securityStateFailed': 'Verschlüsselung nicht möglich — lokaler Sicherheitsstatus fehlt.',
    'modern.externalizeFailed': 'Nachricht konnte nicht sicher freigegeben werden.',
    'modern.noKeyMatch': 'Kein passender Schlüssel in der Tafel für diese Nachricht.',
    'modern.ambiguousKey': 'Nachricht keinem eindeutigen Schlüssel zuordenbar.',

    'ui.noCompose': 'Bitte zuerst eine neue Nachricht öffnen (Schreiben-Fenster).',
    'ui.noMessage': 'Keine Nachricht geöffnet — Mail in der Vorschau anzeigen.',
    'ui.noMessageApi': 'Nachrichten-API nicht verfügbar (Thunderbird zu alt?).',
    'ui.messageReadFailed': 'Nachricht konnte nicht gelesen werden.',
    'ui.noSource': 'Kein Text gefunden — Schreiben-Fenster oder empfangene Mail öffnen.',
    'ui.composeStatusOk': 'Schreiben-Fenster bereit',
    'ui.messageStatusOk': 'Gelesene Mail bereit (Entschlüsseln → neuer Tab)',
    'ui.sourceStatusNo': 'Kein Schreiben-Fenster und keine Mail — bitte Nachricht öffnen',
    'ui.encryptNeedsCompose': 'Verschlüsseln nur im Schreiben-Fenster.',
    'ui.encryptDone': 'Verschlüsselt und ins Schreiben-Fenster geschrieben.',
    'ui.decryptDone': 'Entschlüsselt und ins Schreiben-Fenster geschrieben.',
    'ui.decryptOpenedTab': 'Entschlüsselt — Klartext in neuem Tab.',
    'ui.resultTabFailed': 'Klartext-Tab konnte nicht geöffnet werden.',
    'ui.encryptTitle': 'Text aus dem Schreiben-Fenster holen, verschlüsseln, zurückschreiben',
    'ui.decryptTitle': 'Geheimtext holen und entschlüsseln (Compose → zurück, Mail → neuer Tab)',
    'result.title': 'Alberich — Klartext',
    'result.note': 'Die Original-Mail bleibt unverändert. Dieser Tab ist nur lokal in der Extension.',
    'result.copy': 'Kopieren',
    'result.empty': 'Kein Klartext vorhanden. Bitte erneut entschlüsseln.',
    'import.title': 'Alberich — Codebook laden',
    'import.sub': 'JSON (Tagesschlüssel) oder .alb3cb2 (V3 gehärtet). Dieses Fenster bleibt geöffnet, damit der Dateidialog funktioniert.',
    'import.pickFile': 'JSON-Datei wählen…',
    'import.pickAlb3cb2': '.alb3cb2 wählen…',
    'import.orPaste': 'oder JSON hier einfügen:',
    'import.pastePlaceholder': '{ "format": "alberich-codebook", … }',
    'import.applyPaste': 'Eingefügtes JSON übernehmen',
    'import.close': 'Schließen',
    'import.success': 'Tafel gespeichert. Fenster schließt…',
    'import.readFailed': 'Datei konnte nicht gelesen werden.',
    'import.openFailed': 'Import-Fenster konnte nicht geöffnet werden.',
    encryptOk: 'Verschlüsselt.',
    sheetLoadedHardened: 'Gehärtete Tafel geladen · {fp}',
    decryptOk: 'Entschlüsselt.',
    copied: 'In Zwischenablage kopiert.',
    pasted: 'Aus Zwischenablage eingefügt.',
    cleared: 'Gelöscht.',
    sheetLoaded: 'Tafel geladen.',
    sheetLoadedWord: 'Tafel geladen · {word}',
    sheetCleared: 'Tafel entfernt.',
    emptyInput: 'Kein Text.',
  },
  en: {
    'ui.tagline': 'Alberich Mail Companion',
    'ui.info': 'Info',
    'ui.infoTitle': 'Quick help',
    'ui.infoHeading': 'Quick help',
    'ui.info.modern.label': 'Modern only:',
    'ui.info.modern.body': 'end rotor, filler notches, Base-26, auto message key. Telegram: ALBV (clear) · header (rotor) · message ID (clear, 8) · body (rotor) · check group (HMAC, 20, not through the rotors).',
    'ui.info.sheet.label': 'Sheet:',
    'ui.info.sheet.body': 'JSON (daily key) or .alb3cb2 (V3 hardened) via “Load codebook”.',
    'ui.info.send.label': 'Send:',
    'ui.info.send.body': 'plaintext → ciphertext. V3: ALBV + header + message ID + body + check group at the end.',
    'ui.info.recv.label': 'Receive:',
    'ui.info.recv.body': 'paste the full telegram: ALBV through the check group. Message ID is random, not rotor positions. HKDF/HMAC seal; replay is this session only.',
    'ui.info.browser.label': 'Browser:',
    'ui.info.browser.body': 'select text → right-click → Alberich → clipboard.',
    'ui.info.local.label': 'Local:',
    'ui.info.local.body': 'Everything stays local — no upload, no telemetry.',
    'ui.info.fullApp': 'Full rotor UI and Traditional mode:',
    'ui.info.codebook': 'Code sheet:',
    'ui.demoHeading': 'V3 demo sheet (store / testing)',
    'ui.demoWarn':
      'Public Modern V3 sheet (ALBV, formatVersion 3). Not secret, not for real messages. Sheet word CPTZ YYH. Day 16 is the documented golden day.',
    'ui.demoLoad': 'Load V3 demo sheet',
    'ui.demoLoaded': 'V3 demo sheet loaded (not for production).',
    'ui.demoFailed': 'Could not load the demo sheet.',
    'ui.imprint': 'Legal notice',
    'ui.emailLabel': 'Email:',
    'ui.thirdParty':
      'QR: qrcode-generator (MIT, Kazuhiko Arase), jsQR (Apache-2.0, Cosmo Wolfe). “QR Code” is a trademark of DENSO WAVE.',
    'ui.license': 'License: AGPL-3.0-only · name and mark are not under the AGPL.',
    'ui.licenseLink': 'License text',
    'ui.sourceLink': 'Source code',
    'ui.thirdPartyLink': 'Third-party notices',
    'ui.howto.label': 'In the browser:',
    'ui.howto.body': 'Write: encrypt/decrypt. Received mail: Decrypt → plaintext tab.',
    'ui.noSheet': 'No sheet — load JSON or .alb3cb2',
    'ui.day': 'Day',
    'ui.dayPlaceholder': 'Day …',
    'ui.dayTitle': 'Choose day',
    'ui.dayTitleEmpty': 'Load a monthly sheet (JSON) first',
    'ui.loadJson': 'Load codebook',
    'ui.loadJsonTitle': 'Monthly sheet (JSON or .alb3cb2) — opens import window',
    'ui.loadAlb3cb2': '.alb3cb2',
    'ui.loadAlb3cb2Title': 'V3 hardened (.alb3cb2 binary)',
    'ui.clearSheet': 'Remove sheet',
    'ui.settingsSummary': 'Daily key details',
    'ui.settingsSummaryHardened': 'Current time slot',
    'ui.dayTitleHardened': 'The clock selects the slot',
    'ui.send': 'Send',
    'ui.recv': 'Receive',
    'ui.messageKey': 'Message key',
    'ui.sessionAuto': 'auto · —',
    'ui.sessionNote': 'Generated automatically (Modern)',
    'ui.headerGroup': 'Header group',
    'ui.stamp': 'Stamp',
    'ui.messageId': 'Message ID',
    'ui.pruefgruppe': 'Check group',
    'ui.sessionLegend':
      'ALBV and the message ID sit in the clear. Header group = encrypted message key. Check group = HMAC tag.',
    'ui.plain': 'Plaintext',
    'ui.cipher': 'Ciphertext',
    'ui.placeholderPlain': 'Type, paste, or use right-click in the browser…',
    'ui.placeholderCipher': 'Ciphertext ALBV … including check group…',
    'ui.encrypt': 'Encrypt',
    'ui.decrypt': 'Decrypt',
    'ui.copy': 'Copy',
    'ui.paste': 'Paste',
    'ui.clear': 'Clear',
    'ui.footer': 'Local · Base-26 · Auto message key · #ChatcontrolByeBye',
    'ui.clipboardUnavailable': 'Clipboard unavailable.',
    'ui.clipboardEmpty': 'Clipboard is empty.',
    'ui.clipboardBlocked':
      'Clipboard blocked — use Ctrl+V in the field or allow the permission.',
    'ui.menuEncrypt': 'Alberich: Encrypt (clipboard)',
    'ui.menuDecrypt': 'Alberich: Decrypt (clipboard)',
    'ui.menuCourierCopy': 'Alberich: copy courier letters',
    'ui.langDe': 'DE',
    'ui.langEn': 'EN',
    'ui.langTitle': 'Language',
    'ui.taglineCourier': 'Courier bridge — ciphertext only',
    'ui.footerCourier': 'Courier on · QR and letters only · #ChatcontrolByeBye',
    'ui.info.courier.label': 'Courier:',
    'ui.info.courier.body':
      'On = this window only moves ciphertext (QR/letters). Crypto stays on the offline device.',

    'courier.roleLabel': 'Courier',
    'courier.off': 'Courier off',
    'courier.on': 'Courier on',
    'courier.hintOn':
      'Ciphertext QR only. Encrypt and decrypt stay on the offline device — this window sees letter salad.',
    'courier.confirmOn':
      'Turn courier on? This window will only move ciphertext between a QR and the messenger. It will not encrypt or decrypt.\n\nPlaintext and the daily key stay on the offline device.',
    'courier.confirmOnSheet':
      'A code sheet is still stored here. It is not used while courier is on — better remove it if this is the online device.',
    'courier.confirmOff':
      'Turn courier off? This window will encrypt and decrypt again. Only do that on the offline device that holds the daily key.',
    'courier.bridgeTitle': 'Courier bridge',
    'courier.bridgeBody':
      'Scan a QR from the offline device and copy the letters into the messenger — or paste letters from the messenger and show a QR.',
    'courier.bridgeFooter': 'Leave courier off on the offline device — that one does the crypto.',
    'courier.sheetWarn': 'A code sheet is stored here. For the online device: remove the sheet.',
    'courier.clearSheet': 'Remove sheet',
    'courier.placeholder': 'Ciphertext letters…',
    'courier.scan': 'Scan QR',
    'courier.pickImage': 'QR image',
    'courier.stopScan': 'Stop scan',
    'courier.scanHint': 'QR from the other device (ALBERICH-CTQR1). Not a code-sheet QR.',
    'courier.camDenied': 'Camera unavailable — pick a QR image or paste letters.',
    'courier.showQr': 'Show QR',
    'courier.hideQr': 'Close QR',
    'courier.letterCount': '{count} / {max} letters',
    'courier.qrNotFound': 'No courier QR recognised',
    'courier.qrTitle': 'Courier QR',
    'courier.qrMeta': '{count} ciphertext letters · ALBERICH-CTQR1',
    'courier.warnApproaching':
      'Courier QR is getting long: {count} of {max} ciphertext letters. Still one scannable code — keep it short. You can ignore this if you are not using courier.',
    'courier.warnOver':
      'Too long for one courier QR: {count} of at most {max} letters. Please shorten. You can ignore this if you are not using courier.',
    'courier.qrTooLong': 'Text too long for a courier QR',
    'courier.qrFailed': 'Could not create QR code.',
    'toast.courierOn': 'Courier on — ciphertext only',
    'toast.courierOff': 'Courier off',
    'toast.courierNoKeys': 'Courier mode does not import keys',
    'courier.toCompose': 'Write into the mail',
    'courier.fromCompose': 'Take from the mail',
    'courier.fromMessage': 'Take from the mail',
    'courier.toComposeDone': 'Letters written to the write window.',
    'courier.fromComposeDone': 'Letters taken from the mail.',
    'courier.windowTitle': 'Alberich — courier QR',
    'courier.windowOpenFailed': 'Could not open the courier window.',

    'status.noSheet': 'No sheet — load JSON or .alb3cb2',
    'status.loaded': 'Sheet {ym} · day {day} · {plugs} plugs · {layout}',
    'status.tafelwort': 'Sheet word: {word}',
    'status.fingerprint': 'Fingerprint: {fp}',
    'status.hardened': 'V3 hardened {ym} · {slot} · {remain} left',
    'status.hardenedShort': '{remain} left',
    'status.hardenedLive': '{source} · {slot} · {remain}',
    'status.clock': 'clock',
    'status.pinned': 'pin',
    'status.monthMismatch': 'Sheet is {sheetMonth} — today is {todayMonth}.',
    'status.monthKeep': 'Keep this day',
    'status.dayLabel': 'Day {day}',
    'session.summaryBoth': '{mk} · header {hd}',

    'day.tag': 'Day {day}',
    'day.rotors': 'Rotors {thin} · {left} {middle} {right} ({layout})',
    'day.rings': 'Rings {ringCode} · ground {keyCode}',
    'day.endwalze': 'End rotor {name} · {plugs} plugs',
    'rotor.perm': 'PERM',
    'day.notches': 'Notches L {left} · M {middle} · R {right}',
    'day.stecker': 'Plugs {plugboard}',
    'day.dora': 'EW-Dora wiring: {pairs}',

    'modern.noKey': 'Please load a monthly sheet (JSON or .alb3cb2).',
    'modern.needMinPlugs': 'At least 3 plug pairs required (currently {count}).',
    'modern.groundIncomplete': 'Ground setting incomplete.',
    'modern.configureFailed': 'Machine configuration failed.',
    'modern.headerFailed': 'Could not build header group.',
    'modern.tooShortForHeader': 'Ciphertext too short (need 4-letter header).',
    'modern.messageKeyInvalid': 'Could not recover the message key.',
    'modern.decryptFailed':
      'Decrypt failed — check day, sheet and full ciphertext.',
    'modern.decryptIncomplete': 'Ciphertext incomplete…',
    'modern.macFailed': 'Check group invalid — telegram discarded, no plaintext.',
    'modern.replay': 'This message ID was already received in this session.',
    'modern.v3CipherOnLegacy': 'Modern V3 telegram does not match a legacy sheet.',
    'modern.legacyCipherOnV3': 'Legacy Modern ciphertext — this sheet is V3.',
    'modern.v3TooShort': 'V3 telegram too short.',
    'modern.notV3': 'Not a Modern telegram (expected ALBV…).',
    'modern.needPermutation': 'Modern needs a free end rotor and notches. Load a format-3 sheet.',
    'codebook.err.invalidJson': 'Invalid JSON.',
    'codebook.err.notObject': 'JSON is not an object.',
    'codebook.err.badFormat': 'Not an alberich-codebook format.',
    'codebook.err.badVersion': 'Unknown format version.',
    'codebook.err.noDays': 'Sheet has no days.',
    'codebook.err.badYear': 'Invalid year.',
    'codebook.err.badMonth': 'Invalid month.',
    'codebook.err.badDay': 'Day not on the sheet.',
    'codebook.err.dayEntry': 'Invalid day entry.',
    'codebook.err.dayEntryFmt': 'Day {day}: {detail}',
    'codebook.err.plugsInvalid': 'Plugboard: exactly 10 pairs required.',
    'codebook.err.plugSelf': 'A plug pair cannot repeat the same letter.',
    'codebook.err.plugDuplicate': 'Duplicate plug letter.',
    'timebook.err.notLegacyFormat': 'A hardened sheet is not JSON — load .alb3cb2.',
    'timebook.err.kind': 'No hardened sheet loaded.',
    'timebook.err.outOfMonth': 'This sheet is not for the current Alberich-key-time month.',
    'timebook.err.clockSelects': 'With V3 hardened the clock selects the slot.',
    'timebook.err.profile': 'Unknown time-slot profile.',
    'timebook.err.keyTime': 'Key time must be UTC+1.',
    'cbqr2.err.magic': 'Not a .alb3cb2 file (magic ALB3CB2).',
    'cbqr2.err.truncated': 'File truncated.',
    'cbqr2.err.version': 'Unknown CBQR2 version.',
    'modern.timeRollback': 'Device time is behind a slot already used for sending.',
    'modern.securityStateFailed': 'Cannot encrypt — local security state unavailable.',
    'modern.externalizeFailed': 'Could not release the message safely.',
    'modern.noKeyMatch': 'No matching key on this sheet for that message.',
    'modern.ambiguousKey': 'Message did not match a single key.',

    'ui.noCompose': 'Please open a new message first (write window).',
    'ui.noMessage': 'No message open — select a mail in the preview.',
    'ui.noMessageApi': 'Messages API unavailable (Thunderbird too old?).',
    'ui.messageReadFailed': 'Could not read the message.',
    'ui.noSource': 'No text found — open the write window or a received mail.',
    'ui.composeStatusOk': 'Write window ready',
    'ui.messageStatusOk': 'Received mail ready (Decrypt → new tab)',
    'ui.sourceStatusNo': 'No write window and no mail — please open a message',
    'ui.encryptNeedsCompose': 'Encrypt only works in the write window.',
    'ui.encryptDone': 'Encrypted and written to the write window.',
    'ui.decryptDone': 'Decrypted and written to the write window.',
    'ui.decryptOpenedTab': 'Decrypted — plaintext opened in a new tab.',
    'ui.resultTabFailed': 'Could not open the plaintext tab.',
    'ui.encryptTitle': 'Take text from the write window, encrypt, write back',
    'ui.decryptTitle': 'Take ciphertext and decrypt (compose → write back, mail → new tab)',
    'result.title': 'Alberich — plaintext',
    'result.note': 'The original mail is unchanged. This tab is local to the extension only.',
    'result.copy': 'Copy',
    'result.empty': 'No plaintext available. Please decrypt again.',
    'import.title': 'Alberich — load codebook',
    'import.sub': 'JSON (daily key) or .alb3cb2 (V3 hardened). This window stays open so the file dialog works.',
    'import.pickFile': 'Choose JSON file…',
    'import.pickAlb3cb2': 'Choose .alb3cb2…',
    'import.orPaste': 'or paste JSON here:',
    'import.pastePlaceholder': '{ "format": "alberich-codebook", … }',
    'import.applyPaste': 'Import pasted JSON',
    'import.close': 'Close',
    'import.success': 'Sheet saved. Closing…',
    'import.readFailed': 'Could not read the file.',
    'import.openFailed': 'Could not open the import window.',
    encryptOk: 'Encrypted.',
    sheetLoadedHardened: 'Hardened sheet loaded · {fp}',
    decryptOk: 'Decrypted.',
    copied: 'Copied to clipboard.',
    pasted: 'Pasted from clipboard.',
    cleared: 'Cleared.',
    sheetLoaded: 'Sheet loaded.',
    sheetLoadedWord: 'Sheet loaded · {word}',
    sheetCleared: 'Sheet removed.',
    emptyInput: 'No text.',
  },
};

const LOCALE_KEY = 'alberichCompanion.locale';

/** @type {Locale} */
let currentLocale = 'de';

/** @returns {Locale} */
export function getLocale() {
  return currentLocale;
}

/**
 * @param {Locale|string} locale
 */
export function setLocale(locale) {
  currentLocale = locale === 'en' ? 'en' : 'de';
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  const table = STRINGS[currentLocale] || STRINGS.de;
  const fallback = STRINGS.de;
  let s = table[key] ?? fallback[key] ?? key;

  if (String(key).includes('\t')) {
    const parts = String(key).split('\t');
    if (parts[0] === 'codebook.err.dayEntry') {
      s = t('codebook.err.dayEntryFmt', {
        day: parts[1] ?? '?',
        detail: t(parts[2] || parts[0]),
      });
    }
  }
  if (key.includes('|') && !key.includes('\t')) {
    const [k, v] = key.split('|');
    s = t(k) + (v ? ` (${v})` : '');
  }
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/**
 * @param {{ get: Function, set: Function }} storage
 * @returns {Promise<Locale>}
 */
export async function loadLocale(storage) {
  try {
    const data = await storage.get(LOCALE_KEY);
    const raw = data?.[LOCALE_KEY] ?? data;
    const loc = raw === 'en' || raw?.locale === 'en' ? 'en' : 'de';
    // support both plain string and object
    if (typeof raw === 'string') setLocale(raw);
    else if (raw && typeof raw === 'object' && raw.locale) setLocale(raw.locale);
    else setLocale(loc);
  } catch {
    setLocale('de');
  }
  return currentLocale;
}

/**
 * @param {{ set: Function }} storage
 * @param {Locale} locale
 */
export async function saveLocale(storage, locale) {
  setLocale(locale);
  await storage.set({ [LOCALE_KEY]: currentLocale });
}

export { LOCALE_KEY };
