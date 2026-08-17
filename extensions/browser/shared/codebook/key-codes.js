/**
 * Minimale Schlüssel-/Ring-Helfer (aus alberich-web text-processing).
 */

const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8' };

export function layoutCode(thinRotor, left, middle, right) {
  const thin = thinRotor === 'Beta' ? 'B' : 'G';
  return thin + (ROMAN[left] ?? '?') + (ROMAN[middle] ?? '?') + (ROMAN[right] ?? '?');
}

export function applyRingCode(code) {
  const cleaned = String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  if (cleaned.length !== 4) return null;
  return { thin: cleaned[0], left: cleaned[1], middle: cleaned[2], right: cleaned[3] };
}

export function applyKeyCode(code) {
  const cleaned = String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  if (cleaned.length !== 4) return null;
  return [...cleaned];
}

export function parsePlugboardPairs(plugboard) {
  return String(plugboard ?? '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(
      (pair) =>
        pair.length === 2 &&
        /[A-Z]/.test(pair[0]) &&
        /[A-Z]/.test(pair[1]) &&
        pair[0] !== pair[1],
    )
    .slice(0, 13);
}

export function countPlugPairs(plugboard) {
  return parsePlugboardPairs(plugboard).length;
}

export function formatGroupedOutput(text) {
  const letters = String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return letters.match(/.{1,4}/g)?.join(' ') ?? '';
}

export function extractLetters(text) {
  return String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}
