import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount, QuoteError } from '../../src/tariff.js';
import { createDayCap } from '../../src/day-cap.js';

const ride = {
  pickupAt: '2026-09-16T10:00:00+03:00',
  returnAt: '2026-09-16T10:30:00+03:00',
  bike: 'classic',
  returnStation: 'S01',
};
const rider = { type: 'standard', id: 'boundary-rider' };

test('T1, T3: even one millisecond starts the next minute and block', () => {
  const result = quote({ ...ride, returnAt: '2026-09-16T10:30:00.001+03:00' }, rider);
  assert.deepEqual(result, { minutes: 31, timeCharge: 5000, discounts: [], fees: [], total: 5000 });
});

test('T9: fractional kopecks are rounded in the rider’s favour', () => {
  // Specification example: 1235 * 0.7 = 864.5; payable 864, discount 371.
  assert.equal(discount(1235, 30), 371);
  assert.equal(discount(1, 30), 1);
});

test('T1, T2: simultaneous pickup and return is a valid zero-minute ride', () => {
  assert.deepEqual(quote({ ...ride, returnAt: ride.pickupAt }, rider),
    { minutes: 0, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

test('T6: an uncharged rider or day has zero charges without creating an entry', () => {
  const dayCap = createDayCap();
  assert.equal(dayCap.chargedOn(rider.id, '2026-09-16'), 0);
  assert.equal(dayCap.remaining(rider.id, ride.pickupAt), 30000);
  dayCap.record(rider.id, ride.pickupAt, 2500);
  assert.equal(dayCap.chargedOn('other-rider', '2026-09-16'), 0);
  assert.equal(dayCap.chargedOn(rider.id, '2026-09-17'), 0);
});

test('T10: a ride wholly after 06:00 has no night discount', () => {
  const result = quote({ ...ride, pickupAt: '2026-09-16T06:30:00+03:00',
    returnAt: '2026-09-16T07:00:00+03:00' }, rider);
  assert.equal(result.total, 2500);
  assert.equal(result.discounts.some(item => item.code === 'night'), false);
});

test('API contract: a missing ride is a quote error', () => {
  assert.throws(() => quote(null, rider), QuoteError);
});

test('API contract: a pickup instant requires an explicit offset', () => {
  assert.throws(() => quote({ ...ride, pickupAt: '2026-09-16T00:00:00',
    returnAt: '2026-09-18T10:30:00+03:00' }, rider), QuoteError);
});
