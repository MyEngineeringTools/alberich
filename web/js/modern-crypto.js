/**
 * Kryptographischer Kern des Modern-Modus (Web).
 *
 * - Endwalze: nicht-involutorische Permutation (statt UKW)
 * - Lückenfüllerwalzen (Weg B): schlüsselabhängige Kerben aus Ringstellung + Steckerbrett
 * - Base-26: UTF-8-Bytes ↔ Buchstabenpaare A–Z
 * - Auto-Spruchschlüssel: Kopfgruppe + Körper (klassisch, mit Endwalze-Invertierung)
 *
 * Reine Hilfsfunktionen (Base-26, Kerben, Endwalze) sind DOM-frei und testbar.
 */

import {
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
  buildDoraReflectorWiring,
  DEFAULT_REFLECTOR_D_PAIRS,
} from './cipher-data.js';
import { randomFourLetters as secureRandomFourLetters } from './secure-random.js';

/** Mindestens so viele Steckerpaare im Modern-Modus (strenge Regel). */
export const MIN_STECKER_PAIRS = 3;

/**
 * Erlaubte Kerbenanzahlen pro Walze (Modern-Lückenfüller).
 * Sweet Spot {5, 7, 9}: variabel, teilerfremd zu 26, ohne Extreme (1 bzw. 15–25).
 * Ableitung wählt pro Walze index 0..2 aus {5, 7, 9}.
 */
export const LUECKENFUELLER_NOTCH_COUNTS = Object.freeze([5, 7, 9]);

/** @deprecated Alias für LUECKENFUELLER_NOTCH_COUNTS */
export const NOTCH_COUNTS_COPRIME_26 = LUECKENFUELLER_NOTCH_COUNTS;

/**
 * @deprecated Feste Muster der alten Ableitung (nur noch Doku/Tests).
 * Neu: Anzahl + Positionen aus Tagesschlüssel (siehe baseNotchPattern).
 */
export const LUECKENFUELLER_BASE = {
  left: 'AFLRX',
  middle: 'BEIMQUY',
  right: 'CDHKNPSVZ',
};

/**
 * Affine Permutation wiring[i] = (a·i + b) mod 26, gcd(a,26)=1 → bijektiv, nicht involutorisch.
 * @param {number} a
 * @param {number} b
 * @returns {string}
 */
export function affinePermutationWiring(a, b) {
  let out = '';
  for (let i = 0; i < 26; i++) {
    out += String.fromCharCode(65 + (((a * i + b) % 26) + 26) % 26);
  }
  return out;
}

/** Endwalze Bruno (Tagesschlüssel-UKW-B → Modern) */
export const ENDWALZE_BRUNO = affinePermutationWiring(3, 5);
/** Endwalze Caesar */
export const ENDWALZE_CAESAR = affinePermutationWiring(5, 8);
/** Feste Misch-Permutation für Dora-Komposition */
export const ENDWALZE_DORA_MIX = affinePermutationWiring(7, 3);

/**
 * @param {string} letter
 * @returns {number}
 */
