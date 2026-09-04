/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Export einer importierten Monatstafel (JSON + komprimierter QR).
 * Kompatibel mit Codebook-Tool und Web/Android-Import.
 */

import { gzipSync, strToU8 } from './vendor/fflate-browser.js';
import qrcode from './vendor/qrcode-generator.js';
import {
  ALBERICH_CODEBOOK_FORMAT,
  ALBERICH_CODEBOOK_FORMAT_VERSION,
} from './codebook.js';
import { rejectTimebookExport } from './timebook.js';

export const QR_PAYLOAD_MAGIC = 'ALBERICH-CBQR1';
export const QR_COMPRESSION = 'gzip';

const QR_ECC_ORDER = ['M', 'Q', 'L', 'H'];

/**
 * @typedef {import('./codebook.js').CodebookSheet} CodebookSheet
 * @typedef {import('./codebook.js').CodebookDay} CodebookDay
 */

/**
 * Vollständiges alberich-codebook-Objekt zum Download (pretty-print).
 * @param {CodebookSheet} sheet
 * @returns {object}
 */
export function sheetToExportObject(sheet) {
  rejectTimebookExport(sheet);
  const month = Number(sheet.month);
  const year = Number(sheet.year);
  const monthIndex0 =
    typeof sheet.monthIndex0 === 'number' ? sheet.monthIndex0 : month - 1;

  const days = (sheet.days || []).map((d) => dayToExport(d, year, month));

  const formatVersion = Number.isInteger(sheet.formatVersion)
    ? sheet.formatVersion
    : ALBERICH_CODEBOOK_FORMAT_VERSION;
  /** @type {Record<string, unknown>} */
  const out = {
    format: ALBERICH_CODEBOOK_FORMAT,
    formatVersion,
    machine: 'Enigma M4',
    generator: 'Alberich Web',
    year,
    month,
    monthIndex0,
    monthLabel: sheet.monthLabel || `${month}/${year}`,
    generatedAt: sheet.generatedAt || new Date().toISOString(),
    kenngruppen: false,
    dayCount: days.length,
    days,
  };
  if (sheet.endwalzePolicy) out.endwalzePolicy = sheet.endwalzePolicy;
  if (sheet.networkContext) out.networkContext = sheet.networkContext;
  return out;
}

/**
 * Schlankes JSON für QR (ohne meta/Dekor).
 * @param {CodebookSheet} sheet
 */
export function sheetToSlimExportObject(sheet) {
  rejectTimebookExport(sheet);
  const full = sheetToExportObject(sheet);
  const v3 = Number(full.formatVersion) >= 3;
  /** @type {Record<string, unknown>} */
  const slim = {
    format: full.format,
    formatVersion: full.formatVersion,
    year: full.year,
    month: full.month,
    days: v3
      ? full.days.map(compactV3QrDay)
      : full.days.map((d) => {
        /** @type {Record<string, unknown>} */
        const day = {
          day: d.day,
          reflectorId: d.reflectorId,
          rotorThin: d.rotorThin,
          rotorLeft: d.rotorLeft,
          rotorMiddle: d.rotorMiddle,
          rotorRight: d.rotorRight,
          ringCode: d.ringCode,
          keyCode: d.keyCode,
          plugboard: d.plugboard,
        };
        if (d.reflectorD) day.reflectorD = d.reflectorD;
        return day;
      }),
  };
  if (full.endwalzePolicy) slim.endwalzePolicy = full.endwalzePolicy;
  if (full.networkContext) slim.networkContext = full.networkContext;
  return slim;
}

/**
 * V3-QR-Tag: eine Pipe-Zeile, damit gzip+Base64 in QR-40-L passt.
 * day|thin|L|M|R|ring|key|plugs|wiring|lfL/lfM/lfR
 */
function compactV3QrDay(d) {
  const thin = d.rotorThin === 'Beta' || d.rotorThin === 'B' ? 'B' : 'G';
  const plugs = String(d.plugboard || '').replace(/[^A-Z]/g, '');
  const lf = d.lueckenfueller || {};
  return [
    d.day,
    thin,
    d.rotorLeft,
    d.rotorMiddle,
    d.rotorRight,
    d.ringCode,
    d.keyCode,
    plugs,
    d.endwalzeWiring || '',
    [lf.left || '', lf.middle || '', lf.right || ''].join('/'),
  ].join('|');
}

function expandPlugs(compact) {
  const letters = String(compact || '').toUpperCase().replace(/[^A-Z]/g, '');
  const pairs = [];
  for (let i = 0; i + 1 < letters.length; i += 2) {
    pairs.push(letters.slice(i, i + 2));
  }
  return pairs.join(' ');
}

/**
 * Slim-QR-JSON (V1/V2-Objekte oder V3-Pipe-Zeilen) → parsebares Codebook.
 * @param {unknown} raw
 */
export function expandSlimQrObject(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (!Array.isArray(obj.days)) return obj;
  return {
    ...obj,
    days: obj.days.map((d) => {
      if (typeof d !== 'string') return d;
      const p = d.split('|');
      if (p.length < 10) return d;
      const thinRaw = p[1];
      const thin = thinRaw === 'B' ? 'Beta' : thinRaw === 'G' ? 'Gamma' : thinRaw;
      const [left, middle, right] = (p[9] || '').split('/');
      return {
        day: Number(p[0]),
        rotorThin: thin,
        rotorLeft: p[2],
        rotorMiddle: p[3],
        rotorRight: p[4],
        ringCode: p[5],
        keyCode: p[6],
        plugboard: expandPlugs(p[7]),
        endwalzeWiring: p[8],
        lueckenfueller: { left: left || '', middle: middle || '', right: right || '' },
      };
    }),
  };
}

