/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Kurier-QR als PNG-Data-URL (reine Canvas-Zeichnung).
 */

import qrcode from './vendor/qrcode-generator.js';

/**
 * @param {string} payload  ALBERICH-CTQR1-…
 * @param {{ scale?: number, margin?: number }} [opts]
 * @returns {string}
 */
export function courierPayloadToDataUrl(payload, opts = {}) {
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : 6;
  const margin = Number.isFinite(opts.margin) ? Number(opts.margin) : 2;
  const qr = qrcode(0, 'M');
  qr.addData(String(payload || ''), 'Alphanumeric');
  qr.make();
  const count = qr.getModuleCount();
  const size = (count + margin * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL('image/png');
}
