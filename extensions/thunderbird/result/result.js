/**
 * Anzeige des entschlüsselten Klartexts (neues Tab).
 * Nur textContent — kein innerHTML mit Mailinhalt.
 */

import { RESULT_STORAGE_KEY } from '../popup/mail-io.js';
import {
  getLocale,
  loadLocale,
  t,
} from '../shared/i18n.js';
import { createBrowserStorage } from '../shared/key-manager.js';

const api = globalThis.browser ?? globalThis.chrome;
const storage = createBrowserStorage();

const els = {
  plainOut: document.getElementById('plainOut'),
  metaLine: document.getElementById('metaLine'),
  btnCopy: document.getElementById('btnCopy'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
};

function applyI18n() {
  document.documentElement.lang = getLocale();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.title = t('result.title');
}

async function init() {
  await loadLocale(storage);
  applyI18n();

  const data = await api.storage.local.get(RESULT_STORAGE_KEY);
  const payload = data?.[RESULT_STORAGE_KEY];

  if (!payload || typeof payload.plainText !== 'string') {
    els.plainOut.textContent = t('result.empty');
    els.hint.hidden = false;
    els.hint.textContent = t('result.empty');
    return;
  }

  els.plainOut.textContent = payload.plainText;

  const bits = [];
  if (payload.subject) bits.push(payload.subject);
  if (payload.messageKey) bits.push(`${t('ui.messageKey')}: ${payload.messageKey}`);
  if (payload.header) bits.push(`${t('ui.headerGroup')}: ${payload.header}`);
  els.metaLine.textContent = bits.join(' · ');

  // Nach dem Anzeigen nicht länger im Storage behalten (weniger Spuren)
  try {
    await api.storage.local.remove(RESULT_STORAGE_KEY);
  } catch {
    /* ignore */
  }

  els.btnCopy.addEventListener('click', async () => {
    const text = els.plainOut.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      els.toast.hidden = false;
      els.toast.textContent = t('copied');
      els.hint.hidden = true;
    } catch {
      els.hint.hidden = false;
      els.hint.textContent = t('ui.clipboardUnavailable');
    }
  });
}

init();
