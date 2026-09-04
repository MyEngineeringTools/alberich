/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Local message-key registry. No V3 cipher logic.
 *
 * Guarantee: on a surviving origin IndexedDB, the same Spruchschlüssel is not
 * used twice under the same full V3 key to create new ciphertext.
 *
 * Not claimed: group-wide uniqueness, other devices, survival after the user
 * deletes site data. Reservations are not stored in the codebook.
 */

export const SECURITY_DB_NAME = 'alberich-security-v1';
/** IndexedDB schema version (onupgradeneeded). Independent of record format. */
export const SECURITY_DB_VERSION = 2;
export const SECURITY_STORE = 'message_key_reservations';
export const SECURITY_WATERMARK_STORE = 'send_slot_watermarks';
/**
 * Record-format field on MK reservations. Not the IndexedDB schema version.
 * Reservations stay format 1; watermark rows use WATERMARK_STATE_VERSION.
 */
export const SECURITY_STATE_VERSION = 1;
export const WATERMARK_STATE_VERSION = 2;
export const MK_RESERVE_MAX_ATTEMPTS = 64;

export const RESERVE = Object.freeze({
  RESERVED: 'RESERVED',
  ALREADY_USED: 'ALREADY_USED',
  STORAGE_FAILURE: 'STORAGE_FAILURE',
});

export const START = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  TIME_ROLLBACK_BLOCKED: 'TIME_ROLLBACK_BLOCKED',
  ALREADY_USED: 'ALREADY_USED',
  STORAGE_FAILURE: 'STORAGE_FAILURE',
});

export const WATERMARK = Object.freeze({
  ADVANCED: 'ADVANCED',
  UNCHANGED: 'UNCHANGED',
  STORAGE_FAILURE: 'STORAGE_FAILURE',
});

const FP_RE = /^[0-9a-f]{64}$/;
const MK_RE = /^[A-Z]{4}$/;

const defaults = () => ({
  idbFactory: () => globalThis.indexedDB ?? null,
  locks: () => globalThis.navigator?.locks ?? null,
  now: () => Date.now(),
  afterAdd: null,
});

let settings = defaults();
let dbPromise = null;
let lastDurability = 'unknown';
let lastOpenMs = 0;
let lastReserveMs = 0;

export function configureSecurityState(partial = {}) {
  settings = { ...settings, ...partial };
}

export function resetSecurityStateForTests() {
  dbPromise = null;
  lastDurability = 'unknown';
  settings = defaults();
}

export function securityStateInfo() {
  return {
    db: SECURITY_DB_NAME,
    version: SECURITY_DB_VERSION,
    securityStateVersion: SECURITY_STATE_VERSION,
    watermarkStateVersion: WATERMARK_STATE_VERSION,
    store: SECURITY_STORE,
    watermarkStore: SECURITY_WATERMARK_STORE,
    durability: lastDurability,
    lastOpenMs,
    lastReserveMs,
  };
}

export function upgradeSecurityDb(db, oldVersion, newVersion = SECURITY_DB_VERSION) {
  if (oldVersion > newVersion) {
    throw new Error('idb-downgrade');
  }
  if (!db.objectStoreNames.contains(SECURITY_STORE)) {
    db.createObjectStore(SECURITY_STORE, {
      keyPath: ['fullKeyFingerprint', 'messageKey'],
    });
  }
  if (newVersion >= 2 && oldVersion < 2 && !db.objectStoreNames.contains(SECURITY_WATERMARK_STORE)) {
    db.createObjectStore(SECURITY_WATERMARK_STORE, {
      keyPath: ['codebookFingerprint', 'timeProfile'],
    });
  }
}

function isConstraintError(err) {
  return Boolean(err) && (err.name === 'ConstraintError' || err.code === 0);
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-request'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('transaction error'));
  });
}

function openReadwrite(db, storeNames = [SECURITY_STORE]) {
  try {
    const tx = db.transaction(storeNames, 'readwrite', { durability: 'strict' });
    lastDurability = tx.durability || 'strict';
    return tx;
  } catch {
    const tx = db.transaction(storeNames, 'readwrite');
    lastDurability = tx.durability || 'default';
    return tx;
  }
}

