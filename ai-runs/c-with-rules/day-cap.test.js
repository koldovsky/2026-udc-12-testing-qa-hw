// Unit-тести для app/src/day-cap.js (і його використання в quote()).
//
// УВАГА: специфікацію docs/spec/tariffs.md у цьому прогоні не читали. Очікування виведено з
// поточного коду, тож усі тести позначено «(current behaviour)» і вони неперевірені.
// Межу доби біля опівночі навмисно НЕ зафіксовано тестом: код рахує добу за UTC
// (toISOString), а нічна знижка — за Києвом; що правильно, має сказати специфікація
// (див. питання у звіті).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDayCap, dayKey } from "../../app/src/day-cap.js";
import { quote, QuoteError } from "../../app/src/tariff.js";

const DAY = "2026-09-15";
const AT = "2026-09-15T08:00:00Z"; // 11:00 за Києвом — та сама дата і за UTC, і за Києвом

// ---------------------------------------------------------------------------------------------
// dayKey — лише точки посеред дня (межу див. вище).
// ---------------------------------------------------------------------------------------------
const dayKeyCases = [
  ["рядок із Z", "2026-09-15T08:00:00Z", "2026-09-15"],
  ["рядок зі зсувом +03:00", "2026-09-15T12:00:00+03:00", "2026-09-15"],
  ["мілісекунди (як передає quote)", Date.parse("2026-09-15T08:00:00Z"), "2026-09-15"],
];

for (const [id, input, expected] of dayKeyCases) {
  test(`T6: dayKey, ${id} → ${expected} (current behaviour)`, () => {
    assert.equal(dayKey(input), expected);
  });
}

// ---------------------------------------------------------------------------------------------
// Журнал createDayCap: remaining / record / chargedOn.
// ---------------------------------------------------------------------------------------------
test("T6: новий журнал, ліміт за замовчуванням → remaining 30000 (current behaviour)", () => {
  assert.equal(createDayCap().remaining("r1", AT), 30000);
});

test("T6: власний ліміт 10000 → remaining 10000 (current behaviour)", () => {
  assert.equal(createDayCap({ limit: 10000 }).remaining("r1", AT), 10000);
});

const remainingCases = [
  // id, recorded amounts, remaining
  ["записано 2500", [2500], 27500],
  ["записано 2500 + 5000", [2500, 5000], 22500],
  ["записано 29999 (ліміт − 1)", [29999], 1],
  ["записано 30000 (рівно ліміт)", [30000], 0],
  ["записано 30001 (ліміт + 1) → не від'ємне", [30001], 0],
];

for (const [id, amounts, expected] of remainingCases) {
  test(`T6: ${id} → remaining ${expected} (current behaviour)`, () => {
    const cap = createDayCap();
    for (const amount of amounts) cap.record("r1", AT, amount);
    assert.equal(cap.remaining("r1", AT), expected);
  });
}

test("T6: chargedOn підсумовує записи за день: 2500 + 5000 = 7500 (current behaviour)", () => {
  const cap = createDayCap();
  cap.record("r1", AT, 2500);
  cap.record("r1", "2026-09-15T10:00:00Z", 5000);
  assert.equal(cap.chargedOn("r1", DAY), 7500);
});

test("T6: chargedOn без записів → 0 (current behaviour)", () => {
  assert.equal(createDayCap().chargedOn("r1", DAY), 0);
});

test("T6: інший райдер того ж дня не зачеплений → 30000 (current behaviour)", () => {
  const cap = createDayCap();
  cap.record("r1", AT, 30000);
  assert.equal(cap.remaining("r2", AT), 30000);
});

test("T6: той самий райдер наступного дня (полудень) → 30000 (current behaviour)", () => {
  const cap = createDayCap();
  cap.record("r1", AT, 30000);
  assert.equal(cap.remaining("r1", "2026-09-16T08:00:00Z"), 30000);
});

// ---------------------------------------------------------------------------------------------
// quote() із журналом: ліміт рахується на суму поїздок дня; збори поза лімітом.
// Стандартний, classic, 2500 за 30 хв.
// ---------------------------------------------------------------------------------------------
const ride = (pickupAt, returnAt, returnStation = "S01") => ({
  pickupAt,
  returnAt,
  bike: "classic",
  returnStation,
});
const R1 = { type: "standard", id: "r1" };
// Перша поїздка дня: 5 год = 10 блоків = 25000 (залишок 5000).
const FIRST = ride("2026-09-15T08:00:00Z", "2026-09-15T13:00:00Z");

const ledgerCases = [
  // id, second ride, rider, expected result, chargedOn after
  ["2-га поїздка 60 хв = 5000 = рівно залишок → без day-cap",
    ride("2026-09-15T14:00:00Z", "2026-09-15T15:00:00Z"), R1,
    { minutes: 60, timeCharge: 5000, discounts: [], fees: [], total: 5000 }, 30000],
  ["2-га поїздка 61 хв = 7500 = залишок + блок → day-cap 2500",
    ride("2026-09-15T14:00:00Z", "2026-09-15T15:00:30Z"), R1,
    { minutes: 61, timeCharge: 7500, discounts: [{ code: "day-cap", amount: 2500 }], fees: [],
      total: 5000 }, 30000],
  ["інший райдер того ж дня → повна ціна",
    ride("2026-09-15T14:00:00Z", "2026-09-15T15:30:00Z"), { type: "standard", id: "r2" },
    { minutes: 90, timeCharge: 7500, discounts: [], fees: [], total: 7500 }, 25000],
  ["той самий райдер наступного дня (08:00Z) → повна ціна",
    ride("2026-09-16T08:00:00Z", "2026-09-16T09:30:00Z"), R1,
    { minutes: 90, timeCharge: 7500, discounts: [], fees: [], total: 7500 }, 25000],
];

for (const [id, second, rider, expected, chargedAfter] of ledgerCases) {
  test(`T6: журнал, ${id} (current behaviour)`, () => {
    const dayCap = createDayCap();
    quote(FIRST, R1, { dayCap });
    assert.deepEqual(quote(second, rider, { dayCap }), expected);
    assert.equal(dayCap.chargedOn("r1", DAY), chargedAfter);
  });
}

test("T6: ліміт вичерпано, 2-га поїздка в X01 → час 0, збір 15000 (current behaviour)", () => {
  const dayCap = createDayCap();
  quote(ride("2026-09-15T08:00:00Z", "2026-09-15T14:00:00Z"), R1, { dayCap }); // 12 блоків = 30000
  const r = quote(ride("2026-09-15T15:00:00Z", "2026-09-15T15:30:00Z", "X01"), R1, { dayCap });
  assert.deepEqual(r, {
    minutes: 30,
    timeCharge: 2500,
    discounts: [{ code: "day-cap", amount: 2500 }],
    fees: [{ code: "out-of-zone", amount: 15000 }],
    total: 15000,
  });
  assert.equal(dayCap.chargedOn("r1", DAY), 30000);
});

test("T6: у журнал іде сума після пільги: 25000 − 12500 = 12500 (current behaviour)", () => {
  const dayCap = createDayCap();
  quote(FIRST, { type: "reduced", id: "r1" }, { dayCap });
  assert.equal(dayCap.chargedOn("r1", DAY), 12500);
});

test("T6: журнал без rider.id → QuoteError (current behaviour)", () => {
  assert.throws(
    () => quote(FIRST, { type: "standard" }, { dayCap: createDayCap() }),
    (err) => err instanceof QuoteError && err.message.length > 0,
  );
});
