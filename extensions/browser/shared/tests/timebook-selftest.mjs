/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * node shared/tests/timebook-selftest.mjs
 */
import { parseCodebookJson } from '../codebook/codebook.js';
import {
  TIME_PROFILE,
  getSlotForTimestamp,
  alberichWallToUnixMs,
} from '../timebook/alberich-key-time.js';
import { isTimebook, validateTimebook } from '../timebook/timebook.js';
import { decodeCbqr2, isCbqr2Bytes } from '../timebook/cbqr2-binary.js';
import { createKeyManager, createMemoryStorage } from '../key-manager.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  } else {
    console.log('OK  ', msg);
  }
}

const ts = alberichWallToUnixMs(2026, 9, 4, 15, 0, 0);
const slot = getSlotForTimestamp(ts, TIME_PROFILE.HOURS_4);
assert(slot.profile === TIME_PROFILE.HOURS_4, '4h profile');
assert(slot.day === 4 && slot.month === 9 && slot.year === 2026, 'alb date');
assert(slot.slotIndex === 3, '15:00 UTC+1 is slot 3 (12–16)');

assert(!isTimebook({ format: 'alberich-codebook' }), 'daily sheet is not timebook');
assert(validateTimebook({ kind: 'ALB3_TIMEBOOK_V1' }).ok === false, 'empty timebook rejected');

const rejected = parseCodebookJson(JSON.stringify({
  kind: 'ALB3_TIMEBOOK_V1',
  format: 'ALB3_TIMEBOOK_V1',
  year: 2026,
  month: 9,
  days: [],
}));
assert(!rejected.ok && rejected.error === 'timebook.err.notLegacyFormat', 'JSON timebook rejected');

assert(!isCbqr2Bytes(new Uint8Array([1, 2, 3])), 'junk is not cbqr2');
const dec = await decodeCbqr2(new Uint8Array(8));
assert(!dec.ok, 'truncated cbqr2 rejected');

const storage = createMemoryStorage();
const keys = createKeyManager(storage);
const samplePath = join(dirname(fileURLToPath(import.meta.url)), '../samples/demo-codebook-v3.json');
const json = readFileSync(samplePath, 'utf8');
const imp = await keys.importSheet(json);
assert(imp.ok && !keys.isHardened(), 'daily JSON import');
assert(keys.getDayConfig(), 'daily config');

const tbJson = await keys.importSheet(JSON.stringify({ kind: 'ALB3_TIMEBOOK_V1' }));
assert(!tbJson.ok, 'key-manager rejects timebook JSON');

if (process.exitCode) {
  console.error('timebook-selftest failed');
} else {
  console.log('timebook-selftest ok');
}
