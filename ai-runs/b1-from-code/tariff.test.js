import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount, QuoteError } from '../../app/src/tariff.js';
import { createDayCap } from '../../app/src/day-cap.js';

const start = '2026-01-15T10:00:00Z';
function ride(minutes, overrides = {}) {
  return { pickupAt: start, returnAt: new Date(Date.parse(start) + minutes * 60000).toISOString(),
    bike: 'classic', returnStation: 'S01', ...overrides };
}
const standard = { type: 'standard' };

test('rounds duration to minutes, then applies free start and started 30-minute blocks', () => {
  for (const [minutes, rounded, charge] of [
    [0, 0, 0], [1.49, 1, 0], [1.5, 2, 2500], [2, 2, 2500],
    [30.49, 30, 2500], [30.5, 31, 5000], [60, 60, 5000], [61, 61, 7500],
  ]) {
    assert.deepEqual(quote(ride(minutes), standard), {
      minutes: rounded, timeCharge: charge, discounts: [], fees: [], total: charge,
    });
  }
  assert.equal(quote(ride(31, { bike: 'ebike' }), standard).total, 8000);
});

test('subscription free minutes and ebike discount apply to the remaining blocks', () => {
  for (const [minutes, bike, total] of [
    [45, 'classic', 0], [46, 'classic', 2500], [75, 'classic', 2500],
    [76, 'classic', 5000], [45, 'ebike', 0], [46, 'ebike', 3200],
  ]) {
    const result = quote(ride(minutes, { bike }), { type: 'subscriber' });
    assert.equal(result.total, total);
    assert.deepEqual(result.discounts, [{ code: 'subscription', amount: result.timeCharge - total }]);
  }
});

test('concession picks the cheaper plan, retaining subscription on a tie', () => {
  const rider = { type: 'subscriber', concession: true };
  assert.deepEqual(quote(ride(30), rider).discounts, [{ code: 'subscription', amount: 2500 }]);
  assert.deepEqual(quote(ride(60), rider).discounts, [{ code: 'subscription', amount: 2500 }]);
  assert.deepEqual(quote(ride(120), rider).discounts, [{ code: 'reduced', amount: 5000 }]);
  assert.equal(quote(ride(120), { type: 'subscriber', concession: false }).total, 7500);
});

test('night discount uses Kyiv pickup hour, follows plan discount, and ends at 06:00', () => {
  for (const pickupAt of ['2026-01-15T03:59:00Z', '2026-07-15T02:59:00Z']) {
    const returnAt = new Date(Date.parse(pickupAt) + 30 * 60000).toISOString();
    const result = quote(ride(30, { pickupAt, returnAt }), { type: 'reduced' });
    assert.deepEqual(result.discounts, [{ code: 'reduced', amount: 1250 }, { code: 'night', amount: 375 }]);
    assert.equal(result.total, 875);
  }
  for (const pickupAt of ['2026-01-15T04:00:00Z', '2026-07-15T03:00:00Z']) {
    assert.equal(quote(ride(30, { pickupAt, returnAt: new Date(Date.parse(pickupAt) + 1800000).toISOString() }), standard).total, 2500);
  }
});

test('fees are outside the cap, with reduced fees only when the reduced plan wins', () => {
  assert.deepEqual(quote(ride(1440), standard).fees, []);
  const result = quote(ride(1441, { returnStation: 'X01' }), standard);
  assert.deepEqual(result.discounts, [{ code: 'day-cap', amount: 92500 }]);
  assert.deepEqual(result.fees, [{ code: 'out-of-zone', amount: 15000 }, { code: 'unreturned', amount: 200000 }]);
  assert.equal(result.total, 245000);
  assert.deepEqual(quote(ride(1441, { returnStation: 'X01' }), { type: 'reduced' }).fees,
    [{ code: 'out-of-zone', amount: 7500 }, { code: 'unreturned', amount: 100000 }]);
  assert.equal(quote(ride(30, { returnStation: 'X01' }), { type: 'subscriber', concession: true }).total, 15000);
});

test('ledger books discounted time charge on pickup day and excludes fees', () => {
  const dayCap = createDayCap({ limit: 3000 });
  const rider = { type: 'standard', id: 'a' };
  assert.equal(quote(ride(30), rider, { dayCap }).total, 2500);
  const result = quote(ride(30, { returnStation: 'X01' }), rider, { dayCap });
  assert.deepEqual(result.discounts, [{ code: 'day-cap', amount: 2000 }]);
  assert.equal(result.total, 15500);
  assert.equal(dayCap.chargedOn('a', '2026-01-15'), 3000);
  assert.equal(quote(ride(30), rider, { dayCap }).total, 0);
  assert.equal(quote(ride(30), { ...rider, id: 'b' }, { dayCap }).total, 2500);
  const overnight = createDayCap();
  quote(ride(120, { pickupAt: '2026-01-15T23:00:00Z', returnAt: '2026-01-16T01:00:00Z' }), rider, { dayCap: overnight });
  assert.equal(overnight.chargedOn('a', '2026-01-15'), 7000);
  assert.equal(overnight.chargedOn('a', '2026-01-16'), 0);
});

test('discount rounds the payable remainder down to a kopeck', () => {
  assert.equal(discount(101, 30), 31);
  assert.equal(discount(1, 50), 1);
  assert.equal(discount(0, 50), 0);
  assert.equal(discount(100, 0), 0);
  assert.equal(discount(100, 100), 100);
});

test('accepts explicit offsets and an injected station lookup', () => {
  assert.equal(quote(ride(30, { pickupAt: '2026-01-15T12:00+02:00', returnAt: '2026-01-15T10:30Z', returnStation: 'custom' }), standard,
    { zones: { zoneOf: id => id === 'custom' ? 'out' : null } }).total, 17500);
});

test('invalid rides and riders raise QuoteError without booking a charge', () => {
  const dayCap = createDayCap();
  const rider = { type: 'standard', id: 'a' };
  for (const invalid of [null, {}, ride(30, { pickupAt: '2026-01-15T10:00:00' }),
    ride(30, { returnAt: '2026-99-15T10:00:00Z' }), ride(-1),
    ride(30, { bike: 'unknown' }), ride(30, { returnStation: 'unknown' })]) {
    assert.throws(() => quote(invalid, rider, { dayCap }), QuoteError);
  }
  for (const invalid of [null, {}, { type: 'unknown' }, standard]) {
    assert.throws(() => quote(ride(30), invalid, { dayCap }), QuoteError);
  }
  assert.equal(dayCap.chargedOn('a', '2026-01-15'), 0);
  assert.equal(new QuoteError('example').name, 'QuoteError');
});
