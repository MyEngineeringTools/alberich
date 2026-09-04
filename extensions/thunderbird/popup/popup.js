/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Alberich Mail Companion – einfache UI
 *
 * Verschlüsseln: Schreiben-Fenster → Crypto → zurück
 * Entschlüsseln:
 *   - Schreiben-Fenster → zurück, oder
 *   - gelesene Mail (read-only) → Klartext-Tab
 */

import {
  createBrowserStorage,
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
  findComposeTab,
  readComposeBody,
  writeComposeBody,
} from './compose-io.js';
import {
  findDisplayedMessage,
  openDecryptResultTab,
  readDisplayedMessageBody,
} from './mail-io.js';
import {
  MAX_CIPHER_LETTERS,
  cipherLettersFromField,
  courierFit,
  formatGroupedOutput,
  lettersFromInput,
} from '../shared/courier-qr.js';
import {
  dismissMonthMismatch,
  renderSheetChrome,
} from '../shared/sheet-status-ui.js';
import {
  loadCourierDraft,
  loadCourierOn,
  saveCourierDraft,
  saveCourierIntent,
  saveCourierOn,
} from '../shared/courier-store.js';

const api = globalThis.browser ?? globalThis.chrome;
const storage = createBrowserStorage();
const keys = createKeyManager(storage);

const els = {
  keyStatus: document.getElementById('keyStatus'),
  tafelwortLine: document.getElementById('tafelwortLine'),
  monthBanner: document.getElementById('monthBanner'),
  monthBannerText: document.getElementById('monthBannerText'),
  btnMonthBannerKeep: document.getElementById('btnMonthBannerKeep'),
  daySelect: document.getElementById('daySelect'),
  btnLoadSheet: document.getElementById('btnLoadSheet'),
  btnClearSheet: document.getElementById('btnClearSheet'),
  btnInfo: document.getElementById('btnInfo'),
  infoPanel: document.getElementById('infoPanel'),
  btnLoadDemo: document.getElementById('btnLoadDemo'),
  btnLangDe: document.getElementById('btnLangDe'),
  btnLangEn: document.getElementById('btnLangEn'),
  composeStatus: document.getElementById('composeStatus'),
  btnEncrypt: document.getElementById('btnEncrypt'),
  btnDecrypt: document.getElementById('btnDecrypt'),
  lastOp: document.getElementById('lastOp'),
  sessionKey: document.getElementById('sessionKey'),
  sessionHeader: document.getElementById('sessionHeader'),
  sessionStamp: document.getElementById('sessionStamp'),
  sessionMid: document.getElementById('sessionMid'),
  sessionPruef: document.getElementById('sessionPruef'),
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
  courierSourceStatus: document.getElementById('courierSourceStatus'),
  courierLengthWarn: document.getElementById('courierLengthWarn'),
  courierLetters: document.getElementById('courierLetters'),
  courierLetterCount: document.getElementById('courierLetterCount'),
  btnCourierFromMail: document.getElementById('btnCourierFromMail'),
  btnCourierToMail: document.getElementById('btnCourierToMail'),
  btnCourierScan: document.getElementById('btnCourierScan'),
  btnCourierPickImage: document.getElementById('btnCourierPickImage'),
  btnCourierOpenQr: document.getElementById('btnCourierOpenQr'),
  courierHintMsg: document.getElementById('courierHintMsg'),
  courierToast: document.getElementById('courierToast'),
  courierConfirm: document.getElementById('courierConfirm'),
  courierConfirmText: document.getElementById('courierConfirmText'),
  btnCourierConfirmYes: document.getElementById('btnCourierConfirmYes'),
  btnCourierConfirmNo: document.getElementById('btnCourierConfirmNo'),
};

/** @type {boolean} */
let hasCompose = false;
/** @type {boolean} */
let hasMessage = false;
/** @type {boolean} */
let courierOn = false;
/** @type {string} */
let courierLetters = '';
/** @type {boolean|null} */
let pendingCourier = null;

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
    }, 2800);
  }
}

function hasSheet() {
  return !!keys.getStatusSummary().loaded;
}

function applyCourierUi() {
  const on = courierOn;
  if (els.machineWorkspace) els.machineWorkspace.hidden = on;
  if (els.courierBridge) els.courierBridge.hidden = !on;
  els.btnCourierOff?.classList.toggle('active', !on);
  els.btnCourierOn?.classList.toggle('active', on);
  if (els.courierHint) els.courierHint.hidden = !on;
  if (els.tagline) els.tagline.textContent = t(on ? 'ui.taglineCourier' : 'ui.tagline');
  if (els.footerText) els.footerText.textContent = t(on ? 'ui.footerCourier' : 'ui.footer');
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
  if (els.courierSourceStatus) {
    els.courierSourceStatus.textContent = els.composeStatus?.textContent || '';
    els.courierSourceStatus.className = els.composeStatus?.className || 'compose-status empty';
  }
  if (els.btnCourierToMail) els.btnCourierToMail.disabled = !(hasCompose && n);
  if (els.btnCourierFromMail) els.btnCourierFromMail.disabled = !(hasCompose || hasMessage);
}

