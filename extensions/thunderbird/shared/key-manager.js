/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Monatstafel oder gehärtetes Timebook → Maschinenkonfiguration.
 * Storage-Backend ist austauschbar (chrome.storage / memory für Tests).
 * Löschen/Ersetzen der Tafel leert das MK-Register nicht.
 */
/**
 * Monatstafel oder gehärtetes Timebook → Maschinenkonfiguration.
 * Storage-Backend ist austauschbar (chrome.storage / memory für Tests).
 * Löschen/Ersetzen der Tafel leert das MK-Register nicht.
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
import { resolveV3Epoch } from './crypto/modern-v3.js';
import { isCbqr2Bytes, decodeCbqr2 } from './timebook/cbqr2-binary.js';
import {
  getAlberichDateTime,
  getSlotForTimestamp,
} from './timebook/alberich-key-time.js';
import {
  isTimebook,
  resolveTimebookSlot,
  selectDisplayFullKey,
  validateTimebook,
} from './timebook/timebook.js';
import {
  formatCountdownClock,
  shortFingerprint,
  slotEndUnixMs,
  timebookKeyToConfig,
} from './timebook/timebook-ops.js';

const STORAGE_KEY = 'alberichCompanion.v1';

/**
 * @param {{ get: Function, set: Function }} storage  chrome.storage.local-like
 */
