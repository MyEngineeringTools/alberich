/**
 * Selbsttest Tafel-Tag / Not-Aus / Generator (Parity Android).
 * Ausführen: node js/tests/codebook-selftest.js
 */
import { parseCodebookJson, todayOnSheet, sheetDiffersFromCalendar } from '../codebook.js';
import { generateMonthSheet, daysInMonth, monthLabel } from '../codebook-generate.js';
import {
  buildCompressedQrPayload,
  expandSlimQrObject,
  sheetToSlimExportObject,
} from '../codebook-export.js';
import { formatSheetDay, sheetToPlainText } from '../codebook-sheet-view.js';
import {
  crc32Ieee,
  canonicalTafelwortPayload,
  encodeTafelwortLetters,
  formatTafelwort,
  tafelwort,
} from '../codebook-tafelwort.js';
import {
  MAIN_ROTOR_IDS,
  THIN_ROTOR_IDS,
  isFreeDoraPairs,
  formatDoraPairs,
} from '../cipher-data.js';
import {
  ENDWALZE_POLICY,
  defaultEndwalzePolicyForMode,
  pickRandomReflectorId,
  pickReflectorIdForPolicy,
  policyFitsMainMode,
} from '../endwalze-policy.js';
import { MAIN_MODE } from '../operation-mode.js';
import { clearAllNetworkSheets, createNetwork } from '../networks.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

const raw = {
  format: 'alberich-codebook',
  formatVersion: 1,
  year: 2026,
  month: 7,
  monthLabel: 'Juli 2026',
  days: [
    {
      day: 1,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'AAAA',
      keyCode: 'WXYZ',
      plugboard: 'AB CD EF',
    },
    {
      day: 18,
      reflectorId: 'C',
      rotorThin: 'Beta',
      rotorLeft: 'I',
      rotorMiddle: 'II',
      rotorRight: 'III',
      ringCode: 'BBBB',
      keyCode: 'ABCD',
      plugboard: 'AB CD EF',
    },
  ],
};

const parsed = parseCodebookJson(raw);
assert(parsed.ok, 'sample sheet parses');
const sheet = parsed.ok ? parsed.sheet : null;

assert(todayOnSheet(sheet, 2026, 7, 18) === 18, 'today on sheet 18');
assert(todayOnSheet(sheet, 2026, 7, 1) === 1, 'today on sheet 1');
assert(todayOnSheet(sheet, 2026, 7, 11) == null, 'missing day is null');
assert(todayOnSheet(sheet, 2026, 8, 18) == null, 'wrong month is null');
assert(todayOnSheet(sheet, 2025, 7, 18) == null, 'wrong year is null');
assert(sheetDiffersFromCalendar(sheet, 2026, 7) === false, 'same month is no mismatch');
assert(sheetDiffersFromCalendar(sheet, 2026, 8) === true, 'other month is mismatch');
assert(sheetDiffersFromCalendar(sheet, 2025, 7) === true, 'other year is mismatch');
assert(sheetDiffersFromCalendar(null, 2026, 7) === false, 'no sheet is no mismatch');

const a = createNetwork({ name: 'A', sheet, selectedDay: 18 });
const b = createNetwork({ name: 'B', sheet, selectedDay: 1 });
const empty = createNetwork({ name: 'C' });
const wiped = clearAllNetworkSheets([a, b, empty]);
assert(wiped.every((n) => !n.sheet), 'all sheets cleared');
assert(wiped[0].name === 'A', 'network names kept');
assert(wiped[0].selectedDay === 1 && wiped[1].selectedDay === 1, 'days reset');

assert(daysInMonth(2026, 8) === 31, 'days Aug 2026');
assert(daysInMonth(2026, 2) === 28, 'days Feb 2026');
assert(daysInMonth(2024, 2) === 29, 'days Feb 2024');
assert(daysInMonth(2026, 4) === 30, 'days Apr 2026');
assert(monthLabel(2026, 8, 'en') === 'August 2026', 'month label en');
assert(monthLabel(2026, 7, 'de') === 'Juli 2026', 'month label de');

