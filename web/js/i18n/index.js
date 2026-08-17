/**
 * Schlanke i18n-Schicht für Alberich Web (DE / EN).
 * Auto-Locale aus Browser + manuelle Wahl + localStorage.
 */
import de from './de.js?v=1';
import en from './en.js?v=1';

const STORAGE_KEY = 'alberich-locale';
const catalogs = { de, en };

/** @typedef {'de' | 'en'} Locale */

/** @type {Locale} */
let currentLocale = 'de';

/** @type {((locale: Locale) => void) | null} */
let onLocaleChange = null;

/**
 * @param {string | null | undefined} raw
 * @returns {Locale | null}
 */
function normalizeLocale(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (base === 'de') return 'de';
  if (base === 'en') return 'en';
  return null;
}

/**
 * @returns {Locale}
 */
export function detectBrowserLocale() {
  const candidates = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  if (navigator.language) candidates.push(navigator.language);

  for (const lang of candidates) {
    const normalized = normalizeLocale(lang);
    if (normalized === 'de') return 'de';
  }
  return 'en';
}

/**
 * Gespeicherte Wahl, optional ?lang=, sonst Browser.
 * @returns {Locale}
 */
export function resolveLocale() {
  try {
    const stored = normalizeLocale(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    /* private mode */
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeLocale(params.get('lang'));
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }

  return detectBrowserLocale();
}

/** @returns {Locale} */
export function getLocale() {
  return currentLocale;
}

/**
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const catalog = catalogs[currentLocale] || catalogs.en;
  const fallback = catalogs.en;
  let text = catalog[key] ?? fallback[key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined && params[name] !== null
        ? String(params[name])
        : `{${name}}`,
    );
  }
  return text;
}

/**
 * Parser-/Kamera-Fehler: i18n-Keys oder „key|param1|param2…“ für parametrisierte Meldungen.
 * Unbekannte Strings werden unverändert angezeigt (Fallback).
 * @param {unknown} error
 * @returns {string}
 */
export function localizeError(error) {
  if (error == null) return t('camera.failed');
  if (typeof error !== 'string') {
    const msg = /** @type {{ message?: string }} */ (error)?.message;
    return msg ? localizeError(String(msg)) : t('camera.failed');
  }

  // codebook.err.dayEntry\t{day}\t{detailKey}
  if (error.startsWith('codebook.err.dayEntry\t')) {
    const parts = error.split('\t');
    const day = parts[1] || '?';
    const detailKey = parts[2] || '';
    return t('codebook.err.dayEntry', {
      day,
      detail: detailKey.startsWith('codebook.') ? t(detailKey) : detailKey,
    });
  }

  // key|p1|p2 with named placeholders version/magic/algo in catalogs
  if (error.includes('|') && !error.includes(' ')) {
    const [key, ...rest] = error.split('|');
    if (key.startsWith('codebook.') || key.startsWith('qr.') || key.startsWith('camera.')) {
      const params = {};
      if (key === 'codebook.err.badVersion') params.version = rest[0] ?? '';
      if (key === 'qr.err.unknownMagic') params.magic = rest[0] || 'empty';
      if (key === 'qr.err.unknownAlgo') params.algo = rest[0] ?? '';
      return t(key, params);
    }
  }

  if (
    error.startsWith('codebook.')
    || error.startsWith('qr.')
    || error.startsWith('camera.')
    || error.startsWith('toast.')
    || error.startsWith('setup.')
  ) {
    return t(error);
  }

  return error;
}

/**
 * @param {string} property
 * @param {string} content
 */
function setMetaProperty(property, content) {
  const el = document.querySelector(`meta[property="${property}"]`);
  if (el) el.setAttribute('content', content);
}

/**
 * @param {string} name
 * @param {string} content
 */
function setMetaName(name, content) {
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el) el.setAttribute('content', content);
}

/**
 * @param {ParentNode} [root]
 */
export function applyStaticDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  });

  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    // Nur aus unseren Locale-Dateien (keine User-Eingaben)
    el.innerHTML = t(key);
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key || !('placeholder' in el)) return;
    el.placeholder = t(key);
  });

  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key) return;
    el.setAttribute('aria-label', t(key));
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.setAttribute('title', t(key));
  });

  const titleText = t('meta.title');
  const descText = t('meta.description');
  const ogLocale = t('meta.ogLocale');

  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = titleText;

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', descText);

  document.documentElement.lang = currentLocale;

  // Open Graph / Twitter follow UI language
  setMetaProperty('og:title', titleText);
  setMetaProperty('og:description', descText);
  setMetaProperty('og:locale', ogLocale);
  setMetaName('twitter:title', titleText);
  setMetaName('twitter:description', descText);

  // Keep hreflang alternate URLs stable on the canonical host
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => {
    const hl = link.getAttribute('hreflang');
    if (hl === 'de') link.setAttribute('href', 'https://alberich.pro/?lang=de');
    else if (hl === 'en') link.setAttribute('href', 'https://alberich.pro/?lang=en');
    else if (hl === 'x-default') link.setAttribute('href', 'https://alberich.pro/');
  });

  document.querySelectorAll('[data-locale-btn]').forEach((btn) => {
    const loc = btn.getAttribute('data-locale-btn');
    const active = loc === currentLocale;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const langGroup = document.getElementById('langToggle');
  if (langGroup) {
    langGroup.setAttribute('aria-label', t('header.langGroup'));
  }
}

/**
 * @param {Locale | string} locale
 * @param {{ persist?: boolean, notify?: boolean }} [opts]
 */
export function setLocale(locale, { persist = true, notify = true } = {}) {
  const next = normalizeLocale(locale) || 'en';
  if (next === currentLocale && document.documentElement.lang === next) {
    applyStaticDom();
    return;
  }

  currentLocale = next;

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, currentLocale);
    } catch {
      /* ignore */
    }
  }

  applyStaticDom();

  if (notify && onLocaleChange) {
    onLocaleChange(currentLocale);
  }
}

/**
 * @param {{ onChange?: (locale: Locale) => void }} [opts]
 * @returns {Locale}
 */
export function initI18n({ onChange } = {}) {
  onLocaleChange = onChange || null;
  currentLocale = resolveLocale();

  // ?lang= speichern, wenn gesetzt
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeLocale(params.get('lang'));
    if (fromQuery) {
      try {
        localStorage.setItem(STORAGE_KEY, fromQuery);
      } catch {
        /* ignore */
      }
      currentLocale = fromQuery;
    }
  } catch {
    /* ignore */
  }

  applyStaticDom();
  return currentLocale;
}
