#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import {
  ALGORITHM_SOURCE_FILES,
  fingerprintFromContents,
  readAlgorithmSources,
} from './lib.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log('OK  ', msg);
}

const files = readAlgorithmSources();
const base = fingerprintFromContents(files);
assert(/^[0-9a-f]{16}$/.test(base), 'fingerprint shape');
assert(ALGORITHM_SOURCE_FILES.includes('web/js/cipher-data.js'), 'wirings are normative');
assert(ALGORITHM_SOURCE_FILES.includes('web/js/modern-v3.js'), 'V3 is normative');

const wiring = { ...files };
wiring['web/js/cipher-data.js'] = Buffer.concat([
  files['web/js/cipher-data.js'],
  Buffer.from('\n// rotor wiring probe\n'),
]);
assert(fingerprintFromContents(wiring) !== base, 'rotor wiring change moves fingerprint');

const step = { ...files };
step['web/js/modern-v3.js'] = Buffer.from(
  files['web/js/modern-v3.js'].toString('utf8').replace('stepThin', 'stepThinX'),
);
assert(fingerprintFromContents(step) !== base, 'step-logic change moves fingerprint');

const again = fingerprintFromContents(readAlgorithmSources());
assert(again === base, 'README / prose is not part of the fingerprint');

console.log('Fingerprint selftests passed.', base);