export function letterToPos(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/**
 * @param {number} pos
 * @returns {string}
 */
export function posToLetter(pos) {
  return String.fromCharCode(65 + ((pos % 26) + 26) % 26);
}

/**
 * @param {string} wiring 26-Zeichen-Permutation
 * @returns {boolean}
 */
export function isPermutationWiring(wiring) {
  if (typeof wiring !== 'string' || wiring.length !== 26) return false;
  const seen = new Set();
  for (let i = 0; i < 26; i++) {
    const c = wiring[i];
    if (!/[A-Z]/.test(c) || seen.has(c)) return false;
    seen.add(c);
  }
  return true;
}

/**
 * @param {string} wiring
 * @returns {boolean}
 */
export function isInvolutoryWiring(wiring) {
  if (!isPermutationWiring(wiring)) return false;
  for (let i = 0; i < 26; i++) {
    const j = wiring.charCodeAt(i) - 65;
    if (wiring.charCodeAt(j) - 65 !== i) return false;
  }
  return true;
}

/**
 * Inverse einer 26er-Permutations-Verkabelung (als String).
 * @param {string} wiring
 * @returns {string}
 */
export function inverseWiring(wiring) {
  const out = Array(26);
  for (let i = 0; i < 26; i++) {
    out[wiring.charCodeAt(i) - 65] = String.fromCharCode(65 + i);
  }
  return out.join('');
}

/**
 * Komposition F ∘ G: (F∘G)(i) = F(G(i)).
 * @param {string} f
 * @param {string} g
 * @returns {string}
 */
export function composeWiring(f, g) {
  let out = '';
  for (let i = 0; i < 26; i++) {
    const gImg = g.charCodeAt(i) - 65;
    out += f[gImg];
  }
  return out;
}

/**
 * Steckerpaare kanonisch: jedes Paar A<B, Paare lexikographisch, Buchstaben disjunkt.
 * @param {string} plugboard
 * @returns {string[]} z. B. ['AE','BF',…]
 */
export function normalizePlugPairsCanonical(plugboard) {
  const used = new Set();
  /** @type {string[]} */
  const pairs = [];
  const tokens = String(plugboard ?? '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (token.length !== 2) continue;
    const x = token[0];
    const y = token[1];
    if (!/[A-Z]/.test(x) || !/[A-Z]/.test(y) || x === y) continue;
    if (used.has(x) || used.has(y)) continue;
    used.add(x);
    used.add(y);
    pairs.push(x < y ? `${x}${y}` : `${y}${x}`);
  }

  pairs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs;
}

/**
 * Kerbenmuster um `shift` Positionen (0–25) rotieren: jeder Buchstabe +shift mod 26.
 * @param {string} base
 * @param {number} shift
 * @returns {string}
 */
export function rotateNotchPattern(base, shift) {
  const s = ((shift % 26) + 26) % 26;
  return [...base]
    .map((ch) => posToLetter(letterToPos(ch) + s))
    .sort()
    .join('');
}

/**
 * Basis-Kerbenpositionen: `count` Stellen möglichst gleichmäßig auf 0…25.
 * Regel: position[k] = floor(k · 26 / count) für k = 0 … count−1 (alle distinkt für erlaubte counts).
 * @param {number} count
 * @returns {string} sortierte Buchstaben
 */
export function baseNotchPattern(count) {
  const c = Math.floor(Number(count));
  if (!Number.isFinite(c) || c < 1 || c > 26) return '';
  const positions = [];
  for (let k = 0; k < c; k++) {
    positions.push(Math.floor((k * 26) / c) % 26);
  }
  // Stabil: sortieren und als Buchstaben (Duplikate wären ein Ableitungsfehler)
  const unique = [...new Set(positions)].sort((a, b) => a - b);
  return unique.map(posToLetter).join('');
}

/**
 * Steckerpaare normalisieren (Array oder String).
 * @param {string|string[]} plugboardOrPairs
 * @returns {string[]}
 */
function normalizePairsInput(plugboardOrPairs) {
  if (Array.isArray(plugboardOrPairs)) {
    return [...plugboardOrPairs]
      .map((p) => {
        const u = String(p).toUpperCase();
        if (u.length !== 2) return u;
        return u[0] < u[1] ? u : `${u[1]}${u[0]}`;
      })
      .filter((p) => p.length === 2)
      .sort();
  }
  return normalizePlugPairsCanonical(plugboardOrPairs);
}

/**
 * Lückenfüller-Parameter aus Tagesschlüssel (Ringstellung L/M/R + Stecker).
 *
 * Deterministisch (kein HKDF), Enigma-Spirit:
 * 1. Paare kanonisch, n ≥ 3
 * 2. Pro Slot i ∈ {0,1,2} (links / mitte / rechts):
 *    shift[i] = ( ring[i]
 *      + 7·p_i[0] + 11·p_i[1]
 *      + 3·p_{i+1}[0] + 5·p_{i+1}[1]
 *      + 13·p_{i+2}[0] + 17·n + 19·i ) mod 26
 *    countIdx[i] = ( ring[i]
 *      + 11·p_i[0] + 13·p_i[1]
 *      + 17·p_{i+1}[0] + 19·p_{i+1}[1]
 *      + 23·p_{i+2}[1] + 3·n + 7·i ) mod 12
 *    counts[i] = LUECKENFUELLER_NOTCH_COUNTS[countIdx[i]]  // {5,7,9}
 *    mit p_j = pairs[j mod n]
 *
 * @param {string} ringLeft
 * @param {string} ringMiddle
 * @param {string} ringRight
 * @param {string|string[]} plugboardOrPairs
 * @returns {{ ok: true, counts: [number, number, number], shifts: [number, number, number], pairs: string[] }
 *   | { ok: false, error: string, counts: null, shifts: null, pairs: string[] }}
 */
export function deriveLueckenfuellerParams(
  ringLeft,
  ringMiddle,
  ringRight,
  plugboardOrPairs,
) {
  const pairs = normalizePairsInput(plugboardOrPairs);

  if (pairs.length < MIN_STECKER_PAIRS) {
    return {
      ok: false,
      error: 'modern.needMinPlugs',
      counts: null,
      shifts: null,
      pairs,
    };
  }

  const rings = [
    letterToPos(String(ringLeft || 'A')[0]),
    letterToPos(String(ringMiddle || 'A')[0]),
    letterToPos(String(ringRight || 'A')[0]),
  ];
  const n = pairs.length;
  /** @type {[number, number, number]} */
  const shifts = [0, 0, 0];
  /** @type {[number, number, number]} */
  const counts = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    const p0 = pairs[i % n];
    const p1 = pairs[(i + 1) % n];
    const p2 = pairs[(i + 2) % n];
    const a0 = letterToPos(p0[0]);
    const a1 = letterToPos(p0[1]);
    const b0 = letterToPos(p1[0]);
    const b1 = letterToPos(p1[1]);
    const c0 = letterToPos(p2[0]);
    const c1 = letterToPos(p2[1]);

    shifts[i] = (
      rings[i]
      + 7 * a0
      + 11 * a1
      + 3 * b0
      + 5 * b1
      + 13 * c0
      + 17 * n
      + 19 * i
    ) % 26;

    const countIdx = (
      rings[i]
      + 11 * a0
      + 13 * a1
      + 17 * b0
      + 19 * b1
      + 23 * c1
      + 3 * n
      + 7 * i
    ) % LUECKENFUELLER_NOTCH_COUNTS.length;

    counts[i] = LUECKENFUELLER_NOTCH_COUNTS[countIdx];
  }

  return { ok: true, counts, shifts, pairs };
}

