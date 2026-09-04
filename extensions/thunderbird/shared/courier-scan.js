/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * QR aus Bild oder Videobild lesen (BarcodeDetector, sonst jsQR).
 */

import jsQR from './vendor/jsQR.js';

/**
 * @param {Blob|File} blob
 * @returns {Promise<string>}
 */
export async function decodeQrTextFromBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const text = await decodeQrTextFromImageSource(bitmap);
    if (!text) throw new Error('qr.err.noCode');
    return text;
  } finally {
    bitmap.close?.();
  }
}

/**
 * @param {CanvasImageSource} source
 * @returns {Promise<string|null>}
 */
export async function decodeQrTextFromImageSource(source) {
  const native = await tryBarcodeDetector(source);
  if (native) return native;
  return decodeWithJsQr(source);
}

/**
 * @param {HTMLVideoElement} video
 * @returns {Promise<string|null>}
 */
export async function decodeQrTextFromVideoFrame(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  return decodeQrTextFromImageSource(video);
}

/** @param {CanvasImageSource} source */
async function tryBarcodeDetector(source) {
  if (typeof BarcodeDetector === 'undefined') return null;
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(source);
    const raw = codes?.[0]?.rawValue;
    return typeof raw === 'string' && raw.length ? raw : null;
  } catch {
    return null;
  }
}

/** @param {CanvasImageSource} source */
function decodeWithJsQr(source) {
  const { width: sw, height: sh } = getSourceSize(source);
  if (!sw || !sh) return null;

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data || null;
}

/** @param {CanvasImageSource} source */
function getSourceSize(source) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  const any = /** @type {{ width?: number, height?: number }} */ (source);
  return { width: any.width || 0, height: any.height || 0 };
}
