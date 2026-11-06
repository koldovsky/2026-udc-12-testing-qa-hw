import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quote, QuoteError, discount,
  RATES, BLOCK_MINUTES, FREE_START_MINUTES, SUBSCRIPTION_FREE_MINUTES,
  SUBSCRIPTION_EBIKE_PERCENT, REDUCED_PERCENT, NIGHT_PERCENT, NIGHT_UNTIL_HOUR,
  OUT_OF_ZONE_FEE, UNRETURNED_FEE, UNRETURNED_AFTER_MINUTES,
} from '../../app/src/tariff.js';
import { createDayCap } from '../../app/src/day-cap.js';

// Mock zones: 'IN' → "in", 'OUT' → "out", anything else → null
const mockZones = {
  zoneOf(id) {
    if (id === 'IN') return 'in';
    if (id === 'OUT') return 'out';
    return null;
  },
};

// Base ride: 30 min, classic, in-zone, daytime Kyiv (12:00 UTC = 14:00 EET)
const BASE = {
  pickupAt:  '2026-11-05T12:00:00Z',
  returnAt:  '2026-11-05T12:30:00Z',
  bike: 'classic',
  returnStation: 'IN',
};

const STD = { type: 'standard' };

// --- Constants ---

test('RATES: classic=2500, ebike=4000', () => {
  assert.equal(RATES.classic, 2500);
  assert.equal(RATES.ebike,   4000);
});

test('BLOCK_MINUTES is 30', () => assert.equal(BLOCK_MINUTES, 30));
test('FREE_START_MINUTES is 2', () => assert.equal(FREE_START_MINUTES, 2));
test('SUBSCRIPTION_FREE_MINUTES is 45', () => assert.equal(SUBSCRIPTION_FREE_MINUTES, 45));
test('SUBSCRIPTION_EBIKE_PERCENT is 20', () => assert.equal(SUBSCRIPTION_EBIKE_PERCENT, 20));
test('REDUCED_PERCENT is 50', () => assert.equal(REDUCED_PERCENT, 50));
test('NIGHT_PERCENT is 30', () => assert.equal(NIGHT_PERCENT, 30));
test('NIGHT_UNTIL_HOUR is 6', () => assert.equal(NIGHT_UNTIL_HOUR, 6));
test('OUT_OF_ZONE_FEE is 15000', () => assert.equal(OUT_OF_ZONE_FEE, 15000));
test('UNRETURNED_FEE is 200000', () => assert.equal(UNRETURNED_FEE, 200000));
test('UNRETURNED_AFTER_MINUTES is 1440', () => assert.equal(UNRETURNED_AFTER_MINUTES, 1440));

// --- discount() ---

test('discount(1000, 50) = 500', () => assert.equal(discount(1000, 50), 500));

test('discount floors the remaining amount (not the discount itself)', () => {
  // 1001 * 70 / 100 = 700.7 → floor → 700; discount = 1001 − 700 = 301
  assert.equal(discount(1001, 30), 301);
});

test('discount(0, 50) = 0', () => assert.equal(discount(0, 50), 0));

// --- QuoteError ---

test('QuoteError.name is "QuoteError" and it is an Error', () => {
  const e = new QuoteError('oops');
  assert.equal(e.name, 'QuoteError');
  assert.ok(e instanceof Error);
  assert.equal(e.message, 'oops');
});

// --- Validation ---

test('throws QuoteError when ride is null', () => {
  assert.throws(() => quote(null, STD, { zones: mockZones }), QuoteError);
});

test('throws QuoteError when pickupAt is not an ISO 8601 datetime', () => {
  assert.throws(
    () => quote({ ...BASE, pickupAt: 'today' }, STD, { zones: mockZones }),
    QuoteError,
  );
});

test('throws QuoteError when returnAt is before pickupAt', () => {
  assert.throws(
    () => quote({ ...BASE, returnAt: '2026-11-05T11:00:00Z' }, STD, { zones: mockZones }),
    QuoteError,
  );
});

test('throws QuoteError for an unknown bike type', () => {
  assert.throws(
    () => quote({ ...BASE, bike: 'scooter' }, STD, { zones: mockZones }),
    QuoteError,
  );
});

test('throws QuoteError for an unknown return station', () => {
  assert.throws(
    () => quote({ ...BASE, returnStation: 'Z99' }, STD, { zones: mockZones }),
    QuoteError,
  );
});

test('throws QuoteError for an unknown rider type', () => {
  assert.throws(
    () => quote(BASE, { type: 'vip' }, { zones: mockZones }),
    QuoteError,
  );
});

