import {
  ROTORS,
  REFLECTOR_BRUNO,
  REFLECTOR_CAESAR,
  REFLECTOR_ID_BRUNO,
  REFLECTOR_ID_CAESAR,
  REFLECTOR_ID_DORA,
  DEFAULT_REFLECTOR_D_PAIRS,
  buildDoraReflectorWiring,
} from './cipher-data.js';
import { ENDWALZE_BRUNO, inverseWiring, isPermutationWiring } from './modern-crypto.js';

function createRotorState(id = 'I') {
  return { id, pos: 0, ring: 0, wiring: '', notch: '' };
}

export class CipherEngine {
  constructor() {
    this.rotors = {
      left: createRotorState(),
      middle: createRotorState(),
      right: createRotorState(),
      thin: createRotorState('Beta'),
    };
    this.reflectorWiring = REFLECTOR_BRUNO;
    this.reflectorId = REFLECTOR_ID_BRUNO;
    /** @type {'traditional' | 'modern'} */
    this.cryptoMode = 'traditional';
    /**
     * Modern-Protokoll. Traditional ignoriert das Feld.
     * v2 = bisheriger 3-Walzen-Schritt (linke Kerbe tot).
     * v3 = vierstufige Kaskade, Thin läuft mit.
     * @type {'v2' | 'v3'}
     */
    this.modernProtocol = 'v2';
    /** Endwalze (nur Modern); 26-Zeichen-Permutation */
    this.endwalzeWiring = ENDWALZE_BRUNO;
    this.plugboard = new Map();
  }

  reset() {
    this.rotors = {
      left: createRotorState(),
      middle: createRotorState(),
      right: createRotorState(),
      thin: createRotorState('Beta'),
    };
    this.reflectorWiring = REFLECTOR_BRUNO;
    this.reflectorId = REFLECTOR_ID_BRUNO;
    this.cryptoMode = 'traditional';
    this.modernProtocol = 'v2';
    this.endwalzeWiring = ENDWALZE_BRUNO;
    this.plugboard.clear();
  }

  /**
   * @param {'traditional' | 'modern'} mode
   */
  setCryptoMode(mode) {
    this.cryptoMode = mode === 'modern' ? 'modern' : 'traditional';
  }

  /**
   * @param {'v2' | 'v3' | string} protocol
   */
  setModernProtocol(protocol) {
    this.modernProtocol = protocol === 'v3' ? 'v3' : 'v2';
  }

  /**
   * Thin-Ringstellung. Nur Modern V3 ruft das auf.
   * Traditional und V2 lassen thin.ring = 0 (setRotors).
   * @param {string} letter
   */
  setThinRing(letter) {
    this.rotors.thin.ring = this.letterToPos(letter);
  }

  /**
   * @param {string} wiring 26-letter permutation
   */
  setEndwalze(wiring) {
    if (!isPermutationWiring(wiring)) {
      throw new Error('Invalid endwalze wiring');
    }
    this.endwalzeWiring = wiring;
  }

  setReflector(id) {
    this.reflectorId = id;
    if (id === REFLECTOR_ID_CAESAR) {
      this.reflectorWiring = REFLECTOR_CAESAR;
    } else if (id === REFLECTOR_ID_DORA) {
      this.reflectorWiring = buildDoraReflectorWiring(DEFAULT_REFLECTOR_D_PAIRS);
    } else {
      this.reflectorWiring = REFLECTOR_BRUNO;
    }
  }

  setReflectorD(editablePairs, free = false) {
    this.reflectorId = REFLECTOR_ID_DORA;
    this.reflectorWiring = buildDoraReflectorWiring(editablePairs, free);
  }

  setRotors(rotorLeft, rotorMiddle, rotorRight, rotorThin, posLeft, posMiddle, posRight, posThin, ringLeft, ringMiddle, ringRight) {
    this.applyRotor(this.rotors.left, rotorLeft, posLeft, ringLeft);
    this.applyRotor(this.rotors.middle, rotorMiddle, posMiddle, ringMiddle);
    this.applyRotor(this.rotors.right, rotorRight, posRight, ringRight);

    const thinSpec = ROTORS[rotorThin];
    this.rotors.thin.id = rotorThin;
    this.rotors.thin.pos = this.letterToPos(posThin);
    this.rotors.thin.ring = 0;
    this.rotors.thin.wiring = thinSpec.wiring;
    this.rotors.thin.notch = thinSpec.notch;
  }

