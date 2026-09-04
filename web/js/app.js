/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { CipherEngine } from './cipher-engine.js';
import {
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_DORA,
  REFLECTOR_OPTIONS,
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
  reflectorLabel,
  formatDoraPairs,
  isFreeDoraPairs,
  normalizeDoraEditablePairs,
  normalizeDoraFreePairs,
  DEFAULT_REFLECTOR_D_PAIRS,
} from './cipher-data.js';
import {
  preparePlaintextForEditing,
  computePreparedCursor,
  extractLetters,
  messageCounts,
  formatGroupedOutput,
  layoutCode,
  buildRingCode,
  buildKeyCode,
  applyRingCode,
  applyKeyCode,
  parsePlugboardPairs,
} from './text-processing.js';
import {
  parseCodebookJson,
  dayEntryToSettingsPatch,
  findCodebookDay,
  defaultCodebookDay,
  todayOnSheet,
  sheetDiffersFromCalendar,
} from './codebook.js';
import { generateMonthSheet, monthLabel } from './codebook-generate.js';
import { formatSheetDay, sheetToPlainText } from './codebook-sheet-view.js';
import {
  parseCodebookQrPayload,
  decodeQrTextFromBlob,
  decodeQrTextFromVideoFrame,
} from './codebook-qr.js';
import {
  sheetToJsonString,
  sheetJsonFilename,
  sheetToQrPngExport,
  payloadToQrPngBlob,
} from './codebook-export.js';
import { tafelwort } from './codebook-tafelwort.js';
import {
  MAX_CIPHER_LETTERS,
  buildCourierPayload,
  canShowCourierQr,
  cipherLettersFromField,
  cipherLettersFromPlain,
  courierFit,
  isCourierScanTarget,
  lettersFromInput,
  parseCourierPayload,
} from './courier-qr.js';
import { LIMITS } from './limits.js';
import {
  MAX_NETWORKS,
  DEFAULT_NETWORK_NAME,
  createNetwork,
  canAddNetwork,
  findNetwork,
  migrateNetworksState,
  syncActiveIntoNetworks,
  renameNetworkInList,
  removeNetworkFromList,
  clearNetworkSheetInList,
  clearAllNetworkSheets,
  sanitizeNetworkName,
} from './networks.js';
import { getLocale, initI18n, localizeError, setLocale, t } from './i18n/index.js?v=17';
import {
  getModeProfileId,
  isModern,
  isTraditional,
  KEY_MODE,
  MAIN_MODE,
  normalizeModeFields,
  usesTraditionalMessageKey,
} from './operation-mode.js';
import {
  MIN_STECKER_PAIRS,
  normalizePlugPairsCanonical,
  randomMessageKey4,
  utf8ToBase26,
} from './modern-crypto.js';
import {
  ReplayCache,
  generateEndwalzeWiring,
  resolveV3Epoch,
  generateLueckenfueller,
  isV3Telegram,
  modernV3DecryptPayload,
  modernV3EncryptPayload,
  randomMessageId,
  validateEndwalzeWiring,
  validateLueckenfueller,
} from './modern-v3.js';
import {
  pick,
  randomDoraEditablePairs,
  randomDoraFreePairs,
  randomFourLetters,
  randomLetter,
  randomMainRotors,
  randomPlugboard,
} from './secure-random.js';
import {
  ENDWALZE_POLICY,
  defaultEndwalzePolicyForMode,
  parseEndwalzePolicy,
  pickReflectorIdForPolicy,
  policyFitsMainMode,
  sheetUsesFreeDora,
  sheetUsesPermutationEndwalze,
  usesFreeDoraWiring,
  usesPermutationEndwalze,
} from './endwalze-policy.js';
import { fullKeyFingerprint } from './full-key-fingerprint.js';
import { createModernSession } from './modern-session.js';
import { RESERVE, START, chooseAndReserveMessageKey } from './security-state.js';
import { TIME_PROFILE, formatSlotHours, getAlberichDateTime, getSlotForTimestamp } from './alberich-key-time.js';
import { generateTimebook } from './timebook-generate.js';
import {
  isTimebook,
  resolveTimebookSlot,
  selectDisplayFullKey,
  validateTimebook,
} from './timebook.js';
import {
  slotSummaryText,
  timebookDayOutline,
  timebookKeyDisplayRows,
} from './timebook-sheet-view.js';
import { CBQR2_MUR_PROFILE_V1 } from './cbqr2-mur-profile.js';
import {
  beginTimebookSendSession,
  decryptTimebookTelegram,
  externalizePinnedSlot,
  MAC_SEARCH,
} from './timebook-session.js';
import { freezeShareSession, LabSender, LAB_MODE } from './cbqr2-lab-session.js';
import { LabReceiver, TRANSFER, classifyCameraError } from './cbqr2-lab-scan.js';
import { STATIC_TEXT_MAGIC, TRANSPORT_CODEC, decodeStaticText } from './cbqr2-transport.js';
import { decodeCbqr2, encodeCbqr2, isCbqr2Bytes, timebookBinaryFilename } from './cbqr2-binary.js';

let codebookKind = 'hardened';
let liveShareSender = null;
let codebookReceiver = null;
let pendingTimebookImport = null;
let slotTickTimer = 0;
/** Last pin/clock identity painted into Aktuelle Walzenstellung. */
let lastRotorDisplaySlotId = '';

const STORAGE_KEY = 'alberich-web-settings-v1';
const VERSION = '1.0 (Revision 65)';
/** Replaced by scripts/release.sh in the packaged web zip. */
const BUILD_COMMIT = 'unpublished';
const PROTOCOL_LABEL = 'Modern V3';
const replayCache = new ReplayCache(512);
/** Last V3 telegram this session produced — re-decrypt is a self-test, not a replay. */
let lastOutgoingCipher = '';
/** Last V3 telegram successfully decrypted — live re-process of the same input is not a replay. */
let lastDecryptedCipher = '';
const CODEBOOK_HASH = 'codebook';

/** Letzter in Alberich kopierter Text (Fallback, wenn System-Zwischenablage nicht lesbar). */
let appClipboard = '';
/** Nach Klick auf Einfügen: nächstes Paste-Event (STRG+V) wird abgefangen. */
let pasteArmed = false;
let pasteArmToken = 0;

/** @typedef {import('./operation-mode.js').KeyMode} KeyMode */
/** @typedef {import('./operation-mode.js').MainMode} MainMode */
/** @typedef {'plain' | 'cipher'} InputRole */
/** @typedef {'manual' | 'codebook'} KeySource */

/** Gemeinsame Walzenlage des Demo-Standards (Tafel-Goldtag / golden vectors). */
const DEFAULT_LAYOUT = {
  reflectorId: 'C',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  rotorThin: 'Beta',
  posLeft: 'D',
  posMiddle: 'S',
  posRight: 'Z',
  posThin: 'C',
  ringThin: 'E',
  ringLeft: 'P',
  ringMiddle: 'E',
  ringRight: 'L',
  ringCode: 'EPEL',
  keyCode: 'CDSZ',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  reflectorD: DEFAULT_REFLECTOR_D_PAIRS,
  doraFree: false,
};

/** Historische M4-Demo: UKW Caesar, keine freie Endwalze. */
const TRADITIONAL_DEFAULT_KEY = {
  ...DEFAULT_LAYOUT,
  modernProtocol: 'v2',
  endwalzeWiring: '',
  lueckenfueller: null,
};

/**
 * Modern-Demo (gleicher Goldtag wie die V3-Demo-Tafel):
 * freie Endwalze + Kerben auf dem Tag, Telegramm ALBV.
 */
const MODERN_DEFAULT_KEY = {
  ...DEFAULT_LAYOUT,
  modernProtocol: 'v3',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
};

const DEFAULT_STATE = {
  ...MODERN_DEFAULT_KEY,
  /** Spruchschlüssel pro Nachricht (nur Traditionell · Spruchschlüssel) */
  messageKey: '',
  /**
   * Hauptmodus: traditional | modern
   * Modern: Endwalze + Lückenfüller (Weg B); Traditionell: historisch involutorisch.
   */
  /** Erststart: Modern; danach localStorage (fehlendes Feld = Traditionell, Abwärtskompatibel) */
  mainMode: /** @type {MainMode} */ (MAIN_MODE.MODERN),
  /**
   * Nur bei mainMode traditional: simple | message
   * (wird im Modern-Modus beibehalten, gilt aber nicht für die Chiffre)
   */
  keyMode: /** @type {KeyMode} */ (KEY_MODE.SIMPLE),
  /**
   * Klartext vs. Geheimtext:
   * - Traditionell · Spruchschlüssel: senden / empfangen (Kopfgruppe)
   * - Modern: verschlüsseln / entschlüsseln (invertierter Signalweg)
   */
  inputRole: /** @type {InputRole} */ ('plain'),
  /**
   * manual = Zufall/Hand · codebook = Tag aus importierter Schlüsseltafel
   * @type {KeySource}
   */
  keySource: 'manual',
  /** Importierte Monatstafel des aktiven Netzes (JSON), oder null */
  codebookSheet: null,
  /** Gewählter Tag der Tafel (1–31) */
  codebookDay: 1,
  /** Bis zu MAX_NETWORKS benannte Netze mit optionaler Monatstafel */
  networks: [],
  /** id des aktiven Netzes */
  activeNetworkId: '',
  plaintext: '',
  ciphertext: '',
  /** Kurier an = nur QR/Buchstaben, keine Chiffre */
  courierOn: false,
};

// Startzustand: ein leeres Standard-Netz (wird in loadState ggf. migriert)
{
  const boot = createNetwork({ name: DEFAULT_NETWORK_NAME });
  DEFAULT_STATE.networks = [boot];
  DEFAULT_STATE.activeNetworkId = boot.id;
}

const engine = new CipherEngine();
let state = loadState();
/**
 * true: Eingabe ist bereits der Geheimtext-Körper (nach Split),
 * Ausgabe = Entschlüsselung mit Spruchschlüssel (ohne neue Kopfgruppe).
 */
let messageReceive = false;
/** Kalendertag (yyyy-MM-dd), für den der Tafel-Tag zuletzt automatisch auf heute gelegt wurde. */
let lastAutoDayApplyDate = null;
/** Session: „Trotzdem diesen Tag“ für Tafel year-month. */
let monthMismatchDismissedKey = null;
/** Geheimtext-Buchstaben der Kurier-Brücke (nicht persistiert). */
let courierLetters = '';
/** @type {'codebook' | 'courier'} */
let qrScanPurpose = 'codebook';
/** letzte verschlüsselte Kopfgruppe (Anzeige) */
let lastHeaderGroup = '';
/** Modern: Fehlercode bei Konfiguration (z. B. zu wenige Stecker) */
let lastModernCryptoError = /** @type {string | null} */ (null);
let lastModernPlugCount = 0;
/**
 * Session-Spruchschlüssel für die aktuelle Modern-Klartextnachricht
 * (stabil beim Tippen; neu bei Löschen / Rollenwechsel / Schlüsselwechsel).
 */
let modernAutoMessageKey = '';
const modernSession = createModernSession();
/** Session-Message-ID für Modern V3 (nicht die Walzenlage). */
let modernAutoMessageId = '';
/** Letzte 20-Buchstaben-Prüfgruppe (Anzeige). */
let lastModernPruefgruppe = '';
/** Zuletzt genutzter/aufgelöster Spruchschlüssel (Anzeige) */
let lastModernResolvedKey = '';
let liveEncryptSeq = 0;
/** Modern: Kerbenliste ausgeklappt */
let lueckenfuellerNotchesOpen = false;
let duplicateRotorHint = null;
let duplicateHintTimer = null;
let lastRotorPositions = [];
let setupFormEditField = null;
/** Auswahl an der Tafel-Erzeugung (folgt dem Hauptmodus, manuell überschreibbar). */
let codebookEndwalzePolicy = defaultEndwalzePolicyForMode(state.mainMode);

function rotorCardLabels() {
  return [
    t('rotor.label.thin'),
    t('rotor.label.left'),
    t('rotor.label.middle'),
    t('rotor.label.right'),
  ];
}

const els = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  initI18n({
    onChange: () => {
      fillCodebookGenerateSelects();
      renderAll();
      if (els.sheetViewModal?.classList.contains('open')) renderSheetView();
    },
  });
  cacheElements();
  bindEvents();
  fillCodebookGenerateSelects();
  syncCodebookEndwalzePolicyUi();
  renderAll();
  maybeApplyTodaysCodebookDay();
  applyCodebookDeepLink();
  if (slotTickTimer) clearInterval(slotTickTimer);
  slotTickTimer = setInterval(() => {
    renderTimebookNow();
    renderHardenedLiveBadge();
    refreshTimebookRotorView();
  }, 1000);
  window.addEventListener('hashchange', () => {
    if (wantsCodebookDeepLink()) applyCodebookDeepLink();
  });
}

function cacheElements() {
  [
    'inputText', 'outputText', 'inputCount', 'outputCount',
    'reflectorLabel', 'keyCodeDisplay', 'livePosition', 'editableHint', 'rotorNotchHint',
    'rotorGrid', 'plugboardPairs', 'plugboardCount',
    'rotorSection', 'setupModal', 'guideModal', 'infoModal',
    'duplicateRotorHint', 'keyExport', 'toast',
    'messageKeyBar', 'messageKeyInput', 'btnRandomMessageKey',
    'modeSystem', 'modeStatus', 'modeStatusValue',
    'hardenedLiveBadge', 'hardenedLiveMode', 'hardenedLiveSlot', 'hardenedLiveClock',
    'btnMainTraditional', 'btnMainModern',
    'modeHint', 'modeInfoDetails', 'modeInfoBody',
    'traditionalProcedureBar', 'procedureAutoHint', 'charsetLine',
    'modernCryptoError', 'modernFeaturePanel',
    'modernAutoKeyStatus', 'modernEndwalzeNote',
    'lueckenfuellerBlock', 'lueckenfuellerBadge', 'btnToggleNotches', 'lueckenfuellerNotches',
    'directionBar', 'modernSessionBar', 'btnCopyModernSession',
    'modernSessionKeyDisplay', 'modernHeaderDisplay',
    'modernStampDisplay', 'modernMessageIdDisplay', 'modernPruefDisplay',
    'btnModeSimple', 'btnModeMessage',
    'messageKeyHint', 'headerGroupLine', 'headerGroupDisplay',
    'btnRolePlain', 'btnRoleCipher',
    'trafficHint', 'inputFieldLabel', 'startKeyLabel', 'startKeyBlock',
    'endwalzeHint',
    'btnSourceCodebook', 'btnSourceManual', 'codebookPanel', 'codebookStatus',
    'codebookMonthBanner', 'codebookMonthBannerText', 'btnMonthBannerKeep', 'btnMonthBannerNew',
    'codebookFileInput', 'codebookQrFileInput', 'btnImportCodebook',
    'btnImportCodebookQr', 'btnScanCodebookQr', 'codebookDaySelect', 'codebookHint',
    'codebookGenMonth', 'codebookGenYear', 'btnGenerateCodebook',
    'codebookKindBlock', 'codebookProfileBlock', 'btnKindHardened', 'btnKindLegacy',
    'codebookGenerateStatus',
    'qrShareCanvas', 'qrSharePaused', 'qrShareLiveHint',
    'btnPauseQrShare', 'btnResumeQrShare', 'btnStopQrShare',
    'qrScanProgressWrap', 'qrScanProgress', 'qrScanProgressLabel',
    'qrScanConfirm', 'qrScanConfirmText', 'qrScanConfirmFp', 'btnConfirmQrImport',
    'codebookEndwalzePolicy',
    'manualSetupGrid',
    'networksList', 'networksCount',
    'btnNetworkAdd', 'btnNetworkRename', 'btnNetworkClearSheet', 'btnNetworkWipeAll',
    'btnNetworkDelete',
    'codebookShareRow', 'btnShowSheet', 'btnExportCodebookJson', 'btnExportCodebookQr', 'btnShareCodebook',
    'sheetViewModal', 'sheetViewTitle', 'sheetViewTafelwort', 'sheetViewMeta', 'sheetViewBody',
    'timebookSheetView', 'sheetTableScroll', 'sheetViewFooter',
    'btnCopySheet', 'btnPrintSheet',
    'qrShareModal', 'qrShareTitle', 'qrShareTafelwort', 'qrShareMeta', 'qrShareHint', 'qrShareImg',
    'btnDownloadQrShare', 'btnShareQrPng',
    'courierLengthWarn', 'btnShowCourierQr', 'btnScanInputCourierQr', 'courierQrFileInput',
    'courierRoleHint', 'btnCourierOff', 'btnCourierOn',
    'machineWorkspace', 'courierBridge',
    'courierBridgeSheetWarn', 'btnCourierWipeAll', 'btnCourierScan', 'btnCourierPickImage',
    'courierBridgeLengthWarn', 'courierLettersInput', 'courierLetterCount',
    'btnCourierClear', 'btnCourierCopy', 'btnCourierPaste',
    'btnCourierShowQr', 'btnCourierShare',
    'qrScanTitle', 'qrScanHint',
    'qrScanModal', 'qrScanVideo', 'qrScanStatus', 'btnCloseQrScan', 'btnRetryQrScan',
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

/** @type {{ blob: Blob, filename: string, objectUrl: string, stats: object } | null} */
let lastQrShareExport = null;

/** @type {MediaStream | null} */
let qrScanStream = null;
/** @type {number} */
let qrScanRaf = 0;
/** true, sobald ein Code erkannt und verarbeitet wird */
let qrScanBusy = false;

function bindEvents() {
  document.querySelectorAll('[data-locale-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const locale = btn.getAttribute('data-locale-btn');
      if (locale) setLocale(locale);
    });
  });

  document.getElementById('btnGuide').addEventListener('click', () => openModal('guideModal'));
  document.getElementById('btnInfo').addEventListener('click', () => openModal('infoModal'));
  document.getElementById('btnClearInput').addEventListener('click', () => clearInput());
  document.getElementById('btnCopyInput').addEventListener('click', () => copyText(state.plaintext, t('toast.inputCopied')));
  document.getElementById('btnPasteInput').addEventListener('click', onPasteButtonClick);
  document.getElementById('btnCopyOutput').addEventListener('click', () => {
    void externalizeThen(() => copyText(state.ciphertext, t('toast.outputCopied')));
  });
  document.getElementById('btnShareOutput').addEventListener('click', () => shareOutput());
  els.btnShowCourierQr?.addEventListener('click', () => {
    void onShowCourierQr();
  });
  els.btnScanInputCourierQr?.addEventListener('click', () => {
    void startQrScan('courier');
  });
  els.courierQrFileInput?.addEventListener('change', onCourierQrFileSelected);
  els.btnCourierOff?.addEventListener('click', () => setCourierOn(false));
  els.btnCourierOn?.addEventListener('click', () => setCourierOn(true));
  els.btnCourierScan?.addEventListener('click', () => {
    void startQrScan('courier');
  });
  els.btnCourierPickImage?.addEventListener('click', () => els.courierQrFileInput?.click());
  els.btnCourierWipeAll?.addEventListener('click', onNetworkWipeAllSheets);
  els.btnCourierClear?.addEventListener('click', () => {
    courierLetters = '';
    renderCourierUi();
  });
  els.btnCourierCopy?.addEventListener('click', () => copyText(courierLetters, t('toast.inputCopied')));
  els.btnCourierPaste?.addEventListener('click', onCourierPaste);
  els.courierLettersInput?.addEventListener('input', () => {
    courierLetters = formatGroupedOutput(lettersFromInput(els.courierLettersInput.value));
    renderCourierUi();
  });
  els.courierLettersInput?.addEventListener('blur', () => {
    if (els.courierLettersInput) els.courierLettersInput.value = courierLetters;
  });
  els.btnCourierShowQr?.addEventListener('click', () => {
    void onShowCourierQr(courierLetters);
  });
  els.btnCourierShare?.addEventListener('click', () => shareCourierLetters());
  document.getElementById('btnClearAll').addEventListener('click', () => clearAll());

  document.querySelectorAll('.icon-btn').forEach((btn) => {
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  els.rotorSection.addEventListener('click', openSetupIfAllowed);

  els.inputText.addEventListener('input', onInputChanged);
  els.inputText.addEventListener('keydown', onInputKeydown);
  // Paste-Event liefert den Text zuverlässig (clipboardData, ohne readText-Berechtigung)
  els.inputText.addEventListener('paste', onInputPaste);
  els.inputText.addEventListener('drop', onInputDrop);
  // Nach Einfügen-Button: STRG+V auch ohne Fokus im Feld
  document.addEventListener('paste', onDocumentPasteWhenArmed, true);

  els.btnMainTraditional?.addEventListener('click', () => setMainMode(MAIN_MODE.TRADITIONAL));
  els.btnMainModern?.addEventListener('click', () => setMainMode(MAIN_MODE.MODERN));
  els.btnModeSimple.addEventListener('click', () => setKeyMode(KEY_MODE.SIMPLE));
  els.btnModeMessage.addEventListener('click', () => setKeyMode(KEY_MODE.MESSAGE));
  els.btnToggleNotches?.addEventListener('click', () => {
    lueckenfuellerNotchesOpen = !lueckenfuellerNotchesOpen;
    renderModernFeaturePanel();
  });
  els.btnRolePlain?.addEventListener('click', () => setInputRole('plain'));
  els.btnRoleCipher?.addEventListener('click', () => setInputRole('cipher'));
  els.messageKeyInput.addEventListener('input', onMessageKeyInput);
  els.messageKeyInput.addEventListener('paste', onMessageKeyPaste);
  els.btnRandomMessageKey.addEventListener('click', randomizeMessageKey);

  document.getElementById('btnCloseSetup').addEventListener('click', closeSetup);
  document.getElementById('btnResetDefault').addEventListener('click', resetDefault);
  document.getElementById('btnRandomize').addEventListener('click', randomizeSettings);
  document.getElementById('btnCopyKey').addEventListener('click', () => copyText(formatKeyExport(), t('toast.keyCopied')));
  els.btnCopyModernSession?.addEventListener('click', () => {
    void externalizeThen(() => copyText(formatModernSessionExport(), t('toast.sessionCopied')));
  });

  els.btnSourceCodebook?.addEventListener('click', () => setKeySource('codebook'));
  els.btnSourceManual?.addEventListener('click', () => setKeySource('manual'));
  els.btnImportCodebook?.addEventListener('click', () => els.codebookFileInput?.click());
  els.btnImportCodebookQr?.addEventListener('click', () => els.codebookQrFileInput?.click());
  els.btnScanCodebookQr?.addEventListener('click', () => {
    void startQrScan('codebook');
  });
  els.btnGenerateCodebook?.addEventListener('click', onGenerateCodebook);
  els.btnKindHardened?.addEventListener('click', () => setCodebookKind('hardened'));
  els.btnKindLegacy?.addEventListener('click', () => setCodebookKind('legacy'));
  els.btnPauseQrShare?.addEventListener('click', () => pauseLiveShare());
  els.btnResumeQrShare?.addEventListener('click', () => resumeLiveShare());
  els.btnStopQrShare?.addEventListener('click', () => closeModal('qrShareModal'));
  els.btnConfirmQrImport?.addEventListener('click', () => confirmPendingTimebookImport());
  els.btnMonthBannerKeep?.addEventListener('click', onMonthBannerKeep);
  els.btnMonthBannerNew?.addEventListener('click', onMonthBannerNew);
  document.querySelectorAll('[data-endwalze-policy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = parseEndwalzePolicy(btn.getAttribute('data-endwalze-policy'));
      if (!next) return;
      codebookEndwalzePolicy = next;
      syncCodebookEndwalzePolicyUi();
      const fromManual = btn.closest('#manualEndwalzePolicy');
      if (fromManual && usesPermutationEndwalze(next)) {
        if (!canEditRotorSetup()) {
          showToast(t('toast.rotorsLocked'));
          renderSetupForm();
          return;
        }
        randomizeSettings();
        return;
      }
      renderSetupForm();
    });
  });
  els.btnRetryQrScan?.addEventListener('click', () => {
    void startQrScan(qrScanPurpose);
  });
  els.btnCloseQrScan?.addEventListener('click', () => stopCodebookQrScan());
  els.codebookFileInput?.addEventListener('change', onCodebookFileSelected);
  els.codebookQrFileInput?.addEventListener('change', onCodebookQrFileSelected);
  els.codebookDaySelect?.addEventListener('change', onCodebookDayChange);
  els.btnNetworkAdd?.addEventListener('click', onNetworkAdd);
  els.btnNetworkRename?.addEventListener('click', onNetworkRename);
  els.btnNetworkClearSheet?.addEventListener('click', onNetworkClearSheet);
  els.btnNetworkWipeAll?.addEventListener('click', onNetworkWipeAllSheets);
  els.btnNetworkDelete?.addEventListener('click', onNetworkDelete);
  els.networksList?.addEventListener('click', onNetworksListClick);
  els.btnShowSheet?.addEventListener('click', onShowSheet);
  els.btnCopySheet?.addEventListener('click', onCopySheet);
  els.btnPrintSheet?.addEventListener('click', onPrintSheet);
  els.btnExportCodebookJson?.addEventListener('click', onExportCodebookJson);
  els.btnExportCodebookQr?.addEventListener('click', () => {
    void onExportCodebookQr();
  });
  els.btnShareCodebook?.addEventListener('click', () => {
    void onShareCodebook();
  });
  els.btnDownloadQrShare?.addEventListener('click', onDownloadQrShare);
  els.btnShareQrPng?.addEventListener('click', () => {
    void onShareQrPng();
  });
  els.qrScanModal?.addEventListener('click', (event) => {
    if (event.target === els.qrScanModal) stopCodebookQrScan();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && qrScanStream && qrScanPurpose === 'courier') {
      stopCodebookQrScan({ silent: true });
    }
    if (!document.hidden) maybeApplyTodaysCodebookDay();
    renderTimebookNow();
    renderHardenedLiveBadge();
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });

  bindSetupControls();
}