test('throws QuoteError when dayCap is supplied but rider has no id', () => {
  const cap = createDayCap();
  assert.throws(
    () => quote(BASE, STD, { zones: mockZones, dayCap: cap }),
    QuoteError,
  );
});

// --- Standard rider, daytime ---

test('standard 30-min classic ride costs 1 block = 2500', () => {
  const r = quote(BASE, STD, { zones: mockZones });
  assert.equal(r.minutes, 30);
  assert.equal(r.timeCharge, 2500);
  assert.deepEqual(r.discounts, []);
  assert.deepEqual(r.fees, []);
  assert.equal(r.total, 2500);
});

test('ride under 2 minutes is free (timeCharge = 0)', () => {
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T12:01:00Z' }, // 1 min
    STD, { zones: mockZones },
  );
  assert.equal(r.timeCharge, 0);
  assert.equal(r.total, 0);
});

test('31-min ride uses 2 blocks = 5000', () => {
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T12:31:00Z' },
    STD, { zones: mockZones },
  );
  assert.equal(r.timeCharge, 5000);
  assert.equal(r.total, 5000);
});

// --- Subscriber ---

test('subscriber 45-min classic ride: fully covered by free minutes → total 0', () => {
  // timeCharge = ceil(45/30)*2500 = 5000; subscriptionCharge = 0 (all free)
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T12:45:00Z' },
    { type: 'subscriber' },
    { zones: mockZones },
  );
  assert.equal(r.timeCharge, 5000);
  assert.deepEqual(r.discounts, [{ code: 'subscription', amount: 5000 }]);
  assert.equal(r.total, 0);
});

test('subscriber 90-min classic: 45 min free, next 45 min billed (1 block) → 5000', () => {
  // timeCharge = ceil(90/30)*2500 = 7500
  // subscriptionCharge = ceil(45/30)*2500 = 5000; discount = 7500−5000 = 2500
  // due = 5000
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T13:30:00Z' },
    { type: 'subscriber' },
    { zones: mockZones },
  );
  assert.equal(r.timeCharge, 7500);
  assert.deepEqual(r.discounts, [{ code: 'subscription', amount: 2500 }]);
  assert.equal(r.total, 5000);
});

test('subscriber 90-min ebike: extra 20% ebike discount on billed portion → 6400', () => {
  // timeCharge = ceil(90/30)*4000 = 12000
  // subscriptionCharge(90, ebike): billed = ceil(45/30)*4000 = 8000; ebike 20% off → 6400
  // subscription discount = 12000−6400 = 5600; due = 6400
  const r = quote(
    { ...BASE, bike: 'ebike', returnAt: '2026-11-05T13:30:00Z' },
    { type: 'subscriber' },
    { zones: mockZones },
  );
  assert.equal(r.timeCharge, 12000);
  assert.deepEqual(r.discounts, [{ code: 'subscription', amount: 5600 }]);
  assert.equal(r.total, 6400);
});

// --- Subscriber + concession (picks the cheaper plan) ---

test('subscriber+concession picks reduced when it saves more than subscription', () => {
  // 90 min classic: subscription saves 2500, reduced saves 3750 → reduced wins
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T13:30:00Z' },
    { type: 'subscriber', concession: true },
    { zones: mockZones },
  );
  // discount(7500, 50) = 7500 − floor(3750) = 3750
  assert.deepEqual(r.discounts, [{ code: 'reduced', amount: 3750 }]);
  assert.equal(r.total, 3750);
});

test('subscriber+concession picks subscription when it saves more than reduced', () => {
  // 45 min classic: subscription saves 5000, reduced saves 2500 → subscription wins
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T12:45:00Z' },
    { type: 'subscriber', concession: true },
    { zones: mockZones },
  );
  assert.deepEqual(r.discounts, [{ code: 'subscription', amount: 5000 }]);
  assert.equal(r.total, 0);
});

// --- Reduced rider ---

test('reduced rider gets 50% off time charge', () => {
  // 60 min classic: timeCharge = 5000; discount(5000,50) = 2500; total = 2500
  const r = quote(
    { ...BASE, returnAt: '2026-11-05T13:00:00Z' },
    { type: 'reduced' },
    { zones: mockZones },
  );
  assert.equal(r.timeCharge, 5000);
  assert.deepEqual(r.discounts, [{ code: 'reduced', amount: 2500 }]);
  assert.equal(r.total, 2500);
});

// --- Night discount ---

