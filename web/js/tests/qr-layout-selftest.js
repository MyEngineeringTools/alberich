/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Share vs scan QR layout. node js/tests/qr-layout-selftest.js
 */
import { readFileSync } from 'node:fs';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const versions = readFileSync(new URL('../../VERSIONS', import.meta.url), 'utf8');

assert(/web\.revision=65\b/.test(versions), 'product revision stays 65');
assert(app.includes("const VERSION = '1.0 (Revision 65)'"), 'app VERSION stays 65');

const shareStart = html.indexOf('id="qrShareModal"');
const share = html.slice(shareStart, html.indexOf('id="toast"', shareStart));
assert(share.includes('class="qr-preview-wrap"'), 'share wrap present');
assert(share.includes('id="qrShareImg"'), 'share img present');
assert(share.includes('id="qrShareCanvas"'), 'share canvas present');
assert(share.includes('id="qrSharePaused"'), 'pause overlay present');
assert(!/grid-template-columns/.test(share), 'share HTML has no grid columns');

const scanStart = html.indexOf('id="qrScanModal"');
const scan = html.slice(scanStart, html.indexOf('id="qrShareModal"', scanStart));
assert(scan.includes('class="qr-scan-viewport"'), 'scan viewport present');
assert(scan.includes('id="qrScanVideo"'), 'scan video present');
assert(!scan.includes('qr-preview-wrap'), 'scan does not reuse share wrap');

assert(css.includes('.qr-preview-wrap > [hidden]'), 'hidden children of share wrap are display:none');
assert(css.includes('justify-content: center'), 'share wrap centers');
assert(css.includes('width: fit-content'), 'share panel shrinks to QR');
assert(!/\.qr-preview-wrap[\s\S]{0,200}grid-template-columns/.test(css), 'share wrap is not a column grid');
assert(css.includes('.qr-scan-viewport video') && css.includes('position: absolute'), 'scan video cannot inflate viewport');
assert(/\.qr-scan-viewport \{[\s\S]{0,220}aspect-ratio: 1 \/ 1/.test(css), 'scan viewport is square');

assert(!app.includes("CBQR2_MUR_PROFILE_V1.maxFragmentLen ="), 'product does not rebind MUR fragment size');
assert(app.includes('liveShareSender.attach(els.qrShareCanvas)'), 'live share still uses share canvas');

if (failed) {
  console.error(`\n${failed} QR layout test(s) failed`);
  process.exit(1);
}
console.log('\nQR layout selftest passed.');