function bindSetupControls() {
  document.getElementById('reflectorSelect').addEventListener('change', (e) => {
    markManualKeySource();
    document.getElementById('doraSection').hidden = e.target.value !== REFLECTOR_ID_DORA;
    /** @type {Record<string, unknown>} */
    const patch = { reflectorId: e.target.value, doraFree: false };
    if (e.target.value === REFLECTOR_ID_DORA && (state.doraFree || isFreeDoraPairs(state.reflectorD))) {
      const historic = normalizeDoraEditablePairs(state.reflectorD).join(' ');
      patch.reflectorD = historic || DEFAULT_REFLECTOR_D_PAIRS;
    }
    updateSetting(patch);
  });

  ['rotorThin', 'rotorLeft', 'rotorMiddle', 'rotorRight'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      markManualKeySource();
      const slot = id.replace('rotor', '').toLowerCase();
      if (['left', 'middle', 'right'].includes(slot)) {
        const hint = mainRotorDuplicateHint(e.target.value, slot);
        if (hint) {
          showDuplicateHint(hint);
          e.target.value = state[`rotor${capitalize(slot)}`];
          return;
        }
        showDuplicateHint(null);
      }
      updateSetting({ [id]: e.target.value });
    });
  });

  document.getElementById('ringCode').addEventListener('input', (e) => {
    markManualKeySource();
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    e.target.value = cleaned;
    const rings = applyRingCode(cleaned);
    if (!rings) {
      updateSetting({ ringCode: cleaned }, false);
      return;
    }
    updateSetting({
      ringLeft: rings.left,
      ringMiddle: rings.middle,
      ringRight: rings.right,
      ringCode: `${rings.thin}${rings.left}${rings.middle}${rings.right}`,
    });
  });

  document.getElementById('keyCodeInput').addEventListener('input', (e) => {
    markManualKeySource();
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    e.target.value = cleaned;
    const positions = applyKeyCode(cleaned);
    if (!positions) {
      updateSetting({ keyCode: cleaned }, false);
      return;
    }
    updateSetting({
      posThin: positions[0],
      posLeft: positions[1],
      posMiddle: positions[2],
      posRight: positions[3],
      keyCode: cleaned,
    });
  });

  document.getElementById('plugboard').addEventListener('input', (e) => {
    markManualKeySource();
    onPairFieldInput('plugboard', e);
  });

  const endwalzeInput = document.getElementById('endwalzeWiringInput');
  endwalzeInput?.addEventListener('focus', () => {
    setupFormEditField = 'endwalzeWiringInput';
  });
  endwalzeInput?.addEventListener('blur', () => {
    setupFormEditField = null;
    renderSetupForm();
  });
  endwalzeInput?.addEventListener('input', (e) => {
    markManualKeySource();
    const cleaned = String(e.target.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 26);
    e.target.value = cleaned;
    applyManualEndwalzeWiring(cleaned);
  });
  document.getElementById('btnRollEndwalze')?.addEventListener('click', () => {
    if (!canEditRotorSetup()) {
      showToast(t('toast.rotorsLocked'));
      return;
    }
    markManualKeySource();
    try {
      applyManualEndwalzeWiring(generateEndwalzeWiring(), { force: true });
      renderSetupForm();
      showToast(t('toast.randomSettings'));
    } catch {
      showToast(t('modern.endwalzeGenerateFailed'));
    }
  });

  document.getElementById('reflectorD').addEventListener('input', (e) => {
    markManualKeySource();
    onPairFieldInput('reflectorD', e);
  });

  document.getElementById('reflectorD').addEventListener('blur', (e) => {
    const normalized = state.doraFree
      ? normalizeDoraFreePairs(e.target.value).join(' ')
      : normalizeDoraEditablePairs(e.target.value).join(' ');
    e.target.value = normalized;
    state = { ...state, reflectorD: normalized };
    saveState();
    applyConfigToEngine();
    reprocessPlaintextIfPresent();
    updateKeyExportDisplay();
  });
}

/** Manuelle Änderung an den Maschinenfeldern verlässt den Tafel-Modus. */
function markManualKeySource() {
  if (state.keySource === 'manual') return;
  state = { ...state, keySource: 'manual' };
  saveState();
  renderCodebookUi();
}

function setKeySource(source) {
  if (source !== 'manual' && source !== 'codebook') return;
  if (state.keySource === source) {
    renderCodebookUi();
    return;
  }

  if (source === 'codebook') {
    if (!state.codebookSheet) {
      state = { ...state, keySource: 'codebook' };
      saveState();
      renderCodebookUi();
      showActionFeedback(t('toast.codebookImportPrompt'));
      return;
    }
    state = { ...state, keySource: 'codebook' };
    saveState();
    applyCodebookDay(state.codebookDay, { notify: false });
    renderCodebookUi();
    showActionFeedback(t('toast.codebookActive'));
    return;
  }

  state = { ...state, keySource: 'manual' };
  saveState();
  renderCodebookUi();
  showActionFeedback(t('toast.manualSource'));
}

async function onCodebookFileSelected(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > LIMITS.MAX_CODEBOOK_JSON_BYTES) {
    showToast(t('limits.codebookJson'));
    input.value = '';
    return;
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isCbqr2Bytes(bytes)) {
      const decoded = await decodeCbqr2(bytes);
      if (!decoded.ok) {
        showToast(localizeError(decoded.error));
        return;
      }
      applyImportedCodebookSheet(decoded.timebook, t('codebook.sourceBinary'));
      return;
    }
    const text = new TextDecoder('utf-8').decode(bytes).trim();
    if (text.startsWith(`${STATIC_TEXT_MAGIC}|`)) {
      codebookReceiver = new LabReceiver();
      const handled = await ingestCodebookScanText(text);
      if (handled !== 'pending' && handled !== 'imported') {
        showToast(t('qr.err.invalidSheet'));
      }
      return;
    }
    const result = parseCodebookJson(text);
    if (!result.ok) {
      showToast(localizeError(result.error));
      return;
    }
    applyImportedCodebookSheet(result.sheet, t('codebook.sourceJson'));
  } catch (err) {
    showToast(localizeError(err?.message || 'toast.fileReadFailed'));
  } finally {
    input.value = '';
  }
}

async function onCodebookQrFileSelected(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > LIMITS.MAX_QR_IMAGE_BYTES) {
    showToast(t('qr.err.imageTooLarge'));
    input.value = '';
    return;
  }

  try {
    const qrText = await decodeQrTextFromBlob(file);
    if (String(qrText || '').toLowerCase().startsWith('ur:bytes/')) {
      showToast(t('qr.err.needLiveScan'));
      return;
    }
    codebookReceiver = new LabReceiver();
    const handled = await ingestCodebookScanText(qrText);
    if (handled === 'continue' || handled === 'error') {
      if (handled === 'continue') showToast(t('qr.err.needLiveScan'));
    }
  } catch (err) {
    showToast(localizeError(err?.message || 'toast.qrImageFailed'));
  } finally {
    input.value = '';
  }
}

function fillCodebookGenerateSelects() {
  const monthSel = els.codebookGenMonth;
  const yearSel = els.codebookGenYear;
  if (!monthSel || !yearSel) return;

  const now = new Date();
  const keepMonth = Number(monthSel.value) || now.getMonth() + 1;
  const keepYear = Number(yearSel.value) || now.getFullYear();
  const localeTag = getLocaleTag();

  monthSel.replaceChildren();
  for (let month = 1; month <= 12; month++) {
    const opt = document.createElement('option');
    opt.value = String(month);
    opt.textContent = new Date(2026, month - 1, 1).toLocaleDateString(localeTag, {
      month: 'long',
    });
    monthSel.appendChild(opt);
  }
  monthSel.value = String(Math.min(12, Math.max(1, keepMonth)));

  const y0 = now.getFullYear();
  yearSel.replaceChildren();
  for (let year = y0 - 1; year <= y0 + 3; year++) {
    const opt = document.createElement('option');
    opt.value = String(year);
    opt.textContent = String(year);
    yearSel.appendChild(opt);
  }
  if (![...yearSel.options].some((opt) => opt.value === String(keepYear))) {
    const extra = document.createElement('option');
    extra.value = String(keepYear);
    extra.textContent = String(keepYear);
    yearSel.appendChild(extra);
  }
  yearSel.value = String(keepYear);
}

function setCodebookKind(kind) {
  codebookKind = kind === 'legacy' ? 'legacy' : 'hardened';
  syncCodebookKindUi();
}

function selectedTimeProfile() {
  const picked = document.querySelector('input[name="codebookProfile"]:checked');
  const v = picked?.value;
  if (v === TIME_PROFILE.DAY_24H || v === TIME_PROFILE.HOUR_1 || v === TIME_PROFILE.HOURS_4) return v;
  return TIME_PROFILE.HOURS_4;
}

function syncCodebookKindUi() {
  const modern = isModern(state.mainMode);
  if (els.codebookKindBlock) els.codebookKindBlock.hidden = !modern;
  const hardened = modern && codebookKind === 'hardened';
  if (els.codebookProfileBlock) els.codebookProfileBlock.hidden = !hardened;
  const policy = document.querySelector('.codebook-generate .codebook-endwalze-policy');
  if (policy) policy.hidden = hardened;
  els.btnKindHardened?.classList.toggle('active', hardened);
  els.btnKindLegacy?.classList.toggle('active', modern && !hardened);
  els.btnKindHardened?.setAttribute('aria-pressed', hardened ? 'true' : 'false');
  els.btnKindLegacy?.setAttribute('aria-pressed', modern && !hardened ? 'true' : 'false');
}

function profileLabel(profile) {
  return t(`codebook.profileNamed.${profile}`) || profile;
}

function defaultTimebookDay(book) {
  const alb = getAlberichDateTime();
  if (book.year === alb.year && book.month === alb.month) {
    const hit = (book.days || []).find((d) => d.day === alb.day);
    if (hit) return hit.day;
  }
  return book.days?.[0]?.day ?? 1;
}

