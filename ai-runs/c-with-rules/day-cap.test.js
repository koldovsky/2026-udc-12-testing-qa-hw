import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, createDayCap } from '../../app/src/day-cap.js';

// Характеризаційні тести з коду; специфікацію не читали.
// Питання власнику продукту: добу журналу визначати за UTC чи Europe/Kyiv?
for (const [instant, day] of [
  ['2026-01-15T12:00:00+02:00','2026-01-15'],
  ['2026-01-16T00:30:00+02:00','2026-01-15'],
  ['2026-01-15T23:30:00-02:00','2026-01-16'],
]) {
  test(`характеризаційний: UTC dayKey для ${instant}`, () => assert.equal(dayKey(instant),day));
}
test('характеризаційний: накопичення, ізоляція користувачів і UTC-днів', () => {
  const ledger = createDayCap();
  const pickup = '2026-01-15T12:00:00+02:00'; // Київська дата 2026-01-15; попередніх нарахувань немає.
  assert.equal(ledger.limit,30000);
  assert.equal(ledger.remaining('a',pickup),30000);
  assert.equal(ledger.chargedOn('a','2026-01-15'),0);
  ledger.record('a',pickup,2500);
  ledger.record('a',pickup,4000);
  assert.equal(ledger.chargedOn('a','2026-01-15'),6500);
  assert.equal(ledger.remaining('a',pickup),23500);
  assert.equal(ledger.remaining('b',pickup),30000);
  assert.equal(ledger.remaining('a','2026-01-16T12:00:00+02:00'),30000);
  assert.equal(ledger.chargedOn('b','2026-01-15'),0);
});
test('характеризаційний: київська північ не перемикає UTC-журнал', () => {
  const ledger = createDayCap();
  // Київські дати 15 та 16 січня; попереднє нарахування a — 2500 коп.
  ledger.record('a','2026-01-15T23:30:00+02:00',2500);
  assert.equal(ledger.remaining('a','2026-01-16T00:30:00+02:00'),27500);
  assert.equal(ledger.chargedOn('a','2026-01-15'),2500);
  assert.equal(ledger.chargedOn('a','2026-01-16'),0);
});
for (const [amount, remaining] of [[29999,1],[30000,0],[30001,0]]) {
  test(`характеризаційний: запис ${amount} коп.`, () => {
    const ledger = createDayCap();
    const pickup = '2026-01-15T12:00:00+02:00'; // Київська дата 2026-01-15; попередніх нарахувань немає.
    ledger.record('a',pickup,amount);
    assert.equal(ledger.remaining('a',pickup),remaining);
    assert.equal(ledger.chargedOn('a','2026-01-15'),amount);
  });
}
test('характеризаційний: окремі екземпляри та власний ліміт', () => {
  const first = createDayCap({limit:100});
  const second = createDayCap({limit:0});
  const pickup = '2026-01-15T12:00:00+02:00'; // Київська дата 2026-01-15; попередніх нарахувань немає.
  first.record('a',pickup,60);
  assert.equal(first.remaining('a',pickup),40);
  assert.equal(second.remaining('a',pickup),0);
  assert.equal(second.chargedOn('a','2026-01-15'),0);
});
