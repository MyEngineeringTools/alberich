/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Eigenes Fenster für Kurier-QR (Popup würde beim Dateidialog / Cam sterben).
 */

import {
  createBrowserStorage,
} from '../shared/key-manager.js';
import {
  getLocale,
  loadLocale,
  t,
} from '../shared/i18n.js';
import {
  MAX_CIPHER_LETTERS,
  buildCourierPayload,
  canShowCourierQr,
  cipherLettersFromField,
  courierFit,
  formatGroupedOutput,
  isCourierScanTarget,
  lettersFromInput,
} from '../shared/courier-qr.js';
import {
  loadCourierDraft,
  loadCourierIntent,
  saveCourierDraft,
  saveCourierIntent,
} from '../shared/courier-store.js';
import { courierPayloadToDataUrl } from '../shared/courier-render.js';
import {
  decodeQrTextFromBlob,
  decodeQrTextFromVideoFrame,
} from '../shared/courier-scan.js';

const storage = createBrowserStorage();
const api = globalThis.browser ?? globalThis.chrome;

const els = {
  letterCount: document.getElementById('letterCount'),
  lengthWarn: document.getElementById('lengthWarn'),
  qrImg: document.getElementById('qrImg'),
  qrMeta: document.getElementById('qrMeta'),
  scanBox: document.getElementById('scanBox'),
  video: document.getElementById('video'),
  btnShowQr: document.getElementById('btnShowQr'),
  btnScan: document.getElementById('btnScan'),
  btnStop: document.getElementById('btnStop'),
  fileInput: document.getElementById('fileInput'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
  btnClose: document.getElementById('btnClose'),
};

/** @type {string} */
let letters = '';
/** @type {MediaStream|null} */
let stream = null;
/** @type {number} */
let scanTimer = 0;

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
  document.title = t('courier.windowTitle');
}

function refresh() {
  const n = cipherLettersFromField(letters);
  els.letterCount.textContent = t('courier.letterCount', {
    count: n,
    max: MAX_CIPHER_LETTERS,
  });
  els.btnShowQr.disabled = !canShowCourierQr(letters);
  const fit = courierFit(n);
  if (!n || fit === 'ok') {
    els.lengthWarn.hidden = true;
    els.lengthWarn.textContent = '';
  } else {
    els.lengthWarn.hidden = false;
    els.lengthWarn.classList.toggle('over', fit === 'over');
    els.lengthWarn.textContent = t(
      fit === 'over' ? 'courier.warnOver' : 'courier.warnApproaching',
      { count: n, max: MAX_CIPHER_LETTERS },
    );
  }
}

async function setLetters(raw) {
  letters = formatGroupedOutput(lettersFromInput(raw));
  await saveCourierDraft(storage, letters);
  refresh();
}

function stopScan() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = 0;
  }
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  els.video.srcObject = null;
  els.scanBox.hidden = true;
  els.btnStop.hidden = true;
}

async function getCameraStream() {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    const err = new Error('no-api');
    err.name = 'NotSupportedError';
    throw err;
  }
  const attempts = [
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
    { audio: false, video: { facingMode: 'user' } },
  ];
  /** @type {unknown} */
  let lastError;
  for (const constraints of attempts) {
    try {
      return await mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const name = /** @type {{ name?: string }} */ (err)?.name || '';
      if (
        name === 'NotAllowedError'
        || name === 'SecurityError'
        || name === 'NotFoundError'
        || name === 'NotSupportedError'
      ) {
        throw err;
      }
    }
  }
  throw lastError || new Error('camera');
}

async function startScan() {
  showHint('');
  hideQr();
  try {
    stopScan();
    stream = await getCameraStream();
    els.scanBox.hidden = false;
    els.btnStop.hidden = false;
    els.video.srcObject = stream;
    await els.video.play?.();
    scanTimer = window.setInterval(async () => {
      const raw = await decodeQrTextFromVideoFrame(els.video);
      if (!raw) return;
      if (!isCourierScanTarget(raw)) {
        showHint(t('courier.qrNotFound'));
        return;
      }
      await setLetters(raw);
      stopScan();
      showToast(t('courier.fromComposeDone'));
    }, 280);
  } catch {
    stopScan();
    showHint(t('courier.camDenied'));
  }
}

/**
 * @param {'show'|'scan'|'pick'|''} intent
 */
async function applyIntent(intent) {
  await saveCourierIntent(storage, '');
  if (intent === 'scan') {
    await startScan();
    return;
  }
  if (intent === 'pick') {
    stopScan();
    hideQr();
    window.setTimeout(() => els.fileInput?.click(), 80);
    return;
  }
  if (intent === 'show' && canShowCourierQr(letters)) {
    showQr();
  }
}

function hideQr() {
  els.qrImg.hidden = true;
  els.qrImg.removeAttribute('src');
  els.qrMeta.hidden = true;
}

function showQr() {
  showHint('');
  if (!canShowCourierQr(letters)) {
    showHint(t('courier.qrTooLong'));
    return;
  }
  try {
    stopScan();
    const url = courierPayloadToDataUrl(buildCourierPayload(letters));
    els.qrImg.src = url;
    els.qrImg.alt = t('courier.qrTitle');
    els.qrImg.hidden = false;
    els.qrMeta.hidden = false;
    els.qrMeta.textContent = t('courier.qrMeta', {
      count: String(cipherLettersFromField(letters)),
    });
  } catch {
    showHint(t('courier.qrFailed'));
  }
}

async function init() {
  await loadLocale(storage);
  applyI18n();
  letters = await loadCourierDraft(storage);
  refresh();
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('mode');
  const intent = (await loadCourierIntent(storage))
    || (fromUrl === 'show' || fromUrl === 'scan' || fromUrl === 'pick' ? fromUrl : '');
  await applyIntent(intent || (canShowCourierQr(letters) ? 'show' : ''));

  api.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['alberichCompanion.courierIntent']) {
      const next = changes['alberichCompanion.courierIntent'].newValue;
      if (next === 'show' || next === 'scan' || next === 'pick') {
        void applyIntent(next);
      }
    }
    if (changes['alberichCompanion.courierDraft']) {
      const next = changes['alberichCompanion.courierDraft'].newValue;
      if (typeof next === 'string' && next !== letters) {
        letters = next;
        refresh();
      }
    }
  });

  els.btnShowQr.addEventListener('click', () => showQr());
  els.btnScan.addEventListener('click', () => startScan());
  els.btnStop.addEventListener('click', () => stopScan());
  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    els.fileInput.value = '';
    if (!file) return;
    showHint('');
    try {
      const raw = await decodeQrTextFromBlob(file);
      if (!isCourierScanTarget(raw)) {
        showHint(t('courier.qrNotFound'));
        return;
      }
      await setLetters(raw);
      showToast(t('courier.fromComposeDone'));
    } catch {
      showHint(t('courier.qrNotFound'));
    }
  });
  els.btnClose.addEventListener('click', () => {
    stopScan();
    try {
      window.close();
    } catch {
      /* ignore */
    }
  });

  window.addEventListener('unload', () => stopScan());
}

init();