const generated = generateMonthSheet(2026, 8, 'de');
assert(generated.days.length === 31, 'generated August has 31 days');
assert(generated.format === 'alberich-codebook', 'generated format');
assert(generated.formatVersion === 1, 'generated formatVersion mix');
assert(generated.endwalzePolicy === 'mix', 'generated default policy mix');
assert(generated.year === 2026 && generated.month === 8, 'generated year/month');
assert(generated.monthLabel === 'August 2026', 'generated monthLabel de');
assert(generated.days[0].date === '2026-08-01', 'first day date');
assert(generated.days[30].date === '2026-08-31', 'last day date');

const parsedGen = parseCodebookJson(generated);
assert(parsedGen.ok, 'generated sheet parses');
if (parsedGen.ok) {
  assert(parsedGen.sheet.days.length === 31, 'parsed generated day count');
  assert(parsedGen.sheet.days[0].keyCode === generated.days[0].keyCode, 'parsed keyCode');
}

const march = generateMonthSheet(2026, 3, 'en');
for (const d of march.days) {
  assert(['B', 'C', 'D'].includes(d.reflectorId), `reflector ${d.day}`);
  assert(THIN_ROTOR_IDS.includes(d.rotorThin), `thin ${d.day}`);
  const mains = [d.rotorLeft, d.rotorMiddle, d.rotorRight];
  assert(new Set(mains).size === 3, `unique mains ${d.day}`);
  assert(mains.every((id) => MAIN_ROTOR_IDS.includes(id)), `main ids ${d.day}`);
  assert(d.ringCode.length === 4 && /^[A-Z]{4}$/.test(d.ringCode), `ring ${d.day}`);
  assert(d.keyCode.length === 4 && /^[A-Z]{4}$/.test(d.keyCode), `key ${d.day}`);
  const pairs = d.plugboard.split(/\s+/).filter(Boolean);
  assert(pairs.length === 10, `10 plugs ${d.day}`);
  assert(pairs.every((p) => p.length === 2 && p[0] < p[1]), `canonical pairs ${d.day}`);
  assert(new Set(pairs.join('')).size === 20, `20 unique plug letters ${d.day}`);
  if (d.reflectorId === 'D') {
    assert(typeof d.reflectorD === 'string' && d.reflectorD.length > 0, `dora ${d.day}`);
    const dora = d.reflectorD.split(/\s+/).filter(Boolean);
    assert(dora.length === 12, `12 dora pairs ${d.day}`);
    const letters = dora.join('');
    assert(new Set(letters).size === 24, `24 dora letters ${d.day}`);
    assert(!letters.includes('B') && !letters.includes('O'), `no BO in dora ${d.day}`);
  } else {
    assert(d.reflectorD == null, `no dora ${d.day}`);
  }
}

const zero = () => 0;
const detA = generateMonthSheet(2026, 1, 'de', { rng: zero, generatedAt: 't' });
const detB = generateMonthSheet(2026, 1, 'de', { rng: zero, generatedAt: 't' });
assert(
  detA.days.map((d) => d.keyCode).join() === detB.days.map((d) => d.keyCode).join(),
  'deterministic rng stable',
);
assert(detA.days[0].rotorThin === 'Beta', 'zero rng thin = Beta');
assert(detA.days[0].reflectorId === 'B', 'zero rng reflector = B');
assert(detA.days[0].ringCode === 'AAAA', 'zero rng rings = AAAA');

let threw = false;
try {
  generateMonthSheet(1899, 1);
} catch {
  threw = true;
}
assert(threw, 'year out of range throws');

assert(defaultEndwalzePolicyForMode(MAIN_MODE.MODERN) === ENDWALZE_POLICY.PERMUTATION, 'modern default = permutation');
assert(defaultEndwalzePolicyForMode(MAIN_MODE.TRADITIONAL) === ENDWALZE_POLICY.HISTORIC, 'traditional default = historic');
assert(pickRandomReflectorId(MAIN_MODE.MODERN, ['B', 'C', 'D'], (ids) => ids[0]) === 'D', 'modern random only Dora');
assert(pickRandomReflectorId(MAIN_MODE.TRADITIONAL, ['B', 'C', 'D'], (ids) => ids[1]) === 'C', 'traditional random uses pool');
assert(policyFitsMainMode('permutation', MAIN_MODE.MODERN), 'permutation fits modern');
assert(!policyFitsMainMode('dora', MAIN_MODE.MODERN), 'dora does not fit modern');
assert(!policyFitsMainMode('mix', MAIN_MODE.MODERN), 'mix does not fit modern');
assert(policyFitsMainMode('historic', MAIN_MODE.TRADITIONAL), 'historic fits traditional');
assert(!policyFitsMainMode('permutation', MAIN_MODE.TRADITIONAL), 'permutation does not fit traditional');
assert(pickReflectorIdForPolicy('permutation', (ids) => ids[0]) === null, 'permutation has no UKW');
assert(pickReflectorIdForPolicy('dora', (ids) => ids[0]) === 'D', 'dora policy picks Dora');
assert(pickReflectorIdForPolicy('historic', (ids) => ids[1]) === 'C', 'historic policy uses Bruno/Caesar');

