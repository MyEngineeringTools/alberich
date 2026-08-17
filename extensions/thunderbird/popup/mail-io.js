/**
 * Thunderbird: angezeigte (gelesene) Nachricht lesen.
 * Lese-Fenster ist read-only → Entschlüsselung öffnet Ergebnis-Tab.
 */

import { htmlToPlain } from './compose-io.js';

const api = globalThis.browser ?? globalThis.chrome;

/**
 * @returns {Promise<object|null>} MessageHeader o.ä.
 */
export async function findDisplayedMessage() {
  if (!api.messageDisplay?.getDisplayedMessages) return null;

  const tryList = async (tabId) => {
    try {
      const list =
        tabId != null
          ? await api.messageDisplay.getDisplayedMessages(tabId)
          : await api.messageDisplay.getDisplayedMessages();
      const messages = list?.messages ?? (Array.isArray(list) ? list : []);
      return messages[0] || null;
    } catch {
      return null;
    }
  };

  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    for (const tab of tabs || []) {
      const msg = await tryList(tab.id);
      if (msg) return msg;
    }
  } catch {
    /* ignore */
  }

  return tryList(undefined);
}

/**
 * MIME-Baum → Text (bevorzugt text/plain).
 * @param {object} part
 * @returns {{ plain: string, html: string }}
 */
function collectParts(part) {
  let plain = '';
  let html = '';
  if (!part) return { plain, html };

  const ct = String(part.contentType || '').toLowerCase();
  if (part.body && typeof part.body === 'string') {
    if (ct.includes('text/plain')) plain += part.body;
    else if (ct.includes('text/html')) html += part.body;
    else if (!ct || ct.startsWith('text/')) plain += part.body;
  }

  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const sub = collectParts(child);
      plain += sub.plain;
      html += sub.html;
    }
  }
  return { plain, html };
}

/**
 * @param {number|string} messageId
 * @returns {Promise<string>}
 */
async function extractMessageText(messageId) {
  // Moderne API (TB 128+)
  if (typeof api.messages?.listInlineTextParts === 'function') {
    try {
      const parts = await api.messages.listInlineTextParts(messageId);
      if (Array.isArray(parts) && parts.length) {
        const plain = parts.find((p) =>
          String(p.contentType || '').toLowerCase().includes('text/plain'),
        );
        if (plain?.content) return String(plain.content);

        const html = parts.find((p) =>
          String(p.contentType || '').toLowerCase().includes('text/html'),
        );
        if (html?.content) return htmlToPlain(html.content);

        return String(parts[0].content || '');
      }
    } catch {
      /* Fallback getFull */
    }
  }

  const full = await api.messages.getFull(messageId);
  const { plain, html } = collectParts(full);
  if (plain.trim()) return plain;
  if (html.trim()) return htmlToPlain(html);
  return '';
}

/**
 * @returns {Promise<{ ok: true, text: string, subject?: string } | { ok: false, error: string }>}
 */
export async function readDisplayedMessageBody() {
  if (!api.messages?.getFull && !api.messages?.listInlineTextParts) {
    return { ok: false, error: 'ui.noMessageApi' };
  }

  const message = await findDisplayedMessage();
  if (!message?.id) {
    return { ok: false, error: 'ui.noMessage' };
  }

  try {
    const text = await extractMessageText(message.id);
    if (!String(text || '').trim()) {
      return { ok: false, error: 'emptyInput' };
    }
    return {
      ok: true,
      text,
      subject: message.subject || '',
    };
  } catch (err) {
    console.error('Alberich read message failed', err);
    return { ok: false, error: 'ui.messageReadFailed' };
  }
}

/** Storage-Key für Ergebnis-Tab (einmalig). */
export const RESULT_STORAGE_KEY = 'alberichCompanion.lastResult';

/**
 * Klartext in neuem Tab anzeigen.
 * @param {{ plainText: string, messageKey?: string, header?: string, subject?: string }} payload
 */
export async function openDecryptResultTab(payload) {
  await api.storage.local.set({
    [RESULT_STORAGE_KEY]: {
      plainText: String(payload.plainText ?? ''),
      messageKey: payload.messageKey || '',
      header: payload.header || '',
      subject: payload.subject || '',
      createdAt: Date.now(),
    },
  });

  await api.tabs.create({
    url: api.runtime.getURL('result/result.html'),
    active: true,
  });
}
