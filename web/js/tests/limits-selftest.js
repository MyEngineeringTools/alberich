/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { LIMITS, rejectIfTooLong } from '../limits.js';
import {
  parseV3Telegram,
  utf8ToBase26v2,
  base26v2ToUtf8,
  validateNetworkContext,
  modernV3EncryptPayload,
  modernV3DecryptPayload,
} from '../modern-v3.js';
import { parseCodebookJson } from '../codebook.js';
import { CipherEngine } from '../cipher-engine.js';
import { SYNTHETIC_V3, configureSyntheticV3 } from '../../../research/lib.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log('OK  ', msg);
}

assert(rejectIfTooLong('a'.repeat(LIMITS.MAX_PLAINTEXT_CHARS), LIMITS.MAX_PLAINTEXT_CHARS).ok, 'plaintext max accepted');
assert(!rejectIfTooLong('a'.repeat(LIMITS.MAX_PLAINTEXT_CHARS + 1), LIMITS.MAX_PLAINTEXT_CHARS).ok, 'plaintext max+1 rejected');

assert(parseV3Telegram('A'.repeat(LIMITS.MAX_CIPHER_LETTERS)).error !== 'limits.cipher', 'cipher max not limit-rejected');
assert(parseV3Telegram('A'.repeat(LIMITS.MAX_CIPHER_LETTERS + 1)).error === 'limits.cipher', 'cipher max+1 rejected');

const maxNet = 'A'.repeat(LIMITS.MAX_NETWORK_CONTEXT);
assert(validateNetworkContext(maxNet).ok, 'network 16 accepted');
assert(!validateNetworkContext(`${maxNet}X`).ok, 'network 17 rejected');
assert(validateNetworkContext(`${maxNet}X`).error === 'modern.networkContextTooLong', 'network no truncation');

assert(base26v2ToUtf8('A'.repeat(LIMITS.MAX_BASE26_LETTERS + 1)).error === 'limits.base26', 'base26 decode max+1');

let threw = false;
try {
  utf8ToBase26v2('A'.repeat(LIMITS.MAX_PLAINTEXT_CHARS + 1));
} catch (err) {
  threw = err.message === 'limits.plaintext';
}
assert(threw, 'base26 encode plaintext max+1 throws');

const hugeJson = `{"pad":"${'A'.repeat(LIMITS.MAX_CODEBOOK_JSON_BYTES + 10)}"}`;
assert(parseCodebookJson(hugeJson).error === 'limits.codebookJson', 'codebook JSON max+1');

const engine = new CipherEngine();
const enc = await modernV3EncryptPayload({
  engine,
  configure: (key) => configureSyntheticV3(engine, key),
  groundKey: SYNTHETIC_V3.groundKey,
  plainText: 'ok',
  messageKey: 'LDNQ',
  messageId: 'LIMITMID',
  dayConfig: { ...SYNTHETIC_V3, networkContext: 'ABCDEFGHIJKLMNOPQ' },
});
assert(!enc.ok && enc.error === 'modern.networkContextTooLong', 'encrypt rejects long network');

const tooLong = await modernV3EncryptPayload({
  engine,
  configure: (key) => configureSyntheticV3(engine, key),
  groundKey: SYNTHETIC_V3.groundKey,
  plainText: 'A'.repeat(LIMITS.MAX_PLAINTEXT_CHARS + 1),
  messageKey: 'LDNQ',
  messageId: 'LIMITMID',
  dayConfig: SYNTHETIC_V3,
});
assert(!tooLong.ok && tooLong.error === 'limits.plaintext', 'encrypt rejects huge plaintext');

const okEnc = await modernV3EncryptPayload({
  engine,
  configure: (key) => configureSyntheticV3(engine, key),
  groundKey: SYNTHETIC_V3.groundKey,
  plainText: 'Hello',
  messageKey: 'LDNQ',
  messageId: 'LIMITMID',
  dayConfig: SYNTHETIC_V3,
});
assert(okEnc.ok, 'encrypt small plaintext');
const badDec = await modernV3DecryptPayload({
  engine: new CipherEngine(),
  configure: (key) => configureSyntheticV3(engine, key),
  groundKey: SYNTHETIC_V3.groundKey,
  cipherLetters: 'A'.repeat(LIMITS.MAX_CIPHER_LETTERS + 1),
  dayConfig: SYNTHETIC_V3,
});
assert(!badDec.ok && badDec.error === 'limits.cipher', 'decrypt rejects huge cipher');

console.log('All limits selftests passed.');
