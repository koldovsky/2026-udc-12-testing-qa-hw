import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CAP, dayKey, createDayCap } from '../../app/src/day-cap.js';

test('dayKey uses the UTC date and accepts strings, dates and timestamps', () => {
  assert.equal(dayKey('2026-01-02T00:30:00+02:00'), '2026-01-01');
  assert.equal(dayKey('2026-01-01T23:30:00-02:00'), '2026-01-02');
  assert.equal(dayKey(new Date('2026-01-02T12:00:00Z')), '2026-01-02');
  assert.equal(dayKey(Date.parse('2026-01-02T12:00:00Z')), '2026-01-02');
  assert.throws(() => dayKey('invalid'), RangeError);
});

test('default ledger accumulates charges and clamps the remaining allowance', () => {
  const ledger = createDayCap();
  const at = '2026-01-02T12:00:00Z';
  assert.equal(DAY_CAP, 30000);
  assert.equal(ledger.limit, 30000);
  assert.equal(ledger.remaining('a', at), 30000);
  assert.equal(ledger.chargedOn('a', '2026-01-02'), 0);
  ledger.record('a', at, 12000);
  ledger.record('a', at, 18000);
  assert.equal(ledger.chargedOn('a', '2026-01-02'), 30000);
  assert.equal(ledger.remaining('a', at), 0);
  ledger.record('a', at, 100);
  assert.equal(ledger.chargedOn('a', '2026-01-02'), 30100);
  assert.equal(ledger.remaining('a', at), 0);
});

test('custom limits, riders, UTC days and ledger instances are independent', () => {
  const ledger = createDayCap({ limit: 5000 });
  ledger.record('a', '2026-01-02T00:30:00+02:00', 2000);
  assert.equal(ledger.limit, 5000);
  assert.equal(ledger.remaining('a', '2026-01-01T22:30:00Z'), 3000);
  assert.equal(ledger.remaining('b', '2026-01-01T22:30:00Z'), 5000);
  assert.equal(ledger.remaining('a', '2026-01-02T12:00:00Z'), 5000);
  assert.equal(createDayCap({ limit: 5000 }).remaining('a', '2026-01-01'), 5000);
  assert.equal(createDayCap({ limit: 0 }).remaining('a', '2026-01-01'), 0);
});
