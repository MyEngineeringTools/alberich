/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * W9 laboratory sharing session. Payload is frozen at start.
 * Not wired to the product share button.
 */

import { encodeCbqr2 } from './cbqr2-binary.js';
import {
  TRANSPORT_CODEC,
  encodeCbqr2Transport,
  encodeStaticText,
} from './cbqr2-transport.js';
import { UrBytesEncoder } from './ur-bytes.js';
import { bytesToHex } from './mur-fountain.js';
import {
  DISPLAY_PRESETS,
  QR_ECC_DEFAULT,
  coverCanvas,
  drawQrToCanvas,
  encodeDynamicFrame,
  encodeStaticFrame,
} from './cbqr2-lab-qr.js';

export const LAB_MODE = Object.freeze({
  STATIC: 'STATIC',
  DYNAMIC: 'DYNAMIC',
});

async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(buf));
}

/**
 * Freeze CBQR2 + transport envelope for one sharing session.
 * Subsequent codebook edits do not affect this object.
 */
export async function freezeShareSession({
  timebook,
  codec = TRANSPORT_CODEC.GZIP,
  mode = LAB_MODE.DYNAMIC,
  maxFragmentLen = 250,
  minFragmentLen = 10,
  ecc = QR_ECC_DEFAULT,
} = {}) {
  if (mode !== LAB_MODE.STATIC && mode !== LAB_MODE.DYNAMIC) {
    throw new Error('lab.session.mode');
  }
  if (codec !== TRANSPORT_CODEC.RAW && codec !== TRANSPORT_CODEC.GZIP) {
    throw new Error('lab.session.codec');
  }
  const packed = await encodeCbqr2(timebook);
  if (!packed.ok) return packed;
  const env = await encodeCbqr2Transport(packed.bytes, codec);
  if (!env.ok) return env;
  const cbqr2Sha256 = await sha256Hex(packed.bytes);
  let encoder = null;
  let staticText = null;
  if (mode === LAB_MODE.STATIC) {
    const st = encodeStaticText(env.bytes);
    if (!st.ok) return st;
    staticText = st.text;
  } else {
    encoder = new UrBytesEncoder(env.bytes, { maxFragmentLen, minFragmentLen });
  }
  return {
    ok: true,
    mode,
    codec,
    ecc,
    maxFragmentLen,
    minFragmentLen,
    cbqr2Length: packed.bytes.length,
    envelopeLength: env.bytes.length,
    codebookFingerprint: packed.codebookFingerprint,
    cbqr2Sha256,
    seqLen: encoder ? encoder.seqLen : 1,
    fragmentLen: encoder ? encoder.fragmentLen : env.bytes.length,
    staticText,
    _encoder: encoder,
    _envelope: env.bytes,
    _cbqr2: packed.bytes,
  };
}

export async function nextSessionFrame(session) {
  if (!session?.ok) throw new Error('lab.session.missing');
  if (session.mode === LAB_MODE.STATIC) return session.staticText;
  return session._encoder.nextPart();
}

export class LabSender {
  constructor() {
    this.session = null;
    this.running = false;
    this.paused = false;
    this.fps = 4;
    this.cssSize = DISPLAY_PRESETS.medium;
    this.canvas = null;
    this.timer = null;
    this.framesShown = 0;
    this.lastMetrics = null;
    this.hiddenCovered = false;
    this._onVis = () => this._visibility();
    this._nextText = null;
  }

  attach(canvas) {
    this.canvas = canvas;
  }

  /**
   * @param {object} session from freezeShareSession
   * @param {{ fps?: number, cssSize?: number }} opts
   */
  async start(session, opts = {}) {
    this.abort({ keepSession: false });
    this.session = session;
    this.fps = Math.max(1, Number(opts.fps) || 4);
    this.cssSize = Math.max(64, Number(opts.cssSize) || DISPLAY_PRESETS.medium);
    this.running = true;
    this.paused = false;
    this.framesShown = 0;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVis);
    }
    this._nextText = await nextSessionFrame(session);
    await this._showCurrent();
    if (session.mode === LAB_MODE.DYNAMIC) this._schedule();
  }

  pause() {
    this.paused = true;
    this._clearTimer();
    if (this.canvas) coverCanvas(this.canvas);
  }

  async resume() {
    if (!this.session || !this.running) return;
    this.paused = false;
    this.hiddenCovered = false;
    await this._showCurrent();
    if (this.session.mode === LAB_MODE.DYNAMIC) this._schedule();
  }

  abort({ keepSession = false } = {}) {
    this.running = false;
    this.paused = false;
    this._clearTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVis);
    }
    if (this.canvas) coverCanvas(this.canvas);
    this._nextText = null;
    this.lastMetrics = null;
    if (!keepSession) this.session = null;
  }

  _clearTimer() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _visibility() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') {
      this._clearTimer();
      if (this.canvas) coverCanvas(this.canvas);
      this.hiddenCovered = true;
      return;
    }
    if (!this.running || !this.session || this.paused) return;
    this.hiddenCovered = false;
    void this._showCurrent().then(() => {
      if (this.running && !this.paused && !this.hiddenCovered && this.session?.mode === LAB_MODE.DYNAMIC) {
        this._schedule();
      }
    });
  }

  _schedule() {
    this._clearTimer();
    if (!this.running || this.paused || this.hiddenCovered || this.session?.mode !== LAB_MODE.DYNAMIC) {
      return;
    }
    const holdMs = 1000 / this.fps;
    this.timer = setTimeout(async () => {
      this.timer = null;
      if (!this.running || this.paused || this.hiddenCovered) return;
      this._nextText = await nextSessionFrame(this.session);
      await this._showCurrent();
      if (this.running && !this.paused && !this.hiddenCovered) this._schedule();
    }, holdMs);
  }

  async _showCurrent() {
    if (!this.canvas || !this.session || this._nextText == null) return;
    const encoded = this.session.mode === LAB_MODE.STATIC
      ? encodeStaticFrame(this._nextText, this.session.ecc)
      : encodeDynamicFrame(this._nextText, this.session.ecc);
    this.lastMetrics = drawQrToCanvas(this.canvas, encoded.qr, { cssSize: this.cssSize });
    this.lastMetrics.mode = encoded.mode;
    this.lastMetrics.ecc = encoded.ecc;
    this.lastMetrics.chars = encoded.chars;
    this.framesShown += 1;
  }
}
