import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CAP, dayKey, createDayCap } from '../../app/src/day-cap.js';

const pickup = '2026-09-16T09:00:00Z';

test('default ledger starts with the full default allowance', () => {
  const ledger = createDayCap();
  assert.equal(DAY_CAP, 30000);
  assert.equal(ledger.limit, 30000);
  assert.equal(ledger.remaining('r1', pickup), 30000);
  assert.equal(ledger.chargedOn('r1', '2026-09-16'), 0);
});

test('records accumulate and remaining cannot fall below zero', () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record('r1', pickup, 250);
  ledger.record('r1', pickup, 500);
  assert.equal(ledger.remaining('r1', pickup), 250);
  assert.equal(ledger.chargedOn('r1', '2026-09-16'), 750);
  ledger.record('r1', pickup, 500);
  assert.equal(ledger.remaining('r1', pickup), 0);
  assert.equal(ledger.chargedOn('r1', '2026-09-16'), 1250);
});

test('balances are isolated by rider, day and ledger instance', () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record('r1', pickup, 300);
  assert.equal(ledger.remaining('r2', pickup), 1000);
  assert.equal(ledger.remaining('r1', '2026-09-17T09:00:00Z'), 1000);
  assert.equal(createDayCap({ limit: 1000 }).remaining('r1', pickup), 1000);
});

test('zero limit and zero records are supported', () => {
  const ledger = createDayCap({ limit: 0 });
  ledger.record('r1', pickup, 0);
  assert.equal(ledger.limit, 0);
  assert.equal(ledger.remaining('r1', pickup), 0);
  assert.equal(ledger.chargedOn('r1', '2026-09-16'), 0);
});

test('day keys use the UTC date of an instant', () => {
  assert.equal(dayKey('2026-09-16T00:30:00+03:00'), '2026-09-15');
  assert.equal(dayKey('2026-09-15T21:30:00Z'), '2026-09-15');
  assert.equal(dayKey('2026-09-16T23:30:00-03:00'), '2026-09-17');
});

test('equivalent offsets address the same ledger entry', () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record('r1', '2026-09-16T00:30:00+03:00', 300);
  assert.equal(ledger.remaining('r1', '2026-09-15T21:30:00Z'), 700);
  assert.equal(ledger.chargedOn('r1', '2026-09-15'), 300);
});

test('dayKey rejects an invalid instant', () => {
  assert.throws(() => dayKey('invalid'), RangeError);
});
