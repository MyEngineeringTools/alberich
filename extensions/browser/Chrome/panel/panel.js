/**
 * Alberich Companion – Side Panel UI (DE|EN)
 */

import {
  createChromeStorage,
  createKeyManager,
} from '../shared/key-manager.js';
import { decryptModern, encryptModern } from '../shared/modern-ops.js';
import {
  getLocale,
  loadLocale,
  saveLocale,
  t,
} from '../shared/i18n.js';
import {
  MAX_CIPHER_LETTERS,
  canShowCourierQr,
  cipherLettersFromField,
  courierFit,
  formatGroupedOutput,
  isCourierScanTarget,
  lettersFromInput,
  buildCourierPayload,
} from '../shared/courier-qr.js';
import {
  loadCourierDraft,
  loadCourierOn,
  saveCourierDraft,
  saveCourierOn,
} from '../shared/courier-store.js';
import { courierPayloadToDataUrl } from '../shared/courier-render.js';
import {
  decodeQrTextFromBlob,
  decodeQrTextFromVideoFrame,
} from '../shared/courier-scan.js';
import {
  dismissMonthMismatch,
  renderSheetChrome,
} from '../shared/sheet-status-ui.js';

const storage = createChromeStorage();
const keys = createKeyManager(storage);

const els = {
  keyStatus: document.getElementById('keyStatus'),
  tafelwortLine: document.getElementById('tafelwortLine'),
  monthBanner: document.getElementById('monthBanner'),
  monthBannerText: document.getElementById('monthBannerText'),
  btnMonthBannerKeep: document.getElementById('btnMonthBannerKeep'),
  settingsFold: document.getElementById('settingsFold'),
  settingsBody: document.getElementById('settingsBody'),
  daySelect: document.getElementById('daySelect'),
  fileInput: document.getElementById('fileInput'),
  btnClearSheet: document.getElementById('btnClearSheet'),
  btnInfo: document.getElementById('btnInfo'),
  infoPanel: document.getElementById('infoPanel'),
  btnLoadDemo: document.getElementById('btnLoadDemo'),
  btnLangDe: document.getElementById('btnLangDe'),
  btnLangEn: document.getElementById('btnLangEn'),
  roleSend: document.getElementById('roleSend'),
  roleRecv: document.getElementById('roleRecv'),
  sessionFold: document.getElementById('sessionFold'),
  sessionSummary: document.getElementById('sessionSummary'),
  sessionKey: document.getElementById('sessionKey'),
  sessionHeader: document.getElementById('sessionHeader'),
  sessionStamp: document.getElementById('sessionStamp'),
  sessionMid: document.getElementById('sessionMid'),
  sessionPruef: document.getElementById('sessionPruef'),
  fieldLabel: document.getElementById('fieldLabel'),
  mainText: document.getElementById('mainText'),
  btnEncrypt: document.getElementById('btnEncrypt'),
  btnDecrypt: document.getElementById('btnDecrypt'),
  btnCopy: document.getElementById('btnCopy'),
  btnPaste: document.getElementById('btnPaste'),
  btnClear: document.getElementById('btnClear'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
  tagline: document.getElementById('tagline'),
  footerText: document.getElementById('footerText'),
  btnCourierOff: document.getElementById('btnCourierOff'),
  btnCourierOn: document.getElementById('btnCourierOn'),
  courierHint: document.getElementById('courierHint'),
  machineWorkspace: document.getElementById('machineWorkspace'),
  courierBridge: document.getElementById('courierBridge'),
  courierSheetWarn: document.getElementById('courierSheetWarn'),
  btnCourierClearSheet: document.getElementById('btnCourierClearSheet'),
  courierLengthWarn: document.getElementById('courierLengthWarn'),
  btnCourierScan: document.getElementById('btnCourierScan'),
  btnCourierPickImage: document.getElementById('btnCourierPickImage'),
  courierQrFile: document.getElementById('courierQrFile'),
  courierScanBox: document.getElementById('courierScanBox'),
  courierVideo: document.getElementById('courierVideo'),
  btnCourierStopScan: document.getElementById('btnCourierStopScan'),
  courierLetters: document.getElementById('courierLetters'),
  courierLetterCount: document.getElementById('courierLetterCount'),
  btnCourierShowQr: document.getElementById('btnCourierShowQr'),
  courierQrBox: document.getElementById('courierQrBox'),
  courierQrImg: document.getElementById('courierQrImg'),
  courierQrMeta: document.getElementById('courierQrMeta'),
  btnCourierHideQr: document.getElementById('btnCourierHideQr'),
  btnCourierCopy: document.getElementById('btnCourierCopy'),
  btnCourierPaste: document.getElementById('btnCourierPaste'),
  btnCourierClear: document.getElementById('btnCourierClear'),
  courierHintMsg: document.getElementById('courierHintMsg'),
  courierToast: document.getElementById('courierToast'),
};

/** @type {'send'|'recv'} */
let role = 'send';

/** @type {{ messageKey: string, header: string, messageId: string, pruefgruppe: string }} */
let lastSession = { messageKey: '', header: '', messageId: '', pruefgruppe: '' };

/** @type {boolean} */
let courierOn = false;
/** @type {string} */
let courierLetters = '';
/** @type {MediaStream|null} */
let courierStream = null;
/** @type {number} */
let courierScanTimer = 0;

function hintTargets() {
  return [els.hint, els.courierHintMsg].filter(Boolean);
}

function toastTargets() {
  return [els.toast, els.courierToast].filter(Boolean);
}

function showHint(msg) {
  for (const el of hintTargets()) {
    el.hidden = !msg;
    el.textContent = msg || '';
  }
}

function showToast(msg) {
  for (const el of toastTargets()) {
    el.hidden = !msg;
    el.textContent = msg || '';
  }
  if (msg) {
    setTimeout(() => {
      for (const el of toastTargets()) {
        if (el.textContent === msg) el.hidden = true;
      }
    }, 2000);
  }
}

function hasSheet() {
  return !!keys.getStatusSummary().loaded;
}

function applyCourierUi() {
  const on = courierOn;
  document.body.classList.toggle('courier-on', on);
  if (els.machineWorkspace) els.machineWorkspace.hidden = on;
  if (els.courierBridge) els.courierBridge.hidden = !on;
  els.btnCourierOff?.classList.toggle('active', !on);
  els.btnCourierOn?.classList.toggle('active', on);
  if (els.courierHint) els.courierHint.hidden = !on;
  if (els.tagline) {
    els.tagline.textContent = t(on ? 'ui.taglineCourier' : 'ui.tagline');
  }
  if (els.footerText) {
    els.footerText.textContent = t(on ? 'ui.footerCourier' : 'ui.footer');
  }
  refreshCourierBridge();
}

function refreshCourierBridge() {
  const sheet = hasSheet();
  if (els.courierSheetWarn) els.courierSheetWarn.hidden = !sheet;
  if (els.btnCourierClearSheet) els.btnCourierClearSheet.hidden = !sheet;

  const grouped = formatGroupedOutput(courierLetters);
  if (els.courierLetters && els.courierLetters !== document.activeElement) {
    els.courierLetters.value = grouped;
  }
  const n = cipherLettersFromField(courierLetters);
  if (els.courierLetterCount) {
    els.courierLetterCount.textContent = t('courier.letterCount', {
      count: n,
      max: MAX_CIPHER_LETTERS,
    });
  }
  if (els.btnCourierShowQr) {
    els.btnCourierShowQr.disabled = !canShowCourierQr(courierLetters);
  }
  if (els.courierLengthWarn) {
    const fit = courierFit(n);
    if (!n || fit === 'ok') {
      els.courierLengthWarn.hidden = true;
      els.courierLengthWarn.textContent = '';
    } else {
      els.courierLengthWarn.hidden = false;
      els.courierLengthWarn.classList.toggle('over', fit === 'over');
      els.courierLengthWarn.textContent = t(
        fit === 'over' ? 'courier.warnOver' : 'courier.warnApproaching',
        { count: n, max: MAX_CIPHER_LETTERS },
      );
    }
  }
}

function setCourierLetters(raw, persist = true) {
  courierLetters = formatGroupedOutput(lettersFromInput(raw));
  refreshCourierBridge();
  if (persist) void saveCourierDraft(storage, courierLetters);
}

function stopCourierScan() {
  if (courierScanTimer) {
    clearInterval(courierScanTimer);
    courierScanTimer = 0;
  }
  if (courierStream) {
    for (const track of courierStream.getTracks()) track.stop();
    courierStream = null;
  }
  if (els.courierVideo) els.courierVideo.srcObject = null;
  if (els.courierScanBox) els.courierScanBox.hidden = true;
}

async function startCourierScan() {
  showHint('');
  hideCourierQr();
  if (!navigator.mediaDevices?.getUserMedia) {
    showHint(t('courier.camDenied'));
    return;
  }
  try {
    stopCourierScan();
    const attempts = [
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      { audio: false, video: true },
      { audio: false, video: { facingMode: 'user' } },
    ];
    let lastError;
    for (const constraints of attempts) {
      try {
        courierStream = await navigator.mediaDevices.getUserMedia(constraints);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const name = err?.name || '';
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
    if (!courierStream) throw lastError || new Error('camera');
    els.courierScanBox.hidden = false;
    els.courierVideo.srcObject = courierStream;
    await els.courierVideo.play?.();
    courierScanTimer = window.setInterval(async () => {
      if (!els.courierVideo) return;
      const raw = await decodeQrTextFromVideoFrame(els.courierVideo);
      if (!raw) return;
      if (!isCourierScanTarget(raw)) {
        showHint(t('courier.qrNotFound'));
        return;
      }
      setCourierLetters(raw);
      stopCourierScan();
      showToast(t('pasted'));
      showHint('');
    }, 280);
  } catch {
    stopCourierScan();
    showHint(t('courier.camDenied'));
  }
}

function hideCourierQr() {
  if (els.courierQrBox) els.courierQrBox.hidden = true;
  if (els.courierQrImg) els.courierQrImg.removeAttribute('src');
}

function showCourierQr() {
  showHint('');
  if (!canShowCourierQr(courierLetters)) {
    showHint(t('courier.qrTooLong'));
    return;
  }
  try {
    const payload = buildCourierPayload(courierLetters);
    const url = courierPayloadToDataUrl(payload);
    els.courierQrImg.src = url;
    els.courierQrImg.alt = t('courier.qrTitle');
    els.courierQrMeta.textContent = t('courier.qrMeta', {
      count: String(cipherLettersFromField(courierLetters)),
    });
    els.courierQrBox.hidden = false;
    stopCourierScan();
  } catch {
    showHint(t('courier.qrFailed'));
  }
}

async function setCourier(on) {
  if (Boolean(courierOn) === Boolean(on)) return;
  let msg = t(on ? 'courier.confirmOn' : 'courier.confirmOff');
  if (on && hasSheet()) msg += `\n\n${t('courier.confirmOnSheet')}`;
  if (!window.confirm(msg)) return;
  courierOn = on;
  await saveCourierOn(storage, on);
  if (!on) {
    stopCourierScan();
    hideCourierQr();
  } else {
    setCourierLetters(await loadCourierDraft(storage), false);
  }
  applyCourierUi();
  showToast(t(on ? 'toast.courierOn' : 'toast.courierOff'));
}

function errorText(result) {
  if (!result?.error) return t('modern.configureFailed');
  if (result.error === 'modern.needMinPlugs') {
    return t(result.error, { count: result.plugCount ?? 0 });
  }
  return t(result.error);
}

/** Statische UI-Strings aus data-i18n* anwenden */
function applyStaticI18n() {
  document.documentElement.lang = getLocale();

  // Nur textContent/title — kein innerHTML (AMO/Linter-Sicherheit)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });

  els.btnLangDe.classList.toggle('active', getLocale() === 'de');
  els.btnLangEn.classList.toggle('active', getLocale() === 'en');
  applyCourierUi();
}

/**
 * @param {{ messageKey?: string, header?: string } | null} session
 */
function updateSessionFold(session) {
  if (session?.messageKey || session?.header) {
    lastSession = {
      messageKey: session.messageKey || lastSession.messageKey,
      header: session.header || lastSession.header,
      messageId: session.messageId || lastSession.messageId,
      pruefgruppe: session.pruefgruppe || lastSession.pruefgruppe,
    };
  }

  const mk = lastSession.messageKey || '';
  const hd = lastSession.header || '';
  const mid = lastSession.messageId || '';
  const pruef = lastSession.pruefgruppe || '';
  const mkShow = mk || '————';
  const hdShow = hd || '————';
  const midShow = mid || '————————';
  const pruefShow = pruef
    ? (pruef.match(/.{1,4}/g) || [pruef]).join(' ')
    : '———— ———— ———— ———— ————';

  if (els.sessionStamp) els.sessionStamp.textContent = 'ALBV';
  els.sessionKey.textContent = mkShow;
  els.sessionHeader.textContent = hdShow;
  if (els.sessionMid) {
    els.sessionMid.textContent = midShow;
    els.sessionMid.classList.toggle('warn', !mid);
  }
  if (els.sessionPruef) {
    els.sessionPruef.textContent = pruefShow;
    els.sessionPruef.classList.toggle('warn', !pruef);
  }
  els.sessionKey.classList.toggle('warn', !mk);
  els.sessionHeader.classList.toggle('warn', !hd);

  if (mk && hd) {
    els.sessionSummary.textContent = t('session.summaryBoth', { mk, hd });
  } else if (mk) {
    els.sessionSummary.textContent = mk;
  } else {
    els.sessionSummary.textContent = t('ui.sessionAuto');
  }

  els.sessionFold.open = false;
}

function clearSessionFold() {
  lastSession = { messageKey: '', header: '', messageId: '', pruefgruppe: '' };
  updateSessionFold(null);
}

function applyRole() {
  const send = role === 'send';
  els.roleSend.classList.toggle('active', send);
  els.roleRecv.classList.toggle('active', !send);
  els.fieldLabel.textContent = t(send ? 'ui.plain' : 'ui.cipher');
  els.mainText.placeholder = t(
    send ? 'ui.placeholderPlain' : 'ui.placeholderCipher',
  );
  els.mainText.classList.toggle('cipher-mode', !send);
  els.mainText.spellcheck = send;
}

/**
 * @param {ReturnType<typeof keys.getStatusSummary>} st
 */
function formatSettingsBody(st) {
  if (!st.loaded) return '';
  return (st.tooltip || st.detail || '').split('\n').filter(Boolean).join('\n');
}

function refreshStatus() {
  const st = keys.getStatusSummary();
  renderSheetChrome(els, st, t, getLocale());

  if (st.loaded) {
    els.settingsFold.hidden = false;
    els.settingsBody.textContent = formatSettingsBody(st);
  } else {
    els.settingsFold.hidden = true;
    els.settingsFold.open = false;
    els.settingsBody.textContent = '';
  }

  while (els.daySelect.firstChild) {
    els.daySelect.removeChild(els.daySelect.firstChild);
  }
  if (!st.loaded || !st.dayOptions?.length) {
    els.daySelect.disabled = true;
    els.daySelect.title = t('ui.dayTitleEmpty');
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('ui.dayPlaceholder');
    els.daySelect.appendChild(opt);
    return;
  }

  els.daySelect.disabled = false;
  els.daySelect.title = t('ui.dayTitle');
  for (const { day, tooltip } of st.dayOptions) {
    const opt = document.createElement('option');
    opt.value = String(day);
    opt.textContent = t('status.dayLabel', { day });
    opt.title = tooltip;
    if (day === st.selectedDay) opt.selected = true;
    els.daySelect.appendChild(opt);
  }
}

/**
 * @param {string|object} raw
 */
async function importRaw(raw) {
  showHint('');
  if (courierOn) {
    showHint(t('toast.courierNoKeys'));
    return;
  }
  const result = await keys.importSheet(raw);
  if (!result.ok) {
    showHint(t(result.error));
    return;
  }
  clearSessionFold();
  refreshStatus();
  const word = keys.getStatusSummary().tafelwort;
  showToast(word ? t('sheetLoadedWord', { word }) : t('sheetLoaded'));
}

async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      const ok = document.execCommand('paste');
      const v = ta.value;
      ta.remove();
      if (ok && v) resolve(v);
      else reject(new Error('clipboard'));
    });
  }
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

