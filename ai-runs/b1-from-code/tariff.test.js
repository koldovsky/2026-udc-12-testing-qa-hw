import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount, QuoteError } from '../../app/src/tariff.js';
import { createDayCap } from '../../app/src/day-cap.js';

const standard = { type: 'standard', id: 'r1' };
function ride(minutes, changes = {}) {
  const pickupAt = '2026-09-16T09:00:00Z';
  return { pickupAt, returnAt: new Date(Date.parse(pickupAt) + minutes * 60000).toISOString(), bike: 'classic', returnStation: 'S01', ...changes };
}

for (const [minutes, charge] of [[0, 0], [1, 0], [1.49, 0], [1.5, 2500], [2, 2500], [30, 2500], [30.49, 2500], [30.5, 5000], [60, 5000], [61, 7500]]) {
  test(`classic duration ${minutes} minutes gives charge ${charge}`, () => {
    assert.deepEqual(quote(ride(minutes), standard), { minutes: Math.round(minutes), timeCharge: charge, discounts: [], fees: [], total: charge });
  });
}

test('ebike has its own block rate', () => {
  assert.deepEqual(quote(ride(31, { bike: 'ebike' }), standard), { minutes: 31, timeCharge: 8000, discounts: [], fees: [], total: 8000 });
});

for (const [minutes, bike, charge, saving, total] of [[45, 'classic', 5000, 5000, 0], [46, 'classic', 5000, 2500, 2500], [75, 'classic', 7500, 5000, 2500], [76, 'classic', 7500, 2500, 5000], [46, 'ebike', 8000, 4800, 3200]]) {
  test(`subscriber ${bike} ${minutes} minutes`, () => {
    assert.deepEqual(quote(ride(minutes, { bike }), { type: 'subscriber' }), { minutes, timeCharge: charge, discounts: [{ code: 'subscription', amount: saving }], fees: [], total });
  });
}

test('reduced plan halves time charge and fees', () => {
  assert.deepEqual(quote(ride(30, { returnStation: 'X01' }), { type: 'reduced' }), { minutes: 30, timeCharge: 2500, discounts: [{ code: 'reduced', amount: 1250 }], fees: [{ code: 'out-of-zone', amount: 7500 }], total: 8750 });
});

test('subscriber concession selects subscription on ties', () => {
  assert.deepEqual(quote(ride(60), { type: 'subscriber', concession: true }).discounts, [{ code: 'subscription', amount: 2500 }]);
});

test('subscriber concession selects the larger reduced saving', () => {
  assert.deepEqual(quote(ride(180), { type: 'subscriber', concession: true }), { minutes: 180, timeCharge: 15000, discounts: [{ code: 'reduced', amount: 7500 }], fees: [], total: 7500 });
});

for (const [pickupAt, discounts, total] of [
  ['2026-09-15T21:00:00Z', [{ code: 'night', amount: 750 }], 1750],
  ['2026-09-16T02:59:00Z', [{ code: 'night', amount: 750 }], 1750],
  ['2026-09-16T03:00:00Z', [], 2500],
]) {
  test(`night rate at ${pickupAt}`, () => {
    const returnAt = new Date(Date.parse(pickupAt) + 30 * 60000).toISOString();
    assert.deepEqual(quote(ride(30, { pickupAt, returnAt }), standard), { minutes: 30, timeCharge: 2500, discounts, fees: [], total });
  });
}

test('night saving applies after the reduced plan', () => {
  assert.deepEqual(quote(ride(30, { pickupAt: '2026-09-16T00:00:00Z', returnAt: '2026-09-16T00:30:00Z' }), { type: 'reduced' }).discounts, [{ code: 'reduced', amount: 1250 }, { code: 'night', amount: 375 }]);
});

test('fully free subscription has no zero night discount', () => {
  assert.deepEqual(quote(ride(30, { pickupAt: '2026-09-16T00:00:00Z', returnAt: '2026-09-16T00:30:00Z' }), { type: 'subscriber' }).discounts, [{ code: 'subscription', amount: 2500 }]);
});

test('daily cap applies without a supplied ledger and excludes fees', () => {
  assert.deepEqual(quote(ride(390, { returnStation: 'X01' }), standard), { minutes: 390, timeCharge: 32500, discounts: [{ code: 'day-cap', amount: 2500 }], fees: [{ code: 'out-of-zone', amount: 15000 }], total: 45000 });
});

test('ledger records billed time only and limits subsequent rides', () => {
  const dayCap = createDayCap({ limit: 3000 });
  assert.equal(quote(ride(30, { returnStation: 'X01' }), standard, { dayCap }).total, 17500);
  assert.equal(dayCap.chargedOn('r1', '2026-09-16'), 2500);
  assert.deepEqual(quote(ride(30), standard, { dayCap }), { minutes: 30, timeCharge: 2500, discounts: [{ code: 'day-cap', amount: 2000 }], fees: [], total: 500 });
  assert.equal(quote(ride(30), standard, { dayCap }).total, 0);
  assert.equal(dayCap.chargedOn('r1', '2026-09-16'), 3000);
});

for (const [minutes, fees, total] of [[1440, [], 30000], [1441, [{ code: 'unreturned', amount: 200000 }], 230000]]) {
  test(`unreturned fee threshold ${minutes}`, () => {
    const result = quote(ride(minutes), standard);
    assert.deepEqual(result.fees, fees);
    assert.equal(result.total, total);
  });
}

test('zone lookup can be injected', () => {
  assert.equal(quote(ride(0, { returnStation: 'CUSTOM' }), standard, { zones: { zoneOf: id => id === 'CUSTOM' ? 'out' : null } }).total, 15000);
});

test('discount rounds the remaining price down to whole kopecks', () => {
  assert.equal(discount(101, 30), 31);
  assert.equal(discount(1, 50), 1);
  assert.equal(discount(100, 0), 0);
  assert.equal(discount(100, 100), 100);
});

for (const [name, input, rider, options, message] of [
  ['missing ride', undefined, standard, {}, 'ride is required'],
  ['offset missing', ride(30, { pickupAt: '2026-09-16T09:00:00' }), standard, {}, 'pickupAt must be an ISO 8601 date-time with an offset'],
  ['invalid date', ride(30, { pickupAt: '2026-13-16T09:00:00Z' }), standard, {}, 'pickupAt is not a valid date-time'],
  ['return invalid', ride(30, { returnAt: 'bad' }), standard, {}, 'returnAt must be an ISO 8601 date-time with an offset'],
  ['return before pickup', ride(-1), standard, {}, 'returnAt is before pickupAt'],
  ['unknown bike', ride(30, { bike: 'cargo' }), standard, {}, 'unknown bike type: cargo'],
  ['unknown station', ride(30, { returnStation: 'unknown' }), standard, {}, 'unknown station: unknown'],
  ['unknown rider', ride(30), { type: 'guest' }, {}, 'unknown rider type: guest'],
  ['missing rider', ride(30), undefined, {}, 'unknown rider type: undefined'],
  ['ledger requires id', ride(30), { type: 'standard' }, { dayCap: createDayCap() }, 'rider.id is required with a daily cap ledger'],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => quote(input, rider, options), { name: 'QuoteError', message });
    assert.throws(() => quote(input, rider, options), QuoteError);
  });
}

test('explicit offsets identify the same ride instants', () => {
  assert.deepEqual(quote(ride(30, { pickupAt: '2026-09-16T12:00:00+03:00', returnAt: '2026-09-16T12:30:00+03:00' }), standard), quote(ride(30), standard));
});

