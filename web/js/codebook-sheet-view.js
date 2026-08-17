/**
 * Anzeige- und Textform der Monatstafel (Parity codebook.alberich.pro).
 * Arbeitet auf dem Alberich-CodebookSheet (days[]), nicht auf der internen entries-Form.
 */

import {
  REFLECTOR_ID_DORA,
  REFLECTOR_D_FIXED_PAIR,
  isFreeDoraPairs,
  reflectorLabel,
} from './cipher-data.js';
import { sheetUsesFreeDora, sheetUsesPermutationEndwalze } from './endwalze-policy.js';
import { layoutCode } from './text-processing.js';
import { tafelwort } from './codebook-tafelwort.js';

/**
 * @param {string} thin
 */
export function thinShort(thin) {
  return thin === 'Beta' ? 'β' : 'γ';
}

/**
 * @param {import('./codebook.js').CodebookDay} day
 */
export function walzenlage(day) {
  return `${thinShort(day.rotorThin)} ${day.rotorLeft} ${day.rotorMiddle} ${day.rotorRight}`;
}

/**
 * Dora-Spalte: Mix/historisch inkl. festem BO; Nur-Dora ohne vorangestelltes BO.
 * @param {import('./codebook.js').CodebookDay} day
 * @param {{ freeDora?: boolean }} [opts]
 */
export function doraDisplay(day, opts = {}) {
  if (day.reflectorId !== REFLECTOR_ID_DORA) return '';
  const editable = String(day.reflectorD || '').trim();
  const free = opts.freeDora === true || isFreeDoraPairs(editable);
  if (free) return editable;
  return editable ? `${REFLECTOR_D_FIXED_PAIR} ${editable}` : REFLECTOR_D_FIXED_PAIR;
}

/**
 * @param {import('./codebook.js').CodebookDay} day
 * @param {{ freeDora?: boolean }} [opts]
 */
/**
 * @param {{ left?: string, middle?: string, right?: string } | null | undefined} notches
 */
export function notchesDisplay(notches) {
  if (!notches) return '';
  const left = String(notches.left || '');
  const middle = String(notches.middle || '');
  const right = String(notches.right || '');
  if (!left && !middle && !right) return '';
  return `${left} / ${middle} / ${right}`;
}

/**
 * @param {import('./codebook.js').CodebookDay} day
 * @param {{ freeDora?: boolean }} [opts]
 */
export function formatSheetDay(day, opts = {}) {
  const isPermutation = Boolean(day.endwalzeWiring);
  return {
    day: day.day,
    dayLabel: String(day.day).padStart(2, '0'),
    isPermutation,
    reflectorLabel: isPermutation ? '' : reflectorLabel(day.reflectorId),
    endwalzeWiring: day.endwalzeWiring || '',
    notches: notchesDisplay(day.lueckenfueller),
    walzenlage: walzenlage(day),
    lagecode: layoutCode(day.rotorThin, day.rotorLeft, day.rotorMiddle, day.rotorRight),
    ringCode: day.ringCode,
    keyCode: day.keyCode,
    plugboard: day.plugboard || '',
    doraFull: isPermutation ? '' : doraDisplay(day, opts),
    isDora: !isPermutation && day.reflectorId === REFLECTOR_ID_DORA,
  };
}

function pad(s, n) {
  const text = String(s);
  return text.length >= n ? text.slice(0, n) : text + ' '.repeat(n - text.length);
}

/**
 * @param {import('./codebook.js').CodebookSheet} sheet
 * @param {(key: string, params?: Record<string, string | number>) => string} t
 * @param {string} [localeTag]
 */
export function sheetToPlainText(sheet, t, localeTag = 'de-DE') {
  const freeDora = sheetUsesFreeDora(sheet);
  const permutation = sheetUsesPermutationEndwalze(sheet);
  const rows = (sheet.days || []).map((day) => formatSheetDay(day, { freeDora }));
  const when = sheet.generatedAt
    ? new Date(sheet.generatedAt).toLocaleString(localeTag)
    : '—';
  const policyKey = sheet.endwalzePolicy
    ? `codebook.policy.${sheet.endwalzePolicy}`
    : '';
  const word = tafelwort(sheet);
  const lines = [
    t('sheet.export.header'),
    t('sheet.export.month', { month: sheet.monthLabel || '' }),
    ...(word ? [t('sheet.export.tafelwort', { word })] : []),
    t('sheet.export.generated', { when }),
    ...(policyKey ? [t('sheet.export.policy', { policy: t(policyKey) })] : []),
    t('sheet.export.kenngruppen'),
    t('sheet.export.rotorsLine'),
    t('sheet.export.steckerLine'),
    '',
    pad(t('sheet.export.col.day'), 4) +
      pad(t(permutation ? 'sheet.export.col.endwalze' : 'sheet.export.col.ukw'), 8) +
      pad(t('sheet.export.col.walzenlage'), 16) +
      pad(t('sheet.export.col.lage'), 6) +
      pad(t('sheet.export.col.ring'), 6) +
      pad(t('sheet.export.col.grund'), 6) +
      t('sheet.export.col.stecker'),
    '-'.repeat(96),
  ];

  for (const row of rows) {
    lines.push(
      pad(row.dayLabel, 4) +
        pad(row.isPermutation ? t('sheet.export.col.perm') : row.reflectorLabel, 8) +
        pad(row.walzenlage, 16) +
        pad(row.lagecode, 6) +
        pad(row.ringCode, 6) +
        pad(row.keyCode, 6) +
        row.plugboard,
    );
    if (row.doraFull) {
      lines.push(`     ${t('sheet.export.dora', { pairs: row.doraFull })}`);
    }
    const src = (sheet.days || []).find((d) => d.day === row.day);
    if (src?.endwalzeWiring) {
      lines.push(`     ${t('sheet.export.endwalze', { wiring: src.endwalzeWiring })}`);
    }
    if (src?.lueckenfueller) {
      lines.push(
        `     ${t('sheet.export.notches', {
          left: src.lueckenfueller.left,
          middle: src.lueckenfueller.middle,
          right: src.lueckenfueller.right,
        })}`,
      );
    }
  }

  lines.push('');
  lines.push(t('sheet.export.notes'));
  lines.push(t('sheet.export.note1'));
  lines.push(t(freeDora ? 'sheet.export.note2Free' : 'sheet.export.note2'));
  lines.push(t('sheet.export.note3'));
  return lines.join('\n');
}
