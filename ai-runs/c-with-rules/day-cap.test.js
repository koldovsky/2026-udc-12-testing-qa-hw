import test from 'node:test';
import assert from 'node:assert/strict';
import { createDayCap, dayKey } from '../../app/src/day-cap.js';

// API bookkeeping contracts from day-cap.js comments; amounts here are ledger inputs,
// not approved product prices or acceptance expectations for quote().
const instant = '2026-09-16T10:00:00+03:00';

test('API: configured limit is exposed and available before any records', () => {
  const ledger = createDayCap({ limit: 17 });
  assert.equal(ledger.limit, 17);
  assert.equal(ledger.remaining('a', instant), 17);
});

test('API: recorded charges accumulate for one rider and day', () => {
  const ledger = createDayCap({ limit: 17 });
  ledger.record('a', instant, 3);
  ledger.record('a', instant, 5);
  assert.equal(ledger.chargedOn('a', '2026-09-16'), 8);
  assert.equal(ledger.remaining('a', instant), 9);
});

test('API: records belong to their rider', () => {
  const ledger = createDayCap({ limit: 17 });
  ledger.record('a', instant, 3);
  assert.equal(ledger.chargedOn('b', '2026-09-16'), 0);
  assert.equal(ledger.remaining('b', instant), 17);
});

test('API: records belong to their day away from timezone boundaries', () => {
  const ledger = createDayCap({ limit: 17 });
  ledger.record('a', instant, 3);
  assert.equal(ledger.chargedOn('a', '2026-09-17'), 0);
  assert.equal(ledger.remaining('a', '2026-09-17T10:00:00+03:00'), 17);
});

test('API: independent ledger instances do not share recorded charges', () => {
  const first = createDayCap({ limit: 17 });
  const second = createDayCap({ limit: 17 });
  first.record('a', instant, 3);
  assert.equal(first.chargedOn('a', '2026-09-16'), 3);
  assert.equal(second.chargedOn('a', '2026-09-16'), 0);
});

test('API: dayKey returns the pickup date for an unambiguous midday instant', () => {
  assert.equal(dayKey(instant), '2026-09-16');
});