function shortFingerprint(hex) {
  const s = String(hex || '').toUpperCase();
  if (s.length < 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function formatRemain(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

function slotEndUnixMs(meta) {
  return Date.UTC(
    meta.year,
    meta.month - 1,
    meta.day,
    meta.endHour === 24 ? 0 : meta.endHour,
    0, 0, 0,
  ) - 60 * 60 * 1000 + (meta.endHour === 24 ? 86400000 : 0);
}

function formatCountdownClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function onGenerateCodebook() {
  if (state.courierOn) {
    showToast(t('toast.courierNoKeys'));
    return;
  }
  const year = Number(els.codebookGenYear?.value);
  const month = Number(els.codebookGenMonth?.value);
  const hardened = isModern(state.mainMode) && codebookKind === 'hardened';
  const btn = els.btnGenerateCodebook;
  const status = els.codebookGenerateStatus;
  if (btn) btn.disabled = true;
  if (status) status.hidden = false;
  if (typeof requestAnimationFrame === 'function') {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  try {
    if (hardened) {
      const { timebook } = await generateTimebook(year, month, selectedTimeProfile(), {
        networkContext: 'ALB',
      });
      timebook.generatedAt = new Date().toISOString();
      timebook.monthLabel = monthLabel(year, month, getLocale());
      applyImportedCodebookSheet(timebook, t('codebook.sourceGenerated'));
    } else {
      if (isModern(state.mainMode)) codebookEndwalzePolicy = ENDWALZE_POLICY.PERMUTATION;
      else if (!policyFitsMainMode(codebookEndwalzePolicy, state.mainMode)) {
        codebookEndwalzePolicy = ENDWALZE_POLICY.HISTORIC;
      }
      const sheet = await generateMonthSheet(year, month, getLocale(), {
        endwalzePolicy: codebookEndwalzePolicy,
      });
      applyImportedCodebookSheet(sheet, t('codebook.sourceGenerated'));
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    showToast(
      msg.includes('Unable to generate secure') || msg.includes('Unable to generate unique')
        ? t('modern.endwalzeGenerateFailed')
        : t('toast.codebookGenerateFailed'),
    );
  } finally {
    if (btn) btn.disabled = false;
    if (status) status.hidden = true;
  }
}

/**
 * Importierte Monatstafel in das aktive Netz übernehmen (JSON-Datei oder QR).
 * @param {import('./codebook.js').CodebookSheet} sheet
 * @param {string} [sourceLabel]
 */
function isModernPermutationSheet(sheet) {
  if (isTimebook(sheet)) return true;
  return sheetUsesPermutationEndwalze(sheet);
}

function sheetFitsMainMode(sheet, mainMode) {
  if (!sheet) return false;
  const permutation = isModernPermutationSheet(sheet);
  return isModern(mainMode) ? permutation : !permutation;
}

function applyImportedCodebookSheet(sheet, sourceLabel) {
  if (state.courierOn) {
    showToast(t('toast.courierNoKeys'));
    return;
  }
  if (isTimebook(sheet)) {
    const valid = validateTimebook(sheet);
    if (!valid.ok) {
      showToast(localizeError(valid.error));
      return;
    }
    if (!sheet.monthLabel) {
      sheet.monthLabel = monthLabel(sheet.year, sheet.month, getLocale());
    }
  } else {
    const checked = parseCodebookJson(sheet);
    if (!checked.ok) {
      showToast(localizeError(checked.error));
      return;
    }
    sheet = checked.sheet;
  }
  if (!sheetFitsMainMode(sheet, state.mainMode)) {
    showToast(t(isModern(state.mainMode)
      ? 'toast.legacyModernSheet'
      : 'toast.modernSheetOnTraditional'));
    return;
  }
  const label = sourceLabel || t('codebook.sourceImport');
  const networkName = getActiveNetworkName();

  if (state.codebookSheet) {
    const ok = window.confirm(
      t('network.confirmReplace', { network: networkName }),
    );
    if (!ok) return;
  }

  const day = isTimebook(sheet) ? defaultTimebookDay(sheet) : defaultCodebookDay(sheet);
  const networks = syncActiveIntoNetworks(
    state.networks,
    state.activeNetworkId,
    sheet,
    day,
    label,
  );
  state = {
    ...state,
    keySource: 'codebook',
    codebookSheet: sheet,
    codebookDay: day,
    networks,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  applyCodebookDay(day, { notify: false, skipSave: true });
  saveState();
  renderAll();
  renderSetupForm();
  showToast(t('toast.codebookImported', {
    source: label,
    network: networkName,
    month: sheet.monthLabel || monthLabel(sheet.year, sheet.month, getLocale()),
    day: String(day).padStart(2, '0'),
    word: isTimebook(sheet) ? shortFingerprint(sheet.codebookFingerprint) : tafelwort(sheet),
  }));
}

/** @returns {import('./networks.js').Network | null} */
function getActiveNetwork() {
  return findNetwork(state.networks, state.activeNetworkId);
}

/** @returns {string} */
function getActiveNetworkName() {
  const net = getActiveNetwork();
  if (!net) return t('network.defaultName');
  // Legacy-Default aus Storage → lokalisierter Anzeigename
  if (net.name === DEFAULT_NETWORK_NAME) return t('network.defaultName');
  return net.name;
}

/**
 * Aktive Tafel/Tag ins Netze-Array spiegeln (ohne save).
 * @param {{ source?: string }} [opts]
 */
function mirrorActiveNetwork(opts = {}) {
  state = {
    ...state,
    networks: syncActiveIntoNetworks(
      state.networks,
      state.activeNetworkId,
      state.codebookSheet,
      state.codebookDay,
      opts.source,
    ),
  };
}

function onNetworksListClick(event) {
  const btn = event.target.closest('[data-network-id]');
  if (!btn) return;
  const id = btn.getAttribute('data-network-id');
  if (!id || id === state.activeNetworkId) return;
  activateNetwork(id);
}

function activateNetwork(id) {
  const exact = state.networks.find((n) => n.id === id);
  if (!exact) return;

  mirrorActiveNetwork();
  const day = exact.sheet
    ? (findCodebookDay(exact.sheet, exact.selectedDay)
      ? exact.selectedDay
      : defaultCodebookDay(exact.sheet))
    : 1;

  state = {
    ...state,
    activeNetworkId: exact.id,
    codebookSheet: exact.sheet,
    codebookDay: day,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();

  if (exact.sheet && state.keySource === 'codebook') {
    applyCodebookDay(day, { notify: false, skipSave: true });
  }

  saveState();
  renderAll();
  renderSetupForm();
  showActionFeedback(t('toast.networkActivated', { network: displayNetworkName(exact) }));
}

/** @param {import('./networks.js').Network} net */
function displayNetworkName(net) {
  if (!net) return t('network.defaultName');
  if (net.name === DEFAULT_NETWORK_NAME) return t('network.defaultName');
  return net.name;
}

function onNetworkAdd() {
  if (!canAddNetwork(state.networks)) {
    showToast(t('toast.networkMax', { max: String(MAX_NETWORKS) }));
    return;
  }
  const suggested = t('network.defaultName');
  const raw = window.prompt(t('network.namePrompt'), suggested);
  if (raw === null) return;
  const name = sanitizeNetworkName(raw);
  if (!name) {
    showToast(t('toast.networkNameEmpty'));
    return;
  }
  mirrorActiveNetwork();
  const net = createNetwork({ name });
  state = {
    ...state,
    networks: [...state.networks, net],
    activeNetworkId: net.id,
    codebookSheet: null,
    codebookDay: 1,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  saveState();
  renderAll();
  renderSetupForm();
  showToast(t('toast.networkAdded', { network: name }));
}

function onNetworkRename() {
  const net = getActiveNetwork();
  if (!net) return;
  const current = displayNetworkName(net);
  const raw = window.prompt(t('network.renamePrompt'), current);
  if (raw === null) return;
  const name = sanitizeNetworkName(raw);
  if (!name) {
    showToast(t('toast.networkNameEmpty'));
    return;
  }
  const next = renameNetworkInList(state.networks, net.id, name);
  if (!next) {
    showToast(t('toast.networkNameEmpty'));
    return;
  }
  state = { ...state, networks: next };
  saveState();
  renderCodebookUi();
  showToast(t('toast.networkRenamed', { network: name }));
}

function hasAnyStoredSheet() {
  if (state.codebookSheet) return true;
  return (state.networks || []).some((n) => n.sheet);
}

function onNetworkWipeAllSheets() {
  if (!hasAnyStoredSheet()) {
    showToast(t('toast.noCodebook'));
    return;
  }
  if (!window.confirm(t('network.confirmWipeAll'))) return;

  const networks = clearAllNetworkSheets(state.networks);
  const defaults = structuredClone(DEFAULT_STATE);
  state = {
    ...defaults,
    mainMode: state.mainMode,
    keyMode: state.keyMode,
    networks,
    activeNetworkId: state.activeNetworkId,
    keySource: 'manual',
    codebookSheet: null,
    codebookDay: 1,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  lastAutoDayApplyDate = null;
  saveState();
  resetMachineFromPanel();
  renderAll();
  renderSetupForm();
  showToast(t('toast.sheetsWiped'));
}

function onNetworkClearSheet() {
  const net = getActiveNetwork();
  if (!net) return;
  if (!net.sheet && !state.codebookSheet) {
    showToast(t('toast.noCodebook'));
    return;
  }
  const ok = window.confirm(
    t('network.confirmClearSheet', { network: displayNetworkName(net) }),
  );
  if (!ok) return;

  const networks = clearNetworkSheetInList(state.networks, net.id);
  state = {
    ...state,
    networks,
    codebookSheet: null,
    codebookDay: 1,
    keySource: state.keySource === 'codebook' ? 'codebook' : state.keySource,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  saveState();
  renderAll();
  renderSetupForm();
  showToast(t('toast.networkSheetCleared', { network: displayNetworkName(net) }));
}

/**
 * @returns {import('./codebook.js').CodebookSheet | null}
 */
function requireActiveSheet() {
  if (!state.codebookSheet) {
    showToast(t('toast.shareNoSheet'));
    return null;
  }
  return state.codebookSheet;
}

/** @param {Blob} blob @param {string} filename */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onExportCodebookJson() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  if (isTimebook(sheet)) {
    const packed = await encodeCbqr2(sheet);
    if (!packed.ok) {
      showToast(localizeError(packed.error));
      return;
    }
    const filename = timebookBinaryFilename(sheet);
    downloadBlob(
      new Blob([packed.bytes], { type: 'application/octet-stream' }),
      filename,
    );
    showToast(t('toast.shareBinarySaved', { filename }));
    return;
  }
  const filename = sheetJsonFilename(sheet);
  const json = sheetToJsonString(sheet);
  downloadBlob(
    new Blob([json], { type: 'application/json;charset=utf-8' }),
    filename,
  );
  showToast(t('toast.shareJsonSaved', { filename }));
}

function liveShareCssSize() {
  const vw = Math.min(window.innerWidth || 360, window.innerHeight || 360);
  const { minCssPx, maxCssPx } = CBQR2_MUR_PROFILE_V1;
  return Math.max(minCssPx, Math.min(maxCssPx, Math.floor(vw * 0.86)));
}

function stopLiveShare({ silent = false } = {}) {
  if (liveShareSender) {
    liveShareSender.abort();
    liveShareSender = null;
  }
  if (els.qrShareCanvas) els.qrShareCanvas.hidden = true;
  if (els.qrSharePaused) els.qrSharePaused.hidden = true;
  if (els.qrShareLiveHint) els.qrShareLiveHint.hidden = true;
  if (els.btnPauseQrShare) els.btnPauseQrShare.hidden = true;
  if (els.btnResumeQrShare) els.btnResumeQrShare.hidden = true;
  if (els.btnStopQrShare) els.btnStopQrShare.hidden = true;
  if (els.qrShareImg) els.qrShareImg.hidden = false;
  if (els.btnDownloadQrShare) els.btnDownloadQrShare.hidden = false;
  if (!silent) clearQrShareExport();
}

function pauseLiveShare() {
  liveShareSender?.pause();
  if (els.qrSharePaused) els.qrSharePaused.hidden = false;
  if (els.btnPauseQrShare) els.btnPauseQrShare.hidden = true;
  if (els.btnResumeQrShare) els.btnResumeQrShare.hidden = false;
}

function resumeLiveShare() {
  void liveShareSender?.resume();
  if (els.qrSharePaused) els.qrSharePaused.hidden = true;
  if (els.btnPauseQrShare) els.btnPauseQrShare.hidden = false;
  if (els.btnResumeQrShare) els.btnResumeQrShare.hidden = true;
}

async function startLiveTimebookShare(book) {
  stopLiveShare({ silent: true });
  const session = await freezeShareSession({
    timebook: book,
    codec: TRANSPORT_CODEC.GZIP,
    mode: LAB_MODE.DYNAMIC,
    maxFragmentLen: CBQR2_MUR_PROFILE_V1.maxFragmentLen,
    minFragmentLen: CBQR2_MUR_PROFILE_V1.minFragmentLen,
    ecc: CBQR2_MUR_PROFILE_V1.ecc,
  });
  if (!session.ok) {
    showToast(localizeError(session.error || 'toast.shareQrFailed'));
    return;
  }
  if (els.qrShareImg) {
    els.qrShareImg.hidden = true;
    els.qrShareImg.removeAttribute('src');
  }
  if (els.qrShareHint) els.qrShareHint.hidden = true;
  if (els.qrShareLiveHint) els.qrShareLiveHint.hidden = false;
  if (els.btnDownloadQrShare) els.btnDownloadQrShare.hidden = true;
  if (els.btnShareQrPng) els.btnShareQrPng.hidden = true;
  if (els.btnPauseQrShare) els.btnPauseQrShare.hidden = false;
  if (els.btnResumeQrShare) els.btnResumeQrShare.hidden = true;
  if (els.btnStopQrShare) els.btnStopQrShare.hidden = false;
  if (els.qrShareCanvas) els.qrShareCanvas.hidden = false;
  if (els.qrSharePaused) els.qrSharePaused.hidden = true;
  const network = getActiveNetworkName();
  const month = book.monthLabel || monthLabel(book.year, book.month, getLocale());
  if (els.qrShareTitle) els.qrShareTitle.textContent = t('share.qrTitle');
  if (els.qrShareMeta) {
    els.qrShareMeta.textContent = t('share.hardenedMeta', {
      network,
      month,
      profile: profileLabel(book.timeProfile),
    });
  }
  fillTafelwortLine(els.qrShareTafelwort, book);
  liveShareSender = new LabSender();
  liveShareSender.attach(els.qrShareCanvas);
  await liveShareSender.start(session, {
    fps: CBQR2_MUR_PROFILE_V1.fps,
    cssSize: liveShareCssSize(),
  });
  openModal('qrShareModal');
}

function clearQrShareExport() {
  if (lastQrShareExport?.objectUrl) {
    URL.revokeObjectURL(lastQrShareExport.objectUrl);
  }
  lastQrShareExport = null;
  if (els.qrShareImg) {
    els.qrShareImg.removeAttribute('src');
    els.qrShareImg.alt = '';
  }
}

async function onExportCodebookQr() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  if (isTimebook(sheet)) {
    await startLiveTimebookShare(sheet);
    return;
  }

  const btn = els.btnExportCodebookQr;
  if (btn) btn.disabled = true;
  try {
    const result = await sheetToQrPngExport(sheet);
    clearQrShareExport();
    const objectUrl = URL.createObjectURL(result.blob);
    lastQrShareExport = {
      blob: result.blob,
      filename: result.filename,
      objectUrl,
      stats: result.stats,
    };

    const network = getActiveNetworkName();
    const month = sheet.monthLabel || '';
    if (els.qrShareTitle) els.qrShareTitle.textContent = t('share.qrTitle');
    fillTafelwortLine(els.qrShareTafelwort, sheet);
    if (els.qrShareHint) els.qrShareHint.hidden = false;
    if (els.qrShareImg) {
      els.qrShareImg.src = objectUrl;
      els.qrShareImg.alt = t('share.qrAlt', { network, month });
    }
    if (els.qrShareMeta) {
      const kb = (n) => (n / 1024).toFixed(1);
      els.qrShareMeta.textContent = t('share.qrMeta', {
        network,
        month,
        jsonKb: kb(result.stats.jsonBytes),
        gzipKb: kb(result.stats.gzipBytes),
        ecc: result.stats.ecc,
      });
    }

    // Share-PNG nur sinnvoll, wenn Web Share + Dateien möglich
    if (els.btnShareQrPng) {
      const canFiles = typeof navigator.canShare === 'function'
        && navigator.canShare({
          files: [new File([result.blob], result.filename, { type: 'image/png' })],
        });
      els.btnShareQrPng.hidden = !canFiles && !navigator.share;
      // canShare may fail for construction; still show if share exists
      if (!navigator.share) els.btnShareQrPng.hidden = true;
    }

    openModal('qrShareModal');
    showActionFeedback(t('toast.shareQrReady'));
  } catch (err) {
    logAppError('share-qr', err);
    showToast(localizeError(err?.message || 'toast.shareQrFailed'));
  } finally {
    if (btn) btn.disabled = false;
    updateShareButtonsEnabled();
  }
}

function onDownloadQrShare() {
  if (!lastQrShareExport) return;
  downloadBlob(lastQrShareExport.blob, lastQrShareExport.filename);
  showToast(t('toast.sharePngSaved', { filename: lastQrShareExport.filename }));
}

async function onShareQrPng() {
  if (!lastQrShareExport) return;
  const sheet = state.codebookSheet;
  const network = getActiveNetworkName();
  const month = sheet?.monthLabel || '';
  const file = new File(
    [lastQrShareExport.blob],
    lastQrShareExport.filename,
    { type: 'image/png' },
  );
  const payload = {
    files: [file],
    title: t('share.shareTitle', { network, month }),
    text: t('share.shareText', { network, month }),
  };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
      await navigator.share(payload);
      showActionFeedback(t('toast.shareDone'));
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      showActionFeedback(t('toast.shareCancelled'));
      return;
    }
  }
  onDownloadQrShare();
}

async function onShareCodebook() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  if (isTimebook(sheet)) {
    await startLiveTimebookShare(sheet);
    return;
  }

  const network = getActiveNetworkName();
  const month = sheet.monthLabel || '';
  const filename = sheetJsonFilename(sheet);
  const json = sheetToJsonString(sheet);
  const file = new File([json], filename, { type: 'application/json' });
  const title = t('share.shareTitle', { network, month });
  const text = t('share.shareText', { network, month });

  try {
    if (navigator.share) {
      const withFiles = { files: [file], title, text };
      if (!navigator.canShare || navigator.canShare(withFiles)) {
        await navigator.share(withFiles);
        showActionFeedback(t('toast.shareDone'));
        return;
      }
      // Manche Browser teilen nur Text
      await navigator.share({ title, text: `${text}\n\n${filename}` });
      showActionFeedback(t('toast.shareDone'));
      // JSON zusätzlich anbieten
      downloadBlob(
        new Blob([json], { type: 'application/json;charset=utf-8' }),
        filename,
      );
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      showActionFeedback(t('toast.shareCancelled'));
      return;
    }
  }

  // Fallback: Download
  downloadBlob(
    new Blob([json], { type: 'application/json;charset=utf-8' }),
    filename,
  );
  showToast(t('toast.shareJsonSaved', { filename }));
}

function addSheetCell(tr, className, text) {
  const td = document.createElement('td');
  td.className = className;
  td.textContent = text;
  tr.appendChild(td);
}

function setSheetViewMode(mode) {
  const timebook = mode === 'timebook';
  if (els.timebookSheetView) els.timebookSheetView.hidden = !timebook;
  if (els.sheetTableScroll) els.sheetTableScroll.hidden = timebook;
  if (els.sheetViewFooter) els.sheetViewFooter.hidden = timebook;
  if (!timebook && els.timebookSheetView) els.timebookSheetView.replaceChildren();
}

function fillTimebookKeyDetail(host, key) {
  const dl = document.createElement('dl');
  dl.className = 'timebook-key-dl';
  for (const row of timebookKeyDisplayRows(key)) {
    const dt = document.createElement('dt');
    dt.textContent = t(row.labelKey, row.count != null ? { count: String(row.count) } : undefined);
    const dd = document.createElement('dd');
    dd.className = 'mono';
    dd.dataset.field = row.id;
    dd.textContent = row.value;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
  host.replaceChildren(dl);
}

function fillTimebookDaySlots(slotHost, book, dayNum, current) {
  const dayEntry = (book.days || []).find((d) => d.day === dayNum);
  if (!dayEntry) return;
  const outline = timebookDayOutline({ ...book, days: [dayEntry] }, current);
  const day = outline.days[0];
  if (!day) return;
  for (const header of day.slots) {
    const slotEl = document.createElement('details');
    slotEl.className = 'timebook-slot' + (header.current ? ' timebook-slot-current' : '');
    const ssum = document.createElement('summary');
    ssum.textContent = slotSummaryText(header.hours, header.current, t('codebook.slotCurrent'));
    slotEl.appendChild(ssum);
    const body = document.createElement('div');
    body.className = 'timebook-key-detail';
    slotEl.appendChild(body);
    const slotKey = dayEntry.slots[header.slotIndex]?.key;
    slotEl.addEventListener('toggle', () => {
      if (!slotEl.open || body.dataset.filled === '1' || !slotKey) return;
      body.dataset.filled = '1';
      fillTimebookKeyDetail(body, slotKey);
    });
    slotHost.appendChild(slotEl);
  }
}

function renderTimebookSheetView(book) {
  setSheetViewMode('timebook');
  const month = book.monthLabel || monthLabel(book.year, book.month, getLocale());
  if (els.sheetViewTitle) {
    els.sheetViewTitle.textContent = t('sheet.title', { month });
  }
  fillTafelwortLine(els.sheetViewTafelwort, book);
  if (els.sheetViewMeta) {
    els.sheetViewMeta.textContent = `${t('codebook.hardenedLabel')} · ${profileLabel(book.timeProfile)} · ${t('codebook.keyTimeMez')}`;
  }
  const host = els.timebookSheetView;
  if (!host) return;
  host.replaceChildren();
  const current = resolveTimebookSlot(book, Date.now());
  const outline = timebookDayOutline(book, current);
  for (const day of outline.days) {
    const details = document.createElement('details');
    details.className = 'timebook-day';
    const sum = document.createElement('summary');
    sum.textContent = t('timebook.daySummary', {
      day: String(day.day).padStart(2, '0'),
      month,
      count: String(day.slotCount),
    });
    details.appendChild(sum);
    const slotHost = document.createElement('div');
    slotHost.className = 'timebook-slots';
    details.appendChild(slotHost);
    const fillSlots = () => {
      if (slotHost.dataset.filled === '1') return;
      slotHost.dataset.filled = '1';
      fillTimebookDaySlots(slotHost, book, day.day, current);
    };
    details.addEventListener('toggle', () => {
      if (details.open) fillSlots();
    });
    if (current.ok && current.meta.day === day.day) {
      details.open = true;
      fillSlots();
    }
    host.appendChild(details);
  }
}

function renderSheetView() {
  const sheet = state.codebookSheet;
  if (!els.sheetViewBody) return;
  if (isTimebook(sheet)) {
    renderTimebookSheetView(sheet);
    return;
  }
  setSheetViewMode('legacy');
  if (!sheet) {
    els.sheetViewBody.replaceChildren();
    if (els.sheetViewTitle) els.sheetViewTitle.textContent = t('sheet.title', { month: '' });
    fillTafelwortLine(els.sheetViewTafelwort, null);
    if (els.sheetViewMeta) els.sheetViewMeta.textContent = '';
    return;
  }

  if (els.sheetViewTitle) {
    els.sheetViewTitle.textContent = t('sheet.title', { month: sheet.monthLabel || '' });
  }
  fillTafelwortLine(els.sheetViewTafelwort, sheet);
  if (els.sheetViewMeta) {
    const when = sheet.generatedAt
      ? new Date(sheet.generatedAt).toLocaleString(getLocaleTag())
      : '—';
    els.sheetViewMeta.textContent = t('sheet.meta', {
      count: sheet.days.length,
      when,
    });
  }

  const footer = document.querySelector('.sheet-view-footer');
  const permutation = sheetUsesPermutationEndwalze(sheet);
  if (footer) {
    const policy = parseEndwalzePolicy(sheet.endwalzePolicy);
    const footerKey = permutation
      ? 'sheet.footer.permutation'
      : policy === ENDWALZE_POLICY.DORA
        ? 'sheet.footer.dora'
        : policy === ENDWALZE_POLICY.HISTORIC
          ? 'sheet.footer.historic'
          : 'sheet.footer';
    footer.textContent = t(footerKey);
  }

  const kindHead = document.getElementById('sheetThKind');
  const extraHead = document.getElementById('sheetThExtra');
  if (kindHead) {
    kindHead.setAttribute('data-i18n', permutation ? 'sheet.th.endwalze' : 'sheet.th.ukw');
    kindHead.textContent = t(permutation ? 'sheet.th.endwalze' : 'sheet.th.ukw');
  }
  if (extraHead) {
    extraHead.setAttribute('data-i18n', permutation ? 'sheet.th.notches' : 'sheet.th.dora');
    extraHead.textContent = t(permutation ? 'sheet.th.notches' : 'sheet.th.dora');
  }

  const freeDora = sheetUsesFreeDora(sheet);
  els.sheetViewBody.replaceChildren();
  for (const day of sheet.days) {
    const row = formatSheetDay(day, { freeDora });
    const tr = document.createElement('tr');
    if (row.isPermutation) tr.classList.add('row-permutation');
    if (row.isDora) tr.classList.add('row-dora');
    if (day.day === state.codebookDay) tr.classList.add('row-active-day');
    addSheetCell(tr, 'col-day', row.dayLabel);
    addSheetCell(
      tr,
      row.isPermutation ? 'col-endwalze mono' : 'col-ukw',
      row.isPermutation ? row.endwalzeWiring : row.reflectorLabel,
    );
    addSheetCell(tr, 'col-walzen mono', row.walzenlage);
    addSheetCell(tr, 'col-lage mono', row.lagecode);
    addSheetCell(tr, 'col-ring mono', row.ringCode);
    addSheetCell(tr, 'col-grund mono', row.keyCode);
    addSheetCell(tr, 'col-stecker mono', row.plugboard);
    addSheetCell(
      tr,
      row.isPermutation ? 'col-notches mono' : 'col-dora mono',
      row.isPermutation ? (row.notches || '—') : (row.doraFull || '—'),
    );
    els.sheetViewBody.appendChild(tr);
  }
}

function onShowSheet() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  renderSheetView();
  openModal('sheetViewModal');
}

function onCopySheet() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  if (isTimebook(sheet)) {
    const text = [
      t('codebook.hardenedLabel'),
      profileLabel(sheet.timeProfile),
      monthLabel(sheet.year, sheet.month, getLocale()),
      shortFingerprint(sheet.codebookFingerprint),
    ].join('\n');
    void copyText(text, t('toast.sheetCopied'));
    return;
  }
  const text = sheetToPlainText(sheet, t, getLocaleTag());
  void copyText(text, t('toast.sheetCopied'));
}

function onPrintSheet() {
  const sheet = requireActiveSheet();
  if (!sheet) return;
  renderSheetView();
  if (!els.sheetViewModal?.classList.contains('open')) {
    openModal('sheetViewModal');
  }
  window.setTimeout(() => window.print(), 50);
}

function setButtonUnavailable(el, disabled, reason) {
  if (!el) return;
  el.hidden = false;
  el.disabled = disabled;
  if (disabled && reason) {
    el.title = reason;
    el.setAttribute('aria-description', reason);
  } else {
    el.removeAttribute('title');
    el.removeAttribute('aria-description');
  }
}

function updateShareButtonsEnabled() {
  const hasSheet = !!state.codebookSheet;
  const hardened = isTimebook(state.codebookSheet);
  if (els.codebookShareRow) {
    els.codebookShareRow.hidden = false;
  }
  for (const id of ['btnShowSheet', 'btnExportCodebookQr', 'btnShareCodebook']) {
    if (els[id]) els[id].disabled = !hasSheet;
  }
  setButtonUnavailable(els.btnExportCodebookJson, !hasSheet, '');
  if (els.btnExportCodebookJson) {
    els.btnExportCodebookJson.textContent = hardened
      ? t('share.exportBinary')
      : t('share.exportJson');
  }
  setButtonUnavailable(els.btnImportCodebook, false, '');
  if (els.btnImportCodebook) {
    els.btnImportCodebook.textContent = hardened
      ? t('codebook.importBinary')
      : t('codebook.importFile');
  }
  setButtonUnavailable(
    els.btnImportCodebookQr,
    hardened,
    hardened ? t('codebook.hardenedNoFileImport') : '',
  );
  if (els.codebookHint) {
    els.codebookHint.textContent = hardened
      ? t('codebook.formatHintHardened')
      : t('codebook.formatHint');
  }
}

function onNetworkDelete() {
  if (!state.networks || state.networks.length <= 1) {
    showToast(t('network.confirmDeleteLast'));
    return;
  }
  const net = getActiveNetwork();
  if (!net) return;
  const ok = window.confirm(
    t('network.confirmDelete', { network: displayNetworkName(net) }),
  );
  if (!ok) return;

  const { networks, removed, nextActiveId } = removeNetworkFromList(
    state.networks,
    net.id,
  );
  if (!removed || !nextActiveId) {
    showToast(t('network.confirmDeleteLast'));
    return;
  }

  const deletedName = displayNetworkName(net);
  const next = findNetwork(networks, nextActiveId);
  const day = next?.sheet
    ? (findCodebookDay(next.sheet, next.selectedDay)
      ? next.selectedDay
      : defaultCodebookDay(next.sheet))
    : 1;

  state = {
    ...state,
    networks,
    activeNetworkId: next.id,
    codebookSheet: next.sheet,
    codebookDay: day,
    plaintext: '',
    ciphertext: '',
  };
  messageReceive = false;
  lastHeaderGroup = '';

  if (next.sheet && state.keySource === 'codebook') {
    applyCodebookDay(day, { notify: false, skipSave: true });
  }

  saveState();
  renderAll();
  renderSetupForm();
  showToast(t('toast.networkDeleted', { network: deletedName }));
}

/**
 * Kamera mit abgestuften Constraints anfordern.
 * Strikte facingMode/Auflösung-Kombis scheitern auf Desktop oft mit
 * OverconstrainedError — ohne erneuten Dialog und mit generischer Fehlermeldung.
 * @returns {Promise<MediaStream>}
 */
async function requestCodebookCameraStream() {
  if (!window.isSecureContext) {
    const err = new Error('camera.needHttps');
    err.name = 'SecurityError';
    throw err;
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    const err = new Error('camera.noApi');
    err.name = 'NotSupportedError';
    throw err;
  }

  // Rückkamera bevorzugen. Der erste Versuch bittet nur mit "ideal"-Werten
  // um ein detailreiches 4:3-Bild; alle Angaben bleiben weich, damit ältere
  // Safari-Versionen nicht an OverconstrainedError scheitern.
  const attempts = [
    {
      // Wenn verfügbar, echtes 4:3 ab mindestens 1024×768 verwenden. Das
      // erhält mehr Sensorfläche als ein 16:9-Videocrop. Scheitert diese
      // Kombination, folgt direkt der vollständig weiche High-Res-Versuch.
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { min: 1024, ideal: 1600 },
        height: { min: 768, ideal: 1200 },
        aspectRatio: { exact: 4 / 3 },
        frameRate: { ideal: 30 },
      },
    },
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1440 },
        aspectRatio: { ideal: 4 / 3 },
        frameRate: { ideal: 30 },
      },
    },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: { facingMode: 'environment' } },
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
      // Bei Ablehnung / keine Kamera / Policy: nicht weiterprobieren
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

  throw lastError instanceof Error
    ? lastError
    : new Error('camera.startFailed');
}

