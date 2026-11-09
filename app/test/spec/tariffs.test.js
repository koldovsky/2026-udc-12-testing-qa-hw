import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount } from '../../src/tariff.js';
import { createDayCap, dayKey } from '../../src/day-cap.js';
import { formatUah, formatReceipt } from '../../src/receipt.js';

const pickup = '2026-09-16T07:00:00Z';
function ride(seconds, overrides = {}) {
  const pickupAt = overrides.pickupAt ?? pickup;
  return { pickupAt, returnAt: new Date(Date.parse(pickupAt) + seconds * 1000).toISOString(), bike: 'classic', returnStation: 'S01', ...overrides };
}
function check(result, expected) {
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(result[field], value, field);
}
const cases = [
  ['TC-01', 'T1', 1801, {}, {}, { minutes: 31, timeCharge: 5000, total: 5000 }],
  ['TC-02', 'T1', 760, {}, {}, { minutes: 13, total: 2500 }],
  ['TC-03', 'T1', 10800, { pickupAt: '2026-10-25T02:30:00+03:00', returnAt: '2026-10-25T04:30:00+02:00' }, {}, { minutes: 180, timeCharge: 15000 }],
  ['TC-04', 'T2', 119, {}, {}, { minutes: 2, total: 0 }],
  ['TC-05', 'T2', 120, {}, {}, { minutes: 2, total: 0 }],
  ['TC-06', 'T2', 121, {}, {}, { minutes: 3, total: 2500 }],
  ['TC-07', 'T2,T7', 50, { returnStation: 'X01' }, {}, { timeCharge: 0, fees: [{ code: 'out-of-zone', amount: 15000 }], total: 15000 }],
  ['TC-08', 'T3', 1740, {}, {}, { total: 2500 }],
  ['TC-09', 'T3', 1800, {}, {}, { total: 2500 }],
  ['TC-10', 'T3', 1860, {}, {}, { total: 5000 }],
  ['TC-11', 'T3', 4500, { bike: 'ebike' }, {}, { total: 12000 }],
  ['TC-12', 'T4', 2640, {}, { type: 'subscriber' }, { total: 0 }],
  ['TC-13', 'T4', 2700, {}, { type: 'subscriber' }, { total: 0 }],
  ['TC-14', 'T4', 2760, {}, { type: 'subscriber' }, { total: 2500 }],
  ['TC-15', 'T4', 6000, {}, { type: 'subscriber' }, { total: 5000 }],
  ['TC-16', 'T4', 2400, { bike: 'ebike' }, { type: 'subscriber' }, { timeCharge: 8000, discounts: [{ code: 'subscription', amount: 1600 }], total: 6400 }],
  ['TC-17', 'T4', 120, { bike: 'ebike' }, { type: 'subscriber' }, { total: 0 }],
  ['TC-18', 'T5', 2400, {}, { type: 'reduced' }, { timeCharge: 5000, discounts: [{ code: 'reduced', amount: 2500 }], total: 2500 }],
  ['TC-19', 'T5', 4800, {}, { type: 'subscriber', concession: true }, { discounts: [{ code: 'reduced', amount: 3750 }], total: 3750 }],
  ['TC-20', 'T5', 3000, {}, { type: 'subscriber', concession: true }, { discounts: [{ code: 'subscription', amount: 2500 }], total: 2500 }],
  ['TC-21', 'T5', 2400, {}, { type: 'subscriber', concession: true }, { discounts: [{ code: 'subscription', amount: 5000 }], total: 0 }],
  ['TC-22', 'T5,T7', 2400, { returnStation: 'X01' }, { type: 'reduced' }, { discounts: [{ code: 'reduced', amount: 2500 }], fees: [{ code: 'out-of-zone', amount: 15000 }], total: 17500 }],
  ['TC-23', 'T5,T8', 90000, {}, { type: 'reduced' }, { fees: [{ code: 'unreturned', amount: 200000 }], total: 230000 }],
  ['TC-31', 'T8', 86400, {}, {}, { fees: [], total: 30000 }],
  ['TC-32', 'T8', 86460, {}, {}, { fees: [{ code: 'unreturned', amount: 200000 }], total: 230000 }],
  ['TC-33', 'T7,T8', 90000, { returnStation: 'X03' }, {}, { fees: [{ code: 'out-of-zone', amount: 15000 }, { code: 'unreturned', amount: 200000 }], total: 245000 }],
  ['TC-37', 'T10', 1800, { pickupAt: '2026-09-15T22:10:00Z' }, {}, { timeCharge: 2500, discounts: [{ code: 'night', amount: 750 }], total: 1750 }],
  ['TC-38', 'T10', 1800, { pickupAt: '2026-09-15T21:00:00Z' }, {}, { timeCharge: 2500, discounts: [{ code: 'night', amount: 750 }], total: 1750 }],
  ['TC-39', 'T10', 1800, { pickupAt: '2026-09-16T03:00:00Z' }, {}, { discounts: [], total: 2500 }],
];
for (const [id, rule, seconds, overrides, rider, expected] of cases) {
  test(`${rule}: ${id} (${seconds}s)`, () => {
    const result = quote(ride(seconds, overrides), { type: 'standard', id: 'r1', ...rider }, { dayCap: createDayCap() });
    check(result, expected);
    if (id === 'TC-22') assert.equal(result.timeCharge - result.discounts.reduce((sum, item) => sum + item.amount, 0), 2500);
    if (id === 'TC-23' || id === 'TC-33') assert.equal(result.total - result.fees.reduce((sum, item) => sum + item.amount, 0), 30000);
  });
}

