/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Kompakte Tafel-Anzeige für Companion / Thunderbird:
 * Tafelwort + optionale Monatsabweichung (eine Zeile, ein Button).
 */

/** @type {string | null} */
let monthMismatchDismissedKey = null;

export function sheetMonthKey(st) {
  return st?.loaded ? `${st.year}-${st.month}` : '';
}

export function sheetDiffersFromNow(st) {
  if (!st?.loaded) return false;
  const now = new Date();
  return Number(st.year) !== now.getFullYear() || Number(st.month) !== now.getMonth() + 1;
}

export function todayMonthLabel(locale = 'de') {
  const tag = locale === 'en' ? 'en-GB' : 'de-DE';
  return new Date().toLocaleDateString(tag, { month: 'long', year: 'numeric' });
}

export function dismissMonthMismatch(st) {
  monthMismatchDismissedKey = sheetMonthKey(st);
}

export function isMonthMismatchVisible(st) {
  return sheetDiffersFromNow(st) && monthMismatchDismissedKey !== sheetMonthKey(st);
}

/**
 * @param {{
 *   keyStatus?: HTMLElement | null,
 *   tafelwortLine?: HTMLElement | null,
 *   monthBanner?: HTMLElement | null,
 *   monthBannerText?: HTMLElement | null,
 * }} els
 * @param {object} st  getStatusSummary()
 * @param {(key: string, params?: Record<string, string|number>) => string} t
 * @param {'de'|'en'} [locale]
 */
export function renderSheetChrome(els, st, t, locale = 'de') {
  if (els.keyStatus) {
    els.keyStatus.textContent = st.text;
    els.keyStatus.classList.toggle('empty', !st.loaded);
    els.keyStatus.title = st.tooltip || '';
  }

  if (els.tafelwortLine) {
    const word = st.loaded ? st.tafelwort : '';
    els.tafelwortLine.hidden = !word;
    if (word) els.tafelwortLine.textContent = t('status.tafelwort', { word });
  }

  if (els.monthBanner) {
    const show = !!(st.loaded && isMonthMismatchVisible(st));
    els.monthBanner.hidden = !show;
    if (show && els.monthBannerText) {
      els.monthBannerText.textContent = t('status.monthMismatch', {
        sheetMonth: st.monthLabel || `${st.month}/${st.year}`,
        todayMonth: todayMonthLabel(locale),
      });
    }
  }
}