function setCourierLetters(raw, persist = true) {
  courierLetters = formatGroupedOutput(lettersFromInput(raw));
  refreshCourierBridge();
  if (persist) void saveCourierDraft(storage, courierLetters);
}

function hideCourierConfirm() {
  pendingCourier = null;
  if (els.courierConfirm) els.courierConfirm.hidden = true;
}

function askCourierConfirm(on) {
  pendingCourier = on;
  let msg = t(on ? 'courier.confirmOn' : 'courier.confirmOff');
  if (on && hasSheet()) msg += `\n\n${t('courier.confirmOnSheet')}`;
  if (els.courierConfirmText) els.courierConfirmText.textContent = msg;
  if (els.courierConfirm) els.courierConfirm.hidden = false;
}

async function setCourier(on) {
  if (Boolean(courierOn) === Boolean(on)) {
    hideCourierConfirm();
    return;
  }
  // Kein window.confirm: der native Dialog klaut den Fokus und
  // Thunderbird schließt das Action-Popup, bevor gespeichert wird.
  askCourierConfirm(on);
}

async function commitCourier() {
  if (pendingCourier == null) return;
  const on = pendingCourier;
  hideCourierConfirm();
  courierOn = on;
  await saveCourierOn(storage, on);
  if (on) setCourierLetters(await loadCourierDraft(storage), false);
  applyCourierUi();
  showToast(t(on ? 'toast.courierOn' : 'toast.courierOff'));
}

/**
 * @param {'show'|'scan'|'pick'} [intent]
 */
async function openCourierWindow(intent = 'show') {
  showHint('');
  try {
    await saveCourierDraft(storage, courierLetters);
    await saveCourierIntent(storage, intent);
    await api.runtime.sendMessage({ type: 'openCourier' });
  } catch {
    showHint(t('courier.windowOpenFailed'));
  }
}

async function courierFromMail() {
  showHint('');
  const compose = await readComposeBody();
  if (compose.ok && String(compose.text || '').trim()) {
    setCourierLetters(compose.text);
    showToast(t('courier.fromComposeDone'));
    return;
  }
  const mail = await readDisplayedMessageBody();
  if (!mail.ok) {
    showHint(t(mail.error || 'ui.noSource'));
    await refreshContext();
    return;
  }
  setCourierLetters(mail.text);
  showToast(t('courier.fromComposeDone'));
}

async function courierToMail() {
  showHint('');
  if (!courierLetters) {
    showHint(t('emptyInput'));
    return;
  }
  if (!(await writeBackCompose(courierLetters))) return;
  showToast(t('courier.toComposeDone'));
}

function errorText(result) {
  if (!result?.error) return t('modern.configureFailed');
  if (result.error === 'modern.needMinPlugs') {
    return t(result.error, { count: result.plugCount ?? 0 });
  }
  return t(result.error);
}

