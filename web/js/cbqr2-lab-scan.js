/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * W9 laboratory continuous scanner. BarcodeDetector (if qr_code) then jsQR.
 * Not the product import GUI.
 */

import jsQR from './vendor/jsQR.js';
import { decodeCbqr2 } from './cbqr2-binary.js';
import { STATIC_TEXT_MAGIC, decodeCbqr2Transport, decodeStaticText } from './cbqr2-transport.js';
import { UrBytesDecoder } from './ur-bytes.js';
import { bytesToHex } from './mur-fountain.js';

export const TRANSFER = Object.freeze({
  VALID: 'TRANSFER_VALID',
  INVALID: 'TRANSFER_INVALID',
  PENDING: 'TRANSFER_PENDING',
});

export async function detectLabCapabilities() {
  const secureContext = typeof window === 'undefined' ? true : window.isSecureContext;
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  const getUserMedia = !!(media && typeof media.getUserMedia === 'function');
  const hasDetector = typeof BarcodeDetector === 'function';
  let qrFormat = false;
  if (hasDetector && typeof BarcodeDetector.getSupportedFormats === 'function') {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      qrFormat = Array.isArray(formats) && formats.includes('qr_code');
    } catch {
      qrFormat = false;
    }
  }
  return {
    secureContext,
    getUserMedia,
    barcodeDetector: hasDetector,
    qrFormat,
    jsQR: typeof jsQR === 'function',
    useBarcodeDetector: hasDetector && qrFormat,
  };
}

export function classifyCameraError(err) {
  const name = err?.name || '';
  const msg = String(err?.message || err || '');
  if (name === 'NotAllowedError' || msg === 'camera.denied') return 'permission-denied';
  if (name === 'NotFoundError' || msg === 'camera.notFound') return 'no-camera';
  if (name === 'NotReadableError' || msg === 'camera.inUse') return 'camera-in-use';
  if (name === 'SecurityError' || msg === 'camera.needHttps' || msg === 'camera.security') {
    return 'insecure-context';
  }
  if (name === 'NotSupportedError' || msg === 'camera.noApi') return 'scanner-unsupported';
  if (name === 'OverconstrainedError') return 'overconstrained';
  if (name === 'AbortError') return 'aborted';
  return 'camera-failed';
}

export async function startLabCamera() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    const err = new Error('camera.needHttps');
    err.name = 'SecurityError';
    throw err;
  }
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!media || typeof media.getUserMedia !== 'function') {
    const err = new Error('camera.noApi');
    err.name = 'NotSupportedError';
    throw err;
  }
  const attempts = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
  ];
  let last;
  for (const constraints of attempts) {
    try {
      return await media.getUserMedia(constraints);
    } catch (err) {
      last = err;
      const kind = classifyCameraError(err);
      if (kind === 'permission-denied' || kind === 'no-camera' || kind === 'insecure-context' || kind === 'scanner-unsupported') {
        throw err;
      }
    }
  }
  throw last instanceof Error ? last : new Error('camera.startFailed');
}

export function stopMediaStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* ignore */ }
  }
}

export function decodeJsQrFromRgba(data, width, height) {
  const code = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  return code?.data || null;
}

async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(buf));
}

function failInvalid(error) {
  return { status: TRANSFER.INVALID, error, timebook: null };
}

/**
 * Continuous receiver. Dedupe is in-memory only.
 * User progress = reconstructed source fragments / seqLen, never processedPartsCount.
 */
export class LabReceiver {
  constructor() {
    this.reset();
  }

  reset() {
    this.decoder = new UrBytesDecoder();
    this.seen = new Set();
    this.uniqueQr = 0;
    this.duplicates = 0;
    this.qrDecodes = 0;
    this.startedAt = 0;
    this.finishedAt = 0;
    this.status = TRANSFER.PENDING;
    this.error = null;
    this.timebook = null;
    this.cbqr2Sha256 = null;
    this.codebookFingerprint = null;
    this.codec = null;
  }

  abort() {
    this.reset();
  }

  get seqLen() {
    return this.decoder.fountain.expectedFragmentCount || (this.decoder.result ? 1 : 0);
  }

  get reconstructedFragments() {
    if (this.decoder.result) return this.seqLen || 1;
    return this.decoder.receivedFragmentIndexes?.size || 0;
  }

  progress() {
    const seqLen = this.seqLen;
    const reconstructed = this.reconstructedFragments;
    return {
      seqLen,
      uniqueQr: this.uniqueQr,
      reconstructed,
      duplicates: this.duplicates,
      qrDecodes: this.qrDecodes,
      complete: this.status === TRANSFER.VALID,
      status: this.status,
      processedPartsCount: this.decoder.processedPartsCount,
      label: seqLen
        ? `${reconstructed} / ${seqLen} Fragmente rekonstruiert`
        : 'Schlüsseltafel wird empfangen …',
    };
  }