/**
 * Unterstützte Kamerafunktionen vorsichtig optimieren. Keine Capability wird
 * vorausgesetzt; ein Fehler darf den Scanner niemals unbenutzbar machen.
 * Zoom wird auf den kleinsten verfügbaren Wert gesetzt, damit insbesondere
 * ältere Geräte den größtmöglichen Bildausschnitt behalten.
 *
 * @param {MediaStream} stream
 */
async function optimizeQrCameraTrack(stream) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || typeof track.applyConstraints !== 'function') return;

  let capabilities = {};
  try {
    capabilities = typeof track.getCapabilities === 'function'
      ? track.getCapabilities()
      : {};
  } catch {
    capabilities = {};
  }

  const candidates = [];

  if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
    candidates.push({ focusMode: 'continuous' });
  }
  if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
    candidates.push({ exposureMode: 'continuous' });
  }
  if (Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) {
    candidates.push({ whiteBalanceMode: 'continuous' });
  }

  const zoom = capabilities.zoom;
  if (
    zoom
    && Number.isFinite(zoom.min)
    && Number.isFinite(zoom.max)
    && zoom.min <= zoom.max
  ) {
    candidates.push({ zoom: zoom.min });
  }

  // Ein nicht akzeptierter optionaler Parameter soll die übrigen nicht
  // verhindern. Darum jede Capability separat und fehlertolerant anwenden.
  for (const constraint of candidates) {
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      /* optionales Tuning überspringen */
    }
  }
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function describeCameraError(err) {
  const name = /** @type {{ name?: string, message?: string }} */ (err)?.name || '';
  const message = /** @type {{ message?: string }} */ (err)?.message || '';

  switch (name) {
    case 'NotAllowedError':
      return t('camera.denied');
    case 'NotFoundError':
      return t('camera.notFound');
    case 'NotReadableError':
      return t('camera.inUse');
    case 'OverconstrainedError':
      return t('camera.overconstrained');
    case 'SecurityError':
      return message ? localizeError(message) : t('camera.security');
    case 'NotSupportedError':
      return message ? localizeError(message) : t('camera.unsupported');
    case 'AbortError':
      return t('camera.aborted');
    default:
      if (message) {
        const localized = localizeError(message);
        if (localized !== message) return localized;
        return name
          ? t('camera.failedNamed', { message, name })
          : t('camera.failedDetail', { message });
      }
      return t('camera.failed');
  }
}

function setQrScanRetryVisible(visible) {
  if (els.btnRetryQrScan) {
    els.btnRetryQrScan.hidden = !visible;
  }
}

function applyCourierScanText(raw) {
  const letters = parseCourierPayload(raw);
  if (!letters) {
    showToast(t('courier.qrNotFound'));
    return false;
  }
  if (state.courierOn) {
    courierLetters = formatGroupedOutput(letters);
    renderCourierUi();
  } else {
    ingestCiphertext(letters);
  }
  return true;
}

async function onCourierQrFileSelected(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const qrText = await decodeQrTextFromBlob(file);
    applyCourierScanText(qrText);
  } catch (err) {
    showToast(localizeError(err?.message || 'toast.qrImageFailed'));
  }
}

function setCourierOn(on) {
  if (Boolean(state.courierOn) === Boolean(on)) return;
  let msg = on ? t('courier.confirmOn') : t('courier.confirmOff');
  if (on && hasAnyStoredSheet()) {
    msg += `\n\n${t('courier.confirmOnSheet')}`;
  }
  if (!window.confirm(msg)) return;
  state = {
    ...state,
    courierOn: on,
    plaintext: '',
    ciphertext: '',
  };
  courierLetters = '';
  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  if (on) closeModal('setupModal');
  saveState();
  renderAll();
  showToast(on ? t('toast.courierOn') : t('toast.courierOff'));
  if (!on) maybeApplyTodaysCodebookDay();
}

async function onCourierPaste() {
  try {
    const text = await navigator.clipboard.readText();
    courierLetters = formatGroupedOutput(lettersFromInput(text));
    renderCourierUi();
    showActionFeedback(t('toast.pasted'));
  } catch {
    showToast(t('toast.fileReadFailed'));
  }
}

async function shareCourierLetters() {
  if (!courierLetters) return;
  if (navigator.share) {
    try {
      await navigator.share({ text: courierLetters });
      return;
    } catch {
      /* fall through */
    }
  }
  copyText(courierLetters, t('toast.outputCopied'));
}

function resetQrScanConfirm() {
  pendingTimebookImport = null;
  if (els.qrScanConfirm) els.qrScanConfirm.hidden = true;
  if (els.btnConfirmQrImport) els.btnConfirmQrImport.hidden = true;
  if (els.qrScanProgressWrap) els.qrScanProgressWrap.hidden = true;
}

function showQrScanProgress(progress) {
  if (!els.qrScanProgressWrap) return;
  if (!progress?.seqLen) {
    els.qrScanProgressWrap.hidden = true;
    return;
  }
  els.qrScanProgressWrap.hidden = false;
  if (els.qrScanProgress) {
    els.qrScanProgress.max = progress.seqLen;
    els.qrScanProgress.value = progress.reconstructed;
  }
  if (els.qrScanProgressLabel) {
    els.qrScanProgressLabel.textContent = t('qr.fragments', {
      have: String(progress.reconstructed),
      need: String(progress.seqLen),
    });
  }
  if (els.qrScanStatus) els.qrScanStatus.textContent = t('qr.receiving');
}

async function ingestCodebookScanText(text) {
  const raw = String(text || '').trim();
  if (raw.includes('ALBERICH-CBQR1')) {
    const result = parseCodebookQrPayload(raw);
    if (!result.ok) {
      const errMsg = localizeError(result.error);
      if (els.qrScanStatus) els.qrScanStatus.textContent = errMsg;
      showToast(errMsg);
      return 'error';
    }
    stopCodebookQrScan({ silent: true });
    applyImportedCodebookSheet(result.sheet, t('codebook.sourceQrScan'));
    return 'imported';
  }
  if (!codebookReceiver) codebookReceiver = new LabReceiver();
  const got = await codebookReceiver.ingest(raw);
  if (got.kind === 'ignored' || got.kind === 'empty' || got.kind === 'duplicate') {
    if (got.kind !== 'ignored') showQrScanProgress(codebookReceiver.progress());
    return 'continue';
  }
  if (got.kind === 'accepted') {
    showQrScanProgress(codebookReceiver.progress());
    return 'continue';
  }
  if (got.kind === 'invalid') {
    if (els.qrScanStatus) els.qrScanStatus.textContent = t('qr.err.transferBroken');
    showToast(t('qr.err.transferBroken'));
    codebookReceiver = new LabReceiver();
    return 'error';
  }
  if ((got.status === TRANSFER.VALID || got.kind === 'valid') && codebookReceiver.timebook) {
    const book = codebookReceiver.timebook;
    stopCodebookQrScan({ silent: true, keepPending: true });
    pendingTimebookImport = book;
    openModal('qrScanModal');
    if (els.qrScanTitle) els.qrScanTitle.textContent = t('qr.receivedTitle');
    if (els.qrScanStatus) els.qrScanStatus.textContent = '';
    if (els.qrScanConfirm) els.qrScanConfirm.hidden = false;
    const month = book.monthLabel || monthLabel(book.year, book.month, getLocale());
    if (els.qrScanConfirmText) {
      els.qrScanConfirmText.textContent = `${month}\n${t('codebook.hardenedLabel')} · ${profileLabel(book.timeProfile)}`;
    }
    if (els.qrScanConfirmFp) {
      els.qrScanConfirmFp.textContent = `${t('codebook.fingerprint')} ${shortFingerprint(book.codebookFingerprint)}`;
    }
    if (els.btnConfirmQrImport) els.btnConfirmQrImport.hidden = false;
    if (els.qrScanProgressWrap) els.qrScanProgressWrap.hidden = true;
    return 'pending';
  }
  return 'continue';
}

function confirmPendingTimebookImport() {
  const book = pendingTimebookImport;
  pendingTimebookImport = null;
  codebookReceiver = null;
  closeModal('qrScanModal');
  if (book) applyImportedCodebookSheet(book, t('codebook.sourceQrScan'));
}

async function startQrScan(purpose = 'codebook') {
  qrScanPurpose = purpose === 'courier' ? 'courier' : 'codebook';
  codebookReceiver = qrScanPurpose === 'codebook' ? new LabReceiver() : null;
  resetQrScanConfirm();
  // Laufenden Scan beenden, Modal aber nicht schließen (wird gleich wieder genutzt)
  if (qrScanRaf) {
    cancelAnimationFrame(qrScanRaf);
    qrScanRaf = 0;
  }
  if (qrScanStream) {
    qrScanStream.getTracks().forEach((t) => t.stop());
    qrScanStream = null;
  }
  const existingVideo = els.qrScanVideo;
  if (existingVideo) {
    existingVideo.pause();
    existingVideo.srcObject = null;
  }
  qrScanBusy = false;
  setQrScanRetryVisible(false);

  if (els.qrScanTitle) {
    els.qrScanTitle.textContent = qrScanPurpose === 'courier'
      ? t('courier.scanTitle')
      : t('qr.title');
  }
  if (els.qrScanHint) {
    els.qrScanHint.textContent = qrScanPurpose === 'courier'
      ? t('courier.scanHint')
      : t('qr.hint');
  }
  if (els.qrScanStatus) els.qrScanStatus.textContent = t('qr.statusStarting');
  openModal('qrScanModal');

  try {
    // Direkt aus dem Klick-Handler (erster await) → User-Activation bleibt erhalten
    qrScanStream = await requestCodebookCameraStream();
    await optimizeQrCameraTrack(qrScanStream);
  } catch (err) {
    const msg = describeCameraError(err);
    if (els.qrScanStatus) els.qrScanStatus.textContent = msg;
    setQrScanRetryVisible(true);
    showToast(msg);
    return;
  }

  const video = els.qrScanVideo;
  if (!video) {
    stopCodebookQrScan();
    return;
  }

  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = qrScanStream;

  try {
    await video.play();
  } catch {
    /* Autoplay: muted + playsinline sollte greifen */
  }

  if (els.qrScanStatus) {
    els.qrScanStatus.textContent = t('qr.statusAim');
  }
  setQrScanRetryVisible(false);

  let lastScanAt = 0;
  let scanAttempt = 0;
  const tick = async () => {
    if (!qrScanStream) return;
    if (qrScanBusy) {
      qrScanRaf = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const receivingMur = qrScanPurpose === 'codebook'
      && codebookReceiver
      && codebookReceiver.status === TRANSFER.PENDING
      && codebookReceiver.uniqueQr > 0;
    const scanGapMs = receivingMur ? 90 : 180;
    if (now - lastScanAt >= scanGapMs) {
      lastScanAt = now;
      try {
        // Pro Versuch nur einen jsQR-Pass ausführen. Das rotiert zwischen
        // enger ROI, sichtbarem Quadrat und Full-Frame-Fallback, statt auf
        // älteren Geräten drei teure Decoderläufe direkt hintereinander zu machen.
        // Live-MUR (gehärtete Tafel): voller Frame, kürzerer Takt — sonst fehlen
        // zu viele Fountain-Fragmente, vor allem bei 1-Stunden-Tafeln.
        const text = await decodeQrTextFromVideoFrame(video, {
          scanPass: receivingMur ? 2 : (scanAttempt % 3),
          preferFullFrame: receivingMur,
        });
        scanAttempt += 1;
        if (document.hidden) {
          /* decode paused */
        } else if (!text) {
          /* next frame */
        } else if (qrScanPurpose === 'courier' && isCourierScanTarget(text)) {
          qrScanBusy = true;
          if (els.qrScanStatus) els.qrScanStatus.textContent = t('qr.statusFound');
          stopCodebookQrScan({ silent: true });
          applyCourierScanText(text);
          return;
        } else if (qrScanPurpose === 'codebook') {
          qrScanBusy = true;
          const handled = await ingestCodebookScanText(text);
          qrScanBusy = false;
          if (handled === 'imported' || handled === 'pending') return;
        }
      } catch {
        /* Frame überspringen */
      }
    }

    qrScanRaf = requestAnimationFrame(tick);
  };

  qrScanRaf = requestAnimationFrame(tick);
}

/**
 * @param {{ silent?: boolean }} [opts]
 */
function stopCodebookQrScan({ silent = false, keepPending = false } = {}) {
  if (qrScanRaf) {
    cancelAnimationFrame(qrScanRaf);
    qrScanRaf = 0;
  }
  if (qrScanStream) {
    qrScanStream.getTracks().forEach((t) => t.stop());
    qrScanStream = null;
  }
  const video = els.qrScanVideo;
  if (video) {
    video.pause();
    video.srcObject = null;
  }
  qrScanBusy = false;
  setQrScanRetryVisible(false);
  if (!keepPending) {
    if (codebookReceiver && typeof codebookReceiver.abort === 'function') {
      codebookReceiver.abort();
    }
    codebookReceiver = null;
    resetQrScanConfirm();
  }
  closeModal('qrScanModal');
  if (!silent && els.qrScanStatus) {
    els.qrScanStatus.textContent = t('qr.statusStarting');
  }
}

/**
 * Einmal pro Kalendertag: Tafel-Tag auf heute, wenn die Monatstafel passt.
 * Manuelle ältere Tage bleiben bis zum nächsten Kalendertag bzw. Reload.
 */
function maybeApplyTodaysCodebookDay() {
  if (state.courierOn) return;
  if (state.keySource !== 'codebook') return;
  const sheet = state.codebookSheet;
  if (!sheet) return;

  const alb = isTimebook(sheet) ? getAlberichDateTime() : null;
  const year = alb ? alb.year : new Date().getFullYear();
  const month = alb ? alb.month : new Date().getMonth() + 1;
  const dayOfMonth = alb ? alb.day : new Date().getDate();
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  const todayDay = todayOnSheet(sheet, year, month, dayOfMonth);
  if (todayDay == null) {
    lastAutoDayApplyDate = dateKey;
    return;
  }
  if (state.codebookDay === todayDay) {
    lastAutoDayApplyDate = dateKey;
    return;
  }
  if (lastAutoDayApplyDate === dateKey) return;
  if (state.plaintext || state.ciphertext) return;

  applyCodebookDay(todayDay, { notify: true });
  lastAutoDayApplyDate = dateKey;
}

function onCodebookDayChange(event) {
  const day = Number(event.target.value);
  if (!Number.isInteger(day)) return;
  applyCodebookDay(day, { notify: true });
}

/**
 * Tagesschlüssel aus der importierten Tafel auf die Maschine anwenden.
 * @param {number} dayNum
 * @param {{ notify?: boolean, skipSave?: boolean }} [opts]
 */
function applyCodebookDay(dayNum, { notify = true, skipSave = false } = {}) {
  const sheet = state.codebookSheet;
  if (!sheet) {
    if (notify) showToast(t('toast.noCodebook'));
    return false;
  }

  if (isTimebook(sheet)) {
    const day = sheet.days.find((d) => d.day === Number(dayNum));
    if (!day) {
      if (notify) showToast(t('toast.dayMissing'));
      return false;
    }
    state = {
      ...state,
      keySource: 'codebook',
      codebookDay: Number(dayNum),
      networks: syncActiveIntoNetworks(
        state.networks,
        state.activeNetworkId,
        state.codebookSheet,
        Number(dayNum),
      ),
    };
    if (!skipSave) saveState();
    renderTimebookNow();
    renderAll();
    renderSetupForm();
    return true;
  }

  const entry = findCodebookDay(sheet, dayNum);
  if (!entry) {
    if (notify) showToast(t('toast.dayMissing'));
    return false;
  }
  if (!sheetFitsMainMode(sheet, state.mainMode)) {
    if (notify) {
      showToast(t(isModern(state.mainMode)
        ? 'toast.legacyModernSheet'
        : 'toast.modernSheetOnTraditional'));
    }
    return false;
  }

  try {
    const patch = dayEntryToSettingsPatch(entry);
    const doraFree = sheetUsesFreeDora(sheet)
      || (entry.reflectorId === REFLECTOR_ID_DORA && isFreeDoraPairs(entry.reflectorD));
    state = {
      ...state,
      ...patch,
      doraFree,
      keySource: 'codebook',
      codebookDay: dayNum,
      plaintext: '',
      ciphertext: '',
    };
    state = {
      ...state,
      networks: syncActiveIntoNetworks(
        state.networks,
        state.activeNetworkId,
        state.codebookSheet,
        dayNum,
      ),
    };
    messageReceive = false;
    lastHeaderGroup = '';
    invalidateModernSessionKey();
    if (!skipSave) saveState();
    resetMachineFromPanel();
    renderAll();
    renderSetupForm();
    if (notify) {
      showActionFeedback(t('toast.dayApplied', {
        day: String(dayNum).padStart(2, '0'),
        month: sheet.monthLabel,
      }));
    }
    return true;
  } catch {
    if (notify) showToast(t('toast.dayKeyInvalid'));
    return false;
  }
}

function sanitizePairField(value) {
  return value.toUpperCase().replace(/[^A-Z ]/g, '');
}

function onPairFieldInput(stateKey, event) {
  const input = event.target;
  setupFormEditField = input.id;
  const cleaned = sanitizePairField(input.value);
  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;
  if (input.value !== cleaned) input.value = cleaned;
  state = { ...state, [stateKey]: cleaned };
  saveState();
  applyConfigToEngine();
  reprocessPlaintextIfPresent();
  updateKeyExportDisplay();
  if (stateKey === 'plugboard') updatePlugboardDisplay();
  requestAnimationFrame(() => {
    input.setSelectionRange(selStart, selEnd);
    setupFormEditField = null;
  });
}

function reprocessPlaintextIfPresent() {
  if (!state.plaintext) return;
  liveEncrypt(state.plaintext);
  renderTextFields();
  renderRotorSection({ useCurrentEngine: true });
  renderMessageKeyUi();
}

function updateKeyExportDisplay() {
  if (els.keyExport) els.keyExport.textContent = formatKeyExport();
}

function updatePlugboardDisplay() {
  const sel = activeTimebookDisplayKey();
  const plugboard = sel?.key?.plugboard ?? state.plugboard;
  const pairs = parsePlugboardPairs(plugboard);
  els.plugboardCount.textContent = `(${pairs.length}/13)`;
  els.plugboardPairs.innerHTML = pairs.length
    ? pairs.map((pair) => `<span class="plug-pair">${pair}</span>`).join('')
    : '<span class="muted">Keine Verbindungen</span>';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const merged = { ...structuredClone(DEFAULT_STATE), ...parsed };
    // Abwärtskompatibel: fehlendes mainMode → traditional; keyMode simple|message bleibt
    const modes = normalizeModeFields(merged);
    merged.mainMode = modes.mainMode;
    merged.keyMode = modes.keyMode;
    if (merged.inputRole !== 'plain' && merged.inputRole !== 'cipher') {
      merged.inputRole = 'plain';
    }
    if (merged.keySource !== 'manual' && merged.keySource !== 'codebook') {
      merged.keySource = 'manual';
    }
    merged.courierOn = merged.courierOn === true;
    if (typeof merged.messageKey !== 'string') merged.messageKey = '';
    merged.messageKey = merged.messageKey.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

    // Legacy-Einzeltafel und/oder Netze-Array normalisieren
    const netState = migrateNetworksState(merged);
    merged.networks = netState.networks;
    merged.activeNetworkId = netState.activeNetworkId;
    merged.codebookSheet = netState.codebookSheet;
    merged.codebookDay = netState.codebookDay;

    merged.doraFree = merged.doraFree === true
      || isFreeDoraPairs(merged.reflectorD)
      || (
        parseEndwalzePolicy(merged.codebookSheet?.endwalzePolicy) === ENDWALZE_POLICY.DORA
        && merged.reflectorId === REFLECTOR_ID_DORA
      );

    if (merged.mainMode === MAIN_MODE.MODERN) {
      merged.modernProtocol = 'v3';
      const leftoverLegacy = merged.codebookSheet
        && !isModernPermutationSheet(merged.codebookSheet);
      const modernReady = validateEndwalzeWiring(merged.endwalzeWiring).ok
        && validateLueckenfueller(merged.lueckenfueller).ok;
      if (leftoverLegacy || !modernReady) {
        Object.assign(merged, structuredClone(MODERN_DEFAULT_KEY));
      }
      if (leftoverLegacy) merged.keySource = 'manual';
    } else if (!('modernProtocol' in parsed) && !parsed.endwalzeWiring) {
      merged.modernProtocol = 'v2';
      merged.endwalzeWiring = '';
      merged.lueckenfueller = null;
    }
    if (typeof merged.ringThin !== 'string' || !/^[A-Z]$/.test(merged.ringThin)) {
      const rings = applyRingCode(String(merged.ringCode || ''));
      merged.ringThin = rings?.thin || 'A';
    }

    if (!merged.codebookSheet && merged.keySource === 'codebook') {
      // leeres Netz im Tafel-Modus ist erlaubt (Import-Hinweis)
    }

    return merged;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  // Tafel des aktiven Netzes immer mitschreiben
  const networks = syncActiveIntoNetworks(
    state.networks,
    state.activeNetworkId,
    state.codebookSheet,
    state.codebookDay,
  );
  if (networks !== state.networks) {
    state = { ...state, networks };
  }
  const { plaintext, ciphertext, ...settings } = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    logAppError('saveState', err);
    showToast(t('toast.saveFailed'));
  }
}