function applyStaticI18n() {
  document.documentElement.lang = getLocale();
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

function showSession(messageKey, header, messageId, pruefgruppe) {
  if (els.sessionStamp) els.sessionStamp.textContent = 'ALBV';
  els.sessionKey.textContent = messageKey || '—';
  els.sessionHeader.textContent = header || '—';
  if (els.sessionMid) els.sessionMid.textContent = messageId || '—';
  if (els.sessionPruef) {
    els.sessionPruef.textContent = pruefgruppe
      ? (String(pruefgruppe).match(/.{1,4}/g) || [pruefgruppe]).join(' ')
      : '—';
  }
  els.lastOp.hidden = false;
}

function refreshStatus() {
  const st = keys.getStatusSummary();
  renderSheetChrome(els, st, t, getLocale());

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
    updateActionButtons(false);
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
  updateActionButtons(true);
}

function updateActionButtons(keyOk) {
  const key = !!keyOk;
  els.btnEncrypt.disabled = !(key && hasCompose);
  els.btnDecrypt.disabled = !(key && (hasCompose || hasMessage));
}

function updateSourceStatus() {
  if (hasCompose) {
    els.composeStatus.textContent = t('ui.composeStatusOk');
    els.composeStatus.classList.toggle('empty', false);
  } else if (hasMessage) {
    els.composeStatus.textContent = t('ui.messageStatusOk');
    els.composeStatus.classList.toggle('empty', false);
  } else {
    els.composeStatus.textContent = t('ui.sourceStatusNo');
    els.composeStatus.classList.toggle('empty', true);
  }
  updateActionButtons(!!keys.getDayConfig());
}

async function refreshContext() {
  const tab = await findComposeTab();
  hasCompose = !!tab;
  if (!hasCompose) {
    const msg = await findDisplayedMessage();
    hasMessage = !!msg;
  } else {
    hasMessage = false;
  }
  updateSourceStatus();
  refreshCourierBridge();
  return { hasCompose, hasMessage };
}

/**
 * @param {string} text
 */
async function writeBackCompose(text) {
  const w = await writeComposeBody(text);
  if (!w.ok) {
    showHint(t(w.error || 'ui.noCompose'));
    return false;
  }
  return true;
}

async function onEncrypt() {
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

  const body = await readComposeBody();
  if (!body.ok) {
    showHint(t('ui.encryptNeedsCompose'));
    await refreshContext();
    return;
  }
  if (!String(body.text || '').trim()) {
    showHint(t('emptyInput'));
    return;
  }

  const result = await encryptModern(config, body.text);
  if (!result.ok) {
    showHint(errorText(result));
    return;
  }

  const cipher = result.cipherGrouped || result.cipher;
  if (!(await writeBackCompose(cipher))) return;

  showSession(result.messageKey, result.header, result.messageId, result.pruefgruppe);
  showToast(t('ui.encryptDone'));
}

async function onDecrypt() {
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

  // 1) Schreiben-Fenster (editierbar → Ergebnis zurück)
  const compose = await readComposeBody();
  if (compose.ok && String(compose.text || '').trim()) {
    const result = await decryptModern(config, compose.text);
    if (!result.ok) {
      showHint(errorText(result));
      return;
    }
    if (!(await writeBackCompose(result.plainText))) return;
    showSession(result.messageKey, result.header, result.messageId, result.pruefgruppe);
    showToast(t('ui.decryptDone'));
    return;
  }

  // 2) Gelesene Mail (read-only → neuer Tab)
  const mail = await readDisplayedMessageBody();
  if (!mail.ok) {
    showHint(t(mail.error || 'ui.noSource'));
    await refreshContext();
    return;
  }

  const result = await decryptModern(config, mail.text);
  if (!result.ok) {
    showHint(errorText(result));
    return;
  }

  try {
    await openDecryptResultTab({
      plainText: result.plainText,
      messageKey: result.messageKey,
      header: result.header,
      subject: mail.subject,
    });
  } catch (err) {
    console.error(err);
    showHint(t('ui.resultTabFailed'));
    return;
  }

  showSession(result.messageKey, result.header, result.messageId, result.pruefgruppe);
  showToast(t('ui.decryptOpenedTab'));
}

async function setLanguage(locale) {
  await saveLocale(storage, locale);
  applyStaticI18n();
  refreshStatus();
  await refreshContext();
}

async function init() {
  await loadLocale(storage);
  await keys.load();
  courierOn = await loadCourierOn(storage);
  courierLetters = await loadCourierDraft(storage);
  applyStaticI18n();
  refreshStatus();
  await refreshContext();
  applyCourierUi();

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['alberichCompanion.v1']) {
      keys.load().then(() => {
        refreshStatus();
        refreshContext();
      });
    }
    if (changes['alberichCompanion.locale']) {
      loadLocale(storage).then(async () => {
        applyStaticI18n();
        refreshStatus();
        await refreshContext();
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
      const url = api.runtime.getURL('shared/samples/demo-codebook-v3.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const result = await keys.importSheet(await res.text());
      if (!result.ok) {
        showHint(t(result.error));
        return;
      }
      refreshStatus();
      await refreshContext();
      showToast(t('ui.demoLoaded'));
      els.infoPanel.hidden = true;
      els.btnInfo.setAttribute('aria-expanded', 'false');
    } catch {
      showHint(t('ui.demoFailed'));
    }
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
    refreshStatus();
    await refreshContext();
  });

  els.btnLoadSheet.addEventListener('click', async () => {
    showHint('');
    if (courierOn) {
      showHint(t('toast.courierNoKeys'));
      return;
    }
    try {
      await api.runtime.sendMessage({ type: 'openImport' });
    } catch {
      try {
        await api.windows.create({
          url: api.runtime.getURL('import/import.html'),
          type: 'popup',
          width: 460,
          height: 520,
        });
      } catch {
        showHint(t('import.openFailed'));
      }
    }
  });

  els.btnClearSheet.addEventListener('click', async () => {
    await keys.clearSheet();
    els.lastOp.hidden = true;
    refreshStatus();
    await refreshContext();
    showToast(t('sheetCleared'));
  });

  els.btnCourierOff.addEventListener('click', () => setCourier(false));
  els.btnCourierOn.addEventListener('click', () => setCourier(true));
  els.btnCourierConfirmYes?.addEventListener('click', () => commitCourier());
  els.btnCourierConfirmNo?.addEventListener('click', () => hideCourierConfirm());
  els.btnCourierClearSheet?.addEventListener('click', async () => {
    await keys.clearSheet();
    els.lastOp.hidden = true;
    refreshStatus();
    await refreshContext();
    showToast(t('sheetCleared'));
  });
  els.courierLetters?.addEventListener('input', () => {
    setCourierLetters(els.courierLetters.value, true);
  });
  els.btnCourierFromMail?.addEventListener('click', () => courierFromMail());
  els.btnCourierToMail?.addEventListener('click', () => courierToMail());
  els.btnCourierScan?.addEventListener('click', () => openCourierWindow('scan'));
  els.btnCourierPickImage?.addEventListener('click', () => openCourierWindow('pick'));
  els.btnCourierOpenQr?.addEventListener('click', () => openCourierWindow('show'));

  els.btnEncrypt.addEventListener('click', () => onEncrypt());
  els.btnDecrypt.addEventListener('click', () => onDecrypt());
}

init();
