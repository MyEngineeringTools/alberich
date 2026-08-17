/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Alberich Companion – Popup UI
 */

import {
  createChromeStorage,
  createKeyManager,
} from '../shared/key-manager.js';
import { decryptModern, encryptModern } from '../shared/modern-ops.js';
import { t } from '../shared/messages-de.js';

const keys = createKeyManager(createChromeStorage());

const els = {
  keyStatus: document.getElementById('keyStatus'),
  daySelect: document.getElementById('daySelect'),
  fileInput: document.getElementById('fileInput'),
  btnClearSheet: document.getElementById('btnClearSheet'),
  jsonPaste: document.getElementById('jsonPaste'),
  btnImportJson: document.getElementById('btnImportJson'),
  roleSend: document.getElementById('roleSend'),
  roleRecv: document.getElementById('roleRecv'),
  fieldLabel: document.getElementById('fieldLabel'),
  mainText: document.getElementById('mainText'),
  btnEncrypt: document.getElementById('btnEncrypt'),
  btnDecrypt: document.getElementById('btnDecrypt'),
  btnCopy: document.getElementById('btnCopy'),
  btnPaste: document.getElementById('btnPaste'),
  btnClear: document.getElementById('btnClear'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
};

/** @type {'send'|'recv'} */
let role = 'send';

function showHint(msg) {
  els.hint.hidden = !msg;
  els.hint.textContent = msg || '';
}

function showToast(msg) {
  els.toast.hidden = !msg;
  els.toast.textContent = msg || '';
  if (msg) {
    setTimeout(() => {
      if (els.toast.textContent === msg) {
        els.toast.hidden = true;
      }
    }, 1800);
  }
}

function errorText(result) {
  if (!result?.error) return t('modern.configureFailed');
  if (result.error === 'modern.needMinPlugs') {
    return t(result.error, { count: result.plugCount ?? 0 });
  }
  return t(result.error);
}

function applyRole() {
  const send = role === 'send';
  els.roleSend.classList.toggle('active', send);
  els.roleRecv.classList.toggle('active', !send);
  els.fieldLabel.textContent = send ? 'Klartext' : 'Geheimtext';
  els.mainText.placeholder = send
    ? 'Text tippen oder einfügen…'
    : 'Geheimtext inkl. Kopfgruppe…';
  els.mainText.classList.toggle('cipher-mode', !send);
  els.mainText.spellcheck = send;
}

function refreshStatus() {
  const st = keys.getStatusSummary();
  els.keyStatus.textContent = st.text;
  els.keyStatus.classList.toggle('empty', !st.loaded);

  els.daySelect.innerHTML = '';
  if (!st.loaded || !st.days?.length) {
    els.daySelect.disabled = true;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Tag …';
    els.daySelect.appendChild(opt);
    return;
  }

  els.daySelect.disabled = false;
  for (const d of st.days) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = `Tag ${d}`;
    if (d === st.selectedDay) opt.selected = true;
    els.daySelect.appendChild(opt);
  }
}

/**
 * @param {string|object} raw
 */
async function importRaw(raw) {
  showHint('');
  const result = await keys.importSheet(raw);
  if (!result.ok) {
    showHint(t(result.error));
    return;
  }
  refreshStatus();
  showToast(t('sheetLoaded'));
}

async function init() {
  await keys.load();
  refreshStatus();
  applyRole();

  els.roleSend.addEventListener('click', () => {
    role = 'send';
    applyRole();
  });
  els.roleRecv.addEventListener('click', () => {
    role = 'recv';
    applyRole();
  });

  els.daySelect.addEventListener('change', async () => {
    const day = Number(els.daySelect.value);
    if (!day) return;
    const r = await keys.setDay(day);
    if (!r.ok) showHint(t(r.error));
    refreshStatus();
  });

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    els.fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await importRaw(text);
    } catch {
      showHint(t('codebook.err.invalidJson'));
    }
  });

  els.btnImportJson.addEventListener('click', async () => {
    const text = els.jsonPaste.value.trim();
    if (!text) {
      showHint(t('codebook.err.invalidJson'));
      return;
    }
    await importRaw(text);
  });

  els.btnClearSheet.addEventListener('click', async () => {
    await keys.clearSheet();
    refreshStatus();
    showToast(t('sheetCleared'));
  });

  els.btnEncrypt.addEventListener('click', async () => {
    showHint('');
    const config = keys.getDayConfig();
    if (!config) {
      showHint(t('modern.noKey'));
      return;
    }
    const plain = els.mainText.value;
    if (!plain) {
      showHint(t('emptyInput'));
      return;
    }
    const result = await encryptModern(config, plain);
    if (!result.ok) {
      showHint(errorText(result));
      return;
    }
    els.mainText.value = result.cipherGrouped || result.cipher;
    role = 'recv';
    applyRole();
    showToast(t('encryptOk'));
  });

  els.btnDecrypt.addEventListener('click', async () => {
    showHint('');
    const config = keys.getDayConfig();
    if (!config) {
      showHint(t('modern.noKey'));
      return;
    }
    const cipher = els.mainText.value;
    if (!cipher.trim()) {
      showHint(t('emptyInput'));
      return;
    }
    const result = await decryptModern(config, cipher);
    if (!result.ok) {
      showHint(errorText(result));
      return;
    }
    els.mainText.value = result.plainText;
    role = 'send';
    applyRole();
    showToast(t('decryptOk'));
  });

  els.btnCopy.addEventListener('click', async () => {
    const text = els.mainText.value;
    if (!text) {
      showHint(t('emptyInput'));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('copied'));
      showHint('');
    } catch {
      showHint('Zwischenablage nicht verfügbar.');
    }
  });

  els.btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      els.mainText.value = text;
      showToast(t('pasted'));
      showHint('');
    } catch {
      showHint('Zwischenablage konnte nicht gelesen werden.');
    }
  });

  els.btnClear.addEventListener('click', () => {
    els.mainText.value = '';
    showHint('');
    showToast(t('cleared'));
  });
}

init();
