import test from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../../src/tariff.js';
import { createDayCap } from '../../src/day-cap.js';
import { formatReceipt } from '../../src/receipt.js';

// Oracles: docs/test-cases.md, TC-01–TC-37; docs/spec/tariffs.md, T1–T10.
// Amounts below are literal kopecks from those documents, not production constants.
const at = (time, day = '16') => `2026-09-${day}T${time}+03:00`;
const baseRide = {
  pickupAt: at('10:00:00'), returnAt: at('10:30:00'),
  bike: 'classic', returnStation: 'S02',
};
const baseRider = { id: 'U1', type: 'standard' };
const subscriber = { type: 'subscriber' };
const student = { type: 'reduced' };
const both = { type: 'subscriber', concession: true };
const item = (code, amount) => ({ code, amount });
const subscription = amount => [item('subscription', amount)];
const reduced = amount => [item('reduced', amount)];
const cap = amount => [item('day-cap', amount)];
const outside = [item('out-of-zone', 15000)];
const unreturned = [item('unreturned', 200000)];

// Each boundary is its own row. Expected minutes, T3 base, discounts, fees and
// total are independent assertions so a matching total cannot hide a wrong plan.
const cases = [
  ['TC-01', 'T1, T3', 'round 12:40 upward', { returnAt: at('10:12:40') }, {}, 13, 2500, [], [], 2500],
  ['TC-02', 'T1, T3', '30 minutes and one second', { returnAt: at('10:30:01') }, {}, 31, 5000, [], [], 5000],
  ['TC-03', 'T2, T1', '50-second false start', { returnAt: at('10:00:50') }, {}, 1, 0, [], [], 0],
  ['TC-04', 'T2', 'exactly two minutes', { returnAt: at('10:02:00') }, {}, 2, 0, [], [], 0],
  ['TC-05', 'T2, T1, T3', 'two minutes and one second', { returnAt: at('10:02:01') }, {}, 3, 2500, [], [], 2500],
  ['TC-06', 'T3', 'exactly one classic block', {}, {}, 30, 2500, [], [], 2500],
  ['TC-07', 'T3', 'three electric blocks', { bike: 'ebike', returnAt: at('11:15:00') }, {}, 75, 12000, [], [], 12000],
  ['TC-08', 'T4', '45 subscription minutes', { returnAt: at('10:45:00') }, subscriber, 45, 5000, subscription(5000), [], 0],
  ['TC-09', 'T4, T1', '45 minutes and one second', { returnAt: at('10:45:01') }, subscriber, 46, 5000, subscription(2500), [], 2500],
  ['TC-10', 'T4', '55 paid subscription minutes', { returnAt: at('11:40:00') }, subscriber, 100, 10000, subscription(5000), [], 5000],
  ['TC-11', 'T4', 'electric subscription has no free minutes', { bike: 'ebike' }, subscriber, 30, 4000, subscription(800), [], 3200],
  ['TC-12', 'T5', 'student pays half', { returnAt: at('10:40:00') }, student, 40, 5000, reduced(2500), [], 2500],
  ['TC-13', 'T5, T4', 'subscription is cheaper', { returnAt: at('10:40:00') }, both, 40, 5000, subscription(5000), [], 0],
  ['TC-14', 'T5, T4', 'subscription wins a tie', { returnAt: at('11:00:00') }, both, 60, 5000, subscription(2500), [], 2500],
  ['TC-15', 'T5, T4', 'concession is cheaper', { returnAt: at('11:20:00') }, both, 80, 7500, reduced(3750), [], 3750],
  ['TC-16', 'T5, T7', 'student pays the full zone fee', { returnStation: 'X01' }, student, 30, 2500, reduced(1250), outside, 16250],
  ['TC-17', 'T6, T3', 'electric charge reaches daily cap', { bike: 'ebike', returnAt: at('14:00:00') }, {}, 240, 32000, cap(2000), [], 30000],
  ['TC-23', 'T7', 'outside-zone return', { returnStation: 'X01', returnAt: at('10:20:00') }, {}, 20, 2500, [], outside, 17500],
  ['TC-24', 'T7, T2', 'false start still pays zone fee', { returnStation: 'X02', returnAt: at('10:02:00') }, {}, 2, 0, [], outside, 15000],
  ['TC-25', 'T8, T6', 'exactly 24 hours', { returnAt: at('10:00:00', '17') }, {}, 1440, 120000, cap(90000), [], 30000],
  ['TC-26', 'T8, T6', '24 hours and one minute', { returnAt: at('10:01:00', '17') }, {}, 1441, 122500, cap(92500), unreturned, 230000],
  ['TC-27', 'T8, T7, T6', 'both independent fees', { returnStation: 'X03', returnAt: at('11:00:00', '17') }, {}, 1500, 125000, cap(95000), [...outside, ...unreturned], 245000],
  ['TC-28', 'T9, T8', 'integer kopecks and itemised receipt', { returnAt: at('11:00:00', '17') }, {}, 1500, 125000, cap(95000), unreturned, 230000],
  ['TC-29', 'T10', 'fully nighttime ride', { pickupAt: at('01:10:00'), returnAt: at('01:40:00') }, {}, 30, 2500, [item('night', 750)], [], 1750],
  ['TC-30', 'T10, T7', 'night discount excludes fee', { pickupAt: at('01:10:00'), returnAt: at('01:40:00'), returnStation: 'X01' }, {}, 30, 2500, [item('night', 750)], outside, 16750],
  ['TC-31', 'T10', 'daytime has no night discount', {}, {}, 30, 2500, [], [], 2500],
];

