/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Endwalzen-Auswahl für Monatstafeln und Zufall ohne Tafel.
 *
 * dora     — nur Dora, freie 13-Paar-Verdrahtung (BO nicht fest)
 * mix      — Bruno, Caesar, Dora gemischt; Dora mit festem BO
 * historic — nur Bruno/Caesar (keine Dora)
 *
 * permutation — Modern V3, formatVersion 3
 * Vorauswahl: Modern → permutation, Traditionell → historic.
 * Fehlt das Feld auf einer alten Tafel, gilt das bisherige Mix-Verhalten.
 */

import {
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
} from './cipher-data.js';
import { isModern } from './operation-mode.js';

export const ENDWALZE_POLICY = Object.freeze({
  PERMUTATION: 'permutation',
  DORA: 'dora',
  MIX: 'mix',
  HISTORIC: 'historic',
});

/** Modern V3: freie Permutation + unabhängige Lückenfüller. */
export const ENDWALZE_POLICY_FORMAT_VERSION_V3 = 3;
/** Tafeln mit freier Dora (13 Paare) — alte Apps lehnen Version 2 ab. */
export const ENDWALZE_POLICY_FORMAT_VERSION = 2;
/** Mix / historisch: gleiches Tagesformat wie bisher. */
export const ENDWALZE_POLICY_FORMAT_VERSION_LEGACY = 1;

const POLICIES = new Set(Object.values(ENDWALZE_POLICY));

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseEndwalzePolicy(value) {
  const v = String(value || '').trim().toLowerCase();
  return POLICIES.has(v) ? v : null;
}

/**
 * Unbekannt / fehlend → Mix (bisheriges Generator-Verhalten).
 * @param {unknown} value
 */
export function normalizeEndwalzePolicy(value) {
  return parseEndwalzePolicy(value) || ENDWALZE_POLICY.MIX;
}

/**
 * Standard an der Tafel-Erzeugung.
 * Traditionell → Nur Bruno/Caesar (historisch korrekt).
 * Mix bleibt manuell wählbar.
 * @param {string | undefined} mainMode
 */
export function defaultEndwalzePolicyForMode(mainMode) {
  return isModern(mainMode) ? ENDWALZE_POLICY.PERMUTATION : ENDWALZE_POLICY.HISTORIC;
}

/**
 * @param {unknown} policy
 * @returns {string[]}
 */
export function reflectorIdsForPolicy(policy) {
  switch (normalizeEndwalzePolicy(policy)) {
    case ENDWALZE_POLICY.PERMUTATION:
      return [];
    case ENDWALZE_POLICY.DORA:
      return [REFLECTOR_ID_DORA];
    case ENDWALZE_POLICY.HISTORIC:
      return [REFLECTOR_ID_BRUNO, REFLECTOR_ID_CAESAR];
    default:
      return [REFLECTOR_ID_BRUNO, REFLECTOR_ID_CAESAR, REFLECTOR_ID_DORA];
  }
}

/**
 * @param {unknown} policy
 */
export function usesFreeDoraWiring(policy) {
  return parseEndwalzePolicy(policy) === ENDWALZE_POLICY.DORA;
}

/**
 * @param {unknown} policy
 */
export function usesPermutationEndwalze(policy) {
  return parseEndwalzePolicy(policy) === ENDWALZE_POLICY.PERMUTATION;
}

export function formatVersionForPolicy(policy) {
  if (usesPermutationEndwalze(policy)) return ENDWALZE_POLICY_FORMAT_VERSION_V3;
  return usesFreeDoraWiring(policy)
    ? ENDWALZE_POLICY_FORMAT_VERSION
    : ENDWALZE_POLICY_FORMAT_VERSION_LEGACY;
}

/**
 * @param {{ endwalzePolicy?: unknown } | null | undefined} sheet
 */
export function sheetUsesFreeDora(sheet) {
  return usesFreeDoraWiring(sheet?.endwalzePolicy);
}

/**
 * @param {{ endwalzePolicy?: unknown, formatVersion?: unknown } | null | undefined} sheet
 */
export function sheetUsesPermutationEndwalze(sheet) {
  return usesPermutationEndwalze(sheet?.endwalzePolicy)
    || Number(sheet?.formatVersion) >= ENDWALZE_POLICY_FORMAT_VERSION_V3;
}

export function pickRandomReflectorId(mainMode, pool, pickFn) {
  if (isModern(mainMode)) return REFLECTOR_ID_DORA;
  const ids = Array.isArray(pool) && pool.length ? pool : reflectorIdsForPolicy(ENDWALZE_POLICY.MIX);
  return pickFn(ids);
}

/**
 * Freie Permutation gehört zu Modern.
 * Mix / Nur Bruno/Caesar gehören zu Traditionell.
 * Nur Dora (altes Modern V2) passt zu keinem aktuellen Hauptmodus.
 * @param {unknown} policy
 * @param {string | undefined} mainMode
 */
export function policyFitsMainMode(policy, mainMode) {
  const p = normalizeEndwalzePolicy(policy);
  if (isModern(mainMode)) return p === ENDWALZE_POLICY.PERMUTATION;
  return p === ENDWALZE_POLICY.MIX || p === ENDWALZE_POLICY.HISTORIC;
}

/**
 * @param {unknown} policy
 * @param {(ids: string[]) => string} pickFn
 * @returns {string | null}
 */
export function pickReflectorIdForPolicy(policy, pickFn) {
  if (usesPermutationEndwalze(policy)) return null;
  const ids = reflectorIdsForPolicy(policy);
  return pickFn(ids);
}
