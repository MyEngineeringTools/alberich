/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Alberich Companion – Service Worker (MV3)
 */

import {
  createChromeStorage,
  createKeyManager,
} from '../shared/key-manager.js';
import { decryptModern, encryptModern } from '../shared/modern-ops.js';
import { loadLocale, t } from '../shared/i18n.js';
import { lettersFromInput } from '../shared/courier-qr.js';
import { loadCourierOn } from '../shared/courier-store.js';

const MENU_ENCRYPT = 'alberich-encrypt';
const MENU_DECRYPT = 'alberich-decrypt';
const MENU_COURIER_COPY = 'alberich-courier-copy';

const storage = createChromeStorage();
const keys = createKeyManager(storage);

/** Serialisiert Menü-Updates (kein paralleles removeAll/create). */
let menuChain = Promise.resolve();

/**
 * @param {() => Promise<void>} fn
 */
function enqueueMenu(fn) {
  menuChain = menuChain.then(fn).catch((e) => {
    console.warn('contextMenus', e);
  });
  return menuChain;
}

function promisify(fn) {
  return new Promise((resolve, reject) => {
    try {
      fn((result) => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function createMenu(id, title) {
  try {
    await promisify((cb) =>
      chrome.contextMenus.create({ id, title, contexts: ['selection'] }, cb),
    );
  } catch (e) {
    if (!/duplicate/i.test(String(e?.message || e))) throw e;
  }
}

async function ensureContextMenus() {
  await loadLocale(storage);
  const courierOn = await loadCourierOn(storage);

  try {
    await promisify((cb) => chrome.contextMenus.removeAll(cb));
  } catch {
    /* ignore */
  }

  if (courierOn) {
    await createMenu(MENU_COURIER_COPY, t('ui.menuCourierCopy'));
    return;
  }

  await createMenu(MENU_ENCRYPT, t('ui.menuEncrypt'));
  await createMenu(MENU_DECRYPT, t('ui.menuDecrypt'));
}

function refreshContextMenus() {
  return enqueueMenu(() => ensureContextMenus());
}

let setupOnce = null;

async function setupUi() {
  if (setupOnce) return setupOnce;
  setupOnce = (async () => {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.warn('sidePanel behavior', e);
    }
    await loadLocale(storage);
    await refreshContextMenus();
    await keys.load();
  })();
  try {
    await setupOnce;
  } finally {
    // erlauben erneutes setup nach SW-Sleep nur bei Bedarf
    // setupOnce bleibt gesetzt, damit parallele Aufrufe nicht doppelt create
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupOnce = null;
  setupUi();
});

chrome.runtime.onStartup?.addListener?.(() => {
  setupUi();
});

setupUi();

async function ensureOffscreen() {
  try {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    if (existing?.length) return;
  } catch {
    /* ignore */
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Write encrypt/decrypt result to clipboard',
    });
    await new Promise((r) => setTimeout(r, 50));
  } catch (e) {
    const msg = String(e?.message || e);
    if (!/already exists|Only a single/i.test(msg)) throw e;
  }
}

async function writeClipboard(text) {
  await ensureOffscreen();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'clipboardWrite', text },
      (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false, error: 'clipboard' });
      },
    );
  });
}

/**
 * @param {string} text
 * @param {'ok'|'err'} kind
 */
async function setBadge(text, kind) {
  await chrome.action.setBadgeText({ text: text.slice(0, 4) });
  await chrome.action.setBadgeBackgroundColor({
    color: kind === 'ok' ? '#0d9488' : '#b45309',
  });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2500);
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  await loadLocale(storage);
  const selection = String(info.selectionText || '').trim();
  if (!selection) {
    await setBadge('…', 'err');
    return;
  }

  if (info.menuItemId === MENU_COURIER_COPY) {
    const letters = lettersFromInput(selection);
    if (!letters) {
      await setBadge('Err', 'err');
      return;
    }
    const clip = await writeClipboard(letters);
    await setBadge(clip.ok ? 'OK' : 'Clip', clip.ok ? 'ok' : 'err');
    return;
  }

  if (await loadCourierOn(storage)) {
    await setBadge('Kur?', 'err');
    return;
  }

  await keys.load();
  const config = keys.getDayConfig();
  if (!config) {
    await setBadge('Key?', 'err');
    return;
  }

  let result;
  if (info.menuItemId === MENU_ENCRYPT) {
    result = await encryptModern(config, selection);
  } else if (info.menuItemId === MENU_DECRYPT) {
    result = await decryptModern(config, selection);
  } else {
    return;
  }

  if (!result.ok) {
    await chrome.storage.session.set({
      lastError: result.error,
      lastResult: null,
    });
    await setBadge('Err', 'err');
    return;
  }

  const out =
    info.menuItemId === MENU_ENCRYPT
      ? result.cipherGrouped || result.cipher
      : result.plainText;

  const clip = await writeClipboard(out);
  await chrome.storage.session.set({
    lastResult: out,
    lastError: null,
    lastAction: info.menuItemId === MENU_ENCRYPT ? 'encrypt' : 'decrypt',
  });

  await setBadge(clip.ok ? 'OK' : 'Clip', clip.ok ? 'ok' : 'err');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true, name: 'Alberich Companion' });
    return false;
  }
  if (msg?.type === 'localeChanged') {
    loadLocale(storage)
      .then(() => refreshContextMenus())
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'clipboardWrite') {
    return false;
  }
  return false;
});

// Nur storage-Listener — Panel sendet zusätzlich localeChanged; serialisiert via enqueue
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes['alberichCompanion.locale'] || changes['alberichCompanion.courierOn']) {
    loadLocale(storage).then(() => refreshContextMenus());
  }
});