/**
 * @deprecated Alias: nur Shifts (Kompatibilität interner Aufrufe/Tests).
 * Nutze deriveLueckenfuellerParams für Anzahl + Shift.
 */
export function deriveNotchShiftsWegB(ringLeft, ringMiddle, ringRight, plugboardOrPairs) {
  const r = deriveLueckenfuellerParams(
    ringLeft,
    ringMiddle,
    ringRight,
    plugboardOrPairs,
  );
  if (!r.ok) {
    return {
      ok: false,
      error: r.error,
      shifts: null,
      pairs: r.pairs,
    };
  }
  return { ok: true, shifts: r.shifts, pairs: r.pairs };
}

/**
 * Kerbenstrings für die drei beweglichen Walzen (Modern-Lückenfüller).
 * Anzahl und Positionen aus Tagesschlüssel; kein neues Tafel-Feld.
 *
 * @param {string} ringLeft
 * @param {string} ringMiddle
 * @param {string} ringRight
 * @param {string|string[]} plugboardOrPairs
 * @returns {{ ok: true, notches: { left: string, middle: string, right: string },
 *     counts: [number, number, number], shifts: [number, number, number], pairs: string[] }
 *   | { ok: false, error: string, notches: null, counts: null, shifts: null, pairs: string[] }}
 */
