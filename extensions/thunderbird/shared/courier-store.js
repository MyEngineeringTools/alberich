/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Kurier-Schalter und Geheimtext-Entwurf (Default: aus).
 */

export const COURIER_ON_KEY = 'alberichCompanion.courierOn';
export const COURIER_DRAFT_KEY = 'alberichCompanion.courierDraft';
export const COURIER_INTENT_KEY = 'alberichCompanion.courierIntent';

/**
 * @param {{ get: Function }} storage
 * @returns {Promise<boolean>}
 */
export async function loadCourierOn(storage) {
  try {
    const data = await storage.get(COURIER_ON_KEY);
    return data?.[COURIER_ON_KEY] === true;
  } catch {
    return false;
  }
}

/**
 * @param {{ set: Function }} storage
 * @param {boolean} on
 */
export async function saveCourierOn(storage, on) {
  await storage.set({ [COURIER_ON_KEY]: on === true });
}

/**
 * @param {{ get: Function }} storage
 * @returns {Promise<string>}
 */
export async function loadCourierDraft(storage) {
  try {
    const data = await storage.get(COURIER_DRAFT_KEY);
    return typeof data?.[COURIER_DRAFT_KEY] === 'string' ? data[COURIER_DRAFT_KEY] : '';
  } catch {
    return '';
  }
}

/**
 * @param {{ set: Function }} storage
 * @param {string} letters
 */
export async function saveCourierDraft(storage, letters) {
  await storage.set({ [COURIER_DRAFT_KEY]: String(letters || '') });
}

/**
 * @param {{ get: Function }} storage
 * @returns {Promise<'show'|'scan'|'pick'|''>}
 */
export async function loadCourierIntent(storage) {
  try {
    const data = await storage.get(COURIER_INTENT_KEY);
    const raw = data?.[COURIER_INTENT_KEY];
    return raw === 'show' || raw === 'scan' || raw === 'pick' ? raw : '';
  } catch {
    return '';
  }
}

/**
 * @param {{ set: Function }} storage
 * @param {'show'|'scan'|'pick'|''} intent
 */
export async function saveCourierIntent(storage, intent) {
  await storage.set({ [COURIER_INTENT_KEY]: intent || '' });
}