  /**
   * @param {string} text QR payload
   */
  async ingest(text) {
    const raw = String(text || '').trim();
    if (!raw) return { kind: 'empty', status: this.status };
    this.qrDecodes += 1;
    if (!this.startedAt) this.startedAt = performance.now();
    if (this.status === TRANSFER.VALID) return { kind: 'done', status: this.status };
    if (this.seen.has(raw)) {
      this.duplicates += 1;
      return { kind: 'duplicate', status: this.status };
    }
    this.seen.add(raw);
    this.uniqueQr += 1;

    if (raw.startsWith(`${STATIC_TEXT_MAGIC}|`) || raw.startsWith('ALBERICH-CBQR2|')) {
      return this._acceptStatic(raw);
    }

    const accepted = await this.decoder.receive(raw);
    if (this.decoder.error) {
      const invalid = failInvalid(this.decoder.error);
      this._markInvalid(invalid.error);
      return { kind: 'invalid', ...invalid };
    }
    if (this.decoder.isSuccess) {
      const done = await this._acceptEnvelope(this.decoder.result);
      return { kind: done.status === TRANSFER.VALID ? 'valid' : 'invalid', ...done };
    }
    if (!accepted) {
      this.seen.delete(raw);
      this.uniqueQr -= 1;
      return { kind: 'ignored', status: this.status };
    }
    return { kind: 'accepted', status: this.status, progress: this.progress() };
  }

  async _acceptStatic(text) {
    const parsed = decodeStaticText(text);
    if (!parsed.ok) {
      this._markInvalid(parsed.error);
      return { kind: 'invalid', ...failInvalid(parsed.error) };
    }
    return this._acceptEnvelope(parsed.bytes);
  }

  async _acceptEnvelope(envelopeBytes) {
    const transport = await decodeCbqr2Transport(envelopeBytes);
    if (!transport.ok) {
      this._markInvalid(transport.error);
      return { kind: 'invalid', ...failInvalid(transport.error) };
    }
    const decoded = await decodeCbqr2(transport.bytes);
    if (!decoded.ok) {
      this._markInvalid(decoded.error);
      return { kind: 'invalid', ...failInvalid(decoded.error) };
    }
    this.status = TRANSFER.VALID;
    this.timebook = decoded.timebook;
    this.codec = transport.codec;
    this.codebookFingerprint = decoded.timebook.codebookFingerprint;
    this.cbqr2Sha256 = await sha256Hex(transport.bytes);
    this.finishedAt = performance.now();
    this.error = null;
    return {
      kind: 'valid',
      status: TRANSFER.VALID,
      codebookFingerprint: this.codebookFingerprint,
      cbqr2Sha256: this.cbqr2Sha256,
      codec: this.codec,
      elapsedMs: this.finishedAt - this.startedAt,
    };
  }

  _markInvalid(error) {
    this.status = TRANSFER.INVALID;
    this.error = error;
    this.timebook = null;
    this.cbqr2Sha256 = null;
    this.codebookFingerprint = null;
    this.finishedAt = performance.now();
    this.decoder = new UrBytesDecoder();
    this.seen = new Set();
  }
}

/**
 * Back-pressured scan loop. Detection fps is independent of sender fps.
 */
export class LabScanLoop {
  constructor() {
    this.running = false;
    this.busy = false;
    this.stream = null;
    this.video = null;
    this.raf = 0;
    this.receiver = new LabReceiver();
    this.caps = null;
    this.detector = null;
    this.onText = null;
    this.onError = null;
    this._onVis = () => this._visibility();
  }

  async start({ video, onText, onError } = {}) {
    this.abort();
    this.video = video;
    this.onText = onText;
    this.onError = onError;
    this.caps = await detectLabCapabilities();
    if (!this.caps.getUserMedia) {
      const err = new Error('camera.noApi');
      err.name = 'NotSupportedError';
      throw err;
    }
    if (this.caps.useBarcodeDetector) {
      this.detector = new BarcodeDetector({ formats: ['qr_code'] });
    }
    this.stream = await startLabCamera();
    if (this.video) {
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', '');
      this.video.muted = true;
      await this.video.play().catch(() => {});
    }
    this.running = true;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVis);
    }
    this._tick();
  }

  abort() {
    this.running = false;
    this.busy = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVis);
    }
    stopMediaStream(this.stream);
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
    }
    this.detector = null;
    this.receiver.abort();
  }

  _visibility() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') {
      this.busy = true;
    } else if (this.running) {
      this.busy = false;
      this._tick();
    }
  }

  _tick() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._step());
  }

  async _step() {
    if (!this.running) return;
    if (this.busy || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) {
      this._tick();
      return;
    }
    this.busy = true;
    try {
      const text = await this._detect();
      if (text && this.receiver.status !== TRANSFER.VALID) {
        const result = await this.receiver.ingest(text);
        if (this.onText) this.onText(result, this.receiver.progress());
      }
    } catch (err) {
      if (this.onError) this.onError(err);
    } finally {
      this.busy = false;
      if (this.running) this._tick();
    }
  }

  async _detect() {
    const video = this.video;
    if (!video || !video.videoWidth) return null;
    if (this.detector) {
      try {
        const codes = await this.detector.detect(video);
        const raw = codes?.[0]?.rawValue;
        if (typeof raw === 'string' && raw.length) return raw;
      } catch {
        /* fall through to jsQR */
      }
    }
    return decodeVideoJsQr(video);
  }
}

function decodeVideoJsQr(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / side);
  const dw = Math.max(1, Math.round(side * scale));
  const dh = dw;
  if (!decodeVideoJsQr._c) decodeVideoJsQr._c = document.createElement('canvas');
  const c = decodeVideoJsQr._c;
  if (c.width !== dw) c.width = dw;
  if (c.height !== dh) c.height = dh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, dw, dh);
  const img = ctx.getImageData(0, 0, dw, dh);
  return decodeJsQrFromRgba(img.data, img.width, img.height);
}