async function setLanguage(locale) {
  await saveLocale(storage, locale);
  applyStaticI18n();
  applyRole();
  updateSessionFold(null);
  refreshStatus();
  // Menü-Titel im SW aktualisieren (storage.onChanged macht dasselbe —
  // SW serialisiert; Fehler bei lastError unterdrücken)
  try {
    chrome.runtime.sendMessage({ type: 'localeChanged', locale: getLocale() }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* ignore */
  }
}

async function init() {
  await loadLocale(storage);
  await keys.load();
  courierOn = await loadCourierOn(storage);
  courierLetters = await loadCourierDraft(storage);
  applyStaticI18n();
  refreshStatus();
  applyRole();
  clearSessionFold();
  applyCourierUi();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['alberichCompanion.v1']) {
      keys.load().then(() => {
        refreshStatus();
        refreshCourierBridge();
      });
    }
    if (changes['alberichCompanion.locale']) {
      loadLocale(storage).then(() => {
        applyStaticI18n();
        applyRole();
        updateSessionFold(null);
        refreshStatus();
      });
    }
    if (changes['alberichCompanion.courierOn']) {
      courierOn = changes['alberichCompanion.courierOn'].newValue === true;
      applyCourierUi();
    }
    if (changes['alberichCompanion.courierDraft'] && courierOn) {
      const next = changes['alberichCompanion.courierDraft'].newValue;
      if (typeof next === 'string' && next !== courierLetters) {
        courierLetters = next;
        refreshCourierBridge();
      }
    }
  });

  els.btnLangDe.addEventListener('click', () => setLanguage('de'));
  els.btnLangEn.addEventListener('click', () => setLanguage('en'));

  els.btnInfo.addEventListener('click', () => {
    const open = els.infoPanel.hidden;
    els.infoPanel.hidden = !open;
    els.btnInfo.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  els.btnLoadDemo?.addEventListener('click', async () => {
    showHint('');
    if (courierOn) {
      showHint(t('toast.courierNoKeys'));
      return;
    }
    try {
      const url = chrome.runtime.getURL('shared/samples/demo-codebook-v3.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const result = await keys.importSheet(text);
      if (!result.ok) {
        showHint(t(result.error));
        return;
      }
      clearSessionFold();
      refreshStatus();
      showToast(t('ui.demoLoaded'));
      // Info zu, damit man Status/Tag sieht
      els.infoPanel.hidden = true;
      els.btnInfo.setAttribute('aria-expanded', 'false');
    } catch {
      showHint(t('ui.demoFailed'));
    }
  });

  els.roleSend.addEventListener('click', () => {
    role = 'send';
    applyRole();
  });
  els.roleRecv.addEventListener('click', () => {
    role = 'recv';
    applyRole();
  });

  els.btnMonthBannerKeep?.addEventListener('click', () => {
    dismissMonthMismatch(keys.getStatusSummary());
    refreshStatus();
  });

  els.daySelect.addEventListener('change', async () => {
    const day = Number(els.daySelect.value);
    if (!day) return;
    const r = await keys.setDay(day);
    if (!r.ok) showHint(t(r.error));
    clearSessionFold();
    refreshStatus();
  });

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files?.[0];
    els.fileInput.value = '';
    if (!file) return;
    try {
      await importRaw(await file.text());
    } catch {
      showHint(t('codebook.err.invalidJson'));
    }
  });

  els.btnClearSheet.addEventListener('click', async () => {
    await keys.clearSheet();
    clearSessionFold();
    refreshStatus();
    showToast(t('sheetCleared'));
  });

  els.btnCourierOff.addEventListener('click', () => setCourier(false));
  els.btnCourierOn.addEventListener('click', () => setCourier(true));
  els.btnCourierClearSheet?.addEventListener('click', async () => {
    await keys.clearSheet();
    clearSessionFold();
    refreshStatus();
    refreshCourierBridge();
    showToast(t('sheetCleared'));
  });
  els.btnCourierScan?.addEventListener('click', () => startCourierScan());
  els.btnCourierStopScan?.addEventListener('click', () => stopCourierScan());
  els.btnCourierPickImage?.addEventListener('click', () => els.courierQrFile?.click());
  els.courierQrFile?.addEventListener('change', async () => {
    const file = els.courierQrFile.files?.[0];
    els.courierQrFile.value = '';
    if (!file) return;
    showHint('');
    try {
      const raw = await decodeQrTextFromBlob(file);
      if (!isCourierScanTarget(raw)) {
        showHint(t('courier.qrNotFound'));
        return;
      }
      setCourierLetters(raw);
      showToast(t('pasted'));
    } catch {
      showHint(t('courier.qrNotFound'));
    }
  });
  els.courierLetters?.addEventListener('input', () => {
    setCourierLetters(els.courierLetters.value, true);
  });
  els.courierLetters?.addEventListener('blur', () => {
    refreshCourierBridge();
  });
  els.btnCourierShowQr?.addEventListener('click', () => showCourierQr());
  els.btnCourierHideQr?.addEventListener('click', () => hideCourierQr());
  els.btnCourierCopy?.addEventListener('click', async () => {
    if (!courierLetters) {
      showHint(t('emptyInput'));
      return;
    }
    if (await writeClipboard(courierLetters)) {
      showToast(t('copied'));
      showHint('');
    } else {
      showHint(t('ui.clipboardUnavailable'));
    }
  });
  els.btnCourierPaste?.addEventListener('click', async () => {
    try {
      const text = await readClipboard();
      if (!text) {
        showHint(t('ui.clipboardEmpty'));
        return;
      }
      setCourierLetters(text);
      showToast(t('pasted'));
      showHint('');
    } catch {
      showHint(t('ui.clipboardBlocked'));
    }
  });
  els.btnCourierClear?.addEventListener('click', () => {
    setCourierLetters('');
    hideCourierQr();
    showHint('');
    showToast(t('cleared'));
  });

  els.btnEncrypt.addEventListener('click', async () => {
    showHint('');
    if (courierOn) {
      showHint(t('toast.courierNoKeys'));
      return;
    }
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
    updateSessionFold({
      messageKey: result.messageKey,
      header: result.header,
      messageId: result.messageId,
      pruefgruppe: result.pruefgruppe,
    });
    role = 'recv';
    applyRole();
    showToast(t('encryptOk'));
  });

  els.btnDecrypt.addEventListener('click', async () => {
    showHint('');
    if (courierOn) {
      showHint(t('toast.courierNoKeys'));
      return;
    }
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
    updateSessionFold({
      messageKey: result.messageKey,
      header: result.header,
      messageId: result.messageId,
      pruefgruppe: result.pruefgruppe,
    });
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
    if (await writeClipboard(text)) {
      showToast(t('copied'));
      showHint('');
    } else {
      showHint(t('ui.clipboardUnavailable'));
    }
  });

  els.btnPaste.addEventListener('click', async () => {
    try {
      const text = await readClipboard();
      if (!text) {
        showHint(t('ui.clipboardEmpty'));
        return;
      }
      els.mainText.value = text;
      showToast(t('pasted'));
      showHint('');
    } catch {
      showHint(t('ui.clipboardBlocked'));
    }
  });

  els.btnClear.addEventListener('click', () => {
    els.mainText.value = '';
    clearSessionFold();
    showHint('');
    showToast(t('cleared'));
  });
}

init();
