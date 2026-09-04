/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 * Full-key fingerprint + duplicate rejection.
 * node js/tests/full-key-fingerprint-selftest.js
 */
import { generateMonthSheet } from '../codebook-generate.js';
import {
  FULL_KEY_CANON_VERSION,
  canonicalizeFullV3Key,
  fullKeyFingerprint,
  takeUniqueFullKey,
} from '../full-key-fingerprint.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK  ', msg);
  }
}

const SAMPLE = {
  rotorThin: 'Beta',
  rotorLeft: 'V',
  rotorMiddle: 'VI',
  rotorRight: 'VIII',
  ringCode: 'EPEL',
  keyCode: 'CDSZ',
  plugboard: 'AE BF CM DQ HU JN LX PR SZ VW',
  endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNM',
  lueckenfueller: { left: 'AFLRX', middle: 'BEIMQUY', right: 'CDHKNPSVZ' },
};

const CANON = canonicalizeFullV3Key(SAMPLE);
assert(CANON.startsWith(`${FULL_KEY_CANON_VERSION}\n`), 'canon version header');
assert(CANON.endsWith('\n'), 'canon trailing LF');
assert(CANON.includes('rotors:Beta,V,VI,VIII'), 'canon rotors');
assert(CANON.includes('rings:EPEL'), 'canon rings');
assert(CANON.includes('ground:CDSZ'), 'canon ground');
assert(CANON.includes('plugs:AE BF CM DQ HU JN LX PR SZ VW'), 'canon plugs');
assert(CANON.includes('end:QWERTYUIOPASDFGHJKLZXCVBNM'), 'canon endwalze');
assert(CANON.includes('notches:AFLRX|BEIMQUY|CDHKNPSVZ'), 'canon notches');
assert(!CANON.includes('2026'), 'canon has no date');
assert(!CANON.includes('slot'), 'canon has no slot');
assert(!CANON.includes('network'), 'canon has no network');

const frozenFp = await fullKeyFingerprint(SAMPLE);
assert(/^[a-f0-9]{64}$/.test(frozenFp), 'fingerprint is SHA-256 hex');
assert(
  frozenFp === '752a32bdcd340561985d0f11f75a6bc000ebc650498e7e2d96a93e64610f8a66',
  'frozen SHA-256 test vector',
);
assert(frozenFp === await fullKeyFingerprint(SAMPLE), 'fingerprint deterministic');

assert(
  canonicalizeFullV3Key({ ...SAMPLE, groundKey: 'CDSZ', keyCode: undefined }) === CANON,
  'groundKey alias matches keyCode',
);
assert(
  canonicalizeFullV3Key({
    ...SAMPLE,
    notches: SAMPLE.lueckenfueller,
    lueckenfueller: undefined,
  }) === CANON,
  'notches alias matches lueckenfueller',
);
assert(
  await fullKeyFingerprint({
    ...SAMPLE,
    plugboard: 'VW SZ PR LX JN HU DQ CM BF AE',
  }) === frozenFp,
  'plug pair order does not change fingerprint',
);

assert(
  await fullKeyFingerprint({
    ...SAMPLE,
    day: 9,
    date: '2026-09-09',
    slot: '08-12',
    sheetName: 'Familie',
    networkContext: 'OTHER',
    generatedAt: '2099-01-01T00:00:00.000Z',
  }) === frozenFp,
  'D: metadata date/slot/name/net ignored',
);

assert(
  await fullKeyFingerprint({ ...SAMPLE, rotorLeft: 'I' }) !== frozenFp,
  'C: different left rotor → different fingerprint',
);
assert(
  await fullKeyFingerprint({ ...SAMPLE, ringCode: 'EPEA' }) !== frozenFp,
  'C: different ring → different fingerprint',
);
assert(
  await fullKeyFingerprint({ ...SAMPLE, keyCode: 'CDSA' }) !== frozenFp,
  'C: different ground → different fingerprint',
);
assert(
  await fullKeyFingerprint({
    ...SAMPLE,
    plugboard: 'AF BF CM DQ HU JN LX PR SZ VW',
  }) !== frozenFp,
  'C: different plugs → different fingerprint',
);
assert(
  await fullKeyFingerprint({
    ...SAMPLE,
    endwalzeWiring: 'QWERTYUIOPASDFGHJKLZXCVBNZ',
  }) !== frozenFp,
  'C: different endwalze → different fingerprint',
);
assert(
  await fullKeyFingerprint({
    ...SAMPLE,
    lueckenfueller: { ...SAMPLE.lueckenfueller, left: 'AFLRY' },
  }) !== frozenFp,
  'C: different notches → different fingerprint',
);

{
  const seen = new Set();
  const first = await takeUniqueFullKey(seen, () => SAMPLE);
  assert(first.attempts === 1 && first.fingerprint === frozenFp, 'first key accepted');
  let calls = 0;
  const other = { ...SAMPLE, keyCode: 'ZZZZ' };
  const second = await takeUniqueFullKey(seen, () => {
    calls += 1;
    return calls === 1 ? SAMPLE : other;
  });
  assert(calls === 2, 'B: colliding candidate discarded, factory called again');
  assert(second.attempts === 2, 'B: accepted on second attempt');
  assert(second.fingerprint !== frozenFp, 'B: replacement is a different full key');
  assert(seen.size === 2, 'B: two fingerprints stored');
}

{
  const seen = new Set();
  await takeUniqueFullKey(seen, () => SAMPLE);
  let threw = false;
  try {
    await takeUniqueFullKey(seen, () => SAMPLE, 3);
  } catch (err) {
    threw = err instanceof Error && err.message === 'Unable to generate unique V3 key';
  }
  assert(threw, 'exhausted identical candidates fail closed');
}

{
  const t0 = Date.now();
  const sheet = await generateMonthSheet(2026, 9, 'de', { endwalzePolicy: 'permutation' });
  const elapsed = Date.now() - t0;
  const fps = await Promise.all(sheet.days.map((d) => fullKeyFingerprint(d)));
  assert(fps.length === 30, 'A: September 2026 has 30 days');
  assert(new Set(fps).size === fps.length, 'A: all generated V3 keys unique');
  assert(elapsed < 5000, `A: unique generation not quadratic (${elapsed} ms)`);
}

if (failed > 0) {
  console.error(`\n${failed} full-key fingerprint test(s) failed`);
  process.exit(1);
}
console.log('\nAll full-key fingerprint selftests passed.');
