/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * UI-Sprachen DE / EN für Alberich Companion.
 */

/** @typedef {'de'|'en'} Locale */

/** @type {Record<Locale, Record<string, string>>} */
export const STRINGS = {
  de: {
    'ui.tagline': 'Modern · Thunderbird',
    'ui.info': 'Info',
    'ui.infoTitle': 'Kurzhilfe',
    'ui.infoHeading': 'Kurzhilfe',
    'ui.info.modern.label': 'Nur Modern:',
    'ui.info.modern.body': 'Endwalze, Lückenfüller, Base-26, Auto-Spruchschlüssel. Spruch: ALBV (klar) · Kopf (Walze) · Message-ID (klar, 8) · Körper (Walze) · Prüfgruppe (HMAC, 20).',
    'ui.info.sheet.label': 'Tafel:',
    'ui.info.sheet.body': '„Codebook laden“ → Datei oder JSON einfügen, Tag wählen.',
    'ui.info.send.label': 'Verschlüsseln:',
    'ui.info.send.body':
      'Text aus dem Schreiben-Fenster holen, verschlüsseln, Geheimtext zurückschreiben.',
    'ui.info.recv.label': 'Entschlüsseln:',
    'ui.info.recv.body':
      'Im Schreiben-Fenster: zurückschreiben. Bei gelesener Mail: Klartext in neuem Tab.',
    'ui.info.browser.label': 'Compose:',
    'ui.info.browser.body': 'Immer im Schreiben-Fenster: ein Knopf, hin und zurück.',
    'ui.info.local.label': 'Lokal:',
    'ui.info.local.body': 'Alles bleibt lokal — kein Upload, keine Telemetrie.',
    'ui.info.fullApp': 'Volle Walzen-UI und Traditionell-Modus:',
    'ui.info.codebook': 'Codebook:',
    'ui.demoHeading': 'Demo-Tafel V3',
    'ui.demoWarn':
      'Öffentliche Modern-V3-Tafel (ALBV, formatVersion 3). Nicht geheim. Tafelwort CPTZ YYH. Tag 16 = Goldtag.',
    'ui.demoLoad': 'V3-Demo-Tafel laden',
    'ui.demoLoaded': 'V3-Demo-Tafel geladen (nicht produktiv).',
    'ui.demoFailed': 'Demo-Tafel konnte nicht geladen werden.',
    'ui.imprint': 'Impressum',
    'ui.thirdParty':
      'QR: qrcode-generator (MIT, Kazuhiko Arase), jsQR (Apache-2.0, Cosmo Wolfe). „QR Code“ ist eine Marke von DENSO WAVE.',
    'ui.thirdPartyLink': 'Hinweise Dritter',
    'ui.emailLabel': 'E-Mail:',
    'ui.howto.label': 'So geht’s:',
    'ui.howto.body':
      'Schreiben: ver-/entschlüsseln im Fenster. Empfangene Mail: Entschlüsseln → Klartext-Tab.',
    'ui.noCompose': 'Bitte zuerst eine neue Nachricht öffnen (Schreiben-Fenster).',
    'ui.noMessage': 'Keine Nachricht geöffnet — Mail in der Vorschau anzeigen.',
    'ui.noMessageApi': 'Nachrichten-API nicht verfügbar (Thunderbird zu alt?).',
    'ui.messageReadFailed': 'Nachricht konnte nicht gelesen werden.',
    'ui.noSource':
      'Kein Text gefunden — Schreiben-Fenster oder empfangene Mail öffnen.',
    'ui.composeStatusOk': 'Schreiben-Fenster bereit',
    'ui.messageStatusOk': 'Gelesene Mail bereit (Entschlüsseln → neuer Tab)',
    'ui.sourceStatusNo':
      'Kein Schreiben-Fenster und keine Mail — bitte Nachricht öffnen',
    'ui.encryptNeedsCompose': 'Verschlüsseln nur im Schreiben-Fenster.',
    'ui.encryptDone': 'Verschlüsselt und ins Schreiben-Fenster geschrieben.',
    'ui.decryptDone': 'Entschlüsselt und ins Schreiben-Fenster geschrieben.',
    'ui.decryptOpenedTab': 'Entschlüsselt — Klartext in neuem Tab.',
    'ui.resultTabFailed': 'Klartext-Tab konnte nicht geöffnet werden.',
    'ui.encryptTitle':
      'Text aus dem Schreiben-Fenster holen, verschlüsseln, zurückschreiben',
    'ui.decryptTitle':
      'Geheimtext holen und entschlüsseln (Compose → zurück, Mail → neuer Tab)',
    'result.title': 'Alberich — Klartext',
    'result.note':
      'Die Original-Mail bleibt unverändert. Dieser Tab ist nur lokal in der Extension.',
    'result.copy': 'Kopieren',
    'result.empty': 'Kein Klartext vorhanden. Bitte erneut entschlüsseln.',
    'ui.noSheet': 'Keine Tafel — bitte Codebook laden',
    'ui.day': 'Tag',
    'ui.dayPlaceholder': 'Tag …',
    'ui.dayTitle': 'Tag wählen',
    'ui.dayTitleEmpty': 'Zuerst Codebook (JSON) laden',
    'ui.loadJson': 'Codebook laden',
    'ui.loadJsonTitle': 'Monatstafel (JSON) — öffnet Import-Fenster',
    'ui.clearSheet': 'Tafel entfernen',
    'import.title': 'Alberich — Codebook laden',
    'import.sub':
      'JSON aus Alberich (alberich.pro) wählen oder einfügen. Dieses Fenster bleibt geöffnet, damit der Dateidialog funktioniert.',
    'import.pickFile': 'JSON-Datei wählen…',
    'import.orPaste': 'oder JSON hier einfügen:',
    'import.pastePlaceholder': '{ "format": "alberich-codebook", … }',
    'import.applyPaste': 'Eingefügtes JSON übernehmen',
    'import.close': 'Schließen',
    'import.success': 'Tafel gespeichert. Fenster schließt…',
    'import.readFailed': 'Datei konnte nicht gelesen werden.',
    'import.openFailed': 'Import-Fenster konnte nicht geöffnet werden.',
    'ui.messageKey': 'Spruchschlüssel',
    'ui.headerGroup': 'Kopfgruppe',
    'ui.stamp': 'Stempel',
    'ui.messageId': 'Message-ID',
    'ui.pruefgruppe': 'Prüfgruppe',
    'ui.sessionLegend':
      'ALBV und Message-ID klar. Kopf = verschlüsselter Spruchschlüssel. Prüfgruppe = HMAC-Siegel.',
    'ui.encrypt': 'Verschlüsseln',
    'ui.decrypt': 'Entschlüsseln',
    'ui.footer': 'Lokal · Modern · #ChatkontrolleAde',
    'ui.clipboardUnavailable': 'Zwischenablage nicht verfügbar.',
    'ui.clipboardEmpty': 'Zwischenablage ist leer.',
    'ui.clipboardBlocked':
      'Zwischenablage gesperrt — Strg+V im Textfeld nutzen oder Berechtigung erlauben.',
    'ui.menuEncrypt': 'Alberich: Verschlüsseln (Zwischenablage)',
    'ui.menuDecrypt': 'Alberich: Entschlüsseln (Zwischenablage)',
    'ui.langDe': 'DE',
    'ui.langEn': 'EN',
    'ui.langTitle': 'Sprache',

    'status.noSheet': 'Keine Tafel — bitte JSON laden',
    'status.loaded': 'Tafel {ym} · Tag {day} · {plugs} Stecker · {layout}',
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
    'courier.warnApproaching':
      'Kurier-QR wird lang: {count} von {max} Geheimtext-Buchstaben. Noch ein scannbarer Code — lieber nicht weiter wachsen lassen. Ohne Kurier-Verfahren kannst du die Meldung ignorieren.',
    'courier.warnOver':
      'Zu lang für einen Kurier-QR ({count} / {max} Geheimtext-Buchstaben). Kürzen oder in zwei Sendungen teilen. Ohne Kurier-Verfahren kannst du die Meldung ignorieren.',
    encryptOk: 'Verschlüsselt.',
    decryptOk: 'Entschlüsselt.',
    copied: 'In Zwischenablage kopiert.',
    pasted: 'Aus Zwischenablage eingefügt.',
    cleared: 'Gelöscht.',
    sheetLoaded: 'Tafel geladen.',
    sheetCleared: 'Tafel entfernt.',
    emptyInput: 'Kein Text.',
  },
  en: {
    'ui.tagline': 'Modern · Thunderbird',
    'ui.info': 'Info',
    'ui.infoTitle': 'Quick help',
    'ui.infoHeading': 'Quick help',
    'ui.info.modern.label': 'Modern only:',
    'ui.info.modern.body': 'end rotor, filler notches, Base-26, auto message key. Telegram: ALBV (clear) · header (rotor) · message ID (clear, 8) · body (rotor) · check group (HMAC, 20).',
    'ui.info.sheet.label': 'Sheet:',
    'ui.info.sheet.body': '“Load codebook” → file or paste JSON, pick the day.',
    'ui.info.send.label': 'Encrypt:',
    'ui.info.send.body':
      'Take text from the write window, encrypt, write ciphertext back.',
    'ui.info.recv.label': 'Decrypt:',
    'ui.info.recv.body':
      'In the write window: write back. For a received mail: plaintext in a new tab.',
    'ui.info.browser.label': 'Compose:',
    'ui.info.browser.body': 'Always in the write window: one button, there and back.',
    'ui.info.local.label': 'Local:',
    'ui.info.local.body': 'Everything stays local — no upload, no telemetry.',
    'ui.info.fullApp': 'Full rotor UI and Traditional mode:',
    'ui.info.codebook': 'Codebook:',
    'ui.demoHeading': 'V3 demo sheet',
    'ui.demoWarn':
      'Public Modern V3 sheet (ALBV, formatVersion 3). Not secret. Sheet word CPTZ YYH. Day 16 is the golden day.',
    'ui.demoLoad': 'Load V3 demo sheet',
    'ui.demoLoaded': 'V3 demo sheet loaded (not for production).',
    'ui.demoFailed': 'Could not load the demo sheet.',
    'ui.imprint': 'Legal notice',
    'ui.thirdParty':
      'QR: qrcode-generator (MIT, Kazuhiko Arase), jsQR (Apache-2.0, Cosmo Wolfe). “QR Code” is a trademark of DENSO WAVE.',
    'ui.thirdPartyLink': 'Third-party notices',
    'ui.emailLabel': 'Email:',
    'ui.howto.label': 'How to:',
    'ui.howto.body':
      'Write: encrypt/decrypt in the window. Received mail: Decrypt → plaintext tab.',
    'ui.noCompose': 'Please open a new message first (write window).',
    'ui.noMessage': 'No message open — select a mail in the preview.',
    'ui.noMessageApi': 'Messages API unavailable (Thunderbird too old?).',
    'ui.messageReadFailed': 'Could not read the message.',
    'ui.noSource':
      'No text found — open the write window or a received mail.',
    'ui.composeStatusOk': 'Write window ready',
    'ui.messageStatusOk': 'Received mail ready (Decrypt → new tab)',
    'ui.sourceStatusNo':
      'No write window and no mail — please open a message',
    'ui.encryptNeedsCompose': 'Encrypt only works in the write window.',
    'ui.encryptDone': 'Encrypted and written to the write window.',
    'ui.decryptDone': 'Decrypted and written to the write window.',
    'ui.decryptOpenedTab': 'Decrypted — plaintext opened in a new tab.',
    'ui.resultTabFailed': 'Could not open the plaintext tab.',
    'ui.encryptTitle':
      'Take text from the write window, encrypt, write back',
    'ui.decryptTitle':
      'Take ciphertext and decrypt (compose → write back, mail → new tab)',
    'result.title': 'Alberich — plaintext',
    'result.note':
      'The original mail is unchanged. This tab is local to the extension only.',
    'result.copy': 'Copy',
    'result.empty': 'No plaintext available. Please decrypt again.',
    'ui.noSheet': 'No sheet — please load codebook',
    'ui.day': 'Day',
    'ui.dayPlaceholder': 'Day …',
    'ui.dayTitle': 'Choose day',
    'ui.dayTitleEmpty': 'Load a codebook (JSON) first',
    'ui.loadJson': 'Load codebook',
    'ui.loadJsonTitle': 'Monthly sheet (JSON) — opens import window',
    'ui.clearSheet': 'Remove sheet',
    'import.title': 'Alberich — load codebook',
    'import.sub':
      'Choose or paste JSON from Alberich (alberich.pro). This window stays open so the file dialog works.',
    'import.pickFile': 'Choose JSON file…',
    'import.orPaste': 'or paste JSON here:',
    'import.pastePlaceholder': '{ "format": "alberich-codebook", … }',
    'import.applyPaste': 'Import pasted JSON',
    'import.close': 'Close',
    'import.success': 'Sheet saved. Closing…',
    'import.readFailed': 'Could not read the file.',
    'import.openFailed': 'Could not open the import window.',
    'ui.messageKey': 'Message key',
    'ui.headerGroup': 'Header group',
    'ui.stamp': 'Stamp',
    'ui.messageId': 'Message ID',
    'ui.pruefgruppe': 'Check group',
    'ui.sessionLegend':
      'ALBV and message ID in the clear. Header = encrypted message key. Check group = HMAC tag.',
    'ui.encrypt': 'Encrypt',
    'ui.decrypt': 'Decrypt',
    'ui.footer': 'Local · Modern · #ChatcontrolByeBye',
    'ui.clipboardUnavailable': 'Clipboard unavailable.',
    'ui.clipboardEmpty': 'Clipboard is empty.',
    'ui.clipboardBlocked':
      'Clipboard blocked — use Ctrl+V in the field or allow the permission.',
    'ui.menuEncrypt': 'Alberich: Encrypt (clipboard)',
    'ui.menuDecrypt': 'Alberich: Decrypt (clipboard)',
    'ui.langDe': 'DE',
    'ui.langEn': 'EN',
    'ui.langTitle': 'Language',

    'status.noSheet': 'No sheet — please load JSON',
    'status.loaded': 'Sheet {ym} · day {day} · {plugs} plugs · {layout}',
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
    'courier.warnApproaching':
      'Courier QR is getting long: {count} of {max} ciphertext letters. Still one scannable code — keep it short. You can ignore this if you are not using courier.',
    'courier.warnOver':
      'Too long for one courier QR ({count} / {max} ciphertext letters). Shorten it, or send two messages. You can ignore this if you are not using courier.',
    encryptOk: 'Encrypted.',
    decryptOk: 'Decrypted.',
    copied: 'Copied to clipboard.',
    pasted: 'Pasted from clipboard.',
    cleared: 'Cleared.',
    sheetLoaded: 'Sheet loaded.',
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
