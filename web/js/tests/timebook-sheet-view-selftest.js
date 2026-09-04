/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * W10a hardened codebook display. node js/tests/timebook-sheet-view-selftest.js
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TIME_PROFILE, getSlotForTimestamp } from '../alberich-key-time.js';
import { generateTimebook } from '../timebook-generate.js';
import { resolveTimebookSlot } from '../timebook.js';
import {
  TIMEBOOK_DISPLAY_FIELDS,
  timebookDayOutline,
  timebookKeyDisplayRows,
  timebookKeyPlainText,
  slotSummaryText,
} from '../timebook-sheet-view.js';
import { notchMaskFromLetters, lettersFromNotchMask } from '../full-key-binary.js';
import { formatSheetDay, sheetToPlainText } from '../codebook-sheet-view.js';
import { generateMonthSheet } from '../codebook-generate.js';

const LEGACY_SHEET_VIEW_SHA256 =
  'b05d1a1f97ac902877bb696cf2c4a194e7b487d877830befa7cc82580158efcf';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

function lcg(seed) {
  let s = seed >>> 0;
  return (max) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

function textHasLegacySheetTerms(text) {
  return /ukw|dora/i.test(String(text || ''));
}

function t(key, params) {
  const labels = {
    'timebook.field.rotorThin': 'Griechenwalze',
    'timebook.field.rotorLeft': 'Bewegliche Walze links',
    'timebook.field.rotorMiddle': 'Bewegliche Walze Mitte',
    'timebook.field.rotorRight': 'Bewegliche Walze rechts',
    'timebook.field.ringCode': 'Ringstellung',
    'timebook.field.keyCode': 'Grundstellung',
    'timebook.field.plugboard': 'Steckerbrett',
    'timebook.field.endwalze': 'Endwalze',
    'timebook.field.notchLeft': `Lückenfüller links (${params?.count ?? ''})`,
    'timebook.field.notchMiddle': `Lückenfüller Mitte (${params?.count ?? ''})`,
    'timebook.field.notchRight': `Lückenfüller rechts (${params?.count ?? ''})`,
    'codebook.slotCurrent': 'Aktuell',
    'sheet.export.header': 'Alberich Schlüsseltafel',
    'sheet.export.month': `Monat {month}`,
    'sheet.export.tafelwort': 'Tafelwort {word}',
    'sheet.export.generated': 'Erzeugt {when}',
    'sheet.export.policy': 'Endwalze {policy}',
    'sheet.export.kenngruppen': '',
    'sheet.export.rotorsLine': 'Walzen: I–VIII · Griechenwalzen: Beta/Gamma · UKW: Bruno, Caesar, Dora',
    'sheet.export.steckerLine': '',
    'sheet.export.col.day': 'Tag',
    'sheet.export.col.ukw': 'UKW',
    'sheet.export.col.endwalze': 'Endwalze',
    'sheet.export.col.walzenlage': 'Walzenlage',
    'sheet.export.col.lage': 'Lage',
    'sheet.export.col.ring': 'Ring',
    'sheet.export.col.grund': 'Grund',
    'sheet.export.col.stecker': 'Stecker',
    'sheet.export.col.perm': 'PERM',
    'sheet.export.dora': 'Dora {pairs}',
    'sheet.export.endwalze': 'Endwalze: {wiring}',
    'sheet.export.notches': '{left} / {middle} / {right}',
    'sheet.export.notes': '',
    'sheet.export.note1': '',
    'sheet.export.note2': '• Bei UKW Dora: Paare eintragen',
    'sheet.export.note2Free': '',
    'sheet.export.note3': '',
    'codebook.policy.historic': 'Nur Bruno/Caesar',
  };
  let text = labels[key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_, name) => (
      params[name] != null ? String(params[name]) : `{${name}}`
    ));
  }
  return text;
}

