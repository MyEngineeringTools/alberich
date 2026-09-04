/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W10b Schlüsselgültigkeit layout. node js/tests/w10b-layout-selftest.js
 */
import { readFileSync } from 'node:fs';
import { TIME_PROFILE } from '../alberich-key-time.js';

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
const de = readFileSync(new URL('../i18n/de.js', import.meta.url), 'utf8');
const en = readFileSync(new URL('../i18n/en.js', import.meta.url), 'utf8');

const blockStart = html.indexOf('<fieldset class="codebook-profile"');
const block = html.slice(blockStart, html.indexOf('</fieldset>', blockStart) + 11);
assert(blockStart >= 0, 'profile fieldset present');

assert(block.includes('<fieldset'), 'fieldset wrapper');
assert(block.includes('<legend'), 'native legend');
assert(!block.includes('role="radiogroup"'), 'no redundant radiogroup ARIA');

const radios = [...block.matchAll(/<input type="radio" name="codebookProfile" value="([^"]+)"([^>]*)>/g)];
assert(radios.length === 3, 'three profile radios');
assert(radios[0][1] === 'DAY_24H', 'visual order starts 24h');
assert(radios[1][1] === 'HOURS_4', 'visual order middle 4h');
assert(radios[2][1] === 'HOUR_1', 'visual order ends 1h');
assert(radios[0][1] === TIME_PROFILE.DAY_24H, '24h id unchanged');
assert(radios[1][1] === TIME_PROFILE.HOURS_4, '4h id unchanged');
assert(radios[2][1] === TIME_PROFILE.HOUR_1, '1h id unchanged');
assert(!/\bchecked\b/.test(radios[0][2]), '24h is not default');
assert(/\bchecked\b/.test(radios[1][2]), 'default remains 4 hours');
assert(!/\bchecked\b/.test(radios[2][2]), '1h is not default');

const labels = [...block.matchAll(/<label class="codebook-profile-option">([\s\S]*?)<\/label>/g)];
assert(labels.length === 3, 'three option labels');
for (const [i, label] of labels.entries()) {
  assert(label[1].includes('<input type="radio"'), `radio inside label ${i}`);
  assert(label[1].includes('codebook-profile-title'), `title inside label ${i}`);
  assert(label[1].includes('codebook-profile-hint'), `hint inside label ${i}`);
}

assert(de.includes("'codebook.profile.4h': '4 Stunden'"), 'DE 4h label');
assert(de.includes("'codebook.profile.4hHint': 'Empfohlen'"), 'DE Empfohlen');
assert(en.includes("'codebook.profile.4hHint': 'Recommended'"), 'EN Recommended');

assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'desktop 3 equal cards');
assert(css.includes('grid-template-columns: 1fr'), 'mobile single column');
assert(!/\.codebook-profile-option[\s\S]{0,400}position:\s*absolute/.test(css), 'no absolute option layout');
assert(css.includes('.codebook-profile-option:has(input:checked)'), 'selected state not color-only');
assert(css.includes('.codebook-profile-option:has(input:focus-visible)'), 'focus-visible ring');
assert(css.includes('white-space: nowrap'), 'primary title stays one line');

if (failed) {
  console.error(`\n${failed} W10b layout test(s) failed`);
  process.exit(1);
}
console.log('\nW10b layout selftest passed.');