function canEditRotorSetup() {
  return !state.plaintext && !state.ciphertext;
}

function isValidFourKey(code) {
  return typeof code === 'string' && /^[A-Z]{4}$/.test(code);
}

/**
 * Volle Maschinenkonfiguration, Positionen aus 4-Buchstaben-Code.
 * Modern: Endwalze + Lückenfüller-Kerben (Weg B); bei weniger als 3 Steckerpaaren Abbruch.
 */
function setEngineToKeyCode(code) {
  const positions = applyKeyCode(code);
  if (!positions) {
    lastModernCryptoError = null;
    return false;
  }

  if (state.reflectorId === REFLECTOR_ID_DORA) {
    engine.setReflectorD(state.reflectorD, state.doraFree);
  } else {
    engine.setReflector(state.reflectorId);
  }
  const thinRing = state.ringThin || applyRingCode(state.ringCode)?.thin || 'A';
  engine.setRotors(
    state.rotorLeft,
    state.rotorMiddle,
    state.rotorRight,
    state.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    state.ringLeft,
    state.ringMiddle,
    state.ringRight,
    thinRing,
  );
  engine.setPlugboard(state.plugboard);
  engine.setThinRing(thinRing);

  if (isModern(state.mainMode)) {
    if (!usesModernV3()) {
      lastModernCryptoError = 'modern.needPermutation';
      engine.setCryptoMode('traditional');
      return false;
    }
    lastModernPlugCount = normalizePlugPairsCanonical(state.plugboard).length;
    lastModernCryptoError = null;
    engine.setCryptoMode('modern');
    engine.setModernProtocol('v3');
    engine.setEndwalze(state.endwalzeWiring);
    engine.setLueckenfuellerNotches(state.lueckenfueller);
    return true;
  }

  lastModernCryptoError = null;
  lastModernPlugCount = 0;
  engine.setCryptoMode('traditional');
  engine.setModernProtocol('v2');
  return true;
}

function applyConfigToEngine() {
  setEngineToKeyCode(state.keyCode);
}

function resetMachineFromPanel() {
  const sel = activeTimebookDisplayKey();
  if (sel?.key?.keyCode && configureEngineFromFullKey(sel.key, sel.key.keyCode)) {
    return;
  }
  applyConfigToEngine();
}

/**
 * Traditionell Einfach: involutorisch (encrypt = decrypt).
 */
function processTextSimple(letters) {
  if (!setEngineToKeyCode(state.keyCode)) return '';
  return engine.encryptMessage(letters);
}

/**
 * Spruchschlüsselverfahren (nur Traditionell).
 * Klartext (Senden): Kopfgruppe + Geheimtext.
 * Geheimtext-Körper (Empfang nach Split): nur mit Spruchschlüssel.
 */
function processTextMessage(letters) {
  if (state.inputRole === 'cipher' && messageReceive) {
    lastHeaderGroup = lastHeaderGroup || '';
    if (!isValidFourKey(state.messageKey)) return '';
    if (!setEngineToKeyCode(state.messageKey)) return '';
    return engine.encryptMessage(letters);
  }

  // Senden (Klartext)
  lastHeaderGroup = '';
  if (!isValidFourKey(state.keyCode) || !isValidFourKey(state.messageKey)) {
    return '';
  }

  if (!setEngineToKeyCode(state.keyCode)) return '';
  const header = engine.encryptMessage(state.messageKey);
  lastHeaderGroup = header;

  if (!setEngineToKeyCode(state.messageKey)) return '';
  const body = engine.encryptMessage(letters);
  return header + body;
}

function formatLetterGroups4(letters) {
  const clean = String(letters ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '';
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

function logAppError(scope, err) {
  const name = err && typeof err === 'object' && typeof err.name === 'string'
    ? err.name
    : 'Error';
  console.error(`[alberich] ${scope}: ${name}`);
}

function invalidateModernSessionKey() {
  modernAutoMessageKey = '';
  modernSession.invalidate();
  lastModernPruefgruppe = '';
  modernAutoMessageId = '';
  lastModernResolvedKey = '';
}

function markModernCipherExposed() {
  if (!isModern(state.mainMode) || state.inputRole !== 'plain') return;
  if (!state.ciphertext) return;
  modernSession.markExposed(state.plaintext);
}

async function externalizeThen(fn) {
  if (!state.ciphertext) return;
  const pin = modernSession.pinnedSlot();
  if (pin?.codebookFingerprint) {
    const out = await externalizePinnedSlot(pin);
    if (!out.ok) {
      showToast(t(out.error || 'modern.externalizeFailed'));
      return;
    }
  }
  markModernCipherExposed();
  await fn();
}

function usesModernV3() {
  return isModern(state.mainMode)
    && state.modernProtocol === 'v3'
    && validateEndwalzeWiring(state.endwalzeWiring).ok
    && validateLueckenfueller(state.lueckenfueller).ok;
}

function applyModeDefaultKey(mode) {
  const modern = mode === MAIN_MODE.MODERN;
  const preset = modern ? MODERN_DEFAULT_KEY : TRADITIONAL_DEFAULT_KEY;
  state = {
    ...state,
    ...structuredClone(preset),
    keySource: 'manual',
  };
  codebookEndwalzePolicy = defaultEndwalzePolicyForMode(mode);
}

function modernExplainerKey() {
  return 'mode.info.modern';
}

function currentDayConfig() {
  const sheet = state.codebookSheet;
  const day = sheet ? findCodebookDay(sheet, state.codebookDay) : null;
  const epoch = resolveV3Epoch({
    date: day?.date,
    year: sheet?.year,
    month: sheet?.month,
    day: state.codebookDay,
  });
  return {
    rotorThin: state.rotorThin,
    rotorLeft: state.rotorLeft,
    rotorMiddle: state.rotorMiddle,
    rotorRight: state.rotorRight,
    ringCode: state.ringCode,
    plugboard: state.plugboard,
    endwalzeWiring: state.endwalzeWiring,
    notches: state.lueckenfueller,
    networkContext: sheet?.networkContext || 'ALB',
    epoch,
  };
}

/**
 * Modern: Klartext → Base-26 + Auto-Spruchschlüssel + Endwalze/Lückenfüller.
 * @param {string} plainText UTF-8
 * @returns {string} Cipher-Buchstaben (ohne Gruppierung)
 */
function configureEngineFromFullKey(key, code) {
  const positions = applyKeyCode(code);
  if (!positions || !key) return false;
  const rings = applyRingCode(key.ringCode);
  if (!rings) return false;
  engine.setRotors(
    key.rotorLeft,
    key.rotorMiddle,
    key.rotorRight,
    key.rotorThin,
    positions[1],
    positions[2],
    positions[3],
    positions[0],
    rings.left,
    rings.middle,
    rings.right,
    rings.thin,
  );
  engine.setPlugboard(key.plugboard);
  engine.setThinRing(rings.thin);
  lastModernPlugCount = normalizePlugPairsCanonical(key.plugboard).length;
  lastModernCryptoError = null;
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setEndwalze(key.endwalzeWiring);
  engine.setLueckenfuellerNotches(key.lueckenfueller);
  return true;
}

function timebookDayConfig(key, epoch, networkContext) {
  return {
    rotorThin: key.rotorThin,
    rotorLeft: key.rotorLeft,
    rotorMiddle: key.rotorMiddle,
    rotorRight: key.rotorRight,
    ringCode: key.ringCode,
    plugboard: key.plugboard,
    endwalzeWiring: key.endwalzeWiring,
    notches: key.lueckenfueller,
    networkContext: networkContext || 'ALB',
    epoch,
  };
}

async function processTextModernEncryptTimebook(plainText) {
  const book = state.codebookSheet;
  if (modernSession.shouldRotateForPlain(plainText)) {
    invalidateModernSessionKey();
  }
  let pin = modernSession.pinnedSlot();
  if (!pin || !pin.fullKey || !pin.epoch) {
    const started = await beginTimebookSendSession({
      timebook: book,
      timestampMs: Date.now(),
      nextMessageKey: randomMessageKey4,
      preferredMessageKey: isValidFourKey(modernAutoMessageKey) ? modernAutoMessageKey : undefined,
    });
    if (!started.ok) {
      lastModernCryptoError = started.error;
      modernAutoMessageKey = '';
      modernSession.invalidate();
      return '';
    }
    modernAutoMessageKey = started.messageKey;
    modernSession.noteAuthorized({
      ...started.pin,
      messageKey: started.messageKey,
    });
    pin = modernSession.pinnedSlot();
  }
  if (!/^[A-Z]{8}$/.test(modernAutoMessageId)) {
    modernAutoMessageId = randomMessageId();
  }
  const key = pin.fullKey;
  const result = await modernV3EncryptPayload({
    engine,
    configure: (code) => configureEngineFromFullKey(key, code),
    groundKey: key.keyCode,
    plainText: String(plainText ?? ''),
    messageKey: modernAutoMessageKey,
    messageId: modernAutoMessageId,
    dayConfig: timebookDayConfig(key, pin.epoch, book.networkContext),
  });
  if (!result.ok) {
    if (result.error !== 'modern.configureFailed') lastModernCryptoError = result.error;
    return '';
  }
  lastHeaderGroup = result.header;
  lastModernResolvedKey = result.messageKey;
  modernAutoMessageKey = result.messageKey;
  modernAutoMessageId = result.messageId;
  lastOutgoingCipher = result.cipher;
  lastModernPruefgruppe = result.pruefgruppe || '';
  lastModernCryptoError = null;
  return result.cipher;
}

async function processTextModernEncrypt(plainText) {
  if (isTimebook(state.codebookSheet) && state.keySource === 'codebook') {
    return processTextModernEncryptTimebook(plainText);
  }
  if (!isValidFourKey(state.keyCode)) {
    lastModernCryptoError = 'modern.groundIncomplete';
    return '';
  }
  if (!usesModernV3()) {
    lastModernCryptoError = 'modern.needPermutation';
    return '';
  }
  let fingerprint;
  try {
    fingerprint = await fullKeyFingerprint({
      ...currentDayConfig(),
      keyCode: state.keyCode,
    });
  } catch {
    lastModernCryptoError = 'modern.securityStateFailed';
    return '';
  }

  if (modernSession.shouldInvalidateForFingerprint(fingerprint)) {
    invalidateModernSessionKey();
  }
  if (modernSession.shouldRotateForPlain(plainText)) {
    invalidateModernSessionKey();
  }

  const alreadyReserved = modernSession.isReservedFor(fingerprint, modernAutoMessageKey)
    && isValidFourKey(modernAutoMessageKey);

  if (!alreadyReserved) {
    const picked = await chooseAndReserveMessageKey({
      fullKeyFingerprint: fingerprint,
      preferredMessageKey: isValidFourKey(modernAutoMessageKey)
        ? modernAutoMessageKey
        : undefined,
      nextMessageKey: randomMessageKey4,
    });
    if (picked.status !== RESERVE.RESERVED) {
      lastModernCryptoError = 'modern.securityStateFailed';
      modernAutoMessageKey = '';
      modernSession.invalidate();
      return '';
    }
    modernAutoMessageKey = picked.messageKey;
    modernSession.noteReserved(fingerprint, picked.messageKey);
  }

  if (!/^[A-Z]{8}$/.test(modernAutoMessageId)) {
    modernAutoMessageId = randomMessageId();
  }
  const result = await modernV3EncryptPayload({
    engine,
    configure: (code) => setEngineToKeyCode(code),
    groundKey: state.keyCode,
    plainText: String(plainText ?? ''),
    messageKey: modernAutoMessageKey,
    messageId: modernAutoMessageId,
    dayConfig: currentDayConfig(),
  });
  if (!result.ok) {
    if (result.error !== 'modern.configureFailed') {
      lastModernCryptoError = result.error;
    }
    return '';
  }
  lastHeaderGroup = result.header;
  lastModernResolvedKey = result.messageKey;
  modernAutoMessageKey = result.messageKey;
  modernAutoMessageId = result.messageId;
    lastOutgoingCipher = result.cipher;
    lastModernPruefgruppe = result.pruefgruppe || '';
    lastModernCryptoError = null;
    return result.cipher;
}

/**
 * Modern: Geheimtext → Indikator auswerten + Base-26-Rückwandlung.
 * @param {string} cipherLetters nur A–Z
 * @returns {string} UTF-8-Klartext
 */
async function processTextModernDecryptTimebook(cipherLetters) {
  const book = state.codebookSheet;
  const current = getSlotForTimestamp(Date.now(), book.timeProfile);
  const found = await decryptTimebookTelegram({
    timebook: book,
    cipherLetters,
    currentSlot: current,
    networkContext: book.networkContext,
    engine,
    configure: (code, key) => configureEngineFromFullKey(key, code),
  });
  if (found.status === MAC_SEARCH.AMBIGUOUS_KEY_MATCH) {
    lastModernCryptoError = 'modern.ambiguousKey';
    return '';
  }
  if (found.status !== MAC_SEARCH.MATCH || !found.result?.ok) {
    lastModernCryptoError = found.error === 'modern.v3TooShort' ? null : 'modern.noKeyMatch';
    return '';
  }
  lastModernCryptoError = null;
  lastDecryptedCipher = cipherLetters;
  lastHeaderGroup = found.result.header;
  lastModernResolvedKey = found.result.messageKey;
  modernAutoMessageId = found.result.messageId || '';
  lastModernPruefgruppe = found.result.pruefgruppe || '';
  return found.result.plainText;
}

async function processTextModernDecrypt(cipherLetters) {
  if (isTimebook(state.codebookSheet) && state.keySource === 'codebook') {
    const clean = String(cipherLetters ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length < 4) {
      lastModernCryptoError = null;
      return '';
    }
    if (!isV3Telegram(clean)) {
      lastModernCryptoError = clean.length < 36 ? null : 'modern.notV3';
      return '';
    }
    return processTextModernDecryptTimebook(clean);
  }
  if (!isValidFourKey(state.keyCode)) {
    lastModernCryptoError = 'modern.groundIncomplete';
    return '';
  }
  const clean = String(cipherLetters ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length < 4) {
    lastModernCryptoError = null;
    return '';
  }
  if (!usesModernV3()) {
    lastModernCryptoError = 'modern.needPermutation';
    return '';
  }
  if (!isV3Telegram(clean)) {
    lastModernCryptoError = clean.length < 36 ? null : 'modern.notV3';
    return '';
  }
  const skipReplay = clean === lastOutgoingCipher || clean === lastDecryptedCipher;
  const result = await modernV3DecryptPayload({
    engine,
    configure: (code) => setEngineToKeyCode(code),
    groundKey: state.keyCode,
    cipherLetters: clean,
    dayConfig: currentDayConfig(),
    replayCache: skipReplay ? null : replayCache,
  });
  if (!result.ok) {
    if (result.error === 'modern.v3TooShort') {
      lastModernCryptoError = null;
    } else if (result.error !== 'modern.configureFailed') {
      lastModernCryptoError = result.error;
    }
    return '';
  }
    lastModernCryptoError = null;
    lastDecryptedCipher = clean;
    lastHeaderGroup = result.header;
    lastModernResolvedKey = result.messageKey;
    modernAutoMessageId = result.messageId || '';
    lastModernPruefgruppe = result.pruefgruppe || '';
    return result.plainText;
  }

function usesDirectionRoles() {
  return usesTraditionalMessageKey(state) || isModern(state.mainMode);
}

function isCipherRole() {
  if (isModern(state.mainMode)) return state.inputRole === 'cipher';
  return usesTraditionalMessageKey(state) && state.inputRole === 'cipher';
}

function isPlainMessageRole() {
  return usesTraditionalMessageKey(state) && state.inputRole === 'plain';
}

/** Traditionell · Spruchschlüssel · Geheimtext vor Kopfgruppen-Split */
function isTraditionalCipherAwaitingSplit() {
  return usesTraditionalMessageKey(state) && state.inputRole === 'cipher' && !messageReceive;
}

/**
 * Chiffre-Pfad (Traditionell): message oder simple.
 * Modern läuft über processTextModernEncrypt/Decrypt in liveEncrypt.
 */
function processTextFromBase(letters) {
  if (usesTraditionalMessageKey(state)) {
    return processTextMessage(letters);
  }
  lastHeaderGroup = '';
  return processTextSimple(letters);
}

/**
 * Nachricht erneut durch die Maschine jagen (Walzenstand / Live-Anzeige).
 * @returns {string} Ausgabe (Cipher gruppiert oder UTF-8-Klartext)
 */
async function reprocessCurrentInput() {
  if (!state.plaintext) {
    resetMachineFromPanel();
    return '';
  }
  if (isModern(state.mainMode)) {
    if (state.inputRole === 'cipher') {
      return processTextModernDecrypt(extractLetters(state.plaintext));
    }
    return processTextModernEncrypt(state.plaintext);
  }
  if (isTraditionalCipherAwaitingSplit()) {
    resetMachineFromPanel();
    return '';
  }
  return processTextFromBase(extractLetters(state.plaintext));
}

function rotorVisuals() {
  const thinId = engine.rotors.thin.id === 'Beta' ? 'β' : 'γ';
  const labels = rotorCardLabels();
  return [
    { label: labels[0], id: thinId, position: engine.posToLetter(engine.rotors.thin.pos) },
    { label: labels[1], id: engine.rotors.left.id, position: engine.posToLetter(engine.rotors.left.pos) },
    { label: labels[2], id: engine.rotors.middle.id, position: engine.posToLetter(engine.rotors.middle.pos) },
    { label: labels[3], id: engine.rotors.right.id, position: engine.posToLetter(engine.rotors.right.pos) },
  ];
}

async function liveEncrypt(preparedPlain) {
  const seq = ++liveEncryptSeq;
  if (state.courierOn) return;
  // Traditionell · Spruchschlüssel · Geheimtext: vor Split kein Maschinenlauf
  if (isTraditionalCipherAwaitingSplit()) {
    state.plaintext = preparedPlain;
    state.ciphertext = '';
    resetMachineFromPanel();
    renderRotorSection({ useCurrentEngine: true });
    renderMessageKeyUi();
    return;
  }

  state.plaintext = preparedPlain;

  if (isModern(state.mainMode)) {
    if (state.inputRole === 'cipher') {
      const result = await processTextModernDecrypt(extractLetters(preparedPlain));
      if (seq !== liveEncryptSeq) return;
      state.ciphertext = result;
    } else {
      const cipher = await processTextModernEncrypt(preparedPlain);
      if (seq !== liveEncryptSeq) return;
      state.ciphertext = cipher ? formatGroupedOutput(cipher) : '';
    }
    paintCipherOutput();
    renderRotorSection({ useCurrentEngine: true });
    renderMessageKeyUi();
    return;
  }

  const letters = extractLetters(preparedPlain);
  const result = processTextFromBase(letters);
  state.ciphertext = formatGroupedOutput(result);
  renderRotorSection({ useCurrentEngine: true });
  renderMessageKeyUi();
}

/** Ausgabe nach async Modern-Lauf, ohne die Eingabe (Cursor) anzufassen. */
function paintCipherOutput() {
  if (els.outputText) els.outputText.value = state.ciphertext ?? '';
  if (els.outputCount) {
    if (isModern(state.mainMode)) {
      const outLetters = extractLetters(state.ciphertext);
      els.outputCount.textContent = `${outLetters.length}/${state.ciphertext.length}`;
    } else {
      const outputCounts = messageCounts(state.ciphertext);
      els.outputCount.textContent = `${outputCounts.machineLetters}/${outputCounts.totalCharacters}`;
    }
  }
  renderCourierUi();
}

function applyManualEndwalzeWiring(raw, opts = {}) {
  const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 26);
  const checked = validateEndwalzeWiring(cleaned);
  const err = document.getElementById('endwalzeWiringError');
  if (err) {
    err.hidden = checked.ok || cleaned.length === 0;
    err.textContent = checked.ok || cleaned.length === 0
      ? ''
      : t(checked.error || 'modern.endwalzeInvalid');
  }
  if (!checked.ok && !opts.force) return;
  const notchesOk = validateLueckenfueller(state.lueckenfueller).ok;
  updateSetting({
    modernProtocol: 'v3',
    endwalzeWiring: checked.ok ? checked.wiring : cleaned,
    lueckenfueller: notchesOk ? state.lueckenfueller : generateLueckenfueller(),
  });
}

function updateSetting(patch, reprocess = true) {
  // Schlüsselwechsel im Modern-Modus: neuen Session-Spruchschlüssel
  const keyRelated = [
    'keyCode', 'ringCode', 'ringLeft', 'ringMiddle', 'ringRight',
    'rotorLeft', 'rotorMiddle', 'rotorRight', 'rotorThin',
    'reflectorId', 'reflectorD', 'plugboard', 'endwalzeWiring', 'lueckenfueller',
    'posLeft', 'posMiddle', 'posRight', 'posThin',
  ].some((k) => Object.prototype.hasOwnProperty.call(patch, k));
  if (keyRelated && isModern(state.mainMode)) {
    invalidateModernSessionKey();
  }
  state = { ...state, ...patch };
  saveState();
  resetMachineFromPanel();
  if (reprocess && state.plaintext) liveEncrypt(state.plaintext);
  renderAll();
}

/**
 * Hauptmodus Traditionell | Modern.
 * keyMode bleibt beim Wechsel erhalten (Rückkehr zu Traditionell · …).
 */
function setMainMode(mode) {
  if (mode !== MAIN_MODE.TRADITIONAL && mode !== MAIN_MODE.MODERN) return;
  if (state.mainMode === mode) return;

  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  lastModernCryptoError = null;

  const patch = {
    mainMode: /** @type {MainMode} */ (mode),
    inputRole: /** @type {InputRole} */ ('plain'),
    plaintext: '',
    ciphertext: '',
  };
  if (
    mode === MAIN_MODE.TRADITIONAL
    && state.keyMode === KEY_MODE.MESSAGE
    && !isValidFourKey(state.messageKey)
  ) {
    patch.messageKey = randomFourLetters();
  }

  state = { ...state, ...patch };
  if (mode === MAIN_MODE.MODERN) {
    const leftoverLegacy = state.codebookSheet && !isModernPermutationSheet(state.codebookSheet);
    if (leftoverLegacy || !usesModernV3()) {
      applyModeDefaultKey(MAIN_MODE.MODERN);
      if (leftoverLegacy) state = { ...state, keySource: 'manual' };
    }
  }
  codebookEndwalzePolicy = defaultEndwalzePolicyForMode(mode);
  saveState();
  resetMachineFromPanel();
  renderAll();
  syncCodebookEndwalzePolicyUi();
  showActionFeedback(
    mode === MAIN_MODE.MODERN ? t('toast.modeModern') : t('toast.modeTraditional'),
  );
}

/** Traditionelle Unteroption Einfach | Spruchschlüssel (nur im Hauptmodus Traditionell). */
function setKeyMode(mode) {
  if (mode !== KEY_MODE.SIMPLE && mode !== KEY_MODE.MESSAGE) return;
  if (!isTraditional(state.mainMode)) return;
  if (state.keyMode === mode) return;

  messageReceive = false;
  lastHeaderGroup = '';

  const patch = {
    keyMode: mode,
    inputRole: /** @type {InputRole} */ ('plain'),
    plaintext: '',
    ciphertext: '',
  };
  if (mode === KEY_MODE.MESSAGE && !isValidFourKey(state.messageKey)) {
    patch.messageKey = randomFourLetters();
  }

  state = { ...state, ...patch };
  saveState();
  resetMachineFromPanel();
  renderAll();
  showActionFeedback(mode === KEY_MODE.MESSAGE ? t('toast.modeMessage') : t('toast.modeSimple'));
}

async function setInputRole(role) {
  if (role !== 'plain' && role !== 'cipher') return;
  if (!usesDirectionRoles()) return;
  if (state.inputRole === role) return;

  // Modern: Klartext→Geheimtext — erzeugten Geheimtext für Selbsttest übernehmen
  const cipherToSelfTest =
    isModern(state.mainMode) && role === 'cipher' && state.inputRole === 'plain'
      ? extractLetters(state.ciphertext)
      : '';

  messageReceive = false;
  if (isModern(state.mainMode) && role === 'plain') {
    invalidateModernSessionKey();
    lastHeaderGroup = '';
  }
  state = {
    ...state,
    inputRole: role,
    plaintext: '',
    ciphertext: '',
  };
  saveState();
  resetMachineFromPanel();

  if (cipherToSelfTest.length >= 4) {
    await liveEncrypt(formatGroupedOutput(cipherToSelfTest));
    renderAll();
    if (lastModernCryptoError) {
      showActionFeedback(t(lastModernCryptoError, {
        count: String(lastModernPlugCount),
        min: String(MIN_STECKER_PAIRS),
      }));
    } else {
      showActionFeedback(t('toast.roleCipher'));
    }
    return;
  }

  renderAll();
  showActionFeedback(role === 'cipher' ? t('toast.roleCipher') : t('toast.rolePlain'));
}

function onMessageKeyInput(event) {
  const cleaned = event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  event.target.value = cleaned;
  // Spruchschlüssel manuell nur im Klartext-/Sende-Modus sinnvoll überschreiben
  if (isCipherRole() && messageReceive) {
    // Nach Split: manuelle Änderung des Schlüssels → Körper neu entschlüsseln
    state = { ...state, messageKey: cleaned };
    saveState();
    if (state.plaintext) liveEncrypt(state.plaintext);
    else renderMessageKeyUi();
    renderRotorSection({ useCurrentEngine: !!state.plaintext });
    return;
  }
  if (isCipherRole()) {
    state = { ...state, messageKey: cleaned };
    saveState();
    renderMessageKeyUi();
    return;
  }
  lastHeaderGroup = '';
  state = { ...state, messageKey: cleaned };
  saveState();
  if (state.plaintext) liveEncrypt(state.plaintext);
  else renderMessageKeyUi();
  renderRotorSection({ useCurrentEngine: !!state.plaintext });
}

function randomizeMessageKey() {
  messageReceive = false;
  lastHeaderGroup = '';
  const messageKey = randomFourLetters();
  state = { ...state, messageKey };
  saveState();
  if (els.messageKeyInput) els.messageKeyInput.value = messageKey;
  if (state.plaintext) liveEncrypt(state.plaintext);
  else {
    resetMachineFromPanel();
    renderMessageKeyUi();
    renderRotorSection();
  }
  showToast(t('toast.messageKey', { key: messageKey }));
}

function onInputChanged(event) {
  const input = event.target;
  const previous = state.plaintext;

  if (isCipherRole()) {
    // Geheimtext: nur A–Z und Leerzeichen (4er-Gruppen)
    const raw = input.value.toUpperCase().replace(/[^A-Z \n\t]/g, '');
    const prepared = raw.replace(/[ \t\n]+/g, ' ').replace(/  +/g, ' ');
    // Traditionell · Spruchschlüssel: ab 5. Buchstaben Kopfgruppe abspalten
    if (usesTraditionalMessageKey(state) && !messageReceive) {
      const clean = prepared.replace(/[^A-Z]/g, '');
      if (clean.length > 4) {
        ingestCiphertext(clean);
        return;
      }
    }
    liveEncrypt(prepared.trimStart());
    renderTextFields();
    return;
  }

  // Modern-Klartext: voller UTF-8-Zeichensatz (Base-26), keine Enigma-Normalisierung
  if (isModern(state.mainMode)) {
    const raw = input.value;
    liveEncrypt(raw);
    renderTextFields();
    return;
  }

  const prepared = preparePlaintextForEditing(input.value, previous);
  const cursor = computePreparedCursor(input.value, input.selectionStart, previous, prepared);
  liveEncrypt(prepared);
  renderTextFields();
  input.value = state.plaintext;
  input.setSelectionRange(cursor, cursor);
}

function onInputKeydown(event) {
  // Traditionell / Geheimtext: kein Zeilenumbruch. Modern · Klartext: Enter erlaubt (UTF-8/Base-26).
  if (event.key === 'Enter') {
    if (!isModern(state.mainMode) || isCipherRole()) {
      event.preventDefault();
    }
  }
}

/**
 * STRG+V im Eingabefeld: Text kommt im Paste-Event (clipboardData — immer zuverlässig).
 * Klartext → an Cursor einfügen; Geheimtext → Split Kopfgruppe / Körper.
 */
function onInputPaste(event) {
  if (event.defaultPrevented) return;
  // Nach Button-Klick übernimmt der Capture-Handler auf document
  if (pasteArmed) return;
  const text = event.clipboardData?.getData('text/plain') ?? '';
  event.preventDefault();
  if (isCipherRole()) {
    void ingestCiphertext(text);
    return;
  }
  insertPlaintextAtCursor(text);
}

/** Nach Einfügen-Button: nächstes STRG+V im Fenster abfangen (kein System-Menü). */
function onDocumentPasteWhenArmed(event) {
  if (!pasteArmed) return;
  if (event.target === els.messageKeyInput) {
    const letters = (event.clipboardData?.getData('text/plain') ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (letters.length <= 4) return;
  }
  const text = event.clipboardData?.getData('text/plain') ?? '';
  event.preventDefault();
  event.stopPropagation();
  disarmPasteCapture();
  applyPastedText(text, { replacePlain: true });
}

function onInputDrop(event) {
  const text = event.dataTransfer?.getData('text/plain') ?? '';
  if (!text) return;
  event.preventDefault();
  if (isCipherRole()) {
    void ingestCiphertext(text);
    return;
  }
  insertPlaintextAtCursor(text);
}

/** Im Spruchschlüsselfeld nur kurze Schlüssel; langer Text = Geheimtext-Split. */
function onMessageKeyPaste(event) {
  if (!usesTraditionalMessageKey(state)) return;
  const text = event.clipboardData?.getData('text/plain') ?? '';
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length > 4) {
    event.preventDefault();
    if (state.inputRole !== 'cipher') setInputRole('cipher');
    void ingestCiphertext(text);
  }
}

function clearInput({ notify = true } = {}) {
  state.plaintext = '';
  state.ciphertext = '';
  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  alignEngineToBaseWhenEmpty();
  renderAll();
  if (notify) showActionFeedback(t('toast.inputCleared'));
}

function clearAll() {
  clearInput({ notify: false });
  // Spruchschlüssel oben links mit leeren (Modus bleibt)
  if (state.messageKey) {
    state = { ...state, messageKey: '' };
    saveState();
  }
  if (els.messageKeyInput) els.messageKeyInput.value = '';
  lastHeaderGroup = '';
  alignEngineToBaseWhenEmpty();
  renderAll();
  showActionFeedback(t('toast.fieldsCleared'));
}

function alignEngineToBaseWhenEmpty() {
  if (!canEditRotorSetup()) return;
  resetMachineFromPanel();
}

function wantsCodebookDeepLink() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  if (hash === CODEBOOK_HASH) return true;
  try {
    return new URLSearchParams(location.search).has('codebook');
  } catch {
    return false;
  }
}

