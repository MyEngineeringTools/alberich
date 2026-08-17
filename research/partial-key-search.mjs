#!/usr/bin/env node
/**
 * Partial-Key und Meet-in-the-Middle-Sondierung der Struktur
 * Plugboard → Rotors → Endwalze → Plugboard
 */

import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  inverseWiring,
  resolveEndwalzeWiring,
  modernEncryptPayload,
} from '../web/js/modern-crypto.js';
import { SYNTHETIC_V2, configureSyntheticV2, writeJson } from './lib.mjs';
import { wantsSmoke as __wantsSmoke } from './lib.mjs';
if (__wantsSmoke()) { console.log('smoke ok partial-key-search'); process.exit(0); }

function letterPermAtState(engine, ch) {
  // one modern encrypt letter without changing API — clone via encryptLetter
  return engine.encryptLetter(ch);
}

const findings = [];

{
  findings.push({
    name: 'plugboard-conjugation',
    result:
      'Stecker ist eine Involution π. Modern-Encrypt ist π ∘ E ∘ π, wobei E der Rotor+Endwalzenweg nach dem Schritt ist. Das ist eine Konjugation nur wenn E involutorisch wäre. E ist nicht involutorisch, daher π∘E∘π ≠ Konjugation einer Involution. Trotzdem: bekanntes π reduziert den Suchraum auf E.',
  });
}

{
  findings.push({
    name: 'header-separated-from-body',
    result:
      'Der Spruchschlüssel-Header wird unter der Grundstellung verschlüsselt. Der Körper startet danach bei der Spruchschlüssel-Lage. Ein Angreifer kann Header und Body getrennt behandeln. Der Header ist nur 4 Buchstaben.',
  });
}

{
  const engine = new CipherEngine();
  configureSyntheticV2(engine, SYNTHETIC_V2.ground);
  const end = engine.endwalzeWiring;
  const inv = inverseWiring(end);
  findings.push({
    name: 'endwalze-separable',
    endIsPermutation: end.length === 26,
    inverseOfInverse: inverseWiring(inv) === end,
    result:
      'Bei bekanntem Rotorweg (Walzen+Ringe+Lagen) ist die Endwalze die unbekannte 26er-Permutation zwischen Thin-Ausgang und Stecker-Rückweg. Mit genug Klartextpaaren nach Entfernen von Stecker und Rotoren ist sie direkt ablesbar. Das ist Meet-in-the-Middle gegen die nominelle Kombination Plug×Endwalze.',
  });
}

{
  const engine = new CipherEngine();
  const enc = modernEncryptPayload({
    engine,
    configure: (key) => configureSyntheticV2(engine, key),
    groundKey: SYNTHETIC_V2.ground,
    plainText: 'MITM',
    messageKey: 'LDNQ',
  });
  findings.push({
    name: 'demonstrated-decomposition',
    headerLen: enc.header.length,
    bodyLen: enc.body.length,
    result:
      'Implementierte Zerlegung: (1) Header unter Grundstellung, (2) Body unter SK. Keine vollständige MITM-Suche über 26! in diesem Lauf — der Suchraum der Endwalze bleibt kombinatorisch groß, wird aber bei bekanntem Rotorweg zu einer Tabelle.',
  });
}

const out = {
  generatedAt: new Date().toISOString(),
  findings,
  reducedClaim:
    'Der nominelle kombinierte Schlüsselraum ist nicht die Angriffskomplexität. Header, Stecker-Konjugation und bekannter Rotorweg zerlegen ihn. Das wird nicht versteckt.',
};

writeJson('partial-key-search.json', out);
console.log(out.reducedClaim);
for (const f of findings) console.log(`- ${f.name}: ${f.result.slice(0, 160)}…`);
