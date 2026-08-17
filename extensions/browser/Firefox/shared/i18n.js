/**
 * UI-Sprachen DE / EN für Alberich Companion.
 */

/** @typedef {'de'|'en'} Locale */

/** @type {Record<Locale, Record<string, string>>} */
export const STRINGS = {
  de: {
    'ui.tagline': 'Modern · Seitenleiste',
    'ui.info': 'Info',
    'ui.infoTitle': 'Kurzhilfe',
    'ui.infoHeading': 'Kurzhilfe',
    'ui.info.modern.label': 'Nur Modern:',
    'ui.info.modern.body': 'Endwalze, Lückenfüller, Base-26, Auto-Spruchschlüssel. Spruch: ALBV (klar) · Kopf (Walze) · Message-ID (klar, 8) · Körper (Walze) · Prüfgruppe (HMAC, 20, nicht durch die Walzen).',
    'ui.info.sheet.label': 'Tafel:',
    'ui.info.sheet.body': 'JSON aus Alberich laden, Tafelwort vergleichen, Tag wählen.',
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
    'ui.thirdPartyLink': 'Hinweise Dritter',
    'ui.howto.label': 'Im Browser:',
    'ui.howto.body': 'markieren → Rechtsklick → „Alberich: … (Zwischenablage)“.',
    'ui.noSheet': 'Keine Tafel — bitte JSON laden',
    'ui.day': 'Tag',
    'ui.dayPlaceholder': 'Tag …',
    'ui.dayTitle': 'Tag wählen',
    'ui.dayTitleEmpty': 'Zuerst Monatstafel (JSON) laden',
    'ui.loadJson': 'JSON-Datei',
    'ui.loadJsonTitle': 'Monatstafel (alberich-codebook JSON)',
    'ui.clearSheet': 'Tafel entfernen',
    'ui.settingsSummary': 'Tagesschlüssel-Details',
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

    'status.noSheet': 'Keine Tafel — bitte JSON laden',
    'status.loaded': 'Tafel {ym} · Tag {day} · {plugs} Stecker · {layout}',
    'status.tafelwort': 'Tafelwort: {word}',
    'status.monthMismatch': 'Tafel ist {sheetMonth} – heute ist {todayMonth}.',
    'status.monthKeep': 'Trotzdem diesen Tag nutzen',
    'status.dayLabel': 'Tag {day}',
    'session.summaryBoth': '{mk} · Kopf {hd}',

    'day.tag': 'Tag {day}',
    'day.rotors': 'Walzen {thin} · {left} {middle} {right} ({layout})',
    'day.rings': 'Ringe {ringCode} · Grund {keyCode}',
    'day.endwalze': 'Endwalze {name} · {plugs} Stecker',
    'rotor.perm': 'PERM',
    'day.stecker': 'Stecker {plugboard}',
    'day.dora': 'EW-Dora-Belegung: {pairs}',

    'modern.noKey': 'Bitte Monatstafel (JSON) laden.',
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
    encryptOk: 'Verschlüsselt.',
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
    'ui.tagline': 'Modern · side panel',
    'ui.info': 'Info',
    'ui.infoTitle': 'Quick help',
    'ui.infoHeading': 'Quick help',
    'ui.info.modern.label': 'Modern only:',
    'ui.info.modern.body': 'end rotor, filler notches, Base-26, auto message key. Telegram: ALBV (clear) · header (rotor) · message ID (clear, 8) · body (rotor) · check group (HMAC, 20, not through the rotors).',
    'ui.info.sheet.label': 'Sheet:',
    'ui.info.sheet.body': 'Load Alberich JSON, compare the sheet word, pick the day.',
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
    'ui.thirdPartyLink': 'Third-party notices',
    'ui.howto.label': 'In the browser:',
    'ui.howto.body': 'select → right-click → “Alberich: … (clipboard)”.',
    'ui.noSheet': 'No sheet — please load JSON',
    'ui.day': 'Day',
    'ui.dayPlaceholder': 'Day …',
    'ui.dayTitle': 'Choose day',
    'ui.dayTitleEmpty': 'Load a monthly sheet (JSON) first',
    'ui.loadJson': 'JSON file',
    'ui.loadJsonTitle': 'Monthly sheet (alberich-codebook JSON)',
    'ui.clearSheet': 'Remove sheet',
    'ui.settingsSummary': 'Daily key details',
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

    'status.noSheet': 'No sheet — please load JSON',
    'status.loaded': 'Sheet {ym} · day {day} · {plugs} plugs · {layout}',
    'status.tafelwort': 'Sheet word: {word}',
    'status.monthMismatch': 'Sheet is {sheetMonth} — today is {todayMonth}.',
    'status.monthKeep': 'Keep this day',
    'status.dayLabel': 'Day {day}',
    'session.summaryBoth': '{mk} · header {hd}',

    'day.tag': 'Day {day}',
    'day.rotors': 'Rotors {thin} · {left} {middle} {right} ({layout})',
    'day.rings': 'Rings {ringCode} · ground {keyCode}',
    'day.endwalze': 'End rotor {name} · {plugs} plugs',
    'rotor.perm': 'PERM',
    'day.stecker': 'Plugs {plugboard}',
    'day.dora': 'EW-Dora wiring: {pairs}',

    'modern.noKey': 'Please load a monthly sheet (JSON).',
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
    encryptOk: 'Encrypted.',
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