function normalizeCodebookDeepLinkUrl() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('codebook')) return;
    url.searchParams.delete('codebook');
    url.hash = CODEBOOK_HASH;
    history.replaceState(null, '', url);
  } catch {
    /* ignore */
  }
}

function applyCodebookDeepLink() {
  if (!wantsCodebookDeepLink()) return;
  normalizeCodebookDeepLinkUrl();
  if (state.courierOn) {
    showToast(t('toast.courierNoKeys'));
    return;
  }
  setKeySource('codebook');
  openSetupIfAllowed();
}

function openSetupIfAllowed() {
  if (!canEditRotorSetup()) {
    showToast(t('toast.rotorsLocked'));
    return;
  }
  alignEngineToBaseWhenEmpty();
  renderSetupForm();
  openModal('setupModal');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  if (id === 'qrShareModal') stopLiveShare({ silent: true });
  document.getElementById(id).classList.remove('open');
}

function closeSetup() {
  closeModal('setupModal');
}

function resetDefault() {
  const keep = {
    mainMode: state.mainMode,
    keyMode: state.keyMode,
    networks: state.networks,
    activeNetworkId: state.activeNetworkId,
    codebookSheet: state.codebookSheet,
    codebookDay: state.codebookDay,
    courierOn: state.courierOn,
  };
  applyModeDefaultKey(keep.mainMode);
  state = {
    ...state,
    ...keep,
    plaintext: '',
    ciphertext: '',
    keySource: 'manual',
    messageKey: keep.mainMode === MAIN_MODE.TRADITIONAL && keep.keyMode === KEY_MODE.MESSAGE
      ? randomFourLetters()
      : '',
  };
  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  saveState();
  resetMachineFromPanel();
  renderAll();
  renderSetupForm();
  showToast(t('toast.defaultsLoaded'));
}

/**
 * Taste „Zufällig“: Tagesschlüssel (Traditionell & Modern) via CSPRNG.
 * Entspricht dem Qualitätsniveau des Codebook-Generators.
 */
function randomizeSettings() {
  if (!canEditRotorSetup()) {
    showToast(t('toast.rotorsLocked'));
    return;
  }
  const [rotorLeft, rotorMiddle, rotorRight] = randomMainRotors(MAIN_ROTOR_IDS);
  if (isModern(state.mainMode)) codebookEndwalzePolicy = ENDWALZE_POLICY.PERMUTATION;
  else if (!policyFitsMainMode(codebookEndwalzePolicy, state.mainMode)) {
    codebookEndwalzePolicy = ENDWALZE_POLICY.HISTORIC;
  }
  const policy = codebookEndwalzePolicy;
  const v3Random = isModern(state.mainMode) || usesPermutationEndwalze(policy);
  const reflector = pickReflectorIdForPolicy(policy, pick) || REFLECTOR_ID_BRUNO;
  const doraFree = usesFreeDoraWiring(policy);
  const rotorThin = pick(THIN_ROTOR_IDS);
  let endwalzeWiring = '';
  let lueckenfueller = null;
  if (v3Random) {
    try {
      endwalzeWiring = generateEndwalzeWiring();
      lueckenfueller = generateLueckenfueller();
    } catch {
      showToast(t('modern.endwalzeGenerateFailed'));
      return;
    }
  }

  const ringThin = randomLetter();
  const ringLeft = randomLetter();
  const ringMiddle = randomLetter();
  const ringRight = randomLetter();
  const posThin = randomLetter();
  const posLeft = randomLetter();
  const posMiddle = randomLetter();
  const posRight = randomLetter();

  // Modern braucht ≥3 Stecker; 10 Paare wie Codebook/Kriegsmarine
  const plugPairs = randomPlugboard(10);

  state = {
    ...state,
    keySource: 'manual',
    doraFree,
    reflectorId: reflector,
    rotorLeft,
    rotorMiddle,
    rotorRight,
    rotorThin,
    posLeft,
    posMiddle,
    posRight,
    posThin,
    ringThin,
    ringLeft,
    ringMiddle,
    ringRight,
    plugboard: plugPairs,
    modernProtocol: v3Random ? 'v3' : 'v2',
    endwalzeWiring,
    lueckenfueller,
    reflectorD: reflector === REFLECTOR_ID_DORA
      ? (doraFree ? randomDoraFreePairs() : randomDoraEditablePairs())
      : state.reflectorD,
    plaintext: '',
    ciphertext: '',
    ringCode: buildRingCode(ringThin, ringLeft, ringMiddle, ringRight),
    keyCode: buildKeyCode(posThin, posLeft, posMiddle, posRight),
    // Traditionell · Spruchschlüssel-Verfahren: neuen SK mitwürfeln
    // Modern: Auto-SK kommt aus randomMessageKey4 (CSPRNG) beim nächsten Senden
    messageKey: usesTraditionalMessageKey(state) ? randomFourLetters() : state.messageKey,
  };

  messageReceive = false;
  lastHeaderGroup = '';
  invalidateModernSessionKey();
  saveState();
  resetMachineFromPanel();
  renderAll();
  renderSetupForm();
  showToast(t('toast.randomSettings'));
}

function mainRotorDuplicateHint(rotorId, slot) {
  /** @type {string | null} */
  let slotKey = null;
  if (slot !== 'left' && state.rotorLeft === rotorId) slotKey = 'dup.slotLeft';
  else if (slot !== 'middle' && state.rotorMiddle === rotorId) slotKey = 'dup.slotMiddle';
  else if (slot !== 'right' && state.rotorRight === rotorId) slotKey = 'dup.slotRight';
  if (!slotKey) return null;
  return t('dup.hint', { id: rotorId, slot: t(slotKey) });
}

function showDuplicateHint(text) {
  duplicateRotorHint = text;
  if (duplicateHintTimer) clearTimeout(duplicateHintTimer);
  if (els.duplicateRotorHint) {
    els.duplicateRotorHint.textContent = text ?? '';
    els.duplicateRotorHint.hidden = !text;
  }
  if (text) duplicateHintTimer = setTimeout(() => showDuplicateHint(null), 5000);
}

function formatKeyExport() {
  const modern = isModern(state.mainMode);
  const v3 = usesModernV3();
  const reflector = v3 ? state.endwalzeWiring : reflectorLabel(state.reflectorId);
  // Traditionell: UKW Bruno/Caesar/Dora · Modern V2: EW + Typ · V3: EW + 26-Buchstaben-Verdrahtung
  const prefix = modern ? t('export.ewPrefix') : t('export.ukwPrefix');
  const walzenlage = `${prefix} ${reflector}-${state.rotorThin}-${state.rotorLeft}-${state.rotorMiddle}-${state.rotorRight}`;
  const stecker = parsePlugboardPairs(state.plugboard).join(' ');
  const lines = [
    `${t('export.walzenlage')}: ${walzenlage}`,
    `${t('export.rings')}: ${state.ringCode}`,
  ];
  if (modern && validateLueckenfueller(state.lueckenfueller).ok) {
    const n = state.lueckenfueller;
    lines.push(t('export.notches', {
      left: n.left,
      middle: n.middle,
      right: n.right,
    }));
  }
  lines.push(`${t('export.stecker')}: ${stecker}`);
  if (!v3 && state.reflectorId === REFLECTOR_ID_DORA) {
    lines.push(`${modern ? t('export.ewd') : t('export.ukwd')}: ${formatDoraPairs(state.reflectorD, state.doraFree)}`);
  }
  if (usesTraditionalMessageKey(state) || modern) {
    lines.push(`${t('export.grundstellung')}: ${state.keyCode}`);
    if (usesTraditionalMessageKey(state) && isValidFourKey(state.messageKey)) {
      lines.push(`${t('export.spruchschluessel')}: ${state.messageKey}`);
    }
    if (modern) {
      lines.push(`${t('export.modernNote')}: ${t('export.modernAuto')}`);
    }
  } else {
    lines.push(`${t('export.spruchschluessel')}: ${state.keyCode}`);
  }
  return lines.join('\n');
}

function dashIfEmpty(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function formatModernSessionExport() {
  const key = isValidFourKey(lastModernResolvedKey) ? lastModernResolvedKey : '';
  const header = lastHeaderGroup.length === 4 ? lastHeaderGroup : '';
  const mid = /^[A-Z]{8}$/.test(modernAutoMessageId) ? modernAutoMessageId : '';
  const pruef = lastModernPruefgruppe.length === 20
    ? formatLetterGroups4(lastModernPruefgruppe)
    : '';
  return [
    `${t('modern.stampLabel')}: ALBV`,
    `${t('modern.autoKeyLabel')}: ${dashIfEmpty(key)}`,
    `${t('message.headerGroupLabel')}: ${dashIfEmpty(header)}`,
    `${t('modern.messageIdLabel')}: ${dashIfEmpty(mid)}`,
    `${t('modern.pruefLabel')}: ${dashIfEmpty(pruef)}`,
  ].join('\n');
}

async function copyText(text, message) {
  const value = text ?? '';
  appClipboard = value;
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    }
    showActionFeedback(message);
  } catch {
    // System-Zwischenablage gesperrt — App-Spiegel bleibt für den Einfügen-Button nutzbar
    showActionFeedback(message);
  }
}

/**
 * Einfügen-Button — wie in früheren Alberich-Versionen: readText im Klick.
 * Chrome und Firefox (nach einmaliger Erlaubnis). Kein execCommand (System-Menü).
 *
 * 1) System-Zwischenablage (readText)
 * 2) App-Spiegel (letztes Kopieren in Alberich)
 * 3) Feld scharf → STRG+V (Paste-Event)
 */
function onPasteButtonClick(event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }

  const finishWith = (text) => {
    if (text == null || String(text).length === 0) return false;
    disarmPasteCapture();
    applyPastedText(text, { replacePlain: true });
    return true;
  };

  const fallback = () => {
    if (finishWith(appClipboard)) return;
    armPasteCapture();
  };

  // Wie früher: readText in allen Browsern (Firefox fragt ggf. einmal nach Erlaubnis).
  if (window.isSecureContext && navigator.clipboard?.readText) {
    navigator.clipboard.readText().then(
      (text) => {
        if (finishWith(text)) {
          appClipboard = String(text);
          return;
        }
        fallback();
      },
      () => fallback(),
    );
    return;
  }

  fallback();
}

function disarmPasteCapture() {
  pasteArmed = false;
  pasteArmToken += 1;
  els.inputText?.classList.remove('paste-ready');
}

/**
 * Eingabe scharf schalten: nächstes STRG+V im Fenster wird abgefangen und eingefügt.
 * Kein execCommand('paste') — der öffnet unter manchen Systemen ein Paste-Menü.
 */
function armPasteCapture() {
  pasteArmed = true;
  pasteArmToken += 1;
  const token = pasteArmToken;
  els.inputText?.classList.remove('paste-ready');
  void els.inputText?.offsetWidth;
  els.inputText?.classList.add('paste-ready');
  try {
    els.inputText?.focus({ preventScroll: true });
  } catch {
    els.inputText?.focus();
  }
  showActionFeedback(t('toast.pasteShortcut'));
  window.setTimeout(() => {
    if (pasteArmToken === token) disarmPasteCapture();
  }, 12000);
}

/** Einheitlicher Paste-Zielweg: Geheimtext → Split; Klartext → ersetzen oder an Cursor. */
function applyPastedText(raw, { replacePlain = false } = {}) {
  if (isCipherRole()) {
    void ingestCiphertext(raw);
    return;
  }
  if (replacePlain) {
    ingestPlaintext(raw);
    return;
  }
  insertPlaintextAtCursor(raw);
}

