/**
 * Monatstafel + gewählter Tag → Tagesschlüssel-Konfiguration.
 * Storage-Backend ist austauschbar (chrome.storage / memory für Tests).
 */

import {
  defaultCodebookDay,
  dayEntryToSettingsPatch,
  findCodebookDay,
  parseCodebookJson,
} from './codebook/codebook.js';
import { tafelwort } from './codebook/codebook-tafelwort.js';
import { countPlugPairs, layoutCode } from './codebook/key-codes.js';
import {
  REFLECTOR_ID_DORA,
  formatDoraPairs,
  reflectorLabel,
} from './crypto/cipher-data.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'alberichCompanion.v1';

/**
 * @typedef {import('./codebook/codebook.js').CodebookSheet} CodebookSheet
 */

/**
 * @typedef {object} CompanionState
 * @property {CodebookSheet|null} sheet
 * @property {number|null} selectedDay
 */

/**
 * @param {{ get: Function, set: Function }} storage  chrome.storage.local-like
 */
export function createKeyManager(storage) {
  /** @type {CompanionState} */
  let cache = { sheet: null, selectedDay: null };

  async function load() {
    const data = await storage.get(STORAGE_KEY);
    const raw = data?.[STORAGE_KEY] ?? data;
    if (!raw || typeof raw !== 'object') {
      cache = { sheet: null, selectedDay: null };
      return cache;
    }
    const sheet = raw.sheet ?? null;
    let selectedDay = Number(raw.selectedDay) || null;
    if (sheet?.days?.length) {
      if (!selectedDay || !findCodebookDay(sheet, selectedDay)) {
        selectedDay = defaultCodebookDay(sheet);
      }
    } else {
      selectedDay = null;
    }
    cache = { sheet, selectedDay };
    return cache;
  }

  async function save() {
    await storage.set({
      [STORAGE_KEY]: {
        sheet: cache.sheet,
        selectedDay: cache.selectedDay,
      },
    });
  }

  /**
   * @param {string|object} rawJson
   */
  async function importSheet(rawJson) {
    const parsed = parseCodebookJson(rawJson);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    cache.sheet = parsed.sheet;
    cache.selectedDay = defaultCodebookDay(parsed.sheet);
    await save();
    return { ok: true, sheet: cache.sheet, selectedDay: cache.selectedDay };
  }

  async function clearSheet() {
    cache = { sheet: null, selectedDay: null };
    await save();
  }

  /**
   * @param {number} day
   */
  async function setDay(day) {
    if (!cache.sheet) return { ok: false, error: 'modern.noKey' };
    const d = Number(day);
    if (!findCodebookDay(cache.sheet, d)) {
      return { ok: false, error: 'codebook.err.badDay' };
    }
    cache.selectedDay = d;
    await save();
    return { ok: true, selectedDay: d };
  }

  function getState() {
    return { sheet: cache.sheet, selectedDay: cache.selectedDay };
  }

  /**
   * @returns {import('./modern-ops.js').DayMachineConfig|null}
   */
  function getDayConfig() {
    if (!cache.sheet || !cache.selectedDay) return null;
    const entry = findCodebookDay(cache.sheet, cache.selectedDay);
    if (!entry) return null;
    return dayEntryToSettingsPatch(entry);
  }

  /**
   * Kurzbeschreibung eines Tages für Tooltip / Hover.
   * @param {import('./codebook/codebook.js').CodebookDay} entry
   */
  function formatDayTooltip(entry) {
    if (!entry) return '';
    const plugs = countPlugPairs(entry.plugboard);
    const layout = layoutCode(
      entry.rotorThin,
      entry.rotorLeft,
      entry.rotorMiddle,
      entry.rotorRight,
    );
    const ewName = entry.endwalzeWiring ? t('rotor.perm') : reflectorLabel(entry.reflectorId);
    const lines = [
      t('day.tag', { day: entry.day }),
      t('day.rotors', {
        thin: entry.rotorThin,
        left: entry.rotorLeft,
        middle: entry.rotorMiddle,
        right: entry.rotorRight,
        layout,
      }),
      t('day.rings', { ringCode: entry.ringCode, keyCode: entry.keyCode }),
      t('day.endwalze', { name: ewName, plugs }),
      entry.plugboard ? t('day.stecker', { plugboard: entry.plugboard }) : '',
    ];
    if (entry.reflectorId === REFLECTOR_ID_DORA) {
      const dora = formatDoraPairs(entry.reflectorD || '');
      lines.push(t('day.dora', { pairs: dora }));
    }
    return lines.filter(Boolean).join('\n');
  }

  /**
   * @param {import('./codebook/codebook.js').CodebookDay} entry
   */
  function getDoraPairsDisplay(entry) {
    if (!entry || entry.reflectorId !== REFLECTOR_ID_DORA) return '';
    return formatDoraPairs(entry.reflectorD || '');
  }

  function getStatusSummary() {
    if (!cache.sheet || !cache.selectedDay) {
      return {
        loaded: false,
        text: t('status.noSheet'),
        days: [],
        dayOptions: [],
        selectedDay: null,
        detail: '',
        tooltip: '',
      };
    }
    const entry = findCodebookDay(cache.sheet, cache.selectedDay);
    if (!entry) {
      return {
        loaded: false,
        text: t('status.noSheet'),
        days: cache.sheet.days.map((d) => d.day),
        dayOptions: cache.sheet.days.map((d) => ({
          day: d.day,
          tooltip: formatDayTooltip(d),
        })),
        selectedDay: null,
        detail: '',
        tooltip: '',
      };
    }
    const plugs = countPlugPairs(entry.plugboard);
    const layout = layoutCode(
      entry.rotorThin,
      entry.rotorLeft,
      entry.rotorMiddle,
      entry.rotorRight,
    );
    const ym = `${cache.sheet.year}-${String(cache.sheet.month).padStart(2, '0')}`;
    const tooltip = formatDayTooltip(entry);
    const ewName = entry.endwalzeWiring ? t('rotor.perm') : reflectorLabel(entry.reflectorId);
    const doraPairs = getDoraPairsDisplay(entry);
    return {
      loaded: true,
      text: t('status.loaded', {
        ym,
        day: entry.day,
        plugs,
        layout,
      }),
      short: t('status.dayLabel', { day: entry.day }),
      detail: tooltip,
      tooltip,
      endwalzeLabel: t('day.endwalze', { name: ewName, plugs }),
      reflectorId: entry.reflectorId,
      isDora: entry.reflectorId === REFLECTOR_ID_DORA,
      doraPairs,
      year: cache.sheet.year,
      month: cache.sheet.month,
      monthLabel: cache.sheet.monthLabel || `${cache.sheet.month}/${cache.sheet.year}`,
      tafelwort: tafelwort(cache.sheet),
      day: entry.day,
      plugCount: plugs,
      layout,
      keyCode: entry.keyCode,
      days: cache.sheet.days.map((d) => d.day),
      dayOptions: cache.sheet.days.map((d) => ({
        day: d.day,
        tooltip: formatDayTooltip(d),
      })),
      selectedDay: entry.day,
    };
  }

  return {
    load,
    importSheet,
    clearSheet,
    setDay,
    getState,
    getDayConfig,
    getStatusSummary,
    formatDayTooltip,
  };
}

/** In-Memory-Storage für Node-Selftests */
export function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    async get(keys) {
      if (keys == null) return { ...data };
      if (typeof keys === 'string') return { [keys]: data[keys] };
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) out[k] = data[k];
        return out;
      }
      return { ...data };
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}

export function createChromeStorage() {
  const api = globalThis.browser?.storage?.local ? globalThis.browser : globalThis.chrome;
  return {
    async get(keys) {
      return api.storage.local.get(keys);
    },
    async set(items) {
      return api.storage.local.set(items);
    },
  };
}

export const createBrowserStorage = createChromeStorage;