export function deriveLueckenfuellerNotches(
  ringLeft,
  ringMiddle,
  ringRight,
  plugboardOrPairs,
) {
  const derived = deriveLueckenfuellerParams(
    ringLeft,
    ringMiddle,
    ringRight,
    plugboardOrPairs,
  );
  if (!derived.ok) {
    return {
      ok: false,
      error: derived.error,
      notches: null,
      counts: null,
      shifts: null,
      pairs: derived.pairs,
    };
  }
  const [cL, cM, cR] = derived.counts;
  const [sL, sM, sR] = derived.shifts;
  return {
    ok: true,
    counts: derived.counts,
    shifts: derived.shifts,
    pairs: derived.pairs,
    notches: {
      left: rotateNotchPattern(baseNotchPattern(cL), sL),
      middle: rotateNotchPattern(baseNotchPattern(cM), sM),
      right: rotateNotchPattern(baseNotchPattern(cR), sR),
    },
  };
}

/**
 * Endwalzen-Verdrahtung aus Tagesschlüssel-UKW-Auswahl (Struktur unverändert).
 * Bruno/Caesar: feste affine Endwalzen.
 * Dora: UKW-Dora (involutorisch) ∘ ENDWALZE_DORA_MIX → nicht involutorisch.
 *
 * @param {string} reflectorId
 * @param {string} [reflectorDPairs]
 * @param {boolean} [doraFree]
 * @returns {string}
 */
export function resolveEndwalzeWiring(
  reflectorId,
  reflectorDPairs = DEFAULT_REFLECTOR_D_PAIRS,
  doraFree = false,
) {
  const id = String(reflectorId || REFLECTOR_ID_BRUNO).toUpperCase();
  if (id === REFLECTOR_ID_CAESAR) return ENDWALZE_CAESAR;
  if (id === REFLECTOR_ID_DORA) {
    const ukw = buildDoraReflectorWiring(
      reflectorDPairs || DEFAULT_REFLECTOR_D_PAIRS,
      doraFree,
    );
    return composeWiring(ENDWALZE_DORA_MIX, ukw);
  }
  return ENDWALZE_BRUNO;
}

/**
 * UTF-8-Text → Base-26-Buchstabenstrom.
 * Jedes Byte b (0–255) wird zu zwei Buchstaben: high=⌊b/26⌋, low=b mod 26 (A=0…Z=25).
 *
 * @param {string} text
 * @returns {string} nur A–Z, Länge = 2 × UTF-8-Bytes
 */
export function utf8ToBase26(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += posToLetter(Math.floor(b / 26));
    out += posToLetter(b % 26);
  }
  return out;
}

/**
 * Base-26-Buchstabenstrom → UTF-8-Text.
 * Unvollständiges letztes Zeichen (ungerade Länge) wird verworfen.
 * Werte &gt; 255 oder ungültige Sequenzen werden als U+FFFD ersetzt (via TextDecoder).
 *
 * @param {string} letters
 * @returns {string}
 */
export function base26ToUtf8(letters) {
  const clean = String(letters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const pairCount = Math.floor(clean.length / 2);
  const bytes = new Uint8Array(pairCount);
  let write = 0;
  for (let i = 0; i < pairCount; i++) {
    const hi = letterToPos(clean[i * 2]);
    const lo = letterToPos(clean[i * 2 + 1]);
    const value = hi * 26 + lo;
    if (value > 255) continue;
    bytes[write++] = value;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, write));
}

/**
 * Zufälliger 4-Buchstaben-Spruchschlüssel (A–Z).
 * Standard: Web Crypto (CSPRNG). Optionaler rng für Tests: () => [0,1).
 * @param {(() => number)|null} [rng]
 * @returns {string}
 */
export function randomMessageKey4(rng = null) {
  if (typeof rng === 'function') {
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += posToLetter(Math.floor(rng() * 26) % 26);
    }
    return out;
  }
  return secureRandomFourLetters();
}