test('T6: TC-24 accumulates three rides to the daily cap', () => {
  const dayCap = createDayCap();
  const rows = [['06:00', 12000], ['10:00', 12000], ['15:00', 6000]];
  for (const [time, expected] of rows) {
    const result = quote(ride(4800, { pickupAt: `2026-09-16T${time}:00Z`, bike: 'ebike' }), { type: 'standard', id: 'r1' }, { dayCap });
    assert.equal(result.total, expected, time);
  }
  assert.equal(dayCap.chargedOn('r1', '2026-09-16'), 30000);
});

test('T6: TC-25 crossing midnight books only the pickup day', () => {
  const dayCap = createDayCap();
  dayCap.record('r1', '2026-09-16T20:00:00Z', 29000);
  const pickupAt = '2026-09-16T20:40:00Z';
  assert.equal(dayKey(pickupAt), '2026-09-16');
  const result = quote(ride(2400, { pickupAt }), { type: 'standard', id: 'r1' }, { dayCap });
  // Q-1 leaves the amount open; verify only which day receives the amount charged.
  const timeDue = result.total - result.fees.reduce((sum, fee) => sum + fee.amount, 0);
  assert.equal(dayCap.chargedOn('r1', '2026-09-16'), 29000 + timeDue);
  assert.equal(dayCap.chargedOn('r1', '2026-09-17'), 0);
});

test('T6: TC-26 midnight starts a new Kyiv-day allowance', () => {
  const dayCap = createDayCap();
  dayCap.record('r1', '2026-09-16T20:00:00Z', 29000);
  const pickupAt = '2026-09-16T21:10:00Z';
  assert.equal(dayKey(pickupAt), '2026-09-17');
  assert.equal(dayCap.remaining('r1', pickupAt), 30000);
  const result = quote(ride(1200, { pickupAt }), { type: 'standard', id: 'r1' }, { dayCap });
  assert.equal(result.timeCharge, 2500);
});

for (const [id, rule, riderId, station, total, fees, chargedR2] of [
  ['TC-27', 'T6', 'r2', 'S01', 2500, [], 2500],
  ['TC-28', 'T6,T7', 'r1', 'X02', 15000, [{ code: 'out-of-zone', amount: 15000 }], 0],
]) {
  test(`${rule}: ${id} capped rider and independent fees/riders`, () => {
    const dayCap = createDayCap();
    dayCap.record('r1', pickup, 30000);
    const result = quote(ride(1200, { returnStation: station }), { type: 'standard', id: riderId }, { dayCap });
    check(result, { total, fees });
    assert.equal(dayCap.chargedOn('r1', '2026-09-16'), 30000);
    assert.equal(dayCap.chargedOn('r2', '2026-09-16'), chargedR2);
    if (id === 'TC-28') assert.equal(result.total - result.fees[0].amount, 0);
  });
}

for (const station of ['X01', 'X02', 'X03', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08']) {
  const outside = station.startsWith('X');
  test(`T7: ${outside ? 'TC-29' : 'TC-30'} station ${station}`, () => {
    const result = quote(ride(1200, { returnStation: station }), { type: 'standard', id: 'r1' }, { dayCap: createDayCap() });
    check(result, { fees: outside ? [{ code: 'out-of-zone', amount: 15000 }] : [], total: outside ? 17500 : 2500 });
  });
}

test('T9: TC-34 fractional kopeck favors the rider', () => {
  assert.equal(discount(1235, 30), 371);
  assert.equal(1235 - discount(1235, 30), 864);
});
for (const [amount, expected] of [[230000, '2 300,00 грн'], [-1250, '-12,50 грн'], [0, '0,00 грн']]) {
  test(`T9: TC-35 format ${amount}`, () => assert.equal(formatUah(amount), expected));
}

test('T9: TC-36 receipt contains each item and signed amounts', () => {
  const lines = formatReceipt({ minutes: 1500, timeCharge: 125000, discounts: [{ code: 'day-cap', amount: 95000 }], fees: [{ code: 'out-of-zone', amount: 15000 }, { code: 'unreturned', amount: 200000 }], total: 245000 });
  assert.equal(lines.length, 6);
  const expectations = [
    [/Тривалість/, /1500\s+хв/],
    [/Погодинне нарахування/, /1 250,00 грн/],
    [/Денний ліміт/, /-950,00 грн/],
    [/поза зоною/, /150,00 грн/],
    [/неповернений велосипед/, /2 000,00 грн/],
    [/До сплати/, /2 450,00 грн/],
  ];
  for (const [i, patterns] of expectations.entries()) for (const pattern of patterns) assert.match(lines[i], pattern);
});

for (const [id, overrides, rider] of [
  ['TC-40', { returnAt: '2026-09-16T06:59:59Z' }, {}],
  ['TC-41', { bike: 'cargo' }, {}],
  ['TC-42', {}, { type: 'visitor' }],
  ['TC-43', { returnStation: 'S99' }, {}],
]) {
  test(`T1,T3,T5,T7: ${id} invalid data is rejected with explanation`, () => {
    assert.throws(() => quote(ride(1200, overrides), { type: 'standard', id: 'r1', ...rider }, { dayCap: createDayCap() }), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.trim().length > 0);
      return true;
    });
  });
}
