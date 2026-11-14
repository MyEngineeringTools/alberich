/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Zusatzwalze: sichtbare Ringstellung ist die Quelle für Engine und Prüfgruppe.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { CipherEngine } from '../cipher-engine.js';
import { modernV3EncryptPayload } from '../modern-v3.js';
import { dayEntryToSettingsPatch } from '../codebook.js';
import {
  manualRingUpdate,
  reconcileStoredRings,
  resolveRingParts,
} from '../text-processing.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const PLAIN = 'WERXLIESTXMITXNURXWERXDENXSCHLUESSELXHAT';
const KNOWN_EFKQ = 'IQZPWNFZAYNEAKDNGJNMHYEBXCBDBSJSLKKPZMJO';
const PLUGS = 'AQ BM CT DX EK FW GO HU IZ LP';

function encryptTraditional(ringCode, staleThin) {
  const rings = resolveRingParts({
    ringCode,
    ringThin: staleThin,
    ringLeft: 'A',
    ringMiddle: 'A',
    ringRight: 'A',
  });
  const engine = new CipherEngine();
  engine.setReflector('B');
  engine.setCryptoMode('traditional');
  engine.setRotors(
    'II', 'VII', 'V', 'Beta',
    'E', 'B', 'L', 'N',
    rings.left, rings.middle, rings.right, rings.thin,
  );
  engine.setThinRing(rings.thin);
  engine.setPlugboard(PLUGS);
  return engine.encryptMessage(PLAIN);
}

function encryptForcedThin(ringThin) {
  const engine = new CipherEngine();
  engine.setReflector('B');
  engine.setCryptoMode('traditional');
  engine.setRotors('II', 'VII', 'V', 'Beta', 'E', 'B', 'L', 'N', 'F', 'K', 'Q', ringThin);
  engine.setThinRing(ringThin);
  engine.setPlugboard(PLUGS);
  return engine.encryptMessage(PLAIN);
}

{
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const handler = app.slice(app.indexOf("getElementById('ringCode')"), app.indexOf("getElementById('keyCodeInput')"));
  assert(handler.includes('ringThin: update.ringThin'), 'ringCode handler writes ringThin');
  assert(handler.includes('manualRingUpdate'), 'ringCode handler uses the shared update');
}

{
  const fresh = manualRingUpdate('ZYKQ');
  assert(fresh.complete && fresh.ringThin === 'Z' && fresh.ringCode === 'ZYKQ', 'manual ZYKQ sets ringThin Z');
  const partial = manualRingUpdate('zy');
  assert(!partial.complete && partial.ringCode === 'ZY', 'partial ring keeps raw text');
}

{
  const stored = reconcileStoredRings({
    ringCode: 'ZYKQ',
    ringThin: 'E',
    ringLeft: 'A',
    ringMiddle: 'A',
    ringRight: 'A',
  });
  assert(stored.ringThin === 'Z', 'migration: visible ringCode wins over stored E');
  assert(stored.ringLeft === 'Y' && stored.ringCode === 'ZYKQ', 'migration rewrites the other ring letters from the code');
}

{
  assert(encryptTraditional('EFKQ', 'Z') === KNOWN_EFKQ, 'EFKQ ignores a contradictory stored thin ring');
  assert(encryptForcedThin('E') === KNOWN_EFKQ, 'reference vector UKW B, Beta, II VII V, EFKQ, NEBL');
  const withZ = encryptTraditional('ZFKQ', 'E');
  assert(withZ !== KNOWN_EFKQ, 'first ring letter Z changes the ciphertext');
  assert(withZ === encryptForcedThin('Z'), 'stale E does not override a typed Z');
  const back = new CipherEngine();
  back.setReflector('B');
  back.setCryptoMode('traditional');
  back.setRotors('II', 'VII', 'V', 'Beta', 'E', 'B', 'L', 'N', 'F', 'K', 'Q', 'Z');
  back.setThinRing('Z');
  back.setPlugboard(PLUGS);
  assert(back.encryptMessage(withZ) === PLAIN, 'ZFKQ roundtrip');
}

{
  const py = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, "reference")
from alberich_reference import Machine, REFLECTORS
plain = "${PLAIN}"
def enc(ring):
    m = Machine(); m.mode = "traditional"; m.reflector = REFLECTORS["B"]
    m.set_rotors("II","VII","V","Beta","E","B","L","N","F","K","Q", ring)
    m.set_plugboard("${PLUGS}")
    return m.encrypt_message(plain)
