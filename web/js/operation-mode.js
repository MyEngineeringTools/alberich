/**
 * Betriebmodus von Alberich (Web).
 *
 * Zwei Hauptmodi:
 * - traditional: historisches Enigma-Verhalten (involutorisch, A–Z)
 *   mit Unteroptionen simple | message (Spruchschlüssel)
 * - modern: Endwalze + Lückenfüller + Base-26 + automatischer Spruchschlüssel
 *
 * Persistenz: mainMode + keyMode in localStorage (settings-v1).
 * Abwärtskompatibel: fehlendes mainMode → traditional; keyMode unverändert.
 */

/** @typedef {'traditional' | 'modern'} MainMode */
/** @typedef {'simple' | 'message'} KeyMode */

export const MAIN_MODE = /** @type {const} */ ({
  TRADITIONAL: 'traditional',
  MODERN: 'modern',
});

export const KEY_MODE = /** @type {const} */ ({
  SIMPLE: 'simple',
  MESSAGE: 'message',
});

/**
 * @typedef {object} ModeCapabilities
 * @property {boolean} historicalInvolutory  Historisches reziprokes Verhalten
 * @property {boolean} alphabetAzOnly        Nur A–Z (kein Base-26)
 * @property {boolean} traditionalProcedures Einfach/Spruchschlüssel wählbar
 * @property {boolean} endwalze
 * @property {boolean} lueckenfueller
 * @property {boolean} base26
 * @property {boolean} autoMessageKey
 */

/**
 * Gespeicherten Hauptmodus normalisieren.
 * Explizit „modern“ → modern; alles andere inkl. fehlend → traditional
 * (Abwärtskompatibel für bestehende localStorage-Installationen).
 * Frischer Default ohne Speicher: siehe DEFAULT_STATE.mainMode in app.js (modern).
 *
 * @param {unknown} value
 * @returns {MainMode}
 */
export function normalizeMainMode(value) {
  return value === MAIN_MODE.MODERN ? MAIN_MODE.MODERN : MAIN_MODE.TRADITIONAL;
}

/**
 * @param {unknown} value
 * @returns {KeyMode}
 */
export function normalizeKeyMode(value) {
  return value === KEY_MODE.MESSAGE ? KEY_MODE.MESSAGE : KEY_MODE.SIMPLE;
}

/**
 * @param {MainMode | string | undefined} mainMode
 * @returns {boolean}
 */
export function isTraditional(mainMode) {
  return normalizeMainMode(mainMode) === MAIN_MODE.TRADITIONAL;
}

/**
 * @param {MainMode | string | undefined} mainMode
 * @returns {boolean}
 */
export function isModern(mainMode) {
  return normalizeMainMode(mainMode) === MAIN_MODE.MODERN;
}

/**
 * Feature-Flags nach Hauptmodus.
 *
 * @param {MainMode | string | undefined} mainMode
 * @returns {ModeCapabilities}
 */
export function getModeCapabilities(mainMode) {
  const modern = isModern(mainMode);
  return {
    historicalInvolutory: !modern,
    alphabetAzOnly: !modern,
    traditionalProcedures: !modern,
    endwalze: modern,
    lueckenfueller: modern,
    base26: modern,
    autoMessageKey: modern,
  };
}

/**
 * Manuelles Spruchschlüsselverfahren (Traditionell · Spruchschlüssel).
 *
 * @param {{ mainMode?: string, keyMode?: string }} state
 * @returns {boolean}
 */
export function usesTraditionalMessageKey(state) {
  return isTraditional(state?.mainMode) && normalizeKeyMode(state?.keyMode) === KEY_MODE.MESSAGE;
}

/**
 * Aktiver Chiffre-Pfad-Label.
 * @param {{ mainMode?: string, keyMode?: string }} state
 * @returns {'simple' | 'message' | 'modern'}
 */
export function getActiveCipherProcedure(state) {
  if (isModern(state?.mainMode)) return 'modern';
  return usesTraditionalMessageKey(state) ? KEY_MODE.MESSAGE : KEY_MODE.SIMPLE;
}

/**
 * Stabile ID für Anzeige/Analytics: traditional-simple | traditional-message | modern
 *
 * @param {{ mainMode?: string, keyMode?: string }} state
 * @returns {'traditional-simple' | 'traditional-message' | 'modern'}
 */
export function getModeProfileId(state) {
  if (isModern(state?.mainMode)) return 'modern';
  return normalizeKeyMode(state?.keyMode) === KEY_MODE.MESSAGE
    ? 'traditional-message'
    : 'traditional-simple';
}

/**
 * Gespeicherte Felder normalisieren (Load/Migration).
 *
 * @param {Record<string, unknown>} partial
 * @returns {{ mainMode: MainMode, keyMode: KeyMode }}
 */
export function normalizeModeFields(partial) {
  return {
    mainMode: normalizeMainMode(partial?.mainMode),
    keyMode: normalizeKeyMode(partial?.keyMode),
  };
}