const viewSrc = readFileSync(new URL('../timebook-sheet-view.js', import.meta.url), 'utf8');
const i18nDe = readFileSync(new URL('../i18n/de.js', import.meta.url), 'utf8');
const i18nEn = readFileSync(new URL('../i18n/en.js', import.meta.url), 'utf8');
const legacySrc = readFileSync(new URL('../codebook-sheet-view.js', import.meta.url));
const legacyHash = createHash('sha256').update(legacySrc).digest('hex');
assert(legacyHash === LEGACY_SHEET_VIEW_SHA256, 'legacy codebook-sheet-view.js unchanged');

assert(!/feste dünne/i.test(i18nDe), 'DE i18n has no feste dünne');
assert(/'timebook.field.rotorThin': 'Griechenwalze'/.test(i18nDe), 'DE codebook label is Griechenwalze');
assert(!/Fixed thin rotor/.test(i18nEn), 'EN codebook label is not Fixed thin rotor');
assert(!/ukw/i.test(viewSrc), 'hardened view module source has no UKW');
assert(!/dora/i.test(viewSrc), 'hardened view module source has no Dora');

const fieldKeys = [
  'timebook.field.rotorThin',
  'timebook.field.rotorLeft',
  'timebook.field.rotorMiddle',
  'timebook.field.rotorRight',
  'timebook.field.ringCode',
  'timebook.field.keyCode',
  'timebook.field.plugboard',
  'timebook.field.endwalze',
  'timebook.field.notchLeft',
  'timebook.field.notchMiddle',
  'timebook.field.notchRight',
  'timebook.daySummary',
  'codebook.slotCurrent',
];
for (const key of fieldKeys) {
  const deBlock = i18nDe.split(`'${key}':`)[1]?.slice(0, 200) || '';
  const enBlock = i18nEn.split(`'${key}':`)[1]?.slice(0, 200) || '';
  assert(Boolean(deBlock), `DE has ${key}`);
  assert(Boolean(enBlock), `EN has ${key}`);
  assert(!/ukw/i.test(deBlock) && !/ukw/i.test(enBlock), `${key} labels have no UKW`);
}

const { timebook: book4 } = await generateTimebook(2026, 8, TIME_PROFILE.HOURS_4, { rng: lcg(4) });
const { timebook: book24 } = await generateTimebook(2026, 1, TIME_PROFILE.DAY_24H, { rng: lcg(2) });
const { timebook: book1 } = await generateTimebook(2026, 8, TIME_PROFILE.HOUR_1, { rng: lcg(6) });

const noon = Date.UTC(2026, 7, 3, 11, 0, 0);
const current4 = resolveTimebookSlot(book4, noon);
assert(current4.ok && current4.meta.slotIndex === 3, '4h current slot 12–16');

const outline4 = timebookDayOutline(book4, current4);
assert(outline4.days.length === 31, '4h August 31 days');
assert(outline4.days.every((d) => d.slotCount === 6), '4h 6 slots/day in outline');
assert(outline4.days[2].slots[3].current, '4h 03. slot 12–16 marked current');
assert(outline4.days[2].slots.filter((s) => s.current).length === 1, 'exactly one current slot');
const outlineBlob = JSON.stringify(outline4);
assert(!outlineBlob.includes('endwalzeWiring'), 'outline does not embed full keys');
assert(!outlineBlob.includes(book4.days[0].slots[0].key.endwalzeWiring), 'outline has no stored end rotor');

const outline24 = timebookDayOutline(book24, resolveTimebookSlot(book24, Date.UTC(2026, 0, 15, 12, 0, 0)));
assert(outline24.days[0].slotCount === 1, '24h one slot/day');
assert(outline24.days.length === 31, '24h January 31 days');

const outline1 = timebookDayOutline(book1, resolveTimebookSlot(book1, noon));
assert(outline1.days[0].slotCount === 24, '1h 24 slots/day');
assert(outline1.days.length === 31, '1h August 31 days');
assert(outline1.days.reduce((n, d) => n + d.slotCount, 0) === 744, '1h 744 slot headers');
assert(!JSON.stringify(outline1).includes(book1.days[0].slots[0].key.endwalzeWiring), '1h outline has no keys');

