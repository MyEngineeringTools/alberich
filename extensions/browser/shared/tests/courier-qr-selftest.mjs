/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Selbsttest Kurier-QR (Parity Web / Android).
 * Ausführen: node shared/tests/courier-qr-selftest.mjs
 */
import { utf8ToBase26 } from '../crypto/modern-crypto.js';
import {
  COURIER_QR_PREFIX,
  MAX_CIPHER_LETTERS,
  MAX_BASE26_BODY,
  MAX_UTF8_BYTES,
  MAX_QR_ALPHANUMERIC,
  cipherLettersFromPlain,
  courierFit,
  buildCourierPayload,
  parseCourierPayload,
  payloadFits,
  isCourierScanTarget,
  canShowCourierQr,
  lettersFromInput,
  formatGroupedOutput,
} from '../courier-qr.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

assert(COURIER_QR_PREFIX === 'ALBERICH-CTQR1-', 'prefix');
assert(COURIER_QR_PREFIX.length === 15, 'prefix length 15');
assert(MAX_CIPHER_LETTERS === 955, 'max cipher 955');
assert(MAX_BASE26_BODY === 951, 'max body 951');
assert(MAX_UTF8_BYTES === 475, 'max utf8 475');

const ascii = 'A'.repeat(475);
assert(utf8ToBase26(ascii).length === 950, '475 ASCII → 950 base26');
assert(cipherLettersFromPlain(ascii) === 954, '475 ASCII → 954 cipher');
assert(courierFit(cipherLettersFromPlain(ascii)) === 'approaching', 'at capacity approaching');
assert(courierFit(cipherLettersFromPlain(`${ascii}X`)) === 'over', '476 ASCII over');

const threshold = Math.floor((MAX_CIPHER_LETTERS * 4) / 5);
assert(courierFit(threshold) === 'ok', '80% still ok');
assert(courierFit(threshold + 1) === 'approaching', 'over 80% approaching');

const payload = buildCourierPayload('JESX CCLD JHLX');
assert(payload === 'ALBERICH-CTQR1-JESXCCLDJHLX', 'build strips groups');
assert(parseCourierPayload(payload) === 'JESXCCLDJHLX', 'parse payload');
assert(parseCourierPayload('alberich-ctqr1|jesx ccld') === 'JESXCCLD', 'parse alt separator');
assert(parseCourierPayload('ALBERICH-CBQR1|gzip|xx') == null, 'reject codebook');
assert(isCourierScanTarget(payload), 'scan target');
assert(!isCourierScanTarget('HELLO'), 'bare letters not scan target');
assert(canShowCourierQr('JESX CCLD'), 'can show grouped');
assert(!canShowCourierQr(''), 'empty cannot show');
assert(formatGroupedOutput('JESXCCLDJHLX') === 'JESX CCLD JHLX', 'group 4');

const limitPayload = buildCourierPayload('A'.repeat(MAX_CIPHER_LETTERS));
assert(limitPayload.length === MAX_QR_ALPHANUMERIC, 'limit payload length');
assert(payloadFits(limitPayload), 'limit fits');
assert(!payloadFits(`${limitPayload}B`), 'over does not fit');
assert(lettersFromInput('ALBERICH-CTQR1-JESX CCLD') === 'JESXCCLD', 'letters from payload');
assert(lettersFromInput('jesx ccld') === 'JESXCCLD', 'letters from bare');
assert(lettersFromInput('ALBERICH-CBQR1|gzip|xx') === '', 'codebook yields empty');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll courier-qr selftests passed.');
