#!/usr/bin/env node
/**
 * Effektiver Schlüsselraum — Nur-Dora (aktueller Modern-Ist) und V3 (falls geladen).
 * Exakte BigInt-Kombinatorik. Keine Security-Bits-Werbung.
 */

import { factorial, binomial, bitsOf, writeJson, wantsSmoke } from './lib.mjs';

if (wantsSmoke()) {
  console.log('smoke ok keyspace');
  process.exit(0);
}

const FACT_26 = factorial(26);

/** k disjunkte ungeordnete Paare aus 26 Buchstaben, Rest ungepaart. */
function pairings(k) {
  return FACT_26 / (2n ** BigInt(k) * factorial(k) * factorial(26 - 2 * k));
}

function report(name, value, note) {
  return {
    name,
    count: value.toString(),
    bits: Number(bitsOf(value).toFixed(6)),
    note,
  };
}

const rotorChoice = 2n * (8n * 7n * 6n);
const plug10 = pairings(10);
const dora13 = pairings(13);
const ringsStored = 26n ** 4n;
const ringsEffectiveV2 = 26n ** 3n;
const grundstellung = 26n ** 4n;
const affineFixed = 1n;
const lueckenfuellerIndependentV2 = 1n;

const nominalV2 = rotorChoice * plug10 * dora13 * ringsStored * grundstellung * affineFixed;
const effectiveV2 =
  rotorChoice * plug10 * dora13 * ringsEffectiveV2 * grundstellung * lueckenfuellerIndependentV2;

const notchChoicesPerRotor = binomial(26, 5) + binomial(26, 7) + binomial(26, 9);
const notchesV3 = notchChoicesPerRotor ** 3n;
const endwalzeV3 = FACT_26;
const ringsEffectiveV3 = 26n ** 4n;
const nominalV3 = rotorChoice * plug10 * endwalzeV3 * ringsEffectiveV3 * grundstellung * notchesV3;

const out = {
  generatedAt: new Date().toISOString(),
  disclaimer: {
    nominal: 'Reine Kombinatorik, ohne Dead/Equivalent Keys.',
    effective: 'Nach bekannten Dead Fields (Ist: ringThin tot, Lückenfüller abgeleitet).',
    observedAttack: 'Nicht in dieser Datei — siehe Research-Skripte.',
    securityProof: 'none',
    notClaimed: [
      'AES-128-Äquivalenz',
      'AES-192-Äquivalenz',
      'NIST-Sicherheit',
      'mathematisch bewiesene Sicherheit',
    ],
  },
  identities: {
    doubleFactorialOdd: {
      formula: '25!! = 26! / (2^13 · 13!)',
      value: dora13.toString(),
      bits: Number(bitsOf(dora13).toFixed(6)),
    },
    plugboard10: {
      formula: '26! / (2^10 · 10! · 6!)',
      value: plug10.toString(),
      bits: Number(bitsOf(plug10).toFixed(6)),
    },
    fact26: {
      formula: '26!',
      value: FACT_26.toString(),
      bits: Number(bitsOf(FACT_26).toFixed(6)),
    },
  },
  currentModernDoraOnly: {
    components: [
      report('rotorChoice', rotorChoice, '2 Thin × P(8,3)'),
      report('plugboard10', plug10, '10 disjunkte Paare; nicht 26!'),
      report('dora13', dora13, '13 freie Paare = 25!!. Affine Komposition addiert 0 Bit.'),
      report('ringsStored', ringsStored, 'ringCode hat 4 Buchstaben inkl. ringThin'),
      report('ringsEffective', ringsEffectiveV2, 'thin.ring wird in setRotors auf 0 gesetzt (Dead Key)'),
      report('grundstellung', grundstellung, 'vier Walzenpositionen'),
      report('lueckenfuellerIndependent', lueckenfuellerIndependentV2, 'Kerben deterministisch aus Ringen+Steckern'),
      report('affineMix', affineFixed, 'ENDWALZE_DORA_MIX ist fest'),
    ],
    nominalKeyspace: report('nominalV2', nominalV2, 'inkl. tot gespeichertem ringThin'),
    effectiveKeyspace: report('effectiveV2', effectiveV2, 'ringThin entfernt, Lückenfüller nicht extra'),
    findings: [
      'ringThin wird erzeugt und in ringCode gespeichert, aber CipherEngine.setRotors setzt thin.ring = 0.',
      'Linke Lückenfüller-Kerbe wird berechnet, CipherEngine.step() liest nur middle und right.',
      'Lückenfüller nicht als unabhängigen Schlüsselraum zählen.',
      'Freie Dora ist eine Involution, danach fest mit ENDWALZE_DORA_MIX komponiert — keine 26!-Endwalze.',
    ],
  },
  modernV3Design: {
    components: [
      report('rotorChoice', rotorChoice, 'unverändert 2 Thin × P(8,3)'),
      report('plugboard10', plug10, 'unverändert'),
      report('endwalzeFullPerm', endwalzeV3, 'echte 26!-Permutation; Involutionen werden beim Würfeln verworfen (Anteil vernachlässigbar)'),
      report('ringsEffective', ringsEffectiveV3, 'Thin-Ringstellung ist lebendig'),
      report('grundstellung', grundstellung, 'vier Positionen; Thin läuft mit'),
      report(
        'lueckenfuellerIndependent',
        notchesV3,
        'je Walze L/M/R eine Kombination aus C(26,5)+C(26,7)+C(26,9); Thin hat keine Kerben (treibt nichts)',
      ),
    ],
    notchChoicesPerRotor: notchChoicesPerRotor.toString(),
    nominalKeyspace: report('nominalV3', nominalV3, 'nach V3-Design; Equivalent Keys separat messen'),
    note: 'V3-Zahlen sind Design-Kombinatorik, keine beobachtete Angriffskomplexität.',
  },
};

writeJson('keyspace.json', out);

const fmt = (row) => `  ${row.name.padEnd(28)} ${row.bits.toFixed(2).padStart(8)} bit   ${row.count}`;

console.log('=== Alberich keyspace (exact BigInt) ===\n');
console.log('Current Modern, Nur-Dora:');
for (const row of out.currentModernDoraOnly.components) console.log(fmt(row));
console.log(fmt(out.currentModernDoraOnly.nominalKeyspace));
console.log(fmt(out.currentModernDoraOnly.effectiveKeyspace));
console.log('\nFindings:');
for (const f of out.currentModernDoraOnly.findings) console.log(`  - ${f}`);
console.log('\nModern V3 design (combinatorics only):');
for (const row of out.modernV3Design.components) console.log(fmt(row));
console.log(fmt(out.modernV3Design.nominalKeyspace));
console.log('\nSecurity proof: none');
console.log(`wrote ${RESULTS_DIR_REL()}`);

function RESULTS_DIR_REL() {
  return 'research/results/keyspace.json';
}
