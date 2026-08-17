#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Live V3 Prüfgruppe: no mutated authenticated telegram may yield plaintext.
 */
import { CipherEngine } from '../web/js/cipher-engine.js';
import {
  modernV3EncryptPayload,
  modernV3DecryptPayload,
  parseV3Telegram,
} from '../web/js/modern-v3.js';
import {
  SYNTHETIC_V3,
  configureSyntheticV3,
  writeJson,
  wantsSmoke,
  stampLiveV3,
} from './lib.mjs';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLAIN = 'Alberich-V3-Malleability';

async function encrypt(plain, extra = {}) {
  const engine = new CipherEngine();
  const enc = await modernV3EncryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: SYNTHETIC_V3.groundKey,
    plainText: plain,
    messageKey: extra.messageKey || 'LDNQ',
    messageId: extra.messageId || 'TESTMSGX',
    dayConfig: { ...SYNTHETIC_V3, ...extra.day },
  });
  if (!enc.ok) throw new Error(enc.error);
  return enc;
}

async function decrypt(cipher, extra = {}) {
  const engine = new CipherEngine();
  return modernV3DecryptPayload({
    engine,
    configure: (key) => configureSyntheticV3(engine, key),
    groundKey: extra.groundKey || SYNTHETIC_V3.groundKey,
    cipherLetters: cipher,
    dayConfig: { ...SYNTHETIC_V3, ...extra.day },
  });
}

function spliceLetters(letters, start, end, repl) {
  return letters.slice(0, start) + repl + letters.slice(end);
}

async function tryDecrypt(label, cipher) {
  const dec = await decrypt(cipher);
  const leaked = !!(dec.ok && dec.plainText);
  return {
    label,
    accepted: !!dec.ok,
    error: dec.ok ? null : dec.error,
    leakedPlaintext: leaked,
  };
}

if (wantsSmoke()) {
  const enc = await encrypt(PLAIN);
  const parsed = parseV3Telegram(enc.cipher);
  const mutant = parsed.letters.slice(0, -1) + (parsed.pruef.slice(-1) === 'A' ? 'B' : 'A');
  const dec = await decrypt(mutant);
  if (dec.ok) throw new Error('PRUEF mutation was accepted — P0');
  console.log(`smoke ok malleability rejected=${dec.error}`);
  process.exit(0);
}

const enc = await encrypt(PLAIN);
const other = await encrypt('other message', { messageKey: 'WXYZ', messageId: 'OTHERMID' });
const p = parseV3Telegram(enc.cipher);
if (!p.ok) throw new Error(p.error);
const q = parseV3Telegram(other.cipher);

const trials = [];

// Single-letter mutations on each region.
const regions = [
  ['version', 0, 4],
  ['header', 4, 8],
  ['mid', 8, 16],
  ['body', 16, p.letters.length - 20],
  ['pruef', p.letters.length - 20, p.letters.length],
];

for (const [name, start, end] of regions) {
  const span = Math.max(0, end - start);
  const positions = span <= 4 ? [...Array(span).keys()] : [0, Math.floor(span / 2), span - 1];
  for (const off of positions) {
    const i = start + off;
    const orig = p.letters[i];
    for (let d = 1; d <= 25; d++) {
      const repl = AZ[(orig.charCodeAt(0) - 65 + d) % 26];
      trials.push(await tryDecrypt(`${name}[${off}]->${repl}`, spliceLetters(p.letters, i, i + 1, repl)));
    }
  }
}

// Structural mutations
trials.push(await tryDecrypt('delete-last', p.letters.slice(0, -1)));
trials.push(await tryDecrypt('insert-A', `${p.letters}A`));
trials.push(await tryDecrypt('swap-header-mid', p.stamp + p.messageId.slice(0, 4) + p.header + p.messageId.slice(4) + p.body + p.pruef));
trials.push(await tryDecrypt('body-from-other', p.stamp + p.header + p.messageId + q.body + p.pruef));
trials.push(await tryDecrypt('mid-from-other', p.stamp + p.header + q.messageId + p.body + p.pruef));
trials.push(await tryDecrypt('pruef-from-other', p.stamp + p.header + p.messageId + p.body + q.pruef));

const wrongEpoch = await decrypt(enc.cipher, { day: { epoch: '2020-01-01' } });
trials.push({
  label: 'epoch-field-on-sheet',
  accepted: !!wrongEpoch.ok,
  error: wrongEpoch.ok ? null : wrongEpoch.error,
  leakedPlaintext: !!(wrongEpoch.ok && wrongEpoch.plainText),
});

const wrongNet = await decrypt(enc.cipher, { day: { networkContext: 'ZZZ' } });
trials.push({
  label: 'network-field-on-sheet',
  accepted: !!wrongNet.ok,
  error: wrongNet.ok ? null : wrongNet.error,
  leakedPlaintext: !!(wrongNet.ok && wrongNet.plainText),
});

const leaked = trials.filter((t) => t.leakedPlaintext);
const accepted = trials.filter((t) => t.accepted);

const out = {
  ...stampLiveV3({ script: 'research/malleability.mjs' }),
  plaintext: PLAIN,
  telegramLen: p.letters.length,
  trials: trials.length,
  accepted: accepted.length,
  leakedPlaintext: leaked.length,
  byLabel: Object.fromEntries(
    [...new Set(trials.map((t) => t.label.split('[')[0].split('-')[0]))].map((k) => {
      const rows = trials.filter((t) => t.label.startsWith(k));
      return [k, { n: rows.length, accepted: rows.filter((r) => r.accepted).length }];
    }),
  ),
  sampleRejections: trials.filter((t) => !t.accepted).slice(0, 8).map((t) => ({ label: t.label, error: t.error })),
  finding:
    leaked.length === 0
      ? 'No manipulated authenticated telegram released plaintext. MAC-first holds on the tested mutations.'
      : 'P0: a mutated telegram released plaintext.',
  p0: leaked.length > 0,
};

if (out.p0) {
  writeJson('malleability.json', out);
  throw new Error(`P0 malleability leak: ${leaked.map((t) => t.label).join(', ')}`);
}

writeJson('malleability.json', out);
console.log(`trials=${out.trials} accepted=${out.accepted} leaked=${out.leakedPlaintext}`);
console.log(out.finding);
