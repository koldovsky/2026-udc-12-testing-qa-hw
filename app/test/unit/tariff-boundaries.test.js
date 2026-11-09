import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, QuoteError } from '../../src/tariff.js';
import { createDayCap } from '../../src/day-cap.js';

const pickupAt = '2026-09-16T07:00:00Z';
const standard = { type: 'standard', id: 'boundary-rider' };
const ride = (overrides = {}) => ({
  pickupAt,
  returnAt: '2026-09-16T07:30:00Z',
  bike: 'classic',
  returnStation: 'S01',
  ...overrides,
});

test('T1: zero elapsed time is a valid free ride', () => {
  assert.deepEqual(quote(ride({ returnAt: pickupAt }), standard), {
    minutes: 0, timeCharge: 0, discounts: [], fees: [], total: 0,
  });
});

for (const [returnAt, minutes, total] of [
  ['2026-09-16T07:02:00.001Z', 3, 2500],
  ['2026-09-16T07:30:00.001Z', 31, 5000],
]) {
  test(`T1,T2,T3: a millisecond beyond the boundary bills ${minutes} minutes`, () => {
    assert.deepEqual(quote(ride({ returnAt }), standard), {
      minutes, timeCharge: total, discounts: [], fees: [], total,
    });
  });
}

test('T2,T10: a free night ride has no monetary charge', () => {
  const result = quote(ride({
    pickupAt: '2026-09-15T22:00:00Z',
    returnAt: '2026-09-15T22:02:00Z',
  }), standard);
  // Q-4: zero-valued presentation rows are not specified; assert money only.
  assert.equal(result.minutes, 2);
  assert.equal(result.timeCharge, 0);
  assert.equal(result.total, 0);
});

test('T6: exactly reaching the allowance bills the remaining amount', () => {
  const dayCap = createDayCap();
  dayCap.record(standard.id, pickupAt, 27500);
  const result = quote(ride(), standard, { dayCap });
  // Q-4: do not choose whether a zero-valued cap row must be omitted.
  assert.equal(result.minutes, 30);
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.total, 2500);
  assert.equal(dayCap.chargedOn(standard.id, '2026-09-16'), 30000);
  assert.equal(dayCap.remaining(standard.id, pickupAt), 0);
});

test('T6,T7: cap discount is itemised and the zone fee is excluded from the ledger', () => {
  const dayCap = createDayCap();
  dayCap.record(standard.id, pickupAt, 29000);
  assert.deepEqual(quote(ride({ returnStation: 'X01' }), standard, { dayCap }), {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: 'day-cap', amount: 1500 }],
    fees: [{ code: 'out-of-zone', amount: 15000 }],
    total: 16000,
  });
  assert.equal(dayCap.chargedOn(standard.id, '2026-09-16'), 30000);
});

// API characterization of input guards, not product-price acceptance tests.
test('API: missing ride produces a domain error', () => {
  assert.throws(() => quote(null, standard), QuoteError);
});

for (const field of ['pickupAt', 'returnAt']) {
  test(`API: ${field} without an explicit timezone is rejected`, () => {
    assert.throws(() => quote(ride({ [field]: '2026-09-16T07:10:00' }), standard), QuoteError);
  });
}
