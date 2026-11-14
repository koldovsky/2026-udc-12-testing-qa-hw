import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount, QuoteError } from '../../app/src/tariff.js';
import { createDayCap } from '../../app/src/day-cap.js';

// Характеризаційні тести з коду, не перевірка правильності тарифу.
// Специфікація не входить до дозволених для читання файлів.
// Питання власнику продукту: як трактувати нічні межі 00:00/06:00
// та поєднання нічної знижки з абонементом і пільгою?
const pickupAt = '2026-01-15T12:00:00+02:00';
function ride(minutes, changes = {}) {
  return { pickupAt, returnAt: new Date(Date.parse(pickupAt) + minutes * 60000).toISOString(),
    bike: 'classic', returnStation: 'S01', ...changes };
}
function expected(minutes, timeCharge, total = timeCharge, discounts = [], fees = []) {
  return { minutes, timeCharge, discounts, fees, total };
}
const standard = { type: 'standard' };
for (const [minutes, charge] of [[0,0],[1,0],[2,2500],[3,2500],[29,2500],[30,2500],[31,5000]]) {
  test(`характеризаційний: classic ${minutes} хв`, () => {
    assert.deepEqual(quote(ride(minutes), standard), expected(minutes, charge));
  });
}
for (const [duration, minutes, charge] of [[1.49,1,0],[1.5,2,2500],[30.49,30,2500],[30.5,31,5000]]) {
  test(`характеризаційний: округлення ${duration} хв`, () => {
    assert.deepEqual(quote(ride(duration), standard), expected(minutes, charge));
  });
}
for (const [minutes, charge] of [[29,4000],[30,4000],[31,8000]]) {
  test(`характеризаційний: ebike ${minutes} хв`, () => {
    assert.deepEqual(quote(ride(minutes, { bike: 'ebike' }), standard), expected(minutes, charge));
  });
}
for (const [minutes, charge, due, saving] of [[44,5000,0,5000],[45,5000,0,5000],[46,5000,2500,2500],[75,7500,2500,5000],[76,7500,5000,2500]]) {
  test(`характеризаційний: абонемент classic ${minutes} хв`, () => {
    assert.deepEqual(quote(ride(minutes), { type: 'subscriber' }),
      expected(minutes, charge, due, [{ code: 'subscription', amount: saving }]));
  });
}
test('характеризаційний: абонемент ebike', () => {
  assert.deepEqual(quote(ride(46, { bike: 'ebike' }), { type: 'subscriber' }),
    expected(46,8000,3200,[{ code:'subscription', amount:4800 }]));
});
test('характеризаційний: вибір пільги та зменшення збору', () => {
  assert.deepEqual(quote(ride(180, { returnStation:'X01' }), { type:'subscriber', concession:true }),
    expected(180,15000,15000,[{ code:'reduced', amount:7500 }],[{ code:'out-of-zone', amount:7500 }]));
});
test('характеризаційний: за однакової економії обирається абонемент', () => {
  assert.deepEqual(quote(ride(60, { returnStation:'X01' }), { type:'subscriber', concession:true }),
    expected(60,5000,17500,[{ code:'subscription', amount:2500 }],[{ code:'out-of-zone', amount:15000 }]));
});
for (const [minutes, charge, fees, total] of [
  [1439,120000,[],30000], [1440,120000,[],30000],
  [1441,122500,[{ code:'unreturned', amount:200000 }],230000],
]) {
  test(`характеризаційний: межа неповернення ${minutes} хв`, () => {
    assert.deepEqual(quote(ride(minutes), standard),
      expected(minutes,charge,total,[{ code:'day-cap', amount:charge-30000 }],fees));
  });
}
test('характеризаційний: нічна знижка всередині інтервалу', () => {
  assert.deepEqual(quote({ pickupAt:'2026-01-15T03:00:00+02:00', returnAt:'2026-01-15T03:30:00+02:00', bike:'classic', returnStation:'S01' }, standard),
    expected(30,2500,1750,[{ code:'night', amount:750 }]));
});
test('характеризаційний: ліміт обмежує час, збори не записуються до журналу', () => {
  const dayCap = createDayCap();
  // Київська дата взяття 2026-01-15; попереднє нарахування користувача u: 29000 коп.
  dayCap.record('u', pickupAt, 29000);
  assert.deepEqual(quote(ride(31, { returnStation:'X01' }), { type:'standard', id:'u' }, { dayCap }),
    expected(31,5000,16000,[{ code:'day-cap', amount:4000 }],[{ code:'out-of-zone', amount:15000 }]));
  assert.equal(dayCap.chargedOn('u','2026-01-15'),30000);
  assert.equal(dayCap.remaining('u',pickupAt),0);
  assert.deepEqual(quote(ride(30), { type:'standard', id:'u' }, { dayCap }),
    expected(30,2500,0,[{ code:'day-cap', amount:2500 }]));
  assert.equal(dayCap.chargedOn('u','2026-01-15'),30000);
});
for (const [amount, percent, result] of [[101,50,51],[1,20,1],[2500,30,750],[0,50,0]]) {
  test(`характеризаційний: discount(${amount}, ${percent})`, () => assert.equal(discount(amount,percent),result));
}
for (const [label, input, rider, options, message] of [
  ['немає поїздки',null,standard,{},'ride is required'],
  ['немає offset',ride(30,{pickupAt:'2026-01-15T12:00:00'}),standard,{},'pickupAt must be an ISO 8601 date-time with an offset'],
  ['некоректна дата',ride(30,{returnAt:'2026-99-15T12:00:00Z'}),standard,{},'returnAt is not a valid date-time'],
  ['повернення раніше',ride(-1),standard,{},'returnAt is before pickupAt'],
  ['невідомий велосипед',ride(30,{bike:'other'}),standard,{},'unknown bike type: other'],
  ['невідома станція',ride(30,{returnStation:'other'}),standard,{},'unknown station: other'],
  ['невідомий користувач',ride(30),{type:'other'},{},'unknown rider type: other'],
  ['немає id',ride(30),standard,{dayCap:createDayCap()},'rider.id is required with a daily cap ledger'],
]) {
  test(`характеризаційний: валідація — ${label}`, () => {
    assert.throws(() => quote(input,rider,options), { name:'QuoteError', message });
  });
}
test('характеризаційний: QuoteError є Error', () => assert.ok(new QuoteError('x') instanceof Error));
