/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * W9 laboratory QR rendering. Not the product share path.
 * Dynamic UR: uppercase alphanumeric. Static envelope: Byte mode.
 */

import qrcode from './vendor/qrcode-generator.js';

export const QR_QUIET_MODULES = 4;
export const QR_ECC_DEFAULT = 'M';

/** QR alphanumeric: 0-9 A-Z space $%*+-./: */
const ALNUM_RE = /^[0-9A-Z $%*+\-./:]+$/;

export function isQrAlphanumeric(text) {
  return typeof text === 'string' && text.length > 0 && ALNUM_RE.test(text);
}

export function urForQr(frame) {
  return String(frame || '').trim().toUpperCase();
}

/**
 * Encode payload with an explicit QR mode. Throws if Alphanumeric is
 * requested for illegal characters — never silently falls back to Byte.
 * @returns {{ qr: object, mode: string, modules: number, type: number, chars: number }}
 */
export function encodeLabQr(text, { ecc = QR_ECC_DEFAULT, mode } = {}) {
  const payload = String(text ?? '');
  if (!payload) throw new Error('lab.qr.empty');
  if (mode !== 'Alphanumeric' && mode !== 'Byte') throw new Error('lab.qr.mode');
  if (mode === 'Alphanumeric' && !isQrAlphanumeric(payload)) {
    throw new Error('lab.qr.notAlphanumeric');
  }
  const qr = qrcode(0, ecc);
  qr.addData(payload, mode);
  qr.make();
  const modules = qr.getModuleCount();
  return {
    qr,
    mode,
    ecc,
    modules,
    type: (modules - 17) / 4,
    chars: payload.length,
  };
}

export function encodeDynamicFrame(ur, ecc = QR_ECC_DEFAULT) {
  return encodeLabQr(urForQr(ur), { ecc, mode: 'Alphanumeric' });
}

export function encodeStaticFrame(text, ecc = QR_ECC_DEFAULT) {
  return encodeLabQr(text, { ecc, mode: 'Byte' });
}

/**
 * Rasterize to RGBA without Canvas (Node optical tests).
 * Quiet zone is QR_QUIET_MODULES white modules.
 */
export function rasterizeQrToRgba(qr, { modulePx = 3, quietModules = QR_QUIET_MODULES } = {}) {
  const n = qr.getModuleCount();
  const px = Math.max(1, Math.floor(modulePx));
  const quiet = Math.max(0, quietModules | 0);
  const dim = (n + quiet * 2) * px;
  const data = new Uint8ClampedArray(dim * dim * 4);
  data.fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const x0 = (c + quiet) * px;
      const y0 = (r + quiet) * px;
      for (let dy = 0; dy < px; dy++) {
        for (let dx = 0; dx < px; dx++) {
          const i = ((y0 + dy) * dim + (x0 + dx)) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return {
    data,
    width: dim,
    height: dim,
    modules: n,
    type: (n - 17) / 4,
    modulePx: px,
    quietModules: quiet,
    dim,
  };
}

/**
 * Draw onto an existing canvas. Integer module pixels, no smoothing,
 * quiet zone ≥ 4 modules, no logo. cssSize is the layout box in CSS pixels.
 */
export function drawQrToCanvas(canvas, qr, { cssSize, quietModules = QR_QUIET_MODULES } = {}) {
  const n = qr.getModuleCount();
  const quiet = Math.max(QR_QUIET_MODULES, quietModules | 0);
  const totalModules = n + quiet * 2;
  const box = Math.max(totalModules, Math.floor(Number(cssSize) || totalModules));
  const modulePx = Math.max(1, Math.floor(box / totalModules));
  const pixel = totalModules * modulePx;
  canvas.width = pixel;
  canvas.height = pixel;
  canvas.style.width = `${pixel}px`;
  canvas.style.height = `${pixel}px`;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('lab.qr.canvas');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixel, pixel);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      ctx.fillRect((c + quiet) * modulePx, (r + quiet) * modulePx, modulePx, modulePx);
    }
  }
  const dpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
  return {
    modules: n,
    type: (n - 17) / 4,
    quietModules: quiet,
    canvasPx: pixel,
    cssPx: pixel,
    moduleCssPx: modulePx,
    moduleDevicePx: modulePx * dpr,
    devicePixelRatio: dpr,
  };
}

export function coverCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export const DISPLAY_PRESETS = Object.freeze({
  small: 180,
  medium: 320,
  large: 512,
});