  applyRotor(rotor, id, pos, ring) {
    const spec = ROTORS[id];
    rotor.id = id;
    rotor.pos = this.letterToPos(pos);
    rotor.ring = this.letterToPos(ring);
    rotor.wiring = spec.wiring;
    rotor.notch = spec.notch;
  }

  /**
   * Lückenfüller-Kerben (Modern) auf die drei beweglichen Walzen setzen.
   * @param {{ left: string, middle: string, right: string }} notches
   */
  setLueckenfuellerNotches(notches) {
    this.rotors.left.notch = String(notches.left || '');
    this.rotors.middle.notch = String(notches.middle || '');
    this.rotors.right.notch = String(notches.right || '');
  }

  setPlugboard(pairsString) {
    this.plugboard.clear();
    if (!pairsString.trim()) return;

    pairsString
      .toUpperCase()
      .trim()
      .split(/\s+/)
      .forEach((pair) => {
        if (pair.length !== 2) return;
        const a = pair[0];
        const b = pair[1];
        if (a === b || this.plugboard.has(a) || this.plugboard.has(b)) return;
        this.plugboard.set(a, b);
        this.plugboard.set(b, a);
      });
  }

  letterToPos(letter) {
    return letter.toUpperCase().charCodeAt(0) - 65;
  }

  posToLetter(pos) {
    return String.fromCharCode(65 + ((pos % 26) + 26) % 26);
  }

  getPerm(wiring) {
    return Array.from({ length: 26 }, (_, i) => wiring.charCodeAt(i) - 65);
  }

  getReversePerm(wiring) {
    const perm = Array(26);
    for (let i = 0; i < 26; i++) {
      perm[wiring.charCodeAt(i) - 65] = i;
    }
    return perm;
  }

  applyPlugboard(char) {
    return this.plugboard.get(char) ?? char;
  }

  /** Beliebig viele Kerbenbuchstaben (historisch 1–2; Modern-Lückenfüller: typisch 5/7/9). */
  atNotch(rotor) {
    const notch = rotor.notch;
    if (!notch) return false;
    for (let i = 0; i < notch.length; i++) {
      if (rotor.pos === this.letterToPos(notch[i])) return true;
    }
    return false;
  }

  step() {
    if (this.cryptoMode === 'modern' && this.modernProtocol === 'v3') {
      this.stepModernV3();
      return;
    }
    this.stepLegacyThreeRotor();
  }

  /**
   * Historisch / Modern V2: Right immer, Middle bei Right-Kerbe,
   * Left+Middle bei Middle-Kerbe. Left-Kerbe und Thin ungenutzt.
   */
  stepLegacyThreeRotor() {
    const { right, middle, left } = this.rotors;
    let stepMiddle = false;
    let stepLeft = false;

    if (this.atNotch(middle)) {
      stepLeft = true;
      stepMiddle = true;
    }
    if (this.atNotch(right)) stepMiddle = true;

    if (stepLeft) left.pos = (left.pos + 1) % 26;
    if (stepMiddle) middle.pos = (middle.pos + 1) % 26;
    right.pos = (right.pos + 1) % 26;
  }

  /**
   * Modern V3 live (Rev 47+): historical-style double-step, four rotors.
   * Kerben vor der Bewegung. Right immer. Middle-Kerbe → Left+Middle.
   * Left-Kerbe → Thin+Left. Die reine Kaskade bleibt nur Research
   * (nextV3PositionsCascade) — sie bricht Sprüche der veröffentlichten 47.
   */
  stepModernV3() {
    const { right, middle, left, thin } = this.rotors;
    const rightAt = this.atNotch(right);
    const middleAt = this.atNotch(middle);
    const leftAt = this.atNotch(left);

    const stepThin = leftAt;
    const stepLeft = leftAt || middleAt;
    const stepMiddle = middleAt || rightAt;

    if (stepThin) thin.pos = (thin.pos + 1) % 26;
    if (stepLeft) left.pos = (left.pos + 1) % 26;
    if (stepMiddle) middle.pos = (middle.pos + 1) % 26;
    right.pos = (right.pos + 1) % 26;
  }

  encryptLetter(inputChar) {
    if (!/[A-Za-z]/.test(inputChar)) return inputChar;

    if (this.cryptoMode === 'modern') {
      return this.encryptLetterModern(inputChar);
    }
    return this.encryptLetterTraditional(inputChar);
  }

