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
 * Live-Video wird absichtlich anders behandelt als Bildimporte:
 * - BarcodeDetector (falls vorhanden) bekommt weiterhin den kompletten Frame.
 * - jsQR dekodiert pro Versuch nur eine Region. So bleibt die CPU-Last auf
 *   älteren Geräten niedrig und der sichtbare quadratische Scanbereich wird
 *   gegenüber irrelevanten Bildrändern priorisiert.
 *
 * scanPass:
 *   0 = mittlere 78 % des sichtbaren Quadrats (schnellster/typischer Fall)
 *   1 = 96 % des sichtbaren Quadrats
 *   2 = kompletter Sensorframe als Fallback
 *
 * @param {HTMLVideoElement} video
 * @param {{ scanPass?: number }} [options]
 * @returns {Promise<string|null>}
 */
export async function decodeQrTextFromVideoFrame(video, { scanPass = 0, preferFullFrame = false } = {}) {
  if (!video.videoWidth || !video.videoHeight) return null;

  const native = await tryBarcodeDetector(video);
  if (native) return native;

  return decodeVideoWithJsQr(video, preferFullFrame ? 2 : scanPass);
}

let nativeQrDetector = null;

/** @param {CanvasImageSource} source */
async function tryBarcodeDetector(source) {
  if (typeof BarcodeDetector === 'undefined') return null;
  try {
    if (nativeQrDetector === false) return null;
    if (!nativeQrDetector) {
      if (typeof BarcodeDetector.getSupportedFormats === 'function') {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (!Array.isArray(formats) || !formats.includes('qr_code')) {
          nativeQrDetector = false;
          return null;
        }
      }
      nativeQrDetector = new BarcodeDetector({ formats: ['qr_code'] });
    }
    const codes = await nativeQrDetector.detect(source);
    const raw = codes?.[0]?.rawValue;
    return typeof raw === 'string' && raw.length ? raw : null;
  } catch {
    return null;
  }
}

let scanCanvas = null;

/**
 * Statischer Bildimport: hier ist ein etwas größerer Decode-Puffer vertretbar,
 * weil nur einmal dekodiert wird. Kein Upscaling - künstliche Pixel verbessern
 * die Information nicht und kosten auf älteren iPads unnötig CPU.
 *
 * @param {CanvasImageSource} source
 * @returns {string|null}
 */
function decodeWithJsQr(source) {
  const { width: sw, height: sh } = getSourceSize(source);
  if (!sw || !sh) return null;

  return decodeRegionWithJsQr(source, {
    sx: 0,
    sy: 0,
    sw,
    sh,
    maxSide: 1800,
    inversionAttempts: 'attemptBoth',
  });
}

/**
 * @param {HTMLVideoElement} video
 * @param {number} scanPass
 * @returns {string|null}
 */
function decodeVideoWithJsQr(video, scanPass) {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  const pass = ((Number(scanPass) % 3) + 3) % 3;

  if (pass === 2) {
    return decodeRegionWithJsQr(video, {
      sx: 0,
      sy: 0,
      sw,
      sh,
      maxSide: 1536,
      inversionAttempts: 'dontInvert',
    });
  }

  // Die Vorschau ist quadratisch und nutzt object-fit: cover.
  // Deshalb entspricht das sichtbare Sensorfenster dem mittigen Quadrat
  // des nativen Videoframes.
  const visibleSide = Math.min(sw, sh);
  const visibleX = (sw - visibleSide) / 2;
  const visibleY = (sh - visibleSide) / 2;
  const fraction = pass === 0 ? 0.78 : 0.96;
  const side = visibleSide * fraction;

  return decodeRegionWithJsQr(video, {
    sx: visibleX + (visibleSide - side) / 2,
    sy: visibleY + (visibleSide - side) / 2,
    sw: side,
    sh: side,
    maxSide: 1536,
    inversionAttempts: 'dontInvert',
  });
}

/**
 * @param {CanvasImageSource} source
 * @param {{
 *   sx: number, sy: number, sw: number, sh: number,
 *   maxSide: number,
 *   inversionAttempts: 'dontInvert'|'onlyInvert'|'attemptBoth'|'invertFirst'
 * }} region
 * @returns {string|null}
 */
function decodeRegionWithJsQr(source, region) {
  const cropW = Math.max(1, Math.round(region.sw));
  const cropH = Math.max(1, Math.round(region.sh));
  const scale = Math.min(1, region.maxSide / Math.max(cropW, cropH));
  const w = Math.max(1, Math.round(cropW * scale));
  const h = Math.max(1, Math.round(cropH * scale));

  if (!scanCanvas) scanCanvas = document.createElement('canvas');
  if (scanCanvas.width !== w) scanCanvas.width = w;
  if (scanCanvas.height !== h) scanCanvas.height = h;

  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Bei eventueller Skalierung keine zusätzliche Glättung erzeugen.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    source,
    Math.round(region.sx),
    Math.round(region.sy),
    cropW,
    cropH,
    0,
    0,
    w,
    h,
  );

  const imageData = ctx.getImageData(0, 0, w, h);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: region.inversionAttempts,
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