/**
 * Modern: verschlüsseln mit Auto-Spruchschlüssel + Base-26.
 * configure(keyCode4) muss Maschine auf Tagesschlüssel bzw. Spruchschlüssel setzen
 * (inkl. Endwalze/Lückenfüller) und true bei Erfolg liefern.
 *
 * @param {{
 *   engine: { encryptMessage: (s: string) => string },
 *   configure: (keyCode: string) => boolean,
 *   groundKey: string,
 *   plainText: string,
 *   messageKey: string,
 * }} opts
 * @returns {{ ok: true, cipher: string, header: string, body: string, messageKey: string, base26Length: number }
 *   | { ok: false, error: string }}
 */
export function modernEncryptPayload(opts) {
  const { engine, configure, groundKey, plainText, messageKey } = opts;
  if (!/^[A-Z]{4}$/.test(groundKey)) {
    return { ok: false, error: 'modern.groundIncomplete' };
  }
  if (!/^[A-Z]{4}$/.test(messageKey)) {
    return { ok: false, error: 'modern.messageKeyInvalid' };
  }
  const bodyLetters = utf8ToBase26(plainText);
  if (!configure(groundKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const header = engine.encryptMessage(messageKey);
  if (header.length !== 4) {
    return { ok: false, error: 'modern.headerFailed' };
  }
  if (!configure(messageKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const body = engine.encryptMessage(bodyLetters);
  return {
    ok: true,
    cipher: header + body,
    header,
    body,
    messageKey,
    base26Length: bodyLetters.length,
  };
}

/**
 * Modern: entschlüsseln (Indikator/Kopfgruppe + Base-26-Rückwandlung).
 *
 * @param {{
 *   engine: { decryptMessage: (s: string) => string },
 *   configure: (keyCode: string) => boolean,
 *   groundKey: string,
 *   cipherLetters: string,
 * }} opts
 * @returns {{ ok: true, plainText: string, header: string, bodyCipher: string, messageKey: string }
 *   | { ok: false, error: string }}
 */
export function modernDecryptPayload(opts) {
  const { engine, configure, groundKey, cipherLetters } = opts;
  if (!/^[A-Z]{4}$/.test(groundKey)) {
    return { ok: false, error: 'modern.groundIncomplete' };
  }
  const clean = String(cipherLetters ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (clean.length < 4) {
    return { ok: false, error: 'modern.tooShortForHeader' };
  }
  const header = clean.slice(0, 4);
  const bodyCipher = clean.slice(4);
  if (!configure(groundKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const messageKey = engine.decryptMessage(header);
  if (!/^[A-Z]{4}$/.test(messageKey)) {
    return { ok: false, error: 'modern.messageKeyInvalid' };
  }
  if (!configure(messageKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const bodyLetters = engine.decryptMessage(bodyCipher);
  const plainText = base26ToUtf8(bodyLetters);

  // Round-Trip: nur anzeigen, wenn erneutes Verschlüsseln denselben Geheimtext ergibt.
  // Verhindert Binärmüll bei falscher Grundstellung, unvollständigem Text oder
  // Klartext fälschlich im Geheimtext-Modus.
  if (!configure(groundKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const headerCheck = engine.encryptMessage(messageKey);
  if (headerCheck !== header) {
    return { ok: false, error: decryptFailureCode(bodyCipher) };
  }
  if (!configure(messageKey)) {
    return { ok: false, error: 'modern.configureFailed' };
  }
  const bodyCheck = engine.encryptMessage(utf8ToBase26(plainText));
  if (bodyCheck !== bodyCipher) {
    return { ok: false, error: decryptFailureCode(bodyCipher) };
  }

  return {
    ok: true,
    plainText,
    header,
    bodyCipher,
    messageKey,
  };
}

/** @param {string} bodyCipher */
function decryptFailureCode(bodyCipher) {
  if (!bodyCipher || bodyCipher.length % 2 !== 0) {
    return 'modern.decryptIncomplete';
  }
  return 'modern.decryptFailed';
}
