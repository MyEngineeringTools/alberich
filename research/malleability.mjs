#!/usr/bin/env node
/**
 * Offensive Malleability-/Integritätsmessung.
 * Der Round-Trip-Check ist kein MAC.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import { modernDecryptPayload, modernEncryptPayload, utf8ToBase26 } from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson, isValidUtf8RoundTrip } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok malleability'); process.exit(0); }

const PLAIN = 'Alberich-Malleability-Probe-42-XXXXYYYYZZZZ';

function configure(key) {
  return configureSyntheticV2(engine, key, SYNTHETIC_V2);
}

const engine = new CipherEngine();
const enc = modernEncryptPayload({
  engine,
  configure,
  groundKey: SYNTHETIC_V2.ground,
  plainText: PLAIN,
  messageKey: 'LDNQ',
});
if (!enc.ok) throw new Error(enc.error);

const header = enc.header;
const body = enc.body;
const expectedAcceptedHint = {
  bodyLetters: body.length,
  mutations: body.length * 25,
  knownAccepted: 1240,
  knownTotal: 2200,
  knownRate: 1240 / 2200,
};

let accepted = 0;
let rejected = 0;
let validUtf8 = 0;
let plaintextChanged = 0;
const changePositions = [];

for (let i = 0; i < body.length; i++) {
  const orig = body[i];
  for (let d = 1; d <= 25; d++) {
    const repl = String.fromCharCode(65 + ((orig.charCodeAt(0) - 65 + d) % 26));
    const mutant = header + body.slice(0, i) + repl + body.slice(i + 1);
    const dec = modernDecryptPayload({
      engine,
      configure,
      groundKey: SYNTHETIC_V2.ground,
      cipherLetters: mutant,
    });
    if (!dec.ok) {
      rejected += 1;
      continue;
    }
    accepted += 1;
    if (isValidUtf8RoundTrip(dec.plainText)) validUtf8 += 1;
    if (dec.plainText !== PLAIN) {
      plaintextChanged += 1;
      if (changePositions.length < 20) changePositions.push({ bodyIndex: i, to: repl });
    }
  }
}

const total = accepted + rejected;
const out = {
  generatedAt: new Date().toISOString(),
  plaintext: PLAIN,
  base26Length: utf8ToBase26(PLAIN).length,
  header,
  bodyLength: body.length,
  totalMutations: total,
  accepted,
  rejected,
  acceptedRate: Number((accepted / total).toFixed(4)),
  validUtf8AmongAccepted: validUtf8,
  plaintextChangedAmongAccepted: plaintextChanged,
  sampleChangePositions: changePositions,
  comparisonToKnownFinding: {
    ...expectedAcceptedHint,
    thisRunAccepted: accepted,
    thisRunTotal: total,
    matchesBallpark:
      Math.abs(accepted / total - expectedAcceptedHint.knownRate) < 0.08
      || (expectedAcceptedHint.knownTotal === total && Math.abs(accepted - expectedAcceptedHint.knownAccepted) < 80),
  },
  finding:
    'Der Round-Trip-Check ist kein MAC und kein Authentizitätsnachweis. Ein großer Anteil einzelner Body-Buchstabenmutationen wird akzeptiert und liefert anderen Klartext.',
};

writeJson('malleability.json', out);
console.log(`mutations=${total} accepted=${accepted} (${(100 * accepted / total).toFixed(1)}%) rejected=${rejected}`);
console.log(out.finding);
