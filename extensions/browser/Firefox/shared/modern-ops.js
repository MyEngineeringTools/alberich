/**
 * Modern-Modus: Engine aus Tagesschlüssel konfigurieren + Encrypt/Decrypt-Payloads.
 * DOM-frei, nutzbar aus Popup und Service Worker.
 */

import { CipherEngine } from './crypto/cipher-engine.js';
import {
  MIN_STECKER_PAIRS,
  randomMessageKey4,
} from './crypto/modern-crypto.js';
import { REFLECTOR_ID_DORA } from './crypto/cipher-data.js';
import { extractLetters, formatGroupedOutput } from './codebook/key-codes.js';
import {
  modernV3DecryptPayload,
  modernV3EncryptPayload,
  randomMessageId,
  resolveV3Epoch,
  validateLueckenfueller,
} from './crypto/modern-v3.js';

/**
 * @typedef {object} DayMachineConfig
 * @property {string} reflectorId
 * @property {string} rotorThin
 * @property {string} rotorLeft
 * @property {string} rotorMiddle
 * @property {string} rotorRight
 * @property {string} ringCode
 * @property {string} ringLeft
 * @property {string} ringMiddle
 * @property {string} ringRight
 * @property {string} keyCode
 * @property {string} posThin
 * @property {string} posLeft
 * @property {string} posMiddle
 * @property {string} posRight
 * @property {string} plugboard
 * @property {string} [reflectorD]
 */

/**
 * @param {CipherEngine} engine
 * @param {DayMachineConfig} config
 * @param {string} keyCode4
 * @returns {{ ok: true } | { ok: false, error: string, plugCount?: number }}
 */
function isV3Config(config) {
  return Boolean(config?.endwalzeWiring && validateLueckenfueller(config.lueckenfueller || config.notches).ok);
}

function v3DayAuthConfig(config) {
  return {
    ...config,
    notches: config.lueckenfueller || config.notches,
    networkContext: config.networkContext || 'ALB',
    epoch: resolveV3Epoch({
      date: config.epoch || config.date,
      year: config.year,
      month: config.month,
      day: config.day,
    }),
  };
}

export function configureModernEngine(engine, config, keyCode4) {
  const code = String(keyCode4 ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (code.length !== 4) {
    return { ok: false, error: 'modern.groundIncomplete' };
  }

  const positions = [...code];
  if (config.reflectorId === REFLECTOR_ID_DORA) {
    engine.setReflectorD(config.reflectorD || '');
  } else {
    engine.setReflector(config.reflectorId);
  }

  engine.setRotors(
    config.rotorLeft,
    config.rotorMiddle,
    config.rotorRight,
    config.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    config.ringLeft,
    config.ringMiddle,
    config.ringRight,
  );
  engine.setPlugboard(config.plugboard || '');

  if (!isV3Config(config)) {
    engine.setCryptoMode('traditional');
    return { ok: false, error: 'modern.needPermutation' };
  }

  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setThinRing(config.ringThin || (config.ringCode || 'A')[0]);
  engine.setEndwalze(config.endwalzeWiring);
  engine.setLueckenfuellerNotches(config.lueckenfueller || config.notches);
  return { ok: true };
}

/**
 * @param {DayMachineConfig} config
 * @param {string} plainText
 * @param {string} [messageKey]
 */
export async function encryptModern(config, plainText, messageKey) {
  if (!config?.keyCode) {
    return { ok: false, error: 'modern.noKey' };
  }
  const engine = new CipherEngine();
  const mk =
    messageKey && /^[A-Z]{4}$/.test(messageKey) ? messageKey : randomMessageKey4();

  if (!isV3Config(config)) {
    return { ok: false, error: 'modern.needPermutation' };
  }
  const result = await modernV3EncryptPayload({
    engine,
    configure: (code) => configureModernEngine(engine, config, code).ok,
    groundKey: config.keyCode,
    plainText: String(plainText ?? ''),
    messageKey: mk,
    messageId: config.messageId || randomMessageId(),
    dayConfig: v3DayAuthConfig(config),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    cipher: result.cipher,
    cipherGrouped: formatGroupedOutput(result.cipher),
    header: result.header,
    messageKey: result.messageKey,
    messageId: result.messageId,
    pruefgruppe: result.pruefgruppe,
  };
}

/**
 * @param {DayMachineConfig} config
 * @param {string} cipherText
 */
export async function decryptModern(config, cipherText) {
  if (!config?.keyCode) {
    return { ok: false, error: 'modern.noKey' };
  }
  const engine = new CipherEngine();
  const letters = extractLetters(cipherText);

  if (!isV3Config(config)) {
    return { ok: false, error: 'modern.needPermutation' };
  }
  if (!letters.startsWith('ALBV')) {
    return { ok: false, error: letters.length < 36 ? 'modern.v3TooShort' : 'modern.notV3' };
  }
  const result = await modernV3DecryptPayload({
    engine,
    configure: (code) => configureModernEngine(engine, config, code).ok,
    groundKey: config.keyCode,
    cipherLetters: letters,
    dayConfig: v3DayAuthConfig(config),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    plainText: result.plainText,
    header: result.header,
    messageKey: result.messageKey,
    messageId: result.messageId,
    pruefgruppe: result.pruefgruppe,
  };
}

export { MIN_STECKER_PAIRS, extractLetters, formatGroupedOutput };