const onlyDora = generateMonthSheet(2026, 4, 'de', { endwalzePolicy: 'dora' });
assert(onlyDora.formatVersion === 2, 'dora sheet version 2');
assert(onlyDora.endwalzePolicy === 'dora', 'dora sheet policy');
assert(onlyDora.days.every((d) => d.reflectorId === 'D'), 'dora sheet all Dora');
assert(onlyDora.days.every((d) => isFreeDoraPairs(d.reflectorD)), 'dora sheet 13 free pairs');
const parsedDora = parseCodebookJson(onlyDora);
assert(parsedDora.ok && parsedDora.sheet.endwalzePolicy === 'dora', 'dora sheet parses with policy');

const historic = generateMonthSheet(2026, 5, 'de', { endwalzePolicy: 'historic' });
assert(historic.formatVersion === 1, 'historic sheet version 1');
assert(historic.endwalzePolicy === 'historic', 'historic sheet policy');
assert(historic.days.every((d) => d.reflectorId === 'B' || d.reflectorId === 'C'), 'historic only B/C');
assert(historic.days.every((d) => d.reflectorD == null), 'historic no dora pairs');

const mixForced = generateMonthSheet(2026, 6, 'en', { endwalzePolicy: 'mix' });
assert(mixForced.endwalzePolicy === 'mix', 'explicit mix policy');
const mixDoraDays = mixForced.days.filter((d) => d.reflectorId === 'D');
assert(
  mixDoraDays.every((d) => {
    const pairs = String(d.reflectorD || '').split(/\s+/).filter(Boolean);
    return pairs.length === 12 && !pairs.join('').includes('B') && !pairs.join('').includes('O');
  }),
  'mix Dora keeps fixed BO (12 pairs, no B/O)',
);

assert(!isFreeDoraPairs('AK CM DF EJ GH IN LP QR ST UV WX YZ'), '12 historic pairs are not free');
assert(
  formatDoraPairs('AK CM DF EJ GH IN LP QR ST UV WX YZ').startsWith('BO '),
  'historic format prepends BO',
);

const sampleDay = {
  day: 3,
  reflectorId: 'D',
  rotorThin: 'Beta',
  rotorLeft: 'I',
  rotorMiddle: 'II',
  rotorRight: 'III',
  ringCode: 'ABCD',
  keyCode: 'WXYZ',
  plugboard: 'AB CD EF GH IJ KL MN OP QR ST',
  reflectorD: 'AK CM DF EJ GH IN LP QR ST UV WX YZ',
};
const formatted = formatSheetDay(sampleDay);
assert(formatted.dayLabel === '03', 'day label padded');
assert(formatted.reflectorLabel === 'Dora', 'dora label');
assert(formatted.walzenlage === 'β I II III', 'walzenlage');
assert(formatted.lagecode === 'B123', 'lagecode');
assert(formatted.doraFull.startsWith('BO '), 'dora display includes BO');
assert(formatted.isDora, 'is Dora');
const freePairs = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ';
assert(isFreeDoraPairs(freePairs), '13-pair set is free Dora');
assert(formatSheetDay({ ...sampleDay, reflectorD: freePairs }, { freeDora: true }).doraFull === freePairs, 'free dora display omits BO');
assert(!formatDoraPairs(freePairs, true).startsWith('BO '), 'free formatDoraPairs no BO prefix');

const rejected = parseCodebookJson({
  format: 'alberich-codebook',
  formatVersion: 3,
  year: 2026,
  month: 1,
  days: raw.days,
});
assert(!rejected.ok, 'formatVersion 3 without V3 day fields rejected');