test('night discount (04:00 Kyiv = 02:00 UTC) reduces due by 30%', () => {
  // timeCharge = 2500; night discount = discount(2500,30) = 2500−1750 = 750; total = 1750
  const r = quote(
    {
      ...BASE,
      pickupAt: '2026-11-05T02:00:00Z',
      returnAt: '2026-11-05T02:30:00Z',
    },
    STD, { zones: mockZones },
  );
  assert.equal(r.timeCharge, 2500);
  assert.deepEqual(r.discounts, [{ code: 'night', amount: 750 }]);
  assert.equal(r.total, 1750);
});

test('no night discount when pickup is at or after 06:00 Kyiv (04:00 UTC)', () => {
  // 2026-11-05T04:00:00Z = 06:00 EET — boundary, NOT night
  const r = quote(
    {
      ...BASE,
      pickupAt: '2026-11-05T04:00:00Z',
      returnAt: '2026-11-05T04:30:00Z',
    },
    STD, { zones: mockZones },
  );
  assert.deepEqual(r.discounts, []);
  assert.equal(r.total, 2500);
});

// --- Out-of-zone fee ---

test('out-of-zone fee 15000 is added for a standard rider', () => {
  const r = quote({ ...BASE, returnStation: 'OUT' }, STD, { zones: mockZones });
  assert.deepEqual(r.fees, [{ code: 'out-of-zone', amount: 15000 }]);
  assert.equal(r.total, 2500 + 15000);
});

test('reduced rider gets 50% off the out-of-zone fee', () => {
  // 30 min classic: timeCharge=2500, reduced discount=1250, due=1250
  // fee: 15000 − discount(15000,50) = 15000−7500 = 7500; total = 1250+7500 = 8750
  const r = quote(
    { ...BASE, returnStation: 'OUT' },
    { type: 'reduced' },
    { zones: mockZones },
  );
  assert.deepEqual(r.fees, [{ code: 'out-of-zone', amount: 7500 }]);
  assert.equal(r.total, 1250 + 7500);
});

// --- Unreturned fee ---

test('unreturned fee 200000 is added when ride exceeds 1440 minutes', () => {
  // 1441 min: ceil(1441/30)=49 blocks; timeCharge=49*2500=122500
  // Without a dayCap ledger the code caps due at DAY_CAP(30000): 122500 → 30000
  // total = 30000 (capped due) + 200000 (unreturned fee) = 230000
  const r = quote(
    {
      ...BASE,
      returnAt: '2026-11-06T12:01:00Z', // exactly 1441 min later
    },
    STD, { zones: mockZones },
  );
  assert.equal(r.minutes, 1441);
  assert.equal(r.timeCharge, 122500);
  assert.ok(r.discounts.some(d => d.code === 'day-cap'), 'day-cap discount must be present');
  assert.deepEqual(r.fees, [{ code: 'unreturned', amount: 200000 }]);
  assert.equal(r.total, 230000);
});

// --- Daily cap ---

test('day cap: third ride on the same day is entirely capped when limit is exhausted', () => {
  // limit=5000; two 30-min rides each cost 2500; third ride is free due to cap
  const cap = createDayCap({ limit: 5000 });
  const rider = { type: 'standard', id: 'u1' };

  const ride1 = quote(BASE, rider, { zones: mockZones, dayCap: cap });
  assert.equal(ride1.total, 2500);
  assert.ok(ride1.discounts.every(d => d.code !== 'day-cap'));

  const ride2 = quote(BASE, rider, { zones: mockZones, dayCap: cap });
  assert.equal(ride2.total, 2500);
  assert.ok(ride2.discounts.every(d => d.code !== 'day-cap'));

  const ride3 = quote(BASE, rider, { zones: mockZones, dayCap: cap });
  const capDiscount = ride3.discounts.find(d => d.code === 'day-cap');
  assert.ok(capDiscount, 'day-cap discount must be present');
  assert.equal(capDiscount.amount, 2500);
  assert.equal(ride3.total, 0);
});

test('day cap resets for a new calendar day (UTC)', () => {
  const cap = createDayCap({ limit: 5000 });
  const rider = { type: 'standard', id: 'u1' };

  // Exhaust the cap on Nov 5
  quote(BASE, rider, { zones: mockZones, dayCap: cap });
  quote(BASE, rider, { zones: mockZones, dayCap: cap });

  // A ride on Nov 6 should have full remaining limit
  const nextDay = {
    ...BASE,
    pickupAt: '2026-11-06T12:00:00Z',
    returnAt: '2026-11-06T12:30:00Z',
  };
  const r = quote(nextDay, rider, { zones: mockZones, dayCap: cap });
  assert.ok(r.discounts.every(d => d.code !== 'day-cap'));
  assert.equal(r.total, 2500);
});