/** Klartext an Cursorposition (STRG+V beim Tippen). */
function insertPlaintextAtCursor(raw) {
  const el = els.inputText;
  const text = String(raw ?? '');
  if (!el) {
    ingestPlaintext(text);
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const merged = el.value.slice(0, start) + text + el.value.slice(end);

  if (isModern(state.mainMode)) {
    const cursor = start + text.length;
    liveEncrypt(merged);
    renderTextFields();
    el.focus();
    el.setSelectionRange(cursor, cursor);
    showActionFeedback(t('toast.pasted'));
    return;
  }

  const previous = state.plaintext;
  const prepared = preparePlaintextForEditing(merged, previous);
  const cursor = computePreparedCursor(merged, start + text.length, previous, prepared);
  liveEncrypt(prepared);
  renderTextFields();
  el.focus();
  el.setSelectionRange(cursor, cursor);
  showActionFeedback(t('toast.pasted'));
}

/** Klartext komplett ersetzen (Einfügen-Button / Senden). */
function ingestPlaintext(raw) {
  if (isModern(state.mainMode)) {
    liveEncrypt(String(raw ?? ''));
    renderTextFields();
    showActionFeedback(t('toast.pasted'));
    return;
  }
  const previous = state.plaintext;
  const prepared = preparePlaintextForEditing(String(raw ?? ''), previous);
  liveEncrypt(prepared);
  renderTextFields();
  showActionFeedback(t('toast.pasted'));
}

/**
 * Geheimtext einfügen.
 * - Modern: gesamter Text (inkl. Kopfgruppe) → Auto-Indikator + Base-26-Rückwandlung
 * - Traditionell · Spruchschlüssel: Kopfgruppe (4) + Körper
 */
async function ingestCiphertext(raw) {
  if (state.courierOn) {
    courierLetters = formatGroupedOutput(lettersFromInput(raw));
    renderCourierUi();
    showActionFeedback(t('toast.pasted'));
    return;
  }
  if (isModern(state.mainMode)) {
    if (state.inputRole !== 'cipher') {
      state = { ...state, inputRole: 'cipher' };
      saveState();
    }
    if (!isValidFourKey(state.keyCode)) {
      showActionFeedback(t('toast.baseIncomplete'));
      return;
    }
    const clean = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    messageReceive = false;
    await liveEncrypt(formatGroupedOutput(clean));
    renderTextFields();
    renderAll();
    if (lastModernCryptoError) {
      showActionFeedback(t(lastModernCryptoError, {
        count: String(lastModernPlugCount),
        min: String(MIN_STECKER_PAIRS),
      }));
    } else {
      showActionFeedback(t('toast.pasted'));
    }
    return;
  }

  if (usesTraditionalMessageKey(state) && state.inputRole !== 'cipher') {
    state = { ...state, inputRole: 'cipher' };
  }

  if (!isValidFourKey(state.keyCode)) {
    showActionFeedback(t('toast.baseIncomplete'));
    return;
  }

  const clean = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length < 4) {
    showActionFeedback(t('toast.tooShortForHeader'));
    return;
  }

  const header = clean.slice(0, 4);
  const body = clean.slice(4);

  if (!setEngineToKeyCode(state.keyCode)) return;
  const recoveredKey = engine.encryptMessage(header);
  lastHeaderGroup = header;
  messageReceive = true;

  state = { ...state, messageKey: recoveredKey, inputRole: 'cipher' };
  saveState();
  if (els.messageKeyInput) els.messageKeyInput.value = recoveredKey;

  liveEncrypt(formatGroupedOutput(body));
  renderTextFields();
  renderAll();
  showActionFeedback(t('toast.pastedKey', { key: recoveredKey }));
}

async function shareOutput() {
  if (!state.ciphertext) return;
  await externalizeThen(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: state.ciphertext });
        return;
      } catch {
        /* fall through */
      }
    }
    await copyText(state.ciphertext, t('toast.outputCopied'));
  });
}

let toastHideTimer = null;

/** Kurze, dezente Bestätigung für UI-Aktionen (Kopieren, Einfügen, Löschen, …). */
function showActionFeedback(message) {
  showToast(message, 1400);
}

function showToast(message, durationMs = 2200) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('show');
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    toastHideTimer = null;
  }, durationMs);
}