const v3sheet = generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation' });
assert(v3sheet.formatVersion === 3, 'permutation sheet is v3');
assert(parseCodebookJson(v3sheet).ok, 'permutation sheet parses');
const v3slim = sheetToSlimExportObject(v3sheet);
assert(typeof v3slim.days[0] === 'string', 'V3 QR slim uses pipe days');
const v3expanded = expandSlimQrObject(v3slim);
const v3round = parseCodebookJson(v3expanded);
assert(v3round.ok, 'V3 compact QR expands and parses');
assert(v3round.sheet.days.length === v3sheet.days.length, 'V3 compact day count');
assert(v3round.sheet.days[0].endwalzeWiring === v3sheet.days[0].endwalzeWiring, 'V3 compact wiring');
assert(
  v3round.sheet.days[0].lueckenfueller.left === v3sheet.days[0].lueckenfueller.left,
  'V3 compact notches',
);
assert(tafelwort(v3round.sheet) === tafelwort(v3sheet), 'V3 compact tafelwort stable');
const v3qr = buildCompressedQrPayload(v3sheet);
assert(v3qr.payloadBytes <= 2953, `V3 QR payload fits version 40 L (${v3qr.payloadBytes})`);
const v3row = formatSheetDay(v3sheet.days[0]);
assert(v3row.isPermutation, 'V3 day is permutation');
assert(v3row.reflectorLabel === '', 'V3 day has no UKW label');
assert(v3row.endwalzeWiring.length === 26, 'V3 day shows 26-letter endwalze');
assert(v3row.notches.includes('/'), 'V3 day shows notches');
assert(!v3row.isDora && !v3row.doraFull, 'V3 day has empty Dora column');

const tSheet = (key, params = {}) => {
  const map = {
    'sheet.export.header': 'HEADER',
    'sheet.export.month': `Monat: ${params.month}`,
    'sheet.export.tafelwort': `Tafelwort: ${params.word}`,
    'sheet.export.generated': `Erzeugt: ${params.when}`,
    'sheet.export.kenngruppen': 'Kenngruppen',
    'sheet.export.rotorsLine': 'Walzen',
    'sheet.export.steckerLine': 'Stecker',
    'sheet.export.col.day': 'Tag',
    'sheet.export.col.ukw': 'UKW',
    'sheet.export.col.endwalze': 'Endwalze',
    'sheet.export.col.perm': 'PERM',
    'sheet.export.col.walzenlage': 'Walzenlage',
    'sheet.export.col.lage': 'Lage',
    'sheet.export.col.ring': 'Ring',
    'sheet.export.col.grund': 'Grund',
    'sheet.export.col.stecker': 'Stecker',
    'sheet.export.dora': `Dora: ${params.pairs}`,
    'sheet.export.endwalze': `Endwalze: ${params.wiring}`,
    'sheet.export.notches': `Kerben: ${params.left} / ${params.middle} / ${params.right}`,
    'sheet.export.policy': `Endwalze: ${params.policy}`,
    'codebook.policy.dora': 'Nur Dora',
    'sheet.export.notes': 'Hinweise:',
    'sheet.export.note1': 'n1',
    'sheet.export.note2': 'n2',
    'sheet.export.note2Free': 'n2free',
    'sheet.export.note3': 'n3',
  };
  return map[key] ?? key;
};
const plainSheet = {
  monthLabel: 'März 2026',
  generatedAt: '2026-03-01T00:00:00.000Z',
  days: [sampleDay],
};
const plain = sheetToPlainText(plainSheet, tSheet, 'en-GB');
assert(plain.includes('HEADER'), 'plaintext header');
assert(plain.includes('März 2026'), 'plaintext month');
assert(plain.includes(`Tafelwort: ${tafelwort(plainSheet)}`), 'plaintext Tafelwort');
assert(plain.includes('03'), 'plaintext day');
assert(plain.includes('B123'), 'plaintext lagecode');
assert(plain.includes('Dora: BO '), 'plaintext dora');
const v3plain = sheetToPlainText(v3sheet, tSheet, 'de-DE');
assert(v3plain.includes('PERM'), 'V3 plaintext has PERM, not Bruno');
assert(!v3plain.includes('Bruno'), 'V3 plaintext does not invent Bruno');
assert(v3plain.includes('Endwalze:'), 'V3 plaintext lists endwalze wiring');
assert(v3plain.includes('Kerben:'), 'V3 plaintext lists notches');

