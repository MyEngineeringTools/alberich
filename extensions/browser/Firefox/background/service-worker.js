/**
 * Alberich Companion – Firefox background (MV3)
 *
 * Sidebar statt Chrome Side Panel.
 * Wichtig: open() muss synchron im User-Gesture (action.onClicked) starten.
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

const menusApi = globalThis.browser?.menus || chrome.menus || chrome.contextMenus;
const actionApi = globalThis.browser?.action || chrome.action;
const sidebarApi = globalThis.browser?.sidebarAction || chrome.sidebarAction;

const storage = createChromeStorage();
const keys = createKeyManager(storage);

let menuChain = Promise.resolve();

function enqueueMenu(fn) {
  menuChain = menuChain.then(fn).catch((e) => {
    console.warn('menus', e);
  });
  return menuChain;
}

function promisifyChrome(fn) {
  return new Promise((resolve, reject) => {
    try {
      fn((result) => {
        const err = chrome.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Sidebar öffnen – muss aus User-Action (Toolbar-Klick) aufgerufen werden.
 * Fallback: Panel als Tab (wenn Sidebar-API scheitert).
 */
function openSidebarFromUserGesture() {
  // browser.sidebarAction.open() returns a Promise (Firefox)
  const p = sidebarApi?.open?.();
  if (p && typeof p.then === 'function') {
    p.catch((e) => {
      console.warn('sidebarAction.open failed, open tab', e);
      openPanelTab();
    });
    return;
  }
  // chrome-namespace callback style (rare)
  try {
    if (sidebarApi?.open) {
      sidebarApi.open();
      return;
    }
  } catch (e) {
    console.warn('sidebarAction.open', e);
  }
  openPanelTab();
}

function openPanelTab() {
  const url = chrome.runtime.getURL('panel/panel.html');
  try {
    chrome.tabs.create({ url });
  } catch (e) {
    console.error('tabs.create', e);
  }
}

async function createMenu(id, title) {
  try {
    await promisifyChrome((cb) =>
      menusApi.create({ id, title, contexts: ['selection'] }, cb),
    );
  } catch (e) {
    if (!/duplicate/i.test(String(e?.message || e))) console.warn(e);
  }
}

async function ensureContextMenus() {
  if (!menusApi) return;
  await loadLocale(storage);
  const courierOn = await loadCourierOn(storage);

  try {
    await promisifyChrome((cb) => menusApi.removeAll(cb));
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

// --- Sofort: Toolbar-Klick (nicht hinter async setup verstecken) ---
if (actionApi?.onClicked) {
  actionApi.onClicked.addListener(() => {
    openSidebarFromUserGesture();
  });
}

async function setupUi() {
  await loadLocale(storage);
  await refreshContextMenus();
  await keys.load();
}

chrome.runtime.onInstalled.addListener(() => {
  setupUi().catch(console.error);
});

chrome.runtime.onStartup?.addListener?.(() => {
  setupUi().catch(console.error);
});

setupUi().catch(console.error);

/**
 * @param {string} text
 */
async function writeClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (e) {
    console.warn('clipboard API', e);
  }
  try {
    await chrome.storage.session.set({ lastClipboardFallback: text });
  } catch {
    await chrome.storage.local.set({ lastClipboardFallback: text });
  }
  return { ok: false, error: 'clipboard-fallback' };
}

/**
 * @param {string} text
 * @param {'ok'|'err'} kind
 */
async function setBadge(text, kind) {
  try {
    await actionApi.setBadgeText({ text: text.slice(0, 4) });
    await actionApi.setBadgeBackgroundColor({
      color: kind === 'ok' ? '#0d9488' : '#b45309',
    });
    setTimeout(() => {
      actionApi.setBadgeText({ text: '' });
    }, 2500);
  } catch {
    /* ignore */
  }
}

async function onMenuClicked(info) {
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
    try {
      await chrome.storage.session.set({ lastError: result.error, lastResult: null });
    } catch {
      /* ignore */
    }
    await setBadge('Err', 'err');
    return;
  }

  const out =
    info.menuItemId === MENU_ENCRYPT
      ? result.cipherGrouped || result.cipher
      : result.plainText;

  const clip = await writeClipboard(out);
  try {
    await chrome.storage.session.set({
      lastResult: out,
      lastError: null,
      lastAction: info.menuItemId === MENU_ENCRYPT ? 'encrypt' : 'decrypt',
    });
  } catch {
    /* ignore */
  }

  await setBadge(clip.ok ? 'OK' : 'Clip', clip.ok ? 'ok' : 'err');
}

if (menusApi?.onClicked) {
  menusApi.onClicked.addListener(onMenuClicked);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true, name: 'Alberich Companion', browser: 'firefox' });
    return false;
  }
  if (msg?.type === 'localeChanged') {
    loadLocale(storage)
      .then(() => refreshContextMenus())
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes['alberichCompanion.locale'] || changes['alberichCompanion.courierOn']) {
    loadLocale(storage).then(() => refreshContextMenus());
  }
});