/**
 * @param {CodebookSheet} sheet
 * @param {number} [space=2]
 */
export function sheetToJsonString(sheet, space = 2) {
  return `${JSON.stringify(sheetToExportObject(sheet), null, space)}\n`;
}

/** @param {CodebookSheet} sheet */
export function sheetJsonFilename(sheet) {
  const y = Number(sheet.year) || 0;
  const m = String(Number(sheet.month) || 0).padStart(2, '0');
  return `alberich-codebook-${y}-${m}.json`;
}

/** @param {CodebookSheet} sheet */
export function sheetQrPngFilename(sheet) {
  const y = Number(sheet.year) || 0;
  const m = String(Number(sheet.month) || 0).padStart(2, '0');
  return `alberich-codebook-${y}-${m}-qr.png`;
}

/**
 * @param {CodebookSheet} sheet
 * @returns {{ payload: string, jsonBytes: number, gzipBytes: number, payloadBytes: number }}
 */
export function buildCompressedQrPayload(sheet) {
  const slim = sheetToSlimExportObject(sheet);
  const jsonText = JSON.stringify(slim);
  const jsonBytes = strToU8(jsonText);
  const gzipBytes = gzipSync(jsonBytes, { level: 9 });
  const b64 = bytesToBase64(gzipBytes);
  const payload = `${QR_PAYLOAD_MAGIC}|${QR_COMPRESSION}|${b64}`;
  return {
    payload,
    jsonBytes: jsonBytes.length,
    gzipBytes: gzipBytes.length,
    payloadBytes: strToU8(payload).length,
  };
}

/**
 * @param {string} payload
 * @param {{ scale?: number, margin?: number, ecc?: string }} [opts]
 * @returns {Promise<{ blob: Blob, ecc: string, modules: number, scale: number }>}
 */
export async function payloadToQrPngBlob(payload, opts = {}) {
  const scale = opts.scale ?? 6;
  const margin = opts.margin ?? 4;
  const preferredEcc = opts.ecc;
  const mode = opts.mode ?? 'Byte';
  const fallbackEcc = opts.fallbackEcc !== false;

  let lastError = null;
  const levels = preferredEcc
    ? fallbackEcc
      ? [preferredEcc, ...QR_ECC_ORDER.filter((e) => e !== preferredEcc)]
      : [preferredEcc]
    : QR_ECC_ORDER;

  for (const ecc of levels) {
    try {
      const qr = qrcode(0, ecc);
      qr.addData(payload, mode);
      qr.make();
      const modules = qr.getModuleCount();
      const blob = await drawQrPngBlob(qr, { scale, margin });
      return { blob, ecc, modules, scale };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('qr.err.tooLarge');
}

/**
 * @param {CodebookSheet} sheet
 * @returns {Promise<{
 *   blob: Blob,
 *   filename: string,
 *   payload: string,
 *   stats: { jsonBytes: number, gzipBytes: number, payloadBytes: number, ecc: string, modules: number }
 * }>}
 */
export async function sheetToQrPngExport(sheet) {
  const built = buildCompressedQrPayload(sheet);
  const { blob, ecc, modules } = await payloadToQrPngBlob(built.payload);
  return {
    blob,
    filename: sheetQrPngFilename(sheet),
    payload: built.payload,
    stats: {
      jsonBytes: built.jsonBytes,
      gzipBytes: built.gzipBytes,
      payloadBytes: built.payloadBytes,
      ecc,
      modules,
    },
  };
}

/**
 * @param {CodebookDay} d
 * @param {number} year
 * @param {number} month
 */
function dayToExport(d, year, month) {
  /** @type {Record<string, unknown>} */
  const day = {
    day: d.day,
    date:
      d.date ||
      `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
    reflectorId: d.reflectorId,
    rotorThin: d.rotorThin,
    rotorLeft: d.rotorLeft,
    rotorMiddle: d.rotorMiddle,
    rotorRight: d.rotorRight,
    ringCode: d.ringCode,
    keyCode: d.keyCode,
    plugboard: d.plugboard,
  };
  if (d.reflectorD) day.reflectorD = d.reflectorD;
  if (d.endwalzeWiring) day.endwalzeWiring = d.endwalzeWiring;
  if (d.lueckenfueller) day.lueckenfueller = d.lueckenfueller;
  if (d.meta && typeof d.meta === 'object') day.meta = d.meta;
  return day;
}

/**
 * @param {import('./vendor/qrcode-generator.js').default extends Function ? any : any} qr
 * @param {{ scale: number, margin: number }} opts
 */
function drawQrPngBlob(qr, { scale, margin }) {
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('qr.err.canvas'));

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          (col + margin) * scale,
          (row + margin) * scale,
          scale,
          scale,
        );
      }
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('qr.err.png'));
    }, 'image/png');
  });
}

/** @param {Uint8Array} bytes */
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