print(enc("E"))
print(enc("Z"))
`], { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' });
  assert(py.status === 0, `python reference failed: ${py.stderr}`);
  const [pyE, pyZ] = py.stdout.trim().split('\n');
  assert(pyE === KNOWN_EFKQ, 'independent reference matches EFKQ');
  assert(pyZ === encryptTraditional('ZFKQ', 'E'), 'independent reference matches ZFKQ');
}

{
  const sheet = dayEntryToSettingsPatch({
    reflectorId: 'B',
    rotorThin: 'Beta',
    rotorLeft: 'II',
    rotorMiddle: 'VII',
    rotorRight: 'V',
    ringCode: 'ZFKQ',
    keyCode: 'NEBL',
    plugboard: PLUGS,
  });
  assert(sheet.ringThin === 'Z', 'codebook import sets ringThin from the sheet');
  assert(
    encryptTraditional(sheet.ringCode, 'E') === encryptForcedThin(sheet.ringThin),
    'manual entry and sheet import encrypt alike',
  );
}

const day = {
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'ZPEL',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  notches: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  networkContext: 'ALB',
  epoch: '2026-08-16',
};

function configureModern(engine, key, ringThin) {
  const p = [...key];
  const rings = resolveRingParts({
    ringCode: day.ringCode,
    ringThin,
    ringLeft: 'P',
    ringMiddle: 'E',
    ringRight: 'L',
  });
  engine.setCryptoMode('modern');
  engine.setModernProtocol('v3');
  engine.setRotors(
    'V', 'VI', 'VIII', 'Beta',
    p[1], p[2], p[3], p[0],
    rings.left, rings.middle, rings.right, rings.thin,
  );
  engine.setThinRing(rings.thin);
  engine.setPlugboard(day.plugboard);
  engine.setEndwalze(day.endwalzeWiring);
  engine.setLueckenfuellerNotches(day.notches);
  return true;
}

const manualEngine = new CipherEngine();
const fromManual = await modernV3EncryptPayload({
  engine: manualEngine,
  configure: (code) => configureModern(manualEngine, code, 'E'),
  groundKey: 'CDSZ',
  plainText: 'Hello',
  messageKey: 'LDNQ',
  messageId: 'TESTMSGX',
  dayConfig: day,
});
assert(fromManual.ok, `manual modern encrypt failed: ${fromManual.error}`);

const sheetEngine = new CipherEngine();
const fromSheet = await modernV3EncryptPayload({
  engine: sheetEngine,
  configure: (code) => configureModern(sheetEngine, code, 'Z'),
  groundKey: 'CDSZ',
  plainText: 'Hello',
  messageKey: 'LDNQ',
  messageId: 'TESTMSGX',
  dayConfig: day,
});
assert(fromSheet.ok, 'sheet modern encrypt failed');
assert(fromManual.cipher === fromSheet.cipher, 'manual stale E and sheet import produce the same Modern ciphertext');
assert(fromManual.pruefgruppe === fromSheet.pruefgruppe, 'Prüfgruppe follows the ring the engine uses');

const staleEngine = new CipherEngine();
const stale = await modernV3EncryptPayload({
  engine: staleEngine,
  configure: (code) => {
    const p = [...code];
    staleEngine.setCryptoMode('modern');
    staleEngine.setModernProtocol('v3');
    staleEngine.setRotors('V', 'VI', 'VIII', 'Beta', p[1], p[2], p[3], p[0], 'P', 'E', 'L', 'E');
    staleEngine.setThinRing('E');
    staleEngine.setPlugboard(day.plugboard);
    staleEngine.setEndwalze(day.endwalzeWiring);
    staleEngine.setLueckenfuellerNotches(day.notches);
    return true;
  },
  groundKey: 'CDSZ',
  plainText: 'Hello',
  messageKey: 'LDNQ',
  messageId: 'TESTMSGX',
  dayConfig: { ...day, ringCode: 'EPEL' },
});
assert(stale.ok, 'stale-E modern encrypt failed');
assert(stale.cipher !== fromManual.cipher, 'a real E on the extra rotor is a different message');

console.log('ring-thin-selftest passed');
