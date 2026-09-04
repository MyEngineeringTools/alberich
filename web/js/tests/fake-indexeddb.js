/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Minimal IndexedDB stand-in: add/get/put, ConstraintError, commit/abort, multi-store.
 */

function namedError(name, message) {
  if (typeof DOMException === 'function') {
    return new DOMException(message, name);
  }
  const err = new Error(message);
  err.name = name;
  return err;
}

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.transaction = null;
  }

  _ok(result) {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.(new Event('success')));
  }

  _fail(error) {
    this.error = error;
    queueMicrotask(() => this.onerror?.(new Event('error')));
  }
}

function recordKey(record, keyPath) {
  return keyPath.map((k) => record[k]).join('\0');
}

function keyString(key, keyPath) {
  if (Array.isArray(key)) return key.join('\0');
  if (keyPath.length === 1 && (typeof key === 'string' || typeof key === 'number')) {
    return String(key);
  }
  return String(key);
}

export function createFakeIndexedDB(opts = {}) {
  const databases = new Map();
  const flags = {
    abortAfterAdd: Boolean(opts.abortAfterAdd),
    addError: opts.addError || null,
  };

  class FakeStore {
    constructor(tx, spec) {
      this.tx = tx;
      this.spec = spec;
    }

    _bucket() {
      return this.tx._pendingFor(this.spec.name);
    }

    add(record) {
      const req = new FakeRequest();
      this.tx._run(() => {
        if (this.tx._aborted) {
          req._fail(namedError('AbortError', 'The transaction was aborted.'));
          return;
        }
        if (flags.addError) {
          req._fail(flags.addError);
          return;
        }
        const key = recordKey(record, this.spec.keyPath);
        if (this.spec.data.has(key) || this._bucket().has(key)) {
          const err = namedError('ConstraintError', 'Key already exists in the object store.');
          this.tx.error = err;
          req._fail(err);
          this.tx.abort();
          return;
        }
        this._bucket().set(key, record);
        req._ok();
        if (flags.abortAfterAdd) this.tx.abort();
      });
      return req;
    }

    put(record) {
      const req = new FakeRequest();
      this.tx._run(() => {
        if (this.tx._aborted) {
          req._fail(namedError('AbortError', 'The transaction was aborted.'));
          return;
        }
        const key = recordKey(record, this.spec.keyPath);
        this._bucket().set(key, record);
        req._ok();
      });
      return req;
    }

    get(key) {
      const req = new FakeRequest();
      this.tx._run(() => {
        const k = keyString(key, this.spec.keyPath);
        const rec = this._bucket().get(k) ?? this.spec.data.get(k);
        req._ok(rec);
      });
      return req;
    }

    getAll() {
      const req = new FakeRequest();
      this.tx._run(() => {
        const merged = new Map(this.spec.data);
        for (const [k, v] of this._bucket()) merged.set(k, v);
        req._ok([...merged.values()]);
      });
      return req;
    }
  }

  class FakeTransaction {
    constructor(rec, mode, options) {
      this.rec = rec;
      this.mode = mode;
      this.durability = options?.durability || 'default';
      this.oncomplete = null;
      this.onabort = null;
      this.onerror = null;
      this.error = null;
      this._aborted = false;
      this._done = false;
      this._pendingByStore = new Map();
      this._ops = Promise.resolve();
      this._activeOps = 0;
      this._hasRequest = false;
      this._waitPrev = rec._gate;
      this._closed = new Promise((resolve) => {
        this._releaseGate = resolve;
      });
      rec._gate = this._closed;
      setTimeout(() => this._tryComplete(), 0);
    }

    _pendingFor(name) {
      if (!this._pendingByStore.has(name)) this._pendingByStore.set(name, new Map());
      return this._pendingByStore.get(name);
    }

    objectStore(name) {
      const spec = this.rec.stores.get(name);
      if (!spec) throw new Error(`unknown store ${name}`);
      return new FakeStore(this, spec);
    }

    _run(fn) {
      this._hasRequest = true;
      this._activeOps += 1;
      this._ops = this._ops.then(async () => {
        await this._waitPrev;
        fn();
        this._activeOps -= 1;
        setTimeout(() => this._tryComplete(), 0);
      });
    }

    abort() {
      if (this._done) return;
      this._aborted = true;
      this.error = this.error || namedError('AbortError', 'The transaction was aborted.');
      this._pendingByStore.clear();
      this._finish(false);
    }

    _tryComplete() {
      if (this._done || this._activeOps > 0 || !this._hasRequest) return;
      if (this._aborted) {
        this._finish(false);
        return;
      }
      for (const [storeName, writes] of this._pendingByStore) {
        const spec = this.rec.stores.get(storeName);
        if (!spec) continue;
        for (const [key, record] of writes) spec.data.set(key, record);
      }
      this._finish(true);
    }

    _finish(ok) {
      if (this._done) return;
      this._done = true;
      if (ok) this.oncomplete?.(new Event('complete'));
      else this.onabort?.(new Event('abort'));
      this._releaseGate?.();
    }
  }

  class FakeDatabase {
    constructor(rec) {
      this._rec = rec;
      this.objectStoreNames = { contains: (n) => rec.stores.has(n) };
    }

    createObjectStore(name, opts) {
      this._rec.stores.set(name, { name, keyPath: opts.keyPath, data: new Map() });
      return {};
    }

    transaction(_names, mode = 'readonly', options) {
      return new FakeTransaction(this._rec, mode, options);
    }
  }

  return {
    flags,
    open(name, version = 1) {
      const req = new FakeRequest();
      queueMicrotask(() => {
        let rec = databases.get(name);
        const oldVersion = rec ? rec.version : 0;
        if (!rec) {
          rec = {
            version: 0,
            stores: new Map(),
            _gate: Promise.resolve(),
            _turn: Promise.resolve(),
          };
          databases.set(name, rec);
        }
        const db = new FakeDatabase(rec);
        req.result = db;
        req.transaction = {
          abort() {
            /* upgrade abort */
          },
        };
        if (oldVersion < version) {
          rec.version = version;
          req.onupgradeneeded?.({ target: req, oldVersion, newVersion: version });
        }
        rec.version = Math.max(rec.version, version);
        req.onsuccess?.(new Event('success'));
      });
      return req;
    },
  };
}
