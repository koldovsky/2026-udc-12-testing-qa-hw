import test from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../../app/src/tariff.js';
import { createDayCap } from '../../app/src/day-cap.js';

// API contracts documented in tariff.js; no product-price oracle is available.
const ride = (overrides = {}) => ({
  pickupAt: '2026-09-16T10:00:00+03:00',
  returnAt: '2026-09-16T10:10:00+03:00',
  bike: 'classic',
  returnStation: 'S01',
  ...overrides,
});

for (const bike of ['classic', 'ebike']) {
  for (const type of ['standard', 'reduced', 'subscriber']) {
    test(`API: accepts documented bike ${bike} and rider ${type}`, () => {
      const result = quote(ride({ bike }), { type });
      assert.deepEqual(Object.keys(result).sort(),
        ['minutes', 'timeCharge', 'discounts', 'fees', 'total'].sort());
      assert.equal(result.minutes, 10);
      assert.ok(Array.isArray(result.discounts));
      assert.ok(Array.isArray(result.fees));
      for (const item of [...result.discounts, ...result.fees]) {
        assert.deepEqual(Object.keys(item).sort(), ['amount', 'code']);
        assert.equal(typeof item.code, 'string');
        assert.equal(typeof item.amount, 'number');
      }
    });
  }
}

for (const [label, pickupAt, returnAt] of [
  ['Z', '2026-09-16T07:00:00Z', '2026-09-16T07:10:00Z'],
  ['positive offset', '2026-09-16T10:00:00+03:00', '2026-09-16T10:10:00+03:00'],
  ['negative offset', '2026-09-16T02:00:00-05:00', '2026-09-16T02:10:00-05:00'],
  ['Kyiv midnight', '2026-09-16T23:55:00+03:00', '2026-09-17T00:05:00+03:00'],
  ['offset change', '2026-10-25T03:55:00+03:00', '2026-10-25T03:05:00+02:00'],
]) {
  test(`API: explicit ISO instants express ten minutes across ${label}`, () => {
    assert.equal(quote(ride({ pickupAt, returnAt }), { type: 'standard' }).minutes, 10);
  });
}

test('API: quote accepts a real independent daily ledger and rider id', () => {
  const ledger = createDayCap();
  const result = quote(ride(), { type: 'standard', id: 'rider-a' }, { dayCap: ledger });
  assert.equal(result.minutes, 10);
});
