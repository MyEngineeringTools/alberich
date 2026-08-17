/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Mehrere Schlüsseltafel-Netze (bis MAX_NETWORKS) in der Web-App.
 * Jedes Netz hat Name + optional eine Monatstafel (alberich-codebook).
 */

import { parseCodebookJson, findCodebookDay, defaultCodebookDay } from './codebook.js';

export const MAX_NETWORKS = 5;
export const DEFAULT_NETWORK_NAME = 'My network';

/**
 * @typedef {import('./codebook.js').CodebookSheet} CodebookSheet
 */

/**
 * @typedef {object} Network
 * @property {string} id
 * @property {string} name
 * @property {CodebookSheet | null} sheet
 * @property {number} selectedDay
 * @property {string} [source]
 * @property {string} [updatedAt]
 */

/**
 * @returns {string}
 */
export function createNetworkId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `net-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {{ name?: string, sheet?: CodebookSheet | null, selectedDay?: number, source?: string }} [opts]
 * @returns {Network}
 */
export function createNetwork(opts = {}) {
  const sheet = opts.sheet ?? null;
  let selectedDay = Number(opts.selectedDay) || 1;
  if (sheet) {
    if (!findCodebookDay(sheet, selectedDay)) {
      selectedDay = defaultCodebookDay(sheet);
    }
  }
  const name = sanitizeNetworkName(opts.name) || DEFAULT_NETWORK_NAME;
  return {
    id: createNetworkId(),
    name,
    sheet,
    selectedDay,
    source: typeof opts.source === 'string' ? opts.source : '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeNetworkName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 40);
}

/**
 * @param {Network[]} networks
 * @param {string} activeId
 * @returns {Network | null}
 */
export function findNetwork(networks, activeId) {
  if (!Array.isArray(networks) || !networks.length) return null;
  return networks.find((n) => n.id === activeId) ?? networks[0] ?? null;
}

/**
 * @param {Network[]} networks
 * @returns {boolean}
 */
export function canAddNetwork(networks) {
  return Array.isArray(networks) && networks.length < MAX_NETWORKS;
}

/**
 * Tafel eines Netzes parsen/validieren (nach localStorage-Load).
 * @param {Network} network
 * @returns {Network}
 */
export function normalizeNetwork(network) {
  const name = sanitizeNetworkName(network?.name) || DEFAULT_NETWORK_NAME;
  const id = typeof network?.id === 'string' && network.id ? network.id : createNetworkId();
  let sheet = null;
  let selectedDay = 1;
  let source = typeof network?.source === 'string' ? network.source : '';

  if (network?.sheet) {
    const checked = parseCodebookJson(network.sheet);
    if (checked.ok) {
      sheet = checked.sheet;
      selectedDay = Number(network.selectedDay);
      if (!findCodebookDay(sheet, selectedDay)) {
        selectedDay = defaultCodebookDay(sheet);
      }
    }
  }

  return {
    id,
    name,
    sheet,
    selectedDay,
    source,
    updatedAt: typeof network?.updatedAt === 'string' ? network.updatedAt : '',
  };
}

/**
 * Aus altem Einzel-Tafel-State oder leerem Start ein Netze-Array bauen.
 * @param {{ codebookSheet?: unknown, codebookDay?: unknown, networks?: unknown, activeNetworkId?: unknown }} merged
 * @returns {{ networks: Network[], activeNetworkId: string, codebookSheet: CodebookSheet | null, codebookDay: number }}
 */
export function migrateNetworksState(merged) {
  let networks = [];

  if (Array.isArray(merged.networks) && merged.networks.length > 0) {
    networks = merged.networks.slice(0, MAX_NETWORKS).map((n) => normalizeNetwork(n));
  } else {
    // Legacy: eine globale Tafel → ein Netz
    let sheet = null;
    let day = 1;
    if (merged.codebookSheet) {
      const checked = parseCodebookJson(merged.codebookSheet);
      if (checked.ok) {
        sheet = checked.sheet;
        day = Number(merged.codebookDay);
        if (!findCodebookDay(sheet, day)) day = defaultCodebookDay(sheet);
      }
    }
    networks = [
      createNetwork({
        name: DEFAULT_NETWORK_NAME,
        sheet,
        selectedDay: day,
      }),
    ];
  }

  if (networks.length === 0) {
    networks = [createNetwork({ name: DEFAULT_NETWORK_NAME })];
  }

  let activeNetworkId =
    typeof merged.activeNetworkId === 'string' ? merged.activeNetworkId : '';
  if (!networks.some((n) => n.id === activeNetworkId)) {
    activeNetworkId = networks[0].id;
  }

  const active = findNetwork(networks, activeNetworkId);
  return {
    networks,
    activeNetworkId: active.id,
    codebookSheet: active.sheet,
    codebookDay: active.selectedDay,
  };
}

/**
 * Aktive Tafel/Tag zurück ins Netze-Array schreiben.
 * @param {Network[]} networks
 * @param {string} activeNetworkId
 * @param {CodebookSheet | null} sheet
 * @param {number} day
 * @param {string} [source]
 * @returns {Network[]}
 */
export function syncActiveIntoNetworks(networks, activeNetworkId, sheet, day, source) {
  const now = new Date().toISOString();
  return networks.map((n) => {
    if (n.id !== activeNetworkId) return n;
    let selectedDay = Number(day) || 1;
    if (sheet && !findCodebookDay(sheet, selectedDay)) {
      selectedDay = defaultCodebookDay(sheet);
    }
    return {
      ...n,
      sheet: sheet ?? null,
      selectedDay: sheet ? selectedDay : 1,
      source: source !== undefined ? source : n.source,
      updatedAt: now,
    };
  });
}

/**
 * @param {Network[]} networks
 * @param {string} id
 * @param {string} name
 * @returns {Network[] | null} null wenn Name ungültig
 */
export function renameNetworkInList(networks, id, name) {
  const cleaned = sanitizeNetworkName(name);
  if (!cleaned) return null;
  return networks.map((n) => (n.id === id ? { ...n, name: cleaned, updatedAt: new Date().toISOString() } : n));
}

/**
 * @param {Network[]} networks
 * @param {string} id
 * @returns {{ networks: Network[], removed: boolean, nextActiveId: string | null }}
 */
export function removeNetworkFromList(networks, id) {
  if (!Array.isArray(networks) || networks.length <= 1) {
    return { networks, removed: false, nextActiveId: null };
  }
  const next = networks.filter((n) => n.id !== id);
  if (next.length === networks.length) {
    return { networks, removed: false, nextActiveId: null };
  }
  return {
    networks: next,
    removed: true,
    nextActiveId: next[0]?.id ?? null,
  };
}

/**
 * Tafel im Netz leeren, Name bleibt.
 * @param {Network[]} networks
 * @param {string} id
 * @returns {Network[]}
 */
export function clearNetworkSheetInList(networks, id) {
  const now = new Date().toISOString();
  return networks.map((n) =>
    n.id === id
      ? { ...n, sheet: null, selectedDay: 1, source: '', updatedAt: now }
      : n,
  );
}

/**
 * Alle Monatstafeln leeren. Netze bleiben.
 * @param {Network[]} networks
 * @returns {Network[]}
 */
export function clearAllNetworkSheets(networks) {
  const now = new Date().toISOString();
  return (networks || []).map((n) =>
    n.sheet
      ? { ...n, sheet: null, selectedDay: 1, source: '', updatedAt: now }
      : n,
  );
}