export function createKeyManager(storage) {
  let cache = { sheet: null, timebook: null, selectedDay: null };

  function emptyCache() {
    return { sheet: null, timebook: null, selectedDay: null };
  }

  async function load() {
    const data = await storage.get(STORAGE_KEY);
    const raw = data?.[STORAGE_KEY] ?? data;
    if (!raw || typeof raw !== 'object') {
      cache = emptyCache();
      return cache;
    }
    let timebook = raw.timebook ?? null;
    if (timebook && (!isTimebook(timebook) || !validateTimebook(timebook).ok)) {
      timebook = null;
    }
    const sheet = timebook ? null : (raw.sheet ?? null);
    let selectedDay = Number(raw.selectedDay) || null;
    if (sheet?.days?.length) {
      if (!selectedDay || !findCodebookDay(sheet, selectedDay)) {
        selectedDay = defaultCodebookDay(sheet);
      }
    } else {
      selectedDay = null;
    }
    cache = { sheet, timebook, selectedDay };
    return cache;
  }

  async function save() {
    await storage.set({
      [STORAGE_KEY]: {
        sheet: cache.sheet,
        timebook: cache.timebook,
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
    cache.timebook = null;
    cache.selectedDay = defaultCodebookDay(parsed.sheet);
    await save();
    return { ok: true, sheet: cache.sheet, selectedDay: cache.selectedDay, kind: 'daily' };
  }

  /**
   * @param {Uint8Array} bytes
   */
  async function importTimebookBytes(bytes) {
    const decoded = await decodeCbqr2(bytes);
    if (!decoded.ok) {
      return { ok: false, error: decoded.error || 'cbqr2.err.magic' };
    }
    cache.timebook = decoded.timebook;
    cache.sheet = null;
    cache.selectedDay = null;
    await save();
    return { ok: true, timebook: cache.timebook, kind: 'hardened' };
  }

  /**
   * @param {ArrayBuffer|Uint8Array|string} raw
   */
  async function importFile(raw) {
    if (raw instanceof ArrayBuffer) {
      return importTimebookBytes(new Uint8Array(raw));
    }
    if (raw instanceof Uint8Array) {
      if (isCbqr2Bytes(raw)) return importTimebookBytes(raw);
      const text = new TextDecoder().decode(raw);
      return importSheet(text);
    }
    return importSheet(raw);
  }

  async function clearSheet() {
    cache = emptyCache();
    await save();
  }

  /**
   * @param {number} day
   */
  async function setDay(day) {
    if (cache.timebook) return { ok: false, error: 'timebook.err.clockSelects' };
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
    return {
      sheet: cache.sheet,
      timebook: cache.timebook,
      selectedDay: cache.selectedDay,
      hardened: Boolean(cache.timebook),
    };
  }

  function getTimebook() {
    return cache.timebook;
  }

  function isHardened() {
    return Boolean(cache.timebook);
  }

  /**
   * Daily-key config. Timebook callers use timebookKeyToConfig on the pin/clock key.
   */
  function getDayConfig() {
    if (cache.timebook) {
      const resolved = resolveTimebookSlot(cache.timebook, Date.now());
      if (!resolved.ok || !resolved.key) return null;
      return timebookKeyToConfig(resolved.key, cache.timebook, resolved.epoch);
    }
    if (!cache.sheet || !cache.selectedDay) return null;
    const entry = findCodebookDay(cache.sheet, cache.selectedDay);
    if (!entry) return null;
    const patch = dayEntryToSettingsPatch(entry);
    return {
      ...patch,
      networkContext: cache.sheet.networkContext || 'ALB',
      epoch: resolveV3Epoch({
        date: entry.date,
        year: cache.sheet.year,
        month: cache.sheet.month,
        day: entry.day,
      }),
    };
  }

  function formatDayTooltip(entry) {
    if (!entry) return '';
    const plugs = countPlugPairs(entry.plugboard);
    const layout = layoutCode(
      entry.rotorThin,
      entry.rotorLeft,
      entry.rotorMiddle,
      entry.rotorRight,
    );
    const wiring = String(entry.endwalzeWiring || '');
    const ewName = wiring.length === 26 ? wiring : (entry.endwalzeWiring ? t('rotor.perm') : reflectorLabel(entry.reflectorId));
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
    if (entry.lueckenfueller) {
      const n = entry.lueckenfueller;
      lines.push(t('day.notches', {
        left: n.left || '',
        middle: n.middle || '',
        right: n.right || '',
      }));
    }
    return lines.filter(Boolean).join('\n');
  }

  function getDoraPairsDisplay(entry) {
    if (!entry || entry.reflectorId !== REFLECTOR_ID_DORA) return '';
    return formatDoraPairs(entry.reflectorD || '');
  }

  function emptyStatus() {
    return {
      loaded: false,
      hardened: false,
      text: t('status.noSheet'),
      days: [],
      dayOptions: [],
      selectedDay: null,
      detail: '',
      tooltip: '',
    };
  }

  /**
   * @param {{ pin?: object, timestampMs?: number }} [opts]
   */
  function getStatusSummary(opts = {}) {
    if (cache.timebook) {
      return getHardenedStatus(opts);
    }
    if (!cache.sheet || !cache.selectedDay) {
      return emptyStatus();
    }
    const entry = findCodebookDay(cache.sheet, cache.selectedDay);
    if (!entry) {
      return {
        ...emptyStatus(),
        days: cache.sheet.days.map((d) => d.day),
        dayOptions: cache.sheet.days.map((d) => ({
          day: d.day,
          tooltip: formatDayTooltip(d),
        })),
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
    const wiring = String(entry.endwalzeWiring || '');
    const ewName = wiring.length === 26 ? wiring : (entry.endwalzeWiring ? t('rotor.perm') : reflectorLabel(entry.reflectorId));
    const doraPairs = getDoraPairsDisplay(entry);
    const alb = getAlberichDateTime();
    return {
      loaded: true,
      hardened: false,
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
      albYear: alb.year,
      albMonth: alb.month,
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

  function getHardenedStatus(opts) {
    const book = cache.timebook;
    const ts = opts.timestampMs ?? Date.now();
    const display = selectDisplayFullKey({
      book,
      isModernMode: true,
      keySource: 'codebook',
      pin: opts.pin,
      timestampMs: ts,
    });
    const resolved = resolveTimebookSlot(book, ts);
    const ym = `${book.year}-${String(book.month).padStart(2, '0')}`;
    const alb = getAlberichDateTime(ts);
    const outOfMonth = !resolved.ok && resolved.error === 'timebook.err.outOfMonth';
    const key = display?.key || resolved.key;
    const meta = resolved.meta || (book.timeProfile ? getSlotForTimestamp(ts, book.timeProfile) : null);
    const remain = meta ? formatCountdownClock(slotEndUnixMs(meta) - ts) : '';
    const tooltip = key ? formatDayTooltip({ ...key, day: meta?.day }) : '';
    const fp = shortFingerprint(book.codebookFingerprint);
    const source = display?.source || (opts.pin?.fullKey ? 'pin' : 'clock');
    const text = outOfMonth
      ? t('timebook.err.outOfMonth')
      : t('status.hardened', {
        ym,
        slot: display?.slotId || resolved.slotId || '',
        remain,
        fp,
      });
    return {
      loaded: true,
      hardened: true,
      outOfMonth,
      text,
      short: t('status.hardenedShort', { remain }),
      detail: tooltip,
      tooltip,
      year: book.year,
      month: book.month,
      monthLabel: `${book.month}/${book.year}`,
      tafelwort: '',
      fingerprint: book.codebookFingerprint,
      fingerprintShort: fp,
      remain,
      slotId: display?.slotId || resolved.slotId || '',
      source,
      albYear: alb.year,
      albMonth: alb.month,
      day: meta?.day ?? null,
      keyCode: key?.keyCode,
      days: [],
      dayOptions: [],
      selectedDay: meta?.day ?? null,
      timeProfile: book.timeProfile,
    };
  }

  return {
    load,
    importSheet,
    importTimebookBytes,
    importFile,
    clearSheet,
    setDay,
    getState,
    getTimebook,
    isHardened,
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