const crcKnown = crc32Ieee(new TextEncoder().encode('123456789'));
assert(crcKnown === 0xcbf43926, 'IEEE CRC-32 vector 123456789');
assert(encodeTafelwortLetters(0) === 'AAAAAAA', 'base-26 zero is AAAAAAA');
assert(formatTafelwort('CXRIYQP') === 'CXRI YQP', 'format 4+3');
assert(tafelwort(null) === '', 'no sheet → empty Tafelwort');

const twSample = tafelwort(sheet);
assert(twSample === 'CXRI YQP', 'golden Tafelwort sample July 2026');
assert(tafelwort(sheet) === twSample, 'Tafelwort stable on same sheet');
assert(
  canonicalTafelwortPayload(sheet) ===
    'ALBTW1\n1\n2026\n7\n\n1|C|Beta|I|II|III|AAAA|WXYZ|AB CD EF|\n18|C|Beta|I|II|III|BBBB|ABCD|AB CD EF|\n',
  'canonical payload ignores labels and has empty policy',
);
assert(
  tafelwort({ ...sheet, monthLabel: 'July 2026', generatedAt: '2099-01-01T00:00:00.000Z' }) === twSample,
  'monthLabel/generatedAt do not change Tafelwort',
);

const ringChanged = {
  ...sheet,
  days: sheet.days.map((d) => (d.day === 18 ? { ...d, ringCode: 'CCCC' } : d)),
};
assert(tafelwort(ringChanged) !== twSample, 'other day ringCode changes Tafelwort');
assert(
  tafelwort({ ...sheet, endwalzePolicy: 'historic' }) !== twSample,
  'endwalzePolicy changes Tafelwort',
);

{
  const v3day = {
    day: 1,
    date: '2026-08-01',
    rotorThin: 'Beta',
    rotorLeft: 'I',
    rotorMiddle: 'II',
    rotorRight: 'III',
    ringCode: 'ABCD',
    keyCode: 'WXYZ',
    plugboard: 'AB CD EF GH IJ KL MN OP QR ST',
    endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
    lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
  };
  const base = {
    format: 'alberich-codebook',
    formatVersion: 3,
    endwalzePolicy: 'permutation',
    year: 2026,
    month: 8,
    days: [v3day],
  };
  assert(parseCodebookJson(base).ok, 'strict V3 standard day parses');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, ringCode: 'A-B-C-D' }] }).ok, 'hyphen rings rejected');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, keyCode: 'A.B.C.D' }] }).ok, 'dotted ground rejected');
  assert(parseCodebookJson({ ...base, days: [{ ...v3day, day: 31, date: undefined }] }).ok, '31 Aug accepted');
  assert(!parseCodebookJson({ ...base, year: 2026, month: 2, days: [{ ...v3day, day: 31, date: undefined }] }).ok, '31 Feb rejected');
  assert(!parseCodebookJson({ ...base, days: [v3day, { ...v3day }] }).ok, 'duplicate day rejected');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, plugboard: 'AB AC CD EF GH IJ KL MN OP QR' }] }).ok, 'shared plug letter rejected');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, plugboard: 'AA CD EF GH IJ KL MN OP QR ST' }] }).ok, 'self plug rejected');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, plugboard: 'AB CD EF' }] }).ok, 'too few plugs rejected');
  assert(!parseCodebookJson({ ...base, endwalzePolicy: 'historic' }).ok, 'historic policy rejected on V3');
  assert(!parseCodebookJson({ ...base, endwalzePolicy: undefined }).ok, 'missing V3 policy rejected');
  assert(!parseCodebookJson({ ...base, networkContext: 'Mein Netz!!' }).ok, 'network punctuation not repaired');
  assert(parseCodebookJson({ ...base, networkContext: 'ALB' }).ok, 'strict network ALB ok');
  assert(!parseCodebookJson({ ...base, days: [{ ...v3day, date: '2026-07-01' }] }).ok, 'date/month mismatch rejected');
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll codebook selftests passed.');
