export const ROTORS = {
  I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
  VI: { wiring: 'JPGVOUMFYQBENHZRDKASXLICTW', notch: 'ZM' },
  VII: { wiring: 'NZJHGRCXMYSWBOUFAIVLPEKQDT', notch: 'ZM' },
  VIII: { wiring: 'FKQHTLXOCBJSPDZRAMEWNIUYGV', notch: 'ZM' },
  Beta: { wiring: 'LEYJVCNIXWPBQMDRTAKZGFUHOS', notch: '' },
  Gamma: { wiring: 'FSOKANUERHMBTIYCWLQPZXVGJD', notch: '' },
};

export const REFLECTOR_BRUNO = 'ENKQAUYWJICOPBLMDXZVFTHRGS';
export const REFLECTOR_CAESAR = 'RDOBJNTKVEHMLFCWZAXGYIPSUQ';
export const REFLECTOR_ID_BRUNO = 'B';
export const REFLECTOR_ID_CAESAR = 'C';
export const REFLECTOR_ID_DORA = 'D';
export const REFLECTOR_D_FIXED_PAIR = 'BO';
export const DEFAULT_REFLECTOR_D_PAIRS = 'AK CM DF EJ GH IN LP QR ST UV WX YZ';

export const REFLECTOR_OPTIONS = [
  [REFLECTOR_ID_BRUNO, 'Bruno'],
  [REFLECTOR_ID_CAESAR, 'Caesar'],
  [REFLECTOR_ID_DORA, 'Dora'],
];

export const MAIN_ROTOR_IDS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const THIN_ROTOR_IDS = ['Beta', 'Gamma'];

export function reflectorLabel(id) {
  if (id === REFLECTOR_ID_CAESAR) return 'Caesar';
  if (id === REFLECTOR_ID_DORA) return 'Dora';
  return 'Bruno';
}

export function buildReflectorWiring(pairsString) {
  const mapping = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  pairsString
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .forEach((pair) => {
      if (pair.length !== 2) return;
      const a = pair[0];
      const b = pair[1];
      if (a === b || !/[A-Z]/.test(a) || !/[A-Z]/.test(b)) return;
      mapping[a.charCodeAt(0) - 65] = b;
      mapping[b.charCodeAt(0) - 65] = a;
    });
  return mapping.join('');
}

export function normalizeDoraEditablePairs(input) {
  const used = new Set(['B', 'O']);
  return input
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map((pair) => {
      if (pair.length !== 2) return null;
      const a = pair[0];
      const b = pair[1];
      if (!/[A-Z]/.test(a) || !/[A-Z]/.test(b) || a === b) return null;
      if (pair === REFLECTOR_D_FIXED_PAIR || used.has(a) || used.has(b) || pair.includes('B') || pair.includes('O')) {
        return null;
      }
      used.add(a);
      used.add(b);
      return pair;
    })
    .filter(Boolean)
    .slice(0, 12);
}

export function normalizeDoraFreePairs(input) {
  const used = new Set();
  return String(input || '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map((pair) => {
      if (pair.length !== 2) return null;
      const a = pair[0];
      const b = pair[1];
      if (!/[A-Z]/.test(a) || !/[A-Z]/.test(b) || a === b) return null;
      if (used.has(a) || used.has(b)) return null;
      used.add(a);
      used.add(b);
      return a < b ? a + b : b + a;
    })
    .filter(Boolean)
    .sort()
    .slice(0, 13);
}

export function isFreeDoraPairs(input) {
  const pairs = normalizeDoraFreePairs(input);
  return pairs.length === 13 && new Set(pairs.join('')).size === 26;
}

export function formatDoraPairs(editablePairs, free = false) {
  if (free || isFreeDoraPairs(editablePairs)) {
    return normalizeDoraFreePairs(editablePairs).join(' ');
  }
  return [REFLECTOR_D_FIXED_PAIR, ...normalizeDoraEditablePairs(editablePairs)].join(' ');
}

export function buildDoraReflectorWiring(editablePairs, free = false) {
  if (free || isFreeDoraPairs(editablePairs)) {
    return buildReflectorWiring(normalizeDoraFreePairs(editablePairs).join(' '));
  }
  return buildReflectorWiring(formatDoraPairs(editablePairs));
}