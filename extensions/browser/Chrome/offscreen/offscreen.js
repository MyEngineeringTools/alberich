/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Offscreen-Dokument: Clipboard schreiben (Service Worker hat kein DOM/Clipboard).
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'clipboardWrite') return false;
  navigator.clipboard
    .writeText(String(msg.text ?? ''))
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});