  decryptLetter(inputChar) {
    if (!/[A-Za-z]/.test(inputChar)) return inputChar;
    if (this.cryptoMode !== 'modern') {
      // Involutorisch: Entschlüsseln = Verschlüsseln
      return this.encryptLetterTraditional(inputChar);
    }
    return this.decryptLetterModern(inputChar);
  }

  /**
   * Historisch: Stecker → R→M→L→Thin → UKW → Thin←L←M←R → Stecker
   */
  encryptLetterTraditional(inputChar) {
    let c = inputChar.toUpperCase();
    c = this.applyPlugboard(c);
    this.step();

    let pos = this.letterToPos(c);
    pos = this.rotorForward(this.rotors.right, pos);
    pos = this.rotorForward(this.rotors.middle, pos);
    pos = this.rotorForward(this.rotors.left, pos);
    pos = this.rotorForward(this.rotors.thin, pos);
    pos = this.reflectorForward(pos);
    pos = this.rotorBackward(this.rotors.thin, pos);
    pos = this.rotorBackward(this.rotors.left, pos);
    pos = this.rotorBackward(this.rotors.middle, pos);
    pos = this.rotorBackward(this.rotors.right, pos);

    c = this.posToLetter(pos);
    return this.applyPlugboard(c);
  }

  /**
   * Modern (Verschlüsseln): Stecker → R→M→L→Thin → Endwalze → Stecker
   * (kein Rückweg; nicht involutorisch)
   */
  encryptLetterModern(inputChar) {
    let c = inputChar.toUpperCase();
    c = this.applyPlugboard(c);
    this.step();

    let pos = this.letterToPos(c);
    pos = this.rotorForward(this.rotors.right, pos);
    pos = this.rotorForward(this.rotors.middle, pos);
    pos = this.rotorForward(this.rotors.left, pos);
    pos = this.rotorForward(this.rotors.thin, pos);
    pos = this.endwalzeForward(pos);

    c = this.posToLetter(pos);
    return this.applyPlugboard(c);
  }

  /**
   * Modern (Entschlüsseln): Stecker → Endwalze⁻¹ → Thin←L←M←R → Stecker
   * (invertierter Signalweg; gleiche Schrittfolge wie beim Verschlüsseln)
   */
  decryptLetterModern(inputChar) {
    let c = inputChar.toUpperCase();
    c = this.applyPlugboard(c);
    this.step();

    let pos = this.letterToPos(c);
    pos = this.endwalzeBackward(pos);
    pos = this.rotorBackward(this.rotors.thin, pos);
    pos = this.rotorBackward(this.rotors.left, pos);
    pos = this.rotorBackward(this.rotors.middle, pos);
    pos = this.rotorBackward(this.rotors.right, pos);

    c = this.posToLetter(pos);
    return this.applyPlugboard(c);
  }

  rotorForward(rotor, pos) {
    const shift = ((rotor.pos - rotor.ring) % 26 + 26) % 26;
    const entry = (pos + shift) % 26;
    const mapped = this.getPerm(rotor.wiring)[entry];
    return ((mapped - shift) % 26 + 26) % 26;
  }

  rotorBackward(rotor, pos) {
    const ringOffset = ((rotor.pos - rotor.ring) % 26 + 26) % 26;
    const entry = (pos + ringOffset) % 26;
    const mapped = this.getReversePerm(rotor.wiring)[entry];
    return ((mapped - ringOffset) % 26 + 26) % 26;
  }

  reflectorForward(pos) {
    return this.getPerm(this.reflectorWiring)[pos];
  }

  endwalzeForward(pos) {
    return this.getPerm(this.endwalzeWiring)[pos];
  }

  endwalzeBackward(pos) {
    return this.getReversePerm(this.endwalzeWiring)[pos];
  }

  encryptMessage(text) {
    return [...text].map((char) => (/[A-Za-z]/.test(char) ? this.encryptLetter(char) : char)).join('');
  }

  decryptMessage(text) {
    return [...text].map((char) => (/[A-Za-z]/.test(char) ? this.decryptLetter(char) : char)).join('');
  }

  livePositionCode() {
    return (
      this.posToLetter(this.rotors.thin.pos) +
      this.posToLetter(this.rotors.left.pos) +
      this.posToLetter(this.rotors.middle.pos) +
      this.posToLetter(this.rotors.right.pos)
    );
  }

  /** Hilfsfunktion für Tests: aktuelle Endwalzen-Inverse als String */
  endwalzeInverseWiring() {
    return inverseWiring(this.endwalzeWiring);
  }
}