const key = current4.key;
const rows = timebookKeyDisplayRows(key);
assert(rows.map((r) => r.id).join(',') === TIMEBOOK_DISPLAY_FIELDS.join(','), 'all FULL_KEY_BIN_V1 fields present');
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
assert(byId.rotorThin.value === key.rotorThin, 'thin rotor stored as-is');
assert(byId.rotorLeft.value === key.rotorLeft, 'left rotor stored as-is');
assert(byId.rotorMiddle.value === key.rotorMiddle, 'middle rotor stored as-is');
assert(byId.rotorRight.value === key.rotorRight, 'right rotor stored as-is');
assert(byId.ringCode.value === key.ringCode, 'rings stored as-is');
assert(byId.keyCode.value === key.keyCode, 'ground stored as-is');
assert(byId.plugboard.value === key.plugboard, 'plugboard stored as-is');
assert(byId.endwalzeWiring.value === key.endwalzeWiring, 'end rotor equals 26 stored letters');
assert(byId.endwalzeWiring.value.length === 26, 'end rotor length 26');
assert(byId.notchLeft.value === key.lueckenfueller.left, 'left notches stored as-is');
assert(byId.notchMiddle.value === key.lueckenfueller.middle, 'middle notches stored as-is');
assert(byId.notchRight.value === key.lueckenfueller.right, 'right notches stored as-is');
assert(byId.notchLeft.count === key.lueckenfueller.left.length, 'left notch count is stored length');
assert(byId.notchMiddle.count === key.lueckenfueller.middle.length, 'middle notch count is stored length');
assert(byId.notchRight.count === key.lueckenfueller.right.length, 'right notch count is stored length');

for (const side of ['left', 'middle', 'right']) {
  const storedLetters = key.lueckenfueller[side];
  const mask = notchMaskFromLetters(storedLetters);
  const fromMask = lettersFromNotchMask(mask);
  const rowId = side === 'left' ? 'notchLeft' : side === 'middle' ? 'notchMiddle' : 'notchRight';
  assert(fromMask === storedLetters, `${side} stored letters match bitmask roundtrip`);
  assert(byId[rowId].value === fromMask, `${side} displayed notches match bitmask letters`);
}

const plain = timebookKeyPlainText(key, t);
assert(!textHasLegacySheetTerms(plain), 'hardened detail text has no UKW/Dora');
assert(plain.includes(key.endwalzeWiring), 'detail text contains stored end rotor');
assert(plain.includes('Aktuell') === false, 'detail text is the key, not the current marker');
assert(plain.includes(`Endwalze: ${key.endwalzeWiring}`), 'end rotor labelled Endwalze');

const currentLabel = slotSummaryText(outline4.days[2].slots[3].hours, true, t('codebook.slotCurrent'));
assert(currentLabel.includes('Aktuell'), 'current slot uses text Aktuell');
assert(currentLabel.includes('\u2013') || currentLabel.includes('12'), 'current slot keeps hours');
const otherLabel = slotSummaryText(outline4.days[2].slots[0].hours, false, t('codebook.slotCurrent'));
assert(!otherLabel.includes('Aktuell'), 'non-current slot has no Aktuell');

const historic = await generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'historic', rng: lcg(9) });
const doraDay = historic.days.find((d) => d.reflectorId === 'D') || historic.days[0];
const row = formatSheetDay(doraDay, { freeDora: false });
assert('reflectorLabel' in row && 'doraFull' in row, 'legacy formatSheetDay still has UKW/Dora fields');
const legacyText = sheetToPlainText(historic, t, 'de-DE');
assert(/UKW/.test(legacyText), 'legacy plain text still mentions UKW');

if (failed) {
  console.error(`\n${failed} W10a view test(s) failed`);
  process.exit(1);
}
console.log('\nW10a timebook sheet view selftest passed.');
