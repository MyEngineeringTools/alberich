/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Thunderbird-spezifisch: Compose-Body lesen/schreiben.
 * Nutzt messenger.compose / browser.compose — nicht im shared Core.
 */

const api = globalThis.browser ?? globalThis.chrome;

/**
 * Aktiven Compose-Tab finden (Popup aus compose_action oder Write-Fenster).
 * @returns {Promise<{ id: number }|null>}
 */
export async function findComposeTab() {
  // 1) Aktiver Tab im aktuellen Fenster
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    for (const tab of tabs || []) {
      if (await isComposeTab(tab.id)) return tab;
    }
  } catch {
    /* ignore */
  }

  // 2) Alle Fenster: erstes Compose-Fenster
  try {
    const all = await api.tabs.query({});
    for (const tab of all || []) {
      if (await isComposeTab(tab.id)) return tab;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {number} tabId
 */
async function isComposeTab(tabId) {
  if (tabId == null || !api.compose?.getComposeDetails) return false;
  try {
    await api.compose.getComposeDetails(tabId);
    return true;
  } catch {
    return false;
  }
}

/**
 * HTML-Body → lesbarer Text (ohne Tags).
 * @param {string} html
 */
export function htmlToPlain(html) {
  try {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const text = doc.body?.innerText ?? doc.body?.textContent ?? '';
    return text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  } catch {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
}

/**
 * Klartext sicher als HTML-Body (Zeilenumbrüche erhalten).
 * @param {string} plain
 */
export function plainToHtmlBody(plain) {
  const esc = String(plain ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // pre-wrap-ähnlich: Zeilen als <br>, Leerzeichen nicht kollabieren
  const withBreaks = esc.replace(/\n/g, '<br>\n').replace(/  /g, ' &nbsp;');
  return `<div style="font-family:monospace;white-space:pre-wrap">${withBreaks}</div>`;
}

/**
 * @returns {Promise<{ ok: true, text: string, tabId: number, isPlainText: boolean } | { ok: false, error: string }>}
 */
export async function readComposeBody() {
  const tab = await findComposeTab();
  if (!tab) return { ok: false, error: 'ui.noCompose' };
  try {
    const details = await api.compose.getComposeDetails(tab.id);
    const isPlainText = !!details.isPlainText;
    const text = isPlainText
      ? String(details.plainTextBody ?? '')
      : htmlToPlain(details.body || '');
    return { ok: true, text, tabId: tab.id, isPlainText };
  } catch {
    return { ok: false, error: 'ui.noCompose' };
  }
}

/**
 * @param {string} text
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function writeComposeBody(text) {
  const tab = await findComposeTab();
  if (!tab) return { ok: false, error: 'ui.noCompose' };
  try {
    const details = await api.compose.getComposeDetails(tab.id);
    if (details.isPlainText) {
      await api.compose.setComposeDetails(tab.id, {
        plainTextBody: String(text ?? ''),
      });
    } else {
      await api.compose.setComposeDetails(tab.id, {
        body: plainToHtmlBody(text),
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'ui.noCompose' };
  }
}
