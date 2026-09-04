/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Alberich Mail Companion – Background
 *
 * Badge am Compose-Button: gültiger Tagesschlüssel geladen oder nicht.
 * Keine Netzwerkzugriffe, keine Telemetrie.
 */

import {
  createBrowserStorage,
  createKeyManager,
} from '../shared/key-manager.js';

const storage = createBrowserStorage();
const keys = createKeyManager(storage);

const api = globalThis.browser ?? globalThis.chrome;

/**
 * Badge / Tooltip an Compose- und Haupt-Action anpassen.
 */
async function refreshKeyBadge() {
  await keys.load();
  const st = keys.getStatusSummary();
  const loaded = !!st.loaded;
  const text = loaded ? 'OK' : '!';
  const color = loaded ? '#0d9488' : '#d97706';
  const title = loaded
    ? st.text
    : 'Alberich — keine Tafel (JSON laden)';

  const badge = { text, color };

  try {
    if (api.composeAction?.setBadgeText) {
      await api.composeAction.setBadgeText({ text: badge.text });
      await api.composeAction.setBadgeBackgroundColor({ color: badge.color });
      await api.composeAction.setTitle({ title });
    }
  } catch {
    /* ältere TB-Builds ohne Badge-API */
  }

  try {
    if (api.action?.setBadgeText) {
      await api.action.setBadgeText({ text: badge.text });
      await api.action.setBadgeBackgroundColor({ color: badge.color });
      await api.action.setTitle({ title });
    }
  } catch {
    /* ignore */
  }

  try {
    if (api.messageDisplayAction?.setBadgeText) {
      await api.messageDisplayAction.setBadgeText({ text: badge.text });
      await api.messageDisplayAction.setBadgeBackgroundColor({
        color: badge.color,
      });
      await api.messageDisplayAction.setTitle({ title });
    }
  } catch {
    /* ignore */
  }
}

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes['alberichCompanion.v1'] || changes['alberichCompanion.locale']) {
    refreshKeyBadge();
  }
});

/** @type {number|null} */
let importWindowId = null;
/** @type {number|null} */
let courierWindowId = null;

/**
 * Eigenes Fenster für JSON-Import (Popup würde beim Dateidialog sterben).
 */
async function openImportWindow() {
  const url = api.runtime.getURL('import/import.html');

  // Bestehendes Import-Fenster fokussieren statt viele zu öffnen
  if (importWindowId != null) {
    try {
      const w = await api.windows.get(importWindowId);
      if (w?.id != null) {
        await api.windows.update(w.id, { focused: true });
        return;
      }
    } catch {
      importWindowId = null;
    }
  }

  const opts = {
    url,
    type: 'popup',
    width: 460,
    height: 520,
  };
  let created;
  try {
    // Gecko: Script darf window.close() aufrufen
    created = await api.windows.create({ ...opts, allowScriptsToClose: true });
  } catch {
    created = await api.windows.create(opts);
  }
  importWindowId = created?.id ?? null;
}

async function openCourierWindow() {
  const url = api.runtime.getURL('courier/courier.html');
  if (courierWindowId != null) {
    try {
      const w = await api.windows.get(courierWindowId);
      if (w?.id != null) {
        await api.windows.update(w.id, { focused: true });
        return;
      }
    } catch {
      courierWindowId = null;
    }
  }
  const opts = { url, type: 'popup', width: 420, height: 640 };
  let created;
  try {
    created = await api.windows.create({ ...opts, allowScriptsToClose: true });
  } catch {
    created = await api.windows.create(opts);
  }
  courierWindowId = created?.id ?? null;
}

api.windows?.onRemoved?.addListener((windowId) => {
  if (windowId === importWindowId) importWindowId = null;
  if (windowId === courierWindowId) courierWindowId = null;
});

api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'openImport') {
    return openImportWindow().then(() => ({ ok: true }));
  }
  if (msg?.type === 'openCourier') {
    return openCourierWindow().then(() => ({ ok: true }));
  }
  return undefined;
});

// Start
refreshKeyBadge();