async function onShowCourierQr(sourceText) {
  const text = typeof sourceText === 'string' ? sourceText : state.ciphertext;
  if (!state.courierOn && text === state.ciphertext) {
    let released = !modernSession.pinnedSlot()?.codebookFingerprint;
    await externalizeThen(async () => { released = true; });
    if (!released) return;
  }
  if (!canShowCourierQr(text)) {
    showToast(t('courier.qrTooLong'));
    return;
  }
  const btn = els.btnShowCourierQr;
  if (btn) btn.disabled = true;
  try {
    const payload = buildCourierPayload(text);
    const letters = cipherLettersFromField(text);
    const { blob } = await payloadToQrPngBlob(payload, {
      ecc: 'M',
      mode: 'Alphanumeric',
      fallbackEcc: false,
      scale: 8,
      margin: 2,
    });
    clearQrShareExport();
    const filename = 'alberich-courier-qr.png';
    const objectUrl = URL.createObjectURL(blob);
    lastQrShareExport = { blob, filename, objectUrl, stats: {} };
    if (els.qrShareTitle) els.qrShareTitle.textContent = t('courier.qrTitle');
    fillTafelwortLine(els.qrShareTafelwort, null);
    if (els.qrShareHint) els.qrShareHint.hidden = true;
    if (els.qrShareImg) {
      els.qrShareImg.src = objectUrl;
      els.qrShareImg.alt = t('courier.qrTitle');
    }
    if (els.qrShareMeta) {
      els.qrShareMeta.textContent = t('courier.qrMeta', { count: String(letters) });
    }
    if (els.btnShareQrPng) {
      els.btnShareQrPng.hidden = !navigator.share;
    }
    openModal('qrShareModal');
  } catch (err) {
    logAppError('courier-qr', err);
    showToast(t('courier.qrFailed'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderCourierUi() {
  const on = !!state.courierOn;
  els.btnCourierOff?.classList.toggle('active', !on);
  els.btnCourierOn?.classList.toggle('active', on);
  if (els.courierRoleHint) els.courierRoleHint.hidden = !on;
  if (els.machineWorkspace) els.machineWorkspace.hidden = on;
  if (els.courierBridge) els.courierBridge.hidden = !on;

  const modern = isModern(state.mainMode);
  const cipherRole = modern && state.inputRole === 'cipher';
  if (els.btnShowCourierQr) {
    els.btnShowCourierQr.hidden = !modern || on;
    els.btnShowCourierQr.disabled = !canShowCourierQr(state.ciphertext);
  }
  if (els.btnScanInputCourierQr) {
    els.btnScanInputCourierQr.hidden = !cipherRole || on;
  }

  if (els.courierLengthWarn) {
    if (on || !modern || !state.plaintext) {
      els.courierLengthWarn.hidden = true;
      els.courierLengthWarn.textContent = '';
    } else {
      const n = state.inputRole === 'cipher'
        ? cipherLettersFromField(state.plaintext)
        : cipherLettersFromPlain(state.plaintext);
      const fit = courierFit(n);
      if (fit === 'ok') {
        els.courierLengthWarn.hidden = true;
        els.courierLengthWarn.textContent = '';
      } else {
        els.courierLengthWarn.hidden = false;
        els.courierLengthWarn.classList.toggle('over', fit === 'over');
        els.courierLengthWarn.textContent = t(
          fit === 'over' ? 'courier.warnOver' : 'courier.warnApproaching',
          { count: String(n), max: String(MAX_CIPHER_LETTERS) },
        );
      }
    }
  }

  if (!on) return;

  const hasSheet = hasAnyStoredSheet();
  if (els.courierBridgeSheetWarn) els.courierBridgeSheetWarn.hidden = !hasSheet;
  if (els.btnCourierWipeAll) els.btnCourierWipeAll.hidden = !hasSheet;

  const n = cipherLettersFromField(courierLetters);
  if (els.courierLettersInput && els.courierLettersInput !== document.activeElement) {
    els.courierLettersInput.value = courierLetters;
  }
  if (els.courierLetterCount) {
    els.courierLetterCount.textContent = n
      ? t('courier.letterCount', { count: String(n), max: String(MAX_CIPHER_LETTERS) })
      : '0';
  }
  if (els.btnCourierShowQr) {
    els.btnCourierShowQr.disabled = !canShowCourierQr(courierLetters);
  }
  if (els.courierBridgeLengthWarn) {
    const fit = courierFit(n);
    if (!n || fit === 'ok') {
      els.courierBridgeLengthWarn.hidden = true;
    } else {
      els.courierBridgeLengthWarn.hidden = false;
      els.courierBridgeLengthWarn.classList.toggle('over', fit === 'over');
      els.courierBridgeLengthWarn.textContent = t(
        fit === 'over' ? 'courier.warnOver' : 'courier.warnApproaching',
        { count: String(n), max: String(MAX_CIPHER_LETTERS) },
      );
    }
  }
}

function renderTextFields() {
  els.inputText.value = state.plaintext;
  els.outputText.value = state.ciphertext;

  if (isModern(state.mainMode)) {
    if (state.inputRole === 'cipher') {
      const letters = extractLetters(state.plaintext);
      els.inputCount.textContent = `${letters.length}/${state.plaintext.length}`;
      els.outputCount.textContent = `${state.ciphertext.length}/${state.ciphertext.length}`;
    } else {
      const base26Len = utf8ToBase26(state.plaintext).length;
      els.inputCount.textContent = t('charset.countModern', {
        chars: String(state.plaintext.length),
        b26: String(base26Len),
      });
      const outLetters = extractLetters(state.ciphertext);
      els.outputCount.textContent = `${outLetters.length}/${state.ciphertext.length}`;
    }
    renderCourierUi();
    return;
  }

  const inputCounts = messageCounts(state.plaintext);
  const outputCounts = messageCounts(state.ciphertext);
  els.inputCount.textContent = `${inputCounts.machineLetters}/${inputCounts.totalCharacters}`;
  els.outputCount.textContent = `${outputCounts.machineLetters}/${outputCounts.totalCharacters}`;
  renderCourierUi();
}

function activeTimebookDisplayKey() {
  return selectDisplayFullKey({
    book: state.codebookSheet,
    keySource: state.keySource,
    isModernMode: isModern(state.mainMode),
    pin: modernSession.pinnedSlot(),
    timestampMs: Date.now(),
  });
}

function rotorDisplayIdentity() {
  const sel = activeTimebookDisplayKey();
  if (!sel) return '';
  return `${sel.source}:${sel.slotId}`;
}

function refreshTimebookRotorView() {
  const id = rotorDisplayIdentity();
  const livePinned = Boolean(modernSession.pinnedSlot()?.fullKey && state.plaintext);
  if (id && id !== lastRotorDisplaySlotId && !livePinned) {
    renderRotorSection();
    return;
  }
  updateRotorNotchHint();
  updateReflectorKindLabel();
}

function activeLueckenfueller() {
  const checked = (raw) => {
    const v = validateLueckenfueller(raw);
    return v.ok ? v.notches : null;
  };
  const sel = activeTimebookDisplayKey();
  if (sel) return checked(sel.key?.lueckenfueller);
  if (isModern(state.mainMode) && usesModernV3()) return checked(state.lueckenfueller);
  return null;
}

function activeEndwalzeWiring() {
  const checked = (raw) => {
    const v = validateEndwalzeWiring(raw);
    return v.ok ? v.wiring : '';
  };
  const sel = activeTimebookDisplayKey();
  if (sel) return checked(sel.key?.endwalzeWiring);
  if (isModern(state.mainMode)) return checked(state.endwalzeWiring);
  return '';
}

function updateReflectorKindLabel() {
  if (!els.reflectorLabel) return;
  const modern = isModern(state.mainMode);
  const kindLabel = modern ? t('rotor.endwalze') : t('rotor.umkehrwalze');
  const rotors = activeTimebookDisplayKey()?.key || state;
  const kindName = modern
    ? (activeEndwalzeWiring() || t('rotor.perm'))
    : reflectorLabel(state.reflectorId);
  els.reflectorLabel.textContent =
    `${kindLabel} ${kindName} · ${t('rotor.layoutCode')} ${layoutCode(rotors.rotorThin, rotors.rotorLeft, rotors.rotorMiddle, rotors.rotorRight)}`;
}

function updateRotorNotchHint() {
  const el = els.rotorNotchHint;
  if (!el) return;
  const notches = activeLueckenfueller();
  if (!notches) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = t('rotor.notchHint', {
    left: notches.left,
    lc: String(notches.left.length),
    middle: notches.middle,
    mc: String(notches.middle.length),
    right: notches.right,
    rc: String(notches.right.length),
  });
}

function formatNotchDisplay(rotorId, notchLetters, count) {
  const letters = String(notchLetters || '');
  const n = count ?? letters.length;
  const spaced = [...letters].join(' ');
  return t('modern.notchLine', {
    rotor: rotorId,
    count: n,
    letters: spaced || '—',
  });
}

function renderModernFeaturePanel() {
  const modern = isModern(state.mainMode);
  if (els.modernFeaturePanel) els.modernFeaturePanel.hidden = !modern;
  if (els.endwalzeHint) els.endwalzeHint.hidden = !modern;
  if (els.procedureAutoHint) els.procedureAutoHint.hidden = !modern;

  if (els.charsetLine) {
    els.charsetLine.textContent = modern
      ? t('charset.modern')
      : t('charset.traditional');
  }

  if (els.modeHint) {
    els.modeHint.textContent = modern
      ? t('mode.hint.modern')
      : t('mode.hint.traditional');
  }
  if (els.modeInfoBody) {
    els.modeInfoBody.textContent = modern
      ? t(modernExplainerKey())
      : t('mode.info.traditional');
  }

  if (!modern) {
    if (els.lueckenfuellerNotches) {
      els.lueckenfuellerNotches.hidden = true;
      els.lueckenfuellerNotches.textContent = '';
    }
    return;
  }

  if (els.modernAutoKeyStatus) {
    els.modernAutoKeyStatus.textContent = t('modern.autoKeyStatus');
  }
  if (els.modernEndwalzeNote) {
    els.modernEndwalzeNote.textContent = t('modern.endwalzeNote');
  }

  const derived = usesModernV3() && state.lueckenfueller
    ? { ok: true, notches: state.lueckenfueller, counts: [
      state.lueckenfueller.left.length,
      state.lueckenfueller.middle.length,
      state.lueckenfueller.right.length,
    ] }
    : { ok: false };

  if (els.lueckenfuellerBadge) {
    els.lueckenfuellerBadge.textContent = derived.ok
      ? t('modern.lueckenfuellerIndependent')
      : t('modern.lueckenfuellerInactive');
  }

  if (els.btnToggleNotches) {
    els.btnToggleNotches.textContent = lueckenfuellerNotchesOpen
      ? t('modern.lueckenfuellerHide')
      : t('modern.lueckenfuellerShow');
    els.btnToggleNotches.disabled = false;
  }

  if (els.lueckenfuellerNotches) {
    if (!lueckenfuellerNotchesOpen) {
      els.lueckenfuellerNotches.hidden = true;
    } else if (!derived.ok || !derived.notches) {
      els.lueckenfuellerNotches.hidden = false;
      els.lueckenfuellerNotches.classList.add('is-error');
      els.lueckenfuellerNotches.textContent = t('modern.lueckenfuellerNeedPlugs');
    } else {
      els.lueckenfuellerNotches.hidden = false;
      els.lueckenfuellerNotches.classList.remove('is-error');
      const counts = derived.counts || [
        derived.notches.left.length,
        derived.notches.middle.length,
        derived.notches.right.length,
      ];
      const lines = [
        t('modern.lueckenfuellerIndependentNote'),
        formatNotchDisplay(state.rotorLeft, derived.notches.left, counts[0]),
        formatNotchDisplay(state.rotorMiddle, derived.notches.middle, counts[1]),
        formatNotchDisplay(state.rotorRight, derived.notches.right, counts[2]),
      ];
      if (state.endwalzeWiring) {
        lines.push(t('modern.endwalzeWiringLine', { wiring: state.endwalzeWiring }));
      }
      els.lueckenfuellerNotches.textContent = lines.join('\n');
    }
  }
}

function modeStatusLabel() {
  const profile = getModeProfileId(state);
  if (profile === 'modern') return t('mode.status.modern');
  if (profile === 'traditional-message') return t('mode.status.traditionalMessage');
  return t('mode.status.traditionalSimple');
}

function renderModeUi() {
  const traditional = isTraditional(state.mainMode);
  const modern = isModern(state.mainMode);
  const isMessage = usesTraditionalMessageKey(state);

  if (els.modeStatus) {
    els.modeStatus.dataset.main = modern ? MAIN_MODE.MODERN : MAIN_MODE.TRADITIONAL;
  }
  if (els.modeStatusValue) {
    els.modeStatusValue.textContent = modeStatusLabel();
  }
  renderHardenedLiveBadge();

  els.btnMainTraditional?.classList.toggle('active', traditional);
  els.btnMainModern?.classList.toggle('active', modern);

  // Setup-Label immer am Modus ausrichten (auch wenn Modal zu ist)
  updateReflectorSetupLabel();

  // Verfahren immer sichtbar: Traditionell wählbar, Modern fest auf Spruchschlüssel (auto)
  if (els.traditionalProcedureBar) {
    els.traditionalProcedureBar.hidden = false;
    els.traditionalProcedureBar.classList.toggle('procedure-locked', modern);
  }
  const lockProcedure = modern;
  // Modern: Spruchschlüssel aktiv und gesperrt; Traditionell: Nutzerwahl
  els.btnModeSimple?.classList.toggle('active', traditional && !isMessage);
  els.btnModeMessage?.classList.toggle('active', modern || (traditional && isMessage));
  for (const btn of [els.btnModeSimple, els.btnModeMessage]) {
    if (!btn) continue;
    btn.disabled = lockProcedure;
    btn.setAttribute('aria-disabled', lockProcedure ? 'true' : 'false');
  }

  renderModernFeaturePanel();
}

function renderMessageKeyUi() {
  renderModeUi();

  const isMessage = usesTraditionalMessageKey(state);
  const modern = isModern(state.mainMode);
  const showDirection = usesDirectionRoles();
  const isCipher = isCipherRole();

  // Manueller Spruchschlüssel nur Traditionell · Message; Modern: Auto-Leiste
  if (els.messageKeyBar) els.messageKeyBar.hidden = !isMessage;
  if (els.directionBar) els.directionBar.hidden = !showDirection;
  if (els.modernSessionBar) els.modernSessionBar.hidden = !modern;

  if (els.btnRolePlain) els.btnRolePlain.classList.toggle('active', showDirection && !isCipher);
  if (els.btnRoleCipher) els.btnRoleCipher.classList.toggle('active', showDirection && isCipher);

  if (modern && els.modernSessionKeyDisplay) {
    els.modernSessionKeyDisplay.textContent = isValidFourKey(lastModernResolvedKey)
      ? lastModernResolvedKey
      : '————';
  }
  if (modern && els.modernStampDisplay) {
    els.modernStampDisplay.textContent = 'ALBV';
    els.modernStampDisplay.classList.remove('warn');
  }
  if (modern && els.modernHeaderDisplay) {
    els.modernHeaderDisplay.textContent = lastHeaderGroup.length === 4
      ? lastHeaderGroup
      : '————';
  }
  if (modern && els.modernMessageIdDisplay) {
    const mid = /^[A-Z]{8}$/.test(modernAutoMessageId) ? modernAutoMessageId : '';
    els.modernMessageIdDisplay.textContent = mid || '————————';
    els.modernMessageIdDisplay.classList.toggle('warn', !mid);
  }
  if (modern && els.modernPruefDisplay) {
    const pruef = lastModernPruefgruppe.length === 20 ? lastModernPruefgruppe : '';
    els.modernPruefDisplay.textContent = pruef
      ? formatLetterGroups4(pruef)
      : '———— ———— ———— ———— ————';
    els.modernPruefDisplay.classList.toggle('warn', !pruef);
  }
  if (els.messageKeyInput && document.activeElement !== els.messageKeyInput) {
    els.messageKeyInput.value = state.messageKey;
  }

  if (els.messageKeyHint) {
    if (!isMessage) {
      els.messageKeyHint.textContent = '';
    } else if (isCipher && messageReceive) {
      els.messageKeyHint.textContent = t('message.hint.receiveBody');
    } else if (isCipher) {
      els.messageKeyHint.textContent = t('message.hint.pasteCipher');
    } else if (!isValidFourKey(state.messageKey)) {
      els.messageKeyHint.textContent = t('message.hint.needKey');
    } else {
      els.messageKeyHint.textContent = t('message.hint.send');
    }
  }

  if (els.trafficHint) {
    if (modern) {
      els.trafficHint.textContent = isCipher
        ? t('modern.trafficHint.cipher')
        : t('modern.trafficHint.plain');
    } else {
      els.trafficHint.textContent = isCipher
        ? t('message.trafficHint.cipher')
        : t('message.trafficHint.plain');
    }
  }

  if (els.modernCryptoError) {
    if (modern && lastModernCryptoError) {
      els.modernCryptoError.hidden = false;
      els.modernCryptoError.textContent = t(lastModernCryptoError, {
        count: String(lastModernPlugCount),
        min: String(MIN_STECKER_PAIRS),
      });
    } else {
      els.modernCryptoError.hidden = true;
      els.modernCryptoError.textContent = '';
    }
  }

  if (els.headerGroupLine) {
    const showHeader = isMessage && lastHeaderGroup.length === 4;
    els.headerGroupLine.hidden = !showHeader;
    if (showHeader && els.headerGroupDisplay) {
      els.headerGroupDisplay.textContent = lastHeaderGroup;
    }
  }

  if (els.inputFieldLabel) {
    els.inputFieldLabel.textContent = isCipher ? t('role.cipher') : t('field.input');
  }

  if (els.inputText) {
    els.inputText.classList.toggle('role-cipher', isCipher);
    if (isCipher && isMessage && !messageReceive) {
      els.inputText.placeholder = t('field.input.placeholderCipher');
    } else if (isCipher && isMessage && messageReceive) {
      els.inputText.placeholder = t('field.input.placeholderCipherBody');
    } else if (isCipher && modern) {
      els.inputText.placeholder = t('field.input.placeholderModernCipher');
    } else if (modern) {
      els.inputText.placeholder = t('field.input.placeholderModern');
    } else if (isMessage) {
      els.inputText.placeholder = t('field.input.placeholderMessage');
    } else {
      els.inputText.placeholder = t('field.input.placeholder');
    }
  }

  const pasteBtn = document.getElementById('btnPasteInput');
  if (pasteBtn) {
    pasteBtn.removeAttribute('title');
    pasteBtn.setAttribute(
      'aria-label',
      isCipher ? t('field.pasteAriaCipher') : t('field.pasteAriaPlain'),
    );
  }
}

function ensureRotorGrid() {
  if (!els.rotorGrid) return;
  const labels = rotorCardLabels();
  if (els.rotorGrid.childElementCount !== labels.length) {
    els.rotorGrid.innerHTML = labels.map((label) => `
    <div class="rotor-card">
      <div class="rotor-label">${label}</div>
      <div class="rotor-box"><span class="rotor-id"></span></div>
      <div class="rotor-pos"></div>
    </div>
  `).join('');
  }
}

function paintRotorGrid() {
  ensureRotorGrid();
  const visuals = rotorVisuals();
  const cards = [...els.rotorGrid.children];
  visuals.forEach((rotor, index) => {
    const card = cards[index];
    if (!card) return;
    card.querySelector('.rotor-label').textContent = rotor.label;
    const box = card.querySelector('.rotor-box');
    card.querySelector('.rotor-id').textContent = rotor.id;
    card.querySelector('.rotor-pos').textContent = rotor.position;
    const stepped = lastRotorPositions[index] !== undefined && lastRotorPositions[index] !== rotor.position;
    if (stepped) {
      box.classList.add('stepped');
      box.addEventListener('transitionend', () => box.classList.remove('stepped'), { once: true });
    } else {
      box.classList.remove('stepped');
    }
  });
  lastRotorPositions = visuals.map((rotor) => rotor.position);
}

function renderRotorSection({ useCurrentEngine = false } = {}) {
  if (!useCurrentEngine) {
    if (state.plaintext) {
      reprocessCurrentInput();
    } else {
      resetMachineFromPanel();
    }
  }

  const live = engine.livePositionCode();
  const isMessage = usesTraditionalMessageKey(state);
  const modern = isModern(state.mainMode);
  const resolvedMk = isValidFourKey(lastModernResolvedKey)
    ? lastModernResolvedKey
    : (isValidFourKey(modernAutoMessageKey) ? modernAutoMessageKey : '');
  const startKey = isMessage && isValidFourKey(state.messageKey)
    ? state.messageKey
    : (modern && resolvedMk ? resolvedMk : state.keyCode);
  const isAtStart = live === startKey;

  updateReflectorKindLabel();
  if (els.endwalzeHint) {
    els.endwalzeHint.hidden = !modern;
    if (modern) els.endwalzeHint.textContent = t('modern.endwalzeNote');
  }

  // Einfach: Startlage · Aktuell
  // Spruchschlüssel / Modern: Grundstellung im Setup; oben nur Aktuell (+ Session-Leiste)
  const hideStartKey = isMessage || modern;
  if (els.startKeyBlock) {
    els.startKeyBlock.hidden = hideStartKey;
    els.startKeyBlock.style.display = hideStartKey ? 'none' : '';
  }
  if (!hideStartKey) {
    if (els.startKeyLabel) els.startKeyLabel.textContent = t('rotor.startKey');
    if (els.keyCodeDisplay) els.keyCodeDisplay.textContent = state.keyCode;
  }
  const livePrefix = document.getElementById('livePositionPrefix');
  if (livePrefix) livePrefix.textContent = t('rotor.livePrefix');
  els.livePosition.textContent = live;
  els.livePosition.classList.toggle('warn', !!state.plaintext && !isAtStart);

  const editable = canEditRotorSetup();
  els.rotorSection.classList.toggle('editable', editable);
  els.editableHint.hidden = !editable;
  if (els.editableHint) {
    if (modern) {
      els.editableHint.textContent = t('rotor.hintModern');
    } else if (isMessage) {
      els.editableHint.textContent = t('rotor.hintMessage');
    } else {
      els.editableHint.textContent = t('rotor.hintSimple');
    }
  }

  paintRotorGrid();
  updatePlugboardDisplay();
  updateRotorNotchHint();
  lastRotorDisplaySlotId = rotorDisplayIdentity();
  // Kerben ändern sich mit Ringen/Stecker/Walzen
  if (isModern(state.mainMode)) renderModernFeaturePanel();
}

/**
 * Status der geladenen Tafel: Monat + Tafelwort, Hinweis zum Vergleich.
 * Ohne Tafel: bisheriger Leer-Text.
 * @param {import('./codebook.js').CodebookSheet | null | undefined} sheet
 */
function renderTimebookNow() {
  const book = state.codebookSheet;
  const el = document.getElementById('codebookSlotNow');
  if (!el || !isTimebook(book)) return;
  const resolved = resolveTimebookSlot(book, Date.now());
  el.replaceChildren();
  const title = document.createElement('div');
  title.textContent = t('codebook.currentKey');
  el.appendChild(title);
  if (!resolved.ok) {
    const miss = document.createElement('div');
    miss.textContent = t('codebook.outOfMonth');
    el.appendChild(miss);
    return;
  }
  const hours = formatSlotHours(resolved.meta);
  const line = document.createElement('div');
  line.textContent = hours;
  el.appendChild(line);
  const until = document.createElement('div');
  until.className = 'muted';
  const endHour = resolved.meta.endHour === 24 ? 24 : resolved.meta.endHour;
  until.textContent = t('codebook.forNewUntil', { time: String(endHour).padStart(2, '0') + ':00' });
  el.appendChild(until);
  const endMs = slotEndUnixMs(resolved.meta);
  const remain = document.createElement('div');
  remain.className = 'muted';
  remain.textContent = t('codebook.nextChange', { remain: formatRemain(endMs - Date.now()) });
  el.appendChild(remain);
  const hint = document.createElement('div');
  hint.className = 'muted';
  hint.textContent = t('codebook.keyTimeHint');
  el.appendChild(hint);
}

function renderHardenedLiveBadge() {
  const badge = els.hardenedLiveBadge;
  if (!badge) return;
  const book = state.codebookSheet;
  const show = isModern(state.mainMode)
    && state.keySource === 'codebook'
    && isTimebook(book)
    && !state.courierOn;
  badge.hidden = !show;
  if (!show) return;
  if (els.hardenedLiveMode) {
    els.hardenedLiveMode.textContent = `${t('codebook.hardenedLabel')} · ${profileLabel(book.timeProfile)}`;
  }
  const resolved = resolveTimebookSlot(book, Date.now());
  if (!resolved.ok) {
    if (els.hardenedLiveSlot) els.hardenedLiveSlot.textContent = t('codebook.outOfMonth');
    if (els.hardenedLiveClock) els.hardenedLiveClock.textContent = '—';
    badge.removeAttribute('title');
    return;
  }
  const hours = formatSlotHours(resolved.meta);
  if (els.hardenedLiveSlot) els.hardenedLiveSlot.textContent = hours;
  const clock = formatCountdownClock(slotEndUnixMs(resolved.meta) - Date.now());
  if (els.hardenedLiveClock) els.hardenedLiveClock.textContent = clock;
  badge.title = t('codebook.liveBadgeTitle', {
    profile: profileLabel(book.timeProfile),
    hours,
    clock,
  });
}

function renderCodebookStatus(sheet) {
  const el = els.codebookStatus;
  if (!el) return;

  el.replaceChildren();
  if (!sheet) {
    el.textContent = t('codebook.statusEmpty');
    el.classList.remove('loaded');
    return;
  }

  el.classList.add('loaded');

  const monthLine = document.createElement('div');
  monthLine.className = 'codebook-status-sheet';
  monthLine.textContent = t('codebook.statusTafel', {
    month: sheet.monthLabel || `${sheet.month}/${sheet.year}`,
  });

  const wordLine = document.createElement('div');
  wordLine.className = 'codebook-status-word';
  if (isTimebook(sheet)) {
    wordLine.append(`${t('codebook.hardenedLabel')} · ${profileLabel(sheet.timeProfile)}`);
    const now = document.createElement('div');
    now.className = 'codebook-slot-now';
    now.id = 'codebookSlotNow';
    wordLine.appendChild(now);
  } else {
    wordLine.append(t('codebook.statusTafelwort'), ' ');
    const word = document.createElement('span');
    word.className = 'mono';
    word.textContent = tafelwort(sheet);
    wordLine.appendChild(word);
  }

  const hint = document.createElement('div');
  hint.className = 'codebook-status-hint';
  hint.textContent = t('codebook.statusCompare');

  const meta = document.createElement('div');
  meta.className = 'codebook-status-meta';
  let metaText = t('codebook.statusLoaded', {
    network: getActiveNetworkName(),
    count: sheet.days.length,
  });
  if (sheet.generatedAt) {
    metaText += t('codebook.statusGenerated', {
      when: new Date(sheet.generatedAt).toLocaleString(getLocaleTag()),
    });
  }
  meta.textContent = metaText;

  el.append(monthLine, wordLine, hint, meta);
  if (isTimebook(sheet)) renderTimebookNow();
}

function sheetMonthKey(sheet) {
  return sheet ? `${sheet.year}-${sheet.month}` : '';
}

function renderMonthMismatchBanner(sheet) {
  const banner = els.codebookMonthBanner;
  if (!banner) return;

  const now = new Date();
  const alb = isTimebook(sheet) ? getAlberichDateTime() : null;
  const year = alb ? alb.year : now.getFullYear();
  const month = alb ? alb.month : now.getMonth() + 1;
  const show = !!sheet
    && state.keySource === 'codebook'
    && !state.courierOn
    && sheetDiffersFromCalendar(sheet, year, month)
    && monthMismatchDismissedKey !== sheetMonthKey(sheet);

  banner.hidden = !show;
  if (!show || !els.codebookMonthBannerText) return;

  els.codebookMonthBannerText.textContent = t('codebook.monthBanner', {
    sheetMonth: sheet.monthLabel || monthLabel(sheet.year, sheet.month, getLocale()),
    todayMonth: monthLabel(year, month, getLocale()),
  });
}

function onMonthBannerKeep() {
  const sheet = state.codebookSheet;
  if (!sheet) return;
  monthMismatchDismissedKey = sheetMonthKey(sheet);
  renderMonthMismatchBanner(sheet);
}

function onMonthBannerNew() {
  const now = new Date();
  if (els.codebookGenMonth) els.codebookGenMonth.value = String(now.getMonth() + 1);
  if (els.codebookGenYear) {
    const y = String(now.getFullYear());
    if (![...els.codebookGenYear.options].some((opt) => opt.value === y)) {
      const extra = document.createElement('option');
      extra.value = y;
      extra.textContent = y;
      els.codebookGenYear.appendChild(extra);
    }
    els.codebookGenYear.value = y;
  }
  document.querySelector('.codebook-generate')?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
  });
}

/**
 * Füllt eine Tafelwort-Zeile (Modal / QR) oder blendet sie aus.
 * @param {HTMLElement | null | undefined} el
 * @param {import('./codebook.js').CodebookSheet | null | undefined} sheet
 */
function fillTafelwortLine(el, sheet) {
  if (!el) return;
  el.replaceChildren();
  if (!sheet) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.append(t('codebook.statusTafelwort'), ' ');
  const word = document.createElement('span');
  word.className = 'mono';
  word.textContent = isTimebook(sheet)
    ? shortFingerprint(sheet.codebookFingerprint)
    : tafelwort(sheet);
  el.appendChild(word);
}

function renderCodebookUi() {
  syncCodebookEndwalzePolicyUi();
  syncCodebookKindUi();
  const isCodebook = state.keySource === 'codebook';
  const sheet = state.codebookSheet;

  els.btnSourceCodebook?.classList.toggle('active', isCodebook);
  els.btnSourceManual?.classList.toggle('active', !isCodebook);

  if (els.codebookPanel) {
    els.codebookPanel.hidden = !isCodebook;
  }
  els.manualSetupGrid?.classList.toggle('setup-from-codebook', isCodebook && !!sheet);

  renderNetworksUi();

  if (!els.codebookStatus || !els.codebookDaySelect) return;

  const select = els.codebookDaySelect;
  select.innerHTML = '';

  renderCodebookStatus(sheet);
  renderMonthMismatchBanner(sheet);

  if (!sheet) {
    select.disabled = true;
    if (els.sheetViewModal?.classList.contains('open')) closeModal('sheetViewModal');
    return;
  }

  select.disabled = false;

  for (const d of sheet.days) {
    const opt = document.createElement('option');
    opt.value = String(d.day);
    const label = String(d.day).padStart(2, '0');
    opt.textContent = d.date ? `${label} (${d.date})` : label;
    if (d.day === state.codebookDay) opt.selected = true;
    select.appendChild(opt);
  }

  if (!findCodebookDay(sheet, state.codebookDay) && sheet.days[0]) {
    select.value = String(sheet.days[0].day);
  }

  if (els.sheetViewModal?.classList.contains('open')) renderSheetView();
}

function renderNetworksUi() {
  const list = els.networksList;
  const countEl = els.networksCount;
  if (!list) return;

  const networks = Array.isArray(state.networks) ? state.networks : [];
  if (countEl) {
    countEl.textContent = t('network.count', {
      current: String(networks.length),
      max: String(MAX_NETWORKS),
    });
  }

  list.innerHTML = '';
  for (const net of networks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'network-chip' + (net.id === state.activeNetworkId ? ' active' : '');
    btn.setAttribute('data-network-id', net.id);
    btn.setAttribute('role', 'listitem');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'network-chip-name';
    nameSpan.textContent = displayNetworkName(net);

    const badge = document.createElement('span');
    const hasSheet = !!net.sheet || (net.id === state.activeNetworkId && !!state.codebookSheet);
    badge.className = 'network-chip-badge' + (hasSheet ? '' : ' empty');
    if (hasSheet) {
      const sheet = net.id === state.activeNetworkId && state.codebookSheet
        ? state.codebookSheet
        : net.sheet;
      const month = sheet
        ? (sheet.monthLabel || monthLabel(sheet.year, sheet.month, getLocale()))
        : '';
      const word = !sheet
        ? ''
        : (isTimebook(sheet)
          ? shortFingerprint(sheet.codebookFingerprint)
          : tafelwort(sheet));
      if (month && word) {
        const monthSpan = document.createElement('span');
        monthSpan.textContent = month;
        const wordSpan = document.createElement('span');
        wordSpan.className = 'mono';
        wordSpan.textContent = word;
        badge.append(monthSpan, ' · ', wordSpan);
        btn.title = t('network.badgeTitle', {
          network: displayNetworkName(net),
          month,
          word,
        });
      } else if (month) {
        badge.textContent = t('network.badgeMonth', { month });
        btn.title = displayNetworkName(net);
      } else if (word) {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'mono';
        wordSpan.textContent = word;
        badge.appendChild(wordSpan);
        btn.title = displayNetworkName(net);
      } else {
        badge.textContent = '·';
        btn.title = displayNetworkName(net);
      }
    } else {
      badge.textContent = t('network.badgeEmpty');
      btn.title = displayNetworkName(net);
    }

    btn.appendChild(nameSpan);
    btn.appendChild(badge);
    list.appendChild(btn);
  }

  if (els.btnNetworkAdd) {
    els.btnNetworkAdd.disabled = !canAddNetwork(networks);
  }
  if (els.btnNetworkDelete) {
    els.btnNetworkDelete.disabled = networks.length <= 1;
  }
  if (els.btnNetworkClearSheet) {
    const active = getActiveNetwork();
    const hasSheet = !!(active?.sheet || state.codebookSheet);
    els.btnNetworkClearSheet.disabled = !hasSheet;
  }
  if (els.btnNetworkWipeAll) {
    els.btnNetworkWipeAll.disabled = !hasAnyStoredSheet();
  }

  updateShareButtonsEnabled();
}

/** Setup-Label Umkehrwalze / Endwalze (inkl. data-i18n, damit Locale-Wechsel nicht zurücksetzt). */
function updateReflectorSetupLabel() {
  const label = document.getElementById('reflectorSelectLabel');
  if (!label) return;
  const key = isModern(state.mainMode) ? 'setup.endwalze' : 'setup.reflector';
  label.setAttribute('data-i18n', key);
  label.textContent = t(key);

  const doraLabel = document.querySelector('label[for="reflectorD"]');
  if (doraLabel) {
    const doraKey = state.doraFree
      ? (isModern(state.mainMode) ? 'setup.ewdFree' : 'setup.doraLabelFree')
      : (isModern(state.mainMode) ? 'setup.ewd' : 'setup.doraLabel');
    doraLabel.setAttribute('data-i18n', doraKey);
    doraLabel.textContent = t(doraKey);
  }

  const fixedNote = document.getElementById('doraFixedNote');
  if (fixedNote) fixedNote.hidden = !!state.doraFree;
  const doraHint = document.getElementById('doraHint');
  if (doraHint) {
    const hintKey = state.doraFree ? 'setup.doraHintFree' : 'setup.doraHint';
    doraHint.setAttribute('data-i18n', hintKey);
    doraHint.textContent = t(hintKey);
  }
}

function syncCodebookEndwalzePolicyUi() {
  if (isModern(state.mainMode)) codebookEndwalzePolicy = ENDWALZE_POLICY.PERMUTATION;
  else if (!policyFitsMainMode(codebookEndwalzePolicy, state.mainMode)) {
    codebookEndwalzePolicy = ENDWALZE_POLICY.HISTORIC;
  }
  document.querySelectorAll('[data-endwalze-policy]').forEach((btn) => {
    const policy = btn.getAttribute('data-endwalze-policy');
    btn.hidden = !policyFitsMainMode(policy, state.mainMode);
    btn.classList.toggle('active', policy === codebookEndwalzePolicy);
  });
  const mismatch = !policyFitsMainMode(codebookEndwalzePolicy, state.mainMode);
  const warnKey = isModern(state.mainMode)
    ? 'setup.policy.mismatchModern'
    : 'setup.policy.mismatchTraditional';
  document.querySelectorAll('[data-policy-mismatch]').forEach((el) => {
    el.hidden = !mismatch;
    if (mismatch) el.textContent = t(warnKey);
  });
  if (els.modeInfoBody && isModern(state.mainMode)) {
    els.modeInfoBody.textContent = t(modernExplainerKey());
  }
  const manualBlock = document.getElementById('manualEndwalzePolicyBlock');
  if (manualBlock) manualBlock.hidden = state.keySource === 'codebook';
  const permutation = usesPermutationEndwalze(codebookEndwalzePolicy);
  const reflectorBlock = document.getElementById('manualReflectorBlock');
  if (reflectorBlock) reflectorBlock.hidden = permutation;
  const permBlock = document.getElementById('manualPermutationBlock');
  if (permBlock) permBlock.hidden = !permutation || state.keySource === 'codebook';
}

function renderSetupForm() {
  const editingField = setupFormEditField || document.activeElement?.id;
  document.getElementById('reflectorSelect').value = state.reflectorId;
  updateReflectorSetupLabel();
  document.getElementById('rotorThin').value = state.rotorThin;
  document.getElementById('rotorLeft').value = state.rotorLeft;
  document.getElementById('rotorMiddle').value = state.rotorMiddle;
  document.getElementById('rotorRight').value = state.rotorRight;
  document.getElementById('ringCode').value = state.ringCode;
  document.getElementById('keyCodeInput').value = state.keyCode;

  // Einfach: Feld „Spruchschlüssel“ (Startlage)
  // Spruchschlüssel-Verfahren / Modern: „Grundstellung“ (Tagesschlüssel)
  const keyLabel = document.getElementById('keyCodeInputLabel');
  const keyHint = document.getElementById('keyCodeInputHint');
  const setupIntro = document.getElementById('setupModalIntro');
  const usesGroundSetting = usesTraditionalMessageKey(state) || isModern(state.mainMode);
  if (usesGroundSetting) {
    if (keyLabel) keyLabel.textContent = t('setup.keyGround');
    if (keyHint) {
      keyHint.textContent = isModern(state.mainMode)
        ? t('setup.hint.keyGroundModern')
        : (state.keySource === 'codebook'
          ? t('setup.hint.keyGroundCodebook')
          : t('setup.hint.keyGround'));
    }
    if (setupIntro) {
      setupIntro.textContent = isModern(state.mainMode)
        ? t('setup.intro.modern')
        : (state.keySource === 'codebook'
          ? t('setup.intro.messageCodebook')
          : t('setup.intro.message'));
    }
  } else {
    if (keyLabel) keyLabel.textContent = t('setup.keySimple');
    if (keyHint) {
      keyHint.textContent = state.keySource === 'codebook'
        ? t('setup.hint.keySimpleCodebook')
        : t('setup.hint.keySimple');
    }
    if (setupIntro) {
      setupIntro.textContent = state.keySource === 'codebook'
        ? t('setup.intro.simpleCodebook')
        : t('setup.intro.simple');
    }
  }

  if (editingField !== 'plugboard') {
    document.getElementById('plugboard').value = state.plugboard;
  }
  if (editingField !== 'reflectorD') {
    document.getElementById('reflectorD').value = state.reflectorD;
  }
  const wiringInput = document.getElementById('endwalzeWiringInput');
  if (wiringInput && editingField !== 'endwalzeWiringInput') {
    wiringInput.value = state.endwalzeWiring || '';
  }
  document.getElementById('doraSection').hidden =
    usesPermutationEndwalze(codebookEndwalzePolicy) || state.reflectorId !== REFLECTOR_ID_DORA;
  els.keyExport.textContent = formatKeyExport();
  renderCodebookUi();
  syncCodebookEndwalzePolicyUi();

  ['rotorLeft', 'rotorMiddle', 'rotorRight'].forEach((id) => {
    const slot = id.replace('rotor', '').toLowerCase();
    const select = document.getElementById(id);
    [...select.options].forEach((opt) => {
      const occupied = mainRotorDuplicateHint(opt.value, slot);
      opt.textContent = occupied
        ? t('setup.rotorOccupied', { id: opt.value })
        : opt.value;
    });
  });
}

/** @returns {string} */
function getLocaleTag() {
  return getLocale() === 'de' ? 'de-DE' : 'en-GB';
}

function renderAll() {
  renderTextFields();
  renderRotorSection();
  renderMessageKeyUi();
  if (document.getElementById('setupModal').classList.contains('open')) renderSetupForm();
  else renderCodebookUi();
  document.getElementById('doraSection').hidden = state.reflectorId !== REFLECTOR_ID_DORA;
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) {
    versionLabel.textContent = t('info.version', {
      version: VERSION,
      protocol: PROTOCOL_LABEL,
    });
  }
}
