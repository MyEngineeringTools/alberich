/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * QR-Import für Alberich-Schlüsseltafeln.
 * Envelope: ALBERICH-CBQR1|gzip|<base64>  (Export aus Codebook-Tool)
 */

import { gunzipSync, strFromU8 } from './vendor/fflate-browser.js';
import jsQR from './vendor/jsQR.js';
import { parseCodebookJson } from './codebook.js';
import { expandSlimQrObject } from './codebook-export.js';
import { LIMITS } from './limits.js';

export const QR_PAYLOAD_MAGIC = 'ALBERICH-CBQR1';
export const QR_COMPRESSION = 'gzip';

/**
 * QR-Payload (Text) → validierte CodebookSheet.
 * @param {string} payload
 * @returns {{ ok: true, sheet: import('./codebook.js').CodebookSheet } | { ok: false, error: string }}
 */
export function parseCodebookQrPayload(payload) {
  let jsonObj;
  try {
    jsonObj = decodeCompressedQrPayload(payload);
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'qr.err.decompress',
    };
  }
  return parseCodebookJson(jsonObj);
}

/**
 * @param {string} payload
 * @returns {object} slim alberich-codebook JSON
 */
export function decodeCompressedQrPayload(payload) {
  const text = String(payload ?? '').trim();
  // Manche Scanner hängen Whitespace/Zeilenumbrüche an
  const cleaned = text.replace(/\s+/g, '');
  // Envelope kann mit Leerzeichen um | kommen — toleranter Split am Original
  const parts = text.split('|').map((p) => p.trim());
  if (parts.length < 3) {
    throw new Error('qr.err.badFormat');
  }
  const magic = parts[0];
  const algo = parts[1];
  // Base64 kann theoretisch | nicht enthalten; Rest joinen falls split zu viel
  const b64 = parts.slice(2).join('|').replace(/\s+/g, '');

  if (magic !== QR_PAYLOAD_MAGIC) {
    throw new Error(`qr.err.unknownMagic|${magic || 'empty'}`);
  }
  if (algo !== QR_COMPRESSION) {
    throw new Error(`qr.err.unknownAlgo|${algo}`);
  }
  if (!b64) {
    throw new Error('qr.err.emptyPayload');
  }
  if (b64.length > LIMITS.MAX_QR_COMPRESSED_BYTES * 2) {
    throw new Error('qr.err.tooLarge');
  }

  let compressed;
  try {
    compressed = base64ToBytes(b64);
  } catch {
    // Fallback: cleaned ohne Pipes neu parsen
    const m = cleaned.match(/^ALBERICH-CBQR1\|gzip\|(.+)$/i);
    if (!m) throw new Error('qr.err.badBase64');
    compressed = base64ToBytes(m[1]);
  }

  if (compressed.byteLength > LIMITS.MAX_QR_COMPRESSED_BYTES) {
    throw new Error('qr.err.tooLarge');
  }

  let jsonText;
  try {
    jsonText = strFromU8(gunzipSync(compressed));
  } catch {
    throw new Error('qr.err.gunzip');
  }
  if (jsonText.length > LIMITS.MAX_QR_DECOMPRESSED_BYTES) {
    throw new Error('qr.err.tooLarge');
  }

  try {
    return expandSlimQrObject(JSON.parse(jsonText));
  } catch {
    throw new Error('qr.err.badJson');
  }
}

/**
 * QR-Text aus Bilddatei oder Blob lesen.
 * @param {Blob|File} blob
 * @returns {Promise<string>}
 */
export async function decodeQrTextFromBlob(blob) {
  const size = Number(blob?.size ?? 0);
  if (size > LIMITS.MAX_QR_IMAGE_BYTES) {
    throw new Error('qr.err.imageTooLarge');
  }
  const bitmap = await createImageBitmap(blob);
  if (
    bitmap.width > LIMITS.MAX_QR_IMAGE_EDGE
    || bitmap.height > LIMITS.MAX_QR_IMAGE_EDGE
    || bitmap.width * bitmap.height > LIMITS.MAX_QR_IMAGE_PIXELS
  ) {
    bitmap.close?.();
    throw new Error('qr.err.imageTooLarge');
  }
  try {
    const text = await decodeQrTextFromImageSource(bitmap);
    if (!text) throw new Error('qr.err.noCode');
    return text;
  } finally {
    bitmap.close?.();
  }
}

/**
 * @param {CanvasImageSource} source  ImageBitmap | HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
 * @returns {Promise<string|null>}
 */
export async function decodeQrTextFromImageSource(source) {
  // 1) Native BarcodeDetector (Chrome/Edge/Android), wenn vorhanden
  const native = await tryBarcodeDetector(source);
  if (native) return native;

  // 2) jsQR auf skaliertem Canvas
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

/**
 * @param {CanvasImageSource} source
 * @returns {string|null}
 */
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
  // OffscreenCanvas etc.
  const any = /** @type {{ width?: number, height?: number }} */ (source);
  return { width: any.width || 0, height: any.height || 0 };
}

/** @param {string} b64 */
function base64ToBytes(b64) {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