export async function openSecurityDb() {
  const t0 = settings.now();
  if (dbPromise) {
    lastOpenMs = settings.now() - t0;
    return dbPromise;
  }
  const factory = settings.idbFactory();
  if (!factory || typeof factory.open !== 'function') {
    throw new Error('indexedDB unavailable');
  }
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = factory.open(SECURITY_DB_NAME, SECURITY_DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = Number(event.oldVersion) || 0;
      if (oldVersion > SECURITY_DB_VERSION) {
        try {
          req.transaction.abort();
        } catch {
          /* already failing */
        }
        return;
      }
      try {
        upgradeSecurityDb(db, oldVersion, Number(event.newVersion) || SECURITY_DB_VERSION);
      } catch {
        try {
          req.transaction.abort();
        } catch {
          /* already failing */
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-open'));
    req.onblocked = () => reject(new Error('idb-blocked'));
  });
  try {
    const db = await dbPromise;
    lastOpenMs = settings.now() - t0;
    return db;
  } catch (err) {
    dbPromise = null;
    throw err;
  }
}

/**
 * @param {string} fullKeyFingerprint
 * @param {string} messageKey
 * @returns {Promise<{ status: string, reason?: string, durability?: string }>}
 */
export async function reserveMessageKey(fullKeyFingerprint, messageKey) {
  const t0 = settings.now();
  if (!FP_RE.test(fullKeyFingerprint) || !MK_RE.test(messageKey)) {
    lastReserveMs = settings.now() - t0;
    return { status: RESERVE.STORAGE_FAILURE, reason: 'invalid-input' };
  }

  let db;
  try {
    db = await openSecurityDb();
  } catch (err) {
    lastReserveMs = settings.now() - t0;
    return { status: RESERVE.STORAGE_FAILURE, reason: err?.name || 'open' };
  }

  let tx;
  try {
    tx = openReadwrite(db);
  } catch (err) {
    lastReserveMs = settings.now() - t0;
    return { status: RESERVE.STORAGE_FAILURE, reason: err?.name || 'transaction' };
  }

  const record = {
    fullKeyFingerprint,
    messageKey,
    reservedAt: settings.now(),
    securityStateVersion: SECURITY_STATE_VERSION,
  };

  const done = transactionDone(tx);
  try {
    const store = tx.objectStore(SECURITY_STORE);
    await requestToPromise(store.add(record));
    if (typeof settings.afterAdd === 'function') {
      settings.afterAdd(tx);
    }
    await done;
    lastReserveMs = settings.now() - t0;
    return { status: RESERVE.RESERVED, durability: lastDurability };
  } catch (err) {
    try {
      await done;
    } catch {
      /* abort/error already captured */
    }
    lastReserveMs = settings.now() - t0;
    if (isConstraintError(err)) {
      return { status: RESERVE.ALREADY_USED };
    }
    return { status: RESERVE.STORAGE_FAILURE, reason: err?.name || 'add' };
  }
}

async function withOptionalLock(fullKeyFingerprint, fn) {
  const locks = settings.locks();
  if (!locks || typeof locks.request !== 'function') {
    return fn();
  }
  const name = `alberich-security-mk:${fullKeyFingerprint}`;
  return locks.request(name, { mode: 'exclusive' }, fn);
}

/**
 * Auto MK: RESERVED, STORAGE_FAILURE, or retry on ALREADY_USED.
 * @param {{
 *   fullKeyFingerprint: string,
 *   nextMessageKey: () => string,
 *   preferredMessageKey?: string,
 * }} opts
 */
export async function chooseAndReserveMessageKey(opts) {
  const fp = opts.fullKeyFingerprint;
  const next = opts.nextMessageKey;
  if (typeof next !== 'function') {
    return { status: RESERVE.STORAGE_FAILURE, reason: 'invalid-input' };
  }
  return withOptionalLock(fp, async () => {
    let mk = opts.preferredMessageKey || next();
    for (let attempt = 1; attempt <= MK_RESERVE_MAX_ATTEMPTS; attempt++) {
      const result = await reserveMessageKey(fp, mk);
      if (result.status === RESERVE.RESERVED) {
        return { ...result, messageKey: mk, attempts: attempt };
      }
      if (result.status === RESERVE.STORAGE_FAILURE) {
        return result;
      }
      mk = next();
    }
    return { status: RESERVE.STORAGE_FAILURE, reason: 'retry-exhausted' };
  });
}

function withSlotLock(codebookFingerprint, timeProfile, fn) {
  const locks = settings.locks();
  if (!locks || typeof locks.request !== 'function') {
    return fn();
  }
  const name = `alberich-security-slot:${codebookFingerprint}:${timeProfile}`;
  return locks.request(name, { mode: 'exclusive' }, fn);
}

/**
 * Read watermark + reserve MK in one transaction. Does not raise the watermark.
 * @returns {Promise<{ status: string, messageKey?: string, highestOrdinal?: number, attempts?: number, reason?: string }>}
 */
export async function authorizeSessionStart(opts) {
  const fp = opts.fullKeyFingerprint;
  const bookFp = opts.codebookFingerprint;
  const profile = opts.timeProfile;
  const ordinal = Number(opts.slotOrdinal);
  const slotId = String(opts.slotId || '');
  const next = opts.nextMessageKey;
  if (!FP_RE.test(fp) || !FP_RE.test(bookFp) || !Number.isInteger(ordinal)) {
    return { status: START.STORAGE_FAILURE, reason: 'invalid-input' };
  }
  if (typeof next !== 'function') {
    return { status: START.STORAGE_FAILURE, reason: 'invalid-input' };
  }

  return withSlotLock(bookFp, profile, async () => {
    let mk = opts.preferredMessageKey || next();
    for (let attempt = 1; attempt <= MK_RESERVE_MAX_ATTEMPTS; attempt++) {
      const result = await authorizeOnce({
        fullKeyFingerprint: fp,
        codebookFingerprint: bookFp,
        timeProfile: profile,
        slotOrdinal: ordinal,
        slotId,
        messageKey: mk,
      });
      if (result.status === START.AUTHORIZED) {
        return { ...result, messageKey: mk, attempts: attempt };
      }
      if (result.status !== START.ALREADY_USED) return result;
      mk = next();
    }
    return { status: START.STORAGE_FAILURE, reason: 'retry-exhausted' };
  });
}

async function authorizeOnce(opts) {
  const t0 = settings.now();
  if (!MK_RE.test(opts.messageKey)) {
    return { status: START.STORAGE_FAILURE, reason: 'invalid-input' };
  }
  let db;
  try {
    db = await openSecurityDb();
  } catch (err) {
    lastReserveMs = settings.now() - t0;
    return { status: START.STORAGE_FAILURE, reason: err?.name || 'open' };
  }

  let tx;
  try {
    tx = openReadwrite(db, [SECURITY_STORE, SECURITY_WATERMARK_STORE]);
  } catch (err) {
    lastReserveMs = settings.now() - t0;
    return { status: START.STORAGE_FAILURE, reason: err?.name || 'transaction' };
  }

  const done = transactionDone(tx);
  try {
    const marks = tx.objectStore(SECURITY_WATERMARK_STORE);
    const existing = await requestToPromise(marks.get([opts.codebookFingerprint, opts.timeProfile]));
    const highest = existing && Number.isInteger(existing.highestOrdinal)
      ? existing.highestOrdinal
      : null;
    if (highest != null && opts.slotOrdinal < highest) {
      try { tx.abort(); } catch { /* already aborting */ }
      try { await done; } catch { /* aborted */ }
      lastReserveMs = settings.now() - t0;
      return { status: START.TIME_ROLLBACK_BLOCKED, highestOrdinal: highest };
    }

    const record = {
      fullKeyFingerprint: opts.fullKeyFingerprint,
      messageKey: opts.messageKey,
      reservedAt: settings.now(),
      securityStateVersion: SECURITY_STATE_VERSION,
    };
    await requestToPromise(tx.objectStore(SECURITY_STORE).add(record));
    if (typeof settings.afterAdd === 'function') settings.afterAdd(tx);
    await done;
    lastReserveMs = settings.now() - t0;
    return {
      status: START.AUTHORIZED,
      highestOrdinal: highest,
      durability: lastDurability,
    };
  } catch (err) {
    try { await done; } catch { /* abort/error */ }
    lastReserveMs = settings.now() - t0;
    if (isConstraintError(err)) return { status: START.ALREADY_USED };
    return { status: START.STORAGE_FAILURE, reason: err?.name || 'authorize' };
  }
}

export async function readSendWatermark(codebookFingerprint, timeProfile) {
  if (!FP_RE.test(codebookFingerprint)) return null;
  const db = await openSecurityDb();
  const tx = db.transaction([SECURITY_WATERMARK_STORE], 'readonly');
  const done = transactionDone(tx);
  const rec = await requestToPromise(
    tx.objectStore(SECURITY_WATERMARK_STORE).get([codebookFingerprint, timeProfile]),
  );
  await done.catch(() => {});
  return rec || null;
}

/**
 * Persist max(existing, sessionOrdinal). Completes before controlled output.
 */
export async function advanceSendWatermark(opts) {
  const bookFp = opts.codebookFingerprint;
  const profile = opts.timeProfile;
  const ordinal = Number(opts.slotOrdinal);
  const slotId = String(opts.slotId || '');
  if (!FP_RE.test(bookFp) || !Number.isInteger(ordinal)) {
    return { status: WATERMARK.STORAGE_FAILURE, reason: 'invalid-input' };
  }

  return withSlotLock(bookFp, profile, async () => {
    let db;
    try {
      db = await openSecurityDb();
    } catch (err) {
      return { status: WATERMARK.STORAGE_FAILURE, reason: err?.name || 'open' };
    }
    let tx;
    try {
      tx = openReadwrite(db, [SECURITY_WATERMARK_STORE]);
    } catch (err) {
      return { status: WATERMARK.STORAGE_FAILURE, reason: err?.name || 'transaction' };
    }
    const done = transactionDone(tx);
    try {
      const store = tx.objectStore(SECURITY_WATERMARK_STORE);
      const existing = await requestToPromise(store.get([bookFp, profile]));
      const prev = existing && Number.isInteger(existing.highestOrdinal)
        ? existing.highestOrdinal
        : null;
      if (prev != null && prev >= ordinal) {
        await done;
        return {
          status: WATERMARK.UNCHANGED,
          highestOrdinal: prev,
          highestSlotId: existing.highestSlotId,
        };
      }
      const record = {
        codebookFingerprint: bookFp,
        timeProfile: profile,
        highestOrdinal: ordinal,
        highestSlotId: slotId,
        updatedAt: settings.now(),
        securityStateVersion: WATERMARK_STATE_VERSION,
      };
      await requestToPromise(store.put(record));
      await done;
      return {
        status: WATERMARK.ADVANCED,
        highestOrdinal: ordinal,
        highestSlotId: slotId,
      };
    } catch (err) {
      try { await done; } catch { /* abort */ }
      return { status: WATERMARK.STORAGE_FAILURE, reason: err?.name || 'put' };
    }
  });
}

export async function countReservations() {
  const db = await openSecurityDb();
  const tx = db.transaction([SECURITY_STORE], 'readonly');
  const done = transactionDone(tx);
  const store = tx.objectStore(SECURITY_STORE);
  const rows = await requestToPromise(store.getAll());
  await done.catch(() => {});
  return Array.isArray(rows) ? rows.length : 0;
}

export async function inspectStoragePersistence() {
  const storage = globalThis.navigator?.storage;
  if (!storage) {
    return { available: false, persisted: null, persistFn: false };
  }
  let persisted = null;
  try {
    if (typeof storage.persisted === 'function') {
      persisted = await storage.persisted();
    }
  } catch {
    persisted = null;
  }
  return {
    available: true,
    persisted,
    persistFn: typeof storage.persist === 'function',
    calledPersist: false,
  };
}
