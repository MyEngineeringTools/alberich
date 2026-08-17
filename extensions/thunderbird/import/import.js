/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Eigenes Fenster für Codebook-Import.
 * Warum: Das Compose/Action-Popup schließt beim nativen Dateidialog —
 * die change-Events und storage.set laufen dann nicht zu Ende.
 */

import {
  createBrowserStorage,
  createKeyManager,
} from '../shared/key-manager.js';
import {
  getLocale,
  loadLocale,
  t,
} from '../shared/i18n.js';
import { loadCourierOn } from '../shared/courier-store.js';

const storage = createBrowserStorage();
const keys = createKeyManager(storage);

const els = {
  fileInput: document.getElementById('fileInput'),
  fileName: document.getElementById('fileName'),
  pasteArea: document.getElementById('pasteArea'),
  btnImportPaste: document.getElementById('btnImportPaste'),
  btnClose: document.getElementById('btnClose'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
};

function showHint(msg) {
  els.hint.hidden = !msg;
  els.hint.textContent = msg || '';
  if (msg) els.toast.hidden = true;
}

function showToast(msg) {
  els.toast.hidden = !msg;
  els.toast.textContent = msg || '';
  if (msg) els.hint.hidden = true;
}

function applyI18n() {
  document.documentElement.lang = getLocale();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  document.title = t('import.title');
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('read'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * @param {string} raw
 */
async function importRaw(raw) {
  showHint('');
  if (await loadCourierOn(storage)) {
    showHint(t('toast.courierNoKeys'));
    return false;
  }
  const text = String(raw ?? '').trim();
  if (!text) {
    showHint(t('emptyInput'));
    return false;
  }
  const result = await keys.importSheet(text);
  if (!result.ok) {
    showHint(t(result.error));
    return false;
  }
  showToast(t('import.success'));
  // Kurz anzeigen, dann Fenster schließen
  setTimeout(() => {
    try {
      window.close();
    } catch {
      /* manuell schließen */
    }
  }, 900);
  return true;
}

async function init() {
  await loadLocale(storage);
  applyI18n();

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    // Wert erst NACH dem Lesen leeren — sonst kann der File-Handle weg sein
    if (!file) return;

    els.fileName.hidden = false;
    els.fileName.textContent = file.name;
    showHint('');

    try {
      const text = await readFileAsText(file);
      els.fileInput.value = '';
      await importRaw(text);
    } catch (err) {
      els.fileInput.value = '';
      console.error('Alberich import read failed', err);
      showHint(t('import.readFailed'));
    }
  });

  els.btnImportPaste.addEventListener('click', async () => {
    await importRaw(els.pasteArea.value);
  });

  els.btnClose.addEventListener('click', () => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  });
}

init();
