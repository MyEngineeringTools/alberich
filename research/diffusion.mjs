#!/usr/bin/env node
/**
 * Offene Diffusionsmessung. Eine Rotorchiffre ist kein Blockcipher.
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  modernEncryptPayload,
  deriveLueckenfuellerNotches,
  resolveEndwalzeWiring,
} from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok diffusion'); process.exit(0); }

const PLAIN = 'AAAAAAAABBBBBBBBCCCCCCCC';

function encryptV2(plain, overrides = {}) {
  const cfg = { ...SYNTHETIC_V2, ...overrides };
  const engine = new CipherEngine();
  const enc = modernEncryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key, cfg),
    groundKey: cfg.ground,
    plainText: plain,
    messageKey: overrides.messageKey || 'LDNQ',
  });
  if (!enc.ok) throw new Error(enc.error);
  return enc;
}

function changedPositions(a, b) {
  const n = Math.max(a.length, b.length);
  const idx = [];
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) idx.push(i);
  }
  return {
    count: idx.length,
    first: idx[0] ?? null,
    last: idx[idx.length - 1] ?? null,
    positions: idx,
    prefixEqual: idx[0] ?? a.length,
    suffixEqualFromEnd: a.length - 1 - (idx[idx.length - 1] ?? -1),
  };
}

const base = encryptV2(PLAIN);
const cases = [];

{
  const mutated = `B${PLAIN.slice(1)}`;
  const other = encryptV2(mutated);
  cases.push({
    name: 'plaintext-first-letter',
    ...changedPositions(base.cipher, other.cipher),
    note: 'Nur der betroffene Body-Teil plus alles danach durch den weiterlaufenden Walzenstand. Kein Block-Avalanche.',
  });
}

{
  const mutated = `${PLAIN.slice(0, 8)}X${PLAIN.slice(9)}`;
  const other = encryptV2(mutated);
  cases.push({
    name: 'plaintext-mid-letter',
    ...changedPositions(base.cipher, other.cipher),
  });
}

{
  const other = encryptV2(PLAIN, { messageKey: 'LDNR' });
  cases.push({
    name: 'message-key-last-letter',
    ...changedPositions(base.cipher, other.cipher),
  });
}

{
  const other = encryptV2(PLAIN, { rings: ['P', 'E', 'M'] });
  cases.push({
    name: 'ring-right-plus-one',
    ...changedPositions(base.cipher, other.cipher),
  });
}

{
  const other = encryptV2(PLAIN, { plug: 'AF BF CM DQ HU JN LX PR SZ VW' });
  cases.push({
    name: 'plug-AE-to-AF',
    ...changedPositions(base.cipher, other.cipher),
  });
}

{
  const engine = new CipherEngine();
  const wiringA = resolveEndwalzeWiring('C');
  const wiringB = `${wiringA[1]}${wiringA[0]}${wiringA.slice(2)}`;
  function encWith(wiring) {
    const e = new CipherEngine();
    const r = modernEncryptPayload({
      engine: e,
      configure: (key) => {
        configureSyntheticV2(e, key);
        e.setEndwalze(wiring);
        return true;
      },
      groundKey: 'CDSZ',
      plainText: PLAIN,
      messageKey: 'LDNQ',
    });
    return r.cipher;
  }
  cases.push({
    name: 'endwalze-swap-first-two',
    ...changedPositions(encWith(wiringA), encWith(wiringB)),
  });
}

{
  const n0 = deriveLueckenfuellerNotches('P', 'E', 'L', SYNTHETIC_V2.plug);
  const tweaked = {
    ...n0.notches,
    right: n0.notches.right.replace(n0.notches.right[0], n0.notches.right[0] === 'A' ? 'B' : 'A'),
  };
  function encNotch(notches) {
    const e = new CipherEngine();
    const r = modernEncryptPayload({
      engine: e,
      configure: (key) => {
        configureSyntheticV2(e, key);
        e.setLueckenfuellerNotches(notches);
        return true;
      },
      groundKey: 'CDSZ',
      plainText: PLAIN,
      messageKey: 'LDNQ',
    });
    return r.cipher;
  }
  cases.push({
    name: 'right-notch-letter-tweak',
    ...changedPositions(encNotch(n0.notches), encNotch(tweaked)),
  });
}

const out = {
  generatedAt: new Date().toISOString(),
  statement:
    'Eine Änderung des Plaintexts beeinflusst aufgrund der zustandsunabhängigen Schrittfolge nicht automatisch den gesamten folgenden Ciphertext. Es gibt keinen Avalanche Effect im Sinne eines Blockciphers.',
  steppingIsPlaintextIndependent: true,
  cases,
};

writeJson('diffusion.json', out);
console.log(out.statement);
for (const c of cases) {
  console.log(`${c.name}: ${c.count} positions changed, first=${c.first}, last=${c.last}`);
}