for (const [id, rules, description, ride, rider, minutes, timeCharge, discounts, fees, total] of cases) {
  test(`${rules}: ${id} ${description}`, () => {
    const result = quote({ ...baseRide, ...ride }, { ...baseRider, ...rider }, { dayCap: createDayCap() });
    assert.deepStrictEqual(result, { minutes, timeCharge, discounts, fees, total });
    if (id === 'TC-28') {
      for (const amount of [result.timeCharge, result.total, ...result.discounts.map(x => x.amount), ...result.fees.map(x => x.amount)]) {
        assert.ok(Number.isInteger(amount), 'money is integer kopecks');
      }
      const lines = formatReceipt(result);
      // Match meaning and amounts without prescribing padding or exact labels.
      for (const pattern of [/1500\s*хв/u, /нарахування.*1 250,00 грн/u, /ліміт.*-950,00 грн/u, /[Зз]бір.*2 000,00 грн/u, /До сплати.*2 300,00 грн/u]) {
        assert.equal(lines.filter(line => pattern.test(line)).length, 1, String(pattern));
      }
      assert.equal(lines.length, 5, 'duration, base, cap, fee and total are separate lines');
    }
  });
}

// Seed the real ledger through its public API with the stated previous charges.
// Explicit pickup instants preserve the Kyiv/UTC distinctions in TC-36 and TC-37.
const ledgerCases = [
  ['TC-18', 'T6', 29000, 'U1', at('09:00:00'), {}, 1000, 30000, '2026-09-16'],
  ['TC-19', 'T6, T7', 30000, 'U1', at('09:00:00'), { returnStation: 'X01' }, 15000, 30000, '2026-09-16'],
  ['TC-20', 'T6', 30000, 'U1', at('09:00:00'), { pickupAt: at('10:00:00', '17'), returnAt: at('10:30:00', '17') }, 2500, 2500, '2026-09-17'],
  ['TC-21', 'T6', 30000, 'U1', at('09:00:00'), { pickupAt: at('23:40:00'), returnAt: at('00:20:00', '17') }, 0, 30000, '2026-09-16'],
  ['TC-22', 'T6', 30000, 'U2', at('09:00:00'), {}, 2500, 2500, '2026-09-16'],
  ['TC-36', 'T6, T10', 30000, 'U1', at('00:30:00', '17'), { pickupAt: at('04:00:00', '17'), returnAt: at('04:30:00', '17') }, 0, 30000, '2026-09-17'],
  ['TC-37', 'T6, T10', 30000, 'U1', at('20:00:00'), { pickupAt: at('00:30:00', '17'), returnAt: at('01:00:00', '17') }, 1750, 1750, '2026-09-17'],
];
for (const [id, rules, previous, previousRider, pickup, ride, total, accumulated, day] of ledgerCases) {
  test(`${rules}: ${id} daily ledger by rider and Kyiv pickup date`, () => {
    const dayCap = createDayCap();
    dayCap.record(previousRider, pickup, previous);
    const result = quote({ ...baseRide, ...ride }, baseRider, { dayCap });
    assert.equal(result.total, total, 'ride total');
    assert.deepStrictEqual(result.fees, id === 'TC-19' ? outside : []);
    assert.equal(result.timeCharge - result.discounts.reduce((sum, x) => sum + x.amount, 0), id === 'TC-19' ? 0 : total, 'time charge after discounts');
    assert.equal(dayCap.chargedOn('U1', day), accumulated, 'accumulated hourly charge');
  });
}

const invalidCases = [
  ['TC-32', 'T1', { returnAt: at('09:59:59') }, {}, /return|повернен|раніш|before/iu],
  ['TC-33', 'T3', { bike: 'cargo' }, {}, /bike|велосипед|тип/iu],
  ['TC-34', 'T5', {}, { type: 'guest' }, /rider|категор|користувач/iu],
  ['TC-35', 'T7', { returnStation: 'S99' }, {}, /station|станці/iu],
];
for (const [id, rule, ride, rider, explanation] of invalidCases) {
  test(`${rule}: ${id} invalid request is rejected with an explanation`, () => {
    // No exact error class or wording is specified. A throw prevents a quote
    // from being returned, and its message must explain the invalid input.
    assert.throws(() => quote({ ...baseRide, ...ride }, { ...baseRider, ...rider }), error => {
      assert.equal(typeof error.message, 'string');
      assert.match(error.message, explanation);
      return true;
    });
  });
}
