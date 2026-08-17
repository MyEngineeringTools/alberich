/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// Historische Enigma-Satzzeichen (Kriegsmarine-Praxis; Komma als Y).
// Wehrmacht nutzte für Komma teilweise ZZ statt Y.
const PUNCTUATION_CODENAMES = {
  '.': 'X',
  ',': 'Y',
  '?': 'UD',
  ':': 'XX',
  '-': 'YY',
  '–': 'YY',
  '—': 'YY',
  '/': 'YY',
  '(': 'KK',
  ')': 'KK',
};

const ONES_UP_TO_NINETEEN = [
  'NULL', 'EINS', 'ZWEI', 'DREI', 'VIER', 'FUENF', 'SECHS', 'SIEBEN', 'ACHT', 'NEUN',
  'ZEHN', 'ELF', 'ZWOELF', 'DREIZEHN', 'VIERZEHN', 'FUENFZEHN', 'SECHZEHN', 'SIEBZEHN', 'ACHTZEHN', 'NEUNZEHN',
];

const TENS = ['', '', 'ZWANZIG', 'DREISSIG', 'VIERZIG', 'FUENFZIG', 'SECHZIG', 'SIEBZIG', 'ACHTZIG', 'NEUNZIG'];

function resolveUmlauts(text) {
  return text
    .replace(/ä/g, 'AE')
    .replace(/Ä/g, 'AE')
    .replace(/ö/g, 'OE')
    .replace(/Ö/g, 'OE')
    .replace(/ü/g, 'UE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS');
}

function appendToken(builder, token) {
  if (!token) return;
  if (builder.length > 0 && builder[builder.length - 1] !== ' ') builder.push(' ');
  builder.push(token);
}

function appendSpace(builder) {
  if (builder.length > 0 && builder[builder.length - 1] !== ' ') builder.push(' ');
}

function numberBelowHundred(value) {
  if (value < 20) return ONES_UP_TO_NINETEEN[value];
  if (value < 100) {
    const ones = value % 10;
    const tens = Math.floor(value / 10);
    if (ones === 0) return TENS[tens];
    return `${ONES_UP_TO_NINETEEN[ones]}UND${TENS[tens]}`;
  }
  return numberToGerman(value);
}

function numberBelowThousand(value) {
  return value < 100 ? numberBelowHundred(value) : numberToGerman(value);
}

function numberToGerman(value) {
  if (value === 0) return 'NULL';
  if (value < 0) return numberToGerman(-value);
  if (value < 100) return numberBelowHundred(value);
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    const hundredWord = hundreds === 1 ? 'HUNDERT' : `${numberBelowHundred(hundreds)}HUNDERT`;
    return remainder === 0 ? hundredWord : hundredWord + numberBelowHundred(remainder);
  }
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    const thousandWord = thousands === 1 ? 'TAUSEND' : `${numberBelowThousand(thousands)}TAUSEND`;
    return remainder === 0 ? thousandWord : thousandWord + numberBelowThousand(remainder);
  }
  return String(value);
}

function convertNumberToken(digits) {
  if (digits.length === 4) {
    const first = parseInt(digits.slice(0, 2), 10);
    const second = parseInt(digits.slice(2, 4), 10);
    const firstWord = numberBelowHundred(first);
    if (second === 0) return firstWord;
    return `${firstWord} ${numberBelowHundred(second)}`;
  }
  return numberToGerman(parseInt(digits, 10));
}

export function normalizeInputForEnigma(text) {
  const resolved = resolveUmlauts(text);
  const builder = [];
  let index = 0;
  // After a substituted token (number word / punctuation code), the next letter needs a space.
  let lastWasToken = false;

  while (index < resolved.length) {
    const char = resolved[index];
    if (/\d/.test(char)) {
      const start = index;
      while (index < resolved.length && /\d/.test(resolved[index])) index++;
      appendToken(builder, convertNumberToken(resolved.slice(start, index)));
      lastWasToken = true;
    } else if (/[A-Za-z]/.test(char)) {
      if (lastWasToken) appendSpace(builder);
      builder.push(char.toUpperCase());
      lastWasToken = false;
      index++;
    } else if (char === ' ' || char === '\n' || char === '\t') {
      appendSpace(builder);
      lastWasToken = false;
      index++;
    } else {
      const codename = PUNCTUATION_CODENAMES[char];
      if (codename) {
        appendToken(builder, codename);
        lastWasToken = true;
      }
      index++;
    }
  }

  return builder.join('').trimStart();
}

function applyLightPlaintextEdit(text) {
  const trailingWhitespace = text.match(/[ \t\n]*$/)?.[0] ?? '';
  let normalized = resolveUmlauts(text)
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/  +/g, ' ')
    .trimStart();

  if (trailingWhitespace.length === 0) return normalized;
  if (!normalized || normalized.endsWith(' ')) return normalized;
  return `${normalized} `;
}

export function preparePlaintextForEditing(newText, previousText) {
  const isEndBackspace = newText.length < previousText.length && previousText.startsWith(newText);
  return isEndBackspace ? applyLightPlaintextEdit(newText) : normalizeInputForEnigma(newText);
}

export function computePreparedCursor(raw, selectionEnd, previousPrepared, prepared) {
  const isEndBackspace = raw.length < previousPrepared.length && previousPrepared.startsWith(raw);
  const rawPrefix = raw.slice(0, Math.max(0, Math.min(selectionEnd, raw.length)));
  const prefixPrepared = isEndBackspace ? applyLightPlaintextEdit(rawPrefix) : normalizeInputForEnigma(rawPrefix);
  return Math.max(0, Math.min(prefixPrepared.length, prepared.length));
}

export function extractLetters(text) {
  return text.replace(/[^A-Z]/g, '');
}

export function messageCounts(text) {
  return {
    machineLetters: extractLetters(text).length,
    totalCharacters: text.length,
  };
}

export function formatGroupedOutput(text) {
  const letters = text.replace(/[^A-Z]/g, '');
  return letters.match(/.{1,4}/g)?.join(' ') ?? '';
}

const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8' };

export function layoutCode(thinRotor, left, middle, right) {
  const thin = thinRotor === 'Beta' ? 'B' : 'G';
  return thin + (ROMAN[left] ?? '?') + (ROMAN[middle] ?? '?') + (ROMAN[right] ?? '?');
}

export function buildRingCode(ringThin, ringLeft, ringMiddle, ringRight) {
  return `${ringThin}${ringLeft}${ringMiddle}${ringRight}`;
}

export function buildKeyCode(posThin, posLeft, posMiddle, posRight) {
  return `${posThin}${posLeft}${posMiddle}${posRight}`;
}

export function applyRingCode(code) {
  const cleaned = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (cleaned.length !== 4) return null;
  return { thin: cleaned[0], left: cleaned[1], middle: cleaned[2], right: cleaned[3] };
}

export function applyKeyCode(code) {
  const cleaned = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (cleaned.length !== 4) return null;
  return [...cleaned];
}

export function parsePlugboardPairs(plugboard) {
  return plugboard
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter((pair) => pair.length === 2 && /[A-Z]/.test(pair[0]) && /[A-Z]/.test(pair[1]) && pair[0] !== pair[1])
    .slice(0, 13);
}